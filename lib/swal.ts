"use client";

import { COLOR_PANEL } from "recharts/types/util/Constants";
import Swal from "sweetalert2";

/* Dialog กลางของแอปตาม prototype: การ์ดขาวมุมโค้ง ไอคอนวงกลมทึบ
   เลือกโทนตามผลกระทบของ action ไม่ใช่ตามประเภทงาน (แก้ไข/ลบ):
   - danger  = ย้อนกลับไม่ได้ (ปฏิเสธคำร้อง, ลบข้อมูล)
   - warning = ย้อนกลับได้แต่กระทบคนอื่น/ระบบถ้าเลือกผิด (เปลี่ยนสิทธิ์ผู้ใช้)
   - primary = action เชิงบวก ความเสี่ยงต่ำ (อนุมัติคำร้องที่ผู้ใช้ขอเอง) */
export type SwalTone = "danger" | "warning" | "primary";

export const TONE_COLOR: Record<SwalTone, string> = {
    danger: "#B91C1C",
    warning: "#B45309",
    primary: "var(--color-primary, #06647F)",
};

export const ICON_SVG = {
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="11" x2="12" y2="17"/><circle cx="12" cy="7.5" r="0.5" fill="#fff" stroke-width="2"/></svg>`,
    question: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M9 9a3 3 0 1 1 4.6 2.5c-.9.6-1.6 1.2-1.6 2.3"/><circle cx="12" cy="17" r="0.5" fill="#fff" stroke-width="2"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4 10-10"/></svg>`,
    cross: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
};

/* heightAuto: false กัน layout พังใน LINE LIFF (100dvh)
   scrollbarPadding: false ทำงานคู่กับ scroll-lock fix ใน globals.css */
export const baseSwal = Swal.mixin({
    background: "var(--color-surface, #ffffff)",
    color: "var(--color-text-primary, #112A33)",
    heightAuto: false,
    scrollbarPadding: false,
    buttonsStyling: false,
    customClass: {
        popup: "app-swal",
        actions: "app-swal-actions",
        confirmButton: "app-swal-confirm",
        cancelButton: "app-swal-cancel",
        icon: "app-swal-icon",
    },
});

export interface ConfirmDialogOptions {
    title: string;
    text?: string;
    confirmText?: string;
    tone?: SwalTone;
}

/** Dialog ยืนยันก่อนทำ action — คืน true เมื่อผู้ใช้กดยืนยัน */
export async function confirmDialog({ title, text, confirmText = "ตกลง", tone = "danger" }: ConfirmDialogOptions): Promise<boolean> {
    const result = await baseSwal.fire({
        title,
        text,
        iconHtml: tone === "danger" ? ICON_SVG.info : tone === "primary" ? ICON_SVG.check : ICON_SVG.question,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: "ยกเลิก",
        reverseButtons: true,
        didRender: (popup) => popup.style.setProperty("--swal-tone", TONE_COLOR[tone]),
    });
    return result.isConfirmed;
}

/** Dialog แจ้งผลสำเร็จ — ปุ่ม "รับทราบ" เต็มความกว้าง */
export function alertSuccess(title: string, tone: SwalTone = "danger", text?: string) {
    return baseSwal.fire({
        title,
        text,
        iconHtml: ICON_SVG.check,
        confirmButtonText: "รับทราบ",
        didRender: (popup) => {
            popup.style.setProperty("--swal-tone", TONE_COLOR[tone]);
            popup.classList.add("app-swal--single");
        },
    });
}

/** Dialog แจ้ง error (เช่น ไฟล์ผิดประเภท/ผิดขนาด) — ปุ่มเดียวเต็มความกว้าง โทนแดงเสมอ */
export function alertError(title: string, text?: string, confirmText = "เข้าใจแล้ว") {
    return baseSwal.fire({
        title,
        text,
        iconHtml: ICON_SVG.cross,
        confirmButtonText: confirmText,
        didRender: (popup) => {
            popup.style.setProperty("--swal-tone", TONE_COLOR.danger);
            popup.classList.add("app-swal--single");
        },
    });
}

/* Toast มุมขวาบน ปิดเองอัตโนมัติ — ใช้ theme สีเดียวกับ dialog หลัก แต่ไม่ใช้ layout การ์ด/ไอคอนวงกลม
   เพราะพื้นที่จำกัด จึงใช้ icon สำเร็จรูปของ sweetalert2 แทน iconHtml แบบกำหนดเอง */
const toastSwal = Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
    background: "var(--color-surface, #ffffff)",
    color: "var(--color-text-primary, #112A33)",
});

export function errorToast(title: string, text?: string) {
    return toastSwal.fire({ icon: "error", title, text });
}
