/**
 * @file lib/sampleFilters.ts
 * @project Water Monitoring Project
 * @module Data Pipeline / Sample Filters & Export Engine
 * @description
 * [TH] แหล่งความจริงเดียว (Single Source of Truth) สำหรับการกรองตัวอย่างน้ำและสร้างเงื่อนไข Where Clause ใน Prisma
 * ใช้ร่วมกันระหว่างระบบแสดงผลบนแดชบอร์ด รายงานสถิติ และเอนจินการส่งออกไฟล์ข้อมูล (Excel/CSV)
 * บังคับใช้นโยบายความปลอดภัยของสิทธิ์ (RBAC: Collector ดูได้เฉพาะของตนเอง), ซ่อนข้อมูลที่อยู่ระหว่างรอตรวจทาน (Pending Sessions),
 * และจัดการช่วงเวลาแบบรวมทั้งวันตามเวลาประเทศไทย (GMT+7)
 *
 * [EN] Single Source of Truth for water quality sample filtering and Prisma query composition.
 * Shared across the dashboard analytics view and export engines (Excel/CSV).
 * Enforces role-based isolation (collectors restricted to own samples), excludes unapproved pending review sessions,
 * and handles boundary alignments strictly in Thailand local time (GMT+7).
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-31
 * @modified 2026-09-11
 * @version 2.0.0
 * @license Proprietary
 *
 * @see {@link /lib/review.ts} ฟังก์ชันดึง Session ที่อยู่ระหว่างรอการตรวจทาน
 * @see {@link /lib/thaiTime.ts} โมดูลจัดการเวลาไทย
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-31)
 *
 * @lastModified 2026-09-11
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: ยึดเวลาไทยเป็นนิยามเดียวของทุกคอลัมน์ DateTime ใน DB
 * - 2026-08-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: แก้ logic กราฟความผันผวนใหม่
 * - 2026-08-04 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: แก้การส่งออกไฟล์
 * - 2026-07-31 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: แก้ฟังก์ชัน export ข้อมูล
 */

import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPendingSessionGroups } from "@/lib/review";
import { dayEnd, dayStart, nowThai, toDisplayDateTime, toYmd } from "@/lib/thaiTime";

/**
 * แหล่งความจริงเดียวของ "ตัวอย่างน้ำชุดไหนนับเข้ารายงาน" — ใช้ร่วมกันระหว่างแดชบอร์ดและการส่งออก
 *
 * ทุก read path ที่แสดงสถิติหรือส่งออกไฟล์ต้องสร้าง where จากที่นี่เท่านั้น
 * ห้ามประกอบ where เองซ้ำที่ route อื่น เพราะตัวเลขในไฟล์ที่ส่งออกต้องตรงกับที่เห็นบนหน้าจอเสมอ
 * (เกณฑ์ที่ต้องตรงกัน: ตัดข้อมูลที่ถูกลบ, ซ่อน session ที่ยังรออนุมัติ, ขอบเขตสิทธิ์ของ collector, ช่วงวันที่ตามเวลาไทย)
 *
 * เวลาใน DB เป็นนาฬิกาไทยตรง ๆ (ดู lib/thaiTime.ts) — ขอบเขตวันและการจัดรูปแบบจึงใช้ค่า UTC ของ Date ได้เลย
 * ห้ามบวก/ลบ 7 ชม. หรือใช้ timeZone: "Asia/Bangkok" ที่ชั้นนี้ ไม่งั้นไฟล์ที่ส่งออกจะคลาดจากหน้าจอ 7 ชม.
 */

/**
 * [TH] โครงสร้างตัวกรองข้อมูลตัวอย่างน้ำสำหรับการสืบค้นและรายงาน
 * [EN] Structure of water sample query filters for analytics and exports
 */
export type SampleFilters = {
    /** [TH] โหมดมุมมอง ('ALL' สำหรับเจ้าหน้าที่/ผู้ดูแล, 'MINE' สำหรับผู้เก็บตัวอย่าง) | [EN] View mode ('ALL' or 'MINE') */
    viewMode: "ALL" | "MINE";
    /** [TH] รหัสประจำตัวของผู้เก็บตัวอย่างน้ำ | [EN] Collector user ID */
    collectorId: number | null;
    /** [TH] วันที่เริ่มต้น ช่วงเวลาเก็บตัวอย่าง ("YYYY-MM-DD") | [EN] Start date in YYYY-MM-DD */
    startDate: string | null;
    /** [TH] วันที่สิ้นสุด ช่วงเวลาเก็บตัวอย่าง ("YYYY-MM-DD") | [EN] End date in YYYY-MM-DD */
    endDate: string | null;
    /** [TH] ชื่อหน่วยงานกำกับดูแล หรือ null/"all" หากไม่กรอง | [EN] Governing agency name or null/"all" */
    agency: string | null;
    /** [TH] รหัสสถานีจุดตรวจวัดเจาะจง | [EN] Specific location ID */
    locationId: number | null;
};

