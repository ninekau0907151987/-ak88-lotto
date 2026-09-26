/**
 * src/shared/lib/betCount.ts
 * ------------------------------------------------------------------
 * ★ นับจำนวนตัวเลขในรายการที่รอการแทง — ตรรกะเดียว ใช้ได้ทุกหน้า ★
 *
 * ปัญหาเดิม: แต่ละหน้า (LotteryBet / LotterySetBet) นับจำนวนกันเอง
 *            และนับไม่ตรงกัน → ผู้ใช้สับสนว่า "กี่ตัวแล้ว"
 *
 * กติกาการนับ (ตามที่ผู้ใช้กำหนด):
 *   1. 1 บรรทัด = 1 ตัวเลข (ไม่ซ้ำกัน) → ที่กด 3 ตัว ก็คือ 3 ตัว
 *   2. ถ้ากดเลขเดิมซ้ำ → ยังนับเป็นตัวเดียว (ตัวเลขไม่เพิ่ม) แต่ยอดเงินเพิ่ม
 *   3. แยกนับ "ตามประเภท" เพราะ 123 ตัวบน กับ 123 ตัวล่าง คนละรายการ
 *   4. ตัวเลขที่มาจาก "รูดหน้า/รูดหลัง/19ประตู/กลับ" จะถูกขยายเป็นหลายตัวก่อน
 *      → ต้องนับตามจำนวนที่ขยายออกมาแล้ว
 *
 * ตัวอย่าง:
 *   กด 123 (3ตัวบน)  → ตัวบน 3 ตัว   รวม 3 ตัว
 *   กด 112 (3ตัวบน)  → ตัวบน 3 ตัว   รวม 6 ตัว  (1,1,2 → 112 นับเป็น 1 ตัวเลข)
 *   ─ ความหมาย "ตัว" = "จำนวนรายการตัวเลข" ไม่ใช่ "จำนวนหลักที่พิมพ์"
 */

export interface CountableBet {
  number: string;
  type: string;
  amount: number;
  payoutRate?: number;
  isSpecial?: boolean;
  isReduced?: boolean;
  id?: string;
}

export interface TypeBreakdown {
  /** ประเภทการเล่น เช่น '3 ตัวบน' */
  type: string;
  /** จำนวนตัวเลข (ไม่ซ้ำ) ในประเภทนี้ */
  count: number;
  /** ยอดเงินรวมของประเภทนี้ */
  amount: number;
  /** รายการตัวเลขทั้งหมด (เรียงตามที่เพิ่ม) */
  numbers: string[];
  /** เลขที่มีซ้ำในรายการนี้ (ผู้ใช้กดซ้ำ) */
  duplicates: string[];
  /** เลขที่ถูกอั้น/ตัดราคา */
  flagged: { number: string; reason: 'special' | 'reduced' }[];
}

export interface BetCountSummary {
  /** ★ จำนวนตัวเลขที่รอการแทงทั้งหมด (ตัวชี้วัดหลัก) */
  totalNumbers: number;
  /** จำนวนรายการทั้งหมด (นับซ้ำแยก) */
  totalEntries: number;
  /** ยอดเงินรวมทั้งหมด */
  totalAmount: number;
  /** ยอดเงินรางวัลสูงสุดที่เป็นไปได้ (ประมาณ) */
  maxPayout: number;
  /** แยกละเอียดตามประเภท */
  byType: TypeBreakdown[];
  /** จำนวนเลขซ้ำทั้งหมด (นับส่วนเกิน) */
  duplicateCount: number;
  /** จำนวนประเภทที่เลือกอยู่ */
  typeCount: number;
}

/**
 * นับรายการที่รอการแทง
 * @param bets รายการโพยที่เลือกไว้
 */
export function countBets(bets: CountableBet[]): BetCountSummary {
  const groupMap = new Map<string, CountableBet[]>();

  for (const bet of bets || []) {
    const type = String(bet?.type ?? 'ไม่ระบุ');
    if (!groupMap.has(type)) groupMap.set(type, []);
    groupMap.get(type)!.push(bet);
  }

  const byType: TypeBreakdown[] = [];
  let totalNumbers = 0;
  let totalEntries = 0;
  let totalAmount = 0;
  let maxPayout = 0;
  let duplicateCount = 0;

  for (const [type, list] of groupMap) {
    // นับตัวเลขไม่ซ้ำ — ใช้ Map เพื่อรักษาลำดับที่เข้ามาและนับซ้ำได้
    const seenCount = new Map<string, number>();
    const ordered: string[] = [];
    const duplicates: string[] = [];
    const flagged: { number: string; reason: 'special' | 'reduced' }[] = [];
    let amount = 0;
    let typeMaxPayout = 0;

    for (const b of list) {
      const num = String(b.number ?? '');
      const amt = Number(b.amount) || 0;
      amount += amt;
      typeMaxPayout += amt * (Number(b.payoutRate) || 0);

      if (!seenCount.has(num)) {
        seenCount.set(num, 1);
        ordered.push(num);
      } else {
        seenCount.set(num, seenCount.get(num)! + 1);
        if (!duplicates.includes(num)) duplicates.push(num);
      }

      // เลขพิเศษ/ลดราคา — รายงานให้ผู้ใช้เห็น
      if (b.isSpecial && !flagged.some(f => f.number === num && f.reason === 'special')) {
        flagged.push({ number: num, reason: 'special' });
      } else if (b.isReduced && !flagged.some(f => f.number === num && f.reason === 'reduced')) {
        flagged.push({ number: num, reason: 'reduced' });
      }
    }

    // นับซ้ำ = รายการทั้งหมด - ตัวเลขไม่ซ้ำ
    const dupInType = list.length - ordered.length;
    duplicateCount += dupInType;

    byType.push({
      type,
      count: ordered.length,
      amount,
      numbers: ordered,
      duplicates,
      flagged,
    });

    totalNumbers += ordered.length;
    totalEntries += list.length;
    totalAmount += amount;
    maxPayout += typeMaxPayout;
  }

  // เรียงตามยอดเงินมากไปน้อย — ประเภทที่ลงเยอะอยู่บน
  byType.sort((a, b) => b.amount - a.amount);

  return {
    totalNumbers,
    totalEntries,
    totalAmount,
    maxPayout,
    byType,
    duplicateCount,
    typeCount: byType.length,
  };
}

/** จัดรูปแบบตัวเลขเงินแบบไทย */
export function fmtMoney(n: number, digits = 2): string {
  return (Number(n) || 0).toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** จัดรูปแบบจำนวนเต็มแบบมีคอมมา */
export function fmtInt(n: number): string {
  return (Number(n) || 0).toLocaleString('th-TH');
}
