/**
 * server/routes/v1/index.ts
 * ------------------------------------------------------------------
 * ★ ศูนย์รวมเส้น API v1 — แยกหมวด Public (ไม่ต้องใช้ Key) กับ Admin (ต้องใช้ Key) เด็ดขาด ★
 *
 * โครงสร้าง Gateways หลัก:
 *   1. /api/v1/public/*   — เส้นสาธารณะและสมาชิก (แทงลง, ดูรายการหวย, ผลรางวัล, สลิป, ยี่กี, OTP)
 *   2. /api/v1/admin/*    — เส้นหลังบ้าน (ต้องมี Key/Staff Session: ดูยอด Live Intake, รันรอบ, ตัดสินผล, คิว, รายงาน)
 *   3. /api/v1/health     — ตรวจสุขภาพระบบ และ แผนที่ Gateways ทั้งหมด
 *   4. Direct Aliases     — รองรับความเข้ากันได้ย้อนหลัง (Backward Compatibility)
 */
import { Router } from 'express';
import { createAuthMiddleware, requireScope } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error-handler';
import { ok } from '../../lib/response';
import { getSupabase, isServerSupabaseConfigured } from '../../lib/supabase';

// ---- Gateways หลัก ----
import { createPublicRouter } from './public.routes';
import { createAdminRouter } from './admin.routes';

// ---- โมดูลสำหรับ Direct / Legacy Aliases ----
import { monitorRoutes } from './monitor.routes';
import { queueRoutes } from './queue.routes';
import { billingRoutes } from './billing.routes';
import { numberSetRoutes } from './numberset.routes';
import { game20Routes } from './game20.routes';
import { game20HistoryRoutes } from './game20History.routes';
import { createYeekeeRouter } from './yeekee.routes';

// ---- เส้นธุรกิจหลัก ----
import { systemRoutes } from '../system';
import { lotteryRoutes, lotteryRoundRoutes, blockedNumberRoutes } from '../lottery';
import { bettingRoutes } from './betting.routes';
import { resultRoutes } from './results.routes';
import { financeRoutes } from './finance.routes';
import { reportRoutes } from '../reports';
import { userRoutes, agentRoutes, apiKeyRoutes } from '../users';

