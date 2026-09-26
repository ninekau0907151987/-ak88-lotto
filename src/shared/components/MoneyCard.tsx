/**
 * src/shared/components/MoneyCard.tsx
 * ------------------------------------------------------------------
 * ★ การ์ดตัวเลขเงิน — แทนกล่องดำเดิม ★
 *
 * ปัญหาเดิม (ที่ผู้ใช้ส่งโค้ดมา):
 *   <div class="bg-black text-white ...">   ← ดำสนิท ดูแข็ง ไม่เข้าธีม
 *     <div class="bg-white text-black ...">ยอดเครดิตคงเหลือ</div>
 *     <div class="text-white">฿ 54,640.00</div>
 *   </div>
 *
 * ปัญหาของแบบเดิม:
 *   1. สีดำตัดกับพื้นครีม → ดูเป็นหลุม
 *   2. ป้ายชื่อลอยอยู่ขอบบน (-top-2.5) → ทับเส้นขอบ ดูรก
 *   3. ตัวเลขไม่มี aria-label → screen reader อ่านไม่ได้
 *   4. ไม่รองรับค่าลบ (ควรเป็นสีแดง)
 *
 * แบบใหม่: พื้นครีมเข้ม + ขอบนุ่ม + ตัวเลขใหญ่ + ป้ายในกล่อง
 */
import { fmtMoney } from '@/shared/lib/betCount';

interface Props {
  label: string;
  value: number | string;
  /** ไอคอน material symbol */
  icon?: string;
  /** โทนสี */
  tone?: 'default' | 'gold' | 'green' | 'red' | 'blue' | 'dark' | 'purple' | 'orange' | 'slate';
  /** ขนาด */
  size?: 'sm' | 'md' | 'lg';
  /** แสดงเครื่องหมาย ฿ */
  currency?: boolean;
  /** คำอธิบายย่อย */
  hint?: string;
  className?: string;
}

const TONE = {
  default: { bg: '#f5efe2', border: '#e8dfcc', label: '#8a7d6b', value: '#3d3226', icon: '#a67c52' },
  gold:    { bg: '#fdf6e3', border: '#f0dfae', label: '#9a7b2e', value: '#8a6a1f', icon: '#c9a227' },
  green:   { bg: '#eef7ef', border: '#c3e0c5', label: '#4a7c50', value: '#2e7d32', icon: '#4caf50' },
  red:     { bg: '#fdf0ee', border: '#f0cdc8', label: '#9c4a44', value: '#b3261e', icon: '#e53935' },
  blue:    { bg: '#eef4fb', border: '#c8ddf2', label: '#4a6d92', value: '#1565c0', icon: '#2196f3' },
  /** ★ เข้ม — สำหรับ "รายได้แพลตฟอร์ม" ให้เด่นแต่ยังอุ่น ไม่ดำสนิท */
  dark:    { bg: '#3d3226', border: '#5a4a38', label: '#c9b8a0', value: '#f5c518', icon: '#f5c518' },
  purple:  { bg: '#f4eefb', border: '#dbcbef', label: '#6a4a92', value: '#6a1b9a', icon: '#9c27b0' },
  orange:  { bg: '#fdf2e8', border: '#f5d5b3', label: '#96602c', value: '#e65100', icon: '#ff9800' },
  slate:   { bg: '#f0f2f4', border: '#d5dbe0', label: '#5c6b78', value: '#37474f', icon: '#607d8b' },
};

const SIZE = {
  sm: { pad: 'px-3 py-2', label: 'text-[9px]', value: 'text-base' },
  md: { pad: 'px-3 py-2.5', label: 'text-[10px]', value: 'text-xl' },
  lg: { pad: 'px-4 py-3', label: 'text-[11px]', value: 'text-2xl sm:text-3xl' },
};

export default function MoneyCard({
  label, value, icon, tone = 'default', size = 'md',
  currency = true, hint, className = '',
}: Props) {
  const t = TONE[tone];
  const isNeg = typeof value === 'number' && value < 0;

  const display = typeof value === 'number'
    ? `${isNeg ? '-' : ''}${currency ? '฿' : ''}${fmtMoney(Math.abs(value))}`
    : value;

  return (
    <div
      className={`rounded-2xl border shadow-sm ${SIZE[size].pad} ${className}`}
      style={{ background: t.bg, borderColor: t.border }}
      role="group"
      aria-label={`${label}: ${display}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon && (
          <span className="material-symbols-outlined shrink-0"
            style={{ color: t.icon, fontSize: size === 'lg' ? 18 : 14 }}>
            {icon}
          </span>
        )}
        <span className={`font-black uppercase tracking-wide truncate ${SIZE[size].label}`}
          style={{ color: t.label }}>
          {label}
        </span>
      </div>
      <div
        className={`font-black leading-none tabular-nums truncate ${SIZE[size].value}`}
        style={{ color: isNeg ? TONE.red.value : t.value }}
        title={display}
      >
        {display}
      </div>
      {hint && (
        <div className="text-[10px] mt-1 font-bold truncate" style={{ color: t.label }}>
          {hint}
        </div>
      )}
    </div>
  );
}
