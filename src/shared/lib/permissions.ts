/**
 * src/shared/lib/permissions.ts
 * ------------------------------------------------------------------
 * ★ ระบบจัดการสิทธิ์การใช้งาน (Role & Permission System) ★
 *
 * ผู้ใช้ขอ: "ทำระบบ จัดการสิทธิ์ฟังชั่น ด้วยเพื่อปิดสิทธิ์ให้พนักงานในเว็บนั้นๆ"
 *
 * ------------------------------------------------------------------
 * แนวคิด: Permission-based (ไม่ใช่แค่ Role-based)
 * ------------------------------------------------------------------
 * ปัญหาของระบบเดิม:
 *   - ใช้ localStorage 'adminAuth' = 'true'  (boolean เดียว)
 *   - ถ้าล็อกอินได้ = เห็นทุกอย่าง ทำได้ทุกอย่าง
 *   - ไม่มีทาง "ปิดสิทธิ์บางฟังชั่นให้พนักงาน"
 *   - role มีแค่ 'admin' | 'agent' | 'user' ตายตัว
 *
 * ระบบใหม่มี 3 ชั้น:
 *   1. ROLE      — ตำแหน่ง (owner/master/admin/staff/agent/viewer)
 *   2. PERMISSION — สิทธิ์ย่อย 40+ รายการ จัดกลุ่มตามหมวด
 *   3. OVERRIDE  — สิทธิ์เฉพาะบุคคล (ให้/ถอด เพิ่มจาก role)
 *
 * ★ หลักการสำคัญ: "ปฏิเสธโดยปริยาย" (deny by default)
 *   ถ้าไม่ได้ระบุสิทธิ์ไว้ = ห้าม
 *   ต่างจากระบบเดิมที่ "ล็อกอินได้ = ทำได้ทุกอย่าง"
 * ==================================================================
 */

/* ==================================================================
 * 1. นิยามสิทธิ์ทั้งหมด (Permission Catalog)
 * ------------------------------------------------------------------
 * รูปแบบ key: '<หมวด>.<การกระทำ>'
 * เพื่อให้จัดกลุ่มและตรวจสอบได้ง่าย
 * ================================================================== */

