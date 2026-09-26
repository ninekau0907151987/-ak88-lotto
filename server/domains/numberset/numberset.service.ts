/**
 * server/domains/numberset/numberset.service.ts
 * ------------------------------------------------------------------
 * ★ เส้นลดเลข (Number Set / Limbo Line) — แยกจากเส้นโพยโดยสมบูรณ์ ★
 *
 * ทำไมต้องแยกจาก blocked_numbers:
 *   - blocked_numbers  = "ห้ามลูกค้าแทง" (ยอดเต็ม) → ใช้ตอนรับแทง
 *   - numberSets       = "เจ้ามือไปซื้อลดกับเจ้าใหญ่" (ไปเบรกความเสี่ยง)
 *     • มีต้นทุน (cost) → ต้องบันทึกเพื่อคำนวณกำไรจริง
 *     • มีสถานะ (pending → sent → confirmed → paid) → มีเจ้าหนี้
 *     • มีเลขที่รับ (setNo / รหัสอ้างอิงของเจ้าใหญ่)
 *     • มีหลายเจ้า (หลายปลายทาง) → ต้องแยกยอดตามเจ้า
 *
 * ★ กฎ: ไฟล์นี้ห้ามแตะยอดเครดิตของ users
 *       การจ่ายเงินให้เจ้าใหญ่บันทึกเป็น transactions ผ่าน wallet เท่านั้น
 *       (เจ้าใหญ่เป็น "supplier" ไม่ใช่ user — บันทึกเป็นค่าใช้จ่าย)
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import { COL } from '../../config/collections';
import { AppError } from '../../lib/wallet';
import { ERR } from '../../lib/response';

export type NumberSetStatus = 'pending' | 'sent' | 'confirmed' | 'paid' | 'cancelled';

export interface NumberSetItem {
  number: string;
  betType: string;       // ประเภทการเล่น เช่น '3ตัวบน'
  amount: number;        // ยอดที่เรารับมา
  reduceAmount: number;  // ยอดที่ส่งลด
  costRate?: number;     // ต้นทุนต่อบาท (เช่น 0.85 = จ่าย 85 สตางค์/บาท)
  expectedPayout?: number; // ยอดที่เจ้าใหญ่ต้องจ่ายถ้าถูก
}

/** สร้างชุดลดเลขใหม่ */
export async function createNumberSet(
  db: any,
  input: {
    lotterySlug: string;
    roundId: string;
    vendor: string;                 // ชื่อเจ้าใหญ่ที่รับลด
    vendorRef?: string;             // รหัสอ้างอิง/เลขที่บัญชีเจ้า
    items: NumberSetItem[];
    note?: string;
    createdBy?: string;
  },
) {
  const { lotterySlug, roundId, vendor, items } = input;
  if (!lotterySlug) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ lotterySlug', 400);
  if (!roundId) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ roundId', 400);
  if (!vendor) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ vendor (เจ้าใหญ่ที่รับลด)', 400);
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ items[] อย่างน้อย 1 รายการ', 400);
  }

  // ตรวจรายการ
  const clean: NumberSetItem[] = items.map((it, i) => {
    const number = String(it?.number ?? '').trim();
    const reduceAmount = Number(it?.reduceAmount);
    const amount = Number(it?.amount) || 0;
    if (!/^\d{1,6}$/.test(number)) {
      throw new AppError(ERR.BAD_REQUEST, `items[${i}].number ไม่ถูกต้อง (ได้: "${number}")`, 400);
    }
    if (!Number.isFinite(reduceAmount) || reduceAmount <= 0) {
      throw new AppError(ERR.BAD_REQUEST, `items[${i}].reduceAmount ต้องมากกว่า 0`, 400);
    }
    if (amount && reduceAmount > amount) {
      throw new AppError(ERR.BAD_REQUEST, `items[${i}]: ส่งลด (${reduceAmount}) มากกว่ายอดที่รับ (${amount})`, 400);
    }
    return {
      number,
      betType: it.betType || 'ทุกประเภท',
      amount,
      reduceAmount,
      costRate: Number(it.costRate) || 0,
      expectedPayout: Number(it.expectedPayout) || 0,
    };
  });

  const totalReceive = clean.reduce((s, x) => s + x.amount, 0);
  const totalReduce = clean.reduce((s, x) => s + x.reduceAmount, 0);
  const totalCost = clean.reduce((s, x) => s + x.reduceAmount * (x.costRate || 0), 0);
  const totalExpectedPayout = clean.reduce((s, x) => s + x.expectedPayout, 0);

  const ref = await addDoc(collection(db, COL.NUMBER_SETS), {
    setNo: null,                                  // ออกเลขทีหลัง (ต้อง atomic)
    lotterySlug,
    roundId,
    vendor,
    vendorRef: input.vendorRef || null,
    items: clean,
    itemCount: clean.length,
    totalReceive,
    totalReduce,
    totalCost,
    totalExpectedPayout,
    netExposure: totalReceive - totalReduce,       // ความเสี่ยงที่ยังถือเอง
    status: 'pending' as NumberSetStatus,
    note: input.note || '',
    createdBy: input.createdBy || 'api',
    createdAt: new Date().toISOString(),
    source: 'api',
  });

  // ออกเลขชุดแบบรันนิ่ง (แยกจากบิล — คนละเส้น)
  const setNo = await nextSetNo(db, lotterySlug);
  await updateDoc(ref, { setNo, updatedAt: serverTimestamp() });

  return {
    id: ref.id,
    setNo,
    itemCount: clean.length,
    totalReceive,
    totalReduce,
    totalCost,
    netExposure: totalReceive - totalReduce,
    status: 'pending',
  };
}

