/**
 * src/backend/pages/BackofficeManual.tsx
 * ------------------------------------------------------------------
 * ★ คู่มือการตั้งค่าและใช้งาน — ทุกฟังก์ชันหลังบ้าน ★
 *
 * ผู้ใช้ขอ: "ทำคู่มือการตั้งค่าการใช้งงาน ฟังชั่นนั้น ทุกฟังชั่นหลังบ้าน"
 *          "ขอตารางรหัสผ่าน ทางเข้า"
 *
 * แท็บ:
 *   1. ★ รหัสผ่าน & ทางเข้า — ตารางครบทุกตำแหน่ง + หน้าทั้งหมด
 *   2. คู่มือฟังก์ชัน (13 หมวด) — กดดูทีละหมวด
 *   3. ตั้งค่าเริ่มต้น — quick start 5 ขั้น
 *   4. แก้ปัญหา — 10 อาการ
 *   5. คำถามที่พบบ่อย
 *
 * ★ ธีมครีม (--admin-*) ตามหลังบ้านเดิม
 * ★ พิมพ์ได้ (มี @media print)
 * ==================================================================
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getAccessTable, ALL_PAGES, MANUAL_SECTIONS, TROUBLESHOOTING,
  ADMIN_FAQ, manualStats, type ManualSection,
} from '../../shared/lib/backofficeManual';

/* ================================================================
 * UI ย่อย
 * ================================================================ */

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties; key?: React.Key }) {
  return <div className="admin-card" style={{ padding: 14, ...style }}>{children}</div>;
}

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: string }) {
  const T: Record<string, string> = {
    muted: 'var(--admin-subtle)|var(--admin-text)',
    success: '#ecfdf5|#065f46',
    warn: '#fffbeb|#92400e',
    danger: '#fef2f2|#991b1b',
    info: '#eff6ff|#1e40af',
    accent: 'var(--admin-accent-soft)|var(--admin-accent-dark)',
  };
  const [bg, fg] = (T[tone] || T.muted).split('|');
  return (
    <span style={{
      background: bg, color: fg, borderRadius: 999, padding: '2px 9px',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {children}
    </span>
  );
}

/** ★ ช่องรหัสผ่าน — ซ่อนไว้ก่อน กด "แสดง" เพื่อดู */
function SecretField({ value, label }: { value: string; label: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <code style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 12.5, fontWeight: 700,
        background: 'var(--admin-subtle)', border: '1px solid var(--admin-border)',
        borderRadius: 6, padding: '4px 9px', minWidth: 104, display: 'inline-block',
        letterSpacing: show ? 0 : 1.5,
      }}>
        {show ? value : '•'.repeat(Math.max(6, value.length))}
      </code>
      <button
        className="bet-btn no-print"
        style={{ padding: '4px 8px', fontSize: 10.5 }}
        onClick={() => setShow(!show)}
        title={show ? 'ซ่อน' : 'แสดง'}
      >
        {show ? '🙈' : '👁️'}
      </button>
      <button
        className="bet-btn no-print"
        style={{ padding: '4px 8px', fontSize: 10.5 }}
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        title={`คัดลอก ${label}`}
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  );
}

/* ================================================================
 * หน้าหลัก
 * ================================================================ */

type Tab = 'access' | 'manual' | 'start' | 'trouble' | 'faq';

