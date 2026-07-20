// components/submit/ResultsPanel.tsx
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { evaluateValueAgainstStandards, groupStandardsByParameter } from "@/lib/standards";
import { useLocationTypes } from "@/lib/hooks/useLocationTypes";
import { StandardsComparison, type ComparisonRow } from "../StandardsComparison";
import { DbParameter, MeasurementResult } from "./types";
import { ThresholdBar } from "./SharedAtoms";

interface ResultsPanelProps {
    results: Record<number, MeasurementResult>;
    systemParameters: DbParameter[];
    overallStatus: "safe" | "warning" | "danger";
    setStep: (step: "upload" | "analyzing" | "results") => void;
}

export function ResultsPanel({ results, systemParameters, overallStatus, setStep }: ResultsPanelProps) {
    const [openParamId, setOpenParamId] = useState<number | null>(null);
    const { locationTypes } = useLocationTypes();

    if (Object.keys(results).length === 0) return null;

    const toggleDropdown = (paramId: number) => {
        setOpenParamId(openParamId === paramId ? null : paramId);
    };

    /** เกณฑ์ที่เข้มที่สุดของสารตัวนี้ — ตัวที่ตัดสินสถานะจริง ใช้เป็นสเกลของแถบวัด */
    const strictestMaxFor = (parameterId: number): number | null => {
        const maxes = locationTypes.flatMap((t) => t.standards.filter((s) => s.parameterId === parameterId).map((s) => s.maxValue));
        return maxes.length > 0 ? Math.min(...maxes) : null;
    };

    return (
        <div className="space-y-4">
            
            {/* ตารางแสดงรายละเอียดแต่ละสารพารามิเตอร์ */}
            <div className="w-full rounded-xl border border-border bg-surface overflow-hidden flex flex-col gap-1 p-1                                                                                                                                                           ">
                <div className="px-6 py-3 border-b border-border bg-muted/40 flex justify-between items-center text-text-muted text-xs uppercase tracking-wider">
                    <div>Parameter</div>
                    <div>Value</div>
                </div>
                <div className="divide-y divide-border">
                    {Object.entries(results).map(([entryKeyStr, measurement]) => {
                        const entryKey = Number(entryKeyStr);
                        // หา param จาก measurement.parameterId (สารจริง) ไม่ใช่ entryKey — กรณีสารซ้ำ entryKey เป็น virtual key ที่ไม่ตรงกับ id จริง
                        const param = systemParameters.find((p) => p.id === measurement.parameterId);
                        if (!param) return null;

                        // เกณฑ์มาจาก DB ผูกด้วย parameterId — เดิมเดาจากชื่อสาร (`${name}Max`) แล้ว fallback 1.0
                        // ซึ่งกุเกณฑ์ปลอมขึ้นมาให้สารที่ไม่มีเกณฑ์จริง แล้วแสดงผลราวกับเป็นเกณฑ์จริง
                        const strictestMax = strictestMaxFor(measurement.parameterId);
                        const paramStatus = strictestMax !== null ? evaluateValueAgainstStandards(measurement.concentrated, [strictestMax]) : null;
                        const isExceeded = paramStatus === "danger";

                        const isDropdownOpen = openParamId === entryKey;

                        return (
                            <div key={entryKey} className="px-6 py-4 flex flex-col gap-2 hover:bg-muted/5 transition-colors">
                                <div className="flex justify-between items-baseline">
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-base uppercase font-medium text-text-primary">{param.name}</span>
                                            {measurement.isDuplicateSubstance && (
                                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 px-1.5 py-0.5 rounded">
                                                    สารซ้ำ
                                                </span>
                                            )}
                                        </div>
                                        {measurement.confidence !== undefined && (
                                            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                                                Confidence: {measurement.confidence}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xl font-semibold text-black text-right">
                                        {measurement.concentrated.toFixed(3)} <span className="text-xs text-text-muted ml-0.5">{param.unit ?? "mg/L"}</span>
                                    </div>
                                </div>
                                {/* สารที่ไม่มีเกณฑ์กำหนด: ไม่มีสเกลให้วาดแถบ — ซ่อนดีกว่าวาดด้วยเกณฑ์ที่กุขึ้นมา */}
                                {strictestMax !== null && paramStatus !== null && <ThresholdBar value={measurement.concentrated} max={strictestMax} status={paramStatus} />}

                                <div className="w-full mt-1">
                                    <button
                                        type="button"
                                        onClick={() => toggleDropdown(entryKey)}
                                        disabled={paramStatus === null}
                                        className={`w-full text-xs font-medium px-3 py-2 rounded-lg border transition-all flex items-center justify-between
                                            ${
                                                paramStatus === null
                                                    ? "text-text-muted bg-surface-subtle border-border cursor-default"
                                                    : isExceeded
                                                      ? "text-red-600 bg-red-500/10 border-red-500/20 hover:bg-red-500/15 cursor-pointer"
                                                      : paramStatus === "warning"
                                                        ? "text-amber-600 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15 cursor-pointer"
                                                        : "text-teal-600 bg-teal-500/10 border-teal-500/20 hover:bg-teal-500/15 cursor-pointer"
                                            }`}
                                    >
                                        <span className="flex-1 text-center pl-4">
                                            {paramStatus === null ? "ไม่มีเกณฑ์กำหนดสำหรับสารนี้" : isExceeded ? "เกินเกณฑ์มาตรฐาน" : paramStatus === "warning" ? "เฝ้าระวัง" : "ปกติ"}
                                        </span>
                                        {paramStatus !== null && (isDropdownOpen ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />)}
                                    </button>

                                    {isDropdownOpen && paramStatus !== null && (
                                        <div className="mt-1.5 p-3 rounded-xl bg-surface-subtle border border-border/70 animate-fadeIn">
                                            <StandardsComparison
                                                compact
                                                title="เปรียบเทียบเกณฑ์มาตรฐานสิ่งแวดล้อมทางน้ำ"
                                                rows={locationTypes.map<ComparisonRow>((type) => {
                                                    const maxes = groupStandardsByParameter(type.standards).get(measurement.parameterId) ?? [];
                                                    const status = evaluateValueAgainstStandards(measurement.concentrated, maxes);
                                                    return {
                                                        key: type.code,
                                                        label: type.labelTh,
                                                        detail: maxes.length > 0 ? `เกณฑ์สูงสุด: ${Math.min(...maxes)} ${param.unit ?? ""}`.trim() : undefined,
                                                        status,
                                                    };
                                                })}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}