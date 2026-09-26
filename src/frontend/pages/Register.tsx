import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

export default function Register() {
  const [formData, setFormData] = useState({
    phoneNumber: '',
    username: '',
    password: '',
    confirmPassword: '',
    bankName: '',
    bankAccount: '',
    firstName: '',
    lastName: '',
    referralSource: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      let agentId = 'Master'; // Default to Master
      
      if (formData.referralSource) {
        // Try to find an agent by apiKey (Agent Code)
        const q = query(collection(db, 'agents'), where('apiKey', '==', formData.referralSource.trim()));
        const agentSnap = await getDocs(q);
        
        if (!agentSnap.empty) {
          agentId = agentSnap.docs[0].id;
        }
      }

      // Save user data to Firestore
      await addDoc(collection(db, 'users'), {
        ...formData,
        agentId,
        balance: 0,
        role: 'user',
        status: 'active',
        createdAt: new Date().toISOString()
      });

      alert('สมัครสมาชิกสำเร็จ!');
      navigate('/login');
    } catch (error) {
      console.error('Error registering user:', error);
      alert('เกิดข้อผิดพลาดในการสมัครสมาชิก');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 pb-10">
      <div className="w-full max-w-md mx-auto space-y-6 mt-4">
        <div className="text-center">
          <div className="flex justify-center items-center gap-1 mb-2">
            <span className="text-4xl font-bold text-[var(--navy-deep)]">AK</span>
            <span className="text-4xl font-black text-[var(--gold-vibrant)]">88</span>
          </div>
          <h2 className="text-xl font-bold text-[var(--navy-deep)]">สมัครสมาชิกใหม่</h2>
          <p className="text-[var(--navy-deep)] font-medium text-xs mt-1">กรุณากรอกข้อมูลให้ครบถ้วนเพื่อความปลอดภัยของท่าน</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="bg-white p-4 rounded-xl space-y-4 border border-[var(--grey-border)] shadow-sm">
            <h3 className="text-[var(--navy-deep)] font-bold text-sm border-b border-[var(--grey-border)] pb-2">ข้อมูลการเข้าสู่ระบบ</h3>
            <div>
              <label className="text-[var(--navy-deep)] text-xs font-bold mb-1 block">เบอร์โทรศัพท์</label>
              <input 
                type="tel" 
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                required
                className="w-full bg-gray-50 border border-[var(--grey-border)] rounded-lg py-2.5 px-3 text-sm text-[var(--navy-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]" 
                placeholder="08x-xxx-xxxx" 
              />
            </div>
            <div>
              <label className="text-[var(--navy-deep)] text-xs font-bold mb-1 block">ยูสเซอร์เนม (Username)</label>
              <input 
                type="text" 
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full bg-gray-50 border border-[var(--grey-border)] rounded-lg py-2.5 px-3 text-sm text-[var(--navy-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]" 
                placeholder="ตั้งชื่อผู้ใช้งาน (ภาษาอังกฤษ/ตัวเลข)" 
              />
            </div>
            <div>
              <label className="text-[var(--navy-deep)] text-xs font-bold mb-1 block">พาสเวิร์ด (Password)</label>
              <input 
                type="password" 
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full bg-gray-50 border border-[var(--grey-border)] rounded-lg py-2.5 px-3 text-sm text-[var(--navy-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]" 
                placeholder="ตั้งรหัสผ่าน 6 ตัวขึ้นไป" 
              />
            </div>
            <div>
              <label className="text-[var(--navy-deep)] text-xs font-bold mb-1 block">ยืนยันพาสเวิร์ด</label>
              <input 
                type="password" 
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full bg-gray-50 border border-[var(--grey-border)] rounded-lg py-2.5 px-3 text-sm text-[var(--navy-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]" 
                placeholder="ยืนยันรหัสผ่านอีกครั้ง" 
              />
            </div>
            <div>
              <label className="text-[var(--navy-deep)] text-xs font-bold mb-1 block">รหัสผู้แนะนำ / แหล่งที่มา (ถ้ามี)</label>
              <input 
                type="text" 
                name="referralSource"
                value={formData.referralSource}
                onChange={handleChange}
                className="w-full bg-gray-50 border border-[var(--grey-border)] rounded-lg py-2.5 px-3 text-sm text-[var(--navy-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]" 
                placeholder="กรอกรหัสแนะนำ หรือระบุแหล่งที่มา" 
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl space-y-4 border border-[var(--grey-border)] shadow-sm">
            <h3 className="text-[var(--navy-deep)] font-bold text-sm border-b border-[var(--grey-border)] pb-2">ข้อมูลบัญชีธนาคาร (สำหรับฝาก-ถอน)</h3>
            <div>
              <label className="text-[var(--navy-deep)] text-xs font-bold mb-1 block">เลือกธนาคาร</label>
              <select 
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
                required
                className="w-full bg-gray-50 border border-[var(--grey-border)] rounded-lg py-2.5 px-3 text-sm text-[var(--navy-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]"
              >
                <option value="">-- กรุณาเลือกธนาคาร --</option>
                <option value="kbank">ธนาคารกสิกรไทย</option>
                <option value="scb">ธนาคารไทยพาณิชย์</option>
                <option value="bbl">ธนาคารกรุงเทพ</option>
                <option value="ktb">ธนาคารกรุงไทย</option>
                <option value="bay">ธนาคารกรุงศรีอยุธยา</option>
                <option value="ttb">ธนาคารทหารไทยธนชาต</option>
              </select>
            </div>
            <div>
              <label className="text-[var(--navy-deep)] text-xs font-bold mb-1 block">เลขที่บัญชี</label>
              <input 
                type="text" 
                name="bankAccount"
                value={formData.bankAccount}
                onChange={handleChange}
                required
                className="w-full bg-gray-50 border border-[var(--grey-border)] rounded-lg py-2.5 px-3 text-sm text-[var(--navy-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]" 
                placeholder="กรอกเลขที่บัญชี" 
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[var(--navy-deep)] text-xs font-bold mb-1 block">ชื่อจริง</label>
                <input 
                  type="text" 
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-50 border border-[var(--grey-border)] rounded-lg py-2.5 px-3 text-sm text-[var(--navy-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]" 
                  placeholder="ชื่อจริง" 
                />
              </div>
              <div>
                <label className="text-[var(--navy-deep)] text-xs font-bold mb-1 block">นามสกุล</label>
                <input 
                  type="text" 
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-50 border border-[var(--grey-border)] rounded-lg py-2.5 px-3 text-sm text-[var(--navy-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-vibrant)]" 
                  placeholder="นามสกุล" 
                />
              </div>
            </div>
            <p className="text-[var(--navy-deep)] font-bold text-[10px]">* ชื่อ-นามสกุล ต้องตรงกับชื่อบัญชีธนาคารเท่านั้น เพื่อใช้ในการฝาก-ถอน</p>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full block text-center bg-[var(--gold-vibrant)] text-[var(--navy-deep)] font-black rounded-lg py-3 text-lg shadow-lg transform transition active:scale-95 mt-4 disabled:opacity-50"
          >
            {loading ? 'กำลังดำเนินการ...' : 'ยืนยันการสมัครสมาชิก'}
          </button>
        </form>

        <div className="text-center mt-4">
          <Link to="/login" className="text-[var(--navy-deep)] text-sm hover:underline">
            มีบัญชีอยู่แล้ว? <span className="text-[var(--gold-vibrant)] font-bold">เข้าสู่ระบบ</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
