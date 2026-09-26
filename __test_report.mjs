/** __test_report.mjs — B3: ทดสอบรายงานกำไร-ขาดทุน */
import {
  summarizeRound, groupByDay, groupByMonth, summarizeOverall, rankNumbers,
  buildLineChart, buildBarChart, dayKey, monthKey,
  formatThaiDate, formatThaiMonth, profitColor, sampleRounds,
} from './src/shared/lib/game20Report.ts';

let pass = 0, fail = 0;
const fails = [];
function eq(a, e, label) {
  const A = JSON.stringify(a), E = JSON.stringify(e);
  if (A === E) pass++;
  else { fail++; fails.push(`${label}\n     ได้: ${A}\n     ต้องได้: ${E}`); }
}
function ok(c, label) { eq(!!c, true, label); }

console.log('═══ 1) summarizeRound ═══');
let r = summarizeRound({
  roundId: 'r1', closedAt: '2026-09-26T10:00:00Z',
  totalBet: 10000, totalPayout: 7500, ticketCount: 20, playerCount: 8,
});
eq(r.profit, 2500, 'กำไร 2,500');
eq(r.marginPercent, 25, 'margin 25%');
eq(r.avgPerTicket, 500, 'เฉลี่ย 500/โพย');
eq(r.status, 'profit', 'สถานะ profit');

r = summarizeRound({ roundId: 'r2', closedAt: '2026-09-26T11:00:00Z', totalBet: 5000, totalPayout: 9000, ticketCount: 10, playerCount: 5 });
eq(r.profit, -4000, 'ขาดทุน -4,000');
eq(r.status, 'loss', 'สถานะ loss');
eq(r.marginPercent, -80, 'margin -80%');

r = summarizeRound({ roundId: 'r3', closedAt: '2026-09-26T12:00:00Z', totalBet: 1000, totalPayout: 1000, ticketCount: 5, playerCount: 3 });
eq(r.profit, 0, 'เท่าทุน');
eq(r.status, 'even', 'สถานะ even');

r = summarizeRound({ roundId: 'r4', closedAt: '2026-09-26T13:00:00Z', totalBet: 0, totalPayout: 0, ticketCount: 0, playerCount: 0 });
eq(r.marginPercent, 0, 'รับ 0 → margin 0 (ไม่หารศูนย์)');
eq(r.avgPerTicket, 0, 'โพย 0 → เฉลี่ย 0');

console.log('\n═══ 2) dayKey / monthKey ═══');
eq(dayKey('2026-09-26T10:30:00Z'), '2026-09-26', 'ตัดวัน');
eq(monthKey('2026-09-26T10:30:00Z'), '2026-09', 'ตัดเดือน');
eq(dayKey('2026-09-26'), '2026-09-26', 'รับ YYYY-MM-DD ตรงๆ');
eq(dayKey(''), 'ไม่ทราบ', 'ค่าว่าง → ไม่ทราบ');

console.log('\n═══ 3) groupByDay ═══');
const ROUNDS = [
  { roundId: 'a1', closedAt: '2026-09-24T10:00:00Z', totalBet: 10000, totalPayout: 8000, ticketCount: 10, playerCount: 5 },
  { roundId: 'a2', closedAt: '2026-09-24T14:00:00Z', totalBet: 20000, totalPayout: 15000, ticketCount: 15, playerCount: 7 },
  { roundId: 'b1', closedAt: '2026-09-25T10:00:00Z', totalBet: 5000, totalPayout: 9000, ticketCount: 8, playerCount: 4 },
  { roundId: 'c1', closedAt: '2026-09-26T10:00:00Z', totalBet: 30000, totalPayout: 21000, ticketCount: 25, playerCount: 12 },
];
const days = groupByDay(ROUNDS);
eq(days.length, 3, 'ได้ 3 วัน');
eq(days[0].date, '2026-09-24', 'เรียงจากเก่า→ใหม่');
eq(days[0].roundCount, 2, 'วันแรกมี 2 รอบ');
eq(days[0].totalBet, 30000, 'วันแรก รับ 30,000');
eq(days[0].totalPayout, 23000, 'วันแรก จ่าย 23,000');
eq(days[0].profit, 7000, 'วันแรก กำไร 7,000');
eq(days[1].profit, -4000, 'วันที่ 2 ขาดทุน -4,000');
eq(days[2].profit, 9000, 'วันที่ 3 กำไร 9,000');
ok(days[0].marginPercent > 23 && days[0].marginPercent < 24, 'margin วันแรก ~23.33%');

