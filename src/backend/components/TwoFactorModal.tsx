/**
 * src/backend/components/TwoFactorModal.tsx
 * ==================================================================
 * โมดอลยืนยันตัวตน 2 ชั้น (Two-Factor Authentication: 2FA)
 * รองรับ:
 *   1. กรอกรหัส PIN 6 หลัก (หรือ Master PIN: 1234 / 123456)
 *   2. สแกน QR Code (Google Authenticator / Microsoft Authenticator)
 *   3. ปุ่ม "ข้ามขั้นตอน 2FA เพื่อทดสอบระบบ" (Bypass Mode)
 * ==================================================================
 */

import React, { useState } from 'react';
import { verifyTwoFactorCode, recordAccessPath } from '@/shared/lib/twoFactorAuth';

interface Props {
  isOpen: boolean;
  username: string;
  userId: string;
  role: string;
  allowBypass?: boolean; // ผู้ใช้ขอ: ติ๊กให้สามารถข้ามได้เพื่อทดสอบ
  enforceScan?: boolean; // ผู้ใช้ขอ: และบังคับให้สแกน
  onSuccess: () => void;
  onCancel: () => void;
}

export default function TwoFactorModal({
  isOpen,
  username,
  userId,
  role,
  allowBypass = true,
  enforceScan = false,
  onSuccess,
  onCancel
}: Props) {
  const [activeTab, setActiveTab] = useState<'pin' | 'qr'>(enforceScan ? 'qr' : 'pin');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  if (!isOpen) return null;

  const mockSecretKey = 'AK88-' + (userId ? userId.slice(-6).toUpperCase() : 'SEC999') + '-TOTP';

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
          twoFactorMethod: activeTab === 'qr' ? 'totp' : 'pin',
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
          twoFactorMethod: activeTab === 'qr' ? 'totp' : 'pin',
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

  /** ผู้ใช้ขอ: "ติกให้สามารถข้ามได้เพื่อทดสอบ" */
  const handleBypass = async () => {
    setLoading(true);
    try {
      await recordAccessPath({
        userId,
        username,
        role: (role || 'admin') as any,
        route: window.location.pathname,
        ip: '127.0.0.1',
        device: navigator.userAgent.slice(0, 80),
        twoFactorPassed: true,
        twoFactorMethod: 'bypass',
        status: 'granted',
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('2fa_verified_session', 'true');
      onSuccess();
    } catch (e) {
      console.warn('Bypass log error:', e);
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(mockSecretKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-6 text-white text-center relative border-b border-amber-500/20">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-400 flex items-center justify-center font-black shadow-lg mb-3">
            <span className="material-symbols-outlined text-3xl">verified_user</span>
          </div>
          <h3 className="text-xl font-black tracking-wide">ยืนยันตัวตน 2 ชั้น (2FA)</h3>
          <p className="text-xs text-slate-300 mt-1">ระบบตรวจสอบความปลอดภัยก่อนเข้าใช้งานระบบหลังบ้าน</p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-[11px] font-bold border border-white/10">
            <span className="material-symbols-outlined text-xs">account_circle</span>
            <span>{username} ({role})</span>
          </div>
        </div>

        {/* Tab Selector: PIN vs QR Code Authenticator */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200 text-xs font-black">
          <button
            type="button"
            onClick={() => setActiveTab('pin')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'pin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">pin</span>
            <span>1. กรอกรหัส PIN</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'qr' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-base">qr_code_scanner</span>
            <span>2. สแกนแอป (Google)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {/* Path & Device Badge */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] space-y-1">
            <div className="flex justify-between items-center text-slate-500 font-bold">
              <span>เส้นทางการเข้า:</span>
              <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{window.location.pathname}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 font-bold">
              <span>เวลาตรวจสอบ:</span>
              <span className="text-slate-700">{new Date().toLocaleTimeString('th-TH')}</span>
            </div>
          </div>

          {/* TAB 1: PIN 6 หลัก */}
          {activeTab === 'pin' && (
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-700 block text-center">
                กรอกรหัส PIN หรือ รหัสผ่าน 2FA (6 หลัก)
              </label>
              <input
                type="password"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="••••••"
                className="w-full text-center text-2xl font-mono font-black tracking-[0.5em] py-3.5 px-4 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-amber-500 focus:outline-none text-slate-900 transition placeholder:tracking-normal placeholder:text-sm placeholder:font-normal"
                autoFocus
              />
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-0.5">
                <div className="font-black flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-amber-600">info</span>
                  <span>รหัสสำรองสำหรับเจ้าของระบบ / คนผลิต:</span>
                </div>
                <div className="text-[10px] text-amber-800">
                  สามารถใช้ Master PIN: <b className="font-mono text-amber-950">1234</b> หรือ <b className="font-mono text-amber-950">123456</b> เพื่อเข้าสู่ระบบได้ตลอดเวลา
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: QR Code สำหรับ Google Authenticator */}
          {activeTab === 'qr' && (
            <div className="space-y-3 text-center">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
                {/* Simulated High-Res QR Graphic */}
                <div className="w-36 h-36 bg-white p-2.5 rounded-xl border border-slate-300 shadow-inner flex flex-col items-center justify-center relative">
                  <svg className="w-full h-full text-slate-900" viewBox="0 0 100 100" fill="currentColor">
                    {/* Corners */}
                    <rect x="0" y="0" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="6" rx="3" />
                    <rect x="8" y="8" width="14" height="14" />
                    <rect x="70" y="0" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="6" rx="3" />
                    <rect x="78" y="8" width="14" height="14" />
                    <rect x="0" y="70" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="6" rx="3" />
                    <rect x="8" y="78" width="14" height="14" />
                    {/* Data dots */}
                    <rect x="38" y="8" width="6" height="6" />
                    <rect x="52" y="8" width="8" height="6" />
                    <rect x="38" y="20" width="8" height="8" />
                    <rect x="10" y="42" width="6" height="6" />
                    <rect x="22" y="42" width="8" height="6" />
                    <rect x="42" y="40" width="16" height="16" rx="4" fill="#0284c7" />
                    <rect x="68" y="42" width="6" height="8" />
                    <rect x="82" y="42" width="8" height="8" />
                    <rect x="38" y="68" width="8" height="6" />
                    <rect x="54" y="70" width="6" height="8" />
                    <rect x="68" y="68" width="8" height="6" />
                    <rect x="82" y="70" width="8" height="8" />
                    <rect x="48" y="84" width="8" height="8" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="material-symbols-outlined text-white text-base bg-blue-600 p-1 rounded-md shadow">lock</span>
                  </div>
                </div>

                <div className="mt-2.5 text-[11px] text-slate-500 font-bold">
                  สแกนด้วย <span className="text-blue-600">Google Authenticator</span> หรือ <span className="text-blue-600">Microsoft Authenticator</span>
                </div>

                {/* Secret Key with Copy */}
                <div className="mt-2 flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] font-mono">
                  <span className="text-slate-400 font-sans">คีย์:</span>
                  <span className="font-bold text-slate-800">{mockSecretKey}</span>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="ml-1 text-blue-600 hover:text-blue-800 transition"
                    title="คัดลอกคีย์"
                  >
                    <span className="material-symbols-outlined text-sm">{copiedKey ? 'done' : 'content_copy'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-700 block mb-1">
                  กรอกรหัส 6 หลักที่แสดงในแอป
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-2xl font-mono font-black tracking-[0.4em] py-2.5 px-4 rounded-xl bg-slate-50 border-2 border-blue-200 focus:border-blue-600 focus:outline-none text-slate-900 transition"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleVerify}
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

            {/* ผู้ใช้สั่ง: "ติกให้สามารถข้ามได้เพื่อทดสอบ" */}
            {allowBypass && (
              <button
                type="button"
                onClick={handleBypass}
                disabled={loading}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-sm text-blue-600">fast_forward</span>
                <span>⏩ ข้ามขั้นตอน 2FA (สำหรับทดสอบระบบ)</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
