import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { lineUid, name } = body;

        if (!lineUid || !name) {
            return NextResponse.json({ error: "กรุณาระบุ lineUid และ name ให้ครบถ้วน" }, { status: 400 });
        }

        let user = await prisma.user.findUnique({
            where: { lineUniqueId: lineUid },
            include: { systemRole: true },
        });

        if (!user) {
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
