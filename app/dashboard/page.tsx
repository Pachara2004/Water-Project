"use client";

import { useState, useEffect, useRef, useMemo, useDeferredValue } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import ExportButtons from "@/components/dashboard/ExportButtons";
import { LucideShieldAlert, LucideTrendingUp, LucideTrendingDown, LucideArrowRight, LucideSearch, LucideX,} from "lucide-react";
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
    const [locationId, setLocationId] = useState<number | null>(null); // เลือกสถานีเจาะจง (ละเอียดกว่า agency) จากผลค้นหา
    const [agencySearch, setAgencySearch] = useState(""); // ข้อความที่พิมพ์ค้นหาหน่วยงาน/สถานี
    const [trendMode, setTrendMode] = useState<"wow" | "mom">("wow");
    const [showAgencyMenu, setShowAgencyMenu] = useState(false); // เปิด/ปิด dropdown ผลค้นหาหน่วยงาน+สถานี
    const agencyMenuRef = useRef<HTMLDivElement>(null);

    const userRole = currentUser?.role?.toLowerCase() || "officer";
    const userId = currentUser?.id || null;

    useEffect(() => {
        if (userRole === "collector") setViewMode("MINE");
        else if (userRole === "officer") setViewMode("ALL");
    }, [userRole]);

    // ปิด dropdown หน่วยงานเวลาคลิกนอกกล่อง
    useEffect(() => {
        if (!showAgencyMenu) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (agencyMenuRef.current && !agencyMenuRef.current.contains(e.target as Node)) setShowAgencyMenu(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showAgencyMenu]);

    useEffect(() => {
        // guest/ยังไม่ login ไม่มีสิทธิ์เห็นหน้านี้อยู่แล้ว (จะโดน guard ด้านล่างเด้งกลับ) — ข้ามการยิง fetch ไปเลย
        // กัน request ที่รู้อยู่แล้วว่าจะโดน 403 จาก backend ไม่ให้ขึ้น error overlay ใน dev เปล่าๆ
        if (!currentUser || userRole === "guest") return;

        // ยกเลิก request เก่าเวลาสลับ filter เร็วๆ — กัน response เก่าที่มาช้ากว่ามาทับผลลัพธ์ของ filter ปัจจุบัน
        const controller = new AbortController();
        setLoading(true);
        setFetchError(false);
        let url = `/api/dashboard/widgets?viewMode=${viewMode}&startDate=${startDate}&endDate=${endDate}&agency=${agency}`;
        if (locationId) url += `&locationId=${locationId}`;

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
    }, [viewMode, userId, userRole, startDate, endDate, agency, locationId, retryTick, currentUser]);

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

    // ตีความว่าทิศทางไหนของการ์ดนี้คือ "ดี" — ใช้ตัดสินสีของ trend badge แทนการฟันธงว่าขึ้น=เขียว/ลง=แดงเสมอ
    // (ตัวอย่างเกินมาตรฐาน/เฝ้าระวังยิ่งลดยิ่งดี ในขณะที่อัตราความปลอดภัยยิ่งขึ้นยิ่งดี ส่วนจำนวนตัวอย่างรวมไม่มีทิศทางที่ดี/แย่ตายตัว)
    const getTrendPolarity = (title: string): "up-good" | "down-good" | "neutral" => {
        if (title.includes("ปลอดภัย")) return "up-good";
        if (title.includes("วิกฤต") || title.includes("Danger") || (title.includes("อันตราย") && !title.includes("เฝ้าระวัง"))) return "down-good";
        if (title.includes("เฝ้าระวัง") || title.includes("Warning")) return "down-good";
        return "neutral";
    };

    const renderTrend = (trend: any, modeLabel: string, polarity: "up-good" | "down-good" | "neutral") => {
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
                {trend.value}
                {suffix} {modeLabel}
            </span>
        );
    };

    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <div className="w-full max-w-xl md:max-w-7xl mx-auto px-4 space-y-5 pt-6">
                <div className="space-y-3">
                    {/* Header ควบคุมส่วนบน */}
                    <div className="bg-card-general rounded-2xl p-5 border border-border flex flex-col items-start text-left gap-3 shrink-0">
                        <div>
                            <h1 className="text-lg font-bold  text-black">
                                แดชบอร์ดติดตาม<span className="text-primary">คุณภาพน้ำ</span>
                            </h1>
                            <p className="text-xs text-black mt-1 leading-relaxed">ข้อมูลคุณภาพแบบเรียลไทม์ และสถิติความแปรปรวนเชิงลึกเพื่อการเฝ้าระวัง</p>
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
                                    const matchedLocations = (analytics?.locations || []).filter((l: any) => l.stationName?.toLowerCase().includes(q) || l.governingAgency?.toLowerCase().includes(q));
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
                                                className={`w-full text-left px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-surface-subtle ${agency === "all" && !locationId ? "text-indigo-600 bg-indigo-50" : "text-text-primary"}`}
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
                                                            className={`w-full text-left px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-surface-subtle truncate ${agency === item ? "text-indigo-600 bg-indigo-50" : "text-text-primary"}`}
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
                                                            className={`w-full text-left px-3 py-1.5 text-xs font-semibold cursor-pointer hover:bg-surface-subtle truncate ${locationId === loc.id ? "text-indigo-600 bg-indigo-50" : "text-text-primary"}`}
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
                        <div className="flex items-center px-2.5 flex-1 min-w-0">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent outline-none text-text-primary font-semibold text-xs cursor-pointer w-full min-w-0"
                            />
                        </div>

                        <span className="text-xs text-primary font-semibold shrink-0">ถึง</span>

                        <div className="flex items-center px-2.5 flex-1 min-w-0">
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent outline-none text-text-primary font-semibold text-xs cursor-pointer w-full min-w-0"
                            />
                        </div>
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
                                className="mt-2 px-4 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
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
                                <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-1.5">
                                    <LucideShieldAlert size={12} /> โหลดข้อมูลล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลเดิมที่มีอยู่
                                </div>
                            )}
                            {userRole === "admin" && (
                                <div className="h-10 grid grid-cols-2 rounded-xl p-1 bg-card-general border border-border font-semibold text-center text-xs shrink-0">
                                    <button
                                        onClick={() => setViewMode("ALL")}
                                        className={`h-full px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${viewMode === "ALL" ? "bg-secondary text-white shadow-xs" : "text-black bg-surface-subtle"}`}
                                    >
                                        ข้อมูลทั้งหมด
                                    </button>
                                    {userRole === "admin" && (
                                        <button
                                            onClick={() => setViewMode("MINE")}
                                            className={`h-full px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${viewMode === "MINE" ? "bg-secondary text-white shadow-xs" : "text-black bg-surface-subtle"}`}
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
                                        className={`h-full px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${trendMode === "wow" ? "bg-secondary text-white shadow-xs" : "text-black bg-surface-subtle"}`}
                                    >
                                        รายสัปดาห์
                                    </button>
                                    <button
                                        onClick={() => setTrendMode("mom")}
                                        className={`h-full px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap ${trendMode === "mom" ? "bg-secondary text-white shadow-xs" : "text-black bg-surface-subtle"}`}
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
                                                            <td className="py-2 text-right font-semibold text-black text-xs">
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
                                            <span className="w-full px-2 inline-flex items-center text-xs font-semibold text-primary bg-bg border border-indigo-100 py-0.5 rounded-md">
                                                {analytics.granularityInfo.label} · {analytics.granularityInfo.rangeLabel}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-h-0">
                                        {getGroupedBars().map((group: any, gIdx: number) => (
                                            <div key={gIdx} className="bg-bg rounded-lg p-2 border border-border flex flex-col justify-between h-60">
                                                <div className="text-xs font-semibold mb-1" style={{ color: group.title === "Ammonia" ? CHEM_COLOR.nh3 : CHEM_COLOR.po4 }}>
                                                    สถิติความเข้มข้นสะสม: {group.title}
                                                </div>
                                                <div className="w-full flex-1 min-h-0">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={analytics?.temporalData} margin={{ top: 10, right: 5, left: -25, bottom: -5 }}>
                                                            <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" />
                                                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                                                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                                                            <Tooltip wrapperStyle={{ fontSize: "12px" }} cursor={false} />
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
                                        <span className="w-full px-2 inline-flex items-center text-xs font-semibold text-primary bg-bg border border-indigo-100 py-0.5 rounded-md">
                                            {analytics.granularityInfo.label} · {analytics.granularityInfo.rangeLabel}
                                        </span>
                                    )}
                                </div>
                                <div className="h-40 w-full mt-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={analytics?.trends} margin={{ top: 15, right: 5, left: -25, bottom: -5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} />
                                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                                            <Tooltip />
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
                    <div key={i} className={`bg-surface rounded-xl border border-border p-2.5 flex flex-col border-l-10 border-l-slate-200 ${kpiSpanClass(3)}`}>
                        <Sk className="h-2.5 w-3/4 mb-2" />
                        <Sk className="h-5 w-1/2 mb-2" />
                        <Sk className="h-3 w-2/5" />
                    </div>
                ))}
            </div>

            {/* มิติที่ 2 & 3: Hotspots + Temporal */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                <div className="col-span-1 md:col-span-5 bg-surface rounded-xl border border-border p-3 shadow-xs">
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
                <div className="col-span-1 md:col-span-7 bg-surface rounded-xl border border-border p-3 shadow-xs flex flex-col gap-3">
                    <Sk className="h-3.5 w-3/4" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="bg-surface-subtle rounded-lg p-2 border border-border h-52 flex flex-col gap-2">
                                <Sk className="h-2.5 w-1/2" />
                                <Sk className="flex-1 w-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* มิติที่ 4: WaterTrendChart */}
            <div className="bg-surface rounded-xl border border-border p-3 shadow-xs shrink-0">
                <Sk className="h-3.5 w-1/2 mb-2" />
                <Sk className="h-40 w-full" />
            </div>

            {/* มิติที่ 5: Correlation */}
            <div className="bg-surface rounded-xl border border-border p-3 shadow-xs shrink-0">
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
                            <div key={i} className="rounded-lg border border-border p-2">
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
// สีประจำสารเคมี — ใช้ตัวเดียวกับที่ WaterTrendChart ใช้ (trendConfig.lines) ให้สื่อความหมายตรงกันทั้งหน้า ไม่ใช่คนละสีในแต่ละกราฟ
const CHEM_COLOR: Record<"nh3" | "po4", string> = { nh3: "#f59e0b", po4: "#6366f1" };

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
    const pill = (on: boolean) => `px-2 py-0.5 rounded-md transition-all cursor-pointer ${on ? "bg-surface text-indigo-600 shadow-xs" : "text-text-muted"}`;

    return (
        <div className="bg-surface rounded-xl border border-border p-3 shadow-xs shrink-0">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <div className="text-sm font-semibold text-text-primary truncate">{correlation.title || "Correlation"}</div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="grid grid-cols-2 rounded-lg p-0.5 bg-surface-subtle border border-border text-xs font-semibold">
                        <button onClick={() => setAxis("rain")} className={pill(axis === "rain")}>
                            ฝน
                        </button>
                        <button onClick={() => setAxis("temp")} className={pill(axis === "temp")}>
                            อุณหภูมิ
                        </button>
                    </div>
                    <div className="grid grid-cols-2 rounded-lg p-0.5 bg-surface-subtle border border-border text-xs font-semibold">
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
                            style={{ width: "100%", height: "auto" }}
                            role="img"
                            aria-label={`density heatmap ของ ${xLabel} กับความเข้มข้น${chem === "nh3" ? " Ammonia" : " Phosphate"}`}
                        >
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
                                    stroke={CHEM_COLOR[dChem]}
                                    strokeWidth={1.6}
                                    strokeOpacity={view.trendLine.opacity}
                                    strokeDasharray="5 4"
                                />
                            )}
                            {view.xTicks.map((t: any, i: number) => (
                                <text key={`x${i}`} x={t.x} y={VB_H - 13} fontSize={12} fill="#94a3b8" textAnchor="middle">
                                    {t.label}
                                </text>
                            ))}
                            {view.yTicks.map((t: any, i: number) => (
                                <text key={`y${i}`} x={mL - 5} y={t.y + 3} fontSize={12} fill="#94a3b8" textAnchor="end">
                                    {t.label}
                                </text>
                            ))}
                            <text x={mL + pw / 2} y={VB_H - 2} fontSize={12} fill="#64748b" textAnchor="middle">
                                {xLabel}
                            </text>
                            <text x={11} y={mT + ph / 2} fontSize={12} fill="#64748b" textAnchor="middle" transform={`rotate(-90 11 ${mT + ph / 2})`}>
                                ความเข้มข้น (mg/L)
                            </text>
                        </svg>
                    ) : (
                        <div className="h-48 flex items-center justify-center text-text-muted text-xs">ไม่มีข้อมูลเพียงพอสำหรับชุดนี้</div>
                    )}
                    {/* legend */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted flex-wrap">
                        <div className="flex items-center gap-1">
                            <span>จุดน้อย</span>
                            <span className="inline-block w-16 h-2 rounded" style={{ background: "linear-gradient(90deg,#dbeafe,#3b82f6,#1e3a8a)" }} />
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
                                className={`rounded-lg border p-2 text-center transition-all cursor-pointer ${active ? "border-indigo-300 bg-indigo-50/60" : "border-border bg-surface-subtle/40 opacity-50 hover:opacity-80"}`}
                            >
                                <div className={`text-base font-bold ${rColor}`}>{m.r === null ? "—" : (m.r > 0 ? "+" : "") + m.r}</div>
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
