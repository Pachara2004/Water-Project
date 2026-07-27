import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import crypto from "crypto";
import { verifyAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma"; // 🔍 ดึง Prisma เข้ามาสแกน Parameter ใน DB

/**
 * 🔒 FILENAME SANITIZER WITH DATE STAMP
 */
function sanitizeAndGenerateFilename(originalName: string, prefix: string = "upload"): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStamp = `${year}${month}${day}`;

    const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
    const cleanExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";

    return `${prefix}-${dateStamp}-${crypto.randomUUID()}.${cleanExt}`;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
