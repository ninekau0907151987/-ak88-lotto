/**
 * src/shared/lib/yeekee.ts
 * ==================================================================
 * ระบบแกนกลางและสูตรคณิตศาสตร์ หวยจับยี่กี (88 รอบ/วัน ออกทุก 15 นาที)
 * ==================================================================
 * กติกามาตรฐานสากล:
 *   - วันละ 88 รอบ เริ่มรอบแรก 06:00 น. ปิดรับทุก 15 นาที รอบสุดท้าย 03:45 น.
 *   - สมาชิกยิงเลข 5 หลัก (00000 - 99999)
 *   - สูตรผลรางวัล: ผลรวมเลขยิงทั้งหมด (Sum) − เลขยิงลำดับที่ 16
 *   - การตัดรางวัล:
 *       • 3 ตัวบน: เลข 3 ตัวท้ายของผลลัพธ์
 *       • 2 ตัวบน: เลข 2 ตัวท้ายของ 3 ตัวบน
 *       • 2 ตัวล่าง: เลข 2 ตัวหน้าของ 5 ตัวท้าย (หรือหลักหมื่น-หลักพัน)
 *       • 3 ตัวโต๊ด: สลับตำแหน่งได้ทั้ง 6 รูปแบบ
 *       • วิ่งบน: เลขตรงตัวใดตัวหนึ่งใน 3 ตัวบน
 *       • วิ่งล่าง: เลขตรงตัวใดตัวหนึ่งใน 2 ตัวล่าง
 * ==================================================================
 */

export interface YeekeeShoot {
  id: string;
  roundId: number;
  userId: string;
  username: string;
  number: string; // 5 หลัก เช่น "45981"
  timestamp: number;
  isBot?: boolean;
}

export interface YeekeeRound {
  id: number; // รอบที่ 1 - 88
  dateStr: string; // YYYY-MM-DD
  openTime: string; // "06:00"
  closeTime: string; // "06:15"
  status: 'waiting' | 'open' | 'closed' | 'settled';
  totalShoots: number;
  sumShoots: number;
  subtractShoot?: string; // เลขลำดับที่ 16
  rawResult?: number; // ผลรวม - ลำดับที่ 16
  result3Top?: string; // 3 ตัวบน
  result2Top?: string; // 2 ตัวบน
  result2Bottom?: string; // 2 ตัวล่าง
  totalBets: number;
  totalPayout: number;
  netProfit: number;
  settledAt?: string;
  winnerShooter1?: { userId: string; username: string };
  winnerShooter16?: { userId: string; username: string };
}

export interface YeekeeConfig {
  enabled: boolean;
  roundsCount: number; // 88
  intervalMinutes: number; // 15
  startHour: number; // 6 (06:00)
  rewardShooter1: number; // เครดิตรางวัลคนยิงที่ 1 เช่น 200
  rewardShooter16: number; // เครดิตรางวัลคนยิงที่ 16 เช่น 400
  autoBotShooter: boolean; // เติมเลขยิงอัตโนมัติหากไม่ครบ 16
  profitMode: 'fair' | 'max_profit' | 'balance' | 'avoid'; // โหมดคุมผล
  payoutRates: Record<string, number>;
}

export const DEFAULT_YEEKEE_RATES: Record<string, number> = {
  '3 ตัวบน': 850,
  '3 ตัวโต๊ด': 120,
  '2 ตัวบน': 92,
  '2 ตัวล่าง': 92,
  'วิ่งบน': 3.2,
  'วิ่งล่าง': 4.2,
};

export const DEFAULT_YEEKEE_CONFIG: YeekeeConfig = {
  enabled: true,
  roundsCount: 88,
  intervalMinutes: 15,
  startHour: 6,
  rewardShooter1: 200,
  rewardShooter16: 400,
  autoBotShooter: true,
  profitMode: 'fair',
  payoutRates: { ...DEFAULT_YEEKEE_RATES },
};

