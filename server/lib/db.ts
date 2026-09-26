/**
 * server/lib/db.ts
 * ------------------------------------------------------------------
 * ★ ชั้นเข้าถึงฐานข้อมูล — รวมศูนย์ ใช้ง่าย ปลอดภัย ★
 *
 * ผู้ใช้ขอ: "วางดาต้าบส เป็นระบบ เอาลงข้อมูลได้ง่าย เรียกใช้ได้ง่ายด้วยนะครับ"
 *
 * เป้าหมาย:
 *   1. ที่เดียวที่รู้ว่า collection/subcollection อยู่ตรงไหน
 *   2. เรียกใช้ง่าย — repo.rounds.insert(...) / repo.users.find(...)
 *   3. ใส่ข้อมูลง่าย — ลบ undefined อัตโนมัติ, ใส่ timestamp เอง
 *   4. ค้นหาใช้ง่าย — where/orderBy/limit/offset เป็นอ็อบเจกต์
 *   5. ★ ทำงานได้แม้ Firestore ยังไม่ตั้งค่า (offline fallback + แจ้งชัด)
 *   6. ★ seed ข้อมูลตั้งต้นได้ในคำสั่งเดียว
 *
 * ตัวอย่างการใช้:
 *   const db = createDb(firestoreInstance);
 *   const repo = createRepositories(db);
 *
 *   // ใส่ — ไม่ต้องกังวล undefined/timestamp
 *   await repo.game20Rounds.insert({ roundId:'r1', result:'123456' });
 *
 *   // อ่าน
 *   const r = await repo.game20Rounds.get('r1');
 *
 *   // ค้นหาแบบอ็อบเจกต์
 *   const list = await repo.game20History.find({
 *     where: [['action','==','edit_result']],
 *     orderBy: ['at','desc'],
 *     limit: 50,
 *   });
 *
 *   // นับ / มีไหม / อัปเดต / ลบ
 *   await repo.game20Codes.count();
 *   await repo.game20Rounds.exists('r1');
 *   await repo.game20Rounds.update('r1', { resultLocked:true });
 *   await repo.game20Codes.remove('c1');
 * ==================================================================
 */
import {
  collection as fsCollection,
  doc as fsDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query as fsQuery,
  where as fsWhere,
  orderBy as fsOrderBy,
  limit as fsLimit,
} from 'firebase/firestore';
import { COL, type CollectionName } from '../config/collections';

/* ==================================================================
 * 1. ประเภท
 * ================================================================== */

export type WhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'not-in';
export type WhereClause = [field: string, op: WhereOp, value: unknown];

export interface FindOptions {
  where?: WhereClause[];
  orderBy?: [field: string, dir: 'asc' | 'desc'][];
  limit?: number;
  /** ข้ามกี่รายการ (ทำฝั่ง client — Firestore ไม่มี offset ตรงๆ) */
  offset?: number;
  /** เลือกเฉพาะ field ที่ต้องการ */
  select?: string[];
}

export interface WriteOptions {
  /** true = รวมกับข้อมูลเดิม (ค่าเริ่มต้น) */
  merge?: boolean;
  /** ★ ใส่ timestamp อัตโนมัติ (createdAt / updatedAt) */
  timestamps?: boolean;
  /** ใครทำ (audit) */
  actor?: string;
}

/* ==================================================================
 * 2. ตัวช่วยจัดการค่า — ทำให้ "เอาลงข้อมูลได้ง่าย"
 * ================================================================== */

/**
 * ★ ลบ field ที่เป็น undefined ออก (Firestore ปฏิเสธค่าที่เป็น undefined)
 * ทำแบบ recursive — ลบใน nested object ด้วย
 */
export function stripUndefined<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(v => stripUndefined(v)) as unknown as T;
  }
  // ★ เก็บ Date ไว้เป็น Date (Firestore รู้จัก)
  if (value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = stripUndefined(v);
  }
  return out as T;
}

