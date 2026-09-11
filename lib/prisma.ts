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

export type ExtendedPrismaClient = ReturnType<typeof createClient>;

/**
 * client ภายใน interactive transaction ของ client ที่ต่อ extension แล้ว
 * ใช้แทน Prisma.TransactionClient ในทุกฟังก์ชันที่รับ tx — type เดิมเป็นของ client เปล่า จึงรับ tx จาก client นี้ไม่ได้
 */
export type TxClient = Parameters<Parameters<ExtendedPrismaClient["$transaction"]>[0] extends (tx: infer T) => unknown ? (tx: T) => unknown : never>[0];

// key ตั้งชื่อเฉพาะ ไม่ใช้ "prisma" เดิม — dev server ที่รันอยู่ก่อนจะยังถือ client เปล่า (ไม่มี extension) ไว้ใน key เก่า
// ถ้าใช้ชื่อเดียวกัน hot reload จะหยิบตัวเก่ามาใช้ต่อ แล้วเวลาที่ Prisma เติมให้เองจะกลับเป็น UTC โดยไม่มีอะไรฟ้อง
const globalForPrisma = globalThis as unknown as {
    prismaThaiTimestamps: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prismaThaiTimestamps ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaThaiTimestamps = prisma;
