import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, updateDoc, setDoc, getDocs, where, addDoc } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';

const LOTTERY_NAMES = [
  'หวยรัฐบาล', 'ยี่กี 4D', 'หวยธกส.', 'หวยออมสิน', 'หวยลาวประตูชัย', 'หวยลาวสันติภาพ', 
  'หวยประชาชนลาว', 'ลาว(EXTRA)', 'หวยลาวTV', 'หวยลาวHD', 'หวยลาวสตาร์', 'ลาวกาชาด', 
  'หวยลาวสตาร์(VIP)', 'ฮานอย(HD)', 'ฮานอยสตาร์', 'ฮานอยTV', 'ฮานอยกาชาด', 'ฮานอยพิเศษ', 
  'ฮานอยสามัคคี', 'หวยฮานอย', 'ฮานอย(VIP)', 'ฮานอย(EXTRA)', 'หวยมาเลย์', 'ดาวน์โจนส์ STAR', 
  'หวยรัฐบาล (ชุด)', 'หวยฮานอยชุด', 'หวยลาวพัฒนาชุด', 'นิเคอิ VIP (เช้า)', 'เวียดนาม VIP (เช้า)', 
  'จีน VIP (เช้า)', 'ฮั่งเส็ง VIP (เช้า)', 'ไต้หวัน VIP', 'เกาหลี VIP', 'นิเคอิ VIP (บ่าย)', 
  'เวียดนาม VIP (บ่าย)', 'จีน VIP (บ่าย)', 'ฮั่งเส็ง VIP (บ่าย)', 'ลาว VIP', 'หุ้นไทย', 'หุ้นสิงคโปร์'
];

const LOTTERY_GROUPS = LOTTERY_NAMES.map((name, index) => ({
  id: `lotto_${index}`,
  name: name,
  defaultOur: 90
}));

