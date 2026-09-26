/**
 * src/shared/lib/game20BetSlip.ts
 * ------------------------------------------------------------------
 * ★ ตะกร้าแทงหวย 20 ช่อง 6 หลัก (ฝั่งลูกค้า) ★
 *
 * ทำงานร่วมกับ:
 *   - lottery20.ts   → validateSlots, computeResult, evaluateBets20
 *   - betCount.ts    → fmtMoney, fmtInt
 *
 * แนวคิด:
 *   1. ลูกค้ากรอกเลข 20 ช่อง (ช่องละ 6 หลัก 0-9)
 *   2. ระบบคำนวณ "ผลที่จะออก" ให้เห็นทันที = (Σ20 − ช่อง17) mod 1,000,000
 *   3. จากผลนั้น ลูกค้าเลือกประเภทที่จะแทง + จำนวนเงิน
 *   4. ตรวจเครดิตก่อนส่ง — ห้ามเกินยอดคงเหลือ
 */

import {
  SLOT_COUNT,
  DIGITS_PER_SLOT,
  normalizeSlot,
  computeResult,
  computeResultDetailed,
  validateSlots,
  type Slot,
} from './lottery20';
import { fmtMoney } from './betCount';

// ============================================================
// ประเภทการแทงของหวย 20 ช่อง
// ============================================================

/**
 * ★ ชื่อประเภทต้องตรงกับ lottery20.ts เป๊ะ (engine ตัดสินถูก/ผิดด้วยชื่อนี้)
 *   engine รองรับ: '3ตัวบน' | '3ตัวโต๊ด' | '2ตัวบน' | '2ตัวล่าง' | '1ตัว'
 *   หมายเหตุ: '2ตัวล่าง' ของ engine = หลักกลาง (r.slice(2,4)) ไม่ใช่หลักแรก
 */
export type Game20BetKind =
  | '3ตัวบน'      // 3 หลักท้ายตรงเป๊ะ
  | '2ตัวบน'      // 2 หลักท้ายตรงเป๊ะ
  | '2ตัวล่าง'    // 2 หลักกลาง (ตำแหน่ง 3-4)
  | '1ตัว'        // หลักหน่วย (หลักสุดท้าย)
  | '3ตัวโต๊ด';   // 3 หลักท้าย สลับที่ได้

export interface Game20BetKindInfo {
  kind: Game20BetKind;
  label: string;
  /** จำนวนหลักที่ต้องกรอก */
  digits: number;
  /** ราคาจ่ายเริ่มต้น (เท่า) */
  rate: number;
  /** วิธีอ่านผล */
  how: string;
  /** ตัวอย่าง */
  example: string;
  /** ไอคอน material symbol */
  icon: string;
  /** สี */
  color: string;
}

export const GAME20_BET_KINDS: Game20BetKindInfo[] = [
  {
    kind: '3ตัวบน', label: '3 ตัวบน', digits: 3, rate: 900,
    how: '3 หลักท้ายของผล ตรงตำแหน่งเป๊ะ',
    example: 'ผล 123456 → 3 หลักท้าย = 456 → แทง 456 ถูก',
    icon: 'filter_3', color: '#dc2626',
  },
  {
    kind: '2ตัวบน', label: '2 ตัวบน', digits: 2, rate: 95,
    how: '2 หลักท้ายของผล ตรงตำแหน่งเป๊ะ',
    example: 'ผล 123456 → 2 หลักท้าย = 56 → แทง 56 ถูก',
    icon: 'filter_2', color: '#d97706',
  },
  {
    kind: '2ตัวล่าง', label: '2 ตัวล่าง', digits: 2, rate: 95,
    how: '2 หลักกลางของผล (ตำแหน่งที่ 3-4)',
    example: 'ผล 123456 → 2 หลักกลาง = 34 → แทง 34 ถูก',
    icon: 'vertical_align_center', color: '#2563eb',
  },
  {
    kind: '1ตัว', label: '1 ตัว (วิ่ง)', digits: 1, rate: 3.2,
    how: 'หลักหน่วย (หลักสุดท้ายของผล)',
    example: 'ผล 123456 → หลักหน่วย = 6 → แทง 6 ถูก',
    icon: 'looks_one', color: '#059669',
  },
  {
    kind: '3ตัวโต๊ด', label: '3 ตัวโต๊ด', digits: 3, rate: 150,
    how: '3 หลักท้าย สลับตำแหน่งได้ทุกแบบ (6 แบบ)',
    example: 'ผล 123456 → 3 หลักท้าย = 456 → แทง 456/465/546/564/645/654 ถูกหมด',
    icon: 'shuffle', color: '#0891b2',
  },
];

export const KIND_BY_KEY: Record<string, Game20BetKindInfo> =
  Object.fromEntries(GAME20_BET_KINDS.map(k => [k.kind, k]));

// ============================================================
// รายการในตะกร้า
// ============================================================

