import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search")?.trim() ?? "";
        const role = searchParams.get("role")?.trim() ?? "";

        const where: any = {};

        if (search) {
            where.OR = [{ firstName: { contains: search } }, { lastName: { contains: search } }, { lineProfileName: { contains: search } }];
        }

        if (role && role !== "ALL") {
            where.systemRole = { roleName: role.toLowerCase() };
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
                systemRole: { select: { roleName: true } },
                _count: { select: { samples: true } },
                roleRequests: {
                    where: { status: "pending" },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                        id: true,
                        requestedRole: { select: { roleName: true } },
                    },
                },
            },
            orderBy: { registeredAt: "desc" },
        });

        const formattedUsers = users.map((u) => {
            const pendingRequest = u.roleRequests[0];
            return {
                id: u.id,
                lineProfileName: u.lineProfileName,
                fullName: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "ยังไม่ลงทะเบียนข้อมูล",
                phoneNumber: u.phoneNumber || null, // ปรับให้สอดคล้องกับ Interface หน้าบ้าน
                role: u.systemRole.roleName,
                registeredAt: u.registeredAt.toISOString(),
                lastActiveAt: u.lastActiveAt.toISOString(),
                samplesCount: u._count.samples,
                pendingRequestId: pendingRequest ? pendingRequest.id : null,
                requestedRole: pendingRequest ? pendingRequest.requestedRole.roleName : null,
            };
        });

        return NextResponse.json(formattedUsers);
    } catch (error) {
        console.error("GET /api/users error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลบัญชีผู้ใช้งาน" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { userId, role, action, requestId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: "กรุณาระบุ userId" }, { status: 400 });
        }

        // กรณีแอดมินกดปุ่ม "ปฏิเสธ" (Reject) คำร้องขอ
        if (action === "reject" && requestId) {
            await prisma.roleRequest.update({
                where: { id: Number(requestId) },
                data: { status: "rejected" },
            });
            return NextResponse.json({ success: true, message: "ปฏิเสธคำร้องขอสิทธิ์เรียบร้อยแล้ว" });
        }

        // --- กรณีอนุมัติหรือเปลี่ยนสิทธิ์ปกติ ---
        if (!role) return NextResponse.json({ error: "กรุณาระบุบทบาทสิทธิ์ที่ต้องการแต่งตั้ง" }, { status: 400 });
        const targetRole = role.toLowerCase();

        const targetRoleRecord = await prisma.role.findUnique({
            where: { roleName: targetRole },
        });

        if (!targetRoleRecord) {
            return NextResponse.json({ error: "ไม่พบกลุ่มบทบาทสิทธิ์นี้ในระบบ" }, { status: 404 });
        }

        // ใช้ Transaction ควบคุม: อัปเดตสิทธิ์ User + ปิดตั๋วคำร้องขอ (ถ้ามี)
        const updatedUser = await prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id: Number(userId) },
                data: { roleId: targetRoleRecord.id },
                select: {
                    id: true,
                    lineProfileName: true,
                    firstName: true,
                    systemRole: { select: { roleName: true } },
                },
            });

            // ถ้าเป็นการอนุมัติจากตั๋วคำร้อง ให้เปลี่ยนสถานะเป็น approved
            if (requestId) {
                await tx.roleRequest.update({
                    where: { id: Number(requestId) },
                    data: { status: "approved" },
                });
            } else {
                // ถ้าแอดมินเปลี่ยนสิทธิ์จาก Dropdown ตรงๆ ให้ปิดตั๋ว pending เก่าของคนนี้ทั้งหมดไปด้วย
                await tx.roleRequest.updateMany({
                    where: { userId: Number(userId), status: "pending" },
                    data: { status: "approved" },
                });
            }

            return user;
        });

        return NextResponse.json({
            success: true,
            message: `แต่งตั้งสิทธิ์เรียบร้อยแล้ว`,
            user: { id: updatedUser.id, role: updatedUser.systemRole.roleName },
        });
    } catch (error) {
        console.error("PATCH /api/users error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกเปลี่ยนสิทธิ์สมาชิก" }, { status: 500 });
    }
}
