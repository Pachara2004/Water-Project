/**
 * @fileoverview Thai timezone (UTC+7) date/time utilities for server and client
 *
 * [TH] โมดูลจัดการวันเวลาประเทศไทย (UTC+7) สำหรับระบบฐานข้อมูล ฝั่งเซิร์ฟเวอร์ และฝั่งไคลเอนต์
 * [EN] Thai timezone (UTC+7) date/time helpers for Prisma database storage, server operations, and client UI
 *
 * @description
 * [TH] กติกาเวลาของทั้งระบบ: คอลัมน์ DATETIME ใน DB เก็บนาฬิกาไทย (UTC+7) ตรง ๆ
 * ฝั่ง Server อ่าน/เขียนด้วย getUTC*() / setUTC*() โดยเทียบ "ตอนนี้" ผ่าน nowThai()
 * ฝั่ง Client แปลงและจัดการรูปแบบการแสดงผล (ISO ไม่มี Z, YYYY-MM-DD, YYMMDD)
 * [EN] System convention: All DATETIME columns store Thai local time directly.
 * Server uses getUTC*() / setUTC*() and nowThai() to interact with the database.
 * Client handles local representation and timezone-stripped ISO strings.
 *
 * @module lib/thaiTime
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-20
 * @modified 2026-07-20
 *
 * @history
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: รวมกติกาเวลาไทย (UTC+7) ทั้งระบบใน lib/thaiTime.ts
 */

const THAI_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * [TH] เวลาปัจจุบันตามนาฬิกาประเทศไทย (UTC+7) ในรูป Date object ที่ค่า getUTC*() ตรงกับเวลาไทยจริง
 * [EN] Current Thai local time as a Date object whose getUTC*() methods yield Thai clock time
 *
 * @function nowThai
 * @returns {Date} อ็อบเจกต์ Date ที่ปรับออฟเซ็ตเวลาไทยแล้ว
 */
export function nowThai(): Date {
    return new Date(Date.now() + THAI_OFFSET_MS);
}

/**
 * [TH] แปลงสตริงเวลาที่ส่งมาจาก client ให้เป็น Date ตามกติกาเวลาไทย (ตัด offset/Z ทิ้งและอ่านเป็นเวลาไทย)
 * [EN] Parses an incoming client datetime string into a Thai local time Date, ignoring external offsets
 *
 * @function parseThaiInput
 * @param {string} timeStr - สตริงเวลา เช่น "2026-09-11T14:30" หรือ "2026-09-11T14:30:00+07:00"
 * @returns {Date | null} อ็อบเจกต์ Date หรือ null หากรูปแบบไม่ถูกต้อง
 */
export function parseThaiInput(timeStr: string): Date | null {
    const cleanStr = timeStr.trim().replace(/(Z|[+-]\d{2}:\d{2})$/, "");
    const match = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
    if (!match) return null;
    const [, y, mo, d, h, mi, s] = match;
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), s ? Number(s) : 0));
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * [TH] แปลงอ็อบเจกต์ Date เป็นสตริง ISO โดยตัดตัวอักษร 'Z' ท้ายสตริงออก เพื่อให้เบราว์เซอร์อ่านเป็นเวลาท้องถิ่น
 * [EN] Serializes a Date object to an ISO string without the trailing 'Z' for client local consumption
 *
 * @function toApiString
 * @param {Date | null | undefined} d - อ็อบเจกต์ Date ที่ต้องการแปลง
 * @returns {string | null} สตริงเวลา ISO แบบไม่มี Z หรือ null
 */
export function toApiString(d: Date): string;
export function toApiString(d: Date | null | undefined): string | null;
export function toApiString(d: Date | null | undefined): string | null {
    if (!d) return null;
    return d.toISOString().replace("Z", "");
}

/**
 * [TH] เวลาเที่ยงคืนต้นวัน (00:00:00) ตามนาฬิกาไทยของวันที่ระบุ
 * [EN] Midnight start of the specified day (00:00:00) in Thai local time
 *
 * @function dayStart
 * @param {string} ymd - วันที่ในรูปแบบ "YYYY-MM-DD"
 * @returns {Date} อ็อบเจกต์ Date จุดเริ่มต้นของวัน
 */
export function dayStart(ymd: string): Date {
    return new Date(`${ymd}T00:00:00Z`);
}

/**
 * [TH] เวลาเที่ยงคืนของวันถัดไป ตามนาฬิกาไทย (สำหรับใช้เป็นเงื่อนไขขอบเขตสิ้นสุดแบบ < less-than)
 * [EN] Midnight of the following day in Thai local time (for inclusive-day less-than boundaries)
 *
 * @function dayEnd
 * @param {string} ymd - วันที่ในรูปแบบ "YYYY-MM-DD"
 * @returns {Date} อ็อบเจกต์ Date สิ้นสุดขอบเขตวัน
 */
