/**
 * server/routes/v1/game20.routes.ts
 * ------------------------------------------------------------------
 * ★ เส้น API หวย 20 ช่อง 6 หลัก ★
 *
 * prefix: /api/v1/game20
 *
 * ลำดับเส้น (สำคัญ — static ก่อน param เสมอ):
 *   /health  /config  /rates  /compute  /validate  /evaluate  /exposure
 *   /slots/* (random, solve, natural)
 *   /bot/*   (config, result, number, report, estimate)
 *   /rounds  /rounds/close  /rounds/:id
 *   /stats
 */
import { Router } from 'express';
import { requirePermission } from '../../middleware/permission';
import { asyncHandler } from '../../middleware/error-handler';
import { ok, okList, ERR } from '../../lib/response';
import { AppError } from '../../lib/wallet';
import { Game20Service, healthPayload, computeFromSlots } from '../../domains/game20/game20.service';
import {
  validateSlots, computeResult, computeResultDetailed,
  evaluateBets20, analyzeRoundExposure, randomSlots,
  solveSlotsForResult, solveSlotsNatural, calcHouseMargin,
  DEFAULT_PAYOUT_RATES, defaultRateMap, padNum, formatResult,
  SLOT_COUNT, RESULT_MODULO,
} from '../../../src/shared/lib/lottery20';
import {
  runResultBot, runNumberBot, buildBotReport, maxAvoidableCoverage,
  generatePlayerSlots, DEFAULT_RESULT_BOT, DEFAULT_NUMBER_BOT,
} from '../../../src/shared/lib/bots';

/** ตรวจว่ามี array ของโพยส่งมาไหม */
function requireBets(body: any): any[] {
  const bets = body?.bets;
  if (!Array.isArray(bets)) {
    throw new AppError(ERR.BAD_REQUEST, 'ต้องส่ง bets เป็น array เช่น { bets: [{ number, type, amount }] }', 400);
  }
  return bets;
}

/** ตรวจจำนวนเต็มบวก */
function posInt(v: unknown, name: string, def: number, max = 100000): number {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new AppError(ERR.BAD_REQUEST, `${name} ต้องเป็นจำนวนเต็มบวก`, 400);
  return Math.min(Math.floor(n), max);
}

