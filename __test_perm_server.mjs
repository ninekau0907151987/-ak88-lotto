/**
 * __test_perm_server.mjs — B5: ทดสอบการตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์
 * ★ สำคัญ: ต้องตรงกับฝั่ง UI (permissions.ts) 100%
 */
import {
  ALL_PERMISSIONS as SERVER_ALL, ROLE_PERMISSIONS, LOCKED_ROLES,
  effectivePermissions, hasPermission, hasAnyPermission, hasAllPermissions,
  requirePermission, requireAnyPermission, requireRole, compareWithUi,
} from './server/middleware/permission.ts';
import {
  ALL_PERMISSIONS as UI_ALL, ROLES, PERMISSIONS,
} from './src/shared/lib/permissions.ts';

let pass = 0, fail = 0;
const fails = [];
function eq(a, e, label) {
  const A = JSON.stringify(a), E = JSON.stringify(e);
  if (A === E) pass++;
  else { fail++; fails.push(`${label}\n     ได้: ${A}\n     ต้องได้: ${E}`); }
}
function ok(c, label) { eq(!!c, true, label); }

/* ── mock req/res ── */
function mockReq(session) {
  return { headers: session ? { 'x-staff-session': JSON.stringify(session) } : {} };
}
function mockRes() {
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    locals: { requestId: 'req_test' },
  };
  return res;
}
function runMw(mw, req, res) {
  let nexted = false;
  mw(req, res, () => { nexted = true; });
  return nexted;
}

console.log('═══ 1) ★★★ สิทธิ์ฝั่ง server ตรงกับ UI ★★★ ═══');
const uiRolePerms = {};
for (const [k, v] of Object.entries(ROLES)) uiRolePerms[k] = v.perms;

const cmp = compareWithUi(UI_ALL, uiRolePerms);
if (!cmp.ok) {
  console.log('  missingInServer:', cmp.missingInServer);
  console.log('  missingInUi:', cmp.missingInUi);
  console.log('  roleMismatch:', cmp.roleMismatch);
}
eq(cmp.ok, true, 'สิทธิ์ทั้งชุดตรงกัน');
eq(cmp.missingInServer.length, 0, 'ไม่มีสิทธิ์ที่ UI มีแต่ server ขาด');
eq(cmp.missingInUi.length, 0, 'ไม่มีสิทธิ์ที่ server มีแต่ UI ขาด');
eq(cmp.roleMismatch.length, 0, 'role ทุกตัวตรงกัน');

console.log(`  จำนวนสิทธิ์ทั้งหมด: server ${SERVER_ALL.length} · UI ${UI_ALL.length}`);
eq(SERVER_ALL.length, UI_ALL.length, 'จำนวนสิทธิ์เท่ากัน');

console.log('\n═══ 2) owner/master ได้ทุกอย่าง ═══');
for (const role of ['owner', 'master']) {
  const s = { role };
  ok(hasPermission(s, 'staff.set_permission'), `${role} มี staff.set_permission`);
  ok(hasPermission(s, 'api.revoke_key'), `${role} มี api.revoke_key`);
  ok(hasPermission(s, 'settings.history_rollback'), `${role} มี rollback`);
  eq(effectivePermissions(s).size, SERVER_ALL.length, `${role} ได้ครบ ${SERVER_ALL.length}`);
}
eq(LOCKED_ROLES.includes('owner'), true, 'owner เป็น locked');
eq(LOCKED_ROLES.includes('master'), true, 'master เป็น locked');

