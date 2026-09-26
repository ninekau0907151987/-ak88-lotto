/**
 * server/domains/yeekee/yeekee.service.ts
 * ==================================================================
 * Yeekee Domain Service — ควบคุมระบบหวยยี่กี 88 รอบ ครบวงจร
 * ==================================================================
 */

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, query, orderBy, limit,
  where, updateDoc,
} from 'firebase/firestore';
import { COL } from '../../config/collections';
import { AppError, wallet } from '../../lib/wallet';
import {
  YeekeeRound, YeekeeShoot, YeekeeConfig,
  DEFAULT_YEEKEE_CONFIG, DEFAULT_YEEKEE_RATES,
  generateDailyRounds, determineRoundStatus,
  computeYeekeeResult, evaluateYeekeeTicket, generateBotShoots,
} from '../../../src/shared/lib/yeekee';

export class YeekeeService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /** อ่านการตั้งค่าระบบยี่กี */
  async getConfig(): Promise<YeekeeConfig> {
    try {
      const snap = await getDoc(doc(this.db, COL.YEEKEE_CONFIG, 'main'));
      if (snap.exists()) {
        return { ...DEFAULT_YEEKEE_CONFIG, ...snap.data() };
      }
    } catch (e) {
      console.warn('[yeekee] read config fallback:', e);
    }
    return DEFAULT_YEEKEE_CONFIG;
  }

  /** บันทึกการตั้งค่าระบบยี่กี */
  async updateConfig(patch: Partial<YeekeeConfig>): Promise<YeekeeConfig> {
    const cur = await this.getConfig();
    const updated = { ...cur, ...patch };
    await setDoc(doc(this.db, COL.YEEKEE_CONFIG, 'main'), updated, { merge: true });
    return updated;
  }

  /** ดึงรอบ 88 รอบของวันที่กำหนด (หากยังไม่มี ให้สร้างตั้งต้นอัตโนมัติ) */
  async getRounds(dateStr: string = new Date().toISOString().slice(0, 10)): Promise<YeekeeRound[]> {
    const qRounds = query(
      collection(this.db, COL.YEEKEE_ROUNDS),
      where('dateStr', '==', dateStr)
    );
    const snap = await getDocs(qRounds);

    if (snap.empty) {
      // สร้าง 88 รอบใหม่สำหรับวันนี้
      const rounds = generateDailyRounds(dateStr);
      // บันทึกแบบ Batch
      for (const r of rounds) {
        const docId = `${dateStr}_round_${r.id}`;
        await setDoc(doc(this.db, COL.YEEKEE_ROUNDS, docId), r);
      }
      return rounds;
    }

    const list = snap.docs.map(d => d.data() as YeekeeRound);
    list.sort((a, b) => a.id - b.id);
    return list;
  }

  /** อ่านประวัติการยิงเลขของรอบนั้น */
  async getShoots(roundId: number, dateStr: string = new Date().toISOString().slice(0, 10)): Promise<YeekeeShoot[]> {
    const qShoots = query(
      collection(this.db, COL.YEEKEE_SHOOTS),
      where('roundId', '==', roundId),
      where('dateStr', '==', dateStr)
    );
    const snap = await getDocs(qShoots);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as YeekeeShoot));
    list.sort((a, b) => a.timestamp - b.timestamp);
    return list;
  }

  /** สมาชิกยิงเลข 5 หลักเข้ารอบ */
  async shootNumber(
    roundId: number,
    userId: string,
    username: string,
    numberStr: string,
    dateStr: string = new Date().toISOString().slice(0, 10)
  ): Promise<YeekeeShoot> {
    const cleanNum = String(numberStr).trim().replace(/\D/g, '').slice(0, 5).padStart(5, '0');
    if (cleanNum.length !== 5) {
      throw new AppError('INVALID_NUMBER', 'เลขยิงต้องเป็นตัวเลข 5 หลัก');
    }

    const shoot: Omit<YeekeeShoot, 'id'> & { dateStr: string } = {
      roundId,
      userId,
      username,
      number: cleanNum,
      timestamp: Date.now(),
      isBot: false,
      dateStr,
    };

    const docRef = await addDoc(collection(this.db, COL.YEEKEE_SHOOTS), shoot);

    // อัปเดตสถิติยอดรวมยิงในรอบ
    const roundDocId = `${dateStr}_round_${roundId}`;
    const rSnap = await getDoc(doc(this.db, COL.YEEKEE_ROUNDS, roundDocId));
    if (rSnap.exists()) {
      const cur = rSnap.data() as YeekeeRound;
      const numVal = parseInt(cleanNum, 10) || 0;
      await setDoc(doc(this.db, COL.YEEKEE_ROUNDS, roundDocId), {
        totalShoots: (cur.totalShoots || 0) + 1,
        sumShoots: (cur.sumShoots || 0) + numVal,
      }, { merge: true });
    }

    return { id: docRef.id, ...shoot };
  }

  /** บอทช่วยยิงเลขให้ครบ 16 ลำดับ */
  async triggerBotShoots(
    roundId: number,
    count: number = 16,
    dateStr: string = new Date().toISOString().slice(0, 10)
  ): Promise<number> {
    const existing = await this.getShoots(roundId, dateStr);
    const needed = Math.max(0, count - existing.length);
    if (needed === 0) return 0;

    const botNumbers = generateBotShoots(needed);
    let added = 0;

    for (let i = 0; i < botNumbers.length; i++) {
      const num = botNumbers[i];
      await addDoc(collection(this.db, COL.YEEKEE_SHOOTS), {
        roundId,
        userId: 'system_bot',
        username: `บอทยี่กี_${i + 1}`,
        number: num,
        timestamp: Date.now() + i * 50,
        isBot: true,
        dateStr,
      });
      added++;
    }

    // คำนวณยอดรวมใหม่
    const all = await this.getShoots(roundId, dateStr);
    const sum = all.reduce((acc, s) => acc + (parseInt(s.number, 10) || 0), 0);
    const roundDocId = `${dateStr}_round_${roundId}`;
    await setDoc(doc(this.db, COL.YEEKEE_ROUNDS, roundDocId), {
      totalShoots: all.length,
      sumShoots: sum,
    }, { merge: true });

    return added;
  }

  /** บังคับเปลี่ยนสถานะรอบ (เปิด / ปิด) */
  async setRoundStatus(
    roundId: number,
    status: 'open' | 'closed' | 'waiting',
    dateStr: string = new Date().toISOString().slice(0, 10)
  ): Promise<void> {
    const roundDocId = `${dateStr}_round_${roundId}`;
    await setDoc(doc(this.db, COL.YEEKEE_ROUNDS, roundDocId), { status }, { merge: true });
  }

  /** ปิดรอบ + คำนวณผล + ตรวจรางวัลและจ่ายเงินอัตโนมัติ */
  async settleRound(
    roundId: number,
    manualResult?: { result3Top?: string; result2Bottom?: string },
    dateStr: string = new Date().toISOString().slice(0, 10)
  ) {
    const roundDocId = `${dateStr}_round_${roundId}`;
    let shoots = await this.getShoots(roundId, dateStr);

    // หากคนยิงน้อยกว่า 16 ให้บอทยิงช่วยอัตโนมัติ
    if (shoots.length < 16) {
      await this.triggerBotShoots(roundId, 16, dateStr);
      shoots = await this.getShoots(roundId, dateStr);
    }

    const numbers = shoots.map(s => s.number);
    let res = computeYeekeeResult(numbers);

    // ถ้าระบุผลด้วยมือ
    if (manualResult?.result3Top) {
      res.result3Top = manualResult.result3Top;
      res.result2Top = manualResult.result3Top.slice(-2);
    }
    if (manualResult?.result2Bottom) {
      res.result2Bottom = manualResult.result2Bottom;
    }

    const config = await this.getConfig();

    // ค้นหาโพยยี่กีของรอบนี้
    const qTickets = query(
      collection(this.db, COL.TICKETS),
      where('lotterySlug', '==', `yeekee-${roundId}`),
      where('status', '==', 'pending')
    );
    const ticketSnap = await getDocs(qTickets);

    let totalBets = 0;
    let totalPayout = 0;

    for (const tDoc of ticketSnap.docs) {
      const ticket: any = tDoc.data();
      const betItems = ticket.bets || [];
      const evaluated = evaluateYeekeeTicket(betItems, res, config.payoutRates);

      totalBets += ticket.totalAmount || 0;
      totalPayout += evaluated.totalWin;

      // ปรับปรุงสถานะโพย
      await setDoc(doc(this.db, COL.TICKETS, tDoc.id), {
        status: evaluated.isWinner ? 'won' : 'lost',
        totalWin: evaluated.totalWin,
        bets: evaluated.bets,
        settledAt: new Date().toISOString(),
      }, { merge: true });

      // โอนเงินรางวัลให้ผู้ถูกรางวัล
      if (evaluated.isWinner && ticket.userId) {
        await wallet.credit(this.db, ticket.userId, evaluated.totalWin, {
          type: 'win',
          ref: tDoc.id,
          note: `ถูกรางวัลหวยยี่กี รอบที่ ${roundId} (${res.result3Top})`,
        });
      }
    }

    // ให้รางวัลพิเศษคนยิงลำดับที่ 1 และ 16
    const shooter1 = shoots[0];
    const shooter16 = shoots.length >= 16 ? shoots[shoots.length - 16] : undefined;

    if (shooter1 && !shooter1.isBot && config.rewardShooter1 > 0) {
      await wallet.credit(this.db, shooter1.userId, config.rewardShooter1, {
        type: 'reward',
        ref: shooter1.id,
        note: `รางวัลยิงเลขยี่กี ลำดับที่ 1 รอบที่ ${roundId}`,
      });
    }

    if (shooter16 && !shooter16.isBot && config.rewardShooter16 > 0) {
      await wallet.credit(this.db, shooter16.userId, config.rewardShooter16, {
        type: 'reward',
        ref: shooter16.id,
        note: `รางวัลยิงเลขยี่กี ลำดับที่ 16 รอบที่ ${roundId}`,
      });
    }

    // บันทึกผลลัพธ์รอบ
    const updateData: Partial<YeekeeRound> = {
      status: 'settled',
      sumShoots: res.sum,
      subtractShoot: res.subtractShoot,
      rawResult: res.rawResult,
      result3Top: res.result3Top,
      result2Top: res.result2Top,
      result2Bottom: res.result2Bottom,
      totalBets,
      totalPayout,
      netProfit: totalBets - totalPayout,
      settledAt: new Date().toISOString(),
      winnerShooter1: shooter1 ? { userId: shooter1.userId, username: shooter1.username } : undefined,
      winnerShooter16: shooter16 ? { userId: shooter16.userId, username: shooter16.username } : undefined,
    };

    await setDoc(doc(this.db, COL.YEEKEE_ROUNDS, roundDocId), updateData, { merge: true });

    return {
      roundId,
      result: res,
      totalBets,
      totalPayout,
      netProfit: totalBets - totalPayout,
      winnerShooter1: shooter1?.username,
      winnerShooter16: shooter16?.username,
    };
  }
}
