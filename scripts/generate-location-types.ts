/**
 * @file scripts/generate-location-types.ts
 * @project Water Monitoring Project
 * @module Scripts / Codegen
 * @description
 * Codegen สร้าง union type LocationTypeCode จากแถวจริงในตาราง location_types ลง lib/generated/location-types.ts
 * เพื่อให้ TypeScript ตรวจโค้ดประเภทแหล่งน้ำที่พิมพ์ผิดตอน compile แทนที่จะเงียบๆ ตกไป fallback ตอน runtime
 * ถ้าต่อ DB ไม่ได้ (เช่น CI) และมีไฟล์เดิม จะใช้ไฟล์ที่ commit ไว้ต่อโดยไม่ล้ม build หยุดทำงานเมื่อตารางว่าง
 * หรือไม่มีโซน COMMUNITY ที่โค้ดใช้เป็นค่า fallback
 *
 * Codegen: emits the LocationTypeCode union from the location_types table. Falls back to the
 * committed file when the DB is unreachable; refuses to emit an empty union or one lacking COMMUNITY.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-17
 * @version 1.0.0
 *
 * @lastModified 2026-07-17 11:06
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-07-17 11:06 by Nopparut U. - สร้างสคริปต์คู่กับการเพิ่มตาราง LocationType และ Standard
 *
 * @database ใช้ lib/prisma (client ตัวเดียวกับแอป)
 * @notes รัน `npm run gen:location-types` และถูกผูกไว้กับ `npm run build`; ไฟล์ผลลัพธ์ commit ลง git เพื่อให้ clone แล้ว typecheck ได้โดยไม่ต้องต่อ DB
 * @license Private / Proprietary
 */

import { writeFile, mkdir, access } from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma";

const OUTPUT_PATH = path.join(process.cwd(), "lib", "generated", "location-types.ts");

/**
 * ประกอบเนื้อไฟล์ TypeScript ที่จะเขียนออก
 *
 * @param codes - รหัสประเภทแหล่งน้ำเรียงตาม id
 */
function buildFileContents(codes: string[]): string {
    const union = codes.map((c) => `"${c}"`).join(" | ");

    return `// ไฟล์นี้ gen อัตโนมัติจากตาราง location_types — ห้ามแก้ด้วยมือ
// แก้ค่าที่ DB แล้วรัน: npm run gen:location-types

export type LocationTypeCode = ${union};

export const LOCATION_TYPE_CODES = [${codes.map((c) => `"${c}"`).join(", ")}] as const;

/** โซนที่ใช้เมื่อจุดเก็บยังไม่ได้ระบุประเภท — คงพฤติกรรมเดิมของระบบไว้ */
export const DEFAULT_LOCATION_TYPE_CODE: LocationTypeCode = "COMMUNITY";

export function isLocationTypeCode(value: string | null | undefined): value is LocationTypeCode {
    return value !== null && value !== undefined && (LOCATION_TYPE_CODES as readonly string[]).includes(value);
}
`;
}

/** true เมื่อไฟล์เข้าถึงได้ ใช้ตัดสิน fallback ตอนต่อ DB ไม่ได้ */
async function fileExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

/** อ่านรหัสจาก DB ตรวจความครบถ้วน แล้วเขียนไฟล์ generated */
async function main() {
    let codes: string[];

    try {
        const rows = await prisma.locationType.findMany({
            select: { code: true },
            orderBy: { id: "asc" },
        });
        codes = rows.map((r) => r.code);
    } catch (error) {
        // ต่อ DB ไม่ได้ (เช่น CI ที่ไม่มี DATABASE_URL) — ถ้ามีไฟล์เดิมอยู่แล้วก็ใช้ต่อ ไม่ต้องล้มทั้ง build
        if (await fileExists(OUTPUT_PATH)) {
            console.warn("⚠️  gen:location-types — ต่อ DB ไม่ได้ ใช้ไฟล์ที่ commit ไว้เดิมต่อไป");
            console.warn(`   ${error instanceof Error ? error.message : String(error)}`);
            return;
        }
        throw new Error(`gen:location-types ต่อ DB ไม่ได้ และไม่มีไฟล์เดิมที่ ${OUTPUT_PATH} ให้ใช้แทน\n${error instanceof Error ? error.message : String(error)}`);
    }

    if (codes.length === 0) {
        throw new Error("gen:location-types — ตาราง location_types ว่าง (ยังไม่ได้รัน seed?) หยุดก่อนเพื่อไม่ให้ gen union ว่างทับไฟล์เดิม");
    }

    if (!codes.includes("COMMUNITY")) {
        throw new Error(`gen:location-types — ไม่พบโซน COMMUNITY ใน DB แต่โค้ดใช้เป็นค่า fallback อยู่ (พบ: ${codes.join(", ")})`);
    }

    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, buildFileContents(codes), "utf-8");

    console.log(`✅ gen:location-types — เขียน ${codes.length} โซนลง lib/generated/location-types.ts`);
    console.log(`   ${codes.join(", ")}`);
}

main()
    .catch((e) => {
        console.error(e instanceof Error ? e.message : e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
