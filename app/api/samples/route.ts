import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTmdHourlyWeather } from "@/lib/tmd";
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
// 📥 GET /api/samples — ดึงประวัติข้อมูลผลตรวจน้ำแบบ Dynamic
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

        const formattedSamples = samples.map((s: any) => {
            const dynamicMeasurements: Record<string, number> = {};
            s.measurements.forEach((m: any) => {
                if (m.parameter?.name) {
                    const keyName = `${m.parameter.name.toLowerCase()}Val`;
                    dynamicMeasurements[keyName] = m.value;
                }
            });

            return {
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

                ...dynamicMeasurements,

                phosphateVal: dynamicMeasurements["phosphateVal"] ?? 0,
                ammoniaVal: dynamicMeasurements["ammoniaVal"] ?? 0,

                rainVolume: s.rainAccumulation,
                weatherCondition: s.weatherCondCode,
                collectedAt: s.collectionTime,

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
            };
        });

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
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    if (antiSpam.has(ip) && Date.now() - antiSpam.get(ip)! < 3000) {
        return NextResponse.json({ error: "อย่ากดซ้ำ ระบบกำลังประมวลผลเซสชันนี้อยู่" }, { status: 429 });
    }
    antiSpam.set(ip, Date.now());

    try {
        // SECURITY STEP 1: ตรวจสอบ Token ของ LINE
        const auth = await verifyAuth(request, ["collector", "admin"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        const secureCollectorId = auth.user!.id; // แกะ ID ยูสเซอร์ตัวจริงออกมารองรับไว้ตรงนี้
        const formData = await request.formData();

        const locationId = formData.get("locationId") as string;
        const status = formData.get("status") as string;
        const collectionTime = formData.get("collectionTime") as string;
        const oxygen = formData.get("oxygen") as string | null;

        if (!locationId || !status || !collectionTime) {
            return NextResponse.json({ error: "กรุณากรอกข้อมูลหลักให้ครบถ้วน" }, { status: 400 });
        }

        // SECURITY STEP 2: ตรวจความถูกต้องของสถานีจุดตรวจ
        const location = await prisma.location.findUnique({
            where: { id: Number(locationId) },
        });
        if (!location) {
            return NextResponse.json({ error: "ไม่พบสถานีจุดตรวจที่ระบุในระบบ" }, { status: 404 });
        }

        // 🔍 ไปดึงรายการ Master Data สารทั้งหมดในระบบมาเพื่อตรวจสอบความถูกต้อง
        const systemParameters = await prisma.parameter.findMany();

        // เตรียมความพร้อมสำหรับโฟลเดอร์ไฟล์อัปโหลด
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });

        const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
        const maxFileSize = 10 * 1024 * 1024;

        // ⚡️ SECURITY STEP 3 & 4: วนลูปบันทึกไฟล์รูปภาพแยกตามรายสารเคมีจริงจาก Database
        let mainRawImageUrl: string | null = null;
        let mainAnalyzedPlotUrl: string | null = null;

        for (const param of systemParameters) {
            const rawFile = formData.get(`image_raw_${param.id}`) as File | null;
            const plotFile = formData.get(`image_plot_${param.id}`) as File | null;

            if (rawFile && rawFile.size > 0 && allowedImageTypes.includes(rawFile.type) && rawFile.size <= maxFileSize) {
                const filename = sanitizeAndGenerateFilename(rawFile.name, `raw-${param.name.toLowerCase()}`);
                await writeFile(path.join(uploadDir, filename), Buffer.from(await rawFile.arrayBuffer()));
                if (!mainRawImageUrl) mainRawImageUrl = `/uploads/${filename}`;
            }

            if (plotFile && plotFile.size > 0 && allowedImageTypes.includes(plotFile.type) && plotFile.size <= maxFileSize) {
                const filename = sanitizeAndGenerateFilename(plotFile.name, `plot-${param.name.toLowerCase()}`);
                await writeFile(path.join(uploadDir, filename), Buffer.from(await plotFile.arrayBuffer()));
                if (!mainAnalyzedPlotUrl) mainAnalyzedPlotUrl = `/uploads/${filename}`;
            }
        }

        // ดึงสภาพอากาศ TMD API
        const parsedCollectionTime = new Date(collectionTime);
        let weather = null;
        try {
            weather = await getTmdHourlyWeather(location.latitude, location.longitude, parsedCollectionTime);
        } catch (weatherErr) {
            console.error("TMD Weather API Error:", weatherErr);
        }

        // เตรียมชุดข้อมูล Nested Write เพื่อบันทึกลงตารางความสัมพันธ์ย่อย WaterSampleMeasurement
        let createMeasurementsData: Array<{ parameterId: number; value: number; confidence: number; boundingBox?: string | null; message?: string | null }> = [];
        const measurementsRaw = formData.get("measurements") as string | null;

        if (measurementsRaw) {
            // หน้าบ้านส่งแบบ JSON Array มาให้แบบพรีเมียม ครบถ้วนตามโครงสร้าง Required Fields จริง
            const parsedMeasurements = JSON.parse(measurementsRaw);
            if (Array.isArray(parsedMeasurements)) {
                createMeasurementsData = parsedMeasurements.map((m: any) => ({
                    parameterId: Number(m.parameterId),
                    value: parseFloat(m.value || "0"),
                    confidence: parseFloat(m.confidence || "0.90"), // ใส่ค่า Default รองรับความแม่นยำ AI
                    boundingBox: m.boundingBox || null,
                    message: m.message || null
                }));
            }
        } else {
            // Fallback เผื่อหน้าบ้านแบบเก่าส่งมาเป็นเดี่ยว ๆ (phosphateVal, ammoniaVal)
            const paramAmmonia = systemParameters.find((p) => p.name === "ammonia");
            const paramPhosphate = systemParameters.find((p) => p.name === "phosphate");

            if (paramAmmonia) {
                createMeasurementsData.push({
                    parameterId: paramAmmonia.id,
                    value: parseFloat((formData.get("ammoniaVal") as string) || "0"),
                    confidence: 0.90,
                    boundingBox: null,
                    message: null
                });
            }
            if (paramPhosphate) {
                createMeasurementsData.push({
                    parameterId: paramPhosphate.id,
                    value: parseFloat((formData.get("phosphateVal") as string) || "0"),
                    confidence: 0.90,
                    boundingBox: null,
                    message: null
                });
            }
        }

        // 💾 บันทึกทุกอย่างลงฐานข้อมูลแบบ Dynamic ม้วนเดียวจบ ไร้การชนระลอกสอง
        const sample = await prisma.waterSample.create({
            data: {
                locationId: Number(locationId),
                collectorId: secureCollectorId, // ใช้ ID ความปลอดภัยที่ผ่านการตรวจสอบสิทธิ์แล้ว
                collectionTime: parsedCollectionTime,
                dissolvedOxygen: oxygen ? parseFloat(oxygen) : null,
                airTemperature: weather?.temperature ?? null,
                rainAccumulation: weather?.rainVolume ?? null,
                weatherCondCode: weather?.weatherCondition ? Number(weather.weatherCondition) : null,
                status: status.toLowerCase() as WaterStatus,
                rawImageUrl: mainRawImageUrl,
                analyzedPlotUrl: mainAnalyzedPlotUrl,
                isDeleted: false,

                // ⚡️ บันทึกค่าวัดกระจายลงตารางเชื่อม Junction
                measurements: {
                    create: createMeasurementsData,
                },
            },
        });

        return NextResponse.json(sample, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/samples error:", error);
        return NextResponse.json(
            {
                error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลตัวอย่างน้ำลงฐานข้อมูล",
                details: error?.message,
            },
            { status: 500 },
        );
    }
}