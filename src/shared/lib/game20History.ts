/**
 * src/shared/lib/game20History.ts
 * ------------------------------------------------------------------
 * ★ ประวัติ + รหัส สำหรับหวย 20 ช่อง 6 หลัก ★
 *
 * ผู้ใช้ขอ: "ทำประวัติให้ด้วยครับ จะได้ครบ แก้ไข รหัสอื่นๆ"
 *
 * ครอบคลุม:
 *   1. ประวัติการออกผล — ทุกครั้งที่ปิดรอบ (ใครทำ ทำไม ใช้ seed อะไร)
 *   2. ประวัติผลย้อนหลัง — ดูแนวโน้ม/สถิติ
 *   3. ★ แก้ไขรหัสผล — แก้ผลย้อนหลังได้ (พร้อมบันทึกว่าทำไม)
 *   4. ประวัติการแก้ไข — audit trail ทุกการเปลี่ยนแปลง
 *   5. ค้นหา/กรอง/ส่งออก
 * ==================================================================
 */
import {
  computeResult, formatResult, evaluateBets20, padNum, digitsOnly,
  SLOT_COUNT, RESULT_MODULO, type Bet20,
} from './lottery20';

/* ==================================================================
 * 1. ประเภทของเหตุการณ์ในประวัติ
 * ================================================================== */

export type HistoryAction =
  | 'close_round'      // ปิดรอบออกผล
  | 'edit_result'      // ★ แก้ไขรหัสผล
  | 'recompute'        // คำนวณใหม่
  | 'bot_config'       // แก้ค่าบอท
  | 'rate_change'      // แก้ราคาจ่าย
  | 'config_change'    // แก้ค่าตั้งต้น
  | 'unlock'           // ปลดล็อกรอบ
  | 'delete';          // ลบรอบ

export interface HistoryEntry {
  id: string;
  /** ประเภทเหตุการณ์ */
  action: HistoryAction;
  /** รอบที่เกี่ยวข้อง */
  roundId: string;
  /** ผลก่อนหน้า (ถ้าเป็นการแก้) */
  resultBefore?: string;
  /** ผลหลังแก้ */
  resultAfter?: string;
  /** เลข 20 ช่องก่อน/หลัง */
  slotsBefore?: string[];
  slotsAfter?: string[];
  /** เหตุผลการแก้ */
  reason?: string;
  /** ใครทำ */
  actor: string;
  /** ตำแหน่ง/role ของคนทำ */
  actorRole?: string;
  /** เมื่อไหร่ */
  at: string;
  /** ข้อมูลเพิ่มเติม */
  meta?: Record<string, unknown>;
  /** ★ ลายนิ้วมือกันแก้ย้อนหลัง — hash ของเนื้อหา */
  checksum?: string;
}

export const ACTION_LABEL: Record<HistoryAction, string> = {
  close_round: 'ปิดรอบออกผล',
  edit_result: 'แก้ไขรหัสผล',
  recompute: 'คำนวณใหม่',
  bot_config: 'แก้ค่าบอท',
  rate_change: 'แก้ราคาจ่าย',
  config_change: 'แก้ค่าตั้งต้น',
  unlock: 'ปลดล็อกรอบ',
  delete: 'ลบรอบ',
};

export const ACTION_TONE: Record<HistoryAction, string> = {
  close_round: 'success',
  edit_result: 'warning',
  recompute: 'info',
  bot_config: 'purple',
  rate_change: 'orange',
  config_change: 'slate',
  unlock: 'warning',
  delete: 'danger',
};

/* ==================================================================
 * 2. บันทึกประวัติ
 * ================================================================== */

/** สร้าง checksum แบบง่าย — ตรวจจับการแก้ข้อมูลย้อนหลัง */
function checksum(parts: unknown[]): string {
  const str = JSON.stringify(parts);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).toUpperCase();
}

