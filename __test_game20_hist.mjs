/**
 * __test_game20_hist.mjs — ทดสอบประวัติ + รหัส + แก้ไขผล + กติกา
 * รัน: npx tsx __test_game20_hist.mjs
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';

import { game20HistoryRoutes } from './server/routes/v1/game20History.routes.ts';
import { game20Routes } from './server/routes/v1/game20.routes.ts';
import { errorHandler } from './server/middleware/error-handler.ts';
import { computeResult, SLOT_COUNT, padNum } from './src/shared/lib/lottery20.ts';
import {
  prepareEditResult, generateCode, verifyCode, hashCode,
  filterHistory, historyStats, historyToCsv, makeHistoryEntry, verifyHistoryEntry, analyzeHistory,
} from './src/shared/lib/game20History.ts';
import {
  GUIDE_RULES, PLAY_STEPS, getPayoutTable, getFaq, getWorkedExamples,
  GUIDE_RULES_LIST, buildFormulaSvg, buildReadingSvg, buildRulesCardSvg,
} from './src/shared/lib/game20Guide.ts';

const { initializeApp } = await import('firebase/app');
const { getFirestore, connectFirestoreEmulator, terminate } = await import('firebase/firestore');
const _app = initializeApp({ projectId: 'demo-ak88', apiKey: 'fake' }, 'g20hist');
const DB = getFirestore(_app);
connectFirestoreEmulator(DB, '127.0.0.1', 8085);

let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}  ${e}`); } };
const eq = (a, b, n) => t(n, a === b, `ได้ ${JSON.stringify(a)} คาด ${JSON.stringify(b)}`);
const sect = n => console.log(`\n── ${n} ──`);

function makeRes() {
  return {
    statusCode: 200, body: null, locals: {}, headers: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
    send(b) { this.body = b; return this; },
  };
}
/** ★ จับคู่ path แบบมี :param ด้วย (เช่น /codes/:id/verify) */
function findRoute(router, method, path) {
  const m = method.toLowerCase();
  const layers = router.stack.filter(l => l.route && l.route.methods[m]);
  // ตรงเป๊ะก่อน
  let hit = layers.find(l => l.route.path === path);
  if (!hit) {
    // ★ จับคู่แบบ pattern — /codes/:id/verify กับ /codes/code_123/verify
    const segs = path.split('/').filter(Boolean);
    hit = layers.find(l => {
      const ps = l.route.path.split('/').filter(Boolean);
      if (ps.length !== segs.length) return false;
      return ps.every((p, i) => p.startsWith(':') || p === segs[i]);
    });
  }
  return hit ? hit.route.stack[hit.route.stack.length - 1].handle : null;
}
async function call(router, method, path, { body, query, params, locals } = {}) {
  const h = findRoute(router, method, path);
  if (!h) throw new Error(`ไม่พบเส้น ${method} ${path}`);
  const req = { body: body || {}, query: query || {}, params: params || extractParams(router, method, path), headers: {} };
  const res = makeRes();
  res.locals = { apiKeyDoc: { name: 'test' }, ...(locals || {}) };

  let settled = false, resolveDone;
  const donePromise = new Promise(r => { resolveDone = r; });
  const origJson = res.json.bind(res);
  res.json = (b) => { const o = origJson(b); settled = true; resolveDone(); return o; };
  const origSend = res.send.bind(res);
  res.send = (b) => { const o = origSend(b); settled = true; resolveDone(); return o; };

  h(req, res, (err) => {
    if (err) errorHandler(err, req, res, () => {});
    if (!settled) resolveDone();
  });
  await donePromise;
  await new Promise(r => setTimeout(r, 60));
  return res;
}

/** ดึงค่า param จาก path จริง เทียบกับ route pattern */
function extractParams(router, method, path) {
  const m = method.toLowerCase();
  const segs = path.split('/').filter(Boolean);
  const layers = router.stack.filter(l => l.route && l.route.methods[m]);
  for (const l of layers) {
    const ps = l.route.path.split('/').filter(Boolean);
    if (ps.length !== segs.length) continue;
    const out = {};
    let ok = true;
    ps.forEach((p, i) => {
      if (p.startsWith(':')) out[p.slice(1)] = decodeURIComponent(segs[i]);
      else if (p !== segs[i]) ok = false;
    });
    if (ok) return out;
  }
  return {};
}

const hist = game20HistoryRoutes(DB);
const main = game20Routes(DB);

// ★ roundId ใหม่ทุกครั้ง — กันข้อมูลรอบเก่า (setDoc merge) มาทับการทดสอบ
const RID = `g20hist_${Date.now()}`;

// ★ เคลียร์รหัส result_lock ที่ค้างจากการรันก่อน
//   (ไม่งั้นปลดล็อกจะบังคับให้ใส่รหัส ซึ่งถูกต้องแต่ทำให้เทสต์ไม่สะอาด)
{
  const { collection, getDocs, deleteDoc, doc: fdoc, query, where } = await import('firebase/firestore');
  try {
    const snap = await getDocs(query(collection(DB, 'game20Codes'), where('kind', '==', 'result_lock')));
    for (const d of snap.docs) await deleteDoc(fdoc(DB, 'game20Codes', d.id));
    if (snap.size) console.log(`  (เคลียร์รหัส result_lock ${snap.size} รายการจากการรันก่อน)`);
  } catch { /* ไม่เป็นไร */ }
}