export const PERMISSIONS = {
  /* ---- ภาพรวม ---- */
  DASHBOARD_VIEW:          'dashboard.view',

  /* ---- สมาชิก ---- */
  MEMBER_VIEW:             'member.view',
  MEMBER_CREATE:           'member.create',
  MEMBER_EDIT:             'member.edit',
  MEMBER_DELETE:           'member.delete',
  MEMBER_CREDIT_ADD:       'member.credit_add',
  MEMBER_CREDIT_REDUCE:    'member.credit_reduce',
  MEMBER_BLOCK:            'member.block',
  MEMBER_RESET_PASSWORD:   'member.reset_password',

  /* ---- เอเย่นต์ ---- */
  AGENT_VIEW:              'agent.view',
  AGENT_CREATE:            'agent.create',
  AGENT_EDIT:              'agent.edit',
  AGENT_DELETE:            'agent.delete',
  AGENT_CREDIT_TRANSFER:   'agent.credit_transfer',
  AGENT_COMMISSION_SET:    'agent.commission_set',

  /* ---- การเงิน ---- */
  FINANCE_VIEW:            'finance.view',
  FINANCE_DEPOSIT_APPROVE: 'finance.deposit_approve',
  FINANCE_WITHDRAW_APPROVE:'finance.withdraw_approve',
  FINANCE_WITHDRAW_PAY:    'finance.withdraw_pay',
  FINANCE_REJECT:          'finance.reject',
  FINANCE_EXPORT:          'finance.export',
  FINANCE_ADJUST:          'finance.adjust',

  /* ---- หวย / รอบหวย ---- */
  LOTTERY_VIEW:            'lottery.view',
  LOTTERY_OPEN_CLOSE:      'lottery.open_close',
  LOTTERY_PAUSE:           'lottery.pause',
  LOTTERY_SET_LIMIT:       'lottery.set_limit',
  LOTTERY_RESULT_ENTER:    'lottery.result_enter',
  LOTTERY_RESULT_EDIT:     'lottery.result_edit',
  LOTTERY_SETTLE:          'lottery.settle',

  /* ---- โพย / การแทง ---- */
  TICKET_VIEW:             'ticket.view',
  TICKET_VIEW_ALL:         'ticket.view_all',
  TICKET_CANCEL:           'ticket.cancel',
  TICKET_VOID:             'ticket.void',
  LOTTERY_SET_VIEW:        'lottery_set.view',
  LOTTERY_SET_EDIT:        'lottery_set.edit',

  /* ---- เลขลด / เลขอั้น ---- */
  NUMBERSET_VIEW:          'numberset.view',
  NUMBERSET_ADD:           'numberset.add',
  NUMBERSET_REMOVE:        'numberset.remove',
  NUMBERSET_SET_LIMIT:     'numberset.set_limit',

  /* ---- ระบบคิว ---- */
  QUEUE_VIEW:              'queue.view',
  QUEUE_PROCESS:           'queue.process',
  QUEUE_CLEAR:             'queue.clear',

  /* ---- ส่งบิล ---- */
  BILLING_VIEW:            'billing.view',
  BILLING_PRINT:           'billing.print',
  BILLING_SEND:            'billing.send',
  BILLING_SET_FORMAT:      'billing.set_format',

  /* ---- มอนิเตอร์ ---- */
  MONITOR_VIEW:            'monitor.view',
  MONITOR_LIVE_BET:        'monitor.live_bet',
  MONITOR_ALERT:           'monitor.alert',

  /* ---- รายงาน ---- */
  REPORT_VIEW:             'report.view',
  REPORT_PLAY:             'report.play',
  REPORT_FINANCE:          'report.finance',
  REPORT_PROFIT:           'report.profit',
  REPORT_EXPORT:           'report.export',

  /* ---- ตั้งค่า ---- */
  SETTINGS_VIEW:           'settings.view',
  SETTINGS_SYSTEM:         'settings.system',
  SETTINGS_RULES:          'settings.rules',
  SETTINGS_POPUP:          'settings.popup',
  SETTINGS_HISTORY_VIEW:   'settings.history_view',
  SETTINGS_HISTORY_ROLLBACK: 'settings.history_rollback',

  /* ---- API ---- */
  API_VIEW:                'api.view',
  API_CREATE_KEY:          'api.create_key',
  API_REVOKE_KEY:          'api.revoke_key',
  API_SET_SCOPE:           'api.set_scope',

  /* ---- พนักงาน ---- */
  STAFF_VIEW:              'staff.view',
  STAFF_CREATE:            'staff.create',
  STAFF_EDIT:              'staff.edit',
  STAFF_DELETE:            'staff.delete',
  STAFF_SET_PERMISSION:    'staff.set_permission',

  /* ---- ★ หวย 20 ช่อง 6 หลัก ---- */
  GAME20_VIEW:             'game20.view',
  GAME20_CONFIG:           'game20.config',
  GAME20_RATES:            'game20.rates',
  GAME20_BOT_RESULT:       'game20.bot_result',
  GAME20_BOT_NUMBER:       'game20.bot_number',
  GAME20_HISTORY:          'game20.history',
  GAME20_EDIT_RESULT:      'game20.edit_result',
  GAME20_CODES:            'game20.codes',
  GAME20_RISK_LIMITS:      'game20.risk_limits',
  GAME20_REPORT:           'game20.report',
  GAME20_CLOSE_ROUND:      'game20.close_round',

  /* ---- ความปลอดภัย ---- */
  SECURITY_VIEW:           'security.view',
  SECURITY_LOG_VIEW:       'security.log_view',
  SECURITY_IP_WHITELIST:   'security.ip_whitelist',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/* ==================================================================
 * 2. หมวดของสิทธิ์ + ป้ายชื่อไทย
 * ================================================================== */

export interface PermissionGroup {
  key: string;
  label: string;
  icon: string;
  perms: { key: Permission; label: string; desc?: string; risk?: RiskLevel }[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'dashboard', label: 'ภาพรวม', icon: 'dashboard',
    perms: [
      { key: PERMISSIONS.DASHBOARD_VIEW, label: 'ดูแดชบอร์ด', risk: 'low' },
    ],
  },
  {
    key: 'member', label: 'สมาชิก', icon: 'group',
    perms: [
      { key: PERMISSIONS.MEMBER_VIEW,            label: 'ดูรายชื่อสมาชิก',    risk: 'low' },
      { key: PERMISSIONS.MEMBER_CREATE,          label: 'เพิ่มสมาชิก',        risk: 'medium' },
      { key: PERMISSIONS.MEMBER_EDIT,            label: 'แก้ไขข้อมูลสมาชิก',  risk: 'medium' },
      { key: PERMISSIONS.MEMBER_DELETE,          label: 'ลบสมาชิก',           risk: 'critical' },
      { key: PERMISSIONS.MEMBER_CREDIT_ADD,      label: 'เพิ่มเครดิต',        risk: 'critical' },
      { key: PERMISSIONS.MEMBER_CREDIT_REDUCE,   label: 'ลดเครดิต',           risk: 'critical' },
      { key: PERMISSIONS.MEMBER_BLOCK,           label: 'ระงับ/ปลดระงับ',     risk: 'high' },
      { key: PERMISSIONS.MEMBER_RESET_PASSWORD,  label: 'รีเซ็ตรหัสผ่าน',     risk: 'high' },
    ],
  },
  {
    key: 'agent', label: 'เอเย่นต์', icon: 'support_agent',
    perms: [
      { key: PERMISSIONS.AGENT_VIEW,             label: 'ดูรายชื่อเอเย่นต์',  risk: 'low' },
      { key: PERMISSIONS.AGENT_CREATE,           label: 'เพิ่มเอเย่นต์',      risk: 'high' },
      { key: PERMISSIONS.AGENT_EDIT,             label: 'แก้ไขเอเย่นต์',      risk: 'medium' },
      { key: PERMISSIONS.AGENT_DELETE,           label: 'ลบเอเย่นต์',         risk: 'critical' },
      { key: PERMISSIONS.AGENT_CREDIT_TRANSFER,  label: 'โอนเครดิต',          risk: 'critical' },
      { key: PERMISSIONS.AGENT_COMMISSION_SET,   label: 'ตั้งค่าคอมมิชชัน',   risk: 'high' },
    ],
  },
  {
    key: 'finance', label: 'การเงิน', icon: 'account_balance_wallet',
    perms: [
      { key: PERMISSIONS.FINANCE_VIEW,              label: 'ดูรายการเงิน',       risk: 'low' },
      { key: PERMISSIONS.FINANCE_DEPOSIT_APPROVE,   label: 'อนุมัติฝาก',         risk: 'critical' },
      { key: PERMISSIONS.FINANCE_WITHDRAW_APPROVE,  label: 'อนุมัติถอน',         risk: 'critical' },
      { key: PERMISSIONS.FINANCE_WITHDRAW_PAY,      label: 'จ่ายเงินถอน',        risk: 'critical' },
      { key: PERMISSIONS.FINANCE_REJECT,            label: 'ปฏิเสธรายการ',       risk: 'high' },
      { key: PERMISSIONS.FINANCE_ADJUST,            label: 'ปรับยอดด้วยมือ',     risk: 'critical' },
      { key: PERMISSIONS.FINANCE_EXPORT,            label: 'ส่งออกรายการ',       risk: 'medium' },
    ],
  },
  {
    key: 'lottery', label: 'หวย / รอบหวย', icon: 'casino',
    perms: [
      { key: PERMISSIONS.LOTTERY_VIEW,          label: 'ดูตั้งค่าหวย',        risk: 'low' },
      { key: PERMISSIONS.LOTTERY_OPEN_CLOSE,    label: 'เปิด/ปิดรับแทง',      risk: 'high' },
      { key: PERMISSIONS.LOTTERY_PAUSE,         label: 'พักรับแทง',           risk: 'medium' },
      { key: PERMISSIONS.LOTTERY_SET_LIMIT,     label: 'ตั้งวงเงินรับ',       risk: 'high' },
      { key: PERMISSIONS.LOTTERY_RESULT_ENTER,  label: 'กรอกผลรางวัล',        risk: 'critical' },
      { key: PERMISSIONS.LOTTERY_RESULT_EDIT,   label: 'แก้ผลรางวัล',         risk: 'critical' },
      { key: PERMISSIONS.LOTTERY_SETTLE,        label: 'ตัดยอด/จ่ายรางวัล',   risk: 'critical' },
    ],
  },
  {
    key: 'ticket', label: 'โพย / การแทง', icon: 'receipt_long',
    perms: [
      { key: PERMISSIONS.TICKET_VIEW,        label: 'ดูโพย',                risk: 'low' },
      { key: PERMISSIONS.TICKET_VIEW_ALL,    label: 'ดูโพยทุกเอเย่นต์',     risk: 'medium' },
      { key: PERMISSIONS.TICKET_CANCEL,      label: 'ยกเลิกโพย + คืนเครดิต', risk: 'critical' },
      { key: PERMISSIONS.TICKET_VOID,        label: 'ทำโพยเป็นโมฆะ',        risk: 'critical' },
      { key: PERMISSIONS.LOTTERY_SET_VIEW,   label: 'ดูหวยชุด',             risk: 'low' },
      { key: PERMISSIONS.LOTTERY_SET_EDIT,   label: 'แก้ตั้งค่าหวยชุด',      risk: 'high' },
    ],
  },
  {
    key: 'numberset', label: 'ลดเลข / เลขอั้น', icon: 'block',
    perms: [
      { key: PERMISSIONS.NUMBERSET_VIEW,       label: 'ดูรายการลดเลข',    risk: 'low' },
      { key: PERMISSIONS.NUMBERSET_ADD,        label: 'เพิ่มเลขลด',        risk: 'high' },
      { key: PERMISSIONS.NUMBERSET_REMOVE,     label: 'ลบเลขลด',           risk: 'high' },
      { key: PERMISSIONS.NUMBERSET_SET_LIMIT,  label: 'ตั้งวงเงินต่อเลข',  risk: 'high' },
    ],
  },
  {
    key: 'queue', label: 'ระบบคิว', icon: 'queue',
    perms: [
      { key: PERMISSIONS.QUEUE_VIEW,     label: 'ดูสถานะคิว',        risk: 'low' },
      { key: PERMISSIONS.QUEUE_PROCESS,  label: 'ประมวลผลคิว',       risk: 'high' },
      { key: PERMISSIONS.QUEUE_CLEAR,    label: 'ล้างคิว',           risk: 'critical' },
    ],
  },
  {
    key: 'billing', label: 'ส่งบิล', icon: 'print',
    perms: [
      { key: PERMISSIONS.BILLING_VIEW,        label: 'ดูบิล',            risk: 'low' },
      { key: PERMISSIONS.BILLING_PRINT,       label: 'พิมพ์บิล',         risk: 'low' },
      { key: PERMISSIONS.BILLING_SEND,        label: 'ส่งบิลให้ลูกค้า',  risk: 'medium' },
      { key: PERMISSIONS.BILLING_SET_FORMAT,  label: 'ตั้งรูปแบบบิล',    risk: 'medium' },
    ],
  },
  {
    key: 'monitor', label: 'มอนิเตอร์', icon: 'monitor_heart',
    perms: [
      { key: PERMISSIONS.MONITOR_VIEW,      label: 'ดูมอนิเตอร์',         risk: 'low' },
      { key: PERMISSIONS.MONITOR_LIVE_BET,  label: 'ดูการแทงสด',          risk: 'medium' },
      { key: PERMISSIONS.MONITOR_ALERT,     label: 'ตั้งการแจ้งเตือน',    risk: 'medium' },
    ],
  },
  {
    key: 'report', label: 'รายงาน', icon: 'assessment',
    perms: [
      { key: PERMISSIONS.REPORT_VIEW,     label: 'ดูรายงาน',            risk: 'low' },
      { key: PERMISSIONS.REPORT_PLAY,     label: 'รายงานการเล่น',       risk: 'low' },
      { key: PERMISSIONS.REPORT_FINANCE,  label: 'รายงานการเงิน',       risk: 'medium' },
      { key: PERMISSIONS.REPORT_PROFIT,   label: 'รายงานกำไร/ขาดทุน',   risk: 'high' },
      { key: PERMISSIONS.REPORT_EXPORT,   label: 'ส่งออกรายงาน',        risk: 'medium' },
    ],
  },
  {
    key: 'settings', label: 'ตั้งค่า', icon: 'settings',
    perms: [
      { key: PERMISSIONS.SETTINGS_VIEW,               label: 'ดูหน้าตั้งค่า',        risk: 'low' },
      { key: PERMISSIONS.SETTINGS_SYSTEM,             label: 'แก้ตั้งค่าระบบ',       risk: 'critical' },
      { key: PERMISSIONS.SETTINGS_RULES,              label: 'แก้กติกาการเล่น',      risk: 'medium' },
      { key: PERMISSIONS.SETTINGS_POPUP,              label: 'แก้ป๊อปอัพ',           risk: 'medium' },
      { key: PERMISSIONS.SETTINGS_HISTORY_VIEW,       label: 'ดูประวัติการตั้งค่า',  risk: 'medium' },
      { key: PERMISSIONS.SETTINGS_HISTORY_ROLLBACK,   label: 'ย้อนค่าการตั้งค่า',    risk: 'critical' },
    ],
  },
  {
    key: 'api', label: 'API', icon: 'api',
    perms: [
      { key: PERMISSIONS.API_VIEW,        label: 'ดูคีย์ API',        risk: 'low' },
      { key: PERMISSIONS.API_CREATE_KEY,  label: 'สร้างคีย์ API',     risk: 'critical' },
      { key: PERMISSIONS.API_REVOKE_KEY,  label: 'ยกเลิกคีย์ API',    risk: 'critical' },
      { key: PERMISSIONS.API_SET_SCOPE,   label: 'ตั้งขอบเขตคีย์',    risk: 'high' },
    ],
  },
  {
    key: 'staff', label: 'พนักงาน', icon: 'badge',
    perms: [
      { key: PERMISSIONS.STAFF_VIEW,            label: 'ดูรายชื่อพนักงาน',     risk: 'low' },
      { key: PERMISSIONS.STAFF_CREATE,          label: 'เพิ่มพนักงาน',         risk: 'high' },
      { key: PERMISSIONS.STAFF_EDIT,            label: 'แก้ไขพนักงาน',         risk: 'high' },
      { key: PERMISSIONS.STAFF_DELETE,          label: 'ลบพนักงาน',            risk: 'critical' },
      { key: PERMISSIONS.STAFF_SET_PERMISSION,  label: '★ ตั้งสิทธิ์พนักงาน',  risk: 'critical' },
    ],
  },
  {
    key: 'game20', label: '★ หวย 20 ช่อง 6 หลัก', icon: 'grid_on',
    perms: [
      { key: PERMISSIONS.GAME20_VIEW,         label: 'ดูหวย 20 ช่อง',       risk: 'low' },
      { key: PERMISSIONS.GAME20_REPORT,       label: 'ดูรายงานกำไร-ขาดทุน', risk: 'medium' },
      { key: PERMISSIONS.GAME20_HISTORY,      label: 'ดูประวัติ/รหัส',       risk: 'medium' },
      { key: PERMISSIONS.GAME20_CLOSE_ROUND,  label: '★ ปิดรอบ',             risk: 'high' },
      { key: PERMISSIONS.GAME20_CONFIG,       label: '★ ตั้งค่าระบบ',         risk: 'high' },
      { key: PERMISSIONS.GAME20_RATES,        label: '★ ตั้งอัตราจ่าย',       risk: 'high' },
      { key: PERMISSIONS.GAME20_RISK_LIMITS,  label: '★ เพดานความเสี่ยง',     risk: 'high' },
      { key: PERMISSIONS.GAME20_CODES,        label: '★ จัดการรหัส',          risk: 'critical' },
      { key: PERMISSIONS.GAME20_BOT_NUMBER,   label: '★ บอทวางเลข',          risk: 'critical' },
      { key: PERMISSIONS.GAME20_BOT_RESULT,   label: '★ บอทออกผล',           risk: 'critical' },
      { key: PERMISSIONS.GAME20_EDIT_RESULT,  label: '★ แก้ผลย้อนหลัง',       risk: 'critical' },
    ],
  },
  {
    key: 'security', label: 'ความปลอดภัย', icon: 'security',
    perms: [
      { key: PERMISSIONS.SECURITY_VIEW,          label: 'ดูความปลอดภัย',      risk: 'low' },
      { key: PERMISSIONS.SECURITY_LOG_VIEW,      label: 'ดูบันทึกกิจกรรม',    risk: 'medium' },
      { key: PERMISSIONS.SECURITY_IP_WHITELIST,  label: 'จัดการ IP ไวท์ลิสต์', risk: 'critical' },
    ],
  },
];

/** สร้าง map: permission → {label, group, risk} เพื่อค้นหาเร็ว */
export const PERMISSION_META: Record<string, { label: string; group: string; groupLabel: string; icon: string; risk: RiskLevel }> = (() => {
  const m: Record<string, any> = {};
  PERMISSION_GROUPS.forEach(g => {
    g.perms.forEach(p => {
      m[p.key] = { label: p.label, group: g.key, groupLabel: g.label, icon: g.icon, risk: p.risk || 'low' };
    });
  });
  return m;
})();

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.key));

