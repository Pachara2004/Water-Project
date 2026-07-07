// components/submit/ResultsPanel.tsx
import { AlertCircle } from "lucide-react";
import { LOCATION_STANDARDS } from "@/lib/standards";
import { DbParameter, MeasurementResult } from "./types";
import { ThresholdBar } from "./SharedAtoms";

interface ResultsPanelProps {
    results: Record<number, MeasurementResult>;
    systemParameters: DbParameter[];
    locationType: string;
    overallStatus: "safe" | "warning" | "danger";
}

export function ResultsPanel({ results, systemParameters, locationType, overallStatus }: ResultsPanelProps) {
    if (Object.keys(results).length === 0) return null;
    const std = LOCATION_STANDARDS[locationType as keyof typeof LOCATION_STANDARDS] || LOCATION_STANDARDS["COMMUNITY"];

    return (
        <div className="space-y-4">
            <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-medium ${overallStatus === "safe" ? "bg-teal-50 text-teal-800 border-teal-500/30" : overallStatus === "warning" ? "bg-amber-50 text-amber-800 border-amber-500/30" : "bg-red-50 text-red-800 border-red-500/30"}`}
            >
                <span className={`h-2 w-2 rounded-full shrink-0 ${overallStatus === "safe" ? "bg-teal-500" : overallStatus === "warning" ? "bg-amber-500" : "bg-red-500"}`} />
                <p className="font-semibold">
                    {overallStatus === "safe" ? "คุณภาพน้ำอยู่ในเกณฑ์ปลอดภัย" : overallStatus === "warning" ? "ตรวจพบค่าสูง — ต้องตรวจสอบเพิ่มเติม" : "ค่าเกินมาตรฐานความปลอดภัย"}
                </p>
            </div>

            <div className="w-full rounded-xl border border-border bg-surface overflow-hidden flex flex-col gap-1">
                <div className="px-6 py-3 border-b border-border bg-muted/40 flex justify-between items-center text-text-muted font-mono text-xs uppercase tracking-wider">
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

                        return (
                            <div key={param.id} className="px-6 py-4 flex flex-col gap-2 hover:bg-muted/5 transition-colors">
                                <div className="flex justify-between items-baseline">
                                    <span className="font-mono text-base uppercase font-medium text-text-primary">{param.name}</span>
                                    <div className="font-mono text-sm font-semibold text-text-primary">
                                        {measurement.concentrated.toFixed(3)} <span className="text-[10px] text-text-muted font-normal ml-0.5">{param.unit ?? "mg/L"}</span>
                                    </div>
                                </div>
                                <ThresholdBar value={measurement.concentrated} max={max} status={measurement.status} />
                                <div className="text-center text-xs mt-1">
                                    {isExceeded ? (
                                        <span className="text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded">เกินเกณฑ์มาตรฐาน {exceededPercentage}%</span>
                                    ) : (
                                        <span className="text-teal-600">ปกติ</span>
                                    )}
                                </div>
                                {measurement.message && (
                                    <div className="mt-2 flex items-start gap-1.5 p-2 rounded-lg bg-slate-50 border border-border text-[11px] text-text-secondary leading-relaxed">
                                        <AlertCircle size={12} className="text-teal-600 mt-0.5 shrink-0" />
                                        <span>{measurement.message}</span>
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
