"use client";

/**
 * @file lib/collectorFilters.ts
 * @project Water Monitoring Project
 * @module Collector / Filter Persistence (sessionStorage)
 * @description
 * [TH] โมดูลจัดการการจดจำสถานะตัวกรองของหน้าประวัติผลตรวจวัด (/collector) ผ่าน `sessionStorage`
 * ช่วยให้ผู้ใช้งานสามารถกดย้อนกลับจากหน้ารายละเอียดตัวอย่างน้ำ หรือรีเฟรชหน้าเว็บ โดยที่ตัวกรอง
 * (การค้นหา, สถานะคุณภาพน้ำ, สถานะการตรวจทาน, ช่วงวันที่, เลขหน้า, ขนาดหน้า) ไม่สูญหาย
 * พร้อมกลไกการ Validate ชนิดข้อมูลป้องกันข้อผิดพลาดจาก Schema เก่าที่ค้างอยู่ในสตอเรจ
 *
 * [EN] Module managing state persistence of collector sample history filters (/collector) via `sessionStorage`.
 * Preserves user filters (search query, water status, review status, date range, page, page size)
 * across browser back-navigations and refreshes without cross-session stale state risks.
 * Includes defensive schema validation to handle legacy storage formats gracefully.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-21
 * @modified 2026-09-09
 * @version 1.3.0
 * @license Proprietary
 *
 * @see {@link /app/collector/page.tsx} Collector sample history view
 * @see {@link /lib/hooks/useCollectorFilters.ts} Hook encapsulating this filter state
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-21)
 *
 * @lastModified 2026-09-09
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-09-09 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: แถบแบ่งหน้าใหม่ มีเลขหน้าและตัวเลือกจำนวนแถวต่อหน้า
 * - 2026-08-25 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: เพิ่มตัวกรองสถานะการตรวจสอบ
 * - 2026-07-27 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - perf: ทำ pagination หน้า collector
 * - 2026-07-21 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: แก้ตัวกรองหน้าดูประวัติ
 */

/* จำตัวกรองของหน้าประวัติผลตรวจ (/collector) ไว้ชั่วคราว
   ปัญหาเดิม: กดดูรายละเอียดตัวอย่างแล้วกดย้อนกลับ component ถูก unmount ทิ้ง ตัวกรองที่ตั้งไว้จึงหายหมด
   ใช้ sessionStorage เพราะได้ผลกับทุกวิธีกลับหน้า (ปุ่มย้อนกลับในแอป, back ของเบราว์เซอร์, refresh)
   และล้างตัวเองเมื่อปิดแท็บ — ไม่ค้างข้ามวันเหมือน localStorage */

const STORAGE_KEY = "collectorFilters";

/**
 * [TH] โครงสร้างสถานะตัวกรองในหน้าประวัติผลการตรวจวัดของผู้เก็บตัวอย่าง
 * [EN] Structure of collector sample history filter state
 */
export interface CollectorFilterState {
    /** [TH] กรองเฉพาะข้อมูลที่ตนเองเป็นผู้เก็บ | [EN] Filter strictly for user's own samples */
    showOnlyMine: boolean;
    /** [TH] ข้อความค้นหาทั่วไป (ชื่อสถานี, รหัสตัวอย่าง, ฯลฯ) | [EN] Global search keyword */
    globalFilter: string;
    /** [TH] รายการสถานะคุณภาพน้ำที่เลือกกรอง (SAFE, WARNING, DANGER) | [EN] Selected water quality statuses */
    selectedStatuses: string[];
    /** [TH] สถานะการตรวจสอบเป็นตัวพิมพ์ใหญ่ (PENDING/APPROVED/EDITED_APPROVED/REJECTED) | [EN] Selected review statuses */
    selectedReviewStatuses: string[];
    /** [TH] วันที่เริ่มต้น ("YYYY-MM-DD") | [EN] Start date */
    startDate: string;
    /** [TH] วันที่สิ้นสุด ("YYYY-MM-DD") | [EN] End date */
    endDate: string;
    /** [TH] เรียงลำดับจากใหม่สุดไปเก่าสุดหรือไม่ | [EN] Descending sort order flag */
    sortDesc: boolean;
    /** [TH] เลขหน้าแบบ 1-based ผูกกับ query param `page` | [EN] Current page index (1-based) */
    page: number;
    /** [TH] จำนวนแถวต่อหน้าที่เลือกแสดงผล | [EN] Rows per page */
    pageSize: number;
}

/**
 * [TH] อ่านสถานะตัวกรองของหน้าประวัติผู้เก็บตัวอย่างน้ำจาก `sessionStorage`
 * พร้อมตรวจสอบความถูกต้องของประเภทข้อมูลในแต่ละฟิลด์ (Type Sanitization) เพื่อป้องกันปัญหาจาก Schema เก่า
 *
 * [EN] Reads and validates saved collector filters from `sessionStorage`.
 * Sanitizes field types against schema drift or corrupted storage entries.
 *
 * @function readCollectorFilters
 * @returns {CollectorFilterState | null} สถานะตัวกรองที่กู้คืนมาได้ หรือ null หากไม่มีข้อมูลหรืออยู่ฝั่งเซิร์ฟเวอร์
 */
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
            // ค่าที่บันทึกไว้ก่อนมีดรอปดาวน์ "แถวต่อหน้า" จะไม่มีคีย์นี้ — ตกกลับไปใช้ค่าเริ่มต้นเดิม
            pageSize: Number.isInteger(parsed.pageSize) && parsed.pageSize >= 1 ? parsed.pageSize : 10,
        };
    } catch {
        return null;
    }
}

/**
 * [TH] บันทึกสถานะตัวกรองปัจจุบันของหน้าประวัติผู้เก็บตัวอย่างน้ำลงใน `sessionStorage`
 * ครอบ try/catch ป้องกันข้อผิดพลาดกรณีสตอเรจเต็มหรือเบราว์เซอร์บล็อกในโหมด Private
 *
 * [EN] Serializes and writes current collector filter state into `sessionStorage`.
 * Safely fails silently if quota is exceeded or browser private storage is blocked.
 *
 * @function writeCollectorFilters
 * @param {CollectorFilterState} state - ออบเจกต์สถานะตัวกรองปัจจุบันที่ต้องการบันทึก
 * @returns {void}
 */
export function writeCollectorFilters(state: CollectorFilterState): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        /* storage เต็มหรือถูกปิดใช้งาน (โหมดส่วนตัวบางเบราว์เซอร์) — ไม่ใช่เรื่องคอขาดบาดตาย ปล่อยผ่าน */
    }
}
