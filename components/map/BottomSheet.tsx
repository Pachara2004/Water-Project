"use client";

import { X, MapPin, Calendar, FlaskConical, ShieldCheck, ShieldX, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
        airTemperature?: number | null;
        rainAccumulation?: number | null;
        weatherCondCode?: number | null;
        collector?: {
            id: string;
            name: string;
            phone: string | null;
        } | null;
        [key: string]: any;
    } | null;
    recentSamples?: Array<any>;
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
    const animationFrameRef = useRef<number | null>(null);

    // ⚡ Performance: บันทึกขนาดความสูงหน้าจอคงที่ ป้องกัน Layout Shift
    const [windowHeight, setWindowHeight] = useState(700);
    useEffect(() => {
        if (typeof window !== "undefined") {
            setWindowHeight(window.innerHeight);
        }
    }, []);

    const HEIGHTS = useMemo(
        () => ({
            collapsed: 120,
            half: windowHeight * 0.5,
            full: windowHeight * 0.85,
        }),
        [windowHeight],
    );

    const getSnapHeight = useCallback((snap: "collapsed" | "half" | "full"): number => HEIGHTS[snap], [HEIGHTS]);

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
            sheetRef.current.style.transition = "height 0.22s cubic-bezier(0.16, 1, 0.3, 1)";
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
        dragBaseHeightRef.current = sheetRef.current ? sheetRef.current.getBoundingClientRect().height : getSnapHeight(sheetHeight);
        if (sheetRef.current) sheetRef.current.style.transition = "none";
    };

    const handleDragMove = useCallback(
        (clientY: number) => {
            if (!isDraggingRef.current) return;

            const now = Date.now();
            const dt = now - lastTimeRef.current;
            if (dt > 0) {
                velocityRef.current = (lastYRef.current - clientY) / dt;
            }
            lastYRef.current = clientY;
            lastTimeRef.current = now;

            const delta = dragStartYRef.current - clientY;
            const newHeight = Math.max(HEIGHTS.collapsed, Math.min(HEIGHTS.full, dragBaseHeightRef.current + delta));

            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

            animationFrameRef.current = requestAnimationFrame(() => {
                if (sheetRef.current) {
                    sheetRef.current.style.height = `${newHeight}px`;
                }
            });
        },
        [HEIGHTS],
    );

    const handleDragEnd = () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        const currentHeight = sheetRef.current ? sheetRef.current.getBoundingClientRect().height : getSnapHeight(sheetHeight);
        const velocity = velocityRef.current;
        const VELOCITY_THRESHOLD = 0.25;

        let nextPoint: "collapsed" | "half" | "full";

        if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
            if (velocity > 0) {
                nextPoint = sheetHeight === "collapsed" ? "half" : "full";
            } else {
                nextPoint = sheetHeight === "full" ? "half" : "collapsed";
            }
        } else {
            nextPoint = getNearestSnapPoint(currentHeight);
        }

        snapTo(nextPoint);
    };

    useEffect(() => {
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    useEffect(() => {
        if (sheetRef.current) {
            sheetRef.current.style.transition = "height 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
            sheetRef.current.style.height = `${getSnapHeight(sheetHeight)}px`;
        }
    }, [getSnapHeight, sheetHeight]);

    // ⚡ React Compiler Optimization: แปลงเป็นฟังก์ชันปกติ ให้ Compiler จัดการ Auto-Memoize ตาม Dependency จริง
    const chartData = (() => {
        if (!location?.recentSamples) return [];
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        return location.recentSamples
            .filter((s) => new Date(s.collectedAt) >= oneWeekAgo)
            .map((sample: any) => ({
                date: new Date(sample.collectedAt).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                }),
                phosphate: sample.phosphateVal ?? sample.phosphateValue ?? 0,
                ammonia: sample.ammoniaVal ?? sample.ammoniaValue ?? 0,
                nitrate: sample.nitrateVal ?? sample.nitrateValue ?? 0,
            }));
    })();

    // ⚡ React Compiler Optimization: แปลงลูปสารเคมีให้คลีน ไร้ปัญหา Dependency Array ขัดแย้งกัน
    const chemicalItems = (() => {
        const latest = location?.latestSample;
        const samplesArr = location?.recentSamples || [];
        const prev = samplesArr.length > 1 ? samplesArr[samplesArr.length - 2] : null;
        if (!latest) return [];

        return Object.keys(latest)
            .filter((key) => (key.endsWith("Val") || key.endsWith("Value")) && latest[key] !== undefined && latest[key] !== null)
            .map((key) => {
                const currentVal = Number(latest[key]);
                const prevVal = prev && prev[key] !== undefined && prev[key] !== null ? Number(prev[key]) : null;
                const diff = prevVal !== null ? currentVal - prevVal : 0;
                const cleanLabel = key.replace(/Val(ue)?$/i, "");

                let colorClass = "text-teal-500";
                if (cleanLabel.toLowerCase().includes("ammonia")) colorClass = "text-purple-500";
                if (cleanLabel.toLowerCase().includes("nitrate")) colorClass = "text-blue-500";

                return { key, currentVal, diff, displayLabel: cleanLabel.toUpperCase(), colorClass, hasPrev: !!prev };
            });
    })();

    if (!location) return null;

    const samplesArr = location.recentSamples || [];
    const latest = location.latestSample;

    const renderCollectorInfo = () => {
        if (!latest?.collector) return null;
        const { fullName, displayName, phone: colPhone, id: colId } = latest.collector as any;
        const colName = fullName || displayName || "เจ้าหน้าที่";
        const role = currentUser?.role;

        if (!currentUser || role === "guest") return null;
        if (role === "admin") {
            return (
                <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col mt-4">
                    <span className="text-xs font-semibold text-primary mb-1">ผู้บันทึกข้อมูล</span>
                    <p className="text-md font-semibold text-black">{colName}</p>
                    <p className="text-md font-semibold text-black">{colPhone || "ไม่มีเบอร์โทรศัพท์"}</p>
                </div>
            );
        }

        const isSelf = String(colId) === String(currentUser.id);
        if (role === "collector" && isSelf) {
            return (
                <div className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col mt-4">
                    <span className="text-xs font-semibold text-primary mb-1">ผู้บันทึกข้อมูล</span>
                    <p className="text-md font-semibold text-black">{colName}</p>
                    <p className="text-md font-semibold text-black">{colPhone || "ไม่มีเบอร์โทรศัพท์"}</p>
                </div>
            );
        }

        const anonymizedName = colName && colName.length > 0 ? `${colName[0]}***` : "***";
        return (
            <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-1 mt-4">
                <span className="text-xs font-semibold text-primary mb-1">ผู้บันทึกข้อมูล</span>
                <p className="text-xs font-bold text-black mt-1">{anonymizedName}</p>
            </div>
        );
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

    const statusCounts = samplesArr.reduce(
        (acc, curr) => {
            acc[curr.status] = (acc[curr.status] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>,
    );
    const modeStatus = Object.keys(statusCounts).length > 0 ? Object.keys(statusCounts).reduce((a, b) => (statusCounts[a] > statusCounts[b] ? a : b), "SAFE") : null;

    const latestPhosphate = latest ? (latest.phosphateVal ?? latest.phosphateValue ?? null) : null;
    const latestAmmonia = latest ? (latest.ammoniaVal ?? latest.ammoniaValue ?? null) : null;
    const standardsEval = latest ? evaluateAllStandards(latestPhosphate, latestAmmonia) : null;

    const renderContent = () => (
        <div className="flex-1 ">
            <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-primary text-white border border-primary/10 rounded-2xl shrink-0">
                    <MapPin size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-primary text-base truncate">{location.name}</h3>
                    <div className="flex items-center gap-2 text-secondary text-xs">
                        <span className="font-semibold">{getOrganizationLabel(location.organization)}</span>
                    </div>
                </div>
            </div>

            {latest ? (
                <div className="space-y-5">
                    <div className="bg-surface border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-primary">ผลวิเคราะห์ล่าสุด</span>
                            <StatusBadge status={latest.status.toLowerCase() as any} size="md" />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-black">
                            <Calendar size={16} />
                            <span className="font-bold">{formatDate(latest.collectedAt)}</span>
                        </div>
                    </div>

                    {renderCollectorInfo()}

                    <div className="grid grid-cols-2 gap-2">
                        {chemicalItems.map((item) => (
                            <div
                                key={item.key}
                                className="bg-surface rounded-xl p-4 border border-border flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] transition-transform duration-200"
                            >
                                <div className="flex items-center content-center justify-center gap-1 mb-1">
                                    <FlaskConical size={16} className={item.colorClass} />
                                    <span className="text-sm font-bold text-primary uppercase">{item.displayLabel}</span>
                                </div>
                                <div className="flex items-center content-center justify-center gap-1.5">
                                    <span className="text-2xl font-black text-black">{item.currentVal.toFixed(3)}</span>
                                    <span className="text-xs text-black font-bold">mg/L</span>
                                </div>
                                {item.hasPrev && item.diff !== 0 && (
                                    <div className={`flex items-center gap-1 text-xs font-black justify-center ${item.diff > 0 ? "text-red-500" : "text-emerald-500"}`}>
                                        {item.diff > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                        {item.diff > 0 ? "+" : ""}
                                        {item.diff.toFixed(3)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {latest.oxygen !== null && latest.oxygen !== undefined && (
                        <div className="bg-surface rounded-2xl p-4 flex items-center justify-between border border-border">
                            <div className="flex items-center gap-1.5">
                                <FlaskConical size={16} className="text-blue-500" />
                                <span className="text-sm font-bold text-primary uppercase">ค่าออกซิเจนละลายน้ำ</span>
                            </div>
                            <div className="flex items-baseline gap-1 text-right">
                                <span className="text-2xl font-black text-black">{latest.oxygen.toFixed(2)}</span>
                                <span className="text-xs text-black font-bold">mg/L</span>
                            </div>
                        </div>
                    )}

                    {(latest.airTemperature !== null ||
                        latest.rainAccumulation !== null ||
                        latest.weatherCondCode !== null ||
                        latest.temperature !== null ||
                        latest.rainVolume !== null ||
                        latest.weatherCondition !== null) && (
                        <div className="bg-surface border border-border rounded-2xl p-6">
                            <h4 className="text-xs font-semibold text-primary mb-4">สภาพอากาศขณะเก็บตัวอย่าง</h4>
                            <div className="grid grid-cols gap-3 text-center">
                                {((latest.airTemperature !== null && latest.airTemperature !== undefined) || latest.temperature !== null) && (
                                    <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                                        <span className="text-xs font-bold text-secondary block uppercase">อุณหภูมิ</span>
                                        <span className="text-xl font-bold text-black mt-1 block">{Number(latest.airTemperature ?? latest.temperature ?? 0).toFixed(1)}°C</span>
                                    </div>
                                )}
                                {((latest.rainAccumulation !== null && latest.rainAccumulation !== undefined) || latest.rainVolume !== null) && (
                                    <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                                        <span className="text-xs font-bold text-secondary block uppercase">ปริมาณฝน</span>
                                        <span className="text-xl font-bold text-black mt-1 block">{Number(latest.rainAccumulation ?? latest.rainVolume ?? 0).toFixed(1)} mm</span>
                                    </div>
                                )}
                                {((latest.weatherCondCode !== null && latest.weatherCondCode !== undefined) || latest.weatherCondition !== null) && (
                                    <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                                        <span className="text-xs font-bold text-secondary block uppercase">สภาพอากาศ</span>
                                        <span className="text-xl font-bold text-black mt-1 block truncate">{getWeatherConditionLabel(latest.weatherCondCode ?? latest.weatherCondition)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {standardsEval && (
                        <div className="bg-surface text-center border border-border rounded-2xl p-6">
                            <h4 className="text-xs font-semibold text-primary mb-3">การผ่านเกณฑ์แบ่งตามประเภทการใช้งาน</h4>
                            <div className="grid grid-cols-1 gap-3 text-start">
                                {Object.entries(standardsEval).map(([type, passed]) => (
                                    <div
                                        key={type}
                                        className={`flex items-center gap-3.5 text-xs font-bold px-4 py-3 rounded-xl border ${
                                            passed ? "bg-emerald-500/5 text-emerald-700 border-emerald-500/10" : "bg-red-500/5 text-red-700 border-red-500/10"
                                        }`}
                                    >
                                        {passed ? <ShieldCheck size={16} className="text-emerald-500 shrink-0" /> : <ShieldX size={16} className="text-red-500 shrink-0" />}
                                        <span className="flex-1 truncate">{LOCATION_TYPE_LABELS[type as keyof typeof LOCATION_TYPE_LABELS]}</span>
                                        <span
                                            className={`text-xs font-black px-2 py-0.5 rounded border ${passed ? "bg-emerald-100 text-emerald-600 border-emerald-200" : "bg-red-100 text-red-600 border-red-200"}`}
                                        >
                                            {passed ? "ผ่าน" : "ไม่ผ่าน"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {samplesArr.length > 0 && (
                        <div className="bg-surface border border-border rounded-2xl p-4">
                            <div className="flex items-center justify-center gap-1 mb-2 text-xs text-text-secondary">
                                <Minus size={12} className="text-border" />
                                <span className="text-sm font-semibold text-black">สถานะพบบ่อยสุด:</span>
                                <StatusBadge status={(modeStatus ?? "").toLowerCase() as any} size="md" />
                                <Minus size={12} className="text-border" />
                            </div>
                            <h4 className="text-xs font-semibold text-primary mb-1">บันทึกประวัติย้อนหลัง</h4>
                            <div className="space-y-3">
                                {[...samplesArr]
                                    .reverse()
                                    .slice(0, 5)
                                    .map((s, idx) => {
                                        const pVal = s.phosphateVal ?? s.phosphateValue ?? null;
                                        const aVal = s.ammoniaVal ?? s.ammoniaValue ?? null;
                                        return (
                                            <div key={idx} className="flex justify-between items-center text-xs bg-surface-subtle border border-border px-4 py-3 rounded-xl">
                                                <span className="text-black font-bold">
                                                    {new Date(s.collectedAt).toLocaleDateString("th-TH", {
                                                        day: "numeric",
                                                        month: "short",
                                                    })}
                                                </span>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs text-black bg-surface px-1.5 py-0.5 border border-border rounded">
                                                        P: {pVal ? Number(pVal).toFixed(2) : "-"} | A: {aVal ? Number(aVal).toFixed(2) : "-"}
                                                    </span>
                                                    <StatusBadge status={s.status.toLowerCase() as any} size="md" />
                                                </div>
                                            </div>
                                        );
                                    })}
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

            {chartData.length > 0 && (
                <div className="bg-surface rounded-2xl">
                    <TimeSeriesChart data={chartData} />
                </div>
            )}

            {currentUser && (currentUser.role === "admin" || currentUser.role === "collector") && (
                <div className="mt-8">
                    <button
                        onClick={() => router.push(`/submit?locationId=${location.id}`)}
                        className="w-full py-4 min-h-[48px] bg-primary hover:bg-navy-dark active:scale-[0.97] text-white font-bold rounded-2xl text-xs sm:text-sm uppercase tracking-wider transition-transform duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                        <FlaskConical size={15} />
                        ส่งผลตรวจคุณภาพน้ำจุดนี้
                    </button>
                </div>
            )}
        </div>
    );

    return (
        <>
            <div className="hidden" onClick={onClose} />

            <div
                ref={sheetRef}
                className="sm:hidden fixed left-0 right-0 z-1000 bg-bg rounded-t-3xl border border-border flex flex-col will-change-[height]"
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
                <div className="bottom-sheet-header flex items-center justify-between px-7 pt-4 pb-3 shrink-0 select-none" onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
                    <div className="flex-1 flex items-center justify-center">
                        <div
                            className="bottom-sheet-handle h-7 text-primary flex items-center justify-center cursor-grab active:cursor-grabbing rounded-full"
                            onMouseDown={handleDragStart}
                            onTouchStart={handleDragStart}
                        >
                            <div className="w-20 h-1 rounded-full bg-secondary transition-all" />
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center transition-transform active:scale-90 cursor-pointer">
                        <X size={24} className="text-primary" />
                    </button>
                </div>
                <div
                    className="flex-1 flex flex-col overflow-y-auto scrollbar-none px-6 pb-4 pointer-events-auto"
                    style={{
                        paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
                    }}
                >
                    {renderContent()}
                </div>
            </div>

            <div
                className="hidden sm:flex fixed top-0 right-0 h-full z-1000 w-100 lg:w-110 bg-surface border-l border-border shadow-3xl flex-col animate-slide-in-right will-change-transform"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
                <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0 border-b border-border">
                    <span className="text-xs font-black text-text-muted uppercase tracking-widest">ข้อมูลสถานี</span>
                    <button
                        title="Close Panel"
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-surface-subtle hover:bg-surface-muted flex items-center justify-center border border-border transition-transform active:scale-90 cursor-pointer"
                    >
                        <X size={15} className="text-text-secondary" />
                    </button>
                </div>
                <div className="flex-1 flex flex-col overflow-y-auto px-6 pt-5 scrollbar-none">{renderContent()}</div>
            </div>
        </>
    );
}
