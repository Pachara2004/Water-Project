import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTmdHourlyWeather } from "@/lib/tmd";
import { WaterStatus } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto"; // 🛡️ นำเข้าโมดูลสากลเพื่อใช้สลักคีย์เอกลักษณ์ UUID
import { verifyAuth } from "@/lib/auth-guard";

/**
 * 🔒 FILENAME SANITIZER WITH DATE STAMP
 * หน้าที่: สกัดวันที่ปัจจุบัน (YYYYMMDD) + คลีนชื่อไฟล์ขยะแยกตัวเป็น UUID ตัวเล็ก ปลอดภัยบน Linux 100%
 */
function sanitizeAndGenerateFilename(originalName: string, prefix: string = "raw"): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStamp = `${year}${month}${day}`; // ผลลัพธ์: "20260630"

    const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
    const cleanExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg"; // บังคับอักขระตัวพิมพ์เล็ก

    return `${prefix}-${dateStamp}-${crypto.randomUUID()}.${cleanExt}`; // ประกอบร่างฟอร์แมตสะอาดสูงสุด
}

// GET /api/samples — ดึงประวัติข้อมูลผลตรวจน้ำ (ปัจจุบันเปิดเป็น Public ให้ทุกคนเข้าถึงเพื่อเรนเดอร์กราฟชาร์ตได้)
export async function GET(request: NextRequest) {
    try {
        /* หมายเหตุ: หากในอนาคตบอสต้องการจำกัดให้ดูข้อมูลได้เฉพาะกลุ่มเจ้าหน้าที่ สามารถปลดคอมเมนต์ 3 บรรทัดนี้ได้เลยครับ:
        const auth = await verifyAuth(request, ["collector", "officer", "admin"]);
        if (!auth.isValid) return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        */

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
            },
            orderBy: { collectionTime: "desc" },
        });

        const formattedSamples = samples.map((s: any) => ({
            ...s,
            phosphateVal: s.phosphateValue,
            ammoniaVal: s.ammoniaValue,
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

            status: s.status ? s.status.toUpperCase() : "SAFE",
        }));

        return NextResponse.json(formattedSamples);
    } catch (error) {
        console.error("GET /api/samples error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลผลตรวจน้ำ" }, { status: 500 });
    }
}

const antiSpam = new Map<string, number>();

