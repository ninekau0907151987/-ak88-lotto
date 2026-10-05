import React, { useState, useEffect, useMemo } from 'react';
import LotteryCategorySelector from './LotteryCategorySelector';
import { useRoundCountdown } from '@/shared/lib/roundTimer';
import { db } from '@/shared/lib/firebase';
import { doc, getDoc, setDoc, getDocs, collection, query, where, limit } from 'firebase/firestore';
import {
  MASTER_BET_TYPES,
  DEFAULT_MASTER_RATES,
  DEFAULT_MASTER_DISCOUNTS,
  isThaiOrYeekee,
  getAvailableBetTypesForLottery,
} from '@/shared/lib/lotteryRates';

interface IntakeItem {
  id: number;
  name: string;
  baseRate: number;            // อัตราจ่ายเต็ม (บาท)
  discountPercent: number;     // ส่วนลด % (เริ่มต้น 0%)
  discountedRate: number;      // อัตราจ่ายเมื่อมีส่วนลด (บาท)
  allocationPercent: number;   // สัดส่วนรับกิน % (รวมกันได้ 100%)
  maxIntakePerNumber: number;  // กินตัวละเท่าไหร่ (บาท)
  totalTypeBudget: number;     // งบรับกินรวมประเภทนี้ (บาท)
  minBet: number;              // แทงขั้นต่ำ (บาท)
  maxBet: number;              // แทงสูงสุดต่อบิล (บาท)
  maxBetPerUser?: number;      // แทงสูงสุดต่อยูส (บาท)
  enabled?: boolean;
}

interface RoundOption {
  id: string;
  roundNumber: string;
  openTime?: string;
  closeTime?: string;
  resultTime?: string;
  status?: string;
}

interface Props {
  lotteryTypes?: Record<string, any>;
  onLogActivity?: (action: string, details: string, type: string) => void;
  defaultTab?: 'rates' | 'intake';
}

// สัดส่วนเริ่มต้นรวมกันได้ 100% สำหรับหวยไทย & ยี่กี ครบ 14 ประเภท
const DEFAULT_THAI_ALLOCATIONS: Record<string, number> = {
  '2 ตัวบน': 20,
  '3 ตัวบน': 30,
  '3 ตัวโต๊ด': 10,
  '2 ตัวโต๊ด': 2,
  'วิ่งบน': 2,
  'วิ่งล่าง': 2,
  '2 ตัวล่าง': 15,
  '3 ตัวล่าง': 15,
  '4 ตัวบน': 1,
  '4 ตัวโต๊ด': 1,
  '5 ตัวโต๊ด': 0.5,
  'ปักหลักหน่วย': 0.5,
  'ปักหลักสิบ': 0.5,
  'ปักหลักร้อย': 0.5,
};

// สัดส่วนเริ่มต้นรวมกันได้ 100% สำหรับหวยอื่น 12 ประเภท (ไม่มี 3 ตัวล่าง และ 5 ตัวโต๊ด)
const DEFAULT_OTHER_ALLOCATIONS: Record<string, number> = {
  '2 ตัวบน': 25,
  '3 ตัวบน': 35,
  '3 ตัวโต๊ด': 15,
  '2 ตัวโต๊ด': 3,
  'วิ่งบน': 2,
  'วิ่งล่าง': 2,
  '2 ตัวล่าง': 15,
  '4 ตัวบน': 1,
  '4 ตัวโต๊ด': 1,
  'ปักหลักหน่วย': 0.4,
  'ปักหลักสิบ': 0.3,
  'ปักหลักร้อย': 0.3,
};

