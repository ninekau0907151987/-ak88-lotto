/**
 * src/shared/lib/lottery20.ts
 * ------------------------------------------------------------------
 * ★ ระบบ "หวย 20 ช่อง 6 หลัก" (20-Slot × 6-Digit) ★
 *
 * ผู้ใช้ขอ: "มีการวางเลข 20 ช่อง 6 หลัก
 *            เอาเลขมาบวกกัน มาลบ หลักที่ 17
 *            แล้วทำบอท 2 ตัว — บอทออกผล + บอทวางเลข"
 *
 * ==================================================================
 * กติกาการออกผล (สูตรหลัก)
 * ==================================================================
 *   1. วางเลข 20 ช่อง แต่ละช่องเป็นเลข 6 หลัก
 *      เช่น  023456 | 781234 | 990011 | ... (รวม 20 ช่อง)
 *
 *   2. ผลรวมทั้งหมด (Sum)
 *      sum = Σ (ค่าตัวเลขของแต่ละช่อง)
 *      sum = 23456 + 781234 + 990011 + ...
 *
 *   3. ลบด้วย "หลักที่ 17" (Subtract slot 17)
 *      ★ ใช้ "ค่าตัวเลขเต็ม" ของช่องที่ 17 มาลบออก
 *      KEY = sum − value[17]
 *
 *   4. ผลลัพธ์ = 6 หลักท้ายของ KEY (mod 1,000,000)
 *      + เติมศูนย์นำหน้าถ้าไม่ครบ 6 หลัก
 *
 *   5. แยกเป็นรางวัล
 *      - 3 ตัวบน  = 3 หลักท้ายของผลลัพธ์
 *      - 2 ตัวบน  = 2 หลักท้าย
 *      - 2 ตัวล่าง = 2 หลักกลาง (ตำแหน่งที่ 3-4 จากซ้าย)
 *      - 1 ตัว     = หลักสุดท้าย
 *
 * ทุกฟังก์ชันในไฟล์นี้เป็น "ฟังก์ชันบริสุทธิ์" (pure)
 * → ทดสอบได้โดยไม่ต้องมี DB
 * → ทั้ง "บอทออกผล" และหน้าจอหลังบ้านใช้ตัวเดียวกัน → ไม่มีทางคำนวณไม่ตรงกัน
 * ==================================================================
 */

/* ==================================================================
 * 1. ค่าคงที่
 * ================================================================== */

/** จำนวนช่อง */
export const SLOT_COUNT = 20;
/** จำนวนหลักต่อช่อง */
export const DIGITS_PER_SLOT = 6;
/** ฐานของผลลัพธ์ = 10^6 = 1,000,000 */
export const RESULT_MODULO = 1_000_000;
/** ★ ตำแหน่งช่องที่ใช้ลบ — หลักที่ 17 (index 16 แบบ 0-based) */
export const SUBTRACT_SLOT_POSITION = 17;
export const SUBTRACT_SLOT_INDEX = SUBTRACT_SLOT_POSITION - 1;

/**
 * ★ ช่องหนึ่งช่อง = สตริง 6 หลัก (เช่น '000123')
 *   เพิ่ม alias นี้เพื่อให้ฝั่ง UI อ่านง่าย ไม่ต้องใช้ unknown[]
 */
export type Slot = string;

/* ==================================================================
 * 2. ชนิดข้อมูล
 * ================================================================== */

export interface SlotResult {
  /** ค่าที่ใช้คำนวณจริง (หลัง normalize) */
  slots: string[];
  /** ผลรวมทุกช่อง */
  sum: number;
  /** ค่าของช่องที่ 17 ที่ถูกลบ */
  subtractValue: number;
  /** ค่าของช่องที่ 17 (สตริง 6 หลัก) */
  subtractSlot: string;
  /** ผลรวม − ช่อง 17 (ก่อน mod) */
  raw: number;
  /** ผลลัพธ์ 6 หลัก */
  result: string;
  /** แยกรางวัล */
  prizes: PrizeBreakdown;
  /** ตรวจสอบย้อนกลับได้ */
  verify: { recomputed: number; ok: boolean };
}

