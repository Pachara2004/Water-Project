/**
 * @file lib/pagination.ts
 * @project Water Monitoring Project
 * @module API / Pagination Utilities
 * @description
 * [TH] ยูทิลิตี้มาตรฐานสำหรับการแบ่งหน้าข้อมูลแบบ Offset-based (skip/take) สำหรับ API Route Handlers
 * แปลง URL Query Parameters (`page`, `pageSize`) เป็นพารามิเตอร์สำหรับ Prisma Client อย่างปลอดภัย
 * พร้อมฟังก์ชันจำกัดเพดานความปลอดภัย (Max Page Size Cap) และประกอบโครงสร้าง JSON Response ผลลัพธ์แบบสม่ำเสมอ
 *
 * [EN] Standardized offset-based (skip/take) pagination utility module for API route handlers.
 * Sanitizes URL query parameters (`page`, `pageSize`) into Prisma-compatible inputs with security bounds (Max Page Size),
 * and structures consistent paginated JSON response envelopes (`PageResult<T>`).
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-27
 * @modified 2026-07-27
 * @version 1.0.0
 * @license Proprietary
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-27)
 *
 * @lastModified 2026-07-27
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-07-27 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - perf: ทำ pagination เป็นตัวช่วยกลาง และนำมาใช้หน้า /user
 */

/**
 * ตัวช่วยแบ่งหน้าแบบ offset สำหรับ API route ที่คืนรายการยาวๆ
 *
 * ใช้ offset (skip/take) ไม่ใช่ cursor เพราะ UI ฝั่งหน้าเว็บเป็นแบบมีเลขหน้าและกระโดดข้ามหน้าได้
 * ข้อแลกเปลี่ยนคือ OFFSET ที่ลึกมากๆ จะช้าลง (MySQL ต้องนับข้ามแถวจริง)
 * ถ้าวันหนึ่งมีหน้าเป็นหลักพัน ต้องเปลี่ยนไปใช้ cursor-based แทน
 */

/**
 * [TH] เพดานจำนวนแถวสูงสุดต่อหน้าที่อนุญาต เพื่อป้องกันไคลเอนต์ร้องขอข้อมูลปริมาณมหาศาลจนส่งผลต่อประสิทธิภาพเซิร์ฟเวอร์
 * [EN] Maximum allowed rows per page to prevent heavy unindexed database table scans
 * @constant {number}
 */
const MAX_PAGE_SIZE = 100;

/**
 * [TH] พารามิเตอร์การแบ่งหน้าที่ผ่านการคำนวณและตรวจสอบความปลอดภัยแล้ว
 * [EN] Sanitized pagination parameters ready for database queries
 */
export interface PageParams {
    /** [TH] ลำดับหน้าปัจจุบัน (1-based index) | [EN] Current page number (1-based) */
    page: number;
    /** [TH] จำนวนแถวที่แสดงผลต่อหน้า | [EN] Page size limit */
    pageSize: number;
    /** [TH] จำนวนแถวที่จะข้ามในคำสั่ง SQL (สำหรับ Prisma `skip`) | [EN] Calculated rows to skip for offset */
    skip: number;
    /** [TH] จำนวนแถวที่จะดึงในคำสั่ง SQL (สำหรับ Prisma `take`) | [EN] Number of rows to take */
    take: number;
}

/**
 * [TH] โครงสร้างผลลัพธ์ข้อมูลแบ่งหน้ามาตรฐานของ API
 * [EN] Standard pagination envelope interface for API responses
 * @template T - ชนิดของข้อมูลในอาร์เรย์รายการ
 */
export interface PageResult<T> {
    /** [TH] รายการข้อมูลในหน้าปัจจุบัน | [EN] Current page items */
    items: T[];
    /** [TH] จำนวนรายการทั้งหมดหลังผ่านตัวกรอง | [EN] Total matching items across all pages */
    total: number;
    /** [TH] เลขหน้าปัจจุบัน | [EN] Current page number */
    page: number;
    /** [TH] ขนาดหน้า | [EN] Rows per page */
    pageSize: number;
    /** [TH] จำนวนหน้าทั้งหมดที่คำนวณได้ | [EN] Total number of calculated pages */
    totalPages: number;
}

/**
 * [TH] แปลงและตรวจสอบสตริงเป็นจำนวนเต็มบวก (Positive Integer >= 1) หากไม่ถูกต้องจะคืนค่า fallback
 * [EN] Parses and validates a raw query string into a positive integer (>= 1), returning fallback on invalid input
 *
 * @function positiveInt
 * @param {string | null} raw - ค่าดิบจาก query string
 * @param {number} fallback - ค่าเริ่มต้นกรณีแปลงไม่สำเร็จ
 * @returns {number} ตัวเลขจำนวนเต็มบวก
 */
function positiveInt(raw: string | null, fallback: number): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.floor(parsed);
}

/**
 * [TH] ดึงและคำนวณพารามิเตอร์การแบ่งหน้าจาก `URLSearchParams`
 * ป้องกันการร้องขอค่าเกินจริงด้วยเพดาน `MAX_PAGE_SIZE` (100) และคำนวณค่า `skip` และ `take` ให้พร้อมใช้งานกับ Prisma
 *
 * [EN] Parses and computes pagination parameters from `URLSearchParams`.
 * Caps `pageSize` at `MAX_PAGE_SIZE` (100) and computes offset `skip` and `take` for Prisma queries.
 *
 * @function parsePageParams
 * @param {URLSearchParams} searchParams - Search params จาก request URL
 * @param {number} [defaultPageSize=20] - ขนาดหน้าเริ่มต้นหากผู้ใช้ไม่ได้ระบุมา
 * @returns {PageParams} ออบเจกต์บรรจุ page, pageSize, skip, take
 *
 * @example
 * const { page, pageSize, skip, take } = parsePageParams(request.nextUrl.searchParams, 20);
 * const items = await prisma.user.findMany({ skip, take });
 */
export function parsePageParams(searchParams: URLSearchParams, defaultPageSize = 20): PageParams {
    const page = positiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(positiveInt(searchParams.get("pageSize"), defaultPageSize), MAX_PAGE_SIZE);

    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * [TH] ห่อหุ้มชุดข้อมูลและสถิติการแบ่งหน้าให้อยู่ในโครงสร้าง `PageResult<T>` มาตรฐานของระบบ
 * คำนวณ `totalPages` อัตโนมัติ โดย total เป็นจำนวนแถวหลังผ่านการกรอง เพื่อให้ UI แสดงผลได้อย่างถูกต้อง
 *
 * [EN] Wraps queried dataset and pagination metrics into standard `PageResult<T>` envelope.
 * Automatically computes `totalPages` based on filtered total rows.
 *
 * @function pageResult
 * @template T
 * @param {T[]} items - รายการข้อมูลในหน้าปัจจุบัน
 * @param {number} total - จำนวนแถวทั้งหมดหลังผ่านตัวกรอง
 * @param {PageParams} params - พารามิเตอร์ page และ pageSize
 * @returns {PageResult<T>} ออบเจกต์ผลลัพธ์การแบ่งหน้า
 *
 * @example
 * return NextResponse.json(pageResult(users, totalCount, { page, pageSize, skip, take }));
 */
export function pageResult<T>(items: T[], total: number, { page, pageSize }: PageParams): PageResult<T> {
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
