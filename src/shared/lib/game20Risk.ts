/**
 * src/shared/lib/game20Risk.ts
 * ------------------------------------------------------------------
 * ★ B2: ระบบจำกัดความเสี่ยงอัตโนมัติ (Risk Limits) ★
 *
 * ปัญหาที่แก้:
 *   ถ้าลูกค้าแทงเลขเดียวเยอะ ๆ แล้วเลขนั้นออก → เจ้ามือขาดทุนหนัก
 *   ต้องมี "เพดาน" ที่กันไว้ + เตือนก่อนรับแทง
 *
 * กลไก 4 ชั้น:
 *   1. เพดานจ่ายต่อ "เลข+ประเภท"     (maxPayoutPerNumber)  ← สำคัญสุด
 *   2. เพดานจ่ายต่อ "รอบ"             (maxPayoutPerRound)
 *   3. เพดานจ่ายต่อ "ผู้เล่นต่อรอบ"    (maxPayoutPerPlayer)
 *   4. เพดานรับต่อ "เลข+ประเภท"       (maxAcceptPerNumber)
 *
 * หลักคิดเรื่อง "ทุนสำรอง":
 *   เจ้ามือต้องมีเงินสำรอง = จ่ายสูงสุด − รับแทงทั้งหมด
 *   ถ้าสำรองไม่พอ → ต้องกันไม่ให้รับแทงเพิ่มที่เลขนั้น
 */

import { fmtMoney, fmtInt } from './betCount';
import { KIND_BY_KEY, type Game20BetKind, type BetSlipItem } from './game20BetSlip';

// ============================================================
// 6. ค่าตั้งต้นของเพดาน
// ============================================================

export interface RiskLimits {
  /** เพดานจ่ายต่อเลข+ประเภท (บาท) */
  maxPayoutPerNumber: number;
  /** เพดานจ่ายต่อรอบ (บาท) */
  maxPayoutPerRound: number;
  /** เพดานจ่ายต่อผู้เล่น 1 คน ต่อรอบ (บาท) */
  maxPayoutPerPlayer: number;
  /** เพดานรับแทงต่อเลข+ประเภท (บาท) */
  maxAcceptPerNumber: number;
  /** เงินสำรองของเจ้ามือ (บาท) */
  bankrollReserve: number;
  /** ถ้าจ่ายเกินกี่ % ของสำรอง → เตือน */
  warnAtPercent: number;
  /** ★ ถ้าเลขนี้จ่ายเกินเพดาน → บล็อกเลย หรือ แค่เตือน */
  blockOnExceed: boolean;
}

/**
 * ★ ลำดับเพดานต้องเรียงจากแคบ → กว้าง ให้สมเหตุสมผล:
 *   maxAcceptPerNumber (รับต่อเลข)  <  maxPayoutPerNumber (จ่ายต่อเลข)
 *   maxPayoutPerNumber              <  maxPayoutPerPlayer (จ่ายต่อคน — รวมหลายเลข)
 *   maxPayoutPerPlayer              <  maxPayoutPerRound  (จ่ายต่อรอบ — รวมทุกคน)
 *   maxPayoutPerRound               <  bankrollReserve    (สำรองต้องรับไหว)
 *
 * ⚠️ ถ้าตั้ง maxPayoutPerPlayer ต่ำกว่า maxPayoutPerNumber
 *    เพดานต่อคนจะ "บล็อกก่อน" และกันแทงปกติทิ้ง (เช่น 3ตัวบน 400 บาท = จ่าย 360,000)
 */
export const DEFAULT_RISK_LIMITS: RiskLimits = {
  /** รับต่อเลข+ประเภท ไม่เกิน 10,000 */
  maxAcceptPerNumber: 10_000,
  /** จ่ายหนักสุดต่อเลข+ประเภท = 500,000 (รับ 10,000 × 900 = 9,000,000 → เพดานนี้คุมก่อน) */
  maxPayoutPerNumber: 500_000,
  /** ผู้เล่น 1 คน ต่อรอบ — สูงกว่าต่อเลข เพราะรวมหลายเลข */
  maxPayoutPerPlayer: 800_000,
  /** ทั้งรอบ — สูงกว่าต่อคน */
  maxPayoutPerRound: 2_000_000,
  /** เงินสำรองของเจ้ามือ — ต้องรับไหวทุกกรณี */
  bankrollReserve: 3_000_000,
  /** เตือนที่ 70% ของเพดาน */
  warnAtPercent: 70,
  /** เกินเพดาน → บล็อกเลย */
  blockOnExceed: true,
};

