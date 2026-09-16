/**
 * @file app/terms/page.tsx
 * @project Water Monitoring Project
 * @module App / Terms
 * @description
 * หน้าข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัว (/terms) อยู่นอก /manage เพื่อให้เปิดอ่านได้
 * โดยไม่ต้องล็อกอิน (LINE User Data Policy กำหนดให้เข้าถึงนโยบายได้ตลอดเวลา) เลือก mobile/desktop
 * ตามจอ ปุ่มย้อนกลับใช้ router.back() ถ้าไม่มีประวัติ (เปิดจาก URL ตรง) จะกลับหน้าแรกแทน
 *
 * Public terms & privacy route (no login required). Back button falls back to / when there is no history.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-15
 * @version 1.0.0
 *
 * @lastModified 2026-09-15 14:15
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-09-15 14:15 by Nopparut U. - สร้างหน้าข้อตกลงพร้อม flow ยอมรับข้อตกลงก่อนเก็บ LINE uid
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @responsive breakpoint 767px
 * @license Private / Proprietary
 */

"use client";

import { useRouter } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import TermsMobile from "./termsMobile";
import TermsDesktop from "./termsDesktop";

/** เลือก view ตามจอและจัดการปุ่มย้อนกลับ */
export default function TermsPage() {
    const router = useRouter();
    const isMobile = useMediaQuery("(max-width: 767px)");

    // เปิดจาก URL ตรงหรือลิงก์ภายนอกจะไม่มีประวัติให้ย้อน → กลับหน้าแรกแทน
    const handleBack = () => {
        if (window.history.length > 1) router.back();
        else router.push("/");
    };

    return isMobile ? <TermsMobile onBack={handleBack} /> : <TermsDesktop onBack={handleBack} />;
}
