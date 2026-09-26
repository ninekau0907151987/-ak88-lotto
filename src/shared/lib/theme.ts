/**
 * src/shared/lib/theme.ts
 * ------------------------------------------------------------------
 * ★ ระบบสีหลังบ้าน — โทนครีม/บ้านๆ (Cream & Warm Neutrals) ★
 *
 * ทำไม: ผู้ใช้ต้องการหลังบ้านดูเป็น "บ้านๆ" ไม่แข็ง ไม่ใช่ดำสนิท
 *       ใช้โทนครีม/เบจ/น้ำตาลอ่อน แทนขาว-ดำจัด
 *
 * ★ กฎ: ห้าม hardcode สีในหน้าเพจ ให้ดึงจากไฟล์นี้เท่านั้น
 *       จะเปลี่ยนธีมทั้งระบบได้จากที่เดียว
 */

/* ============================================================
 * 1. ชุดสีหลัก (Palette)
 * ============================================================ */
export const CREAM = {
  /** พื้นหลังหลักของหลังบ้าน */
  bg: '#faf6ef',
  /** พื้นหลังการ์ด */
  card: '#fffdf8',
  /** พื้นหลังรอง (แถบ, หัวตาราง) */
  subtle: '#f5efe2',
  /** เส้นขอบ */
  border: '#e8dfcc',
  /** เส้นขอบเข้ม */
  borderStrong: '#d9cdb4',
  /** ตัวอักษรหลัก — น้ำตาลเข้ม ไม่ดำสนิท */
  text: '#3d3226',
  /** ตัวอักษรรอง */
  textMuted: '#8a7d6b',
  /** ตัวอักษรจาง */
  textFaint: '#b3a897',
  /** สีเน้นหลัก — น้ำตาลทอง */
  accent: '#a67c52',
  /** สีเน้นเข้ม */
  accentDark: '#7d5a38',
  /** สีเน้นอ่อน */
  accentSoft: '#f0e6d6',
} as const;

/* ============================================================
 * 2. สีสถานะ (Status Colors) — ★ ผู้ใช้ขอให้ออกแบบ
 * ------------------------------------------------------------
 * แต่ละสถานะมี 3 ค่า: bg (พื้น), text (ตัวอักษร), border (ขอบ)
 * ใช้ร่วมกันทุกหน้า → สถานะเดียวกันสีเดียวกันเสมอ
 * ============================================================ */
export interface StatusStyle {
  bg: string;
  text: string;
  border: string;
  dot: string;
  label: string;
}

