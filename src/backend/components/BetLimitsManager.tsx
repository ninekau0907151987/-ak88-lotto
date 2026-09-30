import React, { useState, useEffect } from 'react';
import LotteryCategorySelector from './LotteryCategorySelector';

interface SubTypeLimit {
  baseRate: number;
  minBet: number;
  maxBet: number;
  maxExposure: number;
  enabled?: boolean;
}

interface LimitsData {
  lotteryId: string;
  category: 'thai' | 'other';
  minBet: number;
  maxBet: number;
  maxUserLimit: number;
  totalRiskBudget: number;
  subTypes: Record<string, SubTypeLimit>;
}

const DEFAULT_THAI_TYPES = [
  '3 ตัวบน', '3 ตัวโต๊ด', '3 ตัวหน้า', '3 ตัวล่าง', '3 ตัวกลับ',
  '2 ตัวบน', '2 ตัวล่าง', '2 ตัวกลับ', '2 ตัวโต๊ด',
  'วิ่งบน', 'วิ่งล่าง',
  'ปักหลักหน่วย', 'ปักหลักสิบ', 'ปักหลักร้อย'
];

const DEFAULT_OTHER_TYPES = [
  '3 ตัวบน', '3 ตัวโต๊ด', '3 ตัวกลับ',
  '2 ตัวบน', '2 ตัวล่าง', '2 ตัวกลับ', '2 ตัวโต๊ด',
  'วิ่งบน', 'วิ่งล่าง',
  'ปักหลักหน่วย', 'ปักหลักสิบ', 'ปักหลักร้อย'
];

interface Props {
  lotteryTypes?: Record<string, any>;
  onLogActivity?: (action: string, details: string, type: string) => void;
}

