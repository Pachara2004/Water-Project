"use client";

import { Suspense, useEffect } from "react";
import { useSubmitSample } from "@/lib/hooks/useSubmitSample";
import { isLowConfidence } from "@/lib/standards";
import { ImageZone } from "@/components/submit/ImageZone";
import { LocationPicker } from "@/components/submit/LocationPicker";
import { MetadataFields } from "@/components/submit/MetadataFields";
import { ResultsPanel } from "@/components/submit/ResultsPanel";
import { DesktopSidebar, AnalyzeButton } from "@/components/submit/NavWorkflow";
import { SubmitSteps } from "@/components/submit/SubmitSteps";
import { ArrowLeft, Database, CheckCircle2, AlertCircle, Clock, RotateCcw, Copy } from "lucide-react";
import type { DbParameter } from "@/components/submit/types";
import { confirmDialog, alertError, loadingDialog, closeDialog } from "@/lib/swal";

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
        router,
        saved,
        savedSampleId,
        handleSave,
        resetToUpload,
    } = hook;

    // จองพื้นที่ scrollbar ไว้ล่วงหน้าเฉพาะหน้านี้ กัน layout ขยับตอน popup ยืนยันล็อกการ scroll
    useEffect(() => {
        document.documentElement.classList.add("reserve-scrollbar-gutter");
        return () => document.documentElement.classList.remove("reserve-scrollbar-gutter");
    }, []);

    // เปลี่ยน step (upload → analyzing → results) ทีไร เด้งจอขึ้นบนสุดให้เห็นสถานะใหม่ทุกครั้ง
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [step]);

    // เมื่อวิเคราะห์แล้วเจอสารที่ถูกบล็อก (verifyErrors) → เด้งจอไปหาการ์ดแรกที่มีปัญหาให้ผู้ใช้เห็นทันที
    useEffect(() => {
        const errorIds = Object.keys(verifyErrors);
        if (errorIds.length === 0) return;
        const el = document.getElementById(`param-zone-${errorIds[0]}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [verifyErrors]);

    const handleImageSelect = async (paramId: number, file: File) => {
        // อัปเดตไฟล์ดิบ
        setImageFiles((prev) => ({ ...prev, [paramId]: file }));

        // เลือกรูปใหม่ให้สารตัวนี้ = เคลียร์สถานะบล็อกของสารตัวนั้นทิ้ง
        setVerifyErrors((prev) => {
            if (!prev[paramId]) return prev;
            const next = { ...prev };
            delete next[paramId];
            return next;
        });

        // แตก Base64 สำหรับทำ Preview บนหน้าจอ
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreviews((prev) => ({ ...prev, [paramId]: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    // ที่ step ผลลัพธ์: แต่ละรายการใน results คือ 1 การ์ดจริง (virtual key เมื่อสารซ้ำ ไม่ใช่ parameter id เสมอไป)
    // ต้องหา DbParameter ของแต่ละรายการจาก measurement.parameterId เอง ไม่ใช้ activeParameters ตรง ๆ
    const resultEntries: { key: number; param: DbParameter; measurement: (typeof results)[number] }[] = Object.entries(results)
        .map(([keyStr, measurement]) => {
            const key = Number(keyStr);
            const param = systemParameters.find((p) => p.id === measurement.parameterId);
            return param ? { key, param, measurement } : null;
        })
        .filter((e): e is { key: number; param: DbParameter; measurement: (typeof results)[number] } => e !== null);

    const onConfirmSave = async (needsAdminReview: boolean) => {
        const confirmed = await confirmDialog({
            title: needsAdminReview ? "ยืนยันส่งข้อมูลเพื่อรอตรวจสอบ" : "ยืนยันการบันทึกข้อมูล",
            text: needsAdminReview ? 'ข้อมูลนี้จะถูกส่งเข้าสถานะ "รออนุมัติ" และไม่แสดงบนแผนที่จนกว่าผู้ดูแลระบบจะตรวจสอบและยืนยัน' : "คุณต้องการบันทึกผลการตรวจสอบน้ำนี้ลงฐานข้อมูล",
            confirmText: needsAdminReview ? "ใช่ ส่งเพื่อรอตรวจสอบ" : "ใช่ บันทึกข้อมูล",
            tone: needsAdminReview ? "warning" : "primary",
        });
        if (!confirmed) return;

        // เปิดสถานะหมุนโหลดตัวเต็มจอ บล็อกปุ่มกดเล่นซ้ำซ้อน
        loadingDialog("กำลังบันทึกข้อมูล...", "กรุณารอสักครู่ ระบบกำลังจัดเก็บข้อมูล");

        try {
            await handleSave();
            closeDialog();
        } catch (err: any) {
            alertError("เกิดข้อผิดพลาด", err.message || "ไม่สามารถบันทึกข้อมูลได้สำเร็จ กรุณาลองใหม่อีกครั้ง");
        }
    };

    const hasLowConfidence = Object.values(results).some((r) => isLowConfidence(r.confidence));
    const hasDuplicateSubstance = Object.values(results).some((r) => r.isDuplicateSubstance);
    // เหตุผลใดเหตุผลหนึ่งก็พอที่จะบังคับให้ session นี้ต้องรอ admin อนุมัติ (confidence ต่ำ หรือ สารซ้ำ)
    const needsAdminReview = hasLowConfidence || hasDuplicateSubstance;

    const onResetClick = async () => {
        const confirmed = await confirmDialog({
            title: "เริ่มถ่ายภาพใหม่?",
            text: "ผลวิเคราะห์และรูปภาพชุดนี้จะถูกล้างทิ้ง แล้วกลับไปเริ่มถ่ายภาพใหม่ (สถานีและเวลาที่เลือกไว้จะยังคงอยู่)",
            confirmText: "ใช่ เริ่มใหม่",
            tone: "warning",
        });
        if (confirmed) resetToUpload();
    };

    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <canvas ref={hook.hiddenCanvasRef} className="hidden" />

            {/* ── Top Navigation Bar ── */}
            <div className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-text-secondary min-h-11">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-primary">ส่งตรวจคุณภาพน้ำ</h1>
                </div>
                <div className="w-15" />
            </div>

            {/* MOBILE VIEW COMPONENT */}
            <div className="md:hidden px-4 pb-24 space-y-4 mt-3">
                <SubmitSteps step={step} />
                {step === "upload"
                    ? // step upload: แสดงหัวการ์ด+toggle ของทุกสารในระบบเสมอ (ไม่ผูกกับจำนวนสาร) เปิดค่อยโผล่พื้นที่อัปรูป
                      systemParameters.map((param) => (
                          <ImageZone
                              key={param.id}
                              param={param}
                              step={step}
                              preview={imagePreviews[param.id]}
                              plotFile={imagePlotFiles[param.id]}
                              measurement={results[param.id]}
                              verifyError={verifyErrors[param.id]}
                              onImageFilesChange={(file) => handleImageSelect(param.id, file)}
                              onNearestLocationsUpdate={setNearestLocations}
                              allLocations={allLocations}
                              setIsRecommending={setIsRecommending}
                              enabled={enabledParamIds.has(param.id)}
                              onToggle={() => toggleParam(param.id)}
                          />
                      ))
                    : step === "analyzing"
                      ? // step analyzing: แสดงเฉพาะสารที่เปิดไว้จริง (ยังไม่รู้ผล ใช้ key ของช่องเดิมได้)
                        activeParameters.map((param) => (
                            <ImageZone
                                key={param.id}
                                param={param}
                                step={step}
                                preview={imagePreviews[param.id]}
                                plotFile={imagePlotFiles[param.id]}
                                measurement={results[param.id]}
                                verifyError={verifyErrors[param.id]}
                                onImageFilesChange={(file) => handleImageSelect(param.id, file)}
                                onNearestLocationsUpdate={setNearestLocations}
                                allLocations={allLocations}
                                setIsRecommending={setIsRecommending}
                            />
                        ))
                      : // step results: 1 การ์ดต่อ 1 รายการใน results จริง — สารซ้ำจะได้ 2 การ์ดแยกกัน
                        resultEntries.map(({ key, param, measurement }) => (
                            <ImageZone
                                key={key}
                                param={param}
                                step={step}
                                preview={imagePreviews[key]}
                                plotFile={imagePlotFiles[key]}
                                measurement={measurement}
                                onImageFilesChange={() => {}}
                                onNearestLocationsUpdate={setNearestLocations}
                                allLocations={allLocations}
                                setIsRecommending={setIsRecommending}
                            />
                        ))}
                {step === "upload" && (
                    <>
                        <LocationPicker {...hook} />
                        <MetadataFields {...hook} />
                        <AnalyzeButton {...hook} />
                    </>
                )}
                {step === "results" && (
                    <>
                        <ResultsPanel {...hook} />
                        {!saved ? (
                            <div className="space-y-2.5">
                                {hasDuplicateSubstance && (
                                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 leading-relaxed font-medium">
                                        <Copy size={14} className="shrink-0 mt-0.5" />
                                        <span>ตรวจพบสารซ้ำกัน หากส่งบันทึก ข้อมูลจะเข้าสู่สถานะ &quot;รออนุมัติ&quot; และไม่แสดงบนแผนที่จนกว่าผู้ดูแลระบบจะตรวจสอบ</span>
                                    </div>
                                )}

                                {hasLowConfidence && (
                                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 leading-relaxed font-medium">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                        <span>ผลตรวจมีค่า confidence ต่ำกว่าเกณฑ์ หากส่งบันทึก ข้อมูลจะเข้าสู่สถานะ &quot;รออนุมัติ&quot; และไม่แสดงบนแผนที่จนกว่าผู้ดูแลระบบจะตรวจสอบ</span>
                                    </div>
                                )}

                                {/* ต้องรอ admin อนุมัติ (confidence ต่ำ / สารซ้ำ): ส่งได้แต่เข้าคิว pending | ปกติ: บันทึกทันที */}
                                <button
                                    onClick={() => onConfirmSave(needsAdminReview)}
                                    className={`w-full py-3.5 min-h-13 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-white shadow-sm transition-all duration-200 ${
                                        needsAdminReview ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-700 hover:bg-teal-800"
                                    }`}
                                >
                                    {needsAdminReview ? <Clock size={15} /> : <Database size={15} />}
                                    {needsAdminReview ? "ส่งเพื่อรอตรวจสอบ" : "บันทึกลงฐานข้อมูล"}
                                </button>

                                {/* ทางออกสำรอง — ผลลัพธ์นี้ไม่ใช่สิ่งที่ต้องการ กลับไปถ่ายใหม่ได้โดยไม่ต้องออกจากหน้า */}
                                <button
                                    onClick={onResetClick}
                                    className="w-full py-2.5 min-h-10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 text-text-secondary border border-border bg-surface hover:bg-surface-subtle transition-all duration-200"
                                >
                                    <RotateCcw size={13} /> ไม่ใช่สารที่ต้องการ · เริ่มใหม่
                                </button>
                            </div>
                        ) : (
                            /* บันทึก/ส่งสำเร็จ — ข้อความต่างกันตาม pending หรือไม่ */
                            <div
                                className={`text-center p-6 border rounded-xl flex flex-col items-center gap-3 ${
                                    needsAdminReview ? "border-amber-500/30 bg-amber-50/60" : "border-teal-500/30 bg-teal-50/60"
                                }`}
                            >
                                {needsAdminReview ? <Clock className="text-amber-600" size={28} /> : <CheckCircle2 className="text-teal-600 animate-bounce" size={28} />}
                                <div>
                                    <p className={`text-sm font-semibold ${needsAdminReview ? "text-amber-900" : "text-teal-900"}`}>
                                        {needsAdminReview ? "ส่งข้อมูลเรียบร้อย รอการตรวจสอบจากผู้ดูแลระบบ" : "บันทึกข้อมูลเข้าสู่ระบบเรียบร้อย"}
                                    </p>
                                </div>

                                {/* ปุ่มนำทาง — ถ้าเก็บ id ของ sample ที่เพิ่งบันทึกได้ พาไปหน้ารายละเอียดชุดนี้ตรง ๆ ไม่งั้น fallback กลับหน้ารวมประวัติ */}
                                <button
                                    onClick={() => router.push(savedSampleId ? `/collector/history/${savedSampleId}` : "/collector")}
                                    className={`mt-2 px-5 py-2.5 min-h-10 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer ${
                                        needsAdminReview ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-700 hover:bg-teal-800"
                                    }`}
                                >
                                    {savedSampleId ? "ดูผลการตรวจของชุดนี้" : "กลับสู่หน้าประวัติการตรวจสอบน้ำ"}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* DESKTOP VIEW COMPONENT */}
            <div className="hidden md:block m-4">
                <div className="bg-surface border border-border rounded-xl overflow-hidden flex min-h-150">
                    <DesktopSidebar {...hook} />
                    <div className="flex flex-col flex-1 border-r border-border p-4 gap-4 max-h-[70vh] overflow-y-auto">
                        {step === "upload"
                            ? systemParameters.map((param) => (
                                  <ImageZone
                                      key={param.id}
                                      param={param}
                                      step={step}
                                      preview={imagePreviews[param.id]}
                                      plotFile={imagePlotFiles[param.id]}
                                      measurement={results[param.id]}
                                      verifyError={verifyErrors[param.id]}
                                      onImageFilesChange={(file) => handleImageSelect(param.id, file)}
                                      onNearestLocationsUpdate={setNearestLocations}
                                      allLocations={allLocations}
                                      setIsRecommending={setIsRecommending}
                                      enabled={enabledParamIds.has(param.id)}
                                      onToggle={() => toggleParam(param.id)}
                                  />
                              ))
                            : step === "analyzing"
                              ? activeParameters.map((param) => (
                                    <ImageZone
                                        key={param.id}
                                        param={param}
                                        step={step}
                                        preview={imagePreviews[param.id]}
                                        plotFile={imagePlotFiles[param.id]}
                                        measurement={results[param.id]}
                                        verifyError={verifyErrors[param.id]}
                                        onImageFilesChange={(file) => handleImageSelect(param.id, file)}
                                        onNearestLocationsUpdate={setNearestLocations}
                                        allLocations={allLocations}
                                        setIsRecommending={setIsRecommending}
                                    />
                                ))
                              : resultEntries.map(({ key, param, measurement }) => (
                                    <ImageZone
                                        key={key}
                                        param={param}
                                        step={step}
                                        preview={imagePreviews[key]}
                                        plotFile={imagePlotFiles[key]}
                                        measurement={measurement}
                                        onImageFilesChange={() => {}}
                                        onNearestLocationsUpdate={setNearestLocations}
                                        allLocations={allLocations}
                                        setIsRecommending={setIsRecommending}
                                    />
                                ))}
                        {step === "upload" && <AnalyzeButton {...hook} />}
                    </div>
                    <div className="flex flex-col flex-1 p-4 gap-4">
                        {step === "upload" && (
                            <>
                                <LocationPicker {...hook} />
                                <MetadataFields {...hook} />
                            </>
                        )}
                        {step === "results" && <ResultsPanel setStep={hook.setStep} {...hook} />}{" "}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SubmitPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-dvh">Loading...</div>}>
            <SubmitContent />
        </Suspense>
    );
}
