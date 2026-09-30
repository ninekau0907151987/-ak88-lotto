import React, { useState, useEffect, useMemo } from 'react';
import LotteryCategorySelector from './LotteryCategorySelector';

interface IntakeItem {
  id: number;
  name: string;
  baseRate: number;            // อัตราจ่ายเต็ม
  discountPercent: number;     // ส่วนลด %
  discountedRate: number;      // อัตราจ่ายเมื่อมีส่วนลด
  allocationPercent: number;   // สัดส่วนรับกิน % (รวมกันได้ 100%)
  maxIntakePerNumber: number;  // กินตัวละเท่าไหร่ (บาท)
  totalTypeBudget: number;     // งบรับกินรวมประเภทนี้ (บาท)
  minBet: number;
  maxBet: number;
  enabled?: boolean;
}

interface Props {
  lotteryTypes?: Record<string, any>;
  onLogActivity?: (action: string, details: string, type: string) => void;
}

// สัดส่วนเริ่มต้นรวมกันได้ 100% สำหรับหวยไทย 14 ประเภท
const DEFAULT_THAI_ALLOCATIONS: Record<string, number> = {
  '3 ตัวบน': 30,
  '3 ตัวล่าง': 15,
  '3 ตัวโต๊ด': 10,
  '2 ตัวบน': 20,
  '2 ตัวล่าง': 15,
  '2 ตัวโต๊ด': 4,
  'วิ่งบน': 2,
  'วิ่งล่าง': 2,
  'ปักหลักร้อย': 0.5,
  'ปักหลักสิบ': 0.5,
  'ปักหลักหน่วย': 0.5,
  '4 ตัวบน': 0.3,
  '4 ตัวโต๊ด': 0.1,
  '5 ตัวโต๊ด': 0.1,
};

