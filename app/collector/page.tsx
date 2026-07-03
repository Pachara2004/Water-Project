"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import { useRouter } from "next/navigation";
import { Camera, FileText, FlaskConical, MapPin, Calendar, Beaker, ImageOff, Search, SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown, X, CalendarDays, ChevronDown, Check } from "lucide-react"; /* prettier-ignore */

// ─── Import TanStack Table Core ───
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, ColumnFiltersState, SortingState } from "@tanstack/react-table";

import StatusBadge from "@/components/map/StatusBadge";

interface CollectorSample {
    id: number;
    locationId: number;
    status: "safe" | "warning" | "danger";
    collectedAt: string | Date;
    collectedBy: number;
    imageUrl?: string | null;
    imagePlotUrl?: string | null;
    phosphateVal?: number | null;
    ammoniaVal?: number | null;
    isDeleted: boolean;
    updatedBy?: number | null;
    location?: {
        id: number;
        name: string;
        organization: string;
    } | null;
}

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
    const [showOnlyMine, setShowOnlyMine] = useState(true);

    // ─── TanStack Table States ───
    const [globalFilter, setGlobalFilter] = useState("");
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [sorting, setSorting] = useState<SortingState>([{ id: "collectedAt", desc: true }]);

    // ─── State สำหรับระบบ Multi-Select สถานะ (เก็บเป็น Array) ───
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

    // ─── States สำหรับระบบควบคุมช่วงเวลา (Date Range) ───
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [isDatePanelOpen, setIsDatePanelOpen] = useState(false);

    // ─── State สำหรับควบคุม Dropdown เลือกสถานะ ───
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

    const datePanelRef = useRef<HTMLDivElement>(null);
    const statusMenuRef = useRef<HTMLDivElement>(null);
    const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

    const handleImageError = (sampleId: number) => {
        setImageErrors((prev) => ({ ...prev, [sampleId]: true }));
    };

    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.role !== "collector" && currentUser.role !== "admin") {
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
                        phosphateVal: s.phosphateValue,
                        ammoniaVal: s.ammoniaValue,
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

    // ─── 1. เตรียมข้อมูล Data Source หลัก ───
    const tableData = useMemo(() => {
        return samples.filter((s) => !s.isDeleted).filter((s) => !showOnlyMine || s.collectedBy === currentUser?.id);
    }, [samples, showOnlyMine, currentUser]);

    // ─── 2. นิยามโครงสร้าง Columns พร้อม Custom Filter ฟังก์ชัน ───
    const columns = useMemo(
        () => [
            {
                accessorKey: "status",
                header: "สถานะ",
                // ฟังก์ชันคัดกรองแบบ Multi-select ตรวจสอบจาก Array
                filterFn: (row: any, columnId: string, filterValue: string[]) => {
                    if (!filterValue || filterValue.length === 0) return true;
                    const rowStatus = row.getValue(columnId) as string;
                    return filterValue.includes(rowStatus.toLowerCase());
                },
            },
            {
                accessorFn: (row: CollectorSample) => row.location?.name || "",
                id: "locationName",
                header: "ชื่อสถานที่",
            },
            {
                accessorKey: "collectedAt",
                header: "วันที่เก็บตัวอย่าง",
                filterFn: (row: any, columnId: string, filterValue: [string, string]) => {
                    const [start, end] = filterValue;
                    if (!start && !end) return true;

                    const rowDateStr = new Date(row.getValue(columnId)).toISOString().split("T")[0];
                    const rowTime = new Date(rowDateStr).getTime();

                    const startTime = start ? new Date(start).getTime() : -Infinity;
                    const endTime = end ? new Date(end).getTime() : Infinity;

                    return rowTime >= startTime && rowTime <= endTime;
                },
            },
        ],
        [],
    );

    // ─── 3. เรียกใช้งาน TanStack Table Engine ───
    const table = useReactTable({
        data: tableData,
        columns,
        state: {
            globalFilter,
            columnFilters,
            sorting,
        },
        onGlobalFilterChange: setGlobalFilter,
        onColumnFiltersChange: setColumnFilters,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            pagination: {
                pageSize: 10,
            },
        },
    });

    // ส่งฟิลเตอร์ช่วงวันที่เข้า TanStack
    useEffect(() => {
        if (startDate || endDate) {
            table.getColumn("collectedAt")?.setFilterValue([startDate, endDate]);
        } else {
            table.getColumn("collectedAt")?.setFilterValue(undefined);
        }
        table.setPageIndex(0);
    }, [startDate, endDate, table]);

    // จัดการการกดย้อนกลับ/ติ๊กเลือกสถานะแบบ Multi-Select
    const handleStatusToggle = (status: string) => {
        let updatedStatuses: string[];

        if (selectedStatuses.includes(status)) {
            // ถ้าเลือกอยู่แล้ว -> ติ๊กออก
            updatedStatuses = selectedStatuses.filter((s) => s !== status);
        } else {
            // ถ้ายังไม่เลือก -> เพิ่มเข้า Array
            updatedStatuses = [...selectedStatuses, status];
        }

        setSelectedStatuses(updatedStatuses);

        // ส่ง Array ไปอัปเดตตัวกรองคอลัมน์ใน TanStack Table
        if (updatedStatuses.length === 0) {
            table.getColumn("status")?.setFilterValue(undefined);
        } else {
            table.getColumn("status")?.setFilterValue(updatedStatuses);
        }
        table.setPageIndex(0);
    };

    const clearDateRange = (e: React.MouseEvent) => {
        e.stopPropagation();
        setStartDate("");
        setEndDate("");
        setIsDatePanelOpen(false);
    };

    const toggleSortDirection = () => {
        const isDesc = sorting[0]?.id === "collectedAt" && sorting[0]?.desc;
        setSorting([{ id: "collectedAt", desc: !isDesc }]);
    };

    const totalFilteredRecords = table.getFilteredRowModel().rows.length;
    const displayedRows = table.getRowModel().rows;
    const pageIndex = table.getState().pagination.pageIndex;
    const pageCount = table.getPageCount();

    const isDateActive = startDate || endDate;

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
            <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-[#f4f6f8] pb-24 text-gray-900 antialiased selection:bg-primary/10">
            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                {/* Header Welcome Card */}
                <div className="relative w-full rounded-2xl bg-white p-5 border border-gray-200/50 shadow-xs flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-gray-900">
                                ศูนย์ข้อมูล<span className="text-primary font-extrabold">ตรวจสอบคุณภาพน้ำ</span>
                            </h1>
                            <p className="text-black font-medium text-xs mt-0.5">ระบบตรวจสอบและจัดการข้อมูลคุณภาพน้ำ</p>
                        </div>
                        {currentUser?.pictureUrl && <img src={currentUser.pictureUrl} alt="profile" className="w-9 h-9 rounded-full border border-gray-100" />}
                    </div>

                    <button
                        onClick={() => router.push("/submit")}
                        className="w-full py-3 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer text-xs shrink-0"
                    >
                        <Camera size={16} strokeWidth={2.5} />
                        <span>ตรวจคุณภาพน้ำ</span>
                    </button>
                </div>

                {/* โซนกล่องค้นหาและฟิลเตอร์แบบ Dropdown Multi-Select */}

                <div className="relative w-full bg-surface rounded-2xl p-4 border border-border">
                    {/* แท็บคัดกรอง ข้อมูลของฉัน แบบดั้งเดิม */}
                    <div className="flex items-center justify-between gap-3 pt-1 px-1">
                        <div className="inline-flex items-center gap-1.5">
                            <FileText size={18} className="text-primary" />
                            <h2 className="text-sm uppercase text-primary font-bold tracking-wider">ประวัติการส่งตรวจน้ำ</h2>
                        </div>

                        <label className="inline-flex items-center gap-2 bg-white border border-gray-200/80 px-3 py-2 rounded-xl shrink-0 cursor-pointer select-none">
                            <span className="text-xs font-semibold text-slate">เฉพาะของฉัน</span>

                            <div className="relative">
                                {/* Hidden Checkbox ที่เข้าถึงได้ (sr-only) */}
                                <input type="checkbox" checked={showOnlyMine} onChange={(e) => setShowOnlyMine(e.target.checked)} className="sr-only peer" />

                                {/* โครงสร้างสวิตช์ Flowbite / Shadcn ตามที่บอสส่งมา */}
                                <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-hidden peer-focus:ring-1 peer-focus:ring-primary/10 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                            </div>
                        </label>
                    </div>
                    <div className="bg-white  rounded-2xl  space-y-4 mt-6 mb-2">
                        {/* Input ค้นหาชื่อสถานที่ ทรงรีมน */}
                        <div className="relative w-full flex items-center bg-[#f8f9fa] border border-gray-200/80 rounded-xl px-4 transition-all">
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อสถานที่..."
                                value={globalFilter ?? ""}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                                className="w-full py-3 bg-transparent text-xs text-gray-900 outline-hidden placeholder:text-gray-400/80"
                            />
                            <Search size={16} className="text-gray-400 ml-2" />
                        </div>

                        {/* แถวแถบปุ่มกดตัวเลือก Dropdown สำหรับ Mobile */}
                        <div className="flex items-center gap-2.5 relative">
                            {/* 1. ปุ่มเปิดตัวเลือกช่วงวันที่ (Date Range Popover) */}
                            <div className="relative flex-1" ref={datePanelRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsDatePanelOpen(!isDatePanelOpen)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-white border rounded-xl text-xs font-semibold transition-all cursor-pointer  select-none ${
                                        isDateActive ? "border-black text-black ring-1 ring-black" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <SlidersHorizontal size={13} className={isDateActive ? "text-black" : "text-gray-400"} />
                                        <span className="truncate">{isDateActive ? "กรองช่วงเวลา" : "เลือกวันที่"}</span>
                                    </div>
                                    {isDateActive ? (
                                        <span onClick={clearDateRange} className="p-0.5 rounded-full hover:bg-gray-100 text-gray-500 flex items-center shrink-0">
                                            <X size={11} strokeWidth={3} />
                                        </span>
                                    ) : (
                                        <ChevronDown size={13} className="text-gray-400 shrink-0" />
                                    )}
                                </button>

                                {/* กล่องเลือกช่วงวันที่ */}
                                {isDatePanelOpen && (
                                    <div className="absolute top-[calc(100%+6px)] left-0 w-65 bg-white border border-gray-200 rounded-2xl  p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 mb-3 pb-1 border-b border-gray-100">
                                            <CalendarDays size={13} className="text-primary" />
                                            <span>ระบุช่วงเวลาเก็บตัวอย่าง</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">จากวันที่</label>
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 focus:outline-hidden focus:border-black"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">ถึงวันที่</label>
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    min={startDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 focus:outline-hidden focus:border-black"
                                                />
                                            </div>
                                            <div className="flex justify-end gap-2 pt-1">
                                                {(startDate || endDate) && (
                                                    <button onClick={clearDateRange} className="text-[11px] font-bold text-gray-400 hover:text-gray-600 px-2 py-1">
                                                        ล้างค่า
                                                    </button>
                                                )}
                                                <button onClick={() => setIsDatePanelOpen(false)} className="text-[11px] font-bold bg-black text-white px-3 py-1.5 rounded-lg">
                                                    ตกลง
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 2. ปุ่มเลือกสถานะแบบ Multi-Select Dropdown ที่บอสต้องการ */}
                            <div className="relative flex-1" ref={statusMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-white border rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
                                        selectedStatuses.length > 0 ? "border-black text-black ring-1 ring-black" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="truncate">{currentStatusLabel}</span>
                                    </div>
                                    <ChevronDown size={13} className="text-gray-400 shrink-0" />
                                </button>

                                {/* รายการตัวเลือกสถานะภายในเมนู (Multi-Select Menu) */}
                                {isStatusMenuOpen && (
                                    <div className="absolute top-[calc(100%+6px)] right-0 w-full min-w-40 bg-white border border-gray-200 rounded-2xl shadow-xl p-1.5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                        {/* ลูปรายการสถานะให้สามารถเลือกพร้อมกันได้หลายตัว */}
                                        {statusOptions.map((option) => {
                                            const isChecked = selectedStatuses.includes(option.id);
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => handleStatusToggle(option.id)}
                                                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                                        isChecked ? "bg-gray-50/80 text-black" : "text-gray-600 hover:bg-gray-50"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {/* กล่องติ๊กถูกจำลองรูปทรงกลมตามสีสถานะ */}
                                                        <div
                                                            className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center transition-all ${
                                                                isChecked ? "border-black bg-black text-white" : "border-gray-300 bg-white"
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
                        <div className="flex items-center justify-between text-xs text-gray-400  px-0.5 pt-1 border-t border-gray-100">
                            <div className="text-gray-500">พบ {totalFilteredRecords} รายการ</div>

                            <div onClick={toggleSortDirection} className="flex items-center gap-1 cursor-pointer hover:text-gray-900 text-gray-500 transition-colors py-0.5 select-none">
                                <span>{sorting[0]?.id === "collectedAt" && sorting[0]?.desc ? "ล่าสุด" : "เก่าสุด"}</span>
                                <div className="flex items-center text-gray-400">
                                    {sorting[0]?.id === "collectedAt" &&
                                        (sorting[0]?.desc ? <ArrowDown size={12} className="text-black font-bold" /> : <ArrowUp size={12} className="text-black font-bold" />)}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Content Core Render */}
                    {(() => {
                        if (totalFilteredRecords === 0) {
                            return (
                                <div className="text-center p-10 bg-white rounded-2xl border border-gray-200/50 flex flex-col items-center justify-center">
                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-3 text-gray-400 border border-gray-100">
                                        <FileText size={18} />
                                    </div>
                                    <p className="text-gray-900 font-bold text-xs">ไม่พบข้อมูลประวัติ</p>
                                    <p className="text-[11px] text-gray-400 mt-1 max-w-xs leading-relaxed">ไม่พบผลลัพธ์ประวัติที่ตรงกับเงื่อนไขการเลือกหลายสถานะ หรือช่วงเวลาที่บอสกำหนดไว้ครับ</p>
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
                                                className="bg-white rounded-2xl p-3.5 border border-gray-200/50 shadow hover:shadow-xs active:scale-[0.99] transition-all flex items-center gap-3.5 cursor-pointer group"
                                            >
                                                <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 shrink-0 overflow-hidden flex items-center justify-center relative transition-all">
                                                    {sample.imageUrl && !hasImageError ? (
                                                        <img
                                                            src={sample.imageUrl}
                                                            alt="sample data"
                                                            onError={() => handleImageError(sample.id)}
                                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                                                        />
                                                    ) : (
                                                        <ImageOff size={15} className="text-gray-300" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0 flex flex-col justify-between h-15">
                                                    <div>
                                                        <div className="flex items-center justify-between gap-2 w-full">
                                                            <h4 className="font-semibold text-sm text-black text-left">
                                                                {sample.location?.name || "ไม่ทราบสถานที่"}
                                                            </h4>
                                                            <div className="shrink-0">
                                                                <StatusBadge status={sample.status} size="sm" />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                                                            <MapPin size={10} className="text-gray-300 shrink-0" />
                                                            <span className="truncate max-w-30">{sample.location?.organization || "หน่วยงานทั่วไป"}</span>
                                                            <span className="opacity-40">•</span>
                                                            <Calendar size={10} className="text-gray-300 shrink-0" />
                                                            <span>
                                                                {new Date(sample.collectedAt).toLocaleDateString("th-TH", {
                                                                    day: "numeric",
                                                                    month: "short",
                                                                    year: "2-digit",
                                                                })}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                                                            <div className="flex items-center gap-1 bg-[#f1f3f5] px-2 py-1 rounded-md">
                                                                <Beaker size={8} className="text-blue-500" />
                                                                <span>P: {sample.phosphateVal ?? "-"}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 bg-[#f1f3f5] px-2 py-1 rounded-md">
                                                                <Beaker size={8} className="text-amber-500" />
                                                                <span>N: {sample.ammoniaVal ?? "-"}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Pagination Controls */}
                                {pageCount > 1 && (
                                    <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2 select-none">
                                        <div className="text-xs text-gray-400 font-medium">
                                            หน้า <span className="font-bold text-gray-700">{pageIndex + 1}</span> จาก <span className="font-bold text-gray-700">{pageCount}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                disabled={!table.getCanPreviousPage()}
                                                onClick={() => table.previousPage()}
                                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-3xs"
                                            >
                                                ก่อนหน้า
                                            </button>
                                            <button
                                                disabled={!table.getCanNextPage()}
                                                onClick={() => table.nextPage()}
                                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-3xs"
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
