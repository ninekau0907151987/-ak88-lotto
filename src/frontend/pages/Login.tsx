import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Test Credentials Logic (Master/Admin)
    if (username === '1234' && password === '1234') {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userRole', 'admin');
      alert('เข้าสู่ระบบสำเร็จ (โหมดทดสอบ Master/Admin)');
      navigate('/');
      return;
    }

    if (username && password) {
      try {
        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const { db } = await import('@/shared/lib/firebase');
        
        // Check if matching agent
        const qAgent = query(collection(db, 'agents'), where('username', '==', username), where('password', '==', password));
        const agentSnapshot = await getDocs(qAgent);

        if (!agentSnapshot.empty) {
          const agentData = agentSnapshot.docs[0].data();
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userRole', 'agent');
          localStorage.setItem('agentId', agentSnapshot.docs[0].id);
          localStorage.setItem('agentName', agentData.name || username);
          alert(`เข้าสู่ระบบเอเย่นต์: ${agentData.name || username}`);
          navigate('/admin'); // redirect agent to admin dashboard where they can see reports/users
          return;
        }

        // For real users, we would use signInWithEmailAndPassword, but here we mock it
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', 'user');
        navigate('/');
      } catch (err) {
        console.error('Login error', err);
        setError('เกิดข้อผิดพลาดในการตรวจสอบข้อมูลรับรอง');
      }
    } else {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center items-center gap-1 mb-4">
            <span className="text-5xl font-bold text-[var(--navy-deep)]">AK</span>
            <span className="text-5xl font-black text-[var(--gold-vibrant)]">88</span>
          </div>
          <h2 className="text-2xl font-bold text-[var(--navy-deep)]">เข้าสู่ระบบ</h2>
          <p className="text-[var(--navy-deep)] text-sm mt-2 font-medium">เว็บหวยออนไลน์อันดับ 1</p>
          <div className="mt-2 p-2 bg-blue-50 text-blue-600 text-[10px] rounded border border-blue-100">
            ทดสอบ: Master: 1234/1234 | เอเย่นต์: 1234/1234
          </div>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label className="text-[var(--navy-deep)] text-sm font-bold mb-1 block">ยูสเซอร์เนม (Username)</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">person</span>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white rounded-lg py-3 pl-10 pr-4 text-[var(--navy-deep)] border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]" 
                  placeholder="กรอกยูสเซอร์เนม" 
                />
              </div>
            </div>
            <div>
              <label className="text-[var(--navy-deep)] text-sm font-bold mb-1 block">พาสเวิร์ด (Password)</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">lock</span>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white rounded-lg py-3 pl-10 pr-4 text-[var(--navy-deep)] border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]" 
                  placeholder="กรอกพาสเวิร์ด" 
                />
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-xs text-center font-bold">{error}</p>}

          <div className="flex items-center justify-end">
            <Link to="/forgot-password" className="text-sm text-[var(--gold-vibrant)] hover:underline font-bold">
              ลืมรหัสผ่าน?
            </Link>
          </div>

          <button type="submit" className="w-full block text-center bg-[var(--gold-vibrant)] text-[var(--navy-deep)] font-black rounded-lg py-3 text-lg shadow-lg transform transition active:scale-95">
            เข้าสู่ระบบ
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-[var(--navy-deep)] text-sm">
            ยังไม่มีบัญชี?{' '}
            <Link to="/register" className="text-[var(--gold-vibrant)] font-bold hover:underline text-base">
              สมัครสมาชิกใหม่
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
