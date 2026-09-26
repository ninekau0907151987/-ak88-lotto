/**
 * src/shared/components/DataToolbar.tsx
 * ------------------------------------------------------------------
 * ★ แถบเครื่องมือค้นหา/กรอง/ขยาย — ใช้ซ้ำได้ทุกตาราง ★
 *
 * ผู้ใช้ขอ: "มีลูกเล่นฟังชั่นซ้อนช่วยการค้นหา ขยาย รายงาน ดูกราฟ เพิ่ม ลด อื่นๆ"
 *
 * ให้ทุกฟีเจอร์ในแถบเดียว:
 *   🔍 ค้นหา (พิมพ์ได้ทันที ไม่ต้องกด enter)
 *   📅 กรองช่วงวันที่ (เริ่ม-สิ้นสุด + ลัด 7/30 วัน)
 *   🏷️ กรองตามสถานะ (เลือกหลายค่าได้)
 *   📊 สลับมุมมอง ตาราง/กราฟ
 *   ⬇️ ส่งออก CSV
 *   ↕️ เรียงลำดับ
 *   🔄 ล้างตัวกรอง
 *   📈 ขยาย/ย่อความสูงตาราง
 */
import { useState, ReactNode } from 'react';
import { CREAM } from '@/shared/lib/theme';

export type ViewMode = 'table' | 'chart' | 'card';

export interface FilterOption {
  value: string;
  label: string;
  /** จำนวนรายการ (แสดงเป็นตัวเลขข้างชื่อ) */
  count?: number;
}

interface Props {
  /** คำค้นหา */
  search: string;
  onSearchChange: (v: string) => void;
  /** placeholder ช่องค้นหา */
  searchPlaceholder?: string;

  /** ช่วงวันที่ */
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (v: string) => void;
  onEndDateChange?: (v: string) => void;

  /** ตัวกรองสถานะ (เลือกได้หลายค่า) */
  statusOptions?: FilterOption[];
  selectedStatuses?: string[];
  onStatusToggle?: (v: string) => void;

  /** มุมมอง */
  viewMode?: ViewMode;
  onViewModeChange?: (v: ViewMode) => void;
  /** มุมมองที่เปิดใช้ (ไม่ส่ง = ทั้งหมด) */
  allowedViews?: ViewMode[];

  /** เรียงลำดับ */
  sortOptions?: FilterOption[];
  sortBy?: string;
  onSortChange?: (v: string) => void;

  /** ส่งออก */
  onExport?: () => void;
  exportLabel?: string;

  /** เพิ่มรายการ */
  onAdd?: () => void;
  addLabel?: string;

  /** ล้างตัวกรอง */
  onReset?: () => void;

  /** ขยายความสูงตาราง */
  expanded?: boolean;
  onToggleExpand?: () => void;

  /** เนื้อหาเพิ่มเติมทางขวา */
  extra?: ReactNode;

  /** สรุปจำนวนที่พบ */
  resultCount?: number;
  /** คำอธิบายผลลัพธ์ */
  resultLabel?: string;
}