/* ==================================================================
 * 3. Role — ตำแหน่ง พร้อมสิทธิ์เริ่มต้น
 * ------------------------------------------------------------------
 * ★ ปรับได้: role เหล่านี้เป็น "ค่าตั้งต้น" เท่านั้น
 *   เจ้าของร้านสามารถ override รายบุคคลได้
 * ================================================================== */

export type RoleKey = 'provider' | 'owner' | 'master' | 'admin' | 'staff' | 'agent' | 'viewer';

export interface RoleDef {
  key: RoleKey;
  label: string;
  desc: string;
  color: string;
  /** สิทธิ์ที่ได้จากตำแหน่ง */
  perms: Permission[];
  /** ซ่อนจากหน้าจัดการพนักงานหรือไม่ (provider/owner/master สร้างผ่านระบบไม่ได้) */
  locked?: boolean;
}

const P = PERMISSIONS;
const ALL = ALL_PERMISSIONS;

export const ROLES: Record<RoleKey, RoleDef> = {
  provider: {
    key: 'provider',
    label: 'คนผลิต (System Provider)',
    desc: 'สิทธิ์ใหญ่สุดระดับผู้ผลิตระบบ คุมสถาปัตยกรรม สวิตช์แม่ และจัดการ 2FA ทุกบัญชี',
    color: '#4c1d95',
    perms: ALL,
    locked: true,
  },
  owner: {
    key: 'owner', label: 'เจ้าของระบบ (Owner)', desc: 'เจ้าของร้าน/ผู้บริหารสูงสุด ดูแลความเสี่ยง ตั้งค่า 5 กลุ่มฟังก์ชัน และรีเซ็ต 2FA พนักงาน',
    color: '#7c2d12', perms: ALL, locked: true,
  },
  master: {
    key: 'master', label: 'Master Admin', desc: 'ดูแลทุกแบรนด์/โปรเจกต์ สิทธิ์เทียบเท่าเจ้าของ',
    color: '#9a3412', perms: ALL, locked: true,
  },
  admin: {
    key: 'admin', label: 'ผู้จัดการ (Manager)', desc: 'ดูแลระบบประจำวันครบวงจร ยกเว้นตั้งสิทธิ์พนักงาน',
    color: '#1e5fa8', perms: ALL.filter(p =>
      p !== P.STAFF_SET_PERMISSION &&
      p !== P.STAFF_DELETE &&
      p !== P.SECURITY_IP_WHITELIST &&
      p !== P.API_REVOKE_KEY &&
      p !== P.SETTINGS_HISTORY_ROLLBACK &&
      // ★ หวย 20 ช่อง: admin แก้ผลย้อนหลัง/จัดการรหัสไม่ได้ (ต้อง owner/master)
      p !== P.GAME20_EDIT_RESULT &&
      p !== P.GAME20_CODES
    ),
  },
  staff: {
    key: 'staff', label: 'พนักงาน', desc: 'ทำงานประจำวัน ตามสิทธิ์ที่ได้รับมอบหมาย',
    color: '#047857', perms: [
      P.DASHBOARD_VIEW,
      P.MEMBER_VIEW, P.MEMBER_CREDIT_ADD,
      P.FINANCE_VIEW, P.FINANCE_DEPOSIT_APPROVE, P.FINANCE_WITHDRAW_APPROVE, P.FINANCE_REJECT,
      P.LOTTERY_VIEW, P.LOTTERY_OPEN_CLOSE, P.LOTTERY_PAUSE,
      P.TICKET_VIEW, P.LOTTERY_SET_VIEW,
      P.BILLING_VIEW, P.BILLING_PRINT,
      P.MONITOR_VIEW, P.MONITOR_LIVE_BET,
      P.REPORT_VIEW, P.REPORT_PLAY,
      // ★ หวย 20 ช่อง: พนักงานดูได้อย่างเดียว
      P.GAME20_VIEW,
    ],
  },
  agent: {
    key: 'agent', label: 'เอเย่นต์', desc: 'เห็นเฉพาะข้อมูลของตัวเองและลูกค้าในสาย',
    color: '#6d28d9', perms: [
      P.DASHBOARD_VIEW,
      P.MEMBER_VIEW, P.MEMBER_CREATE, P.MEMBER_CREDIT_ADD, P.MEMBER_CREDIT_REDUCE,
      P.TICKET_VIEW, P.LOTTERY_SET_VIEW,
      P.BILLING_VIEW, P.BILLING_PRINT,
      P.REPORT_VIEW, P.REPORT_PLAY, P.REPORT_FINANCE,
      // ★ หวย 20 ช่อง: เอเย่นต์ดูได้อย่างเดียว
      P.GAME20_VIEW,
      P.MONITOR_VIEW,
    ],
  },
  viewer: {
    key: 'viewer', label: 'ดูอย่างเดียว', desc: 'ดูได้ทุกอย่าง แต่แก้ไข/ทำรายการไม่ได้',
    color: '#4b5563', perms: ALL.filter(p => p.endsWith('.view')),
  },
};

