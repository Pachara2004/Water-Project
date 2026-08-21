// app/api/samples/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { backfillWeatherData } from "@/lib/tmd";
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
import { createSampleRecordSnapshot, createNotificationEntry } from "@/lib/sampleRecord";

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
 * GENERATOR: Sample Code Format -> SP[YYMMDD][LocationID 3 หลัก][Sequence 0001-9999]
 */
async function generateSampleCode(tx: any, locationId: number, collectionTime: Date): Promise<string> {
    const yy = String(collectionTime.getFullYear()).slice(-2);
    const mm = String(collectionTime.getMonth() + 1).padStart(2, "0");
    const dd = String(collectionTime.getDate()).padStart(2, "0");
    const prefix = `SP${yy}${mm}${dd}${String(locationId).padStart(3, "0")}`;

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
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";
        const mine = searchParams.get("mine") === "true";
        const pageParams = parsePageParams(searchParams, 10);

        const where: any = { isDeleted: false };
        if (auth.user!.roleName === "collector") {
            where.collectorNameCurrentId = auth.user!.id;
        } else if (auth.user!.roleName === "admin" && mine) {
            where.collectorNameCurrentId = auth.user!.id;
        }

        if (search) {
            where.OR = [
                { code: { contains: search } },
                { locationNameFrom: { contains: search } },
            ];
        }

        if (startDate || endDate) {
            where.collectionTime = {};
            if (startDate) where.collectionTime.gte = new Date(`${startDate}T00:00:00`);
            if (endDate) where.collectionTime.lte = new Date(`${endDate}T23:59:59.999`);
        }
        
        if (selectedStatuses.size > 0) {
            where.status = { in: Array.from(selectedStatuses) };
        }

        // ดึงข้อมูลทั้งหมดที่ตรงกับเงื่อนไข แล้ว Group by code (sessionGroup) เอาอันล่าสุด
        const rawRecords = await prisma.sampleRecord.findMany({
            where,
            orderBy: { id: sort }, // เรียงตาม id เพื่อให้ได้อันล่าสุดหากมีซ้ำ (id มากคือใหม่สุด)
        });

        const latestRecordMap = new Map<string, any>();
        for (const record of rawRecords) {
            if (!record.code) continue;
            // ถ้า sort === "desc" อันแรกที่เจอคือใหม่สุด
            // ถ้า sort === "asc" อันหลังที่เจอคือใหม่สุด 
            // เอาเป็นว่าเก็บอันที่มี id มากที่สุดเสมอสำหรับ code นั้นๆ
            if (!latestRecordMap.has(record.code)) {
                latestRecordMap.set(record.code, record);
            } else {
                const existing = latestRecordMap.get(record.code);
                if (record.id > existing.id) {
                    latestRecordMap.set(record.code, record);
                }
            }
        }

        // แปลง Map เป็น Array และเรียงลำดับอีกครั้งตาม collectionTime
        let uniqueRecords = Array.from(latestRecordMap.values());
        uniqueRecords.sort((a, b) => {
            const timeA = new Date(a.collectionTime).getTime();
            const timeB = new Date(b.collectionTime).getTime();
            return sort === "asc" ? timeA - timeB : timeB - timeA;
        });

        const total = uniqueRecords.length;
        const pageRecords = uniqueRecords.slice(pageParams.skip, pageParams.skip + pageParams.take);

        if (pageRecords.length === 0) {
            return NextResponse.json(pageResult([], total, pageParams));
        }

        const formattedSamples = pageRecords.map((record) => {
            let currentMeasurements: Record<string, number> = {};
            let rawImageUrl = null;
            let analyzedPlotUrl = null;

            if (record.parameterData && Array.isArray(record.parameterData)) {
                record.parameterData.forEach((m: any) => {
                    if (m.parameterName) {
                        const keyName = `${m.parameterName.toLowerCase()}Val`;
                        currentMeasurements[keyName] = m.value;
                    }
                });
            }

            if (record.imageUrl && typeof record.imageUrl === 'object') {
                const imgData = record.imageUrl as any;
                if (imgData.rawImageUrls && imgData.rawImageUrls.length > 0) rawImageUrl = imgData.rawImageUrls[0];
                if (imgData.plotImageUrls && imgData.plotImageUrls.length > 0) analyzedPlotUrl = imgData.plotImageUrls[0];
            }

            return {
                id: record.id,
                code: record.code, // นี่คือ sessionGroup 
                collectorId: record.collectorNameCurrentId,
                locationId: record.locationNameCurrentId,
                collectionTime: record.collectionTime ? record.collectionTime.toISOString().replace("Z", "") : null,
                uploadedActiveAt: record.uploadedActiveAt ? record.uploadedActiveAt.toISOString().replace("Z", "") : null,
                dissolvedOxygen: record.dissolvedOxygen,
                airTemperature: record.airTemperature,
                rainAccumulation: record.rainAccumulation,
                weatherCondCode: record.weatherCondCode,
                rawImageUrl: rawImageUrl,
                analyzedPlotUrl: analyzedPlotUrl,
                isDeleted: record.isDeleted,
                sessionGroup: record.code,

                reviewStatus: record.reviewStatus ? record.reviewStatus.toUpperCase() : "APPROVED",

                ...currentMeasurements,

                location: {
                    id: record.locationNameCurrentId,
                    name: record.locationNameFrom,
                },
                collector: {
                    id: record.collectorNameCurrentId,
                    lineProfileName: record.collectorNameFrom,
                },
                status: record.status ? record.status.toUpperCase() : "SAFE",
            };
        });

        return NextResponse.json(pageResult(formattedSamples, total, pageParams));
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

        // 🟢 ฟังก์ชันแปลงเวลาล็อกตัวเลขเวลาไทย (+07:00)
        const parseLocalDateTime = (timeStr: string): Date => {
            const cleanStr = timeStr.replace(/(Z|\+\d{2}:\d{2})$/, "");
            const [datePart, timePart] = cleanStr.split("T");
            const [year, month, day] = datePart.split("-").map(Number);
            const [hours, minutes] = timePart.split(":").map(Number);
            return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
        };

        const getNowAsLocalDateTime = (): Date => {
            const now = new Date();
            return new Date(
                Date.UTC(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate(),
                    now.getHours(),
                    now.getMinutes(),
                    now.getSeconds(),
                    now.getMilliseconds()
                )
            );
        };

        const parsedCollectionTime = parseLocalDateTime(collectionTime);
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

            const nowLocal = getNowAsLocalDateTime();
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
            const needsReview = forceReview || createMeasurementsData.some((m) => isLowConfidence(m.confidence));

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
                    status: computedStatus as WaterStatus,
                    rawImageUrl: mainRawImageUrl,
                    analyzedPlotUrl: mainAnalyzedPlotUrl,
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
                    create: { sessionGroup: sessionGroupToUse, statusRequest: "pending" },
                    update: {},
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

        // 🟢 ก่อนส่ง sample กลับไป ให้ตัด Z ออกเช่นเดียวกัน
        const safeResponse = {
            ...sample,
            collectionTime: sample.collectionTime ? sample.collectionTime.toISOString().replace("Z", "") : null,
            uploadedActiveAt: sample.uploadedActiveAt ? sample.uploadedActiveAt.toISOString().replace("Z", "") : null,
        };

        return NextResponse.json(safeResponse, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/samples error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลตัวอย่างน้ำลงฐานข้อมูล", details: error?.message }, { status: 500 });
    }
}
