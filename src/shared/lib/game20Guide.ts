/**
 * src/shared/lib/game20Guide.ts
 * ------------------------------------------------------------------
 * ★ กติกา + วิธีการเล่น (เนื้อหาสำหรับหน้าคู่มือ/ภาพกติกา) ★
 *
 * ผู้ใช้ขอ: "ทำภาพกิติกา วิธีการเล่นด้วยครับ"
 *
 * โครงสร้างเนื้อหา:
 *   1. ค่าคงที่กติกา (ใช้แสดงในภาพ/ตาราง)
 *   2. ตัวอย่างการคำนวณแบบเห็นภาพ (step-by-step พร้อมเลขจริง)
 *   3. วิธีการเล่น (8 ขั้น)
 *   4. ตารางอัตราจ่าย + ตัวอย่างเงินจริง
 *   5. คำถามที่พบบ่อย
 *   6. ข้อห้าม/ข้อควรระวัง
 *
 * ★ ข้อมูลทุกอย่างคำนวณจริงจาก lib ไม่ hardcode
 *   → ถ้าแก้กติกา/อัตราจ่าย หน้าคู่มืออัปเดตตามอัตโนมัติ
 * ==================================================================
 */
import {
  SLOT_COUNT, DIGITS_PER_SLOT, SUBTRACT_SLOT_POSITION, RESULT_MODULO,
  DEFAULT_PAYOUT_RATES, computeResult, formatResult, explainFormula,
  calcHouseMargin, padNum, type SlotResult,
} from './lottery20';

/* ==================================================================
 * 1. ค่าคงที่กติกา
 * ================================================================== */

export const GUIDE_RULES = {
  slotCount: SLOT_COUNT,
  digitsPerSlot: DIGITS_PER_SLOT,
  subtractPosition: SUBTRACT_SLOT_POSITION,
  modulo: RESULT_MODULO,
  resultMin: '000000',
  resultMax: '999999',
  formulaText: `ผลรางวัล = (ผลรวมทั้ง ${SLOT_COUNT} ช่อง − ช่องที่ ${SUBTRACT_SLOT_POSITION}) mod ${RESULT_MODULO.toLocaleString('en-US')}`,
  formulaShort: `(Σ ${SLOT_COUNT} ช่อง − ช่อง ${SUBTRACT_SLOT_POSITION}) mod 1,000,000`,
} as const;

/* ==================================================================
 * 2. ★ ตัวอย่างการคำนวณแบบเห็นภาพ
 * ================================================================== */

export interface WorkedExample {
  title: string;
  slots: string[];
  result: SlotResult;
  /** ขั้นตอนทีละบรรทัด */
  lines: string[];
  /** คำอธิบายสั้น */
  note: string;
}

/** ตัวอย่างที่ 1 — เลขปกติ */
function exampleNormal(): WorkedExample {
  // ตั้งใจให้ผลรวมสวย: ช่อง 1 = 123456, ช่อง 17 = 3456, ที่เหลือ 0
  const slots = new Array(SLOT_COUNT).fill('000000');
  slots[0] = '123456';
  slots[16] = '003456';
  const r = computeResult(slots);
  return {
    title: 'ตัวอย่างที่ 1 — เลขทั่วไป',
    slots,
    result: r,
    lines: [
      `ผลรวมทั้ง 20 ช่อง = ${r.sum.toLocaleString('en-US')}`,
      `หักช่องที่ ${SUBTRACT_SLOT_POSITION} (${r.subtractSlot}) = − ${r.subtractValue.toLocaleString('en-US')}`,
      `ผลต่าง = ${r.raw.toLocaleString('en-US')}`,
      `${r.raw.toLocaleString('en-US')} mod ${RESULT_MODULO.toLocaleString('en-US')} = ${r.result}`,
    ],
    note: `ได้ผล ${formatResult(r.result)} → 3 ตัวบน ${r.prizes.top3} • 2 ตัวบน ${r.prizes.top2} • 2 ตัวล่าง ${r.prizes.bottom2} • 1 ตัว ${r.prizes.last1}`,
  };
}

