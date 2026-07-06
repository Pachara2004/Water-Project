"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import Swal from "sweetalert2";
import { useAppStore } from "@/lib/store";
import { ArrowLeft, ShieldAlert, Users, UserCog, Clock, CheckCircle2, XCircle, ChevronDown, RefreshCw, Phone, CalendarDays, Layers, Search } from "lucide-react";

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
    const [tab, setTab] = useState<"all" | "staff" | "queue">("queue");
    const [search, setSearch] = useState("");
    const [updating, setUpdating] = useState<number | null>(null);
    const [openDropdown, setOpenDropdown] = useState<number | null>(null);
    const [toast, setToast] = useState<{ name: string; role: Role } | null>(null);
    const [rejectingAll, setRejectingAll] = useState(false);
    const [stats, setStats] = useState({ total: 0, staff: 0, pending: 0 });

    // จองพื้นที่ scrollbar ไว้ล่วงหน้าเฉพาะหน้านี้ กัน layout ขยับตอน popup ยืนยันล็อกการ scroll
    useEffect(() => {
        document.documentElement.classList.add("reserve-scrollbar-gutter");
        return () => document.documentElement.classList.remove("reserve-scrollbar-gutter");
    }, []);

    // ยอดสรุปทั้งหมด/เจ้าหน้าที่/รออนุมัติ ดึงแยกจาก endpoint ที่ COUNT ล้วนๆ ไม่ผูกกับคำค้นหา
    // และไม่ต้องโหลดข้อมูลผู้ใช้ทั้งชุดมาคำนวณเอง จึงยัง scale ได้แม้ผู้ใช้ในระบบเยอะขึ้นมาก
    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch("/api/users/stats", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
            });
            const data = await res.json();
            if (res.ok) setStats(data);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const fetchUsers = useCallback(async (keyword: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (keyword) params.set("search", keyword);

            const res = await fetch(`/api/users?${params.toString()}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
            });
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
        if (currentUser?.role === "admin") {
            fetchUsers("");
            fetchStats();
        }
    }, [currentUser?.role, fetchUsers, fetchStats]);

    // debounce search 400ms — ยิงหา backend เฉพาะรายการ ไม่กระทบยอดสรุป (stats แยก endpoint แล้ว)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (currentUser?.role === "admin") fetchUsers(search);
        }, 400);
        return () => clearTimeout(timer);
    }, [search, currentUser?.role, fetchUsers]);

    const confirmDialog = (title: string, text: string, confirmButtonText: string, confirmButtonColor: string) =>
        Swal.fire({
            icon: "warning",
            title,
            text,
            showCancelButton: true,
            confirmButtonText,
            cancelButtonText: "ยกเลิก",
            confirmButtonColor,
            background: "var(--color-surface, #ffffff)",
            color: "var(--color-text-primary, #000000)",
            heightAuto: false,
            scrollbarPadding: false,
        });

    const handleRoleChange = async (userId: number, role: Role) => {
        setOpenDropdown(null);
        const user = users.find((u) => u.id === userId);
        const name = user ? (user.fullName !== "ยังไม่ลงทะเบียนข้อมูล" ? user.fullName : user.lineProfileName) : "ผู้ใช้นี้";

        const confirm = await confirmDialog("ยืนยันเปลี่ยนสิทธิ์?", `เปลี่ยนสิทธิ์ของ ${name} เป็น ${ROLE_CONFIG[role].label}`, "ยืนยัน", "#0f766e");
        if (!confirm.isConfirmed) return;

        setUpdating(userId);
        try {
            const res = await fetch("/api/users", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({ userId, role }),
            });
            if (res.ok) {
                setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
                fetchStats();
                if (user) {
                    setToast({ name, role });
                    setTimeout(() => setToast(null), 3000);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setUpdating(null);
        }
    };

    const handleApprove = async (user: UserItem, displayName: string) => {
        if (!user.pendingRequestId || !user.requestedRole) return;
        const confirm = await confirmDialog("ยืนยันอนุมัติคำร้อง?", `อนุมัติ ${displayName} เป็นสิทธิ์ ${ROLE_CONFIG[user.requestedRole].label}`, "อนุมัติ", "#0f766e");
        if (!confirm.isConfirmed) return;

        setUpdating(user.id);
        try {
            const res = await fetch("/api/users", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    // 🔥 ปรับเติม Token ยืนยันสิทธิ์ในการ Approve ตั๋วคำร้อง
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({
                    userId: user.id,
                    role: user.requestedRole,
                    requestId: user.pendingRequestId,
                }),
            });
            if (res.ok) {
                setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: user.requestedRole!, pendingRequestId: null, requestedRole: null } : u)));
                fetchStats();
                setToast({ name: displayName, role: user.requestedRole! });
                setTimeout(() => setToast(null), 3000);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setUpdating(null);
        }
    };

    const handleReject = async (user: UserItem, displayName: string) => {
        if (!user.pendingRequestId) return;
        const confirm = await confirmDialog("ยืนยันปฏิเสธคำร้อง?", `ปฏิเสธคำร้องขอสิทธิ์ของ ${displayName} — ไม่สามารถย้อนกลับได้`, "ปฏิเสธ", "#dc2626");
        if (!confirm.isConfirmed) return;

        setUpdating(user.id);
        try {
            const res = await fetch("/api/users", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    // 🔥 ปรับเติม Token ยืนยันสิทธิ์ในการ Reject ปฏิเสธตั๋วคำร้อง
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({
                    userId: user.id,
                    action: "reject",
                    requestId: user.pendingRequestId,
                }),
            });
            if (res.ok) {
                setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, pendingRequestId: null, requestedRole: null } : u)));
                fetchStats();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setUpdating(null);
        }
    };

    const handleRejectAll = async () => {
        const confirm = await confirmDialog("ปฏิเสธคำร้องทั้งหมด?", `คำร้องขอสิทธิ์ที่รออนุมัติทั้ง ${queue.length} รายการจะถูกปฏิเสธ ไม่สามารถย้อนกลับได้`, "ปฏิเสธทั้งหมด", "#dc2626");
        if (!confirm.isConfirmed) return;

        setRejectingAll(true);
        try {
            const res = await fetch("/api/users", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({ action: "rejectAll" }),
            });
            if (res.ok) {
                setUsers((prev) => prev.map((u) => (u.pendingRequestId !== null ? { ...u, pendingRequestId: null, requestedRole: null } : u)));
                fetchStats();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setRejectingAll(false);
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

    const staffUsers = users.filter((u) => u.role !== "guest");
    const queue = users.filter((u) => u.pendingRequestId !== null);
    const filtered = tab === "queue" ? queue : tab === "staff" ? staffUsers : users;

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
                            onClick={() => {
                                fetchUsers(search);
                                fetchStats();
                            }}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface border border-border hover:border-primary/30 text-text-muted hover:text-primary transition-all cursor-pointer flex-shrink-0 mt-1"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>

                    {/* Stats row */}
                    <div className="flex gap-3 mt-6">
                        {[
                            { label: "ทั้งหมด", value: stats.total, color: "text-text-primary" },
                            { label: "เจ้าหน้าที่", value: stats.staff, color: "text-blue-600 dark:text-blue-400" },
                            { label: "รอการอนุมัติ", value: stats.pending, color: stats.pending > 0 ? "text-amber-600 dark:text-amber-400" : "text-text-primary" },
                        ].map((s) => (
                            <div key={s.label} className="flex-1 bg-surface rounded-2xl border border-border px-4 py-3 text-center">
                                <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                                <div className="text-xs font-bold text-text-muted uppercase tracking-wider mt-0.5">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-3 gap-1 mb-4 p-1 bg-surface-subtle border border-border rounded-2xl">
                    {(["all", "staff", "queue"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                                tab === t ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text-primary"
                            }`}
                        >
                            {t === "all" && (
                                <>
                                    <Users size={13} className="flex-shrink-0" />
                                    ทั้งหมด
                                </>
                            )}
                            {t === "staff" && (
                                <>
                                    <UserCog size={13} className="flex-shrink-0" />
                                    เจ้าหน้าที่
                                </>
                            )}
                            {t === "queue" && (
                                <>
                                    <Clock size={13} className="flex-shrink-0" />
                                    รออนุมัติ
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
                        className="w-full pl-10 pr-4 py-3 bg-surface border border-border text-text-primary rounded-2xl text-sm placeholder:text-text-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[44px]"
                    />
                </div>

                {/* Reject all — เฉพาะ tab รออนุมัติ */}
                {tab === "queue" && queue.length > 0 && (
                    <div className="flex items-center justify-between mb-3 px-1">
                        <p className="text-xs font-bold text-text-muted">ตรวจสอบคำร้องแต่ละรายการด้านล่าง</p>
                        <button
                            onClick={handleRejectAll}
                            disabled={rejectingAll}
                            className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-40 cursor-pointer"
                        >
                            {rejectingAll ? <RefreshCw size={12} className="animate-spin" /> : <XCircle size={12} />}
                            ปฏิเสธทั้งหมด
                        </button>
                    </div>
                )}

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
                            <p className="text-sm font-bold text-text-muted">{tab === "queue" ? "ไม่มีผู้ใช้รอการอนุมัติ" : tab === "staff" ? "ไม่พบเจ้าหน้าที่ที่ค้นหา" : "ไม่พบผู้ใช้ที่ค้นหา"}</p>
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
                                    <div className="p-4 sm:p-5 flex items-center flex-wrap sm:flex-nowrap gap-4">
                                        {/* Avatar */}
                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-white text-xs font-black ${avatarColor(displayName)}`}>
                                            {getInitials(user.fullName, user.lineProfileName)}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-[140px]">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold text-text-primary truncate min-w-0">{displayName}</h3>
                                                <span className={`inline-flex items-center justify-center text-xs font-bold leading-none px-2 py-1 rounded-full border flex-shrink-0 ${cfg.color}`}>
                                                    {cfg.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-text-muted overflow-hidden whitespace-nowrap">
                                                {user.phoneNumber && (
                                                    <>
                                                        <span className="flex items-center gap-1 font-mono">
                                                            <Phone size={9} />
                                                            {user.phoneNumber}
                                                        </span>
                                                        <span>·</span>
                                                    </>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <CalendarDays size={9} />
                                                    {formatDate(user.registeredAt)}
                                                </span>
                                                {user.samplesCount > 0 && (
                                                    <>
                                                        <span>·</span>
                                                        <span className="flex items-center gap-1">
                                                            <Layers size={9} />
                                                            {user.samplesCount} ตัวอย่างน้ำ
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action: เปลี่ยนสิทธิ์ (tab อื่นๆ) — ปุ่มอนุมัติ/ปฏิเสธของ tab รออนุมัติอยู่ด้านล่างการ์ด */}
                                        {/* บนมือถือตกลงมาเป็นแถวเต็มความกว้าง กันชื่อ/ข้อมูลถูกบีบจนตัดจนอ่านไม่ออก */}
                                        {!(tab === "queue" && user.pendingRequestId && user.requestedRole) && (
                                            <div className="relative flex-shrink-0 w-full sm:w-auto order-last sm:order-none" onClick={(e) => e.stopPropagation()}>
                                                {isUpdating ? (
                                                    <div className="w-9 h-9 flex items-center justify-center ml-auto">
                                                        <RefreshCw size={14} className="animate-spin text-primary" />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => setOpenDropdown(isOpen ? null : user.id)}
                                                            className="flex items-center justify-center gap-1.5 w-full sm:w-auto sm:min-w-[160px] px-3 py-2 bg-surface-subtle hover:bg-surface-muted border border-border rounded-xl text-sm font-bold text-text-secondary transition-all cursor-pointer min-h-[36px]"
                                                        >
                                                            เปลี่ยนสิทธิ์
                                                            <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                                        </button>

                                                        {isOpen && (
                                                            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-surface border border-border rounded-2xl shadow-xl py-2 animate-fade-in">
                                                                <p className="text-xs font-bold text-text-muted uppercase tracking-wider px-4 pt-1 pb-2 border-b border-border mb-1">เลือกบทบาท</p>
                                                                {ROLE_OPTIONS.map((r) => {
                                                                    const rc = ROLE_CONFIG[r];
                                                                    const isCurrent = user.role === r;
                                                                    return (
                                                                        <button
                                                                            key={r}
                                                                            onClick={() => !isCurrent && handleRoleChange(user.id, r)}
                                                                            disabled={isCurrent}
                                                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold transition-colors text-left cursor-pointer
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
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action: อนุมัติ/ปฏิเสธ — เฉพาะ tab รออนุมัติ วางเต็มความกว้างด้านล่างการ์ด */}
                                    {tab === "queue" && user.pendingRequestId && user.requestedRole && (
                                        <div className="px-4 sm:px-5 pb-4 flex gap-2 border-t border-border/50 pt-3" onClick={(e) => e.stopPropagation()}>
                                            {isUpdating ? (
                                                <div className="w-full flex items-center justify-center py-1.5">
                                                    <RefreshCw size={14} className="animate-spin text-primary" />
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(user, displayName)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[40px] bg-primary hover:bg-navy-dark text-white text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-[0.97] whitespace-nowrap"
                                                    >
                                                        <CheckCircle2 size={13} />
                                                        อนุมัติเป็น {ROLE_CONFIG[user.requestedRole].label}
                                                    </button>

                                                    <button
                                                        onClick={() => handleReject(user, displayName)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[40px] bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-xl hover:bg-red-100 hover:border-red-300 transition-all cursor-pointer active:scale-[0.97] whitespace-nowrap"
                                                    >
                                                        <XCircle size={13} />
                                                        ปฏิเสธ
                                                    </button>
                                                </>
                                            )}
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
