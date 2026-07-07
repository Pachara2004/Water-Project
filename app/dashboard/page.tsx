"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { LucideShieldAlert, LucideCheckCircle2, LucideLayers, LucideTrendingUp, LucideAward, LucideCalendar, LucideFilter, LucideDownload, Activity, LucideBeaker } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts";

export default function ExecutiveAnalyticsDashboard() {
    const { currentUser } = useAppStore();
    const [viewMode, setViewMode] = useState<"ALL" | "MINE">("ALL");
    const [analytics, setAnalytics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [startDate, setStartDate] = useState("2026-01-01");
    const [endDate, setEndDate] = useState("2026-12-31");
    const [agency, setAgency] = useState("all");

    const userRole = currentUser?.role?.toLowerCase() || "officer";
    const userId = currentUser?.id || null;

    useEffect(() => {
        if (userRole === "collector") setViewMode("MINE");
        else if (userRole === "officer") setViewMode("ALL");
    }, [userRole]);

    const fetchAnalyticsData = () => {
        setLoading(true);
        let url = `/api/dashboard/widgets?viewMode=${viewMode}&startDate=${startDate}&endDate=${endDate}&agency=${agency}`;
        if (userId) url += `&collectorId=${userId}`;

        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error("Database Analytics Fetch Error");
                return res.json();
            })
            .then((data) => setAnalytics(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchAnalyticsData();
    }, [viewMode, userId, startDate, endDate, agency]);

    const renderKpiIcon = (title: string) => {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes("total") || lowerTitle.includes("จำนวน")) return <LucideLayers size={11} className="text-blue-500" />;
        if (lowerTitle.includes("safe") || lowerTitle.includes("ปลอดภัย")) return <LucideCheckCircle2 size={11} className="text-emerald-500" />;
        if (lowerTitle.includes("danger") || lowerTitle.includes("วิกฤต") || lowerTitle.includes("อันตราย")) return <LucideShieldAlert size={11} className="text-red-500" />;
        if (lowerTitle.includes("active") || lowerTitle.includes("แนวโน้ม")) return <LucideTrendingUp size={11} className="text-orange-400" />;
        return <LucideBeaker size={11} className="text-indigo-500" />;
    };

    // 🚀 ลอจิกกลุ่มแท่งกราฟ เช้า-เย็น แยกออกจากกันแบบไดนามิกจับคู่คีย์
    const getGroupedBars = () => {
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
    };

    return (
        <div className="min-h-screen w-full bg-primary pb-5 antialiased">
            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                <div className="max-w-7xl mx-auto space-y-3">
                    {/* Header ควบคุมส่วนบน */}
                    <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-2 shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">ระบบวิเคราะห์ทางวิชาการเชิงลึกระดับบริหาร</h1>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center w-full sm:w-auto justify-between sm:justify-end">
                            {(userRole === "admin" || userRole === "officer") && (
                                <div className="grid grid-cols-2 rounded-xl p-0.5 bg-slate-100 border border-slate-200 text-xs font-semibold w-full sm:w-auto text-center text-[11px]">
                                    <button
                                        disabled={userRole === "collector"}
                                        onClick={() => setViewMode("ALL")}
                                        className={`px-3 py-1 rounded-md transition-all cursor-pointer ${viewMode === "ALL" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-400"}`}
                                    >
                                        ภาพรวม
                                    </button>
                                    {userRole === "admin" && (
                                        <button
                                            onClick={() => setViewMode("MINE")}
                                            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${viewMode === "MINE" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-400"}`}
                                        >
                                            ของฉัน
                                        </button>
                                    )}
                                </div>
                            )}

                            <button className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors shadow-xs shrink-0 cursor-pointer h-7.5">
                                <LucideDownload size={12} /> Export
                            </button>
                        </div>
                    </div>

                    {/* แถบกล่องตัวกรองสากล */}
                    <div className="bg-white rounded-xl p-2 border border-slate-200/80 shadow-xs flex items-center gap-2 text-[11px] shrink-0">
                        <LucideFilter size={12} className="text-indigo-600" />
                        <div className="flex gap-2 w-full overflow-x-auto no-scrollbar py-0.5">
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 shrink-0">
                                <LucideCalendar size={11} className="text-slate-400" />
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent outline-none text-slate-600 text-[11px]" />
                            </div>
                            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5">
                                <LucideCalendar size={11} className="text-slate-400" />
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent outline-none text-slate-600 text-[11px]" />
                            </div>

                            <select
                                value={agency}
                                onChange={(e) => setAgency(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 font-medium outline-none text-slate-600 h-6.5 text-[11px] max-w-[130px] sm:max-w-none"
                            >
                                <option value="all">ทุกหน่วยงาน</option>
                                {analytics?.agencies?.map((item: string, i: number) => (
                                    <option key={i} value={item}>
                                        {item}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* ส่วนการตรวจสอบสถานะและวาดสารสนเทศ */}
                    {loading || !analytics ? (
                        <div className="p-14 text-center text-slate-400 text-xs tracking-widest animate-pulse flex-1 flex items-center justify-center">กำลังประมวลผลดัชนีเคมีฐานข้อมูล...</div>
                    ) : (
                        <>
                            {/* 📊 มิติที่ 1: การ์ดตัวชี้วัดหลักแบบ Dynamic ดึงจาก DB */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
                                {analytics?.kpis?.map((kpi: any, index: number) => (
                                    <div
                                        key={index}
                                        className="bg-white rounded-xl border border-slate-200/60 p-2.5  flex flex-col border-l-10"
                                        style={{ borderLeftColor: kpi.color || "#6366f1" }}
                                    >
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1 truncate">
                                            {renderKpiIcon(kpi.title)}
                                            <span className="truncate">{kpi.title}</span>
                                        </div>
                                        <div className="mt-1 truncate flex items-baseline gap-0.5">
                                            <span className="text-base font-bold text-slate-800 tracking-tight">{typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}</span>
                                            {kpi.unit && <span className="text-[8px] text-slate-400 font-medium ml-0.5">{kpi.unit}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* 🏅 มิติที่ 2 & 3: แผงควบคุมแบ่งตามตะแกรง Grid (แยกกราฟรายสารอย่างเด็ดขาด) */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                                {/* ตาราง Hotspots เสี่ยงอันตรายสะสมสูงสุด */}
                                <div className="col-span-1 md:col-span-5 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs flex flex-col overflow-hidden justify-between">
                                    <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 mb-2 shrink-0">
                                        <LucideAward size={13} className="text-red-500" /> {analytics?.hotspotConfig?.title || " Danger Hotspots"}
                                    </div>
                                    <div className="w-full overflow-hidden flex-1">
                                        <table className="w-full text-left text-[11px] text-slate-600 table-fixed">
                                            <thead>
                                                <tr className="border-b border-slate-100 text-slate-400 text-[8px] font-bold uppercase pb-1">
                                                    <th className="pb-1.5 w-[10%]">#</th>
                                                    <th className="pb-1.5 w-[55%]">สถานี</th>
                                                    <th className="pb-1.5 w-[20%] text-center">อัตรา</th>
                                                    <th className="pb-1.5 w-[15%] text-right">ครั้ง</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {analytics?.hotspots?.map((spot: any, index: number) => (
                                                    <tr key={index} className="hover:bg-slate-50/40">
                                                        <td className="py-2 font-bold text-slate-300">{index + 1}</td>
                                                        <td className="py-2 truncate break-words">
                                                            <div className="font-semibold text-slate-800 truncate text-[11px]">{spot.stationName}</div>
                                                            <div className="text-[8px] text-slate-400 truncate mt-0.5">{spot.agency}</div>
                                                        </td>
                                                        <td className="py-2 font-bold text-red-500 text-center text-[11px]">{spot.failureRate}%</td>
                                                        <td className="py-2 text-right font-semibold text-slate-400 text-[10px]">
                                                            {spot.dangerCount}/{spot.totalCount}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 🌅 มิติที่ 3: แยกแท่งกราฟ เช้า vs เย็น ออกตามรายสารเคมีแบบ Dynamic เป็นกล่องย่อยอ่านง่ายสุดๆ */}
                                <div className="col-span-1 md:col-span-7 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs flex flex-col gap-3 overflow-hidden">
                                    <div className="text-[11px] font-bold text-slate-700 shrink-0">ความผันผวนของสารเคมีรายเดือน (เปรียบเทียบช่วงเวลา เช้า vs เย็น แยกประเภท)</div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-h-0">
                                        {getGroupedBars().map((group: any, gIdx: number) => (
                                            <div key={gIdx} className="bg-slate-50/50 rounded-lg p-2 border border-slate-100 flex flex-col justify-between h-44 sm:h-auto">
                                                <div className="text-[10px] font-bold text-indigo-600 mb-1">สถิติความเข้มข้นสะสม: {group.title}</div>
                                                <div className="w-full flex-1 min-h-0">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={analytics?.temporalData} margin={{ top: 10, right: 0, left: -35, bottom: -5 }}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={8} tickLine={false} />
                                                            <YAxis stroke="#94a3b8" fontSize={8} tickLine={false} />
                                                            <Tooltip wrapperStyle={{ fontSize: "10px" }} />
                                                            <Legend iconSize={5} wrapperStyle={{ fontSize: "8px", bottom: -5 }} />
                                                            {group.items.map((bar: any, bIdx: number) => (
                                                                <Bar
                                                                    key={bIdx}
                                                                    dataKey={bar.key}
                                                                    name={bar.name.replace(group.title, "").trim() || bar.name}
                                                                    fill={bar.color}
                                                                    radius={[2, 2, 0, 0]}
                                                                    label={{ position: "top", fill: "#64748b", fontSize: 7 }}
                                                                />
                                                            ))}
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* มิติที่ 4: WATERTRENDCHART แนวโน้มสารเคมีพร้อมเส้นควบคุมควบคุม PCD */}
                            <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs shrink-0">
                                <div className="text-[11px] font-bold text-slate-700 mb-0.5">{analytics?.trendConfig?.title || " WaterTrendChart"}</div>
                                <div className="h-40 w-full mt-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={analytics?.trends} margin={{ top: 15, right: 5, left: -32, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={9} tickLine={false} />
                                            <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                                            <Tooltip />
                                            <Legend iconSize={6} wrapperStyle={{ fontSize: "10px" }} />

                                            {analytics?.trendConfig?.references?.map((ref: any, rIdx: number) => (
                                                <ReferenceLine
                                                    key={rIdx}
                                                    y={ref.value}
                                                    stroke={ref.color}
                                                    strokeDasharray="3 3"
                                                    label={{ value: ref.label, fill: ref.color, fontSize: 7, position: "top" }}
                                                />
                                            ))}

                                            {analytics?.trendConfig?.lines?.map((line: any, lIdx: number) => (
                                                <Line
                                                    key={lIdx}
                                                    type="monotone"
                                                    dataKey={line.key}
                                                    name={line.name}
                                                    stroke={line.color}
                                                    strokeWidth={2}
                                                    dot={{ r: 2.5, fill: line.color }}
                                                    label={{ position: "top", fill: line.color, fontSize: 8 }}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
