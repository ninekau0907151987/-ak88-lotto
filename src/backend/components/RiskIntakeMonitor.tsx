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

  // 10 ประเภทความเสี่ยงที่ต้องมอนิเตอร์แบบแถวเดียวแนวนอน
  const TARGET_ROW_TYPES = [
    { key: '3 ตัวบน', label: '3 ตัวบน', defaultRate: 900, short: '3บน', isTop: true },
    { key: '3 ตัวล่าง', label: '3 ตัวล่าง', defaultRate: 150, short: '3ล่าง' },
    { key: '3 ตัวโต๊ด', label: '3 ตัวโต๊ด', defaultRate: 120, short: '3โต๊ด' },
    { key: '2 ตัวบน', label: '2 ตัวบน', defaultRate: 92, short: '2บน', isTop: true },
    { key: '2 ตัวล่าง', label: '2 ตัวล่าง', defaultRate: 92, short: '2ล่าง' },
    { key: 'วิ่งบน', label: '1 บน (วิ่งบน)', defaultRate: 3.2, short: '1บน', isTop: true },
    { key: 'วิ่งล่าง', label: '1 ล่าง (วิ่งล่าง)', defaultRate: 4.2, short: '1ล่าง' },
    { key: '4 ตัวบน', label: '4 ตัวบน', defaultRate: 5000, short: '4บน', isTop: true },
    { key: '4 ตัวโต๊ด', label: '4 ตัวโต๊ด', defaultRate: 200, short: '4โต๊ด' },
    { key: '5 ตัวโต๊ด', label: '5 ตัวโต๊ด', defaultRate: 15, short: '5โต๊ด' },
  ];

  // Auto-refresh every 15 seconds with active countdown
  const [countdownSec, setCountdownSec] = useState(15);
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setCountdownSec(prev => {
        if (prev <= 1) {
          fetchLiveIntake(selectedLottery);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, selectedLottery]);

  // ประวัติบันทึกการลดด่วน (Quick Cut History Log)
  const [quickCutLogs, setQuickCutLogs] = useState<Array<{ id: string; type: string; number: string; oldRate: number; newRate: number; time: string }>>([
    { id: '1', type: '3 ตัวบน', number: '600', oldRate: 900, newRate: 500, time: '14:30:22' }
  ]);

  // Modal / Inline Quick Cut State
  const [editingBet, setEditingBet] = useState<{ type: string; number: string; currentRate: number } | null>(null);
  const [newRateInput, setNewRateInput] = useState<string>('500');

  // คำนวณความเสี่ยงและเลขเสี่ยงสูงสุดของแต่ละประเภท (10 ประเภท)
  const typeRiskSummary = useMemo(() => {
    return TARGET_ROW_TYPES.map(t => {
      const typeBets = liveBets.filter(b => b.type === t.key || b.type.includes(t.short) || b.type.includes(t.key.replace('ตัว', '')));
      const withLiability = typeBets.map(b => {
        const rate = b.customRate || t.defaultRate;
        const liability = b.intake * rate;
        return { ...b, effectiveRate: rate, liability };
      }).sort((a, b) => b.liability - a.liability);

      const topBet = withLiability[0] || null;
      const maxLiability = topBet ? topBet.liability : 0;
      const totalTypeIntake = typeBets.reduce((sum, b) => sum + b.intake, 0);

      return {
        ...t,
        bets: withLiability,
        topBet,
        maxLiability,
        totalTypeIntake,
        count: typeBets.length
      };
    });
  }, [liveBets]);

  // รวบรวมการจ่ายสูงสุด & โอกาสที่จะแพ้สูงสุด (Worst-Case Loss Exposure)
  const exposureSummary = useMemo(() => {
    const totalIntake = summaryData.totalIntakeAmount;
    // ยอดจ่ายสูงสุดกรณีแพ้ทุกประเภท (รวม Max Liability ของแต่ละประเภท)
    const worstCasePayout = typeRiskSummary.reduce((sum, t) => sum + t.maxLiability, 0);
    // ผลขาดทุนสุทธิสูงสุด = Payout - Intake
    const worstCaseNetLoss = Math.max(0, worstCasePayout - totalIntake);
    // ตัวเลขตัวบนที่เสี่ยงสูงสุด
    const top3Top = typeRiskSummary.find(t => t.key === '3 ตัวบน')?.topBet || null;

    return {
      totalIntake,
      worstCasePayout,
      worstCaseNetLoss,
      top3Top
    };
  }, [summaryData, typeRiskSummary]);

  // ฟังก์ชันบันทึกการลดราคาด่วน (Double Click Quick Cut)
  const handleApplyQuickRate = async (type: string, number: string, newRate: number) => {
    try {
      await addDoc(collection(db, 'blocked_numbers'), {
        lotteryType: selectedLottery,
        betType: type,
        number: number,
        restrictionType: newRate === 0 ? 'blocked' : 'reduced',
        customPayoutRate: newRate,
        sourceMode: 'quick_cut',
        createdAt: new Date().toISOString()
      });
      setQuickCutLogs(prev => [
        {
          id: String(Date.now()),
          type,
          number,
          oldRate: 900,
          newRate,
          time: new Date().toLocaleTimeString('th-TH')
        },
        ...prev
      ]);
      setLiveBets(prev => prev.map(b => {
        if (b.type === type && b.number === number) {
          return { ...b, customRate: newRate, statusOverride: 'discounted' };
        }
        return b;
      }));
      setEditingBet(null);
      setMessage({ text: `ปรับลดอัตราจ่าย ${type} เลข ${number} เหลือ ฿${newRate} เรียบร้อยแล้ว`, type: 'success' });
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + e.message);
    }
  };
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

      {/* ========================================================================= */}
      {/* 4.5 ประเมินความเสี่ยงแพ้สูงสุด & ตัวบนเด่น (Worst-Case Exposure & 15s Auto Polling) */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white p-5 rounded-2xl border border-rose-900/60 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-rose-800/40 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>ประเมินความเสี่ยงแพ้สูงสุด (Worst-Case Loss Exposure)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                  ⚡ ดูดสดทุก 15 วินาที ({countdownSec}ว.)
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">คำนวณจากตัวเลขที่มียอดจ่ายสูงสุดในแต่ละประเภทกรณีลูกค้าถูกรางวัลทุกตัวพร้อมกัน</p>
            </div>
          </div>

          <button
            onClick={() => fetchLiveIntake(selectedLottery)}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-rose-200 border border-rose-700/50 rounded-xl text-xs font-black transition flex items-center gap-1 active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            ดึงยอดสดทันที
          </button>
        </div>

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. ตัวบนเสี่ยงสูงสุด */}
          <div className="bg-black/30 border border-amber-500/40 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <span>🚨 ตัวบนเสี่ยงสูงสุด (3 ตัวบน)</span>
            </div>
            {exposureSummary.top3Top ? (
              <div className="mt-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono text-amber-300">
                    {exposureSummary.top3Top.number}
                  </span>
                  <span className="text-[11px] text-slate-300 font-bold">
                    (แทง ฿{exposureSummary.top3Top.intake.toLocaleString()})
                  </span>
                </div>
                <div className="text-[11px] font-bold text-rose-400 mt-0.5">
                  จ่ายสูงสุด: ฿{exposureSummary.top3Top.liability.toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 font-bold mt-2">ยังไม่มียอดแทง 3 ตัวบน</div>
            )}
          </div>

          {/* 2. ยอดจ่ายสูงสุดกรณีแพ้ทุกตัว */}
          <div className="bg-black/30 border border-rose-500/40 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="text-[10px] font-black text-rose-300 uppercase tracking-wider">
              💸 ยอดจ่ายสูงสุดกรณีแพ้ (Max Liability)
            </div>
            <div className="text-2xl font-black text-rose-400 mt-1">
              ฿{exposureSummary.worstCasePayout.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400">รวมภาระจ่ายสูงสุดทุกประเภท</div>
          </div>

          {/* 3. ยอดแทงรวมสะสม */}
          <div className="bg-black/30 border border-emerald-500/40 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="text-[10px] font-black text-emerald-300 uppercase tracking-wider">
              💰 ยอดแทงรวมสะสม (Total Intake)
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              ฿{exposureSummary.totalIntake.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400">เงินที่ลูกค้าระดมแทงรอบนี้</div>
          </div>

          {/* 4. โอกาสที่จะแพ้สูงสุด */}
          <div className="bg-black/30 border border-red-500/60 rounded-xl p-3.5 flex flex-col justify-between ring-1 ring-red-500/30">
            <div className="text-[10px] font-black text-red-300 uppercase tracking-wider flex items-center gap-1">
              <span>⚠️ โอกาสที่จะแพ้สูงสุด (Worst-Case Net Loss)</span>
            </div>
            <div className="text-2xl font-black text-red-400 mt-1">
              ฿{exposureSummary.worstCaseNetLoss.toLocaleString()}
            </div>
            <div className="text-[10px] text-red-300/80">ความเสี่ยงขาดทุนสุทธิสูงสุด</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4.6 แถบเบียดแถวเดียว เลื่อนไปทางขวา (SINGLE-ROW HORIZONTAL RISK STRIP)      */}
      {/* 10 ประเภท: 3บน 3ล่าง 3โต๊ด 2บน 2ล่าง 1บน 1ล่าง 4บน 4โต๊ด 5โต๊ด               */}
      {/* ========================================================================= */}
      <div className="admin-card p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-lg">view_carousel</span>
              <span>มอนิเตอร์ตัวเลขด่วน 10 ประเภท (เบียดแถวเดียวเลื่อนไปทางขวา)</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              ดับเบิ้ลคลิกที่อัตราจ่าย (เช่น 900) เพื่อพิมพ์เปลี่ยนลดเหลือ 500 ได้ทันที
            </p>
          </div>

          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <span>เลื่อนขวาเพื่อดูประเภทอื่น</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </div>
        </div>

        {/* แถบเลื่อนแนวนอนเบียดแถวเดียว (Overflow-X Auto) */}
        <div className="overflow-x-auto pb-3 flex gap-3 scrollbar-thin">
          {typeRiskSummary.map((t) => (
            <div 
              key={t.key}
              className={`min-w-[240px] max-w-[250px] flex-shrink-0 rounded-2xl p-3.5 border transition ${
                t.isTop 
                  ? 'bg-blue-50/50 border-blue-200 shadow-sm' 
                  : 'bg-slate-50/70 border-slate-200'
              }`}
            >
              {/* Header การ์ด */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-xs text-slate-900 flex items-center gap-1">
                  {t.isTop && <span className="text-amber-500 text-xs">⭐</span>}
                  {t.label}
                </span>

                <span 
                  onDoubleClick={() => {
                    if (t.topBet) {
                      setEditingBet({ type: t.key, number: t.topBet.number, currentRate: t.topBet.effectiveRate });
                      setNewRateInput('500');
                    }
                  }}
                  title="ดับเบิ้ลคลิกเพื่อปรับลดอัตราจ่ายด่วน"
                  className="cursor-pointer text-[10px] font-black px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600 transition"
                >
                  จ่าย ฿{t.topBet?.effectiveRate || t.defaultRate} ✎
                </span>
              </div>

              {/* ข้อมูลเลขเสี่ยงสูงสุด */}
              {t.topBet ? (
                <div className="space-y-1.5 bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] text-slate-400 font-bold">เลขเสี่ยงสูงสุด:</span>
                    <span className="text-xl font-black font-mono text-red-600 tracking-wider">
                      {t.topBet.number}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-bold">ยอดแทง:</span>
                    <span className="font-black text-slate-800">฿{t.topBet.intake.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-slate-500 font-bold">คำนวณจ่าย:</span>
                    <span className="font-black text-rose-600">฿{t.topBet.liability.toLocaleString()}</span>
                  </div>

                  {/* ปุ่มกดลดด่วน */}
                  <button
                    onClick={() => {
                      setEditingBet({ type: t.key, number: t.topBet.number, currentRate: t.topBet.effectiveRate });
                      setNewRateInput('500');
                    }}
                    className="w-full mt-2 py-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-black transition flex items-center justify-center gap-1 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-xs">trending_down</span>
                    ดับเบิ้ลคลิก/ลดเหลือ ฿500
                  </button>
                </div>
              ) : (
                <div className="py-7 text-center text-slate-400 text-xs font-bold bg-white/60 rounded-xl border border-dashed border-slate-200">
                  ยังไม่มียอดแทง
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4.7 ตารางประวัติบันทึกการลดด่วน (QUICK CUT HISTORY LOG)                     */}
      {/* ========================================================================= */}
      {quickCutLogs.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 shadow-sm space-y-2.5">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-700 text-sm">history</span>
              ตารางประวัติบันทึกการลดรางวัลแบบด่วน (Quick Cut History)
            </h4>
            <span className="text-[10px] text-amber-700 font-bold">มีบันทึก {quickCutLogs.length} รายการ</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickCutLogs.map((log, idx) => (
              <div key={log.id || idx} className="bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 flex items-center gap-2 shadow-xs">
                <span className="text-amber-800 font-black">ครั้งที่ {idx + 1}:</span>
                <span className="text-slate-600">{log.type}</span>
                <span className="font-mono font-black text-red-600">เลข {log.number}</span>
                <span className="text-emerald-700 font-black">ลดเหลือ ฿{log.newRate}</span>
                <span className="text-[10px] text-slate-400">({log.time})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4.8 ป๊อปอัปแก้ไขราคาลดด่วน (Quick Cut Modal / Prompt)                       */}
      {/* ========================================================================= */}
      {editingBet && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-rose-600 text-base">edit</span>
                ปรับลดอัตราจ่ายด่วน
              </h3>
              <button onClick={() => setEditingBet(null)} className="text-slate-400 hover:text-slate-600 font-black">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                <div className="text-slate-500 font-bold">ประเภท: <span className="font-black text-slate-900">{editingBet.type}</span></div>
                <div className="text-slate-500 font-bold">หมายเลข: <span className="font-black text-red-600 font-mono text-base">{editingBet.number}</span></div>
                <div className="text-slate-500 font-bold">อัตราจ่ายปัจจุบัน: <span className="font-black text-slate-700">฿{editingBet.currentRate}</span></div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-700 mb-1 block">ระบุอัตราจ่ายที่ต้องการลดเหลือ (บาท):</label>
                <input
                  type="number"
                  value={newRateInput}
                  onChange={(e) => setNewRateInput(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-base font-black text-rose-600 outline-none focus:border-rose-500"
                  placeholder="เช่น 500 หรือ 0 เพื่อปิดรับ"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewRateInput('500')}
                  className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-black border border-rose-200 transition"
                >
                  ลดเหลือ 500
                </button>
                <button
                  type="button"
                  onClick={() => setNewRateInput('0')}
                  className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[11px] font-black border border-red-200 transition"
                >
                  ปิดรับ (0 บ.)
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingBet(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleApplyQuickRate(editingBet.type, editingBet.number, Number(newRateInput) || 0)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md transition"
              >
                ยืนยันลดราคา
              </button>
            </div>
          </div>
        </div>
      )}

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
