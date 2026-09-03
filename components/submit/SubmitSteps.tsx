// components/submit/SubmitSteps.tsx
import { Check } from "lucide-react";

interface SubmitStepsProps {
    step: "upload" | "analyzing" | "results";
    orientation?: "horizontal" | "vertical";
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