export interface PrizeBreakdown {
  /** 3 ตัวบน = 3 หลักท้าย */
  top3: string;
  /** 2 ตัวบน = 2 หลักท้าย */
  top2: string;
  /** 2 ตัวล่าง = 2 หลักกลาง (ตำแหน่ง 3-4) */
  bottom2: string;
  /** 1 ตัวท้าย */
  last1: string;
}

export interface SlotValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  filledCount: number;
  isComplete: boolean;
}

/* ==================================================================
 * 3. ตัวช่วยพื้นฐาน
 * ================================================================== */

/** ตัดทุกอย่างที่ไม่ใช่ตัวเลขออก */
export const digitsOnly = (v: unknown): string => String(v ?? '').replace(/\D/g, '');

/**
 * normalize ค่าช่องให้เป็น 6 หลัก
 * - เกิน 6 หลัก → เอา 6 หลักท้าย
 * - น้อยกว่า 6 หลัก → เติมศูนย์นำหน้า
 */
export function normalizeSlot(raw: unknown): string {
  const d = digitsOnly(raw);
  if (d === '') return '000000';
  return d.slice(-DIGITS_PER_SLOT).padStart(DIGITS_PER_SLOT, '0');
}

/** แปลงช่องเป็นตัวเลข — คืน null ถ้าว่าง */
export function slotToNumber(raw: unknown): number | null {
  const d = digitsOnly(raw);
  if (d === '') return null;
  return Number(normalizeSlot(d));
}

/** เติมศูนย์นำหน้าให้ครบ n หลัก */
export const padNum = (n: number, len = DIGITS_PER_SLOT): string =>
  String(Math.abs(Math.trunc(n))).padStart(len, '0').slice(-len);

/* ==================================================================
 * 4. ★ ตรวจสอบความถูกต้องของช่อง
 * ================================================================== */

export function validateSlots(slots: unknown[]): SlotValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(slots)) {
    return { ok: false, errors: ['slots ต้องเป็นอาร์เรย์'], warnings: [], filledCount: 0, isComplete: false };
  }

  if (slots.length !== SLOT_COUNT) {
    errors.push(`ต้องมี ${SLOT_COUNT} ช่อง แต่ได้ ${slots.length} ช่อง`);
  }

  let filled = 0;
  slots.forEach((s, i) => {
    const d = digitsOnly(s);
    if (d === '') return;
    filled++;
    if (d.length !== DIGITS_PER_SLOT) {
      warnings.push(`ช่อง ${i + 1}: กรอก ${d.length} หลัก (ต้อง ${DIGITS_PER_SLOT}) จะถูกปรับให้`);
    }
    if (d.length > DIGITS_PER_SLOT) {
      warnings.push(`ช่อง ${i + 1}: เกิน ${DIGITS_PER_SLOT} หลัก จะใช้ ${DIGITS_PER_SLOT} หลักท้าย`);
    }
  });

  const isComplete = filled === SLOT_COUNT;

  // ★ ต้องมีช่องที่ 17 ถึงคำนวณได้
  // ★ ตรวจจากค่าดิบ (raw) ไม่ใช่ค่าที่ normalize แล้ว
  //    เพราะ normalizeSlot('') = '000000' ซึ่งแยกจากเลข 000000 จริงไม่ได้
  const raw17 = slots[SUBTRACT_SLOT_INDEX];
  const slot17 = digitsOnly(raw17);
  if (raw17 === undefined || raw17 === null || slot17 === '') {
    errors.push(`★ ช่องที่ ${SUBTRACT_SLOT_POSITION} ว่าง — คำนวณไม่ได้ (เป็นช่องที่ใช้ลบ)`);
  }

  return { ok: errors.length === 0, errors, warnings, filledCount: filled, isComplete };
}

/* ==================================================================
 * 5. ★ สูตรออกผล — หัวใจของระบบ
 * ------------------------------------------------------------------
 *   result = (Σ slots − slot17) mod 1,000,000
 * ================================================================== */

