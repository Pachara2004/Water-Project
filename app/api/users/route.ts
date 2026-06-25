import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search")?.trim() ?? "";
        const role = searchParams.get("role")?.trim() ?? "";

        // สร้างเงื่อนไขตัวกรองแบบไดนามิกให้ตรงตาม Schema ใหม่
        const where: any = {};

        // ค้นหาแบบกวาดครอบคลุมทั้ง ชื่อจริง, นามสกุลจริง หรือชื่อไลน์โปรไฟล์
        if (search) {
            where.OR = [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { lineProfileName: { contains: search } },
            ];
        }

        // กรองผ่านความสัมพันธ์ตารางสิทธิ์ระบบ
        if (role && role !== "ALL") {
            where.systemRole = {
                roleName: role.toLowerCase(),
            };
        }

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                lineUniqueId: true,
                lineProfileName: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
                registeredAt: true, 
                lastActiveAt: true, 
                systemRole: {
                    select: {
                        roleName: true,
                    },
                },
                _count: { select: { samples: true } },
            },
            orderBy: { registeredAt: "desc" },
        });

        // ปรับโครงสร้างเพื่อส่งก้อน Payload คืนกลับไปให้ตารางหน้าบ้านเข้าใจได้ง่าย
        const formattedUsers = users.map((u) => ({
            id: u.id,
            lineProfileName: u.lineProfileName,
            fullName:
                `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
                "ยังไม่ลงทะเบียนข้อมูล",
            phoneNumber: u.phoneNumber || "N/A",
            role: u.systemRole.roleName, // ดึงชื่อสิทธิ์ข้อความออกมาตรง ๆ เช่น "guest", "collector"
            registeredAt: u.registeredAt,
            lastActiveAt: u.lastActiveAt,
            samplesCount: u._count.samples,
        }));

        return NextResponse.json(formattedUsers);
    } catch (error) {
        console.error("GET /api/users error:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการดึงข้อมูลบัญชีผู้ใช้งาน" },
            { status: 500 },
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { userId, role } = await request.json();

        if (!userId || !role) {
            return NextResponse.json(
                { error: "กรุณาระบุ userId และบทบาทสิทธิ์ที่ต้องการแต่งตั้ง" },
                { status: 400 },
            );
        }

        // ชุดบทบาทความปลอดภัยพิมพ์เล็กตามระบบใหม่เอี่ยมของบอส
        const validRoles = ["admin", "officer", "collector", "guest"];
        const targetRole = role.toLowerCase();

        if (!validRoles.includes(targetRole)) {
            return NextResponse.json(
                {
                    error: "บทบาทสิทธิ์ที่ระบุไม่ถูกต้องตามโครงสร้างระบบรักษาความปลอดภัย",
                },
                { status: 400 },
            );
        }

        // ค้นหาไอดีสิทธิ์จากตาราง Role
        const targetRoleRecord = await prisma.role.findUnique({
            where: { roleName: targetRole },
        });

        if (!targetRoleRecord) {
            return NextResponse.json(
                { error: "ไม่พบกลุ่มบทบาทสิทธิ์นี้ในฐานข้อมูลระบบ" },
                { status: 404 },
            );
        }

        // ทำการโยกย้ายผูกไอดีสิทธิ์ชุดใหม่เข้าหาตัวผู้ใช้งาน (แปลง ID เป็น Number)
        const updatedUser = await prisma.user.update({
            where: { id: Number(userId) },
            data: { roleId: targetRoleRecord.id },
            select: {
                id: true,
                lineProfileName: true,
                firstName: true,
                lastName: true,
                systemRole: {
                    select: {
                        roleName: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            message: `แต่งตั้งสิทธิ์ให้คุณ ${updatedUser.firstName || updatedUser.lineProfileName} เป็น ${updatedUser.systemRole.roleName} สำเร็จ`,
            user: {
                id: updatedUser.id,
                role: updatedUser.systemRole.roleName,
            },
        });
    } catch (error) {
        console.error("PATCH /api/users error:", error);
        return NextResponse.json(
            {
                error: "เกิดข้อผิดพลาดในการบันทึกเปลี่ยนสิทธิ์สมาชิกลงฐานข้อมูล",
            },
            { status: 500 },
        );
    }
}
