"use client";

import { useEffect, useRef, useState } from "react";
import liff from "@line/liff";
import { readCollectorFilters, writeCollectorFilters, type CollectorFilterState } from "@/lib/collectorFilters";
import type { CurrentUser } from "@/lib/store";

export interface CollectorSample {
    id: number;
    locationId: number;
    /** null = ประเมินไม่ได้ (ไม่มีค่าที่วัดได้เลย) — ต่างจาก safe ที่แปลว่าตัดสินแล้วว่าผ่าน */
    status: "safe" | "warning" | "danger" | null;
    collectedAt: string | Date;
    collectedBy: number;
    imageUrl?: string | null;
    imagePlotUrl?: string | null;
    isDeleted: boolean;
    updatedBy?: number | null;
    sessionGroup?: string | null;
    // สถานะการตรวจสอบ (คนละมิติกับ status คุณภาพน้ำ) — มีค่าเฉพาะรายการที่ confidence ต่ำกว่าเกณฑ์เท่านั้น
    reviewStatus?: "PENDING" | "APPROVED" | "EDITED_APPROVED" | "REJECTED";
    location?: {
        id: number;
        name: string;
        organization: string;
        province?: string | null;
        district?: string | null;
        subdistrict?: string | null;
        zipcode?: string | null;
    } | null;
    // รองรับคุณสมบัติค่าวัดเคมีจากหลังบ้านแบบ Dynamic ทุกคีย์สารใน DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

interface UseCollectorFiltersArgs {
    currentUser: CurrentUser | null;
}

export type CollectorFiltersState = ReturnType<typeof useCollectorFilters>;

const SEARCH_DEBOUNCE_MS = 400;
const SAVE_DEBOUNCE_MS = 300;
/** ใช้ตอนยังไม่เคยมีค่าที่ผู้ใช้เลือกไว้ — ต้องตรงกับ fallback ใน readCollectorFilters() */
const DEFAULT_PAGE_SIZE = 10;

/* ตัวกรอง + ข้อมูลทั้งหมดของหน้าประวัติผลตรวจ (/collector) รวมถึงการจำค่าไว้ข้ามการเปิดหน้ารายละเอียด

   Hook นี้เป็นเจ้าของ fetch เอง (ตาม pattern ของ useDashboardAnalytics) — การกรอง/เรียง/แบ่งหน้า
   ทั้งหมดเกิดที่ฝั่ง API (/api/samples) ไม่ใช่ในหน่วยความจำฝั่ง client แล้ว
   รวมไว้ที่เดียวเพราะลำดับการทำงานของ effect ในนี้ผูกกันแน่น (ดูคอมเมนต์แต่ละจุด)
   ถ้ากระจายอยู่ในหน้า 700 บรรทัด การย้ายบล็อกโค้ดสลับที่จะทำให้การกู้ค่าพังเงียบๆ */
export function useCollectorFilters({ currentUser }: UseCollectorFiltersArgs) {
    const [samples, setSamples] = useState<CollectorSample[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    // สูตรเคมีของแต่ละสาร (คีย์เป็นชื่อตัวพิมพ์เล็ก) มาพร้อม payload ของ /api/samples
    // เก็บไว้ที่นี่เพื่อให้การ์ดวาดป้ายได้พร้อมข้อมูล ไม่ต้องยิง /api/parameters แยกแล้วป้ายกระพริบ
    const [parameterFormulas, setParameterFormulas] = useState<Record<string, string>>({});

    const [showOnlyMine, setShowOnlyMine] = useState(true);
    const [globalFilter, setGlobalFilter] = useState("");
    const [debouncedFilter, setDebouncedFilter] = useState("");
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    // สถานะการตรวจสอบ — คนละมิติกับ selectedStatuses (คุณภาพน้ำ) จึงแยกตัวแปรและแยก query param
    const [selectedReviewStatuses, setSelectedReviewStatuses] = useState<string[]>([]);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [sortDesc, setSortDesc] = useState(true);

    // กันไม่ให้เขียนทับค่าที่เก็บไว้ด้วยค่าว่างตอน render แรก ก่อนจะกู้ค่าเดิมขึ้นมาสำเร็จ
    // ยังกันไม่ให้ยิง fetch แรกด้วยค่า default ที่ไม่ตรงกับที่บันทึกไว้ (รอ restore เสร็จก่อนค่อย fetch ครั้งแรก)
    const [filtersRestored, setFiltersRestored] = useState(false);
    const latestFiltersRef = useRef<CollectorFilterState | null>(null);

    // หน่วงคำค้นหาก่อนยิง API — ทุกตัวอักษรที่พิมพ์คือ query DB ใหม่ ไม่ใช่การกรองในหน่วยความจำ
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedFilter(globalFilter), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [globalFilter]);

    // กู้ตัวกรองที่ค้างไว้ตอนกลับมาจากหน้ารายละเอียด — กู้ใน effect ไม่ใช่ initial state เพื่อเลี่ยง
    // hydration mismatch (sessionStorage ไม่มีตอน SSR)
    useEffect(() => {
        const saved = readCollectorFilters();
        if (saved) {
            setShowOnlyMine(saved.showOnlyMine);
            setGlobalFilter(saved.globalFilter);
            setDebouncedFilter(saved.globalFilter);
            setSelectedStatuses(saved.selectedStatuses);
            setSelectedReviewStatuses(saved.selectedReviewStatuses);
            setStartDate(saved.startDate);
            setEndDate(saved.endDate);
            setSortDesc(saved.sortDesc);
            setPage(saved.page);
            setPageSize(saved.pageSize);
        }
        setFiltersRestored(true);
    }, []);

    useEffect(() => {
        if (!filtersRestored || !currentUser) return;

        // ยกเลิก request เก่าเวลาสลับ filter/หน้าเร็วๆ — กัน response เก่าที่มาช้ากว่ามาทับผลลัพธ์ปัจจุบัน
        const controller = new AbortController();
        setLoading(true);

        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: sortDesc ? "desc" : "asc" });
        if (debouncedFilter) params.set("search", debouncedFilter);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        selectedStatuses.forEach((s) => params.append("status", s));
        selectedReviewStatuses.forEach((s) => params.append("review", s));
        // "เฉพาะของฉัน" มีความหมายเฉพาะ admin (เลือกดูของตัวเอง vs ดูทุกคน) — collector เห็นแค่ของตัวเองอยู่แล้วจาก API เสมอ
        if (currentUser.role === "admin" && showOnlyMine) params.set("mine", "true");

        fetch(`/api/samples?${params.toString()}`, {
            headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
            signal: controller.signal,
        })
            .then((res) => {
                if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลประวัติผลน้ำได้");
                return res.json();
            })
            .then((data) => {
                // ไม่มีฟิลด์นี้ (API เวอร์ชันเก่า) ถือว่าไม่มีสูตร ป้ายจะใช้ชื่อย่อแทน ไม่ล้ม
                setParameterFormulas(data.parameterFormulas && typeof data.parameterFormulas === "object" ? data.parameterFormulas : {});

                const items = Array.isArray(data.items) ? data.items : [];
                const mapped: CollectorSample[] = items.map((s: any) => ({
                    id: s.id,
                    locationId: s.locationId,
                    status: s.status,
                    collectedAt: s.collectionTime,
                    collectedBy: s.collectorId,
                    imageUrl: s.rawImageUrl,
                    imagePlotUrl: s.analyzedPlotUrl,
                    isDeleted: s.isDeleted,
                    updatedBy: s.lastModifiedBy,
                    sessionGroup: s.sessionGroup,

                    ...s,

                    location: s.location
                        ? {
                              id: s.locationId,
                              name: s.location.name,
                              organization: s.location.organization,
                              province: s.location.province,
                              district: s.location.district,
                              subdistrict: s.location.subdistrict,
                              zipcode: s.location.zipcode,
                          }
                        : null,
                }));
                setSamples(mapped);
                setTotal(data.total ?? 0);
                setTotalPages(data.totalPages ?? 0);

                // หน้าที่เปิดอยู่อาจเกินจำนวนจริงหลังตัวกรองเปลี่ยน (เช่น กู้ค่าหน้า 5 มาจาก storage
                // แต่ค้นหาแล้วเหลือแค่ 2 หน้า) — เลื่อนไปหน้าสุดท้ายที่ยังมีจริง
                if (data.totalPages > 0 && page > data.totalPages) {
                    setPage(data.totalPages);
                } else if (data.totalPages === 0 && page !== 1) {
                    setPage(1);
                }
            })
            .catch((err) => {
                if (err.name === "AbortError") return;
                console.error(err);
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtersRestored, currentUser, page, pageSize, sortDesc, debouncedFilter, startDate, endDate, JSON.stringify(selectedStatuses), JSON.stringify(selectedReviewStatuses), showOnlyMine]);

    // เก็บตัวกรองปัจจุบันทุกครั้งที่เปลี่ยน
    // หน่วงไว้เพราะ sessionStorage.setItem เป็น API แบบ synchronous — ถ้าเขียนทุกตัวอักษรที่พิมพ์ในช่องค้นหา
    // จะไปบล็อก main thread ถี่ๆ บนเครื่องช้า และเราไม่ได้ต้องการความสดระดับ keystroke อยู่แล้ว
    useEffect(() => {
        if (!filtersRestored) return;
        const payload: CollectorFilterState = { showOnlyMine, globalFilter, selectedStatuses, selectedReviewStatuses, startDate, endDate, sortDesc, page, pageSize };
        latestFiltersRef.current = payload;

        const timer = setTimeout(() => writeCollectorFilters(payload), SAVE_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [filtersRestored, showOnlyMine, globalFilter, selectedStatuses, selectedReviewStatuses, startDate, endDate, sortDesc, page, pageSize]);

    // เขียนค่าล่าสุดทิ้งไว้ตอนออกจากหน้า — ถ้าผู้ใช้เปลี่ยนตัวกรองแล้วกดดูรายละเอียดภายในช่วงหน่วง
    // cleanup ด้านบนจะล้าง timer ทิ้งก่อนได้เขียน การเปลี่ยนครั้งสุดท้ายจะหายไปเฉยๆ
    useEffect(() => {
        return () => {
            if (latestFiltersRef.current) writeCollectorFilters(latestFiltersRef.current);
        };
    }, []);

    /* ─── Handlers ───

       ตัวกรองทุกตัวทำงานฝั่ง server การเปลี่ยนค่าจึงต้องดีดกลับหน้า 1 เสมอ
       ไม่งั้นจะค้างอยู่หน้าที่ชุดผลลัพธ์ใหม่ไม่มี แล้วเห็นรายการว่าง

       ต้องห่อ setter ทุกตัวแบบนี้ ห้ามย้ายกลับไปเป็น effect ที่เฝ้าค่าตัวกรองแล้วสั่ง setPage(1):
       effect แบบนั้นจะยิงตอน filtersRestored พลิกเป็น true ด้วย (ค่าตัวกรองเปลี่ยนพร้อมกันทั้งชุด
       ในการกู้ค่ารอบเดียว) แล้วทับเลขหน้าที่เพิ่งกู้มาจาก sessionStorage ทิ้งทุกครั้ง
       — การจำหน้าที่เปิดค้างไว้ตอนกลับจากหน้ารายละเอียดจะพังเงียบ ๆ
       อีกข้อคือกันยิง API ซ้ำสองรอบ (รอบหนึ่งด้วยเลขหน้าเดิม อีกรอบด้วยหน้า 1) */

    const changeShowOnlyMine = (v: boolean) => {
        setShowOnlyMine(v);
        setPage(1);
    };

    // รีเซ็ตหน้าทันทีที่พิมพ์ ไม่รอ debounce — ผู้ใช้เห็นหน้า 1 ของผลค้นหาเดิมก่อนชั่วครู่
    // ดีกว่าปล่อยให้ค้างหน้าลึกแล้วผลลัพธ์ใหม่ไม่มีหน้านั้น (request ที่ค้างถูก abort อยู่แล้ว)
    const changeGlobalFilter = (v: string) => {
        setGlobalFilter(v);
        setPage(1);
    };

    // ติ๊กเลือก/เอาออกสถานะแบบ Multi-Select
    const handleStatusToggle = (status: string) => {
        setSelectedStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
        setPage(1);
    };

    // ติ๊กเลือก/เอาออกสถานะการตรวจสอบแบบ Multi-Select
    const handleReviewStatusToggle = (reviewStatus: string) => {
        setSelectedReviewStatuses((prev) => (prev.includes(reviewStatus) ? prev.filter((s) => s !== reviewStatus) : [...prev, reviewStatus]));
        setPage(1);
    };

    const changeStartDate = (v: string) => {
        setStartDate(v);
        setPage(1);
    };

    const changeEndDate = (v: string) => {
        setEndDate(v);
        setPage(1);
    };

    const clearDateRange = () => {
        setStartDate("");
        setEndDate("");
        setPage(1);
    };

    const toggleSortDirection = () => {
        setSortDesc((prev) => !prev);
        setPage(1);
    };

    // เปลี่ยนจำนวนแถวต่อหน้า = เลขหน้าเดิมชี้ไปคนละชุด (เช่น อยู่หน้า 8 ที่ 10 แถว แล้วสลับเป็น 30 แถวซึ่งเหลือ 3 หน้า)
    const changePageSize = (size: number) => {
        setPageSize(size);
        setPage(1);
    };

    return {
        samples,
        loading,
        total,
        page,
        totalPages,
        setPage,
        pageSize,
        changePageSize,
        parameterFormulas,
        showOnlyMine,
        // ทุก setter ที่ส่งออกไปเป็นตัวที่ห่อ setPage(1) ไว้แล้ว — ฝั่งหน้าเว็บไม่ต้องรีเซ็ตหน้าเอง
        setShowOnlyMine: changeShowOnlyMine,
        globalFilter,
        setGlobalFilter: changeGlobalFilter,
        selectedStatuses,
        handleStatusToggle,
        selectedReviewStatuses,
        handleReviewStatusToggle,
        startDate,
        setStartDate: changeStartDate,
        endDate,
        setEndDate: changeEndDate,
        sortDesc,
        toggleSortDirection,
        clearDateRange,
    };
}