/* ================================================================ */
sect('1. ★ prepareEditResult — แก้ไขรหัสผล');
{
  const round = { roundId: 'r1', result: '123456', slots: new Array(SLOT_COUNT).fill('000000') };
  const out = prepareEditResult(round, {
    roundId: 'r1', newResult: '777777', reason: 'ลูกค้าแจ้งว่าผลผิด', actor: 'admin1',
  });
  eq(out.ok, true, '★ แก้ไขสำเร็จ');
  eq(out.resultBefore, '123456', 'ผลเก่า');
  eq(out.resultAfter, '777777', '★ ผลใหม่');
  eq(out.verified, true, 'verified');
  eq(out.history.action, 'edit_result', '★ บันทึกเป็น edit_result');
  eq(out.history.reason, 'ลูกค้าแจ้งว่าผลผิด', '★ เก็บเหตุผล');
  eq(out.history.actor, 'admin1', '★ เก็บผู้ทำ');
  t('มี checksum', !!out.history.checksum, out.history.checksum);
}
{
  // ★ ต้องมีเหตุผล
  const out = prepareEditResult(
    { roundId: 'r1', result: '123456' },
    { roundId: 'r1', newResult: '777777', reason: 'ab', actor: 'admin1' },
  );
  eq(out.ok, false, '★ เหตุผลสั้นเกิน → ไม่ผ่าน');
  t('แจ้ง error เรื่องเหตุผล', out.error.includes('เหตุผล'), out.error);
}
{
  // ★ ผลใหม่ต้อง 6 หลัก
  const out = prepareEditResult(
    { roundId: 'r1', result: '123456' },
    { roundId: 'r1', newResult: 'abc', reason: 'แก้ไขผลลัพธ์', actor: 'admin1' },
  );
  eq(out.ok, false, '★ ผลไม่ใช่ตัวเลข → ไม่ผ่าน');
}
{
  // ★ slots ที่ให้มาต้องสอดคล้องกับผลใหม่
  const badSlots = new Array(SLOT_COUNT).fill('000000');
  const out = prepareEditResult(
    { roundId: 'r1', result: '123456' },
    { roundId: 'r1', newResult: '777777', newSlots: badSlots, reason: 'แก้ไขผลลัพธ์', actor: 'admin1' },
  );
  eq(out.ok, false, '★ slots ไม่ตรงกับผล → ไม่ผ่าน');
  t('แจ้งว่าผลไม่ตรง', out.error.includes('ไม่ตรง'), out.error);
}
{
  // ★ slots ที่ถูกต้อง → ผ่าน
  const slots = new Array(SLOT_COUNT).fill('000000');
  slots[0] = '777777';
  const out = prepareEditResult(
    { roundId: 'r1', result: '123456' },
    { roundId: 'r1', newResult: '777777', newSlots: slots, reason: 'แก้ไขผลลัพธ์', actor: 'admin1' },
  );
  eq(out.ok, true, '★ slots ตรง → ผ่าน');
  eq(out.verified, true, 'verified');
}
{
  // ★ รอบล็อก → แก้ไม่ได้
  const out = prepareEditResult(
    { roundId: 'r1', result: '123456', resultLocked: true },
    { roundId: 'r1', newResult: '777777', reason: 'แก้ไขผลลัพธ์', actor: 'admin1' },
  );
  eq(out.ok, false, '★ รอบล็อก → ไม่ผ่าน');
  t('เตือนเรื่องล็อก', out.warnings.some(w => w.includes('ล็อก')), out.warnings.join('|'));
}
{
  // ★ คำนวณผลกระทบการเงิน
  const bets = [
    { number: '123', type: '3ตัวบน', amount: 100 },
    { number: '777', type: '3ตัวบน', amount: 100 },
  ];
  const out = prepareEditResult(
    { roundId: 'r1', result: '123456' },
    { roundId: 'r1', newResult: '777777', reason: 'แก้ไขผลลัพธ์', actor: 'a',
      bets, rates: { '3ตัวบน': 900 } },
  );
  eq(out.ok, true, 'แก้สำเร็จ');
  t('มี economicsBefore', !!out.economicsBefore);
  t('มี economicsAfter', !!out.economicsAfter);
  // ★ bets มี '123' และ '777' — ผลเก่า 123456 → 3 หลักท้าย 456 → ไม่มีใครถูก
  //   ผลใหม่ 777777 → 3 หลักท้าย 777 → '777' ถูก → จ่าย 100 × 900 = 90,000
  eq(out.economicsBefore.winCount, 0, 'ก่อนแก้: ไม่มีผู้ชนะ (ผล 456)');
  eq(out.economicsBefore.payout, 0, 'ก่อนแก้: จ่าย 0');
  eq(out.economicsAfter.winCount, 1, '★ หลังแก้: ผู้ชนะ 1 ราย (ผล 777 ตรงกับที่แทง)');
  eq(out.economicsAfter.payout, 90000, '★ หลังแก้: จ่าย 100 × 900 = 90,000');
  eq(out.economicsAfter.profit, 200 - 90000, 'กำไรติดลบถูกต้อง');
  t('เตือนว่าต้องจ่ายเพิ่ม', out.warnings.some(w => w.includes('จ่ายเพิ่ม')), out.warnings.join('|'));
  t('เตือนขาดทุน', out.warnings.some(w => w.includes('ขาดทุน')), out.warnings.join('|'));

  // ★ ทดสอบกรณีมีผู้ชนะจริง: แทง '777' ผลใหม่ 777777 → ถูก
  const out2 = prepareEditResult(
    { roundId: 'r2', result: '123456' },
    { roundId: 'r2', newResult: '777777', reason: 'แก้ไขผลลัพธ์', actor: 'a',
      bets: [{ number: '777', type: '3ตัวบน', amount: 100 }], rates: { '3ตัวบน': 900 } },
  );
  eq(out2.economicsAfter.winCount, 1, '★ แทง 777 ผล 777777 → ถูก');
  eq(out2.economicsAfter.payout, 90000, '★ จ่าย 100 × 900 = 90,000');
  t('เตือนว่าต้องจ่ายเพิ่ม', out2.warnings.some(w => w.includes('จ่ายเพิ่ม')), out2.warnings.join('|'));
  console.log(`     ก่อน: จ่าย ฿${out.economicsBefore.payout} • หลัง: จ่าย ฿${out.economicsAfter.payout}`);
  console.log(`     เตือน: ${out.warnings.join(' | ') || '(ไม่มี)'}`);
}