/** แผนที่โครงสร้าง Gateways สำหรับมอนิเตอร์และตอบผ่าน /health */
export const GATEWAYS = {
  public: {
    prefix: '/api/v1/public',
    authRequired: false,
    description: 'เส้นสาธารณะและสมาชิก (ไม่ต้องใช้ Key): แทงลง, ดูรายการหวย, รอบ, เลขอั้น, ผลรางวัล, สลิปฝาก/ถอน, ยี่กี, OTP',
    endpoints: [
      { path: '/public/betting', desc: 'แทงลง / โพยหวย (preview, bet, tickets, summary, cancel)' },
      { path: '/public/lottery', desc: 'ข้อมูลหวย & อัตราต้านทาน (types, resistance, calculate)' },
      { path: '/public/rounds',  desc: 'รอบหวย & ปฏิทินรอบ (list, calendar)' },
      { path: '/public/blocked', desc: 'เลขอั้นสาธารณะ' },
      { path: '/public/results', desc: 'ผลรางวัลหวย (list, latest)' },
      { path: '/public/yeekee',  desc: 'หวยจับยี่กี (88 รอบ, กติกา, รายการยิงเลข, สมาชิกยิงเลข)' },
      { path: '/public/finance', desc: 'การเงินหน้าบ้าน (ตรวจสลิป, แจ้งถอน, เช็คยอดเงิน)' },
      { path: '/public/auth',    desc: 'สมาชิก & OTP (ขอ OTP, ยืนยัน, รีเซ็ตรหัสผ่าน)' },
      { path: '/public/system',  desc: 'สถานะระบบภาพรวม (เปิด/ปิดระบบ)' },
    ],
  },
  admin: {
    prefix: '/api/v1/admin',
    authRequired: true,
    description: 'เส้นหลังบ้าน (ต้องมี Key/Staff Session เด็ดขาด): แบ่งชัดเจนเป็น กลุ่มดูยอด กับ กลุ่มรันระบบ',
    groups: {
      viewBalanceAndIntake: [
        { path: '/admin/lottery/limits/:id', desc: 'ดูและตั้งค่าเพดานรับกินรายเลข 14 ประเภท' },
        { path: '/admin/lottery/live-intake/:id', desc: 'ดูยอดรับแทงสด Live Intake สัดส่วนรับกิน 100%' },
        { path: '/admin/lottery/calculate-risk-limits', desc: 'คำนวณงบรับกินรวม ÷ อัตราจ่าย' },
        { path: '/admin/lottery/quick-number-action', desc: 'จัดการลดจ่าย/ปิดรับแทงด่วน 100 เลข' },
        { path: '/admin/monitor', desc: 'มอนิเตอร์ระบบภาพรวม (อ่านอย่างเดียว)' },
        { path: '/admin/reports', desc: 'รายงานการเงิน, สรุปยอดแทง, บัญชีรายวัน' },
        { path: '/admin/billing', desc: 'ส่งบิลและใบเสร็จ' },
        { path: '/admin/finance', desc: 'การเงินหลังบ้าน (อนุมัติถอน, เติมเงิน, ตรวจสอบ)' },
        { path: '/admin/users',   desc: 'จัดการข้อมูลสมาชิกและสิทธิ์' },
        { path: '/admin/agents',  desc: 'จัดการสายงานเอเย่นต์และคอมมิชชั่น' },
        { path: '/admin/keys',    desc: 'จัดการ API Keys สำหรับเชื่อมต่อระบบ' },
      ],
      runAndSettle: [
        { path: '/admin/rounds',   desc: 'รันตั้งเวลารอบ (schedule-batch, verify-sequential, close)' },
        { path: '/admin/blocked',  desc: 'จัดการเลขอั้น (เพิ่ม/ลบ)' },
        { path: '/admin/results',  desc: 'รันตัดสินผลรางวัล (preview-settle, settle & จ่ายเงินจริง)' },
        { path: '/admin/yeekee',   desc: 'รันระบบยี่กี (admin/bot-shoot, admin/status, admin/settle)' },
        { path: '/admin/queue',    desc: 'รันคิวประมวลผลโพย' },
        { path: '/admin/numberset', desc: 'รันระบบลดเลขและจำกัดความเสี่ยง' },
        { path: '/admin/game20',   desc: 'รันระบบหวย 20 ช่อง 6 หลัก + บอท 2 ตัว + ประวัติ' },
        { path: '/admin/system',   desc: 'รันระบบหลัก (toggle สวิตช์, purge-test-data)' },
      ],
    },
  },
} as const;

