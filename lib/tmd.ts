/**
 * @fileoverview Open-Meteo weather integration, water temperature estimation, and historical backfill
 *
 * [TH] โมดูลเชื่อมต่อสภาพอากาศ Open-Meteo คำนวณคาดการณ์อุณหภูมิน้ำ และดึงข้อมูลย้อนหลัง (Backfill)
 * [EN] Open-Meteo weather API integration, water temperature model calculations, and 60-day backfill operations
 *
 * @description
 * [TH] ดึงข้อมูลพยากรณ์และสภาพอากาศสดจาก Open-Meteo (โมเดล ECMWF IFS)
 * คำนวณอุณหภูมิน้ำจากอุณหภูมิอากาศและอุณหภูมิผิวสัมผัส (Thermal Lag model)
 * และมีระบบ Backfill ประวัติสภาพอากาศ 60 วันบันทึกลงฐานข้อมูล Prisma
 * [EN] Fetches weather telemetry from Open-Meteo ECMWF IFS model, calculates estimated water temperatures
 * using thermal lag formulas, and provides a 60-day historical backfill job into the database.
 *
 * @module lib/tmd
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-06-09
 * @modified 2026-09-11
 *
 * @history
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix(weather): compute water temperature and align timestamps with Thai time
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: เพิ่มการดึงสภาพอากาศจาก Open-Meteo ECMWF model และ backfill 60 วัน
 * - 2026-06-09 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - initial commit
 */

import { prisma } from "@/lib/prisma";
import { nowThai } from "@/lib/thaiTime";

interface OpenMeteoResponse {
    hourly: {
        time: string[];
        temperature_2m: number[];
        rain: number[];
        weather_code: number[];
    };
}

/**
 * [TH] แปลงรหัสสภาพอากาศ WMO เป็นรหัสสภาพอากาศระบบ (1: แจ่มใส, 2: เมฆบางส่วน, 5: ฝนปรอย, 7: ฝนตกหนัก)
 * [EN] Maps WMO standard weather code to internal legacy system code
 *
 * @function mapWmoToLegacyCode
 * @param {number} wmoCode - รหัสสภาพอากาศมาตรฐาน WMO
 * @returns {number} รหัสสภาพอากาศระบบ
 */
export function mapWmoToLegacyCode(wmoCode: number): number {
    // 1: ท้องฟ้าโปร่ง / แดดจัด / ไม่มีฝนแน่นอน
    if (wmoCode === 0) return 1;

    // 2: มีเมฆบางส่วน / เมฆกระจาย (สภาพปกติส่วนใหญ่ของบางแสนช่วงเช้า-บ่าย)
    if (wmoCode >= 1 && wmoCode <= 3) return 2;

    // 3: มีหมอก / หมอกแดด / ไอความชื้นเหนือน้ำทะเลลอยตัว (ยังไม่ใช่ฝนตก)
    if (wmoCode >= 45 && wmoCode <= 48) return 2; // แปลงเป็นมีเมฆ/หมอกบางส่วน แทนที่จะหลุดไปเป็นฝน

    // 5: ฝนละออง / ฝนไล่ช้าง / ตกปรอยๆ สั้นๆ (ปริมาณน้ำฝนน้อยมาก)
    if (wmoCode >= 51 && wmoCode <= 55) return 5;
    if (wmoCode === 61 || wmoCode === 80) return 5; // ฝนตกปรอยๆ หรือฝนซู่สั้นๆ

    // 7: ฝนตกของจริง / ฝนตกหนัก / พายุฟ้าคะนอง (WMO ระดับรุนแรง)
    if (wmoCode === 63 || wmoCode === 65) return 7; // ฝนตกปานกลางถึงหนัก
    if (wmoCode >= 81 && wmoCode <= 82) return 7; // ฝนซู่รุนแรง
    if (wmoCode >= 95) return 7; // พายุฝนฟ้าคะนอง

    // ค่า Default เผื่อหลุดล็อก ให้มองเป็นฟ้าเปิด/ปกติไว้ก่อนเพื่อความปลอดภัยของโมเดลน้ำ
    return 1;
}

