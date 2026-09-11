/**
 * กติกาเวลาของทั้งระบบ: ทุกคอลัมน์ DATETIME ใน DB เก็บ "นาฬิกาไทย" ตรง ๆ
 *
 * แถวที่มี collection_time = 14:30:00 หมายถึง 14:30 น. ตามเวลาประเทศไทย ไม่ใช่ UTC
 * เปิด DB ดูจึงอ่านตรงกับที่หน้าจอแสดงโดยไม่ต้องบวกลบอะไร
 *
 * ผลที่ตามมาในฝั่ง server (Node/Prisma ถือทุก DateTime เป็น UTC):
 *   - Date ที่อ่านจาก DB มีค่า getUTC*() = เวลาไทย → อ่าน/แก้ปฏิทินด้วย getUTC*() / setUTC*() เท่านั้น
 *     ห้ามใช้ getHours()/getDate()/setHours() เพราะค่าพวกนั้นขึ้นกับ TZ ของ process ที่รัน
 *   - "ตอนนี้" ที่จะเทียบหรือเขียนลง DB ต้องมาจาก nowThai() ห้ามใช้ new Date() ตรง ๆ
 *     (new Date() เป็น instant จริง ค่า getUTC*() ของมันคือ UTC ซึ่งช้ากว่าไทย 7 ชม.)
 *   - Date เหล่านี้ไม่ใช่ instant จริง ห้ามเอาไปเทียบกับ Date.now() หรือส่งให้ไลบรารีที่ต้องการ instant
 *
 * ฝั่ง client: API ส่งสตริงแบบไม่มี Z/offset (ดู toApiString) → browser parse เป็นเวลาเครื่อง
 * แล้วแสดงเป็นเวลาเครื่อง ตัวเลขจึงคงเดิมไม่ว่าผู้ใช้อยู่ TZ ใด และห้ามใส่ timeZone: "Asia/Bangkok"
 * ตอนแสดงผล ไม่งั้นจะบวก 7 ชม.ซ้ำ
 *
 * ใช้ได้เพราะไทยเป็น UTC+7 คงที่ ไม่มี DST — ห้ามลอกไปใช้กับโซนที่มี DST
 */

const THAI_OFFSET_MS = 7 * 60 * 60 * 1000;

/** เวลาไทย ณ ตอนนี้ ในรูป Date ที่ getUTC*() อ่านออกมาเป็นนาฬิกาไทย — ใช้แทน new Date() ทุกที่ที่จะเทียบ/เขียน DB */
export function nowThai(): Date {
    return new Date(Date.now() + THAI_OFFSET_MS);
}

/**
 * แปลงสตริงเวลาจาก client ("2026-09-11T14:30", "…:00+07:00", "…Z") เป็น Date ตามกติกาข้างบน
 * ตัวเลขในสตริงถูกอ่านเป็นเวลาไทยเสมอ ไม่ว่าจะแนบ offset อะไรมา (offset ถูกทิ้ง)
 * คืน null เมื่อรูปแบบไม่ถูกต้อง ให้ผู้เรียกตอบ 400 เอง
 */
export function parseThaiInput(timeStr: string): Date | null {
    const cleanStr = timeStr.trim().replace(/(Z|[+-]\d{2}:\d{2})$/, "");
    const match = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
    if (!match) return null;
    const [, y, mo, d, h, mi, s] = match;
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), s ? Number(s) : 0));
    return Number.isNaN(date.getTime()) ? null : date;
}

/** รูปแบบที่ API ส่งให้ client: ISO แบบไม่มี Z ("2026-09-11T14:30:00.000") — browser จะอ่านเป็นเวลาเครื่อง */
export function toApiString(d: Date): string;
export function toApiString(d: Date | null | undefined): string | null;
export function toApiString(d: Date | null | undefined): string | null {
    if (!d) return null;
    return d.toISOString().replace("Z", "");
}

/** เที่ยงคืนของวัน "YYYY-MM-DD" ตามนาฬิกาไทย (ขอบล่างแบบ inclusive) */
export function dayStart(ymd: string): Date {
    return new Date(`${ymd}T00:00:00Z`);
}

/** เที่ยงคืนของวันถัดไป — ใช้กับ "น้อยกว่า" เพื่อครอบคลุมทั้งวันโดยไม่ต้องเดา .999 */
export function dayEnd(ymd: string): Date {
    const d = dayStart(ymd);
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
}

/** ขอบล่าง/บนของวันเดียวกับ Date ที่ให้มา (ใช้นับลำดับรหัส SP/SES ในวันนั้น) */
export function sameDayRange(d: Date): { start: Date; end: Date } {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
}

/** ปัดลงเป็นต้นชั่วโมง — ใช้ทำ key ค้นตาราง WeatherData ที่เก็บเป็นรายชั่วโมง */
export function floorToHour(d: Date): Date {
    const out = new Date(d);
    out.setUTCMinutes(0, 0, 0);
    return out;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" ตามนาฬิกาไทย */
export function toYmd(d: Date): string {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** "YYMMDD" สำหรับรหัส SP/SES */
export function toYymmdd(d: Date): string {
    return `${String(d.getUTCFullYear()).slice(-2)}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
}

/** "YYYY-MM-DD HH:mm" สำหรับไฟล์ที่ส่งออก */
export function toDisplayDateTime(d: Date): string {
    return `${toYmd(d)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
