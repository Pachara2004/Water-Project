"use client";

import type { useRouter } from "next/navigation";
import { Users, UserCog, Clock, CheckCircle2, XCircle, RefreshCw, Search, ArrowUp, ArrowDown } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { type Role, type UserItem, UserListRow } from "@/components/manage/usersHelpers";

export interface UsersPageProps {
    router: ReturnType<typeof useRouter>;
    toastElement: React.ReactNode;

    stats: { total: number; staff: number; pending: number };

    tab: "all" | "staff" | "queue";
    setTab: (v: "all" | "staff" | "queue") => void;
    search: string;
    setSearch: (v: string) => void;
    isDesc: boolean;
    setIsDesc: (v: boolean) => void;

    processedUsers: UserItem[];

    updating: number | null;
    openDropdown: number | null;
    setOpenDropdown: (v: number | null) => void;

    rejectingAll: boolean;
    handleRejectAll: () => void;

    handleRoleChange: (userId: number, role: Role) => void;
    handleApprove: (user: UserItem, displayName: string) => void;
    handleReject: (user: UserItem, displayName: string) => void;
}

export default function UsersMobile(props: UsersPageProps) {
    const { router, toastElement, stats, tab, setTab, search, setSearch, isDesc, setIsDesc, processedUsers, updating, openDropdown, setOpenDropdown, rejectingAll, handleRejectAll, handleRoleChange, handleApprove, handleReject } =
        props;

    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300" onClick={() => openDropdown && setOpenDropdown(null)}>
            {/* Top Back Navigation Navbar */}
            <PageHeader title="จัดการผู้ใช้งาน" onBack={() => router.back()} />

            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                {/* ─── 1. Header Welcome Card ─── */}
                <div className="relative w-full rounded-2xl bg-surface p-5 border border-border flex flex-col gap-4">
                    <div className="flex justify-between items-start w-full">
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-text-primary">
                                จัดการ<span className="text-primary font-bold">ผู้ใช้งานในระบบ</span>
                            </h1>
                            <p className="text-text-secondary font-medium text-xs mt-0.5">อนุมัติสิทธิ์และจัดการบทบาทผู้ใช้งาน</p>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: "ทั้งหมด", value: stats.total },
                            { label: "เจ้าหน้าที่", value: stats.staff },
                            { label: "รออนุมัติ", value: stats.pending },
                        ].map((s) => (
                            <div key={s.label} className="bg-card-summary rounded-xl border border-border p-3 text-center">
                                <div className="text-xl font-bold text-white">{s.value}</div>
                                <div className="text-xs font-semibold text-white mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ─── 2. โซนกล่องค้นหาและฟิลเตอร์ควบคุม (ทรง Collector) ─── */}
                <div className="relative w-full bg-surface rounded-2xl p-4 border border-border space-y-4">
                    {/* ส่วนหัวแสดงกลุ่มงานและปุ่มเคลียร์คำร้อง */}
                    <div className="flex items-center justify-between gap-3 pt-1 px-0.5">
                        <div className="inline-flex items-center gap-1.5">
                            <Users size={18} className="text-primary" />
                            <h2 className="text-sm uppercase text-primary font-bold tracking-wider">บัญชีผู้ใช้งาน</h2>
                        </div>

                        {tab === "queue" && processedUsers.length > 0 && (
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

                    {/* Input ค้นหา ทรงรีมน */}
                    <div className="relative w-full flex items-center bg-surface-subtle border border-border rounded-xl px-4 transition-all">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="ค้นหาชื่อ..."
                            className="w-full py-3 bg-transparent text-xs text-text-primary outline-hidden placeholder:text-text-muted"
                        />
                        <Search size={16} className="text-text-muted ml-2" />
                    </div>

                    {/* Navigation Tabs */}
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-subtle border border-border rounded-xl">
                        {(["all", "staff", "queue"] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                                    tab === t ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:text-text-primary"
                                }`}
                            >
                                {t === "all" && <Users size={12} />}
                                {t === "staff" && <UserCog size={12} />}
                                {t === "queue" && <Clock size={12} />}
                                <span>{t === "all" ? "ทั้งหมด" : t === "staff" ? "เจ้าหน้าที่" : "รออนุมัติ"}</span>
                            </button>
                        ))}
                    </div>

                    {/* แถบสรุปผลลัพธ์และปุ่มสลับการเรียงลำดับ */}
                    <div className="flex items-center justify-between text-xs text-text-secondary px-0.5 pt-1 border-t border-border">
                        <div className="text-text-secondary">พบ {processedUsers.length} บัญชี</div>

                        <div onClick={() => setIsDesc(!isDesc)} className="flex items-center gap-1 cursor-pointer hover:text-text-primary text-text-secondary transition-colors py-0.5 select-none">
                            <span>{isDesc ? "ลงทะเบียนล่าสุด" : "ลงทะเบียนเก่าสุด"}</span>
                            <div className="flex items-center text-text-secondary">
                                {isDesc ? <ArrowDown size={12} className="text-text-primary font-bold" /> : <ArrowUp size={12} className="text-text-primary font-bold" />}
                            </div>
                        </div>
                    </div>

                    {/* ─── 3. Content Core Render (List รายการ) ─── */}
                    <div className="space-y-3 pt-2">
                        {processedUsers.length === 0 ? (
                            <div className="text-center p-10 bg-surface rounded-2xl border border-border flex flex-col items-center justify-center">
                                <div className="w-10 h-10 bg-surface-subtle rounded-xl flex items-center justify-center mb-3 text-text-muted border border-border">
                                    {tab === "queue" ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Users size={18} />}
                                </div>
                                <p className="text-text-primary font-bold text-xs">{tab === "queue" ? "ไม่มีผู้ใช้รอการอนุมัติ" : "ไม่พบข้อมูลผู้ใช้งาน"}</p>
                                <p className="text-xs text-text-muted mt-1 max-w-xs leading-relaxed">ไม่พบรายชื่อผู้ใช้งานระบบตามคำค้นหาหรือตัวเลือกแท็บที่เลือกอยู่ในขณะนี้ครับ</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {processedUsers.map((user) => (
                                    <UserListRow
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
                </div>
            </div>

            {/* Toast Component */}
            {toastElement}
        </div>
    );
}
