/**
 * __test_routes.mjs — ทดสอบว่า "ทุกปุ่มไปถูกหน้า" จริง
 * ใช้ matchRoutes ของ react-router จริง (ไม่เดา)
 * รัน: npx tsx __test_routes.mjs
 */
import { matchRoutes } from 'react-router-dom';

// ★ คัดลอกเส้นจาก src/App.tsx มาตรง ๆ (โครงสร้างเดียวกัน)
const routes = [
  { path: '/login', page: 'Login' },
  { path: '/register', page: 'Register' },
  { path: '/forgot-password', page: 'ForgotPassword' },
  { path: '/admin', page: 'AdminDashboard' },
  { path: '/admin/api', page: 'DeveloperApi' },
  { path: '/admin/api/docs', page: 'ApiDocs' },
  { path: '/master', page: 'MasterDashboard' },
  { path: '/master/agent-profile', page: 'AgentProfile' },
  { path: '/admin/game20', page: 'Game20Admin' },
  { path: '/admin/manual', page: 'BackofficeManual' },
  { path: '/admin/game20/report', page: 'Game20Report' },
  {
    path: '/', page: 'Layout',
    children: [
      { index: true, page: 'Home' },
      { path: 'lottery', page: 'LotteryList' },
      { path: 'lottery/set', page: 'LotterySetBet' },
      { path: 'lottery/set/:type', page: 'LotterySetBet' },
      { path: 'lottery/stock', page: 'StockLotteryList' },
      { path: 'lottery/stock/:type', page: 'LotteryBet' },
      { path: 'lottery/yeekee', page: 'YeekeeList' },
      { path: 'lottery/game20', page: 'Game20Bet' },
      { path: 'lottery/game20/rules', page: 'Game20Guide' },
      { path: 'game20/guide', page: 'Game20Guide' },
      { path: 'lottery/:type/rules', page: 'LotteryRules' },
      { path: 'lottery/:type', page: 'LotteryBet' },
      { path: 'deposit', page: 'Deposit' },
      { path: 'withdraw', page: 'Withdraw' },
      { path: 'history', page: 'History' },
      { path: 'financial-report', page: 'FinancialReport' },
      { path: 'results', page: 'LotteryResults' },
      { path: 'profile', page: 'Profile' },
      { path: 'tickets', page: 'LotteryTickets' },
      { path: 'number-set', page: 'NumberSetCreate' },
      { path: 'referral', page: 'Referral' },
      { path: 'contact', page: 'Contact' },
    ],
  },
];

// ---- คาดหวัง: URL → หน้าที่ต้องได้ ----
const EXPECT = [
  // Auth
  ['/login', 'Login'],
  ['/register', 'Register'],
  ['/forgot-password', 'ForgotPassword'],
  // หลังบ้าน
  ['/admin', 'AdminDashboard'],
  ['/admin/api', 'DeveloperApi'],
  ['/admin/api/docs', 'ApiDocs'],
  ['/master', 'MasterDashboard'],
  ['/master/agent-profile', 'AgentProfile'],
  ['/admin/game20', 'Game20Admin'],
  ['/admin/manual', 'BackofficeManual'],
  ['/admin/game20/report', 'Game20Report'],
  // หน้าบ้าน
  ['/', 'Home'],
  ['/lottery', 'LotteryList'],
  ['/lottery/set', 'LotterySetBet'],
  ['/lottery/set/hanoi', 'LotterySetBet'],
  ['/lottery/set/thai', 'LotterySetBet'],
  ['/lottery/stock', 'StockLotteryList'],
  ['/lottery/stock/thai', 'LotteryBet'],
  ['/lottery/yeekee', 'YeekeeList'],
  ['/lottery/game20', 'Game20Bet'],
  ['/lottery/game20/rules', 'Game20Guide'],
  ['/game20/guide', 'Game20Guide'],
  ['/lottery/hanoi/rules', 'LotteryRules'],
  ['/lottery/hanoi', 'LotteryBet'],
  ['/deposit', 'Deposit'],
  ['/withdraw', 'Withdraw'],
  ['/history', 'History'],
  ['/financial-report', 'FinancialReport'],
  ['/results', 'LotteryResults'],
  ['/profile', 'Profile'],
  ['/tickets', 'LotteryTickets'],
  ['/number-set', 'NumberSetCreate'],
  ['/referral', 'Referral'],
  ['/contact', 'Contact'],
];

let pass = 0, fail = 0;
const fails = [];

for (const [url, want] of EXPECT) {
  const m = matchRoutes(routes, url);
  let got = 'NOT_FOUND';
  if (m && m.length) {
    // เอาตัวสุดท้ายที่ไม่ใช่ Layout (index/leaf)
    const leaf = m[m.length - 1].route;
    got = leaf.page;
  }
  const ok = got === want;
  if (ok) { pass++; console.log(`  ✅ ${url.padEnd(26)} → ${got}`); }
  else { fail++; fails.push(`${url} → ได้ ${got} (ต้องได้ ${want})`); console.log(`  ❌ ${url.padEnd(26)} → ${got}   << ต้องได้ ${want}`); }
}

// ---- ทดสอบเส้นที่ต้อง "ไม่หลุด" ไปหน้าอื่น ----
console.log('\n=== ตรวจเส้นที่เคยชนกัน ===');
const CONFLICT = [
  ['/lottery/set', 'LotterySetBet', 'ต้องไม่กลายเป็น LotteryBet'],
  ['/lottery/game20', 'Game20Bet', 'ต้องไม่ถูก :type กลืน'],
  ['/lottery/stock', 'StockLotteryList', 'ต้องไม่ถูก :type กลืน'],
  ['/lottery/yeekee', 'YeekeeList', 'ต้องไม่ถูก :type กลืน'],
];
for (const [url, want, why] of CONFLICT) {
  const m = matchRoutes(routes, url);
  const got = m && m.length ? m[m.length - 1].route.page : 'NOT_FOUND';
  const ok = got === want;
  if (ok) { pass++; console.log(`  ✅ ${url.padEnd(22)} ${why}`); }
  else { fail++; fails.push(`${url}: ${why} — ได้ ${got}`); console.log(`  ❌ ${url.padEnd(22)} ได้ ${got} — ${why}`); }
}

// ---- นับจำนวนเส้นทั้งหมด ----
function count(rs) {
  let n = 0;
  for (const r of rs) { n++; if (r.children) n += count(r.children); }
  return n;
}
const total = count(routes);

console.log('\n' + '═'.repeat(50));
console.log(`เส้นทั้งหมดในระบบ : ${total} เส้น`);
console.log(`ผ่าน ${pass}  |  ไม่ผ่าน ${fail}`);
if (fails.length) { console.log('\n★ ที่ไม่ผ่าน:'); fails.forEach(f => console.log('   - ' + f)); }
else console.log('★★★ ทุกปุ่มไปถูกหน้าทั้งหมด ★★★');
console.log('═'.repeat(50));
process.exit(fail ? 1 : 0);
