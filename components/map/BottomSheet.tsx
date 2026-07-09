"use client";

import { X, MapPin, Calendar, FlaskConical, ShieldCheck, ShieldX, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import StatusBadge from "./StatusBadge";
import { getOrganizationLabel, evaluateAllStandards, LOCATION_TYPE_LABELS } from "@/lib/standards";
import TimeSeriesChart, { TimeSeriesDataPoint } from "../TimeSeriesChart";
import { useAppStore } from "@/lib/store";
import { getWeatherConditionLabel } from "@/lib/weather";

export interface BottomSheetLocation {
    id: string;
    name: string;
    organization: string;
    type?: string;
    lat: number;
    lng: number;
    latestSample: {
        id: string;
        status: "SAFE" | "WARNING" | "DANGER";
        phosphateVal: number | null;
        ammoniaVal: number | null;
        collectedAt: string;
        oxygen?: number | null;
        temperature?: number | null;
        rainVolume?: number | null;
        weatherCondition?: number | null;
        collector?: {
            id: string;
            name: string;
            phone: string | null;
        } | null;
    } | null;
    recentSamples?: {
        id: string;
        status: "SAFE" | "WARNING" | "DANGER";
        phosphateVal: number | null;
        ammoniaVal: number | null;
        collectedAt: string;
        oxygen?: number | null;
        temperature?: number | null;
        rainVolume?: number | null;
        weatherCondition?: number | null;
        collector?: {
            id: string;
            name: string;
            phone: string | null;
        } | null;
    }[];
}

interface BottomSheetProps {
    location: BottomSheetLocation | null;
    onClose: () => void;
}

export default function BottomSheet({ location, onClose }: BottomSheetProps) {
    const router = useRouter();
    const { currentUser } = useAppStore();
    const [sheetHeight, setSheetHeight] = useState<"collapsed" | "half" | "full">("half");
    const isDraggingRef = useRef(false);
    const dragStartYRef = useRef(0);
    const dragBaseHeightRef = useRef(0);
    const lastYRef = useRef(0);
    const lastTimeRef = useRef(0);
    const velocityRef = useRef(0);
    const sheetRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const HEIGHTS = {
        collapsed: 120,
        half: typeof window !== "undefined" ? window.innerHeight * 0.5 : 300,
        full: typeof window !== "undefined" ? window.innerHeight * 0.9 : 700,
    };

    const getSnapHeight = (snap: "collapsed" | "half" | "full"): number => HEIGHTS[snap];

    const getNearestSnapPoint = (height: number): "collapsed" | "half" | "full" => {
        const dists = {
            collapsed: Math.abs(height - HEIGHTS.collapsed),
            half: Math.abs(height - HEIGHTS.half),
            full: Math.abs(height - HEIGHTS.full),
        };
        return (Object.keys(dists) as Array<"collapsed" | "half" | "full">).reduce((a, b) => (dists[a] < dists[b] ? a : b));
    };

    const snapTo = (point: "collapsed" | "half" | "full") => {
        if (sheetRef.current) {
            sheetRef.current.style.transition = "height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
            sheetRef.current.style.height = `${getSnapHeight(point)}px`;
        }
        setSheetHeight(point);
    };

    const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
        const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        isDraggingRef.current = true;
        dragStartYRef.current = clientY;
        lastYRef.current = clientY;
        lastTimeRef.current = Date.now();
        velocityRef.current = 0;
        // Snapshot current rendered height as base
        dragBaseHeightRef.current = sheetRef.current ? sheetRef.current.getBoundingClientRect().height : getSnapHeight(sheetHeight);
        if (sheetRef.current) sheetRef.current.style.transition = "none";
    };

    const handleDragMove = (clientY: number) => {
        if (!isDraggingRef.current) return;

        const now = Date.now();
        const dt = now - lastTimeRef.current;
        if (dt > 0) {
            velocityRef.current = (lastYRef.current - clientY) / dt; // px/ms, positive = moving up
        }
        lastYRef.current = clientY;
        lastTimeRef.current = now;

        const delta = dragStartYRef.current - clientY;
        const newHeight = Math.max(HEIGHTS.collapsed, Math.min(HEIGHTS.full, dragBaseHeightRef.current + delta));

        if (sheetRef.current) {
            sheetRef.current.style.height = `${newHeight}px`;
        }
    };

    const handleDragEnd = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;

        const currentHeight = sheetRef.current ? sheetRef.current.getBoundingClientRect().height : getSnapHeight(sheetHeight);

        const velocity = velocityRef.current; // px/ms
        const VELOCITY_THRESHOLD = 0.3; // px/ms — fast flick

        let nextPoint: "collapsed" | "half" | "full";

        if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
            // Fast flick: go in direction of velocity
            if (velocity > 0) {
                // Flicking up
                if (sheetHeight === "collapsed") nextPoint = "half";
                else nextPoint = "full";
            } else {
                // Flicking down
                if (sheetHeight === "full") nextPoint = "half";
                else nextPoint = "collapsed";
            }
        } else {
            // Slow drag: snap to nearest point
            nextPoint = getNearestSnapPoint(currentHeight);
        }

        snapTo(nextPoint);
    };

    useEffect(() => {
        if (sheetRef.current) {
            sheetRef.current.style.transition = "height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
            sheetRef.current.style.height = `${getSnapHeight(sheetHeight)}px`;
        }
    }, [sheetHeight]);

    if (!location) return null;

    // 🔐 PII PRIVACY MATRIX: Determine what to show for collector info based on role
    const renderCollectorInfo = () => {
        if (!latest?.collector) return null;

        // 🛠️ แก้ไข: ดึง fullName และ displayName แทน name เดิมที่ไม่มีใน API ตัวใหม่
        const { fullName, displayName, phone: colPhone, id: colId } = latest.collector as any;
        const colName = fullName || displayName || "เจ้าหน้าที่";
        const role = currentUser?.role;

        // 1. GENERAL/PUBLIC users or not logged in: Hide collector details completely
        if (!currentUser || role === "guest") {
            return null;
        }

        // 2. ADMIN: Full Name + Contact Number
        if (role === "admin") {
            return (
                <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col  mt-4">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider block">ผู้บันทึกข้อมูล</span>
                    <p className="text-base font-bold text-text-primary">{colName}</p>
                    <p className="text-base font-bold text-primary">{colPhone || "ไม่มีเบอร์โทรศัพท์"}</p>
                </div>
            );
        }

        // 3. COLLECTOR: Own Phone/Name only, other collectors anonymized
        if (role === "collector") {
            const isSelf = String(colId) === String(currentUser.id);
            if (isSelf) {
                return (
                    <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-1 mt-4">
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">ผู้บันทึกข้อมูล (ข้อมูลของคุณเอง)</span>
                        <p className="text-xs font-bold text-text-primary mt-1">{colName}</p>
                        <p className="text-xs font-semibold text-primary font-mono">{colPhone || "ไม่มีเบอร์โทรศัพท์"}</p>
                    </div>
                );
            } else {
                // 🛡️ ปลอดภัยชัวร์: ดักจับโครงสร้างตัวแปร string ป้องกันการอ่านความยาวพลาด
                const anonymizedName = colName && colName.length > 0 ? `${colName[0]}***` : "***";
                return (
                    <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-1 mt-4">
                        <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">ผู้บันทึกข้อมูล (ผู้ใช้รายอื่น)</span>
                        <p className="text-xs font-bold text-text-primary mt-1">{anonymizedName}</p>
                        <p className="text-[10px] text-text-muted italic">เบอร์โทรศัพท์ถูกปกปิดตามความคุ้มครองข้อมูลส่วนบุคคล (PDPA)</p>
                    </div>
                );
            }
        }

        // 4. EXECUTIVE: Anonymized name, hide phone
        if (role === "officer") {
            const anonymizedName = colName && colName.length > 0 ? `${colName[0]}***` : "***";
            return (
                <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-1 mt-4">
                    <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">ผู้บันทึกข้อมูล (ข้อมูลอนามัย)</span>
                    <p className="text-xs font-bold text-text-primary mt-1">{anonymizedName}</p>
                    <p className="text-[10px] text-text-muted italic">ข้อมูลส่วนบุคคลได้รับการปกปิดเพื่อความปลอดภัยของข้อมูล</p>
                </div>
            );
        }

        return null;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // เปลี่ยนมาคำนวณแบบเผื่อสารอื่น ๆ ในอนาคต
    const chartData: TimeSeriesDataPoint[] =
        location.recentSamples
            ?.filter((s) => new Date(s.collectedAt) >= oneWeekAgo)
            .map((sample: any) => ({
                date: new Date(sample.collectedAt).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                }),
                phosphate: sample.phosphateVal ?? 0,
                ammonia: sample.ammoniaVal ?? 0,
                nitrate: sample.nitrateVal ?? 0, // ➕ พ่วงไอดีสารใหม่เข้าไปในไลน์ชาร์ตได้เลยครับบอส
            })) || [];

    const samplesArr = location.recentSamples || [];
    const latest = location.latestSample;
    const prev = samplesArr.length > 1 ? samplesArr[samplesArr.length - 2] : null;

    const po4Diff = prev && latest?.phosphateVal !== null && prev.phosphateVal !== null ? (latest?.phosphateVal ?? 0) - (prev.phosphateVal ?? 0) : 0;
    const nh3Diff = prev && latest?.ammoniaVal !== null && prev.ammoniaVal !== null ? (latest?.ammoniaVal ?? 0) - (prev.ammoniaVal ?? 0) : 0;

    const statusCounts = samplesArr.reduce(
        (acc, curr) => {
            acc[curr.status] = (acc[curr.status] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>,
    );
    const modeStatus = Object.keys(statusCounts).length > 0 ? Object.keys(statusCounts).reduce((a, b) => (statusCounts[a] > statusCounts[b] ? a : b), "SAFE") : null;

    const standardsEval = latest ? evaluateAllStandards(latest.phosphateVal, latest.ammoniaVal) : null;

    /* ─── Shared scrollable content ─────────────────────────────────────── */
    const renderContent = () => (
        <div className="flex-1">
            {/* Location header */}
            <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-primary text-white border border-primary/10 rounded-2xl shrink-0">
                    <MapPin size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-text-primary text-base sm:text-lg leading-tight truncate">{location.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-text-secondary text-xs">
                        <span className="font-semibold">{getOrganizationLabel(location.organization)}</span>
                    </div>
                </div>
            </div>

            {latest ? (
                <div className="space-y-5">
                    {/* Status + Date */}
                    <div className="bg-surface border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider">ผลวิเคราะห์ล่าสุด</span>
                            <StatusBadge status={latest.status as "safe" | "warning" | "danger"} size="sm" />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <Calendar size={12} />
                            <span className="font-semibold">{formatDate(latest.collectedAt)}</span>
                        </div>
                    </div>

                    {/* 🔐 PII Collector Privacy Card */}
                    {renderCollectorInfo()}

                    {/* Chemical values */}
                    {/* 🧪 Chemical values — อัปเดตเวอร์ชันเรนเดอร์วนลูป Dynamic รายสารจากเบสครับบอส */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { key: "phosphateVal", label: "Phosphate", color: "text-teal-500", bgColor: "bg-teal-500/10" },
                            { key: "ammoniaVal", label: "Ammonia", color: "text-purple-500", bgColor: "bg-purple-500/10" },
                            { key: "nitrateVal", label: "Nitrate", color: "text-blue-500", bgColor: "bg-blue-500/10" },
                            { key: "ph_valueVal", label: "pH Value", color: "text-pink-500", bgColor: "bg-pink-500/10" },
                            { key: "suspended_solidsVal", label: "Suspended Solids (TSS)", color: "text-amber-500", bgColor: "bg-amber-500/10" },
                        ].map((indicator) => {
                            // ดึงค่าสารตัวนั้น ๆ ออกมาจากออบเจกต์ผลลัพธ์ล่าสุด
                            const currentVal = (latest as any)[indicator.key];

                            // 🔍 ดักจับ: ถ้าแถวผลตรวจเซสชันกลุ่มนี้ ไม่มีค่าวัดของสารตัวนี้ ให้ข้ามไป ไม่ต้องโชว์กล่องให้รกตาครับ
                            if (currentVal === undefined || currentVal === null) return null;

                            // คำนวณหาผลต่างย้อนหลัง (เปรียบเทียบกับรอบก่อนหน้าในเซสชันกลุ่มอดีต)
                            const prevVal = prev ? (prev as any)[indicator.key] : null;
                            const diff = prevVal !== null && prevVal !== undefined ? currentVal - prevVal : 0;

                            return (
                                <div
                                    key={indicator.key}
                                    className="bg-surface rounded-xl p-6 border border-border flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                                >
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className={`${indicator.bgColor} p-1.5 rounded-lg border border-primary/10`}>
                                            <FlaskConical size={12} className={indicator.color} />
                                        </div>
                                        <span className="text-[9px] font-black text-text-muted uppercase tracking-wider">{indicator.label}</span>
                                    </div>
                                    <div className="flex items-baseline gap-1.5 mt-2">
                                        <span className="text-2xl font-black text-text-primary">{Number(currentVal).toFixed(3)}</span>
                                        <span className="text-[10px] text-text-muted font-bold">{indicator.key.includes("ph_value") ? "pH" : "mg/L"}</span>
                                    </div>
                                    {/* แสดงลูกศรแนวโน้มขึ้น-ลงเมื่อเทียบกับประวัติครั้งก่อน */}
                                    {prev && diff !== 0 && (
                                        <div className={`flex items-center gap-1 mt-2 text-[10px] font-black ${diff > 0 ? "text-red-500" : "text-emerald-500"}`}>
                                            {diff > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                            {diff > 0 ? "+" : ""}
                                            {diff.toFixed(3)}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Dissolved Oxygen Card (DO) */}
                    {latest.oxygen !== null && latest.oxygen !== undefined && (
                        <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/10">
                                    <FlaskConical size={12} className="text-blue-500" />
                                </div>
                                <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">Dissolved Oxygen (DO) - ค่าออกซิเจนละลายน้ำ</span>
                            </div>
                            <div className="flex items-baseline gap-1.5 mt-2">
                                <span className="text-2xl font-black text-text-primary">{latest.oxygen.toFixed(2)}</span>
                                <span className="text-[10px] text-text-muted font-bold">mL/L</span>
                            </div>
                        </div>
                    )}

                    {/* Weather Details (TMD NWP Forecast) */}
                    {(latest.temperature !== null || latest.rainVolume !== null || latest.weatherCondition !== null) && (
                        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
                            <h4 className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-4">สภาพอากาศขณะเก็บตัวอย่าง (TMD NWP Forecast)</h4>
                            <div className="grid grid-cols-3 gap-3 text-center">
                                {latest.temperature !== null && latest.temperature !== undefined && (
                                    <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                                        <span className="text-[8px] font-bold text-text-muted block uppercase">อุณหภูมิ</span>
                                        <span className="text-xs font-black text-text-primary mt-1 block">
                                            {latest.temperature.toFixed(1)}
                                            °C
                                        </span>
                                    </div>
                                )}
                                {latest.rainVolume !== null && latest.rainVolume !== undefined && (
                                    <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                                        <span className="text-[8px] font-bold text-text-muted block uppercase">ปริมาณฝน</span>
                                        <span className="text-xs font-black text-text-primary mt-1 block">{latest.rainVolume.toFixed(1)} mm</span>
                                    </div>
                                )}
                                {latest.weatherCondition !== null && latest.weatherCondition !== undefined && (
                                    <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                                        <span className="text-[8px] font-bold text-text-muted block uppercase">สภาพอากาศ</span>
                                        <span className="text-[10px] font-black text-text-primary mt-1 block truncate" title={getWeatherConditionLabel(latest.weatherCondition)}>
                                            {latest.weatherCondition === 1 ? "Clear" : latest.weatherCondition === 8 ? "Thunderstorm" : latest.weatherCondition <= 4 ? "Cloudy" : "Rainy"}
                                        </span>
                                    </div>
                                )}
                            </div>
                            {latest.weatherCondition !== null && latest.weatherCondition !== undefined && (
                                <p className="text-[9px] text-text-secondary mt-3 font-semibold text-center">รายละเอียด: {getWeatherConditionLabel(latest.weatherCondition)}</p>
                            )}
                        </div>
                    )}

                    {modeStatus && samplesArr.length > 1 && (
                        <div className="flex items-center justify-center gap-2 py-1 text-xs text-text-secondary">
                            <Minus size={12} className="text-border" />
                            <span className="font-bold">สถานะพบบ่อยสุด:</span>
                            <StatusBadge status={modeStatus as "SAFE" | "WARNING" | "DANGER"} size="sm" />
                            <Minus size={12} className="text-border" />
                        </div>
                    )}

                    {standardsEval && (
                        <div className="bg-surface-subtle border border-border rounded-2xl p-6">
                            <h4 className="text-[9px] font-black text-text-muted mb-4 uppercase tracking-wider">การผ่านเกณฑ์แบ่งตามประเภทการใช้งาน</h4>
                            <div className="grid grid-cols-1 gap-3">
                                {Object.entries(standardsEval).map(([type, passed]) => (
                                    <div
                                        key={type}
                                        className={`flex items-center gap-3.5 text-xs font-bold px-4 py-3 rounded-xl border ${
                                            passed ? "bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 border-emerald-500/10" : "bg-red-500/5 text-red-700 dark:text-red-300 border-red-500/10"
                                        }`}
                                    >
                                        {passed ? <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0" /> : <ShieldX size={14} className="text-red-500 flex-shrink-0" />}
                                        <span className="flex-1 truncate">{LOCATION_TYPE_LABELS[type as keyof typeof LOCATION_TYPE_LABELS]}</span>
                                        <span
                                            className={`text-[9px] font-black px-2 py-0.5 rounded border ${
                                                passed
                                                    ? "bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/30"
                                                    : "bg-red-100/70 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/30"
                                            }`}
                                        >
                                            {passed ? "ผ่าน" : "ไม่ผ่าน"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {chartData.length > 0 && (
                        <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm">
                            <h4 className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-4 px-1">แนวโน้มค่าสารเคมี (WEEKLY TREND)</h4>
                            <TimeSeriesChart data={chartData} />
                        </div>
                    )}

                    {samplesArr.length > 0 && (
                        <div className="bg-surface-subtle border border-border rounded-2xl p-6">
                            <h4 className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-4">บันทึกประวัติย้อนหลัง</h4>
                            <div className="space-y-3">
                                {[...samplesArr]
                                    .reverse()
                                    .slice(0, 3)
                                    .map((s, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs bg-surface border border-border px-4 py-3 rounded-xl">
                                            <span className="text-text-secondary font-bold">
                                                {new Date(s.collectedAt).toLocaleDateString("th-TH", {
                                                    day: "numeric",
                                                    month: "short",
                                                })}
                                            </span>
                                            <div className="flex items-center gap-4">
                                                <span className="text-[9px] text-text-muted font-mono bg-surface-subtle px-1.5 py-0.5 border border-border rounded">
                                                    P: {(s as any).phosphateVal?.toFixed(2) || "-"} | A: {(s as any).ammoniaVal?.toFixed(2) || "-"}
                                                    {(s as any).nitrateVal !== undefined}
                                                </span>
                                                <StatusBadge status={s.status} size="sm" />
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-8">
                    <div className="w-14 h-14 bg-surface-subtle border border-border rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <FlaskConical size={14} className="text-text-muted" />
                    </div>
                    <p className="text-xs font-bold text-text-muted">ยังไม่พบประวัติผลการวิเคราะห์ในพิกัดนี้</p>
                </div>
            )}

            {currentUser && (currentUser.role === "admin" || currentUser.role === "collector") && (
                <div className="mt-8">
                    <button
                        onClick={() => router.push(`/submit?locationId=${location.id}`)}
                        className="w-full py-4 min-h-[48px] bg-primary hover:bg-navy-dark active:scale-[0.97] text-white font-bold rounded-2xl text-xs sm:text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                        <FlaskConical size={15} />
                        ส่งผลตรวจสารเคมีจุดนี้
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <>
            <div className="hidden" onClick={onClose} />

            {/* ── Mobile: bottom sheet ──────────────────────────────────────── */}
            <div
                ref={sheetRef}
                className="sm:hidden fixed left-0 right-0 z-1000 bg-surface rounded-t-3xl border border-border flex flex-col"
                style={{
                    bottom: `calc(72px + env(safe-area-inset-bottom))`,
                    height: `${getSnapHeight(sheetHeight)}px`,
                    maxHeight: "85vh",
                    touchAction: "none",
                }}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchEnd={handleDragEnd}
                onMouseMove={(e) => handleDragMove(e.clientY)}
                onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
            >
                {/* Handle + Close */}
                <div className="bottom-sheet-header flex items-center justify-between px-7 pt-4 pb-3 shrink-0 select-none" onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
                    <div className="flex-1 flex items-center justify-center">
                        <div
                            className="bottom-sheet-handle h-7 text-primary flex items-center justify-center cursor-grab active:cursor-grabbing rounded-full hover:bg-primary transition-colors"
                            onMouseDown={handleDragStart}
                            onTouchStart={handleDragStart}
                        >
                            <div className="w-20 h-1 rounded-full bg-secondary transition-all" />
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8m flex items-center justify-center transition-colors active:scale-90 cursor-pointer">
                        <X size={24} className="text-primary" />
                    </button>
                </div>
                <div
                    ref={contentRef}
                    className="flex-1 flex flex-col overflow-y-auto scrollbar-none px-6 pb-4 pointer-events-auto"
                    style={{
                        paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
                    }}
                >
                    {renderContent()}
                </div>
            </div>

            {/* ── Tablet / Desktop: right-side panel ───────────────────────── */}
            <div
                className="hidden sm:flex fixed top-0 right-0 h-full z-1000
                      w-100 lg:w-110
                      bg-surface border-l border-border shadow-2xl
                      flex-col animate-slide-in-right transition-colors duration-300"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                {/* Panel header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0 border-b border-border">
                    <span className="text-xs font-black text-text-muted uppercase tracking-widest">ข้อมูลสถานี</span>
                    <button
                        title="Close Panel"
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-surface-subtle hover:bg-surface-muted flex items-center justify-center border border-border transition-colors active:scale-90 cursor-pointer"
                    >
                        <X size={15} className="text-text-secondary" />
                    </button>
                </div>
                <div className="flex-1 flex flex-col overflow-y-auto px-6 pt-5 scrollbar-none">{renderContent()}</div>
            </div>
        </>
    );
}
