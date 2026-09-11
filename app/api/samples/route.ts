// app/api/samples/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { backfillWeatherData } from "@/lib/tmd";
import { WaterStatus } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { verifyAuth } from "@/lib/auth-guard";
import { isLowConfidence, evaluateSample, toMeasuredNumber } from "@/lib/standards";
import { loadStandardsForParameters } from "@/lib/standards-db";
import { getPendingSessionGroups } from "@/lib/review";
import { generateSessionGroup } from "@/lib/sessionGroup";
import { parsePageParams, pageResult } from "@/lib/pagination";
import { createSampleRecordSnapshot, createNotificationEntry } from "@/lib/sampleRecord";
import { dayEnd, dayStart, floorToHour, nowThai, parseThaiInput, sameDayRange, toApiString, toYmd, toYymmdd } from "@/lib/thaiTime";

/** ลำดับความรุนแรงของสถานะ ใช้หาค่า "แย่สุด" ของกลุ่มตัวอย่าง (หนึ่ง sessionGroup อาจมีหลายแถว หนึ่งแถวต่อสาร) */
const STATUS_SEVERITY: Record<WaterStatus, number> = { safe: 0, warning: 1, danger: 2 };
function worseStatus(a: WaterStatus, b: WaterStatus): WaterStatus {
    return STATUS_SEVERITY[b] > STATUS_SEVERITY[a] ? b : a;
}

/**
 * อายุของไฟล์รูปดิบก่อนถูก /api/cron/cleanup-images ลบทิ้ง (วัน)
 *
 * ต้องเซ็ต imageExpiresAt ตอนสร้างแถวเท่านั้น — cron คัดงานด้วย `imageExpiresAt <= nowThai()`
 * ถ้าคอลัมน์เป็น NULL แถวนั้นจะไม่เข้าเงื่อนไขตลอดไป และไฟล์ใน public/uploads จะไม่ถูกลบเลย
 */
const IMAGE_RETENTION_DAYS = Number(process.env.IMAGE_RETENTION_DAYS) > 0 ? Number(process.env.IMAGE_RETENTION_DAYS) : 90;

/**
 * FILENAME SANITIZER WITH DATE STAMP
 */
function sanitizeAndGenerateFilename(originalName: string, prefix: string = "raw"): string {
    const dateStamp = toYmd(nowThai()).replace(/-/g, "");

    const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
    const cleanExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const safePrefix = prefix.replace(/[^a-z0-9\-]/gi, '_');

    return `${safePrefix}-${dateStamp}-${crypto.randomUUID()}.${cleanExt}`;
}

/**
 * GENERATOR: Sample Code Format -> SP[YYMMDD][LocationID 3 หลัก][Sequence 0001-9999]
 */
async function generateSampleCode(tx: any, locationId: number, collectionTime: Date): Promise<string> {
    // วันของรหัสและขอบเขตวันคิดจากค่า UTC ของ Date ซึ่งคือปฏิทินไทย (ดู lib/thaiTime.ts) — ไม่ขึ้นกับ TZ ของ process
    const prefix = `SP${toYymmdd(collectionTime)}${String(locationId).padStart(3, "0")}`;
    const { start, end } = sameDayRange(collectionTime);

    // นับจำนวน WaterSample ของสถานีนี้ในวันนั้น
    const count = await tx.waterSample.count({
        where: {
            locationId: Number(locationId),
            collectionTime: { gte: start, lt: end },
        },
    });

    const nextSeq = String(count + 1).padStart(4, "0");
    return `${prefix}${nextSeq}`;
}

// Anti-Spam Key ผสม IP + Action ป้องกันการกดเบิ้ลส่งข้อมูล
const antiSpam = new Map<string, number>();

