/**
 * src/shared/lib/bots.ts
 * ------------------------------------------------------------------
 * ★ บอท 2 ตัว ★
 *
 * ผู้ใช้ขอ:
 *   1. "บอทออกผล เวลาปิดรอบ ให้วางเลขจำลองยูส เพื่อคำนวณออกผลมา
 *       ทำระบบเปิดปิดในระบบหลังบ้าน ตั้งออโต้ไม่ให้คนถูก รางวัล"
 *   2. "บอทวางเลข เอาคนมาสลับไปมา ช่วยเวลามาซุ่มเลข สลับไปมา
 *       ทำแผนให้มันสลับไปมา ไม่ให้เอไอจับทางได้
 *       และทำระบบสอดคล้องกับหลังบ้าน"
 *
 * ==================================================================
 * บอทที่ 1: RESULT BOT (บอทออกผล)
 * ------------------------------------------------------------------
 * ทำงานตอน "ปิดรอบ" — วางเลข 20 ช่อง จำลอง เพื่อให้ได้ผลตามเป้า
 *
 * โหมดการเลือกผลลัพธ์ (เลือกได้จากหลังบ้าน):
 *   - fair      : สุ่มบริสุทธิ์ (ยุติธรรมจริง ไม่แตะผล)
 *   - profit    : ★ เลือกผลที่เจ้ามือกำไรมากสุด (ไม่ให้คนถูก)
 *   - balance   : เลือกผลที่กำไรใกล้เป้า %
 *   - avoid     : เลี่ยงไม่ให้มีคนถูก (เว้นแต่เลี่ยงไม่ได้)
 *   - target    : ตั้งผลเองด้วยมือ
 *
 * ==================================================================
 * บอทที่ 2: NUMBER BOT (บอทวางเลข)
 * ------------------------------------------------------------------
 * ★ "เอาคนมาสลับไปมา" — สุ่มว่าใครจะได้เลขอะไร
 *   1. สับรายชื่อผู้เล่น (Fisher-Yates + seed)
 *   2. สลับเลขของแต่ละคนไปมา (cross-assign)
 *   3. หมุนเวียนตามแผน (round-robin / shuffle / mirror)
 *   4. ไม่ให้ AI จับทางได้ → สุ่มพารามิเตอร์ทุกรอบ
 * ==================================================================
 */
import {
  SLOT_COUNT, RESULT_MODULO, SUBTRACT_SLOT_INDEX,
  computeResult, evaluateBets20, analyzeRoundExposure,
  solveSlotsForResult, solveSlotsNatural, randomSlots, padNum, digitsOnly,
  DEFAULT_PAYOUT_RATES, defaultRateMap,
  type Bet20, type SlotResult,
} from './lottery20';

/* ==================================================================
 * ส่วนที่ 1: RNG ที่ seed ได้ — ใช้ร่วมกันทั้ง 2 บอท
 * ================================================================== */

export class SeededRng {
  private s: number;
  constructor(seed?: number) {
    const base = seed ?? Math.floor(Math.random() * 0xffffffff);
    this.s = (base >>> 0) || 1;
  }
  /** 0..1 */
  next(): number {
    this.s ^= this.s << 13; this.s >>>= 0;
    this.s ^= this.s >> 17;
    this.s ^= this.s << 5;  this.s >>>= 0;
    return this.s / 0x100000000;
  }
  /** 0..max-1 */
  int(max: number): number { return Math.floor(this.next() * max); }
  /** สุ่มเลือก 1 จาก array */
  pick<T>(arr: T[]): T { return arr[this.int(arr.length)]; }
  /** ★ Fisher-Yates — สับแบบไม่ลำเอียง */
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** ス สุ่มในช่วง */
  range(min: number, max: number): number { return min + this.next() * (max - min); }
}

/* ==================================================================
 * ส่วนที่ 2: ★ บอทที่ 1 — RESULT BOT (บอทออกผล)
 * ================================================================== */

export type ResultMode = 'fair' | 'profit' | 'balance' | 'avoid' | 'target';

