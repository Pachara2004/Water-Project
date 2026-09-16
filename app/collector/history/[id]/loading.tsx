/**
 * @file app/collector/history/[id]/loading.tsx
 * @project Water Monitoring Project
 * @module App / Collector / History / Loading
 * @description
 * Skeleton ของหน้ารายละเอียดตัวอย่างน้ำ: แถบหัวพร้อมปุ่มย้อนกลับ, การ์ดสรุป และกล่องภาพ
 *
 * Route loading UI for /collector/history/[id].
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-16
 * @version 1.0.0
 *
 * @lastModified 2026-07-24 16:14
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-07-16 14:52 by Pachara P. - เพิ่ม skeleton loader ทุกหน้า
 * - 2026-07-24 16:14 by Pachara P. - ปรับ UI
 *
 * @client-side ไม่มี hook/state เป็น Server Component ได้ (Next.js route loading UI)
 * @license Private / Proprietary
 */

import { ArrowLeft } from "lucide-react";

export default function Loading() {
    return (
        <div className="min-h-dvh w-full bg-surface-muted pb-5 antialiased animate-pulse">
            {/* Top Bar Skeleton */}
            <div className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10 h-11">
                <div className="flex items-center gap-1.5 text-xs text-text font-semibold opacity-50">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </div>
                <div className="h-4 bg-surface-subtle rounded w-44" />
                <div className="w-10" />
            </div>

            {/* MOBILE VIEW SKELETON */}
            <div className="md:hidden px-4 space-y-4 mt-4">
                <div className="w-full h-64 bg-surface rounded-xl border border-border" /> {/* Image Zone Mock */}
                <div className="w-full h-48 bg-surface rounded-xl border border-border" /> {/* Results Panel Mock */}
                <div className="w-full h-72 bg-surface rounded-xl border border-border" /> {/* Meta Blocks Mock */}
            </div>

            {/* DESKTOP VIEW SKELETON */}
            <div className="hidden md:block m-4">
                <div className="bg-surface border border-border rounded-xl overflow-hidden flex min-h-150">
                    {/* Sidebar Mock */}
                    <aside className="w-50 border-r border-border bg-surface flex flex-col p-4 shrink-0 space-y-4">
                        <div className="h-3 bg-surface-subtle rounded w-3/4" />
                        <div className="space-y-2 py-2 border-b">
                            <div className="h-6 bg-surface-subtle rounded w-1/2" />
                            <div className="h-6 bg-surface-subtle rounded w-2/3 mt-2" />
                        </div>
                    </aside>

                    {/* Middle Info Content Mock */}
                    <div className="flex flex-col flex-1 border-r border-border p-4 gap-4">
                        <div className="h-32 bg-surface-subtle rounded-xl" />
                        <div className="h-20 bg-surface-subtle rounded-xl" />
                        <div className="h-20 bg-surface-subtle rounded-xl" />
                    </div>

                    {/* Right Images & Panels Mock */}
                    <div className="flex flex-col flex-1 p-4 gap-4">
                        <div className="h-64 bg-surface-subtle rounded-xl" />
                        <div className="h-40 bg-surface-subtle rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}