/**
 * ★ ลบ field ที่เป็น undefined ออก
 * ------------------------------------------------------------------
 * Firestore ปฏิเสธ field ที่มีค่า undefined (ต่างจาก object ปกติ)
 * ต้องทำความสะอาดก่อนเขียนทุกครั้ง
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = stripUndefined(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

/** สร้างรายการประวัติ 1 รายการ */
export function makeHistoryEntry(input: {
  action: HistoryAction;
  roundId: string;
  actor: string;
  actorRole?: string;
  resultBefore?: string;
  resultAfter?: string;
  slotsBefore?: string[];
  slotsAfter?: string[];
  reason?: string;
  meta?: Record<string, unknown>;
  at?: string;
}): HistoryEntry {
  const at = input.at || new Date().toISOString();
  // ★ ห้าม spread input ตรงๆ — จะพา undefined เข้า Firestore
  const entry: HistoryEntry = stripUndefined({
    id: `h_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    action: input.action,
    roundId: input.roundId,
    actor: input.actor,
    actorRole: input.actorRole,
    resultBefore: input.resultBefore,
    resultAfter: input.resultAfter,
    slotsBefore: input.slotsBefore,
    slotsAfter: input.slotsAfter,
    reason: input.reason,
    meta: input.meta,
    at,
  }) as HistoryEntry;
  entry.checksum = checksum([
    entry.action, entry.roundId, entry.resultBefore, entry.resultAfter,
    entry.actor, entry.at, entry.reason,
  ]);
  return entry;
}

/** ตรวจว่ารายการประวัติถูกแก้หรือไม่ */
export function verifyHistoryEntry(e: HistoryEntry): boolean {
  if (!e.checksum) return true;  // ข้อมูลเก่า — ไม่มี checksum
  const expect = checksum([
    e.action, e.roundId, e.resultBefore, e.resultAfter, e.actor, e.at, e.reason,
  ]);
  return expect === e.checksum;
}

/* ==================================================================
 * 3. ★ แก้ไขรหัสผล (edit result)
 * ================================================================== */

export interface EditResultInput {
  /** รอบที่จะแก้ */
  roundId: string;
  /** ผลใหม่ (6 หลัก) */
  newResult: string;
  /** เลข 20 ช่องใหม่ — ถ้าไม่ให้ จะคำนวณจากผลให้ */
  newSlots?: string[];
  /** ★ ต้องระบุเหตุผลเสมอ (ตรวจสอบย้อนหลังได้) */
  reason: string;
  actor: string;
  actorRole?: string;
  /** โพยของรอบ (เพื่อคำนวณเงินใหม่) */
  bets?: Bet20[];
  rates?: Record<string, number>;
}

export interface EditResultOutput {
  ok: boolean;
  /** ผลเก่า */
  resultBefore: string;
  /** ผลใหม่ */
  resultAfter: string;
  /** เลข 20 ช่องใหม่ */
  slots: string[];
  /** ★ ตรวจว่าเลขที่ให้ผลตรงจริง */
  verified: boolean;
  /** เงินก่อนแก้ */
  economicsBefore?: { totalBet: number; payout: number; profit: number; winCount: number };
  /** เงินหลังแก้ */
  economicsAfter?: { totalBet: number; payout: number; profit: number; winCount: number };
  /** รายการประวัติที่ต้องบันทึก */
  history: HistoryEntry;
  /** คำเตือน */
  warnings: string[];
  error?: string;
}

/**
 * ★ เตรียมการแก้ไขผลหวยย้อนหลัง
 *
 * ฟังก์ชันนี้ "ตรวจสอบ + เตรียมข้อมูล" ไม่เขียน DB เอง
 * คนเรียก (route) จะเอาผลไปบันทึก
 *
 * กันพลาด:
 *   - ผลใหม่ต้องเป็นตัวเลข 6 หลัก
 *   - ถ้าส่ง slots มาด้วย ต้องคำนวณได้ผลตรงกับ newResult
 *   - ต้องมีเหตุผล
 *   - รอบต้องมีอยู่จริง
 *   - คำนวณเงินก่อน/หลังให้เห็นผลกระทบ
 */
export function prepareEditResult(
  round: { roundId: string; result?: string; slots?: string[]; resultLocked?: boolean },
  input: EditResultInput,
): EditResultOutput {
  const warnings: string[] = [];
  const resultBefore = round.result || '';
  const cleanNew = digitsOnly(input.newResult).padStart(6, '0').slice(-6);

  const fail = (error: string): EditResultOutput => ({
    ok: false,
    resultBefore,
    resultAfter: cleanNew,
    slots: [],
    verified: false,
    history: makeHistoryEntry({
      action: 'edit_result', roundId: input.roundId, actor: input.actor,
      actorRole: input.actorRole, resultBefore, resultAfter: cleanNew,
      reason: input.reason, meta: { failed: true, error },
    }),
    warnings,
    error,
  });

  // ---- ตรวจพื้นฐาน ----
  if (!round.roundId) return fail('ไม่พบรอบที่ต้องการแก้');
  if (!round.result && !round.slots) return fail('รอบนี้ยังไม่มีผลให้แก้');
  if (!digitsOnly(input.newResult)) return fail('ผลใหม่ต้องเป็นตัวเลขเท่านั้น');
  if (cleanNew.length !== 6) return fail('ผลใหม่ต้องมี 6 หลัก');
  if (!input.reason || input.reason.trim().length < 3) return fail('★ ต้องระบุเหตุผลการแก้ (อย่างน้อย 3 ตัวอักษร)');
  if (!input.actor) return fail('ต้องระบุผู้แก้ไข');
  if (cleanNew === resultBefore) {
    warnings.push('ผลใหม่เหมือนผลเดิม — ไม่มีอะไรเปลี่ยน');
  }

  // ---- ★ ถ้ามี slots ส่งมา ต้องตรวจว่าตรงกับผลใหม่ ----
  let slots = input.newSlots ? [...input.newSlots] : [];
  let verified = false;

  if (slots.length === SLOT_COUNT) {
    const c = computeResult(slots);
    verified = c.result === cleanNew;
    if (!verified) {
      return fail(`เลข 20 ช่องที่ให้มาให้ผล ${c.result} ไม่ตรงกับผลใหม่ ${cleanNew}`);
    }
  } else if (slots.length > 0) {
    return fail(`ต้องส่ง slots ให้ครบ ${SLOT_COUNT} ช่อง (ส่งมา ${slots.length})`);
  } else {
    // ไม่ส่ง slots → ไม่มีเลข 20 ช่อง (แก้แค่ผล)
    warnings.push('ไม่ได้ระบุเลข 20 ช่อง — แก้เฉพาะผลลัพธ์');
    verified = true;
  }

  // ---- ★ คำนวณผลกระทบทางการเงิน ----
  let economicsBefore, economicsAfter;
  const rates = input.rates || {};
  if (input.bets?.length) {
    const totalBet = input.bets.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    if (resultBefore) {
      const before = evaluateBets20(input.bets, resultBefore, rates);
      economicsBefore = {
        totalBet,
        payout: before.payout,
        profit: totalBet - before.payout,
        winCount: before.details.filter(d => d.won).length,
      };
    }
    const after = evaluateBets20(input.bets, cleanNew, rates);
    economicsAfter = {
      totalBet,
      payout: after.payout,
      profit: totalBet - after.payout,
      winCount: after.details.filter(d => d.won).length,
    };

    if (economicsBefore && economicsAfter) {
      const diff = economicsAfter.payout - economicsBefore.payout;
      if (Math.abs(diff) > 0) {
        warnings.push(
          diff > 0
            ? `⚠️ ต้องจ่ายเพิ่ม ฿${diff.toLocaleString()} (${economicsAfter.winCount - economicsBefore.winCount} คนเพิ่ม)`
            : `✅ ประหยัดได้ ฿${Math.abs(diff).toLocaleString()}`,
        );
      }
      if (economicsAfter.profit < 0) {
        warnings.push(`🔴 หลังแก้จะขาดทุน ฿${Math.abs(economicsAfter.profit).toLocaleString()}`);
      }
    }
  }

  if (round.resultLocked) {
    warnings.push('🔴 รอบนี้ล็อกผลแล้ว — ต้องปลดล็อกก่อนจึงจะแก้ได้');
  }

  return {
    ok: !round.resultLocked,
    resultBefore,
    resultAfter: cleanNew,
    slots,
    verified,
    economicsBefore,
    economicsAfter,
    history: makeHistoryEntry({
      action: 'edit_result',
      roundId: input.roundId,
      actor: input.actor,
      actorRole: input.actorRole,
      resultBefore,
      resultAfter: cleanNew,
      slotsBefore: round.slots,
      slotsAfter: slots.length ? slots : undefined,
      reason: input.reason,
      meta: { economicsBefore, economicsAfter },
    }),
    warnings,
    error: round.resultLocked ? 'รอบถูกล็อก — ต้องปลดล็อกก่อน' : undefined,
  };
}

/* ==================================================================
 * 4. ★ แก้ไข "รหัส" อื่นๆ (ตั้งค่า/รหัสผล/รหัสผ่านพนักงาน)
 * ------------------------------------------------------------------
 * ผู้ใช้ขอ: "แก้ไข รหัสอื่นๆ"
 * ================================================================== */

export type CodeKind =
  | 'result_lock'    // รหัสล็อกผล
  | 'round_code'     // รหัสรอบ
  | 'admin_code'     // รหัสผู้ดูแล
  | 'open_close'     // รหัสเปิด/ปิดรอบ
  | 'custom';        // กำหนดเอง

export interface CodeEntry {
  id: string;
  kind: CodeKind;
  /** ชื่อที่แสดง */
  label: string;
  /** ★ ค่ารหัส — เก็บเฉพาะ hash ในที่ที่แสดง ไม่โชว์ค่าจริง */
  valueHash: string;
  /** ความยาว */
  length: number;
  /** ใช้ได้กี่ครั้ง (0 = ไม่จำกัด) */
  maxUses: number;
  usedCount: number;
  /** หมดอายุ */
  expiresAt?: string | null;
  /** เปิด/ปิด */
  active: boolean;
  /** หมายเหตุ */
  note?: string;
  createdAt: string;
  createdBy: string;
  lastUsedAt?: string | null;
}

export const CODE_KIND_LABEL: Record<CodeKind, string> = {
  result_lock: 'รหัสล็อกผล',
  round_code: 'รหัสรอบ',
  admin_code: 'รหัสผู้ดูแล',
  open_close: 'รหัสเปิด/ปิดรอบ',
  custom: 'กำหนดเอง',
};

/**
 * ★ สร้างรหัสใหม่ (hash ด้านเดียว — ไม่เก็บค่าจริง)
 * @returns entry + ค่ารหัสจริง (โชว์ครั้งเดียว ห้ามเก็บ)
 */
export function generateCode(input: {
  kind: CodeKind;
  label: string;
  length?: number;
  maxUses?: number;
  expiresInDays?: number | null;
  note?: string;
  createdBy: string;
  /** ใช้ตัวอักษรด้วยไหม */
  alphanumeric?: boolean;
}): { code: string; entry: CodeEntry } {
  const len = Math.max(4, Math.min(input.length ?? 6, 32));
  const alpha = input.alphanumeric ? 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' : '0123456789';
  let code = '';
  for (let i = 0; i < len; i++) {
    code += alpha[Math.floor(Math.random() * alpha.length)];
  }
  const now = new Date();
  // ★ stripUndefined — note อาจเป็น undefined ซึ่ง Firestore ไม่รับ
  const entry = stripUndefined({
    id: `code_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    kind: input.kind,
    label: input.label,
    valueHash: hashCode(code),
    length: len,
    maxUses: input.maxUses ?? 0,
    usedCount: 0,
    expiresAt: input.expiresInDays
      ? new Date(now.getTime() + input.expiresInDays * 86400000).toISOString()
      : null,
    active: true,
    note: input.note,
    createdAt: now.toISOString(),
    createdBy: input.createdBy,
    lastUsedAt: null,
  }) as CodeEntry;
  return { code, entry };
}

