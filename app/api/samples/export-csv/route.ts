import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        // ดึงข้อมูลตัวอย่างน้ำเฉพาะรายการที่ยังไม่โดน Soft Delete
        const samples = await prisma.waterSample.findMany({
            where: { isDelete: false },
            include: { location: true },
            orderBy: { collectionTime: "desc" },
        });

        // 1. กำหนดหัวตาราง CSV (Headers)
        const headers = [
            "No.",
            "Collection Time",
            "Location Name",
            "Agency",
            "Latitude",
            "Longitude",
            "Ammonia (mg/L)",
            "Phosphate (mg/L)",
            "Dissolved Oxygen (mL/L)",
            "Temperature (C)",
            "Rain Volume (mm)",
            "Water Status",
        ];

        // 2. ประกอบร่างเนื้อหาข้อความตาราง CSV โดยใส่ BOM (\uFEFF) นำหน้าเพื่อกันภาษาไทยเป็นตัวต่างดาว
        let csvContent = "\uFEFF" + headers.join(",") + "\n";

        let index = 1;
        samples.forEach((s) => {
            const row = [
                index++,
                s.collectionTime
                    .toISOString()
                    .replace("T", " ")
                    .substring(0, 16),
                `"${s.location?.name || "N/A"}"`,
                `"${s.location?.agency || "N/A"}"`,
                s.location?.lat || "",
                s.location?.lon || "",
                s.ammonia,
                s.phosphate,
                s.oxygen || "N/A",
                s.temperature || "N/A",
                s.rainVolume || "N/A",
                s.status,
            ];
            csvContent += row.join(",") + "\n";
        });

        // 3. ส่งข้อมูลออกไปในรูปแบบของ Text / CSV File
        return new Response(csvContent, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename=Water_Quality_Report_${Date.now()}.csv`,
            },
        });
    } catch (error) {
        console.error("Export CSV API Error:", error);
    }
}
