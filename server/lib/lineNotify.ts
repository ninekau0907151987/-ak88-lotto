/**
 * server/lib/lineNotify.ts
 * ------------------------------------------------------------------
 * ★ B4: แจ้งเตือน LINE (LINE Messaging API + LINE Notify) ★
 *
 * รองรับ 2 ทาง:
 *   1. LINE Messaging API (แนะนำ) — ส่งเข้า OA/กลุ่ม
 *      ต้องมี CHANNEL_ACCESS_TOKEN + GROUP_ID / USER_ID
 *   2. LINE Notify (เดิม กำลังเลิกใช้) — ส่งเข้าห้องส่วนตัว/กลุ่ม
 *      ต้องมี NOTIFY_TOKEN
 *
 * ★ ออกแบบให้ "ไม่ล้มทั้งระบบถ้า LINE ล่ม":
 *   - มี timeout (ค่าเริ่มต้น 8 วินาที)
 *   - retry 3 ครั้งแบบ backoff
 *   - ถ้าส่งไม่ได้ → บันทึก log + คืน ok:false ไม่โยน error
 */

export type LineMode = 'messaging' | 'notify' | 'off';

export interface LineConfig {
  mode: LineMode;
  /** Messaging API */
  channelAccessToken?: string;
  /** ปลายทาง: group id / room id / user id */
  to?: string;
  /** LINE Notify */
  notifyToken?: string;
  /** เปิด/ปิดรวม */
  enabled: boolean;
  /** timeout (ms) */
  timeoutMs: number;
  /** จำนวนครั้งที่ลองใหม่ */
  retries: number;
  /** เงื่อนไขที่ส่ง */
  events: {
    onRoundOpen: boolean;
    onRoundClose: boolean;
    onResult: boolean;
    onBigWin: boolean;
    onRiskBlock: boolean;
    onLowBalance: boolean;
  };
  /** แจ้งเตือนเมื่อจ่ายเกินกี่บาท */
  bigWinThreshold: number;
  /** แจ้งเตือนเมื่อเครดิตต่ำกว่ากี่บาท */
  lowBalanceThreshold: number;
}

export const DEFAULT_LINE_CONFIG: LineConfig = {
  mode: 'off',
  enabled: false,
  timeoutMs: 8000,
  retries: 2,
  events: {
    onRoundOpen: true,
    onRoundClose: true,
    onResult: true,
    onBigWin: true,
    onRiskBlock: true,
    onLowBalance: false,
  },
  bigWinThreshold: 100_000,
  lowBalanceThreshold: 5_000,
};

export interface LineResult {
  ok: boolean;
  /** HTTP status (ถ้ามี) */
  status?: number;
  /** ข้อความ error (ถ้าล้มเหลว) */
  error?: string;
  /** จำนวนครั้งที่ลอง */
  attempts: number;
}

/* ══════════════════════════════════════════════════════════
 * 1. สร้างข้อความ (Flex-like text)
 * ══════════════════════════════════════════════════════════ */

export interface NotifyPayload {
  title: string;
  lines: string[];
  /** แนบ footer */
  footer?: string;
}

/** ประกอบเป็นข้อความเดียว (LINE จำกัด 5,000 ตัวอักษร) */
export function buildMessage(p: NotifyPayload): string {
  const head = `【${p.title}】`;
  const body = p.lines.filter(Boolean).join('\n');
  const foot = p.footer ? `\n${p.footer}` : '';
  const full = `${head}\n${body}${foot}`;

  // ★ กันเกิน 5,000 — ตัดแล้วต่อท้ายด้วยข้อความสั้น ๆ
  //   ต้องนับความยาวของข้อความต่อท้ายด้วย ไม่งั้นรวมแล้วเกิน
  const LIMIT = 4900;
  const TAIL = '\n…(ตัดข้อความ)';
  if (full.length <= LIMIT) return full;
  return full.slice(0, LIMIT - TAIL.length) + TAIL;
}

/* ══════════════════════════════════════════════════════════
 * 2. ข้อความสำเร็จรูปของหวย 20 ช่อง
 * ══════════════════════════════════════════════════════════ */

function money(n: number): string {
  return Number(n || 0).toLocaleString('en-US');
}

