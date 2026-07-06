import { NextRequest, NextResponse } from "next/server";
import { evaluateSample } from "@/lib/standards";
import { verifyAuth } from "@/lib/auth-guard";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const antiSpam = new Map<string, number>();

export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    // แกะ FormData รอบแรกเพื่อเอา parameterId มาทำ Anti-Spam Key
    const cloneRequest = request.clone();
    let parameterIdStr = "default";
    try {
        const testData = await cloneRequest.formData();
        parameterIdStr = testData.get("parameterId")?.toString() || "default";
    } catch (e) {}

    const spamKey = `${ip}_${parameterIdStr}`;
    if (antiSpam.has(spamKey) && Date.now() - antiSpam.get(spamKey)! < 3000) {
        return NextResponse.json({ error: "อย่ากดซ้ำ ระบบกำลังประมวลผลสารนี้อยู่" }, { status: 429 });
    }
    antiSpam.set(spamKey, Date.now());

    const auth = await verifyAuth(request, ["collector", "officer", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const formData = await request.formData();
        const imageFile = formData.get("image") as File | null;
        const parameterId = Number(formData.get("parameterId"));

        if (!imageFile || !parameterId) {
            return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน (ขาดรูปภาพหรือพารามิเตอร์)" }, { status: 400 });
        }

        // 🔍 ไปดึงข้อมูล Master Data ของสารตัวนี้มาจาก Database จริง ๆ
        const dbParam = await prisma.parameter.findUnique({
            where: { id: parameterId },
        });

        if (!dbParam) {
            return NextResponse.json({ error: "ไม่พบพารามิเตอร์นี้ในระบบ" }, { status: 400 });
        }

        console.log(`Analyzing ${dbParam.name}: ${imageFile.name} for User ID: ${auth.user?.id}`);

        const bytes = await imageFile.arrayBuffer();
        const imageBuffer = Buffer.from(bytes);

        // จำลองเวลาประมวลผลของ AI
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // 🧠 จำลองผลลัพธ์คำนวณค่าจาก AI (เปลี่ยนโมเดลตรงนี้ตามจริง)
        const mockConcentration = Math.random() * 2;

        // ดึงโครงสร้างการตรวจสอบเกณฑ์น้ำมาตรฐาน (อ้างอิงตามชื่อใน DB)
        const targetPhosphate = dbParam.name.toLowerCase().includes("phosphate") ? mockConcentration : 0;
        const targetAmmonia = dbParam.name.toLowerCase().includes("ammonia") ? mockConcentration : 0;

        const evalResult = evaluateSample(targetPhosphate, targetAmmonia);

        return NextResponse.json({
            parameterId: dbParam.id,
            parameterName: dbParam.name,
            concentrated: mockConcentration,
            status: evalResult.overallStatus,
            confidence: 95,
            "bounding box": [500, 700, 150, 550],
        });
    } catch (error) {
        console.error("POST /api/analyze error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการวิเคราะห์ภาพ" }, { status: 500 });
    }
}
