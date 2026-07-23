"use client";

import { CONFIDENCE_THRESHOLD } from "@/lib/standards";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { TAB_CONFIG, RequestCard, RejectDrawer, ImageLightbox } from "@/components/manage/reviewRequestsHelpers";
import type { ReviewRequestsPageProps } from "./reviewRequestsMobile";

// Desktop = ขยาย layout เดิมของ mobile ให้เต็มจอ (container กว้างขึ้น, การ์ดคำร้องจัดเป็นกริด 2 คอลัมน์)
// ไม่เปลี่ยน logic/handler — ใช้ state ชุดเดียวกับ reviewRequestsMobile ที่มาจาก page.tsx
export default function ReviewRequestsDesktop(props: ReviewRequestsPageProps) {
    const { router, toastElement, tab, setTab, requests, actingId, previewImgUrl, setPreviewImgUrl, rejectTarget, setRejectTarget, rejectNote, setRejectNote, rejectSaving, handleApprove, openReject, submitReject } = props;

    return (
        <div className="min-h-dvh w-full bg-bg pb-8 antialiased transition-colors duration-300">
            <div className="bg-card-general border-b border-border px-8 h-13 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-secondary min-h-11">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-primary">คุณภาพน้ำที่ต้องการยืนยัน</h1>
                </div>
                <div className="w-15" />
            </div>
            <div className="w-full max-w-[1600px] mx-auto px-8 pt-8">
                {/* Header card */}
                <div className="bg-card-general rounded-2xl border border-border p-6 mb-6 transition-colors duration-300">
                    <h1 className="font-display text-lg font-bold text-text-primary ">
                        ตรวจสอบผลที่มี <span className="font-display text-primary">Confidence ต่ำ</span>
                    </h1>
                    <p className="text-text-secondary text-xs mt-1 leading-relaxed">
                        ผลตรวจที่ AI วิเคราะห์ได้ค่าความมั่นใจต่ำกว่า {CONFIDENCE_THRESHOLD.toFixed(2)} จะถูกซ่อนจากแผนที่และแดชบอร์ดจนกว่าจะได้รับการยืนยันจากผู้ดูแลระบบ
                    </p>
                </div>

                {/* Tabs */}
                <div className="px-2 mb-1 text-sm text-primary font-semibold">สถานะที่ต้องการดู</div>
                <div className="flex items-center gap-2 mb-5 max-w-2xl">
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
                {requests.length === 0 ? (
                    <div className="bg-surface rounded-2xl p-14 text-center border border-border flex flex-col items-center justify-center">
                        <div className="w-12 h-12 bg-surface-subtle border border-border rounded-xl flex items-center justify-center mb-4">
                            <ClipboardCheck size={18} className="text-text-muted" />
                        </div>
                        <p className="text-xs font-bold text-text-muted">
                            {tab === "pending" ? "ไม่มีคำร้องรออนุมัติในขณะนี้" : tab === "approved" ? "ยังไม่มีคำร้องที่อนุมัติ" : "ยังไม่มีคำร้องที่ปฏิเสธ"}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {requests.map((item) => (
                            <RequestCard key={item.id} item={item} tab={tab} actingId={actingId} onOpenReject={openReject} onApprove={handleApprove} onPreviewImage={setPreviewImgUrl} />
                        ))}
                    </div>
                )}
            </div>

            {/* Reject drawer — บังคับกรอกเหตุผลก่อนส่ง */}
            {rejectTarget && (
                <RejectDrawer rejectTarget={rejectTarget} rejectNote={rejectNote} setRejectNote={setRejectNote} rejectSaving={rejectSaving} onClose={() => setRejectTarget(null)} onSubmit={submitReject} />
            )}
            {previewImgUrl && <ImageLightbox previewImgUrl={previewImgUrl} onClose={() => setPreviewImgUrl(null)} />}
            {/* Toast */}
            {toastElement}
        </div>
    );
}
