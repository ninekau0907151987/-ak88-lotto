import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';
import { 
  LOTTERY_CATEGORIES, 
  MASTER_LOTTERY_CATALOG, 
  LotteryCategoryKey, 
  getLotteryCategory 
} from '@/shared/lib/lotteryCatalog';

export type LotteryStatus = 'open' | 'waiting_result' | 'upcoming' | 'closed';

interface ProcessedLotteryItem {
  id: string;
  name: string;
  category: LotteryCategoryKey;
  icon: string;
  path: string;
  bgGradient: string;
  status: LotteryStatus;
  countdownText: string;
  footerText: string;
  sortScore: number;
}

// ตารางเวลาเปิด-ปิดรับแทงมาตรฐานรายวัน (สำหรับหวยต่างประเทศและหุ้น)
const STANDARD_LOTTERY_SCHEDULES: Record<string, { open: string; close: string }> = {
  // --- 1. หวยฮานอย ---
  'ฮานอย(HD)': { open: '06:00', close: '11:15' },
  'ฮานอยสตาร์': { open: '06:00', close: '12:15' },
  'ฮานอยTV': { open: '06:00', close: '14:15' },
  'ฮานอยกาชาด': { open: '06:00', close: '16:15' },
  'ฮานอยพิเศษ': { open: '06:00', close: '17:00' },
  'หวยฮานอย': { open: '06:00', close: '18:00' },
  'ฮานอยสามัคคี': { open: '06:00', close: '17:15' },
  'ฮานอย(VIP)': { open: '06:00', close: '19:00' },
  'ฮานอย(EXTRA)': { open: '06:00', close: '22:15' },
  'หวยฮานอยชุด': { open: '06:00', close: '18:00' },

  // --- 2. หวยลาว ---
  'หวยลาวประตูชัย': { open: '06:00', close: '08:45' },
  'หวยลาวสันติภาพ': { open: '06:00', close: '09:45' },
  'หวยประชาชนลาว': { open: '06:00', close: '10:45' },
  'ลาว(EXTRA)': { open: '06:00', close: '11:15' },
  'หวยลาวTV': { open: '06:00', close: '13:15' },
  'หวยลาวHD': { open: '06:00', close: '14:45' },
  'หวยลาวสตาร์': { open: '06:00', close: '15:45' },
  'ลาว VIP': { open: '06:00', close: '20:15' },
  'หวยลาวสตาร์(VIP)': { open: '06:00', close: '21:45' },
  'ลาวกาชาด': { open: '06:00', close: '23:15' },
  'หวยลาวพัฒนาชุด': { open: '06:00', close: '20:00' },

  // --- 3. หวยหุ้น VIP & หุ้นรอบวัน ---
  'นิเคอิ VIP (เช้า)': { open: '06:00', close: '09:20' },
  'หุ้นนิเคอิรอบเช้า': { open: '06:00', close: '09:20' },
  'จีน VIP (เช้า)': { open: '06:00', close: '10:20' },
  'จีนรอบเช้า': { open: '06:00', close: '10:20' },
  'ฮั่งเส็ง VIP (เช้า)': { open: '06:00', close: '10:50' },
  'ฮั่งเส็งรอบเช้า': { open: '06:00', close: '10:50' },
  'ไต้หวัน VIP': { open: '06:00', close: '12:20' },
  'หุ้นไต้หวัน': { open: '06:00', close: '12:20' },
  'เกาหลี VIP': { open: '06:00', close: '12:50' },
  'หุ้นเกาหลี': { open: '06:00', close: '12:50' },
  'นิเคอิ VIP (บ่าย)': { open: '06:00', close: '12:50' },
  'นิเคอิปิดบ่าย': { open: '06:00', close: '12:50' },
  'จีน VIP (บ่าย)': { open: '06:00', close: '13:50' },
  'จีนปิดรอบบ่าย': { open: '06:00', close: '13:50' },
  'ฮั่งเส็ง VIP (บ่าย)': { open: '06:00', close: '14:50' },
  'ฮั่งเส็งปิดบ่าย': { open: '06:00', close: '14:50' },
  'สิงคโปร์ VIP': { open: '06:00', close: '15:50' },
  'หุ้นสิงคโปร์': { open: '06:00', close: '15:50' },
  'หุ้นไทยปิดเย็น': { open: '06:00', close: '16:20' },
  'หุ้นอินเดีย': { open: '06:00', close: '16:40' },
  'เวียดนาม VIP (เช้า)': { open: '06:00', close: '09:00' },
  'เวียดนาม VIP (บ่าย)': { open: '06:00', close: '13:00' },
  'เวียดนาม VIP (เย็น)': { open: '06:00', close: '16:30' },
  'หุ้นอียิปต์': { open: '06:00', close: '18:50' },
  'อังกฤษ(VIP)': { open: '06:00', close: '22:20' },
  'หุ้นอังกฤษ': { open: '06:00', close: '22:20' },
  'เยอรมัน(VIP)': { open: '06:00', close: '22:20' },
  'หุ้นเยอรมัน': { open: '06:00', close: '22:20' },
  'รัสเซีย(VIP)': { open: '06:00', close: '22:30' },
  'หุ้นรัสเซีย': { open: '06:00', close: '22:30' },
  'ดาวน์โจนส์(VIP)': { open: '18:00', close: '03:00' },
  'หุ้นดาวน์โจนส์': { open: '18:00', close: '03:00' },
  'ดาวน์โจนส์ TV': { open: '18:00', close: '03:30' },
  'ดาวน์โจนส์ STAR': { open: '18:00', close: '04:00' },
  'ดาวน์โจนส์ MIDNIGHT': { open: '18:00', close: '00:00' },
  'ดาวน์โจนส์ EXTRA': { open: '18:00', close: '01:30' },
  'หวยมาเลย์': { open: '06:00', close: '18:00' },
};

