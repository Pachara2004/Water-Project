"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { Phone, UserPen, ShieldAlert, User, CheckCircle2 } from "lucide-react";

export default function LiffProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [liffLoaded, setLiffLoaded] = useState(false);
    const [liffError, setLiffError] = useState<string | null>(null);
    const currentUser = useAppStore((state) => state.currentUser);
    const setUser = useAppStore((state) => state.setUser);

    // Onboarding States: ปล่อยหน้า UI เก็บตัวแปรเดียวเหมือนเดิมเพื่อให้กรอกง่าย
    const [fullName, setFullName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
            console.warn(
                "NEXT_PUBLIC_LIFF_ID is not set. Authenticating mock user...",
            );
            // ปรับเส้นทางไปหาพาธจริงตามที่คุยกันไว้ครับบอส
            fetch("/api/auth/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lineUid: "U_ADMIN_MOCK",
                    name: "Mock Admin",
                }),
            })
                .then((res) => res.json())
                .then((resData) => {
                    if (resData.success) {
                        setUser({
                            ...resData.user,
                            role: "admin", // เปลี่ยนเป็นพิมพ์เล็กตามระบบใหม่
                            phoneNumber: null, // ตั้งไว้เป็น null เพื่อทดสอบแผง Onboarding Guard
                        });
                    }
                    setLiffLoaded(true);
                })
                .catch((err) => {
                    console.error("Failed to mock authenticate:", err);
                    setLiffError("ไม่สามารถจำลองการยืนยันตัวตนกับฐานข้อมูลได้");
                });
            return;
        }

        liff.init({ liffId })
            .then(async () => {
                if (!liff.isLoggedIn()) {
                    liff.login();
                    return;
                }

                const profile = await liff.getProfile();
                const response = await fetch("/api/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lineUid: profile.userId,
                        name: profile.displayName,
                    }),
                });

                if (!response.ok)
                    throw new Error("Failed to authenticate with backend");

                const resData = await response.json();
                if (resData.success) {
                    setUser(resData.user); // บันทึกข้อมูล { id, lineUniqueId, role, phoneNumber, ... } ลง Store
                }
                setLiffLoaded(true);
            })
            .catch((err) => {
                console.error("LIFF init error", err);
                setLiffError(err.message || "Failed to initialize LIFF");
                setLiffLoaded(true);
            });
    }, [setUser]);

    const handleOnboardingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        const trimmedName = fullName.trim();
        if (!trimmedName) {
            setFormError("กรุณากรอกชื่อ-นามสกุลจริงของคุณ");
            return;
        }

        if (!/^[0-9]{10}$/.test(phoneNumber)) {
            setFormError(
                "กรุณากรอกเบอร์โทรศัพท์มือถือให้ครบ 10 หลัก (เช่น 0812345678)",
            );
            return;
        }

        const nameParts = trimmedName.split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || ""; // เผื่อนามสกุลพิมพ์ยาวหรือเว้นวรรคซ้อน

        setSubmitting(true);
        setFormError(null);

        try {
            const res = await fetch("/api/auth/onboarding", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: currentUser.id,
                    firstName,
                    lastName,
                    phoneNumber,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(
                    errData.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
                );
            }

            const resData = await res.json();
            if (resData.success) {
                setUser(resData.user); // อัปเดตข้อมูลผู้ใช้ในระบบ Zustand Store ล่าสุดเพื่อให้แผง Guard สลายตัวออกไป
            }
        } catch (err: unknown) {
            const errMsg =
                err instanceof Error
                    ? err.message
                    : "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์";
            setFormError(errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    if (currentUser && !currentUser.phoneNumber) {
        return (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-surface-muted/60 backdrop-blur-xl p-4 sm:p-6 transition-all">
                <div className="bg-surface w-full max-w-md rounded-2xl border border-border/60 p-6 sm:p-8 shadow-xl flex flex-col justify-between">
                    <div className="text-center space-y-2.5">
                        <div className="w-14 h-14 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto border border-border/40 shadow-xs mb-4">
                            <User size={22} strokeWidth={2.5} />
                        </div>
                        <h1 className="text-lg sm:text-xl font-black text-text-primary tracking-tight">
                            ลงทะเบียนเข้าใช้งานครั้งแรก
                        </h1>
                        <p className="text-xs text-text-secondary leading-relaxed max-w-[92%] mx-auto">
                            กรุณาระบุข้อมูลส่วนบุคคลของท่าน
                            เพื่อใช้ตรวจสอบสิทธิ์และความปลอดภัยในการเข้าถึงฐานข้อมูลคุณภาพน้ำชายฝั่ง
                        </p>
                    </div>

                    <form
                        onSubmit={handleOnboardingSubmit}
                        className="mt-6 space-y-4"
                    >
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-wider block">
                                ชื่อ - นามสกุลจริง
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) =>
                                        setFullName(e.target.value)
                                    }
                                    placeholder="เช่น นายสมชาย ใจดี"
                                    className="w-full pl-11 pr-4 bg-surface-subtle border border-border/80 text-text-primary rounded-xl text-xs placeholder:text-text-muted/40 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none min-h-[46px] font-bold"
                                />
                                <UserPen
                                    size={14}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted opacity-80"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-text-muted uppercase tracking-wider block">
                                เบอร์โทรศัพท์มือถือ (10 หลัก)
                            </label>
                            <div className="relative">
                                <input
                                    type="tel"
                                    maxLength={10}
                                    value={phoneNumber}
                                    onChange={(e) =>
                                        setPhoneNumber(
                                            e.target.value.replace(
                                                /[^0-9]/g,
                                                "",
                                            ),
                                        )
                                    }
                                    placeholder="เช่น 0812345678"
                                    className="w-full pl-11 pr-4 bg-surface-subtle border border-border/80 text-text-primary rounded-xl text-xs placeholder:text-text-muted/40 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none min-h-[46px] font-mono font-bold"
                                />
                                <Phone
                                    size={14}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted opacity-80"
                                />
                            </div>
                        </div>

                        {formError && (
                            <div className="text-[10px] text-red-500 font-extrabold px-1 pt-1 flex items-start gap-2 animate-fade-in leading-normal">
                                <ShieldAlert
                                    size={12}
                                    className="shrink-0 mt-0.5"
                                />
                                <span>{formError}</span>
                            </div>
                        )}

                        <div className="pt-3">
                            <button
                                type="submit"
                                disabled={
                                    submitting ||
                                    !fullName.trim() ||
                                    phoneNumber.length < 10
                                }
                                className="w-full h-11 bg-primary hover:bg-primary/95 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>กำลังลงทะเบียนระบบ...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={13} />
                                        <span>ยืนยันข้อมูลและเข้าใช้งาน</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
