/**
 * __test_betslip.mjs — ทดสอบตะกร้าแทงหวย 20 ช่อง (ฝั่งลูกค้า)
 * ★ จุดสำคัญ: ผลของเราต้อง "ตรงกับ engine" (evaluateBets20) 100%
 * รัน: npx tsx __test_betslip.mjs
 */
import {
  addToSlip, removeFromSlip, setSlipAmount, setSlipNumber, clearSlip,
  computeTotals, validateSlip, pickResultDigits, isWinner,
  checkSlipAgainstResult, demoSlots, explainSlots, detectDuplicates,
  GAME20_BET_KINDS, KIND_BY_KEY,
} from './src/shared/lib/game20BetSlip.ts';
import { evaluateBets20, computeResult, validateSlots, SLOT_COUNT } from './src/shared/lib/lottery20.ts';

let pass = 0, fail = 0;
const fails = [];
function eq(actual, expect, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expect);
  if (a === e) { pass++; }
  else { fail++; fails.push(`${label}\n     ได้: ${a}\n     ต้องได้: ${e}`); }
}
function ok(cond, label) { eq(!!cond, true, label); }

console.log('═══ 1) ประเภทการแทง ตรงกับ engine ═══');
const ENGINE_TYPES = ['3ตัวบน', '3ตัวโต๊ด', '2ตัวบน', '2ตัวล่าง', '1ตัว'];
for (const k of GAME20_BET_KINDS) {
  ok(ENGINE_TYPES.includes(k.kind), `ประเภท "${k.kind}" มีใน engine`);
}
eq(GAME20_BET_KINDS.length, 5, 'มี 5 ประเภท');
eq(ENGINE_TYPES.every(t => KIND_BY_KEY[t]), true, 'ทุกประเภทของ engine มีใน KIND_BY_KEY');

console.log('\n═══ 2) เพิ่ม/ลบ/แก้ ตะกร้า ═══');
let slip = [];
slip = addToSlip(slip, '3ตัวบน', '456', 100);
eq(slip.length, 1, 'เพิ่ม 1 รายการ');
eq(slip[0].number, '456', 'เลขถูกเก็บ');
eq(slip[0].amount, 100, 'เงินถูกเก็บ');

// ซ้ำ → รวมเงิน
slip = addToSlip(slip, '3ตัวบน', '456', 50);
eq(slip.length, 1, 'เพิ่มซ้ำ → ไม่เพิ่มรายการใหม่');
eq(slip[0].amount, 150, 'เพิ่มซ้ำ → รวมเงินเป็น 150');

// คนละประเภท → รายการใหม่
slip = addToSlip(slip, '2ตัวบน', '56', 20);
eq(slip.length, 2, 'คนละประเภท → รายการใหม่');

// เงิน 0 → ไม่เพิ่ม
slip = addToSlip(slip, '3ตัวบน', '999', 0);
eq(slip.length, 2, 'เงิน 0 → ไม่เพิ่ม');

// จำนวนหลักผิด → ไม่เพิ่ม
slip = addToSlip(slip, '3ตัวบน', '45', 100);
eq(slip.length, 2, 'เลข 2 หลักสำหรับ 3ตัวบน → ไม่เพิ่ม');

// แก้เงิน
slip = setSlipAmount(slip, slip[0].id, 777);
eq(slip[0].amount, 777, 'แก้เงินเป็น 777');

// แก้เลข
slip = setSlipNumber(slip, slip[0].id, '123');
eq(slip[0].number, '123', 'แก้เลขเป็น 123');

// ลบ
const beforeLen = slip.length;
slip = removeFromSlip(slip, slip[0].id);
eq(slip.length, beforeLen - 1, 'ลบรายการ');

// ล้าง
eq(clearSlip().length, 0, 'ล้างตะกร้า');

console.log('\n═══ 3) คำนวณยอด ═══');
let s2 = [];
s2 = addToSlip(s2, '3ตัวบน', '456', 100);   // 900×
s2 = addToSlip(s2, '2ตัวบน', '56', 50);     // 95×
const t = computeTotals(s2);
eq(t.count, 2, 'นับ 2 รายการ');
eq(t.totalCost, 150, 'ทุนรวม 150');
eq(t.maxPayout, 90000 + 4750, 'จ่ายสูงสุด 94,750');
eq(t.byKind.length, 2, 'แยก 2 ประเภท');

