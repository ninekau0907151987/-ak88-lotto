/**
 * src/backend/pages/Game20Report.tsx
 * ------------------------------------------------------------------
 * ★ B3: รายงานกำไร-ขาดทุน หวย 20 ช่อง 6 หลัก (หลังบ้าน) ★
 *
 * ธีมครีมตามหลังบ้านเดิม (--admin-*)
 * แท็บ: ภาพรวม · รายวัน · รายเดือน · อันดับเลข
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  sampleRounds, summarizeRound, groupByDay, groupByMonth, summarizeOverall, rankNumbers,
  buildLineChart, buildBarChart, formatThaiDate, formatThaiMonth, profitColor,
  type ChartPoint,
} from '@/shared/lib/game20Report';
import { fmtMoney, fmtInt } from '@/shared/lib/betCount';

/* ────────────── ตัวช่วย ────────────── */

function Card({ children, style, className = '', title, right }: any) {
  return (
    <div className={`admin-card ${className}`} style={{ padding: 14, ...style }}>
      {(title || right) && (
        <div className="flex items-center justify-between mb-2.5">
          {title && <div className="font-black text-[13px] admin-text">{title}</div>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, tone = 'default' }: any) {
  const tones: Record<string, { bg: string; border: string; text: string }> = {
    default: { bg: 'var(--admin-subtle)', border: 'var(--admin-border)', text: 'var(--admin-text)' },
    green: { bg: '#eef7ef', border: '#c3e0c5', text: '#2e7d32' },
    red: { bg: '#fdf0ee', border: '#f0cdc8', text: '#b3261e' },
    gold: { bg: '#fdf6e3', border: '#f0dfae', text: '#8a6a1f' },
    blue: { bg: '#eef4fb', border: '#c8ddf2', text: '#1565c0' },
  };
  const t = tones[tone] || tones.default;
  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ background: t.bg, borderColor: t.border }}>
      <div className="text-[9px] font-bold uppercase tracking-wide mb-0.5" style={{ color: t.text, opacity: 0.75 }}>
        {label}
      </div>
      <div className="font-black tabular-nums text-[15px]" style={{ color: t.text }}>{value}</div>
      {sub && <div className="text-[9px] mt-0.5" style={{ color: t.text, opacity: 0.7 }}>{sub}</div>}
    </div>
  );
}

function TabBtn({ active, onClick, children, icon }: any) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1 px-3 py-2 rounded-lg font-black text-[11px] border transition-all whitespace-nowrap"
      style={
        active
          ? { background: 'var(--admin-accent)', color: '#fff', borderColor: 'var(--admin-accent)' }
          : { background: 'var(--admin-card)', color: 'var(--admin-accent-text)', borderColor: 'var(--admin-border)' }
      }>
      {icon && <span className="material-symbols-outlined text-[15px]">{icon}</span>}
      {children}
    </button>
  );
}

/* ────────────── กราฟเส้น SVG ────────────── */

