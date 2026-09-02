// components/manage/usersHelpers.tsx
import { SquareChevronUp, CheckCircle2, ChevronDown, RefreshCw, Phone, CalendarDays, Layers, XCircle, User } from "lucide-react";

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

export const ROLE_CONFIG: Record<Role, { label: string; color: string;}> = {
    guest: {
        label: "ผู้ใช้ทั่วไป",
        color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    },
    collector: {
        label: "เจ้าหน้าที่ภาคสนาม",
        color: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
    },
    officer: {
        label: "เจ้าหน้าที่ส่วนกลาง",
        color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    },
    admin: {
        label: "เจ้าหน้าที่ดูแลระบบ",
        color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
    },
};

export function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
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
    const roleCfg = ROLE_CONFIG[user.role];

    return (
        <div className="bg-surface rounded-2xl p-3.5 border border-border transition-all flex flex-col gap-3">
            {/* ── ส่วนบน: อวาตาร์ไอคอน + ชื่อผู้ใช้งาน + Badge สิทธิ์ปัจจุบัน ── */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-9 h-9 bg-primary-light text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/10">
                        <User size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <h3 className="text-sm font-bold text-text-primary truncate">{displayName}</h3>
                        <span className="text-xs font-medium text-text-muted">ID: #{user.id}</span>
                    </div>
                </div>
            </div>

            {/* ── ส่วนกลาง: ข้อมูลประวัติ จัดเป็น Grid 2 คอลัมน์ ── */}
            <div className="grid grid-cols-2 gap-2 text-xs text-text-muted bg-surface-subtle p-2.5 rounded-xl border border-border/60">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                    <SquareChevronUp size={13} className="text-primary shrink-0" />
                    <span className="truncate">สิทธิ์: {roleCfg.label}</span>
                </div>

                {user.phoneNumber ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                        <Phone size={13} className="text-primary shrink-0" />
                        <span>{user.phoneNumber}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted/60 italic">
                        <Phone size={13} className="shrink-0" />
                        <span>ไม่ระบุเบอร์</span>
                    </div>
                )}

                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                    <CalendarDays size={13} className="text-primary shrink-0" />
                    <span>{formatDate(user.registeredAt)}</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                    <Layers size={13} className="text-primary shrink-0" />
                    <span>{user.samplesCount > 0 ? `${user.samplesCount} ตัวอย่าง` : "ไม่มีประวัติ"}</span>
                </div>
            </div>

            {/* เคสที่ 1: รายการทั่วไป -> ปุ่ม "จัดการสิทธิ์" เต็มความกว้างด้านล่าง */}
            {!isQueueRow && (
                <div className="w-full pt-1" onClick={(e) => e.stopPropagation()}>
                    {isUpdating ? (
                        <div className="w-full flex items-center justify-center py-2">
                            <RefreshCw size={14} className="animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1.5 w-full relative">
                            <button
                                onClick={onToggleDropdown}
                                className="flex items-center justify-center gap-1.5 w-full py-2 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-xs font-bold text-text-primary transition-all cursor-pointer min-h-9.5 active:scale-[0.99]"
                            >
                                <span>จัดการสิทธิ์การใช้งาน</span>
                                <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                            </button>

                            {isOpen && (
                                <div className="absolute top-[calc(100%+6px)] left-0 w-full z-50 bg-surface border border-border rounded-xl p-1.5 shadow-xl flex flex-col gap-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                    {ROLE_OPTIONS.map((r) => {
                                        const rc = ROLE_CONFIG[r];
                                        const isCurrent = user.role === r;
                                        return (
                                            <button
                                                key={r}
                                                onClick={() => {
                                                    if (!isCurrent) {
                                                        onRoleChange(user.id, r);
                                                        onToggleDropdown();
                                                    }
                                                }}
                                                disabled={isCurrent}
                                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer
                                    ${isCurrent ? "text-text-muted bg-surface-subtle cursor-not-allowed opacity-50" : "text-text-primary hover:bg-surface-subtle"}`}
                                            >
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

            {/* เคสที่ 2: รายการในคิวรออนุมัติ -> ปุ่ม อนุมัติ / ปฏิเสธ */}
            {isQueueRow && (
                <div className="w-full flex flex-col gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 bg-primary-light px-3 py-2 rounded-xl text-xs font-semibold text-primary border border-primary/10 w-full">
                        <span>
                            สิทธิ์ที่ร้องขอเปลี่ยนเป็น: <strong>{ROLE_CONFIG[user.requestedRole!].label}</strong>
                        </span>
                    </div>

                    {isUpdating ? (
                        <div className="w-full flex items-center justify-center py-2">
                            <RefreshCw size={14} className="animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="flex gap-2 w-full">
                            <button
                                onClick={() => onApprove(user, displayName)}
                                className="flex-1 flex items-center rounded-xl justify-center gap-1.5 py-2.5 min-h-9.5 bg-secondary hover:bg-navy-dark text-white text-xs font-bold transition-all cursor-pointer active:scale-[0.97] whitespace-nowrap"
                            >
                                <CheckCircle2 size={13} />
                                อนุมัติสิทธิ์
                            </button>

                            <button
                                onClick={() => onReject(user, displayName)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-9.5 bg-bg-danger border border-border-danger text-text-danger text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-[0.97] whitespace-nowrap hover:bg-red-500/10"
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
