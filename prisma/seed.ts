/**
 * prisma/seed.ts — Database seed สำหรับทดสอบระบบตรวจวัดคุณภาพน้ำชายฝั่ง
 *
 * ข้อมูลที่สร้างทั้งหมด:
 * ─────────────────────────────────────────────────────────
 * USERS (11 คน)
 *   - ADMIN      1 คน  : สมชาย แอดมินระบบ
 *   - EXECUTIVE  1 คน  : อนันต์ บริหารศุลกากร
 *   - COLLECTOR  3 คน  : วิชัย, มานี, สมศรี
 *   - GENERAL    6 คน  : ผู้ใช้ทั่วไปรอการอนุมัติ (ใช้ทดสอบหน้า Admin Users)
 *
 * LOCATIONS (12 จุด)
 *   - อ่าวไทยฝั่งตะวันออก ครอบคลุมตั้งแต่ปากแม่น้ำบางปะกง → เกาะเสม็ด → คุ้งกระเบน
 *   - หน่วยงาน: กรมประมง, กรมควบคุมมลพิษ, หน่วยงานส่วนท้องถิ่น
 *
 * WATER SAMPLES (250 ตัวอย่าง)
 *   - กระจายใน 180 วันย้อนหลัง
 *   - สุ่ม 3 สถานะ: SAFE / WARNING / DANGER สัมพันธ์กับปริมาณฝน
 *   - มีข้อมูลสภาพอากาศ: อุณหภูมิ, ปริมาณฝน, รหัสสภาพอากาศ
 *   - มีค่าเคมี: แอมโมเนีย (ammonia), ฟอสเฟต (phosphate), ออกซิเจน (oxygen)
 *   - บางตัวอย่างมี imageUrl (picsum.photos)
 * ─────────────────────────────────────────────────────────
 * รัน: npm run seed
 */