/** เปิดรอบ */
export function msgRoundOpen(roundId: string, closesAt?: string): NotifyPayload {
  return {
    title: 'เปิดรับแทง',
    lines: [
      `🎰 หวย 20 ช่อง 6 หลัก`,
      `รอบ: ${roundId}`,
      closesAt ? `ปิดรับ: ${closesAt}` : 'สถานะ: เปิดรับแทง',
    ],
  };
}

/** ปิดรอบ (ก่อนออกผล) */
export function msgRoundClose(roundId: string, totalBet: number, tickets: number, players: number): NotifyPayload {
  return {
    title: 'ปิดรับแทงแล้ว',
    lines: [
      `รอบ: ${roundId}`,
      `💰 รับแทงรวม: ${money(totalBet)} ฿`,
      `🧾 โพย: ${money(tickets)} ใบ`,
      `👥 ผู้เล่น: ${money(players)} คน`,
    ],
    footer: 'กำลังคำนวณผล…',
  };
}

/** ออกผล */
export function msgResult(
  roundId: string,
  result: string,
  totalBet: number,
  totalPayout: number,
): NotifyPayload {
  const profit = totalBet - totalPayout;
  const margin = totalBet > 0 ? ((profit / totalBet) * 100).toFixed(1) : '0.0';
  return {
    title: 'ผลออกรางวัล',
    lines: [
      `รอบ: ${roundId}`,
      `🎯 ผล: ${result}`,
      `   3 ตัวบน: ${result.slice(-3)}`,
      `   2 ตัวบน: ${result.slice(-2)}`,
      `   2 ตัวล่าง: ${result.slice(2, 4)}`,
      `   1 ตัว: ${result.slice(-1)}`,
      '',
      `💰 รับ: ${money(totalBet)} ฿`,
      `💸 จ่าย: ${money(totalPayout)} ฿`,
      `${profit >= 0 ? '📈' : '📉'} ${profit >= 0 ? 'กำไร' : 'ขาดทุน'}: ${money(Math.abs(profit))} ฿ (${margin}%)`,
    ],
  };
}

/** มีคนถูกใหญ่ */
export function msgBigWin(number: string, kind: string, payout: number, result: string): NotifyPayload {
  return {
    title: '⚠️ มีผู้ถูกรางวัลใหญ่',
    lines: [
      `🎯 ผล: ${result}`,
      `เลขที่ถูก: ${kind} ${number}`,
      `💸 จ่ายออก: ${money(payout)} ฿`,
    ],
  };
}

/** บล็อกจากเพดานความเสี่ยง */
export function msgRiskBlock(number: string, kind: string, reason: string): NotifyPayload {
  return {
    title: '🛑 บล็อกการแทง',
    lines: [
      `เลข: ${kind} ${number}`,
      `เหตุ: ${reason}`,
    ],
  };
}

/** เครดิตต่ำ */
export function msgLowBalance(userName: string, balance: number, threshold: number): NotifyPayload {
  return {
    title: '💳 เครดิตต่ำ',
    lines: [
      `ผู้ใช้: ${userName}`,
      `คงเหลือ: ${money(balance)} ฿ (เกณฑ์ ${money(threshold)} ฿)`,
    ],
  };
}

/* ══════════════════════════════════════════════════════════
 * 3. ส่งจริง (fetch + timeout + retry)
 * ══════════════════════════════════════════════════════════ */

