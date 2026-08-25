"use client";

import { Suspense, useEffect } from "react";
import { useSubmitSample } from "@/lib/hooks/useSubmitSample";
import { isLowConfidence } from "@/lib/standards";
import type { DbParameter } from "@/components/submit/types";
import { confirmDialog, alertError, loadingDialog, closeDialog, reviewConfirmDialog } from "@/lib/swal";
import { useMediaQuery } from "@/hooks/useMediaQuery";

import SubmitMobile from "./submitMobile";
import SubmitDesktop from "./submitDesktop";

function SubmitContent() {
    const hook = useSubmitSample();
    const {
        systemParameters,
        activeParameters,
        enabledParamIds,
        toggleParam,
        verifyErrors,
        setVerifyErrors,
        imagePreviews,
        imagePlotFiles,
        setImageFiles,
        setImagePreviews,
        setIsRecommending,
        allLocations,
        setNearestLocations,
        step,
        results,
        savedEntryKeys,
        router,
        saved,
        savedSampleId,
        submittedForReview,
        handleSave,
        resetToUpload,
        processImageExif,
        currentUser,
    } = hook;

    const isMobile = useMediaQuery("(max-width: 767px)");

    // หน้านี้เฉพาะ collector กับ admin — การเด้งออกทำใน useSubmitSample (useEffect)
    // แต่ effect ทำงานหลัง paint แรก จึงต้องกันตอน render ด้วย ไม่งั้นคนไม่มีสิทธิ์เห็นฟอร์มแวบหนึ่ง
    const isAllowed = !currentUser || currentUser.role === "collector" || currentUser.role === "admin";

    useEffect(() => {
        document.documentElement.classList.add("reserve-scrollbar-gutter");
        return () => document.documentElement.classList.remove("reserve-scrollbar-gutter");
    }, []);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [step]);

    useEffect(() => {
        const errorIds = Object.keys(verifyErrors);
        if (errorIds.length === 0) return;
        const el = document.getElementById(`param-zone-${errorIds[0]}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [verifyErrors]);

    const handleImageSelect = async (paramId: number, file: File) => {
        setImageFiles((prev) => ({ ...prev, [paramId]: file }));

        hook.processImageExif(file);
        processImageExif(file);

        setVerifyErrors((prev) => {
            if (!prev[paramId]) return prev;
            const next = { ...prev };
            delete next[paramId];
            return next;
        });

        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreviews((prev) => ({ ...prev, [paramId]: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const resultEntries: { key: number; param: DbParameter; measurement: (typeof results)[number] }[] = Object.entries(results)
        .map(([keyStr, measurement]) => {
            const key = Number(keyStr);
            const param = systemParameters.find((p) => p.id === measurement.parameterId);
            return param ? { key, param, measurement } : null;
        })
        .filter((e): e is { key: number; param: DbParameter; measurement: (typeof results)[number] } => e !== null);

    const hasLowConfidence = Object.entries(results).some(([keyStr, r]) => savedEntryKeys.has(Number(keyStr)) && isLowConfidence(r.confidence));
    const hasDuplicateSubstance = Object.values(results).some((r) => r.isDuplicateSubstance);
    const hasUserInsistedOriginal = Object.entries(results).some(([keyStr, r]) => savedEntryKeys.has(Number(keyStr)) && r.userInsistedOriginal);
    const hasSystemUnknown = Object.entries(results).some(([keyStr, r]) => savedEntryKeys.has(Number(keyStr)) && r.isSystemUnknown);
    const needsAdminReview = hasLowConfidence || hasUserInsistedOriginal || hasSystemUnknown || hasDuplicateSubstance;

    const onConfirmSave = async (forceReview: boolean) => {
        const isReviewSubmit = needsAdminReview || forceReview;

        if (isReviewSubmit) {
            const reasons: string[] = [];
            if (hasLowConfidence) reasons.push("ความมั่นใจของ AI ต่ำกว่า 60%");
            if (hasSystemUnknown) reasons.push("พบสารเคมีที่ไม่รู้จักในระบบ");
            if (hasDuplicateSubstance) reasons.push("มีภาพสารเคมีชนิดเดียวกันซ้ำกัน");
            if (hasUserInsistedOriginal) reasons.push("ผู้ใช้ยกเลิกการสลับสารอัตโนมัติของ AI");
            
            if (reasons.length === 0 && forceReview) reasons.push("ผู้ใช้ร้องขอให้ตรวจสอบเพิ่มเติม");

            const result = await reviewConfirmDialog({
                title: "ยืนยันส่งข้อมูลเพื่อรอตรวจสอบ",
                text: 'ข้อมูลนี้จะถูกส่งเข้าสถานะ "รออนุมัติ" และไม่แสดงบนแผนที่จนกว่าผู้ดูแลระบบจะตรวจสอบและยืนยัน',
                reasons,
                requireNote: !needsAdminReview && forceReview,
            });

            if (!result.confirmed) return;
            
            loadingDialog("กำลังบันทึกข้อมูล...", "กรุณารอสักครู่ ระบบกำลังจัดเก็บข้อมูล");
            try {
                await handleSave(isReviewSubmit, result.reviewNote, result.allowAdminChange);
                closeDialog();
            } catch (err: any) {
                alertError("เกิดข้อผิดพลาด", err.message || "ไม่สามารถบันทึกข้อมูลได้สำเร็จ กรุณาลองใหม่อีกครั้ง");
            }
        } else {
            const confirmed = await confirmDialog({
                title: "ยืนยันการบันทึกข้อมูล",
                text: "คุณต้องการบันทึกผลตรวจน้ำครั้งนี้ใช่หรือไม่",
                confirmText: "บันทึกข้อมูล",
                tone: "primary",
            });
            if (!confirmed) return;

            loadingDialog("กำลังบันทึกข้อมูล...", "กรุณารอสักครู่ ระบบกำลังจัดเก็บข้อมูล");
            try {
                await handleSave(false);
                closeDialog();
            } catch (err: any) {
                alertError("เกิดข้อผิดพลาด", err.message || "ไม่สามารถบันทึกข้อมูลได้สำเร็จ กรุณาลองใหม่อีกครั้ง");
            }
        }
    };

    const onResetClick = async () => {
        const confirmed = await confirmDialog({
            title: "เริ่มถ่ายภาพใหม่?",
            text: "ผลวิเคราะห์และรูปภาพชุดนี้จะถูกล้างทิ้ง แล้วกลับไปเริ่มถ่ายภาพใหม่ (สถานีและเวลาที่เลือกไว้จะยังคงอยู่)",
            confirmText: "ใช่ เริ่มใหม่",
            tone: "warning",
        });
        if (confirmed) resetToUpload();
    };

    const submitProps = {
        hook,
        systemParameters,
        activeParameters,
        enabledParamIds,
        toggleParam,
        verifyErrors,
        imagePreviews,
        imagePlotFiles,
        handleImageSelect,
        setNearestLocations,
        allLocations,
        setIsRecommending,
        step,
        results,
        resultEntries,
        hasDuplicateSubstance,
        hasLowConfidence,
        needsAdminReview,
        onConfirmSave,
        onResetClick,
        saved,
        savedSampleId,
        submittedForReview,
        router,
        revertAutoSwitch: hook.revertAutoSwitch,
    };

    if (!isAllowed) return null;

    return isMobile ? <SubmitMobile {...submitProps} /> : <SubmitDesktop {...submitProps} />;
}

export default function SubmitPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-dvh">Loading...</div>}>
            <SubmitContent />
        </Suspense>
    );
}
