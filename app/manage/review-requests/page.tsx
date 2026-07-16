"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { confirmDialog, alertError } from "@/lib/swal";
import { useToast } from "@/components/useToast";
import { isLowConfidence, CONFIDENCE_THRESHOLD } from "@/lib/standards";
import { refreshNavDots } from "@/lib/navEvents";
import { ArrowLeft, ShieldAlert, ClipboardCheck, RefreshCw, MapPin, User, Calendar, Check, X, ImageOff, AlertCircle } from "lucide-react";

type ReviewStatusFilter = "pending" | "approved" | "rejected";

interface ReviewMeasurement {
    parameterId: number;
    parameterName: string | null;
    unit: string | null;
    value: number;
    confidence: number;
}

interface ReviewSample {
    id: number;
    rawImageUrl: string | null;
    analyzedPlotUrl: string | null;
    measurements: ReviewMeasurement[];
}

interface ReviewRequestItem {
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

const TAB_CONFIG: { id: ReviewStatusFilter; label: string }[] = [
    { id: "pending", label: "รออนุมัติ" },
    { id: "approved", label: "อนุมัติแล้ว" },
    { id: "rejected", label: "ปฏิเสธแล้ว" },
];

function formatDateTime(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function AdminReviewRequestsPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const { showToast, toastElement } = useToast();

    const [tab, setTab] = useState<ReviewStatusFilter>("pending");
    const [requests, setRequests] = useState<ReviewRequestItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actingId, setActingId] = useState<number | null>(null);

    // Reject drawer — reason ต้องกรอกเสมอก่อนส่ง (บังคับที่ API ด้วย)
    const [rejectTarget, setRejectTarget] = useState<ReviewRequestItem | null>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [rejectSaving, setRejectSaving] = useState(false);

