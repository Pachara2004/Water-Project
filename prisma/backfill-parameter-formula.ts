/**
 * เติมค่า Parameter.formula ให้สารที่ถูกสร้างไว้ก่อนจะมีคอลัมน์นี้
 *
 * ใช้แทนการรัน `npm run seed` บนฐานที่มีข้อมูลจริง — seed.ts เริ่มด้วย parameter.deleteMany()
 * ซึ่งจะลากผลตรวจที่ผูกอยู่หายไปด้วย สคริปต์นี้แตะแค่คอลัมน์ formula อย่างเดียว
 *
 * สูตรของสารที่ระบบรู้จักมาแต่แรกเท่านั้น สารที่แอดมินเพิ่มเองภายหลังไม่ถูกแตะ
 * (ปล่อยเป็น null ให้ฝั่งแสดงผลตกไปใช้ชื่อย่อ แล้วค่อยกรอกสูตรเองทีหลัง)
 *
 * รันซ้ำได้ — อัปเดตเฉพาะแถวที่ formula ยังเป็น null หรือว่าง ไม่ทับค่าที่คนกรอกไว้แล้ว
 *
 *   npx tsx prisma/backfill-parameter-formula.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** คีย์เป็นชื่อสารตัวพิมพ์เล็กตามคอลัมน์ `name` — ชุดเดียวกับที่ seed.ts สร้าง */
const KNOWN_FORMULA: Record<string, string> = {
    ammonia: "NH3",
    phosphate: "PO4",
};

async function main() {
    const pending = await prisma.parameter.findMany({
        where: { OR: [{ formula: null }, { formula: "" }] },
        select: { id: true, name: true },
    });

    if (pending.length === 0) {
        console.log("ไม่มีสารที่ต้องเติมสูตร — จบการทำงาน");
        return;
    }

    let updated = 0;
    const skipped: string[] = [];

    for (const param of pending) {
        const formula = KNOWN_FORMULA[param.name.trim().toLowerCase()];
        if (!formula) {
            skipped.push(param.name);
            continue;
        }
        await prisma.parameter.update({ where: { id: param.id }, data: { formula } });
        updated++;
        console.log(`  ${param.name}: ${formula}`);
    }

    console.log(`\nเติมแล้ว ${updated} สาร จากที่ค้างอยู่ ${pending.length} สาร`);
    if (skipped.length > 0) {
        console.log(`ข้าม ${skipped.length} สาร — ยังไม่รู้จักสูตร ต้องกรอกเองใน DB: ${skipped.join(", ")}`);
    }
}

main()
    .catch((e) => {
        console.error("backfill ล้มเหลว:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
