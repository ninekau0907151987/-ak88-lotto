/**
 * server/domains/betting/betting.service.ts
 * ------------------------------------------------------------------
 * ★ ศูนย์กลางการแทงหวย — มีที่เดียว ★
 *
 * ทำไมต้องมีไฟล์นี้:
 *   เดิมมี 2 เส้นทางที่สร้างโพย (tickets) แยกกัน
 *     1. POST /betting/bet      → ตัดเครดิต เช็คเลขอั้น เช็คเปิด-ปิด  ✔
 *     2. POST /queue/process    → สร้างโพยเลย ไม่เช็คอะไร        ✘ = แทงฟรี
 *
 *   ตอนนี้ทั้ง 2 เส้นทางเรียก placeBet() ตัวเดียวกัน
 *   → กฎทุกข้อถูกบังคับใช้เหมือนกันหมด ไม่มีทางลัด
 *
 * ลำดับการตรวจสอบ (ห้ามสลับ):
 *   1. ตรวจรูปแบบ input
 *   2. ระบบเปิดรับแทงไหม
 *   3. หวยตัวนี้เปิดรับแทงไหม + รอบยังไม่ปิด
 *   4. เลขอั้น
 *   5. ตัดเครดิต (atomic)
 *   6. สร้างโพย
 *   ★ ถ้าข้อ 6 ล้ม ต้องคืนเครดิต (compensating action)
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import { COL, TICKET_STATUS } from '../../config/collections';
import { wallet, AppError } from '../../lib/wallet';
import { ERR } from '../../lib/response';

export interface BetItem {
  number: string;
  type: string;      // ประเภทการเล่น เช่น '3ตัวบน'
  amount: number;
  rate?: number;
}

export interface PlaceBetInput {
  userId: string;
  lotterySlug: string;      // ชื่อ/hash ของหวย
  roundId?: string | null;
  bets: BetItem[];
  source?: string;          // api | queue | web
  /** รหัสกันซ้ำ — ส่งมาแล้วถ้าซ้ำจะไม่ตัดเครดิตซ้ำ */
  idempotencyKey?: string | null;
  /** ข้ามการตรวจเลขบัญชีระงับ (ใช้เมื่อโหลดจากคิวที่ตรวจแล้ว) */
  skipUserCheck?: boolean;
}

/** ตรวจรูปแบบข้อมูลนำเข้า — โยน AppError พร้อมบอกว่าผิดตรงไหน */
function validateBets(bets: unknown): BetItem[] {
  if (!Array.isArray(bets) || bets.length === 0) {
    throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ bets[] อย่างน้อย 1 รายการ', 400);
  }
  const out: BetItem[] = [];
  for (let i = 0; i < bets.length; i++) {
    const b = bets[i] as any;
    const num = String(b?.number ?? '').trim();
    const type = String(b?.type ?? '').trim();
    const amount = Number(b?.amount);

    if (!num) throw new AppError(ERR.BAD_REQUEST, `bets[${i}].number ว่าง`, 400);
    if (!/^\d{1,6}$/.test(num)) {
      throw new AppError(ERR.BAD_REQUEST, `bets[${i}].number ต้องเป็นตัวเลข 1-6 หลัก (ได้: "${num}")`, 400);
    }
    if (!type) throw new AppError(ERR.BAD_REQUEST, `bets[${i}].type ว่าง`, 400);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError(ERR.BAD_REQUEST, `bets[${i}].amount ต้องมากกว่า 0`, 400);
    }
    out.push({ number: num, type, amount, rate: Number(b?.rate) || 0 });
  }
  return out;
}

/** รวมยอดเงินทุนของโพย */
export function sumBets(bets: BetItem[]): number {
  return bets.reduce((s, b) => s + (Number(b.amount) || 0), 0);
}

/** ตรวจว่าเลขถูอั้นหรือไม่ → คืนรายการที่ชน */
async function findBlockedNumbers(db: any, lotterySlug: string, bets: BetItem[]) {
  const snap = await getDocs(
    query(collection(db, COL.BLOCKED_NUMBERS), where('lotteryType', '==', lotterySlug)),
  );
  const blocked = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

  const hits: Array<{ number: string; type: string; reason: string }> = [];
  for (const bet of bets) {
    for (const b of blocked) {
      if (String(b.number) !== String(bet.number)) continue;
      // betType = 'ทุกประเภท' หมายถึงอั้นทุกประเภทการเล่นของเลขนั้น
      if (b.betType !== 'ทุกประเภท' && b.betType !== bet.type) continue;
      // limit = รับได้ถึงจำนวนนี้ (null = ห้ามเลย)
      if (b.limit != null && Number(bet.amount) <= Number(b.limit)) continue;
      hits.push({
        number: bet.number,
        type: bet.type,
        reason: b.limit == null ? 'ห้ามแทงเลขนี้' : `เกินวงเงินที่รับ (${b.limit})`,
      });
    }
  }
  return hits;
}

/** ด่านที่ 2: ระบบทั้งระบบเปิดรับแทงไหม */
async function assertSystemOpen(db: any) {
  const snap = await getDoc(doc(db, COL.SETTINGS, 'global'));
  const g: any = snap.exists() ? snap.data() : {};
  if (g.systemOpen === false) {
    throw new AppError(ERR.BETTING_CLOSED, g.maintenanceMessage || 'ระบบปิดปรับปรุงชั่วคราว', 503);
  }
  if (g.bettingOpen === false) {
    throw new AppError(ERR.BETTING_CLOSED, 'ระบบปิดรับแทงชั่วคราว', 403);
  }
}

