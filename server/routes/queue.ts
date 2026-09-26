/**
 * server/routes/queue.ts
 * ------------------------------------------------------------------
 * หมวด: ระบบคิว (Queue)
 * - เข้าคิวโพย (กรณีโหลดสูง / แทงพร้อมกันเยอะ)
 * - ดูสถานะคิว / ตำแหน่งคิว
 * - ประมวลผลคิว (worker / admin)
 */
import { Router } from 'express';
import {
  collection, getDocs, getDoc, doc, addDoc, updateDoc,
  query, where, serverTimestamp, orderBy, limit,
} from 'firebase/firestore';

export function queueRoutes(db: any) {
  const r = Router();

  // POST /api/v1/queue/enqueue — เข้าคิว (รับโพยไปประมวลผลทีหลัง)
  // body: { userId, lotteryType, bets, priority? }
  r.post('/enqueue', async (req, res) => {
    try {
      const { userId, lotteryType, bets, priority } = req.body;
      if (!userId || !lotteryType || !Array.isArray(bets)) {
        res.status(400).json({ status: 'error', message: 'ต้องระบุ userId, lotteryType, bets[]' }); return;
      }
      const totalAmount = bets.reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0);
      const ref = await addDoc(collection(db, 'bet_queue'), {
        userId, lotteryType, bets, totalAmount,
        priority: priority === 'high' ? 'high' : 'normal',
        status: 'queued',            // queued | processing | done | failed
        createdAt: new Date().toISOString(),
        source: 'api',
      });
      res.json({ status: 'success', queueId: ref.id, position: null, message: 'เข้าคิวแล้ว' });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'เข้าคิวไม่สำเร็จ' });
    }
  });

  // GET /api/v1/queue — ดูคิวทั้งหมด (admin)
  r.get('/', async (req, res) => {
    try {
      const { status } = req.query as any;
      const conds: any[] = [];
      if (status) conds.push(where('status', '==', status));
      const col = collection(db, 'bet_queue');
      const snap = await getDocs(conds.length ? query(col, ...conds) : col);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      list.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      res.json({ status: 'success', count: list.length, data: list });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงคิวไม่สำเร็จ' });
    }
  });

  // GET /api/v1/queue/:id — ดูสถานะคิว + ตำแหน่ง
  r.get('/:id', async (req, res) => {
    try {
      const snap = await getDoc(doc(db, 'bet_queue', req.params.id));
      if (!snap.exists()) { res.status(404).json({ status: 'error', message: 'ไม่พบคิวนี้' }); return; }

      // หาตำแหน่ง: นับคิวก่อนหน้าที่ status = queued
      const snapAll = await getDocs(query(collection(db, 'bet_queue'), where('status', '==', 'queued')));
      const queued = snapAll.docs.map(d => ({ id: d.id, createdAt: (d.data().createdAt || '') })) as any[];
      queued.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      const position = queued.findIndex(x => x.id === req.params.id) + 1;

      res.json({ status: 'success', data: { id: snap.id, ...snap.data(), position: position || null } });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงสถานะคิวไม่สำเร็จ' });
    }
  });

  // POST /api/v1/queue/:id/status — อัปเดตสถานะคิว
  // body: { status: 'processing'|'done'|'failed', error? }
  r.post('/:id/status', async (req, res) => {
    try {
      const { status, error } = req.body;
      if (!['queued', 'processing', 'done', 'failed'].includes(status)) {
        res.status(400).json({ status: 'error', message: 'status ไม่ถูกต้อง' }); return;
      }
      await updateDoc(doc(db, 'bet_queue', req.params.id), {
        status, error: error || null, updatedAt: serverTimestamp(),
      });
      res.json({ status: 'success', message: `อัปเดตสถานะคิวเป็น ${status} แล้ว` });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'อัปเดตไม่สำเร็จ' });
    }
  });

  // POST /api/v1/queue/process — ประมวลผลคิวทั้งหมด (worker: queued → tickets)
  r.post('/process', async (_req, res) => {
    try {
      const snap = await getDocs(query(collection(db, 'bet_queue'), where('status', '==', 'queued')));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      items.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

      let done = 0, failed = 0;
      for (const item of items.slice(0, 50)) {  // batch 50 ต่อครั้ง
        try {
          await updateDoc(doc(db, 'bet_queue', item.id), { status: 'processing', updatedAt: serverTimestamp() });
          const ref = await addDoc(collection(db, 'tickets'), {
            userId: item.userId, ticketType: item.lotteryType, bets: item.bets,
            totalAmount: item.totalAmount, status: 'confirmed',
            createdAt: new Date().toISOString(), source: 'api-queue',
          });
          await updateDoc(doc(db, 'bet_queue', item.id), { status: 'done', ticketId: ref.id, updatedAt: serverTimestamp() });
          done++;
        } catch (err: any) {
          await updateDoc(doc(db, 'bet_queue', item.id), { status: 'failed', error: String(err?.message || err), updatedAt: serverTimestamp() });
          failed++;
        }
      }
      res.json({ status: 'success', message: 'ประมวลผลคิวแล้ว', summary: { processed: done + failed, done, failed } });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ประมวลผลไม่สำเร็จ' });
    }
  });

  return r;
}
