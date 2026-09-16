/**
 * @file app/map/page.tsx
 * @project Water Monitoring Project
 * @module App / Map
 * @description
 * หน้าแผนที่ (/map) เลือก render MapMobile หรือ MapDesktop ตามความกว้างจอ (breakpoint 1024px)
 * ทั้งสองตัวใช้ MapView โหมด explorer เหมือนกัน ต่างกันแค่กรอบตำแหน่งที่หลบ Navbar
 *
 * Map route; picks the mobile or desktop wrapper by viewport width.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.0.0
 *
 * @lastModified 2026-07-23 09:35
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-06-09 09:09 by Pachara P. - สร้างหน้าแผนที่พร้อมโครงระบบ
 * - 2026-07-13 16:03 by Pachara P. - ปรับประสิทธิภาพ
 * - 2026-07-23 09:35 by Pachara P. - แยกเป็น mapMobile / mapDesktop
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @responsive breakpoint 1023px (ตรงกับจุดที่ Navbar ย้ายไปเป็นแถบข้างที่ lg)
 * @license Private / Proprietary
 */

"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import MapMobile from "./mapMobile";
import MapDesktop from "./mapDesktop";

/** เลือก wrapper ตามขนาดจอ */
export default function MapPage() {
    const isMobile = useMediaQuery("(max-width: 1023px)");

    return isMobile ? <MapMobile /> : <MapDesktop />;
}
