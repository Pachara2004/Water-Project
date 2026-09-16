/**
 * @file SubmitSteps.tsx
 * @project Water Monitoring Project
 * @module UI / Submit / Steps
 * @description
 * ตัวบอกขั้นตอนการส่งตรวจ 3 ขั้น (อัปโหลด → วิเคราะห์ → บันทึก) แสดงได้ทั้งแนวนอน (มือถือ)
 * และแนวตั้ง (sidebar บน desktop) คำนวณสถานะแต่ละขั้นจาก step ปัจจุบันและ flag บันทึกแล้ว
 *
 * Three-step progress indicator for the submit flow, in horizontal or vertical orientation.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-15
 * @version 1.0.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-07-20, 2026-08-04)
 *
 * @lastModified 2026-09-03 10:48
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-07-15 16:35 by Nopparut U. - สร้างตัวบอกขั้นตอนพร้อม UI หน้า submit
 * - 2026-08-04 12:59 by Pachara P. - ปรับตามการส่งตรวจแบบใหม่
 * - 2026-09-03 10:48 by Nopparut U. - ใช้ design token แทนสีฝังตาย
 *
 * @client-side ไม่มี hook/state ใช้ได้ทั้ง Server และ Client Component
 * @license Private / Proprietary
 */

import { Check } from "lucide-react";

/** Props ของ SubmitSteps */
interface SubmitStepsProps {
    /** ขั้นตอนปัจจุบันของ flow */
    step: "upload" | "analyzing" | "results";
    /** แนวนอน (ค่าเริ่มต้น) หรือแนวตั้ง */
    orientation?: "horizontal" | "vertical";
    /** true = บันทึกแล้ว ทำให้ขั้น "บันทึก" เป็น done */
    isSaved?: boolean;
}

const STEP_LABELS = ["อัปโหลด", "วิเคราะห์", "บันทึก"];

function computeStepStates(step: SubmitStepsProps["step"], isSaved = false): ("done" | "active" | "idle")[] {
    if (step === "results") {
        return ["done", "done", isSaved ? "done" : "active"];
    }
    if (step === "analyzing") return ["done", "active", "idle"];
    return ["active", "idle", "idle"]; // upload
}

// จุดวงกลมสไตล์เดียวกับ reference: active = น้ำเงินทึบ+เลข, done = เขียวทึบ+ติ๊กถูก, idle = ขอบเทาบาง+เลขเทา
function StepCircle({ n, state }: { n: number; state: "done" | "active" | "idle" }) {
    if (state === "done") {
        return (
            <div className="w-8 h-8 rounded-full bg-safe text-white flex items-center justify-center shrink-0 shadow-sm animate-in zoom-in-50 duration-200">
                <Check size={16} strokeWidth={3} />
            </div>
        );
    }
    if (state === "active") {
        return (
            <div className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-sm">
                {n}
            </div>
        );
    }
    return <div className="w-8 h-8 rounded-full bg-surface border-2 border-border text-text-muted flex items-center justify-center shrink-0 text-xs font-bold">{n}</div>;
}

/**
 * ตัวบอกขั้นตอน 3 ขั้น
 *
 * @param props - ดู {@link SubmitStepsProps}
 */
export function SubmitSteps({ step, orientation = "horizontal", isSaved = false }: SubmitStepsProps) {
    const states = computeStepStates(step, isSaved);

    if (orientation === "vertical") {
        return (
            <div className="flex flex-col gap-4">
                {STEP_LABELS.map((label, i) => (
                    <div key={label} className="flex items-center gap-2.5">
                        <StepCircle n={i + 1} state={states[i]} />
                        <span className={`text-xs font-medium ${states[i] === "idle" ? "text-text-muted" : "text-text-primary"}`}>{label}</span>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex items-center px-2">
            {STEP_LABELS.map((label, i) => (
                <div key={label} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <StepCircle n={i + 1} state={states[i]} />
                        <span className={`text-xs font-medium text-center ${states[i] === "idle" ? "text-text-muted" : "text-text-primary"}`}>{label}</span>
                    </div>
                    {i < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-border mx-2 mb-5" />}
                </div>
            ))}
        </div>
    );
}
