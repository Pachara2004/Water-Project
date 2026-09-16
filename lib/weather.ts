/**
 * @fileoverview Weather condition codes and WMO mapping utilities
 *
 * [TH] โมดูลรหัสสภาพอากาศ คำอธิบายภาษาไทย และการแปลงรหัส WMO เข้ากับรหัสสภาพอากาศระบบ
 * [EN] Weather condition codes, Thai descriptions, and WMO code mapping utilities
 *
 * @description
 * [TH] นิยามรหัสสภาพอากาศภาษาไทย (1-12) และแปลงรหัส WMO Weather Code จาก Open-Meteo
 * ให้สอดคล้องกับพฤติกรรมสภาพอากาศในประเทศไทย (ปรับลดระดับ WMO 80 ป้องกันฝนทิพย์)
 * [EN] Defines Thai weather condition codes and maps WMO standard codes from Open-Meteo
 * to system weather categories tailored to Thai meteorological conditions.
 *
 * @module lib/weather
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-06-09
 * @modified 2026-09-11
 *
 * @history
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: ปรับ mapWmoToLegacyCode ย้าย WMO 80 ให้เป็นฝนตกเล็กน้อย (แก้บั๊กฝนทิพย์)
 * - 2026-06-09 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - initial commit
 */

/**
 * [TH] พจนานุกรมรหัสสภาพอากาศและข้อความภาษาไทย (1: ท้องฟ้าแจ่มใส ถึง 12: อากาศร้อนจัด)
 * [EN] Dictionary mapping numeric weather codes (1-12) to descriptive Thai labels
 * @constant {Record<number, string>}
 */
export const WEATHER_CONDITIONS: Record<number, string> = {
    1: "ท้องฟ้าแจ่มใส",
    2: "มีเมฆบางส่วน",
    3: "เมฆเป็นส่วนมาก",
    4: "มีเมฆมาก",
    5: "ฝนตกเล็กน้อย",
    6: "ฝนปานกลาง",
    7: "ฝนตกหนัก",
    8: "ฝนฟ้าคะนอง",
    9: "อากาศหนาวจัด",
    10: "อากาศหนาว",
    11: "อากาศเย็น",
    12: "อากาศร้อนจัด",
};

/**
 * [TH] แปลงรหัสสภาพอากาศมาตรฐาน WMO (จาก Open-Meteo) ให้เป็นรหัสสภาพอากาศระบบ (1-8)
 * [EN] Maps WMO standard weather code to internal legacy weather category code
 *
 * @function mapWmoToLegacyCode
 * @param {number | null | undefined} wmoCode - รหัสสภาพอากาศ WMO
 * @returns {number | null} รหัสสภาพอากาศระบบ หรือ null
 */
export function mapWmoToLegacyCode(wmoCode: number | null | undefined): number | null {
    if (wmoCode === null || wmoCode === undefined) return null;

    switch (wmoCode) {
        case 0: 
            return 1; // ท้องฟ้าแจ่มใส
        case 1:
        case 2: 
            return 2; // 有มีเมฆบางส่วน
        case 3: 
            return 3; // เมฆเป็นส่วนมาก
        
        // กลุ่มหมอก/ไอชื้นทะเลชายฝั่ง (WMO 45, 48) จัดอยู่ในระดับมีเมฆมาก 
        case 45:
        case 48: 
            return 4; // มีเมฆมาก

        // ฝนละออง / ฝนไล่ช้างเบาบางสั้น ๆ (ย้ายเคส 80 ลงมาตรงนี้เพื่อแก้บั๊กฝนทิพย์)
        case 51:
        case 53:
        case 55: 
        case 80: // ย้ายมานี่! ข้อมูลหน้างานจริงเป็นแค่ฝนซู่สั้น ๆ ไล่แดด ไม่ใช่ฝนตกหนัก
            return 5; // ฝนตกเล็กน้อย

        // ฝนตกต่อเนื่องเป็นเรื่องเป็นราวระดับปานกลาง
        case 61:
        case 63: 
            return 6; // ฝนปานกลาง

        // ฝนตกหนักต่อเนื่องกระจายตัวเป็นวงกว้าง
        case 65:
        case 81:
        case 82: 
            return 7; // ฝนตกหนัก

        // พายุฝนฟ้าคะนองคะนองเดช รุนแรง
        case 95:
        case 96:
        case 99: 
            return 8; // ฝนฟ้าคะนอง

        default:
            return 2; // Fallback ปลอดภัยยึดเมฆบางส่วนไว้
    }
}

/**
 * [TH] รับข้อความภาษาไทยอธิบายสภาพอากาศตามรหัสตัวเลข
 * [EN] Retrieves localized Thai label corresponding to a weather condition code
 *
 * @function getWeatherConditionLabel
 * @param {number | null | undefined} code - รหัสสภาพอากาศระบบ
 * @returns {string} ข้อความอธิบายสภาพอากาศภาษาไทย
 */
export function getWeatherConditionLabel(code: number | null | undefined): string {
    if (code === null || code === undefined) return "ไม่พบข้อมูลสภาพอากาศ";
    return WEATHER_CONDITIONS[code] || `สภาพอากาศรหัส ${code}`;
}