export const ROLE_LIST: RoleDef[] = ['provider', 'owner', 'master', 'admin', 'staff', 'agent', 'viewer'].map(k => ROLES[k as RoleKey]);

/* ==================================================================
 * 3.5 ★ 5 กลุ่มฟังก์ชันหลัก (Five Functional Permission Groups)
 * ------------------------------------------------------------------
 * ผู้ใช้สั่ง: "ตั้งค่าฟังชั่นออกมา 5 กลุ่ม ขอให้เข้าทางเดียวกัน"
 * ให้เจ้าของระบบเลือกเปิด/ปิดการเข้าถึงให้พนักงานได้แบบกลุ่ม หรือรายสิทธิ์
 * ================================================================== */
export interface FunctionGroupDef {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  desc: string;
  perms: Permission[];
}

export const FIVE_FUNCTION_GROUPS: FunctionGroupDef[] = [
  {
    id: 'group_finance',
    name: '1. กลุ่มการเงิน & ฝาก-ถอน',
    shortName: 'การเงิน',
    icon: 'account_balance_wallet',
    color: '#0284c7',
    desc: 'จัดการเงินสด ตรวจสลิปออโต้ อนุมัติฝาก-ถอน ปรับเครดิต',
    perms: [
      PERMISSIONS.FINANCE_VIEW,
      PERMISSIONS.FINANCE_DEPOSIT_APPROVE,
      PERMISSIONS.FINANCE_WITHDRAW_APPROVE,
      PERMISSIONS.FINANCE_WITHDRAW_PAY,
      PERMISSIONS.FINANCE_REJECT,
      PERMISSIONS.FINANCE_ADJUST,
      PERMISSIONS.FINANCE_EXPORT,
    ],
  },
  {
    id: 'group_lottery_schedule',
    name: '2. กลุ่มควบคุมหวย & จัดตารางรอบ',
    shortName: 'หวย & รอบ',
    icon: 'calendar_month',
    color: '#16a34a',
    desc: 'เปิด-ปิดรับแทง จัดตารางรอบล่วงหน้า ปฏิทิน 4 สถานะ ลบรอบที่ออกผลแล้ว',
    perms: [
      PERMISSIONS.LOTTERY_VIEW,
      PERMISSIONS.LOTTERY_OPEN_CLOSE,
      PERMISSIONS.LOTTERY_PAUSE,
      PERMISSIONS.GAME20_CLOSE_ROUND,
    ],
  },
  {
    id: 'group_risk_intake',
    name: '3. กลุ่มคำนวณรับกิน & ลดความเสี่ยง',
    shortName: 'รับกิน & ลดเสี่ยง',
    icon: 'tune',
    color: '#d97706',
    desc: 'ตั้งอัตราจ่าย สัดส่วนรับกิน ขยายงบลดเสี่ยง เลขอั้น/ลดจ่ายด่วน มอนิเตอร์สด',
    perms: [
      PERMISSIONS.LOTTERY_SET_LIMIT,
      PERMISSIONS.NUMBERSET_VIEW,
      PERMISSIONS.NUMBERSET_ADD,
      PERMISSIONS.NUMBERSET_REMOVE,
      PERMISSIONS.NUMBERSET_SET_LIMIT,
      PERMISSIONS.MONITOR_VIEW,
      PERMISSIONS.MONITOR_LIVE_BET,
      PERMISSIONS.MONITOR_ALERT,
    ],
  },
  {
    id: 'group_results_reports',
    name: '4. กลุ่มออกผลรางวัล & บัญชีรายงาน',
    shortName: 'ผลรางวัล & บัญชี',
    icon: 'assessment',
    color: '#9333ea',
    desc: 'ออกผลรางวัล Dry-run ตรวจผล ตัดสินจ่ายเงิน สรุปกำไรขาดทุน ส่งบิล',
    perms: [
      PERMISSIONS.LOTTERY_RESULT_ENTER,
      PERMISSIONS.LOTTERY_RESULT_EDIT,
      PERMISSIONS.LOTTERY_SETTLE,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_PLAY,
      PERMISSIONS.REPORT_FINANCE,
      PERMISSIONS.REPORT_PROFIT,
      PERMISSIONS.REPORT_EXPORT,
      PERMISSIONS.BILLING_VIEW,
      PERMISSIONS.BILLING_PRINT,
      PERMISSIONS.BILLING_SEND,
    ],
  },
  {
    id: 'group_security_staff',
    name: '5. กลุ่มสมาชิก & พนักงาน & ความปลอดภัย 2FA',
    shortName: 'สมาชิก & 2FA',
    icon: 'security',
    color: '#dc2626',
    desc: 'จัดการข้อมูลสมาชิก พนักงาน กำหนดสิทธิ์ 5 กลุ่ม บังคับ/รีเซ็ต 2FA ตรวจเส้นทางเข้าสู่ระบบ',
    perms: [
      PERMISSIONS.MEMBER_VIEW,
      PERMISSIONS.MEMBER_CREATE,
      PERMISSIONS.MEMBER_EDIT,
      PERMISSIONS.MEMBER_BLOCK,
      PERMISSIONS.MEMBER_RESET_PASSWORD,
      PERMISSIONS.AGENT_VIEW,
      PERMISSIONS.STAFF_VIEW,
      PERMISSIONS.STAFF_CREATE,
      PERMISSIONS.STAFF_EDIT,
      PERMISSIONS.STAFF_SET_PERMISSION,
      PERMISSIONS.SECURITY_VIEW,
      PERMISSIONS.SECURITY_LOG_VIEW,
    ],
  },
];

