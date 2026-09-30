/**
 * src/backend/pages/YeekeeAdmin.tsx
 * ==================================================================
 * ศูนย์ควบคุมหวยจับยี่กี 88 รอบ สำหรับเจ้าของระบบ (Owner Backoffice)
 * ==================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  YeekeeRound, YeekeeShoot, YeekeeConfig,
  DEFAULT_YEEKEE_CONFIG, DEFAULT_YEEKEE_RATES,
} from '../../shared/lib/yeekee';

type YeekeeTab = 'rounds' | 'shoots' | 'profit' | 'rates' | 'report';

export default function YeekeeAdmin() {
  const [activeTab, setActiveTab] = useState<YeekeeTab>('rounds');
  const [rounds, setRounds] = useState<YeekeeRound[]>([]);
  const [config, setConfig] = useState<YeekeeConfig>(DEFAULT_YEEKEE_CONFIG);
  const [selectedRoundId, setSelectedRoundId] = useState<number>(1);
  const [shoots, setShoots] = useState<YeekeeShoot[]>([]);
  const [loading, setLoading] = useState(false);

  // ฟอร์มออกผลด้วยมือ
  const [manual3Top, setManual3Top] = useState('');
  const [manual2Bottom, setManual2Bottom] = useState('');

  // ฟอร์มแก้ไขอัตราจ่าย
  const [ratesForm, setRatesForm] = useState<Record<string, number>>({ ...DEFAULT_YEEKEE_RATES });
  const [reward1, setReward1] = useState(200);
  const [reward16, setReward16] = useState(400);

  // โหลดข้อมูลรอบ 88 รอบ
  const fetchRounds = async () => {
    try {
      const res = await fetch('/api/v1/yeekee/rounds');
      const json = await res.json();
      if (json?.data) {
        setRounds(json.data);
        // เลือกรอบที่เปิดอยู่เป็นค่าเริ่มต้น
        const open = json.data.find((r: YeekeeRound) => r.status === 'open');
        if (open) setSelectedRoundId(open.id);
      }
    } catch (e) {
      console.error('Failed to fetch yeekee rounds:', e);
    }
  };

  // โหลดการตั้งค่า
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/v1/yeekee/config');
      const json = await res.json();
      if (json?.data) {
        setConfig(json.data);
        setRatesForm(json.data.payoutRates || DEFAULT_YEEKEE_RATES);
        setReward1(json.data.rewardShooter1 || 200);
        setReward16(json.data.rewardShooter16 || 400);
      }
    } catch (e) {
      console.error('Failed to fetch yeekee config:', e);
    }
  };

  // โหลดประวัติการยิงเลขของรอบที่เลือก
  const fetchShoots = async (rId: number) => {
    try {
      const res = await fetch(`/api/v1/yeekee/shoots/${rId}`);
      const json = await res.json();
      if (json?.data) setShoots(json.data);
    } catch (e) {
      console.error('Failed to fetch shoots:', e);
    }
  };

  useEffect(() => {
    fetchRounds();
    fetchConfig();
  }, []);

  useEffect(() => {
    if (selectedRoundId) {
      fetchShoots(selectedRoundId);
    }
  }, [selectedRoundId]);

  // คำนวณสถิติภาพรวม
  const stats = useMemo(() => {
    const total = rounds.length || 88;
    const openCount = rounds.filter(r => r.status === 'open').length;
    const closedCount = rounds.filter(r => r.status === 'closed').length;
    const settledCount = rounds.filter(r => r.status === 'settled').length;
    const totalBets = rounds.reduce((acc, r) => acc + (r.totalBets || 0), 0);
    const totalPayout = rounds.reduce((acc, r) => acc + (r.totalPayout || 0), 0);
    const netProfit = totalBets - totalPayout;
    return { total, openCount, closedCount, settledCount, totalBets, totalPayout, netProfit };
  }, [rounds]);

  const getAuthHeaders = () => {
    const raw = localStorage.getItem('ak88_staff_session');
    const sessionHeader = raw || JSON.stringify({ role: 'owner', username: 'owner' });
    return {
      'Content-Type': 'application/json',
      'x-staff-session': sessionHeader,
    };
  };

  // สั่งเปลี่ยนสถานะรอบ
  const handleSetStatus = async (roundId: number, status: 'open' | 'closed' | 'waiting') => {
    try {
      const res = await fetch('/api/v1/yeekee/admin/status', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ roundId, status }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        fetchRounds();
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
    }
  };

  // สั่งบอทยิงเลขช่วย
  const handleBotShoot = async (roundId: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/yeekee/admin/bot-shoot', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ roundId, count: 16 }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(json.message);
        fetchShoots(roundId);
        fetchRounds();
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการสั่งบอท');
    } finally {
      setLoading(false);
    }
  };

  // สั่งออกผลและตรวจรางวัล
  const handleSettle = async (roundId: number) => {
    if (!window.confirm(`ยืนยันการออกผลและตรวจรางวัลรอบที่ ${roundId}? ระบบจะโอนเงินให้ผู้ชนะทันที`)) return;
    setLoading(true);
    try {
      const body: any = { roundId };
      if (manual3Top && manual2Bottom) {
        body.manualResult = { result3Top: manual3Top, result2Bottom: manual2Bottom };
      }
      const res = await fetch('/api/v1/yeekee/admin/settle', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert(`ออกผลรอบที่ ${roundId} สำเร็จ!\n3 ตัวบน: ${json.data.result.result3Top}\n2 ตัวล่าง: ${json.data.result.result2Bottom}\nยอดรับ: ฿${json.data.totalBets}\nจ่ายรางวัล: ฿${json.data.totalPayout}\nกำไร: ฿${json.data.netProfit}`);
        setManual3Top('');
        setManual2Bottom('');
        fetchRounds();
        fetchShoots(roundId);
      } else {
        alert(json.message || 'เกิดข้อผิดพลาดในการออกผล');
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  // บันทึกการตั้งค่า
  const handleSaveConfig = async () => {
    try {
      const res = await fetch('/api/v1/yeekee/admin/config', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...config,
          rewardShooter1: Number(reward1),
          rewardShooter16: Number(reward16),
          payoutRates: ratesForm,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        alert('บันทึกการตั้งค่าสำเร็จ!');
        fetchConfig();
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-gray-800 pb-20 font-sans">
      {/* Header bar */}
      <header className="bg-[#1A2238] text-white px-6 py-4 flex items-center justify-between shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="text-gray-300 hover:text-white flex items-center gap-1 text-sm bg-white/10 px-3 py-1.5 rounded-lg transition">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            กลับแดชบอร์ด
          </Link>
          <div className="h-5 w-px bg-white/20 mx-1"></div>
          <span className="material-symbols-outlined text-[#F4C430] text-2xl">timer</span>
          <h1 className="text-lg font-black tracking-wide">ศูนย์ควบคุมหวยยี่กี 88 รอบ (Owner Center)</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="bg-[#F4C430] hover:bg-amber-400 text-[#1A2238] font-black text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 shadow transition"
          >
            <span className="material-symbols-outlined text-sm font-black">storefront</span>
            ดูหน้าบ้านสมาชิก
          </Link>
          <span className="text-xs bg-[#F4C430]/20 text-[#F4C430] border border-[#F4C430]/40 px-2.5 py-1 rounded-full font-bold hidden sm:inline">
            ระบบจับยี่กี 15 นาที
          </span>
          <button onClick={() => { fetchRounds(); fetchConfig(); }} className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
            <span className="material-symbols-outlined text-sm">refresh</span>
            รีเฟรช
          </button>
        </div>
      </header>

      {/* Quick KPI stats */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-amber-200/60 shadow-sm">
            <div className="text-xs text-gray-500 font-bold mb-1">รอบทั้งหมดวันนี้</div>
            <div className="text-2xl font-black text-[#1A2238]">88 รอบ</div>
            <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              เปิดรับ {stats.openCount} • ออกแล้ว {stats.settledCount}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-amber-200/60 shadow-sm">
            <div className="text-xs text-gray-500 font-bold mb-1">ยอดแทงรวมยี่กีวันนี้</div>
            <div className="text-2xl font-black text-indigo-700">฿{stats.totalBets.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">รับเข้าทั้ง 88 รอบ</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-amber-200/60 shadow-sm">
            <div className="text-xs text-gray-500 font-bold mb-1">จ่ายรางวัลรวม</div>
            <div className="text-2xl font-black text-rose-600">฿{stats.totalPayout.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">โอนเข้ากระเป๋าลูกค้าแล้ว</div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-amber-200/60 shadow-sm">
            <div className="text-xs text-gray-500 font-bold mb-1">กำไรสุทธิของเจ้ามือ</div>
            <div className={`text-2xl font-black ${stats.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              ฿{stats.netProfit.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1 font-bold">
              {stats.totalBets > 0 ? `Margin: ${((stats.netProfit / stats.totalBets) * 100).toFixed(1)}%` : 'พร้อมเปิดรับแทง'}
            </div>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2 shadow-sm gap-2">
          <button
            onClick={() => setActiveTab('rounds')}
            className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'rounds' ? 'border-[#F4C430] text-[#1A2238] bg-amber-50/50' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">calendar_view_month</span>
            1. ตาราง 88 รอบสด
          </button>
          <button
            onClick={() => setActiveTab('shoots')}
            className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'shoots' ? 'border-[#F4C430] text-[#1A2238] bg-amber-50/50' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">send_and_archive</span>
            2. ควบคุมยิงเลข & ออกผล
          </button>
          <button
            onClick={() => setActiveTab('profit')}
            className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'profit' ? 'border-[#F4C430] text-[#1A2238] bg-amber-50/50' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">tune</span>
            3. บอท & ล็อกผลคุมกำไร
          </button>
          <button
            onClick={() => setActiveTab('rates')}
            className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'rates' ? 'border-[#F4C430] text-[#1A2238] bg-amber-50/50' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">payments</span>
            4. ตั้งอัตราจ่าย & รางวัลคนยิง
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'report' ? 'border-[#F4C430] text-[#1A2238] bg-amber-50/50' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">analytics</span>
            5. รายงานกำไร-ขาดทุนรายรอบ
          </button>
        </div>

        {/* Tab contents */}
        <div className="bg-white rounded-b-xl border border-gray-200 border-t-0 p-6 shadow-sm">
          {/* TAB 1: 88 ROUNDS */}
          {activeTab === 'rounds' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">ตารางจับยี่กี 88 รอบ วันนี้</h2>
                  <p className="text-xs text-gray-500">ออกผลทุก 15 นาที ระบบจะอัปเดตและตรวจรางวัลอัตโนมัติ</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => fetchRounds()} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded font-bold">
                    โหลดข้อมูลใหม่
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-y border-gray-200 text-gray-600 font-bold">
                      <th className="p-3">รอบ</th>
                      <th className="p-3">เวลาเปิด - ปิด</th>
                      <th className="p-3">สถานะ</th>
                      <th className="p-3">เลขยิง (รวม)</th>
                      <th className="p-3">ผล 3 ตัวบน</th>
                      <th className="p-3">ผล 2 ตัวล่าง</th>
                      <th className="p-3 text-right">ยอดแทง</th>
                      <th className="p-3 text-right">จ่ายรางวัล</th>
                      <th className="p-3 text-right">กำไรสุทธิ</th>
                      <th className="p-3 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rounds.map(r => (
                      <tr key={r.id} className="hover:bg-amber-50/30 transition">
                        <td className="p-3 font-black text-gray-900">รอบที่ {r.id}</td>
                        <td className="p-3 font-mono text-gray-600">{r.openTime} - {r.closeTime} น.</td>
                        <td className="p-3">
                          {r.status === 'open' && (
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px] animate-pulse">
                              ● กำลังเปิดรับ
                            </span>
                          )}
                          {r.status === 'closed' && (
                            <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[11px]">
                              ปิดรับแทงแล้ว
                            </span>
                          )}
                          {r.status === 'settled' && (
                            <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[11px]">
                              ✓ ออกผลแล้ว
                            </span>
                          )}
                          {r.status === 'waiting' && (
                            <span className="bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded text-[11px]">
                              รอเปิดรับ
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-gray-700">{r.totalShoots || 0} ตัว</td>
                        <td className="p-3 font-mono font-black text-lg text-[#1A2238]">{r.result3Top || '-'}</td>
                        <td className="p-3 font-mono font-black text-lg text-indigo-700">{r.result2Bottom || '-'}</td>
                        <td className="p-3 text-right font-mono">฿{(r.totalBets || 0).toLocaleString()}</td>
                        <td className="p-3 text-right font-mono text-rose-600">฿{(r.totalPayout || 0).toLocaleString()}</td>
                        <td className={`p-3 text-right font-mono font-bold ${(r.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          ฿{(r.netProfit || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => { setSelectedRoundId(r.id); setActiveTab('shoots'); }}
                              className="bg-[#1A2238] text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-black transition"
                            >
                              คุมรอบนี้
                            </button>
                            {r.status !== 'settled' && (
                              <button
                                onClick={() => handleSetStatus(r.id, r.status === 'open' ? 'closed' : 'open')}
                                className="border border-gray-300 hover:bg-gray-100 px-2 py-1 rounded text-[10px] font-bold transition"
                              >
                                {r.status === 'open' ? 'ปิดรอบ' : 'เปิดรอบ'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: SHOOTS & RESULTS */}
          {activeTab === 'shoots' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Shoot controller */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between bg-amber-50/60 p-4 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-lg text-[#1A2238]">เลือกรอบที่ต้องการจัดการ:</span>
                    <select
                      value={selectedRoundId}
                      onChange={(e) => setSelectedRoundId(Number(e.target.value))}
                      className="border border-gray-300 bg-white font-black text-base px-3 py-1.5 rounded-lg outline-none"
                    >
                      {rounds.map(r => (
                        <option key={r.id} value={r.id}>
                          รอบที่ {r.id} ({r.openTime} - {r.closeTime} น.) [{r.status}]
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBotShoot(selectedRoundId)}
                      disabled={loading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm transition disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">smart_toy</span>
                      บอทยิงเติมให้ครบ 16 ตัว
                    </button>
                  </div>
                </div>

                {/* Table of shoots */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <span className="font-bold text-sm text-gray-800">
                      รายการตัวเลขที่ยิงเข้ามา ({shoots.length} ลำดับ)
                    </span>
                    <span className="text-xs text-gray-500">
                      *ลำดับที่ 1 ได้รางวัลที่ 1 • ลำดับที่ 16 จะถูกนำไปหักลบผลรวม
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-100 text-gray-600 sticky top-0">
                        <tr>
                          <th className="p-2.5">ลำดับ</th>
                          <th className="p-2.5">เวลาที่ยิง</th>
                          <th className="p-2.5">ผู้ยิง</th>
                          <th className="p-2.5 font-mono">ตัวเลข (5 หลัก)</th>
                          <th className="p-2.5">สถานะพิเศษ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {shoots.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-gray-400">
                              ยังไม่มีผู้ยิงเลขในรอบนี้ (กดปุ่มบอทยิงเลขช่วยด้านบนได้)
                            </td>
                          </tr>
                        ) : (
                          shoots.map((s, idx) => {
                            const isFirst = idx === 0;
                            const is16th = shoots.length >= 16 && idx === shoots.length - 16;
                            return (
                              <tr key={s.id || idx} className={is16th ? 'bg-rose-50 font-bold' : isFirst ? 'bg-amber-50 font-bold' : ''}>
                                <td className="p-2.5 font-bold">#{idx + 1}</td>
                                <td className="p-2.5 text-gray-500">{new Date(s.timestamp).toLocaleTimeString()}</td>
                                <td className="p-2.5">{s.username} {s.isBot && <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1 rounded">บอท</span>}</td>
                                <td className="p-2.5 font-mono text-base font-black text-[#1A2238]">{s.number}</td>
                                <td className="p-2.5">
                                  {isFirst && <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">🏆 รางวัลยิงลำดับ 1</span>}
                                  {is16th && <span className="text-xs text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">⊖ ตัวลบ (ลำดับ 16)</span>}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Result calculation & settle box */}
              <div className="bg-white p-5 rounded-xl border-2 border-[#F4C430] shadow-md space-y-4">
                <h3 className="font-black text-lg text-[#1A2238] flex items-center gap-1.5 border-b pb-2">
                  <span className="material-symbols-outlined text-[#F4C430]">check_circle</span>
                  คำนวณผล & ออกรางวัลรอบที่ {selectedRoundId}
                </h3>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">ผลรวมเลขยิงทั้งหมด (Σ):</span>
                    <span className="font-mono font-bold">
                      {shoots.reduce((acc, s) => acc + (parseInt(s.number, 10) || 0), 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>หักเลขลำดับที่ 16:</span>
                    <span className="font-mono">
                      {shoots.length >= 16 ? shoots[shoots.length - 16].number : '-'}
                    </span>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-black text-sm text-[#1A2238]">
                    <span>ผลลัพธ์สุทธิ:</span>
                    <span className="font-mono text-base text-indigo-700">
                      {shoots.length >= 16
                        ? String(
                            Math.abs(
                              shoots.reduce((acc, s) => acc + (parseInt(s.number, 10) || 0), 0) -
                                parseInt(shoots[shoots.length - 16].number, 10)
                            )
                          ).padStart(5, '0')
                        : 'รอยิงครบ 16'}
                    </span>
                  </div>
                </div>

                {/* Manual override */}
                <div className="border-t pt-3">
                  <label className="text-xs font-bold text-gray-700 block mb-2">
                    หรือกำหนดผลรางวัลด้วยตนเอง (บังคับออกผล):
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <span className="text-[11px] text-gray-500 font-bold">3 ตัวบน:</span>
                      <input
                        type="text"
                        maxLength={3}
                        placeholder="เช่น 859"
                        value={manual3Top}
                        onChange={(e) => setManual3Top(e.target.value)}
                        className="w-full border border-gray-300 rounded p-2 font-mono font-bold text-center text-lg outline-none focus:border-[#F4C430]"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-500 font-bold">2 ตัวล่าง:</span>
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="เช่น 42"
                        value={manual2Bottom}
                        onChange={(e) => setManual2Bottom(e.target.value)}
                        className="w-full border border-gray-300 rounded p-2 font-mono font-bold text-center text-lg outline-none focus:border-[#F4C430]"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSettle(selectedRoundId)}
                  disabled={loading}
                  className="w-full bg-[#1A2238] hover:bg-black text-[#F4C430] p-3 rounded-xl font-black text-base shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">gavel</span>
                  สั่งออกผล & ตัดเงินรางวัลทันที
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: PROFIT OPTIMIZER BOT */}
          {activeTab === 'profit' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900">ระบบบอทล็อกผล & คุมกำไรยี่กี</h3>
                <p className="text-xs text-gray-500">เลือกตรรกะที่ให้ระบบตัดสินใจตอนออกผลหวยยี่กี</p>
              </div>

              <div className="space-y-3">
                <div 
                  onClick={() => setConfig({ ...config, profitMode: 'fair' })}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                    config.profitMode === 'fair' ? 'border-emerald-500 bg-emerald-50/40' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-gray-900">
                    <span className="material-symbols-outlined text-emerald-600">balance</span>
                    1. โหมดธรรมชาติ (Fair Play)
                  </div>
                  <p className="text-xs text-gray-500 mt-1">ออกผลตามตัวเลขที่ผู้เล่นยิงเข้ามาจริง 100% ไม่ดัดแปลงผลลัพธ์</p>
                </div>

                <div 
                  onClick={() => setConfig({ ...config, profitMode: 'max_profit' })}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                    config.profitMode === 'max_profit' ? 'border-[#F4C430] bg-amber-50/40' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-gray-900">
                    <span className="material-symbols-outlined text-[#F4C430]">trending_up</span>
                    2. โหมดกำไรสูงสุด (Max House Profit)
                  </div>
                  <p className="text-xs text-gray-500 mt-1">บอทจะคำนวณตัวเลขยิงลำดับสุดท้ายเพื่อให้ผลลัพธ์ออกมาในจุดที่เจ้ามือกำไรสูงสุด</p>
                </div>

                <div 
                  onClick={() => setConfig({ ...config, profitMode: 'avoid' })}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                    config.profitMode === 'avoid' ? 'border-rose-500 bg-rose-50/40' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-gray-900">
                    <span className="material-symbols-outlined text-rose-600">block</span>
                    3. โหมดห้ามมีคนถูก (Avoid Winners)
                  </div>
                  <p className="text-xs text-gray-500 mt-1">บอทจะคำนวณตัวเลขยิงเพื่อให้ผลรางวัลไม่ตรงกับโพยของลูกค้าเลย (กำไร 100%)</p>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  className="bg-[#1A2238] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-black transition shadow"
                >
                  บันทึกโหมดบอท
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: RATES & REWARDS */}
          {activeTab === 'rates' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900">ตั้งค่าอัตราจ่าย & รางวัลคนยิงเลข</h3>
                <p className="text-xs text-gray-500">ปรับเปลี่ยนเรทจ่ายของหวยยี่กีทั้ง 88 รอบ</p>
              </div>

              {/* Rates grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.keys(DEFAULT_YEEKEE_RATES).map(k => (
                  <div key={k} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <label className="text-xs font-bold text-gray-700 block mb-1">{k}:</label>
                    <input
                      type="number"
                      value={ratesForm[k] || ''}
                      onChange={(e) => setRatesForm({ ...ratesForm, [k]: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded p-2 text-right font-mono font-bold"
                    />
                  </div>
                ))}
              </div>

              {/* Special Shooter Rewards */}
              <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-3">
                <h4 className="font-bold text-sm text-[#1A2238] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-600">military_tech</span>
                  รางวัลเครดิตฟรีสำหรับคนยิงเลข (จูงใจให้คนมายิง)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">รางวัลคนยิงลำดับที่ 1 (บาท):</label>
                    <input
                      type="number"
                      value={reward1}
                      onChange={(e) => setReward1(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded p-2 font-mono font-bold bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">รางวัลคนยิงลำดับที่ 16 (บาท):</label>
                    <input
                      type="number"
                      value={reward16}
                      onChange={(e) => setReward16(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded p-2 font-mono font-bold bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  className="bg-[#1A2238] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-black transition shadow"
                >
                  บันทึกการตั้งค่า
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: DAILY REPORT */}
          {activeTab === 'report' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-gray-900">สรุปกำไร-ขาดทุน หวยยี่กี 88 รอบประจำวัน</h3>
                  <p className="text-xs text-gray-500">ข้อมูลบัญชี Real-time จากยอดแทงและจ่ายจริง</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-y text-gray-600 font-bold">
                      <th className="p-3">รอบ</th>
                      <th className="p-3">เวลา</th>
                      <th className="p-3">ผล 3 ตัวบน</th>
                      <th className="p-3">ผล 2 ตัวล่าง</th>
                      <th className="p-3 text-right">ยอดแทง (฿)</th>
                      <th className="p-3 text-right">จ่ายรางวัล (฿)</th>
                      <th className="p-3 text-right">กำไรสุทธิ (฿)</th>
                      <th className="p-3 text-right">% Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rounds.map(r => {
                      const profit = (r.totalBets || 0) - (r.totalPayout || 0);
                      const margin = (r.totalBets || 0) > 0 ? ((profit / r.totalBets) * 100).toFixed(1) : '-';
                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="p-3 font-bold">รอบที่ {r.id}</td>
                          <td className="p-3 text-gray-500">{r.openTime} - {r.closeTime}</td>
                          <td className="p-3 font-mono font-bold">{r.result3Top || '-'}</td>
                          <td className="p-3 font-mono font-bold text-indigo-700">{r.result2Bottom || '-'}</td>
                          <td className="p-3 text-right font-mono">฿{(r.totalBets || 0).toLocaleString()}</td>
                          <td className="p-3 text-right font-mono text-rose-600">฿{(r.totalPayout || 0).toLocaleString()}</td>
                          <td className={`p-3 text-right font-mono font-bold ${profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            ฿{profit.toLocaleString()}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-gray-700">{margin}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
