import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saveSession, loadSession, type StaffSession } from '@/shared/lib/permissions';

export default function AdminLogin() {
  const [username, setUsername] = useState('1234');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // If already logged in as admin, redirect to /admin automatically
  useEffect(() => {
    try {
      const sess = loadSession();
      const auth = localStorage.getItem('adminAuth');
      const role = localStorage.getItem('userRole');
      if (sess || auth === 'true' || role === 'owner' || role === 'admin' || role === 'master') {
        navigate('/admin', { replace: true });
      }
    } catch (e) {
      console.warn('Auto redirect check error:', e);
    }
  }, [navigate]);

  // Execute admin login
  const performLogin = (u: string, p: string) => {
    const cleanUser = u.trim();
    const cleanPass = p.trim();

    if (!cleanUser || !cleanPass) {
      setError('กรุณากรอกรหัสผู้ดูแลและรหัสผ่าน');
      return;
    }

    setLoading(true);
    setError('');

    // Check Master / Owner Admin credentials
    const isMaster = 
      (cleanUser === '1234' && (cleanPass === '123456' || cleanPass === '123456789')) ||
      (cleanUser === 'admin' && (cleanPass === '123456' || cleanPass === 'admin')) ||
      (cleanUser === 'owner' && (cleanPass === '123456' || cleanPass === 'owner'));

    if (isMaster) {
      const uid = cleanUser === '1234' ? 'staff_1234' : (cleanUser === 'owner' ? 'owner' : 'admin');
      const displayName = cleanUser === '1234' 
        ? 'ผู้บริหารระบบ AK88 (Admin 1234)' 
        : (cleanUser === 'owner' ? 'เจ้าของระบบ AK88 (Owner)' : 'ผู้ดูแลระบบหลัก (Admin)');

      const sess: StaffSession = {
        uid,
        username: cleanUser,
        displayName,
        role: 'owner',
        grantedExtra: ['*'] as any,
        revoked: [],
        scopeProjectIds: [],
        loggedInAt: Date.now()
      };

      // Set all authentication flags in localStorage
      localStorage.setItem('adminAuth', 'true');
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userRole', 'owner');
      localStorage.setItem('username', cleanUser);
      localStorage.setItem('userId', uid);
      localStorage.setItem('masterUnlocked', 'true');
      saveSession(sess);

      localStorage.setItem('adminSession', JSON.stringify({
        username: cleanUser,
        displayName,
        role: 'owner',
        permissions: ['*'],
        loginAt: new Date().toISOString()
      }));

      // Background sync staff document without blocking navigation
      import('@/shared/lib/firebase').then(({ db }) => {
        import('firebase/firestore').then(({ doc, setDoc }) => {
          setDoc(doc(db, 'staff', uid), {
            username: cleanUser,
            password: cleanPass,
            displayName,
            role: 'owner',
            status: 'active',
            grantedExtra: ['*'],
            lastLogin: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        }).catch(() => {});
      }).catch(() => {});

      // Navigate immediately to Admin Dashboard
      navigate('/admin', { replace: true });
      return;
    }

    // Try checking Firestore 'staff' table asynchronously
    import('@/shared/lib/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ collection, getDocs, query, where }) => {
        const qStaff = query(collection(db, 'staff'), where('username', '==', cleanUser), where('password', '==', cleanPass));
        getDocs(qStaff).then(snap => {
          if (!snap.empty) {
            const staffDoc = snap.docs[0];
            const data = staffDoc.data();
            if (data.status === 'blocked' || data.status === 'inactive' || data.status === 'suspended') {
              setError('บัญชีพนักงานนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
              setLoading(false);
              return;
            }

            const staffSess: StaffSession = {
              uid: staffDoc.id,
              username: data.username || cleanUser,
              displayName: data.displayName || cleanUser,
              role: (data.role || 'staff') as any,
              grantedExtra: data.grantedExtra || [],
              revoked: data.revoked || [],
              scopeProjectIds: [],
              loggedInAt: Date.now()
            };

            localStorage.setItem('adminAuth', 'true');
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userRole', data.role || 'staff');
            localStorage.setItem('username', data.displayName || cleanUser);
            saveSession(staffSess);

            navigate('/admin', { replace: true });
          } else {
            setError('รหัสผู้ดูแล หรือรหัสผ่านไม่ถูกต้อง (สำหรับผู้บริหารใช้: 1234 / 123456)');
            setLoading(false);
          }
        }).catch(() => {
          setError('รหัสผู้ดูแล หรือรหัสผ่านไม่ถูกต้อง (สำหรับผู้บริหารใช้: 1234 / 123456)');
          setLoading(false);
        });
      }).catch(() => {
        setError('เกิดข้อผิดพลาดในการโหลดระบบ');
        setLoading(false);
      });
    }).catch(() => {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      setLoading(false);
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(username, password);
  };

  const handleQuickLoginMaster = () => {
    setUsername('1234');
    setPassword('123456');
    performLogin('1234', '123456');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060c2b] via-[#08103a] to-[#04081c] flex flex-col items-center justify-center p-4 font-sans text-white select-none">
      
      <div className="w-full max-w-md space-y-5">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#091838] border-2 border-cyan-400 text-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.4)]">
            <span className="material-symbols-outlined text-4xl">admin_panel_settings</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wider flex items-center justify-center gap-2">
            <span>AK88</span>
            <span className="text-amber-400">ADMIN PORTAL</span>
          </h1>
          <p className="text-xs text-slate-300 font-medium">
            ศูนย์ควบคุมระบบหลังบ้าน • ผู้ดูแลระบบและเจ้าของระบบ
          </p>
        </div>

        {/* 1-Click Quick Login Banner for Owner */}
        <div className="border-2 border-amber-400/80 rounded-2xl bg-[#091838]/90 p-3.5 shadow-[0_0_20px_rgba(245,197,24,0.3)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-amber-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-amber-400">key</span>
              สิทธิ์ผู้บริหารสูงสุด (Master Owner)
            </span>
            <span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full shadow">
              เห็นทุกฟังก์ชัน
            </span>
          </div>
          
          <div className="text-[11px] text-slate-300 flex items-center justify-between font-mono bg-[#050f24] p-2 rounded-xl border border-cyan-500/20">
            <span>รหัส: <b className="text-amber-400">1234</b></span>
            <span>รหัสผ่าน: <b className="text-amber-400">123456</b></span>
          </div>

          <button
            type="button"
            onClick={handleQuickLoginMaster}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">login</span>
            <span>เข้าสู่ระบบด่วน 1-Click (1234 / 123456)</span>
          </button>
        </div>

        {/* Regular Login Form Card */}
        <div className="border-2 border-cyan-400 rounded-3xl bg-[#081533]/95 p-6 md:p-7 shadow-[0_0_30px_rgba(6,182,212,0.35)] backdrop-blur-md">
          <form className="space-y-4" onSubmit={handleFormSubmit}>
            <div>
              <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                รหัสบัญชีผู้ดูแล (Username)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400 text-lg">
                  badge
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-[#050f24] rounded-xl py-3 pl-11 pr-4 text-white border border-cyan-500/40 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 text-sm font-bold transition outline-none"
                  placeholder="ระบุรหัสผู้ดูแล (เช่น 1234)"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400 text-lg">
                  lock
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#050f24] rounded-xl py-3 pl-11 pr-4 text-white border border-cyan-500/40 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 text-sm font-bold transition outline-none"
                  placeholder="ระบุรหัสผ่าน (เช่น 123456)"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/70 text-red-300 border border-red-500/50 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-sm">
                <span className="material-symbols-outlined text-base text-red-400">gpp_bad</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-sm shadow-lg shadow-red-600/40 border border-red-400 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              {loading ? (
                <>กำลังเข้าสู่ระบบ...</>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">verified_user</span>
                  <span>เข้าสู่ระบบหลังบ้าน</span>
                </>
              )}
            </button>
          </form>

          {/* Direct link to /admin */}
          <div className="mt-4 pt-3 border-t border-cyan-500/20 text-center">
            <Link
              to="/admin"
              className="text-xs text-cyan-300 hover:text-cyan-200 underline flex items-center justify-center gap-1 font-bold"
            >
              <span>หรือเข้าสู่หน้าจัดการหลังบ้านโดยตรง (/admin)</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Back to Member view */}
        <div className="text-center pt-1">
          <Link to="/" className="text-xs text-slate-400 hover:text-white transition inline-flex items-center gap-1 font-medium">
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            กลับสู่หน้าบ้านสำหรับสมาชิก
          </Link>
        </div>

      </div>

    </div>
  );
}
