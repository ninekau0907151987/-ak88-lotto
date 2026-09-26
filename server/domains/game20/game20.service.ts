/**
 * server/domains/game20/game20.service.ts
 * ------------------------------------------------------------------
 * ★ เส้น API สำหรับ "หวย 20 ช่อง 6 หลัก" ★
 *
 * ผู้ใช้ขอ: "ช่วยผมทำระบบนี้ก็ยี่ ให้เสดด้วยครับ ถ้ามีเอพีไอด้วย ทำให้ด้วยครับ"
 *
 * เส้นที่ให้บริการ (prefix: /api/v1/game20):
 *   GET  /health              — สุขภาพโมดูล
 *   GET  /config              — อ่านค่าตั้งต้น (กติกา/อัตราจ่าย/บอท)
 *   PUT  /config              — แก้ค่าตั้งต้น (ต้องมี scope admin)
 *   POST /compute             — คำนวณผลจากเลข 20 ช่อง (ไม่ต้องล็อกอิน)
 *   POST /validate            — ตรวจเลข 20 ช่องว่าถูกกติกาไหม
 *   GET  /rates               — ตารางอัตราจ่าย
 *   PUT  /rates               — แก้ตารางอัตราจ่าย
 *   POST /evaluate            — ตรวจรางวัลของโพยกับผล
 *   POST /exposure            — วิเคราะห์ความเสี่ยงของรอบ
 *   POST /slots/random        — สุ่มเลข 20 ช่อง
 *   POST /slots/solve         — ★ วางเลขให้ได้ผลตามเป้า
 *   POST /bot/result          — ★ รันบอทออกผล
 *   POST /bot/number          — ★ รันบอทวางเลข
 *   GET  /bot/config          — อ่านค่าบอท (เปิด/ปิด/โหมด)
 *   PUT  /bot/config          — ★ เปิด/ปิดบอทจากหลังบ้าน
 *   GET  /rounds              — ประวัติรอบที่ออกผลแล้ว
 *   POST /rounds/close        — ★ ปิดรอบ: รันบอท → ออกผล → บันทึก
 *   GET  /stats               — สถิติภาพรวม
 *
 * กฎสถาปัตยกรรม (ตาม ARCHITECTURE.md):
 *   1. route ห้ามแตะ Firestore ตรง — ผ่าน service เท่านั้น
 *   2. ทุกการตอบกลับใช้ ok() / fail()
 *   3. ชื่อ collection อ่านจาก COL (SSoT)
 *   4. ตรรกะคำนวณอยู่ใน src/shared/lib/lottery20.ts (ใช้ร่วม frontend)
 * ==================================================================
 */
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, query, orderBy, limit,
  where, serverTimestamp,
} from 'firebase/firestore';
import { COL } from '../../config/collections';
import { AppError } from '../../lib/wallet';
import { ERR } from '../../lib/response';
import {
  SLOT_COUNT, RESULT_MODULO,
  validateSlots, computeResult, computeResultDetailed, evaluateBets20, analyzeRoundExposure,
  randomSlots, solveSlotsForResult, solveSlotsNatural, padNum,
  DEFAULT_PAYOUT_RATES, DEFAULT_HOUSE_MARGIN, calcHouseMargin, defaultRateMap,
  formatResult,
} from '../../../src/shared/lib/lottery20';
import {
  runResultBot, runNumberBot, buildBotReport, maxAvoidableCoverage,
  generatePlayerSlots, DEFAULT_RESULT_BOT, DEFAULT_NUMBER_BOT,
  type ResultBotConfig, type NumberBotConfig,
} from '../../../src/shared/lib/bots';

/** ★ collection ใหม่ — เพิ่มใน COL แล้วแต่เผื่อระบบเก่า */
const COL_GAME20_ROUNDS = 'game20Rounds';
const COL_GAME20_CONFIG = 'game20Config';
const COL_GAME20_BOTLOG = 'game20BotLogs';

/* ==================================================================
 * 1. ค่าตั้งต้นของโมดูล
 * ================================================================== */

