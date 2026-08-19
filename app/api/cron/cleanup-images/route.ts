import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

// GET /api/cron/cleanup-images
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const now = new Date();

        // 1. ค้นหาผ่าน prisma.waterSample และใช้ rawImageUrl ตาม Schema
        const expiredSamples = await prisma.waterSample.findMany({
            where: {
                rawImageUrl: { not: null },
                imageExpiresAt: { lte: now },
            },
            select: {
                id: true,
                rawImageUrl: true,
            },
        });

        if (expiredSamples.length === 0) {
            return NextResponse.json({ message: "No expired images found", count: 0 });
        }

        const publicDir = path.join(process.cwd(), "public");
        const validSamples = expiredSamples.filter((sample) => sample.rawImageUrl);

        // 2. ลบไฟล์พร้อมกันแบบ Parallel (Non-blocking I/O)
        const deleteResults = await Promise.allSettled(
            validSamples.map(async (sample) => {
                const filePath = path.join(publicDir, sample.rawImageUrl!);
                try {
                    await fs.unlink(filePath);
                    return true;
                } catch (err) {
                    console.warn(`Failed to delete file: ${filePath}`, err);
                    return false;
                }
            }),
        );

        const deletedCount = deleteResults.filter((res) => res.status === "fulfilled" && res.value === true).length;

        // 3. Batch Update ผ่าน prisma.waterSample ใน 1 Query
        const targetIds = validSamples.map((sample) => sample.id);
        if (targetIds.length > 0) {
            await prisma.waterSample.updateMany({
                where: {
                    id: { in: targetIds },
                },
                data: {
                    rawImageUrl: null,
                },
            });
        }

        return NextResponse.json({
            message: "Cleanup successful",
            processed: expiredSamples.length,
            deletedFiles: deletedCount,
        });
    } catch (error) {
        console.error("Cron cleanup error:", error);
        return NextResponse.json({ error: "Internal server error during cleanup" }, { status: 500 });
    }
}
