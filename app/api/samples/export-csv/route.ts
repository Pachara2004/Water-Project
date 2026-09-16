/**
 * @fileoverview
 * [TH] Route Handler สำหรับส่งออกข้อมูลตัวอย่างคุณภาพน้ำในรูปแบบไฟล์ CSV ผ่าน ReadableStream
 * รองรับการใส่ UTF-8 BOM เพื่อให้อ่านภาษาไทยบน Microsoft Excel ได้อย่างถูกต้องสมบูรณ์
 * ใช้เทคนิคการแบ่งหน้าด้วย Cursor-based pagination (เรียงตาม collectionTime และ id) ทีละหน้า
 * ป้องกันปัญหาหน่วยความจำเซิร์ฟเวอร์ล้น (OOM) แม้ส่งออกข้อมูลนับหมื่นหรือแสนแถว
 * คอลัมน์พารามิเตอร์สารเคมีถูกดึงจากตาราง Master Parameter แบบไดนามิกตามข้อมูลที่มีในระบบ
 *
 * [EN] Route Handler for exporting water quality sample records in CSV format via ReadableStream.
 * Prepends UTF-8 BOM to ensure flawless Thai character rendering in Microsoft Excel.
 * Employs cursor-based pagination (ordered by collectionTime and id) in chunked batches
 * to eliminate Out-Of-Memory (OOM) risks regardless of export dataset size.
 * Dynamic chemical parameter columns are generated directly from master parameter definitions.
 *
 * @module API / Reports & Exports
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-06-22
 * @modified 2026-09-02
 * @version 2.0.0
 * @license Proprietary
 *
 * @see {@link /lib/csv.ts} ยูทิลิตี้สำหรับจัดรูปแบบ CSV Row และ UTF-8 BOM
 * @see {@link /lib/sampleFilters.ts} ตัวจัดการ Context, Header Content-Disposition และการแปลงเวลาไทย
 * @see {@link /lib/auth-guard.ts} ระบบตรวจสอบสิทธิ์ผู้ใช้งานผ่าน LINE Session
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - ผู้พัฒนาเริ่มต้นระบบส่งออกข้อมูล CSV
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - ปรับปรุงเป็น ReadableStream, Cursor-based pagination และ Dynamic parameter columns
 *
 * @history
 * - 2026-09-02 | Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) | ปรับปรุงระบบสตรีมมิ่ง CSV และคอลัมน์ไดนามิก
 * - 2026-06-22 | Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) | พัฒนาระบบส่งออกไฟล์ CSV เบื้องต้น
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { buildContentDisposition, formatThaiDateTime, resolveExportContext } from "@/lib/sampleFilters";
import { CSV_BOM, csvRow } from "@/lib/csv";

// ต้องประเมินทุก request (ผลลัพธ์ขึ้นกับ token + filter) ห้ามให้ Next แคชคำตอบ
export const dynamic = "force-dynamic";

// จำนวนแถวที่ดึงต่อรอบ — ค่าคงที่นี้คือสิ่งที่ทำให้หน่วยความจำไม่โตตามขนาดข้อมูล
// ไม่ว่าจะส่งออกหมื่นแถวหรือล้านแถว server ก็ถือข้อมูลไว้แค่ครั้งละ PAGE_SIZE แถว
const PAGE_SIZE = 1000;

/**
 * [TH] ส่งออกข้อมูลตัวอย่างคุณภาพน้ำเป็นไฟล์ CSV สตรีมมิ่ง (Streaming CSV Export)
 * ตรวจสอบสิทธิ์เฉพาะผู้ใช้กลุ่ม officer และ admin จากนั้นดึง Master Parameters สำหรับสร้างหัวตาราง
 * และสตรีมชุดข้อมูลตัวอย่างคุณภาพน้ำทีละหน้า (Batch ขนาด 1,000 แถว) ผ่าน `ReadableStream`
 * โดยตั้งค่า HTTP Header ปิด buffering เพื่อให้เบราว์เซอร์เริ่มดาวน์โหลดได้ทันที
 *
 * [EN] Streams water quality sample dataset as a downloadable CSV file.
 * Authenticates officer and admin credentials, reads active master parameters to dynamically build
 * CSV column headers, and streams sample rows page-by-page (batch size: 1,000) using `ReadableStream`.
 * Employs non-buffering response headers for immediate client download commencement.
 *
 * @async
 * @function GET
 * @param {NextRequest} request - Next.js Request object ประกอบด้วย Query Parameters สำหรับการกรอง
 * @returns {Promise<Response | NextResponse<{ error: string }>>}
 * สตรีมไฟล์ CSV binary พร้อม Header `Content-Type: text/csv` และ `Content-Disposition` หรือ JSON ข้อผิดพลาด
 *
 * @auth officer, admin
 * @database Prisma Client (MySQL) - อ่าน `Parameter`, นับจำนวนแถว และดึง `WaterSample` เชื่อมโยง `Location`, `Collector`, `Measurements`
 *
 * @example
 * // Request: GET /api/samples/export-csv?scope=filtered&startDate=2026-01-01&endDate=2026-06-30
 * // Response: 200 OK (Streamed binary CSV file with UTF-8 BOM)
 */