/** fetch พร้อม timeout */
async function fetchWithTimeout(
  fetcher: typeof fetch,
  url: string,
  init: any,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetcher(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** หน่วงเวลา */
function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * ★ ส่งข้อความเข้า LINE
 *
 * @param payload ข้อความ
 * @param cfg ค่าตั้งต้น
 * @param fetcher ฟังก์ชัน fetch (ไว้ทดสอบ) — ค่าเริ่มต้นใช้ global fetch
 */
export async function sendLine(
  payload: NotifyPayload,
  cfg: LineConfig = DEFAULT_LINE_CONFIG,
  fetcher: typeof fetch = fetch,
): Promise<LineResult> {
  // ── ปิดอยู่ → ไม่ทำอะไร ──
  if (!cfg.enabled || cfg.mode === 'off') {
    return { ok: false, error: 'LINE ปิดอยู่ (mode=off หรือ enabled=false)', attempts: 0 };
  }

  // ── ตรวจค่าที่ต้องมี ──
  if (cfg.mode === 'messaging' && (!cfg.channelAccessToken || !cfg.to)) {
    return { ok: false, error: 'ต้องมี channelAccessToken และ to', attempts: 0 };
  }
  if (cfg.mode === 'notify' && !cfg.notifyToken) {
    return { ok: false, error: 'ต้องมี notifyToken', attempts: 0 };
  }

  const text = buildMessage(payload);

  const url = cfg.mode === 'messaging'
    ? 'https://api.line.me/v2/bot/message/push'
    : 'https://notify-api.line.me/api/notify';

  const init = cfg.mode === 'messaging'
    ? {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.channelAccessToken}`,
        },
        body: JSON.stringify({ to: cfg.to, messages: [{ type: 'text', text }] }),
      }
    : {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${cfg.notifyToken}`,
        },
        body: new URLSearchParams({ message: text }).toString(),
      };

  let lastErr = '';
  let lastStatus: number | undefined;
  const maxAttempts = Math.max(1, cfg.retries + 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(fetcher, url, init, cfg.timeoutMs);
      lastStatus = res.status;

      if (res.ok) {
        return { ok: true, status: res.status, attempts: attempt };
      }

      const body = await res.text().catch(() => '');
      lastErr = `HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ''}`;

      // ── 4xx (ยกเว้น 429) ไม่ต้อง retry — token ผิด/ปลายทางผิด ──
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return { ok: false, status: res.status, error: lastErr, attempts: attempt };
      }
    } catch (e: any) {
      lastErr = e?.name === 'AbortError' ? `หมดเวลา ${cfg.timeoutMs}ms` : (e?.message || String(e));
    }

    // backoff: 300ms, 600ms, 1200ms…
    if (attempt < maxAttempts) await sleep(300 * Math.pow(2, attempt - 1));
  }

  return { ok: false, status: lastStatus, error: lastErr, attempts: maxAttempts };
}

/* ══════════════════════════════════════════════════════════
 * 4. ตัวช่วยตัดสินใจว่าควรส่งไหม
 * ══════════════════════════════════════════════════════════ */

export type LineEvent = keyof LineConfig['events'];

export function shouldSend(ev: LineEvent, cfg: LineConfig, value = 0): boolean {
  if (!cfg.enabled || cfg.mode === 'off') return false;
  if (!cfg.events[ev]) return false;

  if (ev === 'onBigWin') return value >= cfg.bigWinThreshold;
  if (ev === 'onLowBalance') return value <= cfg.lowBalanceThreshold;
  return true;
}

/** สรุปว่าตั้งค่าครบไหม (ไว้โชว์ในหลังบ้าน) */
export function lineHealth(cfg: LineConfig): {
  ready: boolean;
  mode: string;
  problems: string[];
} {
  const problems: string[] = [];
  if (!cfg.enabled) problems.push('ยังไม่เปิดใช้งาน');
  if (cfg.mode === 'off') problems.push('โหมด = off');
  if (cfg.mode === 'messaging') {
    if (!cfg.channelAccessToken) problems.push('ขาด CHANNEL_ACCESS_TOKEN');
    if (!cfg.to) problems.push('ขาดปลายทาง (group/user id)');
  }
  if (cfg.mode === 'notify' && !cfg.notifyToken) problems.push('ขาด NOTIFY_TOKEN');

  return {
    ready: cfg.enabled && cfg.mode !== 'off' && problems.length === 0,
    mode: cfg.mode,
    problems,
  };
}

/** อ่านค่าตั้งจาก env */
export function lineConfigFromEnv(env: Record<string, string | undefined> = process.env): LineConfig {
  const mode = (env.LINE_MODE as LineMode) || 'off';
  return {
    ...DEFAULT_LINE_CONFIG,
    mode,
    enabled: !!env.LINE_ENABLED && env.LINE_ENABLED === 'true',
    channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
    to: env.LINE_TO,
    notifyToken: env.LINE_NOTIFY_TOKEN,
  };
}
