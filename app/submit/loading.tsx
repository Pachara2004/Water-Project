import { ArrowLeft } from "lucide-react";

export default function Loading() {
    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased animate-pulse">
            {/* Top Navigation Bar Mock */}
            <div className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10 h-11">
                <div className="flex items-center gap-1.5 text-sm text-text-secondary opacity-50">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </div>
                <div className="h-4 bg-surface-subtle rounded w-36" />
                <div className="w-15" />
            </div>

            {/* MOBILE VIEW SKELETON */}
            <div className="md:hidden px-4 pb-24 space-y-4 mt-3">
                {/* Submit Steps Bar Mock */}
                <div className="h-14 bg-surface rounded-xl border border-border" />

                {/* การ์ดจำลองสำหรับอัปโหลดภาพสารเคมี 2 กล่อง */}
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-surface rounded-2xl p-4 border border-border h-44 flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                            <div className="h-4 bg-surface-subtle rounded w-1/3" />
                            <div className="w-10 h-5 bg-surface-subtle rounded-full" />
                        </div>
                        <div className="h-20 bg-surface-subtle rounded-xl w-full mt-3" />
                    </div>
                ))}

                {/* Location Picker & Fields Mock */}
                <div className="h-28 bg-surface rounded-xl border border-border" />
                <div className="h-44 bg-surface rounded-xl border border-border" />
            </div>

            {/* DESKTOP VIEW SKELETON */}
            <div className="hidden md:block m-4">
                <div className="bg-surface border border-border rounded-xl overflow-hidden flex min-h-150">
                    {/* Sidebar Mock */}
                    <aside className="w-50 border-r border-border bg-surface p-4 space-y-4 shrink-0">
                        <div className="h-4 bg-surface-subtle rounded w-3/4" />
                        <div className="space-y-2 pt-2">
                            <div className="h-8 bg-surface-subtle rounded-xl" />
                            <div className="h-8 bg-surface-subtle rounded-xl" />
                        </div>
                    </aside>

                    {/* Middle Content Mock */}
                    <div className="flex flex-col flex-1 border-r border-border p-4 gap-4">
                        <div className="h-44 bg-surface-subtle rounded-2xl" />
                        <div className="h-44 bg-surface-subtle rounded-2xl" />
                    </div>

                    {/* Right Picker Content Mock */}
                    <div className="flex flex-col flex-1 p-4 gap-4">
                        <div className="h-28 bg-surface-subtle rounded-xl" />
                        <div className="h-44 bg-surface-subtle rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}
