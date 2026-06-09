'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { useAppStore } from '@/lib/store';
import { Phone, Lock, ShieldAlert } from 'lucide-react';

export default function LiffProvider({ children }: { children: React.ReactNode }) {
  const [liffLoaded, setLiffLoaded] = useState(false);
  const [liffError, setLiffError] = useState<string | null>(null);
  const currentUser = useAppStore((state) => state.currentUser);
  const setUser = useAppStore((state) => state.setUser);

  // Phone onboarding state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submittingPhone, setSubmittingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    // If no LIFF ID is provided, mock the user for local development
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      console.warn('NEXT_PUBLIC_LIFF_ID is not set. Authenticating mock user with backend...');
      fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUid: 'U_ADMIN_MOCK',
          name: 'Mock Admin',
        }),
      })
        .then((res) => res.json())
        .then((userData) => {
          // Force role to ADMIN and phone to null for onboarding and permission testing
          setUser({
            ...userData,
            role: 'ADMIN',
            phone: null,
          });
          setLiffLoaded(true);
        })
        .catch((err) => {
          console.error('Failed to mock authenticate:', err);
          setLiffError('ไม่สามารถจำลองการยืนยันตัวตนกับฐานข้อมูลได้');
        });
      return;
    }

    liff
      .init({ liffId })
      .then(async () => {
        if (!liff.isLoggedIn()) {
          liff.login();
          return; // Wait for redirect
        }

        const profile = await liff.getProfile();
        
        // Authenticate with our backend
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineUid: profile.userId,
            name: profile.displayName,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to authenticate with backend');
        }

        const userData = await response.json();
        setUser(userData);
        setLiffLoaded(true);
      })
      .catch((err) => {
        console.error('LIFF init error', err);
        setLiffError(err.message || 'Failed to initialize LIFF');
        setLiffLoaded(true); // Proceed anyway so app doesn't hang
      });
  }, [setUser]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // Validate 10-digit Thailand mobile number
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      setPhoneError('กรุณากรอกเบอร์โทรศัพท์มือถือ 10 หลัก (เช่น 0812345678)');
      return;
    }

    setSubmittingPhone(true);
    setPhoneError(null);

    try {
      const res = await fetch('/api/auth/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          phone: phoneNumber,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'เกิดข้อผิดพลาดในการเซฟข้อมูล');
      }

      const updatedUser = await res.json();
      // Update global Zustand state with saved phone to lift onboarding screen
      setUser(updatedUser);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
      setPhoneError(errMsg);
    } finally {
      setSubmittingPhone(false);
    }
  };

  if (!liffLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface-muted">
        <div className="flex flex-col items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-primary font-bold text-sm">กำลังเชื่อมต่อ LINE...</p>
        </div>
      </div>
    );
  }

  if (liffError) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4 bg-surface-muted">
        <div className="rounded-2xl bg-surface border border-border p-6 text-center shadow-lg max-w-sm">
          <ShieldAlert className="w-12 h-12 text-danger mx-auto mb-4" />
          <p className="font-extrabold text-text-primary">เกิดข้อผิดพลาดในการโหลดระบบ</p>
          <p className="mt-2 text-xs text-text-secondary leading-relaxed">{liffError}</p>
        </div>
      </div>
    );
  }

  // 🔐 Phone Onboarding Guard Modal (Blocking/Non-bypassable)
  if (currentUser && !currentUser.phone) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
        <div className="bg-surface w-full max-w-md rounded-3xl border border-border p-6 sm:p-8 shadow-2xl animate-slide-up flex flex-col justify-between">
          
          <div className="text-center space-y-4">
            <div className="w-14 h-14 bg-primary-light text-primary rounded-2xl flex items-center justify-center mx-auto border border-primary/10 shadow-sm">
              <Phone size={24} />
            </div>
            
            <h1 className="text-xl font-black text-text-primary tracking-wide">
              ลงทะเบียนเบอร์ติดต่อผู้ใช้งาน
            </h1>
            <p className="text-xs text-text-secondary leading-relaxed max-w-[90%] mx-auto">
              กรุณาระบุหมายเลขโทรศัพท์มือถือของคุณ เพื่อใช้ในการยืนยันตัวตนและความปลอดภัยในการอัปโหลดรายงานคุณภาพน้ำทะเลชายฝั่ง
            </p>
          </div>

          <form onSubmit={handlePhoneSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">
                เบอร์โทรศัพท์ติดต่อ (Contact Phone Number)
              </label>
              <div className="relative">
                <input
                  type="tel"
                  maxLength={10}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="เช่น 0891234567"
                  className="w-full px-5 py-4 pl-12 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[52px]"
                />
                <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
              </div>
              
              {phoneError && (
                <p className="text-[10px] text-danger font-bold mt-1 px-1 flex items-center gap-1.5 animate-fade-in">
                  <ShieldAlert size={12} />
                  {phoneError}
                </p>
              )}
            </div>

            <div className="bg-surface-subtle p-3 rounded-2xl border border-border flex items-start gap-2.5">
              <Lock size={12} className="text-text-muted flex-shrink-0 mt-0.5" />
              <p className="text-[9px] text-text-secondary leading-relaxed font-semibold">
                ข้อมูลส่วนบุคคลของท่าน (PII) จะถูกเก็บรักษาไว้อย่างปลอดภัยสูงสุดและแสดงเฉพาะผู้ดูแลระบบหลัก (Admin) เท่านั้นตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA)
              </p>
            </div>

            <button
              type="submit"
              disabled={submittingPhone || phoneNumber.length < 10}
              className="w-full py-4 min-h-[52px] bg-primary hover:bg-navy-dark text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {submittingPhone ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  กำลังลงทะเบียน...
                </>
              ) : (
                'ยืนยันข้อมูลและเข้าใช้งาน'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
