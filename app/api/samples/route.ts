import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeatherData, backfillWeatherData } from "@/lib/tmd";
import { WaterStatus } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { verifyAuth } from "@/lib/auth-guard";
import { isLowConfidence } from "@/lib/standards";
import { getPendingSessionGroups } from "@/lib/review";

/**
 * FILENAME SANITIZER WITH DATE STAMP
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

// Anti-Spam Key ผสม IP + Action ป้องกันการกดเบิ้ลส่งข้อมูล
const antiSpam = new Map<string, number>();

// ==========================================
// GET /api/samples — ประวัติผลตรวจของตัวเอง เวอร์ชันรวมกลุ่มตาม sessionGroup
// เห็นเฉพาะของตัวเอง (collectorId = ผู้ใช้ที่ยืนยันตัวตนแล้วเท่านั้น) รวมถึงรายการที่ยัง pending อยู่
// ==========================================
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAuth(request, ["collector", "admin"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        // collector เห็นได้เฉพาะของตัวเอง (ไม่เชื่อ collectorId จาก query param — ปลอมเป็นคนอื่นได้)
        // admin เห็นข้อมูลทุกคนได้ (ตามสิทธิ์เดิม) — toggle "เฉพาะของฉัน" ที่หน้าบ้านกรองต่อฝั่ง client เอง
        const where: any = { isDeleted: false };
        if (auth.user!.roleName !== "admin") {
            where.collectorId = auth.user!.id;
        }

        // ชุด sessionGroup ที่ยัง pending อยู่ — ใช้แค่ "ติด badge" ไม่ได้กรองทิ้ง เพราะ endpoint นี้ต้อง auth แล้วเท่านั้น
        const pendingGroups = await getPendingSessionGroups();
        const pendingSet = new Set(pendingGroups);

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

                    // ติด badge ว่า session นี้รออนุมัติอยู่หรือไม่ (สร้าง/ปฏิเสธพร้อมกันทั้ง session เสมอ ไม่ต้องอัปเดตตอน merge)
                    reviewStatus: pendingSet.has(groupKey) ? "PENDING" : "APPROVED",

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
// POST /api/samples — บันทึกผลตรวจแยกรายสารอิงตาม Database 100%
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

        // 1. สร้าง Array สำหรับเก็บฟังก์ชันจำพวก Async Tasks ที่จะสั่งรันพร้อมกัน
        const fileTasks: Promise<void>[] = [];

        for (const param of systemParameters) {
            const rawFile = formData.get(`image_raw_${param.id}`) as File | null;
            const plotFile = formData.get(`image_plot_${param.id}`) as File | null;

            if (rawFile && rawFile.size > 0 && allowedImageTypes.includes(rawFile.type) && rawFile.size <= maxFileSize) {
                const filename = sanitizeAndGenerateFilename(rawFile.name, `raw-${param.name.toLowerCase()}`);
                
                // ปรับจุดที่ 1: ห่อคำสั่งแกะ ArrayBuffer และสั่งเซฟไฟล์ให้อยู่ในโครงสร้าง Async เดียวกัน
                const saveRawTask = (async () => {
                    const buffer = Buffer.from(await rawFile.arrayBuffer());
                    await writeFile(path.join(uploadDir, filename), buffer);
                })();
                fileTasks.push(saveRawTask);

                if (String(param.id) === paramKey) {
                    mainRawImageUrl = `/uploads/${filename}`;
                }
            }

            if (plotFile && plotFile.size > 0 && allowedImageTypes.includes(plotFile.type) && plotFile.size <= maxFileSize) {
                const filename = sanitizeAndGenerateFilename(plotFile.name, `plot-${param.name.toLowerCase()}`);
                
                // 🌟 ปรับจุดที่ 2: ห่อคำสั่งแกะภาพพล็อตให้อยู่ในโครงสร้าง Async เดียวกันเช่นกัน
                const savePlotTask = (async () => {
                    const buffer = Buffer.from(await plotFile.arrayBuffer());
                    await writeFile(path.join(uploadDir, filename), buffer);
                })();
                fileTasks.push(savePlotTask);

                if (String(param.id) === paramKey) {
                    mainAnalyzedPlotUrl = `/uploads/${filename}`;
                }
            }
        }

        // 🔥 สั่งรัน Parallel ทั้งการแกะไฟล์ภาพและบันทึกลงดิสก์ไปพร้อม ๆ กันในช็อตเดียว
        if (fileTasks.length > 0) {
            await Promise.all(fileTasks);
        }

        const parsedCollectionTime = new Date(collectionTime);

        // 1. ตั้งตัวแปรสำหรับเก็บข้อมูลสภาพอากาศชุดเดียวที่จะใช้ร่วมกันทั้งกลุ่ม
        let finalWeather = {
            airTemperature: null as number | null,
            rainAccumulation: null as number | null,
            weatherCondCode: null as number | null,
        };

        try {
            // 2. ส่องเช็คก่อนว่า มีสารเคมีเพื่อนร่วมชุดบันทึกเซฟเข้าไปในเซสชันกลุ่มนี้ก่อนเราหรือยัง
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
                // 🤝 ถ้ารุ่นพี่สารตัวแรกเซฟค่าแชร์ไว้แล้ว ดึงมาใช้ต่อเลยเพื่อความเร็วระดับสูงสุด
                finalWeather.airTemperature = existingGroupSample.airTemperature;
                finalWeather.rainAccumulation = existingGroupSample.rainAccumulation;
                finalWeather.weatherCondCode = existingGroupSample.weatherCondCode;
            } else {
                // 💾 หากเราคือสารตัวแรกสุดของรอบนี้ (หรือส่งแบบขวดเดี่ยวเดี่ยว) ให้ดึงตรงจากฐานข้อมูลแคชสภาพอากาศ
                // 🚨 ไฮไลท์เด็ด: ต้องตัดนาที วินาที มิลลิวินาที ทิ้งให้เป็น 00:00.000 เพื่อให้ตรงคีย์ @@unique ใน DB แคช
                const normalizedTime = new Date(parsedCollectionTime.getTime());
                normalizedTime.setMinutes(0, 0, 0); 
                normalizedTime.setSeconds(0, 0);

                let weatherCache = await prisma.weatherData.findUnique({
                    where: {
                        locationId_timestamp: {
                            locationId: Number(locationId),
                            timestamp: normalizedTime,
                        },
                    },
                });

                // 🚨 กรณีฉุกเฉิน: หากเจ้าหน้าที่กรอกวันย้อนหลังเกิน 2 เดือน แล้วใน DB ไม่มีข้อมูล 
                // สั่งซ่อมแซมประวัติย้อนหลังตรงรอบพิกัดนั้นทันที
                if (!weatherCache) {
                    console.log(`⚠️ [API Sample] ไม่พบแคชสภาพอากาศใน DB รอบเวลา ${normalizedTime.toISOString()} สั่งซ่อมแซมข้อมูล...`);
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

                // ดึงค่าอุณหภูมิ, น้ำฝน และสภาพอากาศมาจัดใส่กระเป๋าเพื่อเอาไปเซฟ
                if (weatherCache) {
                    finalWeather.airTemperature = weatherCache.temperature;
                    finalWeather.rainAccumulation = weatherCache.rainVolume;
                    finalWeather.weatherCondCode = weatherCache.weatherCondition;
                }
            }
        } catch (weatherErr) {
            console.error("❌ Weather resolution error:", weatherErr);
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

        // 4. ตัดสิน low-confidence ฝั่ง server เท่านั้น จาก confidence ที่พาร์สแล้วจริง ๆ ไม่เชื่อ flag จาก client
        const needsReview = sessionGroup ? createMeasurementsData.some((m) => isLowConfidence(m.confidence)) : false;

        // 5. สั่งบันทึกข้อมูล + สร้างคำร้องตรวจสอบ (ถ้าจำเป็น) รวมใน Transaction เดียวกัน
        //    กันเคสเซฟ sample สำเร็จแต่สร้างคำร้องพลาด ซึ่งจะทำให้ข้อมูล confidence ต่ำรั่วออกสู่สาธารณะ
        const sample = await prisma.$transaction(async (tx) => {
            const created = await tx.waterSample.create({
                data: {
                    locationId: Number(locationId),
                    collectorId: secureCollectorId,
                    collectionTime: parsedCollectionTime,
                    dissolvedOxygen: oxygen ? parseFloat(oxygen) : null,

                    // ผูกค่าสภาพอากาศแบบหลอมรวมกลุ่มก้อนที่คำนวณมาได้ลง Database ครับบอส
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

            if (needsReview && sessionGroup) {
                // upsert แทน create: ตอนส่งแบบคู่ (2 สาร) ยิง POST แยกกันทีละสารด้วย sessionGroup เดียวกัน
                //    สารตัวแรกที่ต่ำสร้างคำร้อง ตัวถัดไปเจอว่ามีคำร้องแล้วก็ปล่อยผ่าน (ทั้ง session pending ร่วมกันเสมอ)
                await tx.reviewRequest.upsert({
                    where: { sessionGroup },
                    create: { sessionGroup, statusRequest: "pending" },
                    update: {},
                });
            }

            return created;
        });

        return NextResponse.json(sample, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/samples error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลตัวอย่างน้ำลงฐานข้อมูล", details: error?.message }, { status: 500 });
    }
}
