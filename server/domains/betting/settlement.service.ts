/**
 * server/domains/betting/settlement.service.ts
 * ------------------------------------------------------------------
 * ★ ตรวจรางวัล + จ่ายเงิน — ปลอดภัยจากการเรียกซ้ำ ★
 *
 * ปัญหาเดิม:
 *   POST /results/settle เรียกได้ไม่จำกัด → โพย confirmed ถูกจ่ายซ้ำ
 *   และไม่กรอง roundId → ไปตัดสินโพยของงวดอื่นด้วย
 *
 * วิธีแก้ (3 ชั้น):
 *   1. ต้องระบุ roundId → ตัดสินเฉพาะโพยของรอบนั้น
 *   2. เขียน "lock" ลงเอกสารรอบก่อนเริ่ม (settlement status)
 *      ถ้ารอบถูก settle แล้ว → ตอบ ALREADY_SETTLED ทันที
 *   3. ตรวจซ้ำรายโพย: ถ้า settledAt มีค่าแล้ว → ข้าม
 *
 * ★ ใช้ status 'settling' เป็นตัวล็อกกลางทาง กัน 2 request พร้อมกัน
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import { COL, TICKET_STATUS } from '../../config/collections';
import { wallet, AppError } from '../../lib/wallet';
import { ERR } from '../../lib/response';
import { evaluateTicket, type LotteryResult, type EvalBet } from './evaluate';

export interface SettleInput {
  lotterySlug: string;
  roundId: string;                 // ★ บังคับ — ห้าม settle โดยไม่ระบุรอบ
  result: LotteryResult;
  /** ถ้า true = คำนวณให้ดูเฉย ๆ ไม่จ่ายเงินจริง */
  dryRun?: boolean;
  /** บังคับ settle ซ้ำ (ใช้เมื่อแก้ผลรางวัล) — ต้องระบุเหตุผล */
  force?: boolean;
  forceReason?: string;
  /** อัตราจ่ายจาก lotteryTypes ถ้าโพยไม่มี rate ติดมา */
  rates?: Record<string, number>;
}

/** ล็อกรอบก่อนเริ่ม — กันเรียกซ้ำ/พร้อมกัน */
async function acquireSettlementLock(db: any, roundId: string, force?: boolean) {
  const ref = doc(db, COL.LOTTERY_ROUNDS, roundId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const r: any = snap.data();
    if (r.settlementStatus === 'done' && !force) {
      throw new AppError(
        ERR.ALREADY_SETTLED,
        `รอบนี้ตัดสินรางวัลไปแล้วเมื่อ ${r.settledAt || 'ไม่ทราบเวลา'} — ใช้ force=true ถ้าต้องการตัดสินใหม่`,
        409,
        { settledAt: r.settledAt, summary: r.settlementSummary },
      );
    }
    if (r.settlementStatus === 'settling') {
      throw new AppError(ERR.CONFLICT, 'รอบนี้กำลังถูกตัดสินรางวัลอยู่ กรุณารอสักครู่', 409);
    }
  }

  await setDoc(ref, {
    settlementStatus: 'settling',
    settlementStartedAt: new Date().toISOString(),
  }, { merge: true });
}

/** คลายล็อก + บันทึกผลสรุป */
async function releaseSettlementLock(db: any, roundId: string, status: 'done' | 'failed', summary?: unknown) {
  await setDoc(doc(db, COL.LOTTERY_ROUNDS, roundId), {
    settlementStatus: status,
    settledAt: new Date().toISOString(),
    settlementSummary: summary || null,
  }, { merge: true });
}

/**
 * ★ ฟังก์ชันหลัก: ตัดสินรางวัลทั้งรอบ
 */
export async function settleRound(db: any, input: SettleInput) {
  const { lotterySlug, roundId, result, dryRun = false, force = false, rates = {} } = input;

  if (!lotterySlug) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ lotterySlug', 400);
  if (!roundId) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ roundId (ห้ามตัดสินรางวัลแบบไม่ระบุรอบ)', 400);
  if (!result || typeof result !== 'object') {
    throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ result', 400);
  }

  // ---- ชั้นที่ 1: ล็อกรอบ ----
  if (!dryRun) await acquireSettlementLock(db, roundId, force);

  try {
    // ---- ดึงโพยของรอบนี้เท่านั้น ----
    const snap = await getDocs(query(
      collection(db, COL.TICKETS),
      where('ticketType', '==', lotterySlug),
    ));
    const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    // กรองให้เหลือเฉพาะรอบนี้ + ยังไม่ถูกตัดสิน
    const targets = all.filter(t => {
      if (t.roundId && String(t.roundId) !== String(roundId)) return false;
      if (!force && (t.settledAt || t.status === TICKET_STATUS.SETTLED)) return false;  // ★ ชั้นที่ 3: กันซ้ำรายโพย
      return t.status === TICKET_STATUS.CONFIRMED || t.status === 'active';
    });

    const summary = {
      roundId,
      lotterySlug,
      considered: all.length,
      targets: targets.length,
      winCount: 0,
      loseCount: 0,
      totalBet: 0,
      totalPayout: 0,
      profit: 0,
      errors: [] as Array<{ ticketId: string; error: string }>,
      dryRun,
    };

    // ---- ตรวจ + จ่ายทีละโพย ----
    for (const t of targets) {
      const betTotal = Number(t.totalAmount) || 0;
      const { payout, details } = evaluateTicket((t.bets || []) as EvalBet[], result, rates);
      summary.totalBet += betTotal;

      if (dryRun) {
        if (payout > 0) summary.winCount++; else summary.loseCount++;
        summary.totalPayout += payout;
        continue;
      }

      try {
        if (payout > 0) {
          // จ่ายเงินรางวัล — atomic ผ่าน wallet
          await wallet.credit(db, t.userId, payout, {
            type: 'win',
            ref: t.id,
            note: `ถูกรางวัล ${lotterySlug} รอบ ${roundId}`,
            source: 'settlement',
            roundId,
          });
          summary.winCount++;
        } else {
          summary.loseCount++;
        }

        await updateDoc(doc(db, COL.TICKETS, t.id), {
          status: payout > 0 ? TICKET_STATUS.WIN : TICKET_STATUS.LOSE,
          payout,
          winDetails: details,
          settledAt: new Date().toISOString(),
          settledRoundId: roundId,
          updatedAt: serverTimestamp(),
        });

        summary.totalPayout += payout;
      } catch (err: any) {
        // โพยเดียวยังไม่สำเร็จ → ไม่ให้ทั้งรอบล้ม
        summary.errors.push({ ticketId: t.id, error: String(err?.message || err) });
        console.error(`[SETTLE] โพย ${t.id} ล้ม:`, err?.message);
      }
    }

    summary.profit = summary.totalBet - summary.totalPayout;

    // ---- บันทึกผลรางวัลลงประวัติ ----
    if (!dryRun) {
      await addDoc(collection(db, COL.LOTTERY_RESULTS), {
        lotterySlug,
        lotteryType: lotterySlug,
        roundId,
        ...result,
        settledAt: new Date().toISOString(),
        source: 'settlement',
        createdAt: new Date().toISOString(),
      });

      // ---- ชั้นที่ 2: คลายล็อก ----
      await releaseSettlementLock(db, roundId, 'done', summary);
    }

    return summary;
  } catch (e) {
    if (!dryRun) {
      await releaseSettlementLock(db, roundId, 'failed').catch(() => {});
    }
    throw e;
  }
}
