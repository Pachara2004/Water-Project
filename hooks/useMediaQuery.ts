/**
 * @file hooks/useMediaQuery.ts
 * @project Water Monitoring Project
 * @module Hooks / Responsive
 * @description
 * Hook อ่านผล CSS media query แบบ reactive ด้วย useSyncExternalStore: subscribe ที่ matchMedia
 * อ่านค่าจริงบนเบราว์เซอร์ และคืน false ตอน SSR ทุกหน้า page.tsx ใช้ตัวนี้เลือก view mobile/desktop
 *
 * Reactive media-query hook built on useSyncExternalStore; returns false during SSR.
 * Used by every page.tsx to pick the mobile or desktop view.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-23
 * @version 1.0.0
 *
 * @lastModified 2026-07-23 09:22
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-07-23 09:22 by Pachara P. - สร้าง hook ตอนแยก UI เป็น desktop/mobile
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @notes server snapshot เป็น false เสมอ หน้าจึง render เป็น desktop ก่อนแล้วสลับหลัง hydrate บนมือถือ
 * @license Private / Proprietary
 */

"use client";

import { useSyncExternalStore } from "react";

/**
 * ตรวจว่า media query ตรงกับจอปัจจุบันหรือไม่ อัปเดตเองเมื่อขนาดจอเปลี่ยน
 *
 * @param query - media query เช่น `"(max-width: 767px)"`
 * @returns true เมื่อตรง; false ตอน SSR
 *
 * @example
 * ```ts
 * const isMobile = useMediaQuery("(max-width: 767px)");
 * ```
 */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        // 1. Subscribe function: ติดตามการเปลี่ยนแปลงของหน้าจอ
        (onStoreChange) => {
            if (typeof window === "undefined") return () => {};

            const media = window.matchMedia(query);
            media.addEventListener("change", onStoreChange);

            return () => media.removeEventListener("change", onStoreChange);
        },
        // 2. Client snapshot: อ่านค่าจริงบน Browser
        () => {
            if (typeof window === "undefined") return false;
            return window.matchMedia(query).matches;
        },
        // 3. Server snapshot: ค่าเริ่มต้นบน Server (SSR)
        () => false,
    );
}
