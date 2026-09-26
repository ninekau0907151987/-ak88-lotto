/**
 * src/shared/lib/game20Report.ts
 * ------------------------------------------------------------------
 * ★ B3: รายงานกำไร-ขาดทุน หวย 20 ช่อง 6 หลัก ★
 *
 * ผู้ใช้ขอ: "รายงานหลังบ้าน — กราฟกำไร-ขาดทุนรายวัน/รายเดือน"
 *
 * ภาพรวม:
 *   - สรุปรายรอบ (รับ / จ่าย / กำไร / margin%)
 *   - สรุปรายวัน (รวมหลายรอบ)
 *   - สรุปรายเดือน
 *   - กราฟ SVG (ไม่ต้องลงไลบรารีเพิ่ม)
 *   - อันดับเลขที่ทำกำไร/ขาดทุนมากสุด
 */

/** ข้อมูลรอบหนึ่งรอบ (ป้อนเข้ามา) */
export interface RoundRecord {
  roundId: string;
  /** ISO date string */
  closedAt: string;
  /** ยอดรับแทงรวม */
  totalBet: number;
  /** ยอดจ่ายจริง */
  totalPayout: number;
  /** จำนวนโพย */
  ticketCount: number;
  /** จำนวนผู้เล่น */
  playerCount: number;
  /** ผลที่ออก */
  result?: string;
}

export interface RoundSummary extends RoundRecord {
  /** กำไร = รับ − จ่าย */
  profit: number;
  /** อัตรากำไร % = กำไร / รับ × 100 */
  marginPercent: number;
  /** ค่าเฉลี่ยต่อโพย */
  avgPerTicket: number;
  /** สถานะ */
  status: 'profit' | 'loss' | 'even';
}

export interface DaySummary {
  /** YYYY-MM-DD */
  date: string;
  roundCount: number;
  totalBet: number;
  totalPayout: number;
  profit: number;
  marginPercent: number;
  ticketCount: number;
  playerCount: number;
}

export interface MonthSummary {
  /** YYYY-MM */
  month: string;
  dayCount: number;
  roundCount: number;
  totalBet: number;
  totalPayout: number;
  profit: number;
  marginPercent: number;
}

/* ══════════════════════════════════════════════════════════
 * 1. สรุปรายรอบ
 * ══════════════════════════════════════════════════════════ */

export function summarizeRound(r: RoundRecord): RoundSummary {
  const profit = r.totalBet - r.totalPayout;
  const marginPercent = r.totalBet > 0 ? (profit / r.totalBet) * 100 : 0;
  return {
    ...r,
    profit,
    marginPercent: Math.round(marginPercent * 100) / 100,
    avgPerTicket: r.ticketCount > 0 ? r.totalBet / r.ticketCount : 0,
    status: profit > 0 ? 'profit' : profit < 0 ? 'loss' : 'even',
  };
}

/* ══════════════════════════════════════════════════════════
 * 2. จัดกลุ่มตามวัน
 * ══════════════════════════════════════════════════════════ */

