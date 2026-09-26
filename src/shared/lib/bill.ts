/**
 * src/shared/lib/bill.ts
 * ------------------------------------------------------------------
 * ★ สร้างบิล/ใบเสร็จ — จัดฟอร์มให้เหมาะกับมือถือ ★
 *
 * ผู้ใช้ขอ: "ทำบิลให้สวยๆ จัดฟอร์มให้เหมาะกับมือถือ"
 *
 * หลักการ:
 *   1. ความกว้างสูงสุด 58 ตัวอักษร (มาตรฐานเครื่องพิมพ์ใบเสร็จ 80mm)
 *   2. มือถืออ่านง่าย — ไม่ต้องซูม ไม่มี scroll แนวนอน
 *   3. ข้อมูลครบ: เลขที่บิล, วันที่, รายการ, ยอด, สถานะ
 *   4. คัดลอกวางใน LINE ได้ทันที (คัดลอกเป็นข้อความ)
 *
 * ★ ฟังก์ชันนี้เป็น pure — ไม่แตะ DB ทดสอบได้
 */

export interface BillLine {
  /** ชื่อรายการ เช่น "3 ตัวบน เลข 123" */
  description: string;
  /** จำนวนเงิน */
  amount: number;
  /** อัตราจ่าย (แสดงข้างหน้า) */
  rate?: number;
  /** จำนวน */
  qty?: number;
}

export interface BillData {
  /** เลขที่บิล */
  invoiceNo?: string;
  /** รหัสโพย/ธุรกรรม */
  refId?: string;
  /** ชนิดบิล */
  type: string;
  /** ชื่อลูกค้า */
  customerName?: string;
  /** ประเภทหวย */
  lotteryName?: string;
  /** รอบ/งวด */
  round?: string;
  /** รายการ */
  lines: BillLine[];
  /** ยอดรวม */
  total: number;
  /** สถานะ */
  status?: string;
  /** วันที่ออก */
  issuedAt?: string | Date;
  /** หมายเหตุ */
  note?: string;
  /** ชื่อแบรนด์ */
  brand?: string;
  /** ยอดเงินคงเหลือหลังทำรายการ */
  balanceAfter?: number;
}

/** ความกว้างบิล — 40 ตัวอักษรกำลังดีกับมือถือ */
const W = 40;

/** จัดข้อความให้อยู่กลาง */
const center = (s: string) => {
  const pad = Math.max(0, Math.floor((W - visualLen(s)) / 2));
  return ' '.repeat(pad) + s;
};

/** นับความยาวโดยถือว่าอักษรไทย/emoji กว้าง 1 */
function visualLen(s: string): number {
  return [...String(s)].length;
}

/** เส้นคั่น */
const hr = (ch = '─') => ch.repeat(W);

/** บรรทัดซ้าย-ขวา */
function row(left: string, right: string): string {
  const l = visualLen(left);
  const r = visualLen(right);
  const space = Math.max(1, W - l - r);
  return left + ' '.repeat(space) + right;
}

