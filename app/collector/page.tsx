/**
 * @file app/collector/page.tsx
 * @project Water Monitoring Project
 * @module App / Collector
 * @description
 * หน้ารายการตัวอย่างน้ำของผู้เก็บ (/collector) กันสิทธิ์ตอน render (เฉพาะ collector/admin;
 * officer ถูกเด้งไป /map) ไม่ใช่ใน useEffect อย่างเดียว เพื่อไม่ให้คนไม่มีสิทธิ์เห็นเนื้อหาแวบหนึ่ง
 * state ตัวกรอง/ค้นหา/แบ่งหน้าอยู่ใน useCollectorFilters แล้วส่งให้ view mobile/desktop
 *
 * Collector route: render-time role guard, then hands useCollectorFilters state to the mobile/desktop view.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-06-18 – 2026-07-27)
 *
 * @lastModified 2026-07-27 16:01
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-06-09 09:09 by Pachara P. - สร้างหน้า collector พร้อมโครงระบบ
 * - 2026-06-18 14:22 by Nopparut U. - เพิ่มหน้าประวัติรายรายการ
 * - 2026-07-13 16:19 by Nopparut U. - ส่งคำร้องตรวจสอบเมื่อ confidence ต่ำ
 * - 2026-07-23 09:22 by Pachara P. - แยก view เป็น desktop/mobile
 * - 2026-07-27 13:38 by Nopparut U. - แบ่งหน้าฝั่ง server และย้าย logic ไป useCollectorFilters
 * - 2026-07-27 16:01 by Nopparut U. - กัน officer เข้าหน้านี้
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @auth collector และ admin เท่านั้น; guest ยังเห็นหน้าได้ (hook จะไม่ยิง API)
 * @license Private / Proprietary
 */

"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useCollectorFilters } from "@/lib/hooks/useCollectorFilters";

import CollectorMobile from "./collectorMobile";
import CollectorDesktop from "./collectorDesktop";

/** กันสิทธิ์แล้วเลือก view ตามจอ */
export default function CollectorDashboardPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const isMobile = useMediaQuery("(max-width: 767px)");

    // officer (ผู้บริหาร) ไม่มีสิทธิ์หน้านี้ — ดูภาพรวมได้ที่ /dashboard เท่านั้น
    // ต้องคำนวณตอน render ไม่ใช่ใน useEffect เพราะ effect ทำงานหลัง paint แรก
    // ถ้าเช็คใน effect อย่างเดียว คนไม่มีสิทธิ์จะเห็นเนื้อหาแวบหนึ่งก่อนโดนเด้งออก
    const isAllowed = !currentUser || currentUser.role === "collector" || currentUser.role === "admin";

    useEffect(() => {
        if (!isAllowed) router.push("/map");
    }, [isAllowed, router]);

    // ส่ง currentUser เป็น null เมื่อไม่มีสิทธิ์ เพื่อให้ hook ข้ามการยิง /api/samples ที่ยังไงก็ได้ 403
    const filterState = useCollectorFilters({ currentUser: isAllowed ? currentUser : null });

    if (!isAllowed) return null;

    return isMobile ? <CollectorMobile {...filterState} /> : <CollectorDesktop {...filterState} />;
}
