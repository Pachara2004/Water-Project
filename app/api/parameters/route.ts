import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
    try {
        // ดึงข้อมูล Parameter ทั้งหมดจาก Database
        const parameters = await prisma.parameter.findMany({
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
