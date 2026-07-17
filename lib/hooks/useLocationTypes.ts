"use client";

import { useEffect, useState } from "react";
import type { LocationTypeWithStandards } from "@/lib/standards";

/**
 * ดึงประเภทการใช้ประโยชน์ทั้งหมดพร้อมเกณฑ์ของแต่ละประเภท
 *
 * client component query DB เองไม่ได้ ต้องรับผ่าน API เท่านั้น
 */
export function useLocationTypes() {
    const [locationTypes, setLocationTypes] = useState<LocationTypeWithStandards[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        fetch("/api/location-types")
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                setLocationTypes(Array.isArray(data) ? data : []);
            })
            .catch((err) => {
                console.error("Failed to fetch location types:", err);
                if (!cancelled) setLocationTypes([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return { locationTypes, loading };
}
