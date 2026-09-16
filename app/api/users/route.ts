/**
 * @file app/api/users/route.ts
 * @project Water Monitoring Project
 * @module API / User Management
 * @description
 * [TH] Route Handler จัดการสมาชิกและคำขอเปลี่ยนบทบาทสิทธิ์สำหรับ Admin:
 * - GET: ดึงรายชื่อผู้ใช้แบบแบ่งหน้า (Pagination) พร้อมระบบค้นหา (Search ข้ามชื่อ-สกุล) กรองตามแท็บ (all, staff, queue) และเรียงลำดับ
 * - PATCH: อนุมัติ/ปฏิเสธคำร้องขอเปลี่ยนสิทธิ์ของผู้ใช้รายบุคคล หรือปฏิเสธคำร้องที่ค้างอยู่ทั้งหมด (Reject All)
 * [EN] Route Handler for User Management & Role Administration (Admin only):
 * - GET: Retrieves paginated user list with full-text multi-word search across first/last names, tab filtering (all, staff, queue), and sorting.
 * - PATCH: Elevates/updates user roles, approves/rejects specific role requests, or bulk rejects pending role requests.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.3.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-06-09)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-06)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-11)
 *
 * @lastModified 2026-09-11
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-06-09 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Initial users listing endpoint
 * - 2026-07-06 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Add role elevation PATCH & RoleRequest handling
 * - 2026-09-11 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - Transaction-based consistent pagination and multi-token search
 *
 * @database Prisma Client (MySQL)
 * @auth Role-based: admin only
 * @security Fail-closed verification with auth-guard, transactional role mutations
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth-guard"; // 🔥 อิมพอร์ต Guard กลางเข้ามาสลักนิรภัย
import { parsePageParams, pageResult } from "@/lib/pagination";
import { toApiString } from "@/lib/thaiTime";

type UserTab = "all" | "staff" | "queue";

/**
 * เงื่อนไขของแต่ละแท็บ — ต้องตรงกับที่ GET /api/users/stats ใช้นับ
 * ถ้าแก้ที่นี่แล้วไม่แก้ที่นั่น ตัวเลขบนการ์ดสรุปจะไม่ตรงกับจำนวนแถวที่แสดงจริง
 */
const TAB_FILTERS: Record<UserTab, object> = {
    all: {},
    staff: { systemRole: { roleName: { not: "guest" } } },
    queue: { roleRequests: { some: { status: "pending" } } },
};

/**
 * ดึงรายชื่อผู้ใช้ในระบบแบบแบ่งหน้าตามแท็บและคำค้นหา (เฉพาะ Admin)
 * Retrieves paginated list of registered users filtered by tab, search terms, and system role.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม Query params `?tab=...&search=...&role=...&page=...`
 * @returns {Promise<NextResponse>} ผลลัพธ์ในรูปแบบโครงสร้าง Pagination { items, total, page, pageSize, totalPages }
 */
