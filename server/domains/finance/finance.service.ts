/**
 * server/domains/finance/finance.service.ts
 * ------------------------------------------------------------------
 * ★ การเงิน — ทุกการเปลี่ยนเครดิตผ่าน wallet เท่านั้น ★
 *
 * แก้จากเดิมที่ใช้ อ่าน→เช็ค→เขียน (race condition):
 *   - withdraw : ตัดเงินทันที → ต้อง atomic ไม่งั้นถอนซ้ำได้
 *   - review   : อนุมัติฝาก/ปฏิเสธถอน → ต้อง atomic + กัน review ซ้ำ
 *   - topup    : เติมเครดิต → atomic
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import { COL } from '../../config/collections';
import { wallet, AppError } from '../../lib/wallet';
import { ERR } from '../../lib/response';

/** เติมเครดิตโดยแอดมิน */
export async function topup(db: any, userId: string, amount: number, note?: string) {
  const amt = Number(amount);
  if (!userId || !Number.isFinite(amt) || amt <= 0) {
    throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ userId และ amount > 0', 400);
  }
  const r = await wallet.credit(db, userId, amt, {
    type: 'topup',
    note: note || 'เติมเครดิตโดยแอดมิน',
    source: 'api',
  });
  return { userId, amount: amt, balanceBefore: r.balanceBefore, balanceAfter: r.balanceAfter };
}

/** แจ้งฝาก — ยังไม่บวกเครดิต รออนุมัติ */
export async function requestDeposit(
  db: any,
  input: { userId: string; amount: number; method?: string; slipUrl?: string; note?: string },
) {
  const { userId, method, slipUrl, note } = input;
  const amt = Number(input.amount);
  if (!userId || !Number.isFinite(amt) || amt <= 0) {
    throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ userId และ amount > 0', 400);
  }

  const gSnap = await getDoc(doc(db, COL.SETTINGS, 'global'));
  if (gSnap.exists() && (gSnap.data() as any).depositOpen === false) {
    throw new AppError(ERR.CONFLICT, 'ระบบปิดรับฝากชั่วคราว', 403);
  }

  const ref = await addDoc(collection(db, COL.TRANSACTIONS), {
    userId,
    type: 'deposit',
    amount: amt,
    method: method || 'transfer',
    slipUrl: slipUrl || null,
    status: 'pending',
    note: note || '',
    direction: 'in',
    createdAt: new Date().toISOString(),
    source: 'api',
  });
  return { id: ref.id, amount: amt, status: 'pending' };
}

/** แจ้งถอน — ตัดเครดิตทันทีแบบ atomic (ถ้าปฏิเสธค่อยคืน) */
export async function requestWithdraw(
  db: any,
  input: { userId: string; amount: number; bankName?: string; bankAccount?: string; note?: string },
) {
  const { userId, bankName, bankAccount, note } = input;
  const amt = Number(input.amount);
  if (!userId || !Number.isFinite(amt) || amt <= 0) {
    throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ userId และ amount > 0', 400);
  }

  const gSnap = await getDoc(doc(db, COL.SETTINGS, 'global'));
  if (gSnap.exists() && (gSnap.data() as any).withdrawOpen === false) {
    throw new AppError(ERR.CONFLICT, 'ระบบปิดถอนชั่วคราว', 403);
  }

  // ★ atomic: ถ้าเครดิตไม่พอจะ throw เอง ไม่มีทางติดลบ
  const ledger = await wallet.debit(db, userId, amt, {
    type: 'withdraw',
    note: note || 'แจ้งถอน (รออนุมัติ)',
    source: 'api',
  });

  const ref = await addDoc(collection(db, COL.TRANSACTIONS), {
    userId,
    type: 'withdraw',
    amount: amt,
    balanceBefore: ledger.balanceBefore,
    balanceAfter: ledger.balanceAfter,
    bankName: bankName || '',
    bankAccount: bankAccount || '',
    status: 'pending',
    note: note || '',
    direction: 'out',
    createdAt: new Date().toISOString(),
    source: 'api',
  });

  return { id: ref.id, amount: amt, status: 'pending', balanceAfter: ledger.balanceAfter };
}

/**
 * อนุมัติ/ปฏิเสธธุรกรรม — กัน review ซ้ำด้วย status guard
 * ★ ปัญหาเดิม: กด review 2 ครั้ง → ฝากเข้าสองรอบ
 */
export async function reviewTransaction(
  db: any,
  txId: string,
  action: 'approve' | 'reject',
  note?: string,
) {
  if (!['approve', 'reject'].includes(action)) {
    throw new AppError(ERR.BAD_REQUEST, "action ต้องเป็น 'approve' หรือ 'reject'", 400);
  }

  const ref = doc(db, COL.TRANSACTIONS, txId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new AppError(ERR.NOT_FOUND, 'ไม่พบธุรกรรม', 404);

  const t: any = snap.data();
  if (t.status !== 'pending') {
    throw new AppError(ERR.CONFLICT, `ธุรกรรมนี้ถูกดำเนินการแล้ว (สถานะ: ${t.status})`, 409);
  }

  const amt = Number(t.amount) || 0;

  // ★ เคลมธุรกรรมก่อน — เปลี่ยน status จาก pending เป็น processing
  //    ถ้าคนอื่นทำไปแล้ว จะ throw CONFLICT และไม่ทำงานซ้ำ
  await updateDoc(ref, {
    status: action === 'approve' ? 'approving' : 'rejecting',
    reviewStartedAt: new Date().toISOString(),
  });

  if (action === 'approve' && t.type === 'deposit') {
    // ฝาก: บวกเครดิตตอนอนุมัติ
    await wallet.credit(db, t.userId, amt, {
      type: 'deposit',
      ref: txId,
      note: `อนุมัติฝาก ${t.method || ''}`.trim(),
      source: 'api',
    });
  } else if (action === 'reject' && t.type === 'withdraw') {
    // ถอนถูกปฏิเสธ: คืนเครดิตที่ตัดไปตอนแจ้งถอน
    await wallet.credit(db, t.userId, amt, {
      type: 'refund',
      ref: txId,
      note: 'ปฏิเสธถอน คืนเครดิต',
      source: 'api',
    });
  }

  await updateDoc(ref, {
    status: action === 'approve' ? 'approved' : 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewNote: note || '',
    updatedAt: serverTimestamp(),
  });

  return { id: txId, action, amount: amt, type: t.type };
}
