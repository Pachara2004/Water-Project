"use client";

import { ImageZone } from "@/components/submit/ImageZone";
import { LocationPicker } from "@/components/submit/LocationPicker";
import { MetadataFields } from "@/components/submit/MetadataFields";
import { ResultsPanel } from "@/components/submit/ResultsPanel";
import { AnalyzeButton } from "@/components/submit/NavWorkflow";
import { SubmitSteps } from "@/components/submit/SubmitSteps";
import { Database, CheckCircle2, AlertCircle, Clock, RotateCcw, Copy } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function SubmitMobile(props: any) {
    const {
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
        router,
    } = props;

    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <canvas ref={hook.hiddenCanvasRef} className="hidden" />

            {/* ── Top Navigation Bar ── */}
            <PageHeader title="ส่งตรวจคุณภาพน้ำ" onBack={() => router.back()} />

            {/* MOBILE VIEW COMPONENT */}
            <div className="px-4 pb-24 space-y-4 mt-3">
                <SubmitSteps step={step} />
                {step === "upload"
                    ? systemParameters.map((param: any) => (
                          <ImageZone
                              key={param.id}
                              param={param}
                              step={step}
                              preview={imagePreviews[param.id]}
                              plotFile={imagePlotFiles[param.id]}
                              measurement={results[param.id]}
                              verifyError={verifyErrors[param.id]}
                              onImageFilesChange={(file: File) => handleImageSelect(param.id, file)}
                              onNearestLocationsUpdate={setNearestLocations}
                              allLocations={allLocations}
                              setIsRecommending={setIsRecommending}
                              enabled={enabledParamIds.has(param.id)}
                              onToggle={() => toggleParam(param.id)}
                          />
                      ))
                    : step === "analyzing"
                      ? activeParameters.map((param: any) => (
                            <ImageZone
                                key={param.id}
                                param={param}
                                step={step}
                                preview={imagePreviews[param.id]}
                                plotFile={imagePlotFiles[param.id]}
                                measurement={results[param.id]}
                                verifyError={verifyErrors[param.id]}
                                onImageFilesChange={(file: File) => handleImageSelect(param.id, file)}
                                onNearestLocationsUpdate={setNearestLocations}
                                allLocations={allLocations}
                                setIsRecommending={setIsRecommending}
                            />
                        ))
                      : resultEntries.map(({ key, param, measurement }: any) => (
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
                        <LocationPicker {...hook} gpsCoords={hook.gpsCoords} exifCoords={hook.exifCoords} activeSource={hook.activeSource} onSelectSource={hook.onSelectSource} />{" "}
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
                                    <div className="flex items-start gap-2 p-3 rounded-xl bg-bg-warning border-border-warning text-xs text-text-warning leading-relaxed font-medium">
                                        <Copy size={14} className="shrink-0 mt-0.5" />
                                        <span>ตรวจพบสารซ้ำกัน กรุณาแตะเลือกเก็บไว้เพียงรูปเดียว รูปที่ไม่ได้เลือกจะไม่ถูกเก็บ</span>
                                    </div>
                                )}

                                {hasLowConfidence && (
                                    <div className="flex items-start gap-2 p-3 rounded-xl bg-bg-warning border-border-warning text-xs text-text-warning leading-relaxed font-medium">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                        <span>ผลตรวจมีค่า confidence ต่ำกว่าเกณฑ์ หากส่งบันทึก ข้อมูลจะเข้าสู่สถานะ &quot;รออนุมัติ&quot; และไม่แสดงบนแผนที่จนกว่าผู้ดูแลระบบจะตรวจสอบ</span>
                                    </div>
                                )}

                                <button
                                    onClick={() => onConfirmSave(needsAdminReview)}
                                    className={`w-full py-3.5 min-h-13 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-white shadow-sm transition-all duration-200 ${
                                        needsAdminReview ? "bg-text-warning hover:bg-bg-warning" : "bg-secondary hover:bg-bg-safe"
                                    }`}
                                >
                                    {needsAdminReview ? <Clock size={15} /> : <Database size={15} />}
                                    {needsAdminReview ? "ส่งเพื่อรอตรวจสอบ" : "บันทึกผลตรวจ"}
                                </button>

                                <button
                                    onClick={onResetClick}
                                    className="w-full py-3.5 min-h-13 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 text-text border border-border bg-card-general hover:bg-surface-subtle transition-all duration-200"
                                >
                                    <RotateCcw size={13} /> ไม่ใช่สารที่ต้องการ · เริ่มใหม่
                                </button>
                            </div>
                        ) : (
                            <div
                                className={`text-center p-6 border rounded-xl flex flex-col items-center gap-3 ${
                                    needsAdminReview ? "border-border-warning/30 bg-card-general" : "border-border-safe/30 bg-card-general"
                                }`}
                            >
                                {needsAdminReview ? <Clock className="text-text-warning" size={28} /> : <CheckCircle2 className="text-text-safe animate-bounce" size={28} />}
                                <div>
                                    <p className={`text-sm font-semibold ${needsAdminReview ? "text-text-warning" : "text-text-safe"}`}>
                                        {needsAdminReview ? "ส่งข้อมูลเรียบร้อย รอการตรวจสอบจากผู้ดูแลระบบ" : "บันทึกข้อมูลเข้าสู่ระบบเรียบร้อย"}
                                    </p>
                                </div>

                                <button
                                    onClick={() => router.push(savedSampleId ? `/collector/history/${savedSampleId}` : "/collector")}
                                    className={`mt-2 px-5 py-2.5 min-h-10 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer ${
                                        needsAdminReview ? "bg-bg-warning hover:bg-bg-warning" : "bg-secondary hover:bg-bg-safe"
                                    }`}
                                >
                                    {savedSampleId ? "ดูผลการตรวจของชุดนี้" : "กลับสู่หน้าประวัติการตรวจสอบน้ำ"}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
