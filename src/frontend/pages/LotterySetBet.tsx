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
  //   เช่น /lottery/set/hanoi → ชุดฮานอย, /lottery/set/thai → ชุดไทย
  //   ถ้าไม่มี param ให้ใช้ค่าเริ่มต้น
  const SET_TYPE_BY_SLUG: Record<string, { name: string; price: number }> = {
    hanoi:   { name: 'ชุดฮานอย',   price: 120 },
    thai:    { name: 'ชุดไทย',     price: 120 },
    lao:     { name: 'ชุดลาว',     price: 120 },
    malay:   { name: 'ชุดมาเลย์',  price: 120 },
    stock:   { name: 'ชุดหุ้น',    price: 120 },
    government: { name: 'ชุดรัฐบาล', price: 120 },
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
      if (type === 'hanoi') setLotterySetType('ชุดฮานอย');
      else if (type === 'lao') setLotterySetType('ชุดลาวพัฒนา');
      else if (type === 'malay') setLotterySetType('ชุดมาเลย์');
      else if (type === 'thai') setLotterySetType('ชุดรัฐบาลไทย');
      else setLotterySetType(`ชุด${type}`);
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
      setRecentTickets([]);
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

  /* ★ สไตล์ปุ่มเลือกประเภทหวยชุด — แยกออกมาเพื่อ JSX อ่านง่าย */
  const setTypeBtnStyle = (active: boolean): CSSProperties =>
    active
      ? { background: 'var(--bet-primary-soft)', borderColor: 'var(--bet-primary)', color: 'var(--bet-primary)', fontWeight: 900 }
      : { background: '#fff', borderColor: 'var(--bet-frame)', color: 'var(--bet-text-muted)' };

  const getSetTypeFlag = (typeStr: string) => {
    if (typeStr.includes('ฮานอย')) return 'https://flagcdn.com/w80/vn.png';
    if (typeStr.includes('ลาว')) return 'https://flagcdn.com/w80/la.png';
    if (typeStr.includes('มาเลย์')) return 'https://flagcdn.com/w80/my.png';
    return 'https://flagcdn.com/w80/th.png';
  };

  const formatRemainingTime = (expiresAt: number) => {
    const remaining = Math.max(0, Math.floor((expiresAt - currentTime) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bet-board pb-32">
      {/* 1. Header Bar — พื้นขาว กรอบล่างชัด */}
      <div className="bg-white border-b-2 p-3 md:p-4 sticky top-0 z-50 flex items-center justify-between shadow-sm"
           style={{ borderColor: 'var(--bet-frame)' }}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 rounded-xl transition flex items-center justify-center border"
            style={{ background: 'var(--bet-subtle)', borderColor: 'var(--bet-frame)', color: 'var(--bet-text-muted)' }}
            id="back-btn"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div>
            <h1 className="font-extrabold text-base md:text-lg flex items-center gap-2" style={{ color: 'var(--bet-ink)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--bet-primary)' }}>grid_view</span>
              แผงหวยชุด 10 ตัว
            </h1>
            <p className="text-[10px] md:text-xs" style={{ color: 'var(--bet-text-muted)' }}>
              {lotterySetType} • ชุดละ {setPrice} ฿ • ลุ้นรางวัลใหญ่ 120,000 ฿
            </p>
          </div>
        </div>

        {/* Live Wallet Balance */}
        <div className="rounded-xl px-3 py-1.5 flex items-center gap-2.5 border"
             style={{ background: 'var(--bet-primary-soft)', borderColor: 'var(--bet-primary)' }}>
          <span className="material-symbols-outlined text-base" style={{ color: 'var(--bet-primary)' }}>account_balance_wallet</span>
          <div className="text-right">
            <p className="text-[9px] font-bold leading-none" style={{ color: 'var(--bet-text-muted)' }}>เครดิตคงเหลือ</p>
            <p className="text-sm md:text-base font-black tracking-tight tabular-nums" style={{ color: 'var(--bet-primary)' }}>
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
              ? 'font-black scale-[1.02] shadow-sm' 
              : 'hover:border-[var(--bet-frame-strong)]'
          }`}
          id="tab-grid"
          style={{
            background: activeTab === 'grid' ? 'var(--bet-primary)' : '#fff',
            color: activeTab === 'grid' ? '#fff' : 'var(--bet-text-muted)',
            border: activeTab === 'grid' ? '1.5px solid var(--bet-primary)' : '1.5px solid var(--bet-frame)',
          }}
        >
          <span className="material-symbols-outlined text-sm">grid_on</span>
          แผงกรอกเลข 10 ตัว
        </button>
        <button
          onClick={() => setActiveTab('payouts')}
          className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
            activeTab === 'payouts' 
              ? 'font-black scale-[1.02] shadow-sm' 
              : 'hover:border-[var(--bet-frame-strong)]'
          }`}
          id="tab-payouts"
          style={{
            background: activeTab === 'payouts' ? 'var(--bet-primary)' : '#fff',
            color: activeTab === 'payouts' ? '#fff' : 'var(--bet-text-muted)',
            border: activeTab === 'payouts' ? '1.5px solid var(--bet-primary)' : '1.5px solid var(--bet-frame)',
          }}
        >
          <span className="material-symbols-outlined text-sm">emoji_events</span>
          ตารางรางวัล
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border ${
            activeTab === 'history' 
              ? 'font-black scale-[1.02] shadow-sm' 
              : 'hover:border-[var(--bet-frame-strong)]'
          }`}
          id="tab-history"
          style={{
            background: activeTab === 'history' ? 'var(--bet-primary)' : '#fff',
            color: activeTab === 'history' ? '#fff' : 'var(--bet-text-muted)',
            border: activeTab === 'history' ? '1.5px solid var(--bet-primary)' : '1.5px solid var(--bet-frame)',
          }}
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
              <div className="bet-frame p-3 md:p-4">
                <span className="text-xs font-bold mb-2 block flex items-center gap-1.5" style={{ color: 'var(--bet-text-muted)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--bet-primary)' }}></span>
                  ประเภทหวยชุด <span className="font-normal">(ระบบเลือกให้อัตโนมัติ — แก้ได้ถ้าต้องการ)</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { name: 'ชุดฮานอย', id: 'hanoi' },
                    { name: 'ชุดลาวพัฒนา', id: 'lao' },
                    { name: 'ชุดมาเลย์', id: 'malay' },
                    { name: 'ชุดรัฐบาลไทย', id: 'thai' }
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => setLotterySetType(item.name)}
                      className="p-2.5 rounded-xl flex items-center gap-2 justify-center transition-all border-2"
                      style={setTypeBtnStyle(lotterySetType === item.name)}
                    >
                      <img 
                        src={getSetTypeFlag(item.name)} 
                        alt={item.name} 
                        className="w-5 h-3.5 rounded object-cover shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-xs font-bold truncate">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="bet-frame flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--bet-text-muted)' }}>
                    <span className="material-symbols-outlined text-sm" style={{ color: 'var(--bet-primary)' }}>magic_button</span>
                    เครื่องมือลัด:
                  </span>
                  <button
                    onClick={handleRandomizeAllRows}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 border"
                    style={{ background: '#fff', borderColor: 'var(--bet-frame)', color: 'var(--bet-text)' }}
                    id="btn-random-all"
                  >
                    <span className="material-symbols-outlined text-xs" style={{ color: 'var(--bet-primary)' }}>casino</span>
                    สุ่มเลข 10 แถว
                  </button>
                  <button
                    onClick={handleClearAllRows}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 border"
                    style={{ background: 'var(--cat-yai-bg)', borderColor: 'var(--cat-yai)', color: 'var(--cat-yai)' }}
                    id="btn-clear-all"
                  >
                    <span className="material-symbols-outlined text-xs">delete_sweep</span>
                    ล้างทั้งหมด
                  </button>
                </div>

                <div className="text-right">
                  <span className="text-[11px]" style={{ color: 'var(--bet-text-muted)' }}>ราคาชุดละ </span>
                  <span className="text-xs font-black" style={{ color: 'var(--bet-primary)' }}>{setPrice} ฿</span>
                  {/* ★ เลือกราคาต่อชุดได้ — แยกตามหมวดที่ผู้เล่นต้องการ */}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    {[20, 50, 120, 300, 500].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSetPrice(p)}
                        className="text-[10px] font-black px-2 py-0.5 rounded border transition-all"
                        style={
                          setPrice === p
                            ? { background: 'var(--bet-primary)', color: '#fff', borderColor: 'var(--bet-primary)' }
                            : { background: '#fff', color: 'var(--bet-text-muted)', borderColor: 'var(--bet-frame)' }
                        }
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
                      className="w-14 text-[10px] font-black text-center rounded border px-1 py-0.5"
                      style={{ borderColor: 'var(--bet-frame)', color: 'var(--bet-primary-text)' }}
                      title="พิมพ์ราคาเองได้"
                    />
                  </div>
                </div>
              </div>

              {/* ==================================================================
               * ★ แผงนับจำนวน — ตอบโจทย์ "บอกด้วยราคาเท่าไร / กี่ชุด กี่ตัว"
               * รวมทุกอย่างไว้ที่เดียว เห็นได้ทันทีโดยไม่ต้องเลื่อน
               * ================================================================== */}
              <div className="bet-frame overflow-hidden" style={{ borderWidth: '1.5px' }}>
                {/* ---- แถวหลัก: ชุด / ตัว / เงิน ---- */}
                <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--bet-divider)' }}>
                  {/* จำนวนชุด */}
                  <div className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-sm" style={{ color: 'var(--bet-primary)' }}>confirmation_number</span>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>เลขชุด</span>
                    </div>
                    <div className="font-black text-2xl md:text-3xl tabular-nums leading-none" style={{ color: 'var(--bet-primary)' }}>
                      {fmtInt(setSummary.setCount)}
                    </div>
                    <div className="text-[9px] mt-1" style={{ color: 'var(--bet-text-faint)' }}>จาก 10 แถว</div>
                  </div>

                  {/* ★ จำนวนตัวที่รอการแทง รวมทุกหมวด */}
                  <div className="py-3 px-2 text-center" style={{ background: 'var(--bet-primary-soft)' }}>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-sm" style={{ color: 'var(--bet-primary)' }}>format_list_numbered</span>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>รอการแทง</span>
                    </div>
                    <div className="font-black text-2xl md:text-3xl tabular-nums leading-none" style={{ color: 'var(--bet-ink)' }}>
                      {fmtInt(setSummary.itemCount)}
                    </div>
                    <div className="text-[9px] mt-1" style={{ color: 'var(--bet-text-faint)' }}>รวมทุกหมวด</div>
                  </div>

                  {/* ยอดเงิน */}
                  <div className="py-3 px-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="material-symbols-outlined text-sm" style={{ color: 'var(--bet-primary)' }}>payments</span>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>ราคารวม</span>
                    </div>
                    <div className="font-black text-xl md:text-2xl tabular-nums leading-none"
                         style={{ color: userData && totalCost > (userData.balance || 0) ? 'var(--cat-yai)' : 'var(--bet-primary)' }}>
                      ฿{fmtMoney(totalCost, 0)}
                    </div>
                    <div className="text-[9px] mt-1" style={{ color: 'var(--bet-text-faint)' }}>
                      ชุดละ {setPrice} ฿
                    </div>
                  </div>
                </div>

                {/* ---- แถวแยกหมวด: เล็ก / กลาง / ใหญ่ ---- */}
                <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--bet-divider)', borderTop: '1px solid var(--bet-frame)', background: 'var(--bet-subtle)' }}>
                  {([
                    { key: 'เล็ก',  color: 'var(--cat-lek)',   bg: 'var(--cat-lek)' },
                    { key: 'กลาง', color: 'var(--cat-klang)', bg: 'var(--cat-klang)' },
                    { key: 'ใหญ่', color: 'var(--cat-yai)',   bg: 'var(--cat-yai)' },
                  ] as const).map(cat => {
                    const n = setSummary.byCategory[cat.key] || 0;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => handleToggleColumnAll(cat.key === 'เล็ก' ? 'lek' : cat.key === 'กลาง' ? 'klang' : 'yai')}
                        className="py-2.5 px-2 flex flex-col items-center gap-1 transition-colors hover:bg-black/[0.03]"
                        title={`คลิกเพื่อเลือก/ยกเลิก "${cat.key}" ทั้งหมด`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: cat.bg }} />
                          <span className="font-black text-xs" style={{ color: cat.color }}>{cat.key}</span>
                        </div>
                        <div className="font-black text-lg tabular-nums leading-none" style={{ color: 'var(--bet-ink)' }}>
                          {fmtInt(n)}
                          <span className="text-[10px] font-bold ml-1" style={{ color: 'var(--bet-text-faint)' }}>ตัว</span>
                        </div>
                        <div className="text-[9px] tabular-nums" style={{ color: 'var(--bet-text-muted)' }}>
                          ฿{fmtInt(n * setPrice)}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* ---- เตือน: เลขชุดซ้ำ ---- */}
                {setSummary.duplicateSets.length > 0 && (
                  <div className="flex items-start gap-1.5 px-3 py-2" style={{ background: 'var(--cat-yai-bg)', borderTop: '1px solid var(--cat-yai)' }}>
                    <span className="material-symbols-outlined text-sm mt-[1px]" style={{ color: 'var(--cat-yai)' }}>content_copy</span>
                    <div className="text-[10px] font-bold leading-relaxed" style={{ color: 'var(--cat-yai)' }}>
                      พบเลขชุดซ้ำ {setSummary.duplicateSets.length} ชุด —
                      {setSummary.duplicateSets.slice(0, 3).map(d => (
                        <span key={d.number} className="ml-1 font-mono px-1.5 rounded" style={{ background: '#fff', border: '1px solid var(--cat-yai)' }}>
                          {d.number} (แถว {d.rows.join(', ')})
                        </span>
                      ))}
                      {setSummary.duplicateSets.length > 3 && <span className="ml-1">+{setSummary.duplicateSets.length - 3}</span>}
                      <div className="font-normal mt-0.5 opacity-75">แต่ละชุดนับแยกกัน — ตรวจสอบก่อนยืนยัน</div>
                    </div>
                  </div>
                )}

                {/* ---- เตือน: แถวกรอกไม่ครบ 4 หลัก ---- */}
                {setSummary.incompleteRows.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: 'var(--cat-klang-bg)', borderTop: '1px solid var(--cat-klang)' }}>
                    <span className="material-symbols-outlined text-sm" style={{ color: 'var(--cat-klang)' }}>error_outline</span>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--cat-klang)' }}>
                      กรอกไม่ครบ 4 หลัก {setSummary.incompleteRows.length} แถว: {setSummary.incompleteRows.map(x => `แถว ${x.rowNo} (${x.filled} หลัก)`).join(' · ')}
                    </span>
                  </div>
                )}

                {/* ---- เตือน: กรอกครบแต่ยังไม่ติ๊กหมวด ---- */}
                {setSummary.unselectedRows.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5" style={{ background: 'var(--bet-primary-soft)', borderTop: '1px solid var(--bet-primary)' }}>
                    <span className="material-symbols-outlined text-sm" style={{ color: 'var(--bet-primary)' }}>info</span>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--bet-primary)' }}>
                      กรอกครบแล้วแต่ยังไม่ติ๊กหมวด {setSummary.unselectedRows.length} แถว: {setSummary.unselectedRows.map(n => `แถว ${n}`).join(' · ')}
                    </span>
                  </div>
                )}
              </div>

              {/* THE 10-ROW BOARD TABLE (Exact Match to User's Whiteboard Drawing) */}
              <div className="bet-frame overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-center border-collapse">
                    {/* Header Columns */}
                    <thead>
                      <tr className="bet-thead text-xs sm:text-sm font-black">
                        <th className="py-3 px-2 w-9 text-center font-mono" style={{ color: 'var(--bet-text-faint)' }}>#</th>
                        <th className="py-3 px-3 text-center tracking-wide" style={{ color: 'var(--bet-ink)' }}>
                          กรอกเลข 4 หลัก
                        </th>
                        <th className="py-3 px-2 w-[72px] sm:w-24 text-center cursor-pointer hover:bg-black/[0.03] transition select-none"
                            onClick={() => handleToggleColumnAll('lek')}
                            title="แตะเพื่อเลือก เล็ก ทั้งหมด">
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-black text-sm sm:text-base" style={{ color: 'var(--cat-lek)' }}>เล็ก</span>
                            <span className="text-[9px] font-normal" style={{ color: 'var(--bet-text-faint)' }}>เลือกทั้งหมด</span>
                          </div>
                        </th>
                        <th className="py-3 px-2 w-[72px] sm:w-24 text-center cursor-pointer hover:bg-black/[0.03] transition select-none"
                            onClick={() => handleToggleColumnAll('klang')}
                            title="แตะเพื่อเลือก กลาง ทั้งหมด">
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-black text-sm sm:text-base" style={{ color: 'var(--cat-klang)' }}>กลาง</span>
                            <span className="text-[9px] font-normal" style={{ color: 'var(--bet-text-faint)' }}>เลือกทั้งหมด</span>
                          </div>
                        </th>
                        <th className="py-3 px-2 w-[72px] sm:w-24 text-center cursor-pointer hover:bg-black/[0.03] transition select-none"
                            onClick={() => handleToggleColumnAll('yai')}
                            title="แตะเพื่อเลือก ใหญ่ ทั้งหมด">
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-black text-sm sm:text-base" style={{ color: 'var(--cat-yai)' }}>ใหญ่</span>
                            <span className="text-[9px] font-normal" style={{ color: 'var(--bet-text-faint)' }}>เลือกทั้งหมด</span>
                          </div>
                        </th>
                      </tr>
                    </thead>

                    {/* 10 Rows Body */}
                    <tbody className="bet-divide" style={{ borderColor: 'var(--bet-divider)' }}>
                      {rows.map((row, index) => {
                        const isFilled = row.d1 && row.d2 && row.d3 && row.d4;
                        const hasSelection = row.lek || row.klang || row.yai;
                        const rowActive = isFilled && hasSelection;

                        return (
                          <tr 
                            key={row.id}
                            className={`transition-colors duration-150 ${rowActive ? 'bet-row--ready' : ''}`}
                            style={{ background: rowActive ? undefined : (index % 2 === 0 ? '#fff' : 'var(--bet-subtle)') }}
                          >
                            {/* Row Index Number */}
                            <td className="py-2.5 px-2 text-[11px] font-mono font-bold select-none" style={{ color: 'var(--bet-text-faint)' }}>
                              {String(row.id).padStart(2, '0')}
                            </td>

                            {/* กรอกเลข 4 ตัว: 4 distinct input boxes [d1][d2][d3][d4] */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                                {(['d1', 'd2', 'd3', 'd4'] as const).map((digitKey, dIndex) => (
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
                                    className={`bet-digit text-center font-mono font-black rounded-lg ${
                                      row[digitKey] ? 'bet-digit--filled scale-[1.04]' : ''
                                    } ${
                                      isPC
                                        ? 'w-16 h-16 text-2xl'
                                        : 'w-9 h-11 sm:w-12 sm:h-13 text-lg sm:text-xl'
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
                                className={`bet-cat-btn bet-cat-btn--lek ${isPC ? 'w-16 h-16 rounded-2xl' : 'w-9 h-9 sm:w-11 sm:h-11 rounded-xl'} flex items-center justify-center mx-auto ${row.lek ? 'is-on scale-105' : ''}`}
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
                                className={`bet-cat-btn bet-cat-btn--klang ${isPC ? 'w-16 h-16 rounded-2xl' : 'w-9 h-9 sm:w-11 sm:h-11 rounded-xl'} flex items-center justify-center mx-auto ${row.klang ? 'is-on scale-105' : ''}`}
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
                                className={`bet-cat-btn bet-cat-btn--yai ${isPC ? 'w-16 h-16 rounded-2xl' : 'w-9 h-9 sm:w-11 sm:h-11 rounded-xl'} flex items-center justify-center mx-auto ${row.yai ? 'is-on scale-105' : ''}`}
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
                <div className="p-3 bg-[#0a192f] border-t border-[#f5c518]/15 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 w-full sm:w-auto">
                    <span className="material-symbols-outlined text-sm text-yellow-500">badge</span>
                    <span>ชื่อผู้ซื้อ / โน้ตโพย:</span>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="ระบุชื่อเรียก เช่น คุณต้อม..."
                      className="flex-1 sm:w-48 text-xs font-bold border border-[#f5c518]/25 bg-[#051121]/80 rounded-lg px-2.5 py-1 text-white outline-none focus:border-[var(--gold-vibrant)]"
                    />
                  </div>
                  <div className="text-[11px] text-gray-400">
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
                      ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 border-[var(--gold-vibrant)] shadow-yellow-500/20 active:scale-95 cursor-pointer'
                      : 'bg-[#051121]/80 text-gray-500 border-[#f5c518]/25 cursor-not-allowed'
                  }`}
                  id="btn-confirm-board"
                >
                  <span className="material-symbols-outlined text-2xl font-black">check_circle</span>
                  <span>ยืนยัน</span>
                  {preparedBets.length > 0 && (
                    <span className="text-sm font-bold bg-[#051121]/60 px-3 py-1 rounded-xl border border-black/10">
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
              className="bg-[#0a192f] rounded-2xl border border-[#f5c518]/15 p-5 shadow-xl space-y-4"
            >
              <div className="text-center max-w-lg mx-auto mb-4">
                <span className="bg-amber-500/10 text-[var(--gold-vibrant)] text-[10px] font-black px-3 py-1 rounded-full border border-[var(--gold-vibrant)]/20 uppercase tracking-widest">
                  Set Lottery Payout Table
                </span>
                <h2 className="text-xl font-extrabold text-white mt-2">ตารางอัตราจ่ายหวยชุด 4 ตัว</h2>
                <p className="text-xs text-gray-400 mt-1">ซื้อชุดละ 120 บาท ลุ้นรับรางวัลพร้อมกันถึง 6 ตำแหน่ง</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SET_PAYOUTS.map((item, idx) => (
                  <div 
                    key={idx}
                    className="p-4 rounded-xl border border-[#f5c518]/15 bg-[#051121]/60 flex items-center justify-between hover:border-[#f5c518]/40 transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-500/10 text-[var(--gold-vibrant)] font-black text-xs flex items-center justify-center border border-amber-500/20">
                          {idx + 1}
                        </span>
                        <span className="font-extrabold text-sm text-white">{item.rank}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">{item.desc}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block font-bold">อัตราจ่าย</span>
                      <span className="text-lg font-black text-[var(--gold-vibrant)]">{item.payout}</span>
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
                <h3 className="font-black text-sm text-white flex items-center gap-1.5 border-l-4 border-[var(--gold-vibrant)] pl-2">
                  <span className="material-symbols-outlined text-sm text-[var(--gold-vibrant)]">history_edu</span>
                  ประวัติการซื้อหวยชุดของคุณ
                </h3>
                <span className="text-[10px] text-gray-400">รวมทั้งหมด {activeTickets.length} โพย</span>
              </div>

              {activeTickets.length === 0 ? (
                <div className="bg-[#0a192f] border border-[#f5c518]/15 rounded-2xl p-12 text-center text-gray-500">
                  <span className="material-symbols-outlined text-4xl mb-2 text-gray-600">receipt_long</span>
                  <p className="font-bold text-xs">ไม่พบรายการส่งโพยหวยชุด</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">กรอกเลขในตาราง 10 แถวแล้วกดยืนยัน รายการจะปรากฏที่นี่</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeTickets.map(ticket => {
                    const isExpired = currentTime >= ticket.expiresAt;
                    const isCancelled = ticket.status === 'cancelled';
                    
                    return (
                      <div 
                        key={ticket.id}
                        className="bg-[#0a192f] rounded-2xl border border-[#f5c518]/15 shadow-lg relative overflow-hidden flex flex-col"
                      >
                        {isCancelled && (
                          <div className="absolute inset-0 bg-black/70 z-10 backdrop-blur-[1px] flex items-center justify-center">
                            <span className="border-2 border-red-500 text-red-400 rounded-xl px-4 py-1.5 font-black text-base uppercase tracking-widest rotate-6 select-none bg-red-950/40">
                              CANCELLED / ยกเลิกแล้ว
                            </span>
                          </div>
                        )}

                        <div className="bg-[#0a192f] px-4 py-3 flex justify-between items-center border-b border-[#f5c518]/15">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#051121]/80 text-[var(--gold-vibrant)] flex items-center justify-center border border-[#f5c518]/15">
                              <span className="material-symbols-outlined text-sm">receipt</span>
                            </div>
                            <div>
                              <div className="font-black text-xs text-white">โพยหวยชุด #{ticket.id}</div>
                              <div className="text-[9px] text-gray-400">
                                {new Date(ticket.createdAt).toLocaleDateString('th-TH')} • {new Date(ticket.createdAt).toLocaleTimeString('th-TH')}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[8px] text-gray-400 block uppercase font-bold">ยอดเงินสุทธิ</span>
                            <span className="text-sm font-black text-[var(--gold-vibrant)]">฿{ticket.totalAmount.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="px-4 pb-4 pt-3 space-y-3">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-gray-400">ลูกค้า: <b className="text-white">{ticket.customerName || 'ทั่วไป'}</b></span>
                            <span className="bg-gray-900 border border-[#f5c518]/15 text-gray-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              {ticket.bets.length} รายการ
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {ticket.bets.map((bet, idx) => (
                              <div 
                                key={idx}
                                className="bg-[#051121]/80 border border-[#f5c518]/15 rounded-lg px-2 py-1 text-xs flex items-center gap-1.5 font-mono"
                              >
                                <span className="font-black text-white">{bet.number}</span>
                                <span className={`text-[10px] font-bold ${
                                  bet.category === 'เล็ก' ? 'text-blue-400' : bet.category === 'กลาง' ? 'text-amber-400' : 'text-red-400'
                                }`}>({bet.category})</span>
                              </div>
                            ))}
                          </div>

                          {!isCancelled && (
                            <div className="pt-2 border-t border-[#f5c518]/15">
                              {!isExpired ? (
                                <button
                                  onClick={() => cancelTicket(ticket.id, ticket.totalAmount)}
                                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-black transition flex items-center justify-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-xs">cancel</span> 
                                  ยกเลิกโพย (เหลือเวลายกเลิก {formatRemainingTime(ticket.expiresAt)} นาที)
                                </button>
                              ) : (
                                <div className="w-full py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-400 text-center">
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
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a192f]/95 backdrop-blur-md border-t border-[var(--gold-vibrant)]/30 shadow-2xl px-4 py-3">
          <div className={`${isPC ? 'max-w-[1500px]' : 'max-w-4xl'} mx-auto flex items-center justify-between gap-3`}>
            {/* ★ แสดงจำนวนตัวที่รอการแทง ตามที่ผู้ใช้ขอ */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 bg-[var(--gold-vibrant)]/10 border border-[var(--gold-vibrant)]/30 rounded-xl px-2.5 py-1.5 shrink-0">
                <span className="material-symbols-outlined text-[var(--gold-vibrant)] text-base">format_list_numbered</span>
                <div className="leading-none">
                  <div className="text-[9px] text-gray-400 font-bold mb-0.5">รอการแทง</div>
                  <div className="text-[var(--gold-vibrant)] font-black text-lg tabular-nums leading-none">
                    {fmtInt(setSummary.itemCount)}
                    <span className="text-[10px] font-bold text-gray-400 ml-1">ตัว</span>
                  </div>
                </div>
              </div>

              <div className="hidden sm:block min-w-0">
                <div className="text-[11px] text-gray-400 truncate">
                  {fmtInt(setSummary.setCount)} ชุด ·
                  <span className="text-blue-400 font-bold"> เล็ก {setSummary.byCategory['เล็ก']}</span> ·
                  <span className="text-amber-400 font-bold"> กลาง {setSummary.byCategory['กลาง']}</span> ·
                  <span className="text-red-400 font-bold"> ใหญ่ {setSummary.byCategory['ใหญ่']}</span>
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  เครดิต: <span className="text-[var(--gold-vibrant)] font-bold">฿{fmtMoney(userData?.balance || 0)}</span>
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
                <span className="text-[10px] text-gray-400 block leading-none">ยอดรวม</span>
                <span className="text-xl sm:text-2xl font-black text-[var(--gold-vibrant)] tabular-nums">
                  ฿{fmtMoney(totalCost, 0)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleConfirmPurchase}
                disabled={preparedBets.length === 0 || isSubmitting}
                className={`py-2.5 px-6 rounded-xl font-black text-sm transition-all shadow-lg flex items-center gap-1.5 ${
                  preparedBets.length > 0 && !isSubmitting
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 hover:brightness-110 active:scale-95 cursor-pointer'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
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
            className="bg-white text-slate-950 rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="bg-[var(--navy-deep)] text-white p-5 text-center relative border-b border-amber-500/30">
              <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg">
                <span className="material-symbols-outlined text-3xl font-black">check</span>
              </div>
              <h3 className="text-lg font-black text-[var(--gold-vibrant)]">ซื้อหวยชุดสำเร็จ!</h3>
              <p className="text-xs text-gray-300 mt-0.5">{successReceipt.lotteryType} • #{successReceipt.ticketId}</p>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">ลูกค้า:</span>
                  <span className="font-black text-slate-900">{successReceipt.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">จำนวนรายการ:</span>
                  <span className="font-black text-slate-900">{successReceipt.bets.length} รายการ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-bold">เวลาที่ซื้อ:</span>
                  <span className="text-gray-700 font-medium">{successReceipt.dateFormatted}</span>
                </div>
              </div>

              {/* Tickets List */}
              <div className="max-h-40 overflow-y-auto space-y-1 p-1">
                {successReceipt.bets.map((bet: SetBetItem, idx: number) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-100 px-3 py-1.5 rounded-lg text-xs">
                    <span className="font-mono font-black text-sm text-slate-900">
                      #{bet.rowId} เลข {bet.number}
                    </span>
                    <span className="text-gray-700 text-[11px] font-bold">
                      หมวด: <span className={
                        bet.category === 'เล็ก' ? 'text-blue-600' : bet.category === 'กลาง' ? 'text-amber-600' : 'text-red-600'
                      }>{bet.category}</span> (฿{bet.price})
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Summary */}
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 flex justify-between items-center">
                <span className="font-black text-slate-900 text-sm">ยอดชำระสุทธิ</span>
                <span className="font-black text-xl text-red-600">฿{successReceipt.totalAmount.toLocaleString()}</span>
              </div>

              {copiedNotification && (
                <div className="text-center text-xs font-bold text-emerald-600 bg-emerald-50 py-1.5 rounded-lg border border-emerald-200">
                  ✓ คัดลอกข้อความบิลเรียบร้อยแล้ว
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={copyReceiptBill}
                  className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">content_copy</span>
                  คัดลอกบิล
                </button>
                <button
                  onClick={() => setSuccessReceipt(null)}
                  className="py-3 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border"
        style={{ background: 'var(--bet-primary)', color: '#fff', borderColor: 'var(--bet-primary)' }}
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
