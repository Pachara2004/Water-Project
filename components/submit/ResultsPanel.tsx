// components/submit/ResultsPanel.tsx
import { useState } from "react"; 
import { AlertCircle, ChevronDown, ChevronUp, Check, X } from "lucide-react"; 
import { LOCATION_STANDARDS, LOCATION_TYPE_LABELS, getParameterStatus, LocationType } from "@/lib/standards";
import { DbParameter, MeasurementResult } from "./types";
import { ThresholdBar } from "./SharedAtoms";

interface ResultsPanelProps {
    results: Record<number, MeasurementResult>;
    systemParameters: DbParameter[];
    locationType: string;
    overallStatus: "safe" | "warning" | "danger";
    setStep: (step: "upload" | "analyzing" | "results") => void;
}

export function ResultsPanel({ results, systemParameters, locationType, overallStatus, setStep }: ResultsPanelProps) {
    const [openParamId, setOpenParamId] = useState<number | null>(null);

    if (Object.keys(results).length === 0) return null;
    const std = LOCATION_STANDARDS[locationType as keyof typeof LOCATION_STANDARDS] || LOCATION_STANDARDS["COMMUNITY"];

    const toggleDropdown = (paramId: number) => {
        setOpenParamId(openParamId === paramId ? null : paramId);
    };

    return (
        <div className="space-y-4">
            
            {/* ตารางแสดงรายละเอียดแต่ละสารพารามิเตอร์ */}
            <div className="w-full rounded-xl border border-border bg-surface overflow-hidden flex flex-col gap-1 p-10">
                <div className="px-6 py-3 border-b border-border bg-muted/40 flex justify-between items-center text-text-muted text-xs uppercase tracking-wider">
                    <div>Parameter</div>
                    <div>Value</div>
                </div>
                <div className="divide-y divide-border">
                    {systemParameters.map((param) => {
                        const measurement = results[param.id];
                        if (!measurement) return null;

                        const maxKey = `${param.name.toLowerCase()}Max`;
                        const max = (std as any)[maxKey] ?? 1.0;
                        const isExceeded = measurement.concentrated > max;
                        const exceededPercentage = isExceeded ? Math.round(((measurement.concentrated - max) / max) * 100) : 0;
                        const isLowConfidence = measurement.confidence !== undefined && measurement.confidence < 0.6;
                        
                        const isDropdownOpen = openParamId === param.id;

                        return (
                            <div key={param.id} className="px-6 py-4 flex flex-col gap-2 hover:bg-muted/5 transition-colors">
                                <div className="flex justify-between items-baseline">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-base uppercase font-medium text-text-primary">{param.name}</span>
                                        {measurement.confidence !== undefined && (
                                            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                                                Confidence: {measurement.confidence}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm font-semibold text-text-primary text-right">
                                        {measurement.concentrated.toFixed(3)} <span className="text-[10px] text-text-muted font-normal ml-0.5">{param.unit ?? "mg/L"}</span>
                                    </div>
                                </div>
                                <ThresholdBar value={measurement.concentrated} max={max} status={measurement.status} />
                                
                                {/* ตัว Dropdown หลักแสดงผลเกณฑ์ของโซนปัจจุบัน */}
                                <div className="w-full mt-1">
                                    <button
                                        type="button"
                                        onClick={() => toggleDropdown(param.id)}
                                        className={`w-full text-xs font-medium px-3 py-2 rounded-lg border transition-all flex items-center justify-between cursor-pointer
                                            ${isExceeded 
                                                ? "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200/50 hover:bg-red-100/50" 
                                                : "text-teal-600 bg-teal-50 dark:bg-teal-950/30 border-teal-200/50 hover:bg-teal-100/50"
                                            }`}
                                    >
                                        <span className="flex-1 text-center pl-4">
                                            {isExceeded ? `เกินเกณฑ์มาตรฐาน` : "ปกติ"}
                                        </span>
                                        {isDropdownOpen ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
                                    </button>

                                    {/* เมื่อกดกาง Dropdown ออกมา แผ่เต็มกริบ ไม่มีจำกัดความสูงและไม่มี scrollbar */}
                                    {isDropdownOpen && (
                                        <div className="mt-1.5 p-3 rounded-xl bg-surface-subtle border border-border/70 space-y-2 animate-fadeIn">
                                            <p className="font-mono text-xs uppercase tracking-widest text-text-muted border-b border-border/60 pb-1">
                                                เปรียบเทียบเกณฑ์มาตรฐานสิ่งแวดล้อมทางน้ำ
                                            </p>
                                            <div className="space-y-2 h-auto w-full"> 
                                                {Object.entries(LOCATION_STANDARDS).map(([key, value]) => {
                                                    const locKey = key as LocationType;
                                                    const currentParamMax = (value as any)[maxKey] ?? 1.0;
                                                    const currentParamStatus = getParameterStatus(measurement.concentrated, currentParamMax);
                                                    const subParamExceeded = currentParamStatus === "danger";

                                                    return (
                                                        <div key={locKey} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0 pb-1 last:pb-0">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-black text-xs">{LOCATION_TYPE_LABELS[locKey]}</span>
                                                                <span className="text-xs text-secondary ">
                                                                    เกณฑ์สูงสุด: {currentParamMax} {param.unit}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1 shrink-0 ml-2">
                                                                {subParamExceeded ? (
                                                                    <span className="inline-flex items-center gap-0.5 font-medium px-5 py-0.5 text-red-600 bg-red-50 text-xs">
                                                                        เกินเกณฑ์
                                                                    </span>
                                                                ) : currentParamStatus === "warning" ? (
                                                                    <span className="inline-flex items-center gap-0.5 font-medium px-5 py-0.5 text-amber-600 bg-amber-50 text-xs">
                                                                        เฝ้าระวัง
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-0.5 font-medium px-5 py-0.5 text-teal-600 bg-teal-50 text-xs">
                                                                        ผ่าน
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {isLowConfidence && (
                                    <div className="mt-2 flex flex-col gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700 leading-relaxed font-medium">
                                        <div className="flex items-start gap-1.5">
                                            <span>ค่า confidence ต่ำกว่า 0.60 ระบบไม่แนะนำให้ใช้ข้อมูลชุดนี้ กรุณากดกลับไปถ่ายรูปภาพของสาร {param.name.toUpperCase()} ส่งใหม่อีกครั้ง</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}