/**
 * server/routes/results.ts
 * ------------------------------------------------------------------
 * หมวด: ผลรางวัล (Results)
 * - บันทึก/ดึงผลรางวัล
 * - ตรวจรางวัลให้โพย (settle) → อัปเดตสถานะ win/lose + จ่ายเงิน
 */
import { Router } from 'express';
import {
  collection, getDocs, getDoc, doc, addDoc, setDoc, updateDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';

/** ตรวจว่าเลขในโพยถูกรางวัลไหม → คืนยอดเงินรางวัลรวม */
function evaluateBets(bets: any[], result: any): { payout: number; details: any[] } {
  // result: { top3, top2, bottom2, ... }  ปรับตามรูปแบบหวย
  const top3 = String(result.top3 ?? '');
  const top2 = String(result.top2 ?? '');
  const bottom2 = String(result.bottom2 ?? '');
  let payout = 0;
  const details: any[] = [];

  for (const b of bets) {
    const num = String(b.number ?? '');
    const rate = Number(b.rate) || 0;
    const amount = Number(b.amount) || 0;
    let won = false;

    switch (b.type) {
      case '3ตัวบน': won = top3 !== '' && num === top3; break;
      case '2ตัวบน': won = top2 !== '' && num === top2; break;
      case '2ตัวล่าง': won = bottom2 !== '' && num === bottom2; break;
      case '3ตัวโต๊ด': won = top3 !== '' && num.length === 3 && num.split('').sort().join('') === top3.split('').sort().join(''); break;
      default: won = false;
    }

    const winAmount = won ? amount * rate : 0;
    payout += winAmount;
    details.push({ number: num, type: b.type, amount, won, winAmount });
  }
  return { payout, details };
}

export function resultRoutes(db: any) {
  const r = Router();

  // GET /api/v1/results?type=thai&date= — ดึงผลรางวัล
  r.get('/', async (req, res) => {
    try {
      const { type, date } = req.query;
      const conds: any[] = [];
      if (type) conds.push(where('type', '==', type));
      const snap = await getDocs(conds.length ? query(collection(db, 'lotteryResults'), ...conds) : collection(db, 'lotteryResults'));
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      if (date) list = list.filter(x => String(x.createdAt || x.date || '').startsWith(String(date)));
      res.json({ status: 'success', count: list.length, data: list });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงผลรางวัลไม่สำเร็จ' });
    }
  });

  // POST /api/v1/results — บันทึกผลรางวัลใหม่
  // body: { type, name?, date, top3, top2, bottom2, ... }
  r.post('/', async (req, res) => {
    try {
      const { type, date, top3, top2, bottom2 } = req.body;
      if (!type) { res.status(400).json({ status: 'error', message: 'ต้องระบุ type (ประเภทหวย)' }); return; }
      const ref = await addDoc(collection(db, 'lotteryResults'), {
        ...req.body,
        date: date || new Date().toISOString().substring(0, 10),
        top3: top3 ?? '', top2: top2 ?? '', bottom2: bottom2 ?? '',
        createdAt: new Date().toISOString(),
        source: 'api',
      });
      res.json({ status: 'success', id: ref.id, message: 'บันทึกผลรางวัลแล้ว' });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'บันทึกไม่สำเร็จ' });
    }
  });

  // POST /api/v1/results/settle — ตรวจรางวัล + จ่ายเงินให้โพยทั้งหมดของหวย+รอบนั้น
  // body: { lotteryType, result: { top3, top2, bottom2 } }
  r.post('/settle', async (req, res) => {
    try {
      const { lotteryType, result } = req.body;
      if (!lotteryType || !result) {
        res.status(400).json({ status: 'error', message: 'ต้องระบุ lotteryType และ result' }); return;
      }

      // ดึงโพยที่ยังไม่ตัดสิน (confirmed/active) ของหวยนี้
      const snap = await getDocs(query(
        collection(db, 'tickets'),
        where('ticketType', '==', lotteryType),
      ));
      const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const pending = tickets.filter(t => t.status === 'confirmed' || t.status === 'active');

      let totalPayout = 0, winCount = 0, loseCount = 0, profit = 0;
      for (const t of pending) {
        const { payout, details } = evaluateBets(t.bets || [], result);
        const betTotal = Number(t.totalAmount) || 0;
        profit += betTotal - payout;

        if (payout > 0) {
          winCount++;
          // จ่ายเงินรางวัลเข้าผู้ใช้
          const uSnap = await getDoc(doc(db, 'users', t.userId));
          if (uSnap.exists()) {
            const bal = uSnap.data().balance ?? 0;
            await updateDoc(doc(db, 'users', t.userId), { balance: bal + payout, updatedAt: serverTimestamp() });
            await addDoc(collection(db, 'transactions'), {
              userId: t.userId, type: 'win', amount: payout, balanceAfter: bal + payout,
              status: 'success', ref: t.id, note: `ถูกรางวัล ${lotteryType}`,
              createdAt: new Date().toISOString(), source: 'api',
            });
          }
          await updateDoc(doc(db, 'tickets', t.id), { status: 'win', payout, winDetails: details, settledAt: serverTimestamp() });
          totalPayout += payout;
        } else {
          loseCount++;
          await updateDoc(doc(db, 'tickets', t.id), { status: 'lose', payout: 0, settledAt: serverTimestamp() });
        }
      }

      res.json({
        status: 'success',
        message: 'ตัดสินรางวัลเรียบร้อย',
        summary: { total: pending.length, winCount, loseCount, totalPayout, profit },
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ status: 'error', message: 'ตัดสินรางวัลไม่สำเร็จ' });
    }
  });

  return r;
}
