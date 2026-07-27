"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import liff from "@line/liff";
import { Bell, X, MapPin, FileScan, Calendar, AlertCircle, ImageOff, Check, BellOff } from "lucide-react";
import { refreshNavDots } from "@/lib/navEvents";

interface NotificationItem {
    id: number;
    sessionGroup: string;
    code?: string | null;
    reviewNote: string | null;
    reviewedAt: string | null;
    acknowledgedAt: string | null;
    collectionTime: string | null;
    rawImageUrl: string | null;
    location: { id: number; name: string; organization: string } | null;
}

function formatDateTime(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [ackingId, setAckingId] = useState<number | null>(null);
    const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

    // ─── Bottom Sheet Dragging States ───
    const [sheetHeight, setSheetHeight] = useState<"collapsed" | "half" | "full">("collapsed");
    const isDraggingRef = useRef(false);
    const dragStartYRef = useRef(0);
    const dragBaseHeightRef = useRef(0);
    const lastYRef = useRef(0);
    const lastTimeRef = useRef(0);
    const velocityRef = useRef(0);
    const sheetRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    const [windowHeight, setWindowHeight] = useState(700);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setWindowHeight(window.innerHeight);
        }
    }, []);

    // คำนวณความสูง 3 ระดับ: collapsed (พอดีกับ 1 รายการ) / half (50%) / full (80%)
    const HEIGHTS = useMemo(
        () => ({
            collapsed: 210, // ความสูงระดับแรกสำหรับโชว์ 1 การ์ด
            half: windowHeight * 0.5,
            full: windowHeight * 0.8,
        }),
        [windowHeight],
    );

    const getSnapHeight = useCallback((snap: "collapsed" | "half" | "full"): number => HEIGHTS[snap], [HEIGHTS]);

    const getNearestSnapPoint = (height: number): "collapsed" | "half" | "full" => {
        const dists = {
            collapsed: Math.abs(height - HEIGHTS.collapsed),
            half: Math.abs(height - HEIGHTS.half),
            full: Math.abs(height - HEIGHTS.full),
        };
        return (Object.keys(dists) as Array<"collapsed" | "half" | "full">).reduce((a, b) => (dists[a] < dists[b] ? a : b));
    };

    const snapTo = (point: "collapsed" | "half" | "full") => {
        if (sheetRef.current) {
            sheetRef.current.style.transition = "height 0.22s cubic-bezier(0.16, 1, 0.3, 1)";
            sheetRef.current.style.height = `${getSnapHeight(point)}px`;
        }
        setSheetHeight(point);
    };

    const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
        const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        isDraggingRef.current = true;
        dragStartYRef.current = clientY;
        lastYRef.current = clientY;
        lastTimeRef.current = Date.now();
        velocityRef.current = 0;
        dragBaseHeightRef.current = sheetRef.current ? sheetRef.current.getBoundingClientRect().height : getSnapHeight(sheetHeight);
        if (sheetRef.current) sheetRef.current.style.transition = "none";
    };

    const handleDragMove = useCallback(
        (clientY: number) => {
            if (!isDraggingRef.current) return;

            const now = Date.now();
            const dt = now - lastTimeRef.current;
            if (dt > 0) {
                velocityRef.current = (lastYRef.current - clientY) / dt;
            }
            lastYRef.current = clientY;
            lastTimeRef.current = now;

            const delta = dragStartYRef.current - clientY;
            const newHeight = Math.max(HEIGHTS.collapsed, Math.min(HEIGHTS.full, dragBaseHeightRef.current + delta));

            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

            animationFrameRef.current = requestAnimationFrame(() => {
                if (sheetRef.current) {
                    sheetRef.current.style.height = `${newHeight}px`;
                }
            });
        },
        [HEIGHTS],
    );

    const handleDragEnd = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        const currentHeight = sheetRef.current ? sheetRef.current.getBoundingClientRect().height : getSnapHeight(sheetHeight);
        const velocity = velocityRef.current;
        const VELOCITY_THRESHOLD = 0.25;

        let nextPoint: "collapsed" | "half" | "full";

        if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
            if (velocity > 0) {
                nextPoint = sheetHeight === "collapsed" ? "half" : "full";
            } else {
                nextPoint = sheetHeight === "full" ? "half" : "collapsed";
            }
        } else {
            nextPoint = getNearestSnapPoint(currentHeight);
        }

        snapTo(nextPoint);
    };

    useEffect(() => {
        if (open && sheetRef.current) {
            sheetRef.current.style.transition = "height 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
            sheetRef.current.style.height = `${getSnapHeight(sheetHeight)}px`;
        }
    }, [open, getSnapHeight, sheetHeight]);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch("/api/notifications", {
                headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
            });
            if (!res.ok) return;
            const data = await res.json();
            setItems(Array.isArray(data.items) ? data.items : []);
            setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
        } catch (err) {
            console.error("Failed to fetch notifications:", err);
        }
    }, []);

    // โหลดตอน mount + รีเฟรชเมื่อผู้ใช้กลับมาโฟกัสหน้าจอ (เช่น สลับแท็บกลับมา)
    useEffect(() => {
        fetchNotifications();
        const onFocus = () => fetchNotifications();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [fetchNotifications]);

    // ล็อกสกอลล์พื้นหลังตอนเปิดป็อปอัป
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
            setSheetHeight("collapsed"); // รีเซ็ตเป็นระดับแรกเมื่อเปิด
            return () => {
                document.body.style.overflow = "";
            };
        }
    }, [open]);

    const handleAck = async (item: NotificationItem) => {
        if (item.acknowledgedAt || ackingId === item.id) return;
        setAckingId(item.id);

        // optimistic — ทำให้จางลงและลดตัวเลขทันที
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, acknowledgedAt: new Date().toISOString() } : i)));
        setUnreadCount((c) => Math.max(0, c - 1));

        try {
            const res = await fetch(`/api/notifications/${item.id}`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
            });
            if (!res.ok) throw new Error("ack failed");
            refreshNavDots(); // แจ้ง Navbar ให้ลบจุดแดงทันที ไม่ต้องรอ mount/focus ใหม่
        } catch (err) {
            console.error("Failed to acknowledge notification:", err);
            // rollback หากล้มเหลว
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, acknowledgedAt: null } : i)));
            setUnreadCount((c) => c + 1);
        } finally {
            setAckingId(null);
        }
    };

    // แสดงรายการแรกรายการเดียวถ้าอยู่ในโหมด collapsed
    const displayedItems = sheetHeight === "collapsed" ? items.slice(0, 1) : items;

    return (
        <>
            {/* ปุ่มกระดิ่ง */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="การแจ้งเตือน"
                className="relative w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center text-primary hover:text-primary hover:border-primary/30 transition-all active:scale-95 cursor-pointer shrink-0"
            >
                <Bell size={18} strokeWidth={2.2} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 p-2 bg-text-danger text-white text-xs leading-none font-bold rounded-full flex items-center justify-center border-2 border-border-danger">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* ป็อปอัปแบบ bottom-sheet เลื่อนได้ 3 ระดับ */}
            {open && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-1000 backdrop-blur-xs transition-opacity" onClick={() => setOpen(false)} />
                    <div
                        ref={sheetRef}
                        className="fixed bottom-0 left-0 right-0 z-1001 bg-bg rounded-t-3xl shadow-2xl border-t border-border max-w-lg mx-auto flex flex-col will-change-[height]"
                        style={{
                            height: `${getSnapHeight(sheetHeight)}px`,
                            maxHeight: "85vh",
                            touchAction: "none",
                        }}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                        onTouchEnd={handleDragEnd}
                        onMouseMove={(e) => handleDragMove(e.clientY)}
                        onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
                    >
                        {/* Drag Handle Bar */}
                        <div
                            className="relative w-full flex items-center justify-center pt-3 pb-1 px-4 cursor-grab active:cursor-grabbing select-none"
                            onMouseDown={handleDragStart}
                            onTouchStart={handleDragStart}
                        >
                            {/* ขีดดึงตรงกลาง */}
                            <div className="w-12 h-1 bg-secondary rounded-full pointer-events-none" />

                            {/* ปุ่มปิดชิดขวาสุด */}
                            <button
                                onClick={() => setOpen(false)}
                                className="absolute right-4 w-8 h-8 mt-5 flex items-center justify-center hover:bg-surface-muted transition-colors active:scale-[0.92] cursor-pointer"
                            >
                                <X size={24} className="text-secondary" />
                            </button>
                        </div>

                        {/* หัวข้อ */}
                        <div className="flex items-center justify-between px-6 mt-3 pb-4 shrink-0">
                            <div className="flex items-center gap-2.5 w-full">
                                {/* ไอคอนกระดิ่ง */}
                                <Bell size={20} className="text-primary shrink-0" />

                                {/* ข้อความหัวข้อ + คำอธิบาย */}
                                <div className="flex flex-col min-w-0 flex-1">
                                    <h3 className="text-md font-bold text-primary leading-tight">การแจ้งเตือน</h3>
                                    <p className="text-xs text-text-muted truncate">รายการที่รับทราบแล้วจะไม่แสดงในรายการหลังครบ 7 วัน</p>
                                </div>
                            </div>
                        </div>

                        {/* รายการการแจ้งเตือน (คง UI เดิมไว้ทั้งหมด) */}
                        <div className={`flex-1 px-4 pb-2 space-y-3 ${sheetHeight === "collapsed" ? "overflow-hidden" : "overflow-y-auto"}`}>
                            {items.length === 0 ? (
                                <div className="text-center py-12 flex flex-col items-center justify-center">
                                    <div className="w-12 h-12 bg-bg border border-border rounded-2xl flex items-center justify-center mb-3 text-text-muted">
                                        <BellOff size={20} className="text-primary" />
                                    </div>
                                    <p className="text-xs font-semibold text-secondary">ยังไม่มีการแจ้งเตือน</p>
                                </div>
                            ) : (
                                displayedItems.map((item) => {
                                    const isRead = !!item.acknowledgedAt;

                                    return (
                                        <div
                                            key={item.id}
                                            className={`rounded-2xl  shadow-xs border p-3 transition-all ${isRead ? "bg-card-general shadow-xs border-border opacity-60" : "bg-red-500/5 border-red-200"}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <div className="flex-1 min-w-0">
                                                        {/* แถวเดียวกัน: สถานะปฏิเสธ (ซ้าย) + Code (ขวา) */}
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            {item.code && (
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <FileScan size={12} className="text-text-muted shrink-0" />
                                                                    <span className="font-medium text-text text-xs">{item.code}</span>
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-text-danger bg-bg-danger border border-border-danger p-1 rounded-md shrink-0">
                                                                    ถูกปฏิเสธ
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* CODE และ วันที่ */}
                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium mt-0.5">
                                                            {item.code && (
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <MapPin size={12} className="shrink-0" />
                                                                    <span className="font-medium text-text">{item.location?.name ?? "ไม่ทราบสถานที่"}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <Calendar size={12} className="shrink-0" />
                                                                <span>{formatDateTime(item.collectionTime)}</span>
                                                            </div>
                                                        </div>

                                                        {/* เหตุผลการปฏิเสธ */}
                                                        {item.reviewNote && (
                                                            <p className="flex items-start gap-1.5 text-xs font-semibold text-text-danger mt-1.5 leading-relaxed bg-bg-danger p-1.5 rounded-lg border border-border-danger">
                                                                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                                                                <span>{item.reviewNote}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* ปุ่มรับทราบ (เฉพาะที่ยังไม่อ่าน) */}
                                            {!isRead && (
                                                <button
                                                    onClick={() => handleAck(item)}
                                                    disabled={ackingId === item.id}
                                                    className="w-full mt-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-surface border border-border text-text-secondary hover:bg-surface-subtle hover:text-text-primary transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    รับทราบ
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
