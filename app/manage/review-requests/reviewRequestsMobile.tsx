"use client";

import type { useRouter } from "next/navigation";
import { CONFIDENCE_THRESHOLD } from "@/lib/standards";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { TAB_CONFIG, RequestCard, RejectDrawer, ImageLightbox, type ReviewStatusFilter, type ReviewRequestItem, type PreviewImages } from "@/components/manage/reviewRequestsHelpers";
import { ReviewRequestCardSkeleton } from "./loading";

export interface ReviewRequestsPageProps {
    router: ReturnType<typeof useRouter>;
    toastElement: React.ReactNode;

    tab: ReviewStatusFilter;
    setTab: (v: ReviewStatusFilter) => void;

    requests: ReviewRequestItem[];
    isLoadingRequests: boolean;

    actingId: number | null;

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
}

export default function ReviewRequestsMobile(props: ReviewRequestsPageProps) {
    const { router, toastElement, tab, setTab, requests, isLoadingRequests, actingId, previewImages, setPreviewImages, rejectTarget, setRejectTarget, rejectNote, setRejectNote, rejectSaving, handleApprove, openReject, submitReject } = props;

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
                    <h1 className="font-display text-lg font-bold text-text-primary ">
                        ตรวจสอบผลที่มี <span className="font-display text-primary">Confidence ต่ำ</span>
                    </h1>
                    <p className="text-text-secondary text-xs mt-1 leading-relaxed">
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
                                tab === t.id ? "bg-primary text-white border-primary" : "bg-card-general text-text-secondary border-border hover:border-primary/30"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* List */}
                <div className="space-y-4">
                    {isLoadingRequests ? (
                        Array.from({ length: 2 }).map((_, i) => <ReviewRequestCardSkeleton key={i} />)
                    ) : requests.length === 0 ? (
                        <div className="bg-surface rounded-2xl p-10 text-center border border-border flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-surface-subtle border border-border rounded-xl flex items-center justify-center mb-4">
                                <ClipboardCheck size={18} className="text-text-muted" />
                            </div>
                            <p className="text-xs font-bold text-text-muted">
                                {tab === "pending" ? "ไม่มีคำร้องรออนุมัติในขณะนี้" : tab === "approved" ? "ยังไม่มีคำร้องที่อนุมัติ" : "ยังไม่มีคำร้องที่ปฏิเสธ"}
                            </p>
                        </div>
                    ) : (
                        requests.map((item) => (
                            <RequestCard key={item.id} item={item} actingId={actingId} onOpenReject={openReject} onApprove={handleApprove} onPreviewImage={setPreviewImages} mobile />
                        ))
                    )}
                </div>
            </div>

            {/* Reject drawer — บังคับกรอกเหตุผลก่อนส่ง */}
            {rejectTarget && (
                <RejectDrawer rejectTarget={rejectTarget} rejectNote={rejectNote} setRejectNote={setRejectNote} rejectSaving={rejectSaving} onClose={() => setRejectTarget(null)} onSubmit={submitReject} />
            )}
            {previewImages && <ImageLightbox images={previewImages} onClose={() => setPreviewImages(null)} />}
            {/* Toast */}
            {toastElement}
        </div>
    );
}
