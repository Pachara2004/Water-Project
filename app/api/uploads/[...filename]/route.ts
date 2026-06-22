import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
    request: NextRequest,
    { params }: { params: { filename: string[] } },
) {
    try {
        const fileRoute = params.filename.join("/");
        // อ้างอิงพาธโฟลเดอร์ที่เก็บรูปจริง
        const filepath = path.join(
            process.cwd(),
            "public",
            "uploads",
            fileRoute,
        );

        const fileBuffer = await fs.readFile(filepath);

        // ค้นหา Content-Type ให้สอดคล้องกับนามสกุลไฟล์
        const ext = path.extname(filepath).toLowerCase();
        let contentType = "image/jpeg";
        if (ext === ".png") contentType = "image/png";
        if (ext === ".gif") contentType = "image/gif";

        return new Response(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
}