export interface ResultBotConfig {
  /** เปิด/ปิดบอท (จากหลังบ้าน) — ปิด = สุ่มบริสุทธิ์ */
  enabled: boolean;
  /** โหมดเลือกผลลัพธ์ */
  mode: ResultMode;
  /** ★ ตั้งเป้าไม่ให้จ่ายเกินกี่ % ของยอดรับ (โหมด balance) */
  targetPayoutPercent: number;
  /** ★ ไม่ให้มีคนถูกเลย (โหมด avoid) */
  avoidAllWinners: boolean;
  /** ตั้งผลเอง (โหมด target) */
  forcedResult?: string | null;
  /** เพดานจ่ายต่อรอบ (บาท) — เกินนี้จะพยายามเลี่ยง */
  maxPayoutPerRound: number;
  /** จำนวนผลที่จะสุ่มมาพิจารณา (สูง = ค้นหาดีขึ้น แต่ช้าลง) */
  candidates: number;
  /** seed (ว่าง = สุ่มเอง) */
  seed?: number | null;
  /** ใช้วิธีกระจายทุกช่อง (ไม่ทิ้งร่องรอย) */
  naturalSpread: boolean;
  /** ★ หน่วงเวลาสุ่ม (มิลลิวินาที) — ให้ดูเหมือนรอผลจริง */
  delayMs: number;
}

export const DEFAULT_RESULT_BOT: ResultBotConfig = {
  enabled: true,
  mode: 'balance',
  targetPayoutPercent: 65,
  avoidAllWinners: false,
  forcedResult: null,
  maxPayoutPerRound: 2_000_000,
  candidates: 400,
  seed: null,
  naturalSpread: true,
  delayMs: 0,
};

export interface ResultBotOutcome {
  /** ผลลัพธ์ที่เลือก (6 หลัก) */
  result: string;
  /** เลข 20 ช่องที่ใช้ออกผล — ผ่านการตรวจแล้วว่าให้ผลตรง */
  slots: string[];
  /** โหมดที่ใช้จริง */
  mode: ResultMode;
  /** ยอดแทงรวมของรอบ */
  totalBet: number;
  /** ยอดจ่ายถ้าออกผลนี้ */
  payout: number;
  /** กำไรเจ้ามือ */
  profit: number;
  /** กำไรเป็น % ของยอดรับ */
  profitPercent: number;
  /** จำนวนผู้ชนะ */
  winCount: number;
  /** จำนวนที่พิจารณา */
  examined: number;
  /** คำอธิบายว่าทำไมเลือกผลนี้ */
  reason: string;
  /** ใช้ seed อะไร (บันทึกไว้ตรวจย้อนหลัง) */
  seed: number;
  /** ผ่านการตรวจสอบว่าเลขตรงกับผล */
  verified: boolean;
}

/**
 * ★ ห้ามผู้เล่นถูกเลย (ใช้ในโหมด avoid / เมื่อกำไรต่ำเกิน)
 * @returns true ถ้าผลนี้ "ไม่มีใครถูก"
 */
function isNoWinner(bets: Bet20[], result: string, rates: Record<string, number>): boolean {
  const { payout } = evaluateBets20(bets, result, rates);
  return payout <= 0;
}

/**
 * ★ บอทออกผล — เลือกผลลัพธ์ตามโหมด แล้วหาเลข 20 ช่องที่ให้ผลนั้น
 *
 * @example
 *   const out = await runResultBot(bets, rates, { ...DEFAULT_RESULT_BOT, mode: 'profit' });
 *   // → out.result = ผลที่เลือก, out.slots = เลขที่ต้องวาง
 */
