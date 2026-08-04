"use client";

import { useState } from "react";
import { isLowConfidence } from "@/lib/standards";
import { REVIEW_NOTE_MAX_LENGTH } from "@/lib/reviewConstants";
import { MapPin, Check, X, ImageOff, Clock, FileScan, Calendar, Beaker, CheckCircle2, XCircle, Eye } from "lucide-react";
import StatusBadge from "@/components/map/StatusBadge";
import Popup from "@/components/Popup";

export type ReviewStatusFilter = "pending" | "approved" | "rejected";

export interface ReviewMeasurement {
    parameterId: number;
    parameterName: string | null;
    unit: string | null;
    value: number;
    confidence: number;
}

export interface ReviewSample {
    id: number;
    rawImageUrl: string | null;
    analyzedPlotUrl: string | null;
    measurements: ReviewMeasurement[];
}

export interface PreviewImages {
    raw: string | null;
    analyzed: string | null;
    active: "raw" | "analyzed";
}

export interface ReviewRequestItem {
    id: number;
    sessionGroup: string;
    statusRequest: ReviewStatusFilter;
    createdAt: string;
    reviewedAt: string | null;
    reviewNote: string | null;
    reviewedBy: { id: number; name: string } | null;
    collectionTime: string | null;
    location: { id: number; name: string; organization: string } | null;
    collector: { id: number; name: string } | null;
    samples: ReviewSample[];
}

export const TAB_CONFIG: { id: ReviewStatusFilter; label: string; icon: typeof Check }[] = [
    { id: "pending", label: "รออนุมัติ", icon: Clock },
    { id: "approved", label: "อนุมัติแล้ว", icon: Check },
    { id: "rejected", label: "ปฏิเสธแล้ว", icon: X },
];

