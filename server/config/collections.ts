/**
 * server/config/collections.ts
 * ------------------------------------------------------------------
 * แหล่งความจริงเดียว (Single Source of Truth) ของชื่อ Collection ทั้งระบบ
 *
 * กฎ: ห้ามพิมพ์ชื่อ collection เป็น string ตรงๆ ในไฟล์อื่นเด็ดขาด
 *      ให้ import จากไฟล์นี้เสมอ → เปลี่ยนชื่อที่เดียวทั้งระบบเปลี่ยนตาม
 *
 * หมายเหตุการตั้งชื่อ: ใช้ camelCase ทั้งระบบ (lotteryTypes ไม่ใช่ lottery_types)
 *                      ส่วน collection เก่าที่เป็น snake_case จะมี alias กำกับไว้
 */
export const COL = {
  /** ตั้งค่าระบบ (เปิด/ปิดสวิตช์ทั้งหมด) — doc: settings/global */
  SETTINGS: 'settings',

  /** ประเภทหวย — doc id = slug ของหวย เช่น 'thai', 'yeekee' */
  LOTTERY_TYPES: 'lotteryTypes',

  /** รอบหวย — 1 รอบ = 1 งวด */
  LOTTERY_ROUNDS: 'lotteryRounds',

  /** ผลรางวัล — ผูกกับ roundId เสมอ */
  LOTTERY_RESULTS: 'lotteryResults',

  /** เลขอั้น (limbo) */
  BLOCKED_NUMBERS: 'blocked_numbers',

  /** โพยที่ยืนยันแล้ว (ตัดเครดิตแล้ว) */
  TICKETS: 'tickets',

  /** คิวโพย (รอประมวลผล) */
  BET_QUEUE: 'bet_queue',

  /** ธุรกรรมเงินเข้า-ออกทั้งหมด */
  TRANSACTIONS: 'transactions',

  /** สมาชิก */
  USERS: 'users',

  /** เอเย่นต์ */
  AGENTS: 'agents',

  /** API Keys */
  API_KEYS: 'api_keys',

  /** บันทึกการใช้งาน API (audit log) — เส้นมอนิเตอร์ */
  API_LOGS: 'api_logs',

  /** บิล/ใบเสร็จ ที่ส่งออกให้ลูกค้า — เส้นส่งบิล */
  INVOICES: 'invoices',

  /** รหัสเลขชุด (ชุดเลขที่แยกจากโพย) — เส้นลดเลข */
  NUMBER_SETS: 'numberSets',

  /** ประวัติการลดเลข (audit ว่าใครลด เลขไหน เท่าไร) */
  NUMBER_SET_ITEMS: 'numberSetItems',

  /* ================================================================
   * ★ หวย 20 ช่อง 6 หลัก (module: game20)
   * ================================================================ */

  /** รอบหวย 20 ช่อง — doc id = roundId */
  GAME20_ROUNDS: 'game20Rounds',

  /** ค่าตั้งต้นของโมดูล — doc: game20Config/main (มีบอท/อัตราจ่าย/ขีดจำกัด) */
  GAME20_CONFIG: 'game20Config',

  /** ★ ประวัติทุกเหตุการณ์ (ปิดรอบ/แก้ผล/แก้ค่า) พร้อม checksum */
  GAME20_HISTORY: 'game20History',

  /** ★ รหัส (ล็อกผล/เปิดปิดรอบ/ผู้ดูแล) — เก็บเฉพาะ hash */
  GAME20_CODES: 'game20Codes',

  /** บันทึกการใช้บอท (audit) */
  GAME20_BOTLOGS: 'game20BotLogs',

  /* ================================================================
   * ★ หลังบ้าน: พนักงาน/สิทธิ์/คู่มือ
   * ================================================================ */

  /** พนักงานหลังบ้าน + สิทธิ์รายคน (role, perms, grantedExtra, revoked) */
  STAFF: 'staff',

  /** ประวัติการตั้งค่า (audit trail ก่อน→หลัง) */
  ADMIN_LOGS: 'adminLogs',

  /** ★ คู่มือ/ตั้งค่า: เก็บเนื้อหาคู่มือที่แก้ไขได้จากหลังบ้าน */
  MANUALS: 'manuals',

  /* ================================================================
   * ★ หวยยี่กี 88 รอบ (module: yeekee)
   * ================================================================ */

  /** รอบหวยยี่กี 88 รอบ */
  YEEKEE_ROUNDS: 'yeekeeRounds',

  /** ประวัติการยิงเลขยี่กี */
  YEEKEE_SHOOTS: 'yeekeeShoots',

  /** การตั้งค่าระบบยี่กี */
  YEEKEE_CONFIG: 'yeekeeConfig',
} as const;

export type CollectionName = (typeof COL)[keyof typeof COL];

/**
 * ชื่อ Field มาตรฐาน — ใช้เหมือนกันทุกที่ ห้ามคิดชื่อใหม่เอง
 */
export const FIELD = {
  /** slug ของหวย (ใช้เป็น key อ้างอิง ไม่ใช่ชื่อไทย) */
  LOTTERY_SLUG: 'lotterySlug',
  /** ประเภทการเล่นของโพย เช่น '3ตัวบน' */
  BET_TYPE: 'betType',
  /** จำนวนเงิน */
  AMOUNT: 'amount',
  /** รอบที่โพยนี้สังกัด */
  ROUND_ID: 'roundId',
  /** ผู้ใช้ */
  USER_ID: 'userId',

  /* ---- หวย 20 ช่อง 6 หลัก ---- */
  /** เลข 20 ช่อง (array ของ string 6 หลัก) */
  SLOTS: 'slots',
  /** ผลลัพธ์ 6 หลัก */
  RESULT: 'result',
  /** โหมดที่บอทใช้เลือกผล */
  RESULT_MODE: 'mode',
  /** seed ที่ใช้ (ตรวจย้อนหลังได้) */
  SEED: 'seed',
  /** ตรวจแล้วว่าเลขตรงกับผล */
  VERIFIED: 'verified',
} as const;

/**
 * ชื่อ Field เก่าที่ต้องรองรับระหว่างช่วงเปลี่ยนผ่าน (migration)
 * อ่านได้ทั้งเก่าและใหม่ / เขียนเป็นชื่อใหม่เสมอ
 */
export const LEGACY_FIELD = {
  /** @deprecated ใช้ FIELD.LOTTERY_SLUG แทน */
  TICKET_TYPE: 'ticketType',
  /** @deprecated ใช้ FIELD.LOTTERY_SLUG แทน */
  LOTTERY_TYPE: 'lotteryType',
} as const;

/**
 * ค่าคงที่ของวงจรชีวิตโพย — ใช้ค่าชุดนี้เท่านั้น
 * confirmed → win | lose | cancelled
 */
export const TICKET_STATUS = {
  CONFIRMED: 'confirmed',
  WIN: 'win',
  LOSE: 'lose',
  CANCELLED: 'cancelled',
  SETTLED: 'settled',
} as const;

/** สถานะคิว */
export const QUEUE_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  DONE: 'done',
  FAILED: 'failed',
} as const;

/** ประเภทธุรกรรม */
export const TX_TYPE = {
  BET: 'bet',
  WIN: 'win',
  REFUND: 'refund',
  TOPUP: 'topup',
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw',
  ADJUST: 'adjust',
} as const;
