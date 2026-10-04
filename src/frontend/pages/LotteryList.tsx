import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, supabaseClient } from '@/shared/lib/firebase';
import * as YK from '@/shared/lib/yeekeeEngine';
import { isAllowedOpenLottery } from '@/shared/lib/lotteryCatalog';

export type MainCategoryTab = 'all' | 'thai' | 'foreign' | 'yeekee' | 'stock' | 'set' | 'thai-foreign';

interface LotteryItem {
  id: string;
  name: string;
  category: 'thai' | 'foreign' | 'yeekee' | 'stock' | 'set';
  flagUrl?: string;
  path: string;
  isThaiGov?: boolean;
  isYeekee?: boolean;
  defaultCloseTime: string; // e.g. "15:20:00"
  drawDays?: number[]; // [0,1,2,3,4,5,6] 0=Sun
  monthlyDays?: number[]; // [1, 16] for Thai
}

// -------------------------------------------------------------
// รายการหวยจริงของระบบ AK88 (เชื่อมโยงกับฐานข้อมูล Supabase ไม่มีหวยมาเลย์ 4D)
// -------------------------------------------------------------
const BASE_LOTTERIES: LotteryItem[] = [
  // --- 1. หวยไทย ---
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

  // --- 2. หวยต่างประเทศ ---
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

  // --- 3. หวยยี่กี (การ์ดรวม 88 รอบ แสดงในหน้ารวมตามคำสั่งผู้ใช้) ---
  {
    id: 'หวยยี่กี 88 รอบ',
    name: 'หวยยี่กี 88 รอบ',
    category: 'yeekee',
    flagUrl: 'https://flagcdn.com/w80/th.png',
    path: '/lottery/yeekee',
    isYeekee: true,
    defaultCloseTime: '03:45:00',
  },

  // --- 4. หวยหุ้น VIP ---
  { id: 'หุ้นไทยเช้า', name: 'หุ้นไทยเช้า', category: 'stock', flagUrl: 'https://flagcdn.com/w80/th.png', path: '/lottery/stock/thai-morning', defaultCloseTime: '10:00:00' },
  { id: 'นิเคอิ VIP (เช้า)', name: 'นิเคอิ VIP (เช้า)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/jp.png', path: '/lottery/stock/nikkei-m', defaultCloseTime: '09:20:00' },
  { id: 'จีน VIP (เช้า)', name: 'จีน VIP (เช้า)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/cn.png', path: '/lottery/stock/china-m', defaultCloseTime: '10:20:00' },
  { id: 'ฮั่งเส็ง VIP (เช้า)', name: 'ฮั่งเส็ง VIP (เช้า)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/hk.png', path: '/lottery/stock/hangseng-m', defaultCloseTime: '10:50:00' },
  { id: 'ไต้หวัน VIP', name: 'ไต้หวัน VIP', category: 'stock', flagUrl: 'https://flagcdn.com/w80/tw.png', path: '/lottery/stock/taiwan', defaultCloseTime: '12:20:00' },
  { id: 'เกาหลี VIP', name: 'เกาหลี VIP', category: 'stock', flagUrl: 'https://flagcdn.com/w80/kr.png', path: '/lottery/stock/korea', defaultCloseTime: '12:50:00' },
  { id: 'นิเคอิ VIP (บ่าย)', name: 'นิเคอิ VIP (บ่าย)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/jp.png', path: '/lottery/stock/nikkei-a', defaultCloseTime: '12:50:00' },
  { id: 'สิงคโปร์ VIP', name: 'สิงคโปร์ VIP', category: 'stock', flagUrl: 'https://flagcdn.com/w80/sg.png', path: '/lottery/stock/singapore-vip', defaultCloseTime: '15:50:00' },
  { id: 'หุ้นไทยปิดเย็น', name: 'หุ้นไทยปิดเย็น', category: 'stock', flagUrl: 'https://flagcdn.com/w80/th.png', path: '/lottery/stock/thai-evening', defaultCloseTime: '16:20:00' },
  { id: 'ดาวน์โจนส์(VIP)', name: 'ดาวน์โจนส์(VIP)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/us.png', path: '/lottery/stock/dowjones-vip', defaultCloseTime: '03:00:00' },
  { id: 'อังกฤษ(VIP)', name: 'อังกฤษ(VIP)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/gb.png', path: '/lottery/stock/uk-vip', defaultCloseTime: '22:20:00' },
  { id: 'เยอรมัน(VIP)', name: 'เยอรมัน(VIP)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/de.png', path: '/lottery/stock/germany-vip', defaultCloseTime: '22:20:00' },
  { id: 'รัสเซีย(VIP)', name: 'รัสเซีย(VIP)', category: 'stock', flagUrl: 'https://flagcdn.com/w80/ru.png', path: '/lottery/stock/russia-vip', defaultCloseTime: '22:30:00' },

  // --- 5. หวยชุด 4 ตัว ---
  {
    id: 'หวยรัฐบาล (ชุด 4 ตัว)',
    name: 'หวยรัฐบาล (ชุด 4 ตัว)',
    category: 'set',
    flagUrl: 'https://flagcdn.com/w80/th.png',
    path: '/lottery/set/thai',
    isThaiGov: true,
    defaultCloseTime: '15:20:00',
    monthlyDays: [1, 16],
  },
  {
    id: 'หวยฮานอยชุด (ชุดละ ฿120)',
    name: 'หวยฮานอยชุด (ชุดละ ฿120)',
    category: 'set',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/set/hanoi',
    defaultCloseTime: '18:00:00',
  },
  {
    id: 'ฮานอยพิเศษชุด (ชุดละ ฿120)',
    name: 'ฮานอยพิเศษชุด (ชุดละ ฿120)',
    category: 'set',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/set/hanoi-special',
    defaultCloseTime: '17:00:00',
  },
  {
    id: 'ฮานอย VIP ชุด (ชุดละ ฿120)',
    name: 'ฮานอย VIP ชุด (ชุดละ ฿120)',
    category: 'set',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/set/hanoi-vip',
    defaultCloseTime: '19:00:00',
  },
  {
    id: 'หวยลาวพัฒนาชุด (ชุดละ ฿120)',
    name: 'หวยลาวพัฒนาชุด (ชุดละ ฿120)',
    category: 'set',
    flagUrl: 'https://flagcdn.com/w80/la.png',
    path: '/lottery/set/lao',
    defaultCloseTime: '20:00:00',
    drawDays: [1, 3, 5],
  },
  {
    id: 'หวยลาวสตาร์ชุด (ชุดละ ฿120)',
    name: 'หวยลาวสตาร์ชุด (ชุดละ ฿120)',
    category: 'set',
    flagUrl: 'https://flagcdn.com/w80/la.png',
    path: '/lottery/set/lao-star',
    defaultCloseTime: '15:45:00',
  },
];