export function computeResult(slots: unknown[]): SlotResult {
  const norm: string[] = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    norm.push(normalizeSlot(slots?.[i]));
  }

  const sum = norm.reduce((acc, s) => acc + Number(s), 0);
  const subtractSlot = norm[SUBTRACT_SLOT_INDEX];
  const subtractValue = Number(subtractSlot);
  const raw = sum - subtractValue;

  // ★ mod เพื่อให้ได้ 6 หลักเสมอ (รองรับค่าติดลบด้วย)
  const modded = ((raw % RESULT_MODULO) + RESULT_MODULO) % RESULT_MODULO;
  const result = padNum(modded);

  const prizes: PrizeBreakdown = {
    top3: result.slice(-3),
    top2: result.slice(-2),
    bottom2: result.slice(2, 4),
    last1: result.slice(-1),
  };

  // ตรวจสอบย้อนกลับ — กันบั๊กคำนวณพลาด
  const recomputed = (norm.reduce((a, s) => a + Number(s), 0) - Number(norm[SUBTRACT_SLOT_INDEX]) + RESULT_MODULO) % RESULT_MODULO;

  return {
    slots: norm,
    sum,
    subtractValue,
    subtractSlot,
    raw,
    result,
    prizes,
    verify: { recomputed, ok: recomputed === modded },
  };
}

/**
 * คำนวณผลพร้อมรายละเอียดทีละขั้น — ใช้แสดงบนหน้าจอหลังบ้าน
 * เพื่อให้ผู้ดูแลตรวจสอบได้ว่ามาจากไหน
 */
export function computeResultDetailed(slots: unknown[]) {
  const r = computeResult(slots);
  return {
    ...r,
    steps: [
      { n: 1, label: 'ผลรวมทั้ง 20 ช่อง', value: r.sum.toLocaleString('en-US') },
      { n: 2, label: `หัก ช่องที่ ${SUBTRACT_SLOT_POSITION} (${r.subtractSlot})`, value: `− ${r.subtractValue.toLocaleString('en-US')}` },
      { n: 3, label: 'ผลต่าง', value: r.raw.toLocaleString('en-US') },
      { n: 4, label: `mod ${RESULT_MODULO.toLocaleString('en-US')}`, value: r.result },
    ],
  };
}

/* ==================================================================
 * 6. อัตราจ่าย (Payout Rates) — ตารางตั้งต้น
 * ------------------------------------------------------------------
 * ★ ผู้ใช้ขอ: "ทำตารางอัตราจ่ายด้วย ตั้งค่าเริ่มต้นตามแผน"
 * ค่าเหล่านี้เป็น "ค่าตั้งต้น" แก้ได้จากหลังบ้าน
 * ================================================================== */

export interface PayoutRate {
  key: string;
  label: string;
  /** ตัวคูณจ่าย (เท่าของเงินแทง) */
  rate: number;
  /** คำอธิบายการถูกรางวัล */
  desc: string;
  /** ความน่าจะเป็นโดยประมาณ (1 ใน N) */
  odds: number;
}

export const DEFAULT_PAYOUT_RATES: PayoutRate[] = [
  {
    key: '3ตัวบน', label: '3 ตัวบน', rate: 900,
    desc: 'เลข 3 หลักท้าย ตรงตำแหน่งกับผลรางวัล',
    odds: 1000,
  },
  {
    key: '2ตัวบน', label: '2 ตัวบน', rate: 95,
    desc: 'เลข 2 หลักท้าย ตรงตำแหน่งกับผลรางวัล',
    odds: 100,
  },
  {
    key: '2ตัวล่าง', label: '2 ตัวล่าง', rate: 95,
    desc: 'เลข 2 หลักกลาง (ตำแหน่งที่ 3-4 จากซ้าย)',
    odds: 100,
  },
  {
    key: '1ตัว', label: '1 ตัว (วิ่ง)', rate: 3.2,
    desc: 'เลข 1 หลัก ตรงกับหลักสุดท้ายของผลรางวัล',
    odds: 10,
  },
  {
    key: '3ตัวโต๊ด', label: '3 ตัวโต๊ด', rate: 150,
    desc: 'เลข 3 หลัก สลับที่ได้ (ตรงกับ 3 ตัวบน)',
    odds: 166.67,
  },
];

