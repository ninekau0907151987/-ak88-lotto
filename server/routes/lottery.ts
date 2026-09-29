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

  /* ============ ★ ระบบต้านทานอัตราจ่าย (Payout Rate Resistance) ★ ============ */

  // ค่ามาตรฐานระบบต้านทานอัตราจ่าย แยกตามหลัก (3 ตัว, 2 ตัว, วิ่ง/รัน, เลขปัก, 4-5 ตัว)
  const DEFAULT_RESISTANCE_RATES: Record<string, { baseRate: number; resistanceRate: number; maxExposure: number }> = {
    // กลุ่ม 3 ตัว
    '3 ตัวบน':   { baseRate: 900, resistanceRate: 800, maxExposure: 20000 },
    '3 ตัวโต๊ด': { baseRate: 150, resistanceRate: 120, maxExposure: 30000 },
    '3 ตัวหน้า': { baseRate: 450, resistanceRate: 400, maxExposure: 20000 },
    '3 ตัวล่าง': { baseRate: 450, resistanceRate: 400, maxExposure: 20000 },
    '3 ตัวกลับ': { baseRate: 900, resistanceRate: 800, maxExposure: 20000 },

    // กลุ่ม 2 ตัว
    '2 ตัวบน':   { baseRate: 90,  resistanceRate: 80,  maxExposure: 50000 },
    '2 ตัวล่าง': { baseRate: 90,  resistanceRate: 80,  maxExposure: 50000 },
    '2 ตัวกลับ': { baseRate: 90,  resistanceRate: 80,  maxExposure: 50000 },
    '2 ตัวโต๊ด': { baseRate: 12,  resistanceRate: 10,  maxExposure: 60000 },

    // กลุ่มเลขวิ่ง / เลขรัน
    'วิ่งบน':    { baseRate: 3.2, resistanceRate: 2.8, maxExposure: 100000 },
    'วิ่งล่าง':  { baseRate: 4.2, resistanceRate: 3.8, maxExposure: 100000 },

    // กลุ่มเลขปักหลัก
    'ปักหลักหน่วย': { baseRate: 8.0, resistanceRate: 7.0, maxExposure: 50000 },
    'ปักหลักสิบ':   { baseRate: 8.0, resistanceRate: 7.0, maxExposure: 50000 },
    'ปักหลักร้อย':  { baseRate: 8.0, resistanceRate: 7.0, maxExposure: 50000 },

    // กลุ่ม 4-5 ตัว
    '4 ตัวบน':   { baseRate: 5000, resistanceRate: 4000, maxExposure: 10000 },
    '4 ตัวโต๊ด': { baseRate: 25,   resistanceRate: 20,   maxExposure: 50000 },
    '5 ตัวโต๊ด': { baseRate: 15,   resistanceRate: 12,   maxExposure: 50000 },
  };

  // GET /api/v1/lottery/resistance — ดูการตั้งค่าระบบต้านทานอัตราจ่ายทั้งหมด
  r.get('/resistance', async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, 'payout_resistance'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({
        status: 'success',
        count: list.length,
        defaultRates: DEFAULT_RESISTANCE_RATES,
        data: list,
      });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงข้อมูลระบบต้านทานอัตราจ่ายไม่สำเร็จ' });
    }
  });

  // GET /api/v1/lottery/resistance/:id — ดูการตั้งค่าต้านทานของหวยประเภทนี้ (id = ชื่อหวย)
  r.get('/resistance/:id', async (req, res) => {
    try {
      const snap = await getDoc(doc(db, 'payout_resistance', req.params.id));
      if (snap.exists()) {
        res.json({ status: 'success', data: { id: snap.id, ...snap.data() } });
      } else {
        // ถ้ายังไม่มี ให้คืนค่า Default พร้อมใช้งาน
        res.json({
          status: 'success',
          isDefault: true,
          data: {
            id: req.params.id,
            lotteryId: req.params.id,
            enabled: true,
            autoReduceOnExposure: true,
            rates: DEFAULT_RESISTANCE_RATES,
          }
        });
      }
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงข้อมูลระบบต้านทานหวยไม่สำเร็จ' });
    }
  });

  // POST /api/v1/lottery/resistance/:id — บันทึก/อัปเดตระบบต้านทานอัตราจ่ายแยกตามหลัก
  r.post('/resistance/:id', async (req, res) => {
    try {
      const { rates, enabled, autoReduceOnExposure } = req.body;
      const dataToSave = {
        id: req.params.id,
        lotteryId: req.params.id,
        enabled: enabled !== false,
        autoReduceOnExposure: autoReduceOnExposure !== false,
        rates: rates || DEFAULT_RESISTANCE_RATES,
        updatedAt: serverTimestamp(),
      };
      
      await setDoc(doc(db, 'payout_resistance', req.params.id), dataToSave, { merge: true });

      // ซิงค์เรทพื้นฐานไปยัง lotteryTypes ด้วยเพื่อให้หน้าบ้านดึงไปใช้ได้ทันที
      if (rates && typeof rates === 'object') {
        const flatRates: Record<string, number> = {};
        Object.keys(rates).forEach(k => {
          flatRates[k] = rates[k]?.baseRate || rates[k];
        });
        await setDoc(doc(db, 'lotteryTypes', req.params.id), {
          rates: flatRates,
          hasResistance: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      res.json({
        status: 'success',
        message: `บันทึกระบบต้านทานอัตราจ่ายสำหรับ ${req.params.id} สำเร็จ`,
        data: dataToSave,
      });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'บันทึกระบบต้านทานอัตราจ่ายไม่สำเร็จ' });
    }
  });

  // POST /api/v1/lottery/resistance/batch — นำการตั้งค่าระบบต้านทานไปใช้กับหวยทุกประเภท
  r.post('/resistance/batch', async (req, res) => {
    try {
      const { rates, enabled, autoReduceOnExposure } = req.body;
      const typesSnap = await getDocs(collection(db, 'lotteryTypes'));
      const batchPromises = typesSnap.docs.map(async (d) => {
        const id = d.id;
        await setDoc(doc(db, 'payout_resistance', id), {
          id,
          lotteryId: id,
          enabled: enabled !== false,
          autoReduceOnExposure: autoReduceOnExposure !== false,
          rates: rates || DEFAULT_RESISTANCE_RATES,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });

      await Promise.all(batchPromises);
      res.json({
        status: 'success',
        message: `นำระบบต้านทานอัตราจ่ายไปใช้กับหวยทั้งหมด ${typesSnap.docs.length} ประเภทสำเร็จ`,
      });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ใช้การตั้งค่าต้านทานกับทุกหวยไม่สำเร็จ' });
    }
  });

  // POST /api/v1/lottery/resistance/calculate — ตรวจสอบและคำนวณอัตราจ่ายจริงตามยอดรับแทงสะสม
  // body: { lotteryType, betType, number, requestedAmount }
  r.post('/resistance/calculate', async (req, res) => {
    try {
      const { lotteryType, betType, number, requestedAmount = 10 } = req.body;
      if (!lotteryType || !betType) {
        res.status(400).json({ status: 'error', message: 'ต้องระบุ lotteryType และ betType' });
        return;
      }

      const snap = await getDoc(doc(db, 'payout_resistance', lotteryType));
      const config = snap.exists() ? snap.data() : { enabled: true, rates: DEFAULT_RESISTANCE_RATES };
      const rateConfig = config.rates?.[betType] || DEFAULT_RESISTANCE_RATES[betType] || { baseRate: 90, resistanceRate: 80, maxExposure: 50000 };

      // ตรวจสอบยอดแทงสะสมปัจจุบันของเลขนี้ในรอบปัจจุบัน
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
      const isResisted = Boolean(config.enabled && willExceed);
      const finalRate = isResisted ? rateConfig.resistanceRate : rateConfig.baseRate;

      res.json({
        status: 'success',
        lotteryType,
        betType,
        number,
        currentExposure,
        maxExposure: rateConfig.maxExposure,
        isResisted,
        baseRate: rateConfig.baseRate,
        resistanceRate: rateConfig.resistanceRate,
        finalPayoutRate: finalRate,
        reductionPercent: isResisted ? Math.round((1 - finalRate / rateConfig.baseRate) * 100) : 0,
      });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'คำนวณการต้านทานอัตราจ่ายไม่สำเร็จ' });
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
