/**
 * server/routes/betting.ts
 * ------------------------------------------------------------------
 * หมวด: แทง/เล่น (Betting)
 * - ส่งโพย (bet) พร้อมเช็คเครดิต + เลขอั้น + เปิด-ปิดรับแทง
 * - ดูโพย / ยกเลิกโพย
 * - คำนวณเงินก่อนแทง (preview)
 */
import { Router } from 'express';
import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';

/** ตรวจว่าเลขนี้ถูกอั้นหรือไม่ */
async function findBlocked(db: any, lotteryType: string, bets: any[]) {
  const snap = await getDocs(query(collection(db, 'blocked_numbers'), where('lotteryType', '==', lotteryType)));
  const blocked = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
  for (const bet of bets) {
    const hit = blocked.find(b =>
      String(b.number) === String(bet.number) &&
      (b.betType === 'ทุกประเภท' || b.betType === bet.type)
    );
    if (hit) return { number: bet.number, type: bet.type };
  }
  return null;
}

export function bettingRoutes(db: any) {
  const r = Router();

  // POST /api/v1/betting/preview — คำนวณเงิน + เช็คเลข + เช็คเครดิต (ไม่บันทึก)
  r.post('/preview', async (req, res) => {
    try {
      const { lotteryType, userId, bets } = req.body;
      if (!lotteryType || !userId || !Array.isArray(bets) || bets.length === 0) {
        res.status(400).json({ status: 'error', message: 'ต้องระบุ lotteryType, userId และ bets[]' }); return;
      }
      const totalAmount = bets.reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0);
      const blocked = await findBlocked(db, lotteryType, bets);
      const snap = await getDoc(doc(db, 'users', userId));
      const balance = snap.exists() ? (snap.data().balance ?? 0) : 0;

      res.json({
        status: 'success',
        data: { totalAmount, balance, sufficient: balance >= totalAmount, blockedNumber: blocked },
      });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'คำนวณไม่สำเร็จ' });
    }
  });

  // POST /api/v1/betting/bet — ส่งโพย (ตัดเครดิตจริง)
  r.post('/bet', async (req, res) => {
    try {
      const { lotteryType, userId, bets, roundId } = req.body;
      if (!lotteryType || !userId || !Array.isArray(bets) || bets.length === 0) {
        res.status(400).json({ status: 'error', message: 'ต้องระบุ lotteryType, userId และ bets[]' }); return;
      }

      // 1) เช็คระบบเปิดรับแทงไหม
      const gSnap = await getDoc(doc(db, 'settings', 'global'));
      const g = gSnap.exists() ? gSnap.data() : {};
      if (g.systemOpen === false || g.bettingOpen === false) {
        res.status(403).json({ status: 'error', code: 'BETTING_CLOSED', message: 'ระบบปิดรับแทงชั่วคราว' }); return;
      }

      // 2) เช็คหวยตัวนี้เปิดรับแทงไหม
      const tSnap = await getDoc(doc(db, 'lotteryTypes', lotteryType));
      if (tSnap.exists()) {
        const t = tSnap.data();
        if (t.status === 'closed' || t.bettingOpen === false) {
          res.status(403).json({ status: 'error', code: 'LOTTERY_CLOSED', message: `หวย ${lotteryType} ปิดรับแทง` }); return;
        }
      }

      // 3) เช็คเลขอั้น
      const blocked = await findBlocked(db, lotteryType, bets);
      if (blocked) {
        res.status(400).json({ status: 'error', code: 'NUMBER_BLOCKED', message: `เลข ${blocked.number} (${blocked.type}) ถูกอั้น`, blocked }); return;
      }

      // 4) เช็คเครดิต + ตัดเครดิต
      const totalAmount = bets.reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0);
      const uSnap = await getDoc(doc(db, 'users', userId));
      if (!uSnap.exists()) { res.status(404).json({ status: 'error', message: 'ไม่พบผู้ใช้นี้' }); return; }
      const balance = uSnap.data().balance ?? 0;
      if (balance < totalAmount) {
        res.status(400).json({ status: 'error', code: 'INSUFFICIENT_CREDIT', message: 'เครดิตไม่พอ', balance, required: totalAmount }); return;
      }
      await updateDoc(doc(db, 'users', userId), { balance: balance - totalAmount, updatedAt: serverTimestamp() });

      // 5) บันทึกโพย
      const ticket = {
        userId, ticketType: lotteryType, roundId: roundId || null,
        bets, totalAmount,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        source: 'api',
      };
      const ref = await addDoc(collection(db, 'tickets'), ticket);

      // 6) บันทึกธุรกรรม
      await addDoc(collection(db, 'transactions'), {
        userId, type: 'bet', amount: -totalAmount,
        balanceAfter: balance - totalAmount,
        status: 'success', ref: ref.id, note: `แทงหวย ${lotteryType}`,
        createdAt: new Date().toISOString(), source: 'api',
      });

      res.json({ status: 'success', ticketId: ref.id, totalAmount, balanceAfter: balance - totalAmount, message: 'ส่งโพยสำเร็จ' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ status: 'error', message: 'ส่งโพยไม่สำเร็จ' });
    }
  });

  // GET /api/v1/betting/tickets?userId=&status= — ดูโพยของผู้ใช้
  r.get('/tickets', async (req, res) => {
    try {
      const { userId, status } = req.query;
      let q: any = collection(db, 'tickets');
      const conds: any[] = [];
      if (userId) conds.push(where('userId', '==', userId));
      if (status) conds.push(where('status', '==', status));
      const snap = await getDocs(conds.length ? query(q, ...conds) : q);
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      res.json({ status: 'success', count: list.length, data: list });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงโพยไม่สำเร็จ' });
    }
  });

  // GET /api/v1/betting/tickets/:id — ดูโพยเดียว
  r.get('/tickets/:id', async (req, res) => {
    try {
      const snap = await getDoc(doc(db, 'tickets', req.params.id));
      if (!snap.exists()) { res.status(404).json({ status: 'error', message: 'ไม่พบโพย' }); return; }
      res.json({ status: 'success', data: { id: snap.id, ...snap.data() } });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงโพยไม่สำเร็จ' });
    }
  });

  // POST /api/v1/betting/tickets/:id/cancel — ยกเลิกโพย (คืนเครดิต)
  r.post('/tickets/:id/cancel', async (req, res) => {
    try {
      const ref = doc(db, 'tickets', req.params.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) { res.status(404).json({ status: 'error', message: 'ไม่พบโพย' }); return; }
      const t = snap.data();
      if (t.status === 'cancelled') { res.status(400).json({ status: 'error', message: 'โพยนี้ถูกยกเลิกแล้ว' }); return; }

      // คืนเครดิต
      const uSnap = await getDoc(doc(db, 'users', t.userId));
      if (uSnap.exists()) {
        const bal = uSnap.data().balance ?? 0;
        await updateDoc(doc(db, 'users', t.userId), { balance: bal + (t.totalAmount || 0), updatedAt: serverTimestamp() });
        await addDoc(collection(db, 'transactions'), {
          userId: t.userId, type: 'refund', amount: t.totalAmount || 0,
          balanceAfter: bal + (t.totalAmount || 0),
          status: 'success', ref: req.params.id, note: 'ยกเลิกโพยคืนเครดิต',
          createdAt: new Date().toISOString(), source: 'api',
        });
      }
      await updateDoc(ref, { status: 'cancelled', cancelledAt: serverTimestamp() });
      res.json({ status: 'success', message: 'ยกเลิกโพยและคืนเครดิตแล้ว' });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ยกเลิกไม่สำเร็จ' });
    }
  });

  // POST /api/v1/betting/tickets/:id/status — อัปเดตสถานะโพย (win/lose/confirmed)
  r.post('/tickets/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      const allowed = ['active', 'cancelled', 'confirmed', 'win', 'lose'];
      if (!allowed.includes(status)) { res.status(400).json({ status: 'error', message: `status ต้องเป็น: ${allowed.join(', ')}` }); return; }
      await updateDoc(doc(db, 'tickets', req.params.id), { status, updatedAt: serverTimestamp() });
      res.json({ status: 'success', message: `อัปเดตสถานะเป็น ${status} แล้ว` });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'อัปเดตไม่สำเร็จ' });
    }
  });

  return r;
}
