/**
 * @file ImageZone.tsx
 * @project Water Monitoring Project
 * @module UI / Submit / Image
 * @description
 * ช่องอัปโหลดภาพหลอดทดสอบของสารหนึ่งตัว (ถ่ายจากกล้องหรือเลือกจากแกลเลอรี) พร้อมป็อปโอเวอร์
 * ตัวอย่างสีและสเกลสีจากแผ่นเทียบ Test Kit ตอนเลือกไฟล์จะอ่านพิกัด EXIF เพื่อแนะนำสถานีใกล้เคียง
 * แสดงแถบ progress จำลองระหว่างอัปโหลด และหลังวิเคราะห์จะแสดงภาพผล ค่า ความมั่นใจ และแบนเนอร์
 * (สลับสารอัตโนมัติ / สารไม่รู้จัก / ไม่พบหลอดทดลอง) ค่าของภาพที่ AI ไม่พบหลอดจะไม่แสดงให้ผู้ส่ง
 * จนกว่า admin จะตรวจ blob URL ถูก revoke เมื่อเปลี่ยนไฟล์หรือ unmount
 *
 * Per-parameter test-tube image uploader with colour-scale reference, EXIF-based
 * station suggestion, simulated upload progress and post-analysis result display.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-07
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-14 – 2026-09-03)
 *
 * @lastModified 2026-09-11 15:47
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-07-07 15:30 by Pachara P. - แยกช่องอัปโหลดออกมาตอนปรับโครงสร้างไฟล์ submit
 * - 2026-07-14 – 07-16 by Nopparut U. - โหมดส่งตัวอย่าง, flow สารผิดช่อง และสารซ้ำ
 * - 2026-08-04 12:22 by Pachara P. - แสดง confidence
 * - 2026-08-21 16:23 by Pachara P. - ปรับ flow การส่งตรวจ
 * - 2026-09-02 14:13 by Nopparut U. - ส่งภาพที่ AI ไม่พบหลอดทดลองเข้าคิวตรวจสอบได้ ซ่อนค่าจนกว่า admin ตรวจ
 * - 2026-09-03 11:51 by Nopparut U. - เพิ่มข้อความบอกวิธีใส่รูป
 * - 2026-09-07 10:25 by Pachara P. - อัปโหลดรูปพร้อมหน่วงการวิเคราะห์
 * - 2026-09-10 09:48 by Pachara P. - เพิ่ม progress bar ตอนอัปโหลด
 * - 2026-09-11 by Pachara P. - แก้การอัปโหลดรูปหลายรอบ
 *
 * @client-side ใช้ hook, File API, URL.createObjectURL ต้องอยู่ใน Client Component
 * @notes อ่าน EXIF ผ่าน dynamic import ของ lib/exif เพื่อไม่โหลดไลบรารีจนกว่าจะมีการเลือกไฟล์
 * @license Private / Proprietary
 */

