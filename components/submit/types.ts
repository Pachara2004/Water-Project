/**
 * @file types.ts
 * @project Water Monitoring Project
 * @module UI / Submit / Types
 * @description
 * ชนิดข้อมูลที่ flow ส่งตรวจคุณภาพน้ำ (หน้า submit, hook useSubmitSample และหน้าประวัติ) ใช้ร่วมกัน:
 * สารในระบบ (DbParameter), สถานี (LocationItem), ผลวิเคราะห์ต่อภาพ (MeasurementResult) พร้อม flag
 * ที่บอกว่าผลนี้ต้องเข้าคิวให้ admin ตรวจ (สารซ้ำ / ยืนยันสารเดิม / สารไม่รู้จัก / ขอให้แก้ชนิดสาร)
 * และเหตุผลที่ผลถูกบล็อกก่อนแสดง (VerifyError)
 *
 * Shared types for the sample-submission flow: DB parameters, locations, per-image
 * measurement results with review-routing flags, and verification errors.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-07
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-14 – 2026-09-09)
 *
 * @lastModified 2026-09-09 13:18
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-07-07 15:30 by Pachara P. - แยกชนิดข้อมูลออกมาตอนปรับโครงสร้างไฟล์ submit
 * - 2026-07-14 by Nopparut U. - เพิ่มโหมดส่งตัวอย่างและ flag สลับสารอัตโนมัติ/ยืนยันสารเดิม
 * - 2026-07-16 13:13 by Nopparut U. - เพิ่ม isDuplicateSubstance สำหรับ workflow สารซ้ำ
 * - 2026-08-21 – 08-25 by Pachara P. - เพิ่ม requestAdminChange และ isSystemUnknown ตาม flow ตรวจสอบใหม่
 * - 2026-09-09 13:18 by Nopparut U. - เพิ่ม formula สำหรับป้ายสูตรเคมี
 *
 * @license Private / Proprietary
 */

/** สาร (parameter) ตามตาราง `parameters` ใน DB */
export interface DbParameter {
    id: number;
    name: string;
    unit: string | null;
    description: string | null;
    /** สูตรเคมีสำหรับป้ายชิป เช่น "NH3" — null = ยังไม่ได้กรอกใน DB */
    formula: string | null;
}

/** สถานีในรูปแบบย่อสำหรับตัวเลือกในหน้า submit */
export interface LocationItem {
    id: number;
    name: string;
    type: string;
    lat: number;
    lng: number;
    organization: string;
}

/** ผลวิเคราะห์ของภาพหนึ่งใบจาก AI พร้อม flag ที่กำหนดเส้นทางการตรวจสอบ */
export interface MeasurementResult {
    /** ค่าความเข้มข้นที่อ่านได้ */
    concentrated: number;
    /** null = สารนี้ไม่มีเกณฑ์กำหนด ตัดสินไม่ได้ */
    status: "safe" | "warning" | "danger" | null;
    message: string;
    /** 0–1 ความมั่นใจของโมเดล */
    confidence?: number;
    boundingBox?: any;
    /** AI ตรวจเจอหลอดทดลองในภาพหรือไม่ */
    isTestTube?: boolean;
    /** ชื่อสารที่ AI ตรวจยืนยัน (อาจต่างจากที่ผู้ใช้ระบุ) */
    verifiedParameterName?: string;
    /** ชื่อสารเดิมที่ผู้ใช้เลือกไว้ ก่อนถูกสลับอัตโนมัติ */
    autoSwitchedFrom?: string;
    /**
     * สารจริง (DB parameter id) ที่ผลนี้จะถูกบันทึกด้วย — แยกจาก key ที่เก็บใน results/imageFiles
     * เพราะกรณีสารซ้ำ (isDuplicateSubstance) หลายรายการอาจชี้ parameterId เดียวกันแต่คนละ key (virtual key)
     */
    parameterId: number;
    /** true เมื่อภาพนี้ชนกับอีกภาพในชุดเดียวกัน (AI ตรวจเป็นสารเดียวกัน) — ต้องบังคับส่งเข้าคิว pending เสมอ */
    isDuplicateSubstance?: boolean;
    originalValue?: number | null;
    /** ผู้ใช้กดยืนยันสารเดิมที่ AI ทำนายผิดช่อง — บังคับส่งให้ Admin ตรวจสอบ */
    userInsistedOriginal?: boolean;
    /** ระบบไม่รู้จักสารที่ AI ทำนายกลับมา (ไม่มีใน DB) — ภาพคงอยู่ในช่องเดิมที่อัปโหลดและบังคับส่งให้ Admin ตรวจสอบ */
    isSystemUnknown?: boolean;
    /** ผู้ใช้ติ๊กขอให้ Admin ช่วยตรวจสอบและแก้ไขชนิดสารให้ (เช่น ตรวจซ้ำ หรือ AI ทำนายผิด) */
    requestAdminChange?: boolean;
}

/** เหตุผลที่ผลวิเคราะห์ถูกบล็อก ก่อนเข้าขั้นตอนแสดงผล/บันทึก */
export type VerifyErrorReason = "not_test_tube" | "wrong_solution";

/** ผลวิเคราะห์ที่ถูกบล็อกพร้อมข้อความอธิบายให้ผู้ใช้ */
export interface VerifyError {
    reason: VerifyErrorReason;
    detail: string;
}
