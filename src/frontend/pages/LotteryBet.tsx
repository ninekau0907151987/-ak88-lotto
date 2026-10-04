import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { collection, addDoc, onSnapshot, doc, getDoc, updateDoc, query, where, getDocs, setDoc, orderBy, limit } from 'firebase/firestore';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { countBets, fmtMoney, fmtInt } from '@/shared/lib/betCount';
import BetSummaryPanel from '@/shared/components/BetSummaryPanel';
import BillDetailModal from '@/frontend/components/BillDetailModal';
import ActionConfirmModal from '@/frontend/components/ActionConfirmModal';
import CompactTicketList from '@/frontend/components/CompactTicketList';
import * as YK from '@/shared/lib/yeekeeEngine';
import { isAllowedOpenLottery } from '@/shared/lib/lotteryCatalog';

interface BetItem {
  id: string;
  number: string;
  amount: number;
  type: string;
  payoutRate?: number;
  isSpecial?: boolean;
  isReduced?: boolean;
}

interface ActiveTicket {
  id: string;
  bets: BetItem[];
  totalAmount: number;
  createdAt: number;
  expiresAt: number;
  status?: string;
  customerName?: string;
  lotteryType?: string;
}

const getPermutations = (str: string): string[] => {
  if (str.length <= 1) return [str];
  const perms = new Set<string>();
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const remaining = str.slice(0, i) + str.slice(i + 1);
    for (const perm of getPermutations(remaining)) {
      perms.add(char + perm);
    }
  }
  return Array.from(perms);
};

export const DEFAULT_RATES: Record<string, number> = {
  '3 ตัวบน': 850.00,
  '3 ตัวโต๊ด': 120.00,
  '3 ตัวล่าง': 450.00,
  '3 ตัวกลับ': 850.00,
  '2 ตัวบน': 92.00,
  '2 ตัวล่าง': 92.00,
  '2 ตัวบนกลับ': 92.00,
  '2 ตัวล่างกลับ': 92.00,
  '2 ตัวโต๊ด': 13.00,
  'วิ่งบน': 3.20,
  'วิ่งล่าง': 4.20,
  '4 ตัวบน': 5000.00,
  '4 ตัวโต๊ด': 200.00,
  '5 ตัวตรง': 30000.00,
  '4-5 ตัว': 4000.00,
  '2 ตัวกลับ': 92.00,
  '5 ตัวโต๊ด': 15.00,
  'ปักหลักหน่วย': 8.00,
  'ปักหลักสิบ': 8.00,
  'ปักหลักร้อย': 8.00,
  'เลขปัก': 8.00
};

