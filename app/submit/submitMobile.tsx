/**
 * @file submitMobile.tsx
 * @project Water Monitoring Project
 * @module App / Submit
 * @description
 * view มือถือของหน้าส่งตรวจ: แถบหัว, SubmitSteps แนวนอน แล้วเรียงส่วนต่างๆ แนวตั้ง
 * ประกอบจาก LocationPicker, MetadataFields, ImageZone ต่อสาร, AnalyzeButton, ResultsPanel และปุ่มยืนยัน/ส่งตรวจสอบ
 * state และ handler ทั้งหมดมาจาก page.tsx ผ่าน props (ยังพิมพ์เป็น any)
 *
 * Mobile submit view: header, horizontal steps and a single-column flow. Layout only.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-23
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-24 – 2026-09-14)
 *
 * @lastModified 2026-09-14 16:23
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-07-23 09:35 by Pachara P. - แยกไฟล์ออกจาก page.tsx
 * - 2026-07-24 15:33 by Nopparut U. - ใช้ PageHeader กลาง
 * - 2026-08-21 16:23 by Pachara P. - ปรับ flow การส่งตรวจ
 * - 2026-08-25 by Nopparut U./Pachara P. - แก้ปุ่มส่งตรวจสอบ ลบปุ่มยืนยันสารเดิมหลังส่ง และปรับ flow ให้แอดมิน
 * - 2026-09-02 14:13 by Nopparut U. - รองรับภาพที่ AI ไม่พบหลอดทดลอง
 * - 2026-09-03 by Nopparut U. - ใช้ design token และจัดขนาดตัวอักษรเข้าสเกล
 * - 2026-09-14 16:23 by Nopparut U. - แก้ UI ที่เพี้ยนใน flow และรวมปุ่มดำเนินการไว้ block เดียว
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
 * หน้าส่งตรวจบนมือถือ
 *
 * @param props - state/handler จาก page.tsx (hook, results, step, handleImageSelect ฯลฯ)
 */
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
        hasBlockedPending,
        onConfirmBlockedSubmit,
        onConfirmSave,
        onResetClick,
        saved,
        savedSampleId,
        submittedForReview,
        router,
    } = props;

    const uploadedCount = activeParameters.filter((p: any) => hook.imageFiles[p.id]).length;

    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <canvas ref={hook.hiddenCanvasRef} className="hidden" />

            {/* ── Top Navigation Bar ── */}
            <PageHeader title="ส่งตรวจคุณภาพน้ำ" onBack={() => router.back()} />

            {/* MOBILE VIEW COMPONENT */}
            <div className="px-4 pb-24 space-y-4 mt-3">
                <SubmitSteps step={step} isSaved={saved} />
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
                {step === "upload" && (
                    <>
                        <LocationPicker {...hook} gpsCoords={hook.gpsCoords} exifCoords={hook.exifCoords} activeSource={hook.activeSource} onSelectSource={hook.onSelectSource} />{" "}
                        <MetadataFields {...hook} weatherData={hook.weatherData} />

                        <div className="bg-card-general border border-border rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xs font-semibold text-text">การดำเนินการ</h2>
                                {/* แสดงเฉพาะตอนยังใส่รูปไม่ครบ — ครบแล้วปุ่มวิเคราะห์บอกสถานะเองอยู่แล้ว */}
                                {activeParameters.length > 0 && uploadedCount < activeParameters.length && (
                                    <span className="text-xs font-medium text-text">
                                        คุณเพิ่มรูปแล้ว {uploadedCount}/{activeParameters.length} ช่อง
                                    </span>
                                )}
                            </div>
                            <AnalyzeButton {...hook} />

                            {/* AI ไม่พบหลอดทดลองในบางภาพ — ให้ทางเลือกที่สองแทนการบังคับถ่ายใหม่อย่างเดียว */}
                            {hasBlockedPending && (
                                <div className="space-y-2">
                                    <button
                                        onClick={onConfirmBlockedSubmit}
                                        className="w-full py-3.5 min-h-13 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-white bg-warning hover:bg-warning/90 shadow-sm transition-all duration-200"
                                    >
                                        <Send size={15} />
                                        ยืนยันส่งให้ผู้ดูแลระบบตรวจสอบ
                                    </button>
                                    <p className="text-xs leading-relaxed text-text-muted text-center">ถ่ายภาพใหม่แล้ววิเคราะห์อีกครั้ง หรือส่งชุดนี้ให้ผู้ดูแลระบบตรวจสอบค่า</p>
                                </div>
                            )}
                        </div>
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
                                        <span>ผลตรวจมีค่าความมั่นใจ ต่ำกว่าเกณฑ์ หากส่งบันทึก ข้อมูลจะเข้าสู่สถานะ &quot;รออนุมัติ&quot; และไม่แสดงบนแผนที่จนกว่าผู้ดูแลระบบจะตรวจสอบ</span>
                                    </div>
                                )}

                                <button
                                    onClick={() => onConfirmSave(needsAdminReview)}
                                    className={`w-full py-3.5 min-h-13 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-white shadow-sm transition-all duration-200 ${
                                        needsAdminReview ? "bg-warning hover:bg-warning/90" : "bg-secondary hover:bg-primary"
                                    }`}
                                >
                                    {needsAdminReview ? <Send size={15} /> : <Database size={15} />}
                                    {needsAdminReview ? "ส่งให้ผู้เชี่ยวชาญตรวจสอบ" : "บันทึกผลตรวจ"}
                                </button>

                                {!needsAdminReview && (
                                    <button
                                        onClick={() => onConfirmSave(true)}
                                        className="w-full py-3 min-h-13 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-white bg-warning hover:bg-warning/90 shadow-sm transition-all duration-200"
                                    >
                                        <Send size={15} />
                                        ส่งให้ผู้เชี่ยวชาญตรวจสอบ
                                    </button>
                                )}

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
                                    needsAdminReview || submittedForReview ? "border-border-warning/30 bg-card-general" : "border-border-safe/30 bg-card-general"
                                }`}
                            >
                                {needsAdminReview || submittedForReview ? <Clock className="text-text-warning" size={28} /> : <CheckCircle2 className="text-text-safe animate-bounce" size={28} />}
                                <div>
                                    <p className={`text-sm font-semibold ${needsAdminReview || submittedForReview ? "text-text-warning" : "text-text-safe"}`}>
                                        {needsAdminReview || submittedForReview ? "ส่งข้อมูลเรียบร้อย รอการตรวจสอบจากผู้ดูแลระบบ" : "บันทึกข้อมูลเข้าสู่ระบบเรียบร้อย"}
                                    </p>
                                </div>

                                <button
                                    onClick={() => router.push(savedSampleId ? `/collector/history/${savedSampleId}` : "/collector")}
                                    className={`mt-2 px-5 py-2.5 min-h-10 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer ${
                                        needsAdminReview || submittedForReview ? "bg-warning hover:bg-warning/90" : "bg-secondary hover:bg-primary"
                                    }`}
                                >
                                    {savedSampleId ? "ตรวจสอบข้อมูล" : "กลับสู่หน้าประวัติการตรวจสอบน้ำ"}
                                </button>
                            </div>
                        )}
                        {/* {step === "results" && !saved && !needsAdminReview && (
                            <div className="fixed right-4 z-40" style={{ bottom: "calc(100px + env(safe-area-inset-bottom))" }}>
                                <button
                                    onClick={() => onConfirmSave(true)}
                                    className="inline-flex items-center gap-2 px-3.5 py-3 !bg-[#FE9A00] hover:!bg-[#e08900] active:scale-95 !text-white text-xs font-semibold rounded-xl shadow-lg transition-all duration-200 cursor-pointer select-none"
                                >
                                    <Send size={14} className="shrink-0 text-white" />
                                    <span className="text-white">ส่งให้ผู้เชี่ยวชาญตรวจสอบ</span>
                                </button>
                            </div>
                        )} */}
                    </>
                )}
            </div>
        </div>
    );
}
