/**
 * server/routes/v1/index.ts
 * ------------------------------------------------------------------
 * ★ ศูนย์รวมเส้น API v1 ★
 *
 * กฎการผูกเส้น (สำคัญ):
 *   1. เส้นที่ "กว้างกว่า" ต้องอยู่ "บน"
 *      เช่น /monitor ก่อน /queue (ไม่ชนกันเพราะคนละ prefix)
 *   2. ภายในแต่ละโมดูล static ต้องมาก่อน param (จัดการในไฟล์ routes)
 *   3. ห้ามลบเส้นเก่าโดยไม่เพิ่ม v2 — ให้ deprecate แทน
 *
 * โครงสร้างเส้น:
 *   /api/v1/health            — ตรวจสุขภาพ + แผนที่โมดูล
 *   /api/v1/public/*          — ไม่ต้องใช้ API Key
 *   /api/v1/monitor/*         — เส้นมอนิเตอร์ (อ่านอย่างเดียว)
 *   /api/v1/queue/*           — เส้นคิว
 *   /api/v1/billing/*         — เส้นส่งบิล
 *   /api/v1/numberset/*       — เส้นลดเลข
 *   ---- ด้านล่างนี้เป็นเส้นธุรกิจหลัก ----
 *   /api/v1/system|lottery|rounds|blocked|betting|results|finance|reports|users|agents|keys
 */
import { Router } from 'express';
import { createAuthMiddleware, requireScope } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error-handler';
import { ok } from '../../lib/response';

// ---- เส้นแยกโมดูล (เส้นพิเศษ) ----
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

/** แผนที่โมดูล — ใช้ตอบที่ /health และให้หน้าจอหลังบ้านอ่านได้ */
export const MODULES = [
  { key: 'monitor',   path: '/monitor',   desc: 'มอนิเตอร์ระบบ (อ่านอย่างเดียว)', scope: 'monitor' },
  { key: 'queue',     path: '/queue',     desc: 'ระบบคิวโพย',                    scope: 'bet' },
  { key: 'billing',   path: '/billing',   desc: 'ส่งบิล/ใบเสร็จ',                scope: 'billing' },
  { key: 'numberset', path: '/numberset', desc: 'ลดเลข/ความเสี่ยง',              scope: 'numberset' },
  { key: 'game20',    path: '/game20',    desc: '★ หวย 20 ช่อง 6 หลัก + บอท 2 ตัว', scope: 'lottery' },
  { key: 'yeekee',    path: '/yeekee',    desc: '★ หวยจับยี่กี 88 รอบ ออกทุก 15 นาที', scope: 'lottery' },
  { key: 'system',    path: '/system',    desc: 'ระบบ เปิด/ปิด/ตั้งค่า',          scope: 'system' },
  { key: 'lottery',   path: '/lottery',   desc: 'ประเภทหวย/อัตราจ่าย',           scope: 'lottery' },
  { key: 'rounds',    path: '/rounds',    desc: 'รอบหวย',                        scope: 'lottery' },
  { key: 'blocked',   path: '/blocked',   desc: 'เลขอั้น',                       scope: 'lottery' },
  { key: 'betting',   path: '/betting',   desc: 'แทง/ส่งโพย',                    scope: 'bet' },
  { key: 'results',   path: '/results',   desc: 'ผลรางวัล/ตัดสิน',                 scope: 'result' },
  { key: 'finance',   path: '/finance',   desc: 'การเงิน ฝาก/ถอน/เครดิต',         scope: 'finance' },
  { key: 'reports',   path: '/reports',   desc: 'รายงาน',                        scope: 'report' },
  { key: 'users',     path: '/users',     desc: 'สมาชิก',                        scope: 'user' },
  { key: 'agents',    path: '/agents',    desc: 'เอเย่นต์',                      scope: 'agent' },
  { key: 'keys',      path: '/keys',      desc: 'API Keys',                      scope: 'admin' },
] as const;

