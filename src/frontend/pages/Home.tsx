import { Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
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

    const currentUserId = localStorage.getItem('userId');
    const logged = localStorage.getItem('isLoggedIn') === 'true';

    let unsubscribeUser = () => {};
    if (logged && currentUserId) {
      unsubscribeUser = onSnapshot(doc(db, 'users', currentUserId), (snap) => {
        if (snap.exists()) {
          setUserData(snap.data());
        }
      }, (err) => {
        console.warn('Home user stream error:', err);
      });
    }

    return () => {
      unsubscribe();
      unsubscribeUser();
    };
  }, []);

  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true' && !!userData;
  const balance = userData?.balance ?? 0;
  const formattedBalance = balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const getBalanceFontSize = (len: number) => {
    if (len > 14) return 'text-xl sm:text-2xl md:text-3xl';
    if (len > 10) return 'text-2xl sm:text-3xl md:text-4xl';
    if (len > 7) return 'text-3xl sm:text-4xl md:text-5xl';
    return 'text-4xl sm:text-5xl md:text-6xl';
  };

  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const thaiDrawTarget = useMemo(() => {
    const cDay = now.getDate();
    const draws = [1, 16];
    for (const d of draws) {
      if (d === cDay) {
        const target = new Date(now);
        target.setHours(15, 20, 0, 0);
        if (target.getTime() > now.getTime()) return target;
      } else if (d > cDay) {
        const target = new Date(now);
        target.setDate(d);
        target.setHours(15, 20, 0, 0);
        return target;
      }
    }
    return new Date(now.getFullYear(), now.getMonth() + 1, 1, 15, 20, 0, 0);
  }, [now]);

  const thaiCountdownStr = useMemo(() => {
    const diff = thaiDrawTarget.getTime() - now.getTime();
    if (diff <= 0) return '00:00:00';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `${days > 0 ? `${days} วัน ` : ''}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [thaiDrawTarget, now]);


  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      {/* Announcement */}
      <div className="bg-[#0a192f] p-3 border-b border-[#f5c518]/20 shadow-sm">
        <div className="bg-[#051121] border border-[#f5c518] rounded p-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#f5c518]">campaign</span>
          <marquee className="text-sm text-[#f5c518] font-medium">ยินดีต้อนรับสู่ AK88 แทงหวยออนไลน์ ระบบฝาก-ถอนออโต้ ตลอด 24 ชั่วโมง</marquee>
        </div>
      </div>

      <div className="px-3 md:px-6 space-y-4 mt-4 max-w-5xl mx-auto">
        {/* Balance Card / Guest CTA Card */}
        {isLoggedIn ? (
          <div className="bg-[#0a192f] border border-[#f5c518] rounded-2xl p-5 md:p-6 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#f5c518] text-lg">person</span>
                <span className="text-white font-bold text-sm">{userData?.username}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  ออนไลน์
                </span>
              </div>
              <span className="text-[#f5c518] text-xs md:text-sm font-bold">สถานะ : ปกติ</span>
            </div>
            <div className="w-full overflow-hidden flex items-center justify-center my-5 md:my-7 px-2">
              <div 
                className={`text-center text-[#f5c518] font-black tracking-tight max-w-full truncate flex items-baseline justify-center gap-1.5 ${getBalanceFontSize(formattedBalance.length)}`}
                title={`฿ ${formattedBalance}`}
              >
                <span className="text-xl sm:text-2xl md:text-3xl opacity-80 select-none">฿</span>
                <span className="truncate">{formattedBalance}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-[#071326] via-[#0a192f] to-[#071326] border border-[#f5c518]/40 rounded-2xl p-6 md:p-8 shadow-xl text-center">
            <div className="w-14 h-14 bg-[#f5c518]/20 border border-[#f5c518]/50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-[#f5c518]">
              <span className="material-symbols-outlined text-3xl">sports_esports</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">ยินดีต้อนรับสู่ AK88 LOTTO</h2>
            <p className="text-xs md:text-sm text-slate-300 mt-1 mb-5">
              ระบบแทงหวยออนไลน์มาตรฐาน ออกผลไว หวยยี่กี 88 รอบ ฝาก-ถอนรวดเร็ว 24 ชม.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
              <Link
                to="/login"
                className="bg-transparent hover:bg-white/5 border border-[#f5c518] text-[#f5c518] font-black rounded-xl py-3 text-sm transition"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                to="/register"
                className="bg-gradient-to-r from-amber-400 to-[#f5c518] hover:brightness-105 text-[#0a192f] font-black rounded-xl py-3 text-sm shadow-lg shadow-[#f5c518]/20 transition"
              >
                สมัครสมาชิกฟรี
              </Link>
            </div>
          </div>
        )}

        {/* Featured Thai Government Lottery Banner (ตรงตามแบบภาพตัวอย่าง) */}
        <div className="bg-gradient-to-r from-[#170a0e] via-[#2a0e17] to-[#170a0e] border border-rose-500/50 rounded-2xl p-3 md:p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* TH Badge */}
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-red-500 flex items-center justify-center bg-red-950/60 text-red-400 font-black text-sm shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              TH
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="bg-gradient-to-r from-red-600 to-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <span>★</span> หวยเด่น ยอดนิยมอันดับ 1
                </span>
                <span className="text-[#f5c518] text-[11px] font-bold">
                  อัตราจ่ายสูงสุด 900 บาท
                </span>
              </div>
              <h3 className="text-white font-black text-sm md:text-base tracking-wide">
                หวยรัฐบาลไทย (สลากกินแบ่งรัฐบาล)
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Countdown Box */}
            <div className="bg-black/40 border border-red-900/60 rounded-xl px-3 py-1.5 text-center flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500 text-base animate-spin" style={{ animationDuration: '3s' }}>sync</span>
              <div className="text-left">
                <p className="text-[9px] text-red-400 font-bold leading-none">กำลังนับถอยหลัง:</p>
                <p className="text-xs md:text-sm font-black text-red-300 font-mono tracking-tight">{thaiCountdownStr}</p>
              </div>
            </div>

            {/* Bet Button */}
            <Link
              to="/lottery/thai"
              className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:brightness-110 text-white font-black text-xs md:text-sm px-4 md:px-5 py-2.5 rounded-xl shadow-lg shadow-red-600/30 flex items-center gap-1 transition active:scale-95 whitespace-nowrap"
            >
              <span>แทงหวยรัฐบาล</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Main Actions: ศูนย์รวมการเลือกแทงหวย */}
        <div className="w-full">
          <Link 
            to="/lottery" 
            className="w-full bg-[#f5c518] text-[#0a192f] rounded-xl py-6 md:py-8 flex items-center justify-center gap-3 font-black shadow-lg hover:bg-[#e5b600] transition active:scale-[0.99]"
          >
            <span className="material-symbols-outlined text-4xl md:text-5xl">touch_app</span>
            <span className="text-2xl md:text-3xl font-black tracking-wide">แทงหวย</span>
          </Link>
        </div>

        {/* Grid Menu: ทางลัดหมวดหมู่ */}
        <div className="grid grid-cols-4 gap-3 md:gap-4 font-black">
          <Link to="/lottery?tab=thai-foreign" className="relative bg-[#0a192f] border border-[#f5c518]/40 hover:border-[#f5c518] rounded-xl p-4 md:p-5 flex flex-col items-center justify-center text-center shadow-lg transition active:scale-[0.98]">
            <div className="absolute top-1.5 right-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-[#0a192f] text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-sm">
              เด่น
            </div>
            <span className="material-symbols-outlined text-4xl md:text-5xl mb-2 text-[#f5c518] animate-pulse drop-shadow-[0_0_12px_rgba(245,197,24,0.6)]">
              stars
            </span>
            <span className="text-xs md:text-sm font-black text-[#f5c518]">หวยรัฐบาล</span>
          </Link>
          <Link to="/lottery?tab=stock" className="bg-[#0a192f] border border-[#f5c518]/40 rounded-xl p-4 md:p-5 flex flex-col items-center justify-center text-center shadow-lg hover:border-[#f5c518] transition active:scale-[0.98]">
            <span className="material-symbols-outlined text-4xl md:text-5xl mb-2 text-[#f5c518]">show_chart</span>
            <span className="text-xs md:text-sm font-black text-[#f5c518]">หุ้น VIP</span>
          </Link>
          <Link to="/lottery?tab=set" className="bg-[#0a192f] border border-[#f5c518]/40 rounded-xl p-4 md:p-5 flex flex-col items-center justify-center text-center shadow-lg hover:border-[#f5c518] transition active:scale-[0.98]">
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