import { PrismaClient, Role, WaterStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting database seeding...");

    // 1. Clean existing data (ลบตามลำดับ FK)
    console.log("🧹 Cleaning existing data...");
    await prisma.waterSample.deleteMany();
    await prisma.location.deleteMany();
    await prisma.user.deleteMany();

    // ─── 2. USERS ────────────────────────────────────────────────

    console.log("👤 Creating users...");

    // ADMIN
    const admin = await prisma.user.create({
        data: {
            lineId: "U_ADMIN_999",
            name: "สมชาย แอดมินระบบ",
            role: Role.ADMIN,
            phone: "0812345678",
        },
    });

    // EXECUTIVE
    const executive = await prisma.user.create({
        data: {
            lineId: "U_EXEC_888",
            name: "อนันต์ บริหารศุลกากร",
            role: Role.EXECUTIVE,
            phone: "0822223333",
        },
    });

    // COLLECTORS
    const collectors = await Promise.all([
        prisma.user.create({
            data: {
                lineId: "COL_001",
                name: "วิชัย เก็บตัวอย่าง 1",
                role: Role.COLLECTOR,
                phone: "0891112222",
            },
        }),
        prisma.user.create({
            data: {
                lineId: "COL_002",
                name: "มานี เก็บตัวอย่าง 2",
                role: Role.COLLECTOR,
                phone: "0892223333",
            },
        }),
        prisma.user.create({
            data: {
                lineId: "COL_003",
                name: "สมศรี นักวิจัยชายฝั่ง",
                role: Role.COLLECTOR,
                phone: "0893334444",
            },
        }),
    ]);

    // GENERAL — ผู้ใช้รอการอนุมัติ (ใช้ทดสอบหน้า Admin > จัดการผู้ใช้งาน)
    await Promise.all([
        prisma.user.create({
            data: {
                lineId: "GEN_001",
                name: "ประยุทธ์ รอสิทธิ์",
                role: Role.GENERAL,
                phone: "0811111111",
            },
        }),
        prisma.user.create({
            data: {
                lineId: "GEN_002",
                name: "สุดา อยากเป็นคอลเลกเตอร์",
                role: Role.GENERAL,
                phone: "0822222222",
            },
        }),
        prisma.user.create({
            data: {
                lineId: "GEN_003",
                name: "ธนกร นักศึกษาวิทยาศาสตร์",
                role: Role.GENERAL,
                phone: null,
            },
        }),
        prisma.user.create({
            data: {
                lineId: "GEN_004",
                name: "อรุณี เจ้าหน้าที่ใหม่",
                role: Role.GENERAL,
                phone: "0844444444",
            },
        }),
        prisma.user.create({
            data: {
                lineId: "GEN_005",
                name: "ชัยวัฒน์ ประมงชายฝั่ง",
                role: Role.GENERAL,
                phone: "0855555555",
            },
        }),
        prisma.user.create({
            data: {
                lineId: "GEN_006",
                name: "พิมพ์ใจ อาสาสมัคร",
                role: Role.GENERAL,
                phone: null,
            },
        }),
    ]);

    // ─── 3. LOCATIONS ─────────────────────────────────────────────

    console.log("📍 Creating locations...");
    const locationData = [
        { name: "ปากแม่น้ำบางปะกง",         agency: "กรมประมง",                lat: 13.4543, lon: 100.9823 },
        { name: "อ่าวศรีราชา",               agency: "กรมประมง",                lat: 13.1676, lon: 100.9267 },
        { name: "ท่าเรือแหลมฉบัง",           agency: "กรมควบคุมมลพิษ",          lat: 13.0833, lon: 100.8833 },
        { name: "คลองอุตสาหกรรมมาบตาพุด",    agency: "กรมควบคุมมลพิษ",          lat: 12.7283, lon: 101.1561 },
        { name: "หาดบางแสน",                 agency: "หน่วยงานส่วนท้องถิ่น",     lat: 13.2833, lon: 100.9167 },
        { name: "เกาะสีชัง",                 agency: "หน่วยงานส่วนท้องถิ่น",     lat: 13.1547, lon: 100.8122 },
        { name: "หาดพัทยาเหนือ",             agency: "หน่วยงานส่วนท้องถิ่น",     lat: 12.9482, lon: 100.8841 },
        { name: "เกาะล้าน",                  agency: "หน่วยงานส่วนท้องถิ่น",     lat: 12.9184, lon: 100.7785 },
        { name: "ปากน้ำประแสร์",             agency: "กรมประมง",                lat: 12.6984, lon: 101.7051 },
        { name: "หาดทรายแก้ว เกาะเสม็ด",    agency: "หน่วยงานส่วนท้องถิ่น",     lat: 12.5684, lon: 101.4651 },
        { name: "อ่าวคุ้งกระเบน",            agency: "กรมประมง",                lat: 12.5852, lon: 101.9023 },
        { name: "หาดเจ้าหลาว",              agency: "หน่วยงานส่วนท้องถิ่น",     lat: 12.5583, lon: 101.9167 },
    ];

    const locations = await Promise.all(
        locationData.map((loc) => prisma.location.create({ data: loc })),
    );

    // ─── 4. WATER SAMPLES ─────────────────────────────────────────

    console.log("🧪 Generating 250 water samples...");
    const samples = [];
    const now = new Date();

    for (let i = 0; i < 250; i++) {
        const loc       = locations[Math.floor(Math.random() * locations.length)];
        const collector = collectors[Math.floor(Math.random() * collectors.length)];

        // กระจาย 180 วันย้อนหลัง
        const daysAgo = Math.floor(Math.random() * 180);
        const collectionTime = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        const hours = [8, 9, 10, 11, 13, 14, 15, 16, 17];
        collectionTime.setHours(hours[Math.floor(Math.random() * hours.length)], Math.floor(Math.random() * 60), 0, 0);

        // จำลองสภาพอากาศ → กำหนดค่าเคมีและสถานะน้ำ
        const isHeavyRain  = Math.random() > 0.82;
        const hasLightRain = !isHeavyRain && Math.random() > 0.7;

        let rainVolume: number, temp: number, weatherCondition: number;
        let phosphate: number, ammonia: number, oxygen: number;
        let status: WaterStatus;

        if (isHeavyRain) {
            rainVolume       = parseFloat((12.0 + Math.random() * 20.0).toFixed(1));
            weatherCondition = Math.random() > 0.4 ? 7 : 8;
            temp             = parseFloat((25.0 + Math.random() * 3.0).toFixed(1));
            oxygen           = parseFloat((3.5  + Math.random() * 1.5).toFixed(1));
            phosphate        = parseFloat((0.055 + Math.random() * 0.12).toFixed(4));
            ammonia          = parseFloat((0.75  + Math.random() * 0.9).toFixed(4));
            status           = WaterStatus.DANGER;
        } else if (hasLightRain) {
            rainVolume       = parseFloat((0.5 + Math.random() * 3.0).toFixed(1));
            weatherCondition = 5;
            temp             = parseFloat((28.0 + Math.random() * 4.0).toFixed(1));
            oxygen           = parseFloat((4.5  + Math.random() * 1.5).toFixed(1));
            phosphate        = parseFloat((0.016 + Math.random() * 0.02).toFixed(4));
            ammonia          = parseFloat((0.22  + Math.random() * 0.35).toFixed(4));
            status           = WaterStatus.WARNING;
        } else {
            rainVolume       = 0;
            weatherCondition = Math.random() > 0.5 ? 1 : 2;
            temp             = parseFloat((28.0 + Math.random() * 5.0).toFixed(1));
            oxygen           = parseFloat((5.5  + Math.random() * 2.0).toFixed(1));
            phosphate        = parseFloat((0.002 + Math.random() * 0.012).toFixed(4));
            ammonia          = parseFloat((0.02  + Math.random() * 0.16).toFixed(4));
            status           = WaterStatus.SAFE;
        }

        samples.push({
            locationId:       loc.id,
            collectorId:      collector.id,
            phosphate,
            ammonia,
            oxygen,
            temperature:      temp,
            rainVolume,
            weatherCondition,
            status,
            collectionTime,
            uploadedAt:       new Date(collectionTime.getTime() + 10 * 60 * 1000),
            imageUrl:         Math.random() > 0.65 ? `https://picsum.photos/seed/${i}/400/400` : null,
            imageExpiresAt:   new Date(collectionTime.getTime() + 90 * 24 * 60 * 60 * 1000),
            updatedAt:        new Date(),
        });
    }

    console.log("⚡ Inserting samples...");
    await prisma.waterSample.createMany({ data: samples });

    // ─── Summary ──────────────────────────────────────────────────

    console.log("\n✅ Seeding completed!");
    console.log(`   👑 Admin      : 1 คน  (${admin.name})`);
    console.log(`   📊 Executive  : 1 คน  (${executive.name})`);
    console.log(`   🔬 Collector  : ${collectors.length} คน`);
    console.log(`   ⏳ General    : 6 คน  (รอการอนุมัติ)`);
    console.log(`   📍 Locations  : ${locations.length} จุด`);
    console.log(`   🧪 Samples    : ${samples.length} ตัวอย่าง`);
}

main()
    .catch((e) => {
        console.error("❌ Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