/** แปลงค่าที่ Firestore ไม่รับ (NaN, Infinity) ให้เป็น null พร้อมเตือน */
export function sanitize(value: unknown, path = ''): unknown {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      console.warn(`[db] ค่าไม่ใช่ตัวเลขที่ใช้ได้ที่ ${path || '(root)'}: ${value} → null`);
      return null;
    }
    return value;
  }
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v, i) => sanitize(v, `${path}[${i}]`));
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitize(v, path ? `${path}.${k}` : k);
    }
    return out;
  }
  // ★ string ที่ยาวเกินเพดาน Firestore (1 MB) — ตัดพร้อมเตือน
  if (typeof value === 'string' && value.length > 900_000) {
    console.warn(`[db] string ยาวเกินไปที่ ${path} (${value.length}) → ตัดเหลือ 900,000`);
    return value.slice(0, 900_000);
  }
  return value;
}

/** ★ เตรียมข้อมูลก่อนเขียน — ลบ undefined + แปลงค่าไม่Valid */
export function prepare<T extends Record<string, unknown>>(
  data: T,
  opts: WriteOptions = {},
  mode: 'create' | 'update' = 'create',
): Record<string, unknown> {
  let out: Record<string, unknown> = { ...data };

  if (opts.timestamps !== false) {
    const now = new Date().toISOString();
    if (mode === 'create') {
      out.createdAt = out.createdAt ?? now;
      if (opts.actor) out.createdBy = out.createdBy ?? opts.actor;
    }
    out.updatedAt = now;
    if (opts.actor) out.updatedBy = opts.actor;
  }

  out = sanitize(out) as Record<string, unknown>;
  return stripUndefined(out);
}

/* ==================================================================
 * 3. Repository — อ่าน/เขียนใช้ง่าย
 * ================================================================== */

export interface Repo<T = any> {
  /** ชื่อ collection */
  readonly name: string;
  /** ★ เพิ่มข้อมูลใหม่ (คืน id ที่สร้าง) */
  insert(data: Partial<T> & Record<string, unknown>, opts?: WriteOptions): Promise<string>;
  /** ★ เขียนทับ/รวม ด้วย id ที่กำหนด */
  set(id: string, data: Partial<T> & Record<string, unknown>, opts?: WriteOptions): Promise<void>;
  /** อ่าน 1 รายการ — คืน null ถ้าไม่มี */
  get(id: string): Promise<(T & { id: string }) | null>;
  /** ตรวจว่ามีไหม */
  exists(id: string): Promise<boolean>;
  /** ★ อัปเดตบาง field */
  update(id: string, patch: Partial<T> & Record<string, unknown>, opts?: WriteOptions): Promise<void>;
  /** ลบ */
  remove(id: string): Promise<void>;
  /** ★ ค้นหาแบบอ็อบเจกต์ */
  find(opts?: FindOptions): Promise<(T & { id: string })[]>;
  /** หา 1 รายการแรกที่ตรง */
  findOne(opts?: FindOptions): Promise<(T & { id: string }) | null>;
  /** นับจำนวนที่ตรง */
  count(opts?: FindOptions): Promise<number>;
  /** อ่านทั้งหมด (จำกัด 1000 โดยปริยาย) */
  all(limit?: number): Promise<(T & { id: string })[]>;
  /** ★ ลบทั้ง collection (ใช้กับ seed/reset) */
  clear(): Promise<number>;
  /** ★ ใส่หลายรายการพร้อมกัน — ใช้กับ seed */
  insertMany(items: Array<Partial<T> & Record<string, unknown>>, opts?: WriteOptions): Promise<number>;
}

/** ★ ตัวนำ Firestore แบบหลวม — ทำงานได้ทั้งของจริงและ mock */
export interface FirestoreLike {
  doc(path: string, ...rest: string[]): any;
  collection(path: string): any;
}

