/**
 * src/shared/lib/yeekeeEngine.ts
 * ==================================================================
 * เอนจินหวยยี่กี 88 รอบ — ทำงานบน Vercel (static) + Supabase ได้เลย
 * ไม่ต้องมีเซิร์ฟเวอร์ และไม่ต้องสร้างตารางใหม่ (เก็บใน system_settings)
 *
 *  รอบ  : 88 รอบ/วัน รอบละ 15 นาที เปิดรอบแรก 06:00 น. (เวลาไทย)
 *  ผล   : ปิดรับแล้ว "รอผล" 60-120 วินาที (คงที่ต่อรอบ) แล้วออกผลอัตโนมัติ
 *  บอท 1: บอทวางเลข (ยิงเลขเข้ารอบ ให้ครบ ≥16 ลำดับ ไม่ว่ารอบจะเงียบแค่ไหน)
 *  บอท 2: บอทออกผล (fair / profit / avoid / balance)
 *  มือ  : กำหนดเลขออกล่วงหน้า (target) | ยกเลิกออโต้แล้วกรอกเอง (manual)
 *         | ยกเลิกรอบ (คืนเงินทุกโพย)
 *  ไม่ตั้งอะไรเลย → ออโต้เสมอ (รอบถัดไปไม่กระทบ)
 * ==================================================================
 */
import { supabaseClient } from './supabase-firestore-adapter';
import { computeYeekeeResult } from './yeekee';

/* ------------------------------------------------------------------ */
/* ค่าคงที่ & ประเภทการแทง 12 แบบ                                      */
/* ------------------------------------------------------------------ */

export const ROUNDS_PER_DAY = 88;
export const ROUND_MS = 15 * 60 * 1000;
const BKK_MS = 7 * 3600 * 1000;

export interface YkBetType { key: string; digits: number; hint: string; rate: number }

/** เลขผล 5 หลัก N = d1d2d3d4d5 */
export const BET_TYPES: YkBetType[] = [
  { key: '2 ตัวบน',     digits: 2, hint: '2 ตัวท้าย',                 rate: 90.00 },
  { key: '3 ตัวบน',     digits: 3, hint: '3 ตัวท้าย',                 rate: 900.00 },
  { key: '3 ตัวโต๊ด',    digits: 3, hint: 'สลับ 3 ตัวท้าย',            rate: 150.00 },
  { key: '2 ตัวโต๊ด',    digits: 2, hint: 'สลับ 2 ตัว',                rate: 13.00 },
  { key: 'วิ่งบน',       digits: 1, hint: 'มีเลขนี้ใน 3 ตัวบน',        rate: 3.20 },
  { key: 'วิ่งล่าง',      digits: 1, hint: 'มีเลขนี้ใน 2 ตัวล่าง',       rate: 4.20 },
  { key: '2 ตัวล่าง',    digits: 2, hint: '2 ตัวหน้า',                 rate: 90.00 },
  { key: '3 ตัวล่าง',    digits: 3, hint: '3 ตัวหน้า',                 rate: 450.00 },
  { key: '4 ตัวบน',     digits: 4, hint: '4 ตัวท้าย',                 rate: 4000.00 },
  { key: '4 ตัวโต๊ด',    digits: 4, hint: 'สลับ 4 ตัวท้าย',            rate: 25.00 },
  { key: '5 ตัวโต๊ด',    digits: 5, hint: 'สลับ 5 ตัว',                rate: 15.00 },
  { key: 'ปักหลักหน่วย',  digits: 1, hint: 'ตรงหลักหน่วย 3 ตัวบน',      rate: 8.00 },
  { key: 'ปักหลักสิบ',   digits: 1, hint: 'ตรงหลักสิบ 3 ตัวบน',       rate: 8.00 },
  { key: 'ปักหลักร้อย',   digits: 1, hint: 'ตรงหลักร้อย 3 ตัวบน',       rate: 8.00 },
];

export const DEFAULT_RATES: Record<string, number> =
  Object.fromEntries(BET_TYPES.map(t => [t.key, t.rate]));

export interface YkConfig {
  enabled: boolean;
  numberBot: { enabled: boolean; minShoots: number; maxShoots: number };
  resultBot: { mode: 'fair' | 'profit' | 'avoid' | 'balance'; balancePct: number };
  rates: Record<string, number>;
  rewardShooter1: number;
  rewardShooter16: number;
  rewardShooter18: number;
  rewardMinBet: number;
  processMinSec: number;
  processMaxSec: number;
  manualGraceSec: number;
  minBet: number;
  maxBet: number;
}

export const DEFAULT_CONFIG: YkConfig = {
  enabled: true,
  numberBot: { enabled: true, minShoots: 20, maxShoots: 36 },
  resultBot: { mode: 'fair', balancePct: 70 },
  rates: { ...DEFAULT_RATES },
  rewardShooter1: 200,
  rewardShooter16: 400,
  rewardShooter18: 400,
  rewardMinBet: 100,
  processMinSec: 60,
  processMaxSec: 120,
  manualGraceSec: 300,
  minBet: 1,
  maxBet: 50000,
};

export type RoundControl = {
  mode: 'auto' | 'target' | 'manual';
  /** เลขผล 5 หลัก (target/manual) */
  number?: string;
  by?: string;
  at?: number;
};

export interface RoundRow {
  key: string; day: string; n: number;
  status: 'pending' | 'settling' | 'settled' | 'cancelled' | 'void';
  control?: RoundControl;
  claimedAt?: number;
  result?: {
    number: string; top3: string; top2: string; bottom2: string; bottom3: string;
    top4: string; sum: number; sub: string; source: string;
  };
  stats?: { bets: number; payout: number; profit: number; shoots: number; tickets: number };
  settledAt?: number;
  reason?: string;
}

export interface Shoot {
  id: string; number: string; userId: string; username: string; ts: number; isBot: boolean;
}

export type Phase = 'waiting' | 'open' | 'processing' | 'settled' | 'cancelled';

/* ------------------------------------------------------------------ */
/* เวลา (Asia/Bangkok) & รอบ                                           */
/* ------------------------------------------------------------------ */

