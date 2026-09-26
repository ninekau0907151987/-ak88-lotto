/**
 * src/frontend/pages/Game20Bet.tsx
 * ------------------------------------------------------------------
 * ★ หน้าวางเลขหวย 20 ช่อง 6 หลัก (ฝั่งลูกค้า) ★
 *
 * ผู้ใช้ขอ: "วางดาต้าบส เป็นระบบ เอาลงข้อมูลได้ง่าย เรียกใช้ได้ง่าย"
 *          + หน้าวางเลข 20 ช่อง (B1)
 *
 * ธีม: พื้นขาว กรอบเทา สีหลักฟ้าเข้ม (ตาม --bet-* ที่มีอยู่)
 *       ★ ไม่แตะ markup มือถือ — ใช้ isPC/isMobile แยก
 *
 * ขั้นตอน:
 *   1. กรอก 20 ช่อง (ช่องละ 6 หลัก) หรือกดสุ่ม
 *   2. เห็นผลที่จะออกทันที + ขั้นตอนคำนวณ
 *   3. เลือกประเภท → กรอกเลข → ใส่เงิน → เพิ่มลงตะกร้า
 *   4. ตรวจเครดิต → ส่งโพย
 */
import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SLOT_COUNT, DIGITS_PER_SLOT, SUBTRACT_SLOT_POSITION,
  normalizeSlot, validateSlots, randomSlots, seededSlots,
} from '@/shared/lib/lottery20';
import {
  GAME20_BET_KINDS, KIND_BY_KEY, type Game20BetKind, type BetSlipItem,
  addToSlip, removeFromSlip, setSlipAmount, setSlipNumber,
  computeTotals, validateSlip, checkSlipAgainstResult,
  demoSlots, explainSlots, newSlipId,
} from '@/shared/lib/game20BetSlip';
import { fmtMoney, fmtInt } from '@/shared/lib/betCount';
import {
  DEFAULT_RISK_LIMITS, checkSlipRisk, maxAcceptable, riskSummary, RISK_STYLE,
} from '@/shared/lib/game20Risk';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';

/* ─────────────────────── ตัวช่วยเล็ก ๆ ─────────────────────── */

function Card({ children, style, className = '' }: any) {
  return (
    <div className={`bet-frame ${className}`} style={{ padding: 12, ...style }}>
      {children}
    </div>
  );
}

function TabBtn({ active, onClick, children, icon }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg font-black text-[12px] transition-all border"
      style={
        active
          ? { background: 'var(--bet-primary)', color: '#fff', borderColor: 'var(--bet-primary)' }
          : { background: '#fff', color: 'var(--bet-text-muted)', borderColor: 'var(--bet-frame)' }
      }
    >
      {icon && <span className="material-symbols-outlined text-[16px]">{icon}</span>}
      {children}
    </button>
  );
}

/* ─────────────────────── หน้าหลัก ─────────────────────── */

