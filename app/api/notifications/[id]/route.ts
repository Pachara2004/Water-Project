import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

// ==========================================
// PATCH /api/notifications/[id]
// ==========================================
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
