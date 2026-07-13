import { prisma } from "@/lib/prisma";

interface OpenMeteoResponse {
    hourly: {
        time: string[];
        temperature_2m: number[];
        rain: number[];
        weather_code: number[];
        
    };
}

/**
 * ฟังก์ชันสำหรับแปลงรหัสสภาพอากาศ (WMO Code)
 */
export function mapWmoToLegacyCode(wmoCode: number): number {
    if (wmoCode === 0) return 1; // Clear sky
    if (wmoCode >= 1 && wmoCode <= 3) return 2; // Partly cloudy
    if (wmoCode >= 51 && wmoCode <= 55) return 5; // Drizzle
    if (wmoCode >= 61 && wmoCode <= 63) return 5; // Light/Mod Rain
    if (wmoCode >= 65 || (wmoCode >= 80 && wmoCode <= 82)) return 7; // Heavy Rain
    if (wmoCode >= 95) return 7; // Thunderstorm
    return 1;
}

/**
 * 🚀 ดึงข้อมูลสภาพอากาศย้อนหลัง 2 เดือน (60 วัน) ผูกตรงกับ Location ID ลง Database
 */
export async function backfillWeatherData(locationId: number, lat: number, lon: number) {
    const baseUrl = process.env.OPEN_METEO_BASE_URL || "https://api.open-meteo.com/v1/forecast";

    try {
        console.log(`⏳ [Backfill] กำลังดึงสภาพอากาศย้อนหลัง 60 วัน ให้กับ Location ID: ${locationId}...`);

        const queryParams = new URLSearchParams({
            latitude: lat.toString(),
            longitude: lon.toString(),
            hourly: "temperature_2m,rain,weather_code",
            timezone: "Asia/Bangkok",
            past_days: "60",
            forecast_days: "1",

            models: "jma_seamless,ecmwf_ifs",
        });

        const response = await fetch(`${baseUrl}?${queryParams.toString()}`, {
            method: "GET",
            headers: { accept: "application/json" },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) throw new Error(`Open-Meteo API Error: ${response.status}`);

        const json: any = await response.json();
        const hourlyData = json.hourly;

        if (!hourlyData || !hourlyData.time) return;

        const timeArray = hourlyData.time;

        // 🔍 ทำการ Dynamic ค้นหา Array ข้อมูลสภาพอากาศ ไม่ว่าชื่อคีย์จะเปลี่ยนไปตามโมเดลไหนก็ตาม
        // (รองรับทั้งแบบ default, jma_seamless, และ ecmwf_ifs)
        const tempArray = hourlyData.temperature_2m_jma_seamless || hourlyData.temperature_2m_ecmwf_ifs || hourlyData.temperature_2m || [];
        const rainArray = hourlyData.rain_jma_seamless || hourlyData.rain_ecmwf_ifs || hourlyData.rain || [];
        const wmoArray = hourlyData.weather_code_jma_seamless || hourlyData.weather_code_ecmwf_ifs || hourlyData.weather_code || [];

        // บันทึกข้อมูลแบบก้อนลง DB อิงตาม Location ID และ Timestamp[cite: 11]
        const upsertPromises = timeArray.map((timeStr: string, index: number) => {
            // 🌟 แก้เรื่องสตริง Z ที่คุยกันรอบที่แล้วให้เรียบร้อย
            const timestamp = new Date(timeStr); 

            return prisma.weatherData.upsert({
                where: {
                    locationId_timestamp: {
                        locationId: locationId,
                        timestamp: timestamp,
                    },
                },
                update: {
                    temperature: tempArray[index] ?? 29.5,
                    rainVolume: rainArray[index] ?? 0.0,
                    weatherCondition: mapWmoToLegacyCode(wmoArray[index] ?? 0),
                },
                create: {
                    locationId: locationId,
                    timestamp: timestamp,
                    temperature: tempArray[index] ?? 29.5,
                    rainVolume: rainArray[index] ?? 0.0,
                    weatherCondition: mapWmoToLegacyCode(wmoArray[index] ?? 0),
                },
            });
        });

        await Promise.all(upsertPromises);
        console.log(`✅ [Backfill] ลงประวัติ 2 เดือนด้วยโมเดลเอเชียสำเร็จสำหรับ Location ID: ${locationId}`);

    } catch (error) {
        console.error(`❌ [Backfill Error] สำหรับ Location ID ${locationId}:`, error);
    }
}
