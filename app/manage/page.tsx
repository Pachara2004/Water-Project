"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { MapPin, ShieldAlert, ChevronRight, Shield, Users, Phone, UserCircle2, Pencil, X, Check, AlertCircle, User } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useToast } from "@/components/useToast";

const adminMenus = [
    {
        href: "/manage/locations",
        icon: MapPin,
        label: "จัดการสถานีตรวจวัด",
        description: "เพิ่ม แก้ไข หรือลบจุดเก็บตัวอย่างน้ำบนแผนที่",
        badge: "Locations",
        color: "bg-primary-light text-primary border-primary/10",
        iconBg: "bg-primary text-white",
        available: true,
    },
    {
        href: "/manage/users",
        icon: Users,
        label: "จัดการผู้ใช้งาน",
        description: "กำหนดสิทธิ์และบทบาทของผู้ใช้ในระบบ",
        badge: "Users",
        color: "bg-primary-light text-primary border-primary/10",
        iconBg: "bg-primary text-white",
        available: true,
    },
];

// แมปป้ายกำกับและสไตล์สีตามกลุ่มสิทธิ์ระบบพิมพ์เล็กชุดล่าสุดของ
const ROLE_LABEL: Record<string, string> = {
    collector: "ผู้เก็บตัวอย่างน้ำ",
    officer: "ผู้บริหาร",
    admin: "ผู้ดูแลระบบ",
    guest: "ผู้ใช้งานทั่วไป",
};

const ROLE_COLOR: Record<string, string> = {
    collector: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-blue-500/20",
    officer: "text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-500/10 dark:border-violet-500/20",
    admin: "text-primary bg-primary-light border-primary/10",
    guest: "text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-500/10 dark:border-gray-500/20",
};

const ROLE_DOT: Record<string, string> = {
    collector: "bg-blue-500",
    officer: "bg-violet-500",
    admin: "bg-primary",
    guest: "bg-gray-400",
};

