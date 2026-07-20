"use client";

import { Filter, ChevronDown, Search, X } from "lucide-react";
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
    
    const [searchQuery, setSearchQuery] = useState("");

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

    const currentLabel = useMemo(() => {
        return options.find((o) => o.value === value)?.label || "ทั้งหมด";
    }, [options, value]);

    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return options;
        return options.filter((option) =>
            option.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [options, searchQuery]);

    // รีเซ็ตคำค้นหาเวลาเปิด/ปิดดรอปดาวน์
    useEffect(() => {
        if (!isOpen) setSearchQuery("");
    }, [isOpen]);

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
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-card-general flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.97] will-change-transform cursor-pointer w-45 shrink-0"
            >
                <div className="shrink-0">
                    <Filter size={16} className="text-secondary" />
                </div>

                <div className="flex flex-col items-start leading-none min-w-0 flex-1">
                    <span className="text-xs text-primary font-semibold uppercase tracking-wider">หน่วยงาน</span>
                    <span className="font-semibold text-black text-xs mt-0.5 truncate w-full text-left">{currentLabel}</span>
                </div>

                <ChevronDown size={14} className={`text-primary ml-auto shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute top-[calc(100%+6px)] left-0 w-64 bg-surface/95 backdrop-blur-md rounded-2xl shadow-2xl border border-border/80 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-700 will-change-transform">
                    {/* ── โซนค้นหา: ปรับให้พรีเมียม ไร้ขอบตัด ขยายพื้นที่ไอคอน ── */}
                    <div className="p-2.5 border-b border-border bg-bg flex items-center gap-2 sticky top-0 z-10">
                        <Search size={14} className="text-text-muted shrink-0 ml-1" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="พิมพ์ชื่อหน่วยงาน..."
                            className="w-full bg-transparent text-xs text-text-primary outline-hidden placeholder:text-text-muted font-medium py-1"
                            onClick={(e) => e.stopPropagation()}
                        />
                        {searchQuery && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchQuery("");
                                }}
                                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-surface-muted transition-colors"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    <div
                        className="p-1 flex flex-col gap-0.5 max-h-56 overflow-y-auto overscroll-contain reserve-scrollbar-gutter scrollbar-thin"
                        onTouchMove={(e) => e.stopPropagation()}
                    >
                        {filteredOptions.length === 0 ? (
                            <div className="text-center py-6 text-xs text-text-muted font-medium tracking-wide">ไม่พบข้อมูลหน่วยงานนี้</div>
                        ) : (
                            filteredOptions.map((option) => {
                                const isSelected = value === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-100 flex items-center relative cursor-pointer group
                            ${isSelected ? "bg-bg text-primary" : "text-text-primary hover:bg-surface-subtle active:bg-surface-muted"}`}
                                    >
                                        {/* แถบสี่เหลี่ยมมินิมอลแสดงสถานะด้านหน้าชิปรายการที่เลือก */}

                                        <span className={`truncate text-left w-full transition-transform duration-100 ${isSelected ? "font-semibold" : "group-hover:translate-x-0.5"}`}>
                                            {option.label}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}