/* ================================================================ */
sect('2. ★ checksum — ตรวจจับการแก้ข้อมูลย้อนหลัง');
{
  const e = makeHistoryEntry({
    action: 'edit_result', roundId: 'r1', actor: 'admin1',
    resultBefore: '123456', resultAfter: '777777', reason: 'ทดสอบ',
  });
  eq(verifyHistoryEntry(e), true, '★ รายการใหม่ → checksum ตรง');

  // แก้ผลหลังบันทึก → ต้องจับได้
  const tampered = { ...e, resultAfter: '999999' };
  eq(verifyHistoryEntry(tampered), false, '★ แก้ผลหลังบันทึก → จับได้');
}
{
  const e1 = makeHistoryEntry({ action: 'close_round', roundId: 'r1', actor: 'a' });
  const e2 = makeHistoryEntry({ action: 'close_round', roundId: 'r1', actor: 'a' });
  t('id ไม่ซ้ำกัน', e1.id !== e2.id, `${e1.id} vs ${e2.id}`);
}

/* ================================================================ */
sect('3. ★ รหัส — สร้าง/ตรวจ/แก้ไข');
{
  const { code, entry } = generateCode({
    kind: 'result_lock', label: 'รหัสล็อกผล', length: 6, createdBy: 'admin1',
  });
  eq(code.length, 6, '★ รหัส 6 หลัก');
  t('รหัสเป็นตัวเลข', /^\d{6}$/.test(code), code);
  t('★ ไม่เก็บค่าจริง (เก็บแค่ hash)', entry.valueHash !== code && !!entry.valueHash);
  eq(entry.kind, 'result_lock', 'kind ถูก');
  eq(entry.active, true, 'เปิดใช้งาน');
  eq(entry.usedCount, 0, 'ยังไม่ถูกใช้');

  // ★ ตรวจรหัส
  eq(verifyCode(code, entry).ok, true, '★ รหัสถูก → ผ่าน');
  eq(verifyCode('000000' === code ? '111111' : '000000', entry).ok, false, '★ รหัสผิด → ไม่ผ่าน');

  // hash ต้อง deterministic
  eq(hashCode(code), entry.valueHash, '★ hash คงที่ (ตรวจซ้ำได้)');
}
{
  // ★ รหัสปิดใช้งาน
  const { code, entry } = generateCode({ kind: 'open_close', label: 'ปิดรอบ', createdBy: 'a' });
  const off = { ...entry, active: false };
  eq(verifyCode(code, off).ok, false, '★ ปิดใช้งาน → ไม่ผ่าน');
  t('แจ้งว่าไม่ถูกต้อง/ปิด', verifyCode(code, off).reason.includes('ปิด'), verifyCode(code, off).reason);
}
{
  // ★ รหัสหมดอายุ
  const { code, entry } = generateCode({ kind: 'admin_code', label: 'หมดอายุ', expiresInDays: -1, createdBy: 'a' });
  eq(verifyCode(code, entry).ok, false, '★ หมดอายุ → ไม่ผ่าน');
  t('แจ้งว่าหมดอายุ', verifyCode(code, entry).reason.includes('หมดอายุ'), verifyCode(code, entry).reason);
}
{
  // ★ ใช้ครบจำนวน
  const { code, entry } = generateCode({ kind: 'round_code', label: 'ใช้ครั้งเดียว', maxUses: 1, createdBy: 'a' });
  eq(verifyCode(code, entry).ok, true, 'ยังไม่ใช้ → ผ่าน');
  const used = { ...entry, usedCount: 1 };
  eq(verifyCode(code, used).ok, false, '★ ใช้ครบ → ไม่ผ่าน');
  t('แจ้งว่าใช้ครบ', verifyCode(code, used).reason.includes('ครบ'), verifyCode(code, used).reason);
}
{
  const { code } = generateCode({ kind: 'custom', label: 'ตัวอักษร', alphanumeric: true, createdBy: 'a' });
  t('★ รหัสแบบมีตัวอักษร', /[A-Z]/.test(code), code);
}

