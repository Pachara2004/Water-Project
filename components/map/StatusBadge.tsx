"use client";

import { getStatusLabel } from "@/lib/standards";

export type SampleReviewStatus = "PENDING" | "APPROVED" | "EDITED_APPROVED" | "REJECTED";

interface StatusBadgeProps {
    status: "safe" | "warning" | "danger" | null;
    /**
     * สถานะการตรวจสอบของชุดข้อมูล — ส่งมาเมื่อ badge นี้แทนผลตรวจที่ต้องผ่านการอนุมัติ
     *
     * ยังรอตรวจสอบ = ค่ายังไม่ถูกยืนยัน ห้ามประกาศว่า "ปลอดภัย"
     * ถูกปฏิเสธ = ข้อมูลถูกตีตกไปแล้ว ไม่มีอะไรให้ประเมิน
     * ไม่ส่งมา = ใช้สถานะคุณภาพน้ำตรง ๆ (เช่น หมุดบนแผนที่ซึ่งกรอง pending ออกไปแล้ว)
     */
    reviewStatus?: SampleReviewStatus | null;
    size?: "sm" | "md" | "lg";
    fullWidth?: boolean; // 🌟 เผื่อเคสที่อยากให้กางเต็ม 100% ของคอนเทนเนอร์แม่
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

export default function StatusBadge({ status, reviewStatus, size = "md", fullWidth = false }: StatusBadgeProps) {
    const widthClass = fullWidth ? "w-full justify-center" : sizeStyles[size];

    if (reviewStatus === "PENDING") {
        return (
            <span className={`inline-flex items-center rounded-md font-medium bg-amber-50 text-amber-700 border-amber-200 border dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 ${widthClass}`}>
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
