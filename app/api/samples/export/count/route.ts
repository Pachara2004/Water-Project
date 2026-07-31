import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard";
import { buildAllScopeWhere, buildSampleWhere, describeScope, readSampleFilters } from "@/lib/sampleFilters";
import { getPendingSessionGroups } from "@/lib/review";

export const dynamic = "force-dynamic";

/**
 * นับจำนวนแถวของทั้งสองขอบเขตก่อนผู้ใช้กดยืนยันส่งออก
 *
 * ต้องใช้ where ชุดเดียวกับ route ส่งออกจริง (ผ่าน lib/sampleFilters) ไม่งั้นตัวเลขที่โชว์จะหลอกผู้ใช้
 * สิทธิ์ต้องตรงกับ /api/samples/export และ /export-csv เพราะจำนวนแถวก็คือข้อมูลรูปแบบหนึ่ง
 */
export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request, ["officer", "admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const filters = readSampleFilters(request, auth.user!);
        const pendingGroups = await getPendingSessionGroups();

        const [filteredWhere, allWhere] = await Promise.all([buildSampleWhere(filters, { pendingGroups }), buildAllScopeWhere(filters, pendingGroups)]);

        const [filtered, all, station] = await Promise.all([
            prisma.waterSample.count({ where: filteredWhere }),
            prisma.waterSample.count({ where: allWhere }),
            filters.locationId ? prisma.location.findUnique({ where: { id: filters.locationId }, select: { stationName: true } }) : Promise.resolve(null),
        ]);

        const { rangeLabel, targetLabel } = describeScope(filters, "filtered", station?.stationName ?? null);

        return NextResponse.json({
            filtered,
            all,
            filteredLabel: `${rangeLabel} · ${targetLabel}`,
        });
    } catch (error) {
        console.error("Export Count API Error:", error);
        return NextResponse.json({ error: "ไม่สามารถนับจำนวนข้อมูลที่จะส่งออกได้" }, { status: 500 });
    }
}
