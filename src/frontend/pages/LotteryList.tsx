import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';

export type MainCategoryTab = 'thai-foreign' | 'malay' | 'yeekee' | 'set' | 'stock';

interface LotteryItem {
  id: string;
  name: string;
  category: 'thai' | 'foreign' | 'malay' | 'yeekee' | 'set' | 'stock';
  flagUrl?: string;
  logoSvg?: React.ReactNode;
  path: string;
  isSpecialBorder?: boolean;
  isThaiGov?: boolean;
  defaultCloseTime: string; // e.g. "15:20:00"
  drawDays?: number[]; // [0,1,2,3,4,5,6] 0=Sun
  monthlyDays?: number[]; // [1, 16] for Thai
}

// -------------------------------------------------------------
// รายการหวยมาตรฐานตามภาพตัวอย่างและระบบจริง
// -------------------------------------------------------------
const THAI_FOREIGN_LOTTERIES: LotteryItem[] = [
  {
    id: 'thai-gov',
    name: 'หวยรัฐบาลไทย',
    category: 'thai',
    flagUrl: 'https://flagcdn.com/w80/th.png',
    path: '/lottery/thai',
    isThaiGov: true,
    defaultCloseTime: '15:20:00',
    monthlyDays: [1, 16],
  },
  {
    id: 'hanoi-star',
    name: 'ฮานอยสตาร์',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi-star',
    defaultCloseTime: '12:15:00',
  },
  {
    id: 'lao-star',
    name: 'ลาวสตาร์',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/la.png',
    path: '/lottery/lao-star',
    defaultCloseTime: '15:45:00',
  },
  {
    id: 'hanoi-special',
    name: 'ฮานอยพิเศษ',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi-special',
    defaultCloseTime: '17:00:00',
  },
  {
    id: 'malay-standard',
    name: 'หวยมาเลย์',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/my.png',
    path: '/lottery/malay',
    defaultCloseTime: '18:00:00',
    drawDays: [0, 3, 6], // พุธ, เสาร์, อาทิตย์
  },
  {
    id: 'hanoi-standard',
    name: 'หวยฮานอย',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi',
    defaultCloseTime: '18:00:00',
  },
  {
    id: 'hanoi-vip',
    name: 'ฮานอย(VIP)',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi-vip',
    defaultCloseTime: '19:00:00',
  },
  {
    id: 'lao-standard',
    name: 'หวยลาว',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/la.png',
    path: '/lottery/lao',
    defaultCloseTime: '20:00:00',
    drawDays: [1, 3, 5], // จันทร์, พุธ, ศุกร์
  },
  {
    id: 'lao-samakkhi',
    name: 'ลาวสามัคคี',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/la.png',
    path: '/lottery/lao-samakkhi',
    defaultCloseTime: '20:30:00',
  },
  {
    id: 'hanoi-4d',
    name: 'ฮานอย(4D)',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi-extra',
    defaultCloseTime: '21:00:00',
  },
  {
    id: 'gsb-bank',
    name: 'หวยออมสิน',
    category: 'thai',
    flagUrl: 'https://flagcdn.com/w80/th.png',
    path: '/lottery/gsb',
    defaultCloseTime: '12:30:00',
    monthlyDays: [1, 16],
  },
  {
    id: 'baac-bank',
    name: 'หวยธกส.',
    category: 'thai',
    flagUrl: 'https://flagcdn.com/w80/th.png',
    path: '/lottery/baac',
    defaultCloseTime: '09:00:00',
    monthlyDays: [16],
  },
];

// โลโก้มาเลย์พิเศษ (Magnum, Grand Dragon, Singapore)
const MagnumLogo = () => (
  <div className="w-8 h-5 bg-black rounded flex items-center justify-center border border-amber-400/50 shadow-sm shrink-0">
    <span className="text-yellow-400 font-black text-xs tracking-tighter">M</span>
  </div>
);

const GrandDragonLogo = () => (
  <div className="w-8 h-5 bg-red-800 rounded flex items-center justify-center border border-amber-300 shadow-sm shrink-0">
    <span className="text-amber-300 font-black text-[10px] tracking-tight">GD</span>
  </div>
);

