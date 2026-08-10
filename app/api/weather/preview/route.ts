import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { backfillWeatherData } from "@/lib/tmd";

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
        const cleanStr = collectionTime.replace(/(Z|\+\d{2}:\d{2})$/, "");
        const [datePart, timePart] = cleanStr.split("T");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hours, minutes] = timePart.split(":").map(Number);

        const normalizedTime = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
        normalizedTime.setMinutes(0, 0, 0);

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

        return NextResponse.json({
            airTemperature: weatherCache?.temperature ?? null,
            rainAccumulation: weatherCache?.rainVolume ?? null,
            weatherCondCode: weatherCache?.weatherCondition ?? null,
        });
    } catch (error) {
        console.error("Preview weather error:", error);
        return NextResponse.json({ airTemperature: null, rainAccumulation: null, weatherCondCode: null });
    }
}
