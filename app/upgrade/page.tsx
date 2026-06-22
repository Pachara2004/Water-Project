'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { KeyRound, ShieldAlert, ArrowLeft, Lock, ShieldCheck, Sparkles } from 'lucide-react';

export default function UpgradePage() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const currentUser = useAppStore((state) => state.currentUser);
  const setRole = useAppStore((state) => state.setRole);
  const router = useRouter();

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, passcode }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Upgrade failed');

      setRole(data.role);

      if (data.role === 'COLLECTOR') router.push('/collector');
      else if (data.role === 'EXECUTIVE') router.push('/executive');
      else if (data.role === 'ADMIN') router.push('/manage/locations');
      else router.push('/map');

    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex min-h-dvh bg-surface-muted w-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-text-muted">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold font-mono">Loading User Auth...</span>
        </div>
      </div>
    );
  }

  return (
    /*
      Mobile : full-width, no outer card
      sm:    : centred max-w-md, floating card feel
      lg:    : wider max-w-lg
    */
    <div className="min-h-dvh bg-surface-muted pb-10
                    flex items-start sm:items-center justify-center
                    px-4 sm:px-6 pt-12 sm:pt-0
                    transition-colors duration-300">

      <div className="w-full max-w-md sm:max-w-lg">

        {/* Card */}
        <div className="bg-surface rounded-3xl p-8 sm:p-10 lg:p-12 border border-border shadow-sm space-y-8 relative overflow-hidden transition-all duration-200">

          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-surface-subtle text-primary rounded-3xl flex items-center justify-center border border-border shadow-inner">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-md border border-white dark:border-slate-900">
                <ShieldCheck size={14} />
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-wide leading-tight mb-3">
              ยืนยันสิทธิ์การเข้าใช้งาน
            </h1>
            <p className="text-sm sm:text-base text-text-secondary max-w-[85%] leading-loose">
              โปรดกรอกรหัสยืนยันสิทธิ์ (Passcode) เพื่อทำการเปิดขอบข่ายหน้าที่ตามการปฏิบัติงานของคุณ
            </p>
          </div>

          <form onSubmit={handleUpgrade} className="space-y-5">
            <div className="space-y-3">
              <label className="text-xs sm:text-sm font-bold text-text-muted uppercase tracking-wider block font-mono">
                Access Passcode
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-muted">
                  <KeyRound size={17} />
                </div>
                <input
                  type="text"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="••••••"
                  className="w-full pl-11 pr-4 py-4 bg-surface-subtle border border-border text-text-primary
                             font-mono tracking-widest text-center text-lg sm:text-xl
                             rounded-2xl placeholder:text-text-muted/30
                             focus:border-primary focus:ring-2 focus:ring-primary/20
                             transition-all outline-none min-h-[56px]"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-2xl bg-red-50/50 dark:bg-red-950/15 border border-red-500/20 p-4 text-xs sm:text-sm text-red-700 dark:text-red-300">
                <ShieldAlert className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="font-semibold leading-relaxed">{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 min-h-[56px]
                         bg-primary hover:bg-navy-dark text-white
                         font-bold rounded-2xl text-sm sm:text-base
                         uppercase tracking-wider transition-all duration-300
                         disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed
                         flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  กำลังยืนยันสิทธิ์...
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  ตรวจสอบระดับสิทธิ์การเข้าใช้
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm sm:text-sm text-text-muted leading-loose max-w-[80%] mx-auto">
            * หากยังไม่ได้รับรหัสผ่านมาตรฐาน กรุณาติดต่อผู้อำนวยการส่วนเทคโนโลยีหรือผู้ดูแลระบบเครือข่ายความปลอดภัยหลัก
          </p>
        </div>
      </div>
    </div>
  );
}
