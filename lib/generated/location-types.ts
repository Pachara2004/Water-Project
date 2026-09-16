// ไฟล์นี้ gen อัตโนมัติจากตาราง location_types — ห้ามแก้ด้วยมือ
// แก้ค่าที่ DB แล้วรัน: npm run gen:location-types

/**
 * @fileoverview Generated location type code constants and types from database
 *
 * [TH] โมดูลรหัสประเภทการใช้ประโยชน์พื้นที่คุณภาพน้ำ (สร้างอัตโนมัติจากฐานข้อมูล)
 * [EN] Generated location type codes and validation utilities derived from database
 *
 * @description
 * [TH] กำหนด Type และค่าคงที่สำหรับประเภทการใช้ประโยชน์พื้นที่ เช่น การอนุรักษ์ แนวปะการัง การเพาะเลี้ยงสัตว์น้ำ ฯลฯ
 * [EN] Defines TypeScript types and constants for water usage zones (e.g. Conservation, Aquaculture, Community).
 *
 * @module lib/generated/location-types
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-17
 * @modified 2026-07-17
 *
 * @history
 * - 2026-07-17 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: เพิ่ม script generate location types จากฐานข้อมูล
 */

/**
 * [TH] รหัสประเภทการใช้ประโยชน์พื้นที่
 * [EN] Location usage type code union
 */
export type LocationTypeCode = "CONSERVATION" | "CORAL_REEF" | "AQUACULTURE" | "RECREATION" | "INDUSTRY" | "COMMUNITY";

/**
 * [TH] รายการรหัสประเภทการใช้ประโยชน์พื้นที่ทั้งหมดในระบบ
 * [EN] Array of all supported location type codes
 * @constant {readonly string[]}
 */
export const LOCATION_TYPE_CODES = ["CONSERVATION", "CORAL_REEF", "AQUACULTURE", "RECREATION", "INDUSTRY", "COMMUNITY"] as const;

/**
 * [TH] รหัสประเภทการใช้ประโยชน์พื้นที่เริ่มต้น เมื่อไม่ได้ระบุประเภท (ค่าปริยายคือ COMMUNITY)
 * [EN] Default location type code applied when unspecified (defaults to 'COMMUNITY')
 * @constant {LocationTypeCode}
 */
export const DEFAULT_LOCATION_TYPE_CODE: LocationTypeCode = "COMMUNITY";

/**
 * [TH] ตรวจสอบว่าค่าสตริงที่ระบุเป็นรหัสประเภทการใช้ประโยชน์พื้นที่ (LocationTypeCode) ที่ถูกต้องหรือไม่
 * [EN] Type guard that checks if a given string matches a valid LocationTypeCode
 *
 * @function isLocationTypeCode
 * @param {string | null | undefined} value - ค่าสตริงที่ต้องการตรวจสอบ
 * @returns {value is LocationTypeCode} เป็นจริงหากเป็นรหัสที่ถูกต้อง
 */
export function isLocationTypeCode(value: string | null | undefined): value is LocationTypeCode {
    return value !== null && value !== undefined && (LOCATION_TYPE_CODES as readonly string[]).includes(value);
}
