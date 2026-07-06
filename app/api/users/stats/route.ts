import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

// สรุปยอดผู้ใช้ทั้งหมด/เจ้าหน้าที่/รออนุมัติ ด้วย COUNT ล้วนๆ แยกจาก GET /api/users
// เพื่อให้ตัวเลขสรุปไม่ผูกกับผลลัพธ์ที่ถูกกรองด้วยคำค้นหา และยัง scale ได้แม้ผู้ใช้เยอะขึ้น
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const [total, staff, pending] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { systemRole: { roleName: { not: "guest" } } } }),
            prisma.user.count({ where: { roleRequests: { some: { status: "pending" } } } }),
        ]);

        return NextResponse.json({ total, staff, pending });
    } catch (error) {
        console.error("GET /api/users/stats error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลสรุปยอดผู้ใช้งาน" }, { status: 500 });
    }
}
