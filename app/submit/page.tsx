/**
 * @file app/submit/page.tsx
 * @project Water Monitoring Project
 * @module App / Submit
 * @description
 * หน้าส่งตรวจคุณภาพน้ำ (/submit) เรียก useSubmitSample ที่นี่ครั้งเดียว กันสิทธิ์ตอน render
 * (collector/admin เท่านั้น) เริ่มวิเคราะห์ด้วย AI เบื้องหลังทันทีที่เลือกรูป และล้างผลที่พักไว้เมื่อเปลี่ยนรูป
 * คำนวณ flag สรุปผล (สารซ้ำ / ความมั่นใจต่ำ โดยคัดภาพที่ AI ไม่พบหลอดทดลองออก) แล้วส่งให้
 * SubmitMobile หรือ SubmitDesktop ห่อด้วย Suspense เพราะ hook อ่าน search params
 *
 * Submit route: owns the useSubmitSample instance, render-time role guard, background AI
 * analysis trigger and derived result flags; views only lay it out.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-06-19 – 2026-09-02)
 *
 * @lastModified 2026-09-03 15:55
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-06-09 09:09 by Pachara P. - สร้างหน้าส่งตรวจพร้อมโครงระบบ
 * - 2026-07-07 10:14 by Pachara P. - เชื่อมต่อ API AI
 * - 2026-07-07 15:30 by Pachara P. - ปรับโครงสร้างไฟล์ submit แยกคอมโพเนนต์ย่อย
 * - 2026-07-14 12:25 by Nopparut U. - เพิ่มโหมดการส่งตัวอย่าง
 * - 2026-07-16 13:13 by Nopparut U. - workflow สารซ้ำ
 * - 2026-07-23 09:35 by Pachara P. - แยก view เป็น desktop/mobile
 * - 2026-08-21 16:23 by Pachara P. - ปรับ flow การส่งตรวจ
 * - 2026-09-02 14:13 by Nopparut U. - ส่งภาพที่ AI ไม่พบหลอดทดลองเข้าคิวตรวจสอบได้
 * - 2026-09-03 15:55 by Pachara P. - ปรับการยิง API AI
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @auth collector และ admin เท่านั้น การเด้งออกทำใน useSubmitSample
 * @license Private / Proprietary
 */

"use client";

import { Suspense, useEffect } from "react";
import { useSubmitSample } from "@/lib/hooks/useSubmitSample";
import { isLowConfidence } from "@/lib/standards";
import type { DbParameter } from "@/components/submit/types";
import { confirmDialog, alertError, loadingDialog, closeDialog, reviewConfirmDialog } from "@/lib/swal";
import { useMediaQuery } from "@/hooks/useMediaQuery";

import SubmitMobile from "./submitMobile";
import SubmitDesktop from "./submitDesktop";

/** เนื้อหาจริงของหน้า submit (แยกจาก SubmitPage เพื่อให้อยู่ใต้ Suspense) */
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

        // เริ่มวิเคราะห์ด้วย AI เบื้องหลังทันทีที่เลือกรูปเสร็จ
        hook.triggerBackgroundAnalysis(paramId, file);

        // เปลี่ยนรูปแล้ว ผลวิเคราะห์ที่พักไว้ทั้งชุดใช้ไม่ได้อีก — ต้องกดวิเคราะห์ใหม่ก่อนจึงจะยืนยันส่งได้
        // ถ้าไม่ล้าง ปุ่มยืนยันจะส่งผลของรูปเก่าขึ้นไปแทนรูปที่เพิ่งเลือก
        hook.setPendingAnalyzedItems([]);

        hook.processImageExif(file);

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

    // "ความมั่นใจต่ำ" ต้องหมายถึง "วัดค่าได้ แล้วความมั่นใจต่ำกว่าเกณฑ์" เท่านั้น
    //
    // ต้องคัดรายการที่ AI ไม่พบหลอดทดลองออกด้วย ไม่ใช่แค่เช็ค null — เพราะโมเดลคืน confidence
    // เป็นเลข 0 มาให้ในกรณีนั้น (ไม่ได้ปล่อยว่าง) ค่า 0 จึงผ่านการเช็ค null แล้วไปเข้าเกณฑ์ "ต่ำกว่า 0.6"
    // ทำให้ผู้ใช้เห็นข้อความว่าความมั่นใจต่ำ ทั้งที่ไม่เคยมีการวัดเกิดขึ้นเลย
    //
    // เคสไม่พบหลอดทดลองมีคำอธิบายของตัวเองอยู่ในการ์ดของสารนั้นแล้ว จึงไม่ต้องมีแบนเนอร์ซ้ำอีก
    // (isLowConfidence เองยังตีความ null/0 ว่า "ต้องตรวจสอบ" ตามเดิม — ใช้ตัดสินคิวรีวิว ไม่ใช่ข้อความบนจอ)
    const hasLowConfidence = Object.entries(results).some(
        ([keyStr, r]) => savedEntryKeys.has(Number(keyStr)) && r.isTestTube !== false && r.confidence !== null && r.confidence !== undefined && isLowConfidence(r.confidence),
    );
    const hasDuplicateSubstance = Object.values(results).some((r) => r.isDuplicateSubstance);
    const hasUserInsistedOriginal = Object.entries(results).some(([keyStr, r]) => savedEntryKeys.has(Number(keyStr)) && r.userInsistedOriginal);
    const hasSystemUnknown = Object.entries(results).some(([keyStr, r]) => savedEntryKeys.has(Number(keyStr)) && r.isSystemUnknown);
    // AI ไม่พบหลอดทดลองในภาพ — ค่าที่อ่านได้เชื่อไม่ได้ ต้องให้ผู้ดูแลระบบตัดสินเสมอ
    const hasNotTestTube = Object.entries(results).some(([keyStr, r]) => savedEntryKeys.has(Number(keyStr)) && r.isTestTube === false);
    const needsAdminReview = hasLowConfidence || hasUserInsistedOriginal || hasSystemUnknown || hasDuplicateSubstance || hasNotTestTube;

    // มีผลวิเคราะห์ค้างอยู่จากรอบที่ AI ไม่พบหลอดทดลอง — ผู้ใช้ยังไม่ได้ตัดสินใจว่าจะถ่ายใหม่หรือยืนยันส่ง
    const hasBlockedPending = hook.pendingAnalyzedItems.length > 0;

    const onConfirmSave = async (forceReview: boolean) => {
        const isReviewSubmit = needsAdminReview || forceReview;

        if (isReviewSubmit) {
            const reasons: string[] = [];
            if (hasLowConfidence) reasons.push("ความมั่นใจของ AI ต่ำกว่า 60%");
            if (hasSystemUnknown) reasons.push("พบสารเคมีที่ไม่รู้จักในระบบ");
            if (hasNotTestTube) reasons.push("AI ไม่พบหลอดทดลองในภาพ ค่าที่อ่านได้จึงยังยืนยันไม่ได้");
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
                await handleSave(isReviewSubmit, result.reviewNote);
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
        hasBlockedPending,
        onConfirmBlockedSubmit: hook.confirmSubmitBlocked,
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

/** ห่อ SubmitContent ด้วย Suspense ตามข้อกำหนดของ useSearchParams */
export default function SubmitPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-dvh">Loading...</div>}>
            <SubmitContent />
        </Suspense>
    );
}
