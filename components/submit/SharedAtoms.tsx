/**
 * @file SharedAtoms.tsx
 * @project Water Monitoring Project
 * @module UI / Submit / Atoms
 * @description
 * ชิ้นส่วน UI เล็กๆ ที่คอมโพเนนต์ในโฟลเดอร์ submit ใช้ร่วมกัน: หัวข้อ section พร้อมไอคอน,
 * จุดบอกขั้นตอน และแถบระดับค่าเทียบเกณฑ์สูงสุด สีแถบใช้ token --color-safe/warning/danger
 * ชุดเดียวกับ StatusBadge เพื่อให้แถบกับป้ายบอกสถานะเดียวกันด้วยเฉดเดียวกันและปรับตามธีมมืดได้
 *
 * Small shared atoms for the submit flow: section header, step dot and threshold bar.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-07
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-17, 2026-09-03)
 *
 * @lastModified 2026-09-03 10:48
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-07-07 15:30 by Pachara P. - แยก atom ออกมาตอนปรับโครงสร้างไฟล์ submit
 * - 2026-07-17 15:08 by Nopparut U. - ถอด helper สีตามหน่วยงานที่ไม่ใช้
 * - 2026-09-03 10:48 by Nopparut U. - เปลี่ยนสีแถบจาก hex ฝังในโค้ดเป็น design token
 *
 * @client-side ไม่มี hook/state ใช้ได้ทั้ง Server และ Client Component
 * @license Private / Proprietary
 */

import { CheckCircle2 } from "lucide-react";

/**
 * หัวข้อ section มีไอคอนซ้ายและข้อความตัวพิมพ์ใหญ่
 *
 * @param icon - ไอคอน (React node)
 * @param label - ข้อความหัวข้อ
 */
export function SectionHead({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="flex items-center gap-3 p-3 border-b border-border">
            <span className="text-text">{icon}</span>
            <span className="text-xs uppercase text-text">{label}</span>
        </div>
    );
}

/**
 * จุดวงกลมบอกสถานะขั้นตอน: done = ติ๊กถูก, active = เลขในกรอบสี, idle = เลขสีจาง
 *
 * @param n - หมายเลขขั้นตอน
 * @param state - สถานะของขั้นตอน
 */
export function StepDot({ n, state }: { n: number; state: "done" | "active" | "idle" }) {
    const base = "w-5 h-5 rounded-full text-xs font-mono font-medium flex items-center justify-center flex-shrink-0";
    if (state === "done")
        return (
            <div className={`${base} bg-secondary text-white`}>
                <CheckCircle2 size={11} />
            </div>
        );
    if (state === "active") return <div className={`${base} border border-primary text-primary bg-primary/10`}>{n}</div>;
    return <div className={`${base} border border-border text-text-muted bg-surface-subtle`}>{n}</div>;
}

// ใช้ token สีของระบบ (--color-safe/warning/danger ใน globals.css) แทน hex ฝังในโค้ด
// เดิมฝัง #1D9E75/#EF9F27/#E24B4A ไว้ตรงนี้ซึ่งเป็นคนละสีกับที่ StatusBadge ใช้ — แถบกับป้าย
// บอกสถานะเดียวกันแต่คนละเฉดสี และธีมมืดปรับตามไม่ได้
const FILL_CLASS: Record<"safe" | "warning" | "danger", string> = {
    safe: "bg-safe",
    warning: "bg-warning",
    danger: "bg-danger",
};

/**
 * แถบแสดงค่าที่วัดได้เทียบกับค่าสูงสุดของสเกล สีตามสถานะ
 *
 * @param value - ค่าที่วัดได้
 * @param max - ค่าสูงสุดของสเกล (เต็มแถบ)
 * @param status - สถานะที่กำหนดสีแถบ
 */
export function ThresholdBar({ value, max, status }: { value: number; max: number; status: "safe" | "warning" | "danger" }) {
    const pct = Math.min((value / max) * 100, 100);
    return (
        <div className="mt-2">
            <div className="h-1 w-full rounded-xs bg-border/40">
                <div style={{ width: `${pct}%` }} className={`h-full rounded-sm transition-all duration-500 ease-out ${FILL_CLASS[status]}`} />
            </div>
            <div className="flex justify-between mt-1">
                <span className="text-xs text-text-muted">0</span>
                <span className="text-xs text-text-muted">max {max}</span>
            </div>
        </div>
    );
}
