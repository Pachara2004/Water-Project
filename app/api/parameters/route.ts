/**
 * @file app/api/parameters/route.ts
 * @project Water Monitoring Project
 * @module API / Master Data
 * @description
 * [TH] Route Handler สำหรับดึงรายการพารามิเตอร์สารเคมีและกายภาพทั้งหมดที่ระบบรองรับ (GET)
 * ส่งข้อมูล ID, ชื่อสาร (name), หน่วยวัด (unit), คำอธิบาย (description), และสูตรทางเคมี (formula)
 * [EN] Route Handler for retrieving chemical and physical water quality parameters catalog (GET).
 * Returns parameter ID, name, measurement unit, description, and chemical formula.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-06
 * @version 1.1.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-07-06)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-11)
 *
 * @lastModified 2026-09-11
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-07-06 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Initial parameters master route
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Explicit select to prevent UTC Z leakage and optimize payload
 *
 * @database Prisma Client (MySQL)
 * @auth Public (Read-only master catalog)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * ดึงรายการพารามิเตอร์คุณภาพน้ำทั้งหมดจากฐานข้อมูล
 * Fetches all available water quality parameters and units.
 *
 * @returns {Promise<NextResponse>} รายการ Parameter ทั้งหมดในรูปแบบ JSON
 */
export async function GET() {
    try {
        // ดึงข้อมูล Parameter ทั้งหมดจาก Database
        // select ชัดเจน ไม่เอา createdAt/updatedAt — หน้าบ้านไม่ได้ใช้ และ Date ดิบจะออกไปพร้อม Z ผิดกติกาเวลาของระบบ
        const parameters = await prisma.parameter.findMany({
            select: { id: true, name: true, unit: true, description: true, formula: true },
            orderBy: {
                id: "asc", // เรียงตามลำดับการสร้าง
            },
        });

        return NextResponse.json(parameters, { status: 200 });
    } catch (error) {
        console.error("Error fetching parameters:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
