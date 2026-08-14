"use client";

import { useState, useRef, useEffect } from "react";
import { Search, MapPin, X } from "lucide-react";

interface SearchLocationItem {
    id: number;
    name: string;
    organization: string;
    lat: number;
    lng: number;
}

interface MapSearchBarProps {
    locations: SearchLocationItem[];
    onSelectLocation: (loc: SearchLocationItem) => void;
}

export default function MapSearchBar({ locations, onSelectLocation }: MapSearchBarProps) {
    const [keyword, setKeyword] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // ค้นหาคำที่ผู้ใช้พิมพ์โดยไม่สนตัวพิมพ์เล็ก-ใหญ่
    const filtered = keyword.trim() ? locations.filter((loc) => loc.name.toLowerCase().includes(keyword.toLowerCase()) || loc.organization.toLowerCase().includes(keyword.toLowerCase())) : [];

    // ดักจับเหตุการณ์คลิกนอกคอมโพเนนต์เพื่อปิดเมนูรายการผลลัพธ์
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="relative w-full z-700">
            {/* Input ค้นหา */}
            <div className="flex items-center w-full h-13 px-3 bg-card-general rounded-xl shadow-sm transition-all">
                <Search size={16} strokeWidth={3} className="text-primary shrink-0 mr-2" />
                <input
                    type="text"
                    value={keyword}
                    onFocus={() => setIsOpen(true)}
                    onChange={(e) => {
                        setKeyword(e.target.value);
                        setIsOpen(true);
                    }}
                    placeholder="ค้นหาจุดเก็บตัวอย่างหรือหน่วยงาน"
                    className="no-focus-ring w-full h-7 bg-transparent text-xs font-semibold text-text  placeholder:text-text-muted "
                />
                {keyword && (
                    <button
                        type="button"
                        onClick={() => {
                            setKeyword("");
                            setIsOpen(false);
                        }}
                        className="text-text-muted hover:text-text-secondary cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* รายการผลลัพธ์ Dropdown */}
            {isOpen && filtered.length > 0 && (
                <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-card-general border border-border rounded-xl shadow-lg max-h-56 overflow-y-auto py-1">
                    {filtered.map((loc) => (
                        <button
                            key={loc.id}
                            type="button"
                            onClick={() => {
                                onSelectLocation(loc);
                                setKeyword(loc.name); // ใส่ชื่อสถานที่ลงใน input
                                setIsOpen(false); // ปิด dropdown
                            }}
                            className="w-full flex items-start gap-2.5 px-3 py-2 text-left text-xs text-primary hover:bg-surface-subtle transition-colors border-b last:border-0 border-border/40 cursor-pointer font-semibold"
                        >
                            <MapPin size={16} className="text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-primary">{loc.name}</div>
                                <div className="text-xs text-text truncate mt-0.5">{loc.organization}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
