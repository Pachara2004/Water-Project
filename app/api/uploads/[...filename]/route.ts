import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import crypto from "crypto"; // 🛡️ เรียกใช้งาน crypto สำหรับเจน UUID สากล
import { verifyAuth } from "@/lib/auth-guard";

/**
 * 🔒 FILENAME SANITIZER WITH DATE STAMP
 * หน้าที่: สกัดวันที่ปัจจุบัน (YYYYMMDD) + คลีนชื่อไฟล์ขยะแตกตัวเป็น UUID ตัวเล็ก ปลอดภัยบน Linux 100%
 */
function sanitizeAndGenerateFilename(originalName: string, prefix: string = "upload"): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const dateStamp = `${year}${month}${day}`; // ผลลัพธ์ช่วงนี้: "20260630"

    const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
    const cleanExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg"; // คุมนามสกุลตัวพิมพ์เล็ก

    return `${prefix}-${dateStamp}-${crypto.randomUUID()}.${cleanExt}`; // จัดฟอร์แมตสวยงาม
}

// จำกัดประเภทไฟล์รูปภาพที่อนุญาต (Whitelist approach)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
// จำกัดขนาดไฟล์สูงสุด (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
    try {
        // SECURITY STEP 1: ตรวจสิทธิ์ Token LINE (อนุญาตเฉพาะเจ้าหน้าที่ในระบบเท่านั้น)
        const auth = await verifyAuth(request, ["collector", "officer", "admin"]);
        if (!auth.isValid) {
            return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File | null;

        // VALIDATION STEP 1: ตรวจสอบว่าส่งไฟล์มาจริงไหม
        if (!file || file.size === 0) {
            return NextResponse.json({ error: "ไม่พบไฟล์ที่ต้องการอัปโหลด" }, { status: 400 });
        }

        // VALIDATION STEP 2: จำกัดขนาดไฟล์ (Size Limitation)
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "ขนาดไฟล์ใหญ่เกินกำหนด (ห้ามเกิน 5MB)" }, { status: 400 });
        }

        // VALIDATION STEP 3: ตรวจสอบประเภทไฟล์ (Type Mime Validation)
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "รูปแบบไฟล์ไม่ถูกต้อง อนุญาตเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, GIF) เท่านั้น" }, { status: 400 });
        }

        // เตรียมโฟลเดอร์ปลายทาง (public/uploads)
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        // ✨ CLEAN FILENAME STEP: เรียกฟังก์ชันจัดระเบียบชื่อไฟล์พ่วงวันที่: upload-YYYYMMDD-UUID.ext
        const cleanFilename = sanitizeAndGenerateFilename(file.name, "upload");
        const filepath = path.join(uploadDir, cleanFilename);

        // บันทึกไฟล์ลงบน Disk เซิร์ฟเวอร์
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filepath, buffer);

        console.log(`[Upload Service] File successfully saved: ${cleanFilename} by User ID: ${auth.user?.id}`);

        // ตอบกลับพิกัด URL คลีนๆ ให้ฝั่งหน้าบ้านเอาไปประยุกต์ใช้งานต่อได้ทันที
        return NextResponse.json(
            {
                success: true,
                message: "อัปโหลดไฟล์สำเร็จ",
                filename: cleanFilename,
                url: `/uploads/${cleanFilename}`,
                size: file.size,
                mimeType: file.type,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error("Upload API Error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบจัดเก็บไฟล์" }, { status: 500 });
    }
}
