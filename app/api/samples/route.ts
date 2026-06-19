import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTmdHourlyWeather } from "@/lib/tmd";
import { WaterStatus } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// GET /api/samples — ดึงรายการตัวอย่างน้ำ (กรองตัวที่ลบออกแล้ว)
// GET /api/samples — ดึงรายการตัวอย่างน้ำ (กรองตัวที่ลบออกแล้ว)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const locationId = searchParams.get("locationId");
        const collectedBy = searchParams.get("collectedBy");

        // 🎯 กำหนดค่าเริ่มต้น: ดึงเฉพาะเรคคอร์ดที่ยังไม่โดน Soft Delete เท่านั้น
        const where: any = { isDelete: false };

        if (locationId) where.locationId = locationId;
        if (collectedBy) where.collectorId = collectedBy;

        const samples = await prisma.waterSample.findMany({
            where,
            include: {
                location: true,  //  ดึงข้อมูลสถานที่ทั้งหมด (ได้ id, name, agency ครบถ้วน)
                collector: true, //  ดึงข้อมูลผู้เก็บข้อมูลทั้งหมด
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

// POST /api/samples — บันทึกตัวอย่างน้ำตัวใหม่พร้อมบันทึกไฟล์ภาพลง Disk
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        const locationId = formData.get("locationId") as string;
        const status = formData.get("status") as string;
        const collectedBy = formData.get("collectedBy") as string;
        const collectionTime = formData.get("collectionTime") as string;
        const phosphateVal = formData.get("phosphateVal") as string;
        const ammoniaVal = formData.get("ammoniaVal") as string;
        const oxygen = formData.get("oxygen") as string | null;

        // ดึงไฟล์ Binary ของรูปภาพ (ถ้ามี)
        const imageFile = formData.get("image") as File | null;
        const imagePlotFile = formData.get("imagePlot") as File | null; // รองรับเผื่อส่งรูปภาพพลอตมาด้วย

        if (!locationId || !status || !collectedBy || !collectionTime) {
            return NextResponse.json(
                { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
                { status: 400 },
            );
        }

        const location = await prisma.location.findUnique({
            where: { id: locationId },
        });
        if (!location) {
            return NextResponse.json(
                { error: "ไม่พบจุดตรวจที่ระบุในฐานข้อมูล" },
                { status: 404 },
            );
        }

        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });

        // บันทึกรูปต้นฉบับ
        let dbImageUrl: string | null = null;
        if (imageFile && imageFile.size > 0) {
            const filename = `raw-${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;
            await writeFile(
                path.join(uploadDir, filename),
                Buffer.from(await imageFile.arrayBuffer()),
            );
            dbImageUrl = `/uploads/${filename}`;
        }

        // บันทึกรูปพลอตวิเคราะห์ค่าสี (Image Plot)
        let dbImagePlotUrl: string | null = null;
        if (imagePlotFile && imagePlotFile.size > 0) {
            const filename = `plot-${Date.now()}-${imagePlotFile.name.replace(/\s+/g, "-")}`;
            await writeFile(
                path.join(uploadDir, filename),
                Buffer.from(await imagePlotFile.arrayBuffer()),
            );
            dbImagePlotUrl = `/uploads/${filename}`;
        }

        const parsedCollectionTime = new Date(collectionTime);
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

        const imageExpiresAt = dbImageUrl
            ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
            : null;

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
                imageUrl: dbImageUrl,
                imagePlotUrl: dbImagePlotUrl, // 👈 บันทึกตำแหน่งพิกัดรูปภาพพลอตสี
                isDelete: false, // เรคคอร์ดใหม่ ตั้งค่าเริ่มต้นเป็นใช้งานอยู่
            },
        });

        return NextResponse.json(sample, { status: 201 });
    } catch (error: any) {
        console.error("❌ POST /api/samples error:", error);
        return NextResponse.json(
            {
                error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
                details: error?.message,
            },
            { status: 500 },
        );
    }
}
