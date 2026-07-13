"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { ShieldAlert, User, Send, ArrowLeft } from "lucide-react";

// โครงสร้างสำหรับเก็บสถานะ Realtime Validation แยกฟิลด์
interface FieldErrors {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
}

export default function LiffProvider({ children }: { children: React.ReactNode }) {
    const [liffLoaded, setLiffLoaded] = useState(false);
    const [liffError, setLiffError] = useState<string | null>(null);
    const currentUser = useAppStore((state) => state.currentUser);
    const setUser = useAppStore((state) => state.setUser);

    // ─── Flow & Onboarding States ───
    const [step, setStep] = useState<1 | 2>(1); // Step 1: Info, Step 2: Select Role
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [selectedRole, setSelectedRole] = useState<string>(""); // เก็บบทบาทที่ต้องการร้องขอ
    const [submitting, setSubmitting] = useState(false);

    // จัดการระบบ Realtime Validation แยกส่วนย่อย
    const [errors, setErrors] = useState<FieldErrors>({});
    const [globalError, setGlobalError] = useState<string | null>(null);

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

    // ─── Realtime Validation Logic (Enterprise Standard) ───
    const validateField = (name: keyof FieldErrors, value: string, currentContext = { firstName, lastName, phoneNumber }) => {
        let errorMsg = "";
        const cleanVal = value.trim();

        const nameRegex = /^[A-Za-z]+$/;
        const nameThaiRegex = /^[ก-์]+$/;

        if (name === "firstName") {
            if (!cleanVal) {
                errorMsg = "กรุณากรอกชื่อจริง";
            } else if (cleanVal.length < 2) {
                errorMsg = "ต้องยาวอย่างน้อย 2 ตัวอักษร";
            } else if (!nameRegex.test(cleanVal) && !nameThaiRegex.test(cleanVal)) {
                errorMsg = "ใช้ได้เฉพาะ ไทย หรือ อังกฤษ ล้วน";
            } else if (nameThaiRegex.test(cleanVal) && /^([ก-ฮ])\1{2,}$/.test(cleanVal)) {
                errorMsg = "รูปแบบตัวอักษรซ้ำไม่ถูกต้อง";
            } else if (nameRegex.test(cleanVal) && (/([A-Za-z])\1{2,}/.test(cleanVal) || /asdf|qwerty|zxcv/i.test(cleanVal))) {
                errorMsg = "รูปแบบอักษรไม่เหมาะสม";
            }
        }

        if (name === "lastName") {
            if (!cleanVal) {
                errorMsg = "กรุณากรอกนามสกุล";
            } else if (cleanVal.length < 2) {
                errorMsg = "ต้องยาวอย่างน้อย 2 ตัวอักษร";
            } else if (!nameRegex.test(cleanVal) && !nameThaiRegex.test(cleanVal)) {
                errorMsg = "ใช้ได้เฉพาะ ไทย หรือ อังกฤษ ล้วน";
            } else if (nameThaiRegex.test(cleanVal) && /^([ก-ฮ])\1{2,}$/.test(cleanVal)) {
                errorMsg = "รูปแบบตัวอักษรซ้ำไม่ถูกต้อง";
            } else if (nameRegex.test(cleanVal) && (/([A-Za-z])\1{2,}/.test(cleanVal) || /asdf|qwerty|zxcv/i.test(cleanVal))) {
                errorMsg = "รูปแบบอักษรไม่เหมาะสม";
            }
        }

        if (name === "phoneNumber") {
            if (!cleanVal) {
                errorMsg = "กรุณากรอกเบอร์โทรศัพท์";
            } else if (!/^[0-9]{10}$/.test(cleanVal)) {
                errorMsg = "ต้องเป็นตัวเลขครบ 10 หลัก";
            } else if (!/^(06|08|09)/.test(cleanVal)) {
                errorMsg = "ต้องขึ้นต้นด้วย 06, 08 หรือ 09";
            } else if (/^(\d)\1{9}$/.test(cleanVal)) {
                errorMsg = "ไม่รองรับเลขซ้ำล้วน";
            } else if ("01234567890987654321".includes(cleanVal)) {
                errorMsg = "ไม่รองรับเลขเรียงกันกระชั้นชิด";
            }
        }

        setErrors((prev) => ({ ...prev, [name]: errorMsg }));
        return !errorMsg;
    };

    // จัดการเมื่อเปลี่ยนหน้า Step 1 -> 2
    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();

        // ทริกเกอร์เช็คซ้ำรอบสุดท้ายก่อนข้ามขั้นตอน
        const isFirstValid = validateField("firstName", firstName);
        const isLastValid = validateField("lastName", lastName);
        const isPhoneValid = validateField("phoneNumber", phoneNumber);

        if (!isFirstValid || !isLastValid || !isPhoneValid) return;

        // เช็คข้ามสายพันธุ์ (ภาษาไทยผสมอังกฤษ)
        const nameThaiRegex = /^[ก-์]+$/;
        const isFirstThai = nameThaiRegex.test(firstName.trim());
        const isLastThai = nameThaiRegex.test(lastName.trim());

        if (firstName.trim() && lastName.trim() && isFirstThai !== isLastThai) {
            setGlobalError("กรุณาใช้ภาษาเดียวกันทั้งชื่อและนามสกุล");
            return;
        }

        setGlobalError(null);
        setStep(2);
    };

    // จัดการเมื่อส่งคำร้องขั้นสุดท้าย
    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        if (!selectedRole) {
            setGlobalError("กรุณาเลือกตำแหน่งระบบที่ท่านต้องการส่งคำร้องขอสิทธิ์");
            return;
        }

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
                setUser(resData.user);
            }
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์";
            setGlobalError(errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    // ช่วยคำนวณปุ่มเปิดปิด
    const isFormInvalid = !firstName.trim() || !lastName.trim() || phoneNumber.length < 10 || !!errors.firstName || !!errors.lastName || !!errors.phoneNumber;

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

    if (currentUser && !currentUser.phoneNumber) {
        return (
            <div className="fixed inset-0 z-2000 flex items-center justify-center p-4 sm:p-6 transition-all">
                <div className="bg-surface w-full max-w-md rounded-2xl border border-border/60 p-6 sm:p-8 inset-shadow-sm shadow-sm flex flex-col justify-between animate-fade-in">
                    {/* STEP 1: หน้าข้อมูลส่วนบุคคลแบบ Realtime Validation */}
                    {step === 1 && (
                        <>
                            <div className="text-center space-y-2.5">
                                <div className="w-14 h-14 text-primary rounded-xl flex items-center justify-center mx-auto border border-border/40 inset-shadow-sm shadow-sm mb-4">
                                    <User size={36} strokeWidth={3} />
                                </div>
                                <h1 className="text-lg sm:text-xl font-black text-primary tracking-tight">ลงทะเบียนเข้าใช้งานครั้งแรก</h1>
                                <p className="text-xs text-black leading-relaxed  mx-auto">กรุณาระบุข้อมูลส่วนบุคคลของท่าน เพื่อใช้ตรวจสอบสิทธิ์และความปลอดภัยในการเข้าถึงฐานข้อมูลคุณภาพน้ำ</p>
                            </div>

                            <form onSubmit={handleNextStep} className="mt-6">
                                {/* ช่องกรอกชื่อจริง */}
                                <div className="space-y-1 pb-1">
                                    <label htmlFor="firstName" className="text-xs font-semibold text-primary block">
                                        ชื่อจริง{" "}
                                        <span className="text-red-500" aria-hidden="true">
                                            *
                                        </span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="firstName"
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => {
                                                setFirstName(e.target.value);
                                                validateField("firstName", e.target.value);
                                            }}
                                            placeholder="กรอกชื่อ"
                                            required
                                            aria-invalid={!!errors.firstName}
                                            aria-describedby={errors.firstName ? "firstName-error" : undefined}
                                            className="w-full h-9 pl-3 pr-4 border border-border text-black rounded-md text-xs placeholder:text-text-muted/40 font-semibold"
                                        />
                                    </div>
                                    {/* จองพื้นที่ฟิกซ์ความสูงถาวรเพื่อป้องกันกล่องขยับตัวเด้งขึ้นเด้งลง */}
                                    <div className="h-4 flex items-center">
                                        {errors.firstName && (
                                            <p id="firstName" role="alert" className="text-xs text-red-500 flex items-center gap-1">
                                                {errors.firstName}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1 pb-1">
                                    <label htmlFor="lastName" className="text-xs font-semibold text-primary block">
                                        นามสกุล{" "}
                                        <span className="text-red-500" aria-hidden="true">
                                            *
                                        </span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="lastName"
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => {
                                                setLastName(e.target.value);
                                                validateField("lastName", e.target.value);
                                            }}
                                            placeholder="กรอกนามสกุล"
                                            required
                                            aria-invalid={!!errors.lastName}
                                            aria-describedby={errors.lastName ? "lastName-error" : undefined}
                                            className="w-full h-9 pl-3 pr-4 border border-border text-black rounded-md text-xs placeholder:text-text-muted/40 font-semibold"
                                        />
                                    </div>
                                    <div className="h-4 flex items-center">
                                        {errors.lastName && (
                                            <p id="lastName" role="alert" className="text-xs text-red-500 flex items-center gap-1">
                                                {errors.lastName}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* ช่องกรอกเบอร์โทรศัพท์ */}
                                <div className="space-y-1">
                                    <label htmlFor="phoneNumber" className="text-xs font-semibold text-primary block">
                                        <div>
                                            เบอร์โทรศัพท์มือถือ{" "}
                                            <span className="text-red-500" aria-hidden="true">
                                                *
                                            </span>
                                        </div>
                                    </label>
                                    <div className="relative">
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
                                            aria-invalid={!!errors.phoneNumber}
                                            aria-describedby={errors.phoneNumber ? "phoneNumber-error" : undefined}
                                            className="w-full h-9 pl-3 pr-4 border border-border text-black rounded-md text-xs placeholder:text-text-muted/40 font-semibold"
                                        />
                                    </div>
                                    <div className="h-4 flex items-center">
                                        {errors.phoneNumber && (
                                            <p id="phoneNumber" role="alert" className="text-xs text-red-500 flex items-center gap-1">
                                                {errors.phoneNumber}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* จองบล็อกสำหรับความปลอดภัยภายนอก (Global Error เช่น ชื่อผสมสองภาษา) */}
                                <div className="h-5 flex items-center justify-center">
                                    {globalError && (
                                        <div role="alert" className="text-xs text-red-500 flex items-center">
                                            <span>{globalError}</span>
                                        </div>
                                    )}
                                </div>

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

                    {/* STEP 2: หน้าเลือก ROLE คำร้องขอเข้าระบบ */}
                    {step === 2 && (
                        <>
                            <form onSubmit={handleFinalSubmit} className="mt-6 space-y-4">
                                <div className="space-y-2.5">
                                    <h1 className="text-lg sm:text-xl font-black text-primary tracking-tight">เลือกตำแหน่งที่ต้องการขอสิทธิ์</h1>
                                    <p className="text-xs text-black">โปรดเลือกสิทธิ์ที่ท่านต้องการใช้งานในระบบ คำร้องขอนี้จะได้รับการตรวจสอบและอนุมัติโดยเจ้าหน้าที่ดูแลระบบ</p>

                                    <div className="space-y-3 mt-2">
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

                                <div className="h-5 flex items-center justify-center">
                                    {globalError && (
                                        <div role="alert" className="text-xs text-red-500 font-extrabold flex items-center gap-2">
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
                                        className="w-full h-11 bg-[#EFF7F9] hover:bg-[#DFF0F0] text-primary font-semibold rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                                    >
                                        <ArrowLeft size={14} /> ย้อนกลับ
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting || !selectedRole}
                                        className="w-full h-11 bg-primary hover:bg-[#054E62] text-white font-semibold rounded-xl text-xs uppercase tracking-widest transition-all disabled:bg-[#C8D8DE] disabled:text-[#8CAAB3] disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer"
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

    return <>{children}</>;
}
