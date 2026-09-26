import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';

const LOTTERY_LIST = [
  'หวยรัฐบาล',
  'หวยธกส.',
  'หวยออมสิน',
  'หวยลาวพัฒนา',
  'หวยลาวประตูชัย',
  'หวยลาวสันติภาพ',
  'หวยประชาชนลาว',
  'ลาว(EXTRA)',
  'หวยลาวTV',
  'หวยลาวHD',
  'หวยลาวสตาร์',
  'ลาวกาชาด',
  'หวยลาวสตาร์(VIP)',
  'หวยฮานอย',
  'ฮานอยพิเศษ',
  'ฮานอย(VIP)',
  'ฮานอย(HD)',
  'ฮานอยสตาร์',
  'ฮานอยTV',
  'ฮานอยกาชาด',
  'ฮานอยสามัคคี',
  'ฮานอย(EXTRA)',
  'หวยมาเลย์',
  'ยี่กี 4D',
  'ดาวน์โจนส์ STAR',
  'นิเคอิ VIP (เช้า)',
  'เวียดนาม VIP (เช้า)',
  'จีน VIP (เช้า)',
  'ฮั่งเส็ง VIP (เช้า)',
  'ไต้หวัน VIP',
  'เกาหลี VIP',
  'นิเคอิ VIP (บ่าย)',
  'เวียดนาม VIP (บ่าย)',
  'จีน VIP (บ่าย)',
  'ฮั่งเส็ง VIP (บ่าย)',
  'ลาว VIP',
  'หุ้นสิงคโปร์',
  'หุ้นอินเดีย',
];

export default function LotteryResults() {
  const navigate = useNavigate();
  const [results, setResults] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState(
    new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
  );

  useEffect(() => {
    const q = query(collection(db, 'lotteryResults'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const getResultFor = (name: string) => {
    return results.find(r => r.lotteryName === name && (!filterDate || r.date === filterDate));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-[var(--navy-deep)] p-3 flex items-center gap-3 sticky top-[57px] z-40 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white flex items-center hover:bg-white/10 p-1 rounded-full transition">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)] text-2xl">emoji_events</span>
          <h1 className="text-white font-bold text-lg">ผลรางวัล ({LOTTERY_LIST.length} แบบ)</h1>
        </div>
      </div>

      <div className="p-3 space-y-4 max-w-4xl mx-auto">
        {/* Date Filter Card */}
        <div className="bg-white p-4 rounded-xl border border-[var(--grey-border)] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[var(--navy-deep)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--gold-vibrant)]">calendar_month</span>
              ประจำวันที่
            </span>
            <div className="flex bg-gray-50 rounded-lg border border-gray-200 overflow-hidden shadow-inner">
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-transparent text-sm px-3 py-2 outline-none text-[var(--navy-deep)] font-bold cursor-pointer" 
              />
            </div>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LOTTERY_LIST.map((lotteryName, index) => {
            const res = getResultFor(lotteryName);
            const isThai = lotteryName === 'หวยรัฐบาล';

            return (
              <div key={index} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Header */}
                <div className={`px-4 py-2 flex justify-between items-center ${isThai ? 'bg-gradient-to-r from-red-700 to-red-500' : 'bg-gradient-to-r from-[var(--navy-deep)] to-slate-700'}`}>
                  <div className="flex items-center gap-2 text-white">
                    <span className="text-base font-black tracking-wide">{lotteryName}</span>
                  </div>
                  <span className="text-[10px] font-bold text-white bg-black/20 px-2 py-0.5 rounded-full shadow-inner border border-white/10">
                    งวด {filterDate || 'ล่าสุด'}
                  </span>
                </div>

                {/* Body (Results) */}
                <div className="p-3">
                  {!res ? (
                    <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                      <span className="material-symbols-outlined text-4xl mb-2 opacity-20">hourglass_empty</span>
                      <span className="font-bold text-sm">รอผลรางวัล</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Standard row (3 Up, 2 Up, 2 Down) */}
                      <div className="grid grid-cols-3 gap-2 text-center divide-x divide-gray-100 bg-gray-50 rounded-lg p-2 border border-gray-100">
                        <div>
                          <div className="text-[9px] font-bold text-gray-500 mb-1 tracking-wider uppercase">3 ตัวบน</div>
                          <div className="text-2xl font-black text-red-600 drop-shadow-sm">{res.results?.threeUp || 'XXX'}</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold text-gray-500 mb-1 tracking-wider uppercase">2 ตัวบน</div>
                          <div className="text-2xl font-black text-[var(--navy-deep)] drop-shadow-sm">{res.results?.threeUp ? res.results.threeUp.slice(-2) : 'XX'}</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold text-gray-500 mb-1 tracking-wider uppercase">2 ตัวล่าง</div>
                          <div className="text-2xl font-black text-blue-600 drop-shadow-sm">{res.results?.twoDown || 'XX'}</div>
                        </div>
                      </div>

                      {/* Thai Lottery Specific (3 Front, 3 Bottom) */}
                      {isThai && (
                        <div className="grid grid-cols-2 gap-2 text-center border-t border-dashed border-gray-200 pt-3 mt-3">
                          <div className="bg-red-50/50 rounded-lg p-2 border border-red-100">
                            <div className="text-[10px] font-bold text-red-700 mb-1 tracking-wider">3 ตัวหน้า</div>
                            <div className="text-lg font-black text-red-600">{res.results?.threeFront || 'XXX XXX'}</div>
                          </div>
                          <div className="bg-blue-50/50 rounded-lg p-2 border border-blue-100">
                            <div className="text-[10px] font-bold text-blue-700 mb-1 tracking-wider">3 ตัวล่าง</div>
                            <div className="text-lg font-black text-blue-600">{res.results?.threeBack || 'XXX XXX'}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
