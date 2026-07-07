/**
 * prisma/seed.ts — Database seed สำหรับโครงสร้างใหม่ตาม schema.prisma จริงของบอส
 * ─────────────────────────────────────────────────────────
 * รัน: npm run seed หรือ npx prisma db seed
 */

import { PrismaClient, WaterStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting database seeding based on actual schema.prisma...");

    // 1. Clean existing data (ลบตามลำดับป้องกัน Foreign Key Constraints)
    console.log("🧹 Cleaning existing data...");
    await prisma.dashboardWidget.deleteMany();
    await prisma.roleRequest.deleteMany();
    await prisma.waterSampleMeasurement.deleteMany();
    await prisma.waterSample.deleteMany();
    await prisma.parameter.deleteMany();
    await prisma.location.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();

    // ─── 2. ROLES SEEDING ───
    console.log("🔒 Creating system roles...");
    const roleAdmin = await prisma.role.create({ data: { roleName: "admin" } });
    const roleOfficer = await prisma.role.create({ data: { roleName: "officer" } });
    const roleCollector = await prisma.role.create({ data: { roleName: "collector" } });
    const roleGuest = await prisma.role.create({ data: { data: { roleName: "guest" } } as any }).catch(() => prisma.role.create({ data: { roleName: "guest" } }));

    // ─── 3. PARAMETERS SEEDING (สร้างมาสเตอร์สารเคมีเริ่มต้น) ───
    console.log("🧪 Creating parameter master data...");
    const paramAmmonia = await prisma.parameter.create({
        data: { name: "ammonia", unit: "mg/L", description: "สารแอมโมเนียในน้ำ (NH3)" },
    });

    const paramPhosphate = await prisma.parameter.create({
        data: { name: "phosphate", unit: "mg/L", description: "สารฟอสเฟตในน้ำ (PO4)" },
    });

    const paramNitrate = await prisma.parameter.create({
        data: { name: "nitrate", unit: "mg/L", description: "สารไนเตรตในน้ำ (NO3)" },
    });

    const paramPH = await prisma.parameter.create({
        data: { name: "ph_value", unit: "pH", description: "ดัชนีความเป็นกรด-ด่างเฉลี่ย (pH)" },
    });

    const paramTSS = await prisma.parameter.create({
        data: { name: "suspended_solids", unit: "mg/L", description: "ปริมาณสารแขวนลอยรวมในน้ำทะเล (TSS)" },
    });

    // ─── 4. DASHBOARD WIDGETS SEEDING (ผูกโครงสร้างตามคอลัมน์และ Parameter ID ของบอสจริง) ───
    console.log("📊 Injecting dynamic dashboard blueprints linked with parameters...");

    // ไอดี 1-7 ตามของเดิมในตารางบอส
    await prisma.dashboardWidget.create({
        data: { title: "จำนวนตัวอย่างน้ำทะเลทั้งหมด", widgetType: "CARD", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: null, cardColor: "blue", w: 3 },
    });
    await prisma.dashboardWidget.create({
        data: { title: "คุณภาพน้ำในเกณฑ์ปลอดภัย", widgetType: "CARD", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: null, filterValue: "safe", cardColor: "green", w: 3 },
    });
    await prisma.dashboardWidget.create({
        data: { title: "จุดวิกฤตคุณภาพน้ำอันตราย", widgetType: "CARD", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: null, filterValue: "danger", cardColor: "red", w: 3 },
    });
    await prisma.dashboardWidget.create({
        data: { title: "ค่าเฉลี่ยปริมาณออกซิเจนละลาย (DO)", widgetType: "CARD", metricType: "AVG", targetType: "ENVIRONMENT", targetColumn: "dissolved_oxygen", cardColor: "blue", w: 3 },
    });
    await prisma.dashboardWidget.create({
        data: { title: "สัดส่วนดัชนีคุณภาพน้ำทะเลรวม", widgetType: "PIE_CHART", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: null, cardColor: "blue", w: 6 },
    });
    await prisma.dashboardWidget.create({
        data: { title: "แนวโน้มการเปลี่ยนแปลงระดับความเข้มข้นสารเคมีรายเดือน", widgetType: "BAR_CHART", metricType: "AVG", targetType: "PARAMETER", targetColumn: null, cardColor: "blue", w: 6 },
    });
    await prisma.dashboardWidget.create({
        data: { title: "สหสัมพันธ์แนวโน้มปริมาณน้ำฝนสะสม", widgetType: "LINE_CHART", metricType: "AVG", targetType: "ENVIRONMENT", targetColumn: "rain_accumulation", cardColor: "blue", w: 12 },
    });

    // 🚀 ไอดี 8-11: เพิ่มการ์ดพารามิเตอร์สารเคมีสำคัญ โดยผูก `parameterId` ตรงสเปก schema จริงของบอส!
    await prisma.dashboardWidget.create({
        data: {
            title: "ค่าเฉลี่ยปริมาณแอมโมเนียในน้ำ (NH3)",
            widgetType: "CARD",
            metricType: "AVG",
            targetType: "PARAMETER",
            targetColumn: null,
            parameterId: paramAmmonia.id,
            cardColor: "yellow",
            w: 3,
        },
    });
    await prisma.dashboardWidget.create({
        data: {
            title: "ค่าเฉลี่ยปริมาณฟอสเฟตสะสม (PO4)",
            widgetType: "CARD",
            metricType: "AVG",
            targetType: "PARAMETER",
            targetColumn: null,
            parameterId: paramPhosphate.id,
            cardColor: "indigo",
            w: 3,
        },
    });
    await prisma.dashboardWidget.create({
        data: { title: "ดัชนีความเป็นกรด-ด่างเฉลี่ย (pH)", widgetType: "CARD", metricType: "AVG", targetType: "PARAMETER", targetColumn: null, parameterId: paramPH.id, cardColor: "pink", w: 3 },
    });
    await prisma.dashboardWidget.create({
        data: { title: "ปริมาณสารแขวนลอยรวมในน้ำทะเล (TSS)", widgetType: "CARD", metricType: "AVG", targetType: "PARAMETER", targetColumn: null, parameterId: paramTSS.id, cardColor: "teal", w: 3 },
    });

    // ─── 5. USERS SEEDING ───
    console.log("👤 Creating users...");
    await prisma.user.create({
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
    ];

    const insertedLocations = [];
    for (const loc of locationsPayload) {
        const createdLoc = await prisma.location.create({
            data: { stationName: loc.stationName, governingAgency: loc.governingAgency, latitude: loc.latitude, longitude: loc.longitude },
        });
        insertedLocations.push(createdLoc);
    }

    // ─── 8. WATER SAMPLES WITH PARAMETER MEASUREMENTS (250 ตัวอย่างย้อนหลัง) ───
    console.log("🧪 Generating 250 water samples with actual required EAV fields...");
    const samplesCount = 250;

    for (let i = 0; i < samplesCount; i++) {
        const daysAgo = Math.floor(Math.random() * 180);
        const hourAgo = Math.floor(Math.random() * 24);
        const sampleDate = new Date();
        sampleDate.setDate(sampleDate.getDate() - daysAgo);
        sampleDate.setHours(sampleDate.getHours() - hourAgo);

        const randomCollectorObj = collectors[i % collectors.length];
        const randomLocation = insertedLocations[Math.floor(Math.random() * insertedLocations.length)];

        const rainVol = Math.random() > 0.6 ? parseFloat((Math.random() * 45).toFixed(2)) : 0;
        let computedStatus: WaterStatus = WaterStatus.safe;
        let weatherCode = 1;

        if (rainVol > 30) {
            computedStatus = WaterStatus.danger;
            weatherCode = 7;
        } else if (rainVol > 10) {
            computedStatus = WaterStatus.warning;
            weatherCode = 5;
        } else {
            computedStatus = WaterStatus.safe;
            weatherCode = 1;
        }

        const ammoniaValue =
            computedStatus === WaterStatus.danger
                ? parseFloat((1.5 + Math.random() * 2).toFixed(2))
                : computedStatus === WaterStatus.warning
                  ? parseFloat((0.5 + Math.random() * 1).toFixed(2))
                  : parseFloat((Math.random() * 0.4).toFixed(2));
        const phosphateValue =
            computedStatus === WaterStatus.danger
                ? parseFloat((0.8 + Math.random() * 1.5).toFixed(2))
                : computedStatus === WaterStatus.warning
                  ? parseFloat((0.2 + Math.random() * 0.6).toFixed(2))
                  : parseFloat((Math.random() * 0.19).toFixed(2));
        const nitrateValue = parseFloat((0.2 + Math.random() * 3).toFixed(2));

        const doValue = parseFloat((3.5 + Math.random() * 5).toFixed(1));
        const tempValue = parseFloat((26 + Math.random() * 5).toFixed(1));

        const phValue = parseFloat((6.5 + Math.random() * 2).toFixed(2));
        const tssValue = parseFloat((10 + Math.random() * 140).toFixed(1));

        // บันทึกลงตารางตามฟิลด์แวดล้อมจริงที่มีในโครงสร้างโมเดลบอสเท่านั้น ปราศจากฟิลด์ส่วนเกิน
        await prisma.waterSample.create({
            data: {
                collectorId: randomCollectorObj.id,
                locationId: randomLocation.id,
                collectionTime: sampleDate,
                dissolvedOxygen: doValue,
                airTemperature: tempValue,
                rainAccumulation: rainVol,
                weatherCondCode: weatherCode,
                status: computedStatus,
                rawImageUrl: Math.random() > 0.5 ? `/uploads/mock-raw.jpg` : null,
                analyzedPlotUrl: Math.random() > 0.5 ? `/uploads/mock-plot.jpg` : null,

                // 🧪 บันทึกข้อมูลผ่านตารางลูก Junction Table พร้อมส่งค่า Required: confidence และ boundingBox
                measurements: {
                    create: [
                        { parameterId: paramAmmonia.id, value: ammoniaValue, confidence: 0.92, boundingBox: "[10,20,100,200]" },
                        { parameterId: paramPhosphate.id, value: phosphateValue, confidence: 0.89, boundingBox: "[15,25,110,210]" },
                        { parameterId: paramNitrate.id, value: nitrateValue, confidence: 0.94, boundingBox: "[20,30,120,220]" },
                        { parameterId: paramPH.id, value: phValue, confidence: 0.98, boundingBox: "[5,10,50,100]" },
                        { parameterId: paramTSS.id, value: tssValue, confidence: 0.85, boundingBox: "[30,40,150,250]" },
                    ],
                },
            },
        });
    }

    console.log("\n✅ Seeding completed successfully with exact EAV compliance!");
}

main()
    .catch((e) => {
        console.error("❌ Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
