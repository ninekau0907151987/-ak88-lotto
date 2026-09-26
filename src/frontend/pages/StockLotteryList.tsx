import { Link, useNavigate } from 'react-router-dom';

export default function StockLotteryList() {
  const navigate = useNavigate();
  // ข้อมูลจำลองสำหรับหวยหุ้น (มีทั้งเปิดรับและปิดรับ)
  const stocks = [
    { id: 'nikkei-m', name: 'หุ้นนิเคอิ (เช้า)', flag: '🇯🇵', closeTime: '09:20 น.', isOpen: true },
    { id: 'nikkei-a', name: 'หุ้นนิเคอิ (บ่าย)', flag: '🇯🇵', closeTime: '12:50 น.', isOpen: false },
    { id: 'hsi-m', name: 'หุ้นฮั่งเส็ง (เช้า)', flag: '🇭🇰', closeTime: '10:50 น.', isOpen: true },
    { id: 'hsi-a', name: 'หุ้นฮั่งเส็ง (บ่าย)', flag: '🇭🇰', closeTime: '14:50 น.', isOpen: true },
    { id: 'china-m', name: 'หุ้นจีน (เช้า)', flag: '🇨🇳', closeTime: '10:20 น.', isOpen: false },
    { id: 'china-a', name: 'หุ้นจีน (บ่าย)', flag: '🇨🇳', closeTime: '13:50 น.', isOpen: true },
    { id: 'taiwan', name: 'หุ้นไต้หวัน', flag: '🇹🇼', closeTime: '12:20 น.', isOpen: true },
    { id: 'korea', name: 'หุ้นเกาหลี', flag: '🇰🇷', closeTime: '12:50 น.', isOpen: false },
    { id: 'singapore', name: 'หุ้นสิงคโปร์', flag: '🇸🇬', closeTime: '15:50 น.', isOpen: true },
    { id: 'india', name: 'หุ้นอินเดีย', flag: '🇮🇳', closeTime: '16:40 น.', isOpen: true },
    { id: 'russia', name: 'หุ้นรัสเซีย', flag: '🇷🇺', closeTime: '22:30 น.', isOpen: false },
    { id: 'egypt', name: 'หุ้นอียิปต์', flag: '🇪🇬', closeTime: '18:50 น.', isOpen: true },
    { id: 'germany', name: 'หุ้นเยอรมัน', flag: '🇩🇪', closeTime: '22:20 น.', isOpen: false },
    { id: 'england', name: 'หุ้นอังกฤษ', flag: '🇬🇧', closeTime: '22:20 น.', isOpen: true },
    { id: 'dowjones', name: 'หุ้นดาวโจนส์', flag: '🇺🇸', closeTime: '03:00 น.', isOpen: true },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-grey-light)]">
      {/* Header */}
      <div className="bg-[var(--navy-deep)] p-3 flex items-center gap-3 sticky top-[57px] z-40 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white flex items-center">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)]">trending_up</span>
          <h1 className="text-white font-bold text-lg">หวยหุ้นต่างประเทศ</h1>
        </div>
      </div>

      {/* Content Grid */}
      <div className="p-3">
        <div className="mb-3 bg-white p-2 rounded border border-[var(--grey-border)] flex items-center gap-2 text-sm text-[var(--navy-deep)]">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)]">info</span>
          <span>เลือกหวยหุ้นที่คุณต้องการเดิมพันด้านล่าง</span>
        </div>

        {/* กรอบสี่เหลี่ยมคู่ (Grid 2 Columns) */}
        <div className="grid grid-cols-2 gap-3">
          {stocks.map((stock) => {
            if (stock.isOpen) {
              // สถานะ: กำลังเปิดรับ (สีสดใส)
              return (
                <Link 
                  key={stock.id} 
                  to={`/lottery/${stock.id}`}
                  className="border-2 border-[var(--gold-vibrant)] bg-white rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-md relative overflow-hidden transform transition active:scale-95"
                >
                  <div className="absolute top-0 right-0 bg-[var(--gold-vibrant)] text-[var(--navy-deep)] text-[9px] px-2 py-1 rounded-bl-lg font-bold shadow-sm">
                    เปิดรับแทง
                  </div>
                  <div className="text-4xl mb-2 drop-shadow-sm">{stock.flag}</div>
                  <div className="font-bold text-[var(--navy-deep)] text-sm mb-1">{stock.name}</div>
                  <div className="text-[10px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                    ปิดรับ {stock.closeTime}
                  </div>
                </Link>
              );
            } else {
              // สถานะ: ปิดรับ (สีเทาๆ)
              return (
                <div 
                  key={stock.id} 
                  className="border-2 border-gray-300 bg-gray-100 rounded-xl p-4 flex flex-col items-center justify-center text-center opacity-60 grayscale relative"
                >
                  <div className="absolute top-0 right-0 bg-gray-500 text-white text-[9px] px-2 py-1 rounded-bl-lg font-bold">
                    ปิดรับแทง
                  </div>
                  <div className="text-4xl mb-2">{stock.flag}</div>
                  <div className="font-bold text-gray-700 text-sm mb-1">{stock.name}</div>
                  <div className="text-[10px] text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                    ปิดรับ {stock.closeTime}
                  </div>
                </div>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}
