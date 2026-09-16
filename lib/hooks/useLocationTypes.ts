"use client";

/**
 * @fileoverview Custom React hook for fetching location usage types and standard thresholds
 *
 * [TH] React Hook สำหรับดึงข้อมูลประเภทการใช้ประโยชน์พื้นที่พร้อมเกณฑ์มาตรฐานจาก API (/api/location-types)
 * [EN] React hook for client-side fetching of water location types and standard thresholds from API
 *
 * @description
 * [TH] ให้ Client components สามารถดึงข้อมูลประเภทการใช้ประโยชน์ (LocationTypeWithStandards)
 * สำหรับใช้เปรียบเทียบผลตรวจน้ำใน ResultsPanel หรือ BottomSheet
 * [EN] Provides location usage classifications and standard limits for client evaluation.
 *
 * @module lib/hooks/useLocationTypes
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-20
 * @modified 2026-07-20
 *
 * @history
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: เพิ่ม hook useLocationTypes สำหรับดึงประเภทการใช้ประโยชน์พร้อมเกณฑ์
 */

import { useEffect, useState } from "react";
import type { LocationTypeWithStandards } from "@/lib/standards";

/**
 * [TH] Hook ดึงข้อมูลประเภทการใช้ประโยชน์พื้นที่ทั้งหมดพร้อมเกณฑ์มาตรฐานสำหรับ Client
 * [EN] Hook fetching all location usage types with their associated parameter thresholds
 *
 * @function useLocationTypes
 * @returns {{ locationTypes: LocationTypeWithStandards[]; loading: boolean }} รายการประเภทพื้นที่และสถานะการโหลด
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