const NAME_RE = /^[ก-๙a-zA-Z0-9\s\-'.]+$/;
const PHONE_RE = /^(\+66[0-9]{8,9}|0[2-9][0-9]{7,8})$/;

function validateName(v: string): string {
    const s = v.trim().replace(/\s+/g, " ");
    if (!s) return "กรุณากรอกชื่อ-นามสกุลจริง";
    if (s.length < 2) return "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร";
    if (s.length > 100) return "ชื่อต้องไม่เกิน 100 ตัวอักษร";
    if (!NAME_RE.test(s)) return "ชื่อมีอักขระที่ไม่อนุญาต";
    return "";
}

function validatePhone(v: string): string {
    const clean = v.trim().replace(/[-\s]/g, "");
    if (!clean) return "กรุณากรอกเบอร์โทรศัพท์";
    if (!PHONE_RE.test(clean)) return "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (เช่น 0812345678)";
    return "";
}

function getInitials(firstName: string | null, lineName: string) {
    if (firstName && firstName.trim()) {
        return firstName.trim().slice(0, 2).toUpperCase();
    }
    return lineName.trim().slice(0, 2).toUpperCase();
}

function EditProfileDrawer({ onClose, showToast }: { onClose: () => void; showToast: (message: string, variant?: "success" | "danger") => void }) {
    const { currentUser, setUser } = useAppStore();

    // ประกอบชื่อฟิลด์เดี่ยวจากฐานข้อมูลใหม่มาให้พิมพ์แก้ง่ายๆ
    const initialFullName = currentUser ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() : "";

    const [fullName, setFullName] = useState(initialFullName || currentUser?.lineProfileName || "");
    const [phone, setPhone] = useState(currentUser?.phoneNumber ?? "");
    const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState("");

    const validate = () => {
        const e: typeof errors = {};
        const ne = validateName(fullName);
        const pe = validatePhone(phone);
        if (ne) e.name = ne;
        if (pe) e.phone = pe;
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = async () => {
        if (!validate() || !currentUser) return;

        const trimmedName = fullName.trim().replace(/\s+/g, " ");
        const nameParts = trimmedName.split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" ") || "";

        setSaving(true);
        setServerError("");
        try {
            // ยิงไปที่ /api/profile (แก้เฉพาะข้อมูลส่วนตัว ไม่ยุ่งกับ role)
            // แนบ LINE token ให้หลังบ้านแกะ userId จาก token เอง กัน IDOR
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    phoneNumber: phone.trim().replace(/[-\s]/g, ""),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setServerError(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
                return;
            }

            // Update Zustand store ให้ UI ทุกที่สะท้อนทันที
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

    const isDirty = fullName.trim() !== initialFullName || (phone.trim().replace(/[-\s]/g, "") || null) !== (currentUser?.phoneNumber ?? null);

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/40 z-[800] backdrop-blur-xs transition-opacity" onClick={onClose} />

            {/* Drawer */}
            <div
                className="fixed bottom-0 left-0 right-0 z-[801] bg-surface rounded-t-[32px] shadow-2xl border-t border-border max-w-lg mx-auto px-6 pt-6 animate-slide-up transition-colors duration-300"
                style={{
                    paddingBottom: "calc(88px + env(safe-area-inset-bottom))",
                }}
            >
                <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />

                <div className="flex items-center justify-between mb-7">
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">แก้ไขข้อมูลส่วนตัว</h3>
                    <button title="button"
                        onClick={onClose}
                        className="w-8 h-8 bg-surface-subtle border border-border rounded-full flex items-center justify-center hover:bg-surface-muted transition-colors active:scale-[0.92] cursor-pointer"
                    >
                        <X size={14} className="text-text-secondary" />
                    </button>
                </div>

                <div className="space-y-5">
                    {/* Name field */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
                            <User size={10} /> ชื่อ-นามสกุลจริง <span className="text-danger">*</span>
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => {
                                setFullName(e.target.value);
                                if (errors.name) setErrors((p) => ({ ...p, name: "" }));
                            }}
                            placeholder="เช่น นายสมชาย ใจดี"
                            maxLength={100}
                            className={`w-full px-4 py-3.5 bg-surface-subtle border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:ring-2 outline-none transition-all min-h-[48px] font-semibold
                ${errors.name ? "border-danger focus:border-danger focus:ring-danger/20" : "border-border focus:border-primary focus:ring-primary/20"}`}
                        />
                        {errors.name && (
                            <p className="flex items-center gap-1.5 text-xs text-danger font-semibold animate-fade-in">
                                <AlertCircle size={11} />
                                {errors.name}
                            </p>
                        )}
                        <p className="text-xs text-text-muted text-right">{fullName.length}/100</p>
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
                                setPhone(e.target.value.replace(/[^0-9+]/g, ""));
                                if (errors.phone) setErrors((p) => ({ ...p, phone: "" }));
                            }}
                            placeholder="เช่น 0812345678"
                            maxLength={15}
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
                            <AlertCircle size={14} className="text-danger flex-shrink-0" />
                            <p className="text-xs text-danger font-semibold">{serverError}</p>
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving || !isDirty}
                        className="w-full mt-2 py-4 min-h-[52px] bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-sm cursor-pointer active:scale-[0.98]"
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

function ProfileCard({ onEdit }: { onEdit: () => void }) {
    const { currentUser } = useAppStore();
    if (!currentUser) return null;

    const role = currentUser.role;
    const roleLabel = ROLE_LABEL[role] ?? role;
    const roleColor = ROLE_COLOR[role] ?? "";
    const roleDot = ROLE_DOT[role] ?? "bg-text-muted";

    const userDisplayName = currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName || ""}`.trim() : currentUser.lineProfileName;

    return (
        <div className="bg-surface rounded-3xl border border-border shadow-sm p-5 sm:p-6">
            <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 shadow-sm select-none">
                    {getInitials(currentUser.firstName, currentUser.lineProfileName)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-text-primary truncate">{userDisplayName}</h2>

                    <span className={`inline-flex items-center gap-1.5 mt-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border uppercase tracking-wider ${roleColor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${roleDot}`} />
                        {roleLabel}
                    </span>

                    {currentUser.phoneNumber ? (
                        <p className="flex items-center gap-1.5 mt-2 text-xs text-text-muted font-mono">
                            <Phone size={10} />
                            {currentUser.phoneNumber}
                        </p>
                    ) : (
                        <p className="mt-2 text-xs text-text-muted/50 italic">ยังไม่ได้ระบุเบอร์โทร</p>
                    )}
                </div>

                <button
                    onClick={onEdit}
                    className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-surface-subtle hover:bg-primary-light border border-border hover:border-primary/20 text-text-muted hover:text-primary transition-all duration-200 cursor-pointer active:scale-[0.92] group"
                    title="แก้ไขข้อมูลส่วนตัว"
                >
                    <Pencil size={14} className="group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </div>
    );
}

export default function ManagePage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const [showEdit, setShowEdit] = useState(false);
    const { showToast, toastElement } = useToast();

    // ดักตรวจสอบบทบาทความปลอดภัยสิทธิ์ทั่วไปตัวพิมพ์เล็ก
    if (!currentUser || currentUser.role === "guest") {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center w-full max-w-lg mx-auto bg-surface-muted border-x border-border">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mb-4 border border-red-500/20">
                    <ShieldAlert size={28} className="animate-pulse" />
                </div>
                <h1 className="font-display text-base font-normal text-text-primary mb-1">สิทธิ์การเข้าถึงถูกจำกัด</h1>
                <p className="text-xs text-text-secondary mb-6 max-w-[80%] mx-auto leading-relaxed">หน้านี้สำหรับเจ้าหน้าที่ปฏิบัติการ, ผู้บริหาร และผู้ดูแลระบบเท่านั้น</p>
                <button
                    onClick={() => router.push("/map")}
                    className="w-full max-w-[200px] py-3.5 bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                >
                    กลับไปหน้าแผนที่
                </button>
            </div>
        );
    }

    const isAdmin = currentUser.role === "admin";

    return (
        <div className="min-h-dvh w-full bg-surface-muted pb-[120px] transition-colors duration-300">
            <div className="w-full max-w-2xl mx-auto px-4 sm:px-8">
                {/* Header */}
                <div className="pt-10 sm:pt-16 pb-8 sm:pb-10 border-b border-border mb-8">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
                                {isAdmin ? <Shield size={22} className="text-white" /> : <UserCircle2 size={22} className="text-white" />}
                            </div>
                            <div>
                                <h1 className="font-display text-base font-semibold text-text-primary leading-tight">
                                    {isAdmin ? (
                                        <>
                                            Admin <span className="text-primary">Panel</span>
                                        </>
                                    ) : (
                                        <>
                                            บัญชี
                                            <span className="text-primary">ของฉัน</span>
                                        </>
                                    )}
                                </h1>
                                <p className="text-xs text-text-secondary mt-0.5">{isAdmin ? "ศูนย์ควบคุมระบบตรวจวัดคุณภาพน้ำชายฝั่ง" : "ข้อมูลและการตั้งค่าส่วนตัว"}</p>
                            </div>
                        </div>

                        <div className="flex-shrink-0 mt-1">
                            <ThemeToggle showLabel />
                        </div>
                    </div>

                    {isAdmin && (
                        <div className="flex items-center gap-2 mt-5">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-light border border-primary/10 px-3 py-1.5 rounded-full uppercase tracking-wider">
                                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                System Administrator
                            </span>
                        </div>
                    )}
                </div>

                {/* Profile card */}
                <div className="mb-8">
                    <p className="text-sm font-semibold text-text-muted uppercase tracking-wider px-1 mb-4">ข้อมูลของฉัน</p>
                    <ProfileCard onEdit={() => setShowEdit(true)} />
                </div>

                {/* Admin menus */}
                {isAdmin && (
                    <div className="space-y-3">
                        <p className="text-sm font-semibold text-text-muted uppercase tracking-wider px-1 mb-5">เมนูการจัดการ</p>

                        {adminMenus.map((menu) => {
                            const Icon = menu.icon;
                            return (
                                <button
                                    key={menu.href}
                                    onClick={() => menu.available && router.push(menu.href)}
                                    disabled={MenuBoxDisable(menu.available)}
                                    className={`w-full group flex items-center gap-4 p-5 sm:p-6 bg-surface rounded-2xl border border-border shadow-sm transition-all duration-200 text-left
                    ${menu.available ? "hover:border-primary/30 hover:shadow-md hover:scale-[1.01] cursor-pointer active:scale-[0.99]" : "opacity-50 cursor-not-allowed"}`}
                                >
                                    <div
                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${menu.iconBg} ${menu.available ? "group-hover:scale-105" : ""}`}
                                    >
                                        <Icon size={20} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-sm font-semibold text-text-primary truncate">{menu.label}</h3>
                                            {!menu.available && (
                                                <span className="text-xs font-semibold text-text-muted bg-surface-subtle border border-border px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                                                    เร็วๆ นี้
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-text-secondary leading-relaxed">{menu.description}</p>
                                        {menu.available && (
                                            <span className={`inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-full border uppercase tracking-wider ${menu.color}`}>{menu.badge}</span>
                                        )}
                                    </div>

                                    <ChevronRight
                                        size={16}
                                        className={`flex-shrink-0 transition-all duration-200 ${menu.available ? "text-text-muted group-hover:text-primary group-hover:translate-x-0.5" : "text-text-muted/30"}`}
                                    />
                                </button>
                            );
                        })}

                        <div className="mt-10 p-4 bg-surface rounded-2xl border border-border flex items-start gap-3">
                            <ShieldAlert size={20} className="text-text-muted flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-text-muted leading-relaxed">การเปลี่ยนแปลงใดๆ ในหน้านี้จะมีผลต่อข้อมูลระบบทันที กรุณาดำเนินการด้วยความระมัดระวัง</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit drawer */}
            {showEdit && <EditProfileDrawer onClose={() => setShowEdit(false)} showToast={showToast} />}

            {/* Toast */}
            {toastElement}
        </div>
    );
}

// Helper ป้องกันปุ่มแอดมินเพี้ยนกรณีพิเศษ
function MenuBoxDisable(status: boolean) {
    return !status;
}
