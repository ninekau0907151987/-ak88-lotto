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

interface DisplayLotteryItem {
  id: string;
  name: string;
  category: LotteryCategoryKey;
  icon: string;
  path: string;
  bgGradient: string;
  isOpen: boolean;
  isHidden: boolean;
  closeTime: string | null;
}

export default function LotteryList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = (searchParams.get('category') as LotteryCategoryKey) || 'all';

  const [selectedCategory, setSelectedCategory] = useState<LotteryCategoryKey>(initialCategory);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lotteryTypes, setLotteryTypes] = useState<any[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Fetch Lottery Types in real-time from Firestore
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

  // Sync category filter with URL query param if present
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

  // Mock default closing times
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(15, 20, 0);
    return d.toISOString();
  }, []);

  const todayEvening = useMemo(() => {
    const d = new Date();
    d.setHours(18, 0, 0);
    return d.toISOString();
  }, []);

  // Merge Master Catalog with custom items from Firestore
  const mergedLotteries = useMemo<DisplayLotteryItem[]>(() => {
    const map = new Map<string, DisplayLotteryItem>();

    // 1. Populate from Master Catalog
    MASTER_LOTTERY_CATALOG.forEach(master => {
      // Find matching Firestore config if exists
      const config = lotteryTypes.find(l => l.name === master.name || l.id === master.name);
      const cat = getLotteryCategory(master.name, config?.category || master.category);
      
      let defaultClose = todayEvening;
      if (cat === 'thai') defaultClose = tomorrow;
      if (cat === 'yeekee') defaultClose = null;

      map.set(master.name, {
        id: master.name,
        name: master.name,
        category: cat,
        icon: master.icon,
        path: master.path,
        bgGradient: master.bgGradient,
        isOpen: config ? config.isOpen !== false : true,
        isHidden: config ? config.isHidden === true : false,
        closeTime: config?.closeTime || defaultClose,
      });
    });

    // 2. Populate any additional lotteries created via Admin panel
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
          closeTime: custom.closeTime || todayEvening,
        });
      }
    });

    return Array.from(map.values()).filter(item => !item.isHidden);
  }, [lotteryTypes, tomorrow, todayEvening]);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: mergedLotteries.length };
    LOTTERY_CATEGORIES.forEach(c => {
      if (c.id !== 'all') {
        counts[c.id] = mergedLotteries.filter(l => l.category === c.id).length;
      }
    });
    return counts;
  }, [mergedLotteries]);

  // Filtered by selected category and search term
  const filteredLotteries = useMemo(() => {
    return mergedLotteries.filter(item => {
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch = !searchTerm.trim() || item.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [mergedLotteries, selectedCategory, searchTerm]);

  // Helper to format countdown
  const getCountdown = (closeTimeStr: string | null) => {
    if (!closeTimeStr) return 'เปิดรับแทงตลอด';
    const closeTime = new Date(closeTimeStr).getTime();
    const now = currentTime.getTime();
    const diff = closeTime - now;
    
    if (diff <= 0) return 'ปิดรับแทง';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (days > 0) {
      return `${days} วัน ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isThaiLottery = (item: DisplayLotteryItem) => 
    item.category === 'thai' || item.name.includes('รัฐบาล') || item.name.includes('ไทย');

  const thaiLottery = useMemo(() => {
    return mergedLotteries.find(isThaiLottery);
  }, [mergedLotteries]);

  const renderCard = (item: DisplayLotteryItem) => {
    const isClosed = !item.isOpen || (item.closeTime && new Date(item.closeTime).getTime() <= currentTime.getTime());
    const isThai = isThaiLottery(item);
    
    if (isClosed) {
      return (
        <div 
          key={item.id} 
          className="bg-gradient-to-b from-[#4a4a4a] to-[#2d3436] rounded-xl shadow-md overflow-hidden flex flex-col text-white opacity-85 border border-white/5"
        >
          <div className="py-2.5 text-center text-sm font-bold tracking-wider flex items-center justify-center gap-1 text-rose-300 bg-black/20">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            ปิดรับแทงชั่วคราว
          </div>
          <div className="bg-black/10 py-3 text-center text-base font-black flex items-center justify-center gap-2 px-2">
            <span className="text-xl">{item.icon}</span> 
            <span className="truncate">{item.name}</span>
          </div>
          <div className="bg-black/40 py-1.5 text-center text-[11px] text-gray-400">
            เปิดแทง 0 รอบ
          </div>
        </div>
      );
    }

    return (
      <Link 
        key={item.id}
        to={item.path} 
        className={`${item.bgGradient} rounded-xl shadow-lg overflow-hidden flex flex-col text-white hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border ${
          isThai 
            ? 'border-2 border-red-500 shadow-red-500/30 ring-2 ring-red-500/20 relative' 
            : 'border-white/10'
        } group`}
      >
        {isThai && (
          <div className="absolute top-1 right-1 z-10 bg-gradient-to-r from-red-600 to-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow flex items-center gap-0.5 animate-pulse">
            <span>⭐ หวยเด่น</span>
          </div>
        )}

        {/* Countdown Header */}
        <div className={`py-2.5 text-center text-sm sm:text-base font-black tracking-wider flex items-center justify-center gap-1.5 transition ${
          isThai 
            ? 'bg-gradient-to-r from-red-950/80 via-black/50 to-red-950/80 border-b border-red-500/40 text-red-500' 
            : 'bg-black/15 group-hover:bg-black/25 text-white'
        }`}>
          {isThai ? (
            <>
              {/* โลโก้เล็กหมุนด้านใน */}
              <div className="w-4 h-4 rounded-full border border-dashed border-red-500 animate-spin flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[10px] text-red-500">rotate_right</span>
              </div>
              {/* ตัวอักษร สี แดง กำลังนับถอยหลัง */}
              <div className="text-red-500 font-black tracking-wider flex items-center gap-1 animate-pulse">
                <span className="text-[11px] font-bold text-red-400">กำลังนับถอยหลัง:</span>
                <span className="font-mono text-sm sm:text-base text-red-500 font-black">
                  {getCountdown(item.closeTime)}
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm text-yellow-300">timer</span>
              {getCountdown(item.closeTime)}
            </>
          )}
        </div>

        {/* Title and Icon */}
        <div className="bg-black/10 py-3 text-center text-base font-black flex items-center justify-center gap-2 px-2">
          {isThai ? (
            <div className="relative flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-dashed border-red-500 animate-[spin_5s_linear_infinite]" />
              <span className="absolute text-xl">🇹🇭</span>
            </div>
          ) : (
            <span className="text-xl filter drop-shadow">{item.icon}</span>
          )}
          <span className={`truncate ${isThai ? 'text-yellow-300 font-black drop-shadow' : ''}`}>{item.name}</span>
        </div>

        <div className={`py-1.5 text-center text-[11px] ${isThai ? 'bg-black/40 text-amber-200/90 font-bold' : 'bg-black/25 text-white/90'}`}>
          {item.closeTime ? `ปิดรับ ${new Date(item.closeTime).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'เปิดรับแทง 24 ชม.'}
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
        
        {/* Search Bar & Stats */}
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
            <span>ทั้งหมด: <strong className="text-amber-400">{filteredLotteries.length}</strong> รายการ</span>
          </div>
        </div>

        {/* Category Filter Tabs */}
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

        {/* Featured Thai Lottery Spotlight Banner */}
        {thaiLottery && (selectedCategory === 'all' || selectedCategory === 'thai') && !searchTerm && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2a080f] via-[#111722] to-[#2a080f] border-2 border-red-500/70 p-4 sm:p-5 shadow-2xl shadow-red-500/20">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 w-full md:w-auto">
                {/* โลโก้เล็กหมุนด้านใน */}
                <div className="relative w-12 h-12 md:w-14 md:h-14 flex items-center justify-center shrink-0">
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-red-500 animate-[spin_4s_linear_infinite]" />
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-tr from-red-600 via-amber-500 to-red-700 flex items-center justify-center shadow-lg">
                    <span className="text-lg md:text-xl">🇹🇭</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-gradient-to-r from-red-600 to-amber-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                      ⭐ หวยเด่น ยอดนิยมอันดับ 1
                    </span>
                    <span className="text-xs text-amber-400 font-bold">อัตราจ่ายสูงสุด 900 บาท</span>
                  </div>
                  <h2 className="text-white font-black text-lg sm:text-xl mt-1 tracking-wide">
                    หวยรัฐบาลไทย (สลากกินแบ่งรัฐบาล)
                  </h2>
                </div>
              </div>

              {/* กล่องตัวอักษรสีแดง กำลังนับถอยหลัง */}
              <div className="flex items-center gap-3 bg-red-950/60 border border-red-500/50 px-4 py-2.5 rounded-xl w-full md:w-auto justify-center md:justify-start">
                {/* โลโก้เล็กหมุนด้านใน */}
                <div className="w-5 h-5 rounded-full border border-dashed border-red-400 animate-spin flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xs text-red-400">autorenew</span>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-red-400">กำลังนับถอยหลัง:</div>
                  <div className="text-red-500 font-black text-base sm:text-lg font-mono tracking-wider animate-pulse">
                    {getCountdown(thaiLottery.closeTime)}
                  </div>
                </div>
              </div>

              <Link
                to={thaiLottery.path}
                className="w-full md:w-auto bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:brightness-110 text-white font-black text-sm px-6 py-3 rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition active:scale-95 shrink-0"
              >
                <span>แทงหวยรัฐบาล</span>
                <span className="material-symbols-outlined text-sm font-bold">arrow_forward</span>
              </Link>
            </div>
          </div>
        )}

        {/* Lottery Cards Grid */}
        {filteredLotteries.length === 0 ? (
          <div className="text-center py-16 bg-[#161b22] rounded-2xl border border-dashed border-gray-800">
            <span className="material-symbols-outlined text-5xl text-gray-600 mb-2">search_off</span>
            <p className="text-gray-400 font-bold text-sm">ไม่พบรายการหวยที่ค้นหา</p>
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
            {filteredLotteries.map(item => renderCard(item))}
          </div>
        )}

      </div>
    </div>
  );
}