/**
 * [TH] แปลงสตริงวันที่ "YYYY-MM-DD" เป็นจุดเริ่มต้นของวัน (00:00:00.000) ตามเวลาท้องถิ่นไทย
 * [EN] Converts a "YYYY-MM-DD" date string into the start of the day (00:00:00.000) in Thai local time
 *
 * @function parseLocalDayStart
 * @param {string} dateStr - สตริงวันที่ในรูปแบบ "YYYY-MM-DD"
 * @returns {Date} Date object จุดเริ่มต้นของวัน
 */
export function parseLocalDayStart(dateStr: string): Date {
    return dayStart(dateStr);
}

/**
 * [TH] แปลงสตริงวันที่ "YYYY-MM-DD" เป็นจุดสิ้นสุดของวัน (เที่ยงคืนของวันถัดไป สำหรับใช้กับเงื่อนไข `lt`)
 * [EN] Converts a "YYYY-MM-DD" date string into the end boundary (midnight of next day for `lt` comparisons)
 *
 * @function parseLocalDayEnd
 * @param {string} dateStr - สตริงวันที่ในรูปแบบ "YYYY-MM-DD"
 * @returns {Date} Date object จุดสิ้นสุดของวัน
 */
export function parseLocalDayEnd(dateStr: string): Date {
    return dayEnd(dateStr);
}

/**
 * [TH] อ่านค่าตัวกรองจาก Query String ของ Request โดยบังคับใช้กฎความปลอดภัยระดับเซิร์ฟเวอร์
 * ป้องกันการปลอมแปลงค่า: บังคับ Collector ให้ใช้ viewMode='MINE' และใช้ collectorId จาก Token ที่ผ่านการตรวจสอบแล้วเท่านั้น
 *
 * [EN] Parses and sanitizes sample filters from request URL query parameters.
 * Enforces server-side authorization boundaries: locks collectors to viewMode='MINE' and binds collectorId to authenticated token ID.
 *
 * @function readSampleFilters
 * @param {NextRequest} request - NextRequest object
 * @param {{ id: number; roleName: string }} user - ข้อมูลผู้ใช้งานที่ผ่านการยืนยันตัวตน
 * @returns {SampleFilters} ออบเจกต์ตัวกรองที่ผ่านการตรวจสอบและบังคับขอบเขตสิทธิ์แล้ว
 */
export function readSampleFilters(request: NextRequest, user: { id: number; roleName: string }): SampleFilters {
    const { searchParams } = new URL(request.url);
    const locationIdParam = searchParams.get("locationId");
    return {
        viewMode: user.roleName === "collector" ? "MINE" : searchParams.get("viewMode") === "MINE" ? "MINE" : "ALL",
        collectorId: user.id,
        startDate: searchParams.get("startDate"),
        endDate: searchParams.get("endDate"),
        agency: searchParams.get("agency"),
        locationId: locationIdParam ? Number(locationIdParam) : null,
    };
}

/**
 * [TH] ประกอบเงื่อนไข Where Clause สำหรับ `prisma.waterSample` จากชุดตัวกรองที่กำหนด
 * คัดกรองเฉพาะข้อมูลที่ยังไม่ถูกลบ (`isDeleted: false`), ซ่อน Session ที่รอการตรวจทาน (`pendingGroups`),
 * บังคับสิทธิ์ตามบทบาท และกำหนดช่วงเวลาเก็บตัวอย่างตามปฏิทินเวลาท้องถิ่นไทย
 *
 * [EN] Constructs Prisma `waterSample` where clause from active filters.
 * Excludes soft-deleted rows, hides unapproved pending session groups, enforces RBAC scoping,
 * and frames collection timestamps within Thai local calendar days.
 *
 * @async
 * @function buildSampleWhere
 * @param {SampleFilters} filters - ออบเจกต์ตัวกรองข้อมูล
 * @param {object} [options] - ตัวเลือกเพิ่มเติม
 * @param {boolean} [options.withDateRange=true] - กำหนดว่าจะใส่เงื่อนไขช่วงเวลาหรือไม่ (ใส่ false สำหรับคำนวณ WoW/MoM หรือส่งออกทั้งหมด)
 * @param {string[]} [options.pendingGroups] - รายการ Session Group ที่อยู่ระหว่างรอการตรวจทาน (หากไม่ส่งมาจะ Query ให้เอง)
 * @returns {Promise<Prisma.WaterSampleWhereInput>} Prisma Where Clause
 */
