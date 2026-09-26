/**
 * __test_bots.mjs — ทดสอบบอท 2 ตัว
 * รัน: npx tsx __test_bots.mjs
 */
import {
  SeededRng, runResultBot, runNumberBot, buildBotReport,
  generatePlayerSlots, rotateDigitsInSlot, maxAvoidableCoverage,
  DEFAULT_RESULT_BOT, DEFAULT_NUMBER_BOT,
} from './src/shared/lib/bots.ts';
import {
  computeResult, evaluateBets20, defaultRateMap, padNum, SLOT_COUNT, digitsOnly,
} from './src/shared/lib/lottery20.ts';

let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}  ${e}`); } };
const eq = (a, b, n) => t(n, a === b, `ได้ ${JSON.stringify(a)} คาด ${JSON.stringify(b)}`);
const sect = n => console.log(`\n── ${n} ──`);

/* ================================================================ */
sect('1. SeededRng');
{
  const a = new SeededRng(123), b = new SeededRng(123);
  const seqA = Array.from({ length: 10 }, () => a.next());
  const seqB = Array.from({ length: 10 }, () => b.next());
  t('seed เดิม → ลำดับเดิม', JSON.stringify(seqA) === JSON.stringify(seqB));
  t('ค่าอยู่ในช่วง 0-1', seqA.every(v => v >= 0 && v < 1), seqA.join(','));

  const c = new SeededRng(999);
  const seqC = Array.from({ length: 10 }, () => c.next());
  t('seed ต่าง → ลำดับต่าง', JSON.stringify(seqA) !== JSON.stringify(seqC));

  const r = new SeededRng(42);
  const sh = r.shuffle([1,2,3,4,5,6,7,8,9,10]);
  eq(sh.length, 10, 'shuffle รักษาจำนวน');
  t('shuffle มีครบทุกตัว', [1,2,3,4,5,6,7,8,9,10].every(x => sh.includes(x)));
  t('shuffle แล้วลำดับเปลี่ยน', JSON.stringify(sh) !== JSON.stringify([1,2,3,4,5,6,7,8,9,10]));
}

/* ================================================================ */
sect('2. ★ บอทออกผล — โหมด fair');
{
  const bets = [
    { number: '456', type: '3ตัวบน', amount: 100 },
    { number: '123', type: '3ตัวบน', amount: 200 },
  ];
  const r = await runResultBot(bets, defaultRateMap(), { ...DEFAULT_RESULT_BOT, mode: 'fair' });
  t('ได้ผล 6 หลัก', /^\d{6}$/.test(r.result));
  eq(r.slots.length, SLOT_COUNT, 'ได้ 20 ช่อง');
  t('★ วางเลขแล้วได้ผลตรง (verified)', r.verified);
  eq(computeResult(r.slots).result, r.result, 'คำนวณซ้ำได้ผลเดิม');
  eq(r.mode, 'fair', 'โหมด fair');
}
{
  // บอทปิด → ต้องสุ่มบริสุทธิ์
  const r = await runResultBot([], defaultRateMap(), { enabled: false });
  t('บอทปิด → ยังออกผลได้', /^\d{6}$/.test(r.result));
  t('บอทปิด → ระบุว่า fair', r.reason.includes('สุ่มบริสุทธิ์'));
}

/* ================================================================ */
sect('3. ★ บอทออกผล — โหมด profit (กำไรสูงสุด)');
{
  const bets = [
    { number: '456', type: '3ตัวบน', amount: 100 },
    { number: '999', type: '3ตัวบน', amount: 100 },
  ];
  const r = await runResultBot(bets, defaultRateMap(), {
    ...DEFAULT_RESULT_BOT, mode: 'profit', candidates: 2000, seed: 7,
  });
  t('ได้ผล 6 หลัก', /^\d{6}$/.test(r.result));
  t('★ verified', r.verified);
  t('กำไร >= 0', r.profit >= 0, `กำไร ${r.profit}`);
  t('พิจารณาหลายผล', r.examined > 100, `${r.examined}`);
  console.log(`     ผล=${r.result} ยอดรับ=฿${r.totalBet} จ่าย=฿${r.payout} กำไร=฿${r.profit} (${r.profitPercent.toFixed(1)}%)`);
}

/* ================================================================ */
sect('4. ★ บอทออกผล — โหมด avoid (ห้ามมีคนถูก)');
{
  // แทงเลข 3 ตัว 1 ชุด → โอกาสถูก 1/1000 → ห้ามถูกทำได้
  const bets = [{ number: '456', type: '3ตัวบน', amount: 100 }];
  const r = await runResultBot(bets, defaultRateMap(), {
    ...DEFAULT_RESULT_BOT, mode: 'avoid', avoidAllWinners: true, candidates: 500, seed: 11,
  });
  eq(r.winCount, 0, '★ ไม่มีผู้ชนะเลย');
  eq(r.payout, 0, 'ไม่จ่ายเลย');
  t('กำไร = ยอดรับทั้งหมด', r.profit === r.totalBet, `${r.profit} vs ${r.totalBet}`);
  t('★ verified', r.verified);
  console.log(`     ผล=${r.result} เหตุผล=${r.reason}`);
}
{
  // ★ ทดสอบว่า "เลี่ยงไม่ได้" จริง — แทง 1 ตัวครบ 10 หลัก
  const bets = '0123456789'.split('').map(d => ({ number: d, type: '1ตัว', amount: 10 }));
  const cov = maxAvoidableCoverage(bets);
  eq(cov.avoidable, false, '★ แทงครบ 10 หลัก → เลี่ยงไม่ได้');
  t('แจ้งเตือนถูกต้อง', cov.note.includes('เลี่ยงผู้ชนะไม่ได้'), cov.note);
  console.log(`     coverage=${cov.coveragePercent.toFixed(0)}%  ${cov.note}`);
}
{
  const bets = [{ number: '456', type: '3ตัวบน', amount: 100 }];
  const cov = maxAvoidableCoverage(bets);
  eq(cov.avoidable, true, 'แทงน้อย → เลี่ยงได้');
}

/* ================================================================ */
sect('5. ★ บอทออกผล — โหมด balance');
{
  const bets = [
    { number: '456', type: '3ตัวบน', amount: 100 },
    { number: '123', type: '3ตัวบน', amount: 100 },
    { number: '789', type: '3ตัวบน', amount: 100 },
    { number: '56',  type: '2ตัวบน', amount: 200 },
  ];
  const r = await runResultBot(bets, defaultRateMap(), {
    ...DEFAULT_RESULT_BOT, mode: 'balance', targetPayoutPercent: 60, candidates: 1500, seed: 3,
  });
  const target = r.totalBet * 0.6;
  t('★ verified', r.verified);
  t('จ่ายไม่เกินเพดาน', r.payout <= DEFAULT_RESULT_BOT.maxPayoutPerRound);
  console.log(`     ยอดรับ=฿${r.totalBet} เป้า=฿${target.toFixed(0)} จ่ายจริง=฿${r.payout} ต่าง=฿${Math.abs(r.payout-target).toFixed(0)}`);
  t('เข้าใกล้เป้า (ต่างไม่เกิน 150%)', Math.abs(r.payout - target) <= target * 1.5 || r.payout === 0);
}

/* ================================================================ */
sect('6. ★ บอทออกผล — โหมด target (ตั้งผลเอง)');
{
  const targets = ['000000', '123456', '777777', '999999'];
  for (const X of targets) {
    const r = await runResultBot([], defaultRateMap(), {
      ...DEFAULT_RESULT_BOT, mode: 'target', forcedResult: X, seed: 5,
    });
    eq(r.result, X, `★ ตั้งผล ${X} → ได้ตามที่ตั้ง`);
    eq(computeResult(r.slots).result, X, `  เลขที่วางให้ผล ${X} จริง`);
    t(`  verified`, r.verified);
  }
}

/* ================================================================ */
sect('7. ★ บอทวางเลข — สลับคน');
{
  const players = generatePlayerSlots(20, { seed: 100 });
  const before = players.map(p => p.result);

  const out = runNumberBot(players, { enabled: true, seed: 555 });
  eq(out.assignments.length, 20, 'ได้ผู้เล่นครบ 20');
  const after = out.assignments.map(a => a.result);
  t('★ ลำดับผลถูกรบกวน', JSON.stringify(before) !== JSON.stringify(after));
  t('ทุกคนยังมีเลข 20 ช่อง', out.assignments.every(a => a.slots.length === 20));
  t('ผลของแต่ละคนตรงกับเลขตัวเอง', out.assignments.every(a => computeResult(a.slots).result === a.result));
  t('สลับไปมากกว่า 50%', out.changedPercent > 50, `${out.changedPercent.toFixed(0)}%`);
  console.log(`     ${out.note}`);
  console.log(`     บันทึกการสลับ ${out.swaps.length} รายการ`);
}

/* ================================================================ */
sect('8. ★ บอทวางเลข — ทุกแผนต้องทำงาน');
{
  const players = generatePlayerSlots(15, { seed: 200 });
  const plans = ['shuffle','rotate','mirror','chunk','cross','random'];
  plans.forEach(plan => {
    const out = runNumberBot(players, { enabled: true, plan, seed: 321, randomizeEachRound: false, passes: 2 });
    t(`แผน ${plan.padEnd(8)} → สลับ ${out.changedPercent.toFixed(0)}%`, out.changedPercent > 0 || plan === 'mirror');
    t(`  ผลตรงกับเลข`, out.assignments.every(a => computeResult(a.slots).result === a.result));
  });
}

/* ================================================================ */
sect('9. ★ ไม่ให้ AI จับทางได้');
{
  const players = generatePlayerSlots(20, { seed: 300 });
  // รัน 10 รอบด้วย seed ต่าง → แผนที่ใช้ต้องหลากหลาย
  const plansUsed = new Set();
  const noteSet = new Set();
  for (let i = 1; i <= 20; i++) {
    const out = runNumberBot(players, { enabled: true, seed: i * 7919, randomizeEachRound: true });
    plansUsed.add(out.planUsed);
    noteSet.add(out.note);
  }
  t(`★ ใช้หลายแผน (${plansUsed.size} แบบ)`, plansUsed.size >= 3, [...plansUsed].join(','));
  t(`★ ผลลัพธ์หลากหลาย (${noteSet.size} แบบ)`, noteSet.size >= 8, `${noteSet.size}`);

  // seed เดิม → ผลเดิม (ตรวจสอบย้อนหลังได้)
  const a = runNumberBot(players, { enabled: true, seed: 444 });
  const b = runNumberBot(players, { enabled: true, seed: 444 });
  t('seed เดิม → ผลเดิม (audit ได้)', JSON.stringify(a.assignments.map(x => x.result)) === JSON.stringify(b.assignments.map(x => x.result)));

  // seed ต่าง → ผลต่าง
  const c = runNumberBot(players, { enabled: true, seed: 111 });
  const d = runNumberBot(players, { enabled: true, seed: 222 });
  t('seed ต่าง → ผลต่าง', JSON.stringify(c.assignments.map(x => x.result)) !== JSON.stringify(d.assignments.map(x => x.result)));
}

/* ================================================================ */
sect('10. rotateDigitsInSlot');
{
  eq(rotateDigitsInSlot('123456', 1), '612345', 'หมุน 1');
  eq(rotateDigitsInSlot('123456', 2), '561234', 'หมุน 2');
  eq(rotateDigitsInSlot('123456', 6), '123456', 'หมุน 6 = เดิม');
  eq(rotateDigitsInSlot('123456', 0), '123456', 'หมุน 0 = เดิม');
  eq(rotateDigitsInSlot('123456', 7), '612345', 'หมุน 7 = หมุน 1');
}
{
  const players = generatePlayerSlots(10, { seed: 400 });
  const out = runNumberBot(players, { enabled: true, seed: 9, rotateDigits: true, digitRotations: 2, randomizeEachRound: false });
  t('หมุนหลักแล้วยังคำนวณได้', out.assignments.every(a => a.slots.every(s => /^\d{6}$/.test(s))));
  t('ผลตรงกับเลข', out.assignments.every(a => computeResult(a.slots).result === a.result));
}

/* ================================================================ */
sect('11. ขอบเขต');
{
  eq(runNumberBot([]).assignments.length, 0, 'ไม่มีผู้เล่น → คืนว่าง');
  const one = runNumberBot(generatePlayerSlots(1, { seed: 1 }), { seed: 2 });
  eq(one.assignments.length, 1, 'ผู้เล่น 1 คน → ทำงานได้');
  eq(one.changedPercent, 0, 'คนเดียว → เปลี่ยน 0%');

  const two = runNumberBot(generatePlayerSlots(2, { seed: 1 }), { seed: 3, randomizeEachRound: false, plan: 'mirror' });
  eq(two.changedPercent, 100, '2 คน mirror → สลับกันทั้งคู่');
}

/* ================================================================ */
sect('12. buildBotReport');
{
  const bets = [{ number: '456', type: '3ตัวบน', amount: 100 }];
  const r = await runResultBot(bets, defaultRateMap(), { ...DEFAULT_RESULT_BOT, mode: 'profit', seed: 77, candidates: 300 });
  const n = runNumberBot(generatePlayerSlots(5, { seed: 5 }), { seed: 6 });
  const rep = buildBotReport(r, n, { enabled: true, mode: 'profit' }, { enabled: true, plan: 'shuffle' });

  t('บอทออกผล enabled', rep.resultBot.enabled);
  eq(rep.resultBot.mode, 'profit', 'โหมดถูก');
  t('lastResult 6 หลัก', /^\d{6}$/.test(rep.resultBot.lastResult));
  t('verified = true', rep.resultBot.verified);
  t('บอทวางเลข enabled', rep.numberBot.enabled);
  t('มีหมายเหตุการสลับ', rep.numberBot.lastNote.length > 5);
  t('economics ครบ', typeof rep.economics.totalBet === 'number');
  t('warnings เป็น array', Array.isArray(rep.warnings));
  console.log(`     economics: รับ ฿${rep.economics.totalBet} จ่าย ฿${rep.economics.payout} กำไร ฿${rep.economics.profit}`);
  if (rep.warnings.length) console.log(`     warnings: ${rep.warnings.join(' | ')}`);
}
{
  const rep = buildBotReport(null, null, { enabled: false }, { enabled: false });
  t('บอทปิด → มีคำเตือน', rep.warnings.some(w => w.includes('ปิดอยู่')), rep.warnings.join('|'));
}

/* ================================================================ */
sect('13. ★ รัน 50 รอบ — ต้องไม่มี error');
{
  let ok = 0, verified = 0;
  for (let i = 1; i <= 50; i++) {
    const bets = [{ number: padNum((i * 1237) % 1000, 3), type: '3ตัวบน', amount: 50 }];
    const modes = ['fair','profit','balance','avoid'];
    const mode = modes[i % modes.length];
    const r = await runResultBot(bets, defaultRateMap(), { ...DEFAULT_RESULT_BOT, mode, seed: i, candidates: 100 });
    if (r.result && r.slots.length === 20) ok++;
    if (r.verified) verified++;
  }
  eq(ok, 50, '★ 50/50 รันสำเร็จ');
  eq(verified, 50, '★ 50/50 verified (เลขตรงผล)');
}

/* ================================================================ */
console.log(`\n${'='.repeat(52)}`);
console.log(`  ผ่าน ${pass}  |  ไม่ผ่าน ${fail}  |  รวม ${pass + fail}`);
console.log('='.repeat(52));
process.exit(fail > 0 ? 1 : 0);
