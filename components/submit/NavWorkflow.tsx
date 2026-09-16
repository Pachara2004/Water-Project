/**
 * @file NavWorkflow.tsx
 * @project Water Monitoring Project
 * @module UI / Submit / Navigation
 * @description
 * ส่วนนำทางของหน้า submit: sidebar บน desktop (ข้อมูล session และขั้นตอน) และปุ่ม "วิเคราะห์"
 * ที่กดได้เฉพาะเมื่อเปิดสารอย่างน้อยหนึ่งตัว มีภาพอัปโหลด เลือกสถานีแล้ว และดึงสภาพอากาศสำเร็จ
 * (weatherStatus = "ready") เพราะสภาพอากาศถูกบันทึกลงใบตรวจตอน save ถ้าดึงไม่ได้ตอนนี้ตอน save ก็จะเป็น null
 *
 * Submit-page navigation: desktop sidebar with session info/steps and the Analyze
 * button, which is gated on parameters, images, station and a ready weather fetch.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-07
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-14 – 2026-09-04)
 *
 * @lastModified 2026-09-07 10:48
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-07-07 15:30 by Pachara P. - แยกส่วนนำทางออกมาตอนปรับโครงสร้างไฟล์ submit
 * - 2026-07-14 12:25 by Nopparut U. - เพิ่มโหมดการส่งตัวอย่าง
 * - 2026-07-23 11:05 by Pachara P. - ปรับ UI ให้เข้ากับ desktop (sidebar)
 * - 2026-09-04 10:02 by Nopparut U. - บังคับให้ดึงสภาพอากาศสำเร็จก่อนจึงกดวิเคราะห์ได้
 * - 2026-09-07 10:48 by Pachara P. - ไม่บังคับส่งสองสารแม้เปิด 2 ช่อง มี validate บอก
 *
 * @client-side ไม่มี hook/state ใช้ได้ทั้ง Server และ Client Component
 * @license Private / Proprietary
 */

import { Loader2, Camera, Sparkles, MapPin, ToggleLeft, CloudOff, CloudAlert } from "lucide-react";
import { SubmitSteps } from "./SubmitSteps";

/** Props ของ DesktopSidebar */
interface DesktopSidebarProps {
    sessionId?: string | number;
    locationName?: string;
    currentUser?: { name?: string; email?: string };
    step: "upload" | "analyzing" | "results";
}

/**
 * Sidebar ซ้ายบน desktop (ซ่อนต่ำกว่า `md`) แสดง session / สถานี / ผู้เก็บ / วันที่ และขั้นตอนแนวตั้ง
 *
 * @param props - ดู {@link DesktopSidebarProps}
 */
export function DesktopSidebar({ sessionId, locationName, currentUser, step }: DesktopSidebarProps) {
    return (
        <aside className="hidden md:flex flex-col border-r border-border bg-card-general min-h-full w-52 shrink-0">
            <div className="px-4 py-4 border-b border-border space-y-2">
                <p className="font-mono text-xs uppercase tracking-widest text-text-muted font-bold">Session Info</p>
                {[
                    { key: "Session", val: sessionId ? `#${sessionId}` : "—" },
                    { key: "Station", val: locationName || "—" },
                    { key: "Collector", val: currentUser?.name || currentUser?.email || "—" },
                    { key: "Date", val: new Date().toLocaleDateString("th-TH") },
                    {
                        key: "Analysis",
                        val: step === "results" ? "Complete" : step === "analyzing" ? "Running…" : "Pending",
                        ok: step === "results",
                    },
                ].map(({ key, val, ok }) => (
                    <div key={key} className="flex justify-between items-center py-0.5 text-xs">
                        <span className="font-mono text-text-muted">{key}</span>
                        <span className={`font-semibold text-right max-w-[120px] truncate ${ok ? "text-text-safe" : "text-text"}`}>{val}</span>
                    </div>
                ))}
            </div>
            <div className="px-4 py-4 flex-1">
                <p className="font-mono text-xs uppercase tracking-widest text-text-muted font-bold mb-3">Workflow</p>
                <SubmitSteps step={step} orientation="vertical" />
            </div>
        </aside>
    );
}

