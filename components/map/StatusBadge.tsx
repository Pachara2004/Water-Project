"use client";

import { getStatusLabel } from "@/lib/standards";

interface StatusBadgeProps {
    status: "safe" | "warning" | "danger" | null;
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

export default function StatusBadge({ status, size = "md", fullWidth = false }: StatusBadgeProps) {
    const widthClass = fullWidth ? "w-full justify-center" : sizeStyles[size];

    if (!status) {
        return <span className={`inline-flex items-center rounded-md font-medium bg-gray-50 text-gray-500 border-gray-200 border ${widthClass}`}>ไม่มีข้อมูล</span>;
    }

    const lowerStatus = status.toLowerCase() as "safe" | "warning" | "danger";

    return <span className={`inline-flex items-center rounded-md font-semibold border ${statusStyles[lowerStatus]} ${widthClass}`}>{getStatusLabel(lowerStatus)}</span>;
}