export interface Game20Config {
  /** เปิด/ปิดรับแทงหวย 20 ช่อง */
  enabled: boolean;
  /** ชื่อที่แสดง */
  displayName: string;
  /** อัตราจ่าย */
  rates: { key: string; label: string; rate: number; desc?: string; odds?: number }[];
  /** ขีดจำกัดเงิน */
  minBetAmount: number;
  maxBetAmount: number;
  maxBetPerNumber: number;
  unitAmount: number;
  /** เพดานจ่ายต่อรอบ */
  maxPayoutPerRound: number;
  /** ★ กำไรเป้าหมาย % */
  targetMarginPercent: number;
  /** ★ ค่าบอทออกผล */
  resultBot: ResultBotConfig;
  /** ★ ค่าบอทวางเลข */
  numberBot: NumberBotConfig;
  /** อัปเดตล่าสุด */
  updatedAt?: string;
  updatedBy?: string;
}

function defaultConfig(): Game20Config {
  return {
    enabled: true,
    displayName: 'หวย 20 ช่อง 6 หลัก',
    rates: DEFAULT_PAYOUT_RATES.map(r => ({ key: r.key, label: r.label, rate: r.rate, desc: r.desc, odds: r.odds })),
    minBetAmount: DEFAULT_HOUSE_MARGIN.minBetAmount,
    maxBetAmount: DEFAULT_HOUSE_MARGIN.maxBetAmount,
    maxBetPerNumber: DEFAULT_HOUSE_MARGIN.maxBetPerNumber,
    unitAmount: DEFAULT_HOUSE_MARGIN.unitAmount,
    maxPayoutPerRound: DEFAULT_HOUSE_MARGIN.maxPayoutPerRound,
    targetMarginPercent: DEFAULT_HOUSE_MARGIN.targetMarginPercent,
    resultBot: { ...DEFAULT_RESULT_BOT },
    numberBot: { ...DEFAULT_NUMBER_BOT },
  };
}

/* ==================================================================
 * 2. Service — ทุกการอ่าน/เขียน DB อยู่ในนี้
 * ================================================================== */

export class Game20Service {
  constructor(private db: any) {}

  /** อ่านค่าตั้งต้น — ถ้าไม่มีให้ใช้ค่าเริ่มต้น (ไม่เขียน) */
  async getConfig(): Promise<Game20Config> {
    try {
      const snap = await getDoc(doc(this.db, COL_GAME20_CONFIG, 'main'));
      if (snap.exists()) {
        const d = snap.data() as Partial<Game20Config>;
        return { ...defaultConfig(), ...d };
      }
    } catch (e) {
      console.warn('[game20] getConfig failed, using defaults:', (e as Error).message);
    }
    return defaultConfig();
  }

  /** เขียนค่าตั้งต้น (merge) */
  async updateConfig(patch: Partial<Game20Config>, actor = 'system'): Promise<Game20Config> {
    const cur = await this.getConfig();
    const next: Game20Config = {
      ...cur,
      ...patch,
      // ★ ป้องกันการเขียนทับ sub-object ทั้งก้อนโดยไม่ตั้งใจ
      resultBot: patch.resultBot ? { ...cur.resultBot, ...patch.resultBot } : cur.resultBot,
      numberBot: patch.numberBot ? { ...cur.numberBot, ...patch.numberBot } : cur.numberBot,
      rates: patch.rates ?? cur.rates,
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
    };
    await setDoc(doc(this.db, COL_GAME20_CONFIG, 'main'), next as any, { merge: true });
    return next;
  }

  /** อัตราจ่ายเป็น map — พร้อมใช้คำนวณ */
  async getRateMap(): Promise<Record<string, number>> {
    const cfg = await this.getConfig();
    const m: Record<string, number> = {};
    cfg.rates.forEach(r => { m[r.key] = Number(r.rate) || 0; });
    return Object.keys(m).length ? m : defaultRateMap();
  }

  /* ---------------- รอบหวย ---------------- */

