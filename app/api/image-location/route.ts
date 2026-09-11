import { NextRequest, NextResponse } from "next/server";
import exifr from "exifr";
import { verifyAuth } from "@/lib/auth-guard";

export const runtime = "nodejs";

function isCoordinatePair(latitude: unknown, longitude: unknown): latitude is number {
    return (
        typeof latitude === "number" &&
        Number.isFinite(latitude) &&
        typeof longitude === "number" &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180 &&
        (latitude !== 0 || longitude !== 0)
    );
}

/**
 * อ่านตำแหน่ง EXIF บนเซิร์ฟเวอร์เป็น fallback สำหรับ Android Chrome/LINE WebView
 * ที่บางรุ่นอ่าน metadata ของ File จาก browser ไม่ครบ แม้ไฟล์ต้นฉบับมี GPS อยู่จริง
 */
export async function POST(request: NextRequest) {
    const auth = await verifyAuth(request, ["collector", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const formData = await request.formData();
        const image = formData.get("image");

        if (!(image instanceof File)) {
            return NextResponse.json({ error: "ไม่พบไฟล์รูปภาพ" }, { status: 400 });
        }
        if (image.size === 0 || image.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: "ขนาดไฟล์รูปภาพไม่ถูกต้อง" }, { status: 400 });
        }

        const buffer = Buffer.from(await image.arrayBuffer());
        const gps = await exifr.gps(buffer);

        if (!gps || !isCoordinatePair(gps.latitude, gps.longitude)) {
            return NextResponse.json({ found: false, reason: "NO_GPS_METADATA" });
        }

        return NextResponse.json({
            found: true,
            latitude: gps.latitude,
            longitude: gps.longitude,
        });
    } catch (error) {
        console.error("Unable to extract image GPS metadata:", error);
        return NextResponse.json({ error: "ไม่สามารถอ่านข้อมูลตำแหน่งจากรูปภาพได้" }, { status: 500 });
    }
}