/** "วันของเกม" เริ่ม 06:00 น. เช่น 03:00 ของวันที่ 5 ยังนับเป็นวันที่ 4 */
export function gameDayOf(ms: number): string {
  const d = new Date(ms + BKK_MS - 6 * 3600 * 1000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function dayStartMs(day: string): number {
  const y = +day.slice(0, 4), m = +day.slice(4, 6), d = +day.slice(6, 8);
  return Date.UTC(y, m - 1, d, 6 - 7, 0, 0);
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const roundKey = (day: string, n: number) => `${day}-${pad2(n)}`;
export const openMsOf = (day: string, n: number) => dayStartMs(day) + (n - 1) * ROUND_MS;
export const closeMsOf = (day: string, n: number) => openMsOf(day, n) + ROUND_MS;

export function hhmm(ms: number): string {
  const d = new Date(ms + BKK_MS);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
export function hhmmss(ms: number): string {
  const d = new Date(ms + BKK_MS);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}
export function dayLabel(day: string): string {
  return `${day.slice(6, 8)}/${day.slice(4, 6)}/${day.slice(0, 4)}`;
}

/** รอบที่กำลังเปิดตอนนี้ (null = ช่วงพัก 04:00-06:00) */
export function currentRound(now: number): { day: string; n: number } | null {
  const day = gameDayOf(now);
  const idx = Math.floor((now - dayStartMs(day)) / ROUND_MS) + 1;
  if (idx < 1 || idx > ROUNDS_PER_DAY) return null;
  return { day, n: idx };
}

/** วินาทีที่ต้อง "รอผล" หลังปิดรับ (60-120 คงที่ต่อรอบ ทุกเครื่องเห็นตรงกัน) */
export function processDelaySec(key: string, cfg: YkConfig = DEFAULT_CONFIG): number {
  const span = Math.max(0, cfg.processMaxSec - cfg.processMinSec);
  return cfg.processMinSec + (hash(key) % (span + 1));
}
export const resultAtMs = (day: string, n: number, cfg: YkConfig = DEFAULT_CONFIG) =>
  closeMsOf(day, n) + processDelaySec(roundKey(day, n), cfg) * 1000;

export function phaseOf(day: string, n: number, now: number, row?: RoundRow | null): Phase {
  if (row?.status === 'settled') return 'settled';
  if (row?.status === 'cancelled' || row?.status === 'void') return 'cancelled';
  if (now < openMsOf(day, n)) return 'waiting';
  if (now < closeMsOf(day, n)) return 'open';
  if (now < closeMsOf(day, n) + 60_000) return 'processing';
  return 'settled';
}

export function deterministicResult(day: string, n: number) {
  const key = roundKey(day, n);
  const h = hash('det_res_' + key);
  const s = String(h % 1000000).padStart(6, '0');
  return splitResult(s);
}


/* ------------------------------------------------------------------ */
/* ยูทิลิตี้: hash / สุ่มแบบกำหนดผลได้ (ทุกเครื่องได้ค่าเดียวกัน)        */
/* ------------------------------------------------------------------ */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pad5 = (n: number) => String(Math.abs(Math.floor(n)) % 100000).padStart(5, '0');
const sortDigits = (s: string) => s.split('').sort().join('');
const reverse = (s: string) => s.split('').reverse().join('');

/* ------------------------------------------------------------------ */
/* ตรวจโพย                                                              */
/* ------------------------------------------------------------------ */

export function splitResult(N: string) {
  const s = String(N).padStart(6, '0');
  return {
    number: s,
    top3: s.slice(-3),
    top2: s.slice(-2),
    bottom2: s.length >= 6 ? s.slice(-5, -3) : s.slice(0, 2),
    bottom3: s.slice(0, 3),
    top4: s.slice(-4),
    top5: s.slice(-5),
    top6: s,
  };
}

export function isWinningBet(type: string, num: string, N: string): boolean {
  const r = splitResult(N);
  switch (type) {
    case '3 ตัวบน': return num === r.top3;
    case '3 ตัวโต๊ด': return sortDigits(num) === sortDigits(r.top3);
    case '3 ตัวล่าง': return num === r.bottom3;
    case '2 ตัวบน': return num === r.top2;
    case '2 ตัวล่าง': return num === r.bottom2;
    case '2 ตัวบนกลับ': return num === reverse(r.top2);
    case '2 ตัวล่างกลับ': return num === reverse(r.bottom2);
    case 'วิ่งบน': return r.top3.includes(num);
    case 'วิ่งล่าง': return r.bottom2.includes(num);
    case '4 ตัวบน': return num === r.top4;
    case '4 ตัวโต๊ด': return sortDigits(num) === sortDigits(r.top4);
    case '5 ตัวตรง': return num === r.top5;
    case '6 ตัวตรง': return num === r.top6;
    default: return false;
  }
}

interface Bet { ticketId: string; userId: string; number: string; type: string; amount: number; rate: number }

function payoutFor(bets: Bet[], N: string): number {
  let t = 0;
  for (const b of bets) if (isWinningBet(b.type, b.number, N)) t += b.amount * b.rate;
  return t;
}

/* ------------------------------------------------------------------ */
/* Supabase: system_settings เป็นที่เก็บ (ไม่ต้องสร้างตารางใหม่)         */
/* ------------------------------------------------------------------ */

const ST = () => supabaseClient.from('system_settings');
const CONFIG_ID = 'yeekee_config_v2';
const roundId = (key: string) => `yk_round_${key}`;
const shootPrefix = (key: string) => `yk_shoot_${key}_`;
export const ticketRoundId = (key: string) => `yk-${key}`;

export async function loadConfig(): Promise<YkConfig> {
  const { data } = await ST().select('value').eq('id', CONFIG_ID).maybeSingle();
  const v: any = data?.value || {};
  return {
    ...DEFAULT_CONFIG, ...v,
    numberBot: { ...DEFAULT_CONFIG.numberBot, ...(v.numberBot || {}) },
    resultBot: { ...DEFAULT_CONFIG.resultBot, ...(v.resultBot || {}) },
    rates: { ...DEFAULT_RATES, ...(v.rates || {}) },
  };
}

export async function saveConfig(cfg: YkConfig): Promise<void> {
  const { error } = await ST().upsert({ id: CONFIG_ID, key: CONFIG_ID, value: cfg, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function loadRoundRows(day: string): Promise<Record<number, RoundRow>> {
  const { data } = await ST().select('value').like('id', `yk_round_${day}-%`);
  const out: Record<number, RoundRow> = {};
  (data || []).forEach((r: any) => { if (r.value?.n) out[r.value.n] = r.value; });
  return out;
}

export async function getRoundRow(day: string, n: number): Promise<RoundRow | null> {
  const { data } = await ST().select('value').eq('id', roundId(roundKey(day, n))).maybeSingle();
  return (data?.value as RoundRow) || null;
}

async function writeRow(row: RoundRow) {
  const id = roundId(row.key);
  const { error } = await ST().upsert({ id, key: id, value: row, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function patchRow(day: string, n: number, patch: Partial<RoundRow>): Promise<RoundRow> {
  const key = roundKey(day, n);
  const cur = (await getRoundRow(day, n)) || { key, day, n, status: 'pending' as const };
  const next = { ...cur, ...patch } as RoundRow;
  await writeRow(next);
  return next;
}

/* ------------------------------------------------------------------ */
/* ยิงเลข & บอทวางเลข                                                   */
/* ------------------------------------------------------------------ */

export async function loadShoots(day: string, n: number): Promise<Shoot[]> {
  const { data } = await ST().select('id,value').like('id', `${shootPrefix(roundKey(day, n))}%`);
  const list: Shoot[] = (data || []).map((r: any) => ({ id: r.id, ...r.value }));
  return list.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
}

export function botPlan(day: string, n: number, cfg: YkConfig) {
  const key = roundKey(day, n);
  const r = rng(hash('plan' + key));
  const lo = Math.max(16, cfg.numberBot.minShoots);
  const hi = Math.max(lo, cfg.numberBot.maxShoots);
  const count = lo + Math.floor(r() * (hi - lo + 1));
  const open = openMsOf(day, n);
  const list = [];
  for (let k = 0; k < count; k++) {
    const rr = rng(hash(`${key}#${k}`));
    list.push({
      idx: k,
      ts: open + Math.floor(((k + 1) / (count + 1)) * (ROUND_MS - 20000)),
      number: pad5(rr() * 100000),
    });
  }
  return list;
}

const botCache: Record<string, number> = {};

/** บอท 1: ยิงเลขตามตารางเวลา (idempotent — id คงที่ ยิงซ้ำไม่เบิ้ล) */
export async function runNumberBot(day: string, n: number, now: number, cfg: YkConfig, force = false) {
  if (!cfg.enabled || !cfg.numberBot.enabled) return;
  const key = roundKey(day, n);
  const closeAt = closeMsOf(day, n);
  const due = botPlan(day, n, cfg).filter(p => p.ts <= Math.min(now, closeAt));
  if (!due.length) return;
  if (!force && botCache[key] === due.length) return;
  const rows = due.map(p => {
    const id = `${shootPrefix(key)}b${String(p.idx).padStart(3, '0')}`;
    return {
      id, key: id,
      value: { number: p.number, userId: 'bot', username: `บอท${String(p.idx + 1).padStart(2, '0')}`, ts: p.ts, isBot: true },
    };
  });
  const { error } = await ST().upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (!error) botCache[key] = due.length;
}

export function getSession() {
  const userId = localStorage.getItem('userId') || '';
  const username = localStorage.getItem('username') || localStorage.getItem('userName') || userId;
  return { userId, username, loggedIn: localStorage.getItem('isLoggedIn') === 'true' && !!userId };
}

export async function submitShoot(day: string, n: number, number: string, now: number) {
  const s = getSession();
  if (!s.loggedIn) throw new Error('กรุณาเข้าสู่ระบบก่อนยิงเลข');
  if (!/^\d{5}$/.test(number)) throw new Error('กรุณากรอกเลข 5 หลัก');
  if (now < openMsOf(day, n) || now >= closeMsOf(day, n)) throw new Error('รอบนี้ไม่ได้เปิดรับยิงเลข');

  // ตรวจสอบคูลดาวน์ 3 นาที (180 วินาที) ของผู้ใช้ในรอบนี้
  const existingShoots = await loadShoots(day, n);
  const userShoots = existingShoots.filter(sh => sh.userId === s.userId);
  if (userShoots.length > 0) {
    const lastShoot = userShoots[userShoots.length - 1];
    const cooldownMs = 3 * 60 * 1000;
    const elapsed = now - (lastShoot.ts || 0);
    if (elapsed < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - elapsed) / 1000);
      const min = Math.floor(waitSec / 60);
      const sec = waitSec % 60;
      throw new Error(`คุณเพิ่งยิงเลขไป กรุณารออีก ${min} นาที ${sec} วินาที ถึงจะยิงเลขในรอบนี้ได้อีกครั้ง (คูลดาวน์ 3 นาที)`);
    }
  }

  const key = roundKey(day, n);
  const id = `${shootPrefix(key)}u${now}${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await ST().insert({ id, key: id, value: { number, userId: s.userId, username: s.username, ts: now, isBot: false } });
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/* แทงหวย                                                               */
/* ------------------------------------------------------------------ */

export interface BetInput { number: string; type: string; amount: number }

export async function placeBet(day: string, n: number, bets: BetInput[], cfg: YkConfig, now: number) {
  const s = getSession();
  if (!s.loggedIn) throw new Error('กรุณาเข้าสู่ระบบก่อนส่งโพย');
  if (now < openMsOf(day, n) || now >= closeMsOf(day, n)) throw new Error('รอบนี้ปิดรับแทงแล้ว');
  if (!bets.length) throw new Error('ยังไม่มีรายการแทง');

  const total = bets.reduce((a, b) => a + b.amount, 0);
  const { data: u, error: ue } = await supabaseClient.from('users').select('id,balance,username,status').eq('id', s.userId).maybeSingle();
  if (ue || !u) throw new Error('ไม่พบบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
  if (u.status && u.status !== 'active') throw new Error('บัญชีถูกระงับ');
  const balance = Number(u.balance) || 0;
  if (balance < total) throw new Error(`เครดิตไม่พอ (มี ฿${balance.toLocaleString()} ต้องใช้ ฿${total.toLocaleString()})`);

  const { error: be } = await supabaseClient.from('users').update({ balance: balance - total }).eq('id', s.userId).eq('balance', u.balance);
  if (be) throw new Error('หักเครดิตไม่สำเร็จ ลองใหม่อีกครั้ง');

  const key = roundKey(day, n);
  const ticketId = `YK${key.replace('-', '')}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const created = new Date(now).toISOString();

  const rollback = async () => { await supabaseClient.from('users').update({ balance }).eq('id', s.userId); };

  const { error: te } = await supabaseClient.from('tickets').insert({
    id: ticketId, ticket_id: ticketId, user_id: s.userId, customer_name: u.username || s.username,
    lottery_type: 'ยี่กี 4D', lottery_slug: 'yeekee', round_id: ticketRoundId(key),
    total_amount: total, status: 'pending', created_at: created,
  });
  if (te) { await rollback(); throw new Error('บันทึกโพยไม่สำเร็จ: ' + te.message); }

  await supabaseClient.from('ticket_items').insert(bets.map(b => ({
    ticket_id: ticketId, number: b.number, bet_type: b.type, amount: b.amount,
    payout_rate: cfg.rates[b.type] ?? DEFAULT_RATES[b.type] ?? 0, status: 'pending',
  })));

  await supabaseClient.from('transactions').insert({
    user_id: s.userId, username: u.username, type: 'bet', amount: total, status: 'completed',
    description: `แทงยี่กี รอบที่ ${n} (${dayLabel(day)})`, created_at: created,
  });

  return { ticketId, total, balance: balance - total };
}

/* ------------------------------------------------------------------ */
/* ดึงโพยของรอบ                                                         */
/* ------------------------------------------------------------------ */

async function loadRoundTickets(key: string) {
  const { data: tickets } = await supabaseClient.from('tickets').select('*').eq('round_id', ticketRoundId(key));
  const list: any[] = tickets || [];
  const ids = list.map(t => t.ticket_id);
  let items: any[] = [];
  if (ids.length) {
    const { data } = await supabaseClient.from('ticket_items').select('*').in('ticket_id', ids);
    items = data || [];
  }
  const bets: Bet[] = items.map(i => ({
    ticketId: i.ticket_id,
    userId: list.find(t => t.ticket_id === i.ticket_id)?.user_id || '',
    number: String(i.number), type: String(i.bet_type),
    amount: Number(i.amount) || 0, rate: Number(i.payout_rate) || 0,
  }));
  return { tickets: list, items, bets };
}

export async function roundBetSummary(day: string, n: number) {
  const { tickets, bets } = await loadRoundTickets(roundKey(day, n));
  const byType: Record<string, number> = {};
  const byNumber: Record<string, number> = {};
  bets.forEach(b => {
    byType[b.type] = (byType[b.type] || 0) + b.amount;
    const k = `${b.type}|${b.number}`;
    byNumber[k] = (byNumber[k] || 0) + b.amount;
  });
  return {
    tickets: tickets.length,
    total: bets.reduce((a, b) => a + b.amount, 0),
    byType,
    top: Object.entries(byNumber).sort((a, b) => b[1] - a[1]).slice(0, 20)
      .map(([k, v]) => ({ type: k.split('|')[0], number: k.split('|')[1], amount: v })),
  };
}

async function credit(userId: string, delta: number) {
  const { data: u } = await supabaseClient.from('users').select('balance,username').eq('id', userId).maybeSingle();
  if (!u) return null;
  await supabaseClient.from('users').update({ balance: (Number(u.balance) || 0) + delta }).eq('id', userId);
  return u.username as string;
}

/* ------------------------------------------------------------------ */
/* ยกเลิกรอบ / คืนเงิน                                                   */
/* ------------------------------------------------------------------ */

export async function cancelRound(day: string, n: number, reason: string, status: 'cancelled' | 'void' = 'cancelled') {
  const key = roundKey(day, n);
  const cur = await getRoundRow(day, n);
  if (cur && (cur.status === 'settled' || cur.status === 'cancelled' || cur.status === 'void')) return cur;
  const { tickets } = await loadRoundTickets(key);
  let refunded = 0;
  for (const t of tickets) {
    if (t.status === 'cancelled' || t.status === 'won' || t.status === 'lost') continue;
    const amt = Number(t.total_amount) || 0;
    const uname = await credit(t.user_id, amt);
    await supabaseClient.from('tickets').update({ status: 'cancelled', settled_at: new Date().toISOString() }).eq('ticket_id', t.ticket_id);
    await supabaseClient.from('ticket_items').update({ status: 'cancelled' }).eq('ticket_id', t.ticket_id);
    await supabaseClient.from('transactions').insert({
      user_id: t.user_id, username: uname, type: 'refund', amount: amt, status: 'completed',
      description: `คืนเงินยี่กี รอบที่ ${n} (${reason})`, created_at: new Date().toISOString(),
    });
    refunded += amt;
  }
  return patchRow(day, n, {
    status, reason, settledAt: Date.now(),
    stats: { bets: refunded, payout: 0, profit: 0, shoots: 0, tickets: tickets.length },
  });
}

/* ------------------------------------------------------------------ */
/* ตัดผล                                                                 */
/* ------------------------------------------------------------------ */

async function claim(day: string, n: number, now: number): Promise<RoundRow | null> {
  const key = roundKey(day, n);
  const id = roundId(key);
  await ST().upsert({ id, key: id, value: { key, day, n, status: 'pending' } }, { onConflict: 'id', ignoreDuplicates: true });
  const row = (await getRoundRow(day, n)) as RoundRow;
  if (!row || ['settled', 'cancelled', 'void'].includes(row.status)) return null;
  if (row.status === 'settling' && now - (row.claimedAt || 0) < 120000) return null;
  const next: RoundRow = { ...row, status: 'settling', claimedAt: now };
  let q = ST().update({ value: next, updated_at: new Date().toISOString() }).eq('id', id).eq('value->>status', row.status);
  if (row.status === 'settling') q = q.eq('value->>claimedAt', String(row.claimedAt));
  const { data } = await q.select();
  return data && data.length ? next : null;
}

function chooseResult(cfg: YkConfig, bets: Bet[], rnd: () => number): { N: string; source: string } {
  const mode = cfg.resultBot.mode;
  const total = bets.reduce((a, b) => a + b.amount, 0);
  if (mode === 'fair' || !bets.length) return { N: '', source: 'fair' };
  const cands: { N: string; pay: number }[] = [];
  for (let i = 0; i < 600; i++) { const N = pad5(rnd() * 100000); cands.push({ N, pay: payoutFor(bets, N) }); }
  if (mode === 'profit') {
    const min = Math.min(...cands.map(c => c.pay));
    const pool = cands.filter(c => c.pay === min);
    return { N: pool[Math.floor(rnd() * pool.length)].N, source: 'profit' };
  }
  if (mode === 'avoid') {
    const zero = cands.filter(c => c.pay === 0);
    const pool = zero.length ? zero : cands.filter(c => c.pay === Math.min(...cands.map(x => x.pay)));
    return { N: pool[Math.floor(rnd() * pool.length)].N, source: 'avoid' };
  }
  const target = total * (cfg.resultBot.balancePct / 100);
  cands.sort((a, b) => Math.abs(a.pay - target) - Math.abs(b.pay - target));
  return { N: cands[0].N, source: 'balance' };
}

/** สร้างลูกยิงสุดท้ายของบอท ให้ผลรวม−ลำดับที่18 ลงเลขเป้าหมายพอดี */
function craftFinalShoot(nums: string[], target: string): string {
  const list = nums.slice();
  const idx = list.length + 1 >= 18 ? 17 : -1;
  const sum = list.reduce((a, s) => a + (parseInt(s, 10) || 0), 0);
  const s18 = idx >= 0 ? (parseInt(list[idx] || '0', 10) || 0) : 0;
  const targetVal = parseInt(target, 10) || 0;
  const x = (((targetVal - (sum - s18)) % 100000) + 100000) % 100000;
  return String(x).padStart(5, '0');
}

export type SettleOutcome = 'settled' | 'skipped' | 'waiting_manual' | 'void' | 'busy';

export async function settleRound(day: string, n: number, opts: { force?: boolean; now?: number } = {}): Promise<SettleOutcome> {
  const now = opts.now ?? Date.now();
  const cfg = await loadConfig();
  const key = roundKey(day, n);
  if (!opts.force && now < resultAtMs(day, n, cfg)) return 'skipped';

  const pre = await getRoundRow(day, n);
  if (pre && ['settled', 'cancelled', 'void'].includes(pre.status)) return 'skipped';

  const ctl = pre?.control;
  if (ctl?.mode === 'manual' && !ctl.number) {
    if (!opts.force && now > resultAtMs(day, n, cfg) + cfg.manualGraceSec * 1000) {
      await cancelRound(day, n, 'ไม่ได้กรอกผลภายในเวลา — ยกเลิกรอบอัตโนมัติ', 'void');
      return 'void';
    }
    return 'waiting_manual';
  }

  const mine = await claim(day, n, now);
  if (!mine) return 'busy';

  try {
    if (cfg.numberBot.enabled) {
      await runNumberBot(day, n, closeMsOf(day, n), cfg, true);
    }
    let shoots = await loadShoots(day, n);

    // หากเปิดบอทวางเลข ให้เติมให้ครบตามตั้งค่า
    if (cfg.numberBot.enabled) {
      const fr = rng(hash('fill' + key));
      let fill = 0;
      while (shoots.length + fill < Math.max(18, cfg.numberBot.minShoots)) {
        const id = `${shootPrefix(key)}f${String(fill).padStart(2, '0')}`;
        await ST().upsert({ id, key: id, value: { number: pad5(fr() * 100000), userId: 'bot', username: 'บอทสำรอง', ts: closeMsOf(day, n) - 5000 + fill, isBot: true } }, { onConflict: 'id', ignoreDuplicates: true });
        fill++;
      }
      if (fill) shoots = await loadShoots(day, n);
    }

    const { tickets, items, bets } = await loadRoundTickets(key);
    const closeAt = closeMsOf(day, n);

    // เลือกเลขผล (รองรับทั้ง 6 หลัก และ 5 หลัก)
    let N = '';
    let source = 'auto';
    if (ctl?.number && /^\d{5,6}$/.test(ctl.number)) { N = ctl.number; source = ctl.mode === 'manual' ? 'manual' : 'target'; }
    else {
      const pick = chooseResult(cfg, bets, rng(hash('res' + key + now)));
      if (pick.N) { N = pick.N; source = pick.source; }
    }

    let finalShoots = shoots;
    if (N) {
      const base = shoots.filter(s => !s.id.endsWith('z999'));
      const x = craftFinalShoot(base.map(s => s.number), N);
      const id = `${shootPrefix(key)}z999`;
      await ST().upsert({ id, key: id, value: { number: x, userId: 'bot', username: 'บอทออกผล', ts: closeAt + 1000, isBot: true } }, { onConflict: 'id', ignoreDuplicates: false });
      finalShoots = await loadShoots(day, n);
    }

    const calc = computeYeekeeResult(finalShoots.map(s => s.number));
    const Nfinal = String(calc.rawResult % 1000000).padStart(6, '0');
    const sp = splitResult(Nfinal);
    const sub = finalShoots.length >= 18 ? finalShoots[17] : undefined;

    // ตรวจโพย (โพยที่ส่งหลังปิดรับ คืนเงิน)
    let totalBets = 0, totalPayout = 0;
    const wonByUser: Record<string, number> = {};
    for (const t of tickets) {
      if (['won', 'lost', 'cancelled'].includes(t.status)) continue;
      const late = new Date(t.created_at).getTime() > closeAt + 15000;
      if (late) {
        const amt = Number(t.total_amount) || 0;
        const un = await credit(t.user_id, amt);
        await supabaseClient.from('tickets').update({ status: 'cancelled', settled_at: new Date().toISOString() }).eq('ticket_id', t.ticket_id);
        await supabaseClient.from('transactions').insert({ user_id: t.user_id, username: un, type: 'refund', amount: amt, status: 'completed', description: `คืนเงินยี่กี รอบที่ ${n} (ส่งโพยหลังปิดรับ)`, created_at: new Date().toISOString() });
        continue;
      }
      const mineItems = items.filter(i => i.ticket_id === t.ticket_id);
      let win = 0;
      for (const i of mineItems) {
        const ok = isWinningBet(String(i.bet_type), String(i.number), Nfinal);
        const w = ok ? Math.round((Number(i.amount) || 0) * (Number(i.payout_rate) || 0) * 100) / 100 : 0;
        win += w;
        await supabaseClient.from('ticket_items').update({ win_amount: w, status: ok ? 'won' : 'lost' }).eq('id', i.id);
      }
      totalBets += Number(t.total_amount) || 0;
      totalPayout += win;
      await supabaseClient.from('tickets').update({
        status: win > 0 ? 'won' : 'lost', win_amount: win, gross_win_amount: win,
        settled_at: new Date().toISOString(),
      }).eq('ticket_id', t.ticket_id);
      if (win > 0) wonByUser[t.user_id] = (wonByUser[t.user_id] || 0) + win;
    }

    // จ่ายผู้ถูกรางวัล
    for (const [uid, amt] of Object.entries(wonByUser)) {
      const un = await credit(uid, amt);
      await supabaseClient.from('transactions').insert({ user_id: uid, username: un, type: 'win', amount: amt, status: 'completed', description: `ถูกรางวัลยี่กี รอบที่ ${n} (${dayLabel(day)}) ผล ${Nfinal}`, created_at: new Date().toISOString() });
    }

    // รางวัลคนยิงลำดับที่ 1 และ 18 (เฉพาะสมาชิกจริงที่แทงขั้นต่ำ)
    const rewards: [Shoot | undefined, number, string][] = [
      [finalShoots[0], cfg.rewardShooter1, 'ที่ 1'],
      [sub, cfg.rewardShooter18 ?? cfg.rewardShooter16 ?? 400, 'ที่ 18'],
    ];
    for (const [sh, amt, label] of rewards) {
      if (!sh || sh.isBot || !amt) continue;
      const spent = bets.filter(b => b.userId === sh.userId).reduce((a, b) => a + b.amount, 0);
      if (spent < cfg.rewardMinBet) continue;
      const un = await credit(sh.userId, amt);
      await supabaseClient.from('transactions').insert({ user_id: sh.userId, username: un, type: 'bonus', amount: amt, status: 'completed', description: `รางวัลคนยิงเลขลำดับ${label} ยี่กี รอบที่ ${n}`, created_at: new Date().toISOString() });
    }

    await writeRow({
      ...mine, status: 'settled', settledAt: Date.now(), claimedAt: undefined,
      result: { ...sp, sum: calc.sum, sub: sub?.number || '00000', source },
      stats: { bets: totalBets, payout: totalPayout, profit: totalBets - totalPayout, shoots: finalShoots.length, tickets: tickets.length },
    });
    return 'settled';
  } catch (e) {
    console.error('[yeekee] settle error', e);
    // ปล่อย claim คืนเพื่อให้เครื่องอื่นลองใหม่
    await writeRow({ ...mine, status: 'pending', claimedAt: undefined });
    return 'busy';
  }
}

/* ------------------------------------------------------------------ */
/* ควบคุมโดยแอดมิน                                                       */
/* ------------------------------------------------------------------ */

export async function setControl(day: string, n: number, control: RoundControl) {
  const cur = await getRoundRow(day, n);
  if (cur && ['settled', 'cancelled', 'void'].includes(cur.status)) throw new Error('รอบนี้จบแล้ว แก้ไขไม่ได้');
  return patchRow(day, n, { control: { ...control, at: Date.now() } });
}

/** แอดมินกรอกเลขเอง (กด Enter) — ตัดผลทันทีเมื่อปิดรับแล้ว */
export async function submitManualResult(day: string, n: number, N: string, by = 'admin') {
  if (!/^\d{5,6}$/.test(N)) throw new Error('กรุณากรอกเลขผล 5 หรือ 6 หลัก');
  await setControl(day, n, { mode: 'manual', number: N, by });
  const now = Date.now();
  if (now >= closeMsOf(day, n)) return settleRound(day, n, { force: true });
  return 'skipped' as SettleOutcome;
}

/** ตรวจ/ตัดรอบที่ค้าง — เรียกจากหน้ารายการ/แอดมิน (ทุกเครื่องช่วยกันได้ ปลอดภัยไม่ซ้ำ) */
export async function sweep(now: number = Date.now()) {
  const cfg = await loadConfig();
  const cur = currentRound(now);
  const day = gameDayOf(now);
  const candidates = new Set<string>();
  // รอบที่ผ่านมาทั้งหมดของวัน
  const lastN = cur ? cur.n - 1 : ROUNDS_PER_DAY;
  for (let n = 1; n <= lastN; n++) candidates.add(`${day}:${n}`);
  // รอบที่ยังมีโพยค้าง
  const { data } = await supabaseClient.from('tickets').select('round_id').eq('lottery_slug', 'yeekee').eq('status', 'pending');
  (data || []).forEach((t: any) => {
    const m = /^yk-(\d{8})-(\d{2})$/.exec(t.round_id || '');
    if (m) candidates.add(`${m[1]}:${+m[2]}`);
  });
  const out: Record<string, SettleOutcome> = {};
  for (const c of candidates) {
    const [d, ns] = c.split(':');
    const n = +ns;
    if (now < resultAtMs(d, n, cfg)) continue;
    out[c] = await settleRound(d, n);
  }
  return out;
}
