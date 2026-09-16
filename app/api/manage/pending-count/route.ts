/**
 * @file app/api/manage/pending-count/route.ts
 * @project Water Monitoring Project
 * @module API / Management & Approvals
 * @description
 * [TH] Route Handler คำนวณจำนวนคำร้องค้างทั้งหมดที่รอการตัดสินใจจาก Admin (GET)
 * รวมผลนับ 2 คิวงานหลัก: คำร้องตรวจสอบความมั่นใจต่ำ (ReviewRequest) + คำร้องขอเปลี่ยนสิทธิ์ผู้ใช้ (RoleRequest)
 * ใช้สำหรับแสดงจุดแจ้งเตือนสีแดง (Badge Indicator) บน Navbar เมนู "จัดการข้อมูล"
 * [EN] Route Handler for calculating total pending approval counts requiring admin action (GET).
 * Aggregates two queues: low-confidence sample review requests (ReviewRequest) and user role requests (RoleRequest).
 * Feeds badge indicators on the navigation bar under the "Management" menu.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-15
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-15)
 *
 * @lastModified 2026-07-15
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-07-15 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Initial pending count endpoint for badge notification
 *
 * @database Prisma Client (MySQL)
 * @auth Role-based: admin only
 * @see components/Navbar.tsx
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

/**
 * ดึงจำนวนคำร้องค้างการตัดสินใจทั้งหมดของระบบ
 * Retrieves aggregated count of pending review requests and role elevation requests.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม Admin token
 * @returns {Promise<NextResponse>} สรุปจำนวน { reviewPendingCount, rolePendingCount, pendingCount }
 */
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const [reviewPendingCount, rolePendingCount] = await Promise.all([
            prisma.reviewRequest.count({ where: { statusRequest: "pending" } }),
            prisma.roleRequest.count({ where: { status: "pending" } }),
        ]);

        // แยกให้แต่ละเมนูในหน้า /manage รู้จำนวนคิวของตัวเอง + รวมไว้ให้ Navbar ใช้ตัดสินใจแสดงจุดเดียว
        return NextResponse.json({
            reviewPendingCount,
            rolePendingCount,
            pendingCount: reviewPendingCount + rolePendingCount,
        });
    } catch (error) {
        console.error("GET /api/manage/pending-count error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงจำนวนคำร้องค้าง" }, { status: 500 });
    }
}