console.log('\n═══ 4) pickResultDigits ตรงกับ engine ═══');
const RES = '123456';
eq(pickResultDigits(RES, '3ตัวบน'), '456', '3ตัวบน = 3 หลักท้าย');
eq(pickResultDigits(RES, '2ตัวบน'), '56', '2ตัวบน = 2 หลักท้าย');
eq(pickResultDigits(RES, '2ตัวล่าง'), '34', '2ตัวล่าง = 2 หลักกลาง');
eq(pickResultDigits(RES, '1ตัว'), '6', '1ตัว = หลักหน่วย');
eq(pickResultDigits(RES, '3ตัวโต๊ด'), '456', '3ตัวโต๊ด = 3 หลักท้าย');

console.log('\n═══ 5) ★★★ isWinner ตรงกับ evaluateBets20 100% ★★★ ═══');
// สุ่มเลข + ประเภท + ผล มาเทียบ 2 ทาง
const DIGITS = '0123456789';
function rndNum(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += DIGITS[Math.floor(Math.random() * 10)];
  return s;
}
function rndResult() {
  let s = '';
  for (let i = 0; i < 6; i++) s += DIGITS[Math.floor(Math.random() * 10)];
  return s;
}

const KIND_DIGITS = { '3ตัวบน': 3, '2ตัวบน': 2, '2ตัวล่าง': 2, '1ตัว': 1, '3ตัวโต๊ด': 3 };
let mismatch = 0, checked = 0;
const mismatches = [];

for (let i = 0; i < 3000; i++) {
  const kind = ENGINE_TYPES[Math.floor(Math.random() * ENGINE_TYPES.length)];
  const num = rndNum(KIND_DIGITS[kind]);
  const res = rndResult();

  // ทางที่ 1: ของเรา
  const item = { id: 'x', kind, number: num, amount: 100, rate: KIND_BY_KEY[kind].rate };
  const ourWin = isWinner(item, res);

  // ทางที่ 2: engine จริง
  const eng = evaluateBets20(
    [{ number: num, type: kind, amount: 100, rate: KIND_BY_KEY[kind].rate }],
    res,
    {},
  );
  const engWin = eng.payout > 0;

  checked++;
  if (ourWin !== engWin) {
    mismatch++;
    if (mismatches.length < 5) mismatches.push(`${kind} เลข ${num} ผล ${res}: เรา=${ourWin} engine=${engWin}`);
  }
}
eq(mismatch, 0, `ตรวจ ${checked} เคส — ผลตรงกับ engine ทั้งหมด`);
if (mismatches.length) mismatches.forEach(m => console.log('     ✗ ' + m));
else console.log(`     ✅ ตรวจ ${checked} เคส ตรงกันทุกเคส`);

console.log('\n═══ 6) ทดสอบเจาะจงเคสที่ต้องถูก ═══');
const CASES = [
  ['3ตัวบน', '456', '123456', true,  '3 หลักท้ายตรง'],
  ['3ตัวบน', '457', '123456', false, '3 หลักท้ายไม่ตรง'],
  ['2ตัวบน', '56',  '123456', true,  '2 หลักท้ายตรง'],
  ['2ตัวล่าง','34',  '123456', true,  '2 หลักกลางตรง'],
  ['2ตัวล่าง','12',  '123456', false, '2 หลักแรกไม่นับเป็นล่าง'],
  ['1ตัว',   '6',   '123456', true,  'หลักหน่วยตรง'],
  ['1ตัว',   '1',   '123456', false, 'หลักแสนไม่นับ'],
  ['3ตัวโต๊ด','654', '123456', true,  'สลับหลักได้'],
  ['3ตัวโต๊ด','645', '123456', true,  'สลับหลักได้'],
  ['3ตัวโต๊ด','655', '123456', false, 'หลักไม่ครบ'],
  ['3ตัวโต๊ด','457', '123456', false, 'มีหลักที่ไม่ตรง'],
];
for (const [kind, num, res, want, why] of CASES) {
  const item = { id: 'x', kind, number: num, amount: 100, rate: 1 };
  eq(isWinner(item, res), want, `${kind} ${num} vs ${res} — ${why}`);
}

