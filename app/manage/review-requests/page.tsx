"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { confirmDialog, alertError } from "@/lib/swal";
import { useToast } from "@/components/useToast";
import { refreshNavDots } from "@/lib/navEvents";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ShieldAlert } from "lucide-react";
import { type ReviewStatusFilter, type ReviewRequestItem } from "@/components/manage/reviewRequestsHelpers";
import ReviewRequestsMobile from "./reviewRequestsMobile";
import ReviewRequestsDesktop from "./reviewRequestsDesktop";

export default function AdminReviewRequestsPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const { showToast, toastElement } = useToast();
    const isMobile = useMediaQuery("(max-width: 767px)");

    const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);

    const [tab, setTab] = useState<ReviewStatusFilter>("pending");
    const [requests, setRequests] = useState<ReviewRequestItem[]>([]);
    const [actingId, setActingId] = useState<number | null>(null);

    // Reject drawer — reason ต้องกรอกเสมอก่อนส่ง (บังคับที่ API ด้วย)
    const [rejectTarget, setRejectTarget] = useState<ReviewRequestItem | null>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [rejectSaving, setRejectSaving] = useState(false);

    // silent=true สำหรับ refetch หลัง approve/reject — ไม่ให้ list ยุบเป็น spinner ทั้งก้อน
    const fetchRequests = useCallback(async (status: ReviewStatusFilter, silent = false) => {
        try {
            const res = await fetch(`/api/review-requests?status=${status}`, {
                headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
            });
            const data = await res.json();
            setRequests(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch review requests:", err);
            setRequests([]);
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

    const props = {
        router,
        toastElement,
        tab,
        setTab,
        requests,
        actingId,
        previewImgUrl,
        setPreviewImgUrl,
        rejectTarget,
        setRejectTarget,
        rejectNote,
        setRejectNote,
        rejectSaving,
        handleApprove,
        openReject,
        submitReject,
    };

    return isMobile ? <ReviewRequestsMobile {...props} /> : <ReviewRequestsDesktop {...props} />;
}
