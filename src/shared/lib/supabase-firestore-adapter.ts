/**
 * src/shared/lib/supabase-firestore-adapter.ts
 * ==================================================================
 * ★ Supabase-backed Firestore Compatibility Adapter ★
 * แปลงคำสั่ง Firebase Firestore ทุกคำสั่ง (getDocs, setDoc, onSnapshot ฯลฯ)
 * ให้ทำงานบน Supabase PostgreSQL อัตโนมัติ 100%
 * ==================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ค่าเริ่มต้นสำหรับโปรเจกต์ Supabase (Publishable Key ปลอดภัยสำหรับ Client/Frontend)
const DEFAULT_SUPABASE_URL = 'https://aogylynelbkjjdiclfeq.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_JPASpLsQip_mnqYWsRPCfA_hQAfSCPH';

const getEnv = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  try {
    return (import.meta as any)?.env?.[key];
  } catch {
    return undefined;
  }
};

const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL;
const supabaseKey = 
  getEnv('SUPABASE_SERVICE_ROLE_KEY') || 
  getEnv('SUPABASE_ANON_KEY') || 
  getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY') || 
  getEnv('VITE_SUPABASE_ANON_KEY') || 
  DEFAULT_SUPABASE_KEY;

export const supabaseClient: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export const db = {
  type: 'supabase-firestore-adapter',
  client: supabaseClient,
};

// ------------------------------------------------------------------
// Mapping: แปลงชื่อ Firestore Collection -> Supabase Table
// ------------------------------------------------------------------
export function mapCollectionToTable(name: string): string {
  const norm = name.trim();
  switch (norm) {
    case 'lotteryTypes':
    case 'lottery_types':
      return 'lottery_types';
    case 'users':
    case 'members':
    case 'staffUsers':
      return 'users';
    case 'lotteryRounds':
    case 'lottery_rounds':
      return 'lottery_rounds';
    case 'tickets':
      return 'tickets';
    case 'ticket_items':
      return 'ticket_items';
    case 'yeekee_rounds':
    case 'yeekeeRounds':
      return 'yeekee_rounds';
    case 'blocked_numbers':
    case 'blockedNumbers':
      return 'blocked_numbers';
    case 'risk_intake_configs':
    case 'payout_resistance':
      return 'risk_intake_configs';
    case 'transactions':
      return 'transactions';
    case 'settings':
    case 'system_settings':
    case 'lotteryResults':
    case 'adminLogs':
    case 'apiTenants':
    case 'settingsHistory':
    default:
      return 'system_settings';
  }
}

// ------------------------------------------------------------------
// Helpers: แปลง camelCase <-> snake_case สำหรับคอลัมน์มาตรฐาน
// ------------------------------------------------------------------
function toSnake(data: any, table: string): any {
  if (!data || typeof data !== 'object') return data;
  const out: Record<string, any> = {};

  if (table === 'system_settings') {
    return data;
  }

  for (const [k, v] of Object.entries(data)) {
    if (k === 'isOpen') out.is_open = v;
    else if (k === 'isHidden') out.is_hidden = v;
    else if (k === 'closeTime') out.close_time = v ? new Date(v as string).toISOString() : null;
    else if (k === 'openTime') out.open_time = v;
    else if (k === 'bgGradient') out.bg_gradient = v;
    else if (k === 'ticketId') out.ticket_id = v;
    else if (k === 'userId') out.user_id = v;
    else if (k === 'customerName') out.customer_name = v;
    else if (k === 'lotteryType') out.lottery_type = v;
    else if (k === 'roundId') out.round_id = v;
    else if (k === 'totalAmount') out.total_amount = v;
    else if (k === 'expiresAt') out.expires_at = v ? new Date(v as string).toISOString() : null;
    else if (k === 'slipUrl') out.slip_url = v;
    else if (k === 'passwordHash') out.password_hash = v;
    else if (k === 'betType') out.bet_type = v;
    else if (k === 'roundNumber') out.round_number = v;
    else if (k === 'resultTime') out.result_time = v;
    else if (k === 'createdAt') out.created_at = v ? (typeof v === 'string' ? v : new Date().toISOString()) : new Date().toISOString();
    else if (k === 'updatedAt') out.updated_at = v ? (typeof v === 'string' ? v : new Date().toISOString()) : new Date().toISOString();
    else out[k] = v;
  }

  return out;
}

function fromSnake(row: any, table: string): any {
  if (!row) return row;
  if (table === 'system_settings') {
    const val = row.value || {};
    return { id: row.id || row.key, ...val };
  }

  const out = { ...row };
  if ('is_open' in row) out.isOpen = row.is_open;
  if ('is_hidden' in row) out.isHidden = row.is_hidden;
  if ('close_time' in row) out.closeTime = row.close_time;
  if ('open_time' in row) out.openTime = row.open_time;
  if ('bg_gradient' in row) out.bgGradient = row.bg_gradient;
  if ('ticket_id' in row) out.ticketId = row.ticket_id;
  if ('user_id' in row) out.userId = row.user_id;
  if ('customer_name' in row) out.customerName = row.customer_name;
  if ('lottery_type' in row) out.lotteryType = row.lottery_type;
  if ('round_id' in row) out.roundId = row.round_id;
  if ('total_amount' in row) out.totalAmount = Number(row.total_amount);
  if ('expires_at' in row) out.expiresAt = row.expires_at;
  if ('slip_url' in row) out.slipUrl = row.slip_url;
  if ('password_hash' in row) out.passwordHash = row.password_hash;
  if ('bet_type' in row) out.betType = row.bet_type;
  if ('round_number' in row) out.roundNumber = row.round_number;
  if ('created_at' in row) out.createdAt = row.created_at;
  if ('updated_at' in row) out.updatedAt = row.updated_at;

  return out;
}

// ------------------------------------------------------------------
// Types & Classes: DocumentReference, CollectionReference, Query
// ------------------------------------------------------------------
export class DocumentReference {
  constructor(public collectionName: string, public id: string) {}
  get path() {
    return `${this.collectionName}/${this.id}`;
  }
}

export class CollectionReference {
  constructor(public name: string) {}
  get id() {
    return this.name;
  }
  get path() {
    return this.name;
  }
}

export class QueryConstraint {
  constructor(
    public type: 'where' | 'orderBy' | 'limit',
    public field?: string,
    public op?: string,
    public value?: any,
    public direction?: 'asc' | 'desc'
  ) {}
}

export class Query {
  constructor(
    public collectionRef: CollectionReference,
    public constraints: QueryConstraint[] = []
  ) {}
}

export class DocumentSnapshot {
  constructor(
    public id: string,
    private _data: any,
    private _exists: boolean = true
  ) {}

  exists(): boolean {
    return this._exists;
  }

  data(): any {
    return this._data;
  }
}

export class QuerySnapshot {
  constructor(public docs: DocumentSnapshot[]) {}

  get size(): number {
    return this.docs.length;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }

  forEach(callback: (doc: DocumentSnapshot) => void): void {
    this.docs.forEach(callback);
  }
}

// ------------------------------------------------------------------
// Core Firestore Compatibility Functions
// ------------------------------------------------------------------

export function collection(_db: any, path: string): CollectionReference {
  return new CollectionReference(path);
}

export function doc(
  _dbOrParent: any,
  collectionOrPath?: string,
  ...pathSegments: string[]
): DocumentReference {
  if (pathSegments.length > 0) {
    return new DocumentReference(collectionOrPath || '', pathSegments.join('/'));
  }
  if (!collectionOrPath) {
    return new DocumentReference('default', 'id_' + Math.random().toString(36).slice(2));
  }
  const parts = collectionOrPath.split('/');
  if (parts.length >= 2) {
    return new DocumentReference(parts[0], parts.slice(1).join('/'));
  }
  return new DocumentReference(collectionOrPath, 'id_' + Math.random().toString(36).slice(2));
}

export function query(
  colOrQuery: CollectionReference | Query,
  ...constraints: QueryConstraint[]
): Query {
  const colRef = colOrQuery instanceof Query ? colOrQuery.collectionRef : colOrQuery;
  const existing = colOrQuery instanceof Query ? colOrQuery.constraints : [];
  return new Query(colRef, [...existing, ...constraints]);
}

export function where(field: string, op: string, value: any): QueryConstraint {
  return new QueryConstraint('where', field, op, value);
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return new QueryConstraint('orderBy', field, undefined, undefined, direction);
}

export function limit(n: number): QueryConstraint {
  return new QueryConstraint('limit', undefined, undefined, n);
}

export function serverTimestamp(): string {
  return new Date().toISOString();
}

export const Timestamp = {
  now: () => ({
    toDate: () => new Date(),
    toMillis: () => Date.now(),
    toISOString: () => new Date().toISOString(),
  }),
};

// ------------------------------------------------------------------
// Data Access Operations (getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc)
// ------------------------------------------------------------------

export async function getDoc(docRef: DocumentReference): Promise<DocumentSnapshot> {
  const table = mapCollectionToTable(docRef.collectionName);

  if (table === 'system_settings') {
    const key = docRef.id;
    const { data, error } = await supabaseClient
      .from('system_settings')
      .select('*')
      .or(`key.eq.${key},id.eq.${key}`)
      .limit(1);

    if (error || !data || data.length === 0) {
      return new DocumentSnapshot(docRef.id, undefined, false);
    }
    const row = data[0];
    const val = row.value || {};
    return new DocumentSnapshot(docRef.id, { id: docRef.id, ...val }, true);
  }

  const { data, error } = await supabaseClient
    .from(table)
    .select('*')
    .eq('id', docRef.id)
    .limit(1);

  if (error || !data || data.length === 0) {
    return new DocumentSnapshot(docRef.id, undefined, false);
  }

  const row = data[0];
  const mapped = fromSnake(row, table);

  // พิเศษ: สำหรับ tickets ดึง bets จาก ticket_items เพิ่มเติม
  if (table === 'tickets') {
    const { data: items } = await supabaseClient
      .from('ticket_items')
      .select('*')
      .eq('ticket_id', row.ticket_id || row.id);

    if (items && items.length > 0) {
      mapped.bets = items.map(i => ({
        number: i.number,
        type: i.bet_type,
        amount: Number(i.amount),
        payoutRate: Number(i.payout_rate),
        winAmount: Number(i.win_amount || 0),
        status: i.status,
      }));
    }
  }

  return new DocumentSnapshot(docRef.id, mapped, true);
}

export async function getDocs(queryOrCol: CollectionReference | Query): Promise<QuerySnapshot> {
  const isQuery = queryOrCol instanceof Query;
  const colRef = isQuery ? queryOrCol.collectionRef : queryOrCol;
  const constraints = isQuery ? queryOrCol.constraints : [];
  const table = mapCollectionToTable(colRef.name);

  if (table === 'system_settings') {
    let req = supabaseClient.from('system_settings').select('*');
    for (const c of constraints) {
      if (c.type === 'limit' && c.value) req = req.limit(c.value);
    }
    const { data, error } = await req;
    if (error || !data) return new QuerySnapshot([]);
    const docs = data.map(r => new DocumentSnapshot(r.key || r.id, { id: r.key || r.id, ...(r.value || {}) }, true));
    return new QuerySnapshot(docs);
  }

  let req = supabaseClient.from(table).select('*');

  // ใส่ constraints จาก query
  for (const c of constraints) {
    if (c.type === 'where' && c.field) {
      let fieldName = c.field;
      if (fieldName === 'isOpen') fieldName = 'is_open';
      if (fieldName === 'userId') fieldName = 'user_id';
      if (fieldName === 'lotteryType' || fieldName === 'ticketType') fieldName = 'lottery_type';
      if (fieldName === 'roundId') fieldName = 'round_id';

      if (c.op === '==') req = req.eq(fieldName, c.value);
      else if (c.op === '!=') req = req.neq(fieldName, c.value);
      else if (c.op === '>') req = req.gt(fieldName, c.value);
      else if (c.op === '>=') req = req.gte(fieldName, c.value);
      else if (c.op === '<') req = req.lt(fieldName, c.value);
      else if (c.op === '<=') req = req.lte(fieldName, c.value);
      else if (c.op === 'in' && Array.isArray(c.value)) req = req.in(fieldName, c.value);
    } else if (c.type === 'orderBy' && c.field) {
      let fieldName = c.field;
      if (fieldName === 'createdAt') fieldName = 'created_at';
      req = req.order(fieldName, { ascending: c.direction === 'asc' });
    } else if (c.type === 'limit' && c.value) {
      req = req.limit(c.value);
    }
  }

  const { data, error } = await req;
  if (error || !data) return new QuerySnapshot([]);

  const docs = data.map(r => new DocumentSnapshot(r.id, fromSnake(r, table), true));
  return new QuerySnapshot(docs);
}

export async function setDoc(
  docRef: DocumentReference,
  data: any,
  options?: { merge?: boolean }
): Promise<void> {
  const table = mapCollectionToTable(docRef.collectionName);

  if (table === 'system_settings') {
    const key = docRef.id;
    let finalValue = data;
    if (options?.merge) {
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        finalValue = { ...existing.data(), ...data };
      }
    }
    await supabaseClient.from('system_settings').upsert({
      id: key,
      key: key,
      value: finalValue,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const snakeData = toSnake(data, table);
  snakeData.id = docRef.id;

  // แยก bets ออกหากเป็นตาราง tickets
  const bets = data.bets;
  delete snakeData.bets;

  await supabaseClient.from(table).upsert(snakeData);

  if (table === 'tickets' && Array.isArray(bets) && bets.length > 0) {
    const items = bets.map(b => ({
      ticket_id: docRef.id,
      number: String(b.number),
      bet_type: b.type,
      amount: Number(b.amount || 0),
      payout_rate: Number(b.payoutRate || b.rate || 0),
      win_amount: Number(b.winAmount || 0),
      status: b.status || 'pending',
    }));
    await supabaseClient.from('ticket_items').upsert(items);
  }
}

export async function updateDoc(
  docRef: DocumentReference,
  data: any
): Promise<void> {
  const table = mapCollectionToTable(docRef.collectionName);

  if (table === 'system_settings') {
    const existing = await getDoc(docRef);
    const merged = existing.exists() ? { ...existing.data(), ...data } : data;
    await supabaseClient.from('system_settings').upsert({
      id: docRef.id,
      key: docRef.id,
      value: merged,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const snakeData = toSnake(data, table);
  delete snakeData.bets;
  snakeData.updated_at = new Date().toISOString();

  await supabaseClient.from(table).update(snakeData).eq('id', docRef.id);
}

export async function addDoc(
  colRef: CollectionReference,
  data: any
): Promise<DocumentReference> {
  const table = mapCollectionToTable(colRef.name);
  const genId = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

  if (table === 'system_settings') {
    await supabaseClient.from('system_settings').insert({
      id: genId,
      key: genId,
      value: data,
      updated_at: new Date().toISOString(),
    });
    return new DocumentReference(colRef.name, genId);
  }

  const snakeData = toSnake(data, table);
  if (!snakeData.id) snakeData.id = genId;
  const bets = data.bets;
  delete snakeData.bets;

  await supabaseClient.from(table).insert(snakeData);

  if (table === 'tickets' && Array.isArray(bets) && bets.length > 0) {
    const items = bets.map(b => ({
      ticket_id: snakeData.ticket_id || snakeData.id,
      number: String(b.number),
      bet_type: b.type,
      amount: Number(b.amount || 0),
      payout_rate: Number(b.payoutRate || b.rate || 0),
      win_amount: Number(b.winAmount || 0),
      status: b.status || 'pending',
    }));
    await supabaseClient.from('ticket_items').insert(items);
  }

  return new DocumentReference(colRef.name, snakeData.id);
}

export async function deleteDoc(docRef: DocumentReference): Promise<void> {
  const table = mapCollectionToTable(docRef.collectionName);
  if (table === 'system_settings') {
    await supabaseClient.from('system_settings').delete().or(`id.eq.${docRef.id},key.eq.${docRef.id}`);
    return;
  }
  await supabaseClient.from(table).delete().eq('id', docRef.id);
}

// ------------------------------------------------------------------
// Realtime Listener: onSnapshot
// ------------------------------------------------------------------
export function onSnapshot(
  target: DocumentReference | CollectionReference | Query,
  onNext: (snap: any) => void,
  _onError?: (err: any) => void
): () => void {
  let isSubscribed = true;

  const fetchAndTrigger = async () => {
    if (!isSubscribed) return;
    try {
      if (target instanceof DocumentReference) {
        const snap = await getDoc(target);
        if (isSubscribed) onNext(snap);
      } else {
        const snap = await getDocs(target);
        if (isSubscribed) onNext(snap);
      }
    } catch (e) {
      if (_onError) _onError(e);
    }
  };

  // เรียกครั้งแรกทันที
  fetchAndTrigger();

  // ตั้ง Supabase Realtime Channel
  const table = target instanceof DocumentReference 
    ? mapCollectionToTable(target.collectionName) 
    : mapCollectionToTable(target instanceof Query ? target.collectionRef.name : target.name);

  const channelName = `realtime-${table}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabaseClient
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      fetchAndTrigger();
    })
    .subscribe();

  // สำรอง: ตรวจสอบเป็นระยะทุก 8 วินาที
  const interval = setInterval(fetchAndTrigger, 8000);

  return () => {
    isSubscribed = false;
    clearInterval(interval);
    supabaseClient.removeChannel(channel);
  };
}

// Dummy initializeApp & getFirestore สำหรับความเข้ากันได้
export function initializeApp(_config: any) {
  return { name: '[DEFAULT]' };
}

export function getFirestore(_app?: any, _databaseId?: string) {
  return db;
}

export function connectFirestoreEmulator(_db?: any, _host?: string, _port?: number) {
  // no-op for emulator compatibility
}

export async function runTransaction(
  _db: any,
  updateFunction: (transaction: any) => Promise<any>
): Promise<any> {
  const transaction = {
    get: async (docRef: DocumentReference) => getDoc(docRef),
    set: (docRef: DocumentReference, data: any) => setDoc(docRef, data),
    update: (docRef: DocumentReference, data: any) => updateDoc(docRef, data),
    delete: (docRef: DocumentReference) => deleteDoc(docRef),
  };
  return await updateFunction(transaction);
}

export function writeBatch(_db?: any) {
  const operations: Array<() => Promise<any>> = [];
  return {
    set: (docRef: DocumentReference, data: any) => {
      operations.push(() => setDoc(docRef, data));
    },
    update: (docRef: DocumentReference, data: any) => {
      operations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: DocumentReference) => {
      operations.push(() => deleteDoc(docRef));
    },
    commit: async () => {
      for (const op of operations) {
        await op();
      }
    },
  };
}

