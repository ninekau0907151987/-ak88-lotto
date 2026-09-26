/**
 * server/domains/queue/queue.service.ts
 * ------------------------------------------------------------------
 * คิวโพย — สำหรับช่วงโหลดสูง (ยี่กีออกทุก 15 นาที)
 *
 * ★ แก้บั๊กเดิม: /queue/process เคยสร้างโพยตรงๆ โดย "ไม่ตัดเครดิต"
 *   → ยิงเข้าคิว = แทงฟรี
 *   ตอนนี้ worker เรียก placeBet() ตัวเดียวกับเส้น API ตรง
 *   ทุกกฎ (เครดิต, เลขอั้น, เปิด-ปิด) ถูกบังคับเหมือนกันหมด
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import { COL, QUEUE_STATUS } from '../../config/collections';
import { placeBet, sumBets, type BetItem } from '../betting/betting.service';
import { AppError } from '../../lib/wallet';
import { ERR } from '../../lib/response';

export interface EnqueueInput {
  userId: string;
  lotterySlug: string;
  roundId?: string | null;
  bets: BetItem[];
  priority?: 'normal' | 'high';
  idempotencyKey?: string | null;
}

/** เข้าคิว — ตรวจรูปแบบเท่านั้น ยังไม่ตัดเครดิต (ตัดตอน process) */
export async function enqueue(db: any, input: EnqueueInput) {
  const { userId, lotterySlug, bets, priority } = input;

  if (!userId) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ userId', 400);
  if (!lotterySlug) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ lotterySlug', 400);
  if (!Array.isArray(bets) || bets.length === 0) {
    throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ bets[] อย่างน้อย 1 รายการ', 400);
  }

  const totalAmount = sumBets(bets);

  // กันซ้ำด้วย idempotencyKey
  if (input.idempotencyKey) {
    const dup = await getDocs(query(
      collection(db, COL.BET_QUEUE),
      where('idempotencyKey', '==', input.idempotencyKey),
    ));
    if (!dup.empty) {
      const existing = dup.docs[0];
      return {
        queueId: existing.id,
        duplicate: true,
        status: (existing.data() as any).status,
        totalAmount,
      };
    }
  }

  const ref = await addDoc(collection(db, COL.BET_QUEUE), {
    userId,
    lotterySlug,
    lotteryType: lotterySlug,          // เข้ากันได้กับโค้ดเก่า
    roundId: input.roundId || null,
    bets,
    totalAmount,
    betCount: bets.length,
    priority: priority === 'high' ? 'high' : 'normal',
    idempotencyKey: input.idempotencyKey || null,
    status: QUEUE_STATUS.QUEUED,
    attempts: 0,
    ticketId: null,
    error: null,
    createdAt: new Date().toISOString(),
    source: 'api',
  });

  return { queueId: ref.id, duplicate: false, status: QUEUE_STATUS.QUEUED, totalAmount };
}

