import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { collection, addDoc, onSnapshot, doc, getDoc, updateDoc, query, where, getDocs, setDoc, orderBy, limit } from 'firebase/firestore';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { countBets, fmtMoney, fmtInt } from '@/shared/lib/betCount';
import BetSummaryPanel from '@/shared/components/BetSummaryPanel';

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
  '2 ตัวบน': 95.00,
  '3 ตัวบน': 900.00,
  '3 ตัวโต๊ด': 150.00,
  '3 ตัวล่าง': 150.00,
  '3 ตัวกลับ': 900.00,
  '2 ตัวโต๊ด': 13.00,
  'วิ่งบน': 3.20,
  'วิ่งล่าง': 4.20,
  '2 ตัวล่าง': 95.00,
  '2 ตัวกลับ': 95.00,
  '4-5 ตัว': 4000.00, // Or whatever the base is
  '4 ตัวบน': 4000.00,
  '4 ตัวโต๊ด': 25.00,
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
      'yeekee': 'ยี่กี 4D',
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
      'malay': 'หวยมาเลย์',
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
    if (t.includes('malay')) return 'https://flagcdn.com/w80/my.png';
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
      return 'ยี่กี 4D';
    }
    return getLotteryDisplayName(typeParam);
  };

  const displayName = getLotteryDisplayName(type);
  const baseLotteryName = getBaseLotteryName(type);
  const isThaiLottery = displayName === 'หวยรัฐบาล';

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'lotteryTypes', baseLotteryName), (doc) => {
      if (doc.exists()) {
        setLotteryConfig(doc.data());
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
    if (type.includes('3 ตัว') || type === 'ตอง') return 3;
    if (type.includes('4 ตัว') || type.includes('4-5 ตัว')) return 4;
    if (type.includes('5 ตัว')) return 5;
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

  const isClosed = lotteryConfig ? (!lotteryConfig.isOpen || (lotteryConfig.closingTime && new Date(lotteryConfig.closingTime).getTime() <= currentTime)) : false;

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
                  payoutRate = blockInfo.customPayoutRate;
                } else if (blockInfo.restrictionType === 'special') {
                  payoutRate = blockInfo.customPayoutRate;
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

          let payoutRate = lotteryConfig?.rates?.[type] || DEFAULT_RATES[type] || 0;
          const medianRate = lotteryConfig?.medianRates?.[type] || 0;
          let isSpecial = false;
          let isReduced = false;

          if (blockInfo) {
            if (blockInfo.restrictionType === 'blocked' || !blockInfo.restrictionType) {
              hasBlocked = true;
              return;
            } else if (blockInfo.restrictionType === 'reduced') {
              payoutRate = blockInfo.customPayoutRate;
            } else if (blockInfo.restrictionType === 'special') {
              payoutRate = blockInfo.customPayoutRate;
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

      let payoutRate = lotteryConfig?.rates?.[type] || DEFAULT_RATES[type] || 0;
      const medianRate = lotteryConfig?.medianRates?.[type] || 0;
      let isSpecial = false;
      let isReduced = false;

      if (blockInfo) {
        if (blockInfo.restrictionType === 'blocked' || !blockInfo.restrictionType) {
          hasBlocked = true;
          return null;
        } else if (blockInfo.restrictionType === 'reduced') {
          payoutRate = blockInfo.customPayoutRate;
        } else if (blockInfo.restrictionType === 'special') {
          payoutRate = blockInfo.customPayoutRate;
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
            payoutRate = blockInfo.customPayoutRate;
            isReduced = true;
          } else if (blockInfo.restrictionType === 'special') {
            payoutRate = blockInfo.customPayoutRate;
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
            payoutRate = blockInfo.customPayoutRate;
          } else if (blockInfo.restrictionType === 'special') {
            payoutRate = blockInfo.customPayoutRate;
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
        status: 'pending_cancellation',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(expires).toISOString(),
        userId: currentUserId,
        lotteryType: displayName,
        lotterySlug: type || 'thai',
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
    const info = directTicketInfo || confirmTicketInfo;
    if(!info) return;
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
      };

      // 3. Save to Firestore
      await addDoc(collection(db, 'tickets'), {
        ticketId,
        bets: info.bets,
        totalAmount: total,
        status: 'pending_cancellation',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(expires).toISOString(),
        userId: currentUserId,
        lotteryType: displayName,
        lotterySlug: type || 'thai',
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
            payoutRate = blockInfo.customPayoutRate;
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
                <div className="w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-full border border-gray-200 flex overflow-hidden shadow-sm items-center justify-center bg-white">
                  <img src={getLotteryIcon(type)} alt="logo" className="w-full h-full object-cover" />
                </div>
                <span className="font-black text-[16px] sm:text-lg md:text-xl lg:text-2xl text-black tracking-tighter truncate">{displayName}</span>
              </div>
              <div className="bg-[#333] text-[11px] sm:text-[12px] md:text-[13px] px-2 py-1 md:py-1.5 md:px-3 text-white flex items-center rounded-[4px] font-bold shrink-0">
                {lotteryConfig?.closingTime ? (
                  <span className={isClosed ? 'text-red-500' : ''}>
                    {isClosed ? 'ปิดรับแล้ว' : '16-Apr-2026 15:20'}
                  </span>
                ) : (
                  '16-Apr-2026 15:20'
                )}
              </div>
            </div>

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

            {/* ★ 👑 แถบฟังก์ชันช่วย VIP (VIP Helper Ribbon) ★ */}
            <div className="mt-2 bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 p-2.5 rounded-xl border border-amber-400/50 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">👑</span>
                  <span className="text-xs font-black text-amber-900 tracking-tight">
                    แถบฟังก์ชันช่วย VIP (VIP Assistant Tools)
                  </span>
                </div>
                <span className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full shadow-sm">
                  VIP EXCLUSIVE
                </span>
              </div>

              {/* VIP Quick Tool Buttons */}
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <button
                  type="button"
                  onClick={() => toggleSpecialMode('19ประตู')}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1 shadow-sm ${
                    specialModes.includes('19ประตู')
                      ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400 font-black'
                      : 'bg-white hover:bg-amber-50 text-slate-800 border border-amber-300/50'
                  }`}
                >
                  <span>🚪</span> 19 ประตู VIP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const doubles = ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'];
                    const types = activeBetTypes.length > 0 ? activeBetTypes : ['2 ตัวบน', '2 ตัวล่าง'];
                    addSpecialBets(doubles, types);
                  }}
                  className="py-1.5 px-1 bg-white hover:bg-amber-50 text-slate-800 border border-amber-300/50 rounded-lg text-[11px] font-black transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95"
                >
                  <span>✨</span> เลขเบิ้ล VIP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const siblings = ['01', '12', '23', '34', '45', '56', '67', '78', '89', '90'];
                    const types = activeBetTypes.length > 0 ? activeBetTypes : ['2 ตัวบน', '2 ตัวล่าง'];
                    addSpecialBets(siblings, types);
                  }}
                  className="py-1.5 px-1 bg-white hover:bg-amber-50 text-slate-800 border border-amber-300/50 rounded-lg text-[11px] font-black transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95"
                >
                  <span>🤝</span> พี่น้อง VIP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // สุ่มเลขมงคล VIP 1 ชุด
                    const luckyNum = Math.floor(Math.random() * 100).toString().padStart(2, '0');
                    const types = activeBetTypes.length > 0 ? activeBetTypes : ['2 ตัวบน', '2 ตัวล่าง'];
                    addSpecialBets([luckyNum], types);
                  }}
                  className="py-1.5 px-1 bg-gradient-to-r from-amber-400 to-yellow-300 hover:brightness-105 text-slate-950 font-black rounded-lg text-[11px] shadow-sm flex items-center justify-center gap-1 active:scale-95"
                >
                  <span>🎯</span> สุ่มเลขเด็ด VIP
                </button>
              </div>
            </div>

            {/* ★ 👑 แถบฟังก์ชันช่วยเลขรัน VIP (VIP Running Numbers Strip) ★ */}
            {activeBetTypes.some(t => t.includes('วิ่ง')) && (
              <div className="mt-2 bg-gradient-to-r from-[#1a1300] via-[#2d2200] to-[#1a1300] p-3 rounded-xl border-2 border-amber-400/70 shadow-md text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base text-yellow-300">⚡</span>
                    <span className="text-xs font-black text-amber-300 tracking-tight">
                      แถบฟังก์ชันช่วยเลขรัน VIP (วิ่งบน / วิ่งล่าง)
                    </span>
                  </div>
                  <span className="text-[10px] bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black px-2 py-0.5 rounded-full shadow-sm">
                    เลขรัน VIP 0-9
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const allRunning = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
                      addSpecialBets(allRunning);
                    }}
                    className="py-2 px-1 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 font-black text-[11px] rounded-lg shadow transition active:scale-95 flex items-center justify-center gap-1"
                  >
                    <span>⚡</span> รัน 0-9 ครบ (10 ตัว)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const evenRunning = ['0', '2', '4', '6', '8'];
                      addSpecialBets(evenRunning);
                    }}
                    className="py-2 px-1 bg-white/10 hover:bg-white/20 text-yellow-200 border border-amber-400/40 font-black text-[11px] rounded-lg shadow transition active:scale-95 flex items-center justify-center gap-1"
                  >
                    <span>🎯</span> รันเลขคู่ (0,2,4,6,8)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const oddRunning = ['1', '3', '5', '7', '9'];
                      addSpecialBets(oddRunning);
                    }}
                    className="py-2 px-1 bg-white/10 hover:bg-white/20 text-yellow-200 border border-amber-400/40 font-black text-[11px] rounded-lg shadow transition active:scale-95 flex items-center justify-center gap-1"
                  >
                    <span>🎲</span> รันเลขคี่ (1,3,5,7,9)
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const lowRunning = ['0', '1', '2', '3', '4'];
                      addSpecialBets(lowRunning);
                    }}
                    className="py-1.5 px-1 bg-black/40 hover:bg-black/60 text-amber-200 border border-amber-400/20 font-black text-[10px] rounded-lg shadow transition active:scale-95 flex items-center justify-center gap-1"
                  >
                    <span>⬇️</span> รันเลขต่ำ (0-4)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const highRunning = ['5', '6', '7', '8', '9'];
                      addSpecialBets(highRunning);
                    }}
                    className="py-1.5 px-1 bg-black/40 hover:bg-black/60 text-amber-200 border border-amber-400/20 font-black text-[10px] rounded-lg shadow transition active:scale-95 flex items-center justify-center gap-1"
                  >
                    <span>⬆️</span> รันเลขสูง (5-9)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const lucky = [Math.floor(Math.random() * 10).toString()];
                      addSpecialBets(lucky);
                    }}
                    className="py-1.5 px-1 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-[10px] rounded-lg shadow transition active:scale-95 flex items-center justify-center gap-1"
                  >
                    <span>👑</span> สุ่มเลขรันเด่น VIP
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

            <div className="text-center mt-3 mb-2 font-bold flex flex-col items-center justify-center gap-1">
              <div className="flex flex-wrap justify-center items-center gap-1.5">
                {activeBetTypes.length === 0 ? (
                  <span className="text-red-500 text-[14px] font-black tracking-wide bg-gray-300 px-6 py-2 rounded-full shadow-inner border border-gray-400">กรุณาเลือกหวยแทง</span>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>

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
            <div className="bg-black text-white text-center pt-3.5 pb-2.5 px-1.5 border border-gray-600 rounded-sm relative shadow-inner overflow-hidden flex flex-col justify-center items-center">
              <div className="bg-white text-black text-[10px] font-bold px-2 py-[1px] absolute -top-2 left-1/2 -translate-x-1/2 rounded whitespace-nowrap shadow-sm border border-gray-300 z-10">ยอดเครดิตคงเหลือ</div>
              <div 
                className="font-black text-xs sm:text-sm md:text-base text-[#ffffff] leading-tight max-w-full truncate px-1" 
                title={`฿ ${(userData?.balance ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
              >
                ฿ {(userData?.balance ?? 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
            </div>
            <div className="bg-black text-white text-center pt-3.5 pb-2.5 px-1.5 border border-gray-600 rounded-sm relative shadow-inner overflow-hidden flex flex-col justify-center items-center">
              <div className="bg-white text-black text-[10px] font-bold px-2 py-[1px] absolute -top-2 left-1/2 -translate-x-1/2 rounded whitespace-nowrap shadow-sm border border-gray-300 z-10">รวมยอดแทง</div>
              <div 
                className="font-black text-xs sm:text-sm md:text-base text-[#ffffff] leading-tight max-w-full truncate px-1"
                title={`฿ ${totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
              >
                ฿ {totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button 
              onClick={submitTicket}
              className="bg-[#107c10] text-white font-black flex items-center justify-center gap-1.5 hover:bg-green-700 rounded-lg border-b-4 border-green-800 shadow-lg active:translate-y-[2px] active:border-b-2 h-11 transition-all text-[13px] uppercase tracking-wide"
            >
              <span className="material-symbols-outlined text-[20px]">touch_app</span> ส่งโพย
            </button>
            <button 
              onClick={clearAllBets}
              className="bg-[#cc0000] text-white font-black flex items-center justify-center gap-1.5 hover:bg-red-700 rounded-lg border-b-4 border-red-900 shadow-lg active:translate-y-[2px] active:border-b-2 h-11 transition-all text-[13px] uppercase tracking-wide"
            >
              <span className="material-symbols-outlined text-[20px]">delete_sweep</span> ยกเลิกทั้งหมด
            </button>
          </div>
        </div>

        {/* Active Tickets Section */}
        {activeTickets.length > 0 && (
          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between border-l-4 border-gray-600 pl-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--navy-deep)]">history_edu</span>
                <h3 className="font-bold text-[var(--navy-deep)] text-sm">โพยที่ส่งแล้ว</h3>
              </div>
              <div className="flex bg-gray-200 p-0.5 rounded gap-0.5">
                {(['all', 'active', 'cancelled'] as const).map(f => (
                  <button 
                    key={f}
                    onClick={() => setTicketFilter(f)}
                    className={`text-[9px] font-black px-2 py-1 rounded transition-all uppercase ${ticketFilter === f ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    {f === 'all' ? 'ทั้งหมด' : f === 'active' ? 'รอลุ้น' : 'ยกเลิก'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              {activeTickets
                .filter(t => {
                  if (ticketFilter === 'all') return true;
                  if (ticketFilter === 'active') return t.status !== 'cancelled';
                  if (ticketFilter === 'cancelled') return t.status === 'cancelled';
                  return true;
                })
                .map(ticket => {
                const isExpired = currentTime >= ticket.expiresAt;
                const isCancelled = ticket.status === 'cancelled';
                
                return (
                  <div key={ticket.id} className="relative group animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Ticket Body */}
                    <div className={`bg-white rounded shadow-sm border border-gray-300 overflow-hidden flex flex-col transition-all ${isCancelled ? 'opacity-80 grayscale-[0.5]' : ''}`}>
                      {/* Cancelled Overlay */}
                      {isCancelled && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                          <div className="border-4 border-red-600 px-6 py-2 rounded-lg rotate-[-15deg] bg-white/40 backdrop-blur-sm shadow-xl">
                            <span className="text-4xl font-black text-red-600 uppercase tracking-widest drop-shadow-sm">ยกเลิก</span>
                          </div>
                        </div>
                      )}

                      {/* Header */}
                      <div className={`p-2 flex justify-between items-start border-b border-gray-200 ${isCancelled ? 'bg-gray-200' : 'bg-gray-100'}`}>
                        <div className="flex items-start gap-2">
                          <div className={`w-8 h-8 shrink-0 rounded text-white flex items-center justify-center shadow-sm ${isCancelled ? 'bg-gray-400' : 'bg-gray-800'}`}>
                            <span className="material-symbols-outlined text-sm">receipt_long</span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-gray-800 text-[11px] leading-tight truncate">โพยหวย #{ticket.id.substring(0, 8)}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isCancelled ? (
                                <span className="bg-red-100 text-red-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-tighter">ยกเลิกแล้ว</span>
                              ) : (
                                <span className="bg-green-100 text-green-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-green-200 uppercase tracking-tighter">รอลุ้นผล</span>
                              )}
                              {!isExpired && !isCancelled && (
                                <div className="text-[9px] font-bold text-red-500 flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[10px] animate-pulse">timer</span> {formatRemainingTime(ticket.expiresAt)}
                                </div>
                              )}
                            </div>
                            {isCancelled && (
                              <div className="text-[9px] font-bold text-red-600 flex items-center gap-0.5 mt-0.5">
                                <span className="material-symbols-outlined text-[10px]">payments</span> คืนเครดิตเข้าบัญชีแล้ว
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[9px] font-black text-gray-500 uppercase leading-none mb-0.5">ยอดรวม</div>
                          <div className={`text-sm font-black leading-none ${isCancelled ? 'text-gray-400 line-through' : 'text-blue-600'}`}>฿{ticket.totalAmount.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-2 pt-2 relative">
                        {/* Grouped Bets display */}
                        <div className="space-y-1.5 mb-2 mt-1">
                          {Object.entries(
                            ((ticket.bets as any[]) || []).reduce((acc: any, bet: any) => {
                              if (!acc[bet.type]) acc[bet.type] = [];
                              acc[bet.type].push(bet);
                              return acc;
                            }, {} as Record<string, any[]>)
                          ).map(([type, typeBets]) => {
                            const typeTotal = (typeBets as any[]).reduce((sum, b) => sum + b.amount, 0);
                            return (
                              <div key={type} className={`text-[11px] p-1.5 rounded border ${isCancelled ? 'bg-gray-100/50 border-gray-200 text-gray-500' : 'bg-[#fcfbf7] border-[#eeddcc] text-gray-800'}`}>
                                <div className="flex justify-between items-center mb-1 font-bold border-b border-dashed border-gray-200 pb-0.5">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${isCancelled ? 'bg-gray-200 text-gray-600' : 'bg-[var(--gold-vibrant)] text-[var(--navy-deep)]'}`}>{type}</span>
                                  <span className="text-[10px] text-gray-500 font-bold">รวม ฿{typeTotal}</span>
                                </div>
                                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                                  {(typeBets as any[]).map((b, bIdx) => (
                                    <span key={bIdx} className="font-mono font-bold">
                                      {b.number}<span className="text-red-500 font-black">={b.amount}</span>
                                      {bIdx < (typeBets as any[]).length - 1 && <span className="text-gray-300 ml-1.5">|</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Interactive Bill Buttons */}
                        <div className="grid grid-cols-2 gap-1 mt-2.5">
                          <button 
                            onClick={() => setSelectedTicketForBill(ticket)}
                            className="py-1 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded text-[10px] font-black flex items-center justify-center gap-1 transition-all"
                          >
                            <span className="material-symbols-outlined text-xs">receipt_long</span> แสดงบิลแยก
                          </button>
                          <button 
                            onClick={() => copyTicketAsBillText(ticket)}
                            className="py-1 bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 rounded text-[10px] font-black flex items-center justify-center gap-1 transition-all"
                          >
                            <span className="material-symbols-outlined text-xs">content_copy</span> คัดลอกบิลส่งไลน์
                          </button>
                        </div>

                        <div className="mt-1.5">
                          {!isCancelled && (
                            !isExpired ? (
                              <button 
                                onClick={() => cancelTicket(ticket.id, ticket.totalAmount)}
                                className="w-full py-1.5 bg-[#cc0000] text-white rounded text-[11px] font-bold hover:bg-red-700 transition flex items-center justify-center gap-1 shadow-sm"
                              >
                                <span className="material-symbols-outlined text-xs">cancel</span> ยกเลิกโพย
                              </button>
                            ) : (
                              <div className="w-full py-1 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-bold flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-xs">check_circle</span> ผ่านช่วงเวลายกเลิกแล้ว
                              </div>
                            )
                          )}
                          {isCancelled && (
                            <div className="w-full py-1 bg-gray-100 text-gray-500 border border-gray-200 rounded text-[10px] font-black flex items-center justify-center gap-1 italic uppercase tracking-widest">
                              <span className="material-symbols-outlined text-xs">block</span> CANCELLED
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

                 const typesToShow = isThaiLottery 
                   ? defaultRates 
                   : defaultRates.filter(r => r.type !== '3 ตัวล่าง' && !r.type.startsWith('4 ตัว') && !r.type.startsWith('5 ตัว'));

                 return typesToShow.map((item, index) => {
                   const rate = lotteryConfig?.rates?.[item.type] || item.rate;
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
                            payoutRate = blockInfo.customPayoutRate;
                            isReduced = true;
                          } else if (blockInfo.restrictionType === 'special') {
                            payoutRate = blockInfo.customPayoutRate;
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

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/70 z-[250] flex items-center justify-center p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[320px] overflow-hidden border-t-8 border-[#cc0000]"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-100">
                <span className="material-symbols-outlined text-4xl text-[#cc0000]">delete_sweep</span>
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-2">ยกเลิกรายการทั้งหมด?</h3>
              <p className="text-sm text-gray-500 font-bold leading-relaxed">
                คุณต้องการ <span className="text-[#cc0000] text-lg px-1">ล้างรายการแทงทั้งหมด</span> ในตะกร้าใช่หรือไม่?
                <br />
                <span className="text-xs text-gray-400 font-medium">*การดำเนินการนี้ไม่สามารถเรียกคืนได้</span>
              </p>
            </div>
            
            <div className="flex border-t border-gray-100">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-4 text-gray-500 font-bold text-sm bg-gray-50 hover:bg-gray-100 transition-colors border-r border-gray-100 outline-none"
              >
                ไม่ยกเลิก
              </button>
              <button 
                onClick={executeClearAllBets}
                className="flex-[1.5] py-4 bg-[#cc0000] text-white font-black text-sm hover:bg-red-700 transition-all active:scale-[0.98] outline-none shadow-inner"
              >
                ยืนยันยกเลิกทั้งหมด
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Duplicate Confirmation Modal */}
      {showDupConfirm !== null && (
        <div className="fixed inset-0 bg-black/70 z-[250] flex items-center justify-center p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[320px] overflow-hidden border-t-8 border-[#cc0000]"
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-100">
                <span className="material-symbols-outlined text-4xl text-[#cc0000] animate-pulse">content_copy</span>
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-2">พบรายการซ้ำ!</h3>
              <p className="text-sm text-gray-500 font-bold leading-relaxed">
                ระบบตรวจพบรายการแทงซ้ำกัน <span className="text-[#cc0000] text-lg px-1">{showDupConfirm}</span> รายการ
                <br />
                ต้องการรวมยอดเงินและตัดรายการส่วนเกินออกหรือไม่?
              </p>
            </div>
            
            <div className="flex border-t border-gray-100">
              <button 
                onClick={() => setShowDupConfirm(null)}
                className="flex-1 py-4 text-gray-500 font-bold text-sm bg-gray-50 hover:bg-gray-100 transition-colors border-r border-gray-100 outline-none"
              >
                ยกเลิก
              </button>
              <button 
                onClick={executeRemoveDuplicates}
                className="flex-[1.5] py-4 bg-[#cc0000] text-white font-black text-sm hover:bg-red-700 transition-all active:scale-[0.98] outline-none shadow-inner"
              >
                ยืนยันตัดเลขซ้ำ
              </button>
            </div>
          </motion.div>
        </div>
      )}

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

      {/* Final Receipt Modal */}
      {showSuccessReceipt && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden flex flex-col relative animate-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 duration-200 border-2 border-[#107c10]">
              
              {/* Receipt Header */}
              <div className="bg-[#107c10] p-4 text-white text-center pb-8 relative">
                 <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg">
                   <span className="material-symbols-outlined text-4xl text-[#107c10]">check_circle</span>
                 </div>
                 <h2 className="text-xl font-black">ส่งโพยสำเร็จ</h2>
                 <p className="text-xs text-green-100 font-medium opacity-80 mt-1">ตัดเครดิตและบันทึกโพยเข้าระบบแล้ว</p>
                 
                 {/* Receipt Zigzag top part simulation */}
                 <div className="absolute -bottom-2 left-0 right-0 h-4 bg-white" style={{ clipPath: 'polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)' }}></div>
              </div>
              
              {/* Receipt Body */}
              <div className="px-6 pb-6 pt-2 bg-white space-y-4 relative">
                 <div className="text-center border-b border-dashed border-gray-300 pb-4">
                    <div className="text-lg font-black text-[var(--navy-deep)] mb-1">{showSuccessReceipt.displayName}</div>
                    <div className="text-xl sm:text-2xl md:text-3xl font-black text-red-600 bg-red-50 py-2 px-3 rounded-lg my-2 border border-red-100 max-w-full overflow-hidden truncate">
                      ฿ {showSuccessReceipt.total.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </div>
                 </div>

                 <div className="space-y-2 text-sm mt-3 border-b border-gray-200 pb-3">
                     <div className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                         <span className="text-gray-500 font-bold">รหัสบิล</span>
                         <span className="font-mono font-black text-blue-700 tracking-wider">
                           {showSuccessReceipt.ticketId}
                         </span>
                     </div>
                     <div className="flex justify-between items-center py-1">
                         <span className="text-gray-500 font-bold">เวลาทำรายการ</span>
                         <span className="font-bold text-gray-700">{new Date(showSuccessReceipt.date).toLocaleString('th-TH')}</span>
                     </div>
                     <div className="flex justify-between items-center py-1">
                         <span className="text-gray-500 font-bold">ชื่อผู้ซื้อ</span>
                         <span className="font-bold text-gray-700">{showSuccessReceipt.customerName}</span>
                     </div>
                 </div>

                 {/* Bet List */}
                 <div>
                    <div className="text-[11px] font-bold text-gray-400 mb-2">รายการแทง ({showSuccessReceipt.bets.length} รายการ)</div>
                    <div className="max-h-32 overflow-y-auto pr-1">
                       {showSuccessReceipt.bets.map((bet, idx) => (
                           <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                               <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-400 w-4">{idx + 1}.</span>
                                  <span className="text-xs font-bold text-gray-700 w-16">{bet.type}</span>
                                  <span className="text-sm font-black text-[var(--navy-deep)]">{bet.number}</span>
                               </div>
                               <div className="text-xs font-bold text-red-600">
                                  {bet.amount} ฿
                               </div>
                           </div>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-2">
                  <button 
                     onClick={() => copyTicketAsBillText(showSuccessReceipt)}
                     className="flex-1 py-3 bg-blue-600 text-white font-black rounded-lg hover:bg-blue-700 transition shadow outline-none flex items-center justify-center gap-1.5 text-xs"
                  >
                     <span className="material-symbols-outlined text-[18px]">content_copy</span>
                     คัดลอกบิล
                  </button>
                  <button 
                     onClick={() => setShowSuccessReceipt(null)}
                     className="flex-1 py-3 bg-[var(--navy-deep)] text-[var(--gold-vibrant)] font-black rounded-lg hover:bg-black transition shadow outline-none flex items-center justify-center gap-1.5 text-xs"
                  >
                     <span className="material-symbols-outlined text-[18px]">close</span>
                     ปิดบิล (เริ่มแทงใหม่)
                  </button>
              </div>
           </div>
        </div>
      )}
    </>
  );
}
