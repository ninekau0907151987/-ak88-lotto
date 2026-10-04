import { useState, useEffect, useMemo, ClipboardEvent, KeyboardEvent, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { collection, onSnapshot, doc, getDoc, updateDoc, query, where, getDocs, setDoc, addDoc } from 'firebase/firestore';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { fmtMoney, fmtInt } from '@/shared/lib/betCount';

interface Row10Item {
  id: number;
  d1: string;
  d2: string;
  d3: string;
  d4: string;
  lek: boolean;   // เล็ก
  klang: boolean; // กลาง
  yai: boolean;   // ใหญ่
}

interface SetBetItem {
  id: string;
  number: string;
  category: 'เล็ก' | 'กลาง' | 'ใหญ่';
  price: number;
  type: string;
  rowId: number;
}

interface ActiveSetTicket {
  id: string;
  bets: SetBetItem[];
  totalAmount: number;
  createdAt: number;
  expiresAt: number;
  status?: string;
  customerName?: string;
  lotteryType?: string;
}

const SET_PAYOUTS = [
  { rank: '4 ตัวตรง', payout: '120,000 ฿', desc: 'เลขตรงกันทั้ง 4 หลักตรงตำแหน่ง' },
  { rank: '4 ตัวโต๊ด', payout: '5,500 ฿', desc: 'มีเลขครบทั้ง 4 หลัก สลับตำแหน่งได้' },
  { rank: '3 ตัวตรง', payout: '41,000 ฿', desc: 'เลข 3 ตัวท้าย ตรงตำแหน่ง' },
  { rank: '3 ตัวโต๊ด', payout: '4,100 ฿', desc: 'เลข 3 ตัวท้าย สลับตำแหน่งได้' },
  { rank: '2 ตัวบน', payout: '1,700 ฿', desc: 'เลข 2 ตัวท้าย ตรงตำแหน่ง' },
  { rank: '2 ตัวล่าง', payout: '1,700 ฿', desc: 'เลข 2 ตัวแรก ตรงตำแหน่ง' },
];

export default function LotterySetBet() {
  const navigate = useNavigate();
  const { type } = useParams();
  const { isPC, isMobile } = useBreakpoint();

  // Selected Lottery Type
  // ★ auto-detect ประเภทจากทางเข้า URL (/lottery/set/:type)
  const SET_TYPE_BY_SLUG: Record<string, { name: string; price: number }> = {
    hanoi:          { name: 'ชุดฮานอย',         price: 120 },
    'hanoi-special': { name: 'ฮานอยพิเศษชุด',    price: 120 },
    'hanoi-vip':     { name: 'ฮานอย VIP ชุด',     price: 120 },
    'hanoi-star':    { name: 'ฮานอยสตาร์ชุด',    price: 120 },
    lao:            { name: 'ชุดลาวพัฒนา',       price: 120 },
    'lao-star':     { name: 'หวยลาวสตาร์ชุด',    price: 120 },
    thai:           { name: 'ชุดรัฐบาลไทย',      price: 120 },
    gsb:            { name: 'ชุดออมสิน',         price: 120 },
    baac:           { name: 'ชุดธกส.',          price: 120 },
    government:     { name: 'ชุดรัฐบาลไทย',      price: 120 },
  };
  const initialSet = SET_TYPE_BY_SLUG[(type || '').toLowerCase()] || { name: 'ชุดฮานอย', price: 120 };

  const [lotterySetType, setLotterySetType] = useState(initialSet.name);
  const [setPrice, setSetPrice] = useState(initialSet.price); // ฿ ต่อชุด
  const [customerName, setCustomerName] = useState('');

  // 10 Rows Table State (Matching the User's Board Sketch)
  const [rows, setRows] = useState<Row10Item[]>(() => {
    return Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      d1: '',
      d2: '',
      d3: '',
      d4: '',
      lek: false,
      klang: false,
      yai: false,
    }));
  });

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'grid' | 'payouts' | 'history'>('grid');

  // Firebase & User Data
  const [userData, setUserData] = useState<any>(null);
  const [activeTickets, setActiveTickets] = useState<ActiveSetTicket[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [blockedNumbers, setBlockedNumbers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Sync route param
  useEffect(() => {
    if (type) {
      const found = SET_TYPE_BY_SLUG[type.toLowerCase()];
      if (found) {
        setLotterySetType(found.name);
        setSetPrice(found.price);
      } else {
        setLotterySetType(`ชุด${type}`);
      }
    }
  }, [type]);

  // Live Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Blocked Numbers Sync
  useEffect(() => {
    const unsubscribeBlocked = onSnapshot(collection(db, 'blocked_numbers'), (snapshot) => {
      const blocked = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((b: any) => b.lotteryType === lotterySetType);
      setBlockedNumbers(blocked);
    });
    return () => unsubscribeBlocked();
  }, [lotterySetType]);

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
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: data.ticketId || doc.id,
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
  }, []);

  // Handle digit input with auto-focus to next box
  const handleDigitChange = (rowIndex: number, digitField: 'd1' | 'd2' | 'd3' | 'd4', value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(-1); // Only 1 digit
    setRows(prev => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [digitField]: cleaned
      };
      // Auto toggle 'lek' if all 4 digits are completed and no option selected yet
      const r = updated[rowIndex];
      if (r.d1 && r.d2 && r.d3 && r.d4 && !r.lek && !r.klang && !r.yai) {
        r.lek = true;
      }
      return updated;
    });

    // Auto-focus next input box if a digit was entered
    if (cleaned) {
      if (digitField === 'd1') {
        const next = document.getElementById(`digit-${rowIndex}-d2`);
        next?.focus();
      } else if (digitField === 'd2') {
        const next = document.getElementById(`digit-${rowIndex}-d3`);
        next?.focus();
      } else if (digitField === 'd3') {
        const next = document.getElementById(`digit-${rowIndex}-d4`);
        next?.focus();
      } else if (digitField === 'd4' && rowIndex < 9) {
        const nextRowFirst = document.getElementById(`digit-${rowIndex + 1}-d1`);
        nextRowFirst?.focus();
      }
    }
  };

  // Handle paste 4 digits
  const handleDigitPaste = (rowIndex: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length > 0) {
      setRows(prev => {
        const updated = [...prev];
        updated[rowIndex] = {
          ...updated[rowIndex],
          d1: pasted[0] || '',
          d2: pasted[1] || '',
          d3: pasted[2] || '',
          d4: pasted[3] || '',
          lek: updated[rowIndex].lek || (!updated[rowIndex].klang && !updated[rowIndex].yai)
        };
        return updated;
      });
      // Focus the last filled box or next row
      const lastIndex = Math.min(pasted.length, 4);
      const targetId = lastIndex < 4 ? `digit-${rowIndex}-d${lastIndex + 1}` : `digit-${Math.min(rowIndex + 1, 9)}-d1`;
      document.getElementById(targetId)?.focus();
    }
  };

  // Handle backspace key navigation
  const handleDigitKeyDown = (rowIndex: number, digitField: 'd1' | 'd2' | 'd3' | 'd4', e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !rows[rowIndex][digitField]) {
      if (digitField === 'd4') document.getElementById(`digit-${rowIndex}-d3`)?.focus();
      else if (digitField === 'd3') document.getElementById(`digit-${rowIndex}-d2`)?.focus();
      else if (digitField === 'd2') document.getElementById(`digit-${rowIndex}-d1`)?.focus();
      else if (digitField === 'd1' && rowIndex > 0) document.getElementById(`digit-${rowIndex - 1}-d4`)?.focus();
    }
  };

  // Toggle Checkbox for เล็ก, กลาง, ใหญ่
  const toggleOption = (rowIndex: number, option: 'lek' | 'klang' | 'yai') => {
    setRows(prev => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [option]: !updated[rowIndex][option]
      };
      return updated;
    });
  };

  // Quick Action: Randomize All 10 Rows
  const handleRandomizeAllRows = () => {
    setRows(prev => prev.map((row, idx) => {
      const rand4 = Math.floor(1000 + Math.random() * 9000).toString();
      return {
        ...row,
        d1: rand4[0],
        d2: rand4[1],
        d3: rand4[2],
        d4: rand4[3],
        // Default select 'lek' if none selected
        lek: row.lek || (!row.klang && !row.yai ? true : row.lek),
      };
    }));
  };

  // Quick Action: Toggle column for all rows
  const handleToggleColumnAll = (column: 'lek' | 'klang' | 'yai') => {
    const allChecked = rows.every(r => r[column]);
    setRows(prev => prev.map(r => ({
      ...r,
      [column]: !allChecked
    })));
  };

  // Quick Action: Clear all 10 rows
  const handleClearAllRows = () => {
    setRows(Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      d1: '',
      d2: '',
      d3: '',
      d4: '',
      lek: false,
      klang: false,
      yai: false,
    })));
  };

  // Check if a number is blocked
  const isNumberBlocked = (num: string) => {
    return blockedNumbers.some(b => 
      b.number === num && (b.betType === 'ทุกประเภท' || b.betType === '4 ตัว' || b.betType === 'หวยชุด')
    );
  };

  // Calculate Active Valid Bets
  const preparedBets = useMemo(() => {
    const list: SetBetItem[] = [];
    rows.forEach(r => {
      const num = `${r.d1}${r.d2}${r.d3}${r.d4}`;
      if (num.length === 4) {
        if (r.lek) {
          list.push({
            id: `row-${r.id}-lek`,
            number: num,
            category: 'เล็ก',
            price: setPrice,
            type: lotterySetType,
            rowId: r.id
          });
        }
        if (r.klang) {
          list.push({
            id: `row-${r.id}-klang`,
            number: num,
            category: 'กลาง',
            price: setPrice,
            type: lotterySetType,
            rowId: r.id
          });
        }
        if (r.yai) {
          list.push({
            id: `row-${r.id}-yai`,
            number: num,
            category: 'ใหญ่',
            price: setPrice,
            type: lotterySetType,
            rowId: r.id
          });
        }
      }
    });
    return list;
  }, [rows, setPrice, lotterySetType]);

  const totalCost = preparedBets.length * setPrice;

  /* ==================================================================
   * ★ สรุปการนับสำหรับ "หวยชุด" ★
   * ------------------------------------------------------------------
   * ผู้ใช้ต้องการเห็นชัดว่า: เลขชุดที่กรอก มีกี่ชุด กี่ตัว ตามหมวด
   *
   * กติกาการนับของหวยชุด:
   *   - 1 แถวที่กรอกครบ 4 หลัก = 1 "เลขชุด"
   *   - 1 เลขชุด ที่ติ๊ก เล็ก / กลาง / ใหญ่ → นับเป็น 1 รายการต่อหมวดที่ติ๊ก
   *   - จำนวน "ชุด" (setCount) = จำนวนแถวที่กรอกครบ 4 หลัก
   *   - จำนวน "รายการ" (itemCount) = ชุด × จำนวนหมวดที่ติ๊ก
   *   - ★ เลขชุดซ้ำกันข้ามแถว → แจ้งเตือน แต่นับเป็นคนละชุด (คนละโพย)
   * ================================================================== */
  const setSummary = useMemo(() => {
    const filledRows = rows.filter(r => `${r.d1}${r.d2}${r.d3}${r.d4}`.length === 4);
    const setCount = filledRows.length;

    const byCategory = {
      'เล็ก':  filledRows.filter(r => r.lek).length,
      'กลาง':  filledRows.filter(r => r.klang).length,
      'ใหญ่':  filledRows.filter(r => r.yai).length,
    } as Record<string, number>;

    const itemCount = byCategory['เล็ก'] + byCategory['กลาง'] + byCategory['ใหญ่'];

    // หาเลขชุดที่ซ้ำกัน (กรอกซ้ำข้ามแถว)
    const numSeen = new Map<string, number[]>();
    filledRows.forEach(r => {
      const n = `${r.d1}${r.d2}${r.d3}${r.d4}`;
      if (!numSeen.has(n)) numSeen.set(n, []);
      numSeen.get(n)!.push(r.id);
    });
    const duplicateSets = Array.from(numSeen.entries())
      .filter(([, ids]) => ids.length > 1)
      .map(([number, ids]) => ({ number, rows: ids }));

    // แถวที่กรอกไม่ครบ — เตือนให้ผู้ใช้รู้
    const incompleteRows = rows
      .map((r, i) => ({ idx: i, filled: `${r.d1}${r.d2}${r.d3}${r.d4}`.length, r }))
      .filter(x => x.filled > 0 && x.filled < 4)
      .map(x => ({ rowNo: x.r.id, filled: x.filled }));

    // แถวที่กรอกครบแต่ยังไม่ติ๊กหมวด — ค้างเตือน
    const unselectedRows = filledRows.filter(r => !r.lek && !r.klang && !r.yai).map(r => r.id);

    const totalPayoutIfWin = itemCount * 120000;   // รางวัลสูงสุด 4 ตัวตรง

    return {
      setCount, itemCount, byCategory, duplicateSets, incompleteRows,
      unselectedRows, totalPayoutIfWin,
    };
  }, [rows]);

  // ★ จัดกลุ่ม preparedBets สำหรับแสดงตารางสรุปตอนยืนยัน
  const preparedByCategory = useMemo(() => {
    const map: Record<string, SetBetItem[]> = { 'เล็ก': [], 'กลาง': [], 'ใหญ่': [] };
    preparedBets.forEach(b => { (map[b.category] ||= []).push(b); });
    return map;
  }, [preparedBets]);

  // Confirm and Submit ("ยืนยัน" button)
  const handleConfirmPurchase = async () => {
    if (preparedBets.length === 0) {
      alert('กรุณากรอกเลข 4 ตัวให้ครบ และติ๊กเลือกอย่างน้อย 1 ช่อง (เล็ก, กลาง, หรือ ใหญ่)');
      return;
    }

    // Check for blocked numbers
    const blockedFound = preparedBets.filter(b => isNumberBlocked(b.number));
    if (blockedFound.length > 0) {
      alert(`มีเลขอั้นในรายการ: ${blockedFound.map(b => b.number).join(', ')}\nกรุณาเปลี่ยนเลขก่อนทำการยืนยัน`);
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
        customerName: customerName.trim() || 'ลูกค้าทั่วไป'
      };

      await addDoc(collection(db, 'tickets'), ticketDoc);

      // 3. Set Receipt Modal
      setSuccessReceipt({
        ...ticketDoc,
        newBalance: newBalance,
        dateFormatted: new Date().toLocaleString('th-TH')
      });

      // 4. Reset Rows
      handleClearAllRows();
    } catch (err) {
      console.error('Error submitting ticket:', err);
      alert('เกิดข้อผิดพลาดในการส่งโพย กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Ticket within 5-min window
  const cancelTicket = async (ticketId: string, amount: number) => {
    if (!window.confirm('คุณต้องการยกเลิกโพยหวยชุดนี้ และรับเงินคืนเข้ากระเป๋าเครดิตเต็มจำนวนหรือไม่?')) {
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
      `★ ใบเสร็จซื้อหวยชุด (${successReceipt.lotteryType})`,
      `รหัสโพย: #${successReceipt.ticketId}`,
      `ลูกค้า: ${successReceipt.customerName}`,
      `เวลา: ${successReceipt.dateFormatted}`,
      `-------------------------`,
      `รายการที่ซื้อ (${successReceipt.bets.length} รายการ):`,
      ...successReceipt.bets.map((b: SetBetItem, idx: number) => 
        ` ${idx + 1}. แถว #${b.rowId} เลข [ ${b.number} ] หมวด: ${b.category} (฿${b.price})`
      ),
      `-------------------------`,
      `ยอดชำระรวม: ฿${successReceipt.totalAmount.toLocaleString()} บาท`,
      `เครดิตคงเหลือ: ฿${successReceipt.newBalance.toLocaleString()} บาท`,
      `ลุ้นรางวัล 4 ตัวตรง 120,000 บาท!`,
      `=========================`
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const getSetTypeFlag = (typeStr: string) => {
    if (typeStr.includes('ฮานอย')) return 'https://flagcdn.com/w80/vn.png';
    if (typeStr.includes('ลาว')) return 'https://flagcdn.com/w80/la.png';
    return 'https://flagcdn.com/w80/th.png';
  };

  const formatRemainingTime = (expiresAt: number) => {
    const remaining = Math.max(0, Math.floor((expiresAt - currentTime) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060c2b] via-[#09123f] to-[#04081c] text-white pb-32 font-sans">
      {/* 1. Header Bar — ธีมหวยไทย น้ำเงินเข้มขลิบทอง */}
      <div className="bg-[#08103a]/95 backdrop-blur-md border-b border-[#f5c518]/25 p-3 md:p-4 sticky top-0 z-50 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/lottery?tab=set')} 
            className="p-2 rounded-xl transition flex items-center justify-center border border-[#f5c518]/30 bg-[#051121] hover:bg-[#0f2744] text-[#f5c518] active:scale-95 shadow-sm"
            id="back-btn"
            title="ย้อนกลับไปหน้าแทงหวย"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div>
            <h1 className="font-extrabold text-base md:text-lg flex items-center gap-2 text-white">
              <span className="material-symbols-outlined text-[#f5c518]">grid_view</span>
              แผงหวยชุด 10 แถว
            </h1>
            <p className="text-[10px] md:text-xs text-slate-300">
              {lotterySetType} • ชุดละ {setPrice} ฿ • ลุ้นรางวัลใหญ่ 120,000 ฿
            </p>
          </div>
        </div>

        {/* Live Wallet Balance */}
        <div className="rounded-xl px-3 py-1.5 flex items-center gap-2.5 border border-[#f5c518]/40 bg-[#051121] shadow-md">
          <span className="material-symbols-outlined text-base text-[#f5c518]">account_balance_wallet</span>
          <div className="text-right">
            <p className="text-[9px] font-bold leading-none text-slate-400">เครดิตคงเหลือ</p>
            <p className="text-sm md:text-base font-black tracking-tight tabular-nums text-[#f5c518]">
              ฿{userData ? (userData.balance || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Sub Navigation Tabs */}
      <div className={`${isPC ? 'max-w-[1500px]' : 'max-w-4xl'} mx-auto px-3 md:px-4 mt-3 grid grid-cols-3 gap-2`}>
        <button
          onClick={() => setActiveTab('grid')}
          className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
            activeTab === 'grid' 
              ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white font-black border-2 border-red-500 scale-[1.02] shadow-lg shadow-red-600/30' 
              : 'bg-[#0a192f] hover:bg-[#0f2744] text-slate-300 border border-[#f5c518]/25'
          }`}
          id="tab-grid"
        >
          <span className="material-symbols-outlined text-sm">grid_on</span>
          แผงกรอกเลข 10 แถว
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
            activeTab === 'payouts' 
              ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white font-black border-2 border-red-500 scale-[1.02] shadow-lg shadow-red-600/30' 
              : 'bg-[#0a192f] hover:bg-[#0f2744] text-slate-300 border border-[#f5c518]/25'
          }`}
          id="tab-payouts"
        >
          <span className="material-symbols-outlined text-sm">emoji_events</span>
          ตารางรางวัล
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
            activeTab === 'history' 
              ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white font-black border-2 border-red-500 scale-[1.02] shadow-lg shadow-red-600/30' 
              : 'bg-[#0a192f] hover:bg-[#0f2744] text-slate-300 border border-[#f5c518]/25'
          }`}
          id="tab-history"
        >
          <span className="material-symbols-outlined text-sm">receipt_long</span>
          ประวัติโพย
          {activeTickets.length > 0 && (
            <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black ml-1">
              {activeTickets.length}
            </span>
          )}
        </button>
      </div>

      <div className={`${isPC ? 'max-w-[1500px]' : 'max-w-4xl'} mx-auto px-3 md:px-4 mt-4`}>
        <AnimatePresence mode="wait">
          {/* TAB 1: 10-ROW BOARD (ตรงตามภาพวาดของผู้ใช้ 100%) */}
          {activeTab === 'grid' && (
            <motion.div 
              key="grid-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Country / Lottery Set Selector */}
              <div className="border border-[#f5c518]/25 rounded-2xl bg-[#08103a]/90 p-3 md:p-4 shadow-xl">
                <span className="text-xs font-bold mb-2 block flex items-center gap-1.5 text-[#f5c518]">
                  <span className="w-2 h-2 rounded-full bg-[#f5c518]"></span>
                  ประเภทหวยชุด <span className="font-normal text-slate-400">(ระบบเลือกให้อัตโนมัติ — คลิกเพื่อสลับหวยชุด)</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { name: 'ชุดฮานอย', id: 'hanoi' },
                    { name: 'ฮานอยพิเศษชุด', id: 'hanoi-special' },
                    { name: 'ฮานอย VIP ชุด', id: 'hanoi-vip' },
                    { name: 'ชุดลาวพัฒนา', id: 'lao' },
                    { name: 'หวยลาวสตาร์ชุด', id: 'lao-star' },
                    { name: 'ชุดรัฐบาลไทย', id: 'thai' },
                    { name: 'ชุดออมสิน', id: 'gsb' },
                    { name: 'ชุดธกส.', id: 'baac' },
                  ].map(item => {
                    const isSel = lotterySetType === item.name;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setLotterySetType(item.name);
                          navigate(`/lottery/set/${item.id}`, { replace: true });
                        }}
                        className={`p-2.5 rounded-xl flex items-center gap-2 justify-center transition-all border ${
                          isSel
                            ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-2 border-red-400 font-black shadow-md scale-[1.02]'
                            : 'bg-[#051121] hover:bg-[#0f2744] text-slate-300 border-slate-700'
                        }`}
                      >
                        <img 
                          src={getSetTypeFlag(item.name)} 
                          alt={item.name} 
                          className="w-5 h-3.5 rounded object-cover shadow-sm border border-slate-400/30"
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-xs font-bold truncate">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="border border-[#f5c518]/25 rounded-2xl bg-[#08103a]/90 flex flex-wrap items-center justify-between gap-2 p-3 shadow-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold flex items-center gap-1 text-[#f5c518]">
                    <span className="material-symbols-outlined text-sm text-[#f5c518]">magic_button</span>
                    เครื่องมือลัด:
                  </span>
                  <button
                    onClick={handleRandomizeAllRows}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 border border-cyan-400/40 bg-[#051121] hover:bg-[#0f2744] text-cyan-300"
                    id="btn-random-all"
                  >
                    <span className="material-symbols-outlined text-xs">casino</span>
                    สุ่มเลข 10 แถว
                  </button>
                  <button
                    onClick={handleClearAllRows}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 border border-red-500/50 bg-red-950/50 hover:bg-red-900/50 text-red-300"
                    id="btn-clear-all"
                  >
                    <span className="material-symbols-outlined text-xs">delete_sweep</span>
                    ล้างทั้งหมด
                  </button>
                </div>

                <div className="text-right flex items-center gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400">ราคาชุดละ </span>
                    <span className="text-xs font-black text-[#f5c518]">{setPrice} ฿</span>
                  </div>
                  {/* เลือกราคาต่อชุดได้ */}
                  <div className="flex items-center justify-end gap-1">
                    {[20, 50, 120, 300, 500].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSetPrice(p)}
                        className={`text-[10px] font-black px-2 py-0.5 rounded border transition-all ${
                          setPrice === p
                            ? 'bg-[#f5c518] text-[#0a192f] border-[#f5c518] font-black shadow-sm'
                            : 'bg-[#051121] text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                        title={`ตั้งราคาชุดละ ${p} บาท`}
                      >
                        {p}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      value={setPrice}
                      onChange={(e) => setSetPrice(Math.max(1, Number(e.target.value) || 1))}
                      className="w-14 text-[10px] font-black text-center rounded border border-[#f5c518]/40 bg-[#051121] text-[#f5c518] px-1 py-0.5 outline-none"
                      title="พิมพ์ราคาเองได้"
                    />
                  </div>
                </div>
              </div>

              {/* แผงนับจำนวน — สไตล์หวยไทย คมชัด สวยงาม */}
              <div className="border-2 border-cyan-400/50 rounded-2xl bg-[#08103a]/95 shadow-[0_0_20px_rgba(0,180,216,0.25)] overflow-hidden">
                {/* แถวหลัก: ชุด / ตัว / เงิน */}
                <div className="grid grid-cols-3 divide-x divide-cyan-500/20">
                  {/* จำนวนชุด */}
                  <div className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-sm text-[#f5c518]">confirmation_number</span>
                      <span className="text-[10px] font-bold text-slate-300">เลขชุด</span>
                    </div>
                    <div className="font-black text-2xl md:text-3xl tabular-nums leading-none text-white">
                      {fmtInt(setSummary.setCount)}
                    </div>
                    <div className="text-[9px] mt-1 text-slate-400">จาก 10 แถว</div>
                  </div>

                  {/* จำนวนตัวที่รอการแทง รวมทุกหมวด */}
                  <div className="py-3 px-2 text-center bg-[#051121]/80">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-sm text-cyan-300">format_list_numbered</span>
                      <span className="text-[10px] font-bold text-slate-300">รอการแทง</span>
                    </div>
                    <div className="font-black text-2xl md:text-3xl tabular-nums leading-none text-cyan-300">
                      {fmtInt(setSummary.itemCount)}
                    </div>
                    <div className="text-[9px] mt-1 text-slate-400">รวมทุกหมวด</div>
                  </div>

                  {/* ยอดเงิน */}
                  <div className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-sm text-[#f5c518]">payments</span>
                      <span className="text-[10px] font-bold text-slate-300">ราคารวม</span>
                    </div>
                    <div className="font-black text-xl md:text-2xl tabular-nums leading-none text-[#f5c518]">
                      ฿{fmtMoney(totalCost, 0)}
                    </div>
                    <div className="text-[9px] mt-1 text-slate-400">
                      ชุดละ {setPrice} ฿
                    </div>
                  </div>
                </div>

                {/* แถวแยกหมวด: เล็ก / กลาง / ใหญ่ */}
                <div className="grid grid-cols-3 divide-x divide-cyan-500/20 border-t border-cyan-500/20 bg-[#051121]/60">
                  {([
                    { key: 'เล็ก', color: 'text-emerald-400', bg: 'bg-emerald-500' },
                    { key: 'กลาง', color: 'text-blue-400', bg: 'bg-blue-500' },
                    { key: 'ใหญ่', color: 'text-rose-400', bg: 'bg-rose-500' },
                  ] as const).map(cat => {
                    const n = setSummary.byCategory[cat.key] || 0;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => handleToggleColumnAll(cat.key === 'เล็ก' ? 'lek' : cat.key === 'กลาง' ? 'klang' : 'yai')}
                        className="py-2.5 px-2 flex flex-col items-center gap-1 transition-colors hover:bg-white/[0.05]"
                        title={`คลิกเพื่อเลือก/ยกเลิก "${cat.key}" ทั้งหมด`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-sm ${cat.bg}`} />
                          <span className={`font-black text-xs ${cat.color}`}>{cat.key}</span>
                        </div>
                        <div className="font-black text-lg tabular-nums leading-none text-white">
                          {fmtInt(n)}
                          <span className="text-[10px] font-bold ml-1 text-slate-400">ตัว</span>
                        </div>
                        <div className="text-[9px] tabular-nums text-slate-400">
                          ฿{fmtInt(n * setPrice)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* เตือน: เลขชุดซ้ำ */}
                {setSummary.duplicateSets.length > 0 && (
                  <div className="flex items-start gap-1.5 px-3 py-2 bg-rose-950/60 border-t border-rose-500/40 text-rose-300">
                    <span className="material-symbols-outlined text-sm mt-[1px]">content_copy</span>
                    <div className="text-[10px] font-bold leading-relaxed">
                      พบเลขชุดซ้ำ {setSummary.duplicateSets.length} ชุด —
                      {setSummary.duplicateSets.slice(0, 3).map(d => (
                        <span key={d.number} className="ml-1 font-mono px-1.5 rounded bg-black/40 border border-rose-500 text-rose-200">
                          {d.number} (แถว {d.rows.join(', ')})
                        </span>
                      ))}
                      {setSummary.duplicateSets.length > 3 && <span className="ml-1">+{setSummary.duplicateSets.length - 3}</span>}
                      <div className="font-normal mt-0.5 opacity-80">แต่ละชุดนับแยกกัน — ตรวจสอบก่อนยืนยัน</div>
                    </div>
                  </div>
                )}

                {/* เตือน: แถวกรอกไม่ครบ 4 หลัก */}
                {setSummary.incompleteRows.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/60 border-t border-amber-500/40 text-amber-300">
                    <span className="material-symbols-outlined text-sm">error_outline</span>
                    <span className="text-[10px] font-bold">
                      กรอกไม่ครบ 4 หลัก {setSummary.incompleteRows.length} แถว: {setSummary.incompleteRows.map(x => `แถว ${x.rowNo} (${x.filled} หลัก)`).join(' · ')}
                    </span>
                  </div>
                )}

                {/* เตือน: กรอกครบแต่ยังไม่ติ๊กหมวด */}
                {setSummary.unselectedRows.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-950/60 border-t border-blue-500/40 text-cyan-300">
                    <span className="material-symbols-outlined text-sm">info</span>
                    <span className="text-[10px] font-bold">
                      กรอกครบแล้วแต่ยังไม่ติ๊กหมวด {setSummary.unselectedRows.length} แถว: {setSummary.unselectedRows.map(n => `แถว ${n}`).join(' · ')}
                    </span>
                  </div>
                )}
              </div>

              {/* THE 10-ROW BOARD TABLE (Exact Match to Hand-Drawn Sketch with Cyber Neon & Thai Gov Styling) */}
              <div className="border-2 border-cyan-400 rounded-2xl overflow-hidden bg-[#08103a]/95 shadow-[0_0_25px_rgba(0,180,216,0.38)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse">
                    {/* Header Columns */}
                    <thead>
                      <tr className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white text-xs sm:text-sm font-black border-b border-red-500">
                        <th className="py-3 px-2 w-9 text-center font-mono text-white/80">#</th>
                        <th className="py-3 px-3 text-center tracking-wide text-white">
                          กรอกเลข 4 หลัก (ช่องละ 1 ตัว)
                        </th>
                        <th className="py-3 px-2 w-[72px] sm:w-24 text-center cursor-pointer hover:bg-black/10 transition select-none"
                            onClick={() => handleToggleColumnAll('lek')}
                            title="แตะเพื่อเลือก เล็ก ทั้งหมด">
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-black text-sm sm:text-base text-emerald-300">เล็ก</span>
                            <span className="text-[9px] font-normal text-white/70">เลือกทั้งหมด</span>
                          </div>
                        </th>
                        <th className="py-3 px-2 w-[72px] sm:w-24 text-center cursor-pointer hover:bg-black/10 transition select-none"
                            onClick={() => handleToggleColumnAll('klang')}
                            title="แตะเพื่อเลือก กลาง ทั้งหมด">
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-black text-sm sm:text-base text-cyan-300">กลาง</span>
                            <span className="text-[9px] font-normal text-white/70">เลือกทั้งหมด</span>
                          </div>
                        </th>
                        <th className="py-3 px-2 w-[72px] sm:w-24 text-center cursor-pointer hover:bg-black/10 transition select-none"
                            onClick={() => handleToggleColumnAll('yai')}
                            title="แตะเพื่อเลือก ใหญ่ ทั้งหมด">
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-black text-sm sm:text-base text-rose-300">ใหญ่</span>
                            <span className="text-[9px] font-normal text-white/70">เลือกทั้งหมด</span>
                          </div>
                        </th>
                      </tr>
                    </thead>

                    {/* 10 Rows Body */}
                    <tbody className="divide-y divide-cyan-500/20">
                      {rows.map((row, index) => {
                        const isFilled = row.d1 && row.d2 && row.d3 && row.d4;
                        const hasSelection = row.lek || row.klang || row.yai;
                        const rowActive = isFilled && hasSelection;

                        return (
                          <tr 
                            key={row.id}
                            className={`transition-colors duration-150 ${
                              rowActive 
                                ? 'bg-cyan-950/40 border-l-4 border-l-cyan-400' 
                                : index % 2 === 0 ? 'bg-[#0a192f]' : 'bg-[#071328]'
                            }`}
                          >
                            {/* Row Index Number */}
                            <td className="py-2.5 px-2 text-[11px] font-mono font-bold select-none text-slate-400">
                              {String(row.id).padStart(2, '0')}
                            </td>

                            {/* กรอกเลข 4 ตัว: 4 distinct input boxes [d1][d2][d3][d4] */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                                {(['d1', 'd2', 'd3', 'd4'] as const).map((digitKey) => (
                                  <input
                                    key={digitKey}
                                    id={`digit-${index}-${digitKey}`}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={1}
                                    value={row[digitKey]}
                                    onChange={(e) => handleDigitChange(index, digitKey, e.target.value)}
                                    onPaste={(e) => handleDigitPaste(index, e)}
                                    onKeyDown={(e) => handleDigitKeyDown(index, digitKey, e)}
                                    className={`text-center font-mono font-black rounded-xl bg-[#051121] border border-slate-600 text-white outline-none transition focus:border-[#f5c518] focus:ring-2 focus:ring-[#f5c518]/30 ${
                                      row[digitKey] ? 'border-[#f5c518] text-[#f5c518] scale-[1.04]' : ''
                                    } ${
                                      isPC
                                        ? 'w-16 h-16 text-2xl'
                                        : 'w-10 h-12 sm:w-13 sm:h-14 text-xl sm:text-2xl'
                                    }`}
                                  />
                                ))}
                              </div>
                            </td>

                            {/* Checkbox "เล็ก" */}
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleOption(index, 'lek')}
                                className={`flex items-center justify-center mx-auto transition-all ${
                                  isPC ? 'w-16 h-16 rounded-2xl' : 'w-10 h-10 sm:w-12 sm:h-12 rounded-xl'
                                } ${
                                  row.lek
                                    ? 'bg-emerald-600 border-2 border-emerald-400 text-white shadow-md shadow-emerald-600/30 scale-105'
                                    : 'bg-[#051121] border border-slate-700 text-slate-500 hover:border-slate-500'
                                }`}
                                id={`check-${row.id}-lek`}
                              >
                                {row.lek ? (
                                  <span className="text-[10px] sm:text-xs font-black tabular-nums leading-none">
                                    ฿{setPrice}
                                  </span>
                                ) : (
                                  <span className="material-symbols-outlined text-lg sm:text-xl font-black opacity-40">
                                    add
                                  </span>
                                )}
                              </button>
                            </td>

                            {/* Checkbox "กลาง" */}
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleOption(index, 'klang')}
                                className={`flex items-center justify-center mx-auto transition-all ${
                                  isPC ? 'w-16 h-16 rounded-2xl' : 'w-10 h-10 sm:w-12 sm:h-12 rounded-xl'
                                } ${
                                  row.klang
                                    ? 'bg-blue-600 border-2 border-blue-400 text-white shadow-md shadow-blue-600/30 scale-105'
                                    : 'bg-[#051121] border border-slate-700 text-slate-500 hover:border-slate-500'
                                }`}
                                id={`check-${row.id}-klang`}
                              >
                                {row.klang ? (
                                  <span className="text-[10px] sm:text-xs font-black tabular-nums leading-none">
                                    ฿{setPrice}
                                  </span>
                                ) : (
                                  <span className="material-symbols-outlined text-lg sm:text-xl font-black opacity-40">
                                    add
                                  </span>
                                )}
                              </button>
                            </td>

                            {/* Checkbox "ใหญ่" */}
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleOption(index, 'yai')}
                                className={`flex items-center justify-center mx-auto transition-all ${
                                  isPC ? 'w-16 h-16 rounded-2xl' : 'w-10 h-10 sm:w-12 sm:h-12 rounded-xl'
                                } ${
                                  row.yai
                                    ? 'bg-purple-600 border-2 border-purple-400 text-white shadow-md shadow-purple-600/30 scale-105'
                                    : 'bg-[#051121] border border-slate-700 text-slate-500 hover:border-slate-500'
                                }`}
                                id={`check-${row.id}-yai`}
                              >
                                {row.yai ? (
                                  <span className="text-[10px] sm:text-xs font-black tabular-nums leading-none">
                                    ฿{setPrice}
                                  </span>
                                ) : (
                                  <span className="material-symbols-outlined text-lg sm:text-xl font-black opacity-40">
                                    add
                                  </span>
                                )}
                              </button>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Customer name note row */}
                <div className="p-3 bg-[#060c2b] border-t border-cyan-500/20 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 w-full sm:w-auto">
                    <span className="material-symbols-outlined text-sm text-[#f5c518]">badge</span>
                    <span>ชื่อผู้ซื้อ / โน้ตโพย:</span>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="ระบุชื่อเรียก เช่น คุณต้อม..."
                      className="flex-1 sm:w-48 text-xs font-bold border border-[#f5c518]/30 bg-[#051121] rounded-lg px-2.5 py-1 text-white outline-none focus:border-[#f5c518]"
                    />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    กรอกเลข 4 ตัวแล้วติ๊ก เล็ก • กลาง • ใหญ่ ตามต้องการ
                  </div>
                </div>
              </div>

              {/* Big "ยืนยัน" Button (Centered exactly like the hand-drawn whiteboard!) */}
              <div className="pt-2 pb-6 flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleConfirmPurchase}
                  disabled={preparedBets.length === 0 || isSubmitting}
                  className={`w-full sm:w-96 py-4 px-8 rounded-2xl font-black text-lg md:text-xl border-2 transition-all flex items-center justify-center gap-3 shadow-2xl ${
                    preparedBets.length > 0 && !isSubmitting
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400 shadow-emerald-600/30 active:scale-95 cursor-pointer'
                      : 'bg-[#051121]/80 text-gray-500 border-slate-800 cursor-not-allowed'
                  }`}
                  id="btn-confirm-board"
                >
                  <span className="material-symbols-outlined text-2xl font-black">check_circle</span>
                  <span>ยืนยันส่งโพยหวยชุด</span>
                  {preparedBets.length > 0 && (
                    <span className="text-sm font-bold bg-black/30 px-3 py-1 rounded-xl border border-white/10">
                      ({preparedBets.length} รายการ • ฿{totalCost.toLocaleString()})
                    </span>
                  )}
                </button>
              </div>

            </motion.div>
          )}

          {/* TAB 2: PAYOUTS */}
          {activeTab === 'payouts' && (
            <motion.div
              key="payouts-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-[#0a192f] rounded-2xl border border-[#f5c518]/25 p-5 shadow-xl space-y-4"
            >
              <div className="text-center max-w-lg mx-auto mb-4">
                <span className="bg-amber-500/10 text-[#f5c518] text-[10px] font-black px-3 py-1 rounded-full border border-[#f5c518]/30 uppercase tracking-widest">
                  Set Lottery Payout Table
                </span>
                <h2 className="text-xl font-extrabold text-white mt-2">ตารางอัตราจ่ายหวยชุด 4 ตัว</h2>
                <p className="text-xs text-slate-300 mt-1">ซื้อชุดละ 120 บาท ลุ้นรับรางวัลพร้อมกันถึง 6 ตำแหน่ง</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SET_PAYOUTS.map((item, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl border border-[#f5c518]/20 bg-[#051121]/80 flex items-center justify-between hover:border-[#f5c518]/50 transition shadow-md"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-500/15 text-[#f5c518] font-black text-xs flex items-center justify-center border border-amber-500/30">
                          {idx + 1}
                        </span>
                        <span className="font-extrabold text-sm text-white">{item.rank}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{item.desc}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-bold">อัตราจ่าย</span>
                      <span className="text-lg font-black text-[#f5c518]">{item.payout}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === 'history' && (
            <motion.div
              key="history-tab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-black text-sm text-white flex items-center gap-1.5 border-l-4 border-[#f5c518] pl-2">
                  <span className="material-symbols-outlined text-sm text-[#f5c518]">history_edu</span>
                  ประวัติการซื้อหวยชุดของคุณ
                </h3>
                <span className="text-[10px] text-slate-400">รวมทั้งหมด {activeTickets.length} โพย</span>
              </div>

              {activeTickets.length === 0 ? (
                <div className="bg-[#0a192f] border border-[#f5c518]/20 rounded-2xl p-12 text-center text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-2 text-slate-500">receipt_long</span>
                  <p className="font-bold text-xs">ไม่พบรายการส่งโพยหวยชุด</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">กรอกเลขในตาราง 10 แถวแล้วกดยืนยัน รายการจะปรากฏที่นี่</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeTickets.map(ticket => {
                    const isExpired = currentTime >= ticket.expiresAt;
                    const isCancelled = ticket.status === 'cancelled';
                    
                    return (
                      <div 
                        key={ticket.id}
                        className="bg-[#0a192f] rounded-2xl border border-[#f5c518]/25 shadow-lg relative overflow-hidden flex flex-col"
                      >
                        {isCancelled && (
                          <div className="absolute inset-0 bg-black/80 z-10 backdrop-blur-[1px] flex items-center justify-center">
                            <span className="border-2 border-red-500 text-red-400 rounded-xl px-4 py-1.5 font-black text-base uppercase tracking-widest rotate-6 select-none bg-red-950/60">
                              CANCELLED / ยกเลิกแล้ว
                            </span>
                          </div>
                        )}

                        <div className="bg-[#08152e] px-4 py-3 flex justify-between items-center border-b border-[#f5c518]/20">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#051121] text-[#f5c518] flex items-center justify-center border border-[#f5c518]/30">
                              <span className="material-symbols-outlined text-sm">receipt</span>
                            </div>
                            <div>
                              <div className="font-black text-xs text-white">โพยหวยชุด #{ticket.id}</div>
                              <div className="text-[9px] text-slate-400">
                                {new Date(ticket.createdAt).toLocaleDateString('th-TH')} • {new Date(ticket.createdAt).toLocaleTimeString('th-TH')}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[8px] text-slate-400 block uppercase font-bold">ยอดเงินสุทธิ</span>
                            <span className="text-sm font-black text-[#f5c518]">฿{ticket.totalAmount.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="px-4 pb-4 pt-3 space-y-3">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">ลูกค้า: <b className="text-white">{ticket.customerName || 'ทั่วไป'}</b></span>
                            <span className="bg-[#051121] border border-[#f5c518]/20 text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              {ticket.bets.length} รายการ
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {ticket.bets.map((bet, idx) => (
                              <div 
                                key={idx}
                                className="bg-[#051121] border border-[#f5c518]/20 rounded-lg px-2 py-1 text-xs flex items-center gap-1.5 font-mono"
                              >
                                <span className="font-black text-white">{bet.number}</span>
                                <span className={`text-[10px] font-bold ${
                                  bet.category === 'เล็ก' ? 'text-emerald-400' : bet.category === 'กลาง' ? 'text-blue-400' : 'text-rose-400'
                                }`}>({bet.category})</span>
                              </div>
                            ))}
                          </div>

                          {!isCancelled && (
                            <div className="pt-2 border-t border-[#f5c518]/20">
                              {!isExpired ? (
                                <button
                                  onClick={() => cancelTicket(ticket.id, ticket.totalAmount)}
                                  className="w-full py-2 bg-red-950/40 hover:bg-red-900/40 text-red-300 border border-red-500/40 rounded-xl text-xs font-black transition flex items-center justify-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-xs">cancel</span> 
                                  ยกเลิกโพย (เหลือเวลายกเลิก {formatRemainingTime(ticket.expiresAt)} นาที)
                                </button>
                              ) : (
                                <div className="w-full py-2 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-400 text-center">
                                  ✓ ยืนยันโพยสำเร็จ (รอออกผลรางวัล)
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky Bottom Summary Bar (For easy mobile checking) */}
      {activeTab === 'grid' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#08103a]/95 backdrop-blur-md border-t border-[#f5c518]/30 shadow-2xl px-4 py-3">
          <div className={`${isPC ? 'max-w-[1500px]' : 'max-w-4xl'} mx-auto flex items-center justify-between gap-3`}>
            {/* แสดงจำนวนตัวที่รอการแทง */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 bg-[#f5c518]/15 border border-[#f5c518]/40 rounded-xl px-2.5 py-1.5 shrink-0">
                <span className="material-symbols-outlined text-[#f5c518] text-base">format_list_numbered</span>
                <div className="leading-none">
                  <div className="text-[9px] text-slate-400 font-bold mb-0.5">รอการแทง</div>
                  <div className="text-[#f5c518] font-black text-lg tabular-nums leading-none">
                    {fmtInt(setSummary.itemCount)}
                    <span className="text-[10px] font-bold text-slate-400 ml-1">ตัว</span>
                  </div>
                </div>
              </div>

              <div className="hidden sm:block min-w-0">
                <div className="text-[11px] text-slate-300 truncate">
                  {fmtInt(setSummary.setCount)} ชุด ·
                  <span className="text-emerald-400 font-bold"> เล็ก {setSummary.byCategory['เล็ก']}</span> ·
                  <span className="text-blue-400 font-bold"> กลาง {setSummary.byCategory['กลาง']}</span> ·
                  <span className="text-rose-400 font-bold"> ใหญ่ {setSummary.byCategory['ใหญ่']}</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  เครดิต: <span className="text-[#f5c518] font-bold">฿{fmtMoney(userData?.balance || 0)}</span>
                  {userData && totalCost > (userData.balance || 0) && (
                    <span className="text-red-400 font-black ml-2">
                      ขาด ฿{fmtMoney(totalCost - (userData.balance || 0))}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block leading-none">ยอดรวม</span>
                <span className="text-xl sm:text-2xl font-black text-[#f5c518] tabular-nums">
                  ฿{fmtMoney(totalCost, 0)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleConfirmPurchase}
                disabled={preparedBets.length === 0 || isSubmitting}
                className={`py-2.5 px-6 rounded-xl font-black text-sm transition-all shadow-lg flex items-center gap-1.5 ${
                  preparedBets.length > 0 && !isSubmitting
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white active:scale-95 cursor-pointer shadow-emerald-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
                id="btn-sticky-confirm"
              >
                <span className="material-symbols-outlined text-base">check</span>
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Purchase Success Receipt Modal */}
      {successReceipt && (
        <div className="fixed inset-0 bg-black/85 z-50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#0a192f] text-white border border-[#f5c518]/30 rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-[#051121] text-white p-5 text-center relative border-b border-[#f5c518]/30">
              <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-emerald-600/30">
                <span className="material-symbols-outlined text-3xl font-black">check</span>
              </div>
              <h3 className="text-lg font-black text-[#f5c518]">ซื้อหวยชุดสำเร็จ!</h3>
              <p className="text-xs text-slate-300 mt-0.5">{successReceipt.lotteryType} • #{successReceipt.ticketId}</p>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3">
              <div className="bg-[#051121] p-3 rounded-xl border border-slate-700 text-xs space-y-1.5">
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
                  <div key={idx} className="flex justify-between items-center bg-[#051121] border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
                    <span className="font-mono font-black text-sm text-white">
                      #{bet.rowId} เลข {bet.number}
                    </span>
                    <span className="text-slate-300 text-[11px] font-bold">
                      หมวด: <span className={
                        bet.category === 'เล็ก' ? 'text-emerald-400' : bet.category === 'กลาง' ? 'text-blue-400' : 'text-rose-400'
                      }>{bet.category}</span> (฿{bet.price})
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Summary */}
              <div className="bg-[#051121] p-3 rounded-xl border border-[#f5c518]/30 flex justify-between items-center">
                <span className="font-black text-white text-sm">ยอดชำระสุทธิ</span>
                <span className="font-black text-xl text-[#f5c518]">฿{successReceipt.totalAmount.toLocaleString()}</span>
              </div>

              {copiedNotification && (
                <div className="text-center text-xs font-bold text-emerald-400 bg-emerald-950/60 py-1.5 rounded-lg border border-emerald-500/40">
                  ✓ คัดลอกข้อความบิลเรียบร้อยแล้ว
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={copyReceiptBill}
                  className="py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
                >
                  <span className="material-symbols-outlined text-base">content_copy</span>
                  คัดลอกบิล
                </button>
                <button
                  onClick={() => setSuccessReceipt(null)}
                  className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
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
