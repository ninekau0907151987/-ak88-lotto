import React, { useState } from 'react';
import { motion } from 'motion/react';

export interface BetItem {
  id: string;
  number: string;
  amount: number;
  type: string;
  payoutRate?: number;
  isSpecial?: boolean;
  isReduced?: boolean;
}

export interface TicketData {
  id: string;
  bets: BetItem[];
  totalAmount: number;
  createdAt: number;
  expiresAt: number;
  status?: string;
  customerName?: string;
  lotteryType?: string;
}

interface BillDetailModalProps {
  ticket: TicketData | null;
  onClose: () => void;
  onUpdateCustomerName?: (ticketId: string, newName: string) => Promise<void> | void;
  onCancelTicket?: (ticketId: string, amount: number) => void;
  taxRate?: number;
}

export default function BillDetailModal({
  ticket,
  onClose,
  onUpdateCustomerName,
  onCancelTicket,
  taxRate = 1,
}: BillDetailModalProps) {
  if (!ticket) return null;

  const [customerName, setCustomerName] = useState(ticket.customerName || 'ลูกค้าทั่วไป');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const isCancelled = ticket.status === 'cancelled';
  const isExpired = Date.now() >= ticket.expiresAt;

  // Format bill text for LINE
  const getBillText = () => {
    const lName = ticket.lotteryType || 'หวยทั่วไป';
    let text = `=============================\n`;
    text += `   AK88 LOTTO - ใบเสร็จโพยหวย\n`;
    text += `   ประเภท: ${lName}\n`;
    text += `=============================\n`;
    text += `เลขบิล: ${ticket.id}\n`;
    text += `วันที่: ${new Date(ticket.createdAt).toLocaleString('th-TH')}\n`;
    text += `ชื่อลูกค้า/ชื่อบิล: ${customerName}\n`;
    text += `สถานะ: ${isCancelled ? 'ยกเลิกแล้ว' : 'รอลุ้นผล'}\n`;
    text += `-----------------------------\n`;

    const grouped = (ticket.bets || []).reduce((acc: Record<string, BetItem[]>, bet) => {
      if (!acc[bet.type]) acc[bet.type] = [];
      acc[bet.type].push(bet);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([type, bets]) => {
      const typeTotal = bets.reduce((sum, b) => sum + b.amount, 0);
      text += `▶ [${type}]\n`;
      const lines = bets.map(b => `${b.number}=${b.amount}`);
      for (let i = 0; i < lines.length; i += 3) {
        text += `   ${lines.slice(i, i + 3).join(', ')}\n`;
      }
      text += `   รวมประเภทนี้: ฿${typeTotal.toLocaleString()}\n`;
      text += `-----------------------------\n`;
    });

    text += `ยอดรวมสุทธิ: ฿${ticket.totalAmount.toLocaleString()}\n`;
    if (taxRate > 0) {
      text += `* หัก ณ ที่จ่าย ${taxRate}% (เมื่อถูกรางวัล)\n`;
    }
    text += `=============================\n`;
    text += `* ขอบคุณที่ใช้บริการ AK88 LOTTO *\n`;
    return text;
  };

  const handleCopyBill = () => {
    navigator.clipboard.writeText(getBillText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(ticket.id).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const handleSaveName = async () => {
    if (!onUpdateCustomerName) return;
    setIsSavingName(true);
    try {
      await onUpdateCustomerName(ticket.id, customerName.trim() || 'ลูกค้าทั่วไป');
      setIsEditingName(false);
    } catch {
      alert('บันทึกชื่อบิลไม่สำเร็จ');
    } finally {
      setIsSavingName(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Group bets
  const groupedBets = (ticket.bets || []).reduce((acc: Record<string, BetItem[]>, bet) => {
    if (!acc[bet.type]) acc[bet.type] = [];
    acc[bet.type].push(bet);
    return acc;
  }, {});

  const DEFAULT_RATES: Record<string, number> = {
    '3 ตัวบน': 900,
    '3 ตัวโต๊ด': 150,
    '2 ตัวบน': 90,
    '2 ตัวล่าง': 90,
    '3 ตัวล่าง': 450,
    '3 ตัวหน้า': 450,
    '2 ตัวโต๊ด': 13,
    'วิ่งบน': 3.2,
    'วิ่งล่าง': 4.2,
    '4 ตัวบน': 7000,
    '4 ตัวโต๊ด': 250,
  };

  const totalPotentialWin = (ticket.bets || []).reduce((sum, b) => {
    const rate = b.payoutRate || DEFAULT_RATES[b.type] || 900;
    return sum + (Number(b.amount || 0) * Number(rate || 0));
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/75 z-[300] flex items-center justify-center p-3 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 15 }}
        className="bg-white rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),0_12px_28px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden flex flex-col max-h-[92vh] border-2 border-[var(--gold-vibrant,#d4af37)]/70 relative"
      >
        {/* รอยบากตั๋วซ้ายขวา (Ticket Side Notches) */}
        <div className="absolute -left-3.5 top-[230px] w-7 h-7 rounded-full bg-[#060c2b] shadow-inner z-20 pointer-events-none"></div>
        <div className="absolute -right-3.5 top-[230px] w-7 h-7 rounded-full bg-[#060c2b] shadow-inner z-20 pointer-events-none"></div>

        {/* Header - Receipt Style */}
        <div className="bg-[var(--navy-deep,#0a192f)] text-white p-4 relative text-center border-b-4 border-[var(--gold-vibrant,#d4af37)]">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>

          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--gold-vibrant,#d4af37)]/20 text-[var(--gold-vibrant,#d4af37)] mb-1">
            <span className="material-symbols-outlined text-2xl">receipt_long</span>
          </div>
          <h2 className="text-lg font-black tracking-wide">ใบเสร็จโพยหวย / สลิปบิล</h2>
          <div className="text-xs text-gray-300 font-medium">AK88 LOTTO OFFICIAL RECEIPT</div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 bg-gray-50/50 text-xs">
          
          {/* Status Badge */}
          <div className="flex items-center justify-between bg-amber-50/90 border border-amber-300 rounded-xl p-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
              <div>
                <div className="text-[10px] text-amber-700 font-bold leading-none">สถานะโพยปัจจุบัน</div>
                <div className="text-xs font-black text-amber-900 mt-0.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-amber-600">hourglass_top</span>
                  <span>{isCancelled ? 'ยกเลิกแล้ว' : 'รอผลรางวัล'}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">verified</span>
                <span>เข้าถูก 100%</span>
              </span>
              <div className="text-[9px] text-gray-500 font-bold mt-0.5">บันทึกในระบบแล้ว</div>
            </div>
          </div>

          {/* 3D Financial Summary Card: ยอดแทงรวม & โอกาสถูกสูงสุด */}
          <div className="bg-gradient-to-br from-red-50 via-rose-50 to-amber-50 border border-red-200 rounded-2xl p-2.5 shadow-sm space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/90 rounded-xl p-2 text-center border border-red-200/60 shadow-xs">
                <div className="text-[10px] text-gray-500 font-bold">ยอดเงินแทงรวม</div>
                <div className="text-lg sm:text-xl font-black text-red-600 font-mono tracking-tight mt-0.5">
                  ฿ {ticket.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-100 to-yellow-50 rounded-xl p-2 text-center border border-amber-300 shadow-xs">
                <div className="text-[10px] text-amber-800 font-bold flex items-center justify-center gap-0.5">
                  <span className="material-symbols-outlined text-xs text-amber-600">stars</span>
                  <span>โอกาสถูกสูงสุด</span>
                </div>
                <div className="text-lg sm:text-xl font-black text-amber-900 font-mono tracking-tight mt-0.5">
                  ฿ {totalPotentialWin.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
              </div>
            </div>

            <div className="text-[9px] text-center text-amber-700 font-medium">
              💡 คำนวณจากราคาจ่ายสูงสุดของแต่ละประเภท (เช่น แทง ฿5 ลุ้นสูงสุด ฿4,500 - ฿9,000)
            </div>
          </div>

          {/* Bill Info Card */}
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <span className="text-gray-500 font-bold">รหัสบิล</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                  {ticket.id}
                </span>
                <button
                  onClick={handleCopyId}
                  title="คัดลอกรหัสบิล"
                  className="p-1 rounded hover:bg-gray-100 text-gray-500 transition"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copiedId ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>

            {/* Editable Customer Name */}
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <span className="text-gray-500 font-bold">ชื่อลูกค้า / ชื่อบิล</span>
              {isEditingName ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="ระบุชื่อลูกค้า..."
                    className="px-2 py-1 border border-blue-400 rounded text-xs font-bold w-32 outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isSavingName}
                    className="px-2 py-1 bg-green-600 text-white rounded text-[10px] font-black hover:bg-green-700 disabled:opacity-50"
                  >
                    {isSavingName ? '...' : 'บันทึก'}
                  </button>
                  <button
                    onClick={() => {
                      setCustomerName(ticket.customerName || 'ลูกค้าทั่วไป');
                      setIsEditingName(false);
                    }}
                    className="px-1.5 py-1 bg-gray-200 text-gray-600 rounded text-[10px] font-bold"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-gray-800">{customerName}</span>
                  {onUpdateCustomerName && (
                    <button
                      onClick={() => setIsEditingName(true)}
                      title="แก้ไขชื่อบิล"
                      className="p-0.5 text-blue-600 hover:text-blue-800"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <span className="text-gray-500 font-bold">เวลาทำรายการ</span>
              <span className="font-bold text-gray-700">
                {new Date(ticket.createdAt).toLocaleString('th-TH')}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-bold">สถานะบิล</span>
              {isCancelled ? (
                <span className="bg-red-100 text-red-700 font-black px-2 py-0.5 rounded text-[10px] border border-red-200">
                  ยกเลิกแล้ว (คืนเครดิต)
                </span>
              ) : (
                <span className="bg-green-100 text-green-700 font-black px-2 py-0.5 rounded text-[10px] border border-green-200">
                  รอลุ้นผลรางวัล
                </span>
              )}
            </div>
          </div>

          {/* Grouped Bets Detail */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-100 px-3 py-2 font-black text-gray-700 flex justify-between items-center border-b">
              <span>รายการแทงทั้งหมด ({ticket.bets?.length || 0} รายการ)</span>
              <span className="text-[10px] font-bold text-gray-500">{Object.keys(groupedBets).length} ประเภท</span>
            </div>

            <div className="p-3 space-y-2.5 max-h-48 overflow-y-auto">
              {Object.entries(groupedBets).map(([type, bets]) => {
                const typeTotal = bets.reduce((sum, b) => sum + b.amount, 0);
                const rate = DEFAULT_RATES[type] || 900;
                return (
                  <div key={type} className="border border-gray-100 rounded-lg p-2 bg-[#fdfcfa]">
                    <div className="flex justify-between items-center mb-1 pb-1 border-b border-dashed border-gray-200">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded text-[10px]">
                          {type}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold">
                          จ่าย ฿{rate}
                        </span>
                      </div>
                      <span className="font-bold text-gray-600">รวม ฿{typeTotal.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {bets.map((b, idx) => {
                        const itemWin = b.amount * rate;
                        return (
                          <div key={idx} className="bg-white p-1.5 rounded border border-gray-100 flex justify-between items-center font-mono">
                            <div>
                              <span className="font-black text-gray-800 text-xs">{b.number}</span>
                              <span className="text-[9px] text-emerald-600 block">ลุ้น ฿{itemWin.toLocaleString()}</span>
                            </div>
                            <span className="text-red-600 font-black text-xs">฿{b.amount}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* สถานะ QR Code สำหรับตรวจสอบโพย */}
          <div className="bg-slate-900 text-white rounded-2xl p-2.5 border border-slate-700 shadow-md flex items-center gap-2.5">
            <div className="w-16 h-16 bg-white p-1 rounded-xl shadow shrink-0 flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`https://ak88-lotto.vercel.app/tickets?id=${ticket.id}`)}&margin=2`}
                alt="Ticket QR Code"
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-[11px] font-black text-amber-400">
                <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                <span>QR เช็คสถานะโพย</span>
              </div>
              <p className="text-[9px] text-slate-300 mt-0.5 leading-tight">
                สแกนตรวจสอบสถานะบิล ตรวจผลรางวัลสดได้ 24 ชม.
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  เข้าถูก 100%
                </span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold px-1.5 py-0.2 rounded">
                  สถานะ: {isCancelled ? 'ยกเลิกแล้ว' : 'รอผลรางวัล'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyBill}
              className="py-2.5 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-base">
                {copied ? 'check_circle' : 'content_copy'}
              </span>
              {copied ? 'คัดลอกแล้ว!' : 'คัดลอกส่งไลน์'}
            </button>

            <button
              onClick={handlePrint}
              className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-base">print</span>
              พิมพ์สลิปบิล
            </button>
          </div>

          <div className="flex gap-2">
            {!isCancelled && !isExpired && onCancelTicket && (
              <button
                onClick={() => {
                  if (confirm(`ต้องการยกเลิกโพย ${ticket.id} และคืนเครดิต ฿${ticket.totalAmount.toLocaleString()} ใช่หรือไม่?`)) {
                    onCancelTicket(ticket.id, ticket.totalAmount);
                    onClose();
                  }
                }}
                className="flex-1 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-black rounded-xl text-xs flex items-center justify-center gap-1 transition"
              >
                <span className="material-symbols-outlined text-sm">cancel</span>
                ยกเลิกโพยนี้
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-black rounded-xl text-xs flex items-center justify-center gap-1 transition"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
