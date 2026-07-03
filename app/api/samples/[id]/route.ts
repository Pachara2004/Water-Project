import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard"; // 🔥 อิมพอร์ตระบบสแกนสิทธิ์ส่วนกลาง

// PUT /api/samples/[id] — อัปเดตและบันทึกประวัติข้อมูลน้ำ (เฉพาะ admin)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // 🔥 SECURITY STEP 1: ล็อกกลอนขั้นสูงสุด อนุญาตให้เฉพาะระดับสิทธิ์ "admin" ทำรายการผ่าน Token เท่านั้น
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { id } = await params;
        const sampleId = Number(id);

        const body = await request.json();
        // 🔒 ปลอดภัยขึ้น: สลัดฟิลด์ adminId ที่ส่งมาจากหน้าบ้านทิ้งไปได้เลย ใช้ auth.user จาก LINE แทน
        const { collectionTime, locationId, oxygen } = body;

        // ดึงแอดมินตัวจริงที่แกะได้จาก Token ปลอดภัยชัวร์ 100%
        const secureAdmin = auth.user!;

        // ค้นหา Record เดิมที่ต้องการปรับปรุงโครงสร้าง (พร้อมดึงข้อมูลผลสารเคมีเดิมที่มีอยู่มาด้วย)
        const oldSample = await prisma.waterSample.findUnique({
            where: { id: sampleId },
            include: {
                measurements: true,
            },
        });

        if (!oldSample || oldSample.isDeleted) {
            return NextResponse.json(
                {
                    error: "ไม่พบข้อมูลประวัติน้ำทะเลที่ระบุ หรือข้อมูลอาจถูกลบไปแล้ว",
                },
                { status: 404 },
            );
        }

        // สั่ง Soft Delete ด้วยการมาร์กสวิตช์เป็น true และผูกบันทึกรหัสแอดมินผู้กระทำ
        await prisma.waterSample.update({
            where: { id: sampleId },
            data: {
                isDeleted: true,
                lastModifiedBy: secureAdmin.id, // 🔒 ใช้ ID จริงจาก Token
            },
        });

        // คัดลอกรายการค่าวัดสารเคมีทั้งหมดจากเวอร์ชันเดิม เพื่อเตรียมชุบชีวิตใส่ตัวอย่างน้ำชุดใหม่
        const measurementsPayload = oldSample.measurements.map((m) => ({
            parameterId: m.parameterId,
            value: m.value,
        }));

        // ชุบชีวิตข้อมูลชุดใหม่เชื่อมประวัติเข้าตารางเป็นกระดานล่าสุด
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
                lastModifiedBy: secureAdmin.id, // 🔒 ใช้ ID จริงจาก Token

                // คัดลอกและสร้างข้อมูลผลสแกนรายสารพ่วงเข้าตารางย่อยผ่าน Nested Write
                measurements: {
                    create: measurementsPayload,
                },
            },
            include: {
                measurements: {
                    include: {
                        parameter: true,
                    },
                },
            },
        });

        // แปลงรูปแบบข้อมูลส่งกลับเพื่อให้โครงสร้างคีย์ฝั่ง Response ตรงตามเดิม
        let ammoniaValue: number | null = null;
        let phosphateValue: number | null = null;

        createdSample.measurements.forEach((m) => {
            if (m.parameter.name === "ammonia") ammoniaValue = m.value;
            if (m.parameter.name === "phosphate") phosphateValue = m.value;
        });

        const responsePutData = {
            id: createdSample.id,
            collectorId: createdSample.collectorId,
            locationId: createdSample.locationId,
            collectionTime: createdSample.collectionTime,
            uploadedActiveAt: createdSample.uploadedActiveAt,
            ammoniaValue: ammoniaValue,
            phosphateValue: phosphateValue,
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
        };

        return NextResponse.json(responsePutData);
    } catch (error) {
        console.error("PUT /api/samples/[id] error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการปรับปรุงและบันทึกประวัติข้อมูลน้ำ" }, { status: 500 });
    }
}

// GET /api/samples/[id] — ดึงรายละเอียดผลตรวจน้ำรายชิ้น (เฉพาะเจ้าหน้าที่และผู้บริหาร)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // 🔥 SECURITY STEP 2: ป้องกันการสุ่ม ID ส่องข้อมูลดิบรายชิ้น บล็อกให้เฉพาะเจ้าหน้าที่ในระบบเท่านั้นเข้าถึงได้
    const auth = await verifyAuth(request, ["collector", "officer", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { id } = await params;
        const sampleId = Number(id);

        const sample = await prisma.waterSample.findUnique({
            where: { id: sampleId },
            select: {
                id: true,
                collectorId: true,
                locationId: true,
                collectionTime: true,
                uploadedActiveAt: true,
                dissolvedOxygen: true,
                airTemperature: true,
                rainAccumulation: true,
                weatherCondCode: true,
                status: true,
                rawImageUrl: true,
                analyzedPlotUrl: true,
                location: {
                    select: {
                        id: true,
                        stationName: true,
                        governingAgency: true,
                        latitude: true,
                        longitude: true,
                    },
                },
                collector: {
                    select: {
                        id: true,
                        lineProfileName: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                // แก้ไขดึงค่าวัดจากตารางความสัมพันธ์ย่อยแทนคอลัมน์เก่า
                measurements: {
                    select: {
                        value: true,
                        parameter: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        if (!sample) {
            return NextResponse.json(
                {
                    error: "ไม่พบข้อมูลประวัติการส่งผลตรวจน้ำพิกัดนี้ในฐานข้อมูล",
                },
                { status: 404 },
            );
        }

        // แกะผลสารเคมีจากตารางย่อยกลับมาเป็นตัวแปรแบน (Flat) แบบดั้งเดิม
        let ammoniaValue: number | null = null;
        let phosphateValue: number | null = null;

        sample.measurements.forEach((m) => {
            if (m.parameter.name === "ammonia") ammoniaValue = m.value;
            if (m.parameter.name === "phosphate") phosphateValue = m.value;
        });

        // จัดรูปโครงสร้างก้อน Object คืนกลับไปหา Client ตัวเดิมให้ทำงานได้อย่างปกติ
        const responseGetData = {
            id: sample.id,
            collectorId: sample.collectorId,
            locationId: sample.locationId,
            collectionTime: sample.collectionTime,
            uploadedActiveAt: sample.uploadedActiveAt,
            ammoniaValue: ammoniaValue,
            phosphateValue: phosphateValue,
            dissolvedOxygen: sample.dissolvedOxygen,
            airTemperature: sample.airTemperature,
            rainAccumulation: sample.rainAccumulation,
            weatherCondCode: sample.weatherCondCode,
            status: sample.status,
            rawImageUrl: sample.rawImageUrl,
            analyzedPlotUrl: sample.analyzedPlotUrl,
            location: sample.location,
            collector: sample.collector,
        };

        return NextResponse.json(responseGetData);
    } catch (error) {
        console.error("GET /api/samples/[id] error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดผลตรวจน้ำ" }, { status: 500 });
    }
}
