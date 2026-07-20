"use client";

import { useState, useMemo } from "react";
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, PieChart, Pie, Cell, ReferenceLine, BarChart } from "recharts";
import { Activity, Sun, Moon, MapPin, Building2, AlertTriangle, TrendingUp, ShieldCheck, Beaker, CloudRain } from "lucide-react";
import { useAppStore } from "@/lib/store";

export interface SampleItem {
    id: number;
    locationId: number;
    status: "safe" | "warning" | "danger";
    collectionTime: string | Date;
    phosphateValue: number | null; 
    ammoniaValue: number | null; 
    rainAccumulation?: number | null;
    weatherCondCode?: number | null;
    location?: {
        id?: number;
        name: string; 
        organization: string; 
        lat?: number;
        lng?: number;
    };
}

export default function AnalyticsCharts({ samples }: { samples: SampleItem[] }) {
    const { theme } = useAppStore();
    const isDark = theme === "dark";
    const [filterOrg, setFilterOrg] = useState<string>("ALL");
    const [filterLoc, setFilterLoc] = useState<string>("ALL");
    const [filterTime, setFilterTime] = useState<string>("ALL");
    const [filterWeather, setFilterWeather] = useState<string>("ALL");

    // ดึงรายชื่อหน่วยงาน
    const uniqueOrgs = useMemo(() => {
        const orgs = new Set<string>();
        samples.forEach((s) => {
            if (s.location?.organization) orgs.add(s.location.organization);
        });
        return Array.from(orgs);
    }, [samples]);

    // ดึงรายชื่อสถานที่
    const uniqueLocs = useMemo(() => {
        const locs = new Map<number, string>();
        samples.forEach((s) => {
            if (s.location) {
                if (filterOrg === "ALL" || s.location.organization === filterOrg) {
                    locs.set(s.locationId, s.location.name);
                }
            }
        });
        return Array.from(locs.entries());
    }, [samples, filterOrg]);

    const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilterOrg(e.target.value);
        setFilterLoc("ALL");
    };

    const filteredSamples = useMemo(() => {
        return samples.filter((s) => {
            const matchOrg = filterOrg === "ALL" || s.location?.organization === filterOrg;
            const matchLoc = filterLoc === "ALL" || s.locationId.toString() === filterLoc;

            let matchTime = true;
            if (filterTime !== "ALL") {
                const hour = new Date(s.collectionTime).getHours();
                if (filterTime === "MORNING") matchTime = hour >= 6 && hour < 12;
                if (filterTime === "AFTERNOON") matchTime = hour >= 12 && hour < 18;
                if (filterTime === "EVENING_NIGHT") matchTime = hour >= 18 || hour < 6;
            }

            let matchWeather = true;
            if (filterWeather !== "ALL") {
                const isRainy =
                    (s.rainAccumulation !== null && s.rainAccumulation !== undefined && s.rainAccumulation > 0) ||
                    (s.weatherCondCode !== null && s.weatherCondCode !== undefined && s.weatherCondCode >= 5 && s.weatherCondCode <= 8);
                if (filterWeather === "RAINY") matchWeather = isRainy;
                if (filterWeather === "DRY") matchWeather = !isRainy;
            }

            return matchOrg && matchLoc && matchTime && matchWeather;
        });
    }, [samples, filterOrg, filterLoc, filterTime, filterWeather]);

    // 1. สัดส่วนคุณภาพน้ำรวม (รองรับทั้งพิมพ์เล็กพิมพ์ใหญ่ด้วย .toLowerCase)
    const statusDist = useMemo(() => {
        let safe = 0,
            warning = 0,
            danger = 0;
        filteredSamples.forEach((s) => {
            const currentStatus = s.status?.toLowerCase();
            if (currentStatus === "safe") safe++;
            if (currentStatus === "warning") warning++;
            if (currentStatus === "danger") danger++;
        });
        return [
            { name: "ปลอดภัย", value: safe, color: "#10B981" },
            { name: "เฝ้าระวัง", value: warning, color: "#F59E0B" },
            { name: "อันตราย", value: danger, color: "#EF4444" },
        ].filter((d) => d.value > 0);
    }, [filteredSamples]);

    const getWeekNumber = (d: Date) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    };

    // 2. สหสัมพันธ์สารเคมีและน้ำฝนสะสม
    const avgChemData = useMemo(() => {
        const map: Record<
            string,
            {
                name: string;
                po4Sum: number;
                po4Count: number;
                nh3Sum: number;
                nh3Count: number;
                rainSum: number;
                rainCount: number;
            }
        > = {};
        filteredSamples.forEach((s) => {
            const d = new Date(s.collectionTime);
            const weekKey = `สัปดาห์ที่ ${getWeekNumber(d)}`;
            if (!map[weekKey]) {
                map[weekKey] = {
                    name: weekKey,
                    po4Sum: 0,
                    po4Count: 0,
                    nh3Sum: 0,
                    nh3Count: 0,
                    rainSum: 0,
                    rainCount: 0,
                };
            }

            if (s.phosphateValue !== null && s.phosphateValue !== undefined) {
                map[weekKey].po4Sum += s.phosphateValue;
                map[weekKey].po4Count++;
            }
            if (s.ammoniaValue !== null && s.ammoniaValue !== undefined) {
                map[weekKey].nh3Sum += s.ammoniaValue;
                map[weekKey].nh3Count++;
            }
            if (s.rainAccumulation !== null && s.rainAccumulation !== undefined) {
                map[weekKey].rainSum += s.rainAccumulation;
                map[weekKey].rainCount++;
            }
        });

        return Object.values(map)
            .map((w) => ({
                name: w.name,
                Phosphate: w.po4Count ? parseFloat((w.po4Sum / w.po4Count).toFixed(3)) : 0,
                Ammonia: w.nh3Count ? parseFloat((w.nh3Sum / w.nh3Count).toFixed(3)) : 0,
                Rainfall: w.rainCount ? parseFloat((w.rainSum / w.rainCount).toFixed(1)) : 0,
            }))
            .slice(-10);
    }, [filteredSamples]);

    // 3. ตารางวิเคราะห์หาพิกัดจุดเสี่ยงวิกฤตพบบ่อยสูงสุด
    const topCritical = useMemo(() => {
        const locMap: Record<
            number,
            {
                id: number;
                name: string;
                org: string;
                warning: number;
                danger: number;
                total: number;
            }
        > = {};
        filteredSamples.forEach((s) => {
            const currentStatus = s.status?.toLowerCase();
            if (currentStatus === "warning" || currentStatus === "danger") {
                if (!locMap[s.locationId]) {
                    locMap[s.locationId] = {
                        id: s.locationId,
                        name: s.location?.name || "ไม่ทราบสถานที่",
                        org: s.location?.organization || "ไม่ระบุหน่วยงาน",
                        warning: 0,
                        danger: 0,
                        total: 0,
                    };
                }
                if (currentStatus === "warning") locMap[s.locationId].warning++;
                if (currentStatus === "danger") locMap[s.locationId].danger++;
                locMap[s.locationId].total++;
            }
        });

        return Object.values(locMap)
            .sort((a, b) => b.danger * 2 + b.warning - (a.danger * 2 + a.warning))
            .slice(0, 5);
    }, [filteredSamples]);

    // ☀️ 4. กราฟเปรียบเทียบคุณภาพน้ำตามเวลาตรวจ
    const timeDimensionData = useMemo(() => {
        let morningSafe = 0,
            morningWarning = 0,
            morningDanger = 0;
        let eveningSafe = 0,
            eveningWarning = 0,
            eveningDanger = 0;

        filteredSamples.forEach((s) => {
            const d = new Date(s.collectionTime);
            const hour = d.getHours();
            const isMorning = hour >= 0 && hour < 12;
            const currentStatus = s.status?.toLowerCase();

            if (isMorning) {
                if (currentStatus === "safe") morningSafe++;
                if (currentStatus === "warning") morningWarning++;
                if (currentStatus === "danger") morningDanger++;
            } else {
                if (currentStatus === "safe") eveningSafe++;
                if (currentStatus === "warning") eveningWarning++;
                if (currentStatus === "danger") eveningDanger++;
            }
        });

        return [
            {
                name: "เช้า (00:00-11:59)",
                ปลอดภัย: morningSafe,
                เฝ้าระวัง: morningWarning,
                อันตราย: morningDanger,
            },
            {
                name: "เย็น (12:00-23:59)",
                ปลอดภัย: eveningSafe,
                เฝ้าระวัง: eveningWarning,
                อันตราย: eveningDanger,
            },
        ];
    }, [filteredSamples]);

    // 📉 5. ขอบเขตความแกว่งตัวของสารเคมี 7 วันล่าสุด
    const dailyVarianceData = useMemo(() => {
        const map: Record<string, { name: string; po4Vals: number[]; nh3Vals: number[] }> = {};
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        filteredSamples.forEach((s) => {
            const d = new Date(s.collectionTime);
            const diffTime = Math.abs(today.getTime() - d.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 7) {
                const dateStr = d.toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                });
                if (!map[dateStr]) {
                    map[dateStr] = { name: dateStr, po4Vals: [], nh3Vals: [] };
                }
                if (s.phosphateValue !== null && s.phosphateValue !== undefined) map[dateStr].po4Vals.push(s.phosphateValue);
                if (s.ammoniaValue !== null && s.ammoniaValue !== undefined) map[dateStr].nh3Vals.push(s.ammoniaValue);
            }
        });

        return Object.values(map)
            .map((d) => {
                const po4Max = d.po4Vals.length ? Math.max(...d.po4Vals) : 0;
                const po4Min = d.po4Vals.length ? Math.min(...d.po4Vals) : 0;
                const nh3Max = d.nh3Vals.length ? Math.max(...d.nh3Vals) : 0;
                const nh3Min = d.nh3Vals.length ? Math.min(...d.nh3Vals) : 0;
                return {
                    name: d.name,
                    "PO4 แกว่ง": parseFloat((po4Max - po4Min).toFixed(3)),
                    "NH3 แกว่ง": parseFloat((nh3Max - nh3Min).toFixed(3)),
                };
            })
            .reverse();
    }, [filteredSamples]);

    return (
        <div className="space-y-6 pb-[calc(20px+env(safe-area-inset-bottom))]">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-surface rounded-3xl p-6 shadow-md border border-border flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">ตัวอย่างทั้งหมด</span>
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950/20 rounded-2xl flex items-center justify-center border border-blue-200/50">
                            <Beaker className="w-5 h-5 text-primary" />
                        </div>
                    </div>
                    <div>
                        <p className="text-3xl font-black text-text-primary tracking-tight leading-none mb-2">{filteredSamples.length}</p>
                        <p className="text-xs text-text-muted font-bold mt-1">รายการที่อัปโหลด</p>
                    </div>
                </div>

                <div className="bg-surface rounded-3xl p-6 shadow-md border border-border flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">อัตราปลอดภัย</span>
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/20 rounded-2xl flex items-center justify-center border border-emerald-200/50">
                            <ShieldCheck className="w-5 h-5 text-safe" />
                        </div>
                    </div>
                    <div>
                        <p className="text-3xl font-black text-safe tracking-tight leading-none mb-2">
                            {filteredSamples.length > 0 ? Math.round((filteredSamples.filter((s) => s.status?.toLowerCase() === "safe").length / filteredSamples.length) * 100) : 0}%
                        </p>
                        <p className="text-xs text-text-muted font-bold mt-1">ผ่านมาตรฐานสิ่งแวดล้อม</p>
                    </div>
                </div>

                <div className="bg-surface rounded-3xl p-6 shadow-md border border-border flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">จุดวิกฤตอันตราย</span>
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-950/20 rounded-2xl flex items-center justify-center border border-red-200/50">
                            <AlertTriangle className="w-5 h-5 text-danger" />
                        </div>
                    </div>
                    <div>
                        <p className="text-3xl font-black text-danger tracking-tight leading-none mb-2">{filteredSamples.filter((s) => s.status?.toLowerCase() === "danger").length}</p>
                        <p className="text-xs text-text-muted font-bold mt-1">ต้องเฝ้าระวังสูงสุด</p>
                    </div>
                </div>

                <div className="bg-surface rounded-3xl p-6 shadow-md border border-border flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">จุดเฝ้าระวัง</span>
                        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-950/20 rounded-2xl flex items-center justify-center border border-amber-200/50">
                            <TrendingUp className="w-5 h-5 text-warning" />
                        </div>
                    </div>
                    <div>
                        <p className="text-3xl font-black text-warning tracking-tight leading-none mb-2">{filteredSamples.filter((s) => s.status?.toLowerCase() === "warning").length}</p>
                        <p className="text-xs text-text-muted font-bold mt-1">ค่าเคมีเริ่มสูงเกินเกณฑ์</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-surface rounded-2xl p-6 border border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5 px-1">
                        <Building2 size={12} className="text-primary" /> สังกัด / หน่วยงาน
                    </label>
                    <select
                        value={filterOrg}
                        onChange={handleOrgChange}
                        className="w-full text-xs px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl outline-none min-h-[44px]"
                    >
                        <option value="ALL">ทุกหน่วยงาน</option>
                        {uniqueOrgs.map((org) => (
                            <option key={org} value={org}>
                                {org}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5 px-1">
                        <MapPin size={12} className="text-primary" /> สถานที่เก็บตัวอย่างน้ำ
                    </label>
                    <select
                        value={filterLoc}
                        onChange={(e) => setFilterLoc(e.target.value)}
                        className="w-full text-xs px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl outline-none min-h-[44px]"
                    >
                        <option value="ALL">ทุกสถานที่</option>
                        {uniqueLocs.map(([id, name]) => (
                            <option key={id} value={id.toString()}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5 px-1">
                        <Sun size={12} className="text-primary" /> ช่วงเวลาเก็บตัวอย่าง
                    </label>
                    <select
                        value={filterTime}
                        onChange={(e) => setFilterTime(e.target.value)}
                        className="w-full text-xs px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl outline-none min-h-[44px]"
                    >
                        <option value="ALL">ทุกช่วงเวลา</option>
                        <option value="MORNING">เช้า (06:00 - 11:59)</option>
                        <option value="AFTERNOON">บ่าย (12:00 - 17:59)</option>
                        <option value="EVENING_NIGHT">เย็น/กลางคืน (18:00 - 05:59)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5 px-1">
                        <CloudRain size={12} className="text-primary" /> สภาพภูมิอากาศ
                    </label>
                    <select
                        value={filterWeather}
                        onChange={(e) => setFilterWeather(e.target.value)}
                        className="w-full text-xs px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl outline-none min-h-[44px]"
                    >
                        <option value="ALL">ทุกสภาพอากาศ</option>
                        <option value="RAINY">เฉพาะวันที่ฝนตก (Rainy Days)</option>
                        <option value="DRY">เฉพาะวันที่ฝนไม่ตก (Dry Days)</option>
                    </select>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
                <div className="bg-surface rounded-2xl p-6 shadow-md border border-border flex flex-col justify-between">
                    <div className="inline-flex items-center gap-2 mb-4">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <h2 className="font-bold text-sm uppercase tracking-wider text-text-primary">สัดส่วนคุณภาพน้ำโดยรวม</h2>
                    </div>
                    <div className="h-52 w-full">
                        {statusDist.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={statusDist} innerRadius={45} outerRadius={70} paddingAngle={5} dataKey="value">
                                        {statusDist.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: "12px",
                                            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                                            border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                                        }}
                                    />
                                    <Legend
                                        iconType="circle"
                                        wrapperStyle={{
                                            fontSize: "11px",
                                            paddingTop: "5px",
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-xs font-bold text-text-muted">ไม่มีข้อมูลจัดสรร</div>
                        )}
                    </div>
                </div>

                <div className="bg-surface rounded-2xl p-6 shadow-md border border-border flex flex-col justify-between">
                    <div className="inline-flex items-center gap-2 mb-4">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <h2 className="font-bold text-sm uppercase tracking-wider text-text-primary">สหสัมพันธ์สารเคมีและน้ำฝนสะสม</h2>
                    </div>
                    <div className="h-52 w-full">
                        {avgChemData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={avgChemData}
                                    margin={{
                                        top: 10,
                                        right: -5,
                                        left: -20,
                                        bottom: 0,
                                    }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#E2E8F0"} opacity={0.4} />
                                    <XAxis
                                        dataKey="name"
                                        tick={{
                                            fontSize: 10,
                                            fill: isDark ? "#94A3B8" : "#475569",
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        yAxisId="left"
                                        tick={{
                                            fontSize: 10,
                                            fill: isDark ? "#94A3B8" : "#475569",
                                        }}
                                        axisLine={false}
                                        tickLine={false}
                                        domain={[0, "auto"]}
                                    />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#38BDF8" }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: "12px",
                                            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                                            border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                                        }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                                    <ReferenceLine
                                        yAxisId="left"
                                        y={0.045}
                                        stroke="#F59E0B"
                                        strokeDasharray="4 4"
                                        label={{
                                            value: "PO₄ (0.045)",
                                            fill: isDark ? "#F59E0B" : "#B45309",
                                            fontSize: 8,
                                            position: "insideTopRight",
                                        }}
                                    />
                                    <ReferenceLine
                                        yAxisId="left"
                                        y={0.7}
                                        stroke="#EF4444"
                                        strokeDasharray="4 4"
                                        label={{
                                            value: "NH₃ (0.7)",
                                            fill: isDark ? "#FCA5A5" : "#B91C1C",
                                            fontSize: 8,
                                            position: "insideTopRight",
                                        }}
                                    />
                                    <Bar yAxisId="right" dataKey="Rainfall" name="ฝนตกเฉลี่ย (mm)" fill="#38BDF8" opacity={0.4} radius={[4, 4, 0, 0]} barSize={16} />
                                    <Line yAxisId="left" type="monotone" dataKey="Phosphate" name="Phosphate" stroke="#0052FF" strokeWidth={2} dot={{ r: 1.5 }} />
                                    <Line yAxisId="left" type="monotone" dataKey="Ammonia" name="Ammonia" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 1.5 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-xs font-bold text-text-muted">ไม่มีข้อมูลแนวโน้ม</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Time Chart */}
            <div className="bg-surface rounded-2xl p-6 shadow-md border border-border">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <Sun size={15} className="text-amber-500" />
                        <h2 className="font-bold text-sm uppercase tracking-wider text-text-primary">เปรียบเทียบคุณภาพน้ำตามเวลาตรวจ (เช้า-เย็น)</h2>
                    </div>
                    <Moon size={13} className="text-indigo-500/80" />
                </div>
                <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={timeDimensionData}
                            margin={{
                                top: 10,
                                right: 10,
                                left: -20,
                                bottom: 0,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#E2E8F0"} opacity={0.4} />
                            <XAxis
                                dataKey="name"
                                tick={{
                                    fontSize: 11,
                                    fill: isDark ? "#94A3B8" : "#475569",
                                }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{
                                    fontSize: 11,
                                    fill: isDark ? "#94A3B8" : "#475569",
                                }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: "12px",
                                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                                    border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                                }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                            <Bar dataKey="ปลอดภัย" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24} />
                            <Bar dataKey="เฝ้าระวัง" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={24} />
                            <Bar dataKey="อันตราย" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Variance Chart */}
            <div className="bg-surface rounded-2xl p-6 shadow-md border border-border">
                <div className="flex items-center gap-2 mb-5">
                    <Activity size={15} className="text-pink-500" />
                    <h2 className="font-bold text-sm uppercase tracking-wider text-text-primary">ความแปรปรวนรายวัน (Daily Variance 7 วันล่าสุด)</h2>
                </div>
                <div className="h-56 w-full">
                    {dailyVarianceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={dailyVarianceData}
                                margin={{
                                    top: 10,
                                    right: 10,
                                    left: -20,
                                    bottom: 0,
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#E2E8F0"} opacity={0.4} />
                                <XAxis
                                    dataKey="name"
                                    tick={{
                                        fontSize: 11,
                                        fill: isDark ? "#94A3B8" : "#475569",
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{
                                        fontSize: 11,
                                        fill: isDark ? "#94A3B8" : "#475569",
                                    }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        borderRadius: "12px",
                                        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                                        border: `1px solid ${isDark ? "#334155" : "#E2E8F0"}`,
                                    }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                                <Bar dataKey="PO4 แกว่ง" fill="#0052FF" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="NH3 แกว่ง" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-xs font-bold text-text-muted py-10">ไม่มีข้อมูลการแกว่งตัวในช่วง 7 วันล่าสุด</div>
                    )}
                </div>
            </div>

            {/* Critical Table */}
            <div className="bg-surface rounded-2xl p-6 shadow-md border border-border">
                <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 bg-red-50 dark:bg-red-950/20 rounded-xl flex items-center justify-center border border-red-100/50">
                        <AlertTriangle size={15} className="text-danger" />
                    </div>
                    <h2 className="font-bold text-sm uppercase tracking-wider text-text-primary">จุดเสี่ยงวิกฤตชายฝั่งที่พบบ่อยสูงสุด</h2>
                </div>

                {topCritical.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                                <thead>
                                    <tr className="border-b border-border bg-surface-subtle/50 text-text-secondary font-black tracking-wider uppercase">
                                        <th className="px-5 py-4">สถานที่ชายฝั่ง</th>
                                        <th className="px-5 py-4">สังกัดหน่วยงาน</th>
                                        <th className="px-5 py-4 text-center">เตือนภัยอันตราย</th>
                                        <th className="px-5 py-4 text-center">สถานะเฝ้าระวัง</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-surface font-bold text-text-primary">
                                    {topCritical.map((loc) => (
                                        <tr key={loc.id} className="hover:bg-surface-subtle/30 transition-colors">
                                            <td className="px-5 py-4 text-sm font-black">{loc.name}</td>
                                            <td className="px-5 py-4">
                                                <span className="bg-surface-subtle px-3 py-1 rounded-full border border-border text-[10px]">{loc.org}</span>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {loc.danger > 0 ? (
                                                    <span className="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 px-2.5 py-1 rounded-lg border border-red-100">{loc.danger} ครั้ง</span>
                                                ) : (
                                                    <span className="text-text-muted font-normal">-</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {loc.warning > 0 ? (
                                                    <span className="bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 px-2.5 py-1 rounded-lg border border-amber-100">
                                                        {loc.warning} ครั้ง
                                                    </span>
                                                ) : (
                                                    <span className="text-text-muted font-normal">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-10 bg-surface-subtle rounded-xl border border-dashed border-border flex flex-col items-center justify-center">
                        <ShieldCheck size={28} className="text-safe mb-2" />
                        <p className="text-text-primary font-black text-sm">คุณภาพน้ำอยู่ในสภาวะปกติอย่างสมบูรณ์</p>
                        <p className="text-[10px] text-text-muted mt-1">ไม่พบพื้นที่ประมงหรือจุดจัดเก็บน้ำที่อยู่ในระดับวิกฤตหรืออันตราย</p>
                    </div>
                )}
            </div>
        </div>
    );
}
