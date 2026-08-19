// components/submit/ImageZone.tsx
import { useRef, useState } from "react";
import { Camera, ImagePlus, CheckCircle2, AlertTriangle, Eye, FlaskConical, Info, X } from "lucide-react";
import { alertError, errorToast } from "@/lib/swal";
import { DbParameter, MeasurementResult, VerifyError } from "./types";
import { SectionHead } from "./SharedAtoms";

// รูปตัวอย่างสีของเหลวชุดทดสอบต่อสาร
const PARAM_EXAMPLE_IMAGE: Record<string, string> = {
    ammonia: "/testkit-examples/ammonia.jpg",
    phosphate: "/testkit-examples/phosphate.jpg",
};

// โค้ดสีเคมีจริงจากแผ่นเทียบมาตรฐาน Test Kit พร้อมระดับความปลอดภัย
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

interface ImageZoneProps {
    param: DbParameter;
    step: "upload" | "analyzing" | "results";
    preview?: string;
    plotFile?: File | string;
    measurement?: MeasurementResult;
    verifyError?: VerifyError;
    onImageFilesChange: (file: File) => void;
    onNearestLocationsUpdate: (locations: any[]) => void;
    allLocations: any[];
    setIsRecommending: (b: boolean) => void;
    enabled?: boolean;
    onToggle?: () => void;
    isHistoryView?: boolean;
}

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
    isHistoryView = false,
}: ImageZoneProps) {
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [viewMode, setViewMode] = useState<"raw" | "analyzed">("analyzed");
    const [showExampleModal, setShowExampleModal] = useState(false);

    const paramKey = matchParamKey(param.name, PARAM_EXAMPLE_IMAGE);
    const exampleImage = paramKey ? PARAM_EXAMPLE_IMAGE[paramKey] : null;
    const colorSwatches = paramKey ? PARAM_COLOR_SWATCHES[paramKey] : null;

    const hasConf = measurement?.confidence !== undefined;
    const isLowConf = hasConf && measurement.confidence < 0.6;
    const confDisplay = hasConf ? `${measurement.confidence}` : "N/A";

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

    // components/submit/ImageZone.tsx

    const getDisplayedImage = () => {
        // 1. ผลวิเคราะห์สด (มี plotFile)
        if (step === "results" && viewMode === "analyzed" && hasPlotImg) {
            return plotFile instanceof Blob ? URL.createObjectURL(plotFile) : plotFile;
        }
        // 2. ดึงทุก Field ที่เป็นไปได้จาก DB/State
        return (
            preview ||
            measurement?.imageUrl ||
            measurement?.originalImageUrl ||
            measurement?.imagePath ||
            measurement?.plotUrl ||
            measurement?.image ||
            measurement?.photoUrl ||
            (measurement as any)?.url
        );
    };

    const displayImgSrc = getDisplayedImage();

    return (
        <section
            id={`param-zone-${param.id}`}
            className={`rounded-xl overflow-visible border transition-all duration-300 bg-surface relative ${verifyError ? "border-red-400 ring-1 ring-red-300" : "border-border"}`}
        >
            <div className="text-sm font-semibold relative">
                <SectionHead icon={<Camera size={16} />} label={`ภาพถ่ายผลทดสอบ: ${param.name.toUpperCase()}`} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2.5 z-10">
                    {exampleImage && (
                        <button
                            type="button"
                            onClick={() => setShowExampleModal((v) => !v)}
                            aria-label={`ดูตัวอย่างสี ${param.name}`}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-text-muted hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors cursor-pointer"
                        >
                            <Info size={15} />
                        </button>
                    )}
                    {step === "upload" && onToggle && (
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={enabled} onChange={onToggle} aria-label={`เปิด/ปิดสาร ${param.name}`} className="sr-only peer" />
                            <div className="relative w-9 h-5 bg-surface-subtle peer-focus:outline-hidden peer-focus:ring-1 peer-focus:ring-primary/10 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:start-[2px] after:bg-surface after:border-border after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-secondary" />
                        </label>
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
                                            <span className="text-[11px] font-semibold text-text">{item.value}</span>
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

            {enabled && (
                <div className="p-4">
                    {measurement?.autoSwitchedFrom && (
                        <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-border text-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900">
                            <FlaskConical size={15} className="shrink-0 mt-0.5" />
                            <div className="text-xs leading-relaxed font-medium">
                                <p className="font-semibold mb-0.5">เปลี่ยนชนิดสารให้อัตโนมัติ</p>
                                <p>
                                    เดิมเลือก {measurement.autoSwitchedFrom.toUpperCase()} แต่ระบบตรวจพบว่าสารในภาพเป็น {param.name.toUpperCase()} จึงเปลี่ยนให้อัตโนมัติ
                                </p>
                            </div>
                        </div>
                    )}

                    {verifyError && (
                        <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900">
                            {verifyError.reason === "not_test_tube" ? <Camera size={15} className="shrink-0 mt-0.5" /> : <FlaskConical size={15} className="shrink-0 mt-0.5" />}
                            <div className="text-xs leading-relaxed font-medium">
                                <p className="font-semibold mb-0.5">{verifyError.reason === "not_test_tube" ? "ต้องถ่ายภาพใหม่" : "สารไม่ตรงชนิด"}</p>
                                <p>{verifyError.detail}</p>
                            </div>
                        </div>
                    )}

                    {!isHistoryView && hasConf && (
                        <div
                            className={`mb-3 flex items-center gap-1.5 p-2.5 rounded-lg text-xs font-medium ${
                                isLowConf
                                    ? "border border-border bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200"
                                    : "border border-border bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200"
                            }`}
                        >
                            {(() => {
                                const confValue = typeof measurement.confidence === "number" ? `${(measurement.confidence * 100).toFixed(0)}%` : "-";

                                return isLowConf ? <span>ค่าความมั่นใจ: {confValue} (ต่ำ)</span> : <span>ค่าความมั่นใจ: {confValue} (ผ่าน)</span>;
                            })()}{" "}
                        </div>
                    )}

                    {/* Responsive Image Container: ปรับ Aspect Ratio ตาม Device */}
                    <div
                        onClick={() => step === "upload" && galleryInputRef.current?.click()}
                        className={`relative w-full rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all duration-200
                        ${
                            step === "analyzing"
                                ? "aspect-square sm:aspect-4/3 md:aspect-video border-slate-700 bg-slate-950 cursor-default"
                                : displayImgSrc
                                  ? "aspect-square sm:aspect-4/3 md:aspect-video border-teal-500/30 bg-surface-subtle cursor-pointer"
                                  : "aspect-square sm:aspect-4/3 border-border hover:border-teal-500/50 bg-surface-subtle cursor-pointer"
                        }
${!isHistoryView && isLowConf ? "border-red-400 hover:border-red-500" : ""}`}
                    >
                        {step === "analyzing" ? (
                            <>
                                {preview && <img src={preview} alt={param.name} className="w-full h-full object-contain opacity-30 blur-[0.5px] absolute inset-0" />}
                                <div className="animate-laser" />
                            </>
                        ) : displayImgSrc ? (
                            <>
                                <img src={displayImgSrc} alt={param.name} className="w-full h-full object-contain" />
                                {step === "results" && hasPlotImg && (
                                    <button
                                        type="button"
                                        className="absolute top-3 right-3 flex items-center gap-1 bg-black/75 hover:bg-black/90 text-white border border-white/20 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md select-none backdrop-blur-xs cursor-pointer min-h-7"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewMode(viewMode === "analyzed" ? "raw" : "analyzed");
                                        }}
                                    >
                                        <Eye size={13} strokeWidth={2.5} />
                                        <span>{viewMode === "analyzed" ? "ดูภาพดิบ" : "ดูภาพ AI"}</span>
                                    </button>
                                )}
                            </>
                        ) : isHistoryView ? (
                            <div className="flex flex-col items-center justify-center gap-2 px-4 text-center py-10 text-text-muted">
                                <Camera size={28} className="opacity-40" />
                                <p className="text-xs font-semibold">ไม่พบข้อมูลภาพถ่ายสำหรับรายการนี้</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3 px-4 text-center py-6 sm:py-8">
                                <p className="text-xs font-semibold text-text">เพิ่มภาพถ่ายผลการตรวจ</p>

                                <div className="flex flex-wrap items-center justify-center gap-2.5 w-full max-w-xs pt-1">
                                    {/* ปุ่ม 1: ถ่ายรูปสดจากกล้องหลัง */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            cameraInputRef.current?.click();
                                        }}
                                        className="px-4 py-2.5 min-w-[120px] rounded-xl bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:bg-primary/90 transition-all cursor-pointer"
                                    >
                                        <Camera size={15} />
                                        <span>ถ่ายภาพสด</span>
                                    </button>

                                    {/* ปุ่ม 2: เลือกรูปจากแกลเลอรี */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            galleryInputRef.current?.click();
                                        }}
                                        className="px-4 py-2.5 min-w-[120px] rounded-xl bg-surface border border-border text-text text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:bg-surface-subtle transition-all cursor-pointer"
                                    >
                                        <ImagePlus size={15} />
                                        <span>เลือกรูปภาพ</span>
                                    </button>
                                </div>
                            </div>
                        )}
                        <input title="เลือกรูปภาพ" ref={galleryInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                        <input title="ถ่ายรูปสด" ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
                    </div>
                </div>
            )}
        </section>
    );
}
