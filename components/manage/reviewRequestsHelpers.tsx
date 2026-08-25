"use client";

import { useState } from "react";
import { isLowConfidence, CONFIDENCE_THRESHOLD, evaluateSample, type StandardRow, type MeasuredValue } from "@/lib/standards";
import { REVIEW_NOTE_MAX_LENGTH } from "@/lib/reviewConstants";
import { readChemMeasurements } from "@/lib/chemLabels";
import { MapPin, Check, X, ImageOff, Clock, FileScan, Calendar, Beaker, CheckCircle2, XCircle, Info, UserRound, Images, Edit2 } from "lucide-react";
import StatusBadge from "@/components/map/StatusBadge";
import Popup from "@/components/Popup";

export type ReviewStatusFilter = "pending" | "approved" | "rejected";

export interface ReviewMeasurement {
    parameterId: number;
    parameterName: string | null;
    unit: string | null;
    value: number;
    confidence: number;
    message: string | null;
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
    statusRequest: ReviewStatusFilter | "edited_approved";
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
 * คำนวณประเมินสถานะคุณภาพน้ำ (safe/warning/danger) ของคำร้อง
 */
export function getSampleWaterStatus(item: ReviewRequestItem, standards: StandardRow[]): "safe" | "warning" | "danger" {
    const values: MeasuredValue[] = item.samples.flatMap((s) => s.measurements).map((m) => ({ parameterId: m.parameterId, value: m.value }));
    return evaluateSample(values, standards);
}

/** วันที่พร้อมเวลาแบบเต็ม สำหรับหน้ารายละเอียด — ต่างจาก formatDateTime ที่ย่อเหลือเฉพาะวัน */
export function formatDateTimeFull(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleString("th-TH", {
        year: "2-digit",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** แถวข้อมูล ไอคอน + ป้ายกำกับ + ค่า ใช้ซ้ำในกล่องรายละเอียด */
function InfoRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
    return (
        <div className="flex items-start gap-2.5 min-w-0">
            <Icon size={14} className="text-text-muted shrink-0 mt-0.5" />
            <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</div>
                <div className="text-xs font-semibold text-text break-words [overflow-wrap:anywhere]">{value}</div>
            </div>
        </div>
    );
}

/**
 * รูปย่อ 1 ใบในกล่องรายละเอียด กดเพื่อเปิดดูขนาดเต็ม
 * ไฟล์ที่ถูกลบไปแล้ว (หรือ path ค้างใน DB) จะ 404 — จับด้วย onError แล้วสลับเป็นกล่องแจ้งแทนรูปแตก
 */
function DetailThumb({ url, label, onOpen }: { url: string; label: string; onOpen: () => void }) {
    const [isBroken, setIsBroken] = useState(false);

    if (isBroken) {
        return (
            <div className="flex-1 aspect-4/3 rounded-xl border border-dashed border-border bg-surface-subtle flex flex-col items-center justify-center gap-1 text-text-muted">
                <ImageOff size={16} />
                <span className="text-[10px] font-semibold text-center px-1">{label} — โหลดไม่ได้</span>
            </div>
        );
    }

    return (
        <button type="button" onClick={onOpen} className="flex-1 group relative aspect-4/3 rounded-xl overflow-hidden border border-border cursor-pointer">
            <img src={url} alt={label} onError={() => setIsBroken(true)} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] font-semibold py-1 text-center">{label}</span>
        </button>
    );
}

/**
 * กล่องรายละเอียดคำร้องแบบเต็ม — ข้อมูลจุดตรวจ ค่าที่วัดได้ทุกสาร ภาพประกอบ และผลการตัดสิน
 * รูปในนี้เป็นแค่ตัวย่อ กดแล้วส่งต่อให้ ImageLightbox ที่หน้าแม่เปิดขนาดเต็มอีกที
 */
export function RequestDetailPopup({
    item,
    standards,
    onClose,
    onPreviewImage,
}: {
    item: ReviewRequestItem;
    standards: StandardRow[];
    onClose: () => void;
    onPreviewImage: (images: PreviewImages) => void;
}) {
    const waterStatus = getSampleWaterStatus(item, standards);
    const samplesWithImage = item.samples.filter((s) => s.rawImageUrl || s.analyzedPlotUrl);

    const requestStatusLabel =
        item.statusRequest === "pending" ? "รอตรวจสอบ" : item.statusRequest === "approved" ? "อนุมัติแล้ว" : item.statusRequest === "edited_approved" ? "แก้ไขแล้วอนุมัติ" : "ปฏิเสธแล้ว";
    const requestStatusStyle =
        item.statusRequest === "pending"
            ? "text-text-warning bg-bg-warning border-border-warning"
            : item.statusRequest === "approved"
              ? "text-teal-600 bg-teal-50 border-teal-200"
              : item.statusRequest === "edited_approved"
                ? "text-orange-600 bg-orange-50 border-orange-200"
                : "text-red-600 bg-red-50 border-red-200";

    return (
        <Popup title="รายละเอียดคำร้อง" onClose={onClose} maxWidth="max-w-xl">
            {/* ไม่ต้องครอบ overflow เอง — Popup จำกัดความสูงและเลื่อนให้แล้วทั้งโหมด sheet และ popup */}
            <div className="space-y-5">
                {/* หัวเรื่อง: สถานที่ + สถานะน้ำ + สถานะคำร้อง */}
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h4 className="text-sm font-bold text-text break-words">{item.location?.name || "ไม่ทราบสถานที่"}</h4>
                        <p className="text-xs text-text-muted font-medium mt-0.5">{item.location?.organization || "ไม่ระบุหน่วยงาน"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={waterStatus} size="sm" />
                        <span className={`inline-flex items-center w-20 text-xs font-semibold border p-1 justify-center rounded-md whitespace-nowrap ${requestStatusStyle}`}>{requestStatusLabel}</span>
                    </div>
                </div>

                {/* ข้อมูลกำกับการเก็บตัวอย่าง */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 bg-surface-subtle border border-border rounded-xl p-3.5">
                    <InfoRow icon={FileScan} label="รหัสกลุ่ม" value={item.sessionGroup || "ไม่ระบุรหัส"} />
                    <InfoRow icon={Calendar} label="เวลาเก็บตัวอย่าง" value={formatDateTimeFull(item.collectionTime)} />
                    <InfoRow icon={UserRound} label="ผู้เก็บตัวอย่าง" value={item.collector?.name || "-"} />
                    <InfoRow icon={Clock} label="ส่งคำร้องเมื่อ" value={formatDateTimeFull(item.createdAt)} />
                </div>

                {/* แสดงสิทธิ์การแก้ไขสาร และ หมายเหตุจากผู้แจ้ง (เฉพาะสถานะ pending) */}
                {item.statusRequest === "pending" && (
                    <div className="space-y-2">
                        {item.samples.flatMap((s) => s.measurements).some((m) => m.message?.includes("[USER_REQUEST_CHANGE]")) ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-teal-50 text-teal-700 rounded-md text-xs font-bold border border-teal-200">
                                <CheckCircle2 size={14} />
                                <span>ผู้แจ้งอนุญาตให้ผู้เชี่ยวชาญสลับสารได้</span>
                            </div>
                        ) : (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-red-50 text-red-700 rounded-md text-xs font-bold border border-red-200">
                                <XCircle size={14} />
                                <span>ไม่อนุญาตให้ผู้เชี่ยวชาญสลับสาร</span>
                            </div>
                        )}
                        {item.reviewNote && (
                            <div className="text-sm bg-amber-50/50 text-amber-900/90 border border-amber-200/60 p-3 rounded-lg break-words [overflow-wrap:anywhere]">
                                <span className="font-semibold">หมายเหตุจากผู้แจ้ง: </span>
                                {item.reviewNote}
                            </div>
                        )}
                    </div>
                )}

                {/* ค่าที่วัดได้ทุกสาร พร้อมค่าความมั่นใจของ AI */}
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-text">
                        <Beaker size={14} className="text-primary" />
                        <span>ผลการวิเคราะห์</span>
                    </div>

                    {item.samples.flatMap((s) => s.measurements).length === 0 ? (
                        <p className="text-xs text-text-muted bg-surface-subtle border border-border rounded-xl p-3">ไม่พบข้อมูลผลวิเคราะห์ในคำร้องนี้</p>
                    ) : (
                        <div className="space-y-1.5">
                            {item.samples.flatMap((s) =>
                                s.measurements.map((m) => (
                                    <div key={`${s.id}-${m.parameterId}`} className="flex items-center justify-between gap-3 bg-surface-subtle border border-border rounded-xl px-3 py-2.5">
                                        <span className="text-xs font-semibold text-text truncate">{m.parameterName || "ไม่ระบุสาร"}</span>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs font-bold text-text tabular-nums">
                                                {Number(m.value).toFixed(2)}
                                                {m.unit ? <span className="text-text-muted font-medium"> {m.unit}</span> : null}
                                            </span>
                                            <span
                                                className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                                                    isLowConfidence(m.confidence) ? "text-text-danger bg-bg-danger border-border-danger" : "text-text-safe bg-bg-safe border-border-safe"
                                                }`}
                                                title={`ค่าความมั่นใจของ AI (เกณฑ์ขั้นต่ำ ${CONFIDENCE_THRESHOLD.toFixed(2)})`}
                                            >
                                                conf. {m.confidence.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )),
                            )}
                        </div>
                    )}
                </div>

                {/* ภาพประกอบ แยกตามสารที่มีภาพแนบ */}
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-text">
                        <Images size={14} className="text-primary" />
                        <span>ภาพประกอบ</span>
                    </div>

                    {samplesWithImage.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-1.5 bg-surface-subtle border border-dashed border-border rounded-xl p-6 text-text-muted">
                            <ImageOff size={18} />
                            <p className="text-xs font-semibold">ไม่มีภาพถ่ายหรือภาพวิเคราะห์แนบมา</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {samplesWithImage.map((s) => {
                                const sampleLabel =
                                    s.measurements
                                        .map((m) => m.parameterName)
                                        .filter(Boolean)
                                        .join(", ") || "ไม่ระบุสาร";
                                return (
                                    <div key={s.id} className="space-y-1.5">
                                        <span className="text-[11px] font-bold text-text-secondary">{sampleLabel}</span>
                                        <div className="flex gap-2">
                                            {s.rawImageUrl && (
                                                <DetailThumb url={s.rawImageUrl} label="ภาพถ่าย" onOpen={() => onPreviewImage({ raw: s.rawImageUrl, analyzed: s.analyzedPlotUrl, active: "raw" })} />
                                            )}
                                            {s.analyzedPlotUrl && (
                                                <DetailThumb
                                                    url={s.analyzedPlotUrl}
                                                    label="ภาพ AI"
                                                    onOpen={() => onPreviewImage({ raw: s.rawImageUrl, analyzed: s.analyzedPlotUrl, active: "analyzed" })}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ผลการตัดสิน แสดงเฉพาะคำร้องที่ผ่านการอนุมัติ/ปฏิเสธแล้ว */}
                {item.statusRequest !== "pending" && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-text">
                            {item.statusRequest === "approved" ? (
                                <CheckCircle2 size={14} className="text-teal-600" />
                            ) : item.statusRequest === "edited_approved" ? (
                                <CheckCircle2 size={14} className="text-orange-600" />
                            ) : (
                                <XCircle size={14} className="text-red-600" />
                            )}
                            <span>ผลการตัดสิน</span>
                        </div>
                        <div className="bg-surface-subtle border border-border rounded-xl p-3.5 space-y-2.5">
                            <InfoRow icon={UserRound} label="ผู้ตัดสิน" value={item.reviewedBy?.name ?? "-"} />
                            <InfoRow icon={Clock} label="ตัดสินเมื่อ" value={formatDateTimeFull(item.reviewedAt)} />
                            {item.reviewNote && (
                                <p className="text-xs text-text-danger font-semibold bg-red-500/5 p-2 rounded-lg border border-red-500/10 break-words [overflow-wrap:anywhere]">
                                    เหตุผล: {item.reviewNote}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Popup>
    );
}

export function RequestCard({
    item,
    standards,
    actingId,
    onOpenReject,
    onApprove,
    onPreviewImage,
    onOpenEditApprove,
    mobile,
}: {
    item: ReviewRequestItem;
    standards: StandardRow[];
    actingId: number | null;
    onOpenReject: (item: ReviewRequestItem) => void;
    onApprove: (item: ReviewRequestItem, approvedSampleIds?: number[]) => void;
    onPreviewImage: (images: PreviewImages) => void;
    onOpenEditApprove?: (item: ReviewRequestItem, preSelectedSampleIds?: number[]) => void;
    mobile?: boolean;
}) {
    const isMultiSample = item.samples.length > 1;
    const showSampleSelect = item.statusRequest === "pending" && isMultiSample;
    const [selectedSampleIds, setSelectedSampleIds] = useState<number[]>(() => item.samples.filter((s) => !s.measurements.some((m) => isLowConfidence(m.confidence))).map((s) => s.id));
    const toggleSample = (id: number) => setSelectedSampleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const noneSelected = showSampleSelect && selectedSampleIds.length === 0;

    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // ค่าสารเคมีของคำร้องนี้ — dynamic ตามสารที่มีอยู่จริง ไม่ผูกชื่อสารไว้ตายตัว
    const chemReadings = readChemMeasurements(item.samples.flatMap((s) => s.measurements));

    const waterStatus = getSampleWaterStatus(item, standards);

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

                            {/* แถวล่าง: แสดงค่าสารเคมีชิปเล็ก — dynamic ตามสารที่มีอยู่จริง */}
                            <div className="flex items-center gap-2 mt-1 w-full">
                                {chemReadings.map((c) => (
                                    <div key={c.key} className="flex items-center gap-1 bg-surface-subtle px-2 py-1 rounded-md text-xs font-semibold text-text shrink-0">
                                        <Beaker size={10} className={c.color} />
                                        <span>
                                            {c.abbrev}: {c.value.toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            
                            {/* แสดงหมายเหตุผู้แจ้ง (ถ้ามีและยัง pending อยู่) */}
                            {item.statusRequest === "pending" && item.reviewNote && (
                                <div className="mt-2 text-xs bg-amber-50/50 text-amber-900/90 border border-amber-200/60 p-2 rounded-md break-words [overflow-wrap:anywhere]">
                                    <span className="font-semibold">หมายเหตุ: </span>
                                    {item.reviewNote}
                                </div>
                            )}
                            
                            {/* แจ้งเตือนสิทธิ์การแก้ไขชนิดสาร (เฉพาะสถานะ pending) */}
                            {item.statusRequest === "pending" && (
                                <div className="mt-2 flex items-center gap-2">
                                    {item.samples.flatMap((s) => s.measurements).some((m) => m.message?.includes("[USER_REQUEST_CHANGE]")) ? (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-teal-50 text-teal-700 rounded-md text-[10px] font-bold border border-teal-200">
                                            <CheckCircle2 size={12} />
                                            <span>ผู้แจ้งอนุญาตให้สลับสารได้</span>
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 rounded-md text-[10px] font-bold border border-red-200">
                                            <XCircle size={12} />
                                            <span>ไม่อนุญาตให้สลับสาร</span>
                                        </div>
                                    )}
                                </div>
                            )}
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
                        <span className="inline-flex items-center px-2 text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-200 p-1 justify-center rounded-md whitespace-nowrap">
                            อนุมัติแล้ว
                        </span>
                    )}
                    {item.statusRequest === "edited_approved" && (
                        <span className="inline-flex items-center px-2 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 p-1 justify-center rounded-md whitespace-nowrap">
                            แก้ไขแล้วอนุมัติ
                        </span>
                    )}
                    {item.statusRequest === "rejected" && (
                        <span className="inline-flex items-center px-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 p-1 justify-center rounded-md whitespace-nowrap">
                            ปฏิเสธแล้ว
                        </span>
                    )}
                </div>
            </div>

            {/* ── โซนเลือกสารกรณีมีหลายสารในแท็บรออนุมัติ ── */}
            {showSampleSelect && (
                <div className="bg-surface-subtle border border-border/60 rounded-xl p-2.5 space-y-2">
                    <span className="text-xs font-bold text-text-secondary uppercase block">เลือกอนุมัติเฉพาะสาร:</span>
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
                                        title={`ค่าความมั่นใจของ AI (เกณฑ์ขั้นต่ำ ${CONFIDENCE_THRESHOLD.toFixed(2)})`}
                                    >
                                        conf. {m.confidence.toFixed(2)}
                                    </span>
                                ))}
                            </div>
                        </label>
                    ))}
                </div>
            )}

            {/* ── สารตัวเดียว: ไม่มีอะไรให้เลือกซับเซ็ต แต่ยังต้องเห็น conf. เหมือนกรณีหลายสาร ── */}
            {item.statusRequest === "pending" && !isMultiSample && (
                <div className="bg-surface-subtle border border-border/60 rounded-xl p-2.5 space-y-1.5">
                    {item.samples
                        .flatMap((s) => s.measurements)
                        .map((m) => (
                            <div key={m.parameterId} className="flex items-center justify-between text-xs bg-card-general border border-border/50 rounded-lg p-2">
                                <span className="font-bold text-text">{m.parameterName || "ไม่ระบุสาร"}</span>
                                <span
                                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                                        isLowConfidence(m.confidence) ? "text-text-danger bg-bg-danger border-border-danger" : "text-text-safe bg-bg-safe border-border-safe"
                                    }`}
                                    title={`ค่าความมั่นใจของ AI (เกณฑ์ขั้นต่ำ ${CONFIDENCE_THRESHOLD.toFixed(2)})`}
                                >
                                    conf. {m.confidence.toFixed(2)}
                                </span>
                            </div>
                        ))}
                </div>
            )}

            {/* สรุปผลการตรวจเดิมกรณีอนุมัติ/ปฏิเสธแล้ว */}
            {item.statusRequest !== "pending" && (
                <div className="text-xs text-text-muted bg-surface-subtle border border-border/60 rounded-xl p-2.5 font-medium">
                    <p>
                        ตัดสินโดย <span className="font-bold text-text-secondary">{item.reviewedBy?.name ?? "-"}</span> เมื่อ {formatDateTime(item.reviewedAt)}
                    </p>
                    {item.reviewNote && <p className="text-text-danger font-semibold bg-red-500/5 p-1.5 rounded-md border border-red-500/10 mt-1 wrap-break-word">เหตุผล: {item.reviewNote}</p>}
                </div>
            )}

            {/* ── แถบปุ่ม Actions จัดการ ── */}
            <div className="flex flex-col gap-2 pt-3 border-t border-border">
                <button
                    type="button"
                    onClick={() => setIsDetailOpen(true)}
                    className="w-full min-h-9 px-3 rounded-xl border border-border text-xs font-semibold text-text hover:bg-surface-subtle flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                    <Info size={14} />
                    <span>ดูรายละเอียด</span>
                </button>

                {item.statusRequest === "pending" && (
                    <div className="flex items-stretch gap-2 w-full">
                        <button
                            type="button"
                            disabled={actingId === item.id}
                            onClick={() => onOpenReject(item)}
                            className="flex-1 min-h-9 px-2 rounded-xl bg-bg-danger hover:bg-red-100 text-text-danger border border-border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                            <XCircle size={14} />
                            <span>ปฏิเสธ</span>
                        </button>
                        <button
                            type="button"
                            disabled={actingId === item.id || noneSelected}
                            onClick={() => onOpenEditApprove?.(item, showSampleSelect ? selectedSampleIds : undefined)}
                            className="flex-1 min-h-9 px-2 rounded-xl bg-bg-warning hover:bg-orange-100 text-text-warning border border-border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                            <Edit2 size={14} />
                            <span>แก้ไข</span>
                        </button>
                        <button
                            type="button"
                            disabled={actingId === item.id || noneSelected}
                            onClick={() => onApprove(item, showSampleSelect ? selectedSampleIds : undefined)}
                            className="flex-1 min-h-9 px-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                            {actingId === item.id ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
                            <span>อนุมัติ</span>
                        </button>
                    </div>
                )}
            </div>

            {isDetailOpen && <RequestDetailPopup item={item} standards={standards} onClose={() => setIsDetailOpen(false)} onPreviewImage={onPreviewImage} />}
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
    onPreviewImage,
}: {
    rejectTarget: ReviewRequestItem;
    rejectNote: string;
    setRejectNote: (v: string) => void;
    rejectSaving: boolean;
    onClose: () => void;
    onSubmit: () => void;
    onPreviewImage?: (images: PreviewImages) => void;
}) {
    return (
        <Popup title="ปฏิเสธคำร้อง" onClose={() => !rejectSaving && onClose()}>
            <div className="space-y-6">
                <p className="text-xs text-text-secondary leading-relaxed">
                    ผลตรวจของ &quot;{rejectTarget.location?.name ?? "จุดตรวจนี้"}&quot; จะไม่ถูกนำไปคำนวณในภาพรวมของระบบ กรุณาระบุเหตุผลเพื่อให้ผู้เก็บตัวอย่างรับทราบ
                    (ผู้เก็บจะยังคงเห็นรายการนี้ในหน้าประวัติของตนเอง)
                </p>

                {/* Image Context */}
                {rejectTarget.samples.some((s) => s.rawImageUrl || s.analyzedPlotUrl) && (
                    <div className="bg-surface-subtle border border-border rounded-xl p-2.5 flex items-center gap-3 overflow-x-auto">
                        <span className="text-[10px] font-bold text-text-muted uppercase shrink-0 whitespace-nowrap">ภาพอ้างอิง:</span>
                        <div className="flex items-center gap-2">
                            {rejectTarget.samples
                                .filter((s) => s.rawImageUrl || s.analyzedPlotUrl)
                                .map((s) => (
                                    <div key={s.id} className="flex gap-2">
                                        {s.rawImageUrl && (
                                            <img
                                                src={s.rawImageUrl}
                                                alt="ภาพถ่าย"
                                                className="h-12 w-auto object-cover rounded-md border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => onPreviewImage?.({ raw: s.rawImageUrl, analyzed: s.analyzedPlotUrl, active: "raw" })}
                                            />
                                        )}
                                        {s.analyzedPlotUrl && (
                                            <img
                                                src={s.analyzedPlotUrl}
                                                alt="ภาพ AI"
                                                className="h-12 w-auto object-cover rounded-md border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => onPreviewImage?.({ raw: s.rawImageUrl, analyzed: s.analyzedPlotUrl, active: "analyzed" })}
                                            />
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                <div className="space-y-2.5">
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">เหตุผลในการปฏิเสธ *</label>
                        <span className={`text-[10px] font-medium tabular-nums ${rejectNote.length >= REVIEW_NOTE_MAX_LENGTH ? "text-text-danger" : "text-text-muted"}`}>
                            {rejectNote.length}/{REVIEW_NOTE_MAX_LENGTH}
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {["ภาพไม่ชัดเจน/เบลอ", "สเกลสีไม่ตรงรุ่น", "แสงจ้า/เงาบัง"].map((text) => (
                            <button
                                key={text}
                                type="button"
                                onClick={() => setRejectNote(rejectNote ? `${rejectNote} ${text}` : text)}
                                className="text-[10px] font-medium bg-surface hover:bg-surface-subtle border border-border text-text-secondary px-2 py-1 rounded-md transition-colors cursor-pointer"
                            >
                                {text}
                            </button>
                        ))}
                    </div>

                    <textarea
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="เช่น ภาพเบลอ มองไม่เห็นสีของเหลวชัดเจน กรุณาถ่ายใหม่"
                        rows={3}
                        maxLength={REVIEW_NOTE_MAX_LENGTH}
                        className="w-full px-4 py-3.5 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none transition-all resize-none"
                    />
                    <p className="text-[10px] text-text-muted mt-1.5">ข้อความนี้จะถูกแสดงให้อาสาสมัครเห็นในหน้าประวัติการส่งข้อมูล</p>
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

export function EditApproveDrawer({
    editTarget,
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
    onClose,
    onSubmit,
    onPreviewImage,
}: {
    editTarget: ReviewRequestItem;
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
    onClose: () => void;
    onSubmit: () => void;
    onPreviewImage?: (images: PreviewImages) => void;
}) {
    const isMultiSample = editTarget.samples.length > 1;
    const userRequestedChange = editTarget.samples.flatMap((s) => s.measurements).some((m) => m.message?.includes("[USER_REQUEST_CHANGE]"));
    const toggleSample = (id: number) => setEditSelectedSampleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    const noneSelected = editSelectedSampleIds.length === 0;

    return (
        <Popup title="แก้ไขและอนุมัติคำร้อง" onClose={() => !editSaving && onClose()}>
            <div className="space-y-6">
                <p className="text-xs text-text-secondary leading-relaxed">
                    คุณสามารถแก้ไขค่าสารที่ระบบ AI วิเคราะห์ผิดพลาดได้ที่นี่ และเมื่อยืนยัน ข้อมูลจะถูกบันทึกเป็นค่าที่ถูกต้องและได้รับการอนุมัติ
                </p>

                {/* Image Context */}
                {editTarget.samples.some((s) => s.rawImageUrl || s.analyzedPlotUrl) && (
                    <div className="bg-surface-subtle border border-border rounded-xl p-2.5 flex items-center gap-3 overflow-x-auto">
                        <span className="text-[10px] font-bold text-text-muted uppercase shrink-0 whitespace-nowrap">ภาพอ้างอิง:</span>
                        <div className="flex items-center gap-2">
                            {editTarget.samples
                                .filter((s) => s.rawImageUrl || s.analyzedPlotUrl)
                                .map((s) => (
                                    <div key={s.id} className="flex gap-2">
                                        {s.rawImageUrl && (
                                            <img
                                                src={s.rawImageUrl}
                                                alt="ภาพถ่าย"
                                                className="h-12 w-auto object-cover rounded-md border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => onPreviewImage?.({ raw: s.rawImageUrl, analyzed: s.analyzedPlotUrl, active: "raw" })}
                                            />
                                        )}
                                        {s.analyzedPlotUrl && (
                                            <img
                                                src={s.analyzedPlotUrl}
                                                alt="ภาพ AI"
                                                className="h-12 w-auto object-cover rounded-md border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                                onClick={() => onPreviewImage?.({ raw: s.rawImageUrl, analyzed: s.analyzedPlotUrl, active: "analyzed" })}
                                            />
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">ปรับแก้ค่าสาร</label>
                        {isMultiSample && <span className="text-[10px] font-medium text-text-muted">เลือกเฉพาะสารที่จะอนุมัติ</span>}
                    </div>
                    <div className="bg-surface-subtle border border-border rounded-xl p-3 space-y-3">
                        {editTarget.samples.map((s) => {
                            const isSelected = editSelectedSampleIds.includes(s.id);
                            return (
                                <div key={s.id} className={`space-y-2 ${isMultiSample ? "pb-2.5 border-b border-border/60 last:border-b-0 last:pb-0" : ""}`}>
                                    {isMultiSample && (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSample(s.id)}
                                                className="w-4 h-4 accent-teal-700 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-text">{s.measurements.map((m) => m.parameterName || "ไม่ระบุสาร").join(", ")}</span>
                                        </label>
                                    )}
                                    <div className={`space-y-3 ${isMultiSample ? "pl-6" : ""} ${!isSelected ? "opacity-40" : ""}`}>
                                        {s.measurements.map((m) => {
                                            // หารายชื่อสารที่ถูกเลือกในใบอื่น ๆ ของ session เดียวกัน (ป้องกันการเลือกสารซ้ำ)
                                            const otherSelectedParams = editTarget.samples
                                                .filter(otherS => otherS.id !== s.id && editSelectedSampleIds.includes(otherS.id))
                                                .flatMap(otherS => otherS.measurements.map(otherM => editParameters[otherM.parameterId] ?? otherM.parameterId));

                                            return (
                                                <div key={m.parameterId} className="flex flex-col gap-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <select
                                                            disabled={!isSelected || !userRequestedChange}
                                                            title={!userRequestedChange ? "ผู้ใช้ไม่ได้เปิดสิทธิ์ให้แอดมินเปลี่ยนสาร (หากผิดกรุณากดปฏิเสธ)" : ""}
                                                            value={editParameters[m.parameterId] ?? m.parameterId}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value);
                                                                setEditParameters((prev) => ({ ...prev, [m.parameterId]: val }));
                                                            }}
                                                            className="flex-1 min-w-0 bg-surface border border-border rounded-lg px-2 py-1.5 text-xs font-semibold text-text uppercase outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-70"
                                                        >
                                                            {systemParameters.map(p => (
                                                                <option 
                                                                    key={p.id} 
                                                                    value={p.id}
                                                                    disabled={otherSelectedParams.includes(p.id)}
                                                                >
                                                                    {p.name} {p.id === m.parameterId ? "(เดิม)" : ""} {otherSelectedParams.includes(p.id) ? "(เลือกแล้ว)" : ""}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                disabled={!isSelected}
                                                                value={editMeasurements[m.parameterId] ?? m.value}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setEditMeasurements((prev) => ({ ...prev, [m.parameterId]: val ? parseFloat(val) : 0 }));
                                                                }}
                                                                className="w-20 px-2 py-1.5 bg-bg border border-border rounded-lg text-xs font-semibold text-center outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed"
                                                            />
                                                            {m.unit && <span className="text-xs text-text-muted w-6">{m.unit}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {isMultiSample && editSelectedSampleIds.length < editTarget.samples.length && (
                        <p className="text-[10px] font-medium text-text-danger bg-red-500/5 px-2.5 py-1.5 rounded-lg border border-red-500/10">
                            สารที่ไม่ได้เลือกจะถูกปฏิเสธ
                        </p>
                    )}
                </div>

                <div className="space-y-2.5">
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">หมายเหตุการแก้ไข *</label>
                        <span className={`text-[10px] font-medium tabular-nums ${editNote.length >= REVIEW_NOTE_MAX_LENGTH ? "text-text-danger" : "text-text-muted"}`}>
                            {editNote.length}/{REVIEW_NOTE_MAX_LENGTH}
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {["ปรับค่าตามภาพที่เห็นจริง", "AI อ่านค่าผิดพลาดจากแสง", "แก้ให้ตรงกับสีมาตรฐาน"].map((text) => (
                            <button
                                key={text}
                                type="button"
                                onClick={() => setEditNote(editNote ? `${editNote} ${text}` : text)}
                                className="text-[10px] font-medium bg-surface hover:bg-surface-subtle border border-border text-text-secondary px-2 py-1 rounded-md transition-colors cursor-pointer"
                            >
                                {text}
                            </button>
                        ))}
                    </div>

                    <textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="เช่น ปรับค่า pH ตามรูปถ่ายที่เห็นจริง"
                        rows={3}
                        maxLength={REVIEW_NOTE_MAX_LENGTH}
                        className="w-full px-4 py-3.5 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 outline-none transition-all resize-none"
                    />
                    <p className="text-[10px] text-text-muted mt-1.5">ข้อความนี้จะถูกแสดงให้อาสาสมัครเห็นในหน้าประวัติการส่งข้อมูล</p>
                </div>

                <button
                    onClick={onSubmit}
                    disabled={editSaving || !editNote.trim() || noneSelected}
                    className="w-full py-4 min-h-13 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
                >
                    {editSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
                    บันทึกและอนุมัติ
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
