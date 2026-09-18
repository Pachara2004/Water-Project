/**
 * @file app/api/standards/versions/route.ts
 * @project Water Monitoring Project
 * @module API / Standards Management
 * @description
 * [TH] Route Handler ดึงรายการเวอร์ชันของเกณฑ์มาตรฐานทั้งหมด (GET) เรียงจากใหม่ไปเก่า ไม่รวม snapshot
 * [EN] Route Handler listing all standard versions, newest first, without snapshots (GET).
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
import { toApiString } from "@/lib/thaiTime";

/**
 * รายการเวอร์ชันเกณฑ์ทั้งหมด (เฉพาะ Admin)
 *
 * @returns {Promise<NextResponse>} [{ id, version, note, createdAt, createdBy }]
 */
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const versions = await prisma.standardVersion.findMany({
            select: {
                id: true,
                version: true,
                note: true,
                createdAt: true,
                createdBy: { select: { id: true, lineProfileName: true, firstName: true, lastName: true } },
            },
            orderBy: { version: "desc" },
        });

        return NextResponse.json(
            versions.map((v) => ({
                id: v.id,
                version: v.version,
                note: v.note,
                createdAt: toApiString(v.createdAt),
                createdBy: v.createdBy
                    ? { id: v.createdBy.id, name: `${v.createdBy.firstName || ""} ${v.createdBy.lastName || ""}`.trim() || v.createdBy.lineProfileName }
                    : null,
            })),
        );
    } catch (error) {
        console.error("[API_STANDARDS_VERSIONS_GET]", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงรายการเวอร์ชันเกณฑ์" }, { status: 500 });
    }
}