/* ================================================================ */
sect('4. ★ filterHistory / historyStats');
{
  const list = [
    makeHistoryEntry({ action: 'close_round', roundId: 'r1', actor: 'a1', resultAfter: '111111' }),
    makeHistoryEntry({ action: 'edit_result', roundId: 'r2', actor: 'a2', reason: 'แก้ผล' }),
    makeHistoryEntry({ action: 'edit_result', roundId: 'r3', actor: 'a1', reason: 'ลูกค้าแจ้ง' }),
    makeHistoryEntry({ action: 'bot_config', roundId: 'r4', actor: 'a3' }),
  ];
  eq(filterHistory(list, { q: 'a1' }).length, 2, '★ ค้นหาด้วย actor');
  eq(filterHistory(list, { q: 'แก้ผล' }).length, 1, '★ ค้นหาด้วยเหตุผล');
  eq(filterHistory(list, { onlyEdits: true }).length, 2, '★ กรองเฉพาะการแก้ผล');
  eq(filterHistory(list, { actions: ['close_round'] }).length, 1, 'กรองตาม action');
  eq(filterHistory(list, { q: 'r3' }).length, 1, '★ ค้นหาด้วย roundId');

  const s = historyStats(list);
  eq(s.total, 4, 'นับครบ');
  eq(s.edits, 2, '★ นับการแก้ผล 2 ครั้ง');
  eq(s.actorCount, 3, '★ 3 คน');
  eq(s.tampered, 0, 'ไม่มีการแก้ข้อมูล');
  console.log(`     สรุป: ${Object.entries(s.byActionLabel).map(([k,v]) => `${k} ${v}`).join(' • ')}`);
}
{
  // ★ ตรวจการแก้ข้อมูลใน stats
  const e = makeHistoryEntry({ action: 'edit_result', roundId: 'r1', actor: 'a' });
  const bad = { ...e, resultAfter: 'XXXXXX' };
  const s = historyStats([bad]);
  eq(s.tampered, 1, '★ จับรายการที่ถูกแก้ได้');
}

/* ================================================================ */
sect('5. ★ historyToCsv');
{
  const list = [makeHistoryEntry({ action: 'edit_result', roundId: 'r1', actor: 'a1', reason: 'ทดสอบ, มี comma' })];
  const csv = historyToCsv(list);
  t('★ มี BOM (Excel อ่านไทยได้)', csv.charCodeAt(0) === 0xFEFF, `0x${csv.charCodeAt(0).toString(16)}`);
  t('มีหัวตาราง', csv.includes('เวลา') && csv.includes('การกระทำ'));
  t('★ escape comma ในเครื่องหมายคำพูด', csv.includes('"ทดสอบ, มี comma"'), 'escape ถูก');
}

/* ================================================================ */
sect('6. ★ analyzeHistory — สถิติผลย้อนหลัง');
{
  const rounds = [
    { roundId: 'r1', result: '123456', closedAt: '2026-01-01', totalBet: 1000, payout: 0, profit: 1000, winCount: 0, mode: 'avoid' },
    { roundId: 'r2', result: '777777', closedAt: '2026-01-02', totalBet: 1000, payout: 900, profit: 100, winCount: 1, mode: 'balance' },
    { roundId: 'r3', result: '111111', closedAt: '2026-01-03', totalBet: 500, payout: 0, profit: 500, winCount: 0, mode: 'profit' },
  ];
  const a = analyzeHistory(rounds);
  eq(a.count, 3, 'นับ 3 รอบ');
  eq(a.totalBet, 2500, '★ ยอดรับรวม 2,500');
  eq(a.totalPayout, 900, '★ จ่ายรวม 900');
  eq(a.profit, 1600, '★ กำไร 1,600');
  eq(a.winRate.toFixed(1), '33.3', '★ อัตรามีผู้ชนะ 33.3%');
  eq(a.streak, 1, '★ สตรีคไม่มีผู้ชนะ 1 รอบ (ล่าสุด)');
  eq(a.digitFrequency.length, 10, 'ความถี่ 10 หลัก');
  eq(a.digitFrequency.reduce((s, v) => s + v, 0), 18, '★ นับครบ 18 หลัก (3 รอบ × 6)');
  t('มี best/worst', a.best && a.worst);
  t('มี top3Freq', Array.isArray(a.top3Freq));
  console.log(`     กำไร ฿${a.profit} (${a.profitPercent.toFixed(1)}%) • มีผู้ชนะ ${a.winRate.toFixed(0)}% • สตรีค ${a.streak}`);
  console.log(`     ความถี่หลัก: ${a.digitFrequency.join(',')}`);
}
{
  const a = analyzeHistory([]);
  eq(a.count, 0, 'ว่าง → count 0');
  eq(a.profit, 0, 'ว่าง → กำไร 0');
}

