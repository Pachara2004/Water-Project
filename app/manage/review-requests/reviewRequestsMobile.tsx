"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { useRouter } from "next/navigation";
import { CONFIDENCE_THRESHOLD, type StandardRow } from "@/lib/standards";
import { Search, SlidersHorizontal, ChevronDown, CalendarDays, X, ArrowUp, ArrowDown, Check, FileText, ArrowLeft, ArrowRight } from "lucide-react";
import {
    StatusTabs,
    RejectDrawer,
    EditApproveDrawer,
    getSampleWaterStatus,
    ImageLightbox,
    type ReviewStatusFilter,
    type ReviewRequestItem,
    type PreviewImages,
    RequestCardMobile,
} from "@/components/manage/reviewRequestsHelpers";
import { ReviewRequestCardSkeleton } from "./loading";
import PageHeader from "@/components/PageHeader";

export interface ReviewRequestsPageProps {
    router: ReturnType<typeof useRouter>;
    toastElement: React.ReactNode;

    tab: ReviewStatusFilter;
    setTab: (v: ReviewStatusFilter) => void;

    /** คำร้องของหน้าปัจจุบันเท่านั้น — แบ่งหน้ามาจากฝั่ง API แล้ว */
    requests: ReviewRequestItem[];
    page: number;
    totalPages: number;
    setPage: (p: number) => void;
    isLoadingRequests: boolean;

    actingId: number | null;

    /** เกณฑ์จริงจากตาราง standards (ทุกสาร × ทุกประเภท) — ใช้คำนวณ badge สถานะน้ำให้ตรงกับ server */
    standards: StandardRow[];

    previewImages: PreviewImages | null;
    setPreviewImages: (v: PreviewImages | null) => void;

    rejectTarget: ReviewRequestItem | null;
    setRejectTarget: (v: ReviewRequestItem | null) => void;
    rejectNote: string;
    setRejectNote: (v: string) => void;
    rejectSaving: boolean;

    handleApprove: (item: ReviewRequestItem, approvedSampleIds?: number[]) => void;
    openReject: (item: ReviewRequestItem) => void;
    submitReject: () => void;

    editTarget: ReviewRequestItem | null;
    setEditTarget: (v: ReviewRequestItem | null) => void;
    editNote: string;
    setEditNote: (v: string) => void;
    editMeasurements: Record<number, number>;
    setEditMeasurements: (fn: (prev: Record<number, number>) => Record<number, number>) => void;
    editParameters: Record<number, number>;
    setEditParameters: (fn: (prev: Record<number, number>) => Record<number, number>) => void;
    editSelectedSampleIds: number[];
    setEditSelectedSampleIds: (fn: (prev: number[]) => number[]) => void;
    editSaving: boolean;
    systemParameters: { id: number; name: string }[];
    openEditApprove: (item: ReviewRequestItem, preSelectedSampleIds?: number[]) => void;
    submitEditApprove: () => void;
}

const statusOptions = [
    { id: "safe", label: "ปลอดภัย" },
    { id: "warning", label: "เฝ้าระวัง" },
    { id: "danger", label: "อันตราย" },
];

