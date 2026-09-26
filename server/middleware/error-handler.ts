/**
 * server/middleware/error-handler.ts
 * ------------------------------------------------------------------
 * จัดการข้อผิดพลาดกลาง — ลด try/catch ซ้ำๆ ในทุก route
 *
 * วิธีใช้ใน route:
 *   r.post('/bet', asyncHandler(async (req, res) => {
 *     ...
 *     throw new AppError(...)               // โยนได้เลย ไม่ต้องจับ
 *     ok(res, result);
 *   }));
 *
 * และใน server.ts ต้องผูกตัวจัดการท้ายสุด:
 *   app.use(notFoundHandler);
 *   app.use(errorHandler);
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../lib/wallet';
import { fail, ERR } from '../lib/response';

/** ห่อ async handler ให้ error วิ่งเข้า errorHandler อัตโนมัติ */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * ให้ requestId แก่ทุก request — ใช้ trace ปัญหาข้าม log
 * เก็บไว้ที่ res.locals.requestId และส่งกลับใน header X-Request-Id
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers['x-request-id'] as string) || '';
  const id = incoming || `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  res.locals.requestId = id;
  res.header('X-Request-Id', id);
  next();
}

/** 404 สำหรับเส้น API ที่ไม่รู้จัก */
export function notFoundHandler(_req: Request, res: Response) {
  fail(res, 404, ERR.NOT_FOUND, 'ไม่พบ API นี้ — ดูรายการโมดูลที่ /api/v1/health');
}

/** ตัวจัดการ error กลาง — ต้องเป็น middleware ตัวสุดท้ายของ app */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const requestId = res.locals.requestId || 'n/a';

  // ---- ข้อผิดพลาดธุรกิจที่เราตั้งใจโยน ----
  if (err instanceof AppError) {
    console.warn(`[${requestId}] ${err.code}: ${err.message}`);
    fail(res, err.httpStatus, err.code, err.message, err.details);
    return;
  }

  // ---- ข้อผิดพลาดที่รู้จัก (JSON เพี้ยน / body ใหญ่เกิน) ----
  if (err?.type === 'entity.parse.failed') {
    fail(res, 400, ERR.BAD_REQUEST, 'รูปแบบ JSON ไม่ถูกต้อง');
    return;
  }
  if (err?.type === 'entity.too.large') {
    fail(res, 413, 'PAYLOAD_TOO_LARGE', 'ข้อมูลที่ส่งมีขนาดใหญ่เกินไป');
    return;
  }

  // ---- ที่เหลือคือบั๊กจริง — log ให้ครบเพื่อ debug ----
  console.error(`[${requestId}] UNHANDLED:`, err?.stack || err);
  fail(res, 500, ERR.INTERNAL, 'เกิดข้อผิดพลาดภายในระบบ');
}
