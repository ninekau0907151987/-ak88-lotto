import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

export default function History() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', 'demo_user'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-[var(--navy-deep)] p-3 flex items-center gap-3 sticky top-[57px] z-40 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white flex items-center">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)]">swap_vert</span>
          <h1 className="text-white font-bold text-lg">รายการฝาก-ถอน</h1>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {transactions.map(tx => (
          <div key={tx.id} className="bg-white p-3 rounded-xl shadow-sm border border-[var(--grey-border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                <span className="material-symbols-outlined">{tx.type === 'deposit' ? 'arrow_downward' : 'arrow_upward'}</span>
              </div>
              <div>
                <div className="text-[var(--navy-deep)] font-bold text-sm">{tx.type === 'deposit' ? 'ฝากเงิน' : 'ถอนเงิน'}</div>
                <div className="text-gray-500 text-xs">{new Date(tx.createdAt).toLocaleString('th-TH')}</div>
                <div className="text-gray-400 text-[10px]">Ref: {tx.id}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`font-bold ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                {tx.type === 'deposit' ? '+' : '-'}฿{tx.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}
              </div>
              <div className={`text-[10px] px-2 py-0.5 rounded-full inline-block mt-1 ${tx.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {tx.status === 'success' ? 'สำเร็จ' : 'รอดำเนินการ'}
              </div>
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <span className="material-symbols-outlined text-4xl mb-2">history</span>
            <p>ไม่มีประวัติการทำรายการ</p>
          </div>
        )}
      </div>
    </div>
  );
}
