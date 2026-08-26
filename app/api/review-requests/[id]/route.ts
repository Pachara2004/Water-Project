import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { REVIEW_NOTE_MAX_LENGTH, PARTIAL_REJECT_NOTE } from "@/lib/reviewConstants";
import { generateSessionGroup } from "@/lib/sessionGroup";
import { ReviewStatus } from "@prisma/client";
import { createSampleRecordSnapshot, createSampleRawAuditLog, createNotificationEntry } from "@/lib/sampleRecord";

/**
 * แยกสารที่ไม่ได้ถูกเลือกอนุมัติออกเป็น sessionGroup ใหม่ + ปฏิเสธ (isDeleted)
 * ใช้ร่วมกันทั้งกรณี approve และ edited_approve แบบเลือกอนุมัติเฉพาะบางสาร
 */
async function splitRejectedSamples(tx: any, sessionGroup: string, approvedSampleIds: number[], reviewedById: number) {
    const rejectedSamples = await tx.waterSample.findMany({
        where: { sessionGroup, isDeleted: false, id: { notIn: approvedSampleIds } },
        select: { id: true, collectionTime: true },
    });

    if (rejectedSamples.length === 0) return;

    const newGroup = await generateSessionGroup(tx, rejectedSamples[0].collectionTime);
    await tx.waterSample.updateMany({
        where: { id: { in: rejectedSamples.map((s: { id: number }) => s.id) } },
        data: { sessionGroup: newGroup, isDeleted: true, lastModifiedBy: reviewedById },
    });
    await tx.reviewRequest.create({
        data: {
            sessionGroup: newGroup,
            statusRequest: "rejected",
            reviewedById,
            reviewedAt: new Date(),
            reviewNote: PARTIAL_REJECT_NOTE,
        },
    });
}