export default function DataToolbar({
  search, onSearchChange, searchPlaceholder = 'ค้นหา...',
  startDate, endDate, onStartDateChange, onEndDateChange,
  statusOptions, selectedStatuses = [], onStatusToggle,
  viewMode, onViewModeChange, allowedViews,
  sortOptions, sortBy, onSortChange,
  onExport, exportLabel = 'ส่งออก',
  onAdd, addLabel = 'เพิ่ม',
  onReset,
  expanded, onToggleExpand,
  extra, resultCount, resultLabel = 'รายการ',
}: Props) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount =
    (startDate ? 1 : 0) + (endDate ? 1 : 0) + selectedStatuses.length;

  const views = allowedViews || (['table', 'chart', 'card'] as ViewMode[]);

  return (
    <div
      className="rounded-2xl border shadow-sm overflow-hidden"
      style={{ background: CREAM.card, borderColor: CREAM.border }}
    >
      {/* ============ แถวหลัก: ค้นหา + มุมมอง + เพิ่ม ============ */}
      <div className="p-3 flex flex-wrap items-center gap-2">
        {/* ช่องค้นหา */}
        <div className="relative flex-1 min-w-[180px]">
          <span
            className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-lg pointer-events-none"
            style={{ color: CREAM.textFaint }}
          >
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border-2 text-xs font-bold outline-none transition"
            style={{ background: CREAM.bg, borderColor: CREAM.border, color: CREAM.text }}
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: CREAM.borderStrong, color: CREAM.card }}
              title="ล้างคำค้นหา"
            >
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          )}
        </div>

        {/* ปุ่มเปิดตัวกรองซ้อน */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className="relative px-3 py-2.5 rounded-xl border-2 text-xs font-black flex items-center gap-1.5 transition"
          style={{
            background: showFilters ? CREAM.accentSoft : CREAM.bg,
            borderColor: showFilters ? CREAM.accent : CREAM.border,
            color: showFilters ? CREAM.accentDark : CREAM.textMuted,
          }}
          title="ตัวกรองเพิ่มเติม"
        >
          <span className="material-symbols-outlined text-base">tune</span>
          ตัวกรอง
          {activeFilterCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center"
              style={{ background: '#b3261e', color: '#fff' }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* สลับมุมมอง ตาราง/กราฟ */}
        {viewMode && onViewModeChange && views.length > 1 && (
          <div
            className="flex rounded-xl border-2 overflow-hidden"
            style={{ borderColor: CREAM.border, background: CREAM.bg }}
          >
            {views.map(v => (
              <button
                key={v}
                onClick={() => onViewModeChange(v)}
                className="px-2.5 py-2 text-xs font-black flex items-center gap-1 transition"
                style={viewMode === v
                  ? { background: CREAM.accent, color: '#fff' }
                  : { color: CREAM.textMuted }}
                title={v === 'table' ? 'มุมมองตาราง' : v === 'chart' ? 'มุมมองกราฟ' : 'มุมมองการ์ด'}
              >
                <span className="material-symbols-outlined text-base">
                  {v === 'table' ? 'table_rows' : v === 'chart' ? 'insights' : 'grid_view'}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ขยายความสูง */}
        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className="px-2.5 py-2.5 rounded-xl border-2 text-xs font-black transition"
            style={{
              background: expanded ? CREAM.accentSoft : CREAM.bg,
              borderColor: expanded ? CREAM.accent : CREAM.border,
              color: expanded ? CREAM.accentDark : CREAM.textMuted,
            }}
            title={expanded ? 'ย่อตาราง' : 'ขยายตารางให้สูงขึ้น'}
          >
            <span className="material-symbols-outlined text-base">
              {expanded ? 'unfold_less' : 'unfold_more'}
            </span>
          </button>
        )}

        {/* ส่งออก */}
        {onExport && (
          <button
            onClick={onExport}
            className="px-3 py-2.5 rounded-xl border-2 text-xs font-black flex items-center gap-1.5 transition"
            style={{ background: CREAM.bg, borderColor: CREAM.border, color: CREAM.text }}
            title="ส่งออกเป็นไฟล์ CSV"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span className="hidden sm:inline">{exportLabel}</span>
          </button>
        )}

        {/* เพิ่มรายการ */}
        {onAdd && (
          <button
            onClick={onAdd}
            className="px-3 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition active:scale-[0.98]"
            style={{ background: CREAM.accentDark, color: '#fff' }}
            title={addLabel}
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span className="hidden sm:inline">{addLabel}</span>
          </button>
        )}

        {extra}
      </div>

      {/* ============ แผงตัวกรองซ้อน (ซ่อนได้) ============ */}
      {showFilters && (
        <div
          className="px-3 py-3 border-t space-y-3"
          style={{ background: CREAM.subtle, borderColor: CREAM.border }}
        >
          {/* ช่วงวันที่ */}
          {(onStartDateChange || onEndDateChange) && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: CREAM.textMuted }}>
                ช่วงวันที่
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={startDate || ''}
                  onChange={e => onStartDateChange?.(e.target.value)}
                  className="px-2.5 py-2 rounded-lg border text-xs font-bold outline-none"
                  style={{ background: CREAM.card, borderColor: CREAM.border, color: CREAM.text }}
                />
                <span className="text-xs font-black" style={{ color: CREAM.textFaint }}>ถึง</span>
                <input
                  type="date"
                  value={endDate || ''}
                  onChange={e => onEndDateChange?.(e.target.value)}
                  className="px-2.5 py-2 rounded-lg border text-xs font-bold outline-none"
                  style={{ background: CREAM.card, borderColor: CREAM.border, color: CREAM.text }}
                />
                {/* ทางลัดช่วงเวลา */}
                {[
                  { label: 'วันนี้', days: 0 },
                  { label: '7 วัน', days: 6 },
                  { label: '30 วัน', days: 29 },
                  { label: '90 วัน', days: 89 },
                ].map(q => (
                  <button
                    key={q.label}
                    onClick={() => {
                      const end = new Date();
                      const start = new Date();
                      start.setDate(start.getDate() - q.days);
                      const fmt = (d: Date) => d.toISOString().slice(0, 10);
                      onStartDateChange?.(fmt(start));
                      onEndDateChange?.(fmt(end));
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition"
                    style={{ background: CREAM.card, borderColor: CREAM.border, color: CREAM.textMuted }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ตัวกรองสถานะ */}
          {statusOptions && statusOptions.length > 0 && onStatusToggle && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: CREAM.textMuted }}>
                สถานะ
                {selectedStatuses.length > 0 && (
                  <span className="ml-1.5" style={{ color: CREAM.accentDark }}>
                    (เลือก {selectedStatuses.length})
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map(opt => {
                  const active = selectedStatuses.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => onStatusToggle(opt.value)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-black border-2 transition flex items-center gap-1"
                      style={active
                        ? { background: CREAM.accent, borderColor: CREAM.accent, color: '#fff' }
                        : { background: CREAM.card, borderColor: CREAM.border, color: CREAM.textMuted }}
                    >
                      {active && <span className="material-symbols-outlined text-[12px]">check</span>}
                      {opt.label}
                      {opt.count !== undefined && (
                        <span
                          className="px-1 rounded text-[9px] tabular-nums"
                          style={active
                            ? { background: 'rgba(255,255,255,0.25)' }
                            : { background: CREAM.subtle, color: CREAM.textFaint }}
                        >
                          {opt.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* เรียงลำดับ */}
          {sortOptions && sortOptions.length > 0 && onSortChange && (
            <div>
              <div className="text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: CREAM.textMuted }}>
                เรียงลำดับ
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sortOptions.map(opt => {
                  const active = sortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => onSortChange(opt.value)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-black border-2 transition flex items-center gap-1"
                      style={active
                        ? { background: CREAM.accentDark, borderColor: CREAM.accentDark, color: '#fff' }
                        : { background: CREAM.card, borderColor: CREAM.border, color: CREAM.textMuted }}
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        {opt.value.endsWith('_asc') ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ล้างตัวกรอง */}
          {onReset && activeFilterCount > 0 && (
            <button
              onClick={onReset}
              className="px-3 py-2 rounded-lg text-[11px] font-black border-2 flex items-center gap-1.5 transition"
              style={{ background: '#fdecea', borderColor: '#f0cdc8', color: '#b3261e' }}
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
              ล้างตัวกรองทั้งหมด ({activeFilterCount})
            </button>
          )}
        </div>
      )}

      {/* ============ แถบสรุปผลลัพธ์ ============ */}
      {resultCount !== undefined && (
        <div
          className="px-3 py-1.5 border-t flex items-center justify-between text-[10px] font-bold"
          style={{ background: CREAM.subtle, borderColor: CREAM.border, color: CREAM.textMuted }}
        >
          <span>
            พบ <span className="font-black" style={{ color: CREAM.accentDark }}>{resultCount.toLocaleString('th-TH')}</span> {resultLabel}
            {activeFilterCount > 0 && <span className="ml-1">· กรองอยู่ {activeFilterCount} เงื่อนไข</span>}
          </span>
          {search && (
            <span>
              คำค้น: <span className="font-black" style={{ color: CREAM.accentDark }}>"{search}"</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * ตัวช่วย: กรอง/เรียง/ส่งออก ข้อมูล
 * ============================================================ */

/** กรองตามคำค้นหาทุก field (deep search) */
export function searchIn<T extends Record<string, any>>(items: T[], q: string, fields?: (keyof T)[]): T[] {
  if (!q.trim()) return items;
  const needle = q.trim().toLowerCase();
  return items.filter(item => {
    const keys = fields || (Object.keys(item) as (keyof T)[]);
    return keys.some(k => {
      const v = item[k];
      if (v === null || v === undefined) return false;
      return String(v).toLowerCase().includes(needle);
    });
  });
}

/** กรองตามช่วงวันที่ (ใช้ field createdAt/issuedAt/timestamp) */
export function filterByDate<T extends Record<string, any>>(
  items: T[], start?: string, end?: string, field = 'createdAt',
): T[] {
  if (!start && !end) return items;
  return items.filter(item => {
    const raw = item[field] || item.createdAt || item.timestamp;
    if (!raw) return false;
    const d = String(raw).slice(0, 10);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

/** เรียงลำดับ: 'createdAt_desc' → ใหม่ก่อน */
export function sortItems<T extends Record<string, any>>(items: T[], sortBy: string): T[] {
  if (!sortBy) return items;
  const desc = sortBy.endsWith('_desc');
  const field = sortBy.replace(/_(asc|desc)$/, '');
  return [...items].sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    // ตัวเลข เทียบเป็นตัวเลข
    if (typeof av === 'number' && typeof bv === 'number') {
      return desc ? bv - av : av - bv;
    }
    const cmp = String(av).localeCompare(String(bv));
    return desc ? -cmp : cmp;
  });
}

/** ส่งออก CSV — มี BOM ให้ Excel อ่านภาษาไทยถูก */
export function exportCsv(rows: Record<string, any>[], columns: { key: string; label: string }[], filename: string) {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const body = rows.map(r =>
    columns.map(c => {
      const v = r[c.key];
      const s = v === null || v === undefined ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(','),
  ).join('\n');

  const blob = new Blob(['\ufeff' + header + '\n' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