/** ตัวอย่างที่ 2 — ต้องบวกเพิ่ม 1 รอบ (mod ทำงาน) */
function exampleWrap(): WorkedExample {
  const slots = new Array(SLOT_COUNT).fill('000000');
  slots[0] = '500000';
  slots[1] = '500000';   // รวม 1,000,000
  slots[16] = '000000';
  const r = computeResult(slots);
  return {
    title: 'ตัวอย่างที่ 2 — ผลรวมเกิน 1 รอบ',
    slots,
    result: r,
    lines: [
      `ผลรวมทั้ง 20 ช่อง = ${r.sum.toLocaleString('en-US')}`,
      `หักช่องที่ ${SUBTRACT_SLOT_POSITION} (${r.subtractSlot}) = − ${r.subtractValue.toLocaleString('en-US')}`,
      `ผลต่าง = ${r.raw.toLocaleString('en-US')}`,
      `${r.raw.toLocaleString('en-US')} ÷ ${RESULT_MODULO.toLocaleString('en-US')} = 1 รอบ เศษ ${r.result}`,
    ],
    note: `ผลรวมเกิน 1 ล้าน → ตัดรอบทิ้ง เหลือ ${formatResult(r.result)}`,
  };
}

/** ตัวอย่างที่ 3 — ช่อง 17 มากกว่าผลรวมช่องอื่น (ติดลบ) */
function exampleNegative(): WorkedExample {
  const slots = new Array(SLOT_COUNT).fill('000000');
  slots[0] = '100000';
  slots[16] = '500000';
  const r = computeResult(slots);
  return {
    title: 'ตัวอย่างที่ 3 — ช่อง 17 มากกว่าช่องอื่น',
    slots,
    result: r,
    lines: [
      `ผลรวมทั้ง 20 ช่อง = ${r.sum.toLocaleString('en-US')}  (รวมช่อง 17 ด้วย)`,
      `หักช่องที่ ${SUBTRACT_SLOT_POSITION} (${r.subtractSlot}) = − ${r.subtractValue.toLocaleString('en-US')}`,
      `ผลต่าง = ${r.raw.toLocaleString('en-US')}  (ติดลบ)`,
      `${r.raw.toLocaleString('en-US')} mod ${RESULT_MODULO.toLocaleString('en-US')} = ${r.result}`,
    ],
    note: `ค่าติดลบ → บวกกลับ 1,000,000 → ได้ ${formatResult(r.result)}`,
  };
}

/** ตัวอย่างที่ 4 — เลขล็อกทั้งชุดได้ผลตรงเป้า (โชว์ว่าวางเลขได้) */
function exampleTarget(): WorkedExample {
  const slots = new Array(SLOT_COUNT).fill('000000');
  slots[0] = '777777';
  slots[16] = '000000';
  const r = computeResult(slots);
  return {
    title: 'ตัวอย่างที่ 4 — ตั้งเป้าผล 777-777',
    slots,
    result: r,
    lines: [
      `ตั้งช่องที่ 1 = 777777`,
      `ตั้งช่องที่ ${SUBTRACT_SLOT_POSITION} = 000000`,
      `ผลรวม = ${r.sum.toLocaleString('en-US')} • หัก ${r.subtractValue.toLocaleString('en-US')} • ผลต่าง = ${r.raw.toLocaleString('en-US')}`,
      `mod = ${r.result} → ${formatResult(r.result)}`,
    ],
    note: 'ระบบวางเลขได้ตามเป้า — แต่ระบบจริงจะกระจายค่าทุกช่องเพื่อไม่ให้ดูผิดธรรมชาติ',
  };
}

export function getWorkedExamples(): WorkedExample[] {
  return [exampleNormal(), exampleWrap(), exampleNegative(), exampleTarget()];
}

/* ==================================================================
 * 3. ★ วิธีการเล่น 8 ขั้น
 * ================================================================== */

export interface PlayStep {
  n: number;
  icon: string;
  title: string;
  detail: string;
  /** ★ คำเตือน/ข้อควรระวังของขั้นนี้ */
  warn?: string;
}

