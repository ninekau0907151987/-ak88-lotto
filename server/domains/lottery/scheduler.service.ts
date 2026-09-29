/**
 * server/domains/lottery/scheduler.service.ts
 * ------------------------------------------------------------------
 * บริการตั้งเวลารอบหวยพร้อมระบบความปลอดภัย Strict Sequential Guard & Calendar
 * 1) ตั้งเวลาเปิด-ปิดรอบการเดิมพันล่วงหน้าสูงสุด 5 รายการ
 * 2) Strict Sequential Guard: รอบถัดไปจะเริ่มทำงานได้ก็ต่อเมื่อรอบก่อนหน้าออกผลเสร็จสมบูรณ์แล้วเท่านั้น
 * 3) แสดงผลข้อมูลรอบบนปฏิทิน (Calendar) พร้อมระบบสี 4 สถานะ
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';

export interface RoundScheduleItem {
  roundNumber: number | string;
  lotteryType: string;
  openTime: string;    // ISO string or YYYY-MM-DD HH:mm:ss
  closeTime: string;
  resultTime?: string;
}

export const ROUND_COLOR_MAP = {
  active:         { color: '#28a745', badge: 'badge-success', label: 'กำลังเปิดรับแทง' },
  pending_result: { color: '#ffc107', badge: 'badge-warning', label: 'ปิดรับแทง-รอออกผล' },
  resulted:       { color: '#17a2b8', badge: 'badge-info',    label: 'ออกผลรางวัลแล้ว' },
  closed:         { color: '#6c757d', badge: 'badge-secondary', label: 'ปิดรอบแล้ว' },
} as const;

/**
 * ตรวจสอบความปลอดภัย Sequential Guard ก่อนเปิดรอบหวย
 * กฎ: รอบใหม่จะเปิดรับแทง (active / open) ได้ ก็ต่อเมื่อรอบก่อนหน้ามีสถานะ 'resulted' เท่านั้น
 */
export async function verifySequentialRoundGuard(db: any, lotteryType: string, newRoundNumber: number | string): Promise<{ canOpen: boolean; reason?: string; lastRound?: any }> {
  if (!db) return { canOpen: true };

  try {
    const roundsCol = collection(db, 'lotteryRounds');
    const q = query(
      roundsCol,
      where('lotteryType', '==', lotteryType),
      orderBy('roundNumber', 'desc'),
      limit(2)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return { canOpen: true };
    }

    const rounds = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    const previousRound = rounds.find(r => String(r.roundNumber) !== String(newRoundNumber));

    if (!previousRound) {
      return { canOpen: true };
    }

    // ถ้ารอบก่อนหน้ายังไม่ออกผล (ไม่ใช่ 'resulted' หรือ 'cancelled')
    const prevStatus = previousRound.status || 'open';
    if (prevStatus !== 'resulted' && prevStatus !== 'cancelled') {
      return {
        canOpen: false,
        lastRound: previousRound,
        reason: `รอบก่อนหน้า (รอบที่ ${previousRound.roundNumber}) ยังมีสถานะ "${previousRound.status || 'ยังไม่ออกผล'}" ระบบความปลอดภัย Strict Sequential Guard ไม่อนุญาตให้เปิดรับแทงรอบถัดไปจนกว่าจะออกผลเสร็จสมบูรณ์`,
      };
    }

    return { canOpen: true, lastRound: previousRound };
  } catch (e) {
    console.warn('[SchedulerGuard] verify error:', (e as Error).message);
    return { canOpen: true };
  }
}

/**
 * ตั้งเวลาเปิด-ปิดรอบการเดิมพันล่วงหน้า (รองรับสูงสุด 5 รายการ)
 */
