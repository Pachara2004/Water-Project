/**
 * @file lib/standards.ts
 * @project Water Monitoring Project
 * @module Core / Water Quality Standards & Evaluation Engine
 * @description
 * [TH] เอนจินการประเมินคุณภาพน้ำและเกณฑ์มาตรฐานคุณภาพน้ำทะเลของประเทศไทย (Pollution Control Department)
 * ให้บริการประเมินระดับสถานะความปลอดภัยของน้ำ (safe, warning, danger) ทั้งในระดับพารามิเตอร์เดี่ยว, ระดับตัวอย่างน้ำรวม,
 * และการเปรียบเทียบตามประเภทการใช้ประโยชน์ของแหล่งน้ำ (Location Types)
 * พร้อมฟังก์ชันคำนวณค่าตรวจวัดล่าสุดต่อสาร (Latest Parameter Value) และการคำนวณย้อนหลังตามช่วงเวลาอ้างอิง (As-Of Historical Context)
 *
 * [EN] Core water quality evaluation engine adhering to Pollution Control Department seawater standards.
 * Computes safety statuses (safe, warning, danger) across individual parameters, sample session groups,
 * and contextual location usage zones. Implements latest value aggregation and as-of historical snapshot evaluation.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @modified 2026-09-11
 * @version 2.2.0
 * @license Proprietary
 *
 * @see {@link /lib/standards-db.ts} Server-side dynamic database standards loader
 * @see {@link /lib/generated/location-types.ts} Codegen location type enum definitions
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - ออกแบบเกณฑ์มาตรฐานเริ่มต้นและระบบประเมินผล
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - ปรับปรุงการคำนวณ As-Of context, Null-safety, และเชื่อมตาราง Database
 *
 * @lastModified 2026-09-11
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: ยึดเวลาไทยเป็นนิยามเดียวของทุกคอลัมน์ DateTime ใน DB
 * - 2026-09-02 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: ให้ส่งภาพที่ AI ไม่พบหลอดทดลองเข้าคิวตรวจสอบได้ แทนการบล็อกทิ้ง
 * - 2026-08-24 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - fix: ปรับเรื่องการเก็บและแสดงเวลา
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: แก้ flow การส่งสารซ้ำ และเพิ่มการแสดงเกณฑ์ประเมิน
 * - 2026-07-17 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: ลบฟังก์ชัน getOrganizationLabel และ INNER_SHAPES
 */

// ประเภทการใช้ประโยชน์ — ตอนนี้มาจากตาราง `location_types` ใน DB ผ่าน codegen (npm run gen:location-types)
// ไม่ต้องมาแก้ที่นี่เวลาเพิ่มโซนใหม่: insert แถวใน DB แล้วรัน gen ใหม่
export type { LocationTypeCode } from "./generated/location-types";
export { LOCATION_TYPE_CODES, DEFAULT_LOCATION_TYPE_CODE, isLocationTypeCode } from "./generated/location-types";

import type { LocationTypeCode } from "./generated/location-types";
import { toApiString } from "./thaiTime";

/** @deprecated ใช้ `LocationTypeCode` ที่ gen จาก DB แทน — alias นี้ไว้กันของเดิมพังระหว่างเปลี่ยนผ่าน */
export type LocationType = LocationTypeCode;

// ตาราง LOCATION_STANDARDS และ LOCATION_TYPE_LABELS ที่เคยอยู่ตรงนี้ถูกลบแล้ว
// ค่าเกณฑ์และป้ายชื่อย้ายไปอยู่ในตาราง `standards` / `location_types` ใน DB ทั้งหมด
// ฝั่ง server โหลดผ่าน lib/standards-db.ts | ฝั่ง client รับผ่าน /api/location-types

/**
 * [TH] ระดับสถานะคุณภาพน้ำ: 'safe' (ปลอดภัย), 'warning' (เฝ้าระวัง), 'danger' (อันตราย)
 * [EN] Water quality status type indicator: 'safe' | 'warning' | 'danger'
 */
export type StatusType = "safe" | "warning" | "danger";

/**
 * [TH] เกณฑ์ความมั่นใจขั้นต่ำของผลวิเคราะห์ AI (Confidence Threshold = 0.6)
 * [EN] Minimum AI analysis confidence score threshold (0.6)
 * @constant {number}
 */