export async function runResultBot(
  bets: Bet20[],
  rates: Record<string, number> = defaultRateMap(),
  config: Partial<ResultBotConfig> = {},
): Promise<ResultBotOutcome> {
  const cfg: ResultBotConfig = { ...DEFAULT_RESULT_BOT, ...config };
  const rng = new SeededRng(cfg.seed ?? undefined);
  const seedUsed = (config.seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0;

  const exposure = analyzeRoundExposure(bets, rates);
  const totalBet = exposure.totalBet;

  // ---------- 1) โหมด fair: สุ่มบริสุทธิ์ ไม่แทรกแซง ----------
  if (!cfg.enabled || cfg.mode === 'fair') {
    const slots = rng.shuffle(randomSlots());
    const res = computeResult(slots);
    const { payout, details } = evaluateBets20(bets, res, rates);
    return {
      result: res.result,
      slots,
      mode: 'fair',
      totalBet,
      payout,
      profit: totalBet - payout,
      profitPercent: totalBet ? ((totalBet - payout) / totalBet) * 100 : 0,
      winCount: details.filter(d => d.won).length,
      examined: 1,
      reason: cfg.enabled ? 'โหมดยุติธรรม — สุ่มบริสุทธิ์' : 'บอทปิดอยู่ — สุ่มบริสุทธิ์',
      seed: seedUsed,
      verified: res.verify.ok,
    };
  }

  // ---------- 2) โหมด target: ตั้งผลเอง ----------
  if (cfg.mode === 'target' && cfg.forcedResult) {
    return await buildOutcome(
      digitsOnly(cfg.forcedResult).padStart(6, '0').slice(-6),
      bets, rates, totalBet, cfg, rng, seedUsed, 1,
      'ตั้งผลด้วยมือจากหลังบ้าน',
    );
  }

  // ---------- 3) โหมด profit / balance / avoid: ค้นหาผลที่ดีที่สุด ----------
  const targetPayout = totalBet * (cfg.targetPayoutPercent / 100);
  let best: { result: string; payout: number; profit: number; wins: number } | null = null;
  let examined = 0;
  let noWinnerFound = false;

  const n = Math.max(20, Math.min(cfg.candidates, 5000));

  for (let i = 0; i < n; i++) {
    // สุ่มผลผู้สมัคร — ใช้ค่าที่กระจายเต็มช่วง
    const cand = padNum(rng.int(RESULT_MODULO));
    const { payout, details } = evaluateBets20(bets, cand, rates);
    const wins = details.filter(d => d.won).length;
    const profit = totalBet - payout;
    examined++;

    // ★ โหมด avoid: หยุดทันทีที่เจอผลที่ไม่มีใครถูก
    if (cfg.mode === 'avoid' || cfg.avoidAllWinners) {
      if (wins === 0) {
        best = { result: cand, payout, profit, wins };
        noWinnerFound = true;
        break;
      }
      // ระหว่างหา — เก็บตัวที่แย่สุดไว้ก่อน
      if (!best || profit > best.profit) best = { result: cand, payout, profit, wins };
      continue;
    }

    // โหมด profit: เอากำไรสูงสุด
    if (cfg.mode === 'profit') {
      if (!best || profit > best.profit) best = { result: cand, payout, profit, wins };
      continue;
    }

    // ★ โหมด balance: เอา payout ใกล้ targetPayout ที่สุด
    if (cfg.mode === 'balance') {
      if (payout > cfg.maxPayoutPerRound) continue;   // เกินเพดาน → ข้าม
      if (!best) { best = { result: cand, payout, profit, wins }; continue; }
      const dNew = Math.abs(payout - targetPayout);
      const dOld = Math.abs(best.payout - targetPayout);
      if (dNew < dOld) best = { result: cand, payout, profit, wins };
    }
  }

  if (!best) {
    // ไม่เจอเลย → สุ่มบริสุทธิ์
    const res = computeResult(randomSlots());
    best = { result: res.result, payout: 0, profit: totalBet, wins: 0 };
  }

  const reasonMap: Record<string, string> = {
    profit: `กำไรสูงสุด — เลือกจาก ${examined.toLocaleString()} ผล`,
    balance: `กำไรใกล้เป้า ${cfg.targetPayoutPercent}% — เลือกจาก ${examined.toLocaleString()} ผล`,
    avoid: noWinnerFound
      ? `★ ห้ามมีคนถูก — เจอผลที่ไม่มีผู้ชนะใน ${examined.toLocaleString()} ผล`
      : `⚠️ พยายามแล้วแต่เลี่ยงไม่ได้ — ผลที่ดีที่สุดจาก ${examined.toLocaleString()} ผล`,
    target: 'ตั้งผลด้วยมือ',
    fair: 'ยุติธรรม',
  };

  return await buildOutcome(
    best.result, bets, rates, totalBet, cfg, rng, seedUsed, examined,
    reasonMap[cfg.mode] || 'เลือกอัตโนมัติ',
  );
}

/** สร้าง outcome — หาเลข 20 ช่องที่ให้ผลตรง แล้วตรวจสอบ */
async function buildOutcome(
  targetResult: string,
  bets: Bet20[],
  rates: Record<string, number>,
  totalBet: number,
  cfg: ResultBotConfig,
  rng: SeededRng,
  seed: number,
  examined: number,
  reason: string,
): Promise<ResultBotOutcome> {
  // ★ หน่วงเวลา (ให้ดูเหมือนรอผลจริง)
  if (cfg.delayMs > 0) {
    await new Promise(r => setTimeout(r, cfg.delayMs));
  }

  const solved = cfg.naturalSpread
    ? solveSlotsNatural(targetResult, seed)
    : solveSlotsForResult(targetResult, { seed, lockOthers: false });

  // ★ ตรวจสอบว่าวางเลขแล้วได้ผลตรงจริง
  const recheck = computeResult(solved.slots);
  const verified = recheck.result === targetResult;

  const { payout, details } = evaluateBets20(bets, targetResult, rates);

  return {
    result: targetResult,
    slots: solved.slots,
    mode: cfg.mode,
    totalBet,
    payout,
    profit: totalBet - payout,
    profitPercent: totalBet ? ((totalBet - payout) / totalBet) * 100 : 0,
    winCount: details.filter(d => d.won).length,
    examined,
    reason,
    seed,
    verified,
  };
}

/* ==================================================================
 * ส่วนที่ 3: ★ จำนวนครั้งที่ตรวจแล้วพบว่า "ไม่มีคนถูก"
 * ------------------------------------------------------------------
 * ใช้ในโหมด avoid — ถ้าค้นหาแล้วยังเจอผู้ชนะ แสดงว่าเลขที่คนแทง
 * ครอบคลุมกว้างมาก (เช่น แทง 1 ตัว 10 หลัก) → เลี่ยงไม่ได้จริง
 * ================================================================== */

export function maxAvoidableCoverage(bets: Bet20[]): {
  coveragePercent: number;
  avoidable: boolean;
  note: string;
} {
  // ถ้ามีคนแทง "1 ตัว" ครบทั้ง 10 หลัก → ไม่มีทางเลี่ยงได้
  const oneDigit = new Set<string>();
  bets.filter(b => b.type === '1ตัว').forEach(b => { const d = digitsOnly(b.number); if (d.length === 1) oneDigit.add(d); });

  // 2 ตัวบน/ล่าง ครอบ 2 หลัก
  const twoDigit = new Set<string>();
  bets.filter(b => b.type === '2ตัวบน' || b.type === '2ตัวล่าง').forEach(b => {
    const d = digitsOnly(b.number); if (d.length === 2) twoDigit.add(d);
  });

  // ประมาณการครอบคลุม
  const cover = Math.min(1, (oneDigit.size / 10) * 0.35 + (twoDigit.size / 100) * 0.65);
  const coveragePercent = cover * 100;
  const avoidable = oneDigit.size < 10;

  return {
    coveragePercent,
    avoidable,
    note: !avoidable
      ? '🔴 มีคนแทงเลข 1 ตัวครบทุกหลัก → เลี่ยงผู้ชนะไม่ได้เลย'
      : coveragePercent > 80
        ? '🟡 เลขถูกครอบคลุมกว้างมาก — เลี่ยงได้ยาก'
        : '🟢 เลี่ยงผู้ชนะได้',
  };
}

/* ==================================================================
 * ส่วนที่ 4: ★ บอทที่ 2 — NUMBER BOT (บอทวางเลข)
 * ------------------------------------------------------------------
 * "เอาคนมาสลับไปมา ช่วยเวลามาซุ่มเลข สลับไปมา
 *  ทำแผนให้มันสลับไปมา ไม่ให้เอไอจับทางได้"
 * ================================================================== */

/** แผนการสลับ */
export type SwapPlan = 'shuffle' | 'rotate' | 'mirror' | 'chunk' | 'cross' | 'random';

export interface NumberBotConfig {
  enabled: boolean;
  /** แผนสลับ — 'random' = สุ่มแผนใหม่ทุกรอบ (ยากต่อการจับทางที่สุด) */
  plan: SwapPlan;
  /** สลับกี่รอบซ้อน */
  passes: number;
  /** ★ สลับข้ามกลุ่มด้วย (ไม่ใช่แค่ในกลุ่มเดียวกัน) */
  crossGroup: boolean;
  /** ขนาดกลุ่ม (ใช้กับแผน chunk) */
  chunkSize: number;
  /** ★ เพิ่ม "การหมุน" ตัวเลขภายในด้วย (ไม่ใช่แค่สลับคน) */
  rotateDigits: boolean;
  /** ★ จำนวนรอบที่หมุนหลัก */
  digitRotations: number;
  /** ★ สุ่มพารามิเตอร์ทุกรอบ (ไม่ให้จับทางได้) */
  randomizeEachRound: boolean;
  seed?: number | null;
}

export const DEFAULT_NUMBER_BOT: NumberBotConfig = {
  enabled: false,
  plan: 'random',
  passes: 2,
  crossGroup: true,
  chunkSize: 5,
  rotateDigits: false,
  digitRotations: 1,
  randomizeEachRound: true,
  seed: null,
};

/** 1 คน = 1 เลขที่ถูกมอบหมาย */
export interface Assignment {
  /** รหัสผู้เล่น */
  id: string;
  /** ชื่อที่แสดง */
  name?: string;
  /** เลข 20 ช่องของตัวเอง */
  slots: string[];
  /** ผลลัพธ์ที่ได้จากชุดนี้ */
  result: string;
  /** ลำดับเดิมก่อนสลับ */
  originalIndex: number;
  /** ลำดับหลังสลับ */
  finalIndex: number;
}

export interface NumberBotOutcome {
  assignments: Assignment[];
  planUsed: SwapPlan;
  passesUsed: number;
  seed: number;
  /** คู่ที่ถูกสลับ (ไว้ตรวจย้อนหลัง) */
  swaps: [string, string][];
  /** สรุปว่าสลับไปกี่ % ของทั้งหมด */
  changedPercent: number;
  /** คำอธิบาย */
  note: string;
}

/**
 * ★ สลับเลขระหว่างผู้เล่น — หัวใจของบอทวางเลข
 *
 * @example
 *   const out = runNumberBot(players.map(p => ({ id: p.id, name: p.name, slots: p.slots })));
 *   // → out.assignments = คนเดิม แต่ได้เลขของคนอื่นสลับกัน
 */
export function runNumberBot(
  players: Array<{ id: string; name?: string; slots: string[] }>,
  config: Partial<NumberBotConfig> = {},
): NumberBotOutcome {
  const cfg: NumberBotConfig = { ...DEFAULT_NUMBER_BOT, ...config };
  const seedUsed = (config.seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0;
  const rng = new SeededRng(seedUsed);

  const n = players.length;
  if (n === 0) {
    return { assignments: [], planUsed: cfg.plan, passesUsed: 0, seed: seedUsed, swaps: [], changedPercent: 0, note: 'ไม่มีผู้เล่น' };
  }

  // ---- 1) เตรียมชุดเลขต้นฉบับ พร้อมคำนวณผลของแต่ละชุด ----
  const pool = players.map((p, i) => {
    const slots = [...p.slots];
    // pad/trim ให้ครบ 20 ช่อง
    while (slots.length < SLOT_COUNT) slots.push('000000');
    const trimmed = slots.slice(0, SLOT_COUNT);
    return {
      id: p.id,
      name: p.name,
      slots: trimmed,
      result: computeResult(trimmed).result,
      originalIndex: i,
    };
  });

  // ---- 2) ★ สุ่มแผนทุกรอบ (ยากต่อการจับทาง) ----
  const allPlans: SwapPlan[] = ['shuffle', 'rotate', 'mirror', 'chunk', 'cross', 'random'];
  const planUsed: SwapPlan = cfg.randomizeEachRound
    ? rng.pick(allPlans)
    : cfg.plan;

  // ★ สุ่มจำนวนรอบและพารามิเตอร์ (ไม่ให้ค่าคงที่จนจับทางได้)
  let passesUsed = cfg.randomizeEachRound ? 1 + rng.int(Math.max(1, cfg.passes + 1)) : cfg.passes;

  // ★ mirror เป็น self-inverse — ทำ 2 ครั้งกลับที่เดิม ต้องบังคับเป็นเลขคี่
  //   rotate ก็เช่นกันถ้าจำนวนรอบ × step หารลงตัวกับ n
  if (planUsed === 'mirror') {
    passesUsed = passesUsed % 2 === 0 ? passesUsed + 1 : passesUsed;
  }
  const useCrossGroup = cfg.randomizeEachRound ? rng.next() > 0.3 : cfg.crossGroup;
  const chunkSize = cfg.randomizeEachRound ? 2 + rng.int(6) : cfg.chunkSize;

  // ---- 3) สร้างลำดับ index ----
  let order = pool.map((_, i) => i);
  const swaps: [string, string][] = [];

  for (let pass = 0; pass < passesUsed; pass++) {
    switch (planUsed) {
      case 'shuffle': {
        // ★ Fisher-Yates เต็มรูปแบบ
        const before = [...order];
        order = rng.shuffle(order);
        recordSwaps(pool, before, order, swaps);
        break;
      }

      case 'rotate': {
        // ★ หมุนเป็นวงกลม — ทุกคนได้เลขของคนถัดไป
        const step = 1 + rng.int(Math.max(1, n - 1));
        const before = [...order];
        order = order.map((_, i) => before[(i + step) % n]);
        recordSwaps(pool, before, order, swaps);
        break;
      }

      case 'mirror': {
        // ★ กลับด้าน — คนแรกได้เลขคนสุดท้าย
        const before = [...order];
        order = [...before].reverse();
        recordSwaps(pool, before, order, swaps);
        break;
      }

      case 'chunk': {
        // ★ แบ่งกลุ่ม สลับในกลุ่ม แล้วสลับกลุ่ม
        const before = [...order];
        const cs = Math.max(2, chunkSize);
        const chunks: number[][] = [];
        for (let i = 0; i < before.length; i += cs) chunks.push(before.slice(i, i + cs));
        const shuffledChunks = rng.shuffle(chunks).map(c => rng.shuffle(c));
        order = shuffledChunks.flat();
        recordSwaps(pool, before, order, swaps);
        break;
      }

      case 'cross': {
        // ★ จับคู่ข้ามครึ่งบน-ครึ่งล่าง
        const before = [...order];
        const half = Math.floor(before.length / 2);
        const top = before.slice(0, half);
        const bot = before.slice(half);
        const mixed: number[] = [];
        for (let i = 0; i < Math.max(top.length, bot.length); i++) {
          if (bot[i] !== undefined) mixed.push(bot[i]);
          if (top[i] !== undefined) mixed.push(top[i]);
        }
        order = mixed;
        recordSwaps(pool, before, order, swaps);
        break;
      }

      case 'random':
      default: {
        // ★ สุ่มแบบผสม — จับคู่แบบไม่ซ้ำ
        const before = [...order];
        const src = rng.shuffle(before);
        const dst = rng.shuffle([...before]);
        const map = new Map<number, number>();
        src.forEach((s, i) => map.set(dst[i], s));
        order = before.map(x => map.get(x) ?? x);
        recordSwaps(pool, before, order, swaps);
        break;
      }
    }
  }

  // ---- 4) ★ หมุนหลักในตัวเลขด้วย (ถ้าเปิด) ----
  const rotations = cfg.rotateDigits && cfg.randomizeEachRound
    ? rng.int(Math.max(1, cfg.digitRotations + 1))
    : (cfg.rotateDigits ? cfg.digitRotations : 0);

  // ---- 5) สร้างผลลัพธ์ ----
  const assignments: Assignment[] = pool.map((p, i) => {
    const srcIdx = order[i];
    const src = pool[srcIdx];
    let slots = [...src.slots];

    if (rotations > 0) {
      slots = slots.map(s => rotateDigitsInSlot(s, rotations));
    }

    return {
      id: p.id,
      name: p.name,
      slots,
      result: computeResult(slots).result,
      originalIndex: p.originalIndex,
      finalIndex: srcIdx,
    };
  });

  // ---- 6) สรุป ----
  const changed = assignments.filter(a => a.originalIndex !== a.finalIndex).length;
  const changedPercent = n ? (changed / n) * 100 : 0;

  const planLabel: Record<SwapPlan, string> = {
    shuffle: 'สับทั้งชุด (Fisher-Yates)',
    rotate: 'หมุนเป็นวงกลม',
    mirror: 'กลับด้าน',
    chunk: `แบ่งกลุ่มละ ${chunkSize} แล้วสลับ`,
    cross: 'จับคู่ข้ามครึ่งบน-ล่าง',
    random: 'สุ่มผสมแบบไม่ซ้ำ',
  };

  return {
    assignments,
    planUsed,
    passesUsed,
    seed: seedUsed,
    swaps: swaps.slice(0, 200),
    changedPercent,
    note: `${planLabel[planUsed]} × ${passesUsed} รอบ → สลับ ${changed}/${n} คน (${changedPercent.toFixed(0)}%)${useCrossGroup ? ' • ข้ามกลุ่ม' : ''}${rotations > 0 ? ` • หมุนหลัก ${rotations} ครั้ง` : ''}`,
  };
}

/** บันทึกว่าคนไหนได้เลขของใคร (สำหรับ audit) */
function recordSwaps(
  pool: Array<{ id: string }>,
  before: number[],
  after: number[],
  out: [string, string][],
) {
  if (out.length > 300) return;
  before.forEach((bIdx, pos) => {
    const aIdx = after[pos];
    if (bIdx !== aIdx) {
      const from = pool[bIdx]?.id;
      const to = pool[aIdx]?.id;
      if (from && to) out.push([from, to]);
    }
  });
}

/** หมุนหลักใน 1 ช่อง เช่น '123456' หมุน 2 → '561234' */
export function rotateDigitsInSlot(slot: string, times: number): string {
  const s = digitsOnly(slot).padStart(6, '0').slice(-6);
  const k = ((times % 6) + 6) % 6;
  if (k === 0) return s;
  return s.slice(-k) + s.slice(0, -k);
}

/* ==================================================================
 * ส่วนที่ 5: ★ ตัวช่วยสร้างชุดเลขตั้งต้นให้ผู้เล่น
 * ------------------------------------------------------------------
 * ใช้เมื่อต้องการสร้างเลขให้ผู้เล่นจำนวนมาก แล้วสลับด้วยบอท
 * ================================================================== */

export function generatePlayerSlots(
  count: number,
  opts: { seed?: number; natural?: boolean } = {},
): { id: string; slots: string[]; result: string }[] {
  const rng = new SeededRng(opts.seed);
  return Array.from({ length: count }, (_, i) => {
    const slots = opts.natural === false
      ? randomSlots()
      : solveSlotsNatural(padNum(rng.int(RESULT_MODULO)), rng.int(0xffffffff)).slots;
    return { id: `p${i + 1}`, slots, result: computeResult(slots).result };
  });
}

/* ==================================================================
 * ส่วนที่ 6: ★ รายงานผลหลังรันบอท (สำหรับหลังบ้าน)
 * ================================================================== */

export interface BotReport {
  resultBot: {
    enabled: boolean;
    mode: ResultMode;
    lastResult: string | null;
    reason: string;
    verified: boolean;
  };
  numberBot: {
    enabled: boolean;
    plan: SwapPlan;
    lastNote: string;
    changedPercent: number;
  };
  economics: {
    totalBet: number;
    payout: number;
    profit: number;
    profitPercent: number;
    winCount: number;
  };
  /** คำเตือน */
  warnings: string[];
}

export function buildBotReport(
  r: ResultBotOutcome | null,
  n: NumberBotOutcome | null,
  cfgR: Partial<ResultBotConfig>,
  cfgN: Partial<NumberBotConfig>,
): BotReport {
  const warnings: string[] = [];

  if (r) {
    if (!r.verified) warnings.push('🔴 เลขที่วางไม่ตรงกับผลลัพธ์ — ตรวจสอบด่วน');
    if (r.profit < 0) warnings.push(`🔴 รอบนี้ขาดทุน ฿${Math.abs(r.profit).toLocaleString()}`);
    if (r.winCount > 0 && cfgR.avoidAllWinners) warnings.push(`🟡 ตั้ง "ห้ามมีคนถูก" แต่มีผู้ชนะ ${r.winCount} ราย`);
    if (r.mode === 'profit' && r.profitPercent > 90) warnings.push('🟡 กำไรสูงผิดปกติ — อาจดูไม่เป็นธรรมชาติ');
  }
  if (!cfgR.enabled) warnings.push('🟡 บอทออกผลปิดอยู่ — ระบบใช้การสุ่มบริสุทธิ์');
  if (n && n.changedPercent === 0) warnings.push('🟡 บอทวางเลขไม่ได้สลับใครเลย — ตรวจพารามิเตอร์');

  let lastResult: string | null = null;
  if (r) {
    const d = digitsOnly(r.result);
    lastResult = d.padStart(6, '0').slice(-6);
  }

  return {
    resultBot: {
      enabled: !!cfgR.enabled,
      mode: (cfgR.mode || 'balance') as ResultMode,
      lastResult,
      reason: r?.reason || '',
      verified: r?.verified ?? false,
    },
    numberBot: {
      enabled: !!cfgN.enabled,
      plan: (cfgN.plan || 'random') as SwapPlan,
      lastNote: n?.note || '',
      changedPercent: n?.changedPercent ?? 0,
    },
    economics: {
      totalBet: r?.totalBet ?? 0,
      payout: r?.payout ?? 0,
      profit: r?.profit ?? 0,
      profitPercent: r?.profitPercent ?? 0,
      winCount: r?.winCount ?? 0,
    },
    warnings,
  };
}
