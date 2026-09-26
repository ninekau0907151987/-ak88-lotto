/**
 * __test_permissions.mjs
 * ทดสอบเครื่องยนต์สิทธิ์ — รัน: npx tsx __test_permissions.mjs
 */
import {
  PERMISSIONS as P, ROLES, ROLE_LIST, ALL_PERMISSIONS, PERMISSION_GROUPS,
  effectivePermissions, can, canAny, canAll, countPermissions, permissionSummary,
  PERMISSION_META,
} from './src/shared/lib/permissions.ts';

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
};
const sect = n => console.log(`\n── ${n} ──`);

const S = (role, extra = [], revoked = []) => ({
  uid: 'u1', username: 'test', displayName: 'ทดสอบ', role, grantedExtra: extra, revoked,
});

/* ================================================================ */
sect('1. โครงสร้างสิทธิ์');
t('มีสิทธิ์อย่างน้อย 70 รายการ', ALL_PERMISSIONS.length >= 70, `ได้ ${ALL_PERMISSIONS.length}`);
t('ไม่มีสิทธิ์ซ้ำ', new Set(ALL_PERMISSIONS).size === ALL_PERMISSIONS.length);
t('ทุกสิทธิ์มี metadata', ALL_PERMISSIONS.every(p => PERMISSION_META[p]?.label));
t('ทุกสิทธิ์มีรูปแบบ หมวด.การกระทำ', ALL_PERMISSIONS.every(p => /^[a-z0-9_]+\.[a-z0-9_]+$/.test(p)),
  ALL_PERMISSIONS.filter(p => !/^[a-z_]+\.[a-z_]+$/.test(p)).join(','));
t('มี 16 หมวด (เดิม 15 + game20)', PERMISSION_GROUPS.length === 16, `ได้ ${PERMISSION_GROUPS.length}`);
const catCount = PERMISSION_GROUPS.reduce((s, g) => s + g.perms.length, 0);
t('ผลรวมในหมวด = ทั้งหมด', catCount === ALL_PERMISSIONS.length, `${catCount} vs ${ALL_PERMISSIONS.length}`);

/* ================================================================ */
sect('2. ปฏิเสธโดยปริยาย (deny by default)');
t('ไม่มี session → ไม่มีสิทธิ์เลย', effectivePermissions(null).size === 0);
t('can() กับ null = false', can(null, P.MEMBER_VIEW) === false);
t('role ปลอม → ไม่มีสิทธิ์', effectivePermissions({ ...S('viewer'), role: 'hacker' }).size === 0);

/* ================================================================ */
sect('3. สิทธิ์ตามตำแหน่ง');
const owner  = S('owner');
const master = S('master');
const admin  = S('admin');
const staff  = S('staff');
const agent  = S('agent');
const viewer = S('viewer');

t('owner ได้ทุกสิทธิ์', effectivePermissions(owner).size === ALL_PERMISSIONS.length);
t('master ได้ทุกสิทธิ์', effectivePermissions(master).size === ALL_PERMISSIONS.length);
t('admin ได้เกือบทั้งหมด', effectivePermissions(admin).size >= ALL_PERMISSIONS.length - 8,
  `ได้ ${effectivePermissions(admin).size}`);
t('admin ไม่ได้ตั้งสิทธิ์พนักงาน', !can(admin, P.STAFF_SET_PERMISSION));
t('admin ไม่ได้จัดการ IP ไวท์ลิสต์', !can(admin, P.SECURITY_IP_WHITELIST));
t('admin อนุมัติฝากได้', can(admin, P.FINANCE_DEPOSIT_APPROVE));
t('staff เห็นสมาชิกได้', can(staff, P.MEMBER_VIEW));
t('staff เพิ่มเครดิตได้', can(staff, P.MEMBER_CREDIT_ADD));
t('staff ลบสมาชิกไม่ได้', !can(staff, P.MEMBER_DELETE));
t('staff ตั้งสิทธิ์คนอื่นไม่ได้', !can(staff, P.STAFF_SET_PERMISSION));
t('staff ลบเอเย่นต์ไม่ได้', !can(staff, P.AGENT_DELETE));
t('agent สร้างสมาชิกได้', can(agent, P.MEMBER_CREATE));
t('agent ลบเอเย่นต์ไม่ได้', !can(agent, P.AGENT_DELETE));
t('agent ตั้งค่าหวยไม่ได้', !can(agent, P.LOTTERY_OPEN_CLOSE));
t('viewer ดูได้', can(viewer, P.MEMBER_VIEW));
t('viewer ทำอะไรไม่ได้เลย', !can(viewer, P.MEMBER_CREATE) && !can(viewer, P.MEMBER_CREDIT_ADD) && !can(viewer, P.FINANCE_DEPOSIT_APPROVE));
t('viewer ทุกสิทธิ์ลงท้าย .view', [...effectivePermissions(viewer)].every(p => p.endsWith('.view')));

/* ================================================================ */
sect('4. ★ ปิดสิทธิ์รายคน (revoked ชนะ role)');
const staffNoApprove = S('staff', [], [P.FINANCE_DEPOSIT_APPROVE]);
t('staff ปกติอนุมัติได้', can(staff, P.FINANCE_DEPOSIT_APPROVE));
t('★ ปิดแล้วอนุมัติไม่ได้', !can(staffNoApprove, P.FINANCE_DEPOSIT_APPROVE));
t('สิทธิ์อื่นยังอยู่', can(staffNoApprove, P.MEMBER_VIEW));
t('นับจำนวนลดลง 1', effectivePermissions(staffNoApprove).size === effectivePermissions(staff).size - 1);

