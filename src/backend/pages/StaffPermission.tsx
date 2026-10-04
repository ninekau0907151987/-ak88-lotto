/**
 * src/backend/pages/StaffPermission.tsx
 * ------------------------------------------------------------------
 * ★ หน้าจัดการสิทธิ์และโครงสร้างความปลอดภัย (Staff, 5 Function Groups & 2FA) ★
 *
 * สิทธิ์ 3 ระดับหลัก:
 *   1. คนผลิต (Provider / Creator) — สิทธิ์ใหญ่สุด คุมสถาปัตยกรรม สวิตช์ระบบแม่ รี 2FA ได้ทุกคน
 *   2. เจ้าของ (Owner / Operator) — เจ้าของร้าน ตั้งค่า 5 กลุ่มฟังก์ชัน จัดการพนักงาน รีเซ็ต 2FA พนักงาน
 *   3. ลูกค้า (Customer / Member) — ผู้เล่นหน้าบ้าน
 *
 * 5 กลุ่มฟังก์ชันหลัก (เข้าทางเดียวกัน):
 *   - 1. กลุ่มการเงิน & ฝาก-ถอน
 *   - 2. กลุ่มควบคุมหวย & จัดตารางรอบ
 *   - 3. กลุ่มคำนวณรับกิน & ลดความเสี่ยง
 *   - 4. กลุ่มออกผลรางวัล & บัญชีรายงาน
 *   - 5. กลุ่มสมาชิก & พนักงาน & ความปลอดภัย 2FA
 *
 * ระบบ 2FA และ เส้นทางการเข้าใช้งาน:
 *   - ตรวจสอบสถานะ 2FA ของพนักงาน
 *   - ปุ่มรีเซ็ต 2FA (Reset 2FA เป็น 123456)
 *   - บันทึกและแสดงผลเส้นทางการเข้าใช้งาน (Access Route Audit Trail)
 * ================================================================== */
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/shared/lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, query, orderBy } from 'firebase/firestore';
import {
  PERMISSION_GROUPS, PERMISSION_META, ROLES, ROLE_LIST, ALL_PERMISSIONS,
  FIVE_FUNCTION_GROUPS, type FunctionGroupDef,
  RISK_LABEL, effectivePermissions, describeChange,
  type Permission, type RoleKey, type StaffSession, type RiskLevel, type PermissionChange,
} from '@/shared/lib/permissions';
import {
  resetStaffTwoFactor, getAccessPathLogs, type AccessLogEntry, type TwoFactorState
} from '@/shared/lib/twoFactorAuth';
import { fmtInt } from '@/shared/lib/betCount';
import { exportCsv } from '@/shared/components/DataToolbar';
import StatusBadge from '@/shared/components/StatusBadge';
import MoneyCard from '@/shared/components/MoneyCard';

interface StaffRow {
  id: string;
  username: string;
  displayName?: string;
  phone?: string;
  role: RoleKey;
  grantedExtra?: Permission[];
  revoked?: Permission[];
  status?: string;
  scopeProjectIds?: string[];
  note?: string;
  password?: string;
  twoFactor?: TwoFactorState;
  createdAt?: string;
  lastLogin?: string;
}

