/**
 * src/shared/lib/supabase-firestore-adapter.ts
 * ==================================================================
 * ★ Supabase-backed Firestore Compatibility Adapter ★
 * แปลงคำสั่ง Firebase Firestore ทุกคำสั่ง (getDocs, setDoc, onSnapshot ฯลฯ)
 * ให้ทำงานบน Supabase PostgreSQL อัตโนมัติ 100%
 * ==================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ค่าเริ่มต้นสำหรับโปรเจกต์ Supabase (Publishable Key ปลอดภัยสำหรับ Client/Frontend)
const DEFAULT_SUPABASE_URL = 'https://aogylynelbkjjdiclfeq.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_JPASpLsQip_mnqYWsRPCfA_hQAfSCPH';

const getEnv = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  try {
    return (import.meta as any)?.env?.[key];
  } catch {
    return undefined;
  }
};

const supabaseUrl = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL;
const supabaseKey = 
  getEnv('SUPABASE_SERVICE_ROLE_KEY') || 
  getEnv('SUPABASE_ANON_KEY') || 
  getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY') || 
  getEnv('VITE_SUPABASE_ANON_KEY') || 
  DEFAULT_SUPABASE_KEY;

export const supabaseClient: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export const db = {
  type: 'supabase-firestore-adapter',
  client: supabaseClient,
};

// ------------------------------------------------------------------
// Mapping: แปลงชื่อ Firestore Collection -> Supabase Table
// ------------------------------------------------------------------
export function mapCollectionToTable(name: string): string {
  const norm = name.trim();
  switch (norm) {
    case 'lotteryTypes':
    case 'lottery_types':
      return 'lottery_types';
    case 'users':
    case 'members':
    case 'staffUsers':
      return 'users';
    case 'lotteryRounds':
    case 'lottery_rounds':
      return 'lottery_rounds';
    case 'tickets':
      return 'tickets';
    case 'ticket_items':
      return 'ticket_items';
    case 'yeekee_rounds':
    case 'yeekeeRounds':
      return 'yeekee_rounds';
    case 'blocked_numbers':
    case 'blockedNumbers':
      return 'blocked_numbers';
    case 'risk_intake_configs':
    case 'payout_resistance':
      return 'risk_intake_configs';
    case 'transactions':
      return 'transactions';
    case 'settings':
    case 'system_settings':
    case 'apiTenants':
    case 'staff':
      return 'staff';
    case 'lotteryResults':
    case 'lottery_results':
      return 'lottery_results';
    case 'lottery_bet_limits':
      return 'risk_intake_configs';
    case 'permissionLogs':
    case 'permission_logs':
    case 'adminLogs':
    case 'admin_logs':
      return 'permission_logs';
    case 'settingsHistory':
    default:
      return 'system_settings';
  }
}

// ------------------------------------------------------------------
// Helpers: แปลง camelCase <-> snake_case สำหรับคอลัมน์มาตรฐาน
// ------------------------------------------------------------------
function toSnake(data: any, table: string): any {
  if (!data || typeof data !== 'object') return data;
  const out: Record<string, any> = {};

  if (table === 'system_settings') {
    return data;
  }

  // ★ ตาราง users ใน Supabase มีคอลัมน์มาตรฐาน + ข้อมูลธนาคารและตัวแทน
  if (table === 'users') {
    const outUser: Record<string, any> = {};
    if (data.id) outUser.id = String(data.id);
    if (data.username) outUser.username = String(data.username).trim().toLowerCase();
    const phoneVal = data.phone || data.phoneNumber;
    if (phoneVal) outUser.phone = String(phoneVal).trim();
    const passVal = data.passwordHash || data.password || data.password_hash;
    if (passVal) outUser.password_hash = String(passVal);
    outUser.role = data.role || 'member';
    outUser.balance = Number(data.balance) || 0;
    outUser.status = data.status || 'active';
    if (data.first_name || data.firstName) outUser.first_name = String(data.first_name || data.firstName);
    if (data.last_name || data.lastName) outUser.last_name = String(data.last_name || data.lastName);
    if (data.name) outUser.name = String(data.name);
    else if (outUser.first_name) outUser.name = `${outUser.first_name} ${outUser.last_name || ''}`.trim();
    if (data.bank_name || data.bankName) outUser.bank_name = String(data.bank_name || data.bankName);
    if (data.bank_account || data.bankAccount || data.accountNumber) outUser.bank_account = String(data.bank_account || data.bankAccount || data.accountNumber);
    if (data.agent_id || data.agentId) outUser.agent_id = String(data.agent_id || data.agentId);
    if (data.line_id || data.lineId) outUser.line_id = String(data.line_id || data.lineId);
    if (data.createdAt || data.created_at) {
      outUser.created_at = data.createdAt ? (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString()) : data.created_at;
    }
    if (data.updatedAt || data.updated_at) {
      outUser.updated_at = data.updatedAt ? (typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString()) : data.updated_at;
    }
    return outUser;
  }

  // ★ ตาราง tickets ใน Supabase
  if (table === 'tickets') {
    const outTkt: Record<string, any> = {};
    const tktId = data.ticket_id || data.ticketId || data.id;
    if (data.id) outTkt.id = String(data.id);
    else if (tktId) outTkt.id = String(tktId);
    if (tktId) outTkt.ticket_id = String(tktId);
    if (data.user_id || data.userId) outTkt.user_id = String(data.user_id || data.userId);
    outTkt.customer_name = data.customer_name || data.customerName || 'ลูกค้าทั่วไป';
    outTkt.lottery_type = data.lottery_type || data.lotteryType || data.ticketType || 'thai';
    outTkt.lottery_slug = data.lottery_slug || data.lotterySlug || null;
    if (data.round_id || data.roundId) outTkt.round_id = String(data.round_id || data.roundId);
    outTkt.total_amount = Number(data.total_amount ?? data.totalAmount ?? 0);
    outTkt.status = data.status || 'pending';
    outTkt.win_amount = Number(data.win_amount ?? data.winAmount ?? 0);
    outTkt.gross_win_amount = Number(data.gross_win_amount ?? data.grossWinAmount ?? outTkt.win_amount);
    outTkt.tax_amount = Number(data.tax_amount ?? data.taxAmount ?? 0);
    outTkt.tax_rate = Number(data.tax_rate ?? data.taxRate ?? 0);
    if (data.bets) outTkt.bets = Array.isArray(data.bets) ? data.bets : [];
    if (data.winning_bets || data.winningBets) outTkt.winning_bets = data.winning_bets || data.winningBets || [];
    if (data.note || data.description) outTkt.note = String(data.note || data.description);
    if (data.settled_at || data.settledAt) outTkt.settled_at = data.settled_at || data.settledAt;
    if (data.created_at || data.createdAt) outTkt.created_at = data.created_at || data.createdAt;
    if (data.expires_at || data.expiresAt) outTkt.expires_at = data.expires_at || data.expiresAt;
    return outTkt;
  }

  // ★ ตาราง lottery_results ใน Supabase
  if (table === 'lottery_results') {
    const outRes: Record<string, any> = {};
    if (data.id) outRes.id = String(data.id);
    outRes.lottery_type = data.lottery_type || data.lotteryType || data.type || 'thai';
    if (data.round_id || data.roundId) outRes.round_id = String(data.round_id || data.roundId);
    outRes.result_3top = data.result_3top || data.result3Top || null;
    outRes.result_2bottom = data.result_2bottom || data.result2Bottom || null;
    outRes.result_3bottom = data.result_3bottom || data.result3Bottom || null;
    outRes.result_3front = data.result_3front || data.result3Front || null;
    outRes.summary = data.summary || {};
    if (data.settled_by || data.settledBy) outRes.settled_by = String(data.settled_by || data.settledBy);
    outRes.created_at = data.created_at || data.createdAt || new Date().toISOString();
    return outRes;
  }

  // ★ ตาราง transactions ใน Supabase
  if (table === 'transactions') {
    const outTx: Record<string, any> = {};
    if (data.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id)) {
      outTx.id = data.id;
    }
    if (data.user_id || data.userId) outTx.user_id = String(data.user_id || data.userId);
    if (data.username) outTx.username = String(data.username);
    outTx.type = data.type || 'bet';
    outTx.amount = Number(data.amount || 0);
    if (data.gross_amount ?? data.grossAmount) outTx.gross_amount = Number(data.gross_amount ?? data.grossAmount);
    if (data.tax_amount ?? data.taxAmount) outTx.tax_amount = Number(data.tax_amount ?? data.taxAmount);
    if (data.tax_rate ?? data.taxRate) outTx.tax_rate = Number(data.tax_rate ?? data.taxRate);
    if (data.bank_name || data.bankName) outTx.bank_name = String(data.bank_name || data.bankName);
    if (data.bank_account || data.bankAccount) outTx.bank_account = String(data.bank_account || data.bankAccount);
    if (data.trans_ref || data.transRef) outTx.trans_ref = String(data.trans_ref || data.transRef);
    outTx.status = data.status || 'pending';
    if (data.slip_url || data.slipUrl) outTx.slip_url = data.slip_url || data.slipUrl;
    const desc = data.description || data.note;
    if (desc) outTx.description = String(desc);
    outTx.created_at = data.created_at || data.createdAt || new Date().toISOString();
    if (data.updated_at || data.updatedAt) outTx.updated_at = data.updated_at || data.updatedAt;
    return outTx;
  }

  // ★ ตาราง lottery_types ใน Supabase
  if (table === 'lottery_types') {
    const outLot: Record<string, any> = {};
    const lotId = data.id || data.name;
    if (lotId) outLot.id = String(lotId);
    outLot.name = String(data.name || data.title || lotId || 'หวยทั่วไป');
    outLot.category = data.category || 'thai';
    
    // Store image URL or icon emoji in icon column
    if (data.flagUrl || data.flag_url) {
      outLot.icon = String(data.flagUrl || data.flag_url);
      outLot.flag_url = String(data.flagUrl || data.flag_url);
    } else if (data.icon) {
      outLot.icon = String(data.icon);
      if (String(data.icon).startsWith('http') || String(data.icon).startsWith('/')) {
        outLot.flag_url = String(data.icon);
      }
    }
    
    if (data.path) outLot.path = String(data.path);
    
    // is_open handling
    if (data.isOpen !== undefined) outLot.is_open = Boolean(data.isOpen);
    else if (data.is_open !== undefined) outLot.is_open = Boolean(data.is_open);
    else if (data.status !== undefined) outLot.is_open = data.status === 'open';

    if (data.isHidden !== undefined) outLot.is_hidden = Boolean(data.isHidden);
    else if (data.is_hidden !== undefined) outLot.is_hidden = Boolean(data.is_hidden);

    const ct = data.closingTime || data.closeTime || data.close_time;
    if (ct) {
      try {
        outLot.close_time = new Date(ct).toISOString();
      } catch {
        outLot.close_time = null;
      }
    }
    if (data.openTime || data.open_time) outLot.open_time = String(data.openTime || data.open_time);
    if (data.bgGradient || data.bg_gradient) outLot.bg_gradient = String(data.bgGradient || data.bg_gradient);
    
    if (data.rates && typeof data.rates === 'object') {
      const ratesCopy = { ...data.rates };
      if (data.flagUrl || data.flag_url) ratesCopy.flagUrl = data.flagUrl || data.flag_url;
      outLot.rates = ratesCopy;
    } else if (data.flagUrl || data.flag_url) {
      outLot.rates = { flagUrl: data.flagUrl || data.flag_url };
    }
    
    if (data.discounts && typeof data.discounts === 'object') outLot.discounts = data.discounts;
    if (data.medianRates || data.median_rates) outLot.median_rates = data.medianRates || data.median_rates;
    if (data.minBets || data.min_bets) outLot.min_bets = data.minBets || data.min_bets;
    if (data.maxBets || data.max_bets) outLot.max_bets = data.maxBets || data.max_bets;
    if (data.maxPerUsers || data.max_per_users) outLot.max_per_users = data.maxPerUsers || data.max_per_users;
    if (data.subItems || data.sub_items) outLot.sub_items = data.subItems || data.sub_items;

    if (data.minBet ?? data.min_bet) outLot.min_bet = Number(data.minBet ?? data.min_bet);
    if (data.maxBet ?? data.max_bet) outLot.max_bet = Number(data.maxBet ?? data.max_bet);
    if (data.maxPerTicket ?? data.max_per_ticket) outLot.max_per_ticket = Number(data.maxPerTicket ?? data.max_per_ticket);
    outLot.updated_at = new Date().toISOString();
    return outLot;
  }

  // ★ ตาราง risk_intake_configs ใน Supabase
  if (table === 'risk_intake_configs') {
    const outRisk: Record<string, any> = {};
    const riskId = data.id || data.lotteryId || data.lottery_id;
    if (riskId) outRisk.id = String(riskId);
    if (data.lottery_id || data.lotteryId) outRisk.lottery_id = String(data.lottery_id || data.lotteryId);
    if (data.lottery_type || data.lotteryType) outRisk.lottery_type = String(data.lottery_type || data.lotteryType);
    if (data.round_id || data.roundId) outRisk.round_id = String(data.round_id || data.roundId);
    if (data.is_thai !== undefined) outRisk.is_thai = Boolean(data.is_thai);
    else if (data.isThai !== undefined) outRisk.is_thai = Boolean(data.isThai);
    if (data.rates && typeof data.rates === 'object') outRisk.rates = data.rates;
    if (data.discounts && typeof data.discounts === 'object') outRisk.discounts = data.discounts;
    if (data.min_bets || data.minBets) outRisk.min_bets = data.min_bets || data.minBets;
    if (data.max_bets || data.maxBets) outRisk.max_bets = data.max_bets || data.maxBets;
    if (data.max_per_users || data.maxPerUsers) outRisk.max_per_users = data.max_per_users || data.maxPerUsers;
    if (data.min_bet ?? data.minBet) outRisk.min_bet = Number(data.min_bet ?? data.minBet);
    if (data.max_bet ?? data.maxBet) outRisk.max_bet = Number(data.max_bet ?? data.maxBet);
    if (data.max_user_limit ?? data.maxUserLimit) outRisk.max_user_limit = Number(data.max_user_limit ?? data.maxUserLimit);
    if (data.total_risk_budget ?? data.totalRiskBudget) outRisk.total_risk_budget = Number(data.total_risk_budget ?? data.totalRiskBudget);
    if (data.sub_items || data.subItems) outRisk.sub_items = data.sub_items || data.subItems;
    if (data.note) outRisk.note = String(data.note);
    outRisk.updated_at = data.updated_at || data.updatedAt || new Date().toISOString();
    return outRisk;
  }

  for (const [k, v] of Object.entries(data)) {
    if (k === 'isOpen') out.is_open = v;
    else if (k === 'isHidden') out.is_hidden = v;
    else if (k === 'closeTime') out.close_time = v ? new Date(v as string).toISOString() : null;
    else if (k === 'openTime') out.open_time = v;
    else if (k === 'bgGradient') out.bg_gradient = v;
    else if (k === 'ticketId') out.ticket_id = v;
    else if (k === 'userId') out.user_id = v;
    else if (k === 'customerName') out.customer_name = v;
    else if (k === 'lotteryType') out.lottery_type = v;
    else if (k === 'lotterySlug') out.lottery_slug = v;
    else if (k === 'phoneNumber') out.phone = v;
    else if (k === 'roundId') out.round_id = v;
    else if (k === 'totalAmount') out.total_amount = v;
    else if (k === 'expiresAt') out.expires_at = v ? new Date(v as string).toISOString() : null;
    else if (k === 'slipUrl') out.slip_url = v;
    else if (k === 'passwordHash') out.password_hash = v;
    else if (k === 'betType') out.bet_type = v;
    else if (k === 'roundNumber') out.round_number = v;
    else if (k === 'resultTime') out.result_time = v;
    else if (k === 'createdAt') out.created_at = v ? (typeof v === 'string' ? v : new Date().toISOString()) : new Date().toISOString();
    else if (k === 'updatedAt') out.updated_at = v ? (typeof v === 'string' ? v : new Date().toISOString()) : new Date().toISOString();
    else if (k === 'displayName') out.display_name = v;
    else if (k === 'grantedExtra') out.granted_extra = v;
    else if (k === 'lastLogin') out.last_login = v;
    else if (k === 'scopeProjectIds') out.scope_project_ids = v;
    else if (k === 'result3Top') out.result_3top = v;
    else if (k === 'result2Bottom') out.result_2bottom = v;
    else if (k === 'result3Bottom') out.result_3bottom = v;
    else if (k === 'result3Front') out.result_3front = v;
    else if (k === 'customPayoutRate') out.custom_payout_rate = v;
    else if (k === 'payoutRate') out.payout_rate = v;
    else if (k === 'maxAmount') out.max_amount = v;
    else if (k === 'subItems') out.sub_items = v;
    else if (k === 'totalRiskBudget') out.total_risk_budget = v;
    else if (k === 'maxUserLimit') out.max_user_limit = v;
    else if (k === 'winAmount') out.win_amount = v;
    else if (k === 'grossWinAmount') out.gross_win_amount = v;
    else if (k === 'taxAmount') out.tax_amount = v;
    else if (k === 'taxRate') out.tax_rate = v;
    else if (k === 'settledAt') out.settled_at = v;
    else out[k] = v;
  }

  return out;
}

function fromSnake(row: any, table: string): any {
  if (!row) return row;
  if (table === 'system_settings') {
    const val = row.value || {};
    return { id: row.id || row.key, ...val };
  }

  // ★ ตาราง users: ส่งกลับฟิลด์ครบถ้วนทั้ง camelCase และ snake_case
  if (table === 'users') {
    return {
      id: row.id,
      username: row.username,
      phoneNumber: row.phone,
      phone: row.phone,
      password: row.password_hash,
      passwordHash: row.password_hash,
      role: row.role || 'user',
      balance: Number(row.balance) || 0,
      status: row.status || 'active',
      name: row.name || (row.first_name ? `${row.first_name} ${row.last_name || ''}`.trim() : row.username),
      firstName: row.first_name,
      first_name: row.first_name,
      lastName: row.last_name,
      last_name: row.last_name,
      bankName: row.bank_name,
      bank_name: row.bank_name,
      bankAccount: row.bank_account,
      bank_account: row.bank_account,
      accountNumber: row.bank_account,
      agentId: row.agent_id,
      agent_id: row.agent_id,
      lineId: row.line_id,
      line_id: row.line_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ★ ตาราง tickets ใน Supabase
  if (table === 'tickets') {
    const rawBets = Array.isArray(row.bets) ? row.bets : [];
    const rawWinBets = Array.isArray(row.winning_bets) ? row.winning_bets : [];
    return {
      ...row,
      id: row.id || row.ticket_id,
      ticketId: row.ticket_id || row.id,
      ticket_id: row.ticket_id || row.id,
      userId: row.user_id,
      user_id: row.user_id,
      customerName: row.customer_name || 'ลูกค้าทั่วไป',
      customer_name: row.customer_name || 'ลูกค้าทั่วไป',
      lotteryType: row.lottery_type,
      lottery_type: row.lottery_type,
      lotterySlug: row.lottery_slug,
      lottery_slug: row.lottery_slug,
      roundId: row.round_id,
      round_id: row.round_id,
      totalAmount: Number(row.total_amount || 0),
      total_amount: Number(row.total_amount || 0),
      status: row.status || 'pending',
      winAmount: Number(row.win_amount || 0),
      win_amount: Number(row.win_amount || 0),
      grossWinAmount: Number(row.gross_win_amount || 0),
      gross_win_amount: Number(row.gross_win_amount || 0),
      taxAmount: Number(row.tax_amount || 0),
      tax_amount: Number(row.tax_amount || 0),
      taxRate: Number(row.tax_rate || 0),
      tax_rate: Number(row.tax_rate || 0),
      bets: rawBets,
      winningBets: rawWinBets,
      winning_bets: rawWinBets,
      note: row.note || '',
      settledAt: row.settled_at,
      settled_at: row.settled_at,
      createdAt: row.created_at,
      created_at: row.created_at,
      expiresAt: row.expires_at,
      expires_at: row.expires_at,
    };
  }

  // ★ ตาราง lottery_types ใน Supabase
  if (table === 'lottery_types') {
    const outLot: Record<string, any> = { ...row };
    outLot.isOpen = row.is_open !== undefined ? Boolean(row.is_open) : true;
    outLot.isHidden = row.is_hidden !== undefined ? Boolean(row.is_hidden) : false;
    outLot.closeTime = row.close_time;
    outLot.closingTime = row.close_time;
    outLot.openTime = row.open_time;
    outLot.bgGradient = row.bg_gradient;
    outLot.rates = row.rates || {};
    outLot.discounts = row.discounts || {};
    outLot.medianRates = row.median_rates || {};
    outLot.minBets = row.min_bets || {};
    outLot.min_bets = row.min_bets || {};
    outLot.maxBets = row.max_bets || {};
    outLot.max_bets = row.max_bets || {};
    outLot.maxPerUsers = row.max_per_users || {};
    outLot.max_per_users = row.max_per_users || {};
    outLot.subItems = row.sub_items || [];
    outLot.sub_items = row.sub_items || [];
    outLot.minBet = Number(row.min_bet || 1);
    outLot.maxBet = Number(row.max_bet || 5000);
    outLot.maxPerTicket = Number(row.max_per_ticket || 50000);
    const flagVal = row.flag_url || (row.icon && (String(row.icon).startsWith('http') || String(row.icon).startsWith('/')) ? row.icon : (row.rates && typeof row.rates === 'object' && row.rates.flagUrl ? row.rates.flagUrl : ''));
    outLot.flagUrl = flagVal;
    outLot.flag_url = flagVal;
    return outLot;
  }

  // ★ ตาราง risk_intake_configs ใน Supabase
  if (table === 'risk_intake_configs') {
    return {
      ...row,
      id: row.id,
      lotteryId: row.lottery_id || row.id,
      lottery_id: row.lottery_id || row.id,
      lotteryType: row.lottery_type || row.id,
      lottery_type: row.lottery_type || row.id,
      roundId: row.round_id,
      round_id: row.round_id,
      isThai: Boolean(row.is_thai),
      is_thai: Boolean(row.is_thai),
      rates: row.rates || {},
      discounts: row.discounts || {},
      minBets: row.min_bets || {},
      min_bets: row.min_bets || {},
      maxBets: row.max_bets || {},
      max_bets: row.max_bets || {},
      maxPerUsers: row.max_per_users || {},
      max_per_users: row.max_per_users || {},
      minBet: Number(row.min_bet || 1),
      min_bet: Number(row.min_bet || 1),
      maxBet: Number(row.max_bet || 5000),
      max_bet: Number(row.max_bet || 5000),
      maxUserLimit: Number(row.max_user_limit || 50000),
      max_user_limit: Number(row.max_user_limit || 50000),
      totalRiskBudget: Number(row.total_risk_budget || 200000),
      total_risk_budget: Number(row.total_risk_budget || 200000),
      subItems: row.sub_items || [],
      sub_items: row.sub_items || [],
      note: row.note || '',
      updatedAt: row.updated_at,
      updated_at: row.updated_at,
    };
  }

  const out = { ...row };
  if ('is_open' in row) out.isOpen = row.is_open;
  if ('is_hidden' in row) out.isHidden = row.is_hidden;
  if ('close_time' in row) out.closeTime = row.close_time;
  if ('open_time' in row) out.openTime = row.open_time;
  if ('bg_gradient' in row) out.bgGradient = row.bg_gradient;
  if ('ticket_id' in row) out.ticketId = row.ticket_id;
  if ('user_id' in row) out.userId = row.user_id;
  if ('customer_name' in row) out.customerName = row.customer_name;
  if ('lottery_type' in row) out.lotteryType = row.lottery_type;
  if ('lottery_slug' in row) out.lotterySlug = row.lottery_slug;
  if ('round_id' in row) out.roundId = row.round_id;
  if ('total_amount' in row) out.totalAmount = Number(row.total_amount);
  if ('expires_at' in row) out.expiresAt = row.expires_at;
  if ('slip_url' in row) out.slipUrl = row.slip_url;
  if ('description' in row) {
    out.description = row.description;
    out.note = row.description;
  }
  if ('password_hash' in row) out.passwordHash = row.password_hash;
  if ('bet_type' in row) out.betType = row.bet_type;
  if ('round_number' in row) out.roundNumber = row.round_number;
  if ('created_at' in row) out.createdAt = row.created_at;
  if ('updated_at' in row) out.updatedAt = row.updated_at;
  if ('display_name' in row) out.displayName = row.display_name;
  if ('granted_extra' in row) out.grantedExtra = row.granted_extra;
  if ('last_login' in row) out.lastLogin = row.last_login;
  if ('scope_project_ids' in row) out.scopeProjectIds = row.scope_project_ids;
  if ('result_3top' in row) out.result3Top = row.result_3top;
  if ('result_2bottom' in row) out.result2Bottom = row.result_2bottom;
  if ('result_3bottom' in row) out.result3Bottom = row.result_3bottom;
  if ('result_3front' in row) out.result3Front = row.result_3front;
  if ('custom_payout_rate' in row) out.customPayoutRate = Number(row.custom_payout_rate);
  if ('payout_rate' in row) out.payoutRate = Number(row.payout_rate);
  if ('max_amount' in row) out.maxAmount = Number(row.max_amount);
  if ('sub_items' in row) out.subItems = row.sub_items;
  if ('total_risk_budget' in row) out.totalRiskBudget = Number(row.total_risk_budget);
  if ('max_user_limit' in row) out.maxUserLimit = Number(row.max_user_limit);
  if ('win_amount' in row) out.winAmount = Number(row.win_amount);
  if ('gross_win_amount' in row) out.grossWinAmount = Number(row.gross_win_amount);
  if ('tax_amount' in row) out.taxAmount = Number(row.tax_amount);
  if ('tax_rate' in row) out.taxRate = Number(row.tax_rate);
  if ('settled_at' in row) out.settledAt = row.settled_at;
  if ('bank_name' in row) out.bankName = row.bank_name;
  if ('bank_account' in row) { out.bankAccount = row.bank_account; out.accountNumber = row.bank_account; }
  if ('trans_ref' in row) out.transRef = row.trans_ref;
  if ('first_name' in row) out.firstName = row.first_name;
  if ('last_name' in row) out.lastName = row.last_name;
  if ('agent_id' in row) out.agentId = row.agent_id;
  if ('line_id' in row) out.lineId = row.line_id;
  if ('created_by' in row) out.createdBy = row.created_by;
  if ('settled_by' in row) out.settledBy = row.settled_by;

  return out;
}

// ------------------------------------------------------------------
// Types & Classes: DocumentReference, CollectionReference, Query
// ------------------------------------------------------------------
export class DocumentReference {
  constructor(public collectionName: string, public id: string) {}
  get path() {
    return `${this.collectionName}/${this.id}`;
  }
}

export class CollectionReference {
  constructor(public name: string) {}
  get id() {
    return this.name;
  }
  get path() {
    return this.name;
  }
}

export class QueryConstraint {
  constructor(
    public type: 'where' | 'orderBy' | 'limit',
    public field?: string,
    public op?: string,
    public value?: any,
    public direction?: 'asc' | 'desc'
  ) {}
}

export class Query {
  constructor(
    public collectionRef: CollectionReference,
    public constraints: QueryConstraint[] = []
  ) {}
}

export class DocumentSnapshot {
  constructor(
    public id: string,
    private _data: any,
    private _exists: boolean = true
  ) {}

  exists(): boolean {
    return this._exists;
  }

  data(): any {
    return this._data;
  }
}

export class QuerySnapshot {
  constructor(public docs: DocumentSnapshot[]) {}

  get size(): number {
    return this.docs.length;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }

  forEach(callback: (doc: DocumentSnapshot) => void): void {
    this.docs.forEach(callback);
  }
}

// ------------------------------------------------------------------
// Core Firestore Compatibility Functions
// ------------------------------------------------------------------

export function collection(_db: any, path: string): CollectionReference {
  return new CollectionReference(path);
}

export function doc(
  _dbOrParent: any,
  collectionOrPath?: string,
  ...pathSegments: string[]
): DocumentReference {
  if (pathSegments.length > 0) {
    return new DocumentReference(collectionOrPath || '', pathSegments.join('/'));
  }
  if (!collectionOrPath) {
    return new DocumentReference('default', 'id_' + Math.random().toString(36).slice(2));
  }
  const parts = collectionOrPath.split('/');
  if (parts.length >= 2) {
    return new DocumentReference(parts[0], parts.slice(1).join('/'));
  }
  return new DocumentReference(collectionOrPath, 'id_' + Math.random().toString(36).slice(2));
}

export function query(
  colOrQuery: CollectionReference | Query,
  ...constraints: QueryConstraint[]
): Query {
  const colRef = colOrQuery instanceof Query ? colOrQuery.collectionRef : colOrQuery;
  const existing = colOrQuery instanceof Query ? colOrQuery.constraints : [];
  return new Query(colRef, [...existing, ...constraints]);
}

export function where(field: string, op: string, value: any): QueryConstraint {
  return new QueryConstraint('where', field, op, value);
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return new QueryConstraint('orderBy', field, undefined, undefined, direction);
}

export function limit(n: number): QueryConstraint {
  return new QueryConstraint('limit', undefined, undefined, n);
}

export function serverTimestamp(): string {
  return new Date().toISOString();
}

export const Timestamp = {
  now: () => ({
    toDate: () => new Date(),
    toMillis: () => Date.now(),
    toISOString: () => new Date().toISOString(),
  }),
};

// ------------------------------------------------------------------
// Data Access Operations (getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc)
// ------------------------------------------------------------------

export async function getDoc(docRef: DocumentReference): Promise<DocumentSnapshot> {
  const table = mapCollectionToTable(docRef.collectionName);

  if (table === 'system_settings') {
    const key = docRef.id;
    const { data, error } = await supabaseClient
      .from('system_settings')
      .select('*')
      .or(`key.eq.${key},id.eq.${key}`)
      .limit(1);

    if (error || !data || data.length === 0) {
      return new DocumentSnapshot(docRef.id, undefined, false);
    }
    const row = data[0];
    const val = row.value || {};
    return new DocumentSnapshot(docRef.id, { id: docRef.id, ...val }, true);
  }

  const { data, error } = await supabaseClient
    .from(table)
    .select('*')
    .eq('id', docRef.id)
    .limit(1);

  if (error || !data || data.length === 0) {
    return new DocumentSnapshot(docRef.id, undefined, false);
  }

  const row = data[0];
  const mapped = fromSnake(row, table);

  // พิเศษ: สำหรับ tickets ดึง bets จาก ticket_items เพิ่มเติม
  if (table === 'tickets') {
    const { data: items } = await supabaseClient
      .from('ticket_items')
      .select('*')
      .eq('ticket_id', row.ticket_id || row.id);

    if (items && items.length > 0) {
      mapped.bets = items.map(i => ({
        number: i.number,
        type: i.bet_type,
        amount: Number(i.amount),
        payoutRate: Number(i.payout_rate),
        winAmount: Number(i.win_amount || 0),
        status: i.status,
      }));
    }
  }

  return new DocumentSnapshot(docRef.id, mapped, true);
}

export async function getDocs(queryOrCol: CollectionReference | Query): Promise<QuerySnapshot> {
  const isQuery = queryOrCol instanceof Query;
  const colRef = isQuery ? queryOrCol.collectionRef : queryOrCol;
  const constraints = isQuery ? queryOrCol.constraints : [];
  const table = mapCollectionToTable(colRef.name);

  if (table === 'system_settings') {
    let req = supabaseClient.from('system_settings').select('*');
    for (const c of constraints) {
      if (c.type === 'limit' && c.value) req = req.limit(c.value);
    }
    const { data, error } = await req;
    if (error || !data) return new QuerySnapshot([]);
    const docs = data.map(r => new DocumentSnapshot(r.key || r.id, { id: r.key || r.id, ...(r.value || {}) }, true));
    return new QuerySnapshot(docs);
  }

  let req = supabaseClient.from(table).select('*');

  // ใส่ constraints จาก query
  for (const c of constraints) {
    if (c.type === 'where' && c.field) {
      let fieldName = c.field;
      if (fieldName === 'isOpen') fieldName = 'is_open';
      if (fieldName === 'userId') fieldName = 'user_id';
      if (fieldName === 'ticketId') fieldName = 'ticket_id';
      if (fieldName === 'lotteryType' || fieldName === 'ticketType') fieldName = 'lottery_type';
      if (fieldName === 'roundId') fieldName = 'round_id';
      if (fieldName === 'betType') fieldName = 'bet_type';
      if (fieldName === 'username') fieldName = 'username';
      if (fieldName === 'phoneNumber' || fieldName === 'phone') fieldName = 'phone';
      if (fieldName === 'password' || fieldName === 'passwordHash') fieldName = 'password_hash';
      if (fieldName === 'status') fieldName = 'status';

      if (c.op === '==') req = req.eq(fieldName, c.value);
      else if (c.op === '!=') req = req.neq(fieldName, c.value);
      else if (c.op === '>') req = req.gt(fieldName, c.value);
      else if (c.op === '>=') req = req.gte(fieldName, c.value);
      else if (c.op === '<') req = req.lt(fieldName, c.value);
      else if (c.op === '<=') req = req.lte(fieldName, c.value);
      else if (c.op === 'in' && Array.isArray(c.value)) req = req.in(fieldName, c.value);
    } else if (c.type === 'orderBy' && c.field) {
      let fieldName = c.field;
      if (fieldName === 'createdAt') fieldName = 'created_at';
      if (fieldName === 'updatedAt') fieldName = 'updated_at';
      if (fieldName === 'at') fieldName = 'at';
      req = req.order(fieldName, { ascending: c.direction === 'asc' });
    } else if (c.type === 'limit' && c.value) {
      req = req.limit(c.value);
    }
  }

  const { data, error } = await req;
  if (error || !data) return new QuerySnapshot([]);

  const docs = data.map(r => new DocumentSnapshot(r.id, fromSnake(r, table), true));
  return new QuerySnapshot(docs);
}

export async function setDoc(
  docRef: DocumentReference,
  data: any,
  options?: { merge?: boolean }
): Promise<void> {
  const table = mapCollectionToTable(docRef.collectionName);

  if (table === 'system_settings') {
    const key = docRef.id;
    let finalValue = data;
    if (options?.merge) {
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        finalValue = { ...existing.data(), ...data };
      }
    }
    await supabaseClient.from('system_settings').upsert({
      id: key,
      key: key,
      value: finalValue,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  // ★ ตารางอื่นๆ (รวม lottery_types): ดึงข้อมูลเดิมมาผสานถ้ามี options.merge
  let mergedData = data;
  if (options?.merge) {
    try {
      const existing = await getDoc(docRef);
      if (existing.exists()) {
        mergedData = { ...existing.data(), ...data };
      }
    } catch (e) {
      console.warn(`[adapter] setDoc merge fetch warning on ${table}/${docRef.id}:`, e);
    }
  }

  const snakeData = toSnake(mergedData, table);
  if (!snakeData.id) snakeData.id = docRef.id;

  // สำหรับ lottery_types: name ห้ามเป็น null (Postgres NOT NULL constraint)
  if (table === 'lottery_types') {
    if (!snakeData.name) {
      snakeData.name = mergedData.name || mergedData.title || docRef.id;
    }
    if (!snakeData.category) {
      snakeData.category = mergedData.category || 'thai';
    }
  }

  const uuidTables = ['transactions', 'ticket_items', 'blocked_numbers', 'permission_logs'];
  if (uuidTables.includes(table)) {
    if (snakeData.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(snakeData.id)) {
      delete snakeData.id;
    }
  }

  // จัดการ bets หากเป็นตาราง tickets
  const bets = mergedData.bets || snakeData.bets;
  if (table === 'tickets' && bets) {
    snakeData.bets = Array.isArray(bets) ? bets : [];
  }

  let { error: upsertErr } = await supabaseClient.from(table).upsert(snakeData);
  if (upsertErr && (upsertErr as any).code === 'PGRST204' && table === 'tickets' && 'bets' in snakeData) {
    delete snakeData.bets;
    const retry = await supabaseClient.from(table).upsert(snakeData);
    upsertErr = retry.error;
  }
  if (upsertErr) {
    console.error(`[adapter] setDoc error on ${table}:`, upsertErr);
    throw upsertErr;
  }

  if (table === 'tickets' && Array.isArray(bets) && bets.length > 0) {
    const parentTicketId = snakeData.ticket_id || docRef.id;
    const items = bets.map(b => ({
      ticket_id: parentTicketId,
      number: String(b.number),
      bet_type: b.type || b.betType || '2top',
      amount: Number(b.amount || 0),
      payout_rate: Number(b.payoutRate || b.rate || 0),
      win_amount: Number(b.winAmount || 0),
      status: b.status || 'pending',
    }));
    await supabaseClient.from('ticket_items').upsert(items);
  }
}

export async function updateDoc(
  docRef: DocumentReference,
  data: any
): Promise<void> {
  const table = mapCollectionToTable(docRef.collectionName);

  if (table === 'system_settings') {
    const existing = await getDoc(docRef);
    const merged = existing.exists() ? { ...existing.data(), ...data } : data;
    await supabaseClient.from('system_settings').upsert({
      id: docRef.id,
      key: docRef.id,
      value: merged,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const snakeData = toSnake(data, table);
  const bets = data.bets;
  if (table === 'tickets' && bets) {
    snakeData.bets = Array.isArray(bets) ? bets : [];
  }
  snakeData.updated_at = new Date().toISOString();

  let { error: updateErr } = await supabaseClient.from(table).update(snakeData).eq('id', docRef.id);
  if (updateErr && (updateErr as any).code === 'PGRST204' && table === 'tickets' && 'bets' in snakeData) {
    delete snakeData.bets;
    const retry = await supabaseClient.from(table).update(snakeData).eq('id', docRef.id);
    updateErr = retry.error;
  }
  if (updateErr) {
    console.error(`[adapter] updateDoc error on ${table}:`, updateErr);
  }
}

export async function addDoc(
  colRef: CollectionReference,
  data: any
): Promise<DocumentReference> {
  const table = mapCollectionToTable(colRef.name);
  const genId = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

  if (table === 'system_settings') {
    await supabaseClient.from('system_settings').insert({
      id: genId,
      key: genId,
      value: data,
      updated_at: new Date().toISOString(),
    });
    return new DocumentReference(colRef.name, genId);
  }

  const snakeData = toSnake(data, table);

  // ตารางที่ใช้ UUID เป็น Primary Key ห้ามใส่ string ID เช่น 'doc_...'
  const uuidTables = ['transactions', 'ticket_items', 'blocked_numbers', 'permission_logs'];
  if (uuidTables.includes(table)) {
    if (snakeData.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(snakeData.id)) {
      delete snakeData.id;
    }
  } else {
    if (!snakeData.id) snakeData.id = genId;
  }

  // พิเศษ: สำหรับ tickets
  if (table === 'tickets') {
    if (!snakeData.id && snakeData.ticket_id) {
      snakeData.id = snakeData.ticket_id;
    }
    if (!snakeData.ticket_id && snakeData.id) {
      snakeData.ticket_id = snakeData.id;
    }
  }

  const bets = data.bets || snakeData.bets;
  if (table === 'tickets' && bets) {
    snakeData.bets = Array.isArray(bets) ? bets : [];
  }

  let { data: inserted, error: insertErr } = await supabaseClient.from(table).insert(snakeData).select();
  if (insertErr && (insertErr as any).code === 'PGRST204' && table === 'tickets' && 'bets' in snakeData) {
    delete snakeData.bets;
    const retry = await supabaseClient.from(table).insert(snakeData).select();
    inserted = retry.data;
    insertErr = retry.error;
  }
  if (insertErr) {
    console.error(`[adapter] addDoc error on ${table}:`, insertErr);
    throw insertErr;
  }

  const realId = inserted?.[0]?.id || snakeData.id || genId;

  if (table === 'tickets' && Array.isArray(bets) && bets.length > 0) {
    const parentTicketId = snakeData.ticket_id || realId;
    const items = bets.map(b => ({
      ticket_id: parentTicketId,
      number: String(b.number),
      bet_type: b.type || b.betType || '2top',
      amount: Number(b.amount || 0),
      payout_rate: Number(b.payoutRate || b.rate || 0),
      win_amount: Number(b.winAmount || 0),
      status: b.status || 'pending',
    }));
    const { error: itemsErr } = await supabaseClient.from('ticket_items').insert(items);
    if (itemsErr) {
      console.error('[adapter] addDoc ticket_items error:', itemsErr);
    }
  }

  return new DocumentReference(colRef.name, realId);
}

export async function deleteDoc(docRef: DocumentReference): Promise<void> {
  const table = mapCollectionToTable(docRef.collectionName);
  if (table === 'system_settings') {
    await supabaseClient.from('system_settings').delete().or(`id.eq.${docRef.id},key.eq.${docRef.id}`);
    return;
  }
  if (table === 'lottery_types') {
    await supabaseClient.from('lottery_types').delete().or(`id.eq.${docRef.id},name.eq.${docRef.id}`);
    return;
  }
  await supabaseClient.from(table).delete().eq('id', docRef.id);
}

// ------------------------------------------------------------------
// Realtime Listener: onSnapshot
// ------------------------------------------------------------------
export function onSnapshot(
  target: DocumentReference | CollectionReference | Query,
  onNext: (snap: any) => void,
  _onError?: (err: any) => void
): () => void {
  let isSubscribed = true;

  const fetchAndTrigger = async () => {
    if (!isSubscribed) return;
    try {
      if (target instanceof DocumentReference) {
        const snap = await getDoc(target);
        if (isSubscribed) onNext(snap);
      } else {
        const snap = await getDocs(target);
        if (isSubscribed) onNext(snap);
      }
    } catch (e) {
      if (_onError) _onError(e);
    }
  };

  // เรียกครั้งแรกทันที
  fetchAndTrigger();

  // ตั้ง Supabase Realtime Channel
  const table = target instanceof DocumentReference 
    ? mapCollectionToTable(target.collectionName) 
    : mapCollectionToTable(target instanceof Query ? target.collectionRef.name : target.name);

  const channelName = `realtime-${table}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabaseClient
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      fetchAndTrigger();
    })
    .subscribe();

  // สำรอง: ตรวจสอบเป็นระยะทุก 8 วินาที
  const interval = setInterval(fetchAndTrigger, 8000);

  return () => {
    isSubscribed = false;
    clearInterval(interval);
    supabaseClient.removeChannel(channel);
  };
}

// Dummy initializeApp & getFirestore สำหรับความเข้ากันได้
export function initializeApp(_config: any) {
  return { name: '[DEFAULT]' };
}

export function getFirestore(_app?: any, _databaseId?: string) {
  return db;
}

export function connectFirestoreEmulator(_db?: any, _host?: string, _port?: number) {
  // no-op for emulator compatibility
}

export async function runTransaction(
  _db: any,
  updateFunction: (transaction: any) => Promise<any>
): Promise<any> {
  const transaction = {
    get: async (docRef: DocumentReference) => getDoc(docRef),
    set: (docRef: DocumentReference, data: any) => setDoc(docRef, data),
    update: (docRef: DocumentReference, data: any) => updateDoc(docRef, data),
    delete: (docRef: DocumentReference) => deleteDoc(docRef),
  };
  return await updateFunction(transaction);
}

export function writeBatch(_db?: any) {
  const operations: Array<() => Promise<any>> = [];
  return {
    set: (docRef: DocumentReference, data: any) => {
      operations.push(() => setDoc(docRef, data));
    },
    update: (docRef: DocumentReference, data: any) => {
      operations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: DocumentReference) => {
      operations.push(() => deleteDoc(docRef));
    },
    commit: async () => {
      for (const op of operations) {
        await op();
      }
    },
  };
}

