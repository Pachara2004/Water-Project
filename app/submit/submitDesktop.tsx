/**
 * @file submitDesktop.tsx
 * @project Water Monitoring Project
 * @module App / Submit
 * @description
 * view desktop ของหน้าส่งตรวจ: DesktopSidebar (ข้อมูล session + ขั้นตอนแนวตั้ง) ซ้าย และเนื้อหา 2 คอลัมน์ขวา
 * ประกอบจาก LocationPicker, MetadataFields, ImageZone ต่อสาร, AnalyzeButton, ResultsPanel และปุ่มยืนยัน/ส่งตรวจสอบ
 * state และ handler ทั้งหมดมาจาก page.tsx ผ่าน props (ยังพิมพ์เป็น any)
 *
 * Desktop submit view: session sidebar plus a two-column content area. Layout only.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-23
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-24 – 2026-09-03)
 *
 * @lastModified 2026-09-11 12:40
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-07-23 09:35 by Pachara P. - แยกไฟล์ออกจาก page.tsx
 * - 2026-07-24 15:33 by Nopparut U. - ใช้ PageHeader กลาง
 * - 2026-08-21 16:23 by Pachara P. - ปรับ flow การส่งตรวจ
 * - 2026-08-25 by Nopparut U./Pachara P. - แก้ปุ่มส่งตรวจสอบ ลบปุ่มยืนยันสารเดิมหลังส่ง และปรับ flow ให้แอดมิน
 * - 2026-09-02 14:13 by Nopparut U. - รองรับภาพที่ AI ไม่พบหลอดทดลอง
 * - 2026-09-03 by Nopparut U. - ใช้ design token และจัดขนาดตัวอักษรเข้าสเกล
 * - 2026-09-07 10:48 by Pachara P. - ไม่บังคับส่งสองสารแม้เปิด 2 ช่อง
 * - 2026-09-11 12:40 by Pachara P. - แก้วันเวลาเปลี่ยนตอนแสดงผลวิเคราะห์
 *
 * @client-side ทำงานฝั่ง Client ('use client')
 * @license Private / Proprietary
 */

"use client";

import { ImageZone } from "@/components/submit/ImageZone";
import { LocationPicker } from "@/components/submit/LocationPicker";
import { MetadataFields } from "@/components/submit/MetadataFields";
import { ResultsPanel } from "@/components/submit/ResultsPanel";
import { AnalyzeButton } from "@/components/submit/NavWorkflow";
import { SubmitSteps } from "@/components/submit/SubmitSteps";
import { Database, CheckCircle2, AlertCircle, Clock, RotateCcw, Copy, Send } from "lucide-react";
import PageHeader from "@/components/PageHeader";

/**
 * หน้าส่งตรวจบน desktop
 *
 * @param props - state/handler จาก page.tsx (hook, results, step, handleImageSelect ฯลฯ)
 */
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
        hasBlockedPending,
        onConfirmBlockedSubmit,
        onConfirmSave,
        onResetClick,
        saved,
        savedSampleId,
        submittedForReview,
        router,
    } = props;

    return (
        <div className="min-h-dvh w-full bg-bg antialiased transition-colors duration-300">
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

                            <LocationPicker {...hook} gpsCoords={hook.gpsCoords} exifCoords={hook.exifCoords} activeSource={hook.activeSource} onSelectSource={hook.onSelectSource} />

                        
                            <MetadataFields {...hook} weatherData={hook.weatherData} disabled={step !== "upload"} />

                        <div className="bg-card-general border border-border rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs font-semibold text-text">การดำเนินการ</h2>
                                {step === "upload" && activeParameters.length > 0 && activeParameters.filter((p: any) => hook.imageFiles[p.id]).length < activeParameters.length && (
                                    <span className="text-xs font-medium text-text">
                                        คุณเพิ่มรูปแล้ว {activeParameters.filter((p: any) => hook.imageFiles[p.id]).length}/{activeParameters.length} ช่อง
                                    </span>
                                )}
                            </div>

                            {step === "results" && (
                                <div className="pb-3 border-b border-border">
                                    <ResultsPanel setStep={hook.setStep} {...hook} />
                                </div>
                            )}

                            <div className="space-y-3 pt-1">
                                {step === "upload" && (
                                    <div className="w-full space-y-2.5">
                                        <AnalyzeButton {...hook} />

                                        {/* AI ไม่พบหลอดทดลองในบางภาพ — ให้ทางเลือกที่สองแทนการบังคับถ่ายใหม่อย่างเดียว */}
                                        {hasBlockedPending && (
                                            <>
                                                <button
                                                    onClick={onConfirmBlockedSubmit}
                                                    className="w-full py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 text-white bg-warning hover:bg-warning/90 shadow-sm transition-all cursor-pointer"
                                                >
                                                    <Send size={15} />
                                                    <span>ยืนยันส่งให้ผู้ดูแลระบบตรวจสอบ</span>
                                                </button>
                                                <p className="text-xs leading-relaxed text-text-muted text-center">ถ่ายภาพใหม่แล้ววิเคราะห์อีกครั้ง หรือส่งชุดนี้ให้ผู้ดูแลระบบตรวจสอบค่า</p>
                                            </>
                                        )}
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
                                                needsAdminReview ? "bg-warning hover:bg-warning/90" : "bg-secondary hover:bg-primary"
                                            }`}
                                        >
                                            {needsAdminReview ? <Clock size={15} /> : <Database size={15} />}
                                            <span>{needsAdminReview ? "ส่งเพื่อรอตรวจสอบ" : "บันทึกผลตรวจ"}</span>
                                        </button>

                                        {!needsAdminReview && (
                                            <button
                                                onClick={() => onConfirmSave(true)}
                                                className="w-full py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 text-white bg-warning hover:bg-warning/90 shadow-sm transition-all cursor-pointer"
                                            >
                                                <Clock size={15} />
                                                <span>ส่งให้ผู้เชี่ยวชาญตรวจสอบ</span>
                                            </button>
                                        )}

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
                                            {needsAdminReview || submittedForReview ? <Clock className="text-text-warning" size={18} /> : <CheckCircle2 className="text-text-safe" size={18} />}
                                            <span>{needsAdminReview || submittedForReview ? "รอการตรวจสอบ" : "บันทึกสำเร็จ"}</span>
                                        </div>
                                        <button
                                            onClick={() => router.push(savedSampleId ? `/collector/history/${savedSampleId}` : "/collector")}
                                            className={`w-full py-2.5 text-white rounded-xl text-xs font-medium transition-all cursor-pointer ${
                                                needsAdminReview || submittedForReview ? "bg-secondary hover:bg-primary" : "bg-secondary hover:bg-primary"
                                            }`}
                                        >
                                            {savedSampleId ? "ดูผลการตรวจสอบ" : "กลับสู่หน้าประวัติ"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* RIGHT COLUMN: Image & Parameter List (8 Columns) */}
                    <section className="col-span-12 lg:col-span-8  space-y-4">
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
                                            onRevertAutoSwitch={saved ? undefined : () => hook.revertAutoSwitch(key)}
                                            isSaved={saved}
                                        />
                                ))}
                    </section>
                </div>
            </main>
        </div>
    );
}
