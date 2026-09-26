/**
 * scripts/seed-game20.mjs
 * ------------------------------------------------------------------
 * ★ ลงข้อมูลตั้งต้นทั้งหมดด้วยคำสั่งเดียว ★
 *
 * ผู้ใช้ขอ: "วางดาต้าบส เป็นระบบ เอาลงข้อมูลได้ง่าย เรียกใช้ได้ง่าย"
 *
 * รัน:  npx tsx scripts/seed-game20.mjs
 *       npx tsx scripts/seed-game20.mjs --reset     (ลบของเดิมก่อน)
 *       npx tsx scripts/seed-game20.mjs --emulator  (ใช้ emulator)
 *
 * ★ รันซ้ำได้ปลอดภัย — มีอยู่แล้วจะข้าม (ยกเว้น --reset)
 * ==================================================================
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const USE_EMULATOR = args.includes('--emulator');

if (USE_EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085';
}

/* ================================================================
 * 1. อ่านค่าตั้งค่าจาก .env.local
 * ================================================================ */
function loadEnvLocal() {
  const p = resolve(ROOT, '.env.local');
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };

/* ================================================================
 * 2. ต่อ Firestore
 * ================================================================ */
const { initializeApp } = await import('firebase/app');
const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
const { createRepositories, seedMany, checkDbHealth, stripUndefined } = await import('../server/lib/db.ts');
const { COL } = await import('../server/config/collections.ts');

const projectId = env.VITE_FIREBASE_PROJECT_ID
  || env.FIREBASE_PROJECT_ID
  || (USE_EMULATOR ? 'demo-ak88' : null);

if (!projectId) {
  console.error('❌ ไม่พบ projectId — ตรวจไฟล์ .env.local (VITE_FIREBASE_PROJECT_ID)');
  process.exit(1);
}

