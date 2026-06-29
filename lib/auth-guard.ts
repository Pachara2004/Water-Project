import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

interface AuthResult {
    isValid: boolean;
    errorStatus?: number;
    errorResponse?: string;
    user?: {
        id: number;
        lineUniqueId: string;
        roleName: string;
    };
}

/**
 * ฟังก์ชันสำหรับตรวจสอบ LINE Access Token จาก Header และค้นหาสิทธิ์ในระบบ
 * @param request NextRequest
 * @param allowedRoles อาร์เรย์ของสิทธิ์ที่อนุญาตให้เข้าถึง (ถ้าไม่ใส่ แปลว่าทุก Role ที่ล็อกอินแล้วเข้าได้หมด)
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