// ==========================================
// GET /api/samples
// ==========================================
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAuth(request, ["collector", "admin"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search")?.trim() ?? "";
        const statusParam = searchParams
            .getAll("status")
            .flatMap((s) => s.split(","))
            .filter(Boolean);
        const selectedStatuses = new Set(statusParam.map((s) => s.toLowerCase()));
        // สถานะการตรวจสอบ (PENDING/APPROVED/EDITED_APPROVED/REJECTED) เป็นคนละมิติกับ status คุณภาพน้ำ
        // ค่านี้ไม่มีในตาราง WaterSample — ถูกคำนวณจาก ReviewRequest หลังจับกลุ่ม sessionGroup แล้ว
        // จึงกรองใน Prisma where ไม่ได้ ต้องไปกรองในหน่วยความจำที่ขั้นตอนที่ 5
        const reviewParam = searchParams
            .getAll("review")
            .flatMap((s) => s.split(","))
            .filter(Boolean);
        const selectedReviewStatuses = new Set(reviewParam.map((s) => s.toUpperCase()));
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";
        const mine = searchParams.get("mine") === "true";
        const pageParams = parsePageParams(searchParams, 10);

        const where: any = {};
        const baseFilter: any = { OR: [{ isDeleted: false }] };

        if (auth.user!.roleName === "collector") {
            where.collectorId = auth.user!.id;
        } else if (auth.user!.roleName === "admin" && mine) {
            where.collectorId = auth.user!.id;
        }

        if (search) {
            where.OR = [
                { sessionGroup: { contains: search } },
                { code: { contains: search } },
                { location: { stationName: { contains: search } } },
            ];
        }

        // ขอบเขตวันต้องสร้างจาก dayStart/dayEnd — new Date("YYYY-MM-DDT00:00:00") จะถูกอ่านตาม TZ ของ process
        // ซึ่งไม่ตรงกับนาฬิกาไทยใน DB เมื่อ server ไม่ได้รันด้วย TZ=Asia/Bangkok
        if (startDate || endDate) {
            where.collectionTime = {};
            if (startDate) where.collectionTime.gte = dayStart(startDate);
            if (endDate) where.collectionTime.lt = dayEnd(endDate);
        }

        // 2. หากลุ่มที่ถูกปฏิเสธไว้ก่อน — สมาชิกกลุ่มถูก soft-delete แล้ว (isDeleted จริง) จึงต้องเปิดพิเศษ
        // ให้หลุด baseFilter ปกติมาได้ ใช้ where กรองที่ index @@index([statusRequest]) ให้ตรง ไม่ดึงทั้งตาราง
        const rejectedGroups = await prisma.reviewRequest.findMany({
            where: { statusRequest: "rejected" },
            select: { sessionGroup: true },
        });
        const rejectedSessionGroups = rejectedGroups.map((rr) => rr.sessionGroup);

        if (rejectedSessionGroups.length > 0) {
            baseFilter.OR.push({ sessionGroup: { in: rejectedSessionGroups } });
        }
        where.AND = [baseFilter];
        where.sessionGroup = { not: null }; // การ์ดต้องมี sessionGroup เสมอ ตัดตั้งแต่ query ดีกว่าไปข้ามทีหลัง

        // 3. เฟส 1 (เบา): หากลุ่มทั้งหมดที่ผ่านตัวกรอง ด้วย groupBy — ไม่ join location/collector/รูป
        // ได้ (sessionGroup, status) คู่ที่มีอยู่จริงของแต่ละกลุ่ม + เวลาล่าสุดของ status นั้น
        const statusGroups = await prisma.waterSample.groupBy({
            by: ["sessionGroup", "status"],
            where,
            _max: { collectionTime: true },
        });

        // ยุบหลาย (sessionGroup, status) ให้เหลือ 1 สรุปต่อกลุ่ม — สถานะ = แย่สุดของกลุ่ม (worseStatus)
        // เวลา = ล่าสุดของกลุ่ม ใช้แค่เป็นคีย์เรียงลำดับ/ตัดหน้าเท่านั้น ไม่ใช่ค่าที่ส่งกลับให้ client
        const groupSummary = new Map<string, { status: WaterStatus | null; collectionTime: Date }>();
        for (const g of statusGroups) {
            if (!g.sessionGroup) continue;
            const maxTime = g._max.collectionTime ?? new Date(0);
            const existing = groupSummary.get(g.sessionGroup);
            if (!existing) {
                groupSummary.set(g.sessionGroup, { status: g.status, collectionTime: maxTime });
            } else {
                // สารที่ประเมินไม่ได้ (null) ไม่ถ่วงสถานะของกลุ่ม — กลุ่มที่มีสารหนึ่งอ่านไม่ออกแต่อีกสารเกินเกณฑ์
                // ต้องขึ้นว่าอันตราย ไม่ใช่ประเมินไม่ได้ | กลุ่มจะเป็น null ก็ต่อเมื่อไม่มีสารไหนประเมินได้เลย
                if (g.status !== null) {
                    existing.status = existing.status === null ? g.status : worseStatus(existing.status, g.status);
                }
                if (maxTime > existing.collectionTime) existing.collectionTime = maxTime;
            }
        }
        const candidateGroups = Array.from(groupSummary.keys());

        // 4. สถานะการตรวจสอบเฉพาะกลุ่มที่ผ่านตัวกรองแล้ว (ไม่ใช่ทั้งตาราง ReviewRequest)
        // ใช้ทั้งกรอง review และติด badge ในขั้นตอนที่ 6
        const reviewRequests =
            candidateGroups.length > 0
                ? await prisma.reviewRequest.findMany({
                      where: { sessionGroup: { in: candidateGroups } },
                      select: { sessionGroup: true, statusRequest: true },
                  })
                : [];
        const reviewStatusMap = new Map<string, string>();
        for (const rr of reviewRequests) {
            if (rr.sessionGroup) reviewStatusMap.set(rr.sessionGroup, rr.statusRequest);
        }
        const toReviewStatus = (raw: string | undefined) => {
            if (raw === "pending") return "PENDING";
            if (raw === "rejected") return "REJECTED";
            if (raw === "edited_approved") return "EDITED_APPROVED";
            return "APPROVED"; // ไม่มีแถวใน ReviewRequest เลย = auto-approve ตอนส่ง ก็นับเป็น approved เหมือนกัน
        };

        // 5. กรองสถานะคุณภาพน้ำ + สถานะตรวจสอบ แล้วเรียง/ตัดหน้า — ทำกับแค่รายชื่อกลุ่ม เบามาก
        // (สถานะคุณภาพน้ำเป็นค่าระดับกลุ่มที่เพิ่งคำนวณเสร็จข้างบน จึงกรองใน Prisma where ไม่ได้ตั้งแต่ต้น)
        let filteredGroups = candidateGroups.map((sg) => {
            const summary = groupSummary.get(sg)!;
            return {
                sessionGroup: sg,
                status: summary.status,
                collectionTime: summary.collectionTime,
                reviewStatus: toReviewStatus(reviewStatusMap.get(sg)),
            };
        });

        if (selectedStatuses.size > 0) {
            // ตัวกรองต้องตรงกับป้ายที่ผู้ใช้เห็นบนการ์ด ไม่ใช่ค่าดิบในคอลัมน์ status
            // รายการที่ยังไม่ผ่านการตรวจสอบไม่ได้ประกาศคุณภาพน้ำ (การ์ดขึ้น "รอตรวจสอบ" / "ประเมินไม่ได้")
            // จึงต้องไม่ตรงกับตัวกรอง safe/warning/danger — ผู้ใช้กรองด้วยสถานะการตรวจสอบแยกอยู่แล้ว
            const isConfirmed = (rs: string) => rs === "APPROVED" || rs === "EDITED_APPROVED";
            filteredGroups = filteredGroups.filter((g) => g.status !== null && isConfirmed(g.reviewStatus) && selectedStatuses.has(g.status.toLowerCase()));
        }
        if (selectedReviewStatuses.size > 0) {
            filteredGroups = filteredGroups.filter((g) => selectedReviewStatuses.has(g.reviewStatus));
        }

        filteredGroups.sort((a, b) => {
            const timeA = a.collectionTime.getTime();
            const timeB = b.collectionTime.getTime();
            return sort === "asc" ? timeA - timeB : timeB - timeA;
        });

        const total = filteredGroups.length;
        const pageGroupEntries = filteredGroups.slice(pageParams.skip, pageParams.skip + pageParams.take);

        /* สูตรเคมีของทุกสาร ส่งเป็นก้อนแยกท้าย response ไม่ใช่แนบไปกับค่าแต่ละตัว
           เพราะค่าสารถูกแบนเป็นคีย์ `${ชื่อสาร}Val` (ดูขั้นตอนที่ 8) ซึ่งแนบข้อมูลประกอบไปด้วยไม่ได้
           ส่งมากับ payload เดียวกันนี้เลยเพื่อให้การ์ดวาดป้ายได้ตั้งแต่ render แรก
           ไม่ต้องยิง /api/parameters เพิ่มแล้วเห็นป้ายกระพริบจากชื่อย่อเป็นสูตร */
        const parameterRows = await prisma.parameter.findMany({ select: { name: true, formula: true } });
        const parameterFormulas: Record<string, string> = {};
        for (const p of parameterRows) {
            if (p.formula) parameterFormulas[p.name.toLowerCase()] = p.formula;
        }

        if (pageGroupEntries.length === 0) {
            return NextResponse.json({ ...pageResult([], total, pageParams), parameterFormulas });
        }

        // 6. เฟส 2 (หนักแต่แคบ): ดึงรายละเอียดเต็ม (รูป, location, collector, ค่าสาร) เฉพาะกลุ่มที่จะแสดงหน้านี้
        const pageGroupNames = pageGroupEntries.map((g) => g.sessionGroup);
        const rawRecords = await prisma.waterSample.findMany({
            where: { sessionGroup: { in: pageGroupNames } },
            orderBy: { id: "asc" }, // Ascending to process chronologically
            select: {
                id: true,
                sessionGroup: true,
                collectorId: true,
                locationId: true,
                collectionTime: true,
                uploadedActiveAt: true,
                dissolvedOxygen: true,
                airTemperature: true,
                rainAccumulation: true,
                weatherCondCode: true,
                rawImageUrl: true,
                analyzedPlotUrl: true,
                isDeleted: true,
                status: true,
                location: { select: { id: true, stationName: true, province: true, district: true, subdistrict: true, zipcode: true } },
                collector: { select: { id: true, lineProfileName: true } },
                measurements: { select: { parameterId: true, value: true, message: true, parameter: { select: { name: true } } } },
            },
        });

        // 7. Group by sessionGroup (เหมือนขั้นตอนเดิม ต่างแค่ input มาจากแค่หน้านี้แล้ว)
        const sessionMap = new Map<string, any>();

        for (const record of rawRecords) {
            if (!record.sessionGroup) continue;

            if (!sessionMap.has(record.sessionGroup)) {
                const measMap = new Map<number, any>();
                record.measurements.forEach((m: any) => measMap.set(m.parameterId, m));

                sessionMap.set(record.sessionGroup, {
                    id: record.id,
                    code: record.sessionGroup, // Using sessionGroup as the code for History lists
                    sessionGroup: record.sessionGroup,
                    collectorId: record.collectorId,
                    locationId: record.locationId,
                    collectionTime: toApiString(record.collectionTime),
                    uploadedActiveAt: toApiString(record.uploadedActiveAt),
                    dissolvedOxygen: record.dissolvedOxygen,
                    airTemperature: record.airTemperature,
                    rainAccumulation: record.rainAccumulation,
                    weatherCondCode: record.weatherCondCode,
                    rawImageUrl: record.rawImageUrl,
                    analyzedPlotUrl: record.analyzedPlotUrl,
                    isDeleted: record.isDeleted,
                    reviewStatus: toReviewStatus(reviewStatusMap.get(record.sessionGroup)),
                    status: record.status,

                    location: record.location ? {
                        id: record.location.id,
                        name: record.location.stationName,
                        province: record.location.province,
                        district: record.location.district,
                        subdistrict: record.location.subdistrict,
                        zipcode: record.location.zipcode,
                    } : null,
                    collector: record.collector ? {
                        id: record.collector.id,
                        lineProfileName: record.collector.lineProfileName,
                    } : null,

                    measMap, // Temporary map for reliable deduplication
                    dynamicMeasurements: {} as Record<string, number>,
                });
            } else {
                const existing = sessionMap.get(record.sessionGroup);

                // Overwrite measurements for this parameter using the map
                record.measurements.forEach((m: any) => existing.measMap.set(m.parameterId, m));

                // Overwrite properties from the latest record
                existing.id = record.id;
                existing.collectionTime = toApiString(record.collectionTime);
                existing.uploadedActiveAt = toApiString(record.uploadedActiveAt);
                existing.dissolvedOxygen = record.dissolvedOxygen;
                existing.airTemperature = record.airTemperature;
                existing.rainAccumulation = record.rainAccumulation;
                existing.weatherCondCode = record.weatherCondCode;
                existing.isDeleted = record.isDeleted;

                // Dynamically update the overall status to the worst one
                // เช่นเดียวกับ groupSummary — แถวที่ประเมินไม่ได้ไม่ถ่วงสถานะรวมของกลุ่ม
                if (record.status !== null) {
                    existing.status = existing.status === null ? record.status : worseStatus(existing.status as WaterStatus, record.status);
                }

                // If earlier batch didn't have images, take them from later batches
                if (!existing.rawImageUrl && record.rawImageUrl) existing.rawImageUrl = record.rawImageUrl;
                if (!existing.analyzedPlotUrl && record.analyzedPlotUrl) existing.analyzedPlotUrl = record.analyzedPlotUrl;
            }
        }

        // 8. Map dynamic measurements (e.g. pHVal, DOVal)
        for (const grp of sessionMap.values()) {
            grp.measurements = Array.from(grp.measMap.values());
            grp.measurements.forEach((m: any) => {
                if (!m.parameter?.name) return;
                // ค่าจากภาพที่ AI ไม่พบหลอดทดลองยังยืนยันไม่ได้ระหว่างรอตรวจสอบ — ไม่ส่งออกไปให้การ์ดของผู้ส่งแสดง
                // ผูกเงื่อนไขกับ reviewStatus ด้วย ไม่ใช่ดู marker อย่างเดียว เพราะ marker ยังคาอยู่ใน message หลังอนุมัติแล้ว
                if (grp.reviewStatus === "PENDING" && m.message?.includes("[NO_TEST_TUBE]")) return;
                grp.dynamicMeasurements[`${m.parameter.name.toLowerCase()}Val`] = m.value;
            });
            Object.assign(grp, grp.dynamicMeasurements);
            delete grp.measMap;
            delete grp.measurements;
            delete grp.dynamicMeasurements;
        }

        // ใช้ลำดับที่คำนวณไว้ตอนตัดหน้า (ขั้นตอนที่ 5) ไม่ใช่ลำดับที่ query เฟส 2 คืนมา
        const pageRecords = pageGroupNames.map((sg) => sessionMap.get(sg)).filter(Boolean);

        return NextResponse.json({ ...pageResult(pageRecords, total, pageParams), parameterFormulas });
    } catch (error) {
        console.error("GET /api/samples error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลผลตรวจน้ำ" }, { status: 500 });
    }
}

