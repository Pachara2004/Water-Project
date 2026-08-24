import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { evaluateSample, computeValueByParameterAsOf } from "@/lib/standards";
import { loadAllStandards } from "@/lib/standards-db";
import { getPendingSessionGroups } from "@/lib/review";

// ฟังก์ชันสร้าง Date เวลาปัจจุบันแบบล็อกตัวเลขเวลาไทย (+07:00)
function getNowAsLocalDateTime(): Date {
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
}

// ฟังก์ชันช่วยตัด Z หรือ Timezone Offset ออกเพื่อป้องกัน Frontend บวก 7 ชั่วโมงซ้ำ
function cleanDateString(dateVal: any): string | null {
    if (!dateVal) return null;
    if (dateVal instanceof Date) {
        return dateVal.toISOString().replace("Z", "");
    }
    return String(dateVal).replace(/(Z|\+\d{2}:\d{2})$/, "");
}

// ========================================================
// PUT /api/samples/[id] — ปรับปรุงประวัติน้ำแบบผูกสืบทอดกลุ่มรหัสเซสชัน
// ========================================================
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { id } = await params;
        const sampleId = Number(id);

        const body = await request.json();
        const { collectionTime, locationId, oxygen, measurements } = body;

        const secureAdmin = auth.user!;

        const oldSample = await prisma.waterSample.findUnique({
            where: { id: sampleId },
            include: { measurements: true },
        });

        if (!oldSample || oldSample.isDeleted) {
            return NextResponse.json({ error: "ไม่พบข้อมูลประวัติน้ำทะเลที่ระบุ หรือข้อมูลอาจถูกลบไปแล้ว" }, { status: 404 });
        }

        let parsedCollectionTime = oldSample.collectionTime;
        if (collectionTime !== undefined && collectionTime !== null && collectionTime !== "") {
            const cleanStr = String(collectionTime).replace(/(Z|\+\d{2}:\d{2})$/, "");
            const [datePart, timePart] = cleanStr.split("T");
            const [year, month, day] = datePart.split("-").map(Number);
            const [hours, minutes] = timePart.split(":").map(Number);
            parsedCollectionTime = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
        }

        let parsedLocationId = oldSample.locationId;
        if (locationId !== undefined && locationId !== null && locationId !== "") {
            const candidate = Number(locationId);
            if (!Number.isInteger(candidate) || candidate <= 0) {
                return NextResponse.json({ error: "รหัสสถานีไม่ถูกต้อง" }, { status: 400 });
            }
            const locationExists = await prisma.location.findUnique({ where: { id: candidate }, select: { id: true } });
            if (!locationExists) {
                return NextResponse.json({ error: "ไม่พบสถานีที่ระบุในระบบ" }, { status: 400 });
            }
            parsedLocationId = candidate;
        }

        let parsedOxygen = oldSample.dissolvedOxygen;
        if (oxygen !== undefined) {
            if (oxygen === null || oxygen === "") {
                parsedOxygen = null;
            } else {
                const candidate = Number(oxygen);
                if (!Number.isFinite(candidate)) {
                    return NextResponse.json({ error: "ค่าออกซิเจนละลายน้ำต้องเป็นตัวเลข" }, { status: 400 });
                }
                parsedOxygen = candidate;
            }
        }

        let finalMeasurementsPayload: Array<{ parameterId: number; value: number; confidence: number; boundingBox?: any; message?: string | null }> = [];

        if (measurements && Array.isArray(measurements)) {
            finalMeasurementsPayload = measurements.map((m: any) => ({
                parameterId: Number(m.parameterId),
                value: parseFloat(m.value || "0"),
                confidence: oldSample.measurements[0]?.confidence ?? 0.90,
                boundingBox: oldSample.measurements[0]?.boundingBox || null,
                message: oldSample.measurements[0]?.message || null,
            }));
        } else {
            finalMeasurementsPayload = oldSample.measurements.map((m) => ({
                parameterId: m.parameterId,
                value: m.value,
                confidence: m.confidence,
                boundingBox: m.boundingBox,
                message: m.message,
            }));
        }

        const nowLocal = getNowAsLocalDateTime();

        const createdSample = await prisma.$transaction(async (tx) => {
            await tx.waterSample.update({
                where: { id: sampleId },
                data: {
                    isDeleted: true,
                    lastModifiedBy: secureAdmin.id,
                    updatedActiveAt: nowLocal,
                },
            });

            return tx.waterSample.create({
                data: {
                    code: oldSample.code,
                    collectorId: oldSample.collectorId,
                    locationId: parsedLocationId,
                    collectionTime: parsedCollectionTime,
                    uploadedActiveAt: oldSample.uploadedActiveAt,
                    updatedActiveAt: nowLocal,
                    dissolvedOxygen: parsedOxygen,
                    airTemperature: oldSample.airTemperature,
                    rainAccumulation: oldSample.rainAccumulation,
                    weatherCondCode: oldSample.weatherCondCode,
                    status: oldSample.status,
                    sessionGroup: oldSample.sessionGroup,

                    rawImageUrl: oldSample.rawImageUrl,
                    analyzedPlotUrl: oldSample.analyzedPlotUrl,
                    imageExpiresAt: oldSample.imageExpiresAt,
                    isDeleted: false,
                    lastModifiedBy: secureAdmin.id,

                    measurements: {
                        create: finalMeasurementsPayload,
                    },
                },
                include: {
                    measurements: {
                        include: { parameter: true },
                    },
                },
            });
        });

        const dynamicMeasurements: Record<string, number> = {};
        createdSample.measurements.forEach((m: any) => {
            if (m.parameter?.name) {
                dynamicMeasurements[`${m.parameter.name.toLowerCase()}Value`] = m.value;
            }
        });

        // ตรวจสอบสถานะ Review Request ของ sessionGroup
        const pendingGroups = await getPendingSessionGroups();
        const isPending = createdSample.sessionGroup ? pendingGroups.includes(createdSample.sessionGroup) : false;

        const responsePutData = {
            id: createdSample.id,
            code: createdSample.code,
            collectorId: createdSample.collectorId,
            locationId: createdSample.locationId,
            collectionTime: cleanDateString(createdSample.collectionTime),
            uploadedActiveAt: cleanDateString(createdSample.uploadedActiveAt),
            updatedActiveAt: cleanDateString(createdSample.updatedActiveAt),
            dissolvedOxygen: createdSample.dissolvedOxygen,
            airTemperature: createdSample.airTemperature,
            rainAccumulation: createdSample.rainAccumulation,
            weatherCondCode: createdSample.weatherCondCode,
            status: createdSample.status,
            rawImageUrl: createdSample.rawImageUrl,
            analyzedPlotUrl: createdSample.analyzedPlotUrl,
            imageExpiresAt: createdSample.imageExpiresAt,
            isDeleted: createdSample.isDeleted,
            lastModifiedBy: createdSample.lastModifiedBy,
            sessionGroup: createdSample.sessionGroup,
            measurements: createdSample.measurements,

            // แนบ reviewStatus ส่งออกไป
            reviewStatus: isPending ? "PENDING" : "APPROVED",

            ...dynamicMeasurements,

            ammoniaValue: dynamicMeasurements["ammoniaValue"] ?? null,
            phosphateValue: dynamicMeasurements["phosphateValue"] ?? null,
        };

        return NextResponse.json(responsePutData);
    } catch (error) {
        console.error("PUT /api/samples/[id] error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการปรับปรุงและบันทึกประวัติข้อมูลน้ำ" }, { status: 500 });
    }
}

// ========================================================
// GET /api/samples/[id] — ดึงรายละเอียดผลตรวจน้ำพร้อมควบรวมรูปภาพแยกตาม Parameter ID
// ========================================================
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAuth(request, ["collector", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { id } = await params;
        
        const pendingGroups = await getPendingSessionGroups();
        const isPendingParam = pendingGroups.includes(id);
        
        // 1. ลองค้นหาใน SampleRecord ก่อน (ถ้าไม่ใช่สถานะ Pending)
        const isNumeric = !isNaN(Number(id));
        let sampleRecord = null;
        
        if (!isPendingParam) {
            sampleRecord = await prisma.sampleRecord.findFirst({
                where: {
                    OR: [
                        { code: id },
                        ...(isNumeric ? [{ id: Number(id) }] : [])
                    ],
                    isDeleted: false
                },
                orderBy: { id: "desc" },
            });
        }

        if (sampleRecord) {
            let allMeasurements: any[] = [];
            let sampleImagesMap: Record<number, { raw: string | null; plot: string | null }> = {};
            
            if (sampleRecord.parameterData && Array.isArray(sampleRecord.parameterData)) {
                sampleRecord.parameterData.forEach((m: any, index: number) => {
                    const paramId = m.parameterId || index;
                    allMeasurements.push({
                        sampleId: paramId,
                        parameterId: paramId,
                        parameter: { id: paramId, name: m.parameterName || "unknown" },
                        value: m.value,
                        confidence: m.confidence || 0.9,
                    });
                });
            }

            let rawImageUrl = null;
            let analyzedPlotUrl = null;
            if (sampleRecord.imageUrl && typeof sampleRecord.imageUrl === 'object') {
                const imgData = sampleRecord.imageUrl as any;
                if (imgData.rawImageUrls && imgData.rawImageUrls.length > 0) rawImageUrl = imgData.rawImageUrls[0];
                if (imgData.plotImageUrls && imgData.plotImageUrls.length > 0) analyzedPlotUrl = imgData.plotImageUrls[0];
                
                // สำหรับ history page (รองรับ multiple images per parameter ถ้าทำได้ แต่ตอนนี้ mapping ง่ายๆ ก่อน)
                allMeasurements.forEach((m) => {
                    sampleImagesMap[m.sampleId] = {
                        raw: rawImageUrl,
                        plot: analyzedPlotUrl
                    };
                });
            }

            const sampleLocationId = sampleRecord.locationNameCurrentId;
            const sampleCollectionTime = sampleRecord.collectionTime;
            const baseLocationSampleWhere: any = { locationId: sampleLocationId, isDeleted: false };
            if (pendingGroups.length > 0) {
                baseLocationSampleWhere.OR = [{ sessionGroup: null }, { sessionGroup: { notIn: pendingGroups } }];
            }
            const locationSampleSelect = {
                collectionTime: true,
                measurements: { select: { value: true, parameterId: true, parameter: { select: { name: true } } } },
            };
            const [beforeOrAtSamples, afterSamples] = await Promise.all([
                prisma.waterSample.findMany({
                    where: { ...baseLocationSampleWhere, collectionTime: { lte: sampleCollectionTime } },
                    orderBy: { collectionTime: "desc" },
                    take: 50,
                    select: locationSampleSelect,
                }),
                prisma.waterSample.findMany({
                    where: { ...baseLocationSampleWhere, collectionTime: { gt: sampleCollectionTime } },
                    orderBy: { collectionTime: "asc" },
                    take: 50,
                    select: locationSampleSelect,
                }),
            ]);
            const latestByParameter = computeValueByParameterAsOf(beforeOrAtSamples, afterSamples);
            const locationStandards = await loadAllStandards();
            const locationStatus =
                latestByParameter.length > 0
                    ? evaluateSample(
                          latestByParameter.map((m) => ({ parameterId: m.parameterId, value: m.value })),
                          locationStandards,
                      )
                    : null;

            const reviewReq = await prisma.reviewRequest.findUnique({ where: { sessionGroup: sampleRecord.code } });

            const responseGetData = {
                id: sampleRecord.id,
                code: sampleRecord.code,
                collectorId: sampleRecord.collectorNameCurrentId,
                locationId: sampleRecord.locationNameCurrentId,
                collectionTime: cleanDateString(sampleRecord.collectionTime),
                uploadedActiveAt: cleanDateString(sampleRecord.uploadedActiveAt),
                updatedActiveAt: cleanDateString(sampleRecord.uploadedActiveAt),
                dissolvedOxygen: sampleRecord.dissolvedOxygen,
                airTemperature: sampleRecord.airTemperature,
                rainAccumulation: sampleRecord.rainAccumulation,
                weatherCondCode: sampleRecord.weatherCondCode,
                status: sampleRecord.status,
                rawImageUrl: rawImageUrl,
                analyzedPlotUrl: analyzedPlotUrl,
                sessionGroup: sampleRecord.code,
                reviewStatus: reviewReq?.statusRequest === "edited_approved" ? "EDITED_APPROVED" : "APPROVED",
                
                locationStatus,
                latestByParameter: latestByParameter.map((item: any) => ({
                    ...item,
                    collectedAt: cleanDateString(item.collectedAt || item.collectionTime),
                    collectionTime: cleanDateString(item.collectionTime || item.collectedAt),
                })),
                
                location: {
                    id: sampleRecord.locationNameCurrentId,
                    stationName: sampleRecord.locationNameFrom,
                    governingAgency: "-",
                    latitude: 0,
                    longitude: 0,
                },
                collector: {
                    id: sampleRecord.collectorNameCurrentId,
                    lineProfileName: sampleRecord.collectorNameFrom,
                },
                measurements: allMeasurements,
                sampleImagesMap: sampleImagesMap,
            };
            return NextResponse.json(responseGetData);
        }

        // 2. ถ้าไม่พบใน SampleRecord ให้มาค้นใน WaterSample (สำหรับ Pending หรือ Rejected)
        const sampleIdNum = Number(id);
        const mainSample = await prisma.waterSample.findFirst({
            where: {
                OR: [
                    { sessionGroup: id },
                    ...(!isNaN(sampleIdNum) ? [{ id: sampleIdNum }] : [])
                ],
            },
            include: {
                location: true,
                collector: {
                    select: {
                        id: true,
                        lineProfileName: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                measurements: {
                    include: { parameter: true },
                },
            },
            orderBy: { id: "desc" }
        });

        const reviewReq = await prisma.reviewRequest.findUnique({
            where: { sessionGroup: mainSample.sessionGroup ?? "" },
            select: { statusRequest: true }
        });
        const isRejected = reviewReq?.statusRequest === "rejected";

        if (!mainSample || (mainSample.isDeleted && !isRejected)) {
            return NextResponse.json({ error: "ไม่พบข้อมูลประวัติการส่งผลตรวจน้ำพิกัดนี้ในฐานข้อมูล" }, { status: 404 });
        }

        if (auth.user!.roleName === "collector" && mainSample.collectorId !== auth.user!.id) {
            return NextResponse.json({ error: "ไม่พบข้อมูลประวัติการส่งผลตรวจน้ำพิกัดนี้ในฐานข้อมูล" }, { status: 404 });
        }

        let allMeasurements: any[] = [];
        const sampleImagesMap: Record<number, { raw: string | null; plot: string | null }> = {};

        if (mainSample.sessionGroup) {
            const allGroupSamples = await prisma.waterSample.findMany({
                where: { sessionGroup: mainSample.sessionGroup },
                orderBy: { id: "asc" },
                include: {
                    measurements: {
                        include: { parameter: true },
                    },
                },
            });

            const measMap = new Map<number, any>();
            allGroupSamples.forEach((s) => {
                s.measurements.forEach((m) => {
                    measMap.set(m.parameterId, m);
                });
                sampleImagesMap[s.id] = {
                    raw: s.rawImageUrl,
                    plot: s.analyzedPlotUrl,
                };
            });
            allMeasurements = Array.from(measMap.values());
        } else {
            allMeasurements = [...mainSample.measurements];
            sampleImagesMap[mainSample.id] = {
                raw: mainSample.rawImageUrl,
                plot: mainSample.analyzedPlotUrl,
            };
        }

        const dynamicMeasurements: Record<string, number> = {};
        allMeasurements.forEach((m: any) => {
            if (m.parameter?.name) {
                dynamicMeasurements[`${m.parameter.name.toLowerCase()}Value`] = m.value;
            }
        });

        const baseLocationSampleWhere: any = { locationId: mainSample.locationId, isDeleted: false };
        if (pendingGroups.length > 0) {
            baseLocationSampleWhere.OR = [{ sessionGroup: null }, { sessionGroup: { notIn: pendingGroups } }];
        }
        const locationSampleSelect = {
            collectionTime: true,
            measurements: { select: { value: true, parameterId: true, parameter: { select: { name: true } } } },
        };
        const [beforeOrAtSamples, afterSamples] = await Promise.all([
            prisma.waterSample.findMany({
                where: { ...baseLocationSampleWhere, collectionTime: { lte: mainSample.collectionTime } },
                orderBy: { collectionTime: "desc" },
                take: 50,
                select: locationSampleSelect,
            }),
            prisma.waterSample.findMany({
                where: { ...baseLocationSampleWhere, collectionTime: { gt: mainSample.collectionTime } },
                orderBy: { collectionTime: "asc" },
                take: 50,
                select: locationSampleSelect,
            }),
        ]);
        const latestByParameter = computeValueByParameterAsOf(beforeOrAtSamples, afterSamples);
        const locationStandards = await loadAllStandards();
        const locationStatus =
            latestByParameter.length > 0
                ? evaluateSample(
                      latestByParameter.map((m) => ({ parameterId: m.parameterId, value: m.value })),
                      locationStandards,
                  )
                : null;

        // ตรวจสอบสถานะ Review Request ของ sessionGroup
        const isPending = mainSample.sessionGroup ? pendingGroups.includes(mainSample.sessionGroup) : false;

        const responseGetData = {
            id: mainSample.id,
            code: mainSample.code,
            collectorId: mainSample.collectorId,
            locationId: mainSample.locationId,
            collectionTime: cleanDateString(mainSample.collectionTime),
            uploadedActiveAt: cleanDateString(mainSample.uploadedActiveAt),
            updatedActiveAt: cleanDateString(mainSample.updatedActiveAt),
            dissolvedOxygen: mainSample.dissolvedOxygen,
            airTemperature: mainSample.airTemperature,
            rainAccumulation: mainSample.rainAccumulation,
            weatherCondCode: mainSample.weatherCondCode,
            status: mainSample.status,
            rawImageUrl: mainSample.rawImageUrl,
            analyzedPlotUrl: mainSample.analyzedPlotUrl,
            sessionGroup: mainSample.sessionGroup,

            // 🟢 แนบ reviewStatus ให้หน้าประวัติใช้งาน
            reviewStatus: isRejected ? "REJECTED" : (reviewReq?.statusRequest === "edited_approved" ? "EDITED_APPROVED" : (isPending ? "PENDING" : "APPROVED")),

            location: mainSample.location
                ? {
                      id: mainSample.location.id,
                      stationName: mainSample.location.stationName,
                      governingAgency: mainSample.location.governingAgency,
                      latitude: mainSample.location.latitude,
                      longitude: mainSample.location.longitude,
                  }
                : null,
            collector: mainSample.collector,
            measurements: allMeasurements,
            sampleImagesMap: sampleImagesMap,

            locationStatus,
            latestByParameter: latestByParameter.map((item: any) => ({
                ...item,
                collectedAt: cleanDateString(item.collectedAt || item.collectionTime),
                collectionTime: cleanDateString(item.collectionTime || item.collectedAt),
            })),

            ...dynamicMeasurements,

            ammoniaValue: dynamicMeasurements["ammoniaValue"] ?? null,
            phosphateValue: dynamicMeasurements["phosphateValue"] ?? null,
        };

        return NextResponse.json(responseGetData);
    } catch (error) {
        console.error("GET /api/samples/[id] error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดผลตรวจน้ำ" }, { status: 500 });
    }
}
