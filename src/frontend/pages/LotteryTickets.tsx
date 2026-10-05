import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, addDoc } from 'firebase/firestore';

interface LotteryResultItem {
  id: string;
  lotteryName?: string;
  type?: string;
  date?: string;
  createdAt?: string;
  results?: {
    threeUp?: string;
    twoDown?: string;
    threeFront?: string;
    threeBack?: string;
  };
  result3Top?: string;
  result2Bottom?: string;
  result3Bottom?: string;
  result3Front?: string;
}

const LOTTERY_CATALOG = [
  { name: 'หวยรัฐบาล', category: 'thai', flag: 'https://flagcdn.com/w80/th.png', drawTime: '15:30 น. (วันที่ 1, 16)', betPath: '/lottery/thai' },
  { name: 'หวยออมสิน', category: 'thai', flag: 'https://flagcdn.com/w80/th.png', drawTime: '14:00 น. (วันที่ 1, 16)', betPath: '/lottery/gsb' },
  { name: 'หวยธกส.', category: 'thai', flag: 'https://flagcdn.com/w80/th.png', drawTime: '11:00 น. (วันที่ 16)', betPath: '/lottery/baac' },
  
  { name: 'หวยลาวพัฒนา', category: 'lao', flag: 'https://flagcdn.com/w80/la.png', drawTime: '20:30 น. (จ/พ/ศ)', betPath: '/lottery/lao' },
  { name: 'หวยลาวสตาร์', category: 'lao', flag: 'https://flagcdn.com/w80/la.png', drawTime: '15:45 น. (ทุกวัน)', betPath: '/lottery/lao-star' },
  { name: 'หวยลาว VIP', category: 'lao', flag: 'https://flagcdn.com/w80/la.png', drawTime: '21:30 น. (ทุกวัน)', betPath: '/lottery/lao-vip' },
  { name: 'หวยลาวสามัคคี', category: 'lao', flag: 'https://flagcdn.com/w80/la.png', drawTime: '20:00 น. (ทุกวัน)', betPath: '/lottery/lao-samakki' },

  { name: 'หวยฮานอย', category: 'hanoi', flag: 'https://flagcdn.com/w80/vn.png', drawTime: '18:30 น. (ทุกวัน)', betPath: '/lottery/hanoi' },
  { name: 'ฮานอยพิเศษ', category: 'hanoi', flag: 'https://flagcdn.com/w80/vn.png', drawTime: '17:30 น. (ทุกวัน)', betPath: '/lottery/hanoi-special' },
  { name: 'ฮานอย(VIP)', category: 'hanoi', flag: 'https://flagcdn.com/w80/vn.png', drawTime: '19:30 น. (ทุกวัน)', betPath: '/lottery/hanoi-vip' },
  { name: 'ฮานอยสตาร์', category: 'hanoi', flag: 'https://flagcdn.com/w80/vn.png', drawTime: '16:30 น. (ทุกวัน)', betPath: '/lottery/hanoi-star' },
  { name: 'ฮานอยสามัคคี', category: 'hanoi', flag: 'https://flagcdn.com/w80/vn.png', drawTime: '17:15 น. (ทุกวัน)', betPath: '/lottery/hanoi-samakki' },

  { name: 'หุ้นไทยเช้า', category: 'stock', flag: 'https://flagcdn.com/w80/th.png', drawTime: '10:00 น.', betPath: '/lottery/stock/thai-morning' },
  { name: 'หุ้นไทยเที่ยง', category: 'stock', flag: 'https://flagcdn.com/w80/th.png', drawTime: '12:30 น.', betPath: '/lottery/stock/thai-noon' },
  { name: 'หุ้นไทยบ่าย', category: 'stock', flag: 'https://flagcdn.com/w80/th.png', drawTime: '14:30 น.', betPath: '/lottery/stock/thai-afternoon' },
  { name: 'หุ้นไทยเย็น', category: 'stock', flag: 'https://flagcdn.com/w80/th.png', drawTime: '16:45 น.', betPath: '/lottery/stock/thai-evening' },
  { name: 'นิเคอิ VIP (เช้า)', category: 'stock', flag: 'https://flagcdn.com/w80/jp.png', drawTime: '09:30 น.', betPath: '/lottery/stock/nikkei-morning' },
  { name: 'นิเคอิ VIP (บ่าย)', category: 'stock', flag: 'https://flagcdn.com/w80/jp.png', drawTime: '13:20 น.', betPath: '/lottery/stock/nikkei-afternoon' },
  { name: 'ฮั่งเส็ง VIP (เช้า)', category: 'stock', flag: 'https://flagcdn.com/w80/hk.png', drawTime: '11:00 น.', betPath: '/lottery/stock/hangseng-morning' },
  { name: 'ฮั่งเส็ง VIP (บ่าย)', category: 'stock', flag: 'https://flagcdn.com/w80/hk.png', drawTime: '15:30 น.', betPath: '/lottery/stock/hangseng-afternoon' },
  { name: 'จีน VIP (เช้า)', category: 'stock', flag: 'https://flagcdn.com/w80/cn.png', drawTime: '10:30 น.', betPath: '/lottery/stock/china-morning' },
  { name: 'จีน VIP (บ่าย)', category: 'stock', flag: 'https://flagcdn.com/w80/cn.png', drawTime: '14:00 น.', betPath: '/lottery/stock/china-afternoon' },
  { name: 'ไต้หวัน VIP', category: 'stock', flag: 'https://flagcdn.com/w80/tw.png', drawTime: '12:30 น.', betPath: '/lottery/stock/taiwan' },
  { name: 'เกาหลี VIP', category: 'stock', flag: 'https://flagcdn.com/w80/kr.png', drawTime: '13:00 น.', betPath: '/lottery/stock/korea' },
  { name: 'ดาวน์โจนส์ STAR', category: 'stock', flag: 'https://flagcdn.com/w80/us.png', drawTime: '03:00 น.', betPath: '/lottery/stock/dowjones' },

  { name: 'ยี่กี 88 รอบ', category: 'yeekee', flag: '', drawTime: 'ออกทุก 15 นาที ตลอดวัน', betPath: '/lottery/yeekee' },
];

