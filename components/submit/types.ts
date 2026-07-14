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
    status: "safe" | "warning" | "danger";
    message: string;
    confidence?: number;
    boundingBox?: any;
    isTestTube?: boolean; // AI ตรวจเจอหลอดทดลองในภาพหรือไม่
    verifiedParameterName?: string; // ชื่อสารที่ AI ตรวจยืนยัน (อาจต่างจากที่ผู้ใช้ระบุ)
    autoSwitchedFrom?: string; // ชื่อสารเดิมที่ผู้ใช้เลือกไว้ ก่อนถูกสลับอัตโนมัติ (โหมดเดี่ยวเท่านั้น)
}

// เหตุผลที่ผลวิเคราะห์ถูกบล็อก ก่อนเข้าขั้นตอนแสดงผล/บันทึก
export type VerifyErrorReason = "not_test_tube" | "wrong_solution";

export interface VerifyError {
    reason: VerifyErrorReason;
    detail: string;
}
