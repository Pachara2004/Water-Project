"use client";

import { Filter, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";

interface FilterBarProps {
    value: string;
    onChange: (value: string) => void;
}

interface Option {
    value: string;
    label: string;
}

export default function FilterBar({ value, onChange }: FilterBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [options, setOptions] = useState<Option[]>([{ value: "ALL", label: "ทั้งหมด" }]);

    useEffect(() => {
        async function fetchAgencies() {
            try {
                const response = await fetch("/api/locations");
                if (!response.ok) throw new Error("Failed to fetch locations");
                const data = await response.json();

                // ⚡ Performance: กรองคัดแยกแบบเบ็ดเสร็จในขั้นเดียวก่อนเซ็ตลงในสเตต
                const uniqueAgencies = Array.from(new Set(data.map((loc: any) => loc.organization).filter(Boolean))) as string[];
                const dynamicOptions: Option[] = uniqueAgencies.map((agency) => ({
                    value: agency,
                    label: agency,
                }));

                setOptions([{ value: "ALL", label: "ทั้งหมด" }, ...dynamicOptions]);
            } catch (error) {
                console.error("Error fetching agencies:", error);
            }
        }
        fetchAgencies();
    }, []);

    // ⚡ Performance: ป้องกันการสแกนหาข้อความใหม่ยกก้อนอาเรย์ทุกรอบที่เกิดการคลิกหน้าจอ
    const currentLabel = useMemo(() => {
        return options.find((o) => o.value === value)?.label || "ทั้งหมด";
    }, [options, value]);

    useEffect(() => {
        // ⚡ UX & Mobile Performance: เปลี่ยนเป็น pointerdown เพื่อให้รับอินพุตนิ้วสัมผัสบนมือถือได้ไวยิ่งขึ้น
        function handleClickOutside(event: PointerEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("pointerdown", handleClickOutside);
        return () => document.removeEventListener("pointerdown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                // ⚡ UX: ปรับ duration แอนิเมชันให้สั้นลง กระชับ และฉับไวขึ้น
                className="bg-surface flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.97] will-change-transform cursor-pointer w-45 shrink-0"
            >
                <div className="shrink-0">
                    <Filter size={16} className="text-secondary" />
                </div>

                <div className="flex flex-col items-start leading-none min-w-0 flex-1">
                    <span className="text-[9px] text-primary font-semibold uppercase tracking-wider">หน่วยงาน</span>
                    <span className="font-semibold text-black text-xs mt-0.5 truncate w-full text-left">{currentLabel}</span>
                </div>

                <ChevronDown size={14} className={`text-primary ml-auto shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                // ⚡ Performance: ใส่ will-change-transform เพื่อบอกการ์ดจอให้เตรียม Render แอนิเมชันคลี่เมนูลงมาโดยไม่กระตุก
                <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-surface rounded-2xl shadow-xl border border-border overflow-hidden animate-slide-down origin-top z-700 will-change-transform">
                    <div className="p-1.5 flex flex-col gap-0.5">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center cursor-pointer ${
                                    value === option.value ? "bg-primary/10 text-primary" : "text-black hover:bg-surface-subtle"
                                }`}
                            >
                                <span className="font-semibold truncate text-left w-full">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
