import { ArrowLeft, Search, FileText } from "lucide-react";

export default function Loading() {
    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased animate-pulse">
            {/* Top Bar Mock */}
            <div className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10 h-11">
                <div className="flex items-center gap-1.5 text-xs text-text font-semibold opacity-50">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </div>
                <div className="h-4 bg-surface-subtle rounded w-32" />
                <div className="w-15" />
            </div>

            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                {/* ── ฟอร์มเพิ่มสถานีใหม่ Mock ── */}
                <div className="relative w-full bg-surface rounded-2xl p-5 border border-border space-y-5">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-surface-subtle rounded-full shrink-0" />
                        <div className="space-y-2 flex-1">
                            <div className="h-5 bg-surface-subtle rounded w-1/3" />
                            <div className="h-3 bg-surface-subtle rounded w-3/4" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="h-3 bg-surface-subtle rounded w-24" />
                            <div className="h-11 bg-surface-subtle rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 bg-surface-subtle rounded w-28" />
                            <div className="h-11 bg-surface-subtle rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 bg-surface-subtle rounded w-36" />
                            <div className="h-52 bg-surface-subtle rounded-xl" />
                        </div>
                        <div className="h-11 bg-surface-subtle rounded-xl mt-4" />
                    </div>
                </div>

                {/* ── รายการประวัติสถานี Mock ── */}
                <div className="relative w-full bg-surface rounded-2xl p-4 border border-border space-y-4">
                    <div className="flex items-center justify-between pt-1 px-1">
                        <div className="inline-flex items-center gap-1.5">
                            <FileText size={18} className="text-text-muted opacity-40" />
                            <div className="h-4 bg-surface-subtle rounded w-36" />
                        </div>
                        <div className="h-5 bg-surface-subtle rounded w-16" />
                    </div>

                    <div className="relative w-full flex items-center bg-surface-subtle border border-border rounded-xl px-4 h-11">
                        <div className="w-full h-3 bg-transparent" />
                        <Search size={16} className="text-text-muted ml-2 opacity-40" />
                    </div>

                    {/* วนการ์ดสถานีจำลอง */}
                    <div className="flex flex-col gap-3 pt-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-surface rounded-2xl p-3.5 border border-border flex items-center justify-between gap-4 h-20">
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-surface-subtle rounded w-1/2" />
                                    <div className="h-3 bg-surface-subtle rounded w-1/3" />
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-9 h-9 bg-surface-subtle rounded-xl" />
                                    <div className="w-9 h-9 bg-surface-subtle rounded-xl" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
