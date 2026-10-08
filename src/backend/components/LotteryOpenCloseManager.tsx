import React, { useState } from 'react';
import {
  LOTTERY_CATEGORIES, getLotteryCategory, getCategoryLabel, isAllowedOpenLottery,
  type LotteryCategoryKey
} from '@/shared/lib/lotteryCatalog';
import LotteryCategorySelector from './LotteryCategorySelector';

interface Props {
  lotterySettings: Record<string, any>;
  onToggleStatus: (type: string, status: boolean) => Promise<void>;
  onToggleAllStatus?: (status: boolean) => Promise<void>;
  onApplyOnlyThree?: () => Promise<void>;
  onUpdateClosingTime?: (type: string, timeStr: string) => Promise<void>;
  onDeleteLottery?: (type: string) => Promise<void>;
  onEditLottery?: (lottery: any) => void;
  onSyncAllLotteries?: () => Promise<void>;
  onOpenAddModal?: () => void;
  onOpenResistance?: (type: string) => void;
}

export default function LotteryOpenCloseManager({
  lotterySettings,
  onToggleStatus,
  onApplyOnlyThree,
  onOpenAddModal,
  onEditLottery,
  onDeleteLottery,
}: Props) {
  const [selectedLottery, setSelectedLottery] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isApplyingPreset, setIsApplyingPreset] = useState(false);

  // 🌟 เรียงลำดับหวย: หวยที่เปิดรับแทงต้องอยู่บนสุดเสมอ ("ตัวเปิดใหม่อยู่บน" & "ปิดแล้วให้รัยมาอยูบน")
  const lottoKeys = Object.keys(lotterySettings).sort((a, b) => {
    const aOpen = Boolean(lotterySettings[a]?.isOpen && !lotterySettings[a]?.isPaused && lotterySettings[a]?.status !== 'closed');
    const bOpen = Boolean(lotterySettings[b]?.isOpen && !lotterySettings[b]?.isPaused && lotterySettings[b]?.status !== 'closed');
    // 1. หวยที่เปิดรับแทง อยู่ด้านบนสุดเสมอ
    if (aOpen && !bOpen) return -1;
    if (!aOpen && bOpen) return 1;
    // 2. หากสถานะเหมือนกัน ให้เรียงตามชื่อภาษาไทย
    return a.localeCompare(b, 'th');
  });

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

  const handleApplyOnlyThree = async () => {
    if (!window.confirm('⚠️ ยืนยันคำสั่งผู้บริหาร:\n\n• ปิดรับแทงทุกหวยในระบบ\n• เปิดเฉพาะ 3 หวยหลัก: หวยไทย, หุ้นไทยเช้า, หวยยี่กี 88 รอบ เท่านั้น\n\nต้องการดำเนินการทันทีหรือไม่?')) {
      return;
    }
    setIsApplyingPreset(true);
    try {
      if (onApplyOnlyThree) {
        await onApplyOnlyThree();
      } else {
        const promises = lottoKeys.map(k => onToggleStatus(k, isAllowedOpenLottery(k)));
        await Promise.all(promises);
      }
      alert('✅ ดำเนินการสำเร็จ!\nระบบได้ทำการเปิดเฉพาะ หวยไทย, หุ้นไทยเช้า, หวยยี่กี 88 รอบ และปิดหวยอื่นทั้งหมดเรียบร้อยแล้ว');
    } catch (e: any) {
      alert('เกิดข้อผิดพลาด: ' + (e?.message || e));
    } finally {
      setIsApplyingPreset(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="admin-card p-6 bg-white shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-black shadow-sm">
            <span className="material-symbols-outlined text-2xl">toggle_on</span>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">
              ระบบหวยเปิด-ปิด (Lottery Open-Close Status)
            </h2>
            <p className="text-xs text-slate-500">
              ตรวจสอบรายชื่อหวยและควบคุมสถานะการเปิดรับ-ปิดรับแทงได้ทันที (หวยที่เปิดจะอยู่ด้านบนสุดเสมอ)
            </p>
          </div>
        </div>

        {/* Action Button & Status Counter Badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenAddModal && (
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-4 py-2 rounded-xl font-black text-xs bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:brightness-110 text-white shadow-md flex items-center gap-1.5 transition active:scale-95"
              title="เพิ่มประเภทหวยใหม่เข้าสู่ระบบ พร้อมกำหนดหมวดหมู่และอัตราจ่าย"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span>➕ เพิ่มประเภทหวยใหม่</span>
            </button>
          )}

          <button
            onClick={handleApplyOnlyThree}
            disabled={isApplyingPreset}
            className="px-4 py-2 rounded-xl font-black text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-white shadow-md flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
            title="คลิกเดียวเพื่อปิดทุกหวย และเปิดเฉพาะ หวยไทย, หุ้นไทยเช้า, ยี่กี"
          >
            <span className="material-symbols-outlined text-base">rule</span>
            <span>{isApplyingPreset ? 'กำลังดำเนินการ...' : '⚡ เปิดเฉพาะ 3 หวยหลัก (หวยไทย, หุ้นไทยเช้า, ยี่กี)'}</span>
          </button>

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



      {/* Main Table Card (ตารางแถวยาวตามคำสั่งผู้ใช้ จัดเรียงหวยเปิดไว้บนสุด) */}
      <div className="admin-card bg-white overflow-hidden shadow-sm border border-slate-200">
        {/* Search Bar & Reset Selection */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-blue-600">table_rows</span>
              <span>ตารางข้อมูลประเภทหวย ({filteredKeys.length} รายการ)</span>
            </h3>
            {selectedLottery && (
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                <span className="text-[11px] font-bold text-blue-800">
                  กำลังกรอง: <span className="font-black text-blue-900">{selectedLottery}</span>
                </span>
                <button
                  onClick={() => setSelectedLottery('')}
                  className="ml-1 text-[11px] font-black text-blue-700 hover:text-red-600 transition flex items-center gap-0.5"
                  title="ยกเลิกการกรอง แสดงตารางยาวทั้งหมด"
                >
                  <span>✕ แสดงทุกหวย (ตารางยาว)</span>
                </button>
              </div>
            )}
            {!selectedLottery && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                ✓ กำลังแสดงตารางยาวทั้งหมด (หวยเปิดอยู่บนสุด)
              </span>
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
                <th className="py-3.5 px-3 font-black w-10 text-center">#</th>
                <th className="py-3.5 px-3 font-black w-14 text-center">ธง/ภาพ</th>
                <th className="py-3.5 px-5 font-black">ชื่อประเภทหวย</th>
                <th className="py-3.5 px-4 font-black">หมวดหมู่</th>
                <th className="py-3.5 px-4 font-black text-center w-32">เปิด-ปิดรับแทง</th>
                <th className="py-3.5 px-4 font-black text-center w-36">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs font-bold bg-slate-50">
                    ไม่พบประเภทหวยตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredKeys.map((type, idx) => {
                  const item = lotterySettings[type];
                  const isOpen = Boolean(item?.isOpen && !item?.isPaused && item?.status !== 'closed');
                  const catKey = getLotteryCategory(type, item?.category);
                  const catLabel = getCategoryLabel(catKey);
                  const flagSrc = item?.flagUrl || item?.flag_url || (item?.icon && (String(item.icon).startsWith('http') || String(item.icon).startsWith('/')) ? item.icon : null);

                  return (
                    <tr
                      key={type}
                      className={`transition ${
                        isOpen
                          ? 'bg-emerald-50/25 hover:bg-emerald-50/50 border-l-4 border-l-emerald-500'
                          : 'bg-white hover:bg-slate-50 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>

                      {/* ธง / รูปภาพ */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="w-10 h-7 mx-auto rounded-md overflow-hidden border border-slate-300 bg-slate-100 flex items-center justify-center shadow-xs">
                          {flagSrc ? (
                            <img
                              src={flagSrc}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-xl">{item?.icon || '🎯'}</span>
                          )}
                        </div>
                      </td>
                      
                      {/* ชื่อประเภทหวย */}
                      <td className="py-3.5 px-5 font-black text-slate-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={isOpen ? 'text-slate-900 font-black text-sm' : 'text-slate-500 font-bold text-sm'}>
                            {type}
                          </span>
                          {isOpen ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-black shadow-xs animate-pulse">
                              🟢 เปิดรับแทง (อันดับบน)
                            </span>
                          ) : (
                            <span className="text-[9px] px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 font-bold">
                              ปิดรับ
                            </span>
                          )}
                        </div>
                      </td>

                      {/* หมวดหมู่ */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {catLabel}
                        </span>
                      </td>

                      {/* สวิตช์เปิด-ปิดสถานะรับแทง */}
                      <td className="py-3.5 px-4 text-center">
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

                      {/* จัดการ (แก้ไข / ลบ) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {onEditLottery && (
                            <button
                              type="button"
                              onClick={() => onEditLottery({ id: type, name: item?.name || type, ...item })}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 flex items-center gap-1 transition shadow-xs active:scale-95"
                              title={`แก้ไขชื่อ หมวดหมู่ ธง หรือข้อมูลของ ${type}`}
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                              <span>แก้ไข</span>
                            </button>
                          )}
                          {onDeleteLottery && (
                            <button
                              type="button"
                              onClick={() => onDeleteLottery(type)}
                              className="px-2 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 flex items-center gap-0.5 transition shadow-xs active:scale-95"
                              title={`ลบ "${type}" ออกจากระบบ`}
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                              <span>ลบ</span>
                            </button>
                          )}
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