// หมวดหมู่และข้อมูลของแต่ละกลุ่ม (การ์ดกลุ่มที่ 1, 2, 3...)
export interface CategorySection {
  id: 'thai' | 'foreign' | 'yeekee' | 'stock' | 'set';
  title: string;
  badge: string;
  icon: string;
  desc: string;
  accentBorder: string;
}

export const CATEGORY_SECTIONS: CategorySection[] = [
  {
    id: 'thai',
    title: 'หวยรัฐบาลไทย และ หวยสถาบันการเงิน',
    badge: '3 รายการ',
    icon: '🇹🇭',
    desc: 'หวยรัฐบาลไทย, สลากออมสิน, สลาก ธ.ก.ส. (อัตราจ่ายสูงสุด บาทละ 900)',
    accentBorder: 'border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.25)]',
  },
  {
    id: 'foreign',
    title: 'หวยต่างประเทศ (ฮานอย & ลาว)',
    badge: '8 รายการ',
    icon: '🌏',
    desc: 'ฮานอย 5 รายการ, ลาว 3 รายการ (ออกผลทุกวัน / จันทร์ พุธ ศุกร์)',
    accentBorder: 'border-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.25)]',
  },
  {
    id: 'yeekee',
    title: 'หวยจับยี่กี VIP 88 รอบสด',
    badge: '88 รอบ/วัน',
    icon: '⏱️',
    desc: 'ออกผลทุก 15 นาที ตลอด 24 ชม. (06:00 - 03:45 น.) พร้อมระบบยิงเลข 5 หลักฟรี',
    accentBorder: 'border-amber-400/60 shadow-[0_0_20px_rgba(245,197,24,0.25)]',
  },
  {
    id: 'stock',
    title: 'หวยหุ้น VIP & ตลาดรอบวัน',
    badge: '12 รายการ',
    icon: '📈',
    desc: 'นิเคอิ VIP เช้า/บ่าย, จีน VIP, ฮั่งเส็ง VIP, ไต้หวัน, เกาหลี, สิงคโปร์, ไทยปิดเย็น, ดาวน์โจนส์, ยุโรป',
    accentBorder: 'border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.25)]',
  },
  {
    id: 'set',
    title: 'หวยชุด 4 ตัว (ลุ้นรางวัลสูงสุด ฿120,000)',
    badge: '6 รายการ',
    icon: '🎁',
    desc: 'หวยรัฐบาลชุด, ฮานอยชุด, ฮานอยพิเศษชุด, ฮานอย VIP ชุด, ลาวพัฒนาชุด, ลาวสตาร์ชุด',
    accentBorder: 'border-purple-500/60 shadow-[0_0_20px_rgba(168,85,247,0.25)]',
  },
];

