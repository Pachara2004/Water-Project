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

export function getWeatherConditionLabel(code: number | null | undefined): string {
    if (code === null || code === undefined) return "ไม่พบข้อมูลสภาพอากาศ";
    return WEATHER_CONDITIONS[code] || `สภาพอากาศรหัส ${code}`;
}