export const CONFIDENCE_THRESHOLD = 0.6;

/**
 * [TH] ตรวจสอบว่าผลการวิเคราะห์มีความเชื่อมั่นต่ำกว่าเกณฑ์หรือไม่ (รวมถึงกรณีค่าเป็น null/undefined)
 * [EN] Checks whether AI analysis confidence falls below threshold or is undefined/null
 *
 * @function isLowConfidence
 * @param {number | null | undefined} confidence - ค่าความเชื่อมั่นจากการวิเคราะห์ภาพ AI (0.0 - 1.0)
 * @returns {boolean} เป็นจริงหากค่าความเชื่อมั่นต่ำกว่า 0.6 หรือไม่สามารถระบุค่าได้
 */
export function isLowConfidence(confidence: number | null | undefined): boolean {
    if (confidence === null || confidence === undefined || !Number.isFinite(confidence)) return true;
    return confidence < CONFIDENCE_THRESHOLD;
}

/**
 * [TH] ประเมินระดับสถานะของคุณภาพน้ำของสารตัวเดียวเทียบกับเกณฑ์ค่าสูงสุด (คำนวณ warning เมื่อเกิน 70% ของ max)
 * [EN] Evaluates status level of a single water quality parameter against its maximum threshold (warning when >= 70% of max)
 *
 * @function getParameterStatus
 * @param {number | null | undefined} value - ค่าที่วัดได้ (measured value)
 * @param {number} max - ค่าเกณฑ์สูงสุดที่อนุญาต (maximum allowable threshold)
 * @returns {StatusType} ระดับสถานะ: 'safe', 'warning', หรือ 'danger'
 */
export function getParameterStatus(value: number | null | undefined, max: number): StatusType {
    if (value === null || value === undefined) return "safe";

    if (value > max) return "danger";
    if (value >= max * 0.7) return "warning";
    return "safe";
}

/**
 * [TH] แปลงค่าดิบจาก JSON/Payload ให้เป็นตัวเลขที่วัดได้ คืน null หากไม่มีค่าหรือแปลงเป็นตัวเลขไม่ได้
 * [EN] Parses a raw value into a finite measured number, returning null if empty or invalid
 *
 * @function toMeasuredNumber
 * @param {unknown} raw - ค่าดิบที่ต้องการแปลง
 * @returns {number | null} ตัวเลขที่วัดได้ หรือ null หากไม่ถูกต้อง
 */
export function toMeasuredNumber(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

/**
 * [TH] โครงสร้างข้อมูลค่าตรวจวัดสาร 1 รายการ โดยอ้างอิงด้วย parameterId
 * [EN] Represents a single measured water parameter value identified by parameterId
 */
export interface MeasuredValue {
    parameterId: number;
    value: number | null | undefined;
}

/**
 * [TH] แถวข้อมูลเกณฑ์มาตรฐาน 1 รายการจากฐานข้อมูลสำหรับสารตัวหนึ่ง
 * [EN] Standard threshold specification row for a parameter from the database
 */
export interface StandardRow {
    parameterId: number;
    maxValue: number;
}

const STATUS_SEVERITY: Record<StatusType, number> = { safe: 0, warning: 1, danger: 2 };

/**
 * [TH] เปรียบเทียบและคืนค่าระดับสถานะที่รุนแรงกว่าระหว่าง 2 สถานะ (danger > warning > safe)
 * [EN] Compares two water quality statuses and returns the more severe one
 *
 * @function worseStatus
 * @param {StatusType} a - สถานะแรก
 * @param {StatusType} b - สถานะที่สอง
 * @returns {StatusType} สถานะที่รุนแรงกว่า
 */
export function worseStatus(a: StatusType, b: StatusType): StatusType {
    return STATUS_SEVERITY[a] >= STATUS_SEVERITY[b] ? a : b;
}

/**
 * [TH] ประเมินค่าของสาร 1 ตัวเทียบกับชุดเกณฑ์ค่าสูงสุดทั้งหมดของสารนั้น และคืนสถานะที่แย่ที่สุด (คืน null หากไม่มีเกณฑ์หรือไม่มีค่า)
 * [EN] Evaluates a parameter value against an array of threshold maximums, returning the worst status or null
 *
 * @function evaluateValueAgainstStandards
 * @param {number | null | undefined} value - ค่าที่วัดได้
 * @param {number[]} maxValues - รายการเกณฑ์ค่าสูงสุดทั้งหมดของสารนี้
 * @returns {StatusType | null} สถานะที่แย่ที่สุด หรือ null หากไม่มีค่า/ไม่มีเกณฑ์
 */
export function evaluateValueAgainstStandards(value: number | null | undefined, maxValues: number[]): StatusType | null {
    // ไม่มีค่าที่วัดได้ = ตัดสินไม่ได้ อยู่ในหมวดเดียวกับ "ไม่มีเกณฑ์" จึงคืน null เหมือนกัน
    // ห้ามปล่อยให้ตกไปถึง getParameterStatus ซึ่งคืน "safe" ให้ค่า null — ผลที่ AI อ่านไม่ได้
    // จะถูกรายงานว่า "ปกติ" ทั้งที่ไม่เคยมีค่าให้เทียบ
    if (value === null || value === undefined || !Number.isFinite(value)) return null;
    if (maxValues.length === 0) return null;
    return maxValues.reduce<StatusType>((acc, max) => worseStatus(acc, getParameterStatus(value, max)), "safe");
}

/**
 * [TH] จัดกลุ่มรายการเกณฑ์มาตรฐานตามรหัสสาร (parameterId) เพื่อให้สืบค้นค่าเกณฑ์ได้รวดเร็ว
 * [EN] Groups an array of standards into a Map keyed by parameterId
 *
 * @function groupStandardsByParameter
 * @param {StandardRow[]} standards - รายการเกณฑ์มาตรฐานทั้งหมด
 * @returns {Map<number, number[]>} Map รหัสสารคู่กับรายการค่าเกณฑ์สูงสุด
 */
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
 * [TH] ประเมินสถานะภาพรวมของตัวอย่างน้ำ 1 ใบ โดยหาค่าที่แย่ที่สุดของทุกสารเทียบกับทุกเกณฑ์
 * [EN] Evaluates overall water sample status by computing the worst status across all parameters and standards
 *
 * @function evaluateSample
 * @param {MeasuredValue[]} values - รายการค่าตรวจวัดทั้งหมดของตัวอย่าง
 * @param {StandardRow[]} standards - รายการเกณฑ์มาตรฐานทั้งหมดในระบบ
 * @returns {StatusType | null} สถานะภาพรวมที่แย่ที่สุด หรือ null หากไม่มีสารใดตัดสินได้
 */
export function evaluateSample(values: MeasuredValue[], standards: StandardRow[]): StatusType | null {
    const maxesByParameter = groupStandardsByParameter(standards);

    let overallStatus: StatusType | null = null;
    for (const measured of values) {
        const status = evaluateValueAgainstStandards(measured.value, maxesByParameter.get(measured.parameterId) ?? []);
        if (status === null) continue;
        overallStatus = overallStatus === null ? status : worseStatus(overallStatus, status);
    }

    return overallStatus;
}

/**
 * [TH] โครงสร้างข้อมูลประเภทการใช้ประโยชน์พื้นที่พร้อมชุดเกณฑ์มาตรฐานของประเภทนั้น
 * [EN] Location usage type with its associated standard thresholds
 */
export interface LocationTypeWithStandards {
    id: number;
    code: string;
    labelTh: string;
    standards: StandardRow[];
}

/**
 * [TH] ประเมินสถานะของชุดค่าตรวจวัดเทียบกับเกณฑ์ของประเภทการใช้ประโยชน์พื้นที่ประเภทเดียว
 * [EN] Evaluates measured values against standards of a single location type
 *
 * @function evaluateAgainstLocationType
 * @param {MeasuredValue[]} values - รายการค่าตรวจวัดของตัวอย่างน้ำ
 * @param {LocationTypeWithStandards} type - ประเภทการใช้ประโยชน์พร้อมเกณฑ์
 * @returns {StatusType | null} สถานะที่แย่ที่สุด หรือ null หากตัดสินไม่ได้
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
 * [TH] โครงสร้างข้อมูลตัวอย่างน้ำแบบย่อสำหรับคำนวณหาค่าล่าสุดของแต่ละสาร (ไม่แตะ prisma import จาก client ได้)
 * [EN] Lightweight sample structure for computing latest parameter values without prisma dependency
 */
export interface SampleForLatestValue {
    collectionTime: Date | string;
    measurements: { parameterId: number; value: number | null; parameter?: { name: string } | null }[];
}

/**
 * [TH] โครงสร้างข้อมูลค่าล่าสุดของสารตัวหนึ่ง พร้อมเวลาที่เก็บตัวอย่าง
 * [EN] Latest measured value and timestamp for a specific water parameter
 */
export interface LatestParameterValue {
    parameterId: number;
    parameterName: string;
    value: number;
    collectedAt: string;
}

/**
 * [TH] คัดเลือกค่าตรวจวัดล่าสุดของแต่ละสารจากรายการตัวอย่างน้ำของสถานที่ (ต้องเรียงเวลาถอยหลังจากใหม่ไปเก่า)
 * [EN] Computes the latest measured value for each parameter from sorted sample records
 *
 * @function computeLatestValueByParameter
 * @param {SampleForLatestValue[]} samples - รายการตัวอย่างน้ำที่เรียงเวลาถอยหลัง (descending)
 * @returns {LatestParameterValue[]} รายการค่าล่าสุดของแต่ละสาร
 */
export function computeLatestValueByParameter(samples: SampleForLatestValue[]): LatestParameterValue[] {
    const latestByParameter = new Map<number, LatestParameterValue>();

    for (const s of samples) {
        const collectedAt = typeof s.collectionTime === "string" ? s.collectionTime.replace(/(Z|[+-]\d{2}:\d{2})$/, "") : toApiString(s.collectionTime);
        for (const m of s.measurements) {
            if (latestByParameter.has(m.parameterId)) continue;
            // แถวที่ไม่มีค่า (AI อ่านไม่ออก) ไม่นับเป็นการวัดสารตัวนั้น — ข้ามไปหาค่าจริงที่ใหม่ที่สุดแทน
            // ถ้านับด้วย สถานะสถานีจะกลายเป็น "ตัดสินไม่ได้" ทั้งที่มีผลตรวจจริงของรอบก่อนหน้าอยู่
            if (m.value === null || m.value === undefined) continue;
            latestByParameter.set(m.parameterId, {
                parameterId: m.parameterId,
                parameterName: m.parameter?.name ?? "",
                value: m.value,
                collectedAt,
            });
        }
    }

    return Array.from(latestByParameter.values());
}

/**
 * [TH] หาค่าตรวจวัดล่าสุดของแต่ละสาร ณ วันที่อ้างอิง (Context-aware as-of date evaluation)
 * [EN] Computes parameter values as of a reference date using historical and forward-looking samples
 *
 * @function computeValueByParameterAsOf
 * @param {SampleForLatestValue[]} beforeOrAtDesc - ตัวอย่างที่เก็บก่อนหรือตรงกับวันอ้างอิง เรียง desc
 * @param {SampleForLatestValue[]} afterAsc - ตัวอย่างที่เก็บหลังวันอ้างอิง เรียง asc
 * @returns {LatestParameterValue[]} รายการค่าตรวจวัดที่เหมาะสมที่สุด ณ วันอ้างอิง
 */
export function computeValueByParameterAsOf(beforeOrAtDesc: SampleForLatestValue[], afterAsc: SampleForLatestValue[]): LatestParameterValue[] {
    const fromBefore = computeLatestValueByParameter(beforeOrAtDesc);
    const fromAfter = computeLatestValueByParameter(afterAsc);

    const coveredParameterIds = new Set(fromBefore.map((m) => m.parameterId));
    return [...fromBefore, ...fromAfter.filter((m) => !coveredParameterIds.has(m.parameterId))];
}

/**
 * [TH] รับข้อความป้ายกำกับภาษาไทยสำหรับระดับสถานะคุณภาพน้ำ (ปลอดภัย, เฝ้าระวัง, อันตราย)
 * [EN] Retrieves the localized Thai label corresponding to a water quality status
 *
 * @function getStatusLabel
 * @param {StatusType} status - ระดับสถานะคุณภาพน้ำ
 * @returns {string} ข้อความภาษาไทยสำหรับสถานะนั้น
 */
export function getStatusLabel(status: StatusType): string {
    const labels: Record<StatusType, string> = {
        safe: "ปลอดภัย",
        warning: "เฝ้าระวัง",
        danger: "อันตราย",
    };
    return labels[status];
}

