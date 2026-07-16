"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { confirmDialog } from "@/lib/swal";
import { refreshNavDots } from "@/lib/navEvents";
import { useToast } from "@/components/useToast";
import { useAppStore } from "@/lib/store";
import { ArrowLeft, ShieldAlert, SquareChevronUp, Users, UserCog, Clock, CheckCircle2, XCircle, ChevronDown, RefreshCw, Phone, CalendarDays, Layers, Search, ArrowUp, ArrowDown } from "lucide-react";

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

const ROLE_OPTIONS: Role[] = ["guest", "collector", "officer", "admin"];

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export default function AdminUsersPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();

    const [users, setUsers] = useState<UserItem[]>([]);
    const [tab, setTab] = useState<"all" | "staff" | "queue">("queue");
    const [search, setSearch] = useState("");
    const [updating, setUpdating] = useState<number | null>(null);
    const [openDropdown, setOpenDropdown] = useState<number | null>(null);
    const { showToast, toastElement } = useToast();

    const [rejectingAll, setRejectingAll] = useState(false);
    const [stats, setStats] = useState({ total: 0, staff: 0, pending: 0 });

    // สเตทสำหรับควบคุมทิศทางการเรียงลำดับ (เลียนแบบ Collector)
    const [isDesc, setIsDesc] = useState(true);

    useEffect(() => {
        document.documentElement.classList.add("reserve-scrollbar-gutter");
        return () => document.documentElement.classList.remove("reserve-scrollbar-gutter");
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch("/api/users/stats", {
                method: "GET",
                headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
            });
            const data = await res.json();
            if (res.ok) setStats(data);
        } catch (e) {
            console.error(e);
        }
    }, []);

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

    const fetchUsers = useCallback(async (keyword: string) => {
        try {
            const params = new URLSearchParams();
            if (keyword) params.set("search", keyword);

            const res = await fetch(`/api/users?${params.toString()}`, {
                method: "GET",
                headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
            });
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        if (currentUser?.role === "admin") {
            fetchUsers("");
            fetchStats();
        }
    }, [currentUser?.role, fetchUsers, fetchStats]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (currentUser?.role === "admin") fetchUsers(search);
        }, 400);
        return () => clearTimeout(timer);
    }, [search, currentUser?.role, fetchUsers]);

    const handleRoleChange = async (userId: number, role: Role) => {
        setOpenDropdown(null);
        const user = users.find((u) => u.id === userId);
        const name = user ? (user.fullName !== "ยังไม่ลงทะเบียนข้อมูล" ? user.fullName : user.lineProfileName) : "ผู้ใช้นี้";

        const confirmed = await confirmDialog({ title: "ยืนยันเปลี่ยนสิทธิ์?", text: `เปลี่ยนสิทธิ์ของ ${name} เป็น ${ROLE_CONFIG[role].label}`, confirmText: "ยืนยัน", tone: "warning" });
        if (!confirmed) return;

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
                showToast(`อัปเดตสิทธิ์ ${name} เป็น ${[role]} สำเร็จ`, "success");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setUpdating(null);
        }
    };

    const handleApprove = async (user: UserItem, displayName: string) => {
        if (!user.pendingRequestId || !user.requestedRole) return;
        const confirmed = await confirmDialog({
            title: "ยืนยันอนุมัติคำร้อง?",
            text: `อนุมัติ ${displayName} เป็นสิทธิ์ ${[user.requestedRole]}`,
            confirmText: "อนุมัติ",
            tone: "primary",
        });
        if (!confirmed) return;

        setUpdating(user.id);
        try {
            const res = await fetch("/api/users", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
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
                showToast(`อนุมัติ ${displayName} เป็นสิทธิ์ ${[user.requestedRole!]} สำเร็จ`, "success");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setUpdating(null);
        }
    };

    const handleReject = async (user: UserItem, displayName: string) => {
        if (!user.pendingRequestId) return;
        const confirmed = await confirmDialog({ title: "ยืนยันปฏิเสธคำร้อง?", text: `ปฏิเสธคำร้องขอสิทธิ์ของ ${displayName} — ไม่สามารถย้อนกลับได้`, confirmText: "ปฏิเสธ", tone: "danger" });
        if (!confirmed) return;

        setUpdating(user.id);
        try {
            const res = await fetch("/api/users", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
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
                refreshNavDots();
                showToast(`ปฏิเสธคำร้องของ ${displayName} แล้ว`, "danger");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setUpdating(null);
        }
    };

    const handleRejectAll = async () => {
        const confirmed = await confirmDialog({
            title: "ปฏิเสธคำร้องทั้งหมด?",
            text: `คำร้องขอสิทธิ์ที่รออนุมัติทั้ง ${queue.length} รายการจะถูกปฏิเสธ ไม่สามารถย้อนกลับได้`,
            confirmText: "ปฏิเสธทั้งหมด",
            tone: "danger",
        });
        if (!confirmed) return;

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
                refreshNavDots();
                showToast(`ปฏิเสธคำร้องทั้งหมด ${queue.length} รายการแล้ว`, "danger");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setRejectingAll(false);
        }
    };

    const staffUsers = users.filter((u) => u.role !== "guest");
    const queue = users.filter((u) => u.pendingRequestId !== null);

    // คำนวณลำดับข้อมูลแบบ Client Sorting (เลียนแบบ Collector)
    const processedUsers = useMemo(() => {
        const base = tab === "queue" ? queue : tab === "staff" ? staffUsers : users;
        return [...base].sort((a, b) => {
            const timeA = new Date(a.registeredAt).getTime();
            const timeB = new Date(b.registeredAt).getTime();
            return isDesc ? timeB - timeA : timeA - timeB;
        });
    }, [tab, users, queue, staffUsers, isDesc]);

    if (!currentUser || currentUser.role !== "admin") {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center w-full max-w-lg mx-auto">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mb-4 border border-red-500/20">
                    <ShieldAlert size={28} className="animate-pulse" />
                </div>
                <h1 className="font-display text-base font-semibold text-text-primary mb-1">สิทธิ์การเข้าถึงถูกจำกัด</h1>
                <p className="text-xs text-text-secondary mb-6">หน้านี้สำหรับผู้ดูแลระบบสูงสุดสูงสุดเท่านั้น</p>
                <button onClick={() => router.push("/map")} className="py-3 px-8 bg-primary text-white font-semibold rounded-2xl text-xs cursor-pointer">
                    กลับหน้าแผนที่
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300" onClick={() => openDropdown && setOpenDropdown(null)}>
            {/* Top Back Navigation Navbar */}
            <div className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-secondary min-h-11">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-primary">จัดการผู้ใช้งาน</h1>
                </div>
                <div className="w-15" />
            </div>

            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                {/* ─── 1. Header Welcome Card ─── */}
                <div className="relative w-full rounded-2xl bg-surface p-5 border border-border flex flex-col gap-4">
                    <div className="flex justify-between items-start w-full">
                        <div>
                            <h1 className="text-xl font-bold tracking-tight text-text-primary">
                                จัดการ<span className="text-primary font-bold">ผู้ใช้งานในระบบ</span>
                            </h1>
                            <p className="text-black font-medium text-xs mt-0.5">อนุมัติสิทธิ์และจัดการบทบาทผู้ใช้งาน</p>
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
                            className="w-full py-3 bg-transparent text-xs text-black outline-hidden placeholder:text-secondary"
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
                                    tab === t ? "bg-primary text-white shadow-xs" : "text-black hover:text-text-primary"
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
                    <div className="flex items-center justify-between text-xs text-black px-0.5 pt-1 border-t border-border">
                        <div className="text-black">พบ {processedUsers.length} บัญชี</div>

                        <div onClick={() => setIsDesc(!isDesc)} className="flex items-center gap-1 cursor-pointer hover:text-text-primary text-black transition-colors py-0.5 select-none">
                            <span>{isDesc ? "ลงทะเบียนล่าสุด" : "ลงทะเบียนเก่าสุด"}</span>
                            <div className="flex items-center text-black">
                                {isDesc ? <ArrowDown size={12} className="text-black font-bold" /> : <ArrowUp size={12} className="text-text-primary font-bold" />}
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
                                {processedUsers.map((user) => {
                                    const cfg = [user.role];
                                    const isUpdating = updating === user.id;
                                    const isOpen = openDropdown === user.id;
                                    const displayName = user.fullName !== "ยังไม่ลงทะเบียนข้อมูล" ? user.fullName : user.lineProfileName;

                                    return (
                                        /* แก้ไข: การ์ดหลักชั้นเดียว ไม่มีการ์ดนอกมาครอบซ้อนแล้ว */
                                        <div key={user.id} className="bg-surface rounded-xl p-3 border border-border transition-all flex flex-col">
                                            {/* ── ส่วนบน: ชื่อผู้ใช้งาน ── */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="px-2 pb-2 text-sm font-semibold text-black truncate max-w-35 sm:max-w-none">{displayName}</h3>
                                            </div>

                                            {/* ── ส่วนกลาง: ข้อมูลประวัติ จัดเป็น Grid 2 คอลัมน์ เว้นระยะเท่ากัน Gap-3 ── */}
                                            <div className="grid grid-cols-2 gap-1 w-full text-xs text-text-muted mb-2">
                                                {/* แสดงเฉพาะสิทธิ์ปัจจุบันในส่วนข้อมูล (ถ้าเป็น Queue ก็โชว์แค่สิทธิ์ปัจจุบันก่อนเปลี่ยน) */}
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-black">
                                                    -
                                                    <SquareChevronUp size={11} className="text-black shrink-0" />
                                                    <span className="text-black font-normal">สิทธิ์ปัจจุบัน: {cfg}</span>
                                                </div>

                                                {/* คอลัมน์ที่ 2: เบอร์โทรศัพท์ (ถ้ามี) */}
                                                {user.phoneNumber && (
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-black">
                                                        -
                                                        <Phone size={11} className="text-black shrink-0" />
                                                        <span className="">{user.phoneNumber}</span>
                                                    </div>
                                                )}

                                                {/* คอลัมน์ที่ 3: วันที่ลงทะเบียน */}
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-black">
                                                    -
                                                    <CalendarDays size={11} className="text-black shrink-0" />
                                                    <span className="">{formatDate(user.registeredAt)}</span>
                                                </div>

                                                {/* คอลัมน์ที่ 4: จำนวนตัวอย่างน้ำ */}
                                                {user.samplesCount > 0 && (
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-black">
                                                        -
                                                        <Layers size={11} className="text-black shrink-0" />
                                                        <span className="">{user.samplesCount} ตัวอย่าง</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* เคสที่ 1: รายการทั่วไป (ไม่ใช่ Queue อนุมัติ) -> โชว์ปุ่ม "จัดการสิทธิ์" เต็มความกว้างด้านล่าง */}
                                            {!(tab === "queue" && user.pendingRequestId && user.requestedRole) && (
                                                <div className="w-full pt-1 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                                                    {isUpdating ? (
                                                        <div className="w-full flex items-center justify-center py-2">
                                                            <RefreshCw size={14} className="animate-spin text-primary" />
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1.5 w-full">
                                                            <button
                                                                onClick={() => setOpenDropdown(isOpen ? null : user.id)}
                                                                className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-surface-subtle hover:bg-surface-muted border border-border rounded-xl text-xs font-bold text-text-secondary transition-all cursor-pointer min-h-9.5"
                                                            >
                                                                <span>จัดการสิทธิ์การใช้งาน</span>
                                                                <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                                            </button>

                                                            {isOpen && (
                                                                <div className="w-full bg-surface border border-border rounded-xl p-1 shadow-sm flex flex-col gap-1">
                                                                    {ROLE_OPTIONS.map((r) => {
                                                                        const rc = [r];
                                                                        const isCurrent = user.role === r;
                                                                        return (
                                                                            <button
                                                                                key={r}
                                                                                onClick={() => !isCurrent && handleRoleChange(user.id, r)}
                                                                                disabled={isCurrent}
                                                                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer
                                                    ${isCurrent ? "text-text-muted bg-surface-subtle cursor-not-allowed opacity-40" : "text-text-primary hover:bg-surface-subtle"}`}
                                                                            >
                                                                                <span className={`w-2 h-2 rounded-full shrink-0 ${rc}`} />
                                                                                <span>{rc}</span>
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
                                            {tab === "queue" && user.pendingRequestId && user.requestedRole && (
                                                <div className="w-full flex flex-col gap-2.5 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                                                    {/* ชิปแสดงสิทธิ์ที่ต้องการ ย้ายมาดักสายตาแอดมินตรงนี้เพื่อให้ดูง่ายขึ้นมาก */}
                                                    <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-md text-xs font-semibold text-primary border border-primary/20 w-full">
                                                        <span className="text-white font-normal">สิทธิ์ที่ร้องขอเปลี่ยนเป็น: {[user.requestedRole]}</span>
                                                    </div>

                                                    {/* แถวกลุ่มปุ่มกด อนุมัติ / ปฏิเสธ */}
                                                    {isUpdating ? (
                                                        <div className="w-full flex items-center justify-center py-2">
                                                            <RefreshCw size={14} className="animate-spin text-primary" />
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2 w-full">
                                                            <button
                                                                onClick={() => handleApprove(user, displayName)}
                                                                className="flex-1 flex items-center rounded-md justify-center gap-1.5 py-2.5 min-h-9.5 bg-primary  text-white text-xs font-bold transition-all cursor-pointer active:scale-[0.97] whitespace-nowrap"
                                                            >
                                                                <CheckCircle2 size={13} />
                                                                อนุมัติสิทธิ์
                                                            </button>

                                                            <button
                                                                onClick={() => handleReject(user, displayName)}
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
                                })}
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
