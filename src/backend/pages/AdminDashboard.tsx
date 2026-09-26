import { useState, useEffect, useMemo } from 'react';
import { db } from '@/shared/lib/firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, setDoc, getDoc, addDoc, deleteDoc, limit, getDocs, where } from 'firebase/firestore';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { Link } from 'react-router-dom';
import MoneyCard from '@/shared/components/MoneyCard';
import StaffPermission from './StaffPermission';
import Can, { NoAccess } from '@/shared/components/Can';
import {
  PERMISSIONS, ROLES, ROLE_LIST, ALL_PERMISSIONS, effectivePermissions, saveSession, clearSession, loadSession,
  type Permission, type StaffSession, type RoleKey,
} from '@/shared/lib/permissions';
import StatusBadge from '@/shared/components/StatusBadge';
import DataToolbar, { searchIn, filterByDate, sortItems, exportCsv, type ViewMode } from '@/shared/components/DataToolbar';
import {
  recordSettingsChange, recordSettingsChanges, fetchSettingsHistory,
  prettyValue, didChange, getPinInfo, setPin,
} from '@/shared/lib/settingsHistory';

type AdminTab = 'overview' | 'agents' | 'members' | 'settings' | 'reports' | 'finance' | 'rules' | 'popup' | 'api' | 'history' | 'staff';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState('lottery');
  const [activeReportsSubTab, setActiveReportsSubTab] = useState('lottery');
  const [activeMembersSubTab, setActiveMembersSubTab] = useState<'users' | 'agents'>('users');
  const [autoBlockCount, setAutoBlockCount] = useState(50);
  const [rulesContent, setRulesContent] = useState('');
  const [popupContent, setPopupContent] = useState({ title: '', body: '', imageUrl: '', active: false });
  const [apiKeyStatus, setApiKeyStatus] = useState({ connected: true, lastCheck: new Date().toISOString() });
  const [users, setUsers] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [lotterySettings, setLotterySettings] = useState<any>({});
  const [medianRates, setMedianRates] = useState<any>({});
  const [closedNumbers, setClosedNumbers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [lotteryResults, setLotteryResults] = useState<any[]>([]);
  const [apiTenants, setApiTenants] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>({
    minBet: 1,
    maxBetPerUser: 100,
    maxBetSystem: 1000,
    maxIntake: 10000,
    progressionEnabled: true,
    masterBalance: 150000000,
    maxBalanceLimit: 150000000,
    taxEnabled: false,
    taxRate: 1.0,
    taxType: 'winnings',
    minTaxThreshold: 0,
    taxLabel: 'ภาษีหัก ณ ที่จ่าย (Withholding Tax)'
  });
  const [taxSimBetAmount, setTaxSimBetAmount] = useState<number>(1000);
  const [taxSimWinAmount, setTaxSimWinAmount] = useState<number>(90000);
  const [loading, setLoading] = useState(true);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  // ★ session สิทธิ์ของพนักงานที่ล็อกอินอยู่ — อ่านจาก localStorage ตั้งแต่ render แรก
  const [session, setSession] = useState<StaffSession | null>(() => loadSession());

  /** จำนวนสิทธิ์ทั้งหมดในระบบ (ใช้แสดงแถบความคืบหน้า) */
  const ALL_PERMISSIONS_COUNT = ALL_PERMISSIONS.length;

  /** ตรวจสิทธิ์ — คืน true ถ้ามี */
  const has = (perm: Permission) => effectivePermissions(session).has(perm);

  useEffect(() => {
    // ★ ตรวจ session ใหม่ (JSON) ก่อน — รองรับระบบเดิมอัตโนมัติใน loadSession()
    const sess = loadSession();
    if (sess) {
      setSession(sess);
      setIsAdminLoggedIn(true);
      return;
    }
    // fallback ระบบเดิม
    const role = localStorage.getItem('userRole');
    if (localStorage.getItem('adminAuth') === 'true' || role === 'admin' || role === 'agent') {
      setSession(loadSession());
      setIsAdminLoggedIn(true);
    }
  }, []);

  // Credit Management State
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [selectedUserForCredit, setSelectedUserForCredit] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditAction, setCreditAction] = useState<'add' | 'reduce'>('add');

  // User History State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedUserForHistory, setSelectedUserForHistory] = useState<any>(null);

  // Result Settlement State
  const toLocalYYYYMMDD = (date: Date | string) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const generateRandomBlocked = async (lottery: string, type: string, count: number, rate: number) => {
    const is3Digit = type.includes('3 ตัว');
    const max = is3Digit ? 1000 : 100;
    const allNums = Array.from({ length: max }, (_, i) => String(i).padStart(is3Digit ? 3 : 2, '0'));
    
    // Sort randomly
    const shuffled = allNums.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    for (const num of selected) {
      await addDoc(collection(db, 'blocked_numbers'), {
        lotteryType: lottery,
        betType: type,
        number: num,
        restrictionType: 'reduced',
        customPayoutRate: rate,
        createdAt: new Date().toISOString()
      });
    }
    alert(`สุ่มเลขลดราคา ${selected.length} รายการ สำหรับ ${type} เรียบร้อยแล้ว`);
  };

  const [selectedLotteryType, setSelectedLotteryType] = useState('หวยรัฐบาลไทย');
  const [resultDate, setResultDate] = useState<string>(toLocalYYYYMMDD(new Date()));
  const [result3Top, setResult3Top] = useState('');
  const [result2Bottom, setResult2Bottom] = useState('');
  const [result3Bottom, setResult3Bottom] = useState('');
  const [result3Front, setResult3Front] = useState('');
  const [calculatedWinners, setCalculatedWinners] = useState<any[]>([]);
  const [calculationSummary, setCalculationSummary] = useState<any>(null);
  const [isSettling, setIsSettling] = useState(false);

  // Lottery Session Management
  const [showRoundModal, setShowRoundModal] = useState(false);
  const [showAddLotteryModal, setShowAddLotteryModal] = useState(false);
  const [newLotteryName, setNewLotteryName] = useState('');
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentUsername, setNewAgentUsername] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [newAgentLocation, setNewAgentLocation] = useState('');
  const [newAgentCredit, setNewAgentCredit] = useState(100000);
  const [newAgentShare, setNewAgentShare] = useState(80);
  
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [selectedAgentForTopup, setSelectedAgentForTopup] = useState<any>(null);
  const [topupAmount, setTopupAmount] = useState(0);

  const [showEditAgentModal, setShowEditAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);

  const [copiedKey, setCopiedKey] = useState('');
  const [selectedLotteryForRound, setSelectedLotteryForRound] = useState('');
  const [newRoundOpen, setNewRoundOpen] = useState('');
  const [newRoundClose, setNewRoundClose] = useState('');
  const [newRoundResult, setNewRoundResult] = useState('');
  const [closingTimes, setClosingTimes] = useState<Record<string, string>>({});
  const [currentTime, setCurrentTime] = useState(Date.now());

  const defaultRates = {
    '3 ตัวบน': 900,
    '3 ตัวโต๊ด': 150,
    '3 ตัวหน้า': 450,
    '3 ตัวล่าง': 450,
    '2 ตัวบน': 90,
    '2 ตัวล่าง': 90,
    '2 ตัวโต๊ด': 12,
    'วิ่งบน': 3.2,
    'วิ่งล่าง': 4.2,
    '4 ตัวบน': 5000,
    '5 ตัวบน': 50000,
    '6 ตัวบน': 500000
  };

  // Payout Config Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedPayoutLottery, setSelectedPayoutLottery] = useState('');

  // Blocked Numbers Management
  const [blockedNumbersList, setBlockedNumbersList] = useState<any[]>([]);
  const [blockLotteryType, setBlockLotteryType] = useState('หวยรัฐบาลไทย');
  const [blockNumbersBulk, setBlockNumbersBulk] = useState('');
  const [blockBetType, setBlockBetType] = useState('3 ตัวบน');
  const [restrictionType, setRestrictionType] = useState('blocked'); // 'blocked', 'reduced', 'special'
  const [customPayoutRate, setCustomPayoutRate] = useState('');
  const [applyBlockToAllLotteries, setApplyBlockToAllLotteries] = useState(false);

  // Date Filtering State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  /* ==================================================================
   * ★ สถานะของแท็บ "ประวัติ & รหัส" (history)
   * ================================================================== */
  /** มุมมอง: table | chart */
  const [historyView, setHistoryView] = useState<ViewMode>('table');
  /** ประวัติการตั้งค่าที่โหลดมา */
  const [settingsHistory, setSettingsHistory] = useState<any[]>([]);
  /** กำลังโหลดประวัติ */
  const [loadingHistory, setLoadingHistory] = useState(false);
  /** กรองหมวดในประวัติ */
  const [historyCategory, setHistoryCategory] = useState<string>('');
  /** ขยายตาราง */
  const [historyExpanded, setHistoryExpanded] = useState(false);
  /** เรียงลำดับ */
  const [historySort, setHistorySort] = useState<string>('timestamp_desc');
  /** สลับแท็บย่อยในหน้า history */
  const [historySubTab, setHistorySubTab] = useState<'settings' | 'credential' | 'adminlog'>('settings');

  // ---- ฟอร์มเปลี่ยนรหัส ----
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pinInfo, setPinInfo] = useState<{ configured: boolean; version: number; updatedAt: string | null; updatedBy: string | null }>({
    configured: false, version: 0, updatedAt: null, updatedBy: null,
  });

  /** โหลดประวัติการตั้งค่า + ข้อมูลรหัส */
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const [hist, info] = await Promise.all([
        fetchSettingsHistory({ max: 200 }),
        getPinInfo(),
      ]);
      setSettingsHistory(hist);
      setPinInfo(info);
    } catch (e) {
      console.error('โหลดประวัติไม่สำเร็จ', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // โหลดเมื่อเปิดแท็บ history
  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab]);

  /** เปลี่ยนรหัสเข้าใช้งาน */
  const handleChangePin = async () => {
    setPinMsg(null);
    if (pinNew !== pinConfirm) {
      setPinMsg({ ok: false, text: 'รหัสใหม่ทั้งสองช่องไม่ตรงกัน' });
      return;
    }
    if (!/^\d{4,12}$/.test(pinNew)) {
      setPinMsg({ ok: false, text: 'รหัสต้องเป็นตัวเลข 4-12 หลัก' });
      return;
    }
    setPinBusy(true);
    try {
      const res = await setPin(pinNew, pinCurrent || undefined, 'Super Admin');
      setPinMsg({ ok: res.ok, text: res.message });
      if (res.ok) {
        setPinCurrent(''); setPinNew(''); setPinConfirm('');
        await loadHistory();
      }
    } catch (e: any) {
      setPinMsg({ ok: false, text: 'เปลี่ยนรหัสไม่สำเร็จ: ' + (e?.message || e) });
    } finally {
      setPinBusy(false);
    }
  };

  /** ประวัติที่ผ่านการกรองแล้ว */
  const filteredHistory = useMemo(() => {
    let list = settingsHistory;
    if (historyCategory) list = list.filter(h => h.category === historyCategory);
    list = filterByDate(list, startDate, endDate, 'timestamp');
    list = searchIn(list, searchQuery, ['key', 'admin', 'note', 'before', 'after', 'category']);
    return sortItems(list, historySort);
  }, [settingsHistory, historyCategory, startDate, endDate, searchQuery, historySort]);

  /* ==================================================================
   * ★ สถานะเครื่องมือกรอง สำหรับแท็บรายงาน/การเงิน
   * ------------------------------------------------------------------
   * ตอบโจทย์ "ลูกเล่นฟังชั่นซ้อนช่วยการค้นหา ขยาย รายงาน ดูกราฟ"
   * ================================================================== */
  /** มุมมองการเงิน */
  const [financeView, setFinanceView] = useState<ViewMode>('table');
  /** ขยายตารางการเงิน */
  const [financeExpanded, setFinanceExpanded] = useState(false);
  /** กรองสถานะธุรกรรม (เลือกหลายค่า) */
  const [financeStatuses, setFinanceStatuses] = useState<string[]>([]);
  /** เรียงลำดับธุรกรรม */
  const [financeSort, setFinanceSort] = useState<string>('createdAt_desc');

  /** มุมมองรายงาน */
  const [reportsView, setReportsView] = useState<ViewMode>('table');
  /** ขยายตารางรายงาน */
  const [reportsExpanded, setReportsExpanded] = useState(false);
  /** เรียงลำดับรายงาน */
  const [reportsSort, setReportsSort] = useState<string>('bet_desc');

  /** มุมมองสมาชิก */
  const [membersView, setMembersView] = useState<ViewMode>('table');
  const [membersExpanded, setMembersExpanded] = useState(false);
  const [membersStatuses, setMembersStatuses] = useState<string[]>([]);
  const [membersSort, setMembersSort] = useState<string>('createdAt_desc');

  

  /* ---- สมาชิกที่กรองแล้ว ---- */
  const filteredUsers = useMemo(() => {
    let list = users;
    if (membersStatuses.length > 0) {
      list = list.filter(u => membersStatuses.includes(String(u.status || 'active')));
    }
    list = searchIn(list, searchQuery, ['username', 'phoneNumber', 'role', 'id', 'uid']);
    return sortItems(list, membersSort);
  }, [users, membersStatuses, searchQuery, membersSort]);

  const filteredAgents = useMemo(() => {
    let list = agents;
    if (membersStatuses.length > 0) {
      list = list.filter(a => membersStatuses.includes(String(a.status || 'active')));
    }
    list = searchIn(list, searchQuery, ['username', 'name', 'phone', 'id']);
    return sortItems(list, membersSort);
  }, [agents, membersStatuses, searchQuery, membersSort]);



  /** สรุปประวัติแยกตามหมวด (สำหรับกราฟ) */
  const historyByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredHistory.forEach(h => {
      const c = String(h.category || 'other');
      map[c] = (map[c] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredHistory]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      
      // Process automated rounds
      Object.keys(lotterySettings).forEach(async (type) => {
        const session = lotterySettings[type];
        if (!session?.rounds || session.rounds.length === 0) return;

        let shouldBeOpen = false;
        let newClosingTime = session.closingTime;
        let isPaused = false;

        // Check if any previous round is pending result
        const pendingResultRound = session.rounds.find((r: any) => 
          r.status === 'pending' && now >= new Date(r.resultTime).getTime()
        );

        if (pendingResultRound) {
          isPaused = true;
        }

        if (!isPaused) {
          const activeRound = session.rounds.find((r: any) => 
            now >= new Date(r.openTime).getTime() && now < new Date(r.closeTime).getTime()
          );

          if (activeRound) {
            shouldBeOpen = true;
            newClosingTime = activeRound.closeTime;
          }
        }

        // Only update if state changed
        if (session.isOpen !== shouldBeOpen || session.closingTime !== newClosingTime || session.isPaused !== isPaused) {
          try {
            await setDoc(doc(db, 'lotteryTypes', type), {
              isOpen: shouldBeOpen,
              closingTime: newClosingTime,
              isPaused: isPaused
            }, { merge: true });
          } catch (e) {
            console.error('Failed to update automated round:', e);
          }
        }
      });
    }, 5000); // Check every 5 seconds
    return () => clearInterval(timer);
  }, [lotterySettings]);

  useEffect(() => {
    // ★ ตรวจ session สิทธิ์ (แทน adminAuth แบบ boolean เดิม)
    const sess = loadSession();
    if (sess) {
      setSession(sess);
      setIsAdminLoggedIn(true);
    }

    // Listen to users
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to agents
    const qAgents = query(collection(db, 'agents'), orderBy('createdAt', 'desc'));
    const unsubscribeAgents = onSnapshot(qAgents, (snapshot) => {
      setAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to tickets
    const qTickets = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));
    const unsubscribeTickets = onSnapshot(qTickets, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // Listen to settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) setGlobalSettings(doc.data());
    });

    // Listen to lottery types
    const unsubscribeLottery = onSnapshot(collection(db, 'lotteryTypes'), (snapshot) => {
      const types: any = {};
      const medians: any = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        types[doc.id] = data;
        medians[doc.id] = data.medianRates || defaultRates;
      });
      setLotterySettings(types);
      setMedianRates(medians);
    });

    // Listen to admin logs
    const qLogs = query(collection(db, 'adminLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      setAdminLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to blocked numbers
    const unsubscribeBlocked = onSnapshot(collection(db, 'blocked_numbers'), (snapshot) => {
      setBlockedNumbersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to all transactions
    const qTransactions = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(500));
    const unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to API Tenants
    const unsubscribeApi = onSnapshot(collection(db, 'api_tenants'), (snapshot) => {
      setApiTenants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to lottery results
    const qResults = query(collection(db, 'lotteryResults'), orderBy('createdAt', 'desc'), limit(500));
    const unsubscribeResults = onSnapshot(qResults, (snapshot) => {
      setLotteryResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to rules
    const unsubscribeRules = onSnapshot(doc(db, 'settings', 'rules'), (doc) => {
      if (doc.exists()) setRulesContent(doc.data().content || '');
    });

    // Listen to popup
    const unsubscribePopup = onSnapshot(doc(db, 'settings', 'popup'), (doc) => {
      if (doc.exists()) setPopupContent(doc.data() as any);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeAgents();
      unsubscribeTickets();
      unsubscribeSettings();
      unsubscribeLottery();
      unsubscribeBlocked();
      unsubscribeLogs();
      unsubscribeTransactions();
      unsubscribeResults();
      unsubscribeRules();
      unsubscribePopup();
    };
  }, []);

  const logActivity = async (action: string, details: string, type: 'credit' | 'settings' | 'lottery' | 'system' | 'result' | 'agent' | 'security' | 'staff') => {
    try {
      await addDoc(collection(db, 'adminLogs'), {
        admin: session?.displayName || 'Admin',
        action,
        details,
        type,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('Logging failed:', e);
    }
  };

  const handleAddBlockedNumber = async () => {
    if (!blockNumbersBulk.trim()) {
      alert('กรุณาระบุตัวเลขที่ต้องการจัดการ');
      return;
    }
    
    // Default rate if not provided and it's 'blocked'
    if (!customPayoutRate && restrictionType !== 'blocked') {
      alert('กรุณาระบุอัตราจ่าย');
      return;
    }

    const rate = restrictionType === 'blocked' ? 0 : Number(customPayoutRate);
    const numbers = blockNumbersBulk.split(/[\s,]+/).filter(n => n.trim() !== '');
    
    const targetLotteries = applyBlockToAllLotteries 
      ? Object.keys(lotterySettings) 
      : [blockLotteryType];

    try {
      const promises: any[] = [];
      targetLotteries.forEach(lotType => {
        numbers.forEach(num => {
          promises.push(
            addDoc(collection(db, 'blocked_numbers'), {
              lotteryType: lotType,
              number: num,
              betType: blockBetType,
              restrictionType: restrictionType,
              customPayoutRate: rate,
              createdAt: new Date().toISOString()
            })
          );
        });
      });
      
      await Promise.all(promises);
      
      setBlockNumbersBulk('');
      setCustomPayoutRate('');
      alert(`จัดการเลข ${numbers.length} รายการ สำหรับ ${targetLotteries.length} หวย เรียบร้อยแล้ว`);
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const clearBlockedNumbers = async () => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบเลขกั้น/ลดจ่าย ทั้งหมดของ ${blockLotteryType}?`)) return;
    try {
      const q = query(
        collection(db, 'blocked_numbers'),
        where('lotteryType', '==', blockLotteryType)
      );
      const snap = await getDocs(q);
      const promises = snap.docs.map(d => deleteDoc(doc(db, 'blocked_numbers', d.id)));
      await Promise.all(promises);
      alert('ล้างข้อมูลเรียบร้อยแล้ว');
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาด');
    }
  };

  const handleRemoveBlockedNumber = async (id: string) => {
    if (window.confirm('ต้องการลบเลขอั้นนี้ใช่หรือไม่?')) {
      try {
        await deleteDoc(doc(db, 'blocked_numbers', id));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleClearAllBlockedNumbers = async (lotteryType: string, betType: string) => {
    if (window.confirm(`ยืนยันการล้างข้อมูล ${lotteryType} - ${betType} ทั้งหมด?\nเลขทั้งหมดจะกลับมาจ่าย 100% ตามปกติ`)) {
      try {
        const toDelete = blockedNumbersList.filter(b => b.lotteryType === lotteryType && b.betType === betType);
        const promises = toDelete.map(b => deleteDoc(doc(db, 'blocked_numbers', b.id)));
        await Promise.all(promises);
        alert('ล้างข้อมูลสำเร็จ');
      } catch (e) {
        console.error(e);
        alert('เกิดข้อผิดพลาดในการล้างข้อมูล');
      }
    }
  };

  const handleRandomizeNumbers = async () => {
    const countInput = document.getElementById('randomCountInput') as HTMLInputElement;
    const payoutInput = document.getElementById('randomPayoutInput') as HTMLInputElement;
    
    const count = parseInt(countInput?.value || '0');
    const rate = parseFloat(payoutInput?.value || '0');

    if (!count || count <= 0) {
      alert('กรุณาระบุจำนวนเลขที่ต้องการสุ่มให้ถูกต้อง');
      return;
    }
    if (!rate || rate <= 0) {
      alert('กรุณาระบุอัตราจ่ายใหม่');
      return;
    }

    const defaultRate = lotterySettings[blockLotteryType]?.rates?.[blockBetType] || 0;
    
    let calculatedRestrictionType = 'blocked';
    if (rate >= defaultRate) {
      calculatedRestrictionType = 'special';
    } else if (rate > defaultRate * 0.5) {
      calculatedRestrictionType = 'reduced';
    } else {
      calculatedRestrictionType = 'blocked';
    }

    // Determine possible numbers based on bet type
    let possibleNumbers: string[] = [];
    if (blockBetType.includes('3 ตัว')) {
      for (let i = 0; i <= 999; i++) possibleNumbers.push(String(i).padStart(3, '0'));
    } else if (blockBetType.includes('2 ตัว')) {
      for (let i = 0; i <= 99; i++) possibleNumbers.push(String(i).padStart(2, '0'));
    } else if (blockBetType.includes('วิ่ง')) {
      for (let i = 0; i <= 9; i++) possibleNumbers.push(String(i));
    } else {
      alert('ไม่สามารถสุ่มเลขสำหรับประเภทการแทงนี้ได้');
      return;
    }

    // Filter out already blocked numbers
    const existingNumbers = blockedNumbersList
      .filter(b => b.lotteryType === blockLotteryType && b.betType === blockBetType)
      .map(b => b.number);
    
    const availableNumbers = possibleNumbers.filter(n => !existingNumbers.includes(n));

    if (availableNumbers.length < count) {
      alert(`มีเลขว่างให้สุ่มเพียง ${availableNumbers.length} เลขเท่านั้น`);
      return;
    }

    // Randomly select numbers
    const selectedNumbers: string[] = [];
    const tempAvailable = [...availableNumbers];
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * tempAvailable.length);
      selectedNumbers.push(tempAvailable[randomIndex]);
      tempAvailable.splice(randomIndex, 1);
    }

    try {
      const promises = selectedNumbers.map(num => 
        addDoc(collection(db, 'blocked_numbers'), {
          lotteryType: blockLotteryType,
          number: num,
          betType: blockBetType,
          restrictionType: calculatedRestrictionType,
          customPayoutRate: rate,
          createdAt: new Date().toISOString()
        })
      );
      await Promise.all(promises);
      
      if (countInput) countInput.value = '';
      if (payoutInput) payoutInput.value = '';
      
      alert(`สุ่มและเพิ่มข้อมูลสำเร็จ ${count} รายการ`);
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const updateGlobalSetting = async (key: string, value: any) => {
    try {
      const before = globalSettings?.[key];
      await setDoc(doc(db, 'settings', 'global'), { ...globalSettings, [key]: value }, { merge: true });
      await logActivity('แก้ไขการตั้งค่า', `เปลี่ยน ${key} เป็น ${value}`, 'settings');
      // ★ บันทึกประวัติการตั้งค่า (เฉพาะเมื่อค่าเปลี่ยนจริง)
      if (didChange(before, value)) {
        await recordSettingsChange({
          category: 'system',
          key,
          before,
          after: value,
          admin: 'Super Admin',
          note: 'แก้ไขค่าตั้งค่าระบบ',
        });
      }
    } catch (e) {
      console.error('Failed to update setting:', e);
    }
  };

  const saveAllSettings = async () => {
    try {
      // ★ เทียบค่าเดิมกับค่าใหม่ เพื่อบันทึกเฉพาะที่เปลี่ยน
      const snap = await getDoc(doc(db, 'settings', 'global'));
      const before = snap.exists() ? snap.data() : {};
      const changes: Array<{ key: string; before: any; after: any }> = [];
      for (const k of Object.keys(globalSettings || {})) {
        if (didChange((before as any)?.[k], (globalSettings as any)[k])) {
          changes.push({ key: k, before: (before as any)?.[k], after: (globalSettings as any)[k] });
        }
      }

      await setDoc(doc(db, 'settings', 'global'), globalSettings, { merge: true });
      await logActivity('แก้ไขการตั้งค่า', `อัปเดตขีดจำกัดระบบ (${changes.length} รายการ)`, 'settings');

      // ★ บันทึกประวัติทุกค่าที่เปลี่ยน
      if (changes.length > 0) {
        await recordSettingsChanges(changes.map(c => ({
          category: 'system',
          key: c.key,
          before: c.before,
          after: c.after,
          admin: 'Super Admin',
          note: 'บันทึกการตั้งค่าทั้งหมด',
        })));
      }

      alert(changes.length > 0
        ? `บันทึกสำเร็จ (${changes.length} รายการที่เปลี่ยน)`
        : 'บันทึกสำเร็จ (ไม่มีค่าใดเปลี่ยน)');
    } catch (e) {
      console.error(e);
      alert('บันทึกไม่สำเร็จ');
    }
  };

  const saveRules = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'rules'));
      const before = snap.exists() ? (snap.data() as any)?.content : '';
      await setDoc(doc(db, 'settings', 'rules'), { content: rulesContent, updatedAt: new Date().toISOString() });
      await logActivity('แก้ไขกติกา', 'อัปเดตกติกาการเล่น', 'settings');
      // ★ บันทึกประวัติ
      if (didChange(before, rulesContent)) {
        await recordSettingsChange({
          category: 'lottery',
          key: 'กติกาการเล่น',
          before: `${String(before || '').length} ตัวอักษร`,
          after: `${String(rulesContent || '').length} ตัวอักษร`,
          admin: 'Super Admin',
          note: 'แก้ไขเนื้อหากติกาการเล่น',
        });
      }
      alert('บันทึกกติกาเรียบร้อยแล้ว');
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  const savePopup = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'popup'));
      const before = snap.exists() ? snap.data() : {};
      await setDoc(doc(db, 'settings', 'popup'), { ...popupContent, updatedAt: new Date().toISOString() });
      await logActivity('แก้ไขป๊อปอัพ', 'อัปเดตระบบป๊อปอัพ', 'settings');

      // ★ บันทึกประวัติทุกค่าที่เปลี่ยน
      const changes: Array<{ key: string; before: any; after: any }> = [];
      for (const k of Object.keys(popupContent || {})) {
        if (didChange((before as any)?.[k], (popupContent as any)[k])) {
          changes.push({ key: k, before: (before as any)?.[k], after: (popupContent as any)[k] });
        }
      }
      if (changes.length > 0) {
        await recordSettingsChanges(changes.map(c => ({
          category: 'system',
          key: `ป๊อปอัพ.${c.key}`,
          before: c.before,
          after: c.after,
          admin: 'Super Admin',
          note: 'แก้ไขระบบป๊อปอัพ',
        })));
      }
      alert('บันทึกป๊อปอัพเรียบร้อยแล้ว');
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  const handleAdminLogin = async () => {
    try {
      // 1) ★ ลองหาพนักงานใน collection 'staff' ก่อน
      const { getDocs, query, where, collection: col } = await import('firebase/firestore');
      const snap = await getDocs(query(col(db, 'staff'), where('username', '==', adminUser.trim())));
      if (!snap.empty) {
        const s: any = { id: snap.docs[0].id, ...snap.docs[0].data() };
        if (s.status === 'suspended') { alert('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ'); return; }
        const sess: StaffSession = {
          uid: s.id,
          username: s.username,
          displayName: s.displayName || s.username,
          role: (s.role || 'staff') as RoleKey,
          grantedExtra: s.grantedExtra || [],
          revoked: s.revoked || [],
          scopeProjectIds: s.scopeProjectIds || [],
        };
        saveSession(sess);
        setSession(sess);
        setIsAdminLoggedIn(true);
        await setDoc(doc(db, 'staff', s.id), { lastLogin: new Date().toISOString() }, { merge: true });
        await logActivity('เข้าสู่ระบบ', `พนักงาน ${sess.displayName} (${ROLES[sess.role]?.label || sess.role})`, 'security');
        return;
      }
    } catch (e) {
      console.warn('[login] staff lookup failed, falling back:', e);
    }

    // 2) fallback: บัญชีผู้ดูแลหลัก (ระบบเดิม)
    if (adminUser === '1234' && adminPass === '12345678') {
      const sess: StaffSession = {
        uid: 'owner', username: '1234', displayName: 'ผู้ดูแลระบบ', role: 'owner',
      };
      saveSession(sess);
      setSession(sess);
      setIsAdminLoggedIn(true);
      await logActivity('เข้าสู่ระบบ', 'ผู้ดูแลระบบหลัก', 'security');
    } else {
      alert('Username หรือ รหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setIsAdminLoggedIn(false);
  };

  const toggleLotteryStatus = async (type: string, status: boolean) => {
    try {
      await setDoc(doc(db, 'lotteryTypes', type), { isOpen: status }, { merge: true });
      await logActivity(status ? 'เปิดรับแทง' : 'ปิดรับแทง', `เปลี่ยนสถานะ ${type} เป็น ${status ? 'เปิด' : 'ปิด'}`, 'lottery');
    } catch (e) { console.error(e); }
  };

  const toggleAllLotteryStatus = async (status: boolean) => {
    if(!window.confirm(`ระบบจะทำการ${status ? 'เปิด' : 'ปิด'}หวยทั้งหมดทุกประเภท คุณต้องการดำเนินการต่อหรือไม่?`)) return;
    try {
      const types = Object.keys(lotterySettings);
      await Promise.all(types.map(type => 
        setDoc(doc(db, 'lotteryTypes', type), { isOpen: status }, { merge: true })
      ));
      await logActivity(status ? 'เปิดหวยทั้งหมด' : 'ปิดหวยทั้งหมด', `เปลี่ยนสถานะหวยทุกประเภทเป็น ${status ? 'เปิด' : 'ปิด'}`, 'lottery');
      alert(`ทำรายการ${status ? 'เปิด' : 'ปิด'}หวยทั้งหมดสำเร็จแล้ว!`);
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะหวย');
    }
  };

  const updateLotterySession = async (type: string, closingTimeStr: string) => {
    try {
      const closingDate = new Date(closingTimeStr);
      if (isNaN(closingDate.getTime())) {
        alert('รูปแบบเวลาไม่ถูกต้อง');
        return;
      }
      await setDoc(doc(db, 'lotteryTypes', type), { 
        closingTime: closingDate.toISOString(),
        isOpen: true,
        isSettled: false
      }, { merge: true });
      await logActivity('เปิดรอบใหม่', `เปิดรอบ ${type} ปิดรับเวลา ${closingDate.toLocaleString()}`, 'lottery');
      alert(`เปิดรอบ ${type} สำเร็จ ปิดรับเวลา ${closingDate.toLocaleString()}`);
    } catch (e) { console.error(e); }
  };

  const hideLotteryFromUser = async (type: string, isHidden: boolean) => {
    try {
      await setDoc(doc(db, 'lotteryTypes', type), { isHidden }, { merge: true });
      await logActivity(isHidden ? 'ซ่อนหวย' : 'แสดงหวย', `${isHidden ? 'ซ่อน' : 'แสดง'} ${type} จากหน้าบ้าน`, 'lottery');
    } catch (e) { console.error(e); }
  };

  const syncAllLotteries = async () => {
    if(!window.confirm('ระบบจะเพิ่มประเภทหวยทั้งหมดที่ไม่มีอยู่ (38 รายการ) และบังคับเปิดรับแทงทุกหวยให้ปรากฎหน้าบ้าน ดำเนินการต่อหรือไม่?')) return;
    const initialLotteries = [
      'หวยรัฐบาล', 'ยี่กี 4D', 'หวยธกส.', 'หวยออมสิน',
      'หวยลาวประตูชัย', 'หวยลาวสันติภาพ', 'หวยประชาชนลาว', 'ลาว(EXTRA)',
      'หวยลาวTV', 'หวยลาวHD', 'หวยลาวสตาร์', 'ลาวกาชาด', 'หวยลาวสตาร์(VIP)',
      'ฮานอย(HD)', 'ฮานอยสตาร์', 'ฮานอยTV', 'ฮานอยกาชาด', 'ฮานอยพิเศษ',
      'ฮานอยสามัคคี', 'หวยฮานอย', 'ฮานอย(VIP)', 'ฮานอย(EXTRA)',
      'หวยมาเลย์', 'ดาวน์โจนส์ STAR',
      'หวยรัฐบาล (ชุด)', 'หวยฮานอยชุด', 'หวยลาวพัฒนาชุด',
      'นิเคอิ VIP (เช้า)', 'เวียดนาม VIP (เช้า)', 'จีน VIP (เช้า)', 'ฮั่งเส็ง VIP (เช้า)',
      'ไต้หวัน VIP', 'เกาหลี VIP',
      'นิเคอิ VIP (บ่าย)', 'เวียดนาม VIP (บ่าย)', 'จีน VIP (บ่าย)', 'ฮั่งเส็ง VIP (บ่าย)',
      'ลาว VIP'
    ];
    
    try {
      for (const name of initialLotteries) {
        const found = Object.values(lotterySettings).find((l: any) => l.name === name || l.id === name);
        if (!found) {
          await setDoc(doc(db, 'lotteryTypes', name), {
            name,
            isOpen: true,
            isHidden: false,
            createdAt: new Date().toISOString()
          });
        } else {
          await setDoc(doc(db, 'lotteryTypes', (found as any).id), {
            isOpen: true,
            isHidden: false
          }, { merge: true });
        }
      }
      alert('ซิงค์ข้อมูลหวยครบถ้วน สถานะเปิดแสดงหน้าบ้านทั้งหมดแล้ว');
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการซิงค์ข้อมูลหวย');
    }
  };

  const handleAddRound = async () => {
    if (!newRoundOpen || !newRoundClose || !newRoundResult) {
      alert('กรุณากรอกเวลาให้ครบถ้วน');
      return;
    }
    const session = lotterySettings[selectedLotteryForRound];
    const rounds = session?.rounds || [];
    if (rounds.length >= 5) {
      alert('สามารถเตรียมรอบล่วงหน้าได้สูงสุด 5 รอบ');
      return;
    }
    
    const newRound = {
      id: `RND-${Date.now()}`,
      openTime: newRoundOpen,
      closeTime: newRoundClose,
      resultTime: newRoundResult,
      status: 'pending'
    };
    
    try {
      await setDoc(doc(db, 'lotteryTypes', selectedLotteryForRound), {
        rounds: [...rounds, newRound].sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime())
      }, { merge: true });
      alert('เพิ่มรอบสำเร็จ');
      setNewRoundOpen('');
      setNewRoundClose('');
      setNewRoundResult('');
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาด');
    }
  };

  const handleRemoveRound = async (type: string, roundId: string) => {
    if (!window.confirm('ยืนยันการลบรอบนี้?')) return;
    const session = lotterySettings[type];
    const rounds = session?.rounds || [];
    try {
      await setDoc(doc(db, 'lotteryTypes', type), {
        rounds: rounds.filter((r: any) => r.id !== roundId)
      }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreditTransaction = async () => {
    if (!selectedUserForCredit || creditAmount <= 0) return;
    
    // Check Source of Funds (Agent or Master)
    const currentAgent = agents.find(a => a.id === selectedUserForCredit.agentId);
    const sourceName = currentAgent ? `เอเย่นต์ (${currentAgent.name})` : 'มาสเตอร์ (Master)';
    const sourceBalance = currentAgent ? (currentAgent.creditLimit || 0) : globalSettings.masterBalance;

    if (creditAction === 'add' && sourceBalance < creditAmount) {
      alert(`ยอด ${sourceName} ไม่เพียงพอสำหรับการเติมเงิน`);
      return;
    }

    if (window.confirm(`ยืนยันการ${creditAction === 'add' ? 'เติม' : 'ลด'}เครดิต จำนวน ฿${creditAmount.toLocaleString()} ให้กับ ${selectedUserForCredit.username}?`)) {
      try {
        const userRef = doc(db, 'users', selectedUserForCredit.id);
        const newBalance = creditAction === 'add' 
          ? (selectedUserForCredit.balance || 0) + creditAmount 
          : (selectedUserForCredit.balance || 0) - creditAmount;

        if (newBalance < 0 && creditAction === 'reduce') {
          alert('เครดิตสมาชิกไม่เพียงพอที่จะลด');
          return;
        }

        // Apply Balance Update to Member
        await updateDoc(userRef, { balance: newBalance });
        
        // Deduct/Add back to Source (Agent or Master)
        if (currentAgent) {
          const newAgentCredit = creditAction === 'add' ? sourceBalance - creditAmount : sourceBalance + creditAmount;
          await updateDoc(doc(db, 'agents', currentAgent.id), { creditLimit: newAgentCredit });
        } else {
          const newMasterBalance = creditAction === 'add' ? sourceBalance - creditAmount : sourceBalance + creditAmount;
          await updateGlobalSetting('masterBalance', newMasterBalance);
        }

        // Record formal financial transaction
        await addDoc(collection(db, 'transactions'), {
          userId: selectedUserForCredit.id,
          username: selectedUserForCredit.username,
          type: creditAction === 'add' ? 'admin_transfer' : 'admin_pullback',
          amount: creditAmount,
          status: 'success',
          createdAt: new Date().toISOString(),
          description: `${creditAction === 'add' ? 'เติมเครดิต' : 'ลดเครดิต'}โดยระบบ (${sourceName})`,
          adminId: 'Admin'
        });

        // Log Activity
        await logActivity(
          creditAction === 'add' ? 'เติมเครดิตสมาชิก' : 'ลดเครดิตสมาชิก',
          `${creditAction === 'add' ? 'เติม' : 'ลด'}เครดิตให้ ${selectedUserForCredit.username} จำนวน ฿${creditAmount.toLocaleString()} จาก ${sourceName}`,
          'credit'
        );

        alert('ทำรายการเครดิตสำเร็จ');
        setShowCreditModal(false);
        setCreditAmount(0);
      } catch (e) {
        console.error(e);
        alert('เกิดข้อผิดพลาด');
      }
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), { status });
      await logActivity('เปลี่ยนสถานะโพย', `เปลี่ยนโพย ${ticketId} เป็น ${status}`, 'lottery');
    } catch (e) { console.error(e); }
  };

  const updateUserStatus = async (userId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status });
      await logActivity('เปลี่ยนสถานะสมาชิก', `เปลี่ยนสมาชิก ${userId} เป็น ${status}`, 'system');
    } catch (e) { console.error(e); }
  };

  const calculateSettlement = () => {
    const currentLottery = lotterySettings[selectedLotteryType];
    const isClosed = currentLottery?.closingTime && new Date(currentLottery.closingTime).getTime() <= currentTime;

    if (!isClosed) {
      alert('ไม่สามารถออกผลได้ เนื่องจากยังไม่ถึงเวลาปิดรับแทง');
      return;
    }

    if (!result3Top || !result2Bottom) {
      alert('กรุณากรอกผลรางวัลให้ครบถ้วน');
      return;
    }

    const relevantTickets = tickets.filter(t => 
      (t.ticketType === selectedLotteryType || t.lotteryType === selectedLotteryType) && 
      (t.status === 'confirmed' || t.status === 'active' || (t.status === 'pending_cancellation' && new Date(t.expiresAt).getTime() <= currentTime))
    );

    const isTaxActive = Boolean(globalSettings.taxEnabled);
    const taxRatePercent = Number(globalSettings.taxRate || 0);
    const minThreshold = Number(globalSettings.minTaxThreshold || 0);

    let totalGrossPayout = 0;
    let totalTaxDeducted = 0;
    let totalNetPayout = 0;
    let totalIntake = relevantTickets.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const winners: any[] = [];

    relevantTickets.forEach(ticket => {
      let ticketGrossWin = 0;
      const winningBets: any[] = [];

      ticket.bets?.forEach((bet: any) => {
        let isWin = false;
        
        // Determine if bet wins based on bet.type
        if (bet.type === '3 ตัวบน') {
          isWin = bet.number === result3Top;
        } else if (bet.type === '3 ตัวโต๊ด') {
          const sortedBet = bet.number.split('').sort().join('');
          const sortedResult = result3Top.split('').sort().join('');
          isWin = sortedBet === sortedResult && bet.number !== result3Top;
        } else if (bet.type === '2 ตัวบน') {
          isWin = bet.number === result3Top.slice(-2);
        } else if (bet.type === '2 ตัวล่าง') {
          isWin = bet.number === result2Bottom;
        } else if (bet.type === 'วิ่งบน') {
          isWin = result3Top.includes(bet.number);
        } else if (bet.type === 'วิ่งล่าง') {
          isWin = result2Bottom.includes(bet.number);
        } else if (bet.type === '3 ตัวล่าง') {
          // result3Bottom can be multiple comma separated values
          isWin = result3Bottom.split(',').map(s => s.trim()).includes(bet.number);
        } else if (bet.type === '3 ตัวหน้า') {
          // result3Front can be multiple comma separated values
          isWin = result3Front.split(',').map(s => s.trim()).includes(bet.number);
        } else {
          // Fallback for simple digit matching if type is missing or unknown
          if (bet.number.length === 3 && bet.number === result3Top) {
            isWin = true;
          } else if (bet.number.length === 2 && bet.number === result2Bottom) {
            isWin = true;
          }
        }

        if (isWin) {
          // Use the bet's specific payout rate (which handles blocked/reduced/special)
          // Fallback to the lottery's default rate for that bet type
          const rate = bet.payoutRate || currentLottery?.rates?.[bet.type] || 0;
          const win = (bet.amount || bet.price || 0) * rate;
          ticketGrossWin += win;
          winningBets.push({ ...bet, winAmount: win, appliedRate: rate });
        }
      });

      if (ticketGrossWin > 0) {
        let taxAmount = 0;
        if (isTaxActive && taxRatePercent > 0 && ticketGrossWin >= minThreshold) {
          taxAmount = Math.round((ticketGrossWin * (taxRatePercent / 100)) * 100) / 100;
        }
        const netWinAmount = ticketGrossWin - taxAmount;

        totalGrossPayout += ticketGrossWin;
        totalTaxDeducted += taxAmount;
        totalNetPayout += netWinAmount;

        winners.push({
          ...ticket,
          grossWinAmount: ticketGrossWin,
          taxAmount,
          taxRate: isTaxActive ? taxRatePercent : 0,
          winAmount: isTaxActive ? netWinAmount : ticketGrossWin,
          netWinAmount,
          winningBets
        });
      }
    });

    setCalculatedWinners(winners);
    setCalculationSummary({
      totalIntake,
      totalGrossPayout,
      totalTaxDeducted,
      totalPayout: isTaxActive ? totalNetPayout : totalGrossPayout,
      profit: totalIntake - (isTaxActive ? totalNetPayout : totalGrossPayout),
      taxEnabled: isTaxActive,
      taxRate: taxRatePercent,
      ticketCount: relevantTickets.length,
      winnerCount: winners.length
    });
  };

  const confirmSettlement = async () => {
    if (!calculationSummary) return;
    const isTaxActive = Boolean(calculationSummary.taxEnabled);
    const payoutMsg = isTaxActive 
      ? `ยืนยันการออกผลรางวัล?\n- ยอดรางวัลรวม (Gross): ฿${calculationSummary.totalGrossPayout?.toLocaleString()}\n- หักภาษี (${calculationSummary.taxRate}%): -฿${calculationSummary.totalTaxDeducted?.toLocaleString()}\n- ยอดจ่ายสุทธิ (Net): ฿${calculationSummary.totalPayout?.toLocaleString()}`
      : `ยืนยันการออกผลรางวัลและจ่ายเงินรางวัลรวม ฿${calculationSummary.totalPayout.toLocaleString()}? (ระบบภาษี: ปิดอยู่)`;

    if (!window.confirm(payoutMsg)) return;

    setIsSettling(true);
    try {
      // 1. Save Result to History
      await addDoc(collection(db, 'lotteryResults'), {
        type: selectedLotteryType,
        result3Top,
        result2Bottom,
        result3Bottom,
        result3Front,
        summary: calculationSummary,
        createdAt: new Date().toISOString()
      });

      // 2. Update Tickets and User Balances
      for (const winner of calculatedWinners) {
        const finalWinAmount = winner.winAmount;
        await updateDoc(doc(db, 'tickets', winner.id), { 
          status: 'win', 
          winAmount: finalWinAmount,
          grossWinAmount: winner.grossWinAmount || finalWinAmount,
          taxAmount: winner.taxAmount || 0,
          taxRate: winner.taxRate || 0,
          settledAt: new Date().toISOString()
        });
        
        // Update user balance and record transaction
        const userRef = doc(db, 'users', winner.userId || 'demo_user');
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentBalance = userSnap.data().balance || 0;
          await updateDoc(userRef, { balance: currentBalance + finalWinAmount });

          const taxNote = winner.taxAmount > 0 
            ? ` (ภาษี ${winner.taxRate}%: -฿${winner.taxAmount.toLocaleString()}, จ่ายสุทธิ ฿${finalWinAmount.toLocaleString()})`
            : '';

          await addDoc(collection(db, 'transactions'), {
            userId: winner.userId || 'demo_user',
            username: winner.username || 'Demo User',
            type: 'win',
            amount: finalWinAmount,
            grossAmount: winner.grossWinAmount || finalWinAmount,
            taxAmount: winner.taxAmount || 0,
            taxRate: winner.taxRate || 0,
            status: 'success',
            createdAt: new Date().toISOString(),
            description: `ถูกรางวัลหวย ${selectedLotteryType}${taxNote}`
          });
        }
      }

      // Mark other relevant tickets as lost
      const relevantTickets = tickets.filter(t => 
        (t.ticketType === selectedLotteryType || t.lotteryType === selectedLotteryType) && 
        (t.status === 'confirmed' || t.status === 'active' || (t.status === 'pending_cancellation' && new Date(t.expiresAt).getTime() <= currentTime)) &&
        !calculatedWinners.find(w => w.id === t.id)
      );

      for (const ticket of relevantTickets) {
        await updateDoc(doc(db, 'tickets', ticket.id), { 
          status: 'lose',
          settledAt: new Date().toISOString()
        });
      }

      // Mark lottery as settled and closed
      const currentLottery = lotterySettings[selectedLotteryType];
      let updatedRounds = currentLottery?.rounds || [];
      
      // Find the round that was pending and mark it as completed
      const pendingRoundIndex = updatedRounds.findIndex((r: any) => r.status === 'pending');
      if (pendingRoundIndex !== -1) {
        updatedRounds[pendingRoundIndex].status = 'completed';
      }

      await updateDoc(doc(db, 'lotteryTypes', selectedLotteryType), {
        isSettled: true,
        isOpen: false,
        isPaused: false,
        rounds: updatedRounds
      });

      await logActivity('ออกผลรางวัล', `ออกผล ${selectedLotteryType}: บน ${result3Top}, ล่าง ${result2Bottom}. จ่ายรางวัลสุทธิ ฿${calculationSummary.totalPayout.toLocaleString()} (ภาษี: ${calculationSummary.taxEnabled ? `หัก ฿${calculationSummary.totalTaxDeducted?.toLocaleString()}` : 'ปิดใช้งาน'})`, 'result');

      alert('ออกผลรางวัลและชำระเงินสำเร็จเรียบร้อยแล้ว');
      setCalculatedWinners([]);
      setCalculationSummary(null);
      setResult3Top('');
      setResult2Bottom('');
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการออกผลรางวัล');
    } finally {
      setIsSettling(false);
    }
  };

  // Chart Data
  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const dayTickets = tickets.filter(t => t.createdAt?.startsWith(date));
      return {
        name: date,
        total: dayTickets.reduce((sum, t) => sum + (t.totalAmount || 0), 0),
        count: dayTickets.length
      };
    });
  }, [tickets]);

  const categoryData = useMemo(() => {
    const cats: any = {};
    tickets.forEach(t => {
      const type = t.ticketType || 'หวยปกติ';
      cats[type] = (cats[type] || 0) + (t.totalAmount || 0);
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  // Filter Logic
  const setQuickDate = (range: 'today' | 'yesterday' | '7days' | 'month' | 'all') => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (range) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(now.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case '7days':
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'all':
        setStartDate('');
        setEndDate('');
        return;
    }
    setStartDate(start.toISOString().slice(0, 16));
    setEndDate(end.toISOString().slice(0, 16));
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const dateMatch = (!startDate || t.createdAt >= startDate) && (!endDate || t.createdAt <= endDate);
      const searchMatch = !searchQuery || 
        t.ticketId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.userId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.bets?.some((b: any) => b.number.includes(searchQuery));
      return dateMatch && searchMatch;
    });
  }, [tickets, startDate, endDate, searchQuery]);

  const filteredLogs = useMemo(() => {
    return adminLogs.filter(l => {
      const dateMatch = (!startDate || l.timestamp >= startDate) && (!endDate || l.timestamp <= endDate);
      const searchMatch = !searchQuery || 
        l.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.admin?.toLowerCase().includes(searchQuery.toLowerCase());
      return dateMatch && searchMatch;
    });
  }, [adminLogs, startDate, endDate, searchQuery]);

  /** ★ ธุรกรรมที่กรองแล้ว — รองรับสถานะ + เรียงลำดับ + ค้นหา */
  const filteredTransactions = useMemo(() => {
    let list = transactions;
    // กรองสถานะ (เลือกหลายค่า)
    if (financeStatuses.length > 0) {
      list = list.filter(tx => financeStatuses.includes(String(tx.status || 'pending')));
    }
    // กรองวันที่ + ค้นหา
    list = list.filter(tx => {
      const dateMatch = (!startDate || String(tx.createdAt) >= startDate)
                     && (!endDate || String(tx.createdAt) <= endDate);
      const q = searchQuery.toLowerCase();
      const searchMatch = !searchQuery ||
        tx.userId?.toLowerCase().includes(q) ||
        tx.username?.toLowerCase().includes(q) ||
        tx.description?.toLowerCase().includes(q) ||
        tx.note?.toLowerCase().includes(q) ||
        tx.bankName?.toLowerCase().includes(q) ||
        tx.bankAccount?.toLowerCase().includes(q) ||
        String(tx.amount)?.includes(q);
      return dateMatch && searchMatch;
    });
    // เรียงลำดับ
    return sortItems(list, financeSort);
  }, [transactions, financeStatuses, startDate, endDate, searchQuery, financeSort]);

  /* ---- สรุปยอดตามวัน สำหรับกราฟการเงิน ---- */
  const financeChartData = useMemo(() => {
    const map: Record<string, { name: string; deposit: number; withdraw: number }> = {};
    filteredTransactions.forEach(t => {
      const raw = t.createdAt || t.timestamp;
      if (!raw) return;
      const day = String(raw).slice(0, 10);
      if (!map[day]) map[day] = { name: day.slice(5), deposit: 0, withdraw: 0 };
      const amt = Math.abs(Number(t.amount) || 0);
      if (t.type === 'deposit') map[day].deposit += amt;
      if (t.type === 'withdraw') map[day].withdraw += amt;
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name)).slice(-14);
  }, [filteredTransactions]);

  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-[var(--navy-deep)] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md space-y-6">
          <div className="text-center">
            <span className="material-symbols-outlined text-6xl text-[var(--gold-vibrant)]">admin_panel_settings</span>
            <h1 className="text-2xl font-black text-[var(--navy-deep)] mt-2">Admin Access</h1>
            <p className="text-gray-500 text-sm">กรุณาระบุ Username และ รหัสผ่าน</p>
          </div>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Username"
              value={adminUser}
              onChange={(e) => setAdminUser(e.target.value)}
              className="w-full border-2 border-gray-100 rounded-xl p-4 outline-none focus:border-[var(--gold-vibrant)]"
            />
            <input 
              type="password" 
              placeholder="Password"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              className="w-full border-2 border-gray-100 rounded-xl p-4 outline-none focus:border-[var(--gold-vibrant)]"
            />
            <button 
              onClick={handleAdminLogin}
              className="w-full bg-[var(--navy-deep)] text-white p-4 rounded-xl font-black hover:bg-black transition"
            >
              Login to Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ==================================================================
   * ★ แท็บทั้งหมด พร้อมสิทธิ์ที่ต้องมี
   * ------------------------------------------------------------------
   * ผู้ใช้ขอ: "ทำระบบ จัดการสิทธิ์ฟังชั่น เพื่อปิดสิทธิ์ให้พนักงาน"
   * แท็บไหนไม่มีสิทธิ์ → ซ่อนจากเมนูเลย (ไม่ใช่แค่กดไม่ได้)
   * ================================================================== */
  const ALL_TABS: { id: AdminTab; label: string; icon: string; perm: Permission }[] = [
    { id: 'overview', label: 'แดชบอร์ด',       icon: 'dashboard',              perm: PERMISSIONS.DASHBOARD_VIEW },
    { id: 'agents',   label: 'จัดการเอเย่นต์',  icon: 'support_agent',          perm: PERMISSIONS.AGENT_VIEW },
    { id: 'members',  label: 'สมาชิกทั้งหมด',   icon: 'group',                  perm: PERMISSIONS.MEMBER_VIEW },
    { id: 'settings', label: 'ตั้งค่าหวย/ระบบ', icon: 'settings',               perm: PERMISSIONS.SETTINGS_VIEW },
    { id: 'reports',  label: 'รายงานการเล่น',   icon: 'assessment',             perm: PERMISSIONS.REPORT_VIEW },
    { id: 'finance',  label: 'การเงินตัดยอด',   icon: 'account_balance_wallet', perm: PERMISSIONS.FINANCE_VIEW },
    { id: 'rules',    label: 'กติกาการเล่น',    icon: 'gavel',                  perm: PERMISSIONS.SETTINGS_RULES },
    { id: 'popup',    label: 'ระบบป๊อปอัพ',     icon: 'notification_important', perm: PERMISSIONS.SETTINGS_POPUP },
    { id: 'api',      label: 'สถานะคีย์ API',   icon: 'api',                    perm: PERMISSIONS.API_VIEW },
    { id: 'history',  label: 'ประวัติ & รหัส',  icon: 'history',                perm: PERMISSIONS.SETTINGS_HISTORY_VIEW },
    { id: 'staff',    label: 'พนักงาน & สิทธิ์', icon: 'manage_accounts',        perm: PERMISSIONS.STAFF_VIEW },
  ];

  /** ★ เมนูที่ผู้ใช้คนนี้เห็นได้ (กรองตามสิทธิ์) */
  const tabs = ALL_TABS.filter(t => has(t.perm));

  // ★ ถ้าแท็บที่เปิดอยู่ไม่มีสิทธิ์ → เด้งไปแท็บแรกที่เข้าถึงได้
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, activeTab, tabs.length]);

  return (
    <div className="min-h-screen admin-cream flex">
      {/* Sidebar */}
      <aside
        className="w-64 border-r flex flex-col fixed inset-y-0 shadow-lg z-50"
        style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}
      >
        <div className="p-6" style={{ background: 'var(--admin-accent-dark)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--admin-accent-soft)' }}>
              <span className="material-symbols-outlined font-black" style={{ color: 'var(--admin-accent-dark)' }}>admin_panel_settings</span>
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--admin-accent-soft)' }}>Administrator</div>
              <div className="text-lg font-black leading-tight text-white">Lottery Hub</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black transition-all duration-200 ${
                activeTab === tab.id
                ? 'shadow-md translate-x-1'
                : 'hover:translate-x-1'
              }`}
              style={activeTab === tab.id
                ? { background: 'var(--admin-accent)', color: '#fff' }
                : { color: 'var(--admin-text-muted)' }}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'var(--admin-border)' }}>
          {/* ★ บัตรระบุตัวตนผู้ใช้ที่ล็อกอินอยู่ */}
          {session && (
            <div className="mb-3 rounded-xl border p-2.5" style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-subtle)' }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--admin-accent)' }}>account_circle</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-black truncate" style={{ color: 'var(--admin-text)' }}>
                    {session.displayName || session.username}
                  </div>
                  <div className="text-[9px] font-bold" style={{ color: 'var(--admin-text-muted)' }}>
                    {ROLES[session.role]?.label || session.role}
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-[9px] font-bold mb-1" style={{ color: 'var(--admin-text-muted)' }}>
                  <span>สิทธิ์ที่ถือ</span>
                  <span className="tabular-nums">
                    {effectivePermissions(session).size}/{ALL_PERMISSIONS_COUNT}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#fff' }}>
                  <div className="h-full" style={{ width: `${(effectivePermissions(session).size / ALL_PERMISSIONS_COUNT) * 100}%`, background: 'var(--admin-accent)' }} />
                </div>
              </div>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black transition"
            style={{ color: '#b3261e' }}
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="text-sm">ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-6">
        <header
          className="flex justify-between items-center mb-6 p-5 rounded-2xl shadow-sm border"
          style={{ background: 'var(--admin-card)', borderColor: 'var(--admin-border)' }}
        >
          <div>
            <h2 className="text-2xl font-black" style={{ color: 'var(--admin-text)' }}>
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
              จัดการระบบหลังบ้าน {tabs.find(t => t.id === activeTab)?.label.toLowerCase()}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-sm font-black" style={{ color: 'var(--admin-text)' }}>Super Admin</div>
              <div className="text-[10px] font-bold flex items-center justify-end gap-1" style={{ color: '#2e7d32' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4caf50' }}></span>
                Online
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--admin-subtle)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--admin-accent-dark)' }}>person</span>
            </div>
          </div>
        </header>

        {/* Tab Content Wrapper */}
        <div className="animate-in fade-in duration-500">
          {/* 1. แดชบอร์ด */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <MoneyCard
                  label="เครดิต Master คงเหลือ"
                  value={globalSettings.masterBalance || 0}
                  icon="account_balance_wallet"
                  tone="gold"
                  size="md"
                />
                <MoneyCard
                  label="ยอดเงินหมุนเวียนรวม"
                  value={tickets.reduce((sum, t) => sum + (t.totalAmount || 0), 0)}
                  icon="payments"
                  tone="default"
                  size="md"
                />
                <MoneyCard
                  label="ยอดถือหุ้น Master"
                  value={tickets.reduce((sum, t) => sum + (t.totalAmount || 0), 0) * 0.20}
                  icon="pie_chart"
                  tone="blue"
                  size="md"
                />
                <MoneyCard
                  label="กำไรสุทธิคาดการณ์"
                  value={tickets.reduce((sum, t) => sum + (t.totalAmount || 0), 0) * 0.15}
                  icon="trending_up"
                  tone="green"
                  size="md"
                />
                <MoneyCard
                  label="เอเย่นต์ทั้งหมด"
                  value={agents.length}
                  icon="support_agent"
                  currency={false}
                  tone="default"
                  size="md"
                  hint={`สมาชิก ${users.length} คน`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ... (Charts from original overview) ... */}
                <div className="admin-card p-6">
                  <h3 className="font-black text-[var(--navy-deep)] mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--gold-vibrant)]">trending_up</span>
                    สถิติยอดการเล่น (7 วันล่าสุด)
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="total" stroke="var(--gold-vibrant)" strokeWidth={4} dot={{ r: 4, fill: "var(--gold-vibrant)", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="admin-card p-6">
                  <h3 className="font-black text-[var(--navy-deep)] mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--gold-vibrant)]">pie_chart</span>
                    สัดส่วนประเภทการเล่น
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((_entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={['#0a192f', '#f5c518', '#00c853', '#ff1744'][index % 4]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Monitor Highlights */}
              <div className="bg-[var(--navy-deep)] p-8 rounded-3xl shadow-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--gold-vibrant)] opacity-5 blur-[80px] -mr-32 -mt-32"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <h3 className="text-2xl font-black text-[var(--gold-vibrant)] mb-2 flex items-center gap-3">
                      <span className="material-symbols-outlined animate-pulse">radar</span>
                      Live Monitoring Hub
                    </h3>
                    <p className="text-gray-400 text-sm max-w-lg">ดูรายการเดิมพันและสถานะระบบแบบ Real-time ได้ที่เมนูตั้งค่า หรือกดปุ่มด้านขวาเพื่อเปิดหน้าต่างมอนิเตอร์โดยเฉพาะ</p>
                  </div>
                  <button 
                    onClick={() => { setActiveTab('settings'); setActiveSettingsSubTab('monitor'); }}
                    className="bg-[var(--gold-vibrant)] text-[var(--navy-deep)] px-8 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition active:scale-95 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined font-black">visibility</span>
                    เปิดมอนิเตอร์สด
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. จัดการเอเย่นต์ (Hierarchy: Master -> Agent) */}
          {activeTab === 'agents' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                  <button className="px-6 py-2 bg-[var(--navy-deep)] text-[var(--gold-vibrant)] rounded-xl font-black text-xs shadow-lg">เอเย่นต์ทั้งหมด</button>
                  <button className="px-6 py-2 text-gray-400 font-bold text-xs hover:bg-gray-50 rounded-xl transition">รออนุมัติ</button>
                </div>
                <button 
                  onClick={() => setShowAddAgentModal(true)}
                  className="bg-[var(--gold-vibrant)] text-[var(--navy-deep)] px-6 py-3 rounded-xl font-black shadow-xl hover:scale-105 transition active:scale-95 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined">person_add</span>
                  เพิ่มเอเย่นต์ใหม่
                </button>
              </div>

              <div className="admin-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="admin-table border-b">
                      <tr>
                        <th className="p-4">ข้อมูลเอเย่นต์</th>
                        <th className="p-4">เครดิตคงเหลือ</th>
                        <th className="p-4">ถือหุ้น (%)</th>
                        <th className="p-4">สมาชิกในสาย</th>
                        <th className="p-4">ยอดรวม (Intake)</th>
                        <th className="p-4">วันที่เข้าร่วม</th>
                        <th className="p-4 text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map(agent => (
                        <tr key={agent.id} className="border-b hover:bg-gray-50/50 transition">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[var(--navy-deep)] text-[var(--gold-vibrant)] rounded-xl flex items-center justify-center font-black">
                                {agent.name?.slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-black text-[var(--navy-deep)]">{agent.name}</div>
                                <div className="text-[10px] text-gray-400">User: {agent.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-black text-green-600">฿{(agent.creditLimit || 0).toLocaleString()}</div>
                          </td>
                          <td className="p-4">
                            <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-black inline-block border border-blue-100">
                              {agent.share || 80}%
                            </div>
                          </td>
                          <td className="p-4 font-bold text-gray-500">
                            {users.filter(u => u.agentId === agent.id).length} ท่าน
                          </td>
                          <td className="p-4">
                            <div className="font-black text-[var(--navy-deep)]">฿{(agent.totalIntake || 0).toLocaleString()}</div>
                          </td>
                          <td className="p-4 text-[10px] text-gray-400">
                            {new Date(agent.createdAt).toLocaleDateString('th-TH')}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => { setSelectedAgentForTopup(agent); setShowTopupModal(true); }}
                                className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition"
                                title="เติมเครดิต"
                              >
                                <span className="material-symbols-outlined text-sm">payments</span>
                              </button>
                              <button 
                                onClick={() => { setEditingAgent(agent); setShowEditAgentModal(true); }}
                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                                title="แก้ไข"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                              </button>
                              <button 
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                                title="ระงับ"
                              >
                                <span className="material-symbols-outlined text-sm">block</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {agents.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-10 text-center text-gray-400 italic">ยังไม่มีข้อมูลเอเย่นต์ในระบบ</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {/* 4. ตั้งค่าระบบ (Lottery, Result, Blocked, Monitor, Limits) */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                {[
                  { id: 'lottery', label: 'จัดการหวย', icon: 'list_alt' },
                  { id: 'result', label: 'ออกผลรางวัล', icon: 'fact_check' },
                  { id: 'tax', label: 'ระบบคำนวณภาษี', icon: 'receipt_long' },
                  { id: 'numbers', label: 'เลขกั้น/อัตราลด', icon: 'block' },
                  { id: 'monitor', label: 'มอนิเตอร์สด', icon: 'radar' },
                  { id: 'limits', label: 'ขีดจำกัดระบบ', icon: 'speed' }
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSettingsSubTab(sub.id)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black whitespace-nowrap transition ${activeSettingsSubTab === sub.id ? 'bg-[var(--navy-deep)] text-[var(--gold-vibrant)] shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                  >
                    <span className="material-symbols-outlined text-sm">{sub.icon}</span>
                    {sub.label}
                    {sub.id === 'tax' && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${globalSettings.taxEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {globalSettings.taxEnabled ? `เปิด ${globalSettings.taxRate}%` : 'ปิด'}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Sub-tab: จัดการหวย (Open/Close/Rounds) */}
              {activeSettingsSubTab === 'lottery' && (
                <div className="space-y-6">
                  <div className="admin-card p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <h3 className="font-black text-[var(--navy-deep)]">จัดการรอบและเวลาปิดรับแทง</h3>
                      
                      <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <button 
                          onClick={() => toggleAllLotteryStatus(true)} 
                          className="flex-1 md:flex-none text-xs font-black text-white bg-green-600 px-4 py-2 rounded-xl border border-green-700 shadow-sm hover:bg-green-700 transition"
                        >
                          เปิดหวยทั้งหมด
                        </button>
                        <button 
                          onClick={() => toggleAllLotteryStatus(false)} 
                          className="flex-1 md:flex-none text-xs font-black text-white bg-red-600 px-4 py-2 rounded-xl border border-red-700 shadow-sm hover:bg-red-700 transition"
                        >
                          ปิดหวยทั้งหมด
                        </button>
                        <button 
                          onClick={syncAllLotteries} 
                          className="flex-1 md:flex-none text-xs font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 hover:bg-blue-100 transition"
                        >
                          ซิงค์หวยเต็มระบบ
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {Object.keys(lotterySettings).sort().map(type => {
                        const session = lotterySettings[type];
                        const isOpen = session?.isOpen && !session?.isPaused;
                        return (
                          <div key={type} className={`p-4 rounded-2xl border ${isOpen ? 'border-[var(--gold-vibrant)] bg-white shadow-md' : 'border-gray-100 bg-gray-50 opacity-70'} space-y-3 transition-all`}>
                            <div className="flex justify-between items-center mb-2">
                              <div className="font-black text-[var(--navy-deep)] text-sm">{type}</div>
                              <button
                                onClick={() => toggleLotteryStatus(type, !isOpen)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-inner bg-gray-200`}
                              >
                                {isOpen && <div className="absolute inset-0 rounded-full bg-green-500 opacity-100 transition-opacity"></div>}
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isOpen ? 'translate-x-6' : 'translate-x-1'} relative z-10`}/>
                                <span className={`absolute left-1.5 text-[8px] font-black tracking-widest text-white transition-opacity ${isOpen ? 'opacity-100 z-10' : 'opacity-0'}`}>เปิด</span>
                                <span className={`absolute right-1 text-[8px] font-black tracking-widest text-gray-500 transition-opacity ${!isOpen ? 'opacity-100 z-10' : 'opacity-0'}`}>ปิด</span>
                              </button>
                            </div>
                            <input 
                              type="datetime-local" 
                              className="w-full p-2 border rounded-xl text-[10px] outline-none"
                              value={closingTimes[type] || ''}
                              onChange={(e) => setClosingTimes(prev => ({ ...prev, [type]: e.target.value }))}
                            />
                            <button 
                              onClick={() => updateLotterySession(type, closingTimes[type] || '')}
                              className="w-full bg-[var(--navy-deep)] text-white py-2 rounded-xl text-[10px] font-black shadow-sm"
                            >
                              อัปเดตเวลาปิดรับ
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab: ออกผลรางวัล (Result & Settlement) */}
              {activeSettingsSubTab === 'result' && (
                <div className="space-y-6">
                  <div className="admin-card p-6">
                    <h3 className="font-black text-[var(--navy-deep)] mb-6 flex items-center gap-2">
                       <span className="material-symbols-outlined text-[var(--gold-vibrant)]">fact_check</span>
                       ป้อนผลรางวัลและตัดยอดเงิน
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase">ประเภทหวย</label>
                            <select 
                              value={selectedLotteryType}
                              onChange={(e) => setSelectedLotteryType(e.target.value)}
                              className="w-full p-3 border rounded-xl text-sm outline-none focus:border-[var(--gold-vibrant)]"
                            >
                              {Object.keys(lotterySettings).map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                               <label className="text-[10px] font-black text-gray-400 uppercase">3 ตัวบน</label>
                               <input type="text" value={result3Top} onChange={(e) => setResult3Top(e.target.value)} className="w-full p-3 border rounded-xl text-center font-black text-xl" placeholder="000" />
                             </div>
                             <div className="space-y-2">
                               <label className="text-[10px] font-black text-gray-400 uppercase">2 ตัวล่าง</label>
                               <input type="text" value={result2Bottom} onChange={(e) => setResult2Bottom(e.target.value.replace(/[^0-9]/g, ''))} maxLength={2} className="w-full p-3 border rounded-xl text-center font-black text-xl" placeholder="00" />
                             </div>
                             {selectedLotteryType === 'หวยรัฐบาล' && (
                               <>
                                 <div className="space-y-2">
                                   <label className="text-[10px] font-black text-gray-400 uppercase">3 ตัวหน้า (เว้นวรรค)</label>
                                   <input type="text" value={result3Front} onChange={(e) => setResult3Front(e.target.value)} className="w-full p-3 border rounded-xl text-center font-black text-lg" placeholder="123 456" />
                                 </div>
                                 <div className="space-y-2">
                                   <label className="text-[10px] font-black text-gray-400 uppercase">3 ตัวล่าง (เว้นวรรค)</label>
                                   <input type="text" value={result3Bottom} onChange={(e) => setResult3Bottom(e.target.value)} className="w-full p-3 border rounded-xl text-center font-black text-lg" placeholder="789 012" />
                                 </div>
                               </>
                             )}
                          </div>
                          
                          <div className="flex gap-4">
                            <button 
                              disabled={isSettling}
                              onClick={() => calculateSettlement()}
                              className="w-full bg-[var(--navy-deep)] text-[var(--gold-vibrant)] py-4 rounded-xl font-black shadow-xl hover:scale-105 transition active:scale-95 disabled:opacity-50"
                            >
                              {isSettling ? 'กำลังคำนวณ...' : 'คำนวณยอดเงินถูกรางวัล'}
                            </button>
                            <button
                              disabled={isSettling}
                              onClick={async () => {
                                if(!window.confirm('คุณต้องการจำลองผลรางวัลสำหรับหวยทั้งหมดในวันนี้หรือไม่?')) return;
                                try {
                                  for(const lotType of Object.keys(lotterySettings)) {
                                    const r3Up = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
                                    const r2Down = String(Math.floor(Math.random() * 100)).padStart(2, '0');
                                    const r3Front = String(Math.floor(Math.random() * 1000)).padStart(3, '0') + ' ' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
                                    const r3Back = String(Math.floor(Math.random() * 1000)).padStart(3, '0') + ' ' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
                                    
                                    await addDoc(collection(db, 'lotteryResults'), {
                                      lotteryId: lotType,
                                      lotteryName: lotType,
                                      date: new Date().toLocaleDateString('en-CA'),
                                      results: {
                                        threeUp: r3Up,
                                        twoDown: r2Down,
                                        threeFront: lotType === 'หวยรัฐบาล' ? r3Front : '',
                                        threeBack: lotType === 'หวยรัฐบาล' ? r3Back : ''
                                      },
                                      createdAt: new Date().toISOString(),
                                      status: 'published'
                                    });
                                  }
                                  alert('จำลองผลรางวัลสำเร็จทั้งหมด');
                                } catch (e) {
                                  console.error(e);
                                  alert('เกิดข้อผิดพลาดในการจำลองผล');
                                }
                              }}
                              className="bg-blue-600 text-white px-4 rounded-xl font-black shadow-xl hover:scale-105 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                              <span className="material-symbols-outlined">auto_fix_high</span>
                              จำลองผลทุกหวย
                            </button>
                          </div>
                       </div>

                       {calculationSummary ? (
                          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-2xl border border-slate-700 text-white shadow-xl space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[var(--gold-vibrant)]">analytics</span>
                                <h4 className="font-black text-sm">สรุปยอดตัดรางวัล ({selectedLotteryType})</h4>
                              </div>
                              <span className={`text-[11px] px-2.5 py-1 rounded-full font-black ${calculationSummary.taxEnabled ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-700 text-slate-300'}`}>
                                {calculationSummary.taxEnabled ? `ระบบภาษีเปิด (${calculationSummary.taxRate}%)` : 'ระบบภาษี: ปิด'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                                <div className="text-slate-400 text-[10px]">ยอดรับแทงรวม</div>
                                <div className="text-base font-black text-white">฿{calculationSummary.totalIntake?.toLocaleString()}</div>
                                <div className="text-[10px] text-slate-400">{calculationSummary.ticketCount} โพย</div>
                              </div>
                              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                                <div className="text-slate-400 text-[10px]">ยอดรางวัลรวม (Gross)</div>
                                <div className="text-base font-black text-yellow-400">฿{(calculationSummary.totalGrossPayout || calculationSummary.totalPayout)?.toLocaleString()}</div>
                                <div className="text-[10px] text-slate-400">{calculationSummary.winnerCount} บิลถูกรางวัล</div>
                              </div>
                            </div>

                            {calculationSummary.taxEnabled && (
                              <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/30 flex justify-between items-center text-xs">
                                <div>
                                  <div className="text-amber-300 font-bold">หักภาษี ณ ที่จ่าย ({calculationSummary.taxRate}%)</div>
                                  <div className="text-[10px] text-amber-200/70">คำนวณหักจากยอดรางวัลของผู้เล่น</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-black text-amber-400">- ฿{calculationSummary.totalTaxDeducted?.toLocaleString()}</div>
                                </div>
                              </div>
                            )}

                            <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                              <div>
                                <div className="text-[11px] text-slate-400">ยอดเงินรางวัลจ่ายสุทธิ (Net Payout)</div>
                                <div className="text-xl font-black text-emerald-400">฿{calculationSummary.totalPayout?.toLocaleString()}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] text-slate-400">กำไร/ขาดทุน สุทธิ</div>
                                <div className={`text-base font-black ${calculationSummary.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {calculationSummary.profit >= 0 ? `+฿${calculationSummary.profit?.toLocaleString()}` : `-฿${Math.abs(calculationSummary.profit)?.toLocaleString()}`}
                                </div>
                              </div>
                            </div>

                            {calculatedWinners.length > 0 && (
                              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                <div className="text-[10px] font-bold text-slate-400">รายชื่อผู้ถูกรางวัล ({calculatedWinners.length} รายการ):</div>
                                {calculatedWinners.map((w, idx) => (
                                  <div key={idx} className="bg-slate-800/60 p-2 rounded text-[11px] flex justify-between items-center border border-slate-700/50">
                                    <div className="truncate max-w-[130px]">
                                      <span className="font-mono text-slate-400 mr-1.5">#{w.ticketId || w.id.slice(0, 6)}</span>
                                      <span className="font-bold text-slate-200">{w.customerName || w.username || 'ผู้เล่น'}</span>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-black text-emerald-400">฿{w.winAmount?.toLocaleString()}</div>
                                      {w.taxAmount > 0 && (
                                        <div className="text-[9px] text-amber-300">ภาษี ฿{w.taxAmount?.toLocaleString()}</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <button
                              disabled={isSettling}
                              onClick={() => confirmSettlement()}
                              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black rounded-xl shadow-lg hover:shadow-emerald-600/30 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">verified</span>
                              {isSettling ? 'กำลังตัดยอดและโอนเงิน...' : `ยืนยันตัดยอดจ่ายรางวัล (฿${calculationSummary.totalPayout?.toLocaleString()})`}
                            </button>
                          </div>
                        ) : (
                          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex flex-col justify-center items-center space-y-4">
                            <span className="material-symbols-outlined text-6xl text-gray-200">calculate</span>
                            <div className="text-center">
                              <div className="text-sm font-bold text-gray-400">เมื่อคำนวณแล้ว ระบบจะแสดงสถิติและยอดภาษีที่นี่</div>
                              <div className="text-[10px] text-gray-400 mt-1">กรุณาตรวจสอบความถูกต้องก่อนกดยืนยันตัดยอด</div>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab: ระบบคำนวณภาษี (Tax Calculation & Policy) */}
              {activeSettingsSubTab === 'tax' && (
                <div className="space-y-6">
                  {/* Header Banner */}
                  <div className="bg-gradient-to-r from-[var(--navy-deep)] to-slate-900 p-6 rounded-3xl border border-white/10 shadow-2xl text-white">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
                          <span className="material-symbols-outlined text-3xl font-black">receipt_long</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-black">ระบบคำนวณภาษี (Tax Calculation System)</h3>
                            <span className={`text-xs px-3 py-1 rounded-full font-black flex items-center gap-1.5 ${globalSettings.taxEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-700 text-slate-300'}`}>
                              <span className={`w-2 h-2 rounded-full ${globalSettings.taxEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`}></span>
                              {globalSettings.taxEnabled ? `เปิดใช้งาน (${globalSettings.taxRate}%)` : 'ปิดใช้งาน (ไม่คิดภาษี)'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 font-medium">
                            ตั้งค่าการเปิด-ปิดระบบคำนวณภาษี อัตราหัก ณ ที่จ่าย และเงื่อนไขการตัดยอดรางวัลของผู้เล่น
                          </p>
                        </div>
                      </div>

                      <button 
                        onClick={() => saveAllSettings()}
                        className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black px-6 py-3.5 rounded-2xl shadow-xl hover:shadow-amber-400/20 transition active:scale-95 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined font-black">save</span>
                        บันทึกการตั้งค่าภาษี
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Settings Controls */}
                    <div className="lg:col-span-7 space-y-6">
                      {/* Master Toggle Card */}
                      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                          <div>
                            <div className="text-base font-black text-gray-900 flex items-center gap-2">
                              <span className="material-symbols-outlined text-amber-500">toggle_on</span>
                              เปิด/ปิด การคำนวณภาษี (Enable / Disable Tax)
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {globalSettings.taxEnabled 
                                ? 'ระบบจะหักภาษีตามอัตราที่กำหนดเมื่อออกผลและจ่ายเงินรางวัล' 
                                : 'ระบบจะไม่หักภาษีใดๆ (จ่ายเงินรางวัลเต็มจำนวน 100%)'}
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={Boolean(globalSettings.taxEnabled)} 
                              onChange={(e) => setGlobalSettings({ ...globalSettings, taxEnabled: e.target.checked })} 
                            />
                            <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>

                        {/* Tax Rate & Parameters */}
                        <div className={`mt-6 space-y-5 transition-opacity ${globalSettings.taxEnabled ? 'opacity-100' : 'opacity-60'}`}>
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-xs font-black text-gray-700 uppercase tracking-wider">
                                อัตราภาษีหัก ณ ที่จ่าย (Tax Rate %)
                              </label>
                              <span className="text-xs font-black text-amber-600">
                                ปัจจุบัน: {globalSettings.taxRate || 1}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="relative flex-1">
                                <input 
                                  type="number" 
                                  step="0.1" 
                                  min="0" 
                                  max="100"
                                  disabled={!globalSettings.taxEnabled}
                                  value={globalSettings.taxRate || 1} 
                                  onChange={(e) => setGlobalSettings({ ...globalSettings, taxRate: parseFloat(e.target.value) || 0 })}
                                  className="w-full p-3.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-amber-400 outline-none font-black text-lg text-gray-900" 
                                  placeholder="1.0"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-400">%</span>
                              </div>
                            </div>

                            {/* Quick Rate Presets */}
                            <div className="flex flex-wrap gap-2">
                              <span className="text-[10px] font-bold text-gray-400 self-center mr-1">เลือกด่วน:</span>
                              {[0.5, 1.0, 2.0, 3.0, 5.0, 7.0].map(rate => (
                                <button
                                  key={rate}
                                  type="button"
                                  disabled={!globalSettings.taxEnabled}
                                  onClick={() => setGlobalSettings({ ...globalSettings, taxRate: rate })}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${globalSettings.taxRate === rate ? 'bg-[var(--navy-deep)] text-[var(--gold-vibrant)] shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                >
                                  {rate}%
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Tax Calculation Mode */}
                          <div>
                            <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-2">
                              รูปแบบการคิดภาษี (Tax Mode)
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {[
                                { id: 'winnings', title: 'หักจากเงินรางวัล', desc: 'หัก ณ ที่จ่ายเฉพาะผู้ถูกรางวัล (แนะนำ)' },
                                { id: 'betting', title: 'ภาษีจากยอดแทง', desc: 'หักจากยอดรับแทง/ยอดส่งโพย' },
                                { id: 'all', title: 'คิดรวมทั้งสองส่วน', desc: 'คำนวณทั้งยอดแทงและยอดรางวัล' }
                              ].map(mode => (
                                <button
                                  key={mode.id}
                                  type="button"
                                  disabled={!globalSettings.taxEnabled}
                                  onClick={() => setGlobalSettings({ ...globalSettings, taxType: mode.id })}
                                  className={`p-3 rounded-xl border text-left transition ${globalSettings.taxType === mode.id || (!globalSettings.taxType && mode.id === 'winnings') ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-400' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                                >
                                  <div className="text-xs font-black text-gray-900">{mode.title}</div>
                                  <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{mode.desc}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Minimum Tax Threshold & Label */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                                ยอดเงินรางวัลขั้นต่ำที่เริ่มคิดภาษี (บาท)
                              </label>
                              <input 
                                type="number" 
                                min="0"
                                disabled={!globalSettings.taxEnabled}
                                value={globalSettings.minTaxThreshold || 0}
                                onChange={(e) => setGlobalSettings({ ...globalSettings, minTaxThreshold: Number(e.target.value) || 0 })}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-amber-400 outline-none font-bold text-sm"
                                placeholder="0 (คิดทุกยอดถูกรางวัล)"
                              />
                              <span className="text-[10px] text-gray-400 mt-1 block">0 = คิดภาษีทุกยอดถูกรางวัลไม่มีข้อยกเว้น</span>
                            </div>

                            <div>
                              <label className="block text-xs font-black text-gray-700 uppercase tracking-wider mb-1.5">
                                ชื่อแสดงบนใบเสร็จ / บิล
                              </label>
                              <input 
                                type="text" 
                                disabled={!globalSettings.taxEnabled}
                                value={globalSettings.taxLabel || 'ภาษีหัก ณ ที่จ่าย (Withholding Tax)'}
                                onChange={(e) => setGlobalSettings({ ...globalSettings, taxLabel: e.target.value })}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-amber-400 outline-none font-bold text-sm"
                                placeholder="ภาษีหัก ณ ที่จ่าย"
                              />
                              <span className="text-[10px] text-gray-400 mt-1 block">ใช้เป็นข้อความกำกับในสลิปและโพย</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Policy & Rules Summary Card */}
                      <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-amber-900 font-black">
                          <span className="material-symbols-outlined text-base text-amber-700">policy</span>
                          ข้อกำหนดและผลกระทบของระบบภาษี
                        </div>
                        <ul className="space-y-1 text-amber-800 list-disc list-inside font-medium leading-relaxed">
                          <li>เมื่อ <strong className="text-amber-950">เปิดภาษี</strong>: ระบบจะหัก {globalSettings.taxRate || 1}% จากยอดเงินรางวัลของผู้เล่น และโอนเฉพาะยอดเงินสุทธิเข้ากระเป๋าเงิน (Balance) ของสมาชิก</li>
                          <li>เมื่อ <strong className="text-amber-950">ปิดภาษี</strong>: ผู้เล่นจะได้รับเงินรางวัลเต็ม 100% ตามอัตราจ่ายปกติ โดยไม่มีการหักยอดใดๆ ทั้งสิ้น</li>
                          <li>การเปิด/ปิดจะมีผลต่อการตัดรอบรางวัล (Settlement) และหน้ารายงานการเงินทันที</li>
                        </ul>
                      </div>
                    </div>

                    {/* Right Column: Live Tax Simulator (เครื่องคิดเลขจำลองการคำนวณภาษี) */}
                    <div className="lg:col-span-5 space-y-6">
                      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl border border-slate-700 text-white shadow-xl space-y-5">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-400">calculate</span>
                            <h4 className="font-black text-sm text-white">เครื่องจำลองคำนวณภาษี (Live Simulator)</h4>
                          </div>
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-black ${globalSettings.taxEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
                            {globalSettings.taxEnabled ? `ภาษี: ${globalSettings.taxRate}%` : 'ภาษี: ปิด'}
                          </span>
                        </div>

                        {/* Simulator Inputs */}
                        <div className="space-y-3 text-xs">
                          <div>
                            <label className="text-slate-400 font-bold block mb-1">ยอดแทงจำลอง (บาท)</label>
                            <input 
                              type="number" 
                              value={taxSimBetAmount}
                              onChange={(e) => setTaxSimBetAmount(Number(e.target.value) || 0)}
                              className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-black text-sm focus:border-amber-400 outline-none" 
                            />
                          </div>
                          <div>
                            <label className="text-slate-400 font-bold block mb-1">ยอดเงินรางวัลจำลอง (บาท - Gross Win)</label>
                            <input 
                              type="number" 
                              value={taxSimWinAmount}
                              onChange={(e) => setTaxSimWinAmount(Number(e.target.value) || 0)}
                              className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-yellow-400 font-black text-lg focus:border-amber-400 outline-none" 
                            />
                          </div>
                        </div>

                        {/* Calculation Breakdown Preview */}
                        {(() => {
                          const isEnabled = Boolean(globalSettings.taxEnabled);
                          const rate = Number(globalSettings.taxRate || 0);
                          const threshold = Number(globalSettings.minTaxThreshold || 0);
                          const taxAmount = (isEnabled && taxSimWinAmount >= threshold) ? Math.round((taxSimWinAmount * (rate / 100)) * 100) / 100 : 0;
                          const netWin = taxSimWinAmount - taxAmount;

                          return (
                            <div className="space-y-3 pt-2 border-t border-slate-700">
                              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/80 space-y-2 text-xs">
                                <div className="flex justify-between items-center text-slate-300">
                                  <span>ยอดรางวัลรวม (Gross Prize):</span>
                                  <span className="font-mono font-bold text-white">฿{taxSimWinAmount.toLocaleString()}</span>
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="text-amber-300 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">percent</span>
                                    {isEnabled ? `หักภาษี (${rate}%):` : 'หักภาษี (ระบบปิดอยู่):'}
                                  </span>
                                  <span className={`font-mono font-bold ${taxAmount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                                    {taxAmount > 0 ? `-฿${taxAmount.toLocaleString()}` : '฿0.00'}
                                  </span>
                                </div>

                                <div className="border-t border-slate-700/80 pt-2 flex justify-between items-center">
                                  <span className="font-black text-emerald-400 text-sm">ยอดเงินจ่ายสุทธิ (Net Payout):</span>
                                  <span className="font-mono font-black text-emerald-400 text-xl">฿{netWin.toLocaleString()}</span>
                                </div>
                              </div>

                              {/* Bill Receipt Preview */}
                              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300">
                                <div className="text-[10px] text-amber-400 font-bold mb-1">ตัวอย่างข้อความบนบิล / สลิป:</div>
                                <div className="text-slate-400">----------------------------</div>
                                <div>ยอดแทง: {taxSimBetAmount.toLocaleString()} ฿</div>
                                <div>ยอดถูกรางวัล: {taxSimWinAmount.toLocaleString()} ฿</div>
                                {isEnabled && taxAmount > 0 ? (
                                  <>
                                    <div className="text-amber-400">หักภาษี ({rate}%): -{taxAmount.toLocaleString()} ฿</div>
                                    <div className="text-emerald-400 font-bold">ยอดรับสุทธิ: {netWin.toLocaleString()} ฿</div>
                                  </>
                                ) : (
                                  <div className="text-emerald-400 font-bold">ยอดรับสุทธิ (ไม่หักภาษี): {taxSimWinAmount.toLocaleString()} ฿</div>
                                )}
                                <div className="text-slate-400">----------------------------</div>
                              </div>
                            </div>
                          );
                        })()}

                        <button 
                          onClick={() => saveAllSettings()}
                          className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 text-sm"
                        >
                          <span className="material-symbols-outlined font-black text-sm">check_circle</span>
                          บันทึกนโยบายภาษีลงระบบ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Sub-tab: เลขกั้น/อัตราลด (Blocked Numbers) */}
              {activeSettingsSubTab === 'numbers' && (
                <div className="space-y-6">
                   <div className="bg-[var(--navy-deep)] p-6 rounded-3xl border border-white/10 shadow-2xl">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[var(--gold-vibrant)] rounded-2xl flex items-center justify-center text-[var(--navy-deep)] shadow-glow">
                               <span className="material-symbols-outlined font-black">bolt</span>
                            </div>
                            <div>
                               <h3 className="text-xl font-black text-white">Smart Number Management</h3>
                               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">ระบบจัดการอั้นและลดจ่ายระดับสูง</p>
                            </div>
                         </div>
                         <div className="flex gap-2">
                            <select 
                              value={blockLotteryType}
                              onChange={(e) => setBlockLotteryType(e.target.value)}
                              className="px-4 py-2 bg-[var(--gold-vibrant)] text-[var(--navy-deep)] rounded-xl text-xs font-black outline-none w-[200px] cursor-pointer"
                            >
                              {Object.keys(lotterySettings).map(type => (
                                <option key={type} value={type} className="text-black">{type}</option>
                              ))}
                            </select>
                         </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      <div className="lg:col-span-1 space-y-6">
                         <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                               <span className="material-symbols-outlined text-[var(--gold-vibrant)]">add_task</span>
                               <span className="font-black text-[var(--navy-deep)] text-sm tracking-tight">เพิ่มเลขด่วน</span>
                            </div>
                            <div className="space-y-3">
                               <div className="space-y-1">
                                  <label className="text-[9px] font-black text-gray-400 uppercase">ประเภทการแทง</label>
                                  <select className="w-full p-3 bg-gray-50 border rounded-2xl text-xs font-bold outline-none" value={blockBetType} onChange={(e) => setBlockBetType(e.target.value)}>
                                     {Object.keys(defaultRates).map(k => <option key={k} value={k}>{k}</option>)}
                                  </select>
                               </div>
                               <div className="space-y-1">
                                  <label className="text-[9px] font-black text-gray-400 uppercase">ตัวเลข (คั่นด้วยคอมม่า)</label>
                                  <textarea className="w-full p-3 bg-gray-50 border rounded-2xl text-xs font-medium" placeholder="12, 34, 56" value={blockNumbersBulk} onChange={(e) => setBlockNumbersBulk(e.target.value)} rows={4} />
                               </div>
                               <div className="space-y-1">
                                  <label className="text-[9px] font-black text-gray-400 uppercase">อัตราจ่าย (กรณีลดจ่าย)</label>
                                  <input type="number" className="w-full p-3 bg-gray-50 border rounded-2xl text-xs font-bold outline-none" placeholder="เช่น 450" value={customPayoutRate} onChange={(e) => setCustomPayoutRate(e.target.value)} />
                               </div>
                               <div className="flex items-center gap-2 py-1">
                                  <input type="checkbox" id="applyAll" checked={applyBlockToAllLotteries} onChange={(e) => setApplyBlockToAllLotteries(e.target.checked)} className="accent-[var(--gold-vibrant)]" />
                                  <label htmlFor="applyAll" className="text-[10px] font-black text-gray-500 uppercase cursor-pointer">ใช้กับหวยทุกประเภท</label>
                               </div>
                               <div className="grid grid-cols-2 gap-2 pt-2">
                                  <button onClick={() => { setRestrictionType('blocked'); handleAddBlockedNumber(); }} className="bg-red-500 text-white py-4 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition">สั่งอั้น</button>
                                  <button onClick={() => { setRestrictionType('reduced'); handleAddBlockedNumber(); }} className="bg-orange-500 text-white py-4 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition">ลดจ่าย</button>
                               </div>
                               <button onClick={clearBlockedNumbers} className="w-full mt-2 border border-red-200 text-red-500 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition">ล้างข้อมูล ({blockLotteryType})</button>
                            </div>
                         </div>

                         <div className="bg-gradient-to-br from-[var(--navy-deep)] to-black p-6 rounded-3xl shadow-xl space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                               <span className="material-symbols-outlined text-[var(--gold-vibrant)] animate-bounce">auto_fix_high</span>
                               <span className="font-black text-[var(--gold-vibrant)] text-sm">ระบบสุ่ม (Strategy)</span>
                            </div>
                            <div className="space-y-3">
                               <div className="space-y-1">
                                  <label className="text-[9px] font-black text-gray-500 uppercase">จำนวนเลขที่จะสุ่ม</label>
                                  <input type="number" id="randomCountInput" className="w-full p-3 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-sm outline-none" placeholder="เช่น 20" />
                               </div>
                               <div className="space-y-1">
                                  <label className="text-[9px] font-black text-gray-500 uppercase">อัตราจ่ายที่จะตั้ง</label>
                                  <input type="number" id="randomPayoutInput" className="w-full p-3 bg-white/5 border border-white/10 rounded-2xl text-white font-black text-sm outline-none" placeholder="เช่น 750" />
                               </div>
                               <button onClick={handleRandomizeNumbers} className="w-full bg-[var(--gold-vibrant)] text-[var(--navy-deep)] py-4 rounded-2xl font-black text-xs transition">รันสคริปต์สุ่มอั้น</button>
                            </div>
                         </div>
                      </div>

                      <div className="lg:col-span-3 space-y-6">
                         <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 bg-gray-50 border-b flex justify-between items-center text-xs font-black">
                               <span className="flex items-center gap-2"><span className="material-symbols-outlined text-red-500">warning</span>ความเสี่ยงรายตัว ({blockLotteryType})</span>
                            </div>
                            <div className="p-4 overflow-x-auto">
                               <div className="flex gap-2 pb-2">
                                  {[...Array(10)].map((_, i) => (
                                     <div key={i} className="min-w-[80px] p-2 bg-red-50 rounded-xl border border-red-100 text-center">
                                        <div className="text-sm font-black text-red-600">{Math.floor(Math.random() * 1000).toString().padStart(3, '0')}</div>
                                        <div className="text-[8px] font-bold text-red-400">฿{(Math.random() * 10000).toFixed(0)}</div>
                                     </div>
                                  ))}
                               </div>
                            </div>
                         </div>

                         <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <table className="w-full text-left">
                               <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase italic">
                                  <tr>
                                     <th className="p-6">ข้อมูลตัวเลข</th>
                                     <th className="p-6">ประเภท</th>
                                     <th className="p-6 text-center">สถานะ</th>
                                     <th className="p-6 text-right">จัดการ</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-gray-100">
                                  {blockedNumbersList.filter(n => n.lotteryType === blockLotteryType).map(item => (
                                     <tr key={item.id} className="hover:bg-gray-50 transition text-xs">
                                        <td className="p-6 font-black text-lg">{item.number}</td>
                                        <td className="p-6 font-bold text-gray-400">{item.betType}</td>
                                        <td className="p-6 text-center">
                                           <span className={`px-3 py-1 rounded-full text-[10px] font-black ${item.restrictionType === 'blocked' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                              {item.restrictionType === 'blocked' ? 'อั้น' : `ลด: ${item.customPayoutRate}`}
                                           </span>
                                        </td>
                                        <td className="p-6 text-right">
                                           <button onClick={() => deleteDoc(doc(db, 'blocked_numbers', item.id))} className="text-red-300 hover:text-red-500 transition material-symbols-outlined">delete</button>
                                        </td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {/* Sub-tab: Monitor (Real-time Status) */}
              {activeSettingsSubTab === 'monitor' && (
                <div className="space-y-6">
                  {/* ... (Existing Monitor Content) ... */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                       <div>
                         <div className="text-[10px] font-black text-gray-400 uppercase">Cloud Database</div>
                         <div className="text-sm font-bold text-green-500 flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Connected</div>
                       </div>
                       <span className="material-symbols-outlined text-gray-200 text-3xl">terminal</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                       <div>
                         <div className="text-[10px] font-black text-gray-400 uppercase">Live Users</div>
                         <div className="text-sm font-bold text-[var(--navy-deep)]">{users.filter(u => u.status !== 'blocked').length} Active</div>
                       </div>
                       <span className="material-symbols-outlined text-gray-200 text-3xl">person</span>
                    </div>
                     <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                       <div>
                         <div className="text-[10px] font-black text-gray-400 uppercase">System Uptime</div>
                         <div className="text-sm font-bold text-blue-500">99.9%</div>
                       </div>
                       <span className="material-symbols-outlined text-gray-200 text-3xl">timer</span>
                    </div>
                  </div>

                  <div className="bg-[var(--navy-deep)] p-8 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
                     <div className="relative z-10">
                        <h3 className="text-xl font-black text-[var(--gold-vibrant)] mb-4 flex items-center gap-3">
                           <span className="material-symbols-outlined animate-pulse">radar</span>
                           Live Betting Stream
                        </h3>
                        <div className="space-y-2 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                           {tickets.slice(0, 15).map(ticket => (
                             <div key={ticket.id} className="bg-white/5 p-3 rounded-xl flex justify-between items-center border border-white/10 hover:bg-white/10 transition">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-lg bg-[var(--gold-vibrant)] text-[var(--navy-deep)] flex items-center justify-center font-black text-xs">
                                      {ticket.userId?.slice(0, 2).toUpperCase()}
                                   </div>
                                   <div>
                                      <div className="text-xs font-bold text-white uppercase">{ticket.userId}</div>
                                      <div className="text-[9px] text-gray-500">{new Date(ticket.createdAt).toLocaleTimeString()} • {ticket.lotteryType}</div>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <div className="text-xs font-black text-[var(--gold-vibrant)]">฿{ticket.totalAmount?.toLocaleString()}</div>
                                   <div className="text-[9px] text-gray-400">{ticket.ticketType}</div>
                                </div>
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {/* Sub-tab: Limits (System Constraints) */}
              {activeSettingsSubTab === 'limits' && (
                <div className="admin-card p-8">
                  <h3 className="font-black text-[var(--navy-deep)] mb-8 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--gold-vibrant)]">speed</span>
                    การตั้งค่าขีดจำกัดระบบและความปลอดภัย
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <label className="block text-sm font-black text-gray-700">ขีดจำกัดการแทง (ต่อโพย)</label>
                        <div className="flex items-center gap-4">
                           <div className="flex-1 space-y-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase">ขั้นต่ำ (บาท)</span>
                              <input type="number" className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[var(--gold-vibrant)] outline-none font-black text-lg" value={globalSettings.minBet} onChange={(e) => setGlobalSettings({...globalSettings, minBet: Number(e.target.value)})} />
                           </div>
                           <div className="flex-1 space-y-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase">สูงสุด (บาท)</span>
                              <input type="number" className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[var(--gold-vibrant)] outline-none font-black text-lg" value={globalSettings.maxBetPerUser} onChange={(e) => setGlobalSettings({...globalSettings, maxBetPerUser: Number(e.target.value)})} />
                           </div>
                        </div>
                      </div>
                      <div className="space-y-4 pt-4">
                         <label className="block text-sm font-black text-gray-700">การถือหุ้นและเครดิตระบบ</label>
                         <div className="space-y-3">
                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                               <span className="text-xs font-bold text-gray-500">เปิดระบบถือหุ้นเอเย่นต์ (Sharing Mode)</span>
                               <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" className="sr-only peer" checked={globalSettings.progressionEnabled} onChange={(e) => setGlobalSettings({...globalSettings, progressionEnabled: e.target.checked})} />
                                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--gold-vibrant)]"></div>
                               </label>
                            </div>
                         </div>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                       <div className="bg-[var(--gold-vibrant)]/5 p-6 rounded-3xl border border-[var(--gold-vibrant)]/20 space-y-4">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-[var(--gold-vibrant)] rounded-2xl flex items-center justify-center text-[var(--navy-deep)] shadow-lg">
                                 <span className="material-symbols-outlined font-black">security</span>
                              </div>
                              <div>
                                 <div className="text-sm font-black text-[var(--navy-deep)]">Master Security Check</div>
                                 <div className="text-[10px] text-gray-500">การเปลี่ยนแปลงค่าเหล่านี้จะมีผลทันทีกับทุกเอเย่นต์</div>
                              </div>
                           </div>
                           <button 
                            onClick={() => saveAllSettings()}
                            className="w-full bg-[var(--navy-deep)] text-[var(--gold-vibrant)] py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition active:scale-95"
                           >
                              บันทึกการตั้งค่าขีดจำกัด
                           </button>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. สมาชิก */}
          {activeTab === 'members' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex gap-2 p-2 rounded-2xl shadow-sm" style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)' }}>
                  <button 
                    onClick={() => setActiveMembersSubTab('users')}
                    className={`px-6 py-2 rounded-xl font-black text-xs transition ${activeMembersSubTab === 'users' ? 'shadow-lg' : ''}`}
                    style={activeMembersSubTab === 'users'
                      ? { background: 'var(--admin-accent)', color: '#fff' }
                      : { color: 'var(--admin-text-muted)' }}
                  >
                    สมาชิกทั่วไป
                  </button>
                  <button 
                    onClick={() => setActiveMembersSubTab('agents')}
                    className={`px-6 py-2 rounded-xl font-black text-xs transition ${activeMembersSubTab === 'agents' ? 'shadow-lg' : ''}`}
                    style={activeMembersSubTab === 'agents'
                      ? { background: 'var(--admin-accent)', color: '#fff' }
                      : { color: 'var(--admin-text-muted)' }}
                  >
                    สายเอเย่นต์
                  </button>
                </div>
              </div>

              {/* ★ แถบเครื่องมือค้นหา/กรอง/ส่งออก สำหรับสมาชิก */}
              <DataToolbar
                search={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder={activeMembersSubTab === 'users'
                  ? 'ค้นหา: ชื่อผู้ใช้, เบอร์โทร, รหัสสมาชิก...'
                  : 'ค้นหา: ชื่อเอเย่นต์, รหัส API, เบอร์โทร...'}
                statusOptions={[
                  { value: 'active',  label: 'ใช้งานปกติ' },
                  { value: 'blocked', label: 'ถูกระงับ' },
                ]}
                selectedStatuses={membersStatuses}
                onStatusToggle={(v) => setMembersStatuses(prev =>
                  prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
                )}
                viewMode={membersView}
                onViewModeChange={setMembersView}
                allowedViews={['table']}
                sortOptions={[
                  { value: 'createdAt_desc', label: 'ใหม่ → เก่า' },
                  { value: 'createdAt_asc',  label: 'เก่า → ใหม่' },
                  { value: 'balance_desc',   label: 'ยอดเงินมาก → น้อย' },
                  { value: 'balance_asc',    label: 'ยอดเงินน้อย → มาก' },
                  { value: 'username_asc',   label: 'ชื่อ ก → ฮ' },
                ]}
                sortBy={membersSort}
                onSortChange={setMembersSort}
                onExport={() => exportCsv(
                  activeMembersSubTab === 'users' ? filteredUsers : filteredAgents,
                  activeMembersSubTab === 'users'
                    ? [
                        { key: 'username',    label: 'ชื่อผู้ใช้' },
                        { key: 'phoneNumber', label: 'เบอร์โทร' },
                        { key: 'balance',     label: 'ยอดเงิน' },
                        { key: 'status',      label: 'สถานะ' },
                        { key: 'agentId',     label: 'เอเย่นต์' },
                        { key: 'createdAt',   label: 'วันที่สมัคร' },
                      ]
                    : [
                        { key: 'name',        label: 'ชื่อเอเย่นต์' },
                        { key: 'phone',       label: 'เบอร์โทร' },
                        { key: 'balance',     label: 'เครดิต' },
                        { key: 'status',      label: 'สถานะ' },
                        { key: 'commission',  label: 'คอมมิชชัน %' },
                        { key: 'createdAt',   label: 'วันที่สร้าง' },
                      ],
                  activeMembersSubTab === 'users' ? 'members' : 'agents',
                )}
                expanded={membersExpanded}
                onToggleExpand={() => setMembersExpanded(v => !v)}
                onReset={() => {
                  setSearchQuery(''); setMembersStatuses([]); setMembersSort('createdAt_desc');
                }}
                resultCount={activeMembersSubTab === 'users' ? filteredUsers.length : filteredAgents.length}
                resultLabel={activeMembersSubTab === 'users' ? 'สมาชิก' : 'เอเย่นต์'}
              />

              <div className="admin-card overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="admin-table border-b">
                    <tr>
                      <th className="p-4">{activeMembersSubTab === 'users' ? 'สมาชิก' : 'เอเย่นต์'}</th>
                      <th className="p-4">{activeMembersSubTab === 'users' ? 'เบอร์โทร' : 'รหัสเอเย่นต์ (API Key)'}</th>
                      <th className="p-4 text-right">ยอดเงิน / เครดิต</th>
                      <th className="p-4 text-center">{activeMembersSubTab === 'users' ? 'เอเย่นต์ผู้ดูแล' : 'หุ้นส่วน/คอม (%)'}</th>
                      <th className="p-4 text-center">สถานะ</th>
                      <th className="p-4 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMembersSubTab === 'users' ? (
                      filteredUsers
                        .map(user => (
                          <tr key={user.id} className="border-b transition">
                            <td className="p-4">
                              <div className="font-bold text-[var(--navy-deep)]">{user.username}</div>
                              <div className="text-[10px] text-gray-400">{user.firstName} {user.lastName}</div>
                            </td>
                            <td className="p-4 font-bold">{user.phoneNumber}</td>
                            <td className="p-4 font-black text-green-600">฿{(user.balance || 0).toLocaleString()}</td>
                            <td className="p-4">
                              <div className="text-xs font-bold text-blue-600">
                                {agents.find(a => a.id === user.agentId)?.name || 'Master'}
                              </div>
                            </td>
                            <td className="p-4">
                               <StatusBadge status={user.status === 'blocked' ? 'blocked' : 'active'} />
                            </td>
                            <td className="p-4">
                              <div className="flex justify-end gap-2">
                                 <button 
                                  onClick={() => { setSelectedUserForCredit(user); setCreditAction('add'); setShowCreditModal(true); }}
                                  className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition"
                                >
                                  <span className="material-symbols-outlined text-sm">add_card</span>
                                </button>
                                <button 
                                  onClick={() => updateUserStatus(user.id, user.status === 'blocked' ? 'active' : 'blocked')}
                                  className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                                >
                                  <span className="material-symbols-outlined text-sm">block</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    ) : (
                      agents
                        .filter(a => !searchQuery || a.name?.includes(searchQuery) || a.username?.includes(searchQuery))
                        .map(agent => (
                          <tr key={agent.id} className="border-b transition">
                            <td className="p-4">
                              <div className="font-bold text-[var(--navy-deep)]">{agent.name}</div>
                              <div className="text-[10px] text-gray-400">ID: {agent.username}</div>
                            </td>
                            <td className="p-4">
                              <code className="bg-gray-100 px-2 py-1 rounded text-xs border font-mono select-all">{agent.apiKey || 'No Code'}</code>
                            </td>
                            <td className="p-4 text-right">
                              <div className="font-black text-blue-600">฿{(agent.creditLimit || 0).toLocaleString()}</div>
                              <div className="text-[9px] text-gray-400 uppercase">Credit Limit</div>
                            </td>
                            <td className="p-4 text-center">
                              <div className="text-xs font-bold text-orange-600">
                                {agent.sharePercentage || 0}% / {agent.commissionRate || 0}%
                              </div>
                            </td>
                            <td className="p-4 text-center">
                               <span className="px-2 py-1 rounded-full bg-green-100 text-green-600 text-[10px] font-black uppercase">
                                ACTIVE
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2">
                                 <button 
                                  className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                                  onClick={() => alert('แก้ไขข้อมูลเอเย่นต์ (Coming Soon)')}
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                                <button 
                                  className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                                  onClick={() => alert('ระงับการใช้งานเอเย่นต์ (Coming Soon)')}
                                >
                                  <span className="material-symbols-outlined text-sm">person_off</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. รายงานการเล่น */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
               <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                {[
                  { id: 'lottery', label: 'แยกตามหวย', icon: 'list_alt' },
                  { id: 'agent', label: 'แยกตามเอเย่นต์', icon: 'support_agent' },
                  { id: 'user', label: 'แยกตามสมาชิก', icon: 'person' }
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveReportsSubTab(sub.id)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black whitespace-nowrap transition ${activeReportsSubTab === sub.id ? 'bg-[var(--navy-deep)] text-[var(--gold-vibrant)] shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                  >
                    <span className="material-symbols-outlined text-sm">{sub.icon}</span>
                    {sub.label}
                  </button>
                ))}
              </div>

              <div className="admin-card p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-[var(--navy-deep)]">รายงานกำไรขาดทุน {activeReportsSubTab === 'lottery' ? '(แยกตามประเภทหวย)' : activeReportsSubTab === 'agent' ? '(แยกตามเอเย่นต์)' : '(แยกตามสมาชิก)'}</h3>
                  <div className="flex gap-2">
                     <input type="date" className="p-2 border rounded-xl text-xs font-bold" value={toLocalYYYYMMDD(new Date())} />
                  </div>
                </div>

                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm border-collapse">
                    <thead className="admin-table border-b">
                      <tr>
                        <th className="p-4">รายการ</th>
                        <th className="p-4 text-right">ยอดแทง</th>
                        <th className="p-4 text-right">GP/ค่าน้ำ</th>
                        <th className="p-4 text-right">ยอดถูกรางวัล</th>
                        <th className="p-4 text-right">กำไร/ขาดทุน</th>
                        <th className="p-4 text-center">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Basic aggregation for lottery types */}
                      {activeReportsSubTab === 'lottery' ? (
                        ['หวยรัฐบาล', 'หวยหุ้นนิเคอิ', 'หวยหุ้นฮั่งเส็ง', 'หวยยี่กี่', 'ลัคกี้เซเว่น'].map(type => {
                          const bets = transactions.filter(t => t.type === 'bet' && t.lotteryType === type);
                          const totalBet = bets.reduce((sum, b) => sum + (b.amount || 0), 0);
                          const totalWon = bets.filter(b => b.status === 'won').reduce((sum, b) => sum + (b.winAmount || 0), 0);
                          const profit = totalBet - totalWon;
                          
                          if (totalBet === 0) return null;
                          
                          return (
                            <tr key={type} className="border-b transition">
                               <td className="p-4 font-black">{type}</td>
                               <td className="p-4 text-right font-bold text-[var(--navy-deep)]">฿{totalBet.toLocaleString()}</td>
                               <td className="p-4 text-right font-bold text-blue-600">฿0</td>
                               <td className="p-4 text-right font-bold text-red-600">฿{totalWon.toLocaleString()}</td>
                               <td className={`p-4 text-right font-black ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                 ฿{profit.toLocaleString()}
                               </td>
                               <td className="p-4 text-center">
                                 <span className="px-2 py-1 bg-green-100 text-green-600 rounded text-[10px] font-bold uppercase">Settled</span>
                               </td>
                            </tr>
                          );
                        })
                      ) : activeReportsSubTab === 'agent' ? (
                        agents.map(agent => {
                           const bets = transactions.filter(t => t.type === 'bet' && t.agentId === agent.id);
                           const totalBet = bets.reduce((sum, b) => sum + (b.amount || 0), 0);
                           const totalWon = bets.filter(b => b.status === 'won').reduce((sum, b) => sum + (b.winAmount || 0), 0);
                           const profit = totalBet - totalWon;
                           
                           if (totalBet === 0) return null;
                           
                           return (
                             <tr key={agent.id} className="border-b transition">
                                <td className="p-4 font-black">{agent.name}</td>
                                <td className="p-4 text-right font-bold text-[var(--navy-deep)]">฿{totalBet.toLocaleString()}</td>
                                <td className="p-4 text-right font-bold text-blue-600">฿{(totalBet * (agent.commissionRate || 0) / 100).toLocaleString()}</td>
                                <td className="p-4 text-right font-bold text-red-600">฿{totalWon.toLocaleString()}</td>
                                <td className={`p-4 text-right font-black ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ฿{profit.toLocaleString()}
                                </td>
                                <td className="p-4 text-center">
                                  <span className="px-2 py-1 bg-green-100 text-green-600 rounded text-[10px] font-bold uppercase">Settled</span>
                                </td>
                             </tr>
                           );
                        })
                      ) : (
                        users.slice(0, 20).map(user => {
                           const bets = transactions.filter(t => t.type === 'bet' && t.userId === user.id);
                           const totalBet = bets.reduce((sum, b) => sum + (b.amount || 0), 0);
                           const totalWon = bets.filter(b => b.status === 'won').reduce((sum, b) => sum + (b.winAmount || 0), 0);
                           const profit = totalBet - totalWon;
                           
                           if (totalBet === 0) return null;
                           
                           return (
                             <tr key={user.id} className="border-b transition">
                                <td className="p-4 font-black">{user.username || user.phoneNumber}</td>
                                <td className="p-4 text-right font-bold text-[var(--navy-deep)]">฿{totalBet.toLocaleString()}</td>
                                <td className="p-4 text-right font-bold text-blue-600">฿0</td>
                                <td className="p-4 text-right font-bold text-red-600">฿{totalWon.toLocaleString()}</td>
                                <td className={`p-4 text-right font-black ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ฿{profit.toLocaleString()}
                                </td>
                                <td className="p-4 text-center">
                                  <span className="px-2 py-1 bg-green-100 text-green-600 rounded text-[10px] font-bold uppercase">Settled</span>
                                </td>
                             </tr>
                           );
                        })
                      )}
                      
                      {/* Check if all returned null */}
                      {transactions.filter(t => t.type === 'bet').length === 0 && (
                        <tr>
                           <td colSpan={6} className="p-8 text-center text-gray-400 font-bold italic">ยังไม่มีข้อมูลการเดิมพันในระบบ</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="space-y-6">
               {/* ★ การ์ดสรุปการเงิน — โทนครีม แทน gradient สีจัด */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MoneyCard
                    label="ยอดฝากวันนี้"
                    value={transactions.filter(t => t.type === 'deposit' && (t.status === 'success' || t.status === 'approved')).reduce((acc, curr) => acc + (curr.amount || 0), 0)}
                    icon="savings"
                    tone="green"
                    size="md"
                  />
                  <MoneyCard
                    label="ยอดถอนวันนี้"
                    value={transactions.filter(t => t.type === 'withdraw' && (t.status === 'success' || t.status === 'approved')).reduce((acc, curr) => acc + (curr.amount || 0), 0)}
                    icon="payments"
                    tone="red"
                    size="md"
                  />
                  <MoneyCard
                    label="กำไรเบื้องต้น"
                    value={
                      transactions.filter(t => t.type === 'deposit' && (t.status === 'success' || t.status === 'approved')).reduce((acc, curr) => acc + (curr.amount || 0), 0)
                      - transactions.filter(t => t.type === 'withdraw' && (t.status === 'success' || t.status === 'approved')).reduce((acc, curr) => acc + (curr.amount || 0), 0)
                    }
                    icon="analytics"
                    tone="blue"
                    size="md"
                  />
                  <MoneyCard
                    label="รออนุมัติ"
                    value={transactions.filter(t => t.status === 'pending').length}
                    currency={false}
                    icon="pending_actions"
                    tone="gold"
                    size="md"
                    hint={`฿${transactions.filter(t => t.status === 'pending').reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0).toLocaleString('th-TH')}`}
                  />
                  <MoneyCard
                    label="Master Revenue (Fee 5%)"
                    value={transactions.filter(t => t.type === 'deposit' && (t.status === 'success' || t.status === 'approved')).reduce((acc, curr) => acc + (curr.amount || 0), 0) * 0.05}
                    icon="stars"
                    tone="dark"
                    size="md"
                    hint="คำนวณจาก Platform Fee 5%"
                  />
               </div>

               {/* ★ แถบเครื่องมือค้นหา/กรอง/กราฟ/ส่งออก */}
               <DataToolbar
                 search={searchQuery}
                 onSearchChange={setSearchQuery}
                 searchPlaceholder="ค้นหา: ชื่อผู้ใช้, จำนวนเงิน, ธนาคาร, หมายเหตุ..."
                 startDate={startDate}
                 endDate={endDate}
                 onStartDateChange={setStartDate}
                 onEndDateChange={setEndDate}
                 statusOptions={[
                   { value: 'pending',  label: 'รอดำเนินการ', count: transactions.filter(t => t.status === 'pending').length },
                   { value: 'approved', label: 'อนุมัติแล้ว',  count: transactions.filter(t => t.status === 'approved').length },
                   { value: 'success',  label: 'สำเร็จ',       count: transactions.filter(t => t.status === 'success').length },
                   { value: 'rejected', label: 'ปฏิเสธ',      count: transactions.filter(t => t.status === 'rejected').length },
                 ]}
                 selectedStatuses={financeStatuses}
                 onStatusToggle={(v) => setFinanceStatuses(prev =>
                   prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
                 )}
                 viewMode={financeView}
                 onViewModeChange={setFinanceView}
                 allowedViews={['table', 'chart']}
                 sortOptions={[
                   { value: 'createdAt_desc', label: 'ใหม่ → เก่า' },
                   { value: 'createdAt_asc',  label: 'เก่า → ใหม่' },
                   { value: 'amount_desc',    label: 'ยอดมาก → น้อย' },
                   { value: 'amount_asc',     label: 'ยอดน้อย → มาก' },
                 ]}
                 sortBy={financeSort}
                 onSortChange={setFinanceSort}
                 onExport={() => exportCsv(
                   filteredTransactions,
                   [
                     { key: 'createdAt', label: 'วันที่' },
                     { key: 'type',      label: 'ประเภท' },
                     { key: 'userId',    label: 'ผู้ใช้' },
                     { key: 'amount',    label: 'จำนวน' },
                     { key: 'status',    label: 'สถานะ' },
                     { key: 'bankName',  label: 'ธนาคาร' },
                     { key: 'bankAccount', label: 'เลขบัญชี' },
                     { key: 'note',      label: 'หมายเหตุ' },
                   ],
                   'transactions',
                 )}
                 expanded={financeExpanded}
                 onToggleExpand={() => setFinanceExpanded(v => !v)}
                 onReset={() => {
                   setSearchQuery(''); setStartDate(''); setEndDate('');
                   setFinanceStatuses([]); setFinanceSort('createdAt_desc');
                 }}
                 resultCount={filteredTransactions.length}
                 resultLabel="ธุรกรรม"
               />

               {/* ★ มุมมองกราฟ — ฝาก/ถอน รายวัน */}
               {financeView === 'chart' && (
                 <div className="admin-card p-5">
                   <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: 'var(--admin-text)' }}>
                     <span className="material-symbols-outlined" style={{ color: 'var(--admin-accent)' }}>insights</span>
                     เปรียบเทียบ ฝาก / ถอน รายวัน
                   </h3>
                   <div style={{ height: financeExpanded ? 460 : 320 }}>
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={financeChartData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8dfcc" />
                         <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} />
                         <YAxis fontSize={11} axisLine={false} tickLine={false} />
                         <Tooltip
                           contentStyle={{ borderRadius: '12px', border: '1px solid #e8dfcc', background: '#fffdf8' }}
                           formatter={(v: any) => `฿${Number(v).toLocaleString('th-TH')}`}
                         />
                         <Legend />
                         <Bar dataKey="deposit" fill="#4caf50" radius={[6, 6, 0, 0]} name="ฝาก" />
                         <Bar dataKey="withdraw" fill="#e53935" radius={[6, 6, 0, 0]} name="ถอน" />
                       </BarChart>
                     </ResponsiveContainer>
                   </div>
                 </div>
               )}

               {/* ---- ตารางรายการค้าง (เฉพาะมุมมองตาราง) ---- */}
               {financeView === 'table' && (
               <div className="admin-card mt-8">
                 <div className="flex justify-between items-center mb-6">
                   <h3 className="font-black flex items-center gap-2" style={{ color: 'var(--admin-text)' }}>
                     <span className="material-symbols-outlined" style={{ color: 'var(--admin-accent)' }}>account_balance</span>
                     รายการแจ้งฝาก/ถอนเงิน
                     <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-accent-text)' }}>
                       {filteredTransactions.length} รายการ
                     </span>
                   </h3>
                 </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase">เวลา</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase">สมาชิก</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase text-center">ประเภท</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase text-right">จำนวนเงิน</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase text-center">สถานะ</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.filter(t => t.type === "deposit" || t.type === "withdraw").map(tx => (
                        <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                          <td className="p-4 text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString("th-TH")}</td>
                          <td className="p-4 font-bold text-[var(--navy-deep)] text-sm">{tx.username || tx.userId}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${tx.type === "deposit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {tx.type === "deposit" ? "ฝากเงิน" : "ถอนเงิน"}
                            </span>
                          </td>
                          <td className="p-4 text-right font-black text-[var(--navy-deep)]">
                            ฿{tx.amount?.toLocaleString()}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${tx.status === "success" ? "bg-green-100 text-green-600" : tx.status === "pending" ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"}`}>
                              {tx.status === "success" ? "สำเร็จ" : tx.status === "pending" ? "รอดำเนินการ" : "ยกเลิก"}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                             {tx.status === "pending" && (
                               <>
                                 {/* ★ ตรวจสิทธิ์ก่อนแสดงปุ่มอนุมัติ */}
                                 {(tx.type === "deposit" ? has(PERMISSIONS.FINANCE_DEPOSIT_APPROVE) : has(PERMISSIONS.FINANCE_WITHDRAW_APPROVE)) ? (
                                 <>
                                 <button 
                                   onClick={async () => {
                                     if(window.confirm("ยืนยันอนุมัติรายการนี้?")) {
                                       if (tx.type === "deposit") {
                                         const userRef = doc(db, "users", tx.userId);
                                         const userSnap = await getDoc(userRef);
                                         if (userSnap.exists()) {
                                           const userData = userSnap.data();
                                           const depositAmount = tx.amount || 0;
                                           const currentAgent = agents.find(a => a.id === userData.agentId);
                                           const sourceBalance = currentAgent ? (currentAgent.creditLimit || 0) : globalSettings.masterBalance;
                                           if (sourceBalance < depositAmount) {
                                              alert("ไม่สามารถอนุมัติได้ เนื่องจากเครดิตไม่เพียงพอ");
                                              return;
                                           }
                                           await updateDoc(userRef, { balance: (userData.balance || 0) + depositAmount });
                                           if (currentAgent) {
                                              await updateDoc(doc(db, "agents", currentAgent.id), { creditLimit: sourceBalance - depositAmount });
                                           } else {
                                              await updateGlobalSetting("masterBalance", sourceBalance - depositAmount);
                                           }
                                           await updateDoc(doc(db, "transactions", tx.id), { status: "success" });
                                           alert("อนุมัติรายการฝากสำเร็จ");
                                         }
                                       } else {
                                          await updateDoc(doc(db, "transactions", tx.id), { status: "success" });
                                          alert("อนุมัติการถอนสำเร็จ");
                                       }
                                     }
                                   }}
                                   className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-bold hover:bg-green-600 transition"
                                 >
                                   อนุมัติ
                                 </button>
                                 <button 
                                   onClick={async () => {
                                     if(window.confirm("ยืนยันปฏิเสธรายการนี้?")) {
                                       await updateDoc(doc(db, "transactions", tx.id), { status: "rejected" });
                                       if (tx.type === "withdraw") {
                                         const userRef = doc(db, "users", tx.userId);
                                         const userSnap = await getDoc(userRef);
                                         if (userSnap.exists()) {
                                           await updateDoc(userRef, { balance: (userSnap.data().balance || 0) + tx.amount });
                                         }
                                       }
                                       alert("ปฏิเสธรายการสำเร็จ");
                                     }
                                   }}
                                   className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition"
                                   >
                                   ปฏิเสธ
                                   </button>
                                   </>
                                   ) : (
                                   <span className="text-[10px] font-bold px-2 py-1 rounded-lg inline-flex items-center gap-1"
                                         style={{ background: 'var(--admin-subtle)', color: 'var(--admin-text-faint)' }}>
                                     <span className="material-symbols-outlined text-[12px]">lock</span>
                                     ต้องมีสิทธิ์อนุมัติ
                                   </span>
                                   )}
                                   </>
                             )}
                          </td>
                        </tr>
                      ))}
                      {transactions.filter(t => t.type === "deposit" || t.type === "withdraw").length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-400 font-bold italic">ยังไม่มีรายการรอดำเนินการ</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </div>
           )}

          {/* 7. กติกาการเล่น */}
          {activeTab === 'rules' && (
            <div className="admin-card p-8">
               <h3 className="font-black text-[var(--navy-deep)] mb-6 flex items-center gap-2">
                 <span className="material-symbols-outlined text-[var(--gold-vibrant)]">gavel</span>
                 จัดการกติกาการเล่น
               </h3>
               <div className="space-y-4">
                  <textarea 
                    className="w-full h-[400px] border rounded-2xl p-6 font-medium text-gray-600 outline-none focus:border-[var(--gold-vibrant)]"
                    defaultValue="กติกาการเล่นระบบหวยออนไลน์... (ตัวอย่าง)"
                  />
                  <div className="flex justify-end">
                     <button className="bg-[var(--navy-deep)] text-[var(--gold-vibrant)] px-8 py-3 rounded-xl font-black shadow-lg">บันทึกกติกา</button>
                  </div>
               </div>
            </div>
          )}

          {/* 8. ระบบป๊อปอัพ */}
          {activeTab === 'popup' && (
            <div className="admin-card p-8">
               <h3 className="font-black text-[var(--navy-deep)] mb-6 flex items-center gap-2">
                 <span className="material-symbols-outlined text-[var(--gold-vibrant)]">notification_important</span>
                 จัดการป๊อปอัพประกาศหน้าบ้าน
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase">หัวข้อประกาศ</label>
                        <input type="text" className="w-full p-4 border rounded-2xl outline-none" placeholder="เช่น ยินดีต้อนรับสู่ระบบ" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase">เนื้อหา</label>
                        <textarea className="w-full h-32 p-4 border rounded-2xl outline-none" placeholder="ระบุข้อความ..." />
                     </div>
                     <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                        <span className="text-sm font-bold text-gray-500 flex-1">เปิดใช้งานป๊อปอัพทันที</span>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--gold-vibrant)]"></div>
                         </label>
                     </div>
                     <button className="w-full bg-[var(--navy-deep)] text-[var(--gold-vibrant)] py-4 rounded-2xl font-black mt-4">อัปเดตประกาศ</button>
                  </div>
                  <div className="bg-gray-100 rounded-3xl flex items-center justify-center p-8 border-4 border-dashed border-gray-200">
                     <div className="text-center text-gray-400">
                         <span className="material-symbols-outlined text-4xl mb-2">preview</span>
                         <div className="text-xs font-bold">ตัวอย่างการแสดงผลบนมือถือ</div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {/* 9. สถานะคีย์ API */}
          {activeTab === 'api' && (
            <div className="admin-card p-8">
               <h3 className="font-black text-[var(--navy-deep)] mb-6 flex items-center gap-2">
                 <span className="material-symbols-outlined text-[var(--gold-vibrant)]">hub</span>
                 White-Label API Central (Multi-Tenant Management)
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                     <div className="text-[10px] font-black text-blue-400 uppercase">Tenant Sites</div>
                     <div className="text-2xl font-black text-blue-700">12</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                     <div className="text-[10px] font-black text-green-400 uppercase">Total Requests</div>
                     <div className="text-2xl font-black text-green-700">1.2M</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                     <div className="text-[10px] font-black text-purple-400 uppercase">Avg Response</div>
                     <div className="text-2xl font-black text-purple-700">180ms</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                     <div className="text-[10px] font-black text-orange-400 uppercase">Error Rate</div>
                     <div className="text-2xl font-black text-orange-700">0.02%</div>
                  </div>
               </div>

                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-6">
                   <div className="flex justify-between items-center mb-4">
                      <h4 className="font-black text-sm text-[var(--navy-deep)]">Integration Tool (ออกรหัสเชื่อมต่อ)</h4>
                      <button 
                        onClick={async () => {
                           const domain = window.prompt("ระบุโดเมนของพาร์ทเนอร์ (เช่น example.com):");
                           if (!domain) return;
                           const apiKey = "WL-" + Math.random().toString(36).substr(2, 12).toUpperCase();
                           await addDoc(collection(db, "api_tenants"), {
                              domain,
                              apiKey,
                              status: "active",
                              type: "Full Access",
                              createdAt: new Date().toISOString(),
                              requests: 0
                           });
                           alert("สร้างคีย์เชื่อมต่อสำเร็จ");
                        }}
                        className="bg-[var(--navy-deep)] text-white px-4 py-2 rounded-xl text-xs font-bold"
                      >
                        สร้างรหัสใหม่
                      </button>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                         <thead className="text-[10px] font-black text-gray-400 uppercase">
                            <tr>
                               <th className="p-3">Partner Domain</th>
                               <th className="p-3">Integration Key</th>
                               <th className="p-3">Type</th>
                               <th className="p-3 text-right">Status</th>
                               <th className="p-3 text-right">จัดการ</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-200">
                            {apiTenants.map(tenant => (
                              <tr key={tenant.id} className="hover:bg-white transition">
                                 <td className="p-3 font-bold">{tenant.domain}</td>
                                 <td className="p-3"><code className="bg-white px-2 py-1 rounded border">{tenant.apiKey}</code></td>
                                 <td className="p-3 text-gray-500">{tenant.type}</td>
                                 <td className="p-3 text-right"><span className="text-green-500 font-black">{tenant.status}</span></td>
                                 <td className="p-3 text-right">
                                    <button onClick={() => deleteDoc(doc(db, "api_tenants", tenant.id))} className="text-red-500 material-symbols-outlined text-sm">delete</button>
                                 </td>
                              </tr>
                            ))}
                            {apiTenants.length === 0 && (
                              <tr>
                                 <td colSpan={5} className="p-8 text-center text-gray-400 italic">ยังไม่มีการเชื่อมต่อภายนอก</td>
                              </tr>
                            )}
                         </tbody>
                      </table>
                   </div>
                </div>
            </div>
          )}

          {/* ============================================================
            * ★ 10. ประวัติ & รหัส (history)
            * ------------------------------------------------------------
            * ตอบโจทย์ผู้ใช้: "ตั้งค่าต้องมีประวัติ รหัส"
            * มี 3 แท็บย่อย:
            *   1. ประวัติการตั้งค่า  — ใครแก้ อะไร จากอะไร เป็นอะไร
            *   2. รหัสเข้าใช้งาน     — เปลี่ยน PIN (เก็บเป็น hash)
            *   3. บันทึกกิจกรรมแอดมิน — adminLogs เดิม
            * พร้อมเครื่องมือ: ค้นหา กรองวันที่ กรองหมวด กราฟ ส่งออก
            * ============================================================ */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* ---- แท็บย่อย ---- */}
              <div className="flex gap-2 flex-wrap">
                {([
                  { id: 'settings',   label: 'ประวัติการตั้งค่า', icon: 'history' },
                  { id: 'credential', label: 'รหัสเข้าใช้งาน',   icon: 'key' },
                  { id: 'adminlog',   label: 'บันทึกกิจกรรม',     icon: 'receipt_long' },
                ] as const).map(s => (
                  <button
                    key={s.id}
                    onClick={() => setHistorySubTab(s.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition"
                    style={historySubTab === s.id
                      ? { background: 'var(--admin-accent)', color: '#fff' }
                      : { background: 'var(--admin-card)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)' }}
                  >
                    <span className="material-symbols-outlined text-base">{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* ============ ย่อย 1: ประวัติการตั้งค่า ============ */}
              {historySubTab === 'settings' && (
                <>
                  <DataToolbar
                    search={searchQuery}
                    onSearchChange={setSearchQuery}
                    searchPlaceholder="ค้นหา: ชื่อค่า, ผู้แก้, หมายเหตุ..."
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    statusOptions={[
                      { value: 'system',     label: 'ระบบ',       count: settingsHistory.filter(h => h.category === 'system').length },
                      { value: 'lottery',    label: 'หวย',        count: settingsHistory.filter(h => h.category === 'lottery').length },
                      { value: 'rate',       label: 'อัตราจ่าย',   count: settingsHistory.filter(h => h.category === 'rate').length },
                      { value: 'blocked',    label: 'เลขอั้น',     count: settingsHistory.filter(h => h.category === 'blocked').length },
                      { value: 'credential', label: 'รหัส',        count: settingsHistory.filter(h => h.category === 'credential').length },
                      { value: 'agent',      label: 'เอเย่นต์',    count: settingsHistory.filter(h => h.category === 'agent').length },
                      { value: 'user',       label: 'สมาชิก',      count: settingsHistory.filter(h => h.category === 'user').length },
                    ]}
                    selectedStatuses={historyCategory ? [historyCategory] : []}
                    onStatusToggle={(v) => setHistoryCategory(prev => prev === v ? '' : v)}
                    viewMode={historyView}
                    onViewModeChange={setHistoryView}
                    allowedViews={['table', 'chart']}
                    sortOptions={[
                      { value: 'timestamp_desc', label: 'ใหม่ → เก่า' },
                      { value: 'timestamp_asc',  label: 'เก่า → ใหม่' },
                      { value: 'category_asc',   label: 'หมวด ก→ฮ' },
                    ]}
                    sortBy={historySort}
                    onSortChange={setHistorySort}
                    onExport={() => exportCsv(
                      filteredHistory,
                      [
                        { key: 'timestamp', label: 'เวลา' },
                        { key: 'category',  label: 'หมวด' },
                        { key: 'key',       label: 'รายการ' },
                        { key: 'before',    label: 'ก่อนแก้' },
                        { key: 'after',     label: 'หลังแก้' },
                        { key: 'admin',     label: 'ผู้แก้' },
                        { key: 'note',      label: 'หมายเหตุ' },
                      ],
                      'settings-history',
                    )}
                    expanded={historyExpanded}
                    onToggleExpand={() => setHistoryExpanded(v => !v)}
                    onReset={() => {
                      setSearchQuery(''); setStartDate(''); setEndDate('');
                      setHistoryCategory(''); setHistorySort('timestamp_desc');
                    }}
                    resultCount={filteredHistory.length}
                    resultLabel="รายการเปลี่ยนแปลง"
                    extra={
                      <button
                        onClick={loadHistory}
                        disabled={loadingHistory}
                        className="px-3 py-2.5 rounded-xl border-2 text-xs font-black flex items-center gap-1.5 transition disabled:opacity-50"
                        style={{ background: 'var(--admin-bg)', borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
                      >
                        <span className={`material-symbols-outlined text-base ${loadingHistory ? 'animate-spin' : ''}`}>
                          {loadingHistory ? 'progress_activity' : 'refresh'}
                        </span>
                        <span className="hidden sm:inline">โหลดใหม่</span>
                      </button>
                    }
                  />

                  {/* ---- มุมมองกราฟ ---- */}
                  {historyView === 'chart' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="admin-card p-5">
                        <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: 'var(--admin-text)' }}>
                          <span className="material-symbols-outlined" style={{ color: 'var(--admin-accent)' }}>bar_chart</span>
                          จำนวนการแก้ไข แยกตามหมวด
                        </h3>
                        <div style={{ height: historyExpanded ? 420 : 280 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={historyByCategory}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8dfcc" />
                              <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} />
                              <YAxis fontSize={11} axisLine={false} tickLine={false} allowDecimals={false} />
                              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e8dfcc', background: '#fffdf8' }} />
                              <Bar dataKey="value" fill="var(--admin-accent)" radius={[6, 6, 0, 0]} name="ครั้ง" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="admin-card p-5">
                        <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: 'var(--admin-text)' }}>
                          <span className="material-symbols-outlined" style={{ color: 'var(--admin-accent)' }}>pie_chart</span>
                          สัดส่วนการแก้ไขแต่ละหมวด
                        </h3>
                        <div style={{ height: historyExpanded ? 420 : 280 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={historyByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                                {historyByCategory.map((_, i) => (
                                  <Cell key={i} fill={['#a67c52', '#c9a227', '#7d5a38', '#4caf50', '#2196f3', '#7e57c2', '#e53935'][i % 7]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e8dfcc', background: '#fffdf8' }} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---- มุมมองตาราง ---- */}
                  {historyView === 'table' && (
                    <div className="admin-card overflow-hidden">
                      <div
                        className="overflow-auto"
                        style={{ maxHeight: historyExpanded ? 'none' : 560 }}
                      >
                        <table className="w-full text-left text-sm admin-table border-collapse">
                          <thead className="sticky top-0 z-10">
                            <tr>
                              <th className="p-3">เวลา</th>
                              <th className="p-3">หมวด</th>
                              <th className="p-3">รายการที่แก้</th>
                              <th className="p-3">ก่อนแก้</th>
                              <th className="p-3">หลังแก้</th>
                              <th className="p-3">ผู้แก้</th>
                              <th className="p-3">หมายเหตุ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredHistory.map(h => (
                              <tr key={h.id} className="border-b transition" style={{ borderColor: 'var(--admin-border)' }}>
                                <td className="p-3 text-xs font-bold whitespace-nowrap tabular-nums" style={{ color: 'var(--admin-text-muted)' }}>
                                  {h.timestamp ? new Date(h.timestamp).toLocaleString('th-TH', {
                                    day: '2-digit', month: 'short', year: '2-digit',
                                    hour: '2-digit', minute: '2-digit',
                                  }) : '—'}
                                </td>
                                <td className="p-3">
                                  <StatusBadge
                                    status={
                                      h.category === 'credential' ? 'critical' :
                                      h.category === 'system' ? 'info' :
                                      h.category === 'rate' ? 'warn' : 'neutral'
                                    }
                                    label={
                                      h.category === 'system' ? 'ระบบ' :
                                      h.category === 'lottery' ? 'หวย' :
                                      h.category === 'rate' ? 'อัตราจ่าย' :
                                      h.category === 'blocked' ? 'เลขอั้น' :
                                      h.category === 'credential' ? 'รหัส' :
                                      h.category === 'agent' ? 'เอเย่นต์' :
                                      h.category === 'user' ? 'สมาชิก' : String(h.category || '—')
                                    }
                                    size="xs"
                                  />
                                </td>
                                <td className="p-3 font-bold text-xs" style={{ color: 'var(--admin-text)' }}>{h.key || '—'}</td>
                                <td className="p-3 text-xs">
                                  <span className="px-2 py-0.5 rounded font-bold line-through" style={{ background: '#fdecea', color: '#b3261e' }}>
                                    {prettyValue(h.before)}
                                  </span>
                                </td>
                                <td className="p-3 text-xs">
                                  <span className="px-2 py-0.5 rounded font-black" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                                    {prettyValue(h.after)}
                                  </span>
                                </td>
                                <td className="p-3 text-xs font-bold" style={{ color: 'var(--admin-text-muted)' }}>{h.admin || '—'}</td>
                                <td className="p-3 text-xs" style={{ color: 'var(--admin-text-muted)' }}>{h.note || '—'}</td>
                              </tr>
                            ))}
                            {filteredHistory.length === 0 && (
                              <tr>
                                <td colSpan={7} className="p-10 text-center text-sm" style={{ color: 'var(--admin-text-faint)' }}>
                                  {loadingHistory ? 'กำลังโหลด...' : 'ยังไม่มีประวัติการตั้งค่า — เมื่อแก้ไขค่าตั้งค่าจะปรากฏที่นี่'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ============ ย่อย 2: รหัสเข้าใช้งาน ============ */}
              {historySubTab === 'credential' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* ---- สถานะรหัสปัจจุบัน ---- */}
                  <div className="admin-card p-5">
                    <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: 'var(--admin-text)' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--admin-accent)' }}>shield</span>
                      สถานะรหัสเข้าใช้งาน
                    </h3>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--admin-subtle)' }}>
                        <span className="text-xs font-bold" style={{ color: 'var(--admin-text-muted)' }}>สถานะ</span>
                        <StatusBadge
                          status={pinInfo.configured ? 'approved' : 'warn'}
                          label={pinInfo.configured ? 'ตั้งรหัสแล้ว' : 'ยังไม่ตั้งรหัส'}
                          size="sm"
                          dot
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--admin-subtle)' }}>
                        <span className="text-xs font-bold" style={{ color: 'var(--admin-text-muted)' }}>เวอร์ชันรหัส</span>
                        <span className="text-xs font-black" style={{ color: 'var(--admin-text)' }}>v{pinInfo.version}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--admin-subtle)' }}>
                        <span className="text-xs font-bold" style={{ color: 'var(--admin-text-muted)' }}>แก้ไขล่าสุด</span>
                        <span className="text-xs font-black" style={{ color: 'var(--admin-text)' }}>
                          {pinInfo.updatedAt
                            ? new Date(pinInfo.updatedAt).toLocaleString('th-TH')
                            : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--admin-subtle)' }}>
                        <span className="text-xs font-bold" style={{ color: 'var(--admin-text-muted)' }}>แก้ไขโดย</span>
                        <span className="text-xs font-black" style={{ color: 'var(--admin-text)' }}>{pinInfo.updatedBy || '—'}</span>
                      </div>
                    </div>

                    <div
                      className="mt-4 p-3 rounded-xl border flex items-start gap-2"
                      style={{ background: '#eef7ef', borderColor: '#c3e0c5' }}
                    >
                      <span className="material-symbols-outlined text-base" style={{ color: '#2e7d32' }}>lock</span>
                      <div className="text-[11px] font-bold leading-relaxed" style={{ color: '#2e7d32' }}>
                        รหัสถูกเก็บเป็น <b>SHA-256 hash + salt</b> เท่านั้น
                        ระบบไม่เก็บรหัสจริง จึงดูย้อนหลังไม่ได้ — เปลี่ยนได้อย่างเดียว
                      </div>
                    </div>
                  </div>

                  {/* ---- ฟอร์มเปลี่ยนรหัส ---- */}
                  <div className="admin-card p-5">
                    <h3 className="font-black mb-4 flex items-center gap-2" style={{ color: 'var(--admin-text)' }}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--admin-accent)' }}>key</span>
                      เปลี่ยนรหัสเข้าใช้งาน
                    </h3>

                    <div className="space-y-3">
                      {pinInfo.configured && (
                        <div>
                          <label className="text-[11px] font-black uppercase tracking-wide block mb-1" style={{ color: 'var(--admin-text-muted)' }}>
                            รหัสเดิม <span style={{ color: '#b3261e' }}>*</span>
                          </label>
                          <input
                            type="password"
                            inputMode="numeric"
                            value={pinCurrent}
                            onChange={e => setPinCurrent(e.target.value.replace(/\D/g, ''))}
                            placeholder="กรอกรหัสเดิม"
                            className="w-full px-3 py-2.5 rounded-xl border-2 text-sm font-bold outline-none tabular-nums"
                            style={{ background: 'var(--admin-bg)', borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[11px] font-black uppercase tracking-wide block mb-1" style={{ color: 'var(--admin-text-muted)' }}>
                          รหัสใหม่ <span style={{ color: '#b3261e' }}>*</span>
                          <span className="ml-1 font-normal normal-case">(ตัวเลข 4-12 หลัก)</span>
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          value={pinNew}
                          onChange={e => setPinNew(e.target.value.replace(/\D/g, ''))}
                          placeholder="กรอกรหัสใหม่"
                          maxLength={12}
                          className="w-full px-3 py-2.5 rounded-xl border-2 text-sm font-bold outline-none tabular-nums"
                          style={{ background: 'var(--admin-bg)', borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}
                        />
                        {/* มาตรวัดความยาวรหัส */}
                        {pinNew && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--admin-border)' }}>
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${Math.min(100, (pinNew.length / 12) * 100)}%`,
                                  background: pinNew.length < 4 ? '#e53935' : pinNew.length < 8 ? '#eab308' : '#4caf50',
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-black tabular-nums" style={{ color: 'var(--admin-text-muted)' }}>
                              {pinNew.length}/12
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[11px] font-black uppercase tracking-wide block mb-1" style={{ color: 'var(--admin-text-muted)' }}>
                          ยืนยันรหัสใหม่ <span style={{ color: '#b3261e' }}>*</span>
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          value={pinConfirm}
                          onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                          placeholder="กรอกรหัสใหม่อีกครั้ง"
                          maxLength={12}
                          className="w-full px-3 py-2.5 rounded-xl border-2 text-sm font-bold outline-none tabular-nums"
                          style={{
                            background: 'var(--admin-bg)',
                            borderColor: pinConfirm && pinConfirm !== pinNew ? '#e53935' : 'var(--admin-border)',
                            color: 'var(--admin-text)',
                          }}
                        />
                        {pinConfirm && pinConfirm !== pinNew && (
                          <div className="text-[10px] font-black mt-1" style={{ color: '#b3261e' }}>
                            รหัสไม่ตรงกัน
                          </div>
                        )}
                        {pinConfirm && pinConfirm === pinNew && pinNew.length >= 4 && (
                          <div className="text-[10px] font-black mt-1 flex items-center gap-1" style={{ color: '#2e7d32' }}>
                            <span className="material-symbols-outlined text-[12px]">check_circle</span>
                            รหัสตรงกัน
                          </div>
                        )}
                      </div>

                      {pinMsg && (
                        <div
                          className="p-3 rounded-xl border flex items-start gap-2"
                          style={pinMsg.ok
                            ? { background: '#eef7ef', borderColor: '#c3e0c5' }
                            : { background: '#fdf0ee', borderColor: '#f0cdc8' }}
                        >
                          <span
                            className="material-symbols-outlined text-base"
                            style={{ color: pinMsg.ok ? '#2e7d32' : '#b3261e' }}
                          >
                            {pinMsg.ok ? 'check_circle' : 'error'}
                          </span>
                          <span
                            className="text-[11px] font-bold"
                            style={{ color: pinMsg.ok ? '#2e7d32' : '#b3261e' }}
                          >
                            {pinMsg.text}
                          </span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={handleChangePin}
                          disabled={pinBusy || !pinNew || pinNew !== pinConfirm}
                          className="flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{ background: 'var(--admin-accent-dark)', color: '#fff' }}
                        >
                          <span className={`material-symbols-outlined text-base ${pinBusy ? 'animate-spin' : ''}`}>
                            {pinBusy ? 'progress_activity' : 'save'}
                          </span>
                          {pinBusy ? 'กำลังบันทึก...' : 'บันทึกรหัสใหม่'}
                        </button>
                        <button
                          onClick={() => { setPinCurrent(''); setPinNew(''); setPinConfirm(''); setPinMsg(null); }}
                          className="px-4 py-3 rounded-xl font-black text-sm border-2 transition"
                          style={{ background: 'var(--admin-bg)', borderColor: 'var(--admin-border)', color: 'var(--admin-text-muted)' }}
                        >
                          ล้าง
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============ ย่อย 3: บันทึกกิจกรรมแอดมิน ============ */}
              {historySubTab === 'adminlog' && (
                <>
                  <DataToolbar
                    search={searchQuery}
                    onSearchChange={setSearchQuery}
                    searchPlaceholder="ค้นหากิจกรรม..."
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    statusOptions={[
                      { value: 'credit',   label: 'เครดิต',    count: adminLogs.filter(l => l.type === 'credit').length },
                      { value: 'settings', label: 'ตั้งค่า',    count: adminLogs.filter(l => l.type === 'settings').length },
                      { value: 'lottery',  label: 'หวย',       count: adminLogs.filter(l => l.type === 'lottery').length },
                      { value: 'system',   label: 'ระบบ',      count: adminLogs.filter(l => l.type === 'system').length },
                      { value: 'result',   label: 'ผลรางวัล',  count: adminLogs.filter(l => l.type === 'result').length },
                      { value: 'agent',    label: 'เอเย่นต์',   count: adminLogs.filter(l => l.type === 'agent').length },
                    ]}
                    selectedStatuses={[]}
                    onStatusToggle={() => {}}
                    onExport={() => exportCsv(
                      adminLogs,
                      [
                        { key: 'timestamp', label: 'เวลา' },
                        { key: 'type',      label: 'ประเภท' },
                        { key: 'action',    label: 'การกระทำ' },
                        { key: 'details',   label: 'รายละเอียด' },
                        { key: 'admin',     label: 'ผู้ทำ' },
                      ],
                      'admin-logs',
                    )}
                    expanded={historyExpanded}
                    onToggleExpand={() => setHistoryExpanded(v => !v)}
                    onReset={() => { setSearchQuery(''); setStartDate(''); setEndDate(''); }}
                    resultCount={adminLogs.length}
                    resultLabel="กิจกรรม"
                  />

                  <div className="admin-card overflow-hidden">
                    <div className="overflow-auto" style={{ maxHeight: historyExpanded ? 'none' : 560 }}>
                      <table className="w-full text-left text-sm admin-table border-collapse">
                        <thead className="sticky top-0 z-10">
                          <tr>
                            <th className="p-3">เวลา</th>
                            <th className="p-3">ประเภท</th>
                            <th className="p-3">การกระทำ</th>
                            <th className="p-3">รายละเอียด</th>
                            <th className="p-3">ผู้ทำ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminLogs.map(l => (
                            <tr key={l.id} className="border-b transition" style={{ borderColor: 'var(--admin-border)' }}>
                              <td className="p-3 text-xs font-bold whitespace-nowrap tabular-nums" style={{ color: 'var(--admin-text-muted)' }}>
                                {l.timestamp ? new Date(l.timestamp).toLocaleString('th-TH', {
                                  day: '2-digit', month: 'short', year: '2-digit',
                                  hour: '2-digit', minute: '2-digit',
                                }) : '—'}
                              </td>
                              <td className="p-3">
                                <StatusBadge
                                  status={l.type === 'credit' ? 'warn' : l.type === 'system' ? 'info' : 'neutral'}
                                  label={
                                    l.type === 'credit' ? 'เครดิต' :
                                    l.type === 'settings' ? 'ตั้งค่า' :
                                    l.type === 'lottery' ? 'หวย' :
                                    l.type === 'system' ? 'ระบบ' :
                                    l.type === 'result' ? 'ผลรางวัล' :
                                    l.type === 'agent' ? 'เอเย่นต์' : String(l.type || '—')
                                  }
                                  size="xs"
                                />
                              </td>
                              <td className="p-3 font-bold text-xs" style={{ color: 'var(--admin-text)' }}>{l.action || '—'}</td>
                              <td className="p-3 text-xs" style={{ color: 'var(--admin-text-muted)' }}>{l.details || '—'}</td>
                              <td className="p-3 text-xs font-bold" style={{ color: 'var(--admin-text-muted)' }}>{l.admin || '—'}</td>
                            </tr>
                          ))}
                          {adminLogs.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-10 text-center text-sm" style={{ color: 'var(--admin-text-faint)' }}>
                                ยังไม่มีบันทึกกิจกรรม
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {/* ============================================================
            * 11. พนักงาน & สิทธิ์ (staff)
            * ------------------------------------------------------------
            * ตอบโจทย์ผู้ใช้: "ทำระบบ จัดการสิทธิ์ฟังชั่น
            *                 เพื่อปิดสิทธิ์ให้พนักงานในเว็บนั้นๆ"
            * สิทธิ์ที่ต้องมี: STAFF_VIEW
            * ============================================================ */}
          {activeTab === 'staff' && (
            <Can perm={PERMISSIONS.STAFF_VIEW} fallback={<NoAccess perm={PERMISSIONS.STAFF_VIEW} label="ดูรายชื่อพนักงาน" />}>
              <div className="space-y-4">
                {!has(PERMISSIONS.STAFF_SET_PERMISSION) && (
                  <div className="rounded-xl border-2 p-3 flex items-start gap-2"
                       style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                    <span className="material-symbols-outlined text-base" style={{ color: '#b45309' }}>info</span>
                    <div className="text-[11px] font-bold leading-relaxed" style={{ color: '#b45309' }}>
                      ตำแหน่งของคุณดูรายชื่อพนักงานได้ แต่ <b>แก้ไขสิทธิ์ไม่ได้</b>
                      ต้องมีสิทธิ์ "ตั้งสิทธิ์พนักงาน" จากเจ้าของระบบ
                    </div>
                  </div>
                )}
                <StaffPermission />
              </div>
            </Can>
          )}
        </div>
      </main>

      {/* Top-up Agent Modal */}
      {showTopupModal && selectedAgentForTopup && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[var(--navy-deep)] p-4 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2">
                <span className="material-symbols-outlined">payments</span>
                เติมเครดิตเอเย่นต์
              </h3>
              <button onClick={() => setShowTopupModal(false)} className="text-white/50 hover:text-white transition">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center space-y-1 mb-4">
                <div className="text-sm text-gray-500">เอเย่นต์</div>
                <div className="font-black text-lg text-[var(--navy-deep)]">{selectedAgentForTopup.name}</div>
                <div className="text-xs text-gray-400">เครดิตปัจจุบัน: ฿{(selectedAgentForTopup.creditLimit || 0).toLocaleString()}</div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">จำนวนเงินที่ต้องการเติม (บาท)</label>
                <input 
                  type="number" 
                  min="0"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition text-center font-bold text-lg"
                  placeholder="0"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowTopupModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={async () => {
                    if (topupAmount <= 0) {
                      alert('กรุณาระบุจำนวนเงินที่มากกว่า 0');
                      return;
                    }
                    if (globalSettings.masterBalance < topupAmount) {
                      alert('เครดิตมาเตอร์ไม่เพียงพอสำหรับการเติมให้เอเย่นต์');
                      return;
                    }

                    try {
                      const newAgentCredit = (selectedAgentForTopup.creditLimit || 0) + topupAmount;
                      const newMasterBalance = globalSettings.masterBalance - topupAmount;

                      // Update Agent
                      await updateDoc(doc(db, 'agents', selectedAgentForTopup.id), { creditLimit: newAgentCredit });
                      
                      // Update Master
                      await updateGlobalSetting('masterBalance', newMasterBalance);

                      // Create transaction
                      await addDoc(collection(db, 'transactions'), {
                        userId: selectedAgentForTopup.id,
                        username: selectedAgentForTopup.name,
                        type: 'master_to_agent',
                        amount: topupAmount,
                        status: 'success',
                        createdAt: new Date().toISOString(),
                        description: `มาสเตอร์เติมเครดิตให้เอเย่นต์ ${selectedAgentForTopup.name}`,
                        adminId: 'Master'
                      });

                      await logActivity('เติมเครดิตเอเย่นต์', `มาสเตอร์เติมเครดิตให้ ${selectedAgentForTopup.name} จำนวน ฿${topupAmount.toLocaleString()}`, 'agent');
                      
                      alert('เติมเครดิตเอเย่นต์สำเร็จ');
                      setShowTopupModal(false);
                      setTopupAmount(0);
                      setSelectedAgentForTopup(null);
                    } catch (e) {
                      console.error(e);
                      alert('เกิดข้อผิดพลาด');
                    }
                  }}
                  className="flex-1 py-3 rounded-xl font-black text-[var(--navy-deep)] bg-[var(--gold-vibrant)] hover:bg-opacity-90 transition"
                >
                  ยืนยันการเติม
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Agent Modal */}
      {showEditAgentModal && editingAgent && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[var(--navy-deep)] p-4 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2">
                <span className="material-symbols-outlined">edit</span>
                แก้ไขข้อมูลเอเย่นต์
              </h3>
              <button onClick={() => setShowEditAgentModal(false)} className="text-white/50 hover:text-white transition">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">ชื่อเอเย่นต์ (แสดงผล)</label>
                <input 
                  type="text" 
                  defaultValue={editingAgent.name}
                  id="edit-agent-name"
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">ไอดี (Username)</label>
                  <input 
                    type="text" 
                    defaultValue={editingAgent.username}
                    id="edit-agent-username"
                    className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition bg-gray-50"
                    disabled
                  />
                  <div className="text-[10px] text-gray-400">ไม่สามารถเปลี่ยนไอดีได้</div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">รหัสผ่านใหม่</label>
                  <input 
                    type="text" 
                    placeholder="เว้นว่างไว้ถ้าไม่เปลี่ยน"
                    id="edit-agent-password"
                    className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">ที่ตั้ง / สาขา (Location)</label>
                <input 
                  type="text" 
                  defaultValue={editingAgent.location}
                  id="edit-agent-location"
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowEditAgentModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={async () => {
                    const nameInput = document.getElementById('edit-agent-name') as HTMLInputElement;
                    const passInput = document.getElementById('edit-agent-password') as HTMLInputElement;
                    const locInput = document.getElementById('edit-agent-location') as HTMLInputElement;
                    
                    if (!nameInput.value) {
                      alert('กรุณากรอกชื่อเอเย่นต์');
                      return;
                    }

                    const updates: any = {
                      name: nameInput.value,
                      location: locInput.value,
                    };

                    if (passInput.value) {
                      updates.password = passInput.value;
                    }

                    await updateDoc(doc(db, 'agents', editingAgent.id), updates);
                    await logActivity('แก้ไขเอเย่นต์', `แก้ไขข้อมูลเอเย่นต์: ${nameInput.value}`, 'agent');
                    setShowEditAgentModal(false);
                    setEditingAgent(null);
                  }}
                  className="flex-1 py-3 rounded-xl font-black text-[var(--navy-deep)] bg-[var(--gold-vibrant)] hover:bg-opacity-90 transition"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Agent Modal */}
      {showAddAgentModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[var(--navy-deep)] p-4 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2">
                <span className="material-symbols-outlined">person_add</span>
                เพิ่มเอเย่นต์ใหม่
              </h3>
              <button onClick={() => setShowAddAgentModal(false)} className="text-white/50 hover:text-white transition">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">ชื่อเอเย่นต์ (แสดงผล)</label>
                <input 
                  type="text" 
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition"
                  placeholder="เช่น Agent VIP 01"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">ไอดี (Username)</label>
                  <input 
                    type="text" 
                    value={newAgentUsername}
                    onChange={(e) => setNewAgentUsername(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition"
                    placeholder="เช่น agent01"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">รหัสผ่าน (Password)</label>
                  <input 
                    type="text" 
                    value={newAgentPassword}
                    onChange={(e) => setNewAgentPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition"
                    placeholder="รหัสผ่าน"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">ที่ตั้ง / สาขา (Location)</label>
                <input 
                  type="text" 
                  value={newAgentLocation}
                  onChange={(e) => setNewAgentLocation(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition"
                  placeholder="เช่น กรุงเทพฯ, สาขา 1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">% ถือสู้ (รับกิน) (0-100)</label>
                  <input 
                    type="number" 
                    min="0"
                    max="100"
                    value={newAgentShare}
                    onChange={(e) => setNewAgentShare(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">เครดิตเริ่มต้น (บาท)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={newAgentCredit}
                    onChange={(e) => setNewAgentCredit(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowAddAgentModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={async () => {
                    if (!newAgentName || !newAgentUsername || !newAgentPassword) {
                      alert('กรุณากรอกชื่อ ไอดี และรหัสผ่านให้ครบถ้วน');
                      return;
                    }
                    const apiKey = 'AK88-' + Math.random().toString(36).substr(2, 9).toUpperCase() + '-' + Date.now().toString().slice(-4);
                    await addDoc(collection(db, 'agents'), {
                      name: newAgentName,
                      username: newAgentUsername,
                      password: newAgentPassword, // In a real app, hash this!
                      location: newAgentLocation,
                      apiKey,
                      sharePercentage: newAgentShare,
                      commissionRate: 0,
                      creditLimit: newAgentCredit,
                      status: 'active',
                      createdAt: new Date().toISOString()
                    });
                    await logActivity('เพิ่มเอเย่นต์', `สร้างเอเย่นต์ใหม่: ${newAgentName} (${newAgentUsername})`, 'agent');
                    setShowAddAgentModal(false);
                    setNewAgentName('');
                    setNewAgentUsername('');
                    setNewAgentPassword('');
                    setNewAgentLocation('');
                    setNewAgentCredit(100000);
                    setNewAgentShare(80);
                  }}
                  className="flex-1 py-3 rounded-xl font-black text-[var(--navy-deep)] bg-[var(--gold-vibrant)] hover:bg-opacity-90 transition"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Lottery Modal */}
      {showAddLotteryModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[var(--navy-deep)] p-4 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2">
                <span className="material-symbols-outlined">add_circle</span>
                เพิ่มประเภทหวยใหม่
              </h3>
              <button onClick={() => setShowAddLotteryModal(false)} className="text-white/50 hover:text-white transition">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">ชื่อประเภทหวย</label>
                <input 
                  type="text" 
                  value={newLotteryName}
                  onChange={(e) => setNewLotteryName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition"
                  placeholder="เช่น หวยรัฐบาลไทย"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setShowAddLotteryModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={async () => {
                    if (!newLotteryName) return;
                    await setDoc(doc(db, 'lotteryTypes', newLotteryName), {
                      id: newLotteryName,
                      name: newLotteryName,
                      category: 'อื่นๆ',
                      rates: defaultRates,
                      isOpen: true,
                      isHidden: false,
                      updatedAt: new Date().toISOString()
                    });
                    setShowAddLotteryModal(false);
                    setNewLotteryName('');
                  }}
                  className="flex-1 py-3 rounded-xl font-black text-[var(--navy-deep)] bg-[var(--gold-vibrant)] hover:bg-opacity-90 transition"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Round Management Modal */}
      {showRoundModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[var(--navy-deep)] p-4 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2">
                <span className="material-symbols-outlined">schedule</span>
                จัดการรอบล่วงหน้า: {selectedLotteryForRound}
              </h3>
              <button onClick={() => setShowRoundModal(false)} className="material-symbols-outlined">close</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">เวลาเปิดรับแทง</label>
                  <input 
                    type="datetime-local" 
                    value={newRoundOpen}
                    onChange={(e) => setNewRoundOpen(e.target.value)}
                    className="w-full border-2 border-gray-100 rounded-xl px-4 py-2 outline-none focus:border-[var(--gold-vibrant)] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">เวลาปิดรับแทง</label>
                  <input 
                    type="datetime-local" 
                    value={newRoundClose}
                    onChange={(e) => setNewRoundClose(e.target.value)}
                    className="w-full border-2 border-gray-100 rounded-xl px-4 py-2 outline-none focus:border-[var(--gold-vibrant)] text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">เวลาออกผล</label>
                  <input 
                    type="datetime-local" 
                    value={newRoundResult}
                    onChange={(e) => setNewRoundResult(e.target.value)}
                    className="w-full border-2 border-gray-100 rounded-xl px-4 py-2 outline-none focus:border-[var(--gold-vibrant)] text-sm"
                  />
                </div>
                <button 
                  onClick={handleAddRound}
                  className="w-full bg-[var(--navy-deep)] text-[var(--gold-vibrant)] py-3 rounded-xl font-black shadow-sm active:scale-95 transition"
                >
                  เพิ่มรอบ
                </button>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <h4 className="font-bold text-sm text-gray-600 mb-3">รอบที่เตรียมไว้ ({lotterySettings[selectedLotteryForRound]?.rounds?.length || 0}/5)</h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {lotterySettings[selectedLotteryForRound]?.rounds?.map((r: any) => (
                    <div key={r.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex justify-between items-center">
                      <div className="text-xs space-y-1">
                        <div><span className="font-bold text-gray-500">เปิด:</span> {new Date(r.openTime).toLocaleString('th-TH')}</div>
                        <div><span className="font-bold text-gray-500">ปิด:</span> {new Date(r.closeTime).toLocaleString('th-TH')}</div>
                        <div><span className="font-bold text-gray-500">ออกผล:</span> {new Date(r.resultTime).toLocaleString('th-TH')}</div>
                      </div>
                      <button 
                        onClick={() => handleRemoveRound(selectedLotteryForRound, r.id)}
                        className="material-symbols-outlined text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                      >
                        delete
                      </button>
                    </div>
                  ))}
                  {(!lotterySettings[selectedLotteryForRound]?.rounds || lotterySettings[selectedLotteryForRound]?.rounds.length === 0) && (
                    <div className="text-center text-sm text-gray-400 py-4">ยังไม่มีรอบที่เตรียมไว้</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[var(--navy-deep)] p-4 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2">
                <span className="material-symbols-outlined">{creditAction === 'add' ? 'add_card' : 'remove_card'}</span>
                {creditAction === 'add' ? 'เติมเครดิต' : 'ลดเครดิต'}
              </h3>
              <button onClick={() => setShowCreditModal(false)} className="material-symbols-outlined">close</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="text-[10px] font-black text-gray-400 uppercase mb-1">สมาชิก</div>
                <div className="font-black text-[var(--navy-deep)]">{selectedUserForCredit?.username}</div>
                <div className="text-xs text-gray-500">เครดิตปัจจุบัน: ฿{selectedUserForCredit?.balance?.toLocaleString() || 0}</div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase">จำนวนเงิน (บาท)</label>
                <input 
                  type="number" 
                  value={creditAmount || ''}
                  onChange={(e) => setCreditAmount(parseFloat(e.target.value))}
                  placeholder="0.00"
                  className="w-full border-2 border-gray-100 rounded-xl p-4 font-black text-2xl text-center outline-none focus:border-[var(--gold-vibrant)] transition"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[100, 500, 1000, 5000, 10000, 50000].map(amt => (
                  <button 
                    key={amt}
                    onClick={() => setCreditAmount(amt)}
                    className="py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-black hover:bg-[var(--gold-vibrant)] hover:text-[var(--navy-deep)] transition"
                  >
                    +{amt.toLocaleString()}
                  </button>
                ))}
              </div>

              <button 
                onClick={handleCreditTransaction}
                className={`w-full py-4 rounded-xl font-black shadow-lg active:scale-95 transition ${creditAction === 'add' ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}
              >
                ยืนยันการทำรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Transaction History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="bg-[var(--navy-deep)] p-4 flex justify-between items-center text-white shrink-0">
              <h3 className="font-black flex items-center gap-2">
                <span className="material-symbols-outlined">history</span>
                ประวัติการเงิน: {selectedUserForHistory?.username}
              </h3>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  className="bg-white/10 border border-white/20 rounded px-2 py-1 text-[10px] outline-none focus:border-[var(--gold-vibrant)]"
                  onChange={(e) => setStartDate(e.target.value ? `${e.target.value}T00:00` : '')}
                />
                <button onClick={() => setShowHistoryModal(false)} className="material-symbols-outlined">close</button>
              </div>
            </div>
            <div className="p-0 overflow-y-auto flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 text-gray-400 font-black uppercase sticky top-0 z-10 border-b">
                  <tr>
                    <th className="p-4">เวลา</th>
                    <th className="p-4">ประเภท</th>
                    <th className="p-4 text-right">จำนวนเงิน</th>
                    <th className="p-4">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions
                    .filter(tx => tx.userId === selectedUserForHistory?.id || (selectedUserForHistory?.id === 'demo_user' && tx.userId === 'demo_user'))
                    .map(tx => (
                      <tr key={tx.id} className="border-b transition">
                        <td className="p-4 text-gray-500">{new Date(tx.createdAt).toLocaleString('th-TH')}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                            tx.type.includes('deposit') ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                          }`}>
                            {tx.type === 'deposit' ? 'ฝากเงิน' : 
                             tx.type === 'withdraw' ? 'ถอนเงิน' :
                             tx.type === 'admin_deposit' ? 'แอดมินเติม' :
                             tx.type === 'admin_withdraw' ? 'แอดมินลด' : tx.type}
                          </span>
                        </td>
                        <td className={`p-4 text-right font-black ${tx.type.includes('deposit') ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type.includes('deposit') ? '+' : '-'}฿{tx.amount?.toLocaleString()}
                        </td>
                        <td className="p-4 text-gray-500 italic">{tx.description}</td>
                      </tr>
                    ))}
                  {transactions.filter(tx => tx.userId === selectedUserForHistory?.id || (selectedUserForHistory?.id === 'demo_user' && tx.userId === 'demo_user')).length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-gray-400">ไม่พบประวัติการทำรายการ</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Payout Config Modal */}
      {showPayoutModal && selectedPayoutLottery && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="bg-[var(--navy-deep)] p-4 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2">
                <span className="material-symbols-outlined">payments</span>
                จัดการอัตราจ่ายและเลขอั้น: {selectedPayoutLottery}
              </h3>
              <button 
                onClick={() => setShowPayoutModal(false)}
                className="text-white/50 hover:text-white transition"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              <div className="space-y-4">
                <h4 className="font-black text-[var(--navy-deep)] border-b pb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--gold-vibrant)]">tune</span>
                  ตั้งค่าอัตราการจ่าย (12 ประเภท)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.keys(defaultRates).map(rateType => {
                    const currentRates = lotterySettings[selectedPayoutLottery]?.rates || defaultRates;
                    const currentMedians = lotterySettings[selectedPayoutLottery]?.medianRates || defaultRates;
                    const isReduced = (currentRates[rateType] || 0) < (currentMedians[rateType] || 0);
                    const isSpecial = (currentRates[rateType] || 0) > (currentMedians[rateType] || 0);

                    return (
                    <div key={rateType} className={`p-3 rounded-xl space-y-2 border transition-colors ${
                      isReduced ? 'bg-red-50 border-red-100' : 
                      isSpecial ? 'bg-green-50 border-green-100' : 
                      'bg-gray-50 border-gray-100'
                    }`}>
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-gray-400 uppercase leading-none">{rateType}</label>
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                          isReduced ? 'bg-red-100 text-red-600' : 
                          isSpecial ? 'bg-green-100 text-green-600' : 
                          'bg-gray-200 text-gray-500'
                        }`}>
                          {isReduced ? 'Reduced' : isSpecial ? 'Special' : 'Normal'}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-400 font-bold uppercase">Rate ปัจจุบัน</label>
                        <input 
                          type="number"
                          step="0.1"
                          value={currentRates[rateType] || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const updatedRates = { ...currentRates, [rateType]: val };
                            updateDoc(doc(db, 'lotteryTypes', selectedPayoutLottery), { rates: updatedRates });
                          }}
                          className={`w-full bg-white border rounded p-2 text-sm font-black outline-none focus:border-[var(--gold-vibrant)] ${
                            isReduced ? 'text-red-600 border-red-200' : 'text-[var(--navy-deep)] border-gray-200'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-400 font-bold uppercase">ค่ากลาง (Median)</label>
                        <input 
                          type="number"
                          step="0.1"
                          value={currentMedians[rateType] || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const updatedMedians = { ...currentMedians, [rateType]: val };
                            updateDoc(doc(db, 'lotteryTypes', selectedPayoutLottery), { medianRates: updatedMedians });
                          }}
                          className="w-full bg-white border border-gray-200 rounded p-1.5 text-[11px] font-bold text-gray-500 outline-none focus:border-[var(--gold-vibrant)]"
                        />
                      </div>
                    </div>
                  )})}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-black text-red-600 border-b pb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined">block</span>
                  จัดการเลขอั้น/ลดราคาจ่าย (เฉพาะ {selectedPayoutLottery})
                </h4>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">ประเภท</label>
                    <select 
                      id="modal-blockBetType"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none"
                    >
                      {Object.keys(defaultRates).concat(['ทุกประเภท']).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">ตัวเลข (คั่นด้วย ,)</label>
                    <input 
                      id="modal-blockNumbers"
                      type="text" 
                      placeholder="เช่น 123, 456"
                      className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)]"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">อัตราจ่าย (ถ้าอั้น)</label>
                    <input
                      id="modal-blockRate"
                      type="number"
                      placeholder="เช่น 450"
                      className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)]"
                    />
                  </div>
                  <button 
                    onClick={async () => {
                      const selType = (document.getElementById('modal-blockBetType') as HTMLSelectElement).value;
                      const nums = (document.getElementById('modal-blockNumbers') as HTMLInputElement).value;
                      const rate = (document.getElementById('modal-blockRate') as HTMLInputElement).value;
                      if(!nums) return;
                      const numbersArray = nums.split(',').map(n => n.trim()).filter(n => n.length > 0);
                      for (const num of numbersArray) {
                        await addDoc(collection(db, 'blocked_numbers'), {
                          lotteryType: selectedPayoutLottery,
                          betType: selType,
                          number: num,
                          restrictionType: rate ? 'reduced' : 'blocked',
                          payoutRate: rate ? Number(rate) : 0,
                          createdAt: new Date().toISOString()
                        });
                      }
                      (document.getElementById('modal-blockNumbers') as HTMLInputElement).value = '';
                      (document.getElementById('modal-blockRate') as HTMLInputElement).value = '';
                    }}
                    className="bg-red-500 text-white font-black px-4 py-3 rounded-xl hover:bg-red-600 transition h-[46px]"
                  >
                    เพิ่ม
                  </button>
                </div>
                
                <div className="bg-gray-50 rounded-xl border border-gray-100 max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-500 font-black uppercase sticky top-0">
                      <tr>
                        <th className="p-3">ประเภท</th>
                        <th className="p-3 text-center">ตัวเลข</th>
                        <th className="p-3 text-center">สถานะ</th>
                        <th className="p-3 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockedNumbersList.filter(bn => bn.lotteryType === selectedPayoutLottery).length === 0 ? (
                        <tr><td colSpan={4} className="text-center p-4 text-gray-400">ไม่มีเลขอั้นสำหรับหวยนี้</td></tr>
                      ) : (
                        blockedNumbersList.filter(bn => bn.lotteryType === selectedPayoutLottery).map(bn => (
                          <tr key={bn.id} className="border-t border-gray-100">
                            <td className="p-3 font-bold text-[var(--navy-deep)]">{bn.betType}</td>
                            <td className="p-3 text-center font-black tracking-widest text-red-500">{bn.number}</td>
                            <td className="p-3 text-center">
                              {bn.restrictionType === 'blocked' ? (
                                <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-black">ปิดรับแทง</span>
                              ) : (
                                <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-[10px] font-black">จ่าย {bn.payoutRate}</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <button 
                                onClick={() => deleteDoc(doc(db, 'blocked_numbers', bn.id))}
                                className="text-red-400 hover:text-red-600 transition"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end">
              <button 
                onClick={() => setShowPayoutModal(false)}
                className="bg-gray-200 text-gray-600 font-bold px-6 py-2 rounded-xl"
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

