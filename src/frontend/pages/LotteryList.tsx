import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';

export default function LotteryList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryFilter = searchParams.get('category');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lotteryTypes, setLotteryTypes] = useState<any[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Fetch Lottery Types
    const qLottery = query(collection(db, 'lotteryTypes'));
    const unsubLottery = onSnapshot(qLottery, (snap) => {
      setLotteryTypes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      clearInterval(timer);
      unsubLottery();
    };
  }, []);

  // Helper to format countdown
  const getCountdown = (closeTimeStr: string | null) => {
    if (!closeTimeStr) return 'เปิดรับแทงตลอด';
    const closeTime = new Date(closeTimeStr).getTime();
    const now = currentTime.getTime();
    const diff = closeTime - now;
    
    if (diff <= 0) return 'ปิดรับแทง';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (days > 0) {
      return `${days} วัน ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const renderCard = (
    name: string, 
    path: string, 
    closeTime: string | null, 
    colorClass: string, 
    icon: string = '🇹🇭'
  ) => {
    // Check if globally disabled or doesn't exist in DB
    const lotteryConfig = lotteryTypes.find(l => l.name === name || l.id === name);
    
    // If hidden by admin, do not render
    if (lotteryConfig?.isHidden) return null;

    const isGloballyClosed = lotteryConfig ? lotteryConfig.isOpen === false : false;
    
    const isClosed = isGloballyClosed || (closeTime && new Date(closeTime).getTime() <= currentTime.getTime());
    
    if (isClosed) {
      return (
        <div className="bg-gradient-to-b from-[#b2bec3] to-[#636e72] rounded shadow-md overflow-hidden flex flex-col text-white opacity-90">
          <div className="py-2 text-center text-xl font-medium tracking-wider">
            <span className="material-symbols-outlined text-sm mr-1">schedule</span>
            ปิดชั่วคราว
          </div>
          <div className="bg-black/10 py-2 text-center text-lg font-bold flex items-center justify-center gap-2">
            <span>{icon}</span> {name}
          </div>
          <div className="bg-[#2d3436] py-1 text-center text-xs">
            เปิดแทง 0 รอบ
          </div>
        </div>
      );
    }

    return (
      <Link to={path} className={`${colorClass} rounded shadow-md overflow-hidden flex flex-col text-white hover:scale-[1.02] transition-transform`}>
        <div className="py-2 text-center text-xl font-medium tracking-wider">
          {getCountdown(closeTime)}
        </div>
        <div className="bg-black/10 py-2 text-center text-lg font-bold flex items-center justify-center gap-2">
          <span>{icon}</span> {name}
        </div>
        <div className="bg-black/20 py-1 text-center text-xs">
          {closeTime ? `ปิดรับ ${new Date(closeTime).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')}` : 'เปิดรับแทง 24 ชม.'}
        </div>
      </Link>
    );
  };

  const renderCategoryHeader = (title: string, icon: string = 'H') => (
    <div className="flex items-center gap-2 text-white font-bold text-lg mt-6 mb-3 border-b border-gray-800 pb-2">
      {icon === 'H' ? (
        <div className="w-5 h-5 bg-red-600 text-white flex items-center justify-center text-xs font-black rounded-sm">H</div>
      ) : (
        <span>{icon}</span>
      )}
      {title}
    </div>
  );

  // Mock closing times for demo
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(15, 20, 0);
  
  const todayEvening = new Date();
  todayEvening.setHours(18, 0, 0);

  return (
    <div className="min-h-screen bg-[#111111] pb-24 font-sans">
      {/* Header */}
      <div className="bg-[#1a1a1a] p-3 flex justify-between items-center border-b border-gray-800">
        <h1 className="text-white font-bold text-lg">รายการหวยวันนี้</h1>
        <button 
          onClick={() => navigate('/')}
          className="bg-white text-black px-3 py-1 rounded text-sm font-bold flex items-center gap-1 hover:bg-gray-200"
        >
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          กลับหน้าหลัก
        </button>
      </div>

      <div className="p-3">
        {(!categoryFilter || categoryFilter === 'thai' || categoryFilter === 'foreign') && (
          <>
            {/* หวยรัฐบาล */}
            {renderCategoryHeader('หวยรัฐบาล', '🇹🇭')}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {renderCard('หวยรัฐบาล', '/lottery/thai', tomorrow.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇹🇭')}
            </div>
          </>
        )}

        {(!categoryFilter || categoryFilter === 'thai' || categoryFilter === 'foreign') && (
          <>
            {/* ยี่กี 4D */}
            {renderCategoryHeader('ยี่กี 4D')}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {renderCard('ยี่กี 4D', '/lottery/yeekee', null, 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '⏱️')}
            </div>
          </>
        )}

        {(!categoryFilter || categoryFilter === 'foreign') && (
          <>
            {/* หวยต่างประเทศ */}
            {renderCategoryHeader('หวยต่างประเทศ')}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {renderCard('หวยฮานอย', '/lottery/hanoi', tomorrow.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇻🇳')}
              {renderCard('ฮานอยพิเศษ', '/lottery/hanoi-special', tomorrow.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇻🇳')}
              {renderCard('ฮานอย(VIP)', '/lottery/hanoi-vip', tomorrow.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇻🇳')}
              {renderCard('หวยลาวประตูชัย', '/lottery/lao-pratuchai', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇱🇦')}
              {renderCard('หวยลาวสันติภาพ', '/lottery/lao-santipap', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇱🇦')}
              {renderCard('หวยประชาชนลาว', '/lottery/lao-public', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇱🇦')}
              {renderCard('ลาว(EXTRA)', '/lottery/lao-extra', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇱🇦')}
              
              {renderCard('หวยลาวTV', '/lottery/lao-tv', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇱🇦')}
              {renderCard('ฮานอย(HD)', '/lottery/hanoi-hd', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇻🇳')}
              {renderCard('ฮานอยสตาร์', '/lottery/hanoi-star', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇻🇳')}
              {renderCard('หวยลาวHD', '/lottery/lao-hd', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇱🇦')}

              {renderCard('ฮานอยTV', '/lottery/hanoi-tv', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇻🇳')}
              {renderCard('หวยลาวสตาร์', '/lottery/lao-star', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇱🇦')}
              {renderCard('ฮานอยกาชาด', '/lottery/hanoi-redcross', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇻🇳')}
              {renderCard('ฮานอยสามัคคี', '/lottery/hanoi-samakkhi', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇻🇳')}

              {renderCard('หวยมาเลย์', '/lottery/malay', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇲🇾')}
              {renderCard('หวยลาวสตาร์(VIP)', '/lottery/lao-star-vip', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇱🇦')}
              {renderCard('ฮานอย(EXTRA)', '/lottery/hanoi-extra', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇻🇳')}
              {renderCard('ลาวกาชาด', '/lottery/lao-redcross', todayEvening.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🇱🇦')}
              {renderCard('ดาวน์โจนส์ STAR', '/lottery/dowjones-star', todayEvening.toISOString(), 'bg-gradient-to-b from-[#95a5a6] to-[#7f8c8d]', '🇺🇸')}
            </div>

            {/* หวยธนาคาร */}
            {renderCategoryHeader('หวยธนาคาร')}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {renderCard('หวยธกส.', '/lottery/baac', tomorrow.toISOString(), 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🏦')}
              {renderCard('หวยออมสิน', '/lottery/gsb', null, 'bg-gradient-to-b from-[#2ecc71] to-[#27ae60]', '🏦')}
            </div>
          </>
        )}



        {(!categoryFilter || categoryFilter === 'set') && (
          <>
            {/* หวยชุด */}
            {renderCategoryHeader('หวยชุด')}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {renderCard('หวยรัฐบาล (ชุด)', '/lottery/set/thai', tomorrow.toISOString(), 'bg-gradient-to-b from-[#00b4d8] to-[#0077b6]', '🇹🇭')}
              {renderCard('หวยฮานอยชุด', '/lottery/set/hanoi', todayEvening.toISOString(), 'bg-gradient-to-b from-[#00b4d8] to-[#0077b6]', '🇻🇳')}
              {renderCard('หวยลาวพัฒนาชุด', '/lottery/set/lao', todayEvening.toISOString(), 'bg-gradient-to-b from-[#00b4d8] to-[#0077b6]', '🇱🇦')}
            </div>
          </>
        )}

        {(!categoryFilter || categoryFilter === 'stock') && (
          <>
            {/* หวยหุ้น VIP */}
            {renderCategoryHeader('หวยหุ้น VIP')}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {renderCard('นิเคอิ VIP (เช้า)', '/lottery/stock/nikkei-m', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇯🇵')}
              {renderCard('เวียดนาม VIP (เช้า)', '/lottery/stock/vietnam-m', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇻🇳')}
              {renderCard('จีน VIP (เช้า)', '/lottery/stock/china-m', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇨🇳')}
              {renderCard('ฮั่งเส็ง VIP (เช้า)', '/lottery/stock/hangseng-m', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇭🇰')}
              
              {renderCard('ไต้หวัน VIP', '/lottery/stock/taiwan', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇹🇼')}
              {renderCard('เกาหลี VIP', '/lottery/stock/korea', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇰🇷')}
              {renderCard('นิเคอิ VIP (บ่าย)', '/lottery/stock/nikkei-a', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇯🇵')}
              {renderCard('เวียดนาม VIP (บ่าย)', '/lottery/stock/vietnam-a', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇻🇳')}

              {renderCard('จีน VIP (บ่าย)', '/lottery/stock/china-a', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇨🇳')}
              {renderCard('ฮั่งเส็ง VIP (บ่าย)', '/lottery/stock/hangseng-a', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇭🇰')}
              {renderCard('ลาว VIP', '/lottery/stock/lao-vip', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇱🇦')}
              {renderCard('เวียดนาม VIP (เย็น)', '/lottery/stock/vietnam-e', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇻🇳')}

              {renderCard('สิงคโปร์ VIP', '/lottery/stock/singapore-vip', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇸🇬')}
              {renderCard('อังกฤษ(VIP)', '/lottery/stock/uk-vip', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇬🇧')}
              {renderCard('เยอรมัน(VIP)', '/lottery/stock/germany-vip', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇩🇪')}
              {renderCard('รัสเซีย(VIP)', '/lottery/stock/russia-vip', todayEvening.toISOString(), 'bg-gradient-to-b from-[#ff7675] to-[#d63031]', '🇷🇺')}

              {renderCard('ดาวน์โจนส์(VIP)', '/lottery/stock/dowjones-vip', todayEvening.toISOString(), 'bg-gradient-to-b from-[#95a5a6] to-[#7f8c8d]', '🇺🇸')}
            </div>

        {(!categoryFilter || categoryFilter === 'stock') && (
          <>
            {/* หวยหุ้น */}
            {renderCategoryHeader('หวยหุ้น')}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {renderCard('หุ้นดาวน์โจนส์', '/lottery/stock/dowjones-stock', tomorrow.toISOString(), 'bg-gradient-to-b from-[#95a5a6] to-[#7f8c8d]', '🇺🇸')}
              {renderCard('หุ้นนิเคอิรอบเช้า', '/lottery/stock/nikkei-morning', tomorrow.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇯🇵')}
              {renderCard('ฮั่งเส็งรอบเช้า', '/lottery/stock/hangseng-morning', tomorrow.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇭🇰')}
              {renderCard('ดาวน์โจนส์ TV', '/lottery/stock/dowjones-tv', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇺🇸')}
              {renderCard('จีนรอบเช้า', '/lottery/stock/china-morning', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇨🇳')}

              {renderCard('หุ้นไต้หวัน', '/lottery/stock/taiwan-stock', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇹🇼')}
              {renderCard('หุ้นเกาหลี', '/lottery/stock/korea-stock', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇰🇷')}
              {renderCard('นิเคอิปิดบ่าย', '/lottery/stock/nikkei-afternoon', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇯🇵')}
              {renderCard('จีนปิดรอบบ่าย', '/lottery/stock/china-afternoon', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇨🇳')}

              {renderCard('ฮั่งเส็งปิดบ่าย', '/lottery/stock/hangseng-afternoon', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇭🇰')}
              {renderCard('หุ้นสิงคโปร์', '/lottery/stock/singapore-stock', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇸🇬')}
              {renderCard('หุ้นไทยปิดเย็น', '/lottery/stock/thai-evening', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇹🇭')}
              {renderCard('หุ้นอินเดีย', '/lottery/stock/india-stock', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇮🇳')}

              {renderCard('หุ้นอียิปต์', '/lottery/stock/egypt-stock', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇪🇬')}
              {renderCard('หุ้นรัสเซีย', '/lottery/stock/russia-stock', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇷🇺')}
              {renderCard('หุ้นเยอรมัน', '/lottery/stock/germany-stock', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇩🇪')}
              {renderCard('หุ้นอังกฤษ', '/lottery/stock/uk-stock', todayEvening.toISOString(), 'bg-gradient-to-b from-[#f1c40f] to-[#f39c12]', '🇬🇧')}

              {renderCard('ดาวน์โจนส์ MIDNIGHT', '/lottery/stock/dowjones-midnight', todayEvening.toISOString(), 'bg-gradient-to-b from-[#95a5a6] to-[#7f8c8d]', '🇺🇸')}
              {renderCard('ดาวน์โจนส์ EXTRA', '/lottery/stock/dowjones-extra', todayEvening.toISOString(), 'bg-gradient-to-b from-[#95a5a6] to-[#7f8c8d]', '🇺🇸')}
            </div>
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}