console.log('\n═══ 3) admin ไม่ได้ 5 อย่าง ═══');
const adm = { role: 'admin' };
eq(hasPermission(adm, 'staff.set_permission'), false, 'admin ไม่มี staff.set_permission');
eq(hasPermission(adm, 'staff.delete'), false, 'admin ไม่มี staff.delete');
eq(hasPermission(adm, 'security.ip_whitelist'), false, 'admin ไม่มี ip_whitelist');
eq(hasPermission(adm, 'api.revoke_key'), false, 'admin ไม่มี api.revoke_key');
eq(hasPermission(adm, 'settings.history_rollback'), false, 'admin ไม่มี rollback');
eq(hasPermission(adm, 'game20.edit_result'), false, '★ admin แก้ผลย้อนหลังไม่ได้');
eq(hasPermission(adm, 'game20.codes'), false, '★ admin จัดการรหัสไม่ได้');
ok(hasPermission(adm, 'lottery.result_edit'), 'admin มี result_edit');
ok(hasPermission(adm, 'game20.bot_result'), 'admin มี bot_result');
eq(effectivePermissions(adm).size, SERVER_ALL.length - 7, `admin ได้ ${SERVER_ALL.length - 7} สิทธิ์ (ตัด 7)`);

console.log('\n═══ 4) staff ได้จำกัด ═══');
const st = { role: 'staff' };
ok(hasPermission(st, 'lottery.open_close'), 'staff เปิด/ปิดรอบได้');
ok(hasPermission(st, 'finance.deposit_approve'), 'staff อนุมัติฝากได้');
ok(hasPermission(st, 'game20.view'), 'staff ดูหวย 20 ช่องได้');
eq(hasPermission(st, 'lottery.result_edit'), false, '★ staff แก้ผลไม่ได้');
eq(hasPermission(st, 'game20.bot_result'), false, '★ staff สั่งบอทไม่ได้');
eq(hasPermission(st, 'staff.set_permission'), false, 'staff ตั้งสิทธิ์ไม่ได้');
eq(hasPermission(st, 'api.create_key'), false, 'staff สร้าง API key ไม่ได้');

console.log('\n═══ 5) agent ═══');
const ag = { role: 'agent' };
ok(hasPermission(ag, 'member.create'), 'agent สร้างสมาชิกได้');
ok(hasPermission(ag, 'member.credit_reduce'), 'agent ลดเครดิตได้');
ok(hasPermission(ag, 'report.finance'), 'agent ดูรายงานการเงินได้');
eq(hasPermission(ag, 'lottery.open_close'), false, 'agent เปิด/ปิดรอบไม่ได้');
ok(hasPermission(ag, 'member.credit_add'), 'agent เพิ่มเครดิตได้ (ตรงกับ UI)');
eq(hasPermission(ag, 'member.delete'), false, 'agent ลบสมาชิกไม่ได้');

console.log('\n═══ 6) viewer อ่านอย่างเดียว ═══');
const vw = { role: 'viewer' };
ok(hasPermission(vw, 'report.view'), 'viewer ดูรายงานได้');
eq(hasPermission(vw, 'member.create'), false, 'viewer สร้างสมาชิกไม่ได้');
eq(hasPermission(vw, 'finance.deposit_approve'), false, 'viewer อนุมัติไม่ได้');
eq(hasPermission(vw, 'lottery.open_close'), false, 'viewer เปิด/ปิดรอบไม่ได้');

console.log('\n═══ 7) ★ revoked ชนะเสมอ ═══');
const revoked = { role: 'admin', revoked: ['lottery.result_edit', 'game20.bot_result'] };
eq(hasPermission(revoked, 'lottery.result_edit'), false, '★ ถอดแล้ว → เข้าไม่ได้');
eq(hasPermission(revoked, 'game20.bot_result'), false, '★ ถอด bot_result → เข้าไม่ได้');
ok(hasPermission(revoked, 'lottery.view'), 'สิทธิ์อื่นยังใช้ได้');
eq(effectivePermissions(revoked).size, SERVER_ALL.length - 7 - 2, 'หัก 7 ของ admin + 2 ที่ถอด');

// ★ ถอดแล้วต้องไม่ได้ แม้ owner (locked)
const ownerRevoked = { role: 'owner', revoked: ['game20.bot_result'] };
eq(hasPermission(ownerRevoked, 'game20.bot_result'), false, '★ owner ถูกถอด → ก็เข้าไม่ได้');
ok(hasPermission(ownerRevoked, 'game20.config'), 'owner สิทธิ์อื่นยังได้');