/* ================================================================ */
sect('7. ★ กติกา — GUIDE_RULES');
{
  eq(GUIDE_RULES.slotCount, 20, '★ 20 ช่อง');
  eq(GUIDE_RULES.digitsPerSlot, 6, '★ 6 หลัก');
  eq(GUIDE_RULES.subtractPosition, 17, '★ ลบช่อง 17');
  eq(GUIDE_RULES.modulo, 1000000, 'mod 1,000,000');
  t('สูตรอ่านได้', GUIDE_RULES.formulaShort.includes('ช่อง'), GUIDE_RULES.formulaShort);
  console.log(`     ${GUIDE_RULES.formulaShort}`);
}

/* ================================================================ */
sect('8. ★ กติกา — ตัวอย่างการคำนวณ');
{
  const ex = getWorkedExamples();
  eq(ex.length, 4, '★ 4 ตัวอย่าง');
  ex.forEach(e => {
    eq(e.slots.length, 20, `${e.title}: 20 ช่อง`);
    eq(computeResult(e.slots).result, e.result.result, `★ ${e.title}: คำนวณตรง`);
    t(`${e.title}: มี 4 บรรทัดอธิบาย`, e.lines.length === 4);
  });
  // ★ ตัวอย่างที่ 2 ต้องแสดง mod ทำงาน
  const wrap = ex.find(e => e.title.includes('เกิน 1 รอบ'));
  t('★ ตัวอย่างที่ 2 อธิบาย mod', wrap.lines.some(l => l.includes('รอบ')), wrap.lines.join(' | '));
  console.log(`     ${wrap.title}: ${wrap.lines[3]}`);
}

/* ================================================================ */
sect('9. ★ กติกา — วิธีการเล่น 8 ขั้น');
{
  eq(PLAY_STEPS.length, 8, '★ 8 ขั้น');
  t('มีหมายเลขครบ 1-8', PLAY_STEPS.every((s, i) => s.n === i + 1));
  t('ทุกขั้นมี icon', PLAY_STEPS.every(s => !!s.icon));
  t('ทุกขั้นมีคำอธิบาย', PLAY_STEPS.every(s => s.detail.length > 10));
  t('มีคำเตือนในบางขั้น', PLAY_STEPS.some(s => !!s.warn), `${PLAY_STEPS.filter(s => s.warn).length} ขั้นมีคำเตือน`);
  PLAY_STEPS.forEach(s => console.log(`     ${s.n}. ${s.icon} ${s.title}${s.warn ? ' ⚠️' : ''}`));
}

/* ================================================================ */
sect('10. ★ กติกา — ตารางอัตราจ่าย');
{
  const rows = getPayoutTable();
  t('มีอัตราจ่าย', rows.length > 0, `${rows.length} แถว`);
  t('★ ทุกแถวมีตัวอย่างเงินจริง', rows.every(r => r.exampleBet > 0 && r.exampleWin > 0));
  t('★ ตัวอย่างเงินถูกคำนวณ', rows.every(r => r.exampleWin === r.exampleBet * r.rate));
  t('★ ทุกแถวมีวิธีอ่านผล', rows.every(r => r.howToRead.length > 3));
  rows.forEach(r => console.log(`     ${r.label.padEnd(12)} ${String(r.rate).padStart(6)}×  แทง ${r.exampleBet} → ${r.exampleWin.toLocaleString()}  | ${r.howToRead}`));

  // ★ รับ rateMap ได้
  const custom = getPayoutTable({ '3ตัวบน': 800 });
  const t3 = custom.find(x => x.key === '3ตัวบน');
  eq(t3.rate, 800, '★ ใช้ rateMap ที่ส่งมา');
  eq(t3.exampleWin, 80000, '★ ตัวอย่างเงินอัปเดตตาม');
}

/* ================================================================ */
sect('11. ★ กติกา — FAQ + ข้อควรระวัง');
{
  const faq = getFaq();
  t('มี FAQ', faq.length >= 8, `${faq.length} ข้อ`);
  t('ทุกข้อมีคำถาม+คำตอบ', faq.every(f => f.q.length > 5 && f.a.length > 20));
  faq.forEach(f => console.log(`     Q: ${f.q}`));
}
{
  t('มีข้อควรระวัง', GUIDE_RULES_LIST.length >= 6, `${GUIDE_RULES_LIST.length} ข้อ`);
  t('มี 3 ระดับ', new Set(GUIDE_RULES_LIST.map(r => r.severity)).size >= 2);
  t('every มี icon+detail', GUIDE_RULES_LIST.every(r => r.icon && r.detail.length > 10));
}

