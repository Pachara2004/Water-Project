import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { ReviewStatus } from "@prisma/client";

// ========================================================
// PATCH /api/review-requests/[id] — admin ยืนยัน/ปฏิเสธคำร้อง confidence ต่ำ
// body: { action: "approve" | "reject", note?: string }
// กรณีสารซ้ำถูกจัดการที่ฝั่งผู้ส่งตั้งแต่ตอน submit แล้ว (เลือกภาพเดียวต่อสาร) จึงไม่มาถึง admin อีก
// ========================================================
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // เฉพาะ admin เท่านั้นที่ตัดสินคำร้องได้
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { id } = await params;
        const requestId = Number(id);
        if (!Number.isInteger(requestId)) {
            return NextResponse.json({ error: "รหัสคำร้องไม่ถูกต้อง" }, { status: 400 });
        }

        const body = await request.json();
        const action = body?.action as string | undefined;
        const note = typeof body?.note === "string" ? body.note.trim() : "";

        // 1. ตรวจ action ให้อยู่ในขอบเขตที่รับได้
        if (action !== "approve" && action !== "reject") {
            return NextResponse.json({ error: "action ต้องเป็น 'approve' หรือ 'reject' เท่านั้น" }, { status: 400 });
        }

        // 2. ปฏิเสธต้องมีเหตุผลเสมอ — reject ลอยๆ ไม่อนุญาต
        if (action === "reject" && note.length === 0) {
            return NextResponse.json({ error: "กรุณาระบุเหตุผลในการปฏิเสธคำร้อง" }, { status: 400 });
        }

        const existing = await prisma.reviewRequest.findUnique({ where: { id: requestId } });
        if (!existing) {
            return NextResponse.json({ error: "ไม่พบคำร้องที่ระบุ" }, { status: 404 });
        }

        const nextStatus: ReviewStatus = action === "approve" ? "approved" : "rejected";

        const outcome = await prisma.$transaction(async (tx) => {
            // 3. อัปเดตแบบมีเงื่อนไข (conditional) — เขียนได้เฉพาะคำร้องที่ยัง pending อยู่เท่านั้น
            //    updateMany + where:{statusRequest:pending} = กันเคส admin 2 คนกดพร้อมกัน และกันการตัดสินซ้ำคำร้องที่ปิดไปแล้ว แบบ atomic
            const updated = await tx.reviewRequest.updateMany({
                where: { id: requestId, statusRequest: "pending" },
                data: {
                    statusRequest: nextStatus,
                    reviewedById: auth.user!.id,
                    reviewedAt: new Date(),
                    reviewNote: note || null,
                },
            });

            if (updated.count === 0) {
                return { count: 0 };
            }

            // 4. reject → soft-delete ทุกแถว WaterSample ในกลุ่ม session นี้
            //    approve ไม่ต้องแตะ WaterSample — แถวยัง isDeleted:false อยู่แล้ว พอคำร้องไม่ pending ก็โผล่เอง
            if (action === "reject") {
                await tx.waterSample.updateMany({
                    where: { sessionGroup: existing.sessionGroup, isDeleted: false },
                    data: { isDeleted: true, lastModifiedBy: auth.user!.id },
                });
            }

            return { count: 1 };
        });

        // 5. count === 0 = คำร้องถูกตัดสินไปแล้วระหว่างทาง (race) หรือมีคนกดซ้ำ
        if (outcome.count === 0) {
            return NextResponse.json({ error: "คำร้องนี้ถูกตัดสินไปแล้ว ไม่สามารถแก้ไขซ้ำได้" }, { status: 409 });
        }

        const result = await prisma.reviewRequest.findUnique({ where: { id: requestId } });
        return NextResponse.json(result);
    } catch (error) {
        console.error("PATCH /api/review-requests/[id] error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการตัดสินคำร้อง" }, { status: 500 });
    }
}
