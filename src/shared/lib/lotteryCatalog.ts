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

export const LOTTERY_CATEGORIES: LotteryCategoryDef[] = [
  { id: 'all',     label: 'ทั้งหมด',            icon: 'grid_view',     badgeClass: 'bg-slate-700 text-white' },
  { id: 'thai',    label: 'หวยไทย / ธนาคาร',   icon: 'flag',          badgeClass: 'bg-emerald-600 text-white' },
  { id: 'foreign', label: 'หวยต่างประเทศ',      icon: 'public',        badgeClass: 'bg-blue-600 text-white' },
  { id: 'stock',   label: 'หวยหุ้น VIP',        icon: 'trending_up',   badgeClass: 'bg-rose-600 text-white' },
  { id: 'yeekee',  label: 'หวยยี่กี 88 รอบ',     icon: 'timer',         badgeClass: 'bg-amber-600 text-white' },
  { id: 'set',     label: 'หวยชุด',             icon: 'inventory_2',   badgeClass: 'bg-cyan-600 text-white' },
  { id: 'other',   label: 'อื่นๆ / กำหนดเอง',    icon: 'more_horiz',    badgeClass: 'bg-purple-600 text-white' },
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
  { name: 'หวยรัฐบาล', category: 'thai', icon: '🇹🇭', path: '/lottery/thai', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'หวยธกส.', category: 'thai', icon: '🏦', path: '/lottery/baac', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'หวยออมสิน', category: 'thai', icon: '🏦', path: '/lottery/gsb', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },

  // --- 2. หวยยี่กี ---
  { name: 'ยี่กี 4D', category: 'yeekee', icon: '⏱️', path: '/lottery/yeekee', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'หวยยี่กี 88 รอบ', category: 'yeekee', icon: '⏱️', path: '/lottery/yeekee', bgGradient: 'bg-gradient-to-b from-[#f59e0b] to-[#d97706]' },

  // --- 3. หวยต่างประเทศ ---
  { name: 'หวยฮานอย', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'ฮานอยพิเศษ', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-special', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'ฮานอย(VIP)', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-vip', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'ฮานอย(HD)', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-hd', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'ฮานอยสตาร์', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-star', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'ฮานอยTV', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-tv', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'ฮานอยกาชาด', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-redcross', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'ฮานอยสามัคคี', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-samakkhi', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'ฮานอย(EXTRA)', category: 'foreign', icon: '🇻🇳', path: '/lottery/hanoi-extra', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },

  { name: 'หวยลาวประตูชัย', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-pratuchai', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'หวยลาวสันติภาพ', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-santipap', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'หวยประชาชนลาว', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-public', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'ลาว(EXTRA)', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-extra', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'หวยลาวTV', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-tv', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'หวยลาวHD', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-hd', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'หวยลาวสตาร์', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-star', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'ลาวกาชาด', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-redcross', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'หวยลาวสตาร์(VIP)', category: 'foreign', icon: '🇱🇦', path: '/lottery/lao-star-vip', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'ลาว VIP', category: 'foreign', icon: '🇱🇦', path: '/lottery/stock/lao-vip', bgGradient: 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]' },
  { name: 'ดาวน์โจนส์ STAR', category: 'foreign', icon: '🇺🇸', path: '/lottery/dowjones-star', bgGradient: 'bg-gradient-to-b from-[#95a5a6] to-[#7f8c8d]' },

  // --- 4. หวยชุด ---
  { name: 'หวยรัฐบาล (ชุด)', category: 'set', icon: '🇹🇭', path: '/lottery/set/thai', bgGradient: 'bg-gradient-to-b from-[#00b4d8] to-[#0077b6]' },
  { name: 'หวยฮานอยชุด', category: 'set', icon: '🇻🇳', path: '/lottery/set/hanoi', bgGradient: 'bg-gradient-to-b from-[#00b4d8] to-[#0077b6]' },
  { name: 'หวยลาวพัฒนาชุด', category: 'set', icon: '🇱🇦', path: '/lottery/set/lao', bgGradient: 'bg-gradient-to-b from-[#00b4d8] to-[#0077b6]' },

  // --- 5. หวยหุ้น VIP ---
  { name: 'นิเคอิ VIP (เช้า)', category: 'stock', icon: '🇯🇵', path: '/lottery/stock/nikkei-m', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'นิเคอิ VIP (บ่าย)', category: 'stock', icon: '🇯🇵', path: '/lottery/stock/nikkei-a', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'เวียดนาม VIP (เช้า)', category: 'stock', icon: '🇻🇳', path: '/lottery/stock/vietnam-m', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'เวียดนาม VIP (บ่าย)', category: 'stock', icon: '🇻🇳', path: '/lottery/stock/vietnam-a', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'เวียดนาม VIP (เย็น)', category: 'stock', icon: '🇻🇳', path: '/lottery/stock/vietnam-e', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'จีน VIP (เช้า)', category: 'stock', icon: '🇨🇳', path: '/lottery/stock/china-m', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'จีน VIP (บ่าย)', category: 'stock', icon: '🇨🇳', path: '/lottery/stock/china-a', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'ฮั่งเส็ง VIP (เช้า)', category: 'stock', icon: '🇭🇰', path: '/lottery/stock/hangseng-m', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'ฮั่งเส็ง VIP (บ่าย)', category: 'stock', icon: '🇭🇰', path: '/lottery/stock/hangseng-a', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'ไต้หวัน VIP', category: 'stock', icon: '🇹🇼', path: '/lottery/stock/taiwan', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'เกาหลี VIP', category: 'stock', icon: '🇰🇷', path: '/lottery/stock/korea', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'สิงคโปร์ VIP', category: 'stock', icon: '🇸🇬', path: '/lottery/stock/singapore-vip', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'อังกฤษ(VIP)', category: 'stock', icon: '🇬🇧', path: '/lottery/stock/uk-vip', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'เยอรมัน(VIP)', category: 'stock', icon: '🇩🇪', path: '/lottery/stock/germany-vip', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'รัสเซีย(VIP)', category: 'stock', icon: '🇷🇺', path: '/lottery/stock/russia-vip', bgGradient: 'bg-gradient-to-b from-[#ff7675] to-[#d63031]' },
  { name: 'ดาวน์โจนส์(VIP)', category: 'stock', icon: '🇺🇸', path: '/lottery/stock/dowjones-vip', bgGradient: 'bg-gradient-to-b from-[#95a5a6] to-[#7f8c8d]' },

  // --- 6. หวยหุ้นตลาดรอบวัน ---
  { name: 'หุ้นดาวน์โจนส์', category: 'stock', icon: '🇺🇸', path: '/lottery/stock/dowjones-stock', bgGradient: 'bg-gradient-to-b from-[#95a5a6] to-[#7f8c8d]' },
  { name: 'หุ้นนิเคอิรอบเช้า', category: 'stock', icon: '🇯🇵', path: '/lottery/stock/nikkei-morning', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'ฮั่งเส็งรอบเช้า', category: 'stock', icon: '🇭🇰', path: '/lottery/stock/hangseng-morning', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'จีนรอบเช้า', category: 'stock', icon: '🇨🇳', path: '/lottery/stock/china-morning', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'หุ้นไต้หวัน', category: 'stock', icon: '🇹🇼', path: '/lottery/stock/taiwan-stock', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'หุ้นเกาหลี', category: 'stock', icon: '🇰🇷', path: '/lottery/stock/korea-stock', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'นิเคอิปิดบ่าย', category: 'stock', icon: '🇯🇵', path: '/lottery/stock/nikkei-afternoon', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'จีนปิดรอบบ่าย', category: 'stock', icon: '🇨🇳', path: '/lottery/stock/china-afternoon', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'ฮั่งเส็งปิดบ่าย', category: 'stock', icon: '🇭🇰', path: '/lottery/stock/hangseng-afternoon', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'หุ้นสิงคโปร์', category: 'stock', icon: '🇸🇬', path: '/lottery/stock/singapore-stock', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'หุ้นไทยเช้า', category: 'stock', icon: '🇹🇭', path: '/lottery/stock/thai-morning', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'หุ้นไทยปิดเย็น', category: 'stock', icon: '🇹🇭', path: '/lottery/stock/thai-evening', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'หุ้นอินเดีย', category: 'stock', icon: '🇮🇳', path: '/lottery/stock/india-stock', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'หุ้นอียิปต์', category: 'stock', icon: '🇪🇬', path: '/lottery/stock/egypt-stock', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'หุ้นรัสเซีย', category: 'stock', icon: '🇷🇺', path: '/lottery/stock/russia-stock', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'หุ้นเยอรมัน', category: 'stock', icon: '🇩🇪', path: '/lottery/stock/germany-stock', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'หุ้นอังกฤษ', category: 'stock', icon: '🇬🇧', path: '/lottery/stock/uk-stock', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'ดาวน์โจนส์ TV', category: 'stock', icon: '🇺🇸', path: '/lottery/stock/dowjones-tv', bgGradient: 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]' },
  { name: 'ดาวน์โจนส์ MIDNIGHT', category: 'stock', icon: '🇺🇸', path: '/lottery/stock/dowjones-midnight', bgGradient: 'bg-gradient-to-b from-[#95a5a6] to-[#7f8c8d]' },
  { name: 'ดาวน์โจนส์ EXTRA', category: 'stock', icon: '🇺🇸', path: '/lottery/stock/dowjones-extra', bgGradient: 'bg-gradient-to-b from-[#95a5a6] to-[#7f8c8d]' },
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
    (allowed === 'หวยรัฐบาลไทย' && n.includes('รัฐบาล')) ||
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