/* ================================================================ */
sect('12. ★ ภาพกติกา (SVG)');
{
  const svg = buildFormulaSvg();
  t('★ สร้าง SVG ได้', svg.startsWith('<svg'), svg.slice(0, 30));
  t('มี viewBox', svg.includes('viewBox'));
  t('มี 20 ช่อง', (svg.match(/<rect/g) || []).length >= 20, `${(svg.match(/<rect/g) || []).length} rect`);
  t('★ แสดงสูตร', svg.includes('mod'));
  t('★ ระบุช่องที่ 17', svg.includes('17'));
  t('ปิด tag ถูกต้อง', svg.trim().endsWith('</svg>'));
  console.log(`     formula: ${svg.length} ตัวอักษร`);
}
{
  const svg = buildReadingSvg({ result: '123456' });
  t('★ SVG วิธีอ่านผล', svg.startsWith('<svg') && svg.includes('3 ตัวบน'));
  t('★ แสดงผล 6 หลัก', ['1','2','3','4','5','6'].every(d => svg.includes(`>${d}</text>`)));
  t('ปิด tag', svg.trim().endsWith('</svg>'));
  console.log(`     reading: ${svg.length} ตัวอักษร`);
}
{
  const svg = buildRulesCardSvg();
  t('★ SVG การ์ดกติกา', svg.startsWith('<svg') && svg.includes('กติกาและอัตราจ่าย'));
  t('มีการ์ดอัตราจ่าย', svg.includes('แทง 100'));
  t('ปิด tag', svg.trim().endsWith('</svg>'));
  console.log(`     card: ${svg.length} ตัวอักษร`);
}

/* ================================================================ */
sect('13. ★ เส้น /game20/guide ผ่าน route');
{
  const res = await call(hist, 'GET', '/guide');
  eq(res.statusCode, 200, 'HTTP 200');
  const d = res.body.data;
  eq(d.rules.slotCount, 20, '★ 20 ช่อง');
  eq(d.steps.length, 8, '★ 8 ขั้น');
  t('มีอัตราจ่าย', d.payouts.length > 0);
  t('มี FAQ', d.faq.length > 0);
  t('มีข้อควรระวัง', d.cautions.length > 0);
  eq(d.examples.length, 4, '★ 4 ตัวอย่าง');
  console.log(`     ${res.body.message} • ${d.steps.length} ขั้น • ${d.payouts.length} อัตรา • ${d.faq.length} FAQ`);
}
{
  const res = await call(hist, 'GET', '/guide/svg');
  eq(res.statusCode, 200, 'HTTP 200');
  t('ได้ SVG 3 ภาพ', !!res.body.data.svg.formula && !!res.body.data.svg.reading && !!res.body.data.svg.card);
  console.log(`     SVG: ${res.body.data.available.join(', ')}`);
}
{
  const res = await call(hist, 'GET', '/guide/svg', { query: { which: 'formula' } });
  eq(res.statusCode, 200, 'HTTP 200 (which=formula)');
  t('★ ได้ SVG เดียวเป็น string', typeof res.body.data.svg === 'string' && res.body.data.svg.startsWith('<svg'));
}

/* ================================================================ */
sect('14. ★ เส้น /history ผ่าน route');
{
  const res = await call(hist, 'GET', '/history');
  eq(res.statusCode, 200, 'HTTP 200');
  t('มี data เป็น array', Array.isArray(res.body.data));
  t('มี labels', !!res.body.labels);
  t('มี stats', !!res.body.stats);
  console.log(`     ${res.body.message}`);
}
{
  const res = await call(hist, 'GET', '/history/stats');
  eq(res.statusCode, 200, 'HTTP 200');
  t('มี total', typeof res.body.data.total === 'number');
}
{
  const res = await call(hist, 'GET', '/history/verify');
  eq(res.statusCode, 200, 'HTTP 200');
  t('★ มีผลตรวจ checksum', typeof res.body.data.intact === 'number');
  console.log(`     ${res.body.message}`);
}
{
  const res = await call(hist, 'GET', '/history/export');
  eq(res.statusCode, 200, 'HTTP 200');
  t('★ เป็น CSV', String(res.body).startsWith('\uFEFF'), 'มี BOM');
  t('ตั้ง header CSV', res.headers['Content-Type']?.includes('csv'), res.headers['Content-Type']);
}
{
  const res = await call(hist, 'POST', '/history', {
    body: { action: 'close_round', roundId: 'r-test', reason: 'ทดสอบบันทึก' },
  });
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.data.action, 'close_round', '★ บันทึกถูกประเภท');
  console.log(`     ${res.body.message}`);
}
{
  const res = await call(hist, 'POST', '/history', { body: { action: 'ไม่ถูกต้อง', roundId: 'r1' } });
  eq(res.statusCode, 400, '★ action ผิด → 400');
}
{
  const res = await call(hist, 'POST', '/history', { body: { action: 'close_round' } });
  eq(res.statusCode, 400, '★ ไม่มี roundId → 400');
}

