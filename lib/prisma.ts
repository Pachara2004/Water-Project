/**
 * @file lib/prisma.ts
 * @project Water Monitoring Project
 * @module Database / Prisma Client Management
 * @description
 * [TH] ตัวจัดการ Prisma Client ส่วนกลาง (Singleton Instance) ที่ติดตั้ง Extension อัตโนมัติสำหรับจัดการเวลาไทย (Thai Timestamps)
 * ดักจับคำสั่งเขียนข้อมูล (create, createMany, update, updateMany, upsert) รวมถึง Nested Writes ในทุกระดับ
 * เพื่อแทนที่ค่าเวลาเริ่มต้น (default now / updatedAt) จาก UTC เป็นเวลาประเทศไทย (GMT+7 ผ่าน nowThai())
 * พร้อมทั้งจัดการการเชื่อมต่อบนโหมด Development เพื่อป้องกันการสร้าง Connection ซ้ำซ้อนจากการทำ Hot Reload
 *
 * [EN] Centralized Prisma Client singleton instance with custom Thai Timestamps extension.
 * Intercepts all write operations (create, createMany, update, updateMany, upsert) including recursive nested writes
 * to ensure all automated DateTime columns conform to Thailand timezone (GMT+7 via nowThai()) instead of UTC defaults.
 * Prevents redundant database connection leaks during development hot-reloading.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @modified 2026-09-11
 * @version 2.1.0
 * @license Proprietary
 *
 * @see {@link /lib/thaiTime.ts} ยูทิลิตี้เวลาไทย nowThai()
 * @see {@link prisma/schema.prisma} นิยามโมเดลฐานข้อมูล MySQL
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - ออกแบบและเริ่มต้นระบบเชื่อมต่อฐานข้อมูล Prisma
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - พัฒนา Prisma Extension บังคับเวลาไทยและปรับปรุง Global Cache Key
 *
 * @lastModified 2026-09-11
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: เปลี่ยน key ที่ cache prisma client ใน globalThis กัน dev server หยิบตัวเก่า
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: ยึดเวลาไทยเป็นนิยามเดียวของทุกคอลัมน์ DateTime ใน DB
 * - 2026-06-26 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - refactor: .ใช้ prettierrc ส่วนกลาง
 * - 2026-06-09 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - setup system
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { nowThai } from "@/lib/thaiTime";

/**
 * ฟิลด์ที่ Prisma เติมเวลาให้เองต่อ model (ทั้ง @default(now()) และ @updatedAt)
 * อ่านจาก DMMF ของ schema จริง จึงไม่ต้องไล่จดชื่อฟิลด์เอง — เพิ่ม model ใหม่ใน schema ก็ครอบคลุมทันที
 * ค่า now() ที่ Prisma ใส่ให้เป็น UTC ซึ่งขัดกับกติกา "DB เก็บนาฬิกาไทย" (ดู lib/thaiTime.ts)
 * extension ด้านล่างจึงเขียนทับด้วย nowThai() ทุกครั้งที่ผู้เรียกไม่ได้ระบุค่ามาเอง
 */
type AutoFields = { onCreate: string[]; onUpdate: string[] };
const autoFieldsByModel = new Map<string, AutoFields>();
const relationTargetByModel = new Map<string, Map<string, string>>();

for (const model of Prisma.dmmf.datamodel.models) {
    const onCreate: string[] = [];
    const onUpdate: string[] = [];
    const relations = new Map<string, string>();
    for (const f of model.fields) {
        if (f.kind === "object") relations.set(f.name, f.type);
        if (f.type !== "DateTime") continue;
        const hasNowDefault = typeof f.default === "object" && f.default !== null && "name" in f.default && f.default.name === "now";
        if (hasNowDefault || f.isUpdatedAt) onCreate.push(f.name);
        if (f.isUpdatedAt) onUpdate.push(f.name);
    }
    autoFieldsByModel.set(model.name, { onCreate, onUpdate });
    relationTargetByModel.set(model.name, relations);
}

type Data = Record<string, unknown>;
const isObject = (v: unknown): v is Data => typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);

/**
 * เติมเวลาไทยลง data ของ model นั้น แล้วไล่ลงไปใน nested write (create/createMany/update/upsert/connectOrCreate)
 * ของ relation ด้วย เพราะ extension เห็นแค่ args ชั้นบนสุด — แถวลูกที่สร้างผ่าน measurements: { create: [...] }
 * จะไม่ถูกแตะถ้าไม่ไล่ลงไปเอง
 */
