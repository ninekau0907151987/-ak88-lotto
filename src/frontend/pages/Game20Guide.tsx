/**
 * src/frontend/pages/Game20Guide.tsx
 * ------------------------------------------------------------------
 * ★ หน้ากติกา + วิธีการเล่น (หน้าลูกค้า) ★
 *
 * ผู้ใช้ขอ: "ทำภาพกิติกา วิธีการเล่นด้วยครับ"
 *
 * เนื้อหา:
 *   1. การ์ดสรุปสูตร (พร้อมภาพ SVG)
 *   2. ตัวอย่างการคำนวณ 4 แบบ (กดดูได้)
 *   3. วิธีการเล่น 8 ขั้น
 *   4. ตารางอัตราจ่าย + ตัวอย่างเงินจริง
 *   5. วิธีอ่านผล (ภาพ SVG)
 *   6. FAQ
 *   7. ข้อควรระวัง
 *
 * ★ ธีมขาว/กรอบ (ตามที่ผู้ใช้ขอ "ทำพื้นสีขาว ออกแบบเป็นกรอบ")
 * ★ ไม่แตะ markup มือถือ — ใช้ responsive ที่กว้างขึ้นอย่างเดียว
 * ==================================================================
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GUIDE_RULES, PLAY_STEPS, getPayoutTable, getFaq, getWorkedExamples,
  GUIDE_RULES_LIST, buildFormulaSvg, buildReadingSvg, buildRulesCardSvg,
} from '../../shared/lib/game20Guide';
import { computeResult } from '../../shared/lib/lottery20';

/* ================================================================
 * UI ย่อย
 * ================================================================ */

function SectionCard({ icon, title, sub, children, id }: {
  icon: string; title: string; sub?: string; children: React.ReactNode; id?: string;
}) {
  return (
    <section id={id} className="bet-frame" style={{ marginBottom: 14 }}>
      <div className="bet-frame__head">
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bet-frame__title">{title}</div>
          {sub && <div className="bet-frame__sub">{sub}</div>}
        </div>
      </div>
      <div className="bet-frame__body">{children}</div>
    </section>
  );
}