export async function GET(request: NextRequest) {
    // SECURITY GUARD: อนุญาตให้เฉพาะระดับสิทธิ์ 'admin' เท่านั้นที่เปิดดูรายชื่อและคำร้องขอสิทธิ์ทั้งหมดได้
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search")?.trim() ?? "";
        const role = searchParams.get("role")?.trim() ?? "";
        const tabParam = searchParams.get("tab") as UserTab | null;
        const tab: UserTab = tabParam && tabParam in TAB_FILTERS ? tabParam : "all";
        const sort = searchParams.get("sort") === "asc" ? "asc" : "desc";
        // 10 แถวต่อหน้า ให้เท่ากับตารางประวัติผลตรวจของ collector ซึ่งเป็นรายการแบ่งหน้าอีกที่เดียวในระบบ
        const pageParams = parsePageParams(searchParams, 10);

        const where: any = { ...TAB_FILTERS[tab] };

        // หน้ารายชื่อแสดง "ชื่อ นามสกุล" ต่อกัน ผู้ใช้จึงพิมพ์ค้นทั้งก้อน แต่ DB เก็บแยกสองคอลัมน์
        // และ contains เทียบข้ามคอลัมน์ไม่ได้ → แยกคำที่พิมพ์ด้วยช่องว่าง แล้วทุกคำต้องเจอในคอลัมน์ใดคอลัมน์หนึ่ง
        // ("สมชาย ใจดี" = สมชาย เจอใน firstName และ ใจดี เจอใน lastName) — คำเดียวก็ยังทำงานเหมือนเดิม
        const terms = search.split(/\s+/).filter(Boolean);
        if (terms.length > 0) {
            where.AND = terms.map((term) => ({
                OR: [{ firstName: { contains: term } }, { lastName: { contains: term } }, { phoneNumber: { contains: term } }],
            }));
        }

        if (role && role !== "ALL") {
            where.systemRole = { roleName: role.toLowerCase() };
        }

        // นับพร้อมกันใน transaction เดียว เพื่อให้ total กับ items มาจาก snapshot เดียวกัน
        // ไม่งั้นถ้ามีคนสมัครแทรกระหว่างสอง query ตัวเลขจำนวนหน้าจะเพี้ยนกับรายการที่แสดง
        const [users, total] = await prisma.$transaction([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    lineUniqueId: true,
                    lineProfileName: true,
                    firstName: true,
                    lastName: true,
                    phoneNumber: true,
                    registeredAt: true,
                    lastActiveAt: true,
                    systemRole: { select: { roleName: true } },
                    _count: { select: { samples: true } },
                    roleRequests: {
                        where: { status: "pending" },
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        select: {
                            id: true,
                            requestedRole: { select: { roleName: true } },
                        },
                    },
                },
                // เรียงด้วย id ไม่ใช่ registeredAt เพราะ id เป็น primary key ที่มี index อยู่แล้ว
                // ทำให้ MySQL หยิบเฉพาะแถวของหน้าที่ขอโดยไม่ต้องอ่านทั้งตารางมาเรียง
                // ใช้แทนกันได้เพราะ registeredAt เป็น @default(now()) ที่ไม่มีโค้ดไหนเขียนทับ ลำดับจึงตรงกันเสมอ
                // ⚠️ ถ้าวันหลังมีการ import ผู้ใช้เก่าพร้อมเซ็ต registeredAt ย้อนหลัง สมมติฐานนี้จะพัง
                //    ตอนนั้นต้องเพิ่ม @@index([registeredAt]) ใน schema แล้วกลับมาเรียงด้วยคอลัมน์นั้น
                orderBy: { id: sort },
                skip: pageParams.skip,
                take: pageParams.take,
            }),
            prisma.user.count({ where }),
        ]);

        const formattedUsers = users.map((u) => {
            const pendingRequest = u.roleRequests[0];
            return {
                id: u.id,
                lineProfileName: u.lineProfileName,
                fullName: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "ยังไม่ลงทะเบียนข้อมูล",
                phoneNumber: u.phoneNumber || null,
                role: u.systemRole.roleName,
                registeredAt: toApiString(u.registeredAt),
                lastActiveAt: toApiString(u.lastActiveAt),
                samplesCount: u._count.samples,
                pendingRequestId: pendingRequest ? pendingRequest.id : null,
                requestedRole: pendingRequest ? pendingRequest.requestedRole.roleName : null,
            };
        });

        return NextResponse.json(pageResult(formattedUsers, total, pageParams));
    } catch (error) {
        console.error("GET /api/users error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลบัญชีผู้ใช้งาน" }, { status: 500 });
    }
}

/**
 * ปรับปรุงบทบาทสิทธิ์ (Role) ของผู้ใช้ หรือตัดสินคำร้องขอเปลี่ยนสิทธิ์ (เฉพาะ Admin)
 * Updates user role or processes/rejects role elevation requests.
 *
 * @param {NextRequest} request - HTTP Request object พร้อม JSON payload { userId, role, action, requestId }
 * @returns {Promise<NextResponse>} ผลการดำเนินการ { success, message, user }
 */