export default function ReviewRequestsMobile(props: ReviewRequestsPageProps) {
    const {
        router,
        toastElement,
        tab,
        setTab,
        requests,
        page,
        totalPages,
        setPage,
        isLoadingRequests,
        actingId,
        standards,
        previewImages,
        setPreviewImages,
        rejectTarget,
        setRejectTarget,
        rejectNote,
        setRejectNote,
        rejectSaving,
        handleApprove,
        openReject,
        submitReject,
        editTarget,
        setEditTarget,
        editNote,
        setEditNote,
        editMeasurements,
        setEditMeasurements,
        editParameters,
        setEditParameters,
        editSelectedSampleIds,
        setEditSelectedSampleIds,
        editSaving,
        systemParameters,
        openEditApprove,
        submitEditApprove,
    } = props;

    // ─── Control States สำหรับ Filter Panel ───
    const [globalFilter, setGlobalFilter] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [sortDesc, setSortDesc] = useState(true);

    // Popover States
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
        setStartDate("");
        setEndDate("");
        setIsDatePanelOpen(false);
    };

    const handleStatusToggle = (id: string) => {
        setSelectedStatuses((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    };

    const currentStatusLabel = useMemo(() => {
        if (selectedStatuses.length === 0) return "ทุกสถานะ";
        if (selectedStatuses.length === 1) {
            return statusOptions.find((o) => o.id === selectedStatuses[0])?.label || "ทุกสถานะ";
        }
        return `เลือกแล้ว ${selectedStatuses.length} สถานะ`;
    }, [selectedStatuses]);

    // ⚡ ระบบประมวลผล Filter ข้อมูลฝั่ง Client
    const filteredRequests = useMemo(() => {
        return requests
            .filter((item) => {
                // 1. ค้นหาตามสถานที่ หรือ sessionGroup
                if (globalFilter) {
                    const search = globalFilter.toLowerCase();
                    const matchLocation = (item.location?.name || "").toLowerCase().includes(search);
                    const matchGroup = (item.sessionGroup || "").toLowerCase().includes(search);
                    if (!matchLocation && !matchGroup) return false;
                }

                // 2. ช่วงเวลาส่งตรวจ (createdAt หรือ collectionTime)
                if (startDate || endDate) {
                    const timeStr = item.collectionTime || item.createdAt;
                    const timeVal = timeStr ? new Date(timeStr).getTime() : 0;
                    if (startDate && timeVal < new Date(startDate).getTime()) return false;
                    if (endDate && timeVal > new Date(endDate).setHours(23, 59, 59, 999)) return false;
                }

                // 3. กรองตามสถานะความปลอดภัยน้ำ (safe / warning / danger)
                if (selectedStatuses.length > 0) {
                    const itemWaterStatus = getSampleWaterStatus(item, standards);
                    if (!selectedStatuses.includes(itemWaterStatus)) return false;
                }

                return true;
            })
            .sort((a, b) => {
                const dateA = new Date(a.collectionTime || a.createdAt || 0).getTime();
                const dateB = new Date(b.collectionTime || b.createdAt || 0).getTime();
                return sortDesc ? dateB - dateA : dateA - dateB;
            });
    }, [requests, globalFilter, startDate, endDate, selectedStatuses, sortDesc, standards]);

    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <PageHeader title="คุณภาพน้ำที่ต้องการยืนยัน" onBack={() => router.back()} />

            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                {/* Header Welcome Card */}
                <div className="relative w-full rounded-2xl bg-card-general p-5 border border-border flex flex-col gap-2">
                    <h1 className="text-lg font-bold tracking-tight text-text">
                        ตรวจสอบผลที่มี <span className="text-primary font-extrabold">ค่าความมั่นใจ ต่ำ</span>
                    </h1>
                    <p className="text-text font-medium text-xs mt-0.5 leading-relaxed">
                        ผลตรวจที่ AI วิเคราะห์ได้ค่าความมั่นใจต่ำกว่า {CONFIDENCE_THRESHOLD.toFixed(2)} จะถูกซ่อนจากแผนที่และแดชบอร์ดจนกว่าจะได้รับการยืนยันจากผู้ดูแลระบบ
                    </p>
                </div>

                {/* โซนกล่องค้นหาและฟิลเตอร์แบบ Dropdown Multi-Select ถอดแบบ CollectorMobile */}
                <div className="relative w-full bg-card-general rounded-2xl p-4 border border-border">
                    {/* Status Tabs */}
                    <div className="pt-1">
                        <StatusTabs tab={tab} setTab={setTab} />
                    </div>

                    <div className="bg-card-general rounded-2xl space-y-4 mt-6 mb-2">
                        {/* Input ค้นหาชื่อสถานที่ / โค้ด ทรงรีมน */}
                        <div className="relative w-full flex items-center bg-surface-subtle border border-border rounded-xl px-4 transition-all">
                            <input
                                type="text"
                                placeholder="ค้นหา..."
                                value={globalFilter}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                                className="w-full py-3 bg-surface-subtle text-xs text-text outline-hidden placeholder:text-secondary"
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
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-card-general border rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
                                        isDateActive ? "border-primary text-text" : "border-border text-secondary hover:bg-surface-subtle"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <SlidersHorizontal size={16} className="text-text" />
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

                                {/* กล่องเลือกช่วงวันที่ */}
                                {isDatePanelOpen && (
                                    <div className="absolute top-[calc(100%+6px)] left-0 w-65 bg-surface border border-border rounded-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150 shadow-xl">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-3 pb-1 border-b border-border">
                                            <CalendarDays size={13} className="text-primary" />
                                            <span>ระบุช่วงเวลาส่งตรวจ</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-bold uppercase text-text block mb-1">จากวันที่</label>
                                                <input
                                                    title="start date"
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                    className="w-full text-xs border border-border rounded-lg p-2 bg-surface-subtle focus:outline-hidden"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold uppercase text-text block mb-1">ถึงวันที่</label>
                                                <input
                                                    title="end date"
                                                    type="date"
                                                    value={endDate}
                                                    min={startDate}
                                                    onChange={(e) => setEndDate(e.target.value)}
                                                    className="w-full text-xs border border-border rounded-lg p-2 bg-surface-subtle focus:outline-hidden"
                                                />
                                            </div>
                                            <div className="flex justify-end gap-2 pt-1">
                                                {(startDate || endDate) && (
                                                    <button onClick={handleClearDateRange} className="text-xs font-bold text-text hover:text-text-secondary px-2 py-1">
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

                            {/* 2. ปุ่มเลือกสถานะแบบ Multi-Select Dropdown */}
                            <div className="relative flex-1" ref={statusMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                                    className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-card-general border rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
                                        selectedStatuses.length > 0 ? "border-primary text-text" : "border-border text-text hover:bg-surface-subtle"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="truncate">{currentStatusLabel}</span>
                                    </div>
                                    <ChevronDown size={13} className="text-text shrink-0" />
                                </button>

                                {/* รายการตัวเลือกสถานะภายในเมนู */}
                                {isStatusMenuOpen && (
                                    <div className="absolute top-[calc(100%+6px)] right-0 w-full min-w-40 bg-card-general border border-border rounded-2xl p-1.5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 shadow-xl">
                                        {statusOptions.map((option) => {
                                            const isChecked = selectedStatuses.includes(option.id);
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => handleStatusToggle(option.id)}
                                                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                                        isChecked ? "bg-surface-subtle text-text" : "text-text-secondary hover:bg-surface"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center transition-all ${
                                                                isChecked ? "border-primary bg-primary text-text" : "border-border bg-card-general"
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
                        <div className="flex items-center justify-between text-xs text-text-muted px-0.5 pt-1 border-t border-border">
                            <div className="text-text">พบ {filteredRequests.length} รายการ</div>

                            <div onClick={() => setSortDesc(!sortDesc)} className="flex items-center gap-1 cursor-pointer hover:text-text text-text transition-colors py-0.5 select-none">
                                <span>{sortDesc ? "ล่าสุด" : "เก่าสุด"}</span>
                                <div className="flex items-center text-text-muted">{sortDesc ? <ArrowDown size={13} className="text-text" /> : <ArrowUp size={13} className="text-text" />}</div>
                            </div>
                        </div>
                    </div>

                    {/* Content Core Render */}
                    {(() => {
                        if (isLoadingRequests) {
                            return (
                                <div className="space-y-3">
                                    {Array.from({ length: 2 }).map((_, i) => (
                                        <ReviewRequestCardSkeleton key={i} />
                                    ))}
                                </div>
                            );
                        }

                        if (filteredRequests.length === 0) {
                            return (
                                <div className="text-center p-10 bg-card-general rounded-2xl border border-border flex flex-col items-center justify-center">
                                    <div className="w-10 h-10 bg-surface-subtle rounded-xl flex items-center justify-center mb-3 text-text-muted border border-border">
                                        <FileText size={18} />
                                    </div>
                                    <p className="text-text font-bold text-xs">
                                        {tab === "pending" ? "ไม่มีคำร้องรออนุมัติในขณะนี้" : tab === "approved" ? "ยังไม่มีคำร้องที่อนุมัติ" : "ยังไม่มีคำร้องที่ปฏิเสธ"}
                                    </p>
                                    <p className="text-xs text-text-muted mt-1 max-w-xs leading-relaxed">ไม่พบผลลัพธ์ประวัติที่ตรงกับเงื่อนไขการเลือกหลายสถานะ หรือช่วงเวลาที่กำหนดไว้ครับ</p>
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-4">
                                <div className="flex flex-col gap-3">
                                    {filteredRequests.map((item) => (
                                        <RequestCardMobile
                                            key={item.id}
                                            item={item}
                                            standards={standards}
                                            actingId={actingId}
                                            onOpenReject={openReject}
                                            onApprove={handleApprove}
                                            onPreviewImage={setPreviewImages}
                                            onOpenEditApprove={openEditApprove}
                                        />
                                    ))}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between border-t border-border pt-4 mt-2 select-none">
                                        <div className="text-xs text-text-muted font-medium">
                                            หน้า <span className="font-bold text-text">{page}</span> จาก <span className="font-bold text-text">{totalPages}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                disabled={page <= 1}
                                                onClick={() => setPage(page - 1)}
                                                className="inline-flex items-center gap-1.5 p-2 text-xs font-semibold rounded-xl border border-border bg-card-general text-text disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
                                            >
                                                <ArrowLeft size={15} strokeWidth={2.5} className="text-text shrink-0" />
                                                ก่อนหน้า
                                            </button>
                                            <button
                                                disabled={page >= totalPages}
                                                onClick={() => setPage(page + 1)}
                                                className="inline-flex items-center gap-1.5 p-2 text-xs font-semibold rounded-xl border border-border bg-card-general text-text disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer"
                                            >
                                                ถัดไป
                                                <ArrowRight size={15} strokeWidth={2.5} className="text-text shrink-0" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Drawers & Lightbox */}
            {rejectTarget && (
                <RejectDrawer
                    rejectTarget={rejectTarget}
                    rejectNote={rejectNote}
                    setRejectNote={setRejectNote}
                    rejectSaving={rejectSaving}
                    onClose={() => setRejectTarget(null)}
                    onSubmit={submitReject}
                    onPreviewImage={setPreviewImages}
                />
            )}
            {editTarget && (
                <EditApproveDrawer
                    editTarget={editTarget}
                    editNote={editNote}
                    setEditNote={setEditNote}
                    editMeasurements={editMeasurements}
                    setEditMeasurements={setEditMeasurements}
                    editParameters={editParameters}
                    setEditParameters={setEditParameters}
                    editSelectedSampleIds={editSelectedSampleIds}
                    setEditSelectedSampleIds={setEditSelectedSampleIds}
                    editSaving={editSaving}
                    systemParameters={systemParameters}
                    onClose={() => setEditTarget(null)}
                    onSubmit={submitEditApprove}
                    onPreviewImage={(imgs) => setPreviewImages({ ...imgs, active: imgs.analyzed ? "analyzed" : "raw" })}
                />
            )}
            {previewImages && <ImageLightbox images={previewImages} onClose={() => setPreviewImages(null)} />}
            {toastElement}
        </div>
    );
}
