"use client";

import { useState } from "react";
import { isLowConfidence } from "@/lib/standards";
import { REVIEW_NOTE_MAX_LENGTH } from "@/lib/reviewConstants";
import { MapPin, Check, X, ImageOff } from "lucide-react";
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

// ภาพที่เปิดใน lightbox — เก็บทั้งภาพถ่ายดิบและภาพ AI ไว้เพื่อสลับดูได้ | active = ภาพที่โชว์อยู่ตอนเปิด
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
    actingId,
    onOpenReject,
    onApprove,
    onPreviewImage,
    mobile = false,
}: {
    item: ReviewRequestItem;
    actingId: number | null;
    onOpenReject: (item: ReviewRequestItem) => void;
    onApprove: (item: ReviewRequestItem, approvedSampleIds?: number[]) => void;
    onPreviewImage: (images: PreviewImages) => void;
    // mobile = ซ่อนค่าที่วัดได้บนหน้าการ์ด แล้วแตะสารเพื่อเปิด popup รายละเอียดแทน (desktop โชว์ค่า inline)
    mobile?: boolean;
}) {
    let statusBadgeColor = "text-text-warning bg-bg-warning border-border-warning";
    if (item.statusRequest === "approved") statusBadgeColor = "text-text-safe bg-bg-safe border-border-safe";
    if (item.statusRequest === "rejected") statusBadgeColor = "text-text-danger bg-bg-danger border-border-danger";

    // เลือกอนุมัติรายสาร — ใช้เฉพาะการ์ดที่มีหลายสารในแท็บรออนุมัติ (สารเดียวอนุมัติทั้งใบเสมอ)
    // ค่าเริ่มต้น: ติ๊กเฉพาะสารที่ confidence ผ่านเกณฑ์ปกติ (ไม่มีตัวชี้วัดไหน low confidence) — สาร low confidence
    // เป็นเหตุผลที่คำร้องนี้ต้องมาให้ admin ตรวจอยู่แล้ว จึงไม่ควรถูกเลือกอนุมัติอัตโนมัติ
    // สารที่ไม่ติ๊ก = จะถูก soft-delete ตอนกดอนุมัติ
    const isMultiSample = item.samples.length > 1;
    const showSampleSelect = item.statusRequest === "pending" && isMultiSample;
    const [selectedSampleIds, setSelectedSampleIds] = useState<number[]>(() =>
        item.samples.filter((s) => !s.measurements.some((m) => isLowConfidence(m.confidence))).map((s) => s.id)
    );
    const toggleSample = (id: number) => setSelectedSampleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    // ไม่ติ๊กเลย = ปฏิเสธทั้งก้อน → บล็อกปุ่มอนุมัติ ให้ไปใช้ปุ่มปฏิเสธทั้งหมดแทน
    const noneSelected = showSampleSelect && selectedSampleIds.length === 0;

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
                    {item.statusRequest === "pending" ? "รออนุมัติ" : item.statusRequest === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว"}
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
                            {/* Checkbox เลือกอนุมัติรายสาร — โชว์เฉพาะการ์ดหลายสารในแท็บรออนุมัติ */}
                            {showSampleSelect && (
                                <input
                                    type="checkbox"
                                    checked={selectedSampleIds.includes(s.id)}
                                    onChange={() => toggleSample(s.id)}
                                    disabled={actingId === item.id}
                                    aria-label="เลือกอนุมัติสารนี้"
                                    className="w-4 h-4 shrink-0 accent-teal-700 cursor-pointer disabled:cursor-not-allowed"
                                />
                            )}
                            {/* 📊 คอลัมน์ซ้าย: ยุบรวมกล่องพารามิเตอร์ให้เรียงแถวแนวนอนอย่างกระชับ */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                                {s.measurements.map((m) => {
                                    const lowConf = isLowConfidence(m.confidence);
                                    const confidenceBadge = (
                                        <span
                                            className={`font-mono text-xs px-1.5 py-0.2 rounded font-bold border shrink-0 ${
                                                lowConf ? "text-text-danger bg-bg-danger border-border-danger" : "text-text-safe bg-bg-safe border-border-safe"
                                            }`}
                                        >
                                            {m.confidence.toFixed(2)}
                                        </span>
                                    );

                                    // Mobile: ชื่อสารด้านบน + ค่าความเข้มข้นใต้ชื่อ | confidence อยู่ขวา
                                    if (mobile) {
                                        return (
                                            <div key={m.parameterId} className="flex items-center justify-between gap-2 bg-surface border border-border/40 rounded-lg p-2 shadow-3xs">
                                                <div className="flex flex-col items-start gap-0.5 min-w-0">
                                                    <span className="text-xs font-bold text-text-primary uppercase truncate max-w-full">{m.parameterName ?? "ไม่ทราบสาร"}</span>
                                                    <span className="text-sm font-black text-text-primary">
                                                        {m.value.toFixed(3)} <span className="text-xs font-bold text-text-muted">{m.unit ?? "mg/L"}</span>
                                                    </span>
                                                </div>
                                                {confidenceBadge}
                                            </div>
                                        );
                                    }

                                    // Desktop: โชว์ค่าที่วัดได้ inline ตามเดิม
                                    return (
                                        <div key={m.parameterId} className="flex items-center justify-between gap-2 bg-surface border border-border/40 rounded-lg p-2 shadow-3xs">
                                            <div className="flex items-center gap-1 min-w-0">
                                                <span className="text-xs font-bold text-text-primary uppercase truncate">{m.parameterName ?? "ไม่ทราบสาร"}</span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-sm font-black text-text-primary">
                                                    {m.value.toFixed(3)} <span className="text-xs font-bold text-text-muted">{m.unit ?? "mg/L"}</span>
                                                </span>
                                                {confidenceBadge}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 🖼Header 2. คอลัมน์ขวา: จัดรูปถ่ายและรูปกราฟสีให้อยู่ในแนวนอนแพ็คคู่เคียงข้างฝั่งขวา */}
                            <div className="flex gap-1.5 shrink-0 items-center">
                                {/* รูปถ่ายดิบ */}
                                <div
                                    onClick={() => s.rawImageUrl && onPreviewImage({ raw: s.rawImageUrl, analyzed: s.analyzedPlotUrl, active: "raw" })}
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
                                    onClick={() => s.analyzedPlotUrl && onPreviewImage({ raw: s.rawImageUrl, analyzed: s.analyzedPlotUrl, active: "analyzed" })}
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
            {item.statusRequest !== "pending" && (
                <div className="text-xs text-text-muted bg-surface-subtle border border-border/60 rounded-xl p-2.5 font-medium">
                    <p>
                        ตัดสินโดย <span className="font-bold text-text-secondary">{item.reviewedBy?.name ?? "-"}</span> เมื่อ {formatDateTime(item.reviewedAt)}
                    </p>
                    {/* break-words + overflow-wrap: ตัดกลางคำได้ กันข้อความยาวติดกันไม่มีเว้นวรรคทะลุกรอบ */}
                    {item.reviewNote && <p className="text-text-danger font-semibold bg-red-500/5 p-1.5 rounded-md border border-red-500/10 mt-1 break-words [overflow-wrap:anywhere]">เหตุผล: {item.reviewNote}</p>}
                </div>
            )}

            {/* ปุ่มกลุ่ม Actions การจัดการระบบในแท็บรออนุมัติ */}
            {item.statusRequest === "pending" && (
                <div className="flex gap-2 pt-0.5">
                    <button
                        onClick={() => onOpenReject(item)}
                        disabled={actingId === item.id}
                        className="flex-1 py-2 min-h-[38px] rounded-xl text-xs font-bold flex items-center justify-center gap-1 bg-surface-subtle hover:bg-bg-danger border border-border hover:border-border-danger text-text-secondary hover:text-text-danger transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <X size={13} /> ปฏิเสธทั้งหมด
                    </button>
                    <button
                        onClick={() => onApprove(item, showSampleSelect ? selectedSampleIds : undefined)}
                        disabled={actingId === item.id || noneSelected}
                        title={noneSelected ? "ไม่ได้เลือกสารใดเลย — กรุณาใช้ปุ่มปฏิเสธทั้งหมดแทน" : undefined}
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
    // เปลือก (backdrop/หัวข้อ/ปุ่มปิด/Esc/แอนิเมชัน + mobile=sheet, desktop=popup) จัดการโดย Popup กลาง
    // ระหว่างกำลังบันทึกจะไม่ให้ปิดผ่าน backdrop/Esc กันปฏิเสธค้างครึ่งทาง
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
                    {/* counter เตือนผู้กรอกว่าเหลือพื้นที่เท่าไหร่ — เปลี่ยนเป็นสีแดงเมื่อชนเพดาน */}
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
    // สลับได้ระหว่างภาพถ่ายดิบกับภาพ AI — เริ่มที่ภาพที่ผู้ใช้กดเปิด
    const [active, setActive] = useState<"raw" | "analyzed">(images.active);
    const currentUrl = active === "raw" ? images.raw : images.analyzed;

    const tabs: { key: "raw" | "analyzed"; label: string; url: string | null }[] = [
        { key: "raw", label: "ภาพถ่าย", url: images.raw },
        { key: "analyzed", label: "ภาพ AI", url: images.analyzed },
    ];

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xs z-2000 flex flex-col items-center justify-center p-2 animate-in fade-in duration-200" onClick={onClose}>
            {/* ปุ่มปิดมุมขวาบน */}
            <button
                onClick={onClose}
                className="absolute top-35 right-5 w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer"
            >
                <X size={20} />
            </button>

            {/* ปุ่มสลับภาพถ่ายดิบ / ภาพ AI — ปิดปุ่มไว้ถ้าไม่มีภาพนั้น | stopPropagation กันกดโดนแล้วปิด lightbox */}
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

            {/* รูปภาพขยายเต็มตา */}
            <div className="relative max-w-full max-h-[70vh] rounded-2xl overflow-hidden shadow-2xl">
                <img
                    src={currentUrl ?? undefined}
                    alt={active === "raw" ? "ภาพถ่ายดิบ" : "ภาพวิเคราะห์จาก AI"}
                    className="max-w-full max-h-[70vh] object-contain"
                    onClick={(e) => e.stopPropagation()} // กันกดโดนรูปแล้วปิด
                />
            </div>
            <p className="text-white text-xs font-semibold mt-4 tracking-wide select-none">แตะพื้นที่ว่างเพื่อปิดหน้าต่างขยาย</p>
        </div>
    );
}