import { useRef, useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { Camera, ImagePlus, CheckCircle2, AlertTriangle, Eye, FlaskConical, Info, X, ToggleLeft, Download, Maximize2 } from "lucide-react";
import { alertError, errorToast } from "@/lib/swal";
import { DbParameter, MeasurementResult, VerifyError } from "./types";
import { SectionHead } from "./SharedAtoms";

/** รูปตัวอย่างสีของเหลวชุดทดสอบต่อสาร (คีย์ = ชื่อสารตัวพิมพ์เล็ก) */
const PARAM_EXAMPLE_IMAGE: Record<string, string> = {
    ammonia: "/testkit-examples/ammonia.jpg",
    phosphate: "/testkit-examples/phosphate.jpg",
};

/** ช่องสีหนึ่งช่องบนแผ่นเทียบมาตรฐาน Test Kit พร้อมระดับความปลอดภัย */
interface ColorScale {
    color: string;
    value: string;
    level: "safe" | "warning" | "danger";
}

const PARAM_COLOR_SWATCHES: Record<string, ColorScale[]> = {
    ammonia: [
        { color: "#FFFF80", value: "0", level: "safe" },
        { color: "#C8E64C", value: "0.25", level: "safe" },
        { color: "#82C832", value: "0.5", level: "warning" },
        { color: "#3C9628", value: "1.0", level: "warning" },
        { color: "#14641E", value: "2.0", level: "danger" },
        { color: "#0A3C14", value: "5.0", level: "danger" },
    ],
    phosphate: [
        { color: "#F0F4F8", value: "0", level: "safe" },
        { color: "#B3D9FF", value: "0.1", level: "safe" },
        { color: "#66B2FF", value: "0.25", level: "warning" },
        { color: "#1A85FF", value: "0.5", level: "warning" },
        { color: "#0052CC", value: "1.0", level: "danger" },
        { color: "#002984", value: "2.0", level: "danger" },
    ],
};

function matchParamKey(name: string, table: Record<string, any>): string | null {
    const n = name.toLowerCase();
    return Object.keys(table).find((key) => n.includes(key)) ?? null;
}

/** Props ของ ImageZone */
interface ImageZoneProps {
    /** สารของช่องนี้ */
    param: DbParameter;
    step: "upload" | "analyzing" | "results";
    /** URL ภาพต้นฉบับที่เลือกไว้ */
    preview?: string;
    /** ภาพผลวิเคราะห์ (File จากการวิเคราะห์สด หรือ URL จาก DB) */
    plotFile?: File | string;
    measurement?: MeasurementResult;
    /** เหตุผลที่ผลถูกบล็อก */
    verifyError?: VerifyError;
    /** เรียกเมื่อผู้ใช้เลือกไฟล์ใหม่ */
    onImageFilesChange: (file: File) => void;
    /** ส่งรายการสถานีใกล้พิกัด EXIF กลับให้หน้าแม่ */
    onNearestLocationsUpdate: (locations: any[]) => void;
    allLocations: any[];
    setIsRecommending: (b: boolean) => void;
    /** เปิดสวิตช์ช่องนี้อยู่ (ค่าเริ่มต้น true) */
    enabled?: boolean;
    onToggle?: () => void;
    onRevertAutoSwitch?: () => void;
    /** แสดงในหน้าประวัติ (อ่านอย่างเดียว) */
    isHistoryView?: boolean;
    /** บันทึก/ส่งตรวจสอบไปแล้ว — ซ่อนแบนเนอร์แจ้งเตือนก่อนบันทึก (สลับสารอัตโนมัติ/สารไม่รู้จัก) ที่ทำอะไรไม่ได้แล้ว */
    isSaved?: boolean;
}

/**
 * ช่องอัปโหลดภาพของสารหนึ่งตัว
 *
 * @param props - ดู {@link ImageZoneProps}
 */
export function ImageZone({
    param,
    step,
    preview,
    plotFile,
    measurement,
    verifyError,
    onImageFilesChange,
    onNearestLocationsUpdate,
    allLocations,
    setIsRecommending,
    enabled = true,
    onToggle,
    onRevertAutoSwitch,
    isHistoryView = false,
    isSaved = false,
}: ImageZoneProps) {
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [viewMode, setViewMode] = useState<"raw" | "analyzed">("analyzed");
    const [showExampleModal, setShowExampleModal] = useState(false);
    const [showLightbox, setShowLightbox] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    useEffect(() => {
        if (!showLightbox) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setShowLightbox(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showLightbox]);

    const paramKey = matchParamKey(param.name, PARAM_EXAMPLE_IMAGE);
    const exampleImage = paramKey ? PARAM_EXAMPLE_IMAGE[paramKey] : null;
    const colorSwatches = paramKey ? PARAM_COLOR_SWATCHES[paramKey] : null;

    // AI ไม่พบหลอดทดลอง → ค่าและความมั่นใจเชื่อไม่ได้ ไม่แสดงให้ผู้ส่งเห็นจนกว่าผู้ดูแลระบบจะตรวจสอบ
    // (ค่าจริงยังถูกบันทึกลงฐานข้อมูลครบเพื่อให้ผู้ดูแลระบบใช้ประกอบการตัดสิน)
    const isPendingAdminValue = measurement?.isTestTube === false;

    const hasConf = typeof measurement?.confidence === "number";
    const isLowConf = typeof measurement?.confidence === "number" && measurement.confidence < 0.6;
    const confDisplay = hasConf ? `${measurement?.confidence}` : "N/A";

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            errorToast("ขนาดไฟล์ใหญ่เกินกำหนด!", "รูปภาพผลน้ำต้องมีขนาดไม่เกิน 10MB กรุณาถ่ายภาพใหม่หรือลดความละเอียดลงครับ");
            return;
        }
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            alertError("รูปแบบไฟล์ไม่ถูกต้อง!", "ระบบอนุญาตเฉพาะไฟล์รูปภาพสากล (.jpg, .jpeg, .png, .webp) เท่านั้นครับ");
            return;
        }

        // ─── Artificial Progress (Labor Illusion) ───
        setUploadProgress(0);
        await new Promise<void>((resolve) => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.floor(Math.random() * 20) + 15;
                if (progress >= 100) {
                    progress = 100;
                    setUploadProgress(100);
                    clearInterval(interval);
                    setTimeout(() => {
                        setUploadProgress(null);
                        resolve();
                    }, 300); // ค้างที่ 100% แป๊บนึงให้ดูสมจริง
                } else {
                    setUploadProgress(progress);
                }
            }, 150);
        });

        onImageFilesChange(file);
        setIsRecommending(true);
        try {
            const { getExifLocation, calculateDistance } = await import("@/lib/exif");
            const coords = await getExifLocation(file);
            if (coords && allLocations.length) {
                const sorted = [...allLocations].sort(
                    (a, b) => calculateDistance(coords.latitude, coords.longitude, a.lat, a.lng) - calculateDistance(coords.latitude, coords.longitude, b.lat, b.lng),
                );
                onNearestLocationsUpdate(sorted.slice(0, 5));
            }
        } catch (err) {
            console.error("EXIF Error:", err);
        } finally {
            setIsRecommending(false);
        }
    };

    const hasPlotImg = !!plotFile;

    // Memoize the displayed image to avoid re-creating blob URLs on every render.
    // The previous blob URL is revoked when the value changes or the component unmounts
    // to prevent unbounded memory growth that stalls the GC mid-animation.
    const displayImgSrc = useMemo(() => {
        // 1. ผลวิเคราะห์สด (มี plotFile)
        if (step === "results" && viewMode === "analyzed" && hasPlotImg) {
            return plotFile instanceof Blob ? URL.createObjectURL(plotFile) : (plotFile as string);
        }
        // 2. ดึงทุก Field ที่เป็นไปได้จาก DB/State
        const m = measurement as any;
        return (
            preview ||
            m?.imageUrl ||
            m?.originalImageUrl ||
            m?.imagePath ||
            m?.plotUrl ||
            m?.image ||
            m?.photoUrl ||
            m?.url
        );
    }, [step, viewMode, hasPlotImg, plotFile, preview, measurement]);

    // Revoke stale blob URLs when the source changes or the component unmounts.
    useEffect(() => {
        return () => {
            if (typeof displayImgSrc === "string" && displayImgSrc.startsWith("blob:")) {
                URL.revokeObjectURL(displayImgSrc);
            }
        };
    }, [displayImgSrc]);

    return (
        <section
            id={`param-zone-${param.id}`}
            className={`rounded-xl overflow-visible border transition-colors duration-300 bg-surface relative ${verifyError ? "border-danger ring-1 ring-danger/40" : "border-border"}`}
        >
            <div className="text-sm font-semibold relative">
                <SectionHead icon={<Camera size={16} />} label={`ภาพถ่ายผลทดสอบ: ${param.name.toUpperCase()}`} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2.5 z-10">
                    {exampleImage && (
                        <button
                            type="button"
                            onClick={() => setShowExampleModal((v) => !v)}
                            aria-label={`ดูตัวอย่างสี ${param.name}`}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                            <Info size={15} />
                        </button>
                    )}
                </div>

                {/* Popover แสดงตัวอย่างสี + แถบเฉดสีเคมีจริง */}
                {showExampleModal && exampleImage && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowExampleModal(false)} />
                        <div className="absolute right-3 top-full mt-1 z-50 w-80 max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-2xl shadow-2xl p-3.5 animate-fade-in space-y-3">
                            <div className="flex items-center justify-between pb-1 border-b border-border">
                                <span className="text-xs font-semibold text-text">เกณฑ์เทียบสี {param.name.toUpperCase()}</span>
                                <button
                                    onClick={() => setShowExampleModal(false)}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-subtle transition-colors cursor-pointer shrink-0"
                                >
                                    <X size={13} />
                                </button>
                            </div>

                            {/* Swatches เฉดสี */}
                            {colorSwatches && colorSwatches.length > 0 && (
                                <div className="grid grid-cols-6 gap-1.5">
                                    {colorSwatches.map((item, idx) => (
                                        <div key={idx} className="flex flex-col items-center gap-1">
                                            <div
                                                className="w-full h-7 rounded-lg border border-black/15 dark:border-white/20 shadow-xs transition-transform hover:scale-105"
                                                style={{ backgroundColor: item.color }}
                                                title={`${item.value} mg/L`}
                                            />
                                            <span className="text-xs font-semibold text-text">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* รูปภาพการ์ดเทียบสี */}
                            <div className="rounded-xl overflow-hidden border border-border bg-surface-subtle">
                                <img src={exampleImage} alt={`ตัวอย่างสี ${param.name}`} className="w-full h-auto object-contain" />
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="p-4">
                {!isSaved && measurement?.isSystemUnknown && (
                    <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-bg-warning border border-border-warning text-text-warning">
                        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                        <div className="text-xs leading-relaxed font-medium w-full">
                            <p className="font-semibold mb-0.5">พบสารที่ไม่รู้จักในระบบ</p>
                            <p>
                                AI ทำนายว่าภาพนี้คือ {measurement.verifiedParameterName?.toUpperCase()} ซึ่งไม่ได้ถูกตั้งค่าไว้ในฐานข้อมูล การบันทึกภาพนี้จะถูกส่งไปให้ผู้ดูแลระบบตรวจสอบ
                            </p>
                        </div>
                    </div>
                )}

                {verifyError && (
                    <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-bg-danger border border-border-danger text-text-danger">
                        {verifyError.reason === "not_test_tube" ? <Camera size={15} className="shrink-0 mt-0.5" /> : <FlaskConical size={15} className="shrink-0 mt-0.5" />}
                        <div className="text-xs leading-relaxed font-medium">
                            <p className="font-semibold mb-0.5">{verifyError.reason === "not_test_tube" ? "AI ไม่พบหลอดทดลองในภาพ" : "สารไม่ตรงชนิด"}</p>
                            <p>{verifyError.detail}</p>
                        </div>
                    </div>
                )}

                {!isHistoryView && hasConf && !isPendingAdminValue && (
                    <div
                        className={`mb-3 flex items-center gap-1.5 p-2.5 rounded-lg text-xs font-medium ${isLowConf
                            ? "border border-border-danger bg-bg-danger text-text-danger"
                            : "border border-border-safe bg-bg-safe text-text-safe"
                            }`}
                    >
                        {(() => {
                            const confValue = typeof measurement.confidence === "number" ? `${(measurement.confidence * 100).toFixed(0)}%` : "-";

                            return isLowConf ? <span>ค่าความมั่นใจ: {confValue} (ต่ำ)</span> : <span>ค่าความมั่นใจ: {confValue} (ผ่าน)</span>;
                        })()}{" "}
                    </div>
                )}

                {/* Responsive Image Container: ปรับ Aspect Ratio และความสูงให้กะทัดรัดพอดี */}
                <div
                    onClick={() => step === "upload" && galleryInputRef.current?.click()}
                    className={`relative w-full rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all duration-200
                    ${step === "analyzing"
                            ? "aspect-4/3 border-slate-700 bg-slate-950 cursor-default"
                            : displayImgSrc
                                ? "aspect-4/3 border-primary/30 bg-surface-subtle cursor-pointer"
                                : "aspect-4/3 border-border hover:border-primary/50 bg-surface-subtle cursor-pointer"
                        }
${!isHistoryView && isLowConf ? "border-danger hover:border-danger-hover" : ""}`}
                >
                    {uploadProgress !== null ? (
                        <div className="flex flex-col items-center justify-center gap-4 w-full px-6 py-10">
                            <span className="text-xs font-medium text-primary tracking-widest uppercase animate-pulse">กำลังประมวลผล... {uploadProgress}%</span>
                            <div className="w-full max-w-xs h-2.5 bg-surface-muted border border-border/50 rounded-full overflow-hidden shadow-inner">
                                <div
                                    className="h-full bg-secondary transition-all duration-200 ease-out"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    ) : step === "analyzing" ? (
                        <>
                            {preview && <img src={preview} alt={param.name} className="w-full h-full object-contain opacity-30 blur-[0.5px] absolute inset-0" />}
                            <div className="animate-laser" />
                        </>
                    ) : displayImgSrc ? (
                        <>
                            <img src={displayImgSrc} alt={param.name} className="w-full h-full object-contain" />
                            <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                                <button
                                    type="button"
                                    title="ดูภาพขยายความละเอียดสูง"
                                    className="flex items-center gap-1 bg-black/75 hover:bg-black/90 text-white border border-white/20 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md select-none backdrop-blur-xs cursor-pointer min-h-7"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowLightbox(true);
                                    }}
                                >
                                    <Maximize2 size={13} strokeWidth={2.5} />
                                    <span className="hidden sm:inline">ขยายภาพ</span>
                                </button>
                                <button
                                    type="button"
                                    title="ดาวน์โหลดภาพ"
                                    className="flex items-center gap-1 bg-black/75 hover:bg-black/90 text-white border border-white/20 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md select-none backdrop-blur-xs cursor-pointer min-h-7"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                            const url = displayImgSrc as string;
                                            const res = await fetch(url);
                                            const blob = await res.blob();
                                            const blobUrl = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = blobUrl;
                                            a.download = `water-test-${param.name}.jpg`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                                        } catch (err) {
                                            const a = document.createElement("a");
                                            a.href = displayImgSrc as string;
                                            a.download = `water-test-${param.name}.jpg`;
                                            a.target = "_blank";
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                        }
                                    }}
                                >
                                    <Download size={13} strokeWidth={2.5} />
                                    <span className="hidden sm:inline">ดาวน์โหลด</span>
                                </button>
                                {step === "results" && hasPlotImg && (
                                    <button
                                        type="button"
                                        title="สลับมุมมองภาพ"
                                        className="flex items-center gap-1 bg-black/75 hover:bg-black/90 text-white border border-white/20 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md select-none backdrop-blur-xs cursor-pointer min-h-7"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewMode(viewMode === "analyzed" ? "raw" : "analyzed");
                                        }}
                                    >
                                        <Eye size={13} strokeWidth={2.5} />
                                        <span>{viewMode === "analyzed" ? "ดูภาพดิบ" : "ดูภาพ AI"}</span>
                                    </button>
                                )}
                            </div>

                            {/* ป้ายบอกว่าแตะที่ภาพแล้วเลือกรูปใหม่ได้ — ขึ้นเฉพาะขั้นอัปโหลด */}
                            {step === "upload" && (
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/75 text-white border border-white/20 px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-md select-none backdrop-blur-xs pointer-events-none whitespace-nowrap">
                                    <ImagePlus size={13} />
                                    <span>แตะที่ภาพเพื่อเปลี่ยนรูป</span>
                                </div>
                            )}
                        </>
                    ) : isHistoryView ? (
                        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center py-10 text-text-muted">
                            <Camera size={28} className="opacity-40" />
                            <p className="text-xs font-semibold">ไม่พบข้อมูลภาพถ่ายสำหรับรายการนี้</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 px-4 text-center py-4">
                            <div className="w-9 h-9 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary mb-0.5">
                                <Camera size={18} />
                            </div>
                            <p className="text-xs font-semibold text-text">เพิ่มภาพถ่ายผลการตรวจ</p>
                            <p className="text-[11px] text-text-muted max-w-[200px]">ถ่ายภาพหลอดทดลองหรือเลือกภาพ</p>

                            <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-xs pt-1">
                                {/* ปุ่ม 1: ถ่ายรูปสดจากกล้องหลัง */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        cameraInputRef.current?.click();
                                    }}
                                    className="px-3 py-2 min-w-[100px] rounded-xl bg-secondary text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:bg-primary transition-all cursor-pointer"
                                >
                                    <Camera size={14} />
                                    <span>ถ่ายภาพสด</span>
                                </button>

                                {/* ปุ่ม 2: เลือกรูปจากแกลเลอรี */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        galleryInputRef.current?.click();
                                    }}
                                    className="px-3 py-2 min-w-[100px] rounded-xl bg-surface border border-border text-text text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:bg-surface-subtle transition-all cursor-pointer"
                                >
                                    <ImagePlus size={14} />
                                    <span>เลือกรูปภาพ</span>
                                </button>
                            </div>
                        </div>
                    )}
                    {/* สำหรับถ่ายภาพสด: บังคับเลือกเฉพาะรูปภาพ และเปิดกล้องหลังมือถือทันที */}
                    <input
                        title="ถ่ายภาพสด"
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {/* สำหรับเลือกไฟล์: ไม่บังคับประเภทไฟล์ (เปิดได้ทั้งรูปและไฟล์อื่นๆ) */}
                    <input
                        title="เลือกรูปภาพหรือไฟล์"
                        ref={galleryInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            </div>

            {/* ── Scientific Fullscreen Lightbox Modal ── */}
            {showLightbox && displayImgSrc && typeof document !== "undefined" && createPortal(
                <div
                    className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex flex-col p-4 sm:p-6 animate-fade-in"
                    onClick={() => setShowLightbox(false)}
                >
                    {/* Header Bar */}
                    <div
                        className="flex items-center justify-between pb-3 border-b border-white/15 text-white shrink-0"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold tracking-wide">
                                ภาพถ่ายผลทดสอบ: {param.name.toUpperCase()}
                            </span>
                            {measurement && (
                                <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 border border-white/20 font-medium">
                                    {measurement.concentrated !== undefined ? `${measurement.concentrated} mg/L` : "กำลังวิเคราะห์"}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {step === "results" && hasPlotImg && (
                                <button
                                    type="button"
                                    onClick={() => setViewMode(viewMode === "analyzed" ? "raw" : "analyzed")}
                                    className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border border-white/20"
                                >
                                    <Eye size={14} />
                                    <span>{viewMode === "analyzed" ? "สลับดูภาพดิบ" : "สลับดูภาพ AI"}</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowLightbox(false)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                                aria-label="ปิดหน้าต่างขยายภาพ"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Image Viewport (High Res) */}
                    <div
                        className="flex-1 flex items-center justify-center p-2 min-h-0 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={displayImgSrc}
                            alt={param.name}
                            className="max-h-[72vh] max-w-[92vw] object-contain rounded-xl border border-white/10 shadow-2xl"
                        />
                    </div>

                    {/* Scientific Color Scale Reference (เปรียบเทียบเทียบสีมาตรฐานด้านล่างภาพ) */}
                    {colorSwatches && colorSwatches.length > 0 && (
                        <div
                            className="shrink-0 max-w-xl mx-auto w-full bg-slate-900/90 border border-white/15 rounded-xl p-3 shadow-xl text-white"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-2 text-xs font-semibold text-slate-300">
                                <span>แถบเทียบสีมาตรฐาน (Test Kit Standard)</span>
                                <span>หน่วย mg/L</span>
                            </div>
                            <div className="grid grid-cols-6 gap-2">
                                {colorSwatches.map((item, idx) => (
                                    <div key={idx} className="flex flex-col items-center gap-1">
                                        <div
                                            className="w-full h-7 rounded-md border border-white/20 shadow-xs"
                                            style={{ backgroundColor: item.color }}
                                            title={`${item.value} mg/L`}
                                        />
                                        <span className="text-[11px] font-bold">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </section>
    );
}
