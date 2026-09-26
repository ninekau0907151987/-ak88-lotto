import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { doc, onSnapshot, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

const PRESET_AMOUNTS = [100, 300, 500, 1000, 2000, 5000, 10000];

export default function Deposit() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'amount' | 'qr_verify'>('amount');
  const [amount, setAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('500');
  const [userData, setUserData] = useState<any>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [transRef, setTransRef] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [successResult, setSuccessResult] = useState<any>(null);
  const [depositHistory, setDepositHistory] = useState<any[]>([]);

  const currentUserId = localStorage.getItem('userId');
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const username = localStorage.getItem('username') || userData?.username || 'สมาชิก';

  useEffect(() => {
    if (!isLoggedIn || !currentUserId) {
      navigate('/login');
      return;
    }

    // Listen user balance
    const unsubscribe = onSnapshot(doc(db, 'users', currentUserId), (snap) => {
      if (snap.exists()) {
        setUserData(snap.data());
      }
    });

    // Fetch recent deposits
    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'transactions'),
          where('userId', '==', currentUserId),
          where('type', '==', 'deposit'),
          limit(10)
        );
        const s = await getDocs(q);
        const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setDepositHistory(list);
      } catch (e) {
        console.warn('History fetch error:', e);
      }
    };

    fetchHistory();
    return () => unsubscribe();
  }, [currentUserId]);

  const handleSelectAmount = (val: number) => {
    setAmount(val);
    setCustomAmount(String(val));
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(val);
    setAmount(Number(val) || 0);
  };

  const handleProceedToQR = () => {
    if (amount < 20) {
      alert('ยอดฝากขั้นต่ำคือ ฿20 บาท');
      return;
    }
    // สุ่มเลขที่อ้างอิงสลิปอัตโนมัติ
    setTransRef(`SLIP${Date.now().toString().slice(-8)}`);
    setStep('qr_verify');
  };

  const handleSlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSlipFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // ตรวจสลิปและปรับยอดเครดิตอัตโนมัติ
  const handleVerifySlip = async () => {
    if (amount <= 0) {
      alert('กรุณาระบุจำนวนเงินที่ถูกต้อง');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch('/api/v1/finance/slip/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          amount: amount,
          transRef: transRef || `SLIP-${Date.now().toString().slice(-8)}`,
          bankName: 'พร้อมเพย์ QR',
          note: `ฝากเงินผ่าน QR PromptPay ยอด ฿${amount.toLocaleString()}`,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setSuccessResult(json.data);
      } else {
        alert(json.error?.message || 'การตรวจสอบสลิปล้มเหลว กรุณาตรวจสอบข้อมูลสลิปอีกครั้ง');
      }
    } catch (e) {
      console.error('Slip verify error:', e);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsVerifying(false);
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
            <span className="material-symbols-outlined text-[#f5c518]">account_balance_wallet</span>
            <h1 className="text-white font-black text-lg">ฝากเงินอัตโนมัติ (Auto Deposit)</h1>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-400">ยอดเงินปัจจุบัน</div>
          <div className="text-[#f5c518] font-black text-sm">
            ฿{(userData?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Success Modal / Banner */}
        {successResult && (
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 text-center space-y-3 shadow-xl animate-bounce-short">
            <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg">
              <span className="material-symbols-outlined text-4xl">check_circle</span>
            </div>
            <h2 className="text-xl font-black text-emerald-900">ตรวจสลิปถูกต้อง เติมเงินสำเร็จ!</h2>
            <p className="text-sm text-emerald-800">
              ระบบได้เติมเครดิตจำนวน <strong className="text-emerald-950 font-black text-lg">฿{successResult.amount?.toLocaleString()}</strong> เข้าบัญชีของคุณเรียบร้อยแล้ว
            </p>
            <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs text-gray-600 font-mono">
              รหัสอ้างอิง: {successResult.transRef}
            </div>
            <div className="pt-2 flex gap-2">
              <button
                onClick={() => { setSuccessResult(null); setStep('amount'); setSlipPreview(null); }}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-xs hover:bg-gray-200 transition"
              >
                ฝากเงินเพิ่ม
              </button>
              <Link
                to="/lottery"
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs shadow transition flex items-center justify-center gap-1"
              >
                <span>ไปแทงหวย</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>
          </div>
        )}

        {/* Step 1: เลือกจำนวนเงิน */}
        {step === 'amount' && !successResult && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <span className="w-6 h-6 rounded-full bg-[#f5c518] text-[#0a192f] text-xs font-black flex items-center justify-center">1</span>
              <h2 className="text-[#0a192f] font-black text-sm">ระบุจำนวนเงินที่ต้องการฝาก</h2>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleSelectAmount(val)}
                  className={`py-2.5 rounded-xl font-black text-xs transition border ${
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
              <label className="text-xs font-bold text-gray-700 mb-1 block">หรือกรอกจำนวนเงินเอง (บาท)</label>
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
              <span className="text-[10px] text-gray-400 mt-1 block">* ฝากขั้นต่ำ ฿20 บาท</span>
            </div>

            <button
              onClick={handleProceedToQR}
              className="w-full bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 text-[#0a192f] font-black rounded-xl py-3.5 text-base shadow-lg hover:brightness-105 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              <span>ต่อไป: สแกน QR และแนบสลิป</span>
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </div>
        )}

        {/* Step 2: QR Code & แนบสลิปตรวจออโต้ */}
        {step === 'qr_verify' && !successResult && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#f5c518] text-[#0a192f] text-xs font-black flex items-center justify-center">2</span>
                <h2 className="text-[#0a192f] font-black text-sm">สแกนชำระเงิน & ตรวจสลิป</h2>
              </div>
              <button
                onClick={() => setStep('amount')}
                className="text-xs text-gray-500 hover:text-gray-800 font-bold flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                เปลี่ยนยอดเงิน
              </button>
            </div>

            {/* QR Code Card */}
            <div className="bg-gradient-to-b from-[#0a192f] to-[#040d1a] p-5 rounded-2xl text-center text-white space-y-3 shadow-md border border-[#f5c518]/30">
              <div className="text-xs text-gray-300 font-bold uppercase tracking-wider">พร้อมเพย์ QR Code (PromptPay)</div>
              
              {/* QR Image */}
              <div className="w-48 h-48 bg-white p-2.5 rounded-2xl mx-auto shadow-inner flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=00020101021129370016A000000677010111011300668912345675802TH5303764540${amount}.006304`}
                  alt="PromptPay QR Code"
                  className="w-full h-full object-contain"
                />
              </div>

              <div>
                <div className="text-xs text-gray-400">ยอดที่ต้องชำระตรงตามนี้เท่านั้น</div>
                <div className="text-2xl font-black text-[#f5c518]">฿{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              </div>

              <div className="bg-white/10 rounded-xl p-2.5 text-xs text-left space-y-1 border border-white/10">
                <div className="flex justify-between">
                  <span className="text-gray-400">ชื่อบัญชี:</span>
                  <span className="font-bold text-white">บจก. เอเค88 ล็อตโต้ (AK88)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">พร้อมเพย์:</span>
                  <span className="font-bold text-[#f5c518]">089-123-4567</span>
                </div>
              </div>
            </div>

            {/* แนบสลิป */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-black text-[#0a192f] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-emerald-600">receipt_long</span>
                <span>แนบรูปสลิปเพื่อตรวจยอดอัตโนมัติ (Slip Verification)</span>
              </label>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-gray-300 hover:border-[#f5c518] rounded-2xl p-4 text-center cursor-pointer transition relative bg-gray-50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSlipChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {slipPreview ? (
                  <div className="space-y-2">
                    <img src={slipPreview} alt="Slip preview" className="max-h-48 mx-auto rounded-lg shadow-sm border" />
                    <span className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      แนบสลิปเรียบร้อย (คลิกเพื่อเปลี่ยนรูป)
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1.5 py-3">
                    <span className="material-symbols-outlined text-4xl text-gray-400">add_photo_alternate</span>
                    <div className="text-xs font-bold text-gray-700">แตะที่นี่เพื่อเลือกรูปสลิปจากอัลบั้ม หรือถ่ายภาพ</div>
                    <div className="text-[10px] text-gray-400">รองรับไฟล์ JPG, PNG ทุกขนาด</div>
                  </div>
                )}
              </div>

              {/* รหัสอ้างอิง */}
              <div>
                <label className="text-[11px] font-bold text-gray-600 block mb-1">รหัสอ้างอิงสลิป (Reference ID)</label>
                <input
                  type="text"
                  value={transRef}
                  onChange={(e) => setTransRef(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs text-gray-800 font-mono"
                  placeholder="เช่น SLIP-12345678"
                />
              </div>

              {/* Verify Button */}
              <button
                onClick={handleVerifySlip}
                disabled={isVerifying}
                className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white font-black rounded-xl py-3.5 text-base shadow-lg hover:brightness-105 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isVerifying ? (
                  <>กำลังตรวจสอบสลิป...</>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl">verified</span>
                    <span>ตรวจสอบสลิปและเติมเงินทันที</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Deposit History */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="font-black text-[#0a192f] text-sm mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-gray-500">history</span>
            ประวัติการฝากเงินล่าสุด
          </h3>

          {depositHistory.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400">ยังไม่มีประวัติการฝากเงิน</div>
          ) : (
            <div className="space-y-2">
              {depositHistory.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                  <div>
                    <div className="font-black text-gray-900">+ ฿{(Number(tx.amount) || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400">
                      {new Date(tx.createdAt || Date.now()).toLocaleString('th-TH')}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                    tx.status === 'success' || tx.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {tx.status === 'success' || tx.status === 'approved' ? 'สำเร็จ' : 'รอดำเนินการ'}
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
