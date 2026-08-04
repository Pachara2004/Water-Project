import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPendingSessionGroups } from "@/lib/review";

/**
 * แหล่งความจริงเดียวของ "ตัวอย่างน้ำชุดไหนนับเข้ารายงาน" — ใช้ร่วมกันระหว่างแดชบอร์ดและการส่งออก
 *
 * ทุก read path ที่แสดงสถิติหรือส่งออกไฟล์ต้องสร้าง where จากที่นี่เท่านั้น
 * ห้ามประกอบ where เองซ้ำที่ route อื่น เพราะตัวเลขในไฟล์ที่ส่งออกต้องตรงกับที่เห็นบนหน้าจอเสมอ
 * (เกณฑ์ที่ต้องตรงกัน: ตัดข้อมูลที่ถูกลบ, ซ่อน session ที่ยังรออนุมัติ, ขอบเขตสิทธิ์ของ collector, ช่วงวันที่ตามเวลาไทย)
 */

export type SampleFilters = {
    viewMode: "ALL" | "MINE";
    collectorId: number | null;
    startDate: string | null; // "YYYY-MM-DD"
    endDate: string | null; // "YYYY-MM-DD"
    agency: string | null; // "all" หรือ null = ไม่กรองหน่วยงาน
    locationId: number | null;
};