/** ดูตำแหน่งในคิว */
export async function getQueuePosition(db: any, queueId: string) {
  const snap = await getDoc(doc(db, COL.BET_QUEUE, queueId));
  if (!snap.exists()) throw new AppError(ERR.NOT_FOUND, 'ไม่พบคิวนี้', 404);

  const data: any = snap.data();
  if (data.status !== QUEUE_STATUS.QUEUED) {
    return { id: queueId, ...data, position: null };
  }

  const all = await getDocs(query(
    collection(db, COL.BET_QUEUE),
    where('status', '==', QUEUE_STATUS.QUEUED),
  ));
  const list = all.docs
    .map(d => ({ id: d.id, createdAt: String((d.data() as any).createdAt || '') }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const idx = list.findIndex(x => x.id === queueId);
  return { id: queueId, ...data, position: idx >= 0 ? idx + 1 : null, queuedTotal: list.length };
}

/**
 * ★ ประมวลผลคิว — เรียก placeBet() ต่อรายการ
 * ทุกกฎการเงินถูกบังคับใช้เหมือนเส้น API ตรง
 */
export async function processQueue(db: any, options: { batchSize?: number; workerId?: string } = {}) {
  const batchSize = Math.min(Math.max(Number(options.batchSize) || 20, 1), 100);
  const workerId = options.workerId || 'worker-1';

  const snap = await getDocs(query(
    collection(db, COL.BET_QUEUE),
    where('status', '==', QUEUE_STATUS.QUEUED),
  ));

  const items = snap.docs
    .map(d => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => {
      // priority high ก่อน แล้วค่อยตามเวลา
      if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    })
    .slice(0, batchSize);

  const result = { picked: items.length, done: 0, failed: 0, errors: [] as Array<{ queueId: string; code?: string; error: string }> };

  for (const item of items) {
    const ref = doc(db, COL.BET_QUEUE, item.id);
    try {
      // ทำเครื่องหมายว่ากำลังประมวลผล (กัน worker อื่นหยิบซ้ำ)
      await updateDoc(ref, {
        status: QUEUE_STATUS.PROCESSING,
        processingBy: workerId,
        processingAt: new Date().toISOString(),
        attempts: (Number(item.attempts) || 0) + 1,
      });

      // ★ เรียกตรรกะกลาง — ตัดเครดิต + เช็คเลขอั้น + เช็คเปิด-ปิด ครบ
      const out = await placeBet(db, {
        userId: item.userId,
        lotterySlug: item.lotterySlug || item.lotteryType,
        roundId: item.roundId || null,
        bets: item.bets,
        source: 'queue',
        idempotencyKey: item.idempotencyKey || null,
      });

      await updateDoc(ref, {
        status: QUEUE_STATUS.DONE,
        ticketId: out.ticketId,
        totalAmount: out.totalAmount,
        error: null,
        completedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      result.done++;
    } catch (err: any) {
      const code = err?.code || 'UNKNOWN';
      const msg = String(err?.message || err);
      const attempts = (Number(item.attempts) || 0) + 1;

      // ข้อผิดพลาดถาวร (เครดิตไม่พอ/เลขอั้น) → failed ทันที
      // ข้อผิดพลาดชั่วคราว → คืนเข้าคิวถ้ายังไม่เกิน 3 ครั้ง
      const permanent = [
        ERR.INSUFFICIENT_CREDIT, ERR.NUMBER_BLOCKED, ERR.LOTTERY_CLOSED,
        ERR.BETTING_CLOSED, ERR.BAD_REQUEST, ERR.NOT_FOUND, ERR.ROUND_CLOSED,
      ].includes(code);

      const retry = !permanent && attempts < 3;

      await updateDoc(ref, {
        status: retry ? QUEUE_STATUS.QUEUED : QUEUE_STATUS.FAILED,
        error: msg,
        errorCode: code,
        updatedAt: serverTimestamp(),
      }).catch(() => {});

      result.failed++;
      result.errors.push({ queueId: item.id, code, error: msg });
    }
  }

  return result;
}

/** สรุปสถานะคิว — สำหรับหน้าจอเฝ้าดู (monitor) */
export async function queueStats(db: any) {
  const snap = await getDocs(collection(db, COL.BET_QUEUE));
  const all = snap.docs.map(d => d.data() as any);

  const by = (s: string) => all.filter(x => x.status === s);
  const queued = by(QUEUE_STATUS.QUEUED);
  const failed = by(QUEUE_STATUS.FAILED);
  const oldest = queued.map(x => x.createdAt).filter(Boolean).sort()[0] || null;

  return {
    total: all.length,
    queued: queued.length,
    processing: by(QUEUE_STATUS.PROCESSING).length,
    done: by(QUEUE_STATUS.DONE).length,
    failed: failed.length,
    totalQueuedAmount: queued.reduce((s, x) => s + (Number(x.totalAmount) || 0), 0),
    oldestQueuedAt: oldest,
    recentFailures: failed.slice(-10).map(x => ({
      userId: x.userId,
      lotterySlug: x.lotterySlug || x.lotteryType,
      amount: x.totalAmount,
      errorCode: x.errorCode,
      error: x.error,
    })),
  };
}
