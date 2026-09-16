/**
 * @file app/dashboard/page.tsx
 * @project Water Monitoring Project
 * @module App / Dashboard
 * @description
 * หน้าแดชบอร์ด (/dashboard) เรียก useDashboardAnalytics ครั้งเดียวที่นี่แล้วส่ง state ทั้งก้อน
 * ให้ DashboardMobile หรือ DashboardDesktop ตามจอ เพื่อไม่ให้ตัวกรองและข้อมูลรีเซ็ตเมื่อ resize
 * ข้าม breakpoint แล้ว React unmount/mount view ใหม่
 *
 * Dashboard route; owns the single useDashboardAnalytics instance and passes its state to the mobile/desktop view.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-19
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-08 – 2026-07-23)
 *
 * @lastModified 2026-07-23 13:00
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-06-19 14:25 by Pachara P. - สร้างหน้าแดชบอร์ด
 * - 2026-06-22 14:23 by Pachara P. - เพิ่มการ export ข้อมูล
 * - 2026-07-08 15:13 by Nopparut U. - เพิ่มกราฟความสัมพันธ์
 * - 2026-07-10 12:05 by Nopparut U. - ปรับการกรองให้ครอบคลุมขึ้น
 * - 2026-07-23 10:04 by Nopparut U. - แยก view เป็น desktop/mobile และย้าย logic ไป useDashboardAnalytics
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @responsive breakpoint 767px
 * @license Private / Proprietary
 */

"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useDashboardAnalytics } from "@/lib/hooks/useDashboardAnalytics";
import DashboardMobile from "./dashboardMobile";
import DashboardDesktop from "./dashboardDesktop";

/** เจ้าของ state แดชบอร์ด เลือก view ตามจอ */
export default function DashboardPage() {
    const isMobile = useMediaQuery("(max-width: 767px)");
    const analyticsState = useDashboardAnalytics();
    return isMobile ? <DashboardMobile {...analyticsState} /> : <DashboardDesktop {...analyticsState} />;
}
