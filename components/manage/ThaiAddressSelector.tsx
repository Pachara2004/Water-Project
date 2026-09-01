"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";
import { useThaiAddressTree } from "@/lib/hooks/useThaiAddressTree";

// จำนวนตัวเลือกขั้นต่ำที่จะโชว์ช่องค้นหาในเมนู — ลิสต์สั้น ๆ (เช่นอำเภอไม่กี่อัน) ไม่ต้องมีก็หาเจอ
const SEARCH_THRESHOLD = 8;

/**
 * ดรอปดาวน์เลือกที่อยู่ — ใช้ปุ่ม + เมนูเองแทน <select> เพราะ <option> ของ native
 * สไตล์ไม่ได้ ทำให้รายการที่กางออกมาไม่เข้ากับธีมของระบบ (โดยเฉพาะโหมดมืด)
 *
 * มีช่องค้นหาเมื่อรายการยาวเกิน SEARCH_THRESHOLD เพื่อทดแทน type-ahead ที่เสียไปจาก native select
 * (จังหวัดมี 77 รายการ)
 *
 * ข้อจำกัด: เมนูวางแบบ absolute ถ้าคอมโพเนนต์ถูกใช้ในกล่องที่ overflow ซ่อน
 * (เช่นฟอร์มแก้ไขสถานีที่อยู่ใน Popup) เมนูจะถูกตัดและต้องเลื่อนดู
 */
