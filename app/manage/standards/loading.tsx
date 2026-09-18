/**
 * @file app/manage/standards/loading.tsx
 * @project Water Monitoring Project
 * @module App / Manage / Standards / Loading
 * @description
 * Skeleton ของหน้าจัดการเกณฑ์: แถบหัว, การ์ดสรุป, แท็บ และตาราง
 *
 * Route loading UI for /manage/standards.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-18
 * @version 1.0.0
 *
 * @client-side ไม่มี hook/state เป็น Server Component ได้ (Next.js route loading UI)
 * @license Private / Proprietary
 */

import { ArrowLeft, ClipboardPenLine } from "lucide-react";

export default function Loading() {
    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased animate-pulse">
            <div className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10 h-11">
                <div className="flex items-center gap-1.5 text-xs text-text font-semibold opacity-50">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </div>
                <div className="h-4 bg-surface-subtle rounded w-32" />
                <div className="w-15" />
            </div>

            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                <div className="relative w-full rounded-2xl bg-surface p-5 border border-border flex flex-col gap-4">
                    <div className="space-y-2">
                        <div className="h-6 bg-surface-subtle rounded w-1/2" />
                        <div className="h-3 bg-surface-subtle rounded w-2/3" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="bg-surface-subtle border border-border rounded-xl h-16" />
                        ))}
                    </div>
                </div>

                <div className="relative w-full bg-surface rounded-2xl p-4 border border-border space-y-4">
                    <div className="h-9 bg-surface-subtle border border-border rounded-xl" />
                    <div className="inline-flex items-center gap-1.5">
                        <ClipboardPenLine size={16} className="text-text-muted opacity-40" />
                        <div className="h-4 bg-surface-subtle rounded w-36" />
                    </div>
                    <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="h-4 bg-surface-subtle rounded flex-1" />
                                <div className="h-8 bg-surface-subtle rounded-lg w-24" />
                                <div className="h-8 bg-surface-subtle rounded-lg w-24" />
                            </div>
                        ))}
                    </div>
                    <div className="h-20 bg-surface-subtle border border-border rounded-xl" />
                </div>
            </div>
        </div>
    );
}
