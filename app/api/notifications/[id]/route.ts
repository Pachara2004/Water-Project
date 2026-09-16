/**
 * @file app/api/notifications/[id]/route.ts
 * @project Water Monitoring Project
 * @module API / Notifications
 * @description
 * [TH] Route Handler สำหรับอัปเดตสถานะการเปิดอ่านของการแจ้งเตือนรายรายการ (PATCH)
 * ตรวจสอบสิทธิ์ความเป็นเจ้าของการแจ้งเตือน (เฉพาะเจ้าของแจ้งเตือนเท่านั้นที่แก้ไขได้)
 * และปรับปรุงฟิลด์ `isReading = true`
 * [EN] Route Handler for marking a specific notification as read (PATCH).
 * Verifies notification ownership (ensuring users can only modify their own notifications)
 * and updates `isReading = true`.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-15
 * @version 1.1.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-15)
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-08-21)
 *
 * @lastModified 2026-08-21
 * @lastModifiedBy Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 *
 * @changelog
 * - 2026-07-15 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Initial mark-as-read notification handler
 * - 2026-08-21 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Strict user ID ownership check
 *
 * @database Prisma Client (MySQL)
 * @auth Role-based: collector, admin
 * @security IDOR prevention via explicit userId comparison
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

/**
 * ทำเครื่องหมายการแจ้งเตือนว่าเปิดอ่านแล้ว (isReading = true)
 * Marks an individual notification as read.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม Bearer Token
 * @param {object} context - Route context params พร้อม `id` ของการแจ้งเตือน
 * @returns {Promise<NextResponse>} ผลการอัปเดต { ok: true }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAuth(request, ["collector", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { id } = await params;
        const notificationId = Number(id);
        if (!Number.isInteger(notificationId)) {
            return NextResponse.json({ error: "รหัสการแจ้งเตือนไม่ถูกต้อง" }, { status: 400 });
        }

        const existing = await prisma.notification.findUnique({ where: { id: notificationId } });
        if (!existing) {
            return NextResponse.json({ error: "ไม่พบการแจ้งเตือนที่ระบุ" }, { status: 404 });
        }

        if (existing.userId !== auth.user!.id) {
            return NextResponse.json({ error: "คุณไม่มีสิทธิ์จัดการการแจ้งเตือนนี้" }, { status: 403 });
        }

        await prisma.notification.updateMany({
            where: { id: notificationId, isReading: false },
            data: { isReading: true },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("PATCH /api/notifications/[id] error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการอัปเดตการแจ้งเตือน" }, { status: 500 });
    }
}
