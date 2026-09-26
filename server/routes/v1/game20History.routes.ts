/**
 * server/routes/v1/game20History.routes.ts
 * ------------------------------------------------------------------
 * ★ ประวัติ + รหัส + แก้ไขผลย้อนหลัง ★
 *
 * prefix: /api/v1/game20 (ต่อจาก game20.routes.ts)
 *
 * เส้นในไฟล์นี้:
 *   GET    /history                — ประวัติทั้งหมด (กรอง/ค้นหา)
 *   GET    /history/stats          — สถิติประวัติ
 *   GET    /history/export         — ส่งออก CSV
 *   GET    /history/verify         — ★ ตรวจ checksum ว่ามีใครแก้ข้อมูลไหม
 *   POST   /history                — บันทึกรายการประวัติเอง
 *   GET    /rounds/:id/history     — ประวัติของรอบเดียว
 *   POST   /rounds/:id/edit        — ★ แก้ไขรหัสผล (ต้องมีเหตุผล)
 *   POST   /rounds/:id/recompute   — คำนวณผลใหม่จากเลข 20 ช่อง
 *   POST   /rounds/:id/unlock      — ปลดล็อกรอบ
 *   POST   /rounds/:id/lock        — ล็อกรอบ
 *   GET    /codes                  — รายการรหัส
 *   POST   /codes                  — ★ สร้างรหัสใหม่
 *   PUT    /codes/:id              — แก้ไขรหัส
 *   POST   /codes/:id/verify       — ตรวจรหัส
 *   DELETE /codes/:id              — ลบรหัส
 *   GET    /guide                  — กติกา/วิธีการเล่น (ข้อความ)
 *   GET    /guide/svg              — ★ ภาพกติกา (SVG)
 *
 * ลำดับเส้น: static ก่อน param เสมอ
 * ==================================================================
 */
import { Router } from 'express';
import { requirePermission } from '../../middleware/permission';
import { asyncHandler } from '../../middleware/error-handler';
import { ok, okList, ERR } from '../../lib/response';
import { AppError } from '../../lib/wallet';
import {
  makeHistoryEntry, prepareEditResult, verifyHistoryEntry, filterHistory,
  historyStats, historyToCsv, analyzeHistory,
  generateCode, verifyCode, hashCode, CODE_KIND_LABEL, stripUndefined,
  ACTION_LABEL, ACTION_TONE,
  type HistoryAction, type HistoryEntry, type CodeKind,
} from '../../../src/shared/lib/game20History';
import {
  GUIDE_RULES, PLAY_STEPS, getPayoutTable, getFaq, getWorkedExamples,
  GUIDE_RULES_LIST, buildFormulaSvg, buildReadingSvg, buildRulesCardSvg,
} from '../../../src/shared/lib/game20Guide';
import { computeResult, computeResultDetailed, formatResult, evaluateBets20 } from '../../../src/shared/lib/lottery20';
import { Game20Service } from '../../domains/game20/game20.service';

const COL_HISTORY = 'game20History';
const COL_CODES = 'game20Codes';

