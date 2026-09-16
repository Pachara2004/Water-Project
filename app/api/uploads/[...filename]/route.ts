/**
 * @fileoverview
 * [TH] Route Handler สำหรับการอัปโหลดไฟล์รูปภาพผลการตรวจวัดสารเคมีและกราฟ (Multipart Form Data)
 * รองรับการอัปโหลดไฟล์แบบกลุ่มตามพารามิเตอร์สารเคมีที่ถูกนิยามในฐานข้อมูล (Dynamic Master Parameters)
 * ทั้งรูปดิบ (raw) และรูปประมวลผล (plot) พร้อมระบบตรวจสอบขนาดไฟล์ (ไม่เกิน 5MB) และชนิดไฟล์ (MIME types)
 * มีฟังก์ชันสร้างชื่อไฟล์ใหม่ที่ปลอดภัย (Sanitize) โดยผนวก วันที่ปัจจุบัน (พ.ศ./ค.ศ. ตาม Thai time) และ UUID
 * เพื่อป้องกันปัญหา Path Traversal และชื่อไฟล์ซ้ำซ้อน
 *
 * [EN] Route Handler for uploading chemical parameter test strip photos and graph plots (Multipart Form Data).
 * Dynamically scans and binds uploads to master chemical parameters defined in the database,
 * supporting both raw strip captures and processed calibration plots. Enforces strict file size
 * limits (max 5MB) and MIME-type white-listing. Sanitizes and renames uploaded files with date stamps
 * and random UUIDs to prevent collisions and Path Traversal vulnerabilities.
 *
 * @module API / Storage & Uploads
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-06-22
 * @modified 2026-09-11
 * @version 2.0.0
 * @license Proprietary
 *
 * @see {@link /lib/thaiTime.ts} ยูทิลิตี้จัดการเวลาและวันที่ตามเขตเวลาประเทศไทย
 * @see {@link /lib/auth-guard.ts} ระบบตรวจสอบสิทธิ์ผู้ใช้งานผ่าน LINE Session
 * @see {@link /lib/prisma.ts} Prisma Client สำหรับดึงรายชื่อพารามิเตอร์ Master Data
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - ผู้พัฒนาระบบอัปโหลดไฟล์รูปภาพเริ่มต้น
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - ปรับปรุงการจัดเก็บแบบ Dynamic Parameter Loop และ Filename Sanitizer
 *
 * @history
 * - 2026-09-11 | Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) | ปรับปรุงระบบตรวจสอบสิทธิ์และรองรับ Dynamic Master Parameters
 * - 2026-06-22 | Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) | พัฒนาระบบอัปโหลดรูปภาพลง public/uploads
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import crypto from "crypto";
import { nowThai, toYmd } from "@/lib/thaiTime";
import { verifyAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma"; // 🔍 ดึง Prisma เข้ามาสแกน Parameter ใน DB

/**
 * [TH] ล้างค่าและสุ่มสร้างชื่อไฟล์ใหม่อย่างปลอดภัย พร้อมระบุวันที่และ UUID (Filename Sanitizer)
 * สกัดนามสกุลไฟล์เดิมและตรวจสอบกับ White-list นามสกุลที่อนุญาต หากไม่อยู่ในรายการจะใช้ .jpg เป็นค่าเริ่มต้น
 * รูปแบบชื่อไฟล์: `{prefix}-{YYYYMMDD}-{UUID}.{ext}`
 *
 * [EN] Sanitizes and generates a collision-resistant, secure file name with date stamp and UUID.
 * Extracts original extension and checks against permitted image extensions, defaulting to `.jpg`.
 * Generated pattern: `{prefix}-{YYYYMMDD}-{UUID}.{ext}`.
 *
 * @function sanitizeAndGenerateFilename
 * @param {string} originalName - ชื่อไฟล์ต้นฉบับที่ส่งมาจากฟอร์ม (เช่น "photo.png")
 * @param {string} [prefix="upload"] - คำนำหน้าชื่อไฟล์เพื่อระบุประเภท (เช่น "raw-phosphate", "plot-ph")
 * @returns {string} ชื่อไฟล์ที่ได้รับการ Sanitize และต่อท้ายด้วย UUID อย่างปลอดภัย
 *
 * @example
 * sanitizeAndGenerateFilename("my_strip.jpg", "raw-nitrate");
 * // Returns: "raw-nitrate-20260916-4f3b2c1a-8899-44aa-bbcc-112233445566.jpg"
 */
