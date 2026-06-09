import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUid, name } = body;

    if (!lineUid || !name) {
      return NextResponse.json(
        { error: 'Missing lineUid or name' },
        { status: 400 }
      );
    }

    // Try to find the user using the new lineId unique column
    let user = await prisma.user.findUnique({
      where: { lineId: lineUid },
    });

    // If not found, create as GENERAL role (new PRD default)
    if (!user) {
      user = await prisma.user.create({
        data: {
          lineId: lineUid,
          name,
          role: 'GENERAL',
        },
      });
    }

    return NextResponse.json({
      id: user.id,
      lineId: user.lineId,
      name: user.name,
      role: user.role,
      phone: user.phone, // Return contact number for onboarding verification
    });
  } catch (error) {
    console.error('POST /api/auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