/** hash รหัส — เก็บแค่ hash ไม่เก็บค่าจริง */
export function hashCode(code: string): string {
  let h = 0x811c9dc5;
  const s = `ak88::${code.trim()}`;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  }
  return `A${h.toString(16).padStart(8, '0').toUpperCase()}`;
}

/** ตรวจรหัสว่าตรงไหม */
export function verifyCode(code: string, entry: CodeEntry): {
  ok: boolean; reason?: string;
} {
  if (!entry.active) return { ok: false, reason: 'รหัสถูกปิดใช้งาน' };
  if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
    return { ok: false, reason: 'รหัสหมดอายุแล้ว' };
  }
  if (entry.maxUses > 0 && entry.usedCount >= entry.maxUses) {
    return { ok: false, reason: `รหัสใช้ครบ ${entry.maxUses} ครั้งแล้ว` };
  }
  if (hashCode(code) !== entry.valueHash) return { ok: false, reason: 'รหัสไม่ถูกต้อง' };
  return { ok: true };
}

/* ==================================================================
 * 5. กรอง / ค้นหา / ส่งออก ประวัติ
 * ================================================================== */

export interface HistoryFilter {
  /** คำค้น — ตรงกับ roundId / actor / reason / ผลลัพธ์ */
  q?: string;
  /** กรองตามประเภท */
  actions?: HistoryAction[];
  /** กรองตามคนทำ */
  actor?: string;
  /** ช่วงวันที่ */
  from?: string;
  to?: string;
  /** เฉพาะที่มีการแก้รหัส */
  onlyEdits?: boolean;
}