/** แผนที่โมดูลรวม — ใช้ตอบที่ /health */
export const MODULES = [
  { key: 'public',    path: '/public',    desc: '★ Gateway เส้นสาธารณะและสมาชิก (ไม่ต้องใช้ Key)', scope: 'public' },
  { key: 'admin',     path: '/admin',     desc: '★ Gateway เส้นหลังบ้าน/ผู้ดูแลระบบ (ต้องใช้ Key เด็ดขาด)', scope: 'admin' },
  { key: 'monitor',   path: '/monitor',   desc: 'มอนิเตอร์ระบบ (อ่านอย่างเดียว)', scope: 'monitor' },
  { key: 'queue',     path: '/queue',     desc: 'ระบบคิวโพย',                    scope: 'bet' },
  { key: 'billing',   path: '/billing',   desc: 'ส่งบิล/ใบเสร็จ',                scope: 'billing' },
  { key: 'numberset', path: '/numberset', desc: 'ลดเลข/ความเสี่ยง',              scope: 'numberset' },
  { key: 'game20',    path: '/game20',    desc: 'หวย 20 ช่อง 6 หลัก + บอท 2 ตัว', scope: 'lottery' },
  { key: 'yeekee',    path: '/yeekee',    desc: 'หวยจับยี่กี 88 รอบ ออกทุก 15 นาที', scope: 'lottery' },
  { key: 'system',    path: '/system',    desc: 'ระบบ เปิด/ปิด/ตั้งค่า',          scope: 'system' },
  { key: 'lottery',   path: '/lottery',   desc: 'ประเภทหวย/อัตราจ่าย/เพดานรับกิน', scope: 'lottery' },
  { key: 'rounds',    path: '/rounds',    desc: 'รอบหวย/ตั้งเวลาอัตโนมัติ',       scope: 'lottery' },
  { key: 'blocked',   path: '/blocked',   desc: 'เลขอั้น',                       scope: 'lottery' },
  { key: 'betting',   path: '/betting',   desc: 'แทง/ส่งโพย/ตรวจเครดิต',         scope: 'bet' },
  { key: 'results',   path: '/results',   desc: 'ผลรางวัล/ตัดสิน',                 scope: 'result' },
  { key: 'finance',   path: '/finance',   desc: 'การเงิน ฝาก/ถอน/สลิป/เครดิต',    scope: 'finance' },
  { key: 'reports',   path: '/reports',   desc: 'รายงาน',                        scope: 'report' },
  { key: 'users',     path: '/users',     desc: 'สมาชิก',                        scope: 'user' },
  { key: 'agents',    path: '/agents',    desc: 'เอเย่นต์',                      scope: 'agent' },
  { key: 'keys',      path: '/keys',      desc: 'API Keys',                      scope: 'admin' },
] as const;

/**
 * สร้าง router v1 ทั้งหมด
 * @param db Firestore instance
 */
