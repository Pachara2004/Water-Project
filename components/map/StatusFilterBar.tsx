/**
 * @file StatusFilterBar.tsx
 * @project Water Monitoring Project
 * @module UI / Map / Filters
 * @description
 * ดรอปดาวน์กรองหมุดบนแผนที่ตามสถานะคุณภาพน้ำ (ทุกสถานะ / ปลอดภัย / เฝ้าระวัง / อันตราย)
 * เป็น custom dropdown หน้าตาชุดเดียวกับ OfficerFilterBar ปิดเองเมื่อกดนอกกล่อง
 * เทียบค่าแบบไม่สนตัวพิมพ์เพราะ API บางจุดส่งสถานะเป็นตัวพิมพ์ใหญ่
 *
 * Custom dropdown filtering map pins by water-quality status; case-insensitive value matching.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-11
 * @version 1.0.0
 *
 * @lastModified 2026-09-02 11:44
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-06-11 13:57 by Pachara P. - เพิ่มตัวกรองสถานะบนแผนที่
 * - 2026-07-01 11:18 by Pachara P. - ปรับให้ตรงธีมระบบ
 * - 2026-07-22 10:11 by Pachara P. - รองรับ dark mode
 * - 2026-09-02 11:44 by Pachara P. - ปรับ UI
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @license Private / Proprietary
 */

"use client";

import { Droplets, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";

/** Props ของ StatusFilterBar */
interface StatusFilterBarProps {
    /** ค่าที่เลือก: "ALL" | "safe" | "warning" | "danger" (ไม่สนตัวพิมพ์) */
    value: string;
    /** เรียกเมื่อเลือกค่าใหม่ */
    onChange: (value: string) => void;
}

const STATUS_OPTIONS = [
    { value: "ALL", label: "ทุกสถานะ" },
    { value: "safe", label: "ปลอดภัย" },
    { value: "warning", label: "เฝ้าระวัง" },
    { value: "danger", label: "อันตราย" },
];

/**
 * ดรอปดาวน์กรองสถานะคุณภาพน้ำ
 *
 * @param props - ดู {@link StatusFilterBarProps}
 */
export default function StatusFilterBar({ value, onChange }: StatusFilterBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentOption = useMemo(() => {
        const lowerValue = value.toLowerCase();
        return STATUS_OPTIONS.find((o) => o.value.toLowerCase() === lowerValue) || STATUS_OPTIONS[0];
    }, [value]);

    useEffect(() => {
        function handleClickOutside(event: PointerEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("pointerdown", handleClickOutside);
        return () => document.removeEventListener("pointerdown", handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-card-general flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.97] will-change-transform cursor-pointer"
            >
                <div className="shrink-0">
                    <Droplets size={18} strokeWidth={3} className="text-primary" />
                </div>
                <div className="flex flex-col items-start leading-none min-w-0 flex-1">
                    <span className="text-xs text-primary font-semibold sm:font-medium">คุณภาพน้ำ</span>
                    <span className="font-semibold sm:font-medium text-text text-xs flex items-center gap-1.5 mt-0.5 w-full">
                        <span className="truncate text-left">{currentOption.label}</span>
                    </span>
                </div>
                <ChevronDown size={16} className={`text-primary ml-auto shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-card-general rounded-2xl overflow-hidden shadow-xl border border-border animate-slide-down origin-top z-700 will-change-transform">
                    <div className="p-1.5 flex flex-col gap-0.5">
                        {STATUS_OPTIONS.map((option) => {
                            const isSelected = value.toLowerCase() === option.value.toLowerCase();
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold sm:font-medium transition-all duration-150 flex items-center gap-2.5 cursor-pointer
                                ${isSelected ? "text-white bg-secondary" : "text-text hover:bg-surface-subtle"}`}
                                >
                                    <span className={`rounded-full shrink-0 transition-all ${isSelected ? "scale-110 opacity-100" : "scale-90 opacity-60"}`} />
                                    <span className="font-semibold sm:font-medium truncate">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
