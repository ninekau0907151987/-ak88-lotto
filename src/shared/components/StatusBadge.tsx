/**
 * src/shared/components/StatusBadge.tsx
 * ------------------------------------------------------------------
 * ★ ป้ายสถานะมาตรฐาน — สถานะเดียวกันสีเดียวกันทุกหน้า ★
 *
 * ผู้ใช้ขอ: "ออกแบบสีสถานะต่างๆ"
 * → ใช้ STATUS map จาก shared/lib/theme.ts เป็นแหล่งเดียว
 *
 * วิธีใช้:
 *   <StatusBadge status="pending" />              // ใช้ label อัตโนมัติ
 *   <StatusBadge status="win" label="ถูก 3 ตัวบน" />  // กำหนด label เอง
 *   <StatusBadge status="critical" size="sm" dot />
 */
import { statusOf } from '@/shared/lib/theme';

interface Props {
  /** คีย์สถานะ: pending | approved | win | lose | cancelled | ... */
  status: string;
  /** ทับข้อความ (ถ้าไม่ส่งจะใช้ label จาก STATUS) */
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  /** แสดงจุดสีข้างหน้า */
  dot?: boolean;
  /** ไอคอน material symbol */
  icon?: string;
  className?: string;
}

const SIZE = {
  xs: 'text-[9px] px-1.5 py-[1px] gap-0.5',
  sm: 'text-[10px] px-2 py-[2px] gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
};

export default function StatusBadge({
  status, label, size = 'sm', dot = false, icon, className = '',
}: Props) {
  const s = statusOf(status);
  return (
    <span
      className={`inline-flex items-center font-black rounded-full border whitespace-nowrap tabular-nums ${SIZE[size]} ${className}`}
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      )}
      {icon && <span className="material-symbols-outlined" style={{ fontSize: 'inherit' }}>{icon}</span>}
      {label ?? s.label}
    </span>
  );
}

/**
 * จุดสถานะ + ข้อความ (ใช้ในตาราง/รายการ)
 */
export function StatusDot({ status, label }: { status: string; label?: string }) {
  const s = statusOf(status);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.dot }} />
      <span className="text-xs font-bold" style={{ color: s.text }}>{label ?? s.label}</span>
    </span>
  );
}