/**
 * [TH] คำนวณคาดการณ์อุณหภูมิน้ำโดยใช้แบบจำลอง Thermal Lag และการถ่วงน้ำหนักอุณหภูมิผิวสัมผัส
 * [EN] Estimates water temperature from air and skin temperatures using diurnal thermal lag weighting
 *
 * @function calculateWaterTemperature
 * @param {number} airTemp - อุณหภูมิอากาศ (Apparent temperature) หน่วยองศาเซลเซียส
 * @param {number} skinTemp - อุณหภูมิผิวสัมผัส (Skin temperature) หน่วยองศาเซลเซียส
 * @param {number} hour - ชั่วโมงของวันตามเวลาไทย (0-23)
 * @returns {number} อุณหภูมิน้ำโดยประมาณ (ทศนิยม 1 ตำแหน่ง)
 */
export function calculateWaterTemperature(airTemp: number, skinTemp: number, hour: number): number {
    const isDaytime = hour >= 9 && hour <= 16;
    if (isDaytime) {
        const estimated = airTemp * 0.7 + skinTemp * 0.3 - 1.8;
        return parseFloat(estimated.toFixed(1));
    } else {
        const estimated = airTemp * 0.9 + 0.5;
        return parseFloat(estimated.toFixed(1));
    }
}

/**
 * [TH] ดึงและบันทึกข้อมูลสภาพอากาศย้อนหลัง 60 วันผูกกับ Location ID ลงฐานข้อมูล Prisma
 * [EN] Fetches and upserts 60 days of historical hourly weather data for a specific location
 *
 * @async
 * @function backfillWeatherData
 * @param {number} locationId - รหัสสถานที่ตรวจวัด
 * @param {number} lat - พิกัดละติจูด
 * @param {number} lon - พิกัดลองจิจูด
 * @returns {Promise<void>}
 */