    // silent=true สำหรับ refetch หลัง approve/reject — ไม่ให้ list ยุบเป็น spinner ทั้งก้อน
    const fetchRequests = useCallback(async (status: ReviewStatusFilter, silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await fetch(`/api/review-requests?status=${status}`, {
                headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
            });
            const data = await res.json();
            setRequests(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch review requests:", err);
            setRequests([]);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentUser?.role === "admin") {
            const timer = setTimeout(() => {
                fetchRequests(tab);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [currentUser?.role, tab, fetchRequests]);

    const handleApprove = async (item: ReviewRequestItem) => {
        const confirmed = await confirmDialog({
            title: "ยืนยันอนุมัติคำร้อง?",
            text: `ผลตรวจของ "${item.location?.name ?? "จุดตรวจนี้"}" จะแสดงบนแผนที่และแดชบอร์ดทันที`,
            confirmText: "อนุมัติ",
            tone: "primary",
        });
        if (!confirmed) return;

        setActingId(item.id);
        try {
            const res = await fetch(`/api/review-requests/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${liff.getAccessToken()}` },
                body: JSON.stringify({ action: "approve" }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "เกิดข้อผิดพลาดในการอนุมัติคำร้อง");

            showToast(`อนุมัติผลตรวจของ "${item.location?.name ?? "จุดตรวจ"}" แล้ว`, "success");
            fetchRequests(tab, true);
            refreshNavDots();
        } catch (err) {
            alertError("อนุมัติไม่สำเร็จ", err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง");
        } finally {
            setActingId(null);
        }
    };

    const openReject = (item: ReviewRequestItem) => {
        setRejectTarget(item);
        setRejectNote("");
    };

    const submitReject = async () => {
        if (!rejectTarget || !rejectNote.trim()) return;

        setRejectSaving(true);
        try {
            const res = await fetch(`/api/review-requests/${rejectTarget.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${liff.getAccessToken()}` },
                body: JSON.stringify({ action: "reject", note: rejectNote.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "เกิดข้อผิดพลาดในการปฏิเสธคำร้อง");

            showToast(`ปฏิเสธผลตรวจของ "${rejectTarget.location?.name ?? "จุดตรวจ"}" แล้ว`, "danger");
            setRejectTarget(null);
            fetchRequests(tab, true);
            refreshNavDots();
        } catch (err) {
            alertError("ปฏิเสธไม่สำเร็จ", err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง");
        } finally {
            setRejectSaving(false);
        }
    };

    // Role Security Gate
    if (!currentUser || currentUser.role !== "admin") {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center w-full max-w-lg mx-auto bg-surface-muted border-x border-border">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mb-4 border border-red-500/20">
                    <ShieldAlert size={28} className="animate-pulse" />
                </div>
                <h1 className="font-display text-base font-normal text-text-primary mb-1">สิทธิ์การเข้าถึงถูกจำกัด</h1>
                <p className="text-xs text-text-secondary mb-6 max-w-[80%] mx-auto leading-relaxed">หน้าตรวจสอบคำร้องสำหรับผู้ดูแลระบบสูงสุด (System Admin) เท่านั้น</p>
                <button
                    onClick={() => router.push("/map")}
                    className="w-full max-w-[200px] py-3.5 bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                >
                    กลับไปหน้าแผนที่
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <div className="bg-card-general border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-secondary min-h-11">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-primary">คุณภาพน้ำที่ต้องการยืนยัน</h1>
                </div>
                <div className="w-15" />
            </div>
            <div className="w-full max-w-4xl mx-auto px-4 pt-5">
                {/* Header card */}
                <div className="bg-card-general rounded-2xl border border-border  p-5 mb-6 transition-colors duration-300">
                    <h1 className="font-display text-lg font-bold text-black ">
                        ตรวจสอบผลที่มี <span className="font-display text-primary">Confidence ต่ำ</span>
                    </h1>
                    <p className="text-black text-xs mt-1 leading-relaxed">
                        ผลตรวจที่ AI วิเคราะห์ได้ค่าความมั่นใจต่ำกว่า {CONFIDENCE_THRESHOLD.toFixed(2)} จะถูกซ่อนจากแผนที่และแดชบอร์ดจนกว่าจะได้รับการยืนยันจากผู้ดูแลระบบ
                    </p>
                </div>

                {/* Tabs */}
                <div className="px-2 mb-1 text-sm text-primary font-semibold">สถานะที่ต้องการดู</div>
                <div className="flex items-center gap-1.5 mb-5">
                    {TAB_CONFIG.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex-1 py-3 rounded-xl text-xs font-semibold border border-border transition-all cursor-pointer ${
                                tab === t.id ? "bg-primary text-white border-primary" : "bg-card-general text-black border-border hover:border-primary/30"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* List */}
                <div className="space-y-5">
                    {isLoading ? (
                        <div className="bg-surface rounded-3xl p-10 text-center border border-border flex flex-col items-center justify-center gap-3">
                            <RefreshCw size={22} className="animate-spin text-primary" />
                            <span className="text-xs text-text-muted font-semibold">กำลังดาวน์โหลดรายการคำร้อง...</span>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="bg-surface rounded-3xl p-10 text-center border border-border shadow-sm">
                            <div className="w-14 h-14 bg-surface-subtle border border-border rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <ClipboardCheck size={20} className="text-text-muted" />
                            </div>
                            <p className="text-xs font-semibold text-text-muted">
                                {tab === "pending" ? "ไม่มีคำร้องรออนุมัติในขณะนี้" : tab === "approved" ? "ยังไม่มีคำร้องที่อนุมัติ" : "ยังไม่มีคำร้องที่ปฏิเสธ"}
                            </p>
                        </div>
                    ) : (
                        requests.map((item) => (
                            <div key={item.id} className="bg-surface rounded-2xl border border-border shadow-md overflow-hidden">
                                <div className="p-5 space-y-4">
                                    {/* Header: station + collector + time */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <MapPin size={16} className="text-primary shrink-0 mt-0.5" />
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-semibold text-text-primary truncate">{item.location?.name ?? "ไม่ทราบสถานที่"}</h3>
                                                <p className="text-[11px] text-text-muted mt-0.5 truncate">{item.location?.organization ?? "-"}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0">
                                            {tab === "pending" ? "รออนุมัติ" : tab === "approved" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว"}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5">
                                            <User size={13} className="text-text-muted shrink-0" />
                                            <span className="font-semibold truncate">{item.collector?.name ?? "-"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5">
                                            <Calendar size={13} className="text-text-muted shrink-0" />
                                            <span className="font-semibold truncate">{formatDateTime(item.collectionTime)}</span>
                                        </div>
                                    </div>

                                    {/* Measurements per sample */}
                                    <div className="space-y-2">
                                        {item.samples.map((s) => (
                                            <div key={s.id} className="flex items-center gap-3 bg-surface-subtle border border-border rounded-xl p-3">
                                                <div className="w-12 h-12 rounded-lg bg-surface border border-border shrink-0 overflow-hidden flex items-center justify-center">
                                                    {s.rawImageUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={s.rawImageUrl} alt="sample" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <ImageOff size={14} className="text-text-muted" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    {s.measurements.map((m) => {
                                                        const lowConf = isLowConfidence(m.confidence);
                                                        return (
                                                            <div key={m.parameterId} className="flex items-center justify-between gap-2 text-xs">
                                                                <span className="font-semibold text-text-primary uppercase truncate">{m.parameterName ?? "ไม่ทราบสาร"}</span>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className="text-text-secondary">
                                                                        {m.value.toFixed(3)} {m.unit ?? "mg/L"}
                                                                    </span>
                                                                    <span
                                                                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                                                                            lowConf ? "text-red-600 bg-red-50 border border-red-200" : "text-teal-600 bg-teal-50 border border-teal-200"
                                                                        }`}
                                                                    >
                                                                        conf {m.confidence.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Reviewed info — เฉพาะคำร้องที่ตัดสินไปแล้ว */}
                                    {tab !== "pending" && (
                                        <div className="text-[11px] text-text-muted bg-surface-subtle border border-border rounded-xl p-3 space-y-1">
                                            <p>
                                                ตัดสินโดย <span className="font-semibold text-text-secondary">{item.reviewedBy?.name ?? "-"}</span> เมื่อ {formatDateTime(item.reviewedAt)}
                                            </p>
                                            {item.reviewNote && (
                                                <p className="flex items-start gap-1.5 text-red-600">
                                                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                                    {item.reviewNote}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Actions — เฉพาะแท็บ pending */}
                                    {tab === "pending" && (
                                        <div className="flex gap-2.5 pt-1">
                                            <button
                                                onClick={() => openReject(item)}
                                                disabled={actingId === item.id}
                                                className="flex-1 py-3 min-h-[44px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-surface-subtle hover:bg-red-500/10 border border-border hover:border-red-500/30 text-text-secondary hover:text-red-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <X size={14} /> ปฏิเสธ
                                            </button>
                                            <button
                                                onClick={() => handleApprove(item)}
                                                disabled={actingId === item.id}
                                                className="flex-1 py-3 min-h-[44px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-teal-700 hover:bg-teal-800 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {actingId === item.id ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
                                                อนุมัติ
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Reject drawer — บังคับกรอกเหตุผลก่อนส่ง */}
            {rejectTarget && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-[1000] backdrop-blur-xs transition-opacity" onClick={() => !rejectSaving && setRejectTarget(null)} />
                    <div
                        className="fixed bottom-0 left-0 right-0 z-[1001] bg-surface rounded-t-[32px] shadow-2xl border-t border-border max-w-lg mx-auto px-8 pt-8 space-y-6 animate-slide-up transition-colors duration-300"
                        style={{ paddingBottom: "calc(56px + env(safe-area-inset-bottom))" }}
                    >
                        <div className="w-12 h-1 bg-border rounded-full mx-auto mb-2 pointer-events-none" />

                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">ปฏิเสธคำร้อง</h3>
                            <button
                                onClick={() => !rejectSaving && setRejectTarget(null)}
                                className="w-8 h-8 bg-surface-subtle border border-border rounded-full flex items-center justify-center hover:bg-surface-muted transition-colors active:scale-[0.92] cursor-pointer"
                            >
                                <X size={14} className="text-text-secondary" />
                            </button>
                        </div>

                        <p className="text-xs text-text-secondary leading-relaxed">
                            ผลตรวจของ &quot;{rejectTarget.location?.name ?? "จุดตรวจนี้"}&quot; จะถูกลบออกจากระบบทันที และไม่สามารถกู้คืนได้ กรุณาระบุเหตุผลให้ผู้เก็บตัวอย่างทราบ
                        </p>

                        <div className="space-y-2.5">
                            <label className="text-[9px] font-semibold text-text-muted uppercase tracking-wider block">เหตุผลในการปฏิเสธ *</label>
                            <textarea
                                value={rejectNote}
                                onChange={(e) => setRejectNote(e.target.value)}
                                placeholder="เช่น ภาพเบลอ มองไม่เห็นสีของเหลวชัดเจน กรุณาถ่ายใหม่"
                                rows={3}
                                className="w-full px-4 py-3.5 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none transition-all resize-none"
                            />
                        </div>

                        <button
                            onClick={submitReject}
                            disabled={rejectSaving || !rejectNote.trim()}
                            className="w-full py-4 min-h-[52px] bg-red-600 hover:bg-red-700 text-white font-semibold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
                        >
                            {rejectSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <X size={14} />}
                            ยืนยันปฏิเสธคำร้อง
                        </button>
                    </div>
                </>
            )}

            {/* Toast */}
            {toastElement}
        </div>
    );
}
