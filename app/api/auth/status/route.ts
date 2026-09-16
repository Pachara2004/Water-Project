/**
 * @file app/api/auth/status/route.ts
 * @project Water Monitoring Project
 * @module API / Authentication
 * @description
 * [TH] Route Handler สำหรับตรวจสอบสถานะการลงทะเบียนและสถานะการยอมรับข้อตกลงของผู้ใช้ (GET)
 * ตรวจสอบว่า LINE UID ของผู้ใช้มีบัญชีในระบบแล้วหรือไม่ และยอมรับข้อตกลงฉบับปัจจุบันแล้วหรือยัง (อ่านอย่างเดียว ไม่สร้างผู้ใช้)
 * ใช้สำหรับตัดสินใจในการแสดง TermsGate Modal ที่หน้าบ้านก่อนส่งคำขอเข้าสู่ระบบ
 * [EN] Route Handler for checking user registration and terms acceptance status (GET).
 * Verifies whether the LINE user already has a database record and has accepted the latest terms version (read-only).
 * Utilized by client-side TermsGate before proceeding to login or registration.
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
 * - 2026-09-15 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Initial status route for terms gate check
 *
 * @database Prisma Client (MySQL)
 * @auth Bearer Token (LINE LIFF Access Token)
 * @see components/TermsGate.tsx
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { TERMS_VERSION } from "@/lib/termsVersion";

/**
 * ตรวจสอบสถานะการลงทะเบียนและยอมรับข้อตกลงของผู้ใช้
 * Checks user registration status and terms acceptance against current version.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม Bearer Token
 * @returns {Promise<NextResponse>} ผลสถานะ { registered: boolean, termsAccepted: boolean }
 */
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request);

    if (auth.isValid) {
        const user = await prisma.user.findUnique({
            where: { id: auth.user!.id },
            select: { termsVersion: true },
        });
        return NextResponse.json({ registered: true, termsAccepted: user?.termsVersion === TERMS_VERSION });
    }

    // verifyAuth คืน 404 เฉพาะกรณี token ถูกต้องแต่ยังไม่มีผู้ใช้ใน DB
    if (auth.errorStatus === 404) {
        return NextResponse.json({ registered: false, termsAccepted: false });
    }

    return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
}