const app = initializeApp({
  projectId,
  apiKey: env.VITE_FIREBASE_API_KEY || 'fake-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}, 'seed');

const db = getFirestore(app);
if (USE_EMULATOR) {
  connectFirestoreEmulator(db, '127.0.0.1', Number(process.env.FIRESTORE_EMULATOR_PORT || 8085));
}

const repo = createRepositories(db);

console.log('═'.repeat(62));
console.log('  ★ ลงข้อมูลตั้งต้น — หวย 20 ช่อง 6 หลัก');
console.log('═'.repeat(62));
console.log(`  project: ${projectId}${USE_EMULATOR ? '  (emulator)' : ''}`);
console.log(`  mode:    ${RESET ? 'ลบของเดิมแล้วลงใหม่' : 'ลงเพิ่ม (ข้ามที่มีอยู่)'}`);
console.log('');

/* ================================================================
 * 3. ข้อมูลตั้งต้น
 * ================================================================ */
const {
  DEFAULT_PAYOUT_RATES, DEFAULT_HOUSE_MARGIN,
} = await import('../src/shared/lib/lottery20.ts');
const { DEFAULT_RESULT_BOT, DEFAULT_NUMBER_BOT } = await import('../src/shared/lib/bots.ts');
const { PLAY_STEPS, GUIDE_RULES } = await import('../src/shared/lib/game20Guide.ts');
const { PERMISSIONS, ROLES, ROLE_LIST } = await import('../src/shared/lib/permissions.ts');

/* ---- 3.1 ค่าตั้งต้นโมดูลหวย 20 ช่อง ---- */
const game20Config = {
  enabled: true,
  displayName: 'หวย 20 ช่อง 6 หลัก',
  rules: {
    slotCount: GUIDE_RULES.slotCount,
    digitsPerSlot: GUIDE_RULES.digitsPerSlot,
    subtractPosition: GUIDE_RULES.subtractPosition,
    modulo: GUIDE_RULES.modulo,
    formula: GUIDE_RULES.formulaShort,
  },
  rates: DEFAULT_PAYOUT_RATES.map(r => ({
    key: r.key, label: r.label, rate: r.rate, desc: r.desc, odds: r.odds,
  })),
  minBetAmount: DEFAULT_HOUSE_MARGIN.minBetAmount,
  maxBetAmount: DEFAULT_HOUSE_MARGIN.maxBetAmount,
  maxBetPerNumber: DEFAULT_HOUSE_MARGIN.maxBetPerNumber,
  unitAmount: DEFAULT_HOUSE_MARGIN.unitAmount,
  maxPayoutPerRound: DEFAULT_HOUSE_MARGIN.maxPayoutPerRound,
  targetMarginPercent: DEFAULT_HOUSE_MARGIN.targetMarginPercent,
  resultBot: { ...DEFAULT_RESULT_BOT, enabled: false, mode: 'balance' },
  numberBot: { ...DEFAULT_NUMBER_BOT, enabled: false },
};

/* ---- 3.2 พนักงานหลังบ้าน 6 ตำแหน่ง ---- */
const STAFF_SEED = [
  { id: 'owner',   username: 'owner',   name: 'เจ้าของระบบ',   role: 'owner',   active: true, note: 'สิทธิ์เต็ม ห้ามลบ' },
  { id: 'master',  username: 'master',  name: 'มาสเตอร์',      role: 'master',  active: true, note: 'จัดการทุกระบบ' },
  { id: 'admin1',  username: 'admin1',  name: 'ผู้ดูแลระบบ',   role: 'admin',   active: true, note: 'งานประจำวัน' },
  { id: 'staff1',  username: 'staff1',  name: 'พนักงานขาย',    role: 'staff',   active: true, note: 'รับแทง/ดูยอด' },
  { id: 'agent1',  username: 'agent1',  name: 'เอเย่นต์',      role: 'agent',   active: true, note: 'ดูเฉพาะสายตัวเอง' },
  { id: 'viewer1', username: 'viewer1', name: 'ผู้ชมรายงาน',   role: 'viewer',  active: true, note: 'อ่านรายงานเท่านั้น' },
];

/* ---- 3.3 คู่มือหลังบ้าน (เก็บในฐานข้อมูล แก้ได้) ---- */
const MANUAL_SEED = [
  { id: 'guide', key: 'guide', title: 'คู่มือการตั้งค่าและใช้งานหลังบ้าน', version: 1 },
];

/* ================================================================
 * 4. ลงข้อมูล
 * ================================================================ */
const summary = [];

async function step(label, fn) {
  process.stdout.write(`  ${label.padEnd(38)}`);
  try {
    const r = await fn();
    console.log(`✅ ${typeof r === 'string' ? r : JSON.stringify(r)}`);
    summary.push({ label, ok: true, result: r });
  } catch (e) {
    console.log(`❌ ${e.message}`);
    summary.push({ label, ok: false, error: e.message });
  }
}

/* ---- ล้างข้อมูลเดิม (ถ้า --reset) ---- */
if (RESET) {
  await step('ล้างข้อมูลเดิม', async () => {
    const targets = [
      ['rounds', repo.GAME20_ROUNDS],
      ['history', repo.GAME20_HISTORY],
      ['codes', repo.GAME20_CODES],
      ['botLogs', repo.GAME20_BOTLOGS],
      ['staff', repo.STAFF],
    ];
    let total = 0;
    for (const [n, r] of targets) {
      const c = await r.clear();
      total += c;
      if (c) console.log(`\n      ลบ ${n}: ${c}`);
    }
    return `${total} เอกสาร`;
  });
}

/* ---- 1) ค่าตั้งต้นหวย 20 ช่อง ---- */
await step('ค่าตั้งต้นหวย 20 ช่อง', async () => {
  const exists = await repo.GAME20_CONFIG.exists('main');
  if (exists && !RESET) return 'มีอยู่แล้ว — ข้าม';
  await repo.GAME20_CONFIG.set('main', game20Config, { merge: true, actor: 'seed' });
  return `อัตราจ่าย ${game20Config.rates.length} ประเภท • บอทปิดเป็นค่าเริ่มต้น`;
});

/* ---- 2) พนักงาน ---- */
await step('พนักงานหลังบ้าน', async () => {
  const r = await seedMany(repo.STAFF, STAFF_SEED.map(s => ({ id: s.id, data: s })),
    { overwrite: RESET, actor: 'seed' });
  const byRole = {};
  STAFF_SEED.forEach(s => { byRole[s.role] = (byRole[s.role] || 0) + 1; });
  return `เพิ่ม ${r.inserted} • ข้าม ${r.skipped} • ตำแหน่ง ${ROLE_LIST.length}`;
});

/* ---- 3) คู่มือ ---- */
await step('คู่มือหลังบ้าน', async () => {
  const r = await seedMany(repo.MANUALS, MANUAL_SEED.map(m => ({ id: m.id, data: m })),
    { overwrite: RESET, actor: 'seed' });
  return `เพิ่ม ${r.inserted} • ข้าม ${r.skipped}`;
});

/* ---- 4) รหัสตัวอย่าง (ปิดไว้ ไม่ให้รบกวน) ---- */
await step('รหัสตัวอย่าง', async () => {
  const CAPS = await import('../src/shared/lib/game20History.ts');
  const samples = [
    { kind: 'result_lock', label: 'รหัสล็อกผล (ตัวอย่าง)', length: 6, maxUses: 0 },
    { kind: 'open_close',  label: 'รหัสเปิด/ปิดรอบ (ตัวอย่าง)', length: 6, maxUses: 0 },
  ];
  let created = 0;
  for (const s of samples) {
    const id = `sample_${s.kind}`;
    if (await repo.GAME20_CODES.exists(id) && !RESET) continue;
    const { code, entry } = CAPS.generateCode({ ...s, createdBy: 'seed' });
    await repo.GAME20_CODES.set(id, { ...entry, id, active: false, note: 'ตัวอย่าง — ปิดไว้ เปิดใช้เองถ้าต้องการ' },
      { merge: true, actor: 'seed' });
    created++;
    console.log(`\n      ${s.label}: ${code}  (ปิดไว้)`);
  }
  return created ? `สร้าง ${created} รหัส (ปิดไว้ — ดูค่าใน log ด้านบน)` : 'มีอยู่แล้ว — ข้าม';
});

/* ---- 5) รอบตัวอย่าง 1 รอบ (ให้หน้าประวัติมีข้อมูล) ---- */
await step('รอบตัวอย่าง', async () => {
  const id = 'sample_round_1';
  if (await repo.GAME20_ROUNDS.exists(id) && !RESET) return 'มีอยู่แล้ว — ข้าม';

  const { computeResult } = await import('../src/shared/lib/lottery20.ts');
  const { solveSlotsNatural } = await import('../src/shared/lib/lottery20.ts');
  const target = '123456';
  const slots = solveSlotsNatural(target, 20260926).slots;
  const c = computeResult(slots);

  await repo.GAME20_ROUNDS.set(id, {
    roundId: id,
    slots,
    result: c.result,
    resultFormatted: `${c.result.slice(0, 3)}-${c.result.slice(3)}`,
    prizes: c.prizes,
    mode: 'target',
    reason: 'รอบตัวอย่างจาก seed',
    seed: 20260926,
    verified: c.result === target,
    economics: { totalBet: 0, payout: 0, profit: 0, profitPercent: 0, winCount: 0, examined: 1 },
    bot: { resultBotEnabled: false, numberBotEnabled: false, numberBotNote: null, numberBotSwaps: [] },
    closedAt: new Date().toISOString(),
    closedBy: 'seed',
    isSample: true,
  }, { merge: true, actor: 'seed' });

  return `ผล ${c.result} • verified ${c.result === target}`;
});

/* ================================================================
 * 5. ตรวจสุขภาพ
 * ================================================================ */
console.log('');
const health = await checkDbHealth(db);

console.log('─'.repeat(62));
console.log('  จำนวนเอกสาร');
console.log('─'.repeat(62));
for (const [k, v] of Object.entries(health.counts)) {
  console.log(`  ${k.padEnd(20)} ${v < 0 ? 'อ่านไม่ได้' : v + ' เอกสาร'}`);
}

console.log('');
if (health.problems.length) {
  console.log('─'.repeat(62));
  console.log('  ปัญหาที่พบ');
  console.log('─'.repeat(62));
  for (const p of health.problems) {
    console.log(`  ${p.severity === 'error' ? '🔴' : '🟡'} ${p.message}`);
    if (p.fix) console.log(`     → ${p.fix}`);
  }
  console.log('');
}

const failed = summary.filter(s => !s.ok);
console.log('═'.repeat(62));
console.log(`  ${health.ok ? '✅ ฐานข้อมูลพร้อมใช้งาน' : '❌ ฐานข้อมูลยังมีปัญหา'}`);
console.log(`  ขั้นตอนสำเร็จ ${summary.length - failed.length}/${summary.length}`);
console.log('═'.repeat(62));

if (!health.ok) {
  console.log('');
  console.log('  ★ วิธีแก้:');
  console.log('    1. deploy rules:  npx firebase deploy --only firestore:rules');
  console.log('    2. ตรวจ .env.local ว่ามี VITE_FIREBASE_PROJECT_ID + API KEY');
  console.log('    3. ลองกับ emulator: npx tsx scripts/seed-game20.mjs --emulator');
  console.log('');
}

try { const { terminate } = await import('firebase/firestore'); await terminate(db); } catch {}
process.exit(failed.length > 0 || !health.ok ? 1 : 0);
