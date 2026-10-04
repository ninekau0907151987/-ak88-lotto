/**
 * src/backend/components/TwoFactorModal.tsx
 * ==================================================================
 * โมดอลยืนยันตัวตน 2 ชั้น (Two-Factor Authentication: 2FA)
 * แสดงเมื่อเปิดเข้าสู่ระบบหลังบ้าน และบันทึกเส้นทางการเข้าใช้งาน
 * ==================================================================
 */

import React, { useState } from 'react';
import { verifyTwoFactorCode, recordAccessPath } from '@/shared/lib/twoFactorAuth';

interface Props {
  isOpen: boolean;
  username: string;
  userId: string;
  role: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function TwoFactorModal({
  isOpen,
  username,
  userId,
  role,
  onSuccess,
  onCancel
}: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    const inputCode = code.trim();
    if (!inputCode) {
      setError('กรุณากรอกรหัส 2FA หรือ PIN 6 หลัก');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyTwoFactorCode(userId, inputCode, role);
      if (result.success) {
        // บันทึกเส้นทางการเข้าใช้งานว่าผ่าน 2FA เรียบร้อยแล้ว
        await recordAccessPath({
          userId,
          username,
          role: (role || 'admin') as any,
          route: window.location.pathname,
          ip: '127.0.0.1',
          device: navigator.userAgent.slice(0, 80),
          twoFactorPassed: true,
          twoFactorMethod: inputCode.length <= 4 ? 'pin' : 'totp',
          status: 'granted',
          timestamp: new Date().toISOString()
        });

        localStorage.setItem('2fa_verified_session', 'true');
        onSuccess();
      } else {
        setError(result.message || 'รหัส 2FA ไม่ถูกต้อง');
        await recordAccessPath({
          userId,
          username,
          role: (role || 'admin') as any,
          route: window.location.pathname,
          ip: '127.0.0.1',
          device: navigator.userAgent.slice(0, 80),
          twoFactorPassed: false,
          twoFactorMethod: 'pin',
          status: 'denied',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 text-white text-center relative">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-400 flex items-center justify-center font-black shadow-lg mb-3">
            <span className="material-symbols-outlined text-3xl">verified_user</span>
          </div>
          <h3 className="text-xl font-black tracking-wide">ยืนยันตัวตน 2 ชั้น (2FA)</h3>
          <p className="text-xs text-slate-300 mt-1">ระบบตรวจสอบความปลอดภัยก่อนเข้าใช้งานแดชบอร์ด</p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-[11px] font-bold">
            <span className="material-symbols-outlined text-xs">account_circle</span>
            <span>{username} ({role})</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Path & Device Badge */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] space-y-1">
            <div className="flex justify-between items-center text-slate-500 font-bold">
              <span>เส้นทางการเข้า:</span>
              <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{window.location.pathname}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 font-bold">
              <span>เวลาตรวจสอบ:</span>
              <span className="text-slate-700">{new Date().toLocaleTimeString('th-TH')}</span>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="text-xs font-black text-slate-700 block mb-2 text-center">
                กรอกรหัส PIN หรือ รหัสผ่าน 2FA (6 หลัก)
              </label>
              <input
                type="password"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="••••••"
                className="w-full text-center text-2xl font-mono font-black tracking-[0.5em] py-3.5 px-4 rounded-2xl bg-slate-100 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 transition placeholder:tracking-normal placeholder:text-sm placeholder:font-normal"
                autoFocus
              />
              <p className="text-[10px] text-slate-400 text-center mt-1.5 font-bold">
                (ผู้ดูแลระบบ / คนผลิต / เจ้าของ สามารถใช้ Master PIN: 1234 หรือ 123456 ได้)
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-white font-black text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <span>กำลังตรวจ...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">lock_open</span>
                    <span>ยืนยันเข้าใช้งาน</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
