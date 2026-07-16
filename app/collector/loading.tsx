export default function Loading() {
    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6 animate-pulse">
                {/* Header Welcome Card Skeleton */}
                <div className="relative w-full rounded-2xl bg-surface p-5 border border-border flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-2 w-2/3">
                            <div className="h-4 bg-surface-subtle rounded-md w-4/5" />
                            <div className="h-3 bg-surface-subtle rounded-md w-3/5" />
                        </div>
                    </div>
                    <div className="w-full h-11 bg-surface-subtle rounded-xl" />
                </div>

                {/* Filter Card Skeleton */}
                <div className="relative w-full bg-surface rounded-2xl p-4 border border-border">
                    <div className="flex items-center justify-between gap-3 pt-1 px-1">
                        <div className="h-4 bg-surface-subtle rounded-md w-32" />
                        <div className="h-8 bg-surface-subtle rounded-xl w-24" />
                    </div>

                    <div className="space-y-4 mt-6 mb-2">
                        <div className="w-full h-11 bg-surface-subtle rounded-xl" />
                        <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-10 bg-surface-subtle rounded-xl" />
                            <div className="flex-1 h-10 bg-surface-subtle rounded-xl" />
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-border">
                            <div className="h-3 bg-surface-subtle rounded-md w-20" />
                            <div className="h-3 bg-surface-subtle rounded-md w-16" />
                        </div>
                    </div>

                    {/* History Card List Skeleton */}
                    <div className="flex flex-col gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="bg-surface rounded-2xl p-3.5 border border-border flex items-start sm:items-center gap-3.5">
                                <div className="w-14 h-14 rounded-xl bg-surface-subtle shrink-0" />
                                <div className="flex-1 min-w-0 flex flex-col gap-2">
                                    <div className="flex items-start justify-between gap-4 w-full">
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <div className="h-3.5 bg-surface-subtle rounded-md w-2/3" />
                                            <div className="h-3 bg-surface-subtle rounded-md w-1/3" />
                                        </div>
                                        <div className="h-5 bg-surface-subtle rounded-md w-14 shrink-0" />
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        <div className="h-5 bg-surface-subtle rounded-md w-12" />
                                        <div className="h-5 bg-surface-subtle rounded-md w-12" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
