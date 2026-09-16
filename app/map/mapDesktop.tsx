/**
 * @file mapDesktop.tsx
 * @project Water Monitoring Project
 * @module App / Map
 * @description
 * Wrapper แผนที่สำหรับ desktop: กล่อง fixed h-dvh กว้าง 100% - 200px (หลบ Navbar แนวข้าง) แล้ว render MapView โหมด explorer
 * MapView โหลดแบบ dynamic ssr:false เพราะ Leaflet ต้องใช้ window พร้อม spinner ระหว่างโหลด
 *
 * Desktop map wrapper: fixed viewport box sized around the navbar, hosting MapView (dynamically imported, no SSR).
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
 * - 2026-07-23 09:35 by Pachara P. - แยกออกจาก page.tsx เป็น wrapper desktop
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @see docs/skills/SKILL_googlemap_uxui.md
 * @license Private / Proprietary
 */

"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/map/MapView"), {
    ssr: false,
    loading: () => (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-muted/60 backdrop-blur-xs">
            <div className="flex flex-col items-center gap-3">
                <div className="w-9 h-9 border-[3px] border-primary border-t-transparent rounded-full animate-spin will-change-transform" />
                <span className="text-xs text-text-muted font-semibold tracking-wide">กำลังโหลดแผนที่...</span>
            </div>
        </div>
    ),
});

/** กรอบแผนที่ desktop ไม่รับ props */
export default function MapDesktop() {
    return (
        <div className="fixed top-0 w-[calc(100%-200px)] left-50 h-dvh overflow-hidden">
            <div className="w-full h-full relative">
                <MapView mode="explorer" />
            </div>
        </div>
    );
}
