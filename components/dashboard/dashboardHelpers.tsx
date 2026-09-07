"use client";

import { useRef, useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { LucideCalendarDays, LucideTrendingUp, LucideTrendingDown, LucideArrowRight } from "lucide-react";
import { ChartInfoButton } from "@/components/dashboard/chartGuides";
import { ResponsiveContainer, BarChart, Bar, Cell, LabelList, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
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
// ระดับความแรงของความสัมพันธ์ตาม |r| — ใช้แปลตัวเลขเป็นคำพูดให้คนที่ไม่ได้อ่านค่าสถิติเป็น
// ขอบเขต 0.2 / 0.5 เป็นเกณฑ์หยาบที่ใช้กันทั่วไป ไม่ใช่ค่าที่มีนัยสำคัญทางสถิติในตัวเอง
const R_WEAK = 0.2;
const R_STRONG = 0.5;

const AXIS_PHRASE: Record<"rain" | "temp", string> = {
    rain: "ยิ่งฝนตกหนัก",
    temp: "ยิ่งน้ำอุ่นขึ้น",
};

const CHEM_NAME: Record<"nh3" | "po4", string> = {
    nh3: "แอมโมเนีย",
    po4: "ฟอสเฟต",
};

// แปลง Pearson r เป็นประโยคไทยประโยคเดียวที่สรุปกราฟให้เสร็จ
// เจตนาคือคนดูไม่ต้องตีความกราฟเอง และไม่ต้องรู้ว่า r คืออะไร ตัวเลขดิบย้ายไปอยู่ในปุ่ม (i) แทน
function correlationSentence(axis: "rain" | "temp", chem: "nh3" | "po4", r: number | null): string {
    const subject = `ค่าเฉลี่ย${CHEM_NAME[chem]}`;
    if (r === null) return `ข้อมูลยังไม่พอสรุปว่าสภาพอากาศมีผลต่อ${subject}หรือไม่`;

    const strength = Math.abs(r);
    if (strength < R_WEAK) return `${AXIS_PHRASE[axis]} ${subject}แทบไม่ต่างจากเดิม`;

    const direction = r > 0 ? "สูงขึ้น" : "ลดลง";
    const degree = strength >= R_STRONG ? "ชัดเจน" : "บ้าง";
    return `${AXIS_PHRASE[axis]} ${subject}มีแนวโน้ม${direction}${degree}`;
}

// 🌦️ Correlation — กราฟเส้นค่าเฉลี่ยรายกลุ่มสภาพอากาศ แยกเป็น component ลูก กดสลับแล้ว re-render เฉพาะส่วนนี้
export function CorrelationSection({ correlation }: { correlation: any }) {
    const { theme } = useAppStore();
    const isDark = theme === "dark";
    const chartTone = chartTokens(isDark);
    const [axis, setAxis] = useState<"rain" | "temp">("rain");
    const [chem, setChem] = useState<"nh3" | "po4">("nh3");

    const series = correlation?.series?.[`${axis}_${chem}`];
    const metric = correlation?.metrics?.find((m: any) => m.key === `${axis}_${chem}`);
    const minGroupSamples = correlation?.minGroupSamples ?? 5;
    const lineColor = CHEM_COLOR[chem];

    // memo ไว้เพราะ series?.points ?? [] คืน array ใหม่ทุกครั้งที่ render ทำให้ useMemo ที่พึ่งค่านี้คำนวณใหม่เปล่า ๆ
    const points = useMemo(() => series?.points ?? [], [series]);
    // กลุ่มที่ไม่มีตัวอย่างเลยยังต้องอยู่บนแกน X (คนดูจะได้รู้ว่ามีหมวดนี้อยู่แต่ไม่มีข้อมูล)
    // แต่ถ้าไม่มีกลุ่มไหนมีค่าเลย ก็ไม่เหลืออะไรให้วาด
    const hasAnyValue = points.some((p: any) => p.avg !== null);
    const lowSampleGroups = points.filter((p: any) => p.n > 0 && !p.reliable);

    // แกนค่าเริ่มที่ 0 เสมอ — ความยาวแท่งจะได้เทียบกันตรง ๆ ไม่ใช่ถูกซูมจนความต่างเล็กน้อยดูใหญ่เกินจริง
    // เผื่อปลายไว้ 1.25 เท่า ให้ตัวเลขที่พิมพ์ท้ายแท่งยาวที่สุดไม่ล้นออกนอกกรอบ
    const xMax = useMemo(() => {
        const values = points.filter((p: any) => p.avg !== null).map((p: any) => p.avg as number);
        if (values.length === 0) return 0;
        return Number((Math.max(...values) * 1.25).toPrecision(3));
    }, [points]);

    const pill = (on: boolean) => `px-2 py-0.5 rounded-md transition-all cursor-pointer ${on ? "bg-surface text-primary shadow-xs" : "text-text-muted"}`;

    // tooltip เขียนเองเพื่อบอกจำนวนตัวอย่างของกลุ่มนั้นไปด้วย — ค่าเฉลี่ยที่มาจาก 2 ตัวอย่างกับ 200 ตัวอย่างเชื่อถือได้ไม่เท่ากัน
    const renderTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const p = payload[0].payload;
        return (
            <div style={chartTone.tooltip} className="px-2.5 py-1.5 text-xs">
                <div className="font-semibold">{p.label}</div>
                <div>
                    ค่าเฉลี่ย {formatDisplayNumber(p.avg)} mg/L · จาก {p.n} ตัวอย่าง
                </div>
                {!p.reliable && <div className="text-amber-500 mt-0.5">ตัวอย่างน้อย ใช้อ้างอิงไม่ได้</div>}
            </div>
        );
    };

    return (
        <div className="bg-surface rounded-xl border border-border p-3 shadow-xs shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-12 md:items-center gap-2 md:gap-2.5 mb-2">
                {/* relative อยู่ที่บรรทัดหัวข้อ ไม่ใช่ทั้งแถว — กล่องคำอธิบายจะได้โผล่ชิดใต้ปุ่ม ไม่ใช่ใต้ปุ่มสลับฝน/อุณหภูมิที่ตกบรรทัดบนจอแคบ */}
                <div className="relative md:col-span-7 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    {correlation.title || "สภาพอากาศมีผลต่อค่าสารเคมีในน้ำหรือไม่"}
                    <ChartInfoButton guide="correlation" />
                </div>
                {/* จอแคบกว่า sm (มือถือจอเล็ก) เรียงสองกลุ่มปุ่มซ้อนกันแทนเคียงข้าง — เรียงแนวนอนแบบตายตัวทำให้ปุ่มล้นขอบการ์ดเมื่อจอแคบกว่า ~350px */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full md:col-span-5">
                    <div className="grid grid-cols-2 w-full sm:flex-1 rounded-lg p-0.5 bg-surface-subtle border border-border text-xs font-semibold">
                        <button onClick={() => setAxis("rain")} className={pill(axis === "rain")}>
                            ฝน
                        </button>
                        <button onClick={() => setAxis("temp")} className={pill(axis === "temp")}>
                            อุณหภูมิน้ำ
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

            {hasAnyValue ? (
                <>
                    {/* แท่งแนวนอน: ค่าสารอยู่แกนนอน หมวดอยู่แกนตั้ง เรียงจากบน (แห้ง/เย็น) ลงล่าง (ฝนหนัก/ร้อน)
                        ป้ายหมวดเป็นข้อความไทยยาว วางบนแกนตั้งจึงมีที่พอโดยไม่ต้องเอียงหรือตัดคำ
                        ความสูงคิดตามจำนวนหมวด ไม่ใช่ค่าคงที่ — 3 กับ 4 หมวดจะได้ความหนาแท่งเท่ากัน */}
                    <div className="w-full" style={{ height: points.length * 52 + 40 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={points} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={chartTone.grid} horizontal={false} />
                                <XAxis type="number" domain={[0, xMax]} stroke={chartTone.axis} fontSize={12} tickLine={false} tickFormatter={(v: number) => formatDisplayNumber(v)} />
                                <YAxis type="category" dataKey="label" stroke={chartTone.axis} fontSize={12} tickLine={false} axisLine={false} width={108} interval={0} />
                                <Tooltip content={renderTooltip} cursor={{ fill: chartTone.grid, fillOpacity: 0.35 }} />
                                {/* หมวดที่ avg เป็น null จะไม่มีแท่งโผล่ แต่ยังเหลือแถวกับป้ายไว้ให้เห็นว่าหมวดนี้ไม่มีตัวอย่าง */}
                                <Bar dataKey="avg" name={CHEM_NAME[chem]} radius={[0, 4, 4, 0]} barSize={22}>
                                    {points.map((pt: any, i: number) => (
                                        // แท่งของกลุ่มที่ตัวอย่างน้อยวาดจาง ๆ ให้แยกออกจากกลุ่มที่เชื่อถือได้ด้วยตาเปล่า
                                        <Cell key={i} fill={lineColor} fillOpacity={pt.reliable ? 1 : 0.3} />
                                    ))}
                                    <LabelList dataKey="avg" position="right" fontSize={12} fill={chartTone.label} formatter={(v: any) => (v === null || v === undefined ? "" : formatDisplayNumber(Number(v)))} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ประโยคสรุปแทนการ์ดตัวเลข r — ตัวเลขดิบอยู่ในปุ่ม (i) สำหรับคนที่อยากดูลึก */}
                    <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-sm font-semibold" style={{ color: lineColor }}>
                            {correlationSentence(axis, chem, metric?.r ?? null)}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                            ค่าเฉลี่ย{CHEM_NAME[chem]} (mg/L) ต่อ{series?.xLabel} · {metric?.n ?? 0} ผลตรวจ · r ={" "}
                            {/* คำอธิบายในปุ่ม (i) อ้างถึงค่า r ตัวนี้ ต้องมีที่ให้ดูบนหน้าจอ ไม่งั้นคำอธิบายชี้ไปยังของที่ไม่มีอยู่
                                toFixed(2) ตายตัวให้ความละเอียดคงที่ — ฝั่ง API ปัดมา 2 ตำแหน่งแล้วแต่ Number() ตัดศูนย์ท้ายทิ้ง (0.70 เหลือ 0.7) */}
                            <span className="font-semibold">{typeof metric?.r === "number" ? (metric.r > 0 ? "+" : "") + metric.r.toFixed(2) : "—"}</span>
                        </p>
                        {lowSampleGroups.length > 0 && (
                            <p className="text-xs text-amber-500 mt-0.5">
                                แท่งสีจางคือกลุ่มที่มีไม่ถึง {minGroupSamples} ตัวอย่าง ({lowSampleGroups.map((g: any) => g.label).join(", ")}) ค่าเฉลี่ยเหวี่ยงง่าย
                            </p>
                        )}
                    </div>
                </>
            ) : (
                <div className="h-48 flex items-center justify-center rounded-lg border border-dashed border-border text-text-muted text-xs text-center px-4">
                    ยังไม่มีผลตรวจของ{CHEM_NAME[chem]}ที่บันทึกสภาพอากาศไว้ในช่วงวันที่ที่เลือก
                </div>
            )}
        </div>
    );
}