function stampData(model: string, data: unknown, phase: "create" | "update", now: Date): void {
    if (Array.isArray(data)) {
        data.forEach((item) => stampData(model, item, phase, now));
        return;
    }
    if (!isObject(data)) return;

    const fields = autoFieldsByModel.get(model);
    if (fields) {
        for (const name of phase === "create" ? fields.onCreate : fields.onUpdate) {
            if (data[name] === undefined) data[name] = now;
        }
    }

    const relations = relationTargetByModel.get(model);
    if (!relations) return;
    for (const [relName, target] of relations) {
        const nested = data[relName];
        if (!isObject(nested)) continue;
        if (nested.create !== undefined) stampData(target, nested.create, "create", now);
        if (isObject(nested.createMany) && nested.createMany.data !== undefined) stampData(target, nested.createMany.data, "create", now);
        if (nested.update !== undefined) stampNestedUpdate(target, nested.update, now);
        if (nested.updateMany !== undefined) stampNestedUpdate(target, nested.updateMany, now);
        if (nested.upsert !== undefined) stampNestedUpsert(target, nested.upsert, now);
        if (nested.connectOrCreate !== undefined) {
            const items = Array.isArray(nested.connectOrCreate) ? nested.connectOrCreate : [nested.connectOrCreate];
            items.forEach((item) => isObject(item) && stampData(target, item.create, "create", now));
        }
    }
}

// nested update มาได้ทั้ง { data } (relation เดี่ยว) และ [{ where, data }] (relation หลายแถว) หรือ data ตรง ๆ
function stampNestedUpdate(model: string, update: unknown, now: Date): void {
    const items = Array.isArray(update) ? update : [update];
    for (const item of items) {
        if (!isObject(item)) continue;
        if (item.data !== undefined) stampData(model, item.data, "update", now);
        else stampData(model, item, "update", now);
    }
}

function stampNestedUpsert(model: string, upsert: unknown, now: Date): void {
    const items = Array.isArray(upsert) ? upsert : [upsert];
    for (const item of items) {
        if (!isObject(item)) continue;
        stampData(model, item.create, "create", now);
        stampData(model, item.update, "update", now);
    }
}

function createClient() {
    return new PrismaClient().$extends({
        name: "thaiTimestamps",
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    const a = args as Data;
                    const now = nowThai();
                    switch (operation) {
                        case "create":
                        case "createMany":
                            stampData(model, a.data, "create", now);
                            break;
                        case "update":
                        case "updateMany":
                            stampData(model, a.data, "update", now);
                            break;
                        case "upsert":
                            stampData(model, a.create, "create", now);
                            stampData(model, a.update, "update", now);
                            break;
                    }
                    return query(args);
                },
            },
        },
    });
}

/**
 * [TH] ไทป์ของ Prisma Client ที่ได้รับการติดตั้ง Thai Timestamps Extension แล้ว
 * [EN] Type definition of PrismaClient extended with Thai timestamps auto-injection
 */
export type ExtendedPrismaClient = ReturnType<typeof createClient>;

/**
 * [TH] ไทป์ของ Client ภายใน Interactive Transaction (`$transaction`) ของ Client ที่ติดตั้ง Extension แล้ว
 * ใช้ทดแทน `Prisma.TransactionClient` ในฟังก์ชันที่ต้องการส่งต่อ Interactive Transaction
 *
 * [EN] Transaction Client type derived from the extended Prisma Client.
 * Use this in place of `Prisma.TransactionClient` across transactional helper functions.
 */
export type TxClient = Parameters<Parameters<ExtendedPrismaClient["$transaction"]>[0] extends (tx: infer T) => unknown ? (tx: T) => unknown : never>[0];

// key ตั้งชื่อเฉพาะ ไม่ใช้ "prisma" เดิม — dev server ที่รันอยู่ก่อนจะยังถือ client เปล่า (ไม่มี extension) ไว้ใน key เก่า
// ถ้าใช้ชื่อเดียวกัน hot reload จะหยิบตัวเก่ามาใช้ต่อ แล้วเวลาที่ Prisma เติมให้เองจะกลับเป็น UTC โดยไม่มีอะไรฟ้อง
const globalForPrisma = globalThis as unknown as {
    prismaThaiTimestamps: ExtendedPrismaClient | undefined;
};

/**
 * [TH] Prisma Client Singleton Instance สำหรับการเข้าถึงฐานข้อมูล MySQL ทั่วทั้งแอปพลิเคชัน
 * [EN] Global Prisma Client singleton instance for MySQL database operations across application
 */
export const prisma = globalForPrisma.prismaThaiTimestamps ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaThaiTimestamps = prisma;