export const PLAY_STEPS: PlayStep[] = [
  {
    n: 1, icon: '🔑',
    title: 'เข้าสู่ระบบ',
    detail: 'ล็อกอินด้วยชื่อผู้ใช้และรหัสผ่านที่ได้จากเอเย่นต์ หากยังไม่มีให้ติดต่อผู้ดูแลระบบ',
    warn: 'ห้ามใช้บัญชีร่วมกัน — หากสงสัยว่าบัญชีรั่วไหล ให้แจ้งเปลี่ยนรหัสทันที',
  },
  {
    n: 2, icon: '🎯',
    title: 'เลือกประเภทหวย',
    detail: `เลือก "หวย ${GUIDE_RULES.slotCount} ช่อง ${GUIDE_RULES.digitsPerSlot} หลัก" จากเมนู แล้วตรวจว่ารอบเปิดรับแทงอยู่`,
    warn: 'ระบบจะไม่รับโพยหลังปิดรอบ — ตรวจเวลาปิดให้ดี',
  },
  {
    n: 3, icon: '🔢',
    title: 'เลือกประเภทการแทง',
    detail: 'เลือกว่าจะแทงแบบ 3 ตัวบน • 2 ตัวบน • 2 ตัวล่าง • 1 ตัว • โต๊ด แต่ละแบบอัตราจ่ายต่างกัน',
  },
  {
    n: 4, icon: '✍️',
    title: 'ใส่เลขและจำนวนเงิน',
    detail: 'กรอกเลขตามประเภทที่เลือก แล้วใส่จำนวนเงินต่อเลข ระบบจะรวมยอดให้อัตโนมัติ',
    warn: 'ตรวจเลขให้ดี — ส่งโพยแล้วแก้ไม่ได้',
  },
  {
    n: 5, icon: '🧮',
    title: 'ตรวจยอดก่อนส่ง',
    detail: 'หน้าจอจะแสดงยอดแทงรวม • จำนวนรายการ • เครดิตคงเหลือ ให้ตรวจก่อนกดยืนยัน',
    warn: 'ถ้าเครดิตไม่พอ ระบบจะไม่รับโพย',
  },
  {
    n: 6, icon: '✅',
    title: 'ยืนยันส่งโพย',
    detail: 'กดยืนยัน → ระบบตัดเครดิตและออกเลขที่โพย เก็บเลขที่โพยไว้ตรวจสอบ',
  },
  {
    n: 7, icon: '⏰',
    title: 'รอปิดรอบ',
    detail: `เมื่อถึงเวลาปิดรอบ ระบบจะนำเลข ${GUIDE_RULES.slotCount} ช่องมาคำนวณตามสูตร แล้วประกาศผล`,
  },
  {
    n: 8, icon: '💰',
    title: 'รับเงินรางวัล',
    detail: 'ถ้าถูก ระบบจะเพิ่มเครดิตให้อัตโนมัติตามอัตราจ่าย ดูรายละเอียดได้ที่ประวัติ/บิล',
    warn: 'ตรวจสอบยอดภายใน 24 ชั่วโมง หากผิดปกติให้แจ้งทันที',
  },
];

/* ==================================================================
 * 4. ★ ตารางอัตราจ่าย + ตัวอย่างเงินจริง
 * ================================================================== */

export interface PayoutRow {
  key: string;
  label: string;
  rate: number;
  desc: string;
  /** ★ ตัวอย่าง: แทงเท่าไร ได้เท่าไร */
  exampleBet: number;
  exampleWin: number;
  /** วิธีอ่านผล */
  howToRead: string;
}

