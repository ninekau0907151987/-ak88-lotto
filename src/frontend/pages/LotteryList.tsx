import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, supabaseClient } from '@/shared/lib/firebase';

export type MainCategoryTab = 'thai-foreign' | 'yeekee' | 'set' | 'stock';

interface LotteryItem {
  id: string;
  name: string;
  category: 'thai' | 'foreign' | 'yeekee' | 'set' | 'stock';
  flagUrl?: string;
  path: string;
  isThaiGov?: boolean;
  defaultCloseTime: string; // e.g. "15:20:00"
  drawDays?: number[]; // [0,1,2,3,4,5,6] 0=Sun
  monthlyDays?: number[]; // [1, 16] for Thai
}

// -------------------------------------------------------------
// รายการหวยจริงของระบบ AK88 (เชื่อมโยงกับหลังบ้าน ไม่มีหวยมาเลย์ 4D)
// -------------------------------------------------------------
const THAI_FOREIGN_LOTTERIES: LotteryItem[] = [
  {
    id: 'หวยรัฐบาลไทย',
    name: 'หวยรัฐบาลไทย',
    category: 'thai',
    flagUrl: 'https://flagcdn.com/w80/th.png',
    path: '/lottery/thai',
    isThaiGov: true,
    defaultCloseTime: '15:20:00',
    monthlyDays: [1, 16],
  },
  {
    id: 'หวยฮานอย',
    name: 'หวยฮานอย',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi',
    defaultCloseTime: '18:00:00',
  },
  {
    id: 'ฮานอยพิเศษ',
    name: 'ฮานอยพิเศษ',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi-special',
    defaultCloseTime: '17:00:00',
  },
  {
    id: 'ฮานอย(VIP)',
    name: 'ฮานอย(VIP)',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi-vip',
    defaultCloseTime: '19:00:00',
  },
  {
    id: 'ฮานอยสตาร์',
    name: 'ฮานอยสตาร์',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi-star',
    defaultCloseTime: '12:15:00',
  },
  {
    id: 'ฮานอยสามัคคี',
    name: 'ฮานอยสามัคคี',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi-samakkhi',
    defaultCloseTime: '17:30:00',
  },
  {
    id: 'หวยลาวพัฒนา',
    name: 'หวยลาวพัฒนา',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/la.png',
    path: '/lottery/lao',
    defaultCloseTime: '20:00:00',
    drawDays: [1, 3, 5], // จันทร์, พุธ, ศุกร์
  },
  {
    id: 'หวยลาวสตาร์',
    name: 'หวยลาวสตาร์',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/la.png',
    path: '/lottery/lao-star',
    defaultCloseTime: '15:45:00',
  },
  {
    id: 'ลาวสามัคคี',
    name: 'ลาวสามัคคี',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/la.png',
    path: '/lottery/lao-samakkhi',
    defaultCloseTime: '20:30:00',
  },
  {
    id: 'หวยออมสิน',
    name: 'หวยออมสิน',
    category: 'thai',
    flagUrl: 'https://flagcdn.com/w80/th.png',
    path: '/lottery/gsb',
    defaultCloseTime: '12:30:00',
    monthlyDays: [1, 16],
  },
  {
    id: 'หวยธกส.',
    name: 'หวยธกส.',
    category: 'thai',
    flagUrl: 'https://flagcdn.com/w80/th.png',
    path: '/lottery/baac',
    defaultCloseTime: '09:00:00',
    monthlyDays: [16],
  },
];

const SET_LOTTERIES: LotteryItem[] = [
  {
    id: 'set-thai',
    name: 'หวยรัฐบาล (ชุด 4 ตัว)',
    category: 'set',
    flagUrl: 'https://flagcdn.com/w80/th.png',
    path: '/lottery/set/thai',
    isThaiGov: true,
    defaultCloseTime: '15:20:00',
    monthlyDays: [1, 16],
  },
  {
    id: 'set-hanoi',
    name: 'หวยฮานอยชุด (ชุดละ ฿120)',
    category: 'set',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/set/hanoi',
    defaultCloseTime: '18:00:00',
  },
  {
    id: 'set-lao',
    name: 'หวยลาวพัฒนาชุด (ชุดละ ฿120)',
    category: 'set',
    flagUrl: 'https://flagcdn.com/w80/la.png',
    path: '/lottery/set/lao',
    defaultCloseTime: '20:00:00',
    drawDays: [1, 3, 5],
  },
];