export function createV1Router(db: any) {
  const api = Router();
  const authenticate = createAuthMiddleware(db);

  // ================================================================
  // 1) ตรวจสอบสถานะระบบ & ฐานข้อมูล (Health Check)
  // ================================================================
  api.get('/health', (_req, res) => {
    ok(res, {
      service: 'AK88 Lotto API',
      version: '2.2.0-isolated-gateways',
      gateways: GATEWAYS,
      supabaseConnected: isServerSupabaseConfigured(),
      modules: MODULES.map(m => m.key),
      moduleMap: MODULES,
      time: new Date().toISOString(),
    });
  });

  // ตรวจสอบสถานะการเชื่อมต่อ Supabase PostgreSQL สด
  api.get('/supabase/health', async (_req, res) => {
    try {
      const supabase = getSupabase();
      const t0 = Date.now();
      const { data, count, error } = await supabase.from('lottery_types').select('id', { count: 'exact' });
      const latency = Date.now() - t0;
      if (error) {
        res.status(200).json({ status: 'error', error: error.message, details: error });
        return;
      }
      res.json({
        status: 'success',
        database: 'Supabase PostgreSQL',
        connected: true,
        latencyMs: latency,
        lotteryCount: count ?? data?.length ?? 0,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(200).json({ status: 'catch_error', error: err?.message || String(err) });
    }
  });

  // ================================================================
  // 2) ★ หมวดเส้นสาธารณะ (Public Gateway: /api/v1/public/*) ★
  //    สำหรับแทงลง, ดูรายการหวย, รอบ, ผลรางวัล, สลิป, ยี่กี, OTP
  //    (ไม่ต้องใช้ API Key ของแอดมิน)
  // ================================================================
  api.use('/public', createPublicRouter(db));

  // ================================================================
  // 3) ★ หมวดเส้นหลังบ้าน (Admin Gateway: /api/v1/admin/*) ★
  //    สำหรับดูยอด Live Intake, รันรอบ, ตัดสินผล, คิว, รายงาน
  //    (ต้องใช้ API Key / Staff Session เด็ดขาด)
  // ================================================================
  api.use('/admin', createAdminRouter(db));

  // ================================================================
  // 4) ★ ความเข้ากันได้ย้อนหลัง (Backward Compatibility Aliases) ★
  //    เพื่อให้หน้าจอเว็บเดิมที่ยิงมาที่ /api/v1/* ทำงานได้อย่างราบรื่น
  // ================================================================

  // 4.1 เส้นแทงลง / โพย
  api.use('/betting', bettingRoutes(db));

  // 4.2 เส้นยี่กี
  api.use('/yeekee', createYeekeeRouter(db));

  // 4.3 เส้นหวย / รอบ / เลขอั้น
  api.use('/lottery', lotteryRoutes(db));
  api.use('/rounds', lotteryRoundRoutes(db));
  api.use('/blocked', blockedNumberRoutes(db));
  api.use('/results', resultRoutes(db));

  // 4.4 การเงิน & สมาชิกตรง
  api.post('/finance/slip/verify', asyncHandler(async (req, res) => {
    const { verifyAndCreditSlip } = await import('../../domains/finance/finance.service');
    const out = await verifyAndCreditSlip(db, req.body || {});
    ok(res, out, { message: out.message });
  }));

  api.post('/finance/withdraw', asyncHandler(async (req, res) => {
    const { requestWithdraw } = await import('../../domains/finance/finance.service');
    const out = await requestWithdraw(db, req.body || {});
    ok(res, out, { message: 'ส่งคำขอถอนเงินเรียบร้อยแล้ว รอระบบประมวลผล' });
  }));

  api.get('/finance/balance/:userId', asyncHandler(async (req, res) => {
    const { wallet } = await import('../../lib/wallet');
    const balance = await wallet.peek(db, req.params.userId);
    ok(res, { userId: req.params.userId, balance, status: 'active' });
  }));

  api.post('/auth/otp/send', asyncHandler(async (req, res) => {
    const { sendOtp } = await import('../../domains/auth/otp.service');
    const out = await sendOtp(req.body?.phone || req.body?.phoneNumber);
    ok(res, out, { message: out.message });
  }));

  api.post('/auth/otp/verify', asyncHandler(async (req, res) => {
    const { verifyOtp } = await import('../../domains/auth/otp.service');
    const out = await verifyOtp(req.body?.phone || req.body?.phoneNumber, req.body?.code);
    ok(res, out, { message: out.message });
  }));

  api.post('/auth/password/reset', asyncHandler(async (req, res) => {
    const { resetPasswordWithOtp } = await import('../../domains/auth/otp.service');
    const out = await resetPasswordWithOtp(
      db,
      req.body?.phone || req.body?.phoneNumber,
      req.body?.code,
      req.body?.newPassword
    );
    ok(res, out, { message: out.message });
  }));

  api.post('/system/purge-test-data', asyncHandler(async (_req, res) => {
    const { purgeTestData } = await import('../../domains/system/purge.service');
    const out = await purgeTestData(db);
    ok(res, out, { message: out.message });
  }));

  // 4.5 เส้นพิเศษที่ต้องใช้สิทธิ์ (Auth Legacy Aliases)
  const auth = Router();
  auth.use(authenticate);

  auth.use('/monitor',   requireScope('monitor'),   monitorRoutes(db));
  auth.use('/queue',     requireScope('bet'),       queueRoutes(db));
  auth.use('/billing',   requireScope('billing'),   billingRoutes(db));
  auth.use('/numberset', requireScope('numberset'), numberSetRoutes(db));
  auth.use('/game20',    requireScope('lottery'),   game20Routes(db));
  auth.use('/game20',    requireScope('lottery'),   game20HistoryRoutes(db));
  auth.use('/system',    systemRoutes(db));
  auth.use('/finance',   requireScope('finance'),   financeRoutes(db));
  auth.use('/reports',   reportRoutes(db));
  auth.use('/users',     userRoutes(db));
  auth.use('/agents',    agentRoutes(db));
  auth.use('/keys',      apiKeyRoutes(db));

  api.use(auth);

  return api;
}
