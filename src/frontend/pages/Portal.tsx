import { Link, useNavigate } from 'react-router-dom';

export default function Portal() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#071326] via-[#0a192f] to-[#040d1a] text-white flex flex-col justify-between p-4 md:p-8 font-sans">
      {/* Top Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-4 border-b border-[#F4C430]/20">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-3xl font-black text-white">AK</span>
          <span className="text-3xl font-black text-[#F4C430]">88</span>
          <span className="text-xs font-bold text-gray-400 border-l border-gray-700 pl-2 ml-1 hidden sm:inline">
            ศูนย์ทางเข้าระบบ (System Portal)
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-xs bg-white/10 hover:bg-white/20 text-white font-bold px-3.5 py-2 rounded-xl transition"
          >
            เข้าสู่ระบบสมาชิก
          </Link>
          <Link
            to="/admin/login"
            className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 font-bold px-3.5 py-2 rounded-xl transition"
          >
            เข้าสู่ระบบแอดมิน
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto my-auto py-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 bg-[#F4C430]/15 text-[#F4C430] border border-[#F4C430]/30 text-xs px-3.5 py-1 rounded-full font-bold mb-3">
            <span className="material-symbols-outlined text-sm font-black">verified</span>
            ระบบจริงเปิดให้บริการ 24 ชั่วโมง (Production Official)
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
            ยินดีต้อนรับสู่ระบบ <span className="text-[#F4C430]">AK88 LOTTO</span>
          </h1>
          <p className="text-gray-300 text-sm sm:text-base leading-relaxed">
            กรุณาเลือกช่องทางการเข้าใช้งานระหว่าง <strong className="text-white">หน้าบ้านสมาชิก</strong> สำหรับผู้เล่นแทงหวย หรือ <strong className="text-[#F4C430]">หลังบ้านเจ้าของระบบ</strong> สำหรับควบคุมรอบหวยและการเงิน
          </p>
        </div>

        {/* 2 Big Cards: Member vs Owner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Card 1: หน้าบ้านสมาชิก */}
          <div className="bg-[#0c1e38]/90 rounded-3xl p-6 sm:p-8 border border-emerald-500/30 shadow-2xl hover:border-emerald-400/60 transition flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition"></div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">storefront</span>
                </div>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">
                  ฝั่งลูกค้า / สมาชิก
                </span>
              </div>
              <h2 className="text-2xl font-black text-white mb-2">1. หน้าบ้านสมาชิก (Member Platform)</h2>
              <p className="text-gray-300 text-xs sm:text-sm mb-6 leading-relaxed">
                ระบบแทงหวยครบวงจรสำหรับลูกค้า รองรับหวยทุกประเภท ยิงเลขยี่กีสด 88 รอบ ตรวจผลรางวัลอัตโนมัติ และระบบฝาก-ถอนเงินออโต้
              </p>

              <div className="space-y-2.5 mb-8">
                <div className="flex items-center gap-2.5 text-xs text-gray-200">
                  <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                  <span><strong>หวยยี่กี 88 รอบ:</strong> ยิงเลข 5 หลัก, ดูรอบสด, คำนวณผลเรียลไทม์</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-gray-200">
                  <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                  <span><strong>หวยรัฐบาล & หวยหุ้น:</strong> 2 ตัว 3 ตัว เลขวิ่ง เลขรูด 19 ประตู</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-gray-200">
                  <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                  <span><strong>เกม 20 ช่อง 6 หลัก:</strong> สุ่มตัวเลข, อัตราจ่ายสูง, มีคู่มือครบ</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-gray-200">
                  <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
                  <span><strong>กระเป๋าเงิน & โพย:</strong> ฝากผ่าน PromptPay QR สลิปออโต้ ถอนเงินเข้าบัญชีจริง</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-4 border-t border-white/10">
              <button
                onClick={() => navigate('/')}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 px-4 rounded-xl text-sm shadow-lg flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <span>เข้าสู่หน้าหลักสมาชิก</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Card 2: หลังบ้านเจ้าของระบบ */}
          <div className="bg-[#0c1e38]/90 rounded-3xl p-6 sm:p-8 border border-amber-500/40 shadow-2xl hover:border-amber-400/80 transition flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition"></div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-[#F4C430] border border-amber-500/40 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
                </div>
                <span className="text-xs bg-amber-500/20 text-[#F4C430] border border-amber-500/40 px-3 py-1 rounded-full font-bold">
                  ฝั่งเจ้าของเว็บ / แอดมิน
                </span>
              </div>
              <h2 className="text-2xl font-black text-white mb-2">2. หลังบ้านเจ้าของระบบ (Backoffice)</h2>
              <p className="text-gray-300 text-xs sm:text-sm mb-6 leading-relaxed">
                ศูนย์บัญชาการระบบหวย ควบคุมผลรางวัล 88 รอบ สรุปกำไร-ขาดทุนของเจ้ามือ ตรวจสอบโพย และจัดการเอเย่นต์
              </p>

              <div className="space-y-2.5 mb-8">
                <div className="flex items-center gap-2.5 text-xs text-gray-200">
                  <span className="material-symbols-outlined text-[#F4C430] text-base">check_circle</span>
                  <span><strong>ศูนย์ควบคุมยี่กี 88 รอบ:</strong> บอทยิงเลขถึง 16, ออกผลออโต้/แมนนวล</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-gray-200">
                  <span className="material-symbols-outlined text-[#F4C430] text-base">check_circle</span>
                  <span><strong>วิเคราะห์กำไรเจ้ามือ:</strong> ยอดแทง ยอดจ่าย รางวัลคนยิง กำไรสุทธิ</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-gray-200">
                  <span className="material-symbols-outlined text-[#F4C430] text-base">check_circle</span>
                  <span><strong>แดชบอร์ดหลัก:</strong> สรุปยอดรายได้ สมาชิก เครือข่ายเอเย่นต์</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-gray-200">
                  <span className="material-symbols-outlined text-[#F4C430] text-base">check_circle</span>
                  <span><strong>ระบบการเงิน:</strong> อนุมัติฝาก-ถอน บันทึกประวัติ และความปลอดภัย</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-4 border-t border-white/10">
              <button
                onClick={() => navigate('/admin/login')}
                className="w-full bg-[#F4C430] hover:bg-amber-400 text-[#0a192f] font-black py-3.5 px-4 rounded-xl text-sm shadow-xl flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <span>เข้าสู่ระบบหลังบ้านผู้ดูแล (Admin Login)</span>
                <span className="material-symbols-outlined text-base font-black">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto py-4 border-t border-white/10 text-center text-xs text-gray-400 font-medium">
        AK88 LOTTO PLATFORM — ระบบแทงหวยออนไลน์และระบบบริหารจัดการครบวงจร
      </footer>
    </div>
  );
}
