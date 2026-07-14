/**
 * prisma/seed.ts — Database seed สำหรับโครงสร้างใหม่ตาม schema.prisma จริงของ
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
    await prisma.reviewRequest.deleteMany(); // ไม่มี FK จริงกับ samples (ผูกผ่าน sessionGroup string) แต่ต้องเคลียร์ก่อน reseed กัน @unique sessionGroup ชนกัน
    await prisma.waterSampleMeasurement.deleteMany();
    await prisma.waterSample.deleteMany();
    await prisma.parameter.deleteMany();
    await prisma.location.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();

    // MySQL ไม่รีเซ็ต AUTO_INCREMENT ให้เองตอน DELETE (ต่างจาก TRUNCATE) — รีเซ็ตมือทุกตารางกันเลข id ไต่สูงขึ้นเรื่อยๆ ทุกครั้งที่ reseed
    const tablesToResetAutoIncrement = ["dashboard_widgets", "role_requests", "review_requests", "sample_measurements", "samples", "parameters", "locations", "users", "roles"];
    for (const table of tablesToResetAutoIncrement) {
        await prisma.$executeRawUnsafe(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
    }

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

    // ─── 4. DASHBOARD WIDGETS SEEDING (ผูกโครงสร้างตามคอลัมน์และ Parameter ID ของจริง) ───
    console.log("📊 Injecting dynamic dashboard blueprints linked with parameters...");

    // ไอดี 1-7 ตามของเดิมในตาราง
    await prisma.dashboardWidget.create({
        data: { title: "จำนวนตัวอย่างน้ำทะเลทั้งหมด", widgetType: "CARD", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: null, cardColor: "blue", w: 3 },
    });
    await prisma.dashboardWidget.create({
        data: { title: "อัตราคุณภาพน้ำปลอดภัย (Safety Rate)", widgetType: "CARD", metricType: "RATE", targetType: "SAMPLE_STATUS", targetColumn: null, filterValue: "safe", unit: "%", cardColor: "green", w: 3 },
    });
    await prisma.dashboardWidget.create({
        data: { title: "ตัวอย่างที่เกินค่ามาตรฐาน (Danger)", widgetType: "CARD", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: null, filterValue: "danger", cardColor: "red", w: 3 },
    });
    await prisma.dashboardWidget.create({
        data: { title: "ตัวอย่างที่ต้องเฝ้าระวัง (Warning)", widgetType: "CARD", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: null, filterValue: "warning", cardColor: "yellow", w: 3 },
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
        // round-robin แทนสุ่มล้วน — การันตีว่าทุกสถานีมีตัวอย่างน้ำอย่างน้อย floor(samplesCount / จำนวนสถานี) ตัว ไม่ใช่แค่ "น่าจะมี"
        const randomLocation = insertedLocations[i % insertedLocations.length];

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
        const doValue = parseFloat((3.5 + Math.random() * 5).toFixed(1));
        const tempValue = parseFloat((26 + Math.random() * 5).toFixed(1));

        // sessionGroup เฉพาะตัวต่อ 1 ครั้งที่เก็บตัวอย่าง (ปกติแล้วจะใช้ร่วมกันระหว่างสารในรอบเดียวกัน)
        // ตั้งใจใส่ทุกแถวไม่ให้เป็น null — กัน query ฝั่ง map/dashboard ที่กรองด้วย sessionGroup: { notIn: ... }
        // พลาดคัดข้อมูลทิ้งหมดตอนมี pending review (ดูรายละเอียดใน lib/review.ts)
        const bulkSessionGroup = `SEED-BULK-${String(i + 1).padStart(4, "0")}`;

        // บันทึกลงตารางตามฟิลด์แวดล้อมจริงที่มีในโครงสร้างโมเดลเท่านั้น ปราศจากฟิลด์ส่วนเกิน
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
                sessionGroup: bulkSessionGroup,
                rawImageUrl: Math.random() > 0.5 ? `/uploads/mock-raw.jpg` : null,
                analyzedPlotUrl: Math.random() > 0.5 ? `/uploads/mock-plot.jpg` : null,

                // 🧪 บันทึกข้อมูลผ่านตารางลูก Junction Table พร้อมส่งค่า Required: confidence และ boundingBox
                measurements: {
                    create: [
                        { parameterId: paramAmmonia.id, value: ammoniaValue, confidence: 0.92, boundingBox: "[10,20,100,200]" },
                        { parameterId: paramPhosphate.id, value: phosphateValue, confidence: 0.89, boundingBox: "[15,25,110,210]" },
                    ],
                },
            },
        });
    }

    // ─── 9. CONFIDENCE REVIEW TEST DATA (pending / approved / rejected) ───
    // ข้อมูลชุดนี้ไว้ทดสอบฟีเจอร์ตรวจสอบผลที่ AI วิเคราะห์ confidence ต่ำกว่าเกณฑ์ (< 0.6)
    console.log("🔍 Generating confidence-review test scenarios (pending/approved/rejected)...");

    const reviewLocation = insertedLocations[0]; // ปากแม่น้ำบางปะกง
    const collectorA = collectors[0]; // วิชัย
    const collectorB = collectors[1]; // มานี

    // A) PENDING — เดี่ยว: 1 สาร confidence ต่ำ ยังไม่มีใครตัดสิน
    //    ทดสอบ: /manage/review-requests แท็บ "รออนุมัติ", badge "รออนุมัติ" ในประวัติของ collectorA,
    //    ต้องหายจากแผนที่ + dashboard
    const sgPendingSingle = "SEED-PENDING-01";
    await prisma.waterSample.create({
        data: {
            collectorId: collectorA.id,
            locationId: reviewLocation.id,
            collectionTime: new Date(Date.now() - 1000 * 60 * 60 * 3),
            dissolvedOxygen: 5.2,
            airTemperature: 29.1,
            status: WaterStatus.warning,
            sessionGroup: sgPendingSingle,
            rawImageUrl: "/uploads/mock-raw.jpg",
            analyzedPlotUrl: "/uploads/mock-plot.jpg",
            measurements: { create: [{ parameterId: paramAmmonia.id, value: 2.1, confidence: 0.35, boundingBox: "[10,20,100,200]" }] },
        },
    });
    await prisma.reviewRequest.create({ data: { sessionGroup: sgPendingSingle, statusRequest: "pending" } });

    // B) PENDING — ส่งแบบคู่: สารตัวหนึ่ง confidence ปกติ อีกตัวต่ำ แต่ "ทั้ง session" ต้อง pending ไปด้วยกัน
    //    ทดสอบ: 2 แถวในตารางแต่รวมเป็น 1 การ์ด และทั้ง 2 สารติด badge รออนุมัติพร้อมกัน
    const sgPendingPaired = "SEED-PENDING-02";
    await prisma.waterSample.create({
        data: {
            collectorId: collectorA.id,
            locationId: reviewLocation.id,
            collectionTime: new Date(Date.now() - 1000 * 60 * 60 * 5),
            dissolvedOxygen: 6.0,
            airTemperature: 28.4,
            status: WaterStatus.safe,
            sessionGroup: sgPendingPaired,
            measurements: { create: [{ parameterId: paramAmmonia.id, value: 0.15, confidence: 0.91, boundingBox: "[10,20,100,200]" }] },
        },
    });
    await prisma.waterSample.create({
        data: {
            collectorId: collectorA.id,
            locationId: reviewLocation.id,
            collectionTime: new Date(Date.now() - 1000 * 60 * 60 * 5),
            dissolvedOxygen: 6.0,
            airTemperature: 28.4,
            status: WaterStatus.warning,
            sessionGroup: sgPendingPaired,
            measurements: { create: [{ parameterId: paramPhosphate.id, value: 0.6, confidence: 0.42, boundingBox: "[15,25,110,210]" }] },
        },
    });
    await prisma.reviewRequest.create({ data: { sessionGroup: sgPendingPaired, statusRequest: "pending" } });

    // C) PENDING — ของ collectorB เผื่อทดสอบว่า collectorA มองไม่เห็นคำร้องของคนอื่น
    const sgPendingOther = "SEED-PENDING-03";
    await prisma.waterSample.create({
        data: {
            collectorId: collectorB.id,
            locationId: insertedLocations[1].id,
            collectionTime: new Date(Date.now() - 1000 * 60 * 60 * 8),
            status: WaterStatus.danger,
            sessionGroup: sgPendingOther,
            measurements: { create: [{ parameterId: paramAmmonia.id, value: 3.4, confidence: 0.18, boundingBox: "[10,20,100,200]" }] },
        },
    });
    await prisma.reviewRequest.create({ data: { sessionGroup: sgPendingOther, statusRequest: "pending" } });

    // D) APPROVED — เคย confidence ต่ำแต่ admin ตรวจสอบแล้วยืนยันผ่าน ควรกลับมาโชว์บนแผนที่/dashboard ตามปกติ
    const sgApproved = "SEED-APPROVED-01";
    await prisma.waterSample.create({
        data: {
            collectorId: collectorB.id,
            locationId: reviewLocation.id,
            collectionTime: new Date(Date.now() - 1000 * 60 * 60 * 24),
            status: WaterStatus.safe,
            sessionGroup: sgApproved,
            measurements: { create: [{ parameterId: paramPhosphate.id, value: 0.05, confidence: 0.55, boundingBox: "[15,25,110,210]" }] },
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

    // E) REJECTED — admin ปฏิเสธพร้อมเหตุผล ตัว WaterSample ถูก soft-delete (isDeleted=true) ตามพฤติกรรมจริงของระบบ
    const sgRejected = "SEED-REJECTED-01";
    await prisma.waterSample.create({
        data: {
            collectorId: collectorA.id,
            locationId: insertedLocations[2].id,
            collectionTime: new Date(Date.now() - 1000 * 60 * 60 * 48),
            status: WaterStatus.danger,
            sessionGroup: sgRejected,
            isDeleted: true,
            lastModifiedBy: adminUser.id,
            measurements: { create: [{ parameterId: paramAmmonia.id, value: 4.5, confidence: 0.28, boundingBox: "[10,20,100,200]" }] },
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

    console.log("   ✔ Pending: 3 sessions (1 เดี่ยว + 1 คู่ + 1 ของอีกคน) | Approved: 1 | Rejected: 1");

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
