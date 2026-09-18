/**
 * @file components/manage/standardsHelpers.tsx
 * @project Water Monitoring Project
 * @module Components / Manage / Standards Helpers
 * @description
 * ชนิดข้อมูลและชิ้นส่วน UI ที่หน้าจัดการเกณฑ์มาตรฐานใช้ร่วมกันทั้ง Desktop/Mobile:
 * ตารางแก้ค่าเกณฑ์, ช่องกรอกตัวเลข, รายการเวอร์ชัน และตาราง diff ระหว่างเวอร์ชัน
 *
 * Shared types and UI pieces for the standards admin page (both desktop and mobile views).
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-18
 * @version 1.0.0
 *
 * @client-side ใช้ใน client component เท่านั้น
 * @license Private / Proprietary
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, History, User } from "lucide-react";
import type { StandardSnapshotRow } from "@/lib/standards";
import { chemAbbrev } from "@/lib/chemLabels";

/** ประเภทแหล่งน้ำตามที่ GET /api/standards ส่งมา */
export interface StandardsLocationType {
    id: number;
    code: string;
    labelTh: string;
}

/** สารตามที่ GET /api/standards ส่งมา */
export interface StandardsParameter {
    id: number;
    name: string;
    unit: string | null;
    formula: string | null;
}

/** ค่าเกณฑ์ 1 ช่อง (ประเภท × สาร) */
export interface StandardCell {
    locationTypeId: number;
    parameterId: number;
    maxValue: number;
}

/** เวอร์ชันตามที่ GET /api/standards/versions ส่งมา */
export interface StandardVersionItem {
    id: number;
    version: number;
    note: string | null;
    createdAt: string;
    createdBy: { id: number; name: string } | null;
}

/** key ของช่องในตาราง ใช้ทั้งใน Map ค่าปัจจุบันและค่าที่กำลังแก้ */
export function cellKey(locationTypeId: number, parameterId: number): string {
    return `${locationTypeId}:${parameterId}`;
}

