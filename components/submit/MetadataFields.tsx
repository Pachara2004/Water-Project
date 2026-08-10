// components/submit/MetadataFields.tsx
import { useState, useRef, useEffect, useMemo } from "react";
import { Clock, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { SectionHead } from "./SharedAtoms";
import { getWeatherConditionLabel } from "@/lib/weather";

interface MetadataFieldsProps {
    collectionTime: string;
    setCollectionTime: (t: string) => void;
    oxygen?: string;
    setOxygen?: (o: string) => void;

    airTemperature?: number | null;
    rainAccumulation?: number | null;
    weatherCondCode?: number | null;
    temperature?: number | null;
    rainVolume?: number | null;
    weatherCondition?: number | null;
    weatherData?: {
        airTemperature?: number | null;
        rainAccumulation?: number | null;
        weatherCondCode?: number | null;
        temperature?: number | null;
        rainVolume?: number | null;
        weatherCondition?: number | null;
    } | null;
}

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const THAI_DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export function MetadataFields(props: MetadataFieldsProps) {
    const { collectionTime, setCollectionTime, weatherData } = props;

    const temp = props.airTemperature ?? props.temperature ?? weatherData?.airTemperature ?? weatherData?.temperature ?? null;
    const rain = props.rainAccumulation ?? props.rainVolume ?? weatherData?.rainAccumulation ?? weatherData?.rainVolume ?? null;
    const cond = props.weatherCondCode ?? props.weatherCondition ?? weatherData?.weatherCondCode ?? weatherData?.weatherCondition ?? null;

    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const { now, minDate, maxDate } = useMemo(() => {
        const currentDate = new Date();
        const min = new Date();
        min.setDate(currentDate.getDate() - 60);
        min.setHours(0, 0, 0, 0);

        return {
            now: currentDate,
            minDate: min,
            maxDate: currentDate,
        };
    }, []);

    const selectedDate = useMemo(() => {
        if (!collectionTime) return new Date();
        const [dPart, tPart] = collectionTime.split("T");
        if (!dPart || !tPart) return new Date();
        const [y, m, d] = dPart.split("-").map(Number);
        const [hh, mm] = tPart.split(":").map(Number);
        return new Date(y, m - 1, d, hh, mm);
    }, [collectionTime]);

    const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

    useEffect(() => {
        setViewYear(selectedDate.getFullYear());
        setViewMonth(selectedDate.getMonth());
    }, [selectedDate]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 🟢 ตรวจสอบว่าสามารถกดถอยหลัง หรือ เดินหน้าเดือน ได้หรือไม่
    const canPrevMonth = useMemo(() => {
        const prevM = new Date(viewYear, viewMonth - 1, 1);
        const lastDayOfPrevM = new Date(viewYear, viewMonth, 0, 23, 59, 59);
        return lastDayOfPrevM >= minDate;
    }, [viewYear, viewMonth, minDate]);

    const canNextMonth = useMemo(() => {
        const firstDayOfNextM = new Date(viewYear, viewMonth + 1, 1, 0, 0, 0);
        return firstDayOfNextM <= maxDate;
    }, [viewYear, viewMonth, maxDate]);

    const updateDateTime = (newD: Date) => {
        let clamped = new Date(newD);
        if (clamped > maxDate) clamped = new Date(maxDate);
        if (clamped < minDate) clamped = new Date(minDate);

        const pad = (n: number) => n.toString().padStart(2, "0");
        const formatted = `${clamped.getFullYear()}-${pad(clamped.getMonth() + 1)}-${pad(clamped.getDate())}T${pad(clamped.getHours())}:${pad(clamped.getMinutes())}`;
        setCollectionTime(formatted);
    };

    const handleSelectDay = (day: number) => {
        const next = new Date(selectedDate);
        next.setFullYear(viewYear, viewMonth, day);
        updateDateTime(next);
    };

    const handleTimeChange = (type: "hour" | "minute", val: number) => {
        const next = new Date(selectedDate);
        if (type === "hour") next.setHours(val);
        if (type === "minute") next.setMinutes(val);
        updateDateTime(next);
    };

    const calendarDays = useMemo(() => {
        const firstDay = new Date(viewYear, viewMonth, 1).getDay();
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        return { firstDay, daysInMonth };
    }, [viewYear, viewMonth]);

    const formattedThaiDisplay = useMemo(() => {
        const d = selectedDate.getDate();
        const mStr = THAI_MONTHS[selectedDate.getMonth()];
        const yBuddha = selectedDate.getFullYear() + 543;
        const pad = (n: number) => n.toString().padStart(2, "0");
        const timeStr = `${pad(selectedDate.getHours())}:${pad(selectedDate.getMinutes())} น.`;

        return `${d} ${mStr} ${yBuddha} เวลา ${timeStr}`;
    }, [selectedDate]);

    return (
        <section className="rounded-xl bg-surface overflow-visible border border-border">
            <div className="text-sm font-semibold">
                <SectionHead icon={<Clock size={16} />} label="ข้อมูลการเก็บตัวอย่าง" />
            </div>

            <div className="p-3.5 sm:p-4 space-y-4">
                <div className="relative" ref={containerRef}>
                    <label className="text-xs text-text-muted block mb-1.5 font-medium">เวลาที่เก็บตัวอย่าง *</label>

                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="w-full px-3 py-2 bg-surface-subtle border border-border rounded-xl text-xs font-semibold text-text flex items-center justify-between hover:border-primary transition-all cursor-pointer min-h-10 select-none"
                    >
                        <div className="flex items-center gap-2">
                            <CalendarIcon size={15} className="text-primary" />
                            <span className="text-xs">{formattedThaiDisplay}</span>
                        </div>
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">เลือกวันเวลา</span>
                    </button>

                    {/* 🟢 ปฏิทินแบบกระชับ (w-72) + ล็อคปุ่มเปลี่ยนเดือนถอยหลัง/ไปหน้าถ้าหลุดช่วง 60 วัน */}
                    {isOpen && (
                        <div className="absolute top-[calc(100%+4px)] left-0 w-72 bg-card-general border border-border rounded-2xl p-3 z-[9999] shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
                            {/* Header เปลี่ยนเดือน */}
                            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-border">
                                <button
                                    type="button"
                                    disabled={!canPrevMonth}
                                    onClick={() => {
                                        if (!canPrevMonth) return;
                                        if (viewMonth === 0) {
                                            setViewMonth(11);
                                            setViewYear(viewYear - 1);
                                        } else setViewMonth(viewMonth - 1);
                                    }}
                                    className={`p-1 rounded-lg transition-all ${canPrevMonth ? "hover:bg-surface-subtle text-text cursor-pointer" : "text-text-muted/20 cursor-not-allowed"}`}
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                <span className="text-xs font-bold text-primary">
                                    {THAI_MONTHS[viewMonth]} {viewYear + 543}
                                </span>

                                <button
                                    type="button"
                                    disabled={!canNextMonth}
                                    onClick={() => {
                                        if (!canNextMonth) return;
                                        if (viewMonth === 11) {
                                            setViewMonth(0);
                                            setViewYear(viewYear + 1);
                                        } else setViewMonth(viewMonth + 1);
                                    }}
                                    className={`p-1 rounded-lg transition-all ${canNextMonth ? "hover:bg-surface-subtle text-text cursor-pointer" : "text-text-muted/20 cursor-not-allowed"}`}
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            {/* หัวสัปดาห์ */}
                            <div className="grid grid-cols-7 gap-1 text-center mb-1">
                                {THAI_DAYS.map((d) => (
                                    <span key={d} className="text-[10px] font-bold text-text-muted">
                                        {d}
                                    </span>
                                ))}
                            </div>

                            {/* ตารางวันที่ */}
                            <div className="grid grid-cols-7 gap-1 text-center mb-3">
                                {Array.from({ length: calendarDays.firstDay }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}

                                {Array.from({ length: calendarDays.daysInMonth }).map((_, i) => {
                                    const dayNum = i + 1;
                                    const targetStart = new Date(viewYear, viewMonth, dayNum, 0, 0, 0);
                                    const targetEnd = new Date(viewYear, viewMonth, dayNum, 23, 59, 59);

                                    const isDisabled = targetEnd > maxDate || targetStart < minDate;
                                    const isSelected = selectedDate.getDate() === dayNum && selectedDate.getMonth() === viewMonth && selectedDate.getFullYear() === viewYear;

                                    return (
                                        <button
                                            key={dayNum}
                                            type="button"
                                            disabled={isDisabled}
                                            onClick={() => handleSelectDay(dayNum)}
                                            className={`h-7 text-xs font-bold rounded-lg transition-all flex items-center justify-center ${
                                                isSelected
                                                    ? "bg-primary text-white shadow-2xs"
                                                    : isDisabled
                                                      ? "text-text-muted/20 cursor-not-allowed opacity-20"
                                                      : "text-text hover:bg-surface-subtle cursor-pointer"
                                            }`}
                                        >
                                            {dayNum}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* เลือกเวลา (24 ชั่วโมง) */}
                            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                                <span className="font-bold text-text-muted text-[11px]">เวลา (24 ชม.):</span>
                                <div className="flex items-center gap-1">
                                    <select
                                        title="ชั่วโมง"
                                        value={selectedDate.getHours()}
                                        onChange={(e) => handleTimeChange("hour", Number(e.target.value))}
                                        className="bg-surface-subtle border border-border text-text rounded-lg text-xs font-bold px-1.5 py-1 focus:border-primary outline-none cursor-pointer font-mono"
                                    >
                                        {Array.from({ length: 24 }).map((_, h) => {
                                            const isToday = selectedDate.toDateString() === now.toDateString();
                                            const disabled = isToday && h > now.getHours();
                                            return (
                                                <option key={h} value={h} disabled={disabled}>
                                                    {h.toString().padStart(2, "0")} น.
                                                </option>
                                            );
                                        })}
                                    </select>

                                    <span className="font-bold text-text text-xs">:</span>

                                    <select
                                        title="นาที"
                                        value={selectedDate.getMinutes()}
                                        onChange={(e) => handleTimeChange("minute", Number(e.target.value))}
                                        className="bg-surface-subtle border border-border text-text rounded-lg text-xs font-bold px-1.5 py-1 focus:border-primary outline-none cursor-pointer font-mono"
                                    >
                                        {Array.from({ length: 60 }).map((_, m) => {
                                            const isToday = selectedDate.toDateString() === now.toDateString();
                                            const disabled = isToday && selectedDate.getHours() === now.getHours() && m > now.getMinutes();
                                            return (
                                                <option key={m} value={m} disabled={disabled}>
                                                    {m.toString().padStart(2, "0")}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="w-full mt-2.5 py-1.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                            >
                                ตกลง
                            </button>
                        </div>
                    )}
                </div>

                {/* กล่องแสดงข้อมูลสภาพอากาศ */}
                <div className="bg-card-general border border-border rounded-2xl p-5 sm:p-6">
                    <h4 className="text-sm font-semibold justify-center flex text-primary mb-4">ข้อมูลสภาพอากาศขณะเก็บตัวอย่าง</h4>

                    <div className="grid grid-cols-1 gap-3 text-center">
                        <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                            <span className="text-xs font-bold text-secondary block uppercase">อุณหภูมิ</span>
                            <span className="text-xl font-bold text-text mt-1 block">{temp !== null && temp !== undefined ? `${Number(temp).toFixed(1)}°C` : "-"}</span>
                        </div>

                        <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                            <span className="text-xs font-bold text-secondary block uppercase">ปริมาณฝน</span>
                            <span className="text-xl font-bold text-text mt-1 block">{rain !== null && rain !== undefined ? `${Number(rain).toFixed(1)} mm` : "-"}</span>
                        </div>

                        <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                            <span className="text-xs font-bold text-secondary block uppercase">สภาพอากาศ</span>
                            <span className="text-xl font-bold text-text mt-1 block truncate">{cond !== null && cond !== undefined ? getWeatherConditionLabel(cond) : "-"}</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
