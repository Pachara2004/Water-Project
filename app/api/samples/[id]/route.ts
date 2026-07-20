import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

type WaterStatus = "safe" | "warning" | "danger";

// ========================================================
// 📝 PUT /api/samples/[id] — ปรับปรุงประวัติน้ำแบบผูกสืบทอดกลุ่มรหัสเซสชัน
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
            const candidate = new Date(collectionTime);
            if (Number.isNaN(candidate.getTime())) {
                return NextResponse.json({ error: "รูปแบบวันที่และเวลาที่เก็บตัวอย่างไม่ถูกต้อง" }, { status: 400 });
            }
            parsedCollectionTime = candidate;
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

        let finalMeasurementsPayload: Array<{ parameterId: number; value: number; confidence: number; boundingBox?: string | null; message?: string | null }> = [];

        if (measurements && Array.isArray(measurements)) {
            finalMeasurementsPayload = measurements.map((m: any) => ({
                parameterId: Number(m.parameterId),
                value: parseFloat(m.value || "0"),
                confidence: parseFloat(oldSample.measurements[0]?.confidence || "0.90"),
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

        const createdSample = await prisma.$transaction(async (tx) => {
            await tx.waterSample.update({
                where: { id: sampleId },
                data: {
                    isDeleted: true,
                    lastModifiedBy: secureAdmin.id,
                },
            });

            return tx.waterSample.create({
                data: {
                    // 🌟 สืบทอด code เดิมไว้ (หรือจะปล่อยให้สร้างใหม่ขึ้นอยู่กับเคส)
                    code: oldSample.code,
                    collectorId: oldSample.collectorId,
                    locationId: parsedLocationId,
                    collectionTime: parsedCollectionTime,
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

        const responsePutData = {
            id: createdSample.id,
            code: createdSample.code, // [NEW] แนบ code ส่งออกไปใน PUT Response
            collectorId: createdSample.collectorId,
            locationId: createdSample.locationId,
            collectionTime: createdSample.collectionTime,
            uploadedActiveAt: createdSample.uploadedActiveAt,
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
            updatedActiveAt: createdSample.updatedActiveAt,
            sessionGroup: createdSample.sessionGroup,
            measurements: createdSample.measurements,

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
// 🔍 GET /api/samples/[id] — ดึงรายละเอียดผลตรวจน้ำพร้อมควบรวมรูปภาพแยกตาม Parameter ID
// ========================================================
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAuth(request, ["collector", "officer", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { id } = await params;
        const sampleId = Number(id);

        const mainSample = await prisma.waterSample.findUnique({
            where: { id: sampleId },
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
        });

        if (!mainSample || mainSample.isDeleted) {
            return NextResponse.json({ error: "ไม่พบข้อมูลประวัติการส่งผลตรวจน้ำพิกัดนี้ในฐานข้อมูล" }, { status: 404 });
        }

        if (auth.user!.roleName === "collector" && mainSample.collectorId !== auth.user!.id) {
            return NextResponse.json({ error: "ไม่พบข้อมูลประวัติการส่งผลตรวจน้ำพิกัดนี้ในฐานข้อมูล" }, { status: 404 });
        }

        let allMeasurements = [...mainSample.measurements];

        const sampleImagesMap: Record<number, { raw: string | null; plot: string | null }> = {};
        sampleImagesMap[mainSample.id] = {
            raw: mainSample.rawImageUrl,
            plot: mainSample.analyzedPlotUrl,
        };

        if (mainSample.sessionGroup) {
            const partnerSamples = await prisma.waterSample.findMany({
                where: {
                    sessionGroup: mainSample.sessionGroup,
                    id: { not: sampleId },
                    isDeleted: false,
                },
                include: {
                    measurements: {
                        include: { parameter: true },
                    },
                },
            });

            partnerSamples.forEach((ps) => {
                allMeasurements.push(...ps.measurements);
                sampleImagesMap[ps.id] = {
                    raw: ps.rawImageUrl,
                    plot: ps.analyzedPlotUrl,
                };
            });
        }

        const dynamicMeasurements: Record<string, number> = {};
        allMeasurements.forEach((m: any) => {
            if (m.parameter?.name) {
                dynamicMeasurements[`${m.parameter.name.toLowerCase()}Value`] = m.value;
            }
        });

        const responseGetData = {
            id: mainSample.id,
            code: mainSample.code, // [NEW] แนบ code ส่งออกไปใน GET Response ให้หน้าบ้านนำไปโชว์ที่ Header
            collectorId: mainSample.collectorId,
            locationId: mainSample.locationId,
            collectionTime: mainSample.collectionTime,
            uploadedActiveAt: mainSample.uploadedActiveAt,
            dissolvedOxygen: mainSample.dissolvedOxygen,
            airTemperature: mainSample.airTemperature,
            rainAccumulation: mainSample.rainAccumulation,
            weatherCondCode: mainSample.weatherCondCode,
            status: mainSample.status,
            rawImageUrl: mainSample.rawImageUrl,
            analyzedPlotUrl: mainSample.analyzedPlotUrl,
            sessionGroup: mainSample.sessionGroup,
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
