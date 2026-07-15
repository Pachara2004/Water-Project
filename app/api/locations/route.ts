import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { getPendingSessionGroups } from "@/lib/review";
import { backfillWeatherData } from "@/lib/tmd";

// ==========================================
// GET /api/locations — ดึงรายการสถานีทั้งหมดพร้อมผลตรวจน้ำล่าสุดแบบจัดกลุ่มเซสชัน
// ==========================================
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const orgFilter = searchParams.get("org");

        const where = orgFilter && orgFilter !== "ALL" ? { governingAgency: orgFilter } : {};

        // ข้อมูลสาธารณะ (ทุกคนเห็น) — ต้องซ่อน session ที่ยังรออนุมัติออกทั้งหมด ไม่ว่าใครเป็นคนส่ง
        const pendingGroups = await getPendingSessionGroups();
        const sampleWhere: any = { isDeleted: false };
        // ⚠️ ต้องปล่อยแถวที่ sessionGroup = null ผ่านด้วย! (ข้อมูลส่งเดี่ยวส่วนใหญ่ไม่มี sessionGroup)
        // SQL `NOT IN (...)` ให้ผลเป็น NULL (ไม่ใช่ TRUE) กับแถวที่คอลัมน์เป็น NULL → แถวพวกนั้นถูกคัดทิ้งหมด
        // จึงต้อง OR เงื่อนไข sessionGroup IS NULL เข้าไปเพื่อไม่ให้ข้อมูลปกติหายเมื่อมี pending อย่างน้อย 1 รายการ
        if (pendingGroups.length > 0) {
            sampleWhere.OR = [{ sessionGroup: null }, { sessionGroup: { notIn: pendingGroups } }];
        }

        // ดึงพิกัดทั้งหมดออกมา โดยตึงเอาผลตรวจ WaterSample 50 แถวล่าสุด (เผื่อแตกกระจายตัวรายสารเคมี)
        const locations = await prisma.location.findMany({
            where,
            include: {
                samples: {
                    where: sampleWhere,
                    orderBy: { collectionTime: "desc" },
                    take: 50, // ขยายขนาดการขุดขึ้นมาเผื่อกรณีวนลูปกระจายตัวรายสารเคมีประจำเซสชันครับบอส
                    select: {
                        id: true,
                        status: true,
                        collectionTime: true,
                        dissolvedOxygen: true,
                        airTemperature: true,
                        rainAccumulation: true,
                        weatherCondCode: true,
                        sessionGroup: true, // ดึงคอลัมน์กลุ่มประจำรอบเซสชันมาทำโครงสร้างผูกสัมพันธ์
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
            // แผนผัง Map ควบแน่นจัดกลุ่มเรคคอร์ดที่มีรหัสเซสชันกลุ่มเดียวกันให้อยู่รวมร่างกันในขวดเดียว
            const sessionGroupMap = new Map<string, any>();

            loc.samples.forEach((s) => {
                // ค้นหาคีย์ ถ้าไม่มีให้ใช้ id แถวเดี่ยว ๆ เป็นคีย์สำรองเพื่อไม่ให้ข้อมูลหลุดพังครับบอส
                const groupKey = s.sessionGroup || `single-${s.id}`;

                // แงะค่าวัดเคมีของสารทั้งหมดประจำแถวนี้ออกมาจัดรูปแบบแบน (Flat Flattening)
                const currentMeasurements: Record<string, number> = {};
                s.measurements.forEach((m) => {
                    if (m.parameter?.name) {
                        const keyName = `${m.parameter.name.toLowerCase()}Val`;
                        currentMeasurements[keyName] = m.value;
                    }
                });

                // หากเพิ่งเจอเลขชุดเซสชันนี้เป็นครั้งแรกในพิกัดสถานีนี้
                if (!sessionGroupMap.has(groupKey)) {
                    sessionGroupMap.set(groupKey, {
                        id: s.id,
                        status: s.status ? s.status.toUpperCase() : "SAFE",

                        // เริ่มต้นกางค่าวัดเคมีที่ดึงออกมาได้ในรอบแรก
                        ...currentMeasurements,
                        phosphateVal: currentMeasurements["phosphateVal"] ?? null,
                        ammoniaVal: currentMeasurements["ammoniaVal"] ?? null,

                        collectedAt: s.collectionTime.toISOString(),
                        oxygen: s.dissolvedOxygen,
                        temperature: s.airTemperature,
                        rainVolume: s.rainAccumulation,
                        weatherCondCode: s.weatherCondCode,
                        sessionGroup: s.sessionGroup,
                        collector: s.collector
                            ? {
                                  id: s.collector.id,
                                  displayName: s.collector.lineProfileName,
                                  fullName: `${s.collector.firstName || ""} ${s.collector.lastName || ""}`.trim() || "เจ้าหน้าที่ภาคสนาม",
                                  phone: s.collector.phoneNumber,
                              }
                            : null,
                    });
                } else {
                    // ถ้ารหัสชุดเซสชันนี้เคยถูกสร้างไปรอบก่อนหน้าแล้ว (แปลว่าสารอีกตัวส่งตามเข้ามาผูก)
                    const existing = sessionGroupMap.get(groupKey);

                    // ออบเจกต์รวมพลัง: ยัดค่าวัดเคมีเพิ่มเสริมเข้าไปในเรคคอร์ดเซสชันเดิมทันที
                    Object.assign(existing, currentMeasurements);
                    if (currentMeasurements["phosphateVal"] !== undefined) existing.phosphateVal = currentMeasurements["phosphateVal"];
                    if (currentMeasurements["ammoniaVal"] !== undefined) existing.ammoniaVal = currentMeasurements["ammoniaVal"];

                    // คุมสถานะความปลอดภัยสูงสุดประจำกลุ่มชุดขวดตรวจ (ยึดหลักแย่สุดทับอันดีสุด)
                    const incomingStatus = s.status ? s.status.toUpperCase() : "SAFE";
                    if (incomingStatus === "DANGER") {
                        existing.status = "DANGER";
                    } else if (incomingStatus === "WARNING" && existing.status !== "DANGER") {
                        existing.status = "WARNING";
                    }
                }
            });

            // แปลงจากข้อมูล Map ดึงออกมาเป็นอาเรย์เรียงตามเวลาตรวจล่าสุด
            const formattedSamples = Array.from(sessionGroupMap.values());

            return {
                id: loc.id,
                name: loc.stationName,
                organization: loc.governingAgency,
                lat: loc.latitude,
                lng: loc.longitude,
                // ใบวิเคราะห์ล่าสุดคืออาร์เรย์ตัวแรกที่ผ่านการควบรวมมาเรียบร้อย
                latestSample: formattedSamples[0] || null,
                // ดึงรายการประวัติย้อนหลังเรียงจำกัดเอา 10 ชุดเซสชันกลุ่มพรีเมียม
                recentSamples: [...formattedSamples].slice(0, 10).reverse(),
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
        if (!auth.isValid) return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });

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

        // 🌟 ไฮไลท์เด็ด: บังคับให้รันคำสั่งดึงข้อมูลย้อนหลัง 2 เดือนกวาดลง DB ทันทีตอนสร้างเสร็จครับบอส!
        await backfillWeatherData(location.id, location.latitude, location.longitude);

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
        if (!auth.isValid) return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });

        const body = await request.json();
        const { id, name, organization, lat, lng } = body;

        if (!id) return NextResponse.json({ error: "กรุณาระบุรหัส ID สถานีที่ต้องการแก้ไข" }, { status: 400 });

        const updateData: any = {};
        if (name !== undefined) updateData.stationName = name;
        if (organization !== undefined) updateData.governingAgency = organization;
        if (lat !== undefined) updateData.latitude = parseFloat(lat);
        if (lng !== undefined) updateData.longitude = parseFloat(lng);

        const location = await prisma.location.update({
            where: { id: Number(id) },
            data: updateData,
        });

        await backfillWeatherData(location.id, location.latitude, location.longitude);
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
        if (!auth.isValid) return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ error: "กรุณาระบุรหัส ID จุดตรวจที่ต้องการถอดถอน" }, { status: 400 });

        const targetId = Number(id);

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
