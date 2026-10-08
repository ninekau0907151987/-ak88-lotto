/**
 * src/shared/lib/lotteryRates.ts
 * =====================================================================
 * ตารางอัตราจ่ายและส่วนลดมาตรฐานกลาง (Central Master Rates & Discounts)
 * ออกแบบตามสเปกและรูปเรฟผู้ใช้ 100%:
 *
 * ลำดับ | ชนิด          | จ่าย    | ลด (%)
 * ---------------------------------------
 * 1.    | 2 ตัวบน      | 90.00   | 0
 * 2.    | 3 ตัวบน      | 900.00  | 0
 * 3.    | 3 ตัวโต๊ด     | 150.00  | 0
 * 4.    | 2 ตัวโต๊ด     | 13.00   | 0
 * 5.    | วิ่งบน        | 3.20    | 0
 * 6.    | วิ่งล่าง       | 4.20    | 0
 * 7.    | 2 ตัวล่าง     | 90.00   | 0
 * 8.    | 3 ตัวล่าง     | 450.00  | 0
 * 9.    | 4 ตัวบน      | 4000.00 | 0
 * 10.   | 4 ตัวโต๊ด     | 25.00   | 0
 * 11.   | 5 ตัวโต๊ด     | 15.00   | 0
 * 12.   | ปักหลักหน่วย   | 8.00    | 0
 * 13.   | ปักหลักสิบ    | 8.00    | 0
 * 14.   | ปักหลักร้อย    | 8.00    | 0
 *
 * กฎกติกาตามคำสั่งผู้ใช้:
 * 1. "หวยไทย เป็นหวยหลัก มีครบ 14 ประเภทการจ่าย"
 *    -> หวยรัฐบาลไทย มีครบทั้ง 14 ชนิด (รวม No. 3: 3 ตัวล่าง และ No. 11: 5 ตัวโต๊ด)
 * 2. "เพิ่มยี่กี่ด้วย 12 ประเภท / หวยอื่นๆ ไม่มี 3ตัวล่าง กับ 5ตัวโต๊ด"
 *    -> หวยยี่กี, หวยลาว, หวยฮานอย, หวยมาเลย์, หวยหุ้น ไม่มี '3 ตัวล่าง' และ '5 ตัวโต๊ด' (เหลือ 12 ชนิด)
 * 3. "ช่วยทำหลังบ้านหน้าบ้านให้ สอดคลองกันด้วยครับ ออกแบบให้เพิ่มลดได้ มาจากการคำนวนจริงๆ"
 *    -> หลังบ้านแก้ไข จ่าย/ลด ได้ และหน้าบ้านคำนวณยอดเงินจริง / ส่วนลด / เงินรางวัล จากการตั้งค่า
 * =====================================================================
 */

export interface MasterBetTypeConfig {
  id: number;
  category: string;   // '3 ตัว' | '2 ตัว' | 'วิ่ง' | '4 ตัว' | '5 ตัว' | 'ปักหลัก'
  key: string;
  label: string;
  digits: number;
  rate: number;       // อัตราจ่าย (บาท)
  discount: number;   // ส่วนลด (%)
  isThaiOnly?: boolean; // มีเฉพาะหวยไทย 14 ประเภท (ยี่กีและหวยอื่นไม่มี 3 ตัวล่าง กับ 5 ตัวโต๊ด)
  isThaiAndYeekeeOnly?: boolean; // legacy alias
  hint?: string;
}

