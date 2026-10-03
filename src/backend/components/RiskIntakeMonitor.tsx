import React, { useState, useEffect, useMemo } from 'react';
import LotteryCategorySelector from './LotteryCategorySelector';
import { useRoundCountdown } from '@/shared/lib/roundTimer';
import { db } from '@/shared/lib/firebase';
import { collection, getDocs, query, where, limit, addDoc } from 'firebase/firestore';

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
}

export default function RiskIntakeMonitor({ lotteryTypes = {}, onLogActivity }: Props) {
  // กรองเฉพาะหวยที่กำลังเปิดให้บริการ (Active Only) เป็นค่าเริ่มต้น
  const [showOnlyOpen, setShowOnlyOpen] = useState(true);

  // คำนวณรายชื่อหวยที่เปิดรับแทงอยู่
  const openLottoKeys = useMemo(() => {
    return Object.keys(lotteryTypes).filter(k => {
      const lot = lotteryTypes[k];
      return lot?.isOpen !== false && !lot?.isPaused && lot?.status !== 'closed' && lot?.bettingOpen !== false;
    });
  }, [lotteryTypes]);

  const allLottoKeys = useMemo(() => {
    const keys = Object.keys(lotteryTypes);
    return keys.length > 0 ? keys : ['หวยรัฐบาลไทย', 'หวยลาวพัฒนา', 'หวยฮานอยพิเศษ', 'หวยมาเลย์ 4D', 'หวยยี่กี 88 รอบ'];
  }, [lotteryTypes]);

  // หวยที่แสดงในหมวดหมู่
  const displayLottoList = useMemo(() => {
    if (showOnlyOpen && openLottoKeys.length > 0) {
      return openLottoKeys;
    }
    return allLottoKeys;
  }, [showOnlyOpen, openLottoKeys, allLottoKeys]);

  const [selectedLottery, setSelectedLottery] = useState<string>(
    openLottoKeys[0] || allLottoKeys[0] || 'หวยรัฐบาลไทย'
  );

  // Rounds state
  const [rounds, setRounds] = useState<RoundOption[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [loadingRounds, setLoadingRounds] = useState(false);

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

  // เลือกรอบปัจจุบัน
  const currentRound = useMemo(() => {
    return rounds.find(r => r.id === selectedRoundId) || rounds[0] || null;
  }, [rounds, selectedRoundId]);

  // ตัวจับเวลานับถอยหลัง & สถานะสี 3 ระดับ (จะเปิด / กำลังเปิด / รอออกผล)
  const timerState = useRoundCountdown(
    currentRound?.openTime,
    currentRound?.closeTime,
    currentRound?.resultTime,
    currentRound?.status
  );

  // ตรวจว่าหวยนี้เปิดให้บริการอยู่หรือไม่
  const isLotteryOpen = useMemo(() => {
    const lot = lotteryTypes[selectedLottery];
    if (!lot) return true;
    return lot.isOpen !== false && !lot.isPaused && lot.status !== 'closed' && lot.bettingOpen !== false;
  }, [lotteryTypes, selectedLottery]);

  // ดึงรอบหวย
  const fetchRounds = async (lotId: string) => {
    setLoadingRounds(true);
    let foundRounds: RoundOption[] = [];
    try {
      const res = await fetch(`/api/v1/rounds?type=${encodeURIComponent(lotId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
          foundRounds = json.data;
        }
      }
    } catch {}

    // Fallback: ดึงจาก Supabase โดยตรง (สำหรับ Vercel static)
    if (foundRounds.length === 0) {
      try {
        const snap = await getDocs(query(collection(db, 'lottery_rounds'), where('lottery_type', '==', lotId), limit(10)));
        if (!snap.empty) {
          foundRounds = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        }
      } catch {}
    }

    if (foundRounds.length > 0) {
      setRounds(foundRounds);
      const activeRound = foundRounds.find((r: any) => r.status === 'open' || r.status === 'active') || foundRounds[0];
      setSelectedRoundId(activeRound.id);
    } else {
      const sampleRound: RoundOption = {
        id: `round-${lotId}-curr`,
        roundNumber: 'งวดปัจจุบัน (รอบเปิดให้บริการ)',
        openTime: new Date(Date.now() - 3600000 * 2).toISOString(),
        closeTime: new Date(Date.now() + 3600000 * 4).toISOString(),
        resultTime: new Date(Date.now() + 3600000 * 5).toISOString(),
        status: 'open',
      };
      setRounds([sampleRound]);
      setSelectedRoundId(sampleRound.id);
    }
    setLoadingRounds(false);
  };

  // Fetch real-time intake data from API with Supabase fallback
  const fetchLiveIntake = async (lotId: string) => {
    setLoading(true);
    let success = false;
    try {
      const res = await fetch(`/api/v1/lottery/live-intake/${encodeURIComponent(lotId)}`);
      if (res.ok) {
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
          success = true;
        }
      }
    } catch (e: any) {
      // Fallback to Supabase below
    }

    // Fallback: ดึงยอดแทงสดจริงจาก Supabase tickets (สำหรับ Vercel static hosting)
    if (!success) {
      try {
        const snap = await getDocs(query(collection(db, 'tickets'), where('ticketType', '==', lotId)));
        const aggregated: Record<string, LiveBetNumber> = {};
        let totalIntake = 0;

        snap.docs.forEach(d => {
          const t = d.data();
          if (t.status === 'cancelled' || t.status === 'rejected') return;
          const bets = Array.isArray(t.bets) ? t.bets : [];
          bets.forEach((b: any) => {
            if (!b.number || !b.type) return;
            const amt = Number(b.amount || b.price) || 0;
            const key = `${b.type}_${b.number}`;
            if (!aggregated[key]) {
              const defLimit = (b.type.includes('3') ? 1000 : b.type.includes('2') ? 3000 : 5000);
              aggregated[key] = {
                number: String(b.number),
                type: String(b.type),
                intake: 0,
                limit: defLimit,
                percent: 0,
                remaining: defLimit,
                isFull: false,
                isNear: false,
              };
            }
            aggregated[key].intake += amt;
            totalIntake += amt;
          });
        });

        const items = Object.values(aggregated).map(item => {
          const pct = Math.min(100, Math.round((item.intake / item.limit) * 100));
          const remaining = Math.max(0, item.limit - item.intake);
          return {
            ...item,
            percent: pct,
            remaining,
            isFull: pct >= 100,
            isNear: pct >= 80 && pct < 100,
          };
        });

        setLiveBets(items);
        setSummaryData({
          totalItems: items.length,
          fullCount: items.filter(i => i.isFull).length,
          nearCount: items.filter(i => i.isNear).length,
          normalCount: items.filter(i => !i.isFull && !i.isNear).length,
          totalIntakeAmount: totalIntake,
        });
      } catch (err: any) {
        setLiveBets([]);
        setSummaryData({ totalItems: 0, fullCount: 0, nearCount: 0, normalCount: 0, totalIntakeAmount: 0 });
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLiveIntake(selectedLottery);
    fetchRounds(selectedLottery);
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

      let apiSuccess = false;
      try {
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

        if (res.ok) {
          const resJson = await res.json();
          if (resJson.status === 'success' || resJson.message) {
            apiSuccess = true;
          }
        }
      } catch {}

      // Fallback บันทึกลง Supabase blocked_numbers โดยตรง (สำหรับ Vercel static)
      if (!apiSuccess) {
        if (action === 'close' || action === 'discount') {
          await addDoc(collection(db, 'blocked_numbers'), {
            lottery_type: selectedLottery,
            bet_type: bet.type,
            number: bet.number,
            is_blocked: action === 'close',
            custom_payout: action === 'discount' ? Math.round(bet.limit * 0.7) : 0,
            created_at: new Date().toISOString(),
          });
        }
      }

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
      if (selectedMonitorType !== 'all' && b.type !== selectedMonitorType) {
        return false;
      }

      const isClosed = b.statusOverride === 'closed';
      const isFull = b.intake >= b.limit || isClosed;
      const isNear = (b.intake / b.limit) >= 0.8 && !isFull;
      const isNormal = !isFull && !isNear;

      if (monitorRiskFilter === 'full' && !isFull) return false;
      if (monitorRiskFilter === 'near' && !isNear) return false;
      if (monitorRiskFilter === 'normal' && !isNormal) return false;

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
      {/* 1. Top Header Card with Filter Toggle for Currently Open Only */}
      <div className="admin-card p-6 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-200 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">monitoring</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">
              มอนิเตอร์รับกินสด (Live Risk Intake Monitor)
            </h2>
            <p className="text-xs text-slate-500">
              ตรวจเช็กยอดแทงสะสมรายตัวเลขแบบเรียลไทม์ พร้อมตัวนับเวลารอบหวย 3 สถานะสี
            </p>
          </div>
        </div>

        {/* Controls & Filter Toggle */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* ตัวกรองเฉพาะหวยที่กำลังเปิดให้บริการเท่านั้น */}
          <button
            onClick={() => setShowOnlyOpen(!showOnlyOpen)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 border shadow-sm ${
              showOnlyOpen
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/20'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showOnlyOpen ? 'bg-white animate-pulse' : 'bg-slate-400'}`}></span>
            {showOnlyOpen ? 'แสดงเฉพาะหวยที่เปิดรับแทงอยู่' : 'แสดงหวยทั้งหมด'}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 font-bold">
              {openLottoKeys.length} หวย
            </span>
          </button>

          <button
            onClick={() => fetchLiveIntake(selectedLottery)}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition flex items-center gap-1.5 border border-slate-200"
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

      {/* 2. Unified Category Tabs & Small Sub-lottery Buttons */}
      <LotteryCategorySelector
        selectedLottery={selectedLottery}
        onSelectLottery={setSelectedLottery}
        lotterySettings={lotteryTypes}
        title="เลือกหมวดหมู่และประเภทหวยสำหรับมอนิเตอร์"
      />

      {/* 3. กล่องแจ้งเตือนสถานะหวย & ตัวจับเวลานับถอยหลัง 3 สี (จะเปิด / กำลังเปิด / รอออกผล) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
              <span className="material-symbols-outlined text-sm text-blue-600">event_available</span>
              รอบที่มอนิเตอร์:
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
                    {r.roundNumber} ({r.status === 'open' ? '🟢 เปิดรับ' : r.status === 'resulted' ? 'ออกผลแล้ว' : 'ปิดแล้ว'})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-lg">
                รอบปกติ (กำลังเปิดให้บริการ)
              </span>
            )}
          </div>

          {/* ★ กล่องเวลานับถอยหลัง 3 สี เด่นชัดตามคำขอ ★ */}
          <div className={`px-5 py-3 rounded-xl border flex items-center gap-3 text-xs font-black shadow-sm ${timerState.boxClass}`}>
            <span className={`px-3 py-1 rounded-lg text-xs font-black border ${timerState.badgeClass}`}>
              {timerState.label}
            </span>
            <span className="text-sm font-black">{timerState.countdownText}</span>
          </div>
        </div>

        {/* ถ้าหวยปิดอยู่แต่ผู้ใช้เปิดดู ให้ขึ้นแถบเตือนสีส้มทอง */}
        {!isLotteryOpen && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600 text-base">info</span>
              <span>
                หวย <b>{selectedLottery}</b> ปิดให้บริการอยู่ในขณะนี้ (ระบบมอนิเตอร์จะเน้นแสดงยอดสดของรอบที่กำลังเปิดรับแทง)
              </span>
            </div>
            {openLottoKeys.length > 0 && (
              <button
                onClick={() => setSelectedLottery(openLottoKeys[0])}
                className="text-xs text-amber-800 underline font-black hover:text-amber-950 ml-2"
              >
                สลับไปดู {openLottoKeys[0]} (เปิดอยู่)
              </button>
            )}
          </div>
        )}
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

      {/* 4. 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="admin-card p-5 bg-white border border-slate-200 shadow-sm rounded-2xl">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-blue-600">format_list_numbered</span>
            ตัวเลขที่มอนิเตอร์ทั้งหมด
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {summaryData.totalItems} <span className="text-xs font-bold text-slate-400">รายการ</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">ตัวเลขที่มีการแทงเข้ามาในรอบปัจจุบัน</p>
        </div>

        <div className="admin-card p-5 bg-white border border-rose-200 shadow-sm bg-rose-50/20 rounded-2xl">
          <div className="text-[11px] font-black text-rose-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-red-600">block</span>
            🔴 เต็มเพดานรับกิน (สกัดกั้น)
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2">
            {summaryData.fullCount} <span className="text-xs font-bold text-rose-400">เลข</span>
          </div>
          <p className="text-[10px] text-rose-400 mt-1">งดรับแทงเพิ่มอัตโนมัติ ป้องกันขาดทุน</p>
        </div>

        <div className="admin-card p-5 bg-white border border-amber-200 shadow-sm bg-amber-50/20 rounded-2xl">
          <div className="text-[11px] font-black text-amber-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-amber-600">warning</span>
            🟡 ใกล้เต็มเพดาน (80-99%)
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">
            {summaryData.nearCount} <span className="text-xs font-bold text-amber-500">เลข</span>
          </div>
          <p className="text-[10px] text-amber-500 mt-1">เตรียมลดอัตราจ่ายหรือจำกัดรับ</p>
        </div>

        <div className="admin-card p-5 bg-white border border-slate-200 shadow-sm rounded-2xl">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-emerald-600">payments</span>
            ยอดเงินรับกินสะสมรวม
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            ฿{summaryData.totalIntakeAmount.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">รวมยอดเดิมพันสะสมทุกตัวเลขในรอบนี้</p>
        </div>
      </div>

      {/* 5. ตารางมอนิเตอร์ข้อมูลแบบแถวและคอลัมน์ (DATA TABLE VIEW) */}
      <div className="admin-card bg-white overflow-hidden shadow-sm border border-slate-200 space-y-4 p-5 rounded-2xl">
        {/* Controls: Bet Type Tabs & Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-4">
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
                      <td className="py-3 px-4">
                        <span className="text-base font-black text-slate-900 px-3 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs inline-block">
                          {b.number}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-black text-slate-800">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                          {b.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-black text-slate-900">
                        ฿{b.intake.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-black text-blue-900 bg-blue-50/30 border-x border-blue-100">
                        ฿{b.limit.toLocaleString()} / ตัว
                      </td>
                      <td className="py-3 px-3 font-black">
                        <span className={remaining === 0 ? 'text-red-600' : 'text-emerald-700'}>
                          {remaining === 0 ? 'งดรับเพิ่ม' : `฿${remaining.toLocaleString()}`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-black">
                            <span className={isFull ? 'text-red-600' : isNear ? 'text-amber-600' : 'text-slate-600'}>
                              {percent}%
                            </span>
                            <span className="text-slate-400">100%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isFull ? 'bg-red-600' : isNear ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase inline-block border ${
                            isClosed
                              ? 'bg-red-100 text-red-700 border-red-200'
                              : isDiscounted
                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : isFull
                              ? 'bg-rose-100 text-rose-700 border-rose-200'
                              : isNear
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {isClosed ? 'ปิดรับ' : isDiscounted ? 'ลดจ่าย' : isFull ? 'เต็มเพดาน' : isNear ? 'ใกล้เต็ม' : 'ปกติ'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isClosed ? (
                            <button
                              onClick={() => handleQuickAction(b, 'restore')}
                              disabled={isProcessing}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black transition disabled:opacity-50"
                            >
                              ปลดล็อก
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleQuickAction(b, 'close')}
                                disabled={isProcessing}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-black transition disabled:opacity-50"
                              >
                                ปิดรับ
                              </button>
                              <button
                                onClick={() => handleQuickAction(b, 'discount')}
                                disabled={isProcessing}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-black transition disabled:opacity-50"
                              >
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-bold">
              หน้า {currentPage} จาก {totalPages} (ทั้งหมด {filteredBets.length} รายการ)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                ย้อนกลับ
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
