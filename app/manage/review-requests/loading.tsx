/**
 * @file app/manage/review-requests/loading.tsx
 * @project Water Monitoring Project
 * @module App / Manage / Review Requests / Loading
 * @description
 * Skeleton ของหน้าตรวจสอบคำร้อง export ReviewRequestCardSkeleton (การ์ดเดี่ยว) ให้หน้าจริงใช้ตอนสลับแท็บด้วย
 *
 * Route loading UI for /manage/review-requests; the single-card skeleton is reused on tab switches.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-16
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-24)
 *
 * @lastModified 2026-07-24 16:14
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-07-16 14:52 by Pachara P. - เพิ่ม skeleton loader ทุกหน้า
 * - 2026-07-24 13:27 by Nopparut U. - แยก ReviewRequestCardSkeleton ให้ใช้ซ้ำตอนสลับแท็บ
 *
 * @client-side ไม่มี hook/state เป็น Server Component ได้ (Next.js route loading UI)
 * @license Private / Proprietary
 */

import { ArrowLeft } from "lucide-react";

/** การ์ด skeleton ของคำร้องหนึ่งใบ ใช้ทั้งตอนโหลด route ครั้งแรกและตอนสลับแท็บในหน้าเดิม */
export function ReviewRequestCardSkeleton() {
    return (
        <div className="bg-surface rounded-2xl border border-border p-5 space-y-4 h-64 animate-pulse">
            {/* Header row */}
            <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                    <div className="h-4 bg-surface-subtle rounded w-1/4" />
                    <div className="h-3 bg-surface-subtle rounded w-1/5" />
                </div>
                <div className="w-16 h-6 bg-surface-subtle rounded-full" />
            </div>
            {/* Metadata input-like blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="h-9 bg-surface-subtle rounded-xl" />
                <div className="h-9 bg-surface-subtle rounded-xl" />
            </div>
            {/* Inner sample image list mockup */}
            <div className="h-16 bg-surface-subtle rounded-xl w-full" />
            {/* Action buttons mockup */}
            <div className="flex gap-2.5 pt-1">
                <div className="flex-1 h-11 bg-surface-subtle rounded-xl" />
                <div className="flex-1 h-11 bg-surface-subtle rounded-xl" />
            </div>
        </div>
    );
}

export default function Loading() {
    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased animate-pulse">
            {/* Top Bar Mock */}
            <div className="bg-card-general border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10 h-11">
                <div className="flex items-center gap-1.5 text-xs text-text opacity-50 font-semibold">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </div>
                <div className="h-4 bg-surface-subtle rounded w-44" />
                <div className="w-15" />
            </div>

            <div className="w-full max-w-4xl mx-auto px-4 pt-5 space-y-6">
                {/* Header card Mock */}
                <div className="bg-card-general rounded-2xl border border-border p-5 h-24 flex flex-col justify-center space-y-2">
                    <div className="h-5 bg-surface-subtle rounded w-1/3" />
                    <div className="h-3 bg-surface-subtle rounded w-3/4" />
                </div>

                {/* Tabs Mock */}
                <div className="space-y-2">
                    <div className="h-4 bg-surface-subtle rounded w-32 ml-2" />
                    <div className="flex items-center gap-1.5">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex-1 py-5 bg-card-general border border-border rounded-xl" />
                        ))}
                    </div>
                </div>

                {/* List Items Mock */}
                <div className="space-y-5">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <ReviewRequestCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        </div>
    );
}
