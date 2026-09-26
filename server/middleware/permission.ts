/**
 * server/middleware/permission.ts
 * ------------------------------------------------------------------
 * ★ B5: ตรวจสิทธิ์ "ฝั่งเซิร์ฟเวอร์" ★
 *
 * ปัญหาที่แก้:
 *   เดิมระบบสิทธิ์กันแค่ที่ UI (ซ่อนปุ่ม) — ใครยิง API ตรง ๆ ก็ทำได้
 *   ต้องกันที่ API ด้วย ไม่งั้นไม่ปลอดภัยจริง
 *
 * ★★★ จุดสำคัญที่สุด: ห้ามพิมพ์รายการสิทธิ์ซ้ำเอง ★★★
 *   ไฟล์นี้ **import จาก src/shared/lib/permissions.ts โดยตรง**
 *   เพื่อให้ฝั่ง server กับ UI ใช้รายการเดียวกันเสมอ
 *   (เดิมพิมพ์ซ้ำ → เพี้ยน 21 รายการ เพราะเดาชื่อผิด)
 *
 * หลักการ (เหมือนฝั่ง UI ทุกข้อ):
 *   1. deny by default — ไม่มีสิทธิ์ = ปฏิเสธ
 *   2. granted เพิ่มได้, revoked ชนะเสมอ (แม้ owner/master)
 *   3. disabled / หมดอายุ = ไม่มีสิทธิ์อะไรเลย
 *   4. ตรวจทุก request ไม่ cache ข้ามคำขอ
 *
 * วิธีใช้:
 *   router.post('/close', requirePermission('lottery.open_close'), handler)
 *   router.get('/report', requireAnyPermission(['report.view','report.finance']), handler)
 */

import type { Request, Response, NextFunction } from 'express';
import {
  ALL_PERMISSIONS as UI_ALL,
  ROLES,
  type RoleKey,
  type Permission,
} from '../../src/shared/lib/permissions';

/* ==================================================================
 * 1. สิทธิ์ทั้งหมด — ดึงจาก UI ตรง ๆ (แหล่งความจริงเดียว)
 * ================================================================== */

/** สิทธิ์ทุกอย่างที่ระบบรองรับ (72 รายการ) */
export const ALL_PERMISSIONS: string[] = [...UI_ALL];

/** role ที่ล็อกไว้ — ได้ทุกสิทธิ์เสมอ (ยกเว้นถูกถอดรายตัว) */
export const LOCKED_ROLES: RoleKey[] = ['owner', 'master'];

/** สิทธิ์ของแต่ละ role — ดึงจาก ROLES ของ UI */
export const ROLE_PERMISSIONS: Record<RoleKey, string[]> = (() => {
  const out: any = {};
  for (const [key, def] of Object.entries(ROLES)) {
    out[key] = [...(def as any).perms];
  }
  return out as Record<RoleKey, string[]>;
})();

/** สิทธิ์ของหวย 20 ช่อง — ชุดที่ต้องมีในระบบ */
export const GAME20_PERMISSIONS: string[] = [
  'game20.view', 'game20.config', 'game20.rates', 'game20.bot_result',
  'game20.bot_number', 'game20.history', 'game20.edit_result', 'game20.codes',
  'game20.risk_limits', 'game20.report', 'game20.close_round',
];

/* ==================================================================
 * 2. session ที่แนบมากับ request
 * ================================================================== */

export type { RoleKey };

export interface ServerSession {
  userId?: string;
  username?: string;
  role: RoleKey;
  /** สิทธิ์ที่เพิ่มเป็นพิเศษ */
  granted?: string[];
  /** ★ สิทธิ์ที่ถูกถอด — ชนะเสมอ */
  revoked?: string[];
  /** ปิดการใช้งาน */
  disabled?: boolean;
  /** หมดอายุ (ms) */
  expiresAt?: number;
}

/** session ใช้ได้อยู่ไหม (ไม่ถูกปิด/ไม่หมดอายุ) */
export function isSessionActive(session: ServerSession | null | undefined): boolean {
  if (!session) return false;
  if (session.disabled) return false;
  if (session.expiresAt && Date.now() > session.expiresAt) return false;
  if (!session.role) return false;
  return true;
}

/**
 * คำนวณสิทธิ์จริง — กติกาเดียวกับฝั่ง UI เป๊ะ
 *
 * ★ ลำดับสำคัญ: role → granted → revoked (revoked ลบทีหลังสุด = ชนะเสมอ)
 */