export default function BetLimitsManager({ lotteryTypes = {}, onLogActivity }: Props) {
  const lottoList = Object.keys(lotteryTypes).length > 0
    ? Object.keys(lotteryTypes)
    : ['หวยรัฐบาลไทย', 'หวยลาวพัฒนา', 'หวยฮานอยพิเศษ', 'หวยมาเลย์ 4D', 'หวยหุ้นไทย'];

  const [selectedLottery, setSelectedLottery] = useState<string>(lottoList[0] || 'หวยรัฐบาลไทย');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [limits, setLimits] = useState<LimitsData>({
    lotteryId: 'หวยรัฐบาลไทย',
    category: 'thai',
    minBet: 1,
    maxBet: 5000,
    maxUserLimit: 20000,
    totalRiskBudget: 200000,
    subTypes: {}
  });

  // Quick Action State (Step 3)
  const [quickBetType, setQuickBetType] = useState('2 ตัวบน');
  const [quickAction, setQuickAction] = useState<'discount_100_random' | 'discount_custom' | 'close_custom' | 'restore'>('discount_100_random');
  const [quickDiscountRate, setQuickDiscountRate] = useState<number>(70);
  const [quickTargetNumber, setQuickTargetNumber] = useState('');
  const [quickExecuting, setQuickExecuting] = useState(false);

  // Risk Calculation State (Step 4)
  const [riskBudgetInput, setRiskBudgetInput] = useState<number>(200000);
  const [riskResults, setRiskResults] = useState<any[]>([]);
  const [calculatingRisk, setCalculatingRisk] = useState(false);

  const isThai = selectedLottery.includes('ไทย') || selectedLottery.includes('รัฐบาล');
  const activeSubTypesList = isThai ? DEFAULT_THAI_TYPES : DEFAULT_OTHER_TYPES;

  // Fetch Bet Limits from API
  const fetchLimits = async (id: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/lottery/limits/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setLimits(json.data);
        setRiskBudgetInput(json.data.totalRiskBudget || 200000);
      }
    } catch (err: any) {
      console.warn('Could not fetch limits from API, using defaults:', err.message);
      // Fallback local initial state
      const initialSubs: Record<string, SubTypeLimit> = {};
      activeSubTypesList.forEach(t => {
        const is3D = t.includes('3 ตัว');
        const is2D = t.includes('2 ตัว');
        initialSubs[t] = {
          baseRate: is3D ? 900 : is2D ? 90 : 3.2,
          minBet: 1,
          maxBet: is3D ? 2000 : is2D ? 5000 : 10000,
          maxExposure: is3D ? 50000 : is2D ? 100000 : 200000,
          enabled: true,
        };
      });
      setLimits({
        lotteryId: id,
        category: isThai ? 'thai' : 'other',
        minBet: 1,
        maxBet: 5000,
        maxUserLimit: 20000,
        totalRiskBudget: 200000,
        subTypes: initialSubs,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLimits(selectedLottery);
  }, [selectedLottery]);

  // Save Bet Limits to API
  const handleSaveLimits = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/lottery/limits/${encodeURIComponent(selectedLottery)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(limits),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMessage({ text: 'บันทึกการตั้งค่าขีดจำกัดเดิมพันเรียบร้อยแล้ว', type: 'success' });
        onLogActivity?.('ตั้งค่าขีดจำกัด', `ปรับขีดจำกัดเดิมพันของ ${selectedLottery}`, 'settings');
      } else {
        throw new Error(data.message || 'บันทึกไม่สำเร็จ');
      }
    } catch (err: any) {
      setMessage({ text: 'เกิดข้อผิดพลาด: ' + err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Quick Number Action API (Step 3)
  const handleExecuteQuickAction = async () => {
    if ((quickAction === 'discount_custom' || quickAction === 'close_custom' || quickAction === 'restore') && !quickTargetNumber.trim()) {
      alert('กรุณากรอกเลขที่ต้องการจัดการ');
      return;
    }

    setQuickExecuting(true);
    try {
      const res = await fetch('/api/v1/lottery/quick-number-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotteryId: selectedLottery,
          betType: quickBetType,
          action: quickAction,
          discountRate: quickDiscountRate,
          targetNumber: quickTargetNumber.trim(),
          quantity: 100,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message || 'ดำเนินการสำเร็จ');
        onLogActivity?.('จัดการตัวเลขด่วน', `${quickAction} ใน ${selectedLottery} (${quickBetType})`, 'lottery');
        setQuickTargetNumber('');
      } else {
        alert(json.message || 'เกิดข้อผิดพลาดในการดำเนินการ');
      }
    } catch (err: any) {
      alert('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ: ' + err.message);
    } finally {
      setQuickExecuting(false);
    }
  };

  // Calculate Risk Limits API (Step 4)
  const handleCalculateRisk = async () => {
    setCalculatingRisk(true);
    try {
      const res = await fetch('/api/v1/lottery/calculate-risk-limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotteryId: selectedLottery,
          betType: quickBetType,
          totalRiskBudget: riskBudgetInput,
        }),
      });
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setRiskResults(json.data.sampleCalculations || []);
        setLimits(prev => ({ ...prev, totalRiskBudget: riskBudgetInput }));
      } else {
        alert(json.message || 'คำนวณไม่สำเร็จ');
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการคำนวณ: ' + err.message);
    } finally {
      setCalculatingRisk(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="admin-card p-6 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[var(--admin-accent)] border border-blue-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">tune</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-[var(--admin-text)]">
              หมวดตั้งค่าขีดจำกัดเดิมพัน & คำนวณรับกิน (Bet Limits & Risk Intake)
            </h2>
            <p className="text-xs text-[var(--admin-text-muted)]">
              กำหนดขีดจำกัดเดิมพัน 14 ประเภท (หวยไทย) / 12 ประเภท (หวยอื่น) พร้อมระบบ Guard บล็อกการแทงเกินเพดาน
            </p>
          </div>
        </div>

          <span className={`px-3.5 py-1.5 rounded-full text-xs font-black border ${
            isThai 
              ? 'bg-blue-50 text-blue-700 border-blue-200' 
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {isThai ? '🇹🇭 14 ประเภทย่อย' : '🌏 12 ประเภทย่อย'}
          </span>
        </div>


      {/* Unified Category Tabs & Small Sub-lottery Buttons */}
      <LotteryCategorySelector
        selectedLottery={selectedLottery}
        onSelectLottery={setSelectedLottery}
        lotterySettings={lotteryTypes}
        title="เลือกหมวดหมู่และประเภทหวยสำหรับตั้งค่าขีดจำกัด"
      />

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

      {/* Global Limit Settings (4 Key Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="admin-card p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-blue-600">arrow_downward</span>
            เดิมพันขั้นต่ำ (minBet)
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min="1"
              value={limits.minBet}
              onChange={(e) => setLimits({ ...limits, minBet: Math.max(1, Number(e.target.value)) })}
              className="w-full text-lg font-black text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white"
            />
            <span className="text-xs font-bold text-slate-400">บาท</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">ขั้นต่ำต่อ 1 รายการแทง</p>
        </div>

        <div className="admin-card p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-blue-600">arrow_upward</span>
            สูงสุดต่อรายการ (maxBet)
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min="1"
              value={limits.maxBet}
              onChange={(e) => setLimits({ ...limits, maxBet: Math.max(1, Number(e.target.value)) })}
              className="w-full text-lg font-black text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white"
            />
            <span className="text-xs font-bold text-slate-400">บาท</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">เพดานสูงสุดต่อ 1 บิล</p>
        </div>

        <div className="admin-card p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-blue-600">person</span>
            เพดานรวมต่อสมาชิก (maxUserLimit)
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min="1"
              value={limits.maxUserLimit}
              onChange={(e) => setLimits({ ...limits, maxUserLimit: Math.max(1, Number(e.target.value)) })}
              className="w-full text-lg font-black text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white"
            />
            <span className="text-xs font-bold text-slate-400">บาท</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Guard จะบล็อกถ้าแทงเกินงวดนี้</p>
        </div>

        <div className="admin-card p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-blue-600">shield</span>
            งบรับกินรวม (Risk Budget)
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min="1000"
              value={limits.totalRiskBudget}
              onChange={(e) => setLimits({ ...limits, totalRiskBudget: Math.max(1000, Number(e.target.value)) })}
              className="w-full text-lg font-black text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white"
            />
            <span className="text-xs font-bold text-slate-400">บาท</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">ใช้คำนวณเพดานรับกินรายเลข</p>
        </div>
      </div>

      {/* Table of Sub-types (Requested: ตารางเรียงลำดับ ไม่เอาช่องเยอะๆ) */}
      <div className="admin-card bg-white overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-blue-600">table_rows</span>
              ตารางกำหนดขีดจำกัดแยกตามประเภท ({activeSubTypesList.length} รายการ)
            </h3>
            <p className="text-[11px] text-slate-500">ปรับอัตราจ่าย ขั้นต่ำ สูงสุด และเพดานรับกิน (Exposure Limit) แยกรายประเภทการแทง</p>
          </div>

          <button
            onClick={handleSaveLimits}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition flex items-center gap-1.5 active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">{saving ? 'sync' : 'save'}</span>
            {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าขีดจำกัด'}
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs font-bold">กำลังโหลดข้อมูลขีดจำกัด...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs admin-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600">
                  <th className="py-3 px-4 font-black w-12 text-center">#</th>
                  <th className="py-3 px-4 font-black">ประเภทการแทง</th>
                  <th className="py-3 px-4 font-black">อัตราจ่าย (บาท)</th>
                  <th className="py-3 px-4 font-black">เดิมพันขั้นต่ำ</th>
                  <th className="py-3 px-4 font-black">เดิมพันสูงสุด/โพย</th>
                  <th className="py-3 px-4 font-black">เพดานรับกินสูงสุด (Exposure)</th>
                  <th className="py-3 px-4 font-black text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeSubTypesList.map((type, idx) => {
                  const sub = limits.subTypes?.[type] || {
                    baseRate: type.includes('3 ตัว') ? 900 : type.includes('2 ตัว') ? 90 : 3.2,
                    minBet: limits.minBet || 1,
                    maxBet: limits.maxBet || 5000,
                    maxExposure: 50000,
                    enabled: true,
                  };

                  return (
                    <tr key={type} className="hover:bg-blue-50/30 transition">
                      <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-black text-slate-800 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        {type}
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          step="any"
                          value={sub.baseRate}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLimits(prev => ({
                              ...prev,
                              subTypes: {
                                ...prev.subTypes,
                                [type]: { ...sub, baseRate: val }
                              }
                            }));
                          }}
                          className="w-24 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          value={sub.minBet}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLimits(prev => ({
                              ...prev,
                              subTypes: {
                                ...prev.subTypes,
                                [type]: { ...sub, minBet: val }
                              }
                            }));
                          }}
                          className="w-24 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          value={sub.maxBet}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLimits(prev => ({
                              ...prev,
                              subTypes: {
                                ...prev.subTypes,
                                [type]: { ...sub, maxBet: val }
                              }
                            }));
                          }}
                          className="w-28 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="number"
                          value={sub.maxExposure}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setLimits(prev => ({
                              ...prev,
                              subTypes: {
                                ...prev.subTypes,
                                [type]: { ...sub, maxExposure: val }
                              }
                            }));
                          }}
                          className="w-32 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                        />
                      </td>
                      <td className="py-2 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setLimits(prev => ({
                              ...prev,
                              subTypes: {
                                ...prev.subTypes,
                                [type]: { ...sub, enabled: sub.enabled === false ? true : false }
                              }
                            }));
                          }}
                          className={`px-3 py-1 rounded-full text-[10px] font-black border transition ${
                            sub.enabled !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                        >
                          {sub.enabled !== false ? 'เปิดรับแทง' : 'ปิดรับ'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two Columns: Step 3 (Quick Number Action) & Step 4 (Risk Intake Calculation) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 3: Quick Number Action */}
        <div className="admin-card p-6 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-black">
                <span className="material-symbols-outlined text-xl">flash_on</span>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">
                  ฟังก์ชันขั้นตอนที่ 3: จัดการตัวเลขด่วน (Quick Number Action)
                </h3>
                <p className="text-[11px] text-slate-500">สุ่มลดอัตราจ่าย หรือเจาะจงรายเลขเพื่อปรับลด/ปิดรับแทงทันที</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-slate-600 mb-1 block">ประเภทการแทง</label>
                  <select
                    value={quickBetType}
                    onChange={(e) => setQuickBetType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {activeSubTypesList.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-600 mb-1 block">รูปแบบคำสั่ง</label>
                  <select
                    value={quickAction}
                    onChange={(e: any) => setQuickAction(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="discount_100_random">🎲 สุ่ม 100 เลข เพื่อปรับลดอัตราจ่าย</option>
                    <option value="discount_custom">🎯 เจาะจงเลข เพื่อลดอัตราจ่าย</option>
                    <option value="close_custom">🚫 เจาะจงเลข เพื่อปิดรับแทงทันที</option>
                    <option value="restore">🔄 ปลดล็อกเลข คืนค่าเดิม</option>
                  </select>
                </div>
              </div>

              {quickAction !== 'close_custom' && quickAction !== 'restore' && (
                <div>
                  <label className="text-xs font-black text-slate-600 mb-1 block">อัตราจ่ายใหม่ที่ต้องการลด</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={quickDiscountRate}
                      onChange={(e) => setQuickDiscountRate(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
                      placeholder="เช่น 70 บาท"
                    />
                    <span className="text-xs font-bold text-slate-400">บาท</span>
                  </div>
                </div>
              )}

              {quickAction !== 'discount_100_random' && (
                <div>
                  <label className="text-xs font-black text-slate-600 mb-1 block">ระบุตัวเลข (เช่น 88 หรือ 123)</label>
                  <input
                    type="text"
                    value={quickTargetNumber}
                    onChange={(e) => setQuickTargetNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
                    placeholder="กรอกตัวเลขที่ต้องการระงับหรือลดอัตราจ่าย"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleExecuteQuickAction}
              disabled={quickExecuting}
              className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">{quickExecuting ? 'sync' : 'bolt'}</span>
              {quickExecuting ? 'กำลังดำเนินการ...' : 'สั่งการตัวเลขทันที'}
            </button>
          </div>
        </div>

        {/* Step 4: Calculate Risk Limits */}
        <div className="admin-card p-6 bg-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-black">
                <span className="material-symbols-outlined text-xl">calculate</span>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">
                  ฟังก์ชันขั้นตอนที่ 4: คำนวณเพดานรับกินรายเลข (Risk Intake)
                </h3>
                <p className="text-[11px] text-slate-500">
                  สูตร: เพดานรับกินรายเลข = งบรับกินรวม (Total Risk Budget) ÷ อัตราจ่ายปัจจุบัน
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs font-black text-slate-600 mb-1 block">งบรับกินรวมสำหรับการจำลอง</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={riskBudgetInput}
                      onChange={(e) => setRiskBudgetInput(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
                    />
                    <span className="text-xs font-bold text-slate-400">บาท</span>
                  </div>
                </div>

                <button
                  onClick={handleCalculateRisk}
                  disabled={calculatingRisk}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm transition flex items-center gap-1 h-[38px] active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">{calculatingRisk ? 'sync' : 'play_arrow'}</span>
                  {calculatingRisk ? 'คำนวณ...' : 'คำนวณเพดาน'}
                </button>
              </div>

              {/* Sample Calculation Result Box */}
              {riskResults.length > 0 ? (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="text-[11px] font-black text-slate-700 flex items-center justify-between">
                    <span>ผลลัพธ์การคำนวณจำลอง:</span>
                    <span className="text-blue-600">งบ ฿{riskBudgetInput.toLocaleString()}</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {riskResults.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-slate-100">
                        <span className="font-bold text-slate-800">{item.betType}</span>
                        <div className="text-right">
                          <span className="text-slate-500 text-[11px]">จ่าย ฿{item.baseRate} → </span>
                          <span className="font-black text-emerald-700">รับได้ ฿{item.maxIntakePerNumber?.toLocaleString()} / เลข</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                  กดปุ่ม "คำนวณเพดาน" เพื่อดูตัวเลขจำลองเพดานรับกินรายเลขตามอัตราจ่าย
                </div>
              )}
            </div>
          </div>

          <div className="pt-5 mt-5 border-t border-slate-100 text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-blue-500">info</span>
            ระบบ Guard ใน betting.service.ts จะใช้ค่าเพดานเหล่านี้ตรวจจับและสกัดกั้นการแทงอัตโนมัติ
          </div>
        </div>
      </div>
    </div>
  );
}
