/**
 * @file StatusBadge.tsx
 * @project Water Monitoring Project
 * @module UI / Water Quality
 * @description
 * ป้ายสถานะคุณภาพน้ำ (ปลอดภัย / เฝ้าระวัง / อันตราย / ไม่มีข้อมูล) ความกว้างคงที่ทุกสถานะ
 * ถ้าส่ง reviewStatus มา ป้ายจะให้ความสำคัญกับสถานะการตรวจสอบก่อน: PENDING = "รอตรวจสอบ",
 * REJECTED = "ประเมินไม่ได้" เพื่อไม่ประกาศว่าปลอดภัยทั้งที่ค่ายังไม่ถูกยืนยัน ป้ายสถานะมาจาก lib/standards
 *
 * Water-quality status badge (SAFE / WARNING / DANGER / no data). When a review
 * status is supplied, pending and rejected samples override the quality label.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-09-02)
 *
 * @lastModified 2026-09-02 14:13
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-06-09 09:09 by Pachara P. - สร้างป้ายสถานะพร้อมโครงระบบ
 * - 2026-07-21 10:36 by Pachara P. - ปรับความกว้างคงที่และจัดกึ่งกลาง
 * - 2026-08-25 11:08 by Pachara P. - ปรับ UI ให้เข้ากับหน้า collector
 * - 2026-09-02 14:13 by Nopparut U. - เพิ่ม reviewStatus และค่า null = ประเมินไม่ได้ รองรับภาพที่ AI ไม่พบหลอดทดลอง
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @license Private / Proprietary
 */

"use client";

import { getStatusLabel } from "@/lib/standards";

/** สถานะการตรวจสอบของตัวอย่าง ตรงกับ enum ใน Prisma */
export type SampleReviewStatus = "PENDING" | "APPROVED" | "EDITED_APPROVED" | "REJECTED";

/** Props ของ StatusBadge */
interface StatusBadgeProps {
    /** สถานะคุณภาพน้ำ; null = ไม่มีข้อมูล/ประเมินไม่ได้ */
    status: "safe" | "warning" | "danger" | null;
    /**
     * สถานะการตรวจสอบของชุดข้อมูล — ส่งมาเมื่อ badge นี้แทนผลตรวจที่ต้องผ่านการอนุมัติ
     *
     * ยังรอตรวจสอบ = ค่ายังไม่ถูกยืนยัน ห้ามประกาศว่า "ปลอดภัย"
     * ถูกปฏิเสธ = ข้อมูลถูกตีตกไปแล้ว ไม่มีอะไรให้ประเมิน
     * ไม่ส่งมา = ใช้สถานะคุณภาพน้ำตรง ๆ (เช่น หมุดบนแผนที่ซึ่งกรอง pending ออกไปแล้ว)
     */
    reviewStatus?: SampleReviewStatus | null;
    /** ขนาดตัวอักษร/ความกว้างคงที่ (ค่าเริ่มต้น md) */
    size?: "xs" | "sm" | "md" | "lg";
    /** กางเต็มความกว้างของคอนเทนเนอร์แม่แทนความกว้างคงที่ */
    fullWidth?: boolean;
}

const statusStyles = {
    safe: "bg-bg-safe text-text-safe border-border-safe dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    warning: "bg-bg-warning text-text-warning border-border-warning dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    danger: "bg-bg-danger text-text-danger border-border-danger dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
};

// 🌟 ปรับขนาด min-w และ w- ให้ฟิกซ์ความกว้างเท่ากันทุกสถานะ + จัดข้อความอยู่ตรงกลาง (justify-center)
const sizeStyles = {
    xs: "text-xs p-1 w-20 justify-center",
    sm: "text-xs p-1 w-30 justify-center",
    md: "text-xs p-1 w-30 justify-center",
    lg: "text-sm p-1 w-30 justify-center",
};

/**
 * ป้ายสถานะคุณภาพน้ำ
 *
 * @param props - ดู {@link StatusBadgeProps}
 */
export default function StatusBadge({ status, reviewStatus, size = "md", fullWidth = false }: StatusBadgeProps) {
    const widthClass = fullWidth ? "w-full justify-center" : sizeStyles[size];

    if (reviewStatus === "PENDING") {
        return (
            <span className={`inline-flex items-center rounded-md font-medium bg-bg-warning text-text-warning border-border-warning border ${widthClass}`}>
                รอตรวจสอบ
            </span>
        );
    }

    if (reviewStatus === "REJECTED") {
        return <span className={`inline-flex items-center rounded-md font-medium bg-gray-50 text-gray-500 border-gray-200 border ${widthClass}`}>ประเมินไม่ได้</span>;
    }

    if (!status) {
        return <span className={`inline-flex items-center rounded-md font-medium bg-gray-50 text-gray-500 border-gray-200 border ${widthClass}`}>ไม่มีข้อมูล</span>;
    }

    const lowerStatus = status.toLowerCase() as "safe" | "warning" | "danger";

    return <span className={`inline-flex items-center rounded-md font-semibold border ${statusStyles[lowerStatus]} ${widthClass}`}>{getStatusLabel(lowerStatus)}</span>;
}