export const STATUS: Record<string, StatusStyle> = {
  // ---- เงิน / ธุรกรรม ----
  pending:    { bg: '#fef3e2', text: '#a16207', border: '#f5d9a8', dot: '#eab308', label: 'รอดำเนินการ' },
  approved:   { bg: '#e8f5e9', text: '#2e7d32', border: '#b7dfb9', dot: '#4caf50', label: 'อนุมัติแล้ว' },
  success:    { bg: '#e8f5e9', text: '#2e7d32', border: '#b7dfb9', dot: '#4caf50', label: 'สำเร็จ' },
  rejected:   { bg: '#fdecea', text: '#b3261e', border: '#f5c6c2', dot: '#e53935', label: 'ปฏิเสธ' },
  failed:     { bg: '#fdecea', text: '#b3261e', border: '#f5c6c2', dot: '#e53935', label: 'ล้มเหลว' },
  cancelled:  { bg: '#f0ece4', text: '#7d7266', border: '#ddd5c7', dot: '#9e9488', label: 'ยกเลิก' },

  // ---- โพยหวย ----
  confirmed:  { bg: '#e3f2fd', text: '#1565c0', border: '#b3d9f7', dot: '#2196f3', label: 'ยืนยันแล้ว' },
  active:     { bg: '#e3f2fd', text: '#1565c0', border: '#b3d9f7', dot: '#2196f3', label: 'รอลุ้นผล' },
  win:        { bg: '#e8f5e9', text: '#1b5e20', border: '#a5d6a7', dot: '#43a047', label: 'ถูกรางวัล' },
  lose:       { bg: '#fdecea', text: '#b3261e', border: '#f5c6c2', dot: '#e53935', label: 'ไม่ถูก' },
  settled:    { bg: '#ede7f6', text: '#5e35b1', border: '#d1c4e9', dot: '#7e57c2', label: 'ตัดสินแล้ว' },

  // ---- สถานะระบบ / ผู้ใช้ ----
  online:     { bg: '#e8f5e9', text: '#2e7d32', border: '#b7dfb9', dot: '#4caf50', label: 'ออนไลน์' },
  offline:    { bg: '#f0ece4', text: '#7d7266', border: '#ddd5c7', dot: '#9e9488', label: 'ออฟไลน์' },
  suspended:  { bg: '#fdecea', text: '#b3261e', border: '#f5c6c2', dot: '#e53935', label: 'ระงับ' },
  open:       { bg: '#e8f5e9', text: '#2e7d32', border: '#b7dfb9', dot: '#4caf50', label: 'เปิดรับ' },
  closed:     { bg: '#fdecea', text: '#b3261e', border: '#f5c6c2', dot: '#e53935', label: 'ปิดรับ' },
  processing: { bg: '#e3f2fd', text: '#1565c0', border: '#b3d9f7', dot: '#2196f3', label: 'กำลังประมวลผล' },

  // ---- คิว / ลดเลข ----
  queued:     { bg: '#fef3e2', text: '#a16207', border: '#f5d9a8', dot: '#eab308', label: 'อยู่ในคิว' },
  sent:       { bg: '#e3f2fd', text: '#1565c0', border: '#b3d9f7', dot: '#2196f3', label: 'ส่งแล้ว' },
  paid:       { bg: '#e8f5e9', text: '#1b5e20', border: '#a5d6a7', dot: '#43a047', label: 'ชำระแล้ว' },

  // ---- ระดับความรุนแรง ----
  info:       { bg: '#e3f2fd', text: '#1565c0', border: '#b3d9f7', dot: '#2196f3', label: 'ข้อมูล' },
  warn:       { bg: '#fef3e2', text: '#a16207', border: '#f5d9a8', dot: '#eab308', label: 'เตือน' },
  critical:   { bg: '#fdecea', text: '#b3261e', border: '#f5c6c2', dot: '#e53935', label: 'วิกฤต' },
  neutral:    { bg: '#f0ece4', text: '#7d7266', border: '#ddd5c7', dot: '#9e9488', label: 'ทั่วไป' },
};

/** ดึงสไตล์สถานะ — ถ้าไม่รู้จักคืน neutral */
export function statusOf(key: string): StatusStyle {
  return STATUS[String(key || '').toLowerCase()] || STATUS.neutral;
}

/** คลาส Tailwind สำหรับป้ายสถานะ (สำเร็จรูป) */
export function statusClass(key: string): string {
  // ใช้ inline style เพราะสีเป็นค่าที่Runtime กำหนด — ดู StatusBadge component
  return '';
}

/* ============================================================
 * 3. คลาสสำเร็จรูปสำหรับใช้ซ้ำ (Utility classes)
 * ============================================================ */
export const UI = {
  /** การ์ดมาตรฐาน */
  card: 'rounded-2xl border shadow-sm',
  /** ปุ่มหลัก (น้ำตาลทอง) */
  btnPrimary: 'rounded-xl font-black transition active:scale-[0.98]',
  /** ปุ่มรอง */
  btnGhost: 'rounded-xl font-bold transition',
  /** ช่องกรอก */
  input: 'rounded-xl border font-bold outline-none transition',
} as const;

/** สี inline สำหรับการ์ด (ใช้กับ style prop) */
export const cardStyle = {
  background: CREAM.card,
  borderColor: CREAM.border,
} as const;
