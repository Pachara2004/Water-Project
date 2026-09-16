"use client";

/**
 * @fileoverview SweetAlert2 dialog and toast notification utilities with custom branding
 *
 * [TH] โมดูลจัดการกล่องข้อความแจ้งเตือน (Modal Dialog) และ Toast ด้วย SweetAlert2 ตามธีมระบบ
 * [EN] SweetAlert2 modal dialog and toast notification wrappers styled for system design guidelines
 *
 * @description
 * [TH] ปรับแต่ง SweetAlert2 ให้เข้ากับธีมของแอปพลิเคชัน (สีโทน danger, warning, primary, review)
 * รองรับการจองพื้นที่ Scrollbar gutter ป้องกัน Layout shift, กล่องยืนยันการส่งตรวจสอบ (Review Dialog),
 * กล่องโหลดข้อมูล (Loading), และการยืนยันการออกจากระบบ (Logout)
 * [EN] Provides branded confirmation dialogs, review request modals, loading spinners, and toasts
 * with layout-shift prevention (gutter reservation) and mobile viewport compatibility.
 *
 * @module lib/swal
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-20
 * @modified 2026-09-11
 *
 * @history
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix(review): support forceAllowAdminChange when AI cannot detect test tubes
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: รวมกล่องข้อความ SweetAlert2 และ Toast ทั้งระบบใน lib/swal.ts
 */

import Swal from "sweetalert2";

/* Dialog กลางของแอปตาม prototype: การ์ดขาวมุมโค้ง ไอคอนวงกลมทึบ
   เลือกโทนตามผลกระทบของ action ไม่ใช่ตามประเภทงาน (แก้ไข/ลบ):
   - danger  = ย้อนกลับไม่ได้ (ปฏิเสธคำร้อง, ลบข้อมูล)
   - warning = ย้อนกลับได้แต่กระทบคนอื่น/ระบบถ้าเลือกผิด (เปลี่ยนสิทธิ์ผู้ใช้)
   - primary = action เชิงบวก ความเสี่ยงต่ำ (อนุมัติคำร้องที่ผู้ใช้ขอเอง) */

/**
 * [TH] ระดับโทนสีของกล่องแจ้งเตือน: 'danger' | 'warning' | 'primary' | 'review'
 * [EN] Color tone variants for SweetAlert dialogs representing action severity
 */
export type SwalTone = "danger" | "warning" | "primary" | "review";

/**
 * [TH] รหัสสี HEX/CSS Var ประจำแต่ละโทนของกล่องข้อความ
 * [EN] Color definitions mapped to each alert tone
 * @constant
 */
export const TONE_COLOR: Record<SwalTone, string> = {
    danger: "#B91C1C",
    warning: "#B45309",
    primary: "var(--color-primary, #06647F)",
    // เดียวกับปุ่ม "ส่งให้ผู้เชี่ยวชาญตรวจสอบ" (#FE9A00) — ใช้เฉพาะ dialog ยืนยันการส่งตรวจสอบ
    review: "#FE9A00",
};

/**
 * [TH] สตริง SVG ไอคอนสีขาวสำหรับใส่ในวงกลมหัวกล่องข้อความ
 * [EN] Inline SVG icon markup strings for dialog headers
 * @constant
 */
export const ICON_SVG = {
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="11" x2="12" y2="17"/><circle cx="12" cy="7.5" r="0.5" fill="#fff" stroke-width="2"/></svg>`,
    question: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M9 9a3 3 0 1 1 4.6 2.5c-.9.6-1.6 1.2-1.6 2.3"/><circle cx="12" cy="17" r="0.5" fill="#fff" stroke-width="2"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4 10-10"/></svg>`,
    cross: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
};

/* จองพื้นที่ scrollbar (gutter) ตลอดที่ dialog เปิด กัน layout ขยับตอน swal lock scroll (body overflow:hidden)
   ทำที่นี่ครั้งเดียวแทนการเติม class ทีละหน้า — ครอบคลุมทุกหน้าที่เรียก dialog อัตโนมัติ
   guard ownsGutter: ถ้าหน้านั้นจอง gutter ไว้เองอยู่แล้ว (persistent) จะไม่ไปแตะ/ถอด class ของเขา */