/** ★ วิธีอ่านผลของแต่ละประเภท — อธิบายด้วยผลตัวอย่าง */
const HOW_TO_READ: Record<string, (r: SlotResult) => string> = {
  '3ตัวบน':  r => `ดู 3 หลักท้ายของผล (${r.prizes.top3})`,
  '2ตัวบน':  r => `ดู 2 หลักท้ายของผล (${r.prizes.top2})`,
  '2ตัวล่าง': r => `ดูหลักที่ 3-4 ของผล (${r.prizes.bottom2})`,
  '1ตัว':    r => `ดูหลักสุดท้ายของผล (${r.prizes.last1})`,
  'โต๊ด':    r => `ดู 3 หลักท้าย (${r.prizes.top3}) — เรียงแบบไหนก็ได้`,
};

export function getPayoutTable(rateMap?: Record<string, number>): PayoutRow[] {
  const demo = computeResult(Array.from({ length: SLOT_COUNT }, (_, i) =>
    i === 0 ? '123456' : '000000'));
  const rates = DEFAULT_PAYOUT_RATES.map(r => ({
    ...r,
    rate: rateMap?.[r.key] ?? r.rate,
  }));

  return rates.map(r => {
    const exampleBet = 100;
    return {
      key: r.key,
      label: r.label,
      rate: r.rate,
      desc: r.desc,
      exampleBet,
      exampleWin: exampleBet * r.rate,
      howToRead: HOW_TO_READ[r.key]?.(demo) ?? 'ดูผลรางวัล',
    };
  });
}

/* ==================================================================
 * 5. ★ คำถามที่พบบ่อย
 * ================================================================== */

export interface FaqItem {
  q: string;
  a: string;
}

export function getFaq(): FaqItem[] {
  const m = calcHouseMargin();
  return [
    {
      q: `ทำไมต้องมี ${SLOT_COUNT} ช่อง?`,
      a: `ใช้ ${SLOT_COUNT} ช่องเพื่อกระจายค่าตัวเลข ทำให้ผลลัพธ์ดูเป็นธรรมชาติและตรวจสอบย้อนหลังได้ว่าเลขไหนให้ผลอะไร แต่ละช่องเป็นเลข ${DIGITS_PER_SLOT} หลัก (000000–999999)`,
    },
    {
      q: `ทำไมต้องลบช่องที่ ${SUBTRACT_SLOT_POSITION}?`,
      a: `ช่องที่ ${SUBTRACT_SLOT_POSITION} ทำหน้าที่เป็นตัวถ่วง (offset) ให้ผลลัพธ์ผันแปรไม่ตรงกับผลรวมตรงๆ ทำให้คาดเดาง่าย ระบบจะหักค่าช่องนี้ออกจากผลรวมก่อน mod`,
    },
    {
      q: 'mod 1,000,000 คืออะไร?',
      a: 'คือการเอาผลต่างหาร 1,000,000 แล้วเก็บเฉพาะเศษ ทำให้ผลลัพธ์อยู่ในช่วง 000000–999999 เสมอ ถ้าผลรวมเกิน 1 ล้านก็ตัดรอบทิ้ง ถ้าติดลบก็บวกกลับ',
    },
    {
      q: 'ตรวจผลเองได้ไหม?',
      a: `ได้ — ระบบมีหน้าคำนวณให้กรอกเลข ${SLOT_COUNT} ช่อง แล้วคำนวณผลให้ทันที พร้อมแสดงทุกขั้นตอนให้ตรวจ`,
    },
    {
      q: 'โพยที่ส่งแล้วแก้ได้ไหม?',
      a: 'แก้ไม่ได้ — เมื่อยืนยันแล้วระบบตัดเครดิตและล็อกโพยทันที กรุณาตรวจเลขและยอดก่อนกดยืนยัน',
    },
    {
      q: 'ถ้าถูกหลายประเภทรวมกันได้ไหม?',
      a: 'ได้ — ถ้าเลขที่แทงตรงกับหลายประเภท ระบบจะจ่ายให้ทุกประเภทที่ตรง (ดูตัวอย่างในหน้าประวัติ)',
    },
    {
      q: 'อัตราจ่ายคิดยังไง?',
      a: `อัตราจ่ายกำหนดจากหลังบ้าน แทง 100 บาท × อัตราจ่าย = เงินที่ได้ ระบบตั้ง margin เป้าหมายไว้ที่ ${m.marginPercent.toFixed(1)}% ต่อประเภท เพื่อความยั่งยืนของเจ้ามือและผู้เล่น`,
    },
    {
      q: 'ปิดรอบแล้วดูประวัติย้อนหลังได้ไหม?',
      a: `ได้ — หน้าประวัติแสดงทุกรอบย้อนหลัง พร้อมเลข ${SLOT_COUNT} ช่อง ผลลัพธ์ ยอดรับ-จ่าย และเหตุผลการเลือกผล ค้นหา/กรอง/ส่งออกได้`,
    },
    {
      q: 'ผลออกช้า/ไม่ออก ทำยังไง?',
      a: 'ตรวจว่าเลยเวลาปิดรอบหรือยัง ถ้าเลยแล้วแต่ยังไม่ออก ให้แจ้งผู้ดูแลระบบ — อย่ากดซ้ำเพราะอาจสร้างรอบซ้อน',
    },
    {
      q: 'เครดิตไม่พอทำยังไง?',
      a: 'แจ้งเอเย่นต์หรือผู้ดูแลเพื่อเติมเครดิต ระบบไม่ให้แทงเกินเครดิตที่มี',
    },
  ];
}

