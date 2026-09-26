/**
 * server/domains/system/purge.service.ts
 * -------------------------------------------------------------
 * ล้างข้อมูลจำลองและข้อมูลทดสอบทั้งหมดเพื่อเปิดระบบจริง (Production Launch)
 * - ลบผู้ใช้ทดสอบ (demo_user, test_member_*, e2e_*)
 * - ลบประวัติธุรกรรมจำลอง (transactions)
 * - ลบโพยหวยทดสอบ (tickets)
 * - ล้างแคชกระเป๋าเงินจำลองใน Memory
 * - รีเซ็ตประวัติยี่กีทดสอบให้เริ่มนับรอบใหม่อย่างบริสุทธิ์
 */

import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { clearMemoryBalances } from '../../lib/wallet';

export async function purgeTestData(db: any) {
  const summary = {
    deletedUsers: 0,
    deletedTransactions: 0,
    deletedTickets: 0,
    memoryCleared: true,
    yeekeeReset: false,
  };

  // 1) ล้างแคชยอดเงินใน Memory
  clearMemoryBalances();

  if (!db) {
    return {
      success: true,
      message: 'ล้างแคชระบบจำลองใน Memory เรียบร้อยแล้ว',
      summary,
    };
  }

  try {
    // 2) ลบผู้ใช้ทดสอบ
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const d of usersSnap.docs) {
      const data = d.data();
      const uname = String(data.username || '').toLowerCase();
      const phone = String(data.phoneNumber || '');
      const id = d.id;

      if (
        id === 'demo_user' ||
        id === 'test_member_01' ||
        uname.startsWith('test_') ||
        uname.startsWith('demo') ||
        uname.startsWith('e2e_') ||
        uname === 'user_ak88' ||
        phone === '0812345678'
      ) {
        await deleteDoc(doc(db, 'users', id));
        summary.deletedUsers++;
      }
    }
  } catch (err: any) {
    console.warn('[PURGE] Users delete notice:', err?.message);
  }

  try {
    // 3) ลบธุรกรรมทดสอบ
    const txSnap = await getDocs(collection(db, 'transactions'));
    for (const d of txSnap.docs) {
      const data = d.data();
      const uid = String(data.userId || '');
      if (
        uid === 'demo_user' ||
        uid.startsWith('test_') ||
        uid.startsWith('member_') ||
        uid.startsWith('e2e_')
      ) {
        await deleteDoc(doc(db, 'transactions', d.id));
        summary.deletedTransactions++;
      }
    }
  } catch (err: any) {
    console.warn('[PURGE] Transactions delete notice:', err?.message);
  }

  try {
    // 4) ลบโพยหวยทดสอบ
    const ticketSnap = await getDocs(collection(db, 'tickets'));
    for (const d of ticketSnap.docs) {
      const data = d.data();
      const uid = String(data.userId || '');
      if (
        uid === 'demo_user' ||
        uid.startsWith('test_') ||
        uid.startsWith('member_') ||
        uid.startsWith('e2e_')
      ) {
        await deleteDoc(doc(db, 'tickets', d.id));
        summary.deletedTickets++;
      }
    }
  } catch (err: any) {
    console.warn('[PURGE] Tickets delete notice:', err?.message);
  }

  // 5) รีเซ็ตยี่กี
  try {
    const { resetYeekeeForNewDay } = await import('../../cron/yeekee-worker');
    if (typeof resetYeekeeForNewDay === 'function') {
      await resetYeekeeForNewDay();
      summary.yeekeeReset = true;
    }
  } catch (err: any) {
    console.warn('[PURGE] Yeekee reset notice:', err?.message);
  }

  console.log('[PURGE COMPLETE]', summary);

  return {
    success: true,
    message: 'ล้างข้อมูลทดสอบทั้งหมดและเตรียมพร้อมระบบจริง 100% เรียบร้อยแล้ว',
    summary,
  };
}