export async function buildSampleWhere(
    filters: SampleFilters,
    { withDateRange = true, pendingGroups }: { withDateRange?: boolean; pendingGroups?: string[] } = {}
): Promise<Prisma.WaterSampleWhereInput> {
    const groups = pendingGroups ?? (await getPendingSessionGroups());

    const where: Prisma.WaterSampleWhereInput = { isDeleted: false };

    // ต้องปล่อยแถว sessionGroup = null ผ่าน (ข้อมูลส่งเดี่ยวส่วนใหญ่ไม่มี sessionGroup)
    // เพราะ SQL `NOT IN (...)` คัดแถวที่คอลัมน์เป็น NULL ทิ้งหมด → รายงานว่างเปล่าเมื่อมี pending
    if (groups.length > 0) where.OR = [{ sessionGroup: null }, { sessionGroup: { notIn: groups } }];

    if (filters.viewMode === "MINE" && filters.collectorId) {
        where.collectorId = filters.collectorId;
    }

    if (withDateRange && (filters.startDate || filters.endDate)) {
        where.collectionTime = {
            ...(filters.startDate ? { gte: parseLocalDayStart(filters.startDate) } : {}),
            ...(filters.endDate ? { lt: parseLocalDayEnd(filters.endDate) } : {}),
        };
    }

    // เลือกสถานีเจาะจงมาก่อน agency เสมอ (ละเอียดกว่า) — ถ้าไม่ได้เลือกสถานีค่อย fallback ไปกรองด้วยหน่วยงาน
    if (filters.locationId) {
        where.locationId = filters.locationId;
    } else if (filters.agency && filters.agency !== "all") {
        where.location = { governingAgency: filters.agency };
    }

    return where;
}

/**
 * [TH] สร้าง Where Clause สำหรับขอบเขต "ทั้งหมด" (All Scope) สำหรับการส่งออกรายงาน
 * ยังคงซ่อน Session ที่รอการอนุมัติและข้อมูลที่ถูกลบ เพื่อให้หมายถึงข้อมูลที่ได้รับการยืนยันแล้วทั้งระบบ
 *
 * [EN] Constructs Prisma where input for the global ("ALL") scope export.
 * Preserves review isolation and soft-delete filters to represent the full verified dataset.
 *
 * @async
 * @function buildAllScopeWhere
 * @param {SampleFilters} filters - ตัวกรองที่มีข้อมูลสิทธิ์ของผู้ใช้
 * @param {string[]} [pendingGroups] - รายการกลุ่มตัวอย่างที่รอตรวจทาน
 * @returns {Promise<Prisma.WaterSampleWhereInput>} Where Clause สำหรับขอบเขตข้อมูลทั้งหมด
 */
export async function buildAllScopeWhere(filters: SampleFilters, pendingGroups?: string[]): Promise<Prisma.WaterSampleWhereInput> {
    return buildSampleWhere({ ...filters, startDate: null, endDate: null, agency: null, locationId: null }, { withDateRange: false, pendingGroups });
}

// --- การจัดรูปแบบเวลาสำหรับไฟล์ที่ส่งออก ---
// Date จาก DB มี getUTC*() = นาฬิกาไทยอยู่แล้ว จึงพิมพ์ค่า UTC ออกมาตรง ๆ ไม่ต้องแปลงโซน

/**
 * [TH] ดึงเลขชั่วโมง 0–23 ตามเวลาไทยจาก Date object ที่จัดเก็บเวลาไทย
 * [EN] Extracts hour integer (0-23) in Thai local time
 *
 * @function getThaiHour
 * @param {Date} d - Date object ที่บรรจุเวลาไทย
 * @returns {number} เลขชั่วโมง
 */
export function getThaiHour(d: Date): number {
    return d.getUTCHours();
}

/**
 * [TH] จัดรูปแบบวันที่และเวลาสำหรับแสดงผลตามเวลาไทย เช่น "2026-07-31 14:05"
 * [EN] Formats Date into display datetime string in Thai local time (e.g. "2026-07-31 14:05")
 *
 * @function formatThaiDateTime
 * @param {Date} d - Date object
 * @returns {string} สตริงวันที่และเวลา
 */
export function formatThaiDateTime(d: Date): string {
    return toDisplayDateTime(d);
}

/**
 * [TH] จัดรูปแบบวันที่สำหรับนำไปใช้ในชื่อไฟล์ส่งออก เช่น "2026-07-31"
 * [EN] Formats Date into date string suitable for export filenames (e.g. "2026-07-31")
 *
 * @function formatThaiDate
 * @param {Date} d - Date object
 * @returns {string} สตริงวันที่ "YYYY-MM-DD"
 */
export function formatThaiDate(d: Date): string {
    return toYmd(d);
}

