// components/submit/NavWorkflow.tsx
import { Loader2, Camera, Sparkles, MapPin, ToggleLeft } from "lucide-react";
import { SubmitSteps } from "./SubmitSteps";

interface DesktopSidebarProps {
    sessionId?: string | number;
    locationName?: string;
    currentUser?: { name?: string; email?: string };
    step: "upload" | "analyzing" | "results";
}

export function DesktopSidebar({ sessionId, locationName, currentUser, step }: DesktopSidebarProps) {
    return (
        <aside className="hidden md:flex flex-col border-r border-border bg-card-general min-h-full w-52 shrink-0">
            <div className="px-4 py-4 border-b border-border space-y-2">
                <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted font-bold">Session Info</p>
                {[
                    { key: "Session", val: sessionId ? `#${sessionId}` : "—" },
                    { key: "Station", val: locationName || "—" },
                    { key: "Collector", val: currentUser?.name || currentUser?.email || "—" },
                    { key: "Date", val: new Date().toLocaleDateString("th-TH") },
                    {
                        key: "Analysis",
                        val: step === "results" ? "Complete" : step === "analyzing" ? "Running…" : "Pending",
                        ok: step === "results",
                    },
                ].map(({ key, val, ok }) => (
                    <div key={key} className="flex justify-between items-center py-0.5 text-xs">
                        <span className="font-mono text-text-muted">{key}</span>
                        <span className={`font-semibold text-right max-w-[120px] truncate ${ok ? "text-text-safe" : "text-text"}`}>{val}</span>
                    </div>
                ))}
            </div>
            <div className="px-4 py-4 flex-1">
                <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted font-bold mb-3">Workflow</p>
                <SubmitSteps step={step} orientation="vertical" />
            </div>
        </aside>
    );
}

interface AnalyzeButtonProps {
    activeParameters: Array<{ id: string; [key: string]: any }>;
    imageFiles: Record<string, any>;
    currentLocationId: string | null;
    isRecommending?: boolean;
    handleAnalyze: () => void;
}

export function AnalyzeButton({ activeParameters = [], imageFiles = {}, currentLocationId, isRecommending, handleAnalyze }: AnalyzeButtonProps) {
    const hasEnabledParam = activeParameters.length > 0;
    const isAllImagesUploaded = hasEnabledParam && activeParameters.every((p) => imageFiles[p.id] !== undefined);

    return (
        <button
            type="button"
            onClick={handleAnalyze}
            disabled={!isAllImagesUploaded || !currentLocationId || isRecommending}
            className="w-full py-3 px-4 min-h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-primary hover:bg-primary/90 text-white shadow-xs cursor-pointer"
        >
            {isRecommending ? (
                <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>กำลังตรวจจับตำแหน่ง…</span>
                </>
            ) : !hasEnabledParam ? (
                <>
                    <ToggleLeft size={15} />
                    <span>เปิดสารที่ต้องการส่งตรวจก่อน</span>
                </>
            ) : !currentLocationId ? (
                <>
                    <MapPin size={15} />
                    <span>กรุณาเลือกสถานีก่อน</span>
                </>
            ) : !isAllImagesUploaded ? (
                <>
                    <Camera size={15} />
                    <span>ถ่ายภาพให้ครบทุกสารที่เปิด</span>
                </>
            ) : (
                <>
                    <Sparkles size={15} />
                    <span>วิเคราะห์ด้วยข้อมูล</span>
                </>
            )}
        </button>
    );
}
