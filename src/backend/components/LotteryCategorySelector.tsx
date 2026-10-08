import React, { useState, useMemo } from 'react';
import {
  LOTTERY_CATEGORIES, MASTER_LOTTERY_CATALOG, getLotteryCategory,
  type LotteryCategoryKey
} from '@/shared/lib/lotteryCatalog';

interface Props {
  selectedLottery: string;
  onSelectLottery: (name: string) => void;
  lotterySettings?: Record<string, any>;
  className?: string;
  title?: string;
  allowAllOption?: boolean;
  allOptionLabel?: string;
  allOptionValue?: string;
  embedded?: boolean;
}

export default function LotteryCategorySelector({
  selectedLottery,
  onSelectLottery,
  lotterySettings = {},
  className = '',
  title = 'เลือกหมวดหมู่และประเภทหวย',
  allowAllOption = false,
  allOptionLabel = '⭐ ทุกหวยในระบบ (หวยทั้งหมด)',
  allOptionValue = 'all',
  embedded = false,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<LotteryCategoryKey>('thai');
  const [showOnlyOpen, setShowOnlyOpen] = useState(false);

  // Combine MASTER_LOTTERY_CATALOG with any dynamic lotteries in lotterySettings
  const allLotteries = useMemo(() => {
    const list: Array<{
      name: string;
      category: LotteryCategoryKey;
      icon: string;
      isOpen: boolean;
    }> = [];

    const catalogMap = new Map<string, typeof MASTER_LOTTERY_CATALOG[0]>();
    MASTER_LOTTERY_CATALOG.forEach(item => catalogMap.set(item.name, item));

    // 1. From lotterySettings (Database / Live state)
    const settingsKeys = Object.keys(lotterySettings);
    if (settingsKeys.length > 0) {
      settingsKeys.forEach(name => {
        // กรองหวยทดสอบ 44444 หรือตัวเลขทดสอบออกตามคำสั่งผู้ใช้
        if (name === '44444' || /^\d{4,}$/.test(name) || name.toLowerCase().includes('test')) return;
        const data = lotterySettings[name];
        const catalogItem = catalogMap.get(name);
        const category = getLotteryCategory(name, data?.category);
        const isOpen = Boolean(data?.isOpen && !data?.isPaused && data?.status !== 'closed');
        const icon = data?.icon || catalogItem?.icon || '🎯';
        list.push({ name, category, icon, isOpen });
      });
    } else {
      // Fallback: master catalog
      MASTER_LOTTERY_CATALOG.forEach(item => {
        list.push({
          name: item.name,
          category: item.category,
          icon: item.icon,
          isOpen: true,
        });
      });
    }

    // จัดเรียง: หวยธกส. อยู่ด้านหน้าสุดตามคำขอของผู้ใช้ และหวยเปิดอยู่ก่อน
    return list.sort((a, b) => {
      if (a.name.includes('ธกส') && !b.name.includes('ธกส')) return -1;
      if (!a.name.includes('ธกส') && b.name.includes('ธกส')) return 1;
      if (a.isOpen && !b.isOpen) return -1;
      if (!a.isOpen && b.isOpen) return 1;
      return a.name.localeCompare(b.name, 'th');
    });
  }, [lotterySettings]);

  // Count open and total per category
  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; open: number }> = {};
    LOTTERY_CATEGORIES.forEach(cat => {
      stats[cat.id] = { total: 0, open: 0 };
    });

    allLotteries.forEach(lotto => {
      if (stats[lotto.category]) {
        stats[lotto.category].total++;
        if (lotto.isOpen) stats[lotto.category].open++;
      }
      if (stats['all']) {
        stats['all'].total++;
        if (lotto.isOpen) stats['all'].open++;
      }
    });

    return stats;
  }, [allLotteries]);

  // Filtered sub-lotteries for the bottom small buttons
  const filteredSubLotteries = useMemo(() => {
    return allLotteries.filter(lotto => {
      // Filter by category
      if (selectedCategory !== 'all' && lotto.category !== selectedCategory) {
        return false;
      }
      // Filter by open only if enabled
      if (showOnlyOpen && !lotto.isOpen) {
        return false;
      }
      return true;
    });
  }, [allLotteries, selectedCategory, showOnlyOpen]);

  return (
    <div className={`${embedded ? 'space-y-3' : 'admin-card bg-white p-4 shadow-sm border border-slate-200 space-y-3'} ${className}`}>
      {/* 1. Header with title & filter toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-lg">category</span>
          <span className="text-xs font-black text-slate-800">{title}</span>
          <span className="text-[11px] text-slate-400 font-bold">
            (เลือก: <span className="text-blue-700 font-black">
              {allowAllOption && (selectedLottery === allOptionValue || (allOptionValue === '' && !selectedLottery))
                ? allOptionLabel
                : (selectedLottery || 'หวยธกส.')}
            </span>)
          </span>
        </div>

        {/* Toggle show only open */}
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition">
          <input
            type="checkbox"
            checked={showOnlyOpen}
            onChange={(e) => setShowOnlyOpen(e.target.checked)}
            className="rounded text-blue-600 w-3.5 h-3.5"
          />
          <span>แสดงเฉพาะหวยที่เปิด ({categoryStats[selectedCategory]?.open || 0})</span>
        </label>
      </div>

      {/* 2. แท็บหมวดหมู่ด้านบน (ลบ "อื่นๆ / กำหนดเอง" ออกตามภาพที่มีกากบาท) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {LOTTERY_CATEGORIES.filter(c => c.id !== 'all' && c.id !== 'other').map(cat => {
          const isActive = selectedCategory === cat.id;
          const stat = categoryStats[cat.id] || { total: 0, open: 0 };
          const hasOpen = stat.open > 0;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.id);
                // ดึงหวยตัวแรกในหมวดที่เลือกมาแสดงผลทันที (ไม่ปล่อยให้ว่าง)
                const firstInCat = allLotteries.find(l => l.category === cat.id);
                if (firstInCat) {
                  onSelectLottery(firstInCat.name);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition whitespace-nowrap flex items-center gap-1.5 border ${
                isActive
                  ? 'bg-blue-700 text-white border-blue-700 shadow-sm shadow-blue-700/20'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{cat.icon}</span>
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-600'
              }`}>
                {stat.total}
              </span>
              {hasOpen && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" title={`เปิดรับ ${stat.open} รายการ`}></span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. รายชื่อหวยย่อยด้านล่างเป็นปุ่มขนาดเล็ก (หวยเปิดอยู่หน้าสุด + ปุ่ม "แสดงทั้งหมด" อยู่ตำแหน่งวงกลมขวาสุด) */}
      <div className="pt-1">
        {filteredSubLotteries.length === 0 && !allowAllOption ? (
          <div className="p-4 text-center text-xs font-bold text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            {showOnlyOpen
              ? 'ไม่มีหวยที่เปิดรับแทงในหมวดหมู่นี้'
              : 'ไม่พบประเภทหวยในหมวดหมู่นี้'}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
            {/* รายชื่อหวยย่อยในกลุ่มนี้ */}
            {filteredSubLotteries.map(lotto => {
              const isSelected = selectedLottery === lotto.name;
              const isOpen = lotto.isOpen;

              return (
                <button
                  key={lotto.name}
                  type="button"
                  onClick={() => onSelectLottery(isSelected ? '' : lotto.name)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition active:scale-95 ${
                    isSelected
                      ? 'bg-blue-700 text-white border-blue-700 shadow-sm shadow-blue-700/25 ring-2 ring-blue-300'
                      : isOpen
                      ? 'bg-white text-slate-800 border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 shadow-xs'
                      : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 hover:opacity-100 hover:bg-slate-200'
                  }`}
                  title={`${lotto.name} (${isOpen ? '🟢 กำลังเปิดรับแทง' : '⚪ ปิดรับแทง'}) - คลิกเพื่อกรอง/คลิกซ้ำเพื่อยกเลิก`}
                >
                  <span className="text-xs">{lotto.icon}</span>
                  <span className="whitespace-nowrap">{lotto.name}</span>
                  
                  {/* Status Indicator */}
                  {isOpen ? (
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'} animate-pulse`}></span>
                  ) : (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 text-slate-500 font-black">
                      ปิด
                    </span>
                  )}
                </button>
              );
            })}

            {/* 🌟 ปุ่ม "แสดงทั้งหมด" ย้ายมาไว้ที่ตำแหน่งวงกลม (ท้ายแถว) ตามคำสั่งผู้ใช้ */}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                onSelectLottery('');
              }}
              className={`px-3 py-1 text-xs font-black rounded-lg border flex items-center gap-1.5 transition active:scale-95 ${
                !selectedLottery && selectedCategory === 'all'
                  ? 'bg-blue-700 text-white border-blue-700 shadow-md ring-2 ring-blue-300'
                  : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200 hover:border-slate-400'
              }`}
              title="แสดงทุกหวยในระบบพร้อมกันทั้งหมด (ตารางยาว)"
            >
              <span className="text-xs">🌐</span>
              <span className="whitespace-nowrap font-black">
                แสดงทั้งหมด ({allLotteries.length} รายการ)
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
