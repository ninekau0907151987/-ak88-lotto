import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const loginInput = identifier.trim();
    const passInput = password.trim();

    if (!loginInput || !passInput) {
      setError('กรุณากรอกชื่อผู้ใช้/เบอร์โทรศัพท์ และรหัสผ่าน');
      return;
    }

    setLoading(true);

    try {
      // 1) ตรวจสอบสิทธิ์เจ้าของระบบ / แอดมิน (Admin / Owner Backoffice)
      if ((loginInput === 'admin' || loginInput === 'owner' || loginInput === '1234') && (passInput === '1234' || passInput === 'admin' || passInput === 'admin1234')) {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('adminAuth', 'true');
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('username', 'Admin_AK88');
        localStorage.setItem('currentUser', JSON.stringify({
          username: 'Admin_AK88',
          role: 'admin',
          name: 'เจ้าของระบบ AK88',
          loginAt: new Date().toISOString()
        }));
        navigate('/admin/yeekee');
        return;
      }

      // 2) ตรวจสอบฐานข้อมูล Firestore สำหรับสมาชิก (Members) และเอเย่นต์ (Agents)
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const { db } = await import('@/shared/lib/firebase');

      // ตรวจสอบในตารางเอเย่นต์ / แอดมิน
      const qAgent = query(collection(db, 'agents'), where('username', '==', loginInput), where('password', '==', passInput));
      const agentSnapshot = await getDocs(qAgent);
      if (!agentSnapshot.empty) {
        const agentDoc = agentSnapshot.docs[0];
        const agentData = agentDoc.data();
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('adminAuth', 'true');
        localStorage.setItem('userRole', 'agent');
        localStorage.setItem('agentId', agentDoc.id);
        localStorage.setItem('username', agentData.name || loginInput);
        navigate('/admin');
        return;
      }

      // ตรวจสอบในตารางสมาชิก (users) ด้วย Username
      let qUser = query(collection(db, 'users'), where('username', '==', loginInput), where('password', '==', passInput));
      let userSnapshot = await getDocs(qUser);

      // ถ้าไม่พบ ลองค้นหาด้วยเบอร์โทรศัพท์ (phoneNumber)
      if (userSnapshot.empty) {
        qUser = query(collection(db, 'users'), where('phoneNumber', '==', loginInput), where('password', '==', passInput));
        userSnapshot = await getDocs(qUser);
      }

      if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();

        if (userData.status === 'suspended' || userData.status === 'banned') {
          setError('บัญชีของท่านถูกระงับการใช้งานชั่วคราว กรุณาติดต่อฝ่ายบริการลูกค้า');
          return;
        }

        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', 'user');
        localStorage.setItem('userId', userDoc.id);
        localStorage.setItem('username', userData.username || loginInput);
        localStorage.setItem('currentUser', JSON.stringify({
          userId: userDoc.id,
          username: userData.username,
          name: userData.firstName ? `${userData.firstName} ${userData.lastName || ''}` : userData.username,
          phone: userData.phoneNumber,
          balance: userData.balance ?? 0,
          role: 'user',
          loginAt: new Date().toISOString()
        }));

        navigate('/');
        return;
      }

      // หากไม่ตรงกับบัญชีใดในระบบ แสดงข้อผิดพลาดจริง
      setError('ชื่อผู้ใช้งาน เบอร์โทรศัพท์ หรือรหัสผ่านไม่ถูกต้อง');
    } catch (err) {
      console.error('Login error:', err);
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#071326] via-[#0a192f] to-[#040d1a] flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 mb-2 hover:opacity-95 transition">
            <span className="text-5xl font-black text-white tracking-wider">AK</span>
            <span className="text-5xl font-black text-[#F4C430] drop-shadow-[0_0_20px_rgba(244,196,48,0.4)]">88</span>
          </Link>
          <h1 className="text-2xl font-black text-white tracking-wide">เข้าสู่ระบบ</h1>
          <p className="text-gray-400 text-xs mt-1">ยินดีต้อนรับสู่ระบบแทงหวยออนไลน์ AK88</p>
        </div>

        {/* Real Login Form Card */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl border border-gray-100">
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="text-gray-700 text-xs font-bold mb-1.5 block">
                เบอร์โทรศัพท์ หรือ ชื่อผู้ใช้งาน
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                  account_circle
                </span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-gray-50 rounded-xl py-3 pl-11 pr-4 text-gray-900 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F4C430] text-sm"
                  placeholder="กรอกเบอร์โทรศัพท์ หรือ ยูสเซอร์เนม"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-700 text-xs font-bold mb-1.5 block">
                รหัสผ่าน
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                  lock
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-gray-50 rounded-xl py-3 pl-11 pr-11 text-gray-900 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F4C430] text-sm"
                  placeholder="กรอกรหัสผ่าน"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-200 text-center flex items-center justify-center gap-1.5 animate-shake">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-[#F4C430] focus:ring-[#F4C430]"
                />
                <span>จดจำการเข้าสู่ระบบ</span>
              </label>
              <Link to="/forgot-password" className="text-amber-600 hover:underline font-bold">
                ลืมรหัสผ่าน?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-400 via-[#F4C430] to-amber-500 text-[#0a192f] font-black rounded-xl py-3.5 text-base shadow-lg hover:brightness-105 active:scale-95 transition transform disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>กำลังเข้าสู่ระบบ...</>
              ) : (
                <>
                  <span>เข้าสู่ระบบ</span>
                  <span className="material-symbols-outlined text-base font-bold">login</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center space-y-3">
            <p className="text-xs text-gray-600">
              ยังไม่มีบัญชีผู้ใช้งาน?{' '}
              <Link to="/register" className="text-amber-600 font-bold hover:underline text-sm ml-1">
                สมัครสมาชิกใหม่
              </Link>
            </p>
          </div>
        </div>

        {/* Back to Home link */}
        <div className="text-center">
          <Link
            to="/"
            className="text-xs text-gray-400 hover:text-white transition inline-flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">home</span>
            กลับสู่หน้าหลัก
          </Link>
        </div>
      </div>
    </div>
  );
}
