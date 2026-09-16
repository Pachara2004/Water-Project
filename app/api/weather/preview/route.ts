/**
 * @file app/api/weather/preview/route.ts
 * @project Water Monitoring Project
 * @module API / Weather & Environment
 * @description
 * [TH] Route Handler สำหรับพรีวิวข้อมูลสภาพอากาศ (อุณหภูมิ, ปริมาณฝน, รหัสสภาพอากาศ) ณ พิกัดและเวลาเก็บตัวอย่าง (GET)
 * ตรวจสอบแคชในตาราง `WeatherData` หากยังไม่มี จะทำการดึงข้อมูลย้อนหลังจาก TMD/Open-Meteo API อัตโนมัติ (Backfill)
 * ใช้ในหน้าส่งตัวอย่างน้ำเพื่อให้ผู้เก็บตัวอย่างเห็นสภาพอากาศก่อนกดยืนยัน
 * [EN] Route Handler for previewing weather metrics (temperature, rain accumulation, weather code) for a location and timestamp (GET).
 * Checks the local `WeatherData` cache and triggers automatic TMD/Open-Meteo backfill on cache miss.
 * Used during sample submission flow to verify meteorological conditions before final submission.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-08-10
 * @version 1.1.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-08-10)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-11)
 *
 * @lastModified 2026-09-11
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-08-10 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Initial weather preview endpoint
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Explicit status return (ready, unavailable, error) and 502 handling
 *
 * @database Prisma Client (MySQL)
 * @external-service TMD / Open-Meteo Weather API
 * @see lib/tmd.ts, lib/thaiTime.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { backfillWeatherData } from "@/lib/tmd";
import { floorToHour, parseThaiInput } from "@/lib/thaiTime";

/**
 * ดึงข้อมูลพรีวิวสภาพอากาศตามสถานีและเวลาเก็บตัวอย่าง
 * Previews weather observations for a specific station and hourly timestamp.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม Query params `?locationId=...&collectionTime=...`
 * @returns {Promise<NextResponse>} ข้อมูลสภาพอากาศ { status, airTemperature, rainAccumulation, weatherCondCode }
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const locationId = searchParams.get("locationId");
        const collectionTime = searchParams.get("collectionTime");

        if (!locationId || !collectionTime) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        const location = await prisma.location.findUnique({
            where: { id: Number(locationId) },
        });

        if (!location) {
            return NextResponse.json({ error: "Location not found" }, { status: 404 });
        }

        // แปลงเวลาเก็บตัวอย่างให้ลงรอบชั่วโมง (00:00:00) ตามรอบการเก็บข้อมูล Weather
        const parsedTime = parseThaiInput(collectionTime);
        if (!parsedTime) {
            return NextResponse.json({ error: "Invalid collectionTime" }, { status: 400 });
        }
        const normalizedTime = floorToHour(parsedTime);

        let weatherCache = await prisma.weatherData.findUnique({
            where: {
                locationId_timestamp: {
                    locationId: Number(locationId),
                    timestamp: normalizedTime,
                },
            },
        });

        if (!weatherCache) {
            // ดึงข้อมูลสภาพอากาศของ TMD ย้อนหลังตามพิกัดและเวลา
            await backfillWeatherData(location.id, location.latitude, location.longitude);
            weatherCache = await prisma.weatherData.findUnique({
                where: {
                    locationId_timestamp: {
                        locationId: location.id,
                        timestamp: normalizedTime,
                    },
                },
            });
        }

        // "ไม่มีข้อมูลของชั่วโมงนี้" (unavailable) ต่างจาก "ระบบพัง" (error) ที่ตอบ 502 ด้านล่าง
        // ฝั่งหน้าส่งตรวจใช้ความต่างนี้เลือกข้อความ ทั้งที่บล็อกปุ่มวิเคราะห์เหมือนกัน
        return NextResponse.json({
            status: weatherCache ? "ready" : "unavailable",
            airTemperature: weatherCache?.temperature ?? null,
            rainAccumulation: weatherCache?.rainVolume ?? null,
            weatherCondCode: weatherCache?.weatherCondition ?? null,
        });
    } catch (error) {
        // เดิมกลืน error เป็น 200 พร้อมค่า null ทั้งก้อน ทำให้แยกจากกรณีไม่มีข้อมูลจริงไม่ได้
        console.error("Preview weather error:", error);
        return NextResponse.json({ status: "error", airTemperature: null, rainAccumulation: null, weatherCondCode: null }, { status: 502 });
    }
}
