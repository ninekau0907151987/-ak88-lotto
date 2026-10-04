/**
 * src/frontend/pages/YeekeeList.tsx
 * ==================================================================
 * หน้ารายการหวยจับยี่กี 88 รอบ/วัน (สด เรียลไทม์ ทำงานบน Vercel + Supabase)
 *
 * ดีไซน์ตามเรฟเป๊ะ 100% (media_1791061744923.png):
 *   - หัวตาราง: "ประจำวันที่ : 04-10-2026" (แถบสีแดงสด)
 *   - กรอบคอนเทนเนอร์: นีออนไซเบอร์บลูเรืองแสง (border-2 border-cyan-400)
 *   - การ์ด 6 คอลัมน์ (grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6)
 *   - ส่วนบนการ์ด: พื้นหลังสีฟ้าสดใส (#0070f3) + รอบที่: X + หวยยี่กี + ปิดรับ + เส้นขาวคั่น
 *   - ส่วนล่างการ์ด: พื้นหลังสีขาวล้วน + ปุ่มแดง "ยังไม่เปิดแทง" / ปุ่มเขียว "เปิดรับแทง ↗" / รอผล / ผลรางวัล
 *
 * กฎการจัดเรียงตามคำสั่งผู้ใช้:
 *   - "กำลังถึงรอบมาอยู่หน้าครับ" -> รอบที่เปิดรับแทง (open) อยู่หน้าสุด
 *   - "ออกผลแล้วให้ไปอยู่ต่อท้าย" -> รอบที่ออกผลแล้ว (settled) ไปอยู่ท้ายสุด
 *   - ดับเบิลคลิกที่การ์ดเพื่อขยายดูตารางคนยิงเลขในรอบนั้นๆ ได้ทันที
 *   - คูลดาวน์ยิงเลข 3 นาที (180 วินาที)
 * ==================================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as YK from '@/shared/lib/yeekeeEngine';

export default function YeekeeList() {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [rows, setRows] = useState<Record<number, YK.RoundRow>>({});
  const [loading, setLoading] = useState(true);
  const [shootNumber, setShootNumber] = useState('');
  const [selectedRoundForShoot, setSelectedRoundForShoot] = useState<number>(1);
  const [shooting, setShooting] = useState(false);
  const [shootMsg, setShootMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'open' | 'processing' | 'settled'>('all');
  const [sortMode, setSortMode] = useState<'smart' | 'sequential'>('smart');
  const [cfg, setCfg] = useState<YK.YkConfig>(YK.DEFAULT_CONFIG);

  // คูลดาวน์ยิงเลข 3 นาที (180 วินาที) ตามคำสั่งผู้ใช้
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Modal ดูตารางคนยิงเลขในรอบ
  const [inspectRound, setInspectRound] = useState<number | null>(null);
  const [roundShoots, setRoundShoots] = useState<YK.Shoot[]>([]);
  const [loadingShoots, setLoadingShoots] = useState(false);

  const day = useMemo(() => YK.gameDayOf(now), [now]);
  const cur = useMemo(() => YK.currentRound(now), [now]);

  // ฟอร์แมตวันที่ตามรูปเรฟ: DD-MM-YYYY (เช่น 04-10-2026)
  const formattedDate = useMemo(() => {
    if (!day || day.length !== 8) return day;
    const y = day.slice(0, 4);
    const m = day.slice(4, 6);
    const d = day.slice(6, 8);
    return `${d}-${m}-${y}`;
  }, [day]);

  // ตรวจสอบคูลดาวน์ยิงเลข
  useEffect(() => {
    const lastShootStr = localStorage.getItem('last_yeekee_shoot_ts');
    if (lastShootStr) {
      const elapsed = Math.floor((Date.now() - Number(lastShootStr)) / 1000);
      const remain = Math.max(0, 180 - elapsed);
      setCooldownRemaining(remain);
    }
  }, [now]);

  // โหลดข้อมูลรอบทั้งหมดจาก Supabase system_settings
  const reloadData = useCallback(async () => {
    try {
      const [allRows, loadedCfg] = await Promise.all([
        YK.loadRoundRows(day),
        YK.loadConfig(),
      ]);
      setRows(allRows);
      setCfg(loadedCfg);

      // เรียก sweep ตัดรอบที่ครบเวลาแบบอัตโนมัติ
      await YK.sweep(Date.now());
    } catch (e) {
      console.error('Failed to sync yeekee rows:', e);
    } finally {
      setLoading(false);
    }
  }, [day]);

  // ตั้งเวลาติ๊กทุก 1 วินาทีเพื่อให้นับถอยหลังลื่นไหล
  useEffect(() => {
    reloadData();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const sync = setInterval(reloadData, 10000);
    return () => {
      clearInterval(tick);
      clearInterval(sync);
    };
  }, [reloadData]);

  // เลือกรอบที่เปิดอยู่ปัจจุบันสำหรับการยิงเลข
  useEffect(() => {
    if (cur?.n) setSelectedRoundForShoot(cur.n);
  }, [cur?.n]);

  // คำนวณเวลานับถอยหลัง MM:SS
  const getCountdown = useCallback((targetMs: number) => {
    const diff = targetMs - now;
    if (diff <= 0) return '00:00';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${YK.pad2(mins)}:${YK.pad2(secs)}`;
  }, [now]);

  // ยิงเลข 5 หลัก พร้อมคูลดาวน์ 3 นาที
  const handleShoot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownRemaining > 0) {
      alert(`กรุณารอคูลดาวน์อีก ${cooldownRemaining} วินาที ก่อนยิงเลขครั้งถัดไป`);
      return;
    }

    const clean = shootNumber.trim().replace(/\D/g, '');
    if (clean.length !== 5) {
      alert('กรุณากรอกตัวเลขให้ครบ 5 หลัก (00000 - 99999)');
      return;
    }

    setShooting(true);
    setShootMsg(null);
    try {
      await YK.submitShoot(day, selectedRoundForShoot, clean, Date.now());
      localStorage.setItem('last_yeekee_shoot_ts', String(Date.now()));
      setCooldownRemaining(180);
      setShootMsg({ text: `ยิงเลข ${clean} ในรอบที่ ${selectedRoundForShoot} สำเร็จ! 🎯`, ok: true });
      setShootNumber('');
      reloadData();
    } catch (err: any) {
      setShootMsg({ text: err?.message || 'เกิดข้อผิดพลาดในการยิงเลข', ok: false });
    } finally {
      setShooting(false);
    }
  };

  // รวมรายการ 88 รอบ
  const allRounds = useMemo(() => {
    const list: Array<{
      n: number;
      openMs: number;
      closeMs: number;
      resultMs: number;
      openStr: string;
      closeStr: string;
      phase: YK.Phase;
      row?: YK.RoundRow;
    }> = [];

    for (let i = 1; i <= YK.ROUNDS_PER_DAY; i++) {
      const openMs = YK.openMsOf(day, i);
      const closeMs = YK.closeMsOf(day, i);
      const resultMs = YK.resultAtMs(day, i, cfg);
      const row = rows[i];
      const phase = YK.phaseOf(day, i, now, row);

      list.push({
        n: i,
        openMs,
        closeMs,
        resultMs,
        openStr: YK.hhmm(openMs),
        closeStr: YK.hhmm(closeMs),
        phase,
        row,
      });
    }

    return list;
  }, [day, now, rows, cfg]);

  // สถิติรอบ
  const stats = useMemo(() => {
    let openCount = 0;
    let procCount = 0;
    let settledCount = 0;
    let cancelledCount = 0;

    allRounds.forEach(r => {
      if (r.phase === 'open') openCount++;
      else if (r.phase === 'processing') procCount++;
      else if (r.phase === 'settled') settledCount++;
      else if (r.phase === 'cancelled') cancelledCount++;
    });

    return { openCount, procCount, settledCount, cancelledCount };
  }, [allRounds]);

  // -------------------------------------------------------------------
  // กฎการเรียงลำดับตามที่พี่สั่ง ("ออกผลแล้วให้ไปอยู่ต่อท้าย กำลังถึงรอบมาอยู่หน้าครับ"):
  // 1. กำลังถึงรอบ (open) มาอยู่หน้าสุด
  // 2. กำลังรอผล (processing) อยู่ถัดมา
  // 3. กำลังรอเปิดรับในอนาคต (waiting) เรียงรอบที่กำลังจะมาถึงก่อน (ascending)
  // 4. ออกผลแล้วให้ไปอยู่ต่อท้าย (settled / cancelled)
  // -------------------------------------------------------------------
  const sortedRounds = useMemo(() => {
    if (sortMode === 'sequential') {
      return [...allRounds].sort((a, b) => a.n - b.n);
    }

    const openList = allRounds.filter(r => r.phase === 'open');
    const procList = allRounds.filter(r => r.phase === 'processing');
    const waitList = allRounds.filter(r => r.phase === 'waiting').sort((a, b) => a.n - b.n);
    const finishedList = allRounds
      .filter(r => r.phase === 'settled' || r.phase === 'cancelled')
      .sort((a, b) => a.n - b.n);

    return [...openList, ...procList, ...waitList, ...finishedList];
  }, [allRounds, sortMode]);

  // กรองรอบตามแท็บที่เลือก
  const displayedRounds = useMemo(() => {
    if (filterTab === 'open') return sortedRounds.filter(r => r.phase === 'open');
    if (filterTab === 'processing') return sortedRounds.filter(r => r.phase === 'processing');
    if (filterTab === 'settled') return sortedRounds.filter(r => r.phase === 'settled' || r.phase === 'cancelled');
    return sortedRounds;
  }, [sortedRounds, filterTab]);

  // เปิด Modal ดูตารางคนยิงเลขในรอบ
  const handleOpenShootsModal = async (roundNum: number) => {
    setInspectRound(roundNum);
    setLoadingShoots(true);
    try {
      const list = await YK.loadShoots(day, roundNum);
      setRoundShoots(list);
    } catch (e) {
      console.error('Failed to load shoots for round:', roundNum, e);
    } finally {
      setLoadingShoots(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060c2b] text-slate-100 pb-28 font-sans">
      {/* Header บาร์บนสุด */}
      <div className="bg-[#08103a]/90 backdrop-blur-md p-3.5 flex items-center justify-between sticky top-[57px] z-40 border-b border-cyan-500/20 shadow-lg">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="text-slate-300 hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10 transition"
          >
            <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⏱️</span>
              <h1 className="text-white font-black text-lg tracking-tight">หวยจับยี่กี 88 รอบสด</h1>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                LIVE 88 รอบ
              </span>
            </div>
            <div className="text-xs text-slate-400">
              งวดวันที่ {YK.dayLabel(day)} • ออกทุก 15 นาที (06:00 - 03:45 น.)
            </div>
          </div>
        </div>

        <button
          onClick={reloadData}
          className="text-cyan-300 hover:text-white text-xs flex items-center gap-1.5 bg-blue-600/30 hover:bg-blue-600/50 px-3 py-1.5 rounded-lg border border-cyan-400/40 transition active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">sync</span>
          รีเฟรช
        </button>
      </div>

      <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4">
        {/* แบนเนอร์กติกา & โบนัสคนยิงเลข */}
        <div className="bg-gradient-to-r from-amber-500/15 via-blue-900/30 to-amber-500/10 border border-amber-400/30 rounded-2xl p-3 sm:p-4 flex items-center justify-between flex-wrap gap-2 text-xs shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏆</span>
            <div>
              <div className="font-black text-amber-300 text-sm">
                สูตรยี่กีสากล: ผลรวมเลขยิงทั้งหมด − ลำดับที่ 16 = ผลรางวัล 6 หลัก
              </div>
              <div className="text-slate-300 text-[11px] mt-0.5">
                ยิงเลข 5 หลักฟรี คูลดาวน์ 3 นาที | สมาชิกแทงขั้นต่ำ ฿{cfg.rewardMinBet} ลุ้นรับโบนัสฟรี
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-slate-950 font-black px-2.5 py-1 rounded-lg shadow text-[11px]">
              คนยิงที่ 1 รับ ฿{cfg.rewardShooter1}
            </span>
            <span className="bg-purple-600 text-white font-black px-2.5 py-1 rounded-lg shadow text-[11px]">
              คนยิงที่ 16 รับ ฿{cfg.rewardShooter16}
            </span>
          </div>
        </div>

        {/* แผงยิงเลขด่วน 5 หลัก (Quick Shooter) */}
        <div className="bg-[#08103a]/90 border border-cyan-400/40 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <span className="font-black text-white text-sm">ห้องยิงเลขจับยี่กี 5 หลัก</span>
            </div>
            {cooldownRemaining > 0 ? (
              <span className="text-[11px] font-bold text-amber-300 bg-amber-500/20 border border-amber-400/40 px-3 py-1 rounded-full animate-pulse">
                ⏱️ คูลดาวน์รออีก {cooldownRemaining} วินาที
              </span>
            ) : (
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 rounded-full">
                พร้อมยิงเลขได้ทันที
              </span>
            )}
          </div>

          <form onSubmit={handleShoot} className="flex gap-2 flex-wrap items-center">
            <select
              value={selectedRoundForShoot}
              onChange={e => setSelectedRoundForShoot(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 text-amber-300 font-bold text-xs px-3 py-2.5 rounded-xl outline-none focus:border-amber-400 min-w-[140px]"
            >
              {allRounds.filter(r => r.phase === 'open' || r.phase === 'waiting').slice(0, 10).map(r => (
                <option key={r.n} value={r.n}>
                  รอบที่ {r.n} ({r.openStr} - {r.closeStr})
                </option>
              ))}
              {allRounds.filter(r => r.phase === 'open').length === 0 && (
                <option disabled>ไม่มีรอบที่เปิดรับ</option>
              )}
            </select>

            <input
              type="text"
              maxLength={5}
              placeholder="กรอกเลข 5 หลัก เช่น 84920"
              value={shootNumber}
              onChange={e => setShootNumber(e.target.value.replace(/\D/g, ''))}
              className="flex-1 min-w-[180px] bg-slate-950 border border-slate-700 text-white font-mono font-black text-center text-base tracking-widest px-3 py-2 rounded-xl outline-none focus:border-amber-400 placeholder:text-slate-600 placeholder:text-xs placeholder:tracking-normal"
            />

            <button
              type="submit"
              disabled={shooting || shootNumber.length !== 5 || cooldownRemaining > 0}
              className="bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 active:scale-95 flex items-center gap-1.5"
            >
              {shooting ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  กำลังส่ง...
                </>
              ) : cooldownRemaining > 0 ? (
                <>
                  <span className="material-symbols-outlined text-sm">hourglass_empty</span>
                  รอ {cooldownRemaining}s
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">send</span>
                  ยิงเลข 5 หลัก
                </>
              )}
            </button>
          </form>

          {shootMsg && (
            <div className={`mt-2.5 text-xs font-bold flex items-center gap-1.5 px-3 py-2 rounded-lg ${
              shootMsg.ok ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/40' : 'bg-red-950/60 text-red-300 border border-red-600/40'
            }`}>
              <span className="material-symbols-outlined text-sm">
                {shootMsg.ok ? 'check_circle' : 'error'}
              </span>
              {shootMsg.text}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* แถบหมวดหมู่ด้านบนกล่อง (ตรงกับ LotteryList ทุกหมวด) */}
        {/* ------------------------------------------------------------------- */}
        <div className="flex items-center justify-center gap-1 overflow-x-auto pb-1 mb-0.5 z-10 relative">
          <button
            onClick={() => navigate('/lottery')}
            className="font-bold text-xs sm:text-sm px-4 py-1.5 rounded-t-lg bg-blue-600 hover:bg-blue-500 text-white border-t border-x border-blue-400 transition shadow-md whitespace-nowrap"
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => navigate('/lottery?tab=thai')}
            className="font-bold text-xs sm:text-sm px-4 py-1.5 rounded-t-lg bg-blue-600 hover:bg-blue-500 text-white border-t border-x border-blue-400 transition shadow-md whitespace-nowrap"
          >
            หวยไทย
          </button>
          <button
            onClick={() => navigate('/lottery?tab=foreign')}
            className="font-bold text-xs sm:text-sm px-4 py-1.5 rounded-t-lg bg-blue-600 hover:bg-blue-500 text-white border-t border-x border-blue-400 transition shadow-md whitespace-nowrap"
          >
            หวยต่างประเทศ
          </button>
          <button
            className="font-bold text-xs sm:text-sm px-5 py-1.5 rounded-t-lg bg-gradient-to-r from-red-600 to-rose-600 text-white font-black border-t-2 border-x-2 border-red-500 scale-105 shadow-md whitespace-nowrap"
          >
            ยี่กี
          </button>
          <button
            onClick={() => navigate('/lottery?tab=stock')}
            className="font-bold text-xs sm:text-sm px-4 py-1.5 rounded-t-lg bg-blue-600 hover:bg-blue-500 text-white border-t border-x border-blue-400 transition shadow-md whitespace-nowrap"
          >
            หุ้น
          </button>
          <button
            onClick={() => navigate('/lottery?tab=set')}
            className="font-bold text-xs sm:text-sm px-4 py-1.5 rounded-t-lg bg-blue-600 hover:bg-blue-500 text-white border-t border-x border-blue-400 transition shadow-md whitespace-nowrap"
          >
            ชุด
          </button>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* คอนเทนเนอร์หลัก: แผงกดรอบหวยยี่กี 88 รอบ ตรงตามเรฟ media_1791061744923 */}
        {/* ------------------------------------------------------------------- */}
        <div className="border-2 border-cyan-400 rounded-2xl bg-[#060c2b] shadow-[0_0_25px_rgba(0,180,216,0.38)] p-3.5 sm:p-5">
          {/* หัวกล่อง: ปุ่มรีโหลด 🔄 (ซ้าย) | "ประจำวันที่ : 04-10-2026" (กลาง) | ปุ่มย้อนกลับสีแดง (ขวา) */}
          <div className="flex items-center justify-between gap-3 mb-5 border-b border-cyan-500/20 pb-4">
            <button
              onClick={reloadData}
              className="bg-blue-600 hover:bg-blue-500 text-white w-9 h-9 rounded-lg flex items-center justify-center shadow transition active:scale-95 shrink-0"
              title="รีโหลดตารางรอบ"
            >
              <span className="material-symbols-outlined text-lg">sync</span>
            </button>

            <div className="flex items-center justify-center gap-2">
              <span className="text-white font-bold text-base sm:text-lg">ประจำวันที่ :</span>
              <span className="bg-[#e60000] text-white font-mono font-black text-sm sm:text-base px-3.5 py-1 rounded-md shadow-md shadow-red-600/40 tracking-wider">
                {formattedDate}
              </span>
            </div>

            <button
              onClick={() => navigate('/lottery')}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm px-4 py-1.5 rounded-lg shadow transition active:scale-95 shrink-0"
            >
              ย้อนกลับ
            </button>
          </div>

          {/* แถบควบคุม: ตัวกรองสถานะ (ซ้าย) และ ปุ่มสลับโหมดจัดเรียง (ขวา) */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            {/* แถบแท็บกรองสถานะ 4 ปุ่ม */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3.5 py-1.5 rounded-xl transition ${
                  filterTab === 'all' 
                    ? 'bg-blue-600 text-white font-black shadow-md' 
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                }`}
              >
                ทั้งหมด ({allRounds.length})
              </button>

              <button
                onClick={() => setFilterTab('open')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                  filterTab === 'open' 
                    ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-500/20' 
                    : 'bg-slate-900 text-emerald-400 hover:bg-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                กำลังเปิดรับ ({stats.openCount})
              </button>

              <button
                onClick={() => setFilterTab('processing')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                  filterTab === 'processing' 
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                    : 'bg-slate-900 text-amber-400 hover:bg-slate-800'
                }`}
              >
                ⏳ รอผล ({stats.procCount})
              </button>

              <button
                onClick={() => setFilterTab('settled')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                  filterTab === 'settled' 
                    ? 'bg-purple-600 text-white font-black shadow-md' 
                    : 'bg-slate-900 text-purple-400 hover:bg-slate-800'
                }`}
              >
                ✓ ออกผลแล้ว ({stats.settledCount})
              </button>
            </div>

            {/* ปุ่มสลับโหมดจัดเรียง */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">จัดเรียง:</span>
              <button
                onClick={() => setSortMode('smart')}
                className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                  sortMode === 'smart' 
                    ? 'bg-amber-400 text-slate-950 shadow-md font-black' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="กำลังถึงรอบมาอยู่หน้า ออกผลแล้วไปต่อท้าย"
              >
                <span>⚡ กำลังถึงรอบมาอยู่หน้า</span>
              </button>

              <button
                onClick={() => setSortMode('sequential')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  sortMode === 'sequential' 
                    ? 'bg-amber-400 text-slate-950 shadow-md font-black' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ลำดับรอบ 1-88
              </button>
            </div>
          </div>

          {/* คำแนะนำการดูตาราง */}
          <div className="text-[11px] text-slate-400 mb-3 flex items-center justify-between">
            <div>
              {sortMode === 'smart' ? (
                <span className="text-amber-300 font-bold">
                  * กำลังถึงรอบมาอยู่หน้า | รอบที่ออกผลแล้วเลื่อนไปอยู่ต่อท้าย
                </span>
              ) : (
                <span>เรียงตามลำดับรอบ 1 ถึง 88 ตามเวลา</span>
              )}
            </div>
            <span className="text-cyan-300 text-[10px]">
              💡 ดับเบิลคลิกที่การ์ดรอบ เพื่อดูตารางคนยิงเลข
            </span>
          </div>

          {/* ตารางการ์ด 6 คอลัมน์ ตามเรฟเป๊ะ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {displayedRounds.map(r => {
              const isOpen = r.phase === 'open';
              const isProc = r.phase === 'processing';
              const isSettled = r.phase === 'settled';
              const isCancelled = r.phase === 'cancelled';
              const res = r.row?.result;

              return (
                <div
                  key={r.n}
                  onDoubleClick={() => handleOpenShootsModal(r.n)}
                  className={`rounded-xl overflow-hidden shadow-md flex flex-col bg-white transition hover:scale-[1.02] duration-150 select-none ${
                    isOpen 
                      ? 'border-2 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]' 
                      : isProc
                      ? 'border-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                      : 'border border-blue-400/40'
                  }`}
                >
                  {/* ส่วนบน (Header การ์ด) - สีฟ้าสดใส #0070f3 พร้อมเส้นสีขาวคั่น */}
                  <div className="bg-[#0070f3] px-2.5 py-1.5 border-b border-white text-white">
                    <div className="flex items-center justify-between leading-tight">
                      <span className="text-xs sm:text-sm font-bold">รอบที่:{r.n}</span>
                      <span className="text-[11px] sm:text-xs font-bold">หวยยี่กี</span>
                    </div>

                    <div className="flex justify-end mt-1">
                      <span className="bg-[#051336] text-white text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded shadow-inner">
                        {isOpen 
                          ? `เหลือ ${getCountdown(r.closeMs)}`
                          : isProc
                          ? `รอผล 1น.`
                          : isSettled
                          ? `ออกผลแล้ว`
                          : `ปิดรับ`
                        }
                      </span>
                    </div>
                  </div>

                  {/* ส่วนล่าง (Body การ์ด) - สีขาวล้วน พร้อมปุ่มกดตรงกลางตามรูปเรฟ */}
                  <div className="bg-white p-2 sm:p-2.5 flex flex-col items-center justify-center min-h-[54px]">
                    {/* 1) ถ้ายังไม่เปิดแทง (waiting) -> ปุ่มสีแดง "ยังไม่เปิดแทง" ตามรูปเป๊ะ */}
                    {!isOpen && !isProc && !isSettled && !isCancelled && (
                      <div className="w-full flex items-center justify-center">
                        <button
                          disabled
                          className="bg-[#e60000] text-white font-bold text-xs sm:text-sm py-1 px-3 rounded shadow w-full text-center cursor-not-allowed"
                        >
                          ยังไม่เปิดแทง
                        </button>
                      </div>
                    )}

                    {/* 2) ถ้ากำลังเปิดรับแทง (open) -> ปุ่มเขียวเด่น เข้าแทงรอบนี้ได้ทันที */}
                    {isOpen && (
                      <Link
                        to={`/lottery/yeekee-${r.n}`}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm py-1.5 px-3 rounded shadow-md shadow-emerald-600/30 w-full text-center animate-pulse transition active:scale-95 flex items-center justify-center gap-1"
                      >
                        <span>เปิดรับแทง</span>
                        <span className="text-xs">↗</span>
                      </Link>
                    )}

                    {/* 3) ถ้ากำลังรอผล (processing) -> ปุ่มสีส้มกำลังรอผล */}
                    {isProc && (
                      <div className="bg-amber-500 text-slate-950 font-black text-xs sm:text-sm py-1 px-2 rounded shadow w-full text-center flex items-center justify-center gap-1 animate-pulse">
                        <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                        <span>รอผล (1น.)</span>
                      </div>
                    )}

                    {/* 4) ถ้าออกผลแล้ว (settled) -> แสดงผลเลข 3 ตัวบน และ 2 ตัวล่าง สวยงาม */}
                    {isSettled && (
                      <div className="w-full text-center">
                        <div className="text-[11px] font-black text-slate-700 flex items-center justify-center gap-2">
                          <span className="text-rose-600 font-mono text-sm sm:text-base font-black">
                            {res?.top3 || '---'}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-blue-600 font-mono text-sm sm:text-base font-black">
                            {res?.bottom2 || '--'}
                          </span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold mt-0.5">
                          3 ตัวบน | 2 ตัวล่าง
                        </div>
                      </div>
                    )}

                    {/* 5) ถ้ายกเลิกรอบ (cancelled) */}
                    {isCancelled && (
                      <div className="text-center text-[10px] text-red-600 font-bold">
                        ⚠️ ยกเลิกรอบ (คืนเงิน)
                      </div>
                    )}
                  </div>

                  {/* แถบล่างสุด: ปุ่มคลิกดูตารางคนยิงเลข */}
                  <div className="bg-slate-100 px-2 py-0.5 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
                    <span>{r.openStr} - {r.closeStr}</span>
                    <button
                      onClick={() => handleOpenShootsModal(r.n)}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
                    >
                      ตารางยิงเลข 📋
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Modal: ตารางคนยิงเลขในรอบนั้นๆ ตามคำสั่งผู้ใช้ (ดับเบิลคลิกหรือกดปุ่ม) */}
      {/* ------------------------------------------------------------------- */}
      {inspectRound !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-[#08103a] border-2 border-cyan-400 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-[0_0_35px_rgba(0,180,216,0.4)] text-white space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                <div>
                  <h3 className="text-lg font-black text-amber-300">
                    ตารางคนยิงเลข — รอบที่ {inspectRound}
                  </h3>
                  <div className="text-xs text-slate-400">
                    แสดงรายชื่อและหมายเลขที่ยิงทั้งหมดในรอบนี้
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectRound(null)}
                className="bg-red-600 hover:bg-red-700 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* เนื้อหาใน Modal */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {loadingShoots ? (
                <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-3xl animate-spin text-cyan-400">
                    progress_activity
                  </span>
                  <span>กำลังโหลดข้อมูลคนยิงเลข...</span>
                </div>
              ) : roundShoots.length === 0 ? (
                <div className="text-center py-12 text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
                  <p className="text-sm font-bold">รอบนี้ยังไม่มีผู้ยิงเลข</p>
                  <p className="text-xs text-slate-500 mt-1">
                    สามารถยิงเลข 5 หลักฟรีเพื่อร่วมคำนวณผลรางวัลได้เลยค่ะ
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-slate-300 flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-800">
                    <span>จำนวนการยิงทั้งหมด: <b>{roundShoots.length}</b> ครั้ง</span>
                    <span className="text-amber-300 font-bold">
                      ผลรวมสะสม: {roundShoots.reduce((acc, s) => acc + Number(s.number), 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-700">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">ลำดับ</th>
                          <th className="py-2.5 px-3">เวลา</th>
                          <th className="py-2.5 px-3">ผู้ใช้งาน</th>
                          <th className="py-2.5 px-3 text-right">เลข 5 หลัก</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 bg-slate-900/60 font-mono">
                        {roundShoots.map((s, idx) => {
                          const order = idx + 1;
                          const isFirst = order === 1;
                          const is16th = order === 16;

                          return (
                            <tr
                              key={s.id || idx}
                              className={`hover:bg-slate-800/40 transition ${
                                isFirst
                                  ? 'bg-amber-500/10 text-amber-300 font-bold'
                                  : is16th
                                  ? 'bg-purple-500/10 text-purple-300 font-bold'
                                  : 'text-slate-200'
                              }`}
                            >
                              <td className="py-2 px-3">
                                {order}
                                {isFirst && <span className="ml-1 text-[10px] text-amber-400">👑 (ที่ 1)</span>}
                                {is16th && <span className="ml-1 text-[10px] text-purple-400">⭐ (ที่ 16)</span>}
                              </td>
                              <td className="py-2 px-3 text-slate-400">
                                {new Date(s.ts).toLocaleTimeString('th-TH')}
                              </td>
                              <td className="py-2 px-3">
                                {s.username || (s.isBot ? 'บอทระบบ' : 'สมาชิก')}
                              </td>
                              <td className="py-2 px-3 text-right font-black text-amber-300 text-sm">
                                {s.number}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-cyan-500/20">
              <button
                onClick={() => setInspectRound(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
