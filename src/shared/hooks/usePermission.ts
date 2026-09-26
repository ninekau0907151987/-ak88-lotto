/**
 * src/shared/hooks/usePermission.ts
 * ------------------------------------------------------------------
 * ★ Hook สำหรับตรวจสิทธิ์ในหน้าจอ ★
 *
 * วิธีใช้:
 *   const { can, session, role } = usePermission();
 *   if (!can(PERMISSIONS.MEMBER_CREDIT_ADD)) return null;
 *
 * หรือใช้ <Can> component:
 *   <Can perm={PERMISSIONS.FINANCE_VIEW}> ... </Can>
 * ================================================================== */
import { useState, useEffect, useCallback } from 'react';
import {
  PERMISSIONS, PERMISSION_META, ROLES,
  type Permission, type StaffSession, type RoleKey,
  loadSession, effectivePermissions, can as canFn,
  canAny as canAnyFn, canAll as canAllFn,
} from '@/shared/lib/permissions';

export function usePermission() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setReady(true);
    // ฟังการเปลี่ยนในแท็บอื่น
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ak88_staff_session' || e.key === 'adminAuth') setSession(loadSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const can = useCallback((perm: Permission) => canFn(session, perm), [session]);
  const canAny = useCallback((perms: Permission[]) => canAnyFn(session, perms), [session]);
  const canAll = useCallback((perms: Permission[]) => canAllFn(session, perms), [session]);
  const perms = effectivePermissions(session);

  /** ตรวจสิทธิ์ + คืนข้อความอธิบายว่าทำไมไม่ผ่าน */
  const deny = useCallback((perm: Permission): string | null => {
    if (!session) return 'ยังไม่ได้เข้าสู่ระบบ';
    if (canFn(session, perm)) return null;
    const meta = PERMISSION_META[perm];
    const roleDef = ROLES[session.role];
    return `ตำแหน่ง "${roleDef?.label || session.role}" ไม่มีสิทธิ์ "${meta?.label || perm}"`;
  }, [session]);

  return {
    session, ready,
    role: session?.role as RoleKey | undefined,
    roleDef: session ? ROLES[session.role] : undefined,
    can, canAny, canAll, deny,
    perms,
    has: (p: Permission) => perms.has(p),
  };
}

/** สร้าง session ปลอมสำหรับทดสอบสิทธิ์ */
export function makeTestSession(role: RoleKey): StaffSession {
  return { uid: 'test', username: 'test', displayName: 'ทดสอบ', role };
}

export { PERMISSIONS };