/* ================================================================ */
sect('15. ★ เส้น /codes ผ่าน route');
let createdCodeId = null, createdCodeValue = null;
{
  const res = await call(hist, 'POST', '/codes', {
    body: { kind: 'result_lock', label: 'รหัสล็อกทดสอบ', length: 6 },
  });
  eq(res.statusCode, 200, 'HTTP 200');
  t('★ ได้ค่ารหัสจริง', /^\d{6}$/.test(res.body.data.code), res.body.data.code);
  t('★ ไม่ส่ง hash ออก', res.body.data.entry.valueHash === undefined);
  t('★ มีคำเตือนให้จด', res.body.data.warning.includes('ครั้งเดียว'), res.body.data.warning);
  createdCodeId = res.body.data.entry.id;
  createdCodeValue = res.body.data.code;
  console.log(`     ${res.body.message}`);
  console.log(`     ${res.body.data.warning}`);
}
{
  const res = await call(hist, 'GET', '/codes');
  eq(res.statusCode, 200, 'HTTP 200');
  const found = res.body.data.find(c => c.id === createdCodeId);
  t('★ เจอรหัสที่สร้าง', !!found);
  t('★ ไม่มี hash ในรายการ', res.body.data.every(c => c.valueHash === undefined));
  t('★ บอกว่ามีค่า', found.hasValue === true, `hasValue=${found && found.hasValue}`);
}
{
  const res = await call(hist, 'POST', `/codes/${createdCodeId}/verify`, { body: { code: createdCodeValue } });
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.data.ok, true, '★ รหัสถูก → ผ่าน');
  console.log(`     ${res.body.message}`);
}
{
  const wrong = createdCodeValue === '000000' ? '111111' : '000000';
  const res = await call(hist, 'POST', `/codes/${createdCodeId}/verify`, { body: { code: wrong } });
  eq(res.body.data.ok, false, '★ รหัสผิด → ไม่ผ่าน');
}
{
  const res = await call(hist, 'PUT', `/codes/${createdCodeId}`, { body: { label: 'ชื่อใหม่', active: false } });
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.data.label, 'ชื่อใหม่', '★ แก้ชื่อแล้ว');
  eq(res.body.data.active, false, '★ ปิดใช้งานแล้ว');
}
{
  const res = await call(hist, 'PUT', `/codes/${createdCodeId}`, { body: {} });
  eq(res.statusCode, 400, '★ ไม่มีอะไรแก้ → 400');
}
{
  // ★ เปลี่ยนค่ารหัส
  const res = await call(hist, 'PUT', `/codes/${createdCodeId}`, { body: { newValue: '998877' } });
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.data.code, '998877', '★ เปลี่ยนค่ารหัสแล้ว');
}
{
  const res = await call(hist, 'POST', '/codes', { body: { kind: 'ผิด', label: 'x' } });
  eq(res.statusCode, 400, '★ kind ผิด → 400');
}
{
  const res = await call(hist, 'POST', '/codes', { body: { kind: 'custom', label: 'x', length: 2 } });
  eq(res.statusCode, 400, '★ ความยาวสั้นไป → 400');
}
{
  const res = await call(hist, 'DELETE', `/codes/${createdCodeId}`);
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.data.deleted, true, '★ ลบแล้ว');
}

/* ================================================================ */
sect('16. ★ แก้ไขผลผ่าน route — ครบวง');
{
  // สร้างรอบจริงก่อน
  const createRes = await call(main, 'POST', '/rounds/close', {
    body: {
      roundId: RID,
      bets: [{ number: '123', type: '3ตัวบน', amount: 100 }],
      mode: 'target', forcedResult: '123456',
    },
  });
  eq(createRes.statusCode, 200, 'สร้างรอบสำเร็จ');

  // ดูประวัติของรอบ
  const hRes = await call(hist, 'GET', `/rounds/${RID}/history`);
  eq(hRes.statusCode, 200, 'HTTP 200');

  // ★ แก้ไขผล
  const eRes = await call(hist, 'POST', `/rounds/${RID}/edit`, {
    body: {
      newResult: '777777',
      reason: 'ทดสอบแก้ไขผล — ลูกค้าแจ้ง',
      bets: [{ number: '123', type: '3ตัวบน', amount: 100 }],
    },
  });
  eq(eRes.statusCode, 200, `HTTP 200 (ได้ ${eRes.statusCode}: ${eRes.body?.message || ''})`);
  eq(eRes.body.data.resultBefore, '123456', '★ ผลเก่า');
  eq(eRes.body.data.resultAfter, '777777', '★ ผลใหม่');
  eq(eRes.body.data.history.action, 'edit_result', '★ บันทึกประวัติ');
  console.log(`     ${eRes.body.message}`);
}
{
  // ★ แก้โดยไม่มีเหตุผล → 400
  const res = await call(hist, 'POST', `/rounds/${RID}/edit`, {
    body: { newResult: '111111' },
  });
  eq(res.statusCode, 400, '★ ไม่มีเหตุผล → 400');
}
{
  // ★ รอบที่ไม่มีอยู่ → 404
  const res = await call(hist, 'POST', '/rounds/no-such-round/edit', {
    body: { newResult: '111111', reason: 'ทดสอบ' },
  });
  eq(res.statusCode, 404, '★ รอบไม่มี → 404');
}

