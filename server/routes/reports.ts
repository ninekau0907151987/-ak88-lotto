/**
 * server/routes/reports.ts
 * ------------------------------------------------------------------
 * หมวด: รายงาน (Reports)
 * - รายงานการเล่น (ยอดแทง, ถูก, กำไร)
 * - รายงานการเงิน (ฝาก, ถอน, เติม)
 * - สรุปยอดตามช่วงเวลา / ตามหวย / ตามผู้ใช้
 * - รายชื่อสมาชิก + เอเย่นต์
 */
import { Router } from 'express';
import { collection, getDocs, query, where } from 'firebase/firestore';

function inRange(dateStr: string, from?: string, to?: string) {
  const d = String(dateStr || '').substring(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function reportRoutes(db: any) {
  const r = Router();

  // GET /api/v1/reports/betting?from=&to=&lotteryType=&userId= — รายงานการเล่น
  r.get('/betting', async (req, res) => {
    try {
      const { from, to, lotteryType, userId } = req.query as any;
      const conds: any[] = [];
      if (lotteryType) conds.push(where('ticketType', '==', lotteryType));
      if (userId) conds.push(where('userId', '==', userId));
      const snap = await getDocs(conds.length ? query(collection(db, 'tickets'), ...conds) : collection(db, 'tickets'));
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      list = list.filter(t => inRange(t.createdAt || '', from, to));

      const totalBet = list.reduce((s, t) => s + (t.totalAmount || 0), 0);
      const totalPayout = list.reduce((s, t) => s + (t.payout || 0), 0);
      const win = list.filter(t => t.status === 'win').length;
      const lose = list.filter(t => t.status === 'lose').length;
      const pending = list.filter(t => t.status === 'confirmed' || t.status === 'active').length;

      // แยกตามหวย
      const byType: Record<string, any> = {};
      for (const t of list) {
        const k = t.ticketType || 'unknown';
        byType[k] = byType[k] || { tickets: 0, bet: 0, payout: 0 };
        byType[k].tickets++;
        byType[k].bet += t.totalAmount || 0;
        byType[k].payout += t.payout || 0;
      }

      res.json({
        status: 'success',
        data: {
          summary: { tickets: list.length, totalBet, totalPayout, profit: totalBet - totalPayout, win, lose, pending },
          byLottery: byType,
        },
      });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงรายงานการเล่นไม่สำเร็จ' });
    }
  });

  // GET /api/v1/reports/finance?from=&to=&userId= — รายงานการเงิน
  r.get('/finance', async (req, res) => {
    try {
      const { from, to, userId } = req.query as any;
      const conds: any[] = [];
      if (userId) conds.push(where('userId', '==', userId));
      const snap = await getDocs(conds.length ? query(collection(db, 'transactions'), ...conds) : collection(db, 'transactions'));
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      list = list.filter(t => inRange(t.createdAt || '', from, to));

      const sum = (type: string, status?: string) =>
        list.filter(t => t.type === type && (!status || t.status === status))
            .reduce((s, t) => s + Math.abs(t.amount || 0), 0);

      res.json({
        status: 'success',
        data: {
          summary: {
            deposit: sum('deposit', 'approved'),
            depositPending: sum('deposit', 'pending'),
            withdraw: sum('withdraw', 'approved'),
            withdrawPending: sum('withdraw', 'pending'),
            topup: sum('topup'),
            bet: sum('bet'),
            win: sum('win'),
            refund: sum('refund'),
            netIn: sum('deposit', 'approved') + sum('topup') - sum('withdraw', 'approved'),
            transactions: list.length,
          },
        },
      });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงรายงานการเงินไม่สำเร็จ' });
    }
  });

  // GET /api/v1/reports/summary — ภาพรวมระบบ (Dashboard)
  r.get('/summary', async (_req, res) => {
    try {
      const [tSnap, xSnap, uSnap, aSnap, pSnap] = await Promise.all([
        getDocs(collection(db, 'tickets')),
        getDocs(collection(db, 'transactions')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'agents')),
        getDocs(query(collection(db, 'transactions'), where('status', '==', 'pending'))),
      ]);
      const tickets = tSnap.docs.map(d => d.data()) as any[];
      const txs = xSnap.docs.map(d => d.data()) as any[];
      res.json({
        status: 'success',
        data: {
          members: uSnap.size,
          agents: aSnap.size,
          tickets: tSnap.size,
          totalBet: tickets.reduce((s, t) => s + (t.totalAmount || 0), 0),
          totalPayout: tickets.reduce((s, t) => s + (t.payout || 0), 0),
          pendingTransactions: pSnap.size,
          transactions: xSnap.size,
          netIn: txs.filter(t => t.type === 'deposit' && t.status === 'approved').reduce((s, t) => s + (t.amount || 0), 0)
               - txs.filter(t => t.type === 'withdraw' && t.status === 'approved').reduce((s, t) => s + (t.amount || 0), 0),
        },
      });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงภาพรวมไม่สำเร็จ' });
    }
  });

  // GET /api/v1/reports/agents — รายชื่อเอเย่นต์ + เครดิต
  r.get('/agents', async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, 'agents'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ status: 'success', count: list.length, data: list });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงเอเย่นต์ไม่สำเร็จ' });
    }
  });

  // GET /api/v1/reports/members — รายชื่อสมาชิก
  r.get('/members', async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(d => {
        const x: any = d.data();
        return { id: d.id, username: x.username, balance: x.balance ?? 0, role: x.role, phoneNumber: x.phoneNumber };
      });
      res.json({ status: 'success', count: list.length, data: list });
    } catch (e) {
      res.status(500).json({ status: 'error', message: 'ดึงสมาชิกไม่สำเร็จ' });
    }
  });

  return r;
}
