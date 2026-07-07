import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

// Thai mobile: 06x, 08x, 09x (10 digits)
// Thai landline: 02x–05x (9–10 digits)
// International: +66XXXXXXXXX
const PHONE_REGEX = /^(\+66[0-9]{8,9}|0[2-9][0-9]{7,8})$/;

// Allow Thai, Latin, spaces, hyphens — block HTML/script injection
const NAME_REGEX = /^[ก-๙a-zA-Z0-9\s\-'.]+$/;

function sanitize(str: string) {
    return str.trim().replace(/\s+/g, " ");
}

// PATCH /api/profile — แก้ไขชื่อ+เบอร์ของ "ตัวเอง"
// ดึง userId จาก LINE token (verifyAuth) ไม่รับจาก body เพื่อกัน IDOR
export async function PATCH(request: NextRequest) {
    const auth = await verifyAuth(request);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const body = await request.json();
        const { firstName, lastName, phoneNumber } = body;

        // ── Validate name (รวมชื่อ-สกุลเป็นก้อนเดียวให้ตรงกับช่องกรอกเดียวในหน้าจอ) ──
        const cleanFirst = sanitize(String(firstName ?? ""));
        const cleanLast = sanitize(String(lastName ?? ""));
        const fullName = `${cleanFirst} ${cleanLast}`.trim();

        if (!fullName) {
            return NextResponse.json({ field: "name", error: "กรุณากรอกชื่อ-นามสกุลจริง" }, { status: 422 });
        }
        if (fullName.length < 2) {
            return NextResponse.json({ field: "name", error: "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร" }, { status: 422 });
        }
        if (fullName.length > 100) {
            return NextResponse.json({ field: "name", error: "ชื่อต้องไม่เกิน 100 ตัวอักษร" }, { status: 422 });
        }
        if (!NAME_REGEX.test(fullName)) {
            return NextResponse.json({ field: "name", error: "ชื่อมีอักขระที่ไม่อนุญาต" }, { status: 422 });
        }

        // ── Validate phone (จำเป็น ให้ตรงกับ * ในหน้าจอและฝั่ง onboarding เดิม) ──
        const cleanPhone = phoneNumber ? String(phoneNumber).trim().replace(/[-\s]/g, "") : "";
        if (!cleanPhone) {
            return NextResponse.json({ field: "phone", error: "กรุณากรอกเบอร์โทรศัพท์" }, { status: 422 });
        }
        if (!PHONE_REGEX.test(cleanPhone)) {
            return NextResponse.json({ field: "phone", error: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (เช่น 0812345678)" }, { status: 422 });
        }

        // ── Update (ไม่แตะ role — แก้เฉพาะข้อมูลส่วนตัว) ──
        const updated = await prisma.user.update({
            where: { id: auth.user!.id },
            data: {
                firstName: cleanFirst,
                lastName: cleanLast,
                phoneNumber: cleanPhone,
            },
            include: { systemRole: true },
        });

        return NextResponse.json({
            success: true,
            user: {
                id: updated.id,
                lineUniqueId: updated.lineUniqueId,
                lineProfileName: updated.lineProfileName,
                firstName: updated.firstName,
                lastName: updated.lastName,
                phoneNumber: updated.phoneNumber,
                role: updated.systemRole.roleName,
            },
        });
    } catch (error) {
        console.error("PATCH /api/profile error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
    }
}
