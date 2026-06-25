import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { lineUid, name } = body; // หน้าบ้านส่ง lineUid และ name มาจาก LINE LIFF

        if (!lineUid || !name) {
            return NextResponse.json(
                { error: "กรุณาระบุ lineUid และ name ของโปรไฟล์ให้ครบถ้วน" },
                { status: 400 },
            );
        }

        // ค้นหาผู้ใช้งานในฐานข้อมูลโดยแมปเข้าฟิลด์ lineUniqueId และดึง relation 'systemRole'
        let user = await prisma.user.findUnique({
            where: { lineUniqueId: lineUid },
            include: { systemRole: true }, 
        });

        if (!user) {
            const guestRole = await prisma.role.findUnique({
                where: { roleName: "guest" },
            });

            if (!guestRole) {
                return NextResponse.json(
                    {
                        error: "ระบบไม่พบกลุ่มสิทธิ์ 'guest' กรุณารัน Seed ฐานข้อมูลก่อนทำรายการ",
                    },
                    { status: 500 },
                );
            }

            user = await prisma.user.create({
                data: {
                    lineUniqueId: lineUid,
                    lineProfileName: name, 
                    roleId: guestRole.id, 
                },
                include: { systemRole: true }, 
            });
        } else {
            
            user = await prisma.user.update({
                where: { lineUniqueId: lineUid },
                data: {
                    lineProfileName: name,
                },
                include: { systemRole: true }, 
            });
        }

        // ส่งก้อน payload สรุปผลกลับไปให้หน้าบ้านจัดเซฟลง Zustand Store
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
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดภายในระบบเซิร์ฟเวอร์หลังบ้าน" },
            { status: 500 },
        );
    }
}
