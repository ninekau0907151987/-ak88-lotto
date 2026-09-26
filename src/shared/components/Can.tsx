/**
 * src/shared/components/Can.tsx
 * ------------------------------------------------------------------
 * ★ Component ครอบสิทธิ์ — ซ่อน/แสดงตามสิทธิ์ ★
 *
 * วิธีใช้:
 *   <Can perm={PERMISSIONS.MEMBER_CREDIT_ADD}>
 *     <button>เพิ่มเครดิต</button>
 *   </Can>
 *
 *   <Can all={[PERMISSIONS.FINANCE_VIEW, PERMISSIONS.FINANCE_EXPORT]} fallback={<NoAccess/>}>
 *     ...
 *   </Can>
 * ================================================================== */
import { ReactNode } from 'react';
import { usePermission } from '@/shared/hooks/usePermission';
import { PERMISSION_META, type Permission } from '@/shared/lib/permissions';

interface Props {
  /** ต้องมีสิทธิ์นี้ */
  perm?: Permission;
  /** ต้องมีอย่างน้อย 1 */
  any?: Permission[];
  /** ต้องมีทั้งหมด */
  all?: Permission[];
  children: ReactNode;
  /** แสดงเมื่อไม่มีสิทธิ์ (ค่าเริ่มต้น: ไม่แสดงอะไร) */
  fallback?: ReactNode;
  /** ★ โหมดซ่อนแบบเห็นไม่ได้เลย (ค่าเริ่มต้น) */
  mode?: 'hide' | 'lock';
  /** ข้อความ custom */
  lockLabel?: string;
}

export default function Can({
  perm, any, all, children, fallback, mode = 'hide', lockLabel,
}: Props) {
  const { can, canAny, canAll, ready, deny } = usePermission();
  if (!ready) return null;

  let allowed = true;
  let reason: string | null = null;

  if (perm) {
    allowed = can(perm);
    reason = deny(perm);
  } else if (any) {
    allowed = canAny(any);
  } else if (all) {
    allowed = canAll(all);
  }

  if (allowed) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  // โหมด lock: แสดงปุ่มแต่กดไม่ได้ + บอกเหตุผล
  if (mode === 'lock' && (perm || any?.[0])) {
    const p = perm || any![0];
    const meta = PERMISSION_META[p];
    return (
      <div
        title={lockLabel || reason || 'ไม่มีสิทธิ์ใช้งาน'}
        className="rounded-xl border-2 border-dashed px-3 py-2 flex items-center justify-center gap-1.5 select-none"
        style={{ borderColor: 'var(--admin-border-strong, #d9cdb4)', background: 'var(--admin-subtle, #f5efe2)', color: 'var(--admin-text-faint, #b3a897)' }}
      >
        <span className="material-symbols-outlined text-base">lock</span>
        <span className="text-[10px] font-bold">{lockLabel || meta?.label || 'ไม่มีสิทธิ์'}</span>
      </div>
    );
  }

  return null;
}

/** ป้ายบอกว่าไม่มีสิทธิ์ (ใช้แทนทั้งบล็อก) */
export function NoAccess({ perm, label }: { perm?: Permission; label?: string }) {
  const meta = perm ? PERMISSION_META[perm] : null;
  return (
    <div className="rounded-2xl border-2 border-dashed p-10 text-center"
      style={{ borderColor: 'var(--admin-border-strong, #d9cdb4)', background: 'var(--admin-subtle, #f5efe2)' }}>
      <span className="material-symbols-outlined text-4xl mb-2" style={{ color: 'var(--admin-text-faint, #b3a897)' }}>
        lock
      </span>
      <div className="font-black text-sm" style={{ color: 'var(--admin-text-muted, #8a7d6b)' }}>
        ไม่มีสิทธิ์เข้าถึง
      </div>
      {meta && (
        <div className="text-[11px] mt-1" style={{ color: 'var(--admin-text-faint, #b3a897)' }}>
          ต้องได้รับสิทธิ์ "{label || meta.label}" จากผู้ดูแลระบบ
        </div>
      )}
    </div>
  );
}
