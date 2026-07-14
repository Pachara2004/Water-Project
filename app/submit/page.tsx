"use client";

import { Suspense } from "react";
import { useSubmitSample } from "@/lib/hooks/useSubmitSample";
import { isLowConfidence } from "@/lib/standards";
import { ImageZone } from "@/components/submit/ImageZone";
import { LocationPicker } from "@/components/submit/LocationPicker";
import { MetadataFields } from "@/components/submit/MetadataFields";
import { ResultsPanel } from "@/components/submit/ResultsPanel";
import { DesktopSidebar, AnalyzeButton } from "@/components/submit/NavWorkflow";
import { StepDot } from "@/components/submit/SharedAtoms";
import { ArrowLeft, FlaskConical, Sparkles, Database, CheckCircle2, AlertCircle, Clock, Layers, Droplet } from "lucide-react";
import type { DbParameter } from "@/components/submit/types";

// ── ตัวเลือกโหมดการส่ง: เดี่ยว (เลือกสารเดียว) / คู่ (ส่งทุกสารพร้อมกัน) ──
function ModeSelector({
    mode,
    setMode,
    systemParameters,
    selectedParamId,
    setSelectedParamId,
    onReset,
}: {
    mode: "single" | "dual";
    setMode: (m: "single" | "dual") => void;
    systemParameters: DbParameter[];
    selectedParamId: number | null;
    setSelectedParamId: (id: number) => void;
    onReset: () => void;
}) {
    const switchMode = (m: "single" | "dual") => {
        if (m === mode) return;
        setMode(m);
        onReset(); // ล้างสถานะบล็อกเมื่อเปลี่ยนโหมด
    };

    return (
        <section className="rounded-xl border border-border bg-surface p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={() => switchMode("single")}
                    className={`flex items-center justify-center gap-1.5 py-2.5 min-h-11 rounded-lg text-xs font-semibold border transition-all ${
                        mode === "single" ? "bg-teal-700 text-white border-teal-700" : "bg-surface-subtle text-text-secondary border-border hover:border-teal-500/50"
                    }`}
                >
                    <Droplet size={14} /> ส่งเดี่ยว
                </button>
                <button
                    onClick={() => switchMode("dual")}
                    className={`flex items-center justify-center gap-1.5 py-2.5 min-h-11 rounded-lg text-xs font-semibold border transition-all ${
                        mode === "dual" ? "bg-teal-700 text-white border-teal-700" : "bg-surface-subtle text-text-secondary border-border hover:border-teal-500/50"
                    }`}
                >
                    <Layers size={14} /> ส่งคู่
                </button>
            </div>

            {/* โหมดเดี่ยว: ให้เลือกว่าจะส่งสารตัวไหน */}
            {mode === "single" && (
                <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-text-muted">เลือกสารที่จะส่งตรวจ</p>
                    <div className="grid grid-cols-2 gap-2">
                        {systemParameters.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => {
                                    setSelectedParamId(p.id);
                                    onReset();
                                }}
                                className={`py-2 min-h-10 rounded-lg text-xs font-semibold border transition-all ${
                                    selectedParamId === p.id ? "bg-teal-50 text-teal-800 border-teal-500 dark:bg-teal-950/40 dark:text-teal-200" : "bg-surface-subtle text-text-secondary border-border hover:border-teal-500/50"
                                }`}
                            >
                                {p.name.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

function SubmitContent() {
    const hook = useSubmitSample();
    const {
        systemParameters,
        activeParameters,
        mode,
        setMode,
        selectedParamId,
        setSelectedParamId,
        verifyErrors,
        setVerifyErrors,
        isLoadingParams,
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
        sessionId,
        saved,
        handleSave,
    } = hook;

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

    const onConfirmSave = async (lowConfidence: boolean) => {
        const Swal = (await import("sweetalert2")).default; // เรียกใช้ Swal ตรงจากโมดูลสากลในเครื่องบอส

        Swal.fire({
            title: lowConfidence ? "ยืนยันส่งข้อมูลเพื่อรอตรวจสอบ" : "ยืนยันการบันทึกข้อมูล",
            text: lowConfidence
                ? "ค่า confidence ของผลตรวจต่ำกว่าเกณฑ์ ข้อมูลนี้จะถูกส่งเข้าสถานะ \"รออนุมัติ\" และไม่แสดงบนแผนที่จนกว่าผู้ดูแลระบบจะตรวจสอบและยืนยัน"
                : "คุณต้องการบันทึกผลการตรวจสอบน้ำนี้ลงฐานข้อมูล",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: lowConfidence ? "#B45309" : "#0D9488", // amber สำหรับ pending / teal-700 สำหรับบันทึกปกติ
            cancelButtonColor: "#6B7280",
            confirmButtonText: lowConfidence ? "ใช่ ส่งเพื่อรอตรวจสอบ" : "ใช่ บันทึกข้อมูล",
            cancelButtonText: "ยกเลิก",
            allowOutsideClick: () => !Swal.isLoading(), // บล็อกไม่ให้คลิกพื้นหลังปิดตอนกำลังโหลด
        }).then((result) => {
            if (result.isConfirmed) {
                // เปิดสถานะหมุนโหลดตัวเต็มจอ บล็อกปุ่มกดเล่นซ้ำซ้อน
                Swal.fire({
                    title: "กำลังบันทึกข้อมูล...",
                    text: "กรุณารอสักครู่ ระบบกำลังจัดเก็บข้อมูล",
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    didOpen: () => {
                        Swal.showLoading(); // สั่งให้สปินเนอร์ของ Swal หมุนทำงานค้างไว้
                    },
                });

                // สั่งรันฟังก์ชันยิง API ของเดิมที่อยู่ใน Hook
                handleSave()
                    .then(() => {
                        Swal.close(); // ปิดโหลดตัวสปินเนอร์เมื่อยิง Network จบสำเร็จจริง ๆ
                    })
                    .catch((err) => {
                        Swal.fire({
                            title: "เกิดข้อผิดพลาด",
                            text: err.message || "ไม่สามารถบันทึกข้อมูลได้สำเร็จ กรุณาลองใหม่อีกครั้ง",
                            icon: "error",
                            confirmButtonColor: "#0D9488",
                        });
                    });
            }
        });
    };

    const hasLowConfidence = activeParameters.some((param) => isLowConfidence(results[param.id]?.confidence));

    const currentStep = step === "upload" ? 1 : step === "analyzing" ? 2 : 3;

    return (
        <div className="min-h-dvh w-full bg-surface-muted pb-5 antialiased transition-colors duration-300">
            <canvas ref={hook.hiddenCanvasRef} className="hidden" />

            {/* ── Top Navigation Bar ── */}
            <div className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-text-secondary min-h-11">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-text-primary">ส่งตรวจคุณภาพน้ำ</h1>
                </div>
                <div className="w-10" />
            </div>

            {/* MOBILE VIEW COMPONENT */}
            <div className="md:hidden px-4 pb-24 space-y-4 mt-3">
                {step === "upload" && !isLoadingParams && (
                    <ModeSelector
                        mode={mode}
                        setMode={setMode}
                        systemParameters={systemParameters}
                        selectedParamId={selectedParamId}
                        setSelectedParamId={setSelectedParamId}
                        onReset={() => setVerifyErrors({})}
                    />
                )}
                {isLoadingParams ? (
                    <div className="text-center text-xs py-8 text-text-muted">กำลังโหลดข้อมูลสารเคมี...</div>
                ) : (
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
                )}
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
                                {hasLowConfidence && (
                                    <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-700 leading-relaxed font-medium">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                        <span>
                                            ผลตรวจมีค่า confidence ต่ำกว่าเกณฑ์ หากส่งบันทึก ข้อมูลจะเข้าสู่สถานะ &quot;รออนุมัติ&quot; และไม่แสดงบนแผนที่จนกว่าผู้ดูแลระบบจะตรวจสอบ
                                        </span>
                                    </div>
                                )}

                                {/* confidence ต่ำ: ส่งได้แต่เข้าคิว pending |  ปกติ: บันทึกทันที */}
                                <button
                                    onClick={() => onConfirmSave(hasLowConfidence)}
                                    className={`w-full py-3.5 min-h-[52px] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-white shadow-sm transition-all duration-200 ${
                                        hasLowConfidence ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-700 hover:bg-teal-800"
                                    }`}
                                >
                                    {hasLowConfidence ? <Clock size={15} /> : <Database size={15} />}
                                    {hasLowConfidence ? "ส่งเพื่อรอตรวจสอบ" : "บันทึกลงฐานข้อมูล"}
                                </button>
                            </div>
                        ) : (
                            /* บันทึก/ส่งสำเร็จ — ข้อความต่างกันตาม pending หรือไม่ */
                            <div
                                className={`text-center p-6 border rounded-xl flex flex-col items-center gap-3 ${
                                    hasLowConfidence ? "border-amber-500/30 bg-amber-50/60" : "border-teal-500/30 bg-teal-50/60"
                                }`}
                            >
                                {hasLowConfidence ? (
                                    <Clock className="text-amber-600" size={28} />
                                ) : (
                                    <CheckCircle2 className="text-teal-600 animate-bounce" size={28} />
                                )}
                                <div>
                                    <p className={`text-sm font-semibold ${hasLowConfidence ? "text-amber-900" : "text-teal-900"}`}>
                                        {hasLowConfidence ? "ส่งข้อมูลเรียบร้อย รอการตรวจสอบจากผู้ดูแลระบบ" : "บันทึกข้อมูลเข้าสู่ระบบเรียบร้อย"}
                                    </p>
                                </div>

                                {/* ปุ่มนำทางกลับสู่แดชบอร์ด /collector */}
                                <button
                                    onClick={() => router.push("/collector")}
                                    className={`mt-2 px-5 py-2.5 min-h-[40px] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer ${
                                        hasLowConfidence ? "bg-amber-600 hover:bg-amber-700" : "bg-teal-700 hover:bg-teal-800"
                                    }`}
                                >
                                    กลับสู่หน้าประวัติการตรวจสอบน้ำ
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* DESKTOP VIEW COMPONENT */}
            <div className="hidden md:block m-4">
                <div className="bg-surface border border-border rounded-xl overflow-hidden flex min-h-[600px]">
                    <DesktopSidebar {...hook} />
                    <div className="flex flex-col flex-1 border-r border-border p-4 gap-4 max-h-[70vh] overflow-y-auto">
                        {step === "upload" && !isLoadingParams && (
                            <ModeSelector
                                mode={mode}
                                setMode={setMode}
                                systemParameters={systemParameters}
                                selectedParamId={selectedParamId}
                                setSelectedParamId={setSelectedParamId}
                                onReset={() => setVerifyErrors({})}
                            />
                        )}
                        {activeParameters.map((param) => (
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
