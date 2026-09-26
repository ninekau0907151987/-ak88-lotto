import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function Profile() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const currentUserId = localStorage.getItem('userId');
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  useEffect(() => {
    if (!isLoggedIn || !currentUserId) {
      navigate('/login');
      return;
    }

    try {
      const unsubscribe = onSnapshot(doc(db, 'users', currentUserId), (snap) => {
        if (snap.exists()) {
          setUserData(snap.data());
        }
        setLoading(false);
      }, (err) => {
        console.warn('Profile snapshot error:', err);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch {
      setLoading(false);
    }
  }, [currentUserId, isLoggedIn, navigate]);

  const handleLogout = () => {
    if (window.confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userRole');
      localStorage.removeItem('username');
      localStorage.removeItem('userId');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('userData');
      navigate('/login');
    }
  };

  if (!isLoggedIn || !currentUserId) {
    return null;
  }

  const fullName = userData?.name || (userData?.firstName ? `${userData.firstName} ${userData.lastName || ''}`.trim() : userData?.username || 'สมาชิก');
  const regDate = userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : 'สมาชิกทางการ';
  const balance = userData?.balance ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      {/* Top Bar */}
      <div className="bg-[#0a192f] p-3 flex items-center justify-between sticky top-0 z-40 shadow-md border-b border-[#f5c518]/20">
        <button onClick={() => navigate(-1)} className="text-[#f5c518] flex items-center cursor-pointer p-1">
          <span className="material-symbols-outlined text-xl">arrow_back_ios</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#f5c518]">person</span>
          <h1 className="text-white font-bold text-base">โปรไฟล์สมาชิก</h1>
        </div>
        <div className="w-8" />
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Profile Card */}
        <div className="bg-[#0a192f] text-white p-6 rounded-2xl shadow-xl border border-[#f5c518]/30 text-center relative overflow-hidden">
          <div className="w-20 h-20 bg-gradient-to-tr from-[#f5c518] to-yellow-200 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-[#f5c518]/20 border-2 border-white">
            <span className="material-symbols-outlined text-4xl text-[#0a192f] font-bold">account_circle</span>
          </div>
          <h2 className="text-xl font-black text-[#f5c518]">{userData?.username || 'กำลังโหลด...'}</h2>
          <p className="text-xs text-slate-300 mt-0.5">{fullName}</p>
          
          <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">
            <span className="material-symbols-outlined text-sm">verified</span>
            ยืนยันตัวตนแล้ว (บัญชีจริง)
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-700/60 pt-4 text-center">
            <div>
              <div className="text-[11px] text-slate-400">ยอดเงินคงเหลือ</div>
              <div className="text-base font-black text-[#f5c518]">
                ฿{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">สถานะสมาชิก</div>
              <div className="text-base font-bold text-emerald-400">ปกติ</div>
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-100/80 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-[#0a192f] text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#0a192f]">badge</span>
              ข้อมูลส่วนตัว
            </h3>
          </div>
          <div className="p-4 space-y-3.5">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">ชื่อ-นามสกุล</div>
              <div className="text-sm font-bold text-[#0a192f]">{fullName}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">เบอร์โทรศัพท์</div>
              <div className="text-sm font-bold text-[#0a192f] font-mono">{userData?.phoneNumber || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">วันที่ลงทะเบียน</div>
              <div className="text-sm font-bold text-[#0a192f]">{regDate}</div>
            </div>
          </div>
        </div>

        {/* Bank Account Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-100/80 px-4 py-3 border-b border-gray-200">
            <h3 className="font-bold text-[#0a192f] text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#0a192f]">account_balance</span>
              บัญชีธนาคารสำหรับฝาก-ถอนเงิน
            </h3>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center border border-emerald-300 text-emerald-700">
                <span className="material-symbols-outlined text-2xl">account_balance</span>
              </div>
              <div>
                <div className="text-[#0a192f] font-bold text-sm">{userData?.bankName || 'ธนาคารกสิกรไทย'}</div>
                <div className="text-gray-600 font-mono text-sm tracking-wider font-bold">
                  {userData?.bankAccount || 'xxx-x-xxxxx'}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-amber-600 mt-2.5 flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-sm">lock</span>
              ระบบผูกบัญชีถอนเงินตามที่สมัคร เพื่อความปลอดภัยสูงสุดของยอดเงิน
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-white hover:bg-rose-50 border border-rose-300 text-rose-600 font-black rounded-xl py-3.5 text-sm shadow-sm transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
