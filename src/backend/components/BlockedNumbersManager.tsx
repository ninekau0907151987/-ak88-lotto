import React, { useState, useMemo } from 'react';
import { db } from '@/shared/lib/firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import type { StaffSession } from '@/shared/lib/permissions';
import LotteryCategorySelector from './LotteryCategorySelector';

interface Props {
  lotterySettings?: Record<string, any>;
  blockedNumbersList: any[];
  onLogActivity?: (action: string, detail: string, type?: any) => void | Promise<void>;
  session?: StaffSession | null;
}

const BET_TYPES = [
  '3 ตัวบน',
  '3 ตัวโต๊ด',
  '3 ตัวล่าง',
  '3 ตัวหน้า',
  '3 ตัวกลับ',
  '2 ตัวบน',
  '2 ตัวล่าง',
  '2 ตัวโต๊ด',
  '2 ตัวกลับ',
  'วิ่งบน',
  'วิ่งล่าง',
  'ปักหลักหน่วย',
  'ปักหลักสิบ',
  'ปักหลักร้อย',
  '4 ตัวบน',
  '4 ตัวโต๊ด',
  '5 ตัวบน',
  '6 ตัวบน'
];

export default function BlockedNumbersManager({
  lotterySettings = {},
  blockedNumbersList = [],
  onLogActivity,
  session
}: Props) {
  // Master Category & Lottery Selector State (at Top)
  const [selectedMasterLottery, setSelectedMasterLottery] = useState<string>('all');

  // Tab State: 'closed' (เลขปิด 100%), 'reduced' (เลขลดราคาจ่าย), 'all' (ภาพรวมทั้งหมด)
  const [subTab, setSubTab] = useState<'closed' | 'reduced' | 'all'>('closed');

  // Form 1: เลขปิด (100% Blocked)
  const [closedLottery, setClosedLottery] = useState('หวยรัฐบาลไทย');
  const [closedBetType, setClosedBetType] = useState('3 ตัวบน');
  const [closedInput, setClosedInput] = useState('');
  const [closedApplyAll, setClosedApplyAll] = useState(false);
  const [isSavingClosed, setIsSavingClosed] = useState(false);

  // Form 2: เลขลดราคา (Reduced Payout)
  const [reducedLottery, setReducedLottery] = useState('หวยรัฐบาลไทย');
  const [reducedBetType, setReducedBetType] = useState('3 ตัวบน');
  const [reducedInput, setReducedInput] = useState('');
  const [reducedCustomPayout, setReducedCustomPayout] = useState('500');
  const [reducedApplyAll, setReducedApplyAll] = useState(false);
  const [autoRandomCount, setAutoRandomCount] = useState(10);
  const [autoRandomPayout, setAutoRandomPayout] = useState('500');
  const [isSavingReduced, setIsSavingReduced] = useState(false);

  // Form 3: Table Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLottery, setFilterLottery] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'blocked' | 'reduced'>('all');
  const [filterBetType, setFilterBetType] = useState('all');

  // Available lotteries list
  const lotteryList = useMemo(() => {
    const keys = Object.keys(lotterySettings);
    if (keys.length > 0) return keys.sort();
    return ['หวยรัฐบาลไทย', 'หวยฮานอยพิเศษ', 'หวยฮานอยปกติ', 'หวยลาวพัฒนา', 'หวยมาเลย์', 'หวยยี่กี 88 รอบ'];
  }, [lotterySettings]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = blockedNumbersList.length;
    const closedCount = blockedNumbersList.filter(b => b.restrictionType === 'blocked' || !b.restrictionType).length;
    const reducedCount = blockedNumbersList.filter(b => b.restrictionType === 'reduced' || b.restrictionType === 'special').length;
    const uniqueLottos = new Set(blockedNumbersList.map(b => b.lotteryType)).size;
    return { total, closedCount, reducedCount, uniqueLottos };
  }, [blockedNumbersList]);

  // Parse input numbers helper
  const parseNumbers = (raw: string): string[] => {
    return raw
      .split(/[\s,]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);
  };

  // Detected parsed numbers preview
  const parsedClosedNumbers = useMemo(() => parseNumbers(closedInput), [closedInput]);
  const parsedReducedNumbers = useMemo(() => parseNumbers(reducedInput), [reducedInput]);

  // Handlers for Save Closed Numbers (100% Blocked)
  const handleSaveClosed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedClosedNumbers.length === 0) {
      alert('กรุณาระบุตัวเลขที่ต้องการปิดรับแทง');
      return;
    }

    const targetLotteries = closedApplyAll ? lotteryList : [closedLottery];
    setIsSavingClosed(true);

    try {
      const promises: Promise<any>[] = [];
      const author = session?.displayName || session?.username || 'Admin';

      for (const lotType of targetLotteries) {
        for (const num of parsedClosedNumbers) {
          promises.push(
            addDoc(collection(db, 'blocked_numbers'), {
              lotteryType: lotType,
              betType: closedBetType,
              number: num,
              restrictionType: 'blocked',
              customPayoutRate: 0,
              createdAt: new Date().toISOString(),
              createdBy: author
            })
          );
        }
      }

      await Promise.all(promises);
      setClosedInput('');
      if (onLogActivity) {
        onLogActivity('ตั้งค่าเลขอั้น', `ปิดรับแทง ${parsedClosedNumbers.length} เลข (${closedBetType}) สำหรับ ${targetLotteries.length} หวย`);
      }
      alert(`บันทึกเลขปิดรับ ${parsedClosedNumbers.length} รายการ สำหรับ ${targetLotteries.length} หวย เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('Error saving closed numbers:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกเลขปิดรับ');
    } finally {
      setIsSavingClosed(false);
    }
  };

  // Handlers for Save Reduced Numbers (Custom Payout)
  const handleSaveReduced = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedReducedNumbers.length === 0) {
      alert('กรุณาระบุตัวเลขที่ต้องการลดราคาจ่าย');
      return;
    }
    const payout = Number(reducedCustomPayout);
    if (isNaN(payout) || payout < 0) {
      alert('กรุณาระบุอัตราจ่ายที่ถูกต้อง (เป็นตัวเลขมากกว่าหรือเท่ากับ 0)');
      return;
    }

    const targetLotteries = reducedApplyAll ? lotteryList : [reducedLottery];
    setIsSavingReduced(true);

    try {
      const promises: Promise<any>[] = [];
      const author = session?.displayName || session?.username || 'Admin';

      for (const lotType of targetLotteries) {
        for (const num of parsedReducedNumbers) {
          promises.push(
            addDoc(collection(db, 'blocked_numbers'), {
              lotteryType: lotType,
              betType: reducedBetType,
              number: num,
              restrictionType: 'reduced',
              customPayoutRate: payout,
              createdAt: new Date().toISOString(),
              createdBy: author
            })
          );
        }
      }

      await Promise.all(promises);
      setReducedInput('');
      if (onLogActivity) {
        onLogActivity('ตั้งค่าเลขลดราคา', `ลดจ่าย ${parsedReducedNumbers.length} เลข (${reducedBetType}) เหลือ ฿${payout} สำหรับ ${targetLotteries.length} หวย`);
      }
      alert(`บันทึกเลขลดราคา ${parsedReducedNumbers.length} รายการ (จ่าย ฿${payout}) สำหรับ ${targetLotteries.length} หวย เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('Error saving reduced numbers:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกเลขลดราคา');
    } finally {
      setIsSavingReduced(false);
    }
  };

  // Handlers for Auto-Random Reduced Numbers Generator
  const handleAutoRandomReduced = async () => {
    const count = Number(autoRandomCount);
    const payout = Number(autoRandomPayout);

    if (isNaN(count) || count <= 0) {
      alert('กรุณาระบุจำนวนเลขที่ต้องการสุ่มให้ถูกต้อง');
      return;
    }
    if (isNaN(payout) || payout < 0) {
      alert('กรุณาระบุอัตราจ่ายที่ต้องการ');
      return;
    }

    // Build universe based on betType
    const is3Digit = reducedBetType.includes('3 ตัว');
    const is2Digit = reducedBetType.includes('2 ตัว');
    const is1Digit = reducedBetType.includes('วิ่ง') || reducedBetType.includes('ปักหลัก');

    const universe: string[] = [];
    if (is3Digit) {
      for (let i = 0; i < 1000; i++) universe.push(String(i).padStart(3, '0'));
    } else if (is2Digit) {
      for (let i = 0; i < 100; i++) universe.push(String(i).padStart(2, '0'));
    } else if (is1Digit) {
      for (let i = 0; i < 10; i++) universe.push(String(i));
    } else {
      // 4 digits or default
      for (let i = 0; i < 1000; i++) universe.push(String(i).padStart(3, '0'));
    }

    // Filter existing blocked/reduced numbers for this lottery & betType
    const existing = new Set(
      blockedNumbersList
        .filter(b => b.lotteryType === reducedLottery && b.betType === reducedBetType)
        .map(b => b.number)
    );
    const available = universe.filter(n => !existing.has(n));

    if (available.length < count) {
      alert(`มีเลขว่างให้สุ่มเพียง ${available.length} เลขเท่านั้น (ต้องการ ${count} เลข)`);
      return;
    }

    // Shuffle & Pick
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    try {
      const author = session?.displayName || session?.username || 'Admin';
      const promises = selected.map(num =>
        addDoc(collection(db, 'blocked_numbers'), {
          lotteryType: reducedLottery,
          betType: reducedBetType,
          number: num,
          restrictionType: 'reduced',
          customPayoutRate: payout,
          createdAt: new Date().toISOString(),
          createdBy: author
        })
      );

      await Promise.all(promises);
      if (onLogActivity) {
        onLogActivity('สุ่มสร้างเลขลดราคา', `สุ่ม ${count} เลข (${reducedBetType}) จ่าย ฿${payout} สำหรับ ${reducedLottery}`);
      }
      alert(`⚡ สุ่มสร้างเลขลดราคา ${count} รายการ (จ่าย ฿${payout}) สำหรับ ${reducedLottery} เรียบร้อยแล้ว!`);
    } catch (err) {
      console.error('Error in auto randomize:', err);
      alert('เกิดข้อผิดพลาดในการสุ่มเลข');
    }
  };

  // Delete single blocked number
  const handleDeleteNumber = async (id: string, num: string, lot: string) => {
    if (!window.confirm(`ต้องการยกเลิกการอั้นเลข "${num}" ของ ${lot} ใช่หรือไม่?`)) return;
    try {
      await deleteDoc(doc(db, 'blocked_numbers', id));
      if (onLogActivity) {
        onLogActivity('ยกเลิกเลขอั้น', `ลบเลขอั้น ${num} ของ ${lot}`);
      }
    } catch (err) {
      console.error('Error deleting blocked number:', err);
      alert('เกิดข้อผิดพลาดในการลบรายการ');
    }
  };

  // Clear all blocked numbers for selected lottery and category
  const handleClearAllCategory = async (lotType: string, typeFilter: 'blocked' | 'reduced' | 'all') => {
    const label = typeFilter === 'blocked' ? 'เลขปิดรับ 100%' : typeFilter === 'reduced' ? 'เลขลดราคา' : 'เลขอั้นทั้งหมด';
    if (!window.confirm(`ยืนยันล้างข้อมูล ${label} ของ "${lotType}" ทั้งหมดใช่หรือไม่?`)) return;

    try {
      const targets = blockedNumbersList.filter(b => {
        if (b.lotteryType !== lotType) return false;
        if (typeFilter === 'blocked') return b.restrictionType === 'blocked' || !b.restrictionType;
        if (typeFilter === 'reduced') return b.restrictionType === 'reduced' || b.restrictionType === 'special';
        return true;
      });

      const promises = targets.map(t => deleteDoc(doc(db, 'blocked_numbers', t.id)));
      await Promise.all(promises);
      if (onLogActivity) {
        onLogActivity('ล้างเลขอั้น', `ล้างข้อมูล ${label} จำนวน ${targets.length} รายการ ของ ${lotType}`);
      }
      alert(`ล้างข้อมูล ${label} จำนวน ${targets.length} รายการ เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('Error clearing blocked category:', err);
      alert('เกิดข้อผิดพลาดในการล้างข้อมูล');
    }
  };

  // Filtered list for Table view (Tab 3)
  const filteredAllList = useMemo(() => {
    return blockedNumbersList.filter(item => {
      // Search
      if (searchTerm && !item.number?.includes(searchTerm)) return false;
      // Lottery
      if (filterLottery !== 'all' && item.lotteryType !== filterLottery) return false;
      // Bet Type
      if (filterBetType !== 'all' && item.betType !== filterBetType) return false;
      // Restriction Type
      if (filterType === 'blocked' && (item.restrictionType !== 'blocked' && item.restrictionType)) return false;
      if (filterType === 'reduced' && item.restrictionType !== 'reduced' && item.restrictionType !== 'special') return false;
      return true;
    });
  }, [blockedNumbersList, searchTerm, filterLottery, filterBetType, filterType]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredAllList.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }
    const headers = ['ลำดับ', 'ประเภทหวย', 'รูปแบบการแทง', 'ตัวเลข', 'สถานะการอั้น', 'อัตราจ่าย', 'วันที่บันทึก', 'ผู้บันทึก'];
    const rows = filteredAllList.map((item, idx) => [
      idx + 1,
      item.lotteryType || '-',
      item.betType || '-',
      item.number || '-',
      item.restrictionType === 'blocked' ? 'ปิดรับ 100%' : 'ลดราคาจ่าย',
      item.restrictionType === 'blocked' ? '0' : (item.customPayoutRate ?? '-'),
      item.createdAt ? new Date(item.createdAt).toLocaleString('th-TH') : '-',
      item.createdBy || 'Admin'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `เลขอั้น_AK88_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: เลขปิด 100% */}
        <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm shadow-red-950/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">block</span>
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">เลขปิดรับ 100% (จ่าย 0)</div>
            <div className="text-2xl font-black text-red-600 tabular-nums">{stats.closedCount.toLocaleString()} <span className="text-xs font-bold text-slate-400">เลข</span></div>
          </div>
        </div>

        {/* Card 2: เลขลดราคาจ่าย */}
        <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm shadow-amber-950/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">trending_down</span>
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">เลขลดราคา (ลดอัตราจ่าย)</div>
            <div className="text-2xl font-black text-amber-600 tabular-nums">{stats.reducedCount.toLocaleString()} <span className="text-xs font-bold text-slate-400">เลข</span></div>
          </div>
        </div>

        {/* Card 3: จำนวนหวยที่มีเลขอั้น */}
        <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm shadow-blue-950/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">casino</span>
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">หวยที่มีเลขอั้น</div>
            <div className="text-2xl font-black text-blue-700 tabular-nums">{stats.uniqueLottos} <span className="text-xs font-bold text-slate-400">ประเภท</span></div>
          </div>
        </div>

        {/* Card 4: รวมเลขอั้นทั้งหมด */}
        <div className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-sm shadow-indigo-950/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">format_list_numbered</span>
          </div>
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">รายการเลขอั้นทั้งหมด</div>
            <div className="text-2xl font-black text-indigo-700 tabular-nums">{stats.total.toLocaleString()} <span className="text-xs font-bold text-slate-400">รายการ</span></div>
          </div>
        </div>
      </div>

      {/* ★ แถบเลือกหมวดหมู่และประเภทหวยด้านบน (Lottery Category Selector at Top) */}
      <LotteryCategorySelector
        selectedLottery={selectedMasterLottery}
        onSelectLottery={(lottery) => {
          setSelectedMasterLottery(lottery);
          if (lottery === 'all') {
            setFilterLottery('all');
            setClosedApplyAll(true);
            setReducedApplyAll(true);
          } else {
            setClosedLottery(lottery);
            setReducedLottery(lottery);
            setFilterLottery(lottery);
            setClosedApplyAll(false);
            setReducedApplyAll(false);
          }
        }}
        lotterySettings={lotterySettings}
        allowAllOption={true}
        allOptionLabel="ทุกหวยในระบบ (หวยทั้งหมด)"
        allOptionValue="all"
        title="เลือกหมวดหมู่และประเภทหวยที่ต้องการจัดการเลขอั้น/ลดราคา"
      />

      {/* 2. Sub-Tab Switcher Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-sm shadow-blue-900/5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
          <button
            onClick={() => setSubTab('closed')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black transition ${
              subTab === 'closed'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/25'
                : 'text-slate-600 hover:text-red-700 hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-base">block</span>
            <span>⛔ จัดการเลขปิด (ห้ามแทง 100%)</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${subTab === 'closed' ? 'bg-red-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {stats.closedCount}
            </span>
          </button>

          <button
            onClick={() => setSubTab('reduced')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black transition ${
              subTab === 'reduced'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
                : 'text-slate-600 hover:text-amber-700 hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-base">trending_down</span>
            <span>📉 จัดการเลขลดราคา (ลดอัตราจ่าย)</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${subTab === 'reduced' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {stats.reducedCount}
            </span>
          </button>

          <button
            onClick={() => setSubTab('all')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-black transition ${
              subTab === 'all'
                ? 'bg-blue-700 text-white shadow-md shadow-blue-700/25'
                : 'text-slate-600 hover:text-blue-700 hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-base">list_alt</span>
            <span>📋 ค้นหา & สรุปภาพรวมเลขอั้น</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${subTab === 'all' ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {stats.total}
            </span>
          </button>
        </div>

        {/* Info badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl text-[11px] font-bold text-blue-700">
          <span className="material-symbols-outlined text-sm text-blue-600 animate-pulse">bolt</span>
          <span>เชื่อมต่อข้อมูลสด Realtime กับหน้าแทงหวยหน้าบ้านทันที</span>
        </div>
      </div>

      {/* 3. Sub-Tab 1: ⛔ จัดการเลขปิด (100% Blocked) */}
      {subTab === 'closed' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Input Form Box (Col 5) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm shadow-blue-900/5 flex flex-col justify-between">
            <form onSubmit={handleSaveClosed} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-black">
                    <span className="material-symbols-outlined text-lg">do_not_disturb_on</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">เพิ่มเลขปิดรับแทง (100%)</h3>
                    <p className="text-[10px] font-bold text-slate-400">ระบบจะปฏิเสธโพยและห้ามแทงเลขนี้ทันที</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-red-50 text-red-600 border border-red-100">
                  Payout = ฿0
                </span>
              </div>

              {/* เลือกหวย (เชื่อมโยงกับแถบเลือกด้านบน) */}
              <div>
                <label className="text-xs font-black text-slate-700 mb-1.5 block flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-slate-400">casino</span>
                    ประเภทหวยที่กำลังจัดการ
                  </span>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    เปลี่ยนได้ที่แถบเลือกด้านบน ⬆️
                  </span>
                </label>
                <div className="w-full border border-slate-200 bg-slate-50/80 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{selectedMasterLottery === 'all' ? '⭐' : '🎯'}</span>
                    <span className="text-xs font-black text-slate-800">
                      {selectedMasterLottery === 'all'
                        ? (closedApplyAll ? `ทุกหวยในระบบ (${lotteryList.length} หวย)` : `${closedLottery} (จากทุกหวย)`)
                        : closedLottery}
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                    closedApplyAll || selectedMasterLottery === 'all'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}>
                    {closedApplyAll || selectedMasterLottery === 'all' ? 'ทุกหวย' : 'หวยเดี่ยว'}
                  </span>
                </div>
              </div>

              {/* Checkbox Apply All */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer hover:bg-slate-100/70 transition">
                <input
                  type="checkbox"
                  checked={closedApplyAll}
                  onChange={(e) => setClosedApplyAll(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                />
                <div>
                  <div className="text-xs font-black text-slate-800">★ ใช้กับทุกหวยในระบบ ({lotteryList.length} หวย)</div>
                  <div className="text-[10px] font-bold text-slate-400">ปิดรับเลขเหล่านี้พร้อมกันในทุกประเภทหวย</div>
                </div>
              </label>

              {/* รูปแบบการแทง */}
              <div>
                <label className="text-xs font-black text-slate-700 mb-1.5 block flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-slate-400">tune</span>
                  รูปแบบการแทง
                </label>
                <select
                  value={closedBetType}
                  onChange={(e) => setClosedBetType(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:border-red-500 focus:bg-white transition"
                >
                  {BET_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* ช่องกรอกเลข */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-slate-400">edit_note</span>
                    ระบุตัวเลข (Bulk Input)
                  </label>
                  <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded">
                    ตรวจพบ {parsedClosedNumbers.length} เลข
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="ใส่ตัวเลขคั่นด้วย เว้นวรรค, ลูกน้ำ (,) หรือขึ้นบรรทัดใหม่ เช่น 999 123 456 789"
                  value={closedInput}
                  onChange={(e) => setClosedInput(e.target.value)}
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-xs font-mono font-bold text-slate-800 outline-none focus:border-red-500 focus:bg-white transition resize-none"
                />
                <div className="text-[10px] text-slate-400 font-bold mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-slate-400">info</span>
                  รองรับการวางเลขชุดจำนวนมากคั่นด้วยเว้นวรรคหรือจุลภาค
                </div>
              </div>

              {/* Number preview tags */}
              {parsedClosedNumbers.length > 0 && (
                <div className="p-3 bg-red-50/60 rounded-xl border border-red-100">
                  <div className="text-[10px] font-black text-red-700 mb-1.5 uppercase">ตัวอย่างเลขที่จะปิด ({parsedClosedNumbers.length} รายการ):</div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {parsedClosedNumbers.map((num, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-600 text-white rounded-md text-[11px] font-mono font-black shadow-xs">
                        {num}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingClosed || parsedClosedNumbers.length === 0}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white p-3.5 rounded-xl font-black text-xs shadow-md shadow-red-600/25 transition active:scale-98 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">do_not_disturb_on</span>
                <span>{isSavingClosed ? 'กำลังบันทึก...' : `บันทึกเลขปิดรับ (${parsedClosedNumbers.length} เลข)`}</span>
              </button>
            </form>
          </div>

          {/* Current Closed Numbers Table (Col 7) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm shadow-blue-900/5 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>รายการเลขปิดปัจจุบัน:</span>
                    <span className="text-red-600 font-bold bg-red-50 px-2.5 py-0.5 rounded-lg border border-red-100 text-xs">
                      {selectedMasterLottery === 'all' ? 'ทุกหวยในระบบ' : closedLottery}
                    </span>
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                    มีเลขปิดทั้งหมด {blockedNumbersList.filter(b => (selectedMasterLottery === 'all' || b.lotteryType === closedLottery) && (b.restrictionType === 'blocked' || !b.restrictionType)).length} เลข
                  </p>
                </div>

                <button
                  onClick={() => handleClearAllCategory(selectedMasterLottery === 'all' ? closedLottery : closedLottery, 'blocked')}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-[11px] font-black transition flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                  {selectedMasterLottery === 'all' ? 'ล้างเลขปิดหวยปัจจุบัน' : `ล้างเลขปิดทั้งหมดของ ${closedLottery}`}
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto border border-slate-100 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                    <tr>
                      <th className="p-3">#</th>
                      {selectedMasterLottery === 'all' && <th className="p-3">ประเภทหวย</th>}
                      <th className="p-3">ตัวเลข</th>
                      <th className="p-3">รูปแบบการแทง</th>
                      <th className="p-3">สถานะ</th>
                      <th className="p-3">วันที่บันทึก</th>
                      <th className="p-3 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {blockedNumbersList
                      .filter(b => (selectedMasterLottery === 'all' || b.lotteryType === closedLottery) && (b.restrictionType === 'blocked' || !b.restrictionType))
                      .map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 text-slate-400 font-bold tabular-nums">{idx + 1}</td>
                          {selectedMasterLottery === 'all' && (
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap">
                                {item.lotteryType}
                              </span>
                            </td>
                          )}
                          <td className="p-3">
                            <span className="px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded-lg font-mono font-black text-xs shadow-2xs">
                              {item.number}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-700">{item.betType || '3 ตัวบน'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-50 text-red-600 border border-red-100">
                              ⛔ ปิดรับ (จ่าย 0)
                            </span>
                          </td>
                          <td className="p-3 text-[10px] text-slate-400 font-bold">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('th-TH') : '-'}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteNumber(item.id, item.number, item.lotteryType)}
                              className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition"
                              title="ลบ / ปลดอั้น"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    {blockedNumbersList.filter(b => (selectedMasterLottery === 'all' || b.lotteryType === closedLottery) && (b.restrictionType === 'blocked' || !b.restrictionType)).length === 0 && (
                      <tr>
                        <td colSpan={selectedMasterLottery === 'all' ? 7 : 6} className="p-12 text-center text-slate-400 italic">
                          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                            <span className="material-symbols-outlined text-2xl">check_circle</span>
                          </div>
                          ไม่มีเลขปิดรับแทงสำหรับ {selectedMasterLottery === 'all' ? 'ทุกหวยในระบบ' : closedLottery} (เปิดรับแทง 100% ทุกตัว)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Sub-Tab 2: 📉 จัดการเลขลดราคา (Reduced Payout & Auto Random) */}
      {subTab === 'reduced' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Manual Form + Auto-Random Generator (Col 5) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Box 1: Manual Reduced Number Input */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm shadow-blue-900/5">
              <form onSubmit={handleSaveReduced} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                      <span className="material-symbols-outlined text-lg">trending_down</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">เพิ่มเลขลดอัตราจ่าย (ลดราคา)</h3>
                      <p className="text-[10px] font-bold text-slate-400">แทงได้ปกติ แต่จ่ายตามอัตราพิเศษที่กำหนด</p>
                    </div>
                  </div>
                </div>

                {/* เลือกหวย (เชื่อมโยงกับแถบเลือกด้านบน) */}
                <div>
                  <label className="text-xs font-black text-slate-700 mb-1.5 block flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-slate-400">casino</span>
                      ประเภทหวยที่กำลังจัดการ
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                      เปลี่ยนได้ที่แถบเลือกด้านบน ⬆️
                    </span>
                  </label>
                  <div className="w-full border border-slate-200 bg-slate-50/80 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{selectedMasterLottery === 'all' ? '⭐' : '🎯'}</span>
                      <span className="text-xs font-black text-slate-800">
                        {selectedMasterLottery === 'all'
                          ? (reducedApplyAll ? `ทุกหวยในระบบ (${lotteryList.length} หวย)` : `${reducedLottery} (จากทุกหวย)`)
                          : reducedLottery}
                      </span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                      reducedApplyAll || selectedMasterLottery === 'all'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {reducedApplyAll || selectedMasterLottery === 'all' ? 'ทุกหวย' : 'หวยเดี่ยว'}
                    </span>
                  </div>
                </div>

                {/* Checkbox Apply All */}
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 cursor-pointer hover:bg-slate-100/70 transition">
                  <input
                    type="checkbox"
                    checked={reducedApplyAll}
                    onChange={(e) => setReducedApplyAll(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-xs font-black text-slate-800">★ ใช้กับทุกหวยในระบบ ({lotteryList.length} หวย)</div>
                    <div className="text-[10px] font-bold text-slate-400">ลดราคาเลขเหล่านี้พร้อมกันในทุกประเภทหวย</div>
                  </div>
                </label>

                {/* รูปแบบแทง & อัตราจ่ายพิเศษ */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-slate-700 mb-1.5 block">รูปแบบการแทง</label>
                    <select
                      value={reducedBetType}
                      onChange={(e) => setReducedBetType(e.target.value)}
                      className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition"
                    >
                      {BET_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-700 mb-1.5 block">อัตราจ่ายลดเหลือ (บาท)</label>
                    <input
                      type="number"
                      placeholder="เช่น 500 หรือ 50"
                      value={reducedCustomPayout}
                      onChange={(e) => setReducedCustomPayout(e.target.value)}
                      className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-xs font-black text-amber-700 outline-none focus:border-amber-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* ช่องกรอกเลข Bulk */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-slate-400">edit_note</span>
                      ระบุตัวเลข (Bulk Input)
                    </label>
                    <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      ตรวจพบ {parsedReducedNumbers.length} เลข
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="ใส่ตัวเลขคั่นด้วย เว้นวรรค หรือลูกน้ำ เช่น 123 456 789 000"
                    value={reducedInput}
                    onChange={(e) => setReducedInput(e.target.value)}
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-xs font-mono font-bold text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition resize-none"
                  />
                </div>

                {/* Preview */}
                {parsedReducedNumbers.length > 0 && (
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                    <div className="text-[10px] font-black text-amber-700 mb-1 uppercase">
                      ตัวอย่างเลขลดราคา (จ่าย ฿{reducedCustomPayout}):
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                      {parsedReducedNumbers.map((num, i) => (
                        <span key={i} className="px-2 py-0.5 bg-amber-500 text-white rounded-md text-[11px] font-mono font-black shadow-2xs">
                          {num}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSavingReduced || parsedReducedNumbers.length === 0}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white p-3.5 rounded-xl font-black text-xs shadow-md shadow-amber-600/25 transition active:scale-98 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>{isSavingReduced ? 'กำลังบันทึก...' : `บันทึกเลขลดราคา (${parsedReducedNumbers.length} เลข จ่าย ฿${reducedCustomPayout})`}</span>
                </button>
              </form>
            </div>

            {/* Box 2: ⚡ เครื่องมือสุ่มสร้างเลขลดราคาอัตโนมัติ (Auto Random Generator) */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-md shadow-amber-500/20">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black">
                  <span className="material-symbols-outlined text-lg text-white">auto_awesome</span>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">⚡ สุ่มสร้างเลขลดราคาอัตโนมัติ</h4>
                  <p className="text-[10px] text-amber-100">ระบบจะสุ่มเลขที่ไม่ซ้ำกับเลขอั้นเดิมในระบบให้ทันที</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[10px] font-black text-amber-100 block mb-1">จำนวนเลขที่สุ่ม</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={autoRandomCount}
                    onChange={(e) => setAutoRandomCount(Number(e.target.value))}
                    className="w-full bg-white/90 text-slate-900 rounded-xl p-2.5 text-xs font-black outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-amber-100 block mb-1">อัตราจ่ายพิเศษ (฿)</label>
                  <input
                    type="number"
                    value={autoRandomPayout}
                    onChange={(e) => setAutoRandomPayout(e.target.value)}
                    className="w-full bg-white/90 text-slate-900 rounded-xl p-2.5 text-xs font-black outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAutoRandomReduced}
                className="w-full bg-white text-amber-900 hover:bg-amber-50 p-3 rounded-xl font-black text-xs shadow-sm transition active:scale-98 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base text-amber-600">shuffle</span>
                <span>สุ่มสร้าง {autoRandomCount} เลขลดราคา (จ่าย ฿{autoRandomPayout})</span>
              </button>
            </div>
          </div>

          {/* Right Column: Current Reduced Numbers Table (Col 7) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm shadow-blue-900/5 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span>รายการเลขลดราคาปัจจุบัน:</span>
                    <span className="text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 text-xs">
                      {selectedMasterLottery === 'all' ? 'ทุกหวยในระบบ' : reducedLottery}
                    </span>
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                    มีเลขลดราคาทั้งหมด {blockedNumbersList.filter(b => (selectedMasterLottery === 'all' || b.lotteryType === reducedLottery) && (b.restrictionType === 'reduced' || b.restrictionType === 'special')).length} เลข
                  </p>
                </div>

                <button
                  onClick={() => handleClearAllCategory(selectedMasterLottery === 'all' ? reducedLottery : reducedLottery, 'reduced')}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[11px] font-black transition flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                  {selectedMasterLottery === 'all' ? 'ล้างเลขลดราคาหวยปัจจุบัน' : `ล้างเลขลดราคาทั้งหมดของ ${reducedLottery}`}
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[560px] overflow-y-auto border border-slate-100 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                    <tr>
                      <th className="p-3">#</th>
                      {selectedMasterLottery === 'all' && <th className="p-3">ประเภทหวย</th>}
                      <th className="p-3">ตัวเลข</th>
                      <th className="p-3">รูปแบบแทง</th>
                      <th className="p-3">อัตราจ่ายพิเศษ</th>
                      <th className="p-3">วันที่บันทึก</th>
                      <th className="p-3 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {blockedNumbersList
                      .filter(b => (selectedMasterLottery === 'all' || b.lotteryType === reducedLottery) && (b.restrictionType === 'reduced' || b.restrictionType === 'special'))
                      .map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 text-slate-400 font-bold tabular-nums">{idx + 1}</td>
                          {selectedMasterLottery === 'all' && (
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100 whitespace-nowrap">
                                {item.lotteryType}
                              </span>
                            </td>
                          )}
                          <td className="p-3">
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-mono font-black text-xs shadow-2xs">
                              {item.number}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-700">{item.betType || '3 ตัวบน'}</td>
                          <td className="p-3">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 tabular-nums">
                              ฿{item.customPayoutRate ?? '-'} / บาท
                            </span>
                          </td>
                          <td className="p-3 text-[10px] text-slate-400 font-bold">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('th-TH') : '-'}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteNumber(item.id, item.number, item.lotteryType)}
                              className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition"
                              title="ลบ / ปลดอั้น"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    {blockedNumbersList.filter(b => (selectedMasterLottery === 'all' || b.lotteryType === reducedLottery) && (b.restrictionType === 'reduced' || b.restrictionType === 'special')).length === 0 && (
                      <tr>
                        <td colSpan={selectedMasterLottery === 'all' ? 7 : 6} className="p-12 text-center text-slate-400 italic">
                          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                            <span className="material-symbols-outlined text-2xl">savings</span>
                          </div>
                          ไม่มีเลขลดราคาสำหรับ {selectedMasterLottery === 'all' ? 'ทุกหวยในระบบ' : reducedLottery} (จ่ายเต็มอัตราปกติ 100%)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Sub-Tab 3: 📋 ภาพรวม & ค้นหาเลขอั้นทั้งหมด (All Restrictions Table) */}
      {subTab === 'all' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm shadow-blue-900/5 space-y-4">
          {/* Top Filter & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[180px]">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">
                  search
                </span>
                <input
                  type="text"
                  placeholder="ค้นหาตัวเลข (เช่น 999)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition"
                />
              </div>

              {/* Lottery Filter */}
              <select
                value={filterLottery}
                onChange={(e) => {
                  setFilterLottery(e.target.value);
                  setSelectedMasterLottery(e.target.value);
                }}
                className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition"
              >
                <option value="all">ทุกประเภทหวย ({lotteryList.length})</option>
                {lotteryList.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>

              {/* Restriction Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition"
              >
                <option value="all">สถานะทั้งหมด</option>
                <option value="blocked">⛔ ปิดรับ 100% (จ่าย 0)</option>
                <option value="reduced">📉 ลดราคาจ่าย</option>
              </select>

              {/* Bet Type Filter */}
              <select
                value={filterBetType}
                onChange={(e) => setFilterBetType(e.target.value)}
                className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition"
              >
                <option value="all">ทุกรูปแบบการแทง</option>
                {BET_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-2xs"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span>ส่งออก CSV ({filteredAllList.length})</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">ประเภทหวย</th>
                  <th className="p-3">รูปแบบแทง</th>
                  <th className="p-3">ตัวเลข</th>
                  <th className="p-3">สถานะการอั้น</th>
                  <th className="p-3">อัตราจ่าย</th>
                  <th className="p-3">วันที่บันทึก</th>
                  <th className="p-3">ผู้บันทึก</th>
                  <th className="p-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAllList.map((item, idx) => {
                  const isBlocked = item.restrictionType === 'blocked' || !item.restrictionType;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 text-slate-400 font-bold tabular-nums">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{item.lotteryType || '-'}</td>
                      <td className="p-3 text-slate-600 font-bold">{item.betType || '3 ตัวบน'}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs border shadow-2xs ${
                          isBlocked
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {item.number}
                        </span>
                      </td>
                      <td className="p-3">
                        {isBlocked ? (
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-red-50 text-red-600 border border-red-100">
                            ⛔ ปิดรับ 100%
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                            📉 ลดราคาจ่าย
                          </span>
                        )}
                      </td>
                      <td className="p-3 tabular-nums font-black">
                        {isBlocked ? (
                          <span className="text-red-500">฿0 (ปิดแทง)</span>
                        ) : (
                          <span className="text-amber-700">฿{item.customPayoutRate ?? '-'}</span>
                        )}
                      </td>
                      <td className="p-3 text-[10px] text-slate-400 font-bold">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('th-TH') : '-'}
                      </td>
                      <td className="p-3 text-[11px] text-slate-500 font-bold">
                        {item.createdBy || 'Admin'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteNumber(item.id, item.number, item.lotteryType)}
                          className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition"
                          title="ลบ / ปลดอั้น"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredAllList.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400 italic">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                        <span className="material-symbols-outlined text-2xl">search_off</span>
                      </div>
                      ไม่พบรายการเลขอั้นตามเงื่อนไขที่ค้นหา
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
