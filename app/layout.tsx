/**
 * @file app/layout.tsx
 * @project Water Monitoring Project
 * @module App / Root Layout
 * @description
 * Root layout ของทั้งแอป: กำหนด metadata/viewport (ล็อกซูม, viewport-fit cover สำหรับ LINE LIFF),
 * สคริปต์ตั้งธีมมืด/สว่างก่อน hydrate จาก localStorage เพื่อกันกะพริบ, ด่านบังคับแนวตั้งบนมือถือ
 * (OrientationGuard) และห่อทุกหน้าด้วย LiffProvider + Navbar + DevRoleSwitcher
 * main เว้น padding ล่างเท่าความสูง Navbar + safe-area บนมือถือ และเว้นซ้ายบน desktop
 *
 * Root layout: metadata/viewport, pre-hydration theme script, portrait-only guard
 * for handhelds, and the LiffProvider / Navbar / DevRoleSwitcher shell around every page.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-13, 2026-07-22)
 *
 * @lastModified 2026-08-19 13:04
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-06-09 09:09 by Pachara P. - สร้าง layout พร้อมโครงระบบ
 * - 2026-07-13 10:17 by Nopparut U. - ค่าเริ่มต้นเป็น light mode
 * - 2026-07-13 16:03 by Pachara P. - ปรับประสิทธิภาพและสคริปต์ตั้งธีมก่อน hydrate
 * - 2026-07-17 14:40 by Pachara P. - เพิ่ม DevRoleSwitcher
 * - 2026-08-06 09:13 by Pachara P. - แก้สีเพี้ยนระหว่าง light/dark mode (color-scheme meta)
 * - 2026-08-19 13:04 by Pachara P. - ล็อกหน้าจอแนวตั้งบนมือถือ (OrientationGuard)
 *
 * @notes Server Component; ธีมตั้งด้วย inline script ก่อน React โหลด จึงต้องใช้ suppressHydrationWarning
 * @responsive main: มือถือ padding-bottom = 88px + safe-area / desktop (lg) padding-left 200px สำหรับ Navbar แนวข้าง
 * @see docs/skills/SKILL_line_liff_ux.md
 * @license Private / Proprietary
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LiffProvider from "@/components/LiffProvider";
import DevRoleSwitcher from "@/components/DevRoleSwitcher";
import { Smartphone } from "lucide-react";

export const metadata: Metadata = {
    title: "ระบบตรวจสอบคุณภาพน้ำ | Water Quality TestKit",
    description: "ระบบตรวจสอบและบันทึกข้อมูลคุณภาพน้ำทะเลชายฝั่ง ผ่าน LINE LIFF",
    keywords: "คุณภาพน้ำ, water quality, ตรวจสอบน้ำ, LINE LIFF, ประมง",
    other: {
        "color-scheme": "light dark",
        "supported-color-schemes": "light dark",
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#eff7f9" },
        { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
    ],
};

/** ฉากทึบเต็มจอบอกให้หมุนเครื่องเป็นแนวตั้ง แสดงเฉพาะจอแคบกว่า lg ที่อยู่ในแนวนอน */
function OrientationGuard() {
    return (
        <aside
            aria-label="orientation-warning"
            className="hidden max-lg:landscape:flex fixed inset-0 z-99999 bg-slate-950/95 text-white flex-col items-center justify-center p-6 text-center backdrop-blur-md select-none"
        >
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4 animate-bounce">
                <Smartphone size={32} className="rotate-90 text-primary" />
            </div>
            <h2 className="text-lg font-bold">กรุณาใช้งานในแนวตั้ง</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">ระบบถูกออกแบบมาสำหรับการแสดงผลในแนวตั้งเพื่อความถูกต้องของการแสดงผลแผนที่และข้อมูล</p>
        </aside>
    );
}

/**
 * Root layout ห่อทุกหน้า
 *
 * @param children - หน้าปัจจุบัน
 */
export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="th" suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              try {
                var localTheme = localStorage.getItem('theme');
                var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var isDark = localTheme === 'dark' || (!localTheme && systemDark);
                
                if (isDark) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch (_) {}
            `,
                    }}
                />
            </head>
            <body className="overscroll-none bg-surface-muted text-text-primary" suppressHydrationWarning>
                {/* ดักจับและบังคับหน้าจอแนวตั้งเฉพาะหน้าจอมือถือ/แท็บเล็ต */}
                <OrientationGuard />

                <LiffProvider>
                    <main className="min-h-screen flex flex-col justify-between lg:pl-50 lg:pb-0!" style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom))" }}>
                        <div className="flex-1 w-full flex flex-col">
                            {children}
                        </div>
                        <Footer />
                    </main>
                    <Navbar />
                    <DevRoleSwitcher />
                </LiffProvider>
            </body>
        </html>
    );
}
