// ไฟล์นี้ gen อัตโนมัติจากตาราง location_types — ห้ามแก้ด้วยมือ
// แก้ค่าที่ DB แล้วรัน: npm run gen:location-types

export type LocationTypeCode = "CONSERVATION" | "CORAL_REEF" | "AQUACULTURE" | "RECREATION" | "INDUSTRY" | "COMMUNITY";

export const LOCATION_TYPE_CODES = ["CONSERVATION", "CORAL_REEF", "AQUACULTURE", "RECREATION", "INDUSTRY", "COMMUNITY"] as const;

/** โซนที่ใช้เมื่อจุดเก็บยังไม่ได้ระบุประเภท — คงพฤติกรรมเดิมของระบบไว้ */
export const DEFAULT_LOCATION_TYPE_CODE: LocationTypeCode = "COMMUNITY";

export function isLocationTypeCode(value: string | null | undefined): value is LocationTypeCode {
    return value !== null && value !== undefined && (LOCATION_TYPE_CODES as readonly string[]).includes(value);
}
