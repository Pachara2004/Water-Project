import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

// ==========================================
// GET /api/manage/pending-count — จำนวนคำร้องค้างทั้งหมดที่ admin ต้องตัดสิน
// รวม 2 คิว: คำร้องตรวจสอบ confidence ต่ำ (ReviewRequest) + คำร้องขอสิทธิ์ผู้ใช้ (RoleRequest)
// ใช้ป้อนจุดแดงบน Navbar เมนู "จัดการข้อมูล" — admin เท่านั้น
// ==========================================
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const [reviewPendingCount, rolePendingCount] = await Promise.all([
            prisma.reviewRequest.count({ where: { statusRequest: "pending" } }),
            prisma.roleRequest.count({ where: { status: "pending" } }),
        ]);

        // แยกให้แต่ละเมนูในหน้า /manage รู้จำนวนคิวของตัวเอง + รวมไว้ให้ Navbar ใช้ตัดสินใจแสดงจุดเดียว
        return NextResponse.json({
            reviewPendingCount,
            rolePendingCount,
            pendingCount: reviewPendingCount + rolePendingCount,
        });
    } catch (error) {
        console.error("GET /api/manage/pending-count error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงจำนวนคำร้องค้าง" }, { status: 500 });
    }
}