// สัดส่วนเริ่มต้นรวมกันได้ 100% สำหรับหวยอื่น 12 ประเภท
const DEFAULT_OTHER_ALLOCATIONS: Record<string, number> = {
  '3 ตัวบน': 35,
  '3 ตัวโต๊ด': 10,
  '2 ตัวบน': 25,
  '2 ตัวล่าง': 20,
  '2 ตัวโต๊ด': 4,
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isThai = selectedLottery.includes('ไทย') || selectedLottery.includes('รัฐบาล');

  const [intakeItems, setIntakeItems] = useState<IntakeItem[]>([]);
  const [globalRiskBudget, setGlobalRiskBudget] = useState<number>(200000);
  const [maxUserLimit, setMaxUserLimit] = useState<number>(50000);

  // คำนวณผลรวมสัดส่วน % ที่จัดสรรไปแล้ว
  const totalAllocatedPercent = useMemo(() => {
    const sum = intakeItems.reduce((acc, curr) => acc + (Number(curr.allocationPercent) || 0), 0);
    return Number(sum.toFixed(1));
  }, [intakeItems]);

  const remainingPercent = useMemo(() => {
    return Number(Math.max(0, 100 - totalAllocatedPercent).toFixed(1));
  }, [totalAllocatedPercent]);

  const fetchIntakeSettings = async (lotId: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/lottery/limits/${encodeURIComponent(lotId)}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const subs = json.data.subItems || [];
        const isThaiLotto = lotId.includes('ไทย') || lotId.includes('รัฐบาล');
        const defaultMap = isThaiLotto ? DEFAULT_THAI_ALLOCATIONS : DEFAULT_OTHER_ALLOCATIONS;

        const gBudget = Number(json.data.totalRiskBudget) || 200000;
        setGlobalRiskBudget(gBudget);
        setMaxUserLimit(Number(json.data.maxUserLimit) || 50000);

        setIntakeItems(subs.map((s: any) => {
          const allocPct = s.allocationPercent != null 
            ? Number(s.allocationPercent) 
            : (defaultMap[s.name] ?? (s.name.includes('3 ตัว') ? 25 : s.name.includes('2 ตัว') ? 20 : 2));
          const calculatedTypeBudget = Number(s.totalTypeBudget) || Math.round(gBudget * (allocPct / 100));

          return {
            id: s.id,
            name: s.name,
            baseRate: Number(s.baseRate) || (s.name.includes('3 ตัว') ? 900 : s.name.includes('2 ตัว') ? 90 : 3.2),
            discountPercent: Number(s.discountPercent) || (s.name.includes('3 ตัว') ? 30 : s.name.includes('2 ตัว') ? 28 : 12),
            discountedRate: Number(s.discountedRate) || (s.name.includes('3 ตัว') ? 550 : s.name.includes('2 ตัว') ? 70 : 2.8),
            allocationPercent: allocPct,
            maxIntakePerNumber: Number(s.maxIntakePerNumber) || (s.name.includes('3 ตัว') ? 1000 : s.name.includes('2 ตัว') ? 3000 : 10000),
            totalTypeBudget: calculatedTypeBudget,
            minBet: Number(s.minBet) || 1,
            maxBet: Number(s.maxBet) || 5000,
            enabled: s.enabled !== false,
          };
        }));
      }
    } catch (e: any) {
      console.warn('Fetch intake settings fallback:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntakeSettings(selectedLottery);
  }, [selectedLottery]);

  // เมื่อผู้ใช้เปลี่ยนงบรับกินรวมข้างบน (Global Budget) ให้หาร/คำนวณงบรายประเภทตามสัดส่วน % ทันที
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

  const handleSaveIntake = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/lottery/limits/${encodeURIComponent(selectedLottery)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotteryId: selectedLottery,
          isThai,
          minBet: 1,
          maxBet: 5000,
          maxUserLimit,
          totalRiskBudget: globalRiskBudget,
          subItems: intakeItems,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage({ text: 'บันทึกการตั้งค่าสัดส่วนรับกิน อัตราจ่าย และส่วนลดสำเร็จแล้ว', type: 'success' });
        onLogActivity?.('ตั้งค่าระบบรับกิน', `บันทึกเพดานรับกินและส่วนลดของ ${selectedLottery}`, 'settings');
      } else {
        throw new Error(data.message || 'บันทึกไม่สำเร็จ');
      }
    } catch (err: any) {
      setMessage({ text: 'เกิดข้อผิดพลาด: ' + err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="admin-card p-6 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">tune</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">
              ตั้งค่ารับกิน & สัดส่วนเปอร์เซ็นต์รวม 100% (Risk Intake Allocation & Margins)
            </h2>
            <p className="text-xs text-slate-500">
              ตั้งสัดส่วนรับกิน (%) แต่ละประเภทให้รวมกันได้ 100% เพื่อคำนวณวงเงินรับกินสูงสุด และอัตราจ่ายเมื่อมีส่วนลด
            </p>
          </div>
        </div>

        <span className={`px-3.5 py-1.5 rounded-full text-xs font-black border ${
          isThai 
            ? 'bg-blue-50 text-blue-700 border-blue-200' 
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          {isThai ? '🇹🇭 14 ประเภท (หวยไทย)' : '🌏 12 ประเภท (หวยอื่น)'}
        </span>
      </div>

      {/* 2. Unified Category Tabs & Small Sub-lottery Buttons */}
      <LotteryCategorySelector
        selectedLottery={selectedLottery}
        onSelectLottery={setSelectedLottery}
        lotterySettings={lotteryTypes}
        title="เลือกหมวดหมู่หวย (แท็บด้านบน) และเลือกหวยย่อย (ปุ่มขนาดเล็กด้านล่าง)"
      />

      {/* 3. แถบมาตรวัดสัดส่วนเปอร์เซ็นต์รวม 100% (100% Allocation Gauge Card) */}
      <div className={`p-5 rounded-2xl border shadow-sm transition space-y-3 ${
        totalAllocatedPercent === 100
          ? 'bg-emerald-50/60 border-emerald-300'
          : totalAllocatedPercent > 100
          ? 'bg-red-50/80 border-red-300'
          : 'bg-blue-50/50 border-blue-200'
      }`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2.5">
            <span className={`material-symbols-outlined text-2xl ${
              totalAllocatedPercent === 100 ? 'text-emerald-600' : totalAllocatedPercent > 100 ? 'text-red-600' : 'text-blue-700'
            }`}>
              {totalAllocatedPercent === 100 ? 'verified' : totalAllocatedPercent > 100 ? 'error' : 'pie_chart'}
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                สถานะการจัดสรรสัดส่วนรับกิน: 
                <span className={`text-base font-black ${
                  totalAllocatedPercent === 100 ? 'text-emerald-700' : totalAllocatedPercent > 100 ? 'text-red-700' : 'text-blue-800'
                }`}>
                  {totalAllocatedPercent}% / 100%
                </span>
              </h3>
              <p className="text-[11px] text-slate-600">
                {totalAllocatedPercent === 100 ? (
                  <span className="text-emerald-700 font-bold">✓ จัดสรรสัดส่วนครบ 100% เต็มวงเงินรับกินสูงสุดแล้ว</span>
                ) : totalAllocatedPercent > 100 ? (
                  <span className="text-red-700 font-bold">⚠️ สัดส่วนเกิน 100% (เกินมา {Number((totalAllocatedPercent - 100).toFixed(1))}%) กรุณาปรับลดให้เท่ากับ 100%</span>
                ) : (
                  <span>ยังเหลือสัดส่วนให้จัดสรรอีก <strong className="text-blue-700">{remainingPercent}%</strong></span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoBalance100}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-black shadow-2xs transition flex items-center gap-1 active:scale-95"
            >
              <span className="material-symbols-outlined text-sm text-blue-600">auto_fix_high</span>
              จัดสรรสัดส่วน 100% อัตโนมัติ
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 rounded-full bg-white border border-slate-200 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              totalAllocatedPercent === 100
                ? 'bg-emerald-500'
                : totalAllocatedPercent > 100
                ? 'bg-red-600'
                : 'bg-blue-600'
            }`}
            style={{ width: `${Math.min(100, totalAllocatedPercent)}%` }}
          />
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-bold border flex items-center justify-between ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-black">✕</button>
        </div>
      )}

      {/* 4 Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* งบรับกินรวม — ปรับเลขปุ๊บ หารลงตารางทันที */}
        <div className="admin-card p-5 bg-white border border-blue-200 shadow-sm ring-1 ring-blue-100">
          <div className="text-[11px] font-black text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-blue-600">account_balance_wallet</span>
            งบรับกินรวมทั้งระบบ (Total Budget)
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              value={globalRiskBudget}
              onChange={(e) => handleGlobalBudgetChange(Number(e.target.value))}
              className="w-full text-lg font-black text-blue-900 px-3 py-2 bg-blue-50/50 border border-blue-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
            <span className="text-xs font-bold text-slate-500">บาท</span>
          </div>
          <p className="text-[10px] text-blue-600 mt-1.5">★ ปรับเลขนี้ปุ๊บ ระบบจะคำนวณงบแยกตาม % ให้ทันที</p>
        </div>

        <div className="admin-card p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-blue-600">person</span>
            เพดานแทงสูงสุดต่อสมาชิก (User Limit)
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              value={maxUserLimit}
              onChange={(e) => setMaxUserLimit(Number(e.target.value))}
              className="w-full text-lg font-black text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white"
            />
            <span className="text-xs font-bold text-slate-400">บาท</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">บล็อกทันทีหากสมาชิกคนเดียวแทงเกินงวดนี้</p>
        </div>

        <div className="admin-card p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-emerald-600">percent</span>
            ส่วนลดเฉลี่ยของระบบ (Avg Discount)
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            {intakeItems.length > 0 
              ? Math.round(intakeItems.reduce((acc, curr) => acc + (curr.discountPercent || 0), 0) / intakeItems.length) 
              : 25}%
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">ส่วนลดสูงสุดสำหรับสมาชิก/เอเย่นต์</p>
        </div>

        <div className="admin-card p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-blue-600">security</span>
            สถานะ Guard สกัดกั้น
          </div>
          <div className="text-sm font-black text-blue-700 mt-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
            ACTIVE (คำนวณตาม %)
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">บล็อกเมื่อยอดแทงสะสมเต็มสัดส่วนรับกิน</p>
        </div>
      </div>

      {/* 5. Main Table: ตารางสัดส่วนเปอร์เซ็นต์รับกิน งบคำนวณ อัตราจ่าย และส่วนลด */}
      <div className="admin-card bg-white overflow-hidden shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-blue-600">table_chart</span>
              ตารางตั้งค่าสัดส่วนรับกิน & อัตราจ่ายและส่วนลด ({intakeItems.length} ประเภท)
            </h3>
            <p className="text-[11px] text-slate-500">
              กำหนดสัดส่วนรับกิน (%) เพื่อคำนวณงบรับกินอัตโนมัติ พร้อมตั้งค่าส่วนลด % และอัตราจ่ายเมื่อมีส่วนลด
            </p>
          </div>

          <button
            onClick={handleSaveIntake}
            disabled={saving}
            className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-black shadow-md shadow-blue-700/20 transition flex items-center gap-1.5 active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">{saving ? 'sync' : 'save'}</span>
            {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่ารับกิน'}
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400 text-xs font-bold">กำลังโหลดข้อมูลระบบรับกิน...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs admin-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700">
                  <th className="py-3 px-3 font-black w-10 text-center">#</th>
                  <th className="py-3 px-3 font-black">ประเภทการแทง</th>
                  
                  {/* คอลัมน์ตั้งรับเปอร์เซ็นต์ */}
                  <th className="py-3 px-3 font-black bg-blue-50/80 text-blue-900 border-x border-blue-200">
                    🎯 สัดส่วนรับกิน (%)
                  </th>
                  
                  {/* งบคำนวณจากเปอร์เซ็นต์ */}
                  <th className="py-3 px-3 font-black bg-blue-50/40 text-blue-900 border-r border-blue-100">
                    งบคำนวณ (บาท)
                  </th>

                  {/* กินตัวละเท่าไหร่ */}
                  <th className="py-3 px-3 font-black bg-amber-50/50 text-amber-900 border-r border-amber-100">
                    🎯 กินตัวละเท่าไหร่
                  </th>

                  <th className="py-3 px-3 font-black">อัตราจ่ายเต็ม (บาท)</th>

                  {/* คอลัมน์ส่วนลด */}
                  <th className="py-3 px-3 font-black bg-emerald-50/80 text-emerald-900 border-x border-emerald-200">
                    ส่วนลด (%)
                  </th>

                  {/* จ่ายเมื่อมีส่วนลด */}
                  <th className="py-3 px-3 font-black bg-emerald-50/40 text-emerald-900 border-r border-emerald-100">
                    จ่ายเมื่อมีส่วนลด (บาท)
                  </th>

                  <th className="py-3 px-3 font-black text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {intakeItems.map((item, idx) => (
                  <tr key={item.name} className="hover:bg-blue-50/20 transition">
                    <td className="py-3 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                    
                    {/* ประเภทการแทง */}
                    <td className="py-3 px-3 font-black text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        <span>{item.name}</span>
                      </div>
                    </td>

                    {/* 1. สัดส่วนรับกิน (%) จาก 100% */}
                    <td className="py-2 px-3 bg-blue-50/40 border-x border-blue-200">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={item.allocationPercent ?? 0}
                          onChange={(e) => handleAllocationChange(idx, Number(e.target.value))}
                          className="w-16 px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-black text-blue-900 outline-none focus:ring-2 focus:ring-blue-600 text-center"
                        />
                        <span className="text-xs font-black text-blue-700">%</span>
                      </div>
                    </td>

                    {/* 2. งบรับกินคำนวณจากเปอร์เซ็นต์ (คูณจากงบรวมอัตโนมัติ) */}
                    <td className="py-2 px-3 bg-blue-50/20 border-r border-blue-100 font-black text-blue-900">
                      ฿{Number(item.totalTypeBudget || 0).toLocaleString()}
                    </td>

                    {/* 3. กินตัวละเท่าไหร่ */}
                    <td className="py-2 px-3 bg-amber-50/30 border-r border-amber-100">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={item.maxIntakePerNumber}
                          onChange={(e) => handleItemFieldChange(idx, 'maxIntakePerNumber', Number(e.target.value))}
                          className="w-24 px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-black text-amber-900 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="text-[11px] font-bold text-amber-700">฿/ตัว</span>
                      </div>
                    </td>

                    {/* 4. อัตราจ่ายเต็ม */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          value={item.baseRate}
                          onChange={(e) => handleItemFieldChange(idx, 'baseRate', Number(e.target.value))}
                          className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                        />
                        <span className="text-[11px] text-slate-400">฿</span>
                      </div>
                    </td>

                    {/* 5. ส่วนลด (%) */}
                    <td className="py-2 px-3 bg-emerald-50/40 border-x border-emerald-200">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discountPercent}
                          onChange={(e) => handleDiscountChange(idx, Number(e.target.value))}
                          className="w-16 px-2 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-black text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-600 text-center"
                        />
                        <span className="text-[11px] font-bold text-emerald-700">%</span>
                      </div>
                    </td>

                    {/* 6. จ่ายเมื่อมีคำนวณส่วนลด (บาท) */}
                    <td className="py-2 px-3 bg-emerald-50/20 border-r border-emerald-100">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          value={item.discountedRate}
                          onChange={(e) => handleItemFieldChange(idx, 'discountedRate', Number(e.target.value))}
                          className="w-20 px-2 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        <span className="text-[11px] text-slate-400">฿</span>
                      </div>
                    </td>

                    {/* 7. สถานะรับกิน */}
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleItemFieldChange(idx, 'enabled', item.enabled === false ? true : false)}
                        className={`px-3 py-1 rounded-full text-[10px] font-black border transition ${
                          item.enabled !== false
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}
                      >
                        {item.enabled !== false ? 'เปิดรับกิน' : 'ปิดรับ'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
