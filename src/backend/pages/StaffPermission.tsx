/**
 * src/backend/pages/StaffPermission.tsx
 * ------------------------------------------------------------------
 * ★ หน้าจัดการสิทธิ์พนักงาน (Staff & Permission Manager) ★
 *
 * ผู้ใช้ขอ: "ทำระบบ จัดการสิทธิ์ฟังชั่น ด้วยเพื่อปิดสิทธิ์ให้พนักงานในเว็บนั้นๆ"
 *
 * หน้าจอนี้ทำ 4 อย่าง:
 *   1. รายชื่อพนักงาน + ตำแหน่ง + จำนวนสิทธิ์ที่ถืออยู่
 *   2. ★ ตั้งสิทธิ์รายคน — ติ๊กเปิด/ปิดได้ทีละฟังชั่น (40+ สิทธิ์)
 *   3. เทียบกับตำแหน่ง (แสดงว่าสิทธิ์นี้มาจาก role หรือ override)
 *   4. ประวัติการแก้สิทธิ์ทุกครั้ง
 * ================================================================== */
import { useState, useEffect, useMemo } from 'react';
import { db } from '@/shared/lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, query, orderBy } from 'firebase/firestore';
import {
  PERMISSION_GROUPS, PERMISSION_META, ROLES, ROLE_LIST, ALL_PERMISSIONS,
  RISK_LABEL, effectivePermissions, describeChange,
  type Permission, type RoleKey, type StaffSession, type RiskLevel, type PermissionChange,
} from '@/shared/lib/permissions';
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
  createdAt?: string;
  lastLogin?: string;
}

export default function StaffPermission() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [logs, setLogs] = useState<(PermissionChange & { id: string; at: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<StaffRow | null>(null);

  // ---- ตัวกรอง ----
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleKey[]>([]);
  const [detailTab, setDetailTab] = useState<'perms' | 'history'>('perms');
  const [permSearch, setPermSearch] = useState('');
  const [expandGroups, setExpandGroups] = useState<Record<string, boolean>>({});

  // ---- ฟอร์มเพิ่ม/แก้พนักงาน ----
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<StaffRow>>({ role: 'staff', username: '', displayName: '', phone: '', note: '' });
  const [saving, setSaving] = useState(false);

  /* ---- โหลดข้อมูล ---- */
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
      byRole,
    };
  }, [staff]);

  /* ================================================================
   * ★ บันทึกการแก้สิทธิ์
   * ================================================================ */
  const writeLog = async (change: PermissionChange) => {
    try {
      await addDoc(collection(db, 'permissionLogs'), {
        ...change,
        at: new Date().toISOString(),
        summary: describeChange(change),
      });
    } catch (e) {
      console.warn('[permissionLogs] write failed (ไม่กระทบการทำงาน):', e);
    }
  };

  /** ★ ติ๊ก/ถอด 1 สิทธิ์ */
  const togglePermission = async (target: StaffRow, perm: Permission) => {
    const roleDef = ROLES[target.role];
    const inRole = roleDef.perms.includes(perm);
    const revoked = new Set(target.revoked || []);
    const extra = new Set(target.grantedExtra || []);

    const currentlyHas = inRole ? !revoked.has(perm) : extra.has(perm);
    const willHave = !currentlyHas;

    if (willHave) {
      // เปิดสิทธิ์
      revoked.delete(perm);
      if (!inRole) extra.add(perm);
    } else {
      // ★ ปิดสิทธิ์
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
    } catch (e) {
      console.error('save permission failed:', e);
      alert('บันทึกสิทธิ์ไม่สำเร็จ: ' + (e as Error).message);
    }
  };

  /** ★ ปิด/เปิดทั้งหมวด */
  const toggleGroup = async (target: StaffRow, groupKey: string, turnOn: boolean) => {
    const group = PERMISSION_GROUPS.find(g => g.key === groupKey);
    if (!group) return;
    const roleDef = ROLES[target.role];
    const revoked = new Set(target.revoked || []);
    const extra = new Set(target.grantedExtra || []);

    group.perms.forEach(p => {
      const inRole = roleDef.perms.includes(p.key);
      if (turnOn) {
        revoked.delete(p.key);
        if (!inRole) extra.add(p.key);
      } else {
        if (inRole) revoked.add(p.key);
        extra.delete(p.key);
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
        actorName: 'ผู้ดูแลระบบ', action: turnOn ? 'grant' : 'revoke',
        note: `${turnOn ? 'เปิด' : 'ปิด'}ทั้งหมวด "${group.label}" (${group.perms.length} สิทธิ์)`,
      });
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e as Error).message);
    }
  };

  /** ★ เปลี่ยนตำแหน่ง */
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
    } catch (e) {
      alert('เปลี่ยนตำแหน่งไม่สำเร็จ: ' + (e as Error).message);
    }
  };

  /** ★ ล้าง override ทั้งหมด → กลับไปใช้สิทธิ์ตามตำแหน่ง */
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
    } catch (e) { alert('ไม่สำเร็จ: ' + (e as Error).message); }
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
    } catch (e) { alert('ไม่สำเร็จ: ' + (e as Error).message); }
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
    } catch (e) { alert('ลบไม่สำเร็จ: ' + (e as Error).message); }
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
      setForm({ role: 'staff', username: '', displayName: '', phone: '', note: '' });
    } catch (e) {
      alert('บันทึกไม่สำเร็จ: ' + (e as Error).message);
    } finally { setSaving(false); }
  };

  /* ================================================================
   * RENDER
   * ================================================================ */
  return (
    <div className="space-y-5">
      {/* ---- การ์ดสรุป ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MoneyCard label="พนักงานทั้งหมด" value={stats.total} currency={false} icon="badge" tone="blue" size="md" />
        <MoneyCard label="ใช้งานอยู่" value={stats.active} currency={false} icon="check_circle" tone="green" size="md" />
        <MoneyCard label="ถูกระงับ" value={stats.suspended} currency={false} icon="block" tone="red" size="md" />
        <MoneyCard label="มีตั้งสิทธิ์เฉพาะ" value={stats.withOverride} currency={false} icon="tune" tone="gold" size="md" hint="คนที่มี override" />
      </div>

      {/* ---- แถบเครื่องมือ ---- */}
      <div className="admin-card p-3 flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-subtle)' }}>
          <span className="material-symbols-outlined text-base" style={{ color: 'var(--admin-text-muted)' }}>search</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหา: ชื่อผู้ใช้, ชื่อจริง, เบอร์โทร..."
            className="flex-1 bg-transparent outline-none text-xs font-medium"
            style={{ color: 'var(--admin-text)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="material-symbols-outlined text-base" style={{ color: 'var(--admin-text-faint)' }}>close</button>
          )}
        </div>

        {/* กรองตำแหน่ง */}
        <div className="flex gap-1.5 flex-wrap">
          {ROLE_LIST.map(r => {
            const on = roleFilter.includes(r.key);
            const n = stats.byRole[r.key] || 0;
            return (
              <button key={r.key}
                onClick={() => setRoleFilter(prev => on ? prev.filter(x => x !== r.key) : [...prev, r.key])}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition"
                style={on
                  ? { background: r.color, borderColor: r.color, color: '#fff' }
                  : { background: '#fff', borderColor: 'var(--admin-border)', color: 'var(--admin-text-muted)' }}>
                {r.label} {n > 0 && <span className="opacity-70">({n})</span>}
              </button>
            );
          })}
        </div>

        <button onClick={() => exportCsv(filtered, [
          { key: 'username', label: 'ชื่อผู้ใช้' },
          { key: 'displayName', label: 'ชื่อที่แสดง' },
          { key: 'phone', label: 'เบอร์โทร' },
          { key: 'role', label: 'ตำแหน่ง' },
          { key: 'status', label: 'สถานะ' },
          { key: 'note', label: 'หมายเหตุ' },
        ], 'staff')}
          className="px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1"
          style={{ background: '#fff', borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
          <span className="material-symbols-outlined text-base">download</span> ส่งออก
        </button>

        <button onClick={() => { setForm({ role: 'staff', username: '', displayName: '', phone: '', note: '' }); setShowForm(true); }}
          className="px-3 py-2 rounded-lg text-xs font-black flex items-center gap-1 text-white"
          style={{ background: 'var(--admin-accent)' }}>
          <span className="material-symbols-outlined text-base">person_add</span> เพิ่มพนักงาน
        </button>
      </div>

      {/* ---- ตารางรายชื่อ ---- */}
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="admin-table border-b">
              <tr>
                <th className="p-3">พนักงาน</th>
                <th className="p-3 text-center">ตำแหน่ง</th>
                <th className="p-3 text-center">สิทธิ์ที่ถือ</th>
                <th className="p-3 text-center">override</th>
                <th className="p-3 text-center">สถานะ</th>
                <th className="p-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="p-8 text-center font-bold italic" style={{ color: 'var(--admin-text-faint)' }}>กำลังโหลด...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center font-bold italic" style={{ color: 'var(--admin-text-faint)' }}>
                  {staff.length === 0 ? 'ยังไม่มีพนักงานในระบบ — กด "เพิ่มพนักงาน" เพื่อเริ่ม' : 'ไม่พบพนักงานที่ตรงกับเงื่อนไข'}
                </td></tr>
              )}
              {filtered.map(s => {
                const roleDef = ROLES[s.role];
                const eff = effectivePermissions({ uid: s.id, username: s.username, displayName: s.displayName || '', role: s.role, grantedExtra: s.grantedExtra, revoked: s.revoked });
                const nRevoked = (s.revoked || []).length;
                const nExtra = (s.grantedExtra || []).length;
                return (
                  <tr key={s.id} className="border-b transition cursor-pointer hover:bg-black/[0.02]"
                      onClick={() => { setSelected(s); setDetailTab('perms'); setPermSearch(''); }}>
                    <td className="p-3">
                      <div className="font-black" style={{ color: 'var(--admin-text)' }}>{s.displayName || s.username}</div>
                      <div className="text-[10px]" style={{ color: 'var(--admin-text-faint)' }}>
                        @{s.username}{s.phone ? ` • ${s.phone}` : ''}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-1 rounded-lg text-[10px] font-black text-white" style={{ background: roleDef?.color || '#666' }}>
                        {roleDef?.label || s.role}
                      </span>
                    </td>
                    <td className="p-3 text-center font-black tabular-nums" style={{ color: 'var(--admin-accent)' }}>
                      {eff.size}<span className="text-[10px] font-bold" style={{ color: 'var(--admin-text-faint)' }}>/{ALL_PERMISSIONS.length}</span>
                    </td>
                    <td className="p-3 text-center">
                      {nRevoked > 0 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: '#fef2f2', color: '#b91c1c' }}>ปิด {nRevoked}</span>}
                      {nExtra > 0 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded ml-1" style={{ background: '#ecfdf5', color: '#047857' }}>เพิ่ม {nExtra}</span>}
                      {nRevoked === 0 && nExtra === 0 && <span className="text-[10px]" style={{ color: 'var(--admin-text-faint)' }}>ตามตำแหน่ง</span>}
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge status={s.status === 'suspended' ? 'blocked' : 'active'} />
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={e => { e.stopPropagation(); setSelected(s); setDetailTab('perms'); }}
                          className="p-2 rounded-lg border" title="ตั้งสิทธิ์"
                          style={{ background: 'var(--admin-subtle)', borderColor: 'var(--admin-border)', color: 'var(--admin-accent)' }}>
                          <span className="material-symbols-outlined text-base">tune</span>
                        </button>
                        <button onClick={e => { e.stopPropagation(); toggleSuspend(s); }}
                          className="p-2 rounded-lg border" title={s.status === 'suspended' ? 'ปลดระงับ' : 'ระงับ'}
                          style={{ background: 'var(--admin-subtle)', borderColor: 'var(--admin-border)', color: s.status === 'suspended' ? '#047857' : '#c2410c' }}>
                          <span className="material-symbols-outlined text-base">{s.status === 'suspended' ? 'lock_open' : 'lock'}</span>
                        </button>
                        <button onClick={e => { e.stopPropagation(); removeStaff(s); }}
                          className="p-2 rounded-lg border" title="ลบ"
                          style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>
                          <span className="material-symbols-outlined text-base">delete</span>
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
       * ★ แผงตั้งสิทธิ์ (รายคน)
       * ================================================================ */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex justify-end" onClick={() => setSelected(null)}>
          <div className="bg-white w-full max-w-3xl h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* หัวแผง */}
            <div className="sticky top-0 z-10 p-4 border-b-2 bg-white" style={{ borderColor: 'var(--admin-border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="font-black text-lg flex items-center gap-2" style={{ color: 'var(--admin-text)' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--admin-accent)' }}>manage_accounts</span>
                    ตั้งสิทธิ์การใช้งาน
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>
                    {selected.displayName || selected.username} • @{selected.username}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 rounded-xl border"
                  style={{ background: 'var(--admin-subtle)', borderColor: 'var(--admin-border)' }}>
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              {/* เลือกตำแหน่ง */}
              <div className="mt-3">
                <label className="text-[10px] font-black uppercase block mb-1.5" style={{ color: 'var(--admin-text-muted)' }}>ตำแหน่ง</label>
                <div className="flex flex-wrap gap-1.5">
                  {ROLE_LIST.filter(r => !r.locked).map(r => {
                    const on = selected.role === r.key;
                    return (
                      <button key={r.key} onClick={() => changeRole(selected, r.key)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-black border transition"
                        style={on ? { background: r.color, borderColor: r.color, color: '#fff' } : { background: '#fff', borderColor: 'var(--admin-border)', color: 'var(--admin-text-muted)' }}>
                        {r.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--admin-text-faint)' }}>
                  {ROLES[selected.role]?.desc}
                </p>
              </div>

              {/* แท็บย่อย */}
              <div className="flex gap-1.5 mt-3">
                {([['perms', 'สิทธิ์การใช้งาน', 'tune'], ['history', 'ประวัติการแก้', 'history']] as const).map(([k, label, icon]) => (
                  <button key={k} onClick={() => setDetailTab(k)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1 border transition"
                    style={detailTab === k
                      ? { background: 'var(--admin-accent)', borderColor: 'var(--admin-accent)', color: '#fff' }
                      : { background: '#fff', borderColor: 'var(--admin-border)', color: 'var(--admin-text-muted)' }}>
                    <span className="material-symbols-outlined text-sm">{icon}</span> {label}
                  </button>
                ))}
                <button onClick={() => resetToRole(selected)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1 border ml-auto"
                  style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' }}>
                  <span className="material-symbols-outlined text-sm">restart_alt</span> คืนตามตำแหน่ง
                </button>
              </div>
            </div>

            {/* ============ แท็บ: สิทธิ์ ============ */}
            {detailTab === 'perms' && (() => {
              const roleDef = ROLES[selected.role];
              const revoked = new Set(selected.revoked || []);
              const extra = new Set(selected.grantedExtra || []);
              const eff = effectivePermissions({ uid: selected.id, username: selected.username, displayName: '', role: selected.role, grantedExtra: selected.grantedExtra, revoked: selected.revoked });
              const q = permSearch.toLowerCase();

              return (
                <div className="p-4 space-y-3">
                  {/* แถบสรุป */}
                  <div className="rounded-xl border-2 p-3" style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-subtle)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black" style={{ color: 'var(--admin-text)' }}>
                        เปิดใช้งาน {eff.size} จาก {ALL_PERMISSIONS.length} สิทธิ์
                      </span>
                      {revoked.size > 0 && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#b91c1c' }}>
                          ★ ปิดไป {revoked.size} สิทธิ์
                        </span>
                      )}
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-white border" style={{ borderColor: 'var(--admin-border)' }}>
                      <div className="h-full transition-all" style={{ width: `${(eff.size / ALL_PERMISSIONS.length) * 100}%`, background: 'var(--admin-accent)' }} />
                    </div>
                  </div>

                  {/* ค้นหาสิทธิ์ */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: 'var(--admin-border)', background: '#fff' }}>
                    <span className="material-symbols-outlined text-base" style={{ color: 'var(--admin-text-muted)' }}>search</span>
                    <input value={permSearch} onChange={e => setPermSearch(e.target.value)}
                      placeholder="ค้นหาสิทธิ์ เช่น เครดิต, อนุมัติ, ลบ..."
                      className="flex-1 bg-transparent outline-none text-xs font-medium" />
                  </div>

                  {/* รายการสิทธิ์ตามหมวด */}
                  {PERMISSION_GROUPS.map(g => {
                    const gPerms = q ? g.perms.filter(p => p.label.toLowerCase().includes(q) || p.key.includes(q)) : g.perms;
                    if (gPerms.length === 0) return null;
                    const gGranted = g.perms.filter(p => eff.has(p.key)).length;
                    const open = expandGroups[g.key] !== false;
                    const allOn = gGranted === g.perms.length;

                    return (
                      <div key={g.key} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--admin-border)' }}>
                        {/* หัวหมวด */}
                        <div className="flex items-center gap-2 p-2.5" style={{ background: gGranted > 0 ? 'var(--admin-subtle)' : '#fff' }}>
                          <button onClick={() => setExpandGroups(prev => ({ ...prev, [g.key]: !open }))}
                            className="p-1 rounded" style={{ color: 'var(--admin-text-muted)' }}>
                            <span className="material-symbols-outlined text-base">{open ? 'expand_less' : 'expand_more'}</span>
                          </button>
                          <span className="material-symbols-outlined text-base" style={{ color: 'var(--admin-accent)' }}>{g.icon}</span>
                          <span className="font-black text-xs flex-1" style={{ color: 'var(--admin-text)' }}>{g.label}</span>
                          <span className="text-[10px] font-black tabular-nums" style={{ color: gGranted > 0 ? 'var(--admin-accent)' : 'var(--admin-text-faint)' }}>
                            {gGranted}/{g.perms.length}
                          </span>
                          <button onClick={() => toggleGroup(selected, g.key, !allOn)}
                            className="px-2 py-1 rounded text-[10px] font-black border"
                            style={allOn
                              ? { background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }
                              : { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' }}>
                            {allOn ? 'ปิดทั้งหมวด' : 'เปิดทั้งหมวด'}
                          </button>
                        </div>

                        {/* รายการสิทธิ์ */}
                        {open && (
                          <div className="divide-y" style={{ borderColor: 'var(--admin-border)' }}>
                            {gPerms.map(p => {
                              const inRole = roleDef.perms.includes(p.key);
                              const isOn = eff.has(p.key);
                              const isRevoked = revoked.has(p.key);
                              const isExtra = extra.has(p.key);
                              const risk = RISK_LABEL[(p.risk || 'low') as RiskLevel];

                              return (
                                <label key={p.key}
                                  className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-black/[0.02] transition">
                                  <input type="checkbox" checked={isOn}
                                    onChange={() => togglePermission(selected, p.key)}
                                    className="w-5 h-5 rounded cursor-pointer accent-[var(--admin-accent)]" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold" style={{ color: isOn ? 'var(--admin-text)' : 'var(--admin-text-faint)' }}>
                                        {p.label}
                                      </span>
                                      {isRevoked && (
                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: '#fef2f2', color: '#b91c1c' }}>ปิดเฉพาะคนนี้</span>
                                      )}
                                      {isExtra && (
                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: '#ecfdf5', color: '#047857' }}>ให้เพิ่ม</span>
                                      )}
                                      {inRole && !isRevoked && !isExtra && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--admin-subtle)', color: 'var(--admin-text-faint)' }}>ตามตำแหน่ง</span>
                                      )}
                                    </div>
                                    <div className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--admin-text-faint)' }}>{p.key}</div>
                                  </div>
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0"
                                    style={{ background: risk.bg, color: risk.color }}>
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

            {/* ============ แท็บ: ประวัติ ============ */}
            {detailTab === 'history' && (
              <div className="p-4 space-y-2">
                {logs.filter(l => l.targetUid === selected.id).length === 0 && (
                  <div className="text-center p-8 font-bold italic text-xs" style={{ color: 'var(--admin-text-faint)' }}>
                    ยังไม่มีประวัติการแก้สิทธิ์ของพนักงานคนนี้
                  </div>
                )}
                {logs.filter(l => l.targetUid === selected.id).map(l => (
                  <div key={l.id} className="rounded-xl border p-3 flex items-start gap-2" style={{ borderColor: 'var(--admin-border)' }}>
                    <span className="material-symbols-outlined text-base shrink-0"
                      style={{ color: l.action === 'revoke' ? '#b91c1c' : l.action === 'delete' ? '#b91c1c' : '#047857' }}>
                      {l.action === 'revoke' ? 'lock' : l.action === 'delete' ? 'delete' : l.action === 'role_change' ? 'swap_horiz' : 'check_circle'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold" style={{ color: 'var(--admin-text)' }}>{describeChange(l)}</div>
                      {l.note && <div className="text-[10px] mt-0.5" style={{ color: 'var(--admin-text-muted)' }}>{l.note}</div>}
                      <div className="text-[9px] mt-0.5" style={{ color: 'var(--admin-text-faint)' }}>
                        {l.actorName} • {new Date(l.at).toLocaleString('th-TH')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
       * ฟอร์มเพิ่ม/แก้พนักงาน
       * ================================================================ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-black text-base mb-4 flex items-center gap-2" style={{ color: 'var(--admin-text)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--admin-accent)' }}>person_add</span>
              {form.id ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงานใหม่'}
            </h3>

            <div className="space-y-3">
              {[
                { k: 'username', label: 'ชื่อผู้ใช้ (สำหรับล็อกอิน) *', ph: 'เช่น somchai' },
                { k: 'password', label: 'รหัสผ่าน (Password) *', ph: 'อย่างน้อย 6 ตัวอักษร เช่น 123456' },
                { k: 'displayName', label: 'ชื่อที่แสดง', ph: 'เช่น สมชาย ใจดี' },
                { k: 'phone', label: 'เบอร์โทร', ph: '08x-xxx-xxxx' },
                { k: 'note', label: 'หมายเหตุ', ph: 'เช่น พนักงานกะเช้า' },
              ].map(f => (
                <div key={f.k}>
                  <label className="text-[10px] font-black uppercase block mb-1" style={{ color: 'var(--admin-text-muted)' }}>{f.label}</label>
                  <input value={(form as any)[f.k] || ''} placeholder={f.ph}
                    onChange={e => setForm(prev => ({ ...prev, [f.k]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border outline-none text-xs font-medium"
                    style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-subtle)' }} />
                </div>
              ))}

              <div>
                <label className="text-[10px] font-black uppercase block mb-1.5" style={{ color: 'var(--admin-text-muted)' }}>ตำแหน่งเริ่มต้น</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ROLE_LIST.filter(r => !r.locked).map(r => (
                    <button key={r.key} onClick={() => setForm(prev => ({ ...prev, role: r.key }))}
                      className="px-3 py-2 rounded-xl text-[11px] font-black border text-left transition"
                      style={form.role === r.key
                        ? { background: r.color, borderColor: r.color, color: '#fff' }
                        : { background: '#fff', borderColor: 'var(--admin-border)', color: 'var(--admin-text-muted)' }}>
                      {r.label}
                      <div className="text-[9px] font-normal opacity-80">{ROLES[r.key].perms.length} สิทธิ์</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl font-black text-xs border"
                style={{ background: '#fff', borderColor: 'var(--admin-border)', color: 'var(--admin-text-muted)' }}>
                ยกเลิก
              </button>
              <button onClick={saveForm} disabled={saving}
                className="flex-1 py-2.5 rounded-xl font-black text-xs text-white disabled:opacity-50"
                style={{ background: 'var(--admin-accent)' }}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