// ตีความ "YYYY-MM-DD" จาก filter เป็นขอบเขตเวลาไทย (+07:00) ให้ตรงกับ toISODate ฝั่ง frontend
// ป้องกัน off-by-one จากการ parse เป็น UTC เที่ยงคืน (คลาดกับเวลาไทย 7 ชม.)
export function parseLocalDayStart(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00+07:00`);
}

export function parseLocalDayEnd(dateStr: string): Date {
    // ครอบคลุมทั้งวัน: ใช้ "น้อยกว่า" เที่ยงคืนของวันถัดไป แทนการเดา .999
    const d = parseLocalDayStart(dateStr);
    d.setDate(d.getDate() + 1);
    return d;
}

/**
 * อ่าน filter จาก query string โดยบังคับขอบเขตสิทธิ์ที่ฝั่ง server
 *
 * ค่าที่ห้ามเชื่อจาก client: viewMode ของ collector (บังคับ MINE เสมอ) และ collectorId
 * (ใครก็ปลอมเป็น id ใครก็ได้) — ใช้ id จาก token ที่ยืนยันแล้วเท่านั้น
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
 * ประกอบ where ของ prisma.waterSample จาก filter ชุดเดียวกับที่แดชบอร์ดใช้
 *
 * @param withDateRange false = ตัดเงื่อนไขช่วงวันที่ออก (ใช้กับ WoW/MoM ที่ยึดปฏิทินจริง และกับ export ขอบเขต "ทั้งหมด")
 * @param pendingGroups ส่งมาเพื่อใช้ผลลัพธ์ร่วมกันเมื่อสร้าง where หลายชุดใน request เดียว (ไม่ส่ง = query ให้เอง)
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
 * where ของขอบเขต "ทั้งหมด" สำหรับการส่งออก
 *
 * ตั้งใจให้ยังคงซ่อน session ที่รออนุมัติและข้อมูลที่ถูกลบ เพื่อให้ "ทั้งหมด" หมายถึง
 * ข้อมูลที่ยืนยันแล้วทั้งระบบ — นิยามเดียวกับแดชบอร์ด ไม่ใช่การยกตารางดิบออกไปทั้งก้อน
 * ขอบเขตสิทธิ์ของ collector ยังถูกบังคับอยู่ (ผ่าน viewMode ที่ readSampleFilters ล็อกไว้แล้ว)
 */
export async function buildAllScopeWhere(filters: SampleFilters, pendingGroups?: string[]): Promise<Prisma.WaterSampleWhereInput> {
    return buildSampleWhere({ ...filters, startDate: null, endDate: null, agency: null, locationId: null }, { withDateRange: false, pendingGroups });
}

// --- การจัดรูปแบบเวลาไทยสำหรับไฟล์ที่ส่งออก ---
// ข้อมูลใน DB เป็น UTC — ถ้าเขียนลงไฟล์ด้วย toISOString() ตรง ๆ ทุกแถวจะคลาดจากเวลาที่ผู้ใช้เก็บจริง 7 ชม.

const bangkokDateTime = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
});

const bangkokDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });

// "2026-07-31 14:05" ตามเวลาไทย (locale sv-SE ให้รูปแบบ ISO อยู่แล้ว จึงไม่ต้องประกอบเอง)
export function formatThaiDateTime(d: Date): string {
    return bangkokDateTime.format(d);
}

// "2026-07-31" ตามเวลาไทย — ใช้ในชื่อไฟล์
export function formatThaiDate(d: Date): string {
    return bangkokDate.format(d);
}

/**
 * คำอธิบายขอบเขตข้อมูลของไฟล์ที่ส่งออก (ใช้ทั้งในแถวหัวไฟล์และชื่อไฟล์)
 * ต้องเรียกพร้อมชื่อสถานีที่ resolve มาแล้ว เพราะ where เก็บแค่ locationId
 */
export function describeScope(filters: SampleFilters, scope: "filtered" | "all", stationName: string | null): { rangeLabel: string; targetLabel: string } {
    if (scope === "all") return { rangeLabel: "ทั้งหมดเท่าที่มีในระบบ", targetLabel: "ทุกหน่วยงาน" };

    const rangeLabel = filters.startDate && filters.endDate ? `${filters.startDate} ถึง ${filters.endDate}` : filters.startDate ? `ตั้งแต่ ${filters.startDate}` : filters.endDate ? `ถึง ${filters.endDate}` : "ทั้งหมดเท่าที่มีในระบบ";

    const targetLabel = stationName ? `สถานี ${stationName}` : filters.agency && filters.agency !== "all" ? filters.agency : "ทุกหน่วยงาน";

    return { rangeLabel, targetLabel };
}

/**
 * บริบทที่ทุกไฟล์ส่งออกต้องรู้: where ที่จะใช้ดึงข้อมูล, ชื่อสถานีที่กรอง (ใช้ตั้งชื่อไฟล์)
 *
 * แยกออกมาเพื่อให้ CSV / XLSX / endpoint นับจำนวน ใช้ตรรกะเดียวกันเป๊ะ
 * ไม่งั้นจำนวนแถวที่โชว์ก่อนกดยืนยันจะไม่ตรงกับจำนวนแถวในไฟล์จริง
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
 * Content-Disposition ที่อ่านรู้เรื่อง — ชื่อไฟล์บอกช่วงวันที่และขอบเขต แทน timestamp ดิบ
 * แนบทั้ง filename (ASCII สำรองสำหรับเบราว์เซอร์เก่า) และ filename* (UTF-8 ตาม RFC 5987 สำหรับชื่อภาษาไทย)
 */
export function buildContentDisposition(filters: SampleFilters, scope: "filtered" | "all", stationName: string | null, ext: "csv" | "xlsx"): string {
    const { targetLabel } = describeScope(filters, scope, stationName);
    const range = scope === "all" ? "ทั้งหมด" : filters.startDate && filters.endDate ? `${filters.startDate}_${filters.endDate}` : formatThaiDate(new Date());

    const asciiName = `water-quality_${scope === "all" ? "all" : `${filters.startDate ?? "start"}_${filters.endDate ?? "end"}`}.${ext}`;
    // แทนอักขระที่ใช้ในชื่อไฟล์ไม่ได้ (เว้นวรรค / เครื่องหมายพาธ) ด้วยขีดกลาง กันชื่อพังบน Windows
    const utf8Name = `คุณภาพน้ำ_${range}_${targetLabel}.${ext}`.replace(/[\\/:*?"<>|\s]+/g, "-");

    return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`;
}
