/**
 * @file GpsAutoTrackToggle.tsx
 * @project Water Monitoring Project
 * @module UI / Map / Settings
 * @description
 * สวิตช์เปิด/ปิดการติดตามตำแหน่ง GPS อัตโนมัติเมื่อเข้าหน้าแผนที่ ค่าเก็บผ่าน `lib/gpsAutoTrack`
 * ตอนเปิดจะขอพิกัดจริงทันทีในจังหวะที่ผู้ใช้กด (จังหวะเดียวที่ permission prompt เด้งได้)
 * ถ้าไม่ผ่านจะคงสวิตช์ไว้ที่ปิดและแจ้งวิธีแก้ ปุ่มลูกศรบนแผนที่ยังดึงตำแหน่งเองได้เสมอ
 *
 * Toggle for automatic GPS tracking on the map page. Requests geolocation on the
 * user's tap (the only moment a permission prompt can appear); stays off on failure.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-07-21
 * @version 1.0.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-07-24)
 *
 * @lastModified 2026-07-24 16:24
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-07-21 14:27 by Nopparut U. - สร้างสวิตช์ GPS อัตโนมัติ
 * - 2026-07-24 16:24 by Pachara P. - ปรับ UI ให้เข้ากับหน้า manage
 *
 * @client-side ทำงานฝั่ง Client ('use client') ใช้ navigator.geolocation
 * @see docs/skills/SKILL_line_liff_ux.md
 * @license Private / Proprietary
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { LocateFixed, LocateOff } from "lucide-react";
import { alertError } from "@/lib/swal";
import { resolveAutoTrack, writeAutoTrackSetting } from "@/lib/gpsAutoTrack";

/**
 * สวิตช์ GPS อัตโนมัติ ไม่รับ props อ่านค่าเริ่มต้นเองจาก `resolveAutoTrack()`
 * ระหว่างยังอ่านค่าไม่เสร็จจะ render placeholder ขนาดเท่าปุ่มจริง
 */
export default function GpsAutoTrackToggle() {
    const [enabled, setEnabled] = useState<boolean | null>(null); // null = ยังอ่านค่าไม่เสร็จ
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        resolveAutoTrack().then((value) => {
            if (!cancelled) setEnabled(value);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const handleToggle = useCallback(() => {
        if (enabled === null || busy) return;

        if (enabled) {
            writeAutoTrackSetting(false);
            setEnabled(false);
            return;
        }

        if (!navigator.geolocation) {
            alertError("เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง");
            return;
        }

        /* ยิงขอพิกัดจริงในจังหวะที่ผู้ใช้กดปุ่มเอง — เป็นจังหวะเดียวที่ permission prompt เด้งได้
           ถ้าไม่ผ่านแปลว่าเปิดโหมดอัตโนมัติไม่ได้ จึงคงสวิตช์ไว้ที่ปิดแล้วบอกวิธีแก้ */
        setBusy(true);
        navigator.geolocation.getCurrentPosition(
            () => {
                writeAutoTrackSetting(true);
                setEnabled(true);
                setBusy(false);
            },
            (err) => {
                console.warn("Geolocation error:", err);
                writeAutoTrackSetting(false);
                setEnabled(false);
                setBusy(false);
                if (err.code === err.PERMISSION_DENIED) {
                    alertError("เปิดการติดตามอัตโนมัติไม่ได้", "กรุณาอนุญาตให้เว็บไซต์เข้าถึงตำแหน่งในตั้งค่าเบราว์เซอร์หรือแอป LINE ก่อน แล้วลองเปิดสวิตช์นี้อีกครั้ง");
                } else {
                    alertError("ไม่สามารถดึงตำแหน่งปัจจุบันได้", "กรุณาลองใหม่อีกครั้ง");
                }
            },
            { enableHighAccuracy: true },
        );
    }, [enabled, busy]);

    // Placeholder ต้องกว้างเท่าปุ่มจริง กัน layout ขยับตอน mount (แนวเดียวกับ ThemeToggle)
    if (enabled === null) {
        return (
            <div className="flex items-center gap-2.5 h-10 px-5 rounded-md bg-card-general border border-border opacity-50">
                <div className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold whitespace-nowrap invisible">GPS อัตโนมัติ</span>
            </div>
        );
    }

    return (
        <button
            onClick={handleToggle}
            disabled={busy}
            aria-pressed={enabled}
            title={enabled ? "ปิดการติดตามตำแหน่งอัตโนมัติเมื่อเข้าหน้าแผนที่" : "เปิดการติดตามตำแหน่งอัตโนมัติเมื่อเข้าหน้าแผนที่"}
            className="flex items-center gap-2.5 h-10 px-5 rounded-xl bg-card-general border border-border text-text-primary transition-all duration-75 active:scale-[0.96] cursor-pointer disabled:opacity-50 disabled:cursor-wait"
        >
            <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                {enabled ? <LocateFixed size={16} className="text-text" /> : <LocateOff size={16} className="text-text-muted" />}
            </div>

            <span className="text-xs font-semibold text-text whitespace-nowrap">GPS อัตโนมัติ</span>

            {/* จุดบอกสถานะ แทนการสลับข้อความ เพื่อให้ปุ่มกว้างคงที่ตลอด */}
            <span className={`w-2 h-2 rounded-full shrink-0 ${enabled ? "bg-green-500" : "bg-text"}`} />
        </button>
    );
}