function LineChart({ points, height = 190, color = '#a67c52' }: {
  points: ChartPoint[]; height?: number; color?: string;
}) {
  const W = 640;
  const c = useMemo(() => buildLineChart(points, W, height), [points, height]);

  if (!c.points.length) {
    return (
      <div className="text-center py-10 text-[11px] font-bold" style={{ color: 'var(--admin-text)', opacity: 0.5 }}>
        ยังไม่มีข้อมูล
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ minWidth: 340, height: 'auto' }}>
        {/* กริด */}
        {c.gridY.map((g, i) => (
          <g key={i}>
            <line x1="52" y1={g.y} x2={W - 12} y2={g.y} stroke="var(--admin-border)" strokeWidth="1" strokeDasharray="3 3" />
            <text x="46" y={g.y + 3} textAnchor="end" fontSize="9" fill="var(--admin-text)" opacity="0.55">
              {Math.abs(g.value) >= 1000 ? `${Math.round(g.value / 1000)}k` : g.value}
            </text>
          </g>
        ))}

        {/* เส้นศูนย์ */}
        {c.zeroY !== null && (
          <line x1="52" y1={c.zeroY} x2={W - 12} y2={c.zeroY} stroke="#94a3b8" strokeWidth="1.2" />
        )}

        {/* พื้นที่ใต้เส้น */}
        <path d={c.areaPath} fill={color} opacity="0.12" />
        {/* เส้น */}
        <path d={c.path} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

        {/* จุด */}
        {c.points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="#fff" stroke={color} strokeWidth="2" />
            {c.points.length <= 16 && (
              <text x={p.x} y={height - 8} textAnchor="middle" fontSize="9" fill="var(--admin-text)" opacity="0.6">
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ────────────── กราฟแท่ง รับ/จ่าย ────────────── */

function BarChart({ data, height = 190 }: {
  data: Array<{ label: string; bet: number; payout: number }>; height?: number;
}) {
  const W = 640;
  const bars = useMemo(() => buildBarChart(data, W, height), [data, height]);
  const maxVal = Math.max(...data.flatMap(d => [d.bet, d.payout]), 1);

  if (!bars.length) {
    return (
      <div className="text-center py-10 text-[11px] font-bold" style={{ color: 'var(--admin-text)', opacity: 0.5 }}>
        ยังไม่มีข้อมูล
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ minWidth: 340, height: 'auto' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = 14 + (1 - f) * (height - 40);
          return (
            <g key={i}>
              <line x1="52" y1={y} x2={W - 12} y2={y} stroke="var(--admin-border)" strokeWidth="1" strokeDasharray="3 3" />
              <text x="46" y={y + 3} textAnchor="end" fontSize="9" fill="var(--admin-text)" opacity="0.55">
                {Math.round((maxVal * f) / 1000)}k
              </text>
            </g>
          );
        })}
        {bars.map((b, i) => {
          const baseY = 14 + (height - 40);
          return (
            <g key={i}>
              {/* รับ */}
              <rect x={b.x} y={baseY - b.hBet} width={b.w} height={b.hBet} rx="2" fill="#2e7d32" opacity="0.85" />
              {/* จ่าย */}
              <rect x={b.x + b.w + 2} y={baseY - b.hPayout} width={b.w} height={b.hPayout} rx="2" fill="#dc2626" opacity="0.75" />
              <text x={b.x + b.w} y={height - 8} textAnchor="middle" fontSize="9" fill="var(--admin-text)" opacity="0.6">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-center gap-3 mt-1">
        <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--admin-text)' }}>
          <span className="w-3 h-2 rounded-sm" style={{ background: '#2e7d32' }} /> รับ
        </span>
        <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--admin-text)' }}>
          <span className="w-3 h-2 rounded-sm" style={{ background: '#dc2626' }} /> จ่าย
        </span>
      </div>
    </div>
  );
}

/* ────────────── หน้าหลัก ────────────── */

export default function Game20Report() {
  const [tab, setTab] = useState<'overview' | 'daily' | 'monthly' | 'numbers'>('overview');
  // ★ ตอนนี้ใช้ข้อมูลตัวอย่าง — ของจริงอ่านจาก API /game20/rounds
  const rounds = useMemo(() => sampleRounds(30, 6), []);

  const overall = useMemo(() => summarizeOverall(rounds), [rounds]);
  const days = useMemo(() => groupByDay(rounds), [rounds]);
  const months = useMemo(() => groupByMonth(rounds), [rounds]);
  const ranking = useMemo(() => rankNumbers(
    rounds.slice(0, 60).map((r, i) => ({
      type: ['3ตัวบน', '2ตัวบน', '2ตัวล่าง', '1ตัว'][i % 4],
      number: ['456', '56', '34', '6'][i % 4],
      amount: 10 + (i % 20),
      rate: [900, 95, 95, 3.2][i % 4],
      won: r.totalPayout > r.totalBet,
    })),
  ), [rounds]);

  const last14 = days.slice(-14);
  const linePoints: ChartPoint[] = last14.map(d => ({ label: formatThaiDate(d.date), value: d.profit }));
  const barData = last14.map(d => ({ label: formatThaiDate(d.date), bet: d.totalBet, payout: d.totalPayout }));

  const exportCsv = () => {
    const head = 'วันที่,รอบ,รับ,จ่าย,กำไร,margin%,โพย,ผู้เล่น\n';
    const body = days.map(d =>
      `${d.date},${d.roundCount},${d.totalBet},${d.totalPayout},${d.profit},${d.marginPercent},${d.ticketCount},${d.playerCount}`,
    ).join('\n');
    const blob = new Blob(['\ufeff' + head + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `game20-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--admin-bg)' }}>
      <div className="max-w-6xl mx-auto px-3 py-4">

        {/* ── หัวเรื่อง ── */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px]" style={{ color: 'var(--admin-accent)' }}>
              monitoring
            </span>
            <div>
              <div className="font-black text-base admin-text">รายงานกำไร-ขาดทุน</div>
              <div className="text-[10px]" style={{ color: 'var(--admin-text)', opacity: 0.65 }}>
                หวย 20 ช่อง 6 หลัก · {overall.roundCount} รอบ · {days.length} วัน
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv}
              className="text-[11px] font-black px-3 py-2 rounded-lg border flex items-center gap-1"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-accent-text)', background: 'var(--admin-card)' }}>
              <span className="material-symbols-outlined text-[15px]">download</span> ส่งออก CSV
            </button>
            <Link to="/admin/game20"
              className="text-[11px] font-black px-3 py-2 rounded-lg border flex items-center gap-1"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-accent-text)', background: 'var(--admin-card)' }}>
              <span className="material-symbols-outlined text-[15px]">settings</span> ตั้งค่า
            </Link>
          </div>
        </div>

        {/* ── KPI ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <Kpi label="รับแทงรวม" value={`฿${fmtInt(overall.totalBet)}`} sub={`เฉลี่ย ฿${fmtInt(overall.avgBetPerRound)}/รอบ`} tone="blue" />
          <Kpi label="จ่ายรวม" value={`฿${fmtInt(overall.totalPayout)}`} sub={`${overall.roundCount} รอบ`} tone="red" />
          <Kpi label="กำไรสุทธิ" value={`${overall.profit >= 0 ? '+' : ''}฿${fmtInt(overall.profit)}`}
            sub={`margin ${overall.marginPercent}%`} tone={overall.profit >= 0 ? 'green' : 'red'} />
          <Kpi label="อัตราชนะ" value={`${overall.winRate}%`}
            sub={`กำไร ${overall.profitRounds} · ขาดทุน ${overall.lossRounds}`} tone="gold" />
        </div>

        {/* ── แท็บ ── */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')} icon="insights">ภาพรวม</TabBtn>
          <TabBtn active={tab === 'daily'} onClick={() => setTab('daily')} icon="calendar_view_day">รายวัน</TabBtn>
          <TabBtn active={tab === 'monthly'} onClick={() => setTab('monthly')} icon="calendar_month">รายเดือน</TabBtn>
          <TabBtn active={tab === 'numbers'} onClick={() => setTab('numbers')} icon="leaderboard">อันดับเลข</TabBtn>
        </div>

        {/* ═══ ภาพรวม ═══ */}
        {tab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <Card title="กำไร-ขาดทุนรายวัน (14 วันล่าสุด)">
              <LineChart points={linePoints} />
            </Card>
            <Card title="รับ vs จ่าย รายวัน">
              <BarChart data={barData} />
            </Card>
            <div className="grid md:grid-cols-2 gap-3">
              <Card title="รอบที่ดีที่สุด">
                {overall.bestRound ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold" style={{ color: 'var(--admin-text)', opacity: 0.7 }}>
                        {formatThaiDate(overall.bestRound.closedAt.slice(0, 10))} · {overall.bestRound.roundId.split('-').pop()}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--admin-text)', opacity: 0.5 }}>
                        ผล {overall.bestRound.result}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black tabular-nums text-[15px]" style={{ color: '#2e7d32' }}>
                        +฿{fmtInt(overall.bestRound.profit)}
                      </div>
                      <div className="text-[9px]" style={{ color: 'var(--admin-text)', opacity: 0.5 }}>
                        margin {overall.bestRound.marginPercent}%
                      </div>
                    </div>
                  </div>
                ) : <div className="text-[11px] opacity-50">ไม่มีข้อมูล</div>}
              </Card>
              <Card title="รอบที่แย่ที่สุด">
                {overall.worstRound ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold" style={{ color: 'var(--admin-text)', opacity: 0.7 }}>
                        {formatThaiDate(overall.worstRound.closedAt.slice(0, 10))} · {overall.worstRound.roundId.split('-').pop()}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--admin-text)', opacity: 0.5 }}>
                        ผล {overall.worstRound.result}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black tabular-nums text-[15px]" style={{ color: '#b3261e' }}>
                        {overall.worstRound.profit >= 0 ? '+' : ''}฿{fmtInt(overall.worstRound.profit)}
                      </div>
                      <div className="text-[9px]" style={{ color: 'var(--admin-text)', opacity: 0.5 }}>
                        margin {overall.worstRound.marginPercent}%
                      </div>
                    </div>
                  </div>
                ) : <div className="text-[11px] opacity-50">ไม่มีข้อมูล</div>}
              </Card>
            </div>
          </motion.div>
        )}

        {/* ═══ รายวัน ═══ */}
        {tab === 'daily' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card title={`สรุปรายวัน (${days.length} วัน)`} style={{ padding: 0, overflow: 'hidden' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ background: 'var(--admin-subtle)' }}>
                      {['วันที่', 'รอบ', 'รับ', 'จ่าย', 'กำไร', 'margin', 'โพย'].map(h => (
                        <th key={h} className="px-2 py-2 text-left font-black whitespace-nowrap"
                          style={{ color: 'var(--admin-text)', opacity: 0.8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...days].reverse().map(d => (
                      <tr key={d.date} className="border-t" style={{ borderColor: 'var(--admin-border)' }}>
                        <td className="px-2 py-1.5 font-bold whitespace-nowrap" style={{ color: 'var(--admin-text)' }}>
                          {formatThaiDate(d.date)}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums" style={{ color: 'var(--admin-text)' }}>{d.roundCount}</td>
                        <td className="px-2 py-1.5 tabular-nums" style={{ color: 'var(--admin-text)' }}>{fmtInt(d.totalBet)}</td>
                        <td className="px-2 py-1.5 tabular-nums" style={{ color: 'var(--admin-text)' }}>{fmtInt(d.totalPayout)}</td>
                        <td className="px-2 py-1.5 tabular-nums font-black" style={{ color: profitColor(d.profit) }}>
                          {d.profit >= 0 ? '+' : ''}{fmtInt(d.profit)}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums" style={{ color: profitColor(d.profit) }}>
                          {d.marginPercent}%
                        </td>
                        <td className="px-2 py-1.5 tabular-nums" style={{ color: 'var(--admin-text)', opacity: 0.7 }}>
                          {d.ticketCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2" style={{ borderColor: 'var(--admin-accent)', background: 'var(--admin-accent-soft)' }}>
                      <td className="px-2 py-2 font-black" style={{ color: 'var(--admin-accent-text)' }}>รวม</td>
                      <td className="px-2 py-2 tabular-nums font-black" style={{ color: 'var(--admin-accent-text)' }}>{overall.roundCount}</td>
                      <td className="px-2 py-2 tabular-nums font-black" style={{ color: 'var(--admin-accent-text)' }}>{fmtInt(overall.totalBet)}</td>
                      <td className="px-2 py-2 tabular-nums font-black" style={{ color: 'var(--admin-accent-text)' }}>{fmtInt(overall.totalPayout)}</td>
                      <td className="px-2 py-2 tabular-nums font-black" style={{ color: profitColor(overall.profit) }}>
                        {overall.profit >= 0 ? '+' : ''}{fmtInt(overall.profit)}
                      </td>
                      <td className="px-2 py-2 tabular-nums font-black" style={{ color: profitColor(overall.profit) }}>
                        {overall.marginPercent}%
                      </td>
                      <td className="px-2 py-2" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ═══ รายเดือน ═══ */}
        {tab === 'monthly' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <Card title={`สรุปรายเดือน (${months.length} เดือน)`}>
              <div className="space-y-2">
                {months.map(m => {
                  const pct = Math.min(100, Math.abs(m.marginPercent));
                  return (
                    <div key={m.month}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-[12px]" style={{ color: 'var(--admin-text)' }}>
                          {formatThaiMonth(m.month)}
                        </span>
                        <span className="font-black tabular-nums text-[12px]" style={{ color: profitColor(m.profit) }}>
                          {m.profit >= 0 ? '+' : ''}฿{fmtInt(m.profit)} ({m.marginPercent}%)
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--admin-subtle)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: profitColor(m.profit) }} />
                      </div>
                      <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--admin-text)', opacity: 0.6 }}>
                        <span>{m.dayCount} วัน · {m.roundCount} รอบ</span>
                        <span>รับ {fmtInt(m.totalBet)} / จ่าย {fmtInt(m.totalPayout)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ═══ อันดับเลข ═══ */}
        {tab === 'numbers' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-3">
            <Card title="เลขที่ทำกำไรดีสุด 10 อันดับ">
              <div className="space-y-1">
                {ranking.best.map((n, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{ background: 'var(--admin-subtle)' }}>
                    <span className="w-5 text-center font-black text-[10px]" style={{ color: 'var(--admin-accent)' }}>{i + 1}</span>
                    <span className="flex-1 text-[11px] font-bold" style={{ color: 'var(--admin-text)' }}>
                      {n.kind} <span className="tabular-nums">{n.number}</span>
                    </span>
                    <span className="font-black tabular-nums text-[11px]" style={{ color: '#2e7d32' }}>
                      +{fmtInt(n.profit)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="เลขที่ขาดทุนหนักสุด 10 อันดับ">
              <div className="space-y-1">
                {ranking.worst.map((n, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{ background: 'var(--admin-subtle)' }}>
                    <span className="w-5 text-center font-black text-[10px]" style={{ color: '#b3261e' }}>{i + 1}</span>
                    <span className="flex-1 text-[11px] font-bold" style={{ color: 'var(--admin-text)' }}>
                      {n.kind} <span className="tabular-nums">{n.number}</span>
                      {n.hitCount > 0 && <span className="text-[9px] ml-1" style={{ color: '#b3261e' }}>ถูก {n.hitCount}×</span>}
                    </span>
                    <span className="font-black tabular-nums text-[11px]" style={{ color: '#b3261e' }}>
                      {fmtInt(n.profit)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── หมายเหตุ ── */}
        <div className="mt-3 text-[10px] px-3 py-2 rounded-lg"
          style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-accent-text)' }}>
          ℹ️ ตอนนี้แสดง<b>ข้อมูลตัวอย่าง</b> (30 วัน × 6 รอบ) — เมื่อต่อ API จริงจะอ่านจาก
          <code className="mx-1 px-1 rounded" style={{ background: '#fff' }}>GET /api/v1/game20/rounds</code>
        </div>
      </div>
    </div>
  );
}