export const MASTER_BET_TYPES: MasterBetTypeConfig[] = [
  { id: 1,  category: '3 ตัว',  key: '3 ตัวบน',      label: '3 ตัวบน',      digits: 3, rate: 900.00,  discount: 0, hint: '3 ตัวท้ายรางวัลที่ 1' },
  { id: 2,  category: '3 ตัว',  key: '3 ตัวโต๊ด',     label: '3 ตัวโต๊ด',     digits: 3, rate: 150.00,  discount: 0, hint: 'สลับตำแหน่ง 3 ตัวท้าย' },
  { id: 3,  category: '3 ตัว',  key: '3 ตัวล่าง',     label: '3 ตัวล่าง',     digits: 3, rate: 450.00,  discount: 0, isThaiOnly: true, isThaiAndYeekeeOnly: true, hint: '3 ตัวท้ายรางวัลหมุนล่าง (เฉพาะหวยไทย)' },
  { id: 4,  category: '2 ตัว',  key: '2 ตัวบน',      label: '2 ตัวบน',      digits: 2, rate: 90.00,   discount: 0, hint: '2 ตัวท้ายรางวัลที่ 1' },
  { id: 5,  category: '2 ตัว',  key: '2 ตัวล่าง',     label: '2 ตัวล่าง',     digits: 2, rate: 90.00,   discount: 0, hint: '2 ตัวล่างตรง' },
  { id: 6,  category: '2 ตัว',  key: '2 ตัวโต๊ด',     label: '2 ตัวโต๊ด',     digits: 2, rate: 13.00,   discount: 0, hint: 'สลับตำแหน่ง 2 ตัว' },
  { id: 7,  category: 'วิ่ง',   key: 'วิ่งบน',        label: 'วิ่งบน',        digits: 1, rate: 3.20,    discount: 0, hint: 'มีเลขใน 3 ตัวบน' },
  { id: 8,  category: 'วิ่ง',   key: 'วิ่งล่าง',       label: 'วิ่งล่าง',       digits: 1, rate: 4.20,    discount: 0, hint: 'มีเลขใน 2 ตัวล่าง' },
  { id: 9,  category: '4 ตัว',  key: '4 ตัวบน',      label: '4 ตัวบน',      digits: 4, rate: 4000.00, discount: 0, hint: '4 ตัวท้ายรางวัลที่ 1' },
  { id: 10, category: '4 ตัว',  key: '4 ตัวโต๊ด',     label: '4 ตัวโต๊ด',     digits: 4, rate: 25.00,   discount: 0, hint: 'สลับตำแหน่ง 4 ตัวท้าย' },
  { id: 11, category: '5 ตัว',  key: '5 ตัวโต๊ด',     label: '5 ตัวโต๊ด',     digits: 5, rate: 15.00,   discount: 0, isThaiOnly: true, isThaiAndYeekeeOnly: true, hint: 'สลับตำแหน่ง 5 ตัว (เฉพาะหวยไทย)' },
  { id: 12, category: 'ปักหลัก', key: 'ปักหลักร้อย',    label: 'ปักหลักร้อย',    digits: 1, rate: 8.00,    discount: 0, hint: 'ตรงหลักร้อย 3 ตัวบน' },
  { id: 13, category: 'ปักหลัก', key: 'ปักหลักสิบ',    label: 'ปักหลักสิบ',    digits: 1, rate: 8.00,    discount: 0, hint: 'ตรงหลักสิบ 3 ตัวบน' },
  { id: 14, category: 'ปักหลัก', key: 'ปักหลักหน่วย',   label: 'ปักหลักหน่วย',   digits: 1, rate: 8.00,    discount: 0, hint: 'ตรงหลักหน่วย 3 ตัวบน' },
];

/** แผนที่อัตราจ่ายตั้งต้น (Base Rates Map) */
export const DEFAULT_MASTER_RATES: Record<string, number> = {
  '2 ตัวบน': 90.00,
  '3 ตัวบน': 900.00,
  '3 ตัวโต๊ด': 150.00,
  '2 ตัวโต๊ด': 13.00,
  'วิ่งบน': 3.20,
  'วิ่งล่าง': 4.20,
  '2 ตัวล่าง': 90.00,
  '3 ตัวล่าง': 450.00,
  '4 ตัวบน': 4000.00,
  '4 ตัวโต๊ด': 25.00,
  '5 ตัวโต๊ด': 15.00,
  'ปักหลักหน่วย': 8.00,
  'ปักหลักสิบ': 8.00,
  'ปักหลักร้อย': 8.00,

  // คำพ้อง / ตัวช่วยแทงกลับ
  '3 ตัวกลับ': 900.00,
  '2 ตัวกลับ': 90.00,
  '3 ตัวหน้า': 450.00,
  'เลขปัก': 8.00,
};

