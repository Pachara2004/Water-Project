import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, phone } = body;

    if (!userId || !phone || !phone.trim()) {
      return NextResponse.json(
        { error: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง' },
        { status: 400 }
      );
    }

    // Securely update user contact phone number in the database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        phone: phone.trim(),
      },
    });

    return NextResponse.json({
      id: updatedUser.id,
      lineId: updatedUser.lineId,
      name: updatedUser.name,
      role: updatedUser.role,
      phone: updatedUser.phone,
    });
  } catch (error) {
    console.error('POST /api/auth/phone error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลเบอร์โทรศัพท์' },
      { status: 500 }
    );
  }
}