/** สถานะการดึงสภาพอากาศของหน้า submit; ต้อง "ready" จึงวิเคราะห์ได้ */
export type WeatherStatus = "idle" | "loading" | "ready" | "unavailable" | "error";

/** Props ของ AnalyzeButton */
interface AnalyzeButtonProps {
    activeParameters: Array<{ id: string; [key: string]: any }>;
    imageFiles: Record<string, any>;
    currentLocationId: string | null;
    isRecommending?: boolean;
    /** ต้องเป็น "ready" เท่านั้นจึงกดวิเคราะห์ได้ — ค่าเริ่มต้น "idle" ทำให้ปุ่มปิดไว้ก่อนเมื่อยังไม่มีใครส่งสถานะมา */
    weatherStatus?: WeatherStatus;
    handleAnalyze: () => void;
}

/**
 * ปุ่มวิเคราะห์ พร้อมข้อความบอกเหตุผลเมื่อยังกดไม่ได้
 *
 * @param props - ดู {@link AnalyzeButtonProps}
 */
export function AnalyzeButton({ activeParameters = [], imageFiles = {}, currentLocationId, isRecommending, weatherStatus = "idle", handleAnalyze }: AnalyzeButtonProps) {
    const hasEnabledParam = activeParameters.length > 0;
    const uploadedCount = activeParameters.filter((p) => imageFiles[p.id] !== undefined).length;
    const hasAnyImageUploaded = uploadedCount > 0;
    // สภาพอากาศถูกบันทึกลงใบตรวจตอน save โดยอิงสถานี+เวลาชุดเดียวกับที่ preview ใช้
    // ถ้าดึงไม่ได้ตอนนี้ ตอน save ก็จะได้ null เหมือนกัน จึงกันไว้ตั้งแต่ต้นทาง
    const isWeatherReady = weatherStatus === "ready";

    return (
        <div className="flex flex-col gap-2">
            <button
                type="button"
                onClick={handleAnalyze}
                disabled={!hasAnyImageUploaded || !currentLocationId || isRecommending || !isWeatherReady}
                className="w-full py-3 px-4 min-h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-secondary hover:bg-primary text-white shadow-xs cursor-pointer"
            >
                {isRecommending ? (
                    <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>กำลังตรวจจับตำแหน่ง…</span>
                    </>
                ) : !hasEnabledParam ? (
                    <>
                        <ToggleLeft size={15} />
                        <span>เปิดสารที่ต้องการส่งตรวจก่อน</span>
                    </>
                ) : !currentLocationId ? (
                    <>
                        <MapPin size={15} />
                        <span>กรุณาเลือกสถานีก่อน</span>
                    </>
                ) : !hasAnyImageUploaded ? (
                    <>
                        <Camera size={15} />
                        <span>ถ่ายภาพอย่างน้อย 1 สาร</span>
                    </>
                ) : weatherStatus === "loading" ? (
                    <>
                        <Loader2 size={15} className="animate-spin" />
                        <span>กำลังดึงข้อมูลสภาพอากาศ…</span>
                    </>
                ) : weatherStatus === "unavailable" ? (
                    <>
                        <CloudOff size={15} />
                        <span>ไม่พบข้อมูลสภาพอากาศของเวลานี้</span>
                    </>
                ) : !isWeatherReady ? (
                    <>
                        <CloudAlert size={15} />
                        <span>ดึงข้อมูลสภาพอากาศไม่สำเร็จ</span>
                    </>
                ) : (
                    <>
                        <Sparkles size={15} />
                        <span>วิเคราะห์ด้วยข้อมูล</span>
                    </>
                )}
            </button>
        </div>
    );
}
