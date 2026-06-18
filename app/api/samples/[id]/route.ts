import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const sample = await prisma.waterSample.findUnique({
      where: { id },
      select: {
        id: true,
        collectorId: true,
        locationId: true,
        collectionTime: true,
        uploadedAt: true,
        ammonia: true,
        phosphate: true,
        oxygen: true,
        temperature: true,
        rainVolume: true,
        weatherCondition: true,
        status: true,
        imageUrl: true,
        location: {
          select: {
            id: true,
            name: true,
            agency: true,
            lat: true,
            lon: true,
          },
        },
        collector: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!sample) {
      return NextResponse.json(
        { error: 'ไม่พบประวัติการส่งผลตรวจน้ำ' },
        { status: 404 },
      );
    }

    return NextResponse.json(sample);
  } catch (error) {
    console.error('GET /api/samples/[id] error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการส่งผลตรวจน้ำ' },
      { status: 500 },
    );
  }
}
