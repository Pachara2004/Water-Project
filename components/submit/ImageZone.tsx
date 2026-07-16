// components/submit/ImageZone.tsx
import { useRef, useState } from "react"; // 🌟 เพิ่ม useState เข้ามาจัดการสลับโหมดภาพครับบอส
import { Camera, ImagePlus, CheckCircle2, AlertTriangle, Eye, FlaskConical, Info, X } from "lucide-react"; // 🌟 Import ไอคอน Eye เพิ่มเข้ามาครับบอส
import { alertError, errorToast } from "@/lib/swal";
import { DbParameter, MeasurementResult, VerifyError } from "./types";
import { SectionHead } from "./SharedAtoms";

// รูปตัวอย่างสีของเหลวชุดทดสอบต่อสาร — โชว์ใน popup ตอนกด tooltip ข้างชื่อสาร
const PARAM_EXAMPLE_IMAGE: Record<string, string> = {
    ammonia: "/testkit-examples/ammonia.jpg",
    phosphate: "/testkit-examples/phosphate.jpg",
};

function matchParamKey(name: string, table: Record<string, string>): string | null {
    const n = name.toLowerCase();
    return Object.keys(table).find((key) => n.includes(key)) ?? null;
}

interface ImageZoneProps {
    param: DbParameter;
    step: "upload" | "analyzing" | "results";
    preview?: string;
    plotFile?: File | string; // 🌟 ขยายให้รองรับทั้ง File (บลอบหน้าฟอร์ม) และ string (URL หน้าประวัติ) ครับบอส
    measurement?: MeasurementResult;
    verifyError?: VerifyError; // เหตุผลที่สารตัวนี้ถูกบล็อก (ไม่ใช่หลอดทดลอง / สารผิดชนิด)
    onImageFilesChange: (file: File) => void;
    onNearestLocationsUpdate: (locations: any[]) => void;
    allLocations: any[];
    setIsRecommending: (b: boolean) => void;
    enabled?: boolean; // เปิด/ปิดสารนี้ (toggle ที่หัวการ์ด) — ปิด = ซ่อนพื้นที่อัปรูปทั้งหมด
    onToggle?: () => void; // แสดง toggle เฉพาะตอนส่ง handler นี้มา (step upload เท่านั้น)
}

