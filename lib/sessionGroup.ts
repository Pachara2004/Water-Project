import type { TxClient } from "@/lib/prisma";
import { sameDayRange, toYymmdd } from "@/lib/thaiTime";

/**
 * GENERATOR: SessionGroup Format -> SES[YYMMDD][Sequence 0001-9999]
 *
 * ลำดับนับจากจำนวนกลุ่ม sessionGroup ที่ขึ้นต้นด้วย SES[YYMMDD] ของวันนั้น +1
 * ต้องเรียกภายใน transaction (tx) เพื่อให้การนับกับการเขียนอยู่ในสโคปเดียวกัน
 * ใช้ร่วมกันทั้งตอน submit (สร้างกลุ่มใหม่) และตอน review แยกกลุ่มสารที่ปฏิเสธออกจากกลุ่มที่อนุมัติ
 */
export async function generateSessionGroup(tx: TxClient, collectionTime: Date): Promise<string> {
    // วันของรหัสและขอบเขตวันคิดจากค่า UTC ของ Date ซึ่งคือปฏิทินไทย (ดู lib/thaiTime.ts) — ไม่ขึ้นกับ TZ ของ process
    const datePrefix = `SES${toYymmdd(collectionTime)}`;
    const { start, end } = sameDayRange(collectionTime);

    // นับกลุ่ม sessionGroup ที่เริ่มด้วย SES[YYMMDD] ในวันนั้น
    const groups = await tx.waterSample.groupBy({
        by: ["sessionGroup"],
        where: {
            collectionTime: { gte: start, lt: end },
            sessionGroup: { startsWith: datePrefix },
        },
    });

    const nextSeq = String(groups.length + 1).padStart(4, "0");
    return `${datePrefix}${nextSeq}`;
}
