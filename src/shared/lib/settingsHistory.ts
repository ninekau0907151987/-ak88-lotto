/**
 * src/shared/lib/settingsHistory.ts
 * ------------------------------------------------------------------
 * ★ ประวัติการตั้งค่า (Settings History / Audit Trail) ★
 *
 * ผู้ใช้ขอ: "ตั้งค่าต้องมีประวัติ รหัส"
 *
 * ครอบคลุม 2 เรื่อง:
 *   1. ประวัติการแก้ไขค่าตั้งค่า — ใคร แก้อะไร จากอะไร เป็นอะไร เมื่อไร
 *      เก็บลง collection `settingsHistory`
 *   2. รหัส (PIN/Password) — เก็บเป็น hash เท่านั้น ห้ามเก็บ plaintext
 *      เก็บลง collection `adminCredentials` (doc เดียว ไม่ใช่ collection)
 *      ★ ใช้ SHA-256 + salt ผ่าน Web Crypto API
 *
 * ★ กฎความปลอดภัย:
 *   - ห้ามเก็บรหัสผ่าน/PIN เป็นข้อความธรรมดาเด็ดขาด
 *   - การเปลี่ยนรหัสต้องยืนยันรหัสเดิมก่อนเสมอ
 *   - ทุกการเปลี่ยนรหัสต้องบันทึกประวัติ (ไม่บันทึกรหัส แต่บันทึกว่าเปลี่ยน)
 */
import { db } from '@/shared/lib/firebase';
import { collection, addDoc, getDocs, doc, getDoc, setDoc, query, orderBy, limit, where } from 'firebase/firestore';

/* ============================================================
 * 1. ประวัติการตั้งค่า
 * ============================================================ */

export interface SettingsChange {
  /** หมวดที่แก้: system | lottery | rate | blocked | popup | credential | agent | user */
  category: string;
  /** ชื่อค่าที่แก้ เช่น 'bettingOpen' หรือ 'อัตราจ่าย 3 ตัวบน' */
  key: string;
  /** ค่าก่อนแก้ */
  before: unknown;
  /** ค่าหลังแก้ */
  after: unknown;
  /** ใครแก้ */
  admin?: string;
  /** หมายเหตุ */
  note?: string;
}

/** บันทึกการเปลี่ยนแปลงค่าตั้งค่า 1 รายการ */
export async function recordSettingsChange(change: SettingsChange): Promise<void> {
  try {
    await addDoc(collection(db, 'settingsHistory'), {
      category: change.category,
      key: change.key,
      before: serialize(change.before),
      after: serialize(change.after),
      admin: change.admin || 'Admin',
      note: change.note || '',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[settingsHistory] บันทึกประวัติไม่สำเร็จ:', e);
  }
}

/** บันทึกหลายรายการพร้อมกัน (ตอนเซฟทั้งฟอร์ม) */
export async function recordSettingsChanges(changes: SettingsChange[]): Promise<void> {
  await Promise.all(changes.map(recordSettingsChange));
}

/** ประวัติการตั้งค่า (ล่าสุดก่อน) */
export async function fetchSettingsHistory(options: {
  max?: number;
  category?: string;
} = {}) {
  const conds: any[] = [];
  if (options.category) conds.push(where('category', '==', options.category));
  const q = query(
    collection(db, 'settingsHistory'),
    ...conds,
    orderBy('timestamp', 'desc'),
    limit(options.max || 100),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
}

/** แปลงค่าเป็นข้อความที่อ่านได้ (สำหรับแสดงในตาราง) */
function serialize(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'เปิด' : 'ปิด';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

/** แปลงค่าที่บันทึกไว้ให้อ่านง่าย */
export function prettyValue(v: unknown): string {
  const s = String(v ?? '');
  if (s === '—' || s === '') return '—';
  if (s === 'true') return 'เปิด';
  if (s === 'false') return 'ปิด';
  // ตัวเลขยาวๆ ใส่คอมมา
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (Math.abs(n) >= 1000) return n.toLocaleString('th-TH');
  }
  return s;
}

/** สรุปว่าค่าเปลี่ยนจริงไหม (กันบันทึกประวัติเปล่า) */
export function didChange(before: unknown, after: unknown): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

/* ============================================================
 * 2. รหัส (PIN / Password) — เก็บเป็น hash เท่านั้น
 * ============================================================ */

const CRED_DOC = 'adminCredentials';
const CRED_COLLECTION = 'systemConfig';

/** สร้าง salt แบบสุ่ม */
function makeSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256(salt + รหัส) → hex */
async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}::${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** ตรวจว่ารหัสผ่านตรงกับที่เก็บไว้ไหม */
export async function verifyPin(pin: string): Promise<boolean> {
  const snap = await getDoc(doc(db, CRED_COLLECTION, CRED_DOC));
  if (!snap.exists()) return false;
  const d = snap.data() as any;
  if (!d?.pinHash || !d?.salt) return false;
  return (await hashPin(pin, d.salt)) === d.pinHash;
}

/** ตั้งรหัสใหม่ — ต้องยืนยันรหัสเดิมก่อน (ถ้ามีรหัสอยู่แล้ว) */
export async function setPin(
  newPin: string,
  currentPin?: string,
  admin = 'Admin',
): Promise<{ ok: boolean; message: string }> {
  if (!/^\d{4,12}$/.test(newPin)) {
    return { ok: false, message: 'รหัสต้องเป็นตัวเลข 4-12 หลัก' };
  }

  const ref = doc(db, CRED_COLLECTION, CRED_DOC);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data() as any) : null;

  // ถ้ามีรหัสอยู่แล้ว ต้องยืนยันรหัสเดิม
  if (existing?.pinHash) {
    if (!currentPin) return { ok: false, message: 'กรุณากรอกรหัสเดิม' };
    const okCurrent = (await hashPin(currentPin, existing.salt)) === existing.pinHash;
    if (!okCurrent) return { ok: false, message: 'รหัสเดิมไม่ถูกต้อง' };
  }

  const salt = makeSalt();
  const pinHash = await hashPin(newPin, salt);

  await setDoc(ref, {
    pinHash,
    salt,
    // ★ ไม่เก็บ rawPin เด็ดขาด
    updatedAt: new Date().toISOString(),
    updatedBy: admin,
    version: (existing?.version || 0) + 1,
  }, { merge: true });

  // ★ บันทึกประวัติ (ไม่บันทึกรหัส)
  await recordSettingsChange({
    category: 'credential',
    key: 'รหัสเข้าใช้งาน',
    before: existing?.pinHash ? `ตั้งไว้แล้ว (v${existing.version || 1})` : 'ยังไม่ตั้ง',
    after: `เปลี่ยนใหม่ (v${(existing?.version || 0) + 1})`,
    admin,
    note: 'เปลี่ยนรหัสเข้าใช้งาน',
  });

  return { ok: true, message: 'ตั้งรหัสใหม่สำเร็จ' };
}

/** ข้อมูลรหัส (ไม่คืนตัวรหัส) */
export async function getPinInfo() {
  const snap = await getDoc(doc(db, CRED_COLLECTION, CRED_DOC));
  if (!snap.exists()) return { configured: false, version: 0, updatedAt: null, updatedBy: null };
  const d = snap.data() as any;
  return {
    configured: !!d?.pinHash,
    version: d?.version || 0,
    updatedAt: d?.updatedAt || null,
    updatedBy: d?.updatedBy || null,
  };
}
