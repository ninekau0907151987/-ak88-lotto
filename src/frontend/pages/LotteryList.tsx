import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, supabaseClient } from '@/shared/lib/firebase';
import * as YK from '@/shared/lib/yeekeeEngine';
import { isAllowedOpenLottery } from '@/shared/lib/lotteryCatalog';

export type MainCategoryTab = 'open-only' | 'all' | 'thai-foreign' | 'malay' | 'yeekee' | 'stock' | 'set' | 'thai' | 'foreign';

interface LotteryItem {
  id: string;
  name: string;
  category: 'thai' | 'foreign' | 'yeekee' | 'stock' | 'set' | 'malay';
  flagUrl?: string;
  path: string;
  isThaiGov?: boolean;
  isYeekee?: boolean;
  defaultCloseTime: string; // e.g. "15:20:00"
  drawDays?: number[]; // [0,1,2,3,4,5,6] 0=Sun
  monthlyDays?: number[]; // [1, 16] for Thai
}

// -------------------------------------------------------------
// รายการหวยจริงของระบบ AK88 (เชื่อมโยงกับฐานข้อมูล Supabase ตามรูปเรฟ 100%)
// -------------------------------------------------------------
const BASE_LOTTERIES: LotteryItem[] = [
  // --- 1. หวยไทยและหวยต่างประเทศ (จัดเรียงตามภาพเรฟเป๊ะ) ---
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
    id: 'ฮานอยสตาร์',
    name: 'ฮานอยสตาร์',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi-star',
    defaultCloseTime: '12:15:00',
  },
  {
    id: 'ลาวสตาร์',
    name: 'ลาวสตาร์',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/la.png',
    path: '/lottery/lao-star',
    defaultCloseTime: '15:45:00',
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
    id: 'หวยมาเลย์',
    name: 'หวยมาเลย์',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/my.png',
    path: '/lottery/malay',
    defaultCloseTime: '18:00:00',
    drawDays: [0, 3, 6],
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
    id: 'ฮานอย(VIP)',
    name: 'ฮานอย(VIP)',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi-vip',
    defaultCloseTime: '19:00:00',
  },
  {
    id: 'หวยลาว',
    name: 'หวยลาว',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/la.png',
    path: '/lottery/lao',
    defaultCloseTime: '20:00:00',
    drawDays: [1, 3, 5],
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
    id: 'ฮานอย(4D)',
    name: 'ฮานอย(4D)',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi-4d',
    defaultCloseTime: '18:00:00',
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
  {
    id: 'หวยลาวพัฒนา',
    name: 'หวยลาวพัฒนา',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/la.png',
    path: '/lottery/lao',
    defaultCloseTime: '20:00:00',
    drawDays: [1, 3, 5],
  },
  {
    id: 'ฮานอยสามัคคี',
    name: 'ฮานอยสามัคคี',
    category: 'foreign',
    flagUrl: 'https://flagcdn.com/w80/vn.png',
    path: '/lottery/hanoi-samakkhi',
    defaultCloseTime: '17:30:00',
  },

  // --- 2.5 หวยมาเลย์ มาใหม่ 4D ตามรูปเรฟเป๊ะ ---
  {
    id: 'หวย-MagNum 4D',
    name: 'หวย-MagNum 4D',
    category: 'malay',
    flagUrl: 'https://flagcdn.com/w80/my.png',
    path: '/lottery/bet/หวย-MagNum%204D',
    defaultCloseTime: '18:00:00',
    drawDays: [0, 3, 6],
  },
  {
    id: 'หวย Grand Dragon Lotto',
    name: 'หวย Grand Dragon Lotto',
    category: 'malay',
    flagUrl: 'https://flagcdn.com/w80/my.png',
    path: '/lottery/bet/หวย%20Grand%20Dragon%20Lotto',
    defaultCloseTime: '18:00:00',
  },
  {
    id: 'หวย Singapore 4D',
    name: 'หวย Singapore 4D',
    category: 'malay',
    flagUrl: 'https://flagcdn.com/w80/sg.png',
    path: '/lottery/bet/หวย%20Singapore%204D',
    defaultCloseTime: '18:00:00',
    drawDays: [0, 3, 6],
  },

  // --- 3. หวยยี่กี (การ์ดรวม 88 รอบ) ---
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
// หมวดหมู่และข้อมูลของแต่ละกลุ่มตามรูปเรฟ (การ์ดกลุ่มที่ 1, 2, 3...)
export interface CategorySection {
  id: 'thai-foreign' | 'malay' | 'yeekee' | 'stock' | 'set';
  title: string;
  badge: string;
  subtitleBadge?: string;
  icon: string;
  desc: string;
  accentBorder: string;
  isMalayOrange?: boolean;
}

export const CATEGORY_SECTIONS: CategorySection[] = [
  {
    id: 'thai-foreign',
    title: 'หวยไทย-นอก',
    badge: '11 รายการ',
    icon: '🇹🇭',
    desc: 'หวยรัฐบาลไทย, สลากออมสิน, สลาก ธ.ก.ส., ฮานอย และหวยลาวทุกรอบ',
    accentBorder: 'border-2 border-cyan-400 shadow-[0_0_22px_rgba(6,182,212,0.6)]',
  },
  {
    id: 'malay',
    title: 'หวยมาเลย์',
    subtitleBadge: 'มาใหม่',
    badge: '3 รายการ',
    icon: '🇲🇾',
    desc: 'หวย-MagNum 4D, หวย Grand Dragon Lotto, หวย Singapore 4D',
    accentBorder: 'border-2 border-cyan-400 shadow-[0_0_22px_rgba(6,182,212,0.6)]',
    isMalayOrange: true,
  },
  {
    id: 'yeekee',
    title: 'หวยจับยี่กี VIP 88 รอบ',
    badge: '88 รอบ/วัน',
    icon: '⏱️',
    desc: 'ออกผลทุก 15 นาที ตลอด 24 ชม. พร้อมกระดานยิงเลข 5 หลัก',
    accentBorder: 'border-2 border-cyan-400 shadow-[0_0_22px_rgba(6,182,212,0.6)]',
  },
  {
    id: 'set',
    title: 'หวยชุด 4 ตัว',
    subtitleBadge: '฿120,000',
    badge: '6 รายการ',
    icon: '🎁',
    desc: 'หวยรัฐบาลชุด, ฮานอยชุด, ลาวพัฒนาชุด ลุ้นรางวัลใหญ่',
    accentBorder: 'border-2 border-cyan-400 shadow-[0_0_22px_rgba(6,182,212,0.6)]',
  },
  {
    id: 'stock',
    title: 'หวยหุ้น VIP & ตลาดรอบวัน',
    badge: '13 รายการ',
    icon: '📈',
    desc: 'นิเคอิ VIP, จีน VIP, ฮั่งเส็ง VIP, ไต้หวัน, เกาหลี, หุ้นไทย, ดาวน์โจนส์',
    accentBorder: 'border-2 border-cyan-400 shadow-[0_0_22px_rgba(6,182,212,0.6)]',
  },
];

// แถบแท็บทางลัด 5 ตัวเลือกตรงตามรูปเรฟเป๊ะ
export const FRAME_SHORTCUT_TABS: { id: 'thai-foreign' | 'malay' | 'yeekee' | 'set' | 'stock'; label: string }[] = [
  { id: 'thai-foreign', label: 'ไทย-นอก' },
  { id: 'malay', label: 'มาเลย์' },
  { id: 'yeekee', label: 'ยี่กี' },
  { id: 'set', label: 'ชุด' },
  { id: 'stock', label: 'หุ้น' },
];

// หมวดหมู่แท็บนำทางและทางลัดด้านบน
const NAV_TABS: { id: MainCategoryTab; label: string; badge?: string; icon?: string }[] = [
  { id: 'all', label: 'ทั้งหมด', badge: '33', icon: 'apps' },
  { id: 'thai-foreign', label: 'ไทย-นอก', badge: '11', icon: '🇹🇭' },
  { id: 'malay', label: 'มาเลย์ (มาใหม่)', badge: '3', icon: '🇲🇾' },
  { id: 'yeekee', label: 'ยี่กี 88 รอบ', badge: '88', icon: '⏱️' },
  { id: 'stock', label: 'หุ้น VIP', badge: '13', icon: '📈' },
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

  // ★ รวมหวยมาตรฐาน (BASE_LOTTERIES) เข้ากับหวยที่แอดมินสร้าง/แก้ไขในหลังบ้าน (lotteryConfigs)
  const allLotteries = useMemo<LotteryItem[]>(() => {
    const map = new Map<string, LotteryItem>();

    // 1. เพิ่มจาก BASE_LOTTERIES
    BASE_LOTTERIES.forEach(item => {
      map.set(item.id, { ...item });
      if (item.name) map.set(item.name, { ...item });
    });

    // 2. ผสานจาก lotteryConfigs (Supabase / Firestore)
    Object.entries(lotteryConfigs).forEach(([key, rawCfg]) => {
      const cfg = rawCfg as any;
      if (!cfg || typeof cfg !== 'object') return;
      const id = String(cfg.id || key);
      const name = String(cfg.name || key);
      const rawCat = cfg.category || 'thai';
      const cat = (['thai', 'foreign', 'yeekee', 'stock', 'set'].includes(rawCat) ? rawCat : 'thai') as LotteryItem['category'];
      const flag = cfg.flagUrl || cfg.flag_url || (cfg.icon && (String(cfg.icon).startsWith('http') || String(cfg.icon).startsWith('/')) ? cfg.icon : undefined);

      const existing = map.get(id) || map.get(name);
      if (existing) {
        existing.name = name;
        if (flag) existing.flagUrl = flag;
        if (cfg.path) existing.path = cfg.path;
        if (cat) existing.category = cat;
        map.set(existing.id, existing);
        map.set(existing.name, existing);
      } else {
        // หวยใหม่ที่แอดมินเพิ่มผ่านหลังบ้าน (เช่น หวยลาวประตูชัย หรือหวยทดสอบ)
        let betPath = cfg.path;
        if (!betPath) {
          if (cat === 'set') {
            betPath = `/lottery/set/${encodeURIComponent(id)}`;
          } else {
            betPath = `/lottery/bet/${encodeURIComponent(id)}`;
          }
        }

        const newItem: LotteryItem = {
          id,
          name,
          category: cat,
          flagUrl: flag,
          path: betPath,
          defaultCloseTime: cfg.openTime || cfg.open_time || cfg.defaultCloseTime || '18:00:00',
        };
        map.set(id, newItem);
        map.set(name, newItem);
      }
    });

    return Array.from(new Set(map.values()));
  }, [lotteryConfigs]);

  // คำนวณวันและเวลาปิดรับแทง "YYYY-MM-DD HH:mm:ss" เชื่อมกับข้อมูลหลังบ้าน
  const getClosingInfo = (item: LotteryItem) => {
    const isAllowed = isAllowedOpenLottery(item.name) || isAllowedOpenLottery(item.id);
    const cfg = lotteryConfigs[item.name] || lotteryConfigs[item.id] || null;
    
    // สถานะเปิด-ปิดจากฐานข้อมูลหลังบ้าน
    const isDbOpen = cfg?.isOpen === true || cfg?.is_open === true || cfg?.status === 'open';
    const isDbClosed = cfg?.isOpen === false || cfg?.is_open === false || cfg?.status === 'closed';
    
    // ถ้าถูกปิดจากหลังบ้าน หรือถ้าไม่ได้รับอนุญาตและไม่ได้ถูกเปิดเจาะจง
    if (isDbClosed || (!isAllowed && !isDbOpen)) {
      const [h, m, s] = (item.defaultCloseTime || '18:00:00').split(':').map(Number);
      const targetDate = new Date(now);
      targetDate.setHours(h || 18, m || 0, s || 0, 0);
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
        const isOpen = isDbOpen && diffMs > 0;
        return {
          dateTimeStr: formatFullDateTime(targetDate),
          isOpen,
          countdownText: isOpen ? formatCountdown(diffMs) : 'ปิดรับแทง',
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
      const isOpen = isDbOpen ? true : (isAllowed && diffMs > 0 && isTodayDraw);
      return {
        dateTimeStr: formatFullDateTime(targetDate),
        isOpen,
        countdownText: isOpen ? (diffMs > 0 ? formatCountdown(diffMs) : 'เปิดรับแทง') : 'ปิดรับแทง',
      };
    }

    // 6. กรณีหวยอื่นๆ
    const [h, m, s] = (item.defaultCloseTime || '18:00:00').split(':').map(Number);
    const targetDate = new Date(now);
    targetDate.setHours(h || 18, m || 0, s || 0, 0);
    const diffMs = targetDate.getTime() - now.getTime();
    const isOpen = isDbOpen ? true : (isAllowed && diffMs > 0);

    return {
      dateTimeStr: formatFullDateTime(targetDate),
      isOpen,
      countdownText: isOpen ? (diffMs > 0 ? formatCountdown(diffMs) : 'เปิดรับแทง') : 'ปิดรับแทง',
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
    if (diffMs <= 0) return '00 นาที 00 วิ';
    const totalSecs = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hrs = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n: number) => String(n).padStart(2, '0');

    if (days > 0) {
      return `${days} วัน ${pad(hrs)} ชม. ${pad(mins)} นาที ${pad(secs)} วิ`;
    }
    if (hrs > 0) {
      return `${pad(hrs)} ชม. ${pad(mins)} นาที ${pad(secs)} วิ`;
    }
    return `${pad(mins)} นาที ${pad(secs)} วิ`;
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

  // 🌟 หวยที่เปิดรับแทงขณะนี้ (คำนวณจากทั้ง BASE_LOTTERIES และหวยที่แอดมินเปิดในระบบ)
  const openLotteries = useMemo(() => {
    return allLotteries.filter(item => {
      const info = getClosingInfo(item);
      return info.isOpen;
    });
  }, [allLotteries, now, lotteryConfigs, currentYeekeeRound]);

  // จัดกลุ่มหวยตามหมวดหมู่ (การ์ดกลุ่มที่ 1, 2, 3...)
  const displayedCategories = useMemo(() => {
    if (activeTab === 'open-only') {
      return [{
        id: 'open-only' as any,
        title: '🔥 หวยที่กำลังเปิดรับแทงขณะนี้ (เข้าแทงได้ทันที)',
        badge: `${openLotteries.length} รายการ`,
        icon: '🔥',
        desc: 'เปิดรับแทงหวยที่เปิดรับในระบบ อัตราจ่ายสูงสุด บาทละ 900 ยี่กี 88 รอบ และหุ้นไทยเช้า',
        accentBorder: 'border-amber-400 shadow-[0_0_25px_rgba(245,197,24,0.35)]',
        items: openLotteries
      }];
    }

    const list = CATEGORY_SECTIONS.map(cat => {
      const items = allLotteries.filter(item => {
        const matchesCategory = cat.id === 'thai-foreign'
          ? (item.category === 'thai' || item.category === 'foreign')
          : item.category === cat.id;
        if (!matchesCategory) return false;
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
      return list.filter(c => c.id === 'thai-foreign');
    }
    return list.filter(c => c.id === activeTab);
  }, [activeTab, lotteryConfigs, openLotteries, allLotteries]);

  // ทางลัดเปลี่ยนหมวดหมู่/เลื่อนไปหากลุ่มที่ต้องการ
  const handleShortcutClick = (tabId: string) => {
    if (tabId === 'yeekee') {
      navigate('/lottery/yeekee');
      return;
    }
    if (activeTab !== 'all') {
      setActiveTab('all');
      setSearchParams({});
    }
    setTimeout(() => {
      const el = document.getElementById(`group-${tabId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  // เรนเดอร์การ์ดหวยตามแบบเรฟในภาพ 100%:
  // - การ์ดสีขาว คลาสสิก สะอาดตา
  // - ส่วนหัว: ธงชาติ/โลโก้ทางซ้าย, ป้ายชื่อหวยทางขวา
  // - ตัวการ์ดกลาง: วันและเวลา
  // - ท้ายการ์ด: แถบสถานะ ปิดรับแทง / เปิดรับแทง
  // - หมวดมาเลย์: ขอบการ์ดสีส้มเรืองแสงตามรูปเรฟ
  const renderLotteryCard = (item: LotteryItem, isMalayOrange: boolean = false) => {
    const info = getClosingInfo(item);
    const isMalayCard = isMalayOrange || item.category === 'malay';

    return (
      <Link
        key={item.id}
        to={item.path}
        className={`rounded-lg overflow-hidden flex flex-col justify-between transition-all duration-150 group shadow-sm text-slate-800 ${
          isMalayCard
            ? 'border-2 border-orange-500 bg-white shadow-[0_0_12px_rgba(249,115,22,0.45)] hover:shadow-[0_0_18px_rgba(249,115,22,0.65)] hover:scale-[1.01]'
            : 'border border-slate-200 bg-white hover:border-cyan-400 hover:shadow-md hover:scale-[1.01]'
        }`}
      >
        {/* Header แถวบน: ด้านซ้ายธงชาติ/โลโก้, ด้านขวาป้ายชื่อหวย */}
        <div className={`px-2 py-1.5 flex items-center justify-between gap-1.5 border-b border-slate-100 ${isMalayCard ? 'bg-slate-50' : 'bg-white'}`}>
          {/* ฝั่งซ้าย: ธง หรือ โลโก้ */}
          <div className="shrink-0 flex items-center">
            {item.id === 'หวย-MagNum 4D' ? (
              <div className="w-7 h-5 sm:w-8 sm:h-5 bg-black rounded flex items-center justify-center border border-amber-400 font-black text-amber-400 text-[10px] tracking-tighter shadow-sm">
                M
              </div>
            ) : item.id === 'หวย Grand Dragon Lotto' ? (
              <div className="w-7 h-5 sm:w-8 sm:h-5 bg-red-700 rounded flex items-center justify-center border border-amber-400 font-black text-amber-300 text-[9px] shadow-sm">
                GD
              </div>
            ) : item.id === 'หวย Singapore 4D' ? (
              <div className="w-7 h-5 sm:w-8 sm:h-5 bg-blue-700 rounded flex items-center justify-center border border-cyan-300 font-black text-white text-[9px] shadow-sm">
                SG
              </div>
            ) : item.flagUrl ? (
              <img
                src={item.flagUrl}
                alt=""
                className="w-6 h-4 sm:w-7 sm:h-5 object-cover rounded shadow-sm border border-slate-200"
              />
            ) : (
              <span className="text-base">🎯</span>
            )}
          </div>

          {/* ฝั่งขวา: ชื่อหวย */}
          <div className="text-right truncate flex justify-end">
            {item.isThaiGov ? (
              <span className="bg-red-600 text-white font-black text-[10px] sm:text-xs px-2 py-0.5 rounded shadow-sm tracking-tight truncate">
                {item.name}
              </span>
            ) : isMalayCard ? (
              <span className="bg-[#0b1b4f] text-white font-bold text-[10px] sm:text-xs px-2 py-0.5 rounded shadow-sm tracking-tight truncate">
                {item.name}
              </span>
            ) : (
              <span className="text-slate-800 font-bold text-[11px] sm:text-xs tracking-tight truncate">
                {item.name}
              </span>
            )}
          </div>
        </div>

        {/* ตัวการ์ดกลาง: วันและเวลา */}
        <div className="py-2.5 px-1 text-center bg-white flex flex-col justify-center items-center">
          <div className="text-[10px] sm:text-[11px] font-mono text-slate-600 tracking-tight truncate">
            {info.dateTimeStr}
          </div>
        </div>

        {/* ท้ายการ์ด: สถานะ ปิดรับแทง / เปิดรับแทง */}
        <div className="border-t border-slate-100">
          {info.isOpen ? (
            <div className="bg-emerald-600 text-white font-bold text-[10px] sm:text-xs py-1 px-1 text-center flex items-center justify-center gap-1 shadow-inner">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
              <span>เปิดรับ ({info.countdownText})</span>
            </div>
          ) : (
            <div className="bg-slate-100 text-slate-600 font-bold text-[10px] sm:text-xs py-1 px-1 text-center">
              ปิดรับแทง
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060c2b] via-[#09123f] to-[#04081c] text-white pb-24 px-2 sm:px-4 md:px-6 pt-4 font-sans">
      
      {/* Container หลัก: จำกัดความกว้าง */}
      <div className="max-w-6xl mx-auto space-y-8">

        {/* รายการกล่องหวยตามหมวดหมู่ พร้อมกรอบนีออนฟ้าเรืองแสง และแท็บทางลัดด้านบน */}
        {displayedCategories.map((group) => (
          <div key={group.id} id={`group-${group.id}`} className="space-y-0">
            
            {/* แถบแท็บทางลัด 5 ตัวเลือก เหนือกรอบนีออน (ตรงตามรูปเรฟเป๊ะ) */}
            <div className="flex justify-center -mb-2.5 z-10 relative">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none px-2 py-0.5 touch-pan-x">
                {FRAME_SHORTCUT_TABS.map(tab => {
                  const isActive = (group.id === tab.id);
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleShortcutClick(tab.id)}
                      className={`text-xs font-bold px-3 sm:px-3.5 py-1 rounded-t-md transition shadow active:scale-95 whitespace-nowrap ${
                        isActive
                          ? 'bg-red-600 text-white shadow-md'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* กรอบนีออนฟ้าเรืองแสง คมชัด สไตล์ AK88 */}
            <div className="border-2 border-cyan-400 rounded-xl sm:rounded-2xl shadow-[0_0_24px_rgba(6,182,212,0.65)] bg-[#030c2e] p-3 sm:p-5 relative transition-all space-y-3.5 sm:space-y-4">
              
              {/* แถบหัวด้านใน: ซ้าย 🔄, กลาง ชื่อกลุ่ม (+ ป้ายแดงถ้ามี), ขวา ย้อนกลับ */}
              <div className="flex items-center justify-between pb-1 gap-2">
                {/* ซ้าย: ปุ่ม 🔄 รีโหลด */}
                <button
                  type="button"
                  onClick={handleReload}
                  className="bg-blue-600 hover:bg-blue-500 text-white w-8 h-8 rounded-md flex items-center justify-center shadow transition active:scale-95 shrink-0"
                  title="รีโหลดสถานะ"
                >
                  <span className="material-symbols-outlined text-lg">sync</span>
                </button>

                {/* กลาง: ชื่อกลุ่ม */}
                <div className="flex items-center justify-center gap-2">
                  <h3 className="text-white font-black text-base sm:text-lg md:text-xl tracking-wide flex items-center">
                    {group.title}
                    {group.subtitleBadge && (
                      <span className="bg-red-600 text-white font-black text-[11px] sm:text-xs px-2 py-0.5 rounded shadow ml-2">
                        {group.subtitleBadge}
                      </span>
                    )}
                  </h3>
                </div>

                {/* ขวา: ปุ่ม ย้อนกลับ สีแดง */}
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm px-3 sm:px-4 py-1.5 rounded-md shadow transition active:scale-95 shrink-0"
                >
                  ย้อนกลับ
                </button>
              </div>

              {/* กรณีหวยยี่กี: แบนเนอร์แสดงรอบสดและปุ่มกระดาน 88 รอบ */}
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
                    type="button"
                    onClick={() => navigate('/lottery/yeekee')}
                    className="w-full md:w-auto bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 hover:brightness-110 text-white font-black text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition active:scale-95 whitespace-nowrap"
                  >
                    <span>เข้าสู่กระดาน 88 รอบสด</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              )}

              {/* Grid การ์ดหวย: มือถือ 2 คอลัมน์ (ซ้ายขวา ซ้ายขวา), จอคอม 4 คอลัมน์ */}
              {group.items.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3.5 pt-1">
                  {group.items.map(item => renderLotteryCard(item, group.isMalayOrange))}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs font-bold">
                  ไม่มีรายการหวยที่เปิดรับในกลุ่มนี้ขณะนี้
                </div>
              )}
            </div>
          </div>
        ))}

        {displayedCategories.length === 0 && (
          <div className="border-2 border-cyan-400 rounded-2xl bg-[#030c2e] p-12 text-center text-slate-400 font-bold text-sm shadow-[0_0_20px_rgba(6,182,212,0.5)]">
            ไม่พบรายการหวยในหมวดหมู่ที่เลือก
          </div>
        )}

      </div>
    </div>
  );
}
