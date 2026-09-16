/**
 * @fileoverview Database loader utilities for water quality standards
 *
 * [TH] โมดูลดึงข้อมูลเกณฑ์มาตรฐานคุณภาพน้ำจากฐานข้อมูล (Prisma) สำหรับฝั่ง Server
 * [EN] Server-only database loader utilities for water quality standards via Prisma
 *
 * @description
 * [TH] ตัวโหลดเกณฑ์มาตรฐานจากตาราง `standards` บนฐานข้อมูล สำหรับ Server-side evaluation
 * แยกออกมาจาก lib/standards.ts เพื่อป้องกันไม่ให้ Prisma client หลุดเข้าไปใน client bundle
 * [EN] Server-side standard thresholds loader from the `standards` table for server evaluation.
 * Separated from lib/standards.ts to avoid leaking Prisma into client bundles.
 *
 * @module lib/standards-db
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-17
 * @modified 2026-07-17
 *
 * @history
 * - 2026-07-17 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: แยก loadStandards ออกมาเป็น lib/standards-db.ts สำหรับ server component
 */

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

/**
 * [TH] ดึงข้อมูลเกณฑ์มาตรฐานทั้งหมดของทุกสารและทุกประเภทการใช้ประโยชน์จากฐานข้อมูล
 * [EN] Retrieves all water quality standards across all parameters and location types from database
 *
 * @async
 * @function loadAllStandards
 * @returns {Promise<StandardRow[]>} รายการเกณฑ์มาตรฐานทั้งหมด ({ parameterId, maxValue })
 */
export async function loadAllStandards(): Promise<StandardRow[]> {
    return prisma.standard.findMany({
        select: { parameterId: true, maxValue: true },
    });
}

/**
 * [TH] ดึงข้อมูลเกณฑ์มาตรฐานเฉพาะสารที่ระบุในรายการ parameterIds
 * [EN] Retrieves standard thresholds for a specific subset of parameter IDs
 *
 * @async
 * @function loadStandardsForParameters
 * @param {number[]} parameterIds - รายการรหัสสารที่ต้องการดึงเกณฑ์
 * @returns {Promise<StandardRow[]>} รายการเกณฑ์มาตรฐานของสารที่เลือก
 */
export async function loadStandardsForParameters(parameterIds: number[]): Promise<StandardRow[]> {
    if (parameterIds.length === 0) return [];

    return prisma.standard.findMany({
        where: { parameterId: { in: parameterIds } },
        select: { parameterId: true, maxValue: true },
    });
}
