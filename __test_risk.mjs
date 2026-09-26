/**
 * __test_risk.mjs — B2: ทดสอบระบบจำกัดความเสี่ยง
 * รัน: npx tsx __test_risk.mjs
 */
import {
  DEFAULT_RISK_LIMITS, checkBetRisk, checkSlipRisk, summarizeExposure,
  maxAcceptable, suggestLimits, riskSummary,
} from './src/shared/lib/game20Risk.ts';
import { addToSlip } from './src/shared/lib/game20BetSlip.ts';

let pass = 0, fail = 0;
const fails = [];
function eq(a, e, label) {
  const A = JSON.stringify(a), E = JSON.stringify(e);
  if (A === E) pass++;
  else { fail++; fails.push(`${label}\n     ได้: ${A}\n     ต้องได้: ${E}`); }
}
function ok(c, label) { eq(!!c, true, label); }

const LIM = { ...DEFAULT_RISK_LIMITS };

console.log('═══ 1) ตรวจรายการปกติ (ไม่เกินเพดาน) ═══');
let r = checkBetRisk({ kind: '3ตัวบน', number: '456', amount: 100 }, [], LIM);
eq(r.level, 'ok', 'รายการเล็ก → ปกติ');
eq(r.blocked, false, 'ไม่บล็อก');
eq(r.items[0].afterPayout, 90000, 'จ่าย 100×900 = 90,000');

console.log('\n═══ 2) เกินเพดานจ่ายต่อเลข → บล็อก ═══');
// เพดานต่อเลข 500,000 → 3ตัวบน 900× → รับได้ไม่เกิน 555 บาท
r = checkBetRisk({ kind: '3ตัวบน', number: '456', amount: 600 }, [], LIM);
eq(r.level, 'block', '600×900=540,000 เกิน 500,000 → บล็อก');
eq(r.blocked, true, 'blocked = true');
ok(r.messages.some(m => m.includes('จ่ายทะลุเพดาน')), 'ข้อความบอกจ่ายทะลุเพดาน');

// 555 = 499,500 = 99.9% ของเพดาน → ถูกต้องคือ warn (ใกล้เพดานมาก)
r = checkBetRisk({ kind: '3ตัวบน', number: '456', amount: 555 }, [], LIM);
eq(r.level, 'warn', '555×900=499,500 (99.9%) → warn ไม่บล็อก');

console.log('\n═══ 3) ระดับ warn (70–100% ของเพดาน) ═══');
// warn ที่ 70% ของ 500,000 = 350,000 → 350,000/900 = 388.9 → 389 บาท
r = checkBetRisk({ kind: '3ตัวบน', number: '456', amount: 400 }, [], LIM);
eq(r.level, 'warn', '400×900=360,000 (72% ของ 500k) → warn');
eq(r.blocked, false, 'warn ไม่บล็อก');

console.log('\n═══ 4) สะสมกับของเดิม ═══');
const existing = [
  { type: '3ตัวบน', number: '456', amount: 300, rate: 900 }, // จ่ายไป 270,000
];
// เหลือ headroom = 500,000 - 270,000 = 230,000 → 230,000/900 = 255.5 → รับได้ 255
r = checkBetRisk({ kind: '3ตัวบน', number: '456', amount: 300 }, existing, LIM);
eq(r.level, 'block', 'เดิม 300 + ใหม่ 300 = 540,000 เกิน → บล็อก');
eq(r.items[0].accepted, 300, 'ยอดเดิม 300');
eq(r.items[0].afterPayout, 540000, 'จ่ายหลังรับ 540,000');

r = checkBetRisk({ kind: '3ตัวบน', number: '456', amount: 250 }, existing, LIM);
eq(r.level, 'warn', 'รับเพิ่ม 250 → รวม 495,000 (99% ของ 500k) → warn');

console.log('\n═══ 5) เพดานรับต่อเลข ═══');
const LIM_ACCEPT = { ...LIM, maxAcceptPerNumber: 1000, maxPayoutPerNumber: 99_000_000, maxPayoutPerPlayer: 99_000_000, maxPayoutPerRound: 99_000_000, bankrollReserve: 99_000_000 };
r = checkBetRisk({ kind: '3ตัวบน', number: '111', amount: 500 }, [], LIM_ACCEPT);
eq(r.level, 'ok', 'รับ 500 ไม่เกิน 1000 → ปกติ');
r = checkBetRisk(
  { kind: '3ตัวบน', number: '111', amount: 600 },
  [{ type: '3ตัวบน', number: '111', amount: 500, rate: 900 }],
  LIM_ACCEPT,
);
eq(r.level, 'block', 'รับ 500+600=1100 เกิน 1000 → บล็อก');
ok(r.messages.some(m => m.includes('รับเกินเพดาน')), 'ข้อความบอกรับเกิน');

