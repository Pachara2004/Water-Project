import { LucideSearch } from "lucide-react";

export default function Loading() {
    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <div className="w-full max-w-xl md:max-w-7xl mx-auto px-4 space-y-5 pt-6 animate-pulse">
                <div className="space-y-3">
                    {/* Header Controls Mock */}
                    <div className="bg-card-general rounded-2xl p-5 border border-border flex flex-col items-start gap-3 h-32">
                        <div className="h-6 bg-slate-200/70 rounded w-1/3" />
                        <div className="h-4 bg-slate-200/70 rounded w-2/3" />
                    </div>

                    {/* Filter Bar Mock */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1 h-10 bg-card-general border border-border rounded-xl px-3 flex items-center gap-1.5">
                            <LucideSearch size={13} className="text-text-muted opacity-40" />
                        </div>
                    </div>

                    {/* Date Picker Mock */}
                    <div className="h-10 bg-card-general border border-border rounded-xl" />

                    {/* ── เรียกใช้ Skeleton ก้อนข้างล่าง (ยกมาจากไฟล์เดิม) ── */}
                    <div className="flex items-center justify-end">
                        <div className="h-6 w-24 bg-slate-200/70 rounded" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-12 gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="bg-surface rounded-xl border border-border p-2.5 flex flex-col border-l-10 border-l-slate-200 col-span-1 md:col-span-3 h-24">
                                <div className="h-2.5 w-3/4 mb-2 bg-slate-200/70 rounded" />
                                <div className="h-5 w-1/2 mb-2 bg-slate-200/70 rounded" />
                                <div className="h-3 w-2/5 bg-slate-200/70 rounded" />
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                        <div className="col-span-1 md:col-span-5 bg-surface rounded-xl border border-border p-3 space-y-2.5 h-48" />
                        <div className="col-span-1 md:col-span-7 bg-surface rounded-xl border border-border p-3 flex flex-col gap-3 h-48" />
                    </div>
                    <div className="bg-surface rounded-xl border border-border p-3 h-48" />
                </div>
            </div>
        </div>
    );
}
