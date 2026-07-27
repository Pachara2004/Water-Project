"use client";

import { Users, UserCog, Clock, CheckCircle2, XCircle, RefreshCw, Search, ArrowUp, ArrowDown, Phone, CalendarDays, Layers, ChevronDown } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { ROLE_OPTIONS, ROLE_CONFIG, formatDate, type Role, type UserItem } from "@/components/manage/usersHelpers";
import PaginationBar from "@/components/PaginationBar";
import type { UsersPageProps } from "./usersMobile";

// Desktop = ออกแบบใหม่ทั้งหน้าให้เหมาะกับจอกว้าง (การ์ดสถิติ, แถบควบคุม, การ์ดผู้ใช้) — ไม่แตะ mobile
// ไม่เปลี่ยน logic/handler — ใช้ state ชุดเดียวกับ usersMobile ที่มาจาก page.tsx
export default function UsersDesktop(props: UsersPageProps) {
    const { router, toastElement, stats, tab, setTab, search, setSearch, isDesc, setIsDesc, users, total, page, totalPages, setPage, updating, openDropdown, setOpenDropdown, rejectingAll, handleRejectAll, handleRoleChange, handleApprove, handleReject } =
        props;

    const TAB_META: Record<"all" | "staff" | "queue", { label: string; icon: typeof Users }> = {
        all: { label: "ทั้งหมด", icon: Users },
        staff: { label: "เจ้าหน้าที่", icon: UserCog },
        queue: { label: "รออนุมัติ", icon: Clock },
    };

    return (
        <div className="min-h-dvh w-full bg-bg pb-8 antialiased transition-colors duration-300" onClick={() => openDropdown && setOpenDropdown(null)}>
            <PageHeader title="จัดการผู้ใช้งาน" onBack={() => router.back()} />

            <div className="w-full max-w-400 mx-auto px-8 pt-8 space-y-5">
                {/* ─── 1. Header Welcome Card ── */}
                <div className="relative w-full rounded-2xl bg-surface p-6 border border-border flex items-center justify-between gap-6">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-text-primary">
                            จัดการ<span className="text-primary font-bold">ผู้ใช้งานในระบบ</span>
                        </h1>
                        <p className="text-text-secondary font-medium text-xs mt-0.5">อนุมัติสิทธิ์และจัดการบทบาทผู้ใช้งาน</p>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-3 shrink-0 w-full max-w-xl">
                        {[
                            { label: "ทั้งหมด", value: stats.total },
                            { label: "เจ้าหน้าที่", value: stats.staff },
                            { label: "รออนุมัติ", value: stats.pending },
                        ].map((s) => (
                            <div key={s.label} className="bg-card-summary rounded-xl border border-border p-3 text-center min-w-30">
                                <div className="text-xl font-bold text-white">{s.value}</div>
                                <div className="text-xs font-semibold text-white mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ─── 2. แถบควบคุม: ค้นหา + แท็บ + เรียงลำดับ + ปฏิเสธทั้งหมด ── */}
                <div className="bg-surface rounded-2xl p-5 border border-border space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="inline-flex items-center gap-1.5">
                            <Users size={18} className="text-primary" />
                            <h2 className="text-sm uppercase text-primary font-bold tracking-wider">บัญชีผู้ใช้งาน</h2>
                        </div>

                        {tab === "queue" && stats.pending > 0 && (
                            <button
                                onClick={handleRejectAll}
                                disabled={rejectingAll}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-bg-danger border border-border-danger text-text-danger transition-all cursor-pointer shrink-0"
                            >
                                {rejectingAll ? <RefreshCw size={11} className="animate-spin" /> : <XCircle size={11} />}
                                ปฏิเสธทั้งหมด
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 flex items-center bg-surface-subtle border border-border rounded-xl px-4 transition-all">
                            <Search size={15} className="text-text-muted shrink-0" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="ค้นหาชื่อผู้ใช้งาน..."
                                className="w-full py-2.5 px-2 bg-transparent text-xs text-text-primary outline-hidden placeholder:text-text-muted"
                            />
                        </div>

                        <div className="inline-flex items-center gap-1 p-1 bg-surface-subtle border border-border rounded-xl shrink-0">
                            {(["all", "staff", "queue"] as const).map((t) => {
                                const meta = TAB_META[t];
                                const Icon = meta.icon;
                                return (
                                    <button
                                        key={t}
                                        onClick={() => setTab(t)}
                                        className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                                            tab === t ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:text-text-primary"
                                        }`}
                                    >
                                        <Icon size={12} />
                                        <span>{meta.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* แถบสรุปผลลัพธ์และปุ่มสลับการเรียงลำดับ */}
                    <div className="flex items-center justify-between text-xs text-text-secondary px-0.5 pt-1 border-t border-border">
                        <div className="text-text-secondary">พบ {total} บัญชี</div>

                        <div onClick={() => setIsDesc(!isDesc)} className="flex items-center gap-1 cursor-pointer hover:text-text-primary text-text-secondary transition-colors py-0.5 select-none">
                            <span>{isDesc ? "ลงทะเบียนล่าสุด" : "ลงทะเบียนเก่าสุด"}</span>
                            <div className="flex items-center text-text-secondary">
                                {isDesc ? <ArrowDown size={12} className="text-text-primary font-bold" /> : <ArrowUp size={12} className="text-text-primary font-bold" />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── 3. รายชื่อผู้ใช้ — กริดหลายคอลัมน์ ── */}
                {/* min-h กันหน้ายุบฮวบตอนสลับ tab/ค้นหาแล้วผลลัพธ์น้อยลงมาก — เบราว์เซอร์จะ auto-scroll ขึ้นเองถ้าพื้นที่ scroll หายไปกะทันหัน */}
                <div className="min-h-100">
                    {users.length === 0 ? (
                        <div className="text-center p-14 bg-surface rounded-2xl border border-border flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-surface-subtle rounded-xl flex items-center justify-center mb-3 text-text-muted border border-border">
                                {tab === "queue" ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Users size={20} />}
                            </div>
                            <p className="text-text-primary font-bold text-sm">{tab === "queue" ? "ไม่มีผู้ใช้รอการอนุมัติ" : "ไม่พบข้อมูลผู้ใช้งาน"}</p>
                            <p className="text-xs text-text-muted mt-1 max-w-xs leading-relaxed">ไม่พบรายชื่อผู้ใช้งานระบบตามคำค้นหาหรือตัวเลือกแท็บที่เลือกอยู่ในขณะนี้ครับ</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {users.map((user) => (
                                <UserCardDesktop
                                    key={user.id}
                                    user={user}
                                    tab={tab}
                                    isUpdating={updating === user.id}
                                    isOpen={openDropdown === user.id}
                                    onToggleDropdown={() => setOpenDropdown(openDropdown === user.id ? null : user.id)}
                                    onRoleChange={handleRoleChange}
                                    onApprove={handleApprove}
                                    onReject={handleReject}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>

            {/* Toast Component */}
            {toastElement}
        </div>
    );
}

// การ์ดผู้ใช้เฉพาะเดสก์ท็อป — เน้น badge สีตาม ROLE_CONFIG แทนข้อความล้วนแบบ mobile ใช้พื้นที่กว้างขึ้นได้
function UserCardDesktop({
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
    const initial = displayName.trim().charAt(0).toUpperCase() || "?";

    return (
        <div className="bg-surface rounded-2xl p-4 border border-border transition-all hover:border-primary/20 flex flex-col gap-3">
            {/* หัวการ์ด: อวาตาร์ตัวอักษรแรก + ชื่อ + badge สิทธิ์ */}
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm border ${roleCfg.color}`}>{initial}</div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">{displayName}</h3>
                    <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${roleCfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${roleCfg.dot}`} />
                        {roleCfg.label}
                    </span>
                </div>
            </div>

            {/* แถวข้อมูลเมตา — ไอคอนเรียงแนวนอน wrap ได้ */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-text-secondary border-t border-border/50 pt-2.5">
                {user.phoneNumber && (
                    <span className="flex items-center gap-1">
                        <Phone size={11} className="text-text-muted" />
                        {user.phoneNumber}
                    </span>
                )}
                <span className="flex items-center gap-1">
                    <CalendarDays size={11} className="text-text-muted" />
                    {formatDate(user.registeredAt)}
                </span>
                {user.samplesCount > 0 && (
                    <span className="flex items-center gap-1">
                        <Layers size={11} className="text-text-muted" />
                        {user.samplesCount} ตัวอย่าง
                    </span>
                )}
            </div>

            {/* เคสที่ 1: รายการทั่วไป -> ปุ่มจัดการสิทธิ์ */}
            {!isQueueRow && (
                <div onClick={(e) => e.stopPropagation()}>
                    {isUpdating ? (
                        <div className="w-full flex items-center justify-center py-2">
                            <RefreshCw size={14} className="animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="relative">
                            <button
                                onClick={onToggleDropdown}
                                className="flex items-center justify-center gap-1.5 w-full py-2 bg-surface-subtle hover:bg-surface-muted border border-border rounded-xl text-xs font-bold text-text-secondary transition-all cursor-pointer"
                            >
                                <span>จัดการสิทธิ์การใช้งาน</span>
                                <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                            </button>

                            {isOpen && (
                                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 bg-surface border border-border rounded-xl p-1 shadow-lg flex flex-col gap-1">
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

            {/* เคสที่ 2: รายการในคิวรออนุมัติ */}
            {isQueueRow && (
                <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold border ${ROLE_CONFIG[user.requestedRole!].color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ROLE_CONFIG[user.requestedRole!].dot}`} />
                        ร้องขอเปลี่ยนเป็น: {ROLE_CONFIG[user.requestedRole!].label}
                    </div>

                    {isUpdating ? (
                        <div className="w-full flex items-center justify-center py-2">
                            <RefreshCw size={14} className="animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="flex gap-2 w-full">
                            <button
                                onClick={() => onApprove(user, displayName)}
                                className="flex-1 flex items-center rounded-md justify-center gap-1.5 py-2 bg-primary text-white text-xs font-bold transition-all cursor-pointer active:scale-[0.97] whitespace-nowrap"
                            >
                                <CheckCircle2 size={13} />
                                อนุมัติ
                            </button>

                            <button
                                onClick={() => onReject(user, displayName)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-bg-danger border border-border-danger text-text-danger text-xs font-bold rounded-md transition-all cursor-pointer active:scale-[0.97] whitespace-nowrap"
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
