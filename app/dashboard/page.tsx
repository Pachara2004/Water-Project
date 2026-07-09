"use client";

import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import { LucideShieldAlert, LucideCheckCircle2, LucideLayers, LucideTrendingUp, LucideTrendingDown, LucideArrowRight, LucideAward, LucideCalendar, LucideFilter, LucideDownload, Activity, LucideBeaker } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts";

// แปลง Date เป็น "YYYY-MM-DD" ตามเวลาท้องถิ่น (ไม่ผ่าน UTC) กัน off-by-one วันตอนใกล้เที่ยงคืน
function toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

// แปลงค่า w (1-12 ช่อง ตามที่ตั้งไว้ใน dashboard_widgets) เป็น Tailwind class แบบ static lookup
// (ต้องเขียนเป็น literal string ครบทุก class เพราะ Tailwind ไม่รู้จัก class ที่ประกอบด้วย template string แบบ dynamic)
function kpiSpanClass(w: number | undefined): string {
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

export default function ExecutiveAnalyticsDashboard() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const [viewMode, setViewMode] = useState<"ALL" | "MINE">("ALL");
    const [analytics, setAnalytics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);
    const [retryTick, setRetryTick] = useState(0); // เพิ่มค่าเพื่อ trigger fetch ใหม่ตอนกดปุ่มลองใหม่

    // ค่าเริ่มต้น = 6 เดือนล่าสุดแบบ rolling พอดี (ล็อควันที่ 1 ก่อนถอยเดือน กันเดือนที่ 7 โผล่มาจากเศษวัน) แทนการ hardcode ทั้งปี
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - 5); // เดือนนี้ + ย้อนอีก 5 เดือน = ครบ 6 เดือน
        return toISODate(d);
    });
    const [endDate, setEndDate] = useState(() => toISODate(new Date()));
    const [agency, setAgency] = useState("all");
    const [trendMode, setTrendMode] = useState<"wow" | "mom">("wow");

    const userRole = currentUser?.role?.toLowerCase() || "officer";
    const userId = currentUser?.id || null;

    useEffect(() => {
        if (userRole === "collector") setViewMode("MINE");
        else if (userRole === "officer") setViewMode("ALL");
    }, [userRole]);

    useEffect(() => {
        // guest/ยังไม่ login ไม่มีสิทธิ์เห็นหน้านี้อยู่แล้ว (จะโดน guard ด้านล่างเด้งกลับ) — ข้ามการยิง fetch ไปเลย
        // กัน request ที่รู้อยู่แล้วว่าจะโดน 403 จาก backend ไม่ให้ขึ้น error overlay ใน dev เปล่าๆ
        if (!currentUser || userRole === "guest") return;

        // ยกเลิก request เก่าเวลาสลับ filter เร็วๆ — กัน response เก่าที่มาช้ากว่ามาทับผลลัพธ์ของ filter ปัจจุบัน
        const controller = new AbortController();
        setLoading(true);
        setFetchError(false);
        const url = `/api/dashboard/widgets?viewMode=${viewMode}&startDate=${startDate}&endDate=${endDate}&agency=${agency}`;

        // ต้องแนบ Token ยืนยันตัวตนเสมอ — server ตรวจสิทธิ์และดึง collectorId จาก token เอง ไม่รับค่าจาก client แล้ว
        fetch(url, {
            headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
            signal: controller.signal,
        })
            .then((res) => {
                if (!res.ok) throw new Error("Database Analytics Fetch Error");
                return res.json();
            })
            .then((data) => setAnalytics(data))
            .catch((err) => {
                if (err.name === "AbortError") return; // ถูกยกเลิกเพราะ filter เปลี่ยนก่อนโหลดเสร็จ ไม่ใช่ error จริง ไม่ต้องโชว์ผู้ใช้
                console.error(err);
                setFetchError(true);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [viewMode, userId, userRole, startDate, endDate, agency, retryTick]);

    // 🔒 ปิดกั้นสิทธิ์ role "guest" (ผู้ใช้งานทั่วไป) ไม่ให้เข้าหน้านี้ — เหมือน pattern เดียวกับ app/manage/page.tsx
    // หมายเหตุ: การบังคับจริงอยู่ที่ backend (verifyAuth ที่ route.ts ไม่รับ role guest อยู่แล้ว) นี่คือแค่ UX กันไม่ให้เห็นหน้าเปล่าๆ ตอนถูก 401 กลับมา
    if (!currentUser || userRole === "guest") {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center w-full max-w-lg mx-auto bg-surface-muted border-x border-border">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mb-4 border border-red-500/20">
                    <LucideShieldAlert size={28} className="animate-pulse" />
                </div>
                <h1 className="font-display text-base font-normal text-text-primary mb-1">สิทธิ์การเข้าถึงถูกจำกัด</h1>
                <p className="text-xs text-text-secondary mb-6 max-w-[80%] mx-auto leading-relaxed">หน้านี้สำหรับเจ้าหน้าที่ปฏิบัติการ, ผู้บริหาร และผู้ดูแลระบบเท่านั้น</p>
                <button
                    onClick={() => router.push("/map")}
                    className="w-full max-w-[200px] py-3.5 bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                >
                    กลับไปหน้าแผนที่
                </button>
            </div>
        );
    }

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

    // 📈 แสดง badge การเปลี่ยนแปลงเทียบช่วงก่อนหน้าตามปฏิทิน (% สำหรับจำนวน, pp สำหรับอัตราส่วน) พร้อมป้ายโหมด WoW/MoM
    const renderTrend = (trend: any, modeLabel: string) => {
        if (!trend) return null;
        if (trend.value === null || trend.value === undefined) {
            // ช่วงก่อนหน้าไม่มีตัวอย่างในสถานะนี้เลย (ฐาน = 0) จึงคำนวณ % เปลี่ยนแปลงไม่ได้ — โชว์ป้ายอธิบายแทนการซ่อนเงียบๆ
            return (
                <span
                    className="inline-flex items-center gap-0.5 text-[8px] font-semibold px-1 py-0.5 rounded text-slate-400 bg-slate-50 cursor-help"
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
                <span className="inline-flex items-center gap-0.5 text-[8px] font-bold px-1 py-0.5 rounded text-blue-600 bg-blue-50" title={`ไม่มีการเปลี่ยนแปลงเทียบกับช่วงก่อนหน้า (${modeLabel})`}>
                    <LucideArrowRight size={8} /> เท่าเดิม
                </span>
            );
        }
        const up = trend.value > 0;
        const suffix = trend.kind === "pp" ? "pp" : "%";
        const color = up ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50";
        const Arrow = up ? LucideTrendingUp : LucideTrendingDown;
        return (
            <span className={`inline-flex items-center gap-0.5 text-[8px] font-bold px-1 py-0.5 rounded ${color}`}>
                <Arrow size={8} />
                {up ? "+" : ""}
                {trend.value}
                {suffix} {modeLabel}
            </span>
        );
    };

    return (
        <div className="min-h-screen w-full bg-primary pb-5 antialiased">
            <div className="w-full max-w-xl md:max-w-7xl mx-auto px-4 space-y-5 pt-6">
                <div className="space-y-3">
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
                    {/* โชว์ skeleton เต็มจอเฉพาะโหลดครั้งแรก (ยังไม่มีข้อมูลเลย) — ถ้าแค่เปลี่ยน filter ให้คงเนื้อหาเดิมไว้ + dim เบาๆ แทน กัน flash ตอนโหลดเร็ว */}
                    {fetchError && !analytics ? (
                        // โหลดครั้งแรกพังเลย ยังไม่มีข้อมูลเก่าให้โชว์เลย — แจ้ง error เต็มจอพร้อมปุ่มลองใหม่
                        <div className="bg-white rounded-xl border border-slate-200/80 p-10 flex flex-col items-center justify-center gap-2 text-center">
                            <LucideShieldAlert size={28} className="text-red-400" />
                            <div className="text-sm font-bold text-slate-700">ไม่สามารถโหลดข้อมูลได้</div>
                            <div className="text-xs text-slate-400">เกิดข้อผิดพลาดขณะดึงข้อมูลจากระบบ กรุณาลองใหม่อีกครั้ง</div>
                            <button
                                onClick={() => setRetryTick((t) => t + 1)}
                                className="mt-2 px-4 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                            >
                                ลองใหม่อีกครั้ง
                            </button>
                        </div>
                    ) : !analytics ? (
                        <DashboardSkeleton />
                    ) : (
                        <div className={`space-y-3 transition-opacity duration-200 ${loading ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                            {fetchError && (
                                // มีข้อมูลเก่าอยู่แล้ว แค่ refetch รอบนี้พัง — คงข้อมูลเดิมไว้ให้ดู แค่แจ้งเตือนว่าอาจไม่ใช่ข้อมูลล่าสุด
                                <div className="bg-red-50 border border-red-100 text-red-600 text-[11px] font-semibold rounded-lg px-3 py-2 flex items-center gap-1.5">
                                    <LucideShieldAlert size={12} /> โหลดข้อมูลล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลเดิมที่มีอยู่
                                </div>
                            )}
                            {/* 📊 มิติที่ 1: การ์ดตัวชี้วัดหลักแบบ Dynamic ดึงจาก DB */}
                            <div className="flex items-center justify-end shrink-0">
                                <div className="grid grid-cols-2 rounded-lg p-0.5 bg-slate-100 border border-slate-200 text-[10px] font-semibold">
                                    <button
                                        onClick={() => setTrendMode("wow")}
                                        className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${trendMode === "wow" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-400"}`}
                                    >
                                        WoW
                                    </button>
                                    <button
                                        onClick={() => setTrendMode("mom")}
                                        className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${trendMode === "mom" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-400"}`}
                                    >
                                        MoM
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-12 gap-2 shrink-0">
                                {analytics?.kpis?.map((kpi: any, index: number) => (
                                    <div
                                        key={index}
                                        className={`bg-white rounded-xl border border-slate-200/60 p-2.5  flex flex-col border-l-10 ${kpiSpanClass(kpi.w)}`}
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
                                        {kpi.trend && <div className="mt-1">{renderTrend(kpi.trend[trendMode], trendMode === "wow" ? "WoW" : "MoM")}</div>}
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
                                    <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
                                        <div className="text-[11px] font-bold text-slate-700">ความผันผวนของสารเคมี (เปรียบเทียบช่วงเวลา เช้า vs เย็น แยกประเภท)</div>
                                        {analytics?.granularityInfo && (
                                            <span className="inline-flex items-center gap-1 text-[8px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                                                {analytics.granularityInfo.label} · {analytics.granularityInfo.rangeLabel}
                                            </span>
                                        )}
                                    </div>
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
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="text-[11px] font-bold text-slate-700 mb-0.5">{analytics?.trendConfig?.title || " WaterTrendChart"}</div>
                                    {analytics?.granularityInfo && (
                                        <span className="inline-flex items-center gap-1 text-[8px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                                            {analytics.granularityInfo.label} · {analytics.granularityInfo.rangeLabel}
                                        </span>
                                    )}
                                </div>
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

                            {/* มิติที่ 5: Correlation — แยกเป็น component ลูกเพื่อไม่ให้การกด toggle re-render ทั้งหน้า */}
                            {analytics?.correlation && <CorrelationSection correlation={analytics.correlation} />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ก้อนสี่เหลี่ยมกระพริบพื้นฐานของ skeleton (ขนาดกำหนดผ่าน className ที่ส่งเข้ามา)
function Sk({ className = "" }: { className?: string }) {
    return <div className={`bg-slate-200/70 rounded animate-pulse ${className}`} />;
}

// 💀 Skeleton โครงร่างขนาดเทียบเท่าของจริง — ลอกโครงสร้าง grid/section เดียวกับตอนโหลดเสร็จ ป้องกันเลย์เอาต์กระโดดตอนข้อมูลมาถึง
function DashboardSkeleton() {
    return (
        <>
            {/* แถวปุ่มสลับ WoW/MoM */}
            <div className="flex items-center justify-end shrink-0">
                <Sk className="h-6 w-24" />
            </div>

            {/* มิติที่ 1: การ์ด KPI 4 ใบ */}
            <div className="grid grid-cols-2 md:grid-cols-12 gap-2 shrink-0">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`bg-white rounded-xl border border-slate-200/60 p-2.5 flex flex-col border-l-10 border-l-slate-200 ${kpiSpanClass(3)}`}>
                        <Sk className="h-2.5 w-3/4 mb-2" />
                        <Sk className="h-5 w-1/2 mb-2" />
                        <Sk className="h-3 w-2/5" />
                    </div>
                ))}
            </div>

            {/* มิติที่ 2 & 3: Hotspots + Temporal */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                <div className="col-span-1 md:col-span-5 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs">
                    <Sk className="h-3.5 w-2/3 mb-3" />
                    <div className="space-y-2.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Sk className="h-3 w-3 shrink-0" />
                                <div className="flex-1">
                                    <Sk className="h-2.5 w-3/4 mb-1" />
                                    <Sk className="h-2 w-1/3" />
                                </div>
                                <Sk className="h-3 w-8" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="col-span-1 md:col-span-7 bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs flex flex-col gap-3">
                    <Sk className="h-3.5 w-3/4" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="bg-slate-50/50 rounded-lg p-2 border border-slate-100 h-44 flex flex-col gap-2">
                                <Sk className="h-2.5 w-1/2" />
                                <Sk className="flex-1 w-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* มิติที่ 4: WaterTrendChart */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs shrink-0">
                <Sk className="h-3.5 w-1/2 mb-2" />
                <Sk className="h-40 w-full" />
            </div>

            {/* มิติที่ 5: Correlation */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs shrink-0">
                <div className="flex items-center justify-between mb-2 gap-2">
                    <Sk className="h-3.5 w-1/3" />
                    <Sk className="h-6 w-32" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                    <div className="col-span-1 md:col-span-8">
                        <Sk className="h-48 w-full" />
                    </div>
                    <div className="col-span-1 md:col-span-4 grid grid-cols-2 gap-2 content-start">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-lg border border-slate-100 p-2">
                                <Sk className="h-4 w-1/2 mx-auto mb-1.5" />
                                <Sk className="h-2 w-3/4 mx-auto" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

// 🌦️ Correlation — density heatmap แยกเป็น component ลูก กดสลับแล้ว re-render เฉพาะส่วนนี้
function CorrelationSection({ correlation }: { correlation: any }) {
    const [axis, setAxis] = useState<"rain" | "temp">("rain");
    const [chem, setChem] = useState<"nh3" | "po4">("nh3");
    // เลื่อนการวาด heatmap (rect หลายสิบช่อง) ไปทำเบื้องหลัง — ปุ่ม/การ์ดตอบสนองทันที
    const dAxis = useDeferredValue(axis);
    const dChem = useDeferredValue(chem);
    const hm = correlation?.heatmaps?.[`${dAxis}_${dChem}`];

    const VB_W = 440,
        VB_H = 240,
        mL = 40,
        mR = 10,
        mT = 10,
        mB = 26;
    const pw = VB_W - mL - mR,
        ph = VB_H - mT - mB;
    const ramp = ["#dbeafe", "#93c5fd", "#60a5fa", "#3b82f6", "#1d4ed8", "#1e3a8a"];

    const activeKey = `${axis}_${chem}`;
    const deferredKey = `${dAxis}_${dChem}`;
    const activeMetric = correlation?.metrics?.find((m: any) => m.key === deferredKey);

    // แปลงค่าข้อมูล → พิกัดพิกเซล (memoize ให้วาดใหม่เฉพาะตอนเปลี่ยนชุดข้อมูล)
    const view = useMemo(() => {
        if (!hm || !hm.domain || hm.bins.length === 0) return { rects: [] as any[], xTicks: [] as any[], yTicks: [] as any[], trendLine: null as any, hasData: false };
        const { xMin, xMax, yMin, yMax } = hm.domain;
        const dx = xMax - xMin || 1;
        const dy = yMax - yMin || 1;
        const sx = (v: number) => mL + ((v - xMin) / dx) * pw;
        const sy = (v: number) => mT + (1 - (v - yMin) / dy) * ph;
        const cw = (hm.binW / dx) * pw;
        const chh = (hm.binH / dy) * ph;
        const rects = hm.bins.map((b: any, i: number) => ({
            key: i,
            x: sx(b.x) - cw / 2,
            y: sy(b.y) - chh / 2,
            w: cw + 0.6,
            h: chh + 0.6,
            fill: ramp[Math.min(ramp.length - 1, Math.floor(b.intensity * ramp.length))],
        }));
        const xTicks = [xMin, (xMin + xMax) / 2, xMax].map((v) => ({ x: sx(v), label: v.toFixed(v >= 20 ? 0 : 1) }));
        const yTicks = [yMin, (yMin + yMax) / 2, yMax].map((v) => ({ y: sy(v), label: v.toFixed(2) }));

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

        return { rects, xTicks, yTicks, trendLine, hasData: true };
    }, [hm, dAxis, dChem, activeMetric]);
    const xLabel = dAxis === "rain" ? "ฝนสะสม (mm)" : "อุณหภูมิอากาศ (°C)";
    const pill = (on: boolean) => `px-2 py-0.5 rounded-md transition-all cursor-pointer ${on ? "bg-white text-indigo-600 shadow-xs" : "text-slate-400"}`;

    return (
        <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs shrink-0">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <div className="text-[11px] font-bold text-slate-700 truncate">{correlation.title || "Correlation"}</div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="grid grid-cols-2 rounded-lg p-0.5 bg-slate-100 border border-slate-200 text-[10px] font-semibold">
                        <button onClick={() => setAxis("rain")} className={pill(axis === "rain")}>
                            ฝน
                        </button>
                        <button onClick={() => setAxis("temp")} className={pill(axis === "temp")}>
                            อุณหภูมิ
                        </button>
                    </div>
                    <div className="grid grid-cols-2 rounded-lg p-0.5 bg-slate-100 border border-slate-200 text-[10px] font-semibold">
                        <button onClick={() => setChem("nh3")} className={pill(chem === "nh3")}>
                            NH₃
                        </button>
                        <button onClick={() => setChem("po4")} className={pill(chem === "po4")}>
                            PO₄
                        </button>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                {/* Density heatmap (SVG) + จุด outlier DANGER ทับ */}
                <div className="col-span-1 md:col-span-8 w-full">
                    {view.hasData ? (
                        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={`density heatmap ของ ${xLabel} กับความเข้มข้น${chem === "nh3" ? " NH₃" : " PO₄"}`}>
                            <rect x={mL} y={mT} width={pw} height={ph} fill="none" stroke="#e2e8f0" strokeWidth={1} />
                            {view.rects.map((r: any) => (
                                <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
                            ))}
                            {view.trendLine && (
                                <line
                                    x1={view.trendLine.x1}
                                    y1={view.trendLine.y1}
                                    x2={view.trendLine.x2}
                                    y2={view.trendLine.y2}
                                    stroke="#4f46e5"
                                    strokeWidth={1.6}
                                    strokeOpacity={view.trendLine.opacity}
                                    strokeDasharray="5 4"
                                />
                            )}
                            {view.xTicks.map((t: any, i: number) => (
                                <text key={`x${i}`} x={t.x} y={VB_H - 13} fontSize={8} fill="#94a3b8" textAnchor="middle">
                                    {t.label}
                                </text>
                            ))}
                            {view.yTicks.map((t: any, i: number) => (
                                <text key={`y${i}`} x={mL - 5} y={t.y + 3} fontSize={8} fill="#94a3b8" textAnchor="end">
                                    {t.label}
                                </text>
                            ))}
                            <text x={mL + pw / 2} y={VB_H - 2} fontSize={8} fill="#64748b" textAnchor="middle">
                                {xLabel}
                            </text>
                            <text x={11} y={mT + ph / 2} fontSize={8} fill="#64748b" textAnchor="middle" transform={`rotate(-90 11 ${mT + ph / 2})`}>
                                ความเข้มข้น (mg/L)
                            </text>
                        </svg>
                    ) : (
                        <div className="h-48 flex items-center justify-center text-slate-300 text-[11px]">ไม่มีข้อมูลเพียงพอสำหรับชุดนี้</div>
                    )}
                    {/* legend */}
                    <div className="flex items-center gap-3 mt-1.5 text-[8px] text-slate-400 flex-wrap">
                        <div className="flex items-center gap-1">
                            <span>จุดน้อย</span>
                            <span className="inline-block w-16 h-2 rounded" style={{ background: "linear-gradient(90deg,#dbeafe,#3b82f6,#1e3a8a)" }} />
                            <span>จุดมาก</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="inline-block w-4 h-0 border-t-2 border-indigo-600" />
เส้นประ trend (ยิ่งเข้ม = ยิ่งสัมพันธ์แรง)
                        </div>
                    </div>
                </div>
                {/* การ์ดค่าสหสัมพันธ์ Pearson r (คำนวณจากข้อมูลเต็มที่ server) */}
                <div className="col-span-1 md:col-span-4 grid grid-cols-2 gap-2 content-start">
                    {correlation.metrics?.map((m: any, i: number) => {
                        const active = m.key === activeKey;
                        const rColor = m.r === null ? "text-slate-300" : m.r >= 0.5 ? "text-rose-500" : m.r <= -0.5 ? "text-blue-500" : "text-slate-500";
                        return (
                            <button
                                key={i}
                                onClick={() => {
                                    const [a, c] = m.key.split("_");
                                    setAxis(a === "temp" ? "temp" : "rain");
                                    setChem(c === "po4" ? "po4" : "nh3");
                                }}
                                className={`rounded-lg border p-2 text-center transition-all cursor-pointer ${active ? "border-indigo-300 bg-indigo-50/60" : "border-slate-100 bg-slate-50/40 opacity-50 hover:opacity-80"}`}
                            >
                                <div className={`text-base font-bold ${rColor}`}>{m.r === null ? "—" : (m.r > 0 ? "+" : "") + m.r}</div>
                                <div className="text-[8px] text-slate-400 font-semibold mt-0.5 truncate">{m.label}</div>
                                <div className="text-[7px] text-slate-300">n={m.n}</div>
                            </button>
                        );
                    })}
                </div>
            </div>
            {correlation.note && <div className="text-[8px] text-slate-300 mt-1.5">* {correlation.note}</div>}
        </div>
    );
}

// ตัดเส้น y = slope*x + intercept ให้อยู่ในกรอบ [xMin,xMax] × [yMin,yMax] — คืน null หากเส้นไม่ผ่านกรอบเลย
function clipLineToRect(slope: number, intercept: number, xMin: number, xMax: number, yMin: number, yMax: number) {
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
