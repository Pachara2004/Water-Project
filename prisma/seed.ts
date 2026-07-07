/**
 * prisma/seed.ts — Database seed สำหรับโครงสร้างใหม่รองรับการขยายชนิดสารเคมี (EAV Pattern)
 * ─────────────────────────────────────────────────────────
 * รัน: npx prisma db seed
 */

import { PrismaClient, WaterStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting database seeding based on new EAV schema...");

    // 1. Clean existing data (ลบตามลำดับจากตารางลูกไปตารางแม่เพื่อเลี่ยง Foreign Key Constraints)
    console.log("🧹 Cleaning existing data...");
    await (prisma as any).dashboardWidget.deleteMany(); // เคลียร์ตารางพิมพ์เขียวแดชบอร์ด
    await prisma.roleRequest.deleteMany();
    await prisma.waterSampleMeasurement.deleteMany(); // ลบรายการบันทึกผลสารก่อน
    await prisma.waterSample.deleteMany();
    await prisma.parameter.deleteMany(); // ลบตารางมาสเตอร์สารเคมี
    await prisma.location.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();

    // ─── 2. ROLES SEEDING (สร้างสิทธิ์ 4 กลุ่มหลัก) ───
    console.log("🔒 Creating system roles...");
    const roleAdmin = await prisma.role.create({ data: { roleName: "admin" } });
    const roleOfficer = await prisma.role.create({ data: { roleName: "officer" } });
    const roleCollector = await prisma.role.create({ data: { roleName: "collector" } });
    const roleGuest = await prisma.role.create({ data: { roleName: "guest" } });

    // ─── 3. PARAMETERS SEEDING (สร้างมาสเตอร์สารเคมีเริ่มต้น + เพิ่มตัวแปรวิเคราะห์สำคัญ) ───
    console.log("🧪 Creating parameter master data...");
    const paramAmmonia = await prisma.parameter.create({
        data: {
            name: "ammonia",
            unit: "mg/L",
            description: "สารแอมโมเนียในน้ำ (NH3)",
        },
    });

    const paramPhosphate = await prisma.parameter.create({
        data: {
            name: "phosphate",
            unit: "mg/L",
            description: "สารฟอสเฟตในน้ำ (PO4)",
        },
    });

    const paramNitrate = await prisma.parameter.create({
        data: {
            name: "nitrate",
            unit: "mg/L",
            description: "สารไนเตรตในน้ำ (NO3)",
        },
    });

    const paramHeavyMetal = await prisma.parameter.create({
        data: {
            name: "heavy metal",
            unit: "ppm",
            description: "ดัชนีสารปนเปื้อนโลหะหนักรวมในน้ำทะเล",
        },
    });

    // ─── 4. DASHBOARD WIDGETS SEEDING (ฝังพิมพ์เขียวจัดอันดับการ์ด Dynamic 11 ชิ้นของบอส) ───
    console.log("📊 Injecting dynamic dashboard blueprints...");
    const widgetsPayload = [
        { title: "จำนวนตัวอย่างน้ำทะเลทั้งหมด", widgetType: "CARD", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: null },
        { title: "คุณภาพน้ำในเกณฑ์ปลอดภัย", widgetType: "CARD", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: "safe" },
        { title: "จุดวิกฤตคุณภาพน้ำอันตราย", widgetType: "CARD", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: "danger" },
        { title: "ค่าเฉลี่ยปริมาณออกซิเจนละลาย (DO)", widgetType: "CARD", metricType: "AVG", targetType: "ENVIRONMENT", targetColumn: "dissolved_oxygen" },
        { title: "สัดส่วนดัชนีคุณภาพน้ำทะเลรวม", widgetType: "PIE_CHART", metricType: "COUNT", targetType: "SAMPLE_STATUS", targetColumn: null },
        { title: "แนวโน้มการเปลี่ยนแปลงระดับความเข้มข้นสารเคมีรายเดือน", widgetType: "BAR_CHART", metricType: "AVG", targetType: "PARAMETER", targetColumn: null },
        { title: "สหสัมพันธ์แนวโน้มปริมาณน้ำฝนสะสม", widgetType: "LINE_CHART", metricType: "AVG", targetType: "ENVIRONMENT", targetColumn: "rain_accumulation" },
        // 🚀 เพิ่ม 4 ตัวท็อปที่สำคัญตามที่บอสสั่งรันใน MySQL
        { title: "ค่าเฉลี่ยปริมาณแอมโมเนียในน้ำ (NH3)", widgetType: "CARD", metricType: "AVG", targetType: "PARAMETER", targetColumn: "ammonia" },
        { title: "ค่าเฉลี่ยปริมาณฟอสเฟตสะสม (PO4)", widgetType: "CARD", metricType: "AVG", targetType: "PARAMETER", targetColumn: "phosphate" },
        { title: "ดัชนีความเป็นกรด-ด่างเฉลี่ย (pH)", widgetType: "CARD", metricType: "AVG", targetType: "ENVIRONMENT", targetColumn: "ph_value" },
        { title: "ปริมาณสารแขวนลอยรวมในน้ำทะเล (TSS)", widgetType: "CARD", metricType: "AVG", targetType: "ENVIRONMENT", targetColumn: "suspended_solids" },
    ];

    for (const widget of widgetsPayload) {
        await (prisma as any).dashboardWidget.create({
            data: {
                title: widget.title,
                widgetType: widget.widgetType,
                metricType: widget.metricType,
                targetType: widget.targetType,
                targetColumn: widget.targetColumn,
            },
        });
    }

    // ─── 5. USERS SEEDING (สร้างผู้ใช้จำลอง) ───
    console.log("👤 Creating users...");
    await prisma.user.create({
        data: {
            lineUniqueId: "U_ADMIN_999",
            lineProfileName: "Somchai_LINE",
            firstName: "สมชาย",
            lastName: "แอดมินระบบ",
            phoneNumber: "0812345678",
            roleId: roleAdmin.id,
        },
    });

    await prisma.user.create({
        data: {
            lineUniqueId: "U_EXEC_888",
            lineProfileName: "Anan_VIP",
            firstName: "อนันต์",
            lastName: "บริหารศุลกากร",
            phoneNumber: "0822223333",
            roleId: roleOfficer.id,
        },
    });

    const collectors = await Promise.all([
        prisma.user.create({
            data: {
                lineUniqueId: "COL_001",
                lineProfileName: "Wichai_Field",
                firstName: "วิชัย",
                lastName: "เก็บตัวอย่างที่หนึ่ง",
                phoneNumber: "0891112222",
                roleId: roleCollector.id,
            },
        }),
        prisma.user.create({
            data: {
                lineUniqueId: "COL_002",
                lineProfileName: "Manee_Ka",
                firstName: "มานี",
                lastName: "เก็บตัวอย่างที่สอง",
                phoneNumber: "0892223333",
                roleId: roleCollector.id,
            },
        }),
        prisma.user.create({
            data: {
                lineUniqueId: "COL_003",
                lineProfileName: "Somsri_SeaResearch",
                firstName: "สมศรี",
                lastName: "นักวิจัยชายฝั่ง",
                phoneNumber: "0893334444",
                roleId: roleCollector.id,
            },
        }),
    ]);

    const guests = await Promise.all([
        prisma.user.create({ data: { lineUniqueId: "GEN_001", lineProfileName: "P_Yut", firstName: "ประยุทธ์", lastName: "รอรับสิทธิ์", phoneNumber: "0811111111", roleId: roleGuest.id } }),
        prisma.user.create({ data: { lineUniqueId: "GEN_002", lineProfileName: "Suda_Cute", firstName: "สุดา", lastName: "อยากเป็นคอลเลกเตอร์", phoneNumber: "0822222222", roleId: roleGuest.id } }),
        prisma.user.create({ data: { lineUniqueId: "GEN_003", lineProfileName: "Thanakon_Sci", firstName: "ธนกร", lastName: "นักศึกษาวิทยาศาสตร์", phoneNumber: null, roleId: roleGuest.id } }),
        prisma.user.create({ data: { lineUniqueId: "GEN_004", lineProfileName: "Arunee_Newbie", firstName: "อรุณี", lastName: "เจ้าหน้าที่ใหม่", phoneNumber: "0844444444", roleId: roleGuest.id } }),
        prisma.user.create({
            data: { lineUniqueId: "GEN_005", lineProfileName: "Chaiwat_Fisherman", firstName: "ชัยวัฒน์", lastName: "ประมงชายฝั่ง", phoneNumber: "0855555555", roleId: roleGuest.id },
        }),
        prisma.user.create({ data: { lineUniqueId: "GEN_006", lineProfileName: "PimJai_Volunteer", firstName: "พิมพ์ใจ", lastName: "อาสาสมัคร", phoneNumber: null, roleId: roleGuest.id } }),
    ]);

    // ─── 6. ROLE REQUESTS SEEDING ───
    console.log("📝 Generating sample role requests from guests...");
    await prisma.roleRequest.create({ data: { userId: guests[0].id, requestedRoleId: roleOfficer.id, status: "pending" } });
    await prisma.roleRequest.create({ data: { userId: guests[1].id, requestedRoleId: roleCollector.id, status: "pending" } });
    await prisma.roleRequest.create({ data: { userId: guests[2].id, requestedRoleId: roleCollector.id, status: "pending" } });

    // ─── 7. LOCATIONS MONITORING STATIONS ───
    console.log("📍 Creating coastal monitoring stations...");
    const locationsPayload = [
        { stationName: "ปากแม่น้ำบางปะกง", governingAgency: "กรมประมง", latitude: 13.4543, longitude: 100.9823 },
        { stationName: "อ่าวศรีราชา", governingAgency: "กรมประมง", latitude: 13.1676, longitude: 100.9267 },
        { stationName: "ท่าเรือแหลมฉบัง", governingAgency: "กรมควบคุมมลพิษ", latitude: 13.0833, longitude: 100.8833 },
        { stationName: "คลองอุตสาหกรรมมาบตาพุด", governingAgency: "กรมควบคุมมลพิษ", latitude: 12.7283, longitude: 101.1561 },
        { stationName: "หาดบางแสน", governingAgency: "หน่วยงานส่วนท้องถิ่น", latitude: 13.2833, longitude: 100.9167 },
        { stationName: "หาดพัทยาเหนือ", governingAgency: "หน่วยงานส่วนท้องถิ่น", latitude: 12.9461, longitude: 100.8872 },
        { stationName: "หาดจอมเทียน", governingAgency: "หน่วยงานส่วนท้องถิ่น", latitude: 12.8767, longitude: 100.8752 },
        { stationName: "เกาะสีชัง จุดตรวจที่ 1", governingAgency: "กรมควบคุมมลพิษ", latitude: 13.1623, longitude: 100.8124 },
        { stationName: "แหลมฉบัง จุดจอดเรือ", governingAgency: "กรมควบคุมมลพิษ", latitude: 13.0921, longitude: 100.8931 },
        { stationName: "หาดตาแหวน เกาะล้าน", governingAgency: "หน่วยงานส่วนท้องถิ่น", latitude: 12.9231, longitude: 100.7761 },
        { stationName: "หาดแม่รำพึง", governingAgency: "กรมควบคุมมลพิษ", latitude: 12.6124, longitude: 101.4421 },
        { stationName: "อ่าวคุ้งกระเบน", governingAgency: "กรมประมง", latitude: 12.5732, longitude: 101.8924 },
    ];

    const insertedLocations = [];
    for (const loc of locationsPayload) {
        const createdLoc = await prisma.location.create({
            data: { stationName: loc.stationName, governingAgency: loc.governingAgency, latitude: loc.latitude, longitude: loc.longitude },
        });
        insertedLocations.push(createdLoc);
    }

    // ─── 8. WATER SAMPLES WITH PARAMETER MEASUREMENTS (250 ตัวอย่างย้อนหลัง) ───
    console.log("🧪 Generating 250 water samples with EAV measurements over last 180 days...");
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
        const heavyMetalValue = parseFloat((0.001 + Math.random() * 0.09).toFixed(3));

        const doValue = parseFloat((3.5 + Math.random() * 5).toFixed(1));
        const tempValue = parseFloat((26 + Math.random() * 5).toFixed(1));
        const phValue = parseFloat((6.5 + Math.random() * 2).toFixed(2));
        const tssValue = parseFloat((10 + Math.random() * 140).toFixed(1));

        // บันทึกลงตาราง WaterSample พร้อมเติมฟิลด์สิ่งแวดล้อมใหม่ลงโมเดลหลัก
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
                // แมปค่าใส่ช่องคอลัมน์ใหม่ตามโครงสร้างที่บอสเพิ่มในฐานข้อมูล
                phValue: phValue,
                suspendedSolids: tssValue,

                measurements: {
                    create: [
                        { parameterId: paramAmmonia.id, value: ammoniaValue },
                        { parameterId: paramPhosphate.id, value: phosphateValue },
                        { parameterId: paramNitrate.id, value: nitrateValue },
                        { parameterId: paramHeavyMetal.id, value: heavyMetalValue },
                    ],
                },
            },
        });
    }

    console.log("\n✅ Seeding completed successfully!");
    console.log(` 🔑 Roles created : admin, officer, collector, guest`);
    console.log(` 🧪 Parameters defined : ammonia, phosphate, nitrate, heavy metal`);
    console.log(` 📊 Layout injected : 11 config blueprints inserted into DashboardWidgets table.`);
    console.log(` 👥 Generated 250 history records with environment data.`);
}

main()
    .catch((e) => {
        console.error("❌ Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
