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
 * ฟังก์ชันแปลงรหัสสภาพอากาศ WMO ให้สอดคล้องกับสภาพจริงเมืองไทย
 * ซ่อมแซมบั๊กฝนทิพย์ ปล่อยรหัสฝนตกหนักเฉพาะเวลาที่แบบจำลองเทฝนลงมาจริง ๆ เท่านั้น
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

export function getWeatherConditionLabel(code: number | null | undefined): string {
    if (code === null || code === undefined) return "ไม่พบข้อมูลสภาพอากาศ";
    return WEATHER_CONDITIONS[code] || `สภาพอากาศรหัส ${code}`;
}