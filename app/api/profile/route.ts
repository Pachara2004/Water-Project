/**
 * @file app/api/profile/route.ts
 * @project Water Monitoring Project
 * @module API / Profile & Account
 * @description
 * [TH] Route Handler สำหรับการแก้ไขข้อมูลโปรไฟล์ของตนเอง (PATCH)
 * อนุญาตให้ผู้ใช้แก้ไขชื่อ-นามสกุล และเบอร์โทรศัพท์ของตนเอง โดยระบุตัวตนผ่าน Token (verifyAuth)
 * มีระบบ Sanitize และตรวจสอบรูปแบบชื่อ (ป้องกัน Script/HTML Injection) และเบอร์โทรศัพท์ไทย/สากล
 * [EN] Route Handler for authenticated user profile self-service update (PATCH).
 * Allows users to update their name and phone number using token identity (preventing IDOR).
 * Enforces sanitization and regex validation for names and Thai/international phone formats.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-06-23
 * @version 1.1.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-06-23)
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-07-07)
 *
 * @lastModified 2026-07-07
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-06-23 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Initial profile management endpoint
 * - 2026-07-07 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Enhanced validation & regex sanitization
 *
 * @database Prisma Client (MySQL)
 * @auth Bearer Token (Authenticated user)
 * @security IDOR-safe via session user id extraction, regex sanitization
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

// Thai mobile: 06x, 08x, 09x (10 digits)
// Thai landline: 02x–05x (9–10 digits)
// International: +66XXXXXXXXX
const PHONE_REGEX = /^(\+66[0-9]{8,9}|0[2-9][0-9]{7,8})$/;

// Allow Thai, Latin, spaces, hyphens — block HTML/script injection
const NAME_REGEX = /^[ก-๙a-zA-Z0-9\s\-'.]+$/;

/**
 * ตัดช่องว่างส่วนเกินและปรับระยะห่างของข้อความ
 * Trims and collapses multiple whitespace characters into single spaces.
 *
 * @param {string} str - ข้อความนำเข้า
 * @returns {string} ข้อความที่ผ่านการทำความสะอาดแล้ว
 */
function sanitize(str: string) {
    return str.trim().replace(/\s+/g, " ");
}

/**
 * แก้ไขชื่อและเบอร์โทรศัพท์ของผู้ใช้งานปัจจุบัน
 * Updates profile name and phone number for the authenticated user.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม JSON payload { firstName, lastName, phoneNumber }
 * @returns {Promise<NextResponse>} ผลลัพธ์ข้อมูลผู้ใช้ที่อัปเดตแล้ว { success: true, user }
 */
export async function PATCH(request: NextRequest) {
    const auth = await verifyAuth(request);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const body = await request.json();
        const { firstName, lastName, phoneNumber } = body;

        // ── Validate name (รวมชื่อ-สกุลเป็นก้อนเดียวให้ตรงกับช่องกรอกเดียวในหน้าจอ) ──
        const cleanFirst = sanitize(String(firstName ?? ""));
        const cleanLast = sanitize(String(lastName ?? ""));
        const fullName = `${cleanFirst} ${cleanLast}`.trim();

        if (!fullName) {
            return NextResponse.json({ field: "name", error: "กรุณากรอกชื่อ-นามสกุลจริง" }, { status: 422 });
        }
        if (fullName.length < 2) {
            return NextResponse.json({ field: "name", error: "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร" }, { status: 422 });
        }
        if (fullName.length > 100) {
            return NextResponse.json({ field: "name", error: "ชื่อต้องไม่เกิน 100 ตัวอักษร" }, { status: 422 });
        }
        if (!NAME_REGEX.test(fullName)) {
            return NextResponse.json({ field: "name", error: "ชื่อมีอักขระที่ไม่อนุญาต" }, { status: 422 });
        }

        // ── Validate phone (จำเป็น ให้ตรงกับ * ในหน้าจอและฝั่ง onboarding เดิม) ──
        const cleanPhone = phoneNumber ? String(phoneNumber).trim().replace(/[-\s]/g, "") : "";
        if (!cleanPhone) {
            return NextResponse.json({ field: "phone", error: "กรุณากรอกเบอร์โทรศัพท์" }, { status: 422 });
        }
        if (!PHONE_REGEX.test(cleanPhone)) {
            return NextResponse.json({ field: "phone", error: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (เช่น 0812345678)" }, { status: 422 });
        }

        // ── Update (ไม่แตะ role — แก้เฉพาะข้อมูลส่วนตัว) ──
        const updated = await prisma.user.update({
            where: { id: auth.user!.id },
            data: {
                firstName: cleanFirst,
                lastName: cleanLast,
                phoneNumber: cleanPhone,
            },
            include: { systemRole: true },
        });

        return NextResponse.json({
            success: true,
            user: {
                id: updated.id,
                lineUniqueId: updated.lineUniqueId,
                lineProfileName: updated.lineProfileName,
                firstName: updated.firstName,
                lastName: updated.lastName,
                phoneNumber: updated.phoneNumber,
                role: updated.systemRole.roleName,
            },
        });
    } catch (error) {
        console.error("PATCH /api/profile error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
    }
}
