export const WEATHER_CONDITIONS: Record<number, string> = {
    1: "ท้องฟ้าแจ่มใส (Clear)",
    2: "มีเมฆบางส่วน (Partly cloudy)",
    3: "เมฆเป็นส่วนมาก (Cloudy)",
    4: "มีเมฆมาก (Overcast)",
    5: "ฝนตกเล็กน้อย (Light rain)",
    6: "ฝนปานกลาง (Moderate rain)",
    7: "ฝนตกหนัก (Heavy rain)",
    8: "ฝนฟ้าคะนอง (Thunderstorm)",
    9: "อากาศหนาวจัด (Very cold)",
    10: "อากาศหนาว (Cold)",
    11: "อากาศเย็น (Cool)",
    12: "อากาศร้อนจัด (Very hot)",
};

export function getWeatherConditionLabel(code: number | null | undefined): string {
    if (code === null || code === undefined) return "ไม่พบข้อมูลสภาพอากาศ";
    return WEATHER_CONDITIONS[code] || `สภาพอากาศรหัส ${code}`;
}