/** เลขชุดรันนิ่ง: NS-<slug>-YYYYMMDD-XXXX */
async function nextSetNo(db: any, lotterySlug: string): Promise<string> {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const key = `numberset_${lotterySlug}_${day}`;
  const ref = doc(db, 'counters', key);

  const { runTransaction } = await import('firebase/firestore');
  let seq = 1;
  await runTransaction(db, async (tx: any) => {
    const snap = await tx.get(ref);
    seq = (snap.exists() ? Number((snap.data() as any).seq || 0) : 0) + 1;
    tx.set(ref, { seq, updatedAt: serverTimestamp() }, { merge: true });
  });

  const safe = lotterySlug.replace(/[^a-zA-Z0-9ก-๙]/g, '').slice(0, 8) || 'LOT';
  return `NS-${safe}-${day}-${String(seq).padStart(4, '0')}`;
}

/** เปลี่ยนสถานะชุดลดเลข — ตรวจลำดับที่ถูกต้อง */
export async function updateNumberSetStatus(
  db: any,
  setId: string,
  status: NumberSetStatus,
  extra: { vendorRef?: string; note?: string } = {},
) {
  const allowed: NumberSetStatus[] = ['pending', 'sent', 'confirmed', 'paid', 'cancelled'];
  if (!allowed.includes(status)) {
    throw new AppError(ERR.BAD_REQUEST, `status ต้องเป็น: ${allowed.join(' | ')}`, 400);
  }

  const ref = doc(db, COL.NUMBER_SETS, setId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new AppError(ERR.NOT_FOUND, 'ไม่พบชุดลดเลข', 404);

  const s: any = snap.data();
  if (s.status === 'paid' && status !== 'paid') {
    throw new AppError(ERR.CONFLICT, 'ชุดนี้ชำระแล้ว เปลี่ยนสถานะย้อนกลับไม่ได้', 409);
  }
  if (s.status === 'cancelled') {
    throw new AppError(ERR.CONFLICT, 'ชุดนี้ถูกยกเลิกแล้ว', 409);
  }

  const patch: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
    [`${status}At`]: new Date().toISOString(),
  };
  if (extra.vendorRef) patch.vendorRef = extra.vendorRef;
  if (extra.note) patch.note = extra.note;

  await updateDoc(ref, patch);
  return { id: setId, setNo: s.setNo, status, totalReduce: s.totalReduce };
}