export default function Game20Bet() {
  const { isPC } = useBreakpoint();

  // ── 20 ช่อง ──
  const [slots, setSlots] = useState<string[]>(() => new Array(SLOT_COUNT).fill(''));
  // ── ตะกร้า ──
  const [slip, setSlip] = useState<BetSlipItem[]>([]);
  // ── ประเภทที่เลือก ──
  const [kind, setKind] = useState<Game20BetKind>('3ตัวบน');
  const [betNumber, setBetNumber] = useState('');
  const [betAmount, setBetAmount] = useState(20);
  // ── UI ──
  const [tab, setTab] = useState<'slots' | 'bets' | 'check' | 'risk'>('slots');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'warn'; text: string } | null>(null);
  const [balance] = useState(54640); // ★ ตัวอย่าง — ของจริงอ่านจาก userData

  // ── คำนวณผลสด ──
  const slotCheck = useMemo(() => validateSlots(slots), [slots]);
  const filled = useMemo(() => slots.filter(s => normalizeSlot(s) !== '000000' || s === '000000').length, [slots]);
  const filledReal = useMemo(() => slots.filter(s => String(s).trim() !== '').length, [slots]);
  const explain = useMemo(() => (filledReal === SLOT_COUNT ? explainSlots(slots) : null), [slots, filledReal]);
  const totals = useMemo(() => computeTotals(slip), [slip]);
  // ★ B2: ตรวจความเสี่ยงของตะกร้า (ยังไม่มีโพยเดิมในรอบ → ส่ง [])
  const risk = useMemo(
    () => checkSlipRisk(slip, [], DEFAULT_RISK_LIMITS),
    [slip],
  );
  // ผลสมมติสำหรับตรวจ (ใช้ผลที่คำนวณได้)
  const preview = useMemo(
    () => (explain ? checkSlipAgainstResult(slip, explain.result) : null),
    [slip, explain],
  );

  // ── จัดการช่อง ──
  const setSlot = useCallback((i: number, v: string) => {
    const clean = String(v).replace(/\D/g, '').slice(0, DIGITS_PER_SLOT);
    setSlots(prev => { const n = [...prev]; n[i] = clean; return n; });
  }, []);

  const fillRandom = useCallback(() => {
    setSlots(randomSlots());
    setMsg({ type: 'ok', text: 'สุ่มเลข 20 ช่องแล้ว' });
  }, []);

  const fillDemo = useCallback(() => {
    setSlots(demoSlots());
    setMsg({ type: 'ok', text: 'ใส่เลขตัวอย่างแล้ว — ใช้ดูภาพ ไม่ใช่แทงจริง' });
  }, []);

  const clearSlots = useCallback(() => {
    setSlots(new Array(SLOT_COUNT).fill(''));
    setMsg(null);
  }, []);

  // ── จัดการตะกร้า ──
  const info = KIND_BY_KEY[kind];

  const addBet = useCallback(() => {
    const num = betNumber.replace(/\D/g, '');
    if (num.length !== info.digits) {
      setMsg({ type: 'err', text: `${info.label} ต้องมี ${info.digits} หลัก` });
      return;
    }
    if (betAmount <= 0) {
      setMsg({ type: 'err', text: 'ใส่จำนวนเงินก่อน' });
      return;
    }
    const before = slip.length;
    const next = addToSlip(slip, kind, num, betAmount);
    setSlip(next);
    setBetNumber('');
    setMsg({
      type: 'ok',
      text: next.length === before
        ? `${info.label} ${num} — รวมเงินเพิ่มเป็น ${fmtMoney(next.find(s => s.kind === kind && s.number === num)?.amount ?? 0)} บาท`
        : `เพิ่ม ${info.label} ${num} ฿${fmtMoney(betAmount)} แล้ว`,
    });
    setTab('bets');
  }, [slip, kind, betNumber, betAmount, info]);

  // กด Enter ในช่องเลข → เพิ่มเลย
  const onNumKey = (e: any) => { if (e.key === 'Enter') addBet(); };

  // ── ส่งโพย ──
  const submit = useCallback(() => {
    const v = validateSlip(slip, slots, balance);
    if (!v.ok) {
      setMsg({ type: 'err', text: v.errors[0] });
      return;
    }
    // ★ B2: ถ้าเกินเพดานความเสี่ยง → ไม่รับ
    if (risk.blocked) {
      setMsg({ type: 'err', text: `เกินเพดานความเสี่ยง — ${risk.messages[0]}` });
      setTab('risk');
      return;
    }
    if (v.warnings.length) {
      setMsg({ type: 'warn', text: v.warnings[0] });
    }
    setMsg({
      type: 'ok',
      text: `★ ตรวจผ่าน! ${totals.count} รายการ ทุน ฿${fmtMoney(totals.totalCost)} — พร้อมส่ง (ยังไม่ต่อ API จริง)`,
    });
  }, [slip, slots, balance, totals, risk]);

  const showCheck = useCallback(() => {
    setTab('check');
  }, []);

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bet-bg)' }}>
      <div className={`mx-auto ${isPC ? 'max-w-5xl px-4' : 'px-2'} py-3`}>

        {/* ───────── หัวเรื่อง ───────── */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px]" style={{ color: 'var(--bet-primary)' }}>
              grid_on
            </span>
            <div>
              <div className="font-black text-base" style={{ color: 'var(--bet-text)' }}>
                หวย 20 ช่อง 6 หลัก
              </div>
              <div className="text-[10px]" style={{ color: 'var(--bet-text-muted)' }}>
                บวก 20 ช่อง − ช่องที่ {SUBTRACT_SLOT_POSITION} แล้ว mod 1,000,000
              </div>
            </div>
          </div>
          <Link
            to="/game20/guide"
            className="text-[11px] font-black px-3 py-1.5 rounded-lg border flex items-center gap-1"
            style={{ borderColor: 'var(--bet-primary-border)', color: 'var(--bet-primary-text)', background: 'var(--bet-primary-soft)' }}
          >
            <span className="material-symbols-outlined text-[14px]">menu_book</span>
            กติกา
          </Link>
        </div>

        {/* ───────── แถบเครดิต ───────── */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Card style={{ textAlign: 'center', padding: '8px 6px' }}>
            <div className="text-[9px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>เครดิตคงเหลือ</div>
            <div className="font-black text-sm tabular-nums" style={{ color: 'var(--bet-success)' }}>
              ฿{fmtMoney(balance)}
            </div>
          </Card>
          <Card style={{ textAlign: 'center', padding: '8px 6px' }}>
            <div className="text-[9px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>ทุนรวม</div>
            <div className="font-black text-sm tabular-nums" style={{ color: 'var(--bet-primary)' }}>
              ฿{fmtMoney(totals.totalCost)}
            </div>
          </Card>
          <Card style={{ textAlign: 'center', padding: '8px 6px' }}>
            <div className="text-[9px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>จ่ายสูงสุด</div>
            <div className="font-black text-sm tabular-nums" style={{ color: 'var(--bet-accent, #d97706)' }}>
              ฿{fmtMoney(totals.maxPayout)}
            </div>
          </Card>
        </div>

        {/* ───────── แท็บ ───────── */}
        <div className="flex gap-2 mb-3">
          <TabBtn active={tab === 'slots'} onClick={() => setTab('slots')} icon="grid_on">
            20 ช่อง {filledReal > 0 && `(${filledReal})`}
          </TabBtn>
          <TabBtn active={tab === 'bets'} onClick={() => setTab('bets')} icon="receipt_long">
            ตะกร้า {slip.length > 0 && `(${slip.length})`}
          </TabBtn>
          <TabBtn active={tab === 'check'} onClick={showCheck} icon="fact_check">
            ตรวจผล
          </TabBtn>
          <TabBtn active={tab === 'risk'} onClick={() => setTab('risk')} icon="shield">
            ความเสี่ยง
          </TabBtn>
        </div>

        {/* ───────── ข้อความ ───────── */}
        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-3 px-3 py-2 rounded-lg text-[11px] font-bold border"
              style={
                msg.type === 'ok'
                  ? { background: '#eef7ef', borderColor: '#c3e0c5', color: '#2e7d32' }
                  : msg.type === 'warn'
                  ? { background: '#fdf6e3', borderColor: '#f0dfae', color: '#8a6a1f' }
                  : { background: '#fdf0ee', borderColor: '#f0cdc8', color: '#b3261e' }
              }
            >
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════ แท็บ 1: 20 ช่อง ═══════════ */}
        {tab === 'slots' && (
          <div className="space-y-3">
            <Card>
              <div className="flex items-center justify-between mb-2">
                <div className="font-black text-[12px]" style={{ color: 'var(--bet-text)' }}>
                  กรอกเลข 20 ช่อง (ช่องละ {DIGITS_PER_SLOT} หลัก)
                </div>
                <div className="text-[10px] font-bold" style={{ color: filledReal === SLOT_COUNT ? 'var(--bet-success)' : 'var(--bet-text-muted)' }}>
                  {filledReal}/{SLOT_COUNT} ช่อง
                </div>
              </div>

              <div className={`grid gap-1.5 ${isPC ? 'grid-cols-5' : 'grid-cols-2'}`}>
                {slots.map((v, i) => {
                  const isSub = i === SUBTRACT_SLOT_POSITION - 1;
                  return (
                    <div key={i} className="relative">
                      <div
                        className="absolute -top-1.5 left-1 px-1 rounded text-[8px] font-black z-10"
                        style={
                          isSub
                            ? { background: '#dc2626', color: '#fff' }
                            : { background: '#e8eef5', color: '#4a6d92' }
                        }
                        title={isSub ? `ช่องที่ ${SUBTRACT_SLOT_POSITION} — ช่องที่ใช้ลบ` : `ช่องที่ ${i + 1}`}
                      >
                        {i + 1}{isSub ? ' ⊖' : ''}
                      </div>
                      <input
                        inputMode="numeric"
                        value={v}
                        onChange={(e) => setSlot(i, e.target.value)}
                        placeholder="000000"
                        className="w-full text-center font-black tabular-nums rounded border py-2 text-[13px]"
                        style={{
                          borderColor: isSub ? '#f0cdc8' : 'var(--bet-frame)',
                          background: isSub ? '#fdf0ee' : '#fff',
                          color: 'var(--bet-text)',
                          letterSpacing: '0.08em',
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-3">
                <button onClick={fillRandom} className="flex-1 py-2 rounded-lg text-[11px] font-black border"
                  style={{ borderColor: 'var(--bet-primary-border)', color: 'var(--bet-primary-text)', background: 'var(--bet-primary-soft)' }}>
                  <span className="material-symbols-outlined text-[14px] align-middle">casino</span> สุ่มเลข
                </button>
                <button onClick={fillDemo} className="flex-1 py-2 rounded-lg text-[11px] font-black border"
                  style={{ borderColor: 'var(--bet-frame)', color: 'var(--bet-text-muted)', background: '#fff' }}>
                  <span className="material-symbols-outlined text-[14px] align-middle">lightbulb</span> ตัวอย่าง
                </button>
                <button onClick={clearSlots} className="flex-1 py-2 rounded-lg text-[11px] font-black border"
                  style={{ borderColor: 'var(--bet-frame)', color: 'var(--bet-text-muted)', background: '#fff' }}>
                  <span className="material-symbols-outlined text-[14px] align-middle">delete_sweep</span> ล้าง
                </button>
              </div>
            </Card>

            {/* ── ผลที่จะออก ── */}
            <Card style={{ background: explain ? 'var(--bet-primary-soft)' : '#fff' }}>
              <div className="font-black text-[12px] mb-2" style={{ color: 'var(--bet-primary-text)' }}>
                ผลที่จะออก (คำนวณสด)
              </div>
              {!explain ? (
                <div className="text-[11px] py-3 text-center font-bold" style={{ color: 'var(--bet-text-muted)' }}>
                  กรอกให้ครบ {SLOT_COUNT} ช่อง เพื่อดูผล
                </div>
              ) : (
                <>
                  <div className="flex justify-center gap-1.5 mb-3">
                    {explain.result.split('').map((d, i) => (
                      <span key={i}
                        className="w-9 h-11 flex items-center justify-center rounded-lg font-black text-xl tabular-nums"
                        style={{ background: 'var(--bet-primary)', color: '#fff' }}>
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {explain.steps.map((st) => (
                      <div key={st.n} className="flex items-center justify-between text-[11px] px-2 py-1 rounded"
                        style={{ background: '#fff' }}>
                        <span style={{ color: 'var(--bet-text-muted)' }}>
                          {st.n}. {st.label}
                        </span>
                        <span className="font-black tabular-nums" style={{ color: 'var(--bet-primary-text)' }}>
                          {st.value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mt-3">
                    {[
                      ['3 ตัวบน', explain.prizes.top3, '#dc2626'],
                      ['2 ตัวบน', explain.prizes.top2, '#d97706'],
                      ['2 ตัวล่าง', explain.prizes.bottom2, '#2563eb'],
                      ['1 ตัว', explain.prizes.last1, '#059669'],
                    ].map(([label, val, col]) => (
                      <div key={label as string} className="text-center py-1.5 rounded-lg border"
                        style={{ borderColor: 'var(--bet-frame)', background: '#fff' }}>
                        <div className="text-[9px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>{label}</div>
                        <div className="font-black text-sm tabular-nums" style={{ color: col as string }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            <button onClick={() => setTab('bets')}
              className="w-full py-3 rounded-xl font-black text-white text-sm"
              style={{ background: 'var(--bet-primary)' }}>
              ไปเลือกแทง →
            </button>
          </div>
        )}

        {/* ═══════════ แท็บ 2: ตะกร้า ═══════════ */}
        {tab === 'bets' && (
          <div className="space-y-3">
            {/* เลือกประเภท + กรอกเลข */}
            <Card>
              <div className="font-black text-[12px] mb-2" style={{ color: 'var(--bet-text)' }}>เลือกประเภทการแทง</div>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {GAME20_BET_KINDS.map(k => (
                  <button key={k.kind} type="button" onClick={() => { setKind(k.kind); setBetNumber(''); }}
                    className="py-2 rounded-lg border font-black text-[10px] flex flex-col items-center gap-0.5 transition-all"
                    style={
                      kind === k.kind
                        ? { background: k.color, color: '#fff', borderColor: k.color }
                        : { background: '#fff', color: 'var(--bet-text-muted)', borderColor: 'var(--bet-frame)' }
                    }>
                    <span className="material-symbols-outlined text-[15px]">{k.icon}</span>
                    {k.label}
                    <span className="text-[9px] opacity-80">×{k.rate}</span>
                  </button>
                ))}
              </div>

              <div className="text-[10px] px-2 py-1.5 rounded mb-2"
                style={{ background: 'var(--bet-primary-soft)', color: 'var(--bet-primary-text)' }}>
                <b>{info.label}</b> — {info.how}
                <div className="mt-0.5 opacity-80">เช่น {info.example}</div>
              </div>

              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  value={betNumber}
                  onChange={(e) => setBetNumber(e.target.value.replace(/\D/g, '').slice(0, info.digits))}
                  onKeyDown={onNumKey}
                  placeholder={'0'.repeat(info.digits)}
                  className="flex-1 text-center font-black tabular-nums rounded-lg border py-2.5 text-base"
                  style={{ borderColor: 'var(--bet-frame)', color: 'var(--bet-text)', letterSpacing: '0.1em' }}
                />
                <input
                  type="number" min={1}
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value) || 1))}
                  onKeyDown={onNumKey}
                  className="w-20 text-center font-black tabular-nums rounded-lg border py-2.5 text-base"
                  style={{ borderColor: 'var(--bet-frame)', color: 'var(--bet-primary)' }}
                />
              </div>

              <div className="flex gap-1.5 mt-2">
                {[10, 20, 50, 100, 500].map(a => (
                  <button key={a} type="button" onClick={() => setBetAmount(a)}
                    className="flex-1 py-1 rounded text-[10px] font-black border"
                    style={
                      betAmount === a
                        ? { background: 'var(--bet-primary)', color: '#fff', borderColor: 'var(--bet-primary)' }
                        : { background: '#fff', color: 'var(--bet-text-muted)', borderColor: 'var(--bet-frame)' }
                    }>{a}</button>
                ))}
              </div>

              <button onClick={addBet}
                className="w-full mt-3 py-2.5 rounded-xl font-black text-white text-sm flex items-center justify-center gap-1"
                style={{ background: '#107c10' }}>
                <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                เพิ่มลงตะกร้า · ฿{fmtMoney(betAmount * info.rate)} ถ้าถูก
              </button>
            </Card>

            {/* รายการในตะกร้า */}
            <Card>
              <div className="flex items-center justify-between mb-2">
                <div className="font-black text-[12px]" style={{ color: 'var(--bet-text)' }}>
                  ตะกร้า ({slip.length} รายการ)
                </div>
                {slip.length > 0 && (
                  <button onClick={() => setSlip([])} className="text-[10px] font-black"
                    style={{ color: 'var(--bet-danger, #dc2626)' }}>ล้างตะกร้า</button>
                )}
              </div>

              {slip.length === 0 ? (
                <div className="text-center py-6 text-[11px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>
                  ยังไม่มีรายการ — เลือกประเภท กรอกเลข แล้วกดเพิ่ม
                </div>
              ) : (
                <div className="space-y-1.5">
                  {slip.map(it => {
                    const k = KIND_BY_KEY[it.kind];
                    return (
                      <div key={it.id} className="flex items-center gap-2 px-2 py-2 rounded-lg border"
                        style={{ borderColor: 'var(--bet-frame)', background: '#fff' }}>
                        <span className="w-1 h-8 rounded" style={{ background: k.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold" style={{ color: k.color }}>{k.label}</div>
                          <input
                            value={it.number}
                            onChange={(e) => setSlip(s => setSlipNumber(s, it.id, e.target.value))}
                            className="font-black tabular-nums text-sm w-20 bg-transparent outline-none"
                            style={{ color: 'var(--bet-text)', letterSpacing: '0.08em' }}
                          />
                        </div>
                        <input
                          type="number" min={1}
                          value={it.amount}
                          onChange={(e) => setSlip(s => setSlipAmount(s, it.id, Number(e.target.value)))}
                          className="w-16 text-center font-black tabular-nums text-sm rounded border py-1"
                          style={{ borderColor: 'var(--bet-frame)', color: 'var(--bet-primary)' }}
                        />
                        <div className="text-right w-16">
                          <div className="text-[9px]" style={{ color: 'var(--bet-text-muted)' }}>×{it.rate}</div>
                          <div className="font-black text-[11px] tabular-nums" style={{ color: '#107c10' }}>
                            {fmtInt(Math.floor(it.amount * it.rate))}
                          </div>
                        </div>
                        <button onClick={() => setSlip(s => removeFromSlip(s, it.id))}
                          className="material-symbols-outlined text-[18px]"
                          style={{ color: 'var(--bet-danger, #dc2626)' }}>close</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* สรุปยอด */}
            {slip.length > 0 && (
              <Card style={{ background: 'var(--bet-primary-soft)' }}>
                <div className="space-y-1.5">
                  {totals.byKind.map(b => (
                    <div key={b.kind} className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--bet-text-muted)' }}>
                        {b.label} · {b.count} รายการ
                      </span>
                      <span className="font-black tabular-nums" style={{ color: b.color }}>
                        ฿{fmtMoney(b.cost)} → {fmtInt(b.payout)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-1.5 flex justify-between text-[12px] font-black"
                    style={{ borderColor: 'var(--bet-primary-border)' }}>
                    <span style={{ color: 'var(--bet-text)' }}>รวม</span>
                    <span className="tabular-nums" style={{ color: 'var(--bet-primary)' }}>
                      ทุน ฿{fmtMoney(totals.totalCost)} → ฿{fmtInt(totals.maxPayout)}
                    </span>
                  </div>
                </div>

                <button onClick={submit}
                  className="w-full mt-3 py-3 rounded-xl font-black text-white text-base flex items-center justify-center gap-2"
                  style={{ background: 'var(--bet-primary)' }}>
                  <span className="material-symbols-outlined text-[20px]">touch_app</span>
                  ส่งโพย · ฿{fmtMoney(totals.totalCost)}
                </button>
              </Card>
            )}
          </div>
        )}

        {/* ═══════════ แท็บ 3: ตรวจผล ═══════════ */}
        {tab === 'check' && (
          <div className="space-y-3">
            <Card>
              <div className="font-black text-[12px] mb-2" style={{ color: 'var(--bet-text)' }}>
                ตรวจว่าเลขในตะกร้าถูกไหม
              </div>
              {!explain ? (
                <div className="text-center py-6 text-[11px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>
                  ต้องกรอก 20 ช่องให้ครบก่อน เพื่อเทียบผล
                </div>
              ) : slip.length === 0 ? (
                <div className="text-center py-6 text-[11px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>
                  ตะกร้าว่าง — ไปเพิ่มรายการก่อน
                </div>
              ) : (
                <>
                  <div className="flex justify-center gap-1 mb-3">
                    {explain.result.split('').map((d, i) => (
                      <span key={i} className="w-8 h-9 flex items-center justify-center rounded font-black tabular-nums"
                        style={{ background: 'var(--bet-primary)', color: '#fff' }}>{d}</span>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {preview?.rows.map(r => {
                      const k = KIND_BY_KEY[r.kind];
                      return (
                        <div key={r.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg border"
                          style={{
                            borderColor: r.isWin ? '#c3e0c5' : 'var(--bet-frame)',
                            background: r.isWin ? '#eef7ef' : '#fff',
                          }}>
                          <span className="text-[11px] font-bold" style={{ color: k.color }}>
                            {k.label} <span className="tabular-nums">{r.number}</span>
                          </span>
                          <span className="text-[11px] font-black tabular-nums"
                            style={{ color: r.isWin ? '#2e7d32' : 'var(--bet-text-muted)' }}>
                            {r.isWin ? `✓ ถูก +${fmtInt(r.payout)}` : `✗ ${pickLabel(r.kind, explain)}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-2 border-t grid grid-cols-3 gap-2 text-center"
                    style={{ borderColor: 'var(--bet-frame)' }}>
                    <div>
                      <div className="text-[9px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>ทุน</div>
                      <div className="font-black text-sm tabular-nums">฿{fmtMoney(preview!.totalCost)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>ได้</div>
                      <div className="font-black text-sm tabular-nums" style={{ color: '#107c10' }}>
                        ฿{fmtInt(preview!.totalPayout)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>กำไร</div>
                      <div className="font-black text-sm tabular-nums"
                        style={{ color: preview!.profit >= 0 ? '#107c10' : '#dc2626' }}>
                        {preview!.profit >= 0 ? '+' : ''}฿{fmtInt(preview!.profit)}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-center mt-2" style={{ color: 'var(--bet-text-muted)' }}>
                    ถูก {preview!.winCount} จาก {slip.length} รายการ
                  </div>
                </>
              )}
            </Card>
          </div>
        )}
        {/* ═══════════ แท็บ 4: ความเสี่ยง (B2) ═══════════ */}
        {tab === 'risk' && (
          <div className="space-y-3">
            {/* สรุปภาพรวม */}
            <Card style={{ background: RISK_STYLE[risk.level].bg, borderColor: RISK_STYLE[risk.level].border }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[24px]"
                  style={{ color: RISK_STYLE[risk.level].text }}>
                  {RISK_STYLE[risk.level].icon}
                </span>
                <div className="flex-1">
                  <div className="font-black text-[13px]" style={{ color: RISK_STYLE[risk.level].text }}>
                    {RISK_STYLE[risk.level].label}
                  </div>
                  <div className="text-[10px]" style={{ color: RISK_STYLE[risk.level].text, opacity: 0.85 }}>
                    {riskSummary(risk)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="text-center py-1.5 rounded-lg" style={{ background: '#fff' }}>
                  <div className="text-[9px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>รับแทงรวม</div>
                  <div className="font-black text-[12px] tabular-nums">฿{fmtInt(risk.round.totalAccepted)}</div>
                </div>
                <div className="text-center py-1.5 rounded-lg" style={{ background: '#fff' }}>
                  <div className="text-[9px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>จ่ายหนักสุด</div>
                  <div className="font-black text-[12px] tabular-nums" style={{ color: RISK_STYLE[risk.level].text }}>
                    ฿{fmtInt(risk.round.worstCasePayout)}
                  </div>
                </div>
                <div className="text-center py-1.5 rounded-lg" style={{ background: '#fff' }}>
                  <div className="text-[9px] font-bold" style={{ color: 'var(--bet-text-muted)' }}>ใช้สำรอง</div>
                  <div className="font-black text-[12px] tabular-nums"
                    style={{ color: risk.round.usedPercent >= 70 ? RISK_STYLE.warn.text : '#2e7d32' }}>
                    {risk.round.usedPercent}%
                  </div>
                </div>
              </div>
              {/* แถบสำรอง */}
              <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: '#e8eef5' }}>
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, risk.round.usedPercent)}%`,
                    background: RISK_STYLE[risk.level].text,
                  }} />
              </div>
              <div className="text-[9px] mt-1 text-right" style={{ color: 'var(--bet-text-muted)' }}>
                เพดานจ่ายต่อรอบ ฿{fmtInt(DEFAULT_RISK_LIMITS.maxPayoutPerRound)} ·
                สำรอง ฿{fmtInt(DEFAULT_RISK_LIMITS.bankrollReserve)}
              </div>
            </Card>

            {/* ข้อความ */}
            {risk.messages.length > 0 && (
              <Card>
                <div className="font-black text-[12px] mb-2" style={{ color: 'var(--bet-text)' }}>
                  ข้อควรระวัง ({risk.messages.length})
                </div>
                <div className="space-y-1.5">
                  {risk.messages.map((m, i) => (
                    <div key={i} className="text-[10px] px-2 py-1.5 rounded border"
                      style={{
                        background: risk.blocked ? '#fdf0ee' : '#fdf6e3',
                        borderColor: risk.blocked ? '#f0cdc8' : '#f0dfae',
                        color: risk.blocked ? '#b3261e' : '#8a6a1f',
                      }}>
                      {m}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* รายการในตะกร้า + รับได้อีก */}
            {slip.length > 0 && (
              <Card>
                <div className="font-black text-[12px] mb-2" style={{ color: 'var(--bet-text)' }}>
                  รับได้อีกต่อเลข
                </div>
                <div className="space-y-1.5">
                  {slip.map(it => {
                    const k = KIND_BY_KEY[it.kind];
                    const ma = maxAcceptable(it.kind, it.number, [], DEFAULT_RISK_LIMITS);
                    return (
                      <div key={it.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg border"
                        style={{ borderColor: 'var(--bet-frame)', background: '#fff' }}>
                        <span className="text-[11px] font-bold" style={{ color: k.color }}>
                          {k.label} <span className="tabular-nums">{it.number}</span>
                        </span>
                        <span className="text-[10px] font-black tabular-nums"
                          style={{ color: ma.final > 0 ? '#2e7d32' : '#b3261e' }}>
                          {ma.final > 0 ? `รับได้อีก ฿${fmtInt(ma.final)}` : 'เต็มเพดาน'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* เพดานที่ใช้ */}
            <Card>
              <div className="font-black text-[12px] mb-2" style={{ color: 'var(--bet-text)' }}>
                เพดานที่ตั้งไว้
              </div>
              <div className="space-y-1">
                {([
                  ['รับต่อเลข', DEFAULT_RISK_LIMITS.maxAcceptPerNumber],
                  ['จ่ายต่อเลข', DEFAULT_RISK_LIMITS.maxPayoutPerNumber],
                  ['จ่ายต่อคน/รอบ', DEFAULT_RISK_LIMITS.maxPayoutPerPlayer],
                  ['จ่ายทั้งรอบ', DEFAULT_RISK_LIMITS.maxPayoutPerRound],
                  ['ทุนสำรอง', DEFAULT_RISK_LIMITS.bankrollReserve],
                ] as Array<[string, number]>).map(([label, val]) => (
                  <div key={label} className="flex justify-between text-[11px] px-2 py-1 rounded"
                    style={{ background: 'var(--bet-primary-soft)' }}>
                    <span style={{ color: 'var(--bet-text-muted)' }}>{label}</span>
                    <span className="font-black tabular-nums" style={{ color: 'var(--bet-primary-text)' }}>
                      ฿{fmtInt(val)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-[9px] mt-2 px-2 py-1.5 rounded"
                style={{ background: '#fdf6e3', color: '#8a6a1f' }}>
                ⚠️ ลำดับเพดานต้องเรียง: รับต่อเลข &lt; จ่ายต่อเลข &lt; จ่ายต่อคน &lt; จ่ายทั้งรอบ &lt; สำรอง
              </div>
            </Card>

            {risk.blocked && (
              <div className="text-[11px] text-center font-black py-3 rounded-xl"
                style={{ background: '#fdf0ee', color: '#b3261e' }}>
                ⛔ ตะกร้านี้ส่งไม่ได้ — ลดเงินหรือลบรายการที่เกินเพดานก่อน
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** ป้ายบอกว่าเลขที่ต้องการคืออะไร (ตอนไม่ถูก) */
function pickLabel(kind: Game20BetKind, ex: { prizes: any }): string {
  const m: Record<string, string> = {
    '3ตัวบน': ex.prizes.top3,
    '2ตัวบน': ex.prizes.top2,
    '2ตัวล่าง': ex.prizes.bottom2,
    '1ตัว': ex.prizes.last1,
    '3ตัวโต๊ด': ex.prizes.top3,
  };
  return `ต้อง ${m[kind] ?? '?'}`;
}
