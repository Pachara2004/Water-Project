/**
 * @file app/manage/standards/standardsMobile.tsx
 * @project Water Monitoring Project
 * @module App / Manage / Standards / Mobile View
 * @description
 * view มือถือของหน้าจัดการเกณฑ์: การ์ดหัว, แท็บ แก้ไข/ประวัติ, ตารางแก้ค่าแบบเลื่อนแนวนอน,
 * ช่องเหตุผล และปุ่มบันทึกติดล่างจอ ไม่มี state ของตัวเอง รับทุกอย่างจาก page.tsx
 *
 * Mobile view of the standards admin page.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-18
 * @version 1.0.0
 *
 * @client-side
 * @license Private / Proprietary
 */

"use client";

import type { useRouter } from "next/navigation";
import { ClipboardPenLine, History, Pencil, RefreshCw, RotateCcw, Save, ClipboardCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import type { StandardSnapshotRow } from "@/lib/standards";
import {
    StandardsEditTable,
    StandardVersionList,
    AddLocationTypeForm,
    formatVersionDate,
    type StandardsLocationType,
    type StandardsParameter,
    type StandardCell,
    type StandardVersionItem,
    type NewLocationTypeInput,
} from "@/components/manage/standardsHelpers";
import type { StandardsTab } from "./page";

export interface StandardsPageProps {
    router: ReturnType<typeof useRouter>;
    toastElement: React.ReactNode;

    tab: StandardsTab;
    setTab: (v: StandardsTab) => void;
    loading: boolean;
    saving: boolean;

    locationTypes: StandardsLocationType[];
    parameters: StandardsParameter[];
    /** ค่าปัจจุบันใน DB ต่อช่อง */
    currentByKey: Map<string, number>;
    /** ค่าที่กำลังพิมพ์ต่อช่อง ไม่มี = ยังไม่แตะ */
    draftByKey: Map<string, string>;
    setDraft: (key: string, value: string) => void;
    resetDraft: () => void;
    /** ช่องที่เปลี่ยนจริงและใช้ได้ */
    changes: StandardCell[];
    hasInvalid: boolean;
    note: string;
    setNote: (v: string) => void;
    currentVersion: { id: number; version: number; createdAt: string } | null;
    pendingReviewCount: number;
    handleSave: () => void;

    /** กำลังเพิ่ม/ลบประเภท ปิดปุ่มที่เกี่ยวข้องระหว่างนี้ */
    typeMutating: boolean;
    /** คืน true เมื่อเพิ่มสำเร็จ ให้ฟอร์มล้างค่า */
    handleAddType: (input: NewLocationTypeInput) => Promise<boolean>;
    handleDeleteType: (type: StandardsLocationType) => void;

    versions: StandardVersionItem[];
    versionsLoading: boolean;
    loadSnapshot: (id: number) => Promise<StandardSnapshotRow[] | null>;
}

/**
 * หน้าจัดการเกณฑ์บนมือถือ
 *
 * @param props - ดู {@link StandardsPageProps}
 */
export default function StandardsMobile(props: StandardsPageProps) {
    const {
        router,
        toastElement,
        tab,
        setTab,
        loading,
        saving,
        locationTypes,
        parameters,
        currentByKey,
        draftByKey,
        setDraft,
        resetDraft,
        changes,
        hasInvalid,
        note,
        setNote,
        currentVersion,
        pendingReviewCount,
        handleSave,
        typeMutating,
        handleAddType,
        handleDeleteType,
        versions,
        versionsLoading,
        loadSnapshot,
    } = props;

    const canSave = changes.length > 0 && !hasInvalid && note.trim().length > 0 && !saving;

    return (
        <div className="min-h-dvh w-full bg-bg pb-28 antialiased transition-colors duration-300">
            <PageHeader title="เกณฑ์มาตรฐาน" onBack={() => router.back()} />

            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                {/* ─── 1. Header Card ─── */}
                <div className="relative w-full rounded-2xl bg-surface p-5 border border-border flex flex-col gap-4">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-text-primary">
                            จัดการ<span className="text-primary font-bold">เกณฑ์มาตรฐาน</span>
                        </h1>
                        <p className="text-text-secondary font-medium text-xs mt-0.5">แก้ไขค่าเกณฑ์มาตรฐานของสารต่อประเภทแหล่งน้ำ ทุกครั้งที่บันทึกจะเก็บเป็นเวอร์ชันใหม่</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-card-summary rounded-xl border border-border p-3 text-center">
                            <div className="text-xl font-bold text-white">{currentVersion ? `v${currentVersion.version}` : "-"}</div>
                            <div className="text-xs font-semibold text-white mt-0.5">เวอร์ชันปัจจุบัน</div>
                        </div>
                        <div className="bg-card-summary rounded-xl border border-border p-3 text-center">
                            <div className="text-xl font-bold text-white">{pendingReviewCount}</div>
                            <div className="text-xs font-semibold text-white mt-0.5">คำร้องค้างตรวจ</div>
                        </div>
                    </div>
                </div>

                {/* ─── 2. Tabs + Content ─── */}
                <div className="relative w-full bg-surface rounded-2xl p-4 border border-border space-y-4">
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface-subtle border border-border rounded-xl">
                        {(
                            [
                                { key: "edit", label: "แก้ไขเกณฑ์", icon: Pencil },
                                { key: "history", label: "ประวัติเวอร์ชัน", icon: History },
                            ] as const
                        ).map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(t.key)}
                                className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                    tab === t.key ? "bg-surface text-primary border border-border shadow-sm" : "text-text-muted"
                                }`}
                            >
                                <t.icon size={13} /> {t.label}
                            </button>
                        ))}
                    </div>

                    {tab === "edit" && (
                        <>
                            <div className="inline-flex items-center gap-1.5">
                                <ClipboardPenLine size={16} className="text-primary" />
                                <h2 className="text-sm uppercase text-primary font-bold tracking-wider">ค่าเกณฑ์มาตรฐาน</h2>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-xs text-text-muted">
                                    <RefreshCw size={14} className="animate-spin" /> กำลังโหลด...
                                </div>
                            ) : (
                                <StandardsEditTable
                                    compact
                                    locationTypes={locationTypes}
                                    parameters={parameters}
                                    currentByKey={currentByKey}
                                    draftByKey={draftByKey}
                                    onChange={setDraft}
                                    disabled={saving}
                                    onDeleteType={handleDeleteType}
                                    deleteDisabled={saving || typeMutating}
                                />
                            )}

                            <AddLocationTypeForm compact parameters={parameters} onAdd={handleAddType} disabled={saving || typeMutating} />

                            <div className="space-y-1.5 pt-1">
                                <label className="text-xs font-semibold text-text-secondary">เหตุผลในการแก้ไข</label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    disabled={saving}
                                    rows={3}
                                    maxLength={500}
                                    placeholder="เช่น ปรับตามประกาศกรมควบคุมมลพิษฉบับใหม่"
                                    className="w-full rounded-xl border border-border bg-surface-subtle px-3 py-2.5 text-xs text-text-primary outline-hidden focus:border-primary placeholder:text-text-muted resize-none"
                                />
                            </div>

                            {pendingReviewCount > 0 && changes.length > 0 && (
                                <p className="flex items-start gap-1.5 text-xs text-text-warning bg-bg-warning border border-border-warning rounded-lg p-2.5">
                                    <ClipboardCheck size={14} className="shrink-0 mt-0.5" />
                                    คำร้องที่ค้างตรวจ {pendingReviewCount} รายการจะยังถูกตัดสินด้วยเกณฑ์เดิมตอนที่ส่ง
                                </p>
                            )}
                        </>
                    )}

                    {tab === "history" && (
                        <>
                            <div className="inline-flex items-center gap-1.5">
                                <History size={16} className="text-primary" />
                                <h2 className="text-sm uppercase text-primary font-bold tracking-wider">ประวัติเวอร์ชัน</h2>
                            </div>
                            {versionsLoading ? (
                                <div className="flex items-center justify-center gap-2 py-10 text-xs text-text-muted">
                                    <RefreshCw size={14} className="animate-spin" /> กำลังโหลด...
                                </div>
                            ) : (
                                <StandardVersionList versions={versions} currentVersionId={currentVersion?.id ?? null} loadSnapshot={loadSnapshot} />
                            )}
                            {currentVersion && <p className="text-xs text-text-muted text-center">เวอร์ชันปัจจุบันบันทึกเมื่อ {formatVersionDate(currentVersion.createdAt)}</p>}
                        </>
                    )}
                </div>
            </div>

            {/* ─── ปุ่มบันทึกติดล่างจอ ─── */}
            {tab === "edit" && (
                <div className="fixed bottom-0 inset-x-0 z-20 bg-surface/95 backdrop-blur border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <div className="max-w-xl mx-auto flex items-center gap-2">
                        <button
                            type="button"
                            onClick={resetDraft}
                            disabled={saving || (changes.length === 0 && !hasInvalid && note === "")}
                            className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold rounded-xl border border-border bg-surface-subtle text-text-secondary disabled:opacity-40 cursor-pointer"
                        >
                            <RotateCcw size={14} /> ล้าง
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={!canSave}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold rounded-xl bg-primary text-white disabled:opacity-40 cursor-pointer"
                        >
                            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            บันทึกเป็นเวอร์ชันใหม่{changes.length > 0 ? ` (${changes.length} ช่อง)` : ""}
                        </button>
                    </div>
                </div>
            )}

            {toastElement}
        </div>
    );
}
