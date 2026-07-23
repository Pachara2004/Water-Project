"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import { toISODate } from "@/components/dashboard/dashboardHelpers";

export function useDashboardAnalytics() {
    const { currentUser, theme } = useAppStore();
    const router = useRouter();
    const [viewMode, setViewMode] = useState<"ALL" | "MINE">("ALL");
    const [analytics, setAnalytics] = useState<any>(null);
    const [fetchError, setFetchError] = useState(false);
    const [retryTick, setRetryTick] = useState(0); // เพิ่มค่าเพื่อ trigger fetch ใหม่ตอนกดปุ่มลองใหม่

    // ค่าเริ่มต้น = 6 เดือนล่าสุดแบบ rolling พอดี (ล็อควันที่ 1 ก่อนถอยเดือน กันเดือนที่ 7 โผล่มาจากเศษวัน) แทนการ hardcode ทั้งปี
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - 5); // เดือนนี้ + ย้อนอีก 5 เดือน = ครบ 6 เดือน
        return toISODate(d);
    });
    const [endDate, setEndDate] = useState(() => toISODate(new Date()));
    const [agency, setAgency] = useState("all");
    const [locationId, setLocationId] = useState<number | null>(null); // เลือกสถานีเจาะจง (ละเอียดกว่า agency) จากผลค้นหา
    const [agencySearch, setAgencySearch] = useState(""); // ข้อความที่พิมพ์ค้นหาหน่วยงาน/สถานี
    const [trendMode, setTrendMode] = useState<"wow" | "mom">("wow");
    const [showAgencyMenu, setShowAgencyMenu] = useState(false); // เปิด/ปิด dropdown ผลค้นหาหน่วยงาน+สถานี
    const agencyMenuRef = useRef<HTMLDivElement>(null);

    const userRole = currentUser?.role?.toLowerCase() || "officer";
    const userId = currentUser?.id || null;

    useEffect(() => {
        if (userRole === "collector") setViewMode("MINE");
        else if (userRole === "officer") setViewMode("ALL");
    }, [userRole]);

    // ปิด dropdown หน่วยงานเวลาคลิกนอกกล่อง
    useEffect(() => {
        if (!showAgencyMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (agencyMenuRef.current && !agencyMenuRef.current.contains(e.target as Node)) setShowAgencyMenu(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showAgencyMenu]);

    useEffect(() => {
        // guest/ยังไม่ login ไม่มีสิทธิ์เห็นหน้านี้อยู่แล้ว (จะโดน guard ด้านล่างเด้งกลับ) — ข้ามการยิง fetch ไปเลย
        // กัน request ที่รู้อยู่แล้วว่าจะโดน 403 จาก backend ไม่ให้ขึ้น error overlay ใน dev เปล่าๆ
        if (!currentUser || userRole === "guest") return;

        // ยกเลิก request เก่าเวลาสลับ filter เร็วๆ — กัน response เก่าที่มาช้ากว่ามาทับผลลัพธ์ของ filter ปัจจุบัน
        const controller = new AbortController();
        setFetchError(false);
        let url = `/api/dashboard/widgets?viewMode=${viewMode}&startDate=${startDate}&endDate=${endDate}&agency=${agency}`;
        if (locationId) url += `&locationId=${locationId}`;

        // ต้องแนบ Token ยืนยันตัวตนเสมอ — server ตรวจสิทธิ์และดึง collectorId จาก token เอง ไม่รับค่าจาก client แล้ว
        fetch(url, {
            headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
            signal: controller.signal,
        })
            .then((res) => {
                if (!res.ok) throw new Error("Database Analytics Fetch Error");
                return res.json();
            })
            .then((data) => setAnalytics(data))
            .catch((err) => {
                if (err.name === "AbortError") return;
                console.error(err);
                setFetchError(true);
            }); // 💡 สิ้นสุดแค่ .catch พอครับ

        return () => controller.abort();
    }, [viewMode, userId, userRole, startDate, endDate, agency, locationId, retryTick, currentUser]);

    return {
        currentUser,
        theme,
        router,
        userRole,
        viewMode,
        setViewMode,
        analytics,
        fetchError,
        setRetryTick,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        agency,
        setAgency,
        locationId,
        setLocationId,
        agencySearch,
        setAgencySearch,
        trendMode,
        setTrendMode,
        showAgencyMenu,
        setShowAgencyMenu,
        agencyMenuRef,
    };
}
