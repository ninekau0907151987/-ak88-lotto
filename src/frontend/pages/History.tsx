import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

export default function History() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const currentUserId = localStorage.getItem('userId');
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  useEffect(() => {
    if (!isLoggedIn || !currentUserId) {
      return;
    }

    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', currentUserId),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        console.warn('History subscription notice:', err);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('History query error:', e);
    }
  }, [currentUserId, isLoggedIn]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <div className="bg-[#0a192f] p-3 flex items-center justify-between sticky top-0 z-40 shadow-md border-b border-[#f5c518]/20">
        <button onClick={() => navigate(-1)} className="text-[#f5c518] flex items-center p-1 cursor-pointer">
          <span className="material-symbols-outlined text-xl">arrow_back_ios</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#f5c518]">swap_vert</span>
          <h1 className="text-white font-bold text-base">รายการฝาก-ถอน</h1>
        </div>
        <div className="w-8" />
      </div>

      <div className="p-3 space-y-3 max-w-lg mx-auto">
        {!isLoggedIn ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 mt-6 shadow-sm">
            <span className="material-symbols-outlined text-5xl text-gray-400 mb-2">lock</span>
            <h3 className="font-bold text-[#0a192f] text-base">กรุณาเข้าสู่ระบบ</h3>
            <p className="text-gray-500 text-xs mt-1 mb-4">เข้าสู่ระบบเพื่อตรวจสอบประวัติการทำรายการฝาก-ถอนเงินของคุณ</p>
            <Link
              to="/login"
              className="inline-block bg-[#f5c518] text-[#0a192f] font-black px-6 py-2.5 rounded-xl text-sm"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        ) : (
          <>
            {transactions.map(tx => (
              <div key={tx.id} className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${tx.type === 'deposit' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    <span className="material-symbols-outlined">{tx.type === 'deposit' ? 'arrow_downward' : 'arrow_upward'}</span>
                  </div>
                  <div>
                    <div className="text-[#0a192f] font-bold text-sm">{tx.type === 'deposit' ? 'ฝากเงิน (โอนผ่าน QR)' : 'ถอนเงิน (โอนเข้าบัญชี)'}</div>
                    <div className="text-gray-500 text-xs">{tx.createdAt ? new Date(tx.createdAt).toLocaleString('th-TH') : '-'}</div>
                    <div className="text-gray-400 text-[10px] font-mono">Ref: {tx.id}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-black text-base ${tx.type === 'deposit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tx.type === 'deposit' ? '+' : '-'}฿{Number(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className={`text-[10px] px-2 py-0.5 rounded-full inline-block mt-1 font-bold ${tx.status === 'success' || tx.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : tx.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    {tx.status === 'success' || tx.status === 'approved' ? 'สำเร็จ' : tx.status === 'rejected' ? 'ปฏิเสธ' : 'รอดำเนินการ'}
                  </div>
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <span className="material-symbols-outlined text-5xl mb-2 text-gray-300">receipt_long</span>
                <p className="text-sm font-medium">ยังไม่มีประวัติรายการฝาก-ถอน</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
