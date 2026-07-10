// src/lib/weather.ts

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
 * 🌟 ฟังก์ชันแปลงรหัสสภาพอากาศ WMO (Open-Meteo) ให้กลับมาเป็นเลขมาสเตอร์ 1-12 ของระบบเราครับบอส
 * @param wmoCode รหัสสภาพอากาศจาก Open-Meteo API
 */
export function mapWmoToLegacyCode(wmoCode: number | null | undefined): number | null {
    if (wmoCode === null || wmoCode === undefined) return null;

    // จับคู่รหัสสากล (WMO) ยุบเข้ากับหมวดหมู่ 1-12 ของบอสอย่างแม่นยำ
    switch (wmoCode) {
        case 0: 
            return 1; // ท้องฟ้าแจ่มใส
        case 1:
        case 2: 
            return 2; // มีเมฆบางส่วน
        case 3: 
            return 3; // เมฆเป็นส่วนมาก
        case 45:
        case 48: 
            return 4; // มีเมฆมาก (หมวกหนา)
        case 51:
        case 53:
        case 55: 
            return 5; // ฝนตกเล็กน้อย / ปรอยๆ
        case 61:
        case 63: 
            return 6; // ฝนปานกลาง
        case 65:
        case 80:
        case 81:
        case 82: 
            return 7; // ฝนตกหนัก / ฝนซู่
        case 95:
        case 96:
        case 99: 
            return 8; // ฝนฟ้าคะนอง
        default:
            // Fallback: ถ้าอุณหภูมิต่ำหรือสูงเกินไปในอนาคต สามารถเช็คพ่วงได้ 
            // แต่ ณ ตอนนี้ถ้าไม่เข้าพวก ให้ยึดกลุ่มเมฆบางส่วนไว้เซฟ ๆ ครับ
            return 2; 
    }
}

export function getWeatherConditionLabel(code: number | null | undefined): string {
    if (code === null || code === undefined) return "ไม่พบข้อมูลสภาพอากาศ";
    return WEATHER_CONDITIONS[code] || `สภาพอากาศรหัส ${code}`;
}