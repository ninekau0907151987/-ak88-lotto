/**
 * server/routes/v1/monitor.routes.ts
 * ------------------------------------------------------------------
 * ★ เส้นมอนิเตอร์ — อ่านอย่างเดียว ห้ามเขียนข้อมูลธุรกิจ ★
 * ใช้สำหรับหน้าจอเฝ้าระบบ / ตรวจสุขภาพ / ตรวจความถูกต้องยอดเงิน
 */
import { Router } from 'express';
import { asyncHandler } from '../../middleware/error-handler';
import { ok } from '../../lib/response';
import { systemHealth, auditBalance, findNegativeBalances } from '../../domains/monitor/monitor.service';
import { queueStats } from '../../domains/queue/queue.service';

export function monitorRoutes(db: any) {
  const r = Router();

  // GET /api/v1/monitor/health — สุขภาพระบบโดยรวม
  r.get('/health', asyncHandler(async (_req, res) => {
    ok(res, await systemHealth(db));
  }));

  // GET /api/v1/monitor/queue — สุขภาพคิวแบบละเอียด
  r.get('/queue', asyncHandler(async (_req, res) => {
    ok(res, await queueStats(db));
  }));

  // GET /api/v1/monitor/negative-balances — ★ ตรวจหาเครดิตติดลบ (ต้องได้ 0 เสมอ)
  r.get('/negative-balances', asyncHandler(async (_req, res) => {
    const out = await findNegativeBalances(db);
    ok(res, out, {
      message: out.count === 0
        ? '✅ ไม่พบบัญชีติดลบ — ระบบถูกต้อง'
        : `⚠️ พบ ${out.count} บัญชีติดลบ ต้องตรวจสอบทันที`,
    });
  }));

  // GET /api/v1/monitor/audit/:userId — ตรวจยอดเงินเทียบ ledger
  r.get('/audit/:userId', asyncHandler(async (req, res) => {
    const out = await auditBalance(db, req.params.userId);
    ok(res, out);
  }));

  return r;
}
