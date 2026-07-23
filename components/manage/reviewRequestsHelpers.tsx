"use client";

import { isLowConfidence } from "@/lib/standards";
import { MapPin, Check, X, ImageOff, Beaker } from "lucide-react";

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

export const TAB_CONFIG: { id: ReviewStatusFilter; label: string }[] = [
    { id: "pending", label: "รออนุมัติ" },
    { id: "approved", label: "อนุมัติแล้ว" },
    { id: "rejected", label: "ปฏิเสธแล้ว" },
];

export function formatDateTime(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function RequestCard({
    item,
    tab,
    actingId,
    onOpenReject,
    onApprove,
    onPreviewImage,
}: {
    item: ReviewRequestItem;
    tab: ReviewStatusFilter;
    actingId: number | null;
    onOpenReject: (item: ReviewRequestItem) => void;
    onApprove: (item: ReviewRequestItem) => void;
    onPreviewImage: (url: string) => void;
}) {
    let statusBadgeColor = "text-text-warning bg-bg-warning border-border-warning";
    if (tab === "approved") statusBadgeColor = "text-text-safe bg-bg-safe border-border-safe";
    if (tab === "rejected") statusBadgeColor = "text-text-danger bg-bg-danger border-border-danger";

    return (
        <div className="bg-card-general rounded-2xl border border-border overflow-hidden flex flex-col p-5 gap-3">
            {/* ── ส่วนหัวการ์ด: ยุบรวม Meta ข้อมูลให้อยู่ในแถวเดียวกันเพื่อประหยัดพื้นที่ ── */}
            <div className="flex items-center  justify-between gap-3 pb-3 border-b border-border/60">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MapPin size={24} className="text-primary shrink-0" />
                    <div className="flex items-baseline  min-w-0 text-xs flex-wrap flex-col">
                        <h3 className="font-bold text-text-primary truncate">{item.location?.name ?? "ไม่ทราบสถานที่"}</h3>
                        <p className="text-secondary font-medium truncate">{item.location?.organization ?? "-"}</p>
                        <span className="text-secondary font-medium truncate">{formatDateTime(item.collectionTime)}</span>
                    </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0 border ${statusBadgeColor}`}>
                    {tab === "pending" ? "รออนุมัติ" : tab === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว"}
                </span>
            </div>

            {/* ── ข้อมูลผู้ส่งและเวลา: ปรับเป็นสไตล์แถวเมทาดาต้าเล็กๆ คลีนๆ ด้านบน ── */}
            <div className="flex items-center gap-4 text-xs text-text-secondary font-medium px-0.5">
                <div className="flex items-center gap-1 min-w-0">
                    <span className="truncate">
                        ผู้ส่ง: <span className="text-text-primary font-bold">{item.collector?.name ?? "-"}</span>
                    </span>
                </div>
            </div>

            {/* ── 🌟 การปรับปรุง Core List (ใช้พื้นที่ 2 คอลัมน์ซ้ายขวา) ── */}
            <div className="space-y-2">
                {item.samples.map((s) => (
                    <div key={s.id} className="w-full border rounded-xl p-3 transition-all flex flex-col gap-2.5 bg-surface-subtle border-border/60">
                        {/* Layout 2 คอลัมน์เคียงข้างกันอย่างมีประโยชน์ */}
                        <div className="flex items-center justify-between gap-3 w-full min-w-0">
                            {/* 📊 คอลัมน์ซ้าย: ยุบรวมกล่องพารามิเตอร์ให้เรียงแถวแนวนอนอย่างกระชับ */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                                {s.measurements.map((m) => {
                                    const lowConf = isLowConfidence(m.confidence);
                                    // สีไอคอนประจำสาร — แยกค่าต่อธีม เพราะเฉด 600 สว่างไม่พอบนพื้นการ์ดโหมดมืด (purple-600 ได้แค่ 3.16:1)
                                    const chemIconColor = m.parameterName?.toLowerCase().includes("ammonia") ? "text-purple-600 dark:text-purple-400" : "text-teal-600 dark:text-teal-400";

                                    return (
                                        <div key={m.parameterId} className="flex items-center justify-between gap-2 bg-surface border border-border/40 rounded-lg p-2 shadow-3xs">
                                            <div className="flex items-center gap-1 min-w-0">
                                                <Beaker size={11} className={chemIconColor} />
                                                <span className="text-xs font-bold text-text-primary uppercase truncate">{m.parameterName ?? "ไม่ทราบสาร"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-sm font-black text-text-primary">
                                                    {m.value.toFixed(3)} <span className="text-xs font-bold text-text-muted">{m.unit ?? "mg/L"}</span>
                                                </span>
                                                <span
                                                    className={`font-mono text-xs px-1.5 py-0.2 rounded font-bold border shrink-0 ${
                                                        lowConf ? "text-text-danger bg-bg-danger border-border-danger" : "text-text-safe bg-bg-safe border-border-safe"
                                                    }`}
                                                >
                                                    {m.confidence.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 🖼Header 2. คอลัมน์ขวา: จัดรูปถ่ายและรูปกราฟสีให้อยู่ในแนวนอนแพ็คคู่เคียงข้างฝั่งขวา */}
                            <div className="flex gap-1.5 shrink-0 items-center">
                                {/* รูปถ่ายดิบ */}
                                <div
                                    onClick={() => s.rawImageUrl && onPreviewImage(s.rawImageUrl)}
                                    className="relative w-12 h-12 rounded-lg border border-border bg-surface overflow-hidden shrink-0 cursor-zoom-in group hover:border-primary/60 transition-colors"
                                >
                                    {s.rawImageUrl ? (
                                        <img src={s.rawImageUrl} alt="Raw sample" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageOff size={12} className="text-text-muted absolute inset-0 m-auto" />
                                    )}
                                    <span className="absolute bottom-0 inset-x-0 text-xs bg-black/60 text-white font-bold text-center py-0.2 select-none">ภาพถ่าย</span>
                                </div>

                                {/* รูปกราฟสี */}
                                <div
                                    onClick={() => s.analyzedPlotUrl && onPreviewImage(s.analyzedPlotUrl)}
                                    className="relative w-12 h-12 rounded-lg border border-border bg-surface overflow-hidden shrink-0 cursor-zoom-in group hover:border-primary/60 transition-colors"
                                >
                                    {s.analyzedPlotUrl ? (
                                        <img src={s.analyzedPlotUrl} alt="Analyzed plot" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageOff size={12} className="text-text-muted absolute inset-0 m-auto" />
                                    )}
                                    <span className="absolute bottom-0 inset-x-0 text-xs bg-primary/80 text-white font-bold text-center py-0.2 select-none">กราฟสี</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* สรุปผลการตัดสินใจ (แท็บที่เคยตรวจผ่านแล้ว) */}
            {tab !== "pending" && (
                <div className="text-xs text-text-muted bg-surface-subtle border border-border/60 rounded-xl p-2.5 font-medium">
                    <p>
                        ตัดสินโดย <span className="font-bold text-text-secondary">{item.reviewedBy?.name ?? "-"}</span> เมื่อ {formatDateTime(item.reviewedAt)}
                    </p>
                    {item.reviewNote && <p className="text-text-danger font-semibold bg-red-500/5 p-1.5 rounded-md border border-red-500/10 mt-1">เหตุผล: {item.reviewNote}</p>}
                </div>
            )}

            {/* ปุ่มกลุ่ม Actions การจัดการระบบในแท็บรออนุมัติ */}
            {tab === "pending" && (
                <div className="flex gap-2 pt-0.5">
                    <button
                        onClick={() => onOpenReject(item)}
                        disabled={actingId === item.id}
                        className="flex-1 py-2 min-h-[38px] rounded-xl text-xs font-bold flex items-center justify-center gap-1 bg-surface-subtle hover:bg-bg-danger border border-border hover:border-border-danger text-text-secondary hover:text-text-danger transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <X size={13} /> ปฏิเสธ
                    </button>
                    <button
                        onClick={() => onApprove(item)}
                        disabled={actingId === item.id}
                        className="flex-1 py-2 min-h-9.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bg-teal-700 hover:bg-teal-800 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {actingId === item.id ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={13} />}
                        อนุมัติผล
                    </button>
                </div>
            )}
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
        <>
            <div className="fixed inset-0 bg-black/40 z-1000 backdrop-blur-xs transition-opacity" onClick={() => !rejectSaving && onClose()} />
            <div
                className="fixed bottom-0 left-0 right-0 z-1001 bg-surface rounded-t-4xl shadow-2xl border-t border-border max-w-lg mx-auto px-8 pt-8 space-y-6 animate-slide-up transition-colors duration-300"
                style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom))" }}
            >
                <div className="w-12 h-1 bg-border rounded-full mx-auto mb-2 pointer-events-none" />

                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">ปฏิเสธคำร้อง</h3>
                    <button
                        onClick={() => !rejectSaving && onClose()}
                        className="w-8 h-8 bg-surface-subtle border border-border rounded-full flex items-center justify-center hover:bg-surface-muted transition-colors active:scale-[0.92] cursor-pointer"
                    >
                        <X size={14} className="text-text-secondary" />
                    </button>
                </div>

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
                        className="w-full px-4 py-3.5 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none transition-all resize-none"
                    />
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
        </>
    );
}

export function ImageLightbox({ previewImgUrl, onClose }: { previewImgUrl: string; onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xs z-2000 flex flex-col items-center justify-center p-2 animate-in fade-in duration-200" onClick={onClose}>
            {/* ปุ่มปิดมุมขวาบน */}
            <button
                onClick={onClose}
                className="absolute top-35 right-5 w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
            >
                <X size={20} />
            </button>

            {/* รูปภาพขยายเต็มตา */}
            <div className="relative max-w-full max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl">
                <img
                    src={previewImgUrl}
                    alt="Preview Expanded"
                    className="max-w-full max-h-[80vh] object-contain"
                    onClick={(e) => e.stopPropagation()} // กันกดโดนรูปแล้วปิด
                />
            </div>
            <p className="text-white text-xs font-semibold mt-4 tracking-wide select-none">แตะพื้นที่ว่างเพื่อปิดหน้าต่างขยาย</p>
        </div>
    );
}
