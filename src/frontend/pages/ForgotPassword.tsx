import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-[var(--gold-vibrant)] shadow-sm">
            <span className="material-symbols-outlined text-4xl text-[var(--gold-vibrant)]">lock_reset</span>
          </div>
          <h2 className="text-2xl font-bold text-[var(--navy-deep)]">ลืมรหัสผ่าน</h2>
          <p className="text-[var(--navy-deep)] font-medium text-sm mt-2">กรุณากรอกเบอร์โทรศัพท์หรือยูสเซอร์เนมที่ใช้สมัคร<br/>เพื่อทำการรีเซ็ตรหัสผ่านใหม่</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className="text-[var(--navy-deep)] text-sm font-bold mb-1 block">เบอร์โทรศัพท์ / ยูสเซอร์เนม</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">badge</span>
              <input type="text" className="w-full bg-white border border-[var(--grey-border)] rounded-lg py-3 pl-10 pr-4 text-[var(--navy-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]" placeholder="กรอกข้อมูลของท่าน" />
            </div>
          </div>

          <button type="button" className="w-full block text-center bg-[var(--gold-vibrant)] text-[var(--navy-deep)] font-black rounded-lg py-3 text-lg shadow-lg transform transition active:scale-95">
            ขอรหัสผ่านใหม่
          </button>
        </form>

        <div className="text-center mt-6">
          <Link to="/login" className="text-[var(--navy-deep)] text-sm flex items-center justify-center gap-1 hover:underline font-bold">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
