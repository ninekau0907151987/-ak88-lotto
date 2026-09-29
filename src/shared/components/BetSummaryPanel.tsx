/**
 * src/shared/components/BetSummaryPanel.tsx
 * ------------------------------------------------------------------
 * ★ แผงสรุปยอดแทง — ใช้ร่วมกันทุกหน้าแทงหวย ★
 *
 * แสดง:
 *   1. จำนวนตัวเลขที่รอการแทง (ตัวชี้วัดหลัก ที่ผู้ใช้ขอ)
 *   2. แยกตามประเภทการเล่น — เห็นได้ทันทีว่าประเภทไหนกี่ตัว
 *   3. ราคารวม / ราคาต่อรายการ / รางวัลสูงสุด
 *   4. เตือนเลขซ้ำ + เลขพิเศษ/ลดราคา
 *
 * ★ Responsive:
 *    - มือถือ: แสดงแบบกะทัดรัด เรียงลง (ไม่กระทบ layout เดิม)
 *    - PC: แสดงเต็มรูปแบบ มีคอลัมน์กว้างอ่านง่าย
 */
import type { BetCountSummary } from '@/shared/lib/betCount';
import { fmtMoney, fmtInt } from '@/shared/lib/betCount';

interface Props {
  summary: BetCountSummary;
  /** ราคาต่อ 1 ตัวเลข (ใช้แสดง "ตัวละ X บาท") */
  pricePerNumber?: number;
  /** เครดิตคงเหลือ */
  balance?: number;
  /** ซ่อนส่วนที่ละเอียด (ใช้ในโหมดกะทัดรัด) */
  compact?: boolean;
  /** คลิกที่ประเภท เพื่อกรองดูเฉพาะประเภทนั้น */
  onTypeClick?: (type: string) => void;
  className?: string;
}

