import React, { useState, useEffect, useMemo } from 'react';

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

interface LiveBetNumber {
  number: string;
  type: string;
  intake: number;
  limit: number;
  statusOverride?: 'normal' | 'discounted' | 'closed';
  customRate?: number;
}

interface Props {
  lotteryTypes?: Record<string, any>;
  onLogActivity?: (action: string, details: string, type: string) => void;
}

export default function RiskIntakeManager({ lotteryTypes = {}, onLogActivity }: Props) {
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

  // Live monitor tabs & filters
  const [selectedMonitorType, setSelectedMonitorType] = useState<string>('all');
  const [monitorRiskFilter, setMonitorRiskFilter] = useState<'all' | 'full' | 'near' | 'normal'>('all');
  const [searchNumber, setSearchNumber] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Live monitor state with comprehensive numbers across various types
  const [liveBets, setLiveBets] = useState<LiveBetNumber[]>([
    // 3 ตัวบน
    { number: '789', type: '3 ตัวบน', intake: 850, limit: 1000 },
    { number: '168', type: '3 ตัวบน', intake: 1000, limit: 1000 },
    { number: '905', type: '3 ตัวบน', intake: 450, limit: 1000 },
    { number: '012', type: '3 ตัวบน', intake: 150, limit: 1000 },
    { number: '999', type: '3 ตัวบน', intake: 980, limit: 1000 },
    // 3 ตัวล่าง
    { number: '556', type: '3 ตัวล่าง', intake: 650, limit: 1000 },
    { number: '723', type: '3 ตัวล่าง', intake: 1000, limit: 1000 },
    { number: '104', type: '3 ตัวล่าง', intake: 320, limit: 1000 },
    // 3 ตัวโต๊ด
    { number: '123', type: '3 ตัวโต๊ด', intake: 1850, limit: 2000 },
    { number: '456', type: '3 ตัวโต๊ด', intake: 2000, limit: 2000 },
    { number: '890', type: '3 ตัวโต๊ด', intake: 900, limit: 2000 },
    // 2 ตัวบน
    { number: '88', type: '2 ตัวบน', intake: 2550, limit: 3000 },
    { number: '14', type: '2 ตัวบน', intake: 3000, limit: 3000 },
    { number: '69', type: '2 ตัวบน', intake: 1400, limit: 3000 },
    { number: '52', type: '2 ตัวบน', intake: 2900, limit: 3000 },
    { number: '99', type: '2 ตัวบน', intake: 800, limit: 3000 },
    // 2 ตัวล่าง
    { number: '95', type: '2 ตัวล่าง', intake: 3000, limit: 3000 },
    { number: '27', type: '2 ตัวล่าง', intake: 2200, limit: 3000 },
    { number: '03', type: '2 ตัวล่าง', intake: 950, limit: 3000 },
    { number: '76', type: '2 ตัวล่าง', intake: 2750, limit: 3000 },
    // 2 ตัวโต๊ด
    { number: '58', type: '2 ตัวโต๊ด', intake: 4800, limit: 5000 },
    { number: '34', type: '2 ตัวโต๊ด', intake: 2100, limit: 5000 },
    // วิ่งบน
    { number: '9', type: 'วิ่งบน', intake: 8900, limit: 10000 },
    { number: '5', type: 'วิ่งบน', intake: 10000, limit: 10000 },
    { number: '8', type: 'วิ่งบน', intake: 4500, limit: 10000 },
    // วิ่งล่าง
    { number: '2', type: 'วิ่งล่าง', intake: 6500, limit: 10000 },
    { number: '7', type: 'วิ่งล่าง', intake: 9500, limit: 10000 },
    // ปักหลัก
    { number: '7', type: 'ปักหลักร้อย', intake: 4200, limit: 5000 },
    { number: '4', type: 'ปักหลักสิบ', intake: 5000, limit: 5000 },
    { number: '1', type: 'ปักหลักหน่วย', intake: 1900, limit: 5000 },
    // 4 ตัวบน
    { number: '1234', type: '4 ตัวบน', intake: 450, limit: 500 },
    { number: '9999', type: '4 ตัวบน', intake: 500, limit: 500 },
  ]);

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

  // Quick Action on monitored numbers
  const handleQuickNumberToggle = async (bet: LiveBetNumber, action: 'close' | 'discount' | 'restore') => {
    const key = `${bet.type}-${bet.number}`;
    setActionLoading(key);
    try {
      let nextStatus: 'normal' | 'discounted' | 'closed' = 'normal';
      let apiAction: 'custom_close' | 'custom_discount' | 'custom_restore' = 'custom_restore';

      if (action === 'close') {
        nextStatus = 'closed';
        apiAction = 'custom_close';
      } else if (action === 'discount') {
        nextStatus = 'discounted';
        apiAction = 'custom_discount';
      } else {
        nextStatus = 'normal';
        apiAction = 'custom_restore';
      }

      // Call API
      await fetch('/api/v1/lottery/quick-number-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotteryId: selectedLottery,
          betType: bet.type,
          action: apiAction,
          targetNumber: bet.number,
          discountRate: action === 'discount' ? Math.round(bet.limit * 0.7) : undefined,
        }),
      });

      // Update local state
      setLiveBets(prev => prev.map(item => {
        if (item.number === bet.number && item.type === bet.type) {
          return { ...item, statusOverride: nextStatus };
        }
        return item;
      }));

      const actionText = action === 'close' ? 'ปิดรับแทง' : action === 'discount' ? 'ลดอัตราจ่าย' : 'ปลดล็อกคืนค่าปกติ';
      setMessage({ text: `${actionText}เลข ${bet.number} (${bet.type}) สำเร็จ`, type: 'success' });
      onLogActivity?.('จัดการตัวเลขด่วน', `${actionText}เลข ${bet.number} (${bet.type})`, 'security');
    } catch (e: any) {
      setMessage({ text: 'ดำเนินการไม่สำเร็จ: ' + e.message, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Extract unique bet types for the monitor tabs
  const monitorTabs = useMemo(() => {
    const typesInLive = Array.from(new Set(liveBets.map(b => b.type)));
    // Also include any types from intakeItems that might not be in liveBets yet
    intakeItems.forEach(it => {
      if (!typesInLive.includes(it.name)) typesInLive.push(it.name);
    });

    return [
      { id: 'all', label: 'ทั้งหมด', count: liveBets.length },
      ...typesInLive.map(t => {
        const count = liveBets.filter(b => b.type === t).length;
        const hasFull = liveBets.some(b => b.type === t && (b.intake >= b.limit || b.statusOverride === 'closed'));
        const hasNear = liveBets.some(b => b.type === t && b.intake / b.limit >= 0.8 && b.intake < b.limit);
        return { id: t, label: t, count, hasFull, hasNear };
      }),
    ];
  }, [liveBets, intakeItems]);

  // Filtered live bets based on: Type tab, Risk status, and Search number
  const filteredLiveBets = useMemo(() => {
    return liveBets.filter(b => {
      // 1. Type Tab Filter
      if (selectedMonitorType !== 'all' && b.type !== selectedMonitorType) {
        return false;
      }

      // 2. Risk Status Filter
      const pct = (b.intake / b.limit) * 100;
      const isFull = pct >= 100 || b.statusOverride === 'closed';
      const isNear = pct >= 80 && !isFull;
      const isNormal = !isFull && !isNear;

      if (monitorRiskFilter === 'full' && !isFull) return false;
      if (monitorRiskFilter === 'near' && !isNear) return false;
      if (monitorRiskFilter === 'normal' && !isNormal) return false;

      // 3. Search query
      if (searchNumber.trim() && !b.number.includes(searchNumber.trim())) {
        return false;
      }

      return true;
    });
  }, [liveBets, selectedMonitorType, monitorRiskFilter, searchNumber]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="admin-card p-6 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">shield_with_heart</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">
              ระบบรับกิน & ตั้งค่าอัตราจ่ายและส่วนลด (Risk Intake & Margin Control)
            </h2>
            <p className="text-xs text-slate-500">
              กำหนดเพดานรับกินต่อหมายเลข (กินตัวละเท่าไหร่) อัตราจ่ายเต็ม ส่วนลด % และมอนิเตอร์แยกแถบตามชนิด
            </p>
          </div>
        </div>

        {/* Lottery Selector */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs font-black text-slate-600 whitespace-nowrap">เลือกหวย:</label>
          <select
            value={selectedLottery}
            onChange={(e) => setSelectedLottery(e.target.value)}
            className="flex-1 md:w-56 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition"
          >
            {lottoList.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <span className={`px-3 py-1.5 rounded-full text-xs font-black border ${
            isThai 
              ? 'bg-blue-50 text-blue-700 border-blue-200' 
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {isThai ? '🇹🇭 14 ประเภท (หวยไทย)' : '🌏 12 ประเภท (หวยอื่น)'}
          </span>
        </div>
      </div>

      {/* Lottery Quick Switching Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {lottoList.map(name => {
          const isSelected = selectedLottery === name;
          return (
            <button
              key={name}
              onClick={() => setSelectedLottery(name)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition whitespace-nowrap flex items-center gap-2 border ${
                isSelected
                  ? 'bg-blue-700 text-white border-blue-700 shadow-sm shadow-blue-700/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <span>{name}</span>
            </button>
          );
        })}
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

      {/* ========================================================================= */}
      {/* ★ LIVE INTAKE MONITOR - แยกแถบตามชนิด (SEPARATED BY BET TYPE TABS) ★ */}
      {/* ========================================================================= */}
      <div className="admin-card p-6 bg-white shadow-sm space-y-5 border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-2xl">monitoring</span>
              <h3 className="text-base font-black text-slate-900">
                มอนิเตอร์ตรวจสอบยอดรับกินรายตัวเลข (Live Intake Monitor by Category)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              ติดตามตัวเลขที่มียอดแทงเข้ามา แยกแถบตามชนิดการแทง ตรวจสอบว่างวดนี้ "กินตัวละเท่าไหร่" และเหลือโควตาอีกเท่าไหร่
            </p>
          </div>

          {/* Quick Search */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-48">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
              <input
                type="text"
                value={searchNumber}
                onChange={(e) => setSearchNumber(e.target.value)}
                placeholder="ค้นหาเลข..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
            {searchNumber && (
              <button
                onClick={() => setSearchNumber('')}
                className="px-2.5 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                ล้าง
              </button>
            )}
          </div>
        </div>

        {/* 1. แถบแยกตามชนิดการแทง (Bet Type Tabs) */}
        <div className="space-y-2">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
            แถบชนิดการแทง (เลือกชนิดเพื่อดูตัวเลขเฉพาะหมวด):
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {monitorTabs.map((tab) => {
              const isActive = selectedMonitorType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedMonitorType(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition whitespace-nowrap flex items-center gap-2 border ${
                    isActive
                      ? 'bg-blue-700 text-white border-blue-700 shadow-sm shadow-blue-700/20'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                  {tab.hasFull && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" title="มีเลขเต็มเพดานรับกิน"></span>
                  )}
                  {tab.hasNear && !tab.hasFull && (
                    <span className="w-2 h-2 rounded-full bg-amber-400" title="มีเลขใกล้เต็ม"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. ตัวกรองสถานะความเสี่ยง (Risk Filter Buttons) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 mr-1">กรองสถานะ:</span>
          <button
            onClick={() => setMonitorRiskFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
              monitorRiskFilter === 'all'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            แสดงทั้งหมด ({liveBets.length})
          </button>

          <button
            onClick={() => setMonitorRiskFilter('full')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition border flex items-center gap-1.5 ${
              monitorRiskFilter === 'full'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            🔴 เต็มเพดานรับกิน ({liveBets.filter(b => b.intake >= b.limit || b.statusOverride === 'closed').length})
          </button>

          <button
            onClick={() => setMonitorRiskFilter('near')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition border flex items-center gap-1.5 ${
              monitorRiskFilter === 'near'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            🟡 ใกล้เต็ม 80-99% ({liveBets.filter(b => b.intake / b.limit >= 0.8 && b.intake < b.limit && b.statusOverride !== 'closed').length})
          </button>

          <button
            onClick={() => setMonitorRiskFilter('normal')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition border flex items-center gap-1.5 ${
              monitorRiskFilter === 'normal'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            🟢 ปกติ ({liveBets.filter(b => b.intake / b.limit < 0.8 && b.statusOverride !== 'closed').length})
          </button>
        </div>

        {/* 3. รายการตัวเลขในมอนิเตอร์ (Grid of Monitored Numbers) */}
        {filteredLiveBets.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <span className="material-symbols-outlined text-4xl text-slate-300">hourglass_empty</span>
            <p className="text-xs font-black text-slate-500 mt-2">ไม่พบตัวเลขในชนิดหรือเงื่อนไขที่เลือก</p>
            <p className="text-[11px] text-slate-400 mt-0.5">ลองเปลี่ยนแท็บชนิดการแทง หรือปลดตัวกรองสถานะ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredLiveBets.map((b, i) => {
              const percent = Math.min(100, Math.round((b.intake / b.limit) * 100));
              const isClosed = b.statusOverride === 'closed';
              const isDiscounted = b.statusOverride === 'discounted';
              const isFull = percent >= 100 || isClosed;
              const isNear = percent >= 80 && !isFull;
              const remaining = Math.max(0, b.limit - b.intake);
              const cardKey = `${b.type}-${b.number}`;
              const isProcessing = actionLoading === cardKey;

              return (
                <div
                  key={i}
                  className={`p-4 rounded-2xl border transition shadow-sm flex flex-col justify-between ${
                    isClosed
                      ? 'bg-red-50/70 border-red-300'
                      : isFull
                      ? 'bg-rose-50/40 border-rose-200'
                      : isNear
                      ? 'bg-amber-50/40 border-amber-200'
                      : 'bg-white border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header: Number & Type */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl font-black text-slate-900 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                          {b.number}
                        </span>
                        <div>
                          <div className="text-xs font-black text-slate-800">{b.type}</div>
                          <div className="text-[10px] text-slate-400 font-bold">
                            เพดานรับกิน: ฿{b.limit.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                        isClosed
                          ? 'bg-red-600 text-white border-red-700'
                          : isFull
                          ? 'bg-red-100 text-red-800 border-red-200'
                          : isNear
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}>
                        {isClosed ? '🔒 ปิดรับแทง' : isFull ? '🔴 เต็มเพดาน' : isNear ? '🟡 ใกล้เต็ม' : '🟢 ปกติ'}
                      </span>
                    </div>

                    {/* Progress Bar & Available intake */}
                    <div className="space-y-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex justify-between text-[11px] font-bold text-slate-700">
                        <span>กินไปแล้ว: ฿{b.intake.toLocaleString()}</span>
                        <span className="font-black text-slate-900">{percent}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isClosed || isFull
                              ? 'bg-red-600'
                              : isNear
                              ? 'bg-amber-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                        <span>รับกินได้อีก:</span>
                        <span className={`font-black ${remaining === 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {remaining === 0 ? 'งดรับเพิ่ม' : `฿${remaining.toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons per Number */}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-1.5">
                    {isClosed ? (
                      <button
                        onClick={() => handleQuickNumberToggle(b, 'restore')}
                        disabled={isProcessing}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black transition flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">lock_open</span>
                        ปลดล็อกรับแทง
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleQuickNumberToggle(b, 'close')}
                          disabled={isProcessing}
                          className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-black transition flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-xs">block</span>
                          ปิดรับเลขนี้
                        </button>
                        <button
                          onClick={() => handleQuickNumberToggle(b, 'discount')}
                          disabled={isProcessing}
                          className="flex-1 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-black transition flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-xs">trending_down</span>
                          ลดอัตราจ่าย
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2">
          <span className="material-symbols-outlined text-sm text-blue-600">info</span>
          ระบบ Guard จะตรวจสอบยอดสะสมแบบเรียลไทม์ หากตัวเลขใดถึงเพดานรับกิน (100%) หรือถูกปิดรับ ระบบจะไม่อนุญาตให้สมาชิกลงเดิมพันในเลขนั้นๆ ทันที
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ★ MAIN TABLE: ตารางระบบรับกิน อัตราจ่าย และส่วนลด ★ */}
      {/* ========================================================================= */}
      <div className="admin-card bg-white overflow-hidden shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-blue-600">table_chart</span>
              ตารางระบบรับกิน & อัตราจ่ายและส่วนลด ({intakeItems.length} ประเภท)
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