function makeRepo<T = any>(fs: any, name: string): Repo<T> {
  // ★ ใช้ static import (ไม่ใช่ lazy) — จำเป็นเพราะ dynamic import ผ่าน tsx
  //   ทำให้ DocumentReference ได้ object เปล่า ไม่มี .get/.set/.exists (บั๊กจริง)
  const colRef = () => fsCollection(fs, name);
  const docRef = (id: string) => fsDoc(fs, name, id);

  /** ★ สร้าง query จาก FindOptions */
  const buildQuery = (opts: FindOptions = {}) => {
    const parts: any[] = [fsCollection(fs, name)];
    (opts.where || []).forEach(w => parts.push(fsWhere(w[0], w[1] as any, w[2])));
    (opts.orderBy || []).forEach(o => parts.push(fsOrderBy(o[0], o[1])));
    if (opts.limit) parts.push(fsLimit(Math.min(opts.limit, 5000)));
    return fsQuery(parts[0], ...parts.slice(1));
  };

  /** ตัด field ที่ไม่ต้องการออก (select) */
  const project = (row: any, select?: string[]) => {
    if (!select?.length) return row;
    const out: any = { id: row.id };
    select.forEach(k => { if (k in row) out[k] = row[k]; });
    return out;
  };

  return {
    name,

    async insert(data, opts = {}) {
      const payload = prepare(data, opts, 'create');
      const ref = await addDoc(colRef(), payload);
      return ref.id;
    },

    async set(id, data, opts = {}) {
      const payload = prepare(data, opts, 'update');
      await setDoc(docRef(id), payload, { merge: opts.merge !== false });
    },

    async get(id) {
      try {
        const snap = await getDoc(docRef(id));
        if (!snap.exists()) return null;
        return { id: snap.id, ...(snap.data() as T) };
      } catch (e) {
        console.warn(`[db] ${name}.get(${id}) ล้มเหลว: ${(e as Error).message}`);
        return null;
      }
    },

    async exists(id) {
      try {
        const snap = await getDoc(docRef(id));
        return snap.exists();
      } catch {
        return false;
      }
    },

    async update(id, patch, opts = {}) {
      const cleaned = stripUndefined(sanitize(patch) as Record<string, unknown>);
      if (opts.timestamps !== false) {
        cleaned.updatedAt = new Date().toISOString();
        if (opts.actor) cleaned.updatedBy = opts.actor;
      }
      await updateDoc(docRef(id), cleaned);
    },

    async remove(id) {
      await deleteDoc(docRef(id));
    },

    async find(opts = {}) {
      try {
        const snap = await getDocs(buildQuery(opts));
        let rows = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        if (opts.offset) rows = rows.slice(opts.offset);
        return rows.map((r: any) => project(r, opts.select));
      } catch (e) {
        // ★ query ที่ต้องใช้ composite index จะล้มเหลว → ลองอ่านทั้งหมดแล้วกรองเอง
        console.warn(`[db] ${name}.find() ใช้ index ไม่ได้ → กรองฝั่ง client: ${(e as Error).message}`);
        try {
          const snap = await getDocs(colRef());
          let rows: any[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          for (const [f, op, v] of opts.where || []) {
            rows = rows.filter(r => {
              const x = r[f];
              switch (op) {
                case '==': return x === v;
                case '!=': return x !== v;
                case '<': return x < (v as any);
                case '<=': return x <= (v as any);
                case '>': return x > (v as any);
                case '>=': return x >= (v as any);
                case 'array-contains': return Array.isArray(x) && x.includes(v);
                case 'in': return Array.isArray(v) && (v as any[]).includes(x);
                case 'not-in': return Array.isArray(v) && !(v as any[]).includes(x);
                default: return true;
              }
            });
          }
          for (const [f, dir] of [...(opts.orderBy || [])].reverse()) {
            rows.sort((a, b) => {
              const av = a[f], bv = b[f];
              if (av === bv) return 0;
              const c = av > bv ? 1 : -1;
              return dir === 'desc' ? -c : c;
            });
          }
          if (opts.offset) rows = rows.slice(opts.offset);
          if (opts.limit) rows = rows.slice(0, opts.limit);
          return rows.map(r => project(r, opts.select));
        } catch (e2) {
          console.warn(`[db] ${name}.find() อ่านไม่ได้เลย: ${(e2 as Error).message}`);
          return [];
        }
      }
    },

    async findOne(opts = {}) {
      const rows = await this.find({ ...opts, limit: 1 });
      return rows[0] || null;
    },

    async count(opts = {}) {
      const rows = await this.find({ ...opts, limit: undefined });
      return rows.length;
    },

    async all(limit = 1000) {
      return this.find({ limit });
    },

    async clear() {
      try {
        const snap = await getDocs(colRef());
        let n = 0;
        for (const d of snap.docs) {
          await deleteDoc(fsDoc(fs, name, d.id));
          n++;
        }
        return n;
      } catch (e) {
        console.warn(`[db] ${name}.clear() ล้มเหลว: ${(e as Error).message}`);
        return 0;
      }
    },

    async insertMany(items, opts = {}) {
      let n = 0;
      for (const it of items) {
        try {
          // ★ ถ้ามี id ในไอเทม ใช้เป็น doc id — seed ซ้ำจะทับที่เดิม
          const id = (it as any).id || (it as any).key;
          const payload = prepare(it, opts, 'create');
          if (id) {
            await setDoc(docRef(String(id)), payload, { merge: true });
          } else {
            await addDoc(colRef(), payload);
          }
          n++;
        } catch (e) {
          console.warn(`[db] insertMany ล้มเหลวที่รายการ ${n + 1}: ${(e as Error).message}`);
        }
      }
      return n;
    },
  };
}

/* ==================================================================
 * 4. ชุด repository ทั้งระบบ — ชื่อเดียวกับ COL
 * ================================================================== */

export type Repositories = {
  [K in keyof typeof COL]: Repo<any>;
};

/** ★ สร้าง repository ทั้งหมดจาก Firestore instance เดียว */
export function createRepositories(fs: any): Repositories {
  const out: Record<string, Repo<any>> = {};
  for (const [key, colName] of Object.entries(COL)) {
    out[key] = makeRepo(fs, colName as string);
  }
  // ★ เพิ่มชื่อเล่นที่อ่านง่าย (alias) ให้เรียกใช้ง่าย
  out.rounds = out.GAME20_ROUNDS;
  out.game20ConfigRepo = out.GAME20_CONFIG;
  out.history = out.GAME20_HISTORY;
  out.codes = out.GAME20_CODES;
  out.staff = out.STAFF;
  return out as Repositories;
}

/** สร้าง repo เดี่ยว (เมื่อต้องการอันเดียว) */
export function createRepo<T = any>(fs: any, collectionName: string): Repo<T> {
  return makeRepo<T>(fs, collectionName);
}

/* ==================================================================
 * 5. ★ ตัวช่วย Seed — ลงข้อมูลตั้งต้นได้ในคำสั่งเดียว
 * ================================================================== */

export interface SeedResult {
  collection: string;
  inserted: number;
  skipped: number;
  errors: string[];
}

/**
 * ★ ลงข้อมูลด้วย id ที่กำหนด + ข้ามถ้ามีอยู่แล้ว
 * @example
 *   await seedOnce(repo.game20ConfigRepo, 'main', DEFAULT_CONFIG);
 */
export async function seedOnce<T extends Record<string, unknown>>(
  repo: Repo<any>,
  id: string,
  data: T,
  opts: { overwrite?: boolean; actor?: string } = {},
): Promise<{ created: boolean; id: string }> {
  const exists = await repo.exists(id);
  if (exists && !opts.overwrite) {
    return { created: false, id };
  }
  await repo.set(id, data as any, { merge: true, actor: opts.actor ?? 'seed' });
  return { created: true, id };
}

/** ★ ลงข้อมูลชุดใหญ่ พร้อมรายงานผล */
export async function seedMany<T extends Record<string, unknown>>(
  repo: Repo<any>,
  items: Array<{ id: string; data: T }>,
  opts: { overwrite?: boolean; actor?: string } = {},
): Promise<SeedResult> {
  const result: SeedResult = { collection: repo.name, inserted: 0, skipped: 0, errors: [] };
  for (const it of items) {
    try {
      const r = await seedOnce(repo, it.id, it.data, opts);
      if (r.created) result.inserted++;
      else result.skipped++;
    } catch (e) {
      result.errors.push(`${it.id}: ${(e as Error).message}`);
    }
  }
  return result;
}

/* ==================================================================
 * 6. ★ สุขภาพฐานข้อมูล — ตรวจว่าใช้อ่าน/เขียนได้จริงไหม
 * ================================================================== */

export interface DbHealth {
  ok: boolean;
  /** เขียนทดสอบได้ไหม */
  canWrite: boolean;
  /** อ่านทดสอบได้ไหม */
  canRead: boolean;
  /** collection ทั้งหมดที่ระบบรู้จัก */
  collections: string[];
  /** จำนวนเอกสารใน collection สำคัญ */
  counts: Record<string, number>;
  /** ปัญหาที่เจอ + วิธีแก้ */
  problems: { severity: 'error' | 'warn'; message: string; fix?: string }[];
  checkedAt: string;
}

export async function checkDbHealth(fs: any): Promise<DbHealth> {
  const problems: DbHealth['problems'] = [];
  const counts: Record<string, number> = {};
  let canWrite = false;
  let canRead = false;

  if (!fs) {
    return {
      ok: false, canWrite: false, canRead: false,
      collections: Object.values(COL) as string[],
      counts: {},
      problems: [{
        severity: 'error',
        message: 'ยังไม่ได้ผูก Firestore instance',
        fix: 'ตรวจการ initialize ใน server.ts',
      }],
      checkedAt: new Date().toISOString(),
    };
  }

  const repo = createRepositories(fs);
  const probeId = `__health_${Date.now()}`;

  // ---- เขียนทดสอบ ----
  try {
    await repo.GAME20_BOTLOGS.set(probeId, {
      action: 'health_check', payload: { at: new Date().toISOString() },
    }, { timestamps: true });
    canWrite = true;
  } catch (e) {
    const msg = (e as Error).message || '';
    problems.push({
      severity: 'error',
      message: `เขียนฐานข้อมูลไม่ได้: ${msg}`,
      fix: msg.includes('permission') || msg.includes('PERMISSION')
        ? 'รัน: npx firebase deploy --only firestore:rules'
        : 'ตรวจการตั้งค่า Firestore ใน .env.local',
    });
  }

  // ---- อ่านทดสอบ ----
  try {
    const back = await repo.GAME20_BOTLOGS.get(probeId);
    canRead = !!back;
    if (!canRead && canWrite) {
      problems.push({ severity: 'error', message: 'เขียนได้แต่อ่านกลับไม่ได้', fix: 'ตรวจ Firestore Rules ให้ allow read' });
    }
  } catch (e) {
    problems.push({ severity: 'error', message: `อ่านฐานข้อมูลไม่ได้: ${(e as Error).message}` });
  }

  // ---- ลบข้อมูลทดสอบ ----
  if (canWrite) {
    try { await repo.GAME20_BOTLOGS.remove(probeId); } catch { /* ไม่เป็นไร */ }
  }

  // ---- นับเอกสาร collection สำคัญ ----
  for (const [key, colName] of Object.entries({
    game20Rounds: COL.GAME20_ROUNDS,
    game20History: COL.GAME20_HISTORY,
    game20Codes: COL.GAME20_CODES,
    game20Config: COL.GAME20_CONFIG,
    staff: COL.STAFF,
  })) {
    try {
      const r = createRepo(fs, colName as string);
      counts[key] = await r.count({ limit: undefined });
    } catch {
      counts[key] = -1;
    }
  }

  if (counts.game20Config === 0) {
    problems.push({
      severity: 'warn',
      message: 'ยังไม่มีค่าตั้งต้นของหวย 20 ช่อง',
      fix: 'รัน: npx tsx scripts/seed-game20.mjs',
    });
  }
  if (counts.staff === 0) {
    problems.push({
      severity: 'warn',
      message: 'ยังไม่มีพนักงานหลังบ้าน',
      fix: 'เพิ่มในหน้า /admin → แท็บพนักงาน หรือรัน seed',
    });
  }

  return {
    ok: canWrite && canRead,
    canWrite, canRead,
    collections: Object.values(COL) as string[],
    counts,
    problems,
    checkedAt: new Date().toISOString(),
  };
}
