import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import path from "path";
import { promises as fs } from "fs";

export async function GET(request: NextRequest) {
    try {
        // 1. ดึงข้อมูลตัวอย่างน้ำทั้งหมดที่ยังไม่โดน Soft Delete (ไม่ดึงตาราง collector เพื่อประหยัดทรัพยากร)
        const samples = await prisma.waterSample.findMany({
            where: { isDelete: false },
            include: {
                location: true,
            },
            orderBy: { collectionTime: "desc" },
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Water Quality Report");

        // 2. กำหนดโครงสร้างคอลัมน์ที่จำเป็นเท่านั้น (ตัด Metadata และชื่อคนเก็บออก)
        worksheet.columns = [
            { header: "No.", key: "no", width: 8 },
            { header: "Collection Time", key: "cTime", width: 20 },
            { header: "Location Name", key: "locName", width: 25 },
            { header: "Agency", key: "agency", width: 20 },
            { header: "Latitude", key: "lat", width: 12 },
            { header: "Longitude", key: "lon", width: 12 },
            { header: "Ammonia (mg/L)", key: "ammonia", width: 16 },
            { header: "Phosphate (mg/L)", key: "phosphate", width: 16 },
            { header: "Dissolved Oxygen (mL/L)", key: "oxygen", width: 22 },
            { header: "Temperature (°C)", key: "temp", width: 16 },
            { header: "Rain Volume (mm)", key: "rain", width: 16 },
            { header: "Water Status", key: "status", width: 14 },
            { header: "Visual Image", key: "image", width: 22 }, 
            { header: "AI Plot Detection", key: "imagePlot", width: 22 },
        ];

        worksheet.getRow(1).font = { bold: true };

        // 3. วนลูปสร้างแถวข้อมูลหลัก
        let index = 1;
        for (const sample of samples) {
            const row = worksheet.addRow({
                no: index++,
                cTime: sample.collectionTime
                    .toISOString()
                    .replace("T", " ")
                    .substring(0, 16),
                locName: sample.location?.name || "N/A",
                agency: sample.location?.agency || "N/A",
                lat: sample.location?.lat || null,
                lon: sample.location?.lon || null,
                ammonia: sample.ammonia,
                phosphate: sample.phosphate,
                oxygen: sample.oxygen || "N/A",
                temp: sample.temperature || "N/A",
                rain: sample.rainVolume || "N/A",
                status: sample.status,
                image: sample.imageUrl || "N/A",
                imagePlot: sample.imagePlotUrl || "N/A",
            });

            // กำหนดความสูงของแถวให้แสดงผลรูปภาพได้สวยงาม ไม่บดบังตัวอักษร
            row.height = 75;

            // ฟังก์ชันวาดไฟล์ภาพไบนารีฝังลงตารางโดยตรงจาก Local Disk
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

                        // ตรวจสอบชัวร์ๆ ว่ามีไฟล์ภาพอยู่จริงบนเครื่องก่อนอ่านไฟล์
                        await fs.access(fullPath);
                        const imageBuffer = await fs.readFile(fullPath);

                        const imageId = workbook.addImage({
                            buffer: imageBuffer,
                            extension: "jpeg",
                        });

                        // ฝังรูปภาพลงในเซลล์ที่ระบุ
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

            //  ปรับปรุงดัชนีคอลัมน์ (0-indexed) ให้ตรงตามตารางที่ลดความกว้างลงมา
            // คอลัมน์ที่ 12 คือ M (Visual Image), คอลัมน์ที่ 13 คือ N (AI Plot Detection)
            await embedImageToCell(sample.imageUrl, 12);
            await embedImageToCell(sample.imagePlotUrl, 13);
        }

        // 4. ส่งก้อน Buffer กลับออกไปให้หน้าบ้านดาวน์โหลดทันที
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
            { error: "เกิดข้อผิดพลาดในการสร้างไฟล์ Excel" },
            { status: 500 },
        );
    }
}