/** ★ แสดง SVG ที่สร้างจาก lib — ฉีดเป็น HTML โดยตรง */
function SvgBlock({ svg, label }: { svg: string; label?: string }) {
  return (
    <div>
      {label && <div className="bet-stat__label" style={{ marginBottom: 6 }}>{label}</div>}
      <div
        className="bet-svgbox"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

/* ================================================================
 * หน้าหลัก
 * ================================================================ */

export default function Game20Guide() {
  const [tab, setTab] = useState<'rules' | 'play' | 'payout' | 'faq'>('rules');
  const [openEx, setOpenEx] = useState<number>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const examples = useMemo(() => getWorkedExamples(), []);
  const payouts = useMemo(() => getPayoutTable(), []);
  const faq = useMemo(() => getFaq(), []);
  const formulaSvg = useMemo(() => buildFormulaSvg(), []);
  const readingSvg = useMemo(() => buildReadingSvg(), []);
  const cardSvg = useMemo(() => buildRulesCardSvg(), []);

  const TABS = [
    { id: 'rules' as const,  icon: '📖', label: 'กติกา' },
    { id: 'play' as const,   icon: '🎯', label: 'วิธีเล่น' },
    { id: 'payout' as const, icon: '💰', label: 'อัตราจ่าย' },
    { id: 'faq' as const,    icon: '❓', label: 'คำถาม' },
  ];

  return (
    <div className="bet-board" style={{ paddingBottom: 40 }}>

      {/* ---------- หัวเรื่อง ---------- */}
      <div className="bet-frame" style={{ marginBottom: 14 }}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 24 }}>📘</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h1 style={{
                margin: 0, fontSize: 19, fontWeight: 800,
                color: 'var(--bet-text)', letterSpacing: -0.2,
              }}>
                กติกาและวิธีการเล่น
              </h1>
              <div style={{
                fontSize: 12.5, color: 'var(--bet-muted)', marginTop: 2,
              }}>
                หวย {GUIDE_RULES.slotCount} ช่อง × {GUIDE_RULES.digitsPerSlot} หลัก
              </div>
            </div>
            {/* ★ สูตรแบบเห็นชัด */}
            <div className="bet-svgbox" style={{
              padding: '7px 12px', borderRadius: 8,
              background: 'var(--bet-primary-soft, #eef5fd)',
              border: '1px solid var(--bet-primary-border, #cfe1f5)',
            }}>
              <div style={{
                fontSize: 9.5, color: 'var(--bet-primary)',
                fontWeight: 700, marginBottom: 1,
              }}>
                สูตร
              </div>
              <div style={{
                fontSize: 12, fontFamily: 'ui-monospace, monospace',
                fontWeight: 700, color: 'var(--bet-primary-text, #1e5fa8)',
              }}>
                {GUIDE_RULES.formulaShort}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- แท็บ ---------- */}
      <div className="bet-frame" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', overflowX: 'auto' }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`bet-cat-btn${active ? ' bet-cat-btn--active' : ''}`}
                style={{
                  flex: '1 0 auto', minWidth: 96,
                  borderBottom: active ? '3px solid var(--bet-primary)' : '3px solid transparent',
                  borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                }}
              >
                <span style={{ fontSize: 15, marginRight: 5 }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >

          {/* ================= กติกา ================= */}
          {tab === 'rules' && (
            <div>
              <SectionCard
                icon="🧮" title="วิธีคำนวณผลรางวัล"
                sub={`ใช้เลข ${GUIDE_RULES.slotCount} ช่อง แต่ละช่อง ${GUIDE_RULES.digitsPerSlot} หลัก แล้วนำมาบวกลบกัน`}
              >
                <SvgBlock svg={formulaSvg} />
              </SectionCard>

              <SectionCard
                icon="🔍" title="ตัวอย่างการคำนวณ"
                sub="กดดูตัวอย่างเพื่อเข้าใจทีละขั้น"
              >
                <div style={{ display: 'grid', gap: 8 }}>
                  {examples.map((ex, i) => {
                    const open = openEx === i;
                    return (
                      <div key={i} className="bet-frame" style={{ overflow: 'hidden' }}>
                        <button
                          onClick={() => setOpenEx(open ? -1 : i)}
                          style={{
                            width: '100%', textAlign: 'left', padding: '11px 13px',
                            background: open ? 'var(--bet-primary-soft, #eef5fd)' : 'transparent',
                            border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 9,
                            borderBottom: open ? '1px solid var(--bet-frame)' : 'none',
                          }}
                        >
                          <span style={{
                            fontSize: 11, fontWeight: 800,
                            color: '#fff', background: 'var(--bet-primary)',
                            borderRadius: 5, padding: '2px 7px',
                          }}>
                            {i + 1}
                          </span>
                          <span style={{
                            flex: 1, fontSize: 13, fontWeight: 700,
                            color: 'var(--bet-text)',
                          }}>
                            {ex.title}
                          </span>
                          <span style={{
                            fontFamily: 'ui-monospace, monospace', fontSize: 12,
                            fontWeight: 700, color: 'var(--bet-primary)',
                          }}>
                            {ex.result.result}
                          </span>
                          <span style={{
                            fontSize: 10, color: 'var(--bet-muted)',
                            transform: open ? 'rotate(180deg)' : 'none',
                            transition: 'transform .15s',
                          }}>
                            ▼
                          </span>
                        </button>

                        {open && (
                          <div style={{ padding: '11px 13px' }}>
                            {/* แสดง 20 ช่องแบบย่อ */}
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(62px, 1fr))',
                              gap: 5, marginBottom: 11,
                            }}>
                              {ex.slots.map((s, j) => {
                                const isSub = j + 1 === GUIDE_RULES.subtractPosition;
                                const nz = s !== '000000';
                                return (
                                  <div
                                    key={j}
                                    style={{
                                      border: `1px solid ${isSub ? '#dc2626' : nz ? '#2563eb' : 'var(--bet-frame)'}`,
                                      background: isSub ? '#fef2f2' : nz ? '#eff6ff' : '#fff',
                                      borderRadius: 6, padding: '4px 2px', textAlign: 'center',
                                    }}
                                  >
                                    <div style={{ fontSize: 8.5, color: 'var(--bet-muted)' }}>
                                      ช่อง {j + 1}
                                    </div>
                                    <div style={{
                                      fontSize: 10.5, fontFamily: 'ui-monospace, monospace',
                                      fontWeight: 700,
                                      color: isSub ? '#dc2626' : nz ? '#2563eb' : '#b9b2a6',
                                    }}>
                                      {s}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* ขั้นตอน */}
                            <div style={{
                              background: '#fafbfc', border: '1px solid var(--bet-frame)',
                              borderRadius: 8, padding: '10px 12px',
                            }}>
                              {ex.lines.map((l, k) => (
                                <div key={k} style={{
                                  fontSize: 12, fontFamily: 'ui-monospace, monospace',
                                  color: 'var(--bet-text)', padding: '2px 0',
                                }}>
                                  <span style={{
                                    display: 'inline-block', width: 18,
                                    color: 'var(--bet-muted)', fontWeight: 700,
                                  }}>
                                    {k + 1})
                                  </span>
                                  {l}
                                </div>
                              ))}
                            </div>

                            <div style={{
                              marginTop: 9, fontSize: 12, color: 'var(--bet-primary-text, #1e5fa8)',
                              background: 'var(--bet-primary-soft, #eef5fd)',
                              border: '1px solid var(--bet-primary-border, #cfe1f5)',
                              borderRadius: 7, padding: '8px 11px', fontWeight: 600,
                            }}>
                              💡 {ex.note}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard icon="👁️" title="วิธีอ่านผลรางวัล" sub="ผล 6 หลักแยกอ่านได้หลายแบบ">
                <SvgBlock svg={readingSvg} />
              </SectionCard>

              <SectionCard icon="⚠️" title="ข้อควรระวัง" sub="อ่านก่อนเล่นทุกครั้ง">
                <div style={{ display: 'grid', gap: 8 }}>
                  {GUIDE_RULES_LIST.map((r, i) => {
                    const tone = r.severity === 'danger' ? '#dc2626'
                      : r.severity === 'warning' ? '#d97706' : '#2563eb';
                    const bg = r.severity === 'danger' ? '#fef2f2'
                      : r.severity === 'warning' ? '#fffbeb' : '#eff6ff';
                    return (
                      <div key={i} style={{
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        border: `1px solid ${tone}33`, background: bg,
                        borderRadius: 8, padding: '10px 12px',
                      }}>
                        <span style={{ fontSize: 15, lineHeight: 1.3 }}>{r.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: tone }}>
                            {r.title}
                          </div>
                          <div style={{
                            fontSize: 12, color: 'var(--bet-text)',
                            marginTop: 2, lineHeight: 1.55,
                          }}>
                            {r.detail}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ================= วิธีเล่น ================= */}
          {tab === 'play' && (
            <SectionCard
              icon="🎯" title="วิธีการเล่น" sub={`${PLAY_STEPS.length} ขั้นตอน — ทำตามลำดับ`}
            >
              <div style={{ display: 'grid', gap: 0 }}>
                {PLAY_STEPS.map((s, i) => (
                  <div key={s.n} style={{ display: 'flex', gap: 12 }}>
                    {/* เส้นเชื่อม */}
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      flexShrink: 0,
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'var(--bet-primary)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, flexShrink: 0,
                      }}>
                        {s.n}
                      </div>
                      {i < PLAY_STEPS.length - 1 && (
                        <div style={{
                          flex: 1, width: 2, minHeight: 18,
                          background: 'var(--bet-frame)',
                        }} />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0, paddingBottom: 14 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        marginBottom: 3, flexWrap: 'wrap',
                      }}>
                        <span style={{ fontSize: 15 }}>{s.icon}</span>
                        <span style={{
                          fontSize: 13.5, fontWeight: 700, color: 'var(--bet-text)',
                        }}>
                          {s.title}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 12.5, color: 'var(--bet-muted)',
                        lineHeight: 1.6,
                      }}>
                        {s.detail}
                      </div>
                      {s.warn && (
                        <div style={{
                          marginTop: 6, fontSize: 11.5,
                          background: '#fffbeb', border: '1px solid #fcd34d55',
                          color: '#92400e', borderRadius: 6, padding: '6px 9px',
                          display: 'flex', gap: 6, alignItems: 'flex-start',
                        }}>
                          <span>⚠️</span>
                          <span style={{ flex: 1 }}>{s.warn}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ================= อัตราจ่าย ================= */}
          {tab === 'payout' && (
            <div>
              <SectionCard
                icon="💰" title="ตารางอัตราจ่าย"
                sub="เงินรางวัล = จำนวนเงินที่แทง × อัตราจ่าย"
              >
                {/* มือถือ: การ์ด / จอใหญ่: ตาราง */}
                <div className="bet-payout-grid">
                  {payouts.map(p => (
                    <div key={p.key} className="bet-frame" style={{ overflow: 'hidden' }}>
                      <div style={{
                        padding: '9px 12px', background: 'var(--bet-primary-soft, #eef5fd)',
                        borderBottom: '1px solid var(--bet-frame)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 8,
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--bet-text)' }}>
                          {p.label}
                        </span>
                        <span style={{
                          fontSize: 15, fontWeight: 800, fontFamily: 'ui-monospace, monospace',
                          color: 'var(--bet-primary-text, #1e5fa8)',
                        }}>
                          {p.rate}×
                        </span>
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{
                          fontSize: 11.5, color: 'var(--bet-muted)',
                          marginBottom: 8, lineHeight: 1.5,
                        }}>
                          {p.desc}
                        </div>
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', padding: '7px 0',
                          borderTop: '1px dashed var(--bet-frame)',
                          borderBottom: '1px dashed var(--bet-frame)',
                        }}>
                          <span style={{ fontSize: 11.5, color: 'var(--bet-muted)' }}>
                            แทง {p.exampleBet} บาท
                          </span>
                          <span style={{
                            fontSize: 14, fontWeight: 800,
                            fontFamily: 'ui-monospace, monospace',
                            color: '#059669',
                          }}>
                            ได้ {p.exampleWin.toLocaleString()} ฿
                          </span>
                        </div>
                        <div style={{
                          marginTop: 8, fontSize: 11, color: 'var(--bet-primary)',
                          display: 'flex', gap: 5, alignItems: 'flex-start',
                        }}>
                          <span>👁️</span>
                          <span style={{ flex: 1 }}>{p.howToRead}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard icon="📄" title="การ์ดกติกาฉบับย่อ" sub="ใช้แชร์หรือพิมพ์ได้">
                <SvgBlock svg={cardSvg} />
              </SectionCard>
            </div>
          )}

          {/* ================= คำถาม ================= */}
          {tab === 'faq' && (
            <SectionCard icon="❓" title="คำถามที่พบบ่อย" sub={`${faq.length} ข้อ`}>
              <div style={{ display: 'grid', gap: 7 }}>
                {faq.map((f, i) => {
                  const open = openFaq === i;
                  return (
                    <div key={i} className="bet-frame" style={{ overflow: 'hidden' }}>
                      <button
                        onClick={() => setOpenFaq(open ? null : i)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '11px 12px',
                          background: open ? 'var(--bet-primary-soft, #eef5fd)' : 'transparent',
                          border: 'none', cursor: 'pointer',
                          display: 'flex', gap: 9, alignItems: 'flex-start',
                        }}
                      >
                        <span style={{
                          fontSize: 11, fontWeight: 800, color: '#fff',
                          background: open ? 'var(--bet-primary)' : 'var(--bet-muted)',
                          borderRadius: '50%', width: 18, height: 18, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginTop: 1,
                        }}>
                          ?
                        </span>
                        <span style={{
                          flex: 1, fontSize: 12.5, fontWeight: 700,
                          color: 'var(--bet-text)', lineHeight: 1.5,
                        }}>
                          {f.q}
                        </span>
                        <span style={{
                          fontSize: 10, color: 'var(--bet-muted)',
                          transform: open ? 'rotate(180deg)' : 'none',
                          transition: 'transform .15s', marginTop: 3,
                        }}>
                          ▼
                        </span>
                      </button>
                      {open && (
                        <div style={{
                          padding: '0 12px 12px 39px',
                          fontSize: 12.5, color: 'var(--bet-text)',
                          lineHeight: 1.65,
                        }}>
                          {f.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ---------- ท้ายหน้า ---------- */}
      <div style={{
        marginTop: 16, padding: '12px 14px', textAlign: 'center',
        fontSize: 11.5, color: 'var(--bet-muted)', lineHeight: 1.7,
      }}>
        <div style={{ fontWeight: 700, color: 'var(--bet-text)', marginBottom: 3 }}>
          🎲 หวย {GUIDE_RULES.slotCount} ช่อง × {GUIDE_RULES.digitsPerSlot} หลัก
        </div>
        <div>
          ช่วงผล {GUIDE_RULES.resultMin} – {GUIDE_RULES.resultMax} • ช่องที่ {GUIDE_RULES.subtractPosition} ใช้หักออก
        </div>
        <div style={{ marginTop: 4 }}>
          หากมีข้อสงสัยติดต่อเอเย่นต์หรือผู้ดูแลระบบ พร้อมแจ้งเลขที่โพย
        </div>
      </div>
    </div>
  );
}
