import { Outlet, Link, useLocation } from 'react-router-dom';

/**
 * Layout — โครงหน้าบ้าน (ลูกค้า)
 * ----------------------------------------------------------------
 * bottom-nav มี 5 ปุ่ม "หน้าบ้านเท่านั้น":
 *   หน้าแรก | แทงหวย | ฝาก-ถอน | โพยหวย | ฉัน
 *
 * ❌ ไม่มีปุ่ม หลังบ้าน / มาสเตอร์ ที่นี่ (ย้ายไปอยู่ในหน้า Profile)
 *    เพื่อกันปัญหา "กดหลังบ้านแล้วไปโผล่หน้าเล่นหวย"
 */
export default function Layout() {
  const location = useLocation();

  const navItem = (path: string, icon: string, label: string, active: boolean) => (
    <Link to={path} className={`flex flex-col items-center gap-1 ${active ? 'text-[#f5c518]' : 'text-[#f5c518]/40'}`}>
      <span className="material-symbols-outlined">{icon}</span>
      <span className="text-[10px] font-bold">{label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-16 font-sans">
      {/* Header */}
      <header className="bg-[#0a192f] border-b border-[#f5c518]/20 px-4 py-2 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link to="/tickets" className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/5 transition">
            <span className="material-symbols-outlined text-[#f5c518]">history</span>
          </Link>
          <Link to="/" className="flex items-center gap-1">
            <span className="text-2xl font-bold text-white">AK</span>
            <span className="text-2xl font-black text-[#f5c518]">88</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/profile" className="material-symbols-outlined text-[#f5c518]">notifications</Link>
          <Link to="/login" className="flex items-center gap-2 bg-[#f5c518]/10 px-2 py-1 rounded hover:bg-[#f5c518]/20 transition border border-[#f5c518]/30">
            <div className="w-8 h-8 rounded-full bg-[#f5c518]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-sm text-[#f5c518]">person</span>
            </div>
            <div className="text-[10px] leading-tight">
              <div className="text-white/80">เข้าสู่ระบบ</div>
              <div className="text-[#f5c518] font-bold">คลิกที่นี่</div>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <Outlet />

      {/* Bottom Navigation — หน้าบ้านเท่านั้น (5 ปุ่ม) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0a192f] border-t border-[#f5c518]/20 flex justify-around items-center py-2 px-1 z-50 pb-safe">
        {navItem('/', 'home', 'หน้าแรก', location.pathname === '/')}
        {navItem('/lottery', 'confirmation_number', 'แทงหวย', location.pathname.startsWith('/lottery'))}
        {navItem('/deposit', 'account_balance_wallet', 'ฝาก-ถอน', location.pathname === '/deposit' || location.pathname === '/withdraw')}
        {navItem('/tickets', 'receipt_long', 'โพยหวย', location.pathname === '/tickets')}
        {navItem('/profile', 'person', 'ฉัน', location.pathname === '/profile')}
      </nav>
    </div>
  );
}
