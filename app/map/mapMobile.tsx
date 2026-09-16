/**
 * @file mapMobile.tsx
 * @project Water Monitoring Project
 * @module App / Map
 * @description
 * Wrapper แผนที่สำหรับ mobile: กล่อง fixed สูง 100dvh - 88px - safe-area (หลบ Navbar แนวล่าง) แล้ว render MapView โหมด explorer
 * MapView โหลดแบบ dynamic ssr:false เพราะ Leaflet ต้องใช้ window พร้อม spinner ระหว่างโหลด
 *
 * Mobile map wrapper: fixed viewport box sized around the navbar, hosting MapView (dynamically imported, no SSR).
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.0.0
 *
 * @lastModified 2026-09-07 12:19
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-06-09 09:09 by Pachara P. - สร้างหน้าแผนที่พร้อมโครงระบบ
 * - 2026-07-23 09:35 by Pachara P. - แยกออกจาก page.tsx เป็น wrapper mobile
 * - 2026-09-07 12:19 by Pachara P. - ปรับกรอบให้เข้ากับ BottomSheet ที่แก้ใหม่
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

/** กรอบแผนที่ mobile ไม่รับ props */
export default function MapMobile() {
    return (
        <div className="fixed top-0 left-0 w-full h-[calc(100dvh-88px-env(safe-area-inset-bottom))] overflow-hidden">
            <div className="w-full h-full relative">
                <MapView mode="explorer" />
            </div>
        </div>
    );
}
