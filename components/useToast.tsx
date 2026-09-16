/**
 * @file useToast.tsx
 * @project Water Monitoring Project
 * @module UI / Feedback
 * @description
 * Hook แสดง toast แจ้งผลสั้นๆ (สำเร็จ/ผิดพลาด) ลอยกลางจอด้านล่าง หายเองใน 3 วินาที
 * คืน `showToast` สำหรับสั่งแสดง และ `toastElement` ให้ผู้เรียกนำไป render เองในหน้า
 *
 * Hook for a short auto-dismissing toast (success / danger). Returns the trigger
 * function and the element to be rendered by the caller.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-07
 * @version 1.0.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-07-13, 2026-08-19)
 *
 * @lastModified 2026-08-19 10:13
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-07-07 14:54 by Nopparut U. - สร้าง hook toast ใช้กับหน้าแก้ไขข้อมูลผู้ใช้
 * - 2026-07-13 12:57 by Pachara P. - ใช้แจ้งผลหลังส่งคำขอสิทธิ์
 * - 2026-08-19 10:13 by Pachara P. - ห่อ showToast ด้วย useCallback และเคลียร์ timer ตอน unmount
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @license Private / Proprietary
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

/** ชนิดของ toast: `success` ไอคอนติ๊กเขียว / `danger` ไอคอนกากบาทแดง */
export type ToastVariant = "success" | "danger";

/**
 * Hook จัดการ toast หนึ่งตัวต่อหน้า (เรียกซ้ำจะแทนที่ตัวเดิมและรีเซ็ตเวลานับถอยหลัง)
 *
 * @returns `showToast(message, variant?)` และ `toastElement` (null เมื่อไม่มี toast)
 *
 * @example
 * ```tsx
 * const { showToast, toastElement } = useToast();
 * showToast("บันทึกสำเร็จ");
 * return <>{toastElement}</>;
 * ```
 */
export function useToast() {
    const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
    const [leaving, setLeaving] = useState(false);
    const timers = useRef<{ hide?: ReturnType<typeof setTimeout>; remove?: ReturnType<typeof setTimeout> }>({});

    const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
        clearTimeout(timers.current.hide);
        clearTimeout(timers.current.remove);
        setToast({ message, variant });
        setLeaving(false);
        timers.current.hide = setTimeout(() => setLeaving(true), 3000);
        timers.current.remove = setTimeout(() => setToast(null), 3500);
    }, []);

    useEffect(() => {
        const t = timers.current;
        return () => {
            clearTimeout(t.hide);
            clearTimeout(t.remove);
        };
    }, []);

    const toastElement = toast ? (
        <div className={`fixed bottom-22 left-1/2 -translate-x-1/2 z-999 ${leaving ? "animate-toast-exit" : "animate-slide-up"}`}>
            <div className="flex items-center gap-2.5 bg-surface text-text-primary border border-border/60 text-xs font-semibold px-5 py-3 rounded-2xl whitespace-nowrap">
                {toast.variant === "success" ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> : <XCircle size={16} className="text-red-500 shrink-0" />}
                {toast.message}
            </div>
        </div>
    ) : null;

    return { showToast, toastElement };
}