console.log('\n═══ 8) granted เพิ่มได้ ═══');
const granted = { role: 'viewer', granted: ['lottery.result_edit'] };
eq(hasPermission(granted, 'lottery.result_edit'), true, 'เพิ่มสิทธิ์ให้ viewer ได้');
eq(hasPermission({ role: 'viewer' }, 'lottery.result_edit'), false, 'viewer ปกติไม่มี');

console.log('\n═══ 9) deny by default ═══');
eq(effectivePermissions(null).size, 0, 'ไม่มี session → 0 สิทธิ์');
eq(effectivePermissions(undefined).size, 0, 'undefined → 0 สิทธิ์');
eq(effectivePermissions({ role: 'unknown' }).size, 0, 'role ไม่รู้จัก → 0 สิทธิ์');
eq(hasPermission(null, 'lottery.view'), false, 'ไม่มี session → ปฏิเสธ');
eq(hasPermission({ role: 'staff' }, 'ไม่มีสิทธิ์นี้จริงๆ'), false, 'สิทธิ์ที่ไม่มีในระบบ → ปฏิเสธ');

console.log('\n═══ 10) disabled / หมดอายุ ═══');
eq(hasPermission({ role: 'owner', disabled: true }, 'lottery.view'), false, '★ ปิดการใช้งาน → ปฏิเสธ');
eq(effectivePermissions({ role: 'owner', disabled: true }).size, 0, 'ปิด → 0 สิทธิ์');
eq(hasPermission({ role: 'owner', expiresAt: Date.now() - 1000 }, 'lottery.view'), false, '★ หมดอายุ → ปฏิเสธ');
eq(hasPermission({ role: 'owner', expiresAt: Date.now() + 60000 }, 'lottery.view'), true, 'ยังไม่หมดอายุ → ผ่าน');

console.log('\n═══ 11) hasAny / hasAll ═══');
const s1 = { role: 'staff' };
eq(hasAnyPermission(s1, ['lottery.result_edit', 'lottery.open_close']), true, 'any — มี 1 ใน 2');
eq(hasAnyPermission(s1, ['lottery.result_edit', 'api.create_key']), false, 'any — ไม่มีเลย');
eq(hasAllPermissions(s1, ['lottery.view', 'lottery.open_close']), true, 'all — มีทั้งคู่');
eq(hasAllPermissions(s1, ['lottery.view', 'lottery.result_edit']), false, 'all — ขาด 1');

console.log('\n═══ 12) middleware requirePermission ═══');
let mw = requirePermission('lottery.result_edit');

// ไม่มี session → 401
let res = mockRes();
let nexted = runMw(mw, mockReq(null), res);
eq(nexted, false, 'ไม่มี session → ไม่ผ่าน');
eq(res.statusCode, 401, 'status 401');
eq(res.body.code, 'NOT_AUTHENTICATED', 'code NOT_AUTHENTICATED');

// staff ไม่มีสิทธิ์ → 403
res = mockRes();
nexted = runMw(mw, mockReq({ role: 'staff' }), res);
eq(nexted, false, 'staff ไม่มีสิทธิ์ → ไม่ผ่าน');
eq(res.statusCode, 403, 'status 403');
eq(res.body.code, 'PERMISSION_DENIED', 'code PERMISSION_DENIED');
ok(Array.isArray(res.body.need), 'บอกว่าต้องมีสิทธิ์อะไร');

// admin มีสิทธิ์ → ผ่าน
res = mockRes();
nexted = runMw(mw, mockReq({ role: 'admin' }), res);
eq(nexted, true, 'admin มีสิทธิ์ → ผ่าน');

console.log('\n═══ 13) middleware requireAnyPermission ═══');
mw = requireAnyPermission(['lottery.result_edit', 'settings.system']);
res = mockRes();
eq(runMw(mw, mockReq({ role: 'staff' }), res), false, 'staff ไม่มีทั้งคู่ → ไม่ผ่าน');
res = mockRes();
eq(runMw(mw, mockReq({ role: 'admin' }), res), true, 'admin มี settings.system → ผ่าน');