/** สร้างตาราง 88 รอบมาตรฐานของวัน */
export function generateDailyRounds(dateStr: string = new Date().toISOString().slice(0, 10)): YeekeeRound[] {
  const rounds: YeekeeRound[] = [];
  const startMinutes = 6 * 60; // 06:00 น.

  for (let i = 1; i <= 88; i++) {
    const roundOpenMin = startMinutes + (i - 1) * 15;
    const roundCloseMin = roundOpenMin + 15;

    const openHour = Math.floor((roundOpenMin % 1440) / 60);
    const openMinute = roundOpenMin % 60;
    const closeHour = Math.floor((roundCloseMin % 1440) / 60);
    const closeMinute = roundCloseMin % 60;

    const openTime = `${String(openHour).padStart(2, '0')}:${String(openMinute).padStart(2, '0')}`;
    const closeTime = `${String(closeHour).padStart(2, '0')}:${String(closeMinute).padStart(2, '0')}`;

    rounds.push({
      id: i,
      dateStr,
      openTime,
      closeTime,
      status: 'waiting',
      totalShoots: 0,
      sumShoots: 0,
      totalBets: 0,
      totalPayout: 0,
      netProfit: 0,
    });
  }

  return rounds;
}

/** ตรวจสถานะของรอบตามเวลาปัจจุบันของเซิร์ฟเวอร์ */
export function determineRoundStatus(
  round: YeekeeRound,
  currentTime: Date = new Date()
): 'waiting' | 'open' | 'closed' | 'settled' {
  if (round.status === 'settled') return 'settled';

  const [cHour, cMin] = round.closeTime.split(':').map(Number);
  const [oHour, oMin] = round.openTime.split(':').map(Number);

  const curMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  let roundOpen = oHour * 60 + oMin;
  let roundClose = cHour * 60 + cMin;

  // รอบหลังเที่ยงคืน
  if (roundClose < roundOpen) roundClose += 1440;
  let adjustedCur = curMinutes;
  if (curMinutes < roundOpen && oHour >= 6 && currentTime.getHours() < 6) {
    adjustedCur += 1440;
  }

  if (adjustedCur < roundOpen) return 'waiting';
  if (adjustedCur >= roundOpen && adjustedCur < roundClose) return 'open';
  return 'closed';
}

/** คำนวณผลรางวัลยี่กีจากชุดเลขยิง (จัดเรียง 6 หลักเหมือนสลากกินแบ่งรัฐบาลไทย) */
export function computeYeekeeResult(shoots: string[]) {
  if (!shoots || shoots.length === 0) {
    return {
      sum: 0,
      subtractShoot: '00000',
      rawResult: 0,
      resultStr: '000000',
      result3Top: '000',
      result2Top: '00',
      result2Bottom: '00',
      result3Bottom: '000',
      result4Top: '0000',
      result5Top: '00000',
    };
  }

  // 1) หาผลรวมของเลขยิง 5 หลักทั้งหมด
  const sum = shoots.reduce((acc, s) => acc + (parseInt(s, 10) || 0), 0);

  // 2) ตัวลบคือลำดับที่ 18 (หากมีครบ >= 18 ลำดับ)
  // หากมีน้อยกว่า 18 ลำดับ (เช่น มีแค่ 3 คนยิง) ให้ใช้ผลรวมออกรางวัลตรงๆ
  let subtractShoot = '00000';
  let subtractVal = 0;
  if (shoots.length >= 18) {
    subtractShoot = shoots[17] || '00000';
    subtractVal = parseInt(subtractShoot, 10) || 0;
  }

  // 3) ผลลัพธ์ดิบ = ผลรวม - ตัวลบ (ถ้าไม่มีตัวลบ ผลลัพธ์ก็คือผลรวมตรงๆ)
  const rawResult = Math.abs(sum - subtractVal);
  // นำผลลัพธ์มาตัด 6 หลักท้ายสุด (หลักแสน หมื่น พัน ร้อย สิบ หน่วย) เสมือนสลากกินแบ่งรัฐบาลไทย
  const resultStr = String(rawResult % 1000000).padStart(6, '0');

  // 4) จัดเรียงรางวัลแบบสลากกินแบ่งรัฐบาลไทย (6 หลัก: d1=แสน, d2=หมื่น, d3=พัน, d4=ร้อย, d5=สิบ, d6=หน่วย)
  const result3Top = resultStr.slice(-3);       // ร้อย สิบ หน่วย (3 ตัวท้าย - รางวัลหลัก)
  const result2Top = resultStr.slice(-2);       // สิบ หน่วย (2 ตัวท้าย)
  const result2Bottom = resultStr.slice(-5, -3); // หมื่น พัน (2 ตัวหน้าของ 5 ตัวท้าย)
  const result3Bottom = resultStr.slice(0, 3);  // แสน หมื่น พัน (3 ตัวหน้า)
  const result4Top = resultStr.slice(-4);       // พัน ร้อย สิบ หน่วย (4 ตัวท้าย)
  const result5Top = resultStr.slice(-5);       // หมื่น พัน ร้อย สิบ หน่วย (5 ตัวท้าย)

  return {
    sum,
    subtractShoot,
    rawResult,
    resultStr,
    result3Top,
    result2Top,
    result2Bottom,
    result3Bottom,
    result4Top,
    result5Top,
  };
}