export function StatusTabs({ tab, setTab }: { tab: ReviewStatusFilter; setTab: (v: ReviewStatusFilter) => void }) {
    return (
        <div className="mb-2">
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-subtle border border-border rounded-xl">
                {TAB_CONFIG.map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                                tab === t.id ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                            <Icon size={12} />
                            <span>{t.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function formatDateTime(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("th-TH", {
        year: "2-digit",
        month: "short",
        day: "numeric",
    });
}

/**
 * คำนวณประเมินสถานะคุณภาพน้ำ (safe/warning/danger) จากค่าความเข้มข้นใน measurements
 */
export function getSampleWaterStatus(item: ReviewRequestItem): "safe" | "warning" | "danger" {
    const allMeasurements = item.samples.flatMap((s) => s.measurements);
    let hasWarning = false;

    for (const m of allMeasurements) {
        const name = (m.parameterName || "").toLowerCase();
        const val = m.value;

        if (name.includes("ammonia") || name.includes("n")) {
            if (val >= 2.0) return "danger";
            if (val >= 0.5) hasWarning = true;
        } else if (name.includes("phosphate") || name.includes("p")) {
            if (val >= 1.0) return "danger";
            if (val >= 0.25) hasWarning = true;
        }
    }

    return hasWarning ? "warning" : "safe";
}

export function RequestCard({
    item,
    actingId,
    onOpenReject,
    onApprove,
    onPreviewImage,
}: {
    item: ReviewRequestItem;
    actingId: number | null;
    onOpenReject: (item: ReviewRequestItem) => void;
    onApprove: (item: ReviewRequestItem, approvedSampleIds?: number[]) => void;
    onPreviewImage: (images: PreviewImages) => void;
    mobile?: boolean;
}) {
    const isMultiSample = item.samples.length > 1;
    const showSampleSelect = item.statusRequest === "pending" && isMultiSample;
    const [selectedSampleIds, setSelectedSampleIds] = useState<number[]>(() => item.samples.filter((s) => !s.measurements.some((m) => isLowConfidence(m.confidence))).map((s) => s.id));
    const toggleSample = (id: number) => setSelectedSampleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const noneSelected = showSampleSelect && selectedSampleIds.length === 0;

    // คำนวณค่าสาร Phosphate (P) และ Ammonia (N) จาก measurements จริง
    const allMeasurements = item.samples.flatMap((s) => s.measurements);
    const phosphateMeas = allMeasurements.find((m) => (m.parameterName || "").toLowerCase().includes("phosphate"));
    const ammoniaMeas = allMeasurements.find((m) => (m.parameterName || "").toLowerCase().includes("ammonia"));

    const waterStatus = getSampleWaterStatus(item);

    // ดึงรูปภาพภาพแรกที่มีใน samples
    const firstSampleWithImage = item.samples.find((s) => s.rawImageUrl || s.analyzedPlotUrl);
    const previewImgObj: PreviewImages | null = firstSampleWithImage
        ? {
              raw: firstSampleWithImage.rawImageUrl,
              analyzed: firstSampleWithImage.analyzedPlotUrl,
              active: "raw",
          }
        : null;

    return (
        <div className="bg-card-general shadow-xs rounded-2xl p-3.5 border border-border active:scale-[0.99] transition-all flex flex-col gap-3 min-w-0">
            {/* ── แถวบน: สไตล์การจัดวางถอดแบบ CollectorMobile 100% ── */}
            <div className="flex items-start justify-between gap-4 w-full">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                        {/* ไอคอน MapPin ขนาด 36px ตรงกลางแนวตั้งขนานกลุ่มข้อความ */}
                        <MapPin size={36} className="text-primary shrink-0" />

                        <div className="flex-1 min-w-0">
                            {/* ชื่อสถานที่ */}
                            <h4 className="font-semibold text-sm text-text truncate">{item.location?.name || "ไม่ทราบสถานที่"}</h4>

                            {/* แถวกลาง: เมทาดาต้า sessionGroup และ วันที่ */}
                            <div className="flex flex-wrap items-center text-xs text-text-muted font-medium mt-0.5 gap-x-2">
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <FileScan size={13} className="text-text-muted shrink-0" />
                                    <span>{item.sessionGroup || "ไม่ระบุรหัส"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Calendar size={13} className="text-text-muted shrink-0" />
                                    <span>{formatDateTime(item.collectionTime || item.createdAt)}</span>
                                </div>
                            </div>

                            {/* แถวล่าง: แสดงค่าสารเคมี P และ N ชิปเล็ก */}
                            <div className="flex items-center gap-2 mt-1 w-full">
                                {phosphateMeas && (
                                    <div className="flex items-center gap-1 bg-surface-subtle px-2 py-1 rounded-md text-xs font-semibold text-text shrink-0">
                                        <Beaker size={10} className="text-teal-500" />
                                        <span>P: {Number(phosphateMeas.value).toFixed(2)}</span>
                                    </div>
                                )}
                                {ammoniaMeas && (
                                    <div className="flex items-center gap-1 bg-surface-subtle px-2 py-1 rounded-md text-xs font-semibold text-text shrink-0">
                                        <Beaker size={10} className="text-purple-500" />
                                        <span>N: {Number(ammoniaMeas.value).toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ฝั่งขวา: StatusBadge + ป้ายรออนุมัติ/อนุมัติแล้ว/ปฏิเสธแล้ว */}
                <div className="flex flex-col items-end text-center gap-1 shrink-0">
                    <StatusBadge status={waterStatus} size="sm" />

                    {item.statusRequest === "pending" && (
                        <span className="inline-flex items-center w-20 text-xs font-semibold text-text-warning bg-bg-warning border border-border-warning p-1 justify-center rounded-md whitespace-nowrap">
                            รอตรวจสอบ
                        </span>
                    )}
                    {item.statusRequest === "approved" && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-200 rounded-md whitespace-nowrap">อนุมัติแล้ว</span>
                    )}
                    {item.statusRequest === "rejected" && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-md whitespace-nowrap">ปฏิเสธแล้ว</span>
                    )}
                </div>
            </div>

            {/* ── โซนเลือกสารกรณีมีหลายสารในแท็บรออนุมัติ ── */}
            {showSampleSelect && (
                <div className="bg-surface-subtle border border-border/60 rounded-xl p-2.5 space-y-2">
                    <span className="text-[11px] font-bold text-text-secondary uppercase block">เลือกอนุมัติเฉพาะสาร:</span>
                    {item.samples.map((s) => (
                        <label key={s.id} className="flex items-center justify-between text-xs bg-card-general border border-border/50 rounded-lg p-2 cursor-pointer">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={selectedSampleIds.includes(s.id)}
                                    onChange={() => toggleSample(s.id)}
                                    disabled={actingId === item.id}
                                    className="w-4 h-4 accent-teal-700 cursor-pointer"
                                />
                                <span className="font-bold text-text">{s.measurements.map((m) => m.parameterName).join(", ")}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                {s.measurements.map((m) => (
                                    <span
                                        key={m.parameterId}
                                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                                            isLowConfidence(m.confidence) ? "text-text-danger bg-bg-danger border-border-danger" : "text-text-safe bg-bg-safe border-border-safe"
                                        }`}
                                    >
                                        {m.confidence.toFixed(2)}
                                    </span>
                                ))}
                            </div>
                        </label>
                    ))}
                </div>
            )}

            {/* สรุปผลการตรวจเดิมกรณีอนุมัติ/ปฏิเสธแล้ว */}
            {item.statusRequest !== "pending" && (
                <div className="text-xs text-text-muted bg-surface-subtle border border-border/60 rounded-xl p-2.5 font-medium">
                    <p>
                        ตัดสินโดย <span className="font-bold text-text-secondary">{item.reviewedBy?.name ?? "-"}</span> เมื่อ {formatDateTime(item.reviewedAt)}
                    </p>
                    {item.reviewNote && (
                        <p className="text-text-danger font-semibold bg-red-500/5 p-1.5 rounded-md border border-red-500/10 mt-1 break-words [overflow-wrap:anywhere]">เหตุผล: {item.reviewNote}</p>
                    )}
                </div>
            )}

            {/* ── แถบปุ่ม Actions จัดการ ── */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                {previewImgObj && (
                    <button
                        type="button"
                        onClick={() => onPreviewImage(previewImgObj)}
                        className="px-3 py-1.5 rounded-xl border border-border text-xs font-semibold text-text hover:bg-surface-subtle flex items-center gap-1 transition-all cursor-pointer"
                    >
                        <Eye size={13} />
                        <span>ดูรูปภาพ</span>
                    </button>
                )}

                {item.statusRequest === "pending" && (
                    <>
                        <button
                            type="button"
                            disabled={actingId === item.id}
                            onClick={() => onOpenReject(item)}
                            className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                        >
                            <XCircle size={13} />
                            <span>ปฏิเสธ</span>
                        </button>
                        <button
                            type="button"
                            disabled={actingId === item.id || noneSelected}
                            onClick={() => onApprove(item, showSampleSelect ? selectedSampleIds : undefined)}
                            className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                        >
                            {actingId === item.id ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={13} />}
                            <span>อนุมัติ</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export function RejectDrawer({
    rejectTarget,
    rejectNote,
    setRejectNote,
    rejectSaving,
    onClose,
    onSubmit,
}: {
    rejectTarget: ReviewRequestItem;
    rejectNote: string;
    setRejectNote: (v: string) => void;
    rejectSaving: boolean;
    onClose: () => void;
    onSubmit: () => void;
}) {
    return (
        <Popup title="ปฏิเสธคำร้อง" onClose={() => !rejectSaving && onClose()}>
            <div className="space-y-6">
                <p className="text-xs text-text-secondary leading-relaxed">
                    ผลตรวจของ &quot;{rejectTarget.location?.name ?? "จุดตรวจนี้"}&quot; จะถูกลบออกจากระบบทันที และไม่สามารถกู้คืนได้ กรุณาระบุเหตุผลให้ผู้เก็บตัวอย่างทราบ
                </p>

                <div className="space-y-2.5">
                    <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">เหตุผลในการปฏิเสธ *</label>
                    <textarea
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="เช่น ภาพเบลอ มองไม่เห็นสีของเหลวชัดเจน กรุณาถ่ายใหม่"
                        rows={3}
                        maxLength={REVIEW_NOTE_MAX_LENGTH}
                        className="w-full px-4 py-3.5 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none transition-all resize-none"
                    />
                    <div className={`text-right text-xs font-medium tabular-nums ${rejectNote.length >= REVIEW_NOTE_MAX_LENGTH ? "text-text-danger" : "text-text-muted"}`}>
                        {rejectNote.length}/{REVIEW_NOTE_MAX_LENGTH}
                    </div>
                </div>

                <button
                    onClick={onSubmit}
                    disabled={rejectSaving || !rejectNote.trim()}
                    className="w-full py-4 min-h-13 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
                >
                    {rejectSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <X size={14} />}
                    ยืนยันปฏิเสธคำร้อง
                </button>
            </div>
        </Popup>
    );
}

export function ImageLightbox({ images, onClose }: { images: PreviewImages; onClose: () => void }) {
    const [active, setActive] = useState<"raw" | "analyzed">(images.active);
    const currentUrl = active === "raw" ? images.raw : images.analyzed;

    const tabs: { key: "raw" | "analyzed"; label: string; url: string | null }[] = [
        { key: "raw", label: "ภาพถ่าย", url: images.raw },
        { key: "analyzed", label: "ภาพ AI", url: images.analyzed },
    ];

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xs z-2000 flex flex-col items-center justify-center p-2 animate-in fade-in duration-200" onClick={onClose}>
            <button
                onClick={onClose}
                className="absolute top-5 right-5 w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
            >
                <X size={20} />
            </button>

            <div onClick={(e) => e.stopPropagation()} className="flex gap-1 mb-4 bg-white/10 border border-white/20 rounded-full p-1">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => t.url && setActive(t.key)}
                        disabled={!t.url}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                            active === t.key ? "bg-white text-black" : "text-white hover:bg-white/10"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="relative max-w-full max-h-[70vh] rounded-2xl overflow-hidden shadow-2xl">
                <img
                    src={currentUrl ?? undefined}
                    alt={active === "raw" ? "ภาพถ่ายดิบ" : "ภาพวิเคราะห์จาก AI"}
                    className="max-w-full max-h-[70vh] object-contain"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
            <p className="text-white text-xs font-semibold mt-4 tracking-wide select-none">แตะพื้นที่ว่างเพื่อปิดหน้าต่างขยาย</p>
        </div>
    );
}
