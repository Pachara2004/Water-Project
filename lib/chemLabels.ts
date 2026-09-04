// ป้ายชื่อ/ตัวย่อ/สีของสารเคมีสำหรับการ์ดตัวอย่างน้ำ
// ไม่มีตารางผูกชื่อสารกับตัวย่อหรือสีไว้ตายตัว — ทุกอย่างคำนวณจากชื่อสารที่มาจากตาราง `parameters`
// สารใหม่ที่เพิ่มใน DB จึงแสดงผลได้เองโดยไม่ต้องแก้โค้ดหน้าเว็บ

// API list (app/api/samples/route.ts) แบนค่าสารเป็นคีย์ `${ชื่อสาร}Val`
// ส่วน API detail (app/api/samples/[id]/route.ts) ใช้ `${ชื่อสาร}Value`
// lazy group + เรียง Val ก่อน Value ทำให้ถอด suffix ได้ถูกทั้งสองแบบ
const CHEM_VALUE_KEY = /^(.+?)(?:Val|Value)$/;

// คีย์ค่าสาร -> ชื่อสาร (เช่น "ammoniaVal" -> "ammonia") คืน null ถ้าไม่ใช่คีย์ค่าสาร
export function chemNameFromValueKey(key: string): string | null {
    const matched = CHEM_VALUE_KEY.exec(key);
    return matched ? matched[1] : null;
}

// ตัวย่อ = อักษรตัวแรกของชื่อสาร (ammonia -> A, phosphate -> P)
// ข้อจำกัด: สารที่ขึ้นต้นด้วยอักษรเดียวกันจะได้ตัวย่อชนกัน (เช่น phosphate กับ ph ได้ P ทั้งคู่)
export function chemAbbrev(name: string): string {
    return name.trim().charAt(0).toUpperCase() || "?";
}

// ชุดสีไอคอนของป้าย — เลือกด้วย hash ของชื่อสาร สารเดิมจึงได้สีเดิมทุกครั้งที่เรนเดอร์
const CHEM_ICON_COLORS = ["text-teal-500", "text-purple-500", "text-amber-500", "text-sky-500", "text-rose-500", "text-lime-600"];

// สีเดียวกับ CHEM_ICON_COLORS แต่เป็นค่าสี CSS จริง เรียงดัชนีให้ตรงกันแบบหนึ่งต่อหนึ่ง
// จำเป็นเพราะ SVG (เส้นกราฟ) รับ Tailwind class ไม่ได้ ต้องการค่าสีตรง ๆ
const CHEM_STROKE_COLORS = ["#14b8a6", "#a855f7", "#f59e0b", "#0ea5e9", "#f43f5e", "#65a30d"];

// ดัชนีสีประจำสาร — แยกออกมาให้ไอคอนกับเส้นกราฟใช้สูตรเดียวกัน
// ถ้าคำนวณแยกกัน สารตัวเดียวจะได้คนละสีในสองที่บนจอเดียวกัน
function chemColorIndex(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return hash % CHEM_ICON_COLORS.length;
}

export function chemIconColor(name: string): string {
    return CHEM_ICON_COLORS[chemColorIndex(name)];
}

/** สีเส้นกราฟประจำสาร — คู่ขนานกับ `chemIconColor` และให้เฉดเดียวกันเสมอ */
export function chemStrokeColor(name: string): string {
    return CHEM_STROKE_COLORS[chemColorIndex(name)];
}

/**
 * ค่าที่วัดได้ในรูปข้อความ — null/undefined/NaN คือ "ยังไม่มีค่า" ไม่ใช่ 0
 *
 * แสดงขีดแทนตัวเลข เพื่อไม่ให้ผลที่ AI อ่านไม่ได้ดูเหมือนวัดได้ 0.00 จริง
 * (ค่า 0 จริงยังแสดงเป็น "0.00" ตามปกติ — สองกรณีนี้ต้องแยกออกจากกันบนหน้าจอ)
 */
export function formatMeasuredValue(value: number | null | undefined, digits = 2): string {
    return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

export interface ChemReading {
    key: string; // คีย์/ชื่อเดิมที่ใช้เป็น React key
    name: string; // ชื่อสารเต็มจาก DB เช่น "ammonia"
    abbrev: string; // ตัวย่อที่แสดงบนป้าย
    color: string; // Tailwind class ของไอคอน
    value: number;
}

// เรียงตามชื่อสารให้ลำดับป้ายคงที่เสมอ — ลำดับคีย์ในอ็อบเจกต์มาจากลำดับแถว measurements ใน DB ซึ่งไม่การันตี
// ถ้าไม่เรียง ป้ายจะสลับตำแหน่งไปมาระหว่างการ์ด
const byName = (a: ChemReading, b: ChemReading) => a.name.localeCompare(b.name);

// อ่านค่าสารทั้งหมดจากอ็อบเจกต์ตัวอย่างน้ำที่ค่าสารถูกแบนเป็นคีย์ (การ์ด collector / BottomSheet)
export function readChemValues(source: Record<string, unknown> | null | undefined): ChemReading[] {
    if (!source) return [];
    const readings: ChemReading[] = [];
    for (const [key, raw] of Object.entries(source)) {
        const name = chemNameFromValueKey(key);
        if (!name) continue;
        // กันคีย์อื่นที่บังเอิญลงท้าย Val/Value แต่ไม่ใช่ค่าวัด (ชนิดของ sample เป็น index signature จึงกันไว้ก่อน)
        if (raw === null || raw === undefined || raw === "") continue;
        const value = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(value)) continue;
        readings.push({ key, name, abbrev: chemAbbrev(name), color: chemIconColor(name), value });
    }
    return readings.sort(byName);
}

// อ่านค่าสารจาก array measurements ที่มีชื่อสารมาตรงๆ (หน้าอนุมัติคำร้อง)
// สารซ้ำเอาตัวแรกที่เจอ คงพฤติกรรมเดิมที่ใช้ .find()
export function readChemMeasurements(measurements: Array<{ parameterName?: string | null; value: number | null }> | null | undefined): ChemReading[] {
    if (!measurements) return [];
    const readings: ChemReading[] = [];
    const seen = new Set<string>();
    for (const m of measurements) {
        const name = (m.parameterName || "").trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        // เช็ค null/undefined แยกด้วย — Number.isFinite ไม่ใช่ type predicate จึงไม่ narrow ชนิดให้ TS
        if (m.value === null || m.value === undefined || !Number.isFinite(m.value)) continue;
        seen.add(name.toLowerCase());
        readings.push({ key: name, name, abbrev: chemAbbrev(name), color: chemIconColor(name), value: m.value });
    }
    return readings.sort(byName);
}