/** ตรวจสอบโพยหวยยี่กีว่าถูกรางวัลหรือไม่ */
export function evaluateYeekeeTicket(
  bets: Array<{ number: string; type: string; amount: number }>,
  results: { result3Top: string; result2Top: string; result2Bottom: string },
  rates: Record<string, number> = DEFAULT_YEEKEE_RATES
) {
  let totalWin = 0;
  const detailed = bets.map(b => {
    let isWin = false;
    const norm = (b.type || '').replace(/\s+/g, '');
    let payoutRate = rates[b.type] || rates[norm] || 0;

    if (norm === '3ตัวบน' || norm === 'three_top') {
      payoutRate = payoutRate || rates['3 ตัวบน'] || 850;
      isWin = b.number === results.result3Top;
    } else if (norm === '3ตัวโต๊ด') {
      payoutRate = payoutRate || rates['3 ตัวโต๊ด'] || 120;
      const sortedBet = b.number.split('').sort().join('');
      const sortedWin = results.result3Top.split('').sort().join('');
      isWin = sortedBet === sortedWin;
    } else if (norm === '2ตัวบน' || norm === 'two_top') {
      payoutRate = payoutRate || rates['2 ตัวบน'] || 92;
      isWin = b.number === results.result2Top;
    } else if (norm === '2ตัวล่าง' || norm === 'two_bottom') {
      payoutRate = payoutRate || rates['2 ตัวล่าง'] || 92;
      isWin = b.number === results.result2Bottom;
    } else if (norm === 'วิ่งบน') {
      payoutRate = payoutRate || rates['วิ่งบน'] || 3.2;
      isWin = results.result3Top.includes(b.number);
    } else if (norm === 'วิ่งล่าง') {
      payoutRate = payoutRate || rates['วิ่งล่าง'] || 4.2;
      isWin = results.result2Bottom.includes(b.number);
    } else {
      isWin = false;
    }

    const winAmount = isWin ? Math.round(b.amount * payoutRate) : 0;
    totalWin += winAmount;

    return {
      ...b,
      isWin,
      payoutRate,
      winAmount,
    };
  });

  return {
    isWinner: totalWin > 0,
    totalWin,
    bets: detailed,
  };
}

/** บอทจำลองการยิงเลขเติมให้ครบ 16 ลำดับ */
export function generateBotShoots(neededCount: number): string[] {
  const bots: string[] = [];
  for (let i = 0; i < neededCount; i++) {
    const num = Math.floor(Math.random() * 90000 + 10000);
    bots.push(String(num));
  }
  return bots;
}
