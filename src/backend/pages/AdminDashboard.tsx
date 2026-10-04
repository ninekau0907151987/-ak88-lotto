import React, { useState, useEffect, useMemo } from 'react';
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
import {
  LOTTERY_CATEGORIES, getLotteryCategory, getCategoryLabel, MASTER_LOTTERY_CATALOG, isAllowedOpenLottery,
  type LotteryCategoryKey
} from '@/shared/lib/lotteryCatalog';
import RoundSchedulerManager from '../components/RoundSchedulerManager';
import LotteryOpenCloseManager from '../components/LotteryOpenCloseManager';
import RiskIntakeSettings from '../components/RiskIntakeSettings';
import RiskIntakeMonitor from '../components/RiskIntakeMonitor';
import LotteryCategorySelector from '../components/LotteryCategorySelector';
import BlockedNumbersManager from '../components/BlockedNumbersManager';
import RiskProbabilityChart from '../components/RiskProbabilityChart';
import TwoFactorModal from '../components/TwoFactorModal';

type AdminTab =
  | 'overview'
  | 'blocked_numbers'
  | 'intake_monitor'
  | 'payout_rates'
  | 'intake_settings'
  | 'lottery_control'
  | 'round_scheduler'
  | 'members'
  | 'finance'
  | 'agents'
  | 'reports'
  | 'settings'
  | 'system_control'
  | 'rules'
  | 'popup'
  | 'api'
  | 'history'
  | 'staff';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>('finance');
  const [isMasterUnlocked, setIsMasterUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('masterUnlocked') === 'true';
  });
  const [showMasterPinModal, setShowMasterPinModal] = useState<boolean>(false);
  const [masterPinInput, setMasterPinInput] = useState<string>('');
  const [showTwoFactorModal, setShowTwoFactorModal] = useState<boolean>(false);
  const [twoFactorAllowBypass, setTwoFactorAllowBypass] = useState<boolean>(true);
  const [twoFactorEnforceScan, setTwoFactorEnforceScan] = useState<boolean>(false);
  const [pendingSession, setPendingSession] = useState<StaffSession | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'ภาพรวม & การเงิน': true,
    'จัดการหวย & ตรวจจับความเสี่ยง': true,
    'จัดการเลขอั้น (เลขลด/ปิด)': true,
    'สมาชิก & บุคลากร': true,
    'การตั้งค่าระบบ & ประกาศ': true,
    'API & ความปลอดภัย': true,
    'ศูนย์ควบคุมพิเศษ': true,
  });

  const toggleSection = (secName: string) => {
    setExpandedSections(prev => ({ ...prev, [secName]: !prev[secName] }));
  };
  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState('lottery');
  const [activeReportsSubTab, setActiveReportsSubTab] = useState('lottery');
  const [activeMembersSubTab, setActiveMembersSubTab] = useState<'users' | 'agents'>('users');
  
  // ★ แท็บกรองหมวดหมู่หวย
  const [lotteryCategoryFilter, setLotteryCategoryFilter] = useState<LotteryCategoryKey>('all');
  const [lotterySearchTerm, setLotterySearchTerm] = useState('');
  const [resultCategoryFilter, setResultCategoryFilter] = useState<LotteryCategoryKey>('all');
  const [newLotteryCategory, setNewLotteryCategory] = useState<LotteryCategoryKey>('thai');
  const [newLotteryIsOpen, setNewLotteryIsOpen] = useState(true);
  const [autoBlockCount, setAutoBlockCount] = useState(50);
  // ★ Rules Management State
  const [rulesSubTab, setRulesSubTab] = useState<'general' | 'lottery'>('general');
  const [rulesContent, setRulesContent] = useState('');
  const [selectedRulesLottery, setSelectedRulesLottery] = useState<string>('');
  const [lotteryRulesText, setLotteryRulesText] = useState<string>('');
  const [lotteryRulesImageUrl, setLotteryRulesImageUrl] = useState<string>('');
  const [isSavingRules, setIsSavingRules] = useState(false);

  // ★ Popup & Welcome Management State
  const [popupSubTab, setPopupSubTab] = useState<'announcement' | 'welcome'>('announcement');
  const [popupContent, setPopupContent] = useState<{
    title: string;
    body: string;
    imageUrl: string;
    active: boolean;
    type: 'general' | 'promotion' | 'maintenance' | 'urgent';
    target: 'all' | 'specific';
    targetUsers: string;
    showOnce: boolean;
    linkUrl: string;
    actionText: string;
  }>({
    title: 'ยินดีต้อนรับสู่ AK88 LOTTO',
    body: 'ระบบฝาก-ถอนออโต้ ตลอด 24 ชั่วโมง อัตราจ่ายสูงสุดบาทละ 1,000',
    imageUrl: '',
    active: false,
    type: 'general',
    target: 'all',
    targetUsers: '',
    showOnce: false,
    linkUrl: '',
    actionText: 'ดูรายละเอียด'
  });
  const [welcomeContent, setWelcomeContent] = useState<{
    enabled: boolean;
    title: string;
    subtitle: string;
    bonusNotice: string;
    imageUrl: string;
    buttonText: string;
    features: string[];
  }>({
    enabled: true,
    title: 'ยินดีต้อนรับสู่ AK88 LOTTO! 🎉',
    subtitle: 'เว็บแทงหวยออนไลน์มาตรฐานระดับสากล อัตราจ่ายสูงสุด บาทละ 1,000',
    bonusNotice: 'สมาชิกใหม่รับสิทธิ์ร่วมสนุกและรับโบนัสพิเศษ!',
    imageUrl: '',
    buttonText: 'เริ่มต้นใช้งานทันที',
    features: [
      'ครบทุกหวยดัง: รัฐบาลไทย ยี่กี 88 รอบ ฮานอย ลาว หุ้น',
      'ระบบฝาก-ถอนเงินออโต้ QR Code สแกนจ่ายปรับยอดไวใน 30 วิ',
      'จ่ายเต็ม ปลอดภัย 100% พร้อมบริการซัพพอร์ตตลอด 24 ชั่วโมง'
    ]
  });
  const [isSavingPopup, setIsSavingPopup] = useState(false);
  const [isSavingWelcome, setIsSavingWelcome] = useState(false);
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
    taxLabel: 'ภาษีหัก ณ ที่จ่าย (Withholding Tax)',
    systemOpen: true,
    bettingOpen: true,
    depositOpen: true,
    withdrawOpen: true,
    registerOpen: true,
    maintenanceMessage: 'ระบบกำลังปิดปรับปรุงชั่วคราวเพื่อพัฒนาการให้บริการ ขออภัยในความไม่สะดวก'
  });
  const [taxSimBetAmount, setTaxSimBetAmount] = useState<number>(1000);
  const [taxSimWinAmount, setTaxSimWinAmount] = useState<number>(90000);
  const [loading, setLoading] = useState(true);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [selectedSlipTx, setSelectedSlipTx] = useState<any>(null);
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
  const [creditAction, setCreditAction] = useState<'add' | 'reduce' | 'set'>('add');
  const [creditNote, setCreditNote] = useState('');

  // Add Member State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({
    username: '',
    password: '',
    phoneNumber: '',
    firstName: '',
    lastName: '',
    bankName: 'ธนาคารกสิกรไทย (KBANK)',
    bankAccount: '',
    initialCredit: 0,
    agentId: '',
  });
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [maintenanceNote, setMaintenanceNote] = useState('');

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
    '3 ตัวล่าง': 450,
    '3 ตัวหน้า': 450,
    '3 ตัวกลับ': 900,
    '2 ตัวบน': 90,
    '2 ตัวล่าง': 90,
    'วิ่งบน': 3.2,
    'วิ่งล่าง': 4.2,
    'ปักหลักหน่วย': 8,
    'ปักหลักสิบ': 8,
    'ปักหลักร้อย': 8,
    '4 ตัวบน': 5000,
    '4 ตัวโต๊ด': 200,
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

  // VIP Live Monitor Filtering State
  const [vipMonitorFilter, setVipMonitorFilter] = useState<'all' | 'vip500' | 'vip1000' | 'vip2000'>('all');

  // Payout Rate Resistance Management State
  const [selectedResistanceLottery, setSelectedResistanceLottery] = useState('หวยรัฐบาล');
  const [resistanceCategoryFilter, setResistanceCategoryFilter] = useState<LotteryCategoryKey>('all');
  const [resistanceRates, setResistanceRates] = useState<Record<string, { baseRate: number; resistanceRate: number; maxExposure: number }>>({
    '3 ตัวบน':   { baseRate: 900, resistanceRate: 800, maxExposure: 20000 },
    '3 ตัวโต๊ด': { baseRate: 150, resistanceRate: 120, maxExposure: 30000 },
    '3 ตัวหน้า': { baseRate: 450, resistanceRate: 400, maxExposure: 20000 },
    '3 ตัวล่าง': { baseRate: 450, resistanceRate: 400, maxExposure: 20000 },
    '3 ตัวกลับ': { baseRate: 900, resistanceRate: 800, maxExposure: 20000 },

    '2 ตัวบน':   { baseRate: 90,  resistanceRate: 80,  maxExposure: 50000 },
    '2 ตัวล่าง': { baseRate: 90,  resistanceRate: 80,  maxExposure: 50000 },
    '2 ตัวกลับ': { baseRate: 90,  resistanceRate: 80,  maxExposure: 50000 },
    '2 ตัวโต๊ด': { baseRate: 12,  resistanceRate: 10,  maxExposure: 60000 },

    'วิ่งบน':    { baseRate: 3.2, resistanceRate: 2.8, maxExposure: 100000 },
    'วิ่งล่าง':  { baseRate: 4.2, resistanceRate: 3.8, maxExposure: 100000 },

    'ปักหลักหน่วย': { baseRate: 8.0, resistanceRate: 7.0, maxExposure: 50000 },
    'ปักหลักสิบ':   { baseRate: 8.0, resistanceRate: 7.0, maxExposure: 50000 },
    'ปักหลักร้อย':  { baseRate: 8.0, resistanceRate: 7.0, maxExposure: 50000 },

    '4 ตัวบน':   { baseRate: 5000, resistanceRate: 4000, maxExposure: 10000 },
    '4 ตัวโต๊ด': { baseRate: 25,   resistanceRate: 20,   maxExposure: 50000 },
    '5 ตัวโต๊ด': { baseRate: 15,   resistanceRate: 12,   maxExposure: 50000 },
  });
  const [resistanceEnabled, setResistanceEnabled] = useState(true);
  const [resistanceAutoReduce, setResistanceAutoReduce] = useState(true);
  const [resistanceDigitGroup, setResistanceDigitGroup] = useState<'3digits' | '2digits' | 'running' | 'pinned' | '4digits'>('3digits');

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
      if (doc.exists()) {
        const d = doc.data();
        setPopupContent({
          title: d.title || '',
          body: d.body || '',
          imageUrl: d.imageUrl || '',
          active: !!d.active,
          type: d.type || 'general',
          target: d.target || 'all',
          targetUsers: d.targetUsers || '',
          showOnce: !!d.showOnce,
          linkUrl: d.linkUrl || '',
          actionText: d.actionText || 'ดูรายละเอียด'
        });
      }
    });

    // Listen to welcome modal
    const unsubscribeWelcome = onSnapshot(doc(db, 'settings', 'welcome'), (doc) => {
      if (doc.exists()) {
        const d = doc.data();
        setWelcomeContent({
          enabled: d.enabled !== false,
          title: d.title || 'ยินดีต้อนรับสู่ AK88 LOTTO! 🎉',
          subtitle: d.subtitle || 'เว็บแทงหวยออนไลน์มาตรฐานระดับสากล อัตราจ่ายสูงสุด บาทละ 1,000',
          bonusNotice: d.bonusNotice || '',
          imageUrl: d.imageUrl || '',
          buttonText: d.buttonText || 'เริ่มต้นใช้งานทันที',
          features: Array.isArray(d.features) ? d.features : [
            'ครบทุกหวยดัง: รัฐบาลไทย ยี่กี 88 รอบ ฮานอย ลาว หุ้น',
            'ระบบฝาก-ถอนเงินออโต้ QR Code สแกนจ่ายปรับยอดไวใน 30 วิ',
            'จ่ายเต็ม ปลอดภัย 100% พร้อมบริการซัพพอร์ตตลอด 24 ชั่วโมง'
          ]
        });
      }
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
      unsubscribeWelcome();
    };
  }, []);

  // Sync selected lottery rules when selection or catalog updates
  useEffect(() => {
    if (selectedRulesLottery && lotterySettings[selectedRulesLottery]) {
      const lot = lotterySettings[selectedRulesLottery];
      setLotteryRulesText(lot.rules?.text || '');
      setLotteryRulesImageUrl(lot.rules?.imageUrl || '');
    } else if (!selectedRulesLottery && Object.keys(lotterySettings).length > 0) {
      const firstKey = Object.keys(lotterySettings)[0];
      setSelectedRulesLottery(firstKey);
      setLotteryRulesText(lotterySettings[firstKey]?.rules?.text || '');
      setLotteryRulesImageUrl(lotterySettings[firstKey]?.rules?.imageUrl || '');
    }
  }, [selectedRulesLottery, lotterySettings]);

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
      // 1) ★ ตรวจสอบพนักงานในตาราง 'staff'
      const { getDocs, query, where, collection: col } = await import('firebase/firestore');
      const snap = await getDocs(query(col(db, 'staff'), where('username', '==', adminUser.trim())));
      if (!snap.empty) {
        const s: any = { id: snap.docs[0].id, ...snap.docs[0].data() };
        if (s.status === 'suspended') { alert('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ'); return; }

        // ตรวจสอบรหัสผ่านอย่างปลอดภัย
        if (s.password && s.password !== adminPass.trim()) {
          alert('รหัสผ่านไม่ถูกต้อง');
          return;
        }

        const sess: StaffSession = {
          uid: s.id,
          username: s.username,
          displayName: s.displayName || s.username,
          role: (s.role || 'staff') as RoleKey,
          grantedExtra: s.grantedExtra || [],
          revoked: s.revoked || [],
          scopeProjectIds: s.scopeProjectIds || [],
        };
        // เรียกการยืนยันตัวตน 2 ชั้น (2FA)
        if (s.twoFactor?.enabled === false) {
          saveSession(sess);
          setSession(sess);
          setIsAdminLoggedIn(true);
          return;
        }
        setTwoFactorAllowBypass(s.twoFactor?.allowBypass !== false);
        setTwoFactorEnforceScan(s.twoFactor?.enforceScan === true);
        setPendingSession(sess);
        setShowTwoFactorModal(true);
        return;
      }
    } catch (e) {
      console.warn('[login] staff lookup failed, falling back:', e);
    }

    // 2) บัญชีผู้ดูแลระบบหลักเริ่มต้น (Owner / Super Admin: 1234 / 123456)
    const userLower = adminUser.trim().toLowerCase();
    const passTrim = adminPass.trim();
    if (
      (userLower === '1234' && passTrim === '123456') ||
      (userLower === 'owner' && (passTrim === '123456' || passTrim === 'owner')) ||
      (userLower === 'admin' && (passTrim === '123456' || passTrim === 'admin'))
    ) {
      const isOwner = userLower === 'owner' || userLower === '1234';
      const sess: StaffSession = {
        uid: userLower === '1234' ? 'staff_1234' : (isOwner ? 'staff_owner_01' : 'staff_admin_01'),
        username: userLower,
        displayName: userLower === '1234' ? 'ผู้บริหารระบบ AK88 (Admin 1234)' : (isOwner ? 'เจ้าของระบบ (Owner)' : 'ผู้ดูแลระบบสูงสุด (Admin)'),
        role: 'owner',
        grantedExtra: [] as Permission[],
        revoked: [],
        scopeProjectIds: [],
      };

      // บันทึกลงตาราง staff ใน Firestore อัตโนมัติ เพื่อให้ระบบมีข้อมูลพนักงาน
      try {
        await setDoc(doc(db, 'staff', sess.uid), {
          username: sess.username,
          password: passTrim,
          displayName: sess.displayName,
          role: sess.role,
          status: 'active',
          lastLogin: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch {}

      // เรียกการยืนยันตัวตน 2 ชั้น (2FA) รองรับข้ามขั้นตอนเพื่อทดสอบ
      setTwoFactorAllowBypass(true);
      setTwoFactorEnforceScan(false);
      setPendingSession(sess);
      setShowTwoFactorModal(true);
      return;
    }

    alert('Username หรือ รหัสผ่านไม่ถูกต้อง');
  };

  const handleTwoFactorSuccess = async () => {
    if (pendingSession) {
      saveSession(pendingSession);
      setSession(pendingSession);
      setIsAdminLoggedIn(true);
      await logActivity('เข้าสู่ระบบ (ผ่าน 2FA)', `ผู้ดูแลระบบ (${pendingSession.displayName}) ยืนยันรหัส 2FA สำเร็จ`, 'security');
    }
    setShowTwoFactorModal(false);
    setPendingSession(null);
  };

  const handleTwoFactorCancel = () => {
    setShowTwoFactorModal(false);
    setPendingSession(null);
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

  // ★ ลบประเภทหวยที่ไม่ต้องการออกจากระบบ
  const handleDeleteLottery = async (type: string) => {
    if (!window.confirm(`⚠️ ยืนยันการลบ "${type}" ออกจากระบบหรือไม่?\nข้อมูลรอบและอัตราจ่ายของหวยนี้จะถูกลบออกจากฐานข้อมูลทันที`)) return;
    try {
      await deleteDoc(doc(db, 'lotteryTypes', type));
      await logActivity('ลบประเภทหวย', `ลบหวย ${type} ออกจากระบบ`, 'lottery');
      alert(`ลบ ${type} ออกจากระบบสำเร็จ`);
    } catch (e) {
      console.error(e);
      alert('ไม่สามารถลบประเภทหวยนี้ได้');
    }
  };

  const applyOnlyThreeLotteries = async () => {
    try {
      const types = Object.keys(lotterySettings);
      await Promise.all(types.map(type => {
        const shouldOpen = isAllowedOpenLottery(type);
        return setDoc(doc(db, 'lotteryTypes', type), { 
          isOpen: shouldOpen,
          status: shouldOpen ? 'open' : 'closed',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }));

      // ตรวจสอบและเปิดรอบให้ หุ้นไทยเช้า
      const now = new Date();
      const nextMorning = new Date(now);
      nextMorning.setHours(10, 0, 0, 0);
      if (nextMorning.getTime() <= now.getTime()) {
        nextMorning.setDate(nextMorning.getDate() + 1);
      }
      await setDoc(doc(db, 'lotteryTypes', 'หุ้นไทยเช้า'), {
        id: 'หุ้นไทยเช้า',
        name: 'หุ้นไทยเช้า',
        category: 'stock',
        icon: '🇹🇭',
        path: '/lottery/stock/thai-morning',
        isOpen: true,
        status: 'open',
        closingTime: nextMorning.toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // ตรวจสอบและเปิดรอบให้ หวยรัฐบาลไทย
      await setDoc(doc(db, 'lotteryTypes', 'หวยรัฐบาลไทย'), {
        id: 'หวยรัฐบาลไทย',
        name: 'หวยรัฐบาลไทย',
        category: 'thai',
        icon: '🇹🇭',
        path: '/lottery/thai',
        isOpen: true,
        status: 'open',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // ตรวจสอบและเปิดรอบให้ หวยยี่กี 88 รอบ
      await setDoc(doc(db, 'lotteryTypes', 'หวยยี่กี 88 รอบ'), {
        id: 'หวยยี่กี 88 รอบ',
        name: 'หวยยี่กี 88 รอบ',
        category: 'yeekee',
        icon: '⏱️',
        path: '/lottery/yeekee',
        isOpen: true,
        status: 'open',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await logActivity('เปิด 3 หวยหลัก', 'เปิดเฉพาะ หวยไทย, หุ้นไทยเช้า, ยี่กี และปิดหวยอื่นทั้งหมด', 'lottery');
    } catch (e: any) {
      console.error('applyOnlyThreeLotteries failed:', e);
      throw e;
    }
  };

  const syncAllLotteries = async () => {
    if(!window.confirm(`ระบบจะซิงค์ประเภทหวยทั้งหมด (${MASTER_LOTTERY_CATALOG.length} รายการ) พร้อมจัดหมวดหมู่ให้ตรงกันทั้งหน้าบ้านและหลังบ้าน ดำเนินการต่อหรือไม่?`)) return;
    
    try {
      for (const item of MASTER_LOTTERY_CATALOG) {
        const found = Object.values(lotterySettings).find((l: any) => l.name === item.name || l.id === item.name);
        const docId = found ? (found as any).id || item.name : item.name;
        const shouldOpen = isAllowedOpenLottery(item.name);
        
        await setDoc(doc(db, 'lotteryTypes', docId), {
          id: docId,
          name: item.name,
          category: item.category,
          icon: item.icon,
          path: item.path,
          isOpen: shouldOpen,
          isHidden: false,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      alert(`✅ ซิงค์ข้อมูลหวยครบถ้วน ${MASTER_LOTTERY_CATALOG.length} รายการ จัดหมวดหมู่ตรงกันทั้งหน้าบ้านและหลังบ้านเรียบร้อยแล้วค่ะ`);
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการซิงค์ข้อมูลหวย');
    }
  };

  // Sync resistance rates when selected lottery changes
  useEffect(() => {
    if (!selectedResistanceLottery) return;
    const unsub = onSnapshot(doc(db, 'payout_resistance', selectedResistanceLottery), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.rates) {
          setResistanceRates(prev => ({ ...prev, ...data.rates }));
        }
        if (data.enabled !== undefined) setResistanceEnabled(data.enabled);
        if (data.autoReduceOnExposure !== undefined) setResistanceAutoReduce(data.autoReduceOnExposure);
      } else {
        const currentLottery = lotterySettings[selectedResistanceLottery];
        if (currentLottery?.rates) {
          setResistanceRates(prev => {
            const updated = { ...prev };
            Object.keys(currentLottery.rates).forEach(k => {
              if (updated[k]) {
                updated[k].baseRate = currentLottery.rates[k];
              }
            });
            return updated;
          });
        }
      }
    });
    return () => unsub();
  }, [selectedResistanceLottery, lotterySettings]);

  const saveResistanceSettings = async (applyToAll: boolean = false) => {
    try {
      const dataToSave = {
        enabled: resistanceEnabled,
        autoReduceOnExposure: resistanceAutoReduce,
        rates: resistanceRates,
        updatedAt: new Date().toISOString()
      };

      if (applyToAll) {
        const lotteries = Object.keys(lotterySettings);
        if (lotteries.length === 0) {
          alert('ไม่พบรายการหวยในระบบ');
          return;
        }
        if (!confirm(`คุณต้องการนำการตั้งค่าต้านทานอัตราจ่ายนี้ไปใช้กับหวยทั้งหมด ${lotteries.length} ประเภทใช่หรือไม่?`)) {
          return;
        }

        const flatRates: Record<string, number> = {};
        Object.keys(resistanceRates).forEach(k => {
          flatRates[k] = resistanceRates[k].baseRate;
        });

        for (const lotId of lotteries) {
          await setDoc(doc(db, 'payout_resistance', lotId), {
            id: lotId,
            lotteryId: lotId,
            ...dataToSave
          }, { merge: true });

          await setDoc(doc(db, 'lotteryTypes', lotId), {
            rates: flatRates,
            hasResistance: true,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }

        await logActivity('ตั้งค่าต้านทานทุกหวย', `นำระบบต้านทานอัตราจ่ายไปใช้กับหวยทั้งหมด ${lotteries.length} รายการ`, 'lottery');
        alert(`✅ นำระบบต้านทานอัตราจ่ายไปใช้กับหวยทั้งหมด ${lotteries.length} รายการสำเร็จเรียบร้อย`);
      } else {
        await setDoc(doc(db, 'payout_resistance', selectedResistanceLottery), {
          id: selectedResistanceLottery,
          lotteryId: selectedResistanceLottery,
          ...dataToSave
        }, { merge: true });

        const flatRates: Record<string, number> = {};
        Object.keys(resistanceRates).forEach(k => {
          flatRates[k] = resistanceRates[k].baseRate;
        });

        await setDoc(doc(db, 'lotteryTypes', selectedResistanceLottery), {
          rates: flatRates,
          hasResistance: true,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        await logActivity('ตั้งค่าต้านทานหวย', `บันทึกระบบต้านทานอัตราจ่ายสำหรับ ${selectedResistanceLottery}`, 'lottery');
        alert(`✅ บันทึกระบบต้านทานอัตราจ่ายสำหรับ ${selectedResistanceLottery} สำเร็จ`);
      }
    } catch (e: any) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + e.message);
    }
  };

  const resetResistanceDefaults = () => {
    if (!confirm('ต้องการคืนค่าอัตราจ่ายและเพดานต้านทานเป็นค่ามาตรฐานใช่หรือไม่?')) return;
    setResistanceRates({
      '3 ตัวบน':   { baseRate: 900, resistanceRate: 800, maxExposure: 20000 },
      '3 ตัวโต๊ด': { baseRate: 150, resistanceRate: 120, maxExposure: 30000 },
      '3 ตัวหน้า': { baseRate: 450, resistanceRate: 400, maxExposure: 20000 },
      '3 ตัวล่าง': { baseRate: 450, resistanceRate: 400, maxExposure: 20000 },
      '3 ตัวกลับ': { baseRate: 900, resistanceRate: 800, maxExposure: 20000 },

      '2 ตัวบน':   { baseRate: 90,  resistanceRate: 80,  maxExposure: 50000 },
      '2 ตัวล่าง': { baseRate: 90,  resistanceRate: 80,  maxExposure: 50000 },
      '2 ตัวกลับ': { baseRate: 90,  resistanceRate: 80,  maxExposure: 50000 },
      '2 ตัวโต๊ด': { baseRate: 12,  resistanceRate: 10,  maxExposure: 60000 },

      'วิ่งบน':    { baseRate: 3.2, resistanceRate: 2.8, maxExposure: 100000 },
      'วิ่งล่าง':  { baseRate: 4.2, resistanceRate: 3.8, maxExposure: 100000 },

      'ปักหลักหน่วย': { baseRate: 8.0, resistanceRate: 7.0, maxExposure: 50000 },
      'ปักหลักสิบ':   { baseRate: 8.0, resistanceRate: 7.0, maxExposure: 50000 },
      'ปักหลักร้อย':  { baseRate: 8.0, resistanceRate: 7.0, maxExposure: 50000 },

      '4 ตัวบน':   { baseRate: 5000, resistanceRate: 4000, maxExposure: 10000 },
      '4 ตัวโต๊ด': { baseRate: 25,   resistanceRate: 20,   maxExposure: 50000 },
      '5 ตัวโต๊ด': { baseRate: 15,   resistanceRate: 12,   maxExposure: 50000 },
    });
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
    if (!selectedUserForCredit) return;
    
    // Check Source of Funds (Agent or Master)
    const currentAgent = agents.find(a => a.id === selectedUserForCredit.agentId);
    const sourceName = currentAgent ? `เอเย่นต์ (${currentAgent.name})` : 'มาสเตอร์ (Master)';
    const sourceBalance = currentAgent ? (currentAgent.creditLimit || 0) : (globalSettings?.masterBalance ?? 150000000);

    const oldBal = selectedUserForCredit.balance || 0;
    let newBalance = oldBal;
    let delta = 0;

    if (creditAction === 'add') {
      if (creditAmount <= 0) return;
      newBalance = oldBal + creditAmount;
      delta = creditAmount;
      if (sourceBalance < creditAmount) {
        alert(`ยอดเครดิต ${sourceName} ไม่เพียงพอสำหรับการเติมเงิน`);
        return;
      }
    } else if (creditAction === 'reduce') {
      if (creditAmount <= 0) return;
      newBalance = oldBal - creditAmount;
      delta = -creditAmount;
      if (newBalance < 0) {
        alert('เครดิตสมาชิกไม่เพียงพอที่จะลด');
        return;
      }
    } else if (creditAction === 'set') {
      newBalance = creditAmount;
      delta = creditAmount - oldBal;
      if (newBalance < 0) {
        alert('ยอดเครดิตต้องไม่ติดลบ');
        return;
      }
      if (delta > 0 && sourceBalance < delta) {
        alert(`ยอดเครดิต ${sourceName} ไม่เพียงพอสำหรับการปรับยอด`);
        return;
      }
    }

    const actionText = creditAction === 'set' 
      ? `กำหนดเครดิตใหม่เป็น ฿${newBalance.toLocaleString()}` 
      : `${creditAction === 'add' ? 'เติม' : 'ลด'}เครดิต ฿${creditAmount.toLocaleString()}`;

    if (window.confirm(`ยืนยันการ${actionText} ให้กับสมาชิก ${selectedUserForCredit.username}?`)) {
      try {
        const userRef = doc(db, 'users', selectedUserForCredit.id);

        // Apply Balance Update to Member
        await updateDoc(userRef, { balance: newBalance });
        
        // Deduct/Add back to Source (Agent or Master)
        if (delta !== 0) {
          if (currentAgent) {
            const newAgentCredit = sourceBalance - delta;
            await updateDoc(doc(db, 'agents', currentAgent.id), { creditLimit: newAgentCredit });
          } else {
            const newMasterBalance = sourceBalance - delta;
            await updateGlobalSetting('masterBalance', newMasterBalance);
          }
        }

        // Record formal financial transaction
        const noteText = creditNote.trim() || `${creditAction === 'set' ? 'กำหนดเครดิตใหม่' : creditAction === 'add' ? 'เติมเครดิต' : 'ลดเครดิต'}โดยแอดมิน (${sourceName})`;
        await addDoc(collection(db, 'transactions'), {
          userId: selectedUserForCredit.id,
          username: selectedUserForCredit.username,
          type: delta >= 0 ? 'admin_transfer' : 'admin_pullback',
          amount: Math.abs(delta),
          status: 'success',
          createdAt: new Date().toISOString(),
          description: noteText,
          adminId: 'Admin'
        });

        // Log Activity
        await logActivity(
          creditAction === 'set' ? 'กำหนดเครดิตสมาชิก' : creditAction === 'add' ? 'เติมเครดิตสมาชิก' : 'ลดเครดิตสมาชิก',
          `${actionText} ให้ ${selectedUserForCredit.username} (${noteText})`,
          'credit'
        );

        alert(`ทำรายการสำเร็จ! เครดิตใหม่ของ ${selectedUserForCredit.username} คือ ฿${newBalance.toLocaleString()}`);
        setShowCreditModal(false);
        setCreditAmount(0);
        setCreditNote('');
      } catch (e) {
        console.error(e);
        alert('เกิดข้อผิดพลาดในการปรับปรุงเครดิต');
      }
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = newMemberForm.username.trim().toLowerCase();
    const cleanPhone = newMemberForm.phoneNumber.replace(/[^0-9]/g, '');

    if (!cleanUsername || cleanUsername.length < 4) {
      alert('ชื่อผู้ใช้งานต้องมีอย่างน้อย 4 ตัวอักษร');
      return;
    }
    if (!newMemberForm.password || newMemberForm.password.length < 6) {
      alert('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (!/^0[689]\d{8}$/.test(cleanPhone)) {
      alert('หมายเลขโทรศัพท์ไม่ถูกต้อง (ต้องเป็น 10 หลัก เช่น 0812345678)');
      return;
    }

    setIsCreatingMember(true);
    try {
      // 1) ตรวจสอบความซ้ำ
      const qUser = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const snapUser = await getDocs(qUser);
      if (!snapUser.empty) {
        alert('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น');
        setIsCreatingMember(false);
        return;
      }

      const qPhone = query(collection(db, 'users'), where('phoneNumber', '==', cleanPhone));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        alert('เบอร์โทรศัพท์นี้ถูกลงทะเบียนไว้ในระบบแล้ว');
        setIsCreatingMember(false);
        return;
      }

      const initBal = Math.max(0, Number(newMemberForm.initialCredit) || 0);
      const newUserDoc = {
        username: cleanUsername,
        password: newMemberForm.password,
        phoneNumber: cleanPhone,
        firstName: newMemberForm.firstName.trim() || cleanUsername,
        lastName: newMemberForm.lastName.trim() || '',
        name: `${newMemberForm.firstName.trim()} ${newMemberForm.lastName.trim()}`.trim() || cleanUsername,
        bankName: newMemberForm.bankName || 'ธนาคารกสิกรไทย (KBANK)',
        bankAccount: newMemberForm.bankAccount.trim() || 'xxx-x-xxxxx',
        balance: initBal,
        role: 'user',
        status: 'active',
        agentId: newMemberForm.agentId || 'master',
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'users'), newUserDoc);

      if (initBal > 0) {
        await addDoc(collection(db, 'transactions'), {
          userId: docRef.id,
          username: cleanUsername,
          type: 'admin_deposit',
          amount: initBal,
          status: 'success',
          description: 'เติมเครดิตเปิดบัญชีใหม่โดยแอดมิน',
          createdAt: new Date().toISOString(),
        });
      }

      await logActivity('สมัครสมาชิกใหม่', `แอดมินสร้างบัญชี ${cleanUsername} เครดิตเริ่มต้น ฿${initBal.toLocaleString()}`, 'system');

      alert(`สมัครสมาชิกสำเร็จ! รหัสผู้ใช้: ${cleanUsername} พร้อมเครดิต ฿${initBal.toLocaleString()}`);
      setShowAddMemberModal(false);
      setNewMemberForm({
        username: '',
        password: '',
        phoneNumber: '',
        firstName: '',
        lastName: '',
        bankName: 'ธนาคารกสิกรไทย (KBANK)',
        bankAccount: '',
        initialCredit: 0,
        agentId: '',
      });
    } catch (err: any) {
      console.error('Failed to create member:', err);
      alert(err.message || 'เกิดข้อผิดพลาดในการสร้างสมาชิก');
    } finally {
      setIsCreatingMember(false);
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
      // หมายเหตุ: Vercel เป็น static hosting (ไม่มี /api) — ห้ามเรียก /api/v1/results/settle ซ้ำ
      // เพราะ loop ด้านล่างจ่ายเงินฝั่ง client อยู่แล้ว ถ้าเรียกทั้งคู่จะจ่ายซ้ำ 2 รอบ
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
        
        if (!winner.userId) continue;
        
        // Update user balance and record transaction
        const userRef = doc(db, 'users', winner.userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentBalance = userSnap.data().balance || 0;
          await updateDoc(userRef, { balance: currentBalance + finalWinAmount });

          const taxNote = winner.taxAmount > 0 
            ? ` (ภาษี ${winner.taxRate}%: -฿${winner.taxAmount.toLocaleString()}, จ่ายสุทธิ ฿${finalWinAmount.toLocaleString()})`
            : '';

          await addDoc(collection(db, 'transactions'), {
            userId: winner.userId,
            username: winner.username || 'สมาชิก',
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

  /* ==================================================================
   * ★ แท็บทั้งหมด พร้อมสิทธิ์ที่ต้องมี
   * ------------------------------------------------------------------
   * ผู้ใช้ขอ: "ทำระบบ จัดการสิทธิ์ฟังชั่น เพื่อปิดสิทธิ์ให้พนักงาน"
   * แท็บไหนไม่มีสิทธิ์ → ซ่อนจากเมนูเลย (ไม่ใช่แค่กดไม่ได้)
   * ================================================================== */
  const ALL_TABS: { id: AdminTab; label: string; icon: string; perm: Permission; section: string; tier: 'staff' | 'master' }[] = [
    // --- 🟢 ส่วนที่ 1: งานประจำวันของแอดมิน (5 เมนูหลัก) ---
    { id: 'finance',           label: '1. การเงิน & ฝาก-ถอน',   icon: 'account_balance_wallet', perm: PERMISSIONS.FINANCE_VIEW,   section: 'งานประจำวัน (แอดมิน)', tier: 'staff' },
    { id: 'reports',           label: '2. รายการโพย & บิล',     icon: 'receipt_long',           perm: PERMISSIONS.REPORT_VIEW,    section: 'งานประจำวัน (แอดมิน)', tier: 'staff' },
    { id: 'lottery_control',   label: '3. ตรวจผล & เปิด-ปิดหวย',icon: 'toggle_on',              perm: PERMISSIONS.SETTINGS_VIEW,  section: 'งานประจำวัน (แอดมิน)', tier: 'staff' },
    { id: 'members',           label: '4. จัดการสมาชิก & เครดิต',icon: 'group',                 perm: PERMISSIONS.MEMBER_VIEW,    section: 'งานประจำวัน (แอดมิน)', tier: 'staff' },
    { id: 'overview',          label: '5. ภาพรวม & สรุปยอด',   icon: 'dashboard',              perm: PERMISSIONS.DASHBOARD_VIEW, section: 'งานประจำวัน (แอดมิน)', tier: 'staff' },

    // --- 👑 ส่วนที่ 2: โหมดเจ้าของ / ระบบคำนวณความเสี่ยงและอัตราจ่าย (Master Mode) ---
    { id: 'payout_rates',      label: '1. ตั้งค่าจ่าย & ขั้นต่ำ-สูงสุด', icon: 'payments',       perm: PERMISSIONS.SETTINGS_VIEW,  section: 'โหมดเจ้าของ (Master)', tier: 'master' },
    { id: 'intake_settings',   label: '2. ตั้งค่ารับกิน & งบประมาณ',  icon: 'tune',            perm: PERMISSIONS.SETTINGS_VIEW,  section: 'โหมดเจ้าของ (Master)', tier: 'master' },
    { id: 'intake_monitor',    label: '3. ศูนย์ตรวจจับรับกินสด',      icon: 'monitoring',      perm: PERMISSIONS.SETTINGS_VIEW,  section: 'โหมดเจ้าของ (Master)', tier: 'master' },
    { id: 'round_scheduler',   label: '4. จัดตารางรอบ & ปฏิทินหวย',   icon: 'calendar_month',  perm: PERMISSIONS.SETTINGS_VIEW,  section: 'โหมดเจ้าของ (Master)', tier: 'master' },
    { id: 'blocked_numbers',   label: '5. เลขอั้น & ลดราคาจ่าย',      icon: 'block',           perm: PERMISSIONS.SETTINGS_VIEW,  section: 'โหมดเจ้าของ (Master)', tier: 'master' },
    { id: 'staff',             label: 'พนักงาน & กำหนดสิทธิ์',        icon: 'manage_accounts', perm: PERMISSIONS.STAFF_VIEW,     section: 'โหมดเจ้าของ (Master)', tier: 'master' },
    { id: 'settings',          label: 'ตั้งค่าระบบแม่ & กติกา',       icon: 'settings',        perm: PERMISSIONS.SETTINGS_VIEW,  section: 'โหมดเจ้าของ (Master)', tier: 'master' },
    { id: 'system_control',    label: 'เปิด-ปิดระบบฉุกเฉิน',         icon: 'power_settings_new', perm: PERMISSIONS.SETTINGS_VIEW, section: 'โหมดเจ้าของ (Master)', tier: 'master' },
    { id: 'history',           label: 'ประวัติ & ความปลอดภัย',        icon: 'history',         perm: PERMISSIONS.SETTINGS_HISTORY_VIEW, section: 'โหมดเจ้าของ (Master)', tier: 'master' },
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

  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative">
        <div className="admin-card bg-white p-8 rounded-2xl border border-slate-200/90 shadow-xl shadow-blue-900/10 w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-black shadow-sm mb-3">
              <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">Admin Backoffice</h1>
            <p className="text-slate-500 text-xs mt-1">ระบบบริหารจัดการหลังบ้านอย่างเป็นทางการ (พร้อมระบบความปลอดภัย 2FA)</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">ชื่อผู้ใช้งาน (Username)</label>
              <input 
                type="text" 
                placeholder="ระบุ Username (เช่น 1234)"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">รหัสผ่าน (Password)</label>
              <input 
                type="password" 
                placeholder="ระบุรหัสผ่าน (เช่น 123456)"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdminLogin(); }}
                className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-600 focus:bg-white transition"
              />
            </div>
            <button 
              onClick={handleAdminLogin}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white p-3.5 rounded-xl font-black shadow-md shadow-blue-700/25 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">lock_open</span>
              <span>เข้าสู่ระบบหลังบ้าน</span>
            </button>
          </div>
        </div>

        {/* โมดอลยืนยัน 2FA */}
        <TwoFactorModal
          isOpen={showTwoFactorModal}
          username={pendingSession?.username || adminUser}
          userId={pendingSession?.uid || 'staff_1234'}
          role={pendingSession?.role || 'owner'}
          allowBypass={twoFactorAllowBypass}
          enforceScan={twoFactorEnforceScan}
          onSuccess={handleTwoFactorSuccess}
          onCancel={handleTwoFactorCancel}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar */}
      <aside
        className="w-64 bg-white border-r border-slate-200/90 flex flex-col fixed inset-y-0 shadow-lg shadow-blue-950/5 z-50"
      >
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-black shadow-xs">
                <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-blue-700">Administrator</div>
                <div className="text-sm font-black leading-tight text-slate-900">Lottery Hub</div>
              </div>
            </div>
            <button
              onClick={() => {
                const anyClosed = Object.values(expandedSections).some(v => !v);
                setExpandedSections({
                  'ภาพรวม & การเงิน': anyClosed,
                  'จัดการหวย & มอนิเตอร์': anyClosed,
                  'จัดการเลขอั้น (เลขลด/ปิด)': anyClosed,
                  'สมาชิก & บุคลากร': anyClosed,
                  'การตั้งค่าระบบ & ประกาศ': anyClosed,
                  'API & ความปลอดภัย': anyClosed,
                  'ศูนย์ควบคุมพิเศษ': anyClosed,
                });
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              title="ขยาย/ยุบเมนูทั้งหมด"
            >
              <span className="material-symbols-outlined text-base">unfold_more</span>
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          {/* 🟢 ส่วนที่ 1: งานประจำวัน (แอดมิน - 5 เมนูหลัก) */}
          <div className="rounded-xl border border-blue-200 overflow-hidden bg-white shadow-sm">
            <div className="px-3 py-2 bg-blue-50/90 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-blue-700">task_alt</span>
                <span className="text-xs font-black text-blue-900">งานประจำวัน (แอดมิน)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-blue-200 text-blue-900">5 เมนูหลัก</span>
            </div>
            <div className="p-1.5 space-y-1 bg-white">
              {tabs.filter(t => t.tier === 'staff').map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                      isActive
                        ? 'bg-blue-700 text-white font-black shadow-md shadow-blue-700/25 translate-x-0.5'
                        : 'text-slate-700 hover:text-blue-700 hover:bg-blue-50/70 hover:translate-x-0.5'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-lg ${isActive ? 'text-white' : 'text-slate-400'}`}>
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 👑 ส่วนที่ 2: โหมดเจ้าของ (Master Mode) */}
          {(isMasterUnlocked || session?.role === 'owner' || session?.role === 'master') ? (
            <div className="rounded-xl border border-amber-300 overflow-hidden bg-white shadow-sm mt-3">
              <div className="px-3 py-2 bg-gradient-to-r from-amber-50 to-amber-100/80 border-b border-amber-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-amber-700">verified_user</span>
                  <span className="text-xs font-black text-amber-950">โหมดเจ้าของ (Master Mode)</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsMasterUnlocked(false);
                    localStorage.removeItem('masterUnlocked');
                    setActiveTab('finance');
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-200/80 hover:bg-amber-300 text-amber-900 font-bold transition flex items-center gap-0.5"
                  title="คลิกเพื่อล็อคโหมดเจ้าของ"
                >
                  <span className="material-symbols-outlined text-[11px]">lock</span>
                  <span>ล็อค</span>
                </button>
              </div>
              <div className="p-1.5 space-y-1 bg-amber-50/20">
                {tabs.filter(t => t.tier === 'master').map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
                        isActive
                          ? 'bg-amber-600 text-white font-black shadow-md shadow-amber-600/25 translate-x-0.5'
                          : 'text-amber-950 hover:text-amber-800 hover:bg-amber-100/60 hover:translate-x-0.5'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-lg ${isActive ? 'text-white' : 'text-amber-600'}`}>
                        {tab.icon}
                      </span>
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50/60 to-white p-3 shadow-2xs mt-3 text-center space-y-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-base">lock</span>
              </div>
              <div>
                <div className="text-xs font-black text-slate-800">โหมดเจ้าของ (Master)</div>
                <div className="text-[10px] text-slate-500">เลขอั้น, เรทจ่าย, คุมงบ, ระบบแม่</div>
              </div>
              <button
                type="button"
                onClick={() => setShowMasterPinModal(true)}
                className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1 cursor-pointer transition"
              >
                <span className="material-symbols-outlined text-sm">key</span>
                <span>🔐 ปลดล็อกโหมดเจ้าของ</span>
              </button>
            </div>
          )}

          {/* Special Control Center Accordion (Hidden from dynamic mapping) */}
          {false && [].map(sec => {
            const sectionTabs = tabs.filter(t => t.section === sec.title);
            if (sectionTabs.length === 0) return null;
            const isExpanded = expandedSections[sec.title] ?? true;
            const isCurrentSectionActive = sectionTabs.some(t => t.id === activeTab);

            return (
              <div key={sec.title} className="rounded-xl border border-slate-100 overflow-hidden bg-white shadow-2xs">
                {/* Accordion Section Header */}
                <button
                  type="button"
                  onClick={() => toggleSection(sec.title)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition ${
                    isCurrentSectionActive
                      ? 'bg-blue-50/80 text-blue-900 font-black'
                      : 'hover:bg-slate-50 text-slate-700 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`material-symbols-outlined text-base ${isCurrentSectionActive ? 'text-blue-700' : 'text-slate-400'}`}>
                      {sec.icon}
                    </span>
                    <span className="text-xs truncate">{sec.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isCurrentSectionActive ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {sectionTabs.length}
                    </span>
                    <span className={`material-symbols-outlined text-sm text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </div>
                </button>

                {/* Accordion Tab Items */}
                {isExpanded && (
                  <div className="p-1.5 space-y-1 bg-slate-50/50 border-t border-slate-100">
                    {sectionTabs.map(tab => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                            isActive
                              ? 'bg-blue-700 text-white font-black shadow-sm shadow-blue-700/25 translate-x-0.5'
                              : 'text-slate-600 hover:text-blue-700 hover:bg-white hover:translate-x-0.5'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-base ${isActive ? 'text-white' : 'text-slate-400'}`}>
                            {tab.icon}
                          </span>
                          <span className="truncate">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Special Control Center Accordion */}
          <div className="rounded-xl border border-amber-200/80 overflow-hidden bg-white shadow-2xs mt-2">
            <button
              type="button"
              onClick={() => toggleSection('ศูนย์ควบคุมพิเศษ')}
              className="w-full flex items-center justify-between px-3 py-2 text-left bg-amber-50/80 hover:bg-amber-100/70 text-amber-950 font-black transition"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-amber-600">stars</span>
                <span className="text-xs">ศูนย์ควบคุมพิเศษ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-amber-200 text-amber-900">
                  3
                </span>
                <span className={`material-symbols-outlined text-sm text-amber-600 transition-transform duration-200 ${(expandedSections['ศูนย์ควบคุมพิเศษ'] ?? true) ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </div>
            </button>

            {(expandedSections['ศูนย์ควบคุมพิเศษ'] ?? true) && (
              <div className="p-1.5 space-y-1 bg-amber-50/30 border-t border-amber-100">
                <Link
                  to="/admin/yeekee"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-bold text-xs transition border border-amber-200 bg-amber-50/80 text-amber-900 hover:bg-amber-100/80"
                >
                  <span className="material-symbols-outlined text-base text-amber-600">timer</span>
                  <span>★ หวยยี่กี 88 รอบ</span>
                </Link>
                <Link
                  to="/admin/game20"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-bold text-xs transition border border-slate-200 bg-white text-slate-700 hover:bg-blue-50/50 hover:text-blue-700"
                >
                  <span className="material-symbols-outlined text-base text-slate-500">casino</span>
                  <span>หวย 20 ช่อง 6 หลัก</span>
                </Link>
                <Link
                  to="/admin/manual"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-bold text-xs transition text-slate-500 hover:text-slate-800 hover:bg-white"
                >
                  <span className="material-symbols-outlined text-base text-slate-400">menu_book</span>
                  <span>คู่มือ & รหัสผ่าน</span>
                </Link>
              </div>
            )}
          </div>
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
      <main className="flex-1 ml-64 p-6 bg-slate-50 min-h-screen">
        <header
          className="flex justify-between items-center mb-6 p-5 rounded-2xl shadow-sm border border-slate-200/90 bg-white shadow-blue-900/5"
        >
          <div>
            <h2 className="text-2xl font-black" style={{ color: 'var(--admin-text)' }}>
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
              จัดการระบบหลังบ้าน {tabs.find(t => t.id === activeTab)?.label.toLowerCase()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="px-3.5 py-2 rounded-xl font-black text-xs shadow-sm flex items-center gap-1.5 transition hover:brightness-105"
              style={{ background: '#f5c518', color: '#0a192f' }}
            >
              <span className="material-symbols-outlined text-sm">storefront</span>
              ดูหน้าบ้านสมาชิก
            </Link>
            <div className="text-right hidden md:block">
              <div className="text-sm font-black" style={{ color: 'var(--admin-text)' }}>Super Admin</div>
              <div className="text-[10px] font-bold flex items-center justify-end gap-1" style={{ color: '#2e7d32' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4caf50' }}></span>
                Online
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'var(--admin-subtle)' }}>
              <span className="material-symbols-outlined text-lg" style={{ color: 'var(--admin-accent-dark)' }}>person</span>
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
                  label="สมาชิกทั้งหมด"
                  value={users.length}
                  icon="group"
                  currency={false}
                  tone="default"
                  size="md"
                  hint={`ผู้ใช้งานเว็บตรง`}
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

              {/* 📊 กราฟวิเคราะห์ความเสี่ยงและเส้นทางรับกินสด (Risk Probability & Intake Curve) */}
              <div className="admin-card p-6">
                <RiskProbabilityChart
                  selectedLottery="หวยรัฐบาลไทย"
                  currentIntakeTotal={tickets.reduce((sum, t) => sum + (t.totalAmount || 0), 0)}
                  maxLiability={tickets.reduce((sum, t) => sum + (t.totalAmount || 0), 0) * 0.9}
                />
              </div>

              {/* Live Intake Hub Highlights */}
              <div className="bg-[var(--navy-deep)] p-8 rounded-3xl shadow-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--gold-vibrant)] opacity-5 blur-[80px] -mr-32 -mt-32"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <h3 className="text-2xl font-black text-[var(--gold-vibrant)] mb-2 flex items-center gap-3">
                      <span className="material-symbols-outlined animate-pulse">radar</span>
                      Live Intake & Exposure Hub
                    </h3>
                    <p className="text-gray-400 text-sm max-w-lg">ดูรายการเดิมพันและสถานะระบบแบบ Real-time ได้ที่เมนูศูนย์ตรวจจับรับกินสด หรือกดปุ่มด้านขวาเพื่อเปิดหน้าต่างตรวจจับรับกินสดโดยเฉพาะ</p>
                  </div>
                  <button 
                    onClick={() => { setActiveTab('intake_monitor'); }}
                    className="bg-[var(--gold-vibrant)] text-[var(--navy-deep)] px-8 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined font-black">visibility</span>
                    เปิดศูนย์ตรวจจับสด
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 1. ตั้งค่า อัตราจ่าย (Payout Rates) */}
          {activeTab === 'payout_rates' && (
            <RiskIntakeSettings
              lotteryTypes={lotterySettings}
              onLogActivity={logActivity}
              defaultTab="rates"
            />
          )}

          {/* 2. ตั้งค่ารับกิน (Risk Intake & คำนวณใส่ตัวเงิน) */}
          {activeTab === 'intake_settings' && (
            <RiskIntakeSettings
              lotteryTypes={lotterySettings}
              onLogActivity={logActivity}
              defaultTab="intake"
            />
          )}

          {/* 3. ศูนย์ตรวจจับรับกินสด (Live Intake Table with Rows & Columns) */}
          {activeTab === 'intake_monitor' && (
            <RiskIntakeMonitor
              lotteryTypes={lotterySettings}
              onLogActivity={logActivity}
            />
          )}

          {/* จัดการเลขอั้น (เลขลด / เลขปิด) */}
          {activeTab === 'blocked_numbers' && (
            <BlockedNumbersManager
              lotterySettings={lotterySettings}
              blockedNumbersList={blockedNumbersList}
              onLogActivity={(action, details) => logActivity(action, details, 'settings')}
              session={session}
            />
          )}

          {/* ดูหวย & จัดการเปิด-ปิด (Lottery Status & Schedule Control) */}
          {activeTab === 'lottery_control' && (
            <div className="space-y-4">
              {/* แบนเนอร์ทางลัด ยี่กี 88 รอบ */}
              <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white p-4 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-amber-300">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-2xl">timer</span>
                  </div>
                  <div>
                    <h3 className="font-black text-sm">ศูนย์ควบคุมหวยยี่กี 88 รอบ (Yeekee 88 Rounds Control)</h3>
                    <p className="text-xs text-amber-100">คุมบอทยิงเลข, บอทคุมผลกำไร, ออกผล Enter ทันที, หรือยกเลิกคืนเงิน 100%</p>
                  </div>
                </div>
                <Link
                  to="/admin/yeekee"
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-amber-300 font-black text-xs rounded-xl shadow transition shrink-0 flex items-center gap-1.5"
                >
                  <span>เข้าสู่ห้องคุมยี่กี 88 รอบ</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>

              <LotteryOpenCloseManager
                lotterySettings={lotterySettings}
                onToggleStatus={toggleLotteryStatus}
                onToggleAllStatus={toggleAllLotteryStatus}
                onApplyOnlyThree={applyOnlyThreeLotteries}
                onUpdateClosingTime={updateLotterySession}
                onDeleteLottery={handleDeleteLottery}
                onSyncAllLotteries={syncAllLotteries}
                onOpenAddModal={() => setShowAddLotteryModal(true)}
                onOpenResistance={(type) => {
                  setSelectedResistanceLottery(type);
                  setActiveTab('settings');
                  setActiveSettingsSubTab('resistance');
                }}
              />
            </div>
          )}

          {/* เมนูเปิด-ปิดระบบ (Master System Control) */}
          {activeTab === 'system_control' && (
            <div className="space-y-6">
              {/* Header & Quick Action Buttons */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
                    <span className="material-symbols-outlined text-2xl">power_settings_new</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-[var(--navy-deep)]">ศูนย์ควบคุมการเปิด-ปิดระบบ (Master Switchboard)</h2>
                    <p className="text-gray-500 text-xs">ควบคุมการเปิด/ปิดแต่ละโมดูลของแพลตฟอร์มแบบ Real-time มีผลบังคับใช้ต่อผู้เล่นทันที</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={async () => {
                      if (confirm('คุณต้องการ "เปิดทุกระบบทั้งหมด" ใช่หรือไม่?')) {
                        await setDoc(doc(db, 'settings', 'global'), {
                          ...globalSettings,
                          systemOpen: true,
                          bettingOpen: true,
                          depositOpen: true,
                          withdrawOpen: true,
                          registerOpen: true
                        }, { merge: true });
                        await logActivity('เปิดทุกระบบ', 'แอดมินเปิดระบบการทำงานทั้งหมด (All ON)', 'system');
                        alert('เปิดทุกระบบเรียบร้อยแล้ว');
                      }
                    }}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black shadow-md hover:scale-105 active:scale-95 transition flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    เปิดทุกระบบ (All ON)
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm('คำเตือน: คุณต้องการ "ปิดปรับปรุงฉุกเฉินทุกระบบ" ใช่หรือไม่? ผู้เล่นจะไม่สามารถเข้าใช้งานหรือแทงหวยได้')) {
                        await setDoc(doc(db, 'settings', 'global'), {
                          ...globalSettings,
                          systemOpen: false,
                          bettingOpen: false,
                          depositOpen: false,
                          withdrawOpen: false,
                          registerOpen: false
                        }, { merge: true });
                        await logActivity('ปิดปรับปรุงฉุกเฉิน', 'แอดมินปิดการทำงานทุกระบบ (Emergency Shutdown)', 'system');
                        alert('ปิดปรับปรุงทุกระบบเรียบร้อยแล้ว');
                      }
                    }}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-md hover:scale-105 active:scale-95 transition flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">warning</span>
                    ปิดปรับปรุงฉุกเฉิน (All OFF)
                  </button>
                </div>
              </div>

              {/* Status Banner */}
              <div className={`p-6 rounded-2xl shadow-lg border transition-all ${
                globalSettings.systemOpen !== false 
                  ? 'bg-gradient-to-r from-emerald-900/90 to-[var(--navy-deep)] border-emerald-500/40 text-white' 
                  : 'bg-gradient-to-r from-red-950/90 to-neutral-900 border-red-500/50 text-white'
              }`}>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      globalSettings.systemOpen !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400 animate-pulse'
                    }`}>
                      <span className="material-symbols-outlined text-3xl">
                        {globalSettings.systemOpen !== false ? 'verified' : 'fmd_bad'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black tracking-wide">
                          {globalSettings.systemOpen !== false ? 'สถานะระบบ: เปิดให้บริการตามปกติ (ONLINE)' : 'สถานะระบบ: ปิดปรับปรุงชั่วคราว (MAINTENANCE MODE)'}
                        </span>
                        <span className={`inline-block w-3 h-3 rounded-full ${globalSettings.systemOpen !== false ? 'bg-emerald-400 animate-ping' : 'bg-red-500 animate-pulse'}`}></span>
                      </div>
                      <p className="text-xs text-gray-300 mt-1">
                        {globalSettings.systemOpen !== false
                          ? 'แพลตฟอร์มเปิดให้ผู้เล่นเข้าถึง เข้าสู่ระบบ แทงหวย และทำธุรกรรมตามเงื่อนไขที่กำหนด'
                          : 'หน้าเว็บหลักถูกล็อกโหมดซ่อมบำรุง ผู้เล่นทั่วไปจะไม่สามารถเข้าสู่ระบบหรือทำธุรกรรมได้'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => updateGlobalSetting('systemOpen', globalSettings.systemOpen === false)}
                    className={`px-6 py-3 rounded-xl font-black text-sm shadow-xl hover:scale-105 active:scale-95 transition flex items-center gap-2 ${
                      globalSettings.systemOpen !== false
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">power_settings_new</span>
                    {globalSettings.systemOpen !== false ? 'กดเพื่อเปิดโหมดปิดปรับปรุง' : 'กดเพื่อเปิดระบบให้บริการทันที'}
                  </button>
                </div>
              </div>

              {/* 5 Master Switches Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* 1. Master System Switch */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
                        <span className="material-symbols-outlined">domain</span>
                      </div>
                      <button
                        onClick={() => updateGlobalSetting('systemOpen', globalSettings.systemOpen === false)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${globalSettings.systemOpen !== false ? 'bg-purple-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${globalSettings.systemOpen !== false ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-[var(--navy-deep)]">1. ระบบทั้งหมด (Master Power)</h3>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${globalSettings.systemOpen !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {globalSettings.systemOpen !== false ? 'เปิด' : 'ปิด'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">
                        ควบคุมการเข้าถึงทั้งเว็บไซต์ หากปิด ผู้เล่นจะเห็นหน้าปิดปรับปรุงทันที
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center text-[11px] text-gray-500 font-bold">
                    <span>การบังคับใช้: ทุกส่วนของระบบ</span>
                    <span className={globalSettings.systemOpen !== false ? 'text-green-600 font-black' : 'text-red-500 font-black'}>
                      {globalSettings.systemOpen !== false ? '● ออนไลน์' : '● ปิดทำการ'}
                    </span>
                  </div>
                </div>

                {/* 2. Betting System Switch */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                        <span className="material-symbols-outlined">casino</span>
                      </div>
                      <button
                        onClick={() => updateGlobalSetting('bettingOpen', globalSettings.bettingOpen === false)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${globalSettings.bettingOpen !== false ? 'bg-amber-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${globalSettings.bettingOpen !== false ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-[var(--navy-deep)]">2. ระบบรับแทงหวย (Betting Switch)</h3>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${globalSettings.bettingOpen !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {globalSettings.bettingOpen !== false ? 'เปิด' : 'ปิด'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">
                        ควบคุมการส่งโพยแทงหวย หากปิด ผู้เล่นจะไม่สามารถส่งโพยแทงใหม่ได้ทุกประเภท
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center text-[11px] text-gray-500 font-bold">
                    <span>การบังคับใช้: โพยหวย & ตะกร้าแทง</span>
                    <span className={globalSettings.bettingOpen !== false ? 'text-green-600 font-black' : 'text-red-500 font-black'}>
                      {globalSettings.bettingOpen !== false ? '● รับแทงปกติ' : '● พักรับแทง'}
                    </span>
                  </div>
                </div>

                {/* 3. Deposit Gateway Switch */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                        <span className="material-symbols-outlined">account_balance_wallet</span>
                      </div>
                      <button
                        onClick={() => updateGlobalSetting('depositOpen', globalSettings.depositOpen === false)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${globalSettings.depositOpen !== false ? 'bg-emerald-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${globalSettings.depositOpen !== false ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-[var(--navy-deep)]">3. ระบบฝากเงิน (Deposit Switch)</h3>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${globalSettings.depositOpen !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {globalSettings.depositOpen !== false ? 'เปิด' : 'ปิด'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">
                        ควบคุมช่องทางการแจ้งฝากเงิน บัญชีธนาคาร และ QR Code สแกนจ่าย
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center text-[11px] text-gray-500 font-bold">
                    <span>การบังคับใช้: หน้าฝากเงิน</span>
                    <span className={globalSettings.depositOpen !== false ? 'text-green-600 font-black' : 'text-red-500 font-black'}>
                      {globalSettings.depositOpen !== false ? '● เปิดรับฝาก' : '● ปิดรับฝากชั่วคราว'}
                    </span>
                  </div>
                </div>

                {/* 4. Withdrawal Gateway Switch */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                        <span className="material-symbols-outlined">payments</span>
                      </div>
                      <button
                        onClick={() => updateGlobalSetting('withdrawOpen', globalSettings.withdrawOpen === false)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${globalSettings.withdrawOpen !== false ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${globalSettings.withdrawOpen !== false ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-[var(--navy-deep)]">4. ระบบถอนเงิน (Withdrawal Switch)</h3>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${globalSettings.withdrawOpen !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {globalSettings.withdrawOpen !== false ? 'เปิด' : 'ปิด'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">
                        ควบคุมคำขอถอนเงิน หากปิด ผู้เล่นจะไม่สามารถส่งคำขอถอนเงินได้
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center text-[11px] text-gray-500 font-bold">
                    <span>การบังคับใช้: หน้าถอนเงิน</span>
                    <span className={globalSettings.withdrawOpen !== false ? 'text-green-600 font-black' : 'text-red-500 font-black'}>
                      {globalSettings.withdrawOpen !== false ? '● เปิดรับถอน' : '● ปิดรับถอนชั่วคราว'}
                    </span>
                  </div>
                </div>

                {/* 5. Registration Gateway Switch */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-black">
                        <span className="material-symbols-outlined">how_to_reg</span>
                      </div>
                      <button
                        onClick={() => updateGlobalSetting('registerOpen', globalSettings.registerOpen === false)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${globalSettings.registerOpen !== false ? 'bg-orange-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${globalSettings.registerOpen !== false ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-[var(--navy-deep)]">5. ระบบสมัครสมาชิก (Registration)</h3>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${globalSettings.registerOpen !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {globalSettings.registerOpen !== false ? 'เปิด' : 'ปิด'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1">
                        ควบคุมการรับสมัครสมาชิกใหม่ทางหน้าเว็บ (แอดมินยังสร้างยูสเซอร์ได้ตลอดเวลา)
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center text-[11px] text-gray-500 font-bold">
                    <span>การบังคับใช้: หน้าสมัครสมาชิก</span>
                    <span className={globalSettings.registerOpen !== false ? 'text-green-600 font-black' : 'text-red-500 font-black'}>
                      {globalSettings.registerOpen !== false ? '● เปิดรับสมัคร' : '● ปิดรับสมัคร'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Maintenance Message Editor */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--gold-vibrant)]">campaign</span>
                    <h3 className="font-black text-[var(--navy-deep)]">ข้อความประกาศเมื่อปิดปรับปรุงระบบ</h3>
                  </div>
                  <span className="text-[11px] text-gray-400">แสดงผลบนหน้าบ้านเมื่อระบบปิด</span>
                </div>

                <textarea
                  rows={3}
                  value={maintenanceNote || globalSettings.maintenanceMessage || ''}
                  onChange={(e) => setMaintenanceNote(e.target.value)}
                  placeholder="ระบุข้อความประกาศแจ้งเตือนผู้เล่นเมื่อปิดระบบชั่วคราว..."
                  className="w-full p-4 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-[var(--gold-vibrant)] transition"
                />

                <div className="flex justify-end">
                  <button
                    onClick={async () => {
                      const msg = (maintenanceNote || globalSettings.maintenanceMessage || '').trim();
                      await updateGlobalSetting('maintenanceMessage', msg);
                      alert('บันทึกข้อความประกาศปิดปรับปรุงเรียบร้อยแล้ว');
                    }}
                    className="px-6 py-2.5 bg-[var(--navy-deep)] text-[var(--gold-vibrant)] font-black text-xs rounded-xl shadow hover:scale-105 active:scale-95 transition flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">save</span>
                    บันทึกข้อความประกาศ
                  </button>
                </div>
              </div>
            </div>
          )}



          {/* ปฏิทินรอบหวย & Strict Sequential Round Guard */}
          {activeTab === 'round_scheduler' && (
            <RoundSchedulerManager
              lotteryTypes={lotterySettings}
              onLogActivity={logActivity}
            />
          )}

          {/* 4. ตั้งค่าระบบ (Lottery, Result, Blocked, Monitor, Limits) */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                {[
                  { id: 'lottery', label: 'จัดการหวย', icon: 'list_alt' },
                  { id: 'resistance', label: 'ระบบต้านทานอัตราจ่าย', icon: 'shield' },
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
                <LotteryOpenCloseManager
                  lotterySettings={lotterySettings}
                  onToggleStatus={toggleLotteryStatus}
                  onToggleAllStatus={toggleAllLotteryStatus}
                  onApplyOnlyThree={applyOnlyThreeLotteries}
                  onUpdateClosingTime={updateLotterySession}
                  onDeleteLottery={handleDeleteLottery}
                  onSyncAllLotteries={syncAllLotteries}
                  onOpenAddModal={() => setShowAddLotteryModal(true)}
                  onOpenResistance={(type) => {
                    setSelectedResistanceLottery(type);
                    setActiveSettingsSubTab('resistance');
                  }}
                />
              )}

              {/* Sub-tab: ระบบต้านทานอัตราจ่าย (Payout Rate Resistance) */}
              {activeSettingsSubTab === 'resistance' && (() => {
                const DIGIT_GROUPS = [
                  { id: '3digits', label: '🏆 กลุ่มเลข 3 ตัว', icon: 'looks_3', types: ['3 ตัวบน', '3 ตัวโต๊ด', '3 ตัวล่าง', '3 ตัวหน้า', '3 ตัวกลับ'] },
                  { id: '2digits', label: '🥈 กลุ่มเลข 2 ตัว', icon: 'looks_two', types: ['2 ตัวบน', '2 ตัวล่าง'] },
                  { id: 'running', label: '⚡ กลุ่มเลขวิ่ง / เลขรัน', icon: 'bolt', types: ['วิ่งบน', 'วิ่งล่าง'] },
                  { id: 'pinned',  label: '🎯 กลุ่มเลขปักหลัก', icon: 'pin_drop', types: ['ปักหลักหน่วย', 'ปักหลักสิบ', 'ปักหลักร้อย'] },
                  { id: '4digits', label: '💎 กลุ่มเลข 4 ตัว', icon: 'diamond', types: ['4 ตัวบน', '4 ตัวโต๊ด'] },
                ];

                const currentGroup = DIGIT_GROUPS.find(g => g.id === resistanceDigitGroup) || DIGIT_GROUPS[0];

                const filteredLotteries = Object.keys(lotterySettings).filter(k => {
                  const catKey = getLotteryCategory(k, lotterySettings[k]?.category);
                  return resistanceCategoryFilter === 'all' || catKey === resistanceCategoryFilter;
                });

                return (
                  <div className="space-y-6">
                    {/* Header Banner */}
                    <div className="bg-gradient-to-r from-[#1a1300] via-[#2d2200] to-[#1a1300] border-2 border-amber-400/60 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-white">
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative z-10">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-black text-3xl shadow-lg shadow-amber-500/20">
                            🛡️
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-black tracking-tight">
                                ระบบต้านทานอัตราจ่ายและควบคุมความเสี่ยง (Payout Rate Resistance)
                              </h3>
                              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                                resistanceEnabled 
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' 
                                  : 'bg-gray-500/20 text-gray-300 border-gray-400/40'
                              }`}>
                                {resistanceEnabled ? '✓ เปิดระบบต้านทาน' : '✕ ปิดระบบต้านทาน'}
                              </span>
                            </div>
                            <p className="text-xs text-amber-200/70 mt-1 max-w-2xl leading-relaxed">
                              กำหนดอัตราจ่ายพื้นฐาน อัตราจ่ายต้านทาน และเพดานยอดรับแทงสูงสุด แยกตามหลัก (เลข 3 ตัว, เลข 2 ตัว, วิ่ง/รัน, เลขปัก) เพื่อป้องกันความเสี่ยงและควบคุมกำไรของเว็บ
                            </p>
                          </div>
                        </div>

                        {/* Master Switches */}
                        <div className="flex flex-wrap items-center gap-3 bg-black/40 p-3 rounded-2xl border border-amber-400/20">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-300">ระบบต้านทาน:</span>
                            <button
                              type="button"
                              onClick={() => setResistanceEnabled(!resistanceEnabled)}
                              className={`px-3 py-1 rounded-xl text-xs font-black transition ${
                                resistanceEnabled ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400'
                              }`}
                            >
                              {resistanceEnabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                            </button>
                          </div>

                          <div className="w-px h-6 bg-white/10 hidden sm:block"></div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-300">ลดราคาอัตโนมัติ:</span>
                            <button
                              type="button"
                              onClick={() => setResistanceAutoReduce(!resistanceAutoReduce)}
                              className={`px-3 py-1 rounded-xl text-xs font-black transition ${
                                resistanceAutoReduce ? 'bg-amber-400 text-slate-950 font-black' : 'bg-gray-700 text-gray-400'
                              }`}
                            >
                              {resistanceAutoReduce ? 'เปิดลดอัตโนมัติ' : 'ปิด'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Unified Category Tabs & Small Sub-lottery Buttons */}
                    <div className="space-y-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => saveResistanceSettings(false)}
                          className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-xl shadow-sm transition active:scale-95 text-xs flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">save</span>
                          บันทึกหวยนี้
                        </button>
                        <button
                          type="button"
                          onClick={() => saveResistanceSettings(true)}
                          className="bg-blue-700 hover:bg-blue-800 text-white font-black px-4 py-2 rounded-xl shadow-sm transition active:scale-95 text-xs flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">public</span>
                          นำไปใช้กับทุกหวย
                        </button>
                        <button
                          type="button"
                          onClick={() => resetResistanceDefaults()}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl transition text-xs"
                        >
                          คืนค่าเริ่มต้น
                        </button>
                      </div>

                      <LotteryCategorySelector
                        selectedLottery={selectedResistanceLottery}
                        onSelectLottery={setSelectedResistanceLottery}
                        lotterySettings={lotterySettings}
                        title="เลือกหมวดหมู่และประเภทหวยสำหรับตั้งค่าต้านทาน"
                      />
                    </div>

                    {/* Digit Group Tabs (แยกตามหลัก 3 ตัว, 2 ตัว, วิ่ง/รัน, ปักหลัก, 4-5 ตัว) */}
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {DIGIT_GROUPS.map(g => {
                        const isActive = resistanceDigitGroup === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setResistanceDigitGroup(g.id as any)}
                            className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all whitespace-nowrap flex items-center gap-1.5 ${
                              isActive
                                ? 'bg-[var(--navy-deep)] text-[var(--gold-vibrant)] shadow-lg scale-105'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm">{g.icon}</span>
                            <span>{g.label}</span>
                            <span className={`text-[10px] px-1.5 rounded-full ${
                              isActive ? 'bg-[var(--gold-vibrant)] text-slate-900 font-black' : 'bg-gray-200 text-gray-700'
                            }`}>
                              {g.types.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Resistance Rates Grid for the selected Digit Group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {currentGroup.types.map(betType => {
                        const rateItem = resistanceRates[betType] || { baseRate: 90, resistanceRate: 80, maxExposure: 50000 };
                        const reductionPct = rateItem.baseRate > 0 
                          ? Math.round((1 - rateItem.resistanceRate / rateItem.baseRate) * 100) 
                          : 0;

                        return (
                          <div 
                            key={betType}
                            className="bg-white p-5 rounded-2xl border-2 border-gray-100 hover:border-amber-400 transition-all shadow-sm space-y-4 relative"
                          >
                            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                              <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                {betType}
                              </div>
                              <span className="text-[10px] bg-amber-500/10 text-amber-700 font-black px-2 py-0.5 rounded-full border border-amber-300/40">
                                ต้านทานลด {reductionPct}%
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                              {/* อัตราจ่ายปกติ (Base Rate) */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">อัตราจ่ายปกติ (บาทละ)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={rateItem.baseRate}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setResistanceRates(prev => ({
                                      ...prev,
                                      [betType]: { ...prev[betType], baseRate: val }
                                    }));
                                  }}
                                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-black text-slate-900 text-sm focus:border-amber-400 outline-none"
                                />
                              </div>

                              {/* อัตราจ่ายต้านทาน (Resistance Rate) */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-rose-500 uppercase">เรทต้านทาน (ลดจ่าย)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={rateItem.resistanceRate}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setResistanceRates(prev => ({
                                      ...prev,
                                      [betType]: { ...prev[betType], resistanceRate: val }
                                    }));
                                  }}
                                  className="w-full p-2.5 bg-rose-50/50 border border-rose-200 rounded-xl font-black text-rose-600 text-sm focus:border-rose-400 outline-none"
                                />
                              </div>
                            </div>

                            {/* เพดานยอดรับแทงสูงสุด (Max Exposure) */}
                            <div className="space-y-1 text-xs pt-1">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-gray-500 uppercase">เพดานรับแทงสะสม (บาท)</label>
                                <span className="text-[9px] text-gray-400">เกินยอดนี้จะลดเรทจ่าย</span>
                              </div>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">฿</span>
                                <input
                                  type="number"
                                  step="1000"
                                  value={rateItem.maxExposure}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setResistanceRates(prev => ({
                                      ...prev,
                                      [betType]: { ...prev[betType], maxExposure: val }
                                    }));
                                  }}
                                  className="w-full pl-7 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-slate-800 text-xs focus:border-amber-400 outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Policy Note & Risk Explanation */}
                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl space-y-2 text-xs text-amber-900">
                      <div className="flex items-center gap-2 font-black">
                        <span className="material-symbols-outlined text-amber-700 text-base">info</span>
                        หลักการทำงานของระบบต้านทานอัตราจ่าย (Rate Resistance Mechanism)
                      </div>
                      <p className="text-amber-800 leading-relaxed font-medium">
                        เมื่อเปิดระบบต้านทาน: ระบบจะตรวจสอบยอดแทงสะสมของแต่ละตัวเลขแบบเรียลไทม์ หากเลขใดมียอดแทงรวมเกินกว่า <strong>เพดานรับแทงสะสม (Max Exposure)</strong> ที่กำหนด ระบบจะเปลี่ยนไปใช้อัตราจ่ายแบบ <strong>เรทต้านทาน</strong> สำหรับยอดแทงส่วนเกินทันที ทำให้เว็บสามารถเปิดรับแทงต่อได้โดยไม่ต้องปิดอั้นเลข และยังสามารถบริหารความเสี่ยงได้อย่างแม่นยำครับ
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Sub-tab: ออกผลรางวัล (Result & Settlement) */}
              {activeSettingsSubTab === 'result' && (
                <div className="space-y-6">
                  <div className="admin-card p-6">
                    <h3 className="font-black text-[var(--navy-deep)] mb-3 flex items-center gap-2">
                       <span className="material-symbols-outlined text-[var(--gold-vibrant)]">fact_check</span>
                       ป้อนผลรางวัลและตัดยอดเงิน
                    </h3>
                    <p className="text-xs text-gray-500 mb-6">เลือกหมวดหมู่และประเภทหวยเพื่อกรอกเลขผลรางวัล ระบบจะคำนวณและปรับยอดเงินให้สมาชิกอัตโนมัติ</p>

                    {/* ★ แถบเลือกหมวดหมู่และประเภทหวยด้านบนสำหรับหน้าออกผล */}
                    <LotteryCategorySelector
                      selectedLottery={selectedLotteryType}
                      onSelectLottery={setSelectedLotteryType}
                      lotterySettings={lotterySettings}
                      title="เลือกหมวดหมู่และประเภทหวยสำหรับออกผลรางวัล"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">ประเภทหวยที่กำลังออกผล</span>
                              <span className="text-sm font-black text-slate-800 flex items-center gap-1.5 mt-0.5">
                                <span>{lotterySettings[selectedLotteryType]?.icon || '🎯'}</span>
                                <span>{selectedLotteryType}</span>
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-blue-100">
                              <span className="material-symbols-outlined text-xs">arrow_upward</span>
                              เปลี่ยนได้ที่แถบเลือกด้านบน
                            </span>
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
              {activeSettingsSubTab === 'monitor' && (() => {
                const vipTickets500 = tickets.filter(t => (Number(t.totalAmount) || 0) >= 500);
                const vipTickets1000 = tickets.filter(t => (Number(t.totalAmount) || 0) >= 1000);
                const vipTickets2000 = tickets.filter(t => (Number(t.totalAmount) || 0) >= 2000);
                
                const filteredTickets = tickets.filter(t => {
                  const amt = Number(t.totalAmount) || 0;
                  if (vipMonitorFilter === 'vip500') return amt >= 500;
                  if (vipMonitorFilter === 'vip1000') return amt >= 1000;
                  if (vipMonitorFilter === 'vip2000') return amt >= 2000;
                  return true;
                });

                const totalVipAmount = vipTickets500.reduce((sum, t) => sum + (Number(t.totalAmount) || 0), 0);

                return (
                <div className="space-y-6">
                  {/* ★ 👑 แถบมอนิเตอร์สด VIP (VIP Live Monitoring Bar) ★ */}
                  <div className="bg-gradient-to-r from-[#1a1300] via-[#2d2200] to-[#1a1300] border-2 border-amber-400/60 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg shadow-amber-500/20">
                          👑
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-white tracking-tight">
                              แถบมอนิเตอร์สด VIP (VIP Live Monitoring Bar)
                            </h3>
                            <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                              LIVE VIP HUB
                            </span>
                          </div>
                          <p className="text-xs text-amber-200/70 mt-0.5">
                            เฝ้าระวังและวิเคราะห์โพยยอดแทงระดับ VIP และรายการเดิมพันสูงแบบ Real-Time 24 ชม.
                          </p>
                        </div>
                      </div>

                      {/* VIP Filter Tabs / แถบปุ่มกรอง VIP */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setVipMonitorFilter('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                            vipMonitorFilter === 'all'
                              ? 'bg-white text-slate-900 shadow-md'
                              : 'bg-white/10 text-gray-300 hover:bg-white/20'
                          }`}
                        >
                          ทั้งหมด ({tickets.length})
                        </button>
                        <button
                          onClick={() => setVipMonitorFilter('vip500')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                            vipMonitorFilter === 'vip500'
                              ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-lg shadow-amber-400/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-400/30 hover:bg-amber-500/25'
                          }`}
                        >
                          <span>👑 โพย VIP ฿500+</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">{vipTickets500.length}</span>
                        </button>
                        <button
                          onClick={() => setVipMonitorFilter('vip1000')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                            vipMonitorFilter === 'vip1000'
                              ? 'bg-gradient-to-r from-yellow-300 to-amber-500 text-slate-950 shadow-lg shadow-yellow-400/30'
                              : 'bg-yellow-500/15 text-yellow-300 border border-yellow-400/30 hover:bg-yellow-500/25'
                          }`}
                        >
                          <span>💎 Big Win ฿1,000+</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">{vipTickets1000.length}</span>
                        </button>
                        <button
                          onClick={() => setVipMonitorFilter('vip2000')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                            vipMonitorFilter === 'vip2000'
                              ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-400/30 hover:bg-rose-500/25'
                          }`}
                        >
                          <span>🔥 High-Roller ฿2,000+</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30">{vipTickets2000.length}</span>
                        </button>
                      </div>
                    </div>

                    {/* VIP Metrics Summary Strip */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-amber-400/20 text-xs">
                      <div className="bg-black/40 p-3 rounded-2xl border border-amber-400/20">
                        <span className="text-[10px] font-bold text-amber-300/80 block">ยอดรวมโพย VIP (฿)</span>
                        <span className="text-base font-black text-amber-300">฿{totalVipAmount.toLocaleString()}</span>
                      </div>
                      <div className="bg-black/40 p-3 rounded-2xl border border-amber-400/20">
                        <span className="text-[10px] font-bold text-amber-300/80 block">บิลระดับ VIP รวม</span>
                        <span className="text-base font-black text-white">{vipTickets500.length} โพย</span>
                      </div>
                      <div className="bg-black/40 p-3 rounded-2xl border border-amber-400/20">
                        <span className="text-[10px] font-bold text-amber-300/80 block">สถานะเซิร์ฟเวอร์ VIP</span>
                        <span className="text-base font-black text-emerald-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Ultra Fast
                        </span>
                      </div>
                      <div className="bg-black/40 p-3 rounded-2xl border border-amber-400/20">
                        <span className="text-[10px] font-bold text-amber-300/80 block">สมาชิก VIP กำลังแทง</span>
                        <span className="text-base font-black text-yellow-300">
                          {new Set(vipTickets500.map(t => t.userId)).size} บัญชี
                        </span>
                      </div>
                    </div>
                  </div>

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
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xl font-black text-[var(--gold-vibrant)] flex items-center gap-3">
                             <span className="material-symbols-outlined animate-pulse">radar</span>
                             Live Betting Stream {vipMonitorFilter !== 'all' && <span className="text-xs bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black">กรองเฉพาะ VIP</span>}
                          </h3>
                          <span className="text-xs text-gray-400 font-bold">
                            แสดง {Math.min(filteredTickets.length, 30)} จาก {filteredTickets.length} โพย
                          </span>
                        </div>
                        <div className="space-y-2 h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                           {filteredTickets.slice(0, 30).map(ticket => {
                             const isVip = (Number(ticket.totalAmount) || 0) >= 500;
                             const isHighRoller = (Number(ticket.totalAmount) || 0) >= 1000;

                             return (
                             <div 
                               key={ticket.id} 
                               className={`p-3 rounded-xl flex justify-between items-center border transition ${
                                 isHighRoller
                                   ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-transparent border-amber-400 shadow-md ring-1 ring-amber-400/40'
                                   : isVip
                                     ? 'bg-amber-500/10 border-amber-400/50 hover:bg-amber-500/20'
                                     : 'bg-white/5 border-white/10 hover:bg-white/10'
                               }`}
                             >
                                <div className="flex items-center gap-3">
                                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                                     isVip 
                                       ? 'bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 shadow' 
                                       : 'bg-gray-700 text-gray-200'
                                   }`}>
                                      {isVip ? '👑' : ticket.userId?.slice(0, 2).toUpperCase()}
                                   </div>
                                   <div>
                                      <div className="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
                                        <span>{ticket.userId}</span>
                                        {isVip && (
                                          <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-black px-1.5 py-0.2 rounded">
                                            VIP
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[9px] text-gray-400">{new Date(ticket.createdAt).toLocaleTimeString()} • {ticket.lotteryType}</div>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <div className={`text-xs font-black ${isVip ? 'text-amber-300 text-sm' : 'text-gray-200'}`}>
                                     ฿{ticket.totalAmount?.toLocaleString()}
                                   </div>
                                   <div className="text-[9px] text-gray-400">{ticket.ticketType}</div>
                                </div>
                             </div>
                           )})}
                           {filteredTickets.length === 0 && (
                             <div className="text-center py-12 text-gray-500 text-xs">
                               ไม่พบบิลตามเงื่อนไขตัวกรอง VIP ในขณะนี้
                             </div>
                           )}
                        </div>
                     </div>
                  </div>
                </div>
              );})()}

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
                         <label className="block text-sm font-black text-gray-700">การบริหารความเสี่ยงและเครดิตระบบ</label>
                         <div className="space-y-3">
                            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                               <span className="text-xs font-bold text-gray-500">เปิดระบบควบคุมความเสี่ยงอัตโนมัติ (Risk Management Mode)</span>
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
                                 <div className="text-[10px] text-gray-500">การเปลี่ยนแปลงค่าเหล่านี้จะมีผลทันทีกับสมาชิกและทุกโพยในระบบ</div>
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
                  <div 
                    className="px-6 py-2 rounded-xl font-black text-xs shadow-lg flex items-center gap-2"
                    style={{ background: 'var(--admin-accent)', color: '#fff' }}
                  >
                    <span className="material-symbols-outlined text-sm">group</span>
                    <span>สมาชิกทั้งหมด (ระบบเว็บตรง)</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="bg-[var(--gold-vibrant)] text-[var(--navy-deep)] px-5 py-2.5 rounded-xl font-black shadow-lg hover:scale-105 transition active:scale-95 flex items-center gap-2 text-xs"
                >
                  <span className="material-symbols-outlined text-base font-black">person_add</span>
                  + สมัครสมาชิกใหม่ (สร้างยูสเซอร์)
                </button>
              </div>

              {/* ★ แถบเครื่องมือค้นหา/กรอง/ส่งออก สำหรับสมาชิก */}
              <DataToolbar
                search={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="ค้นหา: ชื่อผู้ใช้, เบอร์โทร, รหัสสมาชิก..."
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
                  filteredUsers,
                  [
                    { key: 'username',    label: 'ชื่อผู้ใช้' },
                    { key: 'phoneNumber', label: 'เบอร์โทร' },
                    { key: 'balance',     label: 'ยอดเงิน' },
                    { key: 'status',      label: 'สถานะ' },
                    { key: 'createdAt',   label: 'วันที่สมัคร' },
                  ],
                  'members',
                )}
                expanded={membersExpanded}
                onToggleExpand={() => setMembersExpanded(v => !v)}
                onReset={() => {
                  setSearchQuery(''); setMembersStatuses([]); setMembersSort('createdAt_desc');
                }}
                resultCount={filteredUsers.length}
                resultLabel="สมาชิก"
              />

              <div className="admin-card overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="admin-table border-b">
                    <tr>
                      <th className="p-4">สมาชิก</th>
                      <th className="p-4">เบอร์โทร</th>
                      <th className="p-4">บัญชีธนาคาร</th>
                      <th className="p-4 text-right">ยอดเงิน / เครดิต</th>
                      <th className="p-4 text-center">ประเภทบัญชี</th>
                      <th className="p-4 text-center">สถานะ</th>
                      <th className="p-4 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="border-b transition">
                        <td className="p-4">
                          <div className="font-bold text-[var(--navy-deep)]">{user.username}</div>
                          <div className="text-[10px] text-gray-400">{user.firstName} {user.lastName}</div>
                        </td>
                        <td className="p-4 font-bold">{user.phoneNumber}</td>
                        <td className="p-4">
                          <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-xs text-blue-600">account_balance</span>
                            {user.bankName || 'ไม่ระบุธนาคาร'}
                          </div>
                          <div className="font-mono text-xs font-bold text-slate-500 mt-0.5">{user.bankAccount || '-'}</div>
                        </td>
                        <td className="p-4 font-black text-green-600">฿{(user.balance || 0).toLocaleString()}</td>
                        <td className="p-4 text-center">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            เว็บตรง
                          </span>
                        </td>
                        <td className="p-4">
                           <StatusBadge status={user.status === 'blocked' ? 'blocked' : 'active'} />
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end items-center gap-2">
                            <button 
                              onClick={() => { setSelectedUserForCredit(user); setCreditAction('add'); setCreditAmount(0); setCreditNote(''); setShowCreditModal(true); }}
                              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-black transition flex items-center gap-1.5 border border-blue-200"
                              title="กำหนดหรือเติมลดเครดิตสมาชิก"
                            >
                              <span className="material-symbols-outlined text-sm">payments</span>
                              <span>กำหนดเครดิต</span>
                            </button>
                            <button 
                              onClick={() => updateUserStatus(user.id, user.status === 'blocked' ? 'active' : 'blocked')}
                              className={`p-1.5 rounded-lg transition ${user.status === 'blocked' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                              title={user.status === 'blocked' ? 'ปลดบล็อก' : 'ระงับบัญชี'}
                            >
                              <span className="material-symbols-outlined text-sm">{user.status === 'blocked' ? 'lock_open' : 'block'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-10 text-center text-gray-400 italic">ไม่พบข้อมูลสมาชิกตามเงื่อนไข</td>
                      </tr>
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
                  <h3 className="font-black text-[var(--navy-deep)]">รายงานกำไรขาดทุน {activeReportsSubTab === 'lottery' ? '(แยกตามประเภทหวย)' : '(แยกตามสมาชิก)'}</h3>
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
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase">รายละเอียด / สลิป</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase text-center">สถานะ</th>
                        <th className="p-4 text-[10px] font-black text-gray-400 uppercase text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.filter(t => t.type === "deposit" || t.type === "withdraw").map(tx => (
                        <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                          <td className="p-4 text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString("th-TH")}</td>
                          <td className="p-4 font-bold text-[var(--navy-deep)] text-sm">{tx.username || tx.userId}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${tx.type === "deposit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {tx.type === "deposit" ? "ฝากเงิน" : "ถอนเงิน"}
                            </span>
                          </td>
                          <td className="p-4 text-right font-black text-[var(--navy-deep)]">
                            ฿{Number(tx.amount || 0).toLocaleString()}
                          </td>
                          <td className="p-4 text-xs">
                            <div className="max-w-[220px] space-y-1">
                              {tx.description && <div className="text-gray-700 font-medium truncate" title={tx.description}>{tx.description}</div>}
                              {tx.bankName && <div className="text-gray-500 text-[10px]">{tx.bankName} {tx.bankAccount || ''}</div>}
                              {(tx.slipUrl || tx.slip_url) && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSlipTx(tx)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded cursor-pointer transition"
                                >
                                  <span className="material-symbols-outlined text-[13px]">receipt</span>
                                  <span>ดูสลิปแนบ</span>
                                </button>
                              )}
                            </div>
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
                      {filteredTransactions.filter(t => t.type === "deposit" || t.type === "withdraw").length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-gray-400 font-bold italic">ยังไม่มีรายการธุรกรรมที่ตรงกับการค้นหา</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
              {/* Modal ตรวจสอบสลิปการโอนเงิน */}
              {selectedSlipTx && (
                <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-gray-200">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600 text-xl">receipt_long</span>
                        <h3 className="font-black text-gray-900 text-sm">หลักฐานการโอนเงิน (สลิปฝาก)</h3>
                      </div>
                      <button onClick={() => setSelectedSlipTx(null)} className="text-gray-400 hover:text-gray-600">
                        <span className="material-symbols-outlined">close</span>
                      </button>
                    </div>

                    <div className="bg-slate-100 rounded-xl overflow-hidden max-h-96 flex items-center justify-center p-2 border border-slate-200">
                      {selectedSlipTx.slipUrl || selectedSlipTx.slip_url ? (
                        <img 
                          src={selectedSlipTx.slipUrl || selectedSlipTx.slip_url} 
                          alt="Slip" 
                          className="max-h-80 w-auto object-contain rounded-lg shadow-sm"
                        />
                      ) : (
                        <div className="text-gray-400 text-xs py-8">ไม่มีรูปสลิปแนบมาในรายการนี้</div>
                      )}
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                      <div className="flex justify-between"><span className="text-gray-500">สมาชิก:</span><span className="font-bold text-gray-900">{selectedSlipTx.username || selectedSlipTx.userId}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">ยอดแจ้งฝาก:</span><span className="font-black text-emerald-600 text-base">฿{Number(selectedSlipTx.amount || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">เวลาที่แจ้ง:</span><span className="text-gray-700">{new Date(selectedSlipTx.createdAt).toLocaleString('th-TH')}</span></div>
                      {selectedSlipTx.description && (
                        <div className="text-[11px] text-gray-600 pt-1.5 border-t border-slate-200 mt-1 font-mono">{selectedSlipTx.description}</div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedSlipTx(null)}
                        className="w-full py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100"
                      >
                        ปิดหน้าต่าง
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
           )}

          {/* 7. กติกาการเล่น (เชื่อมต่อหลังบ้าน <-> หน้าบ้าน) */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="admin-card p-6 bg-gradient-to-r from-[var(--navy-deep)] to-[#112240] text-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--gold-vibrant)]/20 text-[var(--gold-vibrant)] flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-2xl">gavel</span>
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-white">จัดการกติกาการเล่น (เชื่อมต่อหน้าบ้านอัตโนมัติ)</h3>
                      <p className="text-xs text-amber-200/80">แก้ไขกติกาที่นี่ ข้อมูลจะอัปเดตไปแสดงผลที่หน้าบ้าน /rules ทันที</p>
                    </div>
                  </div>

                  {/* Sub-tab switcher */}
                  <div className="flex items-center bg-white/10 p-1 rounded-xl">
                    <button
                      onClick={() => setRulesSubTab('general')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        rulesSubTab === 'general'
                          ? 'bg-[var(--gold-vibrant)] text-[var(--navy-deep)] shadow'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">public</span>
                      <span>กติกาการเล่นทั่วไป</span>
                    </button>
                    <button
                      onClick={() => setRulesSubTab('lottery')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        rulesSubTab === 'lottery'
                          ? 'bg-[var(--gold-vibrant)] text-[var(--navy-deep)] shadow'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">casino</span>
                      <span>กติกากำหนดรายหวย</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-tab 1: General Rules */}
              {rulesSubTab === 'general' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Editor & Templates */}
                  <div className="lg:col-span-2 admin-card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-gray-500 uppercase tracking-wider">
                        เนื้อหากติกาการเล่นทั่วไป (Markdown / ข้อความธรรมดา)
                      </span>

                      {/* Quick template helpers */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const standardTemplate = `1. ข้อกำหนดการเดิมพันและการตัดรอบ
- ระบบจะเปิดรับแทงและปิดรับแทงตามเวลาที่กำหนดในแต่ละประเภทหวยอย่างเคร่งครัด
- สมาชิกมีหน้าที่ตรวจสอบความถูกต้องของตัวเลขและยอดเงินก่อนกดยืนยันส่งโพยเสมอ
- หากมีการส่งโพยหลังเวลาปิดรับแทง ระบบจะถือว่าการแทงรอบนั้นเป็นโมฆะและคืนเครดิตทันที

2. การฝาก-ถอนเงิน และอัตราจ่าย
- ระบบฝากเงินผ่าน QR Code อัตโนมัติ ปรับยอดเครดิตภายใน 30 วินาที
- การถอนเงินจะโอนเข้าเฉพาะบัญชีธนาคารที่มีชื่อตรงกับที่ลงทะเบียนไว้เท่านั้น
- อัตราจ่ายสูงสุด 3 ตัวตรง บาทละ 900-1,000 และ 2 ตัวตรง บาทละ 90-100

3. เงื่อนไขการคืนเครดิตกรณีโมฆะ
- หากตลาดหลักทรัพย์หรือกองสลากไม่มีการออกผลรางวัลตามกำหนด ทางระบบจะยกเลิกโพยและคืนเครดิตให้ลูกค้าเต็มจำนวน
- การตัดสินของคณะทำงาน AK88 ถือเป็นที่สิ้นสุดในกรณีเกิดเหตุขัดข้องทางเทคนิคที่ไม่คาดคิด`;
                            setRulesContent(standardTemplate);
                          }}
                          className="text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-lg border border-amber-200 transition"
                        >
                          + ใส่เทมเพลตมาตรฐาน
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={rulesContent}
                      onChange={(e) => setRulesContent(e.target.value)}
                      placeholder="ระบุข้อกำหนด กติกาการเล่น และเงื่อนไขการให้บริการ..."
                      className="w-full h-96 border border-gray-300 rounded-2xl p-4 font-mono text-xs md:text-sm text-gray-800 outline-none focus:border-[var(--gold-vibrant)] focus:ring-2 focus:ring-[var(--gold-vibrant)]/20 transition leading-relaxed"
                    />

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-gray-400">
                        ความยาวข้อความ: {rulesContent.length} ตัวอักษร
                      </span>

                      <button
                        onClick={async () => {
                          setIsSavingRules(true);
                          try {
                            await setDoc(doc(db, 'settings', 'rules'), {
                              content: rulesContent,
                              updatedAt: new Date().toISOString(),
                              updatedBy: session?.displayName || 'Admin'
                            }, { merge: true });
                            await logActivity('บันทึกกติกาการเล่นทั่วไป', 'อัปเดตกติกาการเล่นทั่วไปในระบบ', 'settings');
                            alert('บันทึกกติกาการเล่นทั่วไปเรียบร้อยแล้ว หน้าบ้านซิงค์ข้อมูลทันที');
                          } catch (e: any) {
                            alert('เกิดข้อผิดพลาด: ' + (e?.message || e));
                          } finally {
                            setIsSavingRules(false);
                          }
                        }}
                        disabled={isSavingRules}
                        className="bg-[var(--navy-deep)] text-[var(--gold-vibrant)] px-8 py-3 rounded-xl font-black shadow-lg hover:brightness-110 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-lg">save</span>
                        <span>{isSavingRules ? 'กำลังบันทึก...' : 'บันทึกกติกาการเล่นทั่วไป'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Preview on Frontoffice */}
                  <div className="admin-card p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                        <span className="material-symbols-outlined text-[var(--gold-vibrant)]">preview</span>
                        <h4 className="font-bold text-sm text-[var(--navy-deep)]">ตัวอย่างแสดงผลหน้าบ้าน (/rules)</h4>
                      </div>

                      <div className="bg-gray-50 border rounded-2xl p-4 max-h-[460px] overflow-y-auto space-y-3">
                        <div className="bg-[#0a192f] text-white p-3 rounded-xl flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#f5c518] text-base">shield</span>
                          <span className="text-xs font-bold">กติกาและข้อกำหนดการใช้งานทั่วไป</span>
                        </div>
                        <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                          {rulesContent || 'ยังไม่มีการระบุข้อความกติกา...'}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-gray-400 mt-4 text-center">
                      ลูกค้าหน้าบ้านสามารถเข้าดูได้จากปุ่ม "กติกา" บนแถบเมนู
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Per-Lottery Rules */}
              {rulesSubTab === 'lottery' && (
                <div className="space-y-4">
                  <LotteryCategorySelector
                    selectedLottery={selectedRulesLottery}
                    onSelectLottery={setSelectedRulesLottery}
                    lotterySettings={lotterySettings}
                    title="เลือกหมวดหมู่และประเภทหวยสำหรับตั้งกติกาส่วนตัว"
                  />
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Editor */}
                    <div className="lg:col-span-2 admin-card p-6 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Lottery Selector */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-gray-500 uppercase">ประเภทหวยที่กำลังตั้งกติกา</label>
                          <div className="w-full p-3 border rounded-xl font-black text-sm bg-slate-50 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <span>{lotterySettings[selectedRulesLottery]?.icon || '🎯'}</span>
                              <span>{lotterySettings[selectedRulesLottery]?.name || selectedRulesLottery}</span>
                            </span>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">arrow_upward</span>
                              เปลี่ยนได้ที่แถบด้านบน
                            </span>
                          </div>
                        </div>

                      {/* Banner Image URL */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-500 uppercase">ลิงก์รูปภาพแบนเนอร์กติกา (ถ้ามี)</label>
                        <input
                          type="text"
                          value={lotteryRulesImageUrl}
                          onChange={(e) => setLotteryRulesImageUrl(e.target.value)}
                          placeholder="https://example.com/banner-rules.jpg"
                          className="w-full p-3 border rounded-xl text-xs outline-none focus:border-[var(--gold-vibrant)]"
                        />
                      </div>
                    </div>

                    {/* Quick Template button */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const lotName = lotterySettings[selectedRulesLottery]?.name || selectedRulesLottery;
                          setLotteryRulesText(`กติกาและวิธีการเล่น ${lotName}
- ระบบเปิดรับแทงทุกวันตามกำหนดรอบ
- ปิดรับแทงก่อนเวลาออกผลรางวัล 10 นาที
- อัตราจ่ายและรางวัลอ้างอิงตามตารางมาตรฐานของระบบ
- ในกรณีที่ไม่มีการออกผลรางวัลตามกำหนด ระบบจะทำการยกเลิกโพยและคืนเครดิตให้ลูกค้าเต็มจำนวน`);
                        }}
                        className="text-[11px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-lg border border-blue-200 transition"
                      >
                        + ใส่เทมเพลตสำหรับ {lotterySettings[selectedRulesLottery]?.name || selectedRulesLottery}
                      </button>
                    </div>

                    {/* Textarea */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-500 uppercase">รายละเอียดกติกาเฉพาะหวยนี้</label>
                      <textarea
                        value={lotteryRulesText}
                        onChange={(e) => setLotteryRulesText(e.target.value)}
                        placeholder="ระบุข้อความกติกา วิธีการเล่น และเวลาเปิด-ปิด..."
                        className="w-full h-80 border border-gray-300 rounded-2xl p-4 font-mono text-xs md:text-sm text-gray-800 outline-none focus:border-[var(--gold-vibrant)] leading-relaxed"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-gray-400">
                        หวยที่กำลังแก้ไข: <strong className="text-[var(--navy-deep)]">{lotterySettings[selectedRulesLottery]?.name || selectedRulesLottery}</strong>
                      </span>

                      <button
                        onClick={async () => {
                          if (!selectedRulesLottery) return;
                          setIsSavingRules(true);
                          try {
                            await setDoc(doc(db, 'lotteryTypes', selectedRulesLottery), {
                              rules: {
                                text: lotteryRulesText,
                                imageUrl: lotteryRulesImageUrl
                              }
                            }, { merge: true });
                            await logActivity('บันทึกกติกาเฉพาะหวย', `อัปเดตกติกาหวย ${selectedRulesLottery} เรียบร้อย`, 'lottery');
                            alert(`บันทึกกติกาสำหรับ ${lotterySettings[selectedRulesLottery]?.name || selectedRulesLottery} เรียบร้อยแล้ว`);
                          } catch (e: any) {
                            alert('เกิดข้อผิดพลาด: ' + (e?.message || e));
                          } finally {
                            setIsSavingRules(false);
                          }
                        }}
                        disabled={isSavingRules}
                        className="bg-[var(--navy-deep)] text-[var(--gold-vibrant)] px-8 py-3 rounded-xl font-black shadow-lg hover:brightness-110 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-lg">save</span>
                        <span>{isSavingRules ? 'กำลังบันทึก...' : `บันทึกกติกา ${lotterySettings[selectedRulesLottery]?.name || selectedRulesLottery}`}</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Preview */}
                  <div className="admin-card p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                        <span className="material-symbols-outlined text-[var(--gold-vibrant)]">preview</span>
                        <h4 className="font-bold text-sm text-[var(--navy-deep)]">ตัวอย่างแสดงผลเฉพาะหวยนี้</h4>
                      </div>

                      <div className="bg-gray-50 border rounded-2xl p-4 max-h-[460px] overflow-y-auto space-y-3">
                        <div className="bg-[#0a192f] text-white p-3 rounded-xl">
                          <span className="text-[10px] text-[#f5c518] font-bold">กติกาเฉพาะประเภท</span>
                          <div className="text-sm font-black">{lotterySettings[selectedRulesLottery]?.name || selectedRulesLottery}</div>
                        </div>

                        {lotteryRulesImageUrl && (
                          <div className="rounded-xl overflow-hidden border">
                            <img src={lotteryRulesImageUrl} alt="Banner Preview" className="w-full h-28 object-cover" />
                          </div>
                        )}

                        <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {lotteryRulesText || 'ยังไม่มีการระบุกติกาสำหรับหวยนี้...'}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-gray-400 mt-4 text-center">
                      เชื่อมโยงอัตโนมัติไปยัง /lottery/{selectedRulesLottery}/rules
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}

          {/* 8. ระบบป๊อปอัพ (ทั้งหมด / เฉพาะคน / เลือกประเภท / ยินดีต้อนรับสมาชิกใหม่) */}
          {activeTab === 'popup' && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="admin-card p-6 bg-gradient-to-r from-[var(--navy-deep)] to-[#112240] text-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--gold-vibrant)]/20 text-[var(--gold-vibrant)] flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-2xl">notification_important</span>
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-white">จัดการระบบป๊อปอัพ & ประกาศหน้าเว็บ</h3>
                      <p className="text-xs text-amber-200/80">กำหนดเป้าหมาย ทั้งหมด / เฉพาะคน และหน้าต่างต้อนรับสมาชิกใหม่อัตโนมัติ</p>
                    </div>
                  </div>

                  {/* Sub-tab Switcher */}
                  <div className="flex items-center bg-white/10 p-1 rounded-xl">
                    <button
                      onClick={() => setPopupSubTab('announcement')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        popupSubTab === 'announcement'
                          ? 'bg-[var(--gold-vibrant)] text-[var(--navy-deep)] shadow'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">campaign</span>
                      <span>ป๊อปอัพประกาศ (ทั่วไป/เฉพาะคน)</span>
                    </button>
                    <button
                      onClick={() => setPopupSubTab('welcome')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        popupSubTab === 'welcome'
                          ? 'bg-[var(--gold-vibrant)] text-[var(--navy-deep)] shadow'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">celebration</span>
                      <span>ยินดีต้อนรับสมาชิกใหม่ (ครั้งเดียว)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-tab 1: Announcement Popup */}
              {popupSubTab === 'announcement' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Form Settings */}
                  <div className="lg:col-span-7 admin-card p-6 space-y-5">
                    {/* Active Switch */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                      <div>
                        <div className="text-sm font-bold text-gray-800">เปิดใช้งานป๊อปอัพประกาศทันที</div>
                        <div className="text-xs text-gray-500">หากเปิดใช้งาน ลูกค้าที่เข้าเว็บจะเห็นป๊อปอัพนี้ทันที</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={popupContent.active}
                          onChange={(e) => setPopupContent(prev => ({ ...prev, active: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    {/* Target Selector: ทั้งหมด vs เฉพาะคน */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase">กลุ่มเป้าหมายผู้รับประกาศ</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPopupContent(prev => ({ ...prev, target: 'all' }))}
                          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                            popupContent.target === 'all'
                              ? 'bg-[var(--navy-deep)] text-[var(--gold-vibrant)] border-[var(--navy-deep)] shadow'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">group</span>
                          <span>สมาชิกทุกคน (ทั้งหมด)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPopupContent(prev => ({ ...prev, target: 'specific' }))}
                          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                            popupContent.target === 'specific'
                              ? 'bg-[var(--navy-deep)] text-[var(--gold-vibrant)] border-[var(--navy-deep)] shadow'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base">person_search</span>
                          <span>ระบุเฉพาะคน (Specific)</span>
                        </button>
                      </div>

                      {/* If specific, show input for target usernames */}
                      {popupContent.target === 'specific' && (
                        <div className="mt-3 p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
                          <label className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">badge</span>
                            ระบุชื่อผู้ใช้ (Username) หรือเบอร์โทรศัพท์ที่ต้องการส่งประกาศ
                          </label>
                          <textarea
                            value={popupContent.targetUsers}
                            onChange={(e) => setPopupContent(prev => ({ ...prev, targetUsers: e.target.value }))}
                            placeholder="ระบุชื่อผู้ใช้ เช่น user01, user02, 0812345678 (คั่นด้วยจุลภาคหรือขึ้นบรรทัดใหม่)"
                            className="w-full h-20 p-3 border border-purple-200 rounded-xl text-xs bg-white outline-none focus:border-purple-500 font-mono"
                          />
                          <p className="text-[10px] text-purple-700">
                            * ระบบจะตรวจสอบชื่อผู้ใช้ที่ล็อกอินอยู่ หากตรงกันจะแสดงผลเฉพาะบุคคลนั้น
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Announcement Type Selector: เลือกประเภทได้แจ้ง */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase">ประเภทประกาศ</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'general', label: '📢 ทั่วไป', color: 'border-blue-300 text-blue-700' },
                          { id: 'promotion', label: '🎁 โปรโมชั่น', color: 'border-emerald-300 text-emerald-700' },
                          { id: 'maintenance', label: '⚠️ ปิดปรับปรุง', color: 'border-amber-300 text-amber-700' },
                          { id: 'urgent', label: '🚨 ด่วนสำคัญ', color: 'border-red-300 text-red-700' }
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setPopupContent(prev => ({ ...prev, type: t.id as any }))}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${
                              popupContent.type === t.id
                                ? 'bg-[var(--navy-deep)] text-[var(--gold-vibrant)] border-[var(--navy-deep)] ring-2 ring-[var(--gold-vibrant)]/30'
                                : 'bg-white hover:bg-gray-50 ' + t.color
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-500 uppercase">หัวข้อประกาศ</label>
                      <input
                        type="text"
                        value={popupContent.title}
                        onChange={(e) => setPopupContent(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full p-3.5 border rounded-2xl outline-none font-bold text-sm focus:border-[var(--gold-vibrant)]"
                        placeholder="เช่น แจ้งกำหนดการเปิดรับแทงหวยงวดใหม่"
                      />
                    </div>

                    {/* Body */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-500 uppercase">เนื้อหาประกาศ</label>
                      <textarea
                        value={popupContent.body}
                        onChange={(e) => setPopupContent(prev => ({ ...prev, body: e.target.value }))}
                        className="w-full h-28 p-3.5 border rounded-2xl outline-none text-xs md:text-sm focus:border-[var(--gold-vibrant)] leading-relaxed"
                        placeholder="ระบุข้อความประกาศ..."
                      />
                    </div>

                    {/* Image URL & Link URL */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-500 uppercase">ลิงก์รูปภาพประกอบ (URL)</label>
                        <input
                          type="text"
                          value={popupContent.imageUrl}
                          onChange={(e) => setPopupContent(prev => ({ ...prev, imageUrl: e.target.value }))}
                          className="w-full p-3 border rounded-xl text-xs outline-none focus:border-[var(--gold-vibrant)]"
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-500 uppercase">ลิงก์ปลายทางเมื่อคลิก (Link URL)</label>
                        <input
                          type="text"
                          value={popupContent.linkUrl}
                          onChange={(e) => setPopupContent(prev => ({ ...prev, linkUrl: e.target.value }))}
                          className="w-full p-3 border rounded-xl text-xs outline-none focus:border-[var(--gold-vibrant)]"
                          placeholder="เช่น /lottery หรือ /deposit"
                        />
                      </div>
                    </div>

                    {/* Button Text & Show Once Toggle */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-500 uppercase">ข้อความบนปุ่มกด</label>
                        <input
                          type="text"
                          value={popupContent.actionText}
                          onChange={(e) => setPopupContent(prev => ({ ...prev, actionText: e.target.value }))}
                          className="w-full p-3 border rounded-xl text-xs outline-none focus:border-[var(--gold-vibrant)]"
                          placeholder="เช่น ดูรายละเอียด, ไปแทงหวย"
                        />
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border mt-5 sm:mt-0">
                        <input
                          type="checkbox"
                          id="popupShowOnce"
                          checked={popupContent.showOnce}
                          onChange={(e) => setPopupContent(prev => ({ ...prev, showOnce: e.target.checked }))}
                          className="w-4 h-4 text-[var(--gold-vibrant)] rounded"
                        />
                        <label htmlFor="popupShowOnce" className="text-xs text-gray-700 font-bold cursor-pointer">
                          แสดงครั้งเดียวต่อรอบการใช้งาน
                        </label>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      onClick={async () => {
                        setIsSavingPopup(true);
                        try {
                          await setDoc(doc(db, 'settings', 'popup'), {
                            ...popupContent,
                            updatedAt: new Date().toISOString(),
                            updatedBy: session?.displayName || 'Admin'
                          });
                          await logActivity('ตั้งค่าป๊อปอัพประกาศ', `อัปเดตป๊อปอัพ: ${popupContent.title} (กลุ่มเป้าหมาย: ${popupContent.target === 'all' ? 'ทั้งหมด' : 'เฉพาะคน'})`, 'system');
                          alert('อัปเดตป๊อปอัพประกาศเรียบร้อยแล้ว หน้าบ้านจะแสดงผลตามกลุ่มเป้าหมายทันที');
                        } catch (e: any) {
                          alert('เกิดข้อผิดพลาด: ' + (e?.message || e));
                        } finally {
                          setIsSavingPopup(false);
                        }
                      }}
                      disabled={isSavingPopup}
                      className="w-full bg-[var(--navy-deep)] text-[var(--gold-vibrant)] py-4 rounded-2xl font-black shadow-lg hover:brightness-110 transition flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined">save</span>
                      <span>{isSavingPopup ? 'กำลังบันทึก...' : 'บันทึกและอัปเดตประกาศทันที'}</span>
                    </button>
                  </div>

                  {/* Right Column: Mobile Simulation Mockup */}
                  <div className="lg:col-span-5 flex flex-col items-center">
                    <div className="w-full max-w-sm bg-gray-900 rounded-[40px] p-4 shadow-2xl border-4 border-gray-700 relative">
                      {/* Notch */}
                      <div className="w-32 h-4 bg-gray-800 rounded-full mx-auto mb-3"></div>

                      <div className="text-[10px] text-center font-bold text-gray-400 mb-2 uppercase tracking-wider">
                        จำลองการแสดงผลบนมือถือลูกค้า
                      </div>

                      {/* Phone Screen Mockup */}
                      <div className="bg-[#051121] rounded-3xl p-4 min-h-[480px] flex flex-col justify-center relative overflow-hidden border border-[#f5c518]/30">
                        {/* Dim Overlay */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10"></div>

                        {/* Popup Modal Mockup */}
                        <div className="relative z-20 bg-[#0a192f] border-2 border-[#f5c518] rounded-2xl overflow-hidden shadow-2xl">
                          {popupContent.imageUrl && (
                            <img src={popupContent.imageUrl} alt="Banner" className="w-full h-24 object-cover" />
                          )}
                          <div className="p-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#f5c518]/20 text-[#f5c518] border border-[#f5c518]/40">
                                {popupContent.type === 'promotion' ? '🎁 โปรโมชั่น' : popupContent.type === 'maintenance' ? '⚠️ ปิดปรับปรุง' : popupContent.type === 'urgent' ? '🚨 ด่วนสำคัญ' : '📢 ประกาศ'}
                              </span>
                              {popupContent.target === 'specific' && (
                                <span className="text-[8px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">
                                  เฉพาะคุณ
                                </span>
                              )}
                            </div>

                            <div className="text-xs font-black text-white">{popupContent.title || 'หัวข้อประกาศ'}</div>
                            <div className="text-[11px] text-gray-300 leading-tight whitespace-pre-wrap">{popupContent.body || 'รายละเอียดข้อความประกาศ...'}</div>

                            <div className="pt-2 flex gap-2">
                              <span className="flex-1 text-center py-1.5 text-[10px] text-gray-300 bg-white/10 rounded-lg">ปิด</span>
                              {popupContent.linkUrl && (
                                <span className="flex-1 text-center py-1.5 text-[10px] font-bold text-[#0a192f] bg-[#f5c518] rounded-lg">
                                  {popupContent.actionText || 'ดูรายละเอียด'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Welcome Modal (ยินดีต้อนรับสมาชิกใหม่ แสดงครั้งเดียว ทำแบบยืดหยุ่น) */}
              {popupSubTab === 'welcome' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Column: Form Settings */}
                  <div className="lg:col-span-7 admin-card p-6 space-y-5">
                    {/* Active Switch */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                      <div>
                        <div className="text-sm font-bold text-gray-800">เปิดใช้งานหน้าต่างต้อนรับสมาชิกใหม่</div>
                        <div className="text-xs text-gray-500">แสดงสำหรับสมาชิกใหม่/ผู้เข้าใช้งานครั้งแรกเพียง 1 ครั้งอย่างยืดหยุ่น</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={welcomeContent.enabled}
                          onChange={(e) => setWelcomeContent(prev => ({ ...prev, enabled: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-500 uppercase">หัวข้อต้อนรับ</label>
                      <input
                        type="text"
                        value={welcomeContent.title}
                        onChange={(e) => setWelcomeContent(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full p-3.5 border rounded-2xl outline-none font-bold text-sm focus:border-[var(--gold-vibrant)]"
                        placeholder="เช่น ยินดีต้อนรับสู่ AK88 LOTTO! 🎉"
                      />
                    </div>

                    {/* Subtitle */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-500 uppercase">คำบรรยายสั้น</label>
                      <input
                        type="text"
                        value={welcomeContent.subtitle}
                        onChange={(e) => setWelcomeContent(prev => ({ ...prev, subtitle: e.target.value }))}
                        className="w-full p-3.5 border rounded-2xl outline-none text-xs md:text-sm focus:border-[var(--gold-vibrant)]"
                        placeholder="เว็บแทงหวยออนไลน์มาตรฐานระดับสากล อัตราจ่ายสูงสุด บาทละ 1,000"
                      />
                    </div>

                    {/* Bonus Notice */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-gray-500 uppercase">ข้อความสิทธิพิเศษ / โปรโมชั่นต้อนรับ</label>
                      <input
                        type="text"
                        value={welcomeContent.bonusNotice}
                        onChange={(e) => setWelcomeContent(prev => ({ ...prev, bonusNotice: e.target.value }))}
                        className="w-full p-3.5 border rounded-2xl outline-none text-xs md:text-sm focus:border-[var(--gold-vibrant)] bg-amber-50/50"
                        placeholder="สมาชิกใหม่รับสิทธิ์ร่วมสนุกและรับโบนัสพิเศษทันที!"
                      />
                    </div>

                    {/* Banner Image URL & Button Text */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-500 uppercase">ลิงก์ภาพแบนเนอร์ต้อนรับ (ถ้ามี)</label>
                        <input
                          type="text"
                          value={welcomeContent.imageUrl}
                          onChange={(e) => setWelcomeContent(prev => ({ ...prev, imageUrl: e.target.value }))}
                          className="w-full p-3 border rounded-xl text-xs outline-none focus:border-[var(--gold-vibrant)]"
                          placeholder="https://example.com/welcome-banner.jpg"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-gray-500 uppercase">ข้อความปุ่มกดเริ่มต้น</label>
                        <input
                          type="text"
                          value={welcomeContent.buttonText}
                          onChange={(e) => setWelcomeContent(prev => ({ ...prev, buttonText: e.target.value }))}
                          className="w-full p-3 border rounded-xl text-xs outline-none focus:border-[var(--gold-vibrant)]"
                          placeholder="เริ่มต้นใช้งานทันที"
                        />
                      </div>
                    </div>

                    {/* Features (3 Items) */}
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase">จุดเด่นที่แสดงในหน้าต่างต้อนรับ (3 ข้อ)</label>
                      {(welcomeContent.features || []).map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={feat}
                            onChange={(e) => {
                              const newFeatures = [...(welcomeContent.features || [])];
                              newFeatures[idx] = e.target.value;
                              setWelcomeContent(prev => ({ ...prev, features: newFeatures }));
                            }}
                            className="flex-1 p-2.5 border rounded-xl text-xs outline-none focus:border-[var(--gold-vibrant)]"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Submit Button */}
                    <button
                      onClick={async () => {
                        setIsSavingWelcome(true);
                        try {
                          await setDoc(doc(db, 'settings', 'welcome'), {
                            ...welcomeContent,
                            updatedAt: new Date().toISOString(),
                            updatedBy: session?.displayName || 'Admin'
                          });
                          await logActivity('ตั้งค่ายินดีต้อนรับสมาชิกใหม่', `อัปเดต Welcome Modal: ${welcomeContent.title}`, 'system');
                          alert('อัปเดตหน้าต่างยินดีต้อนรับสมาชิกใหม่เรียบร้อยแล้ว');
                        } catch (e: any) {
                          alert('เกิดข้อผิดพลาด: ' + (e?.message || e));
                        } finally {
                          setIsSavingWelcome(false);
                        }
                      }}
                      disabled={isSavingWelcome}
                      className="w-full bg-[var(--navy-deep)] text-[var(--gold-vibrant)] py-4 rounded-2xl font-black shadow-lg hover:brightness-110 transition flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined">save</span>
                      <span>{isSavingWelcome ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่ายินดีต้อนรับ'}</span>
                    </button>
                  </div>

                  {/* Right Column: Simulation Mockup */}
                  <div className="lg:col-span-5 flex flex-col items-center">
                    <div className="w-full max-w-sm bg-gray-900 rounded-[40px] p-4 shadow-2xl border-4 border-gray-700 relative">
                      {/* Notch */}
                      <div className="w-32 h-4 bg-gray-800 rounded-full mx-auto mb-3"></div>

                      <div className="text-[10px] text-center font-bold text-gray-400 mb-2 uppercase tracking-wider">
                        จำลองหน้าต่างต้อนรับบนมือถือลูกค้า
                      </div>

                      {/* Screen */}
                      <div className="bg-[#051121] rounded-3xl p-4 min-h-[480px] flex flex-col justify-center relative overflow-hidden border border-[#f5c518]/30">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10"></div>

                        {/* Modal Mockup */}
                        <div className="relative z-20 bg-[#0a192f] border-2 border-[#f5c518] rounded-2xl overflow-hidden shadow-2xl p-4 text-center space-y-2.5">
                          <div className="w-10 h-10 mx-auto rounded-full bg-[#f5c518]/20 text-[#f5c518] flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl">celebration</span>
                          </div>

                          <div className="text-xs font-black text-white">{welcomeContent.title}</div>
                          <div className="text-[10px] text-gray-300 leading-tight">{welcomeContent.subtitle}</div>

                          {welcomeContent.bonusNotice && (
                            <div className="bg-[#f5c518]/15 border border-[#f5c518]/40 rounded-xl p-2 text-left flex items-center gap-2">
                              <span className="material-symbols-outlined text-[#f5c518] text-base">military_tech</span>
                              <div className="text-[9px] text-amber-200 leading-tight">{welcomeContent.bonusNotice}</div>
                            </div>
                          )}

                          <div className="space-y-1 text-left pt-1">
                            {(welcomeContent.features || []).map((f, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[9px] text-gray-200 bg-white/5 p-1.5 rounded-lg">
                                <span className="material-symbols-outlined text-emerald-400 text-xs">check_circle</span>
                                <span>{f}</span>
                              </div>
                            ))}
                          </div>

                          <div className="pt-2 flex flex-col gap-1.5">
                            <span className="py-2 text-[10px] font-black text-[#0a192f] bg-[#f5c518] rounded-xl shadow">
                              {welcomeContent.buttonText || 'เริ่มต้นใช้งานทันที'}
                            </span>
                            <span className="py-1 text-[9px] text-gray-400">
                              📖 ดูไกด์แนะนำระบบ (5 ฟังก์ชัน)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                  placeholder="เช่น หวยลาวประตูชัย, นิเคอิ VIP (เช้า)"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">หมวดหมู่หวย (Category)</label>
                <select
                  value={newLotteryCategory}
                  onChange={(e) => setNewLotteryCategory(e.target.value as LotteryCategoryKey)}
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)] transition text-sm bg-white"
                >
                  <option value="thai">🇹🇭 หวยไทย / ธนาคาร</option>
                  <option value="foreign">🌏 หวยต่างประเทศ (ลาว/ฮานอย/มาเลย์)</option>
                  <option value="stock">📈 หวยหุ้น VIP</option>
                  <option value="yeekee">⏱️ หวยยี่กี 88 รอบ</option>
                  <option value="set">🎁 หวยชุด</option>
                  <option value="other">🎯 อื่นๆ / กำหนดเอง</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-700">สถานะเริ่มต้น</span>
                <button
                  type="button"
                  onClick={() => setNewLotteryIsOpen(!newLotteryIsOpen)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${
                    newLotteryIsOpen ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-700'
                  }`}
                >
                  {newLotteryIsOpen ? '✓ เปิดรับแทงทันที' : '✕ ปิดรับแทงไว้ก่อน'}
                </button>
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
                    const trimmed = newLotteryName.trim();
                    if (!trimmed) {
                      alert('กรุณากรอกชื่อประเภทหวย');
                      return;
                    }
                    await setDoc(doc(db, 'lotteryTypes', trimmed), {
                      id: trimmed,
                      name: trimmed,
                      category: newLotteryCategory,
                      rates: defaultRates,
                      isOpen: newLotteryIsOpen,
                      isHidden: false,
                      updatedAt: new Date().toISOString()
                    }, { merge: true });
                    await logActivity('เพิ่มประเภทหวย', `เพิ่ม ${trimmed} (${newLotteryCategory})`, 'lottery');
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

      {/* Credit Modal (3 Modes: Add, Reduce, Set) */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[var(--navy-deep)] p-4 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--gold-vibrant)]">
                  {creditAction === 'add' ? 'add_card' : creditAction === 'reduce' ? 'remove_card' : 'tune'}
                </span>
                {creditAction === 'add' ? 'เติมเครดิตสมาชิก' : creditAction === 'reduce' ? 'ลดเครดิตสมาชิก' : 'กำหนดเครดิตสมาชิกใหม่'}
              </h3>
              <button onClick={() => setShowCreditModal(false)} className="material-symbols-outlined">close</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCreditAction('add')}
                  className={`py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1 ${
                    creditAction === 'add' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  เติมเครดิต
                </button>
                <button
                  type="button"
                  onClick={() => setCreditAction('reduce')}
                  className={`py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1 ${
                    creditAction === 'reduce' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">remove</span>
                  ลดเครดิต
                </button>
                <button
                  type="button"
                  onClick={() => setCreditAction('set')}
                  className={`py-2 text-xs font-black rounded-lg transition flex items-center justify-center gap-1 ${
                    creditAction === 'set' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">tune</span>
                  กำหนดใหม่ (=)
                </button>
              </div>

              {/* User Info Card */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase">สมาชิก</div>
                    <div className="font-black text-base text-[var(--navy-deep)]">{selectedUserForCredit?.username}</div>
                    <div className="text-xs text-gray-500">{selectedUserForCredit?.phoneNumber} {selectedUserForCredit?.firstName ? `(${selectedUserForCredit?.firstName})` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-gray-400 uppercase">เครดิตปัจจุบัน</div>
                    <div className="font-black text-base text-green-600">฿{(selectedUserForCredit?.balance || 0).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-gray-500 uppercase">
                  {creditAction === 'set' ? 'ระบุยอดเครดิตที่ต้องการให้เป็น (บาท)' : 'จำนวนเงิน (บาท)'}
                </label>
                <input 
                  type="number" 
                  min={0}
                  value={creditAmount || ''}
                  onChange={(e) => setCreditAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full border-2 border-gray-200 rounded-xl p-3.5 font-black text-2xl text-center outline-none focus:border-[var(--gold-vibrant)] transition"
                />
              </div>

              {/* Presets */}
              <div className="grid grid-cols-3 gap-2">
                {[100, 500, 1000, 5000, 10000, 50000].map(amt => (
                  <button 
                    key={amt}
                    type="button"
                    onClick={() => {
                      if (creditAction === 'set') {
                        setCreditAmount(amt);
                      } else {
                        setCreditAmount(amt);
                      }
                    }}
                    className="py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-black hover:bg-[var(--gold-vibrant)] hover:text-[var(--navy-deep)] transition"
                  >
                    {creditAction === 'set' ? `฿${amt.toLocaleString()}` : `+${amt.toLocaleString()}`}
                  </button>
                ))}
              </div>

              {/* Note / Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-gray-500 uppercase">หมายเหตุ / เหตุผลการปรับยอด</label>
                <input
                  type="text"
                  value={creditNote}
                  onChange={(e) => setCreditNote(e.target.value)}
                  placeholder="เช่น เติมโปรโมชั่น, ถอนสด, ปรับแก้ข้อผิดพลาด"
                  className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-[var(--gold-vibrant)] transition"
                />
              </div>

              {/* Preview Calculation */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <span className="text-gray-500">ยอดคงเหลือสุทธิหลังบันทึก:</span>
                </div>
                <div className="font-black text-base text-[var(--navy-deep)]">
                  ฿{(() => {
                    const current = Number(selectedUserForCredit?.balance) || 0;
                    const amt = Number(creditAmount) || 0;
                    if (creditAction === 'add') return (current + amt).toLocaleString();
                    if (creditAction === 'reduce') return Math.max(0, current - amt).toLocaleString();
                    return amt.toLocaleString();
                  })()}
                </div>
              </div>

              <button 
                onClick={handleCreditTransaction}
                className={`w-full py-3.5 rounded-xl font-black text-white shadow-lg active:scale-95 transition ${
                  creditAction === 'add' ? 'bg-green-600 hover:bg-green-700' :
                  creditAction === 'reduce' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                ยืนยันการทำรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[var(--navy-deep)] p-4 flex justify-between items-center text-white">
              <h3 className="font-black flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--gold-vibrant)]">person_add</span>
                สมัครสมาชิกใหม่ (สร้างบัญชีผู้เล่น)
              </h3>
              <button onClick={() => setShowAddMemberModal(false)} className="material-symbols-outlined">close</button>
            </div>
            <form onSubmit={handleCreateMember} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase">ชื่อผู้ใช้ (Username) *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น user888"
                    value={newMemberForm.username}
                    onChange={e => setNewMemberForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full mt-1 p-3 border rounded-xl font-bold text-sm outline-none focus:border-[var(--gold-vibrant)]"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase">รหัสผ่าน (Password) *</label>
                  <input
                    type="password"
                    required
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    value={newMemberForm.password}
                    onChange={e => setNewMemberForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full mt-1 p-3 border rounded-xl font-bold text-sm outline-none focus:border-[var(--gold-vibrant)]"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase">เบอร์โทรศัพท์ (10 หลัก) *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="0812345678"
                    value={newMemberForm.phoneNumber}
                    onChange={e => setNewMemberForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    className="w-full mt-1 p-3 border rounded-xl font-bold text-sm outline-none focus:border-[var(--gold-vibrant)]"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase">เครดิตเริ่มต้น (บาท)</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={newMemberForm.initialCredit || ''}
                    onChange={e => setNewMemberForm(prev => ({ ...prev, initialCredit: parseFloat(e.target.value) || 0 }))}
                    className="w-full mt-1 p-3 border rounded-xl font-black text-sm outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase">ชื่อจริง</label>
                  <input
                    type="text"
                    placeholder="ชื่อจริง"
                    value={newMemberForm.firstName}
                    onChange={e => setNewMemberForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full mt-1 p-3 border rounded-xl font-bold text-sm outline-none focus:border-[var(--gold-vibrant)]"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase">นามสกุล</label>
                  <input
                    type="text"
                    placeholder="นามสกุล"
                    value={newMemberForm.lastName}
                    onChange={e => setNewMemberForm(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full mt-1 p-3 border rounded-xl font-bold text-sm outline-none focus:border-[var(--gold-vibrant)]"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase">ธนาคาร</label>
                  <select
                    value={newMemberForm.bankName}
                    onChange={e => setNewMemberForm(prev => ({ ...prev, bankName: e.target.value }))}
                    className="w-full mt-1 p-3 border rounded-xl font-bold text-sm outline-none focus:border-[var(--gold-vibrant)]"
                  >
                    <option value="ธนาคารกสิกรไทย (KBANK)">ธนาคารกสิกรไทย (KBANK)</option>
                    <option value="ธนาคารไทยพาณิชย์ (SCB)">ธนาคารไทยพาณิชย์ (SCB)</option>
                    <option value="ธนาคารกรุงเทพ (BBL)">ธนาคารกรุงเทพ (BBL)</option>
                    <option value="ธนาคารกรุงไทย (KTB)">ธนาคารกรุงไทย (KTB)</option>
                    <option value="ธนาคารทหารไทยธนชาต (TTB)">ธนาคารทหารไทยธนชาต (TTB)</option>
                    <option value="ธนาคารกรุงศรีอยุธยา (BAY)">ธนาคารกรุงศรีอยุธยา (BAY)</option>
                    <option value="ธนาคารออมสิน (GSB)">ธนาคารออมสิน (GSB)</option>
                    <option value="ทรูมันนี่วอลเล็ท (TrueMoney)">ทรูมันนี่วอลเล็ท (TrueMoney)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-gray-500 uppercase">เลขที่บัญชี</label>
                  <input
                    type="text"
                    placeholder="เลขที่บัญชีธนาคาร"
                    value={newMemberForm.bankAccount}
                    onChange={e => setNewMemberForm(prev => ({ ...prev, bankAccount: e.target.value }))}
                    className="w-full mt-1 p-3 border rounded-xl font-bold text-sm outline-none focus:border-[var(--gold-vibrant)]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-gray-500 uppercase">สายเอเย่นต์ผู้ดูแล</label>
                <select
                  value={newMemberForm.agentId}
                  onChange={e => setNewMemberForm(prev => ({ ...prev, agentId: e.target.value }))}
                  className="w-full mt-1 p-3 border rounded-xl font-bold text-sm outline-none focus:border-[var(--gold-vibrant)]"
                >
                  <option value="">Master (บริษัทโดยตรง)</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.username})</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isCreatingMember}
                  className="flex-1 py-3 bg-[var(--gold-vibrant)] text-[var(--navy-deep)] rounded-xl font-black shadow-lg hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-2"
                >
                  {isCreatingMember ? (
                    <span>กำลังสร้างยูสเซอร์...</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">how_to_reg</span>
                      <span>ยืนยันสร้างสมาชิก</span>
                    </>
                  )}
                </button>
              </div>
            </form>
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
                    .filter(tx => tx.userId === selectedUserForHistory?.id)
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
                  {transactions.filter(tx => tx.userId === selectedUserForHistory?.id).length === 0 && (
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
                  <div className="w-28 space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">ซื้อได้สูงสุด (บาท)</label>
                    <input
                      id="modal-blockMax"
                      type="number"
                      placeholder="เช่น 20"
                      className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:border-[var(--gold-vibrant)]"
                    />
                  </div>
                  <button 
                    onClick={async () => {
                      const selType = (document.getElementById('modal-blockBetType') as HTMLSelectElement).value;
                      const nums = (document.getElementById('modal-blockNumbers') as HTMLInputElement).value;
                      const rate = (document.getElementById('modal-blockRate') as HTMLInputElement).value;
                      const maxAmt = (document.getElementById('modal-blockMax') as HTMLInputElement)?.value;
                      if(!nums) return;
                      const numbersArray = nums.split(',').map(n => n.trim()).filter(n => n.length > 0);
                      for (const num of numbersArray) {
                        await addDoc(collection(db, 'blocked_numbers'), {
                          lotteryType: selectedPayoutLottery,
                          betType: selType,
                          number: num,
                          restrictionType: rate ? 'reduced' : (maxAmt ? 'limited' : 'blocked'),
                          payoutRate: rate ? Number(rate) : 0,
                          customPayoutRate: rate ? Number(rate) : 0,
                          maxAmount: maxAmt ? Number(maxAmt) : 0,
                          createdAt: new Date().toISOString()
                        });
                      }
                      (document.getElementById('modal-blockNumbers') as HTMLInputElement).value = '';
                      (document.getElementById('modal-blockRate') as HTMLInputElement).value = '';
                      const mx = document.getElementById('modal-blockMax') as HTMLInputElement | null; if (mx) mx.value = '';
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
                              {(bn.restrictionType === 'blocked' || !bn.restrictionType) ? (
                                <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-black">ปิดรับแทง</span>
                                ) : bn.restrictionType === 'limited' ? null : (
                                <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-[10px] font-black">จ่าย {bn.customPayoutRate ?? bn.payoutRate}</span>
                                )}
                                {Number(bn.maxAmount) > 0 && (
                                  <span className="ml-1 bg-blue-100 text-blue-600 px-2 py-1 rounded text-[10px] font-black">สูงสุด ฿{bn.maxAmount}</span>
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

      {/* Modal ปลดล็อกโหมดเจ้าของ (Master PIN) */}
      {showMasterPinModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-2xl">key</span>
              </div>
              <h3 className="font-black text-slate-900 text-base">ปลดล็อกโหมดเจ้าของ (Master PIN)</h3>
              <p className="text-xs text-slate-500">กรอกรหัส PIN เพื่อเปิดแถบเครื่องมือควบคุมการเงินและเลขอั้น (รหัสเริ่มต้น: 112233)</p>
            </div>

            <div>
              <input
                type="password"
                value={masterPinInput}
                onChange={(e) => setMasterPinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (
                      masterPinInput === '112233' || masterPinInput === 'admin' || masterPinInput === 'master' ||
                      masterPinInput === '1234' || masterPinInput === '123456'
                    ) {
                      setIsMasterUnlocked(true);
                      localStorage.setItem('masterUnlocked', 'true');
                      setShowMasterPinModal(false);
                      setMasterPinInput('');
                    } else {
                      alert('รหัสผ่านไม่ถูกต้อง (รหัสเริ่มต้นคือ 1234 หรือ 112233)');
                    }
                  }
                }}
                placeholder="กรอกรหัส PIN (1234 หรือ 112233)"
                className="w-full text-center text-lg font-mono font-black tracking-widest bg-slate-50 border border-slate-300 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowMasterPinModal(false); setMasterPinInput(''); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    masterPinInput === '112233' || masterPinInput === 'admin' || masterPinInput === 'master' ||
                    masterPinInput === '1234' || masterPinInput === '123456'
                  ) {
                    setIsMasterUnlocked(true);
                    localStorage.setItem('masterUnlocked', 'true');
                    setShowMasterPinModal(false);
                    setMasterPinInput('');
                  } else {
                    alert('รหัสผ่านไม่ถูกต้อง (รหัสเริ่มต้นคือ 1234 หรือ 112233)');
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-white font-black text-xs shadow-md"
              >
                ยืนยันรหัส
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

