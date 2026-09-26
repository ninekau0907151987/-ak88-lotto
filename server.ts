/**
 * server.ts — AK88 Lotto API Server (v2 โครงสร้างใหม่)
 * ==================================================================
 * Express + Vite (dev middleware) + Firestore
 *
 * ★ สิ่งที่เปลี่ยนจาก v1 ★
 *   1. แยก "เส้น" ชัดเจน 4 เส้นที่แยกขาดจากกัน:
 *        /monitor   — เฝ้าดู (อ่านอย่างเดียว)
 *        /queue     — คิวโพย
 *        /billing   — ส่งบิล/ใบเสร็จ
 *        /numberset — ลดเลข/ความเสี่ยง
 *   2. ตรรกะธุรกิจย้ายไป server/domains/ — route ทำแค่ตรวจ input + ตอบกลับ
 *   3. ทุกการเปลี่ยนเครดิตผ่าน server/lib/wallet.ts (atomic) เท่านั้น
 *   4. มี error handler กลาง + requestId ทุก request
 *   5. ชื่อ collection รวมที่ server/config/collections.ts ที่เดียว
 *
 * ลำดับ middleware (ห้ามสลับ):
 *   requestId → cors → json → [API routes] → vite/static → notFound → errorHandler
 *
 * ★ errorHandler ต้องเป็นตัวสุดท้ายเสมอ ไม่งั้น error จะไม่ถูกจับ
 */
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import http from 'http';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

import { createV1Router } from './server/routes/v1/index';
import { requestId, errorHandler, notFoundHandler, asyncHandler } from './server/middleware/error-handler';
import { ok } from './server/lib/response';
import { COL } from './server/config/collections';

// ---- Firebase init ----
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any;
if (fs.existsSync(configPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// ★ รองรับ Firestore emulator — ตั้ง FIRESTORE_EMULATOR_HOST แล้วเชื่อมตรง
//   จำเป็นเพราะถ้า Firestore จริงปฏิเสธสิทธิ์ request จะค้างไม่ตอบกลับ
//   (เจอจริง: หน้าเว็บ timeout 30s แทนที่จะได้ error)
const emuHost = process.env.FIRESTORE_EMULATOR_HOST;
if (emuHost) {
  console.log(`[firebase] ใช้ Firestore emulator ที่ ${emuHost}`);
}

const appFirebase = firebaseConfig ? initializeApp(firebaseConfig) : null;
const db: any = appFirebase ? getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId) : null;
if (db && emuHost) {
  const [host, port] = emuHost.split(':');
  // ★ import แบบ static ที่หัวไฟล์ไม่ได้ → ใช้ dynamic ตรงนี้จุดเดียว
  import('firebase/firestore').then(({ connectFirestoreEmulator }) => {
    try {
      connectFirestoreEmulator(db, host, Number(port) || 8085);
    } catch (e) {
      console.warn('[firebase] connectFirestoreEmulator ล้มเหลว:', (e as Error).message);
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // ---- 1) requestId: ต้องเป็นตัวแรก เพื่อให้ทุก log มีรหัสติด ----
  app.use(requestId);

  app.use(express.json({ limit: '10mb' }));

  // ---- CORS ----
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
    res.header('Access-Control-Expose-Headers', 'X-Request-Id');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  // ==================== API v1 ====================
  app.use('/api/v1', createV1Router(db));

  // ---- อ่านผลรางวัลสาธารณะ (ไม่ต้องใช้ key) ----
  app.get('/api/v1/public/results', asyncHandler(async (req, res) => {
    const { type } = req.query as any;
    const snap = await getDocs(collection(db!, COL.LOTTERY_RESULTS));
    let out = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    if (type) out = out.filter(r => (r.lotterySlug || r.lotteryType || r.type) === type);
    out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    ok(res, out.slice(0, 100));
  }));

  // ---- 404 สำหรับเส้น API ที่ไม่รู้จัก (ต้องมาก่อน errorHandler) ----
  app.use('/api/v1', notFoundHandler);

  // ---- Vite dev middleware / static prod ----
  const httpServer = http.createServer(app);
  if (process.env.NODE_ENV !== 'production') {
    // ★ สำคัญ: hmr ต้องเป็น false เท่านั้นในโหมด middleware
    //   ถ้าส่ง { server: httpServer } Vite จะพยายามเปิด WebSocket ที่ port
    //   24678 ซึ่งอาจชนกับโปรเซสอื่น → middleware ค้าง ไม่ตอบ request
    //   (เจอจริง: ทุกเส้น timeout สลับกันไปมา แม้แต่ /api/v1/health)
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ★ ตัวจัดการ error กลาง — ต้องเป็น middleware ตัวสุดท้ายเสมอ
  app.use(errorHandler);

  const server = httpServer.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API health: http://localhost:${PORT}/api/v1/health`);
    console.log('');
    console.log('เส้น API แยกอิสระต่อกัน:');
    console.log(`  มอนิเตอร์  : http://localhost:${PORT}/api/v1/monitor/health`);
    console.log(`  คิว        : http://localhost:${PORT}/api/v1/queue/stats`);
    console.log(`  ส่งบิล      : http://localhost:${PORT}/api/v1/billing/invoices`);
    console.log(`  ลดเลข      : http://localhost:${PORT}/api/v1/numberset/sets`);

    // ★ เริ่มระบบออกผลหวยยี่กี 88 รอบอัตโนมัติตลอด 24 ชั่วโมง
    if (db) {
      try {
        const { YeekeeWorker } = await import('./server/cron/yeekee-worker');
        const worker = new YeekeeWorker(db);
        worker.start(20000);
      } catch (err) {
        console.warn('[YeekeeWorker] เริ่มต้น Worker ไม่สำเร็จ:', (err as Error).message);
      }
    }
  });

  const handleShutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

startServer();
