"use client";

import { Filter, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

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

    const currentLabel = options.find((o) => o.value === value)?.label || "ทั้งหมด";

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        // เปลี่ยนจาก fixed เป็น relative เพื่อให้จัดเรียงคู่กับปุ่มสถานะได้
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-surface flex items-center gap-4 px-6 py-3 rounded-xl text-sm transition-all duration-300 shadow-sm hover:shadow-md active:scale-[0.97] cursor-pointer"
            >
                <div>
                    <Filter size={18} className="text-secondary" />
                </div>
                <div className="flex flex-col items-start leading-none">
                    <span className="text-[9px] text-primary font-semibold uppercase tracking-wider">หน่วยงาน</span>
                    <span className="font-semibold text-black text-xs mt-0.5">{currentLabel}</span>
                </div>
                <ChevronDown size={14} className={`text-primary ml-1 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-surface rounded-2xl overflow-hidden animate-slide-down origin-top">
                    <div className="p-1.5">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-4 py-3 rounded-xl text-center text-xs font-semibold transition-all duration-200 items-left flex cursor-pointer${
                                    value === option.value ? "bg-primary/10 text-primary" : "text-text-secondary hover:bg-surface-subtle"
                                }`}
                            >
                                <div className={`transition-all ${value === option.value ? "bg-primary scale-100" : "bg-transparent scale-0"}`} />
                                <span className="font-semibold">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
