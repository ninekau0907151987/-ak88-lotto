import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import SitePopupModal from '@/frontend/components/SitePopupModal';
import OnboardingTour from '@/frontend/components/OnboardingTour';

/**
 * Layout — โครงสร้างหน้าบ้านหลักสำหรับลูกค้า (Production Real System)
 * ----------------------------------------------------------------
 * bottom-nav 5 ปุ่มมาตรฐาน:
 *   หน้าแรก | แทงหวย | ฝาก-ถอน | โพยหวย | ฉัน
 */
export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [balance, setBalance] = useState<number>(0);
  const [userId, setUserId] = useState<string>('');

  // ตรวจสอบสถานะการล็อกอินและซิงค์ยอดเงินจริงจาก Firestore
  useEffect(() => {
    const logged = localStorage.getItem('isLoggedIn') === 'true';
    const uid = logged ? (localStorage.getItem('userId') || '') : '';
    const uname = logged ? (localStorage.getItem('username') || '') : '';

    setIsLoggedIn(logged && !!uid);
    setUserId(uid);
    setUsername(uname);

    // ซิงค์ยอดเงินคงเหลือแบบ Realtime
    if (logged && uid) {
      try {
        const unsubscribe = onSnapshot(doc(db, 'users', uid), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setBalance(data.balance ?? 0);
          }
        }, (err) => {
          console.warn('Realtime balance listener warning:', err);
        });
        return () => unsubscribe();
      } catch (e) {
        console.warn('Firestore user stream error:', e);
      }
    }
  }, [location.pathname]);

  const [systemSettings, setSystemSettings] = useState<{ systemOpen?: boolean; maintenanceMessage?: string }>({
    systemOpen: true,
    maintenanceMessage: ''
  });

  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setSystemSettings({
            systemOpen: d.systemOpen !== false,
            maintenanceMessage: d.maintenanceMessage || ''
          });
        }
      });
      return () => unsub();
    } catch (e) {
      console.warn('System settings listener error:', e);
    }
  }, []);

  const handleLogout = () => {
    if (confirm('ต้องการออกจากระบบใช่หรือไม่?')) {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userRole');
      localStorage.removeItem('username');
      localStorage.removeItem('userId');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('userData');
      setIsLoggedIn(false);
      navigate('/login');
    }
  };

  const navItem = (path: string, icon: string, label: string, active: boolean) => (
    <Link
      to={path}
      className={`flex flex-col items-center gap-1 ${
        active ? 'text-[#f5c518]' : 'text-[#f5c518]/50'
      } hover:text-[#f5c518] transition`}
    >
      <span className="material-symbols-outlined text-2xl">{icon}</span>
      <span className="text-[10px] font-bold">{label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {/* Header Bar */}
      <header className="bg-[#0a192f] border-b border-[#f5c518]/20 px-3 md:px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-md">
        {/* Logo & Quick Links */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/tickets" className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/5 transition text-[#f5c518]" title="ประวัติโพยหวย">
            <span className="material-symbols-outlined text-xl">history</span>
          </Link>
          <Link to="/" className="flex items-center gap-1">
            <span className="text-2xl font-bold text-white tracking-wider">AK</span>
            <span className="text-2xl font-black text-[#f5c518] drop-shadow">88</span>
          </Link>

          {/* Quick Guide & Rules buttons */}
          <div className="hidden sm:flex items-center gap-1.5 ml-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-ak88-tour'))}
              className="flex items-center gap-1 bg-[#f5c518]/10 hover:bg-[#f5c518]/20 text-[#f5c518] border border-[#f5c518]/30 px-2.5 py-1 rounded-xl text-xs font-bold transition"
              title="แนะนำฟังก์ชันการใช้งาน 5 ขั้นตอน"
            >
              <span className="material-symbols-outlined text-sm">explore</span>
              <span>แนะนำระบบ</span>
            </button>
            <Link
              to="/rules"
              className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 px-2.5 py-1 rounded-xl text-xs font-bold transition"
              title="กติกาและวิธีการเล่น"
            >
              <span className="material-symbols-outlined text-sm">gavel</span>
              <span>กติกา</span>
            </Link>
          </div>
        </div>

        {/* User Balance & Actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {isLoggedIn ? (
            /* สมาชิกที่ล็อกอินแล้ว */
            <div className="flex items-center gap-2">
              {/* กระเป๋าเงินคงเหลือ */}
              <Link
                to="/deposit"
                className="flex items-center gap-1.5 bg-[#051121] border border-[#f5c518]/40 hover:border-[#f5c518] px-2.5 py-1.5 rounded-xl transition"
                title="คลิกเพื่อฝากเงิน"
              >
                <span className="material-symbols-outlined text-[#f5c518] text-sm">account_balance_wallet</span>
                <span className="text-white text-xs font-black tracking-tight">
                  ฿{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="w-4 h-4 rounded-full bg-[#f5c518] text-[#0a192f] text-[10px] font-black flex items-center justify-center">
                  +
                </span>
              </Link>

              {/* โปรไฟล์สมาชิก */}
              <Link
                to="/profile"
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-2 py-1 rounded-xl transition border border-white/10"
                title="ดูข้อมูลส่วนตัว"
              >
                <div className="w-7 h-7 rounded-full bg-[#f5c518]/20 text-[#f5c518] flex items-center justify-center font-bold text-xs">
                  <span className="material-symbols-outlined text-sm">person</span>
                </div>
                <span className="text-white text-xs font-bold truncate max-w-[80px] hidden xs:inline">
                  {username || 'สมาชิก'}
                </span>
              </Link>

              {/* ปุ่มออกจากระบบ */}
              <button
                onClick={handleLogout}
                title="ออกจากระบบ"
                className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center transition"
              >
                <span className="material-symbols-outlined text-base">logout</span>
              </button>
            </div>
          ) : (
            /* ผู้เข้าชมทั่วไป ยังไม่ได้ล็อกอิน */
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-xs bg-[#f5c518]/10 hover:bg-[#f5c518]/20 text-[#f5c518] border border-[#f5c518]/30 font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">login</span>
                เข้าสู่ระบบ
              </Link>
              <Link
                to="/register"
                className="text-xs bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 text-[#0a192f] font-black px-3.5 py-1.5 rounded-xl shadow transition hidden xs:inline-flex items-center gap-1 hover:brightness-105"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                สมัครสมาชิก
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Maintenance Mode Banner */}
      {systemSettings.systemOpen === false && (
        <div className="bg-red-600 text-white text-xs font-black px-4 py-3 text-center flex items-center justify-center gap-2 shadow-md sticky top-[57px] z-40 animate-pulse">
          <span className="material-symbols-outlined text-base">warning</span>
          <span>{systemSettings.maintenanceMessage || 'ระบบกำลังปิดปรับปรุงชั่วคราวเพื่อพัฒนาการให้บริการ ขออภัยในความไม่สะดวก'}</span>
        </div>
      )}

      {/* Main Content */}
      <Outlet />

      {/* Bottom Navigation — หน้าบ้านมาตรฐาน (5 ปุ่ม) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a192f] border-t border-[#f5c518]/20 flex justify-around items-center py-2 px-1 z-50 pb-safe shadow-xl">
        {navItem('/', 'home', 'หน้าแรก', location.pathname === '/')}
        {navItem('/lottery', 'confirmation_number', 'แทงหวย', location.pathname.startsWith('/lottery'))}
        {navItem('/deposit', 'account_balance_wallet', 'ฝาก-ถอน', location.pathname === '/deposit' || location.pathname === '/withdraw')}
        {navItem('/tickets', 'receipt_long', 'โพยหวย', location.pathname === '/tickets')}
        {navItem('/profile', 'person', 'ฉัน', location.pathname === '/profile')}
      </nav>

      {/* ป๊อปอัพประกาศ & ยินดีต้อนรับสมาชิกใหม่ เชื่อมโยงหลังบ้าน */}
      <SitePopupModal />

      {/* ระบบไกด์แนะนำเว็บ 5 ฟังก์ชันหลัก สำหรับผู้ใช้งาน */}
      <OnboardingTour />
    </div>
  );
}
