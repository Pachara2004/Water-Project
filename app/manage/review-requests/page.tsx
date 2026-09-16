/**
 * @file app/manage/review-requests/page.tsx
 * @project Water Monitoring Project
 * @module App / Manage / Review Requests
 * @description
 * หน้าตรวจสอบคำร้อง (/manage/review-requests, admin เท่านั้น) เจ้าของ state ทั้งหมด: แท็บสถานะ,
 * รายการคำร้องแบบแบ่งหน้าจาก /api/review-requests, เกณฑ์มาตรฐานจาก DB สำหรับป้ายสถานะน้ำ,
 * อนุมัติ (ทั้งใบหรือเลือกบางตัวอย่าง), ปฏิเสธพร้อมเหตุผล, แก้ไขค่าแล้วอนุมัติ และ lightbox
 * refetch หลังดำเนินการแบบ silent ไม่ให้รายการยุบเป็น spinner และเลื่อนไปหน้าสุดท้ายที่ยังมีจริงถ้าหน้าเดิมหาย
 * เลือก view mobile/desktop ตามจอ
 *
 * Admin review queue: owns tab/pagination state and the approve / reject / edit-approve
 * actions against /api/review-requests; views only lay it out.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-13
 * @version 1.0.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-07-16 – 2026-09-02)
 *
 * @lastModified 2026-09-09 10:47
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-07-13 16:19 by Nopparut U. - สร้างหน้าตรวจสอบคำร้อง confidence ต่ำ
 * - 2026-07-16 13:13 by Nopparut U. - รองรับ workflow สารซ้ำ
 * - 2026-07-23 16:08 by Nopparut U. - แยก view เป็น desktop/mobile
 * - 2026-07-27 14:19 by Nopparut U. - แบ่งหน้าฝั่ง server
 * - 2026-08-21 16:23 by Pachara P. - ปรับ flow การส่งตรวจ
 * - 2026-08-25 10:02 by Nopparut U. - เลือกตัวอย่างบางส่วนเพื่ออนุมัติ และ drawer แก้ไขแล้วอนุมัติ
 * - 2026-09-02 14:13 by Nopparut U. - รองรับภาพที่ AI ไม่พบหลอดทดลอง
 * - 2026-09-02 14:24 by Pachara P. - บล็อกการเข้าถึงตาม role
 * - 2026-09-09 10:47 by Nopparut U. - แถบแบ่งหน้าใหม่พร้อมเลือกจำนวนแถวต่อหน้า
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @auth admin เท่านั้น ยิง API ด้วย LIFF access token
 * @notes จอง scrollbar gutter ตลอด (reserve-scrollbar-gutter) กัน layout ขยับตอน SweetAlert ล็อก scroll
 * @license Private / Proprietary
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { confirmDialog, alertError } from "@/lib/swal";
import { useToast } from "@/components/useToast";
import { refreshNavDots } from "@/lib/navEvents";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useLocationTypes } from "@/lib/hooks/useLocationTypes";
import { ShieldAlert } from "lucide-react";
import type { StandardRow } from "@/lib/standards";
import { type DbParameter } from "@/components/submit/types";
import { type ReviewStatusFilter, type ReviewRequestItem, type PreviewImages } from "@/components/manage/reviewRequestsHelpers";
import ReviewRequestsMobile from "./reviewRequestsMobile";
import ReviewRequestsDesktop from "./reviewRequestsDesktop";

/** เจ้าของ state หน้าตรวจสอบคำร้อง เลือก view ตามจอ */
export default function AdminReviewRequestsPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const { showToast, toastElement } = useToast();
    const isMobile = useMediaQuery("(max-width: 767px)");

    const [previewImages, setPreviewImages] = useState<PreviewImages | null>(null);

    const [systemParameters, setSystemParameters] = useState<DbParameter[]>([]);
    useEffect(() => {
        fetch("/api/parameters")
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setSystemParameters(data);
            });
    }, []);

    // เกณฑ์จริงจากตาราง standards — ใช้คำนวณ badge สถานะน้ำในหน้านี้ (ต้องตรงกับที่ server ใช้ตัดสิน)
    const { locationTypes } = useLocationTypes();
    const standards: StandardRow[] = useMemo(() => locationTypes.flatMap((t) => t.standards), [locationTypes]);

    const [tab, setTab] = useState<ReviewStatusFilter>("pending");
    const [requests, setRequests] = useState<ReviewRequestItem[]>([]);
    const [isLoadingRequests, setIsLoadingRequests] = useState(false);
    const [actingId, setActingId] = useState<number | null>(null);

    // การแบ่งหน้าเกิดที่ฝั่ง API — `requests` คือคำร้องของหน้าปัจจุบันเท่านั้น
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);

    // Reject drawer — reason ต้องกรอกเสมอก่อนส่ง (บังคับที่ API ด้วย)
    const [rejectTarget, setRejectTarget] = useState<ReviewRequestItem | null>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [rejectSaving, setRejectSaving] = useState(false);

    // Edit Approve drawer
    const [editTarget, setEditTarget] = useState<ReviewRequestItem | null>(null);
    const [editNote, setEditNote] = useState("");
    const [editMeasurements, setEditMeasurements] = useState<Record<number, number>>({});
    const [editParameters, setEditParameters] = useState<Record<number, number>>({});
    // เริ่มต้นเลือกทุกสาร — สารที่ถูกยกเลิกเลือกจะถูกปฏิเสธเหมือนปุ่มอนุมัติ
    const [editSelectedSampleIds, setEditSelectedSampleIds] = useState<number[]>([]);
    const [editSaving, setEditSaving] = useState(false);

    // silent=true สำหรับ refetch หลัง approve/reject — ไม่ให้ list ยุบเป็น spinner ทั้งก้อน
    const fetchRequests = useCallback(async (status: ReviewStatusFilter, targetPage: number, targetPageSize: number, silent = false) => {
        if (!silent) setIsLoadingRequests(true);
        try {
            const res = await fetch(`/api/review-requests?status=${status}&page=${targetPage}&pageSize=${targetPageSize}`, {
                headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error);

            setRequests(Array.isArray(data.items) ? data.items : []);
            setTotalPages(data.totalPages ?? 0);

            // หน้าที่เปิดอยู่อาจหายไปหลังอนุมัติ/ปฏิเสธคำร้องสุดท้ายของหน้า — เลื่อนไปหน้าสุดท้ายที่ยังมีจริง
            if (data.totalPages > 0 && targetPage > data.totalPages) {
                setPage(data.totalPages);
            } else if (data.totalPages === 0 && targetPage !== 1) {
                setPage(1);
            }
        } catch (err) {
            console.error("Failed to fetch review requests:", err);
            setRequests([]);
        } finally {
            if (!silent) setIsLoadingRequests(false);
        }
    }, []);

    useEffect(() => {
        if (currentUser?.role === "admin") {
            const timer = setTimeout(() => {
                fetchRequests(tab, page, pageSize);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [currentUser?.role, tab, page, pageSize, fetchRequests]);

    // สลับแท็บ = ชุดผลลัพธ์คนละชุด ต้องกลับหน้า 1 ไม่งั้นค้างอยู่หน้าที่แท็บใหม่อาจไม่มี
    const changeTab = (v: ReviewStatusFilter) => {
        setTab(v);
        setPage(1);
    };

    // จำนวนแถวต่อหน้าเปลี่ยน = เลขหน้าเดิมชี้ไปคนละชุด ต้องกลับหน้า 1 เหมือนตอนสลับแท็บ
    const changePageSize = (size: number) => {
        setPageSize(size);
        setPage(1);
    };

    // จองพื้นที่ scrollbar ไว้ตลอด — กัน layout ขยับตอน SweetAlert (approve/reject) lock scroll บนหน้าที่ไม่มี scrollbar
    useEffect(() => {
        document.documentElement.classList.add("reserve-scrollbar-gutter");
        return () => document.documentElement.classList.remove("reserve-scrollbar-gutter");
    }, []);

    // approvedSampleIds: ระบุเฉพาะการ์ดหลายสารที่เลือกอนุมัติบางสาร | undefined = อนุมัติทั้งใบ
    const handleApprove = async (item: ReviewRequestItem, approvedSampleIds?: number[]) => {
        const isPartial = Array.isArray(approvedSampleIds) && approvedSampleIds.length < item.samples.length;
        const confirmed = await confirmDialog({
            title: "ยืนยันอนุมัติคำร้อง?",
            text: isPartial
                ? `จะอนุมัติ ${approvedSampleIds!.length} จาก ${item.samples.length} สารของ "${item.location?.name ?? "จุดตรวจนี้"}" ส่วนสารที่ไม่ได้เลือกจะถูกปฏิเสธ`
                : `ผลตรวจของ "${item.location?.name ?? "จุดตรวจนี้"}" จะแสดงบนแผนที่และแดชบอร์ดทันที`,
            confirmText: "อนุมัติ",
            tone: "primary",
        });
        if (!confirmed) return;

        setActingId(item.id);
        try {
            const res = await fetch(`/api/review-requests/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${liff.getAccessToken()}` },
                body: JSON.stringify({ action: "approve", ...(approvedSampleIds ? { approvedSampleIds } : {}) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "เกิดข้อผิดพลาดในการอนุมัติคำร้อง");

            showToast(`อนุมัติผลตรวจของ "${item.location?.name ?? "จุดตรวจ"}" แล้ว`, "success");
            fetchRequests(tab, page, pageSize, true);
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
            fetchRequests(tab, page, pageSize, true);
            refreshNavDots();
        } catch (err) {
            alertError("ปฏิเสธไม่สำเร็จ", err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง");
        } finally {
            setRejectSaving(false);
        }
    };

    const openEditApprove = (item: ReviewRequestItem, preSelectedSampleIds?: number[]) => {
        setEditTarget(item);
        setEditNote("");

        // Initialize measurements from sample
        const initialMeasurements: Record<number, number> = {};
        const initialParameters: Record<number, number> = {};
        item.samples.forEach(s => {
            s.measurements.forEach(m => {
                // ค่าที่เป็น null (AI ทำนายไม่ได้) ไม่ต้องใส่คีย์ ปล่อยให้ช่องกรอกว่างไว้ให้ผู้ดูแลระบบพิมพ์เอง
                if (m.value !== null && m.value !== undefined) initialMeasurements[m.parameterId] = m.value;
                initialParameters[m.parameterId] = m.parameterId;
            });
        });
        setEditMeasurements(initialMeasurements);
        setEditParameters(initialParameters);

        // เริ่มต้นเลือกตามที่การ์ดเลือกไว้ (ถ้ามี) ไม่งั้นเลือกทุกสารเป็นค่าเริ่มต้น
        setEditSelectedSampleIds(preSelectedSampleIds ?? item.samples.map((s) => s.id));
    };

    const submitEditApprove = async () => {
        if (!editTarget || !editNote.trim() || editSelectedSampleIds.length === 0) return;

        const isPartial = editSelectedSampleIds.length < editTarget.samples.length;
        if (isPartial) {
            const confirmed = await confirmDialog({
                title: "ยืนยันแก้ไขและอนุมัติคำร้อง?",
                text: `จะแก้ไขและอนุมัติ ${editSelectedSampleIds.length} จาก ${editTarget.samples.length} สารของ "${editTarget.location?.name ?? "จุดตรวจนี้"}" ส่วนสารที่ไม่ได้เลือกจะถูกปฏิเสธ`,
                confirmText: "ยืนยัน",
                tone: "primary",
            });
            if (!confirmed) return;
        }

        setEditSaving(true);
        try {
            const editedMeasurementsArray = editTarget.samples
                .filter((s) => editSelectedSampleIds.includes(s.id))
                .flatMap((s) => s.measurements)
                .map((m) => ({
                    originalParameterId: m.parameterId,
                    parameterId: Number(editParameters[m.parameterId] ?? m.parameterId),
                    value: Number(editMeasurements[m.parameterId] ?? m.value),
                }));

            const res = await fetch(`/api/review-requests/${editTarget.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${liff.getAccessToken()}` },
                body: JSON.stringify({
                    action: "edited_approve",
                    note: editNote.trim(),
                    editedMeasurements: editedMeasurementsArray,
                    ...(isPartial ? { approvedSampleIds: editSelectedSampleIds } : {}),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "เกิดข้อผิดพลาดในการแก้ไขและอนุมัติคำร้อง");

            showToast(`แก้ไขและอนุมัติผลตรวจของ "${editTarget.location?.name ?? "จุดตรวจ"}" แล้ว`, "success");
            setEditTarget(null);
            fetchRequests(tab, page, pageSize, true);
            refreshNavDots();
        } catch (err) {
            alertError("แก้ไขและอนุมัติไม่สำเร็จ", err instanceof Error ? err.message : "กรุณาลองใหม่อีกครั้ง");
        } finally {
            setEditSaving(false);
        }
    };

    // Role Security Gate
    const hasAccess = currentUser && currentUser.role === "admin";
    useEffect(() => {
        if (!hasAccess) {
            router.replace("/map");
        }
    }, [hasAccess, router]);

    if (!hasAccess) {
        return null;
    }

    const props = {
        router,
        toastElement,
        tab,
        setTab: changeTab,
        requests,
        page,
        totalPages,
        setPage,
        pageSize,
        changePageSize,
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
    };

    return isMobile ? <ReviewRequestsMobile {...props} /> : <ReviewRequestsDesktop {...props} />;
}
