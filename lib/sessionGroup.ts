import { Prisma } from "@prisma/client";

/**
 * GENERATOR: SessionGroup Format -> SES[YYMMDD][Sequence 0001-9999]
 *
 * ลำดับนับจากจำนวนกลุ่ม sessionGroup ที่ขึ้นต้นด้วย SES[YYMMDD] ของวันนั้น +1
 * ต้องเรียกภายใน transaction (tx) เพื่อให้การนับกับการเขียนอยู่ในสโคปเดียวกัน
 * ใช้ร่วมกันทั้งตอน submit (สร้างกลุ่มใหม่) และตอน review แยกกลุ่มสารที่ปฏิเสธออกจากกลุ่มที่อนุมัติ
 */
export async function generateSessionGroup(tx: Prisma.TransactionClient, collectionTime: Date): Promise<string> {
    const yy = String(collectionTime.getFullYear()).slice(-2);
    const mm = String(collectionTime.getMonth() + 1).padStart(2, "0");
    const dd = String(collectionTime.getDate()).padStart(2, "0");
    const datePrefix = `SES${yy}${mm}${dd}`;

    const startOfDay = new Date(collectionTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(collectionTime);
    endOfDay.setHours(23, 59, 59, 999);

    // นับกลุ่ม sessionGroup ที่เริ่มด้วย SES[YYMMDD] ในวันนั้น
    const groups = await tx.waterSample.groupBy({
        by: ["sessionGroup"],
        where: {
            collectionTime: { gte: startOfDay, lte: endOfDay },
            sessionGroup: { startsWith: datePrefix },
        },
    });

    const nextSeq = String(groups.length + 1).padStart(4, "0");
    return `${datePrefix}${nextSeq}`;
}