// ========================================================
// PATCH /api/review-requests/[id]
// body: { action: "approve" | "reject" | "edited_approve", note?: string, editedMeasurements?: any[], approvedSampleIds?: number[] }
// ========================================================
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
        const approvedSampleIds = Array.isArray(body?.approvedSampleIds) ? (body.approvedSampleIds as unknown[]).filter((x): x is number => Number.isInteger(x)) : null;
        const editedMeasurements = Array.isArray(body?.editedMeasurements) ? body.editedMeasurements : null;

        if (action !== "approve" && action !== "reject" && action !== "edited_approve") {
            return NextResponse.json({ error: "action ต้องเป็น 'approve', 'reject' หรือ 'edited_approve' เท่านั้น" }, { status: 400 });
        }

        if (action === "reject" && note.length === 0) {
            return NextResponse.json({ error: "กรุณาระบุเหตุผลในการปฏิเสธคำร้อง" }, { status: 400 });
        }

        if (action === "edited_approve" && (!editedMeasurements || editedMeasurements.length === 0)) {
            return NextResponse.json({ error: "กรุณาระบุข้อมูลที่แก้ไข" }, { status: 400 });
        }

        if (note.length > REVIEW_NOTE_MAX_LENGTH) {
            return NextResponse.json({ error: `เหตุผลต้องยาวไม่เกิน ${REVIEW_NOTE_MAX_LENGTH} ตัวอักษร` }, { status: 400 });
        }

        if ((action === "approve" || action === "edited_approve") && approvedSampleIds && approvedSampleIds.length === 0) {
            return NextResponse.json({ error: "ต้องเลือกอย่างน้อยหนึ่งสารเพื่ออนุมัติ" }, { status: 400 });
        }

        const existing = await prisma.reviewRequest.findUnique({ where: { id: requestId } });
        if (!existing) {
            return NextResponse.json({ error: "ไม่พบคำร้องที่ระบุ" }, { status: 404 });
        }

        if ((action === "approve" || action === "edited_approve") && approvedSampleIds) {
            const groupSampleIds = new Set((await prisma.waterSample.findMany({ where: { sessionGroup: existing.sessionGroup, isDeleted: false }, select: { id: true } })).map((s) => s.id));
            if (approvedSampleIds.some((id) => !groupSampleIds.has(id))) {
                return NextResponse.json({ error: "รายการสารที่เลือกไม่ตรงกับคำร้องนี้" }, { status: 400 });
            }
        }

        let nextStatus: ReviewStatus = "approved";
        if (action === "reject") nextStatus = "rejected";
        if (action === "edited_approve") nextStatus = "edited_approved";

        const outcome = await prisma.$transaction(async (tx) => {
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

            const groupSamples = await tx.waterSample.findMany({
                where: { sessionGroup: existing.sessionGroup, isDeleted: false },
                include: { collector: true, location: true, measurements: { include: { parameter: true } } }
            });

            const collectorId = groupSamples.length > 0 ? groupSamples[0].collectorId : null;
            const code = groupSamples.length > 0 ? groupSamples[0].code : null;
            const rawParamData = groupSamples.flatMap(s => s.measurements.map(m => ({ param: m.parameter.name, value: m.value })));
            const rawImageUrls = groupSamples.map(s => s.rawImageUrl).filter(Boolean);

            if (action === "reject") {
                await tx.waterSample.updateMany({
                    where: { sessionGroup: existing.sessionGroup, isDeleted: false },
                    data: { isDeleted: true, lastModifiedBy: auth.user!.id },
                });

                await createSampleRawAuditLog(tx as any, {
                    sessionGroup: existing.sessionGroup,
                    sampleParameterName: rawParamData,
                    message: note || null,
                    imageRawUrl: rawImageUrls,
                    reviewedById: auth.user!.id,
                });

                if (collectorId) {
                    await createNotificationEntry(tx as any, {
                        userId: collectorId,
                        code: existing.sessionGroup,
                        status: "rejected",
                        message: note || "ข้อมูลของคุณถูกปฏิเสธ",
                    });
                }
            } else if (action === "edited_approve") {
                await createSampleRawAuditLog(tx as any, {
                    sessionGroup: existing.sessionGroup,
                    sampleParameterName: rawParamData,
                    message: note || "แก้ไขก่อนอนุมัติ",
                    imageRawUrl: rawImageUrls,
                    reviewedById: auth.user!.id,
                });

                // sample ที่ไม่ถูกเลือกอนุมัติ (ถ้ามี) จะถูกแยกไปปฏิเสธเหมือนปุ่มอนุมัติ — ไม่แตะค่า/ไม่ snapshot
                const approvedSampleIdSet = approvedSampleIds ? new Set(approvedSampleIds) : null;
                const approvedSampleDbIds = approvedSampleIdSet ? groupSamples.filter((s) => approvedSampleIdSet.has(s.id)).map((s) => s.id) : groupSamples.map((s) => s.id);

                if (editedMeasurements) {
                    for (const m of editedMeasurements) {
                        if (m.id) {
                            await tx.waterSampleMeasurement.update({
                                where: { id: m.id },
                                data: { value: Number(m.value) } // Not used currently from UI but kept for compatibility
                            });
                        } else if (m.originalParameterId) {
                            await tx.waterSampleMeasurement.updateMany({
                                where: { parameterId: m.originalParameterId, sampleId: { in: approvedSampleDbIds } },
                                data: { 
                                    parameterId: m.parameterId ? Number(m.parameterId) : m.originalParameterId,
                                    value: Number(m.value),
                                    message: null // Clear the message when admin edits and approves
                                }
                            });
                        } else {
                            await tx.waterSampleMeasurement.updateMany({
                                where: { parameterId: m.parameterId, sampleId: { in: approvedSampleDbIds } },
                                data: { 
                                    value: Number(m.value),
                                    message: null
                                }
                            });
                        }
                    }
                }

                await tx.waterSample.updateMany({
                    where: { id: { in: approvedSampleDbIds } },
                    data: { lastModifiedBy: auth.user!.id }
                });

                if (approvedSampleIdSet) {
                    await splitRejectedSamples(tx, existing.sessionGroup, approvedSampleIds!, auth.user!.id);
                }

                const updatedGroupSamples = await tx.waterSample.findMany({
                    where: { id: { in: approvedSampleDbIds }, isDeleted: false },
                    include: { collector: true, location: true, measurements: { include: { parameter: true } } }
                });

                await createSampleRecordSnapshot(tx as any, updatedGroupSamples, auth.user!.id);

                if (collectorId) {
                    await createNotificationEntry(tx as any, {
                        userId: collectorId,
                        code: existing.sessionGroup,
                        status: "edited_approved",
                        message: note || "ข้อมูลได้รับการแก้ไขและอนุมัติแล้ว",
                        reviewBy: auth.user!.id,
                    });
                }
            } else if (action === "approve") {
                let finalSamplesToSnapshot = groupSamples;

                if (approvedSampleIds) {
                    await splitRejectedSamples(tx, existing.sessionGroup, approvedSampleIds, auth.user!.id);
                    finalSamplesToSnapshot = groupSamples.filter(s => approvedSampleIds.includes(s.id));
                }

                await createSampleRecordSnapshot(tx as any, finalSamplesToSnapshot, auth.user!.id);

                if (collectorId) {
                    await createNotificationEntry(tx as any, {
                        userId: collectorId,
                        code: existing.sessionGroup,
                        status: "approved",
                        message: "ข้อมูลคุณภาพน้ำได้รับการอนุมัติ",
                        reviewBy: auth.user!.id,
                    });
                }
            }

            return { count: 1 };
        });

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
