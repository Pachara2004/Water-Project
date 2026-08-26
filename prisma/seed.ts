/**
 * prisma/seed.ts — Database seed สำหรับโครงสร้างใหม่ตาม schema.prisma จริง
 * ─────────────────────────────────────────────────────────
 * รัน: npm run seed หรือ npx prisma db seed
 */

import { PrismaClient, WaterStatus } from "@prisma/client";
import { evaluateSample, type StandardRow } from "../lib/standards";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────
// ตัวเจน sessionGroup / code ให้ตรงรูปแบบ production
//   sessionGroup -> SES[YYMMDD][ลำดับกลุ่ม 4 หลัก]        นับรวมทั้งระบบ รีเซ็ตรายวัน
//   code         -> SP[YYMMDD][locationId 3 หลัก][ลำดับ 4 หลัก]  นับแยกรายสถานี รีเซ็ตรายวัน
//
// นับด้วย Map ในหน่วยความจำแทนการ query DB ทุกครั้ง (ตอน seed ตารางว่างอยู่แล้ว
// และ seed เขียนข้อมูลแบบเรียงลำดับ ผลลัพธ์จึงตรงกับตรรกะของ generateSessionGroup /
// generateSampleCode) ข้อจำกัด: ใช้ได้เฉพาะกรณี seed เริ่มจากตารางว่างเท่านั้น
// ─────────────────────────────────────────────────────────
const dateKey = (d: Date) => `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

const sessionSeqByDay = new Map<string, number>(); // YYMMDD -> ลำดับกลุ่มล่าสุดของวันนั้น
const sampleSeqByDayLocation = new Map<string, number>(); // YYMMDD:locationId -> ลำดับตัวอย่างล่าสุดของสถานีในวันนั้น

function nextSessionGroup(collectionTime: Date): string {
    const ymd = dateKey(collectionTime);
    const seq = (sessionSeqByDay.get(ymd) ?? 0) + 1;
    sessionSeqByDay.set(ymd, seq);
    return `SES${ymd}${String(seq).padStart(4, "0")}`;
}

function nextSampleCode(locationId: number, collectionTime: Date): string {
    const ymd = dateKey(collectionTime);
    const key = `${ymd}:${locationId}`;
    const seq = (sampleSeqByDayLocation.get(key) ?? 0) + 1;
    sampleSeqByDayLocation.set(key, seq);
    return `SP${ymd}${String(locationId).padStart(3, "0")}${String(seq).padStart(4, "0")}`;
}

async function main() {
    console.log("🌱 Starting database seeding based on actual schema.prisma...");

    // 1. Clean existing data (ลบตามลำดับป้องกัน Foreign Key Constraints)
    console.log("🧹 Cleaning existing data...");
    await prisma.dashboardWidget.deleteMany();
    await prisma.roleRequest.deleteMany();
    await prisma.reviewRequest.deleteMany();
    await prisma.waterSampleMeasurement.deleteMany();
    await prisma.waterSample.deleteMany();
    await prisma.standard.deleteMany();
    await prisma.parameter.deleteMany();
    await prisma.location.deleteMany();
    await prisma.locationType.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();

    // รีเซ็ต AUTO_INCREMENT ทุกตาราง
    const tablesToResetAutoIncrement = [
        "dashboard_widgets",
        "role_requests",
        "review_requests",
        "sample_measurements",
        "samples",
        "standards",
        "parameters",
        "locations",
        "location_types",
        "users",
        "roles",
    ];
    for (const table of tablesToResetAutoIncrement) {
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
    }

    // ─── 2. ROLES SEEDING ───
    console.log("🔒 Creating system roles...");
    const roleAdmin = await prisma.role.create({ data: { roleName: "admin" } });
    const roleOfficer = await prisma.role.create({ data: { roleName: "officer" } });
    const roleCollector = await prisma.role.create({ data: { roleName: "collector" } });
    // เคลียร์ความซ้ำซ้อนของการสร้าง guest role
    const roleGuest = await prisma.role.create({ data: { roleName: "guest" } });

    // ─── 3. PARAMETERS SEEDING ───
    console.log("🧪 Creating parameter master data...");
    const paramAmmonia = await prisma.parameter.create({
        data: { name: "ammonia", unit: "mg/L", description: "สารแอมโมเนียในน้ำ (NH3)" },
    });

    const paramPhosphate = await prisma.parameter.create({
        data: { name: "phosphate", unit: "mg/L", description: "สารฟอสเฟตในน้ำ (PO4)" },
    });

    // ─── 3.1 LOCATION TYPES + STANDARDS ───
    console.log("📏 Creating location types and water quality standards...");

    const locationTypesPayload = [
        { code: "CONSERVATION", labelTh: "เพื่อการอนุรักษ์ทรัพยากรธรรมชาติ", phosphateMax: 0.015, ammoniaMax: 0.1 },
        { code: "CORAL_REEF", labelTh: "เพื่อการอนุรักษ์แหล่งปะการัง", phosphateMax: 0.015, ammoniaMax: 0.1 },
        { code: "AQUACULTURE", labelTh: "เพื่อการเพาะเลี้ยงสัตว์น้ำ", phosphateMax: 0.045, ammoniaMax: 0.7 },
        { code: "RECREATION", labelTh: "เพื่อการนันทนาการ", phosphateMax: 0.015, ammoniaMax: 0.2 },
        { code: "INDUSTRY", labelTh: "เพื่อการอุตสาหกรรมและท่าเรือ", phosphateMax: 0.045, ammoniaMax: 0.95 },
        { code: "COMMUNITY", labelTh: "สำหรับเขตชุมชน", phosphateMax: 0.045, ammoniaMax: 0.95 },
    ];

    for (const lt of locationTypesPayload) {
        const createdType = await prisma.locationType.create({
            data: { code: lt.code, labelTh: lt.labelTh },
        });

        await prisma.standard.createMany({
            data: [
                { locationTypeId: createdType.id, parameterId: paramPhosphate.id, maxValue: lt.phosphateMax },
                { locationTypeId: createdType.id, parameterId: paramAmmonia.id, maxValue: lt.ammoniaMax },
            ],
        });
    }

    const strictestPhosphate = Math.min(...locationTypesPayload.map((t) => t.phosphateMax));
    const strictestAmmonia = Math.min(...locationTypesPayload.map((t) => t.ammoniaMax));

    const seededStandards: StandardRow[] = await prisma.standard.findMany({
        select: { parameterId: true, maxValue: true },
    });

    const computeStatus = (phosphate: number, ammonia: number): WaterStatus =>
        evaluateSample(
            [
                { parameterId: paramPhosphate.id, value: phosphate },
                { parameterId: paramAmmonia.id, value: ammonia },
            ],
            seededStandards,
        ) as WaterStatus;

    // ─── 4. DASHBOARD WIDGETS SEEDING ───
    console.log("📊 Injecting dynamic dashboard blueprints linked with parameters...");

    await prisma.dashboardWidget.create({
        data: { title: "จำนวนตัวอย่างน้ำ", widgetType: "CARD", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: null, cardColor: "blue", width: 3 },
    });
    await prisma.dashboardWidget.create({
        data: {
            title: "อัตราคุณภาพน้ำปลอดภัย (Safety Rate)",
            widgetType: "CARD",
            metricType: "RATE",
            targetType: "SAMPLE_STATUS",
            targetColumn: null,
            filterValue: "safe",
            unit: "%",
            cardColor: "green",
            width: 3,
        },
    });
    await prisma.dashboardWidget.create({
        data: { title: "ตัวอย่างที่เกินค่ามาตรฐาน (Danger)", widgetType: "CARD", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: null, filterValue: "danger", cardColor: "red", width: 3 },
    });
    await prisma.dashboardWidget.create({
        data: {
            title: "ตัวอย่างที่ต้องเฝ้าระวัง (Warning)",
            widgetType: "CARD",
            metricType: "COUNT",
            targetType: "SAMPLE_STATUS",
            targetColumn: null,
            filterValue: "warning",
            cardColor: "yellow",
            width: 3,
        },
    });
    await prisma.dashboardWidget.create({
        data: { title: "สัดส่วนดัชนีคุณภาพน้ำทะเลรวม", widgetType: "PIE_CHART", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: null, cardColor: "blue", width: 6 },
    });
    await prisma.dashboardWidget.create({
        data: { title: "แนวโน้มการเปลี่ยนแปลงระดับความเข้มข้นสารเคมีรายเดือน", widgetType: "BAR_CHART", metricType: "AVG", targetType: "PARAMETER", targetColumn: null, cardColor: "blue", width: 6 },
    });
    await prisma.dashboardWidget.create({
        data: { title: "สหสัมพันธ์แนวโน้มปริมาณน้ำฝนสะสม", widgetType: "LINE_CHART", metricType: "AVG", targetType: "ENVIRONMENT", targetColumn: "rain_accumulation", cardColor: "blue", width: 12 },
    });

    // ─── 5. USERS SEEDING ───
    console.log("👤 Creating users...");
    const adminUser = await prisma.user.create({
        data: { lineUniqueId: "U_ADMIN_999", lineProfileName: "Somchai_LINE", firstName: "สมชาย", lastName: "แอดมินระบบ", phoneNumber: "0812345678", roleId: roleAdmin.id },
    });

    const collectors = await Promise.all([
        prisma.user.create({
            data: { lineUniqueId: "COL_001", lineProfileName: "Wichai_Field", firstName: "วิชัย", lastName: "เก็บตัวอย่างที่หนึ่ง", phoneNumber: "0891112222", roleId: roleCollector.id },
        }),
        prisma.user.create({ data: { lineUniqueId: "COL_002", lineProfileName: "Manee_Ka", firstName: "มานี", lastName: "เก็บตัวอย่างที่สอง", phoneNumber: "0892223333", roleId: roleCollector.id } }),
    ]);

    const guestUser = await prisma.user.create({
        data: { lineUniqueId: "GEN_001", lineProfileName: "P_Yut", firstName: "ประยุทธ์", lastName: "รอรับสิทธิ์", phoneNumber: "0811111111", roleId: roleGuest.id },
    });

    // ─── 6. ROLE REQUESTS SEEDING ───
    console.log("📝 Generating sample role requests...");
    await prisma.roleRequest.create({ data: { userId: guestUser.id, requestedRoleId: roleOfficer.id, status: "pending" } });

    // ─── 7. LOCATIONS STATIONS ───
    console.log("📍 Creating coastal monitoring stations...");
    const locationsPayload = [
        { stationName: "ปากแม่น้ำบางปะกง", governingAgency: "กรมประมง", latitude: 13.4543, longitude: 100.9823 },
        { stationName: "อ่าวศรีราชา", governingAgency: "กรมประมง", latitude: 13.1676, longitude: 100.9267 },
        { stationName: "ท่าเรือแหลมฉบัง", governingAgency: "กรมควบคุมมลพิษ", latitude: 13.0833, longitude: 100.8833 },
        { stationName: "หาดบางแสน", governingAgency: "กรมทรัพยากรทางทะเลและชายฝั่ง", latitude: 13.2833, longitude: 100.9333 },
        { stationName: "เกาะสีชัง", governingAgency: "กรมเจ้าท่า", latitude: 13.1531, longitude: 100.8058 },
        { stationName: "ปากแม่น้ำระยอง", governingAgency: "กรมประมง", latitude: 12.6833, longitude: 101.2667 },
        { stationName: "อ่าวมาบตาพุด", governingAgency: "กรมควบคุมมลพิษ", latitude: 12.6833, longitude: 101.15 },
        { stationName: "หาดจอมเทียน", governingAgency: "กรมทรัพยากรทางทะเลและชายฝั่ง", latitude: 12.8833, longitude: 100.9 },
    ];

    const insertedLocations = [];
    for (const loc of locationsPayload) {
        const createdLoc = await prisma.location.create({
            data: { stationName: loc.stationName, governingAgency: loc.governingAgency, latitude: loc.latitude, longitude: loc.longitude },
        });
        insertedLocations.push(createdLoc);
    }

    // ─── 8. WATER SAMPLES WITH PARAMETER MEASUREMENTS (250 กลุ่ม = 500 แถว) ───
    console.log("🧪 Generating 250 sample sessions (2 rows each: ammonia + phosphate)...");
    const samplesCount = 250;

    for (let i = 0; i < samplesCount; i++) {
        const daysAgo = Math.floor(Math.random() * 180);
        const hourAgo = Math.floor(Math.random() * 24);
        const sampleDate = new Date();
        sampleDate.setDate(sampleDate.getDate() - daysAgo);
        sampleDate.setHours(sampleDate.getHours() - hourAgo);

        const randomCollectorObj = collectors[i % collectors.length];
        const randomLocation = insertedLocations[i % insertedLocations.length];

        const rainVol = Math.random() > 0.6 ? parseFloat((Math.random() * 45).toFixed(2)) : 0;
        const weatherCode = rainVol > 30 ? 7 : rainVol > 10 ? 5 : 1;

        const severityRoll = Math.random();
        const severityBucket: "danger" | "warning" | "safe" = severityRoll > 0.94 ? "danger" : severityRoll > 0.85 ? "warning" : "safe";

        const scaleFor = (bucket: typeof severityBucket) => (bucket === "danger" ? 1.05 + Math.random() * 1.5 : bucket === "warning" ? 0.7 + Math.random() * 0.29 : Math.random() * 0.69);

        const ammoniaValue = parseFloat((strictestAmmonia * scaleFor(severityBucket)).toFixed(3));
        const phosphateValue = parseFloat((strictestPhosphate * scaleFor(severityBucket)).toFixed(4));

        const doValue = parseFloat((3.5 + Math.random() * 5).toFixed(1));
        const tempValue = parseFloat((26 + Math.random() * 5).toFixed(1));

        const bulkSessionGroup = nextSessionGroup(sampleDate);
        const rawImageUrl = Math.random() > 0.5 ? `/uploads/mock-raw.jpg` : null;
        const analyzedPlotUrl = Math.random() > 0.5 ? `/uploads/mock-plot.jpg` : null;

        // ฟิลด์สภาพแวดล้อมและรูปเป็นของ "การเก็บครั้งนั้น" จึงซ้ำเหมือนกันทุกแถวในกลุ่ม
        const sharedFields = {
            collectorId: randomCollectorObj.id,
            locationId: randomLocation.id,
            collectionTime: sampleDate,
            dissolvedOxygen: doValue,
            airTemperature: tempValue,
            rainAccumulation: rainVol,
            weatherCondCode: weatherCode,
            sessionGroup: bulkSessionGroup,
            rawImageUrl,
            analyzedPlotUrl,
        };

        // 1 แถวต่อ 1 สาร ตรงกับที่ production เขียน (ผู้ใช้ยิงทีละขวด แล้วจับรวมเป็นกลุ่มด้วย sessionGroup)
        // status ของแต่ละแถวคิดจากสารของแถวนั้นตัวเดียว ส่วนสถานะรวมของกลุ่มฝั่งอ่านจะหาค่าแย่สุดเอง
        await prisma.waterSample.create({
            data: {
                ...sharedFields,
                code: nextSampleCode(randomLocation.id, sampleDate),
                status: computeStatus(0, ammoniaValue),
                // [UPDATED] boundingBox ส่งเป็น JSON Object แทน String
                measurements: { create: [{ parameterId: paramAmmonia.id, value: ammoniaValue, confidence: 0.92, boundingBox: { x: 10, y: 20, w: 100, h: 200 } }] },
            },
        });

        await prisma.waterSample.create({
            data: {
                ...sharedFields,
                code: nextSampleCode(randomLocation.id, sampleDate),
                status: computeStatus(phosphateValue, 0),
                measurements: { create: [{ parameterId: paramPhosphate.id, value: phosphateValue, confidence: 0.89, boundingBox: { x: 15, y: 25, w: 110, h: 210 } }] },
            },
        });
    }

    // ─── 9. CONFIDENCE REVIEW TEST DATA ───
    console.log("🔍 Generating confidence-review test scenarios...");

    const reviewLocation = insertedLocations[0];
    const collectorA = collectors[0];
    const collectorB = collectors[1];

    // A) PENDING Single
    const timePendingSingle = new Date(Date.now() - 1000 * 60 * 60 * 3);
    const sgPendingSingle = nextSessionGroup(timePendingSingle);
    await prisma.waterSample.create({
        data: {
            code: nextSampleCode(reviewLocation.id, timePendingSingle),
            collectorId: collectorA.id,
            locationId: reviewLocation.id,
            collectionTime: timePendingSingle,
            dissolvedOxygen: 5.2,
            airTemperature: 29.1,
            status: computeStatus(0, 2.1),
            sessionGroup: sgPendingSingle,
            rawImageUrl: "/uploads/mock-raw.jpg",
            analyzedPlotUrl: "/uploads/mock-plot.jpg",
            measurements: { create: [{ parameterId: paramAmmonia.id, value: 2.1, confidence: 0.35, boundingBox: { x: 10, y: 20, w: 100, h: 200 } }] },
        },
    });
    await prisma.reviewRequest.create({ data: { sessionGroup: sgPendingSingle, statusRequest: "pending" } });

    // B) PENDING Paired
    const timePendingPaired = new Date(Date.now() - 1000 * 60 * 60 * 5);
    const sgPendingPaired = nextSessionGroup(timePendingPaired);
    await prisma.waterSample.create({
        data: {
            code: nextSampleCode(reviewLocation.id, timePendingPaired),
            collectorId: collectorA.id,
            locationId: reviewLocation.id,
            collectionTime: timePendingPaired,
            dissolvedOxygen: 6.0,
            airTemperature: 28.4,
            status: computeStatus(0, 0.15),
            sessionGroup: sgPendingPaired,
            measurements: { create: [{ parameterId: paramAmmonia.id, value: 0.15, confidence: 0.91, boundingBox: { x: 10, y: 20, w: 100, h: 200 } }] },
        },
    });
    await prisma.waterSample.create({
        data: {
            code: nextSampleCode(reviewLocation.id, timePendingPaired),
            collectorId: collectorA.id,
            locationId: reviewLocation.id,
            collectionTime: timePendingPaired,
            dissolvedOxygen: 6.0,
            airTemperature: 28.4,
            status: computeStatus(0.6, 0),
            sessionGroup: sgPendingPaired,
            measurements: { create: [{ parameterId: paramPhosphate.id, value: 0.6, confidence: 0.42, boundingBox: { x: 15, y: 25, w: 110, h: 210 } }] },
        },
    });
    await prisma.reviewRequest.create({ data: { sessionGroup: sgPendingPaired, statusRequest: "pending" } });

    // C) PENDING Other
    const timePendingOther = new Date(Date.now() - 1000 * 60 * 60 * 8);
    const sgPendingOther = nextSessionGroup(timePendingOther);
    await prisma.waterSample.create({
        data: {
            code: nextSampleCode(insertedLocations[1].id, timePendingOther),
            collectorId: collectorB.id,
            locationId: insertedLocations[1].id,
            collectionTime: timePendingOther,
            status: computeStatus(0, 3.4),
            sessionGroup: sgPendingOther,
            measurements: { create: [{ parameterId: paramAmmonia.id, value: 3.4, confidence: 0.18, boundingBox: { x: 10, y: 20, w: 100, h: 200 } }] },
        },
    });
    await prisma.reviewRequest.create({ data: { sessionGroup: sgPendingOther, statusRequest: "pending" } });

    // D) APPROVED
    const timeApproved = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const sgApproved = nextSessionGroup(timeApproved);
    await prisma.waterSample.create({
        data: {
            code: nextSampleCode(reviewLocation.id, timeApproved),
            collectorId: collectorB.id,
            locationId: reviewLocation.id,
            collectionTime: timeApproved,
            status: computeStatus(0.02, 0),
            sessionGroup: sgApproved,
            measurements: { create: [{ parameterId: paramPhosphate.id, value: 0.02, confidence: 0.55, boundingBox: { x: 15, y: 25, w: 110, h: 210 } }] },
        },
    });
    await prisma.reviewRequest.create({
        data: {
            sessionGroup: sgApproved,
            statusRequest: "approved",
            reviewedById: adminUser.id,
            reviewedAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
        },
    });

    // E) REJECTED
    const timeRejected = new Date(Date.now() - 1000 * 60 * 60 * 48);
    const sgRejected = nextSessionGroup(timeRejected);
    await prisma.waterSample.create({
        data: {
            code: nextSampleCode(insertedLocations[2].id, timeRejected),
            collectorId: collectorA.id,
            locationId: insertedLocations[2].id,
            collectionTime: timeRejected,
            status: computeStatus(0, 4.5),
            sessionGroup: sgRejected,
            isDeleted: true,
            lastModifiedBy: adminUser.id,
            measurements: { create: [{ parameterId: paramAmmonia.id, value: 4.5, confidence: 0.28, boundingBox: { x: 10, y: 20, w: 100, h: 200 } }] },
        },
    });
    await prisma.reviewRequest.create({
        data: {
            sessionGroup: sgRejected,
            statusRequest: "rejected",
            reviewedById: adminUser.id,
            reviewedAt: new Date(Date.now() - 1000 * 60 * 60 * 40),
            reviewNote: "ภาพเบลอ มองไม่เห็นสีของเหลวชัดเจน กรุณาถ่ายใหม่",
        },
    });

    console.log("   ✔ Pending: 3 sessions | Approved: 1 | Rejected: 1");
    console.log("\n✅ Seeding completed successfully!");
}

main()
    .catch((e) => {
        console.error("❌ Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
