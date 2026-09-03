// components/submit/ResultsPanel.tsx
import { useState } from "react";
import { ChevronDown, ChevronUp, Check, ArrowLeft, FlaskConical, Clock } from "lucide-react";
import { evaluateValueAgainstStandards, groupStandardsByParameter } from "@/lib/standards";
import { formatMeasuredValue } from "@/lib/chemLabels";
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
    revertAutoSwitch?: (key: number) => void;
    reviewNote?: string | null;
    saved?: boolean;
}

export function ResultsPanel({ results, systemParameters, duplicateChoice = {}, chooseDuplicate, revertAutoSwitch, reviewNote, saved }: ResultsPanelProps) {
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
            <div className="w-full rounded-xl border border-border bg-surface overflow-hidden flex flex-col gap-1 p-1">
                {reviewNote && (
                    <div className="mx-2 mt-2 bg-bg-danger border border-border-danger rounded-lg p-3">
                        <h3 className="text-[11px] font-semibold text-text-danger mb-1 uppercase tracking-wider">บันทึกจากผู้ตรวจสอบ / เหตุผล</h3>
                        <p className="text-xs text-text-danger whitespace-pre-wrap leading-relaxed">{reviewNote}</p>
                    </div>
                )}
                
                <div className="px-5 py-3 border-b border-border flex justify-between items-center text-text text-xs font-semibold">
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

                        // AI ไม่พบหลอดทดลองในภาพ → ค่าที่อ่านได้เชื่อไม่ได้ ซ่อนค่า/ความมั่นใจ/การเทียบเกณฑ์
                        // จนกว่าผู้ดูแลระบบจะตรวจสอบ (ค่าจริงถูกบันทึกลงฐานข้อมูลไว้แล้ว)
                        const isPendingAdminValue = measurement.isTestTube === false;

                        return (
                            <div
                                key={entryKey}
                                className={`px-5 py-4 flex flex-col gap-2.5 border-l-[3px] transition-all ${
                                    isDuplicate ? (isChosen ? "border-l-primary bg-primary/5" : "border-l-transparent opacity-55 hover:opacity-100") : "border-l-transparent hover:bg-muted/5"
                                }`}
                            >
                                {/* สารซ้ำ: ตัวเลือก radio เต็มแถว เลือกเก็บได้ภาพเดียวต่อสาร */}
                                {isDuplicate && (
                                    <button
                                        type="button"
                                        onClick={() => chooseDuplicate?.(measurement.parameterId, entryKey)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                                            isChosen
                                                ? "bg-primary/10 border-primary/40 text-primary"
                                                : "bg-surface-subtle border-border text-text-secondary hover:border-primary/50 hover:text-primary"
                                        }`}
                                    >
                                        <span
                                            className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                                isChosen ? "border-secondary bg-secondary" : "border-text-muted"
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
                                        {!isPendingAdminValue &&
                                            (measurement.confidence === null || measurement.confidence === undefined ? (
                                                // ไม่มีค่าความมั่นใจจากโมเดล = ค่านี้ผ่านมือผู้ดูแลระบบมาแล้ว ไม่ใช่ผลที่ AI อ่านเอง
                                                // แสดง "-" ไม่ได้ เพราะอ่านเหมือนข้อมูลขาดหาย ทั้งที่ค่าถูกยืนยันโดยคนแล้ว
                                                <span className="inline-flex items-center gap-1 text-xs text-text-warning font-medium">ยืนยันโดยผู้ดูแลระบบ</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 font-mono text-xs text-text-safe font-medium">
                                                    ค่าความมั่นใจ: {`${(measurement.confidence * 100).toFixed(0)}%`}
                                                </span>
                                            ))}
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className="flex flex-col items-end gap-1">
                                            {isPendingAdminValue ? (
                                                <div className="text-sm font-semibold text-text-warning text-right">รอตรวจสอบ</div>
                                            ) : measurement.originalValue !== undefined && measurement.originalValue !== null && measurement.originalValue !== measurement.concentrated ? (
                                                <>
                                                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                                                        <span>ค่าที่ส่ง:</span>
                                                        <span className="line-through decoration-danger">
                                                            {measurement.originalValue.toFixed(2)} mg/L
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[11px]">
                                                        <span className="text-primary font-medium">แก้ไขเป็น:</span>
                                                        <span className="font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                                                            {formatMeasuredValue(measurement.concentrated)} mg/L
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-xl font-semibold text-text text-right">
                                                    {formatMeasuredValue(measurement.concentrated)} <span className="text-xs text-text-muted ml-0.5">{param.unit ?? "mg/L"}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* สารที่ไม่มีเกณฑ์กำหนด: ไม่มีสเกลให้วาดแถบ — ซ่อนดีกว่าวาดด้วยเกณฑ์ที่กุขึ้นมา */}
                                {!isPendingAdminValue && strictestMax !== null && paramStatus !== null && <ThresholdBar value={measurement.concentrated} max={strictestMax} status={paramStatus} />}

                                {/* แบนเนอร์เปลี่ยนชนิดสารอัตโนมัติ */}
                                {!saved && measurement.autoSwitchedFrom && (
                                    <div className="mt-2.5 flex flex-col gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20 text-text-primary">
                                        <div className="flex items-start gap-2">
                                            <FlaskConical size={15} className="shrink-0 mt-0.5" />
                                            <div className="text-xs leading-relaxed font-medium">
                                                <p className="font-semibold mb-0.5">เปลี่ยนชนิดสารให้อัตโนมัติ</p>
                                                <p>
                                                    เดิมเลือก {measurement.autoSwitchedFrom.toUpperCase()} แต่ระบบตรวจพบว่าสารในภาพเป็น {param.name.toUpperCase()} จึงเปลี่ยนให้อัตโนมัติ
                                                </p>
                                            </div>
                                        </div>
                                        {revertAutoSwitch && (
                                            <button
                                                onClick={() => revertAutoSwitch(entryKey)}
                                                className="self-end mt-1 px-3 py-1.5 bg-primary/15 hover:bg-primary/25 text-primary rounded-md text-xs font-semibold transition-colors cursor-pointer"
                                            >
                                                ยืนยันส่งเป็น {measurement.autoSwitchedFrom.toUpperCase()} (สารเดิม)
                                            </button>
                                        )}
                                    </div>
                                )}



                                {isPendingAdminValue ? (
                                    <div className="mt-1.5 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-bg-warning border border-border-warning text-text-warning">
                                        <Clock size={14} className="shrink-0 mt-0.5" />
                                        <p className="text-xs leading-relaxed font-medium">รอการตรวจสอบจากผู้ดูแลระบบ — AI ไม่พบหลอดทดลองในภาพนี้ จึงยังไม่แสดงค่าที่วัดได้</p>
                                    </div>
                                ) : (
                                <div className="w-full mt-1.5">
                                    <button
                                        type="button"
                                        onClick={() => toggleDropdown(entryKey)}
                                        disabled={paramStatus === null}
                                        className={`w-full text-xs font-medium px-3 py-2 rounded-lg border transition-all flex items-center justify-between
                                            ${
                                                paramStatus === null
                                                    ? "text-text-muted bg-surface-subtle border-border cursor-default"
                                                    : isExceeded
                                                      ? "text-text-danger bg-bg-danger border-border-danger hover:bg-danger/15 cursor-pointer"
                                                      : paramStatus === "warning"
                                                        ? "text-text-warning bg-bg-warning border-border-warning hover:bg-warning/15 cursor-pointer"
                                                        : "text-text-safe bg-bg-safe border-border-safe hover:bg-safe/15 cursor-pointer"
                                            }`}
                                    >
                                        <span className="flex-1 text-center pl-4">
                                            {paramStatus === null ? "ไม่มีเกณฑ์กำหนดสำหรับสารนี้" : isExceeded ? "เกินเกณฑ์มาตรฐาน" : paramStatus === "warning" ? "เฝ้าระวัง" : "ปกติ"}
                                        </span>
                                        {paramStatus !== null && (isDropdownOpen ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />)}
                                    </button>

                                    {isDropdownOpen && paramStatus !== null && (
                                        <div className="mt-1.5 p-3  rounded-xl bg-surface-subtle border border-border/70 animate-fadeIn text-sm">
                                            <StandardsComparison
                                                compact
                                                title="เกณฑ์มาตรฐานสิ่งแวดล้อมทางน้ำ"
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
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
