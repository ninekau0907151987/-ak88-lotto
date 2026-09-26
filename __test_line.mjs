/** __test_line.mjs — B4: ทดสอบแจ้งเตือน LINE (mock fetch) */
import {
  DEFAULT_LINE_CONFIG, buildMessage, sendLine, shouldSend, lineHealth, lineConfigFromEnv,
  msgRoundOpen, msgRoundClose, msgResult, msgBigWin, msgRiskBlock, msgLowBalance,
} from './server/lib/lineNotify.ts';

let pass = 0, fail = 0;
const fails = [];
function eq(a, e, label) {
  const A = JSON.stringify(a), E = JSON.stringify(e);
  if (A === E) pass++;
  else { fail++; fails.push(`${label}\n     ได้: ${A}\n     ต้องได้: ${E}`); }
}
function ok(c, label) { eq(!!c, true, label); }

console.log('═══ 1) buildMessage ═══');
let m = buildMessage({ title: 'ทดสอบ', lines: ['บรรทัด 1', 'บรรทัด 2'] });
eq(m, '【ทดสอบ】\nบรรทัด 1\nบรรทัด 2', 'ประกอบข้อความถูก');
m = buildMessage({ title: 'T', lines: ['a'], footer: 'ท้าย' });
eq(m, '【T】\na\nท้าย', 'มี footer');
m = buildMessage({ title: 'T', lines: ['a', '', 'b'] });
eq(m, '【T】\na\nb', 'ตัดบรรทัดว่าง');
// ยาวเกิน 5,000 → ตัด
const long = buildMessage({ title: 'T', lines: [('x').repeat(6000)] });
ok(long.length <= 4900, `ตัดข้อความยาว (${long.length} <= 4900)`);
ok(long.includes('ตัดข้อความ'), 'มีข้อความบอกว่าตัด');

console.log('\n═══ 2) ข้อความสำเร็จรูป ═══');
const ro = msgRoundOpen('r1', '18:00');
eq(ro.title, 'เปิดรับแทง', 'เปิดรอบ — หัวข้อ');
ok(ro.lines.some(l => l.includes('r1')), 'เปิดรอบ — มีรอบ');
ok(ro.lines.some(l => l.includes('18:00')), 'เปิดรอบ — มีเวลาปิด');

const rc = msgRoundClose('r2', 123456, 40, 12);
eq(rc.title, 'ปิดรับแทงแล้ว', 'ปิดรอบ — หัวข้อ');
ok(rc.lines.some(l => l.includes('123,456')), 'ปิดรอบ — ใส่ comma ถูก');
ok(rc.lines.some(l => l.includes('40')), 'ปิดรอบ — จำนวนโพย');
ok(rc.footer.includes('คำนวณ'), 'ปิดรอบ — footer');

const rs = msgResult('r3', '123456', 100000, 75000);
eq(rs.title, 'ผลออกรางวัล', 'ผล — หัวข้อ');
ok(rs.lines.some(l => l.includes('123456')), 'ผล — ผลเต็ม');
ok(rs.lines.some(l => l.includes('456')), 'ผล — 3 ตัวบน');
ok(rs.lines.some(l => l.includes('56')), 'ผล — 2 ตัวบน');
ok(rs.lines.some(l => l.includes('34')), 'ผล — 2 ตัวล่าง (หลักกลาง)');
ok(rs.lines.some(l => l.includes('กำไร')), 'ผล — กำไร');
ok(rs.lines.some(l => l.includes('25.0')), 'ผล — margin 25%');

// ขาดทุน
const rs2 = msgResult('r4', '999999', 10000, 30000);
ok(rs2.lines.some(l => l.includes('ขาดทุน')), 'ขาดทุน — บอกขาดทุน');

const bw = msgBigWin('456', '3 ตัวบน', 900000, '123456');
eq(bw.title, '⚠️ มีผู้ถูกรางวัลใหญ่', 'ถูกใหญ่ — หัวข้อ');
ok(bw.lines.some(l => l.includes('900,000')), 'ถูกใหญ่ — จำนวนเงิน');

const rb = msgRiskBlock('456', '3 ตัวบน', 'จ่ายทะลุเพดาน');
eq(rb.title, '🛑 บล็อกการแทง', 'บล็อก — หัวข้อ');
ok(rb.lines.some(l => l.includes('ทะลุเพดาน')), 'บล็อก — เหตุผล');

const lb = msgLowBalance('สมชาย', 1200, 5000);
eq(lb.title, '💳 เครดิตต่ำ', 'เครดิตต่ำ — หัวข้อ');
ok(lb.lines.some(l => l.includes('สมชาย')), 'เครดิตต่ำ — ชื่อ');

