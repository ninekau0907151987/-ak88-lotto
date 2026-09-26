/**
 * server/domains/billing/billing.service.ts
 * ------------------------------------------------------------------
 * ★ เส้นส่งบิล (Billing Line) — แยกจากเส้นแทง/เส้นเงินโดยสมบูรณ์ ★
 *
 * ทำไมต้องแยก:
 *   - บิลเป็น "เอกสาร" ไม่ใช่ "ธุรกรรม" → lifecycle ต่างกัน
 *   - ต้องออกเลขที่บิลแบบ running number ที่ไม่ซ้ำ (invoiceNo)
 *   - ลูกค้าขอดู/พิมพ์ซ้ำได้ โดยไม่กระทบยอดเงิน
 *   - ถ้าเส้นบิลล่ม ระบบรับแทงต้องไม่ล่มตาม
 *
 * ★ กฎ: ห้ามไฟล์นี้แตะยอดเครดิต (balance) เด็ดขาด — อ่านเท่านั้น
 *       การจ่ายเงินเป็นหน้าที่ของ wallet/betting เท่านั้น
 */
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import { COL, TICKET_STATUS } from '../../config/collections';
import { AppError } from '../../lib/wallet';
import { ERR } from '../../lib/response';

export type InvoiceType = 'bet' | 'win' | 'deposit' | 'withdraw' | 'topup' | 'statement';

/** สร้างเลขที่บิลแบบรันนิ่ง: INV-YYYYMMDD-XXXX */
async function nextInvoiceNo(db: any, prefix = 'INV'): Promise<string> {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const counterRef = doc(db, 'counters', `invoice_${day}`);

  const { runTransaction } = await import('firebase/firestore');
  let seq = 1;
  await runTransaction(db, async (tx: any) => {
    const snap = await tx.get(counterRef);
    seq = (snap.exists() ? Number((snap.data() as any).seq || 0) : 0) + 1;
    tx.set(counterRef, { seq, updatedAt: serverTimestamp() }, { merge: true });
  });

  return `${prefix}-${day}-${String(seq).padStart(4, '0')}`;
}

/** ออกบิลจากโพยหวย */
export async function issueBetInvoice(db: any, ticketId: string, options: { force?: boolean } = {}) {
  const tSnap = await getDoc(doc(db, COL.TICKETS, ticketId));
  if (!tSnap.exists()) throw new AppError(ERR.NOT_FOUND, 'ไม่พบโพย', 404);
  const t: any = tSnap.data();

  // กันออกบิลซ้ำ — 1 โพย = 1 บิล
  if (!options.force) {
    const dup = await getDocs(query(
      collection(db, COL.INVOICES),
      where('refId', '==', ticketId),
      where('type', '==', 'bet'),
    ));
    if (!dup.empty) {
      const existing = dup.docs[0];
      return { id: existing.id, ...(existing.data() as any), duplicate: true };
    }
  }

  const invoiceNo = await nextInvoiceNo(db, 'INV');
  const lines = (t.bets || []).map((b: any) => ({
    description: `${b.type} เลข ${b.number}`,
    quantity: 1,
    unitPrice: Number(b.amount) || 0,
    amount: Number(b.amount) || 0,
    rate: Number(b.rate) || 0,
  }));

  const inv = {
    invoiceNo,
    type: 'bet' as InvoiceType,
    refId: ticketId,
    userId: t.userId,
    lotterySlug: t.lotterySlug || t.ticketType,
    roundId: t.roundId || null,
    lines,
    subtotal: Number(t.totalAmount) || 0,
    discount: 0,
    total: Number(t.totalAmount) || 0,
    currency: 'THB',
    status: 'issued',
    issuedAt: new Date().toISOString(),
    createdBy: 'system',
    note: '',
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(collection(db, COL.INVOICES), inv);
  return { id: ref.id, ...inv, duplicate: false };
}

/**
 * ออกบิลจากธุรกรรม (ฝาก/ถอน/เติม) — ใช้กับเส้นการเงิน
 */
export async function issueTransactionInvoice(db: any, transactionId: string) {
  const xSnap = await getDoc(doc(db, COL.TRANSACTIONS, transactionId));
  if (!xSnap.exists()) throw new AppError(ERR.NOT_FOUND, 'ไม่พบธุรกรรม', 404);
  const x: any = xSnap.data();

  const dup = await getDocs(query(
    collection(db, COL.INVOICES),
    where('refId', '==', transactionId),
  ));
  if (!dup.empty) {
    const existing = dup.docs[0];
    return { id: existing.id, ...(existing.data() as any), duplicate: true };
  }

  const label: Record<string, string> = {
    deposit: 'เงินฝาก', withdraw: 'ถอนเงิน', topup: 'เติมเครดิต',
    win: 'เงินรางวัล', bet: 'ค่าลงทุน', refund: 'คืนเครดิต',
  };

  const invoiceNo = await nextInvoiceNo(db, x.type === 'withdraw' ? 'WDR' : 'INV');
  const inv = {
    invoiceNo,
    type: (x.type || 'bet') as InvoiceType,
    refId: transactionId,
    userId: x.userId,
    lines: [{
      description: label[x.type] || x.type,
      quantity: 1,
      unitPrice: Math.abs(Number(x.amount) || 0),
      amount: Math.abs(Number(x.amount) || 0),
    }],
    subtotal: Math.abs(Number(x.amount) || 0),
    discount: 0,
    total: Math.abs(Number(x.amount) || 0),
    currency: 'THB',
    status: x.status === 'approved' ? 'issued' : 'pending',
    issuedAt: new Date().toISOString(),
    note: x.note || '',
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(collection(db, COL.INVOICES), inv);
  return { id: ref.id, ...inv, duplicate: false };
}

/** ออกบิลชุดจากการตัดสินรางวัล — สรุปทั้งรอบ */
export async function issueSettlementStatement(
  db: any,
  input: { roundId: string; lotterySlug: string; userId?: string },
) {
  const conds = [where('ticketType', '==', input.lotterySlug)];
  const snap = await getDocs(query(collection(db, COL.TICKETS), ...conds));
  let tickets = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  tickets = tickets.filter(t => String(t.roundId || '') === String(input.roundId));
  if (input.userId) tickets = tickets.filter(t => t.userId === input.userId);

  const settled = tickets.filter(t => t.settledAt);
  const lines = settled.map(t => ({
    description: `โพย ${t.id.slice(-6)} (${(t.bets || []).length} รายการ)`,
    quantity: 1,
    unitPrice: Number(t.totalAmount) || 0,
    amount: Number(t.totalAmount) || 0,
    payout: Number(t.payout) || 0,
    status: t.status,
  }));

  const invoiceNo = await nextInvoiceNo(db, 'STMT');
  const inv = {
    invoiceNo,
    type: 'statement' as InvoiceType,
    refId: input.roundId,
    userId: input.userId || null,
    lotterySlug: input.lotterySlug,
    roundId: input.roundId,
    lines,
    subtotal: settled.reduce((s, t) => s + (Number(t.totalAmount) || 0), 0),
    totalPayout: settled.reduce((s, t) => s + (Number(t.payout) || 0), 0),
    ticketCount: settled.length,
    currency: 'THB',
    status: 'issued',
    issuedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(collection(db, COL.INVOICES), inv);
  return { id: ref.id, ...inv };
}

/** พิมพ์บิลซ้ำ / ดูบิล */
export async function getInvoice(db: any, invoiceId: string) {
  const snap = await getDoc(doc(db, COL.INVOICES, invoiceId));
  if (!snap.exists()) throw new AppError(ERR.NOT_FOUND, 'ไม่พบบิล', 404);
  return { id: snap.id, ...(snap.data() as any) };
}

/** บิลของลูกค้า + สรุปยอดที่ต้องชำระ */
export async function customerStatement(db: any, userId: string, options: { from?: string; to?: string } = {}) {
  const [invSnap, tSnap] = await Promise.all([
    getDocs(query(collection(db, COL.INVOICES), where('userId', '==', userId))),
    getDocs(query(collection(db, COL.TICKETS), where('userId', '==', userId))),
  ]);

  const inRange = (s?: string) => {
    const d = String(s || '').slice(0, 10);
    if (options.from && d < options.from) return false;
    if (options.to && d > options.to) return false;
    return true;
  };

  const invoices = invSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(i => inRange(i.issuedAt));
  const tickets = tSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(t => inRange(t.createdAt));

  return {
    userId,
    invoices: invoices.sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt))),
    summary: {
      invoiceCount: invoices.length,
      totalBilled: tickets.reduce((s, t) => s + (Number(t.totalAmount) || 0), 0),
      totalWon: tickets.reduce((s, t) => s + (Number(t.payout) || 0), 0),
      net: tickets.reduce((s, t) => s + (Number(t.payout) || 0) - (Number(t.totalAmount) || 0), 0),
      ticketCount: tickets.length,
    },
  };
}
