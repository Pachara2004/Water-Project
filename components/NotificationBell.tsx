"use client";

import { useCallback, useEffect, useState } from "react";
import liff from "@line/liff";
import { Bell, X, MapPin, Calendar, AlertCircle, ImageOff, Check, BellOff } from "lucide-react";
import { refreshNavDots } from "@/lib/navEvents";

interface NotificationItem {
    id: number;
    sessionGroup: string;
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
                    <span className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 px-1 bg-red-500 text-white text-xs leading-none font-bold rounded-full flex items-center justify-center border-2 border-surface">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* ป็อปอัปแบบ bottom-sheet ตาม convention โปรเจกต์ */}
            {open && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-1000 backdrop-blur-xs transition-opacity" onClick={() => setOpen(false)} />
                    <div
                        className="fixed bottom-0 left-0 right-0 z-1001 bg-card-general rounded-t-4xl shadow-2xl border-t border-border max-w-lg mx-auto flex flex-col max-h-[80dvh] animate-slide-up transition-colors duration-300"
                        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}
                    >
                        <div className="w-12 h-1 bg-secondary rounded-full mx-auto mt-3 mb-1 pointer-events-none shrink-0" />

                        {/* หัวข้อ */}
                        <div className="flex items-center justify-between px-6 pt-3 pb-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <Bell size={18} className="text-primary" />
                                <h3 className="text-sm font-bold text-primary">การแจ้งเตือน</h3>
                                {unreadCount > 0 && (
                                    <span className="text-[10px] leading-none font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-full inline-flex items-center">{unreadCount} ใหม่</span>
                                )}
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-surface-muted transition-colors active:scale-[0.92] cursor-pointer"
                            >
                                <X size={24} className="text-secondary" />
                            </button>
                        </div>

                        {/* รายการ */}
                        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3">
                            {items.length === 0 ? (
                                <div className="text-center py-12 flex flex-col items-center justify-center">
                                    <div className="w-12 h-12 bg-bg border border-border rounded-2xl flex items-center justify-center mb-3 text-text-muted">
                                        <BellOff size={20} className="text-primary" />
                                    </div>
                                    <p className="text-xs font-semibold text-secondary">ยังไม่มีการแจ้งเตือน</p>
                                </div>
                            ) : (
                                items.map((item) => {
                                    const isRead = !!item.acknowledgedAt;
                                    const hasImageError = imageErrors[item.id];
                                    return (
                                        <div
                                            key={item.id}
                                            className={`rounded-2xl border p-3.5 transition-all ${
                                                isRead ? "bg-surface border-border opacity-60" : "bg-red-500/5 border-red-200"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {/* รูป */}
                                                <div className="w-12 h-12 rounded-xl bg-surface-subtle border border-border shrink-0 overflow-hidden flex items-center justify-center">
                                                    {item.rawImageUrl && !hasImageError ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={item.rawImageUrl}
                                                            alt="sample"
                                                            onError={() => setImageErrors((prev) => ({ ...prev, [item.id]: true }))}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <ImageOff size={15} className="text-text-muted" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    {/* หัว: สถานะปฏิเสธ + สถานที่ */}
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md shrink-0">
                                                            ถูกปฏิเสธ
                                                        </span>
                                                        {!isRead && <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />}
                                                    </div>

                                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary min-w-0">
                                                        <MapPin size={12} className="text-text-muted shrink-0" />
                                                        <span className="truncate">{item.location?.name ?? "ไม่ทราบสถานที่"}</span>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-0.5">
                                                        <Calendar size={11} className="shrink-0" />
                                                        <span className="truncate">{formatDateTime(item.collectionTime)}</span>
                                                    </div>

                                                    {/* เหตุผล */}
                                                    {item.reviewNote && (
                                                        <p className="flex items-start gap-1.5 text-[11px] text-red-600 mt-2 leading-relaxed">
                                                            <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                                            <span>{item.reviewNote}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* ปุ่มรับทราบ (เฉพาะที่ยังไม่อ่าน) */}
                                            {!isRead && (
                                                <button
                                                    onClick={() => handleAck(item)}
                                                    disabled={ackingId === item.id}
                                                    className="w-full mt-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-surface border border-border text-text-secondary hover:bg-surface-subtle hover:text-text-primary transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {ackingId === item.id ? (
                                                        <div className="w-3.5 h-3.5 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <Check size={14} />
                                                    )}
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
