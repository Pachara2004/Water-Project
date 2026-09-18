/**
 * @file app/api/standards/versions/[id]/route.ts
 * @project Water Monitoring Project
 * @module API / Standards Management
 * @description
 * [TH] Route Handler ดึง snapshot ของเกณฑ์มาตรฐานเวอร์ชันที่ระบุ (GET) ทุก role ที่ล็อกอินอ่านได้
 * เพราะหน้าประวัติของผู้เก็บตัวอย่างต้องใช้แสดงตารางเปรียบเทียบด้วยเกณฑ์ชุดที่ตัดสินจริง
 * [EN] Route Handler returning one standard version with its snapshot (GET). Any authenticated role.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-18
 * @version 1.0.0
 *
 * @database Prisma Client (MySQL)
 * @auth Authenticated (any role)
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-guard";
import { loadStandardVersionSnapshot } from "@/lib/standards-db";
import { toApiString } from "@/lib/thaiTime";

/**
 * snapshot ของเวอร์ชันที่ระบุ
 *
 * @returns {Promise<NextResponse>} { id, version, createdAt, snapshot }
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAuth(request);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { id } = await params;
        const versionId = Number(id);
        if (!Number.isInteger(versionId) || versionId <= 0) {
            return NextResponse.json({ error: "รหัสเวอร์ชันไม่ถูกต้อง" }, { status: 400 });
        }

        const version = await loadStandardVersionSnapshot(versionId);
        if (!version) {
            return NextResponse.json({ error: "ไม่พบเวอร์ชันเกณฑ์ที่ระบุ" }, { status: 404 });
        }

        return NextResponse.json({
            id: version.id,
            version: version.version,
            createdAt: toApiString(version.createdAt),
            snapshot: version.snapshot,
        });
    } catch (error) {
        console.error("[API_STANDARDS_VERSION_GET]", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงเวอร์ชันเกณฑ์" }, { status: 500 });
    }
}
