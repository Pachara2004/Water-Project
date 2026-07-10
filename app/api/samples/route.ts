import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeatherData } from "@/lib/tmd"; // 🌟 ดึงฟังก์ชันที่เราจูนเป็น Open-Meteo เรียบร้อยแล้วครับบอส
import { WaterStatus } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { verifyAuth } from "@/lib/auth-guard";

/**
 * 🔒 FILENAME SANITIZER WITH DATE STAMP
 */
function sanitizeAndGenerateFilename(originalName: string, prefix: string = "raw"): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStamp = `${year}${month}${day}`;

    const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
    const cleanExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";

    return `${prefix}-${dateStamp}-${crypto.randomUUID()}.${cleanExt}`;
}

// 🌐 Anti-Spam Key ผสม IP + Action ป้องกันการกดเบิ้ลส่งข้อมูล
const antiSpam = new Map<string, number>();

// ==========================================
// 📥 GET /api/samples — เวอร์ชันรวมกลุ่มตาม sessionGroup พรีเมียม
// ==========================================
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const locationId = searchParams.get("locationId");
        const collectedBy = searchParams.get("collectedBy");

        const where: any = { isDeleted: false };
        if (locationId) where.locationId = Number(locationId);
        if (collectedBy) where.collectorId = Number(collectedBy);

        const samples = await prisma.waterSample.findMany({
            where,
            include: {
                location: true,
                collector: {
                    select: {
                        id: true,
                        lineProfileName: true,
                        firstName: true,
                        lastName: true,
                        phoneNumber: true,
                    },
                },
                measurements: {
                    include: {
                        parameter: true,
                    },
                },
            },
            orderBy: { collectionTime: "desc" },
        });

        const groupedSamples = new Map<string, any>();

        samples.forEach((s: any) => {
            const groupKey = s.sessionGroup || `single-${s.id}`;

            const currentMeasurements: Record<string, number> = {};
            s.measurements.forEach((m: any) => {
                if (m.parameter?.name) {
                    const keyName = `${m.parameter.name.toLowerCase()}Val`;
                    currentMeasurements[keyName] = m.value;
                }
            });

            if (!groupedSamples.has(groupKey)) {
                groupedSamples.set(groupKey, {
                    id: s.id,
                    collectorId: s.collectorId,
                    locationId: s.locationId,
                    collectionTime: s.collectionTime,
                    uploadedActiveAt: s.uploadedActiveAt,
                    dissolvedOxygen: s.dissolvedOxygen,
                    airTemperature: s.airTemperature,
                    rainAccumulation: s.rainAccumulation,
                    weatherCondCode: s.weatherCondCode,
                    rawImageUrl: s.rawImageUrl,
                    analyzedPlotUrl: s.analyzedPlotUrl,
                    isDeleted: s.isDeleted,
                    sessionGroup: s.sessionGroup,

                    ...currentMeasurements,

                    location: s.location
                        ? {
                              id: s.location.id,
                              name: s.location.stationName,
                              organization: s.location.governingAgency,
                              lat: s.location.latitude,
                              lng: s.location.longitude,
                          }
                        : null,
                    collector: s.collector,
                    status: s.status ? s.status.toUpperCase() : "SAFE",
                });
            } else {
                const existing = groupedSamples.get(groupKey);

                Object.assign(existing, currentMeasurements);

                if (!existing.rawImageUrl && s.rawImageUrl) existing.rawImageUrl = s.rawImageUrl;
                if (!existing.analyzedPlotUrl && s.analyzedPlotUrl) existing.analyzedPlotUrl = s.analyzedPlotUrl;

                const currentStatus = s.status ? s.status.toUpperCase() : "SAFE";
                if (currentStatus === "DANGER") {
                    existing.status = "DANGER";
                } else if (currentStatus === "WARNING" && existing.status !== "DANGER") {
                    existing.status = "WARNING";
                }
            }
        });

        const formattedSamples = Array.from(groupedSamples.values());
        return NextResponse.json(formattedSamples);
    } catch (error) {
        console.error("GET /api/samples error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลผลตรวจน้ำ" }, { status: 500 });
    }
}

// ==========================================
// 📤 POST /api/samples — บันทึกผลตรวจแยกรายสารอิงตาม Database 100%
// ==========================================
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const measurementsRaw = formData.get("measurements") as string | null;

        let paramKey = "unknown";
        if (measurementsRaw) {
            try {
                const parsed = JSON.parse(measurementsRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    paramKey = String(parsed[0].parameterId);
                }
            } catch (e) {}
        }

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
        const antiSpamKey = `${ip}-${paramKey}`;

        if (antiSpam.has(antiSpamKey) && Date.now() - antiSpam.get(antiSpamKey)! < 3000) {
            return NextResponse.json({ error: "อย่ากดซ้ำ ระบบกำลังประมวลผลสารนี้อยู่" }, { status: 429 });
        }
        antiSpam.set(antiSpamKey, Date.now());

        const auth = await verifyAuth(request, ["collector", "admin"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        const secureCollectorId = auth.user!.id;

        const locationId = formData.get("locationId") as string;
        const status = formData.get("status") as string;
        const collectionTime = formData.get("collectionTime") as string;
        const oxygen = formData.get("oxygen") as string | null;
        const sessionGroup = formData.get("sessionGroup") as string | null;

        if (!locationId || !status || !collectionTime) {
            return NextResponse.json({ error: "กรุณากรอกข้อมูลหลักให้ครบถ้วน" }, { status: 400 });
        }

        const location = await prisma.location.findUnique({
            where: { id: Number(locationId) },
        });
        if (!location) {
            return NextResponse.json({ error: "ไม่พบสถานีจุดตรวจที่ระบุในระบบ" }, { status: 404 });
        }

        const systemParameters = await prisma.parameter.findMany();

        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });

        const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
        const maxFileSize = 10 * 1024 * 1024;

        let mainRawImageUrl: string | null = null;
        let mainAnalyzedPlotUrl: string | null = null;

        for (const param of systemParameters) {
            const rawFile = formData.get(`image_raw_${param.id}`) as File | null;
            const plotFile = formData.get(`image_plot_${param.id}`) as File | null;

            if (rawFile && rawFile.size > 0 && allowedImageTypes.includes(rawFile.type) && rawFile.size <= maxFileSize) {
                const filename = sanitizeAndGenerateFilename(rawFile.name, `raw-${param.name.toLowerCase()}`);
                await writeFile(path.join(uploadDir, filename), Buffer.from(await rawFile.arrayBuffer()));

                if (String(param.id) === paramKey) {
                    mainRawImageUrl = `/uploads/${filename}`;
                }
            }

            if (plotFile && plotFile.size > 0 && allowedImageTypes.includes(plotFile.type) && plotFile.size <= maxFileSize) {
                const filename = sanitizeAndGenerateFilename(plotFile.name, `plot-${param.name.toLowerCase()}`);
                await writeFile(path.join(uploadDir, filename), Buffer.from(await plotFile.arrayBuffer()));

                if (String(param.id) === paramKey) {
                    mainAnalyzedPlotUrl = `/uploads/${filename}`;
                }
            }
        }

        const parsedCollectionTime = new Date(collectionTime);

        // 🌟 1. ตั้งตัวแปรสำหรับเก็บข้อมูลสภาพอากาศชุดเดียวที่จะใช้ร่วมกันทั้งกลุ่ม
        let finalWeather = {
            airTemperature: null as number | null,
            rainAccumulation: null as number | null,
            weatherCondCode: null as number | null,
        };

        try {
            // 🔍 2. ส่องเช็คก่อนว่า มีสารเคมีเพื่อนร่วมชุดบันทึกเซฟเข้าไปในเซสชันกลุ่มนี้ก่อนเราหรือยัง
            let existingGroupSample = null;
            if (sessionGroup) {
                existingGroupSample = await prisma.waterSample.findFirst({
                    where: {
                        sessionGroup: sessionGroup,
                        isDeleted: false,
                    },
                    select: {
                        airTemperature: true,
                        rainAccumulation: true,
                        weatherCondCode: true,
                    },
                });
            }

            if (existingGroupSample) {
                // 🤝 ถ้ารุ่นพี่สารตัวแรกยิงเก็บสภาพอากาศไว้แล้ว หยิบมาแชร์ใช้ด้วยกันเลยครับบอส! (ลดภาระ Network เหลือ 0)
                finalWeather.airTemperature = existingGroupSample.airTemperature;
                finalWeather.rainAccumulation = existingGroupSample.rainAccumulation;
                finalWeather.weatherCondCode = existingGroupSample.weatherCondCode;
            } else {
                // 🌐 ถ้ายังไม่มีใครส่งเลย (เราคือสารตัวแรกของเซสชันนี้) ค่อยยิงไปขอ Open-Meteo ครับบอส
                const weatherInfo = await getWeatherData(location.latitude, location.longitude);
                if (weatherInfo) {
                    finalWeather.airTemperature = weatherInfo.airTemperature;
                    finalWeather.rainAccumulation = weatherInfo.rainAccumulation;
                    finalWeather.weatherCondCode = weatherInfo.weatherCondCode;
                }
            }
        } catch (weatherErr) {
            console.error("Weather resolution error:", weatherErr);
        }

        let createMeasurementsData: Array<{ parameterId: number; value: number; confidence: number; boundingBox?: string | null; message?: string | null }> = [];

        if (measurementsRaw) {
            const parsedMeasurements = JSON.parse(measurementsRaw);
            if (Array.isArray(parsedMeasurements)) {
                createMeasurementsData = parsedMeasurements.map((m: any) => ({
                    parameterId: Number(m.parameterId),
                    value: parseFloat(m.value || "0"),
                    confidence: parseFloat(m.confidence || "0.90"),
                    boundingBox: m.boundingBox || null,
                    message: m.message || null,
                }));
            }
        }

        // 💾 3. สั่งบันทึกข้อมูลลงฐานข้อมูลแถวใครแถวมันเหมือนเดิม
        const sample = await prisma.waterSample.create({
            data: {
                locationId: Number(locationId),
                collectorId: secureCollectorId,
                collectionTime: parsedCollectionTime,
                dissolvedOxygen: oxygen ? parseFloat(oxygen) : null,

                // 🌟 ผูกค่าสภาพอากาศแบบหลอมรวมกลุ่มก้อนที่คำนวณมาได้ลง Database ครับบอส
                airTemperature: finalWeather.airTemperature,
                rainAccumulation: finalWeather.rainAccumulation,
                weatherCondCode: finalWeather.weatherCondCode,

                status: status.toLowerCase() as WaterStatus,
                rawImageUrl: mainRawImageUrl,
                analyzedPlotUrl: mainAnalyzedPlotUrl,
                isDeleted: false,
                sessionGroup: sessionGroup,
                measurements: {
                    create: createMeasurementsData,
                },
            },
        });

        return NextResponse.json(sample, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/samples error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลตัวอย่างน้ำลงฐานข้อมูล", details: error?.message }, { status: 500 });
    }
}
