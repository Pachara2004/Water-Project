"use client";

import { Suspense } from "react";
import { useSubmitSample } from "@/lib/hooks/useSubmitSample";
import { ImageZone } from "@/components/submit/ImageZone";
import { LocationPicker } from "@/components/submit/LocationPicker";
import { MetadataFields } from "@/components/submit/MetadataFields";
import { ResultsPanel } from "@/components/submit/ResultsPanel";
import { DesktopSidebar, AnalyzeButton } from "@/components/submit/NavWorkflow";
import { StepDot } from "@/components/submit/SharedAtoms";
import { ArrowLeft, FlaskConical, Sparkles, Database, CheckCircle2 } from "lucide-react";

function SubmitContent() {
    const hook = useSubmitSample();
    const {
        systemParameters,
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

        // แตก Base64 สำหรับทำ Preview บนหน้าจอ
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreviews((prev) => ({ ...prev, [paramId]: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const onConfirmSave = async () => {
        const Swal = (await import("sweetalert2")).default; // เรียกใช้ Swal ตรงจากโมดูลสากลในเครื่องบอส

        Swal.fire({
            title: "ยืนยันการบันทึกข้อมูล",
            text: "คุณต้องการบันทึกผลการตรวจสอบน้ำนี้ลงฐานข้อมูล",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#0D9488", // สี Teal-700 ให้เข้าเซ็ตระบบบอส
            cancelButtonColor: "#6B7280",
            confirmButtonText: "ใช่ บันทึกข้อมูล",
            cancelButtonText: "ยกเลิก",
            allowOutsideClick: () => !Swal.isLoading(), // บล็อกไม่ให้คลิกพื้นหลังปิดตอนกำลังโหลด
        }).then((result) => {
            if (result.isConfirmed) {
                // 🌟 เปิดสถานะหมุนโหลดตัวเต็มจอ บล็อกปุ่มกดเล่นซ้ำซ้อน
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

    const hasLowConfidence = systemParameters.some((param) => {
        const resData = results[param.id];
        if (!resData || resData.confidence === undefined) return false;
        // ดักทั้งกรณีส่งมาแบบ 0.6 หรือส่งมาแบบเต็ม 60
        return resData.confidence < 0.6;
    });

    const currentStep = step === "upload" ? 1 : step === "analyzing" ? 2 : 3;

    return (
        <div className="min-h-screen w-full bg-primary pb-5 antialiased">
            <canvas ref={hook.hiddenCanvasRef} className="hidden" />

            {/* ── Top Navigation Bar ── */}
            <div className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[11px] text-text-secondary min-h-[44px]">
                    <ArrowLeft size={14} /> <span>Back</span>
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-text-primary">ส่งตรวจคุณภาพน้ำ</h1>
                </div>
                <div className="w-10" />
            </div>

            {/* MOBILE VIEW COMPONENT */}
            <div className="md:hidden px-4 pb-24 space-y-4 mt-3">
                {isLoadingParams ? (
                    <div className="text-center text-xs py-8 text-text-muted">กำลังโหลดข้อมูลสารเคมี...</div>
                ) : (
                    systemParameters.map((param) => (
                        <ImageZone
                            key={param.id}
                            param={param}
                            step={step}
                            preview={imagePreviews[param.id]}
                            plotFile={imagePlotFiles[param.id]}
                            measurement={results[param.id]}
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
                        {hasLowConfidence ? (
                            /* 🔴 กรณีไม่ผ่าน: บังคับย้อนกลับ แทนที่ปุ่มบันทึกไปเลย */
                            <button
                                onClick={() => hook.setStep("upload")}
                                className="w-full py-3.5 min-h-[52px] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all duration-200"
                            >
                                ย้อนกลับไปถ่ายภาพใหม่
                            </button>
                        ) : !saved ? (
                            /* 🟢 กรณีผ่านหมด: แสดงปุ่มบันทึกปกติ */
                            <button
                                onClick={onConfirmSave} // 🌟 เปลี่ยนมาเรียกตัว Confirm ดักตรงนี้แทนครับบอส
                                className="w-full py-3.5 min-h-[52px] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 text-white shadow-sm transition-all duration-200"
                            >
                                <Database size={15} /> บันทึกลงฐานข้อมูล
                            </button>
                        ) : (
                            /* 🤝 บันทึกสำเร็จ */
                            <div className="text-center p-6 border rounded-xl border-teal-500/30 bg-teal-50/60 flex flex-col items-center gap-3">
                                <CheckCircle2 className="text-teal-600 animate-bounce" size={28} />
                                <div>
                                    <p className="text-sm font-semibold text-teal-900">บันทึกข้อมูลเข้าสู่ระบบเรียบร้อย</p>
                                </div>

                                {/* 🌟 ปุ่มนำทางกลับสู่แดชบอร์ด /collector */}
                                <button
                                    onClick={() => router.push("/collector")}
                                    className="mt-2 px-5 py-2.5 min-h-[40px] bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
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
                        {systemParameters.map((param) => (
                            <ImageZone
                                key={param.id}
                                param={param}
                                step={step}
                                preview={imagePreviews[param.id]}
                                plotFile={imagePlotFiles[param.id]}
                                measurement={results[param.id]}
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
