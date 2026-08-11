"use client";

import { ImageZone } from "@/components/submit/ImageZone";
import { LocationPicker } from "@/components/submit/LocationPicker";
import { MetadataFields } from "@/components/submit/MetadataFields";
import { ResultsPanel } from "@/components/submit/ResultsPanel";
import { AnalyzeButton } from "@/components/submit/NavWorkflow";
import { SubmitSteps } from "@/components/submit/SubmitSteps";
import { Database, CheckCircle2, AlertCircle, Clock, RotateCcw, Copy } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export default function SubmitDesktop(props: any) {
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
        <div className="min-h-dvh w-full bg-bg pb-12 antialiased transition-colors duration-300">
            <canvas ref={hook.hiddenCanvasRef} className="hidden" />

            {/* ── Top Navigation Header ── */}
            <PageHeader title="ระบบส่งตรวจคุณภาพน้ำ" onBack={() => router.back()} />

            {/* ── Main Layout (2 Columns Page Flow) ── */}
            <main className="w-full mx-auto p-4">
                <div className="grid grid-cols-12 gap-4 items-start">
                    <aside className="col-span-12 lg:col-span-4 space-y-4">
                        <div className="bg-card-general border border-border rounded-xl p-4">
                            <SubmitSteps step={step} isSaved={saved} />
                        </div>

                        <div className="bg-card-general border border-border rounded-xl p-4 space-y-3">
                            <h2 className="text-xs font-medium text-text">ตำแหน่งจุดเก็บตัวอย่าง</h2>
                            <LocationPicker {...hook} gpsCoords={hook.gpsCoords} exifCoords={hook.exifCoords} activeSource={hook.activeSource} onSelectSource={hook.onSelectSource} />
                        </div>

                        <div className="bg-card-general border border-border rounded-xl p-4 space-y-3">
                            <h2 className="text-xs font-medium text-text">ข้อมูลประกอบการตรวจ</h2>
                            <MetadataFields {...hook} weatherData={hook.weatherData} />
                        </div>

                        <div className="bg-card-general border border-border rounded-xl p-4 space-y-3">
                            <h2 className="text-xs font-semibold text-text">การดำเนินการ</h2>

                            {step === "results" && (
                                <div className="pb-3 border-b border-border">
                                    <ResultsPanel setStep={hook.setStep} {...hook} />
                                </div>
                            )}

                            <div className="space-y-3 pt-1">
                                {step === "upload" && (
                                    <div className="w-full">
                                        <AnalyzeButton {...hook} />
                                    </div>
                                )}

                                {step === "results" && !saved && (
                                    <div className="space-y-2.5">
                                        {hasDuplicateSubstance && (
                                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-bg-warning/20 border border-border-warning/60 text-xs text-text-warning">
                                                <Copy size={14} className="shrink-0 mt-0.5" />
                                                <span>พบสารซ้ำกัน เลือกเพียงรูปเดียว</span>
                                            </div>
                                        )}

                                        {hasLowConfidence && (
                                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-bg-warning/20 border border-border-warning/60 text-xs text-text-warning">
                                                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                                <span>ค่าความมั่นใจ ต่ำ ข้อมูลจะรออนุมัติ</span>
                                            </div>
                                        )}

                                        <button
                                            onClick={() => onConfirmSave(needsAdminReview)}
                                            className={`w-full py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 text-white shadow-sm transition-all cursor-pointer ${
                                                needsAdminReview ? "bg-text-warning hover:bg-bg-warning" : "bg-secondary hover:bg-primary"
                                            }`}
                                        >
                                            {needsAdminReview ? <Clock size={15} /> : <Database size={15} />}
                                            <span>{needsAdminReview ? "ส่งเพื่อรอตรวจสอบ" : "บันทึกผลตรวจ"}</span>
                                        </button>

                                        <button
                                            onClick={onResetClick}
                                            className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 text-text border border-border bg-card-general hover:bg-surface-subtle transition-all cursor-pointer"
                                        >
                                            <RotateCcw size={13} />
                                            <span>เริ่มใหม่</span>
                                        </button>
                                    </div>
                                )}

                                {step === "results" && saved && (
                                    <div className="space-y-3 text-center">
                                        <div className="flex items-center justify-center gap-2 text-xs font-medium text-text-safe">
                                            {needsAdminReview ? <Clock className="text-text-warning" size={18} /> : <CheckCircle2 className="text-text-safe" size={18} />}
                                            <span>{needsAdminReview ? "รอการตรวจสอบ" : "บันทึกสำเร็จ"}</span>
                                        </div>
                                        <button
                                            onClick={() => router.push(savedSampleId ? `/collector/history/${savedSampleId}` : "/collector")}
                                            className={`w-full py-2.5 text-white rounded-xl text-xs font-medium transition-all cursor-pointer ${
                                                needsAdminReview ? "bg-bg-warning hover:bg-bg-warning/90" : "bg-secondary hover:bg-bg-safe"
                                            }`}
                                        >
                                            {savedSampleId ? "ดูผลการตรวจของชุดนี้" : "กลับสู่หน้าประวัติ"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* RIGHT COLUMN: Image & Parameter List (8 Columns) */}
                    <section className="col-span-12 lg:col-span-8 space-y-4">
                        {step === "upload"
                            ? systemParameters.map((param: any) => (
                                  <div key={param.id} className="bg-card-general border border-border rounded-xl p-4">
                                      <ImageZone
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
                                  </div>
                              ))
                            : step === "analyzing"
                              ? activeParameters.map((param: any) => (
                                    <div key={param.id} className="bg-card-general border border-border rounded-xl p-4">
                                        <ImageZone
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
                                    </div>
                                ))
                              : resultEntries.map(({ key, param, measurement }: any) => (
                                    <div key={key} className="bg-card-general border border-border rounded-xl p-4">
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
                                    </div>
                                ))}
                    </section>
                </div>
            </main>
        </div>
    );
}
