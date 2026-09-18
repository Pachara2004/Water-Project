/**
 * @file app/api/standards/location-types/[id]/route.ts
 * @project Water Monitoring Project
 * @module API / Standards Management
 * @description
 * [TH] Route Handler ลบประเภทแหล่งน้ำ (DELETE) สำหรับ Admin
 * เกณฑ์ของประเภทนั้นถูกลบตาม (cascade) ทำให้ชุดเกณฑ์ปัจจุบันเปลี่ยน จึงบันทึกเวอร์ชันใหม่ไว้ในทรานแซกชันเดียวกัน
 * ประวัติเวอร์ชันเก่ายังอ่านชื่อประเภทได้ เพราะ snapshot เก็บชื่อไว้ในตัว
 * [EN] Route Handler deleting a location type (DELETE, admin only). Records a new StandardVersion when standards were removed.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-18
 * @version 1.0.0
 *
 * @database Prisma Client (MySQL)
 * @auth Role-based: admin only
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { buildStandardSnapshot } from "@/lib/standards-db";
import { nowThai, toApiString } from "@/lib/thaiTime";

/**
 * ลบประเภทแหล่งน้ำพร้อมเกณฑ์ของประเภทนั้น (เฉพาะ Admin)
 *
 * @returns {Promise<NextResponse>} { deleted: { id, code, labelTh }, removedStandards, version } — version เป็น null ถ้าประเภทนั้นไม่มีเกณฑ์อยู่แล้ว
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { id } = await params;
        const typeId = Number(id);
        if (!Number.isInteger(typeId) || typeId <= 0) {
            return NextResponse.json({ error: "รหัสประเภทไม่ถูกต้อง" }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const type = await tx.locationType.findUnique({ where: { id: typeId }, select: { id: true, code: true, labelTh: true } });
            if (!type) return { error: "ไม่พบประเภทแหล่งน้ำที่ระบุ", status: 404 } as const;

            // ต้องเหลืออย่างน้อย 1 ประเภท ไม่งั้นระบบไม่มีเกณฑ์ให้ประเมินเลย
            const total = await tx.locationType.count();
            if (total <= 1) return { error: "ต้องมีประเภทแหล่งน้ำอย่างน้อย 1 ประเภท", status: 400 } as const;

            const removedStandards = await tx.standard.count({ where: { locationTypeId: typeId } });
            await tx.locationType.delete({ where: { id: typeId } });

            // ไม่มีเกณฑ์ให้ลบ = ชุดเกณฑ์ปัจจุบันไม่เปลี่ยน ไม่ต้องสร้างเวอร์ชัน
            if (removedStandards === 0) return { deleted: type, removedStandards, version: null } as const;

            const latest = await tx.standardVersion.findFirst({ select: { version: true }, orderBy: { version: "desc" } });
            const version = await tx.standardVersion.create({
                data: {
                    version: (latest?.version ?? 0) + 1,
                    snapshot: await buildStandardSnapshot(tx),
                    note: `ลบประเภทแหล่งน้ำ "${type.labelTh}" (${type.code})`,
                    createdById: auth.user!.id,
                    createdAt: nowThai(),
                },
                select: { id: true, version: true, createdAt: true },
            });
            return { deleted: type, removedStandards, version } as const;
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({
            deleted: result.deleted,
            removedStandards: result.removedStandards,
            version: result.version ? { id: result.version.id, version: result.version.version, createdAt: toApiString(result.version.createdAt) } : null,
        });
    } catch (error) {
        console.error("[API_STANDARDS_LOCATION_TYPES_DELETE]", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการลบประเภทแหล่งน้ำ" }, { status: 500 });
    }
}
