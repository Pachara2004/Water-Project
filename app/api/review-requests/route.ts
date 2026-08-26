import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { ReviewStatus } from "@prisma/client";
import { parsePageParams, pageResult } from "@/lib/pagination";

const VALID_STATUSES: string[] = ["pending", "approved", "rejected", "edited_approved"];

// ==========================================
// GET /api/review-requests?status=pending&page=&pageSize= — กล่องคำร้องสำหรับ admin ตัดสิน
// เฉพาะ admin เท่านั้น | ไม่ระบุ status = default "pending" (ใช้ index บน statusRequest)
// คืน { items, total, page, pageSize, totalPages } ไม่ใช่ array เปล่า
// การดึง sample/ผู้ตัดสินจะเกิดเฉพาะคำร้องของหน้าที่ขอเท่านั้น (ไม่ใช่ทุกคำร้องใน status นั้น)
// ==========================================
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
                location: { select: { id: true, stationName: true, governingAgency: true } },
                collector: { select: { id: true, lineProfileName: true, firstName: true, lastName: true } },
                measurements: { include: { parameter: { select: { id: true, name: true, unit: true } } } },
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

        const result = reviewRequests.map((r) => {
            const groupSamples = samplesByGroup.get(r.sessionGroup) ?? [];
            const first = groupSamples[0];
            const reviewer = r.reviewedById ? reviewerById.get(r.reviewedById) : null;

            return {
                id: r.id,
                sessionGroup: r.sessionGroup,
                statusRequest: r.statusRequest,
                createdAt: r.createdAt,
                reviewedAt: r.reviewedAt,
                reviewNote: r.reviewNote,
                reviewedBy: reviewer ? { id: reviewer.id, name: `${reviewer.firstName || ""} ${reviewer.lastName || ""}`.trim() || reviewer.lineProfileName } : null,

                collectionTime: first?.collectionTime ? first.collectionTime.toISOString().replace("Z", "") : null,
                location: first?.location
                    ? { id: first.location.id, name: first.location.stationName, organization: first.location.governingAgency }
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
