/**
 * @file app/manage/loading.tsx
 * @project Water Monitoring Project
 * @module App / Manage / Loading
 * @description
 * Skeleton ของหน้าจัดการระบบ: หัวข้อ, การ์ดโปรไฟล์ และรายการเมนู
 *
 * Route loading UI for /manage.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-16
 * @version 1.0.0
 *
 * @lastModified 2026-07-16 14:52
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-07-16 14:52 by Pachara P. - เพิ่ม skeleton loader ทุกหน้า
 *
 * @client-side ไม่มี hook/state เป็น Server Component ได้ (Next.js route loading UI)
 * @license Private / Proprietary
 */

import { ChevronRight } from "lucide-react";

export default function Loading() {
    return (
        <div className="min-h-dvh w-full bg-bg transition-colors duration-75 animate-pulse">
            <div className="w-full max-w-2xl mx-auto px-4">
                {/* Header Title Skeleton */}
                <div className="pt-8 pb-1 mb-1 p-1">
                    <div className="h-8 bg-surface-subtle rounded-md w-48" />
                </div>

                {/* Profile Card Skeleton */}
                <div className="mb-2 bg-card-general rounded-xl border border-border p-4 h-32 flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-4 p-2 pb-0">
                        <div className="h-6 bg-surface-subtle rounded-md w-2/3" />
                        <div className="w-26 h-9 bg-surface-subtle rounded-md shrink-0" />
                    </div>
                    <div className="p-2 pt-0 space-y-2">
                        <div className="h-4 bg-surface-subtle rounded-md w-1/3" />
                        <div className="h-4 bg-surface-subtle rounded-md w-1/4" />
                    </div>
                </div>

                {/* Menu List Skeleton */}
                <div className="space-y-2">
                    <div className="p-1 flex justify-between items-center gap-4">
                        <div className="h-4 bg-surface-subtle rounded-md w-28" />
                        <div className="h-6 bg-surface-subtle rounded-md w-20 shrink-0" />
                    </div>

                    <div className="grid grid-cols-1 gap-2 items-stretch">
                        {/* จำลองปุ่มเมนูการจัดการขึ้นมา 3 กล่อง */}
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="w-full group flex items-start gap-4 p-4 bg-card-general rounded-xl border border-border">
                                <div className="w-6 h-6 bg-surface-subtle rounded-md shrink-0 self-center" />
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="h-4 bg-surface-subtle rounded-md w-1/2" />
                                    <div className="h-3 bg-surface-subtle rounded-md w-3/4" />
                                </div>
                                <ChevronRight size={18} className="text-text-muted/30 shrink-0 self-center" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
