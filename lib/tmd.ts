// src/lib/tmd.ts
import { mapWmoToLegacyCode } from "./weather"; // 🌟 อิมพอร์ตตัวแปลงมาครับบอส

interface WeatherResult {
    airTemperature: number | null;
    rainAccumulation: number | null;
    weatherCondCode: number | null;
}

/**
 * ดึงข้อมูลสภาพอากาศปัจจุบันจาก Open-Meteo API ตามพิกัดละติจูดและลองจิจูด
 * (สลับมาใช้แทนโครงสร้างยิงตรงหากรมอุตุฯ ดั้งเดิม เพื่อความเสถียรและยิงง่ายฟรี 100%)
 *
 * @param lat ละติจูด (Latitude)
 * @param lng ลองจิจูด (Longitude)
 */
export async function getWeatherData(lat: number, lng: number): Promise<WeatherResult | null> {
    try {
        // 🌐 เรียกใช้ Open-Meteo API ดึงค่าอุณหภูมิ, ปริมาณฝน และรหัสสภาพอากาศ (WMO Weather Code)
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,rain,weather_code&timezone=auto`;

        const response = await fetch(url, {
            // ดักจับจับเวลา 4 วินาทีพอครับบอส เน็ตเวิร์กจะได้ไม่ค้างเติ่งนาน
            signal: AbortSignal.timeout(4000),
        });

        if (!response.ok) {
            console.error(`Open-Meteo API responded with status: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const current = data?.current;

        if (!current) {
            return null;
        }

        return {
            airTemperature: current.temperature_2m !== undefined ? parseFloat(current.temperature_2m) : null,
            rainAccumulation: current.rain !== undefined ? parseFloat(current.rain) : null,
            // สกัดค่า weather_code (WMO Code) ส่งกลับไปจัดเก็บในฟิลด์ weatherCondCode ของบอสได้ทันที
            weatherCondCode: current.weather_code !== undefined ? mapWmoToLegacyCode(Math.floor(current.weather_code)) : null,
        };
    } catch (error) {
        console.error("Error fetching weather data from Open-Meteo:", error);
        return null;
    }
}
