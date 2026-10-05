import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { collection, onSnapshot, doc, getDoc, updateDoc, query, where, getDocs, addDoc } from 'firebase/firestore';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { fmtMoney, fmtInt } from '@/shared/lib/betCount';

interface SetRowItem {
  id: number;
  number: string; // 4 หลัก เช่น "1234"
  yai: boolean;   // ชุดใหญ่ 120฿
  klang: boolean; // ชุดกลาง 60฿
  lek: boolean;   // ชุดเล็ก 30฿
}

interface SetBetItem {
  id: string;
  number: string;
  category: 'ชุดใหญ่' | 'ชุดกลาง' | 'ชุดเล็ก';
  price: number;
  type: string;
  rowId: number;
}

interface ActiveSetTicket {
  id: string;
  ticketId: string;
  bets: SetBetItem[];
  totalAmount: number;
  createdAt: number;
  expiresAt: number;
  status?: string;
  customerName?: string;
  lotteryType?: string;
}

const SET_PAYOUT_TABLE = [
  { rank: '4 ตัวตรง', yai: '120,000฿', klang: '45,000฿', lek: '30,000฿', desc: 'เลขตรงกันทั้ง 4 หลักตรงตำแหน่ง' },
  { rank: '3 ตัวตรง', yai: '41,000฿',  klang: '20,000฿', lek: '10,000฿', desc: 'เลข 3 ตัวท้าย ตรงตำแหน่ง' },
  { rank: '4 ตัวโต๊ด', yai: '5,500฿',   klang: '2,750฿',  lek: '1,375฿',  desc: 'มีเลขครบ 4 ตัว สลับตำแหน่งได้' },
  { rank: '3 ตัวโต๊ด', yai: '4,000฿',   klang: '2,000฿',  lek: '1,000฿',  desc: 'เลข 3 ตัวท้าย สลับตำแหน่งได้' },
  { rank: '2 ตัวหน้า', yai: '1,700฿',   klang: '750฿',    lek: '350฿',    desc: 'เลข 2 ตัวหน้า ตรงตำแหน่ง' },
  { rank: '2 ตัวหลัง', yai: '1,700฿',   klang: '750฿',    lek: '350฿',    desc: 'เลข 2 ตัวท้าย ตรงตำแหน่ง' },
];

const SET_LOTTERY_OPTIONS = [
  { id: 'lao', name: 'หวยลาวชุด', slug: 'lao', flag: 'https://flagcdn.com/w80/la.png', closeTime: '20:00 น.' },
  { id: 'lao-star', name: 'หวยลาวสตาร์ชุด', slug: 'lao-star', flag: 'https://flagcdn.com/w80/la.png', closeTime: '15:30 น.' },
  { id: 'hanoi', name: 'หวยฮานอยชุด', slug: 'hanoi', flag: 'https://flagcdn.com/w80/vn.png', closeTime: '18:00 น.' },
  { id: 'hanoi-special', name: 'หวยฮานอยพิเศษชุด', slug: 'hanoi-special', flag: 'https://flagcdn.com/w80/vn.png', closeTime: '17:00 น.' },
  { id: 'hanoi-vip', name: 'หวยฮานอย VIP ชุด', slug: 'hanoi-vip', flag: 'https://flagcdn.com/w80/vn.png', closeTime: '19:00 น.' },
  { id: 'thai', name: 'หวยรัฐบาลชุด', slug: 'thai', flag: 'https://flagcdn.com/w80/th.png', closeTime: '15:20 น.' },
  { id: 'gsb', name: 'หวยออมสินชุด', slug: 'gsb', flag: 'https://flagcdn.com/w80/th.png', closeTime: '12:30 น.' },
  { id: 'baac', name: 'หวย ธ.ก.ส. ชุด', slug: 'baac', flag: 'https://flagcdn.com/w80/th.png', closeTime: '11:00 น.' },
];

