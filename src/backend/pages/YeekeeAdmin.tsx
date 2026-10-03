/**
 * src/backend/pages/YeekeeAdmin.tsx
 * ==================================================================
 * ศูนย์ควบคุมหวยจับยี่กี 88 รอบ ระดับแอดมิน/เจ้าของระบบ (AK88 Lotto)
 *
 * ฟังก์ชันหลัก:
 *   1. บอทตัวที่ 1 (บอทวางเลข): เปิด/ปิด วางเลขจำลองให้อัตโนมัติ (>=16 ลำดับ)
 *   2. บอทตัวที่ 2 (บอทออกผล): 
 *      - 🚫 ห้ามมีคนถูก (Avoid - ดีดผลให้ไม่มีใครถูก)
 *      - 🛡️ กำไรสูงสุด (Max Profit)
 *      - ⚖️ คุมกำไรตามเป้า % (Balance Target)
 *      - 🎲 สุ่มยุติธรรม (Fair Random)
 *      - ดีดผลอัตโนมัติหากไม่ได้ตั้งค่าอะไรเลย
 *   3. ควบคุมรายรอบ:
 *      - กำหนดเลขที่ออกล่วงหน้า (Target Number 5 หลัก)
 *      - ออกผลเองแมนนวล (Manual Result + กด Enter ตัดผลทันที)
 *      - กดยกเลิกรอบ (คืนเงินทุกโพยอัตโนมัติ พร้อมแจ้งเตือนชัดเจน รอบถัดไปไม่พัง)
 *   4. ตาราง 88 รอบสด สถิติ ยอดแทง ยอดจ่าย กำไร และรายชื่อคนยิงเลข
 * ==================================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import * as YK from '@/shared/lib/yeekeeEngine';

export default function YeekeeAdmin() {
  const [now, setNow] = useState(Date.now());
  const [day, setDay] = useState(() => YK.gameDayOf(Date.now()));
  const [rows, setRows] = useState<Record<number, YK.RoundRow>>({});
  const [cfg, setCfg] = useState<YK.YkConfig>(YK.DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [savingCfg, setSavingCfg] = useState(false);

  // ควบคุมรอบที่เลือก
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [targetNumberInput, setTargetNumberInput] = useState('');
  const [manualNumberInput, setManualNumberInput] = useState('');
  const [cancelReasonInput, setCancelReasonInput] = useState('รอบมีปัญหาทางเทคนิค');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Modal ดูรายละเอียดคนยิง & โพย
  const [inspectRound, setInspectRound] = useState<number | null>(null);
  const [shoots, setShoots] = useState<YK.Shoot[]>([]);
  const [betSummary, setBetSummary] = useState<any>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // แจ้งเตือนแบบถี่ / Alert modal เมื่อกดยกเลิกรอบ
  const [showCancelModal, setShowCancelModal] = useState(false);

  const cur = useMemo(() => YK.currentRound(now), [now]);

  // ซิงค์ข้อมูลทั้งหมด
  const reloadData = useCallback(async () => {
    try {
      const [loadedRows, loadedCfg] = await Promise.all([
        YK.loadRoundRows(day),
        YK.loadConfig(),
      ]);
      setRows(loadedRows);
      setCfg(loadedCfg);

      // รัน sweep ตัดรอบที่ครบกำหนดในพื้นหลัง
      await YK.sweep(Date.now());
    } catch (e) {
      console.error('Failed to sync yeekee admin data:', e);
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    reloadData();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const sync = setInterval(reloadData, 8000);
    return () => {
      clearInterval(tick);
      clearInterval(sync);
    };
  }, [reloadData]);

  // ตั้งรอบปัจจุบันเป็นรอบที่เลือกโดยอัตโนมัติในครั้งแรก
  useEffect(() => {
    if (cur?.n) setSelectedRound(cur.n);
  }, [cur?.n]);

  // บันทึกการตั้งค่าบอท
  const handleSaveConfig = async (patch: Partial<YK.YkConfig>) => {
    setSavingCfg(true);
    try {
      const next = { ...cfg, ...patch };
      await YK.saveConfig(next);
      setCfg(next);
      setActionMsg({ text: 'บันทึกการตั้งค่าบอทเรียบร้อยแล้ว ✅', ok: true });
    } catch (err: any) {
      setActionMsg({ text: 'บันทึกไม่สำเร็จ: ' + err?.message, ok: false });
    } finally {
      setSavingCfg(false);
    }
  };

  // 1) กำหนดเลขที่ออกล่วงหน้า (Target Number)
  const handleSetTarget = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = targetNumberInput.trim().replace(/\D/g, '');
    if (clean.length !== 5) {
      alert('กรุณากรอกตัวเลขให้ครบ 5 หลัก');
      return;
    }
    setActionLoading(true);
    setActionMsg(null);
    try {
      await YK.setControl(day, selectedRound, { mode: 'target', number: clean, by: 'admin' });
      setActionMsg({ text: `บันทึกเลขเป้าหมายรอบ ${selectedRound} เป็น "${clean}" สำเร็จ! 🎯`, ok: true });
      setTargetNumberInput('');
      reloadData();
    } catch (err: any) {
      setActionMsg({ text: err?.message || 'เกิดข้อผิดพลาดในการตั้งเป้า', ok: false });
    } finally {
      setActionLoading(false);
    }
  };

  // 2) ออกผลเองแมนนวล (Manual Result) กด Enter แล้วตัดผลทันที
  const handleManualResult = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = manualNumberInput.trim().replace(/\D/g, '');
    if (clean.length !== 5) {
      alert('กรุณากรอกตัวเลขผลรางวัลให้ครบ 5 หลัก (เช่น 85942)');
      return;
    }
    setActionLoading(true);
    setActionMsg(null);
    try {
      const outcome = await YK.submitManualResult(day, selectedRound, clean, 'admin');
      setActionMsg({
        text: `ออกผลเองรอบที่ ${selectedRound} เป็น "${clean}" สถานะ: ${outcome === 'settled' ? 'ตัดผลและจ่ายรางวัลสำเร็จแล้ว 🏆' : 'บันทึกแล้ว รอเวลาตัดผล'}`,
        ok: true,
      });
      setManualNumberInput('');
      reloadData();
    } catch (err: any) {
      setActionMsg({ text: err?.message || 'เกิดข้อผิดพลาดในการออกผล', ok: false });
    } finally {
      setActionLoading(false);
    }
  };

  // 3) กดยกเลิกรอบ (Cancel Round) คืนเครดิตทุกโพย แจ้งเตือนถี่
  const handleCancelRound = async () => {
    setActionLoading(true);
    setActionMsg(null);
    try {
      await YK.cancelRound(day, selectedRound, cancelReasonInput || 'ยกเลิกรอบโดยผู้ดูแล');
      setShowCancelModal(false);
      setActionMsg({
        text: `⚠️ ยกเลิกรอบที่ ${selectedRound} เรียบร้อยแล้ว! ระบบคืนเครดิตให้ลูกค้าทุกโพยอัตโนมัติ (รอบถัดไปทำงานต่อได้ตามปกติ)`,
        ok: true,
      });
      reloadData();
    } catch (err: any) {
      setActionMsg({ text: err?.message || 'เกิดข้อผิดพลาดในการยกเลิกรอบ', ok: false });
    } finally {
      setActionLoading(false);
    }
  };

  // 4) บังคับตัดผลทันที (Force Settle)
  const handleForceSettle = async (n: number) => {
    if (!window.confirm(`ต้องการสั่งตัดผลรอบที่ ${n} ทันทีใช่หรือไม่?`)) return;
    setActionLoading(true);
    try {
      const outcome = await YK.settleRound(day, n, { force: true });
      setActionMsg({ text: `ตัดผลรอบที่ ${n} สำเร็จ (ผล: ${outcome}) 🏆`, ok: true });
      reloadData();
    } catch (err: any) {
      setActionMsg({ text: 'ตัดผลไม่สำเร็จ: ' + err?.message, ok: false });
    } finally {
      setActionLoading(false);
    }
  };

  // 5) สั่งบอทวางเลขรอบนี้ทันที
  const handleTriggerNumberBot = async (n: number) => {
    setActionLoading(true);
    try {
      await YK.runNumberBot(day, n, YK.closeMsOf(day, n), cfg, true);
      setActionMsg({ text: `สั่งบอทวางเลขเข้ารอบที่ ${n} สำเร็จแล้ว 🎯`, ok: true });
      reloadData();
    } catch (err: any) {
      setActionMsg({ text: 'สั่งบอทไม่สำเร็จ: ' + err?.message, ok: false });
    } finally {
      setActionLoading(false);
    }
  };

  // ดูคนยิงเลข & สถิติโพยใน Modal
  const openInspector = async (n: number) => {
    setInspectRound(n);
    setInspectLoading(true);
    try {
      const [loadedShoots, summary] = await Promise.all([
        YK.loadShoots(day, n),
        YK.roundBetSummary(day, n),
      ]);
      setShoots(loadedShoots);
      setBetSummary(summary);
    } catch (e) {
      console.error('Failed to load inspector data:', e);
    } finally {
      setInspectLoading(false);
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

  // สถิติยอดรวมทั้งวัน
  const totalStats = useMemo(() => {
    let totalBets = 0;
    let totalPayout = 0;
    let settledCount = 0;
    let openCount = 0;

    allRounds.forEach(r => {
      if (r.phase === 'open') openCount++;
      if (r.row?.stats) {
        totalBets += r.row.stats.bets || 0;
        totalPayout += r.row.stats.payout || 0;
      }
      if (r.phase === 'settled') settledCount++;
    });

    const netProfit = totalBets - totalPayout;
    return { totalBets, totalPayout, netProfit, settledCount, openCount };
  }, [allRounds]);

  const selectedRow = rows[selectedRound];
  const selectedPhase = YK.phaseOf(day, selectedRound, now, selectedRow);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 p-3 sm:p-5 font-sans pb-28">
      {/* Header Bar */}
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl transition flex items-center"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                ศูนย์ควบคุมหวยยี่กี 88 รอบ (Owner Backoffice)
              </h1>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                V2 SERVERLESS
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span>งวดวันที่: {YK.dayLabel(day)}</span>
              <span>•</span>
              <span className="font-mono text-emerald-400">
                รอบปัจจุบัน: {cur?.n ? `รอบที่ ${cur.n} (${YK.hhmm(YK.openMsOf(day, cur.n))} - ${YK.hhmm(YK.closeMsOf(day, cur.n))})` : 'ช่วงปิดพัก 04:00 - 06:00'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reloadData}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            รีเฟรชข้อมูล
          </button>
          <Link
            to="/lottery/yeekee"
            target="_blank"
            className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black px-3.5 py-2 rounded-xl transition shadow-md shadow-amber-500/20"
          >
            หน้าแทงลูกค้า ↗
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-4 mt-4">
        {/* ข้อความแจ้งเตือนความเคลื่อนไหว */}
        {actionMsg && (
          <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border animate-in fade-in duration-200 ${
            actionMsg.ok
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
              : 'bg-red-950/80 text-red-300 border-red-500/40'
          }`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">
                {actionMsg.ok ? 'check_circle' : 'warning'}
              </span>
              <span>{actionMsg.text}</span>
            </div>
            <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
        )}

        {/* แถบสรุปผลกำไร-ขาดทุนวันนี้ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-xs text-slate-400 font-bold">ยอดแทงรวมวันนี้</div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-1">
              ฿{totalStats.totalBets.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">ออกผลแล้ว {totalStats.settledCount}/88 รอบ</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-xs text-slate-400 font-bold">ยอดจ่ายรางวัลรวม</div>
            <div className="text-xl sm:text-2xl font-black text-rose-400 font-mono mt-1">
              ฿{totalStats.totalPayout.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">โอนเข้ากระเป๋าลูกค้าทันที</div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-xs text-slate-400 font-bold">กำไรสุทธิ (Profit)</div>
            <div className={`text-xl sm:text-2xl font-black font-mono mt-1 ${
              totalStats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-500'
            }`}>
              ฿{totalStats.netProfit.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {totalStats.totalBets > 0 ? `Margin: ${((totalStats.netProfit / totalStats.totalBets) * 100).toFixed(1)}%` : '0%'}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
            <div className="text-xs text-slate-400 font-bold">สถานะระบบบอท</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-3 h-3 rounded-full ${cfg.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="font-black text-white text-base">
                {cfg.enabled ? 'เปิดทำงานอัตโนมัติ' : 'ปิดการทำงาน'}
              </span>
            </div>
            <div className="text-[11px] text-amber-400 font-bold mt-0.5">
              โหมด: {cfg.resultBot.mode === 'avoid' ? '🚫 ห้ามมีคนถูก' : cfg.resultBot.mode === 'profit' ? '🛡️ กำไรสูงสุด' : cfg.resultBot.mode === 'balance' ? `⚖️ คุมกำไร ${cfg.resultBot.balancePct}%` : '🎲 สุ่มยุติธรรม'}
            </div>
          </div>
        </div>

        {/* 2 แผงหลัก: แผงตั้งค่าบอท (บอท 1 + บอท 2) & แผงสั่งการรอบ (เป้าหมาย, แมนนวล, ยกเลิก) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ========================================================= */}
          {/* แผงที่ 1: บอทตัวที่ 1 (วางเลข) & บอทตัวที่ 2 (ออกผล) */}
          {/* ========================================================= */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <div>
                  <h2 className="text-base font-black text-white">ระบบบอท 2 ตัว (บอทวางเลข & บอทออกผล)</h2>
                  <p className="text-xs text-slate-400">ควบคุมการทำงานอัตโนมัติทุก 15 นาที</p>
                </div>
              </div>
              <button
                disabled={savingCfg}
                onClick={() => handleSaveConfig({ enabled: !cfg.enabled })}
                className={`text-xs font-black px-3 py-1.5 rounded-xl border transition ${
                  cfg.enabled
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                    : 'bg-red-950 text-red-300 border-red-500'
                }`}
              >
                {cfg.enabled ? 'เปิดระบบอยู่' : 'ปิดระบบ'}
              </button>
            </div>

            {/* บอทตัวที่ 1: บอทวางเลข */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">1️⃣</span>
                  <span className="font-black text-amber-300 text-sm">บอทตัวที่ 1 — วางเลข/ยิงเลขเข้ารอบ</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cfg.numberBot.enabled}
                    onChange={e => handleSaveConfig({
                      numberBot: { ...cfg.numberBot, enabled: e.target.checked },
                    })}
                    className="w-4 h-4 rounded text-amber-400 focus:ring-0 bg-slate-900"
                  />
                  <span className="text-xs font-bold text-slate-300">เปิดบอทวางเลข</span>
                </label>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                บอทจะจำลองการยิงเลข 5 หลักเข้ารอบโดยอัตโนมัติตามช่วงเวลา เพื่อให้มีคนวางเลขครบ ≥16 ลำดับเสมอ แม้ไม่มีลูกค้าเข้ามายิง
              </p>
              <div className="flex items-center gap-3 pt-1 text-xs">
                <span className="text-slate-400 font-bold">จำนวนคนยิงต่อรอบ:</span>
                <span className="font-mono text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                  {cfg.numberBot.minShoots} - {cfg.numberBot.maxShoots} คน
                </span>
                <button
                  onClick={() => handleTriggerNumberBot(selectedRound)}
                  disabled={actionLoading}
                  className="ml-auto bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-slate-700 transition"
                >
                  🎯 ยิงเลขเข้ารอบ {selectedRound} ทันที
                </button>
              </div>
            </div>

            {/* บอทตัวที่ 2: บอทออกผล */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-base">2️⃣</span>
                <span className="font-black text-amber-300 text-sm">บอทตัวที่ 2 — กำหนดโหมดการออกผลรางวัล</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                หากหมดเวลาและไม่มีการออกผลแมนนวล ระบบจะดีดออกผลอัตโนมัติตามโหมดที่คุณเลือกด้านล่าง:
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {/* โหมด 1: ห้ามมีคนถูก */}
                <button
                  onClick={() => handleSaveConfig({ resultBot: { ...cfg.resultBot, mode: 'avoid' } })}
                  className={`p-3 rounded-xl border text-left transition ${
                    cfg.resultBot.mode === 'avoid'
                      ? 'bg-rose-950/70 border-rose-500 shadow-md shadow-rose-950/50'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="font-black text-rose-400 flex items-center gap-1.5">
                    <span>🚫 ห้ามมีคนถูก (Avoid)</span>
                  </div>
                  <div className="text-[10.5px] text-slate-400 mt-1">
                    บอทจะคำนวณและเลือกผลที่ไม่มีลูกค้าคนไหนแทงถูกเลย
                  </div>
                </button>

                {/* โหมด 2: กำไรสูงสุด */}
                <button
                  onClick={() => handleSaveConfig({ resultBot: { ...cfg.resultBot, mode: 'profit' } })}
                  className={`p-3 rounded-xl border text-left transition ${
                    cfg.resultBot.mode === 'profit'
                      ? 'bg-amber-950/70 border-amber-500 shadow-md shadow-amber-950/50'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="font-black text-amber-300 flex items-center gap-1.5">
                    <span>🛡️ กำไรสูงสุด (Profit)</span>
                  </div>
                  <div className="text-[10.5px] text-slate-400 mt-1">
                    เลือกผลรางวัลที่ทำให้เจ้ามือจ่ายน้อยที่สุด
                  </div>
                </button>

                {/* โหมด 3: คุมกำไรตามเป้า % */}
                <button
                  onClick={() => handleSaveConfig({ resultBot: { ...cfg.resultBot, mode: 'balance' } })}
                  className={`p-3 rounded-xl border text-left transition ${
                    cfg.resultBot.mode === 'balance'
                      ? 'bg-purple-950/70 border-purple-500 shadow-md shadow-purple-950/50'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="font-black text-purple-300 flex items-center gap-1.5">
                    <span>⚖️ คุมกำไรตามเป้า ({cfg.resultBot.balancePct}%)</span>
                  </div>
                  <div className="text-[10.5px] text-slate-400 mt-1">
                    รักษาอัตราจ่ายให้เฉลี่ยตามสัดส่วน % ที่ตั้งไว้
                  </div>
                </button>

                {/* โหมด 4: สุ่มยุติธรรม */}
                <button
                  onClick={() => handleSaveConfig({ resultBot: { ...cfg.resultBot, mode: 'fair' } })}
                  className={`p-3 rounded-xl border text-left transition ${
                    cfg.resultBot.mode === 'fair'
                      ? 'bg-blue-950/70 border-blue-500 shadow-md shadow-blue-950/50'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="font-black text-blue-300 flex items-center gap-1.5">
                    <span>🎲 สุ่มยุติธรรม (Fair)</span>
                  </div>
                  <div className="text-[10.5px] text-slate-400 mt-1">
                    คำนวณตามสูตรผลรวมยิงเลขจริง 100% ไม่แทรกแซง
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* แผงที่ 2: ควบคุมรอบ (กำหนดเลข, กรอกผลแมนนวล + Enter, ยกเลิกรอบ) */}
          {/* ========================================================= */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎛️</span>
                <div>
                  <h2 className="text-base font-black text-white">แผงสั่งการรอบสด — รอบที่ {selectedRound}</h2>
                  <p className="text-xs text-slate-400">
                    เวลา {YK.hhmm(YK.openMsOf(day, selectedRound))} - {YK.hhmm(YK.closeMsOf(day, selectedRound))} น. • สถานะ: <span className="font-bold text-amber-400">{selectedPhase}</span>
                  </p>
                </div>
              </div>

              {/* เลือกรอบที่ต้องการควบคุม */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">เลือกรอบ:</span>
                <select
                  value={selectedRound}
                  onChange={e => setSelectedRound(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 text-amber-300 font-bold text-xs px-2.5 py-1.5 rounded-xl outline-none"
                >
                  {allRounds.map(r => (
                    <option key={r.n} value={r.n}>
                      รอบ {r.n} ({r.openStr} - {r.closeStr}) [{r.phase}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* แสดงสถานะปัจจุบันของรอบที่เลือก */}
            {selectedRow?.result ? (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-emerald-400">✓ ออกผลแล้ว: </span>
                  <span className="font-mono text-white text-base font-black tracking-widest ml-1">
                    {selectedRow.result.number}
                  </span>
                  <span className="text-slate-400 ml-2">
                    (3บน: {selectedRow.result.top3} | 2ล่าง: {selectedRow.result.bottom2})
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  ที่มา: {selectedRow.result.source}
                </span>
              </div>
            ) : selectedRow?.status === 'cancelled' ? (
              <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-3 text-xs text-red-300 font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-base">warning</span>
                <span>รอบนี้ถูกยกเลิกแล้ว (คืนเครดิตทุกโพยเรียบร้อยแล้ว)</span>
              </div>
            ) : null}

            {/* ฟอร์ม 1: กำหนดเลขที่ออกล่วงหน้า (Target Number) */}
            <form onSubmit={handleSetTarget} className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>🎯 กำหนดเลขที่ออกล่วงหน้า (บอทจะจัดให้เลขออกตามนี้เป๊ะ)</span>
                {selectedRow?.control?.mode === 'target' && (
                  <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                    ตั้งไว้: {selectedRow.control.number}
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={5}
                  placeholder="กรอกเลข 5 หลัก เช่น 94821 แล้วกด Enter"
                  value={targetNumberInput}
                  onChange={e => setTargetNumberInput(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold text-sm px-3 py-2 rounded-xl outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={actionLoading || targetNumberInput.length !== 5}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-black px-4 py-2 rounded-xl border border-slate-700 disabled:opacity-40 transition"
                >
                  บันทึกเลขเป้าหมาย
                </button>
              </div>
            </form>

            {/* ฟอร์ม 2: ออกผลเองแมนนวล + กด Enter ตัดผลทันที */}
            <form onSubmit={handleManualResult} className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>✍️ ออกผลเองแมนนวล (กรอกเลข 5 หลัก แล้วกด Enter เพื่อตัดผลทันที)</span>
                <span className="text-[10px] text-slate-500">กด Enter ได้เลย ⏎</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={5}
                  placeholder="กรอกเลขผล 5 หลัก เช่น 12345 แล้วกด Enter"
                  value={manualNumberInput}
                  onChange={e => setManualNumberInput(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold text-sm px-3 py-2 rounded-xl outline-none focus:border-emerald-400"
                />
                <button
                  type="submit"
                  disabled={actionLoading || manualNumberInput.length !== 5}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-4 py-2 rounded-xl disabled:opacity-40 transition shadow-md shadow-emerald-600/20"
                >
                  ออกผลทันที (Enter)
                </button>
              </div>
            </form>

            {/* ฟังก์ชัน 3: กดยกเลิกรอบ & บังคับตัดผล */}
            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading || selectedRow?.status === 'settled' || selectedRow?.status === 'cancelled'}
                className="bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-700/60 text-xs font-black px-4 py-2 rounded-xl transition disabled:opacity-40 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">cancel</span>
                กดยกเลิกรอบนี้ (คืนเงินทุกโพย)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openInspector(selectedRound)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  ตรวจดูเลขยิง & โพย
                </button>

                <button
                  type="button"
                  onClick={() => handleForceSettle(selectedRound)}
                  disabled={actionLoading || selectedRow?.status === 'settled' || selectedRow?.status === 'cancelled'}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black px-3.5 py-2 rounded-xl transition disabled:opacity-40 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  ตัดผลรอบนี้ทันที
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ตารางแสดงภาพรวม 88 รอบสด */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">📋</span>
              <h2 className="text-base font-black text-white">ตารางสถานะหวยจับยี่กี 88 รอบ ประจำวัน</h2>
            </div>
            <div className="text-xs text-slate-400">
              คลิกที่แถวเพื่อเลือกรอบสั่งการ หรือคลิก "ตรวจดู" เพื่อดูคนยิงและโพย
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <th className="p-2.5 font-bold">รอบที่</th>
                  <th className="p-2.5 font-bold">เวลาเปิด - ปิด</th>
                  <th className="p-2.5 font-bold">สถานะ</th>
                  <th className="p-2.5 font-bold">ผล 5 ตัว</th>
                  <th className="p-2.5 font-bold">3 ตัวบน</th>
                  <th className="p-2.5 font-bold">2 ตัวล่าง</th>
                  <th className="p-2.5 font-bold text-right">ยอดแทง</th>
                  <th className="p-2.5 font-bold text-right">ยอดจ่าย</th>
                  <th className="p-2.5 font-bold text-right">กำไร/ขาดทุน</th>
                  <th className="p-2.5 font-bold text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allRounds.map(r => {
                  const isSelected = r.n === selectedRound;
                  const res = r.row?.result;
                  const st = r.row?.stats;
                  const profit = (st?.bets || 0) - (st?.payout || 0);

                  return (
                    <tr
                      key={r.n}
                      onClick={() => setSelectedRound(r.n)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-amber-500/10 font-medium'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="p-2.5 font-black text-white font-mono">
                        #{r.n}
                      </td>
                      <td className="p-2.5 text-slate-300 font-mono">
                        {r.openStr} - {r.closeStr}
                      </td>
                      <td className="p-2.5">
                        {r.phase === 'open' ? (
                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            เปิดรับแทง
                          </span>
                        ) : r.phase === 'processing' ? (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full border border-t-transparent border-amber-300 animate-spin" />
                            รอผล (1-2น.)
                          </span>
                        ) : r.phase === 'settled' ? (
                          <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            ✓ ออกผลแล้ว
                          </span>
                        ) : r.phase === 'cancelled' ? (
                          <span className="bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            ⚠️ ยกเลิก (คืนเงิน)
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">รอเปิด</span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-200">
                        {res?.number || '-----'}
                      </td>
                      <td className="p-2.5 font-mono font-black text-rose-400">
                        {res?.top3 || '---'}
                      </td>
                      <td className="p-2.5 font-mono font-black text-indigo-400">
                        {res?.bottom2 || '--'}
                      </td>
                      <td className="p-2.5 font-mono text-right text-slate-300">
                        {st?.bets ? `฿${st.bets.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-2.5 font-mono text-right text-rose-400">
                        {st?.payout ? `฿${st.payout.toLocaleString()}` : '-'}
                      </td>
                      <td className={`p-2.5 font-mono font-bold text-right ${
                        profit > 0 ? 'text-emerald-400' : profit < 0 ? 'text-rose-500' : 'text-slate-500'
                      }`}>
                        {st?.bets ? `฿${profit.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            openInspector(r.n);
                          }}
                          className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-[11px]"
                        >
                          ตรวจดู
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* Modal แจ้งเตือนถี่ & ยืนยันยกเลิกรอบ (Cancel Confirmation) */}
      {/* ========================================================= */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-red-500 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-400">
              <span className="material-symbols-outlined text-3xl animate-bounce">warning</span>
              <div>
                <h3 className="text-lg font-black text-white">ยืนยันการยกเลิกรอบที่ {selectedRound}?</h3>
                <p className="text-xs text-red-300">การยกเลิกจะมีผลทันทีและคืนเครดิตให้ลูกค้าทุกคน</p>
              </div>
            </div>

            {/* กล่องเตือนแบบถี่ */}
            <div className="bg-red-950/60 border border-red-500/40 p-3.5 rounded-2xl text-xs text-red-200 space-y-2 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-red-300">
                <span>⚠️ โปรดทราบข้อสำคัญ:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                <li>ทุกโพยที่แทงในรอบที่ {selectedRound} จะถูกเปลี่ยนสถานะเป็น "ยกเลิก"</li>
                <li>ยอดเงินจะถูกคืนกลับเข้ากระเป๋าของสมาชิกโดยอัตโนมัติ 100%</li>
                <li><b>รอบถัดไป (รอบที่ {selectedRound + 1}) จะยังคงเปิดรับแทงและทำงานต่อได้ตามปกติ ไม่พัง!</b></li>
              </ul>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">ระบุเหตุผลการยกเลิก (แสดงในประวัติการเงินลูกค้า):</label>
              <input
                type="text"
                value={cancelReasonInput}
                onChange={e => setCancelReasonInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={handleCancelRound}
                disabled={actionLoading}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black text-xs py-2.5 rounded-xl transition shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5"
              >
                {actionLoading ? 'กำลังยกเลิกและคืนเงิน...' : 'ยืนยันยกเลิกและคืนเงิน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* Modal ตรวจดูเลขยิง & รายการโพยของรอบ (Inspector Modal) */}
      {/* ========================================================= */}
      {inspectRound !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔍</span>
                <div>
                  <h3 className="text-base font-black text-white">
                    รายละเอียดรอบที่ {inspectRound} — คนยิงเลข & สถิติโพย
                  </h3>
                  <p className="text-xs text-slate-400">
                    เวลา {YK.hhmm(YK.openMsOf(day, inspectRound))} - {YK.hhmm(YK.closeMsOf(day, inspectRound))} น.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectRound(null)}
                className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-xl text-xs font-bold"
              >
                ✕ ปิด
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
              {inspectLoading ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  กำลังดึงข้อมูล...
                </div>
              ) : (
                <>
                  {/* การ์ดยอดแทง & ผู้ชนะโบนัส */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-slate-400 font-bold">จำนวนคนยิงทั้งหมด</div>
                      <div className="text-lg font-black text-amber-300 font-mono mt-0.5">{shoots.length} คน</div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-slate-400 font-bold">ยอดแทงรวม</div>
                      <div className="text-lg font-black text-white font-mono mt-0.5">
                        ฿{betSummary?.total ? betSummary.total.toLocaleString() : '0'}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-slate-400 font-bold">คนยิงลำดับที่ 1 (฿{cfg.rewardShooter1})</div>
                      <div className="text-xs font-black text-emerald-400 mt-0.5 truncate">
                        {shoots[0] ? `${shoots[0].username} (${shoots[0].number})` : '-'}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="text-slate-400 font-bold">ลำดับที่ 16 ตัวลบ (฿{cfg.rewardShooter16})</div>
                      <div className="text-xs font-black text-purple-400 mt-0.5 truncate">
                        {shoots.length >= 16 ? `${shoots[shoots.length - 16].username} (${shoots[shoots.length - 16].number})` : '-'}
                      </div>
                    </div>
                  </div>

                  {/* สรุปเลขยอดนิยมที่มีการแทง */}
                  {betSummary?.top && betSummary.top.length > 0 && (
                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                      <div className="text-xs font-bold text-amber-300">🔥 ตัวเลขที่สมาชิกแทงสูงสุดในรอบนี้ (Risk Overview):</div>
                      <div className="flex flex-wrap gap-2 text-xs font-mono">
                        {betSummary.top.slice(0, 10).map((t: any, idx: number) => (
                          <span key={idx} className="bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">
                            <span className="text-slate-400">{t.type}</span> <span className="font-black text-white">{t.number}</span>: <span className="text-amber-400">฿{t.amount}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ตารางคนยิงเลข */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-slate-300">ลำดับการยิงเลข 5 หลักทั้งหมด ({shoots.length} รายการ):</div>
                    <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-2xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950 text-slate-400 sticky top-0">
                          <tr>
                            <th className="p-2">ลำดับ</th>
                            <th className="p-2">ผู้ยิง</th>
                            <th className="p-2">ตัวเลข 5 หลัก</th>
                            <th className="p-2">เวลา</th>
                            <th className="p-2">หมายเหตุ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {shoots.map((s, idx) => {
                            const isFirst = idx === 0;
                            const is16th = shoots.length >= 16 && idx === shoots.length - 16;
                            return (
                              <tr key={s.id || idx} className={isFirst ? 'bg-amber-500/10' : is16th ? 'bg-purple-500/10' : ''}>
                                <td className="p-2 font-bold text-slate-400">#{idx + 1}</td>
                                <td className="p-2 font-sans font-bold text-white flex items-center gap-1.5">
                                  {s.isBot && <span className="text-[10px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded">บอท</span>}
                                  {s.username}
                                </td>
                                <td className="p-2 font-black text-amber-300 text-sm tracking-wider">{s.number}</td>
                                <td className="p-2 text-slate-500 text-[11px]">{YK.hhmmss(s.ts)}</td>
                                <td className="p-2 font-sans text-[11px]">
                                  {isFirst && <span className="text-amber-400 font-bold">🏆 ลำดับ 1 (โบนัส ฿{cfg.rewardShooter1})</span>}
                                  {is16th && <span className="text-purple-400 font-bold">🎯 ตัวลบผล (โบนัส ฿{cfg.rewardShooter16})</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