const adminMuted = S('admin', [], [P.MEMBER_DELETE, P.MEMBER_CREDIT_ADD, P.TICKET_CANCEL]);
t('★ ปิด 3 สิทธิ์จาก admin', !can(adminMuted, P.MEMBER_DELETE) && !can(adminMuted, P.MEMBER_CREDIT_ADD) && !can(adminMuted, P.TICKET_CANCEL));
t('admin ที่ถูกปิดยังดูรายงานได้', can(adminMuted, P.REPORT_VIEW));

/* ================================================================ */
sect('5. ให้สิทธิ์เพิ่มรายคน (grantedExtra)');
const viewerPlus = S('viewer', [P.MEMBER_CREDIT_ADD]);
t('viewer ปกติเพิ่มเครดิตไม่ได้', !can(viewer, P.MEMBER_CREDIT_ADD));
t('ให้เพิ่มแล้วทำได้', can(viewerPlus, P.MEMBER_CREDIT_ADD));
t('ยังทำอย่างอื่นไม่ได้', !can(viewerPlus, P.MEMBER_DELETE));

/* ================================================================ */
sect('6. owner/master ไม่ถูกล็อกด้วย override (locked role)');
const ownerRevoked = S('owner', [], [P.MEMBER_DELETE, P.STAFF_SET_PERMISSION]);
t('owner ยังได้ทุกสิทธิ์แม้มี revoked', effectivePermissions(ownerRevoked).size === ALL_PERMISSIONS.length);
t('owner ลบสมาชิกได้อยู่', can(ownerRevoked, P.MEMBER_DELETE));

/* ================================================================ */
sect('7. canAny / canAll');
t('canAny ถูก (มี 1)', canAny(staff, [P.MEMBER_DELETE, P.MEMBER_VIEW]));
t('canAny ผิด (ไม่มีเลย)', !canAny(viewer, [P.MEMBER_DELETE, P.MEMBER_CREDIT_ADD]));
t('canAll ถูก', canAll(admin, [P.MEMBER_VIEW, P.FINANCE_VIEW]));
t('canAll ผิด (ขาด 1)', !canAll(staff, [P.MEMBER_VIEW, P.MEMBER_DELETE]));

/* ================================================================ */
sect('8. นับสิทธิ์ + สรุปตามหมวด');
const c = countPermissions(staff);
t('countPermissions.total = ทั้งหมด', c.total === ALL_PERMISSIONS.length);
t('countPermissions.granted = ตาม role', c.granted === ROLES.staff.perms.length);
const c2 = countPermissions(S('staff', [P.API_VIEW], [P.MEMBER_VIEW]));
t('granted หัก revoked ถูก', c2.granted === ROLES.staff.perms.length + 1 - 1);
t('revoked = 1', c2.revoked === 1);

const sum = permissionSummary(agent);
t('permissionSummary คืน 16 หมวด', sum.length === 16);
t('สรุปหมวด member ของ agent > 0', sum.find(s => s.key === 'member').granted > 0);
t('สรุปหมวดความปลอดภัยของ agent = 0', sum.find(s => s.key === 'security').granted === 0);

/* ================================================================ */
sect('9. ตำแหน่ง');
t('มี 6 ตำแหน่ง', ROLE_LIST.length === 6);
t('owner/master locked', ROLE_LIST.filter(r => r.locked).length === 2);
t('ทุกตำแหน่งมีสี', ROLE_LIST.every(r => /^#[0-9a-f]{6}$/i.test(r.color)));
t('ทุกตำแหน่งมีคำอธิบาย', ROLE_LIST.every(r => r.desc && r.desc.length > 5));
t('owner มีสิทธิ์มากกว่า viewer', ROLES.owner.perms.length > ROLES.viewer.perms.length);
t('ลำดับสิทธิ์ owner > admin > staff', ROLES.owner.perms.length > ROLES.admin.perms.length && ROLES.admin.perms.length > ROLES.staff.perms.length);

/* ================================================================ */
sect('10. ความสอดคล้องข้ามกลุ่ม');
const allHaveLabel = PERMISSION_GROUPS.every(g => g.perms.every(p => p.label && p.label.length > 0));
t('ทุกสิทธิ์มีป้ายชื่อไทย', allHaveLabel);
const risks = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.risk));
t('ทุกสิทธิ์มีระดับความเสี่ยง', risks.every(r => ['low','medium','high','critical'].includes(r)));
t('มีสิทธิ์อันตราย (critical) อย่างน้อย 10', risks.filter(r => r === 'critical').length >= 10,
  `ได้ ${risks.filter(r => r === 'critical').length}`);
const fin = PERMISSION_GROUPS.find(g => g.key === 'finance').perms.filter(p => p.risk === 'critical');
t('สิทธิ์การเงินมี critical ≥ 4', fin.length >= 4, `ได้ ${fin.length}`);

/* ================================================================ */
console.log(`\n${'='.repeat(50)}`);
console.log(`  ผ่าน ${pass}  |  ไม่ผ่าน ${fail}  |  รวม ${pass + fail}`);
console.log('='.repeat(50));
process.exit(fail > 0 ? 1 : 0);
