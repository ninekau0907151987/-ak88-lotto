import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot, addDoc, collection } from 'firebase/firestore';

export default function Deposit() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<'select' | 'qr' | 'promptpay'>('select');
  const [amount, setAmount] = useState<number>(0);
  const [userData, setUserData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentUserId = localStorage.getItem('userId') || 'demo_user';

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', currentUserId), (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
    });
    return () => unsubscribe();
  }, [currentUserId]);

  const handleDeposit = async () => {
    if (amount <= 0) {
      alert('กรุณาระบุจำนวนเงินที่ต้องการฝาก');
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', currentUserId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const currentBalance = userSnap.data().balance || 0;
        const newBalance = currentBalance + amount;
        
        // Update User Balance
        await updateDoc(userRef, { balance: newBalance });

        // Add to Transaction History
        await addDoc(collection(db, 'transactions'), {
          userId: currentUserId,
          type: 'deposit',
          amount: amount,
          status: 'success',
          createdAt: new Date().toISOString(),
          description: 'ฝากเงินผ่านระบบ (Demo)'
        });

        alert(`ฝากเงินสำเร็จ! ยอดเงินใหม่ของคุณคือ ฿${newBalance.toLocaleString()}`);
        setAmount(0);
        setMethod('select');
      }
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการฝากเงิน');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-grey-light)] pb-20">
      {/* Header */}
      <div className="bg-[var(--navy-deep)] p-3 flex items-center gap-3 sticky top-[57px] z-40 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white flex items-center">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)]">account_balance_wallet</span>
          <h1 className="text-white font-bold text-lg">ฝากเงิน</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Account Info */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-[var(--grey-border)] text-center">
          <div className="w-16 h-16 bg-[var(--navy-deep)] rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-[var(--gold-vibrant)]">
            <span className="material-symbols-outlined text-4xl text-[var(--gold-vibrant)]">account_circle</span>
          </div>
          <h2 className="text-xl font-black text-[var(--navy-deep)] mb-1">ชื่อบัญชี: cay</h2>
          <p className="text-sm text-gray-500">กรุณาเลือกช่องทางการฝากเงินที่ท่านสะดวก</p>
        </div>

        {/* Deposit Options */}
        {method === 'select' && (
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setMethod('qr')} className="bg-white border-2 border-[var(--navy-deep)] rounded-xl p-6 flex flex-col items-center justify-center gap-3 shadow-md transform transition active:scale-95 hover:bg-gray-50">
              <span className="material-symbols-outlined text-5xl text-[var(--navy-deep)]">qr_code_scanner</span>
              <span className="font-bold text-[var(--navy-deep)] text-lg text-center">คิวอาร์โค้ด<br/><span className="text-sm font-normal">(QR Code)</span></span>
            </button>
            
            <button onClick={() => setMethod('promptpay')} className="bg-white border-2 border-[var(--gold-vibrant)] rounded-xl p-6 flex flex-col items-center justify-center gap-3 shadow-md transform transition active:scale-95 hover:bg-gray-50">
              <div className="w-12 h-12 bg-[var(--gold-vibrant)] rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-[var(--navy-deep)]">currency_exchange</span>
              </div>
              <span className="font-bold text-[var(--gold-vibrant)] text-lg text-center">พร้อมเพย์<br/><span className="text-sm font-normal">(PromptPay)</span></span>
            </button>
          </div>
        )}

        {method === 'qr' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-[var(--grey-border)] flex flex-col items-center">
            <h3 className="text-[var(--navy-deep)] font-bold text-lg mb-4">สแกน QR Code เพื่อฝากเงิน</h3>
            
            <div className="w-full mb-4">
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">ระบุจำนวนเงินที่โอน</label>
              <input 
                type="number" 
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full border-2 border-[var(--navy-deep)] rounded-xl p-3 font-bold text-xl text-center"
                placeholder="0.00"
              />
            </div>

            <div className="w-48 h-48 bg-gray-100 border-4 border-[var(--navy-deep)] rounded-lg flex items-center justify-center mb-4 p-2">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=promptpay1234567890_${amount}`} alt="QR Code" className="w-full h-full object-contain" />
            </div>
            <p className="text-sm text-gray-500 text-center mb-4">บันทึกรูปภาพนี้และสแกนผ่านแอปธนาคารของคุณ<br/>ยอดเงินจะเข้าอัตโนมัติภายใน 1 นาที</p>
            <div className="flex gap-2 w-full">
              <button onClick={() => setMethod('select')} className="flex-1 py-2 border border-[var(--grey-border)] rounded-lg text-[var(--navy-deep)] font-bold hover:bg-gray-50">
                ย้อนกลับ
              </button>
              <button 
                onClick={handleDeposit}
                disabled={isProcessing}
                className="flex-1 py-2 bg-[var(--gold-vibrant)] text-[var(--navy-deep)] rounded-lg font-bold shadow-sm disabled:opacity-50"
              >
                {isProcessing ? 'กำลังตรวจสอบ...' : 'แจ้งโอนเงิน'}
              </button>
            </div>
          </div>
        )}

        {method === 'promptpay' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-[var(--grey-border)] flex flex-col items-center">
            <h3 className="text-[var(--navy-deep)] font-bold text-lg mb-4">โอนเงินผ่านพร้อมเพย์</h3>
            
            <div className="w-full mb-4">
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">ระบุจำนวนเงินที่โอน</label>
              <input 
                type="number" 
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full border-2 border-[var(--gold-vibrant)] rounded-xl p-3 font-bold text-xl text-center"
                placeholder="0.00"
              />
            </div>

            <div className="text-3xl font-black text-[var(--navy-deep)] tracking-wider mb-2">081-234-5678</div>
            <div className="text-sm text-gray-600 mb-4">ชื่อบัญชี: บจก. เอเค แปดแปด</div>
            <div className="flex gap-2 w-full">
              <button onClick={() => setMethod('select')} className="flex-1 py-2 border border-[var(--grey-border)] rounded-lg text-[var(--navy-deep)] font-bold hover:bg-gray-50">
                ย้อนกลับ
              </button>
              <button 
                onClick={handleDeposit}
                disabled={isProcessing}
                className="flex-1 py-2 bg-[var(--navy-deep)] text-white rounded-lg font-bold shadow-sm flex items-center justify-center gap-1 disabled:opacity-50"
              >
                {isProcessing ? 'กำลังตรวจสอบ...' : 'แจ้งโอนเงิน'}
              </button>
            </div>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2 mt-4">
          <span className="material-symbols-outlined text-yellow-600">warning</span>
          <div className="text-xs text-yellow-800">
            <strong>หมายเหตุ:</strong> กรุณาโอนเงินจากบัญชีที่ผูกไว้กับระบบเท่านั้น เพื่อความรวดเร็วในการปรับยอดเงิน
          </div>
        </div>
      </div>
    </div>
  );
}
