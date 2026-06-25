import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, firstName, lastName, phoneNumber } = body;

        // 🛡️ Validation ตรวจสอบข้อมูลให้รัดกุมก่อนบันทึก
        if (!userId || !firstName || !lastName || !phoneNumber) {
            return NextResponse.json(
                {
                    error: "กรุณากรอกข้อมูล ชื่อ-นามสกุล และเบอร์โทรศัพท์ให้ครบถ้วน",
                },
                { status: 400 },
            );
        }

        // 🔍 1. ค้นหาผู้ใช้งานในระบบ (แปลง ID เป็น Number เผื่อหน้าบ้านส่งมาเป็นสตริง)
        const existingUser = await prisma.user.findUnique({
            where: { id: Number(userId) },
            include: { systemRole: true },
        });

        if (!existingUser) {
            return NextResponse.json(
                { error: "ไม่พบข้อมูลบัญชีผู้ใช้งานนี้ในระบบ" },
                { status: 404 },
            );
        }

        // 📝 2. อัปเดตข้อมูลส่วนตัวจริงลงฟิลด์ Expressive Snake Case ล่าสุด
        const updatedUser = await prisma.user.update({
            where: { id: Number(userId) },
            data: {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phoneNumber: phoneNumber.trim(),
            },
            include: {
                systemRole: true,
            },
        });

        // 🚀 3. ส่งข้อมูล payload ชุดที่ถูกต้องกลับไปเคลียร์หน้ากาก Onboarding Guard
        return NextResponse.json({
            success: true,
            user: {
                id: updatedUser.id,
                lineUniqueId: updatedUser.lineUniqueId,
                lineProfileName: updatedUser.lineProfileName,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                phoneNumber: updatedUser.phoneNumber,
                role: updatedUser.systemRole.roleName, // ยังคงเป็น "guest" เพื่อรอแอดมินอนุมัติสิทธิ์ส่งผลน้ำ
            },
        });
    } catch (error: any) {
        console.error("❌ PUT /api/auth/onboarding error:", error);
        return NextResponse.json(
            {
                error: "เกิดข้อผิดพลาดในการบันทึกข้อมูลส่วนตัวลงฐานข้อมูล",
                details: error?.message,
            },
            { status: 500 },
        );
    }
}