// ============================================================
// 7. โครงสร้างผลการตรวจ
// ============================================================

export type RiskLevel = 'ok' | 'warn' | 'block';

export interface RiskItem {
  kind: Game20BetKind;
  number: string;
  /** เงินที่รับมาแล้ว */
  accepted: number;
  /** จ่ายถ้าเลขนี้ถูก (ตามที่รับแล้ว) */
  currentPayout: number;
  /** ถ้ารับรายการใหม่นี้ จะจ่ายเท่าไร */
  afterPayout: number;
  /** เงินที่ขอเพิ่ม */
  requestAmount: number;
  /** ระดับความเสี่ยง */
  level: RiskLevel;
  /** ข้อความอธิบาย */
  reason: string;
}

export interface RiskReport {
  /** ระดับรวมของทั้งคำขอ */
  level: RiskLevel;
  /** รายการที่ตรวจ */
  items: RiskItem[];
  /** บล็อกไหม */
  blocked: boolean;
  /** ข้อความเตือน/เหตุผลที่บล็อก */
  messages: string[];
  /** สรุปภาพรวมรอบ */
  round: {
    totalAccepted: number;
    worstCasePayout: number;
    netIfWorst: number;
    reserveAfterWorst: number;
    usedPercent: number;
  };
}

// ============================================================
// 8. คำนวณ "รับแล้ว" + "จ่ายถ้าถูก" จากรายการที่มีอยู่
// ============================================================

export interface ExposureRow {
  kind: string;
  number: string;
  accepted: number;
  payout: number;
}

/**
 * สรุปความเสี่ยงของรายการทั้งหมด
 * @param bets รายการที่รับมาแล้ว (ทั้งรอบ)
 * @param rateMap อัตราจ่ายจริงจากหลังบ้าน (key = ชื่อประเภท)
 */
export function summarizeExposure(
  bets: Array<{ type: string; number: string; amount: number; rate?: number }>,
  rateMap: Record<string, number> = {},
): {
  byNumber: Map<string, ExposureRow>;
  totalAccepted: number;
  worstCasePayout: number;
  worstNumber: string;
} {
  const byNumber = new Map<string, ExposureRow>();
  let totalAccepted = 0;

  for (const b of bets || []) {
    const num = String(b.number || '').replace(/\D/g, '');
    const rate = Number(b.rate) || Number(rateMap[b.type]) || 0;
    const amount = Number(b.amount) || 0;
    const key = `${b.type}|${num}`;

    const cur = byNumber.get(key) || { kind: b.type, number: num, accepted: 0, payout: 0 };
    cur.accepted += amount;
    cur.payout += Math.floor(amount * rate);
    byNumber.set(key, cur);
    totalAccepted += amount;
  }

  // หาเลขที่จ่ายหนักสุด
  let worstCasePayout = 0;
  let worstNumber = '';
  for (const [, row] of byNumber) {
    if (row.payout > worstCasePayout) {
      worstCasePayout = row.payout;
      worstNumber = `${row.kind} ${row.number}`;
    }
  }

  return { byNumber, totalAccepted, worstCasePayout, worstNumber };
}

// ============================================================
// 9. ★ ตรวจรายการใหม่ก่อนรับ — หัวใจของ B2 ★
// ============================================================

export interface CheckBetInput {
  kind: Game20BetKind;
  number: string;
  amount: number;
  /** อัตราจ่าย (ไม่ใส่ = ใช้ค่าเริ่มต้นของประเภท) */
  rate?: number;
}

/**
 * ตรวจว่าควรรับรายการนี้ไหม
 *
 * @param req รายการที่ขอแทง
 * @param existing รายการที่รับมาแล้วทั้งรอบ
 * @param limits เพดาน
 * @param rateMap อัตราจ่ายจากหลังบ้าน
 * @param playerAccepted เงินที่ผู้เล่นคนนี้แทงไปแล้วในรอบนี้
 */
