/**
 * @file lib/auth-guard.ts
 * @project Water Monitoring Project
 * @module Security / Authentication Guard
 * @description
 * [TH] มิดเดิลแวร์/การ์ดตรวจสอบสิทธิ์ความปลอดภัยสำหรับ Next.js API Route Handlers
 * ถอดรหัส Bearer Access Token ที่ส่งมาจาก LINE LIFF ตรวจสอบความถูกต้องกับ LINE OAuth2/Profile API
 * และจับคู่บัญชีผู้ใช้ในฐานข้อมูล MySQL เพื่อบังคับใช้นโยบายควบคุมการเข้าถึงตามบทบาท (RBAC)
 *
 * [EN] Security authentication and authorization guard for Next.js API Route Handlers.
 * Extracts Bearer Access Tokens issued by LINE LIFF, validates integrity against official LINE OAuth2/Profile APIs,
 * maps authenticated LINE UID to internal database user records, and enforces Role-Based Access Control (RBAC).
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-29
 * @modified 2026-06-29
 * @version 1.0.0
 * @license Proprietary
 *
 * @see {@link /lib/prisma.ts} Prisma database client for user and role queries
 * @see {@link https://developers.line.biz/en/reference/line-login/#verify-access-token} LINE Verify API
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-06-29)
 *
 * @lastModified 2026-06-29
 * @lastModifiedBy Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 *
 * @changelog
 * - 2026-06-29 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - feat(auth): integrate LINE Access Token validation across critical endpoints
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * [TH] อินเตอร์เฟซผลลัพธ์การตรวจสอบสิทธิ์ความปลอดภัย
 * [EN] Interface representing the result of authentication and authorization verification
 */
export interface AuthResult {
    /** [TH] ผ่านการยืนยันตัวตนและมีสิทธิ์ตามที่กำหนดหรือไม่ | [EN] Whether token and role requirements are satisfied */
    isValid: boolean;
    /** [TH] รหัสสถานะ HTTP กรณีเกิดข้อผิดพลาด (เช่น 401, 403, 404, 500) | [EN] HTTP status code for error cases */
    errorStatus?: number;
    /** [TH] ข้อความอธิบายข้อผิดพลาดสำหรับส่งกลับไคลเอนต์ | [EN] Human-readable error message returned to client */
    errorResponse?: string;
    /** [TH] ข้อมูลผู้ใช้งานที่ผ่านการยืนยันสิทธิ์ | [EN] Authenticated user payload */
    user?: {
        /** [TH] รหัสผู้ใช้งานในระบบฐานข้อมูลภายใน | [EN] Internal database user ID */
        id: number;
        /** [TH] LINE Unique Identifier (UID) | [EN] Official LINE UID */
        lineUniqueId: string;
        /** [TH] ชื่อบทบาทสิทธิ์ (ตัวพิมพ์เล็ก เช่น 'admin', 'officer', 'collector') | [EN] Normalized lowercase role name */
        roleName: string;
    };
}

/**
 * [TH] ตรวจสอบ LINE Access Token จาก Authorization Header และสิทธิ์บทบาทในระบบ (RBAC)
 * ส่ง Token ไปตรวจสอบกับ LINE API ป้องกันการปลอมแปลง จากนั้นดึง LINE Profile เพื่อระบุ UID
 * และนำมาค้นหาข้อมูลบทบาทในฐานข้อมูล Prisma หากระบุ `allowedRoles` จะตรวจสอบว่า Role ของผู้ใช้ตรงกับที่อนุญาตหรือไม่
 *
 * [EN] Verifies LINE Access Token from the request authorization header and checks role permissions (RBAC).
 * Verifies token validity with LINE OAuth servers, fetches user profile to extract official LINE UID,
 * and matches user record in the Prisma database. If `allowedRoles` are specified, ensures user's role matches.
 *
 * @async
 * @function verifyAuth
 * @param {NextRequest} request - NextRequest object ที่มี Authorization Bearer token ใน Header
 * @param {string[]} [allowedRoles] - อาร์เรย์ของชื่อบทบาทที่อนุญาตให้เข้าถึง (เช่น ['admin', 'officer']) หากไม่ระบุจะอนุญาตทุกบทบาทที่ล็อกอินแล้ว
 * @returns {Promise<AuthResult>} ผลลัพธ์การตรวจสอบสิทธิ์ ประกอบด้วยสถานะ isValid, ข้อมูลผู้ใช้ หรือ errorStatus/errorResponse
 *
 * @example
 * // ตรวจสอบสิทธิ์เฉพาะผู้ดูแลระบบและเจ้าหน้าที่
 * const auth = await verifyAuth(request, ["admin", "officer"]);
 * if (!auth.isValid) {
 *     return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
 * }
 * console.log("Authenticated User ID:", auth.user.id);
 */
