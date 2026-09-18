/**
 * @file app/api/standards/location-types/route.ts
 * @project Water Monitoring Project
 * @module API / Standards Management
 * @description
 * [TH] Route Handler เพิ่มประเภทแหล่งน้ำใหม่พร้อมเกณฑ์ของทุกสาร (POST) สำหรับ Admin
 * สร้างประเภท + แถว standards + StandardVersion ใหม่ในทรานแซกชันเดียว เพื่อให้ชุดเกณฑ์ปัจจุบันตรงกับเวอร์ชันล่าสุดเสมอ
 * [EN] Route Handler creating a location type with standards for every parameter and a new StandardVersion (POST, admin only).
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-18
 * @version 1.1.0
 *
 * @database Prisma Client (MySQL)
 * @auth Role-based: admin only
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { buildStandardSnapshot } from "@/lib/standards-db";
import { nowThai, toApiString } from "@/lib/thaiTime";

/** รหัสประเภท: ตัวพิมพ์ใหญ่ ตัวเลข ขีดล่าง ขึ้นต้นด้วยตัวอักษร 2–32 ตัว */
const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,31}$/;
const LABEL_MAX_LENGTH = 100;
const NOTE_MAX_LENGTH = 500;

/**
 * เพิ่มประเภทแหล่งน้ำพร้อมเกณฑ์ (เฉพาะ Admin) ต้องระบุค่าให้ครบทุกสารในระบบ
 *
 * @param request body { code, labelTh, standards: [{ parameterId, maxValue }], note? }
 * @returns {Promise<NextResponse>} { type: { id, code, labelTh }, version: { id, version, createdAt } }
 */
export async function POST(request: NextRequest) {
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const body = await request.json().catch(() => null);
        const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
        const labelTh = typeof body?.labelTh === "string" ? body.labelTh.trim() : "";
        const note = typeof body?.note === "string" ? body.note.trim() : "";
        const rawStandards = body?.standards;

        if (!CODE_PATTERN.test(code)) {
            return NextResponse.json({ error: "รหัสประเภทต้องเป็นตัวอักษรอังกฤษพิมพ์ใหญ่ ตัวเลข หรือขีดล่าง (2–32 ตัว) และขึ้นต้นด้วยตัวอักษร" }, { status: 400 });
        }
        if (!labelTh) {
            return NextResponse.json({ error: "กรุณาระบุชื่อประเภทภาษาไทย" }, { status: 400 });
        }
        if (labelTh.length > LABEL_MAX_LENGTH) {
            return NextResponse.json({ error: `ชื่อประเภทต้องยาวไม่เกิน ${LABEL_MAX_LENGTH} ตัวอักษร` }, { status: 400 });
        }
        if (note.length > NOTE_MAX_LENGTH) {
            return NextResponse.json({ error: `เหตุผลต้องยาวไม่เกิน ${NOTE_MAX_LENGTH} ตัวอักษร` }, { status: 400 });
        }
        if (!Array.isArray(rawStandards) || rawStandards.length === 0) {
            return NextResponse.json({ error: "กรุณาระบุค่าเกณฑ์ของทุกสาร" }, { status: 400 });
        }

        const maxByParameter = new Map<number, number>();
        for (const s of rawStandards) {
            const parameterId = Number(s?.parameterId);
            const maxValue = Number(s?.maxValue);
            if (!Number.isInteger(parameterId)) {
                return NextResponse.json({ error: "รหัสสารไม่ถูกต้อง" }, { status: 400 });
            }
            if (!Number.isFinite(maxValue) || maxValue <= 0) {
                return NextResponse.json({ error: "ค่าเกณฑ์ต้องเป็นตัวเลขมากกว่า 0" }, { status: 400 });
            }
            if (maxByParameter.has(parameterId)) {
                return NextResponse.json({ error: "มีสารซ้ำกันในคำขอ" }, { status: 400 });
            }
            maxByParameter.set(parameterId, maxValue);
        }

        const result = await prisma.$transaction(async (tx) => {
            const duplicate = await tx.locationType.findUnique({ where: { code }, select: { id: true } });
            if (duplicate) return { error: `รหัสประเภท ${code} มีอยู่แล้ว`, status: 409 } as const;

            // ต้องมีค่าให้ทุกสารในระบบ ไม่งั้นประเภทใหม่จะประเมินสารนั้นไม่ได้
            const parameters = await tx.parameter.findMany({ select: { id: true, name: true } });
            const missing = parameters.find((p) => !maxByParameter.has(p.id));
            if (missing) return { error: `ยังไม่ได้ระบุค่าเกณฑ์ของสาร ${missing.name}`, status: 400 } as const;
            const unknown = [...maxByParameter.keys()].find((id) => !parameters.some((p) => p.id === id));
            if (unknown !== undefined) return { error: `ไม่พบสารรหัส ${unknown} ในระบบ`, status: 400 } as const;

            const type = await tx.locationType.create({
                data: {
                    code,
                    labelTh,
                    standards: { create: parameters.map((p) => ({ parameterId: p.id, maxValue: maxByParameter.get(p.id)! })) },
                },
                select: { id: true, code: true, labelTh: true },
            });

            const latest = await tx.standardVersion.findFirst({ select: { version: true }, orderBy: { version: "desc" } });
            const version = await tx.standardVersion.create({
                data: {
                    version: (latest?.version ?? 0) + 1,
                    snapshot: await buildStandardSnapshot(tx),
                    note: note || `เพิ่มประเภทแหล่งน้ำ "${labelTh}" (${code})`,
                    createdById: auth.user!.id,
                    createdAt: nowThai(),
                },
                select: { id: true, version: true, createdAt: true },
            });

            return { type, version } as const;
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json(
            {
                type: result.type,
                version: { id: result.version.id, version: result.version.version, createdAt: toApiString(result.version.createdAt) },
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("[API_STANDARDS_LOCATION_TYPES_POST]", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการเพิ่มประเภทแหล่งน้ำ" }, { status: 500 });
    }
}
