"use client";

import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        // 1. Subscribe function: ติดตามการเปลี่ยนแปลงของหน้าจอ
        (onStoreChange) => {
            if (typeof window === "undefined") return () => {};

            const media = window.matchMedia(query);
            media.addEventListener("change", onStoreChange);

            return () => media.removeEventListener("change", onStoreChange);
        },
        // 2. Client snapshot: อ่านค่าจริงบน Browser
        () => {
            if (typeof window === "undefined") return false;
            return window.matchMedia(query).matches;
        },
        // 3. Server snapshot: ค่าเริ่มต้นบน Server (SSR)
        () => false,
    );
}
