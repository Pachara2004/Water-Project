"use client";

import { Users, UserCog, Clock, CheckCircle2, XCircle, RefreshCw, Search, ArrowUp, ArrowDown } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { type UserItem, UserListRow } from "@/components/manage/usersHelpers";
import PaginationBar from "@/components/PaginationBar";
import type { UsersPageProps } from "./usersMobile";

export default function UsersDesktop(props: UsersPageProps) {
    const {
        router,
        toastElement,
        stats,
        tab,
        setTab,
        search,
        setSearch,
        isDesc,
        setIsDesc,
        users,
        total,
        page,
        totalPages,
        setPage,
        updating,
        openDropdown,
        setOpenDropdown,
        rejectingAll,
        handleRejectAll,
        handleRoleChange,
        handleApprove,
        handleReject,
    } = props;

    const TAB_META: Record<"all" | "staff" | "queue", { label: string; icon: typeof Users }> = {
        all: { label: "ทั้งหมด", icon: Users },
        staff: { label: "เจ้าหน้าที่", icon: UserCog },
        queue: { label: "รออนุมัติ", icon: Clock },
    };

    return (
        <div className="min-h-dvh w-full bg-bg pb-8 antialiased transition-colors duration-300" onClick={() => openDropdown && setOpenDropdown(null)}>
            <PageHeader title="จัดการผู้ใช้งาน" onBack={() => router.back()} />

            <div className="w-full max-w-400 mx-auto p-4 space-y-5">
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
                                placeholder="ค้นหาชื่อหรือเบอร์โทร..."
                                className="w-full py-2.5 px-2 bg-transparent text-xs text-text-primary outline-hidden placeholder:text-text-muted"
                            />
                        </div>

                        <div className="inline-flex items-center gap-1 p-1 bg-primary/10 border border-primary/30 rounded-xl shrink-0">
                            {(["all", "staff", "queue"] as const).map((t) => {
                                const meta = TAB_META[t];
                                const Icon = meta.icon;
                                return (
                                    <button
                                        key={t}
                                        onClick={() => setTab(t)}
                                        className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                                            tab === t ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:text-text-primary bg-card-general"
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

                    {/* ─── 3. รายชื่อผู้ใช้ — ปรับเป็น Grid 2 คอลัมน์บน Desktop ── */}
                    <div className="min-h-100 pt-2">
                        {users.length === 0 ? (
                            <div className="text-center p-14 bg-surface rounded-2xl border border-border flex flex-col items-center justify-center">
                                <div className="w-12 h-12 bg-surface-subtle rounded-xl flex items-center justify-center mb-3 text-text-muted border border-border">
                                    {tab === "queue" ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Users size={20} />}
                                </div>
                                <p className="text-text-primary font-bold text-sm">{tab === "queue" ? "ไม่มีผู้ใช้รอการอนุมัติ" : "ไม่พบข้อมูลผู้ใช้งาน"}</p>
                                <p className="text-xs text-text-muted mt-1 max-w-xs leading-relaxed">ไม่พบรายชื่อผู้ใช้งานระบบตามคำค้นหาหรือตัวเลือกแท็บที่เลือกอยู่ในขณะนี้ครับ</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {users.map((user) => (
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

                    <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
            </div>

            {/* Toast Component */}
            {toastElement}
        </div>
    );
}
