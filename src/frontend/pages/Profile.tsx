import { Link, useNavigate } from 'react-router-dom';

/**
 * Profile — หน้าประวัติส่วนตัว (หน้าบ้าน)
 * ----------------------------------------------------------------
 * ทางเข้าหลังบ้าน/มาสเตอร์ ย้ายมาไว้ที่นี่ (สำหรับผู้ดูแล)
 * เพื่อไม่ให้ปนกับ bottom-nav ของลูกค้า
 */
export default function Profile() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-[var(--navy-deep)] p-3 flex items-center gap-3 sticky top-[57px] z-40 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white flex items-center">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)]">person</span>
          <h1 className="text-white font-bold text-lg">ประวัติส่วนตัว</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-[var(--grey-border)] text-center relative">
          <button className="absolute top-4 right-4 text-[var(--navy-deep)] bg-gray-100 p-1.5 rounded-full hover:bg-gray-200 transition">
            <span className="material-symbols-outlined text-sm">edit</span>
          </button>
          <div className="w-20 h-20 bg-[var(--navy-deep)] rounded-full flex items-center justify-center mx-auto mb-3 border-4 border-[var(--gold-vibrant)]">
            <span className="material-symbols-outlined text-5xl text-[var(--gold-vibrant)]">account_circle</span>
          </div>
          <h2 className="text-xl font-black text-[var(--navy-deep)]">User_AK88</h2>
          <p className="text-sm text-gray-500">สมาชิก VIP</p>
          <div className="mt-4 inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            ยืนยันตัวตนแล้ว
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[var(--grey-border)] overflow-hidden">
          <div className="flex justify-between items-center bg-gray-100 px-4 py-3 border-b border-[var(--grey-border)]">
            <h3 className="font-bold text-[var(--navy-deep)] text-sm">ข้อมูลส่วนตัว</h3>
            <button className="text-[var(--gold-vibrant)] text-xs font-bold flex items-center gap-1 bg-[var(--navy-deep)] px-2 py-1 rounded">
              <span className="material-symbols-outlined text-[12px]">edit</span> แก้ไข
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">ชื่อ-นามสกุล</div>
              <div className="text-sm font-bold text-[var(--navy-deep)]">นาย ทดสอบ ระบบ</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">เบอร์โทรศัพท์</div>
              <div className="text-sm font-bold text-[var(--navy-deep)]">081-234-5678</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">วันที่สมัคร</div>
              <div className="text-sm font-bold text-[var(--navy-deep)]">01 เมษายน 2569</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[var(--grey-border)] overflow-hidden">
          <div className="flex justify-between items-center bg-gray-100 px-4 py-3 border-b border-[var(--grey-border)]">
            <h3 className="font-bold text-[var(--navy-deep)] text-sm">ข้อมูลบัญชีธนาคาร</h3>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-3 p-3 border border-[var(--grey-border)] rounded-lg">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center border border-green-200">
                <span className="text-green-600 font-bold text-xs">KBANK</span>
              </div>
              <div>
                <div className="text-[var(--navy-deep)] font-bold text-sm">ธนาคารกสิกรไทย</div>
                <div className="text-gray-500 text-xs">xxx-x-xx123-4</div>
              </div>
            </div>
            <p className="text-[10px] text-red-500 mt-2">* หากต้องการเปลี่ยนบัญชีธนาคาร กรุณาติดต่อแอดมิน</p>
          </div>
        </div>

        {/* ==== ทางเข้าสำหรับผู้ดูแล (ย้ายมาจาก bottom-nav) ==== */}
        <div className="bg-white rounded-xl shadow-sm border border-[var(--grey-border)] overflow-hidden">
          <div className="bg-gray-100 px-4 py-3 border-b border-[var(--grey-border)]">
            <h3 className="font-bold text-[var(--navy-deep)] text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">admin_panel_settings</span>
              ระบบจัดการ (สำหรับผู้ดูแล)
            </h3>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <Link to="/admin" className="flex flex-col items-center justify-center gap-2 py-4 rounded-lg bg-[var(--navy-deep)] text-[var(--gold-vibrant)] font-bold text-sm shadow hover:opacity-90 transition">
              <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
              หลังบ้าน (Admin)
            </Link>
            <Link to="/master" className="flex flex-col items-center justify-center gap-2 py-4 rounded-lg bg-purple-700 text-white font-bold text-sm shadow hover:opacity-90 transition">
              <span className="material-symbols-outlined text-2xl">shield_person</span>
              มาสเตอร์
            </Link>
          </div>
        </div>

        <button
          onClick={() => { localStorage.clear(); navigate('/login'); }}
          className="w-full bg-white border border-red-500 text-red-500 font-bold rounded-lg py-3 text-sm shadow-sm hover:bg-red-50 transition mt-4 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">logout</span>
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
