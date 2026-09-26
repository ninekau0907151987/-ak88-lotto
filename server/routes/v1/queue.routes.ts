/**
 * server/routes/v1/queue.routes.ts
 * ------------------------------------------------------------------
 * ★ ลำดับ route ในไฟล์นี้สำคัญมาก ★
 *
 * ปัญหาเดิม: /:id อยู่ก่อน /process
 *   → ถ้าอนาคตมี POST /:id ปุ๊บ /process ตายทันที
 *
 * กฎ: static path ต้องมาก่อน param path เสมอ
 *   ✅ /process   ← static
 *   ✅ /stats     ← static
 *   ❌ /:id       ← param ต้องอยู่ล่างสุด
 *
 * ลำดับในไฟล์นี้:  enqueue → process → stats → (monitor) → /:id → /:id/status
 */
import { Router } from 'express';
import {
  collection, getDocs, query, where,
} from 'firebase/firestore';
import { COL, QUEUE_STATUS } from '../../config/collections';
import { asyncHandler } from '../../middleware/error-handler';
import { ok, okList, fail, ERR } from '../../lib/response';
import { enqueue, processQueue, getQueuePosition, queueStats } from '../../domains/queue/queue.service';
import { AppError } from '../../lib/wallet';

export function queueRoutes(db: any) {
  const r = Router();

  /* ---------- 1) STATIC PATHS (ต้องมาก่อนทุกอย่าง) ---------- */

  // POST /api/v1/queue/enqueue — เข้าคิว
  r.post('/enqueue', asyncHandler(async (req, res) => {
    const out = await enqueue(db, req.body);
    ok(res, out, {
      message: out.duplicate ? 'รายการนี้อยู่ในคิวแล้ว' : 'เข้าคิวแล้ว',
    });
  }));

  // POST /api/v1/queue/process — ประมวลผลคิว (worker/admin)
  r.post('/process', asyncHandler(async (req, res) => {
    const { batchSize, workerId } = req.body || {};
    const out = await processQueue(db, { batchSize, workerId });
    ok(res, out, {
      message: out.picked === 0 ? 'ไม่มีรายการในคิว' : `ประมวลผลแล้ว ${out.done}/${out.picked} รายการ`,
    });
  }));

  // GET /api/v1/queue/stats — สรุปสถานะคิว (สำหรับหน้าจอมอนิเตอร์)
  r.get('/stats', asyncHandler(async (_req, res) => {
    ok(res, await queueStats(db));
  }));

  // GET /api/v1/queue/failed — คิวที่ล้ม เพื่อให้ admin แก้
  r.get('/failed', asyncHandler(async (_req, res) => {
    const snap = await getDocs(query(
      collection(db, COL.BET_QUEUE),
      where('status', '==', QUEUE_STATUS.FAILED),
    ));
    const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    okList(res, list);
  }));

  // GET /api/v1/queue — ดูคิวทั้งหมด
  r.get('/', asyncHandler(async (req, res) => {
    const { status } = req.query as any;
    const col = collection(db, COL.BET_QUEUE);
    const snap = await getDocs(status ? query(col, where('status', '==', status)) : col);
    const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    list.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    okList(res, list);
  }));

  /* ---------- 2) PARAM PATHS (ต้องอยู่ล่างสุดเสมอ) ---------- */

  // GET /api/v1/queue/:id — ดูสถานะ + ตำแหน่งในคิว
  r.get('/:id', asyncHandler(async (req, res) => {
    ok(res, await getQueuePosition(db, req.params.id));
  }));

  // POST /api/v1/queue/:id/status — อัปเดตสถานะด้วยมือ (admin)
  r.post('/:id/status', asyncHandler(async (req, res) => {
    const { status } = req.body || {};
    const allowed = Object.values(QUEUE_STATUS);
    if (!allowed.includes(status)) {
      throw new AppError(ERR.BAD_REQUEST, `status ต้องเป็น: ${allowed.join(' | ')}`, 400);
    }
    const { updateDoc, doc, serverTimestamp } = await import('firebase/firestore');
    await updateDoc(doc(db, COL.BET_QUEUE, req.params.id), {
      status,
      error: req.body.error || null,
      updatedAt: serverTimestamp(),
    });
    ok(res, { id: req.params.id, status }, { message: `อัปเดตสถานะคิวเป็น ${status} แล้ว` });
  }));

  return r;
}
