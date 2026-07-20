/**
 * Codegen: LocationType union จากแถวจริงใน DB
 * ─────────────────────────────────────────────────────────
 * ประเภทการใช้ประโยชน์ของแหล่งน้ำย้ายไปอยู่ในตาราง `location_types` แล้ว ซึ่ง TypeScript
 * มองไม่เห็นตอน compile — ถ้าปล่อยให้เป็น `string` เปล่า ๆ การพิมพ์ code ผิด (เช่น "CORAL_RIF")
 * จะหลุดไป runtime แล้วเงียบ ๆ ตกไปใช้ค่า fallback ซึ่งเป็นบั๊กแบบเดียวกับที่ระบบนี้เคยเจอมาแล้ว
 *
 * สคริปต์นี้จึงอ่าน code ทั้งหมดจาก DB แล้ว gen เป็น union type ให้ TS ตรวจให้เหมือนเดิม
 *
 * รัน: npm run gen:location-types  (ผูกไว้กับ npm run build ด้วย)
 * ไฟล์ผลลัพธ์ commit ลง git — เพื่อให้ clone มาแล้ว typecheck ได้โดยไม่ต้องต่อ DB
 */

import { writeFile, mkdir, access } from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma";

const OUTPUT_PATH = path.join(process.cwd(), "lib", "generated", "location-types.ts");

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

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

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