/* ==================================================================
 * 4. Session — เก็บสิทธิ์ที่คำนวณแล้ว
 * ================================================================== */

export interface StaffSession {
  uid: string;
  username: string;
  displayName: string;
  role: RoleKey;
  /** สิทธิ์ที่ "ให้เพิ่ม" จาก role (override +) */
  grantedExtra?: Permission[];
  /** สิทธิ์ที่ "ถอดออก" จาก role (override -)  ★ ใช้ปิดสิทธิ์พนักงาน */
  revoked?: Permission[];
  /** จำกัดให้เห็นเฉพาะแบรนด์/โปรเจกต์นี้ (ว่าง = ทุกแบรนด์) */
  scopeProjectIds?: string[];
  scopeAgentId?: string;
  loggedInAt?: number;
}

/* ==================================================================
 * 5. ตัวคำนวณสิทธิ์จริง (Effective Permissions)
 * ------------------------------------------------------------------
 * สูตร:  (role.perms ∪ grantedExtra) − revoked
 * ★ revoked ชนะเสมอ — ใช้ "ปิดสิทธิ์" ได้จริงแม้ role จะให้ไว้
 * ================================================================== */

export function effectivePermissions(session: StaffSession | null): Set<Permission> {
  if (!session) return new Set();
  const role = ROLES[session.role];
  if (!role) return new Set();
  if (role.locked) return new Set(role.perms);   // owner/master ไม่ถูกจำกัด

  const set = new Set<Permission>(role.perms);
  (session.grantedExtra || []).forEach(p => set.add(p));
  (session.revoked || []).forEach(p => set.delete(p));
  return set;
}

