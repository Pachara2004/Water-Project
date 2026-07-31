/**
 * การเขียนค่าลงไฟล์ CSV ให้ปลอดภัยและเปิดใน Excel ได้ถูกต้อง
 *
 * ครอบสองปัญหาที่ทำให้ไฟล์เพี้ยนเงียบ ๆ:
 * 1. ค่าที่มีลูกน้ำ / เครื่องหมายคำพูด / ขึ้นบรรทัดใหม่ (เช่นชื่อสถานี) ทำให้คอลัมน์เลื่อนทั้งไฟล์ถ้าไม่ครอบและ escape
 * 2. CSV injection — ค่าที่ขึ้นต้นด้วย = + - @ Excel/Sheets ตีความเป็นสูตรและรันทันทีที่เปิดไฟล์
 */

// ตัวเลขเขียนดิบ ๆ เพื่อให้ Excel มองเป็นตัวเลขจริง (ค่าติดลบจึงไม่โดนกฎ injection ที่ขึ้นต้นด้วย "-")
export function csvCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";

    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
}

export function csvRow(values: unknown[]): string {
    return values.map(csvCell).join(",") + "\r\n";
}

// BOM นำหน้าไฟล์ กัน Excel อ่านภาษาไทยเป็นอักขระต่างดาว
export const CSV_BOM = "﻿";
