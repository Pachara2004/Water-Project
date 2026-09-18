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
import { ChevronDown, ChevronUp, History, User, Trash2, Plus, RefreshCw } from "lucide-react";
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
 * @param onDeleteType - มีค่า = แสดงปุ่มลบท้ายแถว
 */
export function StandardsEditTable({
    locationTypes,
    parameters,
    currentByKey,
    draftByKey,
    onChange,
    disabled,
    compact = false,
    onDeleteType,
    deleteDisabled = false,
}: {
    locationTypes: StandardsLocationType[];
    parameters: StandardsParameter[];
    currentByKey: Map<string, number>;
    draftByKey: Map<string, string>;
    onChange: (key: string, value: string) => void;
    disabled: boolean;
    compact?: boolean;
    onDeleteType?: (type: StandardsLocationType) => void;
    deleteDisabled?: boolean;
}) {
    // ลบประเภทสุดท้ายไม่ได้ ตรงกับกติกาฝั่ง API
    const canDelete = Boolean(onDeleteType) && locationTypes.length > 1;
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
                        {onDeleteType && <th className="border-b border-border w-10" />}
                    </tr>
                </thead>
                <tbody>
                    {locationTypes.map((lt) => (
                        <tr key={lt.id}>
                            <td className="sticky left-0 bg-surface px-2 py-2 border-b border-border/60 font-medium text-text-primary whitespace-nowrap">{lt.labelTh}</td>
                            {parameters.map((p) => {
                                const key = cellKey(lt.id, p.id);
                                // undefined = คู่นี้ยังไม่มีเกณฑ์ใน DB (เช่นสารที่เพิ่งเพิ่ม) กรอกค่าเพื่อสร้างใหม่ได้ ปล่อยว่างได้
                                const current = currentByKey.get(key);
                                const isNew = current === undefined;
                                const draft = draftByKey.get(key) ?? (isNew ? "" : String(current));
                                const untouched = isNew && draft.trim() === "";
                                const changed = !untouched && Number(draft) !== current;
                                const invalid = !untouched && (draft.trim() === "" || !Number.isFinite(Number(draft)) || Number(draft) <= 0);
                                return (
                                    <td key={p.id} className="px-2 py-2 border-b border-border/60 text-center">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            step="any"
                                            min="0"
                                            value={draft}
                                            disabled={disabled}
                                            placeholder={isNew ? "ยังไม่กำหนด" : undefined}
                                            onChange={(e) => onChange(key, e.target.value)}
                                            className={`w-24 max-w-full text-center rounded-lg border px-2 py-1.5 bg-surface-subtle text-text-primary outline-hidden focus:border-primary transition-colors ${
                                                invalid ? "border-border-danger bg-bg-danger" : changed ? "border-amber-400 bg-amber-50 dark:bg-amber-500/10" : "border-border"
                                            }`}
                                        />
                                        {changed && !invalid && <span className="block text-xs text-text-muted mt-0.5">{isNew ? "ใหม่" : `เดิม ${current}`}</span>}
                                    </td>
                                );
                            })}
                            {onDeleteType && (
                                <td className="px-1 py-2 border-b border-border/60 text-center">
                                    <button
                                        type="button"
                                        onClick={() => onDeleteType(lt)}
                                        disabled={deleteDisabled || !canDelete}
                                        title={canDelete ? `ลบประเภท ${lt.labelTh}` : "ต้องมีประเภทอย่างน้อย 1 ประเภท"}
                                        aria-label={`ลบประเภท ${lt.labelTh}`}
                                        className="p-1.5 rounded-md text-text-muted hover:text-text-danger hover:bg-bg-danger disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-muted transition-colors cursor-pointer"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** ข้อมูลประเภทใหม่พร้อมเกณฑ์ทุกสาร ที่ฟอร์มส่งให้ page */
export interface NewLocationTypeInput {
    code: string;
    labelTh: string;
    standards: { parameterId: number; maxValue: number }[];
    note: string;
}

/**
 * ฟอร์มเพิ่มประเภทแหล่งน้ำ รหัส + ชื่อไทย + ค่าเกณฑ์ของทุกสาร + เหตุผล
 * บันทึกแล้วเกิดเวอร์ชันใหม่ทันที
 *
 * @param onAdd - คืน true เมื่อสำเร็จ ฟอร์มจะล้างค่า
 */
export function AddLocationTypeForm({
    parameters,
    onAdd,
    disabled,
    compact = false,
}: {
    parameters: StandardsParameter[];
    onAdd: (input: NewLocationTypeInput) => Promise<boolean>;
    disabled: boolean;
    compact?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [code, setCode] = useState("");
    const [labelTh, setLabelTh] = useState("");
    const [values, setValues] = useState<Record<number, string>>({});
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const normalizedCode = code.trim().toUpperCase();
    const codeValid = /^[A-Z][A-Z0-9_]{1,31}$/.test(normalizedCode);
    const isValueValid = (raw: string | undefined) => raw !== undefined && raw.trim() !== "" && Number.isFinite(Number(raw)) && Number(raw) > 0;
    const allValuesValid = parameters.length > 0 && parameters.every((p) => isValueValid(values[p.id]));
    const canSubmit = codeValid && labelTh.trim().length > 0 && allValuesValid && !disabled && !submitting;

    const reset = () => {
        setCode("");
        setLabelTh("");
        setValues({});
        setNote("");
    };

    const submit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            const ok = await onAdd({
                code: normalizedCode,
                labelTh: labelTh.trim(),
                standards: parameters.map((p) => ({ parameterId: p.id, maxValue: Number(values[p.id]) })),
                note: note.trim(),
            });
            if (ok) {
                reset();
                setOpen(false);
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={disabled}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-40 cursor-pointer"
            >
                <Plus size={13} /> เพิ่มประเภทแหล่งน้ำ
            </button>
        );
    }

    const inputClass = "w-full rounded-lg border px-3 py-2 text-xs bg-surface text-text-primary outline-hidden focus:border-primary placeholder:text-text-muted";

    return (
        <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-3">
            <p className="text-xs font-semibold text-text-secondary">เพิ่มประเภทแหล่งน้ำ</p>

            <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"}`}>
                <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="รหัส เช่น MANGROVE"
                    maxLength={32}
                    disabled={disabled || submitting}
                    className={`${inputClass} uppercase ${code && !codeValid ? "border-border-danger" : "border-border"}`}
                />
                <input
                    type="text"
                    value={labelTh}
                    onChange={(e) => setLabelTh(e.target.value)}
                    placeholder="ชื่อไทย เช่น เพื่อการอนุรักษ์ป่าชายเลน"
                    maxLength={100}
                    disabled={disabled || submitting}
                    className={`${inputClass} border-border`}
                />
            </div>
            {code && !codeValid && <p className="text-xs text-text-danger">รหัสต้องเป็น A–Z, 0–9, _ ขึ้นต้นด้วยตัวอักษร 2–32 ตัว</p>}

            {/* ค่าเกณฑ์ของทุกสาร บังคับกรอกครบ */}
            <div className="space-y-1.5">
                <p className="text-xs font-semibold text-text-secondary">ค่าเกณฑ์สูงสุดของประเภทนี้</p>
                <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-3"}`}>
                    {parameters.map((p) => {
                        const raw = values[p.id] ?? "";
                        const invalid = raw !== "" && !isValueValid(raw);
                        return (
                            <label key={p.id} className="flex flex-col gap-1">
                                <span className="text-xs text-text-muted">
                                    {chemAbbrev(p.name, p.formula)} <span className="opacity-70">({p.unit || "mg/L"})</span>
                                </span>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    min="0"
                                    value={raw}
                                    onChange={(e) => setValues((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                    placeholder="0.00"
                                    disabled={disabled || submitting}
                                    className={`${inputClass} ${invalid ? "border-border-danger" : "border-border"}`}
                                />
                            </label>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary">เหตุผล (ไม่บังคับ)</label>
                <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={`ค่าเริ่มต้น: เพิ่มประเภทแหล่งน้ำ "${labelTh.trim() || "…"}"`}
                    maxLength={500}
                    disabled={disabled || submitting}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    className={`${inputClass} border-border`}
                />
            </div>

            <p className="text-xs text-text-muted">บันทึกแล้วจะเกิดเวอร์ชันใหม่ทันที</p>

            <div className="flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setOpen(false);
                        reset();
                    }}
                    disabled={submitting}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-surface text-text-secondary cursor-pointer"
                >
                    ยกเลิก
                </button>
                <button
                    type="button"
                    onClick={submit}
                    disabled={!canSubmit}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white disabled:opacity-40 cursor-pointer"
                >
                    {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />} เพิ่มและบันทึกเวอร์ชันใหม่
                </button>
            </div>
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

/** 1 แถวของเวอร์ชัน: ค่าในเวอร์ชันนี้ และค่าเดิมถ้าต่างจากเวอร์ชันก่อนหน้า */
interface DiffRow {
    label: string;
    parameter: string;
    before: number | null;
    after: number;
    changed: boolean;
}

/** ค่าทุกช่องของเวอร์ชัน พร้อมธงว่าช่องไหนต่างจากเวอร์ชันก่อนหน้า */
function buildDiff(prev: StandardSnapshotRow[], cur: StandardSnapshotRow[]): DiffRow[] {
    const prevByKey = new Map(prev.map((r) => [cellKey(r.locationTypeId, r.parameterId), r.maxValue]));
    return cur.map((r) => {
        const before = prevByKey.get(cellKey(r.locationTypeId, r.parameterId)) ?? null;
        return { label: r.locationTypeLabelTh, parameter: r.parameterName, before, after: r.maxValue, changed: prev.length > 0 && before !== r.maxValue };
    });
}

/** ตารางค่าทั้งหมดของเวอร์ชัน ช่องที่เปลี่ยนไฮไลต์และขีดฆ่าค่าเดิม */
function DiffTable({ rows, hasPrevious }: { rows: DiffRow[]; hasPrevious: boolean }) {
    if (rows.length === 0) return <p className="text-xs text-text-muted">ไม่มีข้อมูลในเวอร์ชันนี้</p>;
    const changedCount = rows.filter((r) => r.changed).length;
    return (
        <div className="space-y-1">
            <p className="text-xs text-text-muted mb-1.5">{hasPrevious ? `เปลี่ยน ${changedCount} ช่องจากเวอร์ชันก่อนหน้า` : "เวอร์ชันแรก"}</p>
            {rows.map((r, i) => (
                <div
                    key={i}
                    className={`flex items-center justify-between gap-2 text-xs rounded-md px-1.5 py-1 -mx-1.5 ${r.changed ? "bg-amber-50 dark:bg-amber-500/10" : ""}`}
                >
                    <span className={`truncate ${r.changed ? "text-text-primary font-medium" : "text-text-secondary"}`}>
                        {r.label} · <span className="uppercase font-medium">{r.parameter}</span>
                    </span>
                    <span className={`shrink-0 ${r.changed ? "font-bold text-text-primary" : "font-medium text-text-secondary"}`}>
                        {r.changed && r.before !== null && <span className="text-text-muted font-normal line-through mr-1.5">{r.before}</span>}
                        {r.after}
                    </span>
                </div>
            ))}
        </div>
    );
}
