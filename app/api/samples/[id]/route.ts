import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT /api/samples/[id] — ADMIN เท่านั้น: soft-delete ของเก่า แล้วสร้าง record ใหม่
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { collectionTime, locationId, oxygen, adminId } = body;

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์แก้ไขข้อมูล' }, { status: 403 });
    }

    const old = await prisma.waterSample.findUnique({ where: { id } });
    if (!old || old.isDelete) {
      return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 });
    }

    await prisma.waterSample.update({
      where: { id },
      data: { isDelete: true, updatedBy: adminId },
    });

    const created = await prisma.waterSample.create({
      data: {
        collectorId: old.collectorId,
        locationId: locationId ?? old.locationId,
        collectionTime: collectionTime ? new Date(collectionTime) : old.collectionTime,
        ammonia: old.ammonia,
        phosphate: old.phosphate,
        oxygen: oxygen !== undefined ? (oxygen === null || oxygen === '' ? null : parseFloat(oxygen)) : old.oxygen,
        temperature: old.temperature,
        rainVolume: old.rainVolume,
        weatherCondition: old.weatherCondition,
        status: old.status,
        imageUrl: old.imageUrl,
        imagePlotUrl: old.imagePlotUrl,
        imageExpiresAt: old.imageExpiresAt,
        isDelete: false,
        updatedBy: adminId,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('PUT /api/samples/[id] error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล' }, { status: 500 });
  }
}

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
        imagePlotUrl: true,
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
