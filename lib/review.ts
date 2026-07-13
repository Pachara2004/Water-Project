import { prisma } from "@/lib/prisma";

/**
 * คืนรายชื่อ sessionGroup ทั้งหมดที่ยังอยู่ในสถานะ pending (รอ admin ตัดสิน)
 *
 * ทุก read path ที่ต้องรู้ว่า session ไหน "รออนุมัติ" ต้องเรียกฟังก์ชันนี้ตัวเดียว
 * ห้ามเขียน query `reviewRequest.findMany({ where: { statusRequest: "pending" } })` ซ้ำที่อื่น
 * เพื่อกันไม่ให้เกณฑ์การซ่อนข้อมูล pending เพี้ยนไปคนละแบบระหว่างจุดต่าง ๆ (map / dashboard / ประวัติ)
 *
 * การใช้งานต่างกันตาม surface:
 * - แผนที่ / dashboard (ข้อมูลรวมทุกคน): ใช้ผลลัพธ์นี้เป็น `sessionGroup: { notIn: pendingGroups } ` เพื่อซ่อน pending ทั้งหมด
 * - ประวัติของ collector เอง (scope ด้วย collectorId อยู่แล้ว): ใช้ผลลัพธ์นี้แค่ "ติด badge" ว่ารายการไหนรออนุมัติ ไม่ใช้กรองทิ้ง
 */
export async function getPendingSessionGroups(): Promise<string[]> {
    const rows = await prisma.reviewRequest.findMany({
        where: { statusRequest: "pending" },
        select: { sessionGroup: true },
    });
    return rows.map((r) => r.sessionGroup);
}
