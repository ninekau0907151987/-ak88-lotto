/**
 * server/routes/lottery.ts
 * ------------------------------------------------------------------
 * หมวด: หวย (Lottery)
 * - ประเภทหวย: เปิด/ปิดรับแทง, อัตราจ่าย, เวลาเปิด-ปิด
 * - รอบหวย (rounds)
 * - เลขอั้น (blocked_numbers)
 * - ผลรางวัล (lotteryResults)
 */
import { Router } from 'express';
import {
  collection, getDocs, getDoc, doc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';

export function lotteryRoutes(db: any) {
  const r = Router();

  /* ============ ประเภทหวย (Lottery Types) ============ */

  // GET /api/v1/lottery/types — ดูประเภทหวยทั้งหมด
  r.get('/types', async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, 'lotteryTypes'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ status: 'success', count: list.length, data: list });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงประเภทหวยไม่สำเร็จ' });
    }
  });

  // GET /api/v1/lottery/types/:id — ดูประเภทหวยเดียว
  r.get('/types/:id', async (req, res) => {
    try {
      const snap = await getDoc(doc(db, 'lotteryTypes', req.params.id));
      if (!snap.exists()) { res.status(404).json({ status: 'error', message: 'ไม่พบประเภทหวยนี้' }); return; }
      res.json({ status: 'success', data: { id: snap.id, ...snap.data() } });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงข้อมูลไม่สำเร็จ' });
    }
  });

  // POST /api/v1/lottery/types — สร้าง/แก้ไขประเภทหวย (id = ชื่อหวย)
  r.post('/types', async (req, res) => {
    try {
      const { id, ...data } = req.body;
      if (!id) { res.status(400).json({ status: 'error', message: 'ต้องระบุ id (ชื่อหวย)' }); return; }
      await setDoc(doc(db, 'lotteryTypes', id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
      res.json({ status: 'success', message: 'บันทึกประเภทหวยแล้ว', id });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'บันทึกไม่สำเร็จ' });
    }
  });

  // POST /api/v1/lottery/types/:id/toggle — เปิด/ปิดรับแทงหวยตัวนี้
  // body: { open: true|false }  → status = 'open' | 'closed'
  r.post('/types/:id/toggle', async (req, res) => {
    try {
      const open = req.body.open !== false; // default true
      const newStatus = open ? 'open' : 'closed';
      await updateDoc(doc(db, 'lotteryTypes', req.params.id), {
        status: newStatus,
        bettingOpen: open,
        updatedAt: serverTimestamp(),
      });
      res.json({ status: 'success', message: `หวย ${req.params.id} ถูกตั้งเป็น ${open ? 'เปิดรับแทง' : 'ปิดรับแทง'}`, lotteryStatus: newStatus });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ตั้งค่าไม่สำเร็จ' });
    }
  });

  // POST /api/v1/lottery/types/:id/rates — ตั้งอัตราจ่าย
  // body: { rates: { '3ตัวบน': 900, '2ตัวล่าง': 90, ... } }
  r.post('/types/:id/rates', async (req, res) => {
    try {
      const { rates } = req.body;
      if (!rates || typeof rates !== 'object') { res.status(400).json({ status: 'error', message: 'ต้องส่ง rates เป็น object' }); return; }
      await updateDoc(doc(db, 'lotteryTypes', req.params.id), { rates, updatedAt: serverTimestamp() });
      res.json({ status: 'success', message: 'ตั้งอัตราจ่ายแล้ว', rates });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ตั้งอัตราจ่ายไม่สำเร็จ' });
    }
  });

  // DELETE /api/v1/lottery/types/:id — ลบประเภทหวยที่ไม่ต้องการ
  r.delete('/types/:id', async (req, res) => {
    try {
      await deleteDoc(doc(db, 'lotteryTypes', req.params.id));
      res.json({ status: 'success', message: `ลบประเภทหวย ${req.params.id} สำเร็จ` });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ลบประเภทหวยไม่สำเร็จ' });
    }
  });

  return r;
}

