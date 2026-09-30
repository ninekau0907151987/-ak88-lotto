import React, { useState, useEffect } from 'react';
import LotteryCategorySelector from './LotteryCategorySelector';

interface IntakeItem {
  id: number;
  name: string;
  baseRate: number;            // อัตราจ่ายเต็ม
  discountPercent: number;     // ส่วนลด %
  discountedRate: number;      // อัตราจ่ายเมื่อมีส่วนลด
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

  const fetchIntakeSettings = async (lotId: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/lottery/limits/${encodeURIComponent(lotId)}`);
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        const subs = json.data.subItems || [];
        setIntakeItems(subs.map((s: any) => ({
          id: s.id,
          name: s.name,
          baseRate: Number(s.baseRate) || (s.name.includes('3 ตัว') ? 900 : s.name.includes('2 ตัว') ? 90 : 3.2),
          discountPercent: Number(s.discountPercent) || (s.name.includes('3 ตัว') ? 30 : s.name.includes('2 ตัว') ? 28 : 12),
          discountedRate: Number(s.discountedRate) || (s.name.includes('3 ตัว') ? 550 : s.name.includes('2 ตัว') ? 70 : 2.8),
          maxIntakePerNumber: Number(s.maxIntakePerNumber) || (s.name.includes('3 ตัว') ? 1000 : s.name.includes('2 ตัว') ? 3000 : 10000),
          totalTypeBudget: Number(s.totalTypeBudget) || (s.name.includes('3 ตัว') ? 50000 : 100000),
          minBet: Number(s.minBet) || 1,
          maxBet: Number(s.maxBet) || 5000,
          enabled: s.enabled !== false,
        })));
        setGlobalRiskBudget(Number(json.data.totalRiskBudget) || 200000);
        setMaxUserLimit(Number(json.data.maxUserLimit) || 50000);
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
        setMessage({ text: 'บันทึกการตั้งค่าระบบรับกิน อัตราจ่าย และส่วนลดสำเร็จแล้ว', type: 'success' });
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

  const handleItemChange = (idx: number, field: keyof IntakeItem, value: any) => {
    const updated = [...intakeItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setIntakeItems(updated);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="admin-card p-6 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">tune</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">
              ตั้งค่ารับกิน & ขีดจำกัดเดิมพัน (Risk Intake Settings)
            </h2>
            <p className="text-xs text-slate-500">
              กำหนดว่าต้องการ "กินตัวละเท่าไหร่" ตั้งค่างบรับกินรวม อัตราจ่ายเต็ม ส่วนลด % และอัตราจ่ายเมื่อมีส่วนลด
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


      {/* Unified Category Tabs & Small Sub-lottery Buttons */}
      <LotteryCategorySelector
        selectedLottery={selectedLottery}
        onSelectLottery={setSelectedLottery}
        lotterySettings={lotteryTypes}
        title="เลือกหมวดหมู่และประเภทหวยสำหรับตั้งค่ารับกิน"
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

      {/* 4 Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="admin-card p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-blue-600">account_balance_wallet</span>
            งบรับกินรวมทั้งระบบ (Total Budget)
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              value={globalRiskBudget}
              onChange={(e) => setGlobalRiskBudget(Number(e.target.value))}
              className="w-full text-lg font-black text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:bg-white"
            />
            <span className="text-xs font-bold text-slate-400">บาท</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">งบสำรองความเสี่ยงสูงสุดต่องวด</p>
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
            สถานะ Guard รับกินรายเลข
          </div>
          <div className="text-sm font-black text-blue-700 mt-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
            ACTIVE (สกัดกั้นอัตโนมัติ)
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">บล็อกหรือปรับเรทเมื่อตัวเลขเต็มเพดานรับกิน</p>
        </div>
      </div>

      {/* Main Table: ระบบตั้งค่ารับกิน อัตราจ่าย และส่วนลด */}
      <div className="admin-card bg-white overflow-hidden shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-blue-600">table_chart</span>
              ตารางตั้งค่ารับกิน & อัตราจ่ายและส่วนลด ({intakeItems.length} ประเภท)
            </h3>
            <p className="text-[11px] text-slate-500">
              กำหนดว่าต้องการ "กินตัวละเท่าไหร่" พร้อมตั้งค่าอัตราจ่ายเต็ม ส่วนลด % และอัตราจ่ายเมื่อมีส่วนลด
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
                <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700">
                  <th className="py-3 px-3 font-black w-10 text-center">#</th>
                  <th className="py-3 px-3 font-black">ประเภทการแทง</th>
                  <th className="py-3 px-3 font-black">อัตราจ่ายเต็ม (บาท)</th>
                  <th className="py-3 px-3 font-black">ส่วนลด (%)</th>
                  <th className="py-3 px-3 font-black">จ่ายเมื่อมีส่วนลด (บาท)</th>
                  <th className="py-3 px-3 font-black bg-blue-50/60 text-blue-900 border-x border-blue-100">
                    🎯 กินตัวละเท่าไหร่ (บาท)
                  </th>
                  <th className="py-3 px-3 font-black">งบรับกินรวมประเภทนี้ (บาท)</th>
                  <th className="py-3 px-3 font-black text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {intakeItems.map((item, idx) => (
                  <tr key={item.name} className="hover:bg-blue-50/20 transition">
                    <td className="py-3 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3 font-black text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      {item.name}
                    </td>

                    {/* อัตราจ่ายเต็ม */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          value={item.baseRate}
                          onChange={(e) => handleItemChange(idx, 'baseRate', Number(e.target.value))}
                          className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                        />
                        <span className="text-[11px] text-slate-400">฿</span>
                      </div>
                    </td>

                    {/* ส่วนลด % */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={item.discountPercent}
                          onChange={(e) => handleItemChange(idx, 'discountPercent', Number(e.target.value))}
                          className="w-16 px-2 py-1.5 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs font-black text-emerald-800 outline-none focus:border-emerald-600 focus:bg-white"
                        />
                        <span className="text-[11px] font-bold text-emerald-600">%</span>
                      </div>
                    </td>

                    {/* อัตราจ่ายเมื่อมีส่วนลด */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          value={item.discountedRate}
                          onChange={(e) => handleItemChange(idx, 'discountedRate', Number(e.target.value))}
                          className="w-20 px-2 py-1.5 bg-amber-50/50 border border-amber-200 rounded-lg text-xs font-bold text-amber-900 outline-none focus:border-amber-600 focus:bg-white"
                        />
                        <span className="text-[11px] text-slate-400">฿</span>
                      </div>
                    </td>

                    {/* ★ กินตัวละเท่าไหร่ (Intake per number) */}
                    <td className="py-2 px-3 bg-blue-50/30 border-x border-blue-100">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={item.maxIntakePerNumber}
                          onChange={(e) => handleItemChange(idx, 'maxIntakePerNumber', Number(e.target.value))}
                          className="w-24 px-2 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-black text-blue-900 outline-none focus:ring-1 focus:ring-blue-600"
                        />
                        <span className="text-[11px] font-bold text-blue-700">฿/ตัว</span>
                      </div>
                    </td>

                    {/* งบรับกินรวมประเภทนี้ */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={item.totalTypeBudget}
                          onChange={(e) => handleItemChange(idx, 'totalTypeBudget', Number(e.target.value))}
                          className="w-28 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                        />
                        <span className="text-[11px] text-slate-400">฿</span>
                      </div>
                    </td>

                    {/* สถานะรับกิน */}
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleItemChange(idx, 'enabled', item.enabled === false ? true : false)}
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
