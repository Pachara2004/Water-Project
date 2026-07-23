"use client";

import { useState } from "react";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { MapPin, Users, Phone, X, Check, AlertCircle, User, ClipboardCheck, Pencil } from "lucide-react";

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
    const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; phone?: string }>({});
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState("");

    const validate = () => {
        const e: typeof errors = {};
        const fe = validateNameField(firstName, "ชื่อจริง");
        const le = validateNameField(lastName, "นามสกุล");
        const pe = validatePhoneField(phone);
        if (fe) e.firstName = fe;
        if (le) e.lastName = le;
        if (pe) e.phone = pe;

        // ชื่อและนามสกุลต้องเป็นภาษาเดียวกัน (เช็คเฉพาะเมื่อสองช่องผ่านกฎรายช่องแล้ว)
        if (!fe && !le && isThaiName(firstName) !== isThaiName(lastName)) {
            e.lastName = "กรุณาใช้ภาษาเดียวกันทั้งชื่อและนามสกุล";
        }

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = async () => {
        if (!validate() || !currentUser) return;

        setSaving(true);
        setServerError("");
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
                setServerError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            if (data.success) {
                setUser(data.user);
            }
            showToast("บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว", "success");
            onClose();
        } catch {
            setServerError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่");
        } finally {
            setSaving(false);
        }
    };

    const isDirty =
        firstName.trim() !== (currentUser?.firstName ?? "") ||
        lastName.trim() !== (currentUser?.lastName ?? "") ||
        (phone.trim().replace(/[-\s]/g, "") || null) !== (currentUser?.phoneNumber ?? null);

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/40 z-800 backdrop-blur-xs transition-opacity" onClick={onClose} />

            {/* Drawer */}
            <div
                className="fixed bottom-0 left-0 right-0 z-801 bg-surface rounded-t-4xl  border-t border-border max-w-lg mx-auto px-6 pt-6 animate-slide-up transition-colors duration-300"
                style={{
                    paddingBottom: "calc(88px + env(safe-area-inset-bottom))",
                }}
            >
                <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

                <div className="flex items-center justify-between mb-7">
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">แก้ไขข้อมูลส่วนตัว</h3>
                    <button
                        title="button"
                        onClick={onClose}
                        className="w-8 h-8 bg-surface-subtle border border-border rounded-full flex items-center justify-center hover:bg-surface-muted transition-colors active:scale-[0.92] cursor-pointer"
                    >
                        <X size={14} className="text-text-secondary" />
                    </button>
                </div>

                <div className="space-y-5">
                    {/* First name field */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                            <User size={10} /> ชื่อจริง <span className="text-danger">*</span>
                        </label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => {
                                setFirstName(e.target.value);
                                if (errors.firstName) setErrors((p) => ({ ...p, firstName: "" }));
                            }}
                            placeholder="กรอกชื่อ"
                            maxLength={50}
                            className={`w-full px-4 py-3.5 bg-surface-subtle border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:ring-2 outline-none transition-all min-h-[48px] font-semibold
                ${errors.firstName ? "border-danger focus:border-danger focus:ring-danger/20" : "border-border focus:border-primary focus:ring-primary/20"}`}
                        />
                        {errors.firstName && (
                            <p className="flex items-center gap-1.5 text-xs text-danger font-semibold animate-fade-in">
                                <AlertCircle size={11} />
                                {errors.firstName}
                            </p>
                        )}
                    </div>

                    {/* Last name field */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                            <User size={10} /> นามสกุล <span className="text-danger">*</span>
                        </label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => {
                                setLastName(e.target.value);
                                if (errors.lastName) setErrors((p) => ({ ...p, lastName: "" }));
                            }}
                            placeholder="กรอกนามสกุล"
                            maxLength={50}
                            className={`w-full px-4 py-3.5 bg-surface-subtle border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:ring-2 outline-none transition-all min-h-[48px] font-semibold
                ${errors.lastName ? "border-danger focus:border-danger focus:ring-danger/20" : "border-border focus:border-primary focus:ring-primary/20"}`}
                        />
                        {errors.lastName && (
                            <p className="flex items-center gap-1.5 text-xs text-danger font-semibold animate-fade-in">
                                <AlertCircle size={11} />
                                {errors.lastName}
                            </p>
                        )}
                    </div>

                    {/* Phone field */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                            <Phone size={10} /> เบอร์โทรศัพท์มือถือ <span className="text-danger">*</span>
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => {
                                setPhone(e.target.value.replace(/[^0-9]/g, ""));
                                if (errors.phone) setErrors((p) => ({ ...p, phone: "" }));
                            }}
                            placeholder="0XXXXXXXXX"
                            maxLength={10}
                            className={`w-full px-4 py-3.5 bg-surface-subtle border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:ring-2 outline-none transition-all min-h-[48px] font-mono font-semibold
                ${errors.phone ? "border-danger focus:border-danger focus:ring-danger/20" : "border-border focus:border-primary focus:ring-primary/20"}`}
                        />
                        {errors.phone && (
                            <p className="flex items-center gap-1.5 text-xs text-danger font-semibold animate-fade-in">
                                <AlertCircle size={11} />
                                {errors.phone}
                            </p>
                        )}
                    </div>

                    {serverError && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-danger/10 border border-danger/20 rounded-2xl animate-fade-in">
                            <AlertCircle size={14} className="text-danger shrink-0" />
                            <p className="text-xs text-danger font-semibold">{serverError}</p>
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving || !isDirty}
                        className="w-full mt-2 py-4 min-h-13 bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98]"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <Check size={14} /> บันทึกข้อมูลส่วนตัว
                            </>
                        )}
                    </button>
                </div>
            </div>
        </>
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
