/**
 * @file app/api/review-requests/route.ts
 * @project Water Monitoring Project
 * @module API / Quality Review & Auditing
 * @description
 * [TH] Route Handler กล่องคำร้องขอตรวจสอบผลตรวจคุณภาพน้ำสำหรับ Admin (GET)
 * ดึงรายการคำร้องที่ค่าความมั่นใจ AI ต่ำกว่าเกณฑ์ หรือเจ้าหน้าที่ส่งมารอการตัดสินใจแบบแบ่งหน้า (Pagination)
 * กรองตามสถานะ (`pending`, `approved`, `rejected`, `edited_approved`) พร้อมดึงข้อมูลผลตรวจ ภาพถ่าย และผู้ตัดสิน
 * [EN] Route Handler for managing water quality review requests inbox for Admins (GET).
 * Retrieves paginated review requests (low AI confidence or manual review flags)
 * filtered by status (`pending`, `approved`, `rejected`, `edited_approved`) along with sample measurements, images, and reviewer info.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-13
 * @version 1.2.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-13)
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-07-14)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-08-20)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-11)
 *
 * @database Prisma Client (MySQL)
 * @auth Role-based: admin only
 * @see lib/review.ts, lib/pagination.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentStandardVersion, resolveStandardVersionIdForSample } from "@/lib/standards-db";
import { toApiString } from "@/lib/thaiTime";
import { verifyAuth } from "@/lib/auth-guard";
import { ReviewStatus } from "@prisma/client";
import { parsePageParams, pageResult } from "@/lib/pagination";

const VALID_STATUSES: string[] = ["pending", "approved", "rejected", "edited_approved"];

/**
 * ดึงรายการคำร้องขอตรวจสอบผลตรวจน้ำแบบแบ่งหน้าตามสถานะคำร้อง
 * Retrieves paginated review requests according to filter status.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม Query params `?status=...&page=...&pageSize=...`
 * @returns {Promise<NextResponse>} โครงสร้าง Pagination { items, total, page, pageSize, totalPages }
 */
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { searchParams } = new URL(request.url);
        const statusParam = searchParams.get("status");
        const status: string = VALID_STATUSES.includes(statusParam as string) ? (statusParam as string) : "pending";
        const pageParams = parsePageParams(searchParams, 10);

        let where: any = { statusRequest: status };
        if (status === "approved") {
            where = { statusRequest: { in: ["approved", "edited_approved"] } };
        }

        // นับพร้อมกันใน transaction เดียว เพื่อให้ total กับ items มาจาก snapshot เดียวกัน
        const [reviewRequests, total] = await prisma.$transaction([
            prisma.reviewRequest.findMany({
                where,
                // เรียงด้วย id ไม่ใช่ createdAt เพราะ id เป็น primary key ที่มี index อยู่แล้ว
                // ใช้แทนกันได้เพราะ createdAt เป็น @default(now()) ที่ไม่มีโค้ดไหนเขียนทับ ลำดับจึงตรงกันเสมอ
                // asc = คำร้องค้างนานสุดถูกตัดสินก่อน (เจตนาเดิม)
                orderBy: { id: "asc" },
                skip: pageParams.skip,
                take: pageParams.take,
            }),
            prisma.reviewRequest.count({ where }),
        ]);

        if (reviewRequests.length === 0) {
            return NextResponse.json(pageResult([], total, pageParams));
        }

        // เฉพาะคำร้องของหน้านี้ (~10 กลุ่ม) — ตัวที่ทำให้ query ด้านล่างไม่โตตามจำนวนคำร้องสะสมทั้งหมด
        const sessionGroups = reviewRequests.map((r) => r.sessionGroup);

        // ดึงข้อมูล sample ที่เกี่ยวข้องทั้งหมดมาครั้งเดียว (กัน N+1 ต่อคำร้อง)
        // แท็บ pending/approved โชว์เฉพาะ isDeleted:false — สารที่ถูกปฏิเสธ (รวมกรณี approve บางสาร) จะไม่โผล่
        // แท็บ rejected โชว์ทั้งหมด เพราะคำร้องที่ถูกปฏิเสธ soft-delete sample ทิ้งไปหมดแล้ว
        // (ขอบเขตปลอดภัยอยู่แล้วจาก sessionGroups ที่มาจาก reviewRequests ของ status ที่ระบุ)
        const samples = await prisma.waterSample.findMany({
            where: { sessionGroup: { in: sessionGroups }, ...(status === "rejected" ? {} : { isDeleted: false }) },
            include: {
                location: { select: { id: true, stationName: true, governingAgency: true, province: true, district: true, subdistrict: true } },
                collector: { select: { id: true, lineProfileName: true, firstName: true, lastName: true } },
                measurements: { include: { parameter: { select: { id: true, name: true, unit: true, formula: true } } } },
            },
            orderBy: { collectionTime: "desc" },
        });

        const samplesByGroup = new Map<string, typeof samples>();
        samples.forEach((s) => {
            if (!s.sessionGroup) return;
            const arr = samplesByGroup.get(s.sessionGroup) ?? [];
            arr.push(s);
            samplesByGroup.set(s.sessionGroup, arr);
        });

        // ผู้ตัดสิน (เฉพาะคำร้องที่ตัดสินไปแล้ว) — batch เดียวกันเช่นกัน
        const reviewerIds = Array.from(new Set(reviewRequests.map((r) => r.reviewedById).filter((id): id is number => id !== null)));
        const reviewers = reviewerIds.length
            ? await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, lineProfileName: true, firstName: true, lastName: true } })
            : [];
        const reviewerById = new Map(reviewers.map((u) => [u.id, u]));

        // เวอร์ชันเกณฑ์ของแต่ละกลุ่ม ให้หน้าเว็บโชว์ป้ายเมื่อไม่ตรงกับเวอร์ชันปัจจุบัน
        const currentVersion = await getCurrentStandardVersion();
        const versionIdByGroup = new Map<string, number | null>();
        for (const [group, groupSamples] of samplesByGroup) {
            versionIdByGroup.set(group, groupSamples[0] ? await resolveStandardVersionIdForSample(groupSamples[0]) : null);
        }
        const versionIds = Array.from(new Set(Array.from(versionIdByGroup.values()).filter((id): id is number => id !== null)));
        const versions = versionIds.length ? await prisma.standardVersion.findMany({ where: { id: { in: versionIds } }, select: { id: true, version: true } }) : [];
        const versionById = new Map(versions.map((v) => [v.id, v]));

        const result = reviewRequests.map((r) => {
            const groupSamples = samplesByGroup.get(r.sessionGroup) ?? [];
            const first = groupSamples[0];
            const reviewer = r.reviewedById ? reviewerById.get(r.reviewedById) : null;
            const versionId = versionIdByGroup.get(r.sessionGroup) ?? null;
            const version = versionId !== null ? versionById.get(versionId) : null;

            return {
                id: r.id,
                sessionGroup: r.sessionGroup,
                statusRequest: r.statusRequest,
                createdAt: toApiString(r.createdAt),
                reviewedAt: toApiString(r.reviewedAt),
                reviewNote: r.reviewNote,
                reviewedBy: reviewer ? { id: reviewer.id, name: `${reviewer.firstName || ""} ${reviewer.lastName || ""}`.trim() || reviewer.lineProfileName } : null,

                collectionTime: toApiString(first?.collectionTime),
                // เกณฑ์ที่กลุ่มนี้จะถูกตัดสินด้วย isCurrent=false แปลว่าเกณฑ์ถูกแก้หลังจากส่ง
                standardVersion: version ? { id: version.id, version: version.version, isCurrent: version.id === currentVersion?.id } : null,
                location: first?.location
                    ? {
                          id: first.location.id,
                          name: first.location.stationName,
                          organization: first.location.governingAgency,
                          province: first.location.province,
                          district: first.location.district,
                          subdistrict: first.location.subdistrict,
                      }
                    : null,
                collector: first?.collector
                    ? { id: first.collector.id, name: `${first.collector.firstName || ""} ${first.collector.lastName || ""}`.trim() || first.collector.lineProfileName }
                    : null,

                // แยกเป็นรายแถว WaterSample จริงในกลุ่มนี้ (1 แถว = 1 สาร) พร้อมรูปภาพต่อสารเพื่อให้ admin ตรวจสอบได้
                samples: groupSamples.map((s) => ({
                    id: s.id,
                    rawImageUrl: s.rawImageUrl,
                    analyzedPlotUrl: s.analyzedPlotUrl,
                    measurements: s.measurements.map((m) => ({
                        parameterId: m.parameterId,
                        parameterName: m.parameter?.name ?? null,
                        // สูตรเคมีเดินทางมากับผลตรวจเลย ฝั่งหน้าเว็บจะได้ไม่ต้องยิง /api/parameters เพิ่ม
                        // แล้วเห็นป้ายกระพริบจากชื่อย่อเป็นสูตรตอนโหลดเสร็จ
                        parameterFormula: m.parameter?.formula ?? null,
                        unit: m.parameter?.unit ?? null,
                        value: m.value,
                        confidence: m.confidence,
                        message: m.message,
                    })),
                })),
            };
        });

        return NextResponse.json(pageResult(result, total, pageParams));
    } catch (error) {
        console.error("GET /api/review-requests error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงรายการคำร้องขอตรวจสอบ" }, { status: 500 });
    }
}