export default function LotteryBet() {
  const navigate = useNavigate();
  const { type } = useParams();
  const { isPC, isMobile } = useBreakpoint();
  const [betNumber, setBetNumber] = useState('');
  const [betAmount, setBetAmount] = useState(5);
  const [selectedBets, setSelectedBets] = useState<BetItem[]>([]);
  const [activeTickets, setActiveTickets] = useState<ActiveTicket[]>([]);
  const [timeLeft, setTimeLeft] = useState(180);
  const [activeBetTypes, setActiveBetTypes] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinType, setPinType] = useState('หลักสิบ'); // หลักร้อย, หลักสิบ, หลักหน่วย
  const [pinNumbers, setPinNumbers] = useState<string[]>([]);
  const [selectedQuickDigits, setSelectedQuickDigits] = useState<string[]>([]);
  const [tongType, setTongType] = useState<'3 ตัว' | '2 ตัว'>('3 ตัว');
  const [lotteryConfig, setLotteryConfig] = useState<any>(null);
  const [blockedNumbers, setBlockedNumbers] = useState<any[]>([]);
  const [specialModes, setSpecialModes] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [globalSettings, setGlobalSettings] = useState<any>({});
  const [userData, setUserData] = useState<any>(null);
  const [showSetModal, setShowSetModal] = useState(false);
  const [savedSets, setSavedSets] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [pastTickets, setPastTickets] = useState<any[]>([]);
  const [showPanelModal, setShowPanelModal] = useState(false);
  const [selectedPanelNumbers, setSelectedPanelNumbers] = useState<string[]>([]);
  const [duplicateKeys, setDuplicateKeys] = useState<string[]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [blinkAlert, setBlinkAlert] = useState(false);
  const [confirmTicketInfo, setConfirmTicketInfo] = useState<{
    ticketId: string;
    total: number;
    bets: BetItem[];
    date: number;
    customerName: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDupConfirm, setShowDupConfirm] = useState<number | null>(null);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'active' | 'cancelled'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSuccessReceipt, setShowSuccessReceipt] = useState<{
    ticketId: string;
    total: number;
    date: number;
    customerName: string;
    displayName: string;
    bets: BetItem[];
  } | null>(null);
  const [selectedTicketForBill, setSelectedTicketForBill] = useState<ActiveTicket | null>(null);

  const copyTicketAsBillText = (ticket: any) => {
    // Group bets
    const groups: { [key: string]: { number: string; amount: number }[] } = {};
    ticket.bets.forEach((bet: any) => {
      if (!groups[bet.type]) groups[bet.type] = [];
      groups[bet.type].push({ number: bet.number, amount: bet.amount });
    });

    const isSuccessReceipt = 'displayName' in ticket;
    const lName = isSuccessReceipt ? ticket.displayName : displayName;
    const tId = isSuccessReceipt ? ticket.ticketId : ticket.id;
    const tDate = isSuccessReceipt ? ticket.date : (ticket.createdAt || Date.now());
    const cName = ticket.customerName || 'ลูกค้าทั่วไป';

    let billText = `=============================\n`;
    billText += `   ใบเสร็จรับเงิน / โพยแทงหวย\n`;
    billText += `   ประเภท: ${lName}\n`;
    billText += `=============================\n`;
    billText += `เลขบิล: ${tId}\n`;
    billText += `วันที่: ${new Date(tDate).toLocaleString('th-TH')}\n`;
    billText += `ลูกค้า: ${cName}\n`;
    billText += `-----------------------------\n`;

    Object.entries(groups).forEach(([type, bets]) => {
      billText += `▶ [${type}]\n`;
      const lines: string[] = [];
      bets.forEach(b => {
        lines.push(`${b.number}=${b.amount}฿`);
      });
      // chunk into groups of 3 for readability
      for (let i = 0; i < lines.length; i += 3) {
        billText += `   ` + lines.slice(i, i + 3).join(', ') + `\n`;
      }
      const typeTotal = bets.reduce((sum, b) => sum + b.amount, 0);
      billText += `   รวมยอด: ${typeTotal} ฿\n`;
      billText += `-----------------------------\n`;
    });

    const totalAmt = isSuccessReceipt ? ticket.total : ticket.totalAmount;
    billText += `ยอดรวมทั้งหมด: ${totalAmt.toLocaleString()} ฿\n`;
    if (globalSettings?.taxEnabled) {
      billText += `* ระบบภาษี: หัก ณ ที่จ่าย ${globalSettings.taxRate || 1}% (คำนวณหักเมื่อถูกรางวัล)\n`;
    }
    billText += `=============================\n`;
    billText += `* ขอบคุณที่ใช้บริการครับ *\n`;

    navigator.clipboard.writeText(billText).then(() => {
      alert('คัดลอกข้อความบิลสำเร็จแล้ว! สามารถกดส่งต่อทาง LINE หรือ Facebook ได้ทันที');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      alert('ไม่สามารถคัดลอกได้อัตโนมัติ กรุณาลองอีกครั้ง');
    });
  };

  // Clear duplicate highlights when bets change
  useEffect(() => {
    setDuplicateKeys([]);
  }, [selectedBets]);

  // Handle toast timer
  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => {
        setShowSuccessToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  useEffect(() => {
    if (showHistoryModal) {
      const fetchTickets = async () => {
        try {
          const currentUserId = localStorage.getItem('userId');
          if (!currentUserId) return;
          const q = query(
            collection(db, 'tickets'), 
            where('userId', '==', currentUserId), 
            limit(20)
          );
          const snap = await getDocs(q);
          
          let tickets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
          tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setPastTickets(tickets);
        } catch(err) {
          console.error('Error fetching past tickets:', err);
        }
      };
      fetchTickets();
    }
  }, [showHistoryModal]);

  useEffect(() => {
    const sets = localStorage.getItem('numberSets');
    if (sets) {
      try { setSavedSets(JSON.parse(sets)); } catch (e) {}
    }
  }, []);

  // Map URL param to display name
  const getLotteryDisplayName = (typeParam: string | undefined) => {
    if (!typeParam) return 'หวยรัฐบาล';
    if (typeParam.startsWith('yeekee-')) {
      const round = typeParam.split('-')[1];
      return `หวยยี่กี (88 รอบ) รอบ ${round}`;
    }
    
    const TYPE_MAP: Record<string, string> = {
      'thai': 'หวยรัฐบาล',
      'yeekee': 'หวยยี่กี 88 รอบ',
      'baac': 'หวยธกส.',
      'gsb': 'หวยออมสิน',
      'lao-pratuchai': 'หวยลาวประตูชัย',
      'lao-santipap': 'หวยลาวสันติภาพ',
      'lao-public': 'หวยประชาชนลาว',
      'lao-extra': 'ลาว(EXTRA)',
      'lao-tv': 'หวยลาวTV',
      'hanoi-hd': 'ฮานอย(HD)',
      'hanoi-star': 'ฮานอยสตาร์',
      'lao-hd': 'หวยลาวHD',
      'hanoi-tv': 'ฮานอยTV',
      'lao-star': 'หวยลาวสตาร์',
      'hanoi-redcross': 'ฮานอยกาชาด',
      'hanoi-special': 'ฮานอยพิเศษ',
      'hanoi-samakkhi': 'ฮานอยสามัคคี',
      'hanoi': 'หวยฮานอย',
      'hanoi-vip': 'ฮานอย(VIP)',
      'lao-star-vip': 'หวยลาวสตาร์(VIP)',
      'hanoi-extra': 'ฮานอย(EXTRA)',
      'lao-redcross': 'ลาวกาชาด',
      'dowjones-star': 'ดาวน์โจนส์ STAR',
      'nikkei-m': 'นิเคอิ VIP (เช้า)',
      'vietnam-m': 'เวียดนาม VIP (เช้า)',
      'china-m': 'จีน VIP (เช้า)',
      'hangseng-m': 'ฮั่งเส็ง VIP (เช้า)',
      'taiwan': 'ไต้หวัน VIP',
      'korea': 'เกาหลี VIP',
      'nikkei-a': 'นิเคอิ VIP (บ่าย)',
      'vietnam-a': 'เวียดนาม VIP (บ่าย)',
      'china-a': 'จีน VIP (บ่าย)',
      'hangseng-a': 'ฮั่งเส็ง VIP (บ่าย)',
      'lao-vip': 'ลาว VIP',
      'vietnam-e': 'เวียดนาม VIP (เย็น)',
      'singapore-vip': 'สิงคโปร์ VIP',
      'uk-vip': 'อังกฤษ(VIP)',
      'germany-vip': 'เยอรมัน(VIP)',
      'russia-vip': 'รัสเซีย(VIP)',
      'dowjones-vip': 'ดาวน์โจนส์(VIP)',
      'dowjones-tv': 'ดาวน์โจนส์ TV',
      'nikkei-morning': 'หุ้นนิเคอิรอบเช้า',
      'china-morning': 'จีนรอบเช้า',
      'hangseng-morning': 'ฮั่งเส็งรอบเช้า',
      'taiwan-stock': 'หุ้นไต้หวัน',
      'korea-stock': 'หุ้นเกาหลี',
      'nikkei-afternoon': 'นิเคอิปิดบ่าย',
      'china-afternoon': 'จีนปิดรอบบ่าย',
      'hangseng-afternoon': 'ฮั่งเส็งปิดบ่าย',
      'singapore-stock': 'หุ้นสิงคโปร์',
      'thai-morning': 'หุ้นไทยเช้า',
      'thai-evening': 'หุ้นไทยปิดเย็น',
      'india-stock': 'หุ้นอินเดีย',
      'egypt-stock': 'หุ้นอียิปต์',
      'russia-stock': 'หุ้นรัสเซีย',
      'germany-stock': 'หุ้นเยอรมัน',
      'uk-stock': 'หุ้นอังกฤษ',
      'dowjones-stock': 'หุ้นดาวน์โจนส์',
      'dowjones-midnight': 'ดาวน์โจนส์ MIDNIGHT',
      'dowjones-extra': 'ดาวน์โจนส์ EXTRA'
    };
    
    return TYPE_MAP[typeParam] || 'หวยรัฐบาล';
  };

  const getLotteryIcon = (typeParam: string | undefined): string => {
    if (!typeParam) return 'https://flagcdn.com/w80/th.png';
    const t = typeParam.toLowerCase();
    if (t.includes('lao')) return 'https://flagcdn.com/w80/la.png';
    if (t.includes('hanoi') || t.includes('vietnam')) return 'https://flagcdn.com/w80/vn.png';
    if (t.includes('dowjones')) return 'https://flagcdn.com/w80/us.png';
    if (t.includes('nikkei')) return 'https://flagcdn.com/w80/jp.png';
    if (t.includes('china')) return 'https://flagcdn.com/w80/cn.png';
    if (t.includes('hangseng')) return 'https://flagcdn.com/w80/hk.png';
    if (t.includes('taiwan')) return 'https://flagcdn.com/w80/tw.png';
    if (t.includes('korea')) return 'https://flagcdn.com/w80/kr.png';
    if (t.includes('singapore')) return 'https://flagcdn.com/w80/sg.png';
    if (t.includes('india')) return 'https://flagcdn.com/w80/in.png';
    if (t.includes('egypt')) return 'https://flagcdn.com/w80/eg.png';
    if (t.includes('russia')) return 'https://flagcdn.com/w80/ru.png';
    if (t.includes('germany')) return 'https://flagcdn.com/w80/de.png';
    if (t.includes('uk')) return 'https://flagcdn.com/w80/gb.png';
    if (t.includes('yeekee')) return 'https://cdn-icons-png.flaticon.com/128/850/850258.png'; // clock/timer icon
    // Default fallback
    return 'https://flagcdn.com/w80/th.png';
  };

  const getBaseLotteryName = (typeParam: string | undefined) => {
    if (!typeParam) return 'หวยรัฐบาล';
    if (typeParam.startsWith('yeekee-')) {
      return 'หวยยี่กี 88 รอบ';
    }
    return getLotteryDisplayName(typeParam);
  };

  const displayName = getLotteryDisplayName(type);
  const baseLotteryName = getBaseLotteryName(type);
  const isThaiLottery = displayName === 'หวยรัฐบาล' || type === 'thai' || displayName.includes('รัฐบาล');
  const isYeekee = Boolean(type?.startsWith('yeekee') || displayName.includes('ยี่กี'));
  const yeekeeRoundNum = useMemo(() => {
    if (!type) return 1;
    if (type.startsWith('yeekee-')) {
      const n = parseInt(type.split('-')[1], 10);
      return !isNaN(n) && n >= 1 && n <= YK.ROUNDS_PER_DAY ? n : 1;
    }
    return 1;
  }, [type]);

  const [ykConfig, setYkConfig] = useState<YK.YkConfig>(YK.DEFAULT_CONFIG);
  const [ykRoundRow, setYkRoundRow] = useState<YK.RoundRow | null>(null);
  const [ykShoots, setYkShoots] = useState<YK.Shoot[]>([]);
  const [ykShootInput, setYkShootInput] = useState('');
  const [ykShooting, setYkShooting] = useState(false);
  const [showShooterModal, setShowShooterModal] = useState(false);

  const ykGameDay = useMemo(() => YK.gameDayOf(currentTime), [currentTime]);
  const ykOpenMs = useMemo(() => YK.openMsOf(ykGameDay, yeekeeRoundNum), [ykGameDay, yeekeeRoundNum]);
  const ykCloseMs = useMemo(() => YK.closeMsOf(ykGameDay, yeekeeRoundNum), [ykGameDay, yeekeeRoundNum]);
  const ykPhase = useMemo(() => YK.phaseOf(ykGameDay, yeekeeRoundNum, currentTime, ykRoundRow), [ykGameDay, yeekeeRoundNum, currentTime, ykRoundRow]);
  const ykShootsSum = useMemo(() => ykShoots.reduce((a, b) => a + (Number(b.number) || 0), 0), [ykShoots]);
  const ykShooter1 = ykShoots[0];
  const ykShooter18 = ykShoots.length >= 18 ? ykShoots[17] : undefined;
  const ykLottery6 = useMemo(() => String(ykShootsSum % 1000000).padStart(6, '0'), [ykShootsSum]);
  const yk3Top = useMemo(() => ykLottery6.slice(-3), [ykLottery6]);
  const yk2Top = useMemo(() => ykLottery6.slice(-2), [ykLottery6]);
  const yk2Bottom = useMemo(() => ykLottery6.slice(-5, -3), [ykLottery6]);

  // คำนวณคูลดาวน์ 3 นาที (180 วินาที) ของผู้ใช้
  const userLastShoot = useMemo(() => {
    const s = YK.getSession();
    if (!s.loggedIn) return null;
    const mine = ykShoots.filter(sh => sh.userId === s.userId);
    return mine.length > 0 ? mine[mine.length - 1] : null;
  }, [ykShoots]);

  const cooldownRemainingSec = useMemo(() => {
    if (!userLastShoot) return 0;
    const elapsed = currentTime - userLastShoot.ts;
    const cooldownMs = 3 * 60 * 1000;
    if (elapsed < cooldownMs) {
      return Math.ceil((cooldownMs - elapsed) / 1000);
    }
    return 0;
  }, [userLastShoot, currentTime]);
  const ykResultWaitSec = useMemo(() => {
    const resAt = YK.resultAtMs(ykGameDay, yeekeeRoundNum, ykConfig);
    return Math.max(0, Math.floor((resAt - currentTime) / 1000));
  }, [ykGameDay, yeekeeRoundNum, ykConfig, currentTime]);

  const reloadYeekee = useCallback(async () => {
    if (!isYeekee) return;
    try {
      const cfg = await YK.loadConfig();
      setYkConfig(cfg);
      const row = await YK.getRoundRow(ykGameDay, yeekeeRoundNum);
      setYkRoundRow(row);
      const shoots = await YK.loadShoots(ykGameDay, yeekeeRoundNum);
      setYkShoots(shoots);

      if (cfg.enabled && cfg.numberBot.enabled) {
        await YK.runNumberBot(ykGameDay, yeekeeRoundNum, Date.now(), cfg);
      }

      const ph = YK.phaseOf(ykGameDay, yeekeeRoundNum, Date.now(), row);
      if (ph === 'processing') {
        await YK.sweep(Date.now());
      }
    } catch (e) {
      console.error('[YeekeeBet] reload error:', e);
    }
  }, [isYeekee, ykGameDay, yeekeeRoundNum]);

  useEffect(() => {
    if (!isYeekee) return;
    reloadYeekee();
    const interval = setInterval(reloadYeekee, 3000);
    return () => clearInterval(interval);
  }, [isYeekee, reloadYeekee]);

  useEffect(() => {
    if (isYeekee && activeBetTypes.length === 0) {
      setActiveBetTypes(['3 ตัวบน']);
    }
  }, [isYeekee]);

  const handleShootNumber = async () => {
    if (cooldownRemainingSec > 0) {
      const m = Math.floor(cooldownRemainingSec / 60);
      const s = cooldownRemainingSec % 60;
      alert(`คุณเพิ่งยิงเลขไป กรุณารออีก ${m} นาที ${s} วินาที ถึงจะยิงเลขในรอบนี้ได้อีกครั้ง (คูลดาวน์ 3 นาที)`);
      return;
    }
    if (!/^\d{5}$/.test(ykShootInput)) {
      alert('กรุณากรอกตัวเลข 5 หลักให้ถูกต้อง (00000 - 99999)');
      return;
    }
    const s = YK.getSession();
    if (!s.loggedIn) {
      alert('กรุณาเข้าสู่ระบบก่อนทำการยิงเลข');
      navigate('/login');
      return;
    }
    setYkShooting(true);
    try {
      await YK.submitShoot(ykGameDay, yeekeeRoundNum, ykShootInput, Date.now());
      setYkShootInput('');
      await reloadYeekee();
      alert('🎯 ยิงเลข 5 หลักสำเร็จแล้ว! (คุณสามารถยิงได้อีกครั้งในอีก 3 นาที)');
    } catch (err: any) {
      alert(err?.message || 'เกิดข้อผิดพลาดในการยิงเลข');
    } finally {
      setYkShooting(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'lotteryTypes'), (snapshot) => {
      const allTypes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const found = allTypes.find((item: any) => {
        if (type && (item.path === `/lottery/${type}` || item.path === `/lottery/${type.toLowerCase()}`)) return true;
        if (item.id === baseLotteryName || item.name === baseLotteryName) return true;
        if (type && (item.id === type || item.name === type)) return true;
        const idStr = String(item.id || '');
        const nameStr = String(item.name || '');
        if (type === 'thai' && (idStr.includes('รัฐบาล') || nameStr.includes('รัฐบาล'))) return true;
        if (type === 'lao' && (idStr.includes('ลาว') || nameStr.includes('ลาว'))) return true;
        if (type === 'baac' && (idStr.includes('ธกส') || nameStr.includes('ธกส'))) return true;
        if (type === 'gsb' && (idStr.includes('ออมสิน') || nameStr.includes('ออมสิน'))) return true;
        if (baseLotteryName && (idStr.includes(baseLotteryName) || baseLotteryName.includes(idStr))) return true;
        return false;
      });
      if (found) {
        setLotteryConfig(found);
      }
    });
    
    // Listen for blocked numbers for this lottery type
    const unsubscribeBlocked = onSnapshot(collection(db, 'blocked_numbers'), (snapshot) => {
      const blocked = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((b: any) => b.lotteryType === baseLotteryName);
      setBlockedNumbers(blocked);
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setGlobalSettings(doc.data());
      }
    });

    const currentUserId = localStorage.getItem('userId');
    let unsubscribeUser = () => {};
    if (currentUserId) {
      unsubscribeUser = onSnapshot(doc(db, 'users', currentUserId), (snap) => {
        if (snap.exists()) {
          setUserData(snap.data());
        }
      });
    }

    return () => {
      unsubscribe();
      unsubscribeBlocked();
      unsubscribeSettings();
      unsubscribeUser();
    };
  }, [displayName]);

  // Default to open if config not found (for demo purposes)
  const getRequiredLength = (type: string) => {
    if (type.includes('5 ตัว') || type === '5 ตัวตรง') return 5;
    if (type.includes('3 ตัว') || type === 'ตอง') return 3;
    if (type.includes('4 ตัว') || type.includes('4-5 ตัว')) return 4;
    if (type.includes('วิ่ง') || type === 'เลขปัก' || type.startsWith('ปักหลัก') || type.startsWith('หลัก')) return 1;
    return 2;
  };

  const toggleBetType = (type: string) => {
    setSelectedQuickDigits([]);
    if (type === '4-5 ตัว') {
      if (activeBetTypes.some(t => t.includes('4') || t.includes('5'))) {
        setActiveBetTypes(['3 ตัวบน']);
      } else {
        setActiveBetTypes(['4 ตัวบน']);
      }
      setBetNumber('');
      setSpecialModes([]);
      setPinNumbers([]);
      return;
    }

    const newLength = getRequiredLength(type);
    const currentLength = activeBetTypes.length > 0 ? getRequiredLength(activeBetTypes[0]) : newLength;

    if (newLength !== currentLength) {
      setSpecialModes([]);
      setPinNumbers([]);
    }

    setActiveBetTypes(prev => {
      if (prev.includes(type)) {
        const next = prev.filter(t => t !== type);
        return next;
      } else {
        if (newLength !== currentLength) {
          return [type];
        }
        return [...prev, type];
      }
    });
    setBetNumber('');
  };

  const toggleSpecialMode = (mode: string) => {
    setSpecialModes(prev => {
      if (prev.includes(mode)) {
        return prev.filter(m => m !== mode);
      } else {
        return [...prev, mode];
      }
    });
  };

  const formatClosingDisplay = (closingTimeStr?: string) => {
    if (!closingTimeStr) return 'เปิดรับแทง';
    try {
      const d = new Date(closingTimeStr);
      if (isNaN(d.getTime())) return closingTimeStr;
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
      if (isToday) return `ปิดรับวันนี้ ${timeStr}`;
      return `${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ${timeStr}`;
    } catch {
      return closingTimeStr;
    }
  };

  const isClosed = useMemo(() => {
    if (isYeekee) {
      return ykPhase !== 'open';
    }
    // 1. Global kill-switch from settings/global
    if (globalSettings?.systemOpen === false || globalSettings?.bettingOpen === false) {
      return true;
    }

    // 2. Strict Rule: ปิดทุกหวย เปิดเฉพาะ 3 หวยหลัก (หวยไทย, หุ้นไทยเช้า, ยี่กี)
    const isAllowed = isAllowedOpenLottery(displayName) || isAllowedOpenLottery(type || '');
    const isExplicitlyOpen = lotteryConfig?.isOpen === true || lotteryConfig?.is_open === true;
    if (!isAllowed && !isExplicitlyOpen) {
      return true; // ปิดรับแทงทุกหวยที่ไม่ได้รับอนุญาต
    }

    // 3. Admin open/close status
    if (lotteryConfig) {
      if (lotteryConfig.isOpen === false || lotteryConfig.is_open === false) return true;
      if (lotteryConfig.status === 'closed') return true;
      if (lotteryConfig.isPaused === true || lotteryConfig.is_paused === true) return true;

      // 4. Closing time check
      const closeTimeVal = lotteryConfig.closingTime || lotteryConfig.close_time;
      if (closeTimeVal) {
        const closeMs = new Date(closeTimeVal).getTime();
        if (!isNaN(closeMs) && closeMs <= currentTime) {
          return true;
        }
      }
    }
    return false;
  }, [isYeekee, ykPhase, globalSettings, lotteryConfig, currentTime, displayName, type]);

  const remainingCloseSec = useMemo(() => {
    const closeTimeVal = lotteryConfig?.closingTime || lotteryConfig?.close_time;
    if (!closeTimeVal) return null;
    const closeMs = new Date(closeTimeVal).getTime();
    if (isNaN(closeMs)) return null;
    return Math.max(0, Math.floor((closeMs - currentTime) / 1000));
  }, [lotteryConfig, currentTime]);

  // Auto-add bet when number is complete
  useEffect(() => {
    if (activeBetTypes.length === 0) return;
    
    const isRood = specialModes.includes('รูดหน้า') || specialModes.includes('รูดหลัง') || specialModes.includes('19ประตู');
    const requiredLength = isRood ? 1 : getRequiredLength(activeBetTypes[0]);
    
    if (betNumber.length === requiredLength && !activeBetTypes.includes('4-5 ตัว')) {
      addBet();
    }
  }, [betNumber, activeBetTypes, betAmount, specialModes]);
  
  // Global Timer for all countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatRemainingTime = (expiresAt: number) => {
    const remaining = Math.max(0, Math.floor((expiresAt - currentTime) / 1000));
    return formatTime(remaining);
  };

  const handleNumberClick = (num: string) => {
    if (activeBetTypes.length === 0) {
      alert('กรุณาเลือกชนิดการแทง');
      return;
    }

    const isSpecialMode = specialModes.length > 0;
    const isRood = specialModes.includes('รูดหน้า') || specialModes.includes('รูดหลัง') || specialModes.includes('19ประตู');
    const maxLength = activeBetTypes.includes('4-5 ตัว') ? 5 : (isRood ? 1 : getRequiredLength(activeBetTypes[0]));

    if (betNumber.length < maxLength) {
      setBetNumber(prev => prev + num);
    }
  };

  const addSpecialBets = (numbers: string[], specificTypes?: string[]) => {
    const newBets: BetItem[] = [];
    let hasBlocked = false;
    const typesToUse = specificTypes || activeBetTypes;

    if (typesToUse.length === 0) {
      alert('กรุณาเลือกประเภทการแทง');
      return;
    }

    const is2DigitReverse = typesToUse.includes('2 ตัวกลับ');
    const is3DigitReverse = typesToUse.includes('3 ตัวกลับ');
    let actualBetTypes = typesToUse.filter(t => t !== '2 ตัวกลับ' && t !== '3 ตัวกลับ');

    if (actualBetTypes.length === 0) {
       if (is2DigitReverse) actualBetTypes = ['2 ตัวบน'];
       if (is3DigitReverse) actualBetTypes = ['3 ตัวบน'];
    }

    numbers.forEach(originalNum => {
      let numsToAdd = [originalNum];
      if (originalNum.length === 2 && is2DigitReverse) {
        numsToAdd = getPermutations(originalNum);
      } else if (originalNum.length === 3 && is3DigitReverse) {
        numsToAdd = getPermutations(originalNum);
      }

      numsToAdd.forEach(num => {
        actualBetTypes.forEach(type => {
          if (type === 'เลขปัก') {
            if (pinNumbers.length === 0) {
              return;
            }
            pinNumbers.forEach(pin => {
              const pinTypeStr = `ปัก${pin}`;
              const blockInfo = blockedNumbers.find(b => 
                b.number === num && (b.betType === 'ทุกประเภท' || b.betType === pinTypeStr)
              );

              let payoutRate = lotteryConfig?.rates?.[pinTypeStr] || DEFAULT_RATES[pinTypeStr] || 0;
              const medianRate = lotteryConfig?.medianRates?.[pinTypeStr] || 0;
              let isSpecial = false;
              let isReduced = false;

              if (blockInfo) {
                if (blockInfo.restrictionType === 'blocked' || !blockInfo.restrictionType) {
                  hasBlocked = true;
                  return;
                } else if (blockInfo.restrictionType === 'reduced') {
                  payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
                } else if (blockInfo.restrictionType === 'special') {
                  payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
                }
              }

              if (payoutRate < medianRate) isReduced = true;
              if (payoutRate > medianRate) isSpecial = true;

              if (!newBets.some(b => b.number === num && b.type === pinTypeStr)) {
                newBets.push({
                  id: Math.random().toString(36).substr(2, 9) + num + pinTypeStr,
                  number: num,
                  amount: betAmount,
                  type: pinTypeStr,
                  payoutRate,
                  isSpecial,
                  isReduced
                });
              }
            });
            return;
          }

          const reqLen = getRequiredLength(type.replace('ปัก', ''));
          if (num.length !== reqLen && !type.includes('4-5 ตัว')) return;

          const blockInfo = blockedNumbers.find(b => 
            b.number === num && (b.betType === 'ทุกประเภท' || b.betType === type)
          );

          let payoutRate = (isYeekee ? (ykConfig?.rates?.[type] ?? YK.DEFAULT_RATES[type]) : null) ?? lotteryConfig?.rates?.[type] ?? DEFAULT_RATES[type] ?? 0;
          const medianRate = lotteryConfig?.medianRates?.[type] || 0;
          let isSpecial = false;
          let isReduced = false;

          if (blockInfo) {
            if (blockInfo.restrictionType === 'blocked' || !blockInfo.restrictionType) {
              hasBlocked = true;
              return;
            } else if (blockInfo.restrictionType === 'reduced') {
              payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
            } else if (blockInfo.restrictionType === 'special') {
              payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
            }
          }

          if (payoutRate < medianRate) isReduced = true;
          if (payoutRate > medianRate) isSpecial = true;

          if (!newBets.some(b => b.number === num && b.type === type)) {
            newBets.push({
              id: Math.random().toString(36).substr(2, 9) + num + type,
              number: num,
              amount: betAmount,
              type: type,
              payoutRate,
              isSpecial,
              isReduced
            });
          }
        });
      });
    });

    if (newBets.length > 0) {
      setSelectedBets(prev => [...newBets, ...prev]);
      setBlinkAlert(true);
      setTimeout(() => setBlinkAlert(false), 500);
    }
    if (hasBlocked) {
      alert('บางตัวเลขถูกปิดรับแทง (อั้น) จึงไม่ถูกเพิ่มในรายการ');
    }
  };

  const handleBackspace = () => {
    setBetNumber(prev => prev.slice(0, -1));
  };

  const adjustAmount = (delta: number) => {
    setBetAmount(prev => Math.max(1, prev + delta));
  };

  const addBet = () => {
    if (activeBetTypes.length === 0) {
      alert('กรุณาเลือกประเภทการแทง');
      return;
    }

    const isRood = specialModes.includes('รูดหน้า') || specialModes.includes('รูดหลัง') || specialModes.includes('19ประตู');
    const requiredLength = isRood ? 1 : getRequiredLength(activeBetTypes[0]);

    if (betNumber.length < requiredLength && !activeBetTypes.some(t => t.includes('4-5 ตัว'))) {
      alert(`กรุณาระบุตัวเลขให้ครบอย่างน้อย ${requiredLength} หลัก`);
      return;
    }

    if (activeBetTypes.includes('เลขปัก') && pinNumbers.length === 0) {
      alert('กรุณาเลือกหลักที่จะปัก');
      return;
    }

    // Validation against global settings
    if (globalSettings.systemOpen === false) {
      alert(globalSettings.maintenanceMessage || 'ขออภัย ระบบกำลังปิดปรับปรุงชั่วคราว ไม่สามารถส่งโพยได้');
      return;
    }
    if (globalSettings.bettingOpen === false) {
      alert('ขออภัย ระบบรับแทงหวยปิดให้บริการชั่วคราว ไม่สามารถส่งโพยได้');
      return;
    }
    if (globalSettings.minBet && betAmount < globalSettings.minBet) {
      alert(`ยอดแทงขั้นต่ำคือ ฿${globalSettings.minBet}`);
      return;
    }
    if (globalSettings.maxBetPerUser && betAmount > globalSettings.maxBetPerUser) {
      alert(`ยอดแทงสูงสุดต่อเลขคือ ฿${globalSettings.maxBetPerUser}`);
      return;
    }

    const newBets: BetItem[] = [];
    let hasBlocked = false;

    const is2DigitReverse = activeBetTypes.includes('2 ตัวกลับ');
    const is3DigitReverse = activeBetTypes.includes('3 ตัวกลับ');
    const actualBetTypes = activeBetTypes.filter(t => t !== '2 ตัวกลับ' && t !== '3 ตัวกลับ');

    if (actualBetTypes.length === 0) {
       if (is2DigitReverse) actualBetTypes.push('2 ตัวบน');
       if (is3DigitReverse) actualBetTypes.push('3 ตัวบน');
    }

    const createBetItem = (num: string, type: string) => {
      const blockInfo = blockedNumbers.find(b => 
        b.number === num && (b.betType === 'ทุกประเภท' || b.betType === type)
      );

      let payoutRate = (isYeekee ? (ykConfig?.rates?.[type] ?? YK.DEFAULT_RATES[type]) : null) ?? lotteryConfig?.rates?.[type] ?? DEFAULT_RATES[type] ?? 0;
      const medianRate = lotteryConfig?.medianRates?.[type] || 0;
      let isSpecial = false;
      let isReduced = false;

      if (blockInfo) {
        if (blockInfo.restrictionType === 'blocked' || !blockInfo.restrictionType) {
          hasBlocked = true;
          return null;
        } else if (blockInfo.restrictionType === 'reduced') {
          payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
        } else if (blockInfo.restrictionType === 'special') {
          payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
        }
      }

      if (payoutRate < medianRate) isReduced = true;
      if (payoutRate > medianRate) isSpecial = true;

      return {
        id: Math.random().toString(36).substr(2, 9),
        number: num,
        amount: betAmount,
        type: type,
        payoutRate,
        isSpecial,
        isReduced
      };
    };

    actualBetTypes.forEach(type => {
      let numsToAdd = new Set<string>();
      const isTode = type.includes('โต๊ด');

      if (isRood && betNumber.length === 1) {
        specialModes.forEach(mode => {
          if (mode === 'รูดหน้า') {
            for (let i = 0; i <= 9; i++) numsToAdd.add(betNumber + i);
          } else if (mode === 'รูดหลัง') {
            for (let i = 0; i <= 9; i++) numsToAdd.add(i + betNumber);
          } else if (mode === '19ประตู') {
            for (let i = 0; i <= 9; i++) {
              numsToAdd.add(betNumber + i);
              numsToAdd.add(i + betNumber);
            }
          }
        });
      } else {
        if (betNumber.length === 2 && is2DigitReverse && !type.includes('โต๊ด')) {
          getPermutations(betNumber).forEach(n => numsToAdd.add(n));
        } else if (betNumber.length === 3 && is3DigitReverse && !type.includes('โต๊ด')) {
          getPermutations(betNumber).forEach(n => numsToAdd.add(n));
        } else {
          numsToAdd.add(betNumber);
        }
      }

      Array.from(numsToAdd).forEach(num => {
        if (type === 'เลขปัก') {
          if (num.length === 1) {
            pinNumbers.forEach(pin => {
              const bet = createBetItem(num, `ปัก${pin}`);
              if (bet) newBets.push(bet);
            });
          }
        } else {
          if (num.length === getRequiredLength(type) || type.includes('4-5 ตัว')) {
            const bet = createBetItem(num, type);
            if (bet) newBets.push(bet);
          }
        }
      });
    });

    if (hasBlocked) {
      alert('มีบางเลขถูกปิดรับ (อั้น) และถูกตัดออกอัตโนมัติ');
    }

    if (newBets.length > 0) {
      setSelectedBets(prev => [...newBets, ...prev]);
    }
    
    setBetNumber('');
  };

  const removeBet = (id: string) => {
    setSelectedBets(prev => prev.filter(bet => bet.id !== id));
  };

  const updateAllAmounts = (amount: number) => {
    setSelectedBets(prev => prev.map(bet => ({ ...bet, amount })));
  };

  const updateBetAmount = (id: string, amount: number) => {
    setSelectedBets(prev => prev.map(bet => bet.id === id ? { ...bet, amount } : bet));
  };

  const clearAllBets = () => {
    if (selectedBets.length === 0) return;
    setShowClearConfirm(true);
  };

  const executeClearAllBets = () => {
    setSelectedBets([]);
    setShowClearConfirm(false);
  };

  const addRangeBets = (start: number, end: number) => {
    if (!activeBetTypes.some(t => t.includes('3 ตัว'))) {
      alert('กรุณาเลือกประเภท 3 ตัว ก่อนกดเลือกช่วงตัวเลข');
      return;
    }
    const newBets: BetItem[] = [];
    let hasBlocked = false;

    for (let i = start; i <= end; i++) {
      const num = String(i).padStart(3, '0');
      
      activeBetTypes.forEach(type => {
        const blockInfo = blockedNumbers.find(b => 
          b.number === num && (b.betType === 'ทุกประเภท' || b.betType === type)
        );

        let payoutRate = lotteryConfig?.rates?.[type] || DEFAULT_RATES[type] || 0;
        let isSpecial = false;
        let isReduced = false;

        if (blockInfo) {
          if (blockInfo.restrictionType === 'blocked' || !blockInfo.restrictionType) {
            hasBlocked = true;
            return;
          } else if (blockInfo.restrictionType === 'reduced') {
            payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
            isReduced = true;
          } else if (blockInfo.restrictionType === 'special') {
            payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
            isSpecial = true;
          }
        }

        newBets.push({
          id: Math.random().toString(36).substr(2, 9) + i,
          number: num,
          amount: betAmount,
          type: type,
          payoutRate,
          isSpecial,
          isReduced
        });
      });
    }

    if (hasBlocked) {
      alert('มีบางเลขถูกปิดรับ (อั้น) และถูกตัดออกอัตโนมัติ');
    }

    if (newBets.length > 0) {
      setSelectedBets(prev => [...newBets, ...prev]);
      setBlinkAlert(true);
      setTimeout(() => setBlinkAlert(false), 500);
    }
  };

  const generatePinBets = () => {
    if (pinNumbers.length === 0) {
      alert('กรุณาเลือกตัวเลขอย่างน้อย 1 ตัว');
      return;
    }
    
    const is3Digit = activeBetTypes.some(t => t.includes('3 ตัว'));
    const is2Digit = activeBetTypes.some(t => t.includes('2 ตัว'));
    
    if (!is3Digit && !is2Digit) {
      alert('กรุณาเลือกประเภท 2 ตัว หรือ 3 ตัว เพื่อใช้ปักหลัก');
      return;
    }

    // Validation against global settings
    if (globalSettings.minBet && betAmount < globalSettings.minBet) {
      alert(`ยอดแทงขั้นต่ำคือ ฿${globalSettings.minBet}`);
      return;
    }
    if (globalSettings.maxBetPerUser && betAmount > globalSettings.maxBetPerUser) {
      alert(`ยอดแทงสูงสุดต่อเลขคือ ฿${globalSettings.maxBetPerUser}`);
      return;
    }

    const generatedNumbers: string[] = [];

    pinNumbers.forEach(num => {
      if (is2Digit) {
        if (pinType === 'หลักสิบ') {
          for (let i = 0; i <= 9; i++) generatedNumbers.push(`${num}${i}`);
        } else if (pinType === 'หลักหน่วย') {
          for (let i = 0; i <= 9; i++) generatedNumbers.push(`${i}${num}`);
        }
      } else if (is3Digit) {
        if (pinType === 'หลักร้อย') {
          for (let i = 0; i <= 99; i++) generatedNumbers.push(`${num}${String(i).padStart(2, '0')}`);
        } else if (pinType === 'หลักสิบ') {
          for (let i = 0; i <= 9; i++) {
            for (let j = 0; j <= 9; j++) generatedNumbers.push(`${i}${num}${j}`);
          }
        } else if (pinType === 'หลักหน่วย') {
          for (let i = 0; i <= 99; i++) generatedNumbers.push(`${String(i).padStart(2, '0')}${num}`);
        }
      }
    });

    const currentTotal = selectedBets.reduce((sum, bet) => sum + bet.amount, 0);
    const totalAmount = generatedNumbers.length * betAmount * activeBetTypes.length;
    if (userData && userData.balance < (currentTotal + totalAmount)) {
      alert(`ยอดเงินคงเหลือไม่เพียงพอ (ต้องการ ฿${currentTotal + totalAmount})`);
      return;
    }

    const newBets: BetItem[] = [];
    let hasBlocked = false;

    generatedNumbers.forEach(num => {
      activeBetTypes.forEach(type => {
        const blockInfo = blockedNumbers.find(b => 
          b.number === num && (b.betType === 'ทุกประเภท' || b.betType === type)
        );

        const medianRate = lotteryConfig?.medianRates?.[type] || 0;
        let payoutRate = lotteryConfig?.rates?.[type] || DEFAULT_RATES[type] || 0;
        let isSpecial = false;
        let isReduced = false;

        if (blockInfo) {
          if (blockInfo.restrictionType === 'blocked' || !blockInfo.restrictionType) {
            hasBlocked = true;
            return; // Skip blocked numbers
          } else if (blockInfo.restrictionType === 'reduced') {
            payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
          } else if (blockInfo.restrictionType === 'special') {
            payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
          }
        }

        if (payoutRate < medianRate) isReduced = true;
        if (payoutRate > medianRate) isSpecial = true;

        newBets.push({
          id: Math.random().toString(36).substr(2, 9),
          number: num,
          amount: betAmount,
          type: type,
          payoutRate,
          isSpecial,
          isReduced
        });
      });
    });

    if (hasBlocked) {
      alert('มีบางเลขถูกปิดรับ (อั้น) และถูกตัดออกอัตโนมัติ');
    }

    setSelectedBets(prev => [...newBets, ...prev]);
    setShowPinModal(false);
    setPinNumbers([]);
  };

  const handleViewDuplicates = () => {
    if (selectedBets.length === 0) {
      alert('ไม่มีรายการแทงในโพย');
      return;
    }

    const counts: Record<string, { count: number; totalAmount: number; isDuplicate: boolean }> = {};
    const dupKeys: string[] = [];

    selectedBets.forEach(bet => {
      const key = `${bet.type}_${bet.number}`;
      if (!counts[key]) {
        counts[key] = { count: 0, totalAmount: 0, isDuplicate: false };
      }
      counts[key].count += 1;
      counts[key].totalAmount += bet.amount;
      if (counts[key].count > 1) {
        counts[key].isDuplicate = true;
        if (!dupKeys.includes(key)) {
          dupKeys.push(key);
        }
      }
    });

    const duplicates = Object.entries(counts).filter(([_, info]) => info.isDuplicate);
    
    if (duplicates.length === 0) {
      alert('เยี่ยมมาก! ไม่มีเลขซ้ำในโพยนี้เลย');
      setDuplicateKeys([]);
    } else {
      setDuplicateKeys(dupKeys);
      const dupList = duplicates.map(([key, info]) => {
        const [type, num] = key.split('_');
        return `• ${type} - เลข ${num} (แทงซ้ำ ${info.count} ครั้ง ยอดรวม ฿${info.totalAmount})`;
      }).join('\n');
      alert(`พบรายการแทงซ้ำในโพย ดังนี้:\n\n${dupList}\n\n*ระบบได้สลับไปขึ้นสีเเดงให้ทราบเลขซ้ำเเล้ว\n*กด "ตัดเลขซ้ำ" เพื่อรวมยอดและลบรายการที่ซ้ำกันทันที`);
    }
  };

  const handleRemoveDuplicates = () => {
    if (selectedBets.length === 0) {
      alert('กรุณาเลือกรายการแทงก่อน');
      return;
    }

    const mergedBetsMap = new Map<string, BetItem>();
    selectedBets.forEach(bet => {
      const key = `${bet.type}_${bet.number}`;
      if (mergedBetsMap.has(key)) {
        const existing = mergedBetsMap.get(key)!;
        existing.amount += bet.amount;
      } else {
        mergedBetsMap.set(key, { ...bet });
      }
    });

    const originalCount = selectedBets.length;
    const newCount = mergedBetsMap.size;
    const removedCount = originalCount - newCount;

    if (removedCount > 0) {
      setShowDupConfirm(removedCount);
    } else {
      alert('ไม่มีรายการเลขซ้ำในโพยนี้');
    }
  };

  const executeRemoveDuplicates = () => {
    const mergedBetsMap = new Map<string, BetItem>();
    selectedBets.forEach(bet => {
      const key = `${bet.type}_${bet.number}`;
      if (mergedBetsMap.has(key)) {
        const existing = mergedBetsMap.get(key)!;
        existing.amount += bet.amount;
      } else {
        mergedBetsMap.set(key, { ...bet });
      }
    });

    setSelectedBets(Array.from(mergedBetsMap.values()));
    setShowDupConfirm(null);
    setDuplicateKeys([]); // Clear highlights
  };

  // ★ ตรวจสอบโพยรอบสุดท้ายก่อนบันทึก (กันกรณีแอดมินเปลี่ยนเลขอั้น/ราคาระหว่างที่ลูกค้ากำลังกรอก)
  //   - เลขปิด (blocked)      → ตัดออก (ถามยืนยันก่อน)
  //   - เลขลดราคา (reduced)   → ใช้อัตราจ่ายล่าสุด
  //   - ซื้อได้สูงสุด (maxAmount) ต่อเลข → เกินแล้วไม่ให้ส่ง
  //   - แทงขั้นต่ำ / สูงสุดต่อรายการ / สูงสุดต่อโพย(ไม้)
  // อัปเดตชื่อลูกค้า / ชื่อบิล
  const handleUpdateCustomerName = async (ticketId: string, newName: string) => {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        customerName: newName,
      });
      setActiveTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, customerName: newName } : t))
      );
      if (selectedTicketForBill && selectedTicketForBill.id === ticketId) {
        setSelectedTicketForBill({ ...selectedTicketForBill, customerName: newName });
      }
    } catch (e) {
      console.error('Failed to update customer name:', e);
      throw e;
    }
  };

  const validateAndNormalizeBets = (bets: BetItem[]): { ok: boolean; bets: BetItem[]; total: number } => {
    const minBet = Number(lotteryConfig?.minBet ?? globalSettings?.minBet) || 0;
    const maxPerBet = Number(lotteryConfig?.maxBet ?? globalSettings?.maxBet) || 0;
    const maxPerTicket = Number(lotteryConfig?.maxPerTicket ?? globalSettings?.maxBetPerUser) || 0;
    const errors: string[] = [];
    const removed: string[] = [];
    const out: BetItem[] = [];

    for (const bet of bets) {
      const info = blockedNumbers.find(b =>
        b.number === bet.number && (b.betType === 'ทุกประเภท' || b.betType === bet.type)
      );
      if (info && (info.restrictionType === 'blocked' || !info.restrictionType)) {
        removed.push(`${bet.type} ${bet.number}`);
        continue;
      }
      let payoutRate = Number(bet.payoutRate) || (isYeekee ? (ykConfig?.rates?.[bet.type] ?? YK.DEFAULT_RATES[bet.type]) : null) || Number(lotteryConfig?.rates?.[bet.type]) || DEFAULT_RATES[bet.type] || 0;
      if (info && (info.restrictionType === 'reduced' || info.restrictionType === 'special')) {
        const r = Number(info.customPayoutRate ?? info.payoutRate);
        if (r > 0) payoutRate = r;
      }
      const maxAmt = Number(info?.maxAmount) || 0;
      if (minBet && bet.amount < minBet) errors.push(`${bet.type} ${bet.number}: ขั้นต่ำ ${minBet} บาท`);
      if (maxPerBet && bet.amount > maxPerBet) errors.push(`${bet.type} ${bet.number}: สูงสุด ${maxPerBet} บาท`);
      if (maxAmt && bet.amount > maxAmt) errors.push(`${bet.type} ${bet.number}: เลขนี้ซื้อได้สูงสุด ${maxAmt} บาท`);
      const median = Number(lotteryConfig?.medianRates?.[bet.type]) || 0;
      out.push({
        ...bet,
        payoutRate,
        isReduced: median ? payoutRate < median : bet.isReduced,
        isSpecial: median ? payoutRate > median : bet.isSpecial,
      });
    }

    const total = out.reduce((sum, b) => sum + b.amount, 0);
    if (maxPerTicket && total > maxPerTicket) errors.push(`ยอดรวมต่อโพย ฿${total.toLocaleString()} เกินสูงสุด ฿${maxPerTicket.toLocaleString()}`);

    if (errors.length > 0) {
      alert('ไม่สามารถส่งโพยได้:\n- ' + errors.slice(0, 15).join('\n- ') + (errors.length > 15 ? `\n...และอีก ${errors.length - 15} รายการ` : ''));
      return { ok: false, bets: out, total };
    }
    if (out.length === 0) {
      alert('ทุกเลขในโพยนี้ปิดรับแทงแล้ว');
      return { ok: false, bets: out, total };
    }
    if (removed.length > 0 && !window.confirm(`เลขต่อไปนี้ปิดรับแทง และจะถูกตัดออกจากโพย:\n${removed.join(', ')}\n\nยอดใหม่ ฿${total.toLocaleString()} — ต้องการส่งต่อหรือไม่?`)) {
      return { ok: false, bets: out, total };
    }
    return { ok: true, bets: out, total };
  };

  const submitTicket = async () => {
    if (selectedBets.length === 0) {
      alert('กรุณาเลือกรายการแทงอย่างน้อย 1 รายการ');
      return;
    }

    if (isClosed) {
      alert('ขออภัย ปิดรับแทงแล้ว');
      return;
    }

    const total = selectedBets.reduce((sum, bet) => sum + bet.amount, 0);

    // Initial basic client check before full fetch
    if (userData && (userData.balance || 0) < total) {
      alert('ยอดเงินคงเหลือไม่เพียงพอ กรุณาเติมเงิน');
      return;
    }

    const ticketId = `TKT-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;
    const now = Date.now();
    const info = {
      ticketId,
      total,
      bets: [...selectedBets],
      date: now,
      customerName: customerName.trim() || 'ลูกค้าทั่วไป'
    };
    await executeSubmitTicket(info);
  };

  const submitDirectBets = async (betsToSubmit: BetItem[]) => {
    if (betsToSubmit.length === 0) return;
    if (globalSettings.systemOpen === false) {
      alert(globalSettings.maintenanceMessage || 'ขออภัย ระบบกำลังปิดปรับปรุงชั่วคราว');
      return;
    }
    if (globalSettings.bettingOpen === false) {
      alert('ขออภัย ระบบรับแทงหวยปิดให้บริการชั่วคราว');
      return;
    }
    if (isClosed) {
      alert('ขออภัย ปิดรับแทงแล้ว');
      return;
    }

    const checked = validateAndNormalizeBets(betsToSubmit);
    if (!checked.ok) return;
    betsToSubmit = checked.bets;

    const total = betsToSubmit.reduce((sum, bet) => sum + bet.amount, 0);

    try {
      const ticketId = `TKT-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;
      const now = Date.now();
      const expires = now + (180 * 1000); // 180 seconds

      const newTicket: ActiveTicket = {
        id: ticketId,
        bets: betsToSubmit,
        totalAmount: total,
        createdAt: now,
        expiresAt: expires,
        customerName: customerName.trim() || 'ลูกค้าทั่วไป',
        lotteryType: displayName,
      };

      const currentUserId = localStorage.getItem('userId');
      if (!currentUserId || localStorage.getItem('isLoggedIn') !== 'true') {
        alert('กรุณาเข้าสู่ระบบก่อนทำการแทงหวย');
        navigate('/login');
        return;
      }

      // Save to Firestore
      await addDoc(collection(db, 'tickets'), {
        ticketId,
        bets: betsToSubmit,
        totalAmount: total,
        status: isYeekee ? 'pending' : 'pending_cancellation',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(expires).toISOString(),
        userId: currentUserId,
        lotteryType: displayName,
        lotterySlug: isYeekee ? 'yeekee' : (type || 'thai'),
        roundId: isYeekee ? YK.ticketRoundId(YK.roundKey(ykGameDay, yeekeeRoundNum)) : undefined,
        customerName: customerName.trim() || 'ลูกค้าทั่วไป'
      });

      setActiveTickets(prev => [newTicket, ...prev]);
      
      // Show subtle success toast
      setShowSuccessToast(true);

    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการส่งโพย');
    }
  };

  const executeSubmitTicket = async (directTicketInfo?: any) => {
    let info = directTicketInfo || confirmTicketInfo;
    if(!info) return;
    const checked = validateAndNormalizeBets(info.bets || []);
    if (!checked.ok) return;
    info = { ...info, bets: checked.bets, total: checked.total };
    if (globalSettings.systemOpen === false) {
      alert(globalSettings.maintenanceMessage || 'ขออภัย ระบบกำลังปิดปรับปรุงชั่วคราว');
      return;
    }
    if (globalSettings.bettingOpen === false) {
      alert('ขออภัย ระบบรับแทงหวยปิดให้บริการชั่วคราว');
      return;
    }
    setIsSubmitting(true);
    try {
      const total = info.total;
      const currentUserId = localStorage.getItem('userId');
      if (!currentUserId || localStorage.getItem('isLoggedIn') !== 'true') {
        alert('กรุณาเข้าสู่ระบบก่อนทำการส่งโพยแทงหวย');
        navigate('/login');
        setIsSubmitting(false);
        return;
      }

      // 1. Check Balance
      const userRef = doc(db, 'users', currentUserId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        alert('ไม่พบข้อมูลบัญชีผู้ใช้งาน กรุณาเข้าสู่ระบบใหม่');
        navigate('/login');
        setIsSubmitting(false);
        return;
      }
      
      const currentBalance = userSnap.data().balance || 0;
      if (currentBalance < total) {
        alert(`ยอดเงินคงเหลือไม่เพียงพอ (มี ฿${currentBalance.toLocaleString()} / ต้องใช้ ฿${total.toLocaleString()}) กรุณาเติมเงินก่อนส่งโพย`);
        setIsSubmitting(false);
        return;
      }

      // 2. Deduct Balance
      await updateDoc(userRef, {
        balance: currentBalance - total
      });
      
      // 3. Record Transaction
      await addDoc(collection(db, 'transactions'), {
        userId: currentUserId,
        type: 'bet',
        amount: total,
        description: `แทงหวย ${displayName}`,
        createdAt: new Date().toISOString()
      });
      
      const ticketId = info.ticketId;
      const now = info.date;
      const expires = now + (180 * 1000); // 180 seconds

      const newTicket: ActiveTicket = {
        id: ticketId,
        bets: info.bets,
        totalAmount: total,
        createdAt: now,
        expiresAt: expires,
        customerName: info.customerName,
        lotteryType: displayName,
      };

      // 3. Save to Firestore
      await addDoc(collection(db, 'tickets'), {
        ticketId,
        bets: info.bets,
        totalAmount: total,
        status: isYeekee ? 'pending' : 'pending_cancellation',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(expires).toISOString(),
        userId: currentUserId,
        lotteryType: displayName,
        lotterySlug: isYeekee ? 'yeekee' : (type || 'thai'),
        roundId: isYeekee ? YK.ticketRoundId(YK.roundKey(ykGameDay, yeekeeRoundNum)) : undefined,
        customerName: info.customerName
      });

      setActiveTickets(prev => [newTicket, ...prev]);
      
      // Show receipt first, then clear form
      setShowSuccessReceipt({
        ticketId: ticketId,
        total: total,
        date: now,
        customerName: info.customerName,
        displayName: displayName,
        bets: info.bets
      });
      
      setConfirmTicketInfo(null);
      setSelectedBets([]);
      setCustomerName('');

    } catch (error: any) {
      console.error('Error saving ticket:', error);
      alert(`เกิดข้อผิดพลาดในการส่งโพย: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelTicket = async (ticketId: string, amount: number) => {
    if (window.confirm('คุณต้องการยกเลิกโพยนี้ใช่หรือไม่? ยอดเงินจะถูกคืนเข้าบัญชี')) {
      try {
        const currentUserId = localStorage.getItem('userId');
        if (!currentUserId) return;

        // 1. Refund Balance
        const userRef = doc(db, 'users', currentUserId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await updateDoc(userRef, {
            balance: (userSnap.data().balance || 0) + amount
          });
          
          // Record Refund Transaction
          await addDoc(collection(db, 'transactions'), {
            userId: currentUserId,
            type: 'refund',
            amount: amount,
            description: `คืนเงินยกเลิกโพย ${ticketId}`,
            createdAt: new Date().toISOString()
          });
        }

        // For simplicity in this demo, we'll update local state
        setActiveTickets(prev => prev.map(t => 
          t.id === ticketId ? { ...t, status: 'cancelled' } : t
        ));
        
        // Find and update the ticket in Firestore
        const q = query(collection(db, 'tickets'), where('ticketId', '==', ticketId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(doc(db, 'tickets', snap.docs[0].id), {
            status: 'cancelled'
          });
        }

        alert('ยกเลิกโพยสำเร็จ คืนเงินเข้ากระเป๋าเรียบร้อย');
      } catch (error) {
        console.error('Error cancelling ticket:', error);
        alert('เกิดข้อผิดพลาดในการยกเลิกโพย');
      }
    }
  };

  const handlePanelConfirm = () => {
    if (selectedPanelNumbers.length === 0) {
      alert('กรุณาเลือกตัวเลขอย่างน้อย 1 ตัว');
      return;
    }

    const targetTypes = activeBetTypes.filter(t => t.includes('2 ตัว'));
    if (targetTypes.length === 0) {
      alert('กรุณาเลือกประเภท 2 ตัว (เช่น 2 ตัวบน หรือ 2 ตัวล่าง) เพื่อแทงจากแผง');
      return;
    }

    const newBets: BetItem[] = [];
    let hasBlocked = false;

    selectedPanelNumbers.forEach(num => {
      targetTypes.forEach(type => {
        const blockInfo = blockedNumbers.find(b => 
          b.number === num && (b.betType === 'ทุกประเภท' || b.betType === type)
        );

        let payoutRate = lotteryConfig?.rates?.[type] || DEFAULT_RATES[type] || 0;
        let isSpecial = false;
        let isReduced = false;

        if (blockInfo) {
          if (blockInfo.restrictionType === 'blocked' || !blockInfo.restrictionType) {
            hasBlocked = true;
            return;
          } else {
            payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
            if (blockInfo.restrictionType === 'reduced') isReduced = true;
            else if (blockInfo.restrictionType === 'special') isSpecial = true;
          }
        }

        newBets.push({
          id: Math.random().toString(36).substr(2, 9) + num + type,
          number: num,
          amount: betAmount || 5, // Default to 5 if 0
          type: type,
          payoutRate,
          isSpecial,
          isReduced
        });
      });
    });

    if (hasBlocked) alert('มีบางเลขถูกปิดรับ (อั้น) และถูกตัดออกอัตโนมัติ');
    if (newBets.length > 0) {
      setSelectedBets(prev => [...newBets, ...prev]);
    }
    setShowPanelModal(false);
    setSelectedPanelNumbers([]);
  };

  const totalAmount = selectedBets.reduce((sum, bet) => sum + bet.amount, 0);

  /* ==================================================================
   * ★ สรุปการนับตัวเลขที่รอการแทง ★
   * ------------------------------------------------------------------
   * ใช้ countBets() จาก shared/lib/betCount — ตรรกะเดียวกับการ์ดอื่น
   * ผู้ใช้เห็นทันทีว่า: กี่ตัวรวม / กี่ตัวแยกตามประเภท / เลขซ้ำไหม
   * ================================================================== */
  const betSummary = useMemo(
    () => countBets(selectedBets.map(b => ({
      number: b.number, type: b.type, amount: b.amount,
      payoutRate: b.payoutRate, isSpecial: b.isSpecial, isReduced: b.isReduced,
    }))),
    [selectedBets],
  );

  return (
    <>
      {isClosed && (
        <div className="bg-red-500 text-white p-3 text-center font-black text-sm animate-pulse sticky top-0 z-[100]">
          ขณะนี้ปิดรับแทงแล้ว ไม่สามารถส่งโพยได้
        </div>
      )}

      <main className={`p-2 space-y-4 mx-auto mt-2 lg:grid lg:gap-6 lg:space-y-0 ${
        isPC
          ? 'max-w-[1600px] lg:grid-cols-[1fr_520px]'
          : 'max-w-[900px] lg:grid-cols-[1fr_400px]'
      }`}>
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white border border-[var(--grey-border)] p-2">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-700 text-sm">chevron_left</span>
              <span className="text-sm font-bold text-gray-800">หน้าแทงหวย</span>
            </button>
            <button 
              onClick={() => navigate(`/lottery/${type}/rules`)}
              className="bg-[#107c10] text-white font-bold text-xs px-3 py-1 rounded-sm"
            >
              กติกา & วิธีเล่น
            </button>
          </div>

          <div className="flex flex-col bg-white border border-[var(--grey-border)] p-3 shadow-sm rounded-t-lg">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <div className={`relative w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-full flex overflow-hidden shadow-sm items-center justify-center bg-white ${
                  isThaiLottery ? 'border-2 border-dashed border-red-500 ring-2 ring-red-500/20' : 'border border-gray-200'
                }`}>
                  {isThaiLottery && (
                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-red-500 animate-[spin_4s_linear_infinite]" />
                  )}
                  <img src={getLotteryIcon(type)} alt="logo" className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-black text-[16px] sm:text-lg md:text-xl lg:text-2xl text-black tracking-tighter truncate">{displayName}</span>
                  {isThaiLottery && (
                    <span className="bg-gradient-to-r from-red-600 to-amber-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow animate-pulse shrink-0">
                      ⭐ หวยเด่น
                    </span>
                  )}
                </div>
              </div>
              {isYeekee ? (
                <div className="bg-slate-900 border border-amber-400/50 text-[11px] sm:text-[12px] md:text-[13px] px-2.5 py-1 md:py-1.5 text-amber-300 flex items-center gap-1.5 rounded-[4px] font-bold shrink-0">
                  {ykPhase === 'open' && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-[10px] text-emerald-300">เปิดรับ:</span>
                      <span className="font-mono font-black text-amber-300">{YK.hhmmss(Math.max(0, ykCloseMs - currentTime))}</span>
                    </div>
                  )}
                  {ykPhase === 'processing' && (
                    <div className="flex items-center gap-1.5 text-amber-300 animate-pulse">
                      <span className="material-symbols-outlined text-xs animate-spin">autorenew</span>
                      <span className="text-[10px]">รอผล ({Math.max(1, ykResultWaitSec)}วิ)</span>
                    </div>
                  )}
                  {ykPhase === 'settled' && (
                    <div className="flex items-center gap-1 text-emerald-300">
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      <span className="text-[10px]">ออกผลแล้ว</span>
                    </div>
                  )}
                  {ykPhase === 'cancelled' && (
                    <div className="flex items-center gap-1 text-red-400">
                      <span className="material-symbols-outlined text-xs">cancel</span>
                      <span className="text-[10px]">ยกเลิก</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`px-2.5 py-1 md:py-1.5 md:px-3 text-xs flex items-center gap-1.5 rounded-[4px] font-bold shrink-0 border ${
                  isClosed
                    ? 'bg-red-950/80 border-red-500/60 text-red-300'
                    : 'bg-slate-900 border-slate-700 text-emerald-400'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isClosed ? 'bg-red-500' : 'bg-emerald-400 animate-ping'}`} />
                  <span className="text-[10px] text-slate-400">สถานะ:</span>
                  <span className="font-black">
                    {isClosed
                      ? 'ปิดรับแทงแล้ว'
                      : remainingCloseSec !== null && remainingCloseSec > 0
                      ? `เหลือ ${formatTime(remainingCloseSec)} (${formatClosingDisplay(lotteryConfig?.closingTime || lotteryConfig?.close_time)})`
                      : formatClosingDisplay(lotteryConfig?.closingTime || lotteryConfig?.close_time) || 'เปิดรับแทง'}
                  </span>
                </div>
              )}
            </div>

            {/* ★ แถบข้อมูลรอบ + แถบยิงเลข (มุมขวาบน / รวมฟังก์ชัน ดับเบิ้ลคลิกเพื่อขยาย) ★ */}
            {isYeekee && (
              <div className="mb-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-3 border-2 border-amber-400 shadow-md">
                {/* Round info + Link */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-xs font-black">
                      ยี่กี รอบที่ {yeekeeRoundNum} / {YK.ROUNDS_PER_DAY}
                    </span>
                    <span className="text-xs text-amber-200">
                      🕒 {YK.hhmm(ykOpenMs)} - {YK.hhmm(ykCloseMs)} น.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/lottery/yeekee"
                      className="text-xs text-amber-300 hover:text-white underline font-bold"
                    >
                      📋 ดูตาราง 88 รอบ
                    </Link>
                  </div>
                </div>

                {/* Settle results banner */}
                {ykPhase === 'settled' && ykRoundRow?.result && (
                  <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 p-2.5 rounded-lg mb-2 shadow flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black">🎉 ผลรางวัลรอบ {yeekeeRoundNum}:</span>
                      <span className="font-mono text-base sm:text-lg font-black tracking-widest bg-slate-950 text-amber-300 px-2.5 py-0.5 rounded shadow">
                        {ykRoundRow.result.number}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 text-xs font-bold">
                      <span>3 ตัวบน: <b className="text-red-700">{ykRoundRow.result.top3}</b></span>
                      <span>2 ตัวบน: <b className="text-purple-700">{ykRoundRow.result.top2}</b></span>
                      <span>2 ตัวล่าง: <b className="text-blue-700">{ykRoundRow.result.bottom2}</b></span>
                    </div>
                  </div>
                )}

                {/* Cancelled notice banner */}
                {ykPhase === 'cancelled' && (
                  <div className="bg-red-500/20 border border-red-500 text-red-200 p-2 rounded-lg mb-2 text-xs font-bold flex items-center justify-between">
                    <span>⚠️ รอบนี้ถูกยกเลิก — ระบบได้คืนเงินให้สมาชิกทุกโพยเรียบร้อยแล้ว 100%</span>
                    {yeekeeRoundNum < YK.ROUNDS_PER_DAY && (
                      <Link
                        to={`/lottery/yeekee-${yeekeeRoundNum + 1}`}
                        className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded text-xs font-black shadow"
                      >
                        ไปรอบที่ {yeekeeRoundNum + 1} ➡️
                      </Link>
                    )}
                  </div>
                )}

                {/* Shooter Bar Widget (Double-click to expand modal) */}
                <div
                  onDoubleClick={() => setShowShooterModal(true)}
                  className="bg-slate-950/80 border border-amber-400/40 rounded-lg p-2.5 flex flex-col md:flex-row items-center justify-between gap-3 cursor-pointer hover:border-amber-400 transition"
                  title="ดับเบิ้ลคลิกเพื่อเปิดดูประวัติและผลการยิงทั้งหมด"
                >
                  {/* Shoot Input Field */}
                  <div className="flex items-center gap-1.5 w-full md:w-auto" onClick={e => e.stopPropagation()}>
                    <span className="text-xs text-amber-300 font-bold whitespace-nowrap">🎯 ยิงเลข 5 หลัก:</span>
                    <input
                      type="text"
                      maxLength={5}
                      value={ykShootInput}
                      onChange={e => setYkShootInput(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={e => { if (e.key === 'Enter') handleShootNumber(); }}
                      placeholder={cooldownRemainingSec > 0 ? `รอ ${Math.floor(cooldownRemainingSec / 60)}:${String(cooldownRemainingSec % 60).padStart(2, '0')}` : "กรอก 5 หลัก"}
                      disabled={ykPhase !== 'open' || ykShooting || cooldownRemainingSec > 0}
                      className="w-28 bg-slate-900 border border-amber-400/60 rounded px-2 py-1 text-center font-mono font-bold text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
                    />
                    <button
                      onClick={handleShootNumber}
                      disabled={ykPhase !== 'open' || ykShooting || ykShootInput.length !== 5 || cooldownRemainingSec > 0}
                      className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-105 disabled:opacity-40 text-slate-950 text-xs font-black px-3 py-1.5 rounded transition shadow shrink-0 active:scale-95"
                    >
                      {ykShooting ? 'ยิง...' : cooldownRemainingSec > 0 ? `⏳ รอ ${Math.floor(cooldownRemainingSec / 60)}:${String(cooldownRemainingSec % 60).padStart(2, '0')} น.` : 'ยิงเลข 🎯'}
                    </button>
                  </div>

                  {/* Ribbon Stats */}
                  <div className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto justify-end">
                    <span className="text-slate-300">
                      ยิงแล้ว: <b className="text-amber-400 font-mono text-sm">{ykShoots.length}</b> คน
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-300">
                      ผลรวม: <b className="text-amber-300 font-mono">{ykShootsSum.toLocaleString()}</b>
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-300">
                      6 หลักหวย: <b className="text-yellow-300 font-mono tracking-wider">{ykLottery6}</b>
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="text-amber-300 font-bold" title="อันดับ 1 รับ ฿200">
                      🥇 #1: <b className="text-white">{ykShooter1?.username || '-'}</b>
                    </span>
                    {ykShoots.length >= 18 && (
                      <span className="text-emerald-300 font-bold" title="อันดับ 18 รับ ฿400">
                        🎯 #18: <b className="text-white">{ykShooter18?.username || '-'}</b>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowShooterModal(true)}
                      className="ml-1 bg-white/10 hover:bg-white/20 text-amber-300 border border-amber-400/40 rounded px-2 py-0.5 text-[11px] font-bold"
                    >
                      🔍 ดับเบิ้ลคลิกดูตารางยิง
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 text-right mt-1">
                  💡 ยิงเลขได้ทุกๆ 3 นาที | ดับเบิ้ลคลิกแถบยิงเลขเพื่อขยายดูตารางยิงจริง (อันดับ 1 รับ ฿200 / อันดับ 18 รับ ฿400)
                </div>
              </div>
            )}

            {/* Waiting for result banner when processing */}
            {isYeekee && ykPhase === 'processing' && (
              <div className="my-2 p-3 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-2 border-amber-400 rounded-xl text-center shadow-lg text-white">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-2xl text-amber-400 animate-spin">
                    progress_activity
                  </span>
                  <span className="text-sm font-black text-amber-300">
                    กำลังประมวลผล / รอผล (1-2 นาที)...
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  รอบที่ {yeekeeRoundNum} ปิดรับแทงแล้ว ระบบกำลังรวบรวมตัวเลขยิงและออกผลรางวัลอัตโนมัติ
                </p>
                <div className="mt-1 text-xs font-mono text-amber-400 font-bold">
                  คาดว่าจะออกผลในอีกประมาณ {Math.max(1, ykResultWaitSec)} วินาที
                </div>
              </div>
            )}

            {isYeekee ? (
              <div className="space-y-1.5 mt-1">
                {/* Row 1: 3 Digits (Red) */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { key: '3 ตัวบน', rate: ykConfig.rates?.['3 ตัวบน'] || 850 },
                    { key: '3 ตัวโต๊ด', rate: ykConfig.rates?.['3 ตัวโต๊ด'] || 120 },
                    { key: '3 ตัวล่าง', rate: ykConfig.rates?.['3 ตัวล่าง'] || 450 },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => toggleBetType(t.key)}
                      className={`py-2 px-1 rounded-[6px] font-black transition-all duration-150 border-2 flex flex-col items-center justify-center leading-tight ${
                        activeBetTypes.includes(t.key)
                          ? 'bg-[#cc0000] text-white border-black border-dashed shadow-inner scale-[0.98] z-10'
                          : 'bg-[#cc0000] text-white border-transparent hover:bg-[#e60000] shadow-sm'
                      }`}
                    >
                      <span className="text-[14px]">{t.key}</span>
                      <span className="text-[10px] text-amber-200 font-normal">จ่าย {t.rate}</span>
                    </button>
                  ))}
                </div>

                {/* Row 2: 2 Digits (Purple) */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { key: '2 ตัวบน', rate: ykConfig.rates?.['2 ตัวบน'] || 92 },
                    { key: '2 ตัวล่าง', rate: ykConfig.rates?.['2 ตัวล่าง'] || 92 },
                    { key: '2 ตัวบนกลับ', rate: ykConfig.rates?.['2 ตัวบนกลับ'] || 92 },
                    { key: '2 ตัวล่างกลับ', rate: ykConfig.rates?.['2 ตัวล่างกลับ'] || 92 },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => toggleBetType(t.key)}
                      className={`py-2 px-1 rounded-[6px] font-black transition-all duration-150 border-2 flex flex-col items-center justify-center leading-tight ${
                        activeBetTypes.includes(t.key)
                          ? 'bg-[#6200ea] text-white border-black border-dashed shadow-inner scale-[0.98] z-10'
                          : 'bg-[#6200ea] text-white border-transparent hover:bg-[#7c4dff] shadow-sm'
                      }`}
                    >
                      <span className="text-[12px] sm:text-[13px]">{t.key}</span>
                      <span className="text-[9px] text-purple-200 font-normal">จ่าย {t.rate}</span>
                    </button>
                  ))}
                </div>

                {/* Row 3: Running & Tong (Blue / Gold) */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { key: 'วิ่งบน', rate: ykConfig.rates?.['วิ่งบน'] || 3.2 },
                    { key: 'วิ่งล่าง', rate: ykConfig.rates?.['วิ่งล่าง'] || 4.2 },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => toggleBetType(t.key)}
                      className={`py-2 px-1 rounded-[6px] font-black transition-all duration-150 border-2 flex flex-col items-center justify-center leading-tight ${
                        activeBetTypes.includes(t.key)
                          ? 'bg-[#007bff] text-white border-black border-dashed shadow-inner scale-[0.98] z-10'
                          : 'bg-[#007bff] text-white border-transparent hover:bg-[#0069d9] shadow-sm'
                      }`}
                    >
                      <span className="text-[14px]">{t.key}</span>
                      <span className="text-[10px] text-sky-200 font-normal">จ่าย {t.rate}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      const tong = ['000', '111', '222', '333', '444', '555', '666', '777', '888', '999'];
                      addSpecialBets(tong, ['3 ตัวบน']);
                    }}
                    className="py-2 px-1 rounded-[6px] font-black transition-all duration-150 border-2 flex flex-col items-center justify-center leading-tight bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 border-transparent hover:brightness-105 shadow-sm active:scale-95"
                  >
                    <span className="text-[13px]">ตอง (000-999)</span>
                    <span className="text-[10px] text-slate-800 font-normal">10 ตัวเลข</span>
                  </button>
                </div>

                {/* Row 4: 4 & 5 Digits (Orange/Gold) */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { key: '4 ตัวบน', rate: ykConfig.rates?.['4 ตัวบน'] || 5000 },
                    { key: '4 ตัวโต๊ด', rate: ykConfig.rates?.['4 ตัวโต๊ด'] || 200 },
                    { key: '5 ตัวตรง', rate: ykConfig.rates?.['5 ตัวตรง'] || 30000 },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => toggleBetType(t.key)}
                      className={`py-2 px-1 rounded-[6px] font-black transition-all duration-150 border-2 flex flex-col items-center justify-center leading-tight ${
                        activeBetTypes.includes(t.key)
                          ? 'bg-[#e65100] text-white border-black border-dashed shadow-inner scale-[0.98] z-10'
                          : 'bg-[#e65100] text-white border-transparent hover:bg-[#f57c00] shadow-sm'
                      }`}
                    >
                      <span className="text-[13px]">{t.key}</span>
                      <span className="text-[9px] text-amber-200 font-normal">จ่าย {t.rate.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 mt-1">
                {/* Row 1 - 3 Digits (Red) */}
                <div className="grid grid-cols-3 gap-1.5">
                  {['3 ตัวบน', '3 ตัวโต๊ด', '3 ตัวกลับ'].map(t => (
                    <button 
                      key={t}
                      onClick={() => toggleBetType(t)}
                      className={`text-[15px] py-3 rounded-[6px] font-black transition-all duration-150 border-2 flex items-center justify-center ${
                        activeBetTypes.includes(t) 
                          ? 'bg-[#cc0000] text-white border-black border-dashed shadow-inner scale-[0.98] z-10'
                          : 'bg-[#cc0000] text-white border-transparent hover:bg-[#e60000] shadow-sm'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Row 2 - 2 Digits (Purple) */}
                <div className="grid grid-cols-3 gap-1.5">
                  {['2 ตัวบน', '2 ตัวล่าง', '2 ตัวกลับ'].map(t => (
                    <button 
                      key={t}
                      onClick={() => toggleBetType(t)}
                      className={`text-[15px] py-3 rounded-[6px] font-black transition-all duration-150 border-2 flex items-center justify-center ${
                        activeBetTypes.includes(t) 
                          ? 'bg-[#6200ea] text-white border-black border-dashed shadow-inner scale-[0.98] z-10'
                          : 'bg-[#6200ea] text-white border-transparent hover:bg-[#7c4dff] shadow-sm'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Row 3 - Mixed */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button 
                    onClick={() => toggleBetType('2 ตัวโต๊ด')}
                    className={`text-[15px] py-3 rounded-[6px] font-black transition-all duration-150 border-2 flex items-center justify-center ${
                      activeBetTypes.includes('2 ตัวโต๊ด') 
                        ? 'bg-[#6200ea] text-white border-black border-dashed shadow-inner scale-[0.98] z-10'
                        : 'bg-[#6200ea] text-white border-transparent hover:bg-[#7c4dff] shadow-sm'
                    }`}
                  >
                    2 ตัวโต๊ด
                  </button>
                  <button 
                    disabled={!isThaiLottery}
                    onClick={() => toggleBetType('3 ตัวล่าง')}
                    className={`text-[15px] py-3 rounded-[6px] font-black transition-all duration-150 border-2 flex items-center justify-center ${
                      !isThaiLottery 
                        ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed opacity-80'
                        : activeBetTypes.includes('3 ตัวล่าง') 
                          ? 'bg-[#cc0000] text-white border-black border-dashed shadow-inner scale-[0.98] z-10'
                          : 'bg-[#cc0000] text-white border-transparent hover:bg-[#e60000] shadow-sm'
                    }`}
                  >
                    3 ตัวล่าง
                  </button>
                  <button 
                     onClick={() => {
                       const tong = ['000', '111', '222', '333', '444', '555', '666', '777', '888', '999'];
                       addSpecialBets(tong, ['3 ตัวบน']);
                     }}
                     className={`text-[15px] py-3 rounded-[6px] font-black transition-all duration-150 border-2 flex items-center justify-center bg-[#007bff] text-white border-transparent hover:bg-[#0069d9] shadow-sm active:scale-95`}
                  >
                     ตอง
                  </button>
                </div>

                {/* Row 4 - Blue + 4-5 Digit Red */}
                <div className="grid grid-cols-4 gap-1.5">
                  {['วิ่งบน', 'วิ่งล่าง', 'เลขปัก'].map(t => (
                    <button 
                      key={t}
                      onClick={() => toggleBetType(t)}
                      className={`text-[14px] py-3 rounded-[6px] font-black transition-all duration-150 border-2 flex items-center justify-center ${
                        activeBetTypes.includes(t) 
                          ? 'bg-[#007bff] text-white border-black border-dashed shadow-inner scale-[0.98] z-10'
                          : 'bg-[#007bff] text-white border-transparent hover:bg-[#0069d9] shadow-sm'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                  <button 
                    disabled={!isThaiLottery}
                    onClick={() => toggleBetType('4-5 ตัว')}
                    className={`text-[14px] py-3 rounded-[6px] font-black transition-all duration-150 border-2 flex items-center justify-center ${
                      !isThaiLottery
                        ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed opacity-80'
                        : activeBetTypes.some(t => t.includes('4') || t.includes('5')) 
                          ? 'bg-[#cc0000] text-white border-black border-dashed shadow-inner scale-[0.98] z-10'
                          : 'bg-[#cc0000] text-white border-transparent hover:bg-[#e60000] shadow-sm'
                    }`}
                  >
                    4-5 ตัว
                  </button>
                </div>
              </div>
            )}



            {/* Sub-options based on bet type */}
            {activeBetTypes.some(t => t.includes('2 ตัว')) && (
              <div className="mt-2 text-center">
                <div className="text-xs text-gray-700 mb-1">รายการเพิ่มเติม 2 ตัว</div>
                <div className="grid grid-cols-3 gap-1 mb-1">
                  <button 
                    onClick={() => toggleSpecialMode('รูดหน้า')}
                    className={`text-xs font-bold py-1.5 rounded transition ${specialModes.includes('รูดหน้า') ? 'bg-[#f57c00] text-white' : 'bg-[#e0e0e0] text-gray-800'}`}
                  >
                    รูดหน้า
                  </button>
                  <button 
                    onClick={() => toggleSpecialMode('รูดหลัง')}
                    className={`text-xs font-bold py-1.5 rounded transition ${specialModes.includes('รูดหลัง') ? 'bg-[#f57c00] text-white' : 'bg-[#e0e0e0] text-gray-800'}`}
                  >
                    รูดหลัง
                  </button>
                  <button 
                    onClick={() => {
                      const doubles = [];
                      for (let i = 0; i <= 9; i++) doubles.push(i.toString() + i.toString());
                      addSpecialBets(doubles);
                    }}
                    className="text-xs font-bold py-1.5 bg-[#e0e0e0] text-gray-800 rounded hover:bg-gray-300 transition"
                  >
                    เลขเบิ้ล
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1 mb-1">
                  <button 
                    onClick={() => {
                      const low = [];
                      for (let i = 0; i <= 49; i++) low.push(i.toString().padStart(2, '0'));
                      addSpecialBets(low);
                    }}
                    className="text-xs font-bold py-1.5 bg-[#cccccc] text-gray-800 rounded hover:bg-gray-400 transition"
                  >
                    สองตัวต่ำ
                  </button>
                  <button 
                    onClick={() => {
                      const high = [];
                      for (let i = 50; i <= 99; i++) high.push(i.toString().padStart(2, '0'));
                      addSpecialBets(high);
                    }}
                    className="text-xs font-bold py-1.5 bg-[#cccccc] text-gray-800 rounded hover:bg-gray-400 transition"
                  >
                    สองตัวสูง
                  </button>
                  <button 
                    onClick={() => {
                      const evens = [];
                      for (let i = 0; i <= 99; i++) if (i % 2 === 0) evens.push(i.toString().padStart(2, '0'));
                      addSpecialBets(evens);
                    }}
                    className="text-xs font-bold py-1.5 bg-[#cccccc] text-gray-800 rounded hover:bg-gray-400 transition"
                  >
                    สองตัวคู่
                  </button>
                  <button 
                    onClick={() => {
                      const odds = [];
                      for (let i = 0; i <= 99; i++) if (i % 2 !== 0) odds.push(i.toString().padStart(2, '0'));
                      addSpecialBets(odds);
                    }}
                    className="text-xs font-bold py-1.5 bg-[#cccccc] text-gray-800 rounded hover:bg-gray-400 transition"
                  >
                    สองตัวคี่
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1 mb-1">
                  <button 
                    onClick={() => {
                      const siblings = ['01', '12', '23', '34', '45', '56', '67', '78', '89', '90'];
                      addSpecialBets(siblings);
                    }}
                    className="text-xs font-bold py-1.5 bg-[#b3b3b3] text-gray-800 rounded hover:bg-gray-400 transition"
                  >
                    พี่น้อง
                  </button>
                  <button 
                    onClick={() => {
                      const revSiblings = ['10', '21', '32', '43', '54', '65', '76', '87', '98', '09'];
                      addSpecialBets(revSiblings);
                    }}
                    className="text-xs font-bold py-1.5 bg-[#b3b3b3] text-gray-800 rounded hover:bg-gray-400 transition"
                  >
                    น้องพี่
                  </button>
                  <button 
                    onClick={() => {
                      const oddOdd = ['11', '13', '15', '17', '19', '31', '33', '35', '37', '39', '51', '53', '55', '57', '59', '71', '73', '75', '77', '79', '91', '93', '95', '97', '99'];
                      addSpecialBets(oddOdd);
                    }}
                    className="text-xs font-bold py-1.5 bg-[#b3b3b3] text-gray-800 rounded hover:bg-gray-400 transition"
                  >
                    เลขคี่คี่
                  </button>
                  <button 
                    onClick={() => {
                      const evenEven = ['00', '02', '04', '06', '08', '20', '22', '24', '26', '28', '40', '42', '44', '46', '48', '60', '62', '64', '66', '68', '80', '82', '84', '86', '88'];
                      addSpecialBets(evenEven);
                    }}
                    className="text-xs font-bold py-1.5 bg-[#b3b3b3] text-gray-800 rounded hover:bg-gray-400 transition"
                  >
                    เลขคู่คู่
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button 
                    onClick={() => {
                      const evenOdd = ['01', '03', '05', '07', '09', '21', '23', '25', '27', '29', '41', '43', '45', '47', '49', '61', '63', '65', '67', '69', '81', '83', '85', '87', '89'];
                      addSpecialBets(evenOdd);
                    }}
                    className="text-xs font-bold py-1.5 bg-[#6c757d] text-white rounded hover:bg-gray-700 transition"
                  >
                    เลขคู่คี่
                  </button>
                  <button 
                    onClick={() => {
                      const all = [];
                      for (let i = 0; i <= 99; i++) all.push(i.toString().padStart(2, '0'));
                      addSpecialBets(all);
                    }}
                    className="text-xs font-bold py-1.5 bg-[#6c757d] text-white rounded hover:bg-gray-700 transition"
                  >
                    เลข 00-99
                  </button>
                </div>
              </div>
            )}

            {activeBetTypes.includes('เลขปัก') && (
              <div className="mt-2 text-center bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                <div className="text-xs text-gray-700 mb-1 font-bold">รายการเพิ่มเติม เลขปัก</div>
                <div className="grid grid-cols-3 gap-1">
                  {['หลักร้อย', 'หลักสิบ', 'หลักหน่วย'].map(t => {
                    const isSelected = pinNumbers.includes(t);
                    return (
                      <button 
                        key={t}
                        onClick={() => {
                          setPinNumbers(prev => {
                            if (prev.includes(t)) {
                              return prev.filter(x => x !== t);
                            } else {
                              return [...prev, t];
                            }
                          });
                        }}
                        className={`text-xs font-bold py-2 rounded transition-all duration-150 border ${
                          isSelected 
                            ? 'bg-[#f5c518] text-[#0a192f] border-dashed border-[#0a192f] font-black' 
                            : 'bg-[#e0e0e0] text-gray-800 border-transparent hover:bg-gray-300'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeBetTypes.some(t => t.includes('3 ตัว')) && (
              <div className="mt-2 text-center bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                <div className="text-xs text-gray-700 mb-2 font-bold">รายการเพิ่มเติม 3 ตัว</div>
                <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                  {[
                    { label: '000-249', start: 0, end: 249 },
                    { label: '250-499', start: 250, end: 499 },
                    { label: '500-749', start: 500, end: 749 },
                    { label: '750-999', start: 750, end: 999 }
                  ].map(r => (
                    <button 
                      key={r.label}
                      onClick={() => {
                        const nums = [];
                        for (let i = r.start; i <= r.end; i++) nums.push(i.toString().padStart(3, '0'));
                        addSpecialBets(nums);
                      }}
                      className="text-[11px] font-black py-2.5 bg-[#f57c00] text-white rounded shadow-sm hover:brightness-110 active:scale-95 transition-all"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: '000-499', start: 0, end: 499 },
                    { label: '500-999', start: 500, end: 999 },
                    { label: '000-999', start: 0, end: 999 }
                  ].map(r => (
                    <button 
                      key={r.label}
                      onClick={() => {
                        const nums = [];
                        for (let i = r.start; i <= r.end; i++) nums.push(i.toString().padStart(3, '0'));
                        addSpecialBets(nums);
                      }}
                      className="text-[11px] font-black py-2.5 bg-[#6c757d] text-white rounded shadow-sm hover:brightness-110 active:scale-95 transition-all"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeBetTypes.some(t => t.includes('4') || t.includes('5')) && (
              <div className="mt-2 text-center">
                <div className="text-xs text-gray-700 mb-1">รายการเพิ่มเติม 4-5 ตัว</div>
                <div className="grid grid-cols-3 gap-1 mb-1">
                  <button 
                    onClick={() => toggleBetType('4 ตัวบน')}
                    className={`text-xs font-bold py-2 border transition ${activeBetTypes.includes('4 ตัวบน') ? 'bg-[#f57c00] text-white border-[#f57c00] ring-2 ring-offset-1 ring-black border-dashed' : 'bg-[#f57c00] text-white border-[#f57c00]'}`}
                  >
                    4 ตัวบน
                  </button>
                  <button 
                    onClick={() => toggleBetType('4 ตัวโต๊ด')}
                    className={`text-xs font-bold py-2 border transition ${activeBetTypes.includes('4 ตัวโต๊ด') ? 'bg-[#f57c00] text-white border-[#f57c00] ring-2 ring-offset-1 ring-black border-dashed' : 'bg-[#f57c00] text-white border-[#f57c00]'}`}
                  >
                    4 ตัวโต๊ด
                  </button>
                  <button 
                    onClick={() => toggleBetType('5 ตัวโต๊ด')}
                    className={`text-xs font-bold py-2 border transition ${activeBetTypes.includes('5 ตัวโต๊ด') ? 'bg-[#f57c00] text-white border-[#f57c00] ring-2 ring-offset-1 ring-black border-dashed' : 'bg-[#f57c00] text-white border-[#f57c00]'}`}
                  >
                    5 ตัวโต๊ด
                  </button>
                </div>
              </div>
            )}

            {activeBetTypes.length > 0 && (
              <div className="text-center mt-3 mb-2 font-bold flex flex-col items-center justify-center gap-1">
                <div className="flex flex-wrap justify-center items-center gap-1.5">
                  <span className="text-gray-700 text-[13px] font-black">รายการที่เลือก : </span>
                  {activeBetTypes.map(t => (
                    <span key={t} className="bg-green-600 text-white text-[12px] px-2.5 py-1 rounded-sm flex items-center gap-1.5 shadow-sm border border-green-700">
                      {t}
                    </span>
                  ))}
                  {activeBetTypes.includes('เลขปัก') && pinNumbers.map(pin => (
                    <span key={pin} className="bg-[#f5c518] text-[#0a192f] text-[12px] px-2.5 py-1 rounded-sm flex items-center gap-1.5 shadow-sm border border-[#d4af37] font-black animate-pulse">
                      {pin}
                    </span>
                  ))}
                  {specialModes.map(m => (
                    <span key={m} className="bg-green-600 text-white text-[12px] px-2.5 py-1 rounded-sm shadow-sm border border-green-700">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="text-center font-bold text-lg text-black mb-3">ระบุตัวเลข</div>
              <div className="flex justify-center gap-1.5 mb-4">
                {Array.from({ length: activeBetTypes.length === 0 ? 5 : (specialModes.some(m => ['รูดหน้า', 'รูดหลัง', '19ประตู'].includes(m)) || activeBetTypes.some(t => t.includes('วิ่ง') || t === 'เลขปัก' || t.startsWith('ปักหลัก')) ? 1 : activeBetTypes.some(t => t.includes('5 ตัว')) ? 5 : activeBetTypes.some(t => t.includes('4 ตัว')) ? 4 : activeBetTypes.some(t => t.includes('3 ตัว') || t === 'ตอง') ? 3 : 2) }).map((_, i) => (
                  <div key={i} className={`w-[50px] h-[55px] bg-white border border-gray-300 rounded flex items-center justify-center font-black text-2xl shadow-sm ${activeBetTypes.length === 0 ? 'text-gray-300' : 'text-gray-800'}`}>
                    {betNumber[i] || ''}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-1.5 px-1 pb-1">
                {['1', '2', '3'].map(num => (
                  <button key={num} onClick={() => handleNumberClick(num)} className={`bg-white border border-gray-300 text-black font-black rounded-sm active:bg-gray-100 transition-all shadow-sm ${isPC ? 'py-5 text-3xl' : 'py-3 text-xl'}`}>
                    {num}
                  </button>
                ))}
                
                {['4', '5', '6'].map(num => (
                  <button key={num} onClick={() => handleNumberClick(num)} className={`bg-white border border-gray-300 text-black font-black rounded-sm active:bg-gray-100 transition-all shadow-sm ${isPC ? 'py-5 text-3xl' : 'py-3 text-xl'}`}>
                    {num}
                  </button>
                ))}
                
                {['7', '8', '9'].map(num => (
                  <button key={num} onClick={() => handleNumberClick(num)} className={`bg-white border border-gray-300 text-black font-black rounded-sm active:bg-gray-100 transition-all shadow-sm ${isPC ? 'py-5 text-3xl' : 'py-3 text-xl'}`}>
                    {num}
                  </button>
                ))}
                
                <button 
                  type="button"
                  onClick={() => setBetNumber('')} 
                  className={`bg-[#6c757d] text-white font-bold rounded-sm active:bg-gray-600 transition-all shadow-sm border-b-2 border-gray-700 ${isPC ? 'py-5 text-2xl' : 'py-3 text-lg'}`}
                >
                  ล้าง
                </button>
                <button 
                  type="button"
                  onClick={() => handleNumberClick('0')} 
                  className={`bg-white border border-gray-300 text-black font-black rounded-sm active:bg-gray-100 transition-all shadow-sm ${isPC ? 'py-5 text-3xl' : 'py-3 text-xl'}`}
                >
                  0
                </button>
                <button 
                  type="button"
                  onClick={handleBackspace} 
                  className="bg-[#cc0000] border-b-2 border-red-900 text-white rounded-sm py-3 flex items-center justify-center active:bg-red-700 transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined font-black text-xl">backspace</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* Right Column - Cart and Forms */}
      <div className="flex flex-col bg-[#111111] border-[4px] border-[#8a0303] p-1.5 shadow-xl h-fit relative">

        {/* Blink Notification Overlay */}
        <AnimatePresence>
          {blinkAlert && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-green-500/20"
            >
              <div className="bg-green-600 text-white font-black text-xl px-6 py-3 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.6)] flex items-center gap-2">
                <span className="material-symbols-outlined">check_circle</span>
                เพิ่มรายการสำเร็จ
              </div>
            </motion.div>
          )}
        </AnimatePresence>

          {/* ==================================================================
            * ★ แผงนับจำนวนตัวที่รอการแทง — ตอบโจทย์ "กี่ตัวตามประเภท"
            * วางไว้บนสุดของการ์ด เพื่อให้เห็นทันทีโดยไม่ต้องเลื่อน
            * ================================================================== */}
          <BetSummaryPanel
            summary={betSummary}
            balance={userData?.balance}
            onTypeClick={(t) => {
              // คลิกที่ประเภท → เลื่อนไปยังกลุ่มนั้นในตะกร้า
              const el = document.getElementById(`cart-group-${t}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="mb-2"
          />

          {/* 1. Cart List */}
          <div className="bg-[#ccc] p-1 space-y-1 mb-2">
            {(Object.entries(
              selectedBets.reduce((acc, bet) => {
                if (!acc[bet.type]) acc[bet.type] = [];
                acc[bet.type].push(bet);
                return acc;
              }, {} as Record<string, BetItem[]>)
            ) as [string, BetItem[]][]).map(([type, bets]) => (
              <div key={type} id={`cart-group-${type}`} className="bg-white border rounded-sm shadow-sm pb-1 border-gray-400">
                {/* Group Header */}
                <div className="flex justify-between items-center px-2 py-1.5 border-b border-gray-400 bg-[#e0e0e0]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="font-bold text-black text-[13px] truncate">{type}</div>
                    {/* ★ ป้ายจำนวนตัวของประเภทนี้ */}
                    <span className="shrink-0 bg-[var(--navy-deep)] text-[var(--gold-vibrant)] text-[10px] font-black px-1.5 py-[1px] rounded-full tabular-nums">
                      {fmtInt(new Set(bets.map(b => b.number)).size)} ตัว
                    </span>
                    {(() => {
                      const dupCount = bets.length - new Set(bets.map(b => b.number)).size;
                      return dupCount > 0 ? (
                        <span className="shrink-0 bg-[#cc0000] text-white text-[9px] font-black px-1.5 py-[1px] rounded-full">
                          ซ้ำ {dupCount}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex gap-1.5 items-center shrink-0">
                    {[5, 10, 20, 50, 100].map(amt => (
                      <button 
                        key={amt}
                        onClick={() => bets.forEach(b => updateBetAmount(b.id, amt))}
                        className="bg-white border border-gray-500 text-black font-bold text-[10px] sm:text-[11px] px-1.5 py-[1px] rounded-[3px] shadow-sm min-w-[32px] hover:bg-gray-100"
                      >
                        {amt}฿
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Table Header */}
                <div className="grid grid-cols-[20px_1fr_60px_40px_65px_30px] sm:grid-cols-[25px_1fr_60px_45px_75px_30px] gap-1 text-black py-1 font-bold text-[10px] sm:text-[11px] px-1 border-b border-gray-400 bg-[#cccccc]">
                  <div className="text-center text-gray-800 shrink-0">##</div>
                  <div className="text-center flex justify-center items-center">
                    <span className="bg-[#555] text-white px-2 py-[2px] rounded-full text-[9px] sm:text-[10px] whitespace-nowrap">ตัวเลข</span>
                  </div>
                  <div className="text-center shrink-0">เงินแทง</div>
                  <div className="text-center shrink-0">จ่าย</div>
                  <div className="text-center shrink-0">ชนะ</div>
                  <div className="text-center text-[9px] shrink-0">ลบ</div>
                </div>
                
                {/* Rows */}
                <div className="w-full bg-white block">
                  {bets.map((bet, index) => {
                    const isDuplicate = duplicateKeys.includes(`${bet.type}_${bet.number}`);
                    return (
                      <div key={bet.id} className={`grid grid-cols-[20px_1fr_60px_40px_65px_30px] sm:grid-cols-[25px_1fr_60px_45px_75px_30px] gap-1 border-b border-gray-300 py-1.5 items-center px-1 transition-colors ${isDuplicate ? 'bg-red-50' : 'bg-white'}`}>
                        <div className={`text-center font-bold text-[10px] sm:text-[11px] shrink-0 ${isDuplicate ? 'text-red-600' : 'text-black'}`}>{index + 1}.</div>
                        <div className="text-center flex justify-center min-w-0">
                          <div className={`${isDuplicate ? 'bg-[#cc0000]' : 'bg-[#107c10]'} text-white font-bold py-[2px] px-1 sm:px-2 w-full max-w-[50px] text-[12px] sm:text-[13px] rounded-[3px] tracking-wider shadow-sm truncate`}>{bet.number}</div>
                        </div>
                        <div className="text-center shrink-0">
                          <input 
                            type="text" 
                            inputMode="numeric"
                            value={bet.amount === 0 ? '' : bet.amount}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              updateBetAmount(bet.id, val === '' ? 0 : parseInt(val));
                            }}
                            className={`w-full text-center font-black border rounded-sm py-[2px] outline-none text-[12px] sm:text-[13px] h-[30px] transition-all shadow-sm ${
                              isDuplicate 
                                ? 'border-red-500 bg-red-50 text-red-700 ring-1 ring-red-200' 
                                : 'border-gray-300 bg-white focus:border-[#107c10] focus:ring-1 focus:ring-[#107c10]/20 text-[var(--navy-deep)]'
                            }`}
                          />
                        </div>
                        <div className={`text-center font-black text-[10px] sm:text-[11px] text-red-600 shrink-0 truncate`}>
                          {bet.payoutRate ? bet.payoutRate.toFixed(2) : '0.00'}
                        </div>
                        <div className={`text-center font-black text-[10px] sm:text-[11px] text-red-600 shrink-0 truncate`}>
                          {(bet.amount * (bet.payoutRate || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </div>
                        <div className="text-center flex justify-center shrink-0">
                          <button onClick={() => removeBet(bet.id)} className="bg-[#cc0000] text-white w-6 sm:w-7 h-[24px] flex items-center justify-center rounded-[3px] hover:bg-red-800 transition shadow-sm border-b-2 border-red-900">
                            <span className="material-symbols-outlined text-[14px] sm:text-[15px]">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            
            {/* Removed empty state message as requested */}
            {selectedBets.length === 0 && (
              <div className="hidden"></div>
            )}

        </div>

        {/* 2. ดูเลขซ้ำ / ตัดเลขซ้ำ */}
        <div className="bg-[#1a1a1a] p-2 mb-2 flex gap-2 shadow-lg border border-gray-700">
          <button 
            onClick={handleViewDuplicates} 
            className="bg-[#107c10] flex-1 text-[var(--gold-vibrant)] py-2 font-black flex items-center justify-center gap-1.5 rounded shadow-[0_4px_0_rgb(13,77,13)] hover:brightness-110 active:translate-y-[2px] active:shadow-none transition-all text-xs uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span> ดูเลขที่ซ้ำ
          </button>
          <button 
            onClick={handleRemoveDuplicates} 
            className="bg-[#cc0000] flex-1 text-white py-2 font-black flex items-center justify-center gap-1.5 rounded shadow-[0_4px_0_rgb(130,0,0)] hover:brightness-110 active:translate-y-[2px] active:shadow-none transition-all text-xs uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-[18px]">content_cut</span> ตัดเลขที่ซ้ำ
          </button>
        </div>

        {/* 3. ใส่ราคาเท่ากันหมด */}
        <div className="bg-white px-2 py-3 mb-2 text-center shadow-sm flex flex-col justify-center items-center rounded-sm">
          <div className="text-[#107c10] font-bold text-[14px] mb-2 tracking-wide w-full border-b border-gray-200 pb-1">ใส่ราคาเท่ากันหมด</div>
          <div className="flex gap-1 items-stretch justify-center w-full mt-1 h-9">
            <input 
              type="number"
              value={betAmount === 0 ? '' : betAmount}
              onChange={(e) => {
                const newAmount = parseInt(e.target.value) || 0;
                setBetAmount(newAmount);
                updateAllAmounts(newAmount);
              }}
              className="w-20 text-center border-2 border-gray-400 bg-white outline-none font-black text-sm px-1 flex-shrink-0"
              placeholder="จำนวน"
            />
            <button 
              onClick={() => {
                const newAmount = betAmount + 1;
                setBetAmount(newAmount);
                updateAllAmounts(newAmount);
              }}
              className="bg-[#444] text-white w-9 flex-shrink-0 flex items-center justify-center font-bold active:bg-gray-700 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm font-bold">add</span>
            </button>
            <div className="flex flex-1 gap-1">
              {[5, 10, 20, 50, 100, 500].map(val => (
                <button 
                  key={val}
                  onClick={() => {
                    setBetAmount(val);
                    updateAllAmounts(val);
                  }}
                  className={`flex-1 text-[11px] font-black rounded-sm shadow-sm transition-all border ${betAmount === val ? 'bg-[#555] text-white border-black' : 'bg-gray-500 text-white border-gray-600 hover:bg-gray-600'}`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. เครดิต / ยอดรวม / ส่งโพย */}
        <div className="p-2 pt-4 text-sm flex flex-col gap-2 relative border-t-2 border-[#1a1a1a]">
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="bg-[#1e1e1e] text-white text-center py-2.5 px-2 border border-gray-700 rounded-md shadow flex flex-col justify-center items-center">
              <span className="text-gray-300 text-[11px] font-bold mb-1 tracking-tight">ยอดเครดิตคงเหลือ</span>
              <div 
                className="font-black text-xs sm:text-sm md:text-base text-amber-400 leading-tight max-w-full truncate px-1" 
                title={`฿ ${(userData?.balance ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
              >
                ฿ {(userData?.balance ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
            </div>
            <div className="bg-[#1e1e1e] text-white text-center py-2.5 px-2 border border-gray-700 rounded-md shadow flex flex-col justify-center items-center">
              <span className="text-gray-300 text-[11px] font-bold mb-1 tracking-tight">รวมยอดแทง</span>
              <div 
                className="font-black text-xs sm:text-sm md:text-base text-emerald-400 leading-tight max-w-full truncate px-1"
                title={`฿ ${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
              >
                ฿ {totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button 
              onClick={submitTicket}
              disabled={isClosed}
              className={`flex items-center justify-center gap-1.5 rounded-lg border-b-4 shadow-lg h-11 transition-all text-[13px] uppercase tracking-wide font-black ${
                isClosed
                  ? 'bg-gray-400 text-gray-700 border-gray-600 cursor-not-allowed opacity-75'
                  : 'bg-[#107c10] text-white hover:bg-green-700 border-green-800 active:translate-y-[2px] active:border-b-2 cursor-pointer'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{isClosed ? 'lock' : 'touch_app'}</span>
              <span>{isClosed ? 'ปิดรับแทงแล้ว' : 'ส่งโพย'}</span>
            </button>
            <button 
              onClick={clearAllBets}
              className="bg-[#cc0000] text-white font-black flex items-center justify-center gap-1.5 hover:bg-red-700 rounded-lg border-b-4 border-red-900 shadow-lg active:translate-y-[2px] active:border-b-2 h-11 transition-all text-[13px] uppercase tracking-wide"
            >
              <span className="material-symbols-outlined text-[20px]">delete_sweep</span> ยกเลิกทั้งหมด
            </button>
          </div>
        </div>

        {/* Active Tickets Section (Compact, Searchable, Filterable) */}
        <CompactTicketList
          tickets={activeTickets as any[]}
          currentTime={currentTime}
          onSelectTicketForBill={(t) => setSelectedTicketForBill(t as any)}
          onCopyTicketText={copyTicketAsBillText}
          onCancelTicket={cancelTicket}
          formatRemainingTime={formatRemainingTime}
        />

        <div className="border-[4px] border-[#8a0303] bg-[#111] mt-4 flex flex-col shadow-xl h-fit">
          <div className="bg-white p-2 flex items-center justify-between text-black border-b-2 border-red-800 rounded-sm">
             <div className="flex items-center gap-2">
                 <span className="material-symbols-outlined font-black text-xl">payments</span>
                 <span className="text-lg font-black tracking-wide">ราคาจ่าย</span>
             </div>
             <div className="bg-red-800 text-white text-[10px] px-2 py-1 rounded-sm font-bold shadow-sm whitespace-nowrap">หวยรัฐบาล</div>
          </div>
          <div className="bg-white p-1">
             <div className="grid grid-cols-12 bg-gray-200 text-black py-2 font-bold border-b border-gray-400 px-1 text-[11px]">
                 <div className="col-span-2 text-center">ลำดับ</div>
                 <div className="col-span-4 text-center">ชนิด</div>
                 <div className="col-span-3 text-center">จ่าย</div>
                 <div className="col-span-3 text-center">ลด</div>
             </div>
             
             <div className="bg-gray-100 pb-2">
               {(() => {
                 const defaultRates = [
                   { type: '2 ตัวบน', rate: 98.00 },
                   { type: '3 ตัวบน', rate: 980.00 },
                   { type: '3 ตัวโต๊ด', rate: 150.00 },
                   { type: '2 ตัวโต๊ด', rate: 13.00 },
                   { type: 'วิ่งบน', rate: 3.20 },
                   { type: 'วิ่งล่าง', rate: 4.20 },
                   { type: '2 ตัวล่าง', rate: 98.00 },
                   { type: '3 ตัวล่าง', rate: 150.00 },
                   { type: '4 ตัวบน', rate: 4000.00 },
                   { type: '4 ตัวโต๊ด', rate: 25.00 },
                   { type: '5 ตัวโต๊ด', rate: 15.00 },
                   { type: 'ปักหลักหน่วย', rate: 8.00 },
                   { type: 'ปักหลักสิบ', rate: 8.00 },
                   { type: 'ปักหลักร้อย', rate: 8.00 },
                 ];

                  const typesToShow = isYeekee
                    ? YK.BET_TYPES.map(t => ({ type: t.key, rate: ykConfig?.rates?.[t.key] || t.rate }))
                    : isThaiLottery 
                    ? defaultRates 
                    : defaultRates.filter(r => r.type !== '3 ตัวล่าง' && !r.type.startsWith('4 ตัว') && !r.type.startsWith('5 ตัว'));

                 return typesToShow.map((item, index) => {
                   const rate = (isYeekee ? (ykConfig?.rates?.[item.type] ?? item.rate) : null) || lotteryConfig?.rates?.[item.type] || item.rate;
                   return (
                     <div key={item.type} className={`grid grid-cols-12 border-b border-gray-300 py-1.5 px-1 ${index % 2 === 1 ? 'bg-gray-200' : 'bg-white'}`}>
                       <div className="col-span-2 text-center font-bold text-gray-600 text-[11px] flex items-center justify-center">{index + 1}.</div>
                       <div className="col-span-4 text-center font-bold text-[11px] flex items-center justify-center">{item.type}</div>
                       <div className="col-span-3 text-center font-black text-blue-700 text-[11px] flex items-center justify-center">{Number(rate).toFixed(2)}</div>
                       <div className="col-span-3 text-center font-bold text-red-600 text-[11px] flex items-center justify-center">0</div>
                     </div>
                   );
                 });
               })()}
             </div>
          </div>
        </div>
      </div>
      </main>
      {/* Pinning Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="bg-[var(--navy-deep)] p-3 flex justify-between items-center text-white">
              <h3 className="font-bold">เลขปักหลัก / เลขทิศ</h3>
              <button onClick={() => setShowPinModal(false)} className="material-symbols-outlined">close</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-bold text-[var(--navy-deep)] mb-2 block">เลือกหลักที่ต้องการปัก</label>
                <div className="grid grid-cols-3 gap-2">
                  {['หลักร้อย', 'หลักสิบ', 'หลักหน่วย'].map(t => (
                    <button 
                      key={t}
                      onClick={() => setPinType(t)}
                      className={`py-2 text-xs font-bold rounded border ${pinType === t ? 'bg-[var(--gold-vibrant)] text-[var(--navy-deep)] border-[var(--gold-accent)]' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {pinType === 'หลักร้อย' && !activeBetTypes.some(t => t.includes('3 ตัว')) && (
                  <p className="text-red-500 text-[10px] mt-1">*หลักร้อยใช้ได้กับประเภท 3 ตัวเท่านั้น</p>
                )}
              </div>
              
              <div>
                <label className="text-sm font-bold text-[var(--navy-deep)] mb-2 block">เลือกตัวเลข (เลือกได้หลายตัว)</label>
                <div className="grid grid-cols-5 gap-2">
                  {[0,1,2,3,4,5,6,7,8,9].map(num => {
                    const nStr = num.toString();
                    const isSelected = pinNumbers.includes(nStr);
                    return (
                      <button 
                        key={num}
                        onClick={() => {
                          if (isSelected) setPinNumbers(prev => prev.filter(n => n !== nStr));
                          else setPinNumbers(prev => [...prev, nStr]);
                        }}
                        className={`py-2 text-lg font-black rounded border ${isSelected ? 'bg-[var(--navy-deep)] text-white border-[var(--navy-deep)]' : 'bg-white text-[var(--navy-deep)] border-gray-300'}`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={generatePinBets}
                className="w-full bg-[var(--gold-vibrant)] text-[var(--navy-deep)] font-black py-3 rounded-lg shadow-md active:scale-95 transition"
              >
                สร้างเลขปักหลัก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Set Modal */}
      {showSetModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="bg-[#111] p-3 flex justify-between items-center text-white border-b-2 border-red-800">
              <h3 className="font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">list_alt</span> 
                เลือกเลขชุดที่บันทึกไว้
              </h3>
              <button onClick={() => setShowSetModal(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
              {savedSets.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm font-bold">
                  ไม่มีเลขชุดที่บันทึกไว้<br/><span className="text-xs font-normal">สร้างได้ที่เมนู "จัดชุดเลข"</span>
                </div>
              ) : (
                savedSets.map(set => (
                  <button
                    key={set.id}
                    onClick={() => {
                      const newBets: BetItem[] = [];
                      set.items.forEach((item: any) => {
                        const payoutRate = lotteryConfig?.rates?.[item.type] || item.rate || DEFAULT_RATES[item.type] || 0;
                        newBets.push({
                          id: Math.random().toString(36).substr(2, 9),
                          number: item.number,
                          amount: betAmount,
                          type: item.type,
                          payoutRate: payoutRate,
                          isSpecial: false,
                          isReduced: false
                        });
                      });
                      setSelectedBets(prev => [...newBets, ...prev]);
                      setShowSetModal(false);
                      // Clear currently active betting types for visual clean up
                      setActiveBetTypes([]);
                      setBetNumber('');
                    }}
                    className="w-full bg-white border border-gray-300 rounded p-3 text-left hover:bg-gray-50 active:bg-gray-100 transition shadow-sm flex justify-between items-center"
                  >
                    <div>
                      <div className="font-bold text-gray-800">{set.name}</div>
                      <div className="text-xs text-gray-500">{set.items?.length || 0} รายการ</div>
                    </div>
                    <span className="material-symbols-outlined text-green-600">add_circle</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Tickets Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl rounded-sm">
            {/* Modal Header */}
            <div className="bg-[#008000] p-3 flex justify-center items-center relative text-white border-b-2 border-green-900">
              <h3 className="font-bold text-lg">ดึงโพยเก่า</h3>
              <button 
                onClick={() => setShowHistoryModal(false)} 
                className="absolute right-3 bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition font-black text-sm shadow-sm"
              >
                X
              </button>
            </div>
            
            {/* Table Header */}
            <div className="grid grid-cols-[80px_1fr_150px] bg-[#800000] text-white font-bold py-2 border-b-2 border-white shadow-sm">
              <div className="text-center border-r border-[#a61c1c]">ลำดับ</div>
              <div className="text-center border-r border-[#a61c1c]">โพย</div>
              <div className="text-center">รอบ</div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-white">
              {pastTickets.length === 0 ? (
                <div className="p-8 text-center text-gray-500 font-bold bg-[#f9f9f9]">
                  <span className="material-symbols-outlined text-4xl block mb-2 text-gray-400">receipt_long</span>
                  ไม่มีข้อมูลโพยเก่า
                </div>
              ) : (
                pastTickets.map((ticket, index) => (
                  <div 
                    key={ticket.id} 
                    onClick={() => {
                      if (!ticket.bets) return;
                      const newBets: BetItem[] = [];
                      let hasBlocked = false;
                      
                      ticket.bets.forEach((item: any) => {
                        const type = item.type;
                        const num = item.number;
                        
                        const blockInfo = blockedNumbers.find(b => 
                          b.number === num && (b.betType === 'ทุกประเภท' || b.betType === type)
                        );

                        let payoutRate = lotteryConfig?.rates?.[type] || item.rate || DEFAULT_RATES[type] || 0;
                        let isSpecial = false;
                        let isReduced = false;

                        if (blockInfo) {
                          if (blockInfo.restrictionType === 'blocked' || !blockInfo.restrictionType) {
                            hasBlocked = true;
                            return; // Skip blocked numbers
                          } else if (blockInfo.restrictionType === 'reduced') {
                            payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
                            isReduced = true;
                          } else if (blockInfo.restrictionType === 'special') {
                            payoutRate = (blockInfo.customPayoutRate ?? blockInfo.payoutRate);
                            isSpecial = true;
                          }
                        }

                        newBets.push({
                          id: Math.random().toString(36).substr(2, 9),
                          number: num,
                          amount: item.amount || betAmount,
                          type: type,
                          payoutRate: payoutRate,
                          isSpecial: isSpecial,
                          isReduced: isReduced
                        });
                      });

                      if (hasBlocked) {
                        alert('มีบางเลขในโพยเก่าถูกปิดรับ (อั้น) และถูกตัดออกอัตโนมัติ');
                      }

                      if (newBets.length > 0) {
                        setSelectedBets(prev => [...newBets, ...prev]);
                        setShowHistoryModal(false);
                        setActiveBetTypes([]);
                        setBetNumber('');
                      } else if (hasBlocked) {
                        alert('ไม่สามารถดึงเลขได้ เนื่องจากเลขทั้งหมดถูกปิดรับ');
                      }
                    }}
                    className="grid grid-cols-[80px_1fr_150px] border-b border-gray-300 hover:bg-yellow-50 cursor-pointer items-stretch transition group"
                  >
                    <div className="text-center p-3 text-sm text-gray-600 flex items-center justify-center border-r border-gray-200 font-bold bg-gray-50">
                      {index + 1}
                    </div>
                    <div className="p-3 text-sm border-r border-gray-200 bg-white">
                      <div className="flex flex-wrap gap-1">
                        {ticket.bets?.map((b: any, i: number) => (
                          <span key={i} className="bg-gray-100 border border-gray-300 rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-gray-800 flex items-center justify-center shadow-sm">
                            <span className="font-bold mr-1">{b.type}</span>
                            <span className="text-green-700 font-black mr-1">{b.number}</span>
                            <span className="text-blue-600 font-bold">= {b.amount}</span>
                          </span>
                        ))}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-2 flex justify-between items-center bg-gray-100 p-1.5 border border-gray-200 rounded-sm">
                        <span className="font-bold">รหัส: {ticket.ticketId?.substring(0,8) || ticket.id?.substring(0,8)}</span>
                        <span className="font-black text-blue-700">รวม ฿{ticket.totalAmount?.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-center p-3 text-xs text-gray-700 flex flex-col items-center justify-center font-bold bg-white">
                      <div className="bg-[#cc0000] text-white px-2 py-0.5 rounded-sm mb-1.5 text-[10px] uppercase shadow-sm whitespace-nowrap">
                        {ticket.lotteryType || 'หวยรัฐบาล'}
                      </div>
                      <div className="text-gray-500 font-normal">
                        {new Date(ticket.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })} 
                      </div>
                      <div className="text-gray-500 font-normal">
                        {new Date(ticket.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </div>
                      <div className="mt-2 text-[10px] text-[#008000] font-black opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all border-b-2 border-green-600 rounded px-3 py-1 bg-green-50 shadow-sm">
                        + ดึงโพยนี้
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {/* Panel Modal */}
      {showPanelModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col shadow-2xl rounded-sm">
            <div className="bg-[#007bff] p-3 flex justify-center items-center relative text-white border-b-2 border-blue-900">
              <h3 className="font-bold text-lg">เลือกจากแผง (2 ตัว)</h3>
              <button 
                onClick={() => setShowPanelModal(false)} 
                className="absolute right-3 bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition font-black text-sm shadow-sm"
              >
                X
              </button>
            </div>

            <div className="p-2 bg-gray-100 flex justify-between items-center border-b border-gray-300">
              <div className="text-xs font-bold text-gray-700">เลือกเลขที่ต้องการ (เลือกได้หลายเลข)</div>
              <div className="text-xs font-black text-blue-700 bg-white px-2 py-1 rounded shadow-sm border border-gray-300">
                เลือกแล้ว: {selectedPanelNumbers.length}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 bg-white">
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0')).map(num => (
                  <button
                    key={num}
                    onClick={() => {
                      setSelectedPanelNumbers(prev => 
                        prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
                      );
                    }}
                    className={`aspect-square flex items-center justify-center text-sm font-black rounded border-2 transition-all ${
                      selectedPanelNumbers.includes(num)
                        ? 'bg-[#107c10] text-white border-yellow-400 scale-95 shadow-inner ring-1 ring-yellow-400'
                        : 'bg-white text-gray-800 border-gray-200 hover:border-blue-400'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-gray-100 border-t border-gray-300 flex gap-2">
              <button 
                onClick={() => setSelectedPanelNumbers([])}
                className="flex-1 bg-gray-500 text-white font-bold py-2 rounded-sm text-sm hover:bg-gray-600 shadow-sm"
              >
                ล้างการเลือก
              </button>
              <button 
                onClick={handlePanelConfirm}
                className="flex-[2] bg-[#107c10] text-white font-bold py-2 rounded-sm text-sm hover:bg-green-700 shadow-lg active:scale-95 transition-transform"
              >
                ตกลงเพิ่มรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification Toast */}
      <AnimatePresence>
        {showSuccessToast && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 pointer-events-none">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-8 flex flex-col items-center gap-4 border-[6px] border-[#107c10] relative overflow-hidden text-center max-w-sm w-full pointer-events-auto"
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 4 }}
                transition={{ duration: 0.5 }}
                className="absolute -z-10 bg-green-50 w-32 h-32 rounded-full"
              />
              
              <motion.div 
                initial={{ rotate: -10, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", damping: 10 }}
                className="w-24 h-24 bg-[#107c10] rounded-full flex items-center justify-center text-white shadow-xl mb-2"
              >
                <span className="material-symbols-outlined text-[60px] font-black">check_circle</span>
              </motion.div>
              
              <h2 className="text-3xl font-black text-gray-800 tracking-tight">ส่งโพยสำเร็จ!</h2>
              <div className="space-y-1">
                <p className="text-gray-600 font-bold text-lg">ตัดเงินจากกระเป๋าเรียบร้อยแล้ว</p>
                <p className="text-red-500 font-black text-sm uppercase">* สามารถยกเลิกได้ภายใน 3 นาที</p>
              </div>
              
              <motion.div 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 3, ease: "linear" }}
                className="h-1.5 bg-[#107c10] absolute bottom-0 left-0 right-0"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      

      {/* Duplicate Confirmation Modal */}
      <ActionConfirmModal
        isOpen={showDupConfirm !== null}
        title="พบรายการแทงซ้ำ!"
        description={
          <>
            ระบบตรวจพบรายการแทงซ้ำกัน <span className="text-[#cc0000] text-lg px-1 font-black">{showDupConfirm}</span> รายการ
            <br />
            ต้องการรวมยอดเงินและตัดรายการส่วนเกินออกหรือไม่?
          </>
        }
        icon="content_copy"
        confirmLabel="ยืนยันตัดเลขซ้ำ"
        cancelLabel="ยกเลิก"
        confirmTone="red"
        onConfirm={executeRemoveDuplicates}
        onCancel={() => setShowDupConfirm(null)}
      />

      {/* Clear All Confirmation Modal */}
      <ActionConfirmModal
        isOpen={showClearConfirm}
        title="ยกเลิกรายการทั้งหมด?"
        description={
          <>
            คุณต้องการ <span className="text-[#cc0000] text-lg px-1 font-black">ล้างรายการแทงทั้งหมด</span> ในตะกร้าใช่หรือไม่?
            <br />
            <span className="text-xs text-gray-400 font-medium">*การดำเนินการนี้ไม่สามารถเรียกคืนได้</span>
          </>
        }
        icon="delete_sweep"
        confirmLabel="ยืนยันยกเลิกทั้งหมด"
        cancelLabel="ไม่ยกเลิก"
        confirmTone="red"
        onConfirm={executeClearAllBets}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Bill Detail Modal */}
      <BillDetailModal
        ticket={selectedTicketForBill as any}
        onClose={() => setSelectedTicketForBill(null)}
        onUpdateCustomerName={handleUpdateCustomerName}
        onCancelTicket={cancelTicket}
        taxRate={globalSettings.taxRate || 1}
      />

      {/* Confirmation Modal */}
      {confirmTicketInfo && (
        <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
              <div className="bg-[var(--navy-deep)] p-4 text-white text-center rounded-b-lg relative">
                 <span className="material-symbols-outlined text-4xl text-[var(--gold-vibrant)] mb-1">receipt_long</span>
                 <h2 className="text-xl font-black">ยืนยันแทงโพย</h2>
                 <p className="text-xs text-gray-300">กรุณาตรวจสอบข้อมูลก่อนยืนยัน</p>
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto bg-gray-50 text-sm space-y-4">
                 <div className="bg-white p-3 rounded shadow-sm border border-gray-200 font-bold">
                     <div className="flex justify-between mb-1">
                         <span className="text-gray-500 font-bold">รหัสบิล</span>
                         <span className="font-black text-blue-600 tracking-wider outline-none select-all">{confirmTicketInfo.ticketId}</span>
                     </div>
                     <div className="flex justify-between mb-1">
                         <span className="text-gray-500 font-bold">วันที่</span>
                         <span className="font-bold">{new Date(confirmTicketInfo.date).toLocaleString('th-TH')}</span>
                     </div>
                     <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                         <span className="text-gray-500 font-bold">ผู้ซื้อ</span>
                         <span className="font-bold">{confirmTicketInfo.customerName}</span>
                     </div>
                 </div>

                 <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-100 p-2 text-center font-bold text-[var(--navy-deep)] border-b">รายการแทง ({confirmTicketInfo.bets.length} รายการ)</div>
                    <div className="max-h-40 overflow-y-auto">
                       <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-500 sticky top-0 border-b">
                            <tr>
                              <th className="p-2 text-left font-semibold">ประเภท</th>
                              <th className="p-2 text-center font-semibold">เลข</th>
                              <th className="p-2 text-right font-semibold">ราคา</th>
                            </tr>
                          </thead>
                          <tbody>
                            {confirmTicketInfo.bets.map((b, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                 <td className="p-2 text-left font-bold">{b.type}</td>
                                 <td className="p-2 text-center font-black text-[var(--navy-deep)]">{b.number}</td>
                                 <td className="p-2 text-right font-bold text-red-600">{b.amount}</td>
                              </tr>
                            ))}
                          </tbody>
                       </table>
                    </div>
                 </div>

                 <div className="bg-[var(--gold-light)] p-3 rounded shadow-sm border border-[var(--gold-vibrant)] flex justify-between items-center gap-2 overflow-hidden">
                    <span className="font-black text-[var(--navy-deep)] shrink-0">ยอดรวมทั้งหมด</span>
                    <span className="font-black text-lg sm:text-xl text-red-600 truncate text-right">{confirmTicketInfo.total.toLocaleString(undefined, {minimumFractionDigits: 2})} ฿</span>
                 </div>
              </div>

              <div className="p-4 bg-white border-t flex gap-2">
                  <button 
                     disabled={isSubmitting}
                     onClick={() => setConfirmTicketInfo(null)}
                     className="flex-1 py-3 bg-gray-200 text-gray-700 font-black rounded-lg hover:bg-gray-300 transition outline-none disabled:opacity-50"
                  >
                     ยกเลิก
                  </button>
                  <button 
                     disabled={isSubmitting}
                     onClick={() => executeSubmitTicket()}
                     className="flex-1 py-3 bg-[#107c10] text-white font-black rounded-lg hover:bg-green-700 transition shadow-lg outline-none flex items-center justify-center gap-2 disabled:bg-green-800 disabled:shadow-none"
                  >
                     {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                          กำลังทำงาน...
                        </>
                     ) : 'ยืนยันแทงโพย'}
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* Final Receipt Modal (3D Elevated Realistic Bill with QR Code & Payout Rates) */}
      {showSuccessReceipt && (
        <div className="fixed inset-0 bg-black/75 z-[200] flex items-center justify-center p-3 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-[0_30px_70px_-10px_rgba(0,0,0,0.7),0_15px_30px_rgba(0,0,0,0.5)] w-full max-w-sm overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200 border-2 border-emerald-500 my-auto">
            
            {/* รอยบากตั๋วซ้ายขวา (Ticket Side Notches) เพื่อสร้างมิติตั๋วนูน 3D สมจริง */}
            <div className="absolute -left-3.5 top-[230px] w-7 h-7 rounded-full bg-[#060c2b] shadow-inner z-20 pointer-events-none"></div>
            <div className="absolute -right-3.5 top-[230px] w-7 h-7 rounded-full bg-[#060c2b] shadow-inner z-20 pointer-events-none"></div>

            {/* Receipt Header (สไตล์หัวสลิป 3D นูนขึ้น) */}
            <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 p-4 text-white text-center pb-7 relative shadow-md">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-[0_4px_15px_rgba(0,0,0,0.25)] relative">
                <span className="material-symbols-outlined text-3xl text-emerald-600 font-bold">check_circle</span>
              </div>
              <h2 className="text-xl font-black tracking-wide drop-shadow-sm">ส่งโพยสำเร็จ</h2>
              <p className="text-xs text-emerald-100 font-medium opacity-90 mt-0.5">
                ตัดเครดิตและบันทึกโพยเข้าระบบแล้ว (100%)
              </p>
              
              {/* Receipt Zigzag top part simulation */}
              <div className="absolute -bottom-2 left-0 right-0 h-4 bg-white" style={{ clipPath: 'polygon(0% 100%, 2.5% 0%, 5% 100%, 7.5% 0%, 10% 100%, 12.5% 0%, 15% 100%, 17.5% 0%, 20% 100%, 22.5% 0%, 25% 100%, 27.5% 0%, 30% 100%, 32.5% 0%, 35% 100%, 37.5% 0%, 40% 100%, 42.5% 0%, 45% 100%, 47.5% 0%, 50% 100%, 52.5% 0%, 55% 100%, 57.5% 0%, 60% 100%, 62.5% 0%, 65% 100%, 67.5% 0%, 70% 100%, 72.5% 0%, 75% 100%, 77.5% 0%, 80% 100%, 82.5% 0%, 85% 100%, 87.5% 0%, 90% 100%, 92.5% 0%, 95% 100%, 97.5% 0%, 100% 100%)' }}></div>
            </div>
            
            {/* Receipt Body */}
            <div className="px-5 pb-5 pt-3 bg-white space-y-3 relative text-xs">
              
              {/* Title & Status Badge */}
              <div className="text-center space-y-1.5 pb-2 border-b border-dashed border-gray-300">
                <div className="text-base sm:text-lg font-black text-[#0a192f] tracking-wide">
                  {showSuccessReceipt.displayName}
                </div>
                
                {/* สถานะโพย: รอผลรางวัล & ยืนยันเข้าถูก */}
                <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-300 px-3 py-1 rounded-full shadow-sm text-xs font-black text-amber-900">
                  <span className="material-symbols-outlined text-sm text-amber-600 animate-spin" style={{ animationDuration: '4s' }}>schedule</span>
                  <span>สถานะ: รอผลรางวัล</span>
                  <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                    เข้าถูก 100%
                  </span>
                </div>
              </div>

              {/* 3D Financial Summary Card: ยอดแทงรวม & โอกาสถูกสูงสุด */}
              {(() => {
                const totalPotentialWin = showSuccessReceipt.bets.reduce((sum, b) => {
                  const rate = b.payoutRate || (lotteryConfig?.rates?.[b.type] ?? DEFAULT_RATES[b.type] ?? 900);
                  return sum + (Number(b.amount || 0) * Number(rate || 0));
                }, 0);

                return (
                  <div className="bg-gradient-to-br from-red-50 via-rose-50 to-amber-50 border border-red-200 rounded-2xl p-2.5 shadow-sm space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/90 rounded-xl p-2 text-center border border-red-200/60 shadow-xs">
                        <div className="text-[10px] text-gray-500 font-bold">ยอดเงินแทงรวม</div>
                        <div className="text-lg sm:text-xl font-black text-red-600 font-mono tracking-tight mt-0.5">
                          ฿ {showSuccessReceipt.total.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-amber-100 to-yellow-50 rounded-xl p-2 text-center border border-amber-300 shadow-xs">
                        <div className="text-[10px] text-amber-800 font-bold flex items-center justify-center gap-0.5">
                          <span className="material-symbols-outlined text-xs text-amber-600">stars</span>
                          <span>โอกาสถูกสูงสุด</span>
                        </div>
                        <div className="text-lg sm:text-xl font-black text-amber-900 font-mono tracking-tight mt-0.5">
                          ฿ {totalPotentialWin.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </div>
                      </div>
                    </div>

                    <div className="text-[9px] text-center text-amber-700 font-medium">
                      💡 คำนวณจากราคาจ่ายสูงสุดของแต่ละประเภท (เช่น แทง ฿5 ลุ้นสูงสุด ฿4,500 - ฿9,000)
                    </div>
                  </div>
                );
              })()}

              {/* Bill Meta Data */}
              <div className="space-y-1.5 bg-gray-50 p-2.5 rounded-xl border border-gray-200/80 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold">รหัสบิล</span>
                  <span className="font-mono font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 tracking-wider">
                    {showSuccessReceipt.ticketId}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold">เวลาทำรายการ</span>
                  <span className="font-bold text-gray-700">{new Date(showSuccessReceipt.date).toLocaleString('th-TH')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold">ชื่อผู้ซื้อ</span>
                  <span className="font-bold text-gray-700">{showSuccessReceipt.customerName}</span>
                </div>
              </div>

              {/* Bet List with Payout & Max Win per item */}
              <div>
                <div className="flex justify-between items-center text-[11px] font-bold text-gray-500 mb-1.5 px-1">
                  <span>รายการแทง ({showSuccessReceipt.bets.length} รายการ)</span>
                  <span>ราคาจ่าย / ลุ้นสูงสุด</span>
                </div>
                <div className="max-h-32 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
                  {showSuccessReceipt.bets.map((bet, idx) => {
                    const rate = bet.payoutRate || (lotteryConfig?.rates?.[bet.type] ?? DEFAULT_RATES[bet.type] ?? 900);
                    const itemMaxWin = Number(bet.amount || 0) * Number(rate || 0);

                    return (
                      <div key={idx} className="bg-gray-50 hover:bg-gray-100 p-2 rounded-xl border border-gray-200/70 flex items-center justify-between text-xs transition">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-black text-[9px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-700 text-[11px]">{bet.type}</span>
                              <span className="font-mono font-black text-[#0a192f] text-sm">{bet.number}</span>
                            </div>
                            <div className="text-[10px] text-emerald-700 font-medium">
                              จ่าย ฿{rate.toLocaleString()} (ลุ้น ฿{itemMaxWin.toLocaleString()})
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-black text-red-600 font-mono">
                            {bet.amount} ฿
                          </div>
                          <div className="text-[9px] text-amber-600 font-bold">
                            รอผล
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* สถานะ QR Code สำหรับตรวจสอบโพย */}
              <div className="bg-slate-900 text-white rounded-2xl p-2.5 border border-slate-700 shadow-md flex items-center gap-2.5">
                <div className="w-16 h-16 bg-white p-1 rounded-xl shadow shrink-0 flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`https://ak88-lotto.vercel.app/tickets?id=${showSuccessReceipt.ticketId}`)}&margin=2`}
                    alt="Ticket QR Code"
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-[11px] font-black text-amber-400">
                    <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                    <span>QR เช็คสถานะโพย</span>
                  </div>
                  <p className="text-[9px] text-slate-300 mt-0.5 leading-tight">
                    สแกนตรวจสอบสถานะบิล ตรวจผลรางวัลสดได้ 24 ชม.
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      เข้าถูก 100%
                    </span>
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold px-1.5 py-0.2 rounded">
                      รอผลรางวัล
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Buttons */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex gap-2">
              <button 
                onClick={() => copyTicketAsBillText(showSuccessReceipt)}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition shadow flex items-center justify-center gap-1 text-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>คัดลอกบิล</span>
              </button>
              <button 
                onClick={() => window.print()}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition shadow flex items-center justify-center gap-1 text-xs active:scale-95"
                title="พิมพ์สลิปบิล"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>พิมพ์</span>
              </button>
              <button 
                onClick={() => setShowSuccessReceipt(null)}
                className="flex-1 py-2.5 bg-[#0a192f] hover:bg-black text-[#f5c518] font-black rounded-xl transition shadow flex items-center justify-center gap-1 text-xs active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                <span>ปิดบิล (เริ่มใหม่)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ★ โมดอลประวัติการยิงเลข & จัดอันดับโบนัส ★ */}
      {showShooterModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[250] flex items-center justify-center p-3">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-white animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 p-4 border-b border-amber-400/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🎯</span>
                <div>
                  <h3 className="font-black text-amber-300 text-lg">
                    ประวัติการยิงเลข — รอบที่ {yeekeeRoundNum}
                  </h3>
                  <p className="text-xs text-slate-400">
                    วันที่ {YK.dayLabel(ykGameDay)} (รอบ {YK.hhmm(ykOpenMs)} - {YK.hhmm(ykCloseMs)} น.)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowShooterModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Top Stat Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-slate-950/70 border-b border-white/10 text-center">
              <div className="bg-slate-800/60 p-2 rounded-lg border border-white/5">
                <div className="text-[11px] text-slate-400">ยิงทั้งหมด</div>
                <div className="text-lg font-black text-amber-300 font-mono">{ykShoots.length} คน</div>
              </div>
              <div className="bg-slate-800/60 p-2 rounded-lg border border-white/5">
                <div className="text-[11px] text-slate-400">ผลรวมตัวเลข</div>
                <div className="text-lg font-black text-white font-mono">{ykShootsSum.toLocaleString()}</div>
              </div>
              <div className="bg-amber-950/40 p-2 rounded-lg border border-amber-400/50">
                <div className="text-[11px] text-amber-300 font-bold">🇹🇭 6 หลักสลากกินแบ่ง</div>
                <div className="text-lg font-black text-amber-300 font-mono tracking-widest">{ykLottery6}</div>
                <div className="text-[10px] text-slate-300">บน: <b className="text-white">{yk3Top}</b> | ล่าง: <b className="text-white">{yk2Bottom}</b></div>
              </div>
              <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-400/40">
                <div className="text-[11px] text-amber-300 font-bold">🥇 ลำดับ 1 (฿200)</div>
                <div className="text-sm font-black text-white truncate">{ykShooter1?.username || '-'}</div>
                <div className="text-[11px] font-mono text-amber-300">{ykShooter1?.number || ''}</div>
              </div>
              <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-400/40">
                <div className="text-[11px] text-emerald-300 font-bold">🎯 ลำดับ 18 (฿400)</div>
                <div className="text-sm font-black text-white truncate">{ykShooter18?.username || (ykShoots.length < 18 ? 'ยังไม่ถึง' : '-')}</div>
                <div className="text-[11px] font-mono text-emerald-300">{ykShooter18?.number || ''}</div>
              </div>
            </div>

            {/* Shoots Table */}
            <div className="flex-1 overflow-y-auto p-3">
              {ykShoots.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  ยังไม่มีใครยิงเลขในรอบนี้ คุณสามารถเป็นคนแรกได้!
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-white/10">
                    <tr>
                      <th className="py-2 px-2 text-center w-14">ลำดับ</th>
                      <th className="py-2 px-2 text-left">เวลา</th>
                      <th className="py-2 px-2 text-left">ผู้ยิง</th>
                      <th className="py-2 px-2 text-center font-mono">ตัวเลข 5 หลัก</th>
                      <th className="py-2 px-2 text-center">รางวัลพิเศษ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ykShoots.map((s, idx) => {
                      const rank = idx + 1;
                      const isFirst = rank === 1;
                      const isEighteenth = rank === 18;
                      return (
                        <tr
                          key={s.id || idx}
                          className={`hover:bg-white/5 ${
                            isFirst
                              ? 'bg-amber-500/15 font-bold text-amber-200'
                              : isEighteenth
                              ? 'bg-emerald-500/15 font-bold text-emerald-200'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-2 text-center">
                            <span className={`inline-block w-6 h-6 rounded-full text-[11px] font-mono leading-6 ${
                              isFirst ? 'bg-amber-400 text-slate-950 font-black' : isEighteenth ? 'bg-emerald-400 text-slate-950 font-black' : 'text-slate-400'
                            }`}>
                              {rank}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-slate-400">
                            {new Date(s.ts).toLocaleTimeString('th-TH')}
                          </td>
                          <td className="py-2 px-2">
                            <span className="font-bold">{s.username}</span>
                            {s.isBot && <span className="ml-1 text-[10px] text-slate-500">(บอท)</span>}
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-black text-amber-300 tracking-wider">
                            {s.number}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {isFirst && (
                              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                                🏆 โบนัส ฿200
                              </span>
                            )}
                            {isEighteenth && (
                              <span className="bg-emerald-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                                🎖️ โบนัส ฿400
                              </span>
                            )}
                            {!isFirst && !isEighteenth && <span className="text-slate-600">-</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 p-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                * ยิงเลขได้ทุก 3 นาที | รางวัลลำดับที่ 1 (฿200) และ 18 (฿400) จะได้รับทันทีเมื่อรอบออกผล (ยอดแทงสะสม ≥ ฿100)
              </span>
              <button
                onClick={() => setShowShooterModal(false)}
                className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-4 py-1.5 rounded-lg"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