export default function BackofficeManual() {
  const [tab, setTab] = useState<Tab>('access');
  const [openSection, setOpenSection] = useState<string | null>('start');
  const [openTrouble, setOpenTrouble] = useState<number | null>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [search, setSearch] = useState('');

  const access = useMemo(() => getAccessTable(), []);
  const stats = useMemo(() => manualStats(), []);

  /** ★ ค้นหาทั้งคู่มือ */
  const matched = useMemo(() => {
    if (!search.trim()) return MANUAL_SECTIONS;
    const q = search.toLowerCase();
    return MANUAL_SECTIONS.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.purpose.toLowerCase().includes(q) ||
      s.steps.some(x => x.toLowerCase().includes(q)) ||
      (s.options || []).some(o =>
        o.name.toLowerCase().includes(q) || o.desc.toLowerCase().includes(q)),
    );
  }, [search]);

  const TABS: { id: Tab; icon: string; label: string; n?: number }[] = [
    { id: 'access',  icon: '🔑', label: 'รหัสผ่าน & ทางเข้า' },
    { id: 'manual',  icon: '📚', label: 'คู่มือฟังก์ชัน', n: MANUAL_SECTIONS.length },
    { id: 'start',   icon: '🚀', label: 'ตั้งค่าเริ่มต้น' },
    { id: 'trouble', icon: '🔧', label: 'แก้ปัญหา', n: TROUBLESHOOTING.length },
    { id: 'faq',     icon: '❓', label: 'คำถาม', n: ADMIN_FAQ.length },
  ];

  const SEVERITY_TONE: Record<string, string> = {
    error: 'danger', warn: 'warn', info: 'info',
  };
  const SEVERITY_BG: Record<string, string> = {
    error: '#fef2f2', warn: '#fffbeb', info: '#eff6ff',
  };
  const SEVERITY_FG: Record<string, string> = {
    error: '#991b1b', warn: '#92400e', info: '#1e40af',
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--admin-bg)',
      color: 'var(--admin-text)', paddingBottom: 40,
    }}>
      {/* ---------- หัวเรื่อง ---------- */}
      <div style={{
        padding: '16px 18px', background: 'var(--admin-card)',
        borderBottom: '1px solid var(--admin-border)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>📘</span>
          <div style={{ flex: 1, minWidth: 210 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: -.2 }}>
              คู่มือการตั้งค่าและใช้งาน
            </div>
            <div style={{ fontSize: 12, opacity: .7, marginTop: 1 }}>
              ทุกฟังก์ชันหลังบ้าน • {stats.sections} หมวด • {stats.totalPermissions} สิทธิ์ • {stats.roles} ตำแหน่ง
            </div>
          </div>
          <button className="bet-btn no-print" onClick={() => window.print()}>
            🖨️ พิมพ์
          </button>
        </div>

        <div className="bet-tabs" style={{ marginTop: 11, marginBottom: -14 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`bet-tabs__item${tab === t.id ? ' bet-tabs__item--active' : ''}`}
            >
              <span>{t.icon}</span>{t.label}
              {t.n !== undefined && (
                <span style={{
                  fontSize: 10, background: 'var(--admin-subtle)',
                  borderRadius: 999, padding: '1px 6px', marginLeft: 2,
                }}>
                  {t.n}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16, maxWidth: 1080, margin: '0 auto' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: .14 }}
          >

            {/* ================= รหัสผ่าน & ทางเข้า ================= */}
            {tab === 'access' && (
              <div style={{ display: 'grid', gap: 12 }}>

                {/* ★ คำเตือนความปลอดภัย */}
                <div className="bet-note bet-note--danger">
                  <span style={{ fontSize: 15 }}>🔴</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, marginBottom: 3 }}>
                      คำเตือนด้านความปลอดภัย
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.65 }}>
                      รหัสผ่านด้านล่างเป็น <b>ค่าเริ่มต้นสำหรับตั้งระบบครั้งแรก</b> เท่านั้น
                      <br />
                      • ต้องเปลี่ยนทันทีหลังติดตั้งเสร็จ
                      <br />
                      • ตั้งค่าใน <code>.env.local</code> เช่น <code>VITE_ADMIN_OWNER_PASS=...</code>
                      <br />
                      • <b>ห้าม commit ค่ารหัสจริงลง git</b>
                    </div>
                  </div>
                </div>

                {/* ★ ตารางรหัสผ่าน */}
                <Card>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 17 }}>🔑</span>
                    <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>
                      ตารางรหัสผ่าน & ทางเข้า
                    </div>
                    <Badge tone="accent">{access.length} ตำแหน่ง</Badge>
                  </div>

                  <div className="bet-table__wrap">
                    <table className="bet-table">
                      <thead>
                        <tr>
                          <th>ตำแหน่ง</th>
                          <th>ทางเข้า</th>
                          <th>ชื่อผู้ใช้</th>
                          <th>รหัสผ่านเริ่มต้น</th>
                          <th>สิทธิ์</th>
                        </tr>
                      </thead>
                      <tbody>
                        {access.map(a => (
                          <tr key={a.username}>
                            <td>
                              <div style={{ fontWeight: 700, fontSize: 12.5 }}>{a.name}</div>
                              <div style={{ marginTop: 3 }}>
                                <Badge tone="accent">{a.roleLabel}</Badge>
                              </div>
                            </td>
                            <td>
                              <a href={a.path} style={{ textDecoration: 'none' }}>
                                <code style={{
                                  fontSize: 11.5, fontFamily: 'ui-monospace, monospace',
                                  background: 'var(--admin-subtle)', borderRadius: 5,
                                  padding: '3px 7px', color: 'var(--admin-accent-dark)',
                                  fontWeight: 700, cursor: 'pointer',
                                }}>
                                  {a.path} ↗
                                </code>
                              </a>
                            </td>
                            <td>
                              <code style={{
                                fontSize: 12.5, fontWeight: 700,
                                fontFamily: 'ui-monospace, monospace',
                              }}>
                                {a.username}
                              </code>
                            </td>
                            <td>
                              <SecretField value={a.defaultPassword} label={a.name} />
                            </td>
                            <td>
                              <Badge tone={a.permCount >= 70 ? 'danger' : a.permCount >= 50 ? 'warn' : 'info'}>
                                {a.permCount} สิทธิ์
                              </Badge>
                              <div style={{ fontSize: 10.5, opacity: .65, marginTop: 4, lineHeight: 1.5 }}>
                                {a.note}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* ★ ตารางหน้าทั้งหมด */}
                <Card>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11,
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 17 }}>🗺️</span>
                    <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>
                      ทางเข้าทุกหน้าในระบบ
                    </div>
                    <Badge tone="accent">{ALL_PAGES.length} หน้า</Badge>
                  </div>

                  <div className="bet-table__wrap">
                    <table className="bet-table">
                      <thead>
                        <tr>
                          <th>หน้า</th>
                          <th>เส้นทาง (URL)</th>
                          <th>เข้าได้โดย</th>
                          <th>ทำอะไรได้</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ALL_PAGES.map(p => (
                          <tr key={p.path}>
                            <td style={{ fontWeight: 700, fontSize: 12.5 }}>{p.name}</td>
                            <td>
                              <a 
                                href={p.path.includes(':') ? '/lottery' : p.path} 
                                style={{ textDecoration: 'none' }}
                              >
                                <code style={{
                                  fontSize: 11.5, fontFamily: 'ui-monospace, monospace',
                                  color: 'var(--admin-accent-dark)', fontWeight: 700,
                                  background: 'var(--admin-subtle)', padding: '3px 7px',
                                  borderRadius: 5, cursor: 'pointer',
                                }}>
                                  {p.path} ↗
                                </code>
                              </a>
                            </td>
                            <td>
                              <Badge tone={p.auth.includes('owner') ? 'danger' : p.auth.includes('ทุก') ? 'success' : 'info'}>
                                {p.auth}
                              </Badge>
                            </td>
                            <td style={{ fontSize: 11.5, opacity: .8 }}>{p.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* ★ วิธีเปลี่ยนรหัส */}
                <Card>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 9 }}>
                    วิธีเปลี่ยนรหัสผ่าน
                  </div>
                  <div style={{ display: 'grid', gap: 9 }}>
                    <div style={{
                      padding: 11, background: 'var(--admin-subtle)', borderRadius: 9,
                    }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
                        วิธีที่ 1 — ผ่านไฟล์ .env.local (แนะนำ)
                      </div>
                      <pre style={{
                        margin: 0, fontSize: 11.5, fontFamily: 'ui-monospace, monospace',
                        background: 'var(--admin-card)', border: '1px solid var(--admin-border)',
                        borderRadius: 7, padding: 10, overflowX: 'auto', lineHeight: 1.7,
                      }}>
{`# .env.local
VITE_ADMIN_OWNER_PASS=รหัสใหม่ของเจ้าของ
VITE_ADMIN_ADMIN_PASS=รหัสใหม่ของผู้ดูแล
VITE_ADMIN_STAFF_PASS=รหัสใหม่ของพนักงาน`}
                      </pre>
                    </div>
                    <div style={{
                      padding: 11, background: 'var(--admin-subtle)', borderRadius: 9,
                    }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
                        วิธีที่ 2 — เพิ่มพนักงานใหม่
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.7, opacity: .85 }}>
                        ไปที่ <code>/admin</code> → แท็บ <b>"พนักงาน & สิทธิ์"</b> → กด <b>"เพิ่มพนักงาน"</b>
                        <br />
                        กำหนด username + ตำแหน่ง แล้วปรับสิทธิ์รายคนได้ทันที
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ================= คู่มือฟังก์ชัน ================= */}
            {tab === 'manual' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <Card>
                  <input
                    className="bet-input"
                    placeholder="🔍 ค้นหาฟังก์ชัน… เช่น บอท, อัตราจ่าย, รหัส, สิทธิ์"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <div style={{ fontSize: 11.5, opacity: .7, marginTop: 7 }}>
                      พบ {matched.length} จาก {MANUAL_SECTIONS.length} หมวด
                    </div>
                  )}
                </Card>

                {matched.length === 0 && (
                  <Card>
                    <div style={{ fontSize: 12.5, opacity: .7, textAlign: 'center', padding: 18 }}>
                      ไม่พบหัวข้อที่ตรงกับ "{search}"
                    </div>
                  </Card>
                )}

                {matched.map(s => {
                  const open = openSection === s.id;
                  return (
                    <Card key={s.id} style={{ padding: 0, overflow: 'hidden' }}>
                      <button
                        onClick={() => setOpenSection(open ? null : s.id)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '13px 15px',
                          background: open ? 'var(--admin-accent-soft)' : 'transparent',
                          border: 'none', cursor: 'pointer',
                          borderBottom: open ? '1px solid var(--admin-border)' : 'none',
                          display: 'flex', alignItems: 'center', gap: 11,
                        }}
                      >
                        <span style={{ fontSize: 19 }}>{s.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800 }}>{s.title}</div>
                          <div style={{ fontSize: 11.5, opacity: .72, marginTop: 1.5, lineHeight: 1.5 }}>
                            {s.purpose}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 11, opacity: .5,
                          transform: open ? 'rotate(180deg)' : 'none',
                          transition: 'transform .15s',
                        }}>
                          ▼
                        </span>
                      </button>

                      {open && (
                        <div style={{ padding: 15 }}>
                          {/* ที่อยู่ + สิทธิ์ */}
                          <div style={{
                            display: 'flex', gap: 14, flexWrap: 'wrap',
                            paddingBottom: 11, marginBottom: 11,
                            borderBottom: '1px solid var(--admin-border)',
                          }}>
                            <div>
                              <div style={{ fontSize: 10.5, opacity: .6, fontWeight: 700 }}>เข้าที่</div>
                              <code style={{
                                fontSize: 12, fontFamily: 'ui-monospace, monospace',
                                color: 'var(--admin-accent-dark)', fontWeight: 700,
                              }}>
                                {s.where}
                              </code>
                            </div>
                            {s.permission && (
                              <div>
                                <div style={{ fontSize: 10.5, opacity: .6, fontWeight: 700 }}>
                                  สิทธิ์ที่ต้องมี
                                </div>
                                <Badge tone="accent">{s.permission}</Badge>
                              </div>
                            )}
                          </div>

                          {/* ขั้นตอน */}
                          <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 7 }}>
                            ขั้นตอน
                          </div>
                          <div style={{ display: 'grid', gap: 0 }}>
                            {s.steps.map((st, i) => (
                              <div key={i} style={{ display: 'flex', gap: 10 }}>
                                <div style={{
                                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                                  flexShrink: 0,
                                }}>
                                  <div style={{
                                    width: 22, height: 22, borderRadius: '50%',
                                    background: 'var(--admin-accent)', color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 11, fontWeight: 800,
                                  }}>
                                    {i + 1}
                                  </div>
                                  {i < s.steps.length - 1 && (
                                    <div style={{
                                      flex: 1, width: 2, minHeight: 10,
                                      background: 'var(--admin-border)',
                                    }} />
                                  )}
                                </div>
                                <div style={{
                                  flex: 1, minWidth: 0, fontSize: 12.5,
                                  lineHeight: 1.65, paddingBottom: 10,
                                }}>
                                  {st}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* ตัวอย่าง */}
                          {s.example && (
                            <div style={{ marginTop: 5 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 5 }}>
                                ตัวอย่างการใช้งาน
                              </div>
                              <pre style={{
                                margin: 0, fontSize: 11.5,
                                fontFamily: 'ui-monospace, monospace',
                                background: '#eff6ff', border: '1px solid #bfdbfe66',
                                color: '#1e40af', borderRadius: 8, padding: 11,
                                overflowX: 'auto', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                              }}>
                                {s.example}
                              </pre>
                            </div>
                          )}

                          {/* ตัวเลือก */}
                          {s.options?.length ? (
                            <div style={{ marginTop: 11 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 6 }}>
                                ตัวเลือกทั้งหมด ({s.options.length})
                              </div>
                              <div className="bet-table__wrap">
                                <table className="bet-table">
                                  <thead>
                                    <tr>
                                      <th>ตัวเลือก</th>
                                      <th>ความหมาย</th>
                                      <th>ค่า</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {s.options.map((o, i) => (
                                      <tr key={i}>
                                        <td style={{ fontWeight: 700, fontSize: 12 }}>{o.name}</td>
                                        <td style={{ fontSize: 11.5, opacity: .82 }}>{o.desc}</td>
                                        <td>
                                          <code style={{
                                            fontSize: 11, fontFamily: 'ui-monospace, monospace',
                                            background: 'var(--admin-subtle)', borderRadius: 5,
                                            padding: '2px 7px',
                                          }}>
                                            {o.values || '-'}
                                          </code>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : null}

                          {/* คำเตือน */}
                          {s.warn && (
                            <div className="bet-note bet-note--warn" style={{ marginTop: 11 }}>
                              <span>⚠️</span>
                              <div style={{ flex: 1 }}>{s.warn}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {/* ================= ตั้งค่าเริ่มต้น ================= */}
            {tab === 'start' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <Card>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
                    🚀 ตั้งค่าครั้งแรก & เริ่มต้นระบบ — 5 ขั้นตอน (Vercel + Supabase)
                  </div>
                  <div style={{ fontSize: 12, opacity: .72, marginBottom: 14 }}>
                    สถาปัตยกรรมคลาวด์มาตรฐาน: Vercel Frontend + Supabase PostgreSQL
                  </div>

                  {[
                    {
                      n: 1, title: 'เชื่อมต่อฐานข้อมูล Supabase',
                      cmd: `# .env.local หรือ Vercel Environment Variables\nVITE_SUPABASE_URL=https://aogylynelbkjjdiclfeq.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`,
                      note: 'ตั้งค่า Environment Variables ในโปรเจกต์ Vercel เพื่อเชื่อมต่อฐานข้อมูล Supabase โดยตรง',
                    },
                    {
                      n: 2, title: '★ รัน SQL Schema ใน Supabase SQL Editor',
                      cmd: `# 1. เปิด Supabase Dashboard → โปรเจกต์ aogylynelbkjjdiclfeq\n# 2. ไปที่เมนู SQL Editor ด้านซ้าย\n# 3. นำโค้ดจากไฟล์ supabase_schema.sql ทั้งหมดมาวาง แล้วกดปุ่ม "Run"`,
                      note: '★ ขั้นตอนนี้สำคัญที่สุด — จะสร้างตารางครบ 10 ตาราง (users, staff, lottery_types, lottery_rounds, tickets, ticket_items, lottery_results, blocked_numbers, risk_intake_configs, transactions) พร้อมสร้างบัญชีเริ่มต้นและ RLS',
                      critical: true,
                    },
                    {
                      n: 3, title: '★ ตรวจสอบรอบหวย (Lottery Rounds)',
                      cmd: `# ตรวจสอบในตาราง lottery_rounds บน Supabase หรือหน้า /admin เมนูรอบหวย\n# หวยงวดปัจจุบันต้องมีสถานะ status = 'open'`,
                      note: '★ หน้าแทงหวย /lottery/:type/bet จะอนุญาตให้สมาชิกใส่ราคาและส่งโพยได้ก็ต่อเมื่อรอบหวยเปิดอยู่ (status = open) เท่านั้น',
                      critical: true,
                    },
                    {
                      n: 4, title: 'เข้าสู่ระบบหลังบ้าน (Admin Login)',
                      cmd: `# URL ทางเข้า: https://ak88-lotto.vercel.app/admin/login หรือ /admin\n# เข้าสู่ระบบด้วย:\n# - เจ้าของระบบ: Username: owner | Password: 0614284727\n# - ผู้ดูแลระบบ: Username: admin | Password: Password@123`,
                      note: 'เข้าสู่ระบบเพื่อจัดการเพดานรับกิน (Risk Limit), กำหนดเลขอั้น, ตรวจสอบสมาชิก และอนุมัติการฝาก-ถอน',
                    },
                    {
                      n: 5, title: 'ทดสอบส่งโพยหน้าบ้านจริง (Live Test)',
                      cmd: `# 1. เข้าสู่ระบบที่ https://ak88-lotto.vercel.app/login\n# 2. ล็อกอินด้วยสมาชิกทดสอบ: Username: user_test | Password: User1234!\n# 3. ไปที่หน้าแทงหวย https://ak88-lotto.vercel.app/lottery/thai/bet\n# 4. เลือกตัวเลข ใส่ราคา และกดยืนยันส่งโพย`,
                      note: 'สมาชิกทดสอบมีเครดิตเริ่มต้น ฿10,000.00 — เมื่อส่งโพยสำเร็จ ยอดเครดิตจะลดลง และโพยจะไปแสดงในหน้า /tickets ทันที',
                    },
                  ].map(st => (
                    <div key={st.n} style={{
                      display: 'flex', gap: 12, marginBottom: 14,
                      padding: 13, borderRadius: 10,
                      background: st.critical ? '#fffbeb' : 'var(--admin-subtle)',
                      border: `1px solid ${st.critical ? '#fcd34d66' : 'var(--admin-border)'}`,
                    }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: st.critical ? '#d97706' : 'var(--admin-accent)',
                        color: '#fff', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 13, fontWeight: 800,
                      }}>
                        {st.n}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 5 }}>
                          {st.critical ? '★ ' : ''}{st.title}
                        </div>
                        <pre style={{
                          margin: 0, fontSize: 11.5,
                          fontFamily: 'ui-monospace, monospace',
                          background: 'var(--admin-card)', border: '1px solid var(--admin-border)',
                          borderRadius: 7, padding: 10, overflowX: 'auto',
                          lineHeight: 1.7, whiteSpace: 'pre-wrap',
                        }}>
                          {st.cmd}
                        </pre>
                        <div style={{ fontSize: 11.5, opacity: .78, marginTop: 6, lineHeight: 1.6 }}>
                          {st.note}
                        </div>
                      </div>
                    </div>
                  ))}
                </Card>

                <Card>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 9 }}>
                    ✅ ตรวจสอบความพร้อมของระบบ
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.8 }}>
                    หลังติดตั้งเสร็จ ตรวจสอบ 4 ข้อนี้:
                    <br />
                    • เข้าหน้าแรก <code>https://ak88-lotto.vercel.app/</code> → หน้าเว็บโหลดรวดเร็ว แสดงรายการหวยครบถ้วน
                    <br />
                    • เข้า <code>/admin</code> หรือ <code>/admin/login</code> → เข้าสู่ระบบด้วย <code>owner</code> หรือ <code>admin</code> ได้สำเร็จ
                    <br />
                    • เข้า <code>/login</code> ด้วย <code>user_test</code> (รหัส <code>User1234!</code>) → ยอดเครดิตแสดง ฿10,000.00 และเลือกแทงหวยได้
                    <br />
                    • ลองส่งโพยทดสอบ 1 ใบ → ยอดเครดิตลดลง และมีรายการโพยขึ้นที่หน้า <code>/tickets</code> ทันที
                  </div>
                </Card>
              </div>
            )}

            {/* ================= แก้ปัญหา ================= */}
            {tab === 'trouble' && (
              <div style={{ display: 'grid', gap: 9 }}>
                <Card>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 3 }}>
                    🔧 แก้ปัญหา — {TROUBLESHOOTING.length} อาการที่พบบ่อย
                  </div>
                  <div style={{ fontSize: 11.5, opacity: .7 }}>
                    กดหัวข้อเพื่อดูสาเหตุและวิธีแก้
                  </div>
                </Card>

                {TROUBLESHOOTING.map((t, i) => {
                  const open = openTrouble === i;
                  return (
                    <Card key={i} style={{ padding: 0, overflow: 'hidden' }}>
                      <button
                        onClick={() => setOpenTrouble(open ? null : i)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '12px 14px',
                          background: open ? SEVERITY_BG[t.severity] : 'transparent',
                          border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}
                      >
                        <Badge tone={SEVERITY_TONE[t.severity]}>
                          {t.severity === 'error' ? '🔴 ร้ายแรง' : t.severity === 'warn' ? '🟡 เตือน' : '🔵 ข้อมูล'}
                        </Badge>
                        <span style={{
                          flex: 1, fontSize: 12.5, fontWeight: 700,
                          color: SEVERITY_FG[t.severity], lineHeight: 1.5,
                        }}>
                          {t.symptom}
                        </span>
                        <span style={{
                          fontSize: 10, opacity: .5,
                          transform: open ? 'rotate(180deg)' : 'none',
                          transition: 'transform .15s',
                        }}>
                          ▼
                        </span>
                      </button>

                      {open && (
                        <div style={{ padding: '0 14px 13px' }}>
                          <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 3, opacity: .7 }}>
                            สาเหตุ
                          </div>
                          <div style={{ fontSize: 12.5, marginBottom: 10, lineHeight: 1.65 }}>
                            {t.cause}
                          </div>
                          <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 4, opacity: .7 }}>
                            วิธีแก้
                          </div>
                          <div className="bet-note bet-note--success">
                            <span>✅</span>
                            <div style={{ flex: 1 }}>{t.fix}</div>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {/* ================= คำถาม ================= */}
            {tab === 'faq' && (
              <div style={{ display: 'grid', gap: 8 }}>
                <Card>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>
                    ❓ คำถามที่พบบ่อย — {ADMIN_FAQ.length} ข้อ
                  </div>
                </Card>

                {ADMIN_FAQ.map((f, i) => {
                  const open = openFaq === i;
                  return (
                    <Card key={i} style={{ padding: 0, overflow: 'hidden' }}>
                      <button
                        onClick={() => setOpenFaq(open ? null : i)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '12px 14px',
                          background: open ? 'var(--admin-accent-soft)' : 'transparent',
                          border: 'none', cursor: 'pointer',
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                        }}
                      >
                        <span style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          background: open ? 'var(--admin-accent)' : '#c9bfae',
                          color: '#fff', fontSize: 11, fontWeight: 800,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          marginTop: 1,
                        }}>
                          ?
                        </span>
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}>
                          {f.q}
                        </span>
                        <span style={{
                          fontSize: 10, opacity: .5, marginTop: 3,
                          transform: open ? 'rotate(180deg)' : 'none',
                          transition: 'transform .15s',
                        }}>
                          ▼
                        </span>
                      </button>
                      {open && (
                        <div style={{
                          padding: '0 14px 13px 44px',
                          fontSize: 12.5, lineHeight: 1.75, opacity: .9,
                        }}>
                          {f.a}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
