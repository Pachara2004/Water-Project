/**
 * @file app/api/dev/switch-role/route.ts
 * @project Water Monitoring Project
 * @module API / Development Tools
 * @description
 * [TH] Route Handler สำหรับการสลับสิทธิ์ผู้ใช้จำลองในระหว่างการทดสอบและพัฒนา (POST)
 * อำนวยความสะดวกให้นักพัฒนาสามารถเปลี่ยนสิทธิ์ของบัญชีผู้ใช้ในระบบได้ทันทีโดยไม่ต้องเข้าแก้ในฐานข้อมูลโดยตรง
 * [EN] Development Route Handler for instantly switching user system roles during local testing and debugging (POST).
 * Allows developers to elevate or alter user roles without manually editing database tables.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-20
 * @version 1.0.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-07-20)
 *
 * @lastModified 2026-07-20
 * @lastModifiedBy Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 *
 * @changelog
 * - 2026-07-20 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Initial development role switcher
 *
 * @database Prisma Client (MySQL)
 * @auth Development utility (Non-production testing)
 * @warning ควรจำกัดหรือปิดใช้งานในสภาพแวดล้อม Production เพื่อความปลอดภัย
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * สลับบทบาทสิทธิ์ (Role) ของผู้ใช้ในฐานข้อมูลตามที่ระบุ
 * Updates the target user's roleId in the database for testing and verification.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม JSON payload { userId, roleName }
 * @returns {Promise<NextResponse>} ผลการสลับสิทธิ์ { success, userId, role }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, roleName } = body;

        if (!userId || !roleName) {
            return NextResponse.json({ error: "Missing userId or roleName" }, { status: 400 });
        }

        // หา Role ID จากชื่อ roleName (เช่น "admin", "officer", "collector", "guest")
        const role = await prisma.role.findUnique({
            where: { roleName },
        });

        if (!role) {
            return NextResponse.json({ error: `Role '${roleName}' not found` }, { status: 404 });
        }

        // อัปเดต roleId ของ User ใน Database จริง
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { roleId: role.id },
            include: { systemRole: true },
        });

        return NextResponse.json({
            success: true,
            userId: updatedUser.id,
            role: updatedUser.systemRole.roleName,
        });
    } catch (error) {
        console.error("POST /api/dev/switch-role error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
