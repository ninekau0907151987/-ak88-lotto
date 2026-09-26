import { Link, useNavigate } from 'react-router-dom';

export default function FinancialReport() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-[var(--navy-deep)] p-3 flex items-center gap-3 sticky top-[57px] z-40 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white flex items-center">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)]">bar_chart</span>
          <h1 className="text-white font-bold text-lg">รายงานการเงิน</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-[var(--grey-border)] text-center">
            <div className="text-gray-500 text-xs mb-1">ยอดแทงทั้งหมด</div>
            <div className="text-[var(--navy-deep)] font-black text-xl">฿ 5,400.00</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-[var(--grey-border)] text-center">
            <div className="text-gray-500 text-xs mb-1">ยอดชนะทั้งหมด</div>
            <div className="text-green-600 font-black text-xl">฿ 8,250.00</div>
          </div>
        </div>

        <div className="bg-[var(--navy-deep)] p-4 rounded-xl shadow-lg border border-[var(--gold-vibrant)] text-center">
          <div className="text-[var(--gold-vibrant)] text-sm mb-1 font-bold">ผลกำไร/ขาดทุน สุทธิ</div>
          <div className="text-white font-black text-3xl">+ ฿ 2,850.00</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[var(--grey-border)] overflow-hidden">
          <div className="bg-gray-100 px-4 py-2 border-b border-[var(--grey-border)] font-bold text-[var(--navy-deep)] text-sm">
            สรุปรายเดือน (เมษายน 2569)
          </div>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <span className="text-gray-600 text-sm">ยอดฝากรวม</span>
              <span className="text-[var(--navy-deep)] font-bold">฿ 10,000.00</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <span className="text-gray-600 text-sm">ยอดถอนรวม</span>
              <span className="text-[var(--navy-deep)] font-bold">฿ 4,500.00</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <span className="text-gray-600 text-sm">โบนัสที่ได้รับ</span>
              <span className="text-[var(--navy-deep)] font-bold">฿ 500.00</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">แนะนำเพื่อน</span>
              <span className="text-[var(--navy-deep)] font-bold">฿ 150.00</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