export async function GET(request: NextRequest) {
    // 🔒 SECURITY GUARD: อนุญาตเฉพาะสิทธิ์ "officer" และ "admin" เท่านั้น
    const auth = await verifyAuth(request, ["officer", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { scope, filters, where, stationName } = await resolveExportContext(request, auth.user!);

        // Master Parameters ทั้งหมดในระบบ — คอลัมน์สารเคมีงอกตามตารางนี้ ไม่ฟิกซ์ชื่อ
        const activeParameters = await prisma.parameter.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true, unit: true } });

        const totalRows = await prisma.waterSample.count({ where });

        // --- ส่วนหัวไฟล์: BOM + หัวคอลัมน์ ---
        let preamble = CSV_BOM;
        preamble += csvRow([
            "No.",
            "Sample Code",
            "Session Group",
            "Collection Time (GMT+7)",
            "Location Name",
            "Agency",
            "Latitude",
            "Longitude",
            ...activeParameters.map((p) => `${p.name}${p.unit ? ` (${p.unit})` : ""}`),
            "Dissolved Oxygen (mg/L)",
            "Temperature (C)",
            "Rain Volume (mm)",
            "Water Status",
            "Collector",
        ]);

        const encoder = new TextEncoder();
        // เรียงใหม่สุดขึ้นก่อนเหมือนเดิม แต่เดินข้อมูลด้วย cursor (collectionTime, id) แทน OFFSET
        // เพราะ OFFSET ต้องนับข้ามแถวก่อนหน้าทั้งหมดทุกหน้า ยิ่งลึกยิ่งช้าแบบทวีคูณ
        let cursor: { time: Date; id: number } | null = null;
        let index = 1;
        let preambleSent = false;

        const stream = new ReadableStream<Uint8Array>({
            async pull(controller) {
                if (!preambleSent) {
                    controller.enqueue(encoder.encode(preamble));
                    preambleSent = true;
                    return;
                }

                // ครอบ where เดิมไว้ใน AND เสมอ — where อาจมี OR ของ session ที่รออนุมัติอยู่แล้ว การเขียนทับจะทำให้เงื่อนไขนั้นหาย
                const pageWhere = cursor
                    ? { AND: [where, { OR: [{ collectionTime: { lt: cursor.time } }, { collectionTime: cursor.time, id: { lt: cursor.id } }] }] }
                    : where;

                const rows = await prisma.waterSample.findMany({
                    where: pageWhere,
                    orderBy: [{ collectionTime: "desc" }, { id: "desc" }],
                    take: PAGE_SIZE,
                    select: {
                        id: true,
                        code: true,
                        sessionGroup: true,
                        collectionTime: true,
                        dissolvedOxygen: true,
                        airTemperature: true,
                        rainAccumulation: true,
                        status: true,
                        location: { select: { stationName: true, governingAgency: true, latitude: true, longitude: true } },
                        collector: { select: { firstName: true, lastName: true, lineProfileName: true } },
                        measurements: { select: { parameterId: true, value: true } },
                    },
                });

                if (rows.length === 0) {
                    controller.close();
                    return;
                }

                const last = rows[rows.length - 1];
                cursor = { time: last.collectionTime, id: last.id };

                let chunk = "";
                for (const s of rows) {
                    const valueByParamId = new Map(s.measurements.map((m) => [m.parameterId, m.value]));
                    chunk += csvRow([
                        index++,
                        s.code ?? "N/A",
                        s.sessionGroup ?? "N/A",
                        formatThaiDateTime(s.collectionTime),
                        s.location?.stationName ?? "N/A",
                        s.location?.governingAgency ?? "N/A",
                        s.location?.latitude ?? "",
                        s.location?.longitude ?? "",
                        ...activeParameters.map((p) => valueByParamId.get(p.id) ?? "N/A"),
                        s.dissolvedOxygen ?? "N/A",
                        s.airTemperature ?? "N/A",
                        s.rainAccumulation ?? "N/A",
                        s.status ?? "N/A",
                        [s.collector?.firstName, s.collector?.lastName].filter(Boolean).join(" ") || s.collector?.lineProfileName || "N/A",
                    ]);
                }
                controller.enqueue(encoder.encode(chunk));

                // หน้าสุดท้าย (ได้ไม่ครบ PAGE_SIZE) ปิด stream ทันที ไม่ต้องเสีย query อีกรอบเพื่อยืนยันว่าหมดแล้ว
                if (rows.length < PAGE_SIZE) controller.close();
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": buildContentDisposition(filters, scope, stationName, "csv"),
                "X-Total-Rows": String(totalRows),
                // ปิด buffering ของ proxy ที่คั่นกลาง ไม่งั้นไฟล์จะไปกองรอจนครบแล้วค่อยส่ง = เสียประโยชน์ของ streaming
                "Cache-Control": "no-store",
                "X-Accel-Buffering": "no",
            },
        });
    } catch (error) {
        console.error("Export CSV API Error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการสร้างไฟล์รายงาน CSV" }, { status: 500 });
    }
}