export default function LotterySetBet() {
  const navigate = useNavigate();
  const { type } = useParams();
  const { isPC } = useBreakpoint();

  // Find lottery by param slug
  const currentSetOption = useMemo(() => {
    const slug = (type || 'lao').toLowerCase();
    const found = SET_LOTTERY_OPTIONS.find(o => o.slug === slug || o.id === slug);
    return found || SET_LOTTERY_OPTIONS[0];
  }, [type]);

  const [lotterySetType, setLotterySetType] = useState(currentSetOption.name);
  const [customerName, setCustomerName] = useState('');

  // 15 Rows Table State (matching user's reference layout)
  const [rows, setRows] = useState<SetRowItem[]>(() => 
    Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      number: '',
      yai: false,
      klang: false,
      lek: false,
    }))
  );

  // Modals state
  const [showLotterySelector, setShowLotterySelector] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // User & Ticket Data
  const [userData, setUserData] = useState<any>(null);
  const [activeTickets, setActiveTickets] = useState<ActiveSetTicket[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [blockedNumbers, setBlockedNumbers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Mobile sub-tab state (for small screens)
  const [mobileTab, setMobileTab] = useState<'betting' | 'payouts' | 'history'>('betting');

  // Input refs for keyboard navigation
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Update lottery name if route changes
  useEffect(() => {
    setLotterySetType(currentSetOption.name);
  }, [currentSetOption]);

  // Live Timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentUserId = localStorage.getItem('userId');
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  // User Profile & Balance Sync
  useEffect(() => {
    if (!isLoggedIn || !currentUserId) {
      setUserData(null);
      return;
    }

    const unsubscribeUser = onSnapshot(doc(db, 'users', currentUserId), (snapshot) => {
      if (snapshot.exists()) {
        setUserData(snapshot.data());
      }
    });
    return () => unsubscribeUser();
  }, [currentUserId, isLoggedIn]);

  // Sync Tickets History
  useEffect(() => {
    if (!isLoggedIn || !currentUserId) {
      setActiveTickets([]);
      return;
    }

    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', currentUserId),
      where('ticketType', '==', 'set')
    );
    const unsubscribeTickets = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ticketId: data.ticketId || docSnap.id,
          bets: data.bets || [],
          totalAmount: data.totalAmount || 0,
          createdAt: new Date(data.createdAt).getTime(),
          expiresAt: new Date(data.expiresAt).getTime(),
          status: data.status,
          customerName: data.customerName,
          lotteryType: data.lotteryType
        } as ActiveSetTicket;
      });
      list.sort((a, b) => b.createdAt - a.createdAt);
      setActiveTickets(list);
    });

    return () => unsubscribeTickets();
  }, [currentUserId, isLoggedIn]);

  // Blocked Numbers Sync
  useEffect(() => {
    const unsubscribeBlocked = onSnapshot(collection(db, 'blocked_numbers'), (snapshot) => {
      const blocked = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((b: any) => !b.lotteryType || b.lotteryType === lotterySetType || b.lotteryType === 'ทุกประเภท');
      setBlockedNumbers(blocked);
    });
    return () => unsubscribeBlocked();
  }, [lotterySetType]);

  // Handle 4-digit input change
  const handleNumberChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 4);
    setRows(prev => {
      const updated = [...prev];
      const prevRow = updated[index];
      // If completed 4 digits and no tier selected yet, auto select 'yai' (ชุดใหญ่ 120฿)
      const shouldAutoSelect = cleaned.length === 4 && !prevRow.yai && !prevRow.klang && !prevRow.lek;
      updated[index] = {
        ...prevRow,
        number: cleaned,
        yai: shouldAutoSelect ? true : prevRow.yai,
      };
      return updated;
    });

    // Auto-focus next row if completed 4 digits
    if (cleaned.length === 4 && index < rows.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Toggle tier for a specific row
  const toggleRowTier = (index: number, tier: 'yai' | 'klang' | 'lek') => {
    setRows(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [tier]: !updated[index][tier]
      };
      return updated;
    });
  };

  // Clear specific row (the "✖ แถว X" button)
  const clearRow = (index: number) => {
    setRows(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        number: '',
        yai: false,
        klang: false,
        lek: false
      };
      return updated;
    });
  };

  // Quick Action: Randomize all rows or empty rows
  const handleRandomize = (onlyEmpty = false) => {
    setRows(prev => prev.map(row => {
      if (onlyEmpty && row.number.length === 4) return row;
      const rand4 = Math.floor(1000 + Math.random() * 9000).toString();
      return {
        ...row,
        number: rand4,
        yai: row.yai || (!row.klang && !row.lek ? true : row.yai),
      };
    }));
  };

  // Quick Action: Toggle a tier for all filled rows
  const handleToggleColumnAll = (tier: 'yai' | 'klang' | 'lek') => {
    const filled = rows.filter(r => r.number.length === 4);
    if (filled.length === 0) return;
    const allChecked = filled.every(r => r[tier]);
    setRows(prev => prev.map(r => {
      if (r.number.length === 4) {
        return { ...r, [tier]: !allChecked };
      }
      return r;
    }));
  };

  // Clear all rows
  const handleClearAll = () => {
    setRows(prev => prev.map(r => ({
      ...r,
      number: '',
      yai: false,
      klang: false,
      lek: false
    })));
  };

  // Add 5 more rows
  const handleAddRows = () => {
    setRows(prev => [
      ...prev,
      ...Array.from({ length: 5 }, (_, i) => ({
        id: prev.length + i + 1,
        number: '',
        yai: false,
        klang: false,
        lek: false
      }))
    ]);
  };

  // Calculate Prepared Bets and Total
  const preparedBets = useMemo(() => {
    const list: SetBetItem[] = [];
    rows.forEach(r => {
      if (r.number.length === 4) {
        if (r.yai) {
          list.push({
            id: `row-${r.id}-yai`,
            number: r.number,
            category: 'ชุดใหญ่',
            price: 120,
            type: lotterySetType,
            rowId: r.id
          });
        }
        if (r.klang) {
          list.push({
            id: `row-${r.id}-klang`,
            number: r.number,
            category: 'ชุดกลาง',
            price: 60,
            type: lotterySetType,
            rowId: r.id
          });
        }
        if (r.lek) {
          list.push({
            id: `row-${r.id}-lek`,
            number: r.number,
            category: 'ชุดเล็ก',
            price: 30,
            type: lotterySetType,
            rowId: r.id
          });
        }
      }
    });
    return list;
  }, [rows, lotterySetType]);

  const totalCost = preparedBets.reduce((acc, item) => acc + item.price, 0);

  // Check if a number is blocked
  const isNumberBlocked = (num: string) => {
    return blockedNumbers.some(b => 
      b.number === num && (b.betType === 'ทุกประเภท' || b.betType === '4 ตัว' || b.betType === 'หวยชุด')
    );
  };

  // Confirm and Submit bets
  const handleConfirmPurchase = async () => {
    if (preparedBets.length === 0) {
      alert('กรุณากรอกเลข 4 ตัวให้ครบ และเลือกชุดที่ต้องการแทงอย่างน้อย 1 รายการ (ชุดใหญ่ 120฿, ชุดกลาง 60฿, หรือ ชุดเล็ก 30฿)');
      return;
    }

    // Check for blocked numbers
    const blockedFound = preparedBets.filter(b => isNumberBlocked(b.number));
    if (blockedFound.length > 0) {
      alert(`มีเลขปิด/เลขอั้นในรายการ: ${Array.from(new Set(blockedFound.map(b => b.number))).join(', ')}\nกรุณาเปลี่ยนตัวเลขก่อนส่งโพย`);
      return;
    }

    if (!currentUserId || !isLoggedIn) {
      alert('กรุณาเข้าสู่ระบบก่อนทำการแทงหวยชุด');
      navigate('/login');
      return;
    }

    const currentBalance = userData?.balance || 0;
    if (currentBalance < totalCost) {
      alert(`ยอดเงินเครดิตไม่เพียงพอ (มี ฿${currentBalance.toLocaleString()} / ต้องใช้ ฿${totalCost.toLocaleString()})\nกรุณาเติมเงินก่อนทำรายการ`);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Deduct Balance
      const newBalance = currentBalance - totalCost;
      await updateDoc(doc(db, 'users', currentUserId), {
        balance: newBalance
      });

      // 2. Prepare Ticket Document
      const newTicketId = `SET-${Math.floor(100000 + Math.random() * 900000)}`;
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      const ticketDoc = {
        ticketId: newTicketId,
        userId: currentUserId,
        ticketType: 'set',
        lotteryType: lotterySetType,
        bets: preparedBets,
        totalAmount: totalCost,
        createdAt: createdAt,
        expiresAt: expiresAt,
        status: 'active',
        customerName: customerName.trim() || userData?.username || 'สมาชิก'
      };

      await addDoc(collection(db, 'tickets'), ticketDoc);

      // 3. Set Receipt Modal
      setSuccessReceipt({
        ...ticketDoc,
        newBalance: newBalance,
        dateFormatted: new Date().toLocaleString('th-TH')
      });

      // 4. Reset rows
      handleClearAll();
      setCustomerName('');
    } catch (err) {
      console.error('Error submitting ticket:', err);
      alert('เกิดข้อผิดพลาดในการส่งโพย กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Ticket within 5-min window
  const cancelTicket = async (ticketId: string, amount: number) => {
    if (!window.confirm(`คุณต้องการยกเลิกโพย #${ticketId} และรับเงินคืน ฿${amount.toLocaleString()} เข้ากระเป๋าเครดิตหรือไม่?`)) {
      return;
    }

    try {
      if (!currentUserId) return;
      const userRef = doc(db, 'users', currentUserId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const curBal = userSnap.data().balance || 0;
        await updateDoc(userRef, {
          balance: curBal + amount
        });
      }

      const q = query(collection(db, 'tickets'), where('ticketId', '==', ticketId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'tickets', snap.docs[0].id), {
          status: 'cancelled'
        });
        alert('ยกเลิกโพยหวยชุดเรียบร้อย คืนยอดเครดิตเต็มจำนวนแล้ว');
      }
    } catch (error) {
      console.error('Error cancelling ticket:', error);
      alert('เกิดข้อผิดพลาดในการยกเลิกโพย');
    }
  };

  // Copy Bill Receipt
  const copyReceiptBill = () => {
    if (!successReceipt) return;
    const lines = [
      `=========================`,
      `★ ใบเสร็จซื้อหวยชุด AK88 (${successReceipt.lotteryType})`,
      `รหัสโพย: #${successReceipt.ticketId}`,
      `ลูกค้า: ${successReceipt.customerName}`,
      `เวลา: ${successReceipt.dateFormatted}`,
      `-------------------------`,
      `รายการที่ซื้อ (${successReceipt.bets.length} รายการ):`,
      ...successReceipt.bets.map((b: SetBetItem, idx: number) => 
        ` ${idx + 1}. แถว #${b.rowId} เลข [ ${b.number} ] - ${b.category} (฿${b.price})`
      ),
      `-------------------------`,
      `ยอดชำระรวม: ฿${successReceipt.totalAmount.toLocaleString()} บาท`,
      `เครดิตคงเหลือ: ฿${successReceipt.newBalance.toLocaleString()} บาท`,
      `ลุ้นรางวัล 4 ตัวตรงสูงสุด 120,000 บาท!`,
      `=========================`
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const formatRemainingTime = (expiresAt: number) => {
    const remaining = Math.max(0, Math.floor((expiresAt - currentTime) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format today's date in Thai or DD-MM-YYYY
  const drawDateText = useMemo(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear() + 543; // BE
    return `${day}-${month}-${year}`;
  }, []);

  // Filter history bets to show in right panel table
  const recentBetsList = useMemo(() => {
    const items: {
      ticketId: string;
      number: string;
      category: string;
      price: number;
      canCancel: boolean;
      status?: string;
      totalAmount: number;
    }[] = [];

    activeTickets.forEach(ticket => {
      const canCancel = ticket.status !== 'cancelled' && currentTime < ticket.expiresAt;
      ticket.bets.forEach(b => {
        items.push({
          ticketId: ticket.ticketId,
          number: b.number,
          category: b.category,
          price: b.price,
          canCancel,
          status: ticket.status,
          totalAmount: ticket.totalAmount
        });
      });
    });
    return items;
  }, [activeTickets, currentTime]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060c2b] via-[#08103a] to-[#04081c] text-white pb-32 font-sans select-none">
      
      {/* 1. Header Bar — AK88 Casino Navy & Cyan Neon */}
      <div className="bg-[#050b24]/95 backdrop-blur-md border-b border-cyan-500/30 p-2.5 sm:p-3 sticky top-0 z-40 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-2 sm:gap-3">
          <button 
            onClick={() => navigate('/lottery?tab=set')} 
            className="px-3 py-1.5 rounded-xl border border-cyan-400/40 bg-[#091838] hover:bg-[#0f2754] text-cyan-300 active:scale-95 transition flex items-center gap-1 text-xs font-bold shadow-md shadow-cyan-900/30"
            title="ย้อนกลับไปหน้ารวมหวย"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span className="hidden sm:inline">ย้อนกลับ</span>
          </button>
          
          {/* Lottery Switcher Trigger */}
          <button 
            onClick={() => setShowLotterySelector(true)}
            className="flex items-center gap-2 bg-[#091838]/80 hover:bg-[#0f2754] border border-cyan-400/30 rounded-xl px-2.5 py-1.5 transition text-left"
          >
            <img 
              src={currentSetOption.flag} 
              alt={currentSetOption.name}
              className="w-5 h-3.5 rounded object-cover shadow border border-cyan-400/40" 
              referrerPolicy="no-referrer"
            />
            <span className="font-extrabold text-sm sm:text-base text-white tracking-wide">
              {lotterySetType}
            </span>
            <span className="material-symbols-outlined text-xs text-cyan-400">expand_more</span>
          </button>

          {/* Date Badge */}
          <div className="bg-red-600/90 text-white font-black text-[11px] sm:text-xs px-2.5 py-1 rounded-full shadow-md shadow-red-600/30 border border-red-400">
            {drawDateText}
          </div>
        </div>

        {/* Live Balance / Top Profile */}
        <div className="flex items-center gap-2">
          <div className="rounded-xl px-2.5 sm:px-3 py-1 flex items-center gap-2 border border-amber-400/40 bg-[#07132e] shadow-md">
            <span className="material-symbols-outlined text-sm sm:text-base text-amber-400">account_balance_wallet</span>
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 block leading-tight">เครดิต</span>
              <span className="text-xs sm:text-sm font-black text-amber-400 tabular-nums">
                ฿{userData ? (userData.balance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sub-Navigation Tabs (Visible only on < lg screens) */}
      <div className="lg:hidden max-w-5xl mx-auto px-3 mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => setMobileTab('betting')}
          className={`py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 border transition-all ${
            mobileTab === 'betting'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-400 shadow-md shadow-red-600/40'
              : 'bg-[#081533] text-slate-300 border-cyan-500/20'
          }`}
        >
          <span className="material-symbols-outlined text-sm">grid_on</span>
          แผงแทงหวย
        </button>
        <button
          onClick={() => setMobileTab('payouts')}
          className={`py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 border transition-all ${
            mobileTab === 'payouts'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-400 shadow-md shadow-red-600/40'
              : 'bg-[#081533] text-slate-300 border-cyan-500/20'
          }`}
        >
          <span className="material-symbols-outlined text-sm">emoji_events</span>
          ตารางรางวัล
        </button>
        <button
          onClick={() => setMobileTab('history')}
          className={`py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 border transition-all ${
            mobileTab === 'history'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-400 shadow-md shadow-red-600/40'
              : 'bg-[#081533] text-slate-300 border-cyan-500/20'
          }`}
        >
          <span className="material-symbols-outlined text-sm">receipt_long</span>
          ประวัติการเล่น
          {recentBetsList.length > 0 && (
            <span className="bg-red-500 text-white text-[9px] px-1.5 rounded-full font-black ml-0.5">
              {recentBetsList.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Container — 3 Columns Layout matching user reference screenshot */}
      <div className="max-w-[1580px] mx-auto px-2 sm:px-4 mt-3 sm:mt-4">
        <div className="border-2 border-cyan-400/90 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 bg-[#050b24]/90 shadow-[0_0_35px_rgba(6,182,212,0.3)] backdrop-blur-md">
          
          {/* Top Banner inside box: Flag + Name + Date */}
          <div className="flex items-center justify-center gap-3 py-2 mb-3 border-b border-cyan-500/30">
            <img 
              src={currentSetOption.flag} 
              alt={currentSetOption.name}
              className="w-7 h-5 rounded shadow border border-cyan-400"
              referrerPolicy="no-referrer"
            />
            <h2 className="text-lg sm:text-xl font-black text-white tracking-wider flex items-center gap-2">
              {lotterySetType}
            </h2>
            <div className="bg-red-600 text-white font-black text-xs sm:text-sm px-3 py-0.5 rounded-full shadow-md shadow-red-600/40 border border-red-400">
              {drawDateText}
            </div>
          </div>

          {/* 3 Columns Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
            
            {/* ========================================================
                COLUMN 1 (LEFT): USER BOX, ACTION BUTTONS, PAYOUT TABLE
               ======================================================== */}
            <div className={`lg:col-span-3 space-y-3 sm:space-y-4 ${mobileTab !== 'payouts' ? 'hidden lg:block' : 'block'}`}>
              
              {/* Box 1: บัญชีผู้ใช้ / เครดิต / ยอดเดิมพัน */}
              <div className="border-2 border-cyan-400/70 rounded-2xl bg-[#081533]/90 p-3.5 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-cyan-500/20">
                  <span className="material-symbols-outlined text-cyan-300 text-base">account_circle</span>
                  <span className="text-xs font-bold text-slate-300">บัญชีผู้ใช้ :</span>
                  <span className="bg-red-600 text-white text-[11px] font-black px-2 py-0.5 rounded-md shadow-sm">
                    {userData?.username || currentUserId?.slice(0, 8) || '101010'}
                  </span>
                </div>
                
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-amber-400">account_balance_wallet</span>
                      เครดิต :
                    </span>
                    <span className="font-black text-amber-400 text-sm tabular-nums">
                      ฿{userData ? (userData.balance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-cyan-400">payments</span>
                      ยอดเดิมพัน :
                    </span>
                    <span className="font-black text-cyan-300 text-sm tabular-nums">
                      ฿{totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Box 2: Quick Action Buttons */}
              <div className="border-2 border-cyan-400/70 rounded-2xl bg-[#081533]/90 p-3 space-y-2 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <Link
                  to="/deposit"
                  className="w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white shadow-md shadow-red-600/30 border border-red-400 transition active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  เติมเงิน
                </Link>

                <Link
                  to="/profile"
                  className="w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-[#0c2452] hover:bg-[#11316b] text-cyan-200 border border-cyan-500/40 shadow transition active:scale-95"
                >
                  <span className="material-symbols-outlined text-base text-cyan-300">account_balance</span>
                  เพิ่มบัญชี / ถอนเงิน
                </Link>

                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-[#0c2452] hover:bg-[#11316b] text-cyan-200 border border-cyan-500/40 shadow transition active:scale-95"
                >
                  <span className="material-symbols-outlined text-base text-cyan-300">menu_book</span>
                  คู่มือการเล่น
                </button>

                <button
                  type="button"
                  onClick={() => setShowRulesModal(true)}
                  className="w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-[#0c2452] hover:bg-[#11316b] text-cyan-200 border border-cyan-500/40 shadow transition active:scale-95"
                >
                  <span className="material-symbols-outlined text-base text-cyan-300">gavel</span>
                  กฎกติกาเล่น
                </button>
              </div>

              {/* Box 3: เงินรางวัลหวยชุด (Payout Table) */}
              <div className="border-2 border-cyan-400/70 rounded-2xl bg-[#081533]/90 overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <div className="bg-[#05112a] px-3 py-2 border-b border-cyan-500/30 flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-amber-400">emoji_events</span>
                    เงินรางวัล{lotterySetType}
                  </span>
                  <span className="text-[10px] text-cyan-300 font-bold">ชุดละ 120/60/30฿</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-center text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-[#06193d] text-cyan-200 font-bold border-b border-cyan-500/30">
                        <th className="py-1.5 px-2 text-left">ชนิดรางวัล</th>
                        <th className="py-1.5 px-1.5 text-amber-300">ชุดใหญ่</th>
                        <th className="py-1.5 px-1.5 text-cyan-300">ชุดกลาง</th>
                        <th className="py-1.5 px-1.5 text-purple-300">ชุดเล็ก</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/15">
                      {SET_PAYOUT_TABLE.map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-[#081533]' : 'bg-[#061129]'}>
                          <td className="py-1.5 px-2 text-left font-bold text-white text-[11px]">
                            {row.rank}
                          </td>
                          <td className="py-1.5 px-1.5 font-black text-amber-400 tabular-nums">
                            {row.yai}
                          </td>
                          <td className="py-1.5 px-1.5 font-bold text-cyan-300 tabular-nums">
                            {row.klang}
                          </td>
                          <td className="py-1.5 px-1.5 font-bold text-purple-300 tabular-nums">
                            {row.lek}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-2 bg-[#051026] text-[10px] text-slate-400 border-t border-cyan-500/20 text-center">
                  * ถูกหลายรางวัลพร้อมกัน รับเงินซ้อนตามจริง
                </div>
              </div>

            </div>

            {/* ========================================================
                COLUMN 2 (CENTER): MAIN BETTING TABLE (15 ROWS)
               ======================================================== */}
            <div className={`lg:col-span-6 space-y-3 ${mobileTab !== 'betting' ? 'hidden lg:block' : 'block'}`}>
              
              {/* Top CTA Button & Quick Tools */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-2 border-cyan-400/70 rounded-2xl bg-[#081533]/90 p-2.5 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                {/* Top แทงหวย CTA */}
                <button
                  type="button"
                  onClick={handleConfirmPurchase}
                  disabled={preparedBets.length === 0 || isSubmitting}
                  className={`w-full sm:w-auto px-6 py-2 rounded-xl font-black text-sm flex items-center justify-center gap-2 border transition shadow-lg ${
                    preparedBets.length > 0 && !isSubmitting
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white border-emerald-400 hover:from-emerald-500 hover:to-teal-500 active:scale-95 shadow-emerald-600/30'
                      : 'bg-[#051026] text-slate-500 border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  แทงหวย
                  {preparedBets.length > 0 && (
                    <span className="text-xs bg-black/40 px-2 py-0.5 rounded-lg border border-white/20">
                      ฿{totalCost.toLocaleString()}
                    </span>
                  )}
                </button>

                {/* Quick helpers: Random & Clear */}
                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleRandomize(false)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border border-cyan-400/40 bg-[#091838] hover:bg-[#0f2754] text-cyan-300 transition active:scale-95"
                    title="สุ่มเลข 4 หลักทั้ง 15 แถว"
                  >
                    <span className="material-symbols-outlined text-xs">casino</span>
                    สุ่ม 4 ตัว
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRandomize(true)}
                    className="px-2 py-1.5 rounded-lg text-xs font-bold border border-cyan-400/30 bg-[#091838] hover:bg-[#0f2754] text-slate-300 transition active:scale-95"
                    title="สุ่มเฉพาะแถวที่ยังไม่ได้กรอก"
                  >
                    สุ่มว่าง
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border border-red-500/40 bg-red-950/40 hover:bg-red-900/50 text-red-300 transition active:scale-95"
                    title="ล้างข้อมูลทุกแถว"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                    ล้างหมด
                  </button>
                </div>
              </div>

              {/* Multi-Row Betting Table (15 Rows) */}
              <div className="border-2 border-cyan-400 rounded-2xl overflow-hidden bg-[#081533]/95 shadow-[0_0_25px_rgba(6,182,212,0.3)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse">
                    {/* Table Headers */}
                    <thead>
                      <tr className="bg-[#05112a] border-b-2 border-cyan-400 text-xs sm:text-sm font-black text-white">
                        <th className="py-2.5 px-2 w-20 text-center text-slate-300 font-bold">
                          ยกเลิก
                        </th>
                        <th className="py-2.5 px-3 text-center text-cyan-300">
                          <span className="flex items-center justify-center gap-1">
                            <span className="material-symbols-outlined text-sm">edit</span>
                            เลขหวย 4 หลัก
                          </span>
                        </th>
                        <th 
                          onClick={() => handleToggleColumnAll('yai')}
                          className="py-2.5 px-2 w-20 sm:w-24 text-center cursor-pointer hover:bg-white/5 transition select-none"
                          title="คลิกเพื่อเลือก/ยกเลิก ชุดใหญ่ 120฿ ทั้งหมด"
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-amber-400 font-black text-xs sm:text-sm">ชุดใหญ่</span>
                            <span className="text-[10px] text-amber-300/80 font-bold">120฿</span>
                          </div>
                        </th>
                        <th 
                          onClick={() => handleToggleColumnAll('klang')}
                          className="py-2.5 px-2 w-20 sm:w-24 text-center cursor-pointer hover:bg-white/5 transition select-none"
                          title="คลิกเพื่อเลือก/ยกเลิก ชุดกลาง 60฿ ทั้งหมด"
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-cyan-300 font-black text-xs sm:text-sm">ชุดกลาง</span>
                            <span className="text-[10px] text-cyan-300/80 font-bold">60฿</span>
                          </div>
                        </th>
                        <th 
                          onClick={() => handleToggleColumnAll('lek')}
                          className="py-2.5 px-2 w-20 sm:w-24 text-center cursor-pointer hover:bg-white/5 transition select-none"
                          title="คลิกเพื่อเลือก/ยกเลิก ชุดเล็ก 30฿ ทั้งหมด"
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-purple-300 font-black text-xs sm:text-sm">ชุดเล็ก</span>
                            <span className="text-[10px] text-purple-300/80 font-bold">30฿</span>
                          </div>
                        </th>
                      </tr>
                    </thead>

                    {/* Table Rows (15+ Rows) */}
                    <tbody className="divide-y divide-cyan-500/20 text-xs sm:text-sm">
                      {rows.map((row, index) => {
                        const isFilled = row.number.length === 4;
                        const isSelected = row.yai || row.klang || row.lek;
                        const isRowActive = isFilled && isSelected;
                        const isBlocked = isFilled && isNumberBlocked(row.number);

                        return (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              isBlocked 
                                ? 'bg-red-950/40 border-l-4 border-l-red-500'
                                : isRowActive 
                                  ? 'bg-[#0a234f]/60 border-l-4 border-l-cyan-400' 
                                  : index % 2 === 0 ? 'bg-[#081533]' : 'bg-[#061129]'
                            }`}
                          >
                            {/* Column 1: Cancel Button ("✖ แถว 1") */}
                            <td className="py-2 px-1.5 sm:px-2 text-center">
                              <button
                                type="button"
                                onClick={() => clearRow(index)}
                                className="text-[10px] sm:text-[11px] font-bold text-red-400 hover:text-red-300 px-1.5 py-1 rounded hover:bg-red-950/40 transition active:scale-95"
                                title={`ล้างแถวที่ ${row.id}`}
                              >
                                ✖ แถว {row.id}
                              </button>
                            </td>

                            {/* Column 2: 4-digit input */}
                            <td className="py-2 px-2 sm:px-3 text-center">
                              <div className="relative inline-block w-full max-w-[150px] sm:max-w-[180px]">
                                <input
                                  ref={el => { inputRefs.current[index] = el; }}
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={4}
                                  value={row.number}
                                  onChange={(e) => handleNumberChange(index, e.target.value)}
                                  placeholder="----"
                                  className={`w-full py-1.5 px-2 text-center font-mono font-black text-base sm:text-lg tracking-[0.3em] rounded-xl outline-none transition border ${
                                    isBlocked
                                      ? 'bg-red-950/60 border-red-500 text-red-300 ring-2 ring-red-500/40'
                                      : row.number.length === 4
                                        ? 'bg-[#091c3d] border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,197,24,0.3)]'
                                        : 'bg-[#050f24] border-cyan-500/40 text-white placeholder-slate-600 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                                  }`}
                                />
                                {isBlocked && (
                                  <span className="absolute -top-2 right-1 text-[9px] bg-red-600 text-white px-1 rounded font-black">
                                    เลขอั้น
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Column 3: ชุดใหญ่ 120฿ */}
                            <td className="py-2 px-1.5 sm:px-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleRowTier(index, 'yai')}
                                className={`w-14 sm:w-16 py-1.5 rounded-xl font-black text-xs transition-all border ${
                                  row.yai
                                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-2 border-amber-300 text-slate-950 shadow-[0_0_12px_rgba(245,197,24,0.5)] scale-105'
                                    : 'bg-[#050f24] border border-cyan-500/30 text-slate-400 hover:border-cyan-400'
                                }`}
                              >
                                {row.yai ? '✓ 120฿' : '120฿'}
                              </button>
                            </td>

                            {/* Column 4: ชุดกลาง 60฿ */}
                            <td className="py-2 px-1.5 sm:px-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleRowTier(index, 'klang')}
                                className={`w-14 sm:w-16 py-1.5 rounded-xl font-black text-xs transition-all border ${
                                  row.klang
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 border-2 border-cyan-300 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)] scale-105'
                                    : 'bg-[#050f24] border border-cyan-500/30 text-slate-400 hover:border-cyan-400'
                                }`}
                              >
                                {row.klang ? '✓ 60฿' : '60฿'}
                              </button>
                            </td>

                            {/* Column 5: ชุดเล็ก 30฿ */}
                            <td className="py-2 px-1.5 sm:px-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleRowTier(index, 'lek')}
                                className={`w-14 sm:w-16 py-1.5 rounded-xl font-black text-xs transition-all border ${
                                  row.lek
                                    ? 'bg-gradient-to-r from-purple-500 to-pink-600 border-2 border-purple-300 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)] scale-105'
                                    : 'bg-[#050f24] border border-cyan-500/30 text-slate-400 hover:border-cyan-400'
                                }`}
                              >
                                {row.lek ? '✓ 30฿' : '30฿'}
                              </button>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add more rows trigger */}
                <div className="bg-[#050f24] p-2.5 border-t border-cyan-500/30 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleAddRows}
                    className="text-xs font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1 bg-[#091838] px-3 py-1 rounded-lg border border-cyan-500/40 transition active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    เพิ่มอีก 5 แถว (ปัจจุบัน {rows.length} แถว)
                  </button>

                  <div className="text-[11px] text-slate-400">
                    กรอกครบ 4 ตัว ระบบจะเลือก <span className="text-amber-400 font-bold">ชุดใหญ่ 120฿</span> ให้อัตโนมัติ
                  </div>
                </div>

              </div>

              {/* Bottom Customer Name Note & Big แทงหวย CTA */}
              <div className="border-2 border-cyan-400/70 rounded-2xl bg-[#081533]/90 p-3 shadow-[0_0_15px_rgba(6,182,212,0.2)] space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="material-symbols-outlined text-base text-amber-400">badge</span>
                    <span className="text-xs font-bold text-slate-300">ชื่อผู้ซื้อ / โน้ตบิล:</span>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="เช่น คุณต้อม, ลูกค้าหน้าร้าน..."
                      className="flex-1 sm:w-60 text-xs font-bold border border-cyan-500/40 bg-[#050f24] rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="text-right text-xs">
                    <span className="text-slate-400">เลือกแล้ว: </span>
                    <span className="font-black text-cyan-300">{preparedBets.length} รายการ</span>
                    <span className="text-slate-400 ml-2">รวมเป็นเงิน: </span>
                    <span className="font-black text-amber-400 text-sm">฿{totalCost.toLocaleString()}</span>
                  </div>
                </div>

                {/* Big แทงหวย Confirmation Button matching screenshot */}
                <button
                  type="button"
                  onClick={handleConfirmPurchase}
                  disabled={preparedBets.length === 0 || isSubmitting}
                  className={`w-full py-3.5 px-6 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-2 border-2 transition shadow-xl ${
                    preparedBets.length > 0 && !isSubmitting
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white border-emerald-400 hover:from-emerald-500 hover:to-teal-500 active:scale-95 shadow-emerald-600/40 cursor-pointer'
                      : 'bg-[#050f24] text-slate-500 border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">check_circle</span>
                  <span>แทงหวย</span>
                  {preparedBets.length > 0 && (
                    <span className="text-xs sm:text-sm font-bold bg-black/40 px-3 py-1 rounded-xl border border-white/20">
                      ({preparedBets.length} รายการ • ฿{totalCost.toLocaleString()} บาท)
                    </span>
                  )}
                </button>
              </div>

            </div>

            {/* ========================================================
                COLUMN 3 (RIGHT): BET HISTORY & BLOCKED NUMBERS TRIGGER
               ======================================================== */}
            <div className={`lg:col-span-3 space-y-3 sm:space-y-4 ${mobileTab !== 'history' ? 'hidden lg:block' : 'block'}`}>
              
              {/* Box 1: ประวัติการเล่น (Red Gradient Header) */}
              <div className="border-2 border-cyan-400/70 rounded-2xl bg-[#081533]/90 overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                {/* Header in Red Gradient */}
                <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white px-3 py-2.5 flex items-center justify-between border-b border-red-500">
                  <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm">
                    <span className="material-symbols-outlined text-base">history</span>
                    ประวัติการเล่น
                  </div>
                  <span className="text-[10px] text-white/80 font-bold">
                    {recentBetsList.length} รายการ
                  </span>
                </div>

                {/* Table: หมายเลข | ประเภท | จำนวนเงิน | คืนโพย */}
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-center text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-[#05112a] text-slate-300 font-bold border-b border-cyan-500/20">
                        <th className="py-2 px-1.5 text-center">หมายเลข</th>
                        <th className="py-2 px-1 text-center">ประเภท</th>
                        <th className="py-2 px-1.5 text-center">จำนวนเงิน</th>
                        <th className="py-2 px-1.5 text-center">คืนโพย</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/15">
                      {recentBetsList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-400 text-xs">
                            <span className="material-symbols-outlined text-3xl text-slate-500 block mb-1">receipt_long</span>
                            ยังไม่มีประวัติการเล่นรอบนี้
                          </td>
                        </tr>
                      ) : (
                        recentBetsList.map((item, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-[#081533]' : 'bg-[#061129]'}>
                            <td className="py-2 px-1.5 font-mono font-black text-amber-300 text-xs">
                              {item.number}
                            </td>
                            <td className="py-2 px-1 text-[10px] font-bold">
                              <span className={`px-1.5 py-0.5 rounded ${
                                item.category === 'ชุดใหญ่' ? 'text-amber-400 bg-amber-950/40' :
                                item.category === 'ชุดกลาง' ? 'text-cyan-400 bg-cyan-950/40' :
                                'text-purple-400 bg-purple-950/40'
                              }`}>
                                {item.category}
                              </span>
                            </td>
                            <td className="py-2 px-1.5 font-black text-white text-[11px] tabular-nums">
                              ฿{item.price}
                            </td>
                            <td className="py-2 px-1.5 text-center">
                              {item.status === 'cancelled' ? (
                                <span className="text-[10px] text-red-400 font-bold">ยกเลิกแล้ว</span>
                              ) : item.canCancel ? (
                                <button
                                  type="button"
                                  onClick={() => cancelTicket(item.ticketId, item.totalAmount)}
                                  className="text-[10px] font-bold text-red-400 hover:text-red-300 border border-red-500/40 bg-red-950/40 px-1.5 py-0.5 rounded transition active:scale-95"
                                  title="คืนโพยภายใน 5 นาที"
                                >
                                  คืนโพย
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-400 font-bold">✓ รอผล</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-2 bg-[#051026] text-[10px] text-slate-400 border-t border-cyan-500/20 text-center">
                  คืนโพยได้ภายใน 5 นาทีหลังจากกดยืนยัน
                </div>
              </div>

              {/* Box 2: 🚫 เลขปิด (คลิกเพื่อดูตัวเลข) */}
              <button
                type="button"
                onClick={() => setShowBlockedModal(true)}
                className="w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 border-2 border-cyan-400 bg-[#081533] hover:bg-[#0c2452] text-rose-300 shadow-[0_0_20px_rgba(6,182,212,0.25)] transition active:scale-95"
              >
                <span className="material-symbols-outlined text-base text-rose-400">block</span>
                <span>🚫 เลขปิด (คลิกเพื่อดูตัวเลข)</span>
              </button>

            </div>

          </div>

        </div>
      </div>

      {/* Floating Tutorial Video Button (Bottom Left as in reference screenshot) */}
      <button
        type="button"
        onClick={() => setShowVideoModal(true)}
        className="fixed bottom-20 left-4 z-30 flex flex-col items-center gap-0.5 p-2 rounded-2xl border-2 border-red-500 bg-[#081533]/95 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:scale-105 active:scale-95 transition"
        title="ดูวิดีโอสอนแทงหวยชุด"
      >
        <span className="material-symbols-outlined text-2xl text-red-500">smart_display</span>
        <span className="text-[10px] font-black text-white bg-red-600 px-1.5 py-0.2 rounded-md">
          วิดีโอสอน
        </span>
      </button>

      {/* Sticky Bottom Bar for Mobile Confirmation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#050b24]/95 backdrop-blur-md border-t border-cyan-500/40 p-3 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] text-slate-400 font-bold">
              รอแทง {preparedBets.length} รายการ
            </div>
            <div className="text-lg font-black text-amber-400 tabular-nums">
              ฿{totalCost.toLocaleString()}
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirmPurchase}
            disabled={preparedBets.length === 0 || isSubmitting}
            className={`py-2.5 px-6 rounded-xl font-black text-sm flex items-center gap-1.5 border transition shadow-lg ${
              preparedBets.length > 0 && !isSubmitting
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400 active:scale-95'
                : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
            }`}
          >
            <span className="material-symbols-outlined text-base">check_circle</span>
            แทงหวย
          </button>
        </div>
      </div>

      {/* ========================================================
          MODALS & OVERLAYS
         ======================================================== */}

      {/* 1. Lottery Type Selector Modal */}
      {showLotterySelector && (
        <div className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#081533] border-2 border-cyan-400 rounded-3xl max-w-md w-full p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
              <h3 className="font-black text-sm text-cyan-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">format_list_bulleted</span>
                เลือกประเภทหวยชุด
              </h3>
              <button 
                onClick={() => setShowLotterySelector(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto p-1">
              {SET_LOTTERY_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setLotterySetType(opt.name);
                    navigate(`/lottery/set/${opt.slug}`, { replace: true });
                    setShowLotterySelector(false);
                  }}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${
                    opt.name === lotterySetType
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 border-red-400 text-white font-black shadow-md'
                      : 'bg-[#050f24] border-cyan-500/30 text-slate-300 hover:border-cyan-400'
                  }`}
                >
                  <img 
                    src={opt.flag} 
                    alt={opt.name} 
                    className="w-5 h-3.5 rounded object-cover shadow border border-white/20"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-left min-w-0">
                    <div className="text-xs font-bold truncate">{opt.name}</div>
                    <div className="text-[9px] text-slate-400">ปิด {opt.closeTime}</div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* 2. Rules Modal (กฎกติกาการเล่น) */}
      {showRulesModal && (
        <div className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#081533] border-2 border-cyan-400 rounded-3xl max-w-lg w-full p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3">
              <h3 className="font-black text-base text-amber-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">gavel</span>
                กฎกติกาการเล่นหวยชุด 4 ตัว
              </h3>
              <button onClick={() => setShowRulesModal(false)} className="text-slate-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-200 leading-relaxed">
              <div className="bg-[#050f24] p-3 rounded-xl border border-cyan-500/30">
                <h4 className="font-black text-cyan-300 mb-1">1. การซื้อหวยชุด</h4>
                <p>หวยชุดเป็นหวย 4 หลัก ผู้เล่นสามารถเลือกซื้อตามขนาดชุดได้ 3 ขนาด คือ ชุดใหญ่ 120 บาท, ชุดกลาง 60 บาท, และชุดเล็ก 30 บาท โดย 1 เลขสามารถเลือกเล่นได้ทั้ง 3 ขนาด</p>
              </div>

              <div className="bg-[#050f24] p-3 rounded-xl border border-cyan-500/30">
                <h4 className="font-black text-cyan-300 mb-1">2. สิทธิพิเศษการถูกรางวัลซ้อน</h4>
                <p>หากชุดหวยที่ท่านซื้อถูกรางวัลมากกว่า 1 รางวัลในชุดเดียวกัน ระบบจะจ่ายเงินรางวัลซ้อนตามจริงทุกรางวัล เช่น หากถูก 4 ตัวตรง จะได้รับทั้งรางวัล 4 ตัวตรง, 3 ตัวตรง, 4 ตัวโต๊ด, และ 2 ตัวท้าย</p>
              </div>

              <div className="bg-[#050f24] p-3 rounded-xl border border-cyan-500/30">
                <h4 className="font-black text-cyan-300 mb-1">3. การคืนโพย (ยกเลิกโพย)</h4>
                <p>ผู้เล่นสามารถกดยกเลิกโพยเพื่อรับเครดิตคืนเต็มจำนวนได้ภายในระยะเวลา 5 นาทีหลังการกดยืนยันส่งโพย หากพ้น 5 นาทีแล้ว โพยจะเข้าสู่สถานะรอออกผลรางวัล</p>
              </div>
            </div>

            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl text-xs"
            >
              เข้าใจแล้ว ปิดหน้าต่าง
            </button>
          </motion.div>
        </div>
      )}

      {/* 3. User Guide Modal (คู่มือการเล่น) */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#081533] border-2 border-cyan-400 rounded-3xl max-w-lg w-full p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3">
              <h3 className="font-black text-base text-cyan-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">menu_book</span>
                วิธีแทงหวยชุดทีละขั้นตอน
              </h3>
              <button onClick={() => setShowGuideModal(false)} className="text-slate-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-200">
              <div className="flex gap-3 items-start bg-[#050f24] p-3 rounded-xl border border-cyan-500/30">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-black flex items-center justify-center shrink-0">1</span>
                <div>
                  <h4 className="font-bold text-white mb-0.5">กรอกตัวเลข 4 หลัก</h4>
                  <p className="text-slate-300">พิมพ์ตัวเลขที่ต้องการในช่อง "เลขหวย 4 หลัก" หรือกดปุ่ม "สุ่ม 4 ตัว" เพื่อให้ระบบช่วยคิดเลข</p>
                </div>
              </div>

              <div className="flex gap-3 items-start bg-[#050f24] p-3 rounded-xl border border-cyan-500/30">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-black flex items-center justify-center shrink-0">2</span>
                <div>
                  <h4 className="font-bold text-white mb-0.5">เลือกขนาดชุด (120฿ / 60฿ / 30฿)</h4>
                  <p className="text-slate-300">แตะปุ่มเพื่อเลือกชุดใหญ่ 120฿, ชุดกลาง 60฿ หรือ ชุดเล็ก 30฿ (เลือกได้หลายชุดพร้อมกัน)</p>
                </div>
              </div>

              <div className="flex gap-3 items-start bg-[#050f24] p-3 rounded-xl border border-cyan-500/30">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-black flex items-center justify-center shrink-0">3</span>
                <div>
                  <h4 className="font-bold text-white mb-0.5">กด "แทงหวย" เพื่อยืนยัน</h4>
                  <p className="text-slate-300">ตรวจสอบยอดเงินรวม แล้วกดปุ่ม "แทงหวย" ระบบจะตัดเครดิตและออกบิลโพยให้ทันที</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl text-xs"
            >
              ปิดหน้าต่าง
            </button>
          </motion.div>
        </div>
      )}

      {/* 4. Closed Numbers Modal (เลขปิด / เลขอั้น) */}
      {showBlockedModal && (
        <div className="fixed inset-0 bg-black/80 z-50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#081533] border-2 border-rose-500 rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-rose-500/40 pb-3">
              <h3 className="font-black text-base text-rose-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">block</span>
                รายการเลขปิด / เลขอั้น ({lotterySetType})
              </h3>
              <button onClick={() => setShowBlockedModal(false)} className="text-slate-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            {blockedNumbers.length === 0 ? (
              <div className="bg-[#050f24] p-6 rounded-2xl text-center text-slate-300 space-y-2 border border-cyan-500/20">
                <span className="material-symbols-outlined text-4xl text-emerald-400">check_circle</span>
                <p className="font-bold text-sm text-emerald-300">ไม่มีเลขปิดในงวดนี้</p>
                <p className="text-xs text-slate-400">สมาชิกสามารถแทงได้ทุกหมายเลขตามปกติ</p>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1.5 p-1">
                {blockedNumbers.map((b, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-[#050f24] p-2.5 rounded-xl border border-rose-500/30 text-xs">
                    <span className="font-mono font-black text-amber-300 text-sm">{b.number}</span>
                    <span className="text-rose-400 font-bold">{b.reason || 'เต็มโควต้า'}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowBlockedModal(false)}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl text-xs"
            >
              ปิดหน้าต่าง
            </button>
          </motion.div>
        </div>
      )}

      {/* 5. Tutorial Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black/85 z-50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#081533] border-2 border-cyan-400 rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3">
              <h3 className="font-black text-base text-red-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">smart_display</span>
                วิดีโอแนะนำการแทงหวยชุด
              </h3>
              <button onClick={() => setShowVideoModal(false)} className="text-slate-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="aspect-video bg-black/80 rounded-2xl border border-cyan-500/40 flex flex-col items-center justify-center p-4 text-center">
              <span className="material-symbols-outlined text-5xl text-cyan-400 mb-2 animate-pulse">play_circle</span>
              <p className="font-bold text-xs text-white">วิธีแทงหวยชุดและลุ้นรางวัล 120,000 บาท</p>
              <p className="text-[10px] text-slate-400 mt-1">คลิกที่ช่องหมายเลข 4 หลัก แล้วกดเลือกชุด 120฿ / 60฿ / 30฿</p>
            </div>

            <button
              onClick={() => setShowVideoModal(false)}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-xl text-xs"
            >
              ปิด
            </button>
          </motion.div>
        </div>
      )}

      {/* 6. Purchase Success Receipt Modal */}
      {successReceipt && (
        <div className="fixed inset-0 bg-black/85 z-50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#081533] text-white border-2 border-cyan-400 rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-[#050f24] text-white p-5 text-center relative border-b border-cyan-500/30">
              <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-emerald-600/40">
                <span className="material-symbols-outlined text-3xl font-black">check</span>
              </div>
              <h3 className="text-lg font-black text-amber-400">ซื้อหวยชุดสำเร็จ!</h3>
              <p className="text-xs text-slate-300 mt-0.5">{successReceipt.lotteryType} • #{successReceipt.ticketId}</p>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              <div className="bg-[#050f24] p-3 rounded-xl border border-cyan-500/30 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">ลูกค้า:</span>
                  <span className="font-black text-white">{successReceipt.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">จำนวนรายการ:</span>
                  <span className="font-black text-white">{successReceipt.bets.length} รายการ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">เวลาที่ซื้อ:</span>
                  <span className="text-slate-300 font-medium">{successReceipt.dateFormatted}</span>
                </div>
              </div>

              {/* Tickets List */}
              <div className="max-h-40 overflow-y-auto space-y-1 p-1">
                {successReceipt.bets.map((bet: SetBetItem, idx: number) => (
                  <div key={idx} className="flex justify-between items-center bg-[#050f24] border border-cyan-500/20 px-3 py-1.5 rounded-lg text-xs">
                    <span className="font-mono font-black text-sm text-amber-300">
                      #{bet.rowId} เลข {bet.number}
                    </span>
                    <span className="text-slate-300 text-[11px] font-bold">
                      {bet.category} (฿{bet.price})
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Summary */}
              <div className="bg-[#050f24] p-3 rounded-xl border border-amber-400/40 flex justify-between items-center">
                <span className="font-black text-white text-sm">ยอดชำระสุทธิ</span>
                <span className="font-black text-xl text-amber-400">฿{successReceipt.totalAmount.toLocaleString()}</span>
              </div>

              {copiedNotification && (
                <div className="text-center text-xs font-bold text-emerald-400 bg-emerald-950/60 py-1.5 rounded-lg border border-emerald-500/40">
                  ✓ คัดลอกข้อความบิลเรียบร้อยแล้ว
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={copyReceiptBill}
                  className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
                >
                  <span className="material-symbols-outlined text-base">content_copy</span>
                  คัดลอกบิล
                </button>
                <button
                  onClick={() => setSuccessReceipt(null)}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  ตกลง (เลือกต่อ)
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
