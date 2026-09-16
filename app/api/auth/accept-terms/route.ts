/**
 * @file app/api/auth/accept-terms/route.ts
 * @project Water Monitoring Project
 * @module API / Authentication
 * @description
 * [TH] บันทึกการยอมรับข้อตกลงฉบับปัจจุบันของผู้ใช้ที่มีบัญชีอยู่แล้ว (POST)
 * สำหรับบัญชีที่สร้างก่อนมีระบบข้อตกลง หรือกรณีที่มีการปรับปรุงฉบับของข้อตกลงใหม่ (Terms Version Update)
 * [EN] Route Handler to record acceptance of the current terms version for existing accounts (POST).
 * Used for legacy accounts or whenever terms are bumped to a newer version.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-15
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-15)
 *
 * @lastModified 2026-09-15
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-09-15 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Initial creation for terms acceptance tracking
 *
 * @database Prisma Client (MySQL)
 * @auth Bearer Token (Authenticated user)
 * @see lib/termsVersion.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { TERMS_VERSION } from "@/lib/termsVersion";
import { nowThai } from "@/lib/thaiTime";

/**
 * บันทึกการยอมรับข้อตกลงฉบับปัจจุบันของผู้ใช้
 * Records terms acceptance timestamp and version for the authenticated user.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม Bearer Token
 * @returns {Promise<NextResponse>} ผลการบันทึกสำเร็จ { success: true, termsVersion }
 */
export async function POST(request: NextRequest) {
    const auth = await verifyAuth(request);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        await prisma.user.update({
            where: { id: auth.user!.id },
            data: { termsAcceptedAt: nowThai(), termsVersion: TERMS_VERSION },
        });
        return NextResponse.json({ success: true, termsVersion: TERMS_VERSION });
    } catch (error) {
        console.error("POST /api/auth/accept-terms error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
