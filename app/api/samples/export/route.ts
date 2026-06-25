import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import path from "path";
import { promises as fs } from "fs";

export async function GET(request: NextRequest) {
    try {
        // ดึงข้อมูลตัวอย่างน้ำทั้งหมดที่ยังไม่โดนลบ (isDeleted: false) ตามผังระบบใหม่ของบอส
        const samples = await prisma.waterSample.findMany({
            where: { isDeleted: false }, 
            include: {
                location: true,
            },
            orderBy: { collectionTime: "desc" },
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Water Quality Report");

        // กำหนดโครงสร้างคอลัมน์รายงานสากล
        worksheet.columns = [
            { header: "No.", key: "no", width: 8 },
            { header: "Collection Time", key: "cTime", width: 20 },
            { header: "Location Name", key: "locName", width: 25 },
            { header: "Agency", key: "agency", width: 20 },
            { header: "Latitude", key: "lat", width: 12 },
            { header: "Longitude", key: "lon", width: 12 },
            { header: "Ammonia (mg/L)", key: "ammonia", width: 16 },
            { header: "Phosphate (mg/L)", key: "phosphate", width: 16 },
            { header: "Dissolved Oxygen (mg/L)", key: "oxygen", width: 24 },
            { header: "Temperature (°C)", key: "temp", width: 16 },
            { header: "Rain Volume (mm)", key: "rain", width: 16 },
            { header: "Water Status", key: "status", width: 14 },
            { header: "Visual Image", key: "image", width: 22 },
            { header: "AI Plot Detection", key: "imagePlot", width: 22 },
        ];

        worksheet.getRow(1).font = { bold: true };

        // 3. วนลูปสร้างแถวข้อมูลและฝังไฟล์ภาพไบนารีลงตาราง Excel
        let index = 1;
        for (const sample of samples) {
            const row = worksheet.addRow({
                no: index++,
                cTime: sample.collectionTime
                    .toISOString()
                    .replace("T", " ")
                    .substring(0, 16),
                locName: sample.location?.stationName || "N/A",
                agency: sample.location?.governingAgency || "N/A",
                lat: sample.location?.latitude || null, 
                lon: sample.location?.longitude || null, 
                ammonia: sample.ammoniaValue, 
                phosphate: sample.phosphateValue,
                oxygen: sample.dissolvedOxygen || "N/A", 
                temp: sample.airTemperature || "N/A",
                rain: sample.rainAccumulation || "N/A",
                status: sample.status,
                image: sample.rawImageUrl ? "" : "N/A", 
                imagePlot: sample.analyzedPlotUrl ? "" : "N/A", 
            });

            row.height = 75; // ตั้งความสูงแถวให้สอดรับความสูงภาพ

            // ฟังก์ชันวาดไฟล์ภาพฝังลงในช่องเซลล์ของตัว Excel
            const embedImageToCell = async (
                imagePath: string | null,
                colIndex: number,
            ) => {
                if (!imagePath || imagePath === "N/A") return;

                try {
                    if (imagePath.startsWith("/uploads/")) {
                        const cleanPath = imagePath.replace("/uploads/", "");
                        const fullPath = path.join(
                            process.cwd(),
                            "public",
                            "uploads",
                            cleanPath,
                        );

                        // ตรวจสอบเช็กไฟล์ภาพบนตัวเครื่องเซิร์ฟเวอร์ก่อนหยิบมาอ่าน
                        await fs.access(fullPath);
                        const imageBuffer = await fs.readFile(fullPath);

                        const imageId = workbook.addImage({
                            buffer: imageBuffer,
                            extension: "jpeg",
                        });

                        // ฝังรูปภาพลงตามดัชนีพิกัดคอลัมน์ (0-indexed)
                        worksheet.addImage(imageId, {
                            tl: { col: colIndex, row: row.number - 1 },
                            ext: { width: 150, height: 95 },
                            editAs: "oneCell",
                        });
                    }
                } catch (err) {
                    console.warn(`Cannot embed image ${imagePath}:`, err);
                }
            };

            // คอลัมน์ที่ 12 คือ M (Visual Image), คอลัมน์ที่ 13 คือ N (AI Plot Detection)
            await embedImageToCell(sample.rawImageUrl, 12); // ปรับเป็นชื่อฟิลด์ใหม่ตัวแปรแรก
            await embedImageToCell(sample.analyzedPlotUrl, 13); // ปรับเป็นชื่อฟิลด์ใหม่ตัวแปรพล็อตวิเคราะห์ค่าสี
        }

        // 4. คอมไพล์ก้อน Buffer และตอบกลับให้บราว์เซอร์หน้าบ้านกดโหลดทันที
        const buffer = await workbook.xlsx.writeBuffer();

        return new Response(buffer, {
            headers: {
                "Content-Type":
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename=Water_Quality_Report_${Date.now()}.xlsx`,
            },
        });
    } catch (error) {
        console.error("Export API Error:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการสร้างไฟล์ Excel รายงานผลน้ำ" },
            { status: 500 },
        );
    }
}
