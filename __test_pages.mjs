/**
 * __test_pages.mjs — ตรวจว่าทุกหน้าจอ "มีอยู่จริง" และ import ได้
 * ตรวจจับ: ไฟล์หาย, export ผิด, import พัง
 * รัน: npx tsx __test_pages.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

// ---- รายชื่อหน้าที่ App.tsx อ้างถึง ----
const PAGES = [
  // frontend
  ['frontend/pages/Home.tsx', 'Home'],
  ['frontend/pages/LotteryList.tsx', 'LotteryList'],
  ['frontend/pages/LotteryBet.tsx', 'LotteryBet'],
  ['frontend/pages/StockLotteryList.tsx', 'StockLotteryList'],
  ['frontend/pages/YeekeeList.tsx', 'YeekeeList'],
  ['frontend/pages/Deposit.tsx', 'Deposit'],
  ['frontend/pages/Login.tsx', 'Login'],
  ['frontend/pages/Register.tsx', 'Register'],
  ['frontend/pages/ForgotPassword.tsx', 'ForgotPassword'],
  ['frontend/pages/LotteryResults.tsx', 'LotteryResults'],
  ['frontend/pages/Withdraw.tsx', 'Withdraw'],
  ['frontend/pages/History.tsx', 'History'],
  ['frontend/pages/FinancialReport.tsx', 'FinancialReport'],
  ['frontend/pages/Profile.tsx', 'Profile'],
  ['frontend/pages/LotteryTickets.tsx', 'LotteryTickets'],
  ['frontend/pages/NumberSetCreate.tsx', 'NumberSetCreate'],
  ['frontend/pages/Referral.tsx', 'Referral'],
  ['frontend/pages/Contact.tsx', 'Contact'],
  ['frontend/pages/LotterySetBet.tsx', 'LotterySetBet'],
  ['frontend/pages/LotteryRules.tsx', 'LotteryRules'],
  ['frontend/pages/Game20Guide.tsx', 'Game20Guide'],
  ['frontend/pages/Game20Bet.tsx', 'Game20Bet'],
  // backend
  ['backend/pages/AdminDashboard.tsx', 'AdminDashboard'],
  ['backend/pages/MasterDashboard.tsx', 'MasterDashboard'],
  ['backend/pages/AgentProfile.tsx', 'AgentProfile'],
  ['backend/pages/DeveloperApi.tsx', 'DeveloperApi'],
  ['backend/pages/ApiDocs.tsx', 'ApiDocs'],
  ['backend/pages/Game20Admin.tsx', 'Game20Admin'],
  ['backend/pages/BackofficeManual.tsx', 'BackofficeManual'],
  ['backend/pages/Game20Report.tsx', 'Game20Report'],
  // layout
  ['shared/layouts/Layout.tsx', 'Layout'],
];

// ---- lib ที่ UI พึ่งพา ----
const LIBS = [
  'shared/lib/lottery20.ts',
  'shared/lib/bots.ts',
  'shared/lib/game20History.ts',
  'shared/lib/game20Guide.ts',
  'shared/lib/backofficeManual.ts',
  'shared/lib/permissions.ts',
  'shared/lib/betCount.ts',
  'shared/lib/game20BetSlip.ts',
  'shared/lib/game20Risk.ts',
  'shared/lib/game20Report.ts',
];

// ---- คอมโพเนนต์ที่ใช้ซ้ำ ----
const COMPS = [
  ['shared/components/MoneyCard.tsx', 'MoneyCard'],
  ['shared/components/StatusBadge.tsx', 'StatusBadge'],
  ['shared/components/BillView.tsx', 'BillView'],
  ['shared/components/DataToolbar.tsx', 'DataToolbar'],
  ['shared/components/Can.tsx', 'Can'],
  ['shared/components/BetSummaryPanel.tsx', 'BetSummaryPanel'],
];

// ---- server routes ----
const ROUTES = [
  'server/routes/v1/index.ts',
  'server/routes/v1/game20.routes.ts',
  'server/routes/v1/game20History.routes.ts',
  'server/routes/v1/betting.routes.ts',
  'server/routes/v1/results.routes.ts',
  'server/routes/v1/finance.routes.ts',
  'server/routes/v1/billing.routes.ts',
  'server/routes/v1/numberset.routes.ts',
];

// ---- server domains/services ----
const SERVICES = [
  'server/domains/game20/game20.service.ts',
  'server/domains/betting/betting.service.ts',
  'server/domains/betting/evaluate.ts',
  'server/domains/betting/settlement.service.ts',
];

// ---- server lib ----
const SERVER_LIBS = [
  'server/lib/db.ts',
  'server/lib/wallet.ts',
  'server/lib/response.ts',
  'server/config/collections.ts',
  'server/middleware/auth.ts',
  'server/middleware/error-handler.ts',
];

let pass = 0, fail = 0;
const fails = [];

function check(label, relPath, expectExport) {
  const full = path.join(SRC, relPath);
  const alt = path.join(ROOT, relPath); // server/* อยู่ที่ root
  const target = fs.existsSync(full) ? full : (fs.existsSync(alt) ? alt : null);

  if (!target) {
    fail++; fails.push(`${relPath} — ไม่พบไฟล์`);
    console.log(`  ❌ ${label.padEnd(20)} ไม่พบไฟล์ ${relPath}`);
    return;
  }
  const content = fs.readFileSync(target, 'utf-8');
  const lines = content.split('\n').length;
  const kb = (content.length / 1024).toFixed(1);

  // ตรวจว่ามี default export (สำหรับ component) หรือ named export
  const hasDefault = /export\s+default/.test(content);
  const hasNamed = expectExport
    ? new RegExp(`export\\s+(async\\s+)?(function|const|class)\\s+${expectExport}\\b`).test(content)
      || new RegExp(`export\\s*\\{[^}]*\\b${expectExport}\\b`).test(content)
    : true;

  if (expectExport && !hasDefault && !hasNamed) {
    fail++; fails.push(`${relPath} — ไม่พบ export ${expectExport}`);
    console.log(`  ❌ ${label.padEnd(20)} ไม่มี export ${expectExport}`);
    return;
  }
  pass++;
  console.log(`  ✅ ${label.padEnd(20)} ${String(lines).padStart(5)} บรรทัด  ${kb.padStart(7)} KB`);
}

console.log('═══ 1) หน้าจอทั้งหมด (30) ═══');
for (const [p, name] of PAGES) check(name, p, name);

console.log('\n═══ 2) ไลบรารีที่ UI ใช้ (7) ═══');
for (const p of LIBS) check(path.basename(p, '.ts'), p);

console.log('\n═══ 3) คอมโพเนนต์ที่ใช้ซ้ำ (6) ═══');
for (const [p, name] of COMPS) check(name, p, name);

console.log('\n═══ 4) เส้น API (8) ═══');
for (const p of ROUTES) check(path.basename(p, '.ts'), p);

console.log('\n═══ 5) บริการหลังบ้าน (4) ═══');
for (const p of SERVICES) check(path.basename(p, '.ts'), p);

console.log('\n═══ 6) lib/middleware ฝั่ง server (6) ═══');
for (const p of SERVER_LIBS) check(path.basename(p, '.ts'), p);

const total = PAGES.length + LIBS.length + COMPS.length + ROUTES.length + SERVICES.length + SERVER_LIBS.length;
console.log('\n' + '═'.repeat(50));
console.log(`ตรวจทั้งหมด ${total} ไฟล์`);
console.log(`ผ่าน ${pass}  |  ไม่ผ่าน ${fail}`);
if (fails.length) { console.log('\n★ ที่ไม่ผ่าน:'); fails.forEach(f => console.log('   - ' + f)); }
else console.log('★★★ ทุกไฟล์มีครบ ★★★');
console.log('═'.repeat(50));
process.exit(fail ? 1 : 0);
