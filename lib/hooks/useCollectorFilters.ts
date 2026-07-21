import { useEffect, useMemo, useRef, useState } from "react";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { readCollectorFilters, writeCollectorFilters, type CollectorFilterState } from "@/lib/collectorFilters";
import type { CurrentUser } from "@/lib/store";

export interface CollectorSample {
    id: number;
    locationId: number;
    status: "safe" | "warning" | "danger";
    collectedAt: string | Date;
    collectedBy: number;
    imageUrl?: string | null;
    imagePlotUrl?: string | null;
    isDeleted: boolean;
    updatedBy?: number | null;
    // สถานะการตรวจสอบ (คนละมิติกับ status คุณภาพน้ำ) — มีค่าเฉพาะรายการที่ confidence ต่ำกว่าเกณฑ์เท่านั้น
    reviewStatus?: "PENDING" | "APPROVED";
    location?: {
        id: number;
        name: string;
        organization: string;
    } | null;
    // รองรับคุณสมบัติค่าวัดเคมีจากหลังบ้านแบบ Dynamic ทุกคีย์สารใน DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

interface UseCollectorFiltersArgs {
    samples: CollectorSample[];
    currentUser: CurrentUser | null;
    /** ยังโหลดข้อมูลไม่เสร็จ — ใช้รอจังหวะที่ปลอดภัยในการคืนหน้าที่เปิดค้างไว้ */
    loading: boolean;
}

const SAVE_DEBOUNCE_MS = 300;

/* ตัวกรองทั้งหมดของหน้าประวัติผลตรวจ (/collector) รวมถึงการจำค่าไว้ข้ามการเปิดหน้ารายละเอียด

   รวมไว้ที่เดียวเพราะลำดับการทำงานของ effect ในนี้ผูกกันแน่น (ดูคอมเมนต์แต่ละจุด)
   ถ้ากระจายอยู่ในหน้า 700 บรรทัด การย้ายบล็อกโค้ดสลับที่จะทำให้การกู้ค่าพังเงียบๆ */
export function useCollectorFilters({ samples, currentUser, loading }: UseCollectorFiltersArgs) {
    const [showOnlyMine, setShowOnlyMine] = useState(true);

    // ─── TanStack Table States ───
    const [globalFilter, setGlobalFilter] = useState("");
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [sorting, setSorting] = useState<SortingState>([{ id: "collectedAt", desc: true }]);

    // ─── State สำหรับระบบ Multi-Select สถานะ (เก็บเป็น Array) ───
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

    // ─── States สำหรับระบบควบคุมช่วงเวลา (Date Range) ───
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // กันไม่ให้เขียนทับค่าที่เก็บไว้ด้วยค่าว่างตอน render แรก ก่อนจะกู้ค่าเดิมขึ้นมาสำเร็จ
    const [filtersRestored, setFiltersRestored] = useState(false);
    // ค่าที่อ่านจาก storage รอบเดียวตอน mount — ใช้ร่วมกันระหว่างการกู้ตัวกรองกับการกู้หน้า
    const savedFiltersRef = useRef<CollectorFilterState | null>(null);
    // ค่าตัวกรองล่าสุด สำหรับเขียนทิ้งไว้ตอน unmount
    const latestFiltersRef = useRef<CollectorFilterState | null>(null);
    const pageRestoredRef = useRef(false);

    // ─── 1. เตรียมข้อมูล Data Source หลัก ───
    // สวิตช์ "เฉพาะของฉัน" มีความหมายเฉพาะ admin เท่านั้น (เลือกดูของตัวเอง vs ดูทุกคน)
    //   collector: API กรองเป็นของตัวเองอยู่แล้วเสมอ ไม่ต้องมีสวิตช์ก็เห็นแค่ของตัวเอง
    //   officer: สิทธิ์อ่านอย่างเดียว ต้องเห็นข้อมูลทุกคนเสมอ ไม่มีแนวคิด "ของฉัน" เพราะไม่ได้เป็นคนเก็บตัวอย่าง
    const tableData = useMemo(() => {
        return samples
            .filter((s) => !s.isDeleted)
            .filter((s) => {
                if (currentUser?.role === "admin") {
                    return !showOnlyMine || s.collectedBy === currentUser?.id;
                }
                return s.collectedBy === currentUser?.id;
            });
    }, [samples, showOnlyMine, currentUser]);

    // ─── 2. นิยามโครงสร้าง Columns พร้อม Custom Filter ฟังก์ชัน ───
    const columns = useMemo(
        () => [
            {
                accessorKey: "status",
                header: "สถานะ",
                // ฟังก์ชันคัดกรองแบบ Multi-select ตรวจสอบจาก Array
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                filterFn: (row: any, columnId: string, filterValue: string[]) => {
                    if (!filterValue || filterValue.length === 0) return true;
                    const rowStatus = row.getValue(columnId) as string;
                    return filterValue.includes(rowStatus.toLowerCase());
                },
            },
            {
                accessorFn: (row: CollectorSample) => row.location?.name || "",
                id: "locationName",
                header: "ชื่อสถานที่",
            },
            {
                accessorKey: "collectedAt",
                header: "วันที่เก็บตัวอย่าง",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                filterFn: (row: any, columnId: string, filterValue: [string, string]) => {
                    const [start, end] = filterValue;
                    if (!start && !end) return true;

                    const rowDateStr = new Date(row.getValue(columnId)).toISOString().split("T")[0];
                    const rowTime = new Date(rowDateStr).getTime();

                    const startTime = start ? new Date(start).getTime() : -Infinity;
                    const endTime = end ? new Date(end).getTime() : Infinity;

                    return rowTime >= startTime && rowTime <= endTime;
                },
            },
        ],
        [],
    );

    // ─── 3. เรียกใช้งาน TanStack Table Engine ───
    const table = useReactTable({
        data: tableData,
        columns,
        state: {
            globalFilter,
            columnFilters,
            sorting,
        },
        onGlobalFilterChange: setGlobalFilter,
        onColumnFiltersChange: setColumnFilters,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            pagination: {
                pageSize: 10,
            },
        },
    });

