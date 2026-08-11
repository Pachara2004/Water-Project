"use client";

import { useState } from "react";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { MapPin, Users, Phone, Check, AlertCircle, User, ClipboardCheck, Pencil } from "lucide-react";
import Popup from "@/components/Popup";

// countKey เชื่อมกับผลลัพธ์ /api/manage/pending-count เพื่อบอกว่าเมนูไหนมีคำร้องค้างอยู่
export const adminMenus = [
    {
        href: "/manage/review-requests",
        icon: ClipboardCheck,
        label: "ตรวจสอบข้อมูลรอการยืนยัน",
        description: "ตรวจสอบผลการวิเคราะห์จากระบบที่จำเป็นต้องให้เจ้าหน้าที่ยืนยันซ้ำ",
        badge: "Review",
        color: "bg-primary text-primary border-primary/10",
        iconBg: "bg-primary text-white",
        available: true,
        countKey: "reviewPendingCount" as const,
    },
    {
        href: "/manage/locations",
        icon: MapPin,
        label: "จัดการจุดตรวจวัดน้ำ",
        description: "เพิ่ม แก้ไข หรือลบพิกัดจุดเก็บตัวอย่างน้ำบนแผนที่",
        badge: "Locations",
        color: "bg-primary text-primary border-primary/10",
        iconBg: "bg-primary text-white",
        available: true,
        countKey: null,
    },
    {
        href: "/manage/users",
        icon: Users,
        label: "จัดการบัญชีผู้ใช้งาน",
        description: "จัดการข้อมูลผู้ใช้งานและกำหนดสิทธิ์การเข้าถึงระบบ",
        badge: "Users",
        color: "bg-primary text-primary border-primary/10",
        iconBg: "bg-primary text-white",
        available: true,
        countKey: "rolePendingCount" as const,
    },
];

// แมปป้ายกำกับและสไตล์สีตามกลุ่มสิทธิ์ระบบพิมพ์เล็กชุดล่าสุดของ
export const ROLE_LABEL: Record<string, string> = {
    collector: "ผู้เก็บตัวอย่างน้ำ",
    officer: "ผู้บริหาร",
    admin: "ผู้ดูแลระบบ",
    guest: "ผู้ใช้งานทั่วไป",
};

// ชื่อ-นามสกุลรับได้เฉพาะไทยล้วนหรืออังกฤษล้วน (กฎเดียวกับหน้าลงทะเบียนใน LiffProvider)
const NAME_LATIN_RE = /^[A-Za-z]+$/;
const NAME_THAI_RE = /^[ก-์]+$/;

// ตรวจชื่อจริง/นามสกุลทีละช่อง; label ใช้เติมในข้อความเมื่อเว้นว่าง
export function validateNameField(v: string, label: string): string {
    const s = v.trim();
    if (!s) return `กรุณากรอก${label}`;
    if (s.length < 2) return "ต้องยาวอย่างน้อย 2 ตัวอักษร";
    if (!NAME_LATIN_RE.test(s) && !NAME_THAI_RE.test(s)) return "ใช้ได้เฉพาะ ไทย หรือ อังกฤษ ล้วน";
    if (NAME_THAI_RE.test(s) && /^([ก-ฮ])\1{2,}$/.test(s)) return "รูปแบบตัวอักษรซ้ำไม่ถูกต้อง";
    if (NAME_LATIN_RE.test(s) && (/([A-Za-z])\1{2,}/.test(s) || /asdf|qwerty|zxcv/i.test(s))) return "รูปแบบอักษรไม่เหมาะสม";
    return "";
}

