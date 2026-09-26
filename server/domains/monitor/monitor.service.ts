/**
 * server/domains/monitor/monitor.service.ts
 * ------------------------------------------------------------------
 * ★ เส้นมอนิเตอร์ (Monitoring Line) — แยกจากเส้นอื่นโดยสมบูรณ์ ★
 *
 * หน้าที่: เฝ้าดูสุขภาพระบบแบบอ่านอย่างเดียว (read-only)
 *          ห้ามเขียนข้อมูลธุรกิจใด ๆ ในไฟล์นี้
 *
 * สิ่งที่เฝ้า:
 *   - สุขภาพ API (จำนวน call, error rate, latency)
 *   - สุขภาพคิว (งานค้าง, งานล้ม)
 *   - สุขภาพการเงิน (ยอดค้างอนุมัติ, ยอดหมุนเวียน)
 *   - Anomaly (ยอดแทงพุ่งผิดปกติ, ผู้ใช้ยิงถี่)
 *
 * ★ กฎ: endpoint มอนิเตอร์ต้องตอบเร็ว (< 500ms) ห้ามสแกนทั้ง collection
 *       ใน production ให้เปลี่ยนไปใช้ counter ที่อัปเดตแบบ incremental
 */
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
} from 'firebase/firestore';
import { COL, QUEUE_STATUS, TICKET_STATUS } from '../../config/collections';

/** บันทึก log การเรียก API — เรียกจาก middleware (fire-and-forget) */
export async function logApiCall(db: any, entry: {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  apiKeyId?: string | null;
  requestId?: string;
  userId?: string | null;
}) {
  if (!db) return;
  await db && (await import('firebase/firestore')).addDoc(collection(db, COL.API_LOGS), {
    ...entry,
    createdAt: new Date().toISOString(),
  });
}

/** สุขภาพระบบโดยรวม — สำหรับหน้า dashboard มอนิเตอร์ */
export async function systemHealth(db: any) {
  const startedAt = Date.now();

  const [qSnap, tSnap, xSnap] = await Promise.all([
    getDocs(collection(db, COL.BET_QUEUE)),
    getDocs(collection(db, COL.TICKETS)),
    getDocs(collection(db, COL.TRANSACTIONS)),
  ]);

  const queue = qSnap.docs.map(d => d.data() as any);
  const tickets = tSnap.docs.map(d => d.data() as any);
  const txs = xSnap.docs.map(d => d.data() as any);

  const queued = queue.filter(q => q.status === QUEUE_STATUS.QUEUED);
  const failedQueue = queue.filter(q => q.status === QUEUE_STATUS.FAILED);
  const pendingTx = txs.filter(x => x.status === 'pending');
  const unsettled = tickets.filter(
    t => !t.settledAt && (t.status === TICKET_STATUS.CONFIRMED || t.status === 'active'),
  );

  // ประเมินสุขภาพ
  const issues: Array<{ level: 'warn' | 'critical'; area: string; message: string }> = [];
  if (failedQueue.length > 10) {
    issues.push({ level: 'critical', area: 'queue', message: `มีคิวล้ม ${failedQueue.length} รายการ ต้องตรวจ` });
  }
  if (queued.length > 500) {
    issues.push({ level: 'warn', area: 'queue', message: `คิวค้าง ${queued.length} รายการ — worker อาจไม่ทำงาน` });
  }
  if (pendingTx.length > 50) {
    issues.push({ level: 'warn', area: 'finance', message: `ธุรกรรมรออนุมัติ ${pendingTx.length} รายการ` });
  }
  if (unsettled.length > 1000) {
    issues.push({ level: 'warn', area: 'settlement', message: `โพยยังไม่ตัดสิน ${unsettled.length} ใบ` });
  }

  return {
    healthy: issues.filter(i => i.level === 'critical').length === 0,
    issues,
    queue: {
      total: queue.length,
      queued: queued.length,
      processing: queue.filter(q => q.status === QUEUE_STATUS.PROCESSING).length,
      done: queue.filter(q => q.status === QUEUE_STATUS.DONE).length,
      failed: failedQueue.length,
      queuedAmount: queued.reduce((s, q) => s + (Number(q.totalAmount) || 0), 0),
      oldestQueuedAt: queued.map(q => q.createdAt).filter(Boolean).sort()[0] || null,
    },
    betting: {
      tickets: tickets.length,
      unsettled: unsettled.length,
      won: tickets.filter(t => t.status === TICKET_STATUS.WIN).length,
      lost: tickets.filter(t => t.status === TICKET_STATUS.LOSE).length,
      cancelled: tickets.filter(t => t.status === TICKET_STATUS.CANCELLED).length,
      totalBet: tickets.reduce((s, t) => s + (Number(t.totalAmount) || 0), 0),
      totalPayout: tickets.reduce((s, t) => s + (Number(t.payout) || 0), 0),
    },
    finance: {
      transactions: txs.length,
      pending: pendingTx.length,
      pendingDeposit: pendingTx.filter(x => x.type === 'deposit').length,
      pendingWithdraw: pendingTx.filter(x => x.type === 'withdraw').length,
    },
    responseMs: Date.now() - startedAt,
    serverTime: new Date().toISOString(),
  };
}

/** ตรวจความถูกต้องของยอดเงิน — จับโพยที่เครดิตไม่ตรงกับ ledger */
export async function auditBalance(db: any, userId: string) {
  const [uSnap, txSnap] = await Promise.all([
    getDoc(doc(db, COL.USERS, userId)),
    getDocs(query(collection(db, COL.TRANSACTIONS), where('userId', '==', userId))),
  ]);

  if (!uSnap.exists()) return null;
  const balance = Number((uSnap.data() as any).balance ?? 0);

  // คำนวณยอดที่ควรจะเป็นจาก ledger
  const txs = txSnap.docs.map(d => d.data() as any);
  const expected = txs.reduce((sum, t) => {
    // เฉพาะธุรกรรมที่สำเร็จแล้วเท่านั้น
    if (!['success', 'approved'].includes(String(t.status))) return sum;
    const amt = Number(t.amount) || 0;
    // topup/deposit/win = บวก ; bet = ติดลบอยู่แล้ว ; withdraw = ติดลบอยู่แล้ว
    if (t.type === 'bet') return sum - Math.abs(amt);
    if (t.type === 'withdraw') return sum - Math.abs(amt);
    return sum + Math.abs(amt);      // topup, deposit, win, refund
  }, 0);

  const diff = balance - expected;
  return {
    userId,
    balance,
    fromLedger: expected,
    difference: diff,
    balanced: Math.abs(diff) < 0.01,
    transactionCount: txs.length,
    ledgerTransactions: txs.filter(t => ['success', 'approved'].includes(String(t.status))).length,
  };
}

/** ตรวจทุกบัญชี — หา users ที่ balance ติดลบ (ควรไม่มีทางเกิด) */
export async function findNegativeBalances(db: any) {
  const snap = await getDocs(collection(db, COL.USERS));
  const bad = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as any) }))
    .filter(u => Number(u.balance ?? 0) < 0)
    .map(u => ({ id: u.id, username: u.username, balance: u.balance }));
  return { count: bad.length, users: bad };
}