export async function backfillWeatherData(locationId: number, lat: number, lon: number) {
    const baseUrl = process.env.OPEN_METEO_BASE_URL || "https://api.open-meteo.com/v1/forecast";

    try {
        console.log(`[Backfill] กำลังดึงข้อมูลสภาพอากาศย้อนหลัง 60 วัน ให้กับ Location ID: ${locationId}...`);

        const queryParams = new URLSearchParams({
            latitude: lat.toString(),
            longitude: lon.toString(),
            hourly: "apparent_temperature,skin_temperature,rain,weather_code", // ดึงครบทุกตัวแปรเดิม
            timezone: "Asia/Bangkok",
            past_days: "60",
            forecast_days: "1",
            models: "ecmwf_ifs",
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
        const tempApparent = hourlyData.apparent_temperature_ecmwf_ifs || hourlyData.apparent_temperature || [];
        const tempSkin = hourlyData.skin_temperature_ecmwf_ifs || hourlyData.skin_temperature || [];
        const rainArray = hourlyData.rain_ecmwf_ifs || hourlyData.rain || [];
        const wmoArray = hourlyData.weather_code_ecmwf_ifs || hourlyData.weather_code || [];

        // บันทึกข้อมูลแบบก้อนลง DB ครบทุกฟิลด์เดิม
        const upsertPromises = timeArray.map((timeStr: string, index: number) => {
            // Open-Meteo (timezone=Asia/Bangkok) ให้ "2026-09-11T14:00" ไม่มี offset — ต้องต่อ Z เพื่อให้ตัวเลขถูกอ่าน
            // เป็นนาฬิกาไทยตามกติกา DB (ดู lib/thaiTime.ts) ไม่ใช่ตาม TZ ของ process ไม่งั้น key ค้นแคชจะคลาดกับตัวอย่าง
            const timestamp = new Date(`${timeStr}:00Z`);

            const baseTemp = tempApparent[index] ?? 29.5;
            const skinTemp = tempSkin[index] ?? baseTemp;

            // 🌟 คำนวณแปลงเป็นอุณหภูมิน้ำเพื่อจัดเก็บลงฟิลด์หลัก
            const waterTemp = calculateWaterTemperature(baseTemp, skinTemp, timestamp.getUTCHours());

            return prisma.weatherData.upsert({
                where: {
                    locationId_timestamp: {
                        locationId: locationId,
                        timestamp: timestamp,
                    },
                },
                update: {
                    temperature: waterTemp, // เปลี่ยนเป็นอุณหภูมิน้ำเรียบร้อย
                    rainVolume: rainArray[index] ?? 0.0,
                    weatherCondition: mapWmoToLegacyCode(wmoArray[index] ?? 0),
                },
                create: {
                    locationId: locationId,
                    timestamp: timestamp,
                    temperature: waterTemp, // เปลี่ยนเป็นอุณหภูมิน้ำเรียบร้อย
                    rainVolume: rainArray[index] ?? 0.0,
                    weatherCondition: mapWmoToLegacyCode(wmoArray[index] ?? 0),
                },
            });
        });

        await Promise.all(upsertPromises);
        console.log(`[Backfill] บันทึกประวัติสภาพอากาศ (จัดเก็บแบบอุณหภูมิน้ำ) สำเร็จสำหรับ Location ID: ${locationId}`);
    } catch (error) {
        console.error(`[Backfill Error] สำหรับ Location ID ${locationId}:`, error);
    }
}

/**
 * [TH] ดึงข้อมูลสภาพอากาศแบบสด (Live) ณ พิกัดที่ระบุ พร้อมแปลงเป็นอุณหภูมิน้ำ
 * [EN] Fetches current live weather telemetry for a coordinate, computing estimated water temperature
 *
 * @async
 * @function getWeatherData
 * @param {number} lat - พิกัดละติจูด
 * @param {number} lng - พิกัดลองจิจูด
 * @returns {Promise<{ airTemperature: number | null; rainAccumulation: number | null; weatherCondCode: number | null } | null>} ข้อมูลสภาพอากาศสด หรือ null
 */
export async function getWeatherData(lat: number, lng: number): Promise<{ airTemperature: number | null; rainAccumulation: number | null; weatherCondCode: number | null } | null> {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=apparent_temperature,skin_temperature,rain,weather_code&timezone=Asia/Bangkok&models=ecmwf_ifs`;

        const response = await fetch(url, {
            signal: AbortSignal.timeout(4000),
        });

        if (!response.ok) return null;

        const data = await response.json();
        const current = data?.current;

        if (!current) return null;

        const baseLive = current.apparent_temperature_ecmwf_ifs ?? current.apparent_temperature ?? 29.5;
        const skinLive = current.skin_temperature_ecmwf_ifs ?? current.skin_temperature ?? baseLive;

        const currentHour = nowThai().getUTCHours();

        // 🌟 คำนวณอุณหภูมิน้ำ
        const waterTemp = calculateWaterTemperature(parseFloat(baseLive), parseFloat(skinLive), currentHour);

        return {
            // โครงสร้างคีย์เหมือนเดิมเป๊ะเพื่อไม่ให้ส่วนอื่นของโปรเจกต์พัง แต่เนื้อในเปลี่ยนเป็นอุณหภูมิน้ำแล้วครับบอส
            airTemperature: waterTemp,
            rainAccumulation: current.rain !== undefined ? parseFloat(current.rain) : null,
            weatherCondCode: current.weather_code !== undefined ? mapWmoToLegacyCode(Math.floor(current.weather_code)) : null,
        };
    } catch (error) {
        console.error("Error fetching weather data:", error);
        return null;
    }
}
