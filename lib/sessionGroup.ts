/**
 * @file lib/sessionGroup.ts
 * @project Water Monitoring Project
 * @module Core / Session Group Identifier Generator
 * @description
 * [TH] โมดูลสร้างรหัสกลุ่มตัวอย่างน้ำ (Session Group ID) ในรูปแบบ `SES[YYMMDD][0001-9999]`
 * ทำงานภายใต้ Prisma Interactive Transaction (`TxClient`) เพื่อรับประกันความสม่ำเสมอของลำดับคิวและป้องกัน Race Condition
 * ใช้ร่วมกันระหว่างขั้นตอนการส่งตัวอย่างน้ำชุดใหม่ (Submission) และขั้นตอนการแยกกลุ่มตัวอย่างน้ำที่ถูกปฏิเสธ (Partial Review Split)
 *
 * [EN] Deterministic Session Group identifier generator adhering to the `SES[YYMMDD][0001-9999]` schema.
 * Executes within a Prisma Interactive Transaction (`TxClient`) to ensure concurrency-safe sequential counting.
 * Shared across multi-sample submission workflows and review partitioning.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-24
 * @modified 2026-09-11
 * @version 1.2.0
 * @license Proprietary
 *
 * @see {@link /lib/prisma.ts} TxClient type definition
 * @see {@link /lib/thaiTime.ts} sameDayRange and toYymmdd Thai time utilities
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-24)
 *
 * @lastModified 2026-09-11
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: ยึดเวลาไทยเป็นนิยามเดียวของทุกคอลัมน์ DateTime ใน DB
 * - 2026-07-24 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: แก้ฟังก์ชันคำร้อง หากมี 2 สาร
 */

import type { TxClient } from "@/lib/prisma";
import { sameDayRange, toYymmdd } from "@/lib/thaiTime";

/**
 * [TH] สร้างรหัส Session Group ใหม่ตามรูปแบบ SES[YYMMDD][Sequence 0001-9999] ภายใน Transaction
 * นับจำนวน Session Group ที่มีอยู่แล้วในวันนั้นผ่าน `tx.waterSample.groupBy` แล้วบวก 1 พร้อมเติมเลขศูนย์ด้านหน้า 4 หลัก
 *
 * [EN] Generates next sequential session group code (`SES[YYMMDD][0001-9999]`) within an interactive database transaction.
 * Counts unique session groups recorded for the given date and pads sequence with 4 digits.
 *
 * @async
 * @function generateSessionGroup
 * @param {TxClient} tx - Prisma Transaction Client
 * @param {Date} collectionTime - เวลาเก็บตัวอย่างน้ำ (ใช้คำนวณวันตามเวลาท้องถิ่นไทย)
 * @returns {Promise<string>} รหัส Session Group ใหม่ เช่น "SES2609160001"
 *
 * @example
 * const sessionGroup = await generateSessionGroup(tx, new Date());
 * // sessionGroup === "SES2609160001"
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
