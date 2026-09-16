/**
 * @file app/api/analyze/route.ts
 * @project Water Monitoring Project
 * @module API / Water Quality Analysis
 * @description
 * [TH] Route Handler สำหรับการวิเคราะห์ภาพถ่ายแถบทดสอบ/หลอดทดลองคุณภาพน้ำผ่าน AI Pipeline (FastAPI)
 * และประเมินระดับความปลอดภัยของสารตามเกณฑ์มาตรฐานในฐานข้อมูล พร้อมระบบป้องกันคำขอซ้ำ (Anti-Spam)
 * [EN] Route Handler for analyzing water test strip/tube images via the external AI Pipeline (FastAPI)
 * and evaluating safety status against database water standards, equipped with memory-safe anti-spam throttling.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.2.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-06-09)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-08)
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-08-19)
 *
 * @lastModified 2026-08-19
 * @lastModifiedBy Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 *
 * @changelog
 * - 2026-06-09 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Initial setup of AI analysis endpoint
 * - 2026-07-08 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Optimize query performance
 * - 2026-07-14 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Add sample submission modes
 * - 2026-07-17 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Remove hardcoded standards to database-driven
 * - 2026-07-27 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Role access check adjustments
 * - 2026-08-19 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Performance optimization for route and AI payload
 *
 * @database Prisma Client (MySQL)
 * @auth Bearer Token / Role-based (collector, admin)
 * @external-service FastAPI Water Analysis AI Server (`API_AI_URL`)
 */

import { NextRequest, NextResponse } from "next/server";
import { evaluateValueAgainstStandards } from "@/lib/standards";
import { loadStandardsForParameters } from "@/lib/standards-db";
import { verifyAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

// Map สำหรับ Anti-spam พร้อมกลไก Cleanup ไม่ให้กิน Memory
const antiSpam = new Map<string, number>();

const apiAi = process.env.API_AI_URL;

/**
 * จัดการคำขอ POST สำหรับการวิเคราะห์ภาพถ่ายคุณภาพน้ำด้วย AI
 * Handles POST requests to analyze water sample images using external AI and evaluate results against standards.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม FormData (image, parameterName)
 * @returns {Promise<NextResponse>} ผลการวิเคราะห์ภาพ ความเข้มข้น สถานะความปลอดภัย และพิกัด Bounding Box
 */
export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

    // 1. ตรวจสอบ Auth ก่อนทำงานหนัก (Fail-fast ป้องกัน Parse ไฟล์รูปถ้า Token ผิด)
    const auth = await verifyAuth(request, ["collector", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        // 2. Parse FormData เพียงครั้งเดียว ไม่ใช้ clone()
        const formData = await request.formData();
        const imageFile = formData.get("image") as File | null;
        const parameterName = formData.get("parameterName") as string | null;

        if (!imageFile || !parameterName) {
            return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน (ขาดรูปภาพหรือชื่อพารามิเตอร์)" }, { status: 400 });
        }

        // 3. Anti-Spam Check แบบ Zero-overhead
        const now = Date.now();
        const parameterNameStr = parameterName.trim().toLowerCase();
        const spamKey = `${ip}_${parameterNameStr}`;

        const lastRequestTime = antiSpam.get(spamKey);
        if (lastRequestTime && now - lastRequestTime < 3000) {
            return NextResponse.json({ error: "อย่ากดซ้ำ ระบบกำลังประมวลผลสารนี้อยู่" }, { status: 429 });
        }
        antiSpam.set(spamKey, now);

        // Memory Cleanup: ล้างคีย์ที่หมดอายุเมื่อ Map เริ่มมีขนาดโต
        if (antiSpam.size > 500) {
            for (const [key, timestamp] of antiSpam.entries()) {
                if (now - timestamp >= 3000) {
                    antiSpam.delete(key);
                }
            }
        }

        // 4. ค้นหาพารามิเตอร์จากฐานข้อมูล
        const dbParam = await prisma.parameter.findFirst({
            where: {
                name: {
                    equals: parameterNameStr,
                },
            },
        });

        if (!dbParam) {
            return NextResponse.json({ error: `ไม่พบพารามิเตอร์ชื่อ '${parameterName}' นี้ในระบบฐานข้อมูล` }, { status: 400 });
        }

        console.log(`Connecting to AI Pipeline for ${dbParam.name}...`);

        // 5. ส่ง File เข้า AI Pipeline โดยตรง ไม่ต้อง decode/encode arrayBuffer ใหม่
        const apiFormData = new FormData();
        apiFormData.append("image", imageFile, imageFile.name);

        const formattedParamName = dbParam.name.charAt(0).toUpperCase() + dbParam.name.slice(1).toLowerCase();
        apiFormData.append("parameterName", formattedParamName);

        if (!apiAi) {
            console.error("API_AI_URL is not defined");
            return NextResponse.json({ error: "การตั้งค่าระบบ AI ไม่สมบูรณ์" }, { status: 500 });
        }

        const aiResponse = await fetch(apiAi, {
            method: "POST",
            body: apiFormData,
        });

        if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            console.error("FastAPI Server Error:", errorText);
            return NextResponse.json({ error: "AI Pipeline เกิดข้อผิดพลาดในการประมวลผล" }, { status: 502 });
        }

        // แกะผลลัพธ์จาก AI
        const aiResult = await aiResponse.json();
        const verifiedParameterName: string = aiResult.parameterName || dbParam.name;

        // 6. คำนวณสถานะความปลอดภัยจากเกณฑ์จริงในตาราง standards
        const currentParamName = dbParam.name.toLowerCase();

        const verifiedParam =
            verifiedParameterName.toLowerCase() === currentParamName
                ? dbParam
                : await prisma.parameter.findFirst({
                      where: { name: { equals: verifiedParameterName.trim().toLowerCase() } },
                      select: { id: true },
                  });

        const standards = verifiedParam ? await loadStandardsForParameters([verifiedParam.id]) : [];
        const evaluatedStatus = verifiedParam
            ? evaluateValueAgainstStandards(
                  aiResult.concentrated,
                  standards.map((s) => s.maxValue),
              )
            : null;

        const aiMessage = aiResult.message || aiResult.text || "";
        const boundingBox = aiResult["bounding box"] || aiResult["bounding_box"] || [];

        // 7. คืนค่าผลลัพธ์ผ่าน JSON
        return NextResponse.json({
            parameterId: dbParam.id,
            parameterName: currentParamName,
            verifiedParameterName,
            isTestTube: aiResult.is_test_tube ?? true,
            concentrated: aiResult.concentrated,
            status: evaluatedStatus,
            confidence: aiResult.confidence,
            "bounding box": boundingBox,
            message: aiMessage,
        });
    } catch (error) {
        console.error("POST /api/analyze error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการวิเคราะห์ภาพ" }, { status: 500 });
    }
}
