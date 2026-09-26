/**
 * server/routes/users.ts
 * ------------------------------------------------------------------
 * หมวด: สมาชิก (Users) + เอเย่นต์ (Agents)
 * - ดู/สร้าง/แก้ไข/เปิด-ปิด สมาชิก
 * - ดู/จัดการเอเย่นต์ (เครดิต, คอมมิชชัน, สถานะ)
 */
import { Router } from 'express';
import {
  collection, getDocs, getDoc, doc, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';

export function userRoutes(db: any) {
  const r = Router();

  /* ============ สมาชิก (Users) ============ */

  // GET /api/v1/users — รายชื่อสมาชิก
  r.get('/', async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(d => {
        const x: any = d.data();
        return { id: d.id, uid: x.uid, username: x.username, balance: x.balance ?? 0, role: x.role, status: x.status ?? 'active', phoneNumber: x.phoneNumber };
      });
      res.json({ status: 'success', count: list.length, data: list });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงสมาชิกไม่สำเร็จ' });
    }
  });

  // GET /api/v1/users/:id — ดูสมาชิกเดียว
  r.get('/:id', async (req, res) => {
    try {
      const snap = await getDoc(doc(db, 'users', req.params.id));
      if (!snap.exists()) { res.status(404).json({ status: 'error', message: 'ไม่พบสมาชิก' }); return; }
      res.json({ status: 'success', data: { id: snap.id, ...snap.data() } });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงข้อมูลไม่สำเร็จ' });
    }
  });

  // POST /api/v1/users — สร้าง/อัปเดตสมาชิก
  // body: { id?, username, password?, phoneNumber?, role?, balance? }
  r.post('/', async (req, res) => {
    try {
      const { id, ...data } = req.body;
      if (id) {
        await setDoc(doc(db, 'users', id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
        res.json({ status: 'success', message: 'อัปเดตสมาชิกแล้ว', id });
      } else {
        if (!data.username) { res.status(400).json({ status: 'error', message: 'ต้องระบุ username' }); return; }
        const ref = await addDoc(collection(db, 'users'), {
          ...data, balance: data.balance ?? 0, role: data.role || 'user',
          status: 'active', createdAt: serverTimestamp(),
        });
        res.json({ status: 'success', message: 'สร้างสมาชิกแล้ว', id: ref.id });
      }
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'บันทึกไม่สำเร็จ' });
    }
  });

  // POST /api/v1/users/:id/toggle — เปิด/ปิดสมาชิก
  r.post('/:id/toggle', async (req, res) => {
    try {
      const active = req.body.active !== false;
      await updateDoc(doc(db, 'users', req.params.id), { status: active ? 'active' : 'suspended', updatedAt: serverTimestamp() });
      res.json({ status: 'success', message: `สมาชิกถูกตั้งเป็น ${active ? 'ใช้งาน' : 'ระงับ'}` });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ตั้งค่าไม่สำเร็จ' });
    }
  });

  return r;
}

export function agentRoutes(db: any) {
  const r = Router();

  // GET /api/v1/agents — รายชื่อเอเย่นต์
  r.get('/', async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, 'agents'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ status: 'success', count: list.length, data: list });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงเอเย่นต์ไม่สำเร็จ' });
    }
  });

  // POST /api/v1/agents — สร้าง/อัปเดตเอเย่นต์
  // body: { id, username, password?, phone?, credit?, commission?, share?, status? }
  r.post('/', async (req, res) => {
    try {
      const { id, ...data } = req.body;
      if (!id) { res.status(400).json({ status: 'error', message: 'ต้องระบุ id (username เอเย่นต์)' }); return; }
      await setDoc(doc(db, 'agents', id), {
        ...data, credit: data.credit ?? 0,
        commission: data.commission ?? 0, share: data.share ?? 0,
        status: data.status || 'active', updatedAt: serverTimestamp(),
      }, { merge: true });
      res.json({ status: 'success', message: 'บันทึกเอเย่นต์แล้ว', id });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'บันทึกไม่สำเร็จ' });
    }
  });

  // POST /api/v1/agents/:id/topup — เติมเครดิตให้เอเย่นต์
  r.post('/:id/topup', async (req, res) => {
    try {
      const amt = Number(req.body.amount);
      if (!amt) { res.status(400).json({ status: 'error', message: 'ต้องระบุ amount' }); return; }
      const ref = doc(db, 'agents', req.params.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) { res.status(404).json({ status: 'error', message: 'ไม่พบเอเย่นต์' }); return; }
      const credit = (snap.data().credit ?? 0) + amt;
      await updateDoc(ref, { credit, updatedAt: serverTimestamp() });
      res.json({ status: 'success', message: 'เติมเครดิตเอเย่นต์แล้ว', credit });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'เติมไม่สำเร็จ' });
    }
  });

  // POST /api/v1/agents/:id/toggle — เปิด/ปิดเอเย่นต์
  r.post('/:id/toggle', async (req, res) => {
    try {
      const active = req.body.active !== false;
      await updateDoc(doc(db, 'agents', req.params.id), { status: active ? 'active' : 'suspended', updatedAt: serverTimestamp() });
      res.json({ status: 'success', message: `เอเย่นต์ถูกตั้งเป็น ${active ? 'ใช้งาน' : 'ระงับ'}` });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ตั้งค่าไม่สำเร็จ' });
    }
  });

  return r;
}

export function apiKeyRoutes(db: any) {
  const r = Router();

  // GET /api/v1/keys — ดู API Keys ทั้งหมด (ปิดบังคีย์เต็ม)
  r.get('/', async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, 'api_keys'));
      const list = snap.docs.map(d => {
        const x: any = d.data();
        return { id: d.id, name: x.name, key: x.key ? `${x.key.substring(0, 15)}...` : '', status: x.status, scopes: x.scopes || null, lastUsed: x.lastUsed || null, createdAt: x.createdAt || null };
      });
      res.json({ status: 'success', count: list.length, data: list });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงคีย์ไม่สำเร็จ' });
    }
  });

  // POST /api/v1/keys — สร้าง API Key ใหม่
  // body: { name, scopes? }
  r.post('/', async (req, res) => {
    try {
      const { name, scopes } = req.body;
      if (!name) { res.status(400).json({ status: 'error', message: 'ต้องระบุ name' }); return; }
      const rand = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const key = `ak88_live_${rand}`;
      const ref = await addDoc(collection(db, 'api_keys'), {
        name, key, status: 'active', scopes: scopes || null,
        usageCount: 0, lastUsed: null, createdAt: serverTimestamp(), source: 'api',
      });
      res.json({ status: 'success', id: ref.id, key, message: 'สร้าง API Key แล้ว (เก็บคีย์นี้ไว้ให้ดี)' });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'สร้างคีย์ไม่สำเร็จ' });
    }
  });

  // POST /api/v1/keys/:id/toggle — เปิด/ปิดคีย์
  r.post('/:id/toggle', async (req, res) => {
    try {
      const active = req.body.active !== false;
      await updateDoc(doc(db, 'api_keys', req.params.id), { status: active ? 'active' : 'revoked' });
      res.json({ status: 'success', message: `คีย์ถูกตั้งเป็น ${active ? 'ใช้งาน' : 'ระงับ'}` });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ตั้งค่าไม่สำเร็จ' });
    }
  });

  // DELETE /api/v1/keys/:id — ลบคีย์
  r.delete('/:id', async (req, res) => {
    try {
      await deleteDoc(doc(db, 'api_keys', req.params.id));
      res.json({ status: 'success', message: 'ลบคีย์แล้ว' });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ลบไม่สำเร็จ' });
    }
  });

  return r;
}
