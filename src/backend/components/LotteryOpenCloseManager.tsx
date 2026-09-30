import React, { useState } from 'react';
import {
  LOTTERY_CATEGORIES, getLotteryCategory, getCategoryLabel,
  type LotteryCategoryKey
} from '@/shared/lib/lotteryCatalog';
import LotteryCategorySelector from './LotteryCategorySelector';

interface Props {
  lotterySettings: Record<string, any>;
  onToggleStatus: (type: string, status: boolean) => Promise<void>;
  onToggleAllStatus?: (status: boolean) => Promise<void>;
  onUpdateClosingTime: (type: string, timeStr: string) => Promise<void>;
  onDeleteLottery: (type: string) => Promise<void>;
  onSyncAllLotteries?: () => Promise<void>;
  onOpenAddModal?: () => void;
  onOpenResistance?: (type: string) => void;
}

export default function LotteryOpenCloseManager({
  lotterySettings,
  onToggleStatus,
  onUpdateClosingTime,
  onDeleteLottery,
  onOpenResistance,
}: Props) {
  const [selectedLottery, setSelectedLottery] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [closingTimeInputs, setClosingTimeInputs] = useState<Record<string, string>>({});
  const [updatingType, setUpdatingType] = useState<string | null>(null);

  const lottoKeys = Object.keys(lotterySettings).sort();

  // Statistics
  const totalCount = lottoKeys.length;
  const openCount = lottoKeys.filter(k => lotterySettings[k]?.isOpen && !lotterySettings[k]?.isPaused && lotterySettings[k]?.status !== 'closed').length;
  const closedCount = totalCount - openCount;

  // Filtered list: If user clicked a specific sub-lottery in LotteryCategorySelector, show it. Otherwise show matching search.
  const filteredKeys = lottoKeys.filter(type => {
    if (selectedLottery && type !== selectedLottery) {
      return false;
    }
    const matchesSearch = !searchTerm || type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleUpdateSingleClosingTime = async (type: string) => {
    const timeVal = closingTimeInputs[type] || lotterySettings[type]?.closingTime;
    if (!timeVal) {
      alert('กรุณาเลือกวันและเวลาปิดรับแทง');
      return;
    }
    setUpdatingType(type);
    try {
      await onUpdateClosingTime(type, timeVal);
    } finally {
      setUpdatingType(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card — No Bulky Buttons */}
      <div className="admin-card p-6 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">toggle_on</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">
              ศูนย์จัดการและตรวจสอบการเปิด-ปิดหวย (Lottery Status & Schedule Control)
            </h2>
            <p className="text-xs text-slate-500">
              เลือกหมวดหมู่แท็บด้านบน และเลือกรายชื่อหวยย่อยเป็นปุ่มขนาดเล็กด้านล่าง พร้อมตรวจเช็กสถานะเปิด-ปิดจริง
            </p>
          </div>
        </div>

        {/* Status Counter Badges */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            เปิดรับ {openCount} รายการ
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            ปิดรับ {closedCount} รายการ
          </span>
        </div>
      </div>

      {/* Unified Category Tabs & Small Sub-lottery Buttons (ปุ่มขนาดเล็กด้านล่าง) */}
      <LotteryCategorySelector
        selectedLottery={selectedLottery}
        onSelectLottery={(name) => {
          // If clicked again, toggle/clear filter to show all
          setSelectedLottery(prev => prev === name ? '' : name);
        }}
        lotterySettings={lotterySettings}
        title="เลือกหมวดหมู่หวย (แท็บด้านบน) และเลือกหวยย่อย (ปุ่มขนาดเล็กด้านล่าง)"
      />

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="admin-card p-4 bg-white border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">ประเภทหวยทั้งหมด</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalCount} รายการ</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
            <span className="material-symbols-outlined text-xl">ballot</span>
          </div>
        </div>

        <div className="admin-card p-4 bg-white border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">🟢 กำลังเปิดรับแทง (Active)</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{openCount} รายการ</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <span className="material-symbols-outlined text-xl">check_circle</span>
          </div>
        </div>

        <div className="admin-card p-4 bg-white border border-slate-200 shadow-sm flex items-center justify-between bg-slate-50/40">
          <div>
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">⚪ ปิดรับแทง (Closed)</div>
            <div className="text-2xl font-black text-slate-500 mt-1">{closedCount} รายการ</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center font-black">
            <span className="material-symbols-outlined text-xl">cancel</span>
          </div>
        </div>
      </div>

      {/* Main Table Card (ตารางข้อมูลแถวและคอลัมน์) */}
      <div className="admin-card bg-white overflow-hidden shadow-sm border border-slate-200">
        {/* Search Bar & Reset Selection */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black text-slate-800">
              ตารางข้อมูลประเภทหวย ({filteredKeys.length} รายการ)
            </h3>
            {selectedLottery && (
              <button
                onClick={() => setSelectedLottery('')}
                className="px-2.5 py-1 text-[11px] font-black text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition flex items-center gap-1"
              >
                <span>แสดงทุกหวย</span>
                <span>✕</span>
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-base">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อหวย... เช่น รัฐบาลไทย, ฮานอย, ลาว"
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 font-bold"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            )}
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs admin-table">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700">
                <th className="py-3 px-4 font-black w-12 text-center">#</th>
                <th className="py-3 px-4 font-black">ชื่อประเภทหวย</th>
                <th className="py-3 px-4 font-black">หมวดหมู่</th>
                <th className="py-3 px-4 font-black text-center">สถานะรับแทง</th>
                <th className="py-3 px-4 font-black">เวลาปิดรับแทงปัจจุบัน</th>
                <th className="py-3 px-4 font-black">แก้ไขเวลาปิดรับ</th>
                <th className="py-3 px-4 font-black text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs font-bold bg-slate-50">
                    ไม่พบประเภทหวยตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredKeys.map((type, idx) => {
                  const item = lotterySettings[type];
                  const isOpen = Boolean(item?.isOpen && !item?.isPaused && item?.status !== 'closed');
                  const catKey = getLotteryCategory(type, item?.category);
                  const catLabel = getCategoryLabel(catKey);

                  const closingDate = item?.closingTime ? new Date(item.closingTime) : null;
                  const isExpired = closingDate && closingDate.getTime() <= Date.now();

                  return (
                    <tr
                      key={type}
                      className={`transition ${
                        isOpen
                          ? 'hover:bg-blue-50/20 bg-white'
                          : 'bg-slate-50/70 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      
                      {/* ชื่อประเภทหวย */}
                      <td className="py-3 px-4 font-black text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{item?.icon || '🎯'}</span>
                          <span className={isOpen ? 'text-slate-900' : 'text-slate-500'}>{type}</span>
                          {!isOpen && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-black">
                              ปิดรับ
                            </span>
                          )}
                        </div>
                      </td>

                      {/* หมวดหมู่ */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {catLabel}
                        </span>
                      </td>

                      {/* สวิตช์เปิด-ปิด */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onToggleStatus(type, !isOpen)}
                          className={`relative inline-flex h-6 w-14 items-center rounded-full transition-colors focus:outline-none shadow-sm ${
                            isOpen ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              isOpen ? 'translate-x-9' : 'translate-x-1'
                            }`}
                          />
                          <span className={`absolute left-1.5 text-[8px] font-black text-white ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                            เปิด
                          </span>
                          <span className={`absolute right-1.5 text-[8px] font-black text-slate-600 ${!isOpen ? 'opacity-100' : 'opacity-0'}`}>
                            ปิด
                          </span>
                        </button>
                      </td>

                      {/* เวลาปิดรับแทงปัจจุบัน */}
                      <td className="py-3 px-4 font-bold text-slate-600">
                        {closingDate ? (
                          <div className="space-y-0.5">
                            <div>{closingDate.toLocaleString('th-TH')}</div>
                            <div className={`text-[10px] font-black ${isExpired ? 'text-red-500' : 'text-emerald-600'}`}>
                              {isExpired ? '● เลยกำหนดเวลาปิดรับแล้ว' : '● ยังไม่ถึงเวลาปิดรับ'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">ยังไม่กำหนดเวลา</span>
                        )}
                      </td>

                      {/* แก้ไขเวลาปิดรับ */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="datetime-local"
                            value={closingTimeInputs[type] ?? ''}
                            onChange={(e) => setClosingTimeInputs({ ...closingTimeInputs, [type]: e.target.value })}
                            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateSingleClosingTime(type)}
                            disabled={updatingType === type}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black shadow-sm transition active:scale-95"
                          >
                            {updatingType === type ? '...' : 'บันทึก'}
                          </button>
                        </div>
                      </td>

                      {/* การจัดการ */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onOpenResistance && (
                            <button
                              type="button"
                              onClick={() => onOpenResistance(type)}
                              title="ตั้งค่าเรทและระบบต้านทาน"
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition"
                            >
                              <span className="material-symbols-outlined text-sm">shield</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteLottery(type)}
                            title="ลบประเภทหวยออกจากระบบ"
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
