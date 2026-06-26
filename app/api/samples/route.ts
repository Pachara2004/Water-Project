import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTmdHourlyWeather } from "@/lib/tmd";
import { WaterStatus } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

async function getAuthenticatedUser(request: NextRequest) {
    const id = request.headers.get("x-user-id");
    const role = request.headers.get("x-user-role");

    if (!id || !role) return null;
    return { id: Number(id), role: role.toLowerCase() };
}

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
            },
            orderBy: { collectionTime: "desc" },
        });

        const formattedSamples = samples.map((s: any) => ({
            ...s,
            // 1. จำลองสร้างฟิลด์สารเคมีตัวย่อ (phosphateVal, ammoniaVal) ส่งไปให้กราฟ Recharts อ่านค่า
            phosphateVal: s.phosphateValue,
            ammoniaVal: s.ammoniaValue,

            // 2. จำลองสร้างฟิลด์สภาพอากาศเดิม ส่งไปสนับสนุนลอจิกคัดกรองฝั่งหน้าบ้าน
            rainVolume: s.rainAccumulation,
            weatherCondition: s.weatherCondCode,
            collectedAt: s.collectionTime,

            // 3. ปรับโครงสร้าง Object ในตารางพิกัด ย้ายจาก name/organization ไปเข้าคู่ฟิลด์เดิมของชาร์ตบอส
            location: s.location
                ? {
                      id: s.location.id,
                      name: s.location.name,
                      organization: s.location.organization,
                      lat: s.location.latitude,
                      lng: s.location.longitude,
                  }
                : null,

            // 4. บังคับแปลงสถานะผลน้ำกลับไปเป็นตัวพิมพ์ใหญ่ ('SAFE' | 'WARNING' | 'DANGER')
            status: s.status ? s.status.toUpperCase() : "SAFE",
        }));

        // จัดส่งอาร์เรย์โครงสร้างข้อมูลพิกัดเดิมไปให้หน้าบ้านเรนเดอร์กราฟ
        return NextResponse.json(formattedSamples);
    } catch (error) {
        console.error("GET /api/samples error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลผลตรวจน้ำ" }, { status: 500 });
    }
}

// POST /api/samples — บันทึกตัวอย่างน้ำ
export async function POST(request: NextRequest) {
    try {
        // SECURITY STEP 1: ตรวจสอบสิทธิ์ผู้ใช้งานผ่านระบบ Headers (ซิงค์พิมพ์เล็กเรียบร้อย)
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized: กรุณาเข้าสู่ระบบก่อนทำรายการ" }, { status: 401 });
        }

        if (user.role !== "admin" && user.role !== "collector") {
            return NextResponse.json({ error: "Forbidden: บัญชีของคุณไม่มีสิทธิ์ส่งผลตรวจน้ำ" }, { status: 403 });
        }

        const formData = await request.formData();

        const locationId = formData.get("locationId") as string;
        const status = formData.get("status") as string; // ค่า 'safe' | 'warning' | 'danger'
        const collectedBy = formData.get("collectedBy") as string;
        const collectionTime = formData.get("collectionTime") as string;
        const phosphateVal = formData.get("phosphateVal") as string;
        const ammoniaVal = formData.get("ammoniaVal") as string;
        const oxygen = formData.get("oxygen") as string | null;

        const imageFile = formData.get("image") as File | null;
        const imagePlotFile = formData.get("imagePlot") as File | null;

        if (!locationId || !status || !collectedBy || !collectionTime) {
            return NextResponse.json({ error: "กรุณากรอกข้อมูลหลักให้ครบถ้วน" }, { status: 400 });
        }

        // SECURITY STEP 2: ป้องกันการส่งข้อมูลสวมรอยข้ามชื่อเจ้าหน้าที่ท่านอื่น
        if (user.role !== "admin" && Number(collectedBy) !== user.id) {
            return NextResponse.json(
                {
                    error: "Forbidden: ไม่สามารถสวมรอยส่งผลตรวจน้ำในนามบุคคลอื่นได้",
                },
                { status: 403 },
            );
        }

        // ค้นหาสถานีพิกัดจุดตรวจ (แปลง Type เป็น Number)
        const location = await prisma.location.findUnique({
            where: { id: Number(locationId) },
        });
        if (!location) {
            return NextResponse.json({ error: "ไม่พบสถานีจุดตรวจที่ระบุในระบบ" }, { status: 404 });
        }

        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });

        // เกณฑ์การสแกนคัดกรองความปลอดภัยไฟล์ภาพ (5MB และชนิดที่อนุญาต)
        const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
        const maxFileSize = 5 * 1024 * 1024;

        // SECURITY STEP 3: Safe File Upload รูปภาพต้นฉบับ (สุ่มชื่อใหม่เป็น UUID ขจัด Filename Injection)
        let dbImageUrl: string | null = null;
        if (imageFile && imageFile.size > 0) {
            if (!allowedImageTypes.includes(imageFile.type)) {
                return NextResponse.json(
                    {
                        error: "ไฟล์ภาพต้นฉบับต้องเป็นไฟล์รูปแบบ JPG, PNG หรือ WEBP เท่านั้น",
                    },
                    { status: 400 },
                );
            }
            if (imageFile.size > maxFileSize) {
                return NextResponse.json({ error: "ขนาดไฟล์ภาพต้นฉบับต้องไม่เกิน 5MB" }, { status: 400 });
            }

            const ext = imageFile.name.split(".").pop() || "jpg";
            const filename = `raw-${crypto.randomUUID()}.${ext}`;
            await writeFile(path.join(uploadDir, filename), Buffer.from(await imageFile.arrayBuffer()));
            dbImageUrl = `/uploads/${filename}`;
        }

        // SECURITY STEP 4: Safe File Upload รูปผลพล็อตสีวิเคราะห์ค่า
        let dbImagePlotUrl: string | null = null;
        if (imagePlotFile && imagePlotFile.size > 0) {
            if (!allowedImageTypes.includes(imagePlotFile.type)) {
                return NextResponse.json(
                    {
                        error: "ไฟล์ภาพผลวิเคราะห์ต้องเป็นไฟล์รูปแบบ JPG, PNG หรือ WEBP เท่านั้น",
                    },
                    { status: 400 },
                );
            }
            if (imagePlotFile.size > maxFileSize) {
                return NextResponse.json({ error: "ขนาดไฟล์ภาพผลวิเคราะห์ต้องไม่เกิน 5MB" }, { status: 400 });
            }

            const ext = imagePlotFile.name.split(".").pop() || "jpg";
            const filename = `plot-${crypto.randomUUID()}.${ext}`;
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

        // บันทึกข้อมูลลงฐานข้อมูลโดยจับคู่ความสัมพันธ์ของฟิลด์ Expressive Snake Case ใหม่
        const sample = await prisma.waterSample.create({
            data: {
                locationId: Number(locationId),
                collectorId: Number(collectedBy),
                collectionTime: parsedCollectionTime,
                ammoniaValue: parseFloat(ammoniaVal || "0"),
                phosphateValue: parseFloat(phosphateVal || "0"),
                dissolvedOxygen: oxygen ? parseFloat(oxygen) : null,
                airTemperature: weather?.temperature ?? null,
                rainAccumulation: weather?.rainVolume ?? null,
                weatherCondCode: weather?.weatherCondition ? Number(weather.weatherCondition) : null,
                status: status.toLowerCase() as WaterStatus,
                rawImageUrl: dbImageUrl,
                analyzedPlotUrl: dbImagePlotUrl,
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
