import { NextRequest, NextResponse } from "next/server";
import { evaluateSample } from "@/lib/standards";
import { verifyAuth } from "@/lib/auth-guard";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const antiSpam = new Map<string, number>();

export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    // ⚡️ แกะดูชื่อสาร (parameterName) แทน ID เพื่อเอามาทำ Anti-Spam Key
    const cloneRequest = request.clone();
    let parameterNameStr = "default";
    try {
        const testData = await cloneRequest.formData();
        parameterNameStr = testData.get("parameterName")?.toString()?.toLowerCase() || "default";
    } catch (e) {}

    const spamKey = `${ip}_${parameterNameStr}`;
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

        // ⚡️ เปลี่ยนฟิลด์ที่รับจากหน้าบ้านเป็น parameterName (เช่น "ammonia", "phosphate")
        const parameterName = formData.get("parameterName") as string | null;

        if (!imageFile || !parameterName) {
            return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน (ขาดรูปภาพหรือชื่อพารามิเตอร์)" }, { status: 400 });
        }

        // 🔍 ค้นหาใน DB ของเราด้วยชื่อ (Name) เพื่อเอา ID มาใช้บันทึก/อ้างอิงภายในเว็บแอป
        const dbParam = await prisma.parameter.findFirst({
            where: {
                name: {
                    equals: parameterName.trim().toLowerCase(),
                },
            },
        });

        if (!dbParam) {
            return NextResponse.json({ error: `ไม่พบพารามิเตอร์ชื่อ '${parameterName}' นี้ในระบบฐานข้อมูล` }, { status: 400 });
        }

        console.log(`Analyzing ${dbParam.name}: ${imageFile.name} for User ID: ${auth.user?.id}`);

        // [กระบวนการอ่าน Buffer และหน่วงเวลาจำลองของบอส...]
        const bytes = await imageFile.arrayBuffer();
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // 🧠 จำลองผลลัพธ์จาก AI
        const mockConcentration = Math.random() * 2;

        const targetPhosphate = dbParam.name.toLowerCase().includes("phosphate") ? mockConcentration : 0;
        const targetAmmonia = dbParam.name.toLowerCase().includes("ammonia") ? mockConcentration : 0;
        const evalResult = evaluateSample(targetPhosphate, targetAmmonia);

        // ⚡️ คืนค่ากลับไปโดยระบุทั้ง Name และ ID คืนให้หน้าบ้าน
        return NextResponse.json({
            parameterId: dbParam.id,
            parameterName: dbParam.name.toLowerCase(), // ส่งชื่อพิมพ์เล็กกลับไปให้ฝั่ง AI/หน้าบ้านใช้คุยกันง่ายๆ
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
