/**
 * server/routes/system.ts
 * ------------------------------------------------------------------
 * หมวด: ระบบ (System)
 * เปิด/ปิดระบบ, ดูสถานะระบบ, ตั้งค่าทั่วไป, เปิด/ปิดรับแทงทั้งระบบ
 */
import { Router } from 'express';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

export function systemRoutes(db: any) {
  const r = Router();

  // GET /api/v1/system/status — ดูสถานะระบบ
  r.get('/status', async (_req, res) => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'global'));
      const data = snap.exists() ? snap.data() : {};
      res.json({
        status: 'success',
        data: {
          systemOpen: data.systemOpen ?? true,          // เปิด/ปิดระบบทั้งระบบ
          bettingOpen: data.bettingOpen ?? true,        // เปิด/ปิดรับแทง
          depositOpen: data.depositOpen ?? true,        // เปิด/ปิดฝาก
          withdrawOpen: data.withdrawOpen ?? true,      // เปิด/ปิดถอน
          registerOpen: data.registerOpen ?? true,      // เปิด/ปิดสมัครสมาชิก
          maintenanceMessage: data.maintenanceMessage || '',
          serverTime: new Date().toISOString(),
        },
      });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงสถานะระบบไม่สำเร็จ' });
    }
  });

  // POST /api/v1/system/toggle — เปิด/ปิดสวิตช์ระบบ
  // body: { key: 'bettingOpen' | 'depositOpen' | ..., value: true|false, message?: string }
  r.post('/toggle', async (req, res) => {
    try {
      const { key, value, message } = req.body;
      const allowed = ['systemOpen', 'bettingOpen', 'depositOpen', 'withdrawOpen', 'registerOpen'];
      if (!allowed.includes(key)) {
        res.status(400).json({ status: 'error', message: `key ต้องเป็นหนึ่งใน: ${allowed.join(', ')}` });
        return;
      }
      const patch: any = { [key]: !!value, updatedAt: serverTimestamp() };
      if (message !== undefined) patch.maintenanceMessage = message;

      await setDoc(doc(db, 'settings', 'global'), patch, { merge: true });
      res.json({ status: 'success', message: `ตั้งค่า ${key} = ${!!value} เรียบร้อย`, data: patch });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ตั้งค่าไม่สำเร็จ' });
    }
  });

  // GET /api/v1/system/settings — ดู setting ทั้งหมด
  r.get('/settings', async (_req, res) => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'global'));
      res.json({ status: 'success', data: snap.exists() ? snap.data() : {} });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงข้อมูลไม่สำเร็จ' });
    }
  });

  // POST /api/v1/system/settings — อัปเดต setting (merge)
  r.post('/settings', async (req, res) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), { ...req.body, updatedAt: serverTimestamp() }, { merge: true });
      res.json({ status: 'success', message: 'บันทึกการตั้งค่าแล้ว' });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'บันทึกไม่สำเร็จ' });
    }
  });

  return r;
}
