/**
 * server/domains/lottery/betlimit.service.ts
 * ------------------------------------------------------------------
 * บริการตั้งค่าขีดจำกัดเดิมพัน (Bet Limits) & คำนวณรับกิน (Risk Intake)
 * 1) หวยไทย 14 ประเภท vs หวยอื่น 12 ประเภท
 * 2) เพดานเงินเดิมพันขั้นต่ำ, สูงสุดต่อรายการ, เพดานสูงสุดต่อ 1 ผู้ใช้
 * 3) จัดการเลขด่วน (สุ่ม 100 เลขลดจ่าย / เจาะจงรายตัว / ปิดรับแทง)
 * 4) คำนวณเพดานรับกินรายเลข (งบรับกินรวม / อัตราจ่าย)
 */
import {
  collection, doc, getDoc, getDocs, setDoc, serverTimestamp,
} from 'firebase/firestore';

export interface SubBetTypeConfig {
  id: number;
  name: string;
  baseRate: number;
  minBet: number;
  maxBet: number;
  maxUserLimit: number;
}

// 14 ประเภทสำหรับหวยรัฐบาลไทย
export const THAI_14_BET_TYPES: SubBetTypeConfig[] = [
  { id: 1,  name: '3 ตัวบน',       baseRate: 900, minBet: 1, maxBet: 2000,  maxUserLimit: 20000 },
  { id: 2,  name: '3 ตัวล่าง',      baseRate: 450, minBet: 1, maxBet: 2000,  maxUserLimit: 20000 },
  { id: 3,  name: '3 ตัวโต๊ด',      baseRate: 150, minBet: 1, maxBet: 3000,  maxUserLimit: 30000 },
  { id: 4,  name: '2 ตัวบน',       baseRate: 90,  minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
  { id: 5,  name: '2 ตัวล่าง',      baseRate: 90,  minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
  { id: 6,  name: '2 ตัวโต๊ด',      baseRate: 12,  minBet: 1, maxBet: 6000,  maxUserLimit: 60000 },
  { id: 7,  name: 'วิ่งบน',        baseRate: 3.2, minBet: 1, maxBet: 10000, maxUserLimit: 100000 },
  { id: 8,  name: 'วิ่งล่าง',       baseRate: 4.2, minBet: 1, maxBet: 10000, maxUserLimit: 100000 },
  { id: 9,  name: 'ปักหลักร้อย',    baseRate: 8.0, minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
  { id: 10, name: 'ปักหลักสิบ',     baseRate: 8.0, minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
  { id: 11, name: 'ปักหลักหน่วย',   baseRate: 8.0, minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
  { id: 12, name: '4 ตัวบน',       baseRate: 5000, minBet: 1, maxBet: 1000, maxUserLimit: 10000 },
  { id: 13, name: '4 ตัวโต๊ด',      baseRate: 25,  minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
  { id: 14, name: '5 ตัวโต๊ด',      baseRate: 15,  minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
];

// 12 ประเภทสำหรับหวยอื่นๆ (ยี่กี, หวยลาว, ฮานอย, หุ้น ฯลฯ)
export const OTHER_12_BET_TYPES: SubBetTypeConfig[] = [
  { id: 1,  name: '3 ตัวบน',       baseRate: 900, minBet: 1, maxBet: 2000,  maxUserLimit: 20000 },
  { id: 2,  name: '3 ตัวโต๊ด',      baseRate: 150, minBet: 1, maxBet: 3000,  maxUserLimit: 30000 },
  { id: 3,  name: '2 ตัวบน',       baseRate: 90,  minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
  { id: 4,  name: '2 ตัวล่าง',      baseRate: 90,  minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
  { id: 5,  name: '2 ตัวโต๊ด',      baseRate: 12,  minBet: 1, maxBet: 6000,  maxUserLimit: 60000 },
  { id: 6,  name: 'วิ่งบน',        baseRate: 3.2, minBet: 1, maxBet: 10000, maxUserLimit: 100000 },
  { id: 7,  name: 'วิ่งล่าง',       baseRate: 4.2, minBet: 1, maxBet: 10000, maxUserLimit: 100000 },
  { id: 8,  name: 'ปักหลักร้อย',    baseRate: 8.0, minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
  { id: 9,  name: 'ปักหลักสิบ',     baseRate: 8.0, minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
  { id: 10, name: 'ปักหลักหน่วย',   baseRate: 8.0, minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
  { id: 11, name: '4 ตัวบน',       baseRate: 5000, minBet: 1, maxBet: 1000, maxUserLimit: 10000 },
  { id: 12, name: '4 ตัวโต๊ด',      baseRate: 25,  minBet: 1, maxBet: 5000,  maxUserLimit: 50000 },
];

/** ตรวจสอบว่าเป็นหวยรัฐบาลไทยหรือไม่ */
export function isThaiLottery(lotteryId: string): boolean {
  const s = String(lotteryId || '').toLowerCase().trim();
  return s === 'thai' || s === '1' || s === 'th' || s.includes('thai') || s.includes('ไทย') || s === 'government';
}

/** ดึงการตั้งค่าขีดจำกัดเดิมพันของหวยแต่ละประเภท */
export async function getLotteryBetLimits(db: any, lotteryId: string) {
  const isThai = isThaiLottery(lotteryId);
  const template = isThai ? THAI_14_BET_TYPES : OTHER_12_BET_TYPES;

  let savedData: any = null;
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'lottery_bet_limits', String(lotteryId)));
      if (snap.exists()) {
        savedData = snap.data();
      }
    } catch (e) {
      console.warn('[BetLimitService] getDoc error, using defaults:', (e as Error).message);
    }
  }

  const minBet = Number(savedData?.minBet) || 1;
  const maxBet = Number(savedData?.maxBet) || 5000;
  const maxUserLimit = Number(savedData?.maxUserLimit) || 50000;
  const note = String(savedData?.note || '');

  // ผสานการตั้งค่าย่อย (Sub-bet items)
  const savedSubItems: Record<string, any> = {};
  if (Array.isArray(savedData?.subItems)) {
    savedData.subItems.forEach((item: any) => {
      savedSubItems[item.name] = item;
    });
  }

  const subItems = template.map(t => {
    const override = savedSubItems[t.name];
    return {
      id: t.id,
      name: t.name,
      baseRate: Number(override?.baseRate) || t.baseRate,
      minBet: Number(override?.minBet) || minBet,
      maxBet: Number(override?.maxBet) || maxBet,
      maxUserLimit: Number(override?.maxUserLimit) || maxUserLimit,
    };
  });

  return {
    lotteryId,
    isThai,
    totalTypes: template.length,
    minBet,
    maxBet,
    maxUserLimit,
    note,
    subItems,
    updatedAt: savedData?.updatedAt || new Date().toISOString(),
  };
}

/** บันทึกการตั้งค่าขีดจำกัดเดิมพัน */
export async function saveLotteryBetLimits(db: any, lotteryId: string, data: any) {
  const isThai = isThaiLottery(lotteryId);
  const minBet = Math.max(1, Number(data.minBet) || 1);
  const maxBet = Math.max(minBet, Number(data.maxBet) || 5000);
  const maxUserLimit = Math.max(maxBet, Number(data.maxUserLimit) || 50000);
  const note = String(data.note || '');

  let subItems = Array.isArray(data.subItems) ? data.subItems : [];
  if (subItems.length === 0) {
    const template = isThai ? THAI_14_BET_TYPES : OTHER_12_BET_TYPES;
    subItems = template.map(t => ({
      id: t.id,
      name: t.name,
      baseRate: t.baseRate,
      minBet,
      maxBet,
      maxUserLimit,
    }));
  }

  const payload = {
    lotteryId: String(lotteryId),
    isThai,
    minBet,
    maxBet,
    maxUserLimit,
    note,
    subItems,
    updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
  };

  if (db) {
    await setDoc(doc(db, 'lottery_bet_limits', String(lotteryId)), payload, { merge: true });
  }

  return { status: 'success', message: 'บันทึกการตั้งค่าขีดจำกัดเดิมพันสำเร็จ', data: payload };
}

/**
 * ดำเนินการกับตัวเลขด่วน (ขั้นตอนที่ 3: สุ่ม 100 เลข หรือเจาะจงรายตัวเลข)
 */
export async function handleQuickNumberAction(db: any, params: {
  lotteryId: string;
  betType: string;
  action: 'random_discount' | 'custom_discount' | 'custom_close' | 'custom_restore';
  discountRate?: number;
  quantity?: number;
  targetNumber?: string;
}) {
  const { lotteryId, betType, action, discountRate, quantity = 100, targetNumber } = params;
  const docKey = `${lotteryId}_${betType}`.replace(/\s+/g, '_');

  let currentOverrides: Record<string, { rate?: number; status: 'normal' | 'discounted' | 'closed' }> = {};
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'number_rate_overrides', docKey));
      if (snap.exists()) {
        currentOverrides = snap.data().overrides || {};
      }
    } catch (e) {
      console.warn('[BetLimitService] get overrides err:', (e as Error).message);
    }
  }

  let affectedCount = 0;
  const newRate = Number(discountRate) || 70;

  if (action === 'random_discount') {
    // สุ่มเลข N ตัว (เช่น 100 เลข สำหรับ 2 ตัว 00-99 หรือ 3 ตัว 000-999)
    const is3Digit = betType.includes('3 ตัว');
    const maxVal = is3Digit ? 1000 : 100;
    const padLen = is3Digit ? 3 : 2;

    const allNums: string[] = [];
    for (let i = 0; i < maxVal; i++) {
      allNums.push(String(i).padStart(padLen, '0'));
    }

    // Shuffle & Pick
    for (let i = allNums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allNums[i], allNums[j]] = [allNums[j], allNums[i]];
    }

    const picked = allNums.slice(0, Math.min(quantity, maxVal));
    picked.forEach(num => {
      currentOverrides[num] = {
        rate: newRate,
        status: 'discounted',
      };
    });
    affectedCount = picked.length;

  } else if (action === 'custom_discount') {
    if (!targetNumber) throw new Error('ต้องระบุตัวเลขที่ต้องการลดอัตราจ่าย');
    currentOverrides[targetNumber] = {
      rate: newRate,
      status: 'discounted',
    };
    affectedCount = 1;

  } else if (action === 'custom_close') {
    if (!targetNumber) throw new Error('ต้องระบุตัวเลขที่ต้องการปิดรับแทง');
    currentOverrides[targetNumber] = {
      status: 'closed',
    };
    affectedCount = 1;

  } else if (action === 'custom_restore') {
    if (targetNumber) {
      delete currentOverrides[targetNumber];
      affectedCount = 1;
    } else {
      currentOverrides = {};
      affectedCount = Object.keys(currentOverrides).length;
    }
  }

  if (db) {
    await setDoc(doc(db, 'number_rate_overrides', docKey), {
      lotteryId,
      betType,
      overrides: currentOverrides,
      updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
    }, { merge: true });
  }

  return {
    status: 'success',
    action,
    lotteryId,
    betType,
    affectedCount,
    totalOverrides: Object.keys(currentOverrides).length,
  };
}

/**
 * คำนวณเพดานรับกินรายเลข (ขั้นตอนที่ 4: Total Risk Budget ÷ อัตราจ่ายปัจจุบัน)
 */
export async function calculateRiskLimits(db: any, params: {
  lotteryId: string;
  betType: string;
  totalRiskBudget: number;
}) {
  const { lotteryId, betType, totalRiskBudget = 100000 } = params;
  const isThai = isThaiLottery(lotteryId);
  const template = isThai ? THAI_14_BET_TYPES : OTHER_12_BET_TYPES;
  const typeConf = template.find(t => t.name === betType) || template[0];

  const docKey = `${lotteryId}_${betType}`.replace(/\s+/g, '_');
  let overrides: Record<string, any> = {};
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'number_rate_overrides', docKey));
      if (snap.exists()) {
        overrides = snap.data().overrides || {};
      }
    } catch (e) {
      console.warn('[BetLimitService] get overrides err:', (e as Error).message);
    }
  }

  // กำหนดจำนวนหลัก
  const is3Digit = betType.includes('3 ตัว');
  const is1Digit = betType.includes('วิ่ง') || betType.includes('ปักหลัก');
  const maxVal = is1Digit ? 10 : (is3Digit ? 1000 : 100);
  const padLen = is1Digit ? 1 : (is3Digit ? 3 : 2);

  const numbers = [];
  for (let i = 0; i < maxVal; i++) {
    const num = String(i).padStart(padLen, '0');
    const ov = overrides[num];
    const isClosed = ov?.status === 'closed';
    const isDiscounted = ov?.status === 'discounted';
    const currentRate = isDiscounted && ov?.rate ? Number(ov.rate) : typeConf.baseRate;
    
    // เพดานรับกิน = งบรับกินรวม ÷ อัตราจ่ายปัจจุบัน (ถ้าปิดรับแทง เพดาน = 0)
    const poolLimit = isClosed ? 0 : Math.floor(totalRiskBudget / currentRate);

    numbers.push({
      index: i + 1,
      number: num,
      betType,
      baseRate: typeConf.baseRate,
      currentRate,
      poolLimit,
      status: isClosed ? 'closed' : (isDiscounted ? 'discounted' : 'normal'),
      isClosed,
      isDiscounted,
    });
  }

  return {
    lotteryId,
    betType,
    totalRiskBudget,
    baseRate: typeConf.baseRate,
    totalNumbers: numbers.length,
    numbers,
  };
}
