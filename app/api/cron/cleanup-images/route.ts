import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

// GET /api/cron/cleanup-images
// Can be called periodically by a cron job or external service (like Vercel Cron)
export async function GET(request: NextRequest) {
  try {
    // Optional: Add a simple security key check to prevent unauthorized calls
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Find samples with expired images
    const expiredSamples = await prisma.sample.findMany({
      where: {
        imageUrl: { not: null },
        imageExpiresAt: { lte: now },
      },
      select: {
        id: true,
        imageUrl: true,
      },
    });

    if (expiredSamples.length === 0) {
      return NextResponse.json({ message: 'No expired images found', count: 0 });
    }

    let deletedCount = 0;
    const publicDir = path.join(process.cwd(), 'public');

    for (const sample of expiredSamples) {
      if (sample.imageUrl) {
        // e.g. imageUrl = "/uploads/sample_123.jpg"
        const filePath = path.join(publicDir, sample.imageUrl);
        
        try {
          // Attempt to delete the file from filesystem
          await fs.unlink(filePath);
          deletedCount++;
        } catch (err) {
          console.warn(`Failed to delete file: ${filePath}`, err);
          // If the file doesn't exist anymore, we still want to update the DB
        }

        // Remove imageUrl from database
        await prisma.sample.update({
          where: { id: sample.id },
          data: { imageUrl: null },
        });
      }
    }

    return NextResponse.json({
      message: 'Cleanup successful',
      processed: expiredSamples.length,
      deletedFiles: deletedCount,
    });
  } catch (error) {
    console.error('Cron cleanup error:', error);
    return NextResponse.json({ error: 'Internal server error during cleanup' }, { status: 500 });
  }
}