/** ★ ค่าเริ่มต้นตามแผน — margin ที่ระบบควรทำได้ */
export const DEFAULT_HOUSE_MARGIN = {
  /** เปอร์เซ็นต์กำไรเป้าหมาย (ของยอดแทงรวม) */
  targetMarginPercent: 12,
  /** เพดานจ่ายต่อรอบ (บาท) — กันเจ๊ง */
  maxPayoutPerRound: 2_000_000,
  /** เพดานรับต่อเลขต่อรอบ */
  maxBetPerNumber: 5_000,
  /** ขั้นต่ำต่อรายการ */
  minBetAmount: 10,
  /** ขั้นสูงต่อรายการ */
  maxBetAmount: 50_000,
  /** จำนวนเงินต่อ 1 หน่วย */
  unitAmount: 10,
};

/**
 * ★ คำนวณ margin จริงจากอัตราจ่าย
 * ------------------------------------------------------------------
 * สำคัญ: แต่ละประเภทแยกกัน — ผู้เล่นเลือกแทง "อย่างใดอย่างหนึ่ง"
 * จึงต้องดู margin "ต่อประเภท" ไม่ใช่ผลรวมทุกประเภท
 *
 * margin ต่อประเภท = 1 − (rate / odds)
 *   เช่น 3 ตัวบน: rate 900, odds 1000 → 1 − 0.9 = 10% (เจ้ามือได้ 10%)
 *
 * margin รวม = ค่าเฉลี่ยถ่วงน้ำหนัก (หรือค่าต่ำสุด = แย่สุด)
 */
export function calcHouseMargin(rates: PayoutRate[] = DEFAULT_PAYOUT_RATES): {
  marginPercent: number;
  worstPercent: number;
  bestPercent: number;
  breakdown: { key: string; label: string; ev: number; marginPercent: number; rate: number; odds: number; verdict: string }[];
  verdict: string;
} {
  const breakdown = rates.map(r => {
    const ev = r.rate / r.odds;
    const mp = (1 - ev) * 100;
    let verdict = 'สมดุล';
    if (mp < 0) verdict = '🔴 ขาดทุน';
    else if (mp < 5) verdict = '🟡 เสี่ยง';
    else if (mp <= 25) verdict = '🟢 เหมาะสม';
    else verdict = '🔵 อนุรักษ์นิยม';
    return { key: r.key, label: r.label, ev, marginPercent: mp, rate: r.rate, odds: r.odds, verdict };
  });

  const margins = breakdown.map(b => b.marginPercent);
  const marginPercent = margins.reduce((s, v) => s + v, 0) / (margins.length || 1);
  const worstPercent = Math.min(...margins);
  const bestPercent = Math.max(...margins);

  let verdict = 'สมดุล';
  if (worstPercent < 0) verdict = '🔴 ขาดทุน — มีประเภทที่จ่ายสูงเกินไป';
  else if (worstPercent < 5) verdict = '🟡 เสี่ยง — มีประเภทกำไรบาง';
  else if (bestPercent <= 25) verdict = '🟢 เหมาะสมทุกประเภท';
  else verdict = '🔵 อนุรักษ์นิยม — กำไรหนา';

  return { marginPercent, worstPercent, bestPercent, breakdown, verdict };
}

/** อัตราจ่ายเริ่มต้นตามแผน (rate จาก key) */
export function defaultRateMap(): Record<string, number> {
  const m: Record<string, number> = {};
  DEFAULT_PAYOUT_RATES.forEach(r => { m[r.key] = r.rate; });
  return m;
}

/* ==================================================================
 * 7. ★ ตรวจรางวัลของโพย (ใช้ร่วมกับ evaluate.ts)
 * ------------------------------------------------------------------
 * สูตร: result → prizes → เทียบกับเลขที่แทง
 * ================================================================== */

