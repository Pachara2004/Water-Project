/**
 * Thai Seawater Quality Standards
 * มาตรฐานคุณภาพน้ำทะเลของประเทศไทย
 * ─────────────────────────────────────────────────────────
 * Reference: กรมควบคุมมลพิษ (Pollution Control Department)
 */

// ประเภทการใช้ประโยชน์ — ตอนนี้มาจากตาราง `location_types` ใน DB ผ่าน codegen (npm run gen:location-types)
// ไม่ต้องมาแก้ที่นี่เวลาเพิ่มโซนใหม่: insert แถวใน DB แล้วรัน gen ใหม่
export type { LocationTypeCode } from "./generated/location-types";
export { LOCATION_TYPE_CODES, DEFAULT_LOCATION_TYPE_CODE, isLocationTypeCode } from "./generated/location-types";

import type { LocationTypeCode } from "./generated/location-types";

/** @deprecated ใช้ `LocationTypeCode` ที่ gen จาก DB แทน — alias นี้ไว้กันของเดิมพังระหว่างเปลี่ยนผ่าน */
export type LocationType = LocationTypeCode;

export interface StandardThresholds {
    phosphateMax: number;
    ammoniaMax: number;
}

/**
 * @deprecated แหล่งความจริงย้ายไปตาราง `standards` ใน DB แล้ว — แก้ค่าที่นี่จะไม่มีผลกับที่ DB
 * ค่าชุดนี้ยังอยู่ชั่วคราวเพราะ ResultsPanel / BottomSheet ยังอ่านตรงจากตัวแปรนี้อยู่
 * จะถูกลบทิ้งเมื่อฝั่ง API ส่งเกณฑ์ลงมาให้แทน (เฟส 3)
 */
export const LOCATION_STANDARDS: Record<LocationType, StandardThresholds> = {
    CONSERVATION: { phosphateMax: 0.015, ammoniaMax: 0.1 },
    CORAL_REEF: { phosphateMax: 0.015, ammoniaMax: 0.1 },
    AQUACULTURE: { phosphateMax: 0.045, ammoniaMax: 0.7 },
    RECREATION: { phosphateMax: 0.015, ammoniaMax: 0.2 },
    INDUSTRY: { phosphateMax: 0.045, ammoniaMax: 0.95 },
    COMMUNITY: { phosphateMax: 0.045, ammoniaMax: 0.95 },
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
    CONSERVATION: "เพื่อการอนุรักษ์ทรัพยากรธรรมชาติ",
    CORAL_REEF: "เพื่อการอนุรักษ์แหล่งปะการัง",
    AQUACULTURE: "เพื่อการเพาะเลี้ยงสัตว์น้ำ",
    RECREATION: "เพื่อการนันทนาการ",
    INDUSTRY: "เพื่อการอุตสาหกรรมและท่าเรือ",
    COMMUNITY: "สำหรับเขตชุมชน",
};

// 2. สลับเปลี่ยนค่าสถานะไทป์ให้เป็นตัวพิมพ์เล็กตามระบบสากลใหม่ของ
export type StatusType = "safe" | "warning" | "danger";

/**
 * เกณฑ์ความมั่นใจขั้นต่ำของผลวิเคราะห์ AI
 * ใช้ร่วมกันทั้งฝั่ง client (แจ้งเตือนผู้ใช้) และฝั่ง server (ตัดสินสร้าง ReviewRequest)
 * ห้ามเชื่อการตัดสินจาก client — server ต้องคำนวณซ้ำจาก confidence ที่บันทึกเสมอ
 */
export const CONFIDENCE_THRESHOLD = 0.6;

export function isLowConfidence(confidence: number | null | undefined): boolean {
    return confidence !== null && confidence !== undefined && confidence < CONFIDENCE_THRESHOLD;
}

/**
 * Determine the status for a single parameter against its maximum threshold
 * ปรับคำนวณจุด Warning: หากค่าน้ำเกิน 70% ของเกณฑ์สูงสุด ให้ขึ้นสถานะเฝ้าระวังทันที
 */
export function getParameterStatus(value: number | null | undefined, max: number): StatusType {
    if (value === null || value === undefined) return "safe";

    if (value > max) return "danger";
    if (value >= max * 0.7) return "warning";
    return "safe";
}

export interface EvaluationResult {
    phosphateStatus: StatusType;
    ammoniaStatus: StatusType;
    overallStatus: StatusType;
}

/**
 * Determine overall water quality status based on location type
 */
export function evaluateSample(phosphate: number | null | undefined, ammonia: number | null | undefined, locationType: LocationType = "COMMUNITY"): EvaluationResult {
    const standards = LOCATION_STANDARDS[locationType];

    const phosphateStatus = getParameterStatus(phosphate, standards.phosphateMax);
    const ammoniaStatus = getParameterStatus(ammonia, standards.ammoniaMax);

    // ลอจิกรวบยอดหาความเสี่ยงสูงสุด
    let overallStatus: StatusType = "safe";
    if (phosphateStatus === "danger" || ammoniaStatus === "danger") {
        overallStatus = "danger";
    } else if (phosphateStatus === "warning" || ammoniaStatus === "warning") {
        overallStatus = "warning";
    }

    return {
        phosphateStatus,
        ammoniaStatus,
        overallStatus,
    };
}

/**
 * Evaluate sample against ALL standards to see which it passes
 */
export function evaluateAllStandards(phosphate: number | null | undefined, ammonia: number | null | undefined): Record<LocationType, boolean> {
    const results = {} as Record<LocationType, boolean>;

    for (const [type, std] of Object.entries(LOCATION_STANDARDS)) {
        const locType = type as LocationType;
        // ผ่านเกณฑ์ของสิทธิ์โซนนั้น ๆ หมายความว่าค่าน้ำต้องไม่หลุดไปอยู่ในระดับอันตราย (danger)
        const po4Passed = getParameterStatus(phosphate, std.phosphateMax) !== "danger";
        const nh3Passed = getParameterStatus(ammonia, std.ammoniaMax) !== "danger";
        results[locType] = po4Passed && nh3Passed;
    }

    return results;
}

/**
 * Get Thai label for status
 */
export function getStatusLabel(status: StatusType): string {
    const labels: Record<StatusType, string> = {
        safe: "ปลอดภัย",
        warning: "เฝ้าระวัง",
        danger: "อันตราย",
    };
    return labels[status];
}

/**
 * Get organization Thai label
 */
export function getOrganizationLabel(org: string): string {
    const labels: Record<string, string> = {
        FISHERY: "กรมประมง",
        POLLUTION: "กรมควบคุมมลพิษ",
        OTHER: "อื่นๆ",
    };
    return labels[org] || org;
}
