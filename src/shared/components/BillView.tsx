/**
 * src/shared/components/BillView.tsx
 * ------------------------------------------------------------------
 * ★ บิล/ใบเสร็จ — จัดฟอร์มสำหรับมือถือเป็นหลัก ★
 *
 * ผู้ใช้ขอ: "ทำบิลให้สวยๆ จัดฟอร์มให้เหมาะกับมือถือ"
 *
 * ออกแบบสำหรับจอเล็ก:
 *   - ความกว้างสูงสุด 380px (เท่าจอมือถือทั่วไป)
 *   - ฟอนต์ mono ในการแสดงข้อความบิล → ตัวเลขตรงกันอ่านง่าย
 *   - ปุ่มคัดลอก/ดาวน์โหลด อยู่ล่างสุด กดด้วยนิ้วโป้งได้
 *   - ไม่มี scroll แนวนอน
 *   - พื้นครีม ตัดกับธีมหลังบ้าน
 */
import { useState } from 'react';
import type { BillData } from '@/shared/lib/bill';
import {
  buildBillText, buildShortBillText, billToRows,
  copyBill, downloadBill, typeLabel,
} from '@/shared/lib/bill';
import StatusBadge from '@/shared/components/StatusBadge';
import { CREAM } from '@/shared/lib/theme';

interface Props {
  bill: BillData;
  /** ซ่อนปุ่มดำเนินการ (ใช้เมื่อแสดงตัวอย่าง) */
  readonly?: boolean;
  className?: string;
}

