"use client";

import { Filter, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface FilterBarProps {
  value: string;
  onChange: (value: string) => void;
}

// กำหนด Type สำหรับ Option
interface Option {
  value: string;
  label: string;
}

export default function FilterBar({ value, onChange }: FilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // สร้าง State สำหรับเก็บตัวเลือก โดยมี "ทั้งหมด" เป็นค่าเริ่มต้น
  const [options, setOptions] = useState<Option[]>([
    { value: "ALL", label: "ทั้งหมด" },
  ]);

  // ดึงข้อมูล Agency จาก API ตอนโหลด Component
  useEffect(() => {
    async function fetchAgencies() {
      try {
        const response = await fetch("/api/locations");
        if (!response.ok) throw new Error("Failed to fetch locations");

        const data = await response.json();

        // สกัดเอาชื่อหน่วยงานที่ไม่ซ้ำกัน และกรองค่าว่างออก
        const uniqueAgencies = Array.from(
          new Set(data.map((loc: any) => loc.organization).filter(Boolean)),
        ) as string[];

        // สร้าง options ใหม่จากข้อมูลใน Database
        const dynamicOptions: Option[] = uniqueAgencies.map((agency) => ({
          value: agency,
          label: agency, // ถ้า Database เก็บเป็นชื่อภาษาไทยอยู่แล้ว ใช้ค่าเดียวกันได้เลย
        }));

        // นำไปรวมกับ option "ทั้งหมด"
        setOptions([{ value: "ALL", label: "ทั้งหมด" }, ...dynamicOptions]);
      } catch (error) {
        console.error("Error fetching agencies:", error);
      }
    }

    fetchAgencies();
  }, []);

  const currentLabel =
    options.find((o) => o.value === value)?.label || "ทั้งหมด";

  // จัดการการคลิกนอก Dropdown
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-4 lg:left-[96px] z-[600]"
      ref={dropdownRef}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-surface/90 backdrop-blur-xl border border-border/80 flex items-center gap-4 px-6 py-4 rounded-full text-sm transition-all duration-300 shadow-sm hover:shadow-md active:scale-[0.97] cursor-pointer"
      >
        <div className="bg-primary/10 p-1.5 rounded-full">
          <Filter size={14} className="text-primary" />
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">
            หน่วยงาน
          </span>
          <span className="font-extrabold text-text-primary text-xs mt-0.5">
            {currentLabel}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-text-muted ml-1 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-56 bg-surface/90 backdrop-blur-xl border border-border/80 rounded-2xl shadow-xl overflow-hidden animate-slide-down origin-top">
          <div className="p-1.5">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-5 py-4 rounded-xl text-left text-xs font-bold transition-all duration-200 flex items-center gap-4 cursor-pointer ${
                  value === option.value
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-surface-subtle"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full transition-all ${value === option.value ? "bg-primary scale-100" : "bg-transparent scale-0"}`}
                />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
