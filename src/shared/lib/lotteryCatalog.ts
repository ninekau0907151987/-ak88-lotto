/**
 * src/shared/lib/lotteryCatalog.ts
 * ==================================================================
 * มาตรฐานข้อมูลประเภทหวย และหมวดหมู่กลางที่ใช้ร่วมกันทั้งหน้าบ้าน หลังบ้าน และ API
 */

export type LotteryCategoryKey = 'all' | 'thai' | 'foreign' | 'stock' | 'yeekee' | 'set' | 'other';

export interface LotteryCategoryDef {
  id: LotteryCategoryKey;
  label: string;
  icon: string;
  badgeClass: string;
}

export const UNIFIED_BASE_GRADIENT = 'bg-gradient-to-b from-[#0a192f] to-[#112240]';

export const LOTTERY_CATEGORIES: LotteryCategoryDef[] = [
  { id: 'all',     label: 'ทั้งหมด',            icon: 'grid_view',     badgeClass: 'bg-slate-700 text-white' },
  { id: 'thai',    label: 'หวยไทย / ธนาคาร',   icon: 'flag',          badgeClass: 'bg-slate-700 text-white' },
  { id: 'foreign', label: 'หวยต่างประเทศ',      icon: 'public',        badgeClass: 'bg-slate-700 text-white' },
  { id: 'stock',   label: 'หวยหุ้น VIP',        icon: 'trending_up',   badgeClass: 'bg-slate-700 text-white' },
  { id: 'yeekee',  label: 'หวยยี่กี 88 รอบ',     icon: 'timer',         badgeClass: 'bg-slate-700 text-white' },
  { id: 'set',     label: 'หวยชุด',             icon: 'inventory_2',   badgeClass: 'bg-slate-700 text-white' },
  { id: 'other',   label: 'อื่นๆ / กำหนดเอง',    icon: 'more_horiz',    badgeClass: 'bg-slate-700 text-white' },
];

export interface LotteryItemDef {
  name: string;
  category: LotteryCategoryKey;
  icon: string;
  path: string;
  bgGradient: string;
}