const STOCK_VIP_LOTTERIES: LotteryItem[] = [
  { id: 'stock-nikkei-m', name: 'นิเคอิ VIP (เช้า)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/jp.png', path: '/lottery/stock/nikkei-m', defaultCloseTime: '09:20:00' },
  { id: 'stock-china-m', name: 'จีน VIP (เช้า)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/cn.png', path: '/lottery/stock/china-m', defaultCloseTime: '10:20:00' },
  { id: 'stock-hangseng-m', name: 'ฮั่งเส็ง VIP (เช้า)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/hk.png', path: '/lottery/stock/hangseng-m', defaultCloseTime: '10:50:00' },
  { id: 'stock-taiwan', name: 'ไต้หวัน VIP', category: 'stock', flagUrl: 'https://flagcdn.com/w80/tw.png', path: '/lottery/stock/taiwan', defaultCloseTime: '12:20:00' },
  { id: 'stock-korea', name: 'เกาหลี VIP', category: 'stock', flagUrl: 'https://flagcdn.com/w80/kr.png', path: '/lottery/stock/korea', defaultCloseTime: '12:50:00' },
  { id: 'stock-nikkei-a', name: 'นิเคอิ VIP (บ่าย)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/jp.png', path: '/lottery/stock/nikkei-a', defaultCloseTime: '12:50:00' },
  { id: 'stock-singapore', name: 'สิงคโปร์ VIP', category: 'stock', flagUrl: 'https://flagcdn.com/w80/sg.png', path: '/lottery/stock/singapore-vip', defaultCloseTime: '15:50:00' },
  { id: 'stock-thai-evening', name: 'หุ้นไทยปิดเย็น', category: 'stock', flagUrl: 'https://flagcdn.com/w80/th.png', path: '/lottery/stock/thai-evening', defaultCloseTime: '16:20:00' },
  { id: 'stock-dowjones', name: 'ดาวน์โจนส์(VIP)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/us.png', path: '/lottery/stock/dowjones-vip', defaultCloseTime: '03:00:00' },
  { id: 'stock-uk', name: 'อังกฤษ(VIP)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/gb.png', path: '/lottery/stock/uk-vip', defaultCloseTime: '22:20:00' },
  { id: 'stock-germany', name: 'เยอรมัน(VIP)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/de.png', path: '/lottery/stock/germany-vip', defaultCloseTime: '22:20:00' },
  { id: 'stock-russia', name: 'รัสเซีย(VIP)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/ru.png', path: '/lottery/stock/russia-vip', defaultCloseTime: '22:30:00' },
];

const NAV_TABS: { id: MainCategoryTab; label: string }[] = [
  { id: 'thai-foreign', label: 'ไทย-นอก' },
  { id: 'yeekee', label: 'ยี่กี' },
  { id: 'set', label: 'ชุด' },
  { id: 'stock', label: 'หุ้น' },
];