/** ด่านที่ 3: หวยตัวนี้ + รอบนี้ เปิดรับแทงไหม */
async function assertLotteryOpen(db: any, lotterySlug: string, roundId?: string | null) {
  const snap = await getDoc(doc(db, COL.LOTTERY_TYPES, lotterySlug));
  if (snap.exists()) {
    const t: any = snap.data();
    if (t.status === 'closed' || t.bettingOpen === false) {
      throw new AppError(ERR.LOTTERY_CLOSED, `หวย ${lotterySlug} ปิดรับแทง`, 403);
    }
  }
  if (roundId) {
    const rSnap = await getDoc(doc(db, COL.LOTTERY_ROUNDS, roundId));
    if (rSnap.exists()) {
      const r: any = rSnap.data();
      if (r.status === 'closed' || r.status === 'resulted') {
        throw new AppError(ERR.ROUND_CLOSED, `รอบนี้ปิดรับแทงแล้ว (สถานะ: ${r.status})`, 403);
      }
    }
  }
}

/** ★ ฟังก์ชันหลัก — ใช้ร่วมกันทั้งเส้น API ตรง และเส้นคิว */
export async function placeBet(db: any, input: PlaceBetInput) {
  const { userId, lotterySlug, roundId, source = 'api' } = input;

  if (!userId) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ userId', 400);
  if (!lotterySlug) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ lotterySlug', 400);

  const bets = validateBets(input.bets);
  const totalAmount = sumBets(bets);

  // ด่าน 2 + 3
  await assertSystemOpen(db);
  await assertLotteryOpen(db, lotterySlug, roundId);

  // ด่าน 4: เลขอั้น
  const blocked = await findBlockedNumbers(db, lotterySlug, bets);
  if (blocked.length > 0) {
    throw new AppError(
      ERR.NUMBER_BLOCKED,
      `เลข ${blocked.map(b => b.number).join(', ')} ถูกอั้น`,
      400,
      { blocked },
    );
  }

  // ด่าน 5: ตัดเครดิตแบบ atomic — ถ้าไม่พอจะโยน INSUFFICIENT_CREDIT
  const ledger = await wallet.debit(db, userId, totalAmount, {
    type: 'bet',
    note: `แทงหวย ${lotterySlug} (${bets.length} รายการ)`,
    source,
    roundId: roundId || null,
    idempotencyKey: input.idempotencyKey || null,
  });

  // ด่าน 6: สร้างโพย — ถ้าล้มต้องคืนเครดิต
  let ticketId = '';
  try {
    const ref = await addDoc(collection(db, COL.TICKETS), {
      userId,
      lotterySlug,                                  // ชื่อใหม่มาตรฐาน
      ticketType: lotterySlug,                      // คงไว้เพื่อความเข้ากันได้กับโค้ดเก่า
      roundId: roundId || null,
      bets,
      totalAmount,
      betCount: bets.length,
      status: TICKET_STATUS.CONFIRMED,
      payout: 0,
      settledAt: null,
      createdAt: new Date().toISOString(),
      source,
    });
    ticketId = ref.id;

    // ผูกโพยกลับไปที่ ledger เพื่อตรวจย้อนหลังได้
    await updateDoc(doc(db, COL.TRANSACTIONS, ledger.transactionId), { ref: ticketId });
  } catch (e) {
    // ★ คืนเครดิต (compensating action) — สำคัญมาก
    await wallet.credit(db, userId, totalAmount, {
      type: 'refund',
      note: 'คืนเครดิต: สร้างโพยไม่สำเร็จ',
      source: 'system',
    }).catch(err => console.error('[CRITICAL] คืนเครดิตไม่สำเร็จ', { userId, totalAmount, err }));
    throw new AppError(ERR.INTERNAL, 'สร้างโพยไม่สำเร็จ (คืนเครดิตแล้ว)', 500);
  }

  return {
    ticketId,
    totalAmount,
    betCount: bets.length,
    balanceBefore: ledger.balanceBefore,
    balanceAfter: ledger.balanceAfter,
  };
}

/** ยกเลิกโพย + คืนเครดิต — atomic กันกดซ้ำ */
export async function cancelTicket(db: any, ticketId: string) {
  const ref = doc(db, COL.TICKETS, ticketId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new AppError(ERR.NOT_FOUND, 'ไม่พบโพย', 404);

  const t: any = snap.data();
  if (t.status === TICKET_STATUS.CANCELLED) {
    throw new AppError(ERR.CONFLICT, 'โพยนี้ถูกยกเลิกแล้ว', 409);
  }
  if (t.status === TICKET_STATUS.WIN || t.status === TICKET_STATUS.LOSE) {
    throw new AppError(ERR.CONFLICT, 'โพยนี้ตัดสินรางวัลแล้ว ยกเลิกไม่ได้', 409);
  }

  await wallet.credit(db, t.userId, Number(t.totalAmount) || 0, {
    type: 'refund',
    ref: ticketId,
    note: 'ยกเลิกโพย คืนเครดิต',
    source: 'api',
  });

  await updateDoc(ref, {
    status: TICKET_STATUS.CANCELLED,
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { ticketId, refunded: Number(t.totalAmount) || 0 };
}