let swalReservedGutter = false;
function reserveGutterForSwal() {
    const docEl = document.documentElement;
    // จองเฉพาะเมื่อหน้านั้นมี scrollbar อยู่จริง (คือมีของที่ swal จะเอาออกตอน lock scroll)
    // ถ้าหน้าไม่มี scrollbar อยู่แล้ว การจอง gutter จะกลับกลายเป็นตัวทำให้ layout ขยับเสียเอง
    const hasScrollbar = window.innerWidth - docEl.clientWidth > 0;
    if (hasScrollbar && !docEl.classList.contains("reserve-scrollbar-gutter")) {
        docEl.classList.add("reserve-scrollbar-gutter");
        swalReservedGutter = true;
    }
}
function releaseGutterForSwal() {
    if (swalReservedGutter) {
        document.documentElement.classList.remove("reserve-scrollbar-gutter");
        swalReservedGutter = false;
    }
}

/* heightAuto: false กัน layout พังใน LINE LIFF (100dvh)
   scrollbarPadding: false ทำงานคู่กับ scroll-lock fix ใน globals.css */

/**
 * [TH] อ็อบเจกต์ SweetAlert2 Mixin หลักที่ตั้งค่าคลาส CSS, ฟอนต์ และการจองพื้นที่ Scrollbar Gutter
 * [EN] Base SweetAlert2 mixin instance preconfigured with custom classes and gutter management
 * @constant
 */
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
    // willOpen/didClose ไม่ถูก fire ตัวไหน override จึงทำงานกับทุก dialog ที่ผ่าน baseSwal
    willOpen: reserveGutterForSwal,
    didClose: releaseGutterForSwal,
});

/**
 * [TH] ตัวเลือกสำหรับการแสดงกล่องข้อความยืนยันการทำงาน (Confirm Dialog)
 * [EN] Options interface for generic confirmation modal dialogs
 */
export interface ConfirmDialogOptions {
    /** [TH] หัวข้อกล่องข้อความ [EN] Modal dialog title */
    title: string;
    /** [TH] ข้อความรายละเอียด [EN] Optional description text */
    text?: string;
    /** [TH] ข้อความบนปุ่มยืนยัน [EN] Confirm button label */
    confirmText?: string;
    /** [TH] ระดับโทนสี [EN] Tone severity variant */
    tone?: SwalTone;
}

/**
 * [TH] แสดงกล่องข้อความยืนยันการกระทำ (Confirm Dialog) และคืนค่า true หากผู้ใช้กดยืนยัน
 * [EN] Displays a confirmation modal dialog and resolves to true if confirmed
 *
 * @async
 * @function confirmDialog
 * @param {ConfirmDialogOptions} options - การตั้งค่ากล่องข้อความ (หัวข้อ, รายละเอียด, ปุ่ม, โทนสี)
 * @returns {Promise<boolean>} เป็นจริงเมื่อผู้ใช้กดปุ่มยืนยัน
 */
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

/**
 * [TH] ตัวเลือกสำหรับกล่องข้อความยืนยันการส่งคำร้องขอให้ผู้เชี่ยวชาญตรวจสอบ
 * [EN] Options interface for sample review submission confirmation dialogs
 */
export interface ReviewConfirmDialogOptions {
    /** [TH] หัวข้อกล่องข้อความ [EN] Title */
    title: string;
    /** [TH] ข้อความอธิบาย [EN] Description text */
    text?: string;
    /** [TH] รายการสาเหตุที่ต้องส่งตรวจสอบ [EN] Array of review reason bullet points */
    reasons?: string[];
    /** [TH] บังคับให้กรอกหมายเหตุหรือไม่ [EN] Whether notes input is mandatory */
    requireNote?: boolean;
    /**
     * [TH] ล็อกสิทธิ์ให้ผู้ดูแลระบบแก้ไขชนิดสารได้เสมอ โดยผู้ส่งเลือกเป็นอย่างอื่นไม่ได้ (ใช้เมื่อ AI ไม่พบหลอดทดลองในภาพ)
     * [EN] Forces permission granting admin to alter parameter type when AI detects no tube
     */
    forceAllowAdminChange?: boolean;
}

/**
 * [TH] แสดงกล่องข้อความยืนยันการส่งตัวอย่างน้ำเพื่อรอการตรวจสอบโดยผู้เชี่ยวชาญ (พร้อมเหตุผล, หมายเหตุ, และการอนุญาตแก้ไขชนิดสาร)
 * [EN] Displays a specialized review confirmation modal allowing input notes and admin override permissions
 *
 * @async
 * @function reviewConfirmDialog
 * @param {ReviewConfirmDialogOptions} options - การตั้งค่ากล่องข้อความส่งตรวจสอบ
 * @returns {Promise<{ confirmed: boolean; reviewNote?: string; allowAdminChange: boolean }>} ผลการตัดสินใจของผู้ใช้
 */
