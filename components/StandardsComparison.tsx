"use client";

import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import type { StatusType } from "@/lib/standards";

/**
 * ตารางเปรียบเทียบผลตรวจกับเกณฑ์แต่ละประเภทการใช้ประโยชน์
 * ─────────────────────────────────────────────────────────
 * ใช้ร่วมกันระหว่างหน้า submit (เทียบทีละสาร) กับ BottomSheet บนแผนที่ (เทียบรวมทั้งสถานี)
 *
 * component นี้ "ไม่คำนวณอะไรเลย" — ผู้เรียกคำนวณ rows มาเอง เพราะสองหน้ามีขอบเขตต่างกัน
 * (หน้า submit เทียบสารตัวเดียว / BottomSheet รวมทุกสาร) สิ่งที่แชร์กันคือ "การแสดงผล"
 * ให้ทั้งสองหน้าพูดเรื่องเดียวกันด้วยคำและสีชุดเดียวกัน — เดิมเขียน JSX แยกกันแล้วเพี้ยน:
 * หน้าหนึ่งโชว์ 3 ระดับ อีกหน้าโชว์ 2 ระดับ ข้อมูลชุดเดียวกันแต่ผู้ใช้เห็นคำตอบขัดกัน
 */

export interface ComparisonRow {
    key: string;
    /** ชื่อประเภทการใช้ประโยชน์ เช่น "เพื่อการอนุรักษ์แหล่งปะการัง" */
    label: string;
    /** บรรทัดรายละเอียดใต้ชื่อ เช่น "เกณฑ์สูงสุด: 0.015 mg/L" */
    detail?: string;
    /** null = ไม่มีเกณฑ์กำหนด ตัดสินไม่ได้ (ต่างจาก safe ที่แปลว่าตัดสินแล้วว่าผ่าน) */
    status: StatusType | null;
}

const STATUS_STYLE: Record<StatusType, { label: string; chip: string; icon: typeof ShieldCheck; iconClass: string }> = {
    safe: {
        label: "ผ่าน",
        chip: "bg-bg-safe text-text-safe border-border-safe dark:text-emerald-300",
        icon: ShieldCheck,
        iconClass: "text-text-safe",
    },
    warning: {
        label: "เฝ้าระวัง",
        chip: "bg-bg-warning text-text-warning border-border-warning dark:text-amber-300",
        icon: ShieldAlert,
        iconClass: "text-text-warning",
    },
    danger: {
        label: "เกินเกณฑ์",
        chip: "bg-bg-danger text-text-danger border-border-danger dark:text-red-300",
        icon: ShieldX,
        iconClass: "text-text-danger",
    },
};

const NO_STANDARD_STYLE = {
    label: "ไม่มีเกณฑ์กำหนด",
    chip: "bg-surface-subtle text-text-muted border-border",
    iconClass: "text-text-muted",
};

export function StandardsComparison({ title, rows, compact = false }: { title: string; rows: ComparisonRow[]; compact?: boolean }) {
    if (rows.length === 0) return null;

    return (
        <div className={compact ? "space-y-2" : "bg-card-general border border-border rounded-2xl p-6"}>
            <h4 className={`text- font-semibold text-primary ${compact ? "border-b border-primary pb-1" : "mb-3 text-center"}`}>{title}</h4>

            <div className={compact ? "space-y-2" : "grid grid-cols-1 gap-3 text-start"}>
                {rows.map((row) => {
                    const style = row.status ? STATUS_STYLE[row.status] : null;
                    const Icon = style?.icon ?? ShieldAlert;

                    return (
                        <div
                            key={row.key}
                            className={
                                compact
                                    ? "flex items-center justify-between gap-2 text-xs py-1 border-b border-border/60 last:border-0 last:pb-0"
                                    : `flex items-center gap-3.5 text-xs font-semibold p-3 rounded-xl border ${style?.chip ?? NO_STANDARD_STYLE.chip}`
                            }
                        >

                            <div className="flex flex-col items-center min-w-0 flex-1">
                                <span className={`truncate w-full ${compact ? "font-medium text-text-primary" : ""}`}>{row.label}</span>
                                {row.detail && <span className="text-xs text-text-secondary">{row.detail}</span>}
                            </div>

                            <span className={`text-xs font-semibold rounded border shrink-0 w-18 p-1 text-center ${style?.chip ?? NO_STANDARD_STYLE.chip}`}>
                                {style?.label ?? NO_STANDARD_STYLE.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