export type Bet20Type = '3ตัวบน' | '2ตัวบน' | '2ตัวล่าง' | '1ตัว' | '3ตัวโต๊ด' | string;

export interface Bet20 {
  number: string;
  type: Bet20Type;
  amount: number;
  rate?: number;
}

export interface Eval20Detail {
  number: string;
  type: string;
  amount: number;
  rate: number;
  won: boolean;
  winAmount: number;
  reason?: string;
}

/** เรียงหลัก — ใช้เทียบแบบโต๊ด */
const sortDigits = (s: string) => s.split('').sort().join('');

export function evaluateBets20(
  bets: Bet20[],
  result: SlotResult | string,
  rates: Record<string, number> = {},
): { payout: number; details: Eval20Detail[] } {
  const res = typeof result === 'string' ? result : result.result;
  const r = res.padStart(DIGITS_PER_SLOT, '0').slice(-DIGITS_PER_SLOT);
  const { top3, top2, bottom2, last1 } = {
    top3: r.slice(-3), top2: r.slice(-2), bottom2: r.slice(2, 4), last1: r.slice(-1),
  };

  let payout = 0;
  const details: Eval20Detail[] = [];

  for (const b of bets || []) {
    const num = digitsOnly(b.number);
    const amount = Number(b.amount) || 0;
    const rate = Number(b.rate) || Number(rates[b.type]) || 0;

    let won = false;
    let reason = '';

    switch (b.type) {
      case '3ตัวบน':
        won = num === top3;
        if (won) reason = `ตรงกับ 3 หลักท้าย ${top3}`;
        break;

      case '3ตัวโต๊ด':
        won = num.length === 3 && sortDigits(num) === sortDigits(top3);
        if (won) reason = `สลับหลักตรงกับ ${top3}`;
        break;

      case '2ตัวบน':
        won = num === top2;
        if (won) reason = `ตรงกับ 2 หลักท้าย ${top2}`;
        break;

      case '2ตัวล่าง':
        won = num === bottom2;
        if (won) reason = `ตรงกับ 2 หลักกลาง ${bottom2}`;
        break;

      case '1ตัว':
        won = num.length === 1 && num === last1;
        if (won) reason = `ตรงกับหลักสุดท้าย ${last1}`;
        break;

      default:
        won = false;
        reason = `ไม่รู้จักประเภท "${b.type}"`;
    }

    const winAmount = won ? amount * rate : 0;
    payout += winAmount;
    details.push({ number: num, type: b.type, amount, rate, won, winAmount, reason: reason || undefined });
  }

  return { payout, details };
}

/* ==================================================================
 * 8. สรุปยอดรับ-จ่ายของรอบ (ใช้ตัดสินใจก่อนออกผล)
 * ================================================================== */

export interface RoundExposure {
  totalBet: number;
  /** จำนวนเงินที่รับ แยกตามเลข+ประเภท */
  byNumber: Map<string, { type: string; amount: number; payoutIfWin: number }>;
  /** เลขที่ถ้าออกแล้วจ่ายหนักสุด */
  worstNumbers: { number: string; type: string; payout: number; profit: number }[];
  /** margin หากออกเลขที่แย่ที่สุด */
  worstCaseProfit: number;
}

export function analyzeRoundExposure(
  bets: Bet20[],
  rates: Record<string, number> = {},
): RoundExposure {
  const totalBet = bets.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const byNumber = new Map<string, { type: string; amount: number; payoutIfWin: number }>();

  for (const b of bets) {
    const num = digitsOnly(b.number);
    if (!num) continue;
    const key = `${num}|${b.type}`;
    const cur = byNumber.get(key) || { type: b.type, amount: 0, payoutIfWin: 0 };
    const rate = Number(b.rate) || Number(rates[b.type]) || 0;
    cur.amount += Number(b.amount) || 0;
    cur.payoutIfWin += (Number(b.amount) || 0) * rate;
    byNumber.set(key, cur);
  }

  const worst = [...byNumber.entries()]
    .map(([k, v]) => {
      const [number] = k.split('|');
      return { number, type: v.type, payout: v.payoutIfWin, profit: totalBet - v.payoutIfWin };
    })
    .sort((a, b) => a.profit - b.profit)
    .slice(0, 10);

  return {
    totalBet,
    byNumber,
    worstNumbers: worst,
    worstCaseProfit: worst.length ? worst[0].profit : totalBet,
  };
}

