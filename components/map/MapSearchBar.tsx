/**
 * @file MapSearchBar.tsx
 * @project Water Monitoring Project
 * @module UI / Map / Search
 * @description
 * ช่องค้นหาสถานีบนแผนที่ กรองจากรายการที่โหลดมาแล้วในเบราว์เซอร์ตามชื่อสถานีหรือหน่วยงาน
 * (ไม่ยิง API) แสดงผลลัพธ์เป็นดรอปดาวน์ เลือกแล้วส่งสถานีกลับให้ MapView เลื่อนแผนที่และเปิด BottomSheet
 *
 * Client-side station search box for the map; filters the already-loaded list by
 * name or organization and hands the picked station back to MapView.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-17
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-08-14, 2026-09-01)
 *
 * @lastModified 2026-09-02 11:44
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-07-17 09:05 by Pachara P. - เพิ่มช่องค้นหาบนแผนที่
 * - 2026-07-22 10:11 by Pachara P. - รองรับ dark mode
 * - 2026-08-14 12:18 by Nopparut U. - เอากรอบโฟกัสสีดำของเบราว์เซอร์ออก
 * - 2026-09-02 11:44 by Pachara P. - ปรับ UI
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @license Private / Proprietary
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Search, MapPin, X } from "lucide-react";

/** สถานีในรูปแบบย่อที่ใช้ค้นหา */
interface SearchLocationItem {
    id: number;
    name: string;
    organization: string;
    lat: number;
    lng: number;
}

/** Props ของ MapSearchBar */
interface MapSearchBarProps {
    /** รายการสถานีทั้งหมดที่โหลดมาแล้ว */
    locations: SearchLocationItem[];
    /** เรียกเมื่อผู้ใช้เลือกผลลัพธ์ */
    onSelectLocation: (loc: SearchLocationItem) => void;
}

/**
 * ช่องค้นหาสถานีพร้อมดรอปดาวน์ผลลัพธ์ (สูงสุดตามพื้นที่ max-h-56 เลื่อนได้)
 *
 * @param props - ดู {@link MapSearchBarProps}
 */
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
            <div className="flex items-center w-full px-3 py-3 bg-card-general rounded-xl shadow-sm transition-all">
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
                    className="w-full h-8 bg-transparent text-xs font-semibold sm:font-medium text-text  placeholder:text-text-muted "
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
                            className="w-full flex items-start gap-2.5 px-3 py-2 text-left text-xs hover:bg-surface-subtle transition-colors border-b last:border-0 border-border/40 cursor-pointer font-semibold sm:font-medium"
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
