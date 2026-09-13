"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, BarChart2, User } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";
import liff from "@line/liff";
import { onNavDotsRefresh } from "@/lib/navEvents";
const SettingsIcon = lazy(() => import("lucide-react").then(mod => ({ default: mod.Settings })));
const FileScanIcon = lazy(() => import("lucide-react").then(mod => ({ default: mod.FileScan })));

// ดึงการประกาศ Mapping ข้อความออกมาข้างนอก เพื่อไม่ให้สร้างขึ้นใหม่ทุกรอบการเรนเดอร์
const MOBILE_LABEL_MAP: Record<string, string> = {
    แผนที่: "แผนที่",
    ตรวจคุณภาพ: "ตรวจคุณภาพ",
    จัดการข้อมูล: "จัดการข้อมูล",
};

export default function Navbar() {
    const pathname = usePathname();

    const currentUser = useAppStore((state) => state.currentUser);
    const userRole = currentUser?.role;

    // จุดแดงแจ้งเตือน: "ตรวจคุณภาพน้ำ" = มีรายการถูกปฏิเสธที่ยังไม่รับทราบของตัวเอง
    //                    "จัดการข้อมูล" = admin มีคำร้องค้าง (ตรวจสอบ confidence ต่ำ + ขอสิทธิ์ผู้ใช้)
    const [navDots, setNavDots] = useState({
        hasUnreadRejection: false,
        hasPendingManageQueue: false,
    });

    const fetchDots = useCallback(async () => {
        if (!currentUser) return;
        const token = liff.getAccessToken();
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };

        // ยิงขนานพร้อมกันด้วย Promise.all
        const fetchNotifications =
            userRole === "collector" || userRole === "admin"
                ? fetch("/api/notifications", { headers })
                      .then((res) => (res.ok ? res.json() : null))
                      .then((data) => !!data && data.unreadCount > 0)
                      .catch(() => false)
                : Promise.resolve(false);

        const fetchPending =
            userRole === "admin"
                ? fetch("/api/manage/pending-count", { headers })
                      .then((res) => (res.ok ? res.json() : null))
                      .then((data) => !!data && data.pendingCount > 0)
                      .catch(() => false)
                : Promise.resolve(false);

        const [unread, pending] = await Promise.all([fetchNotifications, fetchPending]);

        setNavDots({
            hasUnreadRejection: unread,
            hasPendingManageQueue: pending,
        });
    }, [currentUser, userRole]);

    // โหลดตอน mount/เปลี่ยน user + รีเฟรชเมื่อกลับมาโฟกัสหน้าจอ (เช่น สลับแท็บกลับมา)
    // + รีเฟรชทันทีเมื่อหน้าอื่นสั่ง refreshNavDots() หลังอนุมัติ/ปฏิเสธ/รับทราบสำเร็จ
    // (Navbar อยู่ใน layout ไม่ remount ตอนเปลี่ยนหน้า เลยต้องพึ่ง event นี้แทนการ mount ใหม่)
    useEffect(() => {
        let isMounted = true;

        const loadInitialDots = async () => {
            if (!currentUser) return;
            const token = liff.getAccessToken();
            if (!token) return;

            const headers = { Authorization: `Bearer ${token}` };

            const fetchNotifications =
                userRole === "collector" || userRole === "admin"
                    ? fetch("/api/notifications", { headers })
                          .then((res) => (res.ok ? res.json() : null))
                          .then((data) => !!data && data.unreadCount > 0)
                          .catch(() => false)
                    : Promise.resolve(false);

            const fetchPending =
                userRole === "admin"
                    ? fetch("/api/manage/pending-count", { headers })
                          .then((res) => (res.ok ? res.json() : null))
                          .then((data) => !!data && data.pendingCount > 0)
                          .catch(() => false)
                    : Promise.resolve(false);

            const [unread, pending] = await Promise.all([fetchNotifications, fetchPending]);

            // อัปเดตเฉพาะเมื่อ component ยัง mount อยู่
            if (isMounted) {
                setNavDots({
                    hasUnreadRejection: unread,
                    hasPendingManageQueue: pending,
                });
            }
        };

        loadInitialDots();

        // Event listener สำหรับ focus และ custom event ยังคงใช้ fetchDots ปกติ
        window.addEventListener("focus", fetchDots);
        const offNavDotsRefresh = onNavDotsRefresh(fetchDots);

        return () => {
            isMounted = false;
            window.removeEventListener("focus", fetchDots);
            offNavDotsRefresh();
        };
    }, [currentUser, userRole, fetchDots]);

    const navItems = useMemo(() => {
        const items: { href: string; label: string; icon: typeof Map; showDot?: boolean; onClick?: (e: React.MouseEvent) => void }[] = [{ href: "/map", label: "แผนที่", icon: Map }];

        if (userRole === "collector" || userRole === "admin") {
            items.push({
                href: "/collector",
                label: "ตรวจคุณภาพ",
                icon: FileScanIcon,
                showDot: navDots.hasUnreadRejection,
            });
        }

        if (userRole === "collector" || userRole === "officer" || userRole === "admin") {
            items.push({
                href: "/dashboard",
                label: "แดชบอร์ด",
                icon: BarChart2,
            });
        }

        if (!currentUser) {
            items.push({
                href: "#login",
                label: "เข้าสู่ระบบ",
                icon: User,
                onClick: async (e: React.MouseEvent) => {
                    e.preventDefault();

                    // บันทึกว่าผู้ใช้เคยกดปุ่มเข้าสู่ระบบแล้ว
                    localStorage.setItem("hasLoggedIntoApp", "true");

                    const isLineApp = liff.isInClient() || navigator.userAgent.includes("Line");

                    if (isLineApp && liff.isLoggedIn()) {
                        // แทนที่จะโหลดหน้าใหม่แล้วค้าง ให้ยิง API ดึงข้อมูลและอัปเดต State ทันที
                        try {
                            const profile = await liff.getProfile();
                            const response = await fetch("/api/auth", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    accessToken: liff.getAccessToken(),
                                    name: profile.displayName,
                                }),
                            });

                            if (response.ok) {
                                const resData = await response.json();
                                useAppStore.getState().setUser(resData);
                            }
                        } catch (err) {
                            console.error("Auto login via LINE client failed:", err);
                        }
                    } else {
                        liff.login();
                    }
                }
            });
        } else {
            items.push({
                href: "/manage",
                label: "จัดการข้อมูล",
                icon: SettingsIcon,
                showDot: navDots.hasPendingManageQueue,
            });
        }

        return items;
    }, [userRole, currentUser, navDots.hasUnreadRejection, navDots.hasPendingManageQueue]);

    return (
        <>
            {/* ── Mobile / Tablet: docked bottom bar */}
            <nav className="lg:hidden fixed bottom-0 left-0 w-full z-950 bg-card-general" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}>
<div className="flex items-center justify-around h-22 px-4 w-full">
  <Suspense fallback={null}>
    {navItems.map((item) => {
      const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
      const Icon = item.icon;
      const displayLabel = MOBILE_LABEL_MAP[item.label] || item.label;
      return (
        <Link
          key={item.href}
          href={item.href}
          prefetch={true}
          onClick={item.onClick}
          aria-current={isActive ? "page" : undefined}
          className={`group flex flex-1 flex-col items-center justify-center h-full rounded-xl transition-all duration-200 ease-[var(--nav-ease)] relative active:scale-[0.92] will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive ? "text-primary font-semibold" : "text-text hover:text-primary"}`}
        >
          {isActive && <div className="absolute inset-x-0 inset-y-2 bg-primary/20 rounded-2xl" />}
          <div className="relative">
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={`transition-transform duration-75 ${isActive ? "-translate-y-0.5 text-primary" : ""} group-hover:rotate-12`} />
            {item.showDot && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-text-danger rounded-full border-2 border-border-danger" />}
          </div>
          <span className={`text-xs mt-1 transition-all duration-75 whitespace-nowrap ${isActive ? "text-primary" : "font-medium"}`}>{displayLabel}</span>
        </Link>
      );
    })}
  </Suspense>
</div>
            </nav>

            {/* ── Desktop: Left Sidebar ── */}
            <nav className="hidden lg:flex fixed left-0 top-0 h-full w-50 z-95 flex-col justify-between p-3 inset-shadow-sm shadow-sm bg-card-general">
                <div className="flex flex-col gap-6 w-full">
                    <div className="flex items-center justify-center gap-2.5 px-1.5 py-1 min-h-10 w-full">
                        <img src="/logo.svg" alt="Logo" className="w-8 h-8 object-contain" />
                        <span className="leading-none font-bold text-xs text-primary whitespace-nowrap">Water Quality TestKit</span>
                    </div>

                    {/* Navigation Items */}
                    <div className="flex flex-col gap-1.5 w-full">
                      <Suspense fallback={null}>
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    prefetch={true}
                                    onClick={item.onClick}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`group flex items-center h-11 rounded-xl font-semibold text-xs transition-all duration-200 ease-[var(--nav-ease)] relative active:scale-[0.92] will-change-transform overflow-hidden w-full px-4 gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                         isActive ? "bg-secondary text-white" : "hover:bg-primary hover:text-text-primary"
                                     }`}
                                >
                                    {currentUser?.role === "admin" && (
                                        <div className="relative shrink-0">
                                            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className="transition-transform duration-150 group-hover:translate-x-0.5 group-hover:rotate-6" />
                                            {item.showDot && (
                                                <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 ${isActive ? "border-primary" : "border-surface"}`} />
                                            )}
                                        </div>
                                    )}
                                    <span className="whitespace-nowrap truncate">{item.label}</span>
                                </Link>
                            );
                        })}
                      </Suspense>
                    </div>
                </div>

                
            </nav>
        </>
    );
}
