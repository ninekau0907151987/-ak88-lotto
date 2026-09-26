/**
 * server/routes/v1/yeekee.routes.ts
 * ==================================================================
 * API Routes สำหรับหวยจับยี่กี 88 รอบ
 * ==================================================================
 */

import { Router } from 'express';
import { YeekeeService } from '../../domains/yeekee/yeekee.service';
import { ok, fail } from '../../lib/response';
import { asyncHandler } from '../../middleware/error-handler';
import { requirePermission } from '../../middleware/permission';

export function createYeekeeRouter(db: any): Router {
  const router = Router();
  const service = new YeekeeService(db);

  // ---- 1. อ่านข้อมูล 88 รอบของวันนี้ (สาธารณะ) ----
  router.get('/rounds', asyncHandler(async (req, res) => {
    const { date } = req.query as { date?: string };
    const rounds = await service.getRounds(date);
    ok(res, rounds);
  }));

  // ---- 2. อ่านการตั้งค่าและอัตราจ่าย ----
  router.get('/config', asyncHandler(async (req, res) => {
    const config = await service.getConfig();
    ok(res, config);
  }));

  // ---- 3. อ่านรายการยิงเลขของรอบนั้น ----
  router.get('/shoots/:roundId', asyncHandler(async (req, res) => {
    const roundId = parseInt(req.params.roundId, 10);
    const { date } = req.query as { date?: string };
    const shoots = await service.getShoots(roundId, date);
    ok(res, shoots);
  }));

  // ---- 4. สมาชิกยิงเลข 5 หลัก ----
  router.post('/shoot', asyncHandler(async (req, res) => {
    const { roundId, userId, username, number, date } = req.body;
    if (!roundId || !number) {
      return fail(res, 400, 'BAD_REQUEST', 'ต้องระบุ roundId และ number');
    }
    const shoot = await service.shootNumber(
      Number(roundId),
      userId || 'guest',
      username || 'สมาชิก',
      String(number),
      date
    );
    ok(res, shoot, { message: 'ยิงเลขสำเร็จ' });
  }));

  // ================================================================
  // ★ เส้นหลังบ้านสำหรับเจ้าของระบบ (Admin & Owner)
  // ================================================================

  // ---- 5. สั่งบอทยิงเลขช่วย ----
  router.post('/admin/bot-shoot', requirePermission('lottery.open_close'), asyncHandler(async (req, res) => {
    const { roundId, count, date } = req.body;
    const added = await service.triggerBotShoots(Number(roundId), Number(count) || 16, date);
    ok(res, { added }, { message: `บอทยิงเลขเพิ่ม ${added} ลำดับแล้ว` });
  }));

  // ---- 6. สั่งเปลี่ยนสถานะรอบ (เปิด / ปิดรับแทง) ----
  router.post('/admin/status', requirePermission('lottery.open_close'), asyncHandler(async (req, res) => {
    const { roundId, status, date } = req.body;
    await service.setRoundStatus(Number(roundId), status, date);
    ok(res, { roundId, status }, { message: `เปลี่ยนสถานะรอบที่ ${roundId} เป็น ${status} สำเร็จ` });
  }));

  // ---- 7. สั่งออกผล & ตรวจรางวัล & จ่ายเงินรางวัลอัตโนมัติ ----
  router.post('/admin/settle', requirePermission('lottery.settle'), asyncHandler(async (req, res) => {
    const { roundId, manualResult, date } = req.body;
    const settled = await service.settleRound(Number(roundId), manualResult, date);
    ok(res, settled, { message: `ออกผลและตรวจรางวัลรอบที่ ${roundId} เรียบร้อยแล้ว` });
  }));

  // ---- 8. บันทึกการตั้งค่าและอัตราจ่าย ----
  router.put('/admin/config', requirePermission('lottery.open_close'), asyncHandler(async (req, res) => {
    const updated = await service.updateConfig(req.body);
    ok(res, updated, { message: 'บันทึกการตั้งค่ายี่กีสำเร็จ' });
  }));

  return router;
}
