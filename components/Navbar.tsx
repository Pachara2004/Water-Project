"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Settings, FileScan, BarChart2, User } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useMemo } from "react";

// ดึงการประกาศ Mapping ข้อความออกมาข้างนอก เพื่อไม่ให้สร้างขึ้นใหม่ทุกรอบการเรนเดอร์
const MOBILE_LABEL_MAP: Record<string, string> = {
    แผนที่พิกัดสถานี: "แผนที่",
    ตรวจคุณภาพน้ำ: "ตรวจน้ำ",
    จัดการข้อมูล: "จัดการ",
};

export default function Navbar() {
    const pathname = usePathname();

    const currentUser = useAppStore((state) => state.currentUser);
    const userRole = currentUser?.role;

    const navItems = useMemo(() => {
        // 1. เริ่มต้นด้วย แผนที่ เป็นรายการแรกเสมอ
        const items = [{ href: "/map", label: "แผนที่พิกัดสถานี", icon: Map }];

        // 2. ถ้ามี Role ระดับต่างๆ ให้สอดแทรกเมนูการทำงานเข้าไปตรงกลางก่อน
        if (userRole === "collector" || userRole === "admin") {
            items.push({
                href: "/collector",
                label: "ตรวจคุณภาพน้ำ",
                icon: FileScan,
            });
        }

        if (userRole === "collector" || userRole === "officer" || userRole === "admin") {
            items.push({
                href: "/dashboard",
                label: "แดชบอร์ด",
                icon: BarChart2,
            });
        }

        // 3. การันตี Push "จัดการข้อมูล" (ตั้งค่า) ปิดท้ายแถวเสมอ ไม่ว่าจะมีสิทธิ์ใดๆ หรือไม่มีสิทธิ์ก็ตาม
        items.push({
            href: "/manage",
            label: "จัดการข้อมูล",
            icon: Settings,
        });

        return items;
    }, [userRole]);

    return (
        <>
            {/* ── Mobile / Tablet: docked bottom bar */}
            <nav className="lg:hidden fixed bottom-0 left-0 w-full z-950 bg-surface" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                <div className="flex items-center justify-around h-20 px-4 w-full mx-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                        const Icon = item.icon;
                        const displayLabel = MOBILE_LABEL_MAP[item.label] || item.label;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-1 flex-col items-center justify-center h-full rounded-xl transition-all duration-75 relative active:scale-[0.95] will-change-transform ${
                                    isActive ? "text-primary font-semibold" : "text-text hover:text-text-primary"
                                }`}
                            >
                                {isActive && <div className="absolute inset-x-0 inset-y-1 bg-primary/20 rounded-2xl shadow-sm" />}
                                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={`transition-transform duration-75 ${isActive ? "-translate-y-0.5 text-primary" : ""}`} />
                                <span className={`text-xs mt-1 transition-all duration-75 whitespace-nowrap ${isActive ? "text-primary" : "font-medium"}`}>{displayLabel}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* ── Desktop: Left Sidebar ── */}
            <nav className="hidden lg:flex fixed left-0 top-0 h-full w-50 z-95 flex-col justify-between p-3 inset-shadow-sm shadow-xl bg-surface">
                <div className="flex flex-col gap-6 w-full">
                    <div className="flex items-center justify-center gap-3 px-1.5 py-1 min-h-10 w-full">
                        <span className="leading-none font-bold text-md text-primary whitespace-nowrap">Water Quality</span>
                    </div>

                    {/* Navigation Items */}
                    <div className="flex flex-col gap-1.5 w-full">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`group flex items-center h-11 rounded-xl font-semibold text-xs transition-all duration-150 active:scale-[0.98] will-change-transform overflow-hidden w-full px-4 gap-3.5 relative ${
                                        isActive ? "bg-primary text-white" : "hover:bg-secondary hover:text-text-primary"
                                    }`}
                                >
                                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
                                    <span className="whitespace-nowrap truncate">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom Section: User Profile & Actions */}
                {currentUser && (
                    <div className="border-t border-border/60 pt-3 w-full">
                        <div className="flex items-center bg-secondary/10 rounded-md px-3 h-12 w-full overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center text-primary shrink-0">
                                <User size={16} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col min-w-0 ml-3 leading-tight">
                                <span className="text-xs font-semibold text-text-primary truncate">{currentUser.firstName || currentUser.lineProfileName}</span>
                                <span className="text-[9px] text-text-muted font-semibold uppercase tracking-wider mt-0.5 truncate">{userRole}</span>
                            </div>
                        </div>
                    </div>
                )}
            </nav>
        </>
    );
}
