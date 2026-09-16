/**
 * @file app/api/cron/cleanup-images/route.ts
 * @project Water Monitoring Project
 * @module API / Background Jobs & Maintenance
 * @description
 * [TH] Cron Route Handler สำหรับทำความสะอาดและลบไฟล์รูปภาพดิบที่หมดอายุการจัดเก็บบนดิสก์ (GET)
 * ตรวจสอบความปลอดภัยด้วย Bearer Token เทียบกับ `CRON_SECRET` (Fail-Closed)
 * ค้นหารายการ `waterSample` ที่ `imageExpiresAt` ถึงกำหนด แล้วทำการลบไฟล์ใน `public/uploads` แบบ Non-blocking Parallel
 * พร้อม Batch Update เซ็ต `rawImageUrl = null` ในฐานข้อมูล
 * [EN] Cron Route Handler for cleaning up expired raw sample images from disk storage (GET).
 * Enforces fail-closed security via Bearer `CRON_SECRET` authorization.
 * Queries `waterSample` records where `imageExpiresAt <= nowThai()`, unlinks physical files
 * in parallel, and batch-updates `rawImageUrl = null` in Prisma.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.1.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-06-09)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-11)
 *
 * @lastModified 2026-09-11
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-06-09 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Initial cleanup route implementation
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Fail-closed CRON_SECRET guard & Thai time timezone alignment
 *
 * @database Prisma Client (MySQL)
 * @auth Bearer CRON_SECRET header
 * @security Fail-closed when CRON_SECRET is undefined, preventing unauthorized deletion
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";
import { nowThai } from "@/lib/thaiTime";

/**
 * ดำเนินการลบรูปภาพตัวอย่างน้ำที่หมดอายุการจัดเก็บออกจากระบบไฟล์และอัปเดตฐานข้อมูล
 * Executes cleanup of expired sample images from the local filesystem and clears references in the database.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม Authorization Header (`Bearer ${CRON_SECRET}`)
 * @returns {Promise<NextResponse>} สรุปผลการลบ { processed, deletedFiles, message }
 */
export async function GET(request: NextRequest) {
    try {
        // endpoint นี้ลบไฟล์บนดิสก์จริง จึงต้องปิดตายเมื่อไม่มีความลับตั้งไว้ (fail-closed)
        // เดิมข้าม header ทั้งก้อนถ้า CRON_SECRET ว่าง ทำให้การลืมตั้ง env กลายเป็นการเปิด endpoint ให้ทุกคนเรียก
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            console.error("CRON_SECRET is not set — refusing to run image cleanup");
            return NextResponse.json({ error: "Cleanup ถูกปิดใช้งานเพราะยังไม่ได้ตั้งค่า CRON_SECRET" }, { status: 503 });
        }

        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // imageExpiresAt เป็นนาฬิกาไทยตามกติกา DB จึงต้องเทียบกับ nowThai() ไม่ใช่ new Date()
        const now = nowThai();

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