/**
 * [TH] สร้างข้อความอธิบายขอบเขตข้อมูล (ช่วงวันที่และเป้าหมาย/หน่วยงาน) สำหรับใช้ในหัวตารางและชื่อไฟล์ที่ส่งออก
 * [EN] Generates human-readable scope descriptions (date range and target agency/station) for export headers and filenames
 *
 * @function describeScope
 * @param {SampleFilters} filters - ออบเจกต์ตัวกรองข้อมูล
 * @param {"filtered" | "all"} scope - ขอบเขตการส่งออก
 * @param {string | null} stationName - ชื่อสถานีตรวจวัด (ถ้ามี)
 * @returns {{ rangeLabel: string; targetLabel: string }} ป้ายกำกับช่วงเวลาและป้ายกำกับเป้าหมาย
 */
export function describeScope(filters: SampleFilters, scope: "filtered" | "all", stationName: string | null): { rangeLabel: string; targetLabel: string } {
    if (scope === "all") return { rangeLabel: "ทั้งหมดเท่าที่มีในระบบ", targetLabel: "ทุกหน่วยงาน" };

    const rangeLabel = filters.startDate && filters.endDate ? `${filters.startDate} ถึง ${filters.endDate}` : filters.startDate ? `ตั้งแต่ ${filters.startDate}` : filters.endDate ? `ถึง ${filters.endDate}` : "ทั้งหมดเท่าที่มีในระบบ";

    const targetLabel = stationName ? `สถานี ${stationName}` : filters.agency && filters.agency !== "all" ? filters.agency : "ทุกหน่วยงาน";

    return { rangeLabel, targetLabel };
}

/**
 * [TH] รวบรวมบริบทการส่งออกข้อมูล (Export Context): หาขอบเขต scope, แปลง where clause, และดึงชื่อสถานี
 * ใช้ร่วมกันระหว่าง CSV, XLSX และ Pre-flight count เพื่อให้ข้อมูลตรงกันอย่างสมบูรณ์
 *
 * [EN] Resolves standardized export execution context (scope, Prisma where condition, and station name).
 * Shared across CSV, XLSX, and count pre-flight endpoints to ensure exact count and query consistency.
 *
 * @async
 * @function resolveExportContext
 * @param {NextRequest} request - NextRequest object
 * @param {{ id: number; roleName: string }} user - ข้อมูลผู้ใช้
 * @returns {Promise<{ scope: "filtered" | "all", filters: SampleFilters, where: Prisma.WaterSampleWhereInput, stationName: string | null }>}
 */
export async function resolveExportContext(request: NextRequest, user: { id: number; roleName: string }) {
    const { searchParams } = new URL(request.url);
    const scope: "filtered" | "all" = searchParams.get("scope") === "all" ? "all" : "filtered";
    const filters = readSampleFilters(request, user);

    const pendingGroups = await getPendingSessionGroups();
    const where = scope === "all" ? await buildAllScopeWhere(filters, pendingGroups) : await buildSampleWhere(filters, { pendingGroups });

    const station = scope === "filtered" && filters.locationId ? await prisma.location.findUnique({ where: { id: filters.locationId }, select: { stationName: true } }) : null;
    const stationName = station?.stationName ?? null;

    return { scope, filters, where, stationName };
}

/**
 * [TH] สร้างค่า HTTP Header `Content-Disposition` สำหรับการดาวน์โหลดไฟล์ส่งออก
 * กำหนดชื่อไฟล์ภาษาไทยตาม RFC 5987 (`filename*=UTF-8''...`) และมี fallback เป็น ASCII สำหรับเบราว์เซอร์รุ่นเก่า
 *
 * [EN] Generates RFC 5987 compliant `Content-Disposition` header for exported attachments.
 * Includes localized Thai filename parameter with ASCII fallback.
 *
 * @function buildContentDisposition
 * @param {SampleFilters} filters - ตัวกรองข้อมูล
 * @param {"filtered" | "all"} scope - ขอบเขตการส่งออก
 * @param {string | null} stationName - ชื่อสถานี
 * @param {"csv" | "xlsx"} ext - นามสกุลไฟล์
 * @returns {string} ค่า Header Content-Disposition
 */
export function buildContentDisposition(filters: SampleFilters, scope: "filtered" | "all", stationName: string | null, ext: "csv" | "xlsx"): string {
    const { targetLabel } = describeScope(filters, scope, stationName);
    const range = scope === "all" ? "ทั้งหมด" : filters.startDate && filters.endDate ? `${filters.startDate}_${filters.endDate}` : formatThaiDate(nowThai());

    const asciiName = `water-quality_${scope === "all" ? "all" : `${filters.startDate ?? "start"}_${filters.endDate ?? "end"}`}.${ext}`;
    // แทนอักขระที่ใช้ในชื่อไฟล์ไม่ได้ (เว้นวรรค / เครื่องหมายพาธ) ด้วยขีดกลาง กันชื่อพังบน Windows
    const utf8Name = `คุณภาพน้ำ_${range}_${targetLabel}.${ext}`.replace(/[\\/:*?"<>|\s]+/g, "-");

    return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`;
}
