import { NextResponse } from 'next/server';

// Mock users database - simulates LINE Login user data
const mockUsers = [
  { id: 1, lineUid: 'U_ADMIN_001', name: 'สมชาย ผู้ดูแลระบบ', role: 'ADMIN' as const },
  { id: 2, lineUid: 'U_USER_001', name: 'สมหญิง นักวิจัย', role: 'USER' as const },
  { id: 3, lineUid: 'U_USER_002', name: 'วิชัย เจ้าหน้าที่', role: 'USER' as const },
];

// GET /api/users — Get all mock users (for testing)
export async function GET() {
  return NextResponse.json(mockUsers);
}
