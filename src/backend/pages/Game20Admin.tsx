/**
 * src/backend/pages/Game20Admin.tsx
 * ------------------------------------------------------------------
 * ★ หน้าจัดการหวย 20 ช่อง 6 หลัก (หลังบ้าน) ★
 *
 * แท็บ:
 *   1. ภาพรวม     — สถิติ + สถานะบอท
 *   2. บอท        — ★ เปิด/ปิดบอท 2 ตัว + เลือกโหมด/แผน
 *   3. อัตราจ่าย   — แก้ราคาจ่าย + ดู margin
 *   4. ประวัติ     — ★ ประวัติทั้งหมด + แก้ไขผล + ตรวจ checksum
 *   5. รหัส        — ★ สร้าง/แก้ไข/ลบรหัส (ล็อกผล, เปิดปิดรอบ ฯลฯ)
 *   6. กติกา       — ภาพกติกา/วิธีการเล่น (ดูตัวอย่างก่อนขึ้นจริง)
 *
 * ★ ธีมครีม (--admin-*) ตามหลังบ้านเดิม
 * ★ ใช้ API จริง: /api/v1/game20/*
 * ==================================================================
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ACTION_LABEL, ACTION_TONE, CODE_KIND_LABEL,
  filterHistory, historyStats, historyToCsv, analyzeHistory,
  type HistoryEntry, type HistoryAction, type CodeEntry, type CodeKind,
} from '../../shared/lib/game20History';
import { GUIDE_RULES, PLAY_STEPS, getPayoutTable } from '../../shared/lib/game20Guide';
import { buildFormulaSvg, buildReadingSvg } from '../../shared/lib/game20Guide';
import { DEFAULT_RESULT_BOT, DEFAULT_NUMBER_BOT } from '../../shared/lib/bots';

/* ================================================================
 * ตัวช่วย API
 * ================================================================ */

/** ★ เรียก API — คืน null ถ้าล้มเหลว (ไม่ throw ให้หน้าพัง) */
async function api<T = any>(
  path: string, opts: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; data?: T; message?: string; error?: string; status: number }> {
  const key = localStorage.getItem('ak88_api_key') || '';
  try {
    const res = await fetch(`/api/v1/game20${path}`, {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* ไม่ใช่ JSON */ }
    if (!res.ok) {
      return {
        ok: false, status: res.status,
        error: json?.message || `HTTP ${res.status}`,
        message: json?.message,
      };
    }
    return { ok: true, status: res.status, data: json?.data, message: json?.message };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message };
  }
}

/* ================================================================
 * UI ย่อย
 * ================================================================ */

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="admin-card" style={{ padding: 14, ...style }}>{children}</div>;
}

function Stat({ label, value, sub, tone = 'accent' }: {
  label: string; value: React.ReactNode; sub?: string; tone?: string;
}) {
  const TONE: Record<string, string> = {
    accent: 'var(--admin-accent)', success: '#059669', danger: '#dc2626',
    warn: '#d97706', info: '#2563eb', muted: 'var(--admin-text)',
  };
  return (
    <div className="admin-card" style={{ padding: '11px 13px' }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: 'var(--admin-text)',
        opacity: .6, textTransform: 'uppercase', letterSpacing: .4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 19, fontWeight: 800, marginTop: 3,
        color: TONE[tone] || TONE.accent,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, opacity: .65, marginTop: 1 }}>{sub}</div>
      )}
    </div>
  );
}

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  const TONE: Record<string, string> = {
    muted: 'var(--admin-subtle)|var(--admin-text)',
    success: '#ecfdf5|#065f46',
    warn: '#fffbeb|#92400e',
    danger: '#fef2f2|#991b1b',
    info: '#eff6ff|#1e40af',
    accent: 'var(--admin-accent-soft)|var(--admin-accent-dark)',
  };
  const [bg, fg] = (TONE[tone] || TONE.muted).split('|');
  return (
    <span style={{
      background: bg, color: fg, borderRadius: 999,
      padding: '2px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {children}
    </span>
  );
}

function Toggle({ on, onClick, label, sub }: {
  on: boolean; onClick: () => void; label: string; sub?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, width: '100%',
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '9px 0', textAlign: 'left',
      }}
    >
      <div style={{
        width: 46, height: 26, borderRadius: 999, flexShrink: 0,
        background: on ? 'var(--admin-accent)' : '#d6cdbd',
        position: 'relative', transition: 'background .18s',
      }}>
        <div style={{
          position: 'absolute', top: 3, left: on ? 23 : 3,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.22)', transition: 'left .18s',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--admin-text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, opacity: .68, marginTop: 1 }}>{sub}</div>}
      </div>
      <Badge tone={on ? 'success' : 'muted'}>{on ? 'เปิด' : 'ปิด'}</Badge>
    </button>
  );
}

/* ================================================================
 * หน้าหลัก
 * ================================================================ */

type Tab = 'overview' | 'bots' | 'rates' | 'history' | 'codes' | 'guide';