export async function scheduleRoundsBatch(db: any, lotteryType: string, roundsList: RoundScheduleItem[]) {
  if (!Array.isArray(roundsList) || roundsList.length === 0) {
    throw new Error('ต้องระบุรายการรอบที่ต้องการตั้งเวลาอย่างน้อย 1 รายการ');
  }

  if (roundsList.length > 5) {
    throw new Error('ระบบอนุญาตให้ตั้งค่ารอบล่วงหน้าได้สูงสุด 5 รายการต่อครั้งเท่านั้น');
  }

  // ตรวจสอบจำนวนรอบที่รอคิวอยู่ปัจจุบัน
  let existingQueuedCount = 0;
  if (db) {
    try {
      const q = query(
        collection(db, 'lotteryRounds'),
        where('lotteryType', '==', lotteryType),
        where('status', 'in', ['scheduled', 'open'])
      );
      const snap = await getDocs(q);
      existingQueuedCount = snap.size;
    } catch (e) {
      console.warn('[SchedulerService] count error:', (e as Error).message);
    }
  }

  if (existingQueuedCount + roundsList.length > 5) {
    throw new Error(`ไม่สามารถเพิ่มได้ เนื่องจากมีรอบรอคิวอยู่แล้ว ${existingQueuedCount} รายการ (รวมกันต้องไม่เกิน 5 รายการ)`);
  }

  const createdRounds = [];
  const now = new Date();

  for (const item of roundsList) {
    const roundNumber = item.roundNumber;
    const openDate = new Date(item.openTime);
    const closeDate = new Date(item.closeTime);

    // ตรวจสอบความถูกต้องของเวลา
    if (closeDate <= openDate) {
      throw new Error(`รอบที่ ${roundNumber}: เวลาปิดรับแทงต้องอยู่หลังเวลาเปิดรับแทง`);
    }

    // ตรวจสอบ Sequential Guard ถ้ารอบนี้มีเวลาเริ่มทันที
    const willOpenNow = openDate <= now && closeDate > now;
    let initialStatus = 'scheduled';

    if (willOpenNow) {
      const guard = await verifySequentialRoundGuard(db, lotteryType, roundNumber);
      if (!guard.canOpen) {
        // ให้บันทึกเป็นคิวล่วงหน้า (scheduled) พร้อมบันทึก warning
        initialStatus = 'scheduled';
      } else {
        initialStatus = 'open';
      }
    }

    const payload = {
      lotteryType,
      roundNumber,
      openTime: item.openTime,
      closeTime: item.closeTime,
      resultTime: item.resultTime || null,
      status: initialStatus,
      createdAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
    };

    let id = `round_${lotteryType}_${roundNumber}`;
    if (db) {
      const ref = await addDoc(collection(db, 'lotteryRounds'), payload);
      id = ref.id;
    }

    createdRounds.push({ id, ...payload });
  }

  return {
    status: 'success',
    message: `ตั้งเวลารอบหวยล่วงหน้า ${createdRounds.length} รายการสำเร็จ`,
    lotteryType,
    count: createdRounds.length,
    rounds: createdRounds,
  };
}

/**
 * ดึงข้อมูลรอบหวยสำหรับแสดงผลบนปฏิทิน พร้อมระบบรหัสสี 4 สถานะ
 */
export async function getRoundsCalendar(db: any, lotteryType?: string) {
  let list: any[] = [];
  if (db) {
    try {
      const col = collection(db, 'lotteryRounds');
      const q = lotteryType ? query(col, where('lotteryType', '==', lotteryType)) : col;
      const snap = await getDocs(q);
      list = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    } catch (e) {
      console.warn('[SchedulerCalendar] get calendar err:', (e as Error).message);
    }
  }

  const now = new Date();

  // ประมวลผลสถานะและระบบสี
  const calendarEvents = list.map(r => {
    const openDate = r.openTime ? new Date(r.openTime) : null;
    const closeDate = r.closeTime ? new Date(r.closeTime) : null;
    const resultDate = r.resultTime ? new Date(r.resultTime) : null;

    let computedStatus = r.status || 'scheduled';
    if (computedStatus === 'open' || computedStatus === 'active') {
      if (closeDate && now > closeDate) {
        computedStatus = 'pending_result';
      }
    }

    if (r.result || r.firstPrize || r.numbers) {
      computedStatus = 'resulted';
    }

    const colorInfo = ROUND_COLOR_MAP[computedStatus as keyof typeof ROUND_COLOR_MAP] || ROUND_COLOR_MAP.closed;

    return {
      id: r.id,
      lotteryType: r.lotteryType,
      roundNumber: r.roundNumber,
      title: `${r.lotteryType} รอบ ${r.roundNumber}`,
      start: r.openTime,
      end: r.closeTime,
      resultTime: r.resultTime,
      status: computedStatus,
      statusLabel: colorInfo.label,
      color: colorInfo.color,
      badgeClass: colorInfo.badge,
      result: r.result || null,
    };
  });

  // จัดกลุ่มตามวัน
  const groupedByDate: Record<string, any[]> = {};
  calendarEvents.forEach(evt => {
    const dateKey = evt.start ? evt.start.split('T')[0] : 'undated';
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(evt);
  });

  return {
    status: 'success',
    totalRounds: calendarEvents.length,
    colorLegend: ROUND_COLOR_MAP,
    events: calendarEvents,
    groupedByDate,
  };
}
