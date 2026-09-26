import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';

export default function LotteryRules() {
  const { type } = useParams();
  const navigate = useNavigate();
  const [rules, setRules] = useState<{ imageUrl?: string; text?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRules = async () => {
      if (!type) return;
      try {
        // Find the lottery type by name (since type in URL is the name)
        // In a real app, you might want to query by name or pass the ID
        // For simplicity, we assume the document ID is the name or we need to query it
        // Let's assume we need to query by name
        import('firebase/firestore').then(({ collection, query, where, getDocs }) => {
          const q = query(collection(db, 'lotteryTypes'), where('name', '==', decodeURIComponent(type)));
          getDocs(q).then(snapshot => {
            if (!snapshot.empty) {
              const data = snapshot.docs[0].data();
              setRules(data.rules || null);
            }
            setLoading(false);
          });
        });
      } catch (error) {
        console.error("Error fetching rules:", error);
        setLoading(false);
      }
    };

    fetchRules();
  }, [type]);

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-20">
      {/* Header */}
      <div className="bg-[var(--navy-deep)] text-white p-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold">กติกาและวิธีเล่น: {decodeURIComponent(type || '')}</h1>
        </div>
      </div>

      <div className="p-4 max-w-3xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--navy-deep)]"></div>
          </div>
        ) : rules ? (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            {rules.imageUrl && (
              <div className="w-full">
                <img src={rules.imageUrl} alt="Rules Banner" className="w-full h-auto object-contain" />
              </div>
            )}
            
            {rules.text && (
              <div className="p-6">
                <h2 className="text-xl font-bold text-[var(--navy-deep)] mb-4 border-b pb-2">รายละเอียดกติกา</h2>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {rules.text}
                </div>
              </div>
            )}

            {!rules.imageUrl && !rules.text && (
              <div className="p-12 text-center text-gray-500">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">description</span>
                <p>ยังไม่มีการระบุกติกาสำหรับหวยประเภทนี้</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500 border border-gray-200">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">description</span>
            <p>ไม่พบข้อมูลกติกา</p>
          </div>
        )}
      </div>
    </div>
  );
}