export interface BetSlipItem {
  /** id เฉพาะในตะกร้า */
  id: string;
  kind: Game20BetKind;
  /** เลขที่แทง (เฉพาะตัวเลข ไม่มีขีด) */
  number: string;
  /** เงินที่แทง */
  amount: number;
  /** อัตราจ่าย ณ เวลาที่เพิ่ม */
  rate: number;
}

export interface BetSlipTotals {
  /** จำนวนรายการ */
  count: number;
  /** ราคาทุนรวม (เงินที่ต้องจ่าย) */
  totalCost: number;
  /** ยอดจ่ายสูงสุดถ้าถูกทั้งหมด */
  maxPayout: number;
  /** แยกตามประเภท */
  byKind: Array<{
    kind: Game20BetKind;
    label: string;
    count: number;
    cost: number;
    payout: number;
    color: string;
  }>;
}

/** สร้าง id ไม่ซ้ำ */
let __seq = 0;
export function newSlipId(): string {
  __seq += 1;
  return `bs_${Date.now().toString(36)}_${__seq}`;
}

/**
 * เพิ่มรายการลงตะกร้า — ถ้าซ้ำ (ประเภท+เลขเดิม) ให้รวมเงินแทน
 * @returns ตะกร้าใหม่ (ไม่แก้ของเดิม)
 */
export function addToSlip(
  slip: BetSlipItem[],
  kind: Game20BetKind,
  number: string,
  amount: number,
  rate?: number,
): BetSlipItem[] {
  const info = KIND_BY_KEY[kind];
  if (!info) return slip;
  const amt = Math.max(0, Math.floor(amount || 0));
  if (amt <= 0) return slip;

  const num = String(number || '').replace(/\D/g, '');
  if (num.length !== info.digits) return slip;

  const useRate = rate ?? info.rate;
  const found = slip.find(s => s.kind === kind && s.number === num);

  if (found) {
    return slip.map(s =>
      s.kind === kind && s.number === num
        ? { ...s, amount: s.amount + amt, rate: useRate }
        : s,
    );
  }
  return [...slip, { id: newSlipId(), kind, number: num, amount: amt, rate: useRate }];
}

/** ลบรายการ */
export function removeFromSlip(slip: BetSlipItem[], id: string): BetSlipItem[] {
  return slip.filter(s => s.id !== id);
}

/** แก้เงินของรายการ */
export function setSlipAmount(slip: BetSlipItem[], id: string, amount: number): BetSlipItem[] {
  const amt = Math.max(0, Math.floor(amount || 0));
  return slip.map(s => (s.id === id ? { ...s, amount: amt } : s));
}

/** แก้เลขของรายการ */
export function setSlipNumber(
  slip: BetSlipItem[],
  id: string,
  number: string,
  rate?: number,
): BetSlipItem[] {
  return slip.map(s => {
    if (s.id !== id) return s;
    const info = KIND_BY_KEY[s.kind];
    const num = String(number || '').replace(/\D/g, '').slice(0, info.digits);
    return { ...s, number: num, rate: rate ?? s.rate };
  });
}

/** ล้างตะกร้า */
export function clearSlip(): BetSlipItem[] {
  return [];
}

// ============================================================
// คำนวณยอด
// ============================================================

/** รวมยอดจากตะกร้า */
export function computeTotals(slip: BetSlipItem[]): BetSlipTotals {
  let totalCost = 0;
  let maxPayout = 0;
  const map = new Map<Game20BetKind, { count: number; cost: number; payout: number }>();

  for (const it of slip) {
    const cost = it.amount;
    const payout = Math.floor(it.amount * it.rate);
    totalCost += cost;
    maxPayout += payout;

    const cur = map.get(it.kind) || { count: 0, cost: 0, payout: 0 };
    cur.count += 1; cur.cost += cost; cur.payout += payout;
    map.set(it.kind, cur);
  }

  const byKind = Array.from(map.entries())
    .map(([kind, v]) => ({
      kind,
      label: KIND_BY_KEY[kind]?.label || kind,
      color: KIND_BY_KEY[kind]?.color || '#666',
      ...v,
    }))
    .sort((a, b) => b.cost - a.cost);

  return { count: slip.length, totalCost, maxPayout, byKind };
}

// ============================================================
// ตรวจความถูกต้องก่อนส่ง
// ============================================================

