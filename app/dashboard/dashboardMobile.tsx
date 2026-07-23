"use client";

import ExportButtons from "@/components/dashboard/ExportButtons";
import { LucideShieldAlert, LucideSearch, LucideX } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { useDashboardAnalytics } from "@/lib/hooks/useDashboardAnalytics";
import { chartTokens, kpiSpanClass, CHEM_COLOR, getGroupedBars, getTrendPolarity, renderTrend, DateField, CorrelationSection } from "@/components/dashboard/dashboardHelpers";

export default function DashboardMobile() {
    const {
        theme,
        router,
        userRole,
        viewMode,
        setViewMode,
        analytics,
        fetchError,
        setRetryTick,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        agency,
        setAgency,
        locationId,
        setLocationId,
        agencySearch,
        setAgencySearch,
        trendMode,
        setTrendMode,
        showAgencyMenu,
        setShowAgencyMenu,
        agencyMenuRef,
        currentUser,
    } = useDashboardAnalytics();
    const chartTone = chartTokens(theme === "dark");

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
                    className="w-full max-w-50 py-3.5 bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                >
                    กลับไปหน้าแผนที่
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <div className="w-full max-w-xl md:max-w-7xl mx-auto px-4 space-y-5 pt-6">
                <div className="space-y-3">
                    {/* Header ควบคุมส่วนบน */}
                    <div className="bg-card-general rounded-2xl p-5 border border-border flex flex-col items-start text-left gap-3 shrink-0">
                        <div>
                            <h1 className="text-lg font-bold  text-text-primary">
                                แดชบอร์ดติดตาม<span className="text-primary">คุณภาพน้ำ</span>
                            </h1>
                            <p className="text-xs text-text-secondary mt-1 leading-relaxed">ข้อมูลคุณภาพแบบเรียลไทม์ และสถิติความแปรปรวนเชิงลึกเพื่อการเฝ้าระวัง</p>
                        </div>
                        <ExportButtons />
                    </div>

                    {/* แถบสลับมุมมองข้อมูล */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* ค้นหาหน่วยงาน/สถานี แทนที่ dropdown เดิม — พิมพ์แล้วกรองรายชื่อจาก analytics.agencies + analytics.locations */}
                        <div className="relative flex-1" ref={agencyMenuRef}>
                            <div className="h-10 w-full text-xs flex items-center gap-1.5 bg-card-general border border-border rounded-xl px-3 transition-all">
                                <LucideSearch size={13} className="text-text-muted shrink-0" />
                                <input
                                    type="text"
                                    value={agencySearch}
                                    onFocus={(e) => {
                                        setShowAgencyMenu(true);
                                        e.target.select();
                                    }}
                                    onChange={(e) => {
                                        setAgencySearch(e.target.value);
                                        setShowAgencyMenu(true);
                                    }}
                                    placeholder="ค้นหาหน่วยงาน/สถานี"
                                    className="bg-transparent outline-none text-text-primary font-semibold text-xs w-full min-w-0"
                                />
                                {(agency !== "all" || locationId) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAgency("all");
                                            setLocationId(null);
                                            setAgencySearch("");
                                        }}
                                        className="shrink-0 text-text-muted hover:text-text-secondary cursor-pointer"
                                        aria-label="ล้างตัวกรองหน่วยงาน/สถานี"
                                    >
                                        <LucideX size={13} />
                                    </button>
                                )}
                            </div>

                            {showAgencyMenu &&
                                (() => {
                                    const q = agencySearch.trim().toLowerCase();
                                    const matchedAgencies = (analytics?.agencies || []).filter((a: string) => a.toLowerCase().includes(q));
                                    const matchedLocations = (analytics?.locations || []).filter(
                                        (l: any) => l.stationName?.toLowerCase().includes(q) || l.governingAgency?.toLowerCase().includes(q),
                                    );
                                    const hasResults = matchedAgencies.length > 0 || matchedLocations.length > 0;
                                    return (
                                        <div className="absolute z-20 top-full left-0 mt-1 w-full bg-surface border border-border rounded-xl shadow-lg py-1 max-h-72 overflow-y-auto">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAgency("all");
                                                    setLocationId(null);
                                                    setAgencySearch("");
                                                    setShowAgencyMenu(false);
                                                }}
                                                className={`w-full text-left px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-surface-subtle ${agency === "all" && !locationId ? "text-primary bg-primary/10" : "text-text-primary"}`}
                                            >
                                                ทุกหน่วยงาน
                                            </button>

                                            {matchedAgencies.length > 0 && (
                                                <>
                                                    <div className="px-3 pt-2 pb-1 text-xs font-semibold text-text-muted">หน่วยงาน</div>
                                                    {matchedAgencies.map((item: string, i: number) => (
                                                        <button
                                                            type="button"
                                                            key={i}
                                                            onClick={() => {
                                                                setAgency(item);
                                                                setLocationId(null);
                                                                setAgencySearch(item);
                                                                setShowAgencyMenu(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-surface-subtle truncate ${agency === item ? "text-primary bg-primary/10" : "text-text-primary"}`}
                                                        >
                                                            {item}
                                                        </button>
                                                    ))}
                                                </>
                                            )}

                                            {matchedLocations.length > 0 && (
                                                <>
                                                    <div className="px-3 pt-2 pb-1 text-xs font-semibold text-text-muted">สถานี</div>
                                                    {matchedLocations.map((loc: any) => (
                                                        <button
                                                            type="button"
                                                            key={loc.id}
                                                            onClick={() => {
                                                                setLocationId(loc.id);
                                                                setAgency("all");
                                                                setAgencySearch(loc.stationName);
                                                                setShowAgencyMenu(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-surface-subtle truncate ${locationId === loc.id ? "text-primary bg-primary/10" : "text-text-primary"}`}
                                                        >
                                                            {loc.stationName}
                                                            <span className="text-text-muted font-normal"> · {loc.governingAgency}</span>
                                                        </button>
                                                    ))}
                                                </>
                                            )}

                                            {!hasResults && q && <div className="px-3 py-2 text-xs text-text-muted">ไม่พบ "{agencySearch}"</div>}
                                        </div>
                                    );
                                })()}
                        </div>
                    </div>

                    {/* แถบตัวกรองช่วงวันที่ — เชื่อมเป็นกล่องเดียวกัน คั่นกลางด้วยคำว่า "ถึง" สื่อว่าเป็นช่วงวันที่ */}
                    <div className="h-10 flex items-center w-full shrink-0 bg-card-general border border-border rounded-xl transition-all">
                        <DateField label="วันที่เริ่มต้น" value={startDate} onChange={setStartDate} />

                        <span className="text-xs text-primary font-semibold shrink-0">ถึง</span>

                        <DateField label="วันที่สิ้นสุด" value={endDate} onChange={setEndDate} />
                    </div>

                    {/* ส่วนการตรวจสอบสถานะและวาดสารสนเทศ */}
                    {/* โชว์ skeleton เต็มจอเฉพาะโหลดครั้งแรก (ยังไม่มีข้อมูลเลย) — ถ้าแค่เปลี่ยน filter ให้คงเนื้อหาเดิมไว้ + dim เบาๆ แทน กัน flash ตอนโหลดเร็ว */}
                    {fetchError && !analytics ? (
                        // โหลดครั้งแรกพังเลย ยังไม่มีข้อมูลเก่าให้โชว์เลย — แจ้ง error เต็มจอพร้อมปุ่มลองใหม่
                        <div className="bg-surface rounded-xl border border-border p-10 flex flex-col items-center justify-center gap-2 text-center">
                            <LucideShieldAlert size={28} className="text-red-400" />
                            <div className="text-sm font-semibold text-text-primary">ไม่สามารถโหลดข้อมูลได้</div>
                            <div className="text-xs text-text-muted">เกิดข้อผิดพลาดขณะดึงข้อมูลจากระบบ กรุณาลองใหม่อีกครั้ง</div>
                            <button
                                onClick={() => setRetryTick((t) => t + 1)}
                                className="mt-2 px-4 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors cursor-pointer"
                            >
                                ลองใหม่อีกครั้ง
                            </button>
                        </div>
                    ) : !analytics ? null : (
                        <div className={`space-y-3 transition-opacity duration-200 ${!analytics ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                            {" "}
                            {fetchError && (
                                // มีข้อมูลเก่าอยู่แล้ว แค่ refetch รอบนี้พัง — คงข้อมูลเดิมไว้ให้ดู แค่แจ้งเตือนว่าอาจไม่ใช่ข้อมูลล่าสุด
                                <div className="bg-bg-danger border border-border-danger text-text-danger text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-1.5">
                                    <LucideShieldAlert size={12} /> โหลดข้อมูลล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลเดิมที่มีอยู่
                                </div>
                            )}
                            {userRole === "admin" && (
                                <div className="h-10 grid grid-cols-2 rounded-xl p-1 bg-card-general border border-border font-semibold text-center text-xs shrink-0">
                                    <button
                                        onClick={() => setViewMode("ALL")}
                                        className={`h-full px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${viewMode === "ALL" ? "bg-secondary text-white shadow-xs" : "text-text-secondary bg-surface-subtle"}`}
                                    >
                                        ข้อมูลทั้งหมด
                                    </button>
                                    {userRole === "admin" && (
                                        <button
                                            onClick={() => setViewMode("MINE")}
                                            className={`h-full px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${viewMode === "MINE" ? "bg-secondary text-white shadow-xs" : "text-text-secondary bg-surface-subtle"}`}
                                        >
                                            ข้อมูลของฉัน
                                        </button>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center pt-2 justify-between shrink-0">
                                <div className="text-md font-bold text-primary px-1">ตัวชี้วัดหลัก</div>
                                <div className="h-9 grid grid-cols-2 rounded-xl p-1 bg-card-general border border-border text-xs font-semibold">
                                    <button
                                        onClick={() => setTrendMode("wow")}
                                        className={`h-full px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${trendMode === "wow" ? "bg-secondary text-white shadow-xs" : "text-text-secondary bg-surface-subtle"}`}
                                    >
                                        รายสัปดาห์
                                    </button>
                                    <button
                                        onClick={() => setTrendMode("mom")}
                                        className={`h-full px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${trendMode === "mom" ? "bg-secondary text-white shadow-xs" : "text-text-secondary bg-surface-subtle"}`}
                                    >
                                        รายเดือน
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 shrink-0">
                                {analytics?.kpis?.map((kpi: any, index: number) => (
                                    <div
                                        key={index}
                                        className={`bg-card-summary rounded-xl border border-border p-2.5  flex flex-col border-l-10 ${kpiSpanClass(kpi.w)}`}
                                        style={{ borderLeftColor: kpi.color || "#6366f1" }}
                                    >
                                        <div className="text-xs font-semibold text-white uppercase tracking-wide flex items-center gap-1">
                                            <span>{kpi.title}</span>
                                        </div>
                                        <div className="mt-1 truncate flex items-baseline gap-1">
                                            <span className="text-3xl font-bold text-white items-end flex content-end tracking-tight">
                                                {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
                                            </span>
                                            {kpi.unit && <span className="text-md text-white font-semibold ml-0.5">{kpi.unit}</span>}
                                        </div>
                                        {kpi.trend && getTrendPolarity(kpi.title) !== "neutral" && (
                                            <div className="mt-1">{renderTrend(kpi.trend[trendMode], trendMode === "wow" ? "WoW" : "MoM", getTrendPolarity(kpi.title))}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 gap-2.5">
                                {/* ตาราง Hotspots เสี่ยงอันตรายสะสมสูงสุด — ซ่อนตอนเลือกสถานีเดียว เพราะข้อมูลซ้ำกับการ์ด KPI ด้านบนที่ scope ตามสถานีเดียวกันอยู่แล้ว */}
                                {!analytics?.stationDetail && (
                                    <div className="col-span-1 bg-surface rounded-xl border border-border p-4 flex flex-col overflow-hidden justify-between">
                                        <div className="text-sm font-semibold text-text-primary mb-2 shrink-0">{analytics?.hotspotConfig?.title}</div>
                                        <div className="w-full overflow-hidden flex-1">
                                            <table className="w-full text-left text-xs text-text-secondary table-fixed">
                                                <thead>
                                                    <tr className="border-b border-border text-primary text-xs font-semibold">
                                                        <th className="pb-1.5 w-[10%]">#</th>
                                                        <th className="pb-1.5 w-[55%]">สถานี</th>
                                                        <th className="pb-1.5 w-[20%] text-center">อัตรา</th>
                                                        <th className="pb-1.5 w-[15%] text-right ">ครั้ง</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {analytics?.hotspots?.map((spot: any, index: number) => (
                                                        <tr key={index} className="hover:bg-surface-subtle/40">
                                                            <td className="py-2 font-semibold text-text-muted">{index + 1}</td>
                                                            <td className="py-2 truncate wrap-break-word">
                                                                <div className="font-semibold text-text-primary truncate text-xs">{spot.stationName}</div>
                                                                <div className="text-xs text-text-muted truncate mt-0.5">{spot.agency}</div>
                                                            </td>
                                                            <td className="py-2 font-semibold text-text-danger text-center text-xs">{spot.failureRate}%</td>
                                                            <td className="py-2 text-right font-semibold text-text-primary text-xs">
                                                                {spot.dangerCount}/{spot.totalCount}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                <div
                                    className={`col-span-1 bg-card-general rounded-xl border border-border p-3 flex flex-col gap-3 overflow-hidden ${analytics?.stationDetail ? "md:col-span-12" : "md:col-span-7"}`}
                                >
                                    <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
                                        <div className="text-sm font-semibold text-text-primary">
                                            <p>ความผันผวนของสารเคมี</p>(เปรียบเทียบช่วงเวลา เช้า vs เย็น แยกประเภท)
                                        </div>
                                        {analytics?.granularityInfo && (
                                            <span className="w-full px-2 inline-flex items-center text-xs font-semibold text-primary bg-bg border border-primary/20 py-0.5 rounded-md">
                                                {analytics.granularityInfo.label} · {analytics.granularityInfo.rangeLabel}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-h-0">
                                        {getGroupedBars(analytics).map((group: any, gIdx: number) => (
                                            <div key={gIdx} className="bg-bg rounded-lg p-2 border border-border flex flex-col justify-between h-60">
                                                <div className="text-xs font-semibold mb-1" style={{ color: group.title === "Ammonia" ? CHEM_COLOR.nh3 : CHEM_COLOR.po4 }}>
                                                    สถิติความเข้มข้นสะสม: {group.title}
                                                </div>
                                                <div className="w-full flex-1 min-h-0">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={analytics?.temporalData} margin={{ top: 10, right: 5, left: -25, bottom: -5 }}>
                                                            <CartesianGrid strokeDasharray="2 2" stroke={chartTone.grid} />
                                                            <XAxis dataKey="name" stroke={chartTone.axis} fontSize={12} tickLine={false} />
                                                            <YAxis stroke={chartTone.axis} fontSize={12} tickLine={false} />
                                                            <Tooltip wrapperStyle={{ fontSize: "12px" }} contentStyle={chartTone.tooltip} cursor={false} />
                                                            <Legend iconSize={8} wrapperStyle={{ fontSize: "12px", bottom: -5 }} />
                                                            {group.items.map((bar: any, bIdx: number) => (
                                                                <Bar key={bIdx} dataKey={bar.key} name={bar.name.replace(group.title, "").trim() || bar.name} fill={bar.color} radius={[2, 2, 0, 0]} />
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
                            <div className="bg-surface rounded-xl border border-border p-3 shadow-xs shrink-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="text-sm font-semibold text-text-primary mb-0.5">{analytics?.trendConfig?.title || " WaterTrendChart"}</div>
                                    {analytics?.granularityInfo && (
                                        <span className="w-full px-2 inline-flex items-center text-xs font-semibold text-primary bg-bg border border-primary/20 py-0.5 rounded-md">
                                            {analytics.granularityInfo.label} · {analytics.granularityInfo.rangeLabel}
                                        </span>
                                    )}
                                </div>
                                <div className="h-40 w-full mt-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={analytics?.trends} margin={{ top: 15, right: 5, left: -25, bottom: -5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={chartTone.grid} />
                                            <XAxis dataKey="date" stroke={chartTone.axis} fontSize={12} tickLine={false} />
                                            <YAxis stroke={chartTone.axis} fontSize={12} tickLine={false} />
                                            <Tooltip contentStyle={chartTone.tooltip} />
                                            <Legend iconSize={8} wrapperStyle={{ fontSize: "12px" }} />

                                            {analytics?.trendConfig?.references?.map((ref: any, rIdx: number) => (
                                                <ReferenceLine key={rIdx} y={ref.value} stroke={ref.color} strokeDasharray="3 3" />
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
                                                    label={{ position: "top", fill: line.color, fontSize: 12 }}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* เกณฑ์ควบคุม PCD — ย้ายมาไว้ใต้กราฟแทนการลอย label ทับเส้นข้อมูลข้างใน */}
                                {analytics?.trendConfig?.references?.length > 0 && (
                                    <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 mt-1.5 pt-1.5 border-t border-border">
                                        {analytics.trendConfig.references.map((ref: any, rIdx: number) => (
                                            <span key={rIdx} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: ref.color }}>
                                                <span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: ref.color }} /> {ref.label}
                                            </span>
                                        ))}
                                    </div>
                                )}
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
