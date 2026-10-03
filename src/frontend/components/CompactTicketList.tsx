import React, { useState, useMemo } from 'react';
import { BetItem, TicketData } from './BillDetailModal';

interface CompactTicketListProps {
  tickets: TicketData[];
  currentTime: number;
  onSelectTicketForBill: (ticket: TicketData) => void;
  onCopyTicketText: (ticket: TicketData) => void;
  onCancelTicket: (ticketId: string, amount: number) => void;
  formatRemainingTime: (expiresAt: number) => string;
}

export default function CompactTicketList({
  tickets,
  currentTime,
  onSelectTicketForBill,
  onCopyTicketText,
  onCancelTicket,
  formatRemainingTime,
}: CompactTicketListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'cancelled'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter tickets by search and status
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // 1. Status filter
      if (statusFilter === 'active' && ticket.status === 'cancelled') return false;
      if (statusFilter === 'cancelled' && ticket.status !== 'cancelled') return false;

      // 2. Search filter (ticket ID, customer name, date, numbers)
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();

      const matchId = ticket.id.toLowerCase().includes(term);
      const matchCustomer = (ticket.customerName || '').toLowerCase().includes(term);
      const matchDate = new Date(ticket.createdAt).toLocaleString('th-TH').includes(term);
      const matchNumbers = (ticket.bets || []).some(b =>
        b.number.includes(term) || b.type.toLowerCase().includes(term)
      );

      return matchId || matchCustomer || matchDate || matchNumbers;
    });
  }, [tickets, statusFilter, searchTerm]);

  // Total summary of filtered tickets
  const filteredTotal = useMemo(() => {
    return filteredTickets.reduce((sum, t) => sum + (t.status === 'cancelled' ? 0 : t.totalAmount), 0);
  }, [filteredTickets]);

  const handleCopy = (ticket: TicketData) => {
    onCopyTicketText(ticket);
    setCopiedId(ticket.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (tickets.length === 0) return null;

  return (
    <div className="space-y-3 mt-4">
      {/* Header with Title and Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-4 border-[var(--gold-vibrant,#d4af37)] pl-2.5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--navy-deep,#0a192f)]">receipt_long</span>
          <div>
            <h3 className="font-black text-[var(--navy-deep,#0a192f)] text-sm">
              รายการโพยที่ส่งแล้ว ({tickets.length} บิล)
            </h3>
            <div className="text-[10px] text-gray-500 font-bold">
              ยอดสุทธิรวม: ฿{filteredTotal.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-gray-200/80 p-0.5 rounded-lg gap-0.5 self-start sm:self-auto">
          {(['all', 'active', 'cancelled'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`text-[10px] font-black px-2.5 py-1 rounded-md transition-all ${
                statusFilter === f
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {f === 'all' ? 'ทั้งหมด' : f === 'active' ? 'รอลุ้นผล' : 'ยกเลิก'}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-2.5 top-2 text-gray-400 text-sm">
          search
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="ค้นหาบิล: รหัสบิล, ชื่อลูกค้า, ตัวเลข, หรือเวลา..."
          className="w-full pl-8 pr-8 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500 shadow-sm placeholder:text-gray-400"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
          >
            <span className="material-symbols-outlined text-sm">cancel</span>
          </button>
        )}
      </div>

      {/* Empty Search Result */}
      {filteredTickets.length === 0 && (
        <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs font-bold">
          ไม่พบบิลที่ตรงกับคำค้นหา &ldquo;{searchTerm}&rdquo;
        </div>
      )}

      {/* Compact Tickets List */}
      <div className="space-y-2.5">
        {filteredTickets.map(ticket => {
          const isExpired = currentTime >= ticket.expiresAt;
          const isCancelled = ticket.status === 'cancelled';

          return (
            <div
              key={ticket.id}
              className={`bg-white rounded-xl border transition-all hover:shadow-md overflow-hidden ${
                isCancelled
                  ? 'border-gray-200 bg-gray-50/70 opacity-75'
                  : 'border-gray-200 shadow-sm hover:border-blue-300'
              }`}
            >
              {/* Card Top Row: ID, Customer, Status, Amount */}
              <div className="p-2.5 flex items-start justify-between gap-2 border-b border-gray-100 bg-[#fbfbfe]">
                <div className="flex items-start gap-2 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 mt-0.5 ${
                      isCancelled ? 'bg-gray-400' : 'bg-[var(--navy-deep,#0a192f)]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">confirmation_number</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-gray-800 text-[11px]">
                        #{ticket.id.slice(-8)}
                      </span>
                      {ticket.customerName && (
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded text-[9px] font-black border border-blue-100 truncate max-w-[120px]">
                          👤 {ticket.customerName}
                        </span>
                      )}
                      {isCancelled ? (
                        <span className="bg-red-100 text-red-700 text-[8px] font-black px-1.5 py-0.5 rounded border border-red-200">
                          ยกเลิก
                        </span>
                      ) : (
                        <span className="bg-green-100 text-green-700 text-[8px] font-black px-1.5 py-0.5 rounded border border-green-200">
                          รอลุ้น
                        </span>
                      )}
                    </div>

                    <div className="text-[9px] text-gray-400 font-bold mt-0.5 flex items-center gap-1.5">
                      <span>{new Date(ticket.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                      {!isExpired && !isCancelled && (
                        <span className="text-red-500 font-black flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[10px] animate-pulse">timer</span>
                          {formatRemainingTime(ticket.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0">
                  <div className="text-[8px] font-black text-gray-400 uppercase">ยอดแทง</div>
                  <div
                    className={`text-sm font-black font-mono leading-tight ${
                      isCancelled ? 'text-gray-400 line-through' : 'text-blue-700'
                    }`}
                  >
                    ฿{ticket.totalAmount.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Card Mid: Bets Preview (Compact Chips) */}
              <div className="px-2.5 py-1.5 bg-white flex flex-wrap gap-1 items-center">
                {(ticket.bets || []).slice(0, 6).map((b, bIdx) => (
                  <span
                    key={bIdx}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-[10px] font-mono"
                  >
                    <span className="font-bold text-gray-700">{b.number}</span>
                    <span className="text-red-600 font-black">={b.amount}</span>
                  </span>
                ))}
                {(ticket.bets || []).length > 6 && (
                  <span className="text-[9px] font-bold text-gray-400 px-1">
                    +อีก {(ticket.bets || []).length - 6} รายการ
                  </span>
                )}
              </div>

              {/* Card Footer: Action Buttons */}
              <div className="p-2 bg-gray-50/60 border-t border-gray-100 flex items-center gap-1.5">
                <button
                  onClick={() => onSelectTicketForBill(ticket)}
                  className="flex-1 py-1 px-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 transition"
                >
                  <span className="material-symbols-outlined text-xs">receipt</span>
                  ดูบิลแยก
                </button>

                <button
                  onClick={() => handleCopy(ticket)}
                  className="flex-1 py-1 px-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 transition"
                >
                  <span className="material-symbols-outlined text-xs">
                    {copiedId === ticket.id ? 'check' : 'content_copy'}
                  </span>
                  {copiedId === ticket.id ? 'คัดลอกแล้ว' : 'ส่งไลน์'}
                </button>

                {!isCancelled && !isExpired && (
                  <button
                    onClick={() => onCancelTicket(ticket.id, ticket.totalAmount)}
                    className="py-1 px-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-[10px] font-black flex items-center justify-center gap-0.5 transition"
                    title="ยกเลิกโพยนี้"
                  >
                    <span className="material-symbols-outlined text-xs">cancel</span>
                    ยกเลิก
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
