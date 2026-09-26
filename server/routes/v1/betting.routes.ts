/**
 * server/routes/v1/betting.routes.ts
 * ------------------------------------------------------------------
 * เส้นการแทง — บางมาก เพราะตรรกะอยู่ใน domains/betting
 * หน้าที่: ตรวจ input → เรียก service → ตอบกลับ
 *
 * ลำดับ: /preview → /bet → /tickets → /tickets/:id → /tickets/:id/cancel
 * ★ /tickets ต้องมาก่อน /tickets/:id ; /bet เป็น static จึงปลอดภัย
 */
import { Router } from 'express';
import { collection, getDocs, getDoc, doc, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import { COL } from '../../config/collections';
import { asyncHandler } from '../../middleware/error-handler';
import { ok, okList, ERR } from '../../lib/response';
import { AppError } from '../../lib/wallet';
import { placeBet, cancelTicket, sumBets } from '../../domains/betting/betting.service';

export function bettingRoutes(db: any) {
  const r = Router();

  /* ---------- STATIC ---------- */

  // POST /api/v1/betting/preview — คำนวณเงิน + เช็คก่อนแทง (ไม่ตัดเครดิต)
  r.post('/preview', asyncHandler(async (req, res) => {
    const { lotterySlug, lotteryType, userId, bets, roundId } = req.body || {};
    const slug = lotterySlug || lotteryType;
    if (!slug || !userId || !Array.isArray(bets) || bets.length === 0) {
      throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ lotterySlug, userId และ bets[]', 400);
    }

    const totalAmount = bets.reduce((s: number, b: any) => s + (Number(b?.amount) || 0), 0);

    // อ่านยอดเครดิตเพื่อแสดงผลเท่านั้น (ไม่ตัดจริง)
    const { wallet } = await import('../../lib/wallet');
    const balance = await wallet.peek(db, userId);

    // เช็คเลขอั้น — ใช้ตัวตรวจตัวเดียวกับตอนแทงจริง
    const blSnap = await getDocs(query(
      collection(db, COL.BLOCKED_NUMBERS),
      where('lotteryType', '==', slug),
    ));
    const blocked = blSnap.docs.map(d => d.data() as any);
    const hits = bets.filter((bet: any) =>
      blocked.some((b: any) =>
        String(b.number) === String(bet.number) &&
        (b.betType === 'ทุกประเภท' || b.betType === bet.type) &&
        (b.limit == null || Number(bet.amount) > Number(b.limit)),
      ),
    ).map((b: any) => ({ number: String(b.number), type: String(b.type) }));

    // ช่วงเวลารับแทงของหวย
    const tSnap = await getDoc(doc(db, COL.LOTTERY_TYPES, slug));
    const lt: any = tSnap.exists() ? tSnap.data() : {};
    const closedReason = lt.status === 'closed' || lt.bettingOpen === false
      ? `หวย ${slug} ปิดรับแทง` : null;

    ok(res, {
      lotterySlug: slug,
      roundId: roundId || null,
      betCount: bets.length,
      totalAmount,
      balance,
      sufficient: balance >= totalAmount,
      shortfall: Math.max(0, totalAmount - balance),
      blockedNumbers: hits,
      canBet: hits.length === 0 && !closedReason && balance >= totalAmount,
      closedReason,
      rates: lt.rates || null,
    });
  }));

  // POST /api/v1/betting/bet — ส่งโพยจริง
  r.post('/bet', asyncHandler(async (req, res) => {
    const { lotterySlug, lotteryType, userId, bets, roundId, idempotencyKey } = req.body || {};
    const out = await placeBet(db, {
      userId,
      lotterySlug: lotterySlug || lotteryType,
      roundId: roundId || null,
      bets,
      idempotencyKey: idempotencyKey || null,
      source: 'api',
    });
    ok(res, out, { message: 'ส่งโพยสำเร็จ' });
  }));

  // GET /api/v1/betting/tickets — ดูโพย (★ ต้องมาก่อน /tickets/:id)
  r.get('/tickets', asyncHandler(async (req, res) => {
    const { userId, status, lotterySlug, lotteryType, roundId } = req.query as any;
    const conds: any[] = [];
    if (userId) conds.push(where('userId', '==', userId));
    if (status) conds.push(where('status', '==', status));
    // อ่านได้ทั้งชื่อเก่าและชื่อใหม่
    if (lotterySlug || lotteryType) conds.push(where('ticketType', '==', lotterySlug || lotteryType));

    const col = collection(db, COL.TICKETS);
    const snap = await getDocs(conds.length ? query(col, ...conds) : col);
    let list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    if (roundId) list = list.filter(t => String(t.roundId || '') === String(roundId));
    list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    okList(res, list);
  }));

  // GET /api/v1/betting/summary — สรุปยอดโพยของ users (สำหรับหน้าจอ)
  r.get('/summary', asyncHandler(async (req, res) => {
    const { userId, roundId } = req.query as any;
    const col = collection(db, COL.TICKETS);
    const snap = await getDocs(userId ? query(col, where('userId', '==', userId)) : col);
    let list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    if (roundId) list = list.filter(t => String(t.roundId || '') === String(roundId));

    ok(res, {
      tickets: list.length,
      totalBet: list.reduce((s, t) => s + (Number(t.totalAmount) || 0), 0),
      totalPayout: list.reduce((s, t) => s + (Number(t.payout) || 0), 0),
      win: list.filter(t => t.status === 'win').length,
      lose: list.filter(t => t.status === 'lose').length,
      pending: list.filter(t => t.status === 'confirmed').length,
      cancelled: list.filter(t => t.status === 'cancelled').length,
      net: list.reduce((s, t) => s + (Number(t.totalAmount) || 0) - (Number(t.payout) || 0), 0),
    });
  }));

  /* ---------- PARAM ---------- */

  // GET /api/v1/betting/tickets/:id
  r.get('/tickets/:id', asyncHandler(async (req, res) => {
    const snap = await getDoc(doc(db, COL.TICKETS, req.params.id));
    if (!snap.exists()) throw new AppError(ERR.NOT_FOUND, 'ไม่พบโพย', 404);
    ok(res, { id: snap.id, ...snap.data() });
  }));

  // POST /api/v1/betting/tickets/:id/cancel — ยกเลิก + คืนเครดิต (atomic)
  r.post('/tickets/:id/cancel', asyncHandler(async (req, res) => {
    const out = await cancelTicket(db, req.params.id);
    ok(res, out, { message: 'ยกเลิกโพยและคืนเครดิตแล้ว' });
  }));

  // POST /api/v1/betting/tickets/:id/status — อัปเดตสถานะด้วยมือ (admin)
  r.post('/tickets/:id/status', asyncHandler(async (req, res) => {
    const { status } = req.body || {};
    const allowed = ['active', 'confirmed', 'win', 'lose', 'cancelled', 'settled'];
    if (!allowed.includes(status)) {
      throw new AppError(ERR.BAD_REQUEST, `status ต้องเป็น: ${allowed.join(', ')}`, 400);
    }
    const ref = doc(db, COL.TICKETS, req.params.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new AppError(ERR.NOT_FOUND, 'ไม่พบโพย', 404);
    const t: any = snap.data();
    if (t.settledAt && status !== 'settled') {
      throw new AppError(ERR.CONFLICT, 'โพยนี้ตัดสินรางวัลแล้ว แก้สถานะด้วยมือไม่ได้', 409);
    }
    await updateDoc(ref, { status, updatedAt: serverTimestamp() });
    ok(res, { id: req.params.id, status }, { message: `อัปเดตสถานะเป็น ${status} แล้ว` });
  }));

  return r;
}
