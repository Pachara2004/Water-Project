/**
 * @file app/api/auth/onboarding/route.ts
 * @project Water Monitoring Project
 * @module API / Authentication
 * @description
 * [TH] Route Handler สำหรับการลงทะเบียนข้อมูลผู้ใช้ใหม่และยื่นคำขอสิทธิ์ (PUT)
 * ตรวจสอบความถูกต้องของชื่อ-สกุล และเบอร์โทรศัพท์ (Regex Validation) อัปเดตข้อมูลส่วนตัว
 * และสร้างรายการคำร้องขอเปลี่ยนบทบาทสิทธิ์ (RoleRequest) เมื่อผู้ใช้เลือกสิทธิ์ที่ต้องผ่านการอนุมัติ
 * [EN] Route Handler for user onboarding profile registration and role requests (PUT).
 * Validates names and Thai phone format via regex, updates profile data,
 * and creates a pending RoleRequest when non-guest roles are requested.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-25
 * @version 1.2.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-06-25)
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-07-13)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-04)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-15)
 *
 * @lastModified 2026-09-15
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-06-25 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Initial onboarding flow
 * - 2026-07-13 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Integration with LiffProvider
 * - 2026-09-04 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Auto-skip role request approval for standard guest users
 * - 2026-09-15 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Terms acceptance version validation on onboarding
 *
 * @database Prisma Client (MySQL)
 * @auth Bearer Token (Authenticated user)
 * @security Server-side regex validation, IDOR prevention via token identity
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { TERMS_VERSION } from "@/lib/termsVersion";

/**
 * บันทึกข้อมูลส่วนตัวของผู้ใช้และส่งคำขอสิทธิ์การใช้งาน
 * Updates user personal details and submits role elevation request if necessary.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม JSON payload { firstName, lastName, phoneNumber, requestedRoleName }
 * @returns {Promise<NextResponse>} ผลการบันทึกข้อมูลและสถานะการขออนุมัติ { success, needsApproval, user }
 */
export async function PUT(request: NextRequest) {
    // สกัดสิทธิ์ดักจับโทเคน: อนุญาตให้ทุกบทบาทที่ล็อกอินผ่าน LINE LIFF ถูกต้องเข้าทำรายการได้
    const auth = await verifyAuth(request);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const body = await request.json();
        const { firstName, lastName, phoneNumber, requestedRoleName } = body;

        // ปรับการตรวจสอบข้อมูล: ไม่ต้องพึ่งพา userId จากหน้าบ้านแล้ว ใช้จาก Token จริงแทน
        if (!firstName || !lastName || !phoneNumber || !requestedRoleName) {
            return NextResponse.json({ error: "กรุณากรอกข้อมูลส่วนตัวและเลือกสิทธิ์ให้ครบถ้วน" }, { status: 400 });
        }

        // ดักจับข้อมูลมั่วฝั่ง Backend (Production Security Barrier)
        const nameRegex = /^[A-Za-z]+$/;
        const nameThaiRegex = /^[ก-์]+$/;

        const isFirstValid = nameRegex.test(firstName.trim()) || nameThaiRegex.test(firstName.trim());
        const isLastValid = nameRegex.test(lastName.trim()) || nameThaiRegex.test(lastName.trim());
        const isPhoneValid = /^(06|08|09)[0-9]{8}$/.test(phoneNumber.trim()) && !/^(\d)\1{9}$/.test(phoneNumber.trim());

        if (!isFirstValid || !isLastValid || !isPhoneValid || nameThaiRegex.test(firstName.trim()) !== nameThaiRegex.test(lastName.trim())) {
            return NextResponse.json({ error: "รูปแบบข้อมูลส่วนตัวไม่ถูกต้องตามมาตรฐานระบบความปลอดภัย" }, { status: 400 });
        }

        // ดึงไอดีผู้ใช้งานตรง ๆ จากผลลัพธ์ถอดรหัส Token ของ LINE ที่ปลอดภัย
        const secureUserId = auth.user!.id;

        const existingUser = await prisma.user.findUnique({
            where: { id: secureUserId },
        });

        if (!existingUser) {
            return NextResponse.json({ error: "ไม่พบข้อมูลบัญชีผู้ใช้งานนี้ในระบบ" }, { status: 404 });
        }

        // การยอมรับข้อตกลงถูกบันทึกไว้ที่บัญชีแล้ว (ตอนสร้างใน /api/auth หรือ /api/auth/accept-terms)
        // ถ้าฉบับไม่ตรง แปลว่าข้อตกลงเปลี่ยนระหว่างทาง ให้กลับไปอ่านใหม่ก่อน
        if (existingUser.termsVersion !== TERMS_VERSION) {
            return NextResponse.json({ error: "กรุณายอมรับข้อตกลงการใช้งานฉบับปัจจุบันก่อนลงทะเบียน", code: "TERMS_REQUIRED" }, { status: 400 });
        }

        // 1. อัปเดตข้อมูลส่วนตัว (สิทธิ์ในตาราง user ยังเป็น guest ตามเดิม)
        const updatedUser = await prisma.user.update({
            where: { id: secureUserId },
            data: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phoneNumber: phoneNumber.trim(),
            },
            include: { systemRole: true },
        });

        // 2. ค้นหา Role ปลายทางที่ต้องการร้องขอ
        const targetRole = await prisma.role.findUnique({
            where: { roleName: requestedRoleName.toLowerCase() }, // มั่นใจว่าเป็นพิมพ์เล็ก
        });

        if (!targetRole) {
            return NextResponse.json({ error: "ไม่พบสิทธิ์ที่ต้องการร้องขอในระบบ" }, { status: 400 });
        }

        // 3. สร้างคำร้องขอเปลี่ยนสิทธิ์เฉพาะเมื่อขอสิทธิ์ที่ต่างจากที่ถืออยู่
        //
        // ผู้ใช้ใหม่ถูกสร้างเป็น guest อยู่แล้วตั้งแต่ตอนล็อกอิน LINE (ดู app/api/auth/route.ts)
        // การขอสิทธิ์ "ผู้ใช้งานทั่วไป" จึงไม่มีอะไรให้อนุมัติ ถ้ายังสร้างคำร้องไว้ คิวของผู้ดูแลระบบ
        // จะเต็มไปด้วยรายการที่กดอนุมัติแล้วสิทธิ์ก็เท่าเดิม และผู้ใช้ต้องรอทั้งที่ใช้งานได้ทันที
        const needsApproval = targetRole.id !== updatedUser.roleId;

        if (needsApproval) {
            await prisma.roleRequest.create({
                data: {
                    userId: updatedUser.id,
                    requestedRoleId: targetRole.id,
                    status: "pending",
                },
            });
        }

        return NextResponse.json({
            success: true,
            needsApproval,
            user: {
                id: updatedUser.id,
                lineUniqueId: updatedUser.lineUniqueId,
                lineProfileName: updatedUser.lineProfileName,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                phoneNumber: updatedUser.phoneNumber,
                role: updatedUser.systemRole.roleName, // คืนค่าเป็น "guest" กลับไป
            },
        });
    } catch (error) {
        console.error("PUT /api/auth/onboarding error:", error);
        return NextResponse.json({ error: "Internal Server Error", details: (error as Error).message }, { status: 500 });
    }
}
