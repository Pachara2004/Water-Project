"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, BarChart2, User } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCallback, useEffect, useMemo, useState, useRef, useLayoutEffect, lazy, Suspense } from "react";
import liff from "@line/liff";
import { loginAfterLiff } from "@/lib/lineAuth";
import { onNavDotsRefresh } from "@/lib/navEvents";
const SettingsIcon = lazy(() => import("lucide-react").then((mod) => ({ default: mod.Settings })));
const FileScanIcon = lazy(() => import("lucide-react").then((mod) => ({ default: mod.FileScan })));

// ดึงการประกาศ Mapping ข้อความออกมาข้างนอก เพื่อไม่ให้สร้างขึ้นใหม่ทุกรอบการเรนเดอร์
const MOBILE_LABEL_MAP: Record<string, string> = {
    แผนที่: "แผนที่",
    ตรวจคุณภาพ: "ตรวจคุณภาพ",
    จัดการข้อมูล: "จัดการข้อมูล",
};

/* ─── Easing constants (ประกาศครั้งเดียว ไม่สร้างใหม่ทุก render) ─── */
const SPRING = "cubic-bezier(0.34,1.56,0.64,1)";
const EASE_OUT = "cubic-bezier(0.22,1,0.36,1)";
const MORPH_MS = 140; // Phase-1 ยืดเร็วขึ้น (เดิม 180)
const SNAP_TRANSLATE = `0.38s ${SPRING}`; // Phase-2 หดกลับ
const SNAP_SIZE = `0.3s ${SPRING}`;
const MORPH_TRANSLATE = `0.36s ${EASE_OUT}`;
const MORPH_SIZE = `0.24s ${EASE_OUT}`;

/* ─── Blob base styles (static object — ไม่สร้างใหม่ทุก render) ─── */
const MOBILE_BLOB_STYLE: React.CSSProperties = {
    position: "absolute",
    top: 8,
    bottom: 8,
    left: 0,
    borderRadius: 16,
    background: "color-mix(in srgb, var(--color-primary) 18%, transparent)",
    pointerEvents: "none",
    zIndex: 0,
    opacity: 0,
    willChange: "translate, width",
    contain: "layout style",
};
const DESKTOP_BLOB_STYLE: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    height: 44,
    borderRadius: 12,
    background: "var(--color-secondary, var(--color-primary))",
    pointerEvents: "none",
    zIndex: 0,
    opacity: 0,
    willChange: "translate, height",
    contain: "layout style",
};

