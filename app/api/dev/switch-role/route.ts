import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
