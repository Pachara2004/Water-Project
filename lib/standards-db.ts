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
import type { TxClient } from "@/lib/prisma";
import { parseStandardSnapshot, type StandardRow, type StandardSnapshotRow } from "@/lib/standards";

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

// ─── เวอร์ชันเกณฑ์ (ตาราง standard_versions) ───

/** client ที่ใช้ได้ทั้งใน $transaction และนอก */
type DbClient = TxClient | typeof prisma;

/**
 * อ่านตาราง standards ทั้งชุดพร้อมชื่อประเภท/สาร สำหรับเก็บลง StandardVersion.snapshot
 */
export async function buildStandardSnapshot(db: DbClient): Promise<StandardSnapshotRow[]> {
    const rows = await db.standard.findMany({
        select: {
            locationTypeId: true,
            parameterId: true,
            maxValue: true,
            locationType: { select: { code: true, labelTh: true } },
            parameter: { select: { name: true, unit: true } },
        },
        orderBy: [{ locationTypeId: "asc" }, { parameterId: "asc" }],
    });
    return rows.map((r) => ({
        locationTypeId: r.locationTypeId,
        locationTypeCode: r.locationType.code,
        locationTypeLabelTh: r.locationType.labelTh,
        parameterId: r.parameterId,
        parameterName: r.parameter.name,
        parameterUnit: r.parameter.unit,
        maxValue: r.maxValue,
    }));
}

/** ข้อมูลเวอร์ชันที่ฝั่งอ่านใช้ ไม่รวม snapshot */
export interface StandardVersionInfo {
    id: number;
    version: number;
    createdAt: Date;
}

/**
 * เวอร์ชันล่าสุด = ชุดเกณฑ์ที่ตรงกับตาราง standards ตอนนี้ คืน null ถ้ายังไม่มีเวอร์ชันเลย
 */
export async function getCurrentStandardVersion(db: DbClient = prisma): Promise<StandardVersionInfo | null> {
    return db.standardVersion.findFirst({
        select: { id: true, version: true, createdAt: true },
        orderBy: { version: "desc" },
    });
}

/**
 * หาเวอร์ชันเกณฑ์ที่ใช้ตัดสินตัวอย่างนี้
 * ใช้ standardVersionId ที่ปักไว้ก่อน ถ้าเป็นแถวเก่า (null) ใช้เวอร์ชันล่าสุดที่มีอยู่ตอน uploadedActiveAt แทน
 */
export async function resolveStandardVersionIdForSample(
    sample: { standardVersionId: number | null; uploadedActiveAt: Date },
    db: DbClient = prisma,
): Promise<number | null> {
    if (sample.standardVersionId !== null) return sample.standardVersionId;
    const v = await db.standardVersion.findFirst({
        where: { createdAt: { lte: sample.uploadedActiveAt } },
        select: { id: true },
        orderBy: { createdAt: "desc" },
    });
    // ตัวอย่างเก่ากว่าเวอร์ชันแรก (เช่นข้อมูลก่อนมีระบบ) ให้ใช้เวอร์ชันแรก
    if (v) return v.id;
    const first = await db.standardVersion.findFirst({ select: { id: true }, orderBy: { version: "asc" } });
    return first?.id ?? null;
}

/**
 * snapshot ของเวอร์ชันที่ระบุ คืน null ถ้าไม่มีเวอร์ชันนั้น
 */
export async function loadStandardVersionSnapshot(
    versionId: number,
    db: DbClient = prisma,
): Promise<(StandardVersionInfo & { snapshot: StandardSnapshotRow[] }) | null> {
    const v = await db.standardVersion.findUnique({
        where: { id: versionId },
        select: { id: true, version: true, createdAt: true, snapshot: true },
    });
    if (!v) return null;
    return { id: v.id, version: v.version, createdAt: v.createdAt, snapshot: parseStandardSnapshot(v.snapshot) };
}
