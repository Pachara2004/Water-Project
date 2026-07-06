import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

// ========================================================
// 📝 PUT /api/samples/[id] — ปรับปรุงและชุบชีวิตประวัติน้ำแบบ Dynamic 100%
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
        // 💡 measurements ที่ส่งมาควรรองรับรูปแบบ Array: [{ parameterId: 4, value: 0.5 }, ...]

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
        let finalMeasurementsPayload: Array<{ parameterId: number; value: number }> = [];

        if (measurements && Array.isArray(measurements)) {
            // ถ้าน้าบ้านส่งค่าใหม่มาแบบกลุ่ม ให้ใช้ชุดใหม่
            finalMeasurementsPayload = measurements.map((m: any) => ({
                parameterId: Number(m.parameterId),
                value: parseFloat(m.value || "0"),
            }));
        } else {
            // ถ้าหน้าบ้านไม่ได้ส่งค่าชุดใหม่มา ให้สืบทอดค่าวัดเดิมจากเวอร์ชันเก่าไปเลยแบบ Dynamic
            finalMeasurementsPayload = oldSample.measurements.map((m) => ({
                parameterId: m.parameterId,
                value: m.value,
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
                rawImageUrl: oldSample.rawImageUrl,
                analyzedPlotUrl: oldSample.analyzedPlotUrl,
                imageExpiresAt: oldSample.imageExpiresAt,
                isDeleted: false,
                lastModifiedBy: secureAdmin.id,

                // บันทึกความสัมพันธ์ลงตารางเชื่อมแบบ Dynamic ตาม Payload
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

            // สาดก้อนข้อมูลสารเคมีทั้งหมดที่ได้จาก DB ไปหาหน้าบ้าน
            ...dynamicMeasurements,

            // ล็อค Fallback คีย์เดิมกันระบบหน้าบ้านเวอร์ชันเก่าแครช
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
// 🔍 GET /api/samples/[id] — ดึงรายละเอียดผลตรวจน้ำรายชิ้นแบบ Dynamic
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

        const sample = await prisma.waterSample.findUnique({
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

        if (!sample || sample.isDeleted) {
            return NextResponse.json({ error: "ไม่พบข้อมูลประวัติการส่งผลตรวจน้ำพิกัดนี้ในฐานข้อมูล" }, { status: 404 });
        }

        // ⚡️ วนลูปแตกกิ่งข้อมูลพารามิเตอร์ทุกตัวที่มีอยู่ใน Database คืนสู่ Client
        const dynamicMeasurements: Record<string, number> = {};
        sample.measurements.forEach((m: any) => {
            if (m.parameter?.name) {
                dynamicMeasurements[`${m.parameter.name.toLowerCase()}Value`] = m.value;
            }
        });

        const responseGetData = {
            id: sample.id,
            collectorId: sample.collectorId,
            locationId: sample.locationId,
            collectionTime: sample.collectionTime,
            uploadedActiveAt: sample.uploadedActiveAt,
            dissolvedOxygen: sample.dissolvedOxygen,
            airTemperature: sample.airTemperature,
            rainAccumulation: sample.rainAccumulation,
            weatherCondCode: sample.weatherCondCode,
            status: sample.status,
            rawImageUrl: sample.rawImageUrl,
            analyzedPlotUrl: sample.analyzedPlotUrl,
            location: sample.location
                ? {
                      id: sample.location.id,
                      stationName: sample.location.stationName,
                      governingAgency: sample.location.governingAgency,
                      latitude: sample.location.latitude,
                      longitude: sample.location.longitude,
                  }
                : null,
            collector: sample.collector,

            // แนบก้อนผลลัพธ์สารแบบ Dynamic
            ...dynamicMeasurements,

            // เผื่อระบบเก่าเรียกใช้
            ammoniaValue: dynamicMeasurements["ammoniaValue"] ?? null,
            phosphateValue: dynamicMeasurements["phosphateValue"] ?? null,
        };

        return NextResponse.json(responseGetData);
    } catch (error) {
        console.error("GET /api/samples/[id] error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดผลตรวจน้ำ" }, { status: 500 });
    }
}
