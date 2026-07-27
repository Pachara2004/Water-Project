import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeatherData, backfillWeatherData } from "@/lib/tmd";
import { WaterStatus } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { verifyAuth } from "@/lib/auth-guard";
import { isLowConfidence, evaluateSample } from "@/lib/standards";
import { loadStandardsForParameters } from "@/lib/standards-db";
import { getPendingSessionGroups } from "@/lib/review";
import { generateSessionGroup } from "@/lib/sessionGroup";
import { parsePageParams, pageResult } from "@/lib/pagination";

/** ลำดับความรุนแรงของสถานะ ใช้หาค่า "แย่สุด" ของกลุ่มตัวอย่าง (หนึ่ง sessionGroup อาจมีหลายแถว หนึ่งแถวต่อสาร) */
const STATUS_SEVERITY: Record<WaterStatus, number> = { safe: 0, warning: 1, danger: 2 };
function worseStatus(a: WaterStatus, b: WaterStatus): WaterStatus {
    return STATUS_SEVERITY[b] > STATUS_SEVERITY[a] ? b : a;
}

/**
 * FILENAME SANITIZER WITH DATE STAMP
 */
function sanitizeAndGenerateFilename(originalName: string, prefix: string = "raw"): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStamp = `${year}${month}${day}`;

    const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
    const cleanExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";

    return `${prefix}-${dateStamp}-${crypto.randomUUID()}.${cleanExt}`;
}

/**
 * GENERATOR: Sample Code Format -> SP[YYMMDD][LocationID][Sequence 0001-9999]
 */
