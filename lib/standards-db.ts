import { prisma } from "@/lib/prisma";
import type { StandardRow } from "@/lib/standards";

/**
 * ตัวโหลดเกณฑ์มาตรฐานจากตาราง `standards`
 * ─────────────────────────────────────────────────────────
 * ⚠️ ฝั่ง server เท่านั้น — ห้าม import จาก client component
 *
 * แยกออกมาจาก lib/standards.ts เพราะไฟล์นั้นถูก import โดย client component ด้วย
 * (ResultsPanel / BottomSheet / StatusBadge) — ลาก prisma เข้าไปจะพัง client bundle
 * lib/standards.ts จึงต้องเหลือแต่ฟังก์ชันคำนวณล้วน ๆ ที่ไม่แตะ DB
 */

/** ดึงเกณฑ์ทั้งหมด (ทุกสาร × ทุกประเภทการใช้ประโยชน์) */
export async function loadAllStandards(): Promise<StandardRow[]> {
    return prisma.standard.findMany({
        select: { parameterId: true, maxValue: true },
    });
}

/** ดึงเกณฑ์เฉพาะสารที่สนใจ — ใช้เมื่อวิเคราะห์ทีละสาร ไม่ต้องลากทั้งตาราง */
export async function loadStandardsForParameters(parameterIds: number[]): Promise<StandardRow[]> {
    if (parameterIds.length === 0) return [];

    return prisma.standard.findMany({
        where: { parameterId: { in: parameterIds } },
        select: { parameterId: true, maxValue: true },
    });
}