console.log('\n═══ 6) เพดานต่อผู้เล่น ═══');
const LIM_PLAYER = { ...LIM, maxPayoutPerPlayer: 50_000, maxPayoutPerNumber: 99_000_000, maxPayoutPerRound: 99_000_000, maxAcceptPerNumber: 99_000_000, bankrollReserve: 99_000_000 };
// 50,000/900 = 55.5 → เกิน 56 บาท
r = checkBetRisk({ kind: '3ตัวบน', number: '222', amount: 60 }, [], LIM_PLAYER, {}, 0);
eq(r.level, 'block', '56×900=50,400 เกิน 50,000 → บล็อก');
ok(r.messages.some(m => m.includes('ผู้เล่นรายนี้')), 'ข้อความบอกเพดานผู้เล่น');

// แทงไปแล้ว 40 บาท + ใหม่ 20 = 60 → 54,000 เกิน
r = checkBetRisk({ kind: '3ตัวบน', number: '222', amount: 20 }, [], LIM_PLAYER, {}, 40);
eq(r.level, 'block', 'สะสมผู้เล่น 40+20=60 → บล็อก');

console.log('\n═══ 7) เพดานต่อรอบ ═══');
const LIM_ROUND = { ...LIM, maxPayoutPerRound: 100_000, maxPayoutPerNumber: 99_000_000, maxPayoutPerPlayer: 99_000_000, maxAcceptPerNumber: 99_000_000, bankrollReserve: 99_000_000 };
r = checkBetRisk({ kind: '3ตัวบน', number: '333', amount: 200 }, [], LIM_ROUND);
eq(r.level, 'block', '200×900=180,000 เกินเพดานรอบ 100,000 → บล็อก');
ok(r.messages.some(m => m.includes('รอบนี้จ่ายทะลุเพดาน')), 'ข้อความบอกเพดานรอบ');

console.log('\n═══ 8) ทุนสำรองไม่พอ ═══');
const LIM_BANK = {
  ...LIM, bankrollReserve: 50_000, maxPayoutPerNumber: 99_000_000,
  maxPayoutPerRound: 99_000_000, maxPayoutPerPlayer: 99_000_000, warnAtPercent: 70,
};
r = checkBetRisk({ kind: '3ตัวบน', number: '444', amount: 100 }, [], LIM_BANK);
// รับ 100 จ่าย 90,000 สำรอง 50,000 → 100-90,000 = -89,900 ติดลบ
eq(r.level, 'block', 'สำรอง 50,000 แต่จ่าย 90,000 → บล็อก');
ok(r.messages.some(m => m.includes('ทุนสำรองไม่พอ')), 'ข้อความบอกสำรองไม่พอ');
eq(r.round.reserveAfterWorst, 50000 + 100 - 90000, 'สำรองติดลบ -39,900... คำนวณถูก');

console.log('\n═══ 9) ไม่บล็อกถ้าตั้ง blockOnExceed=false ═══');
const LIM_SOFT = { ...LIM, blockOnExceed: false };
r = checkBetRisk({ kind: '3ตัวบน', number: '456', amount: 600 }, [], LIM_SOFT);
eq(r.level, 'warn', 'โหมดเตือน → warn ไม่บล็อก');
eq(r.blocked, false, 'blocked = false');

console.log('\n═══ 10) summarizeExposure ═══');
const bets = [
  { type: '3ตัวบน', number: '456', amount: 100, rate: 900 },
  { type: '3ตัวบน', number: '456', amount: 50, rate: 900 },
  { type: '2ตัวบน', number: '56', amount: 200, rate: 95 },
];
const ex = summarizeExposure(bets);
eq(ex.totalAccepted, 350, 'รับรวม 350');
eq(ex.byNumber.size, 2, 'มี 2 เลข+ประเภท');
eq(ex.byNumber.get('3ตัวบน|456').accepted, 150, '3ตัวบน 456 รับ 150');
eq(ex.byNumber.get('3ตัวบน|456').payout, 135000, 'จ่าย 135,000');
eq(ex.worstCasePayout, 135000, 'หนักสุด 135,000');
ok(ex.worstNumber.includes('456'), 'เลขหนักสุดคือ 456');