export interface SlipValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSlip(
  slip: BetSlipItem[],
  slots: Slot[],
  balance: number,
): SlipValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1) ต้องมีรายการ
  if (!slip.length) errors.push('ยังไม่มีรายการแทง — เลือกเลขและจำนวนเงินก่อน');

  // 2) ช่องต้องครบ 20 และเป็นเลข 6 หลัก
  const slotCheck = validateSlots(slots);
  if (!slotCheck.ok) {
    for (const e of slotCheck.errors) errors.push(e);
  }

  // 3) แต่ละรายการต้องเลขครบหลัก
  for (const it of slip) {
    const info = KIND_BY_KEY[it.kind];
    if (!info) { errors.push(`ประเภท "${it.kind}" ไม่รู้จัก`); continue; }
    if (it.number.length !== info.digits) {
      errors.push(`${info.label}: เลข "${it.number}" ต้องมี ${info.digits} หลัก`);
    }
    if (it.amount <= 0) errors.push(`${info.label} ${it.number}: เงินต้องมากกว่า 0`);
  }

  // 4) เครดิต
  const totals = computeTotals(slip);
  if (totals.totalCost > balance) {
    errors.push(
      `เครดิตไม่พอ — ต้องใช้ ${fmtMoney(totals.totalCost)} บาท แต่มี ${fmtMoney(balance)} บาท`,
    );
  } else if (totals.totalCost > balance * 0.8) {
    warnings.push(`ใช้เครดิต ${Math.round((totals.totalCost / balance) * 100)}% ของยอดที่มี`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ============================================================
// ตรวจว่าเลขที่แทง "ถูกหรือไม่" เมื่อรู้ผลแล้ว
// ============================================================

/** ดึงเลขจากผลตามประเภท */
export function pickResultDigits(result: string, kind: Game20BetKind): string {
  const r = String(result || '').padStart(6, '0').slice(-6);
  switch (kind) {
    case '3ตัวบน':   return r.slice(-3);
    case '2ตัวบน':   return r.slice(-2);
    case '2ตัวล่าง': return r.slice(2, 4);   // ★ หลักกลาง ตรงกับ engine
    case '1ตัว':     return r.slice(-1);
    case '3ตัวโต๊ด': return r.slice(-3);
    default:          return '';
  }
}

/** เรียงตัวอักษร — ใช้เทียบโต๊ด */
function sortDigits(s: string): string {
  return s.split('').sort().join('');
}

/** ตรวจว่าถูกไหม */
export function isWinner(item: BetSlipItem, result: string): boolean {
  const target = pickResultDigits(result, item.kind);
  if (!target) return false;
  if (item.kind === '3ตัวโต๊ด') {
    return item.number.length === 3 && sortDigits(item.number) === sortDigits(target);
  }
  return item.number === target;
}

/** ตรวจทั้งตะกร้า — คืนผลรายรายการ + ยอด */
export function checkSlipAgainstResult(slip: BetSlipItem[], result: string) {
  const rows = slip.map(it => ({
    ...it,
    isWin: isWinner(it, result),
    payout: isWinner(it, result) ? Math.floor(it.amount * it.rate) : 0,
  }));
  const totalCost = rows.reduce((a, r) => a + r.amount, 0);
  const totalPayout = rows.reduce((a, r) => a + r.payout, 0);
  return {
    rows,
    totalCost,
    totalPayout,
    profit: totalPayout - totalCost,
    winCount: rows.filter(r => r.isWin).length,
  };
}

// ============================================================
// ตัวอย่าง/ค่าตั้งต้น
// ============================================================

/** สร้างเลขตัวอย่างให้ผู้เล่นเห็นภาพ (ไม่ใช่การแทงจริง) */
export function demoSlots(): Slot[] {
  const base = [12, 34, 56, 78, 90, 11, 22, 33, 44, 55, 66, 77, 88, 99, 10, 20, 30, 40, 50, 60];
  return base.slice(0, SLOT_COUNT).map(n => n.toString().padStart(DIGITS_PER_SLOT, '0'));
}

/** อธิบายการคำนวณผลจากช่อง (สำหรับโชว์ในหน้าเว็บ) */
export function explainSlots(slots: Slot[]): {
  fill: string;
  result: string;
  sum: number;
  slot17: string;
  subtract: number;
  raw: number;
  mod: string;
  steps: Array<{ n: number; label: string; value: string }>;
  prizes: { top3: string; top2: string; bottom2: string; last1: string };
} {
  const norm = slots.map(s => normalizeSlot(s));
  const det = computeResultDetailed(norm);

  return {
    fill: `${norm.length}/${SLOT_COUNT} ช่อง`,
    result: det.result,
    sum: det.sum,
    slot17: det.subtractSlot,
    subtract: det.subtractValue,
    raw: det.raw,
    mod: `mod 1,000,000 = ${det.result}`,
    steps: det.steps,
    prizes: {
      top3: det.prizes?.top3 ?? det.result.slice(-3),
      top2: det.prizes?.top2 ?? det.result.slice(-2),
      bottom2: det.result.slice(2, 4),
      last1: det.result.slice(-1),
    },
  };
}

/** นับว่าเลขในตะกร้าซ้ำกับผลหรือไม่ (เตือนก่อนส่ง) */
export function detectDuplicates(slip: BetSlipItem[]): string[] {
  const seen = new Map<string, number>();
  for (const it of slip) {
    const key = `${it.kind}|${it.number}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const dups: string[] = [];
  for (const [key, n] of seen.entries()) {
    if (n > 1) {
      const [kind, number] = key.split('|');
      dups.push(`${KIND_BY_KEY[kind]?.label || kind} ${number} ซ้ำ ${n} รายการ`);
    }
  }
  return dups;
}
