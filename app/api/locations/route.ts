/**
 * @file app/api/locations/route.ts
 * @project Water Monitoring Project
 * @module API / Locations & Stations
 * @description
 * [TH] Route Handler จัดการสถานีตรวจวัดคุณภาพน้ำชายฝั่ง (CRUD):
 * - GET: ดึงรายการสถานีทั้งหมดพร้อมผลตรวจคุณภาพน้ำล่าสุด จัดกลุ่มตามเซสชัน (sessionGroup) และสถานะของสถานที่
 * - POST: เพิ่มสถานีใหม่ (เฉพาะ admin) พร้อมตรวจสอบความถูกต้องของที่อยู่ไทย และดึงข้อมูลสภาพอากาศ TMD ย้อนหลัง 2 เดือนอัตโนมัติ (Backfill)
 * - PUT: แก้ไขข้อมูลสถานี (เฉพาะ admin) พร้อมดึงสภาพอากาศใหม่หากมีการเปลี่ยนพิกัดละติจูด/ลองจิจูด
 * - DELETE: ลบสถานีและผลตรวจน้ำที่เกี่ยวข้องออกจากระบบ (เฉพาะ admin)
 * [EN] Route Handler for managing coastal water quality monitoring stations (CRUD):
 * - GET: Retrieves all monitoring stations with session-grouped latest water quality results and worst-case location status.
 * - POST: Creates new stations (admin only), validates Thai administrative addresses, and auto-backfills 2 months of TMD weather.
 * - PUT: Updates station metadata (admin only) and triggers weather backfill if coordinates changed.
 * - DELETE: Deletes station and associated water sample records (admin only).
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.4.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-06-09)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-15)
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-08-20)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-11)
 *
 * @database Prisma Client (MySQL)
 * @auth Public (GET) / Role-based admin only (POST, PUT, DELETE)
 * @external-service TMD / Open-Meteo Weather API
 * @see lib/thaiAddress.ts, lib/tmd.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getThaiAddressTree } from "@/lib/thaiAddress.server";
import { validateAddressParts, lookupZipcode } from "@/lib/thaiAddress";
import { prisma } from "@/lib/prisma";
import { toApiString } from "@/lib/thaiTime";
import { verifyAuth } from "@/lib/auth-guard";
import { getPendingSessionGroups } from "@/lib/review";
import { backfillWeatherData } from "@/lib/tmd";
import { evaluateSample, computeLatestValueByParameter } from "@/lib/standards";
import { loadAllStandards } from "@/lib/standards-db";

/**
 * ตรวจสอบความถูกต้องของข้อมูลที่อยู่ไทยเทียบกับฐานข้อมูลโครงสร้างการปกครอง (จังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์)
 * Validates Thai address components against the administrative tree hierarchy.
 *
 * @param {unknown} province - ชื่อจังหวัด
 * @param {unknown} district - ชื่ออำเภอ/เขต
 * @param {unknown} subdistrict - ชื่อตำบล/แขวง
 * @param {unknown} zipcode - รหัสไปรษณีย์ 5 หลัก
 * @returns {Promise<string | null>} ข้อความข้อผิดพลาดเมื่อไม่ผ่าน หรือ null เมื่อที่อยู่ถูกต้อง
 */
async function validateAddressPayload(
    province: unknown,
    district: unknown,
    subdistrict: unknown,
    zipcode: unknown,
): Promise<string | null> {
    const p = typeof province === "string" ? province.trim() : "";
    const d = typeof district === "string" ? district.trim() : "";
    const s = typeof subdistrict === "string" ? subdistrict.trim() : "";
    const z = typeof zipcode === "string" ? zipcode.trim() : "";

    if (!p && !d && !s && !z) return null;

    // อ่านฐานข้อมูลที่อยู่พลาด = ตรวจไม่ได้ ไม่ปล่อยผ่านเพื่อไม่ให้เกิดช่องโหว่เงียบ ๆ
    let tree;
    try {
        tree = await getThaiAddressTree();
    } catch (err) {
        console.error("Failed to load thai address data:", err);
        return "ระบบตรวจสอบข้อมูลที่อยู่ไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง";
    }

    const valid = validateAddressParts(tree, p, d, s);

    if (p && !valid.province) return `ไม่พบจังหวัด "${p}" ในระบบ`;
    if (d && !valid.district) return `ไม่พบอำเภอ/เขต "${d}" ในจังหวัด${p}`;
    if (s && !valid.subdistrict) return `ไม่พบตำบล/แขวง "${s}" ในอำเภอ${d}`;

    // รหัสไปรษณีย์ผูกกับตำบล ตรวจได้ต่อเมื่อที่อยู่ครบสามระดับ
    if (z && valid.subdistrict) {
        const expected = lookupZipcode(tree, valid.province, valid.district, valid.subdistrict);
        if (expected && z !== expected) return `รหัสไปรษณีย์ของตำบล${s} คือ ${expected} ไม่ใช่ ${z}`;
    }

    return null;
}