export default function BillView({ bill, readonly = false, className = '' }: Props) {
  const [copied, setCopied] = useState<'full' | 'short' | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const handleCopy = async (short: boolean) => {
    const ok = await copyBill(bill, short);
    if (ok) {
      setCopied(short ? 'short' : 'full');
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const rowsForDisplay = billToRows(bill);

  return (
    <div className={`mx-auto w-full max-w-[380px] ${className}`}>
      {/* ================= ตัวบิล ================= */}
      <div
        className="rounded-2xl border-2 shadow-lg overflow-hidden"
        style={{ background: CREAM.card, borderColor: CREAM.border }}
      >
        {/* ---- หัวบิล ---- */}
        <div
          className="px-4 py-3.5 text-center border-b-2 border-dashed"
          style={{ background: CREAM.subtle, borderColor: CREAM.border }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xl font-black tracking-tight" style={{ color: CREAM.accentDark }}>
              AK88
            </span>
            <span className="text-xl font-black" style={{ color: CREAM.accent }}>LOTTO</span>
          </div>
          <div className="text-[13px] font-black" style={{ color: CREAM.text }}>
            {typeLabel(bill.type)}
          </div>
          {bill.invoiceNo && (
            <div
              className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tabular-nums font-mono"
              style={{ background: CREAM.accentSoft, color: CREAM.accentDark }}
            >
              {bill.invoiceNo}
            </div>
          )}
          {bill.status && (
            <div className="mt-1.5">
              <StatusBadge status={bill.status} size="xs" dot />
            </div>
          )}
        </div>

        {/* ---- ข้อมูลหลัก (มือถืออ่านง่าย) ---- */}
        <div className="px-4 py-3 space-y-1.5">
          {rowsForDisplay.map((r, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <span className="text-[11px] font-bold shrink-0" style={{ color: CREAM.textMuted }}>
                {r.label}
              </span>
              <span
                className={`text-right min-w-0 ${r.strong ? 'text-[13px] font-black' : 'text-[11px] font-bold'}`}
                style={{ color: r.strong ? CREAM.accentDark : CREAM.text }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>

        {/* ---- เส้นคั่นแบบบิล ---- */}
        <div className="px-4">
          <div className="border-t-2 border-dashed" style={{ borderColor: CREAM.borderStrong }} />
        </div>

        {/* ---- รายการ ---- */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: CREAM.textMuted }}>
              รายการ
            </span>
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{ background: CREAM.accentSoft, color: CREAM.accentDark }}
            >
              {bill.lines.length} รายการ
            </span>
          </div>

          <div className="space-y-1.5">
            {bill.lines.map((ln, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5"
                style={{ background: CREAM.subtle }}
              >
                <span
                  className="text-[10px] font-black shrink-0 w-5 h-5 rounded flex items-center justify-center tabular-nums"
                  style={{ background: CREAM.accent, color: '#fff' }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold break-words" style={{ color: CREAM.text }}>
                    {ln.description}
                  </div>
                  {ln.rate ? (
                    <div className="text-[10px] font-bold" style={{ color: CREAM.textMuted }}>
                      อัตราจ่าย ×{ln.rate}
                    </div>
                  ) : null}
                </div>
                <span className="text-[12px] font-black tabular-nums shrink-0" style={{ color: CREAM.accentDark }}>
                  {ln.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
            {bill.lines.length === 0 && (
              <div className="text-center py-4 text-[11px]" style={{ color: CREAM.textFaint }}>
                ไม่มีรายการ
              </div>
            )}
          </div>
        </div>

        {/* ---- ยอดรวม ---- */}
        <div
          className="px-4 py-3 border-t-2 border-dashed"
          style={{ background: CREAM.subtle, borderColor: CREAM.borderStrong }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-black" style={{ color: CREAM.text }}>รวมทั้งสิ้น</span>
            <span className="text-xl font-black tabular-nums" style={{ color: CREAM.accentDark }}>
              ฿{bill.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </span>
          </div>
          {bill.balanceAfter !== undefined && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-bold" style={{ color: CREAM.textMuted }}>เครดิตคงเหลือ</span>
              <span className="text-[13px] font-black tabular-nums" style={{ color: CREAM.text }}>
                ฿{bill.balanceAfter.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {/* ---- ท้ายบิล ---- */}
        <div className="px-4 py-3 text-center border-t" style={{ borderColor: CREAM.border }}>
          {bill.note && (
            <div className="text-[10px] mb-1.5 font-bold" style={{ color: CREAM.textMuted }}>
              {bill.note}
            </div>
          )}
          <div className="text-[10px] font-bold" style={{ color: CREAM.textMuted }}>
            ขอบคุณที่ใช้บริการ • โชคดีนะคะ/ครับ 🍀
          </div>
        </div>
      </div>

      {/* ================= ปุ่มดำเนินการ (ล่างสุด กดง่าย) ================= */}
      {!readonly && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleCopy(false)}
              className="py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
              style={{ background: CREAM.accent, color: '#fff' }}
            >
              <span className="material-symbols-outlined text-base">
                {copied === 'full' ? 'check' : 'content_copy'}
              </span>
              {copied === 'full' ? 'คัดลอกแล้ว' : 'คัดลอกบิล'}
            </button>
            <button
              onClick={() => handleCopy(true)}
              className="py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] border-2"
              style={{ background: CREAM.card, borderColor: CREAM.accent, color: CREAM.accentDark }}
            >
              <span className="material-symbols-outlined text-base">
                {copied === 'short' ? 'check' : 'share'}
              </span>
              {copied === 'short' ? 'คัดลอกแล้ว' : 'ส่ง LINE'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => downloadBill(bill)}
              className="py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] border"
              style={{ background: CREAM.subtle, borderColor: CREAM.border, color: CREAM.text }}
            >
              <span className="material-symbols-outlined text-base">download</span>
              ดาวน์โหลด
            </button>
            <button
              onClick={() => window.print()}
              className="py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] border"
              style={{ background: CREAM.subtle, borderColor: CREAM.border, color: CREAM.text }}
            >
              <span className="material-symbols-outlined text-base">print</span>
              พิมพ์
            </button>
          </div>

          {/* ดูข้อความดิบ — สำหรับตรวจสอบ/แก้ปัญหา */}
          <button
            onClick={() => setShowRaw(v => !v)}
            className="w-full py-2 rounded-lg text-[10px] font-bold transition"
            style={{ color: CREAM.textMuted }}
          >
            {showRaw ? '▲ ซ่อนข้อความบิล' : '▼ ดูข้อความบิล (แบบข้อความ)'}
          </button>
          {showRaw && (
            <pre
              className="text-[10px] leading-relaxed rounded-xl p-3 overflow-x-auto font-mono whitespace-pre"
              style={{ background: '#2a2a2a', color: '#e8e0d0' }}
            >
              {buildBillText(bill)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