export async function reviewConfirmDialog({
    title,
    text,
    reasons = [],
    requireNote = false,
    forceAllowAdminChange = false,
}: ReviewConfirmDialogOptions): Promise<{ confirmed: boolean; reviewNote?: string; allowAdminChange: boolean }> {
    const reasonsHtml = reasons.length > 0 ? `
        <div class="text-sm bg-bg-warning border border-border-warning text-text-warning" style="text-align: left; margin-bottom: 12px; padding: 12px; border-radius: 8px;">
            <p style="margin-bottom: 6px; font-weight: 600;">สาเหตุที่ต้องรอการตรวจสอบ:</p>
            <ul style="padding-left: 0; margin-bottom: 0; margin-top: 0;">
                ${reasons.map(r => `<li>${r}</li>`).join("")}
            </ul>
        </div>
    ` : '';

    // ปกติผู้ส่งเลือกเองว่าจะให้ผู้ดูแลระบบแก้ชนิดสารได้ไหม
    // แต่เมื่อ AI ไม่พบหลอดทดลอง ยืนยันไม่ได้ทั้งค่าและชนิดสาร จึงล็อกเป็น "อนุญาต" ไม่ให้เลือก
    // ถ้าปล่อยให้เลือก "ไม่อนุญาต" คำร้องจะเข้าคิวโดยที่ผู้ดูแลระบบแก้อะไรไม่ได้เลย กลายเป็นทางตัน
    const permissionHtml = forceAllowAdminChange
        ? `
                <div class="mt-6 flex flex-col gap-2">
                    <label class="text-xs font-semibold text-text">การอนุญาตให้แก้ไขชนิดสาร</label>
                    <div class="flex items-start gap-2.5 p-3 rounded-lg border border-border-warning bg-bg-warning text-text-warning">
                        <div class="flex flex-col text-xs text-left">
                            <span class="font-semibold leading-tight">อนุญาตให้แก้ไขได้ (บังคับสำหรับกรณีนี้)</span>
                            <span class="text-xs leading-snug mt-0.5">AI ไม่พบหลอดทดลองในภาพ จึงยืนยันทั้งค่าและชนิดสารไม่ได้ ผู้ดูแลระบบต้องแก้ไขให้ได้จึงจะตรวจสอบคำร้องนี้ต่อได้</span>
                        </div>
                    </div>
                </div>
        `
        : `
                <div class="mt-6 flex flex-col gap-2">
                    <label class="text-xs font-semibold text-text">
                        การอนุญาตให้แก้ไขชนิดสาร <span style="color: red;">*</span>
                    </label>
                    <div class="flex flex-col gap-2">
                        <label id="label-allow-true" class="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-surface-subtle cursor-pointer hover:bg-surface transition-colors">
                            <div class="pt-0.5">
                                <input type="radio" name="swal-allow-admin-change" value="true" class="w-4 h-4 text-warning focus:ring-warning cursor-pointer" />
                            </div>
                            <div class="flex flex-col text-xs text-left">
                                <span class="font-semibold leading-tight">อนุญาตให้แก้ไขได้ (แนะนำ)</span>
                                <span class="text-xs leading-snug mt-0.5">หากผู้เชี่ยวชาญตรวจสอบพบว่า AI ทำนายชนิดสารผิดพลาด</span>
                            </div>
                        </label>
                        <label id="label-allow-false" class="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-surface-subtle cursor-pointer hover:bg-surface transition-colors">
                            <div class="pt-0.5">
                                <input type="radio" name="swal-allow-admin-change" value="false" class="w-4 h-4 text-warning focus:ring-warning cursor-pointer" />
                            </div>
                            <div class="flex flex-col text-xs text-left">
                                <span class="font-semibold leading-tight">ไม่อนุญาต</span>
                                <span class="text-xs leading-snug mt-0.5">ยืนยันใช้ชนิดสารตามที่ปรากฏในระบบนี้เท่านั้น</span>
                            </div>
                        </label>
                    </div>
                </div>
        `;

    const result = await baseSwal.fire({
        title,
        html: `
            <p class="text-sm" style="color: var(--color-text-secondary); margin-bottom: 16px;">${text}</p>
            ${reasonsHtml}
            <div style="text-align: left; margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                    <label for="swal-review-note" class="text-xs font-semibold text-text">
                        หมายเหตุถึงผู้ดูแลระบบ ${requireNote ? '<span style="color: red;">*</span>' : '(ไม่บังคับ)'}
                    </label>
                    <span id="swal-char-count" class="text-xs" style="color: var(--color-text-muted);">0 / 200</span>
                </div>
                <textarea id="swal-review-note" maxlength="200" placeholder="${requireNote ? 'กรุณาระบุเหตุผลที่ต้องการให้ตรวจสอบเพิ่มเติม' : 'ระบุสาเหตุที่ต้องการให้ตรวจสอบเพิ่มเติม หรือบอกสิ่งที่ต้องการให้แอดมินช่วยดู...'}" class="w-full min-h-[100px] resize-none p-3 border border-border rounded-xl text-sm bg-surface-subtle focus:bg-surface focus:border-warning focus:ring-4 focus:ring-warning/20 outline-none transition-all placeholder:text-text-muted mt-1 text-text"></textarea>
                
                ${permissionHtml}
            </div>
        `,
        iconHtml: ICON_SVG.info,
        showCancelButton: true,
        confirmButtonText: "ส่งเพื่อรอตรวจสอบ",
        cancelButtonText: "ยกเลิก",
        reverseButtons: true,
        didRender: (popup) => {
            popup.style.setProperty("--swal-tone", TONE_COLOR.review);
            const textarea = document.getElementById("swal-review-note") as HTMLTextAreaElement;
            const counter = document.getElementById("swal-char-count");
            const confirmBtn = Swal.getConfirmButton();

            const updateButtonState = () => {
                if (!confirmBtn) return;
                
                const isNoteEmpty = textarea ? textarea.value.trim().length === 0 : false;
                const noteInvalid = requireNote && isNoteEmpty;
                
                // โหมดบังคับไม่มี radio ให้เลือก จึงถือว่าผ่านเงื่อนไขนี้ไปเลย
                const radios = document.querySelectorAll('input[name="swal-allow-admin-change"]');
                let radioSelected = forceAllowAdminChange;
                radios.forEach((r) => { if ((r as HTMLInputElement).checked) radioSelected = true; });

                const isInvalid = noteInvalid || !radioSelected;
                confirmBtn.disabled = isInvalid;
                
                if (isInvalid) {
                    if (!radioSelected) {
                        confirmBtn.textContent = "กรุณาเลือกการอนุญาต";
                    } else if (noteInvalid) {
                        confirmBtn.textContent = "กรุณากรอกหมายเหตุ";
                    }
                    confirmBtn.style.backgroundColor = "#e2e8f0"; // เทาอ่อน
                    confirmBtn.style.color = "#94a3b8";
                    confirmBtn.style.cursor = "not-allowed";
                } else {
                    confirmBtn.textContent = "ส่งเพื่อรอตรวจสอบ";
                    confirmBtn.style.backgroundColor = "";
                    confirmBtn.style.color = "";
                    confirmBtn.style.cursor = "";
                }
            };

            const updateRadioStyles = () => {
                const radioTrue = document.querySelector('input[value="true"]') as HTMLInputElement;
                const radioFalse = document.querySelector('input[value="false"]') as HTMLInputElement;
                const labelTrue = document.getElementById("label-allow-true");
                const labelFalse = document.getElementById("label-allow-false");

                if (radioTrue && labelTrue) {
                    if (radioTrue.checked) {
                        labelTrue.className = "flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors border-border-warning bg-bg-warning text-text-warning";
                    } else {
                        labelTrue.className = "flex items-start gap-2.5 p-3 rounded-lg border border-border bg-surface-subtle cursor-pointer hover:bg-surface transition-colors";
                    }
                }
                if (radioFalse && labelFalse) {
                    if (radioFalse.checked) {
                        labelFalse.className = "flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors border-border-warning bg-bg-warning text-text-warning";
                    } else {
                        labelFalse.className = "flex items-start gap-2.5 p-3 rounded-lg border border-border bg-surface-subtle cursor-pointer hover:bg-surface transition-colors";
                    }
                }
            };

            // Initial state
            updateButtonState();

            if (textarea) {
                textarea.addEventListener("input", () => {
                    if (counter) {
                        counter.textContent = `${textarea.value.length} / 200`;
                    }
                    updateButtonState();
                });
            }

            const radios = document.querySelectorAll('input[name="swal-allow-admin-change"]');
            radios.forEach(radio => {
                radio.addEventListener("change", () => {
                    updateRadioStyles();
                    updateButtonState();
                });
            });
        },
        preConfirm: () => {
            const el = document.getElementById("swal-review-note") as HTMLTextAreaElement;
            const radioTrue = document.querySelector('input[name="swal-allow-admin-change"][value="true"]') as HTMLInputElement;
            const val = el ? el.value.trim() : "";
            
            // Check radio required (actually UI prevents click if invalid, but good to have fallback)
            const radios = document.querySelectorAll('input[name="swal-allow-admin-change"]');
            let radioSelected = forceAllowAdminChange;
            radios.forEach((r) => { if ((r as HTMLInputElement).checked) radioSelected = true; });

            if (!radioSelected) {
                Swal.showValidationMessage("กรุณาเลือกว่าอนุญาตให้แก้ไขชนิดสารหรือไม่");
                return false;
            }

            if (requireNote && !val) {
                Swal.showValidationMessage("กรุณากรอกเหตุผลที่ต้องการให้ตรวจสอบ");
                return false;
            }
            return {
                reviewNote: val,
                allowAdminChange: forceAllowAdminChange || (radioTrue ? radioTrue.checked : false)
            };
        }
    });

    return { 
        confirmed: result.isConfirmed, 
        reviewNote: result.value?.reviewNote,
        allowAdminChange: result.value?.allowAdminChange || false
    };
}

/**
 * [TH] แสดงกล่องข้อความแจ้งผลการดำเนินการสำเร็จแบบปุ่มเดียวเต็มความกว้าง
 * [EN] Displays a single-button full-width success alert dialog
 *
 * @function alertSuccess
 * @param {string} title - หัวข้อข้อความ
 * @param {SwalTone} [tone="danger"] - โทนสี
 * @param {string} [text] - รายละเอียดเพิ่มเติม
 * @returns {Promise<SweetAlertResult>}
 */
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

/**
 * [TH] แสดงกล่องข้อความแจ้งข้อผิดพลาด (Error Dialog) โทนสีแดง
 * [EN] Displays a single-button full-width error alert dialog
 *
 * @function alertError
 * @param {string} title - หัวข้อข้อผิดพลาด
 * @param {string} [text] - รายละเอียดข้อผิดพลาด
 * @param {string} [confirmText="เข้าใจแล้ว"] - ข้อความบนปุ่ม
 * @returns {Promise<SweetAlertResult>}
 */
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

/**
 * [TH] แสดง Toast แจ้งเตือนข้อผิดพลาดขนาดกะทัดรัดที่มุมขวาบน (ปิดเองอัตโนมัติ)
 * [EN] Displays a compact auto-dismissing error toast notification in the top-right corner
 *
 * @function errorToast
 * @param {string} title - หัวข้อข้อความ
 * @param {string} [text] - รายละเอียดเพิ่มเติม
 * @returns {Promise<SweetAlertResult>}
 */