function formatDuration(diffMs: number): string {
  if (diffMs <= 0) return '00:00:00';
  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) {
    return `${days} วัน ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function LotteryList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = (searchParams.get('category') as LotteryCategoryKey) || 'all';

  const [selectedCategory, setSelectedCategory] = useState<LotteryCategoryKey>(initialCategory);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lotteryTypes, setLotteryTypes] = useState<any[]>([]);

  // อัปเดตเวลานับถอยหลังทุก 1 วินาที
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // ดึงข้อมูลประเภทหวยจาก Firestore แบบ Real-time
    const qLottery = query(collection(db, 'lotteryTypes'));
    const unsubLottery = onSnapshot(qLottery, (snap) => {
      setLotteryTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.warn('Could not subscribe to lotteryTypes:', error);
    });

    return () => {
      clearInterval(timer);
      unsubLottery();
    };
  }, []);

  // ซิงค์หมวดหมู่กับ URL Query
  useEffect(() => {
    const catParam = searchParams.get('category') as LotteryCategoryKey;
    if (catParam && catParam !== selectedCategory) {
      setSelectedCategory(catParam);
    }
  }, [searchParams]);

  const handleCategoryChange = (cat: LotteryCategoryKey) => {
    setSelectedCategory(cat);
    if (cat === 'all') {
      searchParams.delete('category');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ category: cat });
    }
  };

  // รวมรายการ Master Catalog กับ Firestore
  const rawLotteries = useMemo(() => {
    const map = new Map<string, any>();

    // 1. นำข้อมูลจาก Master Catalog
    MASTER_LOTTERY_CATALOG.forEach(master => {
      const config = lotteryTypes.find(l => l.name === master.name || l.id === master.name);
      const cat = getLotteryCategory(master.name, config?.category || master.category);
      map.set(master.name, {
        id: master.name,
        name: master.name,
        category: cat,
        icon: master.icon,
        path: master.path,
        bgGradient: master.bgGradient,
        isOpen: config ? config.isOpen !== false : true,
        isHidden: config ? config.isHidden === true : false,
        config: config || null,
      });
    });

    // 2. นำข้อมูลที่เพิ่มใหม่จากแอดมินใน Firestore
    lotteryTypes.forEach(custom => {
      const name = custom.name || custom.id;
      if (!name) return;
      if (!map.has(name)) {
        const cat = getLotteryCategory(name, custom.category);
        let path = `/lottery/${encodeURIComponent(name)}`;
        let icon = '🎯';
        let gradient = 'bg-gradient-to-b from-[#8e44ad] to-[#2c3e50]';

        if (cat === 'thai') {
          icon = '🇹🇭';
          gradient = 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]';
        } else if (cat === 'yeekee') {
          icon = '⏱️';
          path = '/lottery/yeekee';
          gradient = 'bg-gradient-to-b from-[#f39c12] to-[#d35400]';
        } else if (cat === 'foreign') {
          icon = '🌏';
          gradient = 'bg-gradient-to-b from-[#3498db] to-[#2980b9]';
        } else if (cat === 'stock') {
          icon = '📈';
          path = `/lottery/stock/${encodeURIComponent(name)}`;
          gradient = 'bg-gradient-to-b from-[#e74c3c] to-[#c0392b]';
        } else if (cat === 'set') {
          icon = '🎁';
          path = '/lottery/set';
          gradient = 'bg-gradient-to-b from-[#00b4d8] to-[#0077b6]';
        }

        map.set(name, {
          id: custom.id || name,
          name: name,
          category: cat,
          icon: custom.icon || icon,
          path: path,
          bgGradient: gradient,
          isOpen: custom.isOpen !== false,
          isHidden: custom.isHidden === true,
          config: custom,
        });
      }
    });

    return Array.from(map.values());
  }, [lotteryTypes]);

  // ประมวลผลสถานะตามเวลา (Time-Driven Status & Sorting)
  const processedLotteries = useMemo<ProcessedLotteryItem[]>(() => {
    const now = currentTime.getTime();

    return rawLotteries.map(item => {
      const cfg = item.config;

      // 1. ถ้าปิดรับแทงจากระบบ หรือถูกสั่งซ่อน -> สถานะ closed (ปิดไม่แสดงเลย)
      if (item.isOpen === false || item.isHidden === true || cfg?.isOpen === false) {
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          icon: item.icon,
          path: item.path,
          bgGradient: item.bgGradient,
          status: 'closed' as LotteryStatus,
          countdownText: '',
          footerText: 'ปิดรับแทง',
          sortScore: 999999,
        };
      }

      // 2. หวยยี่กี -> เปิดตลอด 24 ชม.
      if (item.category === 'yeekee' || item.name.includes('ยี่กี')) {
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          icon: item.icon,
          path: item.path,
          bgGradient: item.bgGradient,
          status: 'open' as LotteryStatus,
          countdownText: 'เปิดรับแทงตลอด',
          footerText: 'เปิดแทง 24 ชม.',
          sortScore: 500, // เปิดรอบ อยู่ด้านหน้า
        };
      }

      // 3. หวยที่มีการกำหนดเวลาใน Firestore (closeTime / openTime)
      if (cfg?.closeTime || cfg?.closingTime) {
        const closeTimeMs = new Date(cfg.closeTime || cfg.closingTime).getTime();
        const openTimeMs = cfg.openTime ? new Date(cfg.openTime).getTime() : 0;
        const isSettled = cfg.isSettled === true;

        if (isSettled) {
          return {
            id: item.id,
            name: item.name,
            category: item.category,
            icon: item.icon,
            path: item.path,
            bgGradient: item.bgGradient,
            status: 'closed' as LotteryStatus,
            countdownText: '',
            footerText: 'ออกผลรางวัลแล้ว',
            sortScore: 999999,
          };
        }

        // ยังไม่ถึงเวลาเปิด
        if (openTimeMs > 0 && now < openTimeMs) {
          const diff = openTimeMs - now;
          return {
            id: item.id,
            name: item.name,
            category: item.category,
            icon: item.icon,
            path: item.path,
            bgGradient: item.bgGradient,
            status: 'upcoming' as LotteryStatus,
            countdownText: formatDuration(diff),
            footerText: `เปิดรับ ${new Date(openTimeMs).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`,
            sortScore: 3000 + diff / 1000,
          };
        }

        // กำลังเปิดรับแทง
        if (now < closeTimeMs) {
          const diff = closeTimeMs - now;
          return {
            id: item.id,
            name: item.name,
            category: item.category,
            icon: item.icon,
            path: item.path,
            bgGradient: item.bgGradient,
            status: 'open' as LotteryStatus,
            countdownText: formatDuration(diff),
            footerText: `ปิดรับ ${new Date(closeTimeMs).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
            sortScore: 100 + diff / 1000, // ใกล้ปิดที่สุด อยู่หน้าสุด
          };
        }

        // ถึงเวลาปิดแล้วแต่ยังไม่ออกผล -> รอผล
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          icon: item.icon,
          path: item.path,
          bgGradient: item.bgGradient,
          status: 'waiting_result' as LotteryStatus,
          countdownText: '',
          footerText: 'ปิดรับแล้ว • รอผลรางวัล',
          sortScore: 2000,
        };
      }

      // 4. หวยไทย / ธนาคาร (หวยธกส., หวยออมสิน)
      if (item.category === 'thai') {
        const tomorrow1520 = new Date(currentTime);
        tomorrow1520.setDate(tomorrow1520.getDate() + 1);
        tomorrow1520.setHours(15, 20, 0, 0);
        const diff = tomorrow1520.getTime() - now;

        return {
          id: item.id,
          name: item.name,
          category: item.category,
          icon: item.icon,
          path: item.path,
          bgGradient: item.bgGradient,
          status: 'open' as LotteryStatus,
          countdownText: formatDuration(diff),
          footerText: `ปิดรับ ${tomorrow1520.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })} 15:20`,
          sortScore: 150 + diff / 1000,
        };
      }

      // 5. หวยรายวันตามตารางมาตรฐาน (ฮานอย, ลาว, หวยหุ้น)
      const sched = STANDARD_LOTTERY_SCHEDULES[item.name] || { open: '06:00', close: '18:00' };
      const [hOpen, mOpen] = sched.open.split(':').map(Number);
      const [hClose, mClose] = sched.close.split(':').map(Number);

      const openDate = new Date(currentTime);
      openDate.setHours(hOpen, mOpen, 0, 0);

      const closeDate = new Date(currentTime);
      closeDate.setHours(hClose, mClose, 0, 0);

      // กรณีข้ามวัน เช่น ดาวน์โจนส์ เปิด 18:00 ปิด 03:00 วันรุ่งขึ้น
      if (hClose < hOpen) {
        if (currentTime.getHours() >= hOpen) {
          closeDate.setDate(closeDate.getDate() + 1);
        } else {
          openDate.setDate(openDate.getDate() - 1);
        }
      }

      const openTimeMs = openDate.getTime();
      const closeTimeMs = closeDate.getTime();

      // A: เปิดแต่ไม่ถึงเวลา (เวลาก่อนเวลาเปิด) -> เทามีเวลาถอยหลัง เวลาสีแดง
      if (now < openTimeMs) {
        const diff = openTimeMs - now;
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          icon: item.icon,
          path: item.path,
          bgGradient: item.bgGradient,
          status: 'upcoming' as LotteryStatus,
          countdownText: formatDuration(diff),
          footerText: `เปิดรับ ${sched.open} น.`,
          sortScore: 3000 + diff / 1000,
        };
      }

      // B: เปิดรอบ (ถึงเวลาเปิดแล้ว และยังไม่ถึงเวลาปิด) -> มีสี มีเวลา จัดเรียงอยู่ด้านหน้า
      if (now >= openTimeMs && now < closeTimeMs) {
        const diff = closeTimeMs - now;
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          icon: item.icon,
          path: item.path,
          bgGradient: item.bgGradient,
          status: 'open' as LotteryStatus,
          countdownText: formatDuration(diff),
          footerText: `ปิดรับ ${sched.close} น.`,
          sortScore: 100 + diff / 1000, // ปิดเร็วสุดเรียงอยู่หน้าสุด
        };
      }

      // C: รอผล (หลังปิดรับแทงไม่เกิน 60 นาที) -> ขึ้น รอผล เท่านั้น
      const waitingWindowMs = 60 * 60 * 1000;
      if (now >= closeTimeMs && now < closeTimeMs + waitingWindowMs) {
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          icon: item.icon,
          path: item.path,
          bgGradient: item.bgGradient,
          status: 'waiting_result' as LotteryStatus,
          countdownText: '',
          footerText: 'ปิดรับแล้ว • รอผลรางวัล',
          sortScore: 2000,
        };
      }

      // D: หมดรอบของวันนี้แล้ว -> รอเปิดรอบวันพรุ่งนี้
      const nextOpenDate = new Date(openDate);
      nextOpenDate.setDate(nextOpenDate.getDate() + 1);
      const diffNext = nextOpenDate.getTime() - now;

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        icon: item.icon,
        path: item.path,
        bgGradient: item.bgGradient,
        status: 'upcoming' as LotteryStatus,
        countdownText: formatDuration(diffNext),
        footerText: `เปิดรับพรุ่งนี้ ${sched.open} น.`,
        sortScore: 3000 + diffNext / 1000,
      };
    });
  }, [rawLotteries, currentTime]);

  // คำนวณจำนวนหวยในแต่ละหมวดหมู่ (นับเฉพาะที่ไม่ปิด: "ปิดไม่แสดงเลย")
  const categoryCounts = useMemo(() => {
    const activeLotteries = processedLotteries.filter(l => l.status !== 'closed');
    const counts: Record<string, number> = { all: activeLotteries.length };
    LOTTERY_CATEGORIES.forEach(c => {
      if (c.id !== 'all') {
        counts[c.id] = activeLotteries.filter(l => l.category === c.id).length;
      }
    });
    return counts;
  }, [processedLotteries]);

  // กรองและจัดเรียง:
  // 1. ปิดไม่แสดงเลย (filter status !== 'closed')
  // 2. จัดเรียง: เปิดรอบอยู่ด้านหน้า (ใกล้ปิดสุดขึ้นก่อน) -> รอผล -> เปิดแต่ไม่ถึงเวลา
  const displayedLotteries = useMemo(() => {
    return processedLotteries
      .filter(item => item.status !== 'closed') // ปิดไม่แสดงเลย
      .filter(item => {
        const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
        const matchSearch = !searchTerm.trim() || item.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
        return matchCategory && matchSearch;
      })
      .sort((a, b) => a.sortScore - b.sortScore); // จัดเรียงตามลำดับเวลา
  }, [processedLotteries, selectedCategory, searchTerm]);

  // เรนเดอร์การ์ดตามสถานะที่กำหนด
  const renderCard = (item: ProcessedLotteryItem) => {
    // -------------------------------------------------------------
    // สถานะที่ 1: รอผล (ขึ้น รอผล เท่านั้น)
    // -------------------------------------------------------------
    if (item.status === 'waiting_result') {
      return (
        <div 
          key={item.id} 
          className="bg-gradient-to-b from-[#2d2218] via-[#1f1913] to-[#120f0d] rounded-xl shadow-md overflow-hidden flex flex-col text-white border border-amber-500/40 relative"
        >
          {/* หัวการ์ด: ขึ้น รอผล เท่านั้น (ไม่มีเวลานับถอยหลัง) */}
          <div className="py-2.5 text-center text-xs sm:text-sm font-black tracking-wider flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-black shadow-inner">
            <span className="material-symbols-outlined text-[16px] animate-spin">hourglass_top</span>
            <span className="text-sm font-black tracking-wide">รอผล</span>
          </div>

          <div className="bg-black/20 py-3 text-center text-base font-black flex items-center justify-center gap-2 px-2 text-amber-200">
            <span className="text-xl filter drop-shadow">{item.icon}</span> 
            <span className="truncate">{item.name}</span>
          </div>

          <div className="py-1.5 text-center text-[11px] bg-black/40 text-amber-400/90 font-bold">
            {item.footerText}
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------
    // สถานะที่ 2: เปิดแต่ไม่ถึงเวลา (เทามีเวลาถอยหลัง เวลาสีแดง)
    // -------------------------------------------------------------
    if (item.status === 'upcoming') {
      return (
        <div 
          key={item.id} 
          className="bg-gradient-to-b from-[#374151] to-[#1f2937] rounded-xl shadow-md overflow-hidden flex flex-col text-gray-200 border border-gray-700/80"
        >
          {/* หัวการ์ด: เทามีเวลาถอยหลัง เวลาสีแดง */}
          <div className="py-2.5 text-center text-xs sm:text-sm font-black tracking-wider flex items-center justify-center gap-1.5 bg-black/40 border-b border-gray-700">
            <span className="text-[11px] font-bold text-gray-400">นับถอยหลัง:</span>
            <span className="font-mono text-sm sm:text-base text-red-500 font-black animate-pulse">
              {item.countdownText}
            </span>
          </div>

          <div className="bg-black/10 py-3 text-center text-base font-black flex items-center justify-center gap-2 px-2 text-gray-300">
            <span className="text-xl opacity-80">{item.icon}</span> 
            <span className="truncate">{item.name}</span>
          </div>

          <div className="py-1.5 text-center text-[11px] bg-black/30 text-gray-400 font-medium">
            {item.footerText}
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------
    // สถานะที่ 3: เปิดรอบ (มีสี มีเวลา จัดเรียงอยู่ด้านหน้า)
    // -------------------------------------------------------------
    return (
      <Link 
        key={item.id}
        to={item.path} 
        className={`${item.bgGradient} rounded-xl shadow-lg overflow-hidden flex flex-col text-white hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-white/10 group`}
      >
        {/* หัวการ์ด: มีเวลา */}
        <div className="py-2.5 text-center text-sm sm:text-base font-black tracking-wider flex items-center justify-center gap-1.5 bg-black/20 group-hover:bg-black/30 transition">
          <span className="material-symbols-outlined text-sm text-yellow-300">timer</span>
          <span className="font-mono text-yellow-300 font-black">{item.countdownText}</span>
        </div>

        {/* ชื่อหวยและไอคอน */}
        <div className="bg-black/10 py-3 text-center text-base font-black flex items-center justify-center gap-2 px-2">
          <span className="text-xl filter drop-shadow">{item.icon}</span>
          <span className="truncate">{item.name}</span>
        </div>

        {/* แถบระบุเวลาปิดรับ */}
        <div className="py-1.5 text-center text-[11px] bg-black/25 text-white/90 font-medium">
          {item.footerText}
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#0d1117] pb-24 font-sans text-gray-100">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-[#161b22] to-[#21262d] p-4 flex justify-between items-center border-b border-gray-800 sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-300 text-black flex items-center justify-center font-black shadow-md">
            AK
          </div>
          <div>
            <h1 className="text-white font-black text-base sm:text-lg leading-tight">แทงหวยออนไลน์</h1>
            <p className="text-[11px] text-gray-400">อัตราจ่ายสูงสุด บาทละ 900 จ่ายจริง รวดเร็ว</p>
          </div>
        </div>

        <button 
          onClick={() => navigate('/')}
          className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition border border-white/10"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          กลับหน้าหลัก
        </button>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto p-3 sm:p-5 space-y-4">
        
        {/* ค้นหาชื่อหวย & สถิติรายการ */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#161b22] p-3 rounded-2xl border border-gray-800">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อหวย เช่น ฮานอย, ลาว, ยี่กี, รัฐบาล..."
              className="w-full bg-[#0d1117] text-white pl-10 pr-4 py-2 rounded-xl text-xs sm:text-sm border border-gray-700 focus:outline-none focus:border-amber-400 transition"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          <div className="text-xs text-gray-400 flex items-center gap-2 justify-end px-2">
            <span>ทั้งหมด: <strong className="text-amber-400">{displayedLotteries.length}</strong> รายการ</span>
          </div>
        </div>

        {/* แถบหมวดหมู่หวย (Category Filter Tabs) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs font-bold">
          {LOTTERY_CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat.id;
            const count = categoryCounts[cat.id] || 0;

            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`whitespace-nowrap px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm ${
                  isActive 
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black scale-105 shadow-amber-500/20 shadow-lg' 
                    : 'bg-[#161b22] text-gray-300 hover:bg-[#21262d] border border-gray-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-black/20 text-black' : 'bg-gray-800 text-gray-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ตารางการ์ดหวย (Lottery Cards Grid) */}
        {displayedLotteries.length === 0 ? (
          <div className="text-center py-16 bg-[#161b22] rounded-2xl border border-dashed border-gray-800">
            <span className="material-symbols-outlined text-5xl text-gray-600 mb-2">search_off</span>
            <p className="text-gray-400 font-bold text-sm">ไม่พบรายการหวยที่เปิดรับในขณะนี้</p>
            <p className="text-gray-600 text-xs mt-1">ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่นดูนะคะ</p>
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="mt-3 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-xs font-bold hover:bg-amber-500/30 transition"
              >
                ล้างคำค้นหา
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {displayedLotteries.map(item => renderCard(item))}
          </div>
        )}

      </div>
    </div>
  );
}