export default function BetSummaryPanel({
  summary, pricePerNumber, balance, compact = false, onTypeClick, className = '',
}: Props) {
  const { totalNumbers, totalEntries, totalAmount, maxPayout, byType, duplicateCount } = summary;
  const notEnough = balance !== undefined && totalAmount > balance;

  return (
    <div className={`bg-[#0d1f38] border border-[#f5c518]/25 rounded-xl overflow-hidden ${className}`}>
      {/* ★ 👑 แถบมอนิเตอร์โพยสด VIP ★ */}
      <div className="bg-gradient-to-r from-[#1a1300] via-[#2d2200] to-[#1a1300] px-3 py-1.5 flex items-center justify-between border-b border-amber-400/30 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span>👑</span>
          <span className="font-black text-amber-300">มอนิเตอร์โพยสด VIP</span>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.2 rounded-full ${
          totalAmount >= 500 ? 'bg-amber-400 text-slate-950 shadow-sm' : 'text-amber-200/80 bg-amber-400/10'
        }`}>
          {totalAmount >= 500 ? '👑 บิลระดับ VIP ยอดสูง' : 'สิทธิ์อัตราจ่าย VIP บาทละ 900'}
        </span>
      </div>

      {/* ---- แถวสรุปหลัก ---- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 bg-[#0a192f] border-b border-[#f5c518]/15">
        {/* ★ จำนวนตัวเลข — ตัวเลขสำคัญที่สุด ขยายใหญ่ */}
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#f5c518] text-lg">format_list_numbered</span>
          <div className="leading-none">
            <div className="text-[9px] text-gray-400 font-bold mb-0.5">ตัวเลขที่รอแทง</div>
            <div className="text-[#f5c518] font-black text-xl md:text-2xl tabular-nums">
              {fmtInt(totalNumbers)}
              <span className="text-[11px] font-bold text-gray-400 ml-1">ตัว</span>
            </div>
          </div>
        </div>

        <div className="w-px h-8 bg-[#f5c518]/15 hidden sm:block" />

        {/* ยอดเงิน */}
        <div className="leading-none">
          <div className="text-[9px] text-gray-400 font-bold mb-0.5">ยอดรวม</div>
          <div className={`font-black text-xl md:text-2xl tabular-nums ${notEnough ? 'text-red-400' : 'text-white'}`}>
            ฿{fmtMoney(totalAmount)}
          </div>
        </div>

        {pricePerNumber !== undefined && totalNumbers > 0 && (
          <>
            <div className="w-px h-8 bg-[#f5c518]/15 hidden sm:block" />
            <div className="leading-none">
              <div className="text-[9px] text-gray-400 font-bold mb-0.5">เฉลี่ยตัวละ</div>
              <div className="text-gray-200 font-black text-base md:text-lg tabular-nums">
                ฿{fmtMoney(totalAmount / totalNumbers, 0)}
              </div>
            </div>
          </>
        )}

        {/* เตือนเครดิตไม่พอ */}
        {notEnough && (
          <div className="ml-auto flex items-center gap-1.5 bg-red-500/15 border border-red-500/40 rounded-lg px-2.5 py-1.5">
            <span className="material-symbols-outlined text-red-400 text-sm">warning</span>
            <span className="text-red-300 text-[10px] font-black">
              เครดิตขาด ฿{fmtMoney(totalAmount - (balance || 0))}
            </span>
          </div>
        )}
      </div>

      {/* ---- แยกตามประเภท ---- */}
      {byType.length > 0 && (
        <div className="divide-y divide-[#f5c518]/10">
          {byType.map(t => {
            const clickable = !!onTypeClick;
            return (
              <div
                key={t.type}
                onClick={clickable ? () => onTypeClick!(t.type) : undefined}
                className={`flex items-center gap-2 px-3 py-2 ${clickable ? 'cursor-pointer hover:bg-[#f5c518]/5' : ''} transition-colors`}
              >
                {/* ชื่อประเภท */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold text-[12px] md:text-[13px] truncate">{t.type}</span>
                    {/* ป้ายจำนวนตัว — ★ ตอบโจทย์ "กี่ตัวตามประเภท" */}
                    <span className="shrink-0 bg-[#f5c518] text-[#0a192f] text-[10px] md:text-[11px] font-black px-2 py-[1px] rounded-full tabular-nums">
                      {fmtInt(t.count)} ตัว
                    </span>
                    {t.duplicates.length > 0 && (
                      <span className="shrink-0 bg-red-500/20 text-red-300 border border-red-500/30 text-[9px] font-black px-1.5 py-[1px] rounded-full">
                        ซ้ำ {t.duplicates.length}
                      </span>
                    )}
                    {t.flagged.some(f => f.reason === 'special') && (
                      <span className="shrink-0 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black px-1.5 py-[1px] rounded-full">
                        พิเศษ
                      </span>
                    )}
                    {t.flagged.some(f => f.reason === 'reduced') && (
                      <span className="shrink-0 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black px-1.5 py-[1px] rounded-full">
                        ลดราคา
                      </span>
                    )}
                  </div>

                  {/* แสดงตัวเลขที่มี — ตัดให้สั้นถ้าเยอะ */}
                  {!compact && t.numbers.length > 0 && (
                    <div className="text-[10px] text-gray-500 mt-0.5 truncate font-mono">
                      {t.numbers.slice(0, 18).join(' · ')}
                      {t.numbers.length > 18 ? ` · +${t.numbers.length - 18}` : ''}
                    </div>
                  )}
                </div>

                {/* ยอดเงินประเภทนี้ */}
                <div className="text-right shrink-0">
                  <div className="text-[#f5c518] font-black text-[13px] md:text-sm tabular-nums">
                    ฿{fmtMoney(t.amount)}
                  </div>
                  {!compact && (
                    <div className="text-[9px] text-gray-500 tabular-nums">
                      เฉลี่ย ฿{fmtMoney(t.amount / Math.max(t.count, 1), 0)}/ตัว
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- แถวล่าง: รายละเอียดเพิ่มเติม ---- */}
      {!compact && (byType.length > 0 || duplicateCount > 0) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 bg-[#051121]/60 border-t border-[#f5c518]/10 text-[10px]">
          <span className="text-gray-400">
            รวมรายการ: <span className="text-gray-200 font-bold tabular-nums">{fmtInt(totalEntries)}</span>
            {duplicateCount > 0 && (
              <span className="text-red-400 font-bold"> (มีซ้ำ {fmtInt(duplicateCount)})</span>
            )}
          </span>
          <span className="text-gray-400">
            รางวัลสูงสุด: <span className="text-emerald-400 font-black tabular-nums">฿{fmtMoney(maxPayout, 0)}</span>
          </span>
          <span className="text-gray-400">
            คิดเป็น <span className="text-gray-200 font-bold tabular-nums">{fmtInt(totalNumbers)}</span> ตัวเลข
          </span>
        </div>
      )}

      {/* แถบเตือนเลขซ้ำ */}
      {duplicateCount > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border-t border-red-500/25">
          <span className="material-symbols-outlined text-red-400 text-sm">content_copy</span>
          <span className="text-red-300 text-[10px] font-bold">
            พบเลขซ้ำ {fmtInt(duplicateCount)} รายการ — นับเป็นตัวเดียวแต่ยอดเงินรวมทบ
          </span>
        </div>
      )}

      {totalNumbers === 0 && (
        <div className="px-3 py-4 text-center text-gray-500 text-[11px]">
          ยังไม่มีตัวเลข — เลือกประเภทการเล่นแล้วกรอกตัวเลข
        </div>
      )}
    </div>
  );
}
