"use client";

import React, { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

/** เส้นกราฟ 1 เส้น = สาร 1 ตัว — ผู้เรียกกำหนดเองว่ามีสารอะไรบ้าง กราฟไม่ผูกกับชื่อสารใด ๆ */
export interface TimeSeriesSeries {
    /** คีย์ที่ใช้อ่านค่าจากแต่ละจุดข้อมูล */
    key: string;
    label: string;
    color: string;
}

/**
 * 1 จุดบนแกนเวลา — นอกจาก `date` แล้วที่เหลือคือค่าของแต่ละสาร
 * null = รอบนั้นไม่ได้วัดสารตัวนี้ กราฟจะเว้นช่องให้ (ห้ามส่ง 0 แทน เพราะจะกลายเป็นผลตรวจจริง)
 */
export interface TimeSeriesDataPoint {
    date: string;
    [seriesKey: string]: string | number | null;
}

interface TimeSeriesChartProps {
    data: TimeSeriesDataPoint[];
    series: TimeSeriesSeries[];
}

export default function TimeSeriesChart({ data, series }: TimeSeriesChartProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);

    /**
     * บนจอสัมผัส recharts ค้าง tooltip ไว้หลังแตะจุดข้อมูล ไม่มีเหตุการณ์ "เอาเมาส์ออก" มาปิดให้
     * แตะที่อื่นนอกกราฟจึงต้องปิดเอง — `active={false}` คือการสั่งซ่อนถาวรตาม API ของ recharts
     * ส่วน `undefined` คือคืนสิทธิ์ให้ recharts คุมเองตามปกติ
     */
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const handlePointerDown = (e: PointerEvent) => {
            const wrapper = wrapperRef.current;
            if (!wrapper) return;
            setDismissed(!wrapper.contains(e.target as Node));
        };

        // ดักที่ capture phase เพื่อให้ทำงานก่อนตัวจัดการของ recharts และของ bottom sheet
        // และไม่หลุดถ้าวันหลังมีใครใส่ stopPropagation ระหว่างทาง
        document.addEventListener("pointerdown", handlePointerDown, true);
        return () => document.removeEventListener("pointerdown", handlePointerDown, true);
    }, []);

    if (!data || data.length === 0 || series.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-surface-subtle border border-border/40 rounded-2xl text-text-muted text-xs font-bold font-mono uppercase tracking-wider">
                ไม่มีข้อมูลย้อนหลังในสถานีนี้
            </div>
        );
    }

    return (
        // ล็อกความสูง h-[280px] ที่ตัวนอกสุดเพื่อเคลียร์บั๊ก ResponsiveContainer หดเหลือ 0px ของ Recharts
        // onPointerMove ปลดล็อกให้เมาส์ที่ลอยกลับเข้ามาเห็น tooltip ได้อีก โดยไม่ต้องกดก่อน
        <div
            ref={wrapperRef}
            onPointerMove={() => {
                if (dismissed) setDismissed(false);
            }}
            className="w-full h-70 mt-5 p-4 bg-surface border border-border rounded-2xl "
        >
            <h3 className="text-sm font-semibold text-primary mb-4 text-center">แนวโน้มคุณภาพน้ำ</h3>
            <div className="w-full h-52.5">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={data}
                        margin={{
                            top: 5,
                            right: 10,
                            left: -20,
                            bottom: 5,
                        }}
                    >
                        {/* ปรับสีเส้น Grid ให้กลมกลืนทั้งไลท์และดาร์กโหมด */}
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border, #e5e7eb)" opacity={0.5} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 700 }} tickMargin={10} stroke="#9ca3af" axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fontWeight: 700 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                        {/* ปรับแต่งดีไซน์กล่อง Tooltip ให้เข้าเซ็ตคลีน ๆ ทรงพรีเมียม */}
                        <Tooltip
                            active={dismissed ? false : undefined}
                            contentStyle={{
                                backgroundColor: "var(--color-surface, #ffffff)",
                                borderRadius: "12px",
                                border: "1px solid var(--color-border, #e5e7eb)",
                                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.05)",
                                fontSize: "11px",
                                fontWeight: "bold",
                            }}
                            // ค่าสารบางตัวมีเกณฑ์ระดับ 0.015 mg/L จึงต้องโชว์ถึง 3 ตำแหน่ง ไม่งั้นตัวเลขในกล่องจะเท่ากันหมด
                            formatter={(value) => (typeof value === "number" ? value.toLocaleString("th-TH", { maximumFractionDigits: 3 }) : value)}
                        />
                        <Legend
                            wrapperStyle={{
                                fontSize: "11px",
                                fontWeight: "bold",
                                paddingTop: "10px",
                            }}
                        />
                        {/* connectNulls={false} เพื่อให้รอบที่ไม่ได้วัดสารตัวนั้นเป็นช่องว่าง ไม่ใช่เส้นลากข้ามเหมือนมีค่าต่อเนื่อง */}
                        {series.map((s) => (
                            <Line
                                key={s.key}
                                type="monotone"
                                name={s.label}
                                dataKey={s.key}
                                stroke={s.color}
                                strokeWidth={2.5}
                                connectNulls={false}
                                dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
                                activeDot={{ r: 5 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
