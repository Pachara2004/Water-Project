/**
 * สีของกราฟและสถานะทั้งระบบ — แหล่งความจริงเดียว
 *
 * เดิมสีถูกนิยามซ้ำกัน 4 ที่ (dashboardHelpers, AnalyticsCharts, LocationPin, widgets API)
 * ทำให้สารตัวเดียวเป็นคนละสีในแต่ละหน้า เช่น ammonia เคยเป็นทั้ง amber, violet และ rose
 *
 * เก็บเป็นค่า hex ไม่ใช่ CSS variable เพราะผู้ใช้บางรายอ่าน var() ไม่ได้:
 * recharts/SVG (ดู chartTokens ใน dashboardHelpers), ฝั่ง server ที่ส่งสีมากับ payload
 * ของ /api/dashboard/widgets และการต่อ alpha เป็น #RRGGBBAA ซึ่งต้องการ hex จริง
 */

/** สถานะคุณภาพน้ำ — ยึดชุดเดียวกับแดชบอร์ด */
export const STATUS_COLOR = {
    safe: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    /** ไม่มีข้อมูล/ประเมินไม่ได้ — คนละความหมายกับ safe */
    noData: "#94a3b8",
} as const;

/** เฉดประกอบของหมุดบนแผนที่ (ขอบและไส้ใน) อิงจากสีหลักของแต่ละสถานะ */
export const STATUS_PIN_COLOR: Record<"safe" | "warning" | "danger" | "noData", { fill: string; stroke: string; inner: string }> = {
    safe: { fill: STATUS_COLOR.safe, stroke: "#059669", inner: "#D1FAE5" },
    warning: { fill: STATUS_COLOR.warning, stroke: "#D97706", inner: "#FEF3C7" },
    danger: { fill: STATUS_COLOR.danger, stroke: "#DC2626", inner: "#FEE2E2" },
    noData: { fill: STATUS_COLOR.noData, stroke: "#64748B", inner: "#F1F5F9" },
};

/**
 * สีประจำสารที่ระบบรู้จัก — คีย์เป็นชื่อสารตัวพิมพ์เล็กตามตาราง `parameters`
 *
 * หมายเหตุ: ammonia ใช้ค่าเดียวกับ STATUS_COLOR.warning โดยตั้งใจ เพื่อให้ตรงกับสีที่
 * แดชบอร์ดใช้มาแต่เดิม ไม่ใช่ความบังเอิญ — ถ้าจะแก้ให้เลี่ยงสีชน ต้องแก้พร้อมกันทั้งระบบ
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

/** สีเส้น/แท่งกราฟประจำสาร */
export function parameterColor(name: string): string {
    const key = name.trim().toLowerCase();
    return PARAMETER_COLOR[key] ?? FALLBACK_COLORS[fallbackIndex(key)];
}

/** Tailwind class ประจำสาร — เฉดเดียวกับ `parameterColor` ของสารตัวเดียวกันเสมอ */
export function parameterIconClass(name: string): string {
    const key = name.trim().toLowerCase();
    return PARAMETER_ICON_CLASS[key] ?? FALLBACK_ICON_CLASSES[fallbackIndex(key)];
}