export function game20HistoryRoutes(db: any) {
  const r = Router();
  const svc = new Game20Service(db);

  const actorOf = (res: any) =>
    (res.locals.apiKeyDoc?.name as string) || (res.locals.apiKeyDoc?.key as string) || 'api';

  /** อ่านรอบทั้งหมด (ใช้ซ้ำหลายเส้น) */
  const loadRounds = async (n = 500) => (await svc.listRounds(n)) as any[];

  /** อ่านประวัติทั้งหมด */
  const loadHistory = async (): Promise<HistoryEntry[]> => {
    try {
      const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
      const snap = await getDocs(query(
        collection(db, COL_HISTORY), orderBy('at', 'desc'), limit(1000),
      ));
      return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as HistoryEntry[];
    } catch (e) {
      console.warn('[game20] loadHistory failed:', (e as Error).message);
      return [];
    }
  };

  /** บันทึกประวัติ */
  const saveHistory = async (entry: HistoryEntry) => {
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      // ★ Firestore ปฏิเสธ undefined — ต้องลบก่อนเขียน
      await setDoc(doc(db, COL_HISTORY, entry.id), stripUndefined(entry as any), { merge: true });
    } catch (e) {
      console.warn('[game20] saveHistory failed:', (e as Error).message);
    }
    return entry;
  };

  /** หารอบจาก id */
  const findRound = async (id: string) => {
    const rounds = await loadRounds();
    return rounds.find(x => x.roundId === id || x.id === id);
  };

  /* ================================================================
   * HISTORY — static ก่อน
   * ================================================================ */

  // GET /history/stats
  r.get('/history/stats', requirePermission('game20.report'), asyncHandler(async (_req, res) => {
    const list = await loadHistory();
    const s = historyStats(list);
    ok(res, s, {
      message: `${s.total} รายการ • แก้ไขผล ${s.edits} ครั้ง${s.tampered ? ` • ⚠️ พบ ${s.tampered} รายการผิดปกติ` : ''}`,
    });
  }));

  // GET /history/export — ส่งออก CSV
  r.get('/history/export', requirePermission('game20.report'), asyncHandler(async (req, res) => {
    const list = await loadHistory();
    const filtered = filterHistory(list, {
      q: req.query.q as string,
      actions: req.query.actions ? String(req.query.actions).split(',') as HistoryAction[] : undefined,
      actor: req.query.actor as string,
      from: req.query.from as string,
      to: req.query.to as string,
      onlyEdits: req.query.onlyEdits === 'true',
    });
    const csv = historyToCsv(filtered);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="game20-history-${Date.now()}.csv"`);
    res.send(csv);
  }));

  // GET /history/verify — ★ ตรวจว่ามีใครแก้ข้อมูลย้อนหลังไหม
  r.get('/history/verify', requirePermission('game20.history'), asyncHandler(async (_req, res) => {
    const list = await loadHistory();
    const bad = list.filter(e => !verifyHistoryEntry(e));
    const s = historyStats(list);
    ok(res, {
      total: list.length,
      intact: list.length - bad.length,
      tampered: bad.length,
      tamperedEntries: bad.map(e => ({
        id: e.id, action: e.action, roundId: e.roundId, at: e.at,
        note: '⚠️ checksum ไม่ตรง — เนื้อหาอาจถูกแก้หลังบันทึก',
      })),
      stats: s,
    }, {
      message: bad.length
        ? `⚠️ พบ ${bad.length} รายการที่ checksum ไม่ตรง — ควรตรวจสอบ`
        : `✅ ประวัติทั้ง ${list.length} รายการสมบูรณ์ ไม่ถูกแก้ไข`,
    });
  }));

  // ★ GET /guide/svg — ภาพกติกา — ต้องอยู่ก่อน /guide
  r.get('/guide/svg', requirePermission('game20.view'), asyncHandler(async (req, res) => {
    const which = String(req.query.which || 'all');
    const out: Record<string, string> = {};
    if (which === 'all' || which === 'formula') out.formula = buildFormulaSvg();
    if (which === 'all' || which === 'reading') out.reading = buildReadingSvg({
      result: req.query.result as string,
    });
    if (which === 'all' || which === 'card') out.card = buildRulesCardSvg();
    ok(res, {
      svg: which === 'all' ? out : out[which] || '',
      which,
      available: ['formula', 'reading', 'card'],
    });
  }));

  // GET /guide — กติกา/วิธีการเล่น (ข้อความ+ข้อมูล)
  r.get('/guide', requirePermission('game20.view'), asyncHandler(async (_req, res) => {
    ok(res, {
      rules: GUIDE_RULES,
      steps: PLAY_STEPS,
      payouts: getPayoutTable(),
      faq: getFaq(),
      cautions: GUIDE_RULES_LIST,
      examples: getWorkedExamples().map(e => ({
        title: e.title, slots: e.slots, result: e.result.result,
        resultFormatted: formatResult(e.result.result),
        lines: e.lines, note: e.note,
      })),
    }, { message: 'กติกาและวิธีการเล่น' });
  }));

  // GET /history — ประวัติทั้งหมด
  r.get('/history', requirePermission('game20.history'), asyncHandler(async (req, res) => {
    const list = await loadHistory();
    const filtered = filterHistory(list, {
      q: req.query.q as string,
      actions: req.query.actions ? String(req.query.actions).split(',') as HistoryAction[] : undefined,
      actor: req.query.actor as string,
      from: req.query.from as string,
      to: req.query.to as string,
      onlyEdits: req.query.onlyEdits === 'true',
    });
    okList(res, filtered as any[], {
      stats: historyStats(list),
      labels: ACTION_LABEL,
      tones: ACTION_TONE,
      message: `พบ ${filtered.length} จาก ${list.length} รายการ`,
    });
  }));

  // POST /history — บันทึกรายการประวัติเอง
  r.post('/history', requirePermission('game20.edit_result'), asyncHandler(async (req, res) => {
    const { action, roundId, reason, resultBefore, resultAfter, meta } = req.body || {};
    if (!action || !ACTION_LABEL[action as HistoryAction]) {
      throw new AppError(ERR.BAD_REQUEST, `action ไม่ถูกต้อง (ต้องเป็น ${Object.keys(ACTION_LABEL).join('/')})`, 400);
    }
    if (!roundId) throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ roundId', 400);

    const entry = makeHistoryEntry({
      action: action as HistoryAction,
      roundId, actor: actorOf(res), reason, resultBefore, resultAfter, meta,
    });
    await saveHistory(entry);
    ok(res, entry, { message: `บันทึกประวัติแล้ว (${ACTION_LABEL[action as HistoryAction]})` });
  }));

  /* ================================================================
   * CODES — รหัส
   * ================================================================ */

  // GET /codes
  r.get('/codes', requirePermission('game20.codes'), asyncHandler(async (req, res) => {
    let list: any[] = [];
    try {
      const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
      const snap = await getDocs(query(collection(db, COL_CODES), orderBy('createdAt', 'desc')));
      list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('[game20] loadCodes failed:', (e as Error).message);
    }
    // ★ ห้ามส่ง hash ออกไปข้างนอก
    const safe = list.map(c => ({ ...c, valueHash: undefined, hasValue: !!c.valueHash }));
    if (req.query.kind) {
      const k = String(req.query.kind);
      return okList(res, safe.filter(c => c.kind === k) as any[], {
        kinds: CODE_KIND_LABEL, message: `พบ ${safe.filter(c => c.kind === k).length} รหัส`,
      });
    }
    okList(res, safe as any[], { kinds: CODE_KIND_LABEL, message: `พบ ${safe.length} รหัส` });
  }));

  // POST /codes — ★ สร้างรหัสใหม่ (โชว์ค่าจริงครั้งเดียว)
  r.post('/codes', requirePermission('game20.codes'), asyncHandler(async (req, res) => {
    const { kind, label, length, maxUses, expiresInDays, note, alphanumeric } = req.body || {};
    if (!kind || !CODE_KIND_LABEL[kind as CodeKind]) {
      throw new AppError(ERR.BAD_REQUEST, `kind ไม่ถูกต้อง (ต้องเป็น ${Object.keys(CODE_KIND_LABEL).join('/')})`, 400);
    }
    if (!label || String(label).trim().length < 2) {
      throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุชื่อรหัส (label)', 400);
    }
    const len = Number(length) || 6;
    if (len < 4 || len > 32) throw new AppError(ERR.BAD_REQUEST, 'ความยาวรหัสต้อง 4-32 ตัว', 400);

    const { code, entry } = generateCode({
      kind: kind as CodeKind,
      label: String(label).trim(),
      length: len,
      maxUses: Number(maxUses) || 0,
      expiresInDays: expiresInDays === undefined ? null : Number(expiresInDays),
      note, createdBy: actorOf(res),
      alphanumeric: !!alphanumeric,
    });

    try {
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, COL_CODES, entry.id), stripUndefined(entry as any));
    } catch (e) {
      throw new AppError(ERR.INTERNAL, `บันทึกรหัสไม่สำเร็จ: ${(e as Error).message}`, 500);
    }

    await saveHistory(makeHistoryEntry({
      action: 'config_change', roundId: `code:${entry.id}`, actor: actorOf(res),
      reason: `สร้างรหัส "${entry.label}" (${CODE_KIND_LABEL[kind as CodeKind]})`,
      meta: { kind, length: len, maxUses },
    }));

    // ★ ส่งค่ารหัสจริงกลับครั้งเดียว — ผู้ใช้ต้องจดไว้ ระบบเก็บแค่ hash
    ok(res, {
      code,
      entry: { ...entry, valueHash: undefined as any },
      warning: '⚠️ ค่ารหัสนี้แสดงครั้งเดียวเท่านั้น — กรุณาจดเก็บไว้ ระบบเก็บเฉพาะ hash',
    }, { message: `สร้างรหัส "${entry.label}" สำเร็จ (${len} หลัก)` });
  }));

  // POST /codes/:id/verify — ตรวจรหัส
  r.post('/codes/:id/verify', asyncHandler(async (req, res) => {
    const code = String(req.body?.code || '');
    if (!code) throw new AppError(ERR.BAD_REQUEST, 'ต้องส่ง code', 400);

    const { doc, getDoc, updateDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, COL_CODES, req.params.id));
    if (!snap.exists()) throw new AppError(ERR.NOT_FOUND, `ไม่พบรหัส ${req.params.id}`, 404);

    const entry = snap.data() as any;
    const v = verifyCode(code, entry);

    if (v.ok) {
      // นับการใช้
      await updateDoc(doc(db, COL_CODES, req.params.id), {
        usedCount: (entry.usedCount || 0) + 1,
        lastUsedAt: new Date().toISOString(),
      } as any).catch(() => {});
      await saveHistory(makeHistoryEntry({
        action: 'unlock', roundId: `code:${req.params.id}`, actor: actorOf(res),
        reason: `ใช้รหัส "${entry.label}" สำเร็จ`,
      }));
    }

    ok(res, { ok: v.ok, reason: v.reason || null, label: entry.label, kind: entry.kind },
      { message: v.ok ? `✅ รหัสถูกต้อง — "${entry.label}"` : `❌ ${v.reason}` });
  }));

  // PUT /codes/:id — แก้ไขรหัส (label/active/limit — แก้ค่าจริงไม่ได้)
  r.put('/codes/:id', requirePermission('game20.codes'), asyncHandler(async (req, res) => {
    const { label, active, maxUses, expiresInDays, note, newValue } = req.body || {};
    const { doc, getDoc, updateDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, COL_CODES, req.params.id));
    if (!snap.exists()) throw new AppError(ERR.NOT_FOUND, `ไม่พบรหัส ${req.params.id}`, 404);
    const prev = snap.data() as any;

    const patch: Record<string, unknown> = {};
    if (label !== undefined) {
      if (String(label).trim().length < 2) throw new AppError(ERR.BAD_REQUEST, 'ชื่อรหัสสั้นเกินไป', 400);
      patch.label = String(label).trim();
    }
    if (active !== undefined) patch.active = !!active;
    if (maxUses !== undefined) patch.maxUses = Math.max(0, Number(maxUses) || 0);
    if (expiresInDays !== undefined) {
      patch.expiresAt = expiresInDays === null || Number(expiresInDays) === 0
        ? null
        : new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString();
    }
    if (note !== undefined) patch.note = note;
    // ★ เปลี่ยนค่ารหัสจริง → เก็บ hash ใหม่
    if (newValue) {
      if (String(newValue).length < 4) throw new AppError(ERR.BAD_REQUEST, 'รหัสใหม่ต้องยาวอย่างน้อย 4 ตัว', 400);
      patch.valueHash = hashCode(String(newValue));
      patch.length = String(newValue).length;
      patch.usedCount = 0;
    }

    if (!Object.keys(patch).length) throw new AppError(ERR.BAD_REQUEST, 'ไม่มีอะไรจะแก้ไข', 400);

    await updateDoc(doc(db, COL_CODES, req.params.id), stripUndefined(patch));
    await saveHistory(makeHistoryEntry({
      action: 'config_change', roundId: `code:${req.params.id}`, actor: actorOf(res),
      reason: `แก้ไขรหัส "${prev.label}" — ${Object.keys(patch).join(', ')}`,
      meta: { before: { label: prev.label, active: prev.active }, after: patch },
    }));

    // ★ คืนค่ารหัสใหม่ถ้าเปลี่ยน
    const out: Record<string, unknown> = { id: req.params.id, ...patch, valueHash: undefined };
    if (newValue) out.code = String(newValue);
    ok(res, out, { message: `แก้ไขรหัส "${prev.label}" แล้ว` });
  }));

  // DELETE /codes/:id
  r.delete('/codes/:id', requirePermission('game20.codes'), asyncHandler(async (req, res) => {
    const { doc, getDoc, deleteDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, COL_CODES, req.params.id));
    if (!snap.exists()) throw new AppError(ERR.NOT_FOUND, `ไม่พบรหัส ${req.params.id}`, 404);
    const prev = snap.data() as any;

    await deleteDoc(doc(db, COL_CODES, req.params.id));
    await saveHistory(makeHistoryEntry({
      action: 'delete', roundId: `code:${req.params.id}`, actor: actorOf(res),
      reason: `ลบรหัส "${prev.label}"`, meta: { kind: prev.kind },
    }));

    ok(res, { id: req.params.id, deleted: true }, { message: `ลบรหัส "${prev.label}" แล้ว` });
  }));

  /* ================================================================
   * ROUNDS — ประวัติของรอบ + แก้ไขผล (param ท้ายสุด)
   * ================================================================ */

  // GET /rounds/:id/history — ประวัติของรอบเดียว
  r.get('/rounds/:id/history', requirePermission('game20.history'), asyncHandler(async (req, res) => {
    const list = await loadHistory();
    const mine = list.filter(e => e.roundId === req.params.id);
    okList(res, mine as any[], {
      labels: ACTION_LABEL,
      message: `รอบ ${req.params.id} มี ${mine.length} รายการ`,
    });
  }));

  // ★ POST /rounds/:id/edit — แก้ไขรหัสผล (ต้องมีเหตุผล)
  r.post('/rounds/:id/edit', requirePermission('game20.edit_result'), asyncHandler(async (req, res) => {
    const { newResult, newSlots, reason } = req.body || {};
    const actor = actorOf(res);

    const round = await findRound(req.params.id);
    if (!round) throw new AppError(ERR.NOT_FOUND, `ไม่พบรอบ ${req.params.id}`, 404);

    const rates = await svc.getRateMap();
    const bets = Array.isArray(req.body?.bets) ? req.body.bets : [];

    const prep = prepareEditResult(
      { roundId: round.roundId || round.id, result: round.result, slots: round.slots, resultLocked: round.resultLocked },
      {
        roundId: round.roundId || round.id,
        newResult: String(newResult),
        newSlots: Array.isArray(newSlots) ? newSlots : undefined,
        reason: String(reason || ''),
        actor,
        actorRole: res.locals.apiKeyDoc?.scopes?.[0],
        bets, rates,
      },
    );

    if (!prep.ok) {
      await saveHistory(prep.history);
      throw new AppError(ERR.BAD_REQUEST, prep.error || 'แก้ไขไม่สำเร็จ', 400, { warnings: prep.warnings });
    }

    // ---- บันทึกการแก้ไข ----
    const { doc, setDoc } = await import('firebase/firestore');
    const roundId = round.roundId || round.id;
    const patch: Record<string, unknown> = {
      result: prep.resultAfter,
      resultFormatted: formatResult(prep.resultAfter),
      edited: true,
      editedAt: new Date().toISOString(),
      editedBy: actor,
      editReason: reason,
      previousResults: [
        ...(Array.isArray(round.previousResults) ? round.previousResults : []),
        { result: prep.resultBefore, slots: round.slots, at: new Date().toISOString(), by: actor, reason },
      ].slice(-20),
    };
    if (prep.slots.length) {
      patch.slots = prep.slots;
      patch.prizes = computeResult(prep.slots).prizes;
    }
    await setDoc(doc(db, COL_HISTORY.replace('History', 'Rounds'), roundId), patch as any, { merge: true })
      .catch(async () => {
        // fallback: collection ชื่ออื่น
        await setDoc(doc(db, 'game20Rounds', roundId), patch as any, { merge: true });
      });

    await saveHistory(prep.history);

    ok(res, prep, {
      message: `แก้ไขผลรอบ ${roundId} สำเร็จ — ${formatResult(prep.resultBefore)} → ${formatResult(prep.resultAfter)}${
        prep.warnings.length ? ` • ${prep.warnings.join(' • ')}` : ''
      }`,
    });
  }));

  // POST /rounds/:id/recompute — คำนวณผลใหม่จากเลข 20 ช่อง
  r.post('/rounds/:id/recompute', requirePermission('game20.edit_result'), asyncHandler(async (req, res) => {
    const round = await findRound(req.params.id);
    if (!round) throw new AppError(ERR.NOT_FOUND, `ไม่พบรอบ ${req.params.id}`, 404);

    const slots = Array.isArray(req.body?.slots) ? req.body.slots : round.slots;
    if (!Array.isArray(slots) || slots.length !== 20) {
      throw new AppError(ERR.BAD_REQUEST, 'ต้องมีเลข 20 ช่อง', 400);
    }

    const c = computeResult(slots);
    const detailed = computeResultDetailed(slots);
    const changed = c.result !== round.result;

    if (changed) {
      await saveHistory(makeHistoryEntry({
        action: 'recompute', roundId: round.roundId || round.id, actor: actorOf(res),
        resultBefore: round.result, resultAfter: c.result,
        slotsBefore: round.slots, slotsAfter: slots,
        reason: String(req.body?.reason || 'คำนวณใหม่จากเลข 20 ช่อง'),
      }));
    }

    ok(res, {
      roundId: round.roundId || round.id,
      slots, result: c.result, resultFormatted: formatResult(c.result),
      prizes: c.prizes, steps: detailed.steps,
      resultBefore: round.result,
      changed,
      verified: changed ? false : true,
    }, {
      message: changed
        ? `⚠️ ผลเปลี่ยนจาก ${formatResult(round.result)} เป็น ${formatResult(c.result)} — บันทึกประวัติแล้ว`
        : `ผลตรงกับเดิม (${formatResult(c.result)})`,
    });
  }));

  // POST /rounds/:id/lock — ล็อกรอบ
  r.post('/rounds/:id/lock', asyncHandler(async (req, res) => {
    const round = await findRound(req.params.id);
    if (!round) throw new AppError(ERR.NOT_FOUND, `ไม่พบรอบ ${req.params.id}`, 404);
    const roundId = round.roundId || round.id;

    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'game20Rounds', roundId), {
      resultLocked: true, lockedAt: new Date().toISOString(), lockedBy: actorOf(res),
    } as any, { merge: true });

    await saveHistory(makeHistoryEntry({
      action: 'config_change', roundId, actor: actorOf(res),
      reason: String(req.body?.reason || 'ล็อกรอบ'), meta: { locked: true },
    }));

    ok(res, { roundId, resultLocked: true }, { message: `ล็อกรอบ ${roundId} แล้ว — แก้ไขผลไม่ได้จนกว่าจะปลดล็อก` });
  }));

  // POST /rounds/:id/unlock — ปลดล็อกรอบ
  r.post('/rounds/:id/unlock', requirePermission('game20.edit_result'), asyncHandler(async (req, res) => {
    const round = await findRound(req.params.id);
    if (!round) throw new AppError(ERR.NOT_FOUND, `ไม่พบรอบ ${req.params.id}`, 404);
    const roundId = round.roundId || round.id;

    // ★ ต้องมีเหตุผล + รหัสปลดล็อก (ถ้ามีตั้งไว้)
    const reason = String(req.body?.reason || '');
    if (reason.trim().length < 3) {
      throw new AppError(ERR.BAD_REQUEST, '★ ต้องระบุเหตุผลการปลดล็อก', 400);
    }

    const { doc, setDoc, collection, getDocs, query, where } = await import('firebase/firestore');

    // ถ้ามีรหัสปลดล็อกตั้งไว้ → ต้องตรวจ
    let needCode = false;
    try {
      const snap = await getDocs(query(collection(db, COL_CODES), where('kind', '==', 'result_lock')));
      const codes = snap.docs.map(d => d.data() as any).filter(c => c.active);
      if (codes.length) {
        needCode = true;
        const given = String(req.body?.code || '');
        if (!given) throw new AppError(ERR.BAD_REQUEST, '★ รอบนี้ต้องใช้รหัสปลดล็อก', 400);
        const okCode = codes.some(c => verifyCode(given, c).ok);
        if (!okCode) throw new AppError(ERR.BAD_REQUEST, '❌ รหัสปลดล็อกไม่ถูกต้อง', 400);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      // อ่านรหัสไม่ได้ → ไม่บังคับ
    }

    await setDoc(doc(db, 'game20Rounds', roundId), {
      resultLocked: false, unlockedAt: new Date().toISOString(), unlockedBy: actorOf(res),
    } as any, { merge: true });

    await saveHistory(makeHistoryEntry({
      action: 'unlock', roundId, actor: actorOf(res),
      reason, meta: { locked: false, usedCode: needCode },
    }));

    ok(res, { roundId, resultLocked: false, usedCode: needCode },
      { message: `ปลดล็อกรอบ ${roundId} แล้ว${needCode ? ' (ตรวจรหัสผ่าน)' : ''}` });
  }));

  return r;
}
