"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Settings, FileScan, Sparkles, BarChart2, User } from "lucide-react";
import { useAppStore } from "@/lib/store";

export default function Navbar() {
    const pathname = usePathname();
    const { currentUser } = useAppStore();

    const getNavItems = () => {
        const items = [{ href: "/map", label: "แผนที่พิกัดสถานี", icon: Map }];

        if (!currentUser) return items;

        if (currentUser.role === "collector" || currentUser.role === "admin") {
            items.push({
                href: "/collector",
                label: "ตรวจคุณภาพน้ำ",
                icon: FileScan,
            });
        }

        if (currentUser.role === "collector" || currentUser.role === "officer" || currentUser.role === "admin") {
            items.push({
                href: "/dashboard",
                label: "แดชบอร์ด",
                icon: BarChart2,
            });
        }

        if (currentUser.role === "admin" || currentUser.role === "collector" || currentUser.role === "officer") {
            items.push({
                href: "/manage",
                label: "จัดการข้อมูล",
                icon: Settings,
            });
        }

        return items;
    };

    const navItems = getNavItems();

    return (
        <>
            {/* ── Mobile / Tablet: docked bottom bar ─────────────────────── */}
            <nav className="lg:hidden fixed bottom-0 left-0 w-full z-[950] bg-white transition-all duration-300" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                <div className="flex items-center justify-around h-18 px-4 w-full mx-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                        const Icon = item.icon;

                        const displayLabel = item.label === "แผนที่พิกัดสถานี" ? "แผนที่" : item.label === "ตรวจคุณภาพน้ำ" ? "ตรวจน้ำ" : item.label === "จัดการข้อมูล" ? "จัดการ" : item.label;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-1 flex-col items-center justify-center h-full rounded-xl transition-all duration-300 relative active:scale-[0.93] ${
                                    isActive ? "text-primary font-black" : "text-text-muted hover:text-text-primary"
                                }`}
                            >
                                {isActive && <div className="absolute inset-x-0 inset-y-1 bg-primary/20 rounded-2xl shadow-sm" />}
                                <Icon
                                    size={20}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className={`transition-transform duration-300 ${isActive ? "-translate-y-0.5 text-primary" : "group-hover:-translate-y-0.5"}`}
                                />
                                <span className={`text-[10px] mt-1 transition-all duration-300 whitespace-nowrap ${isActive ? "text-primary" : "font-medium"}`}>{displayLabel}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* ── Desktop: Left Sidebar ล็อกความกว้างถาวร ── */}
            <nav className="hidden lg:flex fixed left-0 top-0 h-full w-50 z-95 flex-col justify-between p-3 bg-surface backdrop-blur-xl shadow-sm">
                <div className="flex flex-col gap-6 w-full">
                    {/* Logo Brand Group */}
                    <div className="flex items-center justify-center gap-3 px-1.5 py-1 min-h-[40px] w-full">
                        <div className="flex flex-col leading-none">
                            <span className="font-black text-sm text-text-primary tracking-tight whitespace-nowrap">Water Quality</span>
                        </div>
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
                                    className={`group flex items-center h-11 rounded-xl font-semibold text-xs transition-all duration-200 active:scale-[0.98] overflow-hidden w-full px-4 gap-3.5 relative ${
                                        isActive ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
                                    }`}
                                >
                                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                                    <span className="whitespace-nowrap truncate">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom Section: User Profile & Actions */}
                {currentUser && (
                    <div className="flex flex-col gap-2 pt-4 border-t border-border/60 w-full">
                        {/* User Info Block */}
                        <div className="flex items-center bg-surface-subtle/50 rounded-xl px-3 h-12 w-full overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <User size={16} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col min-w-0 ml-3 leading-tight">
                                <span className="text-xs font-semibold text-text-primary truncate">{currentUser.firstName || currentUser.lineProfileName}</span>
                                <span className="text-[9px] text-text-muted font-semibold uppercase tracking-wider mt-0.5 truncate">{currentUser.role}</span>
                            </div>
                        </div>
                    </div>
                )}
            </nav>
        </>
    );
}
