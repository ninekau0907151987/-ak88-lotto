/**
 * __test_lottery20.mjs — ทดสอบสูตรหวย 20 ช่อง 6 หลัก
 * รัน: npx tsx __test_lottery20.mjs
 */
import {
  SLOT_COUNT, DIGITS_PER_SLOT, RESULT_MODULO, SUBTRACT_SLOT_POSITION, SUBTRACT_SLOT_INDEX,
  normalizeSlot, slotToNumber, padNum, validateSlots, computeResult,
  computeResultDetailed, evaluateBets20, analyzeRoundExposure,
  DEFAULT_PAYOUT_RATES, calcHouseMargin, defaultRateMap,
  randomSlots, seededSlots, formatResult, explainFormula,
  solveSlotsForResult, solveSlotsNatural,
} from './src/shared/lib/lottery20.ts';

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}  ${extra}`); }
};
const eq = (a, b, name) => t(name, a === b, `ได้ ${JSON.stringify(a)} คาด ${JSON.stringify(b)}`);
const sect = n => console.log(`\n── ${n} ──`);

const S = (...vals) => {
  const a = new Array(SLOT_COUNT).fill('000000');
  vals.forEach((v, i) => { a[i] = v; });
  return a;
};

/* ================================================================ */
sect('1. ค่าคงที่');
eq(SLOT_COUNT, 20, '20 ช่อง');
eq(DIGITS_PER_SLOT, 6, '6 หลัก');
eq(RESULT_MODULO, 1000000, 'mod 1,000,000');
eq(SUBTRACT_SLOT_POSITION, 17, 'ลบหลักที่ 17');

/* ================================================================ */
sect('2. normalizeSlot');
eq(normalizeSlot('123456'), '123456', '6 หลักตรง');
eq(normalizeSlot('12345'), '012345', '5 หลัก → เติมศูนย์');
eq(normalizeSlot('1'), '000001', '1 หลัก → เติมศูนย์');
eq(normalizeSlot('1234567'), '234567', 'เกิน 6 หลัก → เอา 6 ท้าย');
eq(normalizeSlot(''), '000000', 'ว่าง → 000000');
eq(normalizeSlot('abc12x34'), '001234', 'ตัดตัวอักษรออก');
eq(normalizeSlot(null), '000000', 'null → 000000');
eq(normalizeSlot(123456), '123456', 'number → string');

/* ================================================================ */
sect('3. ★ สูตรหลัก: (Σ 20 ช่อง) − ช่อง 17');
{
  const slots = S('100000', '200000', '300000');
  // sum = 600000 (ช่อง 17 = 000000)
  const r = computeResult(slots);
  eq(r.sum, 600000, 'Σ = 600,000');
  eq(r.subtractValue, 0, 'ช่อง 17 = 0');
  eq(r.result, '600000', 'ผลลัพธ์ = 600000');
}
{
  // วางเลขช่องที่ 17 เพื่อทดสอบการลบจริง
  const slots = S('500000', '300000');
  slots[16] = '100000';  // ช่องที่ 17
  const r = computeResult(slots);
  eq(r.sum, 900000, 'Σ = 900,000');
  eq(r.subtractSlot, '100000', 'ช่อง 17 = 100000');
  eq(r.subtractValue, 100000, 'ค่าที่ลบ = 100,000');
  eq(r.raw, 800000, '900,000 − 100,000 = 800,000');
  eq(r.result, '800000', 'ผลลัพธ์ = 800000');
}
{
  // ทดสอบ mod — ผลรวมเกิน 1,000,000
  const slots = S('999999');
  slots[1] = '999999';
  const r = computeResult(slots);
  eq(r.sum, 1999998, 'Σ = 1,999,998');
  eq(r.raw, 1999998, 'ลบ 0 = 1,999,998');
  eq(r.result, '999998', 'mod → 999998');
}
{
  // ★ ทดสอบค่าติดลบ — ช่อง 17 มากกว่าผลรวมช่องอื่น
  // ★ หมายเหตุ: ช่อง 17 เป็น 1 ใน 20 ช่อง จึงรวมอยู่ใน sum ด้วย
  const slots = S('100000');
  slots[16] = '500000';   // ช่องที่ 17
  const r = computeResult(slots);
  // sum = 100000 (ช่อง1) + 500000 (ช่อง17) = 600000
  eq(r.sum, 600000, 'Σ = 600,000 (รวมช่อง 17 ด้วย)');
  eq(r.subtractValue, 500000, 'ค่าที่ลบ = 500,000');
  eq(r.raw, 100000, '600,000 − 500,000 = 100,000');
  eq(r.result, '100000', 'ผลลัพธ์ = 100000');
}
{
  // ★ ทดสอบค่าติดลบจริง — ต้องมีช่องอื่นรวมน้อยกว่าช่อง 17
  // ช่อง 17 = 500000 แต่ช่องอื่นมีแค่ 100000 → ทำไม่ได้ เพราะ 17 อยู่ใน sum
  // วิธีทำให้ติดลบจริง: ไม่มีทาง เพราะ sum ≥ slot17 เสมอ (ทุกค่าเป็นบวก)
  // ★ นี่เป็นคุณสมบัติสำคัญ: ผลลัพธ์ไม่ติดลบ → mod ทำงานได้ปลอดภัย
  const slots = S();
  slots[16] = '999999';
  const r = computeResult(slots);
  eq(r.sum, 999999, 'Σ = 999,999');
  eq(r.raw, 0, 'ลบตัวเอง = 0');
  eq(r.result, '000000', 'ได้ 000000');
  t('★ sum ≥ slot17 เสมอ (ไม่มีทางติดลบ)', r.raw >= 0);
}
{
  // 20 ช่องเต็ม — ค่าตามจริง
  const slots = randomSlots();
  const r = computeResult(slots);
  const manual = (slots.reduce((s, v) => s + Number(v), 0) - Number(slots[16]) + RESULT_MODULO) % RESULT_MODULO;
  eq(Number(r.result), manual, 'สุ่ม 20 ช่อง → คำนวณตรงกับมือ');
  t('verify.ok = true', r.verify.ok);
  t('ผลลัพธ์ 6 หลักเสมอ', r.result.length === 6 && /^\d{6}$/.test(r.result));
}

/* ================================================================ */
sect('4. แยกรางวัล');
{
  const slots = S();
  slots[0] = '123456';  // sum=123456, minus slot17=0 → 123456
  const r = computeResult(slots);
  eq(r.result, '123456', 'ผล = 123456');
  eq(r.prizes.top3, '456', '3 ตัวบน = 456 (3 ท้าย)');
  eq(r.prizes.top2, '56', '2 ตัวบน = 56 (2 ท้าย)');
  eq(r.prizes.bottom2, '34', '2 ตัวล่าง = 34 (หลัก 3-4)');
  eq(r.prizes.last1, '6', '1 ตัว = 6 (หลักท้าย)');
}

/* ================================================================ */
sect('5. validateSlots');
{
  const v = validateSlots(new Array(20).fill('000000'));
  t('20 ช่องครบ → ok', v.ok);
  t('isComplete = true', v.isComplete);
  eq(v.filledCount, 20, 'filledCount = 20');
}
{
  // ★ ทดสอบช่อง 17 ว่างจริง — ต้องใช้อาร์เรย์ที่มีช่องว่าง (ไม่ใช่ '000000')
  const arr = new Array(SLOT_COUNT).fill('000000');
  arr[SUBTRACT_SLOT_INDEX] = '';          // ช่อง 17 ว่างจริง
  const v = validateSlots(arr);
  t('ช่อง 17 ว่าง → ไม่ ok', !v.ok);
  t('แจ้ง error เรื่องช่อง 17', v.errors.some(e => e.includes('17')), v.errors.join('|'));

  // ★ ช่อง 17 = '000000' ถือว่า "กรอกแล้ว" (เป็นเลข 0 จริง) → ต้อง ok
  const arr2 = new Array(SLOT_COUNT).fill('000000');
  const v2 = validateSlots(arr2);
  t('★ ช่อง 17 = 000000 ถือว่ากรอกแล้ว → ok', v2.ok);

  // ช่อง 17 = null / undefined ก็ต้องจับได้
  const arr3 = new Array(SLOT_COUNT).fill('000000');
  arr3[SUBTRACT_SLOT_INDEX] = null;
  t('ช่อง 17 = null → ไม่ ok', !validateSlots(arr3).ok);
}
{
  const v = validateSlots(['123']);
  t('จำนวนช่องผิด → error', !v.ok);
}
{
  const v = validateSlots(S('12345'));  // 5 หลัก
  t('5 หลัก → warning', v.warnings.length > 0);
}

/* ================================================================ */
sect('6. ★ ตรวจรางวัลโพย');
{
  const slots = S();
  slots[0] = '123456';
  const r = computeResult(slots);  // result=123456, top3=456, top2=56, bottom2=34, last1=6
  const rates = defaultRateMap();

  const { payout, details } = evaluateBets20([
    { number: '456', type: '3ตัวบน', amount: 100 },
    { number: '56',  type: '2ตัวบน', amount: 100 },
    { number: '34',  type: '2ตัวล่าง', amount: 100 },
    { number: '6',   type: '1ตัว',    amount: 100 },
  ], r, rates);

  eq(details[0].won, true,  '3 ตัวบน 456 ถูก');
  eq(details[1].won, true,  '2 ตัวบน 56 ถูก');
  eq(details[2].won, true,  '2 ตัวล่าง 34 ถูก');
  eq(details[3].won, true,  '1 ตัว 6 ถูก');
  eq(details[0].winAmount, 100 * 900, '3 ตัวบน จ่าย 900 เท่า = 90,000');
  eq(details[1].winAmount, 100 * 95,  '2 ตัวบน จ่าย 95 เท่า = 9,500');
  eq(details[2].winAmount, 100 * 95,  '2 ตัวล่าง จ่าย 95 เท่า = 9,500');
  eq(details[3].winAmount, 100 * 3.2, '1 ตัว จ่าย 3.2 เท่า = 320');
  eq(payout, 90000 + 9500 + 9500 + 320, 'รวมจ่าย = 109,320');
}
{
  const slots = S();
  slots[0] = '123456';
  const r = computeResult(slots);
  const { payout, details } = evaluateBets20([
    { number: '999', type: '3ตัวบน', amount: 100 },
  ], r, defaultRateMap());
  eq(details[0].won, false, 'เลขไม่ถูก');
  eq(payout, 0, 'ไม่จ่าย');
}
{
  // โต๊ด — สลับหลัก
  const slots = S();
  slots[0] = '123456';   // top3 = 456
  const r = computeResult(slots);
  const { details } = evaluateBets20([
    { number: '654', type: '3ตัวโต๊ด', amount: 100 },
  ], r, defaultRateMap());
  eq(details[0].won, true, '654 โต๊ดกับ 456 → ถูก');
  eq(details[0].winAmount, 100 * 150, 'โต๊ดจ่าย 150 เท่า');
}
{
  // ส่งผลเป็น string ตรงๆ ได้
  const { details } = evaluateBets20([{ number: '456', type: '3ตัวบน', amount: 50 }], '123456', defaultRateMap());
  eq(details[0].won, true, 'ส่งผลเป็น string ก็ทำงาน');
}

/* ================================================================ */
sect('7. analyzeRoundExposure');
{
  const bets = [
    { number: '456', type: '3ตัวบน', amount: 100 },
    { number: '123', type: '3ตัวบน', amount: 200 },
    { number: '56',  type: '2ตัวบน', amount: 500 },
  ];
  const e = analyzeRoundExposure(bets, defaultRateMap());
  eq(e.totalBet, 800, 'ยอดรับรวม = 800');
  eq(e.byNumber.size, 3, 'มี 3 รายการไม่ซ้ำ');
  t('worstNumbers ไม่ว่าง', e.worstNumbers.length > 0);
  const worst = e.worstNumbers[0];
  eq(worst.number, '123', 'แย่สุดคือ 123 (จ่าย 180,000)');
  eq(worst.payout, 200 * 900, 'จ่าย 180,000');
  eq(worst.profit, 800 - 180000, 'กำไรติดลบ');
}

/* ================================================================ */
sect('8. ★ อัตราจ่าย + margin');
t('มี 5 ประเภท', DEFAULT_PAYOUT_RATES.length === 5);
t('ทุกตัวมี rate > 0', DEFAULT_PAYOUT_RATES.every(r => r.rate > 0));
t('ทุกตัวมี odds > 0', DEFAULT_PAYOUT_RATES.every(r => r.odds > 0));
t('ทุกตัวมีคำอธิบาย', DEFAULT_PAYOUT_RATES.every(r => r.desc && r.desc.length > 5));

const m = calcHouseMargin();
console.log(`     margin เฉลี่ย = ${m.marginPercent.toFixed(2)}%  |  แย่สุด ${m.worstPercent.toFixed(2)}%  |  ดีสุด ${m.bestPercent.toFixed(2)}%`);
console.log(`     ${m.verdict}`);
t('★ margin แย่สุดเป็นบวก (เจ้ามือได้เปรียบ)', m.worstPercent > 0, `${m.worstPercent.toFixed(2)}%`);
t('margin เฉลี่ยอยู่ในช่วง 5-30%', m.marginPercent >= 5 && m.marginPercent <= 30, `${m.marginPercent.toFixed(2)}%`);
t('breakdown ครบ 5', m.breakdown.length === 5);
t('ทุกประเภทมี marginPercent', m.breakdown.every(b => typeof b.marginPercent === 'number'));
t('3 ตัวบน margin 10%', Math.abs(m.breakdown.find(b => b.key === '3ตัวบน').marginPercent - 10) < 0.01);

const rm = defaultRateMap();
eq(rm['3ตัวบน'], 900, 'rate 3ตัวบน = 900');
eq(rm['2ตัวบน'], 95, 'rate 2ตัวบน = 95');

/* ================================================================ */
sect('9. สุ่ม + seed');
{
  const s = randomSlots();
  eq(s.length, 20, 'randomSlots ได้ 20 ช่อง');
  t('ทุกช่อง 6 หลัก', s.every(v => /^\d{6}$/.test(v)));
  const a = seededSlots(12345), b = seededSlots(12345);
  t('seed เดิม → ผลเดิม (ทำซ้ำได้)', JSON.stringify(a) === JSON.stringify(b));
  const c = seededSlots(99999);
  t('seed ต่าง → ผลต่าง', JSON.stringify(a) !== JSON.stringify(c));
}

/* ================================================================ */
sect('10. แสดงผล');
{
  const slots = S();
  slots[0] = '123456';
  const r = computeResult(slots);
  eq(formatResult(r.result), '123-456', 'formatResult = 123-456');
  t('explainFormula มี mod', explainFormula(r).includes('mod'));
  const d = computeResultDetailed(slots);
  eq(d.steps.length, 4, 'detailed มี 4 ขั้น');
  eq(d.steps[3].value, '123456', 'ขั้นที่ 4 = ผลลัพธ์');
}

/* ================================================================ */
sect('11. ทดสอบสูตรกับค่าที่ตั้งใจออก (บอทออกผล)');
{
  // อยากได้ผล 777777 → ตั้งช่อง 1 = 777777, ช่อง 17 = 0
  const slots = S();
  slots[0] = '777777';
  eq(computeResult(slots).result, '777777', 'ตั้ง 777777 → ได้ 777777');

  // อยากได้ 000000 → ต้องให้ sum − slot17 = 0 (mod 1e6)
  // วางช่อง 1 = 500000 และช่อง 17 = 500000 → sum=1000000, raw=500000 ... ไม่ใช่ 0
  // วิธีถูก: ให้ sum ทั้งหมด = slot17 พอดี → ช่องอื่นเป็น 0, ช่อง17 = X
  //   sum = X, slot17 = X → raw = 0 → result = 000000
  const s2 = S();
  s2[16] = '000000';
  eq(computeResult(s2).result, '000000', 'ทุกช่อง 0 → 000000');

  const s2b = S();
  s2b[16] = '500000';    // มีแค่ช่อง 17 = 500000
  const r2b = computeResult(s2b);
  eq(r2b.sum, 500000, 'Σ = 500,000');
  eq(r2b.raw, 0, 'ลบตัวเอง = 0');
  eq(r2b.result, '000000', 'ได้ 000000');

  // วางเป้าหมายได้ตรงๆ ด้วยช่องที่ 1 (เมื่อช่อง 17 = 0)
  ['111111','222222','333333','123456','999999','000001'].forEach(target => {
    const s3 = S();
    s3[0] = target;
    eq(computeResult(s3).result, target, `ตั้งเป้า ${target}`);
  });
}

/* ================================================================ */
sect('12. ★ บอทออกผล — วางเป้าแล้วได้ตามเป้า');
{
  /**
   * วิธีตั้งเป้าผลลัพธ์ให้ได้ค่า X:
   *   ต้องการ (sum − slot17) mod 1e6 = X
   *   วิธีง่ายสุด: วางช่อง 1 = X และช่อง 17 = 0
   *   วิธีสำรอง (ซ่อนไม่ให้สูตรตรงเกินไป): กระจาย X ไปหลายช่อง
   */
  const targets = ['000000', '000001', '500000', '999999', '123456'];
  targets.forEach(X => {
    const slots = S();
    slots[0] = X;
    eq(computeResult(slots).result, X, `เป้า ${X} (วิธีตรง)`);
  });

  // ★ วิธีกระจาย 2 ช่อง (ช่องอื่นเป็น 0 ยกเว้นช่อง 17 ที่มีค่าได้)
  const X = '777777';
  const sol2 = solveSlotsForResult(X, { fillCount: 2, extraRounds: 1, seed: 42, lockOthers: true });
  eq(sol2.achieved, X, `★ กระจาย 2 ช่อง → เป้า ${X} สำเร็จ`);
  eq(sol2.ok, true, 'solver รายงาน ok');
  const used = sol2.slots.filter((v, i) => v !== '000000' && i !== SUBTRACT_SLOT_INDEX).length;
  eq(used, 2, '★ ใช้ 2 ช่องที่มีผล (ไม่นับช่อง 17)');
}

/* ================================================================ */
sect('13. ★ Solver — วางเลขให้ได้ผลตามเป้า');
{
  // เป้าหมายยอดนิยม
  ['000000','000001','111111','123456','314159','500000','777777','999999','246813','987654'].forEach(X => {
    const s = solveSlotsNatural(X, 1234);
    eq(s.achieved, X, `★ natural solver → ${X}`);
    t(`  ok=true สำหรับ ${X}`, s.ok);
  });

  // กระจายทุกช่อง — ไม่ทิ้งร่องรอย
  const nat = solveSlotsNatural('314159', 777);
  const nonzero = nat.slots.filter(v => v !== '000000').length;
  t(`★ ใช้ ${nonzero}/20 ช่อง (ไม่ทิ้งร่องรอย)`, nonzero >= 18);
  eq(nat.slots.length, 20, 'ได้ 20 ช่อง');
  t('ทุกช่อง 6 หลัก', nat.slots.every(v => /^\d{6}$/.test(v)));
  t('ยอดรวมมากกว่า 1 รอบ (ดูธรรมชาติ)', nat.sumUsed > RESULT_MODULO);

  // ตรวจว่าไม่ใช่ "ช่อง 1 = ผลลัพธ์" แบบตรงๆ
  t('★ ช่อง 1 ไม่เท่ากับผลลัพธ์ตรงๆ', nat.slots[0] !== '314159');

  // seed เดิม → ผลเดิม
  const a = solveSlotsNatural('555555', 999);
  const b = solveSlotsNatural('555555', 999);
  t('seed เดิม → เลขชุดเดิม (ทำซ้ำได้)', JSON.stringify(a.slots) === JSON.stringify(b.slots));

  // seed ต่าง → เลขชุดต่าง (แต่ผลลัพธ์เดียวกัน)
  const c = solveSlotsNatural('555555', 111);
  const d = solveSlotsNatural('555555', 222);
  t('seed ต่าง → เลขชุดต่าง', JSON.stringify(c.slots) !== JSON.stringify(d.slots));
  eq(c.achieved, '555555', 'seed 111 → ผลถูก');
  eq(d.achieved, '555555', 'seed 222 → ผลถูก');

  // ล็อกบางช่อง
  const locked = solveSlotsForResult('888888', { lockedSlots: { 0: '123456', 16: '654321' }, seed: 5 });
  eq(locked.slots[0], '123456', 'ช่อง 1 ตามที่ล็อก');
  eq(locked.slots[16], '654321', 'ช่อง 17 ตามที่ล็อก');
  eq(locked.achieved, '888888', '★ ล็อกช่องแล้วยังได้ผลตามเป้า');

  // 100 เป้าหมายสุ่ม — ต้องได้ครบทุกครั้ง
  let hits = 0;
  for (let i = 0; i < 100; i++) {
    const tgt = padNum((i * 7919) % RESULT_MODULO);
    const r = solveSlotsNatural(tgt, i + 1);
    if (r.achieved === tgt) hits++;
  }
  eq(hits, 100, '★ สุ่ม 100 เป้าหมาย → สำเร็จ 100/100');
}

/* ================================================================ */
console.log(`\n${'='.repeat(52)}`);
console.log(`  ผ่าน ${pass}  |  ไม่ผ่าน ${fail}  |  รวม ${pass + fail}`);
console.log('='.repeat(52));
process.exit(fail > 0 ? 1 : 0);
