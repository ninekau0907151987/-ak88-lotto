/**
 * __test_db.mjs — ทดสอบชั้นฐานข้อมูล + seed + คู่มือ
 * รัน: npx tsx __test_db.mjs
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';

const { initializeApp } = await import('firebase/app');
const { getFirestore, connectFirestoreEmulator, terminate } = await import('firebase/firestore');
const app = initializeApp({ projectId: 'demo-ak88', apiKey: 'f' }, 'dbtest');
const DB = getFirestore(app);
connectFirestoreEmulator(DB, '127.0.0.1', 8085);

const {
  createRepositories, createRepo, stripUndefined, sanitize, prepare,
  seedOnce, seedMany, checkDbHealth,
} = await import('./server/lib/db.ts');
const { COL, FIELD } = await import('./server/config/collections.ts');
const { getAccessTable, ALL_PAGES, MANUAL_SECTIONS, TROUBLESHOOTING, ADMIN_FAQ, manualStats } = await import('./src/shared/lib/backofficeManual.ts');
const { ALL_PERMISSIONS, ROLE_LIST, ROLES } = await import('./src/shared/lib/permissions.ts');

let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}  ${e}`); } };
const eq = (a, b, n) => t(n, a === b, `ได้ ${JSON.stringify(a)} คาด ${JSON.stringify(b)}`);
const sect = n => console.log(`\n── ${n} ──`);

/* ================================================================ */
sect('1. ★ stripUndefined — ทำให้ "เอาลงข้อมูลได้ง่าย"');
{
  eq(JSON.stringify(stripUndefined({ a: 1, b: undefined })), '{"a":1}', 'ลบ undefined ชั้นบน');
  eq(JSON.stringify(stripUndefined({ a: { b: undefined, c: 2 } })), '{"a":{"c":2}}', '★ ลบ undefined ชั้นซ้อน');
  eq(JSON.stringify(stripUndefined({ a: [1, undefined, 3] })), '{"a":[1,null,3]}', '★ array: undefined → null');
  eq(JSON.stringify(stripUndefined({ a: null, b: 0, c: '', d: false })),
     '{"a":null,"b":0,"c":"","d":false}', '★ เก็บ null/0/""/false ไว้ (ไม่ใช่ undefined)');
  const d = new Date();
  t('เก็บ Date ไว้เป็น Date', stripUndefined({ d }).d instanceof Date);
}

/* ================================================================ */
sect('2. ★ sanitize — แปลงค่าไม่Valid');
{
  eq(sanitize(NaN), null, 'NaN → null');
  eq(sanitize(Infinity), null, 'Infinity → null');
  eq(sanitize(-Infinity), null, '-Infinity → null');
  eq(sanitize(42), 42, 'เลขปกติผ่าน');
  eq(sanitize('สวัสดี'), 'สวัสดี', 'string ผ่าน');
  const long = 'x'.repeat(1_000_000);
  t('string ยาวเกิน → ตัด', sanitize(long).length === 900_000, `${sanitize(long).length}`);
}

/* ================================================================ */
sect('3. ★ prepare — เตรียมข้อมูลก่อนเขียน');
{
  const create = prepare({ name: 'ทดสอบ', empty: undefined }, { actor: 'tester' }, 'create');
  t('★ ลบ undefined', !('empty' in create));
  t('★ ใส่ createdAt', !!create.createdAt);
  t('★ ใส่ createdBy', create.createdBy === 'tester');
  t('★ ใส่ updatedAt', !!create.updatedAt);

  const update = prepare({ name: 'ใหม่' }, { actor: 't2' }, 'update');
  t('update: ไม่ทับ createdAt', !('createdAt' in update));
  t('update: ใส่ updatedBy', update.updatedBy === 't2');

  const noTs = prepare({ a: 1 }, { timestamps: false });
  t('ปิด timestamp ได้', !('createdAt' in noTs) && !('updatedAt' in noTs));
}

/* ================================================================ */
sect('4. ★ COL — แหล่งความจริงเดียว');
{
  const cols = Object.keys(COL);
  t(`มี collection ทั้งหมด ${cols.length}`, cols.length >= 20, `${cols.length}`);
  t('★ มี game20 ครบ 5', !!COL.GAME20_ROUNDS && !!COL.GAME20_CONFIG &&
    !!COL.GAME20_HISTORY && !!COL.GAME20_CODES && !!COL.GAME20_BOTLOGS);
  t('★ มี STAFF + ADMIN_LOGS + MANUALS', !!COL.STAFF && !!COL.ADMIN_LOGS && !!COL.MANUALS);
  const vals = Object.values(COL);
  eq(new Set(vals).size, vals.length, '★ ไม่มีชื่อ collection ซ้ำกัน');
  t('FIELD มีของ game20', !!FIELD.SLOTS && !!FIELD.RESULT && !!FIELD.RESULT_MODE);
  console.log(`     collections: ${cols.join(', ')}`);
}