/* ==================================================================
 * 6. ★ ข้อห้าม / ข้อควรระวัง
 * ================================================================== */

export interface RuleItem {
  icon: string;
  title: string;
  detail: string;
  severity: 'danger' | 'warning' | 'info';
}

export const GUIDE_RULES_LIST: RuleItem[] = [
  {
    icon: '🚫', title: 'ห้ามส่งโพยหลังปิดรอบ',
    detail: 'ระบบจะปฏิเสธโพยที่ส่งหลังเวลาปิดโดยอัตโนมัติ ไม่มีการรับย้อนหลัง',
    severity: 'danger',
  },
  {
    icon: '🚫', title: 'ห้ามใช้บัญชีร่วมกัน',
    detail: 'บัญชีถูกระบุตัวตนรายคน หากพบการใช้ร่วมกัน ระบบอาจระงับบัญชี',
    severity: 'danger',
  },
  {
    icon: '🚫', title: 'ห้ามพยายามแก้ไขผลย้อนหลัง',
    detail: 'ทุกการแก้ไขผลจะถูกบันทึกพร้อมผู้ทำ เวลา และเหตุผล (audit trail) และมี checksum ตรวจการแก้ข้อมูล',
    severity: 'danger',
  },
  {
    icon: '⚠️', title: 'ตรวจเลขก่อนยืนยันทุกครั้ง',
    detail: 'เมื่อยืนยันแล้วแก้ไม่ได้ ระบบจะไม่รับผิดชอบความผิดพลาดจากการกรอกเลขผิด',
    severity: 'warning',
  },
  {
    icon: '⚠️', title: 'เก็บเลขที่โพยไว้',
    detail: 'เลขที่โพยใช้ตรวจสอบกรณีมีข้อโต้แย้ง ควรเก็บไว้จนกว่าจะได้รับเงินรางวัล',
    severity: 'warning',
  },
  {
    icon: '⚠️', title: 'ตรวจสอบยอดเงินสม่ำเสมอ',
    detail: 'ตรวจเครดิตคงเหลือและประวัติการเล่นเป็นประจำ หากพบรายการที่ไม่รู้จักให้แจ้งทันที',
    severity: 'warning',
  },
  {
    icon: 'ℹ️', title: 'เวลาทำการ',
    detail: 'ระบบเปิดรับแทงตามรอบที่กำหนด ตรวจตารางรอบได้ที่หน้าประเภทหวย',
    severity: 'info',
  },
  {
    icon: 'ℹ️', title: 'การช่วยเหลือ',
    detail: 'หากมีปัญหาการใช้งาน ให้ติดต่อเอเย่นต์หรือผู้ดูแลระบบพร้อมแจ้งเลขที่โพยและเวลาที่เกิดปัญหา',
    severity: 'info',
  },
];