console.log('\n═══ 4) groupByMonth ═══');
const MANY = [
  { roundId: 'm1', closedAt: '2026-08-01T10:00:00Z', totalBet: 10000, totalPayout: 8000, ticketCount: 5, playerCount: 3 },
  { roundId: 'm2', closedAt: '2026-08-15T10:00:00Z', totalBet: 20000, totalPayout: 12000, ticketCount: 8, playerCount: 4 },
  { roundId: 'm3', closedAt: '2026-09-05T10:00:00Z', totalBet: 50000, totalPayout: 40000, ticketCount: 20, playerCount: 10 },
];
const months = groupByMonth(MANY);
eq(months.length, 2, 'ได้ 2 เดือน');
eq(months[0].month, '2026-08', 'เรียงจากเก่า→ใหม่');
eq(months[0].dayCount, 2, 'ส.ค. มี 2 วัน');
eq(months[0].roundCount, 2, 'ส.ค. มี 2 รอบ');
eq(months[0].totalBet, 30000, 'ส.ค. รับ 30,000');
eq(months[0].profit, 10000, 'ส.ค. กำไร 10,000');
eq(months[1].month, '2026-09', 'ก.ย.');
eq(months[1].dayCount, 1, 'ก.ย. 1 วัน');

console.log('\n═══ 5) summarizeOverall ═══');
const ov = summarizeOverall(ROUNDS);
eq(ov.roundCount, 4, '4 รอบ');
eq(ov.totalBet, 65000, 'รับรวม 65,000');
eq(ov.totalPayout, 53000, 'จ่ายรวม 53,000');
eq(ov.profit, 12000, 'กำไรรวม 12,000');
eq(ov.profitRounds, 3, 'กำไร 3 รอบ');
eq(ov.lossRounds, 1, 'ขาดทุน 1 รอบ');
eq(ov.winRate, 75, 'อัตราชนะ 75%');
eq(ov.bestRound.roundId, 'c1', 'ดีสุด = c1');
eq(ov.worstRound.roundId, 'b1', 'แย่สุด = b1');
eq(ov.avgBetPerRound, 16250, 'เฉลี่ยรับ/รอบ 16,250');
eq(ov.avgProfitPerRound, 3000, 'เฉลี่ยกำไร/รอบ 3,000');

const empty = summarizeOverall([]);
eq(empty.roundCount, 0, 'ว่าง → 0 รอบ');
eq(empty.profit, 0, 'ว่าง → กำไร 0');
eq(empty.bestRound, null, 'ว่าง → bestRound null');

console.log('\n═══ 6) rankNumbers ═══');
const BETS = [
  { type: '3ตัวบน', number: '111', amount: 100, rate: 900, won: false },
  { type: '3ตัวบน', number: '222', amount: 100, rate: 900, won: true },
  { type: '2ตัวบน', number: '33', amount: 200, rate: 95, won: false },
];
const rk = rankNumbers(BETS);
eq(rk.best.length, 3, 'ได้ 3 รายการ');
// 33 รับ 200 ไม่จ่าย → กำไร 200 (มากสุด)
eq(rk.best[0].number, '33', 'กำไรดีสุด = 33 (รับ 200 ไม่จ่าย)');
eq(rk.best[0].profit, 200, 'กำไร 200');
eq(rk.best[1].number, '111', 'อันดับ 2 = 111 (100)');
eq(rk.worst[0].number, '222', 'ขาดทุนสุด = 222');
eq(rk.worst[0].profit, 100 - 90000, 'ขาดทุน 100-90,000');
eq(rk.worst[0].hitCount, 1, 'ถูก 1 ครั้ง');

console.log('\n═══ 7) buildLineChart ═══');
const pts = [
  { label: '1', value: 1000 },
  { label: '2', value: -500 },
  { label: '3', value: 2000 },
];
const lc = buildLineChart(pts, 640, 200);
ok(lc.path.startsWith('M '), 'path เริ่มด้วย M');
eq(lc.path.split('L').length - 1, 2, 'มี 2 เส้น L (3 จุด)');
eq(lc.points.length, 3, 'ได้ 3 จุด');
ok(lc.min <= -500, 'min ครอบค่าติดลบ');
ok(lc.max >= 2000, 'max ครอบค่าบวก');
eq(lc.zeroY !== null, true, 'มีเส้นศูนย์ (มีทั้งบวก/ลบ)');
eq(lc.gridY.length, 5, 'เส้นกริด 5 เส้น');
ok(lc.areaPath.endsWith('Z'), 'areaPath ปิดรูป');

