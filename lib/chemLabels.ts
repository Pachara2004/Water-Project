/**
 * @fileoverview Chemical labels, abbreviations, colors, and value parsing helpers
 *
 * [TH] โมดูลช่วยจัดการป้ายชื่อ ตัวย่อ สี และการอ่านค่าสารเคมีสำหรับการ์ดและกราฟ
 * [EN] Helpers for chemical parameter labels, abbreviations, colors, and measurement extraction
 *
 * @description
 * [TH] รวบรวมฟังก์ชันสำหรับแปลงคีย์ค่าสาร (เช่น ammoniaVal -> ammonia), ดึงสูตรเคมี/ตัวย่อ,
 * จัดการสีของไอคอนและเส้นกราฟ, และแปลงข้อมูลค่าสารจาก API ให้อยู่ในรูปแบบ ChemReading สำหรับ UI
 * [EN] Provides utilities to parse chemical measurement keys, extract chemical formulas/abbreviations,
 * resolve colors, and map API payloads into ChemReading items for cards and sheets.
 *
 * @module lib/chemLabels
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-20
 * @modified 2026-07-20
 *
 * @history
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: เพิ่ม helper แปลงชื่อ/สูตรเคมีและอ่านค่าสารสำหรับ UI cards
 */

// ป้ายชื่อ/ตัวย่อ/สีของสารเคมีสำหรับการ์ดตัวอย่างน้ำ
// ตัวย่อคำนวณจากชื่อสารที่มาจากตาราง `parameters` ส่วนสีมาจาก lib/chartColors.ts
// สารใหม่ที่เพิ่มใน DB จึงแสดงผลได้เองโดยไม่ต้องแก้โค้ดหน้าเว็บ (ได้สีจากพาเลตสำรอง)

import { parameterColor, parameterIconClass } from "./chartColors";

// API list (app/api/samples/route.ts) แบนค่าสารเป็นคีย์ `${ชื่อสาร}Val`
// ส่วน API detail (app/api/samples/[id]/route.ts) ใช้ `${ชื่อสาร}Value`
// lazy group + เรียง Val ก่อน Value ทำให้ถอด suffix ได้ถูกทั้งสองแบบ
const CHEM_VALUE_KEY = /^(.+?)(?:Val|Value)$/;

/**
 * [TH] สกัดชื่อสารเคมีออกจากชื่อคีย์ค่าสาร (เช่น "ammoniaVal" หรือ "ammoniaValue" -> "ammonia")
 * [EN] Extracts the underlying chemical parameter name from a measurement key suffix ('Val' or 'Value')
 *
 * @function chemNameFromValueKey
 * @param {string} key - คีย์ของค่าสาร (เช่น "ammoniaVal", "phosphateValue")
 * @returns {string | null} ชื่อสารเคมี หรือ null หากไม่ใช่คีย์ค่าสาร
 */
export function chemNameFromValueKey(key: string): string | null {
    const matched = CHEM_VALUE_KEY.exec(key);
    return matched ? matched[1] : null;
}

/**
 * ชื่อสารแบบสั้นสำหรับป้ายชิป ใช้เมื่อยังไม่มีสูตรเคมีในฐานข้อมูล
 *
 * ตัดเหลือ 4 ตัวให้พอกับความกว้างป้าย แล้วขึ้นต้นด้วยตัวใหญ่
 * ยกเว้นชื่อที่มีตัวพิมพ์ใหญ่ปนมาอยู่แล้ว ซึ่งถือว่าเป็นรูปเขียนที่ตั้งใจและห้ามดัด
 * ("pH" ต้องไม่กลายเป็น "PH", "DO" ต้องไม่กลายเป็น "Do")
 */
function chemShortName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return "?";

    const short = trimmed.slice(0, 4);
    const hasUppercase = trimmed !== trimmed.toLowerCase();
    return hasUppercase ? short : short.charAt(0).toUpperCase() + short.slice(1);
}

/**
 * [TH] รับข้อความป้ายกำกับสารสำหรับชิป โดยใช้สูตรเคมี (formula) จากฐานข้อมูลเป็นหลัก หากไม่มีจะใช้ชื่อย่อ 4 ตัวอักษร
 * [EN] Generates a display abbreviation for a chemical parameter, prioritizing formula over a 4-letter truncation
 *
 * @function chemAbbrev
 * @param {string} name - ชื่อสารเคมีเต็ม
 * @param {string | null} [formula] - สูตรทางเคมีจากฐานข้อมูล (ถ้ามี)
 * @returns {string} ป้ายกำกับตัวย่อหรือสูตรเคมี
 */
export function chemAbbrev(name: string, formula?: string | null): string {
    const cleaned = typeof formula === "string" ? formula.trim() : "";
    return cleaned || chemShortName(name);
}

// สีของสารมาจาก lib/chartColors.ts ที่เดียว เพื่อให้การ์ด กราฟแผนที่ และแดชบอร์ดตรงกัน
// ฟังก์ชันสองตัวนี้คงชื่อเดิมไว้เพราะถูกเรียกจากหลายที่ — เปลี่ยนแค่ที่มาของค่า

/**
 * [TH] รับคลาสสีไอคอนของสารเคมี (Tailwind CSS)
 * [EN] Retrieves Tailwind CSS text color class for the chemical parameter icon
 *
 * @function chemIconColor
 * @param {string} name - ชื่อสารเคมี
 * @returns {string} คลาส Tailwind CSS
 */
