"use client";

/**
 * @file lib/navEvents.ts
 * @project Water Monitoring Project
 * @module Navigation / Event Bus
 * @description
 * [TH] Event Bus น้ำหนักเบา (Lightweight Window Event Bus) สำหรับแจ้งเตือนให้ Navbar รีเฟรชสถานะจุดแจ้งเตือนสีแดง (Notification Dots)
 * เมื่อมีการเปลี่ยนสถานะคำร้อง (อนุมัติ, ปฏิเสธ, ทำเครื่องหมายว่าอ่านแล้ว) โดยไม่ต้องรีโหลดหน้าเว็บ
 * เนื่องจาก Navbar ถูกฝังอยู่ใน Layout ระดับบนสุด จึงไม่ remount เมื่อมีการเปลี่ยนเส้นทางหน้าเว็บ
 *
 * [EN] Lightweight client-side DOM event bus dispatching refresh signals to Navbar notification badge dots.
 * Enables reactive badge recalculation on review or approval status mutations without requiring full page reload,
 * since the Navbar resides in root layout and does not remount across Next.js route transitions.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-15
 * @modified 2026-07-15
 * @version 1.0.0
 * @license Proprietary
 *
 * @see {@link /components/Navbar.tsx} Navbar component consuming this event bus
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-15)
 *
 * @lastModified 2026-07-15
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-07-15 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: เพิ่มฟังก์ชันแจ้งเตือน
 */

// Event bus แบบเบา ๆ ให้หน้าที่เปลี่ยนสถานะคำร้อง (อนุมัติ/ปฏิเสธ/รับทราบ) สั่ง Navbar
// รีเฟรชจุดแดงได้ทันที โดยไม่ต้องรีโหลดหน้าเว็บ — Navbar อยู่ใน layout เลยไม่ remount ตอนเปลี่ยนหน้า
// จึงต้องมีสัญญาณบอกให้ fetch ใหม่เอง (แทนที่จะพึ่ง mount/focus อย่างเดียว)
const NAV_DOTS_REFRESH_EVENT = "nav-dots-refresh";

/**
 * [TH] ส่งสัญญาณ (Dispatch Event) ให้ทุกคอมโพเนนต์ที่ฟังอยู่ (เช่น Navbar) ดำึงข้อมูลและรีเฟรชจุดแจ้งเตือนใหม่ทันที
 * [EN] Dispatches a custom window event notifying listeners (such as Navbar) to refetch notification badge counters
 *
 * @function refreshNavDots
 * @returns {void}
 *
 * @example
 * // หลังอนุมัติคำขอตรวจทานสำเร็จ
 * await approveReviewRequest(id);
 * refreshNavDots();
 */
export function refreshNavDots(): void {
    window.dispatchEvent(new Event(NAV_DOTS_REFRESH_EVENT));
}

/**
 * [TH] ผูก Event Listener เพื่อรอรับสัญญาณการรีเฟรชจุดแจ้งเตือน และคืนค่าฟังก์ชัน Unsubscribe สำหรับ Clean up ใน useEffect
 * [EN] Subscribes to notification dots refresh events, returning an unsubscribe cleanup callback for useEffect hooks
 *
 * @function onNavDotsRefresh
 * @param {() => void} handler - ฟังก์ชัน Callback ที่จะถูกเรียกเมื่อมีสัญญาณรีเฟรช
 * @returns {() => void} Cleanup function สำหรับถอด Event Listener ออกเมื่อคอมโพเนนต์ unmount
 *
 * @example
 * useEffect(() => {
 *     return onNavDotsRefresh(() => {
 *         fetchBadgeCounts();
 *     });
 * }, []);
 */
export function onNavDotsRefresh(handler: () => void): () => void {
    window.addEventListener(NAV_DOTS_REFRESH_EVENT, handler);
    return () => window.removeEventListener(NAV_DOTS_REFRESH_EVENT, handler);
}