/** วันที่พร้อมเวลาแบบสั้นสำหรับรายการเวอร์ชัน */
export function formatVersionDate(value: string): string {
    return new Date(value).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * ตารางแก้ค่าเกณฑ์ แถว = ประเภทแหล่งน้ำ คอลัมน์ = สาร
 * ช่องที่ค่าต่างจากค่าปัจจุบันจะไฮไลต์
 *
 * @param compact - true = ตัวหนังสือเล็กลงสำหรับจอมือถือ
 */
export function StandardsEditTable({
    locationTypes,
    parameters,
    currentByKey,
    draftByKey,
    onChange,
    disabled,
    compact = false,
}: {
    locationTypes: StandardsLocationType[];
    parameters: StandardsParameter[];
    currentByKey: Map<string, number>;
    draftByKey: Map<string, string>;
    onChange: (key: string, value: string) => void;
    disabled: boolean;
    compact?: boolean;
}) {
    return (
        <div className="overflow-x-auto -mx-1">
            <table className={`w-full border-separate border-spacing-0 ${compact ? "text-xs" : "text-sm"}`}>
                <thead>
                    <tr>
                        <th className="sticky left-0 bg-surface text-left font-semibold text-text-secondary px-2 py-2 border-b border-border">ประเภทแหล่งน้ำ</th>
                        {parameters.map((p) => (
                            <th key={p.id} className="text-center font-semibold text-text-secondary px-2 py-2 border-b border-border whitespace-nowrap">
                                {chemAbbrev(p.name, p.formula)}
                                <span className="block text-xs font-normal text-text-muted">{p.unit || "mg/L"}</span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {locationTypes.map((lt) => (
                        <tr key={lt.id}>
                            <td className="sticky left-0 bg-surface px-2 py-2 border-b border-border/60 font-medium text-text-primary whitespace-nowrap">{lt.labelTh}</td>
                            {parameters.map((p) => {
                                const key = cellKey(lt.id, p.id);
                                const current = currentByKey.get(key);
                                // ช่องที่ไม่มีเกณฑ์ใน DB แก้ไม่ได้ (ขอบเขตหน้านี้แก้ได้เฉพาะคู่ที่มีอยู่)
                                if (current === undefined) {
                                    return (
                                        <td key={p.id} className="px-2 py-2 border-b border-border/60 text-center text-text-muted">
                                            -
                                        </td>
                                    );
                                }
                                const draft = draftByKey.get(key) ?? String(current);
                                const changed = Number(draft) !== current;
                                const invalid = draft.trim() === "" || !Number.isFinite(Number(draft)) || Number(draft) <= 0;
                                return (
                                    <td key={p.id} className="px-2 py-2 border-b border-border/60 text-center">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="any"
                                            min="0"
                                            value={draft}
                                            disabled={disabled}
                                            onChange={(e) => onChange(key, e.target.value)}
                                            className={`w-24 max-w-full text-center rounded-lg border px-2 py-1.5 bg-surface-subtle text-text-primary outline-hidden focus:border-primary transition-colors ${
                                                invalid ? "border-border-danger bg-bg-danger" : changed ? "border-amber-400 bg-amber-50 dark:bg-amber-500/10" : "border-border"
                                            }`}
                                        />
                                        {changed && !invalid && <span className="block text-xs text-text-muted mt-0.5">เดิม {current}</span>}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * รายการเวอร์ชัน กดขยายเพื่อดู diff กับเวอร์ชันก่อนหน้า
 *
 * @param loadSnapshot - ดึง snapshot ของเวอร์ชันตาม id (cache ไว้ที่ผู้เรียก)
 */
export function StandardVersionList({
    versions,
    currentVersionId,
    loadSnapshot,
}: {
    versions: StandardVersionItem[];
    currentVersionId: number | null;
    loadSnapshot: (id: number) => Promise<StandardSnapshotRow[] | null>;
}) {
    if (versions.length === 0) {
        return <p className="text-xs text-text-muted text-center py-6">ยังไม่มีเวอร์ชันเกณฑ์</p>;
    }
    return (
        <div className="space-y-2">
            {versions.map((v, i) => (
                <VersionRow key={v.id} item={v} previous={versions[i + 1] ?? null} isCurrent={v.id === currentVersionId} loadSnapshot={loadSnapshot} />
            ))}
        </div>
    );
}

/** แถวเวอร์ชันเดียว ขยายได้ */
function VersionRow({
    item,
    previous,
    isCurrent,
    loadSnapshot,
}: {
    item: StandardVersionItem;
    previous: StandardVersionItem | null;
    isCurrent: boolean;
    loadSnapshot: (id: number) => Promise<StandardSnapshotRow[] | null>;
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [diff, setDiff] = useState<DiffRow[] | null>(null);

    const toggle = async () => {
        const next = !open;
        setOpen(next);
        if (!next || diff !== null) return;
        setLoading(true);
        try {
            const [cur, prev] = await Promise.all([loadSnapshot(item.id), previous ? loadSnapshot(previous.id) : Promise.resolve([] as StandardSnapshotRow[])]);
            setDiff(buildDiff(prev ?? [], cur ?? []));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-xl border border-border bg-surface-subtle overflow-hidden">
            <button type="button" onClick={toggle} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left cursor-pointer">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text-primary">เวอร์ชัน {item.version}</span>
                        {isCurrent && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">ปัจจุบัน</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                            <History size={11} /> {formatVersionDate(item.createdAt)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <User size={11} /> {item.createdBy?.name ?? "ระบบ"}
                        </span>
                    </div>
                    {item.note && <p className="text-xs text-text-secondary mt-1 wrap-break-word">{item.note}</p>}
                </div>
                {open ? <ChevronUp size={16} className="text-text-muted shrink-0" /> : <ChevronDown size={16} className="text-text-muted shrink-0" />}
            </button>

            {open && (
                <div className="border-t border-border px-3 py-2.5 bg-surface">
                    {loading && <p className="text-xs text-text-muted">กำลังโหลด...</p>}
                    {!loading && diff && <DiffTable rows={diff} hasPrevious={previous !== null} />}
                </div>
            )}
        </div>
    );
}

/** 1 แถวใน diff: ค่าเดิม → ค่าใหม่ของช่องหนึ่ง */
interface DiffRow {
    label: string;
    parameter: string;
    before: number | null;
    after: number | null;
}

/** เทียบ snapshot สองชุด คืนเฉพาะช่องที่ค่าต่างกัน (ถ้าไม่มีเวอร์ชันก่อนหน้า คืนทุกช่อง) */
function buildDiff(prev: StandardSnapshotRow[], cur: StandardSnapshotRow[]): DiffRow[] {
    const prevByKey = new Map(prev.map((r) => [cellKey(r.locationTypeId, r.parameterId), r.maxValue]));
    const rows: DiffRow[] = [];
    for (const r of cur) {
        const before = prevByKey.get(cellKey(r.locationTypeId, r.parameterId)) ?? null;
        if (prev.length > 0 && before === r.maxValue) continue;
        rows.push({ label: r.locationTypeLabelTh, parameter: r.parameterName, before, after: r.maxValue });
    }
    return rows;
}

/** ตารางแสดง diff */
function DiffTable({ rows, hasPrevious }: { rows: DiffRow[]; hasPrevious: boolean }) {
    if (rows.length === 0) return <p className="text-xs text-text-muted">ไม่มีค่าที่เปลี่ยนจากเวอร์ชันก่อนหน้า</p>;
    return (
        <div className="space-y-1.5">
            {!hasPrevious && <p className="text-xs text-text-muted">เวอร์ชันแรก แสดงค่าทั้งหมด</p>}
            {rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-text-secondary truncate">
                        {r.label} · <span className="uppercase font-medium">{r.parameter}</span>
                    </span>
                    <span className="shrink-0 font-medium text-text-primary">
                        {hasPrevious && r.before !== null && <span className="text-text-muted line-through mr-1.5">{r.before}</span>}
                        {r.after}
                    </span>
                </div>
            ))}
        </div>
    );
}