export function chemIconColor(name: string): string {
    return parameterIconClass(name);
}

/**
 * [TH] รับรหัสสี HEX เส้นกราฟประจำสารเคมี (สอดคล้องกับ chemIconColor)
 * [EN] Retrieves HEX color code for chart strokes of the specified chemical parameter
 *
 * @function chemStrokeColor
 * @param {string} name - ชื่อสารเคมี
 * @returns {string} รหัสสี HEX
 */
export function chemStrokeColor(name: string): string {
    return parameterColor(name);
}

/**
 * [TH] แปลงตัวเลขค่าวัดให้อยู่ในรูปข้อความทศนิยม หรือแสดงเครื่องหมายขีด (—) เมื่อไม่มีค่า
 * [EN] Formats a measured numeric value into a fixed-decimal string, or '—' if null/undefined/NaN
 *
 * @function formatMeasuredValue
 * @param {number | null | undefined} value - ค่าตัวเลขที่วัดได้
 * @param {number} [digits=2] - จำนวนตำแหน่งทศนิยม (ค่าเริ่มต้นคือ 2)
 * @returns {string} ข้อความแสดงผล
 */
export function formatMeasuredValue(value: number | null | undefined, digits = 2): string {
    return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

/**
 * [TH] โครงสร้างข้อมูลค่าวัดสารเคมี 1 รายการสำหรับการแสดงผลบน UI
 * [EN] Represents a normalized chemical reading item formatted for UI display
 */
export interface ChemReading {
    /** [TH] คีย์เดิมที่ใช้อ้างอิงเป็น React key [EN] Original key used as React key */
    key: string;
    /** [TH] ชื่อเต็มของสารเคมีจากฐานข้อมูล [EN] Full parameter name from DB */
    name: string;
    /** [TH] ป้ายกำกับบนชิป (สูตรเคมี หรือชื่อย่อ) [EN] Chip display abbreviation or formula */
    abbrev: string;
    /** [TH] คลาสสี Tailwind CSS ของไอคอน [EN] Tailwind CSS icon color class */
    color: string;
    /** [TH] ค่าตัวเลขที่วัดได้ [EN] Measured numeric value */
    value: number;
}

// เรียงตามชื่อสารให้ลำดับป้ายคงที่เสมอ — ลำดับคีย์ในอ็อบเจกต์มาจากลำดับแถว measurements ใน DB ซึ่งไม่การันตี
// ถ้าไม่เรียง ป้ายจะสลับตำแหน่งไปมาระหว่างการ์ด
const byName = (a: ChemReading, b: ChemReading) => a.name.localeCompare(b.name);

/**
 * [TH] อ่านค่าสารทั้งหมดจากอ็อบเจกต์ตัวอย่างน้ำที่มีคีย์แบนเป็น {name}Val / {name}Value
 * [EN] Parses all chemical readings from a flattened record object containing Val/Value suffixes
 *
 * @function readChemValues
 * @param {Record<string, unknown> | null | undefined} source - อ็อบเจกต์ข้อมูลตัวอย่างน้ำ
 * @param {Record<string, string> | null} [formulaByName] - แมพจับคู่ชื่อสารกับสูตรเคมี
 * @returns {ChemReading[]} รายการค่าสารเคมีที่จัดเรียงตามชื่อ
 */
export function readChemValues(source: Record<string, unknown> | null | undefined, formulaByName?: Record<string, string> | null): ChemReading[] {
    if (!source) return [];
    const readings: ChemReading[] = [];
    for (const [key, raw] of Object.entries(source)) {
        const name = chemNameFromValueKey(key);
        if (!name) continue;
        // กันคีย์อื่นที่บังเอิญลงท้าย Val/Value แต่ไม่ใช่ค่าวัด (ชนิดของ sample เป็น index signature จึงกันไว้ก่อน)
        if (raw === null || raw === undefined || raw === "") continue;
        const value = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(value)) continue;
        readings.push({ key, name, abbrev: chemAbbrev(name, formulaByName?.[name.toLowerCase()]), color: chemIconColor(name), value });
    }
    return readings.sort(byName);
}

/**
 * [TH] อ่านค่าสารเคมีจากอาร์เรย์ measurements ของคำขอแก้ไขตัวอย่างน้ำ
 * [EN] Extracts normalized chemical readings from a measurements array of sample review requests
 *
 * @function readChemMeasurements
 * @param {Array<{ parameterName?: string | null; parameterFormula?: string | null; value: number | null }> | null | undefined} measurements - อาร์เรย์ข้อมูลการตรวจวัด
 * @returns {ChemReading[]} รายการค่าสารเคมีที่จัดเรียงตามชื่อ
 */
export function readChemMeasurements(
    measurements: Array<{ parameterName?: string | null; parameterFormula?: string | null; value: number | null }> | null | undefined,
): ChemReading[] {
    if (!measurements) return [];
    const readings: ChemReading[] = [];
    const seen = new Set<string>();
    for (const m of measurements) {
        const name = (m.parameterName || "").trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        // เช็ค null/undefined แยกด้วย — Number.isFinite ไม่ใช่ type predicate จึงไม่ narrow ชนิดให้ TS
        if (m.value === null || m.value === undefined || !Number.isFinite(m.value)) continue;
        seen.add(name.toLowerCase());
        readings.push({ key: name, name, abbrev: chemAbbrev(name, m.parameterFormula), color: chemIconColor(name), value: m.value });
    }
    return readings.sort(byName);
}