/* ==================================================================
 * 7. ★ สร้างภาพกติกา (HTML/SVG) — ใช้แสดงบนหน้าจอ
 * ================================================================== */

/**
 * สร้าง SVG แผนภาพสูตรการคำนวณ
 * ใช้แสดงเป็น "ภาพกติกา" ในหน้าคู่มือ
 */
export function buildFormulaSvg(opts: { width?: number; height?: number } = {}): string {
  const W = opts.width ?? 860;
  const H = opts.height ?? 300;
  const ex = exampleNormal();
  const slots = ex.slots;

  // วาด 20 ช่องเรียงเป็น 2 แถว แถวละ 10
  const boxW = 52, boxH = 34, gapX = 8, gapY = 10;
  const gridW = 10 * boxW + 9 * gapX;
  const startX = (W - gridW) / 2;
  const startY = 54;

  let boxes = '';
  slots.forEach((s, i) => {
    const row = Math.floor(i / 10);
    const col = i % 10;
    const x = startX + col * (boxW + gapX);
    const y = startY + row * (boxH + gapY);
    const isSub = i + 1 === SUBTRACT_SLOT_POSITION;
    const isNonZero = s !== '000000';
    const fill = isSub ? '#dc2626' : isNonZero ? '#2563eb' : '#f5efe2';
    const textColor = isSub || isNonZero ? '#ffffff' : '#9a8f80';
    const stroke = isSub ? '#b91c1c' : isNonZero ? '#1d4ed8' : '#e8dfcc';
    boxes += `
  <g>
    <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="6"
          fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <text x="${x + boxW / 2}" y="${y + boxH / 2 - 5}" text-anchor="middle"
          font-size="9" fill="${textColor}" opacity="0.85">${i + 1}</text>
    <text x="${x + boxW / 2}" y="${y + boxH / 2 + 9}" text-anchor="middle"
          font-size="10" font-weight="600" fill="${textColor}"
          font-family="ui-monospace, monospace">${s}</text>
  </g>`;
  });

  const legendY = startY + 2 * boxH + gapY + 22;
  const formulaY = legendY + 34;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">
  <style>
    .t { font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif; }
    .m { font-family: ui-monospace, SFMono-Regular, monospace; }
  </style>

  <text x="${W / 2}" y="26" text-anchor="middle" class="t"
        font-size="15" font-weight="700" fill="#3d3226">
    วิธีคำนวณผลรางวัล — ${SLOT_COUNT} ช่อง × ${DIGITS_PER_SLOT} หลัก
  </text>
  <text x="${W / 2}" y="44" text-anchor="middle" class="m"
        font-size="11" fill="#7d5a38">
    ${GUIDE_RULES.formulaShort}
  </text>

${boxes}

  <g transform="translate(${startX}, ${legendY})">
    <rect x="0" y="-10" width="14" height="14" rx="3" fill="#2563eb"/>
    <text x="20" y="1" class="t" font-size="11" fill="#3d3226">ช่องที่มีค่า</text>
    <rect x="120" y="-10" width="14" height="14" rx="3" fill="#f5efe2" stroke="#e8dfcc"/>
    <text x="140" y="1" class="t" font-size="11" fill="#3d3226">ช่องที่เป็น 0</text>
    <rect x="250" y="-10" width="14" height="14" rx="3" fill="#dc2626"/>
    <text x="270" y="1" class="t" font-size="11" fill="#3d3226">ช่องที่ ${SUBTRACT_SLOT_POSITION} — ใช้หักออก</text>
  </g>

  <g transform="translate(${startX}, ${formulaY})">
    <rect x="0" y="-16" width="${gridW}" height="70" rx="8"
          fill="#fffdf8" stroke="#e8dfcc"/>
    <text x="16" y="4" class="m" font-size="12" fill="#3d3226">
      1) ผลรวมทั้ง ${SLOT_COUNT} ช่อง = <tspan font-weight="700" fill="#2563eb">${ex.result.sum.toLocaleString('en-US')}</tspan>
    </text>
    <text x="16" y="22" class="m" font-size="12" fill="#3d3226">
      2) หักช่องที่ ${SUBTRACT_SLOT_POSITION} = <tspan font-weight="700" fill="#dc2626">− ${ex.result.subtractValue.toLocaleString('en-US')}</tspan>
    </text>
    <text x="16" y="40" class="m" font-size="12" fill="#3d3226">
      3) ผลต่าง = <tspan font-weight="700">${ex.result.raw.toLocaleString('en-US')}</tspan>
      <tspan fill="#9a8f80"> → mod ${RESULT_MODULO.toLocaleString('en-US')} = </tspan>
      <tspan font-weight="700" fill="#7d5a38" font-size="14">${ex.result.result}</tspan>
    </text>
    <text x="${gridW - 16}" y="-4" text-anchor="end" class="t" font-size="11" fill="#9a8f80">
      ผลรางวัล = ${formatResult(ex.result.result)}
    </text>
  </g>
