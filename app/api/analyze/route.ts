import { NextRequest, NextResponse } from "next/server";
import { evaluateSample } from "@/lib/standards";
import { verifyAuth } from "@/lib/auth-guard";

const antiSpam = new Map<string, number>();

/**
 * POST /api/analyze — AI Image Analysis Endpoint (In-Memory Only)
 * * ดึงภาพจากหน้าบ้าน -> แปลงเป็น Buffer ในแรม -> ส่งตรวจวิเคราะห์ -> พ่นผลลัพธ์กลับทันที โดยไม่มีการเขียนไฟล์ลง Disk
 */
export async function POST(request: NextRequest) {
    // สเต็ปที่ 1: ดักคนกดย้ำรัวตั้งแต่ประตูหน้าสุด (Cooldown 3 วินาที)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    if (antiSpam.has(ip) && Date.now() - antiSpam.get(ip)! < 3000) {
        return NextResponse.json({ error: "อย่ากดซ้ำ ระบบกำลังประมวลผล" }, { status: 429 });
    }
    antiSpam.set(ip, Date.now());

    // สเต็ปที่ 2: ตรวจสอบ Token สิทธิ์จาก LINE
    const auth = await verifyAuth(request, ["collector", "officer", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const formData = await request.formData();
        const imageFile = formData.get("image") as File | null;

        // Validation ตรวจสอบความถูกต้องของไฟล์
        if (!imageFile) {
            return NextResponse.json({ error: "กรุณาอัปโหลดรูปภาพ" }, { status: 400 });
        }

        if (!imageFile.type.startsWith("image/")) {
            return NextResponse.json({ error: "ไฟล์ที่อัพโหลดไม่ใช่รูปภาพ" }, { status: 400 });
        }

        console.log(`Analyzing image: ${imageFile.name} (${imageFile.size} bytes) in memory for User ID: ${auth.user?.id}`);

        // แปลงไฟล์ภาพเป็นก้อน Buffer พักไว้ในแรม (Memory Only) เพื่อเตรียมส่งต่อให้ AI
        // สลัดโค้ด writeFile และ mkdir ตัวเก่าทิ้งไปเลย ไม่มีไฟล์ขยะหลุดลงเซิร์ฟเวอร์แน่นอน
        const bytes = await imageFile.arrayBuffer();
        const imageBuffer = Buffer.from(bytes);

        // จำลองสถานการณ์เชื่อมต่อประมวลผลข้อมูลร่วมกับ API โมเดล AI ของบอส
        await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1500));

        // ก้อนข้อมูลสมมุติที่ได้กลับมาจากโมดูลตรวจจับเฉดสี
        const apiResult = {
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

        console.log(`AI Memory Analysis Complete: PO4=${targetPhosphate}, NH3=${targetAmmonia}, Status=${status}`);

        // ตอบกลับผลวิเคราะห์ให้หน้าบ้านเอาไปแสดงผลพรีวิว
        // หมายเหตุ: คืนค่าเฉพาะข้อมูลดิบไปให้หน้าบ้านพรีวิว ส่วน URL ภาพจริงจะยังไม่เกิดขึ้นจนกว่าจะไปกดปุ่มบันทึกที่หน้า `samples` ครับ
        return NextResponse.json({
            phosphate: targetPhosphate,
            ammonia: targetAmmonia,
            status: status,
            ...apiResult,
        });
    } catch (error) {
        console.error("POST /api/analyze error:", error);
        const errorMessage = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการวิเคราะห์ภาพ";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
