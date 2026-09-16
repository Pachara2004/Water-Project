/**
 * @file app/api/auth/route.ts
 * @project Water Monitoring Project
 * @module API / Authentication
 * @description
 * [TH] Route Handler สำหรับการเข้าสู่ระบบผ่าน LINE LIFF (POST)
 * ตรวจสอบความถูกต้องของ Access Token กับ LINE Profile API และสร้างหรืออัปเดตบัญชีผู้ใช้ในระบบ
 * พร้อมบังคับตรวจสอบการยอมรับข้อตกลงและนโยบายความเป็นส่วนตัว (PDPA / Terms of Service) ก่อนบันทึก LINE UID
 * [EN] Route Handler for user authentication via LINE LIFF (POST).
 * Verifies accessToken against the official LINE Profile API, creates or updates user records,
 * and enforces Terms of Service acceptance prior to persisting LINE UID into the database.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.2.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-06-09)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-06)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-15)
 *
 * @lastModified 2026-09-15
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-06-09 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Initial user authentication flow
 * - 2026-07-06 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Update user session and profile mapping
 * - 2026-09-15 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Enforce terms acceptance before persisting LINE UID
 *
 * @database Prisma Client (MySQL)
 * @auth LINE LIFF Access Token / LINE Profile API
 * @security Fail-closed verification with LINE API, PDPA compliance
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TERMS_VERSION } from "@/lib/termsVersion";
import { nowThai } from "@/lib/thaiTime";

/**
 * ดำเนินการยืนยันตัวตนผู้ใช้ผ่าน LINE Access Token และสร้าง/อัปเดตข้อมูลผู้ใช้ในระบบ
 * Authenticates user via LINE Access Token and creates or updates database records.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม JSON payload { accessToken, name, acceptedTerms }
 * @returns {Promise<NextResponse>} ข้อมูลโปรไฟล์ผู้ใช้และระดับสิทธิ์ (Role)
 */
export async function POST(request: NextRequest) {

    try {
        const body = await request.json();
        // เปลี่ยนจากรับ lineUid ตรง ๆ เป็นรับ accessToken ที่ได้จาก liff.getAccessToken()
        const { accessToken, name, acceptedTerms } = body;

        if (!accessToken || !name) {
            return NextResponse.json({ error: "กรุณาระบุ accessToken และ name ให้ครบถ้วน" }, { status: 400 });
        }

        // ยิงไปเอาโปรไฟล์จริงจาก LINE API โดยใช้ Access Token ที่หน้าบ้านส่งมา
        const lineProfileRes = await fetch("https://api.line.me/v2/profile", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!lineProfileRes.ok) {
            return NextResponse.json({ error: "โทเคน LINE ไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 401 });
        }

        const profileData = await lineProfileRes.json();
        const lineUid = profileData.userId;

        // --- โลจิกจัดการฐานข้อมูลตารางผู้ใช้ของตามเดิม ---
        let user = await prisma.user.findUnique({
            where: { lineUniqueId: lineUid },
            include: { systemRole: true },
        });

        if (!user) {
            // uid ใหม่จะถูกเก็บก็ต่อเมื่อผู้ใช้กดยอมรับข้อตกลงมาแล้วเท่านั้น (LINE User Data Policy / PDPA)
            // หน้าบ้านต้องผ่าน GET /api/auth/status → TermsGate ก่อน แล้วค่อยเรียกมาที่นี่พร้อม flag
            if (acceptedTerms !== true) {
                return NextResponse.json({ error: "กรุณายอมรับข้อตกลงการใช้งานก่อนสร้างบัญชี", code: "TERMS_REQUIRED" }, { status: 400 });
            }

            const guestRole = await prisma.role.findUnique({
                where: { roleName: "guest" },
            });

            if (!guestRole) {
                return NextResponse.json({ error: "ไม่พบกลุ่มสิทธิ์ 'guest' ในระบบ" }, { status: 500 });
            }

            user = await prisma.user.create({
                data: {
                    lineUniqueId: lineUid,
                    lineProfileName: name,
                    roleId: guestRole.id,
                    termsAcceptedAt: nowThai(),
                    termsVersion: TERMS_VERSION,
                },
                include: { systemRole: true },
            });
        } else {
            user = await prisma.user.update({
                where: { lineUniqueId: lineUid },
                data: { lineProfileName: name },
                include: { systemRole: true },
            });
        }

        return NextResponse.json({
            id: user.id,
            lineUniqueId: user.lineUniqueId,
            lineProfileName: user.lineProfileName,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            role: user.systemRole.roleName,
        });
    } catch (error) {
        console.error("POST /api/auth error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
