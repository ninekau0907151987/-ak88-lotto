import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const SAMPLE_FIRSTNAMES = ['สมชาย', 'ธนพล', 'กิตติศักดิ์', 'ศิริพร', 'ณัฐวุฒิ', 'วรินทร', 'ปิยะดา', 'พงศกร'];
const SAMPLE_LASTNAMES = ['มั่งมี', 'ทรัพย์เจริญ', 'มั่นคง', 'รัตนโชติ', 'บุญรักษา', 'เจริญสุข', 'ทองทวี', 'ศรีสุข'];
const BANKS = [
  { id: 'kbank', name: 'ธนาคารกสิกรไทย (KBANK)' },
  { id: 'scb', name: 'ธนาคารไทยพาณิชย์ (SCB)' },
  { id: 'bbl', name: 'ธนาคารกรุงเทพ (BBL)' },
  { id: 'ktb', name: 'ธนาคารกรุงไทย (KTB)' },
  { id: 'bay', name: 'ธนาคารกรุงศรีอยุธยา (BAY)' },
  { id: 'ttb', name: 'ธนาคารทหารไทยธนชาต (TTB)' },
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
    referralSource: ''
  });
  const [loading, setLoading] = useState(false);
  const [demoCredit, setDemoCredit] = useState(10000);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ปุ่มสุ่มข้อมูลตัวอย่างอัตโนมัติใน 1 คลิก
  const handleAutoFill = () => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const randomPhone = `08${Math.floor(10000000 + Math.random() * 90000000)}`;
    const randomBankAcc = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(1 + Math.random() * 9)}-${Math.floor(10000 + Math.random() * 90000)}-${Math.floor(1 + Math.random() * 9)}`;
    const randomFirst = SAMPLE_FIRSTNAMES[Math.floor(Math.random() * SAMPLE_FIRSTNAMES.length)];
    const randomLast = SAMPLE_LASTNAMES[Math.floor(Math.random() * SAMPLE_LASTNAMES.length)];
    const randomBank = BANKS[Math.floor(Math.random() * BANKS.length)].name;

    setFormData({
      phoneNumber: randomPhone,
      username: `member_${randomDigits}`,
      password: '123456',
      confirmPassword: '123456',
      bankName: randomBank,
      bankAccount: randomBankAcc,
      firstName: randomFirst,
      lastName: randomLast,
      referralSource: 'AK88_VIP'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert('รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return;
    }

    if (formData.password.length < 4) {
      alert('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    setLoading(true);
    try {
      // 1) พยายามบันทึกลง Firestore
      try {
        const { collection, addDoc, doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('@/shared/lib/firebase');

        // บันทึก user พร้อมเครดิตฟรีสำหรับทดลองแทงหวย
        const userObj = {
          ...formData,
          balance: demoCredit,
          role: 'user',
          status: 'active',
          totalBet: 0,
          totalWin: 0,
          createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'users'), userObj);

        // อัปเดต demo_user เพื่อให้หน้าบ้านสามารถเล่นได้ต่อเนื่อง
        await setDoc(doc(db, 'users', 'demo_user'), {
          username: formData.username,
          name: `${formData.firstName} ${formData.lastName}`,
          phone: formData.phoneNumber,
          bankName: formData.bankName,
          bankAccount: formData.bankAccount,
          balance: demoCredit,
          role: 'user',
          status: 'active',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn('Firebase save skipped, saving to localStorage:', err);
      }

      // 2) Auto Login ทันที
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userRole', 'user');
      localStorage.setItem('username', formData.username);
      localStorage.setItem('currentUser', JSON.stringify({
        username: formData.username,
        role: 'user',
        name: `${formData.firstName} ${formData.lastName}`,
        balance: demoCredit,
        phone: formData.phoneNumber,
        bankName: formData.bankName,
        bankAccount: formData.bankAccount
      }));

      alert(`🎉 สมัครสมาชิกสำเร็จ!\nยินดีต้อนรับคุณ ${formData.firstName} ${formData.lastName}\nได้รับเครดิตทดลองเล่น ฿${demoCredit.toLocaleString()} เรียบร้อยแล้ว`);
      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
      alert('เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#071326] via-[#0a192f] to-[#040d1a] flex flex-col p-4 pb-12">
      <div className="w-full max-w-lg mx-auto space-y-6 mt-2 relative z-10">
        {/* Brand header */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 mb-2 hover:scale-105 transition transform">
            <span className="text-4xl font-black text-white tracking-wider">AK</span>
            <span className="text-4xl font-black text-[#F4C430] drop-shadow-[0_0_20px_rgba(244,196,48,0.4)]">88</span>
          </Link>
          <h1 className="text-xl font-black text-white">สมัครสมาชิกใหม่ (เปิดยูสเซอร์)</h1>
          <p className="text-gray-300 text-xs mt-1">รับเครดิตทดลองแทงหวยฟรี ฿{demoCredit.toLocaleString()} ทันทีที่สมัคร</p>

          {/* Quick 1-Click Demo Fill Button */}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleAutoFill}
              className="inline-flex items-center gap-1.5 bg-[#F4C430] hover:bg-amber-400 text-[#0a192f] text-xs font-black px-4 py-2 rounded-full shadow-lg hover:shadow-[#F4C430]/30 transition transform active:scale-95"
            >
              <span className="material-symbols-outlined text-sm font-black">auto_awesome</span>
              ⚡ คลิกที่นี่: กรอกข้อมูลทดสอบอัตโนมัติ (1-Click Demo Fill)
            </button>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Section 1: ข้อมูลเข้าสู่ระบบ */}
          <div className="bg-white/95 backdrop-blur-md p-5 rounded-2xl border border-gray-200 shadow-xl space-y-3.5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
              <span className="material-symbols-outlined text-[#0a192f] text-lg font-bold">badge</span>
              <h2 className="text-[#0a192f] font-black text-sm">1. ข้อมูลเข้าสู่ระบบ</h2>
            </div>

            <div>
              <label className="text-gray-700 text-xs font-bold mb-1 block">เบอร์โทรศัพท์ (ใช้เป็นเบอร์ติดต่อ)</label>
              <input 
                type="tel" 
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                placeholder="08x-xxx-xxxx" 
              />
            </div>

            <div>
              <label className="text-gray-700 text-xs font-bold mb-1 block">ยูสเซอร์เนม (Username)</label>
              <input 
                type="text" 
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                placeholder="เช่น ak88_winner หรือ user123" 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-700 text-xs font-bold mb-1 block">รหัสผ่าน</label>
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
                <label className="text-gray-700 text-xs font-bold mb-1 block">ยืนยันรหัสผ่าน</label>
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
              <label className="text-gray-700 text-xs font-bold mb-1 block">รหัสแนะนำ / เอเย่นต์ (ถ้ามี)</label>
              <input 
                type="text" 
                name="referralSource"
                value={formData.referralSource}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                placeholder="ระบุรหัสแนะนำ เช่น AK88_VIP" 
              />
            </div>
          </div>

          {/* Section 2: ข้อมูลบัญชีธนาคารสำหรับฝาก-ถอน */}
          <div className="bg-white/95 backdrop-blur-md p-5 rounded-2xl border border-gray-200 shadow-xl space-y-3.5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
              <span className="material-symbols-outlined text-emerald-700 text-lg font-bold">account_balance</span>
              <h2 className="text-[#0a192f] font-black text-sm">2. ข้อมูลบัญชีธนาคาร (ฝาก-ถอน อัตโนมัติ)</h2>
            </div>

            <div>
              <label className="text-gray-700 text-xs font-bold mb-1 block">เลือกธนาคาร</label>
              <select 
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]"
              >
                {BANKS.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-gray-700 text-xs font-bold mb-1 block">เลขที่บัญชี</label>
              <input 
                type="text" 
                name="bankAccount"
                value={formData.bankAccount}
                onChange={handleChange}
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                placeholder="กรอกเลขที่บัญชีธนาคาร" 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-700 text-xs font-bold mb-1 block">ชื่อจริง</label>
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
                <label className="text-gray-700 text-xs font-bold mb-1 block">นามสกุล</label>
                <input 
                  type="text" 
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F4C430]" 
                  placeholder="นามสกุล" 
                />
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-amber-600">info</span>
              <span>ชื่อ-นามสกุล ต้องตรงกับบัญชีธนาคารเพื่อความสะดวกในการรับยอดเงินรางวัล</span>
            </div>
          </div>

          {/* เครดิตทดลองฟรี */}
          <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 p-3.5 rounded-xl flex items-center justify-between text-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black">
                ฿
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-300">โบนัสทดลองเล่นฟรีทันที</div>
                <div className="text-base font-black text-white">฿{demoCredit.toLocaleString()} บาท</div>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 px-2 py-1 rounded font-bold">
              เปิดให้เล่นทันที
            </span>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-400 via-[#F4C430] to-amber-500 text-[#0a192f] font-black rounded-xl py-3.5 text-lg shadow-xl hover:brightness-105 active:scale-95 transition transform disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>กำลังเปิดบัญชีผู้ใช้...</>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">check_circle</span>
                <span>ยืนยันการสมัคร & เข้าสู่ระบบทันที</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 space-y-2">
          <Link to="/login" className="text-gray-300 text-sm hover:text-white transition">
            มีบัญชีอยู่แล้ว? <span className="text-[#F4C430] font-bold underline">เข้าสู่ระบบที่นี่</span>
          </Link>
          <div>
            <Link to="/" className="text-xs text-gray-500 hover:text-gray-400">
              ← กลับไปหน้าหลัก
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
