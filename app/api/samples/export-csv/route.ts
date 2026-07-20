import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
    // 🔒 SECURITY GUARD: อนุญาตเฉพาะสิทธิ์ "officer" และ "admin" เท่านั้น
    const auth = await verifyAuth(request, ["officer", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        // 1. ดึง Master Parameters ทั้งหมดในระบบเรียงตาม id
        const activeParameters = await prisma.parameter.findMany({
            orderBy: { id: "asc" },
        });

        // 2. ดึงข้อมูลตัวอย่างน้ำที่ยังไม่โดนลบ
        const samples = await prisma.waterSample.findMany({
            where: { isDeleted: false },
            include: {
                location: true,
                measurements: { include: { parameter: true } },
            },
            orderBy: { collectionTime: "desc" },
        });

        // 3. กำหนดหัวตาราง CSV (Headers)
        const baseHeaders = [
            "No.",
            "Sample Code", // 🌟 เพิ่มคอลัมน์ Sample Code (SP260720...)
            "Session Group", // 🌟 เพิ่มคอลัมน์ Session Group (SES260720...)
            "Collection Time",
            "Location Name",
            "Agency",
            "Latitude",
            "Longitude",
        ];

        // สร้าง Header สารเคมีแบบ Dynamic ตาม Parameter ในระบบ
        const paramHeaders = activeParameters.map((p) => `"${p.name}${p.unit ? ` (${p.unit})` : ""}"`);

        const tailHeaders = ["Dissolved Oxygen (mg/L)", "Temperature (C)", "Rain Volume (mm)", "Water Status"];

        const allHeaders = [...baseHeaders, ...paramHeaders, ...tailHeaders];

        // ประกอบร่างเนื้อหาข้อความตาราง CSV (ใส่ BOM \uFEFF ป้องกันภาษาไทยเป็นต่างดาวใน Excel)
        let csvContent = "\uFEFF" + allHeaders.join(",") + "\n";

        let index = 1;
        samples.forEach((s) => {
            // ดึงค่าสารเคมีแต่ละตัวตาม param.id แบบ Dynamic
            const paramValues = activeParameters.map((param) => {
                const match = s.measurements.find((m) => m.parameterId === param.id);
                return match !== undefined ? match.value : "N/A";
            });

            const row = [
                index++,
                `"${s.code || "N/A"}"`, // 🌟 แปะค่า code
                `"${s.sessionGroup || "N/A"}"`, // 🌟 แปะค่า sessionGroup
                s.collectionTime.toISOString().replace("T", " ").substring(0, 16),
                `"${s.location?.stationName || "N/A"}"`,
                `"${s.location?.governingAgency || "N/A"}"`,
                s.location?.latitude || "",
                s.location?.longitude || "",
                ...paramValues, // 🌟 พ่นค่าสารเคมีแบบ Dynamic
                s.dissolvedOxygen !== null && s.dissolvedOxygen !== undefined ? s.dissolvedOxygen : "N/A",
                s.airTemperature !== null && s.airTemperature !== undefined ? s.airTemperature : "N/A",
                s.rainAccumulation !== null && s.rainAccumulation !== undefined ? s.rainAccumulation : "N/A",
                s.status,
            ];

            csvContent += row.join(",") + "\n";
        });

        // ส่งข้อมูลออกไปในรูปแบบ CSV File
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