export function checkBetRisk(
  req: CheckBetInput,
  existing: Array<{ type: string; number: string; amount: number; rate?: number }> = [],
  limits: RiskLimits = DEFAULT_RISK_LIMITS,
  rateMap: Record<string, number> = {},
  playerAccepted = 0,
): RiskReport {
  const info = KIND_BY_KEY[req.kind];
  const rate = Number(req.rate) || Number(rateMap[req.kind]) || info?.rate || 0;
  const num = String(req.number || '').replace(/\D/g, '');
  const amount = Math.max(0, Math.floor(Number(req.amount) || 0));

  const messages: string[] = [];
  let level: RiskLevel = 'ok';

  // ── ดึงยอดเดิมของเลขนี้ ──
  const { byNumber, totalAccepted, worstCasePayout } = summarizeExposure(existing, rateMap);
  const key = `${req.kind}|${num}`;
  const prev = byNumber.get(key) || { kind: req.kind, number: num, accepted: 0, payout: 0 };

  const afterAccepted = prev.accepted + amount;
  const afterPayout = prev.payout + Math.floor(amount * rate);

  const item: RiskItem = {
    kind: req.kind,
    number: num,
    accepted: prev.accepted,
    currentPayout: prev.payout,
    afterPayout,
    requestAmount: amount,
    level: 'ok',
    reason: '',
  };

  // ═══════ ชั้น 1: เพดานรับต่อเลข ═══════
  if (afterAccepted > limits.maxAcceptPerNumber) {
    item.level = 'block';
    item.reason =
      `รับเกินเพดานต่อเลข — รับแล้ว ${fmtMoney(prev.accepted)} + ใหม่ ${fmtMoney(amount)} ` +
      `= ${fmtMoney(afterAccepted)} เกิน ${fmtMoney(limits.maxAcceptPerNumber)}`;
    messages.push(`${info?.label || req.kind} ${num}: ${item.reason}`);
  }

  // ═══════ ชั้น 2: เพดานจ่ายต่อเลข (สำคัญสุด) ═══════
  if (afterPayout > limits.maxPayoutPerNumber) {
    item.level = limits.blockOnExceed ? 'block' : 'warn';
    item.reason =
      `จ่ายทะลุเพดานต่อเลข — ถ้า ${num} ออก จะจ่าย ${fmtInt(afterPayout)} ` +
      `เกินเพดาน ${fmtInt(limits.maxPayoutPerNumber)}`;
    messages.push(`${info?.label || req.kind} ${num}: ${item.reason}`);
  } else if (afterPayout > limits.maxPayoutPerNumber * (limits.warnAtPercent / 100)) {
    if (item.level === 'ok') item.level = 'warn';
    item.reason =
      `จ่ายใกล้เพดาน — ${fmtInt(afterPayout)} / ${fmtInt(limits.maxPayoutPerNumber)} ` +
      `(${Math.round((afterPayout / limits.maxPayoutPerNumber) * 100)}%)`;
    messages.push(`${info?.label || req.kind} ${num}: ${item.reason}`);
  }

  // ═══════ ชั้น 3: เพดานจ่ายต่อผู้เล่น ═══════
  const playerAfter = playerAccepted + amount;
  const playerPayoutAfter = Math.floor(playerAfter * rate);
  if (playerPayoutAfter > limits.maxPayoutPerPlayer) {
    if (item.level !== 'block') item.level = limits.blockOnExceed ? 'block' : 'warn';
    messages.push(
      `ผู้เล่นรายนี้จ่ายทะลุเพดาน — ${fmtInt(playerPayoutAfter)} เกิน ${fmtInt(limits.maxPayoutPerPlayer)}`,
    );
  }

  // ═══════ ชั้น 4: เพดานจ่ายต่อรอบ ═══════
  // จ่ายหนักสุดใหม่ = max(เดิม, ของเลขนี้หลังรับ)
  const newWorst = Math.max(worstCasePayout + (worstCasePayout === prev.payout ? Math.floor(amount * rate) : 0), afterPayout);
  if (newWorst > limits.maxPayoutPerRound) {
    if (item.level !== 'block') item.level = limits.blockOnExceed ? 'block' : 'warn';
    messages.push(
      `รอบนี้จ่ายทะลุเพดาน — เสี่ยงจ่าย ${fmtInt(newWorst)} เกิน ${fmtInt(limits.maxPayoutPerRound)}`,
    );
  }

  // ═══════ ทุนสำรอง ═══════
  const totalAfter = totalAccepted + amount;
  const netIfWorst = totalAfter - newWorst;
  const reserveAfter = limits.bankrollReserve + netIfWorst;
  const usedPercent = limits.bankrollReserve > 0
    ? Math.min(999, Math.round((newWorst / limits.bankrollReserve) * 100))
    : 0;

  if (reserveAfter <= 0) {
    if (item.level !== 'block') item.level = limits.blockOnExceed ? 'block' : 'warn';
    messages.push(
      `ทุนสำรองไม่พอ — รับ ${fmtInt(totalAfter)} แต่ต้องจ่ายได้ ${fmtInt(newWorst)} ` +
      `(สำรองติดลบ ${fmtInt(Math.abs(reserveAfter))})`,
    );
  } else if (usedPercent >= limits.warnAtPercent) {
    if (item.level === 'ok') item.level = 'warn';
    messages.push(
      `ใช้ทุนสำรอง ${usedPercent}% — จ่ายหนักสุด ${fmtInt(newWorst)} จากสำรอง ${fmtInt(limits.bankrollReserve)}`,
    );
  }

  // ── รวมระดับ ──
  if (item.level === 'block') level = 'block';
  else if (item.level === 'warn' && level === 'ok') level = 'warn';

  return {
    level,
    items: [item],
    blocked: level === 'block',
    messages,
    round: {
      totalAccepted: totalAfter,
      worstCasePayout: newWorst,
      netIfWorst,
      reserveAfterWorst: reserveAfter,
      usedPercent,
    },
  };
}

