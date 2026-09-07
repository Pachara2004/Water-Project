"use client";

import { useRef, useState, useMemo, useDeferredValue } from "react";
import { useAppStore } from "@/lib/store";
import { LucideCalendarDays, LucideTrendingUp, LucideTrendingDown, LucideArrowRight } from "lucide-react";
import { ChartInfoButton } from "@/components/dashboard/chartGuides";
import { parameterColor } from "@/lib/chartColors";

// แปลง Date เป็น "YYYY-MM-DD" ตามเวลาท้องถิ่น (ไม่ผ่าน UTC) กัน off-by-one วันตอนใกล้เที่ยงคืน
export function toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// จัดรูปแบบตัวเลขสำหรับแสดงผลในหน้า dashboard — จำกัดทศนิยมไม่เกิน 3 ตำแหน่ง (ตัดศูนย์ท้ายทิ้ง) โดยไม่แตะค่าจริงที่ใช้คำนวณ
export function formatDisplayNumber(value: number): string {
    return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

// แปลงค่า w (1-12 ช่อง ตามที่ตั้งไว้ใน dashboard_widgets) เป็น Tailwind class แบบ static lookup
// (ต้องเขียนเป็น literal string ครบทุก class เพราะ Tailwind ไม่รู้จัก class ที่ประกอบด้วย template string แบบ dynamic)
export function kpiSpanClass(w: number | undefined): string {
    switch (w) {
        case 12:
            return "col-span-2 md:col-span-12";
        case 6:
            return "col-span-2 md:col-span-6";
        case 4:
            return "col-span-1 md:col-span-4";
        case 3:
        default:
            return "col-span-1 md:col-span-3";
    }
}

// สีโครงกราฟ (เส้นกริด/แกน/tooltip) แยกตามธีม
// Recharts กับ SVG รับได้เฉพาะค่าสีจริง ใช้ CSS variable ไม่ได้ สีชุดนี้จึงอยู่นอกระบบ token ใน globals.css
export function chartTokens(isDark: boolean) {
    return {
        grid: isDark ? "#334155" : "#e2e8f0",
        axis: "#94a3b8", // slate-400 อ่านออกทั้งสองพื้น (บนพื้นเข้ม ~5.9:1) จึงใช้ค่าเดียวได้
        label: isDark ? "#cbd5e1" : "#64748b",
        tooltip: {
            backgroundColor: isDark ? "#1e293b" : "#ffffff",
            border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
            borderRadius: "8px",
            color: isDark ? "#f8fafc" : "#112a33",
        },
    };
}

// สีประจำสารเคมี — ค่าจริงอยู่ที่ lib/chartColors.ts ที่เดียว ใช้ร่วมกับกราฟบนแผนที่และการ์ด
// คีย์ nh3/po4 เป็นชื่อที่หน้าแดชบอร์ดใช้เรียกสารสองตัวนี้ ไม่ใช่ชื่อในตาราง `parameters`
export const CHEM_COLOR: Record<"nh3" | "po4", string> = { nh3: parameterColor("ammonia"), po4: parameterColor("phosphate") };

// 0–1 → คู่ hex ต่อท้ายสี (#RRGGBBAA) สำหรับใช้ใน CSS gradient ที่รับ fill-opacity แยกไม่ได้แบบ SVG
export function alphaHex(a: number): string {
    return Math.round(Math.min(1, Math.max(0, a)) * 255)
        .toString(16)
        .padStart(2, "0");
}

// ตัดเส้น y = slope*x + intercept ให้อยู่ในกรอบ [xMin,xMax] × [yMin,yMax] — คืน null หากเส้นไม่ผ่านกรอบเลย
export function clipLineToRect(slope: number, intercept: number, xMin: number, xMax: number, yMin: number, yMax: number) {
    if (slope === 0) {
        const y = intercept;
        if (y < yMin || y > yMax) return null;
        return { x0: xMin, y0: y, x1: xMax, y1: y };
    }
    const xAtYMin = (yMin - intercept) / slope;
    const xAtYMax = (yMax - intercept) / slope;
    const xLo = Math.max(xMin, Math.min(xAtYMin, xAtYMax));
    const xHi = Math.min(xMax, Math.max(xAtYMin, xAtYMax));
    if (xLo > xHi) return null;
    return { x0: xLo, y0: slope * xLo + intercept, x1: xHi, y1: slope * xHi + intercept };
}

// ตีความว่าทิศทางไหนของการ์ดนี้คือ "ดี" — ใช้ตัดสินสีของ trend badge แทนการฟันธงว่าขึ้น=เขียว/ลง=แดงเสมอ
// (ตัวอย่างเกินมาตรฐาน/เฝ้าระวังยิ่งลดยิ่งดี ในขณะที่อัตราความปลอดภัยยิ่งขึ้นยิ่งดี ส่วนจำนวนตัวอย่างรวมไม่มีทิศทางที่ดี/แย่ตายตัว)
export function getTrendPolarity(title: string): "up-good" | "down-good" | "neutral" {
    if (title.includes("ปลอดภัย")) return "up-good";
    if (title.includes("วิกฤต") || title.includes("Danger") || (title.includes("อันตราย") && !title.includes("เฝ้าระวัง"))) return "down-good";
    if (title.includes("เฝ้าระวัง") || title.includes("Warning")) return "down-good";
    return "neutral";
}

export function renderTrend(trend: any, modeLabel: string, polarity: "up-good" | "down-good" | "neutral") {
    if (!trend) return null;
    if (trend.value === null || trend.value === undefined) {
        // ช่วงก่อนหน้าไม่มีตัวอย่างในสถานะนี้เลย (ฐาน = 0) จึงคำนวณ % เปลี่ยนแปลงไม่ได้ — โชว์ป้ายอธิบายแทนการซ่อนเงียบๆ
        return (
            <span
                className="inline-flex items-center gap-0.5 text-xs font-semibold px-1 py-0.5 rounded text-text-muted bg-surface-subtle cursor-help"
                title={`ไม่มีข้อมูลเปรียบเทียบ: ช่วงก่อนหน้า (${modeLabel}) ไม่มีตัวอย่างในสถานะนี้เลย (0 รายการ) จึงคำนวณเปอร์เซ็นต์การเปลี่ยนแปลงไม่ได้ (หารด้วยศูนย์)`}
            >
                — {modeLabel}
            </span>
        );
    }
    const flat = trend.value === 0;
    if (flat) {
        // เทียบได้จริง (ฐานไม่ใช่ 0) และผลคือไม่เปลี่ยนแปลง — ต่างจากกรณี null ที่เทียบไม่ได้เลย
        return (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-1 py-0.5 rounded text-blue-600 bg-blue-50" title={`ไม่มีการเปลี่ยนแปลงเทียบกับช่วงก่อนหน้า (${modeLabel})`}>
                <LucideArrowRight size={8} /> เท่าเดิม
            </span>
        );
    }
    const up = trend.value > 0;
    const suffix = trend.kind === "pp" ? "pp" : "%";
    const isGood = polarity === "neutral" ? null : polarity === "up-good" ? up : !up;
    const color = isGood === null ? "text-text-secondary bg-surface-subtle" : isGood ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50";
    const Arrow = up ? LucideTrendingUp : LucideTrendingDown;
    return (
        <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1 py-0.5 rounded ${color}`}>
            <Arrow size={8} />
            {up ? "+" : ""}
            {formatDisplayNumber(trend.value)}
            {suffix} {modeLabel}
        </span>
    );
}

// 🚀 ลอจิกกลุ่มแท่งกราฟ เช้า-เย็น แยกออกจากกันแบบไดนามิกจับคู่คีย์
export function getGroupedBars(analytics: any) {
    if (!analytics?.temporalConfig?.bars) return [];
    const bars = analytics.temporalConfig.bars;
    const groups: any = {};

    bars.forEach((bar: any) => {
        // ตัดคำหาชื่อสารร่วมกัน เช่น "ammoniaMorning" -> "ammonia"
        const cleanKey = bar.key.replace("Morning", "").replace("Evening", "");
        if (!groups[cleanKey]) {
            groups[cleanKey] = {
                title: bar.name.split(" ")[0], // เอาชื่อสารด้านหน้า เช่น "NH3" หรือ "PO4"
                items: [],
            };
        }
        groups[cleanKey].items.push(bar);
    });
    return Object.values(groups);
}

// ช่องเลือกวันที่ที่ใช้ไอคอนของเราเองแทนไอคอนปฏิทินของ browser
// ไอคอนเดิมเป็น ::-webkit-calendar-picker-indicator ซึ่ง browser เป็นคนวาด กำหนดสี/ขนาดจาก CSS ไม่ได้
// ซ่อนแล้วผูกปุ่มของเราเข้ากับ showPicker() แทน — ตัว input ยังพิมพ์/โฟกัสได้ตามปกติ
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const inputRef = useRef<HTMLInputElement>(null);

    const openPicker = () => {
        const el = inputRef.current;
        if (!el) return;
        // showPicker เรียกได้เฉพาะจาก user gesture และไม่มีใน browser รุ่นเก่า — ถ้าไม่ได้ก็แค่โฟกัสช่องให้
        try {
            el.showPicker();
        } catch {
            el.focus();
        }
    };

    return (
        <div className="flex items-center gap-1.5 px-2.5 flex-1 min-w-0">
            <input
                ref={inputRef}
                type="date"
                aria-label={label}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="bg-transparent outline-none text-text-primary font-semibold text-xs cursor-pointer w-full min-w-0 [&::-webkit-calendar-picker-indicator]:hidden"
            />
            <button
                type="button"
                onClick={openPicker}
                aria-label={`เปิดปฏิทินเลือก${label}`}
                className="shrink-0 text-text-muted hover:text-primary transition-colors cursor-pointer"
            >
                <LucideCalendarDays size={13} />
            </button>
        </div>
    );
}

// จำนวนจุดขั้นต่ำที่ยอมให้วาด heatmap/เส้น trend — น้อยกว่านี้ความหนาแน่นและค่า r ไม่มีความหมายทางสถิติ
const MIN_CORRELATION_POINTS = 5;

// 🌦️ Correlation — density heatmap แยกเป็น component ลูก กดสลับแล้ว re-render เฉพาะส่วนนี้
export function CorrelationSection({ correlation }: { correlation: any }) {
    const { theme } = useAppStore();
    const isDark = theme === "dark";
    const chartTone = chartTokens(isDark);
    const [axis, setAxis] = useState<"rain" | "temp">("rain");
    const [chem, setChem] = useState<"nh3" | "po4">("nh3");
    // เลื่อนการวาด heatmap (rect หลายสิบช่อง) ไปทำเบื้องหลัง — ปุ่ม/การ์ดตอบสนองทันที
    const dAxis = useDeferredValue(axis);
    const dChem = useDeferredValue(chem);
    const hm = correlation?.heatmaps?.[`${dAxis}_${dChem}`];

    const VB_W = 440,
        VB_H = 240,
        // mL ต้องกว้างพอให้ตัวเลขแกน Y (เช่น "0.800" ตอน phosphate ที่ปัด 4 ตำแหน่ง) กับหัวข้อแกนแนวตั้งไม่ทับกัน
        mL = 56,
        mR = 10,
        // mT = 0 ให้เส้นขอบบนของกราฟชิดขอบบนกล่องพอดี ตรงกับขอบบนการ์ดค่า Pearson r ฝั่งขวาที่อยู่แถวกริดเดียวกัน
        // (ตัวเลขแกน Y บนสุดล้นขึ้นไปเล็กน้อย ต้องเปิด overflow="visible" ที่ <svg> ไม่งั้นโดนตัด)
        mT = 0,
        mB = 26;
    const pw = VB_W - mL - mR,
        ph = VB_H - mT - mB;
    // สเกลสีของ heatmap: สีเดียวไล่ความทึบ ช่องยิ่งหนาแน่นยิ่งทึบ
    // ความทึบทำให้ช่องเบาบางจางลงหาสีพื้นการ์ดเองโดยไม่ต้องรู้ว่าพื้นเป็นสีอะไร
    // ส่วนสีปลายทึบสุดไม่มีสีเดียวที่เด่นได้ทั้งบนพื้นขาวและพื้นเข้ม จึงต้องแยกตามธีม
    const HEAT_PEAK = isDark ? "#60a5fa" : "#1d4ed8";
    const HEAT_MIN_ALPHA = 0.18; // ความทึบของช่องที่เบาบางที่สุด — ต่ำกว่านี้จะกลืนพื้นจนนึกว่าไม่มีข้อมูล

    const activeKey = `${axis}_${chem}`;
    const deferredKey = `${dAxis}_${dChem}`;
    const activeMetric = correlation?.metrics?.find((m: any) => m.key === deferredKey);

    // แปลงค่าข้อมูล → พิกัดพิกเซล (memoize ให้วาดใหม่เฉพาะตอนเปลี่ยนชุดข้อมูล)
    const view = useMemo(() => {
        const empty = (reason: string) => ({ rects: [] as any[], xTicks: [] as any[], yTicks: [] as any[], trendLine: null as any, hasData: false, reason });
        if (!hm || !hm.domain || hm.bins.length === 0) return empty("ยังไม่มีข้อมูลสำหรับชุดนี้");
        const { xMin, xMax, yMin, yMax } = hm.domain;
        // ต่ำกว่าเกณฑ์นี้ heatmap อ่านความหนาแน่นไม่ได้ และ Pearson r ไวต่อจุดเดียวจนไม่มีความหมาย
        if (typeof activeMetric?.n === "number" && activeMetric.n < MIN_CORRELATION_POINTS) {
            return empty(`ข้อมูลไม่พอสำหรับชุดนี้ (มี ${activeMetric.n} จุด ต้องมีอย่างน้อย ${MIN_CORRELATION_POINTS} จุด)`);
        }
        // จุดทั้งหมดทับกันในแกนใดแกนหนึ่ง (ช่วงข้อมูล = 0) จึงแบ่ง bin ตามสัดส่วนไม่ได้
        // ถ้าฝืนวาด binW/binH ที่ server fallback เป็น 1 หน่วยจะถูกยืดเต็มกราฟกลายเป็นบล็อกสีทึบ และ tick ทั้ง 3 จุดจะซ้ำค่าเดียวกัน
        if (xMax - xMin <= 0 || yMax - yMin <= 0) return empty("ข้อมูลไม่พอสำหรับชุดนี้ (ค่าที่วัดได้ไม่มีความแปรปรวน จุดทุกจุดทับกัน)");
        const dx = xMax - xMin;
        const dy = yMax - yMin;
        const sx = (v: number) => mL + ((v - xMin) / dx) * pw;
        const sy = (v: number) => mT + (1 - (v - yMin) / dy) * ph;
        const cw = (hm.binW / dx) * pw;
        const chh = (hm.binH / dy) * ph;

        // ความหนาแน่นของช่อง → 0–1 สำหรับคุมความทึบ
        // จำนวนจุดต่อช่องกระจายแบบเบ้ (ช่องส่วนใหญ่มีไม่กี่จุด ช่องหนาแน่นจัดมีอยู่ไม่กี่ช่อง)
        // sqrt จึงเป็นเส้นโค้งที่ถ่างช่วงล่างที่ข้อมูลกระจุกอยู่ออก โดยไม่บีบช่วงบนจนแยกกันไม่ออก
        // b.intensity คือ count/maxCount ที่ API คำนวณมาแล้ว ใช้แทนได้เมื่อไม่มี count ดิบ
        const maxCount = hm.bins.reduce((m: number, b: any) => (typeof b.count === "number" && b.count > m ? b.count : m), 0);
        const density = (b: any) =>
            maxCount > 0 && typeof b.count === "number" ? Math.sqrt(b.count / maxCount) : Math.sqrt(Math.min(1, Math.max(0, b.intensity)));

        const rects = hm.bins.map((b: any, i: number) => ({
            key: i,
            x: sx(b.x) - cw / 2,
            y: sy(b.y) - chh / 2,
            // ช่องต้องปูชนขอบพอดี ห้ามขยายให้ซ้อนกัน — สีเป็นแบบโปร่ง ส่วนที่ซ้อนจะทึบซ้อนกันจนเห็นเป็นเส้นตาราง
            w: cw,
            h: chh,
            opacity: HEAT_MIN_ALPHA + (1 - HEAT_MIN_ALPHA) * density(b),
        }));
        const xTicks = [xMin, (xMin + xMax) / 2, xMax].map((v) => ({ x: sx(v), label: v.toFixed(v >= 20 ? 0 : 1) }));

        // แกน Y คือค่าสารเคมี (ammonia หรือ phosphate แล้วแต่ chem) — phosphate ค่าปกติเล็กมาก (~0.001-0.02)
        // .toFixed(2) ตายตัวจะปัด tick ทั้ง 3 จุดกลายเป็น "0.00" ซ้ำกันหมด ดูเหมือนไม่มีข้อมูล
        // เลือกจำนวนทศนิยมตามสเกลจริงของแกนแทน เหมือนที่ xTicks ทำอยู่แล้ว
        const yScale = Math.abs(yMax);
        const yDecimals = yScale === 0 ? 2 : yScale < 0.01 ? 4 : yScale < 1 ? 3 : yScale >= 20 ? 0 : 1;
        const yTicks = [yMin, (yMin + yMax) / 2, yMax].map((v) => ({ y: sy(v), label: v.toFixed(yDecimals) }));

        // เส้น trend: วาดเสมอ ตัดขอบให้อยู่ในกรอบ heatmap แล้วแปลงเป็นพิกัดพิกเซล
        let trendLine: any = null;
        if (activeMetric?.trend) {
            const seg = clipLineToRect(activeMetric.trend.slope, activeMetric.trend.intercept, xMin, xMax, yMin, yMax);
            if (seg) {
                const absR = activeMetric.r === null ? 0 : Math.abs(activeMetric.r);
                trendLine = {
                    x1: sx(seg.x0),
                    y1: sy(seg.y0),
                    x2: sx(seg.x1),
                    y2: sy(seg.y1),
                    opacity: 0.25 + 0.75 * absR, // ยิ่ง |r| สูง เส้นยิ่งเข้ม — ต่อเนื่อง ไม่มีขั้นกระโดด
                };
            }
        }

        return { rects, xTicks, yTicks, trendLine, hasData: true, reason: "" };
    }, [hm, dAxis, dChem, activeMetric]);
    const xLabel = dAxis === "rain" ? "ฝนสะสม (mm)" : "อุณหภูมิอากาศ (°C)";
    const pill = (on: boolean) => `px-2 py-0.5 rounded-md transition-all cursor-pointer ${on ? "bg-surface text-primary shadow-xs" : "text-text-muted"}`;

    return (
        <div className="bg-surface rounded-xl border border-border p-3 shadow-xs shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-12 md:items-center gap-2 md:gap-2.5 mb-2">
                {/* relative อยู่ที่บรรทัดหัวข้อ ไม่ใช่ทั้งแถว — กล่องคำอธิบายจะได้โผล่ชิดใต้ปุ่ม ไม่ใช่ใต้ปุ่มสลับฝน/อุณหภูมิที่ตกบรรทัดบนจอแคบ */}
                <div className="relative md:col-span-8 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    {correlation.title || "กราฟความสัมพันธ์เชิงสถิติระหว่างสภาพภูมิอากาศ"}
                    <ChartInfoButton guide="correlation" />
                </div>
                {/* จอแคบกว่า sm (มือถือจอเล็ก) เรียงสองกลุ่มปุ่มซ้อนกันแทนเคียงข้าง — เรียงแนวนอนแบบตายตัวเดิมทำให้ปุ่มล้นขอบการ์ดเมื่อจอแคบกว่า ~350px */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full md:col-span-4">
                    <div className="grid grid-cols-2 w-full sm:flex-1 rounded-lg p-0.5 bg-surface-subtle border border-border text-xs font-semibold">
                        <button onClick={() => setAxis("rain")} className={pill(axis === "rain")}>
                            ฝน
                        </button>
                        <button onClick={() => setAxis("temp")} className={pill(axis === "temp")}>
                            อุณหภูมิ
                        </button>
                    </div>
                    <div className="grid grid-cols-2 w-full sm:flex-1 rounded-lg p-0.5 bg-surface-subtle border border-border text-xs font-semibold">
                        <button onClick={() => setChem("nh3")} className={pill(chem === "nh3")} style={chem === "nh3" ? { color: CHEM_COLOR.nh3 } : undefined}>
                            Ammonia
                        </button>
                        <button onClick={() => setChem("po4")} className={pill(chem === "po4")} style={chem === "po4" ? { color: CHEM_COLOR.po4 } : undefined}>
                            Phosphate
                        </button>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                {/* Density heatmap (SVG) + จุด outlier DANGER ทับ */}
                <div className="col-span-1 md:col-span-8 w-full">
                    {view.hasData ? (
                        <svg
                            viewBox={`0 0 ${VB_W} ${VB_H}`}
                            style={{ width: "100%", height: "auto", overflow: "visible" }}
                            role="img"
                            aria-label={`density heatmap ของ ${xLabel} กับความเข้มข้น${chem === "nh3" ? " Ammonia" : " Phosphate"}`}
                        >
                            <rect x={mL} y={mT} width={pw} height={ph} fill="none" stroke={chartTone.grid} strokeWidth={1} />
                            {view.rects.map((r: any) => (
                                <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} fill={HEAT_PEAK} fillOpacity={r.opacity} shapeRendering="crispEdges" />
                            ))}
                            {view.trendLine && (
                                <line
                                    x1={view.trendLine.x1}
                                    y1={view.trendLine.y1}
                                    x2={view.trendLine.x2}
                                    y2={view.trendLine.y2}
                                    stroke={CHEM_COLOR[dChem]}
                                    strokeWidth={1.6}
                                    strokeOpacity={view.trendLine.opacity}
                                    strokeDasharray="5 4"
                                />
                            )}
                            {view.xTicks.map((t: any, i: number) => (
                                <text key={`x${i}`} x={t.x} y={VB_H - 13} fontSize={12} fill={chartTone.axis} textAnchor="middle">
                                    {t.label}
                                </text>
                            ))}
                            {view.yTicks.map((t: any, i: number) => (
                                <text key={`y${i}`} x={mL - 8} y={t.y + 3} fontSize={12} fill={chartTone.axis} textAnchor="end">
                                    {t.label}
                                </text>
                            ))}
                            <text x={mL + pw / 2} y={VB_H - 2} fontSize={12} fill={chartTone.label} textAnchor="middle">
                                {xLabel}
                            </text>
                            <text x={10} y={mT + ph / 2} fontSize={12} fill={chartTone.label} textAnchor="middle" transform={`rotate(-90 10 ${mT + ph / 2})`}>
                                ความเข้มข้น (mg/L)
                            </text>
                        </svg>
                    ) : (
                        <div className="h-48 flex items-center justify-center rounded-lg border border-dashed border-border text-text-muted text-xs text-center px-4">
                            {view.reason}
                        </div>
                    )}
                    {/* legend */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted flex-wrap">
                        <div className="flex items-center gap-1">
                            <span>จุดน้อย</span>
                            {/* แถบ legend ใช้สูตรความทึบชุดเดียวกับช่องในกราฟ จะได้ไม่มีวันเพี้ยนจากกัน */}
                            <span
                                className="inline-block w-16 h-2 rounded"
                                style={{ background: `linear-gradient(90deg, ${HEAT_PEAK}${alphaHex(HEAT_MIN_ALPHA)}, ${HEAT_PEAK})` }}
                            />
                            <span>จุดมาก</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="inline-block w-4 h-0 border-t-2" style={{ borderColor: CHEM_COLOR[dChem] }} />
                            เส้นประ trend (ยิ่งเข้ม = ยิ่งสัมพันธ์แรง)
                        </div>
                    </div>
                </div>
                {/* การ์ดค่าสหสัมพันธ์ Pearson r (คำนวณจากข้อมูลเต็มที่ server) */}
                <div className="col-span-1 md:col-span-4 grid grid-cols-2 gap-2 content-start">
                    {correlation.metrics?.map((m: any, i: number) => {
                        const active = m.key === activeKey;
                        const rColor = m.r === null ? "text-text-muted" : m.r >= 0.5 ? "text-rose-500" : m.r <= -0.5 ? "text-blue-500" : "text-text-secondary";
                        return (
                            <button
                                key={i}
                                onClick={() => {
                                    const [a, c] = m.key.split("_");
                                    setAxis(a === "temp" ? "temp" : "rain");
                                    setChem(c === "po4" ? "po4" : "nh3");
                                }}
                                className={`rounded-lg border p-2 text-center transition-all cursor-pointer ${active ? "border-primary/40 bg-primary/10" : "border-border bg-surface-subtle/40 opacity-50 hover:opacity-80"}`}
                            >
                                <div className={`text-base font-bold ${rColor}`}>{m.r === null ? "—" : (m.r > 0 ? "+" : "") + formatDisplayNumber(m.r)}</div>
                                <div className="text-xs text-text-muted font-semibold mt-0.5 truncate">{m.label}</div>
                                <div className="text-xs text-text-muted">n={m.n}</div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
