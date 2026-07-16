// components/submit/NavWorkflow.tsx
import { Loader2, Camera, Sparkles, MapPin, Database, CheckCircle2, ToggleLeft } from "lucide-react";
import { SubmitSteps } from "./SubmitSteps";

export function DesktopSidebar({ sessionId, locationName, currentUser, step, systemParameters, results }: any) {
    return (
        <aside className="hidden md:flex flex-col border-r border-border bg-surface min-h-full w-[200px] flex-shrink-0">
            <div className="px-4 py-4 border-b border-border">
                <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted mb-3">Session info</p>
                {[
                    { key: "Session", val: `#${sessionId}` },
                    { key: "Station", val: locationName || "—" },
                    { key: "Collector", val: currentUser?.name || currentUser?.email || "—" },
                    { key: "Date", val: new Date().toLocaleDateString("th-TH") },
                    { key: "Analysis", val: step === "results" ? "Complete" : step === "analyzing" ? "Running…" : "Pending", ok: step === "results" },
                ].map(({ key, val, ok }) => (
                    <div key={key} className="flex justify-between items-center py-1">
                        <span className="font-mono text-[10px] text-text-muted">{key}</span>
                        <span className={`text-[10px] font-medium text-right max-w-[110px] truncate ${ok ? "text-teal-600" : "text-text-primary"}`}>{val}</span>
                    </div>
                ))}
            </div>
            <div className="px-4 py-4 flex-1">
                <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted mb-3">Workflow</p>
                <SubmitSteps step={step} orientation="vertical" />
            </div>
        </aside>
    );
}

export function AnalyzeButton({ activeParameters, imageFiles, currentLocationId, isRecommending, handleAnalyze }: any) {
    const hasEnabledParam = activeParameters.length > 0;
    const isAllImagesUploaded = hasEnabledParam && activeParameters.every((p: any) => imageFiles[p.id] !== undefined);
    return (
        <button
            onClick={handleAnalyze}
            disabled={!isAllImagesUploaded || !currentLocationId || isRecommending}
            className="w-full py-3.5 min-h-[52px] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-teal-700 text-white shadow-sm"
        >
            {isRecommending ? (
                <>
                    <Loader2 size={15} className="animate-spin" /> กำลังตรวจจับตำแหน่ง…
                </>
            ) : !hasEnabledParam ? (
                <>
                    <ToggleLeft size={15} /> เปิดสารที่ต้องการส่งตรวจก่อน
                </>
            ) : !currentLocationId ? (
                <>
                    <MapPin size={15} /> กรุณาเลือกสถานีก่อน
                </>
            ) : !isAllImagesUploaded ? (
                <>
                    <Camera size={15} /> ถ่ายภาพให้ครบทุกสารที่เปิด
                </>
            ) : (
                <>
                    <Sparkles size={15} /> วิเคราะห์ด้วย AI ทั้งหมด
                </>
            )}
        </button>
    );
}
