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

        // 🔍 ดึงแถวทั้งหมดออกมาจาก DB ตามปกติเหมือนเดิมครับบอส
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

        // 🌟 1. ใช้ Map ควบแน่น จัดกลุ่มแถวที่ถือเลข sessionGroup เดียวกันให้อยู่ด้วยกันครับ
        const groupedSamples = new Map<string, any>();

        samples.forEach((s: any) => {
            // ดึงค่ากลุ่ม ถ้าไม่มีให้ดึง ID แถวมาทำเป็น Key สำรองตัวใครตัวมันครับบอส
            const groupKey = s.sessionGroup || `single-${s.id}`;

            // แปลงดึงค่าวัดเคมีรายสารของแถวนี้ออกมาก่อน
            const currentMeasurements: Record<string, number> = {};
            s.measurements.forEach((m: any) => {
                if (m.parameter?.name) {
                    const keyName = `${m.parameter.name.toLowerCase()}Val`;
                    currentMeasurements[keyName] = m.value;
                }
            });

            // 🌟 2. ถ้าเจอเลขชุดเซสชันนี้เป็นครั้งแรก ให้ตั้งต้นสร้างเป็น Object แม่แบบไว้ครับ
            if (!groupedSamples.has(groupKey)) {
                groupedSamples.set(groupKey, {
                    id: s.id, // ยึดไอดีหลักตัวแรกเป็นตัวอ้างอิง
                    collectorId: s.collectorId,
                    locationId: s.locationId,
                    collectionTime: s.collectionTime,
                    uploadedActiveAt: s.uploadedActiveAt,
                    dissolvedOxygen: s.dissolvedOxygen,
                    airTemperature: s.airTemperature,
                    rainAccumulation: s.rainAccumulation,
                    weatherCondCode: s.weatherCondCode,
                    rawImageUrl: s.rawImageUrl,         // ยึดรูปแรกประจำกลุ่ม
                    analyzedPlotUrl: s.analyzedPlotUrl, // ยึดรูปพล็อตแรกประจำกลุ่ม
                    isDeleted: s.isDeleted,
                    sessionGroup: s.sessionGroup,

                    // เริ่มต้นกางข้อมูลค่าวัดเคมีที่แงะออกมาได้รอบแรก
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
                    // สถานะภาพรวมเริ่มต้น (เดี๋ยวจะนำมาทับด้วยเงื่อนไขเลวร้ายสุดด้านล่างครับบอส)
                    status: s.status ? s.status.toUpperCase() : "SAFE", 
                });
            } else {
                // 🌟 3. ถ้ารหัสชุดเซสชันนี้เคยถูกสร้างไปแล้วใน Map (แปลว่าเป็นสารตัวถัดไปในชุดเดียวกัน)
                const existing = groupedSamples.get(groupKey);

                // ยัดค่าวัดเคมีของสารตัวนี้เพิ่มเติมเข้าไปในก้อนเดิมทันที!
                Object.assign(existing, currentMeasurements);

                // อัปเดตรูปภาพเพิ่มเติม หากตัวหลักยังไม่มีลิงก์แต่แถวลูกตัวนี้พ่วงมา
                if (!existing.rawImageUrl && s.rawImageUrl) existing.rawImageUrl = s.rawImageUrl;
                if (!existing.analyzedPlotUrl && s.analyzedPlotUrl) existing.analyzedPlotUrl = s.analyzedPlotUrl;

                // 🚨 อัปเดตสถานะความปลอดภัยภาพรวมของกลุ่ม (ยึดหลักเลวร้ายที่สุด: ถ้ามีตัวใดตัวหนึ่งขยับเป็น danger หรือ warning ให้กลุ่มนั้นเปลี่ยนตามทันที)
                const currentStatus = s.status ? s.status.toUpperCase() : "SAFE";
                if (currentStatus === "DANGER") {
                    existing.status = "DANGER";
                } else if (currentStatus === "WARNING" && existing.status !== "DANGER") {
                    existing.status = "WARNING";
                }
            }
        });

        // 🌟 4. แปลงข้อมูลจากแผนผัง Map กลับออกมาเป็น Array พรีเมียมส่งไปให้หน้าบ้านรันต่อ
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
        // 🌟 1. ดึงข้อมูล FormData ขึ้นมาด้านบนสุดตั้งแต่ต้นทางเพื่อเอามาคุม Key ป้องกันเบิ้ล
        const formData = await request.formData();
        const measurementsRaw = formData.get("measurements") as string | null;

        let paramKey = "unknown";
        if (measurementsRaw) {
            try {
                const parsed = JSON.parse(measurementsRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // แงะเอา Parameter ID ของสารรอบนี้ออกมาจับสแปม
                    paramKey = String(parsed[0].parameterId);
                }
            } catch (e) {}
        }

        // 🌐 2. ตั้งคีย์ป้องกันการสแปมรายสาร (IP ผสม ID สาร) คนละสารส่งมาพร้อมกันจะไม่โดนบล็อกแล้วครับ!
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
        const antiSpamKey = `${ip}-${paramKey}`;

        if (antiSpam.has(antiSpamKey) && Date.now() - antiSpam.get(antiSpamKey)! < 3000) {
            return NextResponse.json({ error: "อย่ากดซ้ำ ระบบกำลังประมวลผลสารนี้อยู่" }, { status: 429 });
        }
        antiSpam.set(antiSpamKey, Date.now());

        // SECURITY STEP 1: ตรวจสอบ Token ของ LINE
        const auth = await verifyAuth(request, ["collector", "admin"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        const secureCollectorId = auth.user!.id;

        // ดึงค่าหัวข้อหลัก
        const locationId = formData.get("locationId") as string;
        const status = formData.get("status") as string;
        const collectionTime = formData.get("collectionTime") as string;
        const oxygen = formData.get("oxygen") as string | null;

        // 🌟 3. ดักรับค่าเลขประจำกลุ่มเซสชันที่หน้าบ้านส่งมาผูก
        const sessionGroup = formData.get("sessionGroup") as string | null;

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

        const systemParameters = await prisma.parameter.findMany();

        // จัดการโฟลเดอร์ไฟล์อัปโหลด
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });

        const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
        const maxFileSize = 10 * 1024 * 1024;

        // ⚡️ บันทึกไฟล์รูปภาพเฉพาะสารที่เป็นของรอบ Request นี้จริง ๆ
        let mainRawImageUrl: string | null = null;
        let mainAnalyzedPlotUrl: string | null = null;

        for (const param of systemParameters) {
            const rawFile = formData.get(`image_raw_${param.id}`) as File | null;
            const plotFile = formData.get(`image_plot_${param.id}`) as File | null;

            if (rawFile && rawFile.size > 0 && allowedImageTypes.includes(rawFile.type) && rawFile.size <= maxFileSize) {
                const filename = sanitizeAndGenerateFilename(rawFile.name, `raw-${param.name.toLowerCase()}`);
                await writeFile(path.join(uploadDir, filename), Buffer.from(await rawFile.arrayBuffer()));

                // 🌟 หากไอดีสารแมตช์ตรงกับรอบการยิง ให้นำลิงก์รูปไปบันทึกใส่แถวนี้โดยตรงครับบอส
                if (String(param.id) === paramKey) {
                    mainRawImageUrl = `/uploads/${filename}`;
                }
            }

            if (plotFile && plotFile.size > 0 && allowedImageTypes.includes(plotFile.type) && plotFile.size <= maxFileSize) {
                const filename = sanitizeAndGenerateFilename(plotFile.name, `plot-${param.name.toLowerCase()}`);
                await writeFile(path.join(uploadDir, filename), Buffer.from(await plotFile.arrayBuffer()));

                // 🌟 บันทึกภาพพล็อต AI ลงเป็นรูปหลักของเรคคอร์ดสารนี้เช่นกัน
                if (String(param.id) === paramKey) {
                    mainAnalyzedPlotUrl = `/uploads/${filename}`;
                }
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

        // เตรียมข้อมูลชุดค่าวัดส่งให้ตารางย่อย
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

        // 💾 4. สั่งสร้างเรคคอร์ดลง Database แถวใครแถวมัน ยิงมารวมกันกี่สารก็แตกแถวตามจริงแบบหล่อ ๆ
        const sample = await prisma.waterSample.create({
            data: {
                locationId: Number(locationId),
                collectorId: secureCollectorId,
                collectionTime: parsedCollectionTime,
                dissolvedOxygen: oxygen ? parseFloat(oxygen) : null,
                airTemperature: weather?.temperature ?? null,
                rainAccumulation: weather?.rainVolume ?? null,
                weatherCondCode: weather?.weatherCondition ? Number(weather.weatherCondition) : null,
                status: status.toLowerCase() as WaterStatus,
                rawImageUrl: mainRawImageUrl, // ได้รูปภาพตรงของสารรอบนี้
                analyzedPlotUrl: mainAnalyzedPlotUrl, // ได้รูปพล็อตตรงของสารรอบนี้
                isDeleted: false,

                // 🌟 บันทึกรหัสกลุ่มเซสชันลงไปในฐานข้อมูล
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