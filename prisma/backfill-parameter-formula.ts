/**
 * @file prisma/backfill-parameter-formula.ts
 * @project Water Monitoring Project
 * @module Prisma / Backfill Script
 * @description
 * สคริปต์เติมค่า Parameter.formula (สูตรเคมี เช่น NH3, PO4) ให้สารที่สร้างไว้ก่อนมีคอลัมน์นี้ ใช้แทนการรัน
 * seed บนฐานที่มีข้อมูลจริง เพราะ seed.ts เริ่มด้วย deleteMany ที่จะลากผลตรวจหายไปด้วย รันซ้ำได้:
 * อัปเดตเฉพาะแถวที่ formula ยัง null/ว่าง เติมเฉพาะสารที่ระบบรู้จักมาแต่แรก สารที่แอดมินเพิ่มเองข้ามไป
 *
 * One-off idempotent backfill of Parameter.formula for the built-in parameters; safe to run on
 * a database with real data, unlike the seed.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-09
 * @version 1.0.0
 *
 * @lastModified 2026-09-09 13:18
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-09-09 13:18 by Nopparut U. - สร้างสคริปต์คู่กับการเปลี่ยนป้ายสารเป็นสูตรเคมี
 *
 * @database Prisma Client (MySQL) ใช้ client ใหม่ในสคริปต์ ไม่ผ่าน lib/prisma
 * @notes สารที่ไม่รู้จักสูตรจะถูกรายงานให้กรอกเองใน DB; ฝั่งแสดงผลตกไปใช้ชื่อย่อจนกว่าจะกรอก
 * @example `npx tsx prisma/backfill-parameter-formula.ts`
 * @license Private / Proprietary
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** คีย์เป็นชื่อสารตัวพิมพ์เล็กตามคอลัมน์ `name` — ชุดเดียวกับที่ seed.ts สร้าง */
const KNOWN_FORMULA: Record<string, string> = {
    ammonia: "NH3",
    phosphate: "PO4",
};

/** ค้นสารที่ยังไม่มีสูตร เติมจาก KNOWN_FORMULA ทีละแถว และรายงานสารที่ไม่รู้จัก */
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