  /** ปิดรอบ: รันบอท → ออกผล → บันทึก */
  async closeRound(input: {
    roundId?: string;
    bets: any[];
    players?: Array<{ id: string; name?: string; slots: string[] }>;
    /** บังคับโหมด (ไม่ใส่ = ใช้จาก config) */
    mode?: string;
    forcedResult?: string;
    actor?: string;
  }) {
    const cfg = await this.getConfig();
    const rates = await this.getRateMap();

    // ---- 1) บอทวางเลข (ถ้าเปิด) ----
    let numberBotOut = null;
    let betsToUse = input.bets || [];

    if (cfg.numberBot?.enabled && input.players?.length) {
      numberBotOut = runNumberBot(input.players, cfg.numberBot);
      // ★ ใช้เลขที่สลับแล้วเป็นเลขของรอบนี้
      betsToUse = numberBotOut.assignments.flatMap(a =>
        (input.bets || []).filter(b => b.playerId === a.id)
          .map(b => ({ ...b, number: b.number }))
      );
    }

    // ---- 2) บอทออกผล ----
    // ★ สำคัญ: ถ้าผู้เรียกระบุ mode/forcedResult เอง (สั่งจากหลังบ้าน)
    //   ต้อง "override" ค่าที่บอทปิดอยู่ — ไม่ใช่ปล่อยให้ enabled:false ครอง
    //   ไม่งั้นสั่งตั้งผลเองแล้วระบบจะยังสุ่มบริสุทธิ์ (บั๊กที่เจอจริง)
    const callerOverride = !!(input.mode || input.forcedResult);
    const botCfg: Partial<ResultBotConfig> = {
      ...cfg.resultBot,
      ...(callerOverride ? { enabled: true } : {}),
      ...(input.mode ? { mode: input.mode as any } : {}),
      ...(input.forcedResult ? { mode: 'target' as any, forcedResult: input.forcedResult } : {}),
    };
    const outcome = await runResultBot(betsToUse as any, rates, botCfg);

    // ---- 3) ★ ตรวจสอบความถูกต้องก่อนบันทึก ----
    const recheck = computeResult(outcome.slots);
    if (recheck.result !== outcome.result) {
      throw new AppError(ERR.INTERNAL, 'เลขที่บอทวางไม่ตรงกับผลลัพธ์ — ยกเลิกการปิดรอบ', 500, {
        expected: outcome.result, got: recheck.result,
      });
    }

    // ---- 4) บันทึก ----
    const roundId = input.roundId || `g20_${Date.now()}`;
    const record = {
      roundId,
      slots: outcome.slots,
      result: outcome.result,
      resultFormatted: formatResult(outcome.result),
      prizes: recheck.prizes,
      mode: outcome.mode,
      reason: outcome.reason,
      seed: outcome.seed,
      verified: true,
      economics: {
        totalBet: outcome.totalBet,
        payout: outcome.payout,
        profit: outcome.profit,
        profitPercent: outcome.profitPercent,
        winCount: outcome.winCount,
        examined: outcome.examined,
      },
      bot: {
        resultBotEnabled: !!cfg.resultBot?.enabled,
        numberBotEnabled: !!cfg.numberBot?.enabled,
        numberBotNote: numberBotOut?.note || null,
        numberBotSwaps: numberBotOut?.swaps?.slice(0, 50) || [],
      },
      closedAt: new Date().toISOString(),
      closedBy: input.actor || 'system',
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(this.db, COL_GAME20_ROUNDS, roundId), record as any, { merge: true });
    } catch (e) {
      throw new AppError(ERR.INTERNAL, `บันทึกรอบไม่สำเร็จ: ${(e as Error).message}`, 500);
    }

