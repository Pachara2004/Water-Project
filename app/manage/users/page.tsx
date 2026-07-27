"use client";

import { useState, useEffect, useCallback } from "react";
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

    // การแบ่งหน้าเกิดที่ฝั่ง API ทั้งหมด — `users` คือแถวของหน้าปัจจุบันที่กรองและเรียงมาแล้ว
    // `total` เป็นจำนวนหลังกรองทั้งชุด (ไม่ใช่แค่หน้านี้) จึงเอาไปโชว์ "พบ N บัญชี" ได้ตรง
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

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

    // หน่วงคำค้นหาก่อนยิง API — ตอนนี้ทุกตัวอักษรที่พิมพ์คือ query ใหม่ที่ฝั่ง DB ไม่ใช่การกรองในหน่วยความจำ
    const [debouncedSearch, setDebouncedSearch] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 400);
        return () => clearTimeout(timer);
    }, [search]);

    const fetchUsers = useCallback(async () => {
        try {
            const params = new URLSearchParams({ tab, page: String(page), sort: isDesc ? "desc" : "asc" });
            if (debouncedSearch) params.set("search", debouncedSearch);

            const res = await fetch(`/api/users?${params.toString()}`, {
                method: "GET",
                headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
            });
            const data = await res.json();
            if (!res.ok) return;

            setUsers(Array.isArray(data.items) ? data.items : []);
            setTotal(data.total ?? 0);
            setTotalPages(data.totalPages ?? 0);

            // หน้าที่เปิดอยู่อาจหายไปหลังอนุมัติ/ปฏิเสธรายการสุดท้ายของหน้า — เลื่อนไปหน้าสุดท้ายที่ยังมีจริง
            // การ setPage ตรงนี้จะไปกระตุ้น effect ให้ fetch รอบใหม่เอง
            if (data.totalPages > 0 && page > data.totalPages) {
                setPage(data.totalPages);
            } else if (data.totalPages === 0 && page !== 1) {
                setPage(1);
            }
        } catch (e) {
            console.error(e);
        }
    }, [tab, page, isDesc, debouncedSearch]);

    useEffect(() => {
        if (currentUser?.role === "admin") {
            fetchUsers();
            fetchStats();
        }
    }, [currentUser?.role, fetchUsers, fetchStats]);

    /* ตัวกรองทุกตัวย้ายไปทำงานฝั่ง server แล้ว การเปลี่ยนค่าจึงต้องดีดกลับหน้า 1 เสมอ
       ไม่งั้นจะค้างอยู่หน้าที่ชุดผลลัพธ์ใหม่ไม่มี แล้วเห็นรายการว่าง
       ห่อ setter แทนที่จะใช้ effect เพื่อไม่ให้ยิง API ซ้ำสองรอบ (รอบหนึ่งด้วยเลขหน้าเดิม อีกรอบด้วยหน้า 1) */
    const changeTab = (v: "all" | "staff" | "queue") => {
        setTab(v);
        setPage(1);
    };

    const changeSearch = (v: string) => {
        setSearch(v);
        setPage(1);
    };

    const changeSortDirection = (v: boolean) => {
        setIsDesc(v);
        setPage(1);
    };

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
                // ต้องดึงใหม่ทั้งหน้าแทนการแก้แถวในมือ เพราะแถวที่เปลี่ยนสิทธิ์อาจหลุดออกจากแท็บที่เปิดอยู่
                // (เช่น เปลี่ยนจาก collector เป็น guest ขณะอยู่แท็บ "เจ้าหน้าที่") หรือย้ายไปอยู่คนละหน้า
                await Promise.all([fetchUsers(), fetchStats()]);
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
                await Promise.all([fetchUsers(), fetchStats()]);
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
                await Promise.all([fetchUsers(), fetchStats()]);
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
        // ใช้ stats.pending ไม่ใช่จำนวนแถวบนหน้าจอ เพราะตอนนี้หน้าจอโชว์แค่หน้าเดียว
        // แต่ปุ่มนี้ปฏิเสธคำร้อง pending ทั้งระบบ (updateMany ที่ฝั่ง API)
        const confirmed = await confirmDialog({
            title: "ปฏิเสธคำร้องทั้งหมด?",
            text: `คำร้องขอสิทธิ์ที่รออนุมัติทั้ง ${stats.pending} รายการจะถูกปฏิเสธ ไม่สามารถย้อนกลับได้`,
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
                const rejectedCount = stats.pending;
                await Promise.all([fetchUsers(), fetchStats()]);
                refreshNavDots();
                showToast(`ปฏิเสธคำร้องทั้งหมด ${rejectedCount} รายการแล้ว`, "danger");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setRejectingAll(false);
        }
    };

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
        setTab: changeTab,
        search,
        setSearch: changeSearch,
        isDesc,
        setIsDesc: changeSortDirection,
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
    };

    return isMobile ? <UsersMobile {...props} /> : <UsersDesktop {...props} />;
}
