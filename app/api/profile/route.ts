import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Thai mobile: 06x, 08x, 09x (10 digits)
// Thai landline: 02x–05x (9–10 digits)
// International: +66XXXXXXXXX
const PHONE_REGEX = /^(\+66[0-9]{8,9}|0[2-9][0-9]{7,8})$/;

// Allow Thai, Latin, spaces, hyphens — block HTML/script injection
const NAME_REGEX = /^[ก-๙a-zA-Z0-9\s\-'.]+$/;

function sanitize(str: string) {
  return str.trim().replace(/\s+/g, ' ');
}

// PATCH /api/profile — update own name and/or phone
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, phone } = body;

    // ── Identity ──────────────────────────────────────────────────────
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่' },
        { status: 401 }
      );
    }

    // ── Verify user exists ────────────────────────────────────────────
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json(
        { error: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ' },
        { status: 404 }
      );
    }

    // ── Validate name ─────────────────────────────────────────────────
    const cleanName = sanitize(String(name ?? ''));

    if (!cleanName) {
      return NextResponse.json(
        { field: 'name', error: 'กรุณากรอกชื่อ' },
        { status: 422 }
      );
    }
    if (cleanName.length < 2) {
      return NextResponse.json(
        { field: 'name', error: 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร' },
        { status: 422 }
      );
    }
    if (cleanName.length > 100) {
      return NextResponse.json(
        { field: 'name', error: 'ชื่อต้องไม่เกิน 100 ตัวอักษร' },
        { status: 422 }
      );
    }
    if (!NAME_REGEX.test(cleanName)) {
      return NextResponse.json(
        { field: 'name', error: 'ชื่อมีอักขระที่ไม่อนุญาต' },
        { status: 422 }
      );
    }

    // ── Validate phone (optional) ─────────────────────────────────────
    const cleanPhone = phone ? sanitize(String(phone)).replace(/[-\s]/g, '') : null;

    if (cleanPhone && !PHONE_REGEX.test(cleanPhone)) {
      return NextResponse.json(
        { field: 'phone', error: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (เช่น 0812345678)' },
        { status: 422 }
      );
    }

    // ── Update ────────────────────────────────────────────────────────
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: cleanName,
        phone: cleanPhone,
      },
      select: { id: true, lineId: true, name: true, role: true, phone: true },
    });

    return NextResponse.json({ success: true, user: updated });

  } catch (error) {
    console.error('PATCH /api/profile error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    );
  }
}
