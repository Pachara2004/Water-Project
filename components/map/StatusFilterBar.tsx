"use client";

import { Droplets, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface StatusFilterBarProps {
    value: string;
    onChange: (value: string) => void;
}

// 🔒 สลับเปลี่ยนค่าคีย์ Value ให้เป็นตัวพิมพ์เล็กเพื่อแมปเข้าคู่กับฐานข้อมูลและ MapView ตัวล่าสุดครับบอส
const options = [
    { value: "ALL", label: "ทุกสถานะ", dotClass: "bg-primary" },
    { value: "safe", label: "ปลอดภัย", dotClass: "bg-emerald-500" },
    { value: "warning", label: "เฝ้าระวัง", dotClass: "bg-amber-500" },
    { value: "danger", label: "อันตราย", dotClass: "bg-red-500" },
];

export default function StatusFilterBar({
    value,
    onChange,
}: StatusFilterBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // ดักจับจับคู่ Option (ครอบคลุมเผื่อกรณีมีพิมพ์ใหญ่หลุดเข้ามาด้วยการใช้ toLowerCase)
    const currentOption =
        options.find((o) => o.value.toLowerCase() === value.toLowerCase()) ||
        options[0];

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-surface flex items-center gap-4 px-6 py-3 rounded-xl text-sm transition-all duration-300 shadow-sm hover:shadow-md active:scale-[0.97] cursor-pointer"
            >
                <div>
                    <Droplets size={18} className="text-blue-500" />
                </div>
                <div className="flex flex-col items-start leading-none">
                    <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">
                        คุณภาพน้ำ
                    </span>
                    <span className="font-bold text-text-primary text-xs mt-1.5 flex items-center">
                        {/* 🛠️ เติมคลาสขนาดและรูปทรงกลมของจุดไข่ปลาให้แสดงผลได้ถูกต้องสวยงาม */}
                        <span
                            className={`inline-block mr-2 ${currentOption.dotClass}`}
                        />
                        {currentOption.label}
                    </span>
                </div>
                <ChevronDown
                    size={14}
                    className={`text-text-muted ml-1 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 min-w-[140px] bg-surface rounded-2xl overflow-hidden shadow-xl border border-border animate-slide-down origin-top z-[700]">
                    <div className="p-1.5 flex flex-col gap-0.5">
                        {options.map((option) => {
                            const isSelected =
                                value.toLowerCase() ===
                                option.value.toLowerCase();

                            return (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2.5 cursor-pointer
                    ${
                        isSelected
                            ? "bg-primary/10 text-primary"
                            : "text-text-secondary hover:bg-surface-subtle"
                    }`}
                                >
                                    <span
                                        className={` flex-shrink-0 transition-all 
                      ${option.dotClass} 
                      ${isSelected ? "scale-110 opacity-100" : "scale-90 opacity-60"}`}
                                    />
                                    <span>{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