/** ใช้ CSS `translate` property แทน `transform` → compositor-only, ไม่ trigger style recalc */
function setBlobPos(blob: HTMLDivElement, axis: "x" | "y", offset: number, size: number, phase: "snap" | "morph" | "none") {
    // transition
    if (phase === "none") {
        blob.style.transition = "none";
        blob.style.opacity = "1";
    } else if (phase === "morph") {
        blob.style.transition = `translate ${MORPH_TRANSLATE}, ${axis === "x" ? "width" : "height"} ${MORPH_SIZE}, opacity ${MORPH_SIZE}`;
        blob.style.opacity = "0.4";
    } else {
        blob.style.transition = `translate ${SNAP_TRANSLATE}, ${axis === "x" ? "width" : "height"} ${SNAP_SIZE}, opacity ${SNAP_SIZE}`;
        blob.style.opacity = "1";
    }
    // position — ใช้ translate property (ไม่ใช่ transform)
    blob.style.translate = axis === "x" ? `${offset}px 0` : `0 ${offset}px`;
    // size
    if (axis === "x") blob.style.width = `${size}px`;
    else blob.style.height = `${size}px`;
}

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
                        // (ผ่าน loginAfterLiff เพื่อให้ uid ใหม่ต้องยอมรับข้อตกลงก่อนถูกเก็บ เหมือน path ตอนเปิดแอป)
                        try {
                            await loginAfterLiff();
                        } catch (err) {
                            console.error("Auto login via LINE client failed:", err);
                        }
                    } else {
                        liff.login();
                    }
                },
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

    /* ─── Blob refs (รวม ready + prevIndex ไว้ใน object เดียวเพื่อลดจำนวน ref) ─── */
    const mobileContainerRef = useRef<HTMLDivElement>(null);
    const mobileItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
    const mobileBlobRef = useRef<HTMLDivElement>(null);
    const mobileState = useRef({ ready: false, prev: -1 });

    const desktopContainerRef = useRef<HTMLDivElement>(null);
    const desktopItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
    const desktopBlobRef = useRef<HTMLDivElement>(null);
    const desktopState = useRef({ ready: false, prev: -1 });

    // หา active index จาก pathname
    const activeIndex = useMemo(() => {
        return navItems.findIndex((item) => pathname === item.href || pathname?.startsWith(item.href + "/"));
    }, [navItems, pathname]);

    /* ── Blob position update (รวม mobile + desktop ไว้ใน effect เดียว ลด overhead) ── */
    useLayoutEffect(() => {
        // --- Mobile blob ---
        const mc = mobileContainerRef.current;
        const mb = mobileBlobRef.current;
        if (mc && mb) {
            if (activeIndex < 0) {
                mb.style.opacity = "0";
            } else {
                const el = mobileItemRefs.current[activeIndex];
                if (el) {
                    const cr = mc.getBoundingClientRect();
                    const ir = el.getBoundingClientRect();
                    const tx = ir.left - cr.left;
                    const tw = ir.width;
                    const ms = mobileState.current;

                    if (!ms.ready) {
                        // First paint: snap ทันที
                        setBlobPos(mb, "x", tx, tw, "none");
                        mb.style.opacity = "1";
                        requestAnimationFrame(() => {
                            ms.ready = true;
                        });
                    } else if (ms.prev >= 0 && ms.prev !== activeIndex) {
                        // Moving: 2-phase morph
                        const pe = mobileItemRefs.current[ms.prev];
                        if (pe) {
                            const pr = pe.getBoundingClientRect();
                            const pl = pr.left - cr.left;
                            const ml = Math.min(tx, pl);
                            const mw = Math.max(tx + tw, pl + pr.width) - ml;
                            setBlobPos(mb, "x", ml, mw, "morph");
                            setTimeout(() => setBlobPos(mb, "x", tx, tw, "snap"), MORPH_MS);
                        } else {
                            setBlobPos(mb, "x", tx, tw, "snap");
                        }
                    } else {
                        setBlobPos(mb, "x", tx, tw, "snap");
                    }
                    ms.prev = activeIndex;
                }
            }
        }

        // --- Desktop blob ---
        const dc = desktopContainerRef.current;
        const db = desktopBlobRef.current;
        if (dc && db) {
            if (activeIndex < 0) {
                db.style.opacity = "0";
            } else {
                const el = desktopItemRefs.current[activeIndex];
                if (el) {
                    const cr = dc.getBoundingClientRect();
                    const ir = el.getBoundingClientRect();
                    const ty = ir.top - cr.top;
                    const th = ir.height;
                    const ds = desktopState.current;

                    if (!ds.ready) {
                        setBlobPos(db, "y", ty, th, "none");
                        db.style.opacity = "1";
                        requestAnimationFrame(() => {
                            ds.ready = true;
                        });
                    } else if (ds.prev >= 0 && ds.prev !== activeIndex) {
                        const pe = desktopItemRefs.current[ds.prev];
                        if (pe) {
                            const pr = pe.getBoundingClientRect();
                            const pt = pr.top - cr.top;
                            const mt = Math.min(ty, pt);
                            const mh = Math.max(ty + th, pt + pr.height) - mt;
                            setBlobPos(db, "y", mt, mh, "morph");
                            setTimeout(() => setBlobPos(db, "y", ty, th, "snap"), MORPH_MS);
                        } else {
                            setBlobPos(db, "y", ty, th, "snap");
                        }
                    } else {
                        setBlobPos(db, "y", ty, th, "snap");
                    }
                    ds.prev = activeIndex;
                }
            }
        }
    }, [activeIndex, navItems]);

    return (
        <>
            {/* ── Mobile / Tablet: docked bottom bar */}
            <nav className="lg:hidden fixed bottom-0 left-0 w-full z-950 bg-card-general" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}>
                <div ref={mobileContainerRef} className="flex items-center justify-around h-20 px-4 w-full relative">
                    {/* Fluid blob indicator — inline style, ไม่ต้อง inject <style> tag */}
                    <div ref={mobileBlobRef} style={MOBILE_BLOB_STYLE} />
                    <Suspense fallback={null}>
                        {navItems.map((item, i) => {
                            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                            const Icon = item.icon;
                            const displayLabel = MOBILE_LABEL_MAP[item.label] || item.label;
                            return (
                                <Link
                                    key={item.href}
                                    ref={(el) => {
                                        mobileItemRefs.current[i] = el;
                                    }}
                                    href={item.href}
                                    prefetch={true}
                                    onClick={item.onClick}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`relative z-1 group flex flex-1 flex-col items-center justify-center h-full rounded-xl transition-colors duration-150 active:scale-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive ? "text-primary font-semibold" : "text-text hover:text-primary"}`}
                                >
                                    <div className="relative">
                                        <Icon
                                            size={24}
                                            strokeWidth={isActive ? 2.5 : 2}
                                            className={`transition-[transform,color] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isActive ? "-translate-y-0.5 scale-110 text-primary" : ""} group-hover:rotate-12`}
                                        />
                                        {item.showDot && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-text-danger rounded-full border-2 border-border-danger" />}
                                    </div>
                                    <span className={`text-xs mt-1 transition-[color,font-weight] duration-150 whitespace-nowrap ${isActive ? "text-primary" : "font-medium"}`}>{displayLabel}</span>
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
                    <div ref={desktopContainerRef} className="flex flex-col gap-1.5 w-full relative">
                        {/* Fluid blob indicator — inline style */}
                        <div ref={desktopBlobRef} style={DESKTOP_BLOB_STYLE} />
                        <Suspense fallback={null}>
                            {navItems.map((item, i) => {
                                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.href}
                                        ref={(el) => {
                                            desktopItemRefs.current[i] = el;
                                        }}
                                        href={item.href}
                                        prefetch={true}
                                        onClick={item.onClick}
                                        aria-current={isActive ? "page" : undefined}
                                        className={`relative z-1 group flex items-center h-11 rounded-xl font-semibold text-xs transition-colors duration-150 active:scale-[0.97] overflow-hidden w-full px-4 gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isActive ? "text-white" : "hover:bg-primary hover:text-white"}`}
                                    >
                                        {currentUser?.role === "admin" && (
                                            <div className="relative shrink-0">
                                                <Icon
                                                    size={18}
                                                    strokeWidth={isActive ? 2.5 : 2}
                                                    className="transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-x-0.5 group-hover:rotate-6"
                                                />
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
