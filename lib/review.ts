/**
 * @file lib/review.ts
 * @project Water Monitoring Project
 * @module Review / Review Request & Workflow Helpers
 * @description
 * [TH] ยูทิลิตี้ฟังก์ชันสำหรับระบบตรวจสอบและอนุมัติผลการตรวจวัดคุณภาพน้ำ (Review & Approval Workflow)
 * ให้บริการดึงรายชื่อ Session Groups ที่อยู่ระหว่างรอการอนุมัติ (`pending`) สำหรับใช้กรองข้อมูลบนแผนที่และแดชบอร์ด
 * และสืบค้นรายการคำร้องที่ถูกปฏิเสธ (`rejected`) เพื่อแสดงผลบนแถบกระดิ่งแจ้งเตือนของผู้เก็บตัวอย่างน้ำ
 *
 * [EN] Helper utilities for the water quality review and approval lifecycle.
 * Provides central lookup for pending review session groups (used to isolate unverified submissions on map/dashboard views)
 * and retrieves rejected review submissions for collector notification feeds.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-13
 * @modified 2026-07-15
 * @version 1.1.0
 * @license Proprietary
 *
 * @see {@link /lib/sampleFilters.ts} Sample filters engine consuming pending session groups
 * @see {@link /app/api/review-requests/route.ts} Review requests collection endpoint
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-13)
 *
 * @lastModified 2026-07-15
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-07-15 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: เพิ่มฟังก์ชันแจ้งเตือน
 * - 2026-07-14 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: เพิ่มโหมดการส่งตัวอย่าง
 * - 2026-07-13 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: เพิ่มฟังก์ชันส่งคำร้องตรวจสอบตัวอย่างน้ำที่มีค่า confidence ต่ำ
 */

import { prisma } from "@/lib/prisma";

/**
 * [TH] คืนค่ารายชื่อ Session Groups ทั้งหมดที่ยังอยู่ในสถานะ `pending` (รอเจ้าหน้าที่/ผู้ดูแลระบบพิจารณา)
 * เป็น Single Source of Truth สำหรับทุก Read Path ที่ต้องการคัดกรองข้อมูลรออนุมัติออกจากการแสดงผลสาธารณะ
 *
 * [EN] Retrieves all session group IDs currently awaiting review decision (`statusRequest: "pending"`).
 * Serves as the single source of truth to exclude unverified submissions from public/analytics read paths.
 *
 * @async
 * @function getPendingSessionGroups
 * @returns {Promise<string[]>} อาร์เรย์ของรหัส sessionGroup ที่อยู่ระหว่างรอการตรวจทาน
 *
 * @example
 * const pendingGroups = await getPendingSessionGroups();
 * // ใช้งานร่วมกับ Where clause:
 * where.OR = [{ sessionGroup: null }, { sessionGroup: { notIn: pendingGroups } }];
 */
export async function getPendingSessionGroups(): Promise<string[]> {
    const rows = await prisma.reviewRequest.findMany({
        where: { statusRequest: "pending" },
        select: { sessionGroup: true },
    });
    return rows.map((r) => r.sessionGroup);
}

/**
 * [TH] คืนค่ารายการคำร้องที่ถูกปฏิเสธ (`rejected`) ทั้งหมดที่เป็นของผู้เก็บตัวอย่างน้ำที่ระบุ สำหรับแสดงผลบนแถบกระดิ่งแจ้งเตือน
 * ตรวจสอบความเป็นเจ้าของผ่านความสัมพันธ์ `sessionGroup` ในตาราง `WaterSample` (รวมถึงแถวที่ถูก Soft-delete)
 *
 * [EN] Retrieves all rejected review requests belonging to the specified collector for notification bells.
 * Resolves ownership via `sessionGroup` linkages in `WaterSample` (including soft-deleted samples).
 *
 * @async
 * @function getRejectedReviewsForCollector
 * @param {number} collectorId - รหัสประจำตัวของผู้เก็บตัวอย่างน้ำ
 * @returns {Promise<any[]>} อาร์เรย์ของ ReviewRequest ที่ถูกปฏิเสธ เรียงลำดับจากใหม่สุดไปเก่าสุด
 */
export async function getRejectedReviewsForCollector(collectorId: number) {
    // 1. หา sessionGroup ทั้งหมดที่ collector คนนี้เป็นเจ้าของ (รวมที่ถูก soft-delete)
    const ownGroups = await prisma.waterSample.findMany({
        where: { collectorId, sessionGroup: { not: null } },
        select: { sessionGroup: true },
        distinct: ["sessionGroup"],
    });
    const groupKeys = ownGroups.map((g) => g.sessionGroup).filter((g): g is string => g !== null);
    if (groupKeys.length === 0) return [];

    // 2. คัดเฉพาะคำร้องที่ถูกปฏิเสธในกลุ่มเหล่านั้น (ใหม่สุดขึ้นก่อน)
    return prisma.reviewRequest.findMany({
        where: { statusRequest: "rejected", sessionGroup: { in: groupKeys } },
        orderBy: { reviewedAt: "desc" },
    });
}