export default function RiskIntakeSettings({ lotteryTypes = {}, onLogActivity }: Props) {
  const lottoList = Object.keys(lotteryTypes).length > 0
    ? Object.keys(lotteryTypes)
    : ['หวยรัฐบาลไทย', 'หวยลาวพัฒนา', 'หวยฮานอยพิเศษ', 'หวยมาเลย์ 4D', 'หวยยี่กี 88 รอบ'];

  const [selectedLottery, setSelectedLottery] = useState<string>(lottoList[0] || 'หวยรัฐบาลไทย');
  
  // เครื่องมือคำนวณงบประมาณรับกินขั้นสูง (พับเก็บได้)
  const [showBudgetCalculator, setShowBudgetCalculator] = useState(false);

  // ข้อมูลรอบหวยสำหรับตั้งค่าเป็นรอบๆ
  const [rounds, setRounds] = useState<RoundOption[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [loadingRounds, setLoadingRounds] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isThai = selectedLottery.includes('ไทย') || selectedLottery.includes('รัฐบาล');

  const [intakeItems, setIntakeItems] = useState<IntakeItem[]>([]);
  const [globalRiskBudget, setGlobalRiskBudget] = useState<number>(200000);
  const [maxUserLimit, setMaxUserLimit] = useState<number>(50000);

  // เลือกรอบปัจจุบัน
  const currentRound = useMemo(() => {
    return rounds.find(r => r.id === selectedRoundId) || rounds[0] || null;
  }, [rounds, selectedRoundId]);

  // ตัวจับเวลานับถอยหลัง & สถานะสีรอบ
  const timerState = useRoundCountdown(
    currentRound?.openTime,
    currentRound?.closeTime,
    currentRound?.resultTime,
    currentRound?.status
  );

  // ดึงรอบหวยของหวยที่เลือก
  const fetchRounds = async (lotId: string) => {
    setLoadingRounds(true);
    try {
      let foundRounds: any[] = [];
      try {
        const res = await fetch(`/api/v1/rounds?type=${encodeURIComponent(lotId)}`);
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
          foundRounds = json.data;
        }
      } catch {}

      // Fallback: ดึงจาก Supabase โดยตรง (สำหรับ Vercel static)
      if (foundRounds.length === 0) {
        try {
          const snap = await getDocs(query(collection(db, 'lottery_rounds'), where('lottery_type', '==', lotId), limit(10)));
          if (!snap.empty) {
            foundRounds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          }
        } catch {}
      }

      if (foundRounds.length > 0) {
        setRounds(foundRounds);
        setSelectedRoundId(foundRounds[0].id);
      } else {
        const sampleRound: RoundOption = {
          id: `round-${lotId}-curr`,
          roundNumber: 'งวดปัจจุบัน (รอบเปิดรับแทง)',
          openTime: new Date(Date.now() - 3600000 * 2).toISOString(),
          closeTime: new Date(Date.now() + 3600000 * 6).toISOString(),
          resultTime: new Date(Date.now() + 3600000 * 7).toISOString(),
          status: 'open',
        };
        setRounds([sampleRound]);
        setSelectedRoundId(sampleRound.id);
      }
    } catch {
      setRounds([]);
    } finally {
      setLoadingRounds(false);
    }
  };

  // ดึงการตั้งค่าขีดจำกัดเดิมพัน & สัดส่วนรับกิน
  const fetchIntakeSettings = async (lotId: string) => {
    setLoading(true);
    setMessage(null);
    try {
      let savedData: any = null;
      try {
        const res = await fetch(`/api/v1/lottery/limits/${encodeURIComponent(lotId)}`);
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          savedData = json.data;
        }
      } catch {}

      // Fallback: ดึงจาก Supabase โดยตรง (สำหรับ Vercel static)
      if (!savedData) {
        try {
          const snap = await getDoc(doc(db, 'risk_intake_configs', lotId));
          if (snap.exists()) {
            savedData = snap.data();
          } else {
            const lotSnap = await getDoc(doc(db, 'lotteryTypes', lotId));
            if (lotSnap.exists()) {
              savedData = lotSnap.data();
            }
          }
        } catch {}
      }

      const isThaiLotto = isThaiOrYeekee(lotId);
      const availableMaster = getAvailableBetTypesForLottery(lotId);
      const defaultMap = isThaiLotto ? DEFAULT_THAI_ALLOCATIONS : DEFAULT_OTHER_ALLOCATIONS;
      const gBudget = Number(savedData?.totalRiskBudget) || 200000;
      setGlobalRiskBudget(gBudget);
      setMaxUserLimit(Number(savedData?.maxUserLimit) || 50000);

      const items: IntakeItem[] = availableMaster.map((m, index) => {
        const existingSub = Array.isArray(savedData?.subItems)
          ? savedData.subItems.find((s: any) => s.name === m.key)
          : null;

        const baseRate = Number(savedData?.rates?.[m.key]) || Number(existingSub?.baseRate) || m.rate;
        const discountPercent = Number(savedData?.discounts?.[m.key]) ?? Number(existingSub?.discountPercent) ?? m.discount ?? 0;
        const allocPct = Number(existingSub?.allocationPercent) || defaultMap[m.key] || 2;
        const calculatedTypeBudget = Number(existingSub?.totalTypeBudget) || Math.round(gBudget * (allocPct / 100));
        const autoDiscountedRate = Math.round(baseRate * (1 - discountPercent / 100) * 100) / 100;

        return {
          id: index + 1,
          name: m.key,
          baseRate,
          discountPercent,
          discountedRate: autoDiscountedRate,
          allocationPercent: allocPct,
          maxIntakePerNumber: Number(existingSub?.maxIntakePerNumber) || (m.digits >= 3 ? 1000 : 3000),
          totalTypeBudget: calculatedTypeBudget,
          minBet: Number(savedData?.minBets?.[m.key]) || Number(existingSub?.minBet) || 1,
          maxBet: Number(savedData?.maxBets?.[m.key]) || Number(existingSub?.maxBet) || (m.digits === 1 ? 10000 : 5000),
          maxBetPerUser: Number(savedData?.maxPerUsers?.[m.key]) || Number(existingSub?.maxBetPerUser) || (m.digits >= 3 ? 20000 : 50000),
          enabled: existingSub ? existingSub.enabled !== false : true,
        };
      });

      setIntakeItems(items);
    } catch (e: any) {
      console.warn('Fetch intake settings fallback:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntakeSettings(selectedLottery);
    fetchRounds(selectedLottery);
  }, [selectedLottery]);

  // คำนวณผลรวมสัดส่วน % ที่จัดสรรไปแล้ว
  const totalAllocatedPercent = useMemo(() => {
    const sum = intakeItems.reduce((acc, curr) => acc + (Number(curr.allocationPercent) || 0), 0);
    return Number(sum.toFixed(1));
  }, [intakeItems]);

  const remainingPercent = useMemo(() => {
    return Number(Math.max(0, 100 - totalAllocatedPercent).toFixed(1));
  }, [totalAllocatedPercent]);

  // สรุปยอดเงินรวมที่ระบบรับความเสี่ยงได้
  const totalAllocatedMoney = useMemo(() => {
    return intakeItems.reduce((acc, curr) => acc + (Number(curr.totalTypeBudget) || 0), 0);
  }, [intakeItems]);

  // เมื่อผู้ใช้เปลี่ยนงบรับกินรวม (Global Budget) ให้หาร/คำนวณงบรายประเภทตามสัดส่วน % ทันที
  const handleGlobalBudgetChange = (newBudget: number) => {
    setGlobalRiskBudget(newBudget);
    setIntakeItems(prev => prev.map(item => ({
      ...item,
      totalTypeBudget: Math.round(newBudget * ((Number(item.allocationPercent) || 0) / 100))
    })));
  };

  // ปรับสัดส่วนเปอร์เซ็นต์รับกิน (%) ของแต่ละประเภท
  const handleAllocationChange = (idx: number, newPercent: number) => {
    const safePercent = Math.max(0, Math.min(100, Number(newPercent) || 0));
    setIntakeItems(prev => {
      const updated = [...prev];
      const calcBudget = Math.round(globalRiskBudget * (safePercent / 100));
      updated[idx] = {
        ...updated[idx],
        allocationPercent: safePercent,
        totalTypeBudget: calcBudget,
      };
      return updated;
    });
  };

  // ปรับส่วนลด % พร้อมคำนวณอัตราจ่ายหลังหักส่วนลดอัตโนมัติจากการคำนวณจริง
  const handleDiscountChange = (idx: number, newDiscount: number) => {
    const safeDiscount = Math.max(0, Math.min(100, Number(newDiscount) || 0));
    setIntakeItems(prev => {
      const updated = [...prev];
      const item = updated[idx];
      const autoDiscountedRate = Math.round(item.baseRate * (1 - safeDiscount / 100) * 100) / 100;
      updated[idx] = {
        ...item,
        discountPercent: safeDiscount,
        discountedRate: autoDiscountedRate,
      };
      return updated;
    });
  };

  // ปรับอัตราจ่ายเต็ม (Base Rate) พร้อมคำนวณอัตราจ่ายหลังหักส่วนลดจริง
  const handleBaseRateChange = (idx: number, newRate: number) => {
    const safeRate = Math.max(0, Number(newRate) || 0);
    setIntakeItems(prev => {
      const updated = [...prev];
      const item = updated[idx];
      const autoDiscountedRate = Math.round(safeRate * (1 - (item.discountPercent || 0) / 100) * 100) / 100;
      updated[idx] = {
        ...item,
        baseRate: safeRate,
        discountedRate: autoDiscountedRate,
      };
      return updated;
    });
  };

  // แก้ไขฟิลด์อื่นๆ ในตาราง
  const handleItemFieldChange = (idx: number, field: keyof IntakeItem, value: any) => {
    setIntakeItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  // ปุ่มกดจัดสรร 100% มาตรฐานอัตโนมัติ
  const handleAutoBalance100 = () => {
    const isThaiLotto = isThaiOrYeekee(selectedLottery);
    const defaultMap = isThaiLotto ? DEFAULT_THAI_ALLOCATIONS : DEFAULT_OTHER_ALLOCATIONS;
    setIntakeItems(prev => prev.map(item => {
      const allocPct = defaultMap[item.name] ?? 2;
      return {
        ...item,
        allocationPercent: allocPct,
        totalTypeBudget: Math.round(globalRiskBudget * (allocPct / 100)),
      };
    }));
    setMessage({ text: 'จัดสรรสัดส่วนเปอร์เซ็นต์รวม 100% เรียบร้อยแล้ว', type: 'success' });
  };

  // บันทึกการตั้งค่า (รองรับการผูกกับรอบหวยที่เลือก และซิงค์หน้าบ้าน-หลังบ้าน)
  const handleSave = async (_tabName?: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const flatRates: Record<string, number> = {};
      const flatDiscounts: Record<string, number> = {};
      const minBets: Record<string, number> = {};
      const maxBets: Record<string, number> = {};
      const maxPerUsers: Record<string, number> = {};

      intakeItems.forEach(item => {
        flatRates[item.name] = Number(item.baseRate) || 0;
        flatDiscounts[item.name] = Number(item.discountPercent) || 0;
        minBets[item.name] = Number(item.minBet) || 1;
        maxBets[item.name] = Number(item.maxBet) || 5000;
        maxPerUsers[item.name] = Number(item.maxBetPerUser) || 50000;
      });

      // ซิงค์ชื่อพ้อง / ตัวช่วย (Aliases) ให้ตรงกันอัตโนมัติ
      if (flatRates['3 ตัวบน']) {
        flatRates['3 ตัวกลับ'] = flatRates['3 ตัวบน'];
        flatDiscounts['3 ตัวกลับ'] = flatDiscounts['3 ตัวบน'] || 0;
      }
      if (flatRates['2 ตัวบน']) {
        flatRates['2 ตัวกลับ'] = flatRates['2 ตัวบน'];
        flatDiscounts['2 ตัวกลับ'] = flatDiscounts['2 ตัวบน'] || 0;
      }
      if (flatRates['3 ตัวล่าง']) {
        flatRates['3 ตัวหน้า'] = flatRates['3 ตัวล่าง'];
        flatDiscounts['3 ตัวหน้า'] = flatDiscounts['3 ตัวล่าง'] || 0;
      }
      if (flatRates['ปักหลักสิบ']) {
        flatRates['เลขปัก'] = flatRates['ปักหลักสิบ'];
        flatDiscounts['เลขปัก'] = flatDiscounts['ปักหลักสิบ'] || 0;
      }

      const payload = {
        lotteryId: selectedLottery,
        lotteryType: selectedLottery,
        roundId: selectedRoundId || undefined,
        isThai,
        minBet: 1,
        maxBet: 5000,
        maxUserLimit,
        totalRiskBudget: globalRiskBudget,
        rates: flatRates,
        discounts: flatDiscounts,
        minBets,
        maxBets,
        maxPerUsers,
        subItems: intakeItems,
        updatedAt: new Date().toISOString(),
      };

      // 1. ลองส่งไปที่ Server API (หากมี)
      try {
        await fetch(`/api/v1/lottery/limits/${encodeURIComponent(selectedLottery)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {}

      // 2. บันทึกลง Supabase โดยตรง (ใช้งานได้ 100% บน Vercel)
      await setDoc(doc(db, 'risk_intake_configs', selectedLottery), payload, { merge: true });

      // 3. ซิงค์อัตราจ่าย และเพดานเดิมพัน เข้า lotteryTypes เพื่อให้หน้าแทงใช้งานได้ทันที
      await setDoc(doc(db, 'lotteryTypes', selectedLottery), {
        rates: flatRates,
        discounts: flatDiscounts,
        minBets,
        maxBets,
        maxPerUsers,
        subItems: intakeItems,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setMessage({ text: `บันทึกอัตราจ่ายและส่วนลดสำหรับ ${selectedLottery} สำเร็จแล้ว (หน้าบ้านซิงค์ใช้งานทันที)`, type: 'success' });
      onLogActivity?.('ตั้งค่าหวย & อัตราจ่าย', `บันทึกอัตราจ่ายและส่วนลดของ ${selectedLottery}`, 'settings');
    } catch (err: any) {
      setMessage({ text: 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Lottery Selector */}
      <div className="admin-card p-6 bg-white shadow-sm border border-slate-200 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-black shadow-sm">
              <span className="material-symbols-outlined text-2xl">tune</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                ตั้งค่าหวย & อัตราจ่าย (จ่ายเต็ม 100% • ล็อคส่วนลด 10%)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                กำหนดอัตราจ่ายเต็ม แทงขั้นต่ำ แทงสูงสุดต่อบิล และแทงสูงสุดต่อยูสเซอร์ (บันทึกรายรอบหวย)
              </p>
            </div>
          </div>
        </div>

        {/* สถานะการบันทึก */}
        {message && (
          <div className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <span className="material-symbols-outlined text-sm">
              {message.type === 'success' ? 'check_circle' : 'error'}
            </span>
            {message.text}
          </div>
        )}
      </div>

      {/* 2. Lottery Selector Filter Component */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <LotteryCategorySelector
          lotterySettings={lotteryTypes}
          selectedLottery={selectedLottery}
          onSelectLottery={(type) => {
            setSelectedLottery(type);
          }}
        />

        {/* เลือกรอบหวย (Round Selector) & กล่องสถานะนับถอยหลัง 3 สี */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
              <span className="material-symbols-outlined text-sm text-blue-600">calendar_month</span>
              เลือกรอบหวย:
            </span>
            {loadingRounds ? (
              <span className="text-xs text-slate-400">กำลังโหลดรอบ...</span>
            ) : rounds.length > 0 ? (
              <select
                value={selectedRoundId}
                onChange={(e) => setSelectedRoundId(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:bg-white transition"
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roundNumber} ({r.status === 'open' ? 'เปิดรับ' : r.status === 'resulted' ? 'ออกผลแล้ว' : 'ปิดแล้ว'})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-lg">
                รอบปกติ (ทุกงวด)
              </span>
            )}
          </div>

          {/* กล่องแสดงเวลานับถอยหลัง 3 สถานะสี (รอเปิด / กำลังเปิด / รอออกผล) */}
          <div className={`px-4 py-2.5 rounded-xl border flex items-center gap-2.5 text-xs font-black shadow-sm ${timerState.boxClass}`}>
            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${timerState.badgeClass}`}>
              {timerState.label}
            </span>
            <span>{timerState.countdownText}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ตารางกำหนดอัตราจ่าย และเพดานเดิมพัน (ไม่มีแท็บสลับ - จ่ายเต็ม 100% ล็อค 10%) */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">payments</span>
                กำหนดอัตราจ่ายเต็ม เพดานแทงต่อบิล และแทงสูงสุดต่อยูส: {selectedLottery}
              </h3>
              <p className="text-xs text-slate-500">
                รอบ {currentRound?.roundNumber || 'งวดปัจจุบัน'} • อัตราจ่ายเต็ม 100% มีผลต่อการคำนวณเงินรางวัลของสมาชิกทันที
              </p>
            </div>

            <button
              onClick={() => handleSave()}
              disabled={saving || loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md shadow-blue-600/25 transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าหวย'}
            </button>
          </div>

          {/* ป้ายแจ้งเตือนระบบอัตราจ่ายและส่วนลด (การคำนวณจริง) */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 p-3.5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-blue-600 text-xl">calculate</span>
              <div>
                <span className="text-xs font-black text-blue-950">
                  ตารางราคาจ่าย & ส่วนลดมาตรฐาน (คำนวณเงินจริง) • หวยไทยและยี่กีครบ 14 ประเภท • หวยอื่นๆ ไม่มี 3 ตัวล่าง และ 5 ตัวโต๊ด (12 ประเภท)
                </span>
                <p className="text-[11px] text-blue-700">
                  แอดมินสามารถเพิ่ม/ลด "จ่าย" (บาทละ) และ "ลด" (%) ได้อิสระ ระบบหน้าบ้านจะคำนวณยอดแทงสุทธิและเงินรางวัลตามค่าที่ตั้งไว้ทันที
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-black tracking-wide whitespace-nowrap shadow-sm">
              ✨ ซิงค์หน้าบ้าน-หลังบ้าน
            </span>
          </div>

          {/* ตารางอัตราจ่ายและส่วนลดตามภาพเรฟ media_1791239149158.png เป๊ะ 100% */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase font-black">
                  <th className="py-3 px-3 text-center w-12">ลำดับ</th>
                  <th className="py-3 px-4">ชนิด</th>
                  <th className="py-3 px-4 text-center bg-amber-50 text-amber-900 border-x border-amber-200">จ่าย (บาท)</th>
                  <th className="py-3 px-4 text-center bg-blue-50 text-blue-900 border-r border-blue-200">ลด (%)</th>
                  <th className="py-3 px-4 text-center">จ่ายสุทธิหลังหักลด (บาท)</th>
                  <th className="py-3 px-4 text-center">แทงขั้นต่ำ (บาท)</th>
                  <th className="py-3 px-4 text-center">แทงสูงสุด (บาท)</th>
                  <th className="py-3 px-4 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-bold">
                {intakeItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-blue-50/40 transition">
                    <td className="py-3 px-3 text-center text-slate-500 font-mono font-bold">
                      {idx + 1}.
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{item.name}</span>
                        {(item.name === '3 ตัวล่าง' || item.name === '5 ตัวโต๊ด') && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">
                            หวยไทย / ยี่กี
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-center bg-amber-50/40 border-x border-amber-200">
                      <input
                        type="number"
                        step="0.01"
                        value={item.baseRate}
                        onChange={(e) => handleBaseRateChange(idx, Number(e.target.value) || 0)}
                        className="w-24 text-center py-1.5 px-2 bg-white border border-amber-300 rounded-lg text-xs font-black text-amber-700 outline-none focus:ring-2 focus:ring-amber-400 shadow-inner"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-center bg-blue-50/40 border-r border-blue-200">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={item.discountPercent}
                        onChange={(e) => handleDiscountChange(idx, Number(e.target.value) || 0)}
                        className="w-20 text-center py-1.5 px-2 bg-white border border-blue-300 rounded-lg text-xs font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-400 shadow-inner"
                      />
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black text-emerald-600">
                      ฿{item.discountedRate.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <input
                        type="number"
                        value={item.minBet}
                        onChange={(e) => handleItemFieldChange(idx, 'minBet', Number(e.target.value) || 1)}
                        className="w-20 text-center py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <input
                        type="number"
                        value={item.maxBet}
                        onChange={(e) => handleItemFieldChange(idx, 'maxBet', Number(e.target.value) || 5000)}
                        className="w-24 text-center py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleItemFieldChange(idx, 'enabled', !item.enabled)}
                        className={`px-3 py-1 rounded-full text-[11px] font-black transition ${
                          item.enabled !== false
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                        }`}
                      >
                        {item.enabled !== false ? 'เปิดรับ' : 'ปิด'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => handleSave()}
              disabled={saving || loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-md shadow-blue-600/25 transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">save</span>
              {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าหวย'}
            </button>
          </div>
        </div>

        {/* 4. เมนูพับเก็บได้สำหรับการจัดสรรงบประมาณรับกินความเสี่ยงต่องวด (เครื่องมือคำนวณขั้นสูง) */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setShowBudgetCalculator(!showBudgetCalculator)}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition text-left"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-emerald-600">calculate</span>
              <div>
                <span className="text-xs font-black text-slate-900">
                  เครื่องมือคำนวณงบประมาณรับกินความเสี่ยงและเพดานรับกินรายเลขต่องวด (ขั้นสูง)
                </span>
                <p className="text-[10px] text-slate-500">
                  กำหนดงบรวมต่องวด (Global Risk Budget) และเพดานกินตัวละเท่าไหร่
                </p>
              </div>
            </div>
            <span className={`material-symbols-outlined text-slate-500 transition-transform ${showBudgetCalculator ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>

          {showBudgetCalculator && (
            <div className="p-6 space-y-6 border-t border-slate-200">
              {/* แผงคำนวณงบประมาณรับกินใส่ตัวเงิน (Budget Allocation Calculator) */}
              <div className="bg-gradient-to-br from-emerald-950 to-slate-900 text-white p-6 rounded-2xl border border-emerald-900/50 shadow-xl space-y-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-emerald-800/40 pb-4">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">calculate</span>
                      การจัดสรรงบรับกินความเสี่ยงใส่ตัวเงินจริง (Per-Round Budget Allocation)
                    </span>
                    <h3 className="text-xl font-black text-white mt-1">
                      รอบ: {currentRound?.roundNumber || 'งวดปัจจุบัน'} • {selectedLottery}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleAutoBalance100}
                      className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">balance</span>
                      จัดสรร 100% อัตโนมัติ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSave()}
                      disabled={saving || loading}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/25 transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">save</span>
                      {saving ? 'กำลังบันทึก...' : 'บันทึกเพดานรับกิน'}
                    </button>
                  </div>
                </div>

                {/* ช่องกรอกตัวเงินงบรับกินรวม */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      งบรับกินรวมต่องวด (บาท):
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-black text-lg">฿</span>
                      <input
                        type="number"
                        value={globalRiskBudget}
                        onChange={(e) => handleGlobalBudgetChange(Number(e.target.value) || 0)}
                        className="w-full bg-black/30 border border-emerald-500/40 rounded-lg p-2 text-base font-black text-emerald-300 outline-none focus:border-emerald-400"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">งบความเสี่ยงรวมที่จะกระจายไปยังประเภทย่อย</p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      จำกัดยอดแทงสูงสุดต่อยูสเซอร์ (บาท):
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-black text-lg">฿</span>
                      <input
                        type="number"
                        value={maxUserLimit}
                        onChange={(e) => setMaxUserLimit(Number(e.target.value) || 0)}
                        className="w-full bg-black/30 border border-white/20 rounded-lg p-2 text-base font-black text-white outline-none focus:border-emerald-400"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">เพดานแทงรวมของสมาชิกคนเดียวในรอบนี้</p>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-bold text-slate-400">สัดส่วนที่จัดสรรแล้ว:</span>
                      <span className={`text-xs font-black ${
                        totalAllocatedPercent === 100 ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {totalAllocatedPercent}% / 100%
                      </span>
                    </div>
                    <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden mt-2 p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          totalAllocatedPercent === 100 ? 'bg-emerald-400' : totalAllocatedPercent > 100 ? 'bg-rose-500' : 'bg-amber-400'
                        }`}
                        style={{ width: `${Math.min(100, totalAllocatedPercent)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                      รวมงบเงินจัดสรรแล้ว: <b className="text-white">฿{totalAllocatedMoney.toLocaleString()}</b> (คงเหลือ {remainingPercent}%)
                    </p>
                  </div>
                </div>
              </div>

              {/* ตารางคำนวณตัวเงินรับกิน (Type Budget & Max Intake Per Number) */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600">table_chart</span>
                  ตารางคำนวณงบเงินรับกินและเพดานรับกินรายเลข (กินตัวละเท่าไหร่)
                </h4>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-black">
                        <th className="py-3 px-4">ประเภทเดิมพัน</th>
                        <th className="py-3 px-3 text-center">สัดส่วนรับกิน (%)</th>
                        <th className="py-3 px-4 text-center">งบเงินประเภทนี้ (บาท)</th>
                        <th className="py-3 px-4 text-center bg-emerald-50/50">กินตัวละเท่าไหร่ (บาท)</th>
                        <th className="py-3 px-4 text-center">ภาระจ่ายเสี่ยงสูงสุด (บาท)</th>
                        <th className="py-3 px-3 text-center">จำนวนเลขเต็มงบ</th>
                        <th className="py-3 px-3 text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-bold">
                      {intakeItems.map((item, idx) => {
                        const maxPayoutExposure = Math.round(item.maxIntakePerNumber * item.baseRate);
                        const numberCapacity = item.maxIntakePerNumber > 0 
                          ? Math.floor(item.totalTypeBudget / item.maxIntakePerNumber) 
                          : 0;

                        return (
                          <tr key={item.id} className="hover:bg-emerald-50/40 transition">
                            <td className="py-3 px-4 font-black text-slate-900">
                              {item.name}
                              <span className="block text-[10px] text-slate-400 font-normal">เรทจ่าย: ฿{item.baseRate}</span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={item.allocationPercent}
                                onChange={(e) => handleAllocationChange(idx, Number(e.target.value) || 0)}
                                className="w-16 text-center py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
                              />
                              <span className="text-[10px] text-slate-400 ml-1">%</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-900 font-black text-xs inline-block">
                                ฿{item.totalTypeBudget.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center bg-emerald-50/30">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-emerald-700 font-black">฿</span>
                                <input
                                  type="number"
                                  value={item.maxIntakePerNumber}
                                  onChange={(e) => handleItemFieldChange(idx, 'maxIntakePerNumber', Number(e.target.value) || 0)}
                                  className="w-24 text-center py-1.5 px-2 bg-white border border-emerald-300 rounded-lg text-xs font-black text-emerald-800 outline-none focus:border-emerald-500 shadow-sm"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="text-xs font-black text-rose-700">
                                ฿{maxPayoutExposure.toLocaleString()}
                              </span>
                              <span className="block text-[9px] text-slate-400 font-normal">(กินตัวละ × เรท)</span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 text-[11px] font-black">
                                {numberCapacity} เลข
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleItemFieldChange(idx, 'enabled', !item.enabled)}
                                className={`px-3 py-1 rounded-full text-[11px] font-black transition ${
                                  item.enabled !== false
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                                }`}
                              >
                                {item.enabled !== false ? 'เปิดรับ' : 'ปิด'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