async function generateSampleCode(tx: any, locationId: number, collectionTime: Date): Promise<string> {
    const yy = String(collectionTime.getFullYear()).slice(-2);
    const mm = String(collectionTime.getMonth() + 1).padStart(2, "0");
    const dd = String(collectionTime.getDate()).padStart(2, "0");
    const prefix = `SP${yy}${mm}${dd}${locationId}`;

    const startOfDay = new Date(collectionTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(collectionTime);
    endOfDay.setHours(23, 59, 59, 999);

    // นับจำนวน WaterSample ของสถานีนี้ในวันนั้น
    const count = await tx.waterSample.count({
        where: {
            locationId: Number(locationId),
            collectionTime: { gte: startOfDay, lte: endOfDay },
        },
    });

    const nextSeq = String(count + 1).padStart(4, "0");
    return `${prefix}${nextSeq}`;
}

// Anti-Spam Key ผสม IP + Action ป้องกันการกดเบิ้ลส่งข้อมูล
const antiSpam = new Map<string, number>();

// ==========================================
// GET /api/samples?search=&status=&startDate=&endDate=&sort=&mine=&page=&pageSize=
// ประวัติผลตรวจ แบ่งหน้าระดับ "กลุ่ม" (sessionGroup) ไม่ใช่ระดับแถว เพราะ 1 กลุ่ม = หลายแถว (1 แถวต่อสาร)
// แบ่งเป็น query 2 รอบ:
//   รอบ 1 (เบา) — select แคบ ไม่ join หนัก ใช้ group/กรอง status/นับ/ตัดหน้า
//   รอบ 2 (หนัก) — join เต็ม (location/collector/measurements) เฉพาะกลุ่มของหน้าที่ขอ
// ข้อจำกัด: รอบ 1 ยังอ่านทุกแถวที่ตรง filter อยู่ดี (ต้องรู้ทุกแถวถึงจะนับ/group ถูก)
// ==========================================
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAuth(request, ["collector", "admin", "officer"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search")?.trim() ?? "";
        const statusParam = searchParams.getAll("status").flatMap((s) => s.split(",")).filter(Boolean);
        const selectedStatuses = new Set(statusParam.map((s) => s.toLowerCase()));
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";
        const mine = searchParams.get("mine") === "true";
        const pageParams = parsePageParams(searchParams, 10);

        const where: any = { isDeleted: false };
        if (auth.user!.roleName === "collector") {
            where.collectorId = auth.user!.id;
        } else if (auth.user!.roleName === "admin" && mine) {
            where.collectorId = auth.user!.id;
        }

        if (search) {
            where.OR = [{ location: { stationName: { contains: search } } }, { code: { contains: search } }];
        }

        if (startDate || endDate) {
            where.collectionTime = {};
            if (startDate) where.collectionTime.gte = new Date(`${startDate}T00:00:00`);
            if (endDate) where.collectionTime.lte = new Date(`${endDate}T23:59:59.999`);
        }

        const pendingGroups = await getPendingSessionGroups();
        const pendingSet = new Set(pendingGroups);

        // ─── รอบ 1: ฟิลด์เบา ใช้ group/กรอง status/เรียง/นับ/ตัดหน้า ───
        const lightRows = await prisma.waterSample.findMany({
            where,
            select: { id: true, sessionGroup: true, collectionTime: true, status: true },
            orderBy: { collectionTime: sort },
        });

        // group ตาม sessionGroup — แถวที่เจอก่อน (ตามลำดับที่ query มาแล้ว) กำหนด collectionTime ของกลุ่ม
        // เพราะ orderBy มาจาก DB แล้ว แถวแรกของกลุ่มจึงเป็นค่าปลายสุด (ล่าสุด/เก่าสุดตาม sort) เสมอ
        const groupOrder: string[] = [];
        const groupStatus = new Map<string, WaterStatus>();
        for (const s of lightRows) {
            const groupKey = s.sessionGroup || `single-${s.id}`;
            const existing = groupStatus.get(groupKey);
            if (existing === undefined) {
                groupOrder.push(groupKey);
                groupStatus.set(groupKey, s.status);
            } else {
                groupStatus.set(groupKey, worseStatus(existing, s.status));
            }
        }

        // status filter เป็น group-level (แย่สุดของกลุ่ม) ต้องกรองหลัง group เสร็จเท่านั้น
        const filteredGroupKeys = selectedStatuses.size > 0 ? groupOrder.filter((key) => selectedStatuses.has(groupStatus.get(key)!)) : groupOrder;

        const total = filteredGroupKeys.length;
        const pageGroupKeys = filteredGroupKeys.slice(pageParams.skip, pageParams.skip + pageParams.take);

        if (pageGroupKeys.length === 0) {
            return NextResponse.json(pageResult([], total, pageParams));
        }

        const pageGroupKeySet = new Set(pageGroupKeys);
        const sessionGroupsInPage = pageGroupKeys.filter((k) => !k.startsWith("single-"));
        const singleIdsInPage = pageGroupKeys.filter((k) => k.startsWith("single-")).map((k) => Number(k.replace("single-", "")));

        // ─── รอบ 2: รายละเอียดเต็ม เฉพาะกลุ่มของหน้านี้ ───
        const samples = await prisma.waterSample.findMany({
            where: {
                ...where,
                OR: [...(sessionGroupsInPage.length > 0 ? [{ sessionGroup: { in: sessionGroupsInPage } }] : []), ...(singleIdsInPage.length > 0 ? [{ id: { in: singleIdsInPage } }] : [])],
            },
            include: {
                location: true,
                collector: {
                    select: {
                        id: true,
                        lineProfileName: true,
                        firstName: true,
                        lastName: true,
                        phoneNumber: true,
                    },
                },
                measurements: {
                    include: {
                        parameter: true,
                    },
                },
            },
            orderBy: { collectionTime: sort },
        });

        const groupedSamples = new Map<string, any>();

        samples.forEach((s: any) => {
            const groupKey = s.sessionGroup || `single-${s.id}`;
            if (!pageGroupKeySet.has(groupKey)) return; // เผื่อ search/date filter ของ where ดัก group อื่นติดมาด้วยจาก OR

            const currentMeasurements: Record<string, number> = {};
            s.measurements.forEach((m: any) => {
                if (m.parameter?.name) {
                    const keyName = `${m.parameter.name.toLowerCase()}Val`;
                    currentMeasurements[keyName] = m.value;
                }
            });

            if (!groupedSamples.has(groupKey)) {
                groupedSamples.set(groupKey, {
                    id: s.id,
                    code: s.code, // แนบ code ส่งให้ Frontend
                    collectorId: s.collectorId,
                    locationId: s.locationId,
                    collectionTime: s.collectionTime,
                    uploadedActiveAt: s.uploadedActiveAt,
                    dissolvedOxygen: s.dissolvedOxygen,
                    airTemperature: s.airTemperature,
                    rainAccumulation: s.rainAccumulation,
                    weatherCondCode: s.weatherCondCode,
                    rawImageUrl: s.rawImageUrl,
                    analyzedPlotUrl: s.analyzedPlotUrl,
                    isDeleted: s.isDeleted,
                    sessionGroup: s.sessionGroup,

                    reviewStatus: pendingSet.has(groupKey) ? "PENDING" : "APPROVED",

                    ...currentMeasurements,

                    location: s.location
                        ? {
                              id: s.location.id,
                              name: s.location.stationName,
                              organization: s.location.governingAgency,
                              lat: s.location.latitude,
                              lng: s.location.longitude,
                          }
                        : null,
                    collector: s.collector,
                    status: s.status ? s.status.toUpperCase() : "SAFE",
                });
            } else {
                const existing = groupedSamples.get(groupKey);

                Object.assign(existing, currentMeasurements);

                if (!existing.rawImageUrl && s.rawImageUrl) existing.rawImageUrl = s.rawImageUrl;
                if (!existing.analyzedPlotUrl && s.analyzedPlotUrl) existing.analyzedPlotUrl = s.analyzedPlotUrl;

                const currentStatus = s.status ? s.status.toUpperCase() : "SAFE";
                if (currentStatus === "DANGER") {
                    existing.status = "DANGER";
                } else if (currentStatus === "WARNING" && existing.status !== "DANGER") {
                    existing.status = "WARNING";
                }
            }
        });

        // เรียงผลลัพธ์ตามลำดับ groupKeys จากรอบ 1 — รอบ 2 ใช้ OR หลายเงื่อนไข ลำดับที่ DB คืนมาไม่รับประกันตรงกับที่ตัดหน้าไว้
        const formattedSamples = pageGroupKeys.map((key) => groupedSamples.get(key)).filter(Boolean);

        return NextResponse.json(pageResult(formattedSamples, total, pageParams));
    } catch (error) {
        console.error("GET /api/samples error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลผลตรวจน้ำ" }, { status: 500 });
    }
}

