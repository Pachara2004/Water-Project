"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import { toISODate, type ComboOption } from "@/components/dashboard/dashboardHelpers";

export type DashboardAnalyticsState = ReturnType<typeof useDashboardAnalytics>;

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
    const [agencySearch, setAgencySearch] = useState(""); // ข้อความที่พิมพ์ในช่องค้นหาหน่วยงาน
    const [stationSearch, setStationSearch] = useState(""); // ข้อความที่พิมพ์ในช่องค้นหาสถานี
    const [trendMode, setTrendMode] = useState<"wow" | "mom">("wow");

    const userRole = currentUser?.role?.toLowerCase() || "officer";
    const userId = currentUser?.id || null;

    useEffect(() => {
        if (userRole === "collector") setViewMode("MINE");
        else if (userRole === "officer") setViewMode("ALL");
    }, [userRole]);

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

    // analytics มาจาก API เป็น any — ประกาศรูปร่างที่ใช้จริงไว้ตรงนี้ ตัวกรอง/ตัวเลือกด้านล่างจะได้ตรวจชนิดได้
    const locations: { id: number; stationName: string; governingAgency: string }[] = analytics?.locations ?? [];
    const agencyOptions: ComboOption[] = (analytics?.agencies || []).map((a: string) => ({ key: a, label: a }));

    // รายการสถานีถูกกรองด้วยหน่วยงานที่เลือกอยู่ — เลือกกรมประมงแล้วช่องสถานีเหลือเฉพาะสถานีของกรมประมง
    const stationOptions: ComboOption[] = locations
        .filter((l) => agency === "all" || l.governingAgency === agency)
        .map((l) => ({ key: l.id, label: l.stationName, hint: l.governingAgency }));

    // เลือกหน่วยงานใหม่แล้วสถานีที่ค้างอยู่อาจไม่ได้สังกัดหน่วยงานนั้น ต้องล้างทิ้ง
    // ไม่งั้นสองช่องขัดกันเอง และ where ฝั่ง API ให้ locationId ชนะ agency ผลที่ได้จะไม่ตรงกับที่เห็นบนช่องหน่วยงาน
    const selectAgency = (name: string) => {
        setAgency(name);
        setAgencySearch(name === "all" ? "" : name);
        if (locationId !== null && name !== "all") {
            const current = locations.find((l) => l.id === locationId);
            if (current?.governingAgency !== name) {
                setLocationId(null);
                setStationSearch("");
            }
        }
    };

    // เลือกสถานีแล้วเติมหน่วยงานที่สถานีนั้นสังกัดให้เอง — สถานีหนึ่งมีหน่วยงานเดียวอยู่แล้ว
    // ให้ช่องซ้ายบอกได้ว่ากำลังดูข้อมูลของหน่วยงานไหน แทนที่จะค้างอยู่ที่ "ทุกหน่วยงาน" ทั้งที่กรองสถานีเดียวอยู่
    // ล้างสถานีแล้วหน่วยงานยังอยู่ ผู้ใช้จึงไล่ดูสถานีอื่นในหน่วยงานเดิมต่อได้ทันที
    const selectStation = (opt: ComboOption | null) => {
        setLocationId(opt ? Number(opt.key) : null);
        setStationSearch(opt ? opt.label : "");
        if (!opt) return;
        const owner = locations.find((l) => l.id === Number(opt.key))?.governingAgency;
        if (owner) {
            setAgency(owner);
            setAgencySearch(owner);
        }
    };

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
        stationSearch,
        setStationSearch,
        agencyOptions,
        stationOptions,
        selectAgency,
        selectStation,
        trendMode,
        setTrendMode,
    };
}
