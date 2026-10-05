/**
 * src/frontend/pages/YeekeeBet.tsx
 * ==================================================================
 * หน้าแทงหวยยี่กี 88 รอบสด (Yeekee Live Betting Interface)
 * ออกแบบตามภาพเรฟ (media_1791218089627.png) 100% พร้อมปรับเข้าธีม AK88:
 *   - ขอบเส้นนีออนไซเบอร์บลู / ทองเรืองแสง
 *   - แถบกติกา การจ่าย คู่มือ และตารางรอบ อยู่ด้านบนสุด
 *   - คอลัมน์ซ้าย: บัญชีผู้ใช้, เครดิต, ยอดพนัน, ตารางเงินรางวัลยี่กี
 *   - คอลัมน์รายการแทง: แสดงโพยตัวเลขที่เลือกพร้อมปุ่มส่งโพย
 *   - คอลัมน์กลาง: แป้นเลือกประเภทหวย, ตัวช่วยรูดเลข, แป้นกดเลข 0-9, ใส่ราคา
 *   - คอลัมน์ขวา: ระบบยิงเลข 5 หลักสด (พร้อมเวลา) + ตารางผลรวมเลขยี่กีสด (#1 และ #16 ไฮไลท์รับโบนัส)
 * ==================================================================
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db, supabaseClient } from '@/shared/lib/firebase';
import { collection, addDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import * as YK from '@/shared/lib/yeekeeEngine';

interface BetItem {
  id: string;
  type: string;
  number: string;
  amount: number;
  rate: number;
}

const YEEKEE_RATES: Record<string, number> = {
  '3 ตัวบน': 900,
  '3 ตัวโต๊ด': 150,
  '2 ตัวบน': 92,
  '2 ตัวล่าง': 92,
  '3 กลับ': 900,
  '2 กลับ': 92,
  'วิ่งบน': 3.2,
  'วิ่งล่าง': 4.2,
};

const BET_TYPES_CONFIG: Array<{ key: string; label: string; digits: number }> = [
  { key: '3 ตัวบน', label: '3 ตัวบน', digits: 3 },
  { key: '3 ตัวโต๊ด', label: '3 ตัวโต๊ด', digits: 3 },
  { key: '2 ตัวบน', label: '2 ตัวบน', digits: 2 },
  { key: '2 ตัวล่าง', label: '2 ตัวล่าง', digits: 2 },
  { key: '3 กลับ', label: '3 กลับ', digits: 3 },
  { key: '2 กลับ', label: '2 กลับ', digits: 2 },
  { key: 'วิ่งบน', label: 'วิ่งบน', digits: 1 },
  { key: 'วิ่งล่าง', label: 'วิ่งล่าง', digits: 1 },
];

export default function YeekeeBet() {
  const navigate = useNavigate();
  const { round: urlRoundParam } = useParams<{ round?: string }>();
  const [searchParams] = useSearchParams();

  const [now, setNow] = useState(Date.now());
  const day = useMemo(() => YK.gameDayOf(now), [now]);
  const currentRoundInfo = useMemo(() => YK.currentRound(now), [now]);

  // เลือกรอบที่จะแทง: จาก URL param หรือรอบปัจจุบัน
  const targetRoundNumber = useMemo(() => {
    if (urlRoundParam) {
      const parsed = parseInt(urlRoundParam.replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 88) return parsed;
    }
    const qRound = searchParams.get('round');
    if (qRound) {
      const parsed = parseInt(qRound, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 88) return parsed;
    }
    return currentRoundInfo?.n || 1;
  }, [urlRoundParam, searchParams, currentRoundInfo]);

  // ข้อมูลผู้ใช้และเครดิต
  const [userId, setUserId] = useState<string>(() => localStorage.getItem('userId') || '');
  const [username, setUsername] = useState<string>(() => localStorage.getItem('username') || localStorage.getItem('userName') || '101010');
  const [credit, setCredit] = useState<number>(0);

  // การเลือกประเภทและป้อนเลขแทง
  const [selectedType, setSelectedType] = useState<string>('3 ตัวบน');
  const [digitsInput, setDigitsInput] = useState<string>('');
  const [pricePerBet, setPricePerBet] = useState<number>(1);
  const [betsList, setBetsList] = useState<BetItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ระบบยิงเลข 5 หลัก
  const [shootDigits, setShootDigits] = useState<string>('');
  const [shootsHistory, setShootsHistory] = useState<YK.Shoot[]>([]);
  const [isShooting, setIsShooting] = useState(false);
  const [shootStatusMsg, setShootStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [cooldownSec, setCooldownSec] = useState<number>(0);

  // โมดอลข้อมูลด้านบน (กติกา, การจ่าย, คู่มือ, ตารางรอบ)
  const [activeModal, setActiveModal] = useState<'rules' | 'payouts' | 'guide' | null>(null);

  // คำนวณเวลาปิดรับและนับถอยหลังของรอบที่เลือก
  const roundCloseMs = useMemo(() => {
    return YK.closeMsOf(day, targetRoundNumber);
  }, [day, targetRoundNumber]);

  const diffMs = Math.max(0, roundCloseMs - now);

  const countdownText = useMemo(() => {
    if (diffMs <= 0) return '00:00:00';
    const totalSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }, [diffMs]);

  const formattedCloseTime = useMemo(() => {
    const d = new Date(roundCloseMs);
    const hrs = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  }, [roundCloseMs]);

  // นาฬิกาติ๊กนับถอยหลังทุกวินาที
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ซิงค์เครดิตผู้ใช้แบบ Realtime
  useEffect(() => {
    const uid = localStorage.getItem('userId');
    if (!uid) return;
    setUserId(uid);

    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCredit(Number(data.balance || 0));
        if (data.username) setUsername(data.username);
      }
    });

    return () => unsub();
  }, []);

  // โหลดรายการคนยิงเลขและผลรวมสด
  const loadRoundShootsData = useCallback(async () => {
    try {
      const list = await YK.loadShoots(day, targetRoundNumber);
      setShootsHistory(list);
    } catch (e) {
      console.warn('Load shoots error:', e);
    }
  }, [day, targetRoundNumber]);

  useEffect(() => {
    loadRoundShootsData();
    const interval = setInterval(loadRoundShootsData, 4000);
    return () => clearInterval(interval);
  }, [loadRoundShootsData]);

  // คำนวณผลรวมเลขยี่กีจากรายการที่ยิงเข้ามา
  const totalSum = useMemo(() => {
    return shootsHistory.reduce((acc, cur) => acc + (parseInt(cur.number, 10) || 0), 0);
  }, [shootsHistory]);

  // ตรวจสอบคูลดาวน์การยิงเลข 3 นาที (180 วินาที)
  useEffect(() => {
    const lastShootStr = localStorage.getItem(`last_yk_shoot_${targetRoundNumber}`);
    if (lastShootStr) {
      const elapsed = Math.floor((Date.now() - Number(lastShootStr)) / 1000);
      const remain = Math.max(0, 180 - elapsed);
      setCooldownSec(remain);
    }
  }, [now, targetRoundNumber]);

  // กำหนดจำนวนหลักของประเภทที่เลือก
  const activeDigitsRequired = useMemo(() => {
    const found = BET_TYPES_CONFIG.find(t => t.key === selectedType);
    return found ? found.digits : 3;
  }, [selectedType]);

  // จัดการการกดปุ่มแป้นตัวเลข 0-9
  const handleKeypadPress = (num: string) => {
    if (digitsInput.length < activeDigitsRequired) {
      const next = digitsInput + num;
      setDigitsInput(next);
      // หากกรอกครบตามหลักแล้ว เพิ่มเข้ารายการแทงอัตโนมัติ
      if (next.length === activeDigitsRequired) {
        addBetNumber(next, selectedType, pricePerBet);
        setDigitsInput('');
      }
    }
  };

  const handleBackspace = () => {
    setDigitsInput(prev => prev.slice(0, -1));
  };

  const handleClearInput = () => {
    setDigitsInput('');
  };

  // ฟังก์ชันเพิ่มรายการแทง
  const addBetNumber = (number: string, type: string, amount: number) => {
    if (!number) return;
    const rate = YEEKEE_RATES[type] || 900;

    // กรณีเป็นเลขกลับ 3 กลับ หรือ 2 กลับ
    if (type === '3 กลับ' && number.length === 3) {
      const perms = Array.from(new Set(getPermutations(number)));
      const newItems: BetItem[] = perms.map(n => ({
        id: `${type}-${n}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: '3 ตัวบน',
        number: n,
        amount,
        rate: 900
      }));
      setBetsList(prev => [...prev, ...newItems]);
      return;
    }

    if (type === '2 กลับ' && number.length === 2) {
      const reversed = number.split('').reverse().join('');
      const numbers = Array.from(new Set([number, reversed]));
      const newItems: BetItem[] = numbers.map(n => ({
        id: `${type}-${n}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: '2 ตัวบน',
        number: n,
        amount,
        rate: 92
      }));
      setBetsList(prev => [...prev, ...newItems]);
      return;
    }

    const newItem: BetItem = {
      id: `${type}-${number}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type,
      number,
      amount,
      rate
    };
    setBetsList(prev => [...prev, newItem]);
  };

  // ตัวช่วยสร้างเลขรูดอัตโนมัติ (19 ประตู, รูดหน้า/หลัง, รูดคู่/คี่, รูดสูง/ต่ำ)
  const handleQuickGenerator = (mode: string) => {
    const list: string[] = [];
    if (mode === '19 ประตู' || mode === 'รูดหลักสิบ' || mode === 'รูดหลักหน่วย') {
      const digit = prompt('กรุณาใส่เลข 1 หลักที่ต้องการรูด (0-9):');
      if (!digit || !/^\d$/.test(digit.trim())) return;
      const d = digit.trim();

      if (mode === '19 ประตู') {
        for (let i = 0; i <= 9; i++) {
          list.push(`${d}${i}`);
          if (i !== parseInt(d, 10)) list.push(`${i}${d}`);
        }
      } else if (mode === 'รูดหลักสิบ') {
        for (let i = 0; i <= 9; i++) list.push(`${d}${i}`);
      } else if (mode === 'รูดหลักหน่วย') {
        for (let i = 0; i <= 9; i++) list.push(`${i}${d}`);
      }
    } else if (mode === 'รูดสูง') {
      // 5,6,7,8,9
      for (let i = 50; i <= 99; i++) list.push(String(i));
    } else if (mode === 'รูดต่ำ') {
      // 0,1,2,3,4
      for (let i = 0; i <= 49; i++) list.push(String(i).padStart(2, '0'));
    } else if (mode === 'รูดคู่') {
      for (let i = 0; i <= 99; i++) {
        if (i % 2 === 0) list.push(String(i).padStart(2, '0'));
      }
    } else if (mode === 'รูดคี่') {
      for (let i = 0; i <= 99; i++) {
        if (i % 2 !== 0) list.push(String(i).padStart(2, '0'));
      }
    }

    if (list.length > 0) {
      const type = selectedType.includes('3') ? '2 ตัวบน' : selectedType;
      const newItems: BetItem[] = list.map(n => ({
        id: `${type}-${n}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type,
        number: n,
        amount: pricePerBet,
        rate: YEEKEE_RATES[type] || 92
      }));
      setBetsList(prev => [...prev, ...newItems]);
    }
  };

  // ลบรายการแทงรายตัว
  const removeBetItem = (id: string) => {
    setBetsList(prev => prev.filter(b => b.id !== id));
  };

  // ล้างรายการแทงทั้งหมด
  const clearAllBets = () => {
    setBetsList([]);
  };

  // คำนวณยอดเงินรวมในรายการแทง
  const totalBetAmount = useMemo(() => {
    return betsList.reduce((sum, b) => sum + b.amount, 0);
  }, [betsList]);

  // ฟังก์ชันส่งโพยแทงหวย
  const handleSubmitTicket = async () => {
    if (betsList.length === 0) {
      alert('กรุณาเลือกตัวเลขก่อนส่งโพย');
      return;
    }
    if (credit < totalBetAmount) {
      alert(`ยอดเงินคงเหลือไม่เพียงพอ (มี ฿${credit.toFixed(2)} แต่ยอดแทง ฿${totalBetAmount.toFixed(2)})`);
      return;
    }
    if (diffMs <= 0) {
      alert('รอบนี้ปิดรับแทงแล้ว กรุณาเลือกรอบถัดไป');
      return;
    }

    if (!window.confirm(`ยืนยันการส่งโพยหวยยี่กี รอบที่ ${targetRoundNumber}\n\nจำนวน ${betsList.length} รายการ\nยอดรวม ฿${totalBetAmount.toLocaleString()} บาท?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const ticketData = {
        userId: userId || 'anonymous',
        customerName: username,
        lotteryType: `หวยยี่กี รอบที่ ${targetRoundNumber}`,
        lotteryName: 'หวยยี่กี 88 รอบ',
        roundNumber: targetRoundNumber,
        roundDate: day,
        bets: betsList.map(b => ({
          type: b.type,
          number: b.number,
          amount: b.amount,
          payoutRate: b.rate
        })),
        totalAmount: totalBetAmount,
        status: 'pending',
        createdAt: Date.now(),
        closeTime: roundCloseMs,
      };

      // บันทึกลง Firestore
      await addDoc(collection(db, 'tickets'), ticketData);

      // ตัดยอดเครดิต
      if (userId) {
        await updateDoc(doc(db, 'users', userId), {
          balance: credit - totalBetAmount,
          updatedAt: new Date().toISOString()
        });
      }

      // บันทึกลง Supabase yeekee engine
      try {
        const betInputs = betsList.map(b => ({ number: b.number, type: b.type, amount: b.amount }));
        await YK.placeBet(day, targetRoundNumber, betInputs, YK.DEFAULT_CONFIG, Date.now());
      } catch (err) {
        console.warn('YK.placeBet optional sync notice:', err);
      }

      alert('✅ ส่งโพยสำเร็จเรียบร้อยแล้ว!\nสามารถตรวจสอบสถานะได้ที่เมนู "ประวัติการแทง"');
      setBetsList([]);
    } catch (e: any) {
      alert('เกิดข้อผิดพลาดในการส่งโพย: ' + (e?.message || e));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ฟังก์ชันยิงเลข 5 หลัก
  const handleShootSubmit = async () => {
    const num = shootDigits.trim();
    if (!/^\d{5}$/.test(num)) {
      alert('กรุณากรอกเลข 5 หลักให้ครบถ้วน');
      return;
    }
    if (cooldownSec > 0) {
      alert(`กรุณารอคูลดาวน์อีก ${cooldownSec} วินาที`);
      return;
    }
    if (diffMs <= 0) {
      alert('รอบนี้ปิดรับแทงแล้ว ไม่สามารถยิงเลขได้');
      return;
    }

    setIsShooting(true);
    setShootStatusMsg(null);
    try {
      await YK.submitShoot(day, targetRoundNumber, num, Date.now());
      localStorage.setItem(`last_yk_shoot_${targetRoundNumber}`, String(Date.now()));
      setCooldownSec(180);
      setShootDigits('');
      setShootStatusMsg({ text: `✓ ยิงเลข ${num} สำเร็จ! เข้าสู่ระบบผลรวมแล้ว`, ok: true });
      await loadRoundShootsData();
    } catch (e: any) {
      setShootStatusMsg({ text: e?.message || 'ยิงเลขไม่สำเร็จ', ok: false });
    } finally {
      setIsShooting(false);
    }
  };

  // ฟังก์ชันสุ่มเลข 5 หลักสำหรับยิงเลข
  const handleRandomShoot = () => {
    const rand = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    setShootDigits(rand);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060c2b] via-[#09123f] to-[#04081c] text-white pb-20 pt-2 px-2 sm:px-4 font-sans select-none">
      
      {/* Container หลัก: ดีไซน์ขอบเส้นนีออนไซเบอร์บลูเรืองแสงตามเรฟเป๊ะ */}
      <div className="max-w-[1360px] mx-auto space-y-3">

        {/* ------------------------------------------------------------------- */}
        {/* แถบหัวกระดานหลัก + แถบกติกา การจ่าย คู่มือ (ตามคำสั่งผู้ใช้: เอาไว้ด้านบน) */}
        {/* ------------------------------------------------------------------- */}
        <div className="bg-[#0b173e]/95 border-2 border-cyan-400/80 rounded-2xl p-2.5 sm:p-3.5 shadow-[0_0_25px_rgba(6,182,212,0.35)] flex items-center justify-between gap-3 flex-wrap">
          
          {/* ฝั่งซ้าย: ปุ่มย้อนกลับ + เครดิตผู้ใช้ */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/lottery')}
              className="bg-blue-900/80 hover:bg-blue-800 text-cyan-300 hover:text-white px-3 sm:px-4 py-1.5 rounded-xl border border-cyan-400/50 font-bold text-xs sm:text-sm flex items-center gap-1 transition active:scale-95 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>ย้อนกลับ</span>
            </button>

            {/* เครดิตคงเหลือ (แสดงบนหัวเพื่อให้ดูง่ายบนมือถือ) */}
            <div className="bg-emerald-950/80 border border-emerald-400/60 px-2.5 py-1 rounded-xl text-emerald-300 font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm">
              <span className="text-[10px] text-slate-400 font-sans font-normal">เครดิต:</span>
              <span className="font-black text-emerald-400">฿{credit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* ตรงกลาง: ชื่อหวยยี่กี + เวลานับถอยหลัง + ปิดรับ */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
            <div className="text-white font-black text-sm sm:text-lg flex items-center gap-2">
              <span className="text-xl">⏱️</span>
              <span>หวยยี่กี รอบที่ {targetRoundNumber}/88</span>
            </div>
            
            {/* เวลานับถอยหลัง */}
            <div className="bg-emerald-950/90 border border-emerald-400/80 px-3 py-1 rounded-xl text-emerald-300 font-mono font-black text-xs sm:text-base flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>{countdownText}</span>
            </div>

            {/* ป้ายปิดรับ */}
            <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-xs sm:text-sm px-3 py-1 rounded-xl shadow-md border border-red-400/50 flex items-center gap-1">
              <span>ปิดรับ {formattedCloseTime} น.</span>
            </div>
          </div>

          {/* ฝั่งขวา: แถบกติกา การจ่าย คู่มือ (ตามคำสั่ง: แถบกติกา การจ่าย คู่มือเอาไว้ด้านบน) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveModal('rules')}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-900/60 hover:bg-blue-800 text-cyan-200 border border-cyan-400/40 text-xs font-bold transition flex items-center gap-1 active:scale-95"
            >
              <span className="material-symbols-outlined text-xs">gavel</span>
              <span>กฎกติกา</span>
            </button>

            <button
              onClick={() => setActiveModal('payouts')}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-400/40 text-xs font-bold transition flex items-center gap-1 active:scale-95"
            >
              <span className="material-symbols-outlined text-xs">payments</span>
              <span>อัตราจ่าย</span>
            </button>

            <button
              onClick={() => setActiveModal('guide')}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-400/40 text-xs font-bold transition flex items-center gap-1 active:scale-95"
            >
              <span className="material-symbols-outlined text-xs">menu_book</span>
              <span>คู่มือการเล่น</span>
            </button>

            <button
              onClick={() => navigate('/lottery/yeekee/rounds')}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-400/40 text-xs font-bold transition flex items-center gap-1 active:scale-95"
            >
              <span className="material-symbols-outlined text-xs">calendar_month</span>
              <span>ตาราง 88 รอบ</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* ผังกระดาน 4 คอลัมน์ (ตามรูปเรฟเป๊ะ 100%) */}
        {/* ------------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">

          {/* ================================================================= */}
          {/* คอลัมน์ 1: ซ้ายสุด (ข้อมูลบัญชี, เครดิต, เติมเงิน, ตารางเงินรางวัล) [lg:col-span-2] */}
          {/* บนมือถือ: order-4 (อยู่ล่างสุด) | บนจอคอม: lg:order-1 */}
          {/* ================================================================= */}
          <div className="order-4 lg:order-1 lg:col-span-2 space-y-3">
            
            {/* กล่อง 1: บัญชีผู้ใช้ & เครดิต */}
            <div className="bg-[#0b173e]/90 border border-cyan-400/40 rounded-2xl p-3 shadow-md space-y-2">
              <div className="flex items-center gap-2 border-b border-cyan-500/20 pb-2">
                <span className="material-symbols-outlined text-cyan-300 text-base">account_circle</span>
                <span className="text-xs font-bold text-slate-300">บัญชีผู้ใช้ :</span>
              </div>
              <div className="text-sm font-black text-amber-300 tracking-wider truncate">
                {username}
              </div>

              <div className="pt-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
                  <span className="material-symbols-outlined text-xs">credit_card</span>
                  <span>เครดิต :</span>
                </div>
                <div className="text-base sm:text-lg font-mono font-black text-emerald-400 mt-0.5">
                  ฿{credit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="pt-1 border-t border-cyan-500/20">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
                  <span className="material-symbols-outlined text-xs">local_activity</span>
                  <span>ยอดเดิมพัน :</span>
                </div>
                <div className="text-sm font-mono font-black text-amber-400 mt-0.5">
                  ฿{totalBetAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* กล่อง 2: ปุ่มด่วน เติมเงิน & ถอนเงิน */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
              <Link
                to="/deposit"
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:brightness-110 text-white font-black text-xs shadow-md shadow-red-600/30 flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>➕ เติมเงิน</span>
              </Link>
              <Link
                to="/withdraw"
                className="w-full py-2 px-3 rounded-xl bg-blue-900/80 hover:bg-blue-800 text-cyan-200 font-bold text-xs border border-cyan-400/40 flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                <span>ถอนเงิน / แจ้งฝาก</span>
              </Link>
            </div>

            {/* กล่อง 3: ตารางเงินรางวัลหวยยี่กี (Payout Table) - ซ่อนบนมือถือเนื่องจากมีปุ่มอัตราจ่ายด้านบนแล้ว */}
            <div className="hidden lg:block rounded-2xl overflow-hidden border border-cyan-400/40 shadow-md bg-[#0a163d]/90">
              <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white font-black text-xs py-2 px-3 text-center border-b border-red-500 shadow-sm">
                เงินรางวัลหวยยี่กี
              </div>
              <div className="p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-cyan-500/20 font-bold text-[10px]">
                      <th className="pb-1.5 text-left">ชนิดรางวัล</th>
                      <th className="pb-1.5 text-right">เงินรางวัล</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/10 font-bold">
                    <tr>
                      <td className="py-1 text-slate-200">3 ตัวบน</td>
                      <td className="py-1 text-right font-mono font-black text-amber-300">900 ฿</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-200">3 ตัวโต๊ด</td>
                      <td className="py-1 text-right font-mono font-black text-amber-300">150 ฿</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-200">2 ตัวบน</td>
                      <td className="py-1 text-right font-mono font-black text-amber-300">92 ฿</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-200">2 ตัวล่าง</td>
                      <td className="py-1 text-right font-mono font-black text-amber-300">92 ฿</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-200">3 กลับ</td>
                      <td className="py-1 text-right font-mono font-black text-amber-300">900 ฿</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-200">2 กลับ</td>
                      <td className="py-1 text-right font-mono font-black text-amber-300">92 ฿</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-200">วิ่งบน</td>
                      <td className="py-1 text-right font-mono font-black text-amber-300">3.2 ฿</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-slate-200">วิ่งล่าง</td>
                      <td className="py-1 text-right font-mono font-black text-amber-300">4.2 ฿</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* ================================================================= */}
          {/* คอลัมน์ 2: รายการแทง (โพยแทงหวย) [lg:col-span-2] */}
          {/* บนมือถือ: order-2 (อยู่ต่อจากแป้นกดแทง) | บนจอคอม: lg:order-2 */}
          {/* ================================================================= */}
          <div id="bet-slip-container" className="order-2 lg:order-2 lg:col-span-2 bg-[#0b173e]/90 border border-cyan-400/40 rounded-2xl p-3 shadow-md flex flex-col justify-between min-h-[380px] lg:min-h-[520px]">
            <div>
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-2">
                <span className="text-xs font-black text-cyan-300">
                  รายการแทง : <span className="text-amber-400 text-sm font-mono">{betsList.length}</span>
                </span>
                {betsList.length > 0 && (
                  <button
                    onClick={clearAllBets}
                    className="text-[10px] text-red-400 hover:text-red-300 font-bold underline"
                  >
                    ลบทั้งหมด
                  </button>
                )}
              </div>

              {/* รายการตัวเลขในโพย */}
              <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
                {betsList.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400 font-bold space-y-2">
                    <span className="text-2xl">📝</span>
                    <p>ยังไม่มีรายการแทง</p>
                    <p className="text-[10px] text-slate-500">กดเลือกประเภทและตัวเลขจากแป้นเพื่อเพิ่ม</p>
                  </div>
                ) : (
                  betsList.map((item, idx) => (
                    <div
                      key={item.id}
                      className="bg-white/95 text-slate-900 rounded-lg px-2 py-1 text-xs flex items-center justify-between shadow-sm border border-slate-200"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[10px] font-mono text-slate-400 w-4">{idx + 1}.</span>
                        <span className="font-mono font-black text-sm text-blue-700">{item.number}</span>
                        <span className="text-[10px] text-slate-500">({item.type})</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono font-black text-amber-700">฿{item.amount}</span>
                        <button
                          onClick={() => removeBetItem(item.id)}
                          className="w-4 h-4 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center text-[10px] font-black"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* สรุปยอดเงินและปุ่มส่งโพย */}
            <div className="pt-3 border-t border-cyan-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-slate-300">ยอดรวมทั้งสิ้น :</span>
                <span className="font-mono text-base text-amber-400">
                  ฿{totalBetAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <button
                onClick={handleSubmitTicket}
                disabled={isSubmitting || betsList.length === 0}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:brightness-110 text-white font-black text-xs sm:text-sm shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isSubmitting ? 'กำลังส่งโพย...' : 'ดึงโพย / ส่งแทง ➔'}</span>
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* คอลัมน์ 3: แป้นกดแทงหวย (Keypad & Bet Types) [lg:col-span-4] */}
          {/* บนมือถือ: order-1 (ขึ้นมาบนสุด เข้าแทงได้ทันทีตามคำขอของผู้ใช้!) | บนจอคอม: lg:order-3 */}
          {/* ================================================================= */}
          <div className="order-1 lg:order-3 lg:col-span-4 bg-[#0b173e]/90 border-2 border-cyan-400/70 lg:border-cyan-400/40 rounded-2xl p-3 sm:p-4 shadow-lg shadow-cyan-900/20 space-y-3">
            
            {/* 1. ปุ่มเลือกประเภทหวย */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                เลือกประเภท :
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {BET_TYPES_CONFIG.map(t => {
                  const isActive = selectedType === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => {
                        setSelectedType(t.key);
                        setDigitsInput('');
                      }}
                      className={`py-1.5 px-1 rounded-xl text-xs font-black transition active:scale-95 border ${
                        isActive
                          ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-400 shadow-md shadow-red-600/30 ring-2 ring-red-400/40'
                          : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. เลือกรูดเลข (ตัวช่วยคำนวณเลข) */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                เลือกรูดเลข ({selectedType}) :
              </div>
              <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                {['รูดหลักร้อย', 'รูดหลักสิบ', 'รูดหลักหน่วย', '19 ประตู', 'รูดสูง', 'รูดต่ำ', 'รูดคู่', 'รูดคี่'].map(m => (
                  <button
                    key={m}
                    onClick={() => handleQuickGenerator(m)}
                    className="py-1.5 px-0.5 rounded-lg text-[10px] sm:text-xs font-bold bg-[#14295e] hover:bg-[#1a357a] text-cyan-200 border border-cyan-400/30 transition active:scale-95 text-center truncate"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. ช่องแสดงตัวเลขที่กำลังพิมพ์ */}
            <div className="bg-[#050e26] border border-cyan-400/50 rounded-xl p-2.5 text-center space-y-1">
              <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                กำลังพิมพ์: <span className="text-white font-black">{selectedType}</span> (ต้องใส่ {activeDigitsRequired} หลัก)
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                {Array.from({ length: activeDigitsRequired }).map((_, i) => {
                  const val = digitsInput[i] || '';
                  return (
                    <div
                      key={i}
                      className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-mono font-black shadow-inner transition ${
                        val
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-amber-400/30'
                          : 'bg-white text-slate-400 border-slate-300'
                      }`}
                    >
                      {val || '-'}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. แป้นตัวเลข 10 ปุ่ม (Numeric Keypad ตามเรฟ) */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {/* แถว 1: 7, 8, 9, ลบล่าสุด */}
              <button
                onClick={() => handleKeypadPress('7')}
                className="h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-mono font-black text-xl shadow-md border border-slate-300 active:scale-95 transition"
              >
                7
              </button>
              <button
                onClick={() => handleKeypadPress('8')}
                className="h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-mono font-black text-xl shadow-md border border-slate-300 active:scale-95 transition"
              >
                8
              </button>
              <button
                onClick={() => handleKeypadPress('9')}
                className="h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-mono font-black text-xl shadow-md border border-slate-300 active:scale-95 transition"
              >
                9
              </button>
              <button
                onClick={handleBackspace}
                className="h-11 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-xs shadow-md border border-rose-300 active:scale-95 transition"
              >
                ลบล่าสุด
              </button>

              {/* แถว 2: 4, 5, 6, ลบทั้งหมด */}
              <button
                onClick={() => handleKeypadPress('4')}
                className="h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-mono font-black text-xl shadow-md border border-slate-300 active:scale-95 transition"
              >
                4
              </button>
              <button
                onClick={() => handleKeypadPress('5')}
                className="h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-mono font-black text-xl shadow-md border border-slate-300 active:scale-95 transition"
              >
                5
              </button>
              <button
                onClick={() => handleKeypadPress('6')}
                className="h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-mono font-black text-xl shadow-md border border-slate-300 active:scale-95 transition"
              >
                6
              </button>
              <button
                onClick={handleClearInput}
                className="h-11 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 font-black text-xs shadow-md border border-red-300 active:scale-95 transition"
              >
                ลบทั้งหมด
              </button>

              {/* แถว 3: 1, 2, 3, กำหนดราคา */}
              <button
                onClick={() => handleKeypadPress('1')}
                className="h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-mono font-black text-xl shadow-md border border-slate-300 active:scale-95 transition"
              >
                1
              </button>
              <button
                onClick={() => handleKeypadPress('2')}
                className="h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-mono font-black text-xl shadow-md border border-slate-300 active:scale-95 transition"
              >
                2
              </button>
              <button
                onClick={() => handleKeypadPress('3')}
                className="h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-mono font-black text-xl shadow-md border border-slate-300 active:scale-95 transition"
              >
                3
              </button>
              <div className="bg-[#050e26] text-amber-300 rounded-xl p-1 border border-cyan-500/30 flex flex-col justify-center items-center">
                <span className="text-[9px] font-bold text-slate-400">ราคา/ตัว</span>
                <span className="font-mono font-black text-xs text-amber-400">฿{pricePerBet}</span>
              </div>

              {/* แถว 4: เลข 0 วางตรงกลาง */}
              <div className="col-start-2 col-span-2">
                <button
                  onClick={() => handleKeypadPress('0')}
                  className="w-full h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-mono font-black text-xl shadow-md border border-slate-300 active:scale-95 transition"
                >
                  0
                </button>
              </div>
            </div>

            {/* ปุ่มปรับราคาแทง */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] text-slate-400 font-bold">ใส่ราคา:</span>
              {[1, 5, 10, 20, 50, 100, 500].map(amt => (
                <button
                  key={amt}
                  onClick={() => setPricePerBet(amt)}
                  className={`px-2 py-1 rounded-lg text-xs font-mono font-black border transition ${
                    pricePerBet === amt
                      ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-sm'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  +{amt}
                </button>
              ))}
            </div>

            {/* เงื่อนไขการแทงหวย */}
            <div className="bg-[#060e26] rounded-xl p-2.5 text-[11px] text-slate-400 border border-cyan-500/20 space-y-0.5">
              <div className="font-bold text-slate-300 text-xs mb-0.5">เงื่อนไขการแทงหวย :</div>
              <div>1. แทงขั้นต่ำต่อครั้ง: 1.00 บาท</div>
              <div>2. แทงสูงสุดต่อครั้ง: 2,000 บาท/โพย (ตามการตั้งค่า)</div>
            </div>

          </div>

          {/* ================================================================= */}
          {/* คอลัมน์ 4: ขวาสุด (ยิงเลข 5 หลัก + ผลรวมเลขยี่กีสด) [lg:col-span-4] */}
          {/* บนมือถือ: order-3 | บนจอคอม: lg:order-4 */}
          {/* ================================================================= */}
          <div className="order-3 lg:order-4 lg:col-span-4 space-y-3">
            
            {/* กล่องยิงเลข (Number Shooter) */}
            <div className="rounded-2xl overflow-hidden border border-cyan-400/50 shadow-md bg-[#0a163d]/90">
              <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white font-black text-xs py-2 px-3 text-center border-b border-red-500 shadow-sm">
                ยิงเลข
              </div>
              <div className="p-3 space-y-2.5 text-center">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-cyan-300">หวยยี่กี รอบที่ {targetRoundNumber}</span>
                  <span className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    เวลา {countdownText}
                  </span>
                </div>

                {/* ช่องแสดง 5 หลัก [ _ ][ _ ][ _ ][ _ ][ _ ] */}
                <div className="flex items-center justify-center gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const ch = shootDigits[i] || '';
                    return (
                      <div
                        key={i}
                        className={`w-9 h-11 rounded-lg border-2 flex items-center justify-center font-mono font-black text-lg shadow-inner ${
                          ch
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-blue-950/80 text-cyan-400 border-cyan-400/40'
                        }`}
                      >
                        {ch || '-'}
                      </div>
                    );
                  })}
                </div>

                {/* ช่องพิมพ์ตัวเลขยิงเลข */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    maxLength={5}
                    value={shootDigits}
                    onChange={(e) => setShootDigits(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="พิมพ์เลข 5 หลัก..."
                    className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-1.5 text-center font-mono font-black text-base outline-none focus:border-cyan-400 shadow-inner"
                  />
                  <button
                    onClick={handleRandomShoot}
                    className="px-2.5 py-1.5 rounded-xl bg-blue-900/80 hover:bg-blue-800 text-cyan-300 border border-cyan-400/40 font-bold text-xs"
                    title="สุ่มเลข 5 หลัก"
                  >
                    🎲 สุ่ม
                  </button>
                </div>

                {/* ปุ่มกดยิงเลข */}
                <button
                  onClick={handleShootSubmit}
                  disabled={isShooting || cooldownSec > 0 || shootDigits.length !== 5}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:brightness-110 text-white font-black text-xs sm:text-sm shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm font-bold">radar</span>
                  <span>
                    {isShooting
                      ? 'กำลังบันทึก...'
                      : cooldownSec > 0
                      ? `คูลดาวน์อีก ${cooldownSec} วิ`
                      : 'ยิงเลข (ส่งผล)'}
                  </span>
                </button>

                {shootStatusMsg && (
                  <div className={`text-[11px] font-bold ${shootStatusMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {shootStatusMsg.text}
                  </div>
                )}
              </div>
            </div>

            {/* กล่องผลรวมเลขยี่กี (Live Sum & History Table) */}
            <div className="rounded-2xl overflow-hidden border border-cyan-400/50 shadow-md bg-[#0a163d]/90">
              <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white font-black text-xs py-2 px-3 text-center border-b border-red-500 shadow-sm">
                ผลรวมเลขยี่กี
              </div>
              <div className="p-3 space-y-2">
                {/* ยอดผลรวมตัวโต */}
                <div className="bg-[#050e26] border border-cyan-400/40 rounded-xl py-2 px-3 text-center">
                  <span className="text-xs text-slate-300 font-bold">เท่ากับ </span>
                  <span className="text-lg sm:text-xl font-mono font-black text-red-500 tracking-wider">
                    {totalSum.toLocaleString()}
                  </span>
                </div>

                {/* ตารางประวัติคนยิงเลข 5 หลักสด */}
                <div className="overflow-x-auto max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                  <table className="w-full text-[11px] text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-cyan-500/20 font-bold">
                        <th className="py-1 px-1.5 text-center">ลำดับ</th>
                        <th className="py-1 px-1.5 text-center">เลข</th>
                        <th className="py-1 px-1.5 text-center">ผู้ส่งเลข</th>
                        <th className="py-1 px-1.5 text-right">เมื่อ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/10">
                      {shootsHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                            ยังไม่มีผู้ยิงเลขในรอบนี้ (เป็นคนแรกเพื่อลุ้นรางวัล!)
                          </td>
                        </tr>
                      ) : (
                        shootsHistory.slice().reverse().map((sh, idx) => {
                          const order = shootsHistory.length - idx;
                          const isSpecialReward = order === 1 || order === 16;

                          return (
                            <tr
                              key={sh.id || idx}
                              className={`transition ${
                                isSpecialReward
                                  ? 'bg-red-600/80 text-white font-black'
                                  : 'hover:bg-blue-900/30 text-slate-200'
                              }`}
                            >
                              <td className="py-1 px-1.5 text-center font-mono font-bold">
                                {isSpecialReward && <span className="mr-0.5">🎁</span>}
                                {order}.
                              </td>
                              <td className="py-1 px-1.5 text-center font-mono font-black tracking-wider text-amber-300">
                                {sh.number}
                              </td>
                              <td className="py-1 px-1.5 text-center truncate max-w-[80px]">
                                {sh.username ? sh.username.slice(0, 3) + '***' + sh.username.slice(-1) : 'ยูสเซอร์'}
                              </td>
                              <td className="py-1 px-1.5 text-right font-mono text-[10px] text-slate-400">
                                {new Date(sh.ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="text-[10px] text-amber-300 text-center font-bold pt-1 border-t border-cyan-500/20">
                  🎁 รางวัลพิเศษ: ลำดับที่ 1 รับ ฿200 | ลำดับที่ 16 รับ ฿400
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ------------------------------------------------------------------- */}
      {/* แถบสรุปโพยลอยขอบล่างสำหรับมือถือ (Mobile Sticky Bet Cart) */}
      {/* ------------------------------------------------------------------- */}
      {betsList.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0b173e]/95 backdrop-blur-md border-t-2 border-cyan-400 px-4 py-2.5 flex items-center justify-between shadow-[0_-5px_25px_rgba(0,0,0,0.85)] lg:hidden">
          <div>
            <div className="text-[11px] text-slate-300 font-bold">
              โพย: <span className="text-amber-400 font-mono font-black">{betsList.length}</span> รายการ
            </div>
            <div className="text-sm font-mono font-black text-emerald-400">
              ฿{totalBetAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const slipEl = document.getElementById('bet-slip-container');
                slipEl?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3 py-2 rounded-xl bg-blue-900/90 hover:bg-blue-800 text-cyan-200 border border-cyan-400/50 text-xs font-bold active:scale-95 shadow-sm"
            >
              ดูโพย
            </button>
            <button
              onClick={handleSubmitTicket}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:brightness-110 text-white text-xs font-black shadow-md shadow-red-600/40 active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'กำลังส่ง...' : 'ส่งโพยทันที ➔'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* โมดอลป๊อปอัป: กฎกติกา / อัตราจ่าย / คู่มือการเล่น */}
      {/* ------------------------------------------------------------------- */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-[#0b173e] border-2 border-cyan-400/80 rounded-2xl w-full max-w-lg p-5 shadow-[0_0_35px_rgba(6,182,212,0.4)] text-white space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3">
              <h3 className="font-black text-base sm:text-lg text-cyan-300 flex items-center gap-2">
                {activeModal === 'rules' && '📜 กฎกติกาการเล่นหวยยี่กี 88 รอบ'}
                {activeModal === 'payouts' && '💰 อัตราการจ่ายเงินรางวัล'}
                {activeModal === 'guide' && '📖 คู่มือและขั้นตอนการแทงหวยยี่กี'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs sm:text-sm text-slate-200 space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
              {activeModal === 'rules' && (
                <>
                  <p className="font-bold text-amber-300">1. การออกผลรางวัล:</p>
                  <p>หวยยี่กีเปิดรับวันละ 88 รอบ ทุกๆ 15 นาที รอบแรกเปิดเวลา 06:00 น. ถึงรอบสุดท้าย 03:45 น.</p>
                  <p className="font-bold text-amber-300">2. สูตรการคำนวณผลรางวัล:</p>
                  <p>ผลรางวัล = ผลรวมเลขยี่กีทั้งหมด ลบด้วย เลขที่สมาชิกลำดับที่ 16 ยิงเข้ามา (ผลรวม - ลำดับที่ 16)</p>
                  <p className="font-bold text-amber-300">3. รางวัลพิเศษสำหรับคนยิงเลข:</p>
                  <p>• สมาชิกที่ยิงเลขได้ลำดับที่ 1 รับโบนัสฟรี ฿200 บาท</p>
                  <p>• สมาชิกที่ยิงเลขได้ลำดับที่ 16 รับโบนัสฟรี ฿400 บาท</p>
                  <p>(เงื่อนไข: สมาชิกต้องมียอดเดิมพันในรอบนั้นอย่างน้อย ฿100 บาท)</p>
                </>
              )}

              {activeModal === 'payouts' && (
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-cyan-500/20 font-bold">
                    <span>3 ตัวบน</span>
                    <span className="text-amber-300 font-mono">บาทละ 900</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-cyan-500/20 font-bold">
                    <span>3 ตัวโต๊ด</span>
                    <span className="text-amber-300 font-mono">บาทละ 150</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-cyan-500/20 font-bold">
                    <span>2 ตัวบน</span>
                    <span className="text-amber-300 font-mono">บาทละ 92</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-cyan-500/20 font-bold">
                    <span>2 ตัวล่าง</span>
                    <span className="text-amber-300 font-mono">บาทละ 92</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-cyan-500/20 font-bold">
                    <span>วิ่งบน</span>
                    <span className="text-amber-300 font-mono">บาทละ 3.2</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-cyan-500/20 font-bold">
                    <span>วิ่งล่าง</span>
                    <span className="text-amber-300 font-mono">บาทละ 4.2</span>
                  </div>
                </div>
              )}

              {activeModal === 'guide' && (
                <>
                  <p className="font-bold text-amber-300">ขั้นตอนการแทงหวยยี่กี:</p>
                  <p>1. เลือกประเภทหวยที่ต้องการแทง เช่น 3 ตัวบน, 2 ตัวบน, 2 ตัวล่าง</p>
                  <p>2. กดตัวเลขจากแป้นพิมพ์ตัวเลข 0-9 เมื่อกรอกครบหลัก ระบบจะเพิ่มเข้ารายการแทงทันที</p>
                  <p>3. สามารถปรับราคาต่อตัวได้ตามต้องการ (แทงขั้นต่ำ 1 บาท)</p>
                  <p>4. ตรวจสอบรายการในกล่อง "รายการแทง" แล้วกดปุ่ม "ดึงโพย / ส่งแทง" เพื่อยืนยัน</p>
                  <p>5. สามารถร่วมสนุกยิงเลข 5 หลักฟรี เพื่อลุ้นรับโบนัสพิเศษและกำหนดผลรางวัล!</p>
                </>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                เข้าใจแล้ว ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function getPermutations(str: string): string[] {
  if (str.length <= 1) return [str];
  const perms = new Set<string>();
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const remaining = str.slice(0, i) + str.slice(i + 1);
    for (const perm of getPermutations(remaining)) {
      perms.add(char + perm);
    }
  }
  return Array.from(perms);
}
