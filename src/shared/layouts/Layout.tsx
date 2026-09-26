import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';

/**
 * Layout — โครงหน้าบ้าน (ลูกค้า) พร้อมทางเข้าระบบ & สลับโหมดทดสอบ
 * ----------------------------------------------------------------
 * bottom-nav มี 5 ปุ่ม "หน้าบ้านเท่านั้น":
 *   หน้าแรก | แทงหวย | ฝาก-ถอน | โพยหวย | ฉัน
 */
export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string>('user');
  const [username, setUsername] = useState<string>('User_AK88');
  const [showDemoBar, setShowDemoBar] = useState(true);

  // ตรวจสอบสถานะการล็อกอิน
  useEffect(() => {
    const logged = localStorage.getItem('isLoggedIn') === 'true';
    const role = localStorage.getItem('userRole') || 'user';
    const uname = localStorage.getItem('username') || (role === 'admin' ? 'Owner_AK88' : 'User_AK88');

    setIsLoggedIn(logged);
    setUserRole(role);
    setUsername(uname);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    localStorage.removeItem('currentUser');
    setIsLoggedIn(false);
    navigate('/login');
  };

  const navItem = (path: string, icon: string, label: string, active: boolean) => (
    <Link to={path} className={`flex flex-col items-center gap-1 ${active ? 'text-[#f5c518]' : 'text-[#f5c518]/40'} hover:text-[#f5c518] transition`}>
      <span className="material-symbols-outlined">{icon}</span>
      <span className="text-[10px] font-bold">{label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      {/* Header */}
      <header className="bg-[#0a192f] border-b border-[#f5c518]/20 px-3 md:px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-md">
        {/* Logo and Quick Portal */}
        <div className="flex items-center gap-2 md:gap-3">
          <Link to="/tickets" className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/5 transition text-[#f5c518]">
            <span className="material-symbols-outlined text-xl">history</span>
          </Link>
          <Link to="/" className="flex items-center gap-1">
            <span className="text-2xl font-bold text-white tracking-wider">AK</span>
            <span className="text-2xl font-black text-[#f5c518] drop-shadow">88</span>
          </Link>
          <Link
            to="/portal"
            className="hidden sm:inline-flex items-center gap-1 bg-[#f5c518]/15 hover:bg-[#f5c518]/25 text-[#f5c518] text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#f5c518]/30 transition"
          >
            <span className="material-symbols-outlined text-xs">dashboard_customize</span>
            ทางเข้าระบบ
          </Link>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Quick link to Backoffice for Admin/Owner */}
          {(userRole === 'admin' || userRole === 'master') && (
            <Link
              to="/admin/yeekee"
              className="flex items-center gap-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-[#0a192f] font-black text-xs px-2.5 py-1.5 rounded-lg shadow hover:brightness-105 transition"
            >
              <span className="material-symbols-outlined text-sm font-black">timer</span>
              <span className="hidden xs:inline">หลังบ้าน</span>ยี่กี 88 รอบ
            </Link>
          )}

          {isLoggedIn ? (
            /* Logged In State */
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="flex items-center gap-2 bg-[#f5c518]/10 hover:bg-[#f5c518]/20 px-2.5 py-1 rounded-lg transition border border-[#f5c518]/30"
              >
                <div className="w-7 h-7 rounded-full bg-[#f5c518]/20 flex items-center justify-center text-[#f5c518]">
                  <span className="material-symbols-outlined text-base">person</span>
                </div>
                <div className="text-left text-[11px] leading-tight">
                  <div className="text-white font-bold truncate max-w-[90px]">{username}</div>
                  <div className="text-[#f5c518] text-[9px] font-medium">
                    {userRole === 'admin' ? '👑 เจ้าของระบบ' : userRole === 'master' ? '🛡️ มาสเตอร์' : 'สมาชิก VIP'}
                  </div>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                title="ออกจากระบบ"
                className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 flex items-center justify-center transition"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
              </button>
            </div>
          ) : (
            /* Guest / Not Logged In State */
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-xs bg-[#f5c518]/10 hover:bg-[#f5c518]/25 text-[#f5c518] border border-[#f5c518]/40 font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">login</span>
                เข้าสู่ระบบ
              </Link>
              <Link
                to="/register"
                className="text-xs bg-[#f5c518] hover:bg-amber-400 text-[#0a192f] font-black px-3 py-1.5 rounded-lg shadow transition hidden xs:inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">how_to_reg</span>
                สมัครสมาชิก
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <Outlet />

      {/* Floating Demo Testing Switcher (แถบสลับโหมดทดสอบด่วน) */}
      {showDemoBar && (
        <div className="fixed bottom-16 right-3 md:right-6 z-40 bg-[#071326]/95 backdrop-blur-md border border-[#f5c518]/40 text-white rounded-2xl shadow-2xl p-2 px-3 flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-[#f5c518] font-black pr-1 border-r border-white/20">
            <span className="material-symbols-outlined text-sm">sports_esports</span>
            <span className="hidden sm:inline">โหมดทดสอบ</span>
          </div>

          <Link
            to="/"
            className={`px-2 py-1 rounded font-bold transition flex items-center gap-1 ${
              location.pathname === '/' ? 'bg-[#f5c518] text-[#0a192f]' : 'text-gray-300 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-xs">home</span>
            <span>หน้าบ้าน</span>
          </Link>

          <Link
            to="/admin/yeekee"
            className={`px-2 py-1 rounded font-bold transition flex items-center gap-1 ${
              location.pathname === '/admin/yeekee' ? 'bg-[#f5c518] text-[#0a192f]' : 'text-[#f5c518] hover:brightness-125'
            }`}
          >
            <span className="material-symbols-outlined text-xs font-black">timer</span>
            <span>หลังบ้านยี่กี</span>
          </Link>

          <Link
            to="/portal"
            className="text-gray-300 hover:text-white px-1.5 py-1 rounded font-medium transition"
            title="หน้าต่างทางเข้ารวม"
          >
            ทางเข้า Portal
          </Link>

          <button
            onClick={() => setShowDemoBar(false)}
            className="text-gray-400 hover:text-gray-200 ml-1"
            title="ซ่อนแถบ"
          >
            <span className="material-symbols-outlined text-xs">close</span>
          </button>
        </div>
      )}

      {/* Bottom Navigation — หน้าบ้านเท่านั้น (5 ปุ่ม) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a192f] border-t border-[#f5c518]/20 flex justify-around items-center py-2 px-1 z-50 pb-safe shadow-lg">
        {navItem('/', 'home', 'หน้าแรก', location.pathname === '/')}
        {navItem('/lottery', 'confirmation_number', 'แทงหวย', location.pathname.startsWith('/lottery'))}
        {navItem('/deposit', 'account_balance_wallet', 'ฝาก-ถอน', location.pathname === '/deposit' || location.pathname === '/withdraw')}
        {navItem('/tickets', 'receipt_long', 'โพยหวย', location.pathname === '/tickets')}
        {navItem('/profile', 'person', 'ฉัน', location.pathname === '/profile')}
      </nav>
    </div>
  );
}