export function errorToast(title: string, text?: string) {
    return toastSwal.fire({ icon: "error", title, text });
}

/**
 * [TH] แสดงกล่องสปินเนอร์กำลังโหลดข้อมูลระหว่างรอการทำงาน (ไม่สามารถกดปิดได้)
 * [EN] Displays a modal loading spinner blocking user interaction during long operations
 *
 * @function loadingDialog
 * @param {string} title - หัวข้อกำลังโหลด
 * @param {string} [text] - รายละเอียด
 * @returns {Promise<SweetAlertResult>}
 */
export function loadingDialog(title: string, text?: string) {
    return baseSwal.fire({
        title,
        text,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => baseSwal.showLoading(),
    });
}

/**
 * [TH] ปิดกล่องข้อความ SweetAlert2 ที่เปิดอยู่ทั้งหมดในปัจจุบัน
 * [EN] Closes any currently active SweetAlert2 modal dialog
 *
 * @function closeDialog
 * @returns {void}
 */
export function closeDialog() {
    baseSwal.close();
}

/**
 * [TH] แสดงกล่องข้อความยืนยันการออกจากระบบ (Logout Dialog)
 * [EN] Displays a specialized confirmation dialog for logging out of the application
 *
 * @function confirmLogoutAlert
 * @returns {Promise<SweetAlertResult>}
 */
export function confirmLogoutAlert() {
    return baseSwal.fire({
        title: "ต้องการออกจากระบบใช่หรือไม่",
        iconHtml: ICON_SVG.cross,
        showCancelButton: true,
        confirmButtonText: "ออกจากระบบ",
        cancelButtonText: "ยกเลิก",
        reverseButtons: true,
        didRender: (popup) => {
            popup.style.setProperty("--swal-tone", TONE_COLOR.danger);
            popup.classList.add("app-swal--double");
        },
    });
}
