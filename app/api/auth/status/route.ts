import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { TERMS_VERSION } from "@/lib/termsVersion";

// ถามว่า LINE uid ของ token นี้มีบัญชีในระบบแล้วหรือยัง และยอมรับข้อตกลงฉบับปัจจุบันหรือยัง — อ่านอย่างเดียว ไม่สร้างผู้ใช้
// หน้าบ้านใช้ตัดสินว่าต้องแสดง TermsGate ก่อน POST /api/auth (จุดที่ uid ถูกเก็บ) หรือไม่
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request);

    if (auth.isValid) {
        const user = await prisma.user.findUnique({
            where: { id: auth.user!.id },
            select: { termsVersion: true },
        });
        return NextResponse.json({ registered: true, termsAccepted: user?.termsVersion === TERMS_VERSION });
    }

    // verifyAuth คืน 404 เฉพาะกรณี token ถูกต้องแต่ยังไม่มีผู้ใช้ใน DB
    if (auth.errorStatus === 404) {
        return NextResponse.json({ registered: false, termsAccepted: false });
    }

    return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
}
