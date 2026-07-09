import { NextRequest, NextResponse } from "next/server"; // 🔄 เพิ่ม NextRequest เข้ามาพ่วงร่วมกับระบบสแกนสิทธิ์
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard"; // 🔥 อิมพอร์ตระบบสแกนสิทธิ์ส่วนกลางมาใช้งานคุมความปลอดภัย

export async function GET(request: NextRequest) {
    // 🔥 SECURITY GUARD: ปิดช่องโหว่การแอบสูบสถิติ ล็อกให้เฉพาะ "officer" และ "admin" ผ่าน Token เท่านั้น
    const auth = await verifyAuth(request, ["officer", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        // ดึงข้อมูลตัวอย่างน้ำเฉพาะรายการที่ยังไม่โดน Soft Delete (isDeleted: false) ตาม Schema ใหม่ของ
        const samples = await prisma.waterSample.findMany({
            where: { isDeleted: false },
            include: { location: true },
            orderBy: { collectionTime: "desc" },
        });

        // กำหนดหัวตาราง CSV (Headers) ปรับหน่วย Dissolved Oxygen ให้ตรงสากล
        const headers = [
            "No.",
            "Collection Time",
            "Location Name",
            "Agency",
            "Latitude",
            "Longitude",
            "Ammonia (mg/L)",
            "Phosphate (mg/L)",
            "Dissolved Oxygen (mg/L)",
            "Temperature (C)",
            "Rain Volume (mm)",
            "Water Status",
        ];

        // ประกอบร่างเนื้อหาข้อความตาราง CSV โดยใส่ BOM (\uFEFF) นำหน้าเพื่อกันภาษาไทยเป็นตัวต่างดาวใน Excel
        let csvContent = "\uFEFF" + headers.join(",") + "\n";

        let index = 1;
        samples.forEach((s) => {
            const row = [
                index++,
                s.collectionTime.toISOString().replace("T", " ").substring(0, 16),
                `"${s.location?.stationName || "N/A"}"`,
                `"${s.location?.governingAgency || "N/A"}"`,
                s.location?.latitude || "",
                s.location?.longitude || "",
                s.ammoniaValue,
                s.phosphateValue,
                s.dissolvedOxygen || "N/A",
                s.airTemperature || "N/A",
                s.rainAccumulation || "N/A",
                s.status,
            ];
            csvContent += row.join(",") + "\n";
        });

        // ส่งข้อมูลออกไปในรูปแบบของ Text / CSV File ครบถ้วนเสถียร
        return new Response(csvContent, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename=Water_Quality_Report_${Date.now()}.csv`,
            },
        });
    } catch (error) {
        console.error("Export CSV API Error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างไฟล์รายงาน CSV" }, { status: 500 });
    }
}
