import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';

export default function AgentProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const agent = location.state?.agent;

  const [ipWhitelist, setIpWhitelist] = useState<string[]>([]);
  const [newIp, setNewIp] = useState('');
  const [activeTab, setActiveTab] = useState('หวยไทย');
  
  if (!agent) {
    return (
      <div className="min-h-screen bg-[#fcfdfa] flex flex-col items-center justify-center p-4">
        <div className="text-xl text-gray-500 mb-4">ไม่พบข้อมูลเอเย่นต์</div>
        <button onClick={() => navigate(-1)} className="bg-teal-600 text-white px-4 py-2 rounded">ย้อนกลับ</button>
      </div>
    );
  }

  const handleAddIp = () => {
    if (newIp.trim() !== '') {
      setIpWhitelist([...ipWhitelist, newIp.trim()]);
      setNewIp('');
    }
  };

  const generateApiKey = async () => {
    const newKey = 'sk_live_' + Math.random().toString(36).substr(2, 24);
    try {
      await updateDoc(doc(db, 'agents', agent.id), { apiKey: newKey });
      alert('สร้าง API Key ใหม่สำเร็จ');
      agent.apiKey = newKey; // Optimistic update
      // Force re-render would be ideal, but modifying agent works for immediate visual
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการสร้าง API Key');
    }
  }

  return (
    <div className="min-h-screen bg-[#fcfdfa] pb-20 font-sans">
      <div className="px-6 py-4 flex items-center gap-2 text-sm text-teal-600 font-bold border-b border-gray-200">
        <button onClick={() => navigate(-1)} className="hover:underline">บัญชีผู้ใช้</button>
        <span className="text-gray-400">/</span>
        <span>โปรไฟล์</span>
      </div>

      <div className="p-6">
        <h2 className="text-2xl font-black text-black mb-6">โปรไฟล์</h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Data Info */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
               <h3 className="text-lg font-bold text-gray-800">ข้อมูล</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="relative">
                   <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-500 font-bold">ชื่อผู้ใช้</label>
                   <input type="text" readOnly value={agent.username} className="w-full border border-gray-300 rounded p-3 text-gray-600 bg-gray-50 focus:outline-none focus:border-teal-500 transition-colors" />
                 </div>
                 <div className="relative">
                   <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-500 font-bold">เบอร์โทรศัพท์</label>
                   <input type="text" readOnly value={agent.phone || '-'} className="w-full border border-gray-300 rounded p-3 text-gray-600 bg-gray-50 focus:outline-none focus:border-teal-500 transition-colors" />
                 </div>
                 <div className="relative">
                   <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-500 font-bold">ตำแหน่ง</label>
                   <input type="text" readOnly value={agent.position || 'Agent'} className="w-full border border-gray-300 rounded p-3 text-gray-600 bg-gray-50 focus:outline-none focus:border-teal-500 transition-colors" />
                 </div>
                 <div className="relative">
                   <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-500 font-bold">ระดับ</label>
                   <input type="text" readOnly value={agent.level || 'VIP'} className="w-full border border-gray-300 rounded p-3 text-gray-600 bg-gray-50 focus:outline-none focus:border-teal-500 transition-colors" />
                 </div>
                 <div className="relative">
                   <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-500 font-bold">กระเป๋าเงิน</label>
                   <input type="text" readOnly value={agent.betType || 'seamless'} className="w-full border border-gray-300 rounded p-3 text-gray-600 bg-gray-50 focus:outline-none focus:border-teal-500 transition-colors" />
                 </div>
               </div>
            </div>

            {/* 2. Wallet Remaining */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-800">ยอดเงินในกระเป๋า</h3>
              <div className="w-48 border border-gray-300 rounded-lg p-3 bg-gray-50 flex flex-col justify-between h-20">
                <div className="flex items-center gap-2">
                   <div className="w-5 h-5 rounded-full bg-white border border-gray-300 flex items-center justify-center overflow-hidden">
                     <div className="w-full h-full bg-gradient-to-b from-[#ED1C24] via-white to-[#241D4F]"></div>
                   </div>
                   <span className="font-bold text-gray-800 text-sm">THB</span>
                </div>
                <div className="text-right font-bold text-gray-600">{Number(agent.credit || 0).toFixed(2)}</div>
              </div>
            </div>

            {/* 3. Agent Management / API */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
               <h3 className="text-lg font-bold text-gray-800">จัดการเอเย่นต์</h3>
               <div className="space-y-4 max-w-xl">
                 <div className="relative">
                   <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-500 font-bold">API Endpoint</label>
                   <div className="flex border border-gray-300 rounded overflow-hidden">
                     <input type="text" readOnly value="https://api.hentory.io" className="w-full p-3 text-gray-800 bg-white focus:outline-none text-sm font-mono" />
                     <button className="bg-white px-4 flex items-center text-gray-400 hover:text-gray-600 border-l border-gray-200" onClick={() => navigator.clipboard.writeText("https://api.hentory.io")}>
                       <span className="material-symbols-outlined text-lg">content_copy</span>
                     </button>
                   </div>
                 </div>
                 <div className="relative">
                   <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] text-gray-500 font-bold">API Key</label>
                   <input type="text" readOnly value={agent.apiKey || 'Not Generated'} className="w-full border border-gray-300 rounded p-3 text-gray-500 bg-gray-100 focus:outline-none text-sm font-mono" />
                 </div>
                 <div>
                   <button onClick={generateApiKey} className="bg-[#0f8b65] hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded flex items-center gap-1 transition text-sm shadow-sm">
                     <span className="material-symbols-outlined text-lg">add</span> สร้าง API Key
                   </button>
                 </div>
               </div>
            </div>

            {/* 4. IP Whitelist */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-800">IP Whitelist</h3>
              <div className="max-w-xl">
                <div className="flex border border-gray-300 rounded overflow-hidden mb-4 focus-within:border-teal-500 transition-colors">
                  <input type="text" value={newIp} onChange={e => setNewIp(e.target.value)} placeholder="IP Whitelist" className="w-full p-2.5 outline-none text-sm placeholder:text-sm text-gray-700 bg-gray-50" />
                  <button onClick={handleAddIp} className="text-white hover:bg-teal-700 px-4 bg-[#0f8b65] transition-colors border-l border-teal-600 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">add</span> เพิ่ม IP
                  </button>
                </div>
                
                <table className="w-full text-left text-sm border-collapse rounded-lg overflow-hidden border border-gray-200">
                  <thead>
                    <tr className="bg-[#f0f9f5] text-[#0f8b65] border-b border-teal-100">
                      <th className="p-3 text-center w-16 font-bold">ลำดับ</th>
                      <th className="p-3 text-center font-bold">IP</th>
                      <th className="p-3 text-center w-24 font-bold">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ipWhitelist.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-6 text-center text-gray-500 bg-white">ไม่มีรายการ IP Whitelist</td>
                      </tr>
                    ) : (
                      ipWhitelist.map((ip, index) => (
                        <tr key={index} className="border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-center text-gray-600">{index + 1}</td>
                          <td className="p-3 text-center font-mono text-gray-700">{ip}</td>
                          <td className="p-3 text-center">
                            <button onClick={() => setIpWhitelist(ipWhitelist.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700 hover:underline p-1 px-3 bg-red-50 rounded text-xs font-bold transition">ลบ</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. Lottery Settings Preview (Read Only) */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
              <div className="flex border-b border-gray-200 mb-4 overflow-x-auto gap-2">
                <button className="px-6 py-3 border-b-2 border-teal-600 text-teal-600 font-bold whitespace-nowrap bg-gray-50 flex-shrink-0">ประเภทหวย</button>
                {['หวยไทย', 'หวยยี่กี', 'หวยลาว', 'หวยพัฒนา', 'หวยหุ้น'].map(tab => (
                   <button 
                     key={tab} 
                     onClick={() => setActiveTab(tab)} 
                     className={`px-4 py-3 border-b-2 whitespace-nowrap text-lg transition flex-shrink-0 ${activeTab === tab ? 'border-teal-600 text-black font-black' : 'border-transparent text-gray-400 font-bold hover:text-gray-600'}`}
                   >
                     {tab}
                   </button>
                ))}
              </div>
              
              <table className="w-full text-left text-sm whitespace-nowrap border-collapse rounded-lg overflow-hidden border border-gray-200">
                <thead className="bg-[#f0f9f5] text-[#0f8b65] border-b border-teal-100">
                  <tr>
                    <th className="p-3 text-center w-16 font-bold">ลำดับ</th>
                    <th className="p-3 font-bold">ชื่อโปรดักส์</th>
                    <th className="p-3 font-bold">
                       Callback Url<br/>
                       <span className="text-[9px] font-normal text-teal-600/60 leading-none block">Ex: http://"{"{Your Callback Url}"}"</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-700">
                  {['3 ตัวบน', '3 ตัวล่าง', '3 โต๊ด as', '2 บน ker', '2 ล่าง', 'ทา เห'].map((name, idx) => (
                    <tr key={idx} className="bg-white hover:bg-gray-50 transition">
                      <td className="p-3 border-x border-gray-100 text-center text-gray-500">{idx + 1}</td>
                      <td className="p-3 border-r border-gray-100 font-bold tracking-tight text-gray-800">{name}</td>
                      <td className="p-3 border-r border-gray-100">
                        <input type="text" readOnly className="w-full border border-gray-300 rounded p-2 bg-gray-50 text-gray-600 focus:outline-none focus:border-teal-500 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

            </div>

          </div>

          <div className="lg:col-span-1">
             <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 h-full min-h-[300px]">
               <h3 className="text-teal-600 font-bold text-lg mb-4">ประวัติแก้ไข</h3>
               <table className="w-full text-left text-sm border-collapse rounded-lg overflow-hidden border border-gray-200">
                 <thead>
                   <tr className="bg-[#f0f9f5] text-[#0f8b65] border-b border-teal-100">
                     <th className="p-3 text-center font-bold">วันที่</th>
                     <th className="p-3 text-center font-bold">แก้ไขโดย</th>
                   </tr>
                 </thead>
                 <tbody>
                   <tr className="bg-white hover:bg-gray-50 transition">
                     <td className="p-3 text-center text-[#0f8b65] font-bold border-b border-gray-100">21-04-2026 17:40:02</td>
                     <td className="p-3 text-center text-gray-600 border-b border-gray-100">667788</td>
                   </tr>
                 </tbody>
               </table>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
