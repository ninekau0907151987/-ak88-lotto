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
import {
  getLotteryBetLimits, saveLotteryBetLimits,
  handleQuickNumberAction, calculateRiskLimits,
} from '../domains/lottery/betlimit.service';
import {
  scheduleRoundsBatch, getRoundsCalendar, verifySequentialRoundGuard,
} from '../domains/lottery/scheduler.service';

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
      await setDoc(doc(db, 'lotteryTypes', req.params.id), {
        id: req.params.id,
        name: req.params.id,
        status: newStatus,
        isOpen: open,
        bettingOpen: open,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      res.json({ status: 'success', message: `หวย ${req.params.id} ถูกตั้งเป็น ${open ? 'เปิดรับแทง' : 'ปิดรับแทง'}`, lotteryStatus: newStatus, isOpen: open });
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

  /* ============ ★ ขีดจำกัดเดิมพัน & คำนวณรับกิน (Bet Limits & Risk Intake) ★ ============ */

  // GET /api/v1/lottery/limits/:id — ดึงขีดจำกัดเดิมพัน (14 ประเภทสำหรับหวยไทย และ 12 สำหรับหวยอื่น)
  r.get('/limits/:id', async (req, res) => {
    try {
      const data = await getLotteryBetLimits(db, req.params.id);
      res.json({ status: 'success', data });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงข้อมูลขีดจำกัดเดิมพันไม่สำเร็จ: ' + (e as Error).message });
    }
  });

  // POST /api/v1/lottery/limits/:id — บันทึกขีดจำกัดเดิมพันหลักและประเภทย่อย
  r.post('/limits/:id', async (req, res) => {
    try {
      const result = await saveLotteryBetLimits(db, req.params.id, req.body || {});
      res.json(result);
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'บันทึกขีดจำกัดเดิมพันไม่สำเร็จ: ' + (e as Error).message });
    }
  });

  // POST /api/v1/lottery/quick-number-action — สุ่ม 100 เลข หรือเจาะจงรายตัวเพื่อลดอัตราจ่าย / ปิดรับแทง
  r.post('/quick-number-action', async (req, res) => {
    try {
      const { lotteryId, betType, action, discountRate, quantity, targetNumber } = req.body;
      if (!lotteryId || !betType || !action) {
        res.status(400).json({ status: 'error', message: 'ต้องระบุ lotteryId, betType และ action' });
        return;
      }
      const result = await handleQuickNumberAction(db, {
        lotteryId,
        betType,
        action,
        discountRate,
        quantity,
        targetNumber,
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดำเนินการจัดการตัวเลขไม่สำเร็จ: ' + (e as Error).message });
    }
  });

  // POST /api/v1/lottery/calculate-risk-limits — คำนวณเพดานรับกินรายเลข (งบรับกินรวม ÷ อัตราจ่าย)
  r.post('/calculate-risk-limits', async (req, res) => {
    try {
      const { lotteryId, betType, totalRiskBudget } = req.body;
      if (!lotteryId || !betType) {
        res.status(400).json({ status: 'error', message: 'ต้องระบุ lotteryId และ betType' });
        return;
      }
      const result = await calculateRiskLimits(db, {
        lotteryId,
        betType,
        totalRiskBudget: Number(totalRiskBudget) || 100000,
      });
      res.json({ status: 'success', data: result });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'คำนวณเพดานรับกินไม่สำเร็จ: ' + (e as Error).message });
    }
  });

  // GET /api/v1/lottery/live-intake/:id — ดึงข้อมูลมอนิเตอร์รับกินรายตัวเลขแบบเรียลไทม์
  r.get('/live-intake/:id', async (req, res) => {
    try {
      const lotteryId = req.params.id;
      const limitConfig = await getLotteryBetLimits(db, lotteryId);
      const subItemMap: Record<string, any> = {};
      (limitConfig.subItems || []).forEach((item: any) => {
        subItemMap[item.name] = item;
      });

      const aggregated: Record<string, { number: string; type: string; intake: number; limit: number; statusOverride?: string }> = {};

      if (db) {
        try {
          const ticketsQuery = query(
            collection(db, 'tickets'),
            where('lotteryType', '==', lotteryId),
            where('status', 'in', ['active', 'confirmed', 'pending_cancellation'])
          );
          const ticketsSnap = await getDocs(ticketsQuery);
          ticketsSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            (data.bets || []).forEach((b: any) => {
              if (b.number && b.type) {
                const key = `${b.type}_${b.number}`;
                const cfg = subItemMap[b.type];
                const limit = Number(cfg?.maxIntakePerNumber) || (b.type.includes('3 ตัว') ? 1000 : b.type.includes('2 ตัว') ? 3000 : 10000);
                if (!aggregated[key]) {
                  aggregated[key] = {
                    number: String(b.number),
                    type: String(b.type),
                    intake: 0,
                    limit,
                  };
                }
                aggregated[key].intake += (Number(b.amount) || 0);
              }
            });
          });
        } catch (e) {
          console.warn('[LiveIntake] ticket query warning:', (e as Error).message);
        }
      }

      let items = Object.values(aggregated);
      if (items.length === 0) {
        items = [];
      }

      let overrideMap: Record<string, any> = {};
      if (db) {
        try {
          const overridesSnap = await getDocs(collection(db, 'number_rate_overrides'));
          overridesSnap.docs.forEach(docSnap => {
            const ovData = docSnap.data();
            if (ovData.overrides) {
              Object.entries(ovData.overrides).forEach(([num, details]: [string, any]) => {
                const key = `${ovData.betType}_${num}`;
                overrideMap[key] = details;
              });
            }
          });
        } catch (e) {
          console.warn('[LiveIntake] override fetch warning:', (e as Error).message);
        }
      }

      const formatted = items.map(item => {
        const key = `${item.type}_${item.number}`;
        const ov = overrideMap[key];
        const statusOverride = ov?.status;
        const pct = Math.min(100, Math.round((item.intake / item.limit) * 100));
        const remaining = Math.max(0, item.limit - item.intake);
        return {
          ...item,
          statusOverride,
          customRate: ov?.rate,
          percent: pct,
          remaining,
          isFull: pct >= 100 || statusOverride === 'closed',
          isNear: pct >= 80 && pct < 100 && statusOverride !== 'closed',
        };
      });

      res.json({
        status: 'success',
        lotteryId,
        totalItems: formatted.length,
        fullCount: formatted.filter(f => f.isFull).length,
        nearCount: formatted.filter(f => f.isNear).length,
        normalCount: formatted.filter(f => !f.isFull && !f.isNear).length,
        totalIntakeAmount: formatted.reduce((acc, curr) => acc + curr.intake, 0),
        data: formatted,
      });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงข้อมูลมอนิเตอร์ไม่สำเร็จ: ' + (e as Error).message });
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

  /* ============ ★ ระบบตั้งเวลารอบหวยพร้อมความปลอดภัย (Sequential Guard & Calendar) ★ ============ */

  // GET /api/v1/rounds/calendar — ข้อมูลปฏิทินรอบพร้อมระบบสี 4 สถานะ
  r.get('/calendar', async (req, res) => {
    try {
      const { type } = req.query as any;
      const data = await getRoundsCalendar(db, type);
      res.json(data);
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงข้อมูลปฏิทินรอบไม่สำเร็จ: ' + (e as Error).message });
    }
  });

  // POST /api/v1/rounds/schedule — ตั้งเวลารอบหวยล่วงหน้า (มีระบบ Strict Sequential Guard)
  r.post('/schedule', async (req, res) => {
    try {
      const { lotteryType, roundNumber, openTime, closeTime, resultTime } = req.body;
      if (!lotteryType || !roundNumber || !openTime || !closeTime) {
        res.status(400).json({ status: 'error', message: 'ต้องระบุ lotteryType, roundNumber, openTime, closeTime' });
        return;
      }
      const result = await scheduleRoundsBatch(db, lotteryType, [{
        roundNumber,
        lotteryType,
        openTime,
        closeTime,
        resultTime,
      }]);
      res.json(result);
    } catch (e) {
      res.status(400).json({ status: 'error', message: (e as Error).message });
    }
  });

  // POST /api/v1/rounds/schedule-batch — ตั้งเวลารอบล่วงหน้าสูงสุด 5 รายการ
  r.post('/schedule-batch', async (req, res) => {
    try {
      const { lotteryType, rounds } = req.body;
      if (!lotteryType || !Array.isArray(rounds)) {
        res.status(400).json({ status: 'error', message: 'ต้องระบุ lotteryType และ rounds[] เป็น array' });
        return;
      }
      const result = await scheduleRoundsBatch(db, lotteryType, rounds);
      res.json(result);
    } catch (e) {
      res.status(400).json({ status: 'error', message: (e as Error).message });
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
