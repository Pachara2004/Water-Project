"use client";

import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export interface TimeSeriesDataPoint {
    date: string;
    phosphate: number;
    ammonia: number;
}

interface TimeSeriesChartProps {
    data: TimeSeriesDataPoint[];
}

export default function TimeSeriesChart({ data }: TimeSeriesChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-surface-subtle border border-border/40 rounded-2xl text-text-muted text-xs font-bold font-mono uppercase tracking-wider">
                ไม่มีข้อมูลย้อนหลังในสถานีนี้
            </div>
        );
    }

    return (
        // ล็อกความสูง h-[280px] ที่ตัวนอกสุดเพื่อเคลียร์บั๊ก ResponsiveContainer หดเหลือ 0px ของ Recharts
        <div className="w-full h-[280px] mt-5 p-4 bg-surface border border-border/40 rounded-2xl shadow-sm">
            <h3 className="text-xs font-bold text-text-secondary mb-3 px-1">แนวโน้มคุณภาพน้ำ (ย้อนหลัง)</h3>
            <div className="w-full h-[210px]">
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
                            contentStyle={{
                                backgroundColor: "var(--color-surface, #ffffff)",
                                borderRadius: "12px",
                                border: "1px solid var(--color-border, #e5e7eb)",
                                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.05)",
                                fontSize: "11px",
                                fontWeight: "bold",
                            }}
                        />
                        <Legend
                            wrapperStyle={{
                                fontSize: "11px",
                                fontWeight: "bold",
                                paddingTop: "10px",
                            }}
                        />
                        <Line type="monotone" name="ฟอสเฟต (mg/L)" dataKey="phosphate" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" name="แอมโมเนีย (mg/L)" dataKey="ammonia" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
