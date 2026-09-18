/**
 * @file app/api/review-requests/[id]/route.ts
 * @project Water Monitoring Project
 * @module API / Quality Review & Auditing
 * @description
 * [TH] Route Handler สำหรับการตัดสินใจคำร้องตรวจสอบคุณภาพน้ำรายรายการ (PATCH)
 * รองรับ 3 แอ็กชันหลักโดยผู้ดูแลระบบ (Admin):
 * 1. `approve`: อนุมัติผลตรวจตามค่าเดิม (ไม่อนุญาตหากมีข้อความ [NO_TEST_TUBE] จาก AI) และสร้าง Snapshot ลงตาราง `SampleRecord`
 * 2. `reject`: ปฏิเสธคำร้องพร้อมระบุเหตุผล บันทึก Audit Log และแจ้งเตือนไปยังผู้เก็บตัวอย่าง
 * 3. `edited_approve`: แก้ไขค่าผลการวัดสารก่อนอนุมัติ คำนวณสถานะคุณภาพน้ำใหม่ตามเกณฑ์มาตรฐาน และสร้าง Snapshot
 * รองรับการอนุมัติเฉพาะบางสารในกลุ่ม (Partial Approval) โดยแยกสารที่ถูกปฏิเสธไปยัง `sessionGroup` ใหม่โดยอัตโนมัติ
 * [EN] Route Handler for reviewing and acting on individual water sample review requests (PATCH).
 * Supports three primary actions by Administrators:
 * 1. `approve`: Approves results as-is and creates snapshot in `SampleRecord` (blocked if AI detected [NO_TEST_TUBE]).
 * 2. `reject`: Rejects the request with required note, writes audit log, and notifies the collector.
 * 3. `edited_approve`: Edits measurement values prior to approval, re-evaluates water status, and snapshots records.
 * Supports partial sample approvals by splitting rejected items into a new isolated `sessionGroup`.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-13
 * @version 1.3.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-13)
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-07-14)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-08-20)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-11)
 *
 * @lastModified 2026-09-11
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-07-13 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Initial review decision endpoint
 * - 2026-07-14 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Support edited_approve and partial rejection
 * - 2026-08-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Block approval on [NO_TEST_TUBE] detection
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Idempotent transaction handling and Thai time formatting
 *
 * @database Prisma Client (MySQL)
 * @auth Role-based: admin only
 * @security Transaction isolation, atomic audit logging & snapshot generation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { REVIEW_NOTE_MAX_LENGTH, PARTIAL_REJECT_NOTE } from "@/lib/reviewConstants";
import { generateSessionGroup } from "@/lib/sessionGroup";
import { nowThai, toApiString } from "@/lib/thaiTime";
import { ReviewStatus, WaterStatus } from "@prisma/client";
import { evaluateSample, snapshotToStandardRows, type StandardRow } from "@/lib/standards";
import { loadStandardVersionSnapshot, resolveStandardVersionIdForSample } from "@/lib/standards-db";
import { createSampleRecordSnapshot, createSampleRawAuditLog, createNotificationEntry } from "@/lib/sampleRecord";

/**
 * แยกสารที่ไม่ได้ถูกเลือกอนุมัติออกเป็น sessionGroup ใหม่ พร้อมทำเครื่องหมายปฏิเสธ (isDeleted)
 * Splits unapproved samples in a multi-parameter group into a separate rejected sessionGroup.
 *
 * @param {any} tx - Prisma Transaction client
 * @param {string} sessionGroup - รหัสกลุ่มเซสชันเดิม
 * @param {number[]} approvedSampleIds - รหัสไอดีของแถว sample ที่ได้รับอนุมัติ
 * @param {number} reviewedById - ไอดีของผู้ดูแลระบบที่ทำการตัดสิน
 * @returns {Promise<void>}
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
            reviewedAt: nowThai(),
            reviewNote: PARTIAL_REJECT_NOTE,
        },
    });
}

/**
 * ดำเนินการตัดสินคำร้องตรวจสอบคุณภาพน้ำ (อนุมัติ, ปฏิเสธ, หรือแก้ไขก่อนอนุมัติ)
 * Processes review request decision (approve, reject, or edited_approve).
 *
 * @param {NextRequest} request - HTTP Request object พร้อม JSON payload { action, note, approvedSampleIds, editedMeasurements }
 * @param {object} context - Route context params พร้อม `id` ของคำร้อง
 * @returns {Promise<NextResponse>} ผลลัพธ์การอัปเดตคำร้อง ReviewRequest
 */
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

        // ภาพที่ AI ไม่พบหลอดทดลองยืนยันค่าที่อ่านได้ไม่ได้ — อนุมัติตามค่าเดิมไม่ได้
        // ต้องแก้ไขค่าก่อน (edited_approve) หรือปฏิเสธเท่านั้น
        // ตรวจเฉพาะ sample ที่กำลังจะถูกอนุมัติจริง ถ้าผู้ดูแลระบบคัดตัวที่มีปัญหาออกไปแล้ว ที่เหลืออนุมัติได้ตามปกติ
        if (action === "approve") {
            const blocked = await prisma.waterSampleMeasurement.findFirst({
                where: {
                    message: { contains: "[NO_TEST_TUBE]" },
                    sample: {
                        sessionGroup: existing.sessionGroup,
                        isDeleted: false,
                        ...(approvedSampleIds ? { id: { in: approvedSampleIds } } : {}),
                    },
                },
                select: { id: true },
            });

            if (blocked) {
                return NextResponse.json(
                    { error: "คำร้องนี้มีภาพที่ AI ไม่พบหลอดทดลอง จึงอนุมัติตามค่าเดิมไม่ได้ กรุณากดแก้ไขเพื่อกรอกค่าที่ถูกต้อง หรือปฏิเสธคำร้อง" },
                    { status: 400 },
                );
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
                    reviewedAt: nowThai(),
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

                // ค่าถูกแก้ไปแล้ว สถานะคุณภาพน้ำที่คำนวณไว้ตอนส่งจึงใช้ไม่ได้อีก ต้องคำนวณใหม่จากค่าจริง
                // ไม่งั้นตัวอย่างที่ถูกแก้เป็นค่าเกินเกณฑ์จะยังติดสถานะเดิมและขึ้นแผนที่เป็นสีปลอดภัย
                // ต้องทำก่อน createSampleRecordSnapshot เพราะ snapshot อ่าน status จากอ็อบเจกต์ชุดนี้ไปตรง ๆ
                // ใช้เกณฑ์เวอร์ชันที่ตัวอย่างสังกัดตอนส่ง ไม่ใช่เกณฑ์ปัจจุบัน
                const standardsByVersion = new Map<number | null, StandardRow[]>();
                for (const sample of updatedGroupSamples) {
                    const versionId = await resolveStandardVersionIdForSample(sample, tx);
                    let standards = standardsByVersion.get(versionId);
                    if (!standards) {
                        const version = versionId === null ? null : await loadStandardVersionSnapshot(versionId, tx);
                        standards = snapshotToStandardRows(version?.snapshot ?? []);
                        standardsByVersion.set(versionId, standards);
                    }
                    const recomputed = evaluateSample(
                        sample.measurements.map((m) => ({ parameterId: m.parameterId, value: m.value })),
                        standards,
                    ) as WaterStatus;

                    if (recomputed !== sample.status) {
                        await tx.waterSample.update({ where: { id: sample.id }, data: { status: recomputed } });
                    }
                    sample.status = recomputed;
                }

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
        // Date ทุกตัวต้องออกไปแบบไม่มี Z เหมือน GET (client ไม่ได้ใช้ค่านี้แสดงผลตอนนี้ แต่กติกาต้องคงเดิมทุก route)
        return NextResponse.json(
            result && { ...result, createdAt: toApiString(result.createdAt), updatedAt: toApiString(result.updatedAt), reviewedAt: toApiString(result.reviewedAt), acknowledgedAt: toApiString(result.acknowledgedAt) }
        );
    } catch (error) {
        console.error("PATCH /api/review-requests/[id] error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการตัดสินคำร้อง" }, { status: 500 });
    }
}