function sanitizeAndGenerateFilename(originalName: string, prefix: string = "upload"): string {
    const dateStamp = toYmd(nowThai()).replace(/-/g, "");

    const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
    const cleanExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";

    return `${prefix}-${dateStamp}-${crypto.randomUUID()}.${cleanExt}`;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * [TH] รับและบันทึกไฟล์รูปภาพผลการตรวจวัดคุณภาพน้ำลงเซิร์ฟเวอร์ (Upload Chemical Images)
 * ตรวจสอบสิทธิ์เฉพาะผู้ใช้กลุ่ม collector และ admin ดึงรายการสารเคมีทั้งหมดจากฐานข้อมูล
 * จากนั้นวนลูปตรวจสอบ FormData สำหรับรูปดิบ (`image_raw_{paramId}`) และรูปพล็อต (`image_plot_{paramId}`)
 * บันทึกไฟล์ที่ผ่านการตรวจสอบลงไดเรกทอรี `public/uploads` และส่งคืนแมปข้อมูล URL ของแต่ละรูป
 *
 * [EN] Receives and stores water sample parameter analysis images on the server storage.
 * Enforces role authentication restricted to collectors and admins. Reads all active parameter
 * definitions from the database and iterates through submitted form data matching raw
 * (`image_raw_{paramId}`) and plot (`image_plot_{paramId}`) file fields. Saves validated files
 * into `public/uploads` and returns a structured URL map.
 *
 * @async
 * @function POST
 * @param {NextRequest} request - Next.js Request object ที่บรรจุ Multipart Form Data
 * @returns {Promise<NextResponse<{ success: boolean, message: string, uploadedFiles: Record<string, { filename: string, url: string, size: number }> } | { error: string }>>}
 * JSON Response ยืนยันผลการอัปโหลดและรายการไฟล์ หรือข้อความแจ้งเตือนข้อผิดพลาด
 *
 * @auth collector, admin
 * @database Prisma Client (MySQL) - ดึงรายการพารามิเตอร์ทั้งหมดจากโมเดล `Parameter`
 *
 * @example
 * // Request: POST /api/uploads/parameter-files
 * // FormData:
 * //   image_raw_1: (Binary Image File)
 * //   image_plot_1: (Binary Image File)
 * // Response (201 Created):
 * // {
 * //   "success": true,
 * //   "message": "อัปโหลดไฟล์ระบบ Dynamic สำเร็จ",
 * //   "uploadedFiles": {
 * //     "image_raw_1": { "filename": "raw-phosphate-20260916-uuid.jpg", "url": "/uploads/raw-phosphate-20260916-uuid.jpg", "size": 124500 }
 * //   }
 * // }
 */
export async function POST(request: NextRequest) {
    try {
        // SECURITY STEP 1: ตรวจสิทธิ์ Token LINE
        // officer (ผู้บริหาร) ไม่มีสิทธิ์ — เป็นสิทธิ์อ่านอย่างเดียว ไม่มีขั้นตอนไหนที่ต้องอัปโหลดไฟล์
        const auth = await verifyAuth(request, ["collector", "admin"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        const formData = await request.formData();

        // 🔍 ดึงรายการสารทั้งหมดในระบบ (Master Data) มาจากฐานข้อมูล
        const systemParameters = await prisma.parameter.findMany();

        // เตรียมโฟลเดอร์ปลายทาง (public/uploads)
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        // โครงสร้างสำหรับเก็บข้อมูลผลลัพธ์ไฟล์รูปที่เซฟสำเร็จ
        const uploadedFiles: Record<string, any> = {};

        // ⚡️ DYNAMIC LOOP: วนลูปตรวจเช็กตาม ID สารเคมีที่มีจริงใน Database
        for (const param of systemParameters) {
            // สแกนหาคีย์ทั้งรูปดิบ (raw) และรูปประมวลผล (plot)
            const fileTypes = [
                { key: `image_raw_${param.id}`, prefix: `raw-${param.name.toLowerCase()}` },
                { key: `image_plot_${param.id}`, prefix: `plot-${param.name.toLowerCase()}` },
            ];

            for (const type of fileTypes) {
                const file = formData.get(type.key) as File | null;

                // ถ้ามีไฟล์ส่งมาในคีย์พารามิเตอร์นี้ ให้ทำการ Validation และบันทึก
                if (file && file.size > 0) {
                    // VALIDATION: ขนาดไฟล์
                    if (file.size > MAX_FILE_SIZE) {
                        return NextResponse.json({ error: `ไฟล์ในช่อง ${param.name} ใหญ่เกินกำหนด (ห้ามเกิน 5MB)` }, { status: 400 });
                    }

                    // VALIDATION: ประเภทไฟล์
                    if (!ALLOWED_TYPES.includes(file.type)) {
                        return NextResponse.json({ error: `รูปแบบไฟล์ช่อง ${param.name} ไม่ถูกต้อง อนุญาตเฉพาะ JPG, PNG, WEBP, GIF` }, { status: 400 });
                    }

                    // เจนชื่อไฟล์พ่วงชื่อสารเคมีจาก DB: raw-phosphate-YYYYMMDD-UUID.ext
                    const cleanFilename = sanitizeAndGenerateFilename(file.name, type.prefix);
                    const filepath = path.join(uploadDir, cleanFilename);

                    // บันทึกไฟล์ลงบน Disk
                    const bytes = await file.arrayBuffer();
                    const buffer = Buffer.from(bytes);
                    await writeFile(filepath, buffer);

                    // บันทึก URL ผลลัพธ์ลง Object
                    uploadedFiles[type.key] = {
                        filename: cleanFilename,
                        url: `/uploads/${cleanFilename}`,
                        size: file.size,
                    };

                    console.log(`[Upload Service] Dynamic File saved: ${cleanFilename} for parameter: ${param.name}`);
                }
            }
        }

        // กรณีฉุกเฉิน: เผื่อยังมีระบบเก่าส่งคีย์ชื่อ "file" ตัวเดียวโดดๆ มา ก็ทำ Fallback รองรับไว้ให้ครับ
        const legacyFile = formData.get("file") as File | null;
        if (legacyFile && legacyFile.size > 0) {
            const cleanFilename = sanitizeAndGenerateFilename(legacyFile.name, "upload");
            await writeFile(path.join(uploadDir, cleanFilename), Buffer.from(await legacyFile.arrayBuffer()));
            uploadedFiles["file"] = {
                filename: cleanFilename,
                url: `/uploads/${cleanFilename}`,
                size: legacyFile.size,
            };
        }

        // ถ้าไม่มีไฟล์อะไรผ่านการตรวจสอบเลย
        if (Object.keys(uploadedFiles).length === 0) {
            return NextResponse.json({ error: "ไม่พบไฟล์รูปภาพพารามิเตอร์สารเคมีใดๆ ส่งมาให้อัปโหลด" }, { status: 400 });
        }

        // ส่งข้อมูลแผนผัง URL รูปภาพทั้งหมดคืนกลับไปให้หน้าบ้านนำไปใช้งาน
        return NextResponse.json(
            {
                success: true,
                message: "อัปโหลดไฟล์ระบบ Dynamic สำเร็จ",
                uploadedFiles: uploadedFiles,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("Upload API Error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบจัดเก็บไฟล์แบบกลุ่ม" }, { status: 500 });
    }
}
