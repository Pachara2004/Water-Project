import { NextRequest, NextResponse } from "next/server";
import { evaluateValueAgainstStandards } from "@/lib/standards";
import { loadStandardsForParameters } from "@/lib/standards-db";
import { verifyAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

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

    // เส้นนี้ป้อนหน้า /submit เท่านั้น — officer (ผู้บริหาร) ไม่มีสิทธิ์ส่งตรวจจึงไม่ต้องวิเคราะห์ภาพ
    const auth = await verifyAuth(request, ["collector", "admin"]);
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

        // ชื่อสารที่ AI ตรวจสอบยืนยันแล้ว (Stage 2 safeguard อาจสลับชนิดสารให้อัตโนมัติ)
        // ใช้ค่านี้เป็นฐานคำนวณ status เพื่อกันเหนียว กรณี AI แก้ชนิดสารต่างจากที่ผู้ใช้ขอ
        const verifiedParameterName: string = aiResult.parameterName || dbParam.name;

        // 2. คำนวณสถานะความปลอดภัยจากเกณฑ์จริงในตาราง standards
        const currentParamName = dbParam.name.toLowerCase();

        // ถ้า AI ยืนยันว่าเป็นสารคนละตัวกับที่ผู้ใช้เลือก ให้ยึดสารที่ AI ตรวจได้เป็นฐานคำนวณ
        // (เดิมเดาจากชื่อ verifiedNameLower.includes("phosphate") ซึ่งรองรับแค่ 2 สาร
        //  และถ้า AI ตอบสารตัวที่สาม จะได้ค่า 0 ทั้งคู่ → ตอบ "ปลอดภัย" ทั้งที่ไม่เคยวัดอะไรเลย)
        //
        // ⚠️ ตรงนี้ยังต้องแปลง "ชื่อ" เป็น id เพราะ AI คืนมาเป็นข้อความ ไม่ใช่ parameterId
        //    จึงเป็นจุดเดียวในระบบที่ยังผูกด้วยชื่อ — ถ้า AI ตอบชื่อที่ไม่มีในตาราง Parameter
        //    (เช่น "PO4" แทน "phosphate") จะหาไม่เจอ ห้าม fallback ไปใช้สารที่ผู้ใช้เลือกเด็ดขาด
        //    เพราะจะกลายเป็นเอาค่าของสาร A ไปเทียบเกณฑ์ของสาร B แล้วตอบผลผิดอย่างมั่นใจ
        const verifiedParam =
            verifiedParameterName.toLowerCase() === currentParamName
                ? dbParam
                : await prisma.parameter.findFirst({
                      where: { name: { equals: verifiedParameterName.trim().toLowerCase() } },
                      select: { id: true },
                  });

        const standards = verifiedParam ? await loadStandardsForParameters([verifiedParam.id]) : [];

        // null = ตัดสินไม่ได้ เกิดได้ 2 กรณี: สารที่ AI ตอบไม่มีในระบบ | สารมีอยู่แต่ยังไม่มีเกณฑ์กำหนด
        // ทั้งสองกรณีต้องบอกหน้าบ้านตรง ๆ ว่าตัดสินไม่ได้ ห้ามเดาว่า "ปลอดภัย"
        const evaluatedStatus = verifiedParam ? evaluateValueAgainstStandards(aiResult.concentrated, standards.map((s) => s.maxValue)) : null;

        // ดึงข้อความแนะนำสเปกใหม่ ดักจับกรณีคีย์ผันแปร
        const aiMessage = aiResult.message || aiResult.text || "";

        // ดักจับ Bounding Box แบบครอบคลุมความผันผวนของคีย์ JSON ทั้งแบบเคสเว้นวรรคและอันเดอร์สกอร์
        const boundingBox = aiResult["bounding box"] || aiResult["bounding_box"] || [];

        // 3. คืนค่าผลลัพธ์ผ่าน JSON กลับไปให้หน้าบ้าน (Frontend)
        return NextResponse.json({
            parameterId: dbParam.id,
            parameterName: currentParamName, // ชื่อสารที่ผู้ใช้ระบุ (คงไว้เพื่อ label ภาพพล็อต)
            verifiedParameterName, // ชื่อสารที่ AI ตรวจยืนยัน ใช้เทียบว่าตรงกับที่ผู้ใช้ระบุไหม
            isTestTube: aiResult.is_test_tube ?? true, // ตรวจเจอหลอดทดลองในภาพหรือไม่
            concentrated: aiResult.concentrated,
            status: evaluatedStatus, // null = สารนี้ยังไม่มีเกณฑ์กำหนด ตัดสินไม่ได้

            confidence: aiResult.confidence,
            "bounding box": boundingBox,
            message: aiMessage,
        });
    } catch (error) {
        console.error("POST /api/analyze error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการวิเคราะห์ภาพ" }, { status: 500 });
    }
}
