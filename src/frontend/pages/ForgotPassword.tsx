import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function ForgotPassword() {
  const navigate = useNavigate();

  // Form states
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI flow states
  const [step, setStep] = useState<'request_otp' | 'verify_and_reset' | 'success'>('request_otp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refCode, setRefCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for resend OTP
  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!/^0[689]\d{8}$/.test(cleanPhone)) {
      setError('กรุณากรอกเบอร์โทรศัพท์ 10 หลักที่ถูกต้อง (เช่น 0812345678)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();

      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || 'ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่');
      }

      setRefCode(data.data?.ref || 'AK88');
      setStep('verify_and_reset');
      setCountdown(60);

      // Auto-fill debug code if provided
      if (data.data?.debugCode) {
        console.log('[DEBUG OTP CODE]:', data.data.debugCode);
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const cleanOtp = otpCode.replace(/[^0-9]/g, '');

    if (cleanOtp.length !== 6) {
      setError('กรุณากรอกรหัส OTP 6 หลัก');
      return;
    }

    if (newPassword.length < 6) {
      setError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          code: cleanOtp,
          newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || 'รีเซ็ตรหัสผ่านไม่สำเร็จ');
      }

      setStep('success');
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      {/* Background Glow */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-amber-500/20 rounded-3xl p-8 shadow-2xl shadow-amber-500/10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-yellow-300 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
              <span className="material-symbols-outlined text-3xl text-slate-950 font-bold">
                {step === 'success' ? 'check_circle' : 'lock_reset'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-wide">
              {step === 'success' ? 'เปลี่ยนรหัสผ่านสำเร็จ' : 'ลืมรหัสผ่าน'}
            </h2>
            <p className="text-slate-400 text-sm mt-2">
              {step === 'request_otp' && 'กรุณากรอกเบอร์โทรศัพท์ที่ใช้สมัคร เพื่อรับรหัส OTP ยืนยัน'}
              {step === 'verify_and_reset' && `ระบุรหัส OTP ที่ได้รับทาง SMS (Ref: ${refCode}) และตั้งรหัสผ่านใหม่`}
              {step === 'success' && 'รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว เข้าสู่ระบบได้ทันที'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Request OTP */}
          {step === 'request_otp' && (
            <form onSubmit={handleRequestOtp} className="space-y-6">
              <div>
                <label className="text-slate-300 text-sm font-bold mb-2 block">
                  เบอร์โทรศัพท์ที่ลงทะเบียน
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    phone_android
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-base font-mono"
                    placeholder="08xxxxxxxx"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length < 10}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl py-3.5 text-base shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="animate-spin material-symbols-outlined text-xl">progress_activity</span>
                ) : (
                  <>
                    <span>รับรหัส OTP ทาง SMS</span>
                    <span className="material-symbols-outlined text-lg">sms</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: Verify OTP and Reset */}
          {step === 'verify_and_reset' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-slate-300 text-xs font-bold">
                    รหัส OTP 6 หลัก <span className="text-amber-400">(Ref: {refCode})</span>
                  </label>
                  {countdown > 0 ? (
                    <span className="text-xs text-slate-500 font-mono">ขอใหม่ใน {countdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRequestOtp()}
                      className="text-xs text-amber-400 hover:underline cursor-pointer font-bold"
                    >
                      ขอรหัสใหม่
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    pin
                  </span>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl py-3.5 pl-11 pr-4 text-white text-center font-mono tracking-widest text-xl font-bold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    placeholder="------"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-bold mb-1.5 block">
                  รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    key
                  </span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm"
                    placeholder="รหัสผ่านใหม่"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-xs font-bold mb-1.5 block">
                  ยืนยันรหัสผ่านใหม่
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                    lock
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm"
                    placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6 || newPassword.length < 6}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl py-3.5 text-base shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="animate-spin material-symbols-outlined text-xl">progress_activity</span>
                ) : (
                  <>
                    <span>ยืนยันเปลี่ยนรหัสผ่าน</span>
                    <span className="material-symbols-outlined text-lg">check</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 3: Success Screen */}
          {step === 'success' && (
            <div className="space-y-6 text-center">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                รหัสผ่านใหม่ของคุณได้รับการอัปเดตเรียบร้อยแล้ว สามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที
              </div>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl py-3.5 text-base shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                ไปที่หน้าเข้าสู่ระบบ
              </button>
            </div>
          )}

          {/* Back to Login Link */}
          <div className="text-center mt-6">
            <Link
              to="/login"
              className="text-slate-400 hover:text-amber-400 text-sm inline-flex items-center gap-1.5 transition-colors font-semibold"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