// 🌟 1. ดึง measurement ออกมาจากพารามิเตอร์ Props ตรงนี้แล้ว
export function ImageZone({ param, step, preview, plotFile, measurement, verifyError, onImageFilesChange, onNearestLocationsUpdate, allLocations, setIsRecommending, enabled = true, onToggle }: ImageZoneProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const infoButtonRef = useRef<HTMLButtonElement>(null);

    // 🌟 2. เพิ่ม State สำหรับสลับโหมดดูภาพดิบ (raw) หรือ ภาพพล็อต AI (analyzed)
    const [viewMode, setViewMode] = useState<"raw" | "analyzed">("analyzed");
    // เปิด/ปิด popup ตัวอย่างรูปสีของเหลวชุดทดสอบ (กดปุ่ม info ข้างชื่อสาร)
    const [showExampleModal, setShowExampleModal] = useState(false);
    // ตำแหน่ง popover คำนวณจากปุ่มจริง (fixed positioning) — กัน overflow-hidden ของ section ตัดภาพตอนปิด toggle
    // แล้วพื้นที่อัปรูปถูกซ่อน ทำให้ section เตี้ยลงจน popover แบบ absolute เดิมโดนตัดมองไม่เห็น
    const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null);

    const toggleExampleModal = () => {
        if (!showExampleModal && infoButtonRef.current) {
            const rect = infoButtonRef.current.getBoundingClientRect();
            setPopoverPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
        }
        setShowExampleModal((v) => !v);
    };

    const paramKey = matchParamKey(param.name, PARAM_EXAMPLE_IMAGE);
    const exampleImage = paramKey ? PARAM_EXAMPLE_IMAGE[paramKey] : null;

    // 🌟 3. ประกาศและคำนวณสเตตัสความเชื่อมั่นของสารตัวนี้ (ดักจับทั้งกรณีเลข 0.6 และ 60)
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

    // 🌟 4. ลอจิกการคำนวณสลับ Path สื่อรูปภาพที่จะแสดงผลบนหน้าจอตาม viewMode
    const hasPlotImg = !!plotFile;

    const getDisplayedImage = () => {
        // ถ้าอยู่ในขั้นตอนแสดงผลลัพธ์ (results) และผู้ใช้เลือกดูโหมดพล็อต AI และมีรูปพล็อตอยู่จริง
        if (step === "results" && viewMode === "analyzed" && hasPlotImg) {
            return plotFile instanceof Blob ? URL.createObjectURL(plotFile) : plotFile;
        }
        // กรณีอื่น ๆ ให้แสดงผลภาพดิบตัวหลักตัวเดิมของบอสครับ
        return preview;
    };

    const displayImgSrc = getDisplayedImage();

    return (
        /* 🌟 5. เพิ่ม Dynamic Class บนกรอบ Section: ถ้าไม่ผ่านเปลี่ยนเป็นขอบแดง-พื้นแดงจาง ถ้าผ่านเปลี่ยนเป็นขอบเขียว-พื้นเขียวจาง */
        <section id={`param-zone-${param.id}`} className={`rounded-xl overflow-hidden border transition-all duration-300 bg-surface ${verifyError ? "border-red-400 ring-1 ring-red-300" : "border-border"}`}>
            <div className="text-sm font-semibold relative">
                <SectionHead icon={<Camera size={16} />} label={`ภาพถ่ายผลทดสอบ: ${param.name.toUpperCase()}`} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2.5">
                    {exampleImage && (
                        <button
                            ref={infoButtonRef}
                            type="button"
                            onClick={toggleExampleModal}
                            aria-label={`ดูตัวอย่างสี ${param.name}`}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-text-muted hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors cursor-pointer"
                        >
                            <Info size={15} />
                        </button>
                    )}
                    {/* Toggle เปิด/ปิดสารนี้ — โชว์เฉพาะ step upload (ตอนมี onToggle ส่งมา) */}
                    {step === "upload" && onToggle && (
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={enabled} onChange={onToggle} aria-label={`เปิด/ปิดสาร ${param.name}`} className="sr-only peer" />
                            <div className="relative w-9 h-5 bg-surface-subtle peer-focus:outline-hidden peer-focus:ring-1 peer-focus:ring-primary/10 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:start-[2px] after:bg-surface after:border-border after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-secondary" />
                        </label>
                    )}
                </div>

                {/* Popover ตัวอย่างสีของเหลวชุดทดสอบ — โผล่ใกล้ปุ่ม info โดยตรง ไม่ใช่ bottom-sheet
                    ใช้ fixed + ตำแหน่งที่คำนวณจากปุ่มจริง (popoverPos) แทน absolute เพื่อไม่ให้ overflow-hidden ของ section ตัดทิ้ง
                    (ตอนปิด toggle section จะเตี้ยลงจนพื้นที่ absolute เดิมโดน clip มองไม่เห็น) */}
                {showExampleModal && exampleImage && popoverPos && (
                    <>
                        {/* เลเยอร์โปร่งใสจับคลิกข้างนอกเพื่อปิด ไม่มี backdrop มืด */}
                        <div className="fixed inset-0 z-[1000]" onClick={() => setShowExampleModal(false)} />
                        <div
                            className="fixed z-[1001] w-64 max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-xl shadow-lg p-2.5 animate-fade-in"
                            style={{ top: popoverPos.top, right: popoverPos.right }}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-semibold text-text-primary uppercase tracking-wider">ตัวอย่างสี {param.name.toUpperCase()}</span>
                                <button
                                    onClick={() => setShowExampleModal(false)}
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-subtle transition-colors cursor-pointer shrink-0"
                                >
                                    <X size={11} />
                                </button>
                            </div>
                            <div className="rounded-lg overflow-hidden border border-border bg-surface-subtle">
                                <img src={exampleImage} alt={`ตัวอย่างสี ${param.name}`} className="w-full h-auto object-contain" />
                            </div>
                        </div>
                    </>
                )}
            </div>
            {enabled && (
            <div className="p-4">
                {/* แถบแจ้งเตือนกรณีระบบสลับชนิดสารให้อัตโนมัติ */}
                {measurement?.autoSwitchedFrom && (
                    <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900">
                        <FlaskConical size={15} className="shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-relaxed font-medium">
                            <p className="font-semibold mb-0.5">เปลี่ยนชนิดสารให้อัตโนมัติ</p>
                            <p>
                                เดิมเลือก {measurement.autoSwitchedFrom.toUpperCase()} แต่ระบบตรวจพบว่าสารในภาพเป็น {param.name.toUpperCase()} จึงเปลี่ยนให้อัตโนมัติ
                            </p>
                        </div>
                    </div>
                )}

                {/* แถบแจ้งเตือนกรณีผลถูกบล็อก: ไม่ใช่หลอดทดลอง หรือ สารผิดชนิด */}
                {verifyError && (
                    <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900">
                        {verifyError.reason === "not_test_tube" ? <Camera size={15} className="shrink-0 mt-0.5" /> : <FlaskConical size={15} className="shrink-0 mt-0.5" />}
                        <div className="text-[11px] leading-relaxed font-medium">
                            <p className="font-semibold mb-0.5">{verifyError.reason === "not_test_tube" ? "ต้องถ่ายภาพใหม่" : "สารไม่ตรงชนิด"}</p>
                            <p>{verifyError.detail}</p>
                        </div>
                    </div>
                )}

                {/* แถบระบุสถานะประเมินผลลัพธ์ย้อนหลัง */}
                {hasConf && (
                    <div
                        className={`mb-3 flex items-center gap-1.5 px-2.5 py-1.5 p-1 rounded-lg text-xs font-medium ${isLowConf ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200" : "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200"}`}
                    >
                        {isLowConf ? (
                            <>
                                <span>ถ่ายใหม่ Confidence ต่ำ: {confDisplay}</span>
                            </>
                        ) : (
                            <>
                                <span>ผ่าน Confidence: {confDisplay}</span>
                            </>
                        )}
                    </div>
                )}

                <div
                    onClick={() => step === "upload" && fileInputRef.current?.click()}
                    className={`relative w-full rounded-xl border-3 border-dashed overflow-hidden flex items-center justify-center transition-all duration-200
                    ${step === "analyzing" ? "aspect-4/3 border-slate-700 bg-slate-950 cursor-default" : displayImgSrc ? "aspect-4/3 border-teal-500/30 bg-surface-subtle cursor-pointer" : "aspect-square border-border hover:border-teal-500/50 bg-surface-subtle cursor-pointer"}
                    ${isLowConf ? "border-red-400 hover:border-red-500" : ""}`}
                >
                    {step === "analyzing" ? (
                        <>
                            {preview && <img src={preview} alt={param.name} className="w-full h-full object-contain opacity-30 blur-[0.5px] absolute inset-0" />}
                            <div className="animate-laser" />
                        </>
                    ) : displayImgSrc ? (
                        <>
                            {/* 🌟 6. เปลี่ยนมาเรนเดอร์รูปภาพตัวแปรสลับผลลัพธ์ (displayImgSrc) แทนก้อนเดิมครับบอส */}
                            <img src={displayImgSrc} alt={param.name} className="w-full h-full object-contain" />

                            {/* 🌟 7. ปุ่มสลับดูภาพดิบ/ภาพพล็อต AI บริเวณมุมซ้ายบนของรูปภาพ (แสดงเมื่อแสดงผลลัพธ์และมีภาพพล็อต) */}
                            {step === "results" && hasPlotImg && (
                                <div
                                    className="absolute top-3 right-3 flex items-center gap-1 bg-black/75 hover:bg-black/90 text-white border border-white/20 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md select-none backdrop-blur-xs cursor-pointer min-h-7"
                                    onClick={(e) => {
                                        e.stopPropagation(); // 🚨 บล็อกไม่ให้การคลิกปุ่มสลับรูปภาพ ทะลุไปเปิดฟังก์ชันเปลี่ยนรูปภาพพื้นหลังครับบอส
                                        setViewMode(viewMode === "analyzed" ? "raw" : "analyzed");
                                    }}
                                >
                                    <Eye size={12} strokeWidth={2.5} />
                                    <span>{viewMode === "analyzed" ? "ดูภาพดิบ" : "ดูภาพ AI"}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-3 px-8 text-center py-8">
                            <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center border border-border">
                                <ImagePlus size={24} className="text-slate-700" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-text-primary">แตะเพื่อถ่ายหรือเลือกภาพ ({param.name})</p>
                            </div>
                        </div>
                    )}
                    <input title="input" ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </div>
            </div>
            )}
        </section>
    );
}