/** แผนที่ส่วนลดตั้งต้น (Discounts Map) - ค่าเริ่มต้นคือ 0% */
export const DEFAULT_MASTER_DISCOUNTS: Record<string, number> = {
  '2 ตัวบน': 0,
  '3 ตัวบน': 0,
  '3 ตัวโต๊ด': 0,
  '2 ตัวโต๊ด': 0,
  'วิ่งบน': 0,
  'วิ่งล่าง': 0,
  '2 ตัวล่าง': 0,
  '3 ตัวล่าง': 0,
  '4 ตัวบน': 0,
  '4 ตัวโต๊ด': 0,
  '5 ตัวโต๊ด': 0,
  'ปักหลักหน่วย': 0,
  'ปักหลักสิบ': 0,
  'ปักหลักร้อย': 0,

  '3 ตัวกลับ': 0,
  '2 ตัวกลับ': 0,
  '3 ตัวหน้า': 0,
  'เลขปัก': 0,
};

/**
 * ตรวจสอบว่าเป็นหวยรัฐบาลไทยหรือไม่ (หวยเดียวที่มีครบ 14 ประเภท)
 * หวยยี่กี และ หวยอื่นๆ (ฮานอย, ลาว, มาเลย์, หุ้น) จะมีเพียง 12 ประเภท (ไม่มี 3 ตัวล่าง และ 5 ตัวโต๊ด)
 */
export function isThaiOnly(lotteryName?: string): boolean {
  if (!lotteryName) return false;
  const lower = lotteryName.toLowerCase();
  // ยี่กี มี 12 ประเภทตามข้อกำหนดล่าสุด
  if (lower.includes('ยี่กี') || lower.includes('yeekee')) {
    return false;
  }
  return (
    lower.includes('ไทย') ||
    lower.includes('thai') ||
    lower.includes('รัฐบาล')
  );
}

/**
 * ฟังก์ชันตรวจสอบประเภทหวยสำหรับ backward compatibility
 * @deprecated แนะนำให้ใช้ isThaiOnly()
 */
export function isThaiOrYeekee(lotteryName?: string): boolean {
  return isThaiOnly(lotteryName);
}

/**
 * ดึงรายการประเภทการแทงที่ใช้งานได้ของหวยนั้นๆ
 * - หวยไทย -> ได้ครบทั้ง 14 ประเภท (รวม 3 ตัวล่าง และ 5 ตัวโต๊ด)
 * - หวยยี่กี & หวยอื่นๆ -> ตัด 3 ตัวล่าง และ 5 ตัวโต๊ด ออก เหลือ 12 ประเภท
 */
export function getAvailableBetTypesForLottery(lotteryName?: string): MasterBetTypeConfig[] {
  if (!lotteryName) {
    return MASTER_BET_TYPES;
  }
  const allowAll14 = isThaiOnly(lotteryName);
  if (allowAll14) {
    return MASTER_BET_TYPES;
  }
  return MASTER_BET_TYPES.filter(t => !t.isThaiOnly);
}

/**
 * คำนวณราคาจ่ายจริงเมื่อมีส่วนลด
 * @param amount ยอดแทงที่ระบุ (บาท)
 * @param discountPercent เปอร์เซ็นต์ส่วนลด (%) เช่น 0, 5, 10
 * @returns ยอดเงินสุทธิที่ผู้เล่นต้องจ่ายจริง (บาท)
 */
export function calculateNetBetAmount(amount: number, discountPercent: number = 0): number {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const safeDiscount = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const net = safeAmount * (1 - safeDiscount / 100);
  return Math.round(net * 100) / 100;
}

/**
 * คำนวณเงินรางวัลที่จะได้รับหากถูกรางวัล
 * @param amount ยอดแทงที่ระบุ (บาท)
 * @param payoutRate อัตราจ่าย (บาทละ)
 * @returns ยอดเงินรางวัลที่จะได้รับ (บาท)
 */
