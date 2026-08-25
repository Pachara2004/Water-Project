export interface DbParameter {
    id: number;
    name: string;
    unit: string | null;
    description: string | null;
}

export interface LocationItem {
    id: number;
    name: string;
    type: string;
    lat: number;
    lng: number;
    organization: string;
}

export interface MeasurementResult {
    concentrated: number;
    /** null = สารนี้ไม่มีเกณฑ์กำหนด ตัดสินไม่ได้ */
    status: "safe" | "warning" | "danger" | null;
    message: string;
    confidence?: number;
    boundingBox?: any;
    isTestTube?: boolean; // AI ตรวจเจอหลอดทดลองในภาพหรือไม่
    verifiedParameterName?: string; // ชื่อสารที่ AI ตรวจยืนยัน (อาจต่างจากที่ผู้ใช้ระบุ)
    autoSwitchedFrom?: string; // ชื่อสารเดิมที่ผู้ใช้เลือกไว้ ก่อนถูกสลับอัตโนมัติ
    // สารจริง (DB parameter id) ที่ผลนี้จะถูกบันทึกด้วย — แยกจาก key ที่เก็บใน results/imageFiles
    // เพราะกรณีสารซ้ำ (isDuplicateSubstance) หลายรายการอาจชี้ parameterId เดียวกันแต่คนละ key (virtual key)
    parameterId: number;
    // true เมื่อภาพนี้ชนกับอีกภาพในชุดเดียวกัน (AI ตรวจเป็นสารเดียวกัน) — ต้องบังคับส่งเข้าคิว pending เสมอ
    isDuplicateSubstance?: boolean;
    originalValue?: number | null;
    // ผู้ใช้กดยืนยันสารเดิมที่ AI ทำนายผิดช่อง — บังคับส่งให้ Admin ตรวจสอบ
    userInsistedOriginal?: boolean;
    // ระบบไม่รู้จักสารที่ AI ทำนายกลับมา (ไม่มีใน DB) — ภาพคงอยู่ในช่องเดิมที่อัปโหลดและบังคับส่งให้ Admin ตรวจสอบ
    isSystemUnknown?: boolean;
}

// เหตุผลที่ผลวิเคราะห์ถูกบล็อก ก่อนเข้าขั้นตอนแสดงผล/บันทึก
export type VerifyErrorReason = "not_test_tube" | "wrong_solution";

export interface VerifyError {
    reason: VerifyErrorReason;
    detail: string;
}
