"use client";

/* จำตัวกรองของหน้าประวัติผลตรวจ (/collector) ไว้ชั่วคราว
   ปัญหาเดิม: กดดูรายละเอียดตัวอย่างแล้วกดย้อนกลับ component ถูก unmount ทิ้ง ตัวกรองที่ตั้งไว้จึงหายหมด
   ใช้ sessionStorage เพราะได้ผลกับทุกวิธีกลับหน้า (ปุ่มย้อนกลับในแอป, back ของเบราว์เซอร์, refresh)
   และล้างตัวเองเมื่อปิดแท็บ — ไม่ค้างข้ามวันเหมือน localStorage */

const STORAGE_KEY = "collectorFilters";

export interface CollectorFilterState {
    showOnlyMine: boolean;
    globalFilter: string;
    selectedStatuses: string[];
    /** สถานะการตรวจสอบเป็นตัวพิมพ์ใหญ่ (PENDING/APPROVED/EDITED_APPROVED/REJECTED) ตรงกับค่าที่ /api/samples ส่งกลับมา */
    selectedReviewStatuses: string[];
    startDate: string;
    endDate: string;
    sortDesc: boolean;
    /** เลขหน้าแบบ 1-based ผูกกับ query param `page` ของ /api/samples (ไม่ใช่ pageIndex 0-based ของ TanStack เหมือนเดิม) */
    page: number;
}

export function readCollectorFilters(): CollectorFilterState | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);

        // ค่าที่อ่านมาจาก storage อาจเป็นของเวอร์ชันเก่าหรือถูกแก้มือ — คัดชนิดข้อมูลทีละฟิลด์ก่อนใช้
        return {
            showOnlyMine: typeof parsed.showOnlyMine === "boolean" ? parsed.showOnlyMine : true,
            globalFilter: typeof parsed.globalFilter === "string" ? parsed.globalFilter : "",
            selectedStatuses: Array.isArray(parsed.selectedStatuses) ? parsed.selectedStatuses.filter((s: unknown) => typeof s === "string") : [],
            // ค่าที่บันทึกไว้ก่อนมีตัวกรองการตรวจสอบจะไม่มีคีย์นี้ — ถือว่าไม่ได้กรอง
            selectedReviewStatuses: Array.isArray(parsed.selectedReviewStatuses) ? parsed.selectedReviewStatuses.filter((s: unknown) => typeof s === "string") : [],
            startDate: typeof parsed.startDate === "string" ? parsed.startDate : "",
            endDate: typeof parsed.endDate === "string" ? parsed.endDate : "",
            sortDesc: typeof parsed.sortDesc === "boolean" ? parsed.sortDesc : true,
            page: Number.isInteger(parsed.page) && parsed.page >= 1 ? parsed.page : 1,
        };
    } catch {
        return null;
    }
}

export function writeCollectorFilters(state: CollectorFilterState) {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        /* storage เต็มหรือถูกปิดใช้งาน (โหมดส่วนตัวบางเบราว์เซอร์) — ไม่ใช่เรื่องคอขาดบาดตาย ปล่อยผ่าน */
    }
}
