"use client";

import { Droplets, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface StatusFilterBarProps {
    value: string;
    onChange: (value: string) => void;
}

const options = [
    { value: "ALL", label: "ทุกสถานะ" },
    { value: "safe", label: "ปลอดภัย" },
    { value: "warning", label: "เฝ้าระวัง" },
    { value: "danger", label: "อันตราย" },
];

export default function StatusFilterBar({ value, onChange }: StatusFilterBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const currentOption = options.find((o) => o.value.toLowerCase() === value.toLowerCase()) || options[0];

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
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-surface flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300 shadow-sm hover:shadow-md active:scale-[0.97] w-35 cursor-pointer max-w-40 sm:max-w-xs"
            >
                <div className="shrink-0">
                    <Droplets size={18} className="text-secondary" />
                </div>
                <div className="flex flex-col items-start leading-none min-w-0">
                    <span className="text-[9px] text-primary font-semibold uppercase tracking-wider">คุณภาพน้ำ</span>
                    <span className="font-semibold text-black text-xs flex items-center gap-1.5 mt-0.5 w-full">
                        {/* วงกลมสีสถานะ ล็อกขนาดไว้ไม่ให้เบี้ยว */}
                        <span className="truncate text-left">{currentOption.label}</span>
                    </span>
                </div>
                <ChevronDown size={14} className={`text-primary ml-auto shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {/* ลิสต์เมนูด้านล่าง */}
            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 min-w-37.5 bg-surface rounded-2xl overflow-hidden shadow-xl border border-border animate-slide-down origin-top z-700">
                    <div className="p-1.5 flex flex-col gap-0.5">
                        {options.map((option) => {
                            const isSelected = value.toLowerCase() === option.value.toLowerCase();
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-2.5 cursor-pointer
                                ${isSelected ? "text-primary bg-primary/5" : "text-black hover:bg-surface-subtle"}`}
                                >
                                    <span className={`rounded-full shrink-0 transition-all ${isSelected ? "scale-110 opacity-100" : "scale-90 opacity-60"}`} />
                                    <span className="font-semibold truncate">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
