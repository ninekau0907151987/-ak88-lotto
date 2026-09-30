import React, { useState, useEffect, useMemo } from 'react';
import LotteryCategorySelector from './LotteryCategorySelector';

interface LiveBetNumber {
  number: string;
  type: string;
  intake: number;
  limit: number;
  percent: number;
  remaining: number;
  isFull: boolean;
  isNear: boolean;
  statusOverride?: 'normal' | 'discounted' | 'closed';
  customRate?: number;
}

interface Props {
  lotteryTypes?: Record<string, any>;
  onLogActivity?: (action: string, details: string, type: string) => void;
}

export default function RiskIntakeMonitor({ lotteryTypes = {}, onLogActivity }: Props) {
  const lottoList = Object.keys(lotteryTypes).length > 0
    ? Object.keys(lotteryTypes)
    : ['หวยรัฐบาลไทย', 'หวยลาวพัฒนา', 'หวยฮานอยพิเศษ', 'หวยมาเลย์ 4D', 'หวยยี่กี 88 รอบ'];

  const [selectedLottery, setSelectedLottery] = useState<string>(lottoList[0] || 'หวยรัฐบาลไทย');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Live monitor state from API
  const [liveBets, setLiveBets] = useState<LiveBetNumber[]>([]);
  const [summaryData, setSummaryData] = useState({
    totalItems: 0,
    fullCount: 0,
    nearCount: 0,
    normalCount: 0,
    totalIntakeAmount: 0,
  });

  // Filter & Navigation states
  const [selectedMonitorType, setSelectedMonitorType] = useState<string>('all');
  const [monitorRiskFilter, setMonitorRiskFilter] = useState<'all' | 'full' | 'near' | 'normal'>('all');
  const [searchNumber, setSearchNumber] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Fetch real-time intake data from API
  const fetchLiveIntake = async (lotId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/lottery/live-intake/${encodeURIComponent(lotId)}`);
      const json = await res.json();
      if (json.status === 'success') {
        setLiveBets(json.data || []);
        setSummaryData({
          totalItems: json.totalItems || json.data?.length || 0,
          fullCount: json.fullCount || 0,
          nearCount: json.nearCount || 0,
          normalCount: json.normalCount || 0,
          totalIntakeAmount: json.totalIntakeAmount || 0,
        });
      }
    } catch (e: any) {
      console.warn('Fetch live intake fallback:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveIntake(selectedLottery);
    setCurrentPage(1);
  }, [selectedLottery]);

  // Optional auto-refresh every 20 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLiveIntake(selectedLottery);
    }, 20000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedLottery]);

  // Quick Action on monitored numbers (Close / Discount / Restore)
  const handleQuickAction = async (bet: LiveBetNumber, action: 'close' | 'discount' | 'restore') => {
    const key = `${bet.type}-${bet.number}`;
    setActionLoading(key);
    try {
      let apiAction: 'custom_close' | 'custom_discount' | 'custom_restore' = 'custom_restore';
      let nextStatus: 'normal' | 'discounted' | 'closed' = 'normal';

      if (action === 'close') {
        apiAction = 'custom_close';
        nextStatus = 'closed';
      } else if (action === 'discount') {
        apiAction = 'custom_discount';
        nextStatus = 'discounted';
      } else {
        apiAction = 'custom_restore';
        nextStatus = 'normal';
      }

      const res = await fetch('/api/v1/lottery/quick-number-action', {
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

      const resJson = await res.json();
      if (resJson.status === 'success' || resJson.message) {
        setLiveBets(prev => prev.map(item => {
          if (item.number === bet.number && item.type === bet.type) {
            const isFull = nextStatus === 'closed' || item.percent >= 100;
            return {
              ...item,
              statusOverride: nextStatus,
              isFull,
              isNear: !isFull && item.percent >= 80,
            };
          }
          return item;
        }));

        const actionText = action === 'close' ? 'ปิดรับแทง' : action === 'discount' ? 'ลดอัตราจ่าย' : 'ปลดล็อกคืนค่าปกติ';
        setMessage({ text: `${actionText}เลข ${bet.number} (${bet.type}) สำเร็จ`, type: 'success' });
        onLogActivity?.('มอนิเตอร์รับกิน', `${actionText}หมายเลข ${bet.number} (${bet.type})`, 'security');
      } else {
        throw new Error(resJson.message || 'ดำเนินการไม่สำเร็จ');
      }
    } catch (e: any) {
      setMessage({ text: 'เกิดข้อผิดพลาด: ' + e.message, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Distinct bet types for Tabs
  const betTypeTabs = useMemo(() => {
    const types = Array.from(new Set(liveBets.map(b => b.type)));
    return [
      { id: 'all', label: 'ทั้งหมด', count: liveBets.length },
      ...types.map(t => {
        const count = liveBets.filter(b => b.type === t).length;
        const hasFull = liveBets.some(b => b.type === t && (b.intake >= b.limit || b.statusOverride === 'closed'));
        const hasNear = liveBets.some(b => b.type === t && b.intake / b.limit >= 0.8 && b.intake < b.limit);
        return { id: t, label: t, count, hasFull, hasNear };
      }),
    ];
  }, [liveBets]);

  // Filtered live bets based on tabs, risk filter, and search
  const filteredBets = useMemo(() => {
    return liveBets.filter(b => {
      // 1. Bet Type Tab
      if (selectedMonitorType !== 'all' && b.type !== selectedMonitorType) {
        return false;
      }

      // 2. Risk Status Filter
      const isClosed = b.statusOverride === 'closed';
      const isFull = b.intake >= b.limit || isClosed;
      const isNear = (b.intake / b.limit) >= 0.8 && !isFull;
      const isNormal = !isFull && !isNear;

      if (monitorRiskFilter === 'full' && !isFull) return false;
      if (monitorRiskFilter === 'near' && !isNear) return false;
      if (monitorRiskFilter === 'normal' && !isNormal) return false;

      // 3. Search Number
      if (searchNumber.trim() && !b.number.includes(searchNumber.trim())) {
        return false;
      }

      return true;
    });
  }, [liveBets, selectedMonitorType, monitorRiskFilter, searchNumber]);

  // Paginated Bets
  const totalPages = Math.ceil(filteredBets.length / pageSize) || 1;
  const paginatedBets = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBets.slice(start, start + pageSize);
  }, [filteredBets, currentPage, pageSize]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="admin-card p-6 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">monitoring</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">
              มอนิเตอร์รับกินรายตัวเลข (Live Risk Intake Monitor)
            </h2>
            <p className="text-xs text-slate-500">
              ตรวจเช็กยอดแทงสะสมรายตัวเลขแบบเรียลไทม์ แสดงผลเป็นตารางแถวและคอลัมน์ แยกแถบตามชนิดการแทง
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => fetchLiveIntake(selectedLottery)}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition flex items-center gap-1.5"
            title="กดเพื่อรีเฟรชข้อมูลล่าสุด"
          >
            <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>sync</span>
            รีเฟรช
          </button>

          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-blue-600"
            />
            ออโต้รีเฟรช
          </label>
        </div>
      </div>

      {/* Unified Category Tabs & Small Sub-lottery Buttons */}
      <LotteryCategorySelector
        selectedLottery={selectedLottery}
        onSelectLottery={setSelectedLottery}
        lotterySettings={lotteryTypes}
        title="เลือกหมวดหมู่และประเภทหวยสำหรับมอนิเตอร์"
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

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="admin-card p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-blue-600">format_list_numbered</span>
            ตัวเลขที่มอนิเตอร์ทั้งหมด
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {summaryData.totalItems} <span className="text-xs font-bold text-slate-400">รายการ</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">ตัวเลขที่มีการแทงเข้ามาในรอบปัจจุบัน</p>
        </div>

        <div className="admin-card p-5 bg-white border border-rose-200 shadow-sm bg-rose-50/20">
          <div className="text-[11px] font-black text-rose-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-red-600">block</span>
            🔴 เต็มเพดานรับกิน (สกัดกั้น)
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">
            {summaryData.fullCount} <span className="text-xs font-bold text-rose-400">เลข</span>
          </div>
          <p className="text-[10px] text-rose-400 mt-1">งดรับแทงเพิ่มอัตโนมัติ ป้องกันขาดทุน</p>
        </div>

        <div className="admin-card p-5 bg-white border border-amber-200 shadow-sm bg-amber-50/20">
          <div className="text-[11px] font-black text-amber-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-amber-600">warning</span>
            🟡 ใกล้เต็มเพดาน (80-99%)
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">
            {summaryData.nearCount} <span className="text-xs font-bold text-amber-500">เลข</span>
          </div>
          <p className="text-[10px] text-amber-500 mt-1">เตรียมลดอัตราจ่ายหรือจำกัดรับ</p>
        </div>

        <div className="admin-card p-5 bg-white border border-slate-200 shadow-sm">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-emerald-600">payments</span>
            ยอดเงินรับกินสะสมรวม
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            ฿{summaryData.totalIntakeAmount.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">รวมยอดเดิมพันสะสมทุกตัวเลขในงวดนี้</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ★ ตารางมอนิเตอร์ข้อมูลแบบแถวและคอลัมน์ (DATA TABLE VIEW) ★ */}
      {/* ========================================================================= */}
      <div className="admin-card bg-white overflow-hidden shadow-sm border border-slate-200 space-y-4 p-5">
        {/* Controls: Bet Type Tabs & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-4">
          {/* Quick Search */}
          <div className="relative w-full md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
            <input
              type="text"
              value={searchNumber}
              onChange={(e) => { setSearchNumber(e.target.value); setCurrentPage(1); }}
              placeholder="ค้นหาตัวเลข (เช่น 88, 168)..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          {/* Risk Filters */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <span className="text-[11px] font-bold text-slate-500 mr-1">กรองสถานะ:</span>
            <button
              onClick={() => { setMonitorRiskFilter('all'); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                monitorRiskFilter === 'all'
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              ทั้งหมด ({liveBets.length})
            </button>
            <button
              onClick={() => { setMonitorRiskFilter('full'); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition border flex items-center gap-1 ${
                monitorRiskFilter === 'full'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              }`}
            >
              🔴 เต็มเพดาน ({summaryData.fullCount})
            </button>
            <button
              onClick={() => { setMonitorRiskFilter('near'); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition border flex items-center gap-1 ${
                monitorRiskFilter === 'near'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
            >
              🟡 ใกล้เต็ม ({summaryData.nearCount})
            </button>
            <button
              onClick={() => { setMonitorRiskFilter('normal'); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition border flex items-center gap-1 ${
                monitorRiskFilter === 'normal'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              🟢 ปกติ ({summaryData.normalCount})
            </button>
          </div>
        </div>

        {/* แถบแยกตามชนิดการแทง (Bet Type Tabs) */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
            แถบชนิดการแทง (เลือกชนิดเพื่อดูเฉพาะหมวด):
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {betTypeTabs.map((tab) => {
              const isActive = selectedMonitorType === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setSelectedMonitorType(tab.id); setCurrentPage(1); }}
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

        {/* ตารางข้อมูลแสดงผลแถวและคอลัมน์ (Table with Rows and Columns) */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-bold">กำลังโหลดข้อมูลมอนิเตอร์รับกิน...</div>
        ) : filteredBets.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <span className="material-symbols-outlined text-4xl text-slate-300">hourglass_empty</span>
            <p className="text-xs font-black text-slate-500 mt-2">ไม่พบตัวเลขในชนิดหรือเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs admin-table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90 text-slate-700">
                  <th className="py-3 px-3 font-black w-12 text-center">#</th>
                  <th className="py-3 px-4 font-black">หมายเลข</th>
                  <th className="py-3 px-3 font-black">ชนิดการแทง</th>
                  <th className="py-3 px-3 font-black">ยอดแทงสะสม (กินไปแล้ว)</th>
                  <th className="py-3 px-3 font-black bg-blue-50/60 text-blue-900 border-x border-blue-100">
                    🎯 เพดานรับกินตัวนี้ (บาท)
                  </th>
                  <th className="py-3 px-3 font-black">คงเหลือรับได้อีก (บาท)</th>
                  <th className="py-3 px-4 font-black w-48">ระดับความเสี่ยง (%)</th>
                  <th className="py-3 px-3 font-black text-center">สถานะ</th>
                  <th className="py-3 px-4 font-black text-center w-48">คำสั่งจัดการด่วน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedBets.map((b, idx) => {
                  const percent = Math.min(100, Math.round((b.intake / b.limit) * 100));
                  const isClosed = b.statusOverride === 'closed';
                  const isDiscounted = b.statusOverride === 'discounted';
                  const isFull = percent >= 100 || isClosed;
                  const isNear = percent >= 80 && !isFull;
                  const remaining = Math.max(0, b.limit - b.intake);
                  const cardKey = `${b.type}-${b.number}`;
                  const isProcessing = actionLoading === cardKey;
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <tr
                      key={cardKey}
                      className={`hover:bg-blue-50/20 transition ${
                        isClosed ? 'bg-red-50/30' : isFull ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-bold text-slate-400">{rowNumber}</td>

                      {/* หมายเลข (Number Badge) */}
                      <td className="py-3 px-4">
                        <span className="text-base font-black text-slate-900 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs inline-block">
                          {b.number}
                        </span>
                      </td>

                      {/* ชนิดการแทง */}
                      <td className="py-3 px-3 font-black text-slate-800">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                          {b.type}
                        </span>
                      </td>

                      {/* ยอดแทงสะสม (กินไปแล้ว) */}
                      <td className="py-3 px-3 font-black text-slate-900">
                        ฿{b.intake.toLocaleString()}
                      </td>

                      {/* 🎯 เพดานรับกินตัวนี้ */}
                      <td className="py-3 px-3 font-black text-blue-900 bg-blue-50/30 border-x border-blue-100">
                        ฿{b.limit.toLocaleString()} / ตัว
                      </td>

                      {/* คงเหลือรับได้อีก */}
                      <td className="py-3 px-3 font-black">
                        <span className={remaining === 0 ? 'text-red-600' : 'text-emerald-700'}>
                          {remaining === 0 ? 'งดรับเพิ่ม' : `฿${remaining.toLocaleString()}`}
                        </span>
                      </td>

                      {/* ความคืบหน้า (%) */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-black text-slate-600">
                            <span>{percent}%</span>
                            <span>{isClosed ? 'บล็อก' : isFull ? 'เต็มโควตา' : isNear ? 'เฝ้าระวัง' : 'ปกติ'}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
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
                        </div>
                      </td>

                      {/* สถานะ */}
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border inline-block ${
                          isClosed
                            ? 'bg-red-600 text-white border-red-700'
                            : isFull
                            ? 'bg-red-100 text-red-800 border-red-200'
                            : isNear
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}>
                          {isClosed ? '🔒 ปิดรับ' : isFull ? '🔴 เต็มเพดาน' : isNear ? '🟡 ใกล้เต็ม' : '🟢 ปกติ'}
                        </span>
                      </td>

                      {/* คำสั่งจัดการด่วน */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isClosed ? (
                            <button
                              onClick={() => handleQuickAction(b, 'restore')}
                              disabled={isProcessing}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black transition flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-xs">lock_open</span>
                              ปลดล็อก
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleQuickAction(b, 'close')}
                                disabled={isProcessing}
                                className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-black transition flex items-center gap-1"
                                title="สั่งปิดรับแทงเลขนี้ทันที"
                              >
                                <span className="material-symbols-outlined text-xs">block</span>
                                ปิดรับ
                              </button>
                              <button
                                onClick={() => handleQuickAction(b, 'discount')}
                                disabled={isProcessing}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-black transition flex items-center gap-1"
                                title="ปรับลดอัตราจ่ายเลขนี้"
                              >
                                <span className="material-symbols-outlined text-xs">trending_down</span>
                                ลดจ่าย
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 font-bold">
            <div>
              แสดง {(currentPage - 1) * pageSize + 1} ถึง {Math.min(currentPage * pageSize, filteredBets.length)} จาก {filteredBets.length} รายการ
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                ย้อนกลับ
              </button>
              <span className="px-2 font-black text-slate-800">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
          <span className="material-symbols-outlined text-sm text-blue-600">info</span>
          ระบบตารางมอนิเตอร์จะตรวจสอบยอดรับกินรายตัวเลข หากตัวเลขใดมียอดแทงสะสมถึงเพดานรับกิน ระบบ Guard ใน `betting.service.ts` จะสกัดกั้นการแทงของตัวเลขนั้นทันที
        </div>
      </div>
    </div>
  );
}
