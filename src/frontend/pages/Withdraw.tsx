import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { doc, onSnapshot, collection, query, where, getDocs, limit } from 'firebase/firestore';

const PRESET_AMOUNTS = [300, 500, 1000, 2000, 5000];

export default function Withdraw() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [withdrawHistory, setWithdrawHistory] = useState<any[]>([]);
  const [successNotice, setSuccessNotice] = useState<any>(null);
  const [isWithdrawClosed, setIsWithdrawClosed] = useState(false);
  const [closedReason, setClosedReason] = useState('');

  const currentUserId = localStorage.getItem('userId');
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.systemOpen === false) {
            setIsWithdrawClosed(true);
            setClosedReason(d.maintenanceMessage || 'ระบบปิดปรับปรุงชั่วคราว');
          } else if (d.withdrawOpen === false) {
            setIsWithdrawClosed(true);
            setClosedReason('ระบบถอนเงินปิดปรับปรุงชั่วคราว ขออภัยในความไม่สะดวก');
          } else {
            setIsWithdrawClosed(false);
            setClosedReason('');
          }
        }
      });
      return () => unsub();
    } catch (e) {
      console.warn('Withdraw settings stream error:', e);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !currentUserId) {
      navigate('/login');
      return;
    }

    // 1) Subscribe to user data
    const unsubscribe = onSnapshot(doc(db, 'users', currentUserId), (snap) => {
      if (snap.exists()) {
        setUserData(snap.data());
      }
    });

    // 2) Fetch recent withdrawals
    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', currentUserId),
          where('type', '==', 'withdraw'),
          limit(10)
        );
        const s = await getDocs(q);
        const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setWithdrawHistory(list);
      } catch (e) {
        console.warn('Withdrawal history fetch warning:', e);
      }
    };

    fetchHistory();
    return () => unsubscribe();
  }, [currentUserId]);

  const balance = userData?.balance ?? 0;

  const handleSelectAmount = (val: number) => {
    setAmount(val);
    setCustomAmount(String(val));
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(val);
    setAmount(Number(val) || 0);
  };

  const handleAllIn = () => {
    const all = Math.floor(balance);
    setAmount(all);
    setCustomAmount(String(all));
  };

  const handleWithdraw = async () => {
    if (isWithdrawClosed) {
      alert(closedReason || 'ระบบถอนเงินปิดปรับปรุงชั่วคราว');
      return;
    }
    if (amount < 100) {
      alert('ยอดถอนขั้นต่ำคือ ฿100 บาท');
      return;
    }

    if (amount > balance) {
      alert(`ยอดเงินคงเหลือไม่เพียงพอ (มี ฿${balance.toLocaleString()})`);
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/v1/finance/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          amount: amount,
          bankName: userData?.bankName || 'ธนาคารกสิกรไทย',
          bankAccount: userData?.bankAccount || 'xxx-x-xxxxx',
          note: `แจ้งถอนเงินเข้าบัญชี ${userData?.bankAccount || ''}`,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setSuccessNotice({
          amount: amount,
          bankName: userData?.bankName || 'บัญชีธนาคารของท่าน',
          bankAccount: userData?.bankAccount || '',
          id: json.data?.id || `WD-${Date.now().toString().slice(-6)}`,
          time: new Date().toLocaleTimeString('th-TH'),
        });
        setAmount(0);
        setCustomAmount('');
      } else {
        alert(json.error?.message || 'เกิดข้อผิดพลาดในการแจ้งถอนเงิน');
      }
    } catch (e) {
      console.error('Withdraw error:', e);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      {/* Header */}
      <div className="bg-[#0a192f] p-3.5 flex items-center justify-between sticky top-[57px] z-40 shadow-md border-b border-[#f5c518]/20">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white flex items-center hover:text-[#f5c518] transition">
            <span className="material-symbols-outlined text-xl">arrow_back_ios</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#f5c518]">account_balance</span>
            <h1 className="text-white font-black text-lg">แจ้งถอนเงิน (Withdrawal)</h1>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-400">กระเป๋าเงิน</div>
          <div className="text-[#f5c518] font-black text-sm">
            ฿{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Success Modal */}
        {successNotice && (
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 text-center space-y-3 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg">
              <span className="material-symbols-outlined text-4xl">hourglass_top</span>
            </div>
            <h2 className="text-xl font-black text-emerald-950">ส่งคำขอถอนเงินเรียบร้อยแล้ว</h2>
            <p className="text-xs text-emerald-800">
              ระบบกำลังเตรียมโอนเงินยอด <strong className="font-black text-base text-emerald-950">฿{successNotice.amount.toLocaleString()}</strong> เข้าบัญชี {successNotice.bankName}
            </p>
            <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs text-gray-600">
              <div>เลขที่คำขอ: <code className="font-mono text-gray-900">{successNotice.id}</code></div>
              <div className="text-[11px] text-gray-400 mt-1">เวลาที่แจ้ง: {successNotice.time} น. (ระบบโอนเงินอัตโนมัติภายใน 1-3 นาที)</div>
            </div>
            <button
              onClick={() => setSuccessNotice(null)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs shadow transition"
            >
              ตกลง
            </button>
          </div>
        )}

        {/* Bank Account Info Card */}
        <div className="bg-gradient-to-b from-[#0a192f] to-[#051121] rounded-2xl p-5 text-white shadow-xl border border-[#f5c518]/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#f5c518] font-bold uppercase tracking-wider">บัญชีรับเงินโอนของคุณ</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              ยืนยันแล้ว
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-[#f5c518]">
              <span className="material-symbols-outlined text-2xl">credit_card</span>
            </div>
            <div>
              <div className="font-black text-base text-white">{userData?.bankName || 'ธนาคารกสิกรไทย (KBANK)'}</div>
              <div className="font-mono text-[#f5c518] text-sm tracking-wider">{userData?.bankAccount || 'xxx-x-xxxxx'}</div>
              <div className="text-xs text-gray-400 mt-0.5">ชื่อบัญชี: {userData?.firstName ? `${userData.firstName} ${userData.lastName || ''}` : userData?.username || 'สมาชิก AK88'}</div>
            </div>
          </div>

          <div className="text-[10px] text-gray-400 pt-2 border-t border-white/10 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs text-[#f5c518]">lock</span>
            <span>ระบบจะโอนเงินเข้าบัญชีที่ลงทะเบียนไว้เท่านั้น เพื่อความปลอดภัยสูงสุด</span>
          </div>
        </div>

        {/* Withdrawal Form */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-[#0a192f] font-black text-sm">ระบุจำนวนเงินที่ต้องการถอน</h2>
            <button
              type="button"
              onClick={handleAllIn}
              className="text-xs text-amber-600 hover:text-amber-800 font-black bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"
            >
              ถอนทั้งหมด (฿{Math.floor(balance).toLocaleString()})
            </button>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_AMOUNTS.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleSelectAmount(val)}
                className={`py-2 rounded-xl font-black text-xs transition border ${
                  amount === val
                    ? 'bg-[#0a192f] text-[#f5c518] border-[#0a192f] shadow-md scale-102'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                ฿{val.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Custom Input */}
          <div>
            <label className="text-xs font-bold text-gray-700 mb-1 block">กรอกจำนวนเงิน (บาท)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-gray-500 text-base">฿</span>
              <input
                type="text"
                value={customAmount}
                onChange={handleCustomChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-9 pr-4 text-gray-900 font-black text-lg focus:outline-none focus:ring-2 focus:ring-[#f5c518]"
                placeholder="0"
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-400 mt-1.5">
              <span>* ถอนขั้นต่ำ ฿100 บาท</span>
              <span>ถอนได้สูงสุด ฿500,000 ต่อครั้ง</span>
            </div>
          </div>

          {isWithdrawClosed && (
            <div className="p-3 bg-red-100 text-red-800 rounded-xl text-xs font-black border border-red-300 text-center flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-base text-red-600">block</span>
              <span>{closedReason || 'ระบบถอนเงินปิดปรับปรุงชั่วคราว'}</span>
            </div>
          )}

          <button
            onClick={handleWithdraw}
            disabled={isProcessing || amount <= 0 || isWithdrawClosed}
            className={`w-full font-black rounded-xl py-3.5 text-base shadow-lg transition flex items-center justify-center gap-2 ${
              isWithdrawClosed 
                ? 'bg-gray-400 text-gray-700 cursor-not-allowed opacity-75' 
                : 'bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 text-[#0a192f] hover:brightness-105 active:scale-95 cursor-pointer disabled:opacity-50'
            }`}
          >
            {isWithdrawClosed ? (
              <>
                <span className="material-symbols-outlined text-xl">lock</span>
                <span>ระบบปิดรับถอนเงินชั่วคราว</span>
              </>
            ) : isProcessing ? (
              <>กำลังดำเนินการ...</>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">send_money</span>
                <span>ยืนยันการแจ้งถอนเงิน</span>
              </>
            )}
          </button>
        </div>

        {/* Withdrawal History */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="font-black text-[#0a192f] text-sm mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-gray-500">history</span>
            ประวัติการแจ้งถอนเงิน
          </h3>

          {withdrawHistory.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400">ยังไม่มีประวัติการถอนเงิน</div>
          ) : (
            <div className="space-y-2">
              {withdrawHistory.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                  <div>
                    <div className="font-black text-red-600">- ฿{(Number(tx.amount) || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400">
                      {new Date(tx.createdAt || Date.now()).toLocaleString('th-TH')}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    tx.status === 'success' || tx.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : tx.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {tx.status === 'success' || tx.status === 'approved'
                      ? 'โอนสำเร็จ'
                      : tx.status === 'rejected'
                      ? 'ปฏิเสธ (คืนเครดิต)'
                      : 'รอดำเนินการ'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
