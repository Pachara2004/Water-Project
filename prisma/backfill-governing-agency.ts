/**
 * เติมค่า SampleRecord.governingAgencyFrom ให้เรคคอร์ดที่บันทึกไว้ก่อนจะมีคอลัมน์นี้
 *
 * ข้อจำกัดที่ยอมรับแล้ว: เรคคอร์ดเก่าไม่ได้เก็บหน่วยงาน ณ วันที่บันทึกไว้ที่ไหนเลย
 * สคริปต์จึงดึงหน่วยงาน "ปัจจุบัน" ของสถานีผ่าน locationNameCurrentId มาเติมแทน
 * ถ้าสถานีเคยย้ายหน่วยงาน ค่าที่เติมจะไม่ตรงกับความจริง ณ วันนั้น
 * ส่วนเรคคอร์ดที่สร้างใหม่หลังจากนี้จะได้ค่าที่ถูกต้องจาก createSampleRecordSnapshot() เอง
 *
 * รันซ้ำได้ — แตะเฉพาะแถวที่ยังเป็น null และข้ามสถานีที่ไม่ได้ระบุหน่วยงาน
 *
 *   npx tsx prisma/backfill-governing-agency.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
