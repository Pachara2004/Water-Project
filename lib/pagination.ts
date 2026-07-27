/**
 * ตัวช่วยแบ่งหน้าแบบ offset สำหรับ API route ที่คืนรายการยาวๆ
 *
 * ใช้ offset (skip/take) ไม่ใช่ cursor เพราะ UI ฝั่งหน้าเว็บเป็นแบบมีเลขหน้าและกระโดดข้ามหน้าได้
 * ข้อแลกเปลี่ยนคือ OFFSET ที่ลึกมากๆ จะช้าลง (MySQL ต้องนับข้ามแถวจริง)
 * ถ้าวันหนึ่งมีหน้าเป็นหลักพัน ต้องเปลี่ยนไปใช้ cursor-based แทน
 */

/** เพดานกัน client ยิง pageSize ใหญ่จนดึงทั้งตารางกลับมา ซึ่งทำให้ pagination ไร้ความหมาย */
const MAX_PAGE_SIZE = 100;

export interface PageParams {
    page: number;
    pageSize: number;
    skip: number;
    take: number;
}

export interface PageResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/** อ่านเลขบวกจาก query string — ค่าที่ว่าง/ไม่ใช่ตัวเลข/ติดลบ จะตกกลับเป็น fallback ไม่ใช่ NaN */
function positiveInt(raw: string | null, fallback: number): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.floor(parsed);
}

export function parsePageParams(searchParams: URLSearchParams, defaultPageSize = 20): PageParams {
    const page = positiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(positiveInt(searchParams.get("pageSize"), defaultPageSize), MAX_PAGE_SIZE);

    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * รูปแบบ response มาตรฐานของทุก endpoint ที่แบ่งหน้า
 *
 * total คือจำนวนแถวทั้งหมด "หลังกรอง" ไม่ใช่ทั้งตาราง — ฝั่งหน้าเว็บจึงเอาไปโชว์ว่า "พบ N รายการ" ได้ตรง
 * totalPages เป็น 0 เมื่อไม่พบอะไรเลย เพื่อให้ฝั่ง UI ซ่อนแถบแบ่งหน้าด้วยเงื่อนไขเดียว (totalPages <= 1)
 */
export function pageResult<T>(items: T[], total: number, { page, pageSize }: PageParams): PageResult<T> {
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
