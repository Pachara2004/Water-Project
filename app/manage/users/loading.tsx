import { ArrowLeft, Search, Users } from "lucide-react";

export default function Loading() {
    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased animate-pulse">
            {/* Top Navigation Navbar Mock */}
            <div className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10 h-11">
                <div className="flex items-center gap-1.5 text-xs text-secondary opacity-50">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </div>
                <div className="h-4 bg-surface-subtle rounded w-32" />
                <div className="w-15" />
            </div>

            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                {/* ── 1. Header & Stats Card Mock ── */}
                <div className="relative w-full rounded-2xl bg-surface p-5 border border-border flex flex-col gap-4">
                    <div className="space-y-2">
                        <div className="h-6 bg-surface-subtle rounded w-1/2" />
                        <div className="h-3 bg-surface-subtle rounded w-1/3" />
                    </div>
                    {/* Stats Boxes Mock */}
                    <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-surface-subtle border border-border rounded-xl h-16" />
                        ))}
                    </div>
                </div>

                {/* ── 2. Filter Section Mock ── */}
                <div className="relative w-full bg-surface rounded-2xl p-4 border border-border space-y-4">
                    <div className="flex items-center justify-between pt-1 px-0.5">
                        <div className="inline-flex items-center gap-1.5">
                            <Users size={18} className="text-text-muted opacity-40" />
                            <div className="h-4 bg-surface-subtle rounded w-28" />
                        </div>
                    </div>

                    {/* Search Input Mock */}
                    <div className="relative w-full flex items-center bg-surface-subtle border border-border rounded-xl px-4 h-11">
                        <div className="w-full h-3 bg-transparent" />
                        <Search size={16} className="text-text-muted ml-2 opacity-40" />
                    </div>

                    {/* Tabs Mock */}
                    <div className="h-9 bg-surface-subtle border border-border rounded-xl" />

                    {/* Summary Counter Mock */}
                    <div className="flex justify-between items-center pt-1 border-t border-border">
                        <div className="h-3 bg-surface-subtle rounded w-16" />
                        <div className="h-3 bg-surface-subtle rounded w-24" />
                    </div>

                    {/* ── 3. Content Core List Mock ── */}
                    <div className="space-y-3 pt-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-surface rounded-xl p-3 border border-border flex flex-col gap-3 h-32">
                                <div className="h-4 bg-surface-subtle rounded w-1/3 mx-2" />
                                <div className="grid grid-cols-2 gap-2 w-full px-2">
                                    <div className="h-3 bg-surface-subtle rounded w-3/4" />
                                    <div className="h-3 bg-surface-subtle rounded w-1/2" />
                                    <div className="h-3 bg-surface-subtle rounded w-2/3" />
                                    <div className="h-3 bg-surface-subtle rounded w-1/3" />
                                </div>
                                <div className="h-9 bg-surface-subtle rounded-xl w-full mt-auto" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