/** ตัดเวลาออก เหลือ YYYY-MM-DD (รองรับ ISO) */
export function dayKey(iso: string): string {
  const d = String(iso || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  try { return new Date(d).toISOString().slice(0, 10); } catch { return 'ไม่ทราบ'; }
}

/** ตัดเดือน เหลือ YYYY-MM */
export function monthKey(iso: string): string {
  return dayKey(iso).slice(0, 7);
}

export function groupByDay(rounds: RoundRecord[]): DaySummary[] {
  const map = new Map<string, DaySummary>();

  for (const r0 of rounds) {
    const r = summarizeRound(r0);
    const k = dayKey(r.closedAt);
    const cur = map.get(k) || {
      date: k, roundCount: 0, totalBet: 0, totalPayout: 0,
      profit: 0, marginPercent: 0, ticketCount: 0, playerCount: 0,
    };
    cur.roundCount += 1;
    cur.totalBet += r.totalBet;
    cur.totalPayout += r.totalPayout;
    cur.ticketCount += r.ticketCount;
    cur.playerCount += r.playerCount;
    map.set(k, cur);
  }

  return Array.from(map.values())
    .map(d => ({
      ...d,
      profit: d.totalBet - d.totalPayout,
      marginPercent: d.totalBet > 0
        ? Math.round(((d.totalBet - d.totalPayout) / d.totalBet) * 10000) / 100
        : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function groupByMonth(rounds: RoundRecord[]): MonthSummary[] {
  const map = new Map<string, MonthSummary & { _days: Set<string> }>();

  for (const r0 of rounds) {
    const r = summarizeRound(r0);
    const k = monthKey(r.closedAt);
    const cur = map.get(k) || {
      month: k, dayCount: 0, roundCount: 0, totalBet: 0, totalPayout: 0,
      profit: 0, marginPercent: 0, _days: new Set<string>(),
    };
    cur.roundCount += 1;
    cur.totalBet += r.totalBet;
    cur.totalPayout += r.totalPayout;
    cur._days.add(dayKey(r.closedAt));
    map.set(k, cur);
  }

  return Array.from(map.values())
    .map(m => ({
      month: m.month,
      dayCount: m._days.size,
      roundCount: m.roundCount,
      totalBet: m.totalBet,
      totalPayout: m.totalPayout,
      profit: m.totalBet - m.totalPayout,
      marginPercent: m.totalBet > 0
        ? Math.round(((m.totalBet - m.totalPayout) / m.totalBet) * 10000) / 100
        : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/* ══════════════════════════════════════════════════════════
 * 3. สรุปภาพรวมช่วงเวลา
 * ══════════════════════════════════════════════════════════ */

export interface OverallSummary {
  roundCount: number;
  totalBet: number;
  totalPayout: number;
  profit: number;
  marginPercent: number;
  /** รอบที่กำไร */
  profitRounds: number;
  /** รอบที่ขาดทุน */
  lossRounds: number;
  /** อัตราชนะ (รอบกำไร / ทั้งหมด) % */
  winRate: number;
  /** รอบกำไรสูงสุด */
  bestRound: RoundSummary | null;
  /** รอบขาดทุนหนักสุด */
  worstRound: RoundSummary | null;
  avgBetPerRound: number;
  avgProfitPerRound: number;
}

export function summarizeOverall(rounds: RoundRecord[]): OverallSummary {
  if (!rounds.length) {
    return {
      roundCount: 0, totalBet: 0, totalPayout: 0, profit: 0, marginPercent: 0,
      profitRounds: 0, lossRounds: 0, winRate: 0, bestRound: null, worstRound: null,
      avgBetPerRound: 0, avgProfitPerRound: 0,
    };
  }

  const sums = rounds.map(summarizeRound);
  const totalBet = sums.reduce((a, r) => a + r.totalBet, 0);
  const totalPayout = sums.reduce((a, r) => a + r.totalPayout, 0);
  const profit = totalBet - totalPayout;
  const profitRounds = sums.filter(r => r.profit > 0).length;
  const lossRounds = sums.filter(r => r.profit < 0).length;

  let bestRound: RoundSummary | null = null;
  let worstRound: RoundSummary | null = null;
  for (const r of sums) {
    if (!bestRound || r.profit > bestRound.profit) bestRound = r;
    if (!worstRound || r.profit < worstRound.profit) worstRound = r;
  }

  return {
    roundCount: sums.length,
    totalBet,
    totalPayout,
    profit,
    marginPercent: totalBet > 0 ? Math.round((profit / totalBet) * 10000) / 100 : 0,
    profitRounds,
    lossRounds,
    winRate: Math.round((profitRounds / sums.length) * 10000) / 100,
    bestRound,
    worstRound,
    avgBetPerRound: Math.round(totalBet / sums.length),
    avgProfitPerRound: Math.round(profit / sums.length),
  };
}

/* ══════════════════════════════════════════════════════════
 * 4. อันดับเลขที่ทำกำไร/ขาดทุน
 * ══════════════════════════════════════════════════════════ */

export interface NumberPerformance {
  kind: string;
  number: string;
  accepted: number;
  payout: number;
  profit: number;
  hitCount: number;
}

export function rankNumbers(
  bets: Array<{ type: string; number: string; amount: number; rate?: number; won?: boolean }>,
): { best: NumberPerformance[]; worst: NumberPerformance[] } {
  const map = new Map<string, NumberPerformance>();

  for (const b of bets) {
    const num = String(b.number || '').replace(/\D/g, '');
    const rate = Number(b.rate) || 0;
    const amount = Number(b.amount) || 0;
    const key = `${b.type}|${num}`;
    const cur = map.get(key) || { kind: b.type, number: num, accepted: 0, payout: 0, profit: 0, hitCount: 0 };
    cur.accepted += amount;
    if (b.won) { cur.payout += Math.floor(amount * rate); cur.hitCount += 1; }
    cur.profit = cur.accepted - cur.payout;
    map.set(key, cur);
  }

  const all = Array.from(map.values());
  return {
    best: [...all].sort((a, b) => b.profit - a.profit).slice(0, 10),
    worst: [...all].sort((a, b) => a.profit - b.profit).slice(0, 10),
  };
}

/* ══════════════════════════════════════════════════════════
 * 5. กราฟ SVG (ไม่ต้องลงไลบรารี)
 * ══════════════════════════════════════════════════════════ */

export interface ChartPoint {
  label: string;
  value: number;
}

/**
 * สร้างเส้น graph กำไร-ขาดทุน
 * @param points จุดข้อมูล
 * @param width ความกว้าง
 * @param height ความสูง
 */
export function buildLineChart(
  points: ChartPoint[],
  width = 640,
  height = 200,
): {
  path: string;
  areaPath: string;
  zeroY: number | null;
  min: number;
  max: number;
  points: Array<ChartPoint & { x: number; y: number }>;
  gridY: Array<{ y: number; value: number }>;
} {
  const padL = 52, padR = 12, padT = 14, padB = 26;
  const w = Math.max(100, width - padL - padR);
  const h = Math.max(60, height - padT - padB);

  if (!points.length) {
    return { path: '', areaPath: '', zeroY: null, min: 0, max: 0, points: [], gridY: [] };
  }

  const vals = points.map(p => p.value);
  const dataMin = Math.min(...vals);
  const dataMax = Math.max(...vals);
  // ★ ต้องรู้ว่าข้อมูลจริงมีค่าติดลบ/บวกไหม ก่อนยืดช่วงให้รวม 0
  const hasNeg = dataMin < 0;
  const hasPos = dataMax > 0;

  let min = Math.min(dataMin, 0);
  let max = Math.max(dataMax, 0);
  if (min === max) { max = min + 1; }
  const range = max - min;

  const xAt = (i: number) => padL + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const yAt = (v: number) => padT + h - ((v - min) / range) * h;

  const pts = points.map((p, i) => ({ ...p, x: Math.round(xAt(i) * 100) / 100, y: Math.round(yAt(p.value) * 100) / 100 }));

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    `M ${pts[0].x} ${padT + h} ` +
    pts.map(p => `L ${p.x} ${p.y}`).join(' ') +
    ` L ${pts[pts.length - 1].x} ${padT + h} Z`;

  // ★ เส้นศูนย์มีเฉพาะเมื่อ "ข้อมูลจริง" คร่อมศูนย์ (มีทั้งบวกและลบ)
  const zeroY = hasNeg && hasPos ? Math.round(yAt(0) * 100) / 100 : null;

  // เส้นกริด 5 เส้น
  const gridY: Array<{ y: number; value: number }> = [];
  for (let i = 0; i <= 4; i++) {
    const v = min + (range * i) / 4;
    gridY.push({ y: Math.round(yAt(v) * 100) / 100, value: Math.round(v) });
  }

  return { path, areaPath, zeroY, min, max, points: pts, gridY };
}

/** กราฟแท่ง รับ/จ่าย คู่กัน */
export function buildBarChart(
  data: Array<{ label: string; bet: number; payout: number }>,
  width = 640,
  height = 200,
): Array<{ x: number; y: number; w: number; hBet: number; hPayout: number; label: string }> {
  const padL = 52, padR = 12, padT = 14, padB = 26;
  const w = Math.max(100, width - padL - padR);
  const h = Math.max(60, height - padT - padB);
  if (!data.length) return [];

  const maxVal = Math.max(...data.flatMap(d => [d.bet, d.payout]), 1);
  const slot = w / data.length;
  const barW = Math.max(4, (slot - 6) / 2);

  return data.map((d, i) => {
    const x = padL + i * slot + 3;
    return {
      x: Math.round(x * 100) / 100,
      y: padT,
      w: Math.round(barW * 100) / 100,
      hBet: Math.round(((d.bet / maxVal) * h) * 100) / 100,
      hPayout: Math.round(((d.payout / maxVal) * h) * 100) / 100,
      label: d.label,
    };
  });
}

/* ══════════════════════════════════════════════════════════
 * 6. ตัวช่วยรูปแบบ
 * ══════════════════════════════════════════════════════════ */

/** แปลง YYYY-MM-DD → วันที่ไทยสั้น */
export function formatThaiDate(key: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return key;
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]}`;
}

/** แปลง YYYY-MM → เดือนไทย */
export function formatThaiMonth(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key;
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${months[Number(m[2]) - 1]} ${String(Number(m[1]) + 543).slice(-2)}`;
}

/** สีตามผลกำไร */
export function profitColor(v: number): string {
  if (v > 0) return '#059669';
  if (v < 0) return '#dc2626';
  return '#6b7280';
}

/** สร้างข้อมูลตัวอย่างสำหรับทดสอบ/ดูภาพ */
export function sampleRounds(days = 14, perDay = 6, seed = 42): RoundRecord[] {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

  const out: RoundRecord[] = [];
  const today = new Date('2026-09-26T00:00:00Z');

  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(today.getTime() - d * 86400000);
    const dateStr = day.toISOString().slice(0, 10);
    for (let i = 0; i < perDay; i++) {
      const totalBet = Math.floor(8000 + rnd() * 45000);
      // ส่วนใหญ่เจ้ามือได้เปรียบ (margin ~20%) แต่มีรอบที่ขาดทุน
      const isLoss = rnd() < 0.22;
      const payout = isLoss
        ? Math.floor(totalBet * (1 + rnd() * 0.8))
        : Math.floor(totalBet * (0.45 + rnd() * 0.45));
      out.push({
        roundId: `${dateStr}-${String(i + 1).padStart(2, '0')}`,
        closedAt: `${dateStr}T${String(9 + i * 2).padStart(2, '0')}:30:00Z`,
        totalBet,
        totalPayout: payout,
        ticketCount: Math.floor(3 + rnd() * 40),
        playerCount: Math.floor(2 + rnd() * 18),
        result: String(Math.floor(rnd() * 1000000)).padStart(6, '0'),
      });
    }
  }
  return out;
}
