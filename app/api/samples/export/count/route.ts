/**
 * @fileoverview
 * [TH] Route Handler สำหรับคำนวณและนับจำนวนแถวข้อมูลตัวอย่างน้ำล่วงหน้า (Pre-flight Export Count)
 * ก่อนที่เจ้าหน้าที่หรือผู้ดูแลระบบจะกดยืนยันดาวน์โหลดไฟล์จริง รองรับการคำนวณจำนวนแถวทั้ง 2 ขอบเขต
 * ได้แก่ ขอบเขตที่ตรงตามตัวกรองปัจจุบัน (filtered) และขอบเขตข้อมูลทั้งหมดตามสิทธิ์ (all)
 * โดยใช้เงื่อนไขตัวกรองเดียวกับ API ส่งออกจริง (ผ่าน lib/sampleFilters) เพื่อความถูกต้องแม่นยำ
 *
 * [EN] Route Handler for calculating pre-flight export row counts of water samples before
 * officers or administrators initiate actual file download. Supports counting for both scopes:
 * active filter criteria (`filtered`) and full permitted dataset (`all`), utilizing identical
 * filter logic from `lib/sampleFilters` to ensure exact consistency with export endpoints.
 *
 * @module API / Reports & Exports
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-31
 * @modified 2026-07-31
 * @version 1.0.0
 * @license Proprietary
 *
 * @see {@link /lib/sampleFilters.ts} Helper สำหรับอ่านตัวกรองและสร้าง Prisma Where Clause
 * @see {@link /lib/review.ts} ฟังก์ชันตรวจสอบและดึงรายการ Session กลุ่มตัวอย่างที่รอตรวจทาน
 * @see {@link /lib/auth-guard.ts} ระบบตรวจสอบสิทธิ์ผ่าน LINE Session Token
 *
 * @history
 * - 2026-07-31 | Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) | สร้าง API คำนวณจำนวนแถวสำหรับ export preview
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { buildAllScopeWhere, buildSampleWhere, describeScope, readSampleFilters } from "@/lib/sampleFilters";
import { getPendingSessionGroups } from "@/lib/review";

export const dynamic = "force-dynamic";

/**
 * [TH] ดึงข้อมูลสถิติจำนวนแถวตัวอย่างน้ำสำหรับเตรียมส่งออก (Export Pre-flight Count)
 * ตรวจสอบสิทธิ์เฉพาะผู้ใช้กลุ่ม officer และ admin จากนั้นคำนวณจำนวนแถวที่เข้าเงื่อนไขตามตัวกรอง
 * และจำนวนแถวทั้งหมดตามสิทธิ์ พร้อมทั้งจัดเตรียมข้อความป้ายกำกับ (Label) สำหรับแสดงผลบน UI
 *
 * ต้องใช้ where ชุดเดียวกับ route ส่งออกจริง (ผ่าน lib/sampleFilters) ไม่งั้นตัวเลขที่โชว์จะหลอกผู้ใช้
 * สิทธิ์ต้องตรงกับ /api/samples/export และ /export-csv เพราะจำนวนแถวก็คือข้อมูลรูปแบบหนึ่ง
 *
 * [EN] Retrieves water sample row count statistics for pre-flight export validation.
 * Authenticates users with officer or admin roles, evaluates criteria for both filtered
 * and global dataset scopes, and formats descriptive UI labels for export dialogs.
 * Uses exact identical where filters as live export routes to ensure absolute count fidelity.
 *
 * @async
 * @function GET
 * @param {NextRequest} request - Next.js Request object ที่มี Query Parameters สำหรับการกรอง
 * @returns {Promise<NextResponse<{ filtered: number, all: number, filteredLabel: string } | { error: string }>>}
 * JSON Response ประกอบด้วยจำนวนแถวทั้งสองขอบเขตและข้อความกำกับ หรือข้อความแจ้งข้อผิดพลาด
 *
 * @auth officer, admin
 * @database Prisma Client (MySQL) - ตรวจนับจำนวนแถวในโมเดล `WaterSample` และค้นหาชื่อสถานีใน `Location`
 *
 * @example
 * // Request: GET /api/samples/export/count?startDate=2026-01-01&endDate=2026-06-30&locationId=3
 * // Response (200 OK):
 * // {
 * //   "filtered": 142,
 * //   "all": 1850,
 * //   "filteredLabel": "1 ม.ค. 2026 - 30 มิ.ย. 2026 · คลองเตย"
 * // }
 */
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request, ["officer", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const filters = readSampleFilters(request, auth.user!);
        const pendingGroups = await getPendingSessionGroups();

        const [filteredWhere, allWhere] = await Promise.all([buildSampleWhere(filters, { pendingGroups }), buildAllScopeWhere(filters, pendingGroups)]);

        const [filtered, all, station] = await Promise.all([
            prisma.waterSample.count({ where: filteredWhere }),
            prisma.waterSample.count({ where: allWhere }),
            filters.locationId ? prisma.location.findUnique({ where: { id: filters.locationId }, select: { stationName: true } }) : Promise.resolve(null),
        ]);

        const { rangeLabel, targetLabel } = describeScope(filters, "filtered", station?.stationName ?? null);

        return NextResponse.json({
            filtered,
            all,
            filteredLabel: `${rangeLabel} · ${targetLabel}`,
        });
    } catch (error) {
        console.error("Export Count API Error:", error);
        return NextResponse.json({ error: "ไม่สามารถนับจำนวนข้อมูลที่จะส่งออกได้" }, { status: 500 });
    }
}
