/**
 * backend/pages/ApiDocs.tsx
 * ------------------------------------------------------------------
 * คู่มือ API (API Documentation) — AK88 Lotto API v1
 * แสดง endpoints ทั้งหมด 12 หมวด พร้อมตัวอย่าง
 */
import { useNavigate } from 'react-router-dom';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  desc: string;
}

interface Group {
  name: string;
  icon: string;
  color: string;
  endpoints: Endpoint[];
}

const API_GROUPS: Group[] = [
  {
    name: 'ระบบ (System)', icon: 'settings', color: 'bg-slate-500',
    endpoints: [
      { method: 'GET', path: '/system/status', desc: 'ดูสถานะระบบ (เปิด/ปิด ทุกส่วน)' },
      { method: 'POST', path: '/system/toggle', desc: 'เปิด/ปิดสวิตช์ระบบ (bettingOpen, depositOpen, ฯลฯ)' },
      { method: 'GET', path: '/system/settings', desc: 'ดูการตั้งค่าทั้งหมด' },
      { method: 'POST', path: '/system/settings', desc: 'อัปเดตการตั้งค่า' },
    ],
  },
  {
    name: 'หวย (Lottery)', icon: 'casino', color: 'bg-amber-500',
    endpoints: [
      { method: 'GET', path: '/lottery/types', desc: 'ดูประเภทหวยทั้งหมด' },
      { method: 'GET', path: '/lottery/types/:id', desc: 'ดูประเภทหวยเดียว' },
      { method: 'POST', path: '/lottery/types', desc: 'สร้าง/แก้ไขประเภทหวย' },
      { method: 'POST', path: '/lottery/types/:id/toggle', desc: 'เปิด/ปิดรับแทงหวยตัวนี้' },
      { method: 'POST', path: '/lottery/types/:id/rates', desc: 'ตั้งอัตราจ่าย' },
    ],
  },
  {
    name: 'รอบหวย (Rounds)', icon: 'schedule', color: 'bg-indigo-500',
    endpoints: [
      { method: 'GET', path: '/rounds', desc: 'ดูรอบหวย (กรอง ?type=)' },
      { method: 'POST', path: '/rounds', desc: 'สร้างรอบหวยใหม่' },
      { method: 'POST', path: '/rounds/:id/close', desc: 'ปิดรอบ' },
    ],
  },
  {
    name: 'เลขอั้น (Blocked)', icon: 'block', color: 'bg-red-500',
    endpoints: [
      { method: 'GET', path: '/blocked', desc: 'ดูเลขอั้น (กรอง ?type=)' },
      { method: 'POST', path: '/blocked', desc: 'เพิ่มเลขอั้น' },
      { method: 'DELETE', path: '/blocked/:id', desc: 'ลบเลขอั้น' },
    ],
  },
  {
    name: 'แทง/เล่น (Betting)', icon: 'confirmation_number', color: 'bg-emerald-500',
    endpoints: [
      { method: 'POST', path: '/betting/preview', desc: 'คำนวณเงิน + เช็คเลข + เช็คเครดิต (ไม่บันทึก)' },
      { method: 'POST', path: '/betting/bet', desc: 'ส่งโพย (ตัดเครดิตจริง)' },
      { method: 'GET', path: '/betting/tickets', desc: 'ดูโพย (กรอง ?userId= &status=)' },
      { method: 'GET', path: '/betting/tickets/:id', desc: 'ดูโพยเดียว' },
      { method: 'POST', path: '/betting/tickets/:id/cancel', desc: 'ยกเลิกโพย (คืนเครดิต)' },
      { method: 'POST', path: '/betting/tickets/:id/status', desc: 'อัปเดตสถานะโพย (win/lose/confirmed)' },
    ],
  },
  {
    name: 'ผลรางวัล (Results)', icon: 'emoji_events', color: 'bg-yellow-500',
    endpoints: [
      { method: 'GET', path: '/results', desc: 'ดูผลรางวัล (กรอง ?type= &date=)' },
      { method: 'POST', path: '/results', desc: 'บันทึกผลรางวัลใหม่' },
      { method: 'POST', path: '/results/settle', desc: '⭐ ตรวจรางวัล + จ่ายเงินให้โพยทั้งหมด' },
    ],
  },
  {
    name: 'การเงิน (Finance)', icon: 'account_balance_wallet', color: 'bg-green-600',
    endpoints: [
      { method: 'GET', path: '/finance/balance/:userId', desc: 'เช็คเครดิต' },
      { method: 'POST', path: '/finance/topup', desc: 'เติมเครดิต (แอดมิน)' },
      { method: 'POST', path: '/finance/deposit', desc: 'แจ้งฝาก (รออนุมัติ)' },
      { method: 'POST', path: '/finance/withdraw', desc: 'แจ้งถอน (รออนุมัติ)' },
      { method: 'POST', path: '/finance/transactions/:id/review', desc: 'อนุมัติ/ปฏิเสธธุรกรรม' },
      { method: 'GET', path: '/finance/transactions', desc: 'ประวัติธุรกรรม' },
    ],
  },
  {
    name: 'รายงาน (Reports)', icon: 'bar_chart', color: 'bg-purple-500',
    endpoints: [
      { method: 'GET', path: '/reports/summary', desc: 'ภาพรวมระบบ (Dashboard)' },
      { method: 'GET', path: '/reports/betting', desc: 'รายงานการเล่น (ยอดแทง/ถูก/กำไร)' },
      { method: 'GET', path: '/reports/finance', desc: 'รายงานการเงิน (ฝาก/ถอน/เติม)' },
      { method: 'GET', path: '/reports/agents', desc: 'รายชื่อเอเย่นต์ + เครดิต' },
      { method: 'GET', path: '/reports/members', desc: 'รายชื่อสมาชิก' },
    ],
  },
  {
    name: 'ระบบคิว (Queue)', icon: 'queue', color: 'bg-cyan-600',
    endpoints: [
      { method: 'POST', path: '/queue/enqueue', desc: 'เข้าคิวโพย' },
      { method: 'GET', path: '/queue', desc: 'ดูคิวทั้งหมด (กรอง ?status=)' },
      { method: 'GET', path: '/queue/:id', desc: 'ดูสถานะคิว + ตำแหน่ง' },
      { method: 'POST', path: '/queue/:id/status', desc: 'อัปเดตสถานะคิว' },
      { method: 'POST', path: '/queue/process', desc: 'ประมวลผลคิว (worker)' },
    ],
  },
  {
    name: 'สมาชิก (Users)', icon: 'group', color: 'bg-blue-500',
    endpoints: [
      { method: 'GET', path: '/users', desc: 'รายชื่อสมาชิก' },
      { method: 'GET', path: '/users/:id', desc: 'ดูสมาชิกเดียว' },
      { method: 'POST', path: '/users', desc: 'สร้าง/อัปเดตสมาชิก' },
      { method: 'POST', path: '/users/:id/toggle', desc: 'เปิด/ปิดสมาชิก' },
    ],
  },
  {
    name: 'เอเย่นต์ (Agents)', icon: 'support_agent', color: 'bg-orange-500',
    endpoints: [
      { method: 'GET', path: '/agents', desc: 'รายชื่อเอเย่นต์' },
      { method: 'POST', path: '/agents', desc: 'สร้าง/อัปเดตเอเย่นต์' },
      { method: 'POST', path: '/agents/:id/topup', desc: 'เติมเครดิตให้เอเย่นต์' },
      { method: 'POST', path: '/agents/:id/toggle', desc: 'เปิด/ปิดเอเย่นต์' },
    ],
  },
  {
    name: 'API Keys', icon: 'vpn_key', color: 'bg-rose-500',
    endpoints: [
      { method: 'GET', path: '/keys', desc: 'ดู API Keys ทั้งหมด (ปิดบังคีย์)' },
      { method: 'POST', path: '/keys', desc: 'สร้าง API Key ใหม่' },
      { method: 'POST', path: '/keys/:id/toggle', desc: 'เปิด/ปิดคีย์' },
      { method: 'DELETE', path: '/keys/:id', desc: 'ลบคีย์' },
    ],
  },
];

