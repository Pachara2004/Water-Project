"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { CONFIDENCE_THRESHOLD } from "@/lib/standards";
import { Search, SlidersHorizontal, ChevronDown, CalendarDays, X, ArrowUp, ArrowDown, Check, FileText, ArrowLeft, ArrowRight } from "lucide-react";
import { StatusTabs, RequestCardDesktop, RejectDrawer, EditApproveDrawer, ImageLightbox, getSampleWaterStatus } from "@/components/manage/reviewRequestsHelpers";
import type { ReviewRequestsPageProps } from "./reviewRequestsMobile";
import { ReviewRequestCardSkeleton } from "./loading";
import PageHeader from "@/components/PageHeader";

const statusOptions = [
    { id: "safe", label: "ปลอดภัย" },
    { id: "warning", label: "เฝ้าระวัง" },
    { id: "danger", label: "อันตราย" },
];

export default function ReviewRequestsDesktop(props: ReviewRequestsPageProps) {
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

    // ⚡ ระบบประมวลผล Filter ข้อมูลฝั่ง Client สำหรับ Desktop
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
        <div className="min-h-dvh w-full bg-bg pb-8 antialiased transition-colors duration-300">
            <PageHeader title="คุณภาพน้ำที่ต้องการยืนยัน" onBack={() => router.back()} />

            <div className="w-full max-w-400 mx-auto p-4 pt-4 space-y-4">
                {/* Header Welcome Card */}
                <div className="bg-card-general rounded-2xl border border-border p-5 transition-colors duration-300">
                    <h1 className="font-display text-lg font-bold text-text-primary">
                        ตรวจสอบผลที่มี <span className="font-display text-primary">ค่าความมั่นใจ ต่ำ</span>
                    </h1>
                    <p className="text-text-secondary text-xs mt-1 leading-relaxed">
                        ผลตรวจที่ AI วิเคราะห์ได้ค่าความมั่นใจต่ำกว่า {CONFIDENCE_THRESHOLD.toFixed(2)} จะถูกซ่อนจากแผนที่และแดชบอร์ดจนกว่าจะได้รับการยืนยันจากผู้ดูแลระบบ
                    </p>
                </div>

                {/* Filter Panel Container ฝั่ง Desktop */}
                <div className="bg-card-general rounded-2xl p-5 border border-border space-y-4">
                    {/* Status Tabs */}
                    <StatusTabs tab={tab} setTab={setTab} />

                    {/* แถวการกรองสำหรับ Desktop Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        {/* Input ค้นหาชื่อสถานที่ / โค้ด */}
                        <div className="md:col-span-6 relative flex items-center bg-surface-subtle border border-primary/30 rounded-lg px-4">
                            <input
                                type="text"
                                placeholder="ค้นหาตามสถานที่ หรือ รหัส..."
                                value={globalFilter}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                                className="no-focus-ring w-full py-2.5 bg-surface-subtle text-xs text-text outline-none placeholder:text-secondary"
                            />
                            <Search size={18} className="text-secondary ml-2 shrink-0" />
                        </div>

                        {/* 1. ปุ่มเลือกช่วงเวลา Popover */}
                        <div className="md:col-span-3 relative" ref={datePanelRef}>
                            <button
                                type="button"
                                onClick={() => setIsDatePanelOpen(!isDatePanelOpen)}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-card-general border rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
                                    isDateActive ? "border-primary text-text ring-1 ring-primary" : "border-primary/30 text-text hover:bg-surface-subtle"
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
                                <div className="absolute top-[calc(100%+6px)] left-0 w-72 bg-surface border border-border rounded-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150 shadow-xl">
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
                                                className="w-full text-xs border border-border rounded-lg p-2 bg-surface-subtle focus:outline-none focus:border-primary"
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
                                                className="w-full text-xs border border-border rounded-lg p-2 bg-surface-subtle focus:outline-none focus:border-primary"
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
                        <div className="md:col-span-3 relative" ref={statusMenuRef}>
                            <button
                                type="button"
                                onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-card-general border rounded-lg text-xs font-semibold transition-all cursor-pointer select-none ${
                                    selectedStatuses.length > 0 ? "border-primary text-text ring-1 ring-primary" : "border-primary/30 text-text hover:bg-surface-subtle"
                                }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="truncate">{currentStatusLabel}</span>
                                </div>
                                <ChevronDown size={13} className="text-text shrink-0" />
                            </button>

                            {/* รายการตัวเลือกสถานะ */}
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
                    <div className="flex items-center justify-between text-xs text-text-muted px-0.5 pt-2 border-t border-primary">
                        <div className="text-text">พบ {filteredRequests.length} รายการ</div>

                        <div onClick={() => setSortDesc(!sortDesc)} className="flex items-center gap-1 cursor-pointer hover:text-text text-text transition-colors py-0.5 select-none">
                            <span>{sortDesc ? "ล่าสุด" : "เก่าสุด"}</span>
                            <div className="flex items-center text-text-muted">{sortDesc ? <ArrowDown size={13} className="text-text" /> : <ArrowUp size={13} className="text-text" />}</div>
                        </div>
                    </div>

                    {/* Content Render List แบบ Grid 2 Columns */}
                    {isLoadingRequests ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <ReviewRequestCardSkeleton key={i} />
                            ))}
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="bg-surface rounded-2xl p-14 text-center border border-border flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-surface-subtle border border-border rounded-xl flex items-center justify-center mb-4">
                                <FileText size={20} className="text-text-muted" />
                            </div>
                            <p className="text-xs font-bold text-text">
                                {tab === "pending" ? "ไม่มีคำร้องรออนุมัติในขณะนี้" : tab === "approved" ? "ยังไม่มีคำร้องที่อนุมัติ" : "ยังไม่มีคำร้องที่ปฏิเสธ"}
                            </p>
                            <p className="text-xs text-text-muted mt-1 max-w-xs leading-relaxed">ไม่พบผลลัพธ์ประวัติที่ตรงกับเงื่อนไขการเลือกหลายสถานะ หรือช่วงเวลาที่กำหนดไว้ครับ</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {filteredRequests.map((item) => (
                                <RequestCardDesktop
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
                    )}

                    {/* Pagination Controls */}
                    {!isLoadingRequests && totalPages > 1 && (
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