/** ตรวจสิทธิ์เดียว */
export function can(session: StaffSession | null, perm: Permission): boolean {
  return effectivePermissions(session).has(perm);
}

/** ตรวจหลายสิทธิ์ — โหมด 'any' หรือ 'all' */
export function canAny(session: StaffSession | null, perms: Permission[]): boolean {
  const s = effectivePermissions(session);
  return perms.some(p => s.has(p));
}
export function canAll(session: StaffSession | null, perms: Permission[]): boolean {
  const s = effectivePermissions(session);
  return perms.every(p => s.has(p));
}

/** นับจำนวนสิทธิ์ทั้งหมด */
export function countPermissions(session: StaffSession | null): { total: number; granted: number; revoked: number } {
  const role = session ? ROLES[session.role] : null;
  const base = role ? role.perms.length : 0;
  const granted = (session?.grantedExtra || []).length;
  const revoked = (session?.revoked || []).length;
  return { total: ALL_PERMISSIONS.length, granted: base + granted - revoked, revoked };
}

/* ==================================================================
 * 6. บันทึก / อ่าน session (localStorage)
 * ------------------------------------------------------------------
 * ★ เก็บเป็น JSON ไม่ใช่ boolean เดียวเหมือนเดิม
 * ★ รองรับ session เก่า (adminAuth='true') → แปลงเป็น role admin
 * ================================================================== */

