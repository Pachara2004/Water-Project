/**
 * @file next.config.ts
 * @project Water Monitoring Project
 * @module Config / Next.js
 * @description
 * การตั้งค่า Next.js: origin ที่อนุญาตให้ต่อ dev server (LAN และ Cloudflare tunnel สำหรับทดสอบใน LINE),
 * อนุญาตรูปจากทุก host https, ซ่อนปุ่ม Next.js DevTools มุมจอตอน dev และเปิด Turbopack
 *
 * Next.js configuration: allowed dev origins, remote image patterns, dev indicators off, Turbopack.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-11)
 *
 * @lastModified 2026-09-14 09:27
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-06-09 09:09 by Pachara P. - สร้างพร้อมโครงระบบ
 * - 2026-07-02 10:10 by Pachara P. - อนุญาตรูปจาก remote host
 * - 2026-09-07 12:02 by Pachara P. - เพิ่ม allowedDevOrigins สำหรับ tunnel
 * - 2026-09-11 16:25 by Nopparut U. - ปิดปุ่ม Next.js DevTools ตอน dev (error overlay ยังขึ้นปกติ)
 * - 2026-09-14 09:27 by Pachara P. - ปรับ config
 *
 * @warning โดเมน trycloudflare.com ใน allowedDevOrigins เปลี่ยนทุกครั้งที่เปิด tunnel ใหม่ ต้องแก้ตาม
 * @license Private / Proprietary
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // บล็อกคำสั่งเช็กความปลอดภัย HMR
    allowedDevOrigins: ["localhost:3000", "192.168.137.1:3000", "arise-result-adjustments-calendar.trycloudflare.com"],

    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
    },
    // ซ่อนปุ่ม N (Next.js DevTools) มุมจอตอน dev; error overlay ยังขึ้นตามปกติ
    devIndicators: false,
    turbopack: {},
};

export default nextConfig;
