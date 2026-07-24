import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { REVIEW_NOTE_MAX_LENGTH, PARTIAL_REJECT_NOTE } from "@/lib/reviewConstants";
import { generateSessionGroup } from "@/lib/sessionGroup";
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
        // approvedSampleIds: อนุมัติเฉพาะบางสาร (partial) | ไม่ส่ง = อนุมัติทั้งกลุ่มตามเดิม
        const approvedSampleIds = Array.isArray(body?.approvedSampleIds) ? (body.approvedSampleIds as unknown[]).filter((x): x is number => Number.isInteger(x)) : null;

        // 1. ตรวจ action ให้อยู่ในขอบเขตที่รับได้
        if (action !== "approve" && action !== "reject") {
            return NextResponse.json({ error: "action ต้องเป็น 'approve' หรือ 'reject' เท่านั้น" }, { status: 400 });
        }

        // 2. ปฏิเสธต้องมีเหตุผลเสมอ — reject ลอยๆ ไม่อนุญาต
        if (action === "reject" && note.length === 0) {
            return NextResponse.json({ error: "กรุณาระบุเหตุผลในการปฏิเสธคำร้อง" }, { status: 400 });
        }

        // 2.1 จำกัดความยาวเหตุผล — บังคับซ้ำที่ server (client กันได้แค่ UX) กัน DB โดนยัดข้อความยาวเกิน
        if (note.length > REVIEW_NOTE_MAX_LENGTH) {
            return NextResponse.json({ error: `เหตุผลต้องยาวไม่เกิน ${REVIEW_NOTE_MAX_LENGTH} ตัวอักษร` }, { status: 400 });
        }

        // 3. อนุมัติแบบเลือกบางสาร: ต้องมีอย่างน้อย 1 สาร (ไม่เลือกเลย = ให้ไปใช้ปุ่มปฏิเสธแทน)
        if (action === "approve" && approvedSampleIds && approvedSampleIds.length === 0) {
            return NextResponse.json({ error: "ต้องเลือกอย่างน้อยหนึ่งสารเพื่ออนุมัติ" }, { status: 400 });
        }

        const existing = await prisma.reviewRequest.findUnique({ where: { id: requestId } });
        if (!existing) {
            return NextResponse.json({ error: "ไม่พบคำร้องที่ระบุ" }, { status: 404 });
        }

        // 4. ตรวจว่า sample ที่เลือกอนุมัติเป็นของกลุ่มนี้จริงทั้งหมด กัน id หลุดข้ามกลุ่ม
        if (action === "approve" && approvedSampleIds) {
            const groupSampleIds = new Set((await prisma.waterSample.findMany({ where: { sessionGroup: existing.sessionGroup, isDeleted: false }, select: { id: true } })).map((s) => s.id));
            if (approvedSampleIds.some((id) => !groupSampleIds.has(id))) {
                return NextResponse.json({ error: "รายการสารที่เลือกไม่ตรงกับคำร้องนี้" }, { status: 400 });
            }
        }

        const nextStatus: ReviewStatus = action === "approve" ? "approved" : "rejected";

        const outcome = await prisma.$transaction(async (tx) => {
            // 5. อัปเดตแบบมีเงื่อนไข (conditional) — เขียนได้เฉพาะคำร้องที่ยัง pending อยู่เท่านั้น
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

            // 6. reject → soft-delete ทุกแถว WaterSample ในกลุ่ม session นี้
            //    approve ปกติไม่ต้องแตะ WaterSample — แถวยัง isDeleted:false อยู่แล้ว พอคำร้องไม่ pending ก็โผล่เอง
            if (action === "reject") {
                await tx.waterSample.updateMany({
                    where: { sessionGroup: existing.sessionGroup, isDeleted: false },
                    data: { isDeleted: true, lastModifiedBy: auth.user!.id },
                });
            } else if (approvedSampleIds) {
                // approve แบบเลือกบางสาร → แยกสารที่ "ไม่ถูกเลือก" ออกไปเป็นคำร้อง rejected แยกกลุ่มใหม่
                //    เพราะสถานะรีวิวอยู่ที่ระดับคำร้อง (1 sessionGroup = 1 สถานะ) การปฏิเสธบางสารในคำร้องที่ approved
                //    จะทำให้สารนั้นหายไปจากทุกแท็บ จึงย้ายไป sessionGroup ใหม่ + สร้าง ReviewRequest rejected ให้มันโผล่ในแท็บปฏิเสธ
                const rejectedSamples = await tx.waterSample.findMany({
                    where: { sessionGroup: existing.sessionGroup, isDeleted: false, id: { notIn: approvedSampleIds } },
                    select: { id: true, collectionTime: true },
                });

                if (rejectedSamples.length > 0) {
                    const newGroup = await generateSessionGroup(tx, rejectedSamples[0].collectionTime);
                    await tx.waterSample.updateMany({
                        where: { id: { in: rejectedSamples.map((s) => s.id) } },
                        data: { sessionGroup: newGroup, isDeleted: true, lastModifiedBy: auth.user!.id },
                    });
                    await tx.reviewRequest.create({
                        data: {
                            sessionGroup: newGroup,
                            statusRequest: "rejected",
                            reviewedById: auth.user!.id,
                            reviewedAt: new Date(),
                            reviewNote: PARTIAL_REJECT_NOTE,
                        },
                    });
                }
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
