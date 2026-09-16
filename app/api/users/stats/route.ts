/**
 * @file app/api/users/stats/route.ts
 * @project Water Monitoring Project
 * @module API / User Management
 * @description
 * [TH] Route Handler คำนวณยอดสรุปสถิติผู้ใช้งานทั้งหมดสำหรับ Admin (GET)
 * คำนวณผ่านการ Aggregate ด้วย `prisma.user.count()` โดยตรง (ยอดรวมผู้ใช้, สมาชิกเจ้าหน้าที่, คำร้องขอสิทธิ์ค้างอนุมัติ)
 * แยกออกจาก `GET /api/users` เพื่อประสิทธิภาพ ไม่ขึ้นกับคำค้นหาหรือการแบ่งหน้า
 * [EN] Route Handler for summarizing user metrics for Admin view (GET).
 * Computes direct database counts for total users, active staff members, and pending role elevation requests.
 * Isolated from `GET /api/users` pagination/search filters for optimal performance.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-06
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-06)
 *
 * @lastModified 2026-07-06
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-07-06 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Initial user count metrics endpoint
 *
 * @database Prisma Client (MySQL)
 * @auth Role-based: admin only
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

/**
 * คำนวณและสรุปยอดจำนวนผู้ใช้งานทั้งหมดในระบบแยกตามสถานะ
 * Summarizes total, staff, and pending role request counts.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม Admin token
 * @returns {Promise<NextResponse>} สรุปสถิติ { total, staff, pending }
 */
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const [total, staff, pending] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { systemRole: { roleName: { not: "guest" } } } }),
            prisma.user.count({ where: { roleRequests: { some: { status: "pending" } } } }),
        ]);

        return NextResponse.json({ total, staff, pending });
    } catch (error) {
        console.error("GET /api/users/stats error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลสรุปยอดผู้ใช้งาน" }, { status: 500 });
    }
}
