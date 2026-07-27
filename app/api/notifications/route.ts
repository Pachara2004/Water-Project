import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { getRejectedReviewsForCollector } from "@/lib/review";

// ==========================================
// GET /api/notifications — กระดิ่งแจ้งเตือนของ collector
// คืนรายการผลตรวจของตัวเองที่ถูก admin ปฏิเสธ พร้อมเหตุผล + จำนวนที่ยังไม่อ่าน
// ==========================================
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request, ["collector", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const collectorId = auth.user!.id;

        const reviews = await getRejectedReviewsForCollector(collectorId);
        if (reviews.length === 0) {
            return NextResponse.json({ items: [], unreadCount: 0 });
        }

        const groups = reviews.map((r) => r.sessionGroup);

        // ดึง sample (รวมที่ถูก soft-delete) ของกลุ่มที่ถูกปฏิเสธ เพื่อเอาชื่อสถานี/เวลา/รูปมาแสดงในป็อปอัป
        // scope ด้วย collectorId อีกชั้นกันข้อมูลของคนอื่นหลุด
        const samples = await prisma.waterSample.findMany({
            where: { sessionGroup: { in: groups }, collectorId },
            select: {
                code: true,
                sessionGroup: true,
                collectionTime: true,
                rawImageUrl: true,
                location: { select: { id: true, stationName: true, governingAgency: true } },
            },
            orderBy: { collectionTime: "desc" },
        });

        // sample แรกของแต่ละกลุ่มพอสำหรับ metadata (ทั้งกลุ่มใช้สถานที่/เวลาเดียวกัน)
        const firstByGroup = new Map<string, (typeof samples)[number]>();
        for (const s of samples) {
            if (s.sessionGroup && !firstByGroup.has(s.sessionGroup)) {
                firstByGroup.set(s.sessionGroup, s);
            }
        }

        const items = reviews.map((r) => {
            const s = firstByGroup.get(r.sessionGroup);
            return {
                id: r.id,
                sessionGroup: r.sessionGroup,
                code: s?.code ?? null,
                reviewNote: r.reviewNote,
                reviewedAt: r.reviewedAt,
                acknowledgedAt: r.acknowledgedAt,
                collectionTime: s?.collectionTime ?? null,
                rawImageUrl: s?.rawImageUrl ?? null,
                location: s?.location ? { id: s.location.id, name: s.location.stationName, organization: s.location.governingAgency } : null,
            };
        });

        const unreadCount = items.filter((i) => i.acknowledgedAt === null).length;

        return NextResponse.json({ items, unreadCount });
    } catch (error) {
        console.error("GET /api/notifications error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงการแจ้งเตือน" }, { status: 500 });
    }
}
