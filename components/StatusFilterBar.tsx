"use client";

import { Droplets, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface StatusFilterBarProps {
  value: string;
  onChange: (value: string) => void;
}

const options = [
  { value: "ALL", label: "ทุกสถานะ", dotClass: "bg-primary" },
  { value: "SAFE", label: "ปลอดภัย", dotClass: "bg-emerald-500" },
  { value: "WARNING", label: "เฝ้าระวัง", dotClass: "bg-amber-500" },
  { value: "DANGER", label: "อันตราย", dotClass: "bg-red-500" },
];

export default function StatusFilterBar({
  value,
  onChange,
}: StatusFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = options.find((o) => o.value === value) || options[0];

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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-surface/90 backdrop-blur-xl border border-border/80 flex items-center gap-4 px-6 py-4 rounded-full text-sm transition-all duration-300 shadow-sm hover:shadow-md active:scale-[0.97] cursor-pointer"
      >
        <div className="bg-blue-500/10 p-1.5 rounded-full">
          <Droplets size={14} className="text-blue-500" />
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">
            คุณภาพน้ำ
          </span>
          <span className="font-extrabold text-text-primary text-xs mt-0.5 flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${currentOption.dotClass}`}
            ></span>
            {currentOption.label}
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
                  className={`w-1.5 h-1.5 rounded-full ${option.dotClass} transition-all ${value === option.value ? "scale-100" : "scale-75 opacity-50"}`}
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
