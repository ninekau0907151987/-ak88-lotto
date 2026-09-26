import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot, addDoc, collection } from 'firebase/firestore';

export default function Withdraw() {
  const navigate = useNavigate();
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

  const handleWithdraw = async () => {
    if (amount <= 0) {
      alert('กรุณาระบุจำนวนเงินที่ต้องการถอน');
      return;
    }

    if (amount > (userData?.balance || 0)) {
      alert('ยอดเงินคงเหลือไม่เพียงพอ');
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', currentUserId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const currentBalance = userSnap.data().balance || 0;
        const newBalance = currentBalance - amount;
        
        // Update User Balance
        await updateDoc(userRef, { balance: newBalance });

        // Add to Transaction History
        await addDoc(collection(db, 'transactions'), {
          userId: currentUserId,
          type: 'withdraw',
          amount: amount,
          status: 'success',
          createdAt: new Date().toISOString(),
          description: 'ถอนเงินผ่านระบบ (Demo)'
        });

        alert(`ถอนเงินสำเร็จ! ยอดเงินคงเหลือของคุณคือ ฿${newBalance.toLocaleString()}`);
        setAmount(0);
      }
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการถอนเงิน');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-[var(--navy-deep)] p-3 flex items-center gap-3 sticky top-[57px] z-40 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white flex items-center">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)]">account_balance</span>
          <h1 className="text-white font-bold text-lg">ถอนเงิน</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-[var(--navy-deep)] rounded-xl p-6 text-center shadow-lg border border-[var(--gold-vibrant)] overflow-hidden">
          <p className="text-gray-300 text-sm mb-1">ยอดเงินที่ถอนได้ทั้งหมด</p>
          <div className="w-full overflow-hidden flex items-center justify-center px-2 my-1">
            <h2 
              className={`font-black text-[var(--gold-vibrant)] tracking-tight max-w-full truncate ${
                (userData?.balance || 0) >= 10000000 
                  ? 'text-xl sm:text-2xl md:text-3xl' 
                  : (userData?.balance || 0) >= 1000000 
                  ? 'text-2xl sm:text-3xl md:text-4xl' 
                  : 'text-3xl sm:text-4xl'
              }`}
              title={`฿ ${(userData?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            >
              ฿ {(userData?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-[var(--grey-border)]">
          <label className="text-[var(--navy-deep)] text-sm font-bold mb-2 block">ระบุจำนวนเงินที่ต้องการถอน</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--navy-deep)] font-bold">฿</span>
            <input 
              type="number" 
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-gray-50 border border-[var(--grey-border)] rounded-lg py-3 pl-8 pr-4 text-[var(--navy-deep)] font-bold text-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]" 
              placeholder="0.00" 
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setAmount(100)} className="flex-1 bg-gray-100 text-[var(--navy-deep)] py-2 rounded border border-[var(--grey-border)] text-sm font-bold hover:bg-gray-200">100</button>
            <button onClick={() => setAmount(500)} className="flex-1 bg-gray-100 text-[var(--navy-deep)] py-2 rounded border border-[var(--grey-border)] text-sm font-bold hover:bg-gray-200">500</button>
            <button onClick={() => setAmount(1000)} className="flex-1 bg-gray-100 text-[var(--navy-deep)] py-2 rounded border border-[var(--grey-border)] text-sm font-bold hover:bg-gray-200">1000</button>
            <button onClick={() => setAmount(userData?.balance || 0)} className="flex-1 bg-[var(--navy-deep)] text-[var(--gold-vibrant)] py-2 rounded border border-[var(--navy-deep)] text-sm font-bold hover:bg-[#051121]">ทั้งหมด</button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-[var(--grey-border)]">
          <h3 className="text-[var(--navy-deep)] font-bold text-sm mb-3 border-b border-[var(--grey-border)] pb-2">บัญชีรับเงิน</h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center border border-green-200">
              <span className="text-green-600 font-bold text-xs">KBANK</span>
            </div>
            <div>
              <div className="text-[var(--navy-deep)] font-bold text-sm">{userData?.bankName || 'ธนาคารกสิกรไทย'}</div>
              <div className="text-gray-500 text-xs">{userData?.bankAccount || 'xxx-x-xx123-4'}</div>
              <div className="text-gray-500 text-xs">{userData?.firstName} {userData?.lastName}</div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleWithdraw}
          disabled={isProcessing}
          className="w-full bg-[var(--gold-vibrant)] text-[var(--navy-deep)] font-black rounded-lg py-3 text-lg shadow-lg transform transition active:scale-95 mt-4 disabled:opacity-50"
        >
          {isProcessing ? 'กำลังดำเนินการ...' : 'ยืนยันการถอนเงิน'}
        </button>
      </div>
    </div>
  );
}
