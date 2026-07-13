"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/map/MapView"), {
    ssr: false,
    loading: () => (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-muted/60 backdrop-blur-xs">
            <div className="flex flex-col items-center gap-3">
                <div className="w-9 h-9 border-[3px] border-primary border-t-transparent rounded-full animate-spin will-change-transform" />
                <span className="text-xs text-text-muted font-semibold tracking-wide">กำลังโหลดแผนที่...</span>
            </div>
        </div>
    ),
});

export default function MapPage() {
    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
            <div className="w-full h-full relative">
                <MapView mode="explorer" />
            </div>
        </div>
    );
}