export async function verifyAuth(request: NextRequest, allowedRoles?: string[]): Promise<AuthResult> {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { isValid: false, errorStatus: 401, errorResponse: "กรุณาแนบโทเคนสำหรับการยืนยันตัวตน (Unauthorized)" };
    }

    const accessToken = authHeader.split(" ")[1];

    try {
        // 1. ส่งโทเคนไปตรวจสอบความถูกต้องกับ LINE API ป้องกันการปลอมแปลง
        const lineVerifyRes = await fetch(`https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`);

        if (!lineVerifyRes.ok) {
            return { isValid: false, errorStatus: 401, errorResponse: "โทเคนใช้งานไม่ได้หรือหมดอายุแล้ว" };
        }

        const lineData = await lineVerifyRes.json();
        // LINE จะคืนค่า client_id และ ID ของเรามา (ถ้าใช้คู่กับ LIFF จะได้ userId/UID ผ่านทาง Profile ยิงสอดคล้องกลับมา)
        // หมายเหตุ: หากต้องการข้อมูลเต็มรูปแบบ สามารถยิงไปที่ https://api.line.me/v2/profile โดยแนบ Bearer Token นี้ได้เช่นกัน

        // เพื่อความชัวร์และเร็ว เราสามารถดึงโปรไฟล์โดยตรงจาก LINE ด้วยแอกเซสโทเคนนี้
        const lineProfileRes = await fetch("https://api.line.me/v2/profile", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!lineProfileRes.ok) {
            return { isValid: false, errorStatus: 401, errorResponse: "ไม่สามารถดึงข้อมูลโปรไฟล์จาก LINE ได้" };
        }

        const profileData = await lineProfileRes.json();
        const lineUid = profileData.userId;

        // 2. ค้นหาผู้ใช้และสิทธิ์ใน Database ของเรา
        const user = await prisma.user.findUnique({
            where: { lineUniqueId: lineUid },
            include: { systemRole: true },
        });

        if (!user) {
            return { isValid: false, errorStatus: 404, errorResponse: "ไม่บัญชีผู้ใช้งานนี้ในระบบกรุณาลงทะเบียนก่อน" };
        }

        // 3. ตรวจสอบ Role (RBAC - Role Based Access Control)
        if (allowedRoles && allowedRoles.length > 0) {
            if (!allowedRoles.includes(user.systemRole.roleName.toLowerCase())) {
                return { isValid: false, errorStatus: 403, errorResponse: "คุณไม่มีสิทธิ์เข้าถึงทำรายการในส่วนนี้ (Forbidden)" };
            }
        }

        return {
            isValid: true,
            user: {
                id: user.id,
                lineUniqueId: user.lineUniqueId,
                roleName: user.systemRole.roleName.toLowerCase(),
            },
        };
    } catch (error) {
        console.error("Auth Verification Error:", error);
        return { isValid: false, errorStatus: 500, errorResponse: "เกิดข้อผิดพลาดในระบบตรวจสอบสิทธิ์หลังบ้าน" };
    }
}