export default function MasterDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [activeTab, setActiveTab] = useState('agents');
  const [agents, setAgents] = useState<any[]>([]);
  const [lotteryTypes, setLotteryTypes] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Modals
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [showAgentSettingsModal, setShowAgentSettingsModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);

  // Form States
  const [newAgent, setNewAgent] = useState<any>({
    name: '', username: '', password: '', confirmPassword: '', phone: '', location: '', credit: 0, share: 80, commission: 5,
    currency: 'THB', position: 'Agent', betType: 'seamless', level: 'VIP',
    royaltySettings: {}
  });

  const openAddAgentModal = () => {
    const initialRoyalty: any = {};
    LOTTERY_GROUPS.forEach(g => {
      initialRoyalty[g.id] = {
        active: true,
        ourPercentage: g.defaultOur,
        givenPercentage: 0,
        callbackUrl: ''
      };
    });
    setNewAgent({
      name: '', username: '', password: '', confirmPassword: '', phone: '', location: '', credit: 0, share: 80, commission: 5,
      currency: 'THB', position: 'Agent', betType: 'seamless', level: 'VIP',
      royaltySettings: initialRoyalty
    });
    setShowAddAgentModal(true);
  };
  const [topupAmount, setTopupAmount] = useState(0);

  // Rules State
  const [selectedRulesLottery, setSelectedRulesLottery] = useState<any>(null);
  const [rulesContent, setRulesContent] = useState({ imageUrl: '', text: '' });

  // Results State
  const [selectedResultLottery, setSelectedResultLottery] = useState<any>(null);
  const [resultDate, setResultDate] = useState(new Date().toISOString().split('T')[0]);
  const [resultData, setResultData] = useState({
    threeUp: '',
    twoDown: '',
    threeFront: '',
    threeBack: ''
  });

  useEffect(() => {
    // Fetch Agents
    const qAgents = query(collection(db, 'agents'));
    const unsubAgents = onSnapshot(qAgents, (snap) => {
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch Lottery Types
    const qLottery = query(collection(db, 'lotteryTypes'));
    const unsubLottery = onSnapshot(qLottery, (snap) => {
      setLotteryTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch System Logs (Audit/Security)
    const qLogs = query(collection(db, 'adminLogs'));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setSystemLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    return () => {
      unsubAgents();
      unsubLottery();
      unsubLogs();
    };
  }, []);

  const handleAddAgent = async () => {
    if (!newAgent.name || !newAgent.username || !newAgent.password || !newAgent.confirmPassword) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (newAgent.password !== newAgent.confirmPassword) {
      alert('รหัสผ่านไม่ตรงกัน');
      return;
    }
    try {
      const apiKey = 'sk_live_' + Math.random().toString(36).substr(2, 24);
      const agentData = { ...newAgent };
      delete agentData.confirmPassword; // Don't save confirm password
      
      await setDoc(doc(db, 'agents', newAgent.username), {
        ...agentData,
        apiKey,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: 'master',
        disabledLotteries: [] // Backward compatibility
      });
      setShowAddAgentModal(false);
      alert('สร้างเอเย่นต์สำเร็จ');
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาด');
    }
  };

  const handleTopup = async () => {
    if (!selectedAgent || topupAmount <= 0) return;
    try {
      const newCredit = (selectedAgent.credit || 0) + topupAmount;
      await updateDoc(doc(db, 'agents', selectedAgent.id), { credit: newCredit });
      await addDoc(collection(db, 'adminLogs'), {
        action: 'topup_agent',
        agentId: selectedAgent.id,
        amount: topupAmount,
        createdAt: new Date().toISOString(),
        by: 'master'
      });
      setShowTopupModal(false);
      alert('เติมเครดิตสำเร็จ');
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาด');
    }
  };

  const toggleLotteryStatus = async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, 'lotteryTypes', id), { isOpen: !currentStatus });
  };

  const toggleAgentLottery = async (lotteryId: string) => {
    if (!selectedAgent) return;
    try {
      const disabledLotteries = selectedAgent.disabledLotteries || [];
      const newDisabledLotteries = disabledLotteries.includes(lotteryId)
        ? disabledLotteries.filter((id: string) => id !== lotteryId)
        : [...disabledLotteries, lotteryId];
      
      await updateDoc(doc(db, 'agents', selectedAgent.id), { 
        disabledLotteries: newDisabledLotteries 
      });
      
      // Update local state for immediate feedback
      setSelectedAgent({
        ...selectedAgent,
        disabledLotteries: newDisabledLotteries
      });
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
    }
  };

  const handleSaveRules = async () => {
    if (!selectedRulesLottery) return;
    try {
      await updateDoc(doc(db, 'lotteryTypes', selectedRulesLottery.id), {
        rules: rulesContent
      });
      alert('บันทึกข้อมูลกติกาสำเร็จ');
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการบันทึกกติกา');
    }
  };

  const handleSaveResult = async () => {
    if (!selectedResultLottery) {
      alert('กรุณาเลือกประเภทหวย');
      return;
    }
    if (!resultData.threeUp || !resultData.twoDown) {
      alert('กรุณากรอกผล 3 ตัวบน และ 2 ตัวล่าง ให้ครบถ้วน');
      return;
    }

    try {
      await addDoc(collection(db, 'lotteryResults'), {
        lotteryId: selectedResultLottery.id,
        lotteryName: selectedResultLottery.name,
        date: resultDate,
        results: resultData,
        createdAt: new Date().toISOString(),
        status: 'published'
      });
      alert('บันทึกผลรางวัลสำเร็จ');
      setResultData({ threeUp: '', twoDown: '', threeFront: '', threeBack: '' });
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการบันทึกผลรางวัล');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === '112233') {
      setIsAuthenticated(true);
    } else {
      alert('รหัสผ่านไม่ถูกต้อง');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 font-sans">
        <div className="bg-[#1e293b] p-8 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-300">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-purple-500/30 mx-auto mb-4">
              <span className="material-symbols-outlined text-4xl">shield_person</span>
            </div>
            <h1 className="text-2xl font-black text-white">MASTER LOGIN</h1>
            <p className="text-slate-400 text-sm mt-2">กรุณาใส่รหัสผ่านเพื่อเข้าสู่ระบบจัดการระดับสูง</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-xs font-bold text-slate-400 mb-2 block">รหัสผ่าน (Password)</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-4 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition text-center text-xl tracking-widest"
                placeholder="••••••"
                autoFocus
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-xl shadow-lg shadow-purple-600/20 transition active:scale-95"
            >
              เข้าสู่ระบบ
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <button 
              onClick={() => navigate('/admin')}
              className="text-slate-500 hover:text-slate-300 text-sm font-bold transition flex items-center justify-center gap-2 mx-auto"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              กลับหน้า Admin ปกติ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-300 font-sans flex">
      {/* Sidebar */}
      <div className="w-64 bg-[#1e293b] border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg shadow-purple-500/30">
            M
          </div>
          <div>
            <h1 className="text-white font-black text-lg leading-tight">MASTER</h1>
            <p className="text-purple-400 text-[10px] font-bold uppercase tracking-wider">Control Center</p>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            {[
              { id: 'agents', icon: 'group', label: 'ระบบสมาชิกเอเย่นต์' },
              { id: 'lottery_config', icon: 'settings_applications', label: 'ตั้งค่าหวย & สิทธิ' },
              { id: 'rules', icon: 'gavel', label: 'จัดการกติกา & วิธีเล่น' },
              { id: 'results', icon: 'emoji_events', label: 'ออกผลรางวัล' },
              { id: 'reports', icon: 'analytics', label: 'รายการเล่น & ยอดได้เสีย' },
              { id: 'security', icon: 'security', label: 'ความปลอดภัย & แจ้งเตือน' },
              { id: 'api_keys', icon: 'key', label: 'นักพัฒนา API' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-700">
          <button 
            onClick={() => navigate('/admin')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-700 transition"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            กลับหน้า Admin ปกติ
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-[#1e293b] border-b border-slate-700 p-4 flex justify-between items-center">
          <h2 className="text-xl font-black text-white">
            {activeTab === 'agents' && 'จัดการระบบสมาชิกเอเย่นต์'}
            {activeTab === 'lottery_config' && 'จัดการประเภทหวยและสิทธิการตั้งค่า'}
            {activeTab === 'rules' && 'จัดการกติกาและวิธีเล่น'}
            {activeTab === 'results' && 'ออกผลรางวัล'}
            {activeTab === 'reports' && 'รายการเล่นและวิเคราะห์ข้อมูล'}
            {activeTab === 'security' && 'ระบบรักษาความปลอดภัยและตรวจสอบ'}
            {activeTab === 'api_keys' && 'จัดการสิทธินักพัฒนา API'}
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs font-bold text-slate-300">System Online</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          
          {/* TAB: AGENTS */}
          {activeTab === 'agents' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">รายชื่อเอเย่นต์ทั้งหมด</h3>
                <button 
                  onClick={() => openAddAgentModal()}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-purple-600/20"
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  เพิ่มเอเย่นต์ใหม่
                </button>
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800 text-slate-400">
                    <tr>
                      <th className="p-4 font-bold">Username</th>
                      <th className="p-4 font-bold">ชื่อแสดงผล</th>
                      <th className="p-4 font-bold text-right">เครดิตคงเหลือ</th>
                      <th className="p-4 font-bold text-center">% ถือสู้</th>
                      <th className="p-4 font-bold text-center">คอมมิชชั่น</th>
                      <th className="p-4 font-bold text-center">สถานะ</th>
                      <th className="p-4 font-bold text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {agents.map(agent => (
                      <tr key={agent.id} className="hover:bg-slate-800/50 transition">
                        <td className="p-4 font-mono text-purple-400">{agent.username}</td>
                        <td className="p-4 text-white font-medium">{agent.name}</td>
                        <td className="p-4 text-right font-mono text-green-400">฿{agent.credit?.toLocaleString() || 0}</td>
                        <td className="p-4 text-center">{agent.share || 0}%</td>
                        <td className="p-4 text-center">{agent.commission || 0}%</td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${agent.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {agent.status === 'active' ? 'ใช้งานปกติ' : 'ระงับ'}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button 
                            onClick={() => {
                              navigate('/master/agent-profile', { state: { agent } });
                            }}
                            className="px-3 py-1.5 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 rounded-lg text-xs font-bold transition flex items-center gap-1 mx-1 inline-flex"
                          >
                            <span className="material-symbols-outlined text-[14px]">person</span> โฟลไฟล์
                          </button>
                          <button 
                            onClick={() => { setSelectedAgent(agent); setShowTopupModal(true); }}
                            className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg text-xs font-bold transition mx-1 inline-flex"
                          >
                            จัดการการเงิน
                          </button>
                          <button 
                            onClick={() => { setSelectedAgent(agent); setShowAgentSettingsModal(true); }}
                            className="px-3 py-1.5 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-lg text-xs font-bold transition mx-1 inline-flex"
                          >
                            ตั้งค่า
                          </button>
                        </td>
                      </tr>
                    ))}
                    {agents.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">ยังไม่มีข้อมูลเอเย่นต์</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: LOTTERY CONFIG */}
          {activeTab === 'lottery_config' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Master Settings Panel */}
                <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-6 space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
                    <span className="material-symbols-outlined text-purple-500 text-3xl">admin_panel_settings</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">สิทธิการตั้งค่า (Master Control)</h3>
                      <p className="text-xs text-slate-400">จัดการสิทธิว่าเอเย่นต์สามารถตั้งค่าอะไรได้บ้าง</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                      <div>
                        <div className="font-bold text-white">อนุญาตให้เอเย่นต์ตั้งค่าอัตราจ่ายเอง</div>
                        <div className="text-xs text-slate-400 mt-1">หากปิด เอเย่นต์จะใช้อัตราจ่ายตาม Master เท่านั้น</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                      <div>
                        <div className="font-bold text-white">สิทธิการออกรางวัล</div>
                        <div className="text-xs text-slate-400 mt-1">ใครเป็นผู้ออกรางวัลสำหรับหวยยี่กี/หุ้น</div>
                      </div>
                      <select className="bg-slate-900 border border-slate-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5">
                        <option>ใช้ผลจาก Master</option>
                        <option>เอเย่นต์ออกผลเองได้</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                      <div>
                        <div className="font-bold text-white">ตั้งอัตราจ่ายสูงสุด (Max Payout)</div>
                        <div className="text-xs text-slate-400 mt-1">ป้องกันเอเย่นต์ตั้งอัตราจ่ายเกิน 100%</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" defaultValue={100} className="w-20 bg-slate-900 border border-slate-600 text-white text-sm rounded-lg p-2 text-center" />
                        <span className="text-slate-400">%</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                      <div>
                        <div className="font-bold text-white">ตั้งอั้นรับกินสูงสุด (Max Liability)</div>
                        <div className="text-xs text-slate-400 mt-1">ลิมิตยอดเสียสูงสุดต่อเลข เพื่อป้องกันความเสี่ยง</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">฿</span>
                        <input type="number" defaultValue={1000000} className="w-32 bg-slate-900 border border-slate-600 text-white text-sm rounded-lg p-2 text-right" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lottery Toggle Panel */}
                <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-green-500 text-3xl">toggle_on</span>
                      <div>
                        <h3 className="text-lg font-bold text-white">จัดการเปิด-ปิด ประเภทหวย</h3>
                        <p className="text-xs text-slate-400">ควบคุมการเปิดรับแทงหวยทุกประเภทในระบบ</p>
                      </div>
                    </div>
                    <div>
                      <button 
                        onClick={async () => {
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
                            let addedCount = 0;
                            for (const name of initialLotteries) {
                              const exists = lotteryTypes.find((l: any) => l.name === name || l.id === name);
                              if (!exists) {
                                await setDoc(doc(db, 'lotteryTypes', name), {
                                  name,
                                  isOpen: true,
                                  createdAt: new Date().toISOString()
                                });
                                addedCount++;
                              }
                            }
                            alert(addedCount > 0 ? `ซิงค์ประเภทหวยใหม่ ${addedCount} รายการสำเร็จ` : 'มีครบทุกประเภทหวยระบบแล้ว');
                          } catch (error) {
                            console.error(error);
                            alert('เกิดข้อผิดพลาด');
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold transition flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">sync</span>
                        ซิงค์ประเภทหวย 38 รายการ
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {lotteryTypes.map(lottery => (
                      <div key={lottery.id} className="flex flex-col p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-slate-200">{lottery.name}</div>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => {
                                const newRate = prompt(`ตั้งราคาจ่าย 3 ตัวบน สำหรับ ${lottery.name}`, lottery.rates?.['3 ตัวบน'] || '900');
                                if (newRate) {
                                  updateDoc(doc(db, 'lotteryTypes', lottery.id), {
                                    'rates.3 ตัวบน': Number(newRate)
                                  });
                                }
                              }}
                              className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded"
                            >
                              ตั้งค่าจ่าย
                            </button>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={lottery.isOpen}
                                onChange={() => toggleLotteryStatus(lottery.id, lottery.isOpen)}
                              />
                              <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB: RULES */}
          {activeTab === 'rules' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-6">
                <div className="flex items-center gap-3 border-b border-slate-700 pb-4 mb-6">
                  <span className="material-symbols-outlined text-yellow-500 text-3xl">gavel</span>
                  <div>
                    <h3 className="text-lg font-bold text-white">จัดการกติกาและวิธีเล่น</h3>
                    <p className="text-xs text-slate-400">ตั้งค่ากติกา ข้อความ และรูปภาพประกอบสำหรับหวยแต่ละประเภท</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 border-r border-slate-700 pr-6">
                    <h4 className="text-white font-bold mb-4">เลือกประเภทหวย</h4>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                      {lotteryTypes.map(lottery => (
                        <button
                          key={lottery.id}
                          onClick={() => {
                            setSelectedRulesLottery(lottery);
                            setRulesContent({
                              imageUrl: lottery.rules?.imageUrl || '',
                              text: lottery.rules?.text || ''
                            });
                          }}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                            selectedRulesLottery?.id === lottery.id
                              ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20'
                              : 'border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          {lottery.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                      <h4 className="text-white font-bold mb-4">
                        แก้ไขข้อมูล: <span className="text-purple-400">{selectedRulesLottery ? selectedRulesLottery.name : 'กรุณาเลือกหวยจากเมนูด้านซ้าย'}</span>
                      </h4>
                      
                      {selectedRulesLottery ? (
                        <div className="space-y-4 animate-in fade-in">
                          <div>
                            <label className="text-xs font-bold text-slate-400 mb-2 block">URL รูปภาพแบนเนอร์/วิธีเล่น (ถ้ามี)</label>
                            <input 
                              type="text" 
                              value={rulesContent.imageUrl}
                              onChange={e => setRulesContent({...rulesContent, imageUrl: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg p-3 text-sm focus:border-purple-500 outline-none"
                              placeholder="https://example.com/image.jpg"
                            />
                            {rulesContent.imageUrl && (
                              <div className="mt-2 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 h-32 relative">
                                <img src={rulesContent.imageUrl} alt="Preview" className="object-cover w-full h-full opacity-80" />
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-400 mb-2 block">รายละเอียดกติกา (รองรับข้อความหลายบรรทัด)</label>
                            <textarea 
                              rows={8}
                              value={rulesContent.text}
                              onChange={e => setRulesContent({...rulesContent, text: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg p-3 text-sm focus:border-purple-500 outline-none"
                              placeholder="พิมพ์กติกาและวิธีเล่นที่นี่..."
                            ></textarea>
                          </div>

                          <button 
                            onClick={handleSaveRules}
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-purple-600/20"
                          >
                            บันทึกข้อมูลกติกา
                          </button>
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center border border-dashed border-slate-600 rounded-lg bg-slate-900/50">
                          <div className="text-center">
                            <span className="material-symbols-outlined text-slate-500 text-4xl mb-2">touch_app</span>
                            <p className="text-slate-400 text-sm">เลือกหวยเพื่อเริ่มแก้ไขกติกา</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: RESULTS */}
          {activeTab === 'results' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-6">
                <div className="flex items-center gap-3 border-b border-slate-700 pb-4 mb-6">
                  <span className="material-symbols-outlined text-yellow-500 text-3xl">emoji_events</span>
                  <div>
                    <h3 className="text-lg font-bold text-white">ออกผลรางวัล</h3>
                    <p className="text-xs text-slate-400">บันทึกผลการออกรางวัลของหวยแต่ละประเภท</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Select Lottery */}
                  <div className="col-span-1 border-r border-slate-700 pr-6">
                    <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">list</span>
                      เลือกหวยที่ต้องการออกผล
                    </h4>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                      {lotteryTypes.map(lottery => (
                        <button
                          key={lottery.id}
                          onClick={() => setSelectedResultLottery(lottery)}
                          className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition flex justify-between items-center ${
                            selectedResultLottery?.id === lottery.id
                              ? 'bg-yellow-600/20 text-yellow-500 border border-yellow-600/50'
                              : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {lottery.name}
                          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: Result Form */}
                  <div className="col-span-2">
                    {selectedResultLottery ? (
                      <div className="space-y-6">
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                          <div>
                            <div className="text-xs text-slate-400">กำลังออกผลรางวัลสำหรับ</div>
                            <div className="text-xl font-black text-white text-yellow-500">{selectedResultLottery.name}</div>
                          </div>
                          <div>
                            <input 
                              type="date" 
                              value={resultDate}
                              onChange={(e) => setResultDate(e.target.value)}
                              className="bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-yellow-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <label className="text-sm font-bold text-slate-300 mb-2 block">3 ตัวบน</label>
                            <input 
                              type="text" 
                              maxLength={3}
                              value={resultData.threeUp}
                              onChange={(e) => setResultData({...resultData, threeUp: e.target.value.replace(/[^0-9]/g, '')})}
                              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg p-3 text-2xl text-center font-black tracking-widest focus:border-yellow-500 outline-none"
                              placeholder="---"
                            />
                          </div>
                          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <label className="text-sm font-bold text-slate-300 mb-2 block">2 ตัวล่าง</label>
                            <input 
                              type="text" 
                              maxLength={2}
                              value={resultData.twoDown}
                              onChange={(e) => setResultData({...resultData, twoDown: e.target.value.replace(/[^0-9]/g, '')})}
                              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg p-3 text-2xl text-center font-black tracking-widest focus:border-yellow-500 outline-none"
                              placeholder="--"
                            />
                          </div>
                          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <label className="text-sm font-bold text-slate-300 mb-2 block">3 ตัวหน้า (ถ้ามี)</label>
                            <input 
                              type="text" 
                              maxLength={7}
                              value={resultData.threeFront}
                              onChange={(e) => setResultData({...resultData, threeFront: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg p-3 text-lg text-center font-bold focus:border-yellow-500 outline-none"
                              placeholder="เช่น 123, 456"
                            />
                          </div>
                          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <label className="text-sm font-bold text-slate-300 mb-2 block">3 ตัวท้าย (ถ้ามี)</label>
                            <input 
                              type="text" 
                              maxLength={7}
                              value={resultData.threeBack}
                              onChange={(e) => setResultData({...resultData, threeBack: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg p-3 text-lg text-center font-bold focus:border-yellow-500 outline-none"
                              placeholder="เช่น 789, 012"
                            />
                          </div>
                        </div>

                        <div className="flex gap-4">
                          <button 
                            onClick={handleSaveResult}
                            className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-yellow-600/20 text-lg flex items-center justify-center gap-2"
                          >
                            <span className="material-symbols-outlined">save</span>
                            บันทึกผลรางวัล
                          </button>
                          <button
                            onClick={async () => {
                              if(!window.confirm('คุณต้องการจำลองผลรางวัลสำหรับหวยทั้งหมดในวันนี้หรือไม่?')) return;
                              try {
                                for(const lottery of lotteryTypes) {
                                  const r3Up = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
                                  const r2Down = String(Math.floor(Math.random() * 100)).padStart(2, '0');
                                  const r3Front = String(Math.floor(Math.random() * 1000)).padStart(3, '0') + ' ' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
                                  const r3Back = String(Math.floor(Math.random() * 1000)).padStart(3, '0') + ' ' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
                                  
                                  await addDoc(collection(db, 'lotteryResults'), {
                                    lotteryId: lottery.id,
                                    lotteryName: lottery.name,
                                    date: new Date().toLocaleDateString('en-CA'),
                                    results: {
                                      threeUp: r3Up,
                                      twoDown: r2Down,
                                      threeFront: lottery.name === 'หวยรัฐบาล' ? r3Front : '',
                                      threeBack: lottery.name === 'หวยรัฐบาล' ? r3Back : ''
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
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl font-bold transition shadow-lg shadow-blue-600/20 text-lg flex items-center justify-center gap-2 whitespace-nowrap"
                          >
                            <span className="material-symbols-outlined">auto_fix_high</span>
                            จำลองผลทุกหวย
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full min-h-[400px] flex items-center justify-center border border-dashed border-slate-600 rounded-lg bg-slate-900/50">
                        <div className="text-center">
                          <span className="material-symbols-outlined text-slate-500 text-5xl mb-2">touch_app</span>
                          <p className="text-slate-400 text-lg font-bold">เลือกหวยเพื่อออกผลรางวัล</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
                  <div className="text-slate-400 text-sm font-bold mb-2">ยอดแทงรวมทั้งหมด</div>
                  <div className="text-3xl font-black text-white">฿1,245,000</div>
                  <div className="text-xs text-green-400 mt-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">trending_up</span> +15% จากเมื่อวาน
                  </div>
                </div>
                <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
                  <div className="text-slate-400 text-sm font-bold mb-2">ยอดจ่ายรางวัลรวม</div>
                  <div className="text-3xl font-black text-red-400">฿840,200</div>
                  <div className="text-xs text-slate-500 mt-2">รอบปัจจุบัน</div>
                </div>
                <div className="bg-[#1e293b] p-6 rounded-xl border border-slate-700">
                  <div className="text-slate-400 text-sm font-bold mb-2">กำไรสุทธิ (Master)</div>
                  <div className="text-3xl font-black text-green-400">฿404,800</div>
                  <div className="text-xs text-slate-500 mt-2">หลังหัก % เอเย่นต์</div>
                </div>
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-6">
                <h3 className="text-lg font-bold text-white mb-4">รายการเล่นแบบละเอียดของสมาชิกลูกข่าย (Real-time)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800 text-slate-400">
                      <tr>
                        <th className="p-3 font-bold">เวลา</th>
                        <th className="p-3 font-bold">เอเย่นต์</th>
                        <th className="p-3 font-bold">สมาชิก</th>
                        <th className="p-3 font-bold">ประเภทหวย</th>
                        <th className="p-3 font-bold">รายการ</th>
                        <th className="p-3 font-bold text-right">ยอดแทง</th>
                        <th className="p-3 font-bold text-center">สถานะ</th>
                        <th className="p-3 font-bold text-center">ระบบคืนตั๋ว</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {/* Mock Data for demonstration */}
                      <tr className="hover:bg-slate-800/50">
                        <td className="p-3 text-slate-400">14:25:30</td>
                        <td className="p-3 text-purple-400 font-mono">agent_01</td>
                        <td className="p-3 text-slate-300">user_992</td>
                        <td className="p-3 text-slate-300">หวยรัฐบาล</td>
                        <td className="p-3 font-bold text-white">3 ตัวบน [123]</td>
                        <td className="p-3 text-right font-mono text-yellow-400">฿1,000</td>
                        <td className="p-3 text-center"><span className="text-yellow-500 text-xs bg-yellow-500/10 px-2 py-1 rounded">รอผล</span></td>
                        <td className="p-3 text-center">
                          <button className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500/40 transition">คืนตั๋ว</button>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-800/50">
                        <td className="p-3 text-slate-400">14:22:15</td>
                        <td className="p-3 text-purple-400 font-mono">agent_02</td>
                        <td className="p-3 text-slate-300">user_105</td>
                        <td className="p-3 text-slate-300">หวยฮานอย</td>
                        <td className="p-3 font-bold text-white">2 ตัวล่าง [45]</td>
                        <td className="p-3 text-right font-mono text-yellow-400">฿500</td>
                        <td className="p-3 text-center"><span className="text-green-500 text-xs bg-green-500/10 px-2 py-1 rounded">ถูกรางวัล</span></td>
                        <td className="p-3 text-center">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Audit Logs */}
                <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-6 flex flex-col h-[500px]">
                  <div className="flex items-center gap-3 border-b border-slate-700 pb-4 mb-4">
                    <span className="material-symbols-outlined text-blue-500 text-3xl">policy</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">ตรวจสอบการเข้าใช้งาน (Audit Logs)</h3>
                      <p className="text-xs text-slate-400">บันทึก IP, การเข้าระบบ, การแก้ไขรหัสผ่าน</p>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {systemLogs.map(log => (
                      <div key={log.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-blue-400">{log.action || 'System Event'}</span>
                          <span className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString('th-TH')}</span>
                        </div>
                        <div className="text-slate-300 text-xs">
                          By: <span className="text-purple-400 font-mono">{log.by || 'system'}</span> | 
                          IP: <span className="text-slate-400 font-mono ml-1">192.168.1.{Math.floor(Math.random() * 255)}</span>
                        </div>
                        {log.agentId && <div className="text-xs text-slate-400 mt-1">Target: {log.agentId}</div>}
                      </div>
                    ))}
                    {systemLogs.length === 0 && <div className="text-center text-slate-500 py-10">ไม่มีบันทึกระบบ</div>}
                  </div>
                </div>

                {/* Fraud Detection */}
                <div className="space-y-6">
                  <div className="bg-[#1e293b] rounded-xl border border-red-900/50 p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="material-symbols-outlined text-red-500 text-3xl animate-pulse">warning</span>
                      <div>
                        <h3 className="text-lg font-bold text-white">แจ้งเตือนความผิดปกติ (Fraud Detection)</h3>
                        <p className="text-xs text-red-400">ระบบตรวจจับการแทงซ้ำผิดปกติ / แทงสวน</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-red-400 font-bold text-sm">ตรวจพบการแทงซ้ำผิดปกติ</span>
                          <span className="text-xs text-slate-500">2 นาทีที่แล้ว</span>
                        </div>
                        <div className="text-slate-300 text-xs">
                          Agent <span className="text-purple-400">agent_05</span> มียอดแทงเลข [999] ซ้ำกัน 50 รายการใน 1 นาที
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button className="text-[10px] bg-red-500 text-white px-2 py-1 rounded">ระงับการแทงชั่วคราว</button>
                          <button className="text-[10px] bg-slate-700 text-white px-2 py-1 rounded">เพิกเฉย</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="material-symbols-outlined text-indigo-500 text-3xl">query_stats</span>
                      <div>
                        <h3 className="text-lg font-bold text-white">ระบบวิเคราะห์ข้อมูลการเล่น</h3>
                        <p className="text-xs text-slate-400">AI Analysis & Betting Patterns</p>
                      </div>
                    </div>
                    <div className="h-32 flex items-center justify-center border border-dashed border-slate-600 rounded-lg bg-slate-800/30">
                      <div className="text-center">
                        <span className="material-symbols-outlined text-slate-500 text-4xl mb-2">bar_chart</span>
                        <p className="text-slate-400 text-sm">กราฟวิเคราะห์ความเสี่ยงกำลังประมวลผล...</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB: API KEYS */}
          {activeTab === 'api_keys' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white">กำหนดสิทธินักพัฒนา (API Keys)</h3>
                  <p className="text-sm text-slate-400">จัดการ API Key สำหรับให้เอเย่นต์เชื่อมต่อระบบผ่าน API</p>
                </div>
                <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition">
                  <span className="material-symbols-outlined text-[18px]">add_key</span>
                  สร้าง Master API Key
                </button>
              </div>

              <div className="bg-[#1e293b] rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800 text-slate-400">
                    <tr>
                      <th className="p-4 font-bold">Agent / Owner</th>
                      <th className="p-4 font-bold">API Key</th>
                      <th className="p-4 font-bold">สิทธิ์การเข้าถึง</th>
                      <th className="p-4 font-bold text-center">สถานะ</th>
                      <th className="p-4 font-bold text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {agents.map(agent => (
                      <tr key={agent.id} className="hover:bg-slate-800/50 transition">
                        <td className="p-4 text-white font-medium">{agent.name} ({agent.username})</td>
                        <td className="p-4 font-mono text-xs text-slate-400">
                          <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded border border-slate-700 w-fit">
                            {agent.apiKey || 'Not Generated'}
                            {agent.apiKey && <span 
                              onClick={() => {
                                navigator.clipboard.writeText(agent.apiKey);
                                alert('คัดลอก API Key แล้ว');
                              }}
                              className="material-symbols-outlined text-[14px] cursor-pointer hover:text-white"
                            >content_copy</span>}
                          </div>
                        </td>
                        <td className="p-4 text-slate-300 text-xs">
                          <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded mr-1">Read</span>
                          <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Write (Bets)</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`text-xs font-bold ${agent.apiKey ? 'text-green-400' : 'text-slate-500'}`}>{agent.apiKey ? 'Active' : 'No Key'}</span>
                        </td>
                        <td className="p-4 text-right">
                          {agent.apiKey ? (
                            <button 
                              onClick={async () => {
                                if (confirm('คุณต้องการเพิกถอน API Key นี้ใช่หรือไม่?')) {
                                  await updateDoc(doc(db, 'agents', agent.id), { apiKey: '' });
                                }
                              }}
                              className="text-red-400 hover:text-red-300 text-xs font-bold underline"
                            >Revoke</button>
                          ) : (
                            <button 
                              onClick={async () => {
                                const newKey = 'sk_live_' + Math.random().toString(36).substr(2, 24);
                                await updateDoc(doc(db, 'agents', agent.id), { apiKey: newKey });
                              }}
                              className="text-blue-400 hover:text-blue-300 text-xs font-bold underline"
                            >Generate Key</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Add Agent Modal */}
      {showAddAgentModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto pt-24 pb-12">
          <div className="bg-white rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl border border-gray-200 animate-in zoom-in-95 duration-200 my-auto">
            <div className="bg-[#fcfdfa] p-4 flex justify-between items-center border-b border-gray-200">
              <h3 className="font-black text-gray-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600">person_add</span>
                เพิ่มเอเย่นต์/ตัวแทนขาย
              </h3>
              <button onClick={() => setShowAddAgentModal(false)} className="text-gray-400 hover:text-gray-800 transition">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
              
              {/* Section 1: Agent Info */}
              <div className="space-y-4">
                <h4 className="text-teal-600 font-bold text-lg">ข้อมูลเอเย่นต์</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div className="space-y-1 relative">
                       <label className="text-[10px] font-bold text-gray-500 absolute -top-2 left-2 bg-white px-1 z-10">คัดลอกชื่อผู้ใช้</label>
                       <select className="w-full bg-white border border-gray-300 text-gray-800 rounded p-2.5 text-sm appearance-none outline-none focus:border-teal-500 relative">
                         <option value="">- เลือก -</option>
                         {agents.map(a => <option key={a.id} value={a.username}>{a.username}</option>)}
                       </select>
                       <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">arrow_drop_down</span>
                    </div>
                    <div className="space-y-1 relative">
                       <label className="text-[10px] font-bold text-gray-500 absolute -top-2 left-2 bg-white px-1 z-10">ชื่อผู้ใช้</label>
                       <input type="text" value={newAgent.username} onChange={e => setNewAgent({...newAgent, username: e.target.value})} className="w-full bg-white border border-gray-300 text-gray-800 rounded p-2.5 text-sm outline-none focus:border-teal-500" />
                       <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-lg">error</span>
                    </div>
                    <div className="space-y-1 relative">
                       <label className="text-[10px] font-bold text-gray-500 absolute -top-2 left-2 bg-white px-1 z-10">รหัสผ่าน</label>
                       <input type="password" value={newAgent.password} onChange={e => setNewAgent({...newAgent, password: e.target.value})} className="w-full bg-white border border-gray-300 text-gray-800 rounded p-2.5 text-sm outline-none focus:border-teal-500" />
                       <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer text-lg">visibility_off</span>
                    </div>
                    <div className="space-y-1 relative">
                       <label className="text-[10px] font-bold text-gray-500 absolute -top-2 left-2 bg-white px-1 z-10">เบอร์โทรศัพท์</label>
                       <input type="text" value={newAgent.phone} onChange={e => setNewAgent({...newAgent, phone: e.target.value})} className="w-full bg-white border border-gray-300 text-gray-800 rounded p-2.5 text-sm outline-none focus:border-teal-500" />
                    </div>
                    <div className="space-y-1 relative">
                       <label className="text-[10px] font-bold text-gray-500 absolute -top-2 left-2 bg-white px-1 z-10">ตำแหน่ง</label>
                       <select value={newAgent.position} onChange={e => setNewAgent({...newAgent, position: e.target.value})} className="w-full bg-white border border-gray-300 text-gray-800 rounded p-2.5 text-sm appearance-none outline-none focus:border-teal-500">
                         <option value="Agent">Agent</option>
                         <option value="Master">Master</option>
                       </select>
                       <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">arrow_drop_down</span>
                    </div>
                    <div className="space-y-1 relative">
                       <label className="text-[10px] font-bold text-gray-500 absolute -top-2 left-2 bg-white px-1 z-10">ระดับ</label>
                       <select value={newAgent.level} onChange={e => setNewAgent({...newAgent, level: e.target.value})} className="w-full bg-white border border-gray-300 text-gray-800 rounded p-2.5 text-sm appearance-none outline-none focus:border-teal-500">
                         <option value="VIP">VIP</option>
                         <option value="Normal">Normal</option>
                       </select>
                       <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">arrow_drop_down</span>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div className="flex justify-end mb-2">
                       <button className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-1.5 rounded text-sm font-bold transition">คัดลอก</button>
                    </div>
                    <div className="space-y-1 relative">
                       <label className="text-[10px] font-bold text-gray-500 absolute -top-2 left-2 bg-white px-1 z-10">ชื่อ</label>
                       <input type="text" value={newAgent.name} onChange={e => setNewAgent({...newAgent, name: e.target.value})} className="w-full bg-white border border-gray-300 text-gray-800 rounded p-2.5 text-sm outline-none focus:border-teal-500" />
                    </div>
                    <div className="space-y-1 relative">
                       <label className="text-[10px] font-bold text-gray-500 absolute -top-2 left-2 bg-white px-1 z-10">ยืนยันรหัสผ่าน</label>
                       <input type="password" value={newAgent.confirmPassword} onChange={e => setNewAgent({...newAgent, confirmPassword: e.target.value})} className="w-full bg-white border border-gray-300 text-gray-800 rounded p-2.5 text-sm outline-none focus:border-teal-500" />
                       <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-teal-500 cursor-pointer text-lg">visibility</span>
                    </div>
                    <div className="space-y-1 relative">
                       <label className="text-[10px] font-bold text-gray-500 absolute -top-2 left-2 bg-white px-1 z-10">สกุลเงิน</label>
                       <select value={newAgent.currency} onChange={e => setNewAgent({...newAgent, currency: e.target.value})} className="w-full bg-white border border-gray-300 text-gray-800 rounded p-2.5 text-sm appearance-none outline-none focus:border-teal-500">
                         <option value="THB">THB</option>
                         <option value="USD">USD</option>
                       </select>
                       <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">arrow_drop_down</span>
                    </div>
                    <div className="space-y-1 relative">
                       <label className="text-[10px] font-bold text-gray-500 absolute -top-2 left-2 bg-white px-1 z-10">ประเภทการเดิมพัน</label>
                       <select value={newAgent.betType} onChange={e => setNewAgent({...newAgent, betType: e.target.value})} className="w-full bg-white border border-gray-300 text-gray-800 rounded p-2.5 text-sm appearance-none outline-none focus:border-teal-500">
                         <option value="seamless">seamless</option>
                         <option value="transfer">transfer</option>
                       </select>
                       <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">arrow_drop_down</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200"></div>

              {/* Section 2: Wallet */}
              <div className="space-y-4">
                <h4 className="text-teal-600 font-bold text-lg">กระเป๋าเงิน</h4>
                <div className="max-w-md">
                   <div className="flex border border-gray-300 rounded overflow-hidden focus-within:border-teal-500 bg-white">
                      <div className="bg-gray-50 text-gray-600 px-4 py-2 border-r border-gray-300 flex items-center justify-center font-bold">THB</div>
                      <input type="number" value={newAgent.credit} onChange={e => setNewAgent({...newAgent, credit: Number(e.target.value)})} className="w-full bg-transparent text-gray-800 p-2.5 outline-none" placeholder="0" />
                   </div>
                   <div className="text-[10px] text-gray-400 mt-1">ขั้นต่ำ 0, สูงสุด 294,417.01</div>
                </div>
              </div>

              <div className="border-t border-gray-200"></div>

              {/* Section 3: Royalty Setting */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-teal-600 font-bold text-lg">Royalty Setting</h4>
                  <div className="flex gap-2">
                    <button className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1 transition shadow-sm"><span className="material-symbols-outlined text-[14px]">settings</span> ตั้งค่า %</button>
                    <button className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1 transition shadow-sm"><span className="material-symbols-outlined text-[14px]">download</span> นำเข้า</button>
                    <button className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1 transition shadow-sm"><span className="material-symbols-outlined text-[14px]">upload</span> นำออก</button>
                  </div>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-4 overflow-x-auto custom-scrollbar">
                  <button className="px-6 py-3 border-b-2 border-teal-600 text-teal-600 font-bold whitespace-nowrap bg-gray-50">Lottery</button>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded">
                  <table className="w-full text-left bg-white whitespace-nowrap">
                    <thead className="bg-[#0f8b65] text-white text-xs">
                      <tr>
                        <th className="p-3 text-center border-r border-[#0d7a58] w-16">ลำดับ</th>
                        <th className="p-3 text-center border-r border-[#0d7a58] w-16 font-bold flex items-center justify-center gap-1">
                          <div className="w-6 h-3 bg-teal-400 rounded-full relative"><div className="absolute right-0.5 top-0.5 w-2 h-2 bg-white rounded-full"></div></div>
                        </th>
                        <th className="p-3 border-r border-[#0d7a58]">ชื่อโปรดักส์</th>
                        <th className="p-3 border-r border-[#0d7a58] text-center">เปอร์เซนต์ของเรา</th>
                        <th className="p-3 border-r border-[#0d7a58] text-center">ให้ถือเปอร์เซนต์</th>
                        <th className="p-3">
                           Callback Url<br/>
                           <span className="text-[9px] font-normal text-teal-100">Ex: http://"{"{Your Callback Url}"}"</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {LOTTERY_GROUPS.map((group, index) => {
                        const setting = newAgent.royaltySettings?.[group.id] || { active: true, ourPercentage: group.defaultOur, givenPercentage: 0, callbackUrl: '' };
                        return (
                          <tr key={group.id} className="text-sm">
                            <td className="p-3 border-r border-gray-200 text-center text-gray-600">{index + 1}</td>
                            <td className="p-3 border-r border-gray-200 text-center">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={setting.active} onChange={(e) => {
                                  setNewAgent({
                                    ...newAgent,
                                    royaltySettings: {
                                      ...newAgent.royaltySettings,
                                      [group.id]: { ...setting, active: e.target.checked }
                                    }
                                  });
                                }} />
                                <div className="w-8 h-4 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#0f8b65]"></div>
                              </label>
                            </td>
                            <td className="p-3 border-r border-gray-200 font-bold justify-center flex items-center gap-2">
                              {group.name === 'หวย ต่างๆ' ? <span className="material-symbols-outlined text-[16px] text-gray-400">payments</span> : null}
                              {group.name === 'หวยไทย' ? <span className="material-symbols-outlined text-[16px] text-gray-400">star</span> : null}
                              <span className="text-xl font-bold text-gray-900 tracking-tight">{group.name}</span>
                            </td>
                            <td className="p-3 border-r border-gray-200">
                               <select className="bg-white border text-gray-600 border-gray-300 rounded p-1.5 w-full outline-none focus:border-teal-500" value={setting.ourPercentage} onChange={(e) => {
                                  setNewAgent({
                                    ...newAgent,
                                    royaltySettings: {
                                      ...newAgent.royaltySettings,
                                      [group.id]: { ...setting, ourPercentage: Number(e.target.value) }
                                    }
                                  });
                               }}>
                                 {[91, 90, 89, 88, 87, 85, 80].map(p => <option key={p} value={p}>{p.toFixed(2)}%</option>)}
                               </select>
                            </td>
                            <td className="p-3 border-r border-gray-200">
                               <select className="bg-white border text-gray-600 border-gray-300 rounded p-1.5 w-full outline-none focus:border-teal-500" value={setting.givenPercentage} onChange={(e) => {
                                  setNewAgent({
                                    ...newAgent,
                                    royaltySettings: {
                                      ...newAgent.royaltySettings,
                                      [group.id]: { ...setting, givenPercentage: Number(e.target.value) }
                                    }
                                  });
                               }}>
                                 {[0, 1, 2, 3, 5, 10, 20].map(p => <option key={p} value={p}>{p.toFixed(2)}%</option>)}
                               </select>
                            </td>
                            <td className="p-3">
                               <input type="text" className="bg-white border border-gray-300 rounded p-1.5 w-full outline-none focus:border-teal-500" value={setting.callbackUrl} onChange={(e) => {
                                  setNewAgent({
                                    ...newAgent,
                                    royaltySettings: {
                                      ...newAgent.royaltySettings,
                                      [group.id]: { ...setting, callbackUrl: e.target.value }
                                    }
                                  });
                               }} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>

            </div>
            
            <div className="bg-[#fcfdfa] p-4 border-t border-gray-200 flex justify-center mt-auto">
              <button onClick={handleAddAgent} className="px-6 py-2 rounded-sm text-white bg-teal-700 hover:bg-teal-600 font-bold transition shadow-sm text-sm">เพิ่มเอเย่นต์</button>
            </div>
          </div>
        </div>
      )}

      {/* Topup Modal */}
      {showTopupModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#1e293b] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-700 animate-in zoom-in-95 duration-200">
            <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
              <h3 className="font-black text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-green-500">payments</span>
                จัดการการเงิน (เติมเครดิต)
              </h3>
              <button onClick={() => setShowTopupModal(false)} className="text-slate-400 hover:text-white transition">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                <div className="text-xs text-slate-400">เอเย่นต์</div>
                <div className="font-bold text-white">{selectedAgent.name} ({selectedAgent.username})</div>
                <div className="text-xs text-slate-400 mt-2">เครดิตปัจจุบัน</div>
                <div className="font-mono text-green-400 text-lg">฿{selectedAgent.credit?.toLocaleString() || 0}</div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400">จำนวนเงินที่ต้องการเติม</label>
                <input 
                  type="number" 
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 text-lg font-mono focus:border-green-500 outline-none"
                  placeholder="0.00"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button onClick={() => setShowTopupModal(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition">ยกเลิก</button>
                <button onClick={handleTopup} className="flex-1 py-3 rounded-xl font-black text-white bg-green-600 hover:bg-green-500 transition shadow-lg shadow-green-600/20">ยืนยันการเติมเงิน</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agent Settings Modal */}
      {showAgentSettingsModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#1e293b] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-700 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
              <h3 className="font-black text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-500">settings</span>
                ตั้งค่าสิทธิเอเย่นต์: {selectedAgent.name}
              </h3>
              <button onClick={() => setShowAgentSettingsModal(false)} className="text-slate-400 hover:text-white transition">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-500">toggle_on</span>
                  เปิด-ปิด ประเภทหวยสำหรับเอเย่นต์นี้
                </h4>
                <div className="space-y-2">
                  {lotteryTypes.map(lottery => {
                    const isDisabled = selectedAgent.disabledLotteries?.includes(lottery.id);
                    return (
                      <div key={lottery.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                        <div className="font-medium text-slate-200">{lottery.name}</div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={!isDisabled}
                            onChange={() => toggleAgentLottery(lottery.id)}
                          />
                          <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                      </div>
                    );
                  })}
                  {lotteryTypes.length === 0 && (
                    <div className="text-center text-slate-500 py-4">ไม่พบข้อมูลประเภทหวย</div>
                  )}
                </div>
              </div>

            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-end">
              <button onClick={() => setShowAgentSettingsModal(false)} className="px-6 py-2 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-500 transition">
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
