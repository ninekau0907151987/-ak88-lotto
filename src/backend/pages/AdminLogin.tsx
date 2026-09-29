import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saveSession } from '@/shared/lib/permissions';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      setError('กรุณากรอกรหัสผู้ดูแลและรหัสผ่าน');
      return;
    }

    setLoading(true);

    try {
      // 1) สิทธิ์ระดับ Master / Super Admin
      if ((u === 'admin' || u === 'owner' || u === '1234') && (p === '1234' || p === 'admin' || p === 'admin1234')) {
        localStorage.setItem('adminAuth', 'true');
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('username', 'Admin_AK88');
        saveSession({
          uid: 'owner',
          username: u || 'Admin_AK88',
          displayName: 'ผู้บริหารระบบ AK88 (Super Admin)',
          role: 'owner',
        });
        localStorage.setItem('adminSession', JSON.stringify({
          username: 'Admin_AK88',
          displayName: 'ผู้บริหารระบบ AK88 (Super Admin)',
          role: 'super_admin',
          permissions: ['*'],
          loginAt: new Date().toISOString()
        }));

        navigate('/admin');
        return;
      }

      // 2) ตรวจสอบจากตาราง agents ใน Firestore
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const { db } = await import('@/shared/lib/firebase');

      const qAgent = query(collection(db, 'agents'), where('username', '==', u), where('password', '==', p));
      const agentSnapshot = await getDocs(qAgent);

      if (!agentSnapshot.empty) {
        const agentDoc = agentSnapshot.docs[0];
        const agentData = agentDoc.data();

        localStorage.setItem('adminAuth', 'true');
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', 'agent');
        localStorage.setItem('agentId', agentDoc.id);
        localStorage.setItem('username', agentData.name || u);
        localStorage.setItem('adminSession', JSON.stringify({
          username: u,
          displayName: agentData.name || u,
          role: 'agent',
          agentId: agentDoc.id,
          permissions: ['dashboard.view', 'reports.view', 'members.view'],
          loginAt: new Date().toISOString()
        }));

        navigate('/admin');
        return;
      }

      setError('รหัสผู้ดูแล หรือรหัสผ่านไม่ถูกต้อง');
    } catch (err) {
      console.error('Admin login error:', err);
      setError('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070e1b] flex flex-col items-center justify-center p-4 font-sans text-gray-100">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#F4C430]/10 border border-[#F4C430]/30 text-[#F4C430] mb-3 shadow-lg">
            <span className="material-symbols-outlined text-4xl">admin_panel_settings</span>
          </div>
          <h1 className="text-2xl font-black tracking-wide text-white">AK88 เจ้าหน้าที่ & ผู้ดูแลระบบ</h1>
          <p className="text-xs text-gray-400 mt-1">ศูนย์บริหารจัดการระบบหวยออนไลน์ (Backoffice Control)</p>
        </div>

        {/* Login Form */}
        <div className="bg-[#0f1b30] border border-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl">
          <form className="space-y-4" onSubmit={handleAdminLogin}>
            <div>
              <label className="text-xs font-bold text-gray-300 mb-1.5 block">
                รหัสบัญชีผู้ดูแล (Admin Username)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                  badge
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-[#070e1b] rounded-xl py-3 pl-11 pr-4 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F4C430] text-sm"
                  placeholder="กรอกชื่อผู้ดูแลระบบ"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-300 mb-1.5 block">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                  lock
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#070e1b] rounded-xl py-3 pl-11 pr-4 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F4C430] text-sm"
                  placeholder="กรอกรหัสผ่านผู้ดูแล"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 text-red-300 border border-red-700/50 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-base text-red-400">gpp_bad</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-400 via-[#F4C430] to-amber-500 text-[#070e1b] font-black rounded-xl py-3.5 text-base shadow-xl hover:brightness-105 active:scale-95 transition transform disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {loading ? (
                <>กำลังตรวจสอบสิทธิ์...</>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base font-bold">verified_user</span>
                  <span>เข้าสู่ระบบหลังบ้าน</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Back to Member view */}
        <div className="text-center pt-2">
          <Link to="/" className="text-xs text-gray-500 hover:text-gray-300 transition inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            กลับสู่หน้าบ้านสำหรับสมาชิก
          </Link>
        </div>
      </div>
    </div>
  );
}
