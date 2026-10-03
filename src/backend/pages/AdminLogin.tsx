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
      // 1) สิทธิ์ระดับ Master / Super Admin (Default credentials)
      if (
        (u === 'admin' || u === 'owner' || u === '1234') && 
        (p === '1234' || p === 'admin' || p === 'admin1234' || p === '0614284727' || p === 'Password@123')
      ) {
        localStorage.setItem('adminAuth', 'true');
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', u === 'owner' ? 'owner' : 'admin');
        localStorage.setItem('username', u === 'owner' ? 'Owner_AK88' : 'Admin_AK88');
        saveSession({
          uid: u === 'owner' ? 'owner' : 'admin',
          username: u,
          displayName: u === 'owner' ? 'เจ้าของระบบ AK88 (Super Admin)' : 'ผู้ดูแลระบบหลัก (Admin)',
          role: u === 'owner' ? 'owner' : 'admin',
        });
        localStorage.setItem('adminSession', JSON.stringify({
          username: u,
          displayName: u === 'owner' ? 'เจ้าของระบบ AK88 (Super Admin)' : 'ผู้ดูแลระบบหลัก (Admin)',
          role: u === 'owner' ? 'owner' : 'admin',
          permissions: ['*'],
          loginAt: new Date().toISOString()
        }));

        navigate('/admin');
        return;
      }

      // 2) ตรวจสอบจากตาราง staff ใน Supabase Database
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const { db } = await import('@/shared/lib/firebase');

      try {
        const qStaff = query(collection(db, 'staff'), where('username', '==', u), where('password', '==', p));
        const staffSnapshot = await getDocs(qStaff);

        if (!staffSnapshot.empty) {
          const staffDoc = staffSnapshot.docs[0];
          const staffData = staffDoc.data();
          if (staffData.status === 'blocked' || staffData.status === 'inactive') {
            setError('บัญชีพนักงานนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
            return;
          }
          localStorage.setItem('adminAuth', 'true');
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userRole', staffData.role || 'staff');
          localStorage.setItem('username', staffData.displayName || staffData.username || u);
          saveSession({
            uid: staffDoc.id,
            username: staffData.username || u,
            displayName: staffData.displayName || u,
            role: staffData.role || 'staff',
          });
          localStorage.setItem('adminSession', JSON.stringify({
            username: staffData.username || u,
            displayName: staffData.displayName || u,
            role: staffData.role || 'staff',
            staffId: staffDoc.id,
            permissions: staffData.role === 'owner' || staffData.role === 'master' ? ['*'] : (staffData.grantedExtra || []),
            loginAt: new Date().toISOString()
          }));

          navigate('/admin');
          return;
        }
      } catch (staffErr) {
        console.warn('Staff table check failed:', staffErr);
      }

      // 3) ตรวจสอบจากตาราง agents
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
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-blue-100 text-blue-700 mb-3 shadow-[0_4px_16px_-2px_rgba(30,58,138,0.12),0_2px_4px_-1px_rgba(59,130,246,0.06)]">
            <span className="material-symbols-outlined text-4xl">admin_panel_settings</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">AK88 เจ้าหน้าที่ & ผู้ดูแลระบบ</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">ศูนย์บริหารจัดการระบบหวยออนไลน์ (Backoffice Control)</p>
        </div>

        {/* Login Form - White Formal Card with Blue Shadow & 3D Lift */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-7 md:p-8 shadow-[0_1px_0_rgba(255,255,255,1)_inset,0_10px_25px_-5px_rgba(30,58,138,0.08),0_8px_10px_-6px_rgba(30,58,138,0.04)]">
          <form className="space-y-4" onSubmit={handleAdminLogin}>
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                รหัสบัญชีผู้ดูแล (Admin Username)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  badge
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-slate-50/80 rounded-xl py-3 pl-11 pr-4 text-slate-800 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm transition"
                  placeholder="กรอกชื่อผู้ดูแลระบบ (เช่น admin)"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  lock
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-50/80 rounded-xl py-3 pl-11 pr-4 text-slate-800 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm transition"
                  placeholder="กรอกรหัสผ่านผู้ดูแล (เช่น 1234)"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-sm">
                <span className="material-symbols-outlined text-base text-red-500">gpp_bad</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white font-bold rounded-xl py-3.5 text-base shadow-[0_4px_14px_0_rgba(37,99,235,0.35)] hover:shadow-[0_6px_20px_0_rgba(37,99,235,0.45)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-4"
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
          <Link to="/" className="text-xs text-slate-500 hover:text-blue-600 transition inline-flex items-center gap-1 font-medium">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            กลับสู่หน้าบ้านสำหรับสมาชิก
          </Link>
        </div>
      </div>
    </div>
  );
}
