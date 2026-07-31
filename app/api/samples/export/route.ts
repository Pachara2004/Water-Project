import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import path from "path";
import { promises as fs } from "fs";
import { verifyAuth } from "@/lib/auth-guard";
import { buildContentDisposition, buildExportMetadata, formatThaiDateTime, resolveExportContext } from "@/lib/sampleFilters";

export const dynamic = "force-dynamic";

// เพดานถาวรของ XLSX — ต่างจาก CSV ที่ stream ได้ไม่จำกัด
// ExcelJS ต้องประกอบทั้ง workbook (รวมรูปภาพฝังทุกแถว) ในหน่วยความจำก่อนส่ง จึงสเกลตามข้อมูลไม่ได้โดยธรรมชาติ
// ไฟล์นี้คือ "รายงานของข้อมูลชุดเล็ก" ถ้าต้องการข้อมูลทั้งก้อนให้ใช้ CSV
const MAX_XLSX_ROWS = 2000;

export async function GET(request: NextRequest) {
    // 🔒 SECURITY GUARD: ล็อกกลอนขั้นสูง อนุญาตเฉพาะสิทธิ์ "officer" และ "admin" เท่านั้นที่ส่งออกรายงานได้
    const auth = await verifyAuth(request, ["officer", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { scope, filters, where, stationName, exporterName } = await resolveExportContext(request, auth.user!);

        const totalRows = await prisma.waterSample.count({ where });
        if (totalRows > MAX_XLSX_ROWS) {
            return NextResponse.json(
                {
                    error: `ข้อมูลที่เลือกมี ${totalRows.toLocaleString("th-TH")} แถว เกินเพดาน ${MAX_XLSX_ROWS.toLocaleString("th-TH")} แถวของไฟล์ Excel — กรุณาแคบช่วงวันที่หรือเลือกสถานีให้แคบลง หรือใช้การส่งออกแบบ CSV ที่ไม่จำกัดจำนวนแถว`,
                    totalRows,
                    limit: MAX_XLSX_ROWS,
                },
                { status: 413 }
            );
        }

        // 1. ดึงมาสเตอร์สารเคมีทั้งหมดที่มีอยู่ในระบบตอนนี้จาก Database (ไม่ฟิกซ์ชื่อแล้ว)
        const activeParameters = await prisma.parameter.findMany({ orderBy: { id: "asc" } });

        // 2. ดึงข้อมูลตัวอย่างน้ำตามขอบเขตที่ผู้ใช้เลือก (where เดียวกับที่แดชบอร์ดใช้คำนวณสถิติ)
        const samples = await prisma.waterSample.findMany({
            where,
            include: {
                location: true,
                measurements: true, // ดึงค่าวัดทั้งหมดออกมา
                collector: { select: { firstName: true, lastName: true, lineProfileName: true } },
            },
            orderBy: [{ collectionTime: "desc" }, { id: "desc" }],
        });

        const workbook = new ExcelJS.Workbook();

        // Sheet แรก = เมทาดาทาบอกที่มาของไฟล์ แยกออกจากตารางข้อมูลเพื่อไม่ให้พิกัดแถวของรูปภาพเลื่อน
        const infoSheet = workbook.addWorksheet("ข้อมูลการส่งออก");
        infoSheet.columns = [
            { header: "รายการ", key: "label", width: 28 },
            { header: "รายละเอียด", key: "value", width: 70 },
        ];
        infoSheet.getRow(1).font = { bold: true };
        for (const [label, value] of buildExportMetadata(filters, scope, stationName, exporterName, totalRows)) {
            infoSheet.addRow({ label, value });
        }

        const worksheet = workbook.addWorksheet("Water Quality Report");

        // 3. ประกอบโครงสร้างคอลัมน์รายงาน (Columns) แบบ Dynamic
        // คอลัมน์พื้นฐานส่วนต้น
        const baseColumns = [
            { header: "No.", key: "no", width: 8 },
            { header: "Sample Code", key: "code", width: 20 },
            { header: "Session Group", key: "sessionGroup", width: 20 },
            { header: "Collection Time (GMT+7)", key: "cTime", width: 22 },
            { header: "Location Name", key: "locName", width: 25 },
            { header: "Agency", key: "agency", width: 20 },
            { header: "Latitude", key: "lat", width: 12 },
            { header: "Longitude", key: "lon", width: 12 },
        ];

        // คอลัมน์สารเคมีที่งอกจาก DB อัตโนมัติ
        const parameterColumns = activeParameters.map((param) => ({
            header: `${param.name}${param.unit ? ` (${param.unit})` : ""}`,
            key: `param_${param.id}`,
            width: 16,
        }));

        // คอลัมน์พื้นฐานส่วนท้ายรวมถึงรูปภาพ
        const tailColumns = [
            { header: "Dissolved Oxygen (mg/L)", key: "oxygen", width: 24 },
            { header: "Temperature (°C)", key: "temp", width: 16 },
            { header: "Rain Volume (mm)", key: "rain", width: 16 },
            { header: "Water Status", key: "status", width: 14 },
            { header: "Collector", key: "collector", width: 22 },
            { header: "Visual Image", key: "image", width: 22 },
            { header: "AI Plot Detection", key: "imagePlot", width: 22 },
        ];

        // รวมโครงสร้างคอลัมน์ทั้งหมดเข้าด้วยกัน
        worksheet.columns = [...baseColumns, ...parameterColumns, ...tailColumns];
        worksheet.getRow(1).font = { bold: true };

        // คำนวณหาตำแหน่งคอลัมน์รูปภาพแบบ Dynamic (ExcelJS นับเริ่มที่ 0)
        // = จำนวนคอลัมน์ทั้งหมดก่อนถึงคอลัมน์รูป (oxygen, temp, rain, status, collector = 5 ช่อง)
        const imageColIndex = baseColumns.length + parameterColumns.length + 5;
        const imagePlotColIndex = imageColIndex + 1;

        // 4. วนลูปสร้างแถวข้อมูลและฝังไฟล์ภาพลงตาราง Excel
        let index = 1;
        for (const sample of samples) {
            // สร้างก้อน Object ข้อมูลพื้นฐานส่วนต้น
            const rowData: Record<string, any> = {
                no: index++,
                code: sample.code || "N/A",
                sessionGroup: sample.sessionGroup || "N/A",
                cTime: formatThaiDateTime(sample.collectionTime),
                locName: sample.location?.stationName || "N/A",
                agency: sample.location?.governingAgency || "N/A",
                lat: sample.location?.latitude || null,
                lon: sample.location?.longitude || null,
                oxygen: sample.dissolvedOxygen ?? "N/A",
                temp: sample.airTemperature ?? "N/A",
                rain: sample.rainAccumulation ?? "N/A",
                status: sample.status,
                collector: [sample.collector?.firstName, sample.collector?.lastName].filter(Boolean).join(" ") || sample.collector?.lineProfileName || "N/A",
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

                        await fs.access(fullPath);
                        const imageBuffer = await fs.readFile(fullPath);

                        const imageId = workbook.addImage({
                            buffer: imageBuffer as any,
                            extension: "jpeg",
                        });

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

        // 5. คอมไพล์ก้อน Buffer และตอบกลับให้บราวเซอร์หน้าบ้านกดโหลดทันที
        const buffer = await workbook.xlsx.writeBuffer();

        return new Response(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": buildContentDisposition(filters, scope, stationName, "xlsx"),
                "X-Total-Rows": String(totalRows),
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("Export API Error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างไฟล์ Excel รายงานผลน้ำแบบไดนามิก" }, { status: 500 });
    }
}