// หมวดหมู่แท็บนำทางและทางลัดด้านบน
const NAV_TABS: { id: MainCategoryTab; label: string; badge?: string; icon?: string }[] = [
  { id: 'all', label: 'ทั้งหมด', badge: '30', icon: 'apps' },
  { id: 'thai', label: 'หวยไทย', badge: '3', icon: '🇹🇭' },
  { id: 'foreign', label: 'ต่างประเทศ', badge: '8', icon: '🌏' },
  { id: 'yeekee', label: 'ยี่กี 88 รอบ', badge: '88', icon: '⏱️' },
  { id: 'stock', label: 'หุ้น VIP', badge: '12', icon: '📈' },
  { id: 'set', label: 'หวยชุด', badge: '6', icon: '🎁' },
];

export default function LotteryList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = (searchParams.get('tab') as MainCategoryTab) || 'all';

  const [activeTab, setActiveTab] = useState<MainCategoryTab>(() => {
    if (urlTab === ('malay' as any)) return 'all';
    return urlTab;
  });

  const [now, setNow] = useState<Date>(new Date());
  const [lotteryConfigs, setLotteryConfigs] = useState<Record<string, any>>({});

  // นาฬิกานับเวลาถอยหลังทุก 1 วินาที
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ติดตามการเปลี่ยนแปลงของ URL query param
  useEffect(() => {
    if (urlTab) {
      if (urlTab === ('malay' as any)) {
        setActiveTab('all');
      } else {
        setActiveTab(urlTab);
      }
    }
  }, [urlTab]);

  // ซิงค์การตั้งค่ารอบจาก Supabase และ Firestore
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

  // ฟังก์ชันสลับหมวดหมู่และทางลัด
  const handleTabChange = (tab: MainCategoryTab) => {
    // ★ คำสั่งผู้ใช้: "ถ้ากดหวยยี่กีมันก็จะเด้งเป็น 88 ประเภท"
    if (tab === 'yeekee') {
      navigate('/lottery/yeekee');
      return;
    }
    setActiveTab(tab);
    setSearchParams(tab === 'all' ? {} : { tab });

    // หากอยู่ในหน้าทั้งหมดแล้วกดปุ่มหมวดหมู่ ให้เลื่อนลงไปหากลุ่มนั้นโดยตรง
    if (tab !== 'all' && activeTab === 'all') {
      setTimeout(() => {
        const el = document.getElementById(`group-${tab}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

  const handleReload = () => {
    setNow(new Date());
  };

  // ข้อมูลรอบปัจจุบันของยี่กี
  const currentYeekeeRound = useMemo(() => {
    try {
      const cur = YK.currentRound(now.getTime());
      return cur;
    } catch {
      return null;
    }
  }, [now]);

  // คำนวณวันและเวลาปิดรับแทง "YYYY-MM-DD HH:mm:ss" เชื่อมกับข้อมูลหลังบ้าน
  const getClosingInfo = (item: LotteryItem) => {
    const isAllowed = isAllowedOpenLottery(item.name) || isAllowedOpenLottery(item.id);
    const cfg = lotteryConfigs[item.name] || lotteryConfigs[item.id] || null;
    
    // กฎเหล็ก: ปิดทุกหวย เปิด 3 อย่าง (หวยไทย, หุ้นไทยเช้า, ยี่กี)
    // หากไม่ใช่ 3 หวยนี้ และไม่ได้ถูกเปิดเจาะจงในระบบ -> ปิดรับแทง 100%
    const isDbOpen = cfg?.isOpen === true || cfg?.is_open === true;
    const isDbClosed = cfg?.isOpen === false || cfg?.is_open === false;
    
    if (isDbClosed || (!isAllowed && !isDbOpen)) {
      // คำนวณเวลาแสดงผลอ้างอิง
      const [h, m, s] = item.defaultCloseTime.split(':').map(Number);
      const targetDate = new Date(now);
      targetDate.setHours(h, m, s || 0, 0);
      return {
        dateTimeStr: cfg?.closingTime || cfg?.closeTime || cfg?.close_time 
          ? formatFullDateTime(new Date(cfg.closingTime || cfg.closeTime || cfg.close_time))
          : formatFullDateTime(targetDate),
        isOpen: false,
        countdownText: 'ปิดรับแทง',
        statusNote: 'ปิดรับแทงชั่วคราว',
      };
    }

    // 1. กรณียี่กี 88 รอบ (เปิดรับแทงตลอด 88 รอบ)
    if (item.isYeekee) {
      if (currentYeekeeRound) {
        const targetDate = new Date(currentYeekeeRound.closeMs);
        const diffMs = currentYeekeeRound.closeMs - now.getTime();
        return {
          dateTimeStr: `รอบที่ ${currentYeekeeRound.n} (${formatFullDateTime(targetDate)})`,
          isOpen: true,
          countdownText: formatCountdown(diffMs),
          statusNote: `รอบที่ ${currentYeekeeRound.n}/88 (${formatCountdown(diffMs)})`,
        };
      }
      return {
        dateTimeStr: formatFullDateTime(now),
        isOpen: true,
        countdownText: 'เปิดรับ 88 รอบ',
        statusNote: 'เปิดรับแทง 88 รอบสด',
      };
    }

    // 2. ถ้าแอดมินตั้งเวลาปิดรับในฐานข้อมูลหลังบ้าน
    if (cfg?.closingTime || cfg?.closeTime || cfg?.close_time) {
      const timeVal = cfg.closingTime || cfg.closeTime || cfg.close_time;
      const targetDate = new Date(timeVal);
      if (!isNaN(targetDate.getTime())) {
        const diffMs = targetDate.getTime() - now.getTime();
        const isOpen = diffMs > 0;
        return {
          dateTimeStr: formatFullDateTime(targetDate),
          isOpen,
          countdownText: formatCountdown(diffMs),
        };
      }
    }

    // 3. กรณีหวยรัฐบาลไทย (เปิดรอบรับแทงล่วงหน้า พร้อมนับถอยหลังสู่งวดปัจจุบัน)
    if (item.isThaiGov || item.monthlyDays) {
      const targetDate = calculateMonthlyDraw(now, item.defaultCloseTime, item.monthlyDays || [1, 16]);
      const diffMs = targetDate.getTime() - now.getTime();
      return {
        dateTimeStr: formatFullDateTime(targetDate),
        isOpen: true,
        countdownText: formatCountdown(diffMs),
      };
    }

    // 4. กรณีหุ้นไทยเช้า (เปิดรับรอบเช้า ปิด 10:00 น.)
    if (item.id === 'หุ้นไทยเช้า' || item.name === 'หุ้นไทยเช้า') {
      const [h, m, s] = item.defaultCloseTime.split(':').map(Number);
      const targetDate = new Date(now);
      targetDate.setHours(h, m, s || 0, 0);
      if (targetDate.getTime() <= now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      const diffMs = targetDate.getTime() - now.getTime();
      return {
        dateTimeStr: formatFullDateTime(targetDate),
        isOpen: true,
        countdownText: formatCountdown(diffMs),
      };
    }

    // 5. กรณีหวยที่มีวันออกเฉพาะ
    if (item.drawDays && item.drawDays.length > 0) {
      const targetDate = calculateWeeklyDraw(now, item.defaultCloseTime, item.drawDays);
      const diffMs = targetDate.getTime() - now.getTime();
      const isTodayDraw = item.drawDays.includes(now.getDay());
      const isOpen = isAllowed && diffMs > 0 && isTodayDraw;
      return {
        dateTimeStr: formatFullDateTime(targetDate),
        isOpen,
        countdownText: isOpen ? formatCountdown(diffMs) : 'ปิดรับแทง',
      };
    }

    // 6. กรณีหวยอื่นๆ
    const [h, m, s] = item.defaultCloseTime.split(':').map(Number);
    const targetDate = new Date(now);
    targetDate.setHours(h, m, s || 0, 0);
    const diffMs = targetDate.getTime() - now.getTime();
    const isOpen = isAllowed && diffMs > 0;

    return {
      dateTimeStr: formatFullDateTime(targetDate),
      isOpen,
      countdownText: isOpen ? formatCountdown(diffMs) : 'ปิดรับแทง',
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

  // จัดกลุ่มหวยตามหมวดหมู่ (การ์ดกลุ่มที่ 1, 2, 3...)
  const displayedCategories = useMemo(() => {
    const list = CATEGORY_SECTIONS.map(cat => {
      const items = BASE_LOTTERIES.filter(item => {
        if (item.category !== cat.id) return false;
        const cfg = lotteryConfigs[item.name] || lotteryConfigs[item.id];
        if (cfg?.is_hidden === true || cfg?.isHidden === true) return false;
        return true;
      });
      return { ...cat, items };
    });

    if (activeTab === 'all') {
      return list;
    }
    if (activeTab === 'thai-foreign') {
      return list.filter(c => c.id === 'thai' || c.id === 'foreign');
    }
    return list.filter(c => c.id === activeTab);
  }, [activeTab, lotteryConfigs]);

  // หัวข้อตามหมวดหมู่ที่เลือก
  const sectionTitle = useMemo(() => {
    switch (activeTab) {
      case 'thai':
        return '🇹🇭 หวยรัฐบาลไทย และ หวยสถาบันการเงิน';
      case 'foreign':
        return '🌏 หวยต่างประเทศ (ฮานอย / ลาว)';
      case 'yeekee':
        return '⏱️ หวยจับยี่กี VIP 88 รอบสด';
      case 'stock':
        return '📈 หวยหุ้น VIP & ตลาดหุ้นรอบวัน';
      case 'set':
        return '🎁 หวยชุด 4 ตัว (ลุ้นรางวัลสูงสุด ฿120,000)';
      case 'thai-foreign':
        return 'หวยรัฐบาล และ หวยต่างประเทศ';
      default:
        return 'ศูนย์รวมแทงหวยออนไลน์ทุกประเภท';
    }
  }, [activeTab]);

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
          <div className="text-[11px] sm:text-xs font-mono font-bold text-slate-700 tracking-tight mb-1 truncate">
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060c2b] via-[#09123f] to-[#04081c] text-white pb-24 px-3 sm:px-6 pt-3 font-sans">
      
      {/* Container หลัก: จำกัดความกว้าง */}
      <div className="max-w-6xl mx-auto space-y-5">

        {/* แถบหัวกระดานหลัก + ทางลัดหมวดหมู่ (Sticky Shortcut Navigation Bar) */}
        <div className="sticky top-2 z-30 bg-[#060c2b]/95 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-2.5 sm:p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex items-center justify-between gap-2.5 flex-wrap">
          
          {/* ซ้าย: ปุ่มรีโหลด 🔄 & ชื่อหัวข้อ */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleReload}
              className="bg-blue-600 hover:bg-blue-500 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow transition active:scale-95 shrink-0"
              title="รีโหลดสถานะรอบ"
            >
              <span className="material-symbols-outlined text-lg">sync</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-white font-black text-sm sm:text-base md:text-lg tracking-wide leading-tight">
                  {sectionTitle}
                </h2>
                {activeTab !== 'all' && (
                  <button
                    onClick={() => handleTabChange('all')}
                    className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full hover:bg-amber-300 transition"
                  >
                    ดูทุกหมวด
                  </button>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-cyan-300">
                {activeTab === 'all' 
                  ? 'แสดงหวยแยกตามการ์ดกลุ่ม (สไลด์ลงมาเพื่อดูกลุ่มถัดไป)' 
                  : `กำลังแสดงเฉพาะหมวด: ${sectionTitle}`}
              </p>
            </div>
          </div>

          {/* กลาง: ทางลัดหมวดหมู่ (Quick Shortcut Buttons) */}
          <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full scrollbar-none">
            {NAV_TABS.map(tab => {
              const isActive = activeTab === tab.id || (activeTab === 'thai-foreign' && (tab.id === 'thai' || tab.id === 'foreign'));
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`font-black text-xs px-3 sm:px-4 py-1.5 rounded-xl transition shadow flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white border border-red-500 shadow-md shadow-red-600/30'
                      : 'bg-[#0a192f] hover:bg-[#0f2744] text-slate-300 border border-cyan-500/30'
                  }`}
                >
                  {tab.icon && <span className="text-sm">{tab.icon}</span>}
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white text-red-600' : 'bg-white/10 text-slate-300'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ขวา: ปุ่มย้อนกลับ */}
          <button
            onClick={() => navigate('/')}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl shadow transition active:scale-95 shrink-0"
          >
            ย้อนกลับ
          </button>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* รายการการ์ดกลุ่มหวย เรียงตามลำดับ (การ์ดที่ 1, สไลด์ลงมาเป็นการ์ดที่ 2, 3...) */}
        {/* ------------------------------------------------------------------- */}
        <div className="space-y-6">
          {displayedCategories.map((group, groupIndex) => (
            <div
              key={group.id}
              id={`group-${group.id}`}
              className={`border-2 rounded-2xl bg-[#08103a]/95 p-3.5 sm:p-5 transition-all space-y-4 ${group.accentBorder}`}
            >
              {/* ส่วนหัวการ์ดกลุ่ม: มีหมายเลขกลุ่ม ไอคอน ชื่อกลุ่ม จำนวน และทางลัด */}
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-xs text-amber-300 shadow-inner">
                    #{groupIndex + 1}
                  </div>
                  <span className="text-2xl sm:text-3xl">{group.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-black text-base sm:text-lg md:text-xl tracking-wide">
                        {group.title}
                      </h3>
                      <span className="bg-amber-400 text-slate-950 text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">
                        {group.badge}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5 hidden xs:block">
                      {group.desc}
                    </p>
                  </div>
                </div>

                {/* ทางลัดตรงหัวการ์ดกลุ่ม */}
                <div className="flex items-center gap-2">
                  {group.id === 'yeekee' ? (
                    <button
                      onClick={() => navigate('/lottery/yeekee')}
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm px-4 py-2 rounded-xl shadow-lg transition active:scale-95 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">schedule</span>
                      <span>เปิดกระดาน 88 รอบสด ↗</span>
                    </button>
                  ) : activeTab === 'all' ? (
                    <button
                      onClick={() => handleTabChange(group.id)}
                      className="text-xs text-cyan-300 hover:text-white bg-blue-600/30 hover:bg-blue-600/60 border border-cyan-400/40 px-3 py-1.5 rounded-xl transition active:scale-95 flex items-center gap-1 font-bold shadow-sm"
                      title={`ดูเฉพาะ ${group.title}`}
                    >
                      <span>ดูเฉพาะกลุ่มนี้</span>
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTabChange('all')}
                      className="text-xs text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 px-3 py-1.5 rounded-xl transition active:scale-95 flex items-center gap-1 font-bold shadow-sm"
                    >
                      <span className="material-symbols-outlined text-xs">grid_view</span>
                      <span>แสดงทุกกลุ่ม (ทั้งหมด)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* กรณีเป็นกลุ่มหวยยี่กี: มีแบนเนอร์แสดงรอบสดและปุ่มกดเข้ากระดาน 88 รอบ */}
              {group.id === 'yeekee' && (
                <div className="bg-gradient-to-r from-blue-950/80 via-[#0a1f44] to-blue-950/80 border border-cyan-400/40 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-xl text-cyan-300 shrink-0">
                      ⏱️
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-black text-sm sm:text-base">
                          หวยจับยี่กี VIP 88 รอบสด (ออกผลทุก 15 นาที)
                        </span>
                        <span className="bg-emerald-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
                          LIVE
                        </span>
                      </div>
                      <p className="text-slate-300 text-xs mt-0.5">
                        {currentYeekeeRound ? `ขณะนี้: รอบที่ ${currentYeekeeRound.n}/88 (ปิดรับในอีก ${formatCountdown(currentYeekeeRound.closeMs - now.getTime())})` : 'เปิดรับแทง 88 รอบตลอดวัน'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/lottery/yeekee')}
                    className="w-full md:w-auto bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:brightness-110 text-white font-black text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition active:scale-95 whitespace-nowrap"
                  >
                    <span>เข้าสู่กระดาน 88 รอบสด</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              )}

              {/* Grid 4 คอลัมน์ของการ์ดในกลุ่มนี้ (ตรงตามแบบเรฟ media_1791061693301.png) */}
              {group.items.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-1">
                  {group.items.map(item => renderLotteryCard(item))}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs font-bold">
                  ไม่มีรายการหวยที่เปิดรับในกลุ่มนี้ขณะนี้
                </div>
              )}
            </div>
          ))}

          {displayedCategories.length === 0 && (
            <div className="border-2 border-cyan-400/40 rounded-2xl bg-[#08103a]/95 p-12 text-center text-slate-400 font-bold text-sm">
              ไม่พบรายการหวยในหมวดหมู่ที่เลือก
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
