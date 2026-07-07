// components/submit/ImageZone.tsx
import { useRef } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { alertError, errorToast } from "@/lib/swal";
import { DbParameter } from "./types";
import { SectionHead } from "./SharedAtoms";

interface ImageZoneProps {
    param: DbParameter;
    step: "upload" | "analyzing" | "results";
    preview?: string;
    plotFile?: File;
    onImageFilesChange: (file: File) => void;
    onNearestLocationsUpdate: (locations: any[]) => void;
    allLocations: any[];
    setIsRecommending: (b: boolean) => void;
}

export function ImageZone({ param, step, preview, plotFile, onImageFilesChange, onNearestLocationsUpdate, allLocations, setIsRecommending }: ImageZoneProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            errorToast("ขนาดไฟล์ใหญ่เกินกำหนด!", "รูปภาพผลน้ำต้องมีขนาดไม่เกิน 10MB กรุณาถ่ายภาพใหม่หรือลดความละเอียดลงครับบอส");
            return;
        }
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            alertError("รูปแบบไฟล์ไม่ถูกต้อง!", "ระบบอนุญาตเฉพาะไฟล์รูปภาพสากล (.jpg, .jpeg, .png, .webp) เท่านั้นครับบอส");
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
        <section className="rounded-xl bg-surface overflow-hidden border border-border">
            <SectionHead icon={<Camera size={13} />} label={`ภาพถ่ายผลทดสอบ: ${param.name.toUpperCase()} (${param.unit ?? "mg/L"})`} />
            <div className="p-4">
                <div
                    onClick={() => step === "upload" && fileInputRef.current?.click()}
                    className={`relative w-full rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all duration-200
                    ${step === "analyzing" ? "aspect-[4/3] border-slate-700 bg-slate-950 cursor-default" : preview ? "aspect-[4/3] border-teal-500/30 bg-surface-subtle cursor-pointer" : "aspect-square border-border hover:border-teal-500/50 bg-surface-subtle cursor-pointer"}`}
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
                                <p className="text-[10px] text-text-muted mt-1">ให้แผ่น ColorChecker ของ {param.name} อยู่ในกรอบและชัดเจน</p>
                            </div>
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </div>
            </div>
        </section>
    );
}