const SingaporeLogo = () => (
  <div className="w-8 h-5 bg-blue-700 rounded flex items-center justify-center border border-white shadow-sm shrink-0">
    <span className="text-white font-black text-[9px] tracking-tight">SG 4D</span>
  </div>
);

const MALAY_NEW_LOTTERIES: LotteryItem[] = [
  {
    id: 'malay-magnum',
    name: 'หวย-MagNum 4D',
    category: 'malay',
    logoSvg: <MagnumLogo />,
    path: '/lottery/malay',
    isSpecialBorder: true,
    defaultCloseTime: '18:00:00',
    drawDays: [0, 3, 6],
  },
  {
    id: 'malay-grand-dragon',
    name: 'หวย Grand Dragon Lotto',
    category: 'malay',
    logoSvg: <GrandDragonLogo />,
    path: '/lottery/malay',
    isSpecialBorder: true,
    defaultCloseTime: '18:00:00',
  },
  {
    id: 'singapore-4d',
    name: 'หวย Singapore 4D',
    category: 'malay',
    logoSvg: <SingaporeLogo />,
    path: '/lottery/malay',
    isSpecialBorder: true,
    defaultCloseTime: '17:30:00',
    drawDays: [0, 3, 6],
  },
  {
    id: 'malay-damacai',
    name: 'หวย Damacai 1+3D',
    category: 'malay',
    flagUrl: 'https://flagcdn.com/w80/my.png',
    path: '/lottery/malay',
    isSpecialBorder: true,
    defaultCloseTime: '18:00:00',
    drawDays: [0, 3, 6],
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

export default function LotteryList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as MainCategoryTab) || 'thai-foreign';

  const [activeTab, setActiveTab] = useState<MainCategoryTab>(initialTab);
  const [now, setNow] = useState<Date>(new Date());
  const [lotteryConfigs, setLotteryConfigs] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');

  // นับเวลาถอยหลังทุก 1 วินาที
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    return () => unsub();
  }, []);

  const handleTabChange = (tab: MainCategoryTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleReload = () => {
    setNow(new Date());
  };

  // คำนวณวันและเวลาปิดรับแทง "YYYY-MM-DD HH:mm:ss"
  const getClosingInfo = (item: LotteryItem) => {
    const cfg = lotteryConfigs[item.name] || lotteryConfigs[item.id] || null;
    const isManuallyClosed = cfg?.isOpen === false;

    // ถ้าแอดมินตั้งเวลาปิดรับใน Firestore
    if (cfg?.closingTime || cfg?.closeTime) {
      const targetDate = new Date(cfg.closingTime || cfg.closeTime);
      const diffMs = targetDate.getTime() - now.getTime();
      const isOpen = !isManuallyClosed && diffMs > 0;
      
      const y = targetDate.getFullYear();
      const m = String(targetDate.getMonth() + 1).padStart(2, '0');
      const d = String(targetDate.getDate()).padStart(2, '0');
      const h = String(targetDate.getHours()).padStart(2, '0');
      const min = String(targetDate.getMinutes()).padStart(2, '0');
      const s = String(targetDate.getSeconds()).padStart(2, '0');
      const dateTimeStr = `${y}-${m}-${d} ${h}:${min}:${s}`;

      return {
        dateTimeStr,
        isOpen,
        diffMs,
        countdownText: formatCountdown(diffMs),
      };
    }

    // คำนวณเวลามาตรฐานตามตาราง
    const [ch, cm, cs] = item.defaultCloseTime.split(':').map(Number);
    const targetDate = new Date(now);
    targetDate.setHours(ch, cm, cs || 0, 0);

    // หวยรัฐบาลไทย / ออมสิน / ธกส (ออกวันที่ 1 และ 16)
    if (item.monthlyDays && item.monthlyDays.length > 0) {
      const currentDay = now.getDate();
      let targetDay = item.monthlyDays.find(d => d >= currentDay);
      let targetMonth = now.getMonth();
      let targetYear = now.getFullYear();

      if (!targetDay || (targetDay === currentDay && now.getTime() > targetDate.getTime())) {
        targetMonth += 1;
        targetDay = item.monthlyDays[0];
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear += 1;
        }
      }
      targetDate.setFullYear(targetYear, targetMonth, targetDay);
      targetDate.setHours(ch, cm, 0, 0);
    } else if (item.drawDays && item.drawDays.length > 0) {
      // หวยที่มีวันออกเฉพาะ เช่น มาเลย์ พุธ(3) เสาร์(6) อาทิตย์(0)
      const currentWeekDay = now.getDay();
      let daysToAdd = 0;
      if (item.drawDays.includes(currentWeekDay) && now.getTime() <= targetDate.getTime()) {
        daysToAdd = 0;
      } else {
        daysToAdd = 1;
        while (!item.drawDays.includes((currentWeekDay + daysToAdd) % 7)) {
          daysToAdd++;
        }
      }
      targetDate.setDate(now.getDate() + daysToAdd);
      targetDate.setHours(ch, cm, 0, 0);
    } else {
      // หวยรายวัน (ฮานอย, ลาวสตาร์ ฯลฯ)
      if (now.getTime() > targetDate.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
    }

    const diffMs = targetDate.getTime() - now.getTime();
    const isOpen = !isManuallyClosed && diffMs > 0 && diffMs <= 24 * 3600 * 1000;

    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    const h = String(targetDate.getHours()).padStart(2, '0');
    const min = String(targetDate.getMinutes()).padStart(2, '0');
    const s = String(targetDate.getSeconds()).padStart(2, '0');
    const dateTimeStr = `${y}-${m}-${d} ${h}:${min}:${s}`;

    return {
      dateTimeStr,
      isOpen,
      diffMs,
      countdownText: formatCountdown(diffMs),
    };
  };

  const formatCountdown = (diffMs: number) => {
    if (diffMs <= 0) return '00:00:00';
    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  // เรนเดอร์การ์ดหวยแบบตรงตามภาพต้นแบบ
  const renderLotteryCard = (item: LotteryItem) => {
    const info = getClosingInfo(item);
    const isThaiGov = item.isThaiGov || item.name.includes('รัฐบาล');
    const isOrange = item.isSpecialBorder;

    return (
      <Link
        key={item.id}
        to={item.path}
        className={`bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col group ${
          isOrange
            ? 'border-2 border-[#ff7b00] shadow-[0_0_12px_rgba(255,123,0,0.45)] hover:scale-[1.02]'
            : 'border border-slate-300 hover:scale-[1.02]'
        }`}
      >
        {/* แถบหัวการ์ด (Header Strip) */}
        <div
          className={`px-2.5 py-1.5 flex items-center justify-between border-b ${
            isThaiGov
              ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white'
              : 'bg-white text-slate-900 border-slate-200'
          }`}
        >
          {/* ฝั่งซ้าย: ธงชาติ หรือ โลโก้ */}
          <div className="flex items-center gap-1.5 shrink-0">
            {item.logoSvg ? (
              item.logoSvg
            ) : item.flagUrl ? (
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

        {/* ตัวการ์ดสีขาว (Card Body): วันเวลา และ สถานะ */}
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
      <button
        onClick={() => handleTabChange('thai-foreign')}
        className={`font-bold text-xs sm:text-sm px-4 py-1.5 rounded-t-lg transition shadow-md ${
          activeTab === 'thai-foreign'
            ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white font-black border-t-2 border-x-2 border-red-500 scale-105'
            : 'bg-blue-600 hover:bg-blue-500 text-white border-t border-x border-blue-400'
        }`}
      >
        ไทย-นอก
      </button>

      <button
        onClick={() => handleTabChange('malay')}
        className={`font-bold text-xs sm:text-sm px-4 py-1.5 rounded-t-lg transition shadow-md ${
          activeTab === 'malay'
            ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white font-black border-t-2 border-x-2 border-red-500 scale-105'
            : 'bg-blue-600 hover:bg-blue-500 text-white border-t border-x border-blue-400'
        }`}
      >
        มาเลย์
      </button>

      <button
        onClick={() => handleTabChange('yeekee')}
        className={`font-bold text-xs sm:text-sm px-4 py-1.5 rounded-t-lg transition shadow-md ${
          activeTab === 'yeekee'
            ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white font-black border-t-2 border-x-2 border-red-500 scale-105'
            : 'bg-blue-600 hover:bg-blue-500 text-white border-t border-x border-blue-400'
        }`}
      >
        ยี่กี
      </button>

      <button
        onClick={() => handleTabChange('set')}
        className={`font-bold text-xs sm:text-sm px-4 py-1.5 rounded-t-lg transition shadow-md ${
          activeTab === 'set'
            ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white font-black border-t-2 border-x-2 border-red-500 scale-105'
            : 'bg-blue-600 hover:bg-blue-500 text-white border-t border-x border-blue-400'
        }`}
      >
        ชุด
      </button>

      <button
        onClick={() => handleTabChange('stock')}
        className={`font-bold text-xs sm:text-sm px-4 py-1.5 rounded-t-lg transition shadow-md ${
          activeTab === 'stock'
            ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white font-black border-t-2 border-x-2 border-red-500 scale-105'
            : 'bg-blue-600 hover:bg-blue-500 text-white border-t border-x border-blue-400'
        }`}
      >
        หุ้น
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060c2b] via-[#09123f] to-[#04081c] text-white pb-24 px-3 sm:px-6 pt-4 font-sans">
      
      {/* Container หลัก: จำกัดความกว้าง */}
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ------------------------------------------------------------------- */}
        {/* กล่องที่ 1: หวยไทย-นอก (แสดงเมื่ออยู่แท็บไทย-นอก หรือค่าเริ่มต้น) */}
        {/* ------------------------------------------------------------------- */}
        {(activeTab === 'thai-foreign' || activeTab === 'malay') && (
          <div>
            {/* แถบหมวดหมู่ด้านบนกล่อง */}
            {renderCategoryNav()}

            {/* กล่องกรอบนีออนฟ้าสะท้อนแสง */}
            <div className="border-2 border-cyan-400 rounded-2xl bg-[#08103a]/95 shadow-[0_0_25px_rgba(0,180,216,0.38)] p-3.5 sm:p-5 relative">
              {/* แถบหัวด้านในกรอบ: รีเฟรช (ซ้าย) | ชื่อหมวด (กลาง) | ย้อนกลับ (ขวา) */}
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                {/* ปุ่มรีเฟรช */}
                <button
                  onClick={handleReload}
                  className="bg-blue-600 hover:bg-blue-500 text-white w-9 h-9 rounded-lg flex items-center justify-center shadow transition active:scale-95"
                  title="รีเฟรชเวลา"
                >
                  <span className="material-symbols-outlined text-lg">sync</span>
                </button>

                {/* ชื่อหมวดหมู่ตรงกลาง */}
                <h2 className="text-white font-black text-base sm:text-xl tracking-wide flex items-center gap-2">
                  หวยไทย-นอก
                </h2>

                {/* ปุ่มย้อนกลับสีแดง */}
                <button
                  onClick={() => navigate('/')}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm px-4 py-1.5 rounded-lg shadow transition active:scale-95"
                >
                  ย้อนกลับ
                </button>
              </div>

              {/* ตารางการ์ด 4 คอลัมน์ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {THAI_FOREIGN_LOTTERIES.map(item => renderLotteryCard(item))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* กล่องที่ 2: หวยมาเลย์ มาใหม่ (ขอบส้มพิเศษ ตามภาพตัวอย่าง) */}
        {/* ------------------------------------------------------------------- */}
        {(activeTab === 'thai-foreign' || activeTab === 'malay') && (
          <div>
            {/* แถบหมวดหมู่ด้านบนกล่องที่ 2 */}
            {renderCategoryNav()}

            {/* กล่องกรอบนีออนฟ้าสะท้อนแสง */}
            <div className="border-2 border-cyan-400 rounded-2xl bg-[#08103a]/95 shadow-[0_0_25px_rgba(0,180,216,0.38)] p-3.5 sm:p-5 relative">
              {/* แถบหัวด้านในกรอบ */}
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <button
                  onClick={handleReload}
                  className="bg-blue-600 hover:bg-blue-500 text-white w-9 h-9 rounded-lg flex items-center justify-center shadow transition active:scale-95"
                  title="รีเฟรชเวลา"
                >
                  <span className="material-symbols-outlined text-lg">sync</span>
                </button>

                {/* หัวข้อ: หวยมาเลย์ มาใหม่ */}
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-black text-base sm:text-xl tracking-wide">
                    หวยมาเลย์
                  </h2>
                  <span className="bg-red-600 text-white text-[10px] sm:text-xs font-black px-2 py-0.5 rounded shadow animate-bounce">
                    มาใหม่
                  </span>
                </div>

                <button
                  onClick={() => navigate('/')}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm px-4 py-1.5 rounded-lg shadow transition active:scale-95"
                >
                  ย้อนกลับ
                </button>
              </div>

              {/* ตารางการ์ดมาเลย์ขอบส้ม 4 คอลัมน์ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {MALAY_NEW_LOTTERIES.map(item => renderLotteryCard(item))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* กล่องที่ 3: หวยยี่กี 88 รอบ */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'yeekee' && (
          <div>
            {renderCategoryNav()}
            <div className="border-2 border-cyan-400 rounded-2xl bg-[#08103a]/95 shadow-[0_0_25px_rgba(0,180,216,0.38)] p-4 sm:p-6 text-center">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <button onClick={handleReload} className="bg-blue-600 text-white w-9 h-9 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined">sync</span>
                </button>
                <h2 className="text-xl sm:text-2xl font-black text-amber-300">
                  ⏱️ หวยจับยี่กี 88 รอบ (เปิด 06:00 - 03:45 น.)
                </h2>
                <button onClick={() => navigate('/')} className="bg-red-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs">
                  ย้อนกลับ
                </button>
              </div>

              <div className="my-6 max-w-lg mx-auto bg-slate-950/80 p-5 rounded-2xl border border-amber-400/50 shadow-xl space-y-4">
                <div className="text-amber-300 text-sm font-bold">
                  🎯 ยิงเลข 5 หลักฟรี คูลดาวน์ 3 นาที | จัดเรียงผล 6 หลักแบบสลากกินแบ่งรัฐบาลไทย
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-white/10">
                    <div className="text-slate-400">รอบต่อวัน</div>
                    <div className="text-lg font-black text-white font-mono">88 รอบ</div>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-white/10">
                    <div className="text-slate-400">เวลาต่อรอบ</div>
                    <div className="text-lg font-black text-amber-300 font-mono">15 นาที</div>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-white/10">
                    <div className="text-slate-400">เวลารอผล</div>
                    <div className="text-lg font-black text-emerald-300 font-mono">1 นาที</div>
                  </div>
                </div>

                <Link
                  to="/lottery/yeekee"
                  className="block w-full py-3 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-base rounded-xl shadow-lg hover:brightness-105 active:scale-95 transition"
                >
                  🚀 เข้าสู่ห้องแทงยี่กี 88 รอบ & ยิงเลข 5 หลัก คลิกที่นี่
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* กล่องที่ 4: หวยชุด 4 ตัว */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'set' && (
          <div>
            {renderCategoryNav()}
            <div className="border-2 border-cyan-400 rounded-2xl bg-[#08103a]/95 shadow-[0_0_25px_rgba(0,180,216,0.38)] p-3.5 sm:p-5">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <button onClick={handleReload} className="bg-blue-600 text-white w-9 h-9 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined">sync</span>
                </button>
                <h2 className="text-white font-black text-base sm:text-xl">
                  🎁 หวยชุด 4 ตัว (ลุ้นรางวัลสูงสุด ฿6,000,000)
                </h2>
                <button onClick={() => navigate('/')} className="bg-red-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs">
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
        {/* กล่องที่ 5: หวยหุ้น VIP & หวยหุ้นรอบวัน */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'stock' && (
          <div>
            {renderCategoryNav()}
            <div className="border-2 border-cyan-400 rounded-2xl bg-[#08103a]/95 shadow-[0_0_25px_rgba(0,180,216,0.38)] p-3.5 sm:p-5">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <button onClick={handleReload} className="bg-blue-600 text-white w-9 h-9 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined">sync</span>
                </button>
                <h2 className="text-white font-black text-base sm:text-xl">
                  📈 หวยหุ้น VIP & หุ้นตลาดรอบวัน
                </h2>
                <button onClick={() => navigate('/')} className="bg-red-600 text-white px-4 py-1.5 rounded-lg font-bold text-xs">
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
