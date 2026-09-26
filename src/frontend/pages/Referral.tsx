import { Link, useNavigate } from 'react-router-dom';

export default function Referral() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-[var(--navy-deep)] p-3 flex items-center gap-3 sticky top-[57px] z-40 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white flex items-center">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)]">person_add</span>
          <h1 className="text-white font-bold text-lg">ระบบแนะนำเพื่อน</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-[var(--grey-border)] text-center">
            <div className="text-gray-500 text-xs mb-1">เพื่อนที่แนะนำ</div>
            <div className="text-[var(--navy-deep)] font-black text-2xl">12 <span className="text-sm font-normal">คน</span></div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-[var(--grey-border)] text-center">
            <div className="text-gray-500 text-xs mb-1">รายได้สะสม</div>
            <div className="text-[var(--gold-vibrant)] font-black text-2xl">฿ 1,250</div>
          </div>
        </div>

        {/* Link & QR */}
        <div className="bg-[var(--navy-deep)] p-6 rounded-xl shadow-lg border border-[var(--gold-vibrant)] text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--gold-vibrant)_0%,_transparent_70%)]"></div>
          <h2 className="text-[var(--gold-vibrant)] font-bold mb-4 relative z-10">แชร์ลิงก์รับรายได้ 8%</h2>
          
          <div className="bg-white p-3 rounded-lg inline-block mb-4 relative z-10">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://ak88-lotto.com/ref/user_ak88" alt="Referral QR" className="w-32 h-32" />
          </div>

          <div className="flex bg-white rounded-lg overflow-hidden relative z-10">
            <input 
              type="text" 
              readOnly 
              value="https://ak88-lotto.com/ref/user_ak88" 
              className="w-full px-3 py-2 text-xs text-gray-600 outline-none"
            />
            <button className="bg-[var(--gold-vibrant)] text-[var(--navy-deep)] px-4 font-bold text-sm">
              คัดลอก
            </button>
          </div>
        </div>

        {/* Rules */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-[var(--grey-border)]">
          <h3 className="font-bold text-[var(--navy-deep)] border-b border-gray-100 pb-2 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--gold-vibrant)]">gavel</span>
            กติกาและเงื่อนไข
          </h3>
          <ul className="text-sm text-gray-600 space-y-2 list-disc pl-4">
            <li>รับส่วนแบ่ง <strong className="text-[var(--navy-deep)]">8%</strong> จากยอดแทงของเพื่อนที่สมัครผ่านลิงก์ของคุณ</li>
            <li>รายได้จะถูกคำนวณและอัปเดตเข้ากระเป๋าทุกๆ วันเวลา 00:00 น.</li>
            <li>สามารถถอนรายได้ขั้นต่ำ 100 บาท</li>
            <li>หากพบการทุจริตหรือปั๊มยอด ทางเว็บไซต์ขอสงวนสิทธิ์ในการระงับบัญชีทันที</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
