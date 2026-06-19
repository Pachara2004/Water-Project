import { PrismaClient, Role, WaterStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting database seeding with new UUID-based schema...");

    // 1. Clean existing data (ลบตามลำดับความสัมพันธ์ FK เพื่อไม่ให้ติด Error)
    console.log("🧹 Cleaning existing data...");
    await prisma.waterSample.deleteMany();
    await prisma.location.deleteMany();
    await prisma.user.deleteMany();

    // 2. Seed Users
    console.log("👤 Creating users with UUIDs...");

    // Admin user
    const admin = await prisma.user.create({
        data: {
            lineId: "U_ADMIN_999",
            name: "สมชาย แอดมินระบบ",
            role: Role.ADMIN,
            phone: "0812345678",
        },
    });

    // Executive user
    const executive = await prisma.user.create({
        data: {
            lineId: "U_EXEC_888",
            name: "อนันต์ บริหารศุลกากร",
            role: Role.EXECUTIVE,
            phone: "0822223333",
        },
    });

    // Collector users
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

    // 3. Seed Locations (12 locations across Gulf of Thailand)
    console.log("📍 Creating locations...");
    const locationData = [
        {
            name: "ปากแม่น้ำบางปะกง",
            agency: "กรมประมง",
            lat: 13.4543,
            lon: 100.9823,
        },
        {
            name: "อ่าวศรีราชา",
            agency: "กรมประมง",
            lat: 13.1676,
            lon: 100.9267,
        },
        {
            name: "ท่าเรือแหลมฉบัง",
            agency: "กรมควบคุมมลพิษ",
            lat: 13.0833,
            lon: 100.8833,
        },
        {
            name: "คลองอุตสาหกรรมมาบตาพุด",
            agency: "กรมควบคุมมลพิษ",
            lat: 12.7283,
            lon: 101.1561,
        },
        {
            name: "หาดบางแสน",
            agency: "หน่วยงานส่วนท้องถิ่น",
            lat: 13.2833,
            lon: 100.9167,
        },
        {
            name: "เกาะสีชัง",
            agency: "หน่วยงานส่วนท้องถิ่น",
            lat: 13.1547,
            lon: 100.8122,
        },
        {
            name: "หาดพัทยาเหนือ",
            agency: "หน่วยงานส่วนท้องถิ่น",
            lat: 12.9482,
            lon: 100.8841,
        },
        {
            name: "เกาะล้าน",
            agency: "หน่วยงานส่วนท้องถิ่น",
            lat: 12.9184,
            lon: 100.7785,
        },
        {
            name: "ปากน้ำประแสร์",
            agency: "กรมประมง",
            lat: 12.6984,
            lon: 101.7051,
        },
        {
            name: "หาดทรายแก้ว เกาะเสม็ด",
            agency: "หน่วยงานส่วนท้องถิ่น",
            lat: 12.5684,
            lon: 101.4651,
        },
        {
            name: "อ่าวคุ้งกระเบน",
            agency: "กรมประมง",
            lat: 12.5852,
            lon: 101.9023,
        },
        {
            name: "หาดเจ้าหลาว",
            agency: "หน่วยงานส่วนท้องถิ่น",
            lat: 12.5583,
            lon: 101.9167,
        },
    ];

    const locations = await Promise.all(
        locationData.map((loc) =>
            prisma.location.create({
                data: {
                    name: loc.name,
                    agency: loc.agency,
                    lat: loc.lat,
                    lon: loc.lon,
                },
            }),
        ),
    );

    // 4. Seed Samples (250 samples spread over last 6 months with weather data)
    console.log("🧪 Generating 250 water samples with rainfall correlation...");
    const samples = [];
    const now = new Date();

    for (let i = 0; i < 250; i++) {
        const loc = locations[Math.floor(Math.random() * locations.length)];
        // ปรับปรุง: สุ่มเฉพาะจากกลุ่ม collectors เท่านั้น เพื่อให้ตรงตามสิทธิ์ในทางปฏิบัติ
        const collector =
            collectors[Math.floor(Math.random() * collectors.length)];

        // Spread over last 180 days
        const daysAgo = Math.floor(Math.random() * 180);
        const collectionTime = new Date(
            now.getTime() - daysAgo * 24 * 60 * 60 * 1000,
        );

        // Random hour of day (mostly morning or afternoon)
        const hours = [8, 9, 10, 11, 13, 14, 15, 16, 17];
        collectionTime.setHours(
            hours[Math.floor(Math.random() * hours.length)],
            Math.floor(Math.random() * 60),
            0,
            0,
        );

        // Weather Simulation
        const isHeavyRain = Math.random() > 0.82;
        let rainVolume = 0;
        let temp = parseFloat((28.0 + Math.random() * 5.0).toFixed(1));
        let weatherCondition = 1;

        let phosphate = 0;
        let ammonia = 0;
        let status: WaterStatus = WaterStatus.SAFE;
        let oxygen = parseFloat((5.5 + Math.random() * 2.0).toFixed(1));

        if (isHeavyRain) {
            // Simulate heavy monsoon storm
            rainVolume = parseFloat((12.0 + Math.random() * 20.0).toFixed(1));
            weatherCondition = Math.random() > 0.4 ? 7 : 8;
            temp = parseFloat((25.0 + Math.random() * 3.0).toFixed(1));
            oxygen = parseFloat((3.5 + Math.random() * 1.5).toFixed(1));

            phosphate = parseFloat((0.055 + Math.random() * 0.12).toFixed(4));
            ammonia = parseFloat((0.75 + Math.random() * 0.9).toFixed(4));
            status = WaterStatus.DANGER;
        } else {
            // Normal/dry or light rain conditions
            const hasLightRain = Math.random() > 0.7;
            if (hasLightRain) {
                rainVolume = parseFloat((0.5 + Math.random() * 3.0).toFixed(1));
                weatherCondition = 5;
                phosphate = parseFloat(
                    (0.016 + Math.random() * 0.02).toFixed(4),
                );
                ammonia = parseFloat((0.22 + Math.random() * 0.35).toFixed(4));
                status = WaterStatus.WARNING;
            } else {
                // Clear/cloudy weather
                rainVolume = 0;
                weatherCondition = Math.random() > 0.5 ? 1 : 2;
                phosphate = parseFloat(
                    (0.002 + Math.random() * 0.012).toFixed(4),
                );
                ammonia = parseFloat((0.02 + Math.random() * 0.16).toFixed(4));
                status = WaterStatus.SAFE;
            }
        }

        samples.push({
            locationId: loc.id,
            collectorId: collector.id,
            phosphate: phosphate,
            ammonia: ammonia,
            oxygen: oxygen,
            temperature: temp,
            rainVolume: rainVolume,
            weatherCondition: weatherCondition,
            status: status,
            collectionTime: collectionTime,
            uploadedAt: new Date(collectionTime.getTime() + 10 * 60 * 1000),
            imageUrl:
                Math.random() > 0.65
                    ? `https://picsum.photos/seed/${i}/400/400`
                    : null,
            imageExpiresAt: new Date(
                collectionTime.getTime() + 90 * 24 * 60 * 60 * 1000,
            ),

            updatedAt: new Date(),
        });
    }

    // Bulk create
    console.log("⚡ Inserting samples in database...");
    await prisma.waterSample.createMany({
        data: samples,
    });

    console.log("✅ Seeding completed!");
    console.log(`   - Admins Seeded: 1`);
    console.log(`   - Executives Seeded: 1`);
    console.log(`   - Collectors Seeded: ${collectors.length}`);
    console.log(`   - Locations Seeded: ${locations.length}`);
    console.log(`   - Samples Seeded: ${samples.length}`);
}

main()
    .catch((e) => {
        console.error("❌ Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
