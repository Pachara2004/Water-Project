import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

// ==========================================
// PATCH /api/notifications/[id] — collector กด "รับทราบ" การแจ้งเตือนถูกปฏิเสธ
// set acknowledgedAt เพื่อเคลียร์ตัวเลขบนกระดิ่ง (idempotent — กดซ้ำไม่เป็นไร)
// ==========================================
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAuth(request, ["collector", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { id } = await params;
        const requestId = Number(id);
        if (!Number.isInteger(requestId)) {
            return NextResponse.json({ error: "รหัสการแจ้งเตือนไม่ถูกต้อง" }, { status: 400 });
        }

        const existing = await prisma.reviewRequest.findUnique({ where: { id: requestId } });
        if (!existing) {
            return NextResponse.json({ error: "ไม่พบการแจ้งเตือนที่ระบุ" }, { status: 404 });
        }

        // ตรวจความเป็นเจ้าของ — ต้องมี sample ในกลุ่มนี้ที่เป็นของผู้เรียก (กันคนอื่นกดรับทราบแทน)
        const owned = await prisma.waterSample.findFirst({
            where: { sessionGroup: existing.sessionGroup, collectorId: auth.user!.id },
            select: { id: true },
        });
        if (!owned) {
            return NextResponse.json({ error: "คุณไม่มีสิทธิ์จัดการการแจ้งเตือนนี้" }, { status: 403 });
        }

        // เขียนแบบมีเงื่อนไข: อัปเดตเฉพาะคำร้องที่ถูกปฏิเสธและยังไม่รับทราบ
        // ถ้าเคยรับทราบไปแล้ว updateMany จะคืน count=0 แต่ยังถือว่าสำเร็จ (idempotent)
        await prisma.reviewRequest.updateMany({
            where: { id: requestId, statusRequest: "rejected", acknowledgedAt: null },
            data: { acknowledgedAt: new Date() },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("PATCH /api/notifications/[id] error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการอัปเดตการแจ้งเตือน" }, { status: 500 });
    }
}