/* ==================================================================
 * 9. สุ่มเลข 20 ช่อง (สำหรับบอทและปุ่มสุ่มในหน้าจอ)
 * ================================================================== */

/** สุ่มช่องเดียว 6 หลัก — ใช้ crypto ถ้ามี เพื่อไม่ให้ทำนายได้ */
export function randomSlot(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return String(a[0] % RESULT_MODULO).padStart(DIGITS_PER_SLOT, '0');
  }
  return String(Math.floor(Math.random() * RESULT_MODULO)).padStart(DIGITS_PER_SLOT, '0');
}

/** สุ่มทั้ง 20 ช่อง */
export function randomSlots(): string[] {
  return Array.from({ length: SLOT_COUNT }, () => randomSlot());
}

/** สุ่มแบบ seed ได้ — สำหรับทดสอบซ้ำได้ (deterministic) */
export function seededSlots(seed: number): string[] {
  let s = seed >>> 0 || 1;
  const next = () => {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s;
  };
  return Array.from({ length: SLOT_COUNT }, () => String(next() % RESULT_MODULO).padStart(DIGITS_PER_SLOT, '0'));
}

/* ==================================================================
 * ★ 10. วางเลขให้ได้ผลตามเป้า (Target Result Solver)
 * ------------------------------------------------------------------
 * ผู้ใช้ขอ: "บอทออกผล เวลาปิดรอบ ให้วางเลขจำลองยูส
 *            เพื่อคำนวณออกผลมา"
 *
 * ต้องการ (Σ slots − slot17) mod 1e6 = target
 * → ต้องให้ Σ slots = target + k·1e6 + slot17  สำหรับ k ใดๆ ≥ 0
 *
 * ★ วางแบบกระจายทุกช่อง ไม่ทิ้งร่องรอย (ไม่ให้ช่อง 1 = ผลลัพธ์ตรงๆ)
 * ================================================================== */

export interface SolveOptions {
  /** จำนวนช่องที่ต้องการให้มีค่า (ค่าเริ่มต้น = 20 = ทุกช่อง) */
  fillCount?: number;
  /** เพิ่มรอบ (k) เพื่อให้ผลรวมดูเป็นธรรมชาติ — สูงขึ้น = ค่ายิ่งกระจาย */
  extraRounds?: number;
  /** seed สำหรับทำซ้ำได้ */
  seed?: number;
  /** ช่องที่ห้ามแตะ (ค่าเริ่มต้น: ไม่มี) */
  lockedSlots?: Record<number, string>;
  /**
   * ★ ปิดช่องที่ไม่ได้ใช้กระจายให้เป็น 000000 (ค่าเริ่มต้น: false = สุ่มให้เต็ม)
   * true  → ใช้เฉพาะ fillCount ช่องแรก + ช่อง 17 ที่เหลือเป็น 0
   * false → เติมช่องที่เหลือด้วยค่าสุ่ม (ดูเป็นธรรมชาติกว่า)
   */
  lockOthers?: boolean;
}

/**
 * ★ หาชุดตัวเลข 20 ช่องที่ให้ผลลัพธ์ตามเป้า
 *
 * @example
 *   solveSlotsForResult('777777')  // → 20 ช่องที่บวกกันแล้ว mod ได้ 777777
 */
