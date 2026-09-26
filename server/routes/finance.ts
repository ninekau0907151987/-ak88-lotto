/**
 * server/routes/finance.ts
 * ------------------------------------------------------------------
 * หมวด: การเงิน (Finance)
 * - เช็คเครดิต / เติมเครดิต (admin)
 * - ฝาก / ถอน (พร้อมระบบรออนุมัติ)
 * - ประวัติธุรกรรม
 */
import { Router } from 'express';
import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';

export function financeRoutes(db: any) {
  const r = Router();

  // GET /api/v1/finance/balance/:userId — เช็คเครดิต
  r.get('/balance/:userId', async (req, res) => {
    try {
      const snap = await getDoc(doc(db, 'users', req.params.userId));
      if (!snap.exists()) { res.status(404).json({ status: 'error', message: 'ไม่พบผู้ใช้' }); return; }
      const d = snap.data();
      res.json({ status: 'success', data: { userId: req.params.userId, username: d.username, balance: d.balance ?? 0 } });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'เช็คเครดิตไม่สำเร็จ' });
    }
  });

  // POST /api/v1/finance/topup — เติมเครดิต (admin/agent)
  // body: { userId, amount, note? }
  r.post('/topup', async (req, res) => {
    try {
      const { userId, amount, note } = req.body;
      const amt = Number(amount);
      if (!userId || !amt || amt <= 0) { res.status(400).json({ status: 'error', message: 'ต้องระบุ userId และ amount > 0' }); return; }
      const snap = await getDoc(doc(db, 'users', userId));
      if (!snap.exists()) { res.status(404).json({ status: 'error', message: 'ไม่พบผู้ใช้' }); return; }
      const bal = snap.data().balance ?? 0;
      await updateDoc(doc(db, 'users', userId), { balance: bal + amt, updatedAt: serverTimestamp() });
      await addDoc(collection(db, 'transactions'), {
        userId, type: 'topup', amount: amt, balanceAfter: bal + amt,
        status: 'success', note: note || 'เติมเครดิตโดยแอดมิน',
        createdAt: new Date().toISOString(), source: 'api',
      });
      res.json({ status: 'success', message: 'เติมเครดิตแล้ว', balanceAfter: bal + amt });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'เติมเครดิตไม่สำเร็จ' });
    }
  });

  // POST /api/v1/finance/deposit — สมาชิกแจ้งฝาก (รออนุมัติ)
  // body: { userId, amount, method?, slipUrl?, note? }
  r.post('/deposit', async (req, res) => {
    try {
      const { userId, amount, method, slipUrl, note } = req.body;
      const amt = Number(amount);
      if (!userId || !amt || amt <= 0) { res.status(400).json({ status: 'error', message: 'ต้องระบุ userId และ amount > 0' }); return; }

      const gSnap = await getDoc(doc(db, 'settings', 'global'));
      if (gSnap.exists() && gSnap.data().depositOpen === false) {
        res.status(403).json({ status: 'error', message: 'ระบบปิดรับฝากชั่วคราว' }); return;
      }

      const ref = await addDoc(collection(db, 'transactions'), {
        userId, type: 'deposit', amount: amt,
        method: method || 'transfer', slipUrl: slipUrl || null,
        status: 'pending',           // pending | approved | rejected
        note: note || '', direction: 'in',
        createdAt: new Date().toISOString(), source: 'api',
      });
      res.json({ status: 'success', id: ref.id, message: 'แจ้งฝากแล้ว รอแอดมินอนุมัติ' });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'แจ้งฝากไม่สำเร็จ' });
    }
  });

  // POST /api/v1/finance/withdraw — สมาชิกแจ้งถอน (รออนุมัติ)
  // body: { userId, amount, bankName?, bankAccount?, note? }
  r.post('/withdraw', async (req, res) => {
    try {
      const { userId, amount, bankName, bankAccount, note } = req.body;
      const amt = Number(amount);
      if (!userId || !amt || amt <= 0) { res.status(400).json({ status: 'error', message: 'ต้องระบุ userId และ amount > 0' }); return; }

      const gSnap = await getDoc(doc(db, 'settings', 'global'));
      if (gSnap.exists() && gSnap.data().withdrawOpen === false) {
        res.status(403).json({ status: 'error', message: 'ระบบปิดถอนชั่วคราว' }); return;
      }

      const uSnap = await getDoc(doc(db, 'users', userId));
      if (!uSnap.exists()) { res.status(404).json({ status: 'error', message: 'ไม่พบผู้ใช้' }); return; }
      const bal = uSnap.data().balance ?? 0;
      if (bal < amt) { res.status(400).json({ status: 'error', message: 'เครดิตไม่พอถอน', balance: bal }); return; }

      // ตัดเครดิตทันที (กันถอนซ้ำ) — ถ้าปฏิเสธค่อยคืน
      await updateDoc(doc(db, 'users', userId), { balance: bal - amt, updatedAt: serverTimestamp() });
      const ref = await addDoc(collection(db, 'transactions'), {
        userId, type: 'withdraw', amount: amt, balanceAfter: bal - amt,
        bankName: bankName || '', bankAccount: bankAccount || '',
        status: 'pending', note: note || '', direction: 'out',
        createdAt: new Date().toISOString(), source: 'api',
      });
      res.json({ status: 'success', id: ref.id, message: 'แจ้งถอนแล้ว รอแอดมินอนุมัติ', balanceAfter: bal - amt });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'แจ้งถอนไม่สำเร็จ' });
    }
  });

  // POST /api/v1/finance/transactions/:id/review — อนุมัติ/ปฏิเสธ (admin)
  // body: { action: 'approve'|'reject', note? }
  r.post('/transactions/:id/review', async (req, res) => {
    try {
      const { action, note } = req.body;
      if (!['approve', 'reject'].includes(action)) {
        res.status(400).json({ status: 'error', message: "action ต้องเป็น 'approve' หรือ 'reject'" }); return;
      }
      const ref = doc(db, 'transactions', req.params.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) { res.status(404).json({ status: 'error', message: 'ไม่พบธุรกรรม' }); return; }
      const t = snap.data();
      if (t.status !== 'pending') { res.status(400).json({ status: 'error', message: 'ธุรกรรมนี้ถูกดำเนินการแล้ว' }); return; }

      if (action === 'approve') {
        // ฝาก: บวกเครดิตตอนอนุมัติ
        if (t.type === 'deposit') {
          const uSnap = await getDoc(doc(db, 'users', t.userId));
          if (uSnap.exists()) {
            const bal = uSnap.data().balance ?? 0;
            await updateDoc(doc(db, 'users', t.userId), { balance: bal + (t.amount || 0), updatedAt: serverTimestamp() });
          }
        }
        await updateDoc(ref, { status: 'approved', reviewedAt: serverTimestamp(), reviewNote: note || '' });
        res.json({ status: 'success', message: 'อนุมัติแล้ว' });
      } else {
        // ถอนถูกปฏิเสธ: คืนเครดิต
        if (t.type === 'withdraw') {
          const uSnap = await getDoc(doc(db, 'users', t.userId));
          if (uSnap.exists()) {
            const bal = uSnap.data().balance ?? 0;
            await updateDoc(doc(db, 'users', t.userId), { balance: bal + (t.amount || 0), updatedAt: serverTimestamp() });
          }
        }
        await updateDoc(ref, { status: 'rejected', reviewedAt: serverTimestamp(), reviewNote: note || '' });
        res.json({ status: 'success', message: 'ปฏิเสธแล้ว (คืนเครดิตถ้าเป็นถอน)' });
      }
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดำเนินการไม่สำเร็จ' });
    }
  });

  // GET /api/v1/finance/transactions?userId=&type=&status= — ประวัติธุรกรรม
  r.get('/transactions', async (req, res) => {
    try {
      const { userId, type, status } = req.query;
      const conds: any[] = [];
      if (userId) conds.push(where('userId', '==', userId));
      if (type) conds.push(where('type', '==', type));
      if (status) conds.push(where('status', '==', status));
      const col = collection(db, 'transactions');
      const snap = await getDocs(conds.length ? query(col, ...conds) : col);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      res.json({ status: 'success', count: list.length, data: list });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงประวัติไม่สำเร็จ' });
    }
  });

  return r;
}
