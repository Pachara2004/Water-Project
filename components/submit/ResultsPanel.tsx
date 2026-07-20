// components/submit/ResultsPanel.tsx
import { useState } from "react";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
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
    // กรณีสารซ้ำ: parameterId → key ของภาพที่ผู้ส่งเลือกเก็บ (เลือกได้ตัวเดียวต่อสาร)
    // optional เพราะหน้าประวัติ (read-only) ก็ใช้ component นี้ แต่ข้อมูลที่บันทึกแล้วไม่มีสารซ้ำให้เลือก
    duplicateChoice?: Record<number, number>;
    chooseDuplicate?: (parameterId: number, key: number) => void;
}

export function ResultsPanel({ results, systemParameters, duplicateChoice = {}, chooseDuplicate }: ResultsPanelProps) {
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
                    <div>สารที่ตรวจ</div>
                    <div>ค่าที่วัดได้</div>
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

                        // สารซ้ำ: ผู้ส่งเลือกเก็บได้ภาพเดียวต่อสาร — ภาพที่ไม่ถูกเลือกจะหรี่ลงและไม่ถูกบันทึก
                        const isDuplicate = measurement.isDuplicateSubstance === true;
                        const isChosen = isDuplicate && duplicateChoice[measurement.parameterId] === entryKey;

                        return (
                            <div
                                key={entryKey}
                                className={`px-5 py-4 flex flex-col gap-2.5 border-l-[3px] transition-all ${
                                    isDuplicate
                                        ? isChosen
                                            ? "border-l-teal-500 bg-teal-500/[0.05]"
                                            : "border-l-transparent opacity-55 hover:opacity-100"
                                        : "border-l-transparent hover:bg-muted/5"
                                }`}
                            >
                                {/* สารซ้ำ: ตัวเลือก radio เต็มแถว เลือกเก็บได้ภาพเดียวต่อสาร */}
                                {isDuplicate && (
                                    <button
                                        type="button"
                                        onClick={() => chooseDuplicate?.(measurement.parameterId, entryKey)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                                            isChosen
                                                ? "bg-teal-500/10 border-teal-500/40 text-[#009689]"
                                                : "bg-surface-subtle border-border text-text-secondary hover:border-teal-400 hover:text-teal-600"
                                        }`}
                                    >
                                        <span
                                            className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                                isChosen ? "border-teal-600 bg-teal-600" : "border-text-muted"
                                            }`}
                                        >
                                            {isChosen && <Check size={11} strokeWidth={4} className="text-white" />}
                                        </span>
                                        <span className="flex-1 text-left">{isChosen ? "เก็บรูปนี้ไว้" : "แตะเพื่อเลือกรูปนี้"}</span>
                                        {!isChosen && <span className="text-[10px] font-medium text-text-muted normal-case">รูปนี้จะไม่ถูกเก็บ</span>}
                                    </button>
                                )}

                                <div className="flex justify-between items-baseline">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-base uppercase font-medium text-text-primary">{param.name}</span>
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
                                                      ? "text-[#EA2F0B] bg-red-500/10 border-red-500/20 hover:bg-red-500/15 cursor-pointer"
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