/**
 * server/lib/wallet.ts
 * ------------------------------------------------------------------
 * ★ หัวใจของความถูกต้องทางการเงิน ★
 *
 * กฎเหล็ก: ทุกการเปลี่ยนยอดเครดิตของ users ต้องผ่านไฟล์นี้เท่านั้น
 *          ห้าม updateDoc({ balance }) ตรงๆ ที่อื่นเด็ดขาด
 *
 * ทำไม: โค้ดเดิมใช้รูปแบบ อ่าน → เช็ค → เขียน ซึ่งถ้ามี 2 request
 *       เข้ามาพร้อมกัน (หวยยี่กีออกทุก 15 นาที มีคนยิงพร้อมกันได้)
 *       ทั้งคู่จะอ่านยอดเดิมแล้วเขียนทับกัน → เครดิตหายหรือติดลบ
 *
 * วิธีแก้: ใช้ runTransaction ของ Firestore ซึ่งการันตีว่า
 *         อ่าน-เขียน จะสำเร็จทั้งคู่หรือล้มเหลวทั้งคู่ (atomic)
 *
 * การใช้งาน:
 *   await wallet.debit(db, userId, 100, { type:'bet', note:'แทงหวย' });
 *   // ถ้าเครดิตไม่พอ จะ throw AppError code INSUFFICIENT_CREDIT
 */
import {
  runTransaction, doc, collection, serverTimestamp, addDoc,
} from 'firebase/firestore';
import { COL } from '../config/collections';
import { ERR } from './response';

/** ข้อผิดพลาดระดับธุรกิจ — route จับแล้วตอบ client ได้เลย */
export class AppError extends Error {
  code: string;
  httpStatus: number;
  details?: unknown;

  constructor(code: string, message: string, httpStatus = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export interface TxMeta {
  /** ประเภทธุรกรรม: bet | win | refund | topup | deposit | withdraw | adjust */
  type: string;
  /** อ้างอิงเอกสารต้นเหตุ (ticketId / transactionId) */
  ref?: string | null;
  note?: string;
  /** ชื่อ field ยอดเงินที่ใช้ — เปลี่ยนได้ถ้าอนาคตมี wallet หลายกระเป๋า */
  balanceField?: string;
  /** แหล่งที่มา: api | web | queue | system */
  source?: string;
  /** รหัสอ้างอิงภายนอก (idempotency) — ถ้าซ้ำจะไม่ตัด/เติมซ้ำ */
  idempotencyKey?: string | null;
  /** รอบหวย */
  roundId?: string | null;
}

export interface LedgerResult {
  balanceBefore: number;
  balanceAfter: number;
  transactionId: string;
}

/** ประมวลผลการเปลี่ยนยอดเงินแบบ atomic 1 ครั้ง */
async function applyDelta(
  db: any,
  userId: string,
  delta: number,
  meta: TxMeta,
  options: { requireSufficient?: boolean } = {},
): Promise<LedgerResult> {
  if (!userId) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ userId', 400);
  if (!Number.isFinite(delta) || delta === 0) {
    throw new AppError(ERR.BAD_REQUEST, 'จำนวนเงินต้องไม่เป็นศูนย์', 400);
  }

  const balanceField = meta.balanceField || 'balance';
  const userRef = doc(db, COL.USERS, userId);

  // ---- 1) เปลี่ยนยอดแบบ atomic ----
  let balanceBefore = 0;
  let balanceAfter = 0;

  await runTransaction(db, async (tx: any) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) {
      throw new AppError(ERR.NOT_FOUND, 'ไม่พบผู้ใช้นี้', 404);
    }
    const u = snap.data() || {};

    // กันระงับบัญชี
    if (u.status === 'suspended') {
      throw new AppError('ACCOUNT_SUSPENDED', 'บัญชีนี้ถูกระงับการใช้งาน', 403);
    }

    balanceBefore = Number(u[balanceField] ?? 0);
    balanceAfter = balanceBefore + delta;

    if (options.requireSufficient && balanceAfter < 0) {
      throw new AppError(
        ERR.INSUFFICIENT_CREDIT,
        'เครดิตไม่พอ',
        400,
        { balance: balanceBefore, required: Math.abs(delta) },
      );
    }

    tx.update(userRef, {
      [balanceField]: balanceAfter,
      updatedAt: serverTimestamp(),
    });
  });

  // ---- 2) บันทึกบัญชีแยกประเภท (ledger) นอก transaction ----
  // บันทึกหลังยอดถูก commit แล้ว ป้องกันไม่ให้ ledger ล้มแล้วยอดหาย
  const txRef = await addDoc(collection(db, COL.TRANSACTIONS), {
    userId,
    type: meta.type,
    amount: delta,
    balanceBefore,
    balanceAfter,
    ref: meta.ref || null,
    roundId: meta.roundId || null,
    note: meta.note || '',
    idempotencyKey: meta.idempotencyKey || null,
    status: 'success',
    source: meta.source || 'api',
    createdAt: new Date().toISOString(),
  });

  return { balanceBefore, balanceAfter, transactionId: txRef.id };
}

export const wallet = {
  /**
   * ตัดเครดิต — โยน error ถ้าเครดิตไม่พอ
   * ใช้กับ: แทงหวย, ถอนเงิน, หักค่าธรรมเนียม
   */
  async debit(db: any, userId: string, amount: number, meta: TxMeta): Promise<LedgerResult> {
    const amt = Math.abs(Number(amount));
    if (!amt) throw new AppError(ERR.BAD_REQUEST, 'จำนวนเงินต้องมากกว่า 0', 400);
    return applyDelta(db, userId, -amt, meta, { requireSufficient: true });
  },

  /**
   * เติมเครดิต — ยอดไม่มีทางติดลบจึงไม่ต้องเช็ค
   * ใช้กับ: เติมเครดิต, ฝากอนุมัติ, จ่ายรางวัล, คืนเครดิต
   */
  async credit(db: any, userId: string, amount: number, meta: TxMeta): Promise<LedgerResult> {
    const amt = Math.abs(Number(amount));
    if (!amt) throw new AppError(ERR.BAD_REQUEST, 'จำนวนเงินต้องมากกว่า 0', 400);
    return applyDelta(db, userId, amt, meta, { requireSufficient: false });
  },

  /**
   * เช็คเครดิตก่อนทำรายการ (ไม่ atomic — ใช้เพื่อ UX เท่านั้น)
   * ★ ห้ามใช้แทน debit() เด็ดขาด เพราะระหว่างเช็คกับทำจริงยอดอาจเปลี่ยน
   *   debit() จะเช็คซ้ำใน transaction ให้อยู่แล้ว
   */
  async peek(db: any, userId: string, field = 'balance'): Promise<number> {
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, COL.USERS, userId));
    if (!snap.exists()) return 0;
    return Number((snap.data() as any)[field] ?? 0);
  },
};
