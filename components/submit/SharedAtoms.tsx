// components/submit/SharedAtoms.tsx
import { CheckCircle2 } from "lucide-react";

export function SectionHead({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <span className="text-text-muted">{icon}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">{label}</span>
        </div>
    );
}

export function StepDot({ n, state }: { n: number; state: "done" | "active" | "idle" }) {
    const base = "w-5 h-5 rounded-full text-[10px] font-mono font-medium flex items-center justify-center flex-shrink-0";
    if (state === "done")
        return (
            <div className={`${base} bg-teal-600 text-white`}>
                <CheckCircle2 size={11} />
            </div>
        );
    if (state === "active") return <div className={`${base} border border-teal-600 text-teal-700 dark:text-teal-400 bg-[var(--color-background-info,#eff6ff)]`}>{n}</div>;
    return <div className={`${base} border border-border text-text-muted bg-[var(--color-background-secondary,#f9fafb)]`}>{n}</div>;
}

export function ThresholdBar({ value, max, status }: { value: number; max: number; status: "safe" | "warning" | "danger" }) {
    const pct = Math.min((value / max) * 100, 100);
    const fillColor = status === "safe" ? "#1D9E75" : status === "warning" ? "#EF9F27" : "#E24B4A";
    return (
        <div className="mt-2">
            <div className="h-1 w-full rounded-sm bg-border/40">
                <div style={{ width: `${pct}%`, backgroundColor: fillColor }} className="h-full rounded-sm transition-all duration-500 ease-out" />
            </div>
            <div className="flex justify-between mt-1">
                <span className="font-mono text-[9px] text-text-muted">0</span>
                <span className="font-mono text-[9px] text-text-muted">max {max}</span>
            </div>
        </div>
    );
}
