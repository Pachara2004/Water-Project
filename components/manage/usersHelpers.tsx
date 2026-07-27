"use client";

import { SquareChevronUp, CheckCircle2, ChevronDown, RefreshCw, Phone, CalendarDays, Layers, XCircle } from "lucide-react";

export type Role = "guest" | "collector" | "officer" | "admin";

export interface UserItem {
    id: number;
    lineProfileName: string;
    fullName: string;
    phoneNumber: string | null;
    role: Role;
    registeredAt: string;
    lastActiveAt: string;
    samplesCount: number;
    pendingRequestId: number | null;
    requestedRole: Role | null;
}

export const ROLE_OPTIONS: Role[] = ["guest", "collector", "officer", "admin"];

export const ROLE_CONFIG: Record<Role, { label: string; color: string; dot: string }> = {
    guest: {
        label: "General",
        color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
        dot: "bg-emerald-500",
    },
    collector: {
        label: "Collector",
        color: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
        dot: "bg-violet-500",
    },
    officer: {
        label: "Officer",
        color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
        dot: "bg-amber-500",
    },
    admin: {
        label: "Admin",
        color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
        dot: "bg-red-500",
    },
};

export function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/**
 * แถบแบ่งหน้า — ใช้ร่วมกันทั้ง desktop และ mobile
 *
 * เลขหน้ามาจากฝั่ง server (GET /api/users) ไม่ใช่การตัดอาเรย์ในเบราว์เซอร์
 * ซ่อนตัวเองเมื่อมีหน้าเดียวหรือไม่มีผลลัพธ์เลย
 */
export function PaginationBar({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-between border-t border-border pt-4 select-none">
            <div className="text-xs text-text-muted font-medium">
                หน้า <span className="font-medium text-text">{page}</span> จาก <span className="font-medium text-text">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-card-general text-text hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                    ก่อนหน้า
                </button>
                <button
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-card-general text-text hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                    ถัดไป
                </button>
            </div>
        </div>
    );
}

