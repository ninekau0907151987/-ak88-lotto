/**
 * server/routes/v1/results.routes.ts
 * ------------------------------------------------------------------
 * เส้นผลรางวัล + ตัดสินรางวัล
 * ★ /settle และ /preview-settle เป็น static ต้องมาก่อน /:id (ไม่มี /:id ที่นี่)
 */
import { Router } from 'express';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { COL } from '../../config/collections';
import { asyncHandler } from '../../middleware/error-handler';
import { ok, okList, ERR } from '../../lib/response';
import { AppError } from '../../lib/wallet';
import { settleRound } from '../../domains/betting/settlement.service';

export function resultRoutes(db: any) {
  const r = Router();

  // GET /api/v1/results — ดูผลรางวัล
  r.get('/', asyncHandler(async (req, res) => {
    const { type, lotterySlug, roundId, date } = req.query as any;
    const slug = lotterySlug || type;
    const conds: any[] = [];
    if (slug) conds.push(where('lotteryType', '==', slug));
    if (roundId) conds.push(where('roundId', '==', roundId));

    const col = collection(db, COL.LOTTERY_RESULTS);
    const snap = await getDocs(conds.length ? query(col, ...conds) : col);
    let list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    if (date) list = list.filter(x => String(x.createdAt || x.date || '').startsWith(String(date)));
    list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    okList(res, list);
  }));

  /* ---------- STATIC (มาก่อน param เสมอ) ---------- */

  // POST /api/v1/results/preview-settle — ★ ดูผลก่อนจ่ายจริง (dry run)
  // แนะนำให้ใช้ตัวนี้ก่อน settle จริงเสมอ
  r.post('/preview-settle', asyncHandler(async (req, res) => {
    const { lotterySlug, lotteryType, roundId, result, rates } = req.body || {};
    const out = await settleRound(db, {
      lotterySlug: lotterySlug || lotteryType,
      roundId,
      result,
      rates,
      dryRun: true,                  // ★ ไม่แตะเงิน ไม่เขียน DB
    });
    ok(res, out, { message: 'ผลตรวจล่วงหน้า (ยังไม่จ่ายเงิน)' });
  }));

  // POST /api/v1/results/settle — ★ ตัดสินรางวัล + จ่ายเงินจริง
  r.post('/settle', asyncHandler(async (req, res) => {
    const { lotterySlug, lotteryType, roundId, result, rates, force, forceReason } = req.body || {};
    const out = await settleRound(db, {
      lotterySlug: lotterySlug || lotteryType,
      roundId,
      result,
      rates,
      force: !!force,
      forceReason,
    });
    ok(res, out, {
      message: `ตัดสินรางวัลรอบ ${roundId} เรียบร้อย — ถูก ${out.winCount} / ไม่ถูก ${out.loseCount}`,
    });
  }));

  // POST /api/v1/results — บันทึกผลรางวัลอย่างเดียว (ไม่ตัดสิน)
  r.post('/', asyncHandler(async (req, res) => {
    const { lotterySlug, lotteryType, roundId, ...rest } = req.body || {};
    const slug = lotterySlug || lotteryType;
    if (!slug) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ lotterySlug', 400);
    if (!roundId) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ roundId', 400);

    const { addDoc, serverTimestamp } = await import('firebase/firestore');
    const ref = await addDoc(collection(db, COL.LOTTERY_RESULTS), {
      ...rest,
      lotterySlug: slug,
      lotteryType: slug,
      roundId,
      createdAt: new Date().toISOString(),
      source: 'api',
    });
    ok(res, { id: ref.id }, { message: 'บันทึกผลรางวัลแล้ว' });
  }));

  return r;
}
