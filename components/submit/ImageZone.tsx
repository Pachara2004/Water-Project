// components/submit/ImageZone.tsx
import { useRef } from "react";
import { Camera, ImagePlus, CheckCircle2, AlertTriangle } from "lucide-react"; // 🌟 Import ไอคอนแจ้งเตือนเพิ่มเข้ามาให้ครบ
import { alertError, errorToast } from "@/lib/swal";
import { DbParameter, MeasurementResult } from "./types";
import { SectionHead } from "./SharedAtoms";

interface ImageZoneProps {
    param: DbParameter;
    step: "upload" | "analyzing" | "results";
    preview?: string;
    plotFile?: File;
    measurement?: MeasurementResult;
    onImageFilesChange: (file: File) => void;
    onNearestLocationsUpdate: (locations: any[]) => void;
    allLocations: any[];
    setIsRecommending: (b: boolean) => void;
}

// 🌟 1. ดึง measurement ออกมาจากพารามิเตอร์ Props ตรงนี้แล้ว
export function ImageZone({ param, step, preview, plotFile, measurement, onImageFilesChange, onNearestLocationsUpdate, allLocations, setIsRecommending }: ImageZoneProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 🌟 2. ประกาศและคำนวณสเตตัสความเชื่อมั่นของสารตัวนี้ (ดักจับทั้งกรณีเลข 0.6 และ 60)
    const hasConf = measurement?.confidence !== undefined;
    const isLowConf = hasConf && measurement.confidence < 0.6;
    const confDisplay = hasConf ?  `${measurement.confidence}` : "N/A";

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

    return (
        /* 🌟 3. เพิ่ม Dynamic Class บนกรอบ Section: ถ้าไม่ผ่านเปลี่ยนเป็นขอบแดง-พื้นแดงจาง ถ้าผ่านเปลี่ยนเป็นขอบเขียว-พื้นเขียวจาง */
        <section className={`rounded-xl overflow-hidden border border-border transition-all duration-300 bg-surface`}>
            <div className="text-sm font-semibold ">
                <SectionHead icon={<Camera size={16} />} label={`ภาพถ่ายผลทดสอบ: ${param.name.toUpperCase()}`} />
            </div>
            <div className="p-4">
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
                    ${step === "analyzing" ? "aspect-4/3 border-slate-700 bg-slate-950 cursor-default" : preview ? "aspect-4/3 border-teal-500/30 bg-surface-subtle cursor-pointer" : "aspect-square border-border hover:border-teal-500/50 bg-surface-subtle cursor-pointer"}
                    ${isLowConf ? "border-red-400 hover:border-red-500" : ""}`}
                >
                    {step === "analyzing" ? (
                        <>
                            {preview && <img src={preview} alt={param.name} className="w-full h-full object-contain opacity-30 blur-[0.5px] absolute inset-0" />}
                            <div className="animate-laser" />
                        </>
                    ) : preview || plotFile ? (
                        <img src={step === "results" && plotFile ? URL.createObjectURL(plotFile) : preview} alt={param.name} className="w-full h-full object-contain" />
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
        </section>
    );
}