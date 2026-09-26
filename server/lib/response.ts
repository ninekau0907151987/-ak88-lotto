/**
 * server/lib/response.ts
 * ------------------------------------------------------------------
 * มาตรฐานการตอบกลับ API — ใช้ตัวเดียวกันทั้งระบบ
 * ห้าม res.json() ตรงๆ ใน route ให้ใช้ ok() / fail() เท่านั้น
 *
 * รูปแบบสำเร็จ:
 *   { status:'success', data?, count?, message? }
 * รูปแบบผิดพลาด:
 *   { status:'error', code:'...', message:'...', details?, requestId }
 */
import type { Response } from 'express';

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  [k: string]: unknown;
}

/** ตอบกลับสำเร็จ */
export function ok(res: Response, data: unknown = null, extra: Record<string, unknown> = {}) {
  res.json({ status: 'success', data, ...extra });
}

/** ตอบกลับสำเร็จแบบมีจำนวน */
export function okList(res: Response, data: unknown[], meta: ApiMeta = {}) {
  res.json({ status: 'success', count: data.length, data, ...meta });
}

/** ตอบกลับผิดพลาด — ใช้ code เป็นตัวระบุ ห้ามให้ client เทียบข้อความ */
export function fail(
  res: Response,
  httpStatus: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: Record<string, unknown> = {
    status: 'error',
    code,
    message,
    requestId: (res.locals.requestId as string) || undefined,
  };
  if (details !== undefined) body.details = details;
  res.status(httpStatus).json(body);
}

/** รหัสข้อผิดพลาดมาตรฐาน — ใช้คู่นี้เสมอทั้งระบบ */
export const ERR = {
  BAD_REQUEST: 'BAD_REQUEST',
  MISSING_AUTH: 'MISSING_AUTH',
  INVALID_KEY: 'INVALID_KEY',
  SCOPE_DENIED: 'SCOPE_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BETTING_CLOSED: 'BETTING_CLOSED',
  LOTTERY_CLOSED: 'LOTTERY_CLOSED',
  NUMBER_BLOCKED: 'NUMBER_BLOCKED',
  INSUFFICIENT_CREDIT: 'INSUFFICIENT_CREDIT',
  ALREADY_SETTLED: 'ALREADY_SETTLED',
  ROUND_CLOSED: 'ROUND_CLOSED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;