export default function StaffPermission() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [logs, setLogs] = useState<(PermissionChange & { id: string; at: string })[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StaffRow | null>(null);

  // ---- ตัวกรอง ----
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleKey[]>([]);
  const [detailTab, setDetailTab] = useState<'five_groups' | 'perms' | 'two_factor' | 'access_logs' | 'history'>('five_groups');
  const [permSearch, setPermSearch] = useState('');
  const [expandGroups, setExpandGroups] = useState<Record<string, boolean>>({});

  // ---- ฟอร์มเพิ่ม/แก้พนักงาน ----
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<StaffRow>>({ role: 'staff', username: '', displayName: '', phone: '', note: '' });
  const [saving, setSaving] = useState(false);

  /* ---- โหลดข้อมูลพนักงาน และ บันทึกกิจกรรม ---- */
  useEffect(() => {
    const unsubStaff = onSnapshot(
      query(collection(db, 'staff'), orderBy('createdAt', 'desc')),
      snap => {
        setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() } as StaffRow)));
        setLoading(false);
      },
      err => { console.error('[staff] load failed:', err); setLoading(false); }
    );
    const unsubLogs = onSnapshot(
      query(collection(db, 'permissionLogs'), orderBy('at', 'desc')),
      snap => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as any))),
      err => console.warn('[permissionLogs] load failed:', err)
    );

    // โหลดประวัติเส้นทางการเข้าใช้งาน
    getAccessPathLogs(50).then(logsData => {
      setAccessLogs(logsData);
    });

    return () => { unsubStaff(); unsubLogs(); };
  }, []);

  /* ---- กรองรายชื่อ ---- */
  const filtered = useMemo(() => {
    let list = staff;
    if (roleFilter.length) list = list.filter(s => roleFilter.includes(s.role));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.username?.toLowerCase().includes(q) ||
        s.displayName?.toLowerCase().includes(q) ||
        s.phone?.includes(q)
      );
    }
    return list;
  }, [staff, search, roleFilter]);

  /* ---- สถิติ ---- */
  const stats = useMemo(() => {
    const byRole: Record<string, number> = {};
    staff.forEach(s => { byRole[s.role] = (byRole[s.role] || 0) + 1; });
    return {
      total: staff.length,
      active: staff.filter(s => s.status !== 'suspended').length,
      suspended: staff.filter(s => s.status === 'suspended').length,
      withOverride: staff.filter(s => (s.revoked?.length || 0) > 0 || (s.grantedExtra?.length || 0) > 0).length,
      twoFactorEnabled: staff.filter(s => s.twoFactor?.enabled !== false).length,
      byRole,
    };
  }, [staff]);

  const writeLog = async (change: PermissionChange) => {
    try {
      await addDoc(collection(db, 'permissionLogs'), {
        ...change,
        at: new Date().toISOString(),
        summary: describeChange(change),
      });
    } catch (e) {
      console.warn('[permissionLogs] write failed:', e);
    }
  };

  /** ติ๊ก/ถอด 1 สิทธิ์ */
  const togglePermission = async (target: StaffRow, perm: Permission) => {
    const roleDef = ROLES[target.role];
    const inRole = roleDef?.perms?.includes(perm) || false;
    const revoked = new Set(target.revoked || []);
    const extra = new Set(target.grantedExtra || []);

    const currentlyHas = inRole ? !revoked.has(perm) : extra.has(perm);
    const willHave = !currentlyHas;

    if (willHave) {
      revoked.delete(perm);
      if (!inRole) extra.add(perm);
    } else {
      if (inRole) revoked.add(perm);
      extra.delete(perm);
    }

    const updated: StaffRow = { ...target, grantedExtra: [...extra], revoked: [...revoked] };
    setSelected(updated);
    setStaff(prev => prev.map(s => s.id === target.id ? updated : s));

    try {
      await setDoc(doc(db, 'staff', target.id), {
        grantedExtra: [...extra],
        revoked: [...revoked],
      }, { merge: true });
      await writeLog({
        targetUid: target.id,
        targetName: target.displayName || target.username,
        actorName: 'ผู้ดูแลระบบ',
        action: willHave ? 'grant' : 'revoke',
        permission: perm,
      });
    } catch (e: any) {
      alert('บันทึกสิทธิ์ไม่สำเร็จ: ' + e.message);
    }
  };

  /** ★ เปิด/ปิด สิทธิ์ทั้งกลุ่มฟังก์ชัน (จาก 5 กลุ่ม) ★ */
  const toggleFiveGroup = async (target: StaffRow, group: FunctionGroupDef, turnOn: boolean) => {
    const roleDef = ROLES[target.role];
    const revoked = new Set(target.revoked || []);
    const extra = new Set(target.grantedExtra || []);

    group.perms.forEach(p => {
      const inRole = roleDef?.perms?.includes(p) || false;
      if (turnOn) {
        revoked.delete(p);
        if (!inRole) extra.add(p);
      } else {
        if (inRole) revoked.add(p);
        extra.delete(p);
      }
    });

    const updated: StaffRow = { ...target, grantedExtra: [...extra], revoked: [...revoked] };
    setSelected(updated);
    setStaff(prev => prev.map(s => s.id === target.id ? updated : s));

    try {
      await setDoc(doc(db, 'staff', target.id), {
        grantedExtra: [...extra], revoked: [...revoked],
      }, { merge: true });
      await writeLog({
        targetUid: target.id, targetName: target.displayName || target.username,
        actorName: 'เจ้าของระบบ', action: turnOn ? 'grant' : 'revoke',
        note: `${turnOn ? 'เปิด' : 'ปิด'}กลุ่มฟังก์ชัน "${group.name}" (${group.perms.length} สิทธิ์)`,
      });
    } catch (e: any) {
      alert('บันทึกกลุ่มฟังก์ชันไม่สำเร็จ: ' + e.message);
    }
  };

  /** ★ รีเซ็ต 2FA ให้พนักงาน (สำหรับ คนผลิต หรือ เจ้าของ) ★ */
  const handleReset2FA = async (target: StaffRow) => {
    if (!confirm(`ยืนยันที่จะรีเซ็ต 2FA ให้กับ "${target.displayName || target.username}"?\n\nรหัสความปลอดภัยเริ่มต้นจะถูกตั้งเป็น 123456 และปลดล็อกบัญชี`)) return;
    try {
      const res = await resetStaffTwoFactor(target.id, 'owner', '123456');
      if (res.success) {
        alert(res.message);
        const updated: StaffRow = {
          ...target,
          twoFactor: {
            enabled: true,
            status: 'pending',
            pin: '123456',
            failedAttempts: 0,
            lastResetAt: new Date().toISOString(),
          }
        };
        setSelected(updated);
        setStaff(prev => prev.map(s => s.id === target.id ? updated : s));
        const updatedAccess = await getAccessPathLogs(50);
        setAccessLogs(updatedAccess);
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert('เกิดข้อผิดพลาดในการรีเซ็ต 2FA: ' + e.message);
    }
  };

  /** สลับเปิด/ปิด 2FA รายพนักงาน */
  const toggle2FAStatus = async (target: StaffRow, enabled: boolean) => {
    try {
      const next2FA: TwoFactorState = {
        enabled,
        status: enabled ? 'active' : 'disabled',
        pin: target.twoFactor?.pin || '123456',
        failedAttempts: 0,
        lastResetAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'staff', target.id), { twoFactor: next2FA }, { merge: true });
      const updated = { ...target, twoFactor: next2FA };
      setSelected(updated);
      setStaff(prev => prev.map(s => s.id === target.id ? updated : s));
      alert(`ตั้งค่า 2FA เป็น ${enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'} เรียบร้อยแล้ว`);
    } catch (e: any) {
      alert('บันทึก 2FA ไม่สำเร็จ: ' + e.message);
    }
  };

  /** เปลี่ยนตำแหน่ง */
  const changeRole = async (target: StaffRow, role: RoleKey) => {
    const from = target.role;
    if (from === role) return;
    if (!confirm(`เปลี่ยนตำแหน่งของ "${target.displayName || target.username}"\nจาก "${ROLES[from]?.label}" เป็น "${ROLES[role]?.label}"?\n\nสิทธิ์ override เดิมจะถูกล้าง`)) return;

    const updated: StaffRow = { ...target, role, grantedExtra: [], revoked: [] };
    setSelected(updated);
    setStaff(prev => prev.map(s => s.id === target.id ? updated : s));

    try {
      await setDoc(doc(db, 'staff', target.id), { role, grantedExtra: [], revoked: [] }, { merge: true });
      await writeLog({
        targetUid: target.id, targetName: target.displayName || target.username,
        actorName: 'ผู้ดูแลระบบ', action: 'role_change', from, to: role,
      });
    } catch (e: any) {
      alert('เปลี่ยนตำแหน่งไม่สำเร็จ: ' + e.message);
    }
  };

  /** คืนสิทธิ์ตามตำแหน่ง */
  const resetToRole = async (target: StaffRow) => {
    if (!confirm(`คืนสิทธิ์ของ "${target.displayName || target.username}" กลับไปตามตำแหน่ง "${ROLES[target.role]?.label}"?\n\nการตั้งค่าเฉพาะบุคคลจะหายทั้งหมด`)) return;
    const updated = { ...target, grantedExtra: [], revoked: [] };
    setSelected(updated);
    setStaff(prev => prev.map(s => s.id === target.id ? updated : s));
    try {
      await setDoc(doc(db, 'staff', target.id), { grantedExtra: [], revoked: [] }, { merge: true });
      await writeLog({
        targetUid: target.id, targetName: target.displayName || target.username,
        actorName: 'ผู้ดูแลระบบ', action: 'grant', note: 'คืนสิทธิ์กลับตามตำแหน่ง',
      });
    } catch (e: any) { alert('ไม่สำเร็จ: ' + e.message); }
  };

  /** ระงับ/ปลดระงับ */
  const toggleSuspend = async (target: StaffRow) => {
    const next = target.status === 'suspended' ? 'active' : 'suspended';
    const updated = { ...target, status: next };
    setSelected(updated);
    setStaff(prev => prev.map(s => s.id === target.id ? updated : s));
    try {
      await setDoc(doc(db, 'staff', target.id), { status: next }, { merge: true });
      await writeLog({
        targetUid: target.id, targetName: target.displayName || target.username,
        actorName: 'ผู้ดูแลระบบ', action: next === 'suspended' ? 'revoke' : 'grant',
        note: next === 'suspended' ? '★ ระงับบัญชี' : 'ปลดระงับบัญชี',
      });
    } catch (e: any) { alert('ไม่สำเร็จ: ' + e.message); }
  };

  /** ลบพนักงาน */
  const removeStaff = async (target: StaffRow) => {
    if (!confirm(`ลบบัญชี "${target.displayName || target.username}" ออกจากระบบ?\n\nย้อนกลับไม่ได้`)) return;
    try {
      await deleteDoc(doc(db, 'staff', target.id));
      await writeLog({
        targetUid: target.id, targetName: target.displayName || target.username,
        actorName: 'ผู้ดูแลระบบ', action: 'delete',
      });
      setStaff(prev => prev.filter(s => s.id !== target.id));
      if (selected?.id === target.id) setSelected(null);
    } catch (e: any) { alert('ลบไม่สำเร็จ: ' + e.message); }
  };

  /** บันทึกฟอร์มเพิ่ม/แก้ */
  const saveForm = async () => {
    if (!form.username?.trim()) { alert('กรุณากรอกชื่อผู้ใช้'); return; }
    setSaving(true);
    try {
      const id = form.id || `staff_${Date.now()}`;
      const isNew = !form.id;
      const payload: any = {
        username: form.username.trim(),
        displayName: form.displayName || form.username.trim(),
        phone: form.phone || '',
        role: form.role || 'staff',
        note: form.note || '',
        status: (form as any).status || 'active',
        twoFactor: {
          enabled: true,
          status: 'active',
          pin: '123456',
          failedAttempts: 0
        }
      };
      if (form.password) {
        payload.password = form.password;
      } else if (isNew) {
        payload.password = '123456';
      }
      if (isNew) {
        payload.createdAt = new Date().toISOString();
        payload.grantedExtra = [];
        payload.revoked = [];
      }
      await setDoc(doc(db, 'staff', id), payload, { merge: true });
      if (isNew) {
        await writeLog({
          targetUid: id, targetName: payload.displayName,
          actorName: 'ผู้ดูแลระบบ', action: 'create',
          note: `ตำแหน่ง ${ROLES[payload.role]?.label}`,
        });
      }
      setShowForm(false);
    } catch (e: any) {
      alert('บันทึกไม่สำเร็จ: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ================================================================
       * ★ 3-Tier Hierarchy Banner (สิทธิ์ 3 ระดับหลัก: คนผลิต -> เจ้าของ -> ลูกค้า)
       * ================================================================ */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl border border-indigo-900/50 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">shield</span>
                โครงสร้างสิทธิ์ 3 ชั้น & 5 กลุ่มฟังก์ชัน
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                2FA Active
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-wide">
              ศูนย์จัดการสิทธิ์บุคลากร & ความปลอดภัย 2 ชั้น (Access Control & 2FA)
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              สิทธิ์หลักแบ่ง 3 ระดับ: <b>1. คนผลิต (ใหญ่สุด)</b> ➡️ <b>2. เจ้าของ (ตั้งค่า 5 กลุ่มฟังก์ชันเอง)</b> ➡️ <b>3. ลูกค้า (หน้าบ้าน)</b> พร้อมระบบตรวจสอบ 2FA ติดตามเส้นทางการเข้าใช้งานรายบุคคล
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setForm({ role: 'staff', username: '', displayName: '', phone: '', note: '' });
                setShowForm(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-105 text-slate-950 font-black text-xs shadow-lg transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm font-black">person_add</span>
              <span>เพิ่มพนักงานใหม่</span>
            </button>
          </div>
        </div>

        {/* 3 Tiers Visual Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center font-black text-xs">1</span>
              <span className="font-black text-sm text-purple-200">คนผลิต (System Provider)</span>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/30 text-purple-200">ใหญ่สุด</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              สิทธิ์ระดับสถาปัตยกรรม ควบคุมสวิตช์ระบบแม่ กู้คืนฐานข้อมูล และรีเซ็ต 2FA ได้ทุกระดับ
            </p>
          </div>

          <div className="bg-white/5 border border-amber-500/30 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-black text-xs">2</span>
              <span className="font-black text-sm text-amber-200">เจ้าของระบบ (Owner)</span>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/30 text-amber-200">ผู้บริหาร</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              บริหารร้าน ตั้งค่า 5 กลุ่มฟังก์ชัน คุมงบรับกิน อัตราจ่ายหวย และรีเซ็ต 2FA ให้พนักงาน
            </p>
          </div>

          <div className="bg-white/5 border border-emerald-500/30 rounded-2xl p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-black text-xs">3</span>
              <span className="font-black text-sm text-emerald-200">ลูกค้า / สมาชิก (Customer)</span>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-200">หน้าบ้าน</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              สมาชิกผู้เล่นทั่วไป เข้าแทงหวย เติม-ถอนเงินออโต้ ตรวจสอบโพยผ่านหน้าเว็บหลัก
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MoneyCard label="พนักงานทั้งหมด" value={stats.total} currency={false} tone="default" size="sm" icon="badge" />
        <MoneyCard label="บัญชีที่เปิดใช้งาน" value={stats.active} currency={false} tone="green" size="sm" icon="check_circle" />
        <MoneyCard label="เปิดระบบ 2FA ป้องกัน" value={stats.twoFactorEnabled} currency={false} tone="blue" size="sm" icon="verified_user" hint="ระบบความปลอดภัย 2 ชั้น" />
        <MoneyCard label="มีสิทธิ์พิเศษเฉพาะบุคคล" value={stats.withOverride} currency={false} tone="gold" size="sm" icon="tune" hint="ปรับแยกจากตำแหน่ง" />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาพนักงานด้วยชื่อ, เบอร์โทร..."
              className="bg-transparent text-xs outline-none w-full font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                getAccessPathLogs(50).then(logsData => setAccessLogs(logsData));
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-xs">history</span>
              <span>ดูเส้นทางเข้าใช้งาน ({accessLogs.length})</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="p-3.5">ชื่อพนักงาน / บัญชี</th>
                <th className="p-3.5 text-center">ตำแหน่ง</th>
                <th className="p-3.5 text-center">สิทธิ์ที่เปิด</th>
                <th className="p-3.5 text-center">สถานะ 2FA</th>
                <th className="p-3.5 text-center">สถานะบัญชี</th>
                <th className="p-3.5 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => {
                const roleDef = ROLES[s.role];
                const eff = effectivePermissions({
                  uid: s.id, username: s.username, displayName: '',
                  role: s.role, grantedExtra: s.grantedExtra, revoked: s.revoked
                });
                const is2FA = s.twoFactor?.enabled !== false;

                return (
                  <tr key={s.id} onClick={() => { setSelected(s); setDetailTab('five_groups'); }} className="hover:bg-slate-50 cursor-pointer transition">
                    <td className="p-3.5">
                      <div className="font-black text-slate-900">{s.displayName || s.username}</div>
                      <div className="text-[10px] text-slate-400">@{s.username} {s.phone ? `• ${s.phone}` : ''}</div>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-black text-white" style={{ background: roleDef?.color || '#64748b' }}>
                        {roleDef?.label || s.role}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-black">
                      <span className="text-blue-600">{eff.size}</span>
                      <span className="text-slate-400 text-[10px]">/{ALL_PERMISSIONS.length}</span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                        is2FA ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        <span className="material-symbols-outlined text-[11px]">{is2FA ? 'verified_user' : 'lock_open'}</span>
                        <span>{is2FA ? 'เปิด 2FA' : 'ปิด'}</span>
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <StatusBadge status={s.status === 'suspended' ? 'blocked' : 'active'} />
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { setSelected(s); setDetailTab('five_groups'); }}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-black border border-blue-200 transition"
                          title="ตั้งค่า 5 กลุ่มฟังก์ชัน"
                        >
                          ตั้งสิทธิ์
                        </button>
                        <button
                          onClick={() => handleReset2FA(s)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] font-black border border-amber-200 transition"
                          title="รีเซ็ต 2FA เป็น 123456"
                        >
                          รี 2FA
                        </button>
                        <button
                          onClick={() => removeStaff(s)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                          title="ลบพนักงาน"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================
       * ★ Modal แผงตั้งสิทธิ์: 5 กลุ่มฟังก์ชัน / 2FA / สิทธิ์ละเอียด / เส้นทางเข้า
       * ================================================================ */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex justify-end" onClick={() => setSelected(null)}>
          <div className="bg-white w-full max-w-3xl h-full overflow-y-auto animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white border-b border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500">manage_accounts</span>
                    <span>จัดการสิทธิ์ & ความปลอดภัย 2FA</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selected.displayName || selected.username} (@{selected.username}) • {ROLES[selected.role]?.label}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Sub-tab Navigation */}
              <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setDetailTab('five_groups')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                    detailTab === 'five_groups' ? 'bg-slate-900 text-amber-300' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">widgets</span>
                  <span>5 กลุ่มฟังก์ชัน</span>
                </button>

                <button
                  onClick={() => setDetailTab('two_factor')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                    detailTab === 'two_factor' ? 'bg-slate-900 text-amber-300' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  <span>ระบบ 2FA & รีเซ็ต</span>
                </button>

                <button
                  onClick={() => setDetailTab('access_logs')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                    detailTab === 'access_logs' ? 'bg-slate-900 text-amber-300' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">route</span>
                  <span>เส้นทางเข้าใช้งาน</span>
                </button>

                <button
                  onClick={() => setDetailTab('perms')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                    detailTab === 'perms' ? 'bg-slate-900 text-amber-300' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">tune</span>
                  <span>สิทธิ์ละเอียด ({ALL_PERMISSIONS.length})</span>
                </button>

                <button
                  onClick={() => setDetailTab('history')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                    detailTab === 'history' ? 'bg-slate-900 text-amber-300' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">history</span>
                  <span>ประวัติแก้สิทธิ์</span>
                </button>
              </div>
            </div>

            {/* TAB 1: 5 Functional Groups */}
            {detailTab === 'five_groups' && (
              <div className="p-6 space-y-4">
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900">
                  <div className="font-black flex items-center gap-1.5 mb-1">
                    <span className="material-symbols-outlined text-sm">lightbulb</span>
                    <span>ระบบตั้งค่า 5 กลุ่มฟังก์ชัน (เข้าทางเดียวกัน)</span>
                  </div>
                  <p>
                    เจ้าของระบบสามารถคลิก <b>"เปิดทั้งกลุ่ม"</b> หรือ <b>"ปิดทั้งกลุ่ม"</b> เพื่อมอบหมายหน้าที่ให้พนักงานได้ทันที โดยไม่ต้องเลือกทีละสิทธิ์
                  </p>
                </div>

                <div className="space-y-3">
                  {FIVE_FUNCTION_GROUPS.map((group) => {
                    const eff = effectivePermissions({
                      uid: selected.id, username: selected.username, displayName: '',
                      role: selected.role, grantedExtra: selected.grantedExtra, revoked: selected.revoked
                    });
                    const activeCount = group.perms.filter(p => eff.has(p)).length;
                    const isAllOn = activeCount === group.perms.length;

                    return (
                      <div key={group.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 transition hover:border-slate-300">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-sm" style={{ background: `${group.color}15`, color: group.color }}>
                              <span className="material-symbols-outlined">{group.icon}</span>
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-sm flex items-center gap-2">
                                <span>{group.name}</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  isAllOn ? 'bg-emerald-100 text-emerald-800' : (activeCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600')
                                }`}>
                                  เปิดอยู่ {activeCount}/{group.perms.length} สิทธิ์
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">{group.desc}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => toggleFiveGroup(selected, group, !isAllOn)}
                              className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black transition shadow-sm ${
                                isAllOn
                                  ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                            >
                              {isAllOn ? 'ปิดทั้งกลุ่ม' : 'เปิดทั้งกลุ่ม'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: Two-Factor Authentication & Reset */}
            {detailTab === 'two_factor' && (
              <div className="p-6 space-y-5">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                        <span className="material-symbols-outlined text-2xl">security</span>
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-slate-900">สถานะความปลอดภัย 2 ชั้น (2FA)</h4>
                        <p className="text-xs text-slate-500">บังคับให้ใส่รหัส PIN หรือ Authenticator เมื่อเข้าสู่ระบบ</p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggle2FAStatus(selected, !(selected.twoFactor?.enabled !== false))}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                        selected.twoFactor?.enabled !== false
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {selected.twoFactor?.enabled !== false ? 'เปิดใช้งานอยู่' : 'ปิดใช้งาน'}
                    </button>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">รหัส 2FA เริ่มต้นปัจจุบัน:</span>
                      <span className="font-mono font-black text-blue-700">{selected.twoFactor?.pin || '123456'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">รีเซ็ตล่าสุดเมื่อ:</span>
                      <span className="text-slate-700">{selected.twoFactor?.lastResetAt ? new Date(selected.twoFactor.lastResetAt).toLocaleString('th-TH') : 'ไม่ระบุ'}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => handleReset2FA(selected)}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">lock_reset</span>
                      <span>รีเซ็ตรหัส 2FA พนักงาน (ตั้งเป็น 123456 และปลดล็อก)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Access Route Audit Logs */}
            {detailTab === 'access_logs' && (
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-black text-sm text-slate-900">เส้นทางการเข้าใช้งานและประวัติความปลอดภัย</h4>
                  <span className="text-xs text-slate-500 font-bold">{accessLogs.length} รายการล่าสุด</span>
                </div>

                <div className="space-y-2">
                  {accessLogs.length === 0 ? (
                    <div className="text-center p-8 text-xs text-slate-400 font-bold">ยังไม่มีบันทึกเส้นทางการเข้าใช้งาน</div>
                  ) : (
                    accessLogs.map((log, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 font-bold text-slate-900">
                            <span className="font-mono text-blue-600">{log.route}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">{log.role}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {log.ip} • {log.device.slice(0, 45)}...
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                            log.twoFactorPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {log.twoFactorPassed ? '✓ 2FA ผ่าน' : '✕ ไม่ผ่าน 2FA'}
                          </span>
                          <div className="text-[9px] text-slate-400 mt-1">
                            {new Date(log.timestamp).toLocaleTimeString('th-TH')}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: Granular Permissions (40+) */}
            {detailTab === 'perms' && (() => {
              const roleDef = ROLES[selected.role];
              const revoked = new Set(selected.revoked || []);
              const extra = new Set(selected.grantedExtra || []);
              const eff = effectivePermissions({ uid: selected.id, username: selected.username, displayName: '', role: selected.role, grantedExtra: selected.grantedExtra, revoked: selected.revoked });
              const q = permSearch.toLowerCase();

              return (
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
                    <span className="material-symbols-outlined text-base text-slate-400">search</span>
                    <input value={permSearch} onChange={e => setPermSearch(e.target.value)}
                      placeholder="ค้นหาสิทธิ์ เช่น เครดิต, อนุมัติ, ลบ..."
                      className="flex-1 bg-transparent outline-none text-xs font-medium" />
                  </div>

                  {PERMISSION_GROUPS.map(g => {
                    const gPerms = q ? g.perms.filter(p => p.label.toLowerCase().includes(q) || p.key.includes(q)) : g.perms;
                    if (gPerms.length === 0) return null;
                    const gGranted = g.perms.filter(p => eff.has(p.key)).length;
                    const open = expandGroups[g.key] !== false;

                    return (
                      <div key={g.key} className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center gap-2 p-2.5 bg-slate-50">
                          <button onClick={() => setExpandGroups(prev => ({ ...prev, [g.key]: !open }))} className="p-1 rounded text-slate-400">
                            <span className="material-symbols-outlined text-base">{open ? 'expand_less' : 'expand_more'}</span>
                          </button>
                          <span className="material-symbols-outlined text-base text-blue-600">{g.icon}</span>
                          <span className="font-black text-xs flex-1 text-slate-800">{g.label}</span>
                          <span className="text-[10px] font-black tabular-nums text-blue-600">{gGranted}/{g.perms.length}</span>
                        </div>

                        {open && (
                          <div className="divide-y divide-slate-100">
                            {gPerms.map(p => {
                              const inRole = roleDef?.perms?.includes(p.key) || false;
                              const isOn = eff.has(p.key);
                              const isRevoked = revoked.has(p.key);
                              const isExtra = extra.has(p.key);
                              const risk = RISK_LABEL[(p.risk || 'low') as RiskLevel];

                              return (
                                <label key={p.key} className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-slate-50 transition">
                                  <input type="checkbox" checked={isOn}
                                    onChange={() => togglePermission(selected, p.key)}
                                    className="w-4 h-4 rounded cursor-pointer accent-blue-600" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold text-slate-800">{p.label}</span>
                                      {isRevoked && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">ปิดเฉพาะคนนี้</span>}
                                      {isExtra && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">ให้เพิ่ม</span>}
                                      {inRole && !isRevoked && !isExtra && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">ตามตำแหน่ง</span>}
                                    </div>
                                    <div className="text-[9px] font-mono mt-0.5 text-slate-400">{p.key}</div>
                                  </div>
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0" style={{ background: risk.bg, color: risk.color }}>
                                    {risk.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* TAB 5: History */}
            {detailTab === 'history' && (
              <div className="p-4 space-y-2">
                {logs.filter(l => l.targetUid === selected.id).length === 0 && (
                  <div className="text-center p-8 font-bold italic text-xs text-slate-400">ยังไม่มีประวัติการแก้สิทธิ์ของพนักงานคนนี้</div>
                )}
                {logs.filter(l => l.targetUid === selected.id).map(l => (
                  <div key={l.id} className="rounded-xl border border-slate-200 p-3 flex items-start gap-2">
                    <span className="material-symbols-outlined text-base shrink-0 text-blue-600">
                      {l.action === 'revoke' ? 'lock' : l.action === 'delete' ? 'delete' : 'check_circle'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800">{describeChange(l)}</div>
                      {l.note && <div className="text-[10px] mt-0.5 text-slate-500">{l.note}</div>}
                      <div className="text-[9px] mt-0.5 text-slate-400">{l.actorName} • {new Date(l.at).toLocaleString('th-TH')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ฟอร์มเพิ่ม/แก้พนักงาน */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-base mb-4 flex items-center gap-2 text-slate-900">
              <span className="material-symbols-outlined text-amber-500">person_add</span>
              {form.id ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
            </h3>

            <div className="space-y-3">
              {[
                { k: 'username', label: 'ชื่อผู้ใช้ (สำหรับล็อกอิน) *', ph: 'เช่น staff01' },
                { k: 'password', label: 'รหัสผ่าน (Password) *', ph: 'เช่น 123456' },
                { k: 'displayName', label: 'ชื่อที่แสดง', ph: 'เช่น สมชาย ใจดี' },
                { k: 'phone', label: 'เบอร์โทร', ph: '08x-xxx-xxxx' },
                { k: 'note', label: 'หมายเหตุ', ph: 'เช่น ดูแลกะเช้า' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-[10px] font-black uppercase block mb-1 text-slate-500">{f.label}</label>
                  <input
                    value={(form as any)[f.k] || ''}
                    placeholder={f.ph}
                    onChange={e => setForm(prev => ({ ...prev, [f.k]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs font-medium focus:border-amber-500 bg-slate-50"
                  />
                </div>
              ))}

              <div>
                <label className="text-[10px] font-black uppercase block mb-1.5 text-slate-500">ตำแหน่งเริ่มต้น</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ROLE_LIST.filter(r => !r.locked).map(r => (
                    <button
                      key={r.key}
                      onClick={() => setForm(prev => ({ ...prev, role: r.key }))}
                      className={`px-3 py-2 rounded-xl text-[11px] font-black border text-left transition ${
                        form.role === r.key ? 'bg-slate-900 text-amber-300 border-slate-900' : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {r.label}
                      <div className="text-[9px] font-normal opacity-80">{ROLES[r.key]?.perms?.length || 0} สิทธิ์</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl font-black text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveForm}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl font-black text-xs text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 shadow transition disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