export function filterHistory(list: HistoryEntry[], f: HistoryFilter = {}): HistoryEntry[] {
  let out = [...list];

  if (f.q) {
    const q = f.q.toLowerCase().trim();
    out = out.filter(e =>
      e.roundId.toLowerCase().includes(q) ||
      e.actor.toLowerCase().includes(q) ||
      (e.reason || '').toLowerCase().includes(q) ||
      (e.resultBefore || '').includes(q) ||
      (e.resultAfter || '').includes(q) ||
      ACTION_LABEL[e.action].toLowerCase().includes(q),
    );
  }
  if (f.actions?.length) out = out.filter(e => f.actions!.includes(e.action));
  if (f.actor) out = out.filter(e => e.actor === f.actor);
  if (f.onlyEdits) out = out.filter(e => e.action === 'edit_result');
  if (f.from) out = out.filter(e => e.at >= f.from!);
  if (f.to) out = out.filter(e => e.at <= f.to!);

  // ใหม่สุดก่อน
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** สรุปสถิติของประวัติ */
export function historyStats(list: HistoryEntry[]) {
  const byAction: Record<string, number> = {};
  list.forEach(e => { byAction[e.action] = (byAction[e.action] || 0) + 1; });
  const actors = [...new Set(list.map(e => e.actor))];
  const cracked = list.filter(e => !verifyHistoryEntry(e));

  return {
    total: list.length,
    byAction,
    byActionLabel: Object.fromEntries(
      Object.entries(byAction).map(([k, v]) => [ACTION_LABEL[k as HistoryAction] || k, v]),
    ),
    actors,
    actorCount: actors.length,
    edits: byAction.edit_result || 0,
    /** ★ รายการที่ checksum ไม่ตรง = อาจถูกแก้ข้อมูล */
    tampered: cracked.length,
    tamperedIds: cracked.map(e => e.id),
    firstAt: list.length ? list[list.length - 1].at : null,
    lastAt: list.length ? list[0].at : null,
  };
}

/** ส่งออกเป็น CSV (มี BOM ให้ Excel อ่านไทยได้) */
export function historyToCsv(list: HistoryEntry[]): string {
  const head = ['เวลา', 'การกระทำ', 'รอบ', 'ผลก่อน', 'ผลหลัง', 'เหตุผล', 'ผู้ทำ', 'role', 'checksum'];
  const rows = list.map(e => [
    new Date(e.at).toLocaleString('th-TH'),
    ACTION_LABEL[e.action],
    e.roundId,
    e.resultBefore ? formatResult(e.resultBefore) : '',
    e.resultAfter ? formatResult(e.resultAfter) : '',
    e.reason || '',
    e.actor,
    e.actorRole || '',
    verifyHistoryEntry(e) ? '✓' : '⚠️ ถูกแก้',
  ]);
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  return '\uFEFF' + [head, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
}

/* ==================================================================
 * 6. ★ สถิติผลย้อนหลัง (สำหรับหน้าประวัติ)
 * ================================================================== */

export interface RoundSummary {
  roundId: string;
  result: string;
  closedAt: string;
  totalBet: number;
  payout: number;
  profit: number;
  winCount: number;
  mode: string;
}

export function analyzeHistory(rounds: RoundSummary[]) {
  if (!rounds.length) {
    return {
      count: 0, totalBet: 0, totalPayout: 0, profit: 0, profitPercent: 0,
      winRate: 0, digitFrequency: Array(10).fill(0), top3Freq: [] as [string, number][],
      byMode: {} as Record<string, number>, best: null, worst: null, streak: 0,
    };
  }

  const totalBet = rounds.reduce((s, r) => s + r.totalBet, 0);
  const totalPayout = rounds.reduce((s, r) => s + r.payout, 0);

  // ★ ความถี่ของแต่ละหลัก (0-9) ในทุกตำแหน่ง
  const digitFrequency = Array(10).fill(0);
  rounds.forEach(r => {
    digitsOnly(r.result).split('').forEach(d => { digitFrequency[Number(d)]++; });
  });

  // ★ ความถี่ของ 3 ตัวท้าย
  const t3 = new Map<string, number>();
  rounds.forEach(r => {
    const k = digitsOnly(r.result).slice(-3);
    t3.set(k, (t3.get(k) || 0) + 1);
  });
  const top3Freq = [...t3.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const byMode: Record<string, number> = {};
  rounds.forEach(r => { byMode[r.mode] = (byMode[r.mode] || 0) + 1; });

  const sorted = [...rounds].sort((a, b) => b.profit - a.profit);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  // ★ นับสตรีค "ไม่มีผู้ชนะ" ต่อเนื่อง
  let streak = 0;
  for (const r of [...rounds].sort((a, b) => b.closedAt.localeCompare(a.closedAt))) {
    if (r.winCount === 0) streak++; else break;
  }

  return {
    count: rounds.length,
    totalBet,
    totalPayout,
    profit: totalBet - totalPayout,
    profitPercent: totalBet ? ((totalBet - totalPayout) / totalBet) * 100 : 0,
    winRate: rounds.length ? (rounds.filter(r => r.winCount > 0).length / rounds.length) * 100 : 0,
    digitFrequency,
    top3Freq,
    byMode,
    best,
    worst,
    streak,
  };
}
