"use client";

/**
 * @fileoverview Client-side GPS auto-tracking user preference and permission management
 *
 * [TH] โมดูลจัดการค่าความชอบการติดตามตำแหน่ง GPS อัตโนมัติและสถานะสิทธิ์การเข้าถึงพิกัด
 * [EN] Client-side GPS auto-tracking user preferences and browser geolocation permission management
 *
 * @description
 * [TH] จัดเก็บค่าความชอบการเปิด/ปิด GPS Auto Track ใน localStorage (เครื่องต่อเครื่อง)
 * พร้อมตรวจสอบสิทธิ์ Geolocation ของเบราว์เซอร์ และปิดสวิตช์อัตโนมัติหากผู้ใช้ถอนสิทธิ์
 * [EN] Manages persistent auto-track preferences in localStorage and handles browser geolocation permission resolution.
 *
 * @module lib/gpsAutoTrack
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @created 2026-07-20
 * @modified 2026-07-20
 *
 * @history
 * - 2026-07-20 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: เพิ่มการจัดการตั้งค่า GPS Auto Track ผ่าน localStorage
 */

/* ตั้งค่า "ติดตาม GPS อัตโนมัติเมื่อเข้าหน้าแผนที่" — เก็บฝั่ง client เหมือน theme
   เพราะเป็นค่าความชอบต่อเครื่อง ไม่ใช่ข้อมูลผู้ใช้ที่ต้อง sync ข้ามอุปกรณ์ */

const STORAGE_KEY = "gpsAutoTrack";

/**
 * [TH] อ่านค่าการตั้งค่าติดตาม GPS อัตโนมัติจาก localStorage (คืน null หากยังไม่เคยตั้งค่า)
 * [EN] Reads the user's manual auto-track setting from localStorage (returns null if unconfigured)
 *
 * @function readAutoTrackSetting
 * @returns {boolean | null} สถานะเปิด/ปิด หรือ null
 */
export function readAutoTrackSetting(): boolean | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : raw === "true";
}

/**
 * [TH] บันทึกค่าการตั้งค่าติดตาม GPS อัตโนมัติลงใน localStorage
 * [EN] Writes the auto-track setting value to localStorage
 *
 * @function writeAutoTrackSetting
 * @param {boolean} value - สถานะที่ต้องการบันทึก (true = เปิด, false = ปิด)
 * @returns {void}
 */
export function writeAutoTrackSetting(value: boolean) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, String(value));
}

/**
 * [TH] ตรวจสอบสถานะสิทธิ์ Geolocation ของเบราว์เซอร์ผ่าน Permissions API
 * [EN] Queries current browser geolocation permission state via the Permissions API
 *
 * @async
 * @function queryGeolocationState
 * @returns {Promise<PermissionState | null>} สถานะสิทธิ์ ('granted' | 'prompt' | 'denied') หรือ null
 */
export async function queryGeolocationState(): Promise<PermissionState | null> {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;
    try {
        const status = await navigator.permissions.query({ name: "geolocation" });
        return status.state;
    } catch {
        return null;
    }
}

/**
 * [TH] สรุปค่าเปิด/ปิดติดตาม GPS ที่ควรใช้งานจริง (ยึดค่าที่ผู้ใช้ตั้งไว้ก่อน หากยังไม่เคยตั้งจะดูจากสิทธิ์ตำแหน่ง)
 * [EN] Resolves effective auto-track state by prioritizing user preference over browser permission defaults
 *
 * @async
 * @function resolveAutoTrack
 * @returns {Promise<boolean>} สถานะการติดตาม GPS ที่ควรทำงาน
 */
export async function resolveAutoTrack(): Promise<boolean> {
    const stored = readAutoTrackSetting();
    if (stored !== null) return stored;
    return (await queryGeolocationState()) === "granted";
}

/**
 * [TH] ปิดสวิตช์ติดตามอัตโนมัติใน localStorage เมื่อผู้ใช้ปฏิเสธสิทธิ์ตำแหน่ง เพื่อไม่ให้ UI แสดงสถานะผิด
 * [EN] Automatically disables the stored setting when geolocation permission is denied by the user
 *
 * @function disableAutoTrackAfterDenial
 * @returns {void}
 */
export function disableAutoTrackAfterDenial() {
    if (readAutoTrackSetting() === true) writeAutoTrackSetting(false);
}