/**
 * หมวด: รอบหวย + เลขอั้น
 */
export function lotteryRoundRoutes(db: any) {
  const r = Router();

  /* ============ รอบหวย (Rounds) ============ */

  // GET /api/v1/rounds?type=thai — ดูรอบหวย
  r.get('/', async (req, res) => {
    try {
      const { type } = req.query;
      const col = collection(db, 'lotteryRounds');
      const snap = type ? await getDocs(query(col, where('lotteryType', '==', type))) : await getDocs(col);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ status: 'success', count: list.length, data: list });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงรอบหวยไม่สำเร็จ' });
    }
  });

  // POST /api/v1/rounds — สร้างรอบหวยใหม่
  // body: { lotteryType, roundNumber, openTime, closeTime, resultTime }
  r.post('/', async (req, res) => {
    try {
      const { lotteryType, roundNumber, openTime, closeTime, resultTime } = req.body;
      if (!lotteryType || !roundNumber) {
        res.status(400).json({ status: 'error', message: 'ต้องระบุ lotteryType และ roundNumber' }); return;
      }
      const ref = await addDoc(collection(db, 'lotteryRounds'), {
        lotteryType, roundNumber,
        openTime: openTime || null,
        closeTime: closeTime || null,
        resultTime: resultTime || null,
        status: 'open',            // open | closed | resulted
        createdAt: serverTimestamp(),
      });
      res.json({ status: 'success', message: 'สร้างรอบหวยแล้ว', id: ref.id });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'สร้างรอบไม่สำเร็จ' });
    }
  });

  // POST /api/v1/rounds/:id/close — ปิดรอบ
  r.post('/:id/close', async (req, res) => {
    try {
      await updateDoc(doc(db, 'lotteryRounds', req.params.id), { status: 'closed', closedAt: serverTimestamp() });
      res.json({ status: 'success', message: 'ปิดรอบแล้ว' });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ปิดรอบไม่สำเร็จ' });
    }
  });

  return r;
}

/**
 * หมวด: เลขอั้น (Blocked Numbers)
 */
export function blockedNumberRoutes(db: any) {
  const r = Router();

  // GET /api/v1/blocked?type=thai — ดูเลขอั้น
  r.get('/', async (req, res) => {
    try {
      const { type } = req.query;
      const col = collection(db, 'blocked_numbers');
      const snap = type ? await getDocs(query(col, where('lotteryType', '==', type))) : await getDocs(col);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ status: 'success', count: list.length, data: list });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงเลขอั้นไม่สำเร็จ' });
    }
  });

  // POST /api/v1/blocked — เพิ่มเลขอั้น
  // body: { lotteryType, number, betType, limit? }  betType = 'ทุกประเภท' หรือเจาะจง
  r.post('/', async (req, res) => {
    try {
      const { lotteryType, number, betType, limit } = req.body;
      if (!lotteryType || !number) {
        res.status(400).json({ status: 'error', message: 'ต้องระบุ lotteryType และ number' }); return;
      }
      const ref = await addDoc(collection(db, 'blocked_numbers'), {
        lotteryType, number,
        betType: betType || 'ทุกประเภท',
        limit: limit ?? null,     // ถ้า limit = รับได้ถึงจำนวนนี้, null = ห้ามเลย
        createdAt: serverTimestamp(),
      });
      res.json({ status: 'success', message: 'เพิ่มเลขอั้นแล้ว', id: ref.id });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'เพิ่มเลขอั้นไม่สำเร็จ' });
    }
  });

  // DELETE /api/v1/blocked/:id — ลบเลขอั้น
  r.delete('/:id', async (req, res) => {
    try {
      await deleteDoc(doc(db, 'blocked_numbers', req.params.id));
      res.json({ status: 'success', message: 'ลบเลขอั้นแล้ว' });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ลบไม่สำเร็จ' });
    }
  });

  return r;
}
