import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const THAI_BANKS = [
  { id: 'kbank', name: 'ธนาคารกสิกรไทย (KBANK)' },
  { id: 'scb', name: 'ธนาคารไทยพาณิชย์ (SCB)' },
  { id: 'bbl', name: 'ธนาคารกรุงเทพ (BBL)' },
  { id: 'ktb', name: 'ธนาคารกรุงไทย (KTB)' },
  { id: 'bay', name: 'ธนาคารกรุงศรีอยุธยา (BAY)' },
  { id: 'ttb', name: 'ธนาคารทหารไทยธนชาต (TTB)' },
  { id: 'gsb', name: 'ธนาคารออมสิน (GSB)' },
  { id: 'baac', name: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)' },
];

export default function Register() {
  const [formData, setFormData] = useState({
    phoneNumber: '',
    username: '',
    password: '',
    confirmPassword: '',
    bankName: 'ธนาคารกสิกรไทย (KBANK)',
    bankAccount: '',
    firstName: '',
    lastName: '',
    referralSource: '',
  });

  const [acceptTerms, setAcceptTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegisterClosed, setIsRegisterClosed] = useState(false);
  const [closedReason, setClosedReason] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.systemOpen === false) {
            setIsRegisterClosed(true);
            setClosedReason(d.maintenanceMessage || 'ระบบปิดปรับปรุงชั่วคราว');
          } else if (d.registerOpen === false) {
            setIsRegisterClosed(true);
            setClosedReason('ระบบปิดรับสมัครสมาชิกใหม่ชั่วคราว');
          } else {
            setIsRegisterClosed(false);
            setClosedReason('');
          }
        }
      });
      return () => unsub();
    } catch (e) {
      console.warn('Register settings stream error:', e);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegisterClosed) {
      setError(closedReason || 'ระบบปิดรับสมัครสมาชิกใหม่ชั่วคราว');
      return;
    }

    // 1) Validation ตรวจสอบความถูกต้องของข้อมูล
    const cleanPhone = formData.phoneNumber.replace(/[^0-9]/g, '');
    if (!/^0[689]\d{8}$/.test(cleanPhone)) {
      setError('กรุณากรอกเบอร์โทรศัพท์มือถือ 10 หลักที่ถูกต้อง (เช่น 08x-xxx-xxxx)');
      return;
    }

    const cleanUsername = formData.username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(cleanUsername)) {
      setError('ชื่อผู้ใช้งานต้องเป็นภาษาอังกฤษหรือตัวเลข ความยาว 4-20 ตัวอักษร');
      return;
    }

    if (formData.password.length < 6) {
      setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    const cleanAccount = formData.bankAccount.replace(/[^0-9]/g, '');
    if (cleanAccount.length < 9 || cleanAccount.length > 15) {
      setError('เลขที่บัญชีธนาคารไม่ถูกต้อง (ต้องเป็นตัวเลข 10-12 หลัก)');
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('กรุณากรอกชื่อจริงและนามสกุลให้ครบถ้วน');
      return;
    }

    if (!acceptTerms) {
      setError('กรุณายอมรับเงื่อนไขและข้อตกลงในการใช้งาน');
      return;
    }

    setLoading(true);

    try {
      const { collection, addDoc, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('@/shared/lib/firebase');

      // 2) ตรวจสอบความซ้ำซ้อนในฐานข้อมูล (Unique check)
      let snapPhone = await getDocs(query(collection(db, 'users'), where('phone', '==', cleanPhone)));
      if (snapPhone.empty) {
        snapPhone = await getDocs(query(collection(db, 'users'), where('phoneNumber', '==', cleanPhone)));
      }
      if (!snapPhone.empty) {
        setError('เบอร์โทรศัพท์นี้ถูกลงทะเบียนไว้ในระบบแล้ว');
        setLoading(false);
        return;
      }

      const qUser = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const snapUser = await getDocs(qUser);
      if (!snapUser.empty) {
        setError('ชื่อผู้ใช้งาน (Username) นี้มีผู้ใช้งานแล้ว กรุณาเลือกชื่ออื่น');
        setLoading(false);
        return;
      }

      // 3) บันทึกบัญชีสมาชิกใหม่ลงฐานข้อมูล Supabase
      const newUserId = `user_${cleanUsername}_${Date.now()}`;
      const newUser = {
        id: newUserId,
        phone: cleanPhone,
        phoneNumber: cleanPhone,
        username: cleanUsername,
        password: formData.password,
        passwordHash: formData.password,
        bankName: formData.bankName,
        bankAccount: cleanAccount,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        referralSource: formData.referralSource.trim() || 'Direct',
        role: 'member',
        status: 'active',
        balance: 0,
        totalBet: 0,
        totalWin: 0,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'users'), newUser);

      // 4) เข้าสู่ระบบอัตโนมัติ (Auto Login)
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.removeItem('adminAuth');
      localStorage.setItem('userRole', 'user');
      localStorage.setItem('userId', docRef.id);
      localStorage.setItem('username', cleanUsername);
      localStorage.setItem('currentUser', JSON.stringify({
        userId: docRef.id,
        username: cleanUsername,
        name: newUser.name,
        phone: cleanPhone,
        balance: 0,
        role: 'user',
        loginAt: new Date().toISOString()
      }));

      alert(`🎉 สมัครสมาชิกสำเร็จ!\nยินดีต้อนรับคุณ ${newUser.name}\nบัญชีของท่านพร้อมใช้งานแล้วครับ`);
      navigate('/');
    } catch (err) {
      console.error('Registration error:', err);
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#071326] via-[#0a192f] to-[#040d1a] flex flex-col p-4 pb-12 font-sans">
      <div className="w-full max-w-lg mx-auto space-y-6 mt-2">
        {/* Brand header */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 mb-2 hover:opacity-95 transition">
            <span className="text-4xl font-black text-white tracking-wider">AK</span>
            <span className="text-4xl font-black text-[#F4C430] drop-shadow-[0_0_20px_rgba(244,196,48,0.4)]">88</span>
          </Link>
          <h1 className="text-2xl font-black text-white">สมัครสมาชิก</h1>
          <p className="text-gray-300 text-xs mt-1">กรอกข้อมูลเพื่อเปิดบัญชีแทงหวยออนไลน์กับ AK88</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Section 1: ข้อมูลเข้าสู่ระบบ */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xl space-y-3.5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
              <span className="material-symbols-outlined text-[#0a192f] text-lg font-bold">badge</span>
              <h2 className="text-[#0a192f] font-black text-sm">1. ข้อมูลเข้าสู่ระบบ</h2>
            </div>

            <div>
              <label className="text-gray-700 text-xs font-bold mb-1 block">เบอร์โทรศัพท์ (ใช้ยืนยันและเข้าสู่ระบบ) *</label>
              <input 
                type="tel" 
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                required
                maxLength={12}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                placeholder="08x-xxx-xxxx" 
              />
            </div>

            <div>
              <label className="text-gray-700 text-xs font-bold mb-1 block">ยูสเซอร์เนม (Username ภาษาอังกฤษ/ตัวเลข 4-20 ตัว) *</label>
              <input 
                type="text" 
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                maxLength={20}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                placeholder="ตั้งชื่อผู้ใช้งาน เช่น user789" 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-700 text-xs font-bold mb-1 block">รหัสผ่าน (อย่างน้อย 6 ตัว) *</label>
                <input 
                  type="password" 
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                  placeholder="รหัสผ่าน" 
                />
              </div>
              <div>
                <label className="text-gray-700 text-xs font-bold mb-1 block">ยืนยันรหัสผ่าน *</label>
                <input 
                  type="password" 
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                  placeholder="ยืนยันรหัสผ่าน" 
                />
              </div>
            </div>

            <div>
              <label className="text-gray-700 text-xs font-bold mb-1 block">รหัสผู้แนะนำ (ถ้ามี)</label>
              <input 
                type="text" 
                name="referralSource"
                value={formData.referralSource}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                placeholder="กรอกรหัสผู้แนะนำ (ไม่บังคับ)" 
              />
            </div>
          </div>

          {/* Section 2: ข้อมูลบัญชีธนาคารสำหรับฝาก-ถอน */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xl space-y-3.5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
              <span className="material-symbols-outlined text-emerald-700 text-lg font-bold">account_balance</span>
              <h2 className="text-[#0a192f] font-black text-sm">2. ข้อมูลบัญชีธนาคารสำหรับฝาก-ถอน</h2>
            </div>

            <div>
              <label className="text-gray-700 text-xs font-bold mb-1 block">เลือกธนาคาร *</label>
              <select 
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]"
              >
                {THAI_BANKS.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-gray-700 text-xs font-bold mb-1 block">เลขที่บัญชีธนาคาร *</label>
              <input 
                type="text" 
                name="bankAccount"
                value={formData.bankAccount}
                onChange={handleChange}
                required
                maxLength={15}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                placeholder="กรอกเลขที่บัญชีธนาคาร (เฉพาะตัวเลข)" 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-700 text-xs font-bold mb-1 block">ชื่อจริง *</label>
                <input 
                  type="text" 
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                  placeholder="ชื่อจริง (ภาษาไทย)" 
                />
              </div>
              <div>
                <label className="text-gray-700 text-xs font-bold mb-1 block">นามสกุล *</label>
                <input 
                  type="text" 
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                  placeholder="นามสกุล (ภาษาไทย)" 
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-base text-amber-600 shrink-0 mt-0.5">info</span>
              <span><strong>ข้อกำหนดสำคัญ:</strong> ชื่อ-นามสกุล ต้องตรงกับชื่อบัญชีธนาคารเท่านั้น เพื่อให้ระบบโอนเงินรางวัลและยอดถอนเข้าบัญชีของท่านโดยอัตโนมัติ</span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 pt-1 select-none">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="rounded text-[#F4C430] focus:ring-[#F4C430]"
              />
              <span>ข้าพเจ้ายืนยันว่าข้อมูลข้างต้นเป็นความจริง และยอมรับเงื่อนไขการใช้งาน</span>
            </label>
          </div>

          {isRegisterClosed && (
            <div className="p-3 bg-red-100/90 text-red-800 rounded-xl text-xs font-black border border-red-300 text-center flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-base text-red-600">block</span>
              <span>{closedReason || 'ระบบปิดรับสมัครสมาชิกใหม่ชั่วคราว'}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-200 text-center flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || isRegisterClosed}
            className={`w-full font-black rounded-xl py-3.5 text-base shadow-xl transition transform flex items-center justify-center gap-2 ${
              isRegisterClosed 
                ? 'bg-gray-400 text-gray-700 cursor-not-allowed opacity-75' 
                : 'bg-gradient-to-r from-amber-400 via-[#F4C430] to-amber-500 text-[#0a192f] hover:brightness-105 active:scale-95 cursor-pointer'
            }`}
          >
            {isRegisterClosed ? (
              <>
                <span className="material-symbols-outlined text-xl">lock</span>
                <span>ปิดรับสมัครสมาชิกชั่วคราว</span>
              </>
            ) : loading ? (
              <>กำลังลงทะเบียนข้อมูล...</>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">how_to_reg</span>
                <span>ยืนยันการสมัครสมาชิก</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 space-y-2">
          <p className="text-gray-300 text-xs">
            มีบัญชีผู้ใช้งานอยู่แล้ว?{' '}
            <Link to="/login" className="text-[#F4C430] font-bold hover:underline ml-1">
              เข้าสู่ระบบที่นี่
            </Link>
          </p>
          <div>
            <Link to="/" className="text-xs text-gray-400 hover:text-gray-300">
              ← กลับสู่หน้าหลัก
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
