/**
 * server/routes/v1/admin.routes.ts
 * ------------------------------------------------------------------
 * ★ หมวดเส้นหลังบ้าน (Admin Gateway: /api/v1/admin/*) ★
 * สำหรับแอดมิน, พนักงาน (Staff), และระบบ Engine
 * ทุกเส้นผ่าน Middleware ตรวจสอบสิทธิ์ (API Key / Staff Session) เด็ดขาด
 *
 * จัดกลุ่มตามหมวดงานหลัก:
 *
 * 1. [กลุ่มดูยอด & การเงิน & รายงาน]
 *    - /lottery/limits/:id           — เพดานรับกินรายเลข 14 ประเภท
 *    - /lottery/live-intake/:id      — ยอดรับแทงสดรายตัวเลข สัดส่วนรับกิน 100%
 *    - /lottery/calculate-risk-limits — คำนวณเพดานรับกิน
 *    - /lottery/quick-number-action  — จัดการลดจ่าย / ปิดรับแทง 100 ตัวเลข
 *    - /monitor                      — มอนิเตอร์ระบบ (อ่านอย่างเดียว)
 *    - /reports                      — รายงานยอดแทง, สรุปการเงิน, กำไรขาดทุน
 *    - /billing                      — ระบบส่งบิล/ใบเสร็จ
 *    - /finance                      — การเงินหลังบ้าน (อนุมัติถอน, เติมเงิน, ตรวจสอบ)
 *    - /users                        — ข้อมูลสมาชิก
 *    - /agents                       — สายงานเอเย่นต์
 *    - /keys                         — จัดการ API Keys
 *
 * 2. [กลุ่มรันระบบ & ควบคุมรอบ & ออกผล]
 *    - /rounds                       — ตั้งเวลารอบหวย (schedule-batch, verify-sequential, close)
 *    - /blocked                      — จัดการเลขอั้น (เพิ่ม/ลบ)
 *    - /results                      — รันตัดสินรางวัล (preview-settle, settle & payout)
 *    - /yeekee                       — จัดการยี่กี (admin/bot-shoot, admin/status, admin/settle, admin/config)
 *    - /queue                        — ระบบคิวประมวลผลโพย
 *    - /numberset                    — ลดเลข/ตัดความเสี่ยง
 *    - /game20                       — หวย 20 ช่อง 6 หลัก + บอท 2 ตัว + ประวัติ
 *    - /system                       — สวิตช์ระบบ (toggle, settings, purge-test-data)
 */

import { Router } from 'express';
import { createAuthMiddleware, requireScope } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/error-handler';
import { ok } from '../../lib/response';

// เส้นแยกโมดูล
import { monitorRoutes } from './monitor.routes';
import { queueRoutes } from './queue.routes';
import { billingRoutes } from './billing.routes';
import { numberSetRoutes } from './numberset.routes';
import { game20Routes } from './game20.routes';
import { game20HistoryRoutes } from './game20History.routes';
import { createYeekeeRouter } from './yeekee.routes';

// เส้นธุรกิจหลัก
import { systemRoutes } from '../system';
import { lotteryRoutes, lotteryRoundRoutes, blockedNumberRoutes } from '../lottery';
import { resultRoutes } from './results.routes';
import { financeRoutes } from './finance.routes';
import { reportRoutes } from '../reports';
import { userRoutes, agentRoutes, apiKeyRoutes } from '../users';

export function createAdminRouter(db: any): Router {
  const router = Router();
  const authenticate = createAuthMiddleware(db);

  // ★ ทุกเส้นใน Admin Router ต้องผ่าน Authenticate เด็ดขาด!
  router.use(authenticate);

  // ================================================================
  // 1. [กลุ่มดูยอด & การเงิน & รายงาน]
  // ================================================================

  // ขีดจำกัดเดิมพัน, เพดานรับกินรายเลข 14 ประเภท, ยอดรับแทงสด Live Intake สัดส่วน 100%
  router.use('/lottery', lotteryRoutes(db));

  // มอนิเตอร์ระบบภาพรวม (อ่านอย่างเดียว)
  router.use('/monitor', requireScope('monitor'), monitorRoutes(db));

  // รายงานยอดแทง, สรุปการเงิน, บัญชีรายวัน
  router.use('/reports', reportRoutes(db));

  // ส่งบิล/ใบเสร็จ
  router.use('/billing', requireScope('billing'), billingRoutes(db));

  // การเงินหลังบ้าน (ธุรกรรมรออนุมัติ, เติมเครดิต, ตรวจสอบ)
  router.use('/finance', requireScope('finance'), financeRoutes(db));

  // จัดการสมาชิก, บัญชีผู้ใช้, ระงับ/ปลดระงับ
  router.use('/users', userRoutes(db));

  // จัดการสายงานเอเย่นต์, คอมมิชชั่น, เครดิต
  router.use('/agents', agentRoutes(db));

  // จัดการ API Keys สำหรับระบบเชื่อมต่อ
  router.use('/keys', apiKeyRoutes(db));

  // ================================================================
  // 2. [กลุ่มรันระบบ & ควบคุมรอบ & ออกผล]
  // ================================================================

  // รันรอบหวย, ตั้งเวลารอบล่วงหน้า (schedule-batch), ตรวจสอบความต่อเนื่อง (Sequential Guard), ปิดรอบ
  router.use('/rounds', lotteryRoundRoutes(db));

  // จัดการเลขอั้น (เพิ่ม/ลบ)
  router.use('/blocked', blockedNumberRoutes(db));

  // รันออกผลรางวัล, จำลองตรวจรางวัลก่อนจ่ายจริง (preview-settle), ตัดสินรางวัล & โอนเงินจริง (settle)
  router.use('/results', requireScope('result'), resultRoutes(db));

  // จัดการหวยยี่กี 88 รอบ (รันบอทยิงเลข, เปลี่ยนสถานะรอบ, รันออกผลและจ่ายรางวัลอัตโนมัติ)
  router.use('/yeekee', createYeekeeRouter(db));

  // รันระบบคิวประมวลผลโพย
  router.use('/queue', requireScope('bet'), queueRoutes(db));

  // รันระบบลดเลขและจำกัดความเสี่ยง
  router.use('/numberset', requireScope('numberset'), numberSetRoutes(db));

  // รันระบบหวย 20 ช่อง 6 หลัก + บอท 2 ตัว + จัดการประวัติ
  router.use('/game20', requireScope('lottery'), game20Routes(db));
  router.use('/game20', requireScope('lottery'), game20HistoryRoutes(db));

  // รันระบบหลัก: สวิตช์เปิด/ปิดรับแทง, ตั้งค่าเซิร์ฟเวอร์
  router.use('/system', systemRoutes(db));

  // สั่งล้างข้อมูลทดสอบเพื่อเปิดระบบจริง (Purge Test Data)
  router.post('/system/purge-test-data', asyncHandler(async (_req, res) => {
    const { purgeTestData } = await import('../../domains/system/purge.service');
    const out = await purgeTestData(db);
    ok(res, out, { message: out.message });
  }));

  return router;
}