console.log('\n═══ 7) ตรวจเครดิตก่อนส่ง ═══');
const slotsGood = demoSlots();
eq(validateSlots(slotsGood).ok, true, 'ช่องตัวอย่างถูกต้อง');

let s3 = addToSlip([], '3ตัวบน', '456', 500);
let v = validateSlip(s3, slotsGood, 10000);
eq(v.ok, true, 'เครดิตพอ → ผ่าน');
eq(v.errors.length, 0, 'ไม่มี error');

v = validateSlip(s3, slotsGood, 100);
eq(v.ok, false, 'เครดิตไม่พอ → ไม่ผ่าน');
ok(v.errors.some(e => e.includes('เครดิตไม่พอ')), 'แจ้งเตือนเครดิตไม่พอ');

v = validateSlip([], slotsGood, 10000);
eq(v.ok, false, 'ตะกร้าว่าง → ไม่ผ่าน');

const slotsBad = new Array(SLOT_COUNT).fill('');
v = validateSlip(s3, slotsBad, 10000);
eq(v.ok, false, 'ช่องว่าง → ไม่ผ่าน');

console.log('\n═══ 8) ตรวจผลย้อนหลัง (ถูก/ไม่ถูก) ═══');
let s4 = [];
s4 = addToSlip(s4, '3ตัวบน', '456', 100);
s4 = addToSlip(s4, '2ตัวบน', '99', 50);
const chk = checkSlipAgainstResult(s4, '123456');
eq(chk.winCount, 1, 'ถูก 1 รายการ');
eq(chk.totalCost, 150, 'ทุน 150');
eq(chk.totalPayout, 90000, 'จ่าย 90,000');
eq(chk.profit, 90000 - 150, 'กำไร 89,850');

console.log('\n═══ 9) อธิบายการคำนวณผล ═══');
const ex = explainSlots(slotsGood);
eq(ex.fill, '20/20 ช่อง', 'นับช่องครบ');
eq(ex.result.length, 6, 'ผล 6 หลัก');
eq(ex.steps.length, 4, 'มี 4 ขั้นตอน');
eq(ex.result, computeResult(slotsGood).result, 'ผลตรงกับ computeResult');
ok(typeof ex.sum === 'number' && ex.sum > 0, 'ผลรวมเป็นตัวเลข');
eq(ex.prizes.top3, ex.result.slice(-3), 'top3 ถูก');
eq(ex.prizes.bottom2, ex.result.slice(2, 4), 'bottom2 ตรง engine');

console.log('\n═══ 10) ตรวจจับเลขซ้ำ ═══');
eq(detectDuplicates([]).length, 0, 'ตะกร้าว่าง → ไม่มีซ้ำ');
// addToSlip รวมให้อยู่แล้ว จึงไม่ควรมีซ้ำ
let s5 = addToSlip([], '3ตัวบน', '456', 100);
s5 = addToSlip(s5, '3ตัวบน', '456', 100);
eq(detectDuplicates(s5).length, 0, 'addToSlip รวมซ้ำแล้ว → ไม่เหลือซ้ำ');
eq(s5[0].amount, 200, 'รวมเป็น 200');

console.log('\n═══ 11) demoSlots ใช้ได้จริง ═══');
const dm = demoSlots();
eq(dm.length, SLOT_COUNT, 'ได้ 20 ช่อง');
eq(validateSlots(dm).ok, true, 'ผ่าน validateSlots');
eq(computeResult(dm).result.length, 6, 'คำนวณผลได้ 6 หลัก');

console.log('\n' + '═'.repeat(56));
console.log(`ผ่าน ${pass}  |  ไม่ผ่าน ${fail}`);
if (fails.length) { console.log('\n★ ที่ไม่ผ่าน:'); fails.forEach(f => console.log('   - ' + f)); }
else console.log('★★★ ผ่านทั้งหมด — ตะกร้าตรงกับ engine 100% ★★★');
console.log('═'.repeat(56));
process.exit(fail ? 1 : 0);
