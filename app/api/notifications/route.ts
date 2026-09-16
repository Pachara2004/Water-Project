/**
 * @file app/api/notifications/route.ts
 * @project Water Monitoring Project
 * @module API / Notifications
 * @description
 * [TH] Route Handler สำหรับดึงรายการแจ้งเตือนของผู้ใช้ปัจจุบัน (GET)
 * ดึงการแจ้งเตือนล่าสุด 50 รายการ พร้อมเชื่อมโยงข้อมูลสถานี, เวลาเก็บตัวอย่าง, และภาพถ่ายจาก `WaterSample`
 * รวมถึงคำนวณจำนวนการแจ้งเตือนที่ยังไม่ได้เปิดอ่าน (`unreadCount`)
 * [EN] Route Handler for retrieving notifications for the current authenticated user (GET).
 * Fetches recent 50 notifications, merges related sample location, time, and image data,
 * and calculates the unread notification count (`unreadCount`).
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-15
 * @version 1.1.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-15)
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-08-21)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-11)
 *
 * @lastModified 2026-09-11
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-07-15 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Initial notification system
 * - 2026-08-21 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Attach station and thumbnail image to notification items
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Optimize batch lookups and Thai time formatting
 *
 * @database Prisma Client (MySQL)
 * @auth Role-based: collector, admin
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { toApiString } from "@/lib/thaiTime";

/**
 * ดึงรายการแจ้งเตือนทั้งหมดของผู้ใช้พร้อมจำนวนรายการที่ยังไม่ได้อ่าน
 * Retrieves user notifications list and unread count.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม Bearer Token
 * @returns {Promise<NextResponse>} รายการการแจ้งเตือน { items, unreadCount }
 */
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request, ["collector", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const userId = auth.user!.id;

        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 50, // Limit to recent 50
        });

        if (notifications.length === 0) {
            return NextResponse.json({ items: [], unreadCount: 0 });
        }

        const codes = Array.from(new Set(notifications.map((n) => n.code).filter(Boolean))) as string[];

        // Fetch location and collectionTime from WaterSample based on code
        // We just need one sample per code to get the location and time.
        const samples = await prisma.waterSample.findMany({
            where: { sessionGroup: { in: codes }, collectorId: userId },
            select: {
                sessionGroup: true,
                collectionTime: true,
                rawImageUrl: true,
                location: { select: { id: true, stationName: true, governingAgency: true } },
            },
        });

        const sampleByCode = new Map<string, typeof samples[number]>();
        for (const s of samples) {
            if (s.sessionGroup && !sampleByCode.has(s.sessionGroup)) {
                sampleByCode.set(s.sessionGroup, s);
            }
        }

        const items = notifications.map((n) => {
            const s = n.code ? sampleByCode.get(n.code) : null;
            return {
                id: n.id,
                code: n.code,
                status: n.status,
                message: n.message,
                isReading: n.isReading,
                createdAt: toApiString(n.createdAt),
                collectionTime: toApiString(s?.collectionTime),
                rawImageUrl: s?.rawImageUrl ?? null,
                location: s?.location ? { id: s.location.id, name: s.location.stationName, organization: s.location.governingAgency } : null,
            };
        });

        const unreadCount = items.filter((i) => !i.isReading).length;

        return NextResponse.json({ items, unreadCount });
    } catch (error) {
        console.error("GET /api/notifications error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงการแจ้งเตือน" }, { status: 500 });
    }
}