/* ================================================================ */
sect('5. ★ Repository — insert/get/update/remove');
{
  const repo = createRepo(DB, 'dbtest_items');

  // insert
  const id1 = await repo.insert({ name: 'ชิ้นที่ 1', amount: 100, note: undefined, actor: 'a1' },
    { actor: 'a1' });
  t('★ insert ได้ id', !!id1, id1);

  // get
  const got = await repo.get(id1);
  eq(got.name, 'ชิ้นที่ 1', '★ get อ่านได้');
  eq(got.amount, 100, 'อ่านค่าได้');
  t('★ ไม่มี field undefined', !('note' in got));
  t('★ มี createdAt อัตโนมัติ', !!got.createdAt);

  // exists
  eq(await repo.exists(id1), true, '★ exists = true');
  eq(await repo.exists('ไม่มีจริง'), false, 'exists = false');

  // set ด้วย id เอง
  await repo.set('fixed-1', { name: 'ตั้ง id เอง' });
  const fx = await repo.get('fixed-1');
  eq(fx.name, 'ตั้ง id เอง', '★ set ด้วย id เอง');

  // update
  await repo.update(id1, { amount: 500 });
  const up = await repo.get(id1);
  eq(up.amount, 500, '★ update แก้ค่าได้');
  eq(up.name, 'ชิ้นที่ 1', 'update ไม่ลบ field อื่น');

  // insertMany
  const n = await repo.insertMany([
    { id: 'm1', name: 'หมู่ 1' },
    { id: 'm2', name: 'หมู่ 2' },
    { id: 'm3', name: 'หมู่ 3' },
  ]);
  eq(n, 3, '★ insertMany ได้ 3');

  // count / all
  t('★ count ทำงาน', (await repo.count()) >= 5, `${await repo.count()}`);
  t('★ all ทำงาน', (await repo.all()).length >= 5);

  // find with where
  const found = await repo.find({ where: [['name', '==', 'หมู่ 2']] });
  eq(found.length, 1, '★ find + where');
  eq(found[0].id, 'm2', 'เจอตัวถูก');

  // find + orderBy + limit
  const ordered = await repo.find({ orderBy: [['name', 'asc']], limit: 2 });
  eq(ordered.length, 2, '★ find + limit');

  // findOne
  const one = await repo.findOne({ where: [['id_kind', '==', 'nope']] });
  eq(one, null, 'findOne ไม่เจอ → null');

  // findOne เจอ
  const one2 = await repo.findOne({ where: [['name', '==', 'หมู่ 3']] });
  t('findOne เจอ', one2 && one2.id === 'm3');

  // remove
  await repo.remove(id1);
  eq(await repo.exists(id1), false, '★ remove ลบได้');
  eq(await repo.get(id1), null, 'ลบแล้ว get → null');

  // clear
  const cleared = await repo.clear();
  t(`★ clear ลบทั้งหมด (${cleared})`, cleared >= 4, `${cleared}`);
  eq(await repo.count(), 0, 'clear แล้วว่าง');
}

/* ================================================================ */
sect('6. ★ seedOnce — ลงข้อมูลไม่ทับของเดิม');
{
  const repo = createRepo(DB, 'dbtest_seed');
  const r1 = await seedOnce(repo, 'cfg', { v: 1 });
  eq(r1.created, true, '★ ครั้งแรก: สร้างใหม่');
  const r2 = await seedOnce(repo, 'cfg', { v: 999 });
  eq(r2.created, false, '★ ครั้งที่สอง: ข้าม');
  eq((await repo.get('cfg')).v, 1, '★ ของเดิมไม่ถูกทับ');

  const r3 = await seedOnce(repo, 'cfg', { v: 999 }, { overwrite: true });
  eq(r3.created, true, '★ overwrite: เขียนทับได้');
  eq((await repo.get('cfg')).v, 999, 'ค่าถูกทับแล้ว');

  const many = await seedMany(repo, [
    { id: 'a', data: { n: 1 } }, { id: 'b', data: { n: 2 } },
  ]);
  eq(many.inserted, 2, '★ seedMany สร้าง 2');
  eq(many.errors.length, 0, 'ไม่มี error');
  await repo.clear();
}