/** สรุปการลดเลขของรอบ — สำหรับหน้าจอความเสี่ยง */
export async function roundExposure(db: any, lotterySlug: string, roundId: string) {
  const [setSnap, txSnap, blSnap] = await Promise.all([
    getDocs(query(collection(db, COL.NUMBER_SETS), where('roundId', '==', roundId))),
    getDocs(query(collection(db, COL.TICKETS), where('ticketType', '==', lotterySlug))),
    getDocs(query(collection(db, COL.BLOCKED_NUMBERS), where('lotteryType', '==', lotterySlug))),
  ]);

  const sets = setSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  const tickets = txSnap.docs
    .map(d => ({ id: d.id, ...(d.data() as any) }))
    .filter(t => String(t.roundId || '') === String(roundId));

  // รวมยอดรับแยกตามเลข+ประเภท — หาเลขที่รับหนักสุด
  const received: Record<string, { number: string; type: string; amount: number }> = {};
  for (const t of tickets) {
    for (const b of (t.bets || [])) {
      const k = `${b.number}|${b.type}`;
      received[k] = received[k] || { number: String(b.number), type: String(b.type), amount: 0 };
      received[k].amount += Number(b.amount) || 0;
    }
  }

  const reduced: Record<string, number> = {};
  for (const s of sets) {
    for (const it of (s.items || [])) {
      const k = `${it.number}|${it.betType}`;
      reduced[k] = (reduced[k] || 0) + (Number(it.reduceAmount) || 0);
    }
  }

  // Exposure ต่อเลข = ยอดรับ - ยอดส่งลด (ยังไม่หักอั้น)
  const exposure = Object.entries(received).map(([k, v]) => ({
    number: v.number,
    type: v.type,
    received: v.amount,
    reduced: reduced[k] || 0,
    exposure: v.amount - (reduced[k] || 0),
  })).sort((a, b) => b.exposure - a.exposure);

  const totalReceive = tickets.reduce((s, t) => s + (Number(t.totalAmount) || 0), 0);
  const totalReduce = sets
    .filter(s => s.status !== 'cancelled')
    .reduce((s, x) => s + (Number(x.totalReduce) || 0), 0);
  const totalCost = sets
    .filter(s => s.status !== 'cancelled')
    .reduce((s, x) => s + (Number(x.totalCost) || 0), 0);

  return {
    lotterySlug,
    roundId,
    tickets: tickets.length,
    sets: sets.length,
    totalReceive,
    totalReduce,
    totalCost,
    netExposure: totalReceive - totalReduce,
    blockedCount: blSnap.size,
    topExposure: exposure.slice(0, 20),
    byStatus: {
      pending: sets.filter(s => s.status === 'pending').length,
      sent: sets.filter(s => s.status === 'sent').length,
      confirmed: sets.filter(s => s.status === 'confirmed').length,
      paid: sets.filter(s => s.status === 'paid').length,
      cancelled: sets.filter(s => s.status === 'cancelled').length,
    },
    byVendor: sets.reduce((acc: Record<string, { sets: number; reduce: number; cost: number }>, s) => {
      const v = s.vendor || 'unknown';
      acc[v] = acc[v] || { sets: 0, reduce: 0, cost: 0 };
      acc[v].sets++;
      acc[v].reduce += Number(s.totalReduce) || 0;
      acc[v].cost += Number(s.totalCost) || 0;
      return acc;
    }, {}),
  };
}

/** รายการชุดลดเลขทั้งหมด (กรองได้) */
export async function listNumberSets(
  db: any,
  filters: { lotterySlug?: string; roundId?: string; vendor?: string; status?: string } = {},
) {
  const conds: any[] = [];
  if (filters.lotterySlug) conds.push(where('lotterySlug', '==', filters.lotterySlug));
  if (filters.roundId) conds.push(where('roundId', '==', filters.roundId));
  if (filters.vendor) conds.push(where('vendor', '==', filters.vendor));
  if (filters.status) conds.push(where('status', '==', filters.status));

  const snap = await getDocs(
    conds.length ? query(collection(db, COL.NUMBER_SETS), ...conds) : collection(db, COL.NUMBER_SETS),
  );
  const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return list;
}
