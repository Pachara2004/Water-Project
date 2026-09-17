/**
 * @file app/manage/page.tsx
 * @project Water Monitoring Project
 * @module App / Manage
 * @description
 * หน้าจัดการระบบ (/manage): โปรไฟล์ผู้ใช้, เมนูผู้ดูแล (พร้อมจำนวนคำร้องค้างจาก /api/manage/pending-count
 * รีเฟรชเมื่อโฟกัสหน้า), เมนูทั่วไป, การตั้งค่า และปุ่มออกจากระบบ (ยืนยันผ่าน SweetAlert, liff.logout
 * เฉพาะนอก LINE app, ล้าง hasLoggedIntoApp แล้ว reload เป็น guest) เลือก view mobile/desktop ตามจอ
 *
 * Manage route: profile, admin menus with pending counts, general menus, settings and logout.
 * Owns the state and handlers; the mobile/desktop views only lay them out.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-06-22
 * @version 1.0.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-06-25 – 2026-09-10)
 *
 * @lastModified 2026-09-10 12:16
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-06-22 14:28 by Nopparut U. - สร้างหน้า admin panel
 * - 2026-07-14 13:39 by Pachara P. - เพิ่มระบบออกจากระบบ
 * - 2026-07-15 12:00 by Nopparut U. - จำนวนคำร้องค้างบนเมนูแอดมิน
 * - 2026-07-23 13:37 by Nopparut U. - แยก view เป็น desktop/mobile
 * - 2026-09-10 12:16 by Pachara P. - แก้ล็อกอิน/ล็อกเอาต์ผ่าน LINE browser
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @auth admin เห็นเมนูผู้ดูแล; guest เห็นปุ่มเข้าสู่ระบบแทนโปรไฟล์
 * @license Private / Proprietary
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/useToast";
import { useMediaQuery } from "@/hooks/useMediaQuery";
// อิมพอร์ตฟังก์ชันแจ้งเตือนออกจากระบบจากไฟล์ config กลาง
import { confirmLogoutAlert, loadingDialog, closeDialog } from "@/lib/swal";
import ManageMobile from "./manageMobile";
import ManageDesktop from "./manageDesktop";

/** เจ้าของ state หน้าจัดการระบบ เลือก view ตามจอ */
export default function ManagePage() {
    const { currentUser } = useAppStore();
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

    // ฟังก์ชันจัดการออกจากระบบ (สั่ง liff.logout + เคลียร์ session + นำทางตรงไป /map)
    const handleLogout = async () => {
        // 1. เรียก Alert ขึ้นมาถามผู้ใช้งานก่อน
        const result = await confirmLogoutAlert();

        // ถ้าผู้ใช้กด ยกเลิก หรือ ปิดหน้าต่าง ให้หยุดทำงานทันที
        if (!result.isConfirmed) return;

        // 2. แสดงสถานะกำลังโหลดทันทีเพื่อบังหน้าจอ ป้องกันไม่ให้เห็นการกระพริบของหน้าหรือ Footer
        loadingDialog("กำลังออกจากระบบ...", "กรุณารอสักครู่");

        try {
            // เช็คว่าเป็น LINE Browser หรือไม่ (ใช้ User-Agent ช่วยดักจับในกรณีที่ใช้ลิงก์ Cloudflare ตรงๆ)
            const isLineApp = liff.isInClient() || navigator.userAgent.includes("Line");

            if (!isLineApp && liff.isLoggedIn()) {
                liff.logout(); // ล้างโทเคนของ LINE ออกหมด (ทำได้เฉพาะในเบราว์เซอร์ปกติ)
            }
            
            // ลบสถานะการเข้าสู่ระบบออก เพื่อให้กลับไปเป็น Guest อย่างสมบูรณ์เมื่อโหลดใหม่
            localStorage.removeItem("hasLoggedIntoApp");
            
            // นำทางตรงไปยัง /map ด้วย replace เพื่อให้แอปโหลดใหม่ในสถานะ Guest โดยไม่ค้างประวัติย้อนกลับ
            // ไม่เรียก setUser(null) ตรงนี้ เพื่อไม่ให้ React re-render หน้า /manage เป็นสถานะ Guest (ปุ่มเขียว/Footer) ก่อนย้ายหน้า
            window.location.replace("/map");
        } catch (err) {
            closeDialog();
            showToast("เกิดข้อผิดพลาดในการออกจากระบบ", "danger");
        }
    };

    const isAdmin = currentUser?.role === "admin";
    if (currentUser === undefined) return null;

    const props = { currentUser, isAdmin, pendingCounts, showEdit, setShowEdit, handleLogout, router, showToast, toastElement };
    return isMobile ? <ManageMobile {...props} /> : <ManageDesktop {...props} />;
}