// ============================================================
// 10. ตรวจทั้งตะกร้าพร้อมกัน
// ============================================================

export function checkSlipRisk(
  slip: BetSlipItem[],
  existing: Array<{ type: string; number: string; amount: number; rate?: number }> = [],
  limits: RiskLimits = DEFAULT_RISK_LIMITS,
  rateMap: Record<string, number> = {},
  playerAccepted = 0,
): RiskReport {
  if (!slip.length) {
    const { totalAccepted, worstCasePayout } = summarizeExposure(existing, rateMap);
    return {
      level: 'ok', items: [], blocked: false, messages: [],
      round: {
        totalAccepted, worstCasePayout, netIfWorst: totalAccepted - worstCasePayout,
        reserveAfterWorst: limits.bankrollReserve + totalAccepted - worstCasePayout,
        usedPercent: limits.bankrollReserve > 0
          ? Math.round((worstCasePayout / limits.bankrollReserve) * 100) : 0,
      },
    };
  }

  const allItems: RiskItem[] = [];
  const allMessages: string[] = [];
  let level: RiskLevel = 'ok';

  // ตรวจทีละรายการ โดยสะสมของที่รับไปแล้ว (จำลองว่าถ้ารับทั้งหมด)
  let running = [...existing];
  let runningPlayer = playerAccepted;

  for (const it of slip) {
    const rep = checkBetRisk(
      { kind: it.kind, number: it.number, amount: it.amount, rate: it.rate },
      running, limits, rateMap, runningPlayer,
    );
    allItems.push(...rep.items);
    allMessages.push(...rep.messages);
    if (rep.level === 'block') level = 'block';
    else if (rep.level === 'warn' && level === 'ok') level = 'warn';

    // สะสม — ถ้าถูกบล็อกก็ยังนับ เพราะเรารายงานของทั้งตะกร้า
    running.push({ type: it.kind, number: it.number, amount: it.amount, rate: it.rate });
    runningPlayer += it.amount;
  }

  const { totalAccepted, worstCasePayout } = summarizeExposure(running, rateMap);

  return {
    level,
    items: allItems,
    blocked: level === 'block',
    messages: [...new Set(allMessages)],
    round: {
      totalAccepted,
      worstCasePayout,
      netIfWorst: totalAccepted - worstCasePayout,
      reserveAfterWorst: limits.bankrollReserve + totalAccepted - worstCasePayout,
      usedPercent: limits.bankrollReserve > 0
        ? Math.min(999, Math.round((worstCasePayout / limits.bankrollReserve) * 100))
        : 0,
    },
  };
}