console.log('\n═══ 14) middleware requireRole ═══');
mw = requireRole(['owner', 'master']);
res = mockRes();
eq(runMw(mw, mockReq({ role: 'owner' }), res), true, 'owner → ผ่าน');
res = mockRes();
eq(runMw(mw, mockReq({ role: 'master' }), res), true, 'master → ผ่าน');
res = mockRes();
nexted = runMw(mw, mockReq({ role: 'admin' }), res);
eq(nexted, false, 'admin → ไม่ผ่าน');
eq(res.body.code, 'ROLE_DENIED', 'code ROLE_DENIED');
res = mockRes();
nexted = runMw(mw, mockReq(null), res);
eq(res.statusCode, 401, 'ไม่มี session → 401');

console.log('\n═══ 15) ★ เทสต์จริง: ยิง API ตรงโดยไม่มีสิทธิ์ ═══');
// จำลองว่า staff พยายามแก้ผลหวย 20 ช่อง ผ่าน API ตรง
const DANGEROUS = [
  ['game20.edit_result', 'staff'],
  ['game20.bot_result', 'staff'],
  ['game20.bot_number', 'staff'],
  ['game20.rates', 'staff'],
  ['staff.set_permission', 'admin'],
  ['api.revoke_key', 'admin'],
  ['finance.adjust', 'staff'],
];
for (const [perm, role] of DANGEROUS) {
  res = mockRes();
  const passed = runMw(requirePermission(perm), mockReq({ role }), res);
  eq(passed, false, `★ ${role} ยิง ${perm} ตรง ๆ → ถูกปฏิเสธ`);
  eq(res.statusCode, 403, `${role} + ${perm} → 403`);
}

console.log('\n═══ 16) header เสียหาย → ปฏิเสธ (ไม่พัง) ═══');
const badReqs = [
  { headers: { 'x-staff-session': 'ไม่ใช่ json' } },
  { headers: { 'x-staff-session': 'eyJhIjoxfQ==' } },   // base64 ของ {"a":1} — ไม่มี role
  { headers: { 'x-staff-session': '{"no":"role"}' } },
  { headers: {} },
];
for (const r of badReqs) {
  res = mockRes();
  const passed = runMw(requirePermission('lottery.view'), r, res);
  eq(passed, false, `header เสียหาย (${String(r.headers['x-staff-session'] || 'ว่าง').slice(0, 20)}) → ปฏิเสธ`);
  eq(res.statusCode, 401, 'status 401');
}

// base64 ที่ถูกต้อง → ผ่าน
const goodB64 = Buffer.from(JSON.stringify({ role: 'admin', username: 'admin1' })).toString('base64');
res = mockRes();
eq(runMw(requirePermission('lottery.view'), { headers: { 'x-staff-session': goodB64 } }, res), true,
  'base64 ถูกต้อง → ผ่าน');

console.log('\n═══ 17) สิทธิ์หวย 20 ช่องครบ ═══');
const G20 = SERVER_ALL.filter(p => p.startsWith('game20.'));
eq(G20.length, 11, 'มีสิทธิ์ game20 11 อย่าง');
for (const p of ['game20.view', 'game20.config', 'game20.rates', 'game20.bot_result',
                 'game20.bot_number', 'game20.history', 'game20.edit_result',
                 'game20.codes', 'game20.risk_limits', 'game20.report', 'game20.close_round']) {
  ok(SERVER_ALL.includes(p), `มีสิทธิ์ ${p}`);
}

console.log('\n' + '═'.repeat(58));
console.log(`ผ่าน ${pass}  |  ไม่ผ่าน ${fail}`);
if (fails.length) { console.log('\n★ ที่ไม่ผ่าน:'); fails.forEach(f => console.log('   - ' + f)); }
else console.log('★★★ สิทธิ์ฝั่งเซิร์ฟเวอร์ถูกต้อง + ตรงกับ UI 100% ★★★');
console.log('═'.repeat(58));
process.exit(fail ? 1 : 0);