const SESSION_KEY = 'ak88_staff_session';
const LEGACY_KEY  = 'adminAuth';
const LEGACY_ROLE = 'userRole';

export function saveSession(session: StaffSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, loggedInAt: Date.now() }));
  } catch (e) {
    console.error('[permissions] saveSession failed:', e);
  }
}

export function loadSession(): StaffSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.role && ROLES[parsed.role as RoleKey]) return parsed as StaffSession;
    }
    // ★ รองรับ session เก่า — แปลง boolean เป็น role
    if (localStorage.getItem(LEGACY_KEY) === 'true') {
      const legacyRole = localStorage.getItem(LEGACY_ROLE);
      const mapped: RoleKey =
        legacyRole === 'agent' ? 'agent' :
        legacyRole === 'admin' ? 'admin' : 'admin';
      return {
        uid: 'legacy', username: 'legacy-admin', displayName: 'ผู้ดูแล (ระบบเดิม)',
        role: mapped, loggedInAt: Date.now(),
      };
    }
    return null;
  } catch (e) {
    console.error('[permissions] loadSession failed:', e);
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(LEGACY_ROLE);
  } catch (e) { /* ignore */ }
}

/* ==================================================================
 * 7. บันทึกการเปลี่ยนแปลงสิทธิ์ลง Firestore
 * ------------------------------------------------------------------
 * collection: staff (uid, username, role, grantedExtra, revoked, ...)
 * ★ เก็บประวัติทุกครั้งที่แก้สิทธิ์ → collection: permissionLogs
 * ================================================================== */

