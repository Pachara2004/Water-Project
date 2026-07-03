import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

// GET /api/locations — ดึงรายการสถานีทั้งหมดพร้อมผลตรวจน้ำล่าสุด 10 ชุด (Public - คนทั่วไปเข้าดูแผนที่ได้)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const orgFilter = searchParams.get("org");

        const where = orgFilter && orgFilter !== "ALL" ? { governingAgency: orgFilter } : {};

        const locations = await prisma.location.findMany({
            where,
            include: {
                samples: {
                    where: { isDeleted: false },
                    orderBy: { collectionTime: "desc" },
                    take: 10,
                    select: {
                        id: true,
                        status: true,
                        collectionTime: true,
                        dissolvedOxygen: true,
                        airTemperature: true,
                        rainAccumulation: true,
                        weatherCondCode: true,
                        collector: {
                            select: {
                                id: true,
                                lineProfileName: true,
                                firstName: true,
                                lastName: true,
                                phoneNumber: true,
                            },
                        },
                        // แก้ไข: ดึงข้อมูลค่าวัดผ่านตาราง Relation ย่อยคู่กับชื่อสารเคมี
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
                },
            },
        });

        const result = locations.map((loc) => {
            const mappedSamples = loc.samples.map((s) => {
                // แยกแกะค่าสารเคมีจาก Array ของ measurements ออกมาจัดรูปแบบแบน (Flat) ตามเดิม
                let ammoniaVal: number | null = null;
                let phosphateVal: number | null = null;

                s.measurements.forEach((m) => {
                    if (m.parameter.name === "ammonia") ammoniaVal = m.value;
                    if (m.parameter.name === "phosphate") phosphateVal = m.value;
                });

                return {
                    id: s.id,
                    status: s.status,
                    phosphateVal: phosphateVal, // ส่งค่ากลับไปในชื่อฟิลด์เดิม
                    ammoniaVal: ammoniaVal, // ส่งค่ากลับไปในชื่อฟิลด์เดิม
                    collectedAt: s.collectionTime.toISOString(),
                    oxygen: s.dissolvedOxygen,
                    temperature: s.airTemperature,
                    rainVolume: s.rainAccumulation,
                    weatherCondCode: s.weatherCondCode,
                    collector: s.collector
                        ? {
                              id: s.collector.id,
                              displayName: s.collector.lineProfileName,
                              fullName: `${s.collector.firstName || ""} ${s.collector.lastName || ""}`.trim() || "เจ้าหน้าที่ภาคสนาม",
                              phone: s.collector.phoneNumber,
                          }
                        : null,
                };
            });

            return {
                id: loc.id,
                name: loc.stationName,
                organization: loc.governingAgency,
                lat: loc.latitude,
                lng: loc.longitude,
                latestSample: mappedSamples[0] || null,
                recentSamples: [...mappedSamples].reverse(),
            };
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("GET /api/locations error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลสถานีชายฝั่ง" }, { status: 500 });
    }
}

const antiSpam = new Map<string, number>();

// POST /api/locations — เพิ่มสถานีจุดตรวจพิกัดใหม่ (เฉพาะ admin)
export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    if (antiSpam.has(ip) && Date.now() - antiSpam.get(ip)! < 3000) return NextResponse.json({ error: "อย่ากดซ้ำ" }, { status: 429 });
    antiSpam.set(ip, Date.now());

    try {
        const auth = await verifyAuth(request, ["admin"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        const body = await request.json();
        const { name, organization, lat, lng } = body;

        if (!name || !organization || lat === undefined || lng === undefined) {
            return NextResponse.json({ error: "กรุณากรอกข้อมูลจำเพาะสถานีให้ครบถ้วน" }, { status: 400 });
        }

        const location = await prisma.location.create({
            data: {
                stationName: name,
                governingAgency: organization,
                latitude: parseFloat(lat),
                longitude: parseFloat(lng),
            },
        });

        return NextResponse.json(
            {
                id: location.id,
                name: location.stationName,
                organization: location.governingAgency,
                lat: location.latitude,
                lng: location.longitude,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("POST /api/locations error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลพิกัดสถานี" }, { status: 500 });
    }
}

// PUT /api/locations — ปรับปรุงแก้ไขข้อมูลพิกัดสถานีเดิม (เฉพาะ admin)
export async function PUT(request: NextRequest) {
    try {
        const auth = await verifyAuth(request, ["admin"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        const body = await request.json();
        const { id, name, organization, lat, lng } = body;

        if (!id) {
            return NextResponse.json({ error: "กรุณาระบุรหัส ID สถานีที่ต้องการแก้ไข" }, { status: 400 });
        }

        const updateData: any = {};
        if (name !== undefined) updateData.stationName = name;
        if (organization !== undefined) updateData.governingAgency = organization;
        if (lat !== undefined) updateData.latitude = parseFloat(lat);
        if (lng !== undefined) updateData.longitude = parseFloat(lng);

        const location = await prisma.location.update({
            where: { id: Number(id) },
            data: updateData,
        });

        return NextResponse.json({
            id: location.id,
            name: location.stationName,
            organization: location.governingAgency,
            lat: location.latitude,
            lng: location.longitude,
        });
    } catch (error) {
        console.error("PUT /api/locations error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการแก้ไขข้อมูลโครงสร้างสถานี" }, { status: 500 });
    }
}

// DELETE /api/locations — ลบสถานีพิกัดออกจากระบบ (เฉพาะ admin)
export async function DELETE(request: NextRequest) {
    try {
        const auth = await verifyAuth(request, ["admin"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "กรุณาระบุรหัส ID จุดตรวจที่ต้องการถอดถอน" }, { status: 400 });
        }

        const targetId = Number(id);

        // หมายเหตุ: เนื่องจากใน Schema ตาราง measurements ถูกตั้ง onDelete: Cascade พ่วงกับตาราง samples ไว้แล้ว
        // เมื่อสั่งลบตาราง samples ด้านล่างนี้ รายการสารเคมีในตารางย่อยจะถูกลบตามอัตโนมัติ (ไม่ต้องเรียก deleteMany ซ้อน)
        await prisma.waterSample.deleteMany({
            where: { locationId: targetId },
        });
        await prisma.location.delete({ where: { id: targetId } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/locations error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบข้อมูลสถานีวิจัยออกจากเซิร์ฟเวอร์" }, { status: 500 });
    }
}