// ทั้งหมดเป็นบวก → ไม่มีเส้นศูนย์
const lc2 = buildLineChart([{ label: 'a', value: 100 }, { label: 'b', value: 200 }]);
eq(lc2.zeroY, null, 'ค่าบวกหมด → zeroY null');
eq(lc2.min, 0, 'บวกหมด → min = 0');

// จุดเดียว
const lc3 = buildLineChart([{ label: 'x', value: 50 }]);
eq(lc3.points.length, 1, 'จุดเดียว → 1 จุด');
ok(!lc3.path.includes('L'), 'จุดเดียว → ไม่มี L');

// ว่าง
const lc4 = buildLineChart([]);
eq(lc4.path, '', 'ว่าง → path ว่าง');
eq(lc4.points.length, 0, 'ว่าง → 0 จุด');

// ค่าเท่ากันหมด → ไม่หารศูนย์
const lc5 = buildLineChart([{ label: 'a', value: 500 }, { label: 'b', value: 500 }]);
ok(lc5.max > lc5.min, 'ค่าเท่ากัน → range ไม่เป็น 0');
ok(lc5.points.every(p => Number.isFinite(p.y)), 'y เป็นตัวเลขจริง');

console.log('\n═══ 8) buildBarChart ═══');
const bc = buildBarChart([
  { label: '24', bet: 30000, payout: 23000 },
  { label: '25', bet: 5000, payout: 9000 },
]);
eq(bc.length, 2, 'ได้ 2 แท่ง');
ok(bc[0].hBet > bc[0].hPayout, 'วันแรก รับสูงกว่าจ่าย');
ok(bc[1].hPayout > bc[1].hBet, 'วันที่ 2 จ่ายสูงกว่ารับ');
eq(buildBarChart([]).length, 0, 'ว่าง → 0 แท่ง');
ok(bc.every(b => Number.isFinite(b.hBet) && Number.isFinite(b.hPayout)), 'ความสูงเป็นตัวเลขจริง');

console.log('\n═══ 9) ตัวช่วยรูปแบบ ═══');
eq(formatThaiDate('2026-09-26'), '26 ก.ย.', 'วันที่ไทย');
eq(formatThaiDate('2026-01-05'), '5 ม.ค.', 'ม.ค. ไม่มีศูนย์นำ');
eq(formatThaiMonth('2026-09'), 'ก.ย. 69', 'เดือนไทย (พ.ศ.)');
eq(formatThaiDate('ไม่ใช่'), 'ไม่ใช่', 'รูปแบบผิด → คืนเดิม');
eq(profitColor(100), '#059669', 'กำไร = เขียว');
eq(profitColor(-100), '#dc2626', 'ขาดทุน = แดง');
eq(profitColor(0), '#6b7280', 'เท่าทุน = เทา');

console.log('\n═══ 10) sampleRounds ═══');
const sr = sampleRounds(14, 6);
eq(sr.length, 84, '14 วัน × 6 รอบ = 84');
eq(new Set(sr.map(x => dayKey(x.closedAt))).size, 14, 'ได้ 14 วัน');
ok(sr.every(x => x.totalBet > 0), 'รับมากกว่า 0 ทุกครั้ง');
ok(sr.every(x => x.totalPayout >= 0), 'จ่ายไม่ติดลบ');
ok(sr.every(x => /^\d{6}$/.test(x.result)), 'ผลเป็น 6 หลัก');
ok(sr.every(x => x.ticketCount > 0), 'มีโพยทุกครั้ง');

// ต้องมีทั้งกำไรและขาดทุน (ดูภาพได้จริง)
const sro = summarizeOverall(sr);
ok(sro.profitRounds > 0, 'มีรอบกำไร');
ok(sro.lossRounds > 0, 'มีรอบขาดทุน');

// seed เดิม → ผลเดิม (ทดสอบซ้ำได้)
const sr2 = sampleRounds(14, 6);
eq(sr[0].totalBet, sr2[0].totalBet, 'seed เดิม → ผลเดิม');

console.log('\n' + '═'.repeat(56));
console.log(`ผ่าน ${pass}  |  ไม่ผ่าน ${fail}`);
if (fails.length) { console.log('\n★ ที่ไม่ผ่าน:'); fails.forEach(f => console.log('   - ' + f)); }
else console.log('★★★ รายงานกำไร-ขาดทุนทำงานถูกต้อง ★★★');
console.log('═'.repeat(56));
process.exit(fail ? 1 : 0);
