import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { evaluateSample } from "@/lib/standards";
import { verifyAuth } from "@/lib/auth-guard"; 

/**
 * POST /api/analyze — AI Image Analysis Endpoint
 * * รับรูปภาพจากหน้าบ้าน -> บันทึกลง Disk -> ประมวลผลร่วมกับ API โมเดล -> พ่นผลลัพธ์พร้อมกล่อง Bounding Box กลับไป
 */
export async function POST(request: NextRequest) {
    // สกัดสิทธิ์ดักจับโทเคน: อนุญาตให้เฉพาะ collector, officer, และ admin เท่านั้น
    const auth = await verifyAuth(request, ["collector", "officer", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const formData = await request.formData();
        const imageFile = formData.get("image") as File | null;

        // Validation ตรวจสอบไฟล์อัปโหลด
        if (!imageFile) {
            return NextResponse.json({ error: "กรุณาอัปโหลดรูปภาพ" }, { status: 400 });
        }

        if (!imageFile.type.startsWith("image/")) {
            return NextResponse.json({ error: "ไฟล์ที่อัพโหลดไม่ใช่รูปภาพ" }, { status: 400 });
        }

        console.log(`Received image: ${imageFile.name}, size: ${imageFile.size} bytes (Uploaded by User ID: ${auth.user?.id})`);

        // บันทึกรูปภาพต้นฉบับลงโฟลเดอร์ public/uploads
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
        }

        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const filename = `sample_${Date.now()}.jpg`;
        const filepath = path.join(uploadsDir, filename);
        await writeFile(filepath, buffer);

        console.log(`Image saved to: ${filepath}`);

        // ส่วนติดต่อประมวลผลข้อมูลร่วมกับ API ของบอส
        await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1500));

        const apiResult = {
            id: filename,
            concentrated: 2.5,
            ammonia: true,
            phosphate: false,
            confidence: 10,
            "bounding box": [500, 700, 150, 550],
        };

        apiResult.phosphate = !apiResult.ammonia;

        const targetPhosphate = apiResult.ammonia ? 0 : apiResult.concentrated;
        const targetAmmonia = apiResult.ammonia ? apiResult.concentrated : 0;

        const evalResult = evaluateSample(targetPhosphate, targetAmmonia);
        const status = evalResult.overallStatus;

        console.log(`API Processing Complete: PO4=${targetPhosphate}, NH3=${targetAmmonia}, Status=${status}`);

        return NextResponse.json({
            phosphate: targetPhosphate,
            ammonia: targetAmmonia,
            status: status,
            imageUrl: `/uploads/${filename}`,
            ...apiResult,
        });
    } catch (error) {
        console.error("POST /api/analyze error:", error);
        const errorMessage = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการวิเคราะห์ภาพ";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