export interface PermissionChange {
  targetUid: string;
  targetName: string;
  actorName: string;
  action: 'grant' | 'revoke' | 'role_change' | 'create' | 'delete';
  permission?: Permission;
  from?: string;
  to?: string;
  note?: string;
}

export function describeChange(c: PermissionChange): string {
  const meta = c.permission ? PERMISSION_META[c.permission] : null;
  switch (c.action) {
    case 'grant':       return `ให้สิทธิ์ "${meta?.label || c.permission}"`;
    case 'revoke':      return `★ ปิดสิทธิ์ "${meta?.label || c.permission}"`;
    case 'role_change': return `เปลี่ยนตำแหน่ง ${ROLES[c.from as RoleKey]?.label || c.from} → ${ROLES[c.to as RoleKey]?.label || c.to}`;
    case 'create':      return 'สร้างบัญชีพนักงาน';
    case 'delete':      return 'ลบบัญชีพนักงาน';
    default:            return 'แก้ไขสิทธิ์';
  }
}

/* ==================================================================
 * 8. ตัวช่วยแสดงผล
 * ================================================================== */

export const RISK_LABEL: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  low:      { label: 'ปกติ',      color: '#047857', bg: '#ecfdf5' },
  medium:   { label: 'ระวัง',     color: '#b45309', bg: '#fffbeb' },
  high:     { label: 'สำคัญ',     color: '#c2410c', bg: '#fff7ed' },
  critical: { label: 'อันตราย',   color: '#b91c1c', bg: '#fef2f2' },
};

/** นับสิทธิ์ตามหมวด (สำหรับกราฟ/แถบความคืบหน้า) */
export function permissionSummary(session: StaffSession | null) {
  const eff = effectivePermissions(session);
  return PERMISSION_GROUPS.map(g => ({
    key: g.key, label: g.label, icon: g.icon,
    granted: g.perms.filter(p => eff.has(p.key)).length,
    total: g.perms.length,
  }));
}
