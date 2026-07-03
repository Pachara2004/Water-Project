import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import path from "path";
import { promises as fs } from "fs";
import { verifyAuth } from "@/lib/auth-guard"; // 🔥 อิมพอร์ต Guard กลางมาควบคุมสิทธิ์

export async function GET(request: NextRequest) {
    // 🔥 SECURITY GUARD: ล็อกกลอนขั้นสูง อนุญาตเฉพาะสิทธิ์ "officer" และ "admin" เท่านั้นที่ส่งออกรายงานได้
    const auth = await verifyAuth(request, ["officer", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        // 1. ดึงมาสเตอร์สารเคมีทั้งหมดที่มีอยู่ในระบบตอนนี้จาก Database (ไม่ฟิกซ์ชื่อแล้ว)
        const activeParameters = await prisma.parameter.findMany({
            orderBy: { id: "asc" },
        });

        // 2. ดึงข้อมูลตัวอย่างน้ำทั้งหมดที่ยังไม่โดนลบ (isDeleted: false)
        const samples = await prisma.waterSample.findMany({
            where: { isDeleted: false },
            include: {
                location: true,
                measurements: true, // ดึงค่าวัดทั้งหมดออกมา
            },
            orderBy: { collectionTime: "desc" },
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Water Quality Report");

        // 3. ประกอบโครงสร้างคอลัมน์รายงาน (Columns) แบบ Dynamic
        // คอลัมน์พื้นฐานส่วนต้น
        const baseColumns = [
            { header: "No.", key: "no", width: 8 },
            { header: "Collection Time", key: "cTime", width: 20 },
            { header: "Location Name", key: "locName", width: 25 },
            { header: "Agency", key: "agency", width: 20 },
            { header: "Latitude", key: "lat", width: 12 },
            { header: "Longitude", key: "lon", width: 12 },
        ];

        // คอลัมน์สารเคมีที่งอกจาก DB อัตโนมัติ (ใช้ชื่อสารเป็นคีย์สำหรับผูกข้อมูลแถว)
        const parameterColumns = activeParameters.map((param) => ({
            header: `${param.name}${param.unit ? ` (${param.unit})` : ""}`,
            key: `param_${param.id}`, // ใช้ ID กันเหนลียวเรื่องชื่อซ้ำหรืออักขระพิเศษ
            width: 16,
        }));

        // คอลัมน์พื้นฐานส่วนท้ายรวมถึงรูปภาพ
        const tailColumns = [
            { header: "Dissolved Oxygen (mg/L)", key: "oxygen", width: 24 },
            { header: "Temperature (°C)", key: "temp", width: 16 },
            { header: "Rain Volume (mm)", key: "rain", width: 16 },
            { header: "Water Status", key: "status", width: 14 },
            { header: "Visual Image", key: "image", width: 22 },
            { header: "AI Plot Detection", key: "imagePlot", width: 22 },
        ];

        // รวมโครงสร้างคอลัมน์ทั้งหมดเข้าด้วยกัน
        worksheet.columns = [...baseColumns, ...parameterColumns, ...tailColumns];
        worksheet.getRow(1).font = { bold: true };

        // คำนวณหาตำแหน่งคอลัมน์รูปภาพแบบ Dynamic (ExcelJS นับเริ่มที่ 0)
        // ตำแหน่งจะเลื่อนไปเรื่อยๆ ตามจำนวนสารเคมีที่ดึงมาได้
        const imageColIndex = baseColumns.length + parameterColumns.length + 4; // ถัดจาก status
        const imagePlotColIndex = imageColIndex + 1;

        // 4. วนลูปสร้างแถวข้อมูลและฝังไฟล์ภาพลงตาราง Excel
        let index = 1;
        for (const sample of samples) {
            // สร้างก้อน Object ข้อมูลพื้นฐานส่วนต้น
            const rowData: Record<string, any> = {
                no: index++,
                cTime: sample.collectionTime.toISOString().replace("T", " ").substring(0, 16),
                locName: sample.location?.stationName || "N/A",
                agency: sample.location?.governingAgency || "N/A",
                lat: sample.location?.latitude || null,
                lon: sample.location?.longitude || null,
                oxygen: sample.dissolvedOxygen || "N/A",
                temp: sample.airTemperature || "N/A",
                rain: sample.rainAccumulation || "N/A",
                status: sample.status,
                image: sample.rawImageUrl ? "" : "N/A",
                imagePlot: sample.analyzedPlotUrl ? "" : "N/A",
            };

            // ดึงค่าวัดสารเคมีมาผูกเข้าตามคีย์ของพารามิเตอร์แต่ละตัวแบบ Dynamic
            activeParameters.forEach((param) => {
                const match = sample.measurements.find((m) => m.parameterId === param.id);
                rowData[`param_${param.id}`] = match !== undefined ? match.value : "N/A";
            });

            const row = worksheet.addRow(rowData);
            row.height = 75; // ตั้งความสูงแถวให้สอดรับความสูงภาพ

            // ฟังก์ชันวาดไฟล์ภาพฝังลงในช่องเซลล์ของตัว Excel แบบสเกลตำแหน่งตามดัชนีที่คำนวณไว้
            const embedImageToCell = async (imagePath: string | null, colIndex: number) => {
                if (!imagePath || imagePath === "N/A") return;

                try {
                    if (imagePath.startsWith("/uploads/")) {
                        const cleanPath = imagePath.replace("/uploads/", "");
                        const fullPath = path.join(process.cwd(), "public", "uploads", cleanPath);

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

            // เรียกฟังก์ชันฝังรูปภาพโดยใช้พิกัดคอลัมน์แบบคำนวณ Dynamic
            await embedImageToCell(sample.rawImageUrl, imageColIndex);
            await embedImageToCell(sample.analyzedPlotUrl, imagePlotColIndex);
        }

        // 5. คอมไพล์ก้อน Buffer และตอบกลับให้บราว์เซอร์หน้าบ้านกดโหลดทันที
        const buffer = await workbook.xlsx.writeBuffer();

        return new Response(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename=Dynamic_Water_Report_${Date.now()}.xlsx`,
            },
        });
    } catch (error) {
        console.error("Export API Error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างไฟล์ Excel รายงานผลน้ำแบบไดนามิก" }, { status: 500 });
    }
}
