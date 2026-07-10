"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { Phone, UserPen, ShieldAlert, User, Send, ArrowLeft } from "lucide-react";

export default function LiffProvider({ children }: { children: React.ReactNode }) {
    const [liffLoaded, setLiffLoaded] = useState(false);
    const [liffError, setLiffError] = useState<string | null>(null);
    const currentUser = useAppStore((state) => state.currentUser);
    const setUser = useAppStore((state) => state.setUser);

    // ─── Flow & Onboarding States ───
    const [step, setStep] = useState<1 | 2>(1); // Step 1: Info, Step 2: Select Role
    const [fullName, setFullName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [selectedRole, setSelectedRole] = useState<string>(""); // เก็บบทบาทที่ต้องการร้องขอ
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        // ─── ท่อนพัฒนา/MOCK SYSTEM ───
        if (!liffId) {
            console.warn("NEXT_PUBLIC_LIFF_ID is not set. Authenticating mock user...");
            fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lineUid: "U_ADMIN_MOCK",
                    name: "Mock Admin",
                }),
            })
                .then((res) => res.json())
                .then((resData) => {
                    setUser({
                        ...resData,
                        role: "guest", // ตั้งเป็น guest เพื่อให้ทดสอบแผง Onboarding เสมอ
                        phoneNumber: null,
                    });
                    setLiffLoaded(true);
                })
                .catch((err) => {
                    console.error("Failed to mock authenticate:", err);
                    setLiffError("ไม่สามารถจำลองการยืนยันตัวตนกับฐานข้อมูลได้");
                    setLiffLoaded(true);
                });
            return;
        }

        // ─── ท่อนเชื่อมต่อ LINE LIFF PRODUCTION ───
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
                        accessToken: liff.getAccessToken(),
                        name: profile.displayName,
                    }),
                });

                if (!response.ok) throw new Error("Failed to authenticate with backend");

                const resData = await response.json();
                setUser(resData);
                setLiffLoaded(true);
            })
            .catch((err) => {
                console.error("LIFF init error", err);
                setLiffError(err.message || "Failed to initialize LIFF");
                setLiffLoaded(true);
            });
    }, [setUser]);

    // จัดการเมื่อกดปุ่มหน้าแรก: ตรวจสอบความถูกต้องเฉย ๆ แล้วเปลี่ยนหน้า (ยังไม่ยิง API)
    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = fullName.trim();
        if (!trimmedName) {
            setFormError("กรุณากรอกชื่อ-นามสกุลจริงของคุณ");
            return;
        }
        if (!/^[0-9]{10}$/.test(phoneNumber)) {
            setFormError("กรุณากรอกเบอร์โทรศัพท์มือถือให้ครบ 10 หลัก");
            return;
        }
        setFormError(null);
        setStep(2); // ย้ายไปหน้าเลือก Role ทันที
    };

    // จัดการเมื่อกดปุ่มส่งในหน้าเลือก Role: ยิง API ม้วนเดียวจบ
    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        if (!selectedRole) {
            setFormError("กรุณาเลือกตำแหน่งระบบที่ท่านต้องการส่งคำร้องขอสิทธิ์");
            return;
        }

        const nameParts = fullName.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || "";

        setSubmitting(true);
        setFormError(null);

        try {
            // บรรทัดที่ 117 ที่เกิดปัญหา
            const res = await fetch("/api/auth/onboarding", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    phoneNumber,
                    requestedRoleName: selectedRole,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
            }

            const resData = await res.json();
            if (resData.success) {
                setUser(resData.user);
            }
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์";
            setFormError(errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    if (!liffLoaded) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-surface-muted">
                <div className="flex flex-col items-center">
                    <div className="h-9 w-9 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <p className="mt-4 text-primary font-semibold text-md uppercase tracking-widest animate-pulse">
                        กำลังเชื่อมต่อ<span className="text-green-500">ระบบ</span>
                    </p>
                </div>
            </div>
        );
    }

    if (liffError) {
        return (
            <div className="flex h-screen w-full items-center justify-center p-4 bg-surface-muted">
                <div className="rounded-2xl bg-surface border border-border/60 p-6 text-center shadow-lg max-w-sm w-full">
                    <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="font-black text-text-primary text-sm">เกิดข้อผิดพลาดในการโหลดระบบ</p>
                    <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">{liffError}</p>
                </div>
            </div>
        );
    }

    // แผง Onboarding Guard ดักจับบังคับทำรายการ
    if (currentUser && !currentUser.phoneNumber) {
        return (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6 transition-all">
                <div className="bg-surface w-full max-w-md rounded-2xl border border-border/60 p-6 sm:p-8 inset-shadow-sm shadow-sm flex flex-col justify-between animate-fade-in">
                    {/* STEP 1: หน้าฟอร์มข้อมูลส่วนบุคคลตามรูปภาพต้นฉบับ */}
                    {step === 1 && (
                        <>
                            <div className="text-center space-y-2.5">
                                <div className="w-14 h-14  text-primary rounded-xl flex items-center justify-center mx-auto border border-border/40 inset-shadow-sm shadow-sm mb-4">
                                    <User size={36} strokeWidth={3} />
                                </div>
                                <h1 className="text-lg sm:text-xl font-black text-primary tracking-tight">ลงทะเบียนเข้าใช้งานครั้งแรก</h1>
                                <p className="text-xs text-text-primary leading-relaxed max-w-[92%] mx-auto">
                                    กรุณาระบุข้อมูลส่วนบุคคลของท่าน เพื่อใช้ตรวจสอบสิทธิ์และความปลอดภัยในการเข้าถึงฐานข้อมูลคุณภาพน้ำชายฝั่ง
                                </p>
                            </div>

                            <form onSubmit={handleNextStep} className="mt-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-navy-light uppercase tracking-wider block">ชื่อ - นามสกุลจริง</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="เช่น นายสมชาย ใจดี"
                                            className="w-full pl-11 pr-4 border border-border text-text-primary rounded-md text-xs placeholder:text-text-muted/40 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none min-h-[46px] font-semibold"
                                        />
                                        <UserPen size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted opacity-80" />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-semibold text-navy-light uppercase tracking-wider block">เบอร์โทรศัพท์มือถือ</label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            maxLength={10}
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ""))}
                                            placeholder="เช่น 0812345678"
                                            className="w-full pl-11 pr-4 border border-border text-text-primary rounded-md text-xs placeholder:text-text-muted/40 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none min-h-[46px] font-mono font-semibold"
                                        />
                                        <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted opacity-80" />
                                    </div>
                                </div>

                                {formError && (
                                    <div className="text-[10px] text-red-500 font-extrabold px-1 pt-1 flex items-start gap-2 leading-normal">
                                        <ShieldAlert size={12} className="shrink-0 mt-0.5" />
                                        <span>{formError}</span>
                                    </div>
                                )}

                                <div className="pt-3 justify-center flex">
                                    <button
                                        type="submit"
                                        disabled={!fullName.trim() || phoneNumber.length < 10}
                                        className="w-70 h-11 bg-primary hover:bg-[#054E62] text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all disabled:bg-[#C8D8DE] disabled:text-[#8CAAB3] disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                                    >
                                        <span>ดำเนินการต่อ</span>
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* STEP 2: หน้าเลือก ROLE ที่ต้องการร้องขอสิทธิ์เพิ่มเข้ามาใหม่ */}
                    {step === 2 && (
                        <>
                            <form onSubmit={handleFinalSubmit} className="mt-6 space-y-4">
                                <div className="space-y-2.5">
                                    <h1 className="text-lg sm:text-xl font-black text-primary tracking-tight">เลือกตำแหน่งที่ต้องการขอสิทธิ์</h1>
                                    <p className="text-xs text-black">โปรดเลือกสิทธิ์ที่ท่านต้องการใช้งานในระบบ คำร้องขอนี้จะได้รับการตรวจสอบและอนุมัติโดยเจ้าหน้าที่ดูแลระบบ</p>
                                    <div className="space-y-3 mt-2">
                                        {/* บล็อกเลือกสิทธิ์: เจ้าหน้าที่ภาคสนาม (Collector) */}
                                        <div
                                            onClick={() => setSelectedRole("collector")}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                                selectedRole === "collector" ? "bg-secondary/5 border-secondary shadow-xs" : " border-border/80 hover:border-border-hover"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${selectedRole === "collector" ? "border-primary" : "border-text-muted"}`}
                                                >
                                                    {selectedRole === "collector" && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-text-primary">เจ้าหน้าที่ภาคสนาม (Collector)</p>
                                                    <p className="text-[11px] text-text-secondary mt-0.5 leading-normal">
                                                        สิทธิ์สำหรับผู้จัดเก็บข้อมูล, ตรวจวัดค่าสารเคมี และทำการอัปโหลดผลน้ำเข้าสู่ฐานข้อมูล
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* บล็อกเลือกสิทธิ์: เจ้าหน้าที่บริหาร/สารสนเทศ (Officer) */}
                                        <div
                                            onClick={() => setSelectedRole("officer")}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                                selectedRole === "officer" ? "bg-secondary/5 border-secondary shadow-xs" : " border-border/80 hover:border-border-hover"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${selectedRole === "officer" ? "border-primary" : "border-text-muted"}`}
                                                >
                                                    {selectedRole === "officer" && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-text-primary">เจ้าหน้าที่สารสนเทศ/บริหาร (Officer)</p>
                                                    <p className="text-[11px] text-text-secondary mt-0.5 leading-normal">
                                                        สิทธิ์สำหรับผู้อ่านรายงานวิเคราะห์เชิงลึก สรุปสถิติมลพิษทางน้ำ และดูแดชบอร์ดความปลอดภัยของคุณภาพน้ำ
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {formError && (
                                    <div className="text-[10px] text-red-500 font-extrabold px-1 pt-1 flex items-start gap-2 leading-normal">
                                        <ShieldAlert size={12} className="shrink-0 mt-0.5" />
                                        <span>{formError}</span>
                                    </div>
                                )}

                                <div className="pt-3 grid grid-cols-2 gap-3">
                                    <div className="space-y-2.5 ">
                                        <button
                                            onClick={() => {
                                                setStep(1);
                                                setFormError(null);
                                            }}
                                            className="w-full h-11 bg-[#EFF7F9] hover:bg-[#DFF0F0] text-primary font-semibold rounded-xl text-xs uppercase tracking-widest transition-all disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                                        >
                                            <ArrowLeft size={14} /> ย้อนกลับ
                                        </button>
                                    </div>
                                    <div>
                                        <button
                                            type="submit"
                                            disabled={submitting || !selectedRole}
                                            className="w-full h-11 bg-primary hover:bg-[#054E62] text-white font-semibold rounded-xl text-xs uppercase tracking-widest transition-all disabled:bg-[#C8D8DE] disabled:text-[#8CAAB3] disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                                        >
                                            {submitting ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    <span>กำลังบันทึกและส่งคำขอสิทธิ์...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Send size={13} />
                                                    <span>ส่งคำร้องขอเข้าระบบ</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
