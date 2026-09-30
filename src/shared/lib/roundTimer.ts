/**
 * src/shared/lib/roundTimer.ts
 * ------------------------------------------------------------------
 * ยูทิลิตี้คำนวณเวลานับถอยหลังและสถานะสีของรอบหวย (Real-time Round Countdown)
 *
 * 3 สถานะหลักตามโจทย์:
 * 1. ⏳ เวลานับถอยหลังจะเปิด (Waiting to Open)
 * 2. 🟢 เวลาเปิด นับถอยหลังจะปิด (Open / In-Betting)
 * 3. 🟠 ทำสี รอออกผล (Closed / Waiting for Result)
 */

import { useState, useEffect } from 'react';

export type RoundPhase = 'upcoming' | 'open' | 'waiting_result' | 'resulted' | 'closed';

export interface RoundTimerState {
  phase: RoundPhase;
  label: string;
  badgeClass: string;
  boxClass: string;
  borderClass: string;
  countdownText: string;
  remainingMs: number;
  isOpenNow: boolean;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days} วัน ${pad(remHours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function calculateRoundTimer(
  openTime?: string | null,
  closeTime?: string | null,
  resultTime?: string | null,
  explicitStatus?: string | null
): RoundTimerState {
  const now = Date.now();
  const tOpen = openTime ? new Date(openTime).getTime() : 0;
  const tClose = closeTime ? new Date(closeTime).getTime() : 0;
  const tResult = resultTime ? new Date(resultTime).getTime() : 0;

  // 1. สถานะออกผลแล้ว
  if (explicitStatus === 'resulted') {
    return {
      phase: 'resulted',
      label: 'ออกผลแล้ว',
      badgeClass: 'bg-emerald-600 text-white border-emerald-700',
      boxClass: 'bg-emerald-50 text-emerald-950 border-emerald-300',
      borderClass: 'border-emerald-400',
      countdownText: 'ออกผลรางวัลเรียบร้อยแล้ว',
      remainingMs: 0,
      isOpenNow: false,
    };
  }

  // 2. เวลานับถอยหลังจะเปิด (Waiting to open)
  if (tOpen > 0 && now < tOpen) {
    const diff = tOpen - now;
    return {
      phase: 'upcoming',
      label: '⏳ รอเปิดรับแทง',
      badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
      boxClass: 'bg-sky-50 text-sky-950 border-sky-200',
      borderClass: 'border-sky-300',
      countdownText: `จะเปิดรับแทงในอีก ${formatDuration(diff)}`,
      remainingMs: diff,
      isOpenNow: false,
    };
  }

  // 3. กำลังเปิดรับแทง (Open / นับถอยหลังเวลาปิด)
  // เงื่อนไข: ถ้าเลย openTime และยังไม่ถึง closeTime (หรือถ้าไม่มี openTime แต่ยังไม่ถึง closeTime และ explicitStatus !== 'closed')
  const isOpen = (tClose > 0 && now < tClose) && (tOpen === 0 || now >= tOpen) && explicitStatus !== 'closed';
  if (isOpen) {
    const diff = tClose - now;
    return {
      phase: 'open',
      label: '🟢 กำลังเปิดรับแทง',
      badgeClass: 'bg-emerald-500 text-white border-emerald-600 shadow-sm animate-pulse',
      boxClass: 'bg-emerald-50 text-emerald-950 border-emerald-300',
      borderClass: 'border-emerald-400',
      countdownText: `ปิดรับแทงในอีก ${formatDuration(diff)}`,
      remainingMs: diff,
      isOpenNow: true,
    };
  }

  // 4. ทำสี รอออกผล (Waiting for Result)
  // เงื่อนไข: ปิดรับแทงแล้ว (now >= tClose หรือ explicitStatus === 'pending_result' / 'closed') และยังไม่ออกผล
  const isWaitingResult = (tClose > 0 && now >= tClose) || explicitStatus === 'pending_result' || explicitStatus === 'closed';
  if (isWaitingResult) {
    const diffResult = tResult > 0 ? tResult - now : 0;
    const resultCountdown = diffResult > 0
      ? `รอออกผลรางวัลในอีก ${formatDuration(diffResult)}`
      : 'ปิดรับแทงแล้ว • รอผลการออกรางวัล';

    return {
      phase: 'waiting_result',
      label: '🟠 รอออกผล',
      badgeClass: 'bg-amber-500 text-white border-amber-600 shadow-md font-bold',
      boxClass: 'bg-amber-50 text-amber-950 border-amber-400 shadow-sm',
      borderClass: 'border-amber-400',
      countdownText: resultCountdown,
      remainingMs: Math.max(0, diffResult),
      isOpenNow: false,
    };
  }

  // 5. ค่าเริ่มต้นถ้าไม่มีข้อมูลเวลา
  return {
    phase: 'closed',
    label: 'ปิดรับแทง',
    badgeClass: 'bg-slate-200 text-slate-800 border-slate-300',
    boxClass: 'bg-slate-50 text-slate-800 border-slate-200',
    borderClass: 'border-slate-300',
    countdownText: 'รอบนี้ปิดรับแทงแล้ว',
    remainingMs: 0,
    isOpenNow: false,
  };
}

/**
 * Hook สำหรับนับถอยหลัง Real-time ทุก 1 วินาที
 */
export function useRoundCountdown(
  openTime?: string | null,
  closeTime?: string | null,
  resultTime?: string | null,
  explicitStatus?: string | null
): RoundTimerState {
  const [timerState, setTimerState] = useState<RoundTimerState>(() =>
    calculateRoundTimer(openTime, closeTime, resultTime, explicitStatus)
  );

  useEffect(() => {
    // อัปเดตทันที
    setTimerState(calculateRoundTimer(openTime, closeTime, resultTime, explicitStatus));

    // นับถอยหลังทุก 1 วินาที
    const timer = setInterval(() => {
      setTimerState(calculateRoundTimer(openTime, closeTime, resultTime, explicitStatus));
    }, 1000);

    return () => clearInterval(timer);
  }, [openTime, closeTime, resultTime, explicitStatus]);

  return timerState;
}
