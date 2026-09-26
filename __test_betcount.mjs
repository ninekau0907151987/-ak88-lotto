/**
 * __test_betcount.mjs
 * ------------------------------------------------------------------
 * ตรวจตรรกะการนับจำนวนตัว ตามตัวอย่างที่ผู้ใช้กำหนด
 *
 * ตัวอย่างที่ผู้ใช้ขอ:
 *   "กดแทง 123 ตัวบน 6 ตัว ในตาราง บอกมีทั้งหมด 6 ตัว
 *    ถ้ากด 112 เพิ่ม 3 ตัว รวม 9 ตัวที่รอการแทงตามประเภท"
 *
 * รัน: node __test_betcount.mjs
 */
import { countBets } from './src/shared/lib/betCount.ts';

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (!ok) console.log(`     ได้: ${JSON.stringify(actual)}\n     ควรเป็น: ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}

console.log('═════ ทดสอบตรรกะการนับจำนวนตัว ═════\n');

// ---------- กรณีที่ 1: กด 123 (3ตัวบน) 6 รายการ ----------
// สมมติผู้ใช้กดเลข 123 ซ้ำ 6 ครั้ง (ยิง 6 รายการ ที่ 3ตัวบน)
const sixSame = Array.from({ length: 6 }, () => ({ number: '123', type: '3 ตัวบน', amount: 5 }));
let s = countBets(sixSame);
check('กด 123 ซ้ำ 6 ครั้ง → นับเป็น 1 ตัว (ไม่ซ้ำ)', s.totalNumbers, 1);
check('  แต่มี 6 รายการ', s.totalEntries, 6);
check('  และมีซ้ำ 5 รายการ', s.duplicateCount, 5);
check('  ยอดเงิน = 30', s.totalAmount, 30);

// ---------- กรณีที่ 2: 6 ตัวต่างกัน ที่ 3ตัวบน ----------
const sixDistinct = ['123','456','789','111','222','333'].map(n => ({ number: n, type: '3 ตัวบน', amount: 5 }));
s = countBets(sixDistinct);
check('\nกด 6 ตัวต่างกัน (3ตัวบน) → 6 ตัว', s.totalNumbers, 6);
check('  ยอดเงิน = 30', s.totalAmount, 30);
check('  ไม่มีซ้ำ', s.duplicateCount, 0);

// ---------- กรณีที่ 3: เพิ่ม 112 อีก 3 รายการ (ตรงตามที่ผู้ใช้พูด) ----------
const plus112 = [
  ...sixDistinct,
  ...Array.from({ length: 3 }, () => ({ number: '112', type: '3 ตัวบน', amount: 5 })),
];
s = countBets(plus112);
check('\n6 ตัวเดิม + 112 อีก 3 รายการ → 7 ตัว (112 เป็นตัวใหม่)', s.totalNumbers, 7);
check('  รายการรวม = 9', s.totalEntries, 9);
check('  ซ้ำ 2 รายการ (112 ซ้ำ)', s.duplicateCount, 2);
check('  ยอดเงิน = 45', s.totalAmount, 45);

// ---------- กรณีที่ 4: ตัวอย่างที่ผู้ใช้ระบุตรงๆ ----------
// "123 ตัวบน 6 ตัว ... กด112เพิ่ม3ตัว รวม9ตัว" — หมายถึง 9 รายการ
s = countBets([
  { number: '123', type: '3 ตัวบน', amount: 5 },
  { number: '123', type: '3 ตัวบน', amount: 5 },
  { number: '123', type: '3 ตัวบน', amount: 5 },
  { number: '123', type: '3 ตัวบน', amount: 5 },
  { number: '123', type: '3 ตัวบน', amount: 5 },
  { number: '123', type: '3 ตัวบน', amount: 5 },
  { number: '112', type: '3 ตัวบน', amount: 5 },
  { number: '112', type: '3 ตัวบน', amount: 5 },
  { number: '112', type: '3 ตัวบน', amount: 5 },
]);
check('\nกรณีผู้ใช้ระบุ: 123×6 + 112×3 → รายการรวม 9', s.totalEntries, 9);
check('  ตัวเลขไม่ซ้ำ = 2 (123, 112)', s.totalNumbers, 2);
check('  ยอดเงิน = 45', s.totalAmount, 45);
check('  byType มี 1 ประเภท', s.byType.length, 1);
check('  ประเภท "3 ตัวบน" นับ 2 ตัว', s.byType[0].count, 2);
check('  ประเภท "3 ตัวบน" ยอด 45', s.byType[0].amount, 45);

// ---------- กรณีที่ 5: แยกตามประเภท (ผู้ใช้ขอ "ตามประเภท") ----------
s = countBets([
  { number: '123', type: '3 ตัวบน', amount: 10 },
  { number: '456', type: '3 ตัวบน', amount: 10 },
  { number: '78',  type: '2 ตัวล่าง', amount: 5 },
  { number: '99',  type: '2 ตัวล่าง', amount: 5 },
  { number: '0',   type: 'วิ่งบน', amount: 3 },
]);
check('\nหลายประเภท → ตัวรวม 5', s.totalNumbers, 5);
check('  มี 3 ประเภท', s.typeCount, 3);
check('  ยอดรวม 33', s.totalAmount, 33);
const three = s.byType.find(t => t.type === '3 ตัวบน');
check('  "3 ตัวบน" = 2 ตัว', three.count, 2);
check('  "3 ตัวบน" ยอด 20', three.amount, 20);
check('  เรียงตามยอดมากไปน้อย (3ตัวบนก่อน)', s.byType[0].type, '3 ตัวบน');

// ---------- กรณีที่ 6: เลขพิเศษ/ลดราคา flag ----------
s = countBets([
  { number: '777', type: '3 ตัวบน', amount: 10, isSpecial: true },
  { number: '888', type: '3 ตัวบน', amount: 10, isReduced: true },
]);
check('\nเลขพิเศษ: flagged มี 1', s.byType[0].flagged.filter(f => f.reason === 'special').length, 1);
check('  เลขลดราคา: flagged มี 1', s.byType[0].flagged.filter(f => f.reason === 'reduced').length, 1);

// ---------- กรณีที่ 7: รางวัลสูงสุด ----------
s = countBets([
  { number: '123', type: '3 ตัวบน', amount: 5, payoutRate: 900 },
]);
check('\nรางวัลสูงสุด = 5 × 900 = 4500', s.maxPayout, 4500);

// ---------- กรณีที่ 8: ว่างเปล่า ----------
s = countBets([]);
check('\nว่างเปล่า → 0 ทุกอย่าง', [s.totalNumbers, s.totalEntries, s.totalAmount, s.typeCount], [0, 0, 0, 0]);

console.log(`\n${'═'.repeat(38)}`);
console.log(`ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
console.log(fail === 0 ? '★★★ ตรรกะการนับถูกต้องทั้งหมด ★★★' : '✗✗✗ มีข้อผิดพลาด ✗✗✗');
process.exit(fail === 0 ? 0 : 1);