/**
 * สร้าง router v1 ทั้งหมด
 * @param db Firestore instance
 * @param deps ของแถมที่ต้องใช้ (เช่น การอ่าน public)
 */
export function createV1Router(db: any) {
  const api = Router();
  const authenticate = createAuthMiddleware(db);

  // ---------- 1) ไม่ต้องใช้ Key ----------
  api.get('/health', (_req, res) => {
    ok(res, {
      service: 'AK88 Lotto API',
      version: '2.0.0',
      modules: MODULES.map(m => m.key),
      moduleMap: MODULES,
      time: new Date().toISOString(),
    });
  });

  // ---- หวยยี่กี (อ่านรอบ/ยิงเลข/จัดการหลังบ้าน) ----
  api.use('/yeekee', createYeekeeRouter(db));

  // ---- ตรวจสลิปฝากเงินสาธารณะสำหรับสมาชิกหน้าบ้าน ----
  api.post('/finance/slip/verify', asyncHandler(async (req, res) => {
    const { verifyAndCreditSlip } = await import('../../domains/finance/finance.service');
    const out = await verifyAndCreditSlip(db, req.body || {});
    ok(res, out, { message: out.message });
  }));

  // ---- แจ้งถอนเงินสาธารณะสำหรับสมาชิกหน้าบ้าน (ตัดเครดิต Escrow ทันที) ----
  api.post('/finance/withdraw', asyncHandler(async (req, res) => {
    const { requestWithdraw } = await import('../../domains/finance/finance.service');
    const out = await requestWithdraw(db, req.body || {});
    ok(res, out, { message: 'ส่งคำขอถอนเงินเรียบร้อยแล้ว รอระบบประมวลผล' });
  }));

  // ---- ยอดเงินคงเหลือสมาชิก ----
  api.get('/finance/balance/:userId', asyncHandler(async (req, res) => {
    const { wallet } = await import('../../lib/wallet');
    const balance = await wallet.peek(db, req.params.userId);
    ok(res, { userId: req.params.userId, balance, status: 'active' });
  }));

  // ---- ระบบ SMS OTP & รีเซ็ตรหัสผ่านสมาชิก ----
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

  // ---------- 2) ต้องใช้ API Key ทุกเส้นด้านล่าง ----------
  const auth = Router();
  auth.use(authenticate);

  // เส้นพิเศษ — ผูกก่อนเส้นธุรกิจ เพื่อให้ชัดว่าใครรับผิดชอบอะไร
  auth.use('/monitor',   requireScope('monitor'),   monitorRoutes(db));
  auth.use('/queue',     requireScope('bet'),       queueRoutes(db));
  auth.use('/billing',   requireScope('billing'),   billingRoutes(db));
  auth.use('/numberset', requireScope('numberset'), numberSetRoutes(db));
  auth.use('/game20',    requireScope('lottery'),   game20Routes(db));
  // ★ ประวัติ/รหัส/แก้ไขผล/กติกา — ต่อท้าย /game20 (static ก่อน param จัดการในไฟล์)
  auth.use('/game20',    requireScope('lottery'),   game20HistoryRoutes(db));

  // เส้นธุรกิจหลัก
  auth.use('/system', systemRoutes(db));
  auth.use('/lottery', lotteryRoutes(db));
  auth.use('/rounds', lotteryRoundRoutes(db));
  auth.use('/blocked', blockedNumberRoutes(db));
  auth.use('/betting', requireScope('bet'), bettingRoutes(db));
  auth.use('/results', requireScope('result'), resultRoutes(db));
  auth.use('/finance', requireScope('finance'), financeRoutes(db));
  auth.use('/reports', reportRoutes(db));
  auth.use('/users', userRoutes(db));
  auth.use('/agents', agentRoutes(db));
  auth.use('/keys', apiKeyRoutes(db));

  api.use(auth);
  return api;
}