    return {
      round: record,
      numberBotAssignments: numberBotOut?.assignments || null,
      report: buildBotReport(outcome, numberBotOut, cfg.resultBot, cfg.numberBot),
    };
  }

  /** ประวัติรอบ */
  async listRounds(limitCount = 50) {
    try {
      const snap = await getDocs(query(
        collection(this.db, COL_GAME20_ROUNDS),
        orderBy('closedAt', 'desc'),
        limit(limitCount),
      ));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      // ★ ถ้า collection ยังว่าง orderBy อาจล้มเหลว → คืนอาร์เรย์ว่างแทนการพัง
      console.warn('[game20] listRounds failed:', (e as Error).message);
      return [];
    }
  }

  /** สถิติภาพรวม */
  async stats(limitCount = 200) {
    const rounds = await this.listRounds(limitCount) as any[];
    const totalBet = rounds.reduce((s, r) => s + (r.economics?.totalBet || 0), 0);
    const totalPayout = rounds.reduce((s, r) => s + (r.economics?.payout || 0), 0);
    const withWinner = rounds.filter(r => (r.economics?.winCount || 0) > 0).length;
    return {
      rounds: rounds.length,
      totalBet,
      totalPayout,
      profit: totalBet - totalPayout,
      profitPercent: totalBet ? ((totalBet - totalPayout) / totalBet) * 100 : 0,
      roundsWithWinner: withWinner,
      noWinnerRate: rounds.length ? ((rounds.length - withWinner) / rounds.length) * 100 : 0,
      avgBetPerRound: rounds.length ? totalBet / rounds.length : 0,
    };
  }

  /** บันทึก log การใช้บอท */
  async logBot(action: string, payload: any, actor = 'system') {
    try {
      // ★ Firestore ปฏิเสธค่า undefined — ต้องลบก่อนเขียน
      //   (เจอจริง: payload.numberBot = undefined → addDoc ล้มเหลวทั้งก้อน)
      await addDoc(collection(this.db, COL_GAME20_BOTLOG), stripUndefined({
        action, payload: stripUndefined(payload), actor, at: new Date().toISOString(),
      }));
    } catch (e) {
      console.warn('[game20] logBot failed (ไม่กระทบการทำงาน):', (e as Error).message);
    }
  }
}

/**
 * ★ ลบ field ที่เป็น undefined ออกทั้งหมด (แบบลึก)
 * Firestore ไม่รับ undefined — ต่างจาก object ธรรมดา
 */
export function stripUndefined<T>(v: T): T {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) {
    return v.map(stripUndefined).filter(x => x !== undefined) as unknown as T;
  }
  if (typeof v === 'object') {
    // คง Date / Map / Set ไว้ตามเดิม
    if (v instanceof Date || v instanceof Map || v instanceof Set) return v;
    const out: any = {};
    for (const [k, val] of Object.entries(v as any)) {
      if (val === undefined) continue;          // ★ ข้าม undefined
      out[k] = stripUndefined(val);
    }
    return out;
  }
  if (typeof v === 'number' && !Number.isFinite(v)) return null as unknown as T;
  return v;
}

/* ==================================================================
 * 3. ฟังก์ชันบริสุทธิ์ที่ route เรียกได้ตรงๆ
 * ================================================================== */

export function healthPayload() {
  const margin = calcHouseMargin();
  return {
    module: 'game20',
    name: 'หวย 20 ช่อง 6 หลัก',
    version: '1.0.0',
    rules: {
      slots: SLOT_COUNT,
      digitsPerSlot: 6,
      formula: 'result = (Σ slots − slot17) mod 1,000,000',
      subtractSlot: 17,
      resultRange: `000000 – ${(RESULT_MODULO - 1).toString().padStart(6, '0')}`,
    },
    payouts: {
      types: DEFAULT_PAYOUT_RATES.length,
      marginPercent: Number(margin.marginPercent.toFixed(2)),
      worstPercent: Number(margin.worstPercent.toFixed(2)),
      verdict: margin.verdict,
    },
    bots: {
      resultBot: { modes: ['fair', 'profit', 'balance', 'avoid', 'target'] },
      numberBot: { plans: ['shuffle', 'rotate', 'mirror', 'chunk', 'cross', 'random'] },
    },
  };
}

export function computeFromSlots(slots: unknown[]) {
  const validation = validateSlots(slots);
  const detailed = computeResultDetailed(slots);
  return {
    validation,
    result: detailed.result,
    resultFormatted: formatResult(detailed.result),
    prizes: detailed.prizes,
    steps: detailed.steps,
    verify: detailed.verify,
    sum: detailed.sum,
    subtractSlot: detailed.subtractSlot,
    subtractValue: detailed.subtractValue,
    raw: detailed.raw,
  };
}

export { validateSlots, computeResultDetailed, evaluateBets20, analyzeRoundExposure,
         randomSlots, solveSlotsForResult, solveSlotsNatural, calcHouseMargin,
         runResultBot, runNumberBot, buildBotReport, maxAvoidableCoverage,
         generatePlayerSlots, padNum, defaultRateMap };