export function solveSlotsForResult(target: string, opts: SolveOptions = {}): {
  slots: string[];
  target: string;
  achieved: string;
  ok: boolean;
  sumUsed: number;
  rounds: number;
} {
  const t = Number(digitsOnly(target).padStart(DIGITS_PER_SLOT, '0').slice(-DIGITS_PER_SLOT)) || 0;
  const locked = opts.lockedSlots || {};
  const lockedIdx = new Set(Object.keys(locked).map(Number));
  const freeIdx: number[] = [];
  for (let i = 0; i < SLOT_COUNT; i++) if (!lockedIdx.has(i)) freeIdx.push(i);

  // RNG ที่ seed ได้ เพื่อให้ผลทำซ้ำได้
  let rs = (opts.seed ?? Math.floor(Math.random() * 0xffffffff)) >>> 0 || 1;
  const rnd = () => {
    rs ^= rs << 13; rs >>>= 0;
    rs ^= rs >> 17;
    rs ^= rs << 5;  rs >>>= 0;
    return rs / 0x100000000;
  };

  // ★ ค่าที่ล็อกไว้ — "ไม่รวม" ช่อง 17 เพราะช่อง 17 หักล้างตัวเอง
  const base = Object.entries(locked)
    .filter(([i]) => Number(i) !== SUBTRACT_SLOT_INDEX)
    .reduce((s, [, v]) => s + Number(normalizeSlot(v)), 0);

  // ★ ช่องอิสระที่ "มีผลต่อผลลัพธ์" = ทุกช่องยกเว้นช่อง 17
  const contenders = freeIdx.filter(i => i !== SUBTRACT_SLOT_INDEX);

  // จำนวนช่องที่จะใช้กระจายค่า (สูงสุด = จำนวนช่องที่มีผล)
  const fillCount = Math.max(1, Math.min(opts.fillCount ?? contenders.length, contenders.length));
  const use = contenders.slice(0, fillCount);

  /**
   * ★ คณิตศาสตร์ของสูตร:
   *   result = (Σall − slot17) mod 1e6 = t
   *
   *   Σall = (ผลรวมช่องที่ล็อก) + (ผลรวมช่องอิสระ)
   *   ★ แต่ช่อง 17 ถูกหักออก → ค่าของมันหักล้างตัวเองเสมอ
   *      (ไม่ว่าจะล็อกหรือไม่ล็อก ก็มี net contribution = 0)
   *
   *   ∴ ผลรวมที่มีผลจริง = ผลรวมของทุกช่อง "ยกเว้น" ช่อง 17
   *   ∴ ต้องให้:  Σ(ช่องอิสระที่ไม่ใช่ 17) + base_locked_non17 = t + k·1e6
   */
  const rounds = Math.max(1, opts.extraRounds ?? 3);
  const k = Math.floor(rnd() * rounds) + 1;   // สุ่มจำนวนรอบ 1..rounds

  // ★ สำคัญ: ช่อง 17 ถูก "ลบ" ทิ้ง → ค่าในช่อง 17 ไม่มีผลต่อผลลัพธ์
  //   ดังนั้นถ้าช่อง 17 อยู่ในชุดอิสระ (ไม่ได้ล็อก) ให้คิด contribution = 0
  //   ถ้าล็อกไว้ → ค่าที่ล็อกถูกหักออกเช่นกัน → ก็ยังเป็น 0
  const need = t + k * RESULT_MODULO - base;

  if (need < 0) {
    // กรณีค่าล็อกสูงเกินไป — ยอมแพ้อย่างสุภาพ
    const fallback = randomSlots();
    const got = computeResult(fallback).result;
    return { slots: fallback, target: padNum(t), achieved: got, ok: got === padNum(t), sumUsed: 0, rounds: 0 };
  }

  // ★ กระจาย need ลงในช่องอิสระแบบสุ่ม แต่รับประกันว่าผลรวมตรงเป๊ะ
  const MAX = RESULT_MODULO - 1;      // 999999 ต่อช่อง
  const vals = new Array(use.length).fill(0);

  // ขั้น 1: กระจายแบบสุ่มสัดส่วน
  let remain = need;
  for (let i = 0; i < use.length; i++) {
    const left = use.length - i;                      // จำนวนช่องที่เหลือรวมช่องนี้
    const maxHere = Math.min(MAX, remain - (left - 1) * 0);  // เผื่อที่ให้ช่องที่เหลือ (ขั้นต่ำ 0)
    const avg = remain / left;
    // สุ่มในช่วง 40%-160% ของค่าเฉลี่ย แล้ว clamp
    let v = Math.floor(avg * (0.4 + rnd() * 1.2));
    v = Math.max(0, Math.min(v, maxHere, remain));
    vals[i] = v;
    remain -= v;
  }
  // ขั้น 2: เติมส่วนที่เหลือเข้าช่องสุดท้าย (หรือกระจายถ้าเกิน)
  let guard = 0;
  while (remain > 0 && guard++ < 10000) {
    let placed = false;
    for (let i = 0; i < use.length && remain > 0; i++) {
      const room = MAX - vals[i];
      if (room <= 0) continue;
      const add = Math.min(room, remain);
      vals[i] += add;
      remain -= add;
      placed = true;
    }
    if (!placed) break;   // ไม่มีที่เหลือ → ทำไม่ได้
  }

  const ok = remain === 0;

  // สร้างชุด 20 ช่อง
  const slots = new Array(SLOT_COUNT).fill('000000');
  Object.entries(locked).forEach(([i, v]) => { slots[Number(i)] = normalizeSlot(v); });
  use.forEach((slotIdx, i) => { slots[slotIdx] = padNum(vals[i]); });

  // ★ ช่อง 17: ถ้าไม่ได้ล็อก ให้ใส่ค่าสุ่ม (ไม่มีผลต่อผลลัพธ์ แต่ดูเป็นธรรมชาติ)
  if (!lockedIdx.has(SUBTRACT_SLOT_INDEX)) {
    slots[SUBTRACT_SLOT_INDEX] = padNum(Math.floor(rnd() * RESULT_MODULO));
  }
  // ★ ช่องที่เหลือ (ไม่ได้ใช้กระจายและไม่ได้ล็อก)
  if (!opts.lockOthers) {
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (i === SUBTRACT_SLOT_INDEX) continue;
      if (lockedIdx.has(i)) continue;
      if (use.includes(i)) continue;
      slots[i] = padNum(Math.floor(rnd() * RESULT_MODULO));
    }
  }

  const res = computeResult(slots);
  return {
    slots,
    target: padNum(t),
    achieved: res.result,
    ok: ok && res.result === padNum(t),
    sumUsed: res.sum,
    rounds: k,
  };
}

