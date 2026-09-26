/**
 * server/routes/v1/billing.routes.ts
 * ------------------------------------------------------------------
 * ★ เส้นส่งบิล — แยกเส้นโดยสมบูรณ์ ★
 * อ่าน/พิมพ์บิลซ้ำได้ ไม่กระทบยอดเงิน
 * ลำดับ: static ก่อน param
 */
import { Router } from 'express';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { COL } from '../../config/collections';
import { asyncHandler } from '../../middleware/error-handler';
import { ok, okList, ERR } from '../../lib/response';
import { AppError } from '../../lib/wallet';
import {
  issueBetInvoice, issueTransactionInvoice, issueSettlementStatement,
  getInvoice, customerStatement,
} from '../../domains/billing/billing.service';

export function billingRoutes(db: any) {
  const r = Router();

  /* ---------- STATIC ---------- */

  // POST /api/v1/billing/issue/ticket — ออกบิลจากโพย
  r.post('/issue/ticket', asyncHandler(async (req, res) => {
    const { ticketId, force } = req.body || {};
    if (!ticketId) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ ticketId', 400);
    const out = await issueBetInvoice(db, ticketId, { force: !!force });
    ok(res, out, { message: out.duplicate ? 'บิลนี้เคยออกแล้ว' : 'ออกบิลแล้ว' });
  }));

  // POST /api/v1/billing/issue/transaction — ออกบิลจากธุรกรรม (ฝาก/ถอน/เติม)
  r.post('/issue/transaction', asyncHandler(async (req, res) => {
    const { transactionId } = req.body || {};
    if (!transactionId) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ transactionId', 400);
    const out = await issueTransactionInvoice(db, transactionId);
    ok(res, out, { message: out.duplicate ? 'บิลนี้เคยออกแล้ว' : 'ออกบิลแล้ว' });
  }));

  // POST /api/v1/billing/issue/statement — ออกใบสรุปยอดทั้งรอบ
  r.post('/issue/statement', asyncHandler(async (req, res) => {
    const { roundId, lotterySlug, lotteryType, userId } = req.body || {};
    const slug = lotterySlug || lotteryType;
    if (!roundId || !slug) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ roundId และ lotterySlug', 400);
    const out = await issueSettlementStatement(db, { roundId, lotterySlug: slug, userId });
    ok(res, out, { message: `ออกใบสรุปยอด ${out.invoiceNo} แล้ว` });
  }));

  // GET /api/v1/billing/invoices — รายการบิล (กรองได้)
  r.get('/invoices', asyncHandler(async (req, res) => {
    const { userId, type, status, roundId } = req.query as any;
    const conds: any[] = [];
    if (userId) conds.push(where('userId', '==', userId));
    if (type) conds.push(where('type', '==', type));
    if (status) conds.push(where('status', '==', status));
    if (roundId) conds.push(where('roundId', '==', roundId));

    const col = collection(db, COL.INVOICES);
    const snap = await getDocs(conds.length ? query(col, ...conds) : col);
    const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    list.sort((a, b) => String(b.issuedAt || '').localeCompare(String(a.issuedAt || '')));
    okList(res, list);
  }));

  // GET /api/v1/billing/statement/:userId — ใบแจ้งยอดของลูกค้า
  r.get('/statement/:userId', asyncHandler(async (req, res) => {
    const { from, to } = req.query as any;
    const out = await customerStatement(db, req.params.userId, { from, to });
    ok(res, out);
  }));

  /* ---------- PARAM ---------- */

  // GET /api/v1/billing/:id — ดู/พิมพ์บิลซ้ำ
  r.get('/:id', asyncHandler(async (req, res) => {
    ok(res, await getInvoice(db, req.params.id));
  }));

  return r;
}