</svg>`;
}

/**
 * สร้าง SVG แผนภาพ "วิธีอ่านผล" — แสดงผล 6 หลักแยกส่วน
 */
export function buildReadingSvg(opts: { result?: string; width?: number } = {}): string {
  const W = opts.width ?? 860;
  const H = 250;
  const r = (opts.result || '123456').padStart(6, '0').slice(-6);
  const digits = r.split('');

  const boxW = 76, boxH = 84, gap = 14;
  const totalW = 6 * boxW + 5 * gap;
  const startX = (W - totalW) / 2;
  const y = 76;

  // กลุ่มการอ่าน
  const groups = [
    { label: '2 ตัวล่าง', from: 2, to: 4, color: '#d97706', text: r.slice(2, 4) },
    { label: '3 ตัวบน', from: 3, to: 6, color: '#2563eb', text: r.slice(3, 6) },
  ];

  let boxes = '';
  digits.forEach((d, i) => {
    const x = startX + i * (boxW + gap);
    // หาว่าหลักนี้อยู่ในกลุ่มไหน
    const inTop3 = i >= 3;
    const inBottom2 = i >= 2 && i < 4;
    const color = inTop3 ? '#2563eb' : inBottom2 ? '#d97706' : '#9a8f80';
    const bg = inTop3 ? '#eff6ff' : inBottom2 ? '#fffbeb' : '#faf6ef';
    boxes += `
  <g>
    <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="10"
          fill="${bg}" stroke="${color}" stroke-width="2"/>
    <text x="${x + boxW / 2}" y="${y + 22}" text-anchor="middle"
          font-size="10" fill="#9a8f80">หลักที่ ${i + 1}</text>
    <text x="${x + boxW / 2}" y="${y + 62}" text-anchor="middle"
          font-size="40" font-weight="700" fill="${color}"
          font-family="ui-monospace, monospace">${d}</text>
  </g>`;
  });

  const legendY = y + boxH + 42;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">
  <style>.t { font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif; }</style>

  <text x="${W / 2}" y="30" text-anchor="middle" class="t"
        font-size="15" font-weight="700" fill="#3d3226">
    วิธีอ่านผลรางวัล
  </text>
  <text x="${W / 2}" y="52" text-anchor="middle" class="t"
        font-size="12" fill="#7d5a38">
    ผล ${formatResult(r)} → แยกอ่านได้หลายแบบ
  </text>

${boxes}

  <g transform="translate(${startX}, ${legendY})">
    <rect x="0" y="-14" width="12" height="12" rx="3" fill="#2563eb"/>
    <text x="18" y="-3" class="t" font-size="11" fill="#3d3226">
      3 ตัวบน = <tspan font-weight="700">${r.slice(3, 6)}</tspan> (3 หลักท้าย)
    </text>

    <rect x="220" y="-14" width="12" height="12" rx="3" fill="#d97706"/>
    <text x="238" y="-3" class="t" font-size="11" fill="#3d3226">
      2 ตัวล่าง = <tspan font-weight="700">${r.slice(2, 4)}</tspan> (หลักที่ 3-4)
    </text>

    <rect x="440" y="-14" width="12" height="12" rx="3" fill="#9a8f80"/>
    <text x="458" y="-3" class="t" font-size="11" fill="#3d3226">
      2 ตัวบน = <tspan font-weight="700">${r.slice(4, 6)}</tspan> • 1 ตัว = <tspan font-weight="700">${r.slice(5)}</tspan>
    </text>
  </g>

  <g transform="translate(${startX}, ${legendY + 26})">
    <text x="0" y="0" class="t" font-size="11" fill="#9a8f80">
      ★ ตัวอย่าง: แทง 3 ตัวบน "456" → ถูก • แทง 3 ตัวบน "123" → ไม่ถูก (ต้องเป็น 3 หลักท้าย)
    </text>
  </g>
</svg>`;
}

/* ==================================================================
 * 8. ★ สร้าง SVG ภาพรวมกติกา (สำหรับแชร์/พิมพ์)
 * ================================================================== */

export function buildRulesCardSvg(opts: { width?: number } = {}): string {
  const W = opts.width ?? 760;
  const rows = getPayoutTable();
  const H = 150 + rows.length * 44 + 90;

  const rowsSvg = rows.map((r, i) => {
    const y = 150 + i * 44;
    const ev = 1_000_000 / r.rate;
    const good = ev > 1000000 / 1 ? false : true;
    return `
  <g>
    <rect x="40" y="${y}" width="${W - 80}" height="36" rx="6"
          fill="${i % 2 ? '#fffdf8' : '#faf6ef'}" stroke="#e8dfcc" stroke-width="0.5"/>
    <text x="56" y="${y + 23}" class="t" font-size="13" font-weight="600" fill="#3d3226">${r.label}</text>
    <text x="${W - 300}" y="${y + 23}" class="t" font-size="12" fill="#9a8f80">${r.howToRead}</text>
    <text x="${W - 140}" y="${y + 23}" text-anchor="end" class="m"
          font-size="13" font-weight="700" fill="#7d5a38">${r.rate}×</text>
    <text x="${W - 56}" y="${y + 23}" text-anchor="end" class="t"
          font-size="12" fill="#2563eb">แทง 100 → ${r.exampleWin.toLocaleString('en-US')}</text>
  </g>`;
  }).join('');

  const footY = 150 + rows.length * 44 + 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">
  <style>
    .t { font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif; }
    .m { font-family: ui-monospace, SFMono-Regular, monospace; }
  </style>

  <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#ffffff" stroke="#e8dfcc"/>

  <text x="40" y="46" class="t" font-size="20" font-weight="700" fill="#3d3226">
    กติกาและอัตราจ่าย
  </text>
  <text x="40" y="70" class="t" font-size="13" fill="#7d5a38">
    หวย ${SLOT_COUNT} ช่อง × ${DIGITS_PER_SLOT} หลัก
  </text>

  <rect x="40" y="86" width="${W - 80}" height="46" rx="8" fill="#f0e6d6" stroke="#e8dfcc"/>
  <text x="60" y="106" class="m" font-size="12" fill="#3d3226">
    สูตร:  ${GUIDE_RULES.formulaShort}
  </text>
  <text x="60" y="123" class="m" font-size="11" fill="#7d5a38">
    ช่วงผล: ${GUIDE_RULES.resultMin} – ${GUIDE_RULES.resultMax}   |   ช่องที่ ${SUBTRACT_SLOT_POSITION} เป็นตัวหัก
  </text>

${rowsSvg}

  <text x="40" y="${footY}" class="t" font-size="11" fill="#9a8f80">
    ★ เงินรางวัล = จำนวนเงินที่แทง × อัตราจ่าย • ตรวจเลขให้ดีก่อนยืนยัน เพราะแก้ไม่ได้
  </text>
  <text x="40" y="${footY + 20}" class="t" font-size="11" fill="#9a8f80">
    ★ ทุกการแก้ไขผลย้อนหลังถูกบันทึกพร้อมผู้ทำ เวลา และเหตุผล
  </text>
</svg>`;
}