/* ================================================================ */
sect('7. ★ createRepositories — ได้ครบทุก collection');
{
  const repos = createRepositories(DB);
  t('★ ได้ repo ครบทุก COL', Object.keys(COL).every(k => !!repos[k]), 
    `ขาด: ${Object.keys(COL).filter(k => !repos[k]).join(',')}`);
  t('★ มี alias "rounds"', !!repos.rounds);
  t('★ มี alias "history"', !!repos.history);
  t('★ มี alias "codes"', !!repos.codes);
  t('★ มี alias "staff"', !!repos.staff);
  // ★ alias ต้องชี้ตัวเดียวกับ COL
  eq(repos.rounds.name, COL.GAME20_ROUNDS, 'rounds ชี้ถูก collection');
  eq(repos.history.name, COL.GAME20_HISTORY, 'history ชี้ถูก');
  console.log(`     repo: ${Object.keys(repos).length} ตัว`);
}

/* ================================================================ */
sect('8. ★ checkDbHealth — ตรวจสุขภาพ');
{
  const h = await checkDbHealth(DB);
  eq(h.ok, true, '★ ฐานข้อมูลพร้อมใช้งาน');
  eq(h.canWrite, true, '★ เขียนได้');
  eq(h.canRead, true, '★ อ่านได้');
  t('มีรายการ collection', h.collections.length >= 20);
  t('มี counts', Object.keys(h.counts).length >= 5);
  t('มี checkedAt', !!h.checkedAt);
  console.log(`     counts: ${Object.entries(h.counts).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  if (h.problems.length) {
    h.problems.forEach(p => console.log(`     ${p.severity === 'error' ? '🔴' : '🟡'} ${p.message}`));
  }
}
{
  const h = await checkDbHealth(null);
  eq(h.ok, false, '★ ไม่มี Firestore → ok=false');
  t('★ แจ้งวิธีแก้', h.problems[0].fix.length > 5, h.problems[0].fix);
}

/* ================================================================ */
sect('9. ★ ตารางรหัสผ่าน + ทางเข้า');
{
  const acc = getAccessTable();
  eq(acc.length, 6, '★ 6 ตำแหน่ง');
  t('ทุกแถวมี path', acc.every(a => a.path.startsWith('/')));
  t('ทุกแถวมี username', acc.every(a => a.username.length >= 3));
  t('★ ทุกแถวมีรหัสผ่านเริ่มต้น', acc.every(a => a.defaultPassword.length >= 6),
    acc.map(a => `${a.username}:${a.defaultPassword.length}`).join(' '));
  t('★ ทุกรหัสต้องเปลี่ยน', acc.every(a => a.mustChange));
  t('ทุกแถวมี permCount', acc.every(a => typeof a.permCount === 'number'));
  t('ทุกแถวมี can[]', acc.every(a => Array.isArray(a.can) && a.can.length > 0));

  // ★ permCount ต้องตรงกับ permissions.ts จริง
  acc.forEach(a => {
    const r = ROLES[a.role];
    const expect = Array.isArray(r.perms) ? r.perms.length : ALL_PERMISSIONS.length;
    t(`★ ${a.username} (${a.role}) = ${a.permCount} สิทธิ์ ตรงกับ ROLES`, a.permCount === expect,
      `ได้ ${a.permCount} คาด ${expect}`);
  });

  console.log('     ตารางรหัสผ่าน:');
  acc.forEach(a => console.log(`       ${a.name.padEnd(14)} ${a.path.padEnd(26)} ${a.username.padEnd(9)} ${a.defaultPassword}  (${a.permCount} สิทธิ์)`));
}
{
  t('★ มีหน้าทั้งหมด', ALL_PAGES.length >= 8, `${ALL_PAGES.length}`);
  t('ทุกหน้ามี path', ALL_PAGES.every(p => p.path.startsWith('/')));
  t('ทุกหน้ามีชื่อ+คำอธิบาย', ALL_PAGES.every(p => p.name && p.desc));
  t('★ มีหน้า game20', ALL_PAGES.some(p => p.path === '/admin/game20'));
  t('★ มีหน้าคู่มือ', ALL_PAGES.some(p => p.path === '/admin/manual'));
}

/* ================================================================ */
sect('10. ★ คู่มือ — ครบทุกฟังก์ชัน');
{
  t(`มี ${MANUAL_SECTIONS.length} หมวด`, MANUAL_SECTIONS.length >= 12, `${MANUAL_SECTIONS.length}`);
  t('ทุกหมวดมี icon', MANUAL_SECTIONS.every(s => !!s.icon));
  t('ทุกหมวดมี purpose', MANUAL_SECTIONS.every(s => s.purpose.length > 10));
  t('★ ทุกหมวดมีขั้นตอน', MANUAL_SECTIONS.every(s => s.steps.length >= 3),
    MANUAL_SECTIONS.filter(s => s.steps.length < 3).map(s => s.title).join(','));
  t('ทุกหมวดมี where', MANUAL_SECTIONS.every(s => s.where.length > 2));
  t('id ไม่ซ้ำ', new Set(MANUAL_SECTIONS.map(s => s.id)).size === MANUAL_SECTIONS.length);

  // ★ permission ที่อ้างอิงต้องมีจริง
  const refs = MANUAL_SECTIONS.map(s => s.permission).filter(Boolean);
  const bad = refs.filter(r => !ALL_PERMISSIONS.includes(r));
  eq(bad.length, 0, '★ permission ที่อ้างอิงมีอยู่จริงทั้งหมด', bad.join(','));

  // ★ ต้องครอบคลุมหัวข้อสำคัญ
  const need = ['บอทออกผล', 'บอทวางเลข', 'อัตราจ่าย', 'ประวัติ', 'แก้ไขผล', 'รหัส', 'พนักงาน', 'API', 'ฐานข้อมูล'];
  need.forEach(k => t(`★ ครอบคลุม "${k}"`, MANUAL_SECTIONS.some(s => s.title.includes(k)), 
    MANUAL_SECTIONS.map(s => s.title).join(' | ')));

  console.log('     หมวดทั้งหมด:');
  MANUAL_SECTIONS.forEach((s, i) => console.log(`       ${String(i + 1).padStart(2)}. ${s.icon} ${s.title}${s.permission ? `  [${s.permission}]` : ''}`));
}

/* ================================================================ */
sect('11. ★ แก้ปัญหา + FAQ');
{
  t(`มี ${TROUBLESHOOTING.length} อาการ`, TROUBLESHOOTING.length >= 8);
  t('ทุกอาการมีสาเหตุ+วิธีแก้', TROUBLESHOOTING.every(x => x.cause.length > 10 && x.fix.length > 5));
  t('ทุกระดับถูกต้อง', TROUBLESHOOTING.every(x => ['error', 'warn', 'info'].includes(x.severity)));
  t('★ มีอาการ PERMISSION_DENIED', TROUBLESHOOTING.some(x => x.symptom.includes('PERMISSION_DENIED')));
  t('★ มีอาการ undefined', TROUBLESHOOTING.some(x => x.symptom.includes('undefined')));
  console.log(`     ระดับ: error ${TROUBLESHOOTING.filter(x=>x.severity==='error').length} • warn ${TROUBLESHOOTING.filter(x=>x.severity==='warn').length} • info ${TROUBLESHOOTING.filter(x=>x.severity==='info').length}`);
}
{
  t(`มี ${ADMIN_FAQ.length} คำถาม`, ADMIN_FAQ.length >= 8);
  t('ทุกคำถามมีคำตอบ', ADMIN_FAQ.every(f => f.q.length > 5 && f.a.length > 20));
  t('★ มีคำถามเรื่องรหัสผ่าน', ADMIN_FAQ.some(f => f.q.includes('รหัสผ่าน')));
  t('★ มีคำถามเรื่องฐานข้อมูล', ADMIN_FAQ.some(f => f.q.includes('ข้อมูล')));
}

/* ================================================================ */
sect('12. manualStats');
{
  const s = manualStats();
  eq(s.sections, MANUAL_SECTIONS.length, 'sections ตรง');
  eq(s.totalPermissions, ALL_PERMISSIONS.length, '★ totalPermissions ตรง');
  eq(s.roles, ROLE_LIST.length, 'roles ตรง');
  eq(s.faq, ADMIN_FAQ.length, 'faq ตรง');
  eq(s.troubleshooting, TROUBLESHOOTING.length, 'troubleshooting ตรง');
  console.log(`     ${s.sections} หมวด • ${s.totalPermissions} สิทธิ์ • ${s.roles} ตำแหน่ง • ${s.pages} หน้า • ${s.faq} คำถาม`);
}

/* ================================================================ */
console.log(`\n${'='.repeat(56)}`);
console.log(`  ผ่าน ${pass}  |  ไม่ผ่าน ${fail}  |  รวม ${pass + fail}`);
console.log('='.repeat(56));

try { await terminate(DB); } catch {}
process.exit(fail > 0 ? 1 : 0);
