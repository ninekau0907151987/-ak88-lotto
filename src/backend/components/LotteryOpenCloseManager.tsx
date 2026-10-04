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
  onUpdateClosingTime?: (type: string, timeStr: string) => Promise<void>;
  onDeleteLottery?: (type: string) => Promise<void>;
  onSyncAllLotteries?: () => Promise<void>;
  onOpenAddModal?: () => void;
  onOpenResistance?: (type: string) => void;
}

export default function LotteryOpenCloseManager({
  lotterySettings,
  onToggleStatus,
}: Props) {
  const [selectedLottery, setSelectedLottery] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

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

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="admin-card p-6 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">toggle_on</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">
              ระบบหวยเปิด-ปิด (Lottery Open-Close Status)
            </h2>
            <p className="text-xs text-slate-500">
              ตรวจสอบรายชื่อหวยและควบคุมสถานะการเปิดรับ-ปิดรับแทงได้ทันที
            </p>
          </div>
        </div>

        {/* Status Counter Badges */}
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            เปิดรับ {openCount} รายการ
          </span>
          <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
            ปิดรับ {closedCount} รายการ
          </span>
        </div>
      </div>

      {/* Category Tabs & Sub-lottery Selector */}
      <LotteryCategorySelector
        selectedLottery={selectedLottery}
        onSelectLottery={(name) => {
          setSelectedLottery(prev => prev === name ? '' : name);
        }}
        lotterySettings={lotterySettings}
        allowAllOption={true}
        allOptionLabel="ทุกหวยในระบบ (แสดงทั้งหมด)"
        allOptionValue=""
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
            <div className="text-[11px] font-black text-emerald-600 uppercase tracking-wider">🟢 กำลังเปิดรับแทง</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">{openCount} รายการ</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <span className="material-symbols-outlined text-xl">check_circle</span>
          </div>
        </div>

        <div className="admin-card p-4 bg-white border border-slate-200 shadow-sm flex items-center justify-between bg-slate-50/40">
          <div>
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">⚪ ปิดรับแทง</div>
            <div className="text-2xl font-black text-slate-500 mt-1">{closedCount} รายการ</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center font-black">
            <span className="material-symbols-outlined text-xl">cancel</span>
          </div>
        </div>
      </div>

      {/* Main Table Card (แสดงเพียงรายชื่อหวยและสถานะการรับแทง) */}
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

        {/* The Clean Table: Only Name and Open/Close Status */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs admin-table">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700">
                <th className="py-3.5 px-4 font-black w-14 text-center">#</th>
                <th className="py-3.5 px-6 font-black">ชื่อประเภทหวย</th>
                <th className="py-3.5 px-4 font-black">หมวดหมู่</th>
                <th className="py-3.5 px-6 font-black text-center w-36">สถานะการรับแทง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 text-xs font-bold bg-slate-50">
                    ไม่พบประเภทหวยตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredKeys.map((type, idx) => {
                  const item = lotterySettings[type];
                  const isOpen = Boolean(item?.isOpen && !item?.isPaused && item?.status !== 'closed');
                  const catKey = getLotteryCategory(type, item?.category);
                  const catLabel = getCategoryLabel(catKey);

                  return (
                    <tr
                      key={type}
                      className={`transition ${
                        isOpen
                          ? 'hover:bg-blue-50/20 bg-white'
                          : 'bg-slate-50/70 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <td className="py-4 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      
                      {/* ชื่อประเภทหวย */}
                      <td className="py-4 px-6 font-black text-slate-900">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item?.icon || '🎯'}</span>
                          <div>
                            <span className={isOpen ? 'text-slate-900 font-black text-sm' : 'text-slate-500 font-bold text-sm'}>
                              {type}
                            </span>
                            {!isOpen && (
                              <span className="ml-2 text-[9px] px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 font-black">
                                ปิดรับแทง
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* หมวดหมู่ */}
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {catLabel}
                        </span>
                      </td>

                      {/* สวิตช์เปิด-ปิดสถานะรับแทง */}
                      <td className="py-4 px-6 text-center">
                        <button
                          type="button"
                          onClick={() => onToggleStatus(type, !isOpen)}
                          className={`relative inline-flex h-7 w-16 items-center rounded-full transition-colors focus:outline-none shadow-sm cursor-pointer ${
                            isOpen ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                          title={`คลิกเพื่อ${isOpen ? 'ปิด' : 'เปิด'}รับแทง ${type}`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                              isOpen ? 'translate-x-10' : 'translate-x-1'
                            }`}
                          />
                          <span className={`absolute left-2 text-[9px] font-black text-white ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                            เปิดรับ
                          </span>
                          <span className={`absolute right-2 text-[9px] font-black text-slate-600 ${!isOpen ? 'opacity-100' : 'opacity-0'}`}>
                            ปิดรับ
                          </span>
                        </button>
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