const methodColor: Record<string, string> = {
  GET: 'bg-green-500',
  POST: 'bg-blue-500',
  PUT: 'bg-amber-500',
  DELETE: 'bg-red-500',
};

export default function ApiDocs() {
  const navigate = useNavigate();
  const base = typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : '/api/v1';
  const total = API_GROUPS.reduce((s, g) => s + g.endpoints.length, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {/* Header */}
      <div className="bg-[var(--navy-deep)] p-3 flex items-center gap-3 sticky top-[57px] z-40 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white flex items-center">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)]">menu_book</span>
          <h1 className="text-white font-bold text-lg">คู่มือการเชื่อมต่อ API</h1>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6 mt-4">

        {/* Intro */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-black text-[var(--navy-deep)] mb-4 border-b pb-2">AK88 Lotto API v1</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            RESTful API ครบทุกด้าน: จัดการหวย, แทง, ผลรางวัล, การเงิน, รายงาน, คิว, สมาชิก, เอเย่นต์
            รวม <strong className="text-[var(--navy-deep)]">{total} endpoints</strong> ใน {API_GROUPS.length} หมวด
          </p>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-sm text-blue-800 mb-2">
            <strong>Base URL:</strong> <code>{base}</code>
          </div>
          <div className="bg-gray-50 border-l-4 border-gray-400 p-4 text-sm text-gray-700">
            <strong>Health Check (ไม่ต้องใช้ key):</strong> <code>{base}/health</code><br />
            <strong>ผลรางวัลสาธารณะ (ไม่ต้องใช้ key):</strong> <code>{base}/public/results</code>
          </div>
        </section>

        {/* Auth */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-black text-[var(--navy-deep)] mb-4 border-b pb-2">การยืนยันตัวตน</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            ทุก endpoint (ยกเว้น health / public) ต้องแนบ API Key ใน HTTP Header
          </p>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <pre>{`Authorization: Bearer ak88_live_xxxxxxxxxx`}</pre>
          </div>
        </section>

        {/* Endpoints by group */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-black text-[var(--navy-deep)] mb-4 border-b pb-2">
            Endpoints ทั้งหมด ({total})
          </h2>

          {API_GROUPS.map((g, gi) => (
            <div key={gi} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className={`material-symbols-outlined text-white p-1.5 rounded-lg ${g.color}`}>{g.icon}</span>
                <h3 className="font-bold text-lg text-[var(--navy-deep)]">{g.name}</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">{g.endpoints.length}</span>
              </div>
              <div className="space-y-2">
                {g.endpoints.map((e, ei) => (
                  <div key={ei} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                    <span className={`${methodColor[e.method]} text-white px-2 py-0.5 rounded text-xs font-bold shrink-0 min-w-[52px] text-center`}>
                      {e.method}
                    </span>
                    <div className="min-w-0">
                      <code className="text-sm font-mono text-[var(--navy-deep)] font-bold">/api/v1{e.path}</code>
                      <p className="text-gray-600 text-sm mt-0.5">{e.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Examples */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-black text-[var(--navy-deep)] mb-4 border-b pb-2">ตัวอย่างโค้ด</h2>

          <h3 className="font-bold text-gray-700 mb-2">cURL — ส่งโพย</h3>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto mb-6">
            <pre>{`curl -X POST "${base}/betting/bet" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"lotteryType":"หวยรัฐบาล","userId":"demo_user",
       "bets":[{"number":"123","type":"3ตัวบน","amount":100}]}'`}</pre>
          </div>

          <h3 className="font-bold text-gray-700 mb-2">Node.js (Axios) — ส่งโพย + ตรวจรางวัล</h3>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto mb-6">
            <pre>{`const axios = require('axios');
const API = '${base}';
const H = { headers: { Authorization: 'Bearer YOUR_API_KEY' } };

// ส่งโพย
await axios.post(\`\${API}/betting/bet\`, {
  lotteryType: 'หวยรัฐบาล', userId: 'demo_user',
  bets: [{ number: '123', type: '3ตัวบน', amount: 100 }]
}, H);

// ตรวจรางวัล
await axios.post(\`\${API}/results/settle\`, {
  lotteryType: 'หวยรัฐบาล',
  result: { top3: '123', top2: '23', bottom2: '45' }
}, H);

// ดูรายงาน
const rpt = await axios.get(\`\${API}/reports/summary\`, H);
console.log(rpt.data);`}</pre>
          </div>

          <h3 className="font-bold text-gray-700 mb-2">PHP (cURL) — เช็คเครดิต</h3>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
            <pre>{`<?php
$ch = curl_init("${base}/finance/balance/demo_user");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPHEADER, array("Authorization: Bearer YOUR_API_KEY"));
echo curl_exec($ch);
curl_close($ch);
?>`}</pre>
          </div>
        </section>

      </div>
    </div>
  );
}
