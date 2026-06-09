import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTmdHourlyWeather } from '@/lib/tmd';
import { WaterStatus } from '@prisma/client';

// GET /api/samples — List samples, optionally filtered by locationId or collectorId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('locationId');
    const collectedBy = searchParams.get('collectedBy'); // Maps to collectorId

    const where: { locationId?: string; collectorId?: string } = {};
    if (locationId) where.locationId = locationId;
    if (collectedBy) where.collectorId = collectedBy;

    const samples = await prisma.waterSample.findMany({
      where,
      include: {
        location: { select: { name: true, agency: true } },
        collector: { select: { name: true } },
      },
      orderBy: { collectionTime: 'desc' },
    });

    return NextResponse.json(samples);
  } catch (error) {
    console.error('GET /api/samples error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 });
  }
}

// POST /api/samples — Create a new water sample record with weather API data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      locationId,
      imageUrl,
      phosphateVal,
      ammoniaVal,
      oxygen,
      status,
      collectedBy, // collectorId (String UUID)
      collectionTime, // Explicit collector collection timestamp
    } = body;

    if (!locationId || !status || !collectedBy || !collectionTime) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลและเลือกเวลาบันทึกให้ครบถ้วน' },
        { status: 400 }
      );
    }

    // 1. Fetch Location details to obtain lat/lon for TMD Weather API
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'ไม่พบจุดตรวจที่ระบุในฐานข้อมูล' },
        { status: 404 }
      );
    }

    // Parse collection time
    const parsedCollectionTime = new Date(collectionTime);

    // 2. Fetch TMD Hourly weather at the sample coordinates & time
    const weather = await getTmdHourlyWeather(
      location.lat,
      location.lon,
      parsedCollectionTime
    );

    // Set expiration to 90 days from now if there is an image
    const imageExpiresAt = imageUrl ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : null;

    // 3. Save sample record including AI analysis results and Weather details
    const sample = await prisma.waterSample.create({
      data: {
        locationId,
        collectorId: collectedBy,
        collectionTime: parsedCollectionTime,
        ammonia: parseFloat(ammoniaVal),
        phosphate: parseFloat(phosphateVal),
        oxygen: oxygen ? parseFloat(oxygen) : null,
        temperature: weather.temperature,
        rainVolume: weather.rainVolume,
        weatherCondition: weather.weatherCondition,
        status: status as WaterStatus,
        imageUrl: imageUrl || null,
        imageExpiresAt,
      },
    });

    return NextResponse.json(sample, { status: 201 });
  } catch (error) {
    console.error('POST /api/samples error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' }, { status: 500 });
  }
}
