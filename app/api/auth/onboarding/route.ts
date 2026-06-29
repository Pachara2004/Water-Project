import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, firstName, lastName, phoneNumber, requestedRoleName } = body;

        if (!userId || !firstName || !lastName || !phoneNumber || !requestedRoleName) {
            return NextResponse.json({ error: "กรุณากรอกข้อมูลส่วนตัวและเลือกสิทธิ์ให้ครบถ้วน" }, { status: 400 });
        }

        const existingUser = await prisma.user.findUnique({
            where: { id: Number(userId) },
        });

        if (!existingUser) {
            return NextResponse.json({ error: "ไม่พบข้อมูลบัญชีผู้ใช้งานนี้ในระบบ" }, { status: 404 });
        }

        // 1. อัปเดตข้อมูลส่วนตัว (สิทธิ์ในตาราง user ยังเป็น guest ตามเดิม)
        const updatedUser = await prisma.user.update({
            where: { id: Number(userId) },
            data: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phoneNumber: phoneNumber.trim(),
            },
            include: { systemRole: true },
        });

        // 2. ค้นหา Role ปลายทางที่ต้องการร้องขอ
        const targetRole = await prisma.role.findUnique({
            where: { roleName: requestedRoleName },
        });

        if (!targetRole) {
            return NextResponse.json({ error: "ไม่พบสิทธิ์ที่ต้องการร้องขอในระบบ" }, { status: 400 });
        }

        // 3. สร้างรายการคำร้องขอเปลี่ยนสิทธิ์ (Role Request)
        await prisma.roleRequest.create({
            data: {
                userId: updatedUser.id,
                requestedRoleId: targetRole.id,
                status: "pending",
            },
        });

        return NextResponse.json({
            success: true,
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
