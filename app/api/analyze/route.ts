import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { evaluateSample } from "@/lib/standards";

/**
 * POST /api/analyze — AI Image Analysis Endpoint
 * * รับรูปภาพจากหน้าบ้าน -> บันทึกลง Disk -> ประมวลผลร่วมกับ API โมเดล -> พ่นผลลัพธ์พร้อมกล่อง Bounding Box กลับไป
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const imageFile = formData.get("image") as File | null;

        // 1. Validation ตรวจสอบไฟล์อัปโหลด
        if (!imageFile) {
            return NextResponse.json(
                { error: "กรุณาอัปโหลดรูปภาพ" },
                { status: 400 },
            );
        }

        if (!imageFile.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "ไฟล์ที่อัพโหลดไม่ใช่รูปภาพ" },
                { status: 400 },
            );
        }

        console.log(
            `Received image: ${imageFile.name}, size: ${imageFile.size} bytes`,
        );

        // 2. บันทึกรูปภาพต้นฉบับลงโฟลเดอร์ public/uploads
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

        // 3. ส่วนติดต่อประมวลผลข้อมูลร่วมกับ API ของบอส
        // บอสสามารถนำตัวแปรหรือฟังก์ชัน fetch เชื่อมหา Server โมเดลนอกมาแทนบล็อก Mock ด้านล่างนี้ได้เลยครับ

        // จำลองการดีเลย์ของโครงข่ายเวลาคุยกับ API นอก
        await new Promise((resolve) =>
            setTimeout(resolve, 1500 + Math.random() * 1500),
        );

        // ตัวอย่างก้อน Object ที่ได้กลับมาจาก API ภายนอกจริง (มีคีย์เว้นวรรค "bounding box")
        const apiResult = {
            id: filename,
            concentrated: 2.5, // ค่าความเข้มข้นที่วิเคราะห์ได้
            ammonia: true, // สุ่มว่าเป็นแอมโมเนียหรือฟอสเฟต
            phosphate: false,
            confidence: 10,
            "bounding box": [
               500, // x_min
                700, // x_max
                150, // y_min
                550, // y_max
            ]
        };

        // บังคับสลับประเภทคีย์สารเคมีให้แมปปิ้งเข้าสู่ตารางฐานข้อมูลหลัก
        apiResult.phosphate = !apiResult.ammonia;

        const targetPhosphate = apiResult.ammonia ? 0 : apiResult.concentrated;
        const targetAmmonia = apiResult.ammonia ? apiResult.concentrated : 0;

        // ประเมินสถานะความปลอดภัย (SAFE / WARNING / DANGER) ตามเกณฑ์มาตรฐานชายฝั่ง
        const evalResult = evaluateSample(targetPhosphate, targetAmmonia);
        const status = evalResult.overallStatus;

        console.log(
            `API Processing Complete: PO4=${targetPhosphate}, NH3=${targetAmmonia}, Status=${status}`,
        );

        // 4. ส่งผลลัพธ์กระจายทุกคีย์ (Spread Operator) กลับไปให้ Frontend ทั้งหมด
        return NextResponse.json({
            phosphate: targetPhosphate,
            ammonia: targetAmmonia,
            status: status,
            imageUrl: `/uploads/${filename}`,

            // ⚡ จุดเด่น: แตกกระจายก้อนพิกัด "bounding box" ส่งแนบไปพร้อมกันทันที
            ...apiResult,
        });
    } catch (error) {
        console.error("POST /api/analyze error:", error);

        const errorMessage =
            error instanceof Error
                ? error.message
                : "เกิดข้อผิดพลาดในการวิเคราะห์ภาพ";

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