export function UserListRow({
    user,
    tab,
    isUpdating,
    isOpen,
    onToggleDropdown,
    onRoleChange,
    onApprove,
    onReject,
}: {
    user: UserItem;
    tab: "all" | "staff" | "queue";
    isUpdating: boolean;
    isOpen: boolean;
    onToggleDropdown: () => void;
    onRoleChange: (userId: number, role: Role) => void;
    onApprove: (user: UserItem, displayName: string) => void;
    onReject: (user: UserItem, displayName: string) => void;
}) {
    const displayName = user.fullName !== "ยังไม่ลงทะเบียนข้อมูล" ? user.fullName : user.lineProfileName;
    const isQueueRow = tab === "queue" && user.pendingRequestId && user.requestedRole;

    return (
        <div className="bg-surface rounded-xl p-3 border border-border transition-all flex flex-col">
            {/* ── ส่วนบน: ชื่อผู้ใช้งาน ── */}
            <div className="flex items-center gap-2 flex-wrap">
                <h3 className="px-2 pb-2 text-sm font-semibold text-text-primary truncate max-w-35 sm:max-w-none">{displayName}</h3>
            </div>

            {/* ── ส่วนกลาง: ข้อมูลประวัติ จัดเป็น Grid 2 คอลัมน์ เว้นระยะเท่ากัน Gap-3 ── */}
            <div className="grid grid-cols-2 gap-1 w-full text-xs text-text-muted mb-2">
                {/* แสดงเฉพาะสิทธิ์ปัจจุบันในส่วนข้อมูล (ถ้าเป็น Queue ก็โชว์แค่สิทธิ์ปัจจุบันก่อนเปลี่ยน) */}
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    -
                    <SquareChevronUp size={11} className="text-text-muted shrink-0" />
                    <span className="text-text-secondary font-normal">สิทธิ์ปัจจุบัน: {ROLE_CONFIG[user.role].label}</span>
                </div>

                {/* คอลัมน์ที่ 2: เบอร์โทรศัพท์ (ถ้ามี) */}
                {user.phoneNumber && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                        -
                        <Phone size={11} className="text-text-muted shrink-0" />
                        <span className="">{user.phoneNumber}</span>
                    </div>
                )}

                {/* คอลัมน์ที่ 3: วันที่ลงทะเบียน */}
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    -
                    <CalendarDays size={11} className="text-text-muted shrink-0" />
                    <span className="">{formatDate(user.registeredAt)}</span>
                </div>

                {/* คอลัมน์ที่ 4: จำนวนตัวอย่างน้ำ */}
                {user.samplesCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                        -
                        <Layers size={11} className="text-text-muted shrink-0" />
                        <span className="">{user.samplesCount} ตัวอย่าง</span>
                    </div>
                )}
            </div>

            {/* เคสที่ 1: รายการทั่วไป (ไม่ใช่ Queue อนุมัติ) -> โชว์ปุ่ม "จัดการสิทธิ์" เต็มความกว้างด้านล่าง */}
            {!isQueueRow && (
                <div className="w-full pt-1 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                    {isUpdating ? (
                        <div className="w-full flex items-center justify-center py-2">
                            <RefreshCw size={14} className="animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5 w-full">
                            <button
                                onClick={onToggleDropdown}
                                className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-surface-subtle hover:bg-surface-muted border border-border rounded-xl text-xs font-bold text-text-secondary transition-all cursor-pointer min-h-9.5"
                            >
                                <span>จัดการสิทธิ์การใช้งาน</span>
                                <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                            </button>

                            {isOpen && (
                                <div className="w-full bg-surface border border-border rounded-xl p-1 shadow-sm flex flex-col gap-1">
                                    {ROLE_OPTIONS.map((r) => {
                                        const rc = ROLE_CONFIG[r];
                                        const isCurrent = user.role === r;
                                        return (
                                            <button
                                                key={r}
                                                onClick={() => !isCurrent && onRoleChange(user.id, r)}
                                                disabled={isCurrent}
                                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer
                                    ${isCurrent ? "text-text-muted bg-surface-subtle cursor-not-allowed opacity-40" : "text-text-primary hover:bg-surface-subtle"}`}
                                            >
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${rc.dot}`} />
                                                <span>{rc.label}</span>
                                                {isCurrent && <CheckCircle2 size={12} className="ml-auto text-emerald-500" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* เคสที่ 2: รายการในคิวรออนุมัติ -> ย้าย "สิทธิ์ที่ต้องการ" มาพาดไว้เหนือกลุ่มปุ่มกดอนุมัติโดยตรง */}
            {isQueueRow && (
                <div className="w-full flex flex-col gap-2.5 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                    {/* ชิปแสดงสิทธิ์ที่ต้องการ ย้ายมาดักสายตาแอดมินตรงนี้เพื่อให้ดูง่ายขึ้นมาก */}
                    <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-md text-xs font-semibold text-primary border border-primary/20 w-full">
                        <span className="text-white font-normal">สิทธิ์ที่ร้องขอเปลี่ยนเป็น: {ROLE_CONFIG[user.requestedRole!].label}</span>
                    </div>

                    {/* แถวกลุ่มปุ่มกด อนุมัติ / ปฏิเสธ */}
                    {isUpdating ? (
                        <div className="w-full flex items-center justify-center py-2">
                            <RefreshCw size={14} className="animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="flex gap-2 w-full">
                            <button
                                onClick={() => onApprove(user, displayName)}
                                className="flex-1 flex items-center rounded-md justify-center gap-1.5 py-2.5 min-h-9.5 bg-primary  text-white text-xs font-bold transition-all cursor-pointer active:scale-[0.97] whitespace-nowrap"
                            >
                                <CheckCircle2 size={13} />
                                อนุมัติสิทธิ์
                            </button>

                            <button
                                onClick={() => onReject(user, displayName)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-9.5 bg-bg-danger border border-border-danger text-text-danger text-xs font-bold rounded-md transition-all cursor-pointer active:scale-[0.97] whitespace-nowrap"
                            >
                                <XCircle size={13} />
                                ปฏิเสธ
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
