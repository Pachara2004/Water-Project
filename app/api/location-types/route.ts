import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ==========================================
// GET /api/location-types — รายการประเภทการใช้ประโยชน์ของแหล่งน้ำทั้งหมด
// อ่านอย่างเดียวและเป็นข้อมูลสาธารณะ (ป้ายโซนแสดงบนหน้าแผนที่ให้ทุกคนเห็น) จึงไม่ต้อง verifyAuth
// การเพิ่ม/แก้โซนทำที่ DB โดยตรง แล้วรัน npm run gen:location-types — ยังไม่เปิดผ่าน API
// ==========================================
export async function GET() {
    try {
        // แนบเกณฑ์ของแต่ละประเภทมาด้วย — หน้าบ้านต้องใช้ทำตารางเปรียบเทียบ
        // และเป็นทางเดียวที่ client component จะได้เกณฑ์ เพราะ query DB เองไม่ได้
        const types = await prisma.locationType.findMany({
            select: {
                id: true,
                code: true,
                labelTh: true,
                standards: {
                    select: { parameterId: true, maxValue: true },
                },
            },
            orderBy: { id: "asc" },
        });

        return NextResponse.json(types);
    } catch (error) {
        console.error("GET /api/location-types error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลประเภทการใช้ประโยชน์" }, { status: 500 });
    }
}