export default function LotteryTickets() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary Tab: 'tickets' (โพยของฉัน) OR 'results' (ผลหวยสด / ตารางผลบอล)
  const initialMainTab = searchParams.get('tab') === 'results' ? 'results' : 'tickets';
  const [mainTab, setMainTab] = useState<'tickets' | 'results'>(initialMainTab);

  // Tickets sub-filter
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'pending' | 'win' | 'lose' | 'cancelled'>('all');

  // Results category filter
  const [resultCategory, setResultCategory] = useState<string>('all');
  const [resultSearchQuery, setResultSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD

  // Data states
  const [tickets, setTickets] = useState<any[]>([]);
  const [results, setResults] = useState<LotteryResultItem[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentUserId = localStorage.getItem('userId');
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  // Keep URL search params in sync
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'results' && mainTab !== 'results') {
      setMainTab('results');
    } else if (tabParam === 'tickets' && mainTab !== 'tickets') {
      setMainTab('tickets');
    }
  }, [searchParams]);

  const switchMainTab = (tab: 'tickets' | 'results') => {
    setMainTab(tab);
    setSearchParams({ tab });
  };

  // Live Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Tickets
  useEffect(() => {
    if (!isLoggedIn || !currentUserId) {
      setTickets([]);
      return;
    }

    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', currentUserId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    }, (err) => {
      console.warn('Tickets subscription warning:', err);
    });

    return () => unsubscribe();
  }, [currentUserId, isLoggedIn]);

  // Fetch Lottery Results
  useEffect(() => {
    const q = query(collection(db, 'lotteryResults'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as LotteryResultItem)));
    });
    return () => unsubscribe();
  }, []);

  // Find result for a lottery
  const getResultFor = (name: string) => {
    return results.find(r => {
      const matchName = (r.lotteryName === name) || (r.type === name) || (r.lotteryName && r.lotteryName.includes(name));
      const matchDate = !filterDate || r.date === filterDate || (r.createdAt && r.createdAt.startsWith(filterDate));
      return matchName && matchDate;
    });
  };

  // Get status details for a ticket
  const getStatusDisplay = (ticket: any) => {
    if (ticket.status === 'cancelled') {
      return { label: 'ยกเลิกแล้ว', color: 'bg-slate-800 text-slate-400 border border-slate-700', isCancelled: true };
    }
    if (ticket.status === 'win') {
      return { 
        label: `ชนะ ฿${(ticket.winAmount || 0).toLocaleString()}`, 
        color: 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]',
        isWin: true 
      };
    }
    if (ticket.status === 'lose') {
      return { label: 'ไม่ถูกรางวัล', color: 'bg-rose-950/60 text-rose-400 border border-rose-500/30' };
    }
    
    const expiresAt = new Date(ticket.expiresAt).getTime();
    if (currentTime < expiresAt) {
      const remaining = Math.max(0, Math.floor((expiresAt - currentTime) / 1000));
      return { 
        label: `ลุ้นสด (ยกเลิกได้ ${remaining}ว.)`, 
        color: 'bg-amber-950/80 text-amber-300 border border-amber-500/50 animate-pulse', 
        canCancel: true 
      };
    }
    
    return { 
      label: '● รอผลรางวัล (LIVE)', 
      color: 'bg-blue-950/80 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]' 
    };
  };

  // Filter tickets by status
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const statusInfo = getStatusDisplay(t);
      if (ticketStatusFilter === 'pending' && !statusInfo.label.includes('รอผล') && !statusInfo.label.includes('ลุ้นสด')) return false;
      if (ticketStatusFilter === 'win' && t.status !== 'win') return false;
      if (ticketStatusFilter === 'lose' && t.status !== 'lose') return false;
      if (ticketStatusFilter === 'cancelled' && t.status !== 'cancelled') return false;
      return true;
    });
  }, [tickets, ticketStatusFilter, currentTime]);

  // Tickets Stats
  const ticketStats = useMemo(() => {
    const totalCount = tickets.length;
    const pendingCount = tickets.filter(t => t.status !== 'cancelled' && t.status !== 'win' && t.status !== 'lose').length;
    const winTickets = tickets.filter(t => t.status === 'win');
    const totalWinAmount = winTickets.reduce((sum, t) => sum + (t.winAmount || 0), 0);
    const totalBetAmount = tickets.filter(t => t.status !== 'cancelled').reduce((sum, t) => sum + (t.totalAmount || 0), 0);

    return { totalCount, pendingCount, totalWinAmount, totalBetAmount };
  }, [tickets]);

  // Cancel Ticket within window
  const cancelTicket = async (ticket: any) => {
    if (!window.confirm(`คุณต้องการยกเลิกโพย #${ticket.ticketId} ใช่หรือไม่? ยอดเงิน ฿${ticket.totalAmount?.toLocaleString()} จะถูกคืนเข้ากระเป๋าเครดิตทันที`)) {
      return;
    }

    try {
      const userRef = doc(db, 'users', ticket.userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentBalance = userSnap.data().balance || 0;
        await updateDoc(userRef, { balance: currentBalance + ticket.totalAmount });
        
        await addDoc(collection(db, 'transactions'), {
          userId: ticket.userId,
          type: 'refund',
          amount: ticket.totalAmount,
          description: `คืนเงินยกเลิกโพย ${ticket.ticketId}`,
          createdAt: new Date().toISOString()
        });
      }
      
      await updateDoc(doc(db, 'tickets', ticket.id), { status: 'cancelled' });
      alert('ยกเลิกโพยสำเร็จ คืนเงินเครดิตเข้ากระเป๋าเรียบร้อยแล้ว');
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการยกเลิกโพย');
    }
  };

  // Copy Ticket as Line/Facebook bill
  const copyTicketAsBillText = (ticket: any) => {
    const groups: { [key: string]: { number: string; amount: number }[] } = {};
    const bets = ticket.bets || [];
    bets.forEach((bet: any) => {
      const typeKey = bet.type || bet.category || 'แทงหวย';
      if (!groups[typeKey]) groups[typeKey] = [];
      groups[typeKey].push({ number: bet.number, amount: bet.amount || bet.price || 0 });
    });

    let billText = `=============================\n`;
    billText += `★ ใบเสร็จรับเงิน / โพยแทงหวย AK88\n`;
    billText += `★ ประเภท: ${ticket.lotteryType}\n`;
    billText += `=============================\n`;
    billText += `รหัสโพย: #${ticket.ticketId}\n`;
    billText += `เวลาที่ซื้อ: ${new Date(ticket.createdAt).toLocaleString('th-TH')}\n`;
    billText += `ลูกค้า: ${ticket.customerName || 'ลูกค้าทั่วไป'}\n`;
    billText += `-----------------------------\n`;

    Object.entries(groups).forEach(([typeKey, typeBets]) => {
      billText += `▶ [${typeKey}]\n`;
      const lines: string[] = [];
      typeBets.forEach(b => {
        lines.push(`${b.number}=${b.amount}฿`);
      });
      for (let i = 0; i < lines.length; i += 3) {
        billText += `   ` + lines.slice(i, i + 3).join(', ') + `\n`;
      }
      const typeTotal = typeBets.reduce((sum, b) => sum + b.amount, 0);
      billText += `   รวมหมวดนี้: ฿${typeTotal.toLocaleString()} บาท\n`;
      billText += `-----------------------------\n`;
    });

    billText += `ยอดชำระสุทธิ: ฿${(ticket.totalAmount || 0).toLocaleString()} บาท\n`;
    billText += `=============================\n`;
    billText += `* ขอให้ท่านโชคดีกับ AK88 LOTTO *\n`;

    navigator.clipboard.writeText(billText).then(() => {
      setCopiedId(ticket.id);
      setTimeout(() => setCopiedId(null), 2500);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert('ไม่สามารถคัดลอกได้อัตโนมัติ');
    });
  };

  // Filtered catalog for results
  const filteredCatalog = useMemo(() => {
    return LOTTERY_CATALOG.filter(item => {
      if (resultCategory !== 'all' && item.category !== resultCategory) return false;
      if (resultSearchQuery && !item.name.toLowerCase().includes(resultSearchQuery.toLowerCase())) return false;
      return true;
    });
  }, [resultCategory, resultSearchQuery]);

  // Live Score Ticker Items (top 4-5 major lotteries)
  const liveTickerItems = useMemo(() => {
    return LOTTERY_CATALOG.slice(0, 7).map(item => {
      const res = getResultFor(item.name);
      return {
        ...item,
        threeUp: res?.results?.threeUp || res?.result3Top || '---',
        twoDown: res?.results?.twoDown || res?.result2Bottom || '--',
        hasResult: Boolean(res)
      };
    });
  }, [results, filterDate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060c2b] via-[#08103a] to-[#04081c] text-white pb-32 font-sans select-none">
      
      {/* 1. TOP LIVE SCOREBOARD TICKER (ฟิลดูบอลสด / ผลหวยสดวิ่งด้านบน) */}
      <div className="bg-[#050b24] border-b-2 border-cyan-400/50 shadow-xl overflow-hidden py-2 px-3">
        <div className="max-w-[1580px] mx-auto flex items-center justify-between gap-3">
          {/* Live Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <span className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">sports_soccer</span>
              LIVE SCORES • ผลหวยออกสด
            </span>
          </div>

          {/* Scrolling / Horizontal Cards */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {liveTickerItems.map((item, idx) => (
              <div 
                key={idx}
                className="shrink-0 flex items-center gap-2 bg-[#081533] border border-cyan-500/30 px-2.5 py-1 rounded-xl shadow-sm text-xs"
              >
                {item.flag ? (
                  <img src={item.flag} alt="" className="w-4 h-3 rounded object-cover shadow" referrerPolicy="no-referrer" />
                ) : (
                  <span className="material-symbols-outlined text-sm text-amber-400">casino</span>
                )}
                <span className="font-bold text-slate-200">{item.name}</span>
                <span className="font-mono font-black text-amber-400 bg-[#050f24] px-1.5 py-0.5 rounded border border-amber-400/30">
                  {item.threeUp}
                </span>
                <span className="font-mono font-black text-cyan-300 bg-[#050f24] px-1.5 py-0.5 rounded border border-cyan-400/30">
                  {item.twoDown}
                </span>
              </div>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-400 shrink-0 font-mono">
            <span className="material-symbols-outlined text-xs text-emerald-400">sync</span>
            เรียลไทม์
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER & DUAL TABS */}
      <div className="max-w-[1580px] mx-auto px-3 sm:px-4 pt-4">
        
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 rounded-xl border border-cyan-400/40 bg-[#091838] hover:bg-[#0f2754] text-cyan-300 transition active:scale-95 shadow"
              title="กลับหน้าหลัก"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-2xl">receipt_long</span>
                โพยหวย & ผลรางวัลสด
              </h1>
              <p className="text-xs text-slate-400">
                ตรวจสอบสถานะบิลเดิมพัน ตรวจผลรางวัลสด สกอร์บอร์ดแบบดูบอลครบจบที่เดียว
              </p>
            </div>
          </div>

          {/* Quick Bet Button */}
          <Link
            to="/lottery"
            className="w-full sm:w-auto px-4 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/30 border border-red-400 active:scale-95 transition"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            แทงหวยรอบใหม่
          </Link>
        </div>

        {/* Big Dual Tab Bar (โพยหวยของฉัน VS ผลหวยสด/ตารางผลบอล) */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#050b24] border-2 border-cyan-400/80 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.25)] mb-5">
          <button
            type="button"
            onClick={() => switchMainTab('tickets')}
            className={`py-3 px-4 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all ${
              mainTab === 'tickets'
                ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white shadow-lg shadow-red-600/40 border-2 border-red-400 scale-[1.01]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-xl">confirmation_number</span>
            <span>โพยหวยของฉัน</span>
            {tickets.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${mainTab === 'tickets' ? 'bg-black/30 text-white' : 'bg-[#091838] text-cyan-300'}`}>
                {tickets.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => switchMainTab('results')}
            className={`py-3 px-4 rounded-xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all ${
              mainTab === 'results'
                ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/40 border-2 border-cyan-300 scale-[1.01]'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-xl">sports_soccer</span>
            <span>ผลหวยที่ออก (สกอร์บอร์ดสด)</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </button>
        </div>

        {/* ========================================================
            TAB 1: โพยหวยของฉัน (MY BETTING TICKETS)
           ======================================================== */}
        {mainTab === 'tickets' && (
          <div className="space-y-4">
            
            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-[#081533] border border-cyan-500/30 rounded-2xl p-3 shadow-md">
                <div className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-cyan-400">receipt</span>
                  โพยทั้งหมด
                </div>
                <div className="text-xl sm:text-2xl font-black text-white tabular-nums">
                  {ticketStats.totalCount} <span className="text-xs text-slate-400 font-normal">ใบ</span>
                </div>
              </div>

              <div className="bg-[#081533] border border-amber-500/30 rounded-2xl p-3 shadow-md">
                <div className="text-[10px] text-amber-300/80 font-bold mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-amber-400">hourglass_top</span>
                  กำลังรอผล (LIVE)
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-400 tabular-nums">
                  {ticketStats.pendingCount} <span className="text-xs text-slate-400 font-normal">ใบ</span>
                </div>
              </div>

              <div className="bg-[#081533] border border-emerald-500/30 rounded-2xl p-3 shadow-md">
                <div className="text-[10px] text-emerald-300/80 font-bold mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-emerald-400">emoji_events</span>
                  ยอดชนะรางวัลรวม
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 tabular-nums">
                  ฿{ticketStats.totalWinAmount.toLocaleString()}
                </div>
              </div>

              <div className="bg-[#081533] border border-cyan-500/30 rounded-2xl p-3 shadow-md">
                <div className="text-[10px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-cyan-400">payments</span>
                  ยอดเดิมพันรวม
                </div>
                <div className="text-xl sm:text-2xl font-black text-cyan-300 tabular-nums">
                  ฿{ticketStats.totalBetAmount.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {[
                { id: 'all', label: 'โพยทั้งหมด', icon: 'wb_sunny' },
                { id: 'pending', label: 'รอผลรางวัล (LIVE)', icon: 'history' },
                { id: 'win', label: 'ถูกรางวัล (ชนะ)', icon: 'check_circle' },
                { id: 'lose', label: 'ไม่ถูกรางวัล', icon: 'close' },
                { id: 'cancelled', label: 'ยกเลิก/คืนแล้ว', icon: 'cancel' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setTicketStatusFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all border ${
                    ticketStatusFilter === f.id
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-400 shadow-md shadow-red-600/30 scale-[1.02]'
                      : 'bg-[#081533] text-slate-300 border-cyan-500/20 hover:border-cyan-400/40'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{f.icon}</span>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Ticket Cards Grid */}
            <div className="space-y-3.5">
              {filteredTickets.length === 0 ? (
                <div className="border-2 border-cyan-500/30 rounded-2xl bg-[#081533]/80 p-12 text-center text-slate-400 shadow-lg">
                  <span className="material-symbols-outlined text-5xl text-slate-600 mb-2">receipt_long</span>
                  <p className="font-bold text-sm text-slate-300">ไม่พบรายการโพยตามเงื่อนไขที่เลือก</p>
                  <p className="text-xs text-slate-500 mt-1">สามารถเลือกแทงหวยใหม่ได้ตลอด 24 ชั่วโมง</p>
                  <Link
                    to="/lottery"
                    className="inline-flex items-center gap-1.5 mt-4 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs shadow-md transition active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    เข้าสู่หน้าแทงหวย
                  </Link>
                </div>
              ) : (
                filteredTickets.map(ticket => {
                  const statusInfo = getStatusDisplay(ticket);
                  const relatedResult = getResultFor(ticket.lotteryType);

                  return (
                    <div
                      key={ticket.id}
                      className={`border-2 rounded-2xl bg-[#081533]/90 overflow-hidden shadow-xl transition-all relative ${
                        ticket.status === 'win' 
                          ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                          : ticket.status === 'cancelled'
                            ? 'border-slate-700 opacity-75'
                            : 'border-cyan-500/40 hover:border-cyan-400'
                      }`}
                    >
                      {/* Cancellation Watermark */}
                      {ticket.status === 'cancelled' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 select-none">
                          <div className="border-4 border-red-500/30 text-red-500/30 font-black text-4xl sm:text-5xl px-8 py-2 transform -rotate-12 uppercase tracking-widest rounded-xl">
                            CANCELLED / ยกเลิกแล้ว
                          </div>
                        </div>
                      )}

                      {/* Ticket Header */}
                      <div className="bg-[#050f24] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/30">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-[#091838] border border-cyan-400/40 text-cyan-300 flex items-center justify-center font-black">
                            <span className="material-symbols-outlined text-base">receipt</span>
                          </div>
                          <div>
                            <div className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                              {ticket.lotteryType}
                              <span className="text-[10px] text-slate-400 font-mono">#{ticket.ticketId}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(ticket.createdAt).toLocaleDateString('th-TH')} • {new Date(ticket.createdAt).toLocaleTimeString('th-TH')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Live Winning Match Result Banner (if result exists) */}
                      {relatedResult && (
                        <div className="bg-[#040c1e] px-3.5 py-2 border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                            <span className="material-symbols-outlined text-sm">emoji_events</span>
                            <span>ผลหวยงวดนี้:</span>
                          </div>
                          <div className="flex items-center gap-3 font-mono">
                            <div>
                              <span className="text-[10px] text-slate-400 mr-1">3 ตัวบน:</span>
                              <span className="font-black text-amber-300 bg-[#091838] px-2 py-0.5 rounded border border-amber-400/30">
                                {relatedResult.results?.threeUp || relatedResult.result3Top || '---'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 mr-1">2 ตัวล่าง:</span>
                              <span className="font-black text-cyan-300 bg-[#091838] px-2 py-0.5 rounded border border-cyan-400/30">
                                {relatedResult.results?.twoDown || relatedResult.result2Bottom || '--'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Ticket Body: Bets breakdown */}
                      <div className="p-3.5 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            ลูกค้า: <b className="text-white">{ticket.customerName || 'ลูกค้าทั่วไป'}</b>
                          </span>
                          <span className="text-slate-400">
                            รายการแทงทั้งหมด: <b className="text-cyan-300">{ticket.bets?.length || 0} รายการ</b>
                          </span>
                        </div>

                        {/* Bet Numbers Chips */}
                        <div className="bg-[#050f24] p-3 rounded-xl border border-cyan-500/20 max-h-48 overflow-y-auto space-y-2">
                          {Object.entries(
                            ((ticket.bets as any[]) || []).reduce((acc: any, bet: any) => {
                              const groupKey = bet.type || bet.category || 'รายการ';
                              if (!acc[groupKey]) acc[groupKey] = [];
                              acc[groupKey].push(bet);
                              return acc;
                            }, {} as Record<string, any[]>)
                          ).map(([typeKey, typeBets]) => {
                            const typeTotal = (typeBets as any[]).reduce((sum, b) => sum + (b.amount || b.price || 0), 0);
                            return (
                              <div key={typeKey} className="text-xs p-2 rounded-lg bg-[#081533] border border-cyan-500/20">
                                <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-cyan-500/20">
                                  <span className="px-2 py-0.5 rounded bg-black/40 text-amber-400 font-black text-[11px] border border-amber-400/30">
                                    {typeKey}
                                  </span>
                                  <span className="text-[10px] text-cyan-300 font-bold">
                                    รวม ฿{typeTotal.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 font-mono">
                                  {(typeBets as any[]).map((b, bIdx) => (
                                    <span 
                                      key={bIdx} 
                                      className="bg-[#050f24] border border-cyan-500/30 px-2 py-0.5 rounded text-white font-bold flex items-center gap-1"
                                    >
                                      <span>{b.number}</span>
                                      <span className="text-amber-400 text-[10px]">={b.amount || b.price}฿</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Price & Summary */}
                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <span className="text-xs text-slate-400 block leading-tight">ยอดเดิมพันสุทธิ</span>
                            <span className="text-lg sm:text-xl font-black text-amber-400 tabular-nums">
                              ฿{(ticket.totalAmount || 0).toLocaleString()} บาท
                            </span>
                          </div>

                          {ticket.winAmount > 0 && (
                            <div className="text-right">
                              <span className="text-xs text-emerald-400 font-bold block leading-tight">★ ได้รับรางวัล</span>
                              <span className="text-lg sm:text-xl font-black text-emerald-400 tabular-nums">
                                +฿{ticket.winAmount.toLocaleString()} บาท
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-cyan-500/20">
                          {/* Re-bet */}
                          <button
                            type="button"
                            onClick={() => {
                              if (ticket.ticketType === 'set') {
                                const slug = ticket.lotteryType.includes('ฮานอย') ? 'hanoi' : (ticket.lotteryType.includes('ลาว') ? 'lao' : 'thai');
                                navigate(`/lottery/set/${slug}`);
                              } else if (ticket.lotteryType?.includes('ยี่กี')) {
                                navigate('/lottery/yeekee');
                              } else {
                                navigate('/lottery');
                              }
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs flex items-center justify-center gap-1 transition active:scale-95 shadow"
                          >
                            <span className="material-symbols-outlined text-sm">history</span>
                            แทงอีกรอบ
                          </button>

                          {/* Copy for LINE / Facebook */}
                          <button
                            type="button"
                            onClick={() => copyTicketAsBillText(ticket)}
                            className="py-2 px-3 rounded-xl bg-[#091838] hover:bg-[#0f2754] text-cyan-300 border border-cyan-400/40 font-bold text-xs flex items-center gap-1 transition active:scale-95 shadow"
                          >
                            <span className="material-symbols-outlined text-sm">content_copy</span>
                            {copiedId === ticket.id ? '✓ คัดลอกแล้ว' : 'แชร์บิล LINE'}
                          </button>

                          {/* Cancel if eligible */}
                          {statusInfo.canCancel && (
                            <button
                              type="button"
                              onClick={() => cancelTicket(ticket)}
                              className="py-2 px-3 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/40 font-black text-xs flex items-center gap-1 transition active:scale-95"
                            >
                              <span className="material-symbols-outlined text-sm">cancel</span>
                              ยกเลิกโพย (คืนเงิน)
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* ========================================================
            TAB 2: ผลหวยที่ออกสด (LIVE RESULTS & MATCH SCOREBOARD)
           ======================================================== */}
        {mainTab === 'results' && (
          <div className="space-y-4">
            
            {/* Control & Filter Card */}
            <div className="border-2 border-cyan-400/70 rounded-2xl bg-[#081533]/90 p-3 sm:p-4 shadow-[0_0_20px_rgba(6,182,212,0.2)] space-y-3">
              <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                  <input
                    type="text"
                    value={resultSearchQuery}
                    onChange={(e) => setResultSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อหวย เช่น ฮานอย, ลาว, หุ้น..."
                    className="w-full bg-[#050f24] border border-cyan-500/30 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                  />
                  {resultSearchQuery && (
                    <button onClick={() => setResultSearchQuery('')} className="absolute right-3 top-2 text-slate-400 hover:text-white">✕</button>
                  )}
                </div>

                {/* Date Picker (สไตล์ดูผลย้อนหลัง) */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-amber-400">calendar_month</span>
                    งวดวันที่:
                  </span>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="bg-[#050f24] border border-cyan-500/40 rounded-xl px-3 py-1.5 text-xs font-black text-amber-300 outline-none cursor-pointer focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-cyan-500/20">
                {[
                  { id: 'all', label: 'ทั้งหมด (24 หวย)' },
                  { id: 'thai', label: '🇹🇭 หวยรัฐบาล/ออมสิน' },
                  { id: 'lao', label: '🇱🇦 หวยลาว' },
                  { id: 'hanoi', label: '🇻🇳 หวยฮานอย' },
                  { id: 'stock', label: '📈 หวยหุ้น VIP' },
                  { id: 'yeekee', label: '🎯 หวยยี่กี' },
                ].map(c => (
                  <button
                    key={c.id}
                    onClick={() => setResultCategory(c.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-all border ${
                      resultCategory === c.id
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-300 shadow-md scale-[1.02]'
                        : 'bg-[#050f24] text-slate-300 border-cyan-500/30 hover:border-cyan-400'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Match Scorecards Grid (ฟิลสกอร์บอร์ดดูบอลสด!) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredCatalog.map((item, idx) => {
                const res = getResultFor(item.name);
                const isThaiGov = item.name === 'หวยรัฐบาล';
                const hasResult = Boolean(res);

                const threeUp = res?.results?.threeUp || res?.result3Top || '---';
                const twoUp = threeUp !== '---' ? threeUp.slice(-2) : '--';
                const twoDown = res?.results?.twoDown || res?.result2Bottom || '--';
                const threeFront = res?.results?.threeFront || res?.result3Front || '--- ---';
                const threeBack = res?.results?.threeBack || res?.result3Bottom || '--- ---';

                return (
                  <div
                    key={idx}
                    className="border-2 border-cyan-400/60 hover:border-cyan-400 rounded-2xl bg-[#081533]/90 overflow-hidden shadow-xl transition-all hover:scale-[1.01]"
                  >
                    {/* Match Card Header (เหมือนคู่บอล) */}
                    <div className="bg-[#050f24] px-3.5 py-2.5 border-b border-cyan-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.flag ? (
                          <img 
                            src={item.flag} 
                            alt={item.name} 
                            className="w-5 h-3.5 rounded object-cover shadow border border-white/20 shrink-0" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-amber-400 text-base shrink-0">casino</span>
                        )}
                        <span className="font-black text-sm text-white truncate">
                          {item.name}
                        </span>
                      </div>

                      {/* Match Status Badge */}
                      {hasResult ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 shadow-sm flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          จบงวด / ออกแล้ว
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          รอผล {item.drawTime}
                        </span>
                      )}
                    </div>

                    {/* Scoreboard Body (Big Football-style Score Digits!) */}
                    <div className="p-3.5 space-y-3">
                      
                      {/* Big Score Numbers */}
                      <div className="grid grid-cols-3 gap-2 bg-[#050f24] p-3 rounded-xl border border-cyan-500/30 text-center divide-x divide-cyan-500/20">
                        {/* 3 ตัวบน */}
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            3 ตัวบน
                          </div>
                          <div className="font-mono font-black text-2xl sm:text-3xl text-amber-400 drop-shadow-[0_0_8px_rgba(245,197,24,0.4)]">
                            {threeUp}
                          </div>
                        </div>

                        {/* 2 ตัวบน */}
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            2 ตัวบน
                          </div>
                          <div className="font-mono font-black text-2xl sm:text-3xl text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                            {twoUp}
                          </div>
                        </div>

                        {/* 2 ตัวล่าง */}
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            2 ตัวล่าง
                          </div>
                          <div className="font-mono font-black text-2xl sm:text-3xl text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                            {twoDown}
                          </div>
                        </div>
                      </div>

                      {/* Thai Government Extra Prizes */}
                      {isThaiGov && (
                        <div className="grid grid-cols-2 gap-2 text-center text-xs">
                          <div className="bg-[#050f24] p-2 rounded-lg border border-red-500/30">
                            <span className="text-[10px] text-slate-400 block mb-0.5 font-bold">3 ตัวหน้า</span>
                            <span className="font-mono font-black text-amber-300 text-sm">{threeFront}</span>
                          </div>
                          <div className="bg-[#050f24] p-2 rounded-lg border border-cyan-500/30">
                            <span className="text-[10px] text-slate-400 block mb-0.5 font-bold">3 ตัวล่าง</span>
                            <span className="font-mono font-black text-cyan-300 text-sm">{threeBack}</span>
                          </div>
                        </div>
                      )}

                      {/* Card Footer: Draw time info & Quick Bet CTA */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs text-cyan-400">schedule</span>
                          {item.drawTime}
                        </span>

                        <Link
                          to={item.betPath}
                          className="px-3 py-1 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-[11px] flex items-center gap-1 shadow transition active:scale-95"
                        >
                          <span>แทงหวยนี้</span>
                          <span className="material-symbols-outlined text-xs">chevron_right</span>
                        </Link>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
