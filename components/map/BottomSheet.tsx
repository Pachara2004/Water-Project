"use client";

import { X, MapPin, Calendar, FlaskConical, TrendingUp, TrendingDown, Minus, Waves, CloudRain, Thermometer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import StatusBadge from "./StatusBadge";
import { evaluateAgainstLocationType } from "@/lib/standards";
import { useLocationTypes } from "@/lib/hooks/useLocationTypes";
import { StandardsComparison, type ComparisonRow } from "../StandardsComparison";
import TimeSeriesChart, { type TimeSeriesDataPoint, type TimeSeriesSeries } from "../TimeSeriesChart";
import { useAppStore } from "@/lib/store";
import { getWeatherConditionLabel } from "@/lib/weather";
import { chemNameFromValueKey, chemStrokeColor, readChemValues } from "@/lib/chemLabels";
import { parameterIconClass } from "@/lib/chartColors";
import { useParameterUnits } from "@/lib/hooks/useParameterUnits";

export interface BottomSheetLocation {
    id: string;
    name: string;
    organization: string;
    type?: string;
    lat: number;
    lng: number;
    province?: string | null;
    district?: string | null;
    subdistrict?: string | null;
    zipcode?: string | null;
    latestByParameter?: Array<{ parameterId: number; parameterName: string; value: number; collectedAt: string }>;
    latestSample: {
        id: string;
        /** null = ประเมินไม่ได้ (ไม่มีค่าที่วัดได้เลย) — ต่างจาก SAFE ที่แปลว่าตัดสินแล้วว่าผ่าน */
        status: "SAFE" | "WARNING" | "DANGER" | null;
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
    const { locationTypes } = useLocationTypes();
    const { unitByName } = useParameterUnits();
    const [sheetHeight, setSheetHeight] = useState<"collapsed" | "half" | "full">("collapsed");

    const isDraggingRef = useRef(false);
    const dragStartYRef = useRef(0);
    const dragBaseHeightRef = useRef(0);
    const lastYRef = useRef(0);
    const lastTimeRef = useRef(0);
    const velocityRef = useRef(0);
    const sheetRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    const [windowHeight, setWindowHeight] = useState(700);
    useEffect(() => {
        if (typeof window !== "undefined") {
            setWindowHeight(window.innerHeight);
        }
    }, []);

    const HEIGHTS = useMemo(
        () => ({
            collapsed: 125,
            half: windowHeight * 0.5,
            full: windowHeight * 0.9,
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

    /**
     * ข้อมูลกราฟแนวโน้ม — เส้นกราฟงอกตามสารที่พบจริงในข้อมูล ไม่ผูกกับฟอสเฟต/แอมโมเนีย
     *
     * payload ของสถานีแบนค่าสารเป็นคีย์ `${ชื่อสาร}Val` (ดู /api/locations) และ "ไม่สร้างคีย์"
     * เมื่อรอบนั้นไม่มีค่าที่วัดได้ ที่นี่จึงต้องแปลงคีย์ที่หายไปเป็น null ไม่ใช่ 0
     * มิฉะนั้นรอบที่ไม่ได้วัดจะถูกวาดเป็นจุด 0.00 เหมือนวัดได้ศูนย์จริง
     */
    const { chartSeries, chartData } = ((): { chartSeries: TimeSeriesSeries[]; chartData: TimeSeriesDataPoint[] } => {
        const samplesArr = location?.recentSamples || [];
        if (samplesArr.length === 0) return { chartSeries: [], chartData: [] };

        // เรียงลำดับจาก "เก่าสุดไปหาล่าสุด" เพื่อให้แกน X ของกราฟวิ่งตามลำดับเวลาถูกต้อง
        const sortedSamples = [...samplesArr].sort((a, b) => new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime());

        // รวมชื่อสารที่โผล่ในช่วงเวลาที่กราฟครอบคลุม — สารที่เพิ่งเริ่มเก็บกลางทางก็ได้เส้นของตัวเอง
        const chemNames = new Set<string>();
        for (const sample of sortedSamples) {
            for (const [key, raw] of Object.entries(sample as Record<string, unknown>)) {
                const name = chemNameFromValueKey(key);
                if (!name) continue;
                if (raw === null || raw === undefined || raw === "") continue;
                if (!Number.isFinite(Number(raw))) continue;
                chemNames.add(name.toLowerCase());
            }
        }

        // เรียงตามชื่อให้ลำดับเส้นและสีคงที่ ไม่สลับไปมาระหว่างการเปิดสถานีแต่ละครั้ง
        const chartSeries = Array.from(chemNames)
            .sort()
            .map((name) => {
                const unit = unitByName.get(name);
                return {
                    key: name,
                    label: unit ? `${name.toUpperCase()} (${unit})` : name.toUpperCase(),
                    color: chemStrokeColor(name),
                };
            });

        const chartData = sortedSamples.map((sample: any) => {
            const row: TimeSeriesDataPoint = {
                date: new Date(sample.collectedAt).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                }),
            };

            for (const name of chemNames) {
                const raw = sample[`${name}Val`] ?? sample[`${name}Value`];
                const num = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
                // ส่งค่าดิบเข้ากราฟ ไม่ปัดทศนิยมที่ชั้นข้อมูล — เกณฑ์ฟอสเฟตต่ำถึง 0.015 mg/L
                // การปัดเหลือ 2 ตำแหน่งทำให้ 0.012 กับ 0.015 กลายเป็นค่าเดียวกันบนเส้นกราฟ
                // การจัดรูปแบบตัวเลขไปทำที่ tooltip แทน
                row[name] = Number.isFinite(num) ? num : null;
            }

            return row;
        });

        return { chartSeries, chartData };
    })();

    const chemicalItems = (() => {
        const samplesArr = location?.recentSamples || [];
        if (samplesArr.length === 0) return [];

        const sortedSamples = [...samplesArr].sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime());
        const jigsawMap = new Map<string, { currentVal: number; prevVal: number | null; collectedAt: string }>();

        sortedSamples.forEach((sample) => {
            Object.keys(sample)
                .filter((key) => (key.endsWith("Val") || key.endsWith("Value")) && sample[key] !== undefined && sample[key] !== null)
                .forEach((key) => {
                    const val = Number(sample[key]);

                    if (!jigsawMap.has(key)) {
                        jigsawMap.set(key, {
                            currentVal: val,
                            prevVal: null,
                            collectedAt: sample.collectedAt,
                        });
                    } else {
                        const existing = jigsawMap.get(key)!;
                        if (existing.prevVal === null && Math.abs(existing.currentVal - val) > 0.0001) {
                            existing.prevVal = val;
                        }
                    }
                });
        });

        return Array.from(jigsawMap.entries()).map(([key, data]) => {
            const currentVal = data.currentVal;
            const prevVal = data.prevVal;
            const diff = prevVal !== null ? currentVal - prevVal : 0;
            const cleanLabel = key.replace(/Val(ue)?$/i, "");

            return {
                key,
                currentVal,
                diff,
                displayLabel: cleanLabel.toUpperCase(),
                // สีเดียวกับเส้นของสารนี้ในกราฟที่อยู่ใต้การ์ด — ทั้งคู่มาจาก lib/chartColors.ts
                colorClass: parameterIconClass(cleanLabel),
                hasPrev: prevVal !== null,
                collectedAt: data.collectedAt,
            };
        });
    })();

    if (!location) return null;

    const samplesArr = location.recentSamples || [];
    const latest = location.latestSample;

    const renderCollectorInfo = () => {
        if (!latest?.collector) return null;
        const { fullName, displayName, phone: colPhone } = latest.collector as any;
        const colName = fullName || displayName || "เจ้าหน้าที่";
        const role = currentUser?.role;

        if (!currentUser || role === "guest") return null;
        if (role === "officer") return null;

        if (role === "admin") {
            return (
                <div className="bg-card-general border border-border rounded-xl p-4 sm:p-5 flex flex-col mt-4">
                    <span className="text-xs font-semibold sm:font-medium text-primary mb-1">ผู้บันทึกข้อมูล</span>
                    <p className="text-md font-semibold sm:font-medium text-text">
                        <span className="text-primary">ชื่อ: </span>
                        {colName}
                    </p>
                    <p className="text-sm font-semibold sm:font-medium text-text">
                        <span className="text-primary">เบอร์: </span>
                        {colPhone || "ไม่มีเบอร์โทรศัพท์"}
                    </p>
                </div>
            );
        }

        if (role === "collector") {
            const anonymizedName = colName && colName.length > 0 ? `${colName.slice(0, 5)}***` : "***";
            return (
                <div className="bg-card-general border border-border rounded-xl p-4 sm:p-5 flex flex-col mt-4">
                    <span className="text-xs font-semibold sm:font-medium text-primary mb-1">ผู้บันทึกล่าสุด</span>
                    <p className="text-sm font-bold text-text mt-0.5">{anonymizedName}</p>
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

    const statusCounts = samplesArr.reduce(
        (acc, curr) => {
            acc[curr.status] = (acc[curr.status] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>,
    );
    const modeStatus = Object.keys(statusCounts).length > 0 ? Object.keys(statusCounts).reduce((a, b) => (statusCounts[a] > statusCounts[b] ? a : b), "SAFE") : null;

    // เกณฑ์ผูกกับสารด้วย parameterId ซึ่งมีมากับ latestByParameter เท่านั้น
    // payload ที่แบนเป็นคีย์ `${ชื่อสาร}Val` ไม่มี id ติดมา จึงเทียบเกณฑ์จากมันไม่ได้
    // ไม่มี latestByParameter = เทียบไม่ได้ ให้ซ่อนตารางไปเลย ดีกว่าโชว์ทุกแถวว่า "ตัดสินไม่ได้"
    const latestValues = (location.latestByParameter || []).map((m) => ({ parameterId: m.parameterId, value: m.value }));
    const comparisonRows: ComparisonRow[] =
        latest && locationTypes.length > 0 && latestValues.length > 0
            ? locationTypes.map((type) => ({
                  key: type.code,
                  label: type.labelTh,
                  status: evaluateAgainstLocationType(latestValues, type),
              }))
            : [];

    const renderContent = () => {
        const isCollapsed = sheetHeight === "collapsed";

        return (
            <div className="flex-1">
                {/* Header Section */}
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 bg-secondary text-white border border-primary/10 rounded-xl shrink-0">
                            <MapPin size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold sm:font-semibold text-primary text-base truncate">{location.name}</h3>
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs mt-0.5">
                                <span className="font-semibold sm:font-medium text-secondary whitespace-nowrap">{location.organization}</span>
                                {location.province && <span className="text-text-muted font-semibold sm:font-medium whitespace-nowrap">จ.{location.province}</span>}
                                {location.district && <span className="text-text-muted font-semibold sm:font-medium whitespace-nowrap">อ.{location.district}</span>}
                                {location.subdistrict && <span className="text-text-muted font-semibold sm:font-medium whitespace-nowrap">ต.{location.subdistrict}</span>}
                                {location.zipcode && <span className="text-text-muted font-semibold sm:font-medium whitespace-nowrap">{location.zipcode}</span>}
                            </div>
                        </div>
                    </div>

                    {isCollapsed && latest && (
                        <div className="shrink-0 sm:hidden">
                            <StatusBadge status={latest.status?.toLowerCase() as any} size="md" />
                        </div>
                    )}
                </div>

                {(!isCollapsed || (typeof window !== "undefined" && window.innerWidth >= 640)) && (
                    <>
                        {latest ? (
                            <div className="space-y-5 mt-4">
                                <div className="bg-card-general border border-border rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold sm:font-medium text-primary">ผลการวิเคราะห์ล่าสุด</span>
                                        <StatusBadge status={latest.status.toLowerCase() as any} size="md" />
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-text">
                                        <Calendar size={16} />
                                        <span className="font-bold">{formatDate(latest.collectedAt)}</span>
                                    </div>
                                </div>

                                {renderCollectorInfo()}

                                {currentUser?.role !== "guest" && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {chemicalItems.map((item) => {
                                            const formattedTime = item.collectedAt
                                                ? new Date(item.collectedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                                                : "";

                                            return (
                                                <div
                                                    key={item.key}
                                                    className="bg-card-general rounded-xl p-4 sm:p-4 border border-border flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] transition-transform duration-200"
                                                >
                                                    <div className="flex items-center justify-center gap-1 mb-1">
                                                        <div className="flex items-center gap-1">
                                                            <FlaskConical size={14} className={item.colorClass} />
                                                            <span className="text-xs font-bold text-primary uppercase">{item.displayLabel}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-center gap-1.5 my-1">
                                                        <span className="text-3xl font-black text-text">{item.currentVal.toFixed(2)}</span>
                                                        <span className="text-xs text-text font-bold">mg/L</span>
                                                    </div>

                                                    <div className="flex items-center justify-center pt-1 mt-1 border-t border-border text-xs">
                                                        {/* {item.hasPrev && item.diff !== 0 ? (
                                                            <div className={`flex items-center gap-1 font-black ${item.diff > 0 ? "text-text-danger" : "text-text-safe"}`}>
                                                                {item.diff > 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                                                                {item.diff > 0 ? "+" : ""}
                                                                {item.diff.toFixed(2)}
                                                            </div>
                                                        ) : (
                                                            <span className="text-text">-</span>
                                                        )} */}

                                                        <span className="text-text text-xs font-medium truncate" title={formattedTime}>
                                                            {formattedTime}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {(currentUser?.role !== "guest" || !currentUser?.role) &&
                                    (latest.airTemperature !== null ||
                                        latest.rainAccumulation !== null ||
                                        latest.weatherCondCode !== null ||
                                        latest.temperature !== null ||
                                        latest.rainVolume !== null ||
                                        latest.weatherCondition !== null) && (
                                        <div className="bg-card-general border border-border rounded-2xl p-6">
                                            <h4 className="text-sm font-semibold sm:font-medium justify-center flex text-primary mb-4">ข้อมูลสภาพอากาศขณะเก็บตัวอย่าง</h4>
                                            <div className="grid grid-cols-1 gap-3">
                                                {((latest.airTemperature !== null && latest.airTemperature !== undefined) || latest.temperature !== null) && (
                                                    <div className="bg-surface-subtle p-3 rounded-xl border border-border flex items-center gap-3">
                                                        <div className="p-2.5 shrink-0 text-secondary">
                                                            <Thermometer size={24} />
                                                        </div>
                                                        <div className="flex flex-col text-left min-w-0 flex-1">
                                                            <span className="text-xs font-semibold sm:font-medium text-secondary uppercase">อุณหภูมิ</span>
                                                            <span className="text-lg font-semibold sm:font-medium text-text">
                                                                {Number(latest.airTemperature ?? latest.temperature ?? 0).toFixed(1)}°C
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {((latest.rainAccumulation !== null && latest.rainAccumulation !== undefined) || latest.rainVolume !== null) && (
                                                    <div className="bg-surface-subtle p-3 rounded-xl border border-border flex items-center gap-3">
                                                        <div className="p-2.5 shrink-0 text-secondary">
                                                            <CloudRain size={24} />
                                                        </div>
                                                        <div className="flex flex-col text-left min-w-0 flex-1">
                                                            <span className="text-xs font-semibold sm:font-medium text-secondary uppercase">ปริมาณฝน</span>
                                                            <span className="text-lg font-semibold sm:font-medium text-text">
                                                                {Number(latest.rainAccumulation ?? latest.rainVolume ?? 0).toFixed(1)} mm
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {((latest.weatherCondCode !== null && latest.weatherCondCode !== undefined) || latest.weatherCondition !== null) && (
                                                    <div className="bg-surface-subtle p-3 rounded-xl border border-border flex items-center gap-3">
                                                        <div className="p-2.5 shrink-0 text-secondary">
                                                            <Waves size={24} />
                                                        </div>
                                                        <div className="flex flex-col text-left min-w-0 flex-1">
                                                            <span className="text-xs font-semibold sm:font-medium text-secondary uppercase">สภาพอากาศ</span>
                                                            <span className="text-lg font-semibold sm:font-medium text-text truncate">
                                                                {getWeatherConditionLabel(latest.weatherCondCode ?? latest.weatherCondition)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                <StandardsComparison title="เกณฑ์มาตรฐานตามประเภทการใช้งาน" rows={comparisonRows} />

                                {samplesArr.length > 0 && (
                                    <div className="bg-card-general border border-border rounded-2xl p-4">
                                        <div className="flex items-center justify-center gap-1 mb-2 text-xs text-text">
                                            <Minus size={12} className="text-border" />
                                            <span className="text-sm font-semibold sm:font-medium text-text">สถานะที่พบสูงสุด:</span>
                                            <StatusBadge status={(modeStatus ?? "").toLowerCase() as any} size="md" />
                                            <Minus size={12} className="text-border" />
                                        </div>

                                        {/* ส่วนประวัติผลการตรวจวิเคราะห์แบบ Responsive */}
                                        <h4 className="text-xs font-semibold sm:font-medium text-primary mb-2">ประวัติผลการตรวจวิเคราะห์</h4>
                                        <div className="space-y-2.5">
                                            {[...samplesArr]
                                                .reverse()
                                                .slice(0, 5)
                                                .map((s, idx) => {
                                                    // อ่านสารทุกตัวที่มีค่าในรอบนั้นจากคีย์แบน — ตัวที่ไม่มีค่าถูกตัดออกให้แล้ว
                                                    const paramValues = readChemValues(s).map((reading) => ({
                                                        name: reading.name.toUpperCase(),
                                                        val: reading.value,
                                                    }));

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="flex justify-between items-center text-xs bg-bg border border-border px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl gap-2 sm:gap-3"
                                                        >
                                                            {/* ฝั่งซ้าย: วันที่ */}
                                                            <span className="text-text font-semibold sm:font-medium shrink-0 text-xs">
                                                                {new Date(s.collectedAt).toLocaleDateString("th-TH", {
                                                                    day: "numeric",
                                                                    month: "short",
                                                                    year: "numeric",
                                                                })}
                                                            </span>

                                                            {/* ฝั่งกลาง: ชิปสารแบบ Responsive กว้างยืดหดตามสัดส่วน */}
                                                            {(currentUser?.role !== "guest" || !currentUser?.role) && (
                                                                <div className="flex flex-col gap-1 flex-1 items-center min-w-0">
                                                                    {paramValues.length > 0 ? (
                                                                        paramValues.map((p, pIdx) => (
                                                                            <div
                                                                                key={pIdx}
                                                                                className="bg-card-general border border-border px-2 py-1 rounded-md text-xs font-semibold sm:font-medium text-text flex items-center justify-between w-full max-w-[150px] sm:max-w-[180px] shadow-2xs gap-1"
                                                                            >
                                                                                <span className="text-text font-semibold sm:font-medium truncate min-w-0">{p.name}:</span>
                                                                                <span className="font-semibold sm:font-medium shrink-0">{p.val.toFixed(2)}</span>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <span className="text-text-muted text-xs italic">-</span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* ฝั่งขวา: StatusBadge */}
                                                            <div className="shrink-0">
                                                                <StatusBadge status={s.status.toLowerCase() as any} size="xs" />
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
                                <div className="w-14 h-14 bg-bg border border-border rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <FlaskConical size={14} className="text-text" />
                                </div>
                                <p className="text-xs font-semibold sm:font-medium text-text">ยังไม่พบประวัติผลการวิเคราะห์ในพิกัดนี้</p>
                            </div>
                        )}

                        {(currentUser?.role !== "guest" || !currentUser?.role) && chartData.length > 0 && (
                            <div className="bg-card-general rounded-2xl mt-4">
                                <TimeSeriesChart data={chartData} series={chartSeries} />
                            </div>
                        )}

                        {currentUser && (currentUser.role === "admin" || currentUser.role === "collector") && (
                            <div className="mt-4 mb-4">
                                <button
                                    onClick={() => router.push(`/submit?locationId=${location.id}`)}
                                    className="w-full py-4 h-full bg-secondary hover:bg-navy-dark active:scale-[0.97] text-white font-semibold sm:font-medium rounded-2xl text-xs sm:text-sm uppercase tracking-wider transition-transform duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                                >
                                    <FlaskConical size={16} />
                                    ส่งผลตรวจคุณภาพน้ำจุดนี้
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

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
                    className={`flex-1 flex flex-col px-6 pb-4 pointer-events-auto transition-all ${sheetHeight === "collapsed" ? "overflow-hidden" : "overflow-y-auto scrollbar-none"}`}
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
                <div className="flex items-center justify-between px-6 pt-4 pb-4 shrink-0 border-b border-border">
                    <span className="text-sm font-semibold sm:font-medium text-text">ข้อมูลสถานี</span>
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