/**
 * ดึงรายการสถานีตรวจวัดทั้งหมดพร้อมผลตรวจน้ำล่าสุดแบบจัดกลุ่มเซสชัน
 * Retrieves all locations with their latest session-grouped water sample results.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม Optional Query param `org` สำหรับกรองตามหน่วยงาน
 * @returns {Promise<NextResponse>} รายการสถานี ผลวิเคราะห์ล่าสุด และประวัติย้อนหลัง
 */
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
                                parameterId: true, // ใช้จับคู่เกณฑ์ในตาราง standards — ห้ามจับคู่ด้วยชื่อสาร
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

        // เกณฑ์ทั้งหมด โหลดครั้งเดียวใช้ทุกสถานี (12 แถว) — ไม่ query ซ้ำในลูป
        const standards = await loadAllStandards();

        const result = locations.map((loc) => {
            // แผนผัง Map ควบแน่นจัดกลุ่มเรคคอร์ดที่มีรหัสเซสชันกลุ่มเดียวกันให้อยู่รวมร่างกันในขวดเดียว
            const sessionGroupMap = new Map<string, any>();

            // ── สถานะของ "สถานที่" (ตัวกำหนดสีหมุดบนแผนที่) ──
            // นิยาม: ค่าล่าสุดของแต่ละสาร → เทียบกับทุกเกณฑ์ → เอาผลแย่สุด
            //
            // ต้องคำนวณสดตรงนี้ ดึงจาก latestSample.status แทนไม่ได้ เพราะค่าล่าสุดของแต่ละสาร
            // อาจมาจากคนละรอบการเก็บ เช่น รอบล่าสุดเก็บแค่ phosphate (ปลอดภัย) แต่ ammonia
            // ล่าสุดที่วัดไว้เมื่อรอบก่อนยังอันตรายอยู่ → สถานะสถานที่ต้องเป็นอันตราย
            //
            // อิงจาก sample 50 แถวล่าสุดเท่านั้น (take: 50 ด้านบน) ถ้าสารตัวไหนไม่ถูกวัดเลย
            // ใน 50 รอบหลังสุด ค่าของมันจะไม่ถูกนับเข้าสถานะสถานที่
            // loc.samples เรียง collectionTime desc มาแล้ว → computeLatestValueByParameter หาตัวแรกที่เจอของแต่ละสารให้
            const latestByParameter = computeLatestValueByParameter(loc.samples);

            const locationStatus =
                latestByParameter.length > 0
                    ? evaluateSample(
                          latestByParameter.map((m) => ({ parameterId: m.parameterId, value: m.value })),
                          standards,
                      )
                    : null; // ยังไม่เคยมีผลตรวจ → หมุดสีเทา ไม่ใช่เขียว

            loc.samples.forEach((s) => {
                // ค้นหาคีย์ ถ้าไม่มีให้ใช้ id แถวเดี่ยว ๆ เป็นคีย์สำรองเพื่อไม่ให้ข้อมูลหลุดพังครับบอส
                const groupKey = s.sessionGroup || `single-${s.id}`;

                // แงะค่าวัดเคมีของสารทั้งหมดประจำแถวนี้ออกมาจัดรูปแบบแบน (Flat Flattening)
                const currentMeasurements: Record<string, number> = {};
                s.measurements.forEach((m) => {
                    // ไม่มีค่าที่วัดได้ → ไม่ต้องสร้างคีย์ `${สาร}Val` เลย ให้ฝั่งแสดงผลถือว่าไม่มีข้อมูลสารนี้
                    // แบนเป็น 0 ไม่ได้ เพราะการ์ด/BottomSheet จะโชว์ "0.00" เหมือนวัดได้จริง
                    if (m.parameter?.name && m.value !== null) {
                        const keyName = `${m.parameter.name.toLowerCase()}Val`;
                        currentMeasurements[keyName] = m.value;
                    }
                });

                // หากเพิ่งเจอเลขชุดเซสชันนี้เป็นครั้งแรกในพิกัดสถานีนี้
                if (!sessionGroupMap.has(groupKey)) {
                    sessionGroupMap.set(groupKey, {
                        id: s.id,
                        // null = ประเมินไม่ได้ ห้าม fallback เป็น "SAFE" เพราะจะประกาศว่าปลอดภัยบนแผนที่
                        // ทั้งที่ไม่เคยมีค่าให้ประเมิน (กติกาเดียวกับ groupSummary ใน /api/samples)
                        status: s.status ? s.status.toUpperCase() : null,

                        // เริ่มต้นกางค่าวัดเคมีที่ดึงออกมาได้ในรอบแรก
                        ...currentMeasurements,
                        phosphateVal: currentMeasurements["phosphateVal"] ?? null,
                        ammoniaVal: currentMeasurements["ammoniaVal"] ?? null,

                        collectedAt: toApiString(s.collectionTime),
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
                    // สารที่ประเมินไม่ได้ (null) ข้ามไปเลย ไม่ถ่วงกลุ่มทั้งขึ้นและลง — กลุ่มจะเป็น null
                    // ก็ต่อเมื่อไม่มีสารไหนประเมินได้เลยสักตัว
                    if (s.status) {
                        const incomingStatus = s.status.toUpperCase();
                        if (existing.status === null) {
                            existing.status = incomingStatus;
                        } else if (incomingStatus === "DANGER") {
                            existing.status = "DANGER";
                        } else if (incomingStatus === "WARNING" && existing.status !== "DANGER") {
                            existing.status = "WARNING";
                        }
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
                province: loc.province,
                district: loc.district,
                subdistrict: loc.subdistrict,
                zipcode: loc.zipcode,
                // สถานะของสถานที่ = ตัวกำหนดสีหมุด (คนละอย่างกับ latestSample.status ซึ่งเป็นของตัวอย่างใบเดียว)
                // null = ยังไม่เคยมีผลตรวจ
                locationStatus,
                // ค่าล่าสุดของแต่ละสารที่ใช้คำนวณ locationStatus — หน้าบ้านเอาไปทำตารางเปรียบเทียบเกณฑ์
                latestByParameter,
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

/**
 * สร้างสถานีจุดตรวจวัดพิกัดใหม่ พร้อมดึงสภาพอากาศย้อนหลัง 2 เดือนอัตโนมัติ (เฉพาะ Admin)
 * Creates a new water monitoring station and triggers 2-month TMD weather backfill.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม JSON payload { name, organization, lat, lng, province, district, subdistrict, zipcode }
 * @returns {Promise<NextResponse>} ข้อมูลสถานีที่สร้างสำเร็จ รหัส 201 Created
 */
export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    if (antiSpam.has(ip) && Date.now() - antiSpam.get(ip)! < 3000) return NextResponse.json({ error: "อย่ากดซ้ำ" }, { status: 429 });
    antiSpam.set(ip, Date.now());

    // คีย์เก่าหมดประโยชน์ทันทีที่พ้น 3 วินาที แต่ไม่มีใครลบให้ Map จึงโตตามจำนวน IP ที่เคยเรียก
    // เกณฑ์เดียวกับ /api/analyze และ /api/samples: กวาดเมื่อ Map เริ่มใหญ่ ไม่ใช่ทุกครั้ง
    if (antiSpam.size > 500) {
        const cutoff = Date.now();
        for (const [key, timestamp] of antiSpam.entries()) {
            if (cutoff - timestamp >= 3000) antiSpam.delete(key);
        }
    }

    try {
        const auth = await verifyAuth(request, ["admin"]);
        if (!auth.isValid) return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });

        const body = await request.json();
        const { name, organization, lat, lng, province, district, subdistrict, zipcode } = body;

        if (!name || !organization || lat === undefined || lng === undefined) {
            return NextResponse.json({ error: "กรุณากรอกข้อมูลจำเพาะสถานีให้ครบถ้วน" }, { status: 400 });
        }

        const addressError = await validateAddressPayload(province, district, subdistrict, zipcode);
        if (addressError) return NextResponse.json({ error: addressError }, { status: 400 });

        const location = await prisma.location.create({
            data: {
                stationName: name,
                governingAgency: organization,
                latitude: parseFloat(lat),
                longitude: parseFloat(lng),
                province: province || null,
                district: district || null,
                subdistrict: subdistrict || null,
                zipcode: zipcode || null,
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

/**
 * ปรับปรุงแก้ไขข้อมูลสถานีจุดตรวจวัดเดิม (เฉพาะ Admin)
 * Updates station details; re-triggers weather backfill if coordinates changed.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม JSON payload { id, name, organization, lat, lng, province, district, subdistrict, zipcode }
 * @returns {Promise<NextResponse>} ข้อมูลสถานีที่ได้รับการอัปเดต
 */
export async function PUT(request: NextRequest) {
    try {
        const auth = await verifyAuth(request, ["admin"]);
        if (!auth.isValid) return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });

        const body = await request.json();
        const { id, name, organization, lat, lng, province, district, subdistrict, zipcode } = body;

        if (!id) return NextResponse.json({ error: "กรุณาระบุรหัส ID สถานีที่ต้องการแก้ไข" }, { status: 400 });

        // PUT อัปเดตเฉพาะฟิลด์ที่ส่งมา จึงต้องตรวจกับค่าที่ "จะเป็นหลังอัปเดต" ไม่ใช่เฉพาะที่ส่งมา
        // ไม่งั้นการแก้จังหวัดอย่างเดียวจะทำให้จับคู่กับอำเภอเดิมที่ค้างอยู่แบบผิด ๆ ได้
        if (province !== undefined || district !== undefined || subdistrict !== undefined || zipcode !== undefined) {
            const current = await prisma.location.findUnique({
                where: { id: Number(id) },
                select: { province: true, district: true, subdistrict: true, zipcode: true },
            });
            if (!current) return NextResponse.json({ error: "ไม่พบสถานีที่ต้องการแก้ไข" }, { status: 404 });

            const addressError = await validateAddressPayload(
                province !== undefined ? province : current.province,
                district !== undefined ? district : current.district,
                subdistrict !== undefined ? subdistrict : current.subdistrict,
                zipcode !== undefined ? zipcode : current.zipcode,
            );
            if (addressError) return NextResponse.json({ error: addressError }, { status: 400 });
        }

        const updateData: any = {};
        if (name !== undefined) updateData.stationName = name;
        if (organization !== undefined) updateData.governingAgency = organization;
        if (lat !== undefined) updateData.latitude = parseFloat(lat);
        if (lng !== undefined) updateData.longitude = parseFloat(lng);
        if (province !== undefined) updateData.province = province || null;
        if (district !== undefined) updateData.district = district || null;
        if (subdistrict !== undefined) updateData.subdistrict = subdistrict || null;
        if (zipcode !== undefined) updateData.zipcode = zipcode || null;

        // พิกัดก่อนแก้ไข ใช้ตัดสินว่าต้องดึงสภาพอากาศใหม่หรือไม่ (ดูเงื่อนไขใต้ update)
        const previous = await prisma.location.findUnique({
            where: { id: Number(id) },
            select: { latitude: true, longitude: true },
        });
        if (!previous) return NextResponse.json({ error: "ไม่พบสถานีที่ต้องการแก้ไข" }, { status: 404 });

        const location = await prisma.location.update({
            where: { id: Number(id) },
            data: updateData,
        });

        // ข้อมูลสภาพอากาศผูกกับพิกัด ไม่ใช่ชื่อสถานีหรือหน่วยงาน — แก้ชื่ออย่างเดียวจึงไม่ต้องดึงใหม่
        // backfill ย้อนหลัง 2 เดือนต่อครั้ง ถ้าเรียกทุกการแก้ไขจะยิง API อากาศซ้ำโดยเปล่าประโยชน์
        const coordinatesChanged = previous.latitude !== location.latitude || previous.longitude !== location.longitude;
        if (coordinatesChanged) {
            await backfillWeatherData(location.id, location.latitude, location.longitude);
        }
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

/**
 * ลบสถานีจุดตรวจวัดและผลตรวจน้ำทั้งหมดของสถานีออกจากระบบ (เฉพาะ Admin)
 * Deletes a station and cascades deletion of its related water samples.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม Query param `?id=...`
 * @returns {Promise<NextResponse>} ผลสำเร็จ { success: true }
 */
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
