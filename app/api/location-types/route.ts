/**
 * @file app/api/location-types/route.ts
 * @project Water Monitoring Project
 * @module API / Master Data
 * @description
 * [TH] Route Handler สำหรับดึงรายการประเภทการใช้ประโยชน์ของแหล่งน้ำ (Location Types) ทั้งหมด (GET)
 * ให้บริการข้อมูลสาธารณะ (Public Data) สำหรับแสดงป้ายโซนบนแผนที่ GIS พร้อมแนบเกณฑ์มาตรฐาน (Standards)
 * ของแต่ละประเภท เพื่อให้ Client Component นำไปสร้างตารางเปรียบเทียบเกณฑ์ได้
 * [EN] Route Handler for retrieving all water body utilization types (Location Types) and associated standards (GET).
 * Public endpoint serving GIS map zone badges and standard threshold levels for client-side comparison.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-17
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-17)
 *
 * @lastModified 2026-07-17
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-07-17 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Initial location types and standards endpoint
 *
 * @database Prisma Client (MySQL)
 * @auth Public (Read-only without authentication)
 * @see prisma/schema.prisma (LocationType, Standard)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * ดึงรายการประเภทการใช้ประโยชน์ของแหล่งน้ำทั้งหมดพร้อมเกณฑ์มาตรฐานที่เกี่ยวข้อง
 * Fetches all location types with their linked parameter standards.
 *
 * @returns {Promise<NextResponse>} รายการ LocationType ในรูปแบบ JSON
 */
export async function GET() {
    try {
        // แนบเกณฑ์ของแต่ละประเภทมาด้วย — หน้าบ้านต้องใช้ทำตารางเปรียบเทียบ
        // และเป็นทางเดียวที่ client component จะได้เกณฑ์ เพราะ query DB เองไม่ได้
        const types = await prisma.locationType.findMany({
            select: {
                id: true,
                code: true,
                labelTh: true,
                standards: {
                    select: { parameterId: true, maxValue: true },
                },
            },
            orderBy: { id: "asc" },
        });

        return NextResponse.json(types);
    } catch (error) {
        console.error("GET /api/location-types error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลประเภทการใช้ประโยชน์" }, { status: 500 });
    }
}
