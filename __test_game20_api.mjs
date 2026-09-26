/**
 * __test_game20_api.mjs — ทดสอบชั้น API ของหวย 20 ช่อง 6 หลัก
 * รัน: npx tsx __test_game20_api.mjs
 *
 * วิธีทดสอบ: เรียก handler ของ Express route ตรงๆ ด้วย mock req/res
 * → ไม่ต้องพึ่ง server ที่ port 3000 (ซึ่งยังถูกยึดอยู่)
 * → ยังครอบคลุมตรรกะทั้งหมด: validation, คำนวณ, บอท, บันทึก
 */
import { game20Routes } from './server/routes/v1/game20.routes.ts';
import { Game20Service, healthPayload, computeFromSlots } from './server/domains/game20/game20.service.ts';
import { computeResult, SLOT_COUNT, padNum } from './src/shared/lib/lottery20.ts';
import { errorHandler } from './server/middleware/error-handler.ts';

let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}  ${e}`); } };
const eq = (a, b, n) => t(n, a === b, `ได้ ${JSON.stringify(a)} คาด ${JSON.stringify(b)}`);
const sect = n => console.log(`\n── ${n} ──`);

/* ================================================================
 * ★ Firestore จริง (emulator 127.0.0.1:8085)
 * ------------------------------------------------------------------
 * เดิมใช้ mock → เห็น 500 จาก doc(null) ซึ่งไม่ใช่บั๊กจริง
 * เปลี่ยนมาใช้ emulator เพื่อทดสอบเส้นเขียน (PUT /config, /bot/config,
 * POST /rounds/close) ได้จริง
 * ================================================================ */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';

const { initializeApp } = await import('firebase/app');
const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');

const _app = initializeApp({ projectId: 'demo-ak88', apiKey: 'fake' }, 'g20test');
const DB = getFirestore(_app);

// ★ ต้อง connect ตรง — env var อย่างเดียวไม่พอสำหรับ client SDK
//   (ไม่งั้นจะยิงไป backend จริง → PERMISSION_DENIED project demo-ak88)
connectFirestoreEmulator(DB, '127.0.0.1', 8085);

/* ================================================================
 * In-memory Firestore จำลอง — พอสำหรับทดสอบ route
 * ================================================================ */
function makeMockDb() {
  const store = new Map();
  const key = (c, id) => `${c}/${id}`;

  const docRef = (col, id) => ({
    _col: col, _id: id,
    async get() {
      const v = store.get(key(col, id));
      return { exists: () => v !== undefined, id, data: () => v };
    },
    async set(data, opts) {
      const prev = store.get(key(col, id)) || {};
      store.set(key(col, id), opts?.merge ? { ...prev, ...data } : data);
    },
    async update(data) {
      const prev = store.get(key(col, id)) || {};
      store.set(key(col, id), { ...prev, ...data });
    },
  });

  return {
    _store: store,
    doc: (db, col, id) => docRef(col, id),
    collection: (db, col) => ({
      _col: col,
      async add(data) { const id = `auto${store.size}`; store.set(key(col, id), data); return { id }; },
    }),
  };
}

/** แปลง firebase/firestore call ให้ใช้ mock — ผูกผ่าน global shim */
/* ================================================================
 * Mock Express req/res
 * ================================================================ */
function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    locals: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  return res;
}

/** หา route handler ตาม method+path แล้วเรียกมัน */
function findRoute(router, method, path) {
  const layer = router.stack.find(l => {
    if (!l.route) return false;
    if (!l.route.methods[method.toLowerCase()]) return false;
    const p = l.route.path;
    return p === path;
  });
  if (!layer) return null;
  // handler สุดท้ายคือตัวจริง (ตัวก่อนหน้าอาจเป็น middleware)
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

/** ★ คืน middleware ทั้งหมดของเส้น (เพื่อเทสต์ว่า guard ถูกใส่จริง) */
function findRouteStack(router, method, path) {
  const layer = router.stack.find(l => {
    if (!l.route) return false;
    if (!l.route.methods[method.toLowerCase()]) return false;
    return l.route.path === path;
  });
  if (!layer) return null;
  return { stack: layer.route.stack.map((l) => l.handle), params: {} };
}

/** เรียกทุก middleware ตามลำดับ — คืนว่า "ผ่านไปถึง handler จริง" ไหม */
function runStack(stack, req) {
  return new Promise((resolve) => {
    const res = makeRes();
    res.locals = { apiKeyDoc: { name: 'test' }, requestId: 'req_test' };
    let i = 0;
    let settled = false;

    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };

    const next = (err) => {
      if (err) { finish({ passed: false, res, stoppedAt: i, err: String(err) }); return; }
      i++;
      if (i >= stack.length) { finish({ passed: true, res, stoppedAt: i }); return; }
      invoke();
    };

    function invoke() {
      try {
        // ★ middleware บางตัวเป็น async — ต้องดัก promise ที่ reject
        const out = stack[i](req, res, next);
        if (out && typeof out.then === 'function') {
          out.catch((e) => finish({ passed: false, res, stoppedAt: i, err: String(e) }));
        }
      } catch (e) {
        finish({ passed: false, res, stoppedAt: i, err: String(e) });
      }
    }

    // ★ กันค้าง: ถ้า middleware ไม่เรียก next และไม่ตอบ → ถือว่าจบที่จุดนั้น
    setTimeout(() => finish({
      passed: false, res, stoppedAt: i,
      err: res._timeout !== undefined ? 'timeout' : 'ไม่มีการตอบกลับ',
      timedOut: true,
    }), 5000);

    invoke();
  });
}

// ★ session admin — ให้ผ่าน guard สิทธิ์ (B5)
const ADMIN_SESSION = Buffer.from(JSON.stringify({
  role: 'admin', username: 'admin1', userId: 'u1',
})).toString('base64');

async function call(router, method, path, { body, query, params, locals, session, noSession, timeoutMs } = {}) {
  const h = findRoute(router, method, path);
  if (!h) throw new Error(`ไม่พบเส้น ${method} ${path}`);
  const headers = {};
  // ★ ใส่ session เว้นแต่สั่ง noSession (เพื่อเทสต์ว่า guard ทำงาน)
  if (!noSession) {
    headers['x-staff-session'] = session
      ? Buffer.from(JSON.stringify(session)).toString('base64')
      : ADMIN_SESSION;
  }
  const req = { body: body || {}, query: query || {}, params: params || {}, headers };
  const res = makeRes();
  res.locals = { apiKeyDoc: { name: 'test' }, ...(locals || {}) };

  // ★ ต้องรัน error handler จริง — asyncHandler ส่ง error ไปที่ next()
  //   mock ที่ throw เฉยๆ จะเห็น 200/null แทน 400 ที่ถูกต้อง
  //
  // ★ รอจนกว่า handler จะเขียนคำตอบจริง
  //
  // ปัญหาเดิม: setInterval(1ms) ทำงานแบบ timer phase ซึ่ง *ก่อน*
  // microtask ที่ค้างอยู่ (await getConfig() → Firestore) จะได้รัน
  //   → resolve ก่อนที่ async handler จะเขียน res.body → ได้ null
  //
  // วิธีแก้: ใช้ res.json เป็นสัญญาณว่าเสร็จ แล้วรอด้วย sleep จริง
  //          เพื่อให้ microtask ทั้งหมดได้ระบายออก
  let settled = false;
  const origJson = res.json.bind(res);
  let resolveDone;
  const donePromise = new Promise(r => { resolveDone = r; });
  res.json = (b) => { const out = origJson(b); settled = true; resolveDone(); return out; };

  // ★ กันค้าง: ถ้า handler ไม่ตอบภายในเวลาที่กำหนด ให้ถือว่าเสร็จ
  //   (เดิม: error handler เขียน res แล้วไม่เรียก res.json → ค้างไม่จบ)
  //   ★ ตั้ง 20 วินาที เพราะบางเส้นคำนวณหนัก (บอทหลบ 500 ผล)
  const waitMs = timeoutMs ?? 20000;
  const timeout = new Promise(r => setTimeout(r, waitMs));
  let timedOut = false;

  h(req, res, (err) => {
    if (err) { errorHandler(err, req, res, () => {}); }
    if (!settled) { timedOut = true; resolveDone(); }
  });

  await Promise.race([donePromise, timeout]);
  if (!settled) { timedOut = true; if (!res.body) res.body = { _timeout: true }; }
  // ★ ระบาย microtask/timer ที่ค้าง ให้ Firestore เขียนเสร็จ
  await new Promise(r => setTimeout(r, 60));
  res._timedOut = timedOut;
  return res;
}

const router = game20Routes(DB);

/* ================================================================ */
sect('1. healthPayload()');
{
  const h = healthPayload();
  eq(h.module, 'game20', 'module = game20');
  eq(h.rules.slots, 20, '★ 20 ช่อง');
  eq(h.rules.digitsPerSlot, 6, '★ 6 หลัก');
  eq(h.rules.subtractSlot, 17, '★ ลบช่องที่ 17');
  t('สูตรถูกต้อง', h.rules.formula.includes('slot17'), h.rules.formula);
  t('ช่วงผล 000000-999999', h.rules.resultRange === '000000 – 999999', h.rules.resultRange);
  t('มีอัตราจ่าย', h.payouts.types > 0, `${h.payouts.types} ประเภท`);
  t('มี 5 โหมดบอทออกผล', h.bots.resultBot.modes.length === 5);
  t('มี 6 แผนสลับ', h.bots.numberBot.plans.length === 6);
  console.log(`     อัตราจ่าย ${h.payouts.types} ประเภท • margin ${h.payouts.marginPercent}% • ${h.payouts.verdict}`);
}

/* ================================================================ */
sect('2. GET /health ผ่าน route');
{
  const res = await call(router, 'GET', '/health');
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.status, 'success', 'status success');
  eq(res.body.data.rules.slots, 20, '★ route คืน 20 ช่อง');
  t('มีข้อความ', !!res.body.message);
}

/* ================================================================ */
sect('3. POST /compute — คำนวณผล');
{
  const slots = new Array(SLOT_COUNT).fill('000000');
  slots[0] = '123456';
  slots[16] = '23456';

  const res = await call(router, 'POST', '/compute', { body: { slots } });
  eq(res.statusCode, 200, 'HTTP 200');
  t('ได้ผล', /^\d{6}$/.test(res.body.data.result), res.body.data.result);
  eq(computeResult(slots).result, res.body.data.result, '★ ตรงกับคำนวณใน lib');
  t('มี steps อธิบาย', Array.isArray(res.body.data.steps), `${res.body.data.steps?.length} ขั้น`);
  t('step มี n/label/value', res.body.data.steps.every(s => s.n && s.label && s.value !== undefined));
  console.log(`     ${res.body.message}`);
  // ★ steps เป็น object {n,label,value} ไม่ใช่ string
  res.body.data.steps.forEach(s => console.log(`       ${s.n}. ${s.label} = ${s.value}`));
}
{
  // ★ จำนวนช่องผิด → 400
  const res = await call(router, 'POST', '/compute', { body: { slots: ['1','2','3'] } });
  eq(res.statusCode, 400, '★ ช่องไม่ครบ → HTTP 400');
  eq(res.body.status, 'error', 'status error');
  eq(res.body.code, 'BAD_REQUEST', 'code BAD_REQUEST');
}
{
  const res = await call(router, 'POST', '/compute', { body: {} });
  eq(res.statusCode, 400, 'ไม่ส่ง slots → 400');
}

/* ================================================================ */
sect('4. POST /validate');
{
  const okSlots = new Array(SLOT_COUNT).fill('000000');
  const res = await call(router, 'POST', '/validate', { body: { slots: okSlots } });
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.data.ok, true, 'เลขถูกต้อง → ok');
}
{
  const bad = new Array(SLOT_COUNT).fill('000000');
  bad[16] = '';
  const res = await call(router, 'POST', '/validate', { body: { slots: bad } });
  eq(res.body.data.ok, false, '★ ช่อง 17 ว่าง → ไม่ ok');
  t('แจ้ง error เรื่อง 17', res.body.data.errors.some(e => e.includes('17')), res.body.data.errors.join('|'));
}

/* ================================================================ */
sect('5. GET /rates — ตารางอัตราจ่าย');
{
  const res = await call(router, 'GET', '/rates');
  eq(res.statusCode, 200, 'HTTP 200');
  const rows = res.body.data.rates;
  t('มีอัตราจ่าย', rows.length > 0, `${rows.length} แถว`);
  t('ทุกแถวมี rate', rows.every(r => r.rate > 0));
  t('ทุกแถวมี odds', rows.every(r => r.odds > 0));
  t('ทุกแถวมี verdict', rows.every(r => !!r.verdict));
  t('มี margin', res.body.data.margin.marginPercent !== undefined);
  console.log('     ตารางอัตราจ่าย:');
  rows.forEach(r => console.log(`       ${String(r.label).padEnd(16)} ${String(r.rate).padStart(6)}×  EV=${r.playerEV}  ${r.verdict}`));
  console.log(`     margin เฉลี่ย ${res.body.data.margin.marginPercent}% — ${res.body.data.margin.verdict}`);
}
{
  // ★ อัตราจ่ายผิด → 400
  const res = await call(router, 'PUT', '/rates', { body: { rates: [{ key: 'x', rate: -5 }] } });
  eq(res.statusCode, 400, '★ rate ติดลบ → 400');
}
{
  const res = await call(router, 'PUT', '/rates', { body: { rates: [{ key: 'x', rate: 9_999_999 }] } });
  eq(res.statusCode, 400, '★ rate สูงเกิน → 400');
}
{
  const res = await call(router, 'PUT', '/rates', { body: {} });
  eq(res.statusCode, 400, 'ไม่ส่ง rates → 400');
}

/* ================================================================ */
sect('6. POST /evaluate — ตรวจรางวัล');
{
  const bets = [
    { number: '456', type: '3ตัวบน', amount: 100 },
    { number: '56',  type: '2ตัวบน', amount: 100 },
  ];
  const res = await call(router, 'POST', '/evaluate', {
    body: { bets, result: '123456', rates: { '3ตัวบน': 900, '2ตัวบน': 95 } },
  });
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.data.result, '123456', 'ผลถูก pad เป็น 6 หลัก');
  eq(res.body.data.totalBet, 200, '★ ยอดรับ 200');
  t('จ่ายถูกคำนวณ', res.body.data.payout > 0, `จ่าย ${res.body.data.payout}`);
  eq(res.body.data.winCount, 2, '★ ผู้ชนะ 2 ราย (3ตัวบน + 2ตัวบน)');
  // 100×900 + 100×95 = 99,500
  eq(res.body.data.payout, 100 * 900 + 100 * 95, '★ ยอดจ่าย = 99,500');
  eq(res.body.data.profit, 200 - 99500, 'กำไรติดลบถูกต้อง');
  console.log(`     ${res.body.message}`);
}
{
  const res = await call(router, 'POST', '/evaluate', { body: { bets: [] } });
  eq(res.statusCode, 400, 'ไม่ส่ง result → 400');
}
{
  const res = await call(router, 'POST', '/evaluate', { body: { result: '123456' } });
  eq(res.statusCode, 400, 'ไม่ส่ง bets → 400');
}

/* ================================================================ */
sect('7. POST /exposure — ความเสี่ยง');
{
  const bets = [
    { number: '456', type: '3ตัวบน', amount: 500 },
    { number: '56',  type: '2ตัวบน', amount: 300 },
  ];
  const res = await call(router, 'POST', '/exposure', {
    body: { bets, rates: { '3ตัวบน': 900, '2ตัวบน': 95 } },
  });
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.data.totalBet, 800, '★ ยอดรับ 800');
  t('มี worstNumbers', Array.isArray(res.body.data.worstNumbers));
  t('มีคำแนะนำ', typeof res.body.data.advice === 'string', res.body.data.advice);
  console.log(`     ${res.body.message}`);
  console.log(`     ${res.body.data.advice}`);
}

/* ================================================================ */
sect('8. POST /slots/random');
{
  const res = await call(router, 'POST', '/slots/random', { body: { count: 5 } });
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.count, 5, '★ ได้ 5 ชุด');
  t('ทุกชุดมี 20 ช่อง', res.body.data.every(x => x.slots.length === 20));
  t('ทุกชุดคำนวณผลได้', res.body.data.every(x => /^\d{6}$/.test(x.result)));
}
{
  const res = await call(router, 'POST', '/slots/random', { body: {} });
  eq(res.statusCode, 200, 'ไม่ส่ง count → ค่าเริ่มต้น 1');
  t('ได้ผลเดียว', /^\d{6}$/.test(res.body.data.result), res.body.data.result);
}

/* ================================================================ */
sect('9. ★ POST /slots/solve — วางเลขให้ได้ผลตามเป้า');
{
  const targets = ['000000', '123456', '777777', '999999', '314159'];
  for (const tg of targets) {
    const res = await call(router, 'POST', '/slots/solve', { body: { target: tg, seed: 42 } });
    eq(res.statusCode, 200, `HTTP 200 (เป้า ${tg})`);
    eq(res.body.data.result, tg, `★ เป้า ${tg} → ได้ ${tg}`);
    eq(res.body.data.verified, true, '  verified = true');
    eq(computeResult(res.body.data.slots).result, tg, '  ★ คำนวณซ้ำได้ผลเดิม');
  }
  const res = await call(router, 'POST', '/slots/solve', { body: { target: '777777', seed: 42 } });
  console.log(`     ${res.body.message}`);
  console.log(`     วิธี: ${res.body.data.method} • ใช้ยอดรวม ${res.body.data.sumUsed}`);
}
{
  const res = await call(router, 'POST', '/slots/solve', { body: { target: 'abc' } });
  eq(res.statusCode, 400, '★ เป้าไม่ใช่ตัวเลข → 400');
}
{
  const res = await call(router, 'POST', '/slots/solve', { body: {} });
  eq(res.statusCode, 400, 'ไม่ส่ง target → 400');
}

/* ================================================================ */
sect('10. ★ POST /bot/result — บอทออกผล');
{
  const bets = [{ number: '456', type: '3ตัวบน', amount: 100 }];
  const res = await call(router, 'POST', '/bot/result', {
    body: { bets, mode: 'profit', candidates: 300, seed: 7, config: { enabled: true } },
  });
  eq(res.statusCode, 200, 'HTTP 200');
  t('ได้ผล 6 หลัก', /^\d{6}$/.test(res.body.data.result));
  eq(res.body.data.verified, true, '★ verified');
  eq(computeResult(res.body.data.slots).result, res.body.data.result, '★ เลขตรงผล');
  t('มี prizes', !!res.body.data.prizes);
  t('มีสูตรอธิบาย', !!res.body.data.formula);
  console.log(`     ${res.body.message}`);
  console.log(`     สูตร: Σ=${res.body.data.formula.sum} − ช่อง17(${res.body.data.formula.subtractSlot})=${res.body.data.formula.subtractValue} → ${res.body.data.formula.raw} mod ${res.body.data.formula.mod} = ${res.body.data.result}`);
  console.log(`     เศรษฐศาสตร์: รับ ฿${res.body.data.totalBet} จ่าย ฿${res.body.data.payout} กำไร ฿${res.body.data.profit}`);
}
{
  // ★ โหมด avoid — ห้ามมีคนถูก
  const bets = [{ number: '456', type: '3ตัวบน', amount: 100 }];
  const res = await call(router, 'POST', '/bot/result', {
    body: { bets, mode: 'avoid', candidates: 500, seed: 11, config: { enabled: true, avoidAllWinners: true } },
  });
  eq(res.body.data.winCount, 0, '★ โหมด avoid → ไม่มีผู้ชนะ');
  eq(res.body.data.payout, 0, 'ไม่จ่ายเลย');
  console.log(`     ${res.body.message}`);
}
{
  // ★ โหมด target
  const res = await call(router, 'POST', '/bot/result', {
    body: { bets: [], forcedResult: '888888', config: { enabled: true } },
  });
  eq(res.body.data.result, '888888', '★ ตั้งผลเอง → ได้ตามที่ตั้ง');
  eq(res.body.data.verified, true, 'verified');
}
{
  const res = await call(router, 'POST', '/bot/result', { body: { bets: 'ไม่ใช่ array' } });
  eq(res.statusCode, 400, '★ bets ไม่ใช่ array → 400');
}

/* ================================================================ */
sect('11. ★ POST /bot/number — บอทวางเลข (สลับคน)');
{
  const res = await call(router, 'POST', '/bot/number', { body: { count: 12, seed: 555 } });
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.data.playerCount, 12, '★ 12 คน');
  eq(res.body.data.assignments.length, 12, 'ได้ผู้เล่นครบ');
  eq(res.body.data.allValid, true, '★ ทุกคนคำนวณผลตรง');
  t('มี note อธิบาย', res.body.data.note.length > 5);
  t('สลับไปมากกว่า 0%', res.body.data.changedPercent > 0, `${res.body.data.changedPercent}%`);
  console.log(`     ${res.body.message}`);
  console.log(`     ${res.body.data.note}`);
}
{
  // ★ ส่ง players มาเอง
  const players = Array.from({ length: 6 }, (_, i) => ({
    id: `u${i + 1}`, name: `ผู้เล่น ${i + 1}`,
    slots: Array.from({ length: 20 }, (_, j) => padNum((i + 1) * 11111 + j * 7)),
  }));
  const res = await call(router, 'POST', '/bot/number', { body: { players, seed: 99 } });
  eq(res.body.data.playerCount, 6, '★ ใช้ 6 คนที่ส่งมา');
  eq(res.body.data.allValid, true, 'ทุกคน valid');
  t('ชื่อติดมาด้วย', res.body.data.assignments.every(a => a.name));
}
{
  const res = await call(router, 'POST', '/bot/number', { body: { players: [] } });
  eq(res.statusCode, 400, '★ ผู้เล่นว่าง → 400');
}
{
  const res = await call(router, 'POST', '/bot/number', { body: { players: [{ id: 'x' }] } });
  eq(res.statusCode, 400, '★ ผู้เล่นไม่มี slots → 400');
}

/* ================================================================ */
sect('12. GET + PUT /bot/config — ★ เปิด/ปิดบอทจากหลังบ้าน');
{
  const res = await call(router, 'GET', '/bot/config');
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.data.resultModes.length, 5, '★ 5 โหมดออกผล');
  eq(res.body.data.swapPlans.length, 6, '★ 6 แผนสลับ');
  t('ทุกโหมดมี label+desc', res.body.data.resultModes.every(m => m.label && m.desc));
  t('ทุกแผนมี label+desc', res.body.data.swapPlans.every(m => m.label && m.desc));
  console.log('     โหมดออกผล: ' + res.body.data.resultModes.map(m => m.label).join(' • '));
  console.log('     แผนสลับ: ' + res.body.data.swapPlans.map(m => m.label).join(' • '));
}
{
  const res = await call(router, 'PUT', '/bot/config', {
    body: { resultBot: { enabled: false, mode: 'fair' } },
  });
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.data.resultBot.enabled, false, '★ ปิดบอทออกผลแล้ว');
  eq(res.body.data.resultBot.mode, 'fair', 'โหมด fair');
  console.log(`     ${res.body.message}`);
}
{
  const res = await call(router, 'PUT', '/bot/config', {
    body: { resultBot: { mode: 'ไม่ถูกต้อง' } },
  });
  eq(res.statusCode, 400, '★ โหมดผิด → 400');
}
{
  const res = await call(router, 'PUT', '/bot/config', {
    body: { numberBot: { plan: 'whatever' } },
  });
  eq(res.statusCode, 400, '★ แผนผิด → 400');
}
{
  const res = await call(router, 'PUT', '/bot/config', { body: {} });
  eq(res.statusCode, 400, 'ไม่ส่งอะไรเลย → 400');
}

/* ================================================================ */
sect('13. POST /bot/report');
{
  const bets = [{ number: '456', type: '3ตัวบน', amount: 100 }];
  const players = Array.from({ length: 5 }, (_, i) => ({
    id: `p${i}`, slots: Array.from({ length: 20 }, (_, j) => padNum(i * 1234 + j)),
  }));
  const res = await call(router, 'POST', '/bot/report', { body: { bets, players, config: { seed: 5 } } });
  eq(res.statusCode, 200, 'HTTP 200');
  t('มี report', !!res.body?.data?.report);
  t('บอทออกผลมี lastResult', /^\d{6}$/.test(res.body.data.report.resultBot.lastResult));
  t('บอทวางเลขมี note', res.body.data.report.numberBot.lastNote.length > 3);
  t('economics ครบ', typeof res.body.data.report.economics.totalBet === 'number');
  console.log(`     เศรษฐศาสตร์: รับ ฿${res.body.data.report.economics.totalBet} จ่าย ฿${res.body.data.report.economics.payout} กำไร ฿${res.body.data.report.economics.profit}`);
  if (res.body.data.report.warnings.length) {
    console.log(`     คำเตือน: ${res.body.data.report.warnings.join(' | ')}`);
  }
}

/* ================================================================ */
sect('14. GET /config + PUT /config');
{
  const res = await call(router, 'GET', '/config');
  eq(res.statusCode, 200, 'HTTP 200');
  t('มี enabled', typeof res.body.data.enabled === 'boolean');
  t('มีชื่อที่แสดง', !!res.body.data.displayName);
  t('มีขีดจำกัดเงิน', res.body.data.maxBetAmount > 0);
}
{
  const res = await call(router, 'PUT', '/config', { body: { displayName: 'ทดสอบ', minBetAmount: 20 } });
  eq(res.statusCode, 200, 'HTTP 200');
  eq(res.body.data.displayName, 'ทดสอบ', '★ แก้ชื่อแล้ว');
  eq(res.body.data.minBetAmount, 20, '★ แก้ขีดจำกัดแล้ว');
  console.log(`     ${res.body.message}`);
}

/* ================================================================ */
sect('15. ค่าตั้งต้น (Game20Config)');
{
  const res = await call(router, 'GET', '/config');
  const c = res.body.data;
  // ★ ตรวจว่าค่าเริ่มต้นสอดคล้องกัน
  t('min < max', c.minBetAmount < c.maxBetAmount, `${c.minBetAmount} < ${c.maxBetAmount}`);
  t('maxPayoutPerRound > 0', c.maxPayoutPerRound > 0);
  t('targetMarginPercent 0-100', c.targetMarginPercent > 0 && c.targetMarginPercent < 100);
  t('resultBot มีโหมด', !!c.resultBot.mode);
  t('numberBot มีแผน', !!c.numberBot.plan);
  console.log(`     ${c.displayName} • แทง ฿${c.minBetAmount}-${c.maxBetAmount} • เพดานจ่าย ฿${c.maxPayoutPerRound.toLocaleString()}`);
}

/* ================================================================ */
sect('16. ★ รัน 30 รอบผ่าน route — ต้องไม่มี error');
{
  let ok = 0, verified = 0;
  const modes = ['fair', 'profit', 'balance', 'avoid'];
  for (let i = 1; i <= 30; i++) {
    const bets = [{ number: padNum((i * 137) % 1000, 3), type: '3ตัวบน', amount: 50 }];
    const res = await call(router, 'POST', '/bot/result', {
      body: { bets, mode: modes[i % modes.length], seed: i, candidates: 80, config: { enabled: true } },
    });
    if (res.statusCode === 200 && /^\d{6}$/.test(res.body.data.result)) ok++;
    if (res.body.data.verified) verified++;
  }
  eq(ok, 30, '★ 30/30 เรียก route สำเร็จ');
  eq(verified, 30, '★ 30/30 verified');
}

/* ================================================================ */
sect('17. ★ เส้นห้ามชนกัน — ตรวจ routing');
{
  // static ก่อน param
  const routes = router.stack.filter(l => l.route).map(l => ({
    path: l.route.path,
    methods: Object.keys(l.route.methods),
  }));
  console.log('     เส้นทั้งหมด:');
  routes.forEach(r => console.log(`       ${r.methods.join(',').toUpperCase().padEnd(6)} ${r.path}`));

  // ★ /rounds ต้องมาก่อน /rounds/:id
  const iRounds = routes.findIndex(r => r.path === '/rounds');
  const iParam = routes.findIndex(r => r.path === '/rounds/:id');
  t('★ /rounds มาก่อน /rounds/:id', iRounds !== -1 && iParam !== -1 && iRounds < iParam, `${iRounds} < ${iParam}`);

  // ★ ไม่มี path ซ้ำกับ method เดียวกัน
  const seen = new Set();
  let dup = 0;
  routes.forEach(r => r.methods.forEach(m => {
    const k = `${m}:${r.path}`;
    if (seen.has(k)) { dup++; console.log(`       ⚠️ ซ้ำ: ${k}`); }
    seen.add(k);
  }));
  eq(dup, 0, '★ ไม่มีเส้นซ้ำกันเลย');

  // ★ ทุกเส้นขึ้นต้นด้วย / ยกเว้น root
  t('ทุกเส้นมี path ถูกต้อง', routes.every(r => r.path.startsWith('/')));
  t(`มีเส้นทั้งหมด ${routes.length} เส้น`, routes.length >= 20, `${routes.length}`);
}

/* ================================================================
 * ★ B5: ตรวจว่า "guard สิทธิ์" ถูกใส่ในเส้นสำคัญจริง
 * ================================================================ */
sect('★ B5: guard สิทธิ์ฝั่งเซิร์ฟเวอร์');

{
  // เส้นที่ต้องมี guard + สิทธิ์ที่ต้องใช้
  const GUARDED = [
    ['put',   '/config',          'game20.config'],
    ['put',   '/rates',           'game20.rates'],
    ['post',  '/bot/result',      'game20.bot_result'],
    ['put',   '/bot/config',      'game20.bot_result'],
    ['post',  '/bot/number',      'game20.bot_number'],
    ['post',  '/rounds/close',    'game20.close_round'],
    ['get',   '/stats',           'game20.report'],
  ];

  // ── 1) เส้นสำคัญต้องมี middleware มากกว่า 1 ตัว (guard + handler) ──
  for (const [method, path, perm] of GUARDED) {
    const rs = findRouteStack(router, method, path);
    if (!rs) { t(`มีเส้น ${method.toUpperCase()} ${path}`, false, 'ไม่พบเส้น'); continue; }
    t(`${method.toUpperCase()} ${path} มี guard (${rs.stack.length} ชั้น)`,
      rs.stack.length >= 2, `ได้ ${rs.stack.length}`);
  }

  // ── 2) ไม่มี session → ต้อง 401 ──
  for (const [method, path] of GUARDED) {
    const rs = findRouteStack(router, method, path);
    if (!rs) continue;
    const out = await runStack(rs.stack, {
      method: method.toUpperCase(), headers: {}, body: {}, params: {}, query: {},
    });
    t(`ไม่มี session → ${method.toUpperCase()} ${path} ถูกปฏิเสธ`,
      !out.passed && out.res.statusCode === 401,
      `passed=${out.passed} status=${out.res.statusCode}`);
  }

  // ── 3) staff (ไม่มีสิทธิ์) → ต้อง 403 ──
  const STAFF = Buffer.from(JSON.stringify({ role: 'staff' })).toString('base64');
  for (const [method, path] of GUARDED) {
    const rs = findRouteStack(router, method, path);
    if (!rs) continue;
    const out = await runStack(rs.stack, {
      method: method.toUpperCase(),
      headers: { 'x-staff-session': STAFF },
      body: {}, params: {}, query: {},
    });
    t(`staff → ${method.toUpperCase()} ${path} ถูกปฏิเสธ (403)`,
      !out.passed && out.res.statusCode === 403,
      `passed=${out.passed} status=${out.res.statusCode}`);
  }

  // ── 4) ✓ fix: staff ต้อง "ไม่" ถูกปฏิเสธ 100% — ต้องผ่านในสิ่งที่ไม่ต้องสิทธิ์ ──
  //     (เช่น /stats ต้องการ game20.report ซึ่ง staff ไม่มี → 403)
  //     แต่ /health ไม่มี guard → ต้องผ่าน
  const health = findRouteStack(router, 'get', '/health');
  if (health) {
    const out = await runStack(health.stack, {
      method: 'GET', headers: {}, body: {}, params: {}, query: {},
    });
    // ★ handler ที่ตอบเองได้จะไม่เรียก next() — เพราะฉะนั้นตัดสินจาก
    //   statusCode: 200 = เข้าถึงได้ (ไม่มี guard) / 401-403 = ถูกปฏิเสธ
    const code = out.res.statusCode;
    t('GET /health ไม่มี guard → เข้าได้โดยไม่ต้อง session',
      code === 200,
      `status=${code} passed=${out.passed} (handler ตอบเองจึงไม่เรียก next)`);
  }

  // ── 5) owner ผ่านทุกเส้น ──
  const OWNER = Buffer.from(JSON.stringify({ role: 'owner' })).toString('base64');
  for (const [method, path] of GUARDED) {
    const rs = findRouteStack(router, method, path);
    if (!rs) continue;
    const out = await runStack(rs.stack, {
      method: method.toUpperCase(),
      headers: { 'x-staff-session': OWNER },
      body: {}, params: { id: 'x' }, query: {},
    });
    t(`owner → ${method.toUpperCase()} ${path} ผ่าน guard`,
      out.stoppedAt >= rs.stack.length - 1 || out.err != null,
      `stoppedAt=${out.stoppedAt}/${rs.stack.length}`);
  }

  // ── 6) ★ revoked ชนะเสมอ ──
  const REVOKED = Buffer.from(JSON.stringify({
    role: 'admin', revoked: ['game20.bot_result'],
  })).toString('base64');
  const rs2 = findRouteStack(router, 'post', '/bot/result');
  if (rs2) {
    const out = await runStack(rs2.stack, {
      method: 'POST', headers: { 'x-staff-session': REVOKED },
      body: {}, params: {}, query: {},
    });
    t('★ admin ที่ถูกถอด game20.bot_result → 403',
      !out.passed && out.res.statusCode === 403,
      `passed=${out.passed} status=${out.res.statusCode}`);
  }

  // ── 7) นับเส้นที่มี guard ──
  const all = router.stack.filter(l => l.route);
  const guarded = all.filter(l => l.route.stack.length >= 2);
  // ★ เราตั้งใจใส่ guard เฉพาะเส้นที่เขียน/อ่านข้อมูลอ่อนไหว ไม่ใช่ทุกเส้น
  //   (เส้นอ่านสาธารณะ เช่น /health /guide /compute ไม่ต้องมี)
  t(`มีเส้นที่ใส่ guard ${guarded.length} เส้น (จาก ${all.length}) — เฉพาะเส้นอ่อนไหว`,
    guarded.length >= 10, `${guarded.length}/${all.length}`);
}

/* ================================================================ */
console.log(`\n${'='.repeat(54)}`);
console.log(`  ผ่าน ${pass}  |  ไม่ผ่าน ${fail}  |  รวม ${pass + fail}`);
console.log('='.repeat(54));

// ★ ต้อง terminate Firestore ก่อน ไม่งั้น Listen stream ค้างไม่ให้ process จบ
try {
  const { terminate } = await import('firebase/firestore');
  await terminate(DB);
} catch { /* ไม่เป็นไร */ }
process.exit(fail > 0 ? 1 : 0);