export function calculatePotentialWin(amount: number, payoutRate: number): number {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const safeRate = Math.max(0, Number(payoutRate) || 0);
  return Math.round(safeAmount * safeRate * 100) / 100;
}

/**
 * ตรวจสอบความถูกต้องของการถูกรางวัลของแต่ละประเภท
 */
export function checkBetWin(
  betType: string,
  betNumber: string,
  results: {
    result3Top: string;
    result2Bottom: string;
    result3Bottom?: string;
    result3Front?: string;
    result4Top?: string;
    result5Top?: string;
  }
): boolean {
  const cleanType = (betType || '').trim();
  const top3 = (results.result3Top || '').trim();
  const bot2 = (results.result2Bottom || '').trim();
  const top2 = top3.slice(-2);
  const num = (betNumber || '').trim();

  if (!num || !top3) return false;

  // 1. 2 ตัวบน
  if (cleanType === '2 ตัวบน') {
    return num === top2;
  }
  // 2. 3 ตัวบน
  if (cleanType === '3 ตัวบน') {
    return num === top3;
  }
  // 3. 3 ตัวโต๊ด
  if (cleanType === '3 ตัวโต๊ด') {
    const sBet = num.split('').sort().join('');
    const sWin = top3.split('').sort().join('');
    return sBet === sWin && num !== top3;
  }
  // 4. 2 ตัวโต๊ด
  if (cleanType === '2 ตัวโต๊ด') {
    const sBet = num.split('').sort().join('');
    const sTop2 = top2.split('').sort().join('');
    return sBet === sTop2;
  }
  // 5. วิ่งบน
  if (cleanType === 'วิ่งบน') {
    return top3.includes(num);
  }
  // 6. วิ่งล่าง
  if (cleanType === 'วิ่งล่าง') {
    return bot2.includes(num);
  }
  // 7. 2 ตัวล่าง
  if (cleanType === '2 ตัวล่าง') {
    return num === bot2;
  }
  // 8. 3 ตัวล่าง
  if (cleanType === '3 ตัวล่าง') {
    if (!results.result3Bottom) return false;
    const items = results.result3Bottom.split(',').map(s => s.trim());
    return items.includes(num);
  }
  // 9. 4 ตัวบน
  if (cleanType === '4 ตัวบน') {
    const top4 = results.result4Top || top3;
    return num === top4;
  }
  // 10. 4 ตัวโต๊ด
  if (cleanType === '4 ตัวโต๊ด') {
    const top4 = results.result4Top || '';
    if (!top4) return false;
    const sBet = num.split('').sort().join('');
    const sWin = top4.split('').sort().join('');
    return sBet === sWin && num !== top4;
  }
  // 11. 5 ตัวโต๊ด
  if (cleanType === '5 ตัวโต๊ด') {
    const top5 = results.result5Top || '';
    if (!top5) return false;
    const sBet = num.split('').sort().join('');
    const sWin = top5.split('').sort().join('');
    return sBet === sWin && num !== top5;
  }
  // 12. ปักหลักหน่วย
  if (cleanType === 'ปักหลักหน่วย') {
    const unitDigit = top3.slice(-1);
    return num === unitDigit;
  }
  // 13. ปักหลักสิบ
  if (cleanType === 'ปักหลักสิบ') {
    const tenDigit = top3.slice(-2, -1);
    return num === tenDigit;
  }
  // 14. ปักหลักร้อย
  if (cleanType === 'ปักหลักร้อย') {
    const hundredDigit = top3.slice(0, 1);
    return num === hundredDigit;
  }

  // คำพ้อง / ตัวช่วย
  if (cleanType === '3 ตัวกลับ') {
    return num === top3;
  }
  if (cleanType === '2 ตัวกลับ') {
    return num === top2 || num === bot2;
  }
  if (cleanType === '3 ตัวหน้า' && results.result3Front) {
    const items = results.result3Front.split(',').map(s => s.trim());
    return items.includes(num);
  }

  return false;
}