console.log('\n═══ 11) maxAcceptable ═══');
const ma = maxAcceptable(
  '3ตัวบน', '456',
  [{ type: '3ตัวบน', number: '456', amount: 300, rate: 900 }],
  LIM,
);
// headroom = 500,000 - 270,000 = 230,000 → /900 = 255
eq(ma.byPayout, 255, 'รับได้อีก 255 (จากเพดานจ่าย)');
eq(ma.byAccept, 10000 - 300, 'รับได้อีก 9,700 (จากเพดานรับ)');
eq(ma.final, 255, 'สรุป 255 (เพดานจ่ายจำกัด)');
ok(ma.reason.includes('เพดานจ่าย'), 'บอกว่าจำกัดโดยเพดานจ่าย');

const ma2 = maxAcceptable('3ตัวบน', '999', [], LIM);
eq(ma2.final, 555, 'เลขใหม่รับได้ 555 (555×900=499,500)');

console.log('\n═══ 12) checkSlipRisk (ทั้งตะกร้า) ═══');
let slip = addToSlip([], '3ตัวบน', '456', 100);
slip = addToSlip(slip, '2ตัวบน', '56', 50);
r = checkSlipRisk(slip, [], LIM);
eq(r.level, 'ok', 'ตะกร้าเล็ก → ปกติ');
eq(r.items.length, 2, 'ตรวจ 2 รายการ');
eq(r.round.totalAccepted, 150, 'รับรวม 150');

// ตะกร้าที่รวมแล้วเกิน
let big = addToSlip([], '3ตัวบน', '777', 300);
big = addToSlip(big, '3ตัวบน', '777', 300);
r = checkSlipRisk(big, [], LIM);
eq(r.level, 'block', 'ตะกร้ารวม 600×900=540,000 → บล็อก');
eq(r.blocked, true, 'blocked');

console.log('\n═══ 13) ตะกร้าว่าง ═══');
r = checkSlipRisk([], [], LIM);
eq(r.level, 'ok', 'ตะกร้าว่าง → ปกติ');
eq(r.items.length, 0, 'ไม่มีรายการ');
eq(r.blocked, false, 'ไม่บล็อก');

console.log('\n═══ 14) suggestLimits ═══');
const sg = suggestLimits(100000, 20);
eq(sg.limits.maxPayoutPerRound, 80000, 'รับ 100,000 กำไร 20% → เพดานรอบ 80,000');
eq(sg.limits.maxPayoutPerNumber, 20000, 'เพดานต่อเลข 20,000 (25%)');
eq(sg.limits.maxPayoutPerPlayer, 12000, 'เพดานผู้เล่น 12,000 (15%)');
ok(sg.note.includes('20%'), 'คำอธิบายมีเปอร์เซ็นต์');

const sg2 = suggestLimits(50000, 0);
eq(sg2.limits.maxPayoutPerRound, 50000, 'กำไร 0% → เพดาน = ยอดรับ');

console.log('\n═══ 15) riskSummary ═══');
eq(riskSummary({ level: 'ok', blocked: false, messages: [], items: [], round: { worstCasePayout: 1000 } }).includes('✅'), true, 'ok → ✅');
eq(riskSummary({ level: 'warn', blocked: false, messages: ['x'], items: [], round: { worstCasePayout: 0 } }).includes('⚠️'), true, 'warn → ⚠️');
eq(riskSummary({ level: 'block', blocked: true, messages: ['x'], items: [], round: { worstCasePayout: 0 } }).includes('⛔'), true, 'block → ⛔');

console.log('\n═══ 16) อัตราจ่ายจาก rateMap ถูกใช้ ═══');
// ส่ง rateMap เอง → ต้องใช้ค่านั้น ไม่ใช่ค่าเริ่มต้น
r = checkBetRisk({ kind: '3ตัวบน', number: '456', amount: 100 }, [], LIM, { '3ตัวบน': 500 });
eq(r.items[0].afterPayout, 50000, 'ใช้ rate จาก rateMap (500×100)');

console.log('\n' + '═'.repeat(56));
console.log(`ผ่าน ${pass}  |  ไม่ผ่าน ${fail}`);
if (fails.length) { console.log('\n★ ที่ไม่ผ่าน:'); fails.forEach(f => console.log('   - ' + f)); }
else console.log('★★★ ระบบจำกัดความเสี่ยงทำงานถูกต้อง ★★★');
console.log('═'.repeat(56));
process.exit(fail ? 1 : 0);
