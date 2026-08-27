"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { ShieldAlert, User, Send, ArrowLeft } from "lucide-react";
import { useToast } from "./useToast";
import LiffBackground from "@/components/LiffBackground"; // <-- 1. Import พื้นหลังเข้ามา

interface FieldErrors {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
}

export default function LiffProvider({ children }: { children: React.ReactNode }) {
    const { showToast, toastElement } = useToast();
    const [liffLoaded, setLiffLoaded] = useState(false);
    const [liffError, setLiffError] = useState<string | null>(null);
    const currentUser = useAppStore((state) => state.currentUser);
    const setUser = useAppStore((state) => state.setUser);

    const [step, setStep] = useState<1 | 2>(1);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [selectedRole, setSelectedRole] = useState<string>("");
    const [submitting, setSubmitting] = useState(false);

    const [errors, setErrors] = useState<FieldErrors>({});
    const [globalError, setGlobalError] = useState<string | null>(null);

    useEffect(() => {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
            fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lineUid: "U_ADMIN_MOCK",
                    name: "Mock Admin",
                }),
            })
                .then((res) => res.json())
                .then(() => {
                    setUser(null);
                    setLiffLoaded(true);
                })
                .catch((err) => {
                    console.error("Failed to mock authenticate:", err);
                    setLiffError("ไม่สามารถจำลองการยืนยันตัวตนกับฐานข้อมูลได้");
                    setLiffLoaded(true);
                });
            return;
        }

        liff.init({ liffId })
            .then(async () => {
                if (liff.isLoggedIn()) {
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
                    return;
                }

                try {
                    liff.login();
                } catch (loginErr) {
                    console.warn("User cancelled or login failed, proceeding as guest", loginErr);
                    setUser(null);
                    setLiffLoaded(true);
                }
            })
            .catch((err) => {
                console.error("LIFF init error", err);
                setUser(null);
                setLiffLoaded(true);
            })
            .finally(() => {
                const isDark = typeof window !== "undefined" && localStorage.getItem("theme") === "dark";
                useAppStore.getState().setTheme(isDark ? "dark" : "light");
            });
    }, [setUser]);

    const validateField = (name: keyof FieldErrors, value: string) => {
        let errorMsg = "";
        const cleanVal = value.trim();
        const nameRegex = /^[A-Za-z]+$/;
        const nameThaiRegex = /^[ก-์]+$/;

        if (name === "firstName" || name === "lastName") {
            if (!cleanVal) {
                errorMsg = name === "firstName" ? "กรุณากรอกชื่อจริง" : "กรุณากรอกนามสกุล";
            } else if (cleanVal.length < 2) {
                errorMsg = "ต้องยาวอย่างน้อย 2 ตัวอักษร";
            } else if (!nameRegex.test(cleanVal) && !nameThaiRegex.test(cleanVal)) {
                errorMsg = "ใช้ได้เฉพาะ ไทย หรือ อังกฤษ ล้วน";
            }
        }

        if (name === "phoneNumber") {
            if (!cleanVal) {
                errorMsg = "กรุณากรอกเบอร์โทรศัพท์";
            } else if (!/^[0-9]{10}$/.test(cleanVal)) {
                errorMsg = "ต้องเป็นตัวเลขครบ 10 หลัก";
            } else if (!/^(06|08|09)/.test(cleanVal)) {
                errorMsg = "ต้องขึ้นต้นด้วย 06, 08 หรือ 09";
            }
        }

        setErrors((prev) => ({ ...prev, [name]: errorMsg }));
        return !errorMsg;
    };

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateField("firstName", firstName) || !validateField("lastName", lastName) || !validateField("phoneNumber", phoneNumber)) return;

        const nameThaiRegex = /^[ก-์]+$/;
        if (firstName.trim() && lastName.trim() && nameThaiRegex.test(firstName.trim()) !== nameThaiRegex.test(lastName.trim())) {
            setGlobalError("กรุณาใช้ภาษาเดียวกันทั้งชื่อและนามสกุล");
            return;
        }

        setGlobalError(null);
        setStep(2);
    };

    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !selectedRole) return;

        setSubmitting(true);
        setGlobalError(null);

        try {
            const res = await fetch("/api/auth/onboarding", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    phoneNumber: phoneNumber.trim(),
                    requestedRoleName: selectedRole,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
            }

            const resData = await res.json();
            if (resData.success) {
                showToast("ส่งคำร้องขอเข้าระบบเรียบร้อยแล้ว รอการอนุมัติ", "success");
                setUser(resData.user);
            }
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์";
            setGlobalError(errMsg);
            showToast(errMsg, "danger");
        } finally {
            setSubmitting(false);
        }
    };

    const isFormInvalid = !firstName.trim() || !lastName.trim() || phoneNumber.length < 10 || !!errors.firstName || !!errors.lastName || !!errors.phoneNumber;

    // ─── 1. ตอนกำลังโหลด LIFF ───
    if (!liffLoaded) {
        return (
            <div className="relative flex h-screen w-full items-center justify-center bg-bg">
                <LiffBackground />
                <div className="flex flex-col items-center z-10">
                    <div className="h-9 w-9 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <p className="mt-4 text-primary font-semibold text-md uppercase tracking-widest animate-pulse">
                        กำลังเชื่อมต่อ<span className="text-text-safe">ระบบ</span>
                    </p>
                </div>
            </div>
        );
    }

    // ─── 2. ตอนเกิด LIFF Error ───
    if (liffError) {
        return (
            <div className="relative flex h-screen w-full items-center justify-center p-4">
                <LiffBackground />
                <div className="rounded-2xl bg-white/90 backdrop-blur-md border border-border/60 p-6 text-center shadow-lg max-w-sm w-full z-10">
                    <ShieldAlert className="w-12 h-12 text-text-danger mx-auto mb-4" />
                    <p className="font-black text-text-primary text-sm">เกิดข้อผิดพลาดในการโหลดระบบ</p>
                    <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">{liffError}</p>
                </div>
            </div>
        );
    }

    // ─── 3. หน้าลงทะเบียน Onboarding ───
    if (currentUser && !currentUser.phoneNumber) {
        return (
            <div className="fixed inset-0 z-2000 flex items-center justify-center p-4 sm:p-6">
                {/* ใส่พื้นหลัง SVG */}
                <LiffBackground />

                {/* กล่อง Card แบบโปร่งเล็กน้อย (Backdrop blur) เพื่อความโมเดิร์นและตัดกับพื้นหลัง */}
                <div className="bg-card-general w-full max-w-md rounded-2xl border border-border p-6 sm:p-8 shadow-lg flex flex-col justify-between animate-fade-in z-10">
                    {step === 1 && (
                        <>
                            <div className="text-center space-y-2.5">
                                <div className="w-14 h-14 text-primary flex items-center justify-center mx-auto">
                                    <User size={56} strokeWidth={2} />
                                </div>
                                <h1 className="text-lg sm:text-xl font-black text-primary tracking-tight">ลงทะเบียนเข้าใช้งานครั้งแรก</h1>
                                <p className="text-xs text-text leading-relaxed mx-auto">กรุณาระบุข้อมูลส่วนบุคคลของท่าน เพื่อใช้ตรวจสอบสิทธิ์และความปลอดภัยในการเข้าถึงฐานข้อมูลคุณภาพน้ำ</p>
                            </div>

                            <form onSubmit={handleNextStep} className="mt-6">
                                <div className="space-y-1 pb-1">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="firstName" className="text-xs font-semibold text-primary block">
                                            ชื่อจริง <span className="text-text-danger">*</span>
                                        </label>
                                        <span className={`text-xs font-semibold ${firstName.length >= 50 ? "text-text-danger" : "text-text-muted"}`}>{firstName.length}/50</span>
                                    </div>
                                    <input
                                        id="firstName"
                                        type="text"
                                        maxLength={50}
                                        value={firstName}
                                        onChange={(e) => {
                                            setFirstName(e.target.value);
                                            validateField("firstName", e.target.value);
                                        }}
                                        placeholder="กรอกชื่อ"
                                        required
                                        className="w-full h-9 pl-3.5 pr-4 border border-border text-text rounded-md text-xs placeholder:text-text-muted/40 font-semibold bg-white"
                                    />
                                    <div className="h-4 flex items-center">{errors.firstName && <p className="text-xs text-text-danger">{errors.firstName}</p>}</div>
                                </div>

                                <div className="space-y-1 pb-1">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="lastName" className="text-xs font-semibold text-primary block">
                                            นามสกุล <span className="text-text-danger">*</span>
                                        </label>
                                        <span className={`text-xs font-semibold ${lastName.length >= 50 ? "text-text-danger" : "text-text-muted"}`}>{lastName.length}/50</span>
                                    </div>
                                    <input
                                        id="lastName"
                                        type="text"
                                        maxLength={50}
                                        value={lastName}
                                        onChange={(e) => {
                                            setLastName(e.target.value);
                                            validateField("lastName", e.target.value);
                                        }}
                                        placeholder="กรอกนามสกุล"
                                        required
                                        className="w-full h-9 pl-3.5 pr-4 border border-border text-text rounded-md text-xs placeholder:text-text-muted/40 font-semibold bg-white"
                                    />
                                    <div className="h-4 flex items-center">{errors.lastName && <p className="text-xs text-text-danger">{errors.lastName}</p>}</div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="phoneNumber" className="text-xs font-semibold text-primary block">
                                            เบอร์โทรศัพท์มือถือ <span className="text-text-danger">*</span>
                                        </label>
                                        <span className={`text-xs font-semibold ${phoneNumber.length >= 10 ? "text-text-danger" : "text-text-muted"}`}>{phoneNumber.length}/10</span>
                                    </div>
                                    <input
                                        id="phoneNumber"
                                        type="tel"
                                        maxLength={10}
                                        value={phoneNumber}
                                        onChange={(e) => {
                                            const numericVal = e.target.value.replace(/[^0-9]/g, "");
                                            setPhoneNumber(numericVal);
                                            validateField("phoneNumber", numericVal);
                                        }}
                                        placeholder="0XXXXXXXXX"
                                        required
                                        className="w-full h-9 pl-3.5 pr-4 border border-border text-text rounded-md text-xs placeholder:text-text-muted/40 font-semibold bg-white"
                                    />
                                    <div className="h-4 flex items-center">{errors.phoneNumber && <p className="text-xs text-text-danger">{errors.phoneNumber}</p>}</div>
                                </div>

                                <div className="h-5 flex items-center justify-center">{globalError && <span className="text-xs text-text-danger">{globalError}</span>}</div>

                                <div className="pt-2 justify-center flex">
                                    <button
                                        type="submit"
                                        disabled={isFormInvalid}
                                        className="w-70 h-11 bg-primary hover:bg-[#054E62] text-white font-black rounded-xl text-xs transition-all disabled:bg-[#C8D8DE] disabled:text-[#8CAAB3] disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                                    >
                                        <span>ดำเนินการต่อ</span>
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <form onSubmit={handleFinalSubmit} className="mt-6 space-y-4">
                                <div className="space-y-2.5">
                                    <h1 className="text-lg sm:text-xl font-black text-primary tracking-tight">เลือกตำแหน่งที่ต้องการขอสิทธิ์</h1>
                                    <p className="text-xs text-text">โปรดเลือกสิทธิ์ที่ท่านต้องการใช้งานในระบบ คำร้องขอนี้จะได้รับการตรวจสอบและอนุมัติโดยเจ้าหน้าที่ดูแลระบบ</p>

                                    <div className="space-y-3 mt-2">
                                        <div
                                            onClick={() => setSelectedRole("collector")}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all bg-white/70 ${
                                                selectedRole === "collector" ? "bg-secondary/10 border-secondary shadow-xs" : "border-border/80 hover:border-border-hover"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${selectedRole === "collector" ? "border-primary" : "border-text-muted"}`}
                                                >
                                                    {selectedRole === "collector" && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-text">เจ้าหน้าที่ภาคสนาม (Collector)</p>
                                                    <p className="text-xs text-secondary mt-1">สิทธิ์สำหรับผู้จัดเก็บข้อมูล, ตรวจวัดค่าสารเคมี และทำการอัปโหลดผลน้ำเข้าสู่ฐานข้อมูล</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => setSelectedRole("officer")}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all bg-white/70 ${
                                                selectedRole === "officer" ? "bg-secondary/10 border-secondary shadow-xs" : "border-border/80 hover:border-border-hover"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${selectedRole === "officer" ? "border-primary" : "border-text-muted"}`}
                                                >
                                                    {selectedRole === "officer" && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-text">เจ้าหน้าที่ส่วนกลาง (Officer)</p>
                                                    <p className="text-xs text-secondary mt-1">สิทธิ์สำหรับผู้อ่านรายงานวิเคราะห์เชิงลึก สรุปสถิติมลพิษทางน้ำ และดูแดชบอร์ดความปลอดภัยของคุณภาพน้ำ</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-5 flex items-center justify-center">
                                    {globalError && (
                                        <div className="text-xs text-red-500 font-extrabold flex items-center gap-2">
                                            <ShieldAlert size={12} className="shrink-0" />
                                            <span>{globalError}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-3 grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setStep(1);
                                            setGlobalError(null);
                                        }}
                                        className="w-full h-11 bg-[#EFF7F9] hover:bg-[#DFF0F0] text-text font-semibold rounded-xl text-xs tracking-widest transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                                    >
                                        <ArrowLeft size={14} /> ย้อนกลับ
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting || !selectedRole}
                                        className="w-full h-11 bg-primary hover:bg-[#054E62] text-white font-semibold rounded-xl text-xs tracking-widest transition-all disabled:bg-[#C8D8DE] disabled:text-[#8CAAB3] disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                                    >
                                        {submitting ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                <span>กำลังบันทึก...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send size={13} />
                                                <span>ส่งคำร้องขอ</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <>
            {children} {toastElement}
        </>
    );
}
