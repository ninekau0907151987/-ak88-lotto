/**
 * src/backend/pages/BackofficeManual.tsx
 * ------------------------------------------------------------------
 * ★ คู่มือการตั้งค่าและใช้งาน — ทุกฟังก์ชันหลังบ้าน AK88 Lotto ★
 *
 * ระบบสถาปัตยกรรม:
 *   - Frontend: React + TypeScript โฮสต์บน Vercel (https://ak88-lotto.vercel.app)
 *   - Database & Backend: Supabase PostgreSQL
 *
 * แท็บ:
 *   1. ★ รหัสผ่าน & ทางเข้า — ตารางครบทุกตำแหน่ง + 32 หน้าทั้งหมดพร้อมลิงก์ตรง
 *   2. คู่มือฟังก์ชัน (15 หมวดหมู่) — อธิบายขั้นตอน ตัวอย่าง และตัวเลือก
 *   3. ตั้งค่าเริ่มต้น — Quick Start 5 ขั้นตอน (Vercel + Supabase)
 *   4. แก้ปัญหา — 12 อาการที่พบบ่อยพร้อมวิธีแก้จริง
 *   5. คำถามที่พบบ่อย (FAQ 12 ข้อ)
 *
 * ★ ธีมครีม (--admin-*) สอดคล้องกับระบบหลังบ้าน
 * ★ รองรับการพิมพ์ (@media print)
 * ==================================================================
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getAccessTable, ALL_PAGES, MANUAL_SECTIONS, TROUBLESHOOTING,
  ADMIN_FAQ, manualStats, type ManualSection, type AccessEntry, type PageRoute,
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
    gold: '#fef3c7|#b45309',
    purple: '#f3e8ff|#6b21a8',
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

/** ★ รหัสผ่าน — ซ่อนไว้ก่อน กดแสดงหรือคัดลอก */
function SecretField({ value, label }: { value: string; label: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <code style={{
        fontFamily: 'ui-monospace, monospace', fontSize: 12.5, fontWeight: 700,
        background: 'var(--admin-subtle)', border: '1px solid var(--admin-border)',
        borderRadius: 6, padding: '4px 8px', minWidth: 96, display: 'inline-block',
        letterSpacing: show ? 0 : 1.5,
      }}>
        {show ? value : '•'.repeat(Math.max(6, value.length))}
      </code>
      <button
        className="bet-btn no-print"
        style={{ padding: '4px 7px', fontSize: 10 }}
        onClick={() => setShow(!show)}
        title={show ? 'ซ่อน' : 'แสดง'}
      >
        {show ? '🙈' : '👁️'}
      </button>
      <button
        className="bet-btn no-print"
        style={{ padding: '4px 7px', fontSize: 10 }}
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        title={`คัดลอกรหัสผ่าน ${label}`}
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  );
}

