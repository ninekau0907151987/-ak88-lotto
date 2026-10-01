import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { YeekeeRound, generateDailyRounds, determineRoundStatus } from '@/shared/lib/yeekee';

/**
 * YeekeeList — หน้ารายการรอบหวยจับยี่กี 88 รอบ
 * ★ ทำงานแบบ Client-Side ได้เลย ไม่ต้องพึ่ง API Server ★
 * - ใช้ generateDailyRounds() สร้างรอบ 88 รอบ
 * - ใช้ determineRoundStatus() คำนวณสถานะรอบจากเวลาจริง
 * - ถ้ามี API ก็ sync ข้อมูลผลรางวัลเพิ่มเติม
 */
export default function YeekeeList() {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<YeekeeRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [shootNumber, setShootNumber] = useState('');
  const [selectedRoundForShoot, setSelectedRoundForShoot] = useState<number>(1);
  const [shooting, setShooting] = useState(false);
  const [shootSuccess, setShootSuccess] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // ★ สร้างรอบ 88 รอบฝั่ง Client + อัพเดทสถานะตามเวลาจริง
  const generateAndUpdateRounds = useCallback(() => {
    const now = new Date();
    setCurrentTime(now);
    const todayStr = now.toISOString().slice(0, 10);
    const baseRounds = generateDailyRounds(todayStr);

    // คำนวณสถานะแต่ละรอบตามเวลาปัจจุบัน
    const updatedRounds = baseRounds.map(r => ({
      ...r,
      status: determineRoundStatus(r, now),
    }));

    setRounds(updatedRounds);

    // เลือกรอบแรกที่เปิดอยู่สำหรับยิงเลข
    const openRound = updatedRounds.find(r => r.status === 'open');
    if (openRound) setSelectedRoundForShoot(openRound.id);

    setLoading(false);
  }, []);

  // ★ ลอง sync ผลจาก API ถ้ามี (optional — ไม่มีก็ไม่เป็นไร)
  const syncFromServer = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/yeekee/rounds');
      if (!res.ok) return;
      const json = await res.json();
      if (json?.data && Array.isArray(json.data)) {
        // merge settled results จาก server เข้ากับ client rounds
        setRounds(prev => prev.map(clientRound => {
          const serverRound = json.data.find((sr: YeekeeRound) => sr.id === clientRound.id);
          if (serverRound && serverRound.status === 'settled') {
            return { ...clientRound, ...serverRound, status: 'settled' as const };
          }
          return clientRound;
        }));
      }
    } catch {
      // ไม่มี server ก็ไม่เป็นไร — ทำงาน client-side ได้
    }
  }, []);

  useEffect(() => {
    generateAndUpdateRounds();
    syncFromServer();

    // อัพเดทสถานะทุก 10 วินาที
    const interval = setInterval(() => {
      generateAndUpdateRounds();
    }, 10_000);

    // sync จาก server ทุก 30 วินาที (ถ้ามี)
    const syncInterval = setInterval(syncFromServer, 30_000);

    return () => {
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, [generateAndUpdateRounds, syncFromServer]);

  // ★ คำนวณ countdown สำหรับรอบที่เปิดอยู่
  const getCountdown = useCallback((closeTimeStr: string) => {
    const [h, m] = closeTimeStr.split(':').map(Number);
    const now = new Date();
    const close = new Date(now);
    close.setHours(h, m, 0, 0);

    // ถ้าเวลาปิดเป็นวันรุ่งขึ้น (เช่น 00:00 - 03:45)
    if (close.getTime() < now.getTime() - 12 * 60 * 60 * 1000) {
      close.setDate(close.getDate() + 1);
    }

    const diff = close.getTime() - now.getTime();
    if (diff <= 0) return '00:00';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  // ★ นับรอบแต่ละสถานะ
  const stats = useMemo(() => {
    const open = rounds.filter(r => r.status === 'open').length;
    const settled = rounds.filter(r => r.status === 'settled').length;
    const closed = rounds.filter(r => r.status === 'closed').length;
    const waiting = rounds.filter(r => r.status === 'waiting').length;
    return { open, settled, closed, waiting };
  }, [rounds]);

  // ★ ยิงเลข 5 หลัก
  const handleShoot = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = shootNumber.trim().replace(/\D/g, '');
    if (clean.length !== 5) {
      alert('กรุณากรอกตัวเลขให้ครบ 5 หลัก');
      return;
    }
    setShooting(true);
    setShootSuccess('');
    try {
      const res = await fetch('/api/v1/yeekee/shoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: selectedRoundForShoot,
          number: clean,
          username: localStorage.getItem('username') || 'สมาชิก',
          userId: localStorage.getItem('userId') || 'guest',
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setShootSuccess(`ยิงเลข ${clean} ในรอบที่ ${selectedRoundForShoot} สำเร็จ!`);
        setShootNumber('');
        syncFromServer();
      } else {
        alert(json.message || 'เกิดข้อผิดพลาดในการยิงเลข');
      }
    } catch {
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ (ระบบยิงเลขต้องใช้เซิร์ฟเวอร์)');
    } finally {
      setShooting(false);
    }
  };

  // ★ เรียงรอบ: เปิดอยู่ก่อน → ปิดรับ(รอผล) → ออกผลแล้ว → รอเปิด
  const sortedRounds = useMemo(() => {
    const statusOrder: Record<string, number> = { open: 0, closed: 1, settled: 2, waiting: 3 };
    return [...rounds].sort((a, b) => {
      const oa = statusOrder[a.status] ?? 4;
      const ob = statusOrder[b.status] ?? 4;
      if (oa !== ob) return oa - ob;
      return a.id - b.id;
    });
  }, [rounds]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-grey-light)] flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-4xl text-[var(--gold-vibrant)] animate-spin">progress_activity</span>
          <p className="text-sm text-gray-500 mt-2">กำลังโหลดรอบยี่กี...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-grey-light)] pb-24">
      {/* Header */}
      <div className="bg-[var(--navy-deep)] p-3 flex items-center justify-between sticky top-[57px] z-40 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white flex items-center">
            <span className="material-symbols-outlined">arrow_back_ios</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--gold-vibrant)]">timer</span>
            <h1 className="text-white font-black text-lg">หวยจับยี่กี (88 รอบสด)</h1>
          </div>
        </div>
        <button onClick={generateAndUpdateRounds} className="text-white/80 hover:text-white text-xs flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded">
          <span className="material-symbols-outlined text-sm">refresh</span>
          รีเฟรช
        </button>
      </div>

      <div className="p-3 max-w-4xl mx-auto space-y-3">
        {/* Info banner */}
        <div className="bg-white p-3 rounded-xl border border-[var(--grey-border)] shadow-sm flex items-center justify-between text-xs text-[var(--navy-deep)]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--gold-vibrant)] text-lg">info</span>
            <span>ออกผลทุก 15 นาที วันละ 88 รอบ (06:00 - 03:45 น.)</span>
          </div>
          <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            สูตร: ผลรวม − ลำดับที่ 16
          </span>
        </div>

        {/* ★ สถิติรอบวันนี้ */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
            <div className="text-lg font-black text-emerald-700">{stats.open}</div>
            <div className="text-[10px] text-emerald-600 font-bold">เปิดอยู่</div>
          </div>
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-2 text-center">
            <div className="text-lg font-black text-gray-600">{stats.closed}</div>
            <div className="text-[10px] text-gray-500 font-bold">รอผล</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
            <div className="text-lg font-black text-amber-700">{stats.settled}</div>
            <div className="text-[10px] text-amber-600 font-bold">ออกผลแล้ว</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
            <div className="text-lg font-black text-blue-700">{stats.waiting}</div>
            <div className="text-[10px] text-blue-600 font-bold">รอเปิด</div>
          </div>
        </div>

        {/* Shooting panel for members */}
        <div className="bg-gradient-to-r from-[#1A2238] to-[#2A375A] p-4 rounded-xl text-white shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#F4C430]">send_and_archive</span>
              <span className="font-black text-sm">ห้องยิงเลข ลุ้นรางวัลเครดิตฟรี</span>
            </div>
            <span className="text-[11px] text-[#F4C430] bg-white/10 px-2 py-0.5 rounded">
              ยิงได้ที่ 1 รับ 200฿ • ที่ 16 รับ 400฿
            </span>
          </div>
          <form onSubmit={handleShoot} className="flex gap-2">
            <select
              value={selectedRoundForShoot}
              onChange={(e) => setSelectedRoundForShoot(Number(e.target.value))}
              className="bg-white text-[#1A2238] font-bold text-xs px-2.5 py-2 rounded-lg outline-none"
            >
              {rounds.filter(r => r.status === 'open' || r.status === 'waiting').slice(0, 10).map(r => (
                <option key={r.id} value={r.id}>รอบที่ {r.id} ({r.openTime})</option>
              ))}
              {rounds.filter(r => r.status === 'open').length === 0 && (
                <option disabled>ไม่มีรอบที่เปิดรับ</option>
              )}
            </select>
            <input
              type="text"
              maxLength={5}
              placeholder="กรอกเลข 5 หลัก (เช่น 58941)"
              value={shootNumber}
              onChange={(e) => setShootNumber(e.target.value.replace(/\D/g, ''))}
              className="flex-1 bg-white/10 border border-white/20 text-white font-mono font-bold text-center text-sm px-3 py-2 rounded-lg outline-none focus:border-[#F4C430] placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={shooting || shootNumber.length !== 5}
              className="bg-[#F4C430] hover:bg-[#d8ab28] text-[#1A2238] font-black text-xs px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {shooting ? 'กำลังส่ง...' : 'ยิงเลข'}
            </button>
          </form>
          {shootSuccess && (
            <div className="mt-2 text-xs text-emerald-400 font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              {shootSuccess}
            </div>
          )}
        </div>

        {/* 88 Rounds Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {sortedRounds.map((r) => {
            const isOpen = r.status === 'open';
            const isSettled = r.status === 'settled';
            const isClosed = r.status === 'closed';

            if (isOpen) {
              return (
                <Link
                  key={r.id}
                  to={`/lottery/yeekee-${r.id}`}
                  className="border-2 border-[var(--gold-vibrant)] bg-white rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-md relative overflow-hidden transition active:scale-95 group hover:border-[#1A2238]"
                >
                  <div className="bg-[var(--gold-vibrant)] text-[var(--navy-deep)] text-[10px] w-full py-0.5 font-black mb-1.5 rounded uppercase tracking-wider animate-pulse">
                    ● กำลังเปิดรับแทง
                  </div>
                  <div className="font-black text-[var(--navy-deep)] text-xl">รอบที่ {r.id}</div>
                  <div className="text-xs text-gray-600 font-mono mt-0.5">{r.openTime} - {r.closeTime} น.</div>
                  <div className="text-[11px] font-mono text-red-600 font-bold mt-1">
                    ⏱ เหลือ {getCountdown(r.closeTime)}
                  </div>
                  <div className="mt-2 w-full bg-[#1A2238] text-[var(--gold-vibrant)] py-1 rounded text-xs font-bold">
                    เข้าแทงรอบนี้
                  </div>
                </Link>
              );
            }

            if (isSettled) {
              return (
                <div
                  key={r.id}
                  className="border border-amber-300 bg-amber-50/40 rounded-xl p-2.5 flex flex-col items-center justify-center text-center shadow-sm"
                >
                  <div className="bg-amber-200 text-amber-900 text-[10px] w-full py-0.5 font-bold mb-1 rounded">
                    ✓ ออกผลแล้ว
                  </div>
                  <div className="font-bold text-gray-700 text-sm">รอบที่ {r.id}</div>
                  <div className="text-[10px] text-gray-500 font-mono">{r.openTime} - {r.closeTime}</div>
                  <div className="mt-1 flex items-center gap-1.5 font-mono">
                    <span className="text-sm font-black text-rose-600 bg-white px-1.5 py-0.5 rounded border border-rose-200">
                      บน: {r.result3Top || '---'}
                    </span>
                    <span className="text-sm font-black text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                      ล่าง: {r.result2Bottom || '---'}
                    </span>
                  </div>
                </div>
              );
            }

            if (isClosed) {
              return (
                <div
                  key={r.id}
                  className="border border-gray-200 bg-gray-100 rounded-xl p-2.5 flex flex-col items-center justify-center text-center opacity-70"
                >
                  <div className="bg-gray-400 text-white text-[10px] w-full py-0.5 font-bold mb-1 rounded">
                    ปิดรับแทง (รอผล)
                  </div>
                  <div className="font-bold text-gray-600 text-sm">รอบที่ {r.id}</div>
                  <div className="text-[10px] text-gray-500 font-mono">{r.openTime} - {r.closeTime}</div>
                </div>
              );
            }

            // Waiting
            return (
              <div
                key={r.id}
                className="border border-gray-200 bg-white rounded-xl p-2.5 flex flex-col items-center justify-center text-center"
              >
                <div className="bg-gray-100 text-gray-600 text-[10px] w-full py-0.5 font-bold mb-1 rounded">
                  รอเปิดรับ
                </div>
                <div className="font-bold text-gray-800 text-sm">รอบที่ {r.id}</div>
                <div className="text-[10px] text-gray-500 font-mono">{r.openTime} - {r.closeTime} น.</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