/** จัดวันที่แบบไทยอ่านง่าย */
export function formatThaiDateTime(d: string | Date = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear() + 543} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** จัดเงินให้อยู่ในรูป 12,345.00 */
export function money(n: number): string {
  return (Number(n) || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * ★ สร้างข้อความบิลแบบเต็ม (สำหรับแสดงบนจอ + คัดลอก)
 */
export function buildBillText(bill: BillData): string {
  const L: string[] = [];
  const brand = bill.brand || 'AK88 LOTTO';

  // ---- หัวบิล ----
  L.push(hr('═'));
  L.push(center(brand));
  L.push(center(typeLabel(bill.type)));
  L.push(hr('═'));
  L.push('');

  // ---- ข้อมูลบิล ----
  if (bill.invoiceNo) L.push(row('เลขที่บิล', bill.invoiceNo));
  if (bill.refId) L.push(row('รหัสอ้างอิง', String(bill.refId).slice(-8)));
  L.push(row('วันที่', formatThaiDateTime(bill.issuedAt)));
  if (bill.customerName) L.push(row('ลูกค้า', bill.customerName));
  if (bill.lotteryName) L.push(row('ประเภทหวย', bill.lotteryName));
  if (bill.round) L.push(row('งวดที่', bill.round));
  if (bill.status) L.push(row('สถานะ', statusLabel(bill.status)));
  L.push('');
  L.push(hr());

  // ---- รายการ ----
  L.push(row('รายการ', 'จำนวนเงิน'));
  L.push(hr());
  bill.lines.forEach((ln, i) => {
    const desc = ln.description || `รายการ ${i + 1}`;
    // ถ้าชื่อยาวเกิน ให้ตัดบรรทัด
    if (visualLen(desc) > W - 12) {
      L.push(desc);
      L.push(row('', money(ln.amount)));
    } else {
      L.push(row(desc, money(ln.amount)));
    }
    if (ln.rate) {
      L.push(row(`   อัตราจ่าย ×${ln.rate}`, ''));
    }
  });

  L.push(hr());

  // ---- ยอดรวม ----
  L.push(row('รวมทั้งสิ้น', `${money(bill.total)} ฿`));
  if (bill.balanceAfter !== undefined) {
    L.push(row('เครดิตคงเหลือ', `${money(bill.balanceAfter)} ฿`));
  }
  L.push(hr('═'));

  // ---- ท้ายบิล ----
  if (bill.note) {
    L.push('');
    L.push(`หมายเหตุ: ${bill.note}`);
  }
  L.push('');
  L.push(center('ขอบคุณที่ใช้บริการ'));
  L.push(center('โชคดีนะคะ/ครับ 🍀'));
  L.push(hr('═'));

  return L.join('\n');
}

/** ชื่อชนิดบิลเป็นไทย */
export function typeLabel(type: string): string {
  const map: Record<string, string> = {
    bet: 'ใบรับแทงหวย',
    win: 'ใบรับเงินรางวัล',
    deposit: 'ใบรับฝากเงิน',
    withdraw: 'ใบถอนเงิน',
    topup: 'ใบเติมเครดิต',
    refund: 'ใบคืนเครดิต',
    statement: 'ใบสรุปยอด',
    set: 'ใบรับซื้อหวยชุด',
  };
  return map[type] || 'ใบเสร็จรับเงิน';
}

/** ชื่อสถานะเป็นไทย */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'รอดำเนินการ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ปฏิเสธ',
    success: 'สำเร็จ',
    confirmed: 'ยืนยันแล้ว',
    win: 'ถูกรางวัล',
    lose: 'ไม่ถูก',
    cancelled: 'ยกเลิก',
    settled: 'ตัดสินแล้ว',
    active: 'รอลุ้นผล',
  };
  return map[status] || status;
}

/**
 * ★ สร้างข้อความบิลสั้น สำหรับแชร์ใน LINE/SMS
 */
export function buildShortBillText(bill: BillData): string {
  const L: string[] = [];
  L.push(`🧾 ${typeLabel(bill.type)}`);
  if (bill.invoiceNo) L.push(`เลขที่: ${bill.invoiceNo}`);
  L.push(`วันที่: ${formatThaiDateTime(bill.issuedAt)}`);
  if (bill.lotteryName) L.push(`หวย: ${bill.lotteryName}`);
  L.push('');
  L.push(`รายการ (${bill.lines.length}):`);
  bill.lines.slice(0, 8).forEach(ln => {
    L.push(`• ${ln.description} = ${money(ln.amount)} ฿`);
  });
  if (bill.lines.length > 8) L.push(`  ... อีก ${bill.lines.length - 8} รายการ`);
  L.push('');
  L.push(`💰 รวม: ${money(bill.total)} ฿`);
  if (bill.balanceAfter !== undefined) L.push(`💳 คงเหลือ: ${money(bill.balanceAfter)} ฿`);
  if (bill.status) L.push(`📌 สถานะ: ${statusLabel(bill.status)}`);
  return L.join('\n');
}

/** แปลงบิลเป็นข้อมูลสำหรับแสดงบนจอ (แยกบรรทัด) */
export function billToRows(bill: BillData): Array<{ label: string; value: string; strong?: boolean }> {
  const rows: Array<{ label: string; value: string; strong?: boolean }> = [];
  if (bill.invoiceNo) rows.push({ label: 'เลขที่บิล', value: bill.invoiceNo });
  if (bill.customerName) rows.push({ label: 'ลูกค้า', value: bill.customerName });
  if (bill.lotteryName) rows.push({ label: 'ประเภทหวย', value: bill.lotteryName });
  if (bill.round) rows.push({ label: 'งวดที่', value: bill.round });
  rows.push({ label: 'วันที่', value: formatThaiDateTime(bill.issuedAt) });
  rows.push({ label: 'รวมทั้งสิ้น', value: `${money(bill.total)} ฿`, strong: true });
  if (bill.balanceAfter !== undefined) {
    rows.push({ label: 'เครดิตคงเหลือ', value: `${money(bill.balanceAfter)} ฿`, strong: true });
  }
  return rows;
}

/** ดาวน์โหลดบิลเป็นไฟล์ .txt (ใช้ได้ทุกเบราว์เซอร์) */
export function downloadBill(bill: BillData, filename?: string) {
  const text = buildBillText(bill);
  const blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `bill-${bill.invoiceNo || Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** คัดลอกบิลลงคลิปบอร์ด */
export async function copyBill(bill: BillData, short = false): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(short ? buildShortBillText(bill) : buildBillText(bill));
    return true;
  } catch {
    return false;
  }
}
