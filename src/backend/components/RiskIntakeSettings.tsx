import React, { useState, useEffect, useMemo } from 'react';
import LotteryCategorySelector from './LotteryCategorySelector';
import { useRoundCountdown } from '@/shared/lib/roundTimer';
import { db } from '@/shared/lib/firebase';
import { doc, getDoc, setDoc, getDocs, collection, query, where, limit } from 'firebase/firestore';

interface IntakeItem {
  id: number;
  name: string;
  baseRate: number;            // อัตราจ่ายเต็ม (บาท)
  discountPercent: number;     // ส่วนลด % (ล็อค 10%)
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

// สัดส่วนเริ่มต้นรวมกันได้ 100% สำหรับหวยไทย 13 ประเภท (ตัด 2 ตัวโต๊ด และ 5 ตัวโต๊ด ออก)
const DEFAULT_THAI_ALLOCATIONS: Record<string, number> = {
  '3 ตัวบน': 30,
  '3 ตัวล่าง': 15,
  '3 ตัวโต๊ด': 10,
  '3 ตัวหน้า': 4,
  '2 ตัวบน': 20,
  '2 ตัวล่าง': 15,
  'วิ่งบน': 2,
  'วิ่งล่าง': 2,
  'ปักหลักร้อย': 0.5,
  'ปักหลักสิบ': 0.5,
  'ปักหลักหน่วย': 0.5,
  '4 ตัวบน': 0.3,
  '4 ตัวโต๊ด': 0.2,
};

// สัดส่วนเริ่มต้นรวมกันได้ 100% สำหรับหวยอื่น 11 ประเภท (ตัด 2 ตัวโต๊ด ออก)
const DEFAULT_OTHER_ALLOCATIONS: Record<string, number> = {
  '3 ตัวบน': 35,
  '3 ตัวโต๊ด': 10,
  '3 ตัวล่าง': 5,
  '2 ตัวบน': 24,
  '2 ตัวล่าง': 20,
  'วิ่งบน': 2,
  'วิ่งล่าง': 2,
  'ปักหลักร้อย': 0.6,
  'ปักหลักสิบ': 0.7,
  'ปักหลักหน่วย': 0.7,
  '4 ตัวบน': 0.5,
  '4 ตัวโต๊ด': 0.5,
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
          }
        } catch {}
      }

      if (savedData && Array.isArray(savedData.subItems) && savedData.subItems.length > 0) {
        const subs = savedData.subItems || [];
        const isThaiLotto = lotId.includes('ไทย') || lotId.includes('รัฐบาล');
        const defaultMap = isThaiLotto ? DEFAULT_THAI_ALLOCATIONS : DEFAULT_OTHER_ALLOCATIONS;

        const gBudget = Number(savedData.totalRiskBudget) || 200000;
        setGlobalRiskBudget(gBudget);
        setMaxUserLimit(Number(savedData.maxUserLimit) || 50000);

        setIntakeItems(subs.map((s: any) => {
          const allocPct = s.allocationPercent != null 
            ? Number(s.allocationPercent) 
            : (defaultMap[s.name] ?? (s.name.includes('3 ตัว') ? 25 : s.name.includes('2 ตัว') ? 20 : 2));
          const calculatedTypeBudget = Number(s.totalTypeBudget) || Math.round(gBudget * (allocPct / 100));
          const is3 = s.name.includes('3 ตัว');
          const is2 = s.name.includes('2 ตัว');
          const baseRate = Number(s.baseRate) || (is3 ? 900 : is2 ? 92 : 3.2);

          return {
            id: s.id,
            name: s.name,
            baseRate,
            discountPercent: 10,       // ล็อคส่วนลด 10% คงที่ตามคำขอ
            discountedRate: baseRate,  // จ่ายเต็ม 100% (ไม่มีหักลดทอน)
            allocationPercent: allocPct,
            maxIntakePerNumber: Number(s.maxIntakePerNumber) || (is3 ? 1000 : is2 ? 3000 : 10000),
            totalTypeBudget: calculatedTypeBudget,
            minBet: Number(s.minBet) || 1,
            maxBet: Number(s.maxBet) || 5000,
            maxBetPerUser: Number(s.maxBetPerUser) || (is3 ? 20000 : is2 ? 50000 : 100000),
            enabled: s.enabled !== false,
          };
        }));
      } else {
        // Fallback: Populate standard types matching lottery type
        const isThaiLotto = lotId.includes('ไทย') || lotId.includes('รัฐบาล');
        const defaultMap = isThaiLotto ? DEFAULT_THAI_ALLOCATIONS : DEFAULT_OTHER_ALLOCATIONS;
        const defaultItems: IntakeItem[] = Object.keys(defaultMap).map((typeName, index) => {
          const allocPct = defaultMap[typeName] ?? 2;
          const is3Digit = typeName.includes('3 ตัว');
          const is2Digit = typeName.includes('2 ตัว');
          const isRun = typeName.includes('วิ่ง');
          const isPin = typeName.includes('ปักหลัก');
          const is4Digit = typeName.includes('4 ตัว');

          const baseRate = is3Digit ? (typeName.includes('โต๊ด') ? 150 : typeName.includes('ล่าง') || typeName.includes('หน้า') ? 450 : 900)
            : is2Digit ? 92
            : isRun ? (typeName === 'วิ่งล่าง' ? 4.2 : 3.2)
            : isPin ? 8
            : is4Digit ? (typeName.includes('โต๊ด') ? 200 : 5000)
            : 92;

          return {
            id: index + 1,
            name: typeName,
            baseRate,
            discountPercent: 10,       // ล็อคส่วนลด 10%
            discountedRate: baseRate,  // จ่ายเต็ม 100%
            allocationPercent: allocPct,
            maxIntakePerNumber: is3Digit ? 1000 : is2Digit ? 3000 : isRun ? 10000 : 2000,
            totalTypeBudget: Math.round(200000 * (allocPct / 100)),
            minBet: 1,
            maxBet: isRun ? 10000 : 5000,
            maxBetPerUser: is3Digit ? 20000 : is2Digit ? 50000 : isRun ? 100000 : 30000,
            enabled: true,
          };
        });
        setIntakeItems(defaultItems);
      }
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

  // ปรับส่วนลด % พร้อมคำนวณอัตราจ่ายหลังหักส่วนลดอัตโนมัติ
  const handleDiscountChange = (idx: number, newDiscount: number) => {
    const safeDiscount = Math.max(0, Math.min(100, Number(newDiscount) || 0));
    setIntakeItems(prev => {
      const updated = [...prev];
      const item = updated[idx];
      const autoDiscountedRate = Math.round(item.baseRate * (1 - safeDiscount / 100) * 10) / 10;
      updated[idx] = {
        ...updated[idx],
        discountPercent: safeDiscount,
        discountedRate: autoDiscountedRate,
      };
      return updated;
    });
  };

  // ปรับอัตราจ่ายเต็ม (Base Rate) - สมาชิกรับ 100% เต็มตามที่ตั้งไว้
  const handleBaseRateChange = (idx: number, newRate: number) => {
    setIntakeItems(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        baseRate: newRate,
        discountPercent: 10,
        discountedRate: newRate, // จ่ายเต็ม 100%
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
    const defaultMap = isThai ? DEFAULT_THAI_ALLOCATIONS : DEFAULT_OTHER_ALLOCATIONS;
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

  // บันทึกการตั้งค่า (รองรับการผูกกับรอบหวยที่เลือก)
  const handleSave = async (_tabName?: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        lotteryId: selectedLottery,
        lotteryType: selectedLottery,
        roundId: selectedRoundId || undefined,
        isThai,
        minBet: 1,
        maxBet: 5000,
        maxUserLimit,
        discountPercent: 10,
        totalRiskBudget: globalRiskBudget,
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
      const flatRates: Record<string, number> = {};
      const minBets: Record<string, number> = {};
      const maxBets: Record<string, number> = {};
      const maxPerUsers: Record<string, number> = {};
      intakeItems.forEach(item => {
        flatRates[item.name] = Number(item.baseRate) || 0;
        minBets[item.name] = Number(item.minBet) || 1;
        maxBets[item.name] = Number(item.maxBet) || 5000;
        maxPerUsers[item.name] = Number(item.maxBetPerUser) || 50000;
      });
      await setDoc(doc(db, 'lotteryTypes', selectedLottery), {
        rates: flatRates,
        minBets,
        maxBets,
        maxPerUsers,
        subItems: intakeItems,
        discountPercent: 10,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setMessage({ text: `บันทึกการตั้งค่าสำหรับ ${selectedLottery} สำเร็จแล้ว (จ่ายเต็ม 100% / ล็อคส่วนลด 10%)`, type: 'success' });
      onLogActivity?.('ตั้งค่าหวย & อัตราจ่าย', `บันทึกอัตราจ่ายและเพดานเดิมพันของ ${selectedLottery}`, 'settings');
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

          {/* ป้ายแจ้งเตือนระบบส่วนลดล็อคคงที่ 10% จ่ายเต็ม 100% */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 p-3.5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-emerald-600 text-xl">lock</span>
              <div>
                <span className="text-xs font-black text-emerald-950">
                  ระบบส่วนลดถูกล็อคคงที่ 10% • อัตราจ่าย 100% เต็ม (เช่น 3 ตัวบน ฿{intakeItems.find(i => i.name === '3 ตัวบน')?.baseRate || 900} / 2 ตัวบน ฿{intakeItems.find(i => i.name === '2 ตัวบน')?.baseRate || 92} จ่ายเต็ม ไม่มีหักลดทอน)
                </span>
                <p className="text-[11px] text-emerald-700">
                  ตั้งอัตราจ่ายเท่าไหร่ สมาชิกได้รับรางวัลเต็มจำนวน 100% ตามที่กำหนด
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black tracking-wide whitespace-nowrap shadow-sm">
              🔒 จ่ายเต็ม 100%
            </span>
          </div>

          {/* ตารางอัตราจ่ายและเพดานเดิมพัน */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase font-black">
                  <th className="py-3 px-4">ประเภทเดิมพัน</th>
                  <th className="py-3 px-4 text-center">อัตราจ่ายเต็ม (บาท)</th>
                  <th className="py-3 px-4 text-center">แทงขั้นต่ำ (บาท)</th>
                  <th className="py-3 px-4 text-center">แทงสูงสุดต่อบิล (บาท)</th>
                  <th className="py-3 px-4 text-center bg-blue-50/70 text-blue-900 border-x border-blue-100">
                    แทงสูงสุดต่อยูส (บาท)
                  </th>
                  <th className="py-3 px-4 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-bold">
                {intakeItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-blue-50/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span className="font-black text-slate-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        value={item.baseRate}
                        onChange={(e) => handleBaseRateChange(idx, Number(e.target.value) || 0)}
                        className="w-24 text-center py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-blue-700 outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        value={item.minBet}
                        onChange={(e) => handleItemFieldChange(idx, 'minBet', Number(e.target.value) || 1)}
                        className="w-20 text-center py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <input
                        type="number"
                        value={item.maxBet}
                        onChange={(e) => handleItemFieldChange(idx, 'maxBet', Number(e.target.value) || 5000)}
                        className="w-24 text-center py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4 text-center bg-blue-50/30 border-x border-blue-100">
                      <input
                        type="number"
                        value={item.maxBetPerUser ?? 50000}
                        onChange={(e) => handleItemFieldChange(idx, 'maxBetPerUser', Number(e.target.value) || 0)}
                        className="w-28 text-center py-1.5 px-2 bg-white border border-blue-300 rounded-lg text-xs font-black text-blue-800 outline-none focus:border-blue-600 shadow-2xs"
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
