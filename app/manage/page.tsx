"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/useToast";
import { useMediaQuery } from "@/hooks/useMediaQuery";
// อิมพอร์ตฟังก์ชันยืนยันออกจากระบบจากไฟล์ config กลาง
import { confirmLogoutAlert } from "@/lib/swal";
import ManageMobile from "./manageMobile";
import ManageDesktop from "./manageDesktop";

export default function ManagePage() {
    const { currentUser, setUser } = useAppStore(); // ดึง setUser มาใช้เคลียร์สเตทเมื่อล็อกเอาต์
    const router = useRouter();
    const [showEdit, setShowEdit] = useState(false);
    const { showToast, toastElement } = useToast();
    const isMobile = useMediaQuery("(max-width: 767px)");

    // จำนวนคำร้องค้างต่อเมนู (ตรวจสอบ confidence ต่ำ / ขอสิทธิ์ผู้ใช้) — ใช้ป้อนจุดแดงบนเมนูแอดมิน
    const [pendingCounts, setPendingCounts] = useState<{ reviewPendingCount: number; rolePendingCount: number }>({ reviewPendingCount: 0, rolePendingCount: 0 });

    const fetchPendingCounts = useCallback(async () => {
        if (currentUser?.role !== "admin") return;
        const token = liff.getAccessToken();
        if (!token) return;
        try {
            const res = await fetch("/api/manage/pending-count", { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) return;
            const data = await res.json();
            setPendingCounts({ reviewPendingCount: data.reviewPendingCount ?? 0, rolePendingCount: data.rolePendingCount ?? 0 });
        } catch (err) {
            console.error("Failed to fetch pending counts:", err);
        }
    }, [currentUser?.role]);

    useEffect(() => {
        fetchPendingCounts();
        window.addEventListener("focus", fetchPendingCounts);
        return () => window.removeEventListener("focus", fetchPendingCounts);
    }, [fetchPendingCounts]);

    // ฟังก์ชันจัดการออกจากระบบ (สั่ง liff.logout + เคลียร์ Store + ส่งกลับหน้าแรก)
    const handleLogout = async () => {
        // 1. เรียก Alert ขึ้นมาถามผู้ใช้งานก่อน
        const result = await confirmLogoutAlert();

        // ถ้าผู้ใช้กด ยกเลิก หรือ ปิดหน้าต่าง ให้หยุดทำงานทันที
        if (!result.isConfirmed) return;

        // 2. ถ้าผู้ใช้กด "ออกจากระบบ" (ยืนยัน) ให้ทำตามกระบวนการเดิม
        try {
            if (liff.isLoggedIn()) {
                liff.logout();
            }
            setUser(null);
            showToast("ออกจากระบบเรียบร้อยแล้ว", "success");
            router.replace("/");
        } catch {
            showToast("เกิดข้อผิดพลาดในการออกจากระบบ", "danger");
        }
    };

    const isAdmin = currentUser?.role === "admin";
    if (currentUser === undefined) return null;

    const props = { currentUser, isAdmin, pendingCounts, showEdit, setShowEdit, handleLogout, router, showToast, toastElement };
    return isMobile ? <ManageMobile {...props} /> : <ManageDesktop {...props} />;
}
