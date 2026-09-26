/**
 * server/middleware/auth.ts
 * ------------------------------------------------------------------
 * API Authentication Middleware
 * - ตรวจสอบ API Key จาก Firestore collection `api_keys`
 * - แนบข้อมูล key ลง res.locals.apiKeyDoc
 * - บันทึก lastUsed + usage count (audit)
 */
import type { Request, Response, NextFunction } from 'express';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export function createAuthMiddleware(db: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1) อนุญาตให้ใช้ staff session (owner / master / admin)
    const staffSessionRaw = req.headers['x-staff-session'];
    if (staffSessionRaw && typeof staffSessionRaw === 'string') {
      try {
        let txt = staffSessionRaw.trim().startsWith('{') ? staffSessionRaw : Buffer.from(staffSessionRaw, 'base64').toString('utf-8');
        const sess = JSON.parse(txt);
        if (['owner', 'master', 'admin'].includes(sess?.role)) {
          res.locals.apiKeyDoc = { scopes: [] };
          next();
          return;
        }
      } catch {}
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // ตรวจสอบ localhost / dev environment
      const ip = req.ip || req.socket?.remoteAddress;
      const isLocal = !ip || ip === '127.0.0.1' || ip === '::1' || ip.includes('localhost') || ip.includes('127.0.0.1');
      if (isLocal && req.headers.referer?.includes('/admin')) {
        res.locals.apiKeyDoc = { scopes: [] };
        next();
        return;
      }
      res.status(401).json({ status: 'error', code: 'MISSING_AUTH', message: 'Missing or invalid Authorization header' });
      return;
    }

    const apiKey = authHeader.split(' ')[1];
    if (!db) {
      res.status(500).json({ status: 'error', code: 'DB_NOT_INIT', message: 'Database not initialized' });
      return;
    }

    try {
      // ลอง query แบบ 2 where ก่อน (ต้องมี composite index)
      let keyData: any = null;
      let keyId: string | null = null;
      try {
        const q = query(collection(db, 'api_keys'), where('key', '==', apiKey), where('status', '==', 'active'));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          keyId = snapshot.docs[0].id;
          keyData = snapshot.docs[0].data();
        }
      } catch {
        // fallback: query แค่ key (ไม่ต้องใช้ composite index)
        const q2 = query(collection(db, 'api_keys'), where('key', '==', apiKey));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          const doc0 = snap2.docs[0];
          if ((doc0.data().status ?? 'active') === 'active') {
            keyId = doc0.id;
            keyData = doc0.data();
          }
        }
      }

      if (!keyData || !keyId) {
        res.status(401).json({ status: 'error', code: 'INVALID_KEY', message: 'Invalid or inactive API Key', requestId: res.locals.requestId });
        return;
      }

      res.locals.apiKeyDoc = keyData;
      res.locals.apiKeyId = keyId;

      // Audit: update lastUsed (fire-and-forget — ห้ามให้ล้มแล้วบล็อก request)
      updateDoc(doc(db, 'api_keys', keyId), {
        lastUsed: serverTimestamp(),
        usageCount: ((keyData.usageCount as number) || 0) + 1,
      }).catch(() => {});

      next();
    } catch (error: any) {
      // ★ แยกให้ออกว่า "DB เข้าไม่ได้" กับ "คีย์ผิด" — คนละปัญหา คนละวิธีแก้
      if (error?.code === 'permission-denied') {
        console.error('[AUTH] Firestore ปฏิเสธการเข้าถึง — firestore.rules ที่ deploy ไม่อนุญาตให้อ่าน api_keys', error?.message);
        res.status(503).json({
          status: 'error',
          code: 'FIRESTORE_PERMISSION_DENIED',
          message: 'เซิร์ฟเวอร์เข้าถึงฐานข้อมูลไม่ได้ (Firestore Rules) — แจ้งผู้ดูแลระบบ',
          hint: 'ตรวจว่าได้ deploy firestore.rules แล้ว: npx firebase deploy --only firestore:rules',
          requestId: res.locals.requestId,
        });
        return;
      }
      if (error?.code === 'unavailable' || error?.code === 'deadline-exceeded') {
        res.status(503).json({ status: 'error', code: 'DB_UNAVAILABLE', message: 'ฐานข้อมูลไม่ตอบสนอง ลองใหม่อีกครั้ง', requestId: res.locals.requestId });
        return;
      }
      console.error('[AUTH] ไม่คาดคิด:', error?.stack || error);
      res.status(500).json({ status: 'error', code: 'AUTH_ERROR', message: 'Internal server error during authentication', requestId: res.locals.requestId });
    }
  };
}

/**
 * ตรวจสิทธิ์ตาม scope ของ API Key
 * api_keys doc สามารถมี field `scopes: ['bet','finance',...]`
 * ถ้าไม่มี scopes = เข้าได้ทุกอย่าง (backward compatible)
 */
export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const keyData = res.locals.apiKeyDoc;
    const scopes: string[] | undefined = keyData?.scopes;
    if (!scopes || scopes.length === 0 || scopes.includes(scope)) {
      next();
      return;
    }
    res.status(403).json({ status: 'error', code: 'SCOPE_DENIED', message: `API key นี้ไม่มีสิทธิ์ scope: ${scope}` });
  };
}