// ==========================================
// POST /api/samples
// ==========================================
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const measurementsRaw = formData.get("measurements") as string | null;

        let paramKey = "unknown";
        if (measurementsRaw) {
            try {
                const parsed = JSON.parse(measurementsRaw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    paramKey = String(parsed[0].parameterId);
                }
            } catch (e) {}
        }

        const rawImageFile = formData.get(`image_raw_${paramKey}`) as File | null;
        const imageFingerprint = rawImageFile ? `${rawImageFile.name}-${rawImageFile.size}` : "no-image";

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
        const antiSpamKey = `${ip}-${paramKey}-${imageFingerprint}`;

        if (antiSpam.has(antiSpamKey) && Date.now() - antiSpam.get(antiSpamKey)! < 3000) {
            return NextResponse.json({ error: "อย่ากดซ้ำ ระบบกำลังประมวลผลสารนี้อยู่" }, { status: 429 });
        }
        antiSpam.set(antiSpamKey, Date.now());

        // คีย์ผสมชื่อ+ขนาดไฟล์รูป จึงแทบไม่ซ้ำกันเลยระหว่างคำขอ — ถ้าไม่กวาดทิ้ง Map จะโตตามจำนวนคำขอสะสม
        // เกณฑ์เดียวกับ /api/analyze: กวาดเมื่อ Map เริ่มใหญ่ ไม่ใช่ทุกครั้ง เพื่อไม่ให้เสียเวลาในเส้นทางปกติ
        if (antiSpam.size > 500) {
            const cutoff = Date.now();
            for (const [key, timestamp] of antiSpam.entries()) {
                if (cutoff - timestamp >= 3000) antiSpam.delete(key);
            }
        }

        const auth = await verifyAuth(request, ["collector", "admin"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        const secureCollectorId = auth.user!.id;

        const locationId = formData.get("locationId") as string;
        const collectionTime = formData.get("collectionTime") as string;
        const oxygen = formData.get("oxygen") as string | null;
        let clientSessionGroup = formData.get("sessionGroup") as string | null;
        const forceReview = formData.get("forceReview") === "true";
        const reviewNote = formData.get("reviewNote") as string | null;

        if (!locationId || !collectionTime) {
            return NextResponse.json({ error: "กรุณากรอกข้อมูลหลักให้ครบถ้วน" }, { status: 400 });
        }

        const location = await prisma.location.findUnique({
            where: { id: Number(locationId) },
        });
        if (!location) {
            return NextResponse.json({ error: "ไม่พบสถานีจุดตรวจที่ระบุในระบบ" }, { status: 404 });
        }

        const systemParameters = await prisma.parameter.findMany();

        const uploadDir = path.join(process.cwd(), "public", "uploads");
        await mkdir(uploadDir, { recursive: true });

        const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
        const maxFileSize = 10 * 1024 * 1024;

        let mainRawImageUrl: string | null = null;
        let mainAnalyzedPlotUrl: string | null = null;

        const fileTasks: Promise<void>[] = [];

        for (const param of systemParameters) {
            const rawFile = formData.get(`image_raw_${param.id}`) as File | null;
            const plotFile = formData.get(`image_plot_${param.id}`) as File | null;

            if (rawFile && rawFile.size > 0 && allowedImageTypes.includes(rawFile.type) && rawFile.size <= maxFileSize) {
                const filename = sanitizeAndGenerateFilename(rawFile.name, `raw-${param.name.toLowerCase()}`);

                const saveRawTask = (async () => {
                    const buffer = Buffer.from(await rawFile.arrayBuffer());
                    await writeFile(path.join(uploadDir, filename), buffer);
                })();
                fileTasks.push(saveRawTask);

                if (String(param.id) === paramKey) {
                    mainRawImageUrl = `/uploads/${filename}`;
                }
            }

            if (plotFile && plotFile.size > 0 && allowedImageTypes.includes(plotFile.type) && plotFile.size <= maxFileSize) {
                const filename = sanitizeAndGenerateFilename(plotFile.name, `plot-${param.name.toLowerCase()}`);

                const savePlotTask = (async () => {
                    const buffer = Buffer.from(await plotFile.arrayBuffer());
                    await writeFile(path.join(uploadDir, filename), buffer);
                })();
                fileTasks.push(savePlotTask);

                if (String(param.id) === paramKey) {
                    mainAnalyzedPlotUrl = `/uploads/${filename}`;
                }
            }
        }

        if (fileTasks.length > 0) {
            await Promise.all(fileTasks);
        }

        const parsedCollectionTime = parseThaiInput(collectionTime);
        if (!parsedCollectionTime) {
            return NextResponse.json({ error: "รูปแบบเวลาเก็บตัวอย่างไม่ถูกต้อง" }, { status: 400 });
        }
        let finalWeather = {
            airTemperature: null as number | null,
            rainAccumulation: null as number | null,
            weatherCondCode: null as number | null,
        };

        try {
            let existingGroupSample = null;
            if (clientSessionGroup) {
                existingGroupSample = await prisma.waterSample.findFirst({
                    where: {
                        collectorId: secureCollectorId,
                        locationId: Number(locationId),
                        collectionTime: parsedCollectionTime,
                        isDeleted: false,
                    },
                    select: {
                        airTemperature: true,
                        rainAccumulation: true,
                        weatherCondCode: true,
                    },
                });
            }

            if (existingGroupSample) {
                finalWeather.airTemperature = existingGroupSample.airTemperature;
                finalWeather.rainAccumulation = existingGroupSample.rainAccumulation;
                finalWeather.weatherCondCode = existingGroupSample.weatherCondCode;
            } else {
                const normalizedTime = floorToHour(parsedCollectionTime);

                let weatherCache = await prisma.weatherData.findUnique({
                    where: {
                        locationId_timestamp: {
                            locationId: Number(locationId),
                            timestamp: normalizedTime,
                        },
                    },
                });

                if (!weatherCache) {
                    console.log(`⚠️ [API Sample] ไม่พบแคชสภาพอากาศใน DB รอบเวลา ${normalizedTime.toISOString()} สั่งซ่อมแซมข้อมูล...`);
                    await backfillWeatherData(location.id, location.latitude, location.longitude);

                    weatherCache = await prisma.weatherData.findUnique({
                        where: {
                            locationId_timestamp: {
                                locationId: location.id,
                                timestamp: normalizedTime,
                            },
                        },
                    });
                }

                if (weatherCache) {
                    finalWeather.airTemperature = weatherCache.temperature;
                    finalWeather.rainAccumulation = weatherCache.rainVolume;
                    finalWeather.weatherCondCode = weatherCache.weatherCondition;
                }
            }
        } catch (weatherErr) {
            console.error("❌ Weather resolution error:", weatherErr);
        }

        let createMeasurementsData: Array<{ parameterId: number; value: number | null; confidence: number | null; boundingBox?: any; message?: string | null }> = [];

        if (measurementsRaw) {
            const parsedMeasurements = JSON.parse(measurementsRaw);
            if (Array.isArray(parsedMeasurements)) {
                createMeasurementsData = parsedMeasurements.map((m: any) => {
                    // AI ไม่พบหลอดทดลอง → โมเดลยังคืนเลขมาให้อยู่ดี (สังเกตจริง: value 0, confidence 0)
                    // แต่มันไม่ใช่ผลวัด ต้องบังคับเป็น null ที่นี่ ไม่งั้น 0 จะถูกนำไปเทียบเกณฑ์แล้วรายงานว่า "ปกติ"
                    // และ isLowConfidence(0) ก็บังเอิญถูกโดยไม่ได้ตั้งใจ — พึ่งความบังเอิญนั้นไม่ได้
                    const noTestTube = typeof m.message === "string" && m.message.includes("[NO_TEST_TUBE]");

                    return {
                        parameterId: Number(m.parameterId),
                        // ไม่มีค่าที่วัดได้ → เก็บ null ไม่ใช่ 0
                        // ความมั่นใจที่เป็น null ถูก isLowConfidence ตีความว่าต้องให้ผู้ดูแลระบบตรวจสอบ
                        value: noTestTube ? null : toMeasuredNumber(m.value),
                        confidence: noTestTube ? null : toMeasuredNumber(m.confidence),
                        boundingBox: typeof m.boundingBox === "string" ? (m.boundingBox ? JSON.parse(m.boundingBox) : null) : m.boundingBox || null,
                        message: m.message || null,
                    };
                });
            }
        }

        const standards = await loadStandardsForParameters(createMeasurementsData.map((m) => m.parameterId));
        const computedStatus = evaluateSample(
            createMeasurementsData.map((m) => ({ parameterId: m.parameterId, value: m.value })),
            standards,
        );

        // 5. บันทึกข้อมูลแบบ Transaction
        const sample = await prisma.$transaction(async (tx) => {
            let sessionGroupToUse: string;

            const nowLocal = nowThai();
            const oneMinuteAgo = new Date(nowLocal.getTime() - 60 * 1000);

            // ค้นหาสารเคมีใน Batch เดียวกันที่บันทึกลง DB ไปก่อนหน้านี้ (ยิงติดๆ กันไม่เกิน 1 นาที)
            const existingBatchSample = await tx.waterSample.findFirst({
                where: {
                    collectorId: secureCollectorId,
                    locationId: Number(locationId),
                    collectionTime: parsedCollectionTime,
                    uploadedActiveAt: { gte: oneMinuteAgo },
                    isDeleted: false,
                },
                select: { sessionGroup: true },
                orderBy: { id: "desc" },
            });

            if (existingBatchSample && existingBatchSample.sessionGroup) {
                sessionGroupToUse = existingBatchSample.sessionGroup;
            } else {
                sessionGroupToUse = await generateSessionGroup(tx, parsedCollectionTime);
            }

            const generatedCode = await generateSampleCode(tx, Number(locationId), parsedCollectionTime);
            // forceReview มาจาก client จึงเชื่อเดี่ยว ๆ ไม่ได้ — marker [NO_TEST_TUBE] ใน message คือหลักฐานว่า
            // AI ไม่พบหลอดทดลองในภาพ ค่าที่วัดได้จึงยังยืนยันไม่ได้ ต้องเข้าคิวให้ผู้ดูแลระบบตัดสินเสมอ
            // ไม่งั้นคำขอที่ไม่ได้แนบ forceReview จะวิ่งเข้า auto-approve แล้วโผล่บนแผนที่ทันที
            const hasNoTestTube = createMeasurementsData.some((m) => m.message?.includes("[NO_TEST_TUBE]"));
            const needsReview = forceReview || hasNoTestTube || createMeasurementsData.some((m) => isLowConfidence(m.confidence));

            const created = await tx.waterSample.create({
                data: {
                    code: generatedCode,
                    locationId: Number(locationId),
                    collectorId: secureCollectorId,
                    collectionTime: parsedCollectionTime,
                    uploadedActiveAt: nowLocal,
                    dissolvedOxygen: oxygen ? parseFloat(oxygen) : null,
                    airTemperature: finalWeather.airTemperature,
                    rainAccumulation: finalWeather.rainAccumulation,
                    weatherCondCode: finalWeather.weatherCondCode,
                    // null = ไม่มีค่าที่ประเมินได้เลย ต้องเก็บ null ไม่ใช่ safe (คอลัมน์รองรับ null แล้ว)
                    status: computedStatus,
                    rawImageUrl: mainRawImageUrl,
                    analyzedPlotUrl: mainAnalyzedPlotUrl,
                    // ตั้งวันหมดอายุเฉพาะแถวที่มีไฟล์รูปจริง — แถวที่ไม่มีรูปไม่มีอะไรให้ cron ลบ
                    imageExpiresAt: mainRawImageUrl ? new Date(nowLocal.getTime() + IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000) : null,
                    isDeleted: false,
                    sessionGroup: sessionGroupToUse,
                    measurements: {
                        create: createMeasurementsData,
                    },
                },
            });

            if (needsReview && sessionGroupToUse) {
                await tx.reviewRequest.upsert({
                    where: { sessionGroup: sessionGroupToUse },
                    create: { 
                        sessionGroup: sessionGroupToUse, 
                        statusRequest: "pending",
                        reviewNote: reviewNote || null 
                    },
                    update: {
                        reviewNote: reviewNote || null
                    },
                });
                await createNotificationEntry(tx, {
                    userId: secureCollectorId,
                    code: sessionGroupToUse,
                    status: "pending",
                    message: "ข้อมูลของคุณกำลังรอการตรวจสอบ",
                });
            } else if (!needsReview && sessionGroupToUse) {
                // Auto Approve Path
                const fullSample = await tx.waterSample.findUnique({
                    where: { id: created.id },
                    include: {
                        collector: true,
                        location: true,
                        measurements: { include: { parameter: true } }
                    }
                });

                if (fullSample) {
                    await createSampleRecordSnapshot(tx, [fullSample]);
                    await createNotificationEntry(tx, {
                        userId: secureCollectorId,
                        code: sessionGroupToUse,
                        status: "approved",
                        message: "ผลตรวจคุณภาพน้ำได้รับการบันทึกเรียบร้อยแล้ว",
                    });
                }
            }

            return created;
        });

        const safeResponse = {
            ...sample,
            collectionTime: toApiString(sample.collectionTime),
            uploadedActiveAt: toApiString(sample.uploadedActiveAt),
            updatedActiveAt: toApiString(sample.updatedActiveAt),
            imageExpiresAt: toApiString(sample.imageExpiresAt),
        };

        return NextResponse.json(safeResponse, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/samples error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลตัวอย่างน้ำลงฐานข้อมูล", details: error?.message }, { status: 500 });
    }
}
