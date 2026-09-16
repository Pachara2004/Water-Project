/**
 * @file prisma/backfill-governing-agency.ts
 * @project Water Monitoring Project
 * @module Prisma / Backfill Script
 * @description
 * สคริปต์เติมค่า SampleRecord.governingAgencyFrom ให้เรคคอร์ดที่บันทึกไว้ก่อนมีคอลัมน์นี้ โดยดึงหน่วยงาน
 * "ปัจจุบัน" ของสถานีผ่าน locationNameCurrentId (เรคคอร์ดเก่าไม่ได้เก็บหน่วยงาน ณ วันบันทึกไว้ที่ไหนเลย)
 * จับกลุ่มตามหน่วยงานแล้ว updateMany ทีเดียวต่อกลุ่ม รันซ้ำได้: แตะเฉพาะแถวที่ยังเป็น null
 * และข้ามสถานีที่ไม่ได้ระบุหน่วยงานหรือถูกลบไปแล้ว
 *
 * One-off idempotent backfill of SampleRecord.governingAgencyFrom from each station's current
 * agency, grouped into one updateMany per agency.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-08-26
 * @version 1.0.0
 *
 * @lastModified 2026-08-26 13:26
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-08-26 13:26 by Nopparut U. - สร้างสคริปต์คู่กับการแสดงชื่อหน่วยงานในหน้าประวัติแทนขีด
 *
 * @database Prisma Client (MySQL) ใช้ client ใหม่ในสคริปต์ ไม่ผ่าน lib/prisma
 * @warning ถ้าสถานีเคยย้ายหน่วยงาน ค่าที่เติมจะไม่ตรงกับความจริง ณ วันบันทึก; เรคคอร์ดใหม่ได้ค่าถูกจาก createSampleRecordSnapshot() เอง
 * @example `npx tsx prisma/backfill-governing-agency.ts`
 * @license Private / Proprietary
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** ค้นแถวที่ค้าง จับกลุ่มตามหน่วยงานปัจจุบันของสถานี แล้วอัปเดตเป็นก้อน พร้อมสรุปจำนวนที่เติม/ข้าม */
async function main() {
  const pending = await prisma.sampleRecord.findMany({
    where: { governingAgencyFrom: null, locationNameCurrentId: { not: null } },
    select: { id: true, locationNameCurrentId: true },
  });

  if (pending.length === 0) {
    console.log("ไม่มีแถวที่ต้องเติม — จบการทำงาน");
    return;
  }

  const locationIds = [...new Set(pending.map((r) => r.locationNameCurrentId!))];
  const locations = await prisma.location.findMany({
    where: { id: { in: locationIds } },
    select: { id: true, governingAgency: true },
  });
  const agencyById = new Map(locations.map((l) => [l.id, l.governingAgency]));

  // จับกลุ่มตามสถานี เพื่อยิง updateMany ทีเดียวต่อหนึ่งสถานี แทนการอัปเดตทีละแถว
  const idsByAgency = new Map<string, number[]>();
  let skippedNoAgency = 0;
  let skippedNoLocation = 0;

  for (const record of pending) {
    const agency = agencyById.get(record.locationNameCurrentId!);
    if (agency === undefined) {
      skippedNoLocation++; // สถานีถูกลบไปแล้ว ไม่มีอะไรให้อ้างอิง
      continue;
    }
    if (!agency) {
      skippedNoAgency++; // สถานีมีอยู่แต่ไม่ได้ระบุหน่วยงาน ปล่อยเป็น null ให้ฝั่งแสดงผลจัดการ
      continue;
    }
    if (!idsByAgency.has(agency)) idsByAgency.set(agency, []);
    idsByAgency.get(agency)!.push(record.id);
  }

  let updated = 0;
  for (const [agency, ids] of idsByAgency) {
    const result = await prisma.sampleRecord.updateMany({
      where: { id: { in: ids } },
      data: { governingAgencyFrom: agency },
    });
    updated += result.count;
    console.log(`  ${agency}: ${result.count} แถว`);
  }

  console.log(`\nเติมแล้ว ${updated} แถว จากที่ค้างอยู่ ${pending.length} แถว`);
  if (skippedNoAgency > 0) console.log(`ข้าม ${skippedNoAgency} แถว — สถานีไม่ได้ระบุหน่วยงาน`);
  if (skippedNoLocation > 0) console.log(`ข้าม ${skippedNoLocation} แถว — สถานีต้นทางถูกลบไปแล้ว`);
}

main()
  .catch((e) => {
    console.error("backfill ล้มเหลว:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