function SearchableSelect({
    value,
    options,
    placeholder,
    disabled,
    onChange,
}: {
    value: string;
    options: string[];
    placeholder: string;
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return options;
        return options.filter((o) => o.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [options, searchQuery]);

    // รีเซ็ตคำค้นหาเวลาปิดเมนู เพื่อให้ครั้งถัดไปเปิดมาเห็นรายการเต็ม
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

    // ปิดเมนูเองเมื่อถูก disable ระหว่างเปิดอยู่ (เช่นผู้ใช้เปลี่ยนจังหวัด ทำให้อำเภอถูกรีเซ็ต)
    useEffect(() => {
        if (disabled) setIsOpen(false);
    }, [disabled]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between gap-2 px-4 py-3 bg-surface-subtle border text-text-primary rounded-xl text-xs min-h-11 font-semibold transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${
                    isOpen ? "border-primary" : "border-border"
                }`}
            >
                <span className={`truncate text-left ${value ? "text-text-primary" : "text-text-muted"}`}>{value || placeholder}</span>
                <ChevronDown size={14} className={`text-text-muted shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && !disabled && (
                <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-card-general rounded-2xl shadow-2xl border border-border/80 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-700">
                    {options.length >= SEARCH_THRESHOLD && (
                        <div className="p-2.5 border-b border-border bg-bg flex items-center gap-2">
                            <Search size={14} className="text-text shrink-0 ml-1" />
                            <input
                                type="text"
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="พิมพ์เพื่อค้นหา..."
                                className="no-focus-ring w-full bg-transparent text-xs text-text outline-hidden placeholder:text-text-muted font-medium py-1"
                            />
                            {searchQuery && (
                                <button type="button" onClick={() => setSearchQuery("")} className="text-text p-1 rounded-lg hover:bg-bg transition-colors cursor-pointer">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    )}

                    <div className="p-1 flex flex-col gap-0.5 max-h-56 overflow-y-auto overscroll-contain scrollbar-thin">
                        {filteredOptions.length === 0 ? (
                            <div className="text-center py-6 text-xs text-text font-medium">ไม่พบรายการที่ค้นหา</div>
                        ) : (
                            filteredOptions.map((option) => {
                                const isSelected = option === value;
                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => {
                                            onChange(option);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-all duration-100 cursor-pointer ${
                                            isSelected ? "bg-surface-subtle text-text" : "text-text-secondary hover:bg-surface"
                                        }`}
                                    >
                                        <span className="truncate text-left">{option}</span>
                                        {isSelected && <Check size={12} strokeWidth={4} className="text-primary shrink-0" />}
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

interface ThaiAddressSelectorProps {
    province: string;
    setProvince: (v: string) => void;
    district: string;
    setDistrict: (v: string) => void;
    subdistrict: string;
    setSubdistrict: (v: string) => void;
    zipcode: string;
    setZipcode: (v: string) => void;
    onGeocode?: (lat: number, lng: number) => void;
}

export function ThaiAddressSelector({
    province, setProvince,
    district, setDistrict,
    subdistrict, setSubdistrict,
    zipcode, setZipcode,
    onGeocode,
}: ThaiAddressSelectorProps) {
    const tree = useThaiAddressTree();

    const provinces = useMemo(() => {
        if (!tree) return [];
        return Object.keys(tree).sort();
    }, [tree]);

    const districts = useMemo(() => {
        if (!tree || !province || !tree[province]) return [];
        return Object.keys(tree[province]).sort();
    }, [tree, province]);

    const subdistricts = useMemo(() => {
        if (!tree || !province || !district || !tree[province]?.[district]) return [];
        return Object.keys(tree[province][district]).sort();
    }, [tree, province, district]);

    const handleProvinceChange = async (p: string) => {
        setProvince(p);
        setDistrict("");
        setSubdistrict("");
        setZipcode("");
        
        if (p && onGeocode) {
            try {
                const res = await fetch(`/api/nominatim?type=search&q=${encodeURIComponent(p + " จังหวัด")}`);
                const data = await res.json();
                if (data && data[0]) onGeocode(parseFloat(data[0].lat), parseFloat(data[0].lon));
            } catch(e){}
        }
    };

    const handleDistrictChange = async (d: string) => {
        setDistrict(d);
        setSubdistrict("");
        setZipcode("");
        
        if (d && province && onGeocode) {
            try {
                const res = await fetch(`/api/nominatim?type=search&q=${encodeURIComponent(d + " " + province)}`);
                const data = await res.json();
                if (data && data[0]) onGeocode(parseFloat(data[0].lat), parseFloat(data[0].lon));
            } catch(e){}
        }
    };

    const handleSubdistrictChange = (s: string) => {
        setSubdistrict(s);
    };

    // Auto-fill zipcode if province, district, subdistrict change
    useEffect(() => {
        if (tree && province && district && subdistrict && tree[province]?.[district]?.[subdistrict]) {
            setZipcode(tree[province][district][subdistrict]);
        } else if (!subdistrict) {
            setZipcode("");
        }
    }, [tree, province, district, subdistrict, setZipcode]);

    return (
        <>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-text-primary block uppercase tracking-wide">
                        จังหวัด <span className="text-text-danger">*</span>
                    </label>
                    <SearchableSelect
                        value={province}
                        options={provinces}
                        placeholder="-- เลือกจังหวัด --"
                        disabled={!tree}
                        onChange={handleProvinceChange}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-text-primary block uppercase tracking-wide">
                        อำเภอ/เขต <span className="text-text-danger">*</span>
                    </label>
                    <SearchableSelect
                        value={district}
                        options={districts}
                        placeholder="-- เลือกอำเภอ --"
                        disabled={!province || districts.length === 0}
                        onChange={handleDistrictChange}
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-text-primary block uppercase tracking-wide">
                        ตำบล/แขวง <span className="text-text-danger">*</span>
                    </label>
                    <SearchableSelect
                        value={subdistrict}
                        options={subdistricts}
                        placeholder="-- เลือกตำบล --"
                        disabled={!district || subdistricts.length === 0}
                        onChange={handleSubdistrictChange}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-text-primary block uppercase tracking-wide">
                        รหัสไปรษณีย์ <span className="text-text-danger">*</span>
                    </label>
                    <input 
                        type="text" 
                        value={zipcode} 
                        onChange={(e) => setZipcode(e.target.value)} 
                        className="w-full px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl text-xs outline-none min-h-11 font-semibold" 
                        placeholder="กรอกอัตโนมัติ" 
                    />
                </div>
            </div>
        </>
    );
}
