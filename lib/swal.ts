"use client";

import Swal from "sweetalert2";

/* Dialog กลางของแอปตาม prototype: การ์ดขาวมุมโค้ง ไอคอนวงกลมทึบ
   เลือกโทนตามผลกระทบของ action ไม่ใช่ตามประเภทงาน (แก้ไข/ลบ):
   - danger  = ย้อนกลับไม่ได้ (ปฏิเสธคำร้อง, ลบข้อมูล)
   - warning = ย้อนกลับได้แต่กระทบคนอื่น/ระบบถ้าเลือกผิด (เปลี่ยนสิทธิ์ผู้ใช้)
   - primary = action เชิงบวก ความเสี่ยงต่ำ (อนุมัติคำร้องที่ผู้ใช้ขอเอง) */
export type SwalTone = "danger" | "warning" | "primary" | "review";

export const TONE_COLOR: Record<SwalTone, string> = {
    danger: "#B91C1C",
    warning: "#B45309",
    primary: "var(--color-primary, #06647F)",
    // เดียวกับปุ่ม "ส่งให้ผู้เชี่ยวชาญตรวจสอบ" (#FE9A00) — ใช้เฉพาะ dialog ยืนยันการส่งตรวจสอบ
    review: "#FE9A00",
};

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

export interface ReviewConfirmDialogOptions {
    title: string;
    text?: string;
    reasons?: string[];
    requireNote?: boolean;
    /**
     * ล็อกสิทธิ์ให้ผู้ดูแลระบบแก้ไขชนิดสารได้เสมอ โดยผู้ส่งเลือกเป็นอย่างอื่นไม่ได้
     * ใช้เมื่อ AI ไม่พบหลอดทดลองในภาพ — ยืนยันไม่ได้ทั้งค่าและชนิดสาร
     */
    forceAllowAdminChange?: boolean;
}

/** Dialog ยืนยันก่อนส่งเพื่อรอตรวจสอบ (สำหรับเคสที่ต้องให้แอดมินช่วยดู) พร้อมกล่องข้อความระบุสาเหตุ */
export async function reviewConfirmDialog({
    title,
    text,
    reasons = [],
    requireNote = false,
    forceAllowAdminChange = false,
}: ReviewConfirmDialogOptions): Promise<{ confirmed: boolean; reviewNote?: string; allowAdminChange: boolean }> {
    const reasonsHtml = reasons.length > 0 ? `
        <div class="bg-bg-warning border border-border-warning text-text-warning" style="text-align: left; font-size: 14px; margin-bottom: 12px; padding: 12px; border-radius: 8px;">
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
                    <label class="text-text" style="font-size: 13px; font-weight: 600;">การอนุญาตให้แก้ไขชนิดสาร</label>
                    <div class="flex items-start gap-2.5 p-3 rounded-lg border border-border-warning bg-bg-warning text-text-warning">
                        <div class="flex flex-col text-xs text-left">
                            <span class="font-semibold leading-tight">อนุญาตให้แก้ไขได้ (บังคับสำหรับกรณีนี้)</span>
                            <span class="text-[10px] leading-snug mt-0.5">AI ไม่พบหลอดทดลองในภาพ จึงยืนยันทั้งค่าและชนิดสารไม่ได้ ผู้ดูแลระบบต้องแก้ไขให้ได้จึงจะตรวจสอบคำร้องนี้ต่อได้</span>
                        </div>
                    </div>
                </div>
        `
        : `
                <div class="mt-6 flex flex-col gap-2">
                    <label class="text-text" style="font-size: 13px; font-weight: 600;">
                        การอนุญาตให้แก้ไขชนิดสาร <span style="color: red;">*</span>
                    </label>
                    <div class="flex flex-col gap-2">
                        <label id="label-allow-true" class="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-surface-subtle cursor-pointer hover:bg-surface transition-colors">
                            <div class="pt-0.5">
                                <input type="radio" name="swal-allow-admin-change" value="true" class="w-4 h-4 text-warning focus:ring-warning cursor-pointer" />
                            </div>
                            <div class="flex flex-col text-xs text-left">
                                <span class="font-semibold leading-tight">อนุญาตให้แก้ไขได้ (แนะนำ)</span>
                                <span class="text-[10px] leading-snug mt-0.5">หากผู้เชี่ยวชาญตรวจสอบพบว่า AI ทำนายชนิดสารผิดพลาด</span>
                            </div>
                        </label>
                        <label id="label-allow-false" class="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-surface-subtle cursor-pointer hover:bg-surface transition-colors">
                            <div class="pt-0.5">
                                <input type="radio" name="swal-allow-admin-change" value="false" class="w-4 h-4 text-warning focus:ring-warning cursor-pointer" />
                            </div>
                            <div class="flex flex-col text-xs text-left">
                                <span class="font-semibold leading-tight">ไม่อนุญาต</span>
                                <span class="text-[10px] leading-snug mt-0.5">ยืนยันใช้ชนิดสารตามที่ปรากฏในระบบนี้เท่านั้น</span>
                            </div>
                        </label>
                    </div>
                </div>
        `;

    const result = await baseSwal.fire({
        title,
        html: `
            <p style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: 16px;">${text}</p>
            ${reasonsHtml}
            <div style="text-align: left; margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
                    <label for="swal-review-note" class="text-text" style="font-size: 13px; font-weight: 600;">
                        หมายเหตุถึงผู้ดูแลระบบ ${requireNote ? '<span style="color: red;">*</span>' : '(ไม่บังคับ)'}:
                    </label>
                    <span id="swal-char-count" style="font-size: 11px; color: var(--color-text-muted);">0 / 200</span>
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

/** Dialog สปินเนอร์ระหว่างรอ action ยาว (เช่น บันทึกข้อมูล) — ปิดด้วย closeDialog() เมื่อเสร็จ */
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

export function closeDialog() {
    baseSwal.close();
}

/** Dialog ยืนยันออกจากระบบ — โทนแดง double icon (ใช้ในหน้าจัดการ) */
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