export function game20Routes(db: any) {
  const r = Router();
  const svc = new Game20Service(db);

  /* ================================================================
   * STATIC — อ่านค่าพื้นฐาน
   * ================================================================ */

  // GET /api/v1/game20/health — สุขภาพโมดูล + กติกา + อัตราจ่าย
  r.get('/health', asyncHandler(async (_req, res) => {
    ok(res, healthPayload(), { message: 'โมดูลหวย 20 ช่อง 6 หลัก ทำงานปกติ' });
  }));

  // GET /api/v1/game20/config — อ่านค่าตั้งต้นทั้งหมด
  r.get('/config', asyncHandler(async (_req, res) => {
    const cfg = await svc.getConfig();
    ok(res, cfg);
  }));

  // PUT /api/v1/game20/config — แก้ค่าตั้งต้น (รวมเปิด/ปิดหวย)
  r.put('/config', requirePermission('game20.config'), asyncHandler(async (req, res) => {
    const actor = (res.locals.apiKeyDoc?.name as string) || 'api';
    const next = await svc.updateConfig(req.body || {}, actor);
    await svc.logBot('update_config', { patch: req.body }, actor);
    ok(res, next, { message: 'บันทึกค่าตั้งต้นแล้ว' });
  }));

  // GET /api/v1/game20/rates — ตารางอัตราจ่าย + margin
  r.get('/rates', asyncHandler(async (_req, res) => {
    const cfg = await svc.getConfig();
    const margin = calcHouseMargin();
    const map = defaultRateMap();
    const rows = (cfg.rates || []).map(x => {
      const odds = x.odds ?? (Number(x.rate) > 0 ? 1_000_000 / Number(x.rate) : 0);
      const ev = odds > 0 ? Number(x.rate) / odds : 0;
      return {
        ...x,
        odds: Math.round(odds),
        // ★ ถ้า EV < 1 = เจ้ามือได้เปรียบ
        playerEV: Number(ev.toFixed(4)),
        houseEdgePercent: Number(((1 - ev) * 100).toFixed(2)),
        verdict: ev < 1 ? '🟢 เจ้ามือได้เปรียบ' : ev === 1 ? '⚪ เสมอตัว' : '🔴 ผู้เล่นได้เปรียบ',
        note: map[x.key] === undefined ? '⚠️ ไม่มีในระบบคำนวณกลาง' : undefined,
      };
    });
    ok(res, {
      rates: rows,
      margin: {
        marginPercent: Number(margin.marginPercent.toFixed(2)),
        worstPercent: Number(margin.worstPercent.toFixed(2)),
        bestPercent: Number(margin.bestPercent.toFixed(2)),
        verdict: margin.verdict,
        breakdown: margin.breakdown,
      },
    });
  }));

  // PUT /api/v1/game20/rates — แก้ตารางอัตราจ่าย
  r.put('/rates', requirePermission('game20.rates'), asyncHandler(async (req, res) => {
    const actor = (res.locals.apiKeyDoc?.name as string) || 'api';
    const incoming = req.body?.rates;
    if (!Array.isArray(incoming) || !incoming.length) {
      throw new AppError(ERR.BAD_REQUEST, 'ต้องส่ง rates เป็น array ที่ไม่ว่าง', 400);
    }
    // ★ ตรวจค่า rate ก่อนบันทึก — กันใส่ค่าผิดแล้วระบบจ่ายเกิน
    const clean = incoming.map((x: any) => {
      const rate = Number(x.rate);
      if (!x.key || !Number.isFinite(rate) || rate <= 0) {
        throw new AppError(ERR.BAD_REQUEST, `อัตราจ่ายไม่ถูกต้อง: ${JSON.stringify(x)}`, 400);
      }
      if (rate > 1_000_000) {
        throw new AppError(ERR.BAD_REQUEST, `อัตราจ่าย ${rate} สูงเกินไป (เพดาน 1,000,000)`, 400);
      }
      return { key: x.key, label: x.label || x.key, rate, desc: x.desc, odds: x.odds };
    });

    const cfg = await svc.updateConfig({ rates: clean }, actor);
    await svc.logBot('update_rates', { count: clean.length, clean }, actor);
    const margin = calcHouseMargin(clean.map(c => ({
      key: c.key, label: c.label, rate: c.rate, desc: c.desc || '',
      odds: c.odds ?? 0,
    })) as any);
    ok(res, { rates: cfg.rates, margin: { marginPercent: Number(margin.marginPercent.toFixed(2)), verdict: margin.verdict } },
      { message: `บันทึกอัตราจ่าย ${clean.length} ประเภทแล้ว` });
  }));

  /* ================================================================
   * คำนวณ / ตรวจ — ไม่มีการเขียน DB (เรียกถี่ได้)
   * ================================================================ */

  // POST /api/v1/game20/compute — คำนวณผลจากเลข 20 ช่อง
  r.post('/compute', asyncHandler(async (req, res) => {
    const slots = req.body?.slots;
    if (!Array.isArray(slots)) throw new AppError(ERR.BAD_REQUEST, 'ต้องส่ง slots เป็น array 20 ช่อง', 400);
    if (slots.length !== SLOT_COUNT) {
      throw new AppError(ERR.BAD_REQUEST, `ต้องมี ${SLOT_COUNT} ช่อง (ส่งมา ${slots.length})`, 400);
    }
    const out = computeFromSlots(slots);
    ok(res, out, {
      message: out.validation.ok
        ? `ผลรางวัล = ${out.resultFormatted}`
        : `ข้อมูลยังไม่ครบ: ${out.validation.errors.join(' • ')}`,
    });
  }));

  // POST /api/v1/game20/validate — ตรวจเลข 20 ช่อง
  r.post('/validate', asyncHandler(async (req, res) => {
    const slots = req.body?.slots;
    if (!Array.isArray(slots)) throw new AppError(ERR.BAD_REQUEST, 'ต้องส่ง slots เป็น array', 400);
    const v = validateSlots(slots);
    ok(res, v, { message: v.ok ? 'เลขถูกต้องตามกติกา' : v.errors.join(' • ') });
  }));

  // POST /api/v1/game20/evaluate — ตรวจรางวัลของโพยกับผล
  r.post('/evaluate', asyncHandler(async (req, res) => {
    const bets = requireBets(req.body);
    const result = String(req.body?.result ?? '').trim();
    if (!/^\d{1,6}$/.test(result)) {
      throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ result เป็นตัวเลข 1-6 หลัก', 400);
    }
    const rates = req.body?.rates && typeof req.body.rates === 'object'
      ? req.body.rates
      : await svc.getRateMap();

    const out = evaluateBets20(bets as any, result.padStart(6, '0'), rates);
    // ★ evaluateBets20 คืนแค่ payout+details — ยอดรับคำนวณเอง
    const totalBet = bets.reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0);
    const winCount = out.details.filter(d => d.won).length;
    ok(res, {
      result: result.padStart(6, '0'),
      resultFormatted: formatResult(result),
      totalBet,
      payout: out.payout,
      profit: totalBet - out.payout,
      profitPercent: totalBet ? ((totalBet - out.payout) / totalBet) * 100 : 0,
      winCount,
      details: out.details,
    }, {
      message: `จ่าย ${out.payout.toLocaleString()} บาท • ผู้ชนะ ${winCount} ราย`,
    });
  }));

  // POST /api/v1/game20/exposure — วิเคราะห์ความเสี่ยงของรอบ
  r.post('/exposure', asyncHandler(async (req, res) => {
    const bets = requireBets(req.body);
    const rates = req.body?.rates && typeof req.body.rates === 'object'
      ? req.body.rates
      : await svc.getRateMap();

    const exp = analyzeRoundExposure(bets as any, rates);
    const avoid = maxAvoidableCoverage(bets as any);
    ok(res, {
      ...exp,
      ...avoid,
      // ★ ใช้เตือนหลังบ้านว่าควรเลี่ยงไหม
      advice: avoid.avoidable
        ? `เลี่ยงผู้ชนะได้ — กำไรแย่สุดถ้าออกเลขที่หนักสุด ฿${exp.worstCaseProfit.toLocaleString()}`
        : avoid.note,
      worstNumbers: exp.worstNumbers,
      // ★ ยอดที่ต้องจ่ายถ้าออกเลขที่แย่สุด
      worstPayout: exp.worstNumbers.reduce((s, w) => s + w.payout, 0),
    }, {
      message: `ยอดรับ ฿${exp.totalBet.toLocaleString()} • กำไรแย่สุด ฿${exp.worstCaseProfit.toLocaleString()}`,
    });
  }));

  /* ================================================================
   * SLOTS — สุ่ม / วางเลข
   * ================================================================ */

  // POST /api/v1/game20/slots/random — สุ่มเลข 20 ช่อง
  r.post('/slots/random', asyncHandler(async (req, res) => {
    const count = posInt(req.body?.count, 'count', 1, 500);
    const seed = req.body?.seed;
    const items = Array.from({ length: count }, (_, i) => {
      const slots = randomSlots();
      const c = computeResult(slots);
      return { index: i + 1, slots, result: c.result, resultFormatted: formatResult(c.result) };
    });
    ok(res, count === 1 ? items[0] : items, { count, message: count === 1 ? `ผล = ${items[0].resultFormatted}` : `สุ่ม ${count} ชุด` });
  }));

  // POST /api/v1/game20/slots/solve — ★ วางเลขให้ได้ผลตามเป้า
  r.post('/slots/solve', requirePermission('game20.bot_result'), asyncHandler(async (req, res) => {
    const target = String(req.body?.target ?? '').trim();
    if (!/^\d{1,6}$/.test(target)) {
      throw new AppError(ERR.BAD_REQUEST, 'ต้องระบุ target เป็นตัวเลข 1-6 หลัก เช่น "777777"', 400);
    }
    const t = target.padStart(6, '0');
    const seed = req.body?.seed;
    const natural = req.body?.natural !== false;

    const solved = natural
      ? solveSlotsNatural(t, seed)
      : solveSlotsForResult(t, { seed: seed ?? undefined, lockOthers: false });

    // ★ ตรวจก่อนตอบ — ห้ามส่งเลขที่ให้ผลไม่ตรง
    const recheck = computeResult(solved.slots);
    if (recheck.result !== t) {
      throw new AppError(ERR.INTERNAL, `วางเลขไม่สำเร็จ (ได้ ${recheck.result} แทน ${t})`, 500);
    }

    ok(res, {
      target: t,
      slots: solved.slots,
      result: recheck.result,
      resultFormatted: formatResult(recheck.result),
      ok: true,
      verified: true,
      method: natural ? 'natural (กระจายทุกช่อง)' : 'direct (ล็อกช่องตรง)',
      achieved: solved.achieved,
      sumUsed: solved.sumUsed,
      rounds: solved.rounds,
    }, { message: `วางเลขสำเร็จ — ผล = ${formatResult(recheck.result)}` });
  }));

  // POST /api/v1/game20/slots/natural — สุ่มแบบธรรมชาติ (กระจายทุกช่อง)
  r.post('/slots/natural', asyncHandler(async (req, res) => {
    const count = posInt(req.body?.count, 'count', 1, 200);
    const seed = req.body?.seed ?? 0;
    const items = Array.from({ length: count }, (_, i) => {
      const target = padNum(Math.floor(Math.random() * RESULT_MODULO));
      const s = solveSlotsNatural(target, seed + i);
      return { index: i + 1, target, slots: s.slots, result: s.achieved };
    });
    ok(res, count === 1 ? items[0] : items, { count });
  }));

  /* ================================================================
   * BOT — บอท 2 ตัว
   * ================================================================ */

  // GET /api/v1/game20/bot/config — อ่านค่าบอท
  r.get('/bot/config', requirePermission('game20.bot_result'), asyncHandler(async (_req, res) => {
    const cfg = await svc.getConfig();
    const avoid = maxAvoidableCoverage([]);
    ok(res, {
      resultBot: cfg.resultBot,
      numberBot: cfg.numberBot,
      resultModes: [
        { key: 'fair',    label: 'ยุติธรรม',            desc: 'สุ่มบริสุทธิ์ ไม่แทรกแซงผล' },
        { key: 'profit',  label: 'กำไรสูงสุด',          desc: 'เลือกผลที่เจ้ามือกำไรสูงสุด (ไม่ให้คนถูก)' },
        { key: 'balance', label: 'คุมกำไรตามเป้า',      desc: `เลือกผลให้จ่ายใกล้ ${cfg.resultBot?.targetPayoutPercent ?? 65}% ของยอดรับ` },
        { key: 'avoid',   label: 'ห้ามมีคนถูก',        desc: 'เลี่ยงผลที่มีผู้ชนะ (ถ้าเลี่ยงได้)' },
        { key: 'target',  label: 'ตั้งผลเอง',           desc: 'กำหนดผลลัพธ์ด้วยมือ' },
      ],
      swapPlans: [
        { key: 'shuffle', label: 'สับทั้งชุด',      desc: 'Fisher-Yates — สลับไม่ลำเอียง' },
        { key: 'rotate',  label: 'หมุนวงกลม',      desc: 'ทุกคนได้เลขของคนถัดไป' },
        { key: 'mirror',  label: 'กลับด้าน',        desc: 'คนแรกสลับกับคนสุดท้าย' },
        { key: 'chunk',   label: 'แบ่งกลุ่ม',        desc: 'สลับในกลุ่มแล้วสลับกลุ่ม' },
        { key: 'cross',   label: 'ข้ามครึ่ง',        desc: 'จับคู่ครึ่งบนกับครึ่งล่าง' },
        { key: 'random',  label: 'สุ่มผสม',        desc: 'จับคู่แบบไม่ซ้ำ — ยากต่อการจับทาง' },
      ],
      avoidHint: avoid.note,
    });
  }));

  // PUT /api/v1/game20/bot/config — ★ เปิด/ปิดบอทจากหลังบ้าน
  r.put('/bot/config', requirePermission('game20.bot_result'), asyncHandler(async (req, res) => {
    const actor = (res.locals.apiKeyDoc?.name as string) || 'api';
    const { resultBot, numberBot } = req.body || {};
    if (!resultBot && !numberBot) {
      throw new AppError(ERR.BAD_REQUEST, 'ต้องส่ง resultBot และ/หรือ numberBot', 400);
    }

    // ★ ตรวจค่า mode ก่อนบันทึก
    if (resultBot?.mode) {
      const valid = ['fair', 'profit', 'balance', 'avoid', 'target'];
      if (!valid.includes(resultBot.mode)) {
        throw new AppError(ERR.BAD_REQUEST, `โหมดไม่ถูกต้อง: ${resultBot.mode} (ต้องเป็น ${valid.join('/')})`, 400);
      }
    }
    if (numberBot?.plan) {
      const valid = ['shuffle', 'rotate', 'mirror', 'chunk', 'cross', 'random'];
      if (!valid.includes(numberBot.plan)) {
        throw new AppError(ERR.BAD_REQUEST, `แผนสลับไม่ถูกต้อง: ${numberBot.plan}`, 400);
      }
    }

    const next = await svc.updateConfig({ resultBot, numberBot }, actor);
    await svc.logBot('update_bot_config', { resultBot, numberBot }, actor);
    ok(res, { resultBot: next.resultBot, numberBot: next.numberBot }, {
      message: `บอทออกผล: ${next.resultBot?.enabled ? 'เปิด' : 'ปิด'} • บอทวางเลข: ${next.numberBot?.enabled ? 'เปิด' : 'ปิด'}`,
    });
  }));

  // POST /api/v1/game20/bot/result — ★ รันบอทออกผล (ดูผลก่อน ไม่บันทึก)
  r.post('/bot/result', requirePermission('game20.bot_result'), asyncHandler(async (req, res) => {
    const bets = req.body?.bets;
    if (bets !== undefined && !Array.isArray(bets)) {
      throw new AppError(ERR.BAD_REQUEST, 'bets ต้องเป็น array', 400);
    }
    const cfg = await svc.getConfig();
    const rates = await svc.getRateMap();

    // ★ ถ้าผู้เรียกระบุ mode/forcedResult/config เอง → override enabled
    //   ไม่งั้นสั่งตั้งผลเองแล้วระบบยังสุ่มบริสุทธิ์ (บั๊กเดียวกับ closeRound)
    const callerOverride = !!(req.body?.mode || req.body?.forcedResult || req.body?.config);
    const botCfg = {
      ...(cfg.resultBot || DEFAULT_RESULT_BOT),
      ...(callerOverride ? { enabled: true } : {}),
      ...(req.body?.config || {}),
      ...(req.body?.mode ? { mode: req.body.mode } : {}),
      ...(req.body?.forcedResult ? { mode: 'target' as const, forcedResult: String(req.body.forcedResult) } : {}),
      ...(req.body?.candidates ? { candidates: posInt(req.body.candidates, 'candidates', 400, 5000) } : {}),
      ...(req.body?.seed !== undefined ? { seed: Number(req.body.seed) } : {}),
    };

    const outcome = await runResultBot((bets || []) as any, rates, botCfg);

    // ★ ตรวจซ้ำก่อนตอบ
    const recheck = computeResult(outcome.slots);
    const verified = recheck.result === outcome.result;

    ok(res, {
      ...outcome,
      verified,
      slots: outcome.slots,
      prizes: recheck.prizes,
      formula: {
        sum: recheck.sum,
        subtractSlot: recheck.subtractSlot,
        subtractValue: recheck.subtractValue,
        raw: recheck.raw,
        mod: RESULT_MODULO,
      },
      avoidable: maxAvoidableCoverage((bets || []) as any),
    }, {
      message: verified
        ? `บอทเลือกผล ${formatResult(outcome.result)} — ${outcome.reason}`
        : '⚠️ ตรวจไม่ผ่าน — เลขไม่ตรงกับผล',
    });
  }));

  // POST /api/v1/game20/bot/number — ★ รันบอทวางเลข (สลับคนไปมา)
  r.post('/bot/number', requirePermission('game20.bot_number'), asyncHandler(async (req, res) => {
    const cfg = await svc.getConfig();
    const botCfg = { ...(cfg.numberBot || DEFAULT_NUMBER_BOT), ...(req.body?.config || {}) };

    // รับได้ 2 ทาง: ส่ง players มาเอง หรือให้สร้างให้
    let players = req.body?.players;
    if (!Array.isArray(players)) {
      const count = posInt(req.body?.count, 'count', 10, 500);
      players = generatePlayerSlots(count, { seed: req.body?.seed });
    }
    if (!players.length) throw new AppError(ERR.BAD_REQUEST, 'ต้องมีผู้เล่นอย่างน้อย 1 คน', 400);

    // ★ ตรวจว่าแต่ละคนมี slots ครบ
    const clean = players.map((p: any, i: number) => {
      if (!Array.isArray(p.slots)) throw new AppError(ERR.BAD_REQUEST, `ผู้เล่นลำดับ ${i + 1} ไม่มี slots`, 400);
      return { id: String(p.id ?? `p${i + 1}`), name: p.name, slots: p.slots };
    });

    const outcome = runNumberBot(clean, botCfg);

    // ★ ตรวจว่าทุกคนยังคำนวณได้ผลถูก
    const allValid = outcome.assignments.every(a => computeResult(a.slots).result === a.result);

    ok(res, { ...outcome, allValid, playerCount: clean.length }, {
      message: allValid
        ? `สลับเลข ${clean.length} คนแล้ว — ${outcome.note}`
        : '⚠️ มีบางคนคำนวณผลไม่ตรง',
    });
  }));

  // POST /api/v1/game20/bot/report — ★ รายงานสรุปบอททั้ง 2 ตัว
  r.post('/bot/report', requirePermission('game20.bot_result'), asyncHandler(async (req, res) => {
    const cfg = await svc.getConfig();
    const rates = await svc.getRateMap();
    const bets = Array.isArray(req.body?.bets) ? req.body.bets : [];

    const rOut = await runResultBot(bets as any, rates, {
      ...(cfg.resultBot || DEFAULT_RESULT_BOT),
      ...(req.body?.config || {}),
    });
    const nOut = req.body?.players?.length
      ? runNumberBot(req.body.players, { ...(cfg.numberBot || DEFAULT_NUMBER_BOT), ...(req.body?.config || {}) })
      : null;

    const report = buildBotReport(rOut, nOut, cfg.resultBot || {}, cfg.numberBot || {});
    ok(res, { report, resultOutcome: rOut, numberOutcome: nOut }, { message: report.warnings.length ? report.warnings.join(' • ') : 'บอททำงานปกติ' });
  }));

  /* ================================================================
   * ROUNDS — รอบหวย
   * ================================================================ */

  // GET /api/v1/game20/rounds — ประวัติรอบ
  r.get('/rounds', asyncHandler(async (req, res) => {
    const n = posInt(req.query.limit, 'limit', 50, 500);
    const rounds = await svc.listRounds(n);
    okList(res, rounds as any[], { message: `พบ ${rounds.length} รอบ` });
  }));

  // POST /api/v1/game20/rounds/close — ★ ปิดรอบ: รันบอท → ออกผล → บันทึก
  r.post('/rounds/close', requirePermission('game20.close_round'), asyncHandler(async (req, res) => {
    const actor = (res.locals.apiKeyDoc?.name as string) || 'api';
    const bets = Array.isArray(req.body?.bets) ? req.body.bets : [];
    const players = Array.isArray(req.body?.players) ? req.body.players : undefined;

    const out = await svc.closeRound({
      roundId: req.body?.roundId,
      bets,
      players,
      mode: req.body?.mode,
      forcedResult: req.body?.forcedResult,
      actor,
    });

    await svc.logBot('close_round', {
      roundId: out.round.roundId, result: out.round.result, mode: out.round.mode,
    }, actor);

    ok(res, out, {
      message: `ปิดรอบ ${out.round.roundId} — ผล ${out.round.resultFormatted} • ${out.round.reason}`,
    });
  }));

  // GET /api/v1/game20/rounds/:id — ดูรอบเดียว
  r.get('/rounds/:id', asyncHandler(async (req, res) => {
    const rounds = await svc.listRounds(500) as any[];
    const found = rounds.find(x => x.roundId === req.params.id || x.id === req.params.id);
    if (!found) throw new AppError(ERR.NOT_FOUND, `ไม่พบรอบ ${req.params.id}`, 404);
    ok(res, found);
  }));

  // GET /api/v1/game20/stats — สถิติภาพรวม
  r.get('/stats', requirePermission('game20.report'), asyncHandler(async (_req, res) => {
    const s = await svc.stats();
    ok(res, s, {
      message: `${s.rounds} รอบ • กำไร ฿${s.profit.toLocaleString()} (${s.profitPercent.toFixed(1)}%) • รอบไม่มีผู้ชนะ ${s.noWinnerRate.toFixed(0)}%`,
    });
  }));

  return r;
}
