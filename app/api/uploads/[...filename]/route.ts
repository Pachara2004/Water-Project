import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string[] }> },
) {
    try {
        const { filename } = await params;
        const fileRoute = filename.join("/");
        const baseUploadDir = path.join(process.cwd(), "public", "uploads");
        const filepath = path.resolve(baseUploadDir, fileRoute);

        // SECURITY GUARD: ดักจับและป้องกันช่องโหว่ Path Traversal
        // ถ้าพาธที่คำนวณได้ไม่ได้เริ่มต้นด้วยโฟลเดอร์ baseUploadDir แปลว่ามีคนพยายามพิมพ์ย้อนโฟลเดอร์ แครชทิ้งทันที!
        if (!filepath.startsWith(baseUploadDir)) {
            return NextResponse.json(
                { error: "Access Denied: สิทธิ์การเข้าถึงไฟล์ไม่ถูกต้อง" },
                { status: 403 },
            );
        }

        // ตรวจสอบว่าไฟล์รูปภาพนั้นมีอยู่จริงบน Disk ไหมก่อนสั่งอ่านไฟล์
        await fs.access(filepath);
        const fileBuffer = await fs.readFile(filepath);

        // ค้นหา Content-Type ให้สอดคล้องกับนามสกุลไฟล์รองรับ WEBP เพิ่มเติม
        const ext = path.extname(filepath).toLowerCase();
        let contentType = "image/jpeg";
        if (ext === ".png") contentType = "image/png";
        if (ext === ".gif") contentType = "image/gif";
        if (ext === ".webp") contentType = "image/webp";

        return new Response(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable", // แคชรูปไว้ในบราวเซอร์ยาวๆ เพื่อประสิทธิภาพสูงสุด
            },
        });
    } catch (error) {
        console.error("Serve Image Error:", error);
        return NextResponse.json(
            { error: "ไม่พบไฟล์รูปภาพที่ระบุในเซิร์ฟเวอร์" },
            { status: 404 },
        );
    }
}
