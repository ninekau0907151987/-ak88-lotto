/**
 * server/routes/v1/public.routes.ts
 * ------------------------------------------------------------------
 * ★ หมวดเส้นสาธารณะ (Public Gateway: /api/v1/public/*) ★
 * สำหรับสมาชิกทั่วไปและหน้าเว็บ — ไม่ต้องใช้ API Key ของแอดมินเด็ดขาด
 *
 * ประกอบด้วย:
 * 1. แทงลง / โพยหวย:    /betting (preview, bet, tickets, summary, cancel)
 * 2. ข้อมูลหวย & เรท:    /lottery (types, resistance, calculate)
 * 3. รอบหวย & ปฏิทิน:   /rounds (list, calendar)
 * 4. เลขอั้น:           /blocked (list)
 * 5. ผลรางวัล:          /results (list, latest)
 * 6. หวยจับยี่กีสาธารณะ:  /yeekee (rounds, config, shoots, shoot)
 * 7. การเงินหน้าบ้าน:     /finance (slip/verify, withdraw, balance, deposit)
 * 8. สมาชิก & OTP:      /auth (otp/send, otp/verify, password/reset)
 * 9. สถานะระบบ:         /system (status)
 */

import { Router } from 'express';
import {
  collection, getDocs, getDoc, doc, query, where
} from 'firebase/firestore';
import { COL } from '../../config/collections';
import { asyncHandler } from '../../middleware/error-handler';
import { ok, okList, fail } from '../../lib/response';
import { bettingRoutes } from './betting.routes';
import { YeekeeService } from '../../domains/yeekee/yeekee.service';
import { getRoundsCalendar } from '../../domains/lottery/scheduler.service';

