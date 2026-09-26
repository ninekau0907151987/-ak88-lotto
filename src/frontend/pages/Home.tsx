import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { db } from '@/shared/lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';

export default function Home() {
  const [lotterySettings, setLotterySettings] = useState<any>({});
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'lotteryTypes'), (snapshot) => {
      const types: any = {};
      snapshot.docs.forEach(doc => types[doc.id] = doc.data());
      setLotterySettings(types);
    });

    const currentUserId = localStorage.getItem('userId') || 'demo_user';
    const unsubscribeUser = onSnapshot(doc(db, 'users', currentUserId), (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
    });

    return () => {
      unsubscribe();
      unsubscribeUser();
    };
  }, []);

  const isVisible = (type: string) => {
    return !lotterySettings[type]?.isHidden;
  };

  const balance = userData?.balance ?? 0;
  const formattedBalance = balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  // Choose proportional font size so large amounts (e.g. 1,000,000+ Baht) never exceed card/form borders
  const getBalanceFontSize = (len: number) => {
    if (len > 15) return 'text-xl sm:text-2xl md:text-4xl';
    if (len > 12) return 'text-2xl sm:text-3xl md:text-5xl';
    if (len > 9) return 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl';
    if (len > 7) return 'text-4xl sm:text-5xl md:text-6xl';
    return 'text-5xl sm:text-6xl md:text-7xl';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      {/* Announcement */}
      <div className="bg-[#0a192f] p-3 border-b border-[#f5c518]/20 shadow-sm">
        <div className="bg-[#051121] border border-[#f5c518] rounded p-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#f5c518]">campaign</span>
          <marquee className="text-sm text-[#f5c518] font-medium">ยินดีต้อนรับสู่ AK88 แทงหวยออนไลน์ ฝาก-ถอน ตลอด 24 ชั่วโมง!!!</marquee>
        </div>
      </div>

      <div className="px-3 md:px-6 space-y-4 mt-4 max-w-5xl mx-auto">
        {/* Balance Card */}
        <div className="bg-[#0a192f] border border-[#f5c518] rounded-xl p-5 md:p-6 shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <div className="relative flex items-center bg-[#0a192f] border border-[#f5c518]/50 rounded px-3 py-1.5 cursor-pointer hover:bg-[#f5c518]/10 transition">
              <select 
                className="appearance-none bg-transparent text-[#f5c518] font-bold text-sm outline-none cursor-pointer pr-6 w-full"
                value={userData?.username || 'User_AK88'}
                onChange={(e) => {
                  // TODO: Implement actual sub-account switching logic
                  console.log('Switching to account:', e.target.value);
                  alert(`ระบบกำลังสลับไปยังบัญชี: ${e.target.value}\n(ฟังก์ชันนี้กำลังอยู่ระหว่างการพัฒนา)`);
                }}
              >
                <option value={userData?.username || 'User_AK88'} className="text-black">
                  {userData?.username || 'User_AK88'} (หลัก)
                </option>
                {userData?.subAccounts?.map((acc: any, index: number) => (
                  <option key={acc.id || index} value={acc.username} className="text-black">
                    {acc.username} (รอง)
                  </option>
                ))}
                {(!userData?.subAccounts || userData.subAccounts.length === 0) && (
                  <option value="add_new" className="text-black italic" disabled>
                    + เพิ่มบัญชีรอง (ติดต่อแอดมิน)
                  </option>
                )}
              </select>
              <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[#f5c518] text-base pointer-events-none">arrow_drop_down</span>
            </div>
            <span className="text-[#f5c518] text-sm md:text-base font-bold">สถานะ : ปกติ</span>
          </div>
          <div className="w-full overflow-hidden flex items-center justify-center my-6 md:my-8 px-2">
            <div 
              className={`text-center text-[#f5c518] font-normal tracking-tight max-w-full truncate flex items-baseline justify-center gap-1.5 ${getBalanceFontSize(formattedBalance.length)}`}
              title={`฿ ${formattedBalance}`}
            >
              <span className="text-xl sm:text-2xl md:text-3xl opacity-80 select-none">฿</span>
              <span className="truncate">{formattedBalance}</span>
            </div>
          </div>
        </div>

        {/* Main Actions */}
        <div className="w-full">
          <Link 
            to="/lottery" 
            className="w-full bg-[#f5c518] text-[#0a192f] rounded-xl py-6 md:py-8 flex items-center justify-center gap-3 font-black shadow-lg hover:bg-[#e5b600] transition active:scale-[0.99]"
          >
            <span className="material-symbols-outlined text-4xl md:text-5xl">touch_app</span>
            <span className="text-2xl md:text-3xl font-black tracking-wide">แทงหวย</span>
          </Link>
        </div>

        {/* Grid Menu */}
        <div className="grid grid-cols-4 gap-3 md:gap-4 font-black">
          <Link to="/lottery/thai" className="bg-[#0a192f] border border-[#f5c518]/40 rounded-xl p-4 md:p-5 flex flex-col items-center justify-center text-center shadow-lg hover:border-[#f5c518] transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-4xl md:text-5xl mb-2 text-[#f5c518]">account_balance_wallet</span>
            <span className="text-xs md:text-sm font-black text-[#f5c518]">หวยรัฐบาล</span>
          </Link>
          <Link to="/lottery/stock" className="bg-[#0a192f] border border-[#f5c518]/40 rounded-xl p-4 md:p-5 flex flex-col items-center justify-center text-center shadow-lg hover:border-[#f5c518] transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-4xl md:text-5xl mb-2 text-[#f5c518]">show_chart</span>
            <span className="text-xs md:text-sm font-black text-[#f5c518]">หุ้น VIP</span>
          </Link>
          <Link to="/lottery/set" className="bg-[#0a192f] border border-[#f5c518]/40 rounded-xl p-4 md:p-5 flex flex-col items-center justify-center text-center shadow-lg hover:border-[#f5c518] transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-4xl md:text-5xl mb-2 text-[#f5c518]">grid_view</span>
            <span className="text-xs md:text-sm font-black text-[#f5c518]">หวยชุด</span>
          </Link>
          <Link to="/results" className="bg-[#0a192f] border border-[#f5c518]/40 rounded-xl p-4 md:p-5 flex flex-col items-center justify-center text-center shadow-lg hover:border-[#f5c518] transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-4xl md:text-5xl mb-2 text-[#f5c518]">emoji_events</span>
            <span className="text-xs md:text-sm font-black text-[#f5c518]">ผลรางวัล</span>
          </Link>
          
          <Link to="/tickets" className="bg-[#0a192f] border border-[#f5c518]/40 rounded-xl p-4 md:p-5 flex flex-col items-center justify-center text-center shadow-lg hover:border-[#f5c518] transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-4xl md:text-5xl mb-2 text-[#f5c518]">receipt_long</span>
            <span className="text-xs md:text-sm font-black text-[#f5c518]">โพยหวย</span>
          </Link>
          <Link to="/number-set" className="bg-[#0a192f] border border-[#f5c518]/40 rounded-xl p-4 md:p-5 flex flex-col items-center justify-center text-center shadow-lg hover:border-[#f5c518] transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-4xl md:text-5xl mb-2 text-[#f5c518]">123</span>
            <span className="text-xs md:text-sm font-bold text-[#f5c518]">สร้างเลขชุด</span>
          </Link>
          <Link to="/referral" className="bg-[#0a192f] border border-[#f5c518]/40 rounded-xl p-4 md:p-5 flex flex-col items-center justify-center text-center shadow-lg hover:border-[#f5c518] transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-4xl md:text-5xl mb-2 text-[#f5c518]">person_add</span>
            <span className="text-xs md:text-sm font-bold text-[#f5c518]">ระบบแนะนำ</span>
          </Link>
          <Link to="/contact" className="bg-[#0a192f] border border-[#f5c518]/40 rounded-xl p-4 md:p-5 flex flex-col items-center justify-center text-center shadow-lg hover:border-[#f5c518] transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-4xl md:text-5xl mb-2 text-[#f5c518]">mail</span>
            <span className="text-xs md:text-sm font-bold text-[#f5c518]">สอบถาม</span>
          </Link>
        </div>

        {/* Financial Actions */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 mt-2">
          <Link to="/deposit" className="bg-[#f5c518] text-[#0a192f] rounded-xl py-4 flex items-center justify-center gap-2 font-black text-base md:text-lg shadow-lg hover:bg-[#e5b600] transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-2xl md:text-3xl">qr_code_scanner</span>
            เติมเงินผ่าน QR
          </Link>
          <Link to="/withdraw" className="bg-[#0a192f] border-2 border-[#f5c518] text-[#f5c518] rounded-xl py-4 flex items-center justify-center gap-2 font-black text-base md:text-lg shadow-lg hover:bg-[#f5c518]/10 transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-2xl md:text-3xl">attach_money</span>
            ถอนเงิน
          </Link>
        </div>

        {/* Report Actions */}
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <Link to="/history" className="bg-[#0a192f] border border-[#f5c518]/50 text-[#f5c518] rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold shadow-lg hover:bg-[#f5c518]/10 transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-xl">swap_vert</span>
            <span className="text-sm md:text-base">รายการฝาก-ถอน</span>
          </Link>
          <Link to="/financial-report" className="bg-[#0a192f] border border-[#f5c518]/50 text-[#f5c518] rounded-xl py-3.5 flex items-center justify-center gap-2 font-bold shadow-lg hover:bg-[#f5c518]/10 transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-xl">bar_chart</span>
            <span className="text-sm md:text-base">รายงานการเงิน</span>
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-400 text-[10px] mt-8 pb-4 opacity-80">
          <div className="flex items-center justify-center gap-1 mb-1 font-bold">
            SECURE WEBSITE <span className="material-symbols-outlined text-xs text-[#f5c518]">workspace_premium</span> GUARANTEE 100%
          </div>
          <div className="font-medium">Copyright © 2024-2026 All Rights Reserved. www.ak88-lotto.com</div>
        </div>
      </div>
    </div>
  );
}