// เบอร์มือถือไทย 10 หลัก ขึ้นต้น 06/08/09 กันเลขซ้ำล้วนและเลขเรียงติดกัน
export function validatePhoneField(v: string): string {
    const s = v.trim();
    if (!s) return "กรุณากรอกเบอร์โทรศัพท์";
    if (!/^[0-9]{10}$/.test(s)) return "ต้องเป็นตัวเลขครบ 10 หลัก";
    if (!/^(06|08|09)/.test(s)) return "ต้องขึ้นต้นด้วย 06, 08 หรือ 09";
    if (/^(\d)\1{9}$/.test(s)) return "ไม่รองรับเลขซ้ำล้วน";
    if ("01234567890987654321".includes(s)) return "ไม่รองรับเลขเรียงกันกระชั้นชิด";
    return "";
}

// true เมื่อชื่อเป็นภาษาไทย ใช้เทียบว่าชื่อกับนามสกุลเป็นภาษาเดียวกัน
const isThaiName = (v: string) => NAME_THAI_RE.test(v.trim());

export function MenuBoxDisable(status: boolean) {
    return !status;
}

export function EditProfileDrawer({ onClose, showToast }: { onClose: () => void; showToast: (message: string, variant?: "success" | "danger") => void }) {
    const { currentUser, setUser } = useAppStore();

    const [firstName, setFirstName] = useState(currentUser?.firstName ?? "");
    const [lastName, setLastName] = useState(currentUser?.lastName ?? "");
    const [phone, setPhone] = useState(currentUser?.phoneNumber ?? "");

    // 🟢 บันทึกสถานะการแตะ/โฟกัสช่อง เพื่อไม่ให้โชว์สีแดงเตือนก่อนที่ผู้ใช้จะเริ่มกรอก
    const [touched, setTouched] = useState<{ firstName?: boolean; lastName?: boolean; phone?: boolean }>({});
    const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; phone?: string }>({});
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const validateField = (name: keyof typeof errors, value: string) => {
        let errorMsg = "";
        const cleanVal = value.trim();

        if (name === "firstName") {
            errorMsg = validateNameField(cleanVal, "ชื่อจริง");
        } else if (name === "lastName") {
            errorMsg = validateNameField(cleanVal, "นามสกุล");
        } else if (name === "phone") {
            errorMsg = validatePhoneField(cleanVal);
        }

        setErrors((prev) => ({ ...prev, [name]: errorMsg }));
        return !errorMsg;
    };

    const handleBlur = (field: keyof typeof touched, value: string) => {
        setTouched((prev) => ({ ...prev, [field]: true }));
        validateField(field, value);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        // สั่งเปิด touched ทุกช่องเมื่อกดบันทึก
        setTouched({ firstName: true, lastName: true, phone: true });

        const isFirstValid = validateField("firstName", firstName);
        const isLastValid = validateField("lastName", lastName);
        const isPhoneValid = validateField("phone", phone);

        if (!isFirstValid || !isLastValid || !isPhoneValid) return;

        if (firstName.trim() && lastName.trim() && isThaiName(firstName) !== isThaiName(lastName)) {
            setGlobalError("กรุณาใช้ภาษาเดียวกันทั้งชื่อและนามสกุล");
            return;
        }

        setSaving(true);
        setGlobalError(null);

        try {
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    phoneNumber: phone.trim().replace(/[-\s]/g, ""),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setGlobalError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            if (data.success) {
                setUser(data.user);
            }
            showToast("บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว", "success");
            onClose();
        } catch {
            setGlobalError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่");
        } finally {
            setSaving(false);
        }
    };

    const isDirty =
        firstName.trim() !== (currentUser?.firstName ?? "") || lastName.trim() !== (currentUser?.lastName ?? "") || (phone.trim().replace(/[-\s]/g, "") || null) !== (currentUser?.phoneNumber ?? null);

    const isFormInvalid = !firstName.trim() || !lastName.trim() || phone.length < 10 || !!errors.firstName || !!errors.lastName || !!errors.phone || !isDirty;

    return (
        <Popup title="" onClose={onClose}>
            <div className="animate-fade-in space-y-1">
                <div className="text-center space-y-1 pb-1">
                    <div className="w-10 h-10 text-primary flex items-center justify-center mx-auto">
                        <User size={38} strokeWidth={2} />
                    </div>
                    <h1 className="text-base sm:text-lg font-black text-primary tracking-tight">แก้ไขข้อมูลส่วนตัว</h1>
                </div>

                <form onSubmit={handleSave} className="mt-2 space-y-1 px-1">
                    {/* 1. ช่องกรอกชื่อจริง */}
                    <div className="space-y-1 pb-1">
                        <div className="flex items-center justify-between">
                            <label htmlFor="firstName" className="text-xs font-semibold text-primary block">
                                ชื่อจริง{" "}
                                <span className="text-text-danger" aria-hidden="true">
                                    *
                                </span>
                            </label>
                            <span className={`text-xs font-semibold transition-colors ${firstName.length >= 50 ? "text-text-danger" : "text-text-muted"}`}>{firstName.length}/50</span>
                        </div>
                        <div className="relative py-0.5">
                            <input
                                id="firstName"
                                type="text"
                                maxLength={50}
                                value={firstName}
                                onChange={(e) => {
                                    setFirstName(e.target.value);
                                    if (touched.firstName) validateField("firstName", e.target.value);
                                }}
                                onBlur={(e) => handleBlur("firstName", e.target.value)}
                                placeholder="กรอกชื่อ"
                                required
                                aria-invalid={!!(touched.firstName && errors.firstName)}
                                className={`w-full h-9 pl-3.5 pr-4 border text-text rounded-md text-xs placeholder:text-text-muted/40 font-semibold outline-hidden transition-all ${
                                    touched.firstName && errors.firstName ? "border-text-danger focus:border-text-danger" : "border-border focus:border-primary focus:ring-1 focus:ring-primary/30"
                                }`}
                            />
                        </div>
                        <div className="min-h-4 flex items-center">
                            {touched.firstName && errors.firstName && (
                                <p role="alert" className="text-xs text-text-danger flex items-center gap-1">
                                    <AlertCircle size={11} /> {errors.firstName}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 2. ช่องกรอกนามสกุล */}
                    <div className="space-y-1 pb-1">
                        <div className="flex items-center justify-between">
                            <label htmlFor="lastName" className="text-xs font-semibold text-primary block">
                                นามสกุล{" "}
                                <span className="text-text-danger" aria-hidden="true">
                                    *
                                </span>
                            </label>
                            <span className={`text-xs font-semibold transition-colors ${lastName.length >= 50 ? "text-text-danger" : "text-text-muted"}`}>{lastName.length}/50</span>
                        </div>
                        <div className="relative py-0.5">
                            <input
                                id="lastName"
                                type="text"
                                maxLength={50}
                                value={lastName}
                                onChange={(e) => {
                                    setLastName(e.target.value);
                                    if (touched.lastName) validateField("lastName", e.target.value);
                                }}
                                onBlur={(e) => handleBlur("lastName", e.target.value)}
                                placeholder="กรอกนามสกุล"
                                required
                                aria-invalid={!!(touched.lastName && errors.lastName)}
                                className={`w-full h-9 pl-3.5 pr-4 border text-text rounded-md text-xs placeholder:text-text-muted/40 font-semibold outline-hidden transition-all ${
                                    touched.lastName && errors.lastName ? "border-text-danger focus:border-text-danger" : "border-border focus:border-primary focus:ring-1 focus:ring-primary/30"
                                }`}
                            />
                        </div>
                        <div className="min-h-4 flex items-center">
                            {touched.lastName && errors.lastName && (
                                <p role="alert" className="text-xs text-text-danger flex items-center gap-1">
                                    <AlertCircle size={11} /> {errors.lastName}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 3. ช่องกรอกเบอร์โทรศัพท์ */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <label htmlFor="phoneNumber" className="text-xs font-semibold text-primary block">
                                เบอร์โทรศัพท์มือถือ{" "}
                                <span className="text-text-danger" aria-hidden="true">
                                    *
                                </span>
                            </label>
                            <span className={`text-xs font-semibold transition-colors ${phone.length >= 10 ? "text-text-danger" : "text-text-muted"}`}>{phone.length}/10</span>
                        </div>
                        <div className="relative py-0.5">
                            <input
                                id="phoneNumber"
                                type="tel"
                                maxLength={10}
                                value={phone}
                                onChange={(e) => {
                                    const numericVal = e.target.value.replace(/[^0-9]/g, "");
                                    setPhone(numericVal);
                                    if (touched.phone) validateField("phone", numericVal);
                                }}
                                onBlur={(e) => handleBlur("phone", e.target.value)}
                                placeholder="0XXXXXXXXX"
                                required
                                aria-invalid={!!(touched.phone && errors.phone)}
                                className={`w-full h-9 pl-3.5 pr-4 border text-text rounded-md text-xs placeholder:text-text-muted/40 font-semibold outline-hidden transition-all ${
                                    touched.phone && errors.phone ? "border-text-danger focus:border-text-danger" : "border-border focus:border-primary focus:ring-1 focus:ring-primary/30"
                                }`}
                            />
                        </div>
                        <div className="min-h-4 flex items-center">
                            {touched.phone && errors.phone && (
                                <p role="alert" className="text-xs text-text-danger flex items-center gap-1">
                                    <AlertCircle size={11} /> {errors.phone}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* แสดง Global Error */}
                    <div className="h-5 flex items-center justify-center">
                        {globalError && (
                            <div role="alert" className="text-xs text-text-danger flex items-center gap-1">
                                <AlertCircle size={12} />
                                <span>{globalError}</span>
                            </div>
                        )}
                    </div>

                    {/* ปุ่มกดบันทึกข้อมูล */}
                    <div className="pt-2 justify-center flex">
                        <button
                            type="submit"
                            disabled={saving || isFormInvalid}
                            className="w-full h-11 bg-primary hover:bg-[#054E62] text-white font-black rounded-xl text-xs transition-all disabled:bg-[#C8D8DE] disabled:text-[#8CAAB3] disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>กำลังบันทึก...</span>
                                </>
                            ) : (
                                <>
                                    <Check size={14} />
                                    <span>บันทึกข้อมูลส่วนตัว</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </Popup>
    );
}

export function ProfileCard({ onEdit }: { onEdit: () => void }) {
    const { currentUser } = useAppStore();
    if (!currentUser) return null;

    const role = currentUser.role;
    const roleLabel = ROLE_LABEL[role] ?? role;
    const userDisplayName = currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ""}`.trim() : currentUser.lineProfileName;

    return (
        <div className="bg-card-general rounded-2xl border border-border p-4">
            <div className="flex flex-col gap-1">
                <div className="flex justify-between items-start gap-4 p-2 pb-0">
                    <h2 className="text-xl font-semibold text-text-primary truncate flex-1">{userDisplayName}</h2>

                    <button
                        onClick={onEdit}
                        className="w-26 gap-1 h-9 text-sm shrink-0 flex items-center justify-center rounded-md bg-surface-subtle border border-border text-text-muted transition-all duration-75 cursor-pointer hover:bg-surface-hover active:scale-[0.97]"
                        title="แก้ไขข้อมูลส่วนตัว"
                    >
                        <Pencil size={16} /> แก้ไขข้อมูล
                    </button>
                </div>

                <div className="p-2 pt-0">
                    {currentUser.phoneNumber ? (
                        <p className="flex items-center gap-1.5 mt-[-10] text-sm text-text-muted">{currentUser.phoneNumber}</p>
                    ) : (
                        <p className="mt-1 text-sm text-text-muted/50 italic">ยังไม่ได้ระบุเบอร์โทร</p>
                    )}
                    <div>
                        <span className="inline-flex items-center text-sm font-semibold text-text-secondary">ตำแหน่ง: {roleLabel}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
