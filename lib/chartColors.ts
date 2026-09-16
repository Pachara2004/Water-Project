/**
 * @fileoverview System-wide color and theme definitions for charts, statuses, and map pins
 *
 * [TH] แหล่งความจริงเดียว (Single Source of Truth) สำหรับรหัสสีของกราฟ ระดับสถานะ และหมุดแผนที่
 * [EN] Single Source of Truth for system-wide color palette covering charts, statuses, and map pins
 *
 * @description
 * [TH] จัดเก็บรหัสสี Hex สำหรับระดับสถานะคุณภาพน้ำ (safe, warning, danger, noData), หมุดบนแผนที่,
 * และสีประจำสารเคมี (พร้อมอัลกอริทึม FNV-1a Hash สำหรับสารใหม่ที่ไม่เคยกำหนดสีมาก่อน)
 * [EN] Centralizes HEX colors for water quality statuses, map pin styling, and chemical parameters
 * with deterministic FNV-1a hash fallbacks for dynamically added parameters.
 *
 * @module lib/chartColors
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-20
 * @modified 2026-07-20
 *
 * @history
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: รวมสีสารและสถานะเป็น Single Source of Truth ใน lib/chartColors.ts
 */

/**
 * [TH] รหัสสี HEX สำหรับระดับสถานะคุณภาพน้ำ (safe, warning, danger, noData)
 * [EN] HEX color codes for water quality status levels (safe, warning, danger, noData)
 * @constant
 */
export const STATUS_COLOR = {
    safe: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    /** ไม่มีข้อมูล/ประเมินไม่ได้ — คนละความหมายกับ safe */
    noData: "#94a3b8",
} as const;

/**
 * [TH] ชุดสีเฉดประกอบของหมุดบนแผนที่ (fill, stroke, inner) ตามระดับสถานะคุณภาพน้ำ
 * [EN] Composite pin color styling palette (fill, stroke, inner) per water quality status
 * @constant
 */
export const STATUS_PIN_COLOR: Record<"safe" | "warning" | "danger" | "noData", { fill: string; stroke: string; inner: string }> = {
    safe: { fill: STATUS_COLOR.safe, stroke: "#059669", inner: "#D1FAE5" },
    warning: { fill: STATUS_COLOR.warning, stroke: "#D97706", inner: "#FEF3C7" },
    danger: { fill: STATUS_COLOR.danger, stroke: "#DC2626", inner: "#FEE2E2" },
    noData: { fill: STATUS_COLOR.noData, stroke: "#64748B", inner: "#F1F5F9" },
};

/**
 * [TH] รหัสสี HEX ประจำสารเคมีหลักที่ระบบรองรับ (ammonia, phosphate)
 * [EN] HEX color codes mapped to recognized primary chemical parameters
 * @constant
 */
export const PARAMETER_COLOR: Record<string, string> = {
    ammonia: "#f59e0b",
    phosphate: "#6366f1",
};

/** Tailwind class ของสารที่รู้จัก — ต้องเป็นเฉดเดียวกับ PARAMETER_COLOR ตัวต่อตัว */
const PARAMETER_ICON_CLASS: Record<string, string> = {
    ammonia: "text-amber-500",
    phosphate: "text-indigo-500",
};

/**
 * พาเลตสำรองสำหรับสารที่ยังไม่ได้กำหนดสีไว้ (แอดมินเพิ่มใน DB ภายหลัง)
 * เลือกด้วย hash ของชื่อ สารเดิมจึงได้สีเดิมทุกครั้งที่เรนเดอร์
 *
 * ไม่มี amber/indigo อยู่ในชุดนี้ เพื่อไม่ให้สารใหม่บังเอิญได้สีซ้ำกับ ammonia/phosphate
 */
const FALLBACK_COLORS = ["#14b8a6", "#a855f7", "#0ea5e9", "#f43f5e", "#65a30d"];
const FALLBACK_ICON_CLASSES = ["text-teal-500", "text-purple-500", "text-sky-500", "text-rose-500", "text-lime-600"];

/**
 * FNV-1a + avalanche mix
 *
 * สูตรเดิม (hash * 31 + charCode) กระจายตัวแย่มากกับพาเลตขนาดเล็ก เพราะ 31 ≡ 1 (mod 5)
 * ทำให้ผลลัพธ์ขึ้นกับผลบวกรหัสอักขระเฉย ๆ — ทดสอบด้วยชื่อสาร 8 ตัวแล้วได้สีเดียวกัน 5 ตัว
 * สารสองตัวที่ได้สีเดียวกันบนกราฟเดียวกันคือแยกเส้นไม่ออก
 */
function fallbackIndex(name: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < name.length; i++) {
        hash ^= name.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d) >>> 0;
    // ต้อง >>> 0 ปิดท้าย เพราะ ^ คืนค่า int32 แบบมีเครื่องหมาย ค่าติดลบจะทำให้ % ได้ดัชนีติดลบ
    hash = (hash ^ (hash >>> 15)) >>> 0;
    return hash % FALLBACK_COLORS.length;
}

/**
 * [TH] รับรหัสสี HEX ประจำสารเคมี (หากเป็นสารใหม่ที่ไม่ได้ระบุ จะสุ่มแบบคงที่ด้วยอัลกอริทึม FNV-1a hash)
 * [EN] Retrieves the HEX color for a chemical parameter name, falling back to a deterministic FNV-1a hash palette
 *
 * @function parameterColor
 * @param {string} name - ชื่อสารเคมี (เช่น ammonia, phosphate)
 * @returns {string} รหัสสีรูปแบบ HEX string (เช่น #f59e0b)
 */
export function parameterColor(name: string): string {
    const key = name.trim().toLowerCase();
    return PARAMETER_COLOR[key] ?? FALLBACK_COLORS[fallbackIndex(key)];
}

/**
 * [TH] รับคลาสสี Tailwind CSS สำหรับไอคอนประจำสารเคมี (ให้สอดคล้องกับ parameterColor เสมอ)
 * [EN] Retrieves the matching Tailwind CSS text color class for a chemical parameter icon
 *
 * @function parameterIconClass
 * @param {string} name - ชื่อสารเคมี
 * @returns {string} คลาส Tailwind CSS (เช่น text-amber-500)
 */
export function parameterIconClass(name: string): string {
    const key = name.trim().toLowerCase();
    return PARAMETER_ICON_CLASS[key] ?? FALLBACK_ICON_CLASSES[fallbackIndex(key)];
}
