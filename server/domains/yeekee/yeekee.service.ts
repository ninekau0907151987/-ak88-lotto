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
  private static memoryRounds = new Map<string, YeekeeRound[]>();
  private static memoryShoots = new Map<string, YeekeeShoot[]>();
  private static memoryConfig: YeekeeConfig = { ...DEFAULT_YEEKEE_CONFIG };

  constructor(db: any) {
    this.db = db;
  }

  /** อ่านการตั้งค่าระบบยี่กี */
  async getConfig(): Promise<YeekeeConfig> {
    try {
      if (this.db) {
        const snap = await getDoc(doc(this.db, COL.YEEKEE_CONFIG, 'main'));
        if (snap.exists()) {
          YeekeeService.memoryConfig = { ...DEFAULT_YEEKEE_CONFIG, ...snap.data() };
          return YeekeeService.memoryConfig;
        }
      }
    } catch (e) {
      console.warn('[yeekee] read config fallback to memory:', (e as Error).message);
    }
    return YeekeeService.memoryConfig;
  }

  /** บันทึกการตั้งค่าระบบยี่กี */
  async updateConfig(patch: Partial<YeekeeConfig>): Promise<YeekeeConfig> {
    const cur = await this.getConfig();
    const updated = { ...cur, ...patch };
    YeekeeService.memoryConfig = updated;
    try {
      if (this.db) {
        await setDoc(doc(this.db, COL.YEEKEE_CONFIG, 'main'), updated, { merge: true });
      }
    } catch (e) {
      console.warn('[yeekee] updateConfig firestore write fallback:', (e as Error).message);
    }
    return updated;
  }

  /** ดึงรอบ 88 รอบของวันที่กำหนด (หากยังไม่มี ให้สร้างตั้งต้นอัตโนมัติ) */
  async getRounds(dateStr: string = new Date().toISOString().slice(0, 10)): Promise<YeekeeRound[]> {
    // 1. ตรวจสอบใน memory cache ก่อน
    if (!YeekeeService.memoryRounds.has(dateStr)) {
      YeekeeService.memoryRounds.set(dateStr, generateDailyRounds(dateStr));
    }

    try {
      if (this.db) {
        const qRounds = query(
          collection(this.db, COL.YEEKEE_ROUNDS),
          where('dateStr', '==', dateStr)
        );
        const snap = await getDocs(qRounds);

        if (snap.empty) {
          const rounds = YeekeeService.memoryRounds.get(dateStr)!;
          for (const r of rounds) {
            const docId = `${dateStr}_round_${r.id}`;
            await setDoc(doc(this.db, COL.YEEKEE_ROUNDS, docId), r).catch(() => {});
          }
          return rounds;
        }

        const list = snap.docs.map(d => d.data() as YeekeeRound);
        list.sort((a, b) => a.id - b.id);
        YeekeeService.memoryRounds.set(dateStr, list);
        return list;
      }
    } catch (e) {
      console.warn('[yeekee] getRounds firestore fallback to memory cache:', (e as Error).message);
    }

    return YeekeeService.memoryRounds.get(dateStr)!;
  }

  /** อ่านประวัติการยิงเลขของรอบนั้น */
  async getShoots(roundId: number, dateStr: string = new Date().toISOString().slice(0, 10)): Promise<YeekeeShoot[]> {
    const memKey = `${dateStr}_${roundId}`;
    if (!YeekeeService.memoryShoots.has(memKey)) {
      YeekeeService.memoryShoots.set(memKey, []);
    }

    try {
      if (this.db) {
        const qShoots = query(
          collection(this.db, COL.YEEKEE_SHOOTS),
          where('roundId', '==', roundId),
          where('dateStr', '==', dateStr)
        );
        const snap = await getDocs(qShoots);
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as YeekeeShoot));
          list.sort((a, b) => a.timestamp - b.timestamp);
          YeekeeService.memoryShoots.set(memKey, list);
          return list;
        }
      }
    } catch (e) {
      console.warn('[yeekee] getShoots firestore fallback to memory cache:', (e as Error).message);
    }

    return YeekeeService.memoryShoots.get(memKey)!;
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

    const shootId = `shoot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const shoot: YeekeeShoot & { dateStr: string } = {
      id: shootId,
      roundId,
      userId,
      username,
      number: cleanNum,
      timestamp: Date.now(),
      isBot: false,
      dateStr,
    };

    // อัปเดต Memory Store
    const memKey = `${dateStr}_${roundId}`;
    const list = YeekeeService.memoryShoots.get(memKey) || [];
    list.push(shoot);
    YeekeeService.memoryShoots.set(memKey, list);

    // อัปเดตรอบใน Memory Store
    const rounds = await this.getRounds(dateStr);
    const targetRound = rounds.find(r => r.id === roundId);
    if (targetRound) {
      const numVal = parseInt(cleanNum, 10) || 0;
      targetRound.totalShoots = (targetRound.totalShoots || 0) + 1;
      targetRound.sumShoots = (targetRound.sumShoots || 0) + numVal;
    }

    // เขียน Firestore แบบ non-blocking
    try {
      if (this.db) {
        await addDoc(collection(this.db, COL.YEEKEE_SHOOTS), shoot);
        const roundDocId = `${dateStr}_round_${roundId}`;
        await setDoc(doc(this.db, COL.YEEKEE_ROUNDS, roundDocId), {
          totalShoots: targetRound?.totalShoots || 1,
          sumShoots: targetRound?.sumShoots || 0,
        }, { merge: true });
      }
    } catch (e) {
      console.warn('[yeekee] shootNumber firestore write fallback:', (e as Error).message);
    }

    return shoot;
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
    const memKey = `${dateStr}_${roundId}`;
    const list = YeekeeService.memoryShoots.get(memKey) || [];

    for (let i = 0; i < botNumbers.length; i++) {
      const num = botNumbers[i];
      const botShoot: YeekeeShoot & { dateStr: string } = {
        id: `bot_${Date.now()}_${i}`,
        roundId,
        userId: 'system_bot',
        username: `บอทยี่กี_${list.length + 1}`,
        number: num,
        timestamp: Date.now() + i * 50,
        isBot: true,
        dateStr,
      };
      list.push(botShoot);

      try {
        if (this.db) {
          await addDoc(collection(this.db, COL.YEEKEE_SHOOTS), botShoot);
        }
      } catch (e) {
        // silent fallback to memory
      }
    }
    YeekeeService.memoryShoots.set(memKey, list);

    // อัปเดตยอดรวมในรอบ
    const all = list;
    const sum = all.reduce((acc, s) => acc + (parseInt(s.number, 10) || 0), 0);
    const rounds = await this.getRounds(dateStr);
    const targetRound = rounds.find(r => r.id === roundId);
    if (targetRound) {
      targetRound.totalShoots = all.length;
      targetRound.sumShoots = sum;
    }

    try {
      if (this.db) {
        const roundDocId = `${dateStr}_round_${roundId}`;
        await setDoc(doc(this.db, COL.YEEKEE_ROUNDS, roundDocId), {
          totalShoots: all.length,
          sumShoots: sum,
        }, { merge: true });
      }
    } catch (e) {
      console.warn('[yeekee] triggerBotShoots firestore write fallback:', (e as Error).message);
    }

    return botNumbers.length;
  }

  /** บังคับเปลี่ยนสถานะรอบ (เปิด / ปิด) */
  async setRoundStatus(
    roundId: number,
    status: 'open' | 'closed' | 'waiting',
    dateStr: string = new Date().toISOString().slice(0, 10)
  ): Promise<void> {
    const rounds = await this.getRounds(dateStr);
    const targetRound = rounds.find(r => r.id === roundId);
    if (targetRound) {
      targetRound.status = status;
    }

    try {
      if (this.db) {
        const roundDocId = `${dateStr}_round_${roundId}`;
        await setDoc(doc(this.db, COL.YEEKEE_ROUNDS, roundDocId), { status }, { merge: true });
      }
    } catch (e) {
      console.warn('[yeekee] setRoundStatus firestore write fallback:', (e as Error).message);
    }
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
    let totalBets = 0;
    let totalPayout = 0;

    try {
      if (this.db) {
        const qTickets = query(
          collection(this.db, COL.TICKETS),
          where('lotterySlug', '==', `yeekee-${roundId}`),
          where('status', 'in', ['pending', 'pending_cancellation', 'active'])
        );
        const ticketSnap = await getDocs(qTickets);

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
            }).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('[yeekee] tickets settlement firestore fallback:', (e as Error).message);
    }

    // ให้รางวัลพิเศษคนยิงลำดับที่ 1 และ 16
    const shooter1 = shoots[0];
    const shooter16 = shoots.length >= 16 ? shoots[shoots.length - 16] : undefined;

    if (shooter1 && !shooter1.isBot && config.rewardShooter1 > 0 && this.db) {
      await wallet.credit(this.db, shooter1.userId, config.rewardShooter1, {
        type: 'reward',
        ref: shooter1.id,
        note: `รางวัลยิงเลขยี่กี ลำดับที่ 1 รอบที่ ${roundId}`,
      }).catch(() => {});
    }

    if (shooter16 && !shooter16.isBot && config.rewardShooter16 > 0 && this.db) {
      await wallet.credit(this.db, shooter16.userId, config.rewardShooter16, {
        type: 'reward',
        ref: shooter16.id,
        note: `รางวัลยิงเลขยี่กี ลำดับที่ 16 รอบที่ ${roundId}`,
      }).catch(() => {});
    }

    // อัปเดตรอบใน Memory Store
    const rounds = await this.getRounds(dateStr);
    const targetRound = rounds.find(r => r.id === roundId);
    if (targetRound) {
      targetRound.status = 'settled';
      targetRound.sumShoots = res.sum;
      targetRound.subtractShoot = res.subtractShoot;
      targetRound.rawResult = res.rawResult;
      targetRound.result3Top = res.result3Top;
      targetRound.result2Top = res.result2Top;
      targetRound.result2Bottom = res.result2Bottom;
      targetRound.totalBets = totalBets;
      targetRound.totalPayout = totalPayout;
      targetRound.netProfit = totalBets - totalPayout;
      targetRound.settledAt = new Date().toISOString();
      targetRound.winnerShooter1 = shooter1 ? { userId: shooter1.userId, username: shooter1.username } : undefined;
      targetRound.winnerShooter16 = shooter16 ? { userId: shooter16.userId, username: shooter16.username } : undefined;
    }

    // บันทึกผลลัพธ์รอบใน Firestore
    try {
      if (this.db) {
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
      }
    } catch (e) {
      console.warn('[yeekee] roundDoc settlement firestore fallback:', (e as Error).message);
    }

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