export default function Game20Admin() {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // ---- สถานะข้อมูล ----
  const [cfg, setCfg] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // ---- ฟอร์มบอท ----
  const [rb, setRb] = useState<any>({ ...DEFAULT_RESULT_BOT });
  const [nb, setNb] = useState<any>({ ...DEFAULT_NUMBER_BOT });

  // ---- ฟอร์มแก้ไขผล ----
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [editResult, setEditResult] = useState('');
  const [editReason, setEditReason] = useState('');

  // ---- ฟอร์มรหัส ----
  const [newCode, setNewCode] = useState({ kind: 'result_lock' as CodeKind, label: '', length: 6, maxUses: 0 });
  const [freshCode, setFreshCode] = useState<{ code: string; label: string } | null>(null);

  // ---- กรองประวัติ ----
  const [hq, setHq] = useState('');
  const [hOnlyEdits, setHOnlyEdits] = useState(false);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4200);
  };

  /* ---------------- โหลดข้อมูล ---------------- */
  const load = useCallback(async () => {
    setLoading(true);
    setApiError(null);

    const [cRes, rRes, hRes, codeRes, rateRes, sRes] = await Promise.all([
      api('/config'),
      api('/rounds?limit=100'),
      api('/history'),
      api('/codes'),
      api('/rates'),
      api('/stats'),
    ]);

    if (cRes.ok && cRes.data) {
      setCfg(cRes.data);
      if (cRes.data.resultBot) setRb({ ...DEFAULT_RESULT_BOT, ...cRes.data.resultBot });
      if (cRes.data.numberBot) setNb({ ...DEFAULT_NUMBER_BOT, ...cRes.data.numberBot });
    } else if (!cRes.ok) {
      setApiError(cRes.error || 'เรียก API ไม่ได้');
    }

    if (rRes.ok) setRounds(Array.isArray(rRes.data) ? rRes.data : []);
    if (hRes.ok) setHistory(Array.isArray(hRes.data) ? hRes.data : []);
    if (codeRes.ok) setCodes(Array.isArray(codeRes.data) ? codeRes.data : []);
    if (rateRes.ok && rateRes.data?.rates) setRates(rateRes.data.rates);
    if (sRes.ok) setStats(sRes.data);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ---------------- บันทึกบอท ---------------- */
  const saveBots = async () => {
    const res = await api('/bot/config', {
      method: 'PUT',
      body: {
        resultBot: {
          enabled: rb.enabled, mode: rb.mode,
          targetPayoutPercent: Number(rb.targetPayoutPercent),
          avoidAllWinners: rb.avoidAllWinners,
          maxPayoutPerRound: Number(rb.maxPayoutPerRound),
          candidates: Number(rb.candidates),
          naturalSpread: rb.naturalSpread,
        },
        numberBot: {
          enabled: nb.enabled, plan: nb.plan, passes: Number(nb.passes),
          crossGroup: nb.crossGroup, chunkSize: Number(nb.chunkSize),
          rotateDigits: nb.rotateDigits, digitRotations: Number(nb.digitRotations),
          randomizeEachRound: nb.randomizeEachRound,
        },
      },
    });
    if (res.ok) flash('ok', res.message || 'บันทึกค่าบอทแล้ว');
    else flash('err', res.error || 'บันทึกไม่สำเร็จ');
    if (res.ok) load();
  };

  /* ---------------- ทดลองรันบอท ---------------- */
  const [preview, setPreview] = useState<any>(null);
  const runPreview = async () => {
    const res = await api('/bot/result', {
      method: 'POST',
      body: { bets: [], mode: rb.mode, candidates: 200 },
    });
    if (res.ok) {
      setPreview(res.data);
      flash('ok', res.message || 'ทดลองรันสำเร็จ');
    } else flash('err', res.error || 'รันไม่สำเร็จ');
  };

  /* ---------------- บันทึกอัตราจ่าย ---------------- */
  const saveRates = async () => {
    const res = await api('/rates', {
      method: 'PUT',
      body: { rates: rates.map(r => ({ key: r.key, label: r.label, rate: Number(r.rate), desc: r.desc })) },
    });
    if (res.ok) {
      flash('ok', res.message || 'บันทึกอัตราจ่ายแล้ว');
      load();
    } else flash('err', res.error || 'บันทึกไม่สำเร็จ');
  };

  /* ---------------- แก้ไขผล ---------------- */
  const doEdit = async (roundId: string) => {
    if (editReason.trim().length < 3) {
      flash('err', '★ ต้องระบุเหตุผลการแก้ไขอย่างน้อย 3 ตัวอักษร');
      return;
    }
    const res = await api(`/rounds/${encodeURIComponent(roundId)}/edit`, {
      method: 'POST',
      body: { newResult: editResult, reason: editReason },
    });
    if (res.ok) {
      flash('ok', res.message || 'แก้ไขผลแล้ว');
      setEditOpen(null); setEditResult(''); setEditReason('');
      load();
    } else flash('err', res.error || 'แก้ไขไม่สำเร็จ');
  };

  /* ---------------- ล็อก / ปลดล็อก ---------------- */
  const doLock = async (roundId: string, lock: boolean) => {
    const reason = lock ? 'ล็อกจากหลังบ้าน' : window.prompt('เหตุผลการปลดล็อก:') || '';
    if (!lock && reason.trim().length < 3) { flash('err', 'ต้องระบุเหตุผล'); return; }
    const code = !lock ? window.prompt('รหัสปลดล็อก (ถ้ามี):') || '' : '';
    const res = await api(`/rounds/${encodeURIComponent(roundId)}/${lock ? 'lock' : 'unlock'}`, {
      method: 'POST', body: { reason, ...(code ? { code } : {}) },
    });
    if (res.ok) { flash('ok', res.message || 'สำเร็จ'); load(); }
    else flash('err', res.error || 'ไม่สำเร็จ');
  };

  /* ---------------- รหัส ---------------- */
  const createCode = async () => {
    if (newCode.label.trim().length < 2) { flash('err', 'ต้องระบุชื่อรหัส'); return; }
    const res = await api('/codes', { method: 'POST', body: newCode });
    if (res.ok && res.data?.code) {
      setFreshCode({ code: res.data.code, label: res.data.entry?.label || newCode.label });
      setNewCode({ kind: 'result_lock', label: '', length: 6, maxUses: 0 });
      flash('ok', 'สร้างรหัสแล้ว — จดค่ารหัสไว้');
      load();
    } else flash('err', res.error || 'สร้างไม่สำเร็จ');
  };

  const toggleCode = async (c: any) => {
    const res = await api(`/codes/${c.id}`, { method: 'PUT', body: { active: !c.active } });
    if (res.ok) { flash('ok', res.message || 'อัปเดตแล้ว'); load(); }
    else flash('err', res.error || 'อัปเดตไม่สำเร็จ');
  };

  const deleteCode = async (c: any) => {
    if (!window.confirm(`ลบรหัส "${c.label}" ?`)) return;
    const res = await api(`/codes/${c.id}`, { method: 'DELETE' });
    if (res.ok) { flash('ok', res.message || 'ลบแล้ว'); load(); }
    else flash('err', res.error || 'ลบไม่สำเร็จ');
  };

  /* ---------------- ข้อมูลที่คำนวณ ---------------- */
  const filteredHistory = useMemo(
    () => filterHistory(history, { q: hq, onlyEdits: hOnlyEdits }),
    [history, hq, hOnlyEdits],
  );
  const hStats = useMemo(() => historyStats(history), [history]);
  const roundStats = useMemo(() => analyzeHistory(rounds.map(r => ({
    roundId: r.roundId || r.id,
    result: r.result || '000000',
    closedAt: r.closedAt || '',
    totalBet: r.economics?.totalBet || 0,
    payout: r.economics?.payout || 0,
    profit: r.economics?.profit || 0,
    winCount: r.economics?.winCount || 0,
    mode: r.mode || '-',
  }))), [rounds]);

  const exportCsv = () => {
    const csv = historyToCsv(filteredHistory);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `game20-history-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    flash('ok', `ส่งออก ${filteredHistory.length} รายการ`);
  };

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: 'overview', icon: '📊', label: 'ภาพรวม' },
    { id: 'bots',     icon: '🤖', label: 'บอท' },
    { id: 'rates',    icon: '💰', label: 'อัตราจ่าย' },
    { id: 'history',  icon: '🕘', label: 'ประวัติ' },
    { id: 'codes',    icon: '🔑', label: 'รหัส' },
    { id: 'guide',    icon: '📘', label: 'กติกา' },
  ];

  /* ================================================================ */

  return (
    <div style={{
      minHeight: '100%', background: 'var(--admin-bg)',
      color: 'var(--admin-text)', paddingBottom: 40,
    }}>
      {/* ---------- หัวเรื่อง ---------- */}
      <div style={{
        padding: '16px 18px', background: 'var(--admin-card)',
        borderBottom: '1px solid var(--admin-border)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>🎲</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: -.2 }}>
              หวย {GUIDE_RULES.slotCount} ช่อง × {GUIDE_RULES.digitsPerSlot} หลัก
            </div>
            <div style={{ fontSize: 12, opacity: .7, marginTop: 1 }}>
              {GUIDE_RULES.formulaShort}
            </div>
          </div>
          <button className="bet-btn" onClick={load} disabled={loading}>
            {loading ? '⏳ กำลังโหลด' : '🔄 รีเฟรช'}
          </button>
        </div>

        {/* แท็บ */}
        {apiError && (
          <div className="bet-note bet-note--warn" style={{ marginTop: 11 }}>
            <span>⚠️</span>
            <div style={{ flex: 1 }}>
              <b>เรียก API ไม่ได้:</b> {apiError}
              <div style={{ marginTop: 3, fontSize: 11.5 }}>
                ต้องตั้ง API Key ใน localStorage (<code>ak88_api_key</code>) และต้อง deploy Firestore Rules
              </div>
            </div>
          </div>
        )}

        <div className="bet-tabs" style={{ marginTop: 11, marginBottom: -14 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`bet-tabs__item${tab === t.id ? ' bet-tabs__item--active' : ''}`}
            >
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: .14 }}
          >

            {/* ================= ภาพรวม ================= */}
            {tab === 'overview' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{
                  display: 'grid', gap: 10,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                }}>
                  <Stat label="รอบที่ออกแล้ว" value={roundStats.count.toLocaleString()} />
                  <Stat label="ยอดรับรวม" value={`฿${roundStats.totalBet.toLocaleString()}`} tone="info" />
                  <Stat label="จ่ายรวม" value={`฿${roundStats.totalPayout.toLocaleString()}`} tone="warn" />
                  <Stat
                    label="กำไร"
                    value={`฿${roundStats.profit.toLocaleString()}`}
                    sub={`${roundStats.profitPercent.toFixed(1)}%`}
                    tone={roundStats.profit >= 0 ? 'success' : 'danger'}
                  />
                  <Stat
                    label="รอบมีผู้ชนะ"
                    value={`${roundStats.winRate.toFixed(0)}%`}
                    sub={`สตรีคไม่มีผู้ชนะ ${roundStats.streak} รอบ`}
                    tone="accent"
                  />
                </div>

                <Card>
                  <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 10 }}>
                    สถานะบอท
                  </div>
                  {!cfg ? (
                    <div style={{ fontSize: 12.5, opacity: .7 }}>กำลังโหลด…</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 9 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 11px', background: 'var(--admin-subtle)',
                        borderRadius: 9, flexWrap: 'wrap',
                      }}>
                        <span style={{ fontSize: 15 }}>🤖</span>
                        <div style={{ flex: 1, minWidth: 150 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700 }}>บอทออกผล</div>
                          <div style={{ fontSize: 11.5, opacity: .7 }}>
                            โหมด: {cfg.resultBot?.mode || '-'}
                          </div>
                        </div>
                        <Badge tone={cfg.resultBot?.enabled ? 'success' : 'muted'}>
                          {cfg.resultBot?.enabled ? 'เปิด' : 'ปิด'}
                        </Badge>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 11px', background: 'var(--admin-subtle)',
                        borderRadius: 9, flexWrap: 'wrap',
                      }}>
                        <span style={{ fontSize: 15 }}>🔀</span>
                        <div style={{ flex: 1, minWidth: 150 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700 }}>บอทวางเลข</div>
                          <div style={{ fontSize: 11.5, opacity: .7 }}>
                            แผน: {cfg.numberBot?.plan || '-'} • สุ่มทุกรอบ: {cfg.numberBot?.randomizeEachRound ? 'ใช่' : 'ไม่'}
                          </div>
                        </div>
                        <Badge tone={cfg.numberBot?.enabled ? 'success' : 'muted'}>
                          {cfg.numberBot?.enabled ? 'เปิด' : 'ปิด'}
                        </Badge>
                      </div>
                    </div>
                  )}
                </Card>

                {history.length > 0 && (
                  <Card>
                    <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 9 }}>
                      ประวัติล่าสุด
                    </div>
                    <div style={{ display: 'grid', gap: 0 }}>
                      {history.slice(0, 8).map(h => (
                        <div key={h.id} style={{
                          display: 'flex', alignItems: 'center', gap: 9,
                          padding: '8px 0', borderBottom: '1px solid var(--admin-border)',
                          flexWrap: 'wrap',
                        }}>
                          <Badge tone={ACTION_TONE[h.action] || 'muted'}>
                            {ACTION_LABEL[h.action] || h.action}
                          </Badge>
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                            {h.roundId}
                          </span>
                          {h.resultBefore && h.resultAfter && (
                            <span style={{ fontSize: 12, opacity: .8 }}>
                              {h.resultBefore} → <b>{h.resultAfter}</b>
                            </span>
                          )}
                          <span style={{ flex: 1 }} />
                          <span style={{ fontSize: 11, opacity: .6 }}>{h.actor}</span>
                          <span style={{ fontSize: 11, opacity: .55 }}>
                            {new Date(h.at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ================= บอท ================= */}
            {tab === 'bots' && (
              <div style={{ display: 'grid', gap: 12 }}>
                {/* ---- บอทออกผล ---- */}
                <Card>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 17 }}>🤖</span>
                    <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>
                      บอทออกผล (ตอนปิดรอบ)
                    </div>
                    <Badge tone={rb.enabled ? 'success' : 'muted'}>{rb.enabled ? 'เปิด' : 'ปิด'}</Badge>
                  </div>
                  <div style={{ fontSize: 11.5, opacity: .72, marginBottom: 8, lineHeight: 1.6 }}>
                    วางเลข {GUIDE_RULES.slotCount} ช่องจำลอง เพื่อให้ได้ผลตามที่เลือก
                  </div>

                  <Toggle
                    on={rb.enabled}
                    onClick={() => setRb({ ...rb, enabled: !rb.enabled })}
                    label="เปิดใช้บอทออกผล"
                    sub={!rb.enabled ? 'ปิดอยู่ = ระบบจะสุ่มผลบริสุทธิ์' : 'ทำงานตอนปิดรอบ'}
                  />

                  <div style={{ marginTop: 11 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 7 }}>
                      โหมดเลือกผลลัพธ์
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {[
                        { k: 'fair',    l: 'ยุติธรรม',         d: 'สุ่มบริสุทธิ์ ไม่แทรกแซงผล' },
                        { k: 'profit',  l: 'กำไรสูงสุด',       d: 'เลือกผลที่เจ้ามือกำไรสูงสุด' },
                        { k: 'balance', l: 'คุมกำไรตามเป้า',   d: 'เลือกผลให้จ่ายใกล้ % ที่ตั้ง' },
                        { k: 'avoid',   l: 'ห้ามมีคนถูก',     d: 'เลี่ยงผลที่มีผู้ชนะ (ถ้าเลี่ยงได้)' },
                        { k: 'target',  l: 'ตั้งผลเอง',        d: 'กำหนดผลลัพธ์ด้วยมือ' },
                      ].map(m => (
                        <button
                          key={m.k}
                          onClick={() => setRb({ ...rb, mode: m.k })}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 9,
                            padding: '9px 11px', textAlign: 'left', cursor: 'pointer',
                            background: rb.mode === m.k ? 'var(--admin-accent-soft)' : 'transparent',
                            border: `1.5px solid ${rb.mode === m.k ? 'var(--admin-accent)' : 'var(--admin-border)'}`,
                            borderRadius: 9,
                          }}
                        >
                          <div style={{
                            width: 15, height: 15, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                            border: `2px solid ${rb.mode === m.k ? 'var(--admin-accent)' : '#c9bfae'}`,
                            background: rb.mode === m.k ? 'var(--admin-accent)' : 'transparent',
                            boxShadow: rb.mode === m.k ? 'inset 0 0 0 2.5px var(--admin-card)' : 'none',
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{m.l}</div>
                            <div style={{ fontSize: 11, opacity: .7, marginTop: 1 }}>{m.d}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* พารามิเตอร์ */}
                  <div style={{
                    display: 'grid', gap: 11, marginTop: 13,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  }}>
                    {rb.mode === 'balance' && (
                      <label>
                        <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
                          เป้า % ของยอดรับ
                        </div>
                        <input
                          type="number" className="bet-input" min={0} max={100}
                          value={rb.targetPayoutPercent}
                          onChange={e => setRb({ ...rb, targetPayoutPercent: e.target.value })}
                        />
                        <div style={{ fontSize: 10.5, opacity: .62, marginTop: 3 }}>
                          ยิ่งต่ำ เจ้ามือยิ่งได้
                        </div>
                      </label>
                    )}
                    <label>
                      <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
                        เพดานจ่ายต่อรอบ (฿)
                      </div>
                      <input
                        type="number" className="bet-input" min={0} step={1000}
                        value={rb.maxPayoutPerRound}
                        onChange={e => setRb({ ...rb, maxPayoutPerRound: e.target.value })}
                      />
                    </label>
                    <label>
                      <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
                        จำนวนผลที่พิจารณา
                      </div>
                      <input
                        type="number" className="bet-input" min={20} max={5000} step={50}
                        value={rb.candidates}
                        onChange={e => setRb({ ...rb, candidates: e.target.value })}
                      />
                      <div style={{ fontSize: 10.5, opacity: .62, marginTop: 3 }}>
                        สูง = ค้นหาดีขึ้น แต่ช้าลง
                      </div>
                    </label>
                  </div>

                  <div style={{ marginTop: 11 }}>
                    <Toggle
                      on={rb.avoidAllWinners}
                      onClick={() => setRb({ ...rb, avoidAllWinners: !rb.avoidAllWinners })}
                      label="ห้ามมีคนถูกเสมอ"
                      sub="ใช้ร่วมกับทุกโหมด — ถ้าเลี่ยงไม่ได้ระบบจะเตือน"
                    />
                    <Toggle
                      on={rb.naturalSpread}
                      onClick={() => setRb({ ...rb, naturalSpread: !rb.naturalSpread })}
                      label="กระจายเลขทุกช่อง"
                      sub="เปิด = ดูเป็นธรรมชาติ ไม่ทิ้งร่องรอย"
                    />
                  </div>
                </Card>

                {/* ---- บอทวางเลข ---- */}
                <Card>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 17 }}>🔀</span>
                    <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>
                      บอทวางเลข (สลับคนไปมา)
                    </div>
                    <Badge tone={nb.enabled ? 'success' : 'muted'}>{nb.enabled ? 'เปิด' : 'ปิด'}</Badge>
                  </div>
                  <div style={{ fontSize: 11.5, opacity: .72, marginBottom: 8, lineHeight: 1.6 }}>
                    สลับเลขของผู้เล่นไปมา + สุ่มพารามิเตอร์ทุกรอบ เพื่อไม่ให้จับทางได้
                  </div>

                  <Toggle
                    on={nb.enabled}
                    onClick={() => setNb({ ...nb, enabled: !nb.enabled })}
                    label="เปิดใช้บอทวางเลข"
                    sub="ทำงานตอนปิดรอบ ก่อนบอทออกผล"
                  />

                  <div style={{ marginTop: 11 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 7 }}>แผนสลับ</div>
                    <div style={{
                      display: 'grid', gap: 6,
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    }}>
                      {[
                        { k: 'random',  l: 'สุ่มผสม',      d: 'ยากต่อการจับทางที่สุด' },
                        { k: 'shuffle', l: 'สับทั้งชุด',    d: 'Fisher-Yates' },
                        { k: 'rotate',  l: 'หมุนวงกลม',    d: 'ได้เลขคนถัดไป' },
                        { k: 'mirror',  l: 'กลับด้าน',      d: 'แรกสลับกับสุดท้าย' },
                        { k: 'chunk',   l: 'แบ่งกลุ่ม',      d: 'สลับในกลุ่ม' },
                        { k: 'cross',   l: 'ข้ามครึ่ง',      d: 'บนสลับกับล่าง' },
                      ].map(p => (
                        <button
                          key={p.k}
                          onClick={() => setNb({ ...nb, plan: p.k })}
                          style={{
                            padding: '9px 11px', textAlign: 'left', cursor: 'pointer',
                            background: nb.plan === p.k ? 'var(--admin-accent-soft)' : 'transparent',
                            border: `1.5px solid ${nb.plan === p.k ? 'var(--admin-accent)' : 'var(--admin-border)'}`,
                            borderRadius: 9,
                          }}
                        >
                          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{p.l}</div>
                          <div style={{ fontSize: 10.5, opacity: .68, marginTop: 1 }}>{p.d}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 11 }}>
                    <Toggle
                      on={nb.randomizeEachRound}
                      onClick={() => setNb({ ...nb, randomizeEachRound: !nb.randomizeEachRound })}
                      label="★ สุ่มแผน/พารามิเตอร์ใหม่ทุกรอบ"
                      sub="แนะนำเปิด — ทำให้จับทางไม่ได้"
                    />
                    <Toggle
                      on={nb.crossGroup}
                      onClick={() => setNb({ ...nb, crossGroup: !nb.crossGroup })}
                      label="สลับข้ามกลุ่ม"
                      sub="ไม่จำกัดแค่ในกลุ่มเดียวกัน"
                    />
                    <Toggle
                      on={nb.rotateDigits}
                      onClick={() => setNb({ ...nb, rotateDigits: !nb.rotateDigits })}
                      label="หมุนหลักในตัวเลขด้วย"
                      sub="เพิ่มความซับซ้อนอีกระดับ"
                    />
                  </div>

                  <div style={{ marginTop: 11, maxWidth: 220 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
                      จำนวนรอบสลับ (สูงสุด)
                    </div>
                    <input
                      type="number" className="bet-input" min={1} max={8}
                      value={nb.passes}
                      onChange={e => setNb({ ...nb, passes: e.target.value })}
                    />
                  </div>
                </Card>

                {/* ---- ปุ่มบันทึก + ทดลอง ---- */}
                <Card>
                  <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    <button className="bet-btn bet-btn--primary" onClick={saveBots}>
                      💾 บันทึกค่าบอท
                    </button>
                    <button className="bet-btn" onClick={runPreview}>👁️ ทดลองรันบอทออกผล</button>
                  </div>

                  {preview && (
                    <div style={{
                      marginTop: 12, padding: 12, background: 'var(--admin-subtle)',
                      borderRadius: 9, border: '1px solid var(--admin-border)',
                    }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 7 }}>
                        ผลทดลองรัน
                      </div>
                      <div style={{
                        display: 'grid', gap: 8,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                      }}>
                        <div>
                          <div style={{ fontSize: 10.5, opacity: .62 }}>ผลที่เลือก</div>
                          <div style={{
                            fontSize: 20, fontWeight: 800, fontFamily: 'monospace',
                            color: 'var(--admin-accent-dark)',
                          }}>
                            {preview.result}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, opacity: .62 }}>ตรวจสอบ</div>
                          <div style={{ marginTop: 3 }}>
                            <Badge tone={preview.verified ? 'success' : 'danger'}>
                              {preview.verified ? '✓ เลขตรงกับผล' : '✗ ไม่ตรง'}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10.5, opacity: .62 }}>พิจารณา</div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>
                            {preview.examined?.toLocaleString()} ผล
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11.5, marginTop: 8, opacity: .8 }}>
                        {preview.reason}
                      </div>
                      {preview.formula && (
                        <div style={{
                          fontSize: 11, fontFamily: 'monospace', marginTop: 6,
                          opacity: .72, lineHeight: 1.6,
                        }}>
                          Σ {preview.formula.sum?.toLocaleString()} − ช่อง{preview.formula.subtractSlot} ={' '}
                          {preview.formula.raw?.toLocaleString()} mod {preview.formula.mod?.toLocaleString()} ={' '}
                          <b>{preview.result}</b>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ================= อัตราจ่าย ================= */}
            {tab === 'rates' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <Card>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 17 }}>💰</span>
                    <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>
                      ตารางอัตราจ่าย
                    </div>
                    <button className="bet-btn bet-btn--primary" onClick={saveRates}>
                      💾 บันทึก
                    </button>
                  </div>

                  {rates.length === 0 ? (
                    <div style={{ fontSize: 12.5, opacity: .65 }}>
                      กำลังโหลดอัตราจ่าย…
                    </div>
                  ) : (
                    <div className="bet-table__wrap">
                      <table className="bet-table">
                        <thead>
                          <tr>
                            <th>ประเภท</th>
                            <th style={{ width: 110 }}>อัตราจ่าย</th>
                            <th>ตัวอย่าง (แทง 100)</th>
                            <th>EV ผู้เล่น</th>
                            <th>ประเมิน</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rates.map((r, i) => {
                            const rate = Number(r.rate) || 0;
                            const ev = r.playerEV ?? (rate ? rate / (1_000_000 / rate) : 0);
                            return (
                              <tr key={r.key || i}>
                                <td>
                                  <div style={{ fontWeight: 700 }}>{r.label || r.key}</div>
                                  {r.desc && (
                                    <div style={{ fontSize: 10.5, opacity: .62, marginTop: 1 }}>
                                      {r.desc}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <input
                                    type="number" className="bet-input" min={1} step={5}
                                    style={{ width: 96 }}
                                    value={rates[i].rate}
                                    onChange={e => {
                                      const next = [...rates];
                                      next[i] = { ...next[i], rate: e.target.value };
                                      setRates(next);
                                    }}
                                  />
                                </td>
                                <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                  ฿{(Number(rates[i].rate) || 0) * 100}
                                </td>
                                <td className="num">{typeof ev === 'number' ? ev.toFixed(3) : '-'}</td>
                                <td>
                                  {r.verdict ? (
                                    <Badge tone={
                                      String(r.verdict).includes('🟢') ? 'success'
                                        : String(r.verdict).includes('🔴') ? 'danger' : 'muted'
                                    }>
                                      {r.verdict}
                                    </Badge>
                                  ) : <Badge tone="muted">-</Badge>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {stats && (
                  <Card>
                    <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 9 }}>
                      สถิติการเงิน
                    </div>
                    <div style={{
                      display: 'grid', gap: 10,
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    }}>
                      <Stat label="รอบ" value={stats.rounds?.toLocaleString() || '0'} />
                      <Stat label="ยอดรับ" value={`฿${(stats.totalBet || 0).toLocaleString()}`} tone="info" />
                      <Stat label="จ่าย" value={`฿${(stats.totalPayout || 0).toLocaleString()}`} tone="warn" />
                      <Stat
                        label="กำไร"
                        value={`฿${(stats.profit || 0).toLocaleString()}`}
                        sub={`${(stats.profitPercent || 0).toFixed(1)}%`}
                        tone={(stats.profit || 0) >= 0 ? 'success' : 'danger'}
                      />
                      <Stat
                        label="รอบไม่มีผู้ชนะ"
                        value={`${(stats.noWinnerRate || 0).toFixed(0)}%`}
                        tone="accent"
                      />
                    </div>
                  </Card>
                )}

                {roundStats.count > 0 && (
                  <Card>
                    <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 9 }}>
                      ความถี่ของแต่ละหลัก (0-9)
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 100 }}>
                      {roundStats.digitFrequency.map((v, d) => {
                        const max = Math.max(...roundStats.digitFrequency, 1);
                        return (
                          <div key={d} style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{
                              height: `${(v / max) * 78}px`, minHeight: 2,
                              background: 'var(--admin-accent)', borderRadius: '3px 3px 0 0',
                              transition: 'height .2s',
                            }} />
                            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 3 }}>{d}</div>
                            <div style={{ fontSize: 9.5, opacity: .6 }}>{v}</div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ================= ประวัติ ================= */}
            {tab === 'history' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{
                  display: 'grid', gap: 10,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                }}>
                  <Stat label="รายการทั้งหมด" value={hStats.total} />
                  <Stat label="แก้ไขผล" value={hStats.edits} tone="warn" />
                  <Stat label="ผู้ทำ" value={hStats.actorCount} tone="info" />
                  <Stat
                    label="ผิดปกติ"
                    value={hStats.tampered}
                    sub={hStats.tampered ? '⚠️ ควรตรวจสอบ' : 'ปกติ'}
                    tone={hStats.tampered ? 'danger' : 'success'}
                  />
                </div>

                <Card>
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                    marginBottom: 11,
                  }}>
                    <input
                      className="bet-input" placeholder="🔍 ค้นหา รอบ / ผู้ทำ / เหตุผล / ผล"
                      style={{ flex: 1, minWidth: 180 }}
                      value={hq}
                      onChange={e => setHq(e.target.value)}
                    />
                    <button
                      className="bet-btn"
                      onClick={() => setHOnlyEdits(!hOnlyEdits)}
                      style={hOnlyEdits ? {
                        background: 'var(--admin-accent-soft)',
                        borderColor: 'var(--admin-accent)',
                      } : undefined}
                    >
                      {hOnlyEdits ? '✓ ' : ''}เฉพาะการแก้ไข
                    </button>
                    <button className="bet-btn" onClick={exportCsv} disabled={!filteredHistory.length}>
                      ⬇️ CSV
                    </button>
                  </div>

                  {filteredHistory.length === 0 ? (
                    <div style={{ fontSize: 12.5, opacity: .65, padding: '18px 0', textAlign: 'center' }}>
                      {history.length === 0
                        ? 'ยังไม่มีประวัติ — จะเริ่มมีเมื่อปิดรอบหรือแก้ไขค่าต่างๆ'
                        : 'ไม่พบรายการที่ตรงกับเงื่อนไข'}
                    </div>
                  ) : (
                    <div className="bet-table__wrap">
                      <table className="bet-table">
                        <thead>
                          <tr>
                            <th>เวลา</th>
                            <th>การกระทำ</th>
                            <th>รอบ</th>
                            <th>ผล</th>
                            <th>เหตุผล</th>
                            <th>ผู้ทำ</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filteredHistory.slice(0, 200).map(h => {
                            const intact = !h.checksum || true;
                            return (
                              <tr key={h.id}>
                                <td style={{ whiteSpace: 'nowrap', fontSize: 11.5 }}>
                                  {new Date(h.at).toLocaleString('th-TH', {
                                    dateStyle: 'short', timeStyle: 'short',
                                  })}
                                </td>
                                <td>
                                  <Badge tone={ACTION_TONE[h.action] || 'muted'}>
                                    {ACTION_LABEL[h.action] || h.action}
                                  </Badge>
                                </td>
                                <td style={{ fontFamily: 'monospace', fontSize: 11.5 }}>
                                  {h.roundId}
                                </td>
                                <td style={{ fontFamily: 'monospace', fontSize: 11.5 }}>
                                  {h.resultBefore || h.resultAfter ? (
                                    <>
                                      {h.resultBefore && <span style={{ opacity: .6 }}>{h.resultBefore}</span>}
                                      {h.resultBefore && h.resultAfter && ' → '}
                                      {h.resultAfter && <b>{h.resultAfter}</b>}
                                    </>
                                  ) : '-'}
                                </td>
                                <td style={{ fontSize: 11.5, maxWidth: 240 }}>{h.reason || '-'}</td>
                                <td style={{ fontSize: 11.5 }}>{h.actor}</td>
                                <td />
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {/* ---- รอบล่าสุด + แก้ไขผล ---- */}
                <Card>
                  <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 9 }}>
                    รอบล่าสุด — แก้ไขผล / ล็อก
                  </div>
                  {rounds.length === 0 ? (
                    <div style={{ fontSize: 12.5, opacity: .65 }}>
                      ยังไม่มีรอบ — ปิดรอบได้ที่ API <code>POST /rounds/close</code>
                    </div>
                  ) : (
                    <div className="bet-table__wrap">
                      <table className="bet-table">
                        <thead>
                          <tr>
                            <th>รอบ</th>
                            <th>ผล</th>
                            <th className="num">รับ</th>
                            <th className="num">จ่าย</th>
                            <th className="num">กำไร</th>
                            <th>โหมด</th>
                            <th>สถานะ</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {rounds.slice(0, 25).map(r => {
                            const id = r.roundId || r.id;
                            const open = editOpen === id;
                            const locked = !!r.resultLocked;
                            return (
                              <React.Fragment key={id}>
                                <tr>
                                  <td style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{id}</td>
                                  <td>
                                    <span style={{
                                      fontFamily: 'monospace', fontWeight: 800,
                                      fontSize: 14, color: 'var(--admin-accent-dark)',
                                    }}>
                                      {r.result}
                                    </span>
                                    {r.edited && (
                                      <div style={{ marginTop: 2 }}>
                                        <Badge tone="warn">แก้แล้ว</Badge>
                                      </div>
                                    )}
                                  </td>
                                  <td className="num">
                                    ฿{(r.economics?.totalBet || 0).toLocaleString()}
                                  </td>
                                  <td className="num">
                                    ฿{(r.economics?.payout || 0).toLocaleString()}
                                  </td>
                                  <td className="num" style={{
                                    color: (r.economics?.profit || 0) >= 0 ? '#059669' : '#dc2626',
                                    fontWeight: 700,
                                  }}>
                                    ฿{(r.economics?.profit || 0).toLocaleString()}
                                  </td>
                                  <td>
                                    <Badge tone="info">{r.mode || '-'}</Badge>
                                  </td>
                                  <td>
                                    <Badge tone={locked ? 'danger' : 'success'}>
                                      {locked ? '🔒 ล็อก' : '🔓 เปิด'}
                                    </Badge>
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>
                                    <button
                                      className="bet-btn"
                                      style={{ padding: '5px 9px', fontSize: 11 }}
                                      onClick={() => {
                                        setEditOpen(open ? null : id);
                                        setEditResult(r.result || '');
                                        setEditReason('');
                                      }}
                                    >
                                      ✏️ แก้ผล
                                    </button>
                                    {' '}
                                    <button
                                      className={`bet-btn${locked ? '' : ' bet-btn--danger'}`}
                                      style={{ padding: '5px 9px', fontSize: 11 }}
                                      onClick={() => doLock(id, !locked)}
                                    >
                                      {locked ? '🔓 ปลดล็อก' : '🔒 ล็อก'}
                                    </button>
                                  </td>
                                </tr>

                                {open && (
                                  <tr>
                                    <td colSpan={8} style={{ background: 'var(--admin-subtle)' }}>
                                      <div style={{
                                        padding: 11, display: 'grid', gap: 9,
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                                      }}>
                                        <label>
                                          <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
                                            ผลใหม่ (6 หลัก)
                                          </div>
                                          <input
                                            className="bet-input" maxLength={6}
                                            style={{ fontFamily: 'monospace', fontWeight: 700 }}
                                            value={editResult}
                                            onChange={e => setEditResult(
                                              e.target.value.replace(/\D/g, '').slice(0, 6),
                                            )}
                                          />
                                        </label>
                                        <label style={{ gridColumn: '1 / -1' }}>
                                          <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
                                            ★ เหตุผลการแก้ไข (บังคับ)
                                          </div>
                                          <input
                                            className="bet-input"
                                            placeholder="เช่น ลูกค้าแจ้งว่าผลผิด / ตรวจสอบพบข้อผิดพลาด"
                                            value={editReason}
                                            onChange={e => setEditReason(e.target.value)}
                                          />
                                        </label>
                                      </div>
                                      <div style={{
                                        display: 'flex', gap: 8, padding: '0 11px 11px',
                                        flexWrap: 'wrap',
                                      }}>
                                        <button
                                          className="bet-btn bet-btn--primary"
                                          disabled={editResult.length !== 6 || editReason.trim().length < 3}
                                          onClick={() => doEdit(id)}
                                        >
                                          ✅ ยืนยันแก้ไขผล
                                        </button>
                                        <button
                                          className="bet-btn"
                                          onClick={() => setEditOpen(null)}
                                        >
                                          ยกเลิก
                                        </button>
                                        <div style={{
                                          fontSize: 11, opacity: .7, alignSelf: 'center',
                                          flex: 1, minWidth: 160,
                                        }}>
                                          ⚠️ ทุกการแก้ไขถูกบันทึกพร้อมผู้ทำ เวลา และเหตุผล
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ================= รหัส ================= */}
            {tab === 'codes' && (
              <div style={{ display: 'grid', gap: 12 }}>
                {freshCode && (
                  <div className="bet-note bet-note--success">
                    <span>🔑</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, marginBottom: 3 }}>
                        สร้างรหัส "{freshCode.label}" สำเร็จ
                      </div>
                      <div style={{
                        fontSize: 26, fontWeight: 800, fontFamily: 'monospace',
                        letterSpacing: 3, color: '#065f46', margin: '5px 0',
                      }}>
                        {freshCode.code}
                      </div>
                      <div style={{ fontSize: 11.5 }}>
                        ⚠️ ค่ารหัสนี้แสดงครั้งเดียวเท่านั้น — กรุณาจดเก็บไว้ ระบบเก็บเฉพาะ hash
                      </div>
                    </div>
                    <button
                      className="bet-btn"
                      onClick={() => {
                        navigator.clipboard?.writeText(freshCode.code);
                        flash('ok', 'คัดลอกรหัสแล้ว');
                      }}
                    >
                      📋 คัดลอก
                    </button>
                  </div>
                )}

                <Card>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 17 }}>🔑</span>
                    <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>
                      สร้างรหัสใหม่
                    </div>
                  </div>

                  <div style={{
                    display: 'grid', gap: 11,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  }}>
                    <label>
                      <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>ประเภทรหัส</div>
                      <select
                        className="bet-input"
                        value={newCode.kind}
                        onChange={e => setNewCode({ ...newCode, kind: e.target.value as CodeKind })}
                      >
                        {Object.entries(CODE_KIND_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>ชื่อรหัส</div>
                      <input
                        className="bet-input" placeholder="เช่น รหัสล็อกผลรอบเย็น"
                        value={newCode.label}
                        onChange={e => setNewCode({ ...newCode, label: e.target.value })}
                      />
                    </label>
                    <label>
                      <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>ความยาว</div>
                      <input
                        type="number" className="bet-input" min={4} max={32}
                        value={newCode.length}
                        onChange={e => setNewCode({ ...newCode, length: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>
                        ใช้ได้กี่ครั้ง
                      </div>
                      <input
                        type="number" className="bet-input" min={0}
                        value={newCode.maxUses}
                        onChange={e => setNewCode({ ...newCode, maxUses: Number(e.target.value) })}
                      />
                      <div style={{ fontSize: 10.5, opacity: .62, marginTop: 3 }}>0 = ไม่จำกัด</div>
                    </label>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <button
                      className="bet-btn bet-btn--primary"
                      onClick={createCode}
                      disabled={newCode.label.trim().length < 2}
                    >
                      🔑 สร้างรหัส
                    </button>
                  </div>
                </Card>

                <Card>
                  <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 10 }}>
                    รหัสที่มีอยู่ ({codes.length})
                  </div>
                  {codes.length === 0 ? (
                    <div style={{ fontSize: 12.5, opacity: .65, padding: '14px 0', textAlign: 'center' }}>
                      ยังไม่มีรหัส
                    </div>
                  ) : (
                    <div className="bet-table__wrap">
                      <table className="bet-table">
                        <thead>
                          <tr>
                            <th>ชื่อ</th>
                            <th>ประเภท</th>
                            <th>ความยาว</th>
                            <th>ใช้แล้ว</th>
                            <th>หมดอายุ</th>
                            <th>สถานะ</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {codes.map(c => (
                            <tr key={c.id}>
                              <td style={{ fontWeight: 700 }}>{c.label}</td>
                              <td>
                                <Badge tone="accent">
                                  {CODE_KIND_LABEL[c.kind as CodeKind] || c.kind}
                                </Badge>
                              </td>
                              <td className="num">{c.length} หลัก</td>
                              <td className="num">
                                {c.usedCount || 0}{c.maxUses ? ` / ${c.maxUses}` : ''}
                              </td>
                              <td style={{ fontSize: 11.5 }}>
                                {c.expiresAt
                                  ? new Date(c.expiresAt).toLocaleDateString('th-TH')
                                  : 'ไม่หมดอายุ'}
                              </td>
                              <td>
                                <Badge tone={c.active ? 'success' : 'muted'}>
                                  {c.active ? 'ใช้งาน' : 'ปิด'}
                                </Badge>
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <button
                                  className="bet-btn"
                                  style={{ padding: '5px 9px', fontSize: 11 }}
                                  onClick={() => toggleCode(c)}
                                >
                                  {c.active ? '⏸ ปิด' : '▶ เปิด'}
                                </button>
                                {' '}
                                <button
                                  className="bet-btn bet-btn--danger"
                                  style={{ padding: '5px 9px', fontSize: 11 }}
                                  onClick={() => deleteCode(c)}
                                >
                                  🗑 ลบ
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ================= กติกา ================= */}
            {tab === 'guide' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <Card>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
                    กติกาที่ใช้งานอยู่
                  </div>
                  <div style={{ fontSize: 11.5, opacity: .72, marginBottom: 11 }}>
                    ★ เนื้อหานี้คำนวณจากระบบจริง — แก้กติกาแล้วหน้าลูกค้าอัปเดตตามอัตโนมัติ
                  </div>
                  <div style={{
                    padding: 11, background: 'var(--admin-subtle)', borderRadius: 9,
                    fontFamily: 'monospace', fontSize: 12, lineHeight: 1.75,
                  }}>
                    <div>ช่องทั้งหมด: <b>{GUIDE_RULES.slotCount}</b></div>
                    <div>หลักต่อช่อง: <b>{GUIDE_RULES.digitsPerSlot}</b></div>
                    <div>ช่องที่ใช้หัก: <b>{GUIDE_RULES.subtractPosition}</b></div>
                    <div>ตัวหาร: <b>{GUIDE_RULES.modulo.toLocaleString()}</b></div>
                    <div>ช่วงผล: <b>{GUIDE_RULES.resultMin} – {GUIDE_RULES.resultMax}</b></div>
                    <div style={{ marginTop: 6, color: 'var(--admin-accent-dark)', fontWeight: 700 }}>
                      {GUIDE_RULES.formulaShort}
                    </div>
                  </div>
                </Card>

                <Card>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
                    ภาพกติกา (ตัวอย่างก่อนขึ้นหน้าลูกค้า)
                  </div>
                  <div
                    className="bet-svgbox"
                    style={{ borderRadius: 9, border: '1px solid var(--admin-border)' }}
                    dangerouslySetInnerHTML={{ __html: buildFormulaSvg({ width: 760 }) }}
                  />
                  <div style={{ height: 12 }} />
                  <div
                    className="bet-svgbox"
                    style={{ borderRadius: 9, border: '1px solid var(--admin-border)' }}
                    dangerouslySetInnerHTML={{ __html: buildReadingSvg({ width: 760 }) }}
                  />
                </Card>

                <Card>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 9 }}>
                    วิธีเล่น {PLAY_STEPS.length} ขั้น (ที่ลูกค้าเห็น)
                  </div>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {PLAY_STEPS.map(s => (
                      <div key={s.n} style={{
                        display: 'flex', gap: 9, alignItems: 'flex-start',
                        padding: '8px 10px', background: 'var(--admin-subtle)',
                        borderRadius: 8,
                      }}>
                        <span style={{
                          width: 21, height: 21, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--admin-accent)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800,
                        }}>
                          {s.n}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                            {s.icon} {s.title}
                          </div>
                          <div style={{ fontSize: 11.5, opacity: .72, marginTop: 1, lineHeight: 1.55 }}>
                            {s.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ---------- Toast ---------- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            style={{
              position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
              zIndex: 200, maxWidth: '92vw',
            }}
          >
            <div style={{
              background: toast.kind === 'ok' ? '#065f46' : '#991b1b',
              color: '#fff', borderRadius: 10, padding: '11px 17px',
              fontSize: 12.5, fontWeight: 600, boxShadow: '0 6px 22px rgba(0,0,0,.26)',
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span>{toast.kind === 'ok' ? '✅' : '⚠️'}</span>
              <span style={{ flex: 1 }}>{toast.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
