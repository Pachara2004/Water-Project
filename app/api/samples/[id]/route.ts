import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

type WaterStatus = "safe" | "warning" | "danger";

// ========================================================
// 📝 PUT /api/samples/[id] — ปรับปรุงประวัติน้ำแบบผูกสืบทอดกลุ่มรหัสเซสชัน
// ========================================================
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // 🔥 SECURITY STEP 1: อนุญาตให้เฉพาะระดับสิทธิ์ "admin" เท่านั้น
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

        // ค้นหา Record เดิมพร้อมดึงประวัติการตรวจวัดสารทั้งหมด
        const oldSample = await prisma.waterSample.findUnique({
            where: { id: sampleId },
            include: { measurements: true },
        });

        if (!oldSample || oldSample.isDeleted) {
            return NextResponse.json({ error: "ไม่พบข้อมูลประวัติน้ำทะเลที่ระบุ หรือข้อมูลอาจถูกลบไปแล้ว" }, { status: 404 });
        }

        // 1. สั่ง Soft Delete เวอร์ชันเก่าทิ้งไป มาร์กสวิตช์เป็น true
        await prisma.waterSample.update({
            where: { id: sampleId },
            data: {
                isDeleted: true,
                lastModifiedBy: secureAdmin.id,
            },
        });

        // 2. จัดการ Payload ผลตรวจสารเคมีตัวใหม่
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
            // ถ้าหน้าบ้านไม่ได้ส่งค่าชุดใหม่มา ให้สืบทอดค่าวัดเดิมจากเวอร์ชันเก่าไปเลยแบบครบถ้วนทุกฟิลด์
            finalMeasurementsPayload = oldSample.measurements.map((m) => ({
                parameterId: m.parameterId,
                value: m.value,
                confidence: m.confidence,
                boundingBox: m.boundingBox,
                message: m.message,
            }));
        }

        // 3. ชุบชีวิตสร้าง Record ตัวแทนตัวใหม่ขึ้นมา
        const createdSample = await prisma.waterSample.create({
            data: {
                collectorId: oldSample.collectorId,
                locationId: locationId ? Number(locationId) : oldSample.locationId,
                collectionTime: collectionTime ? new Date(collectionTime) : oldSample.collectionTime,
                dissolvedOxygen: oxygen !== undefined ? (oxygen === null || oxygen === "" ? null : parseFloat(oxygen)) : oldSample.dissolvedOxygen,
                airTemperature: oldSample.airTemperature,
                rainAccumulation: oldSample.rainAccumulation,
                weatherCondCode: oldSample.weatherCondCode,
                status: oldSample.status,

                // 🌟 สืบทอดรหัสกลุ่มประจำเซสชันตามไปด้วยเพื่อไม่ให้กลุ่มแตกแยกแถวกันครับบอส!
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

        // 4. แตกคีย์พ่นผลลัพธ์สารเคมีออกไปหา Client แบบ Dynamic Flattening
        const dynamicMeasurements: Record<string, number> = {};
        createdSample.measurements.forEach((m: any) => {
            if (m.parameter?.name) {
                dynamicMeasurements[`${m.parameter.name.toLowerCase()}Value`] = m.value;
            }
        });

        const responsePutData = {
            id: createdSample.id,
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
    // 🔥 SECURITY STEP 2: บล็อกให้เฉพาะบุคลากรในระบบที่มี Token สิทธิ์เท่านั้นเข้าถึงได้
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

        // collector ดูได้เฉพาะของตัวเองเท่านั้น (กัน IDOR — เดา/พิมพ์ ID คนอื่นแล้วเปิดดูได้)
        // admin/officer เป็นสิทธิ์อ่านทุกคนอยู่แล้วตามที่ตั้งใจ ไม่ต้องเช็คเจ้าของ
        if (auth.user!.roleName === "collector" && mainSample.collectorId !== auth.user!.id) {
            return NextResponse.json({ error: "ไม่พบข้อมูลประวัติการส่งผลตรวจน้ำพิกัดนี้ในฐานข้อมูล" }, { status: 404 });
        }

        let allMeasurements = [...mainSample.measurements];

        // 🌟 สร้างแผนผังสำหรับผูกเก็บ URL รูปภาพแยกตามไอดีสารเคมี (Parameter ID)
        const paramImagesMap: Record<number, { raw: string | null; plot: string | null }> = {};

        // แนบรูปภาพของสารเคมีตัวแรก (แถวหลักประจำเซสชันนี้) ลงแผนผังก่อน
        if (mainSample.measurements[0]) {
            paramImagesMap[mainSample.measurements[0].parameterId] = {
                raw: mainSample.rawImageUrl,
                plot: mainSample.analyzedPlotUrl,
            };
        }

        // 🔍 ขุดค้นหาเรคคอร์ดสารเคมีตัวอื่น ๆ ที่ถือเลข sessionGroup เดียวกันรอบเซสชันนี้
        if (mainSample.sessionGroup) {
            const partnerSamples = await prisma.waterSample.findMany({
                where: {
                    sessionGroup: mainSample.sessionGroup,
                    id: { not: sampleId }, // ไม่เอาตัวซ้ำเดิมที่คิวรีแล้ว
                    isDeleted: false,
                },
                include: {
                    measurements: {
                        include: { parameter: true },
                    },
                },
            });

            // ทำการหลอมรวมค่าวัด และดึงไฟล์ภาพจากเรคคอร์ดคู่ขนานมาผูกแยกราย Parameter ID
            partnerSamples.forEach((ps) => {
                allMeasurements.push(...ps.measurements);

                if (ps.measurements[0]) {
                    paramImagesMap[ps.measurements[0].parameterId] = {
                        raw: ps.rawImageUrl,
                        plot: ps.analyzedPlotUrl,
                    };
                }
            });
        }

        // วนลูปแตกกิ่งข้อมูลพารามิเตอร์ทุกตัวคืนสู่ Client แบบแบนราบ
        const dynamicMeasurements: Record<string, number> = {};
        allMeasurements.forEach((m: any) => {
            if (m.parameter?.name) {
                dynamicMeasurements[`${m.parameter.name.toLowerCase()}Value`] = m.value;
            }
        });

        const responseGetData = {
            id: mainSample.id,
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

            // 🌟 พ่วงส่งแผนผังรูปภาพแยกรายสารเคมีตัวนี้ออกไปให้หน้าบ้านด้วยครับบอส!
            paramImagesMap: paramImagesMap,

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
