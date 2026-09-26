/**
 * server/routes/v1/numberset.routes.ts
 * ------------------------------------------------------------------
 * ★ เส้นลดเลข — แยกเส้นโดยสมบูรณ์ ★
 * ลำดับ: static ก่อน param
 */
import { Router } from 'express';
import { asyncHandler } from '../../middleware/error-handler';
import { ok, okList, ERR } from '../../lib/response';
import { AppError } from '../../lib/wallet';
import {
  createNumberSet, updateNumberSetStatus, roundExposure, listNumberSets,
} from '../../domains/numberset/numberset.service';

export function numberSetRoutes(db: any) {
  const r = Router();

  /* ---------- STATIC ---------- */

  // POST /api/v1/numberset/sets — สร้างชุดลดเลขใหม่
  r.post('/sets', asyncHandler(async (req, res) => {
    const out = await createNumberSet(db, req.body);
    ok(res, out, { message: `สร้างชุดลดเลข ${out.setNo} แล้ว (${out.itemCount} รายการ)` });
  }));

  // GET /api/v1/numberset/sets — รายการชุดลดเลข
  r.get('/sets', asyncHandler(async (req, res) => {
    const { lotterySlug, lotteryType, roundId, vendor, status } = req.query as any;
    const list = await listNumberSets(db, {
      lotterySlug: lotterySlug || lotteryType,
      roundId, vendor, status,
    });
    okList(res, list);
  }));

  // GET /api/v1/numberset/exposure — ★ ความเสี่ยงคงเหลือของรอบ (หน้าจอสำคัญ)
  r.get('/exposure', asyncHandler(async (req, res) => {
    const { lotterySlug, lotteryType, roundId } = req.query as any;
    const slug = lotterySlug || lotteryType;
    if (!slug) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ lotterySlug', 400);
    if (!roundId) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ roundId', 400);
    const out = await roundExposure(db, slug, roundId);
    ok(res, out, {
      message: out.netExposure > 0
        ? `ยังถือความเสี่ยงเอง ${out.netExposure.toLocaleString()} บาท`
        : 'ปิดความเสี่ยงครบแล้ว',
    });
  }));

  /* ---------- PARAM ---------- */

  // POST /api/v1/numberset/sets/:id/status — เปลี่ยนสถานะ (sent/confirmed/paid/cancelled)
  r.post('/sets/:id/status', asyncHandler(async (req, res) => {
    const { status, vendorRef, note } = req.body || {};
    const out = await updateNumberSetStatus(db, req.params.id, status, { vendorRef, note });
    ok(res, out, { message: `อัปเดตชุด ${out.setNo} เป็น ${status} แล้ว` });
  }));

  return r;
}
