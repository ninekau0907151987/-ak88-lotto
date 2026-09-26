import { useState, useEffect } from 'react';
import { db } from '@/shared/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';

export default function DeveloperApi() {
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'api_keys'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setApiKeys(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const generateKey = async () => {
    if (!newKeyName.trim()) {
      alert('กรุณาระบุชื่อคีย์ (เช่น ระบบบัญชี, เว็บพันธมิตร)');
      return;
    }

    const randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const newKey = `ak88_live_${randomString}`;

    try {
      await addDoc(collection(db, 'api_keys'), {
        name: newKeyName,
        key: newKey,
        createdAt: serverTimestamp(),
        status: 'active',
        lastUsed: null
      });
      setNewKeyName('');
      alert('สร้าง API Key สำเร็จ!');
    } catch (error) {
      console.error('Error generating key:', error);
      alert('เกิดข้อผิดพลาดในการสร้างคีย์');
    }
  };

  const revokeKey = async (id: string) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบ API Key นี้? ระบบที่เชื่อมต่ออยู่จะไม่สามารถใช้งานได้ทันที')) {
      try {
        await deleteDoc(doc(db, 'api_keys', id));
      } catch (error) {
        console.error('Error revoking key:', error);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('คัดลอก API Key แล้ว');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-[var(--navy-deep)] p-3 flex items-center justify-between sticky top-[57px] z-40 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white flex items-center">
            <span className="material-symbols-outlined">arrow_back_ios</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--gold-vibrant)]">api</span>
            <h1 className="text-white font-bold text-lg">การตั้งค่า API & นักพัฒนา</h1>
          </div>
        </div>
        <Link to="/admin/api/docs" className="bg-[var(--gold-vibrant)] text-[var(--navy-deep)] px-3 py-1 rounded text-xs font-bold flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">menu_book</span>
          คู่มือ API
        </Link>
      </div>

      <div className="p-4 space-y-6 max-w-4xl mx-auto">
        {/* Security Warning */}
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-red-500">security</span>
            <div>
              <h3 className="text-red-800 font-bold">คำเตือนด้านความปลอดภัย</h3>
              <p className="text-red-600 text-sm mt-1">
                API Key เปรียบเสมือนรหัสผ่านเข้าสู่ระบบหลังบ้านของคุณ <strong>ห้ามเปิดเผย API Key ให้กับบุคคลที่ไม่เกี่ยวข้องเด็ดขาด</strong> หากสงสัยว่าคีย์หลุด ให้ทำการลบคีย์ (Revoke) ทันที
              </p>
            </div>
          </div>
        </div>

        {/* Generate New Key */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-[var(--navy-deep)] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--gold-vibrant)]">vpn_key</span>
            สร้าง API Key ใหม่
          </h2>
          <div className="flex gap-3">
            <input 
              type="text" 
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="ชื่อระบบที่ต้องการนำไปเชื่อมต่อ (เช่น เว็บพันธมิตร A)"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-[var(--navy-deep)] focus:ring-1 focus:ring-[var(--navy-deep)]"
            />
            <button 
              onClick={generateKey}
              className="bg-[var(--navy-deep)] text-white px-6 py-2 rounded-lg font-bold hover:bg-opacity-90 transition flex items-center gap-2"
            >
              <span className="material-symbols-outlined">add_circle</span>
              สร้างคีย์
            </button>
          </div>
        </div>

        {/* Existing Keys */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-[var(--navy-deep)] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--gold-vibrant)]">list_alt</span>
            API Keys ที่ใช้งานอยู่
          </h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">กำลังโหลด...</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
              ยังไม่มี API Key ในระบบ
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
                    <th className="p-3 font-bold">ชื่อระบบ</th>
                    <th className="p-3 font-bold">API Key</th>
                    <th className="p-3 font-bold">วันที่สร้าง</th>
                    <th className="p-3 font-bold">สถานะ</th>
                    <th className="p-3 font-bold text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 font-medium text-[var(--navy-deep)]">{key.name}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded text-sm font-mono text-gray-700">
                          {key.key.substring(0, 15)}...
                          <button 
                            onClick={() => copyToClipboard(key.key)}
                            className="text-gray-500 hover:text-[var(--navy-deep)] transition"
                            title="คัดลอก"
                          >
                            <span className="material-symbols-outlined text-sm">content_copy</span>
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-gray-500">
                        {key.createdAt ? (key.createdAt.toDate ? key.createdAt.toDate().toLocaleDateString('th-TH') : new Date(key.createdAt).toLocaleDateString('th-TH')) : '-'}
                      </td>
                      <td className="p-3">
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                          {key.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => revokeKey(key.id)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded transition"
                          title="ลบคีย์"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