    const pageIndex = table.getState().pagination.pageIndex;

    /* ─── ลำดับของ effect ตั้งแต่นี้ลงไปมีผลต่อความถูกต้อง ห้ามสลับที่ ───
       (ก) วันที่ และ (ข) สถานะ ส่งค่าเข้า TanStack และดีด pageIndex กลับเป็น 0
       (ค) กู้ค่าจาก storage
       (ง) กู้หน้าที่เปิดค้างไว้ ต้องอยู่หลัง (ก)/(ข) ไม่งั้นถูกดีดกลับเป็นหน้าแรก */

    // (ก) ส่งฟิลเตอร์ช่วงวันที่เข้า TanStack
    useEffect(() => {
        if (startDate || endDate) {
            table.getColumn("collectedAt")?.setFilterValue([startDate, endDate]);
        } else {
            table.getColumn("collectedAt")?.setFilterValue(undefined);
        }
        table.setPageIndex(0);
    }, [startDate, endDate, table]);

    // (ข) ส่งฟิลเตอร์สถานะเข้า TanStack — ทางเข้าทางเดียวทั้งตอนผู้ใช้กดเลือกและตอนกู้ค่าคืน
    useEffect(() => {
        table.getColumn("status")?.setFilterValue(selectedStatuses.length === 0 ? undefined : selectedStatuses);
    }, [selectedStatuses, table]);

    // (ค) กู้ตัวกรองที่ค้างไว้ตอนกลับมาจากหน้ารายละเอียด
    // กู้ใน effect ไม่ใช่ initial state เพื่อเลี่ยง hydration mismatch (sessionStorage ไม่มีตอน SSR)
    // ระหว่างนี้หน้ายังโชว์ skeleton รอโหลดข้อมูลอยู่ ผู้ใช้จึงไม่เห็นตารางกะพริบก่อนถูกกรอง
    useEffect(() => {
        const saved = readCollectorFilters();
        savedFiltersRef.current = saved;
        if (saved) {
            setShowOnlyMine(saved.showOnlyMine);
            setGlobalFilter(saved.globalFilter);
            setSelectedStatuses(saved.selectedStatuses);
            setStartDate(saved.startDate);
            setEndDate(saved.endDate);
            setSorting([{ id: "collectedAt", desc: saved.sortDesc }]);
        }
        setFiltersRestored(true);
    }, []);

    // (ง) คืนหน้าที่เปิดค้างไว้ — ต้องรอจนข้อมูลโหลดเสร็จ ไม่งั้น TanStack จะหนีบ pageIndex กลับเป็น 0
    // เพราะตอนนั้นตารางยังไม่มีแถวให้แบ่งหน้าเลย
    useEffect(() => {
        if (!filtersRestored || loading || pageRestoredRef.current) return;
        pageRestoredRef.current = true;
        const saved = savedFiltersRef.current;
        if (saved && saved.pageIndex > 0) table.setPageIndex(saved.pageIndex);
    }, [filtersRestored, loading, table]);

    // เก็บตัวกรองปัจจุบันทุกครั้งที่เปลี่ยน
    // หน่วงไว้เพราะ sessionStorage.setItem เป็น API แบบ synchronous — ถ้าเขียนทุกตัวอักษรที่พิมพ์ในช่องค้นหา
    // จะไปบล็อก main thread ถี่ๆ บนเครื่องช้า และเราไม่ได้ต้องการความสดระดับ keystroke อยู่แล้ว
    useEffect(() => {
        if (!filtersRestored) return;
        const payload: CollectorFilterState = {
            showOnlyMine,
            globalFilter,
            selectedStatuses,
            startDate,
            endDate,
            sortDesc: !!sorting[0]?.desc,
            pageIndex,
        };
        latestFiltersRef.current = payload;

        const timer = setTimeout(() => writeCollectorFilters(payload), SAVE_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [filtersRestored, showOnlyMine, globalFilter, selectedStatuses, startDate, endDate, sorting, pageIndex]);

    // เขียนค่าล่าสุดทิ้งไว้ตอนออกจากหน้า — ถ้าผู้ใช้เปลี่ยนตัวกรองแล้วกดดูรายละเอียดภายในช่วงหน่วง
    // cleanup ด้านบนจะล้าง timer ทิ้งก่อนได้เขียน การเปลี่ยนครั้งสุดท้ายจะหายไปเฉยๆ
    useEffect(() => {
        return () => {
            if (latestFiltersRef.current) writeCollectorFilters(latestFiltersRef.current);
        };
    }, []);

    // ─── Handlers ───

    // ติ๊กเลือก/เอาออกสถานะแบบ Multi-Select — ค่าถูกส่งต่อเข้า TanStack ด้วย effect (ข)
    const handleStatusToggle = (status: string) => {
        setSelectedStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
        table.setPageIndex(0);
    };

    const clearDateRange = () => {
        setStartDate("");
        setEndDate("");
    };

    const toggleSortDirection = () => {
        const isDesc = sorting[0]?.id === "collectedAt" && sorting[0]?.desc;
        setSorting([{ id: "collectedAt", desc: !isDesc }]);
    };

    return {
        table,
        showOnlyMine,
        setShowOnlyMine,
        globalFilter,
        setGlobalFilter,
        selectedStatuses,
        handleStatusToggle,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        sorting,
        toggleSortDirection,
        clearDateRange,
    };
}