export default function LotteryList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as MainCategoryTab) || 'thai-foreign';

  const [activeTab, setActiveTab] = useState<MainCategoryTab>(
    initialTab === ('malay' as any) ? 'thai-foreign' : initialTab
  );
  const [now, setNow] = useState<Date>(new Date());
  const [lotteryConfigs, setLotteryConfigs] = useState<Record<string, any>>({});

  // นับเวลาถอยหลังทุก 1 วินาที
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ถ้าเข้ามาด้วย tab=yeekee ให้นำทางตรงไปยังหน้าแผงยี่กี 88 รอบ
  useEffect(() => {
    if (initialTab === 'yeekee') {
      navigate('/lottery/yeekee', { replace: true });
    }
  }, [initialTab, navigate]);

  // ซิงค์การตั้งค่ารอบจาก Supabase / Firestore
  useEffect(() => {
    const q = query(collection(db, 'lotteryTypes'));
    const unsub = onSnapshot(q, (snap) => {
      const map: Record<string, any> = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        map[doc.id] = data;
        if (data.name) map[data.name] = data;
      });
      setLotteryConfigs(map);
    }, err => {
      console.warn('lotteryTypes sync error:', err);
    });

    // ดึงข้อมูลเพิ่มเติมจากตาราง lottery_types ของ Supabase ตรง
    supabaseClient
      .from('lottery_types')
      .select('*')
      .then(({ data }) => {
        if (data) {
          setLotteryConfigs(prev => {
            const next = { ...prev };
            data.forEach((item: any) => {
              next[item.id] = { ...next[item.id], ...item };
              if (item.name) next[item.name] = { ...next[item.name], ...item };
            });
            return next;
          });
        }
      });

    return () => unsub();
  }, []);

  const handleTabChange = (tab: MainCategoryTab) => {
    if (tab === 'yeekee') {
      navigate('/lottery/yeekee');
      return;
    }
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleReload = () => {
    setNow(new Date());
  };

  // คำนวณวันและเวลาปิดรับแทง "YYYY-MM-DD HH:mm:ss" เชื่อมกับข้อมูลหลังบ้าน
  const getClosingInfo = (item: LotteryItem) => {
    const cfg = lotteryConfigs[item.name] || lotteryConfigs[item.id] || null;
    const isManuallyClosed = cfg?.isOpen === false || cfg?.is_open === false;

    // ถ้าแอดมินตั้งเวลาปิดรับในฐานข้อมูลหลังบ้าน
    if (cfg?.closingTime || cfg?.closeTime || cfg?.close_time) {
      const timeVal = cfg.closingTime || cfg.closeTime || cfg.close_time;
      const targetDate = new Date(timeVal);
      if (!isNaN(targetDate.getTime())) {
        const diffMs = targetDate.getTime() - now.getTime();
        const isOpen = !isManuallyClosed && diffMs > 0;
        return {
          dateTimeStr: formatFullDateTime(targetDate),
          isOpen,
          countdownText: formatCountdown(diffMs),
        };
      }
    }

    // กรณีหวยรัฐบาลไทย (ทุกวันที่ 1 และ 16)
    if (item.isThaiGov || item.monthlyDays) {
      const targetDate = calculateMonthlyDraw(now, item.defaultCloseTime, item.monthlyDays || [1, 16]);
      const diffMs = targetDate.getTime() - now.getTime();
      const isOpen = !isManuallyClosed && diffMs > 0 && isSameDay(now, targetDate);
      return {
        dateTimeStr: formatFullDateTime(targetDate),
        isOpen,
        countdownText: formatCountdown(diffMs),
      };
    }

    // กรณีหวยที่มีวันออกเฉพาะ (เช่น ลาว จันทร์/พุธ/ศุกร์)
    if (item.drawDays && item.drawDays.length > 0) {
      const targetDate = calculateWeeklyDraw(now, item.defaultCloseTime, item.drawDays);
      const diffMs = targetDate.getTime() - now.getTime();
      const isTodayDraw = item.drawDays.includes(now.getDay());
      const isOpen = !isManuallyClosed && diffMs > 0 && isTodayDraw;
      return {
        dateTimeStr: formatFullDateTime(targetDate),
        isOpen,
        countdownText: formatCountdown(diffMs),
      };
    }

    // กรณีหวยรายวัน (ฮานอย, หุ้น VIP ฯลฯ)
    const [h, m, s] = item.defaultCloseTime.split(':').map(Number);
    const targetDate = new Date(now);
    targetDate.setHours(h, m, s || 0, 0);

    const diffMs = targetDate.getTime() - now.getTime();
    const isOpen = !isManuallyClosed && diffMs > 0;

    return {
      dateTimeStr: formatFullDateTime(targetDate),
      isOpen,
      countdownText: formatCountdown(diffMs),
    };
  };

  // Helper Formatter: YYYY-MM-DD HH:mm:ss
  const formatFullDateTime = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const formatCountdown = (diffMs: number) => {
    if (diffMs <= 0) return '00:00:00';
    const totalSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const calculateMonthlyDraw = (current: Date, closeTimeStr: string, drawDays: number[]) => {
    const [h, m, s] = closeTimeStr.split(':').map(Number);
    const cDay = current.getDate();

    for (const d of drawDays) {
      if (d === cDay) {
        const candidate = new Date(current);
        candidate.setHours(h, m, s || 0, 0);
        if (candidate.getTime() > current.getTime()) {
          return candidate;
        }
      } else if (d > cDay) {
        const candidate = new Date(current);
        candidate.setDate(d);
        candidate.setHours(h, m, s || 0, 0);
        return candidate;
      }
    }

    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, drawDays[0]);
    nextMonth.setHours(h, m, s || 0, 0);
    return nextMonth;
  };

  const calculateWeeklyDraw = (current: Date, closeTimeStr: string, drawDays: number[]) => {
    const [h, m, s] = closeTimeStr.split(':').map(Number);
    const currentDay = current.getDay();

    if (drawDays.includes(currentDay)) {
      const candidate = new Date(current);
      candidate.setHours(h, m, s || 0, 0);
      if (candidate.getTime() > current.getTime()) {
        return candidate;
      }
    }

    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(current);
      nextDate.setDate(current.getDate() + i);
      if (drawDays.includes(nextDate.getDay())) {
        nextDate.setHours(h, m, s || 0, 0);
        return nextDate;
      }
    }

    const fallback = new Date(current);
    fallback.setHours(h, m, s || 0, 0);
    return fallback;
  };

  // เรนเดอร์การ์ดหวยตามแบบฟอร์มที่ส่งมา (ตรงตามเรฟ 100%)
  const renderLotteryCard = (item: LotteryItem) => {
    const info = getClosingInfo(item);
    const isThaiGov = item.isThaiGov;

    return (
      <Link
        key={item.id}
        to={item.path}
        className="rounded-xl overflow-hidden shadow-lg border border-slate-200/20 flex flex-col transition-all hover:scale-[1.02] hover:shadow-cyan-400/20 duration-150 group"
      >
        {/* ส่วนหัวการ์ด: หวยรัฐบาลไทยแถบแดง / หวยอื่นแถบขาว */}
        <div
          className={`px-3 py-2 flex items-center justify-between transition-colors ${
            isThaiGov
              ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white border-b border-red-500'
              : 'bg-white text-slate-900 border-b border-slate-200'
          }`}
        >
          {/* ฝั่งซ้าย: ธงชาติ หรือ ไอคอน */}
          <div className="flex items-center gap-1.5 shrink-0">
            {item.flagUrl ? (
              <img
                src={item.flagUrl}
                alt=""
                className="w-7 h-4.5 object-cover rounded shadow-sm border border-slate-300"
              />
            ) : (
              <span className="text-base">🎯</span>
            )}
          </div>

          {/* ฝั่งขวา: ชื่อหวย */}
          <div className={`font-black text-xs sm:text-sm text-right truncate ${
            isThaiGov ? 'text-white' : 'text-slate-900'
          }`}>
            {item.name}
          </div>
        </div>

        {/* ตัวการ์ดสีขาว (Card Body): วันเวลาปิด และ สถานะ */}
        <div className="bg-white py-2.5 px-2 text-center flex flex-col justify-center">
          {/* วันที่และเวลาปิดรับแทง (YYYY-MM-DD HH:mm:ss) */}
          <div className="text-[11px] sm:text-xs font-mono font-bold text-slate-700 tracking-tight mb-1">
            {info.dateTimeStr}
          </div>

          {/* เส้นคั่นกลาง */}
          <div className="border-t border-slate-200 pt-1.5 text-xs font-black">
            {info.isOpen ? (
              <span className="text-emerald-600 flex items-center justify-center gap-1 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                เปิดรับแทง ({info.countdownText})
              </span>
            ) : (
              <span className="text-slate-700 font-bold">
                ปิดรับแทง
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  };

  // แถบปุ่มหมวดหมู่ด้านบนกล่อง (ตามแบบภาพ)
  const renderCategoryNav = () => (
    <div className="flex items-center justify-center gap-1 overflow-x-auto pb-1 mb-0.5 z-10 relative">
      {NAV_TABS.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`font-bold text-xs sm:text-sm px-5 py-1.5 rounded-t-lg transition shadow-md ${
              isActive
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white font-black border-t-2 border-x-2 border-red-500 scale-105'
                : 'bg-blue-600 hover:bg-blue-500 text-white border-t border-x border-blue-400'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060c2b] via-[#09123f] to-[#04081c] text-white pb-24 px-3 sm:px-6 pt-4 font-sans">
      
      {/* Container หลัก: จำกัดความกว้าง */}
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ------------------------------------------------------------------- */}
        {/* กล่องที่ 1: หวยไทย-นอก (หวยรัฐบาลไทย + หวยต่างประเทศ) */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'thai-foreign' && (
          <div>
            {/* แถบหมวดหมู่ด้านบนกล่อง */}
            {renderCategoryNav()}

            {/* กล่องคอนเทนเนอร์หลัก: กรอบสีฟ้านีออนเรืองแสง */}
            <div className="border-2 border-cyan-400 rounded-2xl bg-[#08103a]/95 shadow-[0_0_25px_rgba(0,180,216,0.38)] p-3.5 sm:p-5">
              
              {/* แถบหัวกล่อง: ปุ่มรีโหลด 🔄 (ซ้าย) | ชื่อหัวข้อ (กลาง) | ปุ่มย้อนกลับสีแดง (ขวา) */}
              <div className="flex items-center justify-between mb-4 border-b border-cyan-500/20 pb-3">
                <button
                  onClick={handleReload}
                  className="bg-blue-600 hover:bg-blue-500 text-white w-9 h-9 rounded-lg flex items-center justify-center shadow transition active:scale-95 shrink-0"
                  title="รีโหลดสถานะ"
                >
                  <span className="material-symbols-outlined text-lg">sync</span>
                </button>

                <h2 className="text-white font-black text-base sm:text-xl tracking-wide text-center">
                  หวยรัฐบาล และ หวยต่างประเทศ
                </h2>

                <button
                  onClick={() => navigate('/')}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm px-4 py-1.5 rounded-lg shadow transition active:scale-95 shrink-0"
                >
                  ย้อนกลับ
                </button>
              </div>

              {/* ตารางการ์ดหวย 4 คอลัมน์ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {THAI_FOREIGN_LOTTERIES.map(item => renderLotteryCard(item))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* กล่องที่ 2: หวยชุด 4 ตัว */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'set' && (
          <div>
            {renderCategoryNav()}
            <div className="border-2 border-cyan-400 rounded-2xl bg-[#08103a]/95 shadow-[0_0_25px_rgba(0,180,216,0.38)] p-3.5 sm:p-5">
              <div className="flex items-center justify-between mb-4 border-b border-cyan-500/20 pb-3">
                <button onClick={handleReload} className="bg-blue-600 hover:bg-blue-500 text-white w-9 h-9 rounded-lg flex items-center justify-center shadow transition active:scale-95 shrink-0">
                  <span className="material-symbols-outlined text-lg">sync</span>
                </button>
                <h2 className="text-white font-black text-base sm:text-xl">
                  🎁 หวยชุด 4 ตัว (ลุ้นรางวัลสูงสุด ฿6,000,000)
                </h2>
                <button onClick={() => navigate('/')} className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm shadow transition active:scale-95 shrink-0">
                  ย้อนกลับ
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {SET_LOTTERIES.map(item => renderLotteryCard(item))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* กล่องที่ 3: หวยหุ้น VIP & หวยหุ้นรอบวัน */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'stock' && (
          <div>
            {renderCategoryNav()}
            <div className="border-2 border-cyan-400 rounded-2xl bg-[#08103a]/95 shadow-[0_0_25px_rgba(0,180,216,0.38)] p-3.5 sm:p-5">
              <div className="flex items-center justify-between mb-4 border-b border-cyan-500/20 pb-3">
                <button onClick={handleReload} className="bg-blue-600 hover:bg-blue-500 text-white w-9 h-9 rounded-lg flex items-center justify-center shadow transition active:scale-95 shrink-0">
                  <span className="material-symbols-outlined text-lg">sync</span>
                </button>
                <h2 className="text-white font-black text-base sm:text-xl">
                  📈 หวยหุ้น VIP & หุ้นตลาดรอบวัน
                </h2>
                <button onClick={() => navigate('/')} className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs sm:text-sm shadow transition active:scale-95 shrink-0">
                  ย้อนกลับ
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {STOCK_VIP_LOTTERIES.map(item => renderLotteryCard(item))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