/**
 * ★ วางเลขแบบ "กระจายทุกช่อง" — รูปแบบที่ใช้จริงในบอท
 * ทุกช่องมีค่า ไม่มีช่องที่เป็น 000000 (ดูเป็นธรรมชาติ)
 */
export function solveSlotsNatural(target: string, seed?: number) {
  return solveSlotsForResult(target, { fillCount: SLOT_COUNT, extraRounds: 8, seed });
}

/* ==================================================================
 * 10. แปลงผลลัพธ์เป็นข้อความ (ใช้ในบิล/แชร์)
 * ================================================================== */

export function formatResult(result: string): string {
  const r = digitsOnly(result).padStart(DIGITS_PER_SLOT, '0').slice(-DIGITS_PER_SLOT);
  return `${r.slice(0, 3)}-${r.slice(3)}`;
}

export function resultToLines(r: SlotResult): string[] {
  return [
    `ผลรางวัล: ${formatResult(r.result)}`,
    `3 ตัวบน: ${r.prizes.top3}`,
    `2 ตัวบน: ${r.prizes.top2}`,
    `2 ตัวล่าง: ${r.prizes.bottom2}`,
    `1 ตัว: ${r.prizes.last1}`,
  ];
}

/** แสดงสูตรแบบอ่านเข้าใจได้ */
export function explainFormula(r: SlotResult): string {
  return [
    `Σ 20 ช่อง = ${r.sum.toLocaleString('en-US')}`,
    `− ช่องที่ ${SUBTRACT_SLOT_POSITION} (${r.subtractSlot}) = ${r.subtractValue.toLocaleString('en-US')}`,
    `= ${r.raw.toLocaleString('en-US')}`,
    `mod ${RESULT_MODULO.toLocaleString('en-US')} = ${r.result}`,
  ].join('  ');
}
