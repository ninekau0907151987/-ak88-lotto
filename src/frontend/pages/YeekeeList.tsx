/**
 * src/frontend/pages/YeekeeList.tsx
 * ==================================================================
 * หน้ารายการหวยจับยี่กี 88 รอบ/วัน (สด เรียลไทม์ ทำงานบน Vercel + Supabase)
 *
 * คุณสมบัติ:
 *   - 88 รอบ/วัน รอบละ 15 นาที เริ่ม 06:00 น.
 *   - นับถอยหลังปิดรับแทง
 *   - เมื่อหมดเวลา: รีโหลดหมุนวงกลม "รอผล / กำลังประมวลผล 1-2 นาที"
 *   - ตัดผลอัตโนมัติ (หรือตามที่แอดมินตั้งค่า) แล้วแสดงผล 3 ตัวบน 2 ตัวล่าง
 *   - หากกดยกเลิก: แจ้งเตือนชัดเจนว่ายกเลิกรอบ คืนเครดิตทุกโพย
 *   - มีห้องยิงเลขด่วน พร้อมรางวัลคนยิงที่ 1 (฿200) และ 16 (฿400)
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
  const [cfg, setCfg] = useState<YK.YkConfig>(YK.DEFAULT_CONFIG);

  const day = useMemo(() => YK.gameDayOf(now), [now]);
  const cur = useMemo(() => YK.currentRound(now), [now]);

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

  // ตั้งเวลาติ๊กทุก 1 วินาทีเพื่อให้อนิเมชันและนับถอยหลังลื่นไหล
  useEffect(() => {
    reloadData();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // sync ข้อมูลกับ Supabase ทุก 10 วินาที
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

  // คำนวณเวลานับถอยหลัง
  const getCountdown = useCallback((targetMs: number) => {
    const diff = targetMs - now;
    if (diff <= 0) return '00:00';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${YK.pad2(mins)}:${YK.pad2(secs)}`;
  }, [now]);

  // ยิงเลข 5 หลัก
  const handleShoot = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = shootNumber.trim().replace(/\D/g, '');
    if (clean.length !== 5) {
      alert('กรุณากรอกตัวเลขให้ครบ 5 หลัก (00000 - 99999)');
      return;
    }
    setShooting(true);
    setShootMsg(null);
    try {
      await YK.submitShoot(day, selectedRoundForShoot, clean, Date.now());
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

  // ฟิลเตอร์รอบตามแท็บ
  const filteredRounds = useMemo(() => {
    if (filterTab === 'all') return allRounds;
    if (filterTab === 'open') return allRounds.filter(r => r.phase === 'open');
    if (filterTab === 'processing') return allRounds.filter(r => r.phase === 'processing');
    if (filterTab === 'settled') return allRounds.filter(r => r.phase === 'settled' || r.phase === 'cancelled');
    return allRounds;
  }, [allRounds, filterTab]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 pb-24 font-sans">
      {/* Header */}
      <div className="bg-[#1e293b] p-3.5 flex items-center justify-between sticky top-[57px] z-40 border-b border-slate-700 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-slate-300 hover:text-white p-1 rounded-lg">
            <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <h1 className="text-white font-black text-lg tracking-tight">หวยจับยี่กี 88 รอบสด</h1>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                LIVE
              </span>
            </div>
            <div className="text-xs text-slate-400">
              งวดวันที่ {YK.dayLabel(day)} • ออกทุก 15 นาที (06:00 - 03:45 น.)
            </div>
          </div>
        </div>

        <button
          onClick={reloadData}
          className="text-slate-300 hover:text-white text-xs flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          รีเฟรช
        </button>
      </div>

      <div className="p-3 max-w-5xl mx-auto space-y-3.5">
        {/* Banner กติกา & โบนัส */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏆</span>
            <div>
              <div className="font-black text-amber-300 text-sm">สูตรยี่กีสากล: ผลรวมเลขยิงทั้งหมด − ลำดับที่ 16</div>
              <div className="text-slate-400">ปิดรับปุ๊บ ระบบรอผล 1-2 นาที แล้วออกผลอัตโนมัติทันที</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-400/20 text-amber-300 font-bold px-2.5 py-1 rounded-lg border border-amber-400/30 text-[11px]">
              คนยิงที่ 1 รับ ฿{cfg.rewardShooter1}
            </span>
            <span className="bg-purple-400/20 text-purple-300 font-bold px-2.5 py-1 rounded-lg border border-purple-400/30 text-[11px]">
              คนยิงที่ 16 รับ ฿{cfg.rewardShooter16}
            </span>
          </div>
        </div>

        {/* แถบสถิติ & สรุปสถานะ 4 ช่อง */}
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => setFilterTab('all')}
            className={`p-2.5 rounded-xl border text-center transition ${
              filterTab === 'all' ? 'bg-slate-800 border-amber-400/60 shadow-md' : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/40'
            }`}
          >
            <div className="text-xl font-black text-white">{allRounds.length}</div>
            <div className="text-[11px] text-slate-400 font-bold">ทั้งหมด 88 รอบ</div>
          </button>

          <button
            onClick={() => setFilterTab('open')}
            className={`p-2.5 rounded-xl border text-center transition ${
              filterTab === 'open' ? 'bg-emerald-950/40 border-emerald-500 shadow-md' : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/40'
            }`}
          >
            <div className="text-xl font-black text-emerald-400">{stats.openCount}</div>
            <div className="text-[11px] text-emerald-400/80 font-bold">● กำลังเปิดรับ</div>
          </button>

          <button
            onClick={() => setFilterTab('processing')}
            className={`p-2.5 rounded-xl border text-center transition ${
              filterTab === 'processing' ? 'bg-amber-950/40 border-amber-500 shadow-md' : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/40'
            }`}
          >
            <div className="text-xl font-black text-amber-400">{stats.procCount}</div>
            <div className="text-[11px] text-amber-400/80 font-bold">⏳ กำลังรอผล (1-2น.)</div>
          </button>

          <button
            onClick={() => setFilterTab('settled')}
            className={`p-2.5 rounded-xl border text-center transition ${
              filterTab === 'settled' ? 'bg-purple-950/40 border-purple-500 shadow-md' : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/40'
            }`}
          >
            <div className="text-xl font-black text-purple-400">{stats.settledCount}</div>
            <div className="text-[11px] text-purple-400/80 font-bold">✓ ออกผลแล้ว</div>
          </button>
        </div>

        {/* แผงยิงเลขด่วน (Quick Shooter) */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <span className="font-black text-white text-sm">ห้องยิงเลขจับยี่กี — ร่วมคำนวณผลรางวัล</span>
            </div>
            <span className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
              ยิงได้ไม่จำกัดครั้ง • สมาชิกแทงขั้นต่ำ ฿{cfg.rewardMinBet} ลุ้นรับโบนัสฟรี
            </span>
          </div>

          <form onSubmit={handleShoot} className="flex gap-2 flex-wrap">
            <select
              value={selectedRoundForShoot}
              onChange={e => setSelectedRoundForShoot(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 text-amber-300 font-bold text-xs px-3 py-2.5 rounded-xl outline-none focus:border-amber-400 min-w-[130px]"
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
              className="flex-1 min-w-[180px] bg-slate-950 border border-slate-700 text-white font-mono font-bold text-center text-sm px-3 py-2.5 rounded-xl outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 placeholder:text-slate-600"
            />

            <button
              type="submit"
              disabled={shooting || shootNumber.length !== 5}
              className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 active:scale-95 flex items-center gap-1.5"
            >
              {shooting ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">send</span>
                  ยิงเลข
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

        {/* ตารางแสดง 88 รอบ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredRounds.map(r => {
            const isOpen = r.phase === 'open';
            const isProc = r.phase === 'processing';
            const isSettled = r.phase === 'settled';
            const isCancelled = r.phase === 'cancelled';
            const res = r.row?.result;

            // 1) กำลังเปิดรับแทง
            if (isOpen) {
              return (
                <Link
                  key={r.n}
                  to={`/lottery/yeekee-${r.n}`}
                  className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-400 rounded-2xl p-3.5 flex flex-col items-center justify-between text-center shadow-xl shadow-amber-500/10 hover:border-white transition active:scale-95 group relative overflow-hidden"
                >
                  <div className="w-full bg-amber-400 text-slate-950 text-[10px] font-black py-0.5 rounded-full uppercase tracking-wider mb-2 animate-pulse">
                    ● เปิดรับแทงอยู่
                  </div>
                  <div>
                    <div className="font-black text-white text-2xl group-hover:text-amber-300 transition">
                      รอบที่ {r.n}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      {r.openStr} - {r.closeStr} น.
                    </div>
                    <div className="text-xs font-mono font-black text-rose-400 bg-rose-950/40 border border-rose-500/30 px-2.5 py-1 rounded-lg mt-2 inline-flex items-center gap-1">
                      <span>⏱ เหลือ</span>
                      <span>{getCountdown(r.closeMs)}</span>
                    </div>
                  </div>
                  <div className="mt-3 w-full bg-amber-400 hover:bg-amber-300 text-slate-950 py-1.5 rounded-xl text-xs font-black transition">
                    แทงหวยรอบนี้ ↗
                  </div>
                </Link>
              );
            }

            // 2) ปิดรับแล้ว → กำลังประมวลผล / รอผล (หมุนวงกลมตามที่ผู้ใช้สั่ง)
            if (isProc) {
              return (
                <div
                  key={r.n}
                  className="bg-slate-900/90 border-2 border-amber-500/80 rounded-2xl p-3.5 flex flex-col items-center justify-between text-center shadow-lg relative overflow-hidden"
                >
                  <div className="w-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold py-0.5 rounded-full mb-2">
                    ปิดรับแทงแล้ว
                  </div>
                  <div className="my-1">
                    <div className="font-black text-slate-200 text-lg">รอบที่ {r.n}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{r.openStr} - {r.closeStr}</div>

                    {/* วงกลมหมุนและสถานะรอผล 1-2 นาที */}
                    <div className="mt-2.5 flex flex-col items-center">
                      <div className="w-8 h-8 border-3 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mb-1.5" />
                      <div className="text-[11px] font-bold text-amber-300 animate-pulse">
                        ⏳ รอผลรางวัล
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        นับถอยหลัง {getCountdown(r.resultMs)}
                      </div>
                    </div>
                  </div>
                  <div className="w-full text-[10px] text-slate-400 bg-slate-800/60 py-1 rounded-lg border border-slate-700">
                    กำลังตัดรอบอัตโนมัติ...
                  </div>
                </div>
              );
            }

            // 3) ออกผลรางวัลแล้ว
            if (isSettled) {
              return (
                <div
                  key={r.n}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-between text-center hover:border-slate-700 transition"
                >
                  <div className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold py-0.5 rounded-full mb-1">
                    ✓ ออกผลแล้ว
                  </div>
                  <div className="font-bold text-slate-300 text-sm">รอบที่ {r.n}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{r.openStr} - {r.closeStr}</div>

                  <div className="my-2 w-full space-y-1">
                    <div className="flex items-center justify-between bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold">3 ตัวบน</span>
                      <span className="font-mono font-black text-rose-400 text-sm tracking-widest">
                        {res?.top3 || '---'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold">2 ตัวล่าง</span>
                      <span className="font-mono font-black text-indigo-400 text-sm tracking-widest">
                        {res?.bottom2 || '--'}
                      </span>
                    </div>
                  </div>

                  <div className="text-[9.5px] text-slate-500 font-mono">
                    5 ตัว: {res?.number || '-----'}
                  </div>
                </div>
              );
            }

            // 4) ยกเลิกรอบ
            if (isCancelled) {
              return (
                <div
                  key={r.n}
                  className="bg-red-950/20 border border-red-500/40 rounded-2xl p-3 flex flex-col items-center justify-center text-center opacity-85"
                >
                  <div className="w-full bg-red-500/20 text-red-300 text-[10px] font-bold py-0.5 rounded-full mb-1">
                    ⚠️ ยกเลิกรอบ
                  </div>
                  <div className="font-bold text-slate-300 text-sm">รอบที่ {r.n}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{r.openStr} - {r.closeStr}</div>
                  <div className="mt-2 text-[10px] text-red-400 font-bold leading-tight">
                    คืนเครดิตทุกโพยแล้ว
                  </div>
                </div>
              );
            }

            // 5) รอเปิดรับ
            return (
              <div
                key={r.n}
                className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 flex flex-col items-center justify-center text-center opacity-60"
              >
                <div className="w-full bg-slate-800 text-slate-400 text-[10px] font-bold py-0.5 rounded-full mb-1">
                  รอเปิดรับ
                </div>
                <div className="font-bold text-slate-300 text-sm">รอบที่ {r.n}</div>
                <div className="text-[10px] text-slate-500 font-mono">{r.openStr} - {r.closeStr} น.</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
