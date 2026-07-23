"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { confirmDialog } from "@/lib/swal";
import { refreshNavDots } from "@/lib/navEvents";
import { useToast } from "@/components/useToast";
import { useAppStore } from "@/lib/store";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ShieldAlert } from "lucide-react";
import { type Role, type UserItem, ROLE_CONFIG } from "@/components/manage/usersHelpers";
import UsersMobile from "./usersMobile";
import UsersDesktop from "./usersDesktop";

export default function AdminUsersPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const isMobile = useMediaQuery("(max-width: 767px)");

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
                showToast(`อัปเดตสิทธิ์ ${name} เป็น ${ROLE_CONFIG[role].label} สำเร็จ`, "success");
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
            text: `อนุมัติ ${displayName} เป็นสิทธิ์ ${ROLE_CONFIG[user.requestedRole].label}`,
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
                showToast(`อนุมัติ ${displayName} เป็นสิทธิ์ ${ROLE_CONFIG[user.requestedRole!].label} สำเร็จ`, "success");
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

    const staffUsers = users.filter((u) => u.role !== "guest");
    const queue = users.filter((u) => u.pendingRequestId !== null);

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

    const props = {
        router,
        toastElement,
        stats,
        tab,
        setTab,
        search,
        setSearch,
        isDesc,
        setIsDesc,
        processedUsers,
        updating,
        openDropdown,
        setOpenDropdown,
        rejectingAll,
        handleRejectAll,
        handleRoleChange,
        handleApprove,
        handleReject,
    };

    return isMobile ? <UsersMobile {...props} /> : <UsersDesktop {...props} />;
}
