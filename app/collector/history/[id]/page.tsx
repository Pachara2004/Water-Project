"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import StatusBadge from "@/components/map/StatusBadge";
import { evaluateAllStandards, LOCATION_TYPE_LABELS } from "@/lib/standards";
import { ArrowLeft, Calendar, Camera, CheckCircle2, CloudRain, FlaskConical, MapPin, Microscope, Pencil, ShieldCheck, ShieldX, Thermometer, User, Waves, X } from "lucide-react";
import { getWeatherConditionLabel } from "@/lib/weather";

type WaterStatus = "safe" | "warning" | "danger";
interface LocationOption {
    id: number;
    name: string;
    agency: string;
}

interface SampleDetail {
    id: number;
    collectorId: number;
    locationId: number;
    collectionTime: string;
    uploadedActiveAt: string;
    [key: string]: any; // ⚡️ รองรับคีย์สารเคมีแบบไดนามิกเคลื่อนตาม DB
    dissolvedOxygen: number | null;
    airTemperature: number | null;
    rainAccumulation: number | null;
    weatherCondCode: number | null;
    status: WaterStatus;
    rawImageUrl: string | null;
    analyzedPlotUrl: string | null;
    location: {
        id: number;
        stationName: string;
        governingAgency: string;
        latitude: number;
        longitude: number;
    };
    collector: {
        id: number;
        lineProfileName: string;
        firstName?: string | null;
        lastName?: string | null;
    };
}

// ⚡️ แกนพิกัด Master Data สารเคมีสำหรับวนลูปเรนเดอร์ UI แบบ Dynamic
const PARAM_RENDER_MAP = [
    { key: "phosphateValue", label: "Phosphate", sub: "PO₄", bgClass: "bg-teal-50 dark:bg-teal-950/20", textClass: "text-teal-500", iconColor: "text-teal-500" },
    { key: "ammoniaValue", label: "Ammonia", sub: "NH₃", bgClass: "bg-purple-50 dark:bg-purple-950/20", textClass: "text-purple-500", iconColor: "text-purple-500" },
];

