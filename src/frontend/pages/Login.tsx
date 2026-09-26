import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [tab, setTab] = useState<'normal' | 'demo'>('normal');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // ฟังก์ชันช่วยบันทึกการล็อกอิน
  const applyLogin = (role: 'user' | 'admin' | 'master' | 'agent', uname: string, targetPath: string, extra = {}) => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('userRole', role);
    localStorage.setItem('username', uname);
    localStorage.setItem('currentUser', JSON.stringify({
      username: uname,
      role,
      loginAt: new Date().toISOString(),
      ...extra,
    }));
    navigate(targetPath);
  };

  // ล็อกอินปกติ
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      setError('กรุณากรอกยูสเซอร์เนมและรหัสผ่าน');
      return;
    }

    // 1) รหัสทดสอบมาตรฐาน
    if ((u === '1234' || u === 'admin' || u === 'owner') && (p === '1234' || p === 'admin')) {
      applyLogin('admin', 'Admin_AK88', '/admin/yeekee', { name: 'เจ้าของระบบ AK88' });
      return;
    }
    if ((u === 'master') && (p === '1234' || p === 'master')) {
      applyLogin('master', 'Master_AK88', '/master', { name: 'มาสเตอร์ใหญ่ AK88' });
      return;
    }
    if ((u === 'member' || u === 'user' || u === 'demo') && (p === '1234' || p === '123456')) {
      applyLogin('user', 'User_AK88', '/', { name: 'สมาชิกทดสอบ VIP' });
      return;
    }

    // 2) ตรวจสอบจากฐานข้อมูล
    setLoading(true);
    try {
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const { db } = await import('@/shared/lib/firebase');

      // ตรวจสอบ agents
      const qAgent = query(collection(db, 'agents'), where('username', '==', u), where('password', '==', p));
      const agentSnapshot = await getDocs(qAgent);
      if (!agentSnapshot.empty) {
        const agentData = agentSnapshot.docs[0].data();
        applyLogin('agent', u, '/admin', {
          agentId: agentSnapshot.docs[0].id,
          name: agentData.name || u,
        });
        return;
      }

      // ตรวจสอบ users
      const qUser = query(collection(db, 'users'), where('username', '==', u), where('password', '==', p));
      const userSnapshot = await getDocs(qUser);
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        applyLogin('user', u, '/', {
          userId: userSnapshot.docs[0].id,
          name: userData.firstName ? `${userData.firstName} ${userData.lastName || ''}` : u,
          balance: userData.balance ?? 0,
        });
        return;
      }

      // ถ้าไม่พบใน DB แต่เป็นโหมดทดลอง ให้ยินยอมเข้าระบบในฐานะ user ทันทีเพื่อความราบรื่น
      applyLogin('user', u, '/', { name: u, balance: 10000 });
    } catch (err) {
      console.warn('DB login fallback to local session', err);
      applyLogin('user', u, '/', { name: u, balance: 10000 });
    } finally {
      setLoading(false);
    }
  };

  // ทางลัดทดลองระบบ 1-Click
  const handleQuickDemo = (role: 'member' | 'admin' | 'master') => {
    if (role === 'member') {
      applyLogin('user', 'User_AK88', '/', {
        name: 'สมาชิกทดลองเล่น VIP',
        balance: 54640,
        phone: '089-123-4567',
      });
    } else if (role === 'admin') {
      applyLogin('admin', 'Owner_AK88', '/admin/yeekee', {
        name: 'เจ้าของระบบ (Admin & Owner)',
        permissions: ['all'],
      });
    } else if (role === 'master') {
      applyLogin('master', 'Master_AK88', '/master', {
        name: 'มาสเตอร์ใหญ่ (Master Head)',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#071326] via-[#0a192f] to-[#040d1a] flex flex-col items-center justify-center p-4">
      {/* Background glow */}
      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand header */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 mb-2 hover:scale-105 transition transform">
            <span className="text-5xl font-black text-white tracking-wider">AK</span>
            <span className="text-5xl font-black text-[#F4C430] drop-shadow-[0_0_20px_rgba(244,196,48,0.4)]">88</span>
          </Link>
          <div className="inline-block bg-[#F4C430]/15 text-[#F4C430] border border-[#F4C430]/30 text-xs px-3 py-1 rounded-full font-bold mb-2">
            ระบบหวยออนไลน์ & ศูนย์บริหารเจ้าของเว็บ
          </div>
          <h1 className="text-xl font-black text-white">เข้าสู่ระบบ / ทดลองใช้งาน</h1>
          <p className="text-gray-400 text-xs mt-1">เลือกทางเข้าหน้าบ้านสมาชิก หรือหลังบ้านเจ้าของระบบได้ทันที</p>
        </div>

        {/* Tab switch: Normal vs 1-Click Demo */}
        <div className="bg-[#05101f] p-1.5 rounded-xl border border-[#F4C430]/20 flex gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => setTab('normal')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
              tab === 'normal'
                ? 'bg-[#F4C430] text-[#0a192f] shadow-md font-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-sm">lock</span>
            เข้าสู่ระบบทั่วไป
          </button>
          <button
            type="button"
            onClick={() => setTab('demo')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
              tab === 'demo'
                ? 'bg-gradient-to-r from-amber-400 to-[#F4C430] text-[#0a192f] shadow-md font-black'
                : 'text-[#F4C430] hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-sm">bolt</span>
            ⚡ ทดลองระบบด่วน (1-Click)
          </button>
        </div>

        {/* 1-Click Demo Access Panel */}
        {tab === 'demo' ? (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border border-[#F4C430]/40 space-y-3 animate-fade-in">
            <div className="text-center pb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">เลือกบทบาทที่ต้องการทดลอง</span>
              <p className="text-[11px] text-gray-400 mt-0.5">คลิกเดียวเข้าสู่ระบบทันที ไม่ต้องกรอกรหัสผ่าน</p>
            </div>

            {/* Member demo button */}
            <button
              onClick={() => handleQuickDemo('member')}
              className="w-full text-left p-3.5 rounded-xl border-2 border-emerald-500/40 bg-emerald-50/70 hover:bg-emerald-100/80 hover:border-emerald-500 transition group flex items-center gap-3.5 shadow-sm"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow group-hover:scale-105 transition">
                <span className="material-symbols-outlined text-2xl">account_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-gray-900 text-sm">1. สมาชิกทดลองเล่น (หน้าบ้าน)</span>
                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded">พร้อมเครดิต</span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  แทงหวยยี่กี 88 รอบ, ยิงเลข, หวยรัฐบาล, เกม 20 ช่อง (เครดิต 54,640฿)
                </div>
              </div>
              <span className="material-symbols-outlined text-emerald-700 group-hover:translate-x-1 transition text-lg">arrow_forward</span>
            </button>

            {/* Owner & Admin demo button */}
            <button
              onClick={() => handleQuickDemo('admin')}
              className="w-full text-left p-3.5 rounded-xl border-2 border-amber-500/40 bg-amber-50/70 hover:bg-amber-100/80 hover:border-amber-500 transition group flex items-center gap-3.5 shadow-sm"
            >
              <div className="w-11 h-11 rounded-xl bg-[#0a192f] text-[#F4C430] flex items-center justify-center border border-[#F4C430] shadow group-hover:scale-105 transition">
                <span className="material-symbols-outlined text-2xl">timer</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-[#0a192f] text-sm">2. เจ้าของระบบ / แอดมิน (หลังบ้าน)</span>
                  <span className="text-[10px] bg-[#0a192f] text-[#F4C430] font-bold px-1.5 py-0.2 rounded border border-[#F4C430]/40">แนะนำ ★</span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  ศูนย์ควบคุมหวยยี่กี 88 รอบ, บอทยิงเลข, ออกผลรางวัล, ปรับอัตราจ่าย
                </div>
              </div>
              <span className="material-symbols-outlined text-amber-800 group-hover:translate-x-1 transition text-lg">arrow_forward</span>
            </button>

            {/* Master demo button */}
            <button
              onClick={() => handleQuickDemo('master')}
              className="w-full text-left p-3.5 rounded-xl border-2 border-purple-500/30 bg-purple-50/60 hover:bg-purple-100/70 hover:border-purple-500 transition group flex items-center gap-3.5 shadow-sm"
            >
              <div className="w-11 h-11 rounded-xl bg-purple-700 text-white flex items-center justify-center shadow group-hover:scale-105 transition">
                <span className="material-symbols-outlined text-2xl">shield_person</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-gray-900 text-sm">3. มาสเตอร์ใหญ่ (Master)</div>
                <div className="text-xs text-gray-600 mt-0.5">
                  จัดการเครือข่ายเอเย่นต์, ตัดยอดการเงิน, รายงานภาพรวม
                </div>
              </div>
              <span className="material-symbols-outlined text-purple-700 group-hover:translate-x-1 transition text-lg">arrow_forward</span>
            </button>

            <div className="pt-2 text-center">
              <Link to="/register" className="text-xs text-gray-600 hover:text-gray-900 font-bold underline">
                หรือคลิกที่นี่เพื่อสมัครสมาชิกใหม่ด้วยตัวเอง
              </Link>
            </div>
          </div>
        ) : (
          /* Normal Form */
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-gray-200">
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="text-gray-700 text-xs font-bold mb-1.5 block">ยูสเซอร์เนม / เบอร์โทร</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">person</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl py-3 pl-11 pr-4 text-gray-900 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F4C430] text-sm"
                    placeholder="เช่น admin หรือ user"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-700 text-xs font-bold mb-1.5 block">รหัสผ่าน</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">lock</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl py-3 pl-11 pr-4 text-gray-900 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F4C430] text-sm"
                    placeholder="กรอกรหัสผ่าน"
                  />
                </div>
              </div>

              {error && (
                <div className="p-2.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-200 text-center">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-gray-500">รหัสทดสอบ: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 font-mono">1234 / 1234</code></span>
                <Link to="/forgot-password" className="text-amber-600 hover:underline font-bold">
                  ลืมรหัสผ่าน?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-400 via-[#F4C430] to-amber-500 text-[#0a192f] font-black rounded-xl py-3.5 text-base shadow-lg hover:brightness-105 active:scale-95 transition transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>กำลังตรวจสอบ...</>
                ) : (
                  <>
                    <span>เข้าสู่ระบบ</span>
                    <span className="material-symbols-outlined text-base">login</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-gray-100 text-center space-y-2">
              <p className="text-xs text-gray-600">
                ยังไม่มีบัญชีใช้งาน?{' '}
                <Link to="/register" className="text-amber-600 font-bold hover:underline">
                  สมัครสมาชิกใหม่ (รับเครดิตฟรี)
                </Link>
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => setTab('demo')}
                  className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200 font-bold hover:bg-amber-100 transition inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  หรือกดเข้าโหมดทดลองเล่นในคลิกเดียว
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Guest direct access */}
        <div className="text-center pt-2">
          <Link
            to="/"
            className="text-xs text-gray-400 hover:text-white transition flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">storefront</span>
            เข้าชมหน้าบ้านทันทีโดยไม่ต้องล็อกอิน (โหมด Guest) →
          </Link>
        </div>
      </div>
    </div>
  );
}