/* ================================================================ */
sect('17. ★ ล็อก/ปลดล็อก/คำนวณใหม่ ผ่าน route');
{
  const res = await call(hist, 'POST', `/rounds/${RID}/lock`, { body: { reason: 'ล็อกหลังตรวจ' } });
  eq(res.statusCode, 200, 'HTTP 200 (ล็อก)');
  eq(res.body.data.resultLocked, true, '★ ล็อกแล้ว');
  console.log(`     ${res.body.message}`);
}
{
  // ★ ล็อกแล้วแก้ไม่ได้
  const res = await call(hist, 'POST', `/rounds/${RID}/edit`, {
    body: { newResult: '999999', reason: 'ลองแก้ตอนล็อก' },
  });
  eq(res.statusCode, 400, '★ ล็อกแล้วแก้ไม่ได้');
  t('แจ้งว่าให้ปลดล็อก', JSON.stringify(res.body).includes('ปลดล็อก'), res.body.message);
}
{
  const res = await call(hist, 'POST', `/rounds/${RID}/unlock`, { body: { reason: 'ปลดล็อกเพื่อแก้ไข' } });
  eq(res.statusCode, 200, 'HTTP 200 (ปลดล็อก)');
  eq(res.body.data.resultLocked, false, '★ ปลดล็อกแล้ว');
  console.log(`     ${res.body.message}`);
}
{
  // ★ ปลดล็อกต้องมีเหตุผล
  const res = await call(hist, 'POST', `/rounds/${RID}/unlock`, { body: {} });
  eq(res.statusCode, 400, '★ ปลดล็อกไม่มีเหตุผล → 400');
}
{
  // ★ คำนวณใหม่ — ส่ง slots ที่ให้ผลตรง
  const slots = new Array(SLOT_COUNT).fill('000000');
  slots[0] = '314159';
  const res = await call(hist, 'POST', `/rounds/${RID}/recompute`, { body: { slots } });
  eq(res.statusCode, 200, 'HTTP 200 (คำนวณใหม่)');
  eq(res.body.data.result, '314159', '★ ผลใหม่จาก slots');
  eq(computeResult(slots).result, res.body.data.result, '★ ตรงกับ lib');
  t('มี steps', Array.isArray(res.body.data.steps));
  console.log(`     ${res.body.message}`);
}
{
  const res = await call(hist, 'POST', `/rounds/${RID}/recompute`, { body: { slots: ['1'] } });
  eq(res.statusCode, 400, '★ slots ไม่ครบ → 400');
}

/* ================================================================ */
sect('18. ★ เส้นห้ามชนกัน (2 router รวมกัน)');
{
  const all = [];
  [main, hist].forEach((rt, ri) => {
    rt.stack.filter(l => l.route).forEach(l => {
      all.push({ router: ri === 0 ? 'Game20' : 'History', path: l.route.path, methods: Object.keys(l.route.methods) });
    });
  });
  console.log('     เส้นทั้งหมด:');
  all.forEach(r => console.log(`       [${r.router.padEnd(7)}] ${r.methods.join(',').toUpperCase().padEnd(6)} ${r.path}`));

  const seen = new Set(); let dup = 0;
  all.forEach(r => r.methods.forEach(m => {
    const k = `${m}:${r.path}`;
    if (seen.has(k)) { dup++; console.log(`       ⚠️ ซ้ำ: ${k}`); }
    seen.add(k);
  }));
  eq(dup, 0, '★ ไม่มีเส้นซ้ำระหว่าง 2 router');
  t(`รวม ${all.length} เส้น`, all.length >= 35, `${all.length}`);

  // ★ /rounds ต้องมาก่อน /rounds/:id
  const paths = all.map(x => x.path);
  const iRounds = paths.indexOf('/rounds');
  const iParam = paths.indexOf('/rounds/:id');
  t('★ /rounds มาก่อน /rounds/:id', iRounds < iParam, `${iRounds} < ${iParam}`);

  // ★ /guide ต้องมาก่อน /guide/svg ไม่ได้ — แต่ /guide/svg ต้องมี
  t('★ มี /guide', paths.includes('/guide'));
  t('★ มี /guide/svg', paths.includes('/guide/svg'));
  t('★ มี /history/stats', paths.includes('/history/stats'));
  t('★ มี /history/export', paths.includes('/history/export'));
  t('★ มี /history/verify', paths.includes('/history/verify'));
  t('★ มี /rounds/:id/edit', paths.includes('/rounds/:id/edit'));
  t('★ มี /rounds/:id/history', paths.includes('/rounds/:id/history'));
  t('★ มี /codes/:id/verify', paths.includes('/codes/:id/verify'));
}

/* ================================================================ */
console.log(`\n${'='.repeat(56)}`);
console.log(`  ผ่าน ${pass}  |  ไม่ผ่าน ${fail}  |  รวม ${pass + fail}`);
console.log('='.repeat(56));

try { await terminate(DB); } catch {}
process.exit(fail > 0 ? 1 : 0);
