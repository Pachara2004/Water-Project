import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTmdHourlyWeather } from "@/lib/tmd";
import { WaterStatus } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// GET /api/samples — List samples, optionally filtered by locationId or collectorId
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const locationId = searchParams.get("locationId");
        const collectedBy = searchParams.get("collectedBy");

        const where: { locationId?: string; collectorId?: string } = {};
        if (locationId) where.locationId = locationId;
        if (collectedBy) where.collectorId = collectedBy;

        const samples = await prisma.waterSample.findMany({
            where,
            include: {
                location: { select: { name: true, agency: true } },
                collector: { select: { name: true } },
            },
            orderBy: { collectionTime: "desc" },
        });

        return NextResponse.json(samples);
    } catch (error) {
        console.error("GET /api/samples error:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
            { status: 500 },
        );
    }
}

// POST /api/samples — Create a new water sample record with weather API data
export async function POST(request: NextRequest) {
    try {
        // 💡 เปลี่ยนจาก request.json() มาสกัดอ่านค่าผ่าน FormData
        const formData = await request.formData();

        const locationId = formData.get("locationId") as string;
        const status = formData.get("status") as string;
        const collectedBy = formData.get("collectedBy") as string;
        const collectionTime = formData.get("collectionTime") as string;
        const phosphateVal = formData.get("phosphateVal") as string;
        const ammoniaVal = formData.get("ammoniaVal") as string;
        const oxygen = formData.get("oxygen") as string | null;

        // ดึงไฟล์ Binary รูปภาพดิบ
        const imageFile = formData.get("image") as File | null;

        if (!locationId || !status || !collectedBy || !collectionTime) {
            return NextResponse.json(
                { error: "กรุณากรอกข้อมูลและเลือกเวลาบันทึกให้ครบถ้วน" },
                { status: 400 },
            );
        }

        // 1. ตรวจสอบพิกัดของจุดตรวจในฐานข้อมูล
        const location = await prisma.location.findUnique({
            where: { id: locationId },
        });

        if (!location) {
            return NextResponse.json(
                { error: "ไม่พบจุดตรวจที่ระบุในฐานข้อมูล" },
                { status: 404 },
            );
        }

        // 💡 2. จัดการเซฟไฟล์รูปภาพลง Disk เซิร์ฟเวอร์เพื่อให้ได้ Path สั้นๆ
        let dbImageUrl: string | null = null;
        if (imageFile && imageFile.size > 0) {
            const arrayBuffer = await imageFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // สุ่มชื่อไฟล์ด้วย timestamp ป้องกันกรณีชื่อไฟล์ซ้ำกัน
            const filename = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;
            const uploadDir = path.join(process.cwd(), "public", "uploads");

            // สร้างโฟลเดอร์ออโต้หากยังไม่มีในระบบ
            await mkdir(uploadDir, { recursive: true });

            // เขียนไฟล์ลงไปที่โฟลเดอร์ public/uploads
            await writeFile(path.join(uploadDir, filename), buffer);

            // กำหนดค่าตำแหน่ง Path สัมพัทธ์สำหรับนำไปใช้งานต่อ
            dbImageUrl = `/uploads/${filename}`;
        }

        // Parse collection time
        const parsedCollectionTime = new Date(collectionTime);

        // 3. ดึงข้อมูลสภาพอากาศของกรมอุตุนิยมวิทยา (TMD)
        let weather = null;
        try {
            weather = await getTmdHourlyWeather(
                location.lat,
                location.lon,
                parsedCollectionTime,
            );
        } catch (weatherErr) {
            console.error("TMD Weather API Error (Non-blocking):", weatherErr);
        }

        // กำหนดวันหมดอายุรูปภาพภายใน 90 วัน
        const imageExpiresAt = dbImageUrl
            ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
            : null;

        // 4. สั่งเขียนข้อมูลเข้าตารางฐานข้อมูลหลัก
        const sample = await prisma.waterSample.create({
            data: {
                locationId,
                collectorId: collectedBy,
                collectionTime: parsedCollectionTime,
                ammonia: parseFloat(ammoniaVal || "0"),
                phosphate: parseFloat(phosphateVal || "0"),
                oxygen: oxygen ? parseFloat(oxygen) : null,
                temperature: weather?.temperature ?? null,
                rainVolume: weather?.rainVolume ?? null,
                weatherCondition: weather?.weatherCondition ?? null,
                status: status as WaterStatus,
                imageUrl: dbImageUrl, // หยอดค่าตัวแปร Path สั้นๆ ลงคอลัมน์ image_url
                imageExpiresAt,
            },
        });

        return NextResponse.json(sample, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/samples internal error:", error);
        return NextResponse.json(
            {
                error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
                details: error?.message,
            },
            { status: 500 },
        );
    }
}