// POST /api/samples — บันทึกตัวอย่างข้อมูลน้ำเข้าฐานข้อมูล
export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    if (antiSpam.has(ip) && Date.now() - antiSpam.get(ip)! < 3000) return NextResponse.json({ error: "อย่ากดซ้ำ" }, { status: 429 });
    antiSpam.set(ip, Date.now());

    try {
        // SECURITY STEP 1: ตรวจสอบและสกัดสิทธิ์จาก LINE Token: อนุญาตเฉพาะ collector และ admin เท่านั้น
        const auth = await verifyAuth(request, ["collector", "admin"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        const formData = await request.formData();

        const locationId = formData.get("locationId") as string;
        const status = formData.get("status") as string;
        const collectionTime = formData.get("collectionTime") as string;
        const phosphateVal = formData.get("phosphateVal") as string;
        const ammoniaVal = formData.get("ammoniaVal") as string;
        const oxygen = formData.get("oxygen") as string | null;

        const imageFile = formData.get("image") as File | null;
        const imagePlotFile = formData.get("imagePlot") as File | null;

        if (!locationId || !status || !collectionTime) {
            return NextResponse.json({ error: "กรุณากรอกข้อมูลหลักให้ครบถ้วน" }, { status: 400 });
        }

        // SECURITY STEP 2: คัดลอก ID ผู้ส่งผลน้ำโดยตรงจาก Token ของ LINE (auth.user.id)
        const secureCollectorId = auth.user!.id;

        // 🛡️ ขยับด่านตรวจขึ้นบน: ค้นหาดักเช็กสถานีจุดตรวจพิกัดก่อนการขยับไปบันทึกรูปภาพลงดิสก์
        const location = await prisma.location.findUnique({
            where: { id: Number(locationId) },
        });
        if (!location) {
            return NextResponse.json({ error: "ไม่พบสถานีจุดตรวจที่ระบุในระบบ" }, { status: 404 });
        }

        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });

        const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
        const maxFileSize = 10 * 1024 * 1024;

        // SECURITY STEP 3: Safe File Upload รูปภาพต้นฉบับปกติ (ล้างชื่อใส่กลอน YYYYMMDD)
        let dbImageUrl: string | null = null;
        if (imageFile && imageFile.size > 0) {
            if (!allowedImageTypes.includes(imageFile.type)) {
                return NextResponse.json({ error: "ไฟล์ภาพต้นฉบับต้องเป็นไฟล์รูปแบบ JPG, PNG หรือ WEBP เท่านั้น" }, { status: 400 });
            }
            if (imageFile.size > maxFileSize) {
                return NextResponse.json({ error: "ขนาดไฟล์ภาพต้นฉบับต้องไม่เกิน 5MB" }, { status: 400 });
            }

            const filename = sanitizeAndGenerateFilename(imageFile.name, "raw");
            await writeFile(path.join(uploadDir, filename), Buffer.from(await imageFile.arrayBuffer()));
            dbImageUrl = `/uploads/${filename}`;
        }

        // 🔥 ปลดคอมเมนต์ออกแล้ว เพื่อเซฟรูป Plot ลงดิสก์จริงไว้ศึกษาโครงสร้างระบบ
        // SECURITY STEP 4: Safe File Upload รูปผลพล็อตสีวิเคราะห์ค่า
        let dbImagePlotUrl: string | null = null;
        if (imagePlotFile && imagePlotFile.size > 0) {
            if (!allowedImageTypes.includes(imagePlotFile.type)) {
                return NextResponse.json({ error: "ไฟล์ภาพผลวิเคราะห์ต้องเป็นไฟล์รูปแบบ JPG, PNG หรือ WEBP เท่านั้น" }, { status: 400 });
            }
            if (imagePlotFile.size > maxFileSize) {
                return NextResponse.json({ error: "ขนาดไฟล์ภาพผลวิเคราะห์ต้องไม่เกิน 5MB" }, { status: 400 });
            }

            // ✨ เรียกใช้ฟังก์ชันจัดการชื่อไฟล์พ่วงวันที่ให้คลีนระดับสากลเหมือนกัน
            const filename = sanitizeAndGenerateFilename(imagePlotFile.name, "plot");
            await writeFile(path.join(uploadDir, filename), Buffer.from(await imagePlotFile.arrayBuffer()));
            dbImagePlotUrl = `/uploads/${filename}`;
        }

        const parsedCollectionTime = new Date(collectionTime);
        let weather = null;
        try {
            weather = await getTmdHourlyWeather(location.latitude, location.longitude, parsedCollectionTime);
        } catch (weatherErr) {
            console.error("TMD Weather API Error (Non-blocking):", weatherErr);
        }

        // บันทึกข้อมูลลงฐานข้อมูลอย่างปลอดภัย
        const sample = await prisma.waterSample.create({
            data: {
                locationId: Number(locationId),
                collectorId: secureCollectorId,
                collectionTime: parsedCollectionTime,
                ammoniaValue: parseFloat(ammoniaVal || "0"),
                phosphateValue: parseFloat(phosphateVal || "0"),
                dissolvedOxygen: oxygen ? parseFloat(oxygen) : null,
                airTemperature: weather?.temperature ?? null,
                rainAccumulation: weather?.rainVolume ?? null,
                weatherCondCode: weather?.weatherCondition ? Number(weather.weatherCondition) : null,
                status: status.toLowerCase() as WaterStatus,
                rawImageUrl: dbImageUrl,
                analyzedPlotUrl: dbImagePlotUrl, // 👈 กลับมาผูกตัวแปรชี้พิกัดลง Database ตามเดิมเพื่อเก็บสถิติ
                isDeleted: false,
            },
        });

        return NextResponse.json(sample, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/samples error:", error);
        return NextResponse.json(
            {
                error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลตัวอย่างน้ำ",
                details: error?.message,
            },
            { status: 500 },
        );
    }
}