export function effectivePermissions(session: ServerSession | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!isSessionActive(session)) return out;

  const role = session!.role;

  // 1) พื้นฐานตาม role (locked role ได้ทุกอย่าง)
  if (LOCKED_ROLES.includes(role)) {
    for (const p of ALL_PERMISSIONS) out.add(p);
  } else {
    for (const p of ROLE_PERMISSIONS[role] || []) out.add(p);
  }

  // 2) เพิ่มที่ให้เป็นพิเศษ
  for (const p of session!.granted || []) out.add(p);

  // 3) ★ ถอด — ลบทีหลังสุด ชนะทุกอย่าง (รวม owner/master)
  for (const p of session!.revoked || []) out.delete(p);

  return out;
}

/**
 * ตรวจสิทธิ์เดียว
 * ★ ใช้ effectivePermissions เสมอ เพื่อให้ revoked ชนะแม้ owner/master
 */
export function hasPermission(session: ServerSession | null | undefined, perm: string): boolean {
  if (!isSessionActive(session)) return false;
  return effectivePermissions(session).has(perm);
}

/** ตรวจหลายสิทธิ์ (ต้องมีอย่างน้อย 1) */
export function hasAnyPermission(session: ServerSession | null | undefined, perms: string[]): boolean {
  if (!isSessionActive(session)) return false;
  const eff = effectivePermissions(session);
  return perms.some(p => eff.has(p));
}

/** ตรวจหลายสิทธิ์ (ต้องมีทั้งหมด) */
export function hasAllPermissions(session: ServerSession | null | undefined, perms: string[]): boolean {
  if (!isSessionActive(session)) return false;
  const eff = effectivePermissions(session);
  return perms.every(p => eff.has(p));
}

/* ==================================================================
 * 3. อ่าน session จาก request
 * ================================================================== */

export function readSession(req: Request): ServerSession | null {
  const fromLocals = (req as any).res?.locals?.staffSession;
  if (fromLocals) return fromLocals as ServerSession;

  const raw = req.headers['x-staff-session'];
  if (!raw || typeof raw !== 'string') return null;

  try {
    let txt = raw;
    if (!txt.trim().startsWith('{')) {
      txt = Buffer.from(raw, 'base64').toString('utf-8');
    }
    const obj = JSON.parse(txt);
    if (!obj || typeof obj !== 'object') return null;
    if (!obj.role) return null;
    if (!Object.keys(ROLES).includes(obj.role)) return null;   // ★ role ต้องรู้จัก
    if (obj.disabled) return null;
    return obj as ServerSession;
  } catch {
    return null;
  }
}

/* ==================================================================
 * 4. Middleware
 * ================================================================== */

function deny(res: Response, need: string[], session: ServerSession | null, requestId?: string) {
  const ok = isSessionActive(session);
  res.status(ok ? 403 : 401).json({
    status: 'error',
    code: ok ? 'PERMISSION_DENIED' : 'NOT_AUTHENTICATED',
    message: ok
      ? `ไม่มีสิทธิ์ใช้งานส่วนนี้ (ต้องมี: ${need.join(' หรือ ')})`
      : 'ต้องเข้าสู่ระบบก่อน',
    need,
    role: session?.role ?? null,
    requestId,
  });
}

/** บังคับสิทธิ์ 1 อย่าง */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = readSession(req);
    if (hasPermission(session, permission)) { next(); return; }
    deny(res, [permission], session, res.locals?.requestId);
  };
}

/** ต้องมีอย่างน้อย 1 ในรายการ */
export function requireAnyPermission(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = readSession(req);
    if (hasAnyPermission(session, permissions)) { next(); return; }
    deny(res, permissions, session, res.locals?.requestId);
  };
}

/** ต้องมีทั้งหมด */
export function requireAllPermissions(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = readSession(req);
    if (hasAllPermissions(session, permissions)) { next(); return; }
    deny(res, permissions, session, res.locals?.requestId);
  };
}

/** ต้องมี role ตามที่กำหนด */
export function requireRole(roles: RoleKey[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = readSession(req);
    if (session && roles.includes(session.role)) { next(); return; }
    res.status(session ? 403 : 401).json({
      status: 'error',
      code: session ? 'ROLE_DENIED' : 'NOT_AUTHENTICATED',
      message: session
        ? `ต้องเป็น: ${roles.join(' หรือ ')} (คุณเป็น ${session.role})`
        : 'ต้องเข้าสู่ระบบก่อน',
      role: session?.role ?? null,
      requestId: res.locals?.requestId,
    });
  };
}

/* ==================================================================
 * 5. ตัวช่วยตรวจเส้นสำคัญ
 * ================================================================== */

export interface CriticalRoute {
  path: string;
  method: string;
  need: string[];
  desc: string;
}

/** เส้นที่ "ต้อง" ป้องกัน — ใช้ในเทสต์/health check */
export const CRITICAL_ROUTES: CriticalRoute[] = [
  { path: '/api/v1/lottery/close',        method: 'POST', need: ['lottery.open_close'],   desc: 'ปิดรอบ' },
  { path: '/api/v1/lottery/result',       method: 'POST', need: ['lottery.result_edit'], desc: 'แก้ผลหวย' },
  { path: '/api/v1/lottery/settle',       method: 'POST', need: ['lottery.settle'],      desc: 'จ่ายรางวัล' },
  { path: '/api/v1/game20/config',        method: 'PUT',  need: ['game20.config'],       desc: 'ตั้งค่าหวย 20 ช่อง' },
  { path: '/api/v1/game20/rates',         method: 'PUT',  need: ['game20.rates'],        desc: 'ตั้งอัตราจ่าย' },
  { path: '/api/v1/game20/bot/config',    method: 'PUT',  need: ['game20.bot_result'],   desc: 'ตั้งบอท' },
  { path: '/api/v1/game20/bot/result',    method: 'POST', need: ['game20.bot_result'],   desc: 'สั่งบอทออกผล' },
  { path: '/api/v1/game20/bot/number',    method: 'POST', need: ['game20.bot_number'],   desc: 'สั่งบอทวางเลข' },
  { path: '/api/v1/game20/rounds/close',  method: 'POST', need: ['game20.close_round'],  desc: 'ปิดรอบ 20 ช่อง' },
  { path: '/api/v1/game20/history/edit',  method: 'POST', need: ['game20.edit_result'],  desc: 'แก้ผลย้อนหลัง' },
  { path: '/api/v1/finance/adjust',       method: 'POST', need: ['finance.adjust'],      desc: 'ปรับเงินมือ' },
  { path: '/api/v1/staff/permission',     method: 'PUT',  need: ['staff.set_permission'], desc: 'ตั้งสิทธิ์พนักงาน' },
  { path: '/api/v1/keys/revoke',          method: 'POST', need: ['api.revoke_key'],      desc: 'ยกเลิก API key' },
  { path: '/api/v1/security/ip-whitelist', method: 'PUT', need: ['security.ip_whitelist'], desc: 'ตั้ง IP' },
  { path: '/api/v1/settings/rollback',    method: 'POST', need: ['settings.history_rollback'], desc: 'ย้อนการตั้งค่า' },
];

/** ตรวจว่ารายการสิทธิ์ที่อ้างถึงมีจริงในระบบไหม */
export function validateCriticalRoutes(): { ok: boolean; unknown: string[] } {
  const unknown: string[] = [];
  for (const r of CRITICAL_ROUTES) {
    for (const p of r.need) {
      if (!ALL_PERMISSIONS.includes(p)) unknown.push(`${r.path} → ${p}`);
    }
  }
  return { ok: unknown.length === 0, unknown };
}

/** เทียบว่าฝั่ง server กับ UI ตรงกันไหม (ต้องตรงเสมอ เพราะ import ตัวเดียวกัน) */
export function compareWithUi(uiAll: string[], uiRoles: Record<string, string[]>): {
  ok: boolean;
  missingInServer: string[];
  missingInUi: string[];
  roleMismatch: string[];
} {
  const serverSet = new Set(ALL_PERMISSIONS);
  const uiSet = new Set(uiAll);

  const missingInServer = uiAll.filter(p => !serverSet.has(p));
  const missingInUi = ALL_PERMISSIONS.filter(p => !uiSet.has(p));

  const roleMismatch: string[] = [];
  for (const [role, perms] of Object.entries(uiRoles)) {
    const mine = ROLE_PERMISSIONS[role as RoleKey];
    if (!mine) { roleMismatch.push(`role ${role} ไม่มีใน server`); continue; }
    const a = new Set(perms), b = new Set(mine);
    const onlyUi = perms.filter(p => !b.has(p));
    const onlyServer = mine.filter(p => !a.has(p));
    if (onlyUi.length) roleMismatch.push(`${role}: UI มีเกิน ${onlyUi.length}`);
    if (onlyServer.length) roleMismatch.push(`${role}: server มีเกิน ${onlyServer.length}`);
  }

  return {
    ok: !missingInServer.length && !missingInUi.length && !roleMismatch.length,
    missingInServer,
    missingInUi,
    roleMismatch,
  };
}

/** สรุปสำหรับ health check */
export function permissionHealth() {
  const routes = validateCriticalRoutes();
  return {
    totalPermissions: ALL_PERMISSIONS.length,
    roles: Object.fromEntries(
      Object.entries(ROLE_PERMISSIONS).map(([k, v]) => [k, v.length]),
    ),
    criticalRoutes: CRITICAL_ROUTES.length,
    criticalRoutesValid: routes.ok,
    unknownPermissions: routes.unknown,
  };
}