export function dayEnd(ymd: string): Date {
    const d = dayStart(ymd);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
}

/**
 * [TH] คำนวณช่วงเวลาเริ่มต้น (00:00:00) และสิ้นสุด (วันถัดไป 00:00:00) ของวันเดียวกับ Date ที่ระบุ
 * [EN] Calculates start and end timestamps covering the entire day of the provided Date
 *
 * @function sameDayRange
 * @param {Date} d - วันที่อ้างอิง
 * @returns {{ start: Date; end: Date }} ขอบเขตเริ่มต้นและสิ้นสุดของวัน
 */
export function sameDayRange(d: Date): { start: Date; end: Date } {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
}

/**
 * [TH] ปัดเวลาเศษนาทีและวินาทีลงเป็นต้นชั่วโมง (00 นาที 00 วินาที)
 * [EN] Floors a timestamp down to the beginning of the hour (zeroes minutes and seconds)
 *
 * @function floorToHour
 * @param {Date} d - อ็อบเจกต์ Date
 * @returns {Date} อ็อบเจกต์ Date ที่ปัดเป็นต้นชั่วโมงแล้ว
 */
export function floorToHour(d: Date): Date {
    const out = new Date(d);
    out.setUTCMinutes(0, 0, 0);
    return out;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * [TH] แปลง Date เป็นสตริงวันที่ในรูปแบบ "YYYY-MM-DD" ตามนาฬิกาไทย
 * [EN] Formats a Date object into "YYYY-MM-DD" according to Thai local time
 *
 * @function toYmd
 * @param {Date} d - อ็อบเจกต์ Date
 * @returns {string} สตริงวันที่ "YYYY-MM-DD"
 */
export function toYmd(d: Date): string {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * [TH] แปลง Date เป็นสตริงวันที่ 6 หลักในรูปแบบ "YYMMDD" (สำหรับใช้ในรหัสตัวอย่างน้ำ/เซสชัน)
 * [EN] Formats a Date object into a 6-digit "YYMMDD" string for sample/session codes
 *
 * @function toYymmdd
 * @param {Date} d - อ็อบเจกต์ Date
 * @returns {string} สตริง "YYMMDD"
 */
export function toYymmdd(d: Date): string {
    return `${String(d.getUTCFullYear()).slice(-2)}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

/**
 * [TH] แปลง Date เป็นสตริงวันเวลาสำหรับแสดงผลและส่งออกไฟล์ เช่น "YYYY-MM-DD HH:mm"
 * [EN] Formats a Date into a human-readable display string "YYYY-MM-DD HH:mm"
 *
 * @function toDisplayDateTime
 * @param {Date} d - อ็อบเจกต์ Date
 * @returns {string} สตริงวันเวลาสำหรับแสดงผล
 */
export function toDisplayDateTime(d: Date): string {
    return `${toYmd(d)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

// --- ฝั่ง client (browser) ---
// สตริงจาก API ไม่มี Z จึงถูก new Date() อ่านเป็นเวลาเครื่องผู้ใช้ ขอบเขตวันที่จะเทียบด้วยต้องสร้างเป็นเวลาเครื่องเหมือนกัน
// ห้ามใช้ new Date("YYYY-MM-DD") เพราะสตริงแบบมีแต่วันถูกอ่านเป็นเที่ยงคืน UTC ไม่ใช่เที่ยงคืนเครื่อง → คลาดเท่า offset ของเครื่อง

/**
 * [TH] เวลาเที่ยงคืนต้นวันตามเวลาเครื่องผู้ใช้ (Client-side local midnight start)
 * [EN] Midnight start of the specified day according to user's local machine time
 *
 * @function localDayStart
 * @param {string} ymd - วันที่ในรูปแบบ "YYYY-MM-DD"
 * @returns {Date} อ็อบเจกต์ Date เวลาเครื่อง
 */
export function localDayStart(ymd: string): Date {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
}

/**
 * [TH] เวลาเที่ยงคืนของวันถัดไปตามเวลาเครื่องผู้ใช้ (Client-side local midnight end boundary)
 * [EN] Midnight of the following day according to user's local machine time
 *
 * @function localDayEnd
 * @param {string} ymd - วันที่ในรูปแบบ "YYYY-MM-DD"
 * @returns {Date} อ็อบเจกต์ Date เวลาเครื่อง
 */
export function localDayEnd(ymd: string): Date {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d + 1);
}
