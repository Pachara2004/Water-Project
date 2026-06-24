"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/map/MapView"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full bg-surface-muted">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-text-muted font-bold">
                    กำลังโหลดแผนที่...
                </span>
            </div>
        </div>
    ),
});

export default function MapPage() {
    return (
        /*
      On mobile/tablet: fills viewport minus the bottom navbar pill (~72px).
      On desktop (lg:): ซ้ายขยับหลบ Sidebar ตัวใหม่ที่กว้าง 50 (200px) พอดีเป๊ะ
    */
        <div className="fixed inset-x-0 top-0 bottom-[calc(72px+env(safe-area-inset-bottom))] lg:left-50 lg:bottom-0 lg:right-0">
            <div className="w-full h-full">
                <MapView mode="explorer" />
            </div>
        </div>
    );
}
