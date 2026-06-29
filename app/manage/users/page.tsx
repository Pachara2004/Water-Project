"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { ArrowLeft, ShieldAlert, Users, Clock, CheckCircle2, XCircle, ChevronDown, RefreshCw, Phone, CalendarDays, Layers, Search } from "lucide-react";

type Role = "guest" | "collector" | "officer" | "admin";

interface UserItem {
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

const ROLE_CONFIG: Record<Role, { label: string; color: string; dot: string }> = {
    guest: {
        label: "ทั่วไป",
        color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
        dot: "bg-amber-500",
    },
    collector: {
        label: "ผู้เก็บข้อมูลภาคสนาม",
        color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
        dot: "bg-blue-500",
    },
    officer: {
        label: "ผู้บริหาร",
        color: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
        dot: "bg-violet-500",
    },
    admin: {
        label: "ผู้ดูแลระบบ",
        color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
        dot: "bg-emerald-500",
    },
};

const ROLE_OPTIONS: Role[] = ["guest", "collector", "officer", "admin"];

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function getInitials(fullName: string, lineName: string) {
    if (fullName && fullName.trim() && fullName !== "ยังไม่ลงทะเบียนข้อมูล") {
        return fullName.trim().slice(0, 2).toUpperCase();
    }
    return lineName.trim().slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500", "bg-indigo-500"];
function avatarColor(name: string) {
    let hash = 0;
    for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function AdminUsersPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();

    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"queue" | "all">("queue");
    const [search, setSearch] = useState("");
    const [updating, setUpdating] = useState<number | null>(null);
    const [openDropdown, setOpenDropdown] = useState<number | null>(null);
    const [toast, setToast] = useState<{ name: string; role: Role } | null>(null);

    const fetchUsers = useCallback(async (keyword: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (keyword) params.set("search", keyword);
            const res = await fetch(`/api/users?${params.toString()}`);
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    // โหลดครั้งแรก (ดักตรวจสิทธิ์ผ่านพิมพ์เล็ก "admin")
    useEffect(() => {
        if (currentUser?.role === "admin") fetchUsers("");
    }, [currentUser?.role, fetchUsers]);

    // debounce search 400ms
    useEffect(() => {
        const timer = setTimeout(() => {
            if (currentUser?.role === "admin") fetchUsers(search);
        }, 400);
        return () => clearTimeout(timer);
    }, [search, currentUser?.role, fetchUsers]);

    const handleRoleChange = async (userId: number, role: Role) => {
        setUpdating(userId);
        setOpenDropdown(null);
        try {
            const res = await fetch("/api/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, role }),
            });
            if (res.ok) {
                const user = users.find((u) => u.id === userId);
                setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
                if (user) {
                    setToast({ name: user.fullName !== "ยังไม่ลงทะเบียนข้อมูล" ? user.fullName : user.lineProfileName, role });
                    setTimeout(() => setToast(null), 3000);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setUpdating(null);
        }
    };

    // Security Gate บังคับดีดหน้าเตือนหากไม่ได้สิทธิ์ตัวพิมพ์เล็ก "admin"
    if (!currentUser || currentUser.role !== "admin") {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center w-full max-w-lg mx-auto">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mb-4 border border-red-500/20">
                    <ShieldAlert size={28} className="animate-pulse" />
                </div>
                <h1 className="font-display text-xl font-bold text-text-primary mb-1">สิทธิ์การเข้าถึงถูกจำกัด</h1>
                <p className="text-xs text-text-secondary mb-6">หน้านี้สำหรับผู้ดูแลระบบสูงสุดสูงสุดเท่านั้น</p>
                <button onClick={() => router.push("/map")} className="py-3 px-8 bg-primary text-white font-bold rounded-2xl text-xs cursor-pointer">
                    กลับหน้าแผนที่
                </button>
            </div>
        );
    }

    const queue = users.filter((u) => u.pendingRequestId !== null);
    const filtered = tab === "queue" ? queue : users;

    return (
        <div className="min-h-dvh w-full bg-surface-muted pb-[120px] transition-colors duration-300" onClick={() => openDropdown && setOpenDropdown(null)}>
            <div className="w-full max-w-2xl mx-auto px-4 sm:px-8">
                {/* Header */}
                <div className="pt-10 sm:pt-16 pb-8 border-b border-border mb-6">
                    <button onClick={() => router.push("/manage")} className="flex items-center gap-2 text-xs font-bold text-text-muted hover:text-primary transition-colors mb-5 group cursor-pointer">
                        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
                        Admin Panel
                    </button>

                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
                                <Users size={22} className="text-white" />
                            </div>
                            <div>
                                <h1 className="font-display text-2xl font-bold text-text-primary leading-tight">
                                    จัดการ <span className="text-primary">ผู้ใช้งาน</span>
                                </h1>
                                <p className="text-xs text-text-secondary mt-0.5">อนุมัติสิทธิ์และจัดการบทบาทผู้ใช้ในระบบ</p>
                            </div>
                        </div>
                        <button
                            title="buuton"
                            onClick={() => fetchUsers(search)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface border border-border hover:border-primary/30 text-text-muted hover:text-primary transition-all cursor-pointer flex-shrink-0 mt-1"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>

                    {/* Stats row */}
                    <div className="flex gap-3 mt-6">
                        {[
                            { label: "ทั้งหมด", value: users.length, color: "text-text-primary" },
                            { label: "รอการอนุมัติ", value: queue.length, color: queue.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-text-primary" },
                            { label: "ผู้เก็บข้อมูล", value: users.filter((u) => u.role === "collector").length, color: "text-blue-600 dark:text-blue-400" },
                        ].map((s) => (
                            <div key={s.label} className="flex-1 bg-surface rounded-2xl border border-border px-4 py-3 text-center">
                                <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                                <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                    {(["queue", "all"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                                tab === t ? "bg-primary text-white shadow-sm" : "bg-surface border border-border text-text-muted hover:text-text-primary"
                            }`}
                        >
                            {t === "queue" ? (
                                <>
                                    <Clock size={13} />
                                    รอการอนุมัติ
                                    {queue.length > 0 && (
                                        <span
                                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${tab === "queue" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"}`}
                                        >
                                            {queue.length}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Users size={13} />
                                    ผู้ใช้ทั้งหมด
                                </>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative mb-5">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="ค้นหาชื่อ หรือชื่อไลน์ไอดีผู้ใช้..."
                        className="w-full pl-10 pr-4 py-3 bg-surface border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[44px]"
                    />
                </div>

                {/* List */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="bg-surface rounded-3xl p-10 text-center border border-border flex flex-col items-center justify-center gap-3">
                            <RefreshCw size={22} className="animate-spin text-primary" />
                            <span className="text-xs text-text-muted font-bold">กำลังโหลดข้อมูลผู้ใช้...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="bg-surface rounded-3xl p-10 text-center border border-border">
                            <div className="w-14 h-14 bg-surface-subtle border border-border rounded-2xl flex items-center justify-center mx-auto mb-4">
                                {tab === "queue" ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Users size={20} className="text-text-muted" />}
                            </div>
                            <p className="text-xs font-bold text-text-muted">{tab === "queue" ? "ไม่มีผู้ใช้รอการอนุมัติ" : "ไม่พบผู้ใช้ที่ค้นหา"}</p>
                        </div>
                    ) : (
                        filtered.map((user) => {
                            const cfg = ROLE_CONFIG[user.role];
                            const isUpdating = updating === user.id;
                            const isOpen = openDropdown === user.id;

                            const displayName = user.fullName !== "ยังไม่ลงทะเบียนข้อมูล" ? user.fullName : user.lineProfileName;

                            return (
                                <div
                                    key={user.id}
                                    className="bg-surface rounded-2xl border border-border shadow-sm overflow-visible transition-all duration-200 hover:border-border/80 hover:shadow-md"
                                >
                                    <div className="p-4 sm:p-5 flex items-center gap-4">
                                        {/* Avatar */}
                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-white text-xs font-black ${avatarColor(displayName)}`}>
                                            {getInitials(user.fullName, user.lineProfileName)}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm font-bold text-text-primary truncate">{displayName}</h3>
                                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                {user.phoneNumber && (
                                                    <span className="flex items-center gap-1 text-[10px] text-text-muted font-mono">
                                                        <Phone size={9} />
                                                        {user.phoneNumber}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1 text-[10px] text-text-muted">
                                                    <CalendarDays size={9} />
                                                    {formatDate(user.registeredAt)}
                                                </span>
                                                {user.samplesCount > 0 && (
                                                    <span className="flex items-center gap-1 text-[10px] text-text-muted">
                                                        <Layers size={9} />
                                                        {user.samplesCount} ตัวอย่างน้ำ
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Role dropdown */}
                                        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                            {isUpdating ? (
                                                <div className="w-9 h-9 flex items-center justify-center">
                                                    <RefreshCw size={14} className="animate-spin text-primary" />
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setOpenDropdown(isOpen ? null : user.id)}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-surface-subtle hover:bg-surface-muted border border-border rounded-xl text-xs font-bold text-text-secondary transition-all cursor-pointer min-h-[36px]"
                                                >
                                                    เปลี่ยนสิทธิ์
                                                    <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                                </button>
                                            )}

                                            {isOpen && (
                                                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-surface border border-border rounded-2xl shadow-xl py-2 min-w-[180px] animate-fade-in">
                                                    <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider px-4 pt-1 pb-2 border-b border-border mb-1">เลือกบทบาท</p>
                                                    {ROLE_OPTIONS.map((r) => {
                                                        const rc = ROLE_CONFIG[r];
                                                        const isCurrent = user.role === r;
                                                        return (
                                                            <button
                                                                key={r}
                                                                onClick={() => !isCurrent && handleRoleChange(user.id, r)}
                                                                disabled={isCurrent}
                                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold transition-colors text-left cursor-pointer
                                  ${isCurrent ? "text-text-muted cursor-not-allowed opacity-50" : "text-text-primary hover:bg-surface-subtle"}`}
                                                            >
                                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${rc.dot}`} />
                                                                {rc.label}
                                                                {isCurrent && <CheckCircle2 size={12} className="ml-auto text-emerald-500" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Queue action strip — อนุมัติเป็นเลขสิทธิ์แบบพิมพ์เล็ก */}
                                    {/* Queue action strip — อนุมัติสิทธิ์ตามความต้องการจริงของผู้ใช้ */}
                                    {tab === "queue" && user.pendingRequestId && user.requestedRole && (
                                        <div className="px-4 sm:px-5 pb-4 flex gap-2 border-t border-border/50 pt-3">
                                            <button
                                                onClick={async () => {
                                                    setUpdating(user.id);
                                                    const res = await fetch("/api/users", {
                                                        method: "PATCH",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            userId: user.id,
                                                            role: user.requestedRole,
                                                            requestId: user.pendingRequestId,
                                                        }),
                                                    });
                                                    if (res.ok) {
                                                        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: user.requestedRole!, pendingRequestId: null, requestedRole: null } : u)));
                                                        setToast({ name: displayName, role: user.requestedRole! });
                                                        setTimeout(() => setToast(null), 3000);
                                                    }
                                                    setUpdating(null);
                                                }}
                                                disabled={!!updating}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[40px] bg-primary hover:bg-navy-dark text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40 cursor-pointer active:scale-[0.97]"
                                            >
                                                <CheckCircle2 size={13} />
                                                อนุมัติเป็น {ROLE_CONFIG[user.requestedRole].label}
                                            </button>

                                            <button
                                                onClick={async () => {
                                                    setUpdating(user.id);
                                                    const res = await fetch("/api/users", {
                                                        method: "PATCH",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({
                                                            userId: user.id,
                                                            action: "reject",
                                                            requestId: user.pendingRequestId,
                                                        }),
                                                    });
                                                    if (res.ok) {
                                                        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, pendingRequestId: null, requestedRole: null } : u)));
                                                    }
                                                    setUpdating(null);
                                                }}
                                                disabled={!!updating}
                                                className="flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[40px] bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 transition-all cursor-pointer"
                                            >
                                                <XCircle size={13} />
                                                ปฏิเสธคำขอ
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 z-[999] animate-slide-up">
                    <div className="flex items-center gap-2.5 bg-foreground text-background text-xs font-bold px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        อัปเดตสิทธิ์ <span className="text-emerald-400">{toast.name}</span> เป็น {ROLE_CONFIG[toast.role].label} สำเร็จ
                    </div>
                </div>
            )}
        </div>
    );
}
