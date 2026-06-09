import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/lib/store';

const PASSCODES: Record<string, UserRole> = {
  'COLLECTOR123': 'COLLECTOR',
  'EXEC456': 'EXECUTIVE',
  'ADMIN789': 'ADMIN',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, passcode } = body;

    if (!userId || !passcode) {
      return NextResponse.json({ error: 'Missing userId or passcode' }, { status: 400 });
    }

    const newRole = PASSCODES[passcode];
    if (!newRole) {
      return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });

    return NextResponse.json({
      success: true,
      role: updatedUser.role,
    });
  } catch (error) {
    console.error('POST /api/upgrade error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
