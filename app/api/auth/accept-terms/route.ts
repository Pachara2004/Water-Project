import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { TERMS_VERSION } from "@/lib/termsVersion";
import { nowThai } from "@/lib/thaiTime";

// บันทึกการยอมรับข้อตกลงฉบับปัจจุบันของผู้ใช้ที่มีบัญชีอยู่แล้ว
// (บัญชีก่อนมีระบบข้อตกลง หรือข้อตกลงเปลี่ยนฉบับ) — ผู้ใช้ใหม่บันทึกตอนสร้างใน POST /api/auth แทน
export async function POST(request: NextRequest) {
    const auth = await verifyAuth(request);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        await prisma.user.update({
            where: { id: auth.user!.id },
            data: { termsAcceptedAt: nowThai(), termsVersion: TERMS_VERSION },
        });
        return NextResponse.json({ success: true, termsVersion: TERMS_VERSION });
    } catch (error) {
        console.error("POST /api/auth/accept-terms error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
