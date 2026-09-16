/**
 * @file lib/csv.ts
 * @project Water Monitoring Project
 * @module File Export / CSV Serialization & Security
 * @description
 * [TH] โมดูลแปลงข้อมูลเป็นแถว CSV และการรักษาความปลอดภัย (CSV Sanitization & Escaping)
 * ป้องกันช่องโหว่ CSV Injection (Formula Injection ที่ขึ้นต้นด้วย `=`, `+`, `-`, `@`)
 * จัดการ Escape เครื่องหมายคำพูดคู่ (`""`) อักขระจุลภาค และการขึ้นบรรทัดใหม่
 * พร้อมค่า UTF-8 Byte Order Mark (BOM) เพื่อให้โปรแกรม Microsoft Excel เปิดอ่านภาษาไทยได้อย่างถูกต้อง
 *
 * [EN] CSV serialization and security sanitization module.
 * Mitigates CSV Formula Injection risks (escaping leading `=`, `+`, `-`, `@`), handles double-quote escaping and commas,
 * and supplies UTF-8 Byte Order Mark (BOM) for seamless Thai typography rendering in Microsoft Excel.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-31
 * @modified 2026-07-31
 * @version 1.0.0
 * @license Proprietary
 *
 * @see {@link /app/api/samples/export-csv/route.ts} Streaming CSV export endpoint
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-31)
 *
 * @lastModified 2026-07-31
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-07-31 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: แก้ฟังก์ชัน export ข้อมูล
 */

/**
 * การเขียนค่าลงไฟล์ CSV ให้ปลอดภัยและเปิดใน Excel ได้ถูกต้อง
 *
 * ครอบสองปัญหาที่ทำให้ไฟล์เพี้ยนเงียบ ๆ:
 * 1. ค่าที่มีลูกน้ำ / เครื่องหมายคำพูด / ขึ้นบรรทัดใหม่ (เช่นชื่อสถานี) ทำให้คอลัมน์เลื่อนทั้งไฟล์ถ้าไม่ครอบและ escape
 * 2. CSV injection — ค่าที่ขึ้นต้นด้วย = + - @ Excel/Sheets ตีความเป็นสูตรและรันทันทีที่เปิดไฟล์
 */

/**
 * [TH] แปลงค่าข้อมูลในช่องตาราง (Cell) ให้ปลอดภัยตามมาตรฐาน CSV และป้องกัน CSV Injection
 * หากค่าเป็นตัวเลขจริงจะส่งออกโดยตรงเพื่อให้ Excel คำนวณได้ หากเป็นข้อความที่มีเครื่องหมายอันตรายจะเติมเครื่องหมายอัญประกาศเดี่ยว (`'`) นำหน้า
 *
 * [EN] Sanitizes and formats a cell value for CSV output.
 * Preserves finite numbers directly for spreadsheet calculations, escapes double quotes,
 * and prefixes injection trigger characters with a single quote.
 *
 * @function csvCell
 * @param {unknown} value - ค่าข้อมูลที่ต้องการแปลง
 * @returns {string} ข้อความที่ผ่านการ Escape สำหรับใส่ในช่อง CSV
 *
 * @example
 * csvCell("Bangkok, Thailand"); // Returns '"Bangkok, Thailand"'
 * csvCell("=SUM(A1:A10)"); // Returns '"\'=SUM(A1:A10)"'
 */
export function csvCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";

    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
}

/**
 * [TH] แปลงอาร์เรย์ของค่าข้อมูลให้กลายเป็นข้อความหนึ่งแถวของไฟล์ CSV พร้อมขึ้นบรรทัดใหม่ด้วย CRLF (`\r\n`)
 * [EN] Formats an array of cell values into a single CSV row terminated with standard CRLF (`\r\n`)
 *
 * @function csvRow
 * @param {unknown[]} values - อาร์เรย์ของค่าในแต่ละคอลัมน์
 * @returns {string} สตริงหนึ่งแถวของ CSV พร้อมตัวแบ่งบรรทัด CRLF
 *
 * @example
 * csvRow(["No.", "Station", "pH"]); // Returns '"No.","Station","pH"\r\n'
 */
export function csvRow(values: unknown[]): string {
    return values.map(csvCell).join(",") + "\r\n";
}

/**
 * [TH] ค่า Byte Order Mark (BOM) สำหรับ UTF-8 (`\uFEFF`) สำหรับใส่ที่จุดเริ่มต้นของไฟล์ CSV เพื่อให้ Microsoft Excel ทราบว่าไฟล์เข้ารหัส UTF-8
 * [EN] UTF-8 Byte Order Mark (BOM) character prepended to CSV streams for automatic Thai UTF-8 recognition in Excel
 * @constant {string}
 */
export const CSV_BOM = "\uFEFF";
