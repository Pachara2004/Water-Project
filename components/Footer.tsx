/**
 * @file Footer.tsx
 * @project Water Monitoring Project
 * @module UI / Layout
 * @description
 * ส่วนท้ายของหน้า (Footer) แสดงข้อมูลผู้พัฒนาและการติดต่อ:
 * "พัฒนาโดย Eastern Software Park : ESP" พร้อมอีเมลและเบอร์โทรศัพท์
 * ซ่อนอัตโนมัติบนหน้า /map เพื่อป้องกันการแย่งพื้นที่และการเลื่อนของแผนที่แบบเต็มจอ
 *
 * App footer displaying developer credits and contact information:
 * "Powered by Eastern Software Park : ESP". Automatically hidden on /map.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-09-16
 * @version 1.0.0
 *
 * @client-side ทำงานฝั่ง Client ('use client') เพราะใช้ usePathname()
 * @license Private / Proprietary
 */

"use client";

import { usePathname } from "next/navigation";
import { Mail, Phone, ShieldCheck } from "lucide-react";

export default function Footer() {
    const pathname = usePathname();

    // ซ่อนบนหน้า /map และ root route (/) เพื่อรักษาการแสดงผลแผนที่แบบเต็มหน้าจอและป้องกัน footer โผล่ช่วงเปลี่ยนหน้า
    if (pathname === "/map" || pathname === "/") return null;

    // บนมือถือแสดงเฉพาะหน้าจัดการระบบ (/manage) หน้าเดียวเท่านั้น ส่วนบน desktop แสดงทุกหน้า (ยกเว้น /map และ /)
    const isManagePage = pathname === "/manage";

    return (
        <footer
            className={`w-full mt-auto border-t border-border bg-card-general backdrop-blur-xs text-xs text-text transition-colors ${
                isManagePage ? "block" : "hidden lg:block"
            }`}
        >
            <div className="w-full max-w-7xl mx-auto p-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                {/* ข้อมูลผู้พัฒนา */}
                <div className="flex flex-row items-center gap-1.5 sm:gap-2">
                    <span className="text-xs uppercase tracking-wider font-medium text-text">
                        พัฒนาโดย
                    </span>
                    <img
                        src="/ESP-logo.png"
                        alt="Eastern Software Park : ESP"
                        className="h-5 sm:h-5 object-contain"
                    />
                </div>

                {/* ช่องทางติดต่อ */}
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 text-xs sm:text-xs text-text">
                    <a
                        className="inline-flex items-center gap-1.5  py-1 px-1.5 rounded-md"
                        title="ส่งอีเมลหา ESP"
                    >
                        <Mail size={13} className="text-primary shrink-0" />
                        <span>esp@informatics.buu.ac.th</span>
                    </a>
                    <span className="hidden sm:inline text-border font-light">|</span>
                    <a
                        className="inline-flex items-center gap-1.5  py-1 px-1.5 rounded-md "
                        title="โทรศัพท์ติดต่อ ESP"
                    >
                        <Phone size={13} className="text-primary shrink-0" />
                        <span>+66 99 394 1175</span>
                    </a>
                </div>
            </div>
        </footer>
    );
}
