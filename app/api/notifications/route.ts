import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

// ==========================================
// GET /api/notifications
// ==========================================
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
                createdAt: n.createdAt,
                collectionTime: s?.collectionTime ?? null,
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
