import { NextRequest, NextResponse } from "next/server";
import { evaluateSample } from "@/lib/standards"; 
import { verifyAuth } from "@/lib/auth-guard";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const antiSpam = new Map<string, number>();

const apiAi = process.env.API_AI_URL;

export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    const cloneRequest = request.clone();
    let parameterNameStr = "default";
    try {
        const testData = await cloneRequest.formData();
        parameterNameStr = testData.get("parameterName")?.toString()?.toLowerCase() || "default";
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        const parameterName = formData.get("parameterName") as string | null;

        if (!imageFile || !parameterName) {
            return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน (ขาดรูปภาพหรือชื่อพารามิเตอร์)" }, { status: 400 });
        }

        // ค้นหาพารามิเตอร์จากฐานข้อมูล
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

        console.log(`Connecting to AI Pipeline for ${dbParam.name}...`);

        // 1. จัดแจง FormData ส่งเข้าหา AI Pipeline
        const apiFormData = new FormData();
        const blob = new Blob([await imageFile.arrayBuffer()], { type: imageFile.type });
        apiFormData.append("image", blob, imageFile.name);

        // ฟอร์แมตชื่อส่งไปหาโมเดล AI (ปรับตัวแรกเป็นพิมพ์ใหญ่ตามสเปก)
        const formattedParamName = dbParam.name.charAt(0).toUpperCase() + dbParam.name.slice(1).toLowerCase();
        apiFormData.append("parameterName", formattedParamName);

        const aiResponse = await fetch(apiAi, {
            method: "POST",
            body: apiFormData,
        });

        if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            console.error("FastAPI Server Error:", errorText);
            return NextResponse.json({ error: "AI Pipeline เกิดข้อผิดพลาดในการประมวลผล" }, { status: 502 });
        }

        // แกะผลลัพธ์จากสเปกใหม่ของทีม AI
        const aiResult = await aiResponse.json();

        // 2. คำนวณสถานะความปลอดภัยแบบ Dynamic เพื่อรักษาระบบเดิม
        const currentParamName = dbParam.name.toLowerCase();
        const targetPhosphate = currentParamName.includes("phosphate") ? aiResult.concentrated : 0;
        const targetAmmonia = currentParamName.includes("ammonia") ? aiResult.concentrated : 0;

        // เรียกใช้งานเกณฑ์มาตรฐานกลางในเว็บแอป (เปิดช่องทางสำหรับปรับปรุงโมดูลรวมสารในอนาคต)
        const evalResult = evaluateSample(targetPhosphate, targetAmmonia);

        // ดึงข้อความแนะนำสเปกใหม่ ดักจับกรณีคีย์ผันแปร
        const aiMessage = aiResult.message || aiResult.text || "";

        // ดักจับ Bounding Box แบบครอบคลุมความผันผวนของคีย์ JSON ทั้งแบบเคสเว้นวรรคและอันเดอร์สกอร์
        const boundingBox = aiResult["bounding box"] || aiResult["bounding_box"] || [];

        // 3. คืนค่าผลลัพธ์ผ่าน JSON กลับไปให้หน้าบ้าน (Frontend)
        return NextResponse.json({
            parameterId: dbParam.id,
            parameterName: currentParamName,
            concentrated: aiResult.concentrated,
            status: evalResult.overallStatus, 
            confidence: aiResult.confidence, 
            "bounding box": boundingBox, 
            message: aiMessage, 
        });
    } catch (error) {
        console.error("POST /api/analyze error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการวิเคราะห์ภาพ" }, { status: 500 });
    }
}