export function createPublicRouter(db: any): Router {
  const router = Router();

  // ================================================================
  // 1. แทงลง / โพยหวย (Member Betting & Tickets)
  //    - POST /api/v1/public/betting/preview (คำนวณเงิน + เช็คเลขอั้นก่อนแทง)
  //    - POST /api/v1/public/betting/bet (ส่งโพยจริง ตัดเครดิต)
  //    - GET  /api/v1/public/betting/tickets (ดูโพย)
  //    - GET  /api/v1/public/betting/summary (สรุปโพย)
  //    - GET  /api/v1/public/betting/tickets/:id (ดูโพยเดียว)
  //    - POST /api/v1/public/betting/tickets/:id/cancel (ยกเลิกโพย)
  // ================================================================
  router.use('/betting', bettingRoutes(db));

  // ================================================================
  // 2. ข้อมูลประเภทหวย & อัตราต้านทาน (Lottery Types & Rates)
  // ================================================================
  const lotteryRouter = Router();

  // GET /api/v1/public/lottery/types — รายการประเภทหวยทั้งหมด
  lotteryRouter.get('/types', asyncHandler(async (_req, res) => {
    const snap = await getDocs(collection(db, 'lotteryTypes'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    ok(res, list, { count: list.length });
  }));

  // GET /api/v1/public/lottery/types/:id — รายละเอียดประเภทหวย
  lotteryRouter.get('/types/:id', asyncHandler(async (req, res) => {
    const snap = await getDoc(doc(db, 'lotteryTypes', req.params.id));
    if (!snap.exists()) {
      return fail(res, 404, 'NOT_FOUND', 'ไม่พบประเภทหวยนี้');
    }
    ok(res, { id: snap.id, ...snap.data() });
  }));

  // GET /api/v1/public/lottery/resistance — ข้อมูลระบบต้านทานอัตราจ่าย
  lotteryRouter.get('/resistance', asyncHandler(async (_req, res) => {
    const snap = await getDocs(collection(db, 'payout_resistance'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    ok(res, list, { count: list.length });
  }));

  // GET /api/v1/public/lottery/resistance/:id — ข้อมูลต้านทานรายหวย
  lotteryRouter.get('/resistance/:id', asyncHandler(async (req, res) => {
    const snap = await getDoc(doc(db, 'payout_resistance', req.params.id));
    if (snap.exists()) {
      ok(res, { id: snap.id, ...snap.data() });
    } else {
      ok(res, { id: req.params.id, isDefault: true, enabled: true });
    }
  }));

  // POST /api/v1/public/lottery/resistance/calculate — คำนวณอัตราจ่ายตามยอดแทง
  lotteryRouter.post('/resistance/calculate', asyncHandler(async (req, res) => {
    const { lotteryType, betType, number, requestedAmount = 10 } = req.body || {};
    if (!lotteryType || !betType) {
      return fail(res, 400, 'BAD_REQUEST', 'ต้องระบุ lotteryType และ betType');
    }
    const snap = await getDoc(doc(db, 'payout_resistance', lotteryType));
    const config = snap.exists() ? snap.data() : { enabled: true };
    const rateConfig = config?.rates?.[betType] || { baseRate: 90, resistanceRate: 80, maxExposure: 50000 };

    const ticketsQuery = query(
      collection(db, 'tickets'),
      where('lotteryType', '==', lotteryType),
      where('status', 'in', ['active', 'confirmed', 'pending_cancellation'])
    );
    const ticketsSnap = await getDocs(ticketsQuery);
    let currentExposure = 0;
    ticketsSnap.docs.forEach(d => {
      const data = d.data();
      (data.bets || []).forEach((b: any) => {
        if (b.type === betType && (!number || b.number === number)) {
          currentExposure += (Number(b.amount) || 0);
        }
      });
    });

    const willExceed = (currentExposure + requestedAmount) > rateConfig.maxExposure;
    const isResisted = Boolean(config?.enabled && willExceed);
    const finalRate = isResisted ? rateConfig.resistanceRate : rateConfig.baseRate;

    ok(res, {
      lotteryType,
      betType,
      number,
      currentExposure,
      maxExposure: rateConfig.maxExposure,
      isResisted,
      baseRate: rateConfig.baseRate,
      resistanceRate: rateConfig.resistanceRate,
      finalPayoutRate: finalRate,
    });
  }));

  router.use('/lottery', lotteryRouter);

  // ================================================================
  // 3. รอบหวย & ปฏิทินรอบ (Rounds & Calendar)
  // ================================================================
  const roundsRouter = Router();

  // GET /api/v1/public/rounds — ดูรอบหวย
  roundsRouter.get('/', asyncHandler(async (req, res) => {
    const { type } = req.query;
    const col = collection(db, 'lotteryRounds');
    const snap = type ? await getDocs(query(col, where('lotteryType', '==', type))) : await getDocs(col);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    ok(res, list, { count: list.length });
  }));

  // GET /api/v1/public/rounds/calendar — ข้อมูลปฏิทินรอบหวย
  roundsRouter.get('/calendar', asyncHandler(async (req, res) => {
    const { type } = req.query as any;
    const data = await getRoundsCalendar(db, type);
    ok(res, data);
  }));

  router.use('/rounds', roundsRouter);

  // ================================================================
  // 4. เลขอั้นสาธารณะ (Blocked Numbers)
  // ================================================================
  router.get('/blocked', asyncHandler(async (req, res) => {
    const { type } = req.query;
    const col = collection(db, 'blocked_numbers');
    const snap = type ? await getDocs(query(col, where('lotteryType', '==', type))) : await getDocs(col);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    ok(res, list, { count: list.length });
  }));

  // ================================================================
  // 5. ผลรางวัล (Lottery Results)
  // ================================================================
  const resultsRouter = Router();

  // GET /api/v1/public/results — ดูผลรางวัล
  resultsRouter.get('/', asyncHandler(async (req, res) => {
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

  // GET /api/v1/public/results/latest — ดูผลรางวัลงวดล่าสุด
  resultsRouter.get('/latest', asyncHandler(async (req, res) => {
    const { type, lotterySlug } = req.query as any;
    const slug = lotterySlug || type;
    const col = collection(db, COL.LOTTERY_RESULTS);
    const snap = slug ? await getDocs(query(col, where('lotteryType', '==', slug))) : await getDocs(col);
    const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    ok(res, list[0] || null);
  }));

  router.use('/results', resultsRouter);

  // ================================================================
  // 6. หวยจับยี่กีสาธารณะ (Yeekee Rounds, Shoots, Shoot Action)
  // ================================================================
  const yeekeeRouter = Router();
  const yeekeeService = new YeekeeService(db);

  // GET /api/v1/public/yeekee/rounds — 88 รอบของวันนี้
  yeekeeRouter.get('/rounds', asyncHandler(async (req, res) => {
    const { date } = req.query as { date?: string };
    const rounds = await yeekeeService.getRounds(date);
    ok(res, rounds);
  }));

  // GET /api/v1/public/yeekee/config — กติกาและอัตราจ่าย
  yeekeeRouter.get('/config', asyncHandler(async (_req, res) => {
    const config = await yeekeeService.getConfig();
    ok(res, config);
  }));

  // GET /api/v1/public/yeekee/shoots/:roundId — รายการยิงเลข
  yeekeeRouter.get('/shoots/:roundId', asyncHandler(async (req, res) => {
    const roundId = parseInt(req.params.roundId, 10);
    const { date } = req.query as { date?: string };
    const shoots = await yeekeeService.getShoots(roundId, date);
    ok(res, shoots);
  }));

  // POST /api/v1/public/yeekee/shoot — สมาชิกร่วมยิงเลข 5 หลัก
  yeekeeRouter.post('/shoot', asyncHandler(async (req, res) => {
    const { roundId, userId, username, number, date } = req.body || {};
    if (!roundId || !number) {
      return fail(res, 400, 'BAD_REQUEST', 'ต้องระบุ roundId และ number');
    }
    const shoot = await yeekeeService.shootNumber(
      Number(roundId),
      userId || 'guest',
      username || 'สมาชิก',
      String(number),
      date
    );
    ok(res, shoot, { message: 'ยิงเลขสำเร็จ' });
  }));

  router.use('/yeekee', yeekeeRouter);

  // ================================================================
  // 7. การเงินหน้าบ้าน & สมาชิก (Public Finance & Wallet)
  // ================================================================
  const financeRouter = Router();

  // POST /api/v1/public/finance/slip/verify — ตรวจสลิปฝากเงินอัตโนมัติ
  financeRouter.post('/slip/verify', asyncHandler(async (req, res) => {
    const { verifyAndCreditSlip } = await import('../../domains/finance/finance.service');
    const out = await verifyAndCreditSlip(db, req.body || {});
    ok(res, out, { message: out.message });
  }));

  // POST /api/v1/public/finance/withdraw — แจ้งถอนเงิน
  financeRouter.post('/withdraw', asyncHandler(async (req, res) => {
    const { requestWithdraw } = await import('../../domains/finance/finance.service');
    const out = await requestWithdraw(db, req.body || {});
    ok(res, out, { message: 'ส่งคำขอถอนเงินเรียบร้อยแล้ว รอระบบประมวลผล' });
  }));

  // POST /api/v1/public/finance/deposit — แจ้งฝากเงิน
  financeRouter.post('/deposit', asyncHandler(async (req, res) => {
    const { requestDeposit } = await import('../../domains/finance/finance.service');
    const { userId, amount, slipUrl, bankAccountId, method, note } = req.body || {};
    const out = await requestDeposit(db, {
      userId,
      amount: Number(amount) || 0,
      slipUrl,
      method: method || 'transfer',
      note: note || (bankAccountId ? `บัญชี: ${bankAccountId}` : undefined),
    });
    ok(res, out, { message: 'ส่งคำขอฝากเงินเรียบร้อยแล้ว รอตรวจสอบ' });
  }));

  // GET /api/v1/public/finance/balance/:userId — เช็คยอดเงินคงเหลือ
  financeRouter.get('/balance/:userId', asyncHandler(async (req, res) => {
    const { wallet } = await import('../../lib/wallet');
    const balance = await wallet.peek(db, req.params.userId);
    ok(res, { userId: req.params.userId, balance, status: 'active' });
  }));

  router.use('/finance', financeRouter);

  // ================================================================
  // 8. สมาชิก & ระบบ OTP (Auth & Reset Password)
  // ================================================================
  const authRouter = Router();

  authRouter.post('/otp/send', asyncHandler(async (req, res) => {
    const { sendOtp } = await import('../../domains/auth/otp.service');
    const out = await sendOtp(req.body?.phone || req.body?.phoneNumber);
    ok(res, out, { message: out.message });
  }));

  authRouter.post('/otp/verify', asyncHandler(async (req, res) => {
    const { verifyOtp } = await import('../../domains/auth/otp.service');
    const out = await verifyOtp(req.body?.phone || req.body?.phoneNumber, req.body?.code);
    ok(res, out, { message: out.message });
  }));

  authRouter.post('/password/reset', asyncHandler(async (req, res) => {
    const { resetPasswordWithOtp } = await import('../../domains/auth/otp.service');
    const out = await resetPasswordWithOtp(
      db,
      req.body?.phone || req.body?.phoneNumber,
      req.body?.code,
      req.body?.newPassword
    );
    ok(res, out, { message: out.message });
  }));

  router.use('/auth', authRouter);

  // ================================================================
  // 9. สถานะระบบภาพรวม (System Status)
  // ================================================================
  router.get('/system/status', asyncHandler(async (_req, res) => {
    const snap = await getDoc(doc(db, 'settings', 'global'));
    const data = snap.exists() ? snap.data() : {};
    ok(res, {
      systemOpen: data.systemOpen ?? true,
      bettingOpen: data.bettingOpen ?? true,
      depositOpen: data.depositOpen ?? true,
      withdrawOpen: data.withdrawOpen ?? true,
      registerOpen: data.registerOpen ?? true,
      maintenanceMessage: data.maintenanceMessage || '',
      serverTime: new Date().toISOString(),
    });
  }));

  return router;
}
