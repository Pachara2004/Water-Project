import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        // ดึงข้อมูล Parameter ทั้งหมดจาก Database
        // select ชัดเจน ไม่เอา createdAt/updatedAt — หน้าบ้านไม่ได้ใช้ และ Date ดิบจะออกไปพร้อม Z ผิดกติกาเวลาของระบบ
        const parameters = await prisma.parameter.findMany({
            select: { id: true, name: true, unit: true, description: true, formula: true },
            orderBy: {
                id: "asc", // เรียงตามลำดับการสร้าง
            },
        });

        return NextResponse.json(parameters, { status: 200 });
    } catch (error) {
        console.error("Error fetching parameters:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