export async function PATCH(request: NextRequest) {
    // SECURITY GUARD: ป้องกันขั้นสูงสุด ล็อกให้เฉพาะ 'admin' ตัวจริงเท่านั้นที่อนุมัติหรือปฏิเสธคำร้องขอเปลี่ยนสิทธิ์ได้
    const auth = await verifyAuth(request, ["admin"]);
    if (!auth.isValid) {
        return NextResponse.json({ error: auth.errorResponse }, { status: auth.errorStatus });
    }

    try {
        const { userId, role, action, requestId } = await request.json();

        // กรณีแอดมินกดปุ่ม "ปฏิเสธทั้งหมด" (Reject All) คำร้องขอที่รออนุมัติทั้งหมด — ไม่ผูกกับ userId รายบุคคล
        if (action === "rejectAll") {
            const result = await prisma.roleRequest.updateMany({
                where: { status: "pending" },
                data: { status: "rejected" },
            });
            return NextResponse.json({ success: true, message: `ปฏิเสธคำร้องขอสิทธิ์ทั้งหมด ${result.count} รายการเรียบร้อยแล้ว` });
        }

        if (!userId) {
            return NextResponse.json({ error: "กรุณาระบุ userId" }, { status: 400 });
        }

        // กรณีแอดมินกดปุ่ม "ปฏิเสธ" (Reject) คำร้องขอ
        if (action === "reject" && requestId) {
            await prisma.roleRequest.update({
                where: { id: Number(requestId) },
                data: { status: "rejected" },
            });
            return NextResponse.json({ success: true, message: "ปฏิเสธคำร้องขอสิทธิ์เรียบร้อยแล้ว" });
        }

        // --- กรณีอนุมัติหรือเปลี่ยนสิทธิ์ปกติ ---
        if (!role) return NextResponse.json({ error: "กรุณาระบุบทบาทสิทธิ์ที่ต้องการแต่งตั้ง" }, { status: 400 });
        const targetRole = role.toLowerCase();

        const targetRoleRecord = await prisma.role.findUnique({
            where: { roleName: targetRole },
        });

        if (!targetRoleRecord) {
            return NextResponse.json({ error: "ไม่พบกลุ่มบทบาทสิทธิ์นี้ในระบบ" }, { status: 404 });
        }

        // ใช้ Transaction ควบคุม: อัปเดตสิทธิ์ User + ปิดตั๋วคำร้องขอ (ถ้ามี)
        const updatedUser = await prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id: Number(userId) },
                data: { roleId: targetRoleRecord.id },
                select: {
                    id: true,
                    lineProfileName: true,
                    firstName: true,
                    systemRole: { select: { roleName: true } },
                },
            });

            // ถ้าเป็นการอนุมัติจากตั๋วคำร้อง ให้เปลี่ยนสถานะเป็น approved
            if (requestId) {
                await tx.roleRequest.update({
                    where: { id: Number(requestId) },
                    data: { status: "approved" },
                });
            } else {
                // ถ้าแอดมินเปลี่ยนสิทธิ์จาก Dropdown ตรงๆ ให้ปิดตั๋ว pending เก่าของคนนี้ทั้งหมดไปด้วย
                await tx.roleRequest.updateMany({
                    where: { userId: Number(userId), status: "pending" },
                    data: { status: "approved" },
                });
            }

            return user;
        });

        return NextResponse.json({
            success: true,
            message: `แต่งตั้งสิทธิ์เรียบร้อยแล้ว`,
            user: { id: updatedUser.id, role: updatedUser.systemRole.roleName },
        });
    } catch (error) {
        console.error("PATCH /api/users error:", error);
        return NextResponse.json({ error: "เกิดข้อผิดพลาดในการบันทึกเปลี่ยนสิทธิ์สมาชิก" }, { status: 500 });
    }
}
