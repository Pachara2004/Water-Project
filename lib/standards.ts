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

// ตาราง LOCATION_STANDARDS และ LOCATION_TYPE_LABELS ที่เคยอยู่ตรงนี้ถูกลบแล้ว
// ค่าเกณฑ์และป้ายชื่อย้ายไปอยู่ในตาราง `standards` / `location_types` ใน DB ทั้งหมด
// ฝั่ง server โหลดผ่าน lib/standards-db.ts | ฝั่ง client รับผ่าน /api/location-types

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

/** ค่าที่วัดได้ 1 ตัว — ผูกสารด้วย parameterId ไม่ใช่ชื่อ */
export interface MeasuredValue {
    parameterId: number;
    value: number | null | undefined;
}

/** 1 แถวจากตาราง `standards` — เกณฑ์ของสารหนึ่งภายใต้ประเภทการใช้ประโยชน์หนึ่ง */
export interface StandardRow {
    parameterId: number;
    maxValue: number;
}

const STATUS_SEVERITY: Record<StatusType, number> = { safe: 0, warning: 1, danger: 2 };

/** เอาสถานะที่แย่กว่าระหว่างสองตัว */
export function worseStatus(a: StatusType, b: StatusType): StatusType {
    return STATUS_SEVERITY[a] >= STATUS_SEVERITY[b] ? a : b;
}

/**
 * สถานะของค่า 1 ตัว เทียบกับ "ทุกเกณฑ์ของสารนั้น" แล้วเอาผลที่แย่สุด
 *
 * คืน null เมื่อสารนั้นไม่มีเกณฑ์กำหนดสักตัว — ต่างจาก "safe" อย่างสิ้นเชิง
 * ("ไม่มีเกณฑ์" = ตัดสินไม่ได้ ส่วน "safe" = ตัดสินแล้วว่าผ่าน) ผู้เรียกต้องแยกสองกรณีนี้เอง
 */
export function evaluateValueAgainstStandards(value: number | null | undefined, maxValues: number[]): StatusType | null {
    if (maxValues.length === 0) return null;
    return maxValues.reduce<StatusType>((acc, max) => worseStatus(acc, getParameterStatus(value, max)), "safe");
}

/** จัดกลุ่มเกณฑ์ตามสาร เพื่อให้ค้นด้วย parameterId ได้ในครั้งเดียว */
export function groupStandardsByParameter(standards: StandardRow[]): Map<number, number[]> {
    const grouped = new Map<number, number[]>();
    for (const s of standards) {
        const list = grouped.get(s.parameterId);
        if (list) list.push(s.maxValue);
        else grouped.set(s.parameterId, [s.maxValue]);
    }
    return grouped;
}

/**
 * สถานะรวมของตัวอย่าง 1 ใบ = แย่สุดของ (ทุกสารในใบ × ทุกเกณฑ์ของสารนั้น)
 *
 * ไม่มีการ "เลือกประเภทการใช้ประโยชน์" — ผลตรวจถูกเทียบกับเกณฑ์ทุกชุดที่มีเสมอ
 * สารที่ไม่มีเกณฑ์กำหนดจะถูกข้าม (ตัดสินไม่ได้ ไม่ใช่ผ่าน)
 */
export function evaluateSample(values: MeasuredValue[], standards: StandardRow[]): StatusType {
    const maxesByParameter = groupStandardsByParameter(standards);

    let overallStatus: StatusType = "safe";
    for (const measured of values) {
        const status = evaluateValueAgainstStandards(measured.value, maxesByParameter.get(measured.parameterId) ?? []);
        if (status === null) continue;
        overallStatus = worseStatus(overallStatus, status);
    }

    return overallStatus;
}

/** ประเภทการใช้ประโยชน์ 1 ชุดพร้อมเกณฑ์ของมัน — รูปแบบที่ /api/location-types ส่งลงมา */
export interface LocationTypeWithStandards {
    id: number;
    code: string;
    labelTh: string;
    standards: StandardRow[];
}

/**
 * สถานะของค่าชุดหนึ่ง เทียบกับเกณฑ์ของ "ประเภทการใช้ประโยชน์เดียว" → เอาสารที่แย่สุด
 * ใช้ทำตารางเปรียบเทียบ (ผลตรวจนี้ผ่านเกณฑ์ของแต่ละประเภทหรือไม่)
 *
 * คืน null เมื่อประเภทนั้นไม่มีเกณฑ์ของสารที่ส่งมาเลยสักตัว = ตัดสินไม่ได้ ไม่ใช่ผ่าน
 *
 * หมายเหตุ: คืน 3 ระดับ (safe/warning/danger) ไม่ใช่ boolean ผ่าน/ไม่ผ่าน — เดิมฟังก์ชันนี้
 * ยุบ warning รวมกับ safe ทำให้แผนที่โชว์ "ผ่าน" สีเขียว ขณะที่หน้า submit โชว์ "เฝ้าระวัง"
 * สำหรับน้ำก้อนเดียวกัน
 */
export function evaluateAgainstLocationType(values: MeasuredValue[], type: LocationTypeWithStandards): StatusType | null {
    const maxesByParameter = groupStandardsByParameter(type.standards);

    let result: StatusType | null = null;
    for (const measured of values) {
        const status = evaluateValueAgainstStandards(measured.value, maxesByParameter.get(measured.parameterId) ?? []);
        if (status === null) continue;
        result = result === null ? status : worseStatus(result, status);
    }

    return result;
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