/** ★ กล่องข้อความแบบคัดลอกได้ */
function CopyableCode({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <code style={{
        fontSize: 12, fontWeight: 700,
        fontFamily: 'ui-monospace, monospace',
        background: 'var(--admin-subtle)', borderRadius: 5, padding: '3px 7px',
      }}>
        {text}
      </code>
      <button
        className="bet-btn no-print"
        style={{ padding: '3px 6px', fontSize: 9.5 }}
        onClick={() => {
          navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        title={`คัดลอก ${label || text}`}
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

  // ฟิลเตอร์หมวดหมู่ตารางรหัสผ่าน & ทางเข้า
  const [accountFilter, setAccountFilter] = useState<'all' | 'admin' | 'master' | 'member' | 'staff'>('all');
  const [pageFilter, setPageFilter] = useState<'all' | 'admin' | 'master' | 'player' | 'finance' | 'rules'>('all');
  const [pageSearch, setPageSearch] = useState('');

  const access = useMemo(() => getAccessTable(), []);
  const stats = useMemo(() => manualStats(), []);

  /** ฟิลเตอร์บัญชี */
  const filteredAccounts = useMemo(() => {
    if (accountFilter === 'all') return access;
    return access.filter(a => a.category === accountFilter);
  }, [access, accountFilter]);

  /** ฟิลเตอร์หน้าทั้งหมด */
  const filteredPages = useMemo(() => {
    return ALL_PAGES.filter(p => {
      const matchCat = pageFilter === 'all' || p.category === pageFilter;
      const matchSearch = !pageSearch.trim() || 
        p.name.toLowerCase().includes(pageSearch.toLowerCase()) ||
        p.path.toLowerCase().includes(pageSearch.toLowerCase()) ||
        p.desc.toLowerCase().includes(pageSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [pageFilter, pageSearch]);

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
    { id: 'access',  icon: '🔑', label: 'รหัสผ่าน & ทางเข้า', n: access.length },
    { id: 'manual',  icon: '📚', label: 'คู่มือฟังก์ชัน', n: MANUAL_SECTIONS.length },
    { id: 'start',   icon: '🚀', label: 'ตั้งค่าเริ่มต้น' },
    { id: 'trouble', icon: '🔧', label: 'แก้ปัญหา', n: TROUBLESHOOTING.length },
    { id: 'faq',     icon: '❓', label: 'คำถามที่พบบ่อย', n: ADMIN_FAQ.length },
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
      {/* ---------- Header Navigation ---------- */}
      <div style={{
        padding: '16px 18px', background: 'var(--admin-card)',
        borderBottom: '1px solid var(--admin-border)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 24 }}>📘</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -.2 }}>
              คู่มือการตั้งค่าและใช้งาน — AK88 Lotto
            </div>
            <div style={{ fontSize: 12, opacity: .75, marginTop: 2 }}>
              ระบบหลังบ้าน • {stats.sections} หมวด • {stats.pages} เส้นทางระบบ • ฐานข้อมูล Supabase PostgreSQL
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a 
              href="/admin" 
              className="bet-btn no-print" 
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', fontSize: 12 }}
            >
              ⚙️ แดชบอร์ด
            </a>
            <button className="bet-btn no-print" onClick={() => window.print()} style={{ padding: '7px 13px', fontSize: 12 }}>
              🖨️ พิมพ์คู่มือ
            </button>
          </div>
        </div>

        <div className="bet-tabs" style={{ marginTop: 12, marginBottom: -14, overflowX: 'auto', flexWrap: 'nowrap' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`bet-tabs__item${tab === t.id ? ' bet-tabs__item--active' : ''}`}
              style={{ whiteSpace: 'nowrap' }}
            >
              <span>{t.icon}</span>{t.label}
              {t.n !== undefined && (
                <span style={{
                  fontSize: 10, background: 'var(--admin-subtle)',
                  borderRadius: 999, padding: '1px 6px', marginLeft: 4,
                }}>
                  {t.n}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 16, maxWidth: 1120, margin: '0 auto' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: .14 }}
          >

            {/* ================= 1. รหัสผ่าน & ทางเข้า ================= */}
            {tab === 'access' && (
              <div style={{ display: 'grid', gap: 14 }}>

                {/* ★ กล่องเตือนความปลอดภัย & สรุปทางเข้า */}
                <div className="bet-note bet-note--danger">
                  <span style={{ fontSize: 16 }}>🔴</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, marginBottom: 3, fontSize: 13 }}>
                      คำเตือนด้านความปลอดภัย & ทางเข้าใช้งานระบบ
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.65 }}>
                      รหัสผ่านในตารางด้านล่างเป็น <b>รหัสผ่านที่เปิดใช้งานอยู่จริงในระบบ</b> ทั้งฝั่งผู้ดูแลระบบ (Admin/Owner), มาสเตอร์ (/master), และสมาชิกทดสอบ (a123456 / user_test เครดิต ฿10,000)
                      <br />
                      • สำหรับเซิร์ฟเวอร์จริง: แนะนำเปลี่ยนรหัสผ่านใน <code>Vercel Environment Variables</code> หรือแก้ไขในตาราง <code>staff</code> บน Supabase
                      <br />
                      • สามารถกดปุ่ม <b>"คัดลอก 📋"</b> เพื่อนำรหัสไปใช้ล็อกอินได้ทันที
                    </div>
                  </div>
                </div>

                {/* ★ ตารางรหัสผ่าน & บัญชีทั้งหมด */}
                <Card>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 12, flexWrap: 'wrap', gap: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>🔑</span>
                      <div style={{ fontSize: 14.5, fontWeight: 800 }}>
                        ตารางรหัสผ่าน & สิทธิ์การเข้าใช้งาน
                      </div>
                      <Badge tone="accent">{filteredAccounts.length} บัญชี</Badge>
                    </div>

                    {/* ฟิลเตอร์ประเภทบัญชี */}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {[
                        { id: 'all', label: 'ทั้งหมด' },
                        { id: 'admin', label: 'ผู้ดูแล (Admin/Owner)' },
                        { id: 'master', label: 'มาสเตอร์ (Master)' },
                        { id: 'member', label: 'สมาชิก (Member)' },
                        { id: 'staff', label: 'พนักงาน & เอเย่นต์' },
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setAccountFilter(f.id as any)}
                          className="bet-btn no-print"
                          style={{
                            padding: '3px 8px', fontSize: 11,
                            background: accountFilter === f.id ? 'var(--admin-accent)' : 'transparent',
                            color: accountFilter === f.id ? '#fff' : 'inherit',
                            borderColor: accountFilter === f.id ? 'var(--admin-accent)' : 'var(--admin-border)',
                          }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bet-table__wrap">
                    <table className="bet-table">
                      <thead>
                        <tr>
                          <th>ตำแหน่ง / บัญชี</th>
                          <th>ทางเข้า</th>
                          <th>ชื่อผู้ใช้ (Username)</th>
                          <th>รหัสผ่าน (Password)</th>
                          <th>เครดิต / สิทธิ์</th>
                          <th>การทำงาน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.map(a => (
                          <tr key={a.username}>
                            <td>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</div>
                              <div style={{ marginTop: 4, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                <Badge tone={a.category === 'admin' ? 'danger' : a.category === 'master' ? 'purple' : a.category === 'member' ? 'gold' : 'info'}>
                                  {a.roleLabel}
                                </Badge>
                                {a.balance && <Badge tone="success">{a.balance}</Badge>}
                              </div>
                            </td>
                            <td>
                              <a href={a.path} style={{ textDecoration: 'none' }} target="_blank" rel="noreferrer">
                                <code style={{
                                  fontSize: 11.5, fontFamily: 'ui-monospace, monospace',
                                  background: 'var(--admin-subtle)', borderRadius: 5,
                                  padding: '4px 8px', color: 'var(--admin-accent-dark)',
                                  fontWeight: 700, display: 'inline-block',
                                }}>
                                  {a.path} ↗
                                </code>
                              </a>
                            </td>
                            <td>
                              <CopyableCode text={a.username} label={`Username: ${a.username}`} />
                            </td>
                            <td>
                              <SecretField value={a.defaultPassword} label={a.name} />
                            </td>
                            <td>
                              <Badge tone={a.permCount >= 70 ? 'danger' : a.permCount >= 50 ? 'warn' : 'info'}>
                                {a.permCount} สิทธิ์
                              </Badge>
                              <div style={{ fontSize: 11, opacity: .7, marginTop: 4, lineHeight: 1.5 }}>
                                {a.note}
                              </div>
                            </td>
                            <td>
                              <a 
                                href={a.path} 
                                className="bet-btn no-print" 
                                style={{
                                  textDecoration: 'none', padding: '4px 8px', fontSize: 11,
                                  whiteSpace: 'nowrap', display: 'inline-block',
                                }}
                              >
                                🔗 เข้าสู่ระบบ
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* ★ ทางเข้าทุกหน้าในระบบ (32 หน้า) */}
                <Card>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 12, flexWrap: 'wrap', gap: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>🗺️</span>
                      <div style={{ fontSize: 14.5, fontWeight: 800 }}>
                        สารบัญทางเข้าทุกหน้าในระบบ (All System Routes)
                      </div>
                      <Badge tone="accent">{filteredPages.length} จาก {ALL_PAGES.length} หน้า</Badge>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        className="bet-input"
                        placeholder="🔍 ค้นหาหน้า เช่น หวย, ยี่กี, ฝาก..."
                        value={pageSearch}
                        onChange={e => setPageSearch(e.target.value)}
                        style={{ padding: '4px 9px', fontSize: 11.5, width: 170 }}
                      />
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          { id: 'all', label: 'ทั้งหมด' },
                          { id: 'admin', label: 'หลังบ้าน' },
                          { id: 'master', label: 'มาสเตอร์' },
                          { id: 'player', label: 'แทงหวย' },
                          { id: 'finance', label: 'การเงิน' },
                          { id: 'rules', label: 'กติกา' },
                        ].map(f => (
                          <button
                            key={f.id}
                            onClick={() => setPageFilter(f.id as any)}
                            className="bet-btn no-print"
                            style={{
                              padding: '3px 7px', fontSize: 10.5,
                              background: pageFilter === f.id ? 'var(--admin-accent)' : 'transparent',
                              color: pageFilter === f.id ? '#fff' : 'inherit',
                              borderColor: pageFilter === f.id ? 'var(--admin-accent)' : 'var(--admin-border)',
                            }}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bet-table__wrap">
                    <table className="bet-table">
                      <thead>
                        <tr>
                          <th>ชื่อหน้า</th>
                          <th>เส้นทาง URL (คลิกเพื่อเปิด)</th>
                          <th>หมวดหมู่</th>
                          <th>สิทธิ์การเข้าถึง</th>
                          <th>หน้าที่และรายละเอียด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPages.map(p => (
                          <tr key={p.path}>
                            <td style={{ fontWeight: 700, fontSize: 12.5 }}>{p.name}</td>
                            <td>
                              <a 
                                href={p.path} 
                                style={{ textDecoration: 'none' }}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <code style={{
                                  fontSize: 11.5, fontFamily: 'ui-monospace, monospace',
                                  color: 'var(--admin-accent-dark)', fontWeight: 700,
                                  background: 'var(--admin-subtle)', padding: '4px 8px',
                                  borderRadius: 5, cursor: 'pointer', display: 'inline-block',
                                }}>
                                  {p.path} ↗
                                </code>
                              </a>
                            </td>
                            <td>
                              <Badge tone={p.category === 'admin' ? 'danger' : p.category === 'master' ? 'purple' : p.category === 'finance' ? 'gold' : p.category === 'rules' ? 'warn' : 'info'}>
                                {p.category === 'admin' ? 'หลังบ้าน' : p.category === 'master' ? 'มาสเตอร์' : p.category === 'finance' ? 'การเงิน' : p.category === 'rules' ? 'กติกา' : 'สมาชิก'}
                              </Badge>
                            </td>
                            <td>
                              <Badge tone={p.auth.includes('owner') ? 'danger' : p.auth.includes('master') ? 'purple' : p.auth.includes('สาธารณะ') ? 'success' : 'info'}>
                                {p.auth}
                              </Badge>
                            </td>
                            <td style={{ fontSize: 11.5, opacity: .85 }}>{p.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* ★ วิธีเปลี่ยนรหัสผ่าน */}
                <Card>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 9 }}>
                    วิธีเปลี่ยนรหัสผ่านผู้ดูแลและพนักงาน
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
                    <div style={{ padding: 12, background: 'var(--admin-subtle)', borderRadius: 9 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
                        วิธีที่ 1 — ผ่าน Vercel Environment Variables
                      </div>
                      <div style={{ fontSize: 11.5, opacity: .8, marginBottom: 6 }}>
                        ไปที่ Vercel Dashboard → Settings → Environment Variables:
                      </div>
                      <pre style={{
                        margin: 0, fontSize: 11, fontFamily: 'ui-monospace, monospace',
                        background: 'var(--admin-card)', border: '1px solid var(--admin-border)',
                        borderRadius: 7, padding: 9, overflowX: 'auto', lineHeight: 1.6,
                      }}>
{`VITE_ADMIN_OWNER_PASS=รหัสใหม่ของเจ้าของ
VITE_ADMIN_ADMIN_PASS=รหัสใหม่ของผู้ดูแล
VITE_MASTER_PASS=รหัสใหม่ของมาสเตอร์`}
                      </pre>
                    </div>

                    <div style={{ padding: 12, background: 'var(--admin-subtle)', borderRadius: 9 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
                        วิธีที่ 2 — จัดการผ่านตาราง staff ในหลังบ้าน
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.7, opacity: .85 }}>
                        1. ไปที่ <a href="/admin" style={{ fontWeight: 700 }}>/admin</a> → แท็บ <b>"พนักงาน & สิทธิ์"</b>
                        <br />
                        2. เลือกบัญชีพนักงานที่ต้องการแก้ไข แล้วกด <b>"แก้ไขข้อมูล"</b>
                        <br />
                        3. ป้อนรหัสผ่านใหม่ แล้วกด <b>"บันทึก"</b>
                        <br />
                        4. สิทธิ์จะอัปเดตลงตาราง <code>staff</code> ใน Supabase ทันที
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ================= 2. คู่มือฟังก์ชัน ================= */}
            {tab === 'manual' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <Card>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      className="bet-input"
                      placeholder="🔍 ค้นหาฟังก์ชัน… เช่น บอท, อัตราจ่าย, รหัส, สิทธิ์, ยี่กี, มาสเตอร์"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ flex: 1, minWidth: 240 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="bet-btn no-print"
                        onClick={() => setOpenSection(openSection === 'all' ? null : 'all')}
                        style={{ fontSize: 11.5, padding: '5px 10px' }}
                      >
                        {openSection === 'all' ? 'ยุบทั้งหมด' : 'ขยายทั้งหมด'}
                      </button>
                    </div>
                  </div>
                  {search && (
                    <div style={{ fontSize: 11.5, opacity: .7, marginTop: 7 }}>
                      พบ {matched.length} จาก {MANUAL_SECTIONS.length} หมวดหมู่
                    </div>
                  )}
                </Card>

                {matched.length === 0 && (
                  <Card>
                    <div style={{ fontSize: 12.5, opacity: .7, textAlign: 'center', padding: 22 }}>
                      ไม่พบหัวข้อที่ตรงกับ "{search}"
                    </div>
                  </Card>
                )}

                {matched.map(s => {
                  const isOpen = openSection === 'all' || openSection === s.id;
                  return (
                    <Card key={s.id} style={{ padding: 0, overflow: 'hidden' }}>
                      <button
                        onClick={() => setOpenSection(isOpen && openSection !== 'all' ? null : s.id)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '13px 15px',
                          background: isOpen ? 'var(--admin-accent-soft)' : 'transparent',
                          border: 'none', cursor: 'pointer',
                          borderBottom: isOpen ? '1px solid var(--admin-border)' : 'none',
                          display: 'flex', alignItems: 'center', gap: 11,
                        }}
                      >
                        <span style={{ fontSize: 20 }}>{s.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800 }}>{s.title}</div>
                          <div style={{ fontSize: 11.5, opacity: .75, marginTop: 2, lineHeight: 1.5 }}>
                            {s.purpose}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 11, opacity: .5,
                          transform: isOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform .15s',
                        }}>
                          ▼
                        </span>
                      </button>

                      {isOpen && (
                        <div style={{ padding: 16 }}>
                          {/* ตำแหน่ง & สิทธิ์ */}
                          <div style={{
                            display: 'flex', gap: 14, flexWrap: 'wrap',
                            paddingBottom: 11, marginBottom: 12,
                            borderBottom: '1px solid var(--admin-border)',
                          }}>
                            <div>
                              <div style={{ fontSize: 10.5, opacity: .6, fontWeight: 700 }}>ทางเข้าใช้งาน</div>
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
                          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                            ขั้นตอนการทำงาน
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
                                      flex: 1, width: 2, minHeight: 12,
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
                            <div style={{ marginTop: 6 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 5 }}>
                                ตัวอย่างการใช้งานจริง
                              </div>
                              <pre style={{
                                margin: 0, fontSize: 11.5,
                                fontFamily: 'ui-monospace, monospace',
                                background: '#eff6ff', border: '1px solid #bfdbfe88',
                                color: '#1e40af', borderRadius: 8, padding: 11,
                                overflowX: 'auto', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                              }}>
                                {s.example}
                              </pre>
                            </div>
                          )}

                          {/* ตัวเลือก */}
                          {s.options?.length ? (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 6 }}>
                                ตัวเลือกทั้งหมด ({s.options.length})
                              </div>
                              <div className="bet-table__wrap">
                                <table className="bet-table">
                                  <thead>
                                    <tr>
                                      <th>ตัวเลือก</th>
                                      <th>ความหมาย</th>
                                      <th>ค่าการทำงาน</th>
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
                            <div className="bet-note bet-note--warn" style={{ marginTop: 12 }}>
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

            {/* ================= 3. ตั้งค่าเริ่มต้น ================= */}
            {tab === 'start' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <Card>
                  <div style={{ fontSize: 15.5, fontWeight: 800, marginBottom: 4 }}>
                    🚀 ตั้งค่าครั้งแรก & เริ่มต้นระบบ — 5 ขั้นตอน (Vercel + Supabase)
                  </div>
                  <div style={{ fontSize: 12, opacity: .75, marginBottom: 14 }}>
                    สถาปัตยกรรมคลาวด์มาตรฐาน: Vercel Frontend + Supabase PostgreSQL
                  </div>

                  {[
                    {
                      n: 1, title: 'เชื่อมต่อฐานข้อมูล Supabase',
                      cmd: `# Vercel Dashboard → Environment Variables\nVITE_SUPABASE_URL=https://aogylynelbkjjdiclfeq.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`,
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
                      cmd: `# URL ทางเข้า: https://ak88-lotto.vercel.app/admin/login หรือ /admin\n# เข้าสู่ระบบด้วย:\n# - เจ้าของระบบ: Username: owner | Password: 0614284727\n# - ผู้ดูแลระบบ: Username: admin | Password: Password@123\n# - แดชบอร์ดมาสเตอร์: เข้าที่ /master | Password: 112233`,
                      note: 'เข้าสู่ระบบเพื่อจัดการเพดานรับกิน (Risk Limit), กำหนดเลขอั้น, ตรวจสอบสมาชิก และอนุมัติการฝาก-ถอน',
                    },
                    {
                      n: 5, title: 'ทดสอบส่งโพยหน้าบ้านจริง (Live Test)',
                      cmd: `# 1. เข้าสู่ระบบที่ https://ak88-lotto.vercel.app/login\n# 2. ล็อกอินด้วย: Username: a123456 | Password: 123456 (หรือ user_test / User1234!)\n# 3. ไปที่หน้าแทงหวย https://ak88-lotto.vercel.app/lottery/thai/bet\n# 4. เลือกตัวเลข ใส่ราคา และกดยืนยันส่งโพย`,
                      note: 'สมาชิกมีเครดิตเริ่มต้น ฿10,000.00 — เมื่อส่งโพยสำเร็จ ยอดเครดิตจะลดลง และโพยจะไปแสดงในหน้า /tickets ทันที',
                    },
                  ].map(st => (
                    <div key={st.n} style={{
                      display: 'flex', gap: 12, marginBottom: 14,
                      padding: 13, borderRadius: 10,
                      background: st.critical ? '#fffbeb' : 'var(--admin-subtle)',
                      border: `1px solid ${st.critical ? '#fcd34d66' : 'var(--admin-border)'}`,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: st.critical ? '#d97706' : 'var(--admin-accent)',
                        color: '#fff', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 13, fontWeight: 800,
                      }}>
                        {st.n}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 5 }}>
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
                        <div style={{ fontSize: 11.5, opacity: .8, marginTop: 6, lineHeight: 1.6 }}>
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
                    • เข้า <code>/login</code> ด้วย <code>a123456</code> (รหัส <code>123456</code>) → ยอดเครดิตแสดง ฿10,000.00 และเลือกแทงหวยได้
                    <br />
                    • ลองส่งโพยทดสอบ 1 ใบ → ยอดเครดิตลดลง และมีรายการโพยขึ้นที่หน้า <code>/tickets</code> ทันที
                  </div>
                </Card>
              </div>
            )}

            {/* ================= 4. แก้ปัญหา ================= */}
            {tab === 'trouble' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <Card>
                  <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 3 }}>
                    🔧 วิธีแก้ปัญหา — {TROUBLESHOOTING.length} อาการที่พบบ่อย
                  </div>
                  <div style={{ fontSize: 11.5, opacity: .7 }}>
                    คลิกหัวข้อเพื่อดูสาเหตุและแนวทางแก้ไขทันที
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

            {/* ================= 5. คำถามที่พบบ่อย ================= */}
            {tab === 'faq' && (
              <div style={{ display: 'grid', gap: 9 }}>
                <Card>
                  <div style={{ fontSize: 14.5, fontWeight: 800 }}>
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
