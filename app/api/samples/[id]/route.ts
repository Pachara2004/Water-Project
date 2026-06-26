import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const sampleId = Number(id);

        const body = await request.json();
        const { collectionTime, locationId, oxygen, adminId } = body;

        // ตรวจสอบสิทธิ์ผู้ดูแลระบบสูงสุด
        const admin = await prisma.user.findUnique({
            where: { id: Number(adminId) },
            include: { systemRole: true },
        });

        if (!admin || admin.systemRole.roleName !== "admin") {
            return NextResponse.json(
                {
                    error: "สิทธิ์การเข้าถึงระบบไม่ถูกต้อง เฉพาะผู้ดูแลระบบเท่านั้น",
                },
                { status: 403 },
            );
        }

        // ค้นหา Record เดิมที่ต้องการปรับปรุงโครงสร้าง
        const oldSample = await prisma.waterSample.findUnique({
            where: { id: sampleId },
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
                lastModifiedBy: admin.id,
            },
        });

        // ชุบชีวิตข้อมูลชุดใหม่เชื่อมประวัติเข้าตารางเป็นกระดานล่าสุด
        const createdSample = await prisma.waterSample.create({
            data: {
                collectorId: oldSample.collectorId,
                locationId: locationId ? Number(locationId) : oldSample.locationId,
                collectionTime: collectionTime ? new Date(collectionTime) : oldSample.collectionTime,
                ammoniaValue: oldSample.ammoniaValue,
                phosphateValue: oldSample.phosphateValue,
                dissolvedOxygen: oxygen !== undefined ? (oxygen === null || oxygen === "" ? null : parseFloat(oxygen)) : oldSample.dissolvedOxygen,
                airTemperature: oldSample.airTemperature,
                rainAccumulation: oldSample.rainAccumulation,
                weatherCondCode: oldSample.weatherCondCode,
                status: oldSample.status,
                rawImageUrl: oldSample.rawImageUrl,
                analyzedPlotUrl: oldSample.analyzedPlotUrl,
                imageExpiresAt: oldSample.imageExpiresAt,
                isDeleted: false,
                lastModifiedBy: admin.id,
            },
        });

        return NextResponse.json(createdSample);
    } catch (error) {
        console.error("PUT /api/samples/[id] error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการปรับปรุงและบันทึกประวัติข้อมูลน้ำ" }, { status: 500 });
    }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
                ammoniaValue: true,
                phosphateValue: true,
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

        return NextResponse.json(sample);
    } catch (error) {
        console.error("GET /api/samples/[id] error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดผลตรวจน้ำ" }, { status: 500 });
    }
}
