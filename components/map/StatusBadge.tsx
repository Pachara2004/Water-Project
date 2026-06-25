"use client";

import { getStatusLabel } from "@/lib/standards";

interface StatusBadgeProps {
    status: "safe" | "warning" | "danger" | null;
    size?: "sm" | "md" | "lg";
}

const statusStyles = {
    safe: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
    warning:
        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
    danger: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
};

const dotStyles = {
    safe: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
};

const sizeStyles = {
    sm: "text-[10px] px-2.5 py-1 gap-1.5",
    md: "text-xs px-3.5 py-1.5 gap-2",
    lg: "text-sm px-4.5 py-2.5 gap-2.5",
};

const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
    if (!status) {
        return (
            <span
                className={`inline-flex items-center rounded-full border font-medium bg-gray-50 text-gray-500 border-gray-200 ${sizeStyles[size]}`}
            >
                <span
                    className={`rounded-full bg-gray-400 ${dotSizes[size]}`}
                />
                ไม่มีข้อมูล
            </span>
        );
    }

    // ปรับการดึงค่า Key วัตถุสไตล์และฟังก์ชันแปลงข้อความภาษาไทยเป็นพิมพ์เล็ก
    const lowerStatus = status.toLowerCase() as "safe" | "warning" | "danger";

    return (
        <span
            className={`inline-flex items-center rounded-full border font-black ${statusStyles[lowerStatus]} ${sizeStyles[size]}`}
        >
            <span
                className={`rounded-full ${dotStyles[lowerStatus]} ${dotSizes[size]}`}
            />
            {getStatusLabel(lowerStatus)}
        </span>
    );
}
