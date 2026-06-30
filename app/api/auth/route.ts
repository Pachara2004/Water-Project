import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const antiSpam = new Map<string, number>();

export async function POST(request: NextRequest) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    if (antiSpam.has(ip) && Date.now() - antiSpam.get(ip)! < 3000) return NextResponse.json({ error: "อย่ากดซ้ำ" }, { status: 429 });
    antiSpam.set(ip, Date.now());

    try {
        const body = await request.json();
        // เปลี่ยนจากรับ lineUid ตรง ๆ เป็นรับ accessToken ที่ได้จาก liff.getAccessToken()
        const { accessToken, name } = body;

        if (!accessToken || !name) {
            return NextResponse.json({ error: "กรุณาระบุ accessToken และ name ให้ครบถ้วน" }, { status: 400 });
        }

        // ยิงไปเอาโปรไฟล์จริงจาก LINE API โดยใช้ Access Token ที่หน้าบ้านส่งมา
        const lineProfileRes = await fetch("https://api.line.me/v2/profile", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!lineProfileRes.ok) {
            return NextResponse.json({ error: "โทเคน LINE ไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 401 });
        }

        const profileData = await lineProfileRes.json();
        const lineUid = profileData.userId;

        // --- โลจิกจัดการฐานข้อมูลตารางผู้ใช้ของบอสตามเดิม ---
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
