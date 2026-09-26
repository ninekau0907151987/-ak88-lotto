/**
 * server/routes/v1/finance.routes.ts
 * ------------------------------------------------------------------
 * เส้นการเงิน — ทุกการเปลี่ยนเครดิตเรียกผ่าน finance.service
 * ซึ่งภายในใช้ wallet (atomic) เท่านั้น
 * ลำดับ: /balance, /topup, /deposit, /withdraw → /transactions → /transactions/:id/review
 */
import { Router } from 'express';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { COL } from '../../config/collections';
import { asyncHandler } from '../../middleware/error-handler';
import { ok, okList, ERR } from '../../lib/response';
import { AppError } from '../../lib/wallet';
import {
  topup, requestDeposit, requestWithdraw, reviewTransaction,
} from '../../domains/finance/finance.service';

export function financeRoutes(db: any) {
  const r = Router();

  /* ---------- STATIC ---------- */

  // GET /api/v1/finance/transactions — ประวัติธุรกรรม
  r.get('/transactions', asyncHandler(async (req, res) => {
    const { userId, type, status, roundId } = req.query as any;
    const conds: any[] = [];
    if (userId) conds.push(where('userId', '==', userId));
    if (type) conds.push(where('type', '==', type));
    if (status) conds.push(where('status', '==', status));

    const col = collection(db, COL.TRANSACTIONS);
    const snap = await getDocs(conds.length ? query(col, ...conds) : col);
    let list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    if (roundId) list = list.filter(t => String(t.roundId || '') === String(roundId));
    list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    okList(res, list);
  }));

  // GET /api/v1/finance/pending — ธุรกรรมรออนุมัติ (สำหรับหน้าจอแอดมิน)
  r.get('/pending', asyncHandler(async (_req, res) => {
    const snap = await getDocs(query(
      collection(db, COL.TRANSACTIONS),
      where('status', '==', 'pending'),
    ));
    const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    list.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    okList(res, list, {
      depositCount: list.filter(x => x.type === 'deposit').length,
      withdrawCount: list.filter(x => x.type === 'withdraw').length,
      depositTotal: list.filter(x => x.type === 'deposit').reduce((s, x) => s + (Number(x.amount) || 0), 0),
      withdrawTotal: list.filter(x => x.type === 'withdraw').reduce((s, x) => s + (Number(x.amount) || 0), 0),
    });
  }));

  // POST /api/v1/finance/topup
  r.post('/topup', asyncHandler(async (req, res) => {
    const { userId, amount, note } = req.body || {};
    const out = await topup(db, userId, amount, note);
    ok(res, out, { message: 'เติมเครดิตแล้ว' });
  }));

  // POST /api/v1/finance/deposit
  r.post('/deposit', asyncHandler(async (req, res) => {
    const out = await requestDeposit(db, req.body || {});
    ok(res, out, { message: 'แจ้งฝากแล้ว รอแอดมินอนุมัติ' });
  }));

  // POST /api/v1/finance/withdraw
  r.post('/withdraw', asyncHandler(async (req, res) => {
    const out = await requestWithdraw(db, req.body || {});
    ok(res, out, { message: 'แจ้งถอนแล้ว รอแอดมินอนุมัติ' });
  }));

  /* ---------- PARAM ---------- */

  // GET /api/v1/finance/balance/:userId
  r.get('/balance/:userId', asyncHandler(async (req, res) => {
    const { wallet } = await import('../../lib/wallet');
    const balance = await wallet.peek(db, req.params.userId);
    ok(res, {
      userId: req.params.userId,
      username: req.params.userId,
      balance,
      status: 'active',
    });
  }));

  // POST /api/v1/finance/transactions/:id/review
  r.post('/transactions/:id/review', asyncHandler(async (req, res) => {
    const { action, note } = req.body || {};
    const out = await reviewTransaction(db, req.params.id, action, note);
    ok(res, out, {
      message: action === 'approve' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว (คืนเครดิตถ้าเป็นถอน)',
    });
  }));

  return r;
}
