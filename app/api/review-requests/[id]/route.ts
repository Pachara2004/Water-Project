import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { ReviewStatus } from "@prisma/client";

// ========================================================
// PATCH /api/review-requests/[id] — admin ยืนยัน/ปฏิเสธคำร้อง confidence ต่ำ / สารซ้ำ
// body: { action: "approve" | "reject", note?: string, keepSampleIds?: number[] }
// keepSampleIds ใช้เฉพาะตอน approve session ที่มีสารซ้ำ (≥2 WaterSample ชี้ parameterId เดียวกัน)
// ต้องระบุ "ตัวที่จะเก็บ" ให้ครบ 1 ตัวต่อกลุ่มที่ชนกัน ตัวที่เหลือในกลุ่มจะถูก soft-delete ทิ้ง
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
        const keepSampleIds: number[] = Array.isArray(body?.keepSampleIds) ? body.keepSampleIds.map(Number).filter(Number.isInteger) : [];

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

        // 2.1 approve เท่านั้น: ตรวจก่อนเปิด transaction ว่ามีสารซ้ำในชุดนี้ไหม (≥2 WaterSample ชี้ parameterId เดียวกัน)
        //     ถ้ามี ต้องได้รับ keepSampleIds ที่เลือก "ตัวเก็บ" ครบ 1 ตัวต่อกลุ่ม ไม่งั้นปฏิเสธคำขอ (กันภาพซ้ำหลุดขึ้นแผนที่ทั้งคู่)
        let loserSampleIds: number[] = [];
        if (action === "approve") {
            const samples = await prisma.waterSample.findMany({
                where: { sessionGroup: existing.sessionGroup, isDeleted: false },
                select: { id: true, measurements: { select: { parameterId: true }, take: 1 } },
            });
            const groups = new Map<number, number[]>();
            samples.forEach((s) => {
                const pid = s.measurements[0]?.parameterId;
                if (pid === undefined) return;
                const arr = groups.get(pid) ?? [];
                arr.push(s.id);
                groups.set(pid, arr);
            });
            const duplicateGroups = Array.from(groups.values()).filter((ids) => ids.length > 1);

            for (const ids of duplicateGroups) {
                const kept = ids.filter((sid) => keepSampleIds.includes(sid));
                if (kept.length !== 1) {
                    return NextResponse.json({ error: "พบสารซ้ำในชุดนี้ กรุณาเลือกภาพหลักให้ครบทุกสารก่อนอนุมัติ" }, { status: 400 });
                }
                loserSampleIds.push(...ids.filter((sid) => sid !== kept[0]));
            }
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
            if (action === "reject") {
                await tx.waterSample.updateMany({
                    where: { sessionGroup: existing.sessionGroup, isDeleted: false },
                    data: { isDeleted: true, lastModifiedBy: auth.user!.id },
                });
            } else if (loserSampleIds.length > 0) {
                // approve ที่มีสารซ้ำ: soft-delete เฉพาะภาพที่ "แพ้" (ไม่ถูกเลือกเป็นหลัก) ตัวที่เหลือปล่อยผ่านตามปกติ
                await tx.waterSample.updateMany({
                    where: { id: { in: loserSampleIds } },
                    data: { isDeleted: true, lastModifiedBy: auth.user!.id },
                });
            }
            // approve ที่ไม่มีสารซ้ำ ไม่ต้องแตะ WaterSample — แถวยัง isDeleted:false อยู่แล้ว พอคำร้องไม่ pending ก็โผล่เอง

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
