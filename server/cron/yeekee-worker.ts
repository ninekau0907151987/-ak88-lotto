/**
 * server/cron/yeekee-worker.ts
 * ==================================================================
 * ระบบออกผลหวยยี่กี 88 รอบอัตโนมัติตลอด 24 ชั่วโมง (Automated Engine Worker)
 * ==================================================================
 * ทำงานเบื้องหลัง:
 *  1. ตรวจสอบเวลาปัจจุบันตามเวลาประเทศไทย (UTC+7)
 *  2. เมื่อถึงเวลาปิดรับแทงของรอบ (ทุก 15 นาที):
 *     - ปิดรับแทงรอบนั้นทันที
 *     - ถ้าคนยิงเลขยังไม่ครบ 16 ลำดับ ระบบจะสั่งบอทยิงเลขให้ครบ 16 ทันที
 *     - คำนวณผลรางวัล (ผลรวมลบเลขลำดับที่ 16)
 *     - แจกรางวัลคนยิงเลข (ลำดับ 1: 200฿, ลำดับ 16: 400฿) เข้ากระเป๋าเงินจริง
 *     - ตรวจโพยแทงหวยและโอนเงินรางวัลให้สมาชิกที่ถูกรางวัลอัตโนมัติ
 *     - เปิดรับแทงรอบถัดไปทันที
 */

import { YeekeeService } from '../domains/yeekee/yeekee.service';
import { YeekeeRound } from '../../src/shared/lib/yeekee';

function getBangkokDateStr(): string {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const bangkok = new Date(utc + (3600000 * 7));
  return bangkok.toISOString().slice(0, 10);
}

export class YeekeeWorker {
  private db: any;
  private service: YeekeeService;
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private enabled = true;

  constructor(db: any) {
    this.db = db;
    this.service = new YeekeeService(db);
  }

  /** เริ่มต้นการทำงานของ Worker */
  public start(intervalMs = 20000) {
    if (this.timer) return;
    console.log('[YeekeeWorker] เริ่มต้นระบบออกผลหวยยี่กีอัตโนมัติ 88 รอบ (ทำงานทุก ' + (intervalMs / 1000) + ' วินาที)');
    
    // รันครั้งแรกทันที
    this.tick().catch(err => console.error('[YeekeeWorker] Tick error:', err));

    // รันต่อเนื่องตามรอบเวลา
    this.timer = setInterval(() => {
      this.tick().catch(err => console.error('[YeekeeWorker] Tick error:', err));
    }, intervalMs);
  }

  /** หยุดการทำงาน */
  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[YeekeeWorker] หยุดระบบออกผลหวยยี่กีอัตโนมัติ');
    }
  }

  public setEnabled(enable: boolean) {
    this.enabled = enable;
    console.log(`[YeekeeWorker] โหมดอัตโนมัติถูกเปลี่ยนเป็น: ${enable ? 'เปิด (Auto)' : 'ปิด (Manual)'}`);
  }

  public isAutoEnabled() {
    return this.enabled;
  }

  /** รอบการทำงานทุก Tick */
  private async tick() {
    if (!this.enabled || this.isProcessing) return;
    this.isProcessing = true;

    try {
      const today = getBangkokDateStr();
      const now = new Date();
      // แปลงเป็นเวลาไทย HH:mm
      const thaiTimeStr = now.toLocaleTimeString('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });

      const config = await this.service.getConfig();
      if (!config.enabled) return;

      const rounds = await this.service.getRounds(today);

      for (const round of rounds) {
        // ตรวจสอบรอบที่เปิดรับแทงอยู่
        if (round.status === 'open') {
          // ถ้าเวลาปัจจุบัน >= เวลาปิดรับแทงของรอบนี้
          if (this.isTimeToClose(thaiTimeStr, round.closeTime)) {
            console.log(`[YeekeeWorker] ⚡ ถึงเวลาปิดรอบที่ ${round.id} (${round.closeTime}) ปัจจุบัน: ${thaiTimeStr}`);

            // 1. ปิดรับแทงรอบนี้
            await this.service.setRoundStatus(round.id, 'closed', today);

            // 2. ตรวจสอบจำนวนคนยิงเลข ถ้าไม่ถึง 16 ให้บอทยิงเติมให้ครบ 16
            const shoots = await this.service.getShoots(round.id, today);
            if (shoots.length < 16) {
              const need = 16 - shoots.length;
              console.log(`[YeekeeWorker] ยิงเลขยังไม่ครบ 16 (มี ${shoots.length}) กำลังสั่งบอทยิงเพิ่ม ${need} ลำดับ...`);
              await this.service.triggerBotShoots(round.id, need, today);
            }

            // 3. สั่งคำนวณผลรางวัลและจ่ายเงิน
            console.log(`[YeekeeWorker] กำลังออกผลรางวัลและตรวจโพยรอบที่ ${round.id}...`);
            const settled = await this.service.settleRound(round.id, undefined, today);
            console.log(`[YeekeeWorker] ✅ ออกผลรอบที่ ${round.id} สำเร็จ! 3บน=${settled.result3Top}, 2ล่าง=${settled.result2Bottom}, จ่ายรางวัลรวม: ฿${settled.totalPayout.toLocaleString()}`);

            // 4. เปิดรับแทงรอบถัดไป
            const nextRound = rounds.find(r => r.id === round.id + 1);
            if (nextRound && nextRound.status === 'upcoming') {
              console.log(`[YeekeeWorker] 🚀 เปิดรับแทงรอบที่ ${nextRound.id} (${nextRound.closeTime}) เรียบร้อยแล้ว`);
              await this.service.setRoundStatus(nextRound.id, 'open', today);
            }
          }
        }
      }
    } catch (e: any) {
      console.error('[YeekeeWorker] การประมวลผลอัตโนมัติขัดข้อง:', e.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /** เช็คว่าถึงเวลาหรือเกินเวลาปิดรับแทงหรือยัง */
  private isTimeToClose(currentTime: string, closeTime: string): boolean {
    const [cHour, cMin] = currentTime.split(':').map(Number);
    const [rHour, rMin] = closeTime.split(':').map(Number);

    const currentTotalMin = cHour * 60 + cMin;
    const closeTotalMin = rHour * 60 + rMin;

    // รองรับกรณีข้ามเที่ยงคืน (00:00 - 03:45)
    return currentTotalMin >= closeTotalMin;
  }
}
