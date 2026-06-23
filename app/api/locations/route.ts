import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ฟังก์ชันภายในช่วยแกะสิทธิ์ผู้ใช้งานจากคุกกี้ระบบ
async function getAuthenticatedUser(request: NextRequest) {
    const id = request.headers.get("x-user-id");
    const role = request.headers.get("x-user-role");

    if (!id || !role) return null;

    return { id, role }; // ส่งวัตถุกลับไปให้เช็กเงื่อนไขด้านล่างต่อ
}

// GET /api/locations — List all locations with optional agency filter
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const orgFilter = searchParams.get("org");

        const where =
            orgFilter && orgFilter !== "ALL" ? { agency: orgFilter } : {};

        const locations = await prisma.location.findMany({
            where,
            include: {
                samples: {
                    orderBy: { collectionTime: "desc" },
                    take: 10,
                    select: {
                        id: true,
                        status: true,
                        phosphate: true,
                        ammonia: true,
                        collectionTime: true,
                        oxygen: true,
                        temperature: true,
                        rainVolume: true,
                        weatherCondition: true,
                        collector: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                            },
                        },
                    },
                },
            },
        });

        // Transform database schema to fit standard frontend payload structure
        const result = locations.map((loc) => {
            const mappedSamples = loc.samples.map((s) => ({
                id: s.id,
                status: s.status,
                phosphateVal: s.phosphate,
                ammoniaVal: s.ammonia,
                collectedAt: s.collectionTime.toISOString(),
                oxygen: s.oxygen,
                temperature: s.temperature,
                rainVolume: s.rainVolume,
                weatherCondition: s.weatherCondition,
                collector: s.collector
                    ? {
                          id: s.collector.id,
                          name: s.collector.name,
                          phone: s.collector.phone,
                      }
                    : null,
            }));

            return {
                id: loc.id,
                name: loc.name,
                organization: loc.agency,
                lat: loc.lat,
                lng: loc.lon,
                latestSample: mappedSamples[0] || null,
                recentSamples: [...mappedSamples].reverse(),
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("GET /api/locations error:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการดึงข้อมูลสถานี" },
            { status: 500 },
        );
    }
}

// POST /api/locations — Create a new location (ADMIN only)
export async function POST(request: NextRequest) {
    try {
        // ตรวจสอบและดักสิทธิ์ผู้ใช้งาน
        const user = await getAuthenticatedUser(request);
        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized: กรุณาเข้าสู่ระบบก่อนทำรายการ" },
                { status: 401 },
            );
        }
        if (user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    error: "Forbidden: เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์เพิ่มสถานี",
                },
                { status: 403 },
            );
        }

        const body = await request.json();
        const { name, organization, lat, lng } = body;

        if (!name || !organization || lat === undefined || lng === undefined) {
            return NextResponse.json(
                { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
                { status: 400 },
            );
        }

        const location = await prisma.location.create({
            data: {
                name,
                agency: organization,
                lat: parseFloat(lat),
                lon: parseFloat(lng),
            },
        });

        return NextResponse.json(
            {
                id: location.id,
                name: location.name,
                organization: location.agency,
                lat: location.lat,
                lng: location.lon,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("POST /api/locations error:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" },
            { status: 500 },
        );
    }
}

// PUT /api/locations — Update an existing location
export async function PUT(request: NextRequest) {
    try {
        // ตรวจสอบสิทธิ์แก้ไขข้อมูล
        const user = await getAuthenticatedUser(request);
        if (!user || user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    error: "Forbidden: บัญชีของคุณไม่มีสิทธิ์แก้ไขข้อมูลจุดตรวจ",
                },
                { status: 403 },
            );
        }

        const body = await request.json();
        const { id, name, organization, lat, lng } = body;

        if (!id) {
            return NextResponse.json({ error: "ต้องระบุ ID" }, { status: 400 });
        }

        const updateData: {
            name?: string;
            agency?: string;
            lat?: number;
            lon?: number;
        } = {};
        if (name !== undefined) updateData.name = name;
        if (organization !== undefined) updateData.agency = organization;
        if (lat !== undefined) updateData.lat = parseFloat(lat);
        if (lng !== undefined) updateData.lon = parseFloat(lng);

        const location = await prisma.location.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            id: location.id,
            name: location.name,
            organization: location.agency,
            lat: location.lat,
            lng: location.lon,
        });
    } catch (error) {
        console.error("PUT /api/locations error:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการแก้ไขข้อมูล" },
            { status: 500 },
        );
    }
}

// DELETE /api/locations — Delete a location
export async function DELETE(request: NextRequest) {
    try {
        // ตรวจสอบสิทธิ์การลบข้อมูล
        const user = await getAuthenticatedUser(request);
        if (!user || user.role !== "ADMIN") {
            return NextResponse.json(
                { error: "Forbidden: บัญชีของคุณไม่มีสิทธิ์ลบข้อมูลสถานี" },
                { status: 403 },
            );
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "ต้องระบุ ID" }, { status: 400 });
        }

        await prisma.waterSample.deleteMany({ where: { locationId: id } });
        await prisma.location.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/locations error:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการลบข้อมูล" },
            { status: 500 },
        );
    }
}
