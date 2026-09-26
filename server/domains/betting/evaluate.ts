/**
 * server/domains/betting/evaluate.ts
 * ------------------------------------------------------------------
 * ตรรกะตรวจรางวัล — แยกออกจาก route เพื่อ
 *   1. ทดสอบได้โดยไม่ต้องมี DB
 *   2. แก้กติกาหวยที่เดียว
 *   3. เพิ่มประเภทหวยใหม่ได้โดยไม่แตะ route
 *
 * ★ หมายเหตุ: ไฟล์นี้เป็นฟังก์ชันบริสุทธิ์ (pure) — ห้ามเรียก DB ในนี้
 */

export type BetType =
  | '3ตัวบน' | '3ตัวโต๊ด' | '2ตัวบน' | '2ตัวล่าง'
  | 'วิ่งบน' | 'วิ่งล่าง'
  | string;

export interface LotteryResult {
  top3?: string;
  top2?: string;
  bottom2?: string;
  bottom3?: string;
  /** ผลหวยชุดอื่น ๆ (ยี่กี/หุ้น) ส่งเข้ามาได้ */
  [k: string]: unknown;
}

export interface EvalBet {
  number: string;
  type: BetType;
  amount: number;
  rate?: number;
}

export interface EvalDetail {
  number: string;
  type: string;
  amount: number;
  rate: number;
  won: boolean;
  winAmount: number;
  reason?: string;
}

const norm = (v: unknown) => String(v ?? '').replace(/\D/g, '');

/** เรียงหลักของเลข 3 ตัว — ใช้เทียบแบบโต๊ด */
const sorted = (s: string) => s.split('').sort().join('');

/** เลขท้าย 3 ตัว / 2 ตัว ของสตริง */
const tail = (s: string, n: number) => (s.length >= n ? s.slice(-n) : '');

/**
 * ตรวจโพย 1 ใบเทียบกับผลรางวัล
 * @returns ยอดเงินรางวัลรวม + รายละเอียดแต่ละรายการ
 */
export function evaluateTicket(
  bets: EvalBet[],
  result: LotteryResult,
  rates: Record<string, number> = {},
): { payout: number; details: EvalDetail[] } {
  const top3 = norm(result.top3);
  const top2 = norm(result.top2);
  const bottom2 = norm(result.bottom2);
  const bottom3 = norm(result.bottom3);

  let payout = 0;
  const details: EvalDetail[] = [];

  for (const b of bets || []) {
    const num = norm(b.number);
    const amount = Number(b.amount) || 0;
    // อัตราจ่าย: ใช้ที่ส่งมากับโพยก่อน ถ้าไม่มีใช้จากตาราง rates
    const rate = Number(b.rate) || Number(rates[b.type]) || 0;

    let won = false;
    let reason = '';

    switch (b.type) {
      case '3ตัวบน':
        won = top3 !== '' && num === top3;
        break;

      case '3ตัวโต๊ด':
        won = top3 !== '' && num.length === 3 && sorted(num) === sorted(top3);
        if (won) reason = `สลับหลักตรงกับ ${top3}`;
        break;

      case '2ตัวบน':
        // 2 ตัวบน เทียบกับ 2 ตัวท้ายของรางวัลที่ 1
        won = top2 !== '' && num === top2;
        break;

      case '2ตัวล่าง':
        won = bottom2 !== '' && num === bottom2;
        break;

      case '3ตัวล่าง':
        won = bottom3 !== '' && num === bottom3;
        break;

      case 'วิ่งบน':
        // วิ่งบน = เลข 1 หลัก ปรากฏอยู่ที่ใดก็ได้ใน 3 ตัวบน
        won = num.length === 1 && top3.includes(num);
        if (won) reason = `เลข ${num} อยู่ใน ${top3}`;
        break;

      case 'วิ่งล่าง':
        won = num.length === 1 && (bottom2.includes(num) || tail(top3, 2).includes(num));
        break;

      case '19 ประตู':
        // 19 ประตู = 2 ตัวใด ๆ ที่มีเลขในชุดที่เลือก — ตรวจว่าทั้ง 2 ตัวอยู่ใน 2 ตัวล่าง
        won = num.length === 2 && tail(bottom2, 2) !== '' &&
              bottom2.split('').every(c => num.includes(c));
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

/**
 * ตรวจโพยทั้งชุด — คืนยอดรวมและสรุป
 */
export function evaluateTickets(
  tickets: Array<{ id: string; bets: EvalBet[]; totalAmount: number; userId: string }>,
  result: LotteryResult,
  rates: Record<string, number> = {},
) {
  const items = tickets.map(t => {
    const { payout, details } = evaluateTicket(t.bets || [], result, rates);
    return {
      ticketId: t.id,
      userId: t.userId,
      betTotal: Number(t.totalAmount) || 0,
      payout,
      won: payout > 0,
      details,
    };
  });

  const totalBet = items.reduce((s, i) => s + i.betTotal, 0);
  const totalPayout = items.reduce((s, i) => s + i.payout, 0);

  return {
    items,
    summary: {
      tickets: items.length,
      winCount: items.filter(i => i.won).length,
      loseCount: items.filter(i => !i.won).length,
      totalBet,
      totalPayout,
      profit: totalBet - totalPayout,
    },
  };
}