export const MASTER_LOTTERY_CATALOG: LotteryItemDef[] = [
  // --- 1. หวยไทย / ธนาคาร ---
  { name: 'หวยรัฐบาล', category: 'thai', icon: '🇹🇭', path: '/lottery/thai', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หวยธกส.', category: 'thai', icon: '🏦', path: '/lottery/baac', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หวยออมสิน', category: 'thai', icon: '🏦', path: '/lottery/gsb', bgGradient: UNIFIED_BASE_GRADIENT },

  // --- 2. หวยยี่กี ---
  { name: 'ยี่กี 4D', category: 'yeekee', icon: '⏱️', path: '/lottery/yeekee', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หวยยี่กี 88 รอบ', category: 'yeekee', icon: '⏱️', path: '/lottery/yeekee', bgGradient: UNIFIED_BASE_GRADIENT },

  // --- 3. หวยต่างประเทศ ---
  { name: 'หวยฮานอย', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ฮานอยพิเศษ', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-special', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ฮานอย(VIP)', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-vip', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ฮานอย(HD)', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-hd', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ฮานอยสตาร์', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-star', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ฮานอยTV', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-tv', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ฮานอยกาชาด', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-redcross', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ฮานอยสามัคคี', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-samakkhi', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ฮานอย(EXTRA)', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-extra', bgGradient: UNIFIED_BASE_GRADIENT },

  { name: 'หวยลาวประตูชัย', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-pratuchai', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หวยลาวสันติภาพ', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-santipap', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หวยประชาชนลาว', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-public', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ลาว(EXTRA)', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-extra', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หวยลาวTV', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-tv', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หวยลาวHD', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-hd', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หวยลาวสตาร์', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-star', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ลาวกาชาด', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-redcross', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หวยลาวสตาร์(VIP)', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-star-vip', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ลาว VIP', category: 'foreign', icon: '🇱🇦', path: '/lottery/stock/lao-vip', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ดาวน์โจนส์ STAR', category: 'foreign', icon: '🇺🇸', path: '/lottery/dowjones-star', bgGradient: UNIFIED_BASE_GRADIENT },

  // --- 4. หวยชุด ---
  { name: 'หวยรัฐบาล (ชุด)', category: 'set', icon: '🇹🇭', path: '/lottery/set/thai', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หวยฮานอยชุด', category: 'set', icon: '🇻🇳', path: '/lottery/set/hanoi', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หวยลาวพัฒนาชุด', category: 'set', icon: '🇱🇦', path: '/lottery/set/lao', bgGradient: UNIFIED_BASE_GRADIENT },

  // --- 5. หวยหุ้น VIP ---
  { name: 'นิเคอิ VIP (เช้า)', category: 'stock', icon: '🇯🇵', path: '/lottery/stock/nikkei-m', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'นิเคอิ VIP (บ่าย)', category: 'stock', icon: '🇯🇵', path: '/lottery/stock/nikkei-a', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'เวียดนาม VIP (เช้า)', category: 'stock', icon: '🇻🇳', path: '/lottery/stock/vietnam-m', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'เวียดนาม VIP (บ่าย)', category: 'stock', icon: '🇻🇳', path: '/lottery/stock/vietnam-a', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'เวียดนาม VIP (เย็น)', category: 'stock', icon: '🇻🇳', path: '/lottery/stock/vietnam-e', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'จีน VIP (เช้า)', category: 'stock', icon: '🇨🇳', path: '/lottery/stock/china-m', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'จีน VIP (บ่าย)', category: 'stock', icon: '🇨🇳', path: '/lottery/stock/china-a', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ฮั่งเส็ง VIP (เช้า)', category: 'stock', icon: '🇭🇰', path: '/lottery/stock/hangseng-m', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ฮั่งเส็ง VIP (บ่าย)', category: 'stock', icon: '🇭🇰', path: '/lottery/stock/hangseng-a', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ไต้หวัน VIP', category: 'stock', icon: '🇹🇼', path: '/lottery/stock/taiwan', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'เกาหลี VIP', category: 'stock', icon: '🇰🇷', path: '/lottery/stock/korea', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'สิงคโปร์ VIP', category: 'stock', icon: '🇸🇬', path: '/lottery/stock/singapore-vip', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'อังกฤษ(VIP)', category: 'stock', icon: '🇬🇧', path: '/lottery/stock/uk-vip', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'เยอรมัน(VIP)', category: 'stock', icon: '🇩🇪', path: '/lottery/stock/germany-vip', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'รัสเซีย(VIP)', category: 'stock', icon: '🇷🇺', path: '/lottery/stock/russia-vip', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ดาวน์โจนส์(VIP)', category: 'stock', icon: '🇺🇸', path: '/lottery/stock/dowjones-vip', bgGradient: UNIFIED_BASE_GRADIENT },

  // --- 6. หวยหุ้นตลาดรอบวัน ---
  { name: 'หุ้นดาวน์โจนส์', category: 'stock', icon: '🇺🇸', path: '/lottery/stock/dowjones-stock', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หุ้นนิเคอิรอบเช้า', category: 'stock', icon: '🇯🇵', path: '/lottery/stock/nikkei-morning', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ฮั่งเส็งรอบเช้า', category: 'stock', icon: '🇭🇰', path: '/lottery/stock/hangseng-morning', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'จีนรอบเช้า', category: 'stock', icon: '🇨🇳', path: '/lottery/stock/china-morning', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หุ้นไต้หวัน', category: 'stock', icon: '🇹🇼', path: '/lottery/stock/taiwan-stock', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หุ้นเกาหลี', category: 'stock', icon: '🇰🇷', path: '/lottery/stock/korea-stock', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'นิเคอิปิดบ่าย', category: 'stock', icon: '🇯🇵', path: '/lottery/stock/nikkei-afternoon', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'จีนปิดรอบบ่าย', category: 'stock', icon: '🇨🇳', path: '/lottery/stock/china-afternoon', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ฮั่งเส็งปิดบ่าย', category: 'stock', icon: '🇭🇰', path: '/lottery/stock/hangseng-afternoon', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หุ้นสิงคโปร์', category: 'stock', icon: '🇸🇬', path: '/lottery/stock/singapore-stock', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หุ้นไทยเช้า', category: 'stock', icon: '🇹🇭', path: '/lottery/stock/thai-morning', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หุ้นไทยปิดเย็น', category: 'stock', icon: '🇹🇭', path: '/lottery/stock/thai-evening', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หุ้นอินเดีย', category: 'stock', icon: '🇮🇳', path: '/lottery/stock/india-stock', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หุ้นอียิปต์', category: 'stock', icon: '🇪🇬', path: '/lottery/stock/egypt-stock', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หุ้นรัสเซีย', category: 'stock', icon: '🇷🇺', path: '/lottery/stock/russia-stock', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หุ้นเยอรมัน', category: 'stock', icon: '🇩🇪', path: '/lottery/stock/germany-stock', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'หุ้นอังกฤษ', category: 'stock', icon: '🇬🇧', path: '/lottery/stock/uk-stock', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ดาวน์โจนส์ TV', category: 'stock', icon: '🇺🇸', path: '/lottery/stock/dowjones-tv', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ดาวน์โจนส์ MIDNIGHT', category: 'stock', icon: '🇺🇸', path: '/lottery/stock/dowjones-midnight', bgGradient: UNIFIED_BASE_GRADIENT },
  { name: 'ดาวน์โจนส์ EXTRA', category: 'stock', icon: '🇺🇸', path: '/lottery/stock/dowjones-extra', bgGradient: UNIFIED_BASE_GRADIENT },
];

/** 3 รายการหวยหลักที่ระบบอนุญาตให้เปิดรับแทงตามคำสั่งผู้ดูแลระบบ (หวยไทย, หุ้นไทยเช้า, ยี่กี) */
export const SYSTEM_OPEN_LOTTERIES: readonly string[] = [
  'หวยรัฐบาลไทย',
  'หวยรัฐบาล',
  'หุ้นไทยเช้า',
  'หวยยี่กี 88 รอบ',
  'ยี่กี 4D',
  'yeekee'
];

/** ตรวจสอบว่าเป็นหนึ่งใน 3 หวยหลักที่เปิดรับแทงหรือไม่ */
export function isAllowedOpenLottery(nameOrId: string): boolean {
  if (!nameOrId) return false;
  const n = nameOrId.trim();
  return SYSTEM_OPEN_LOTTERIES.some(allowed => 
    n === allowed || 
    n.toLowerCase() === allowed.toLowerCase() ||
    (allowed === 'หวยรัฐบาลไทย' && n.includes('รัฐบาล') && !n.includes('ชุด')) ||
    (allowed === 'หุ้นไทยเช้า' && (n.includes('หุ้นไทยเช้า') || n.includes('thai-morning'))) ||
    (allowed === 'หวยยี่กี 88 รอบ' && (n.includes('ยี่กี') || n.includes('yeekee')))
  );
}

/** ระบุหมวดหมู่จากชื่อหรือค่าที่บันทึก */
export function getLotteryCategory(name: string, savedCategory?: string): LotteryCategoryKey {
  if (savedCategory) {
    if (savedCategory === 'หวยไทย' || savedCategory === 'thai') return 'thai';
    if (savedCategory === 'หวยต่างประเทศ' || savedCategory === 'foreign') return 'foreign';
    if (savedCategory === 'หวยหุ้น VIP' || savedCategory === 'หวยหุ้น' || savedCategory === 'stock') return 'stock';
    if (savedCategory === 'หวยยี่กี' || savedCategory === 'yeekee') return 'yeekee';
    if (savedCategory === 'หวยชุด' || savedCategory === 'set') return 'set';
    if (savedCategory === 'อื่นๆ' || savedCategory === 'other') return 'other';
  }

  // ค้นหาใน master catalog
  const found = MASTER_LOTTERY_CATALOG.find(l => l.name === name);
  if (found) return found.category;

  // กฎอัตโนมัติ
  if (name.includes('รัฐบาล') || name.includes('ธกส') || name.includes('ออมสิน')) return 'thai';
  if (name.includes('ชุด')) return 'set';
  if (name.includes('ยี่กี') || name.includes('20 ช่อง')) return 'yeekee';
  if (name.includes('นิเคอิ') || name.includes('ฮั่งเส็ง') || name.includes('จีน') || name.includes('ไต้หวัน') || name.includes('เกาหลี') || name.includes('สิงคโปร์') || name.includes('อังกฤษ') || name.includes('เยอรมัน') || name.includes('รัสเซีย') || name.includes('อินเดีย') || name.includes('อียิปต์') || name.includes('หุ้น')) return 'stock';
  if (name.includes('ฮานอย') || name.includes('ลาว') || name.includes('มาเลย์') || name.includes('ดาวน์โจนส์')) return 'foreign';

  return 'other';
}

/** ดึงชื่อหมวดหมู่ภาษาไทย */
export function getCategoryLabel(key: LotteryCategoryKey): string {
  const cat = LOTTERY_CATEGORIES.find(c => c.id === key);
  return cat ? cat.label : 'อื่นๆ';
}