// ============================================================
// 11. คำนวณเงินที่ "รับได้อีก" สำหรับเลขหนึ่ง
// ============================================================

export function maxAcceptable(
  kind: Game20BetKind,
  number: string,
  existing: Array<{ type: string; number: string; amount: number; rate?: number }>,
  limits: RiskLimits,
  rateMap: Record<string, number> = {},
): { byPayout: number; byAccept: number; final: number; reason: string } {
  const info = KIND_BY_KEY[kind];
  const rate = Number(rateMap[kind]) || info?.rate || 1;
  const num = String(number).replace(/\D/g, '');
  const { byNumber } = summarizeExposure(existing, rateMap);
  const prev = byNumber.get(`${kind}|${num}`) || { accepted: 0, payout: 0 };

  // จากเพดานจ่าย
  const payoutHeadroom = limits.maxPayoutPerNumber - prev.payout;
  const byPayout = Math.max(0, Math.floor(payoutHeadroom / rate));

  // จากเพดานรับ
  const byAccept = Math.max(0, limits.maxAcceptPerNumber - prev.accepted);

  const final = Math.min(byPayout, byAccept);
  const limiting = byPayout <= byAccept ? 'เพดานจ่าย' : 'เพดานรับ';

  return {
    byPayout,
    byAccept,
    final,
    reason: final <= 0
      ? `รับครบเพดานแล้ว (${limiting})`
      : `รับได้อีก ${fmtMoney(final)} บาท (จำกัดโดย${limiting})`,
  };
}

// ============================================================
// 12. แนะนำเพดานอัตโนมัติ
// ============================================================

/**
 * แนะนำเพดานจากกำไรเป้าหมาย
 * เช่น อยากได้กำไร 20% และคาดว่ารับแทงรอบละ 100,000 → เพดานจ่ายไม่ควรเกิน 80,000
 */
export function suggestLimits(
  expectedTurnover: number,
  targetMarginPercent: number,
  bankrollReserve = DEFAULT_RISK_LIMITS.bankrollReserve,
): { limits: RiskLimits; note: string } {
  const margin = Math.max(0, Math.min(95, targetMarginPercent)) / 100;
  const maxPayout = Math.floor(expectedTurnover * (1 - margin));

  return {
    limits: {
      ...DEFAULT_RISK_LIMITS,
      maxPayoutPerRound: maxPayout,
      maxPayoutPerNumber: Math.floor(maxPayout * 0.25),
      maxPayoutPerPlayer: Math.floor(maxPayout * 0.15),
      maxAcceptPerNumber: Math.floor(expectedTurnover * 0.1),
      bankrollReserve,
    },
    note:
      `รับแทงคาด ${fmtInt(expectedTurnover)} กำไรเป้า ${targetMarginPercent}% → ` +
      `เพดานจ่ายต่อรอบ ${fmtInt(maxPayout)} ต่อเลข ${fmtInt(Math.floor(maxPayout * 0.25))}`,
  };
}

// ============================================================
// 13. ตัวช่วยแสดงสี
// ============================================================

export const RISK_STYLE: Record<RiskLevel, { bg: string; border: string; text: string; label: string; icon: string }> = {
  ok:    { bg: '#eef7ef', border: '#c3e0c5', text: '#2e7d32', label: 'ปกติ',     icon: 'check_circle' },
  warn:  { bg: '#fdf6e3', border: '#f0dfae', text: '#8a6a1f', label: 'ควรระวัง', icon: 'warning' },
  block: { bg: '#fdf0ee', border: '#f0cdc8', text: '#b3261e', label: 'บล็อก',    icon: 'block' },
};

/** สรุปข้อความสั้น ๆ ของรายงาน */
export function riskSummary(rep: RiskReport): string {
  if (rep.blocked) return `⛔ บล็อก — ${rep.messages[0] || 'เกินเพดาน'}`;
  if (rep.level === 'warn') return `⚠️ ควรระวัง — ${rep.messages[0] || 'ใกล้เพดาน'}`;
  return `✅ ปกติ — เสี่ยงจ่ายหนักสุด ${fmtInt(rep.round.worstCasePayout)} บาท`;
}