function formatDateTime(value: string) {
    return new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatWeatherCondition(code: number | null) {
    return getWeatherConditionLabel(code ?? undefined);
}

function getValueColor(status: WaterStatus) {
    if (status === "danger") return "text-red-600 dark:text-red-400";
    if (status === "warning") return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
}

export default function CollectorHistoryDetailPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const { currentUser } = useAppStore();
    const [sample, setSample] = useState<SampleDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [imageView, setImageView] = useState<"original" | "plot">("original");

    const [activeParamKey, setActiveParamKey] = useState<string>("phosphate");


    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editData, setEditData] = useState({
        collectionTime: "",
        locationId: "",
        oxygen: "",
    });
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [locationSearch, setLocationSearch] = useState("");
    const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
    const locationDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.role !== "collector" && currentUser.role !== "admin") {
            router.push("/map");
        }
    }, [currentUser, router]);

    useEffect(() => {
        let cancelled = false;

        async function fetchSample() {
            if (!currentUser) return;
            if (currentUser.role !== "collector" && currentUser.role !== "admin") return;
            if (!params.id) return;

            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`/api/samples/${params.id}`, {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${liff.getAccessToken()}`,
                    },
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.error || "ไม่สามารถดึงข้อมูลประวัติได้");
                }

                if (!cancelled) setSample(data);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
                    setSample(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchSample();

        return () => {
            cancelled = true;
        };
    }, [currentUser, params.id]);

    useEffect(() => {
        if (!isEditing || locations.length > 0) return;

        fetch("/api/locations", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${liff.getAccessToken()}`,
            },
        })
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data))
                    setLocations(
                        data.map((l: any) => ({
                            id: l.id,
                            name: l.name,
                            agency: l.organization,
                        })),
                    );
            })
            .catch(console.error);
    }, [isEditing, locations.length]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target as Node)) {
                setLocationDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function toLocalDatetimeInput(iso: string) {
        const d = new Date(iso);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    function startEdit() {
        if (!sample) return;
        const locName = sample.location.stationName;
        setEditData({
            collectionTime: toLocalDatetimeInput(sample.collectionTime),
            locationId: String(sample.location.id),
            oxygen: sample.dissolvedOxygen !== null ? String(sample.dissolvedOxygen) : "",
        });
        setLocationSearch(locName);
        setIsEditing(true);
    }

    function cancelEdit() {
        setIsEditing(false);
        setLocationDropdownOpen(false);
    }

    async function handleSave() {
        if (!sample || !currentUser) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/samples/${sample.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({
                    collectionTime: editData.collectionTime,
                    locationId: editData.locationId,
                    oxygen: editData.oxygen === "" ? null : editData.oxygen,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "เกิดข้อผิดพลาด");
            router.replace(`/collector/history/${data.id}`);
        } catch (err) {
            alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setSaving(false);
        }
    }

    const filteredLocations = locations.filter((l) => l.name?.toLowerCase().includes(locationSearch.toLowerCase()) || l.agency?.toLowerCase().includes(locationSearch.toLowerCase()));
    const isLocationValid = locations.some((l) => String(l.id) === editData.locationId && l.name === locationSearch) || (locations.length === 0 && editData.locationId !== "");

    const standardsEvaluation = useMemo(() => {
        if (!sample) return [];
        const currentPhosphate = sample.phosphateValue ?? 0;
        const currentAmmonia = sample.ammoniaValue ?? 0;

        return Object.entries(evaluateAllStandards(currentPhosphate, currentAmmonia)).map(([type, passed]) => ({
            type,
            label: LOCATION_TYPE_LABELS[type as keyof typeof LOCATION_TYPE_LABELS] || type,
            passed,
        }));
    }, [sample]);

    if (loading) {
        return (
            <div className="min-h-dvh bg-surface-muted px-5 sm:px-8 lg:px-12 py-6 sm:py-10">
                <div className="w-full max-w-3xl mx-auto space-y-5">
                    <div className="h-20 rounded-3xl bg-surface border border-border shadow-sm animate-pulse" />
                    <div className="h-44 rounded-3xl bg-surface border border-border shadow-sm animate-pulse" />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="h-32 rounded-2xl bg-surface border border-border shadow-sm animate-pulse" />
                        <div className="h-32 rounded-2xl bg-surface border border-border shadow-sm animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !sample) {
        return (
            <div className="min-h-dvh bg-surface-muted px-5 sm:px-8 lg:px-12 py-8">
                <div className="max-w-xl mx-auto bg-surface border border-border rounded-3xl p-6 text-center shadow-sm">
                    <div className="w-14 h-14 bg-surface-subtle rounded-2xl border border-border flex items-center justify-center mx-auto mb-4">
                        <FlaskConical size={22} className="text-text-muted" />
                    </div>
                    <h1 className="text-base font-black text-text-primary mb-2">ไม่พบข้อมูลประวัติ</h1>
                    <p className="text-xs text-text-secondary leading-relaxed mb-5">{error || "รายการประวัติที่เลือกอาจถูกลบหรือไม่มีอยู่ในระบบ"}</p>
                    <button
                        onClick={() => router.push("/collector")}
                        className="px-5 py-3 min-h-[44px] rounded-2xl bg-primary text-white text-xs font-bold transition-all active:scale-[0.97] cursor-pointer"
                    >
                        กลับไปหน้าประวัติ
                    </button>
                </div>
            </div>
        );
    }

    const valueColor = getValueColor(sample.status);
    const collectorFullName = `${sample.collector.firstName || ""} ${sample.collector.lastName || ""}`.trim() || sample.collector.lineProfileName;

    return (
        <div className="min-h-screen w-full bg-primary pb-5 antialiased">
            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                <div className="bg-surface rounded-xl border border-border">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-1 text-text-secondary hover:text-text-primary text-xs font-semibold transition-all py-2 px-3.5 rounded-xl w-fit cursor-pointer"
                        >
                            <ArrowLeft size={16} />
                            ย้อนกลับ
                        </button>
                    </div>
                </div>
                <div className="bg-surface px-5 py-5 sm:px-6 rounded-2xl border border-border">
                    <div className="flex items-center justify-between mb-5">
                        {currentUser?.role === "admin" && (
                            <div className="flex items-center gap-2">
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={cancelEdit}
                                            className="flex items-center gap-1.5 text-xs font-bold text-text-secondary bg-surface-subtle border border-border py-1.5 px-3.5 rounded-full cursor-pointer active:scale-95 transition-all"
                                        >
                                            <X size={13} />
                                            ยกเลิก
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving || !isLocationValid}
                                            className="flex items-center gap-1.5 text-xs font-bold text-white bg-primary py-1.5 px-4 rounded-full cursor-pointer active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {saving ? "กำลังบันทึก..." : "บันทึก"}
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={startEdit}
                                        className="flex items-center gap-1.5 text-xs font-bold text-text-secondary bg-surface-subtle border border-border py-1.5 px-3.5 rounded-full cursor-pointer active:scale-95 transition-all"
                                    >
                                        <Pencil size={12} />
                                        แก้ไข
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Location Block */}
                    <div className="rounded-2xl bg-surface-subtle border border-border px-4 py-3">
                        {isEditing ? (
                            <div ref={locationDropdownRef} className="relative">
                                <p className="text-[9px] font-mono font-black uppercase tracking-[0.14em] text-text-muted mb-1.5 flex items-center gap-1">
                                    <MapPin size={10} className="text-primary" /> จุดตรวจ
                                </p>
                                <input
                                    type="text"
                                    value={locationSearch}
                                    onChange={(e) => {
                                        setLocationSearch(e.target.value);
                                        setLocationDropdownOpen(true);
                                        setEditData((prev) => ({
                                            ...prev,
                                            locationId: "",
                                        }));
                                    }}
                                    onFocus={() => setLocationDropdownOpen(true)}
                                    placeholder="พิมพ์เพื่อค้นหาจุดตรวจ..."
                                    className={`w-full text-sm font-bold text-text-primary bg-surface border rounded-xl px-3 py-2 outline-none transition-colors ${
                                        locationSearch && !isLocationValid ? "border-red-400 focus:border-red-500" : "border-border focus:border-primary"
                                    }`}
                                />
                                {locationSearch && !isLocationValid && <p className="text-[10px] text-red-500 font-bold mt-1.5 px-1">กรุณาเลือกจุดตรวจจากรายการ</p>}
                                {locationDropdownOpen && filteredLocations.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-2xl shadow-lg z-50 max-h-48 overflow-y-auto">
                                        {filteredLocations.map((loc) => (
                                            <button
                                                key={loc.id}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    setEditData((prev) => ({
                                                        ...prev,
                                                        locationId: String(loc.id),
                                                    }));
                                                    setLocationSearch(loc.name);
                                                    setLocationDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 text-xs hover:bg-surface-subtle transition-colors cursor-pointer ${editData.locationId === String(loc.id) ? "text-primary font-black" : "text-text-primary font-bold"}`}
                                            >
                                                <span className="block">{loc.name}</span>
                                                <span className="text-text-muted font-normal">{loc.agency}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <MapPin size={14} className="text-primary flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-mono font-black uppercase tracking-[0.14em] text-text-muted">ประวัติผู้เก็บตัวอย่าง</p>
                                        <h1 className="text-sm sm:text-base font-black text-text-primary truncate">{sample.location.stationName}</h1>
                                    </div>
                                </div>
                                <StatusBadge status={sample.status} size="sm" />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-2xl px-4 py-3">
                            <Calendar size={13} className="text-primary flex-shrink-0" />
                            {isEditing ? (
                                <input
                                    title="input"
                                    type="datetime-local"
                                    value={editData.collectionTime}
                                    onChange={(e) =>
                                        setEditData((prev) => ({
                                            ...prev,
                                            collectionTime: e.target.value,
                                        }))
                                    }
                                    className="flex-1 font-bold text-text-primary bg-transparent outline-none text-xs"
                                />
                            ) : (
                                <span className="font-bold">{formatDateTime(sample.collectionTime)}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-2xl px-4 py-3">
                            <User size={13} className="text-primary" />
                            <span className="font-bold truncate">{collectorFullName}</span>
                        </div>
                    </div>
                </div>

                {/* Image Section */}
                {/* 📸 Image Section (Dynamic Tabs Version) */}
                <div className="bg-surface rounded-3xl shadow-sm border border-border overflow-hidden p-3 space-y-3">
                    {/* 🔄 แถบเลือกสารเคมี (Tabs) ดึงตามรายการที่มีใน PARAM_RENDER_MAP */}
                    <div className="flex border-b border-border/60 pb-1.5 gap-1">
                        {PARAM_RENDER_MAP.map((param) => {
                            // สกัดชื่อสารสั้น ๆ ออกมา (เช่น "phosphateValue" -> "phosphate")
                            const paramBaseName = param.key.replace("Value", "").toLowerCase();
                            const isActive = activeParamKey === paramBaseName;

                            return (
                                <button
                                    key={param.key}
                                    onClick={() => setActiveParamKey(paramBaseName)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                        isActive ? "bg-primary text-white border-primary" : "bg-surface-subtle text-text-secondary border-border hover:bg-muted/10"
                                    }`}
                                >
                                    {param.label}
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative">
                        {(() => {
                            // ⚡️ ดึง URL รูปภาพแบบไดนามิกจับคู่ตามชื่อสารเคมี (ล้อตามโครงสร้างอัปโหลดของ API /api/samples)
                            // เช่น sample["rawImageUrl_phosphate"] หรือ sample["analyzedPlotUrl_ammonia"]
                            // (หมายเหตุ: ถ้า DB ของเก็บ URL รวมไว้ที่คีย์กลาง ให้สืบทอดใช้ sample.rawImageUrl เป็นหลักได้ครับ)
                            const rawKey = `rawImageUrl_${activeParamKey}`;
                            const plotKey = `analyzedPlotUrl_${activeParamKey}`;

                            const src = imageView === "original" ? sample[rawKey] || sample.rawImageUrl : sample[plotKey] || sample.analyzedPlotUrl;

                            return src ? (
                                <img src={src} alt={`${activeParamKey} view`} className="w-full h-52 sm:h-72 object-contain rounded-2xl bg-slate-950" />
                            ) : (
                                <div className="w-full h-52 sm:h-72 rounded-2xl bg-surface-subtle border border-border flex flex-col items-center justify-center gap-2">
                                    {imageView === "original" ? <Camera size={28} className="text-text-muted" /> : <Microscope size={28} className="text-text-muted" />}
                                    <span className="text-[10px] font-bold text-text-muted">
                                        {imageView === "original" ? `ไม่มีภาพต้นฉบับสำหรับ ${activeParamKey}` : `ไม่มีภาพพลอตสีสำหรับ ${activeParamKey}`}
                                    </span>
                                </div>
                            );
                        })()}

                        {/* ปุ่มสลับโหมด ต้นฉบับ / พลอตสี คงเดิมไว้ */}
                        <button
                            onClick={() => setImageView((v) => (v === "original" ? "plot" : "original"))}
                            className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full shadow-lg text-white cursor-pointer transition-all active:scale-90"
                        >
                            {imageView === "original" ? <Microscope size={13} /> : <Camera size={13} />}
                            <span className="text-[10px] font-bold">{imageView === "original" ? "พลอตสี" : "ต้นฉบับ"}</span>
                        </button>
                    </div>
                </div>

                {/* Overall Analysis */}
                <div className="bg-surface rounded-3xl shadow-sm border border-border p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                            <CheckCircle2 size={13} />
                        </div>
                        <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Overall Analysis Results</h2>
                    </div>
                    <div className="bg-surface-subtle border border-border rounded-2xl p-5 text-center">
                        <span className="font-mono text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2.5 block">สถานะคุณภาพน้ำโดยรวม</span>
                        <div className="inline-flex">
                            <StatusBadge status={sample.status} size="lg" />
                        </div>
                    </div>
                </div>

                {/* ⚡️ Chemical Values Card (Dynamic Version วนลูปตาม Array) */}
                <div className="grid grid-cols-2 gap-4">
                    {PARAM_RENDER_MAP.map((param) => {
                        const chemicalValue = sample[param.key] !== undefined ? Number(sample[param.key]) : 0;

                        return (
                            <div key={param.key} className="bg-surface rounded-2xl p-5 shadow-sm border border-border flex flex-col justify-between min-h-32">
                                <div className="flex items-center gap-1.5 mb-3">
                                    <div className={`${param.bgClass} p-1.5 rounded-xl border border-border/10`}>
                                        <FlaskConical size={13} className={param.iconColor} />
                                    </div>
                                    <div className="font-mono text-[9px] font-bold text-text-muted uppercase tracking-wider">
                                        {param.label} <span className="text-[8px] font-normal lowercase">({param.sub})</span>
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <div className={`text-2xl sm:text-3xl font-black ${valueColor}`}>{chemicalValue.toFixed(3)}</div>
                                    <span className="font-mono text-[9px] font-bold text-text-muted">mg/L</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Meteorological Inputs */}
                <div className="bg-surface rounded-3xl shadow-sm border border-border p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 bg-primary-light text-primary rounded-xl flex items-center justify-center border border-primary/10">
                            <FlaskConical size={13} />
                        </div>
                        <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Optional Meteorological Inputs</h2>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">ปริมาณออกซิเจนละลายน้ำ (Dissolved Oxygen - DO)</label>
                        <div className="flex items-center justify-between gap-3 w-full px-5 py-3.5 bg-surface-subtle border border-border text-text-primary rounded-2xl min-h-[48px]">
                            {isEditing ? (
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={editData.oxygen}
                                    onChange={(e) =>
                                        setEditData((prev) => ({
                                            ...prev,
                                            oxygen: e.target.value,
                                        }))
                                    }
                                    placeholder="ไม่ได้ระบุ"
                                    className="flex-1 text-sm font-black text-text-primary bg-transparent outline-none"
                                />
                            ) : (
                                <span className={`text-sm font-black ${sample.dissolvedOxygen === null ? "text-text-muted" : "text-text-primary"}`}>
                                    {sample.dissolvedOxygen === null ? "ไม่ได้ระบุ" : sample.dissolvedOxygen.toFixed(2)}
                                </span>
                            )}
                            <span className="font-mono text-[9px] font-bold text-text-muted">mg/L</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                            <div className="bg-surface-subtle border border-border rounded-2xl p-4">
                                <div className="flex items-center gap-2 text-[9px] text-text-muted font-black uppercase tracking-wider">
                                    <Thermometer size={12} className="text-primary" /> Temperature
                                </div>
                                <p className="text-sm font-black text-text-primary mt-2">{sample.airTemperature === null ? "-" : `${sample.airTemperature.toFixed(1)} °C`}</p>
                            </div>
                            <div className="bg-surface-subtle border border-border rounded-2xl p-4">
                                <div className="flex items-center gap-2 text-[9px] text-text-muted font-black uppercase tracking-wider">
                                    <CloudRain size={12} className="text-primary" /> Rain
                                </div>
                                <p className="text-sm font-black text-text-primary mt-2">{sample.rainAccumulation === null ? "-" : `${sample.rainAccumulation.toFixed(1)} mm`}</p>
                            </div>
                            <div className="bg-surface-subtle border border-border rounded-2xl p-4">
                                <div className="flex items-center gap-2 text-[9px] text-text-muted font-black uppercase tracking-wider">
                                    <Waves size={12} className="text-primary" /> Weather
                                </div>
                                <p className="text-xs font-black text-text-primary mt-2 truncate" title={formatWeatherCondition(sample.weatherCondCode)}>
                                    {formatWeatherCondition(sample.weatherCondCode)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Standards Evaluation */}
                <div className="bg-surface rounded-xl border border-border p-5">
                    <h3 className="text-sm font-semibold text-text-secondary mb-4 flex items-center gap-2">
                        <ShieldCheck size={15} className="text-primary" /> การประเมินเทียบเกณฑ์มาตรฐานคุณภาพน้ำทะเล
                    </h3>
                    <div className="grid grid-cols-1 gap-2.5">
                        {standardsEvaluation.map((std) => (
                            <div
                                key={std.type}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium border transition-all ${
                                    std.passed
                                        ? "bg-emerald-50/40 dark:bg-emerald-950/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/20"
                                        : "bg-red-50/40 dark:bg-red-950/15 text-red-800 dark:text-red-300 border-red-500/20"
                                }`}
                            >
                                {std.passed ? <ShieldCheck size={15} className="text-emerald-500 shrink-0" /> : <ShieldX size={15} className="text-red-500 flex-shrink-0" />}
                                <span className="flex-1 truncate">{std.label}</span>
                                <span
                                    className={`text-xs font-medium px-2 py-0.5 rounded-md border shrink-0 ${
                                        std.passed
                                            ? "bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50"
                                            : "bg-red-100/70 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200/50"
                                    }`}
                                >
                                    {std.passed ? "ปลอดภัย" : "ไม่ผ่าน"}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
