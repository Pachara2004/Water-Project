"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import { useRouter } from "next/navigation";
import { Camera, FileText, Calendar, Beaker, ImageOff, Search, SlidersHorizontal, ArrowUp, ArrowDown, X, CalendarDays, ChevronDown, Check } from "lucide-react";
import StatusBadge from "@/components/map/StatusBadge";
import NotificationBell from "@/components/NotificationBell";
import { useCollectorFilters, type CollectorSample } from "@/lib/hooks/useCollectorFilters";

const statusOptions = [
    { id: "safe", label: "ปลอดภัย", color: "bg-emerald-500" },
    { id: "warning", label: "เฝ้าระวัง", color: "bg-amber-500" },
    { id: "danger", label: "อันตราย", color: "bg-red-500" },
];

export default function CollectorDashboard() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const [samples, setSamples] = useState<CollectorSample[]>([]);
    const [loading, setLoading] = useState(true);

    // ตัวกรองทั้งหมด + ตาราง + การจำค่าไว้ข้ามการเปิดหน้ารายละเอียด อยู่ในฮุกตัวเดียว
    const { table, showOnlyMine, setShowOnlyMine, globalFilter, setGlobalFilter, selectedStatuses, handleStatusToggle, startDate, setStartDate, endDate, setEndDate, sorting, toggleSortDirection, clearDateRange } =
        useCollectorFilters({ samples, currentUser, loading });

    // ─── State สำหรับควบคุมป็อปอัปช่วงเวลา / Dropdown สถานะ (เรื่อง UI ล้วน ไม่เกี่ยวกับค่าที่ถูกจำ) ───
    const [isDatePanelOpen, setIsDatePanelOpen] = useState(false);
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

    const datePanelRef = useRef<HTMLDivElement>(null);
    const statusMenuRef = useRef<HTMLDivElement>(null);
    const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

    const handleImageError = (sampleId: number) => {
        setImageErrors((prev) => ({ ...prev, [sampleId]: true }));
    };

    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.role !== "collector" && currentUser.role !== "admin" && currentUser.role !== "officer") {
            router.push("/map");
            return;
        }

        fetch("/api/samples", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${liff.getAccessToken()}`,
            },
        })
            .then((res) => {
                if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลประวัติผลน้ำได้");
                return res.json();
            })
            .then((data) => {
                if (Array.isArray(data)) {
                    const mapped = data.map((s: any) => ({
                        id: s.id,
                        locationId: s.locationId,
                        status: s.status,
                        collectedAt: s.collectionTime,
                        collectedBy: s.collectorId,
                        imageUrl: s.rawImageUrl,
                        imagePlotUrl: s.analyzedPlotUrl,
                        isDeleted: s.isDeleted,
                        updatedBy: s.lastModifiedBy,

                        // ดึงก้อนข้อมูลที่ผ่านการสกัด EAV Flattening จาก API มาใช้โดยตรง
                        // เช่น phosphateVal, ammoniaVal จะหลั่งไหลเข้ามาอัตโนมัติ
                        ...s,

                        location: s.location
                            ? {
                                  id: s.locationId,
                                  name: s.location.name,
                                  organization: s.location.organization,
                              }
                            : null,
                    }));
                    setSamples(mapped);
                } else {
                    setSamples([]);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [currentUser, router]);

    // เคลียร์ป็อปอัปต่าง ๆ เมื่อคลิกด้านนอกกล่องควบคุม
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

    const totalFilteredRecords = table.getFilteredRowModel().rows.length;
    const displayedRows = table.getRowModel().rows;
    const pageIndex = table.getState().pagination.pageIndex;
    const pageCount = table.getPageCount();

    const isDateActive = startDate || endDate;

    // ล้างช่วงวันที่จากปุ่มกากบาทบนชิป — ต้องกัน event ไม่ให้ทะลุไปเปิดป็อปอัปปฏิทินซ้ำ
    const handleClearDateRange = (e: React.MouseEvent) => {
        e.stopPropagation();
        clearDateRange();
        setIsDatePanelOpen(false);
    };

    // ข้อความแสดงสถานะบนปุ่มหลัก (กรณีเลือกตัวเดียว หรือเลือกหลายตัว)
    const currentStatusLabel = useMemo(() => {
        if (selectedStatuses.length === 0) return "ทุกสถานะ";
        if (selectedStatuses.length === 1) {
            return statusOptions.find((o) => o.id === selectedStatuses[0])?.label || "ทุกสถานะ";
        }
        return `เลือกแล้ว ${selectedStatuses.length} สถานะ`;
    }, [selectedStatuses]);

    if (loading) {
        return (
            <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
                <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6 animate-pulse">
                    {/* Header Welcome Card Skeleton */}
                    <div className="relative w-full rounded-2xl bg-surface p-5 border border-border flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-2 w-2/3">
                                <div className="h-4 bg-surface-subtle rounded-md w-4/5" />
                                <div className="h-3 bg-surface-subtle rounded-md w-3/5" />
                            </div>
                        </div>
                        <div className="w-full h-11 bg-surface-subtle rounded-xl" />
                    </div>

                    {/* Filter Card Skeleton */}
                    <div className="relative w-full bg-surface rounded-2xl p-4 border border-border">
                        <div className="flex items-center justify-between gap-3 pt-1 px-1">
                            <div className="h-4 bg-surface-subtle rounded-md w-32" />
                            <div className="h-8 bg-surface-subtle rounded-xl w-24" />
                        </div>

                        <div className="space-y-4 mt-6 mb-2">
                            <div className="w-full h-11 bg-surface-subtle rounded-xl" />
                            <div className="flex items-center gap-2.5">
                                <div className="flex-1 h-10 bg-surface-subtle rounded-xl" />
                                <div className="flex-1 h-10 bg-surface-subtle rounded-xl" />
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-border">
                                <div className="h-3 bg-surface-subtle rounded-md w-20" />
                                <div className="h-3 bg-surface-subtle rounded-md w-16" />
                            </div>
                        </div>

                        {/* History Card List Skeleton */}
                        <div className="flex flex-col gap-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="bg-surface rounded-2xl p-3.5 border border-border flex items-start sm:items-center gap-3.5">
                                    <div className="w-14 h-14 rounded-xl bg-surface-subtle shrink-0" />
                                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                                        <div className="flex items-start justify-between gap-4 w-full">
                                            <div className="flex-1 min-w-0 space-y-2">
                                                <div className="h-3.5 bg-surface-subtle rounded-md w-2/3" />
                                                <div className="h-3 bg-surface-subtle rounded-md w-1/3" />
                                            </div>
                                            <div className="h-5 bg-surface-subtle rounded-md w-14 shrink-0" />
                                        </div>
                                        <div className="flex gap-2 mt-1">
                                            <div className="h-5 bg-surface-subtle rounded-md w-12" />
                                            <div className="h-5 bg-surface-subtle rounded-md w-12" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                {/* Header Welcome Card */}
                <div className="relative w-full rounded-2xl bg-card-general p-5 border border-border  flex flex-col gap-4">
                    <div className="flex justify-between items-start gap-3">
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-text">
                                ศูนย์ข้อมูล<span className="text-primary font-extrabold">ตรวจสอบคุณภาพน้ำ</span>
                            </h1>
                            <p className="text-text font-medium text-xs mt-0.5">ระบบตรวจสอบและจัดการข้อมูลคุณภาพน้ำ</p>
                        </div>
                        {/* Officer เป็นสิทธิ์อ่านอย่างเดียว ไม่ได้เป็นคนเก็บตัวอย่างเอง จึงไม่มีการแจ้งเตือนของตัวเองให้ดู */}
                        {currentUser?.role !== "officer" && <NotificationBell />}
                    </div>

                    <button
                        onClick={() => router.push("/submit")}
                        className="w-full py-3 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer text-xs shrink-0"
                    >
                        <Camera size={18} strokeWidth={2.5} />
                        <span>ตรวจคุณภาพน้ำ</span>
                    </button>
                </div>

                {/* โซนกล่องค้นหาและฟิลเตอร์แบบ Dropdown Multi-Select */}

                <div className="relative w-full bg-card-general rounded-2xl p-4 border border-border">
                    {/* แท็บคัดกรอง ข้อมูลของฉัน แบบดั้งเดิม */}
                    <div className="flex items-center justify-between gap-3 pt-1 px-1">
                        <div className="inline-flex items-center gap-1">
                            <FileText size={18} className="text-primary" />
                            <h2 className="text-sm uppercase text-primary font-semibold">ประวัติการส่งตรวจ</h2>
                        </div>

                        {currentUser?.role === "admin" && (
                            <label className="inline-flex items-center gap-2 bg-surface border border-border px-3 py-2 rounded-xl shrink-0 cursor-pointer select-none">
                                <span className="text-xs font-semibold text-black">เฉพาะของฉัน</span>

                                <div className="relative">
                                    {/* Hidden Checkbox ที่เข้าถึงได้ (sr-only) */}
                                    <input type="checkbox" checked={showOnlyMine} onChange={(e) => setShowOnlyMine(e.target.checked)} className="sr-only peer" />

                                    {/* โครงสร้างสวิตช์ Flowbite / Shadcn ตามที่ส่งมา */}
                                    <div className="relative w-9 h-5 bg-surface-subtle peer-focus:outline-hidden peer-focus:ring-1 peer-focus:ring-primary/10 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:start-[2px] after:bg-surface after:border-border after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-secondary" />
                                </div>
                            </label>
                        )}
                    </div>
                    <div className="bg-surface  rounded-2xl  space-y-4 mt-6 mb-2">
                        {/* Input ค้นหาชื่อสถานที่ ทรงรีมน */}
                        <div className="relative w-full flex items-center bg-surface-subtle border border-border rounded-xl px-4 transition-all">
                            <input
                                type="text"
                                placeholder="ค้นหา..."
                                value={globalFilter ?? ""}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                                data-focus-outline="off"
                                className="w-full py-3 bg-surface-subtle text-xs text-black outline-hidden placeholder:text-secondary"
                            />
                            <Search size={18} className="text-secondary ml-2" />
                        </div>

                        {/* แถวแถบปุ่มกดตัวเลือก Dropdown สำหรับ Mobile */}
                        <div className="flex items-center gap-2.5 relative">
                            {/* 1. ปุ่มเปิดตัวเลือกช่วงวันที่ (Date Range Popover) */}
                            <div className="relative flex-1" ref={datePanelRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsDatePanelOpen(!isDatePanelOpen)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-surface border rounded-xl text-xs font-semibold transition-all cursor-pointer  select-none ${
                                        isDateActive ? "border-primary text-black ring-1 ring-primary" : "border-border text-text-secondary hover:bg-surface-subtle"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <SlidersHorizontal size={16} className={isDateActive ? "text-black" : "text-black"} />
                                        <span className="truncate text-black test-xs">{isDateActive ? "กรองช่วงเวลา" : "เลือกวันที่"}</span>
                                    </div>
                                    {isDateActive ? (
                                        <span onClick={handleClearDateRange} className="p-0.5 rounded-full hover:bg-bg text-black flex items-center shrink-0">
                                            <X size={13} strokeWidth={3} />
                                        </span>
                                    ) : (
                                        <ChevronDown size={13} className="text-black shrink-0" />
                                    )}
                                </button>

                                {/* กล่องเลือกช่วงวันที่ */}
                                {isDatePanelOpen && (
                                    <div className="absolute top-[calc(100%+6px)] left-0 w-65 bg-surface border border-border rounded-2xl  p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary mb-3 pb-1 border-b border-border">
                                            <CalendarDays size={13} className="text-primary" />
                                            <span>ระบุช่วงเวลาเก็บตัวอย่าง</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-bold uppercase text-text-muted block mb-1">จากวันที่</label>
                                                <input
                                                    title="start date"
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full text-xs border border-border rounded-lg p-2 bg-surface-subtle focus:outline-hidden focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold uppercase text-text-muted block mb-1">ถึงวันที่</label>
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
                                                    <button onClick={handleClearDateRange} className="text-xs font-bold text-text-muted hover:text-text-secondary px-2 py-1">
                                                        ล้างค่า
                                                    </button>
                                                )}
                                                <button onClick={() => setIsDatePanelOpen(false)} className="text-xs font-bold bg-primary text-white px-3 py-1.5 rounded-lg">
                                                    ตกลง
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 2. ปุ่มเลือกสถานะแบบ Multi-Select Dropdown ที่ต้องการ */}
                            <div className="relative flex-1" ref={statusMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-surface border rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
                                        selectedStatuses.length > 0 ? "border-primary text-black ring-1 ring-primary" : "border-border text-black hover:bg-surface-subtle"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="truncate">{currentStatusLabel}</span>
                                    </div>
                                    <ChevronDown size={13} className="text-black shrink-0" />
                                </button>

                                {/* รายการตัวเลือกสถานะภายในเมนู (Multi-Select Menu) */}
                                {isStatusMenuOpen && (
                                    <div className="absolute top-[calc(100%+6px)] right-0 w-full min-w-40 bg-surface border border-border rounded-2xl p-1.5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                        {/* ลูปรายการสถานะให้สามารถเลือกพร้อมกันได้หลายตัว */}
                                        {statusOptions.map((option) => {
                                            const isChecked = selectedStatuses.includes(option.id);
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => handleStatusToggle(option.id)}
                                                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                                        isChecked ? "bg-surface-subtle text-black" : "text-text-secondary hover:bg-surface-subtle"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {/* กล่องติ๊กถูกจำลองรูปทรงกลมตามสีสถานะ */}
                                                        <div
                                                            className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center transition-all ${
                                                                isChecked ? "border-primary bg-primary text-white" : "border-border bg-surface"
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

                        {/* สรุปข้อมูลผลลัพธ์และระบบสลับ ล่าสุด/เก่าสุด */}
                        <div className="flex items-center justify-between text-xs text-text-muted  px-0.5 pt-1 border-t border-border">
                            <div className="text-black">พบ {totalFilteredRecords} รายการ</div>

                            <div onClick={toggleSortDirection} className="flex items-center gap-1 cursor-pointer hover:text-black text-black transition-colors py-0.5 select-none">
                                <span>{sorting[0]?.id === "collectedAt" && sorting[0]?.desc ? "ล่าสุด" : "เก่าสุด"}</span>
                                <div className="flex items-center text-text-muted">
                                    {sorting[0]?.id === "collectedAt" && (sorting[0]?.desc ? <ArrowDown size={13} className="text-black" /> : <ArrowUp size={13} className="text-black" />)}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Content Core Render */}
                    {(() => {
                        if (totalFilteredRecords === 0) {
                            return (
                                <div className="text-center p-10 bg-surface rounded-2xl border border-border flex flex-col items-center justify-center">
                                    <div className="w-10 h-10 bg-surface-subtle rounded-xl flex items-center justify-center mb-3 text-text-muted border border-border">
                                        <FileText size={18} />
                                    </div>
                                    <p className="text-text-primary font-bold text-xs">ไม่พบข้อมูลประวัติ</p>
                                    <p className="text-xs text-text-muted mt-1 max-w-xs leading-relaxed">ไม่พบผลลัพธ์ประวัติที่ตรงกับเงื่อนไขการเลือกหลายสถานะ หรือช่วงเวลาที่กำหนดไว้ครับ</p>
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-4">
                                {/* รายการประวัติแบบการ์ดประมวลผล */}
                                <div className="flex flex-col gap-3">
                                    {displayedRows.map((row) => {
                                        const sample = row.original;
                                        const hasImageError = imageErrors[sample.id];

                                        return (
                                            <div
                                                key={sample.id}
                                                onClick={() => router.push(`/collector/history/${sample.id}`)}
                                                className="bg-surface rounded-2xl p-3.5 border border-border active:scale-[0.99] transition-all flex items-start sm:items-center gap-3.5 cursor-pointer group min-w-0"
                                            >
                                                {/* รูปภาพ - ล็อกขนาดไม่ให้โดนบีบ */}
                                                <div className="w-14 h-14 rounded-xl bg-surface-subtle border border-border shrink-0 overflow-hidden flex items-center justify-center relative transition-all">
                                                    {sample.imageUrl && !hasImageError ? (
                                                        <img
                                                            src={sample.imageUrl}
                                                            alt="sample data"
                                                            onError={() => handleImageError(sample.id)}
                                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                                                        />
                                                    ) : (
                                                        <ImageOff size={15} className="text-text-muted" />
                                                    )}
                                                </div>

                                                {/* ฝั่งเนื้อหาข้อมูล - ถอด h-15 ออกเพื่อให้ขยายแนวตั้งได้ตามจริง */}
                                                <div className="flex-1 min-w-0 flex flex-col ">
                                                    {/* แถวบน: ชื่อสถานที่ และ สถานะ */}
                                                    <div className="flex items-start justify-between gap-4 w-full">
                                                        {/* ฝั่งซ้าย: ชื่อสถานที่ + วันที่ */}
                                                        <div className="flex-1 min-w-0">
                                                            {/* แสดงบรรทัดเดียวแล้วตัดด้วย ... */}
                                                            <h4 className="font-semibold text-sm text-text-primary text-left truncate">{sample.location?.name || "ไม่ทราบสถานที่"}</h4>

                                                            {/* แถวกลาง: เมทาดาต้า วันที่ */}
                                                            <div className="flex flex-wrap items-center text-xs text-text-muted font-medium">
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <Calendar size={14} className="text-text-muted shrink-0" />
                                                                    <span>
                                                                        {new Date(sample.collectedAt).toLocaleDateString("th-TH", {
                                                                            day: "numeric",
                                                                            month: "short",
                                                                            year: "2-digit",
                                                                        })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* ฝั่งขวา: Badge สถานะ ขยับไปชิดขวาสุดเสมอ */}
                                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                                            <StatusBadge status={sample.status} size="sm" />
                                                            {sample.reviewStatus === "PENDING" && (
                                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                                                                    รออนุมัติ
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* แถวล่าง: ค่าสารเคมี - เอา grid และ justify-end ออกเพื่อให้ชิดซ้ายตามปกติ */}
                                                    <div className="flex flex-wrap items-center gap-2 mt-1 w-full">
                                                        {[
                                                            { key: "phosphateVal", label: "P", color: "text-teal-500" },
                                                            { key: "ammoniaVal", label: "N", color: "text-purple-500" },
                                                            // อนาคตเพิ่มสารใหม่ใน DB แค่มาหยอดบรรทัดเพิ่มตรงนี้ได้เลย
                                                        ].map((indicator) => {
                                                            const value = sample[indicator.key];
                                                            if (value === undefined || value === null) return null;

                                                            return (
                                                                <div
                                                                    key={indicator.key}
                                                                    className="flex items-center gap-1 bg-surface-subtle px-2 py-1 rounded-md text-xs font-semibold text-text-secondary shrink-0"
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
                                        );
                                    })}
                                </div>

                                {/* Pagination Controls */}
                                {pageCount > 1 && (
                                    <div className="flex items-center justify-between border-t border-border pt-4 mt-2 select-none">
                                        <div className="text-xs text-text-muted font-medium">
                                            หน้า <span className="font-bold text-text-primary">{pageIndex + 1}</span> จาก <span className="font-bold text-text-primary">{pageCount}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                disabled={!table.getCanPreviousPage()}
                                                onClick={() => table.previousPage()}
                                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-border bg-surface text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
                                            >
                                                ก่อนหน้า
                                            </button>
                                            <button
                                                disabled={!table.getCanNextPage()}
                                                onClick={() => table.nextPage()}
                                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-border bg-surface text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer "
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
        </div>
    );
}