// ==========================================
// POST /api/samples — บันทึกผลตรวจแยกรายสารอิงตาม Database 100%
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

        const parsedCollectionTime = new Date(collectionTime);

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
                const normalizedTime = new Date(parsedCollectionTime.getTime());
                normalizedTime.setMinutes(0, 0, 0);
                normalizedTime.setSeconds(0, 0);

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

        let createMeasurementsData: Array<{ parameterId: number; value: number; confidence: number; boundingBox?: any; message?: string | null }> = [];

        if (measurementsRaw) {
            const parsedMeasurements = JSON.parse(measurementsRaw);
            if (Array.isArray(parsedMeasurements)) {
                createMeasurementsData = parsedMeasurements.map((m: any) => ({
                    parameterId: Number(m.parameterId),
                    value: parseFloat(m.value || "0"),
                    confidence: parseFloat(m.confidence || "0.90"),
                    boundingBox: typeof m.boundingBox === "string" ? (m.boundingBox ? JSON.parse(m.boundingBox) : null) : m.boundingBox || null,
                    message: m.message || null,
                }));
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

            // 🎯 ค้นหาสารเคมีใน Batch เดียวกันที่บันทึกลง DB ไปก่อนหน้านี้ (ยิงติดๆ กันไม่เกิน 1 นาที)
            const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
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
                // 🤝 เจอสารตัวแรกใน Batch เดียวกันแล้ว! ดึง SES... ของตัวแรกมาใช้ต่อทันที
                sessionGroupToUse = existingBatchSample.sessionGroup;
            } else {
                // 🆕 นี่คือสารตัวแรกสุดของ Batch ให้สั่งเจน SES260720... ใหม่
                sessionGroupToUse = await generateSessionGroup(tx, parsedCollectionTime);
            }

            // เจน Sample Code รายขวด (SP26072030001, SP26072030002) แยกรายขวด
            const generatedCode = await generateSampleCode(tx, Number(locationId), parsedCollectionTime);

            const needsReview = forceReview || createMeasurementsData.some((m) => isLowConfidence(m.confidence));

            const created = await tx.waterSample.create({
                data: {
                    code: generatedCode,
                    locationId: Number(locationId),
                    collectorId: secureCollectorId,
                    collectionTime: parsedCollectionTime,
                    dissolvedOxygen: oxygen ? parseFloat(oxygen) : null,
                    airTemperature: finalWeather.airTemperature,
                    rainAccumulation: finalWeather.rainAccumulation,
                    weatherCondCode: finalWeather.weatherCondCode,
                    status: computedStatus as WaterStatus,
                    rawImageUrl: mainRawImageUrl,
                    analyzedPlotUrl: mainAnalyzedPlotUrl,
                    isDeleted: false,
                    sessionGroup: sessionGroupToUse, // 👈 ใช้ SES... ร่วมกันแน่นอน!
                    measurements: {
                        create: createMeasurementsData,
                    },
                },
            });

            if (needsReview && sessionGroupToUse) {
                await tx.reviewRequest.upsert({
                    where: { sessionGroup: sessionGroupToUse },
                    create: { sessionGroup: sessionGroupToUse, statusRequest: "pending" },
                    update: {},
                });
            }

            return created;
        });

        return NextResponse.json(sample, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/samples error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลตัวอย่างน้ำลงฐานข้อมูล", details: error?.message }, { status: 500 });
    }
}
