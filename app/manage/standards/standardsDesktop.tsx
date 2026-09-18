/**
 * @file app/manage/standards/standardsDesktop.tsx
 * @project Water Monitoring Project
 * @module App / Manage / Standards / Desktop View
 * @description
 * view desktop ของหน้าจัดการเกณฑ์: ตารางแก้ค่าซ้าย ประวัติเวอร์ชันขวา แสดงพร้อมกันไม่ต้องสลับแท็บ
 * ใช้ StandardsPageProps ชุดเดียวกับ mobile
 *
 * Desktop view of the standards admin page: edit table and version history side by side.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-18
 * @version 1.0.0
 *
 * @client-side
 * @license Private / Proprietary
 */

"use client";

import { ClipboardPenLine, History, RefreshCw, RotateCcw, Save, ClipboardCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { StandardsEditTable, StandardVersionList, formatVersionDate } from "@/components/manage/standardsHelpers";
import type { StandardsPageProps } from "./standardsMobile";

/**
 * หน้าจัดการเกณฑ์บน desktop
 *
 * @param props - ดู {@link StandardsPageProps}
 */
export default function StandardsDesktop(props: StandardsPageProps) {
    const {
        router,
        toastElement,
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
        versions,
        versionsLoading,
        loadSnapshot,
    } = props;

    const canSave = changes.length > 0 && !hasInvalid && note.trim().length > 0 && !saving;

    return (
        <div className="min-h-dvh w-full bg-bg antialiased transition-colors duration-300">
            <PageHeader title="เกณฑ์มาตรฐาน" onBack={() => router.back()} />

            <div className="w-full mx-auto p-4 space-y-4">
                {/* ─── 1. Header Card ─── */}
                <div className="relative w-full rounded-2xl bg-surface p-6 border border-border flex items-center justify-between gap-6">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-text-primary">
                            จัดการ<span className="text-primary font-bold">เกณฑ์มาตรฐาน</span>
                        </h1>
                        <p className="text-text-secondary font-medium text-xs mt-0.5">แก้ไขค่าเกณฑ์มาตรฐานของสารต่อประเภทแหล่งน้ำ ทุกครั้งที่บันทึกจะเก็บเป็นเวอร์ชันใหม่</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 shrink-0">
                        <div className="bg-card-summary rounded-xl border border-border p-3 text-center min-w-30">
                            <div className="text-xl font-bold text-white">{currentVersion ? `v${currentVersion.version}` : "-"}</div>
                            <div className="text-xs font-semibold text-white mt-0.5">เวอร์ชันปัจจุบัน</div>
                        </div>
                        <div className="bg-card-summary rounded-xl border border-border p-3 text-center min-w-30">
                            <div className="text-xl font-bold text-white">{pendingReviewCount}</div>
                            <div className="text-xs font-semibold text-white mt-0.5">คำร้องค้างตรวจ</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 items-start">
                    {/* ─── 2. ตารางแก้ค่า ─── */}
                    <div className="bg-surface rounded-2xl p-5 border border-border space-y-4">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="inline-flex items-center gap-1.5">
                                <ClipboardPenLine size={18} className="text-primary" />
                                <h2 className="text-sm uppercase text-primary font-bold tracking-wider">ค่าค่าเกณฑ์มาตรฐาน</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={resetDraft}
                                    disabled={saving || (changes.length === 0 && !hasInvalid && note === "")}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-surface-subtle text-text-secondary disabled:opacity-40 cursor-pointer"
                                >
                                    <RotateCcw size={13} /> ล้าง
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={!canSave}
                                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-white disabled:opacity-40 cursor-pointer"
                                >
                                    {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                                    บันทึกเป็นเวอร์ชันใหม่{changes.length > 0 ? ` (${changes.length} ช่อง)` : ""}
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center gap-2 py-16 text-xs text-text-muted">
                                <RefreshCw size={14} className="animate-spin" /> กำลังโหลด...
                            </div>
                        ) : (
                            <StandardsEditTable
                                locationTypes={locationTypes}
                                parameters={parameters}
                                currentByKey={currentByKey}
                                draftByKey={draftByKey}
                                onChange={setDraft}
                                disabled={saving}
                            />
                        )}

                        <div className="space-y-1.5 pt-1">
                            <label className="text-xs font-semibold text-text-secondary">เหตุผลในการแก้ไข</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                disabled={saving}
                                rows={3}
                                maxLength={500}
                                placeholder="เช่น ปรับตามประกาศกรมควบคุมมลพิษฉบับใหม่"
                                className="w-full rounded-xl border border-border bg-surface-subtle px-3 py-2.5 text-sm text-text-primary outline-hidden focus:border-primary placeholder:text-text-muted resize-none"
                            />
                        </div>

                        {pendingReviewCount > 0 && changes.length > 0 && (
                            <p className="flex items-start gap-1.5 text-xs text-text-warning bg-bg-warning border border-border-warning rounded-lg p-2.5">
                                <ClipboardCheck size={14} className="shrink-0 mt-0.5" />
                                คำร้องที่ค้างตรวจ {pendingReviewCount} รายการจะยังถูกตัดสินด้วยเกณฑ์เดิมตอนที่ส่ง
                            </p>
                        )}
                    </div>

                    {/* ─── 3. ประวัติเวอร์ชัน ─── */}
                    <div className="bg-surface rounded-2xl p-5 border border-border space-y-4">
                        <div className="inline-flex items-center gap-1.5">
                            <History size={18} className="text-primary" />
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
                    </div>
                </div>
            </div>

            {toastElement}
        </div>
    );
}