console.log('\n═══ 3) shouldSend ═══');
const OFF = { ...DEFAULT_LINE_CONFIG };
eq(shouldSend('onResult', OFF), false, 'ปิดอยู่ → ไม่ส่ง');

const ON = { ...DEFAULT_LINE_CONFIG, enabled: true, mode: 'notify', notifyToken: 'tok' };
eq(shouldSend('onResult', ON), true, 'เปิด + ตั้ง onResult → ส่ง');
eq(shouldSend('onLowBalance', ON), false, 'onLowBalance ปิดโดยค่าเริ่มต้น → ไม่ส่ง');

const ON_ALL = { ...ON, events: { ...ON.events, onLowBalance: true } };
eq(shouldSend('onLowBalance', ON_ALL, 1000), true, 'เครดิต 1000 <= 5000 → ส่ง');
eq(shouldSend('onLowBalance', ON_ALL, 9000), false, 'เครดิต 9000 > 5000 → ไม่ส่ง');
eq(shouldSend('onBigWin', ON, 50_000), false, 'ถูกรางวัล 50k < 100k → ไม่ส่ง');
eq(shouldSend('onBigWin', ON, 150_000), true, 'ถูกรางวัล 150k >= 100k → ส่ง');

console.log('\n═══ 4) lineHealth ═══');
let h = lineHealth(DEFAULT_LINE_CONFIG);
eq(h.ready, false, 'ปิดอยู่ → ไม่พร้อม');
ok(h.problems.some(p => p.includes('ยังไม่เปิด')), 'บอกว่ายังไม่เปิด');

h = lineHealth({ ...DEFAULT_LINE_CONFIG, enabled: true, mode: 'messaging' });
eq(h.ready, false, 'messaging ไม่มี token → ไม่พร้อม');
ok(h.problems.some(p => p.includes('CHANNEL_ACCESS_TOKEN')), 'บอกขาด token');
ok(h.problems.some(p => p.includes('ปลายทาง')), 'บอกขาดปลายทาง');

h = lineHealth({ ...DEFAULT_LINE_CONFIG, enabled: true, mode: 'messaging', channelAccessToken: 't', to: 'g' });
eq(h.ready, true, 'ครบ → พร้อม');
eq(h.problems.length, 0, 'ไม่มีปัญหา');

h = lineHealth({ ...DEFAULT_LINE_CONFIG, enabled: true, mode: 'notify' });
eq(h.ready, false, 'notify ไม่มี token → ไม่พร้อม');

console.log('\n═══ 5) lineConfigFromEnv ═══');
let cfg = lineConfigFromEnv({});
eq(cfg.mode, 'off', 'ไม่มี env → off');
eq(cfg.enabled, false, 'ไม่มี env → ปิด');

cfg = lineConfigFromEnv({
  LINE_MODE: 'notify', LINE_ENABLED: 'true', LINE_NOTIFY_TOKEN: 'abc',
});
eq(cfg.mode, 'notify', 'อ่าน mode');
eq(cfg.enabled, true, 'อ่าน enabled');
eq(cfg.notifyToken, 'abc', 'อ่าน token');
eq(lineHealth(cfg).ready, true, 'ตั้งครบ → พร้อม');

console.log('\n═══ 6) sendLine — ปิดอยู่ ไม่ยิง network ═══');
let called = 0;
const mock = async () => { called++; return new Response('', { status: 200 }); };
let r = await sendLine(msgResult('r', '123456', 1, 1), DEFAULT_LINE_CONFIG, mock);
eq(r.ok, false, 'ปิด → ok=false');
eq(called, 0, '★ ปิด → ไม่ยิง network เลย');
eq(r.attempts, 0, 'attempts = 0');

console.log('\n═══ 7) sendLine — successful ═══');
called = 0;
let lastBody = '';
const ok200 = async (url, init) => {
  called++; lastBody = String(init.body);
  return new Response('{}', { status: 200 });
};
const CFG_N = { ...DEFAULT_LINE_CONFIG, enabled: true, mode: 'notify', notifyToken: 'tok' };
r = await sendLine(msgRoundOpen('r1'), CFG_N, ok200);
eq(r.ok, true, 'ส่งสำเร็จ');
eq(r.status, 200, 'status 200');
eq(r.attempts, 1, 'ยิงครั้งเดียว');
eq(called, 1, 'called = 1');
ok(lastBody.includes('message='), 'notify ส่งแบบ form');
ok(lastBody.includes('%E0%B9%80'), 'URL-encode ภาษาไทย');

// messaging → JSON
called = 0;
let lastInit = null;
const okJson = async (url, init) => {
  called++; lastInit = { url, init };
  return new Response('{}', { status: 200 });
};
const CFG_M = { ...CFG_N, mode: 'messaging', channelAccessToken: 'tok2', to: 'grp1' };
r = await sendLine(msgRoundOpen('r2'), CFG_M, okJson);
eq(r.ok, true, 'messaging ส่งสำเร็จ');
ok(lastInit.url.includes('/bot/message/push'), 'URL = push');
const bodyObj = JSON.parse(lastInit.init.body);
eq(bodyObj.to, 'grp1', 'ส่งไปยังกลุ่มถูก');
eq(bodyObj.messages[0].type, 'text', 'เป็นข้อความ text');

console.log('\n═══ 8) sendLine — 4xx ไม่ retry (token ผิด) ═══');
called = 0;
const bad401 = async () => { called++; return new Response('unauthorized', { status: 401 }); };
r = await sendLine(msgRoundOpen('r'), CFG_N, bad401);
eq(r.ok, false, '401 → ล้มเหลว');
eq(called, 1, '★ 401 ไม่ retry (ยิงครั้งเดียว)');
eq(r.attempts, 1, 'attempts 1');
ok(r.error.includes('401'), 'error มีรหัส');

console.log('\n═══ 9) sendLine — 500 retry ═══');
called = 0;
const err500 = async () => { called++; return new Response('boom', { status: 500 }); };
r = await sendLine(msgRoundOpen('r'), { ...CFG_N, retries: 2 }, err500);
eq(r.ok, false, '500 → ล้มเหลว');
eq(called, 3, '★ 500 retry จนครบ (1+2 = 3 ครั้ง)');
eq(r.attempts, 3, 'attempts 3');

console.log('\n═══ 10) sendLine — ล้มแล้วสำเร็จ (retry ช่วยได้) ═══');
called = 0;
const flaky = async () => {
  called++;
  if (called < 3) throw new Error('network');
  return new Response('{}', { status: 200 });
};
r = await sendLine(msgRoundOpen('r'), { ...CFG_N, retries: 3 }, flaky);
eq(r.ok, true, '★ retry แล้วสำเร็จ');
eq(called, 3, 'ยิง 3 ครั้ง');
eq(r.attempts, 3, 'attempts 3');

console.log('\n═══ 11) sendLine — 429 retry (rate limit) ═══');
called = 0;
const r429 = async () => { called++; return new Response('slow down', { status: 429 }); };
r = await sendLine(msgRoundOpen('r'), { ...CFG_N, retries: 1 }, r429);
eq(called, 2, '★ 429 retry ได้ (ไม่เหมือน 4xx อื่น)');
eq(r.status, 429, 'status 429');

console.log('\n═══ 12) sendLine — ไม่มี config ครบ ═══');
called = 0;
r = await sendLine(msgRoundOpen('r'), { ...DEFAULT_LINE_CONFIG, enabled: true, mode: 'messaging' }, mock);
eq(r.ok, false, 'messaging ไม่มี token → ล้มเหลว');
eq(called, 0, 'ไม่ยิง network');
ok(r.error.includes('channelAccessToken'), 'บอกขาดอะไร');

r = await sendLine(msgRoundOpen('r'), { ...DEFAULT_LINE_CONFIG, enabled: true, mode: 'notify' }, mock);
eq(r.ok, false, 'notify ไม่มี token → ล้มเหลว');
eq(called, 0, 'ไม่ยิง network');

console.log('\n═══ 13) ★ LINE ล่ม ต้องไม่ทำระบบพัง ═══');
const throwAlways = async () => { throw new Error('LINE down'); };
r = await sendLine(msgRoundOpen('r'), { ...CFG_N, retries: 0 }, throwAlways);
eq(r.ok, false, 'LINE ล่ม → ok=false');
ok(!r.ok, '★ ไม่โยน error ออกมา (คืนค่าแทน)');
ok(r.error.includes('LINE down'), 'มีข้อความ error');

// timeout
const hang = (url, init) => new Promise((_, rej) => {
  init?.signal?.addEventListener('abort', () => {
    const e = new Error('aborted'); e.name = 'AbortError'; rej(e);
  });
});
r = await sendLine(msgRoundOpen('r'), { ...CFG_N, retries: 0, timeoutMs: 150 }, hang);
eq(r.ok, false, 'หมดเวลา → ok=false');
ok(r.error.includes('หมดเวลา'), 'บอกว่าหมดเวลา');

console.log('\n' + '═'.repeat(56));
console.log(`ผ่าน ${pass}  |  ไม่ผ่าน ${fail}`);
if (fails.length) { console.log('\n★ ที่ไม่ผ่าน:'); fails.forEach(f => console.log('   - ' + f)); }
else console.log('★★★ ระบบแจ้งเตือน LINE ทำงานถูกต้อง ★★★');
console.log('═'.repeat(56));
process.exit(fail ? 1 : 0);
