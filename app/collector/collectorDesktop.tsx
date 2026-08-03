"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Camera, FileText, Calendar, Beaker, Search, SlidersHorizontal, ArrowUp, ArrowDown, X, CalendarDays, ChevronDown, Check, ArrowLeft, FileScan, MapPin } from "lucide-react";
import StatusBadge from "@/components/map/StatusBadge";
import NotificationBell from "@/components/NotificationBell";
import { CollectorProps } from "./collectorMobile";

const statusOptions = [
    { id: "safe", label: "ปลอดภัย", color: "bg-bg-safe" },
    { id: "warning", label: "เฝ้าระวัง", color: "bg-bg-warning" },
    { id: "danger", label: "อันตราย", color: "bg-bg-danger" },
];

export default function CollectorDesktop(props: CollectorProps) {
    const { currentUser } = useAppStore();
    const router = useRouter();

    const {
        samples,
        total,
        page,
        totalPages,
        setPage,
        showOnlyMine,
        setShowOnlyMine,
        globalFilter,
        setGlobalFilter,
        selectedStatuses,
        handleStatusToggle,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        sortDesc,
        toggleSortDirection,
        clearDateRange,
    } = props;

    const [isDatePanelOpen, setIsDatePanelOpen] = useState(false);
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

    const datePanelRef = useRef<HTMLDivElement>(null);
    const statusMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (datePanelRef.current && !datePanelRef.current.contains(event.target as Node)) {
                setIsDatePanelOpen(false);
            }
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
                setIsStatusMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isDateActive = Boolean(startDate || endDate);

    const handleClearDateRange = (e: React.MouseEvent) => {
        e.stopPropagation();
        clearDateRange();
        setIsDatePanelOpen(false);
    };

    const currentStatusLabel = useMemo(() => {
        if (selectedStatuses.length === 0) return "ทุกสถานะ";
        if (selectedStatuses.length === 1) {
            return statusOptions.find((o) => o.id === selectedStatuses[0])?.label || "ทุกสถานะ";
        }
        return `เลือกแล้ว ${selectedStatuses.length} สถานะ`;
    }, [selectedStatuses]);

    return (
        <div className="min-h-dvh w-full bg-bg pb-12 antialiased transition-colors duration-300">
            {/* ── Top Header Bar ── */}
            <header className="bg-card-general border-b border-border sticky top-0 z-20">
                <div className="w-full px-4 h-13 flex items-center justify-between relative">
                    {/* ฝั่งซ้าย: ปุ่มย้อนกลับ */}
                    <div className="flex items-center gap-3 z-10">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-xs font-medium text-tex hover:text-primary px-2.5 py-1.5 rounded-lg hover:bg-surface-subtle transition-all cursor-pointer"
                        >
                            <ArrowLeft size={16} />
                            <span>ย้อนกลับ</span>
                        </button>
                    </div>

                    {/* ตรงกลาง: หัวข้อ (อยู่ตรงกลางของ Header เสมอ) */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <h1 className="text-sm font-medium text-text pointer-events-auto">ระบบส่งตรวจคุณภาพน้ำ</h1>
                    </div>

                    {/* ฝั่งขวา: Spacer เพื่อความสมดุล */}
                    <div className="w-20" />
                </div>
            </header>

            {/* ── Main Content Container ── */}
            <main className="w-full mx-auto p-4">
                <div className="w-full mx-auto space-y-4">
                    {/* Top Dashboard Welcome Banner */}
                    <div className="relative w-full rounded-2xl bg-card-general p-5 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="">
                            <h2 className="text-xl font-medium tracking-tight text-text">
                                ศูนย์ข้อมูล<span className="text-primary font-medium">ตรวจสอบคุณภาพน้ำ</span>
                            </h2>
                            <p className="text-text font-medium text-xs">ระบบตรวจสอบและจัดการข้อมูลคุณภาพน้ำ</p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
                            {currentUser?.role !== "officer" && <NotificationBell />}
                            <button
                                onClick={() => router.push("/submit")}
                                className="p-3.5 bg-primary hover:bg-primary/95 text-card-general font-medium rounded-xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all cursor-pointer text-xs shadow-xs"
                            >
                                <Camera size={18} strokeWidth={2.5} />
                                <span>ตรวจคุณภาพน้ำ</span>
                            </button>
                        </div>
                    </div>

                    {/* Filter & Search Dashboard Workbench */}
                    <div className="relative w-full bg-card-general border border-border rounded-2xl p-5 space-y-4">
                        {/* Title Bar & Toggle */}
                        <div className="flex items-center justify-between gap-4  border-border mb-4">
                            <div className="inline-flex items-center gap-2">
                                <FileText size={20} className="text-primary" />
                                <h3 className="text-sm text-primary font-medium">ประวัติการส่งตรวจ</h3>
                            </div>

                            {currentUser?.role === "admin" && (
                                <label className="inline-flex items-center gap-2.5 bg-surface-subtle border border-border px-3.5 py-1.5 rounded-xl shrink-0 cursor-pointer select-none hover:bg-surface transition-all">
                                    <span className="text-xs font-medium text-text">เฉพาะของฉัน</span>
                                    <div className="relative">
                                        <input type="checkbox" checked={showOnlyMine} onChange={(e) => setShowOnlyMine(e.target.checked)} className="sr-only peer" />
                                        <div className="relative w-9 h-5 bg-card-general border border-border peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-secondary after:border-border after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-secondary/20" />
                                    </div>
                                </label>
                            )}
                        </div>

                        {/* Desktop Search & Filters Toolbar */}
                        <div className="grid grid-cols-12 gap-3 items-center">
                            {/* 1. Search Box */}
                            <div className="col-span-12 lg:col-span-6 relative flex items-center bg-surface-subtle border border-border rounded-xl px-4 transition-all focus-within:border-primary">
                                <input
                                    type="text"
                                    placeholder="ค้นหาชื่อสถานที่ หรือข้อมูล..."
                                    value={globalFilter ?? ""}
                                    onChange={(e) => setGlobalFilter(e.target.value)}
                                    className="w-full py-2.5 bg-transparent text-xs text-text outline-hidden placeholder:text-secondary"
                                />
                                <Search size={16} className="text-secondary ml-2 shrink-0" />
                            </div>

                            {/* 2. Date Range Popover Button */}
                            <div className="col-span-6 lg:col-span-3 relative" ref={datePanelRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsDatePanelOpen(!isDatePanelOpen)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-card-general border rounded-xl text-xs font-medium transition-all cursor-pointer select-none ${
                                        isDateActive ? "border-primary text-text ring-1 ring-primary" : "border-border text-secondary hover:bg-surface-subtle"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <SlidersHorizontal size={15} className="text-text shrink-0" />
                                        <span className="truncate text-text text-xs">{isDateActive ? "กรองช่วงเวลา" : "เลือกวันที่"}</span>
                                    </div>
                                    {isDateActive ? (
                                        <span onClick={handleClearDateRange} className="p-0.5 rounded-full hover:bg-bg text-text flex items-center shrink-0">
                                            <X size={13} strokeWidth={3} />
                                        </span>
                                    ) : (
                                        <ChevronDown size={13} className="text-text shrink-0" />
                                    )}
                                </button>

                                {isDatePanelOpen && (
                                    <div className="absolute top-[calc(100%+6px)] left-0 w-72 bg-card-general border border-border rounded-2xl p-4 z-50 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-3 pb-1 border-b border-border">
                                            <CalendarDays size={14} className="text-primary" />
                                            <span>ระบุช่วงเวลาเก็บตัวอย่าง</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[11px] font-medium uppercase text-text block mb-1">จากวันที่</label>
                                                <input
                                                    title="start date"
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full text-xs border border-border rounded-lg p-2 bg-surface-subtle focus:outline-hidden focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-medium uppercase text-text block mb-1">ถึงวันที่</label>
                                                <input
                                                    title="end date"
                                                    type="date"
                                                    value={endDate}
                                                    min={startDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className="w-full text-xs border border-border rounded-lg p-2 bg-surface-subtle focus:outline-hidden focus:border-primary"
                                                />
                                            </div>
                                            <div className="flex justify-end gap-2 pt-1">
                                                {(startDate || endDate) && (
                                                    <button onClick={handleClearDateRange} className="text-xs font-medium text-text hover:text-text-secondary px-2 py-1 cursor-pointer">
                                                        ล้างค่า
                                                    </button>
                                                )}
                                                <button onClick={() => setIsDatePanelOpen(false)} className="text-xs font-medium bg-primary text-card-general px-3 py-1.5 rounded-lg cursor-pointer">
                                                    ตกลง
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 3. Multi-Select Status Dropdown */}
                            <div className="col-span-6 lg:col-span-3 relative" ref={statusMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-card-general border rounded-xl text-xs font-medium transition-all cursor-pointer select-none ${
                                        selectedStatuses.length > 0 ? "border-primary text-text ring-1 ring-primary" : "border-border text-text hover:bg-surface-subtle"
                                    }`}
                                >
                                    <span className="truncate">{currentStatusLabel}</span>
                                    <ChevronDown size={13} className="text-text shrink-0" />
                                </button>

                                {isStatusMenuOpen && (
                                    <div className="absolute top-[calc(100%+6px)] right-0 w-full bg-card-general border border-border rounded-2xl p-1.5 z-50 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
                                        {statusOptions.map((option) => {
                                            const isChecked = selectedStatuses.includes(option.id);
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => handleStatusToggle(option.id)}
                                                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-all cursor-pointer ${
                                                        isChecked ? "bg-surface-subtle text-text" : "text-text-secondary hover:bg-surface-subtle/50"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className={`w-3.5 h-3.5 border rounded-xs flex items-center justify-center transition-all ${
                                                                isChecked ? "border-primary bg-primary text-card-general" : "border-border bg-card-general"
                                                            }`}
                                                        >
                                                            {isChecked && <Check size={10} strokeWidth={4} />}
                                                        </div>
                                                        <span>{option.label}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Summary & Sort Order */}
                        <div className="flex items-center justify-between text-xs text-text-muted pt-3 border-t border-border">
                            <div className="text-text font-medium">
                                พบทั้งหมด <span className="font-medium text-primary">{total}</span> รายการ
                            </div>

                            <button onClick={toggleSortDirection} className="flex items-center gap-1.5 cursor-pointer hover:text-text text-text transition-colors py-0.5 select-none font-medium">
                                <span>เรียงตาม: {sortDesc ? "ล่าสุดไปเก่าสุด" : "เก่าสุดไปล่าสุด"}</span>
                                {sortDesc ? <ArrowDown size={14} className="text-primary" /> : <ArrowUp size={14} className="text-primary" />}
                            </button>
                        </div>

                        {/* Records Render Area */}
                        {(() => {
                            if (total === 0) {
                                return (
                                    <div className="text-center p-12 bg-surface-subtle/40 rounded-2xl border border-border flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 bg-card-general rounded-2xl flex items-center justify-center mb-3 text-text-muted border border-border shadow-xs">
                                            <FileText size={20} />
                                        </div>
                                        <p className="text-text font-medium text-sm">ไม่พบข้อมูลประวัติ</p>
                                        <p className="text-xs text-text-muted mt-1 max-w-sm leading-relaxed">ไม่พบผลลัพธ์ประวัติที่ตรงกับเงื่อนไขการเลือกหลายสถานะ หรือช่วงเวลาที่กำหนดไว้ครับ</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="space-y-6">
                                    {/* Desktop Grid Layout: 2 Columns */}
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                        {samples.map((sample) => {

                                            return (
                                                <div
                                                    key={sample.id}
                                                    onClick={() => router.push(`/collector/history/${sample.id}`)}
                                                    className="bg-card-general shadow-xs rounded-2xl p-3.5 border border-border active:scale-[0.99] transition-all flex items-start sm:items-center gap-3.5 cursor-pointer group min-w-0"
                                                >
                                                    {/* ฝั่งเนื้อหาข้อมูล - ถอด h-15 ออกเพื่อให้ขยายแนวตั้งได้ตามจริง */}
                                                    <div className="flex-1 min-w-0 flex flex-col ">
                                                        {/* แถวบน: ชื่อสถานที่ และ สถานะ */}
                                                        <div className="flex items-start justify-between gap-4 w-full">
                                                            {/* ฝั่งซ้าย: ชื่อสถานที่ + วันที่ */}
                                                            <div className="flex-1 min-w-0">
                                                                {/* จัดให้อยู่ตรงกลางแนวตั้งด้วย items-center */}
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    {/* ไอคอน MapPin อยู่ตรงกลางแนวตั้งขนานกับกลุ่มข้อความ */}
                                                                    <MapPin size={36} className="text-primary shrink-0" />

                                                                    {/* กลุ่มข้อความ ชื่อสถานที่, วันที่ และค่าสารเคมี */}
                                                                    <div className="flex-1 min-w-0">
                                                                        <h4 className="font-semibold text-sm text-text">{sample.location?.name || "ไม่ทราบสถานที่"}</h4>
                                                                        {/* แถวกลาง: เมทาดาต้า วันที่ */}
                                                                        <div className="flex flex-wrap items-center text-xs text-text-muted font-medium mt-0.5 gap-2">
                                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                                <FileScan size={13} className="text-text-muted shrink-0" />
                                                                                <span className="leading-none">{sample.code}</span>
                                                                            </div>

                                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                                <Calendar size={13} className="text-text-muted shrink-0" />
                                                                                <span className="leading-none">
                                                                                    {new Date(sample.collectedAt).toLocaleDateString("th-TH", {
                                                                                        day: "numeric",
                                                                                        month: "short",
                                                                                        year: "2-digit",
                                                                                    })}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        {/* แถวล่าง: แสดงค่าสารเคมี */}
                                                                        <div className="flex items-center gap-2 mt-1 w-full">
                                                                            {[
                                                                                { key: "phosphateVal", label: "P", color: "text-teal-500" },
                                                                                { key: "ammoniaVal", label: "N", color: "text-purple-500" },
                                                                            ].map((indicator) => {
                                                                                const value = sample[indicator.key];
                                                                                if (value === undefined || value === null) return null;

                                                                                return (
                                                                                    <div
                                                                                        key={indicator.key}
                                                                                        className="flex items-center gap-1 bg-surface-subtle px-2 py-1 rounded-md text-xs font-semibold text-text shrink-0"
                                                                                    >
                                                                                        <Beaker size={10} className={indicator.color} />
                                                                                        <span>
                                                                                            {indicator.label}: {Number(value).toFixed(2)}
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* ฝั่งขวา: Badge สถานะ ขยับไปชิดขวาสุดเสมอ */}
                                                            <div className="flex flex-col items-end text-center gap-1 shrink-0">
                                                                <StatusBadge status={sample.status} size="sm" />
                                                                {sample.reviewStatus === "PENDING" && (
                                                                    <span className="inline-flex items-center w-20 text-xs font-semibold text-text-warning bg-bg-warning border border-border-warning p-1 justify-center rounded-md whitespace-nowrap">
                                                                        รอตรวจสอบ
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Pagination Bar */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between border-t border-border pt-4 select-none">
                                            <div className="text-xs text-text-muted font-medium">
                                                หน้า <span className="font-medium text-text">{page}</span> จาก <span className="font-medium text-text">{totalPages}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    disabled={page <= 1}
                                                    onClick={() => setPage(page - 1)}
                                                    className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-card-general text-text hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                                >
                                                    ก่อนหน้า
                                                </button>
                                                <button
                                                    disabled={page >= totalPages}
                                                    onClick={() => setPage(page + 1)}
                                                    className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-card-general text-text hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                                >
                                                    ถัดไป
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </main>
        </div>
    );
}
