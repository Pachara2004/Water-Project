"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export type ToastVariant = "success" | "danger";

/** Toast กลางล่างจอ ใช้ร่วมกันหลายหน้า (เดิมอยู่ inline ในหน้า /manage/users)
 *  โชว์ 5 วิ แล้วเล่น animation เลื่อนลง (animate-toast-exit ใน globals.css) ก่อนลบออกจาก DOM
 *  คืน showToast() ไว้เรียกจาก handler และ toastElement ไว้ render ท้ายหน้า */
export function useToast() {
    const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
    const [leaving, setLeaving] = useState(false);
    const timers = useRef<{ hide?: ReturnType<typeof setTimeout>; remove?: ReturnType<typeof setTimeout> }>({});

    const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
        clearTimeout(timers.current.hide);
        clearTimeout(timers.current.remove);
        setToast({ message, variant });
        setLeaving(false);
        timers.current.hide = setTimeout(() => setLeaving(true), 5000);
        timers.current.remove = setTimeout(() => setToast(null), 5300);
    }, []);

    useEffect(() => {
        const t = timers.current;
        return () => {
            clearTimeout(t.hide);
            clearTimeout(t.remove);
        };
    }, []);

    const toastElement = toast ? (
        <div className={`fixed bottom-[88px] left-1/2 -translate-x-1/2 z-[999] ${leaving ? "animate-toast-exit" : "animate-slide-up"}`}>
            <div className="flex items-center gap-2.5 bg-surface text-text-primary border border-border/60 text-xs font-semibold px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">
                {toast.variant === "success" ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <XCircle size={14} className="text-red-500 shrink-0" />}
                {toast.message}
            </div>
        </div>
    ) : null;

    return { showToast, toastElement };
}
