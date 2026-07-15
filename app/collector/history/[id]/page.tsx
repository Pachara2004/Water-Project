"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import { evaluateAllStandards, LOCATION_TYPE_LABELS } from "@/lib/standards";
import { ArrowLeft, Calendar, MapPin, Pencil, User, FlaskConical, Thermometer, CloudRain, Waves } from "lucide-react";
import { getWeatherConditionLabel } from "@/lib/weather";

import StatusBadge from "@/components/map/StatusBadge";
import { ImageZone } from "@/components/submit/ImageZone";
import { ResultsPanel } from "@/components/submit/ResultsPanel";

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
    [key: string]: any;
    dissolvedOxygen: number | null;
    airTemperature: number | null;
    rainAccumulation: number | null;
    weatherCondCode: number | null;
    status: WaterStatus;
    rawImageUrl: string | null;
    analyzedPlotUrl: string | null;
    paramImagesMap?: Record<number, { raw: string | null; plot: string | null }>;
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

function formatDateTime(value: string) {
    return new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function CollectorHistoryDetailPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const { currentUser } = useAppStore();
    const [sample, setSample] = useState<SampleDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editData, setEditData] = useState({ collectionTime: "", locationId: "", oxygen: "" });
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [locationSearch, setLocationSearch] = useState("");
    const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
    const locationDropdownRef = useRef<HTMLDivElement>(null);

    // ── 1. ค้นหาและสร้างพารามิเตอร์แบบ Dynamic จากโครงสร้าง measurements จริงในเรคคอร์ดนี้ ──
    const systemParameters = useMemo(() => {
        if (!sample || !Array.isArray(sample.measurements)) return [];

        return sample.measurements.map((m: any) => ({
            id: m.parameter?.id || m.parameterId,
            name: m.parameter?.name || "unknown",
            unit: m.parameter?.unit || "mg/L",
        }));
    }, [sample]);

    // ── 2. ดึงความสัมพันธ์แบบ Dynamic สกัดค่ารายสารและผูกรูปภาพตามสเปกจริงประจำเรคคอร์ด ──
    const mockSubmitHook = useMemo(() => {
        if (!sample || systemParameters.length === 0) return null;

        const resultsMap: Record<number, any> = {};
        const imagePreviewsMap: Record<number, string> = {};
        const imagePlotFilesMap: Record<number, any> = {};

        systemParameters.forEach((param) => {
            const paramId = param.id;
            const paramNameLower = param.name.toLowerCase();

            const mData = Array.isArray(sample.measurements) ? sample.measurements.find((m: any) => (m.parameter?.id || m.parameterId) === paramId) : null;

            resultsMap[paramId] = {
                concentrated: mData ? mData.value : (sample[`${paramNameLower}Value`] ?? sample[`${paramNameLower}Val`] ?? 0),
                confidence: mData ? mData.confidence : (sample[`${paramNameLower}Confidence`] ?? sample.confidence ?? 0.9),
                status: sample.status,
            };

            // 🌟 ดึงรูปภาพแยกรายสารเคมีที่ถูกต้องผ่านแผนผัง paramImagesMap ที่หลังบ้านแมปคู่ขนานส่งมาให้ครับบอส!
            const specificImages = sample.paramImagesMap?.[paramId];

            imagePreviewsMap[paramId] = specificImages?.raw || sample.rawImageUrl || "";
            imagePlotFilesMap[paramId] = specificImages?.plot || sample.analyzedPlotUrl || "";
        });

        return {
            systemParameters,
            results: resultsMap,
            imagePreviews: imagePreviewsMap,
            imagePlotFiles: imagePlotFilesMap,
            locationType: "COMMUNITY",
            overallStatus: sample.status,
            step: "results" as const,
            saved: true,
            setImageFiles: () => {},
            setImagePreviews: () => {},
            setIsRecommending: () => {},
            setNearestLocations: () => {},
            setStep: () => {},
            allLocations: [],
        };
    }, [sample, systemParameters]);

    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.role !== "collector" && currentUser.role !== "admin") router.push("/map");
    }, [currentUser, router]);

    useEffect(() => {
        let cancelled = false;
        async function fetchSample() {
            if (!currentUser || (currentUser.role !== "collector" && currentUser.role !== "admin") || !params.id) return;
            try {
                setLoading(true);
                setError(null);
                const response = await fetch(`/api/samples/${params.id}`, {
                    method: "GET",
                    headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data?.error || "ไม่สามารถดึงข้อมูลประวัติได้");
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
            headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
        })
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setLocations(data.map((l: any) => ({ id: l.id, name: l.name, agency: l.organization })));
            })
            .catch(console.error);
    }, [isEditing, locations.length]);

    function startEdit() {
        if (!sample) return;
        setEditData({
            collectionTime: new Date(new Date(sample.collectionTime).getTime() - new Date(sample.collectionTime).getTimezoneOffset() * 60000).toISOString().slice(0, 16),
            locationId: String(sample.location.id),
            oxygen: sample.dissolvedOxygen !== null ? String(sample.dissolvedOxygen) : "",
        });
        setLocationSearch(sample.location.stationName);
        setIsEditing(true);
    }

    async function handleSave() {
        if (!sample || !currentUser) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/samples/${sample.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${liff.getAccessToken()}` },
                body: JSON.stringify({ collectionTime: editData.collectionTime, locationId: editData.locationId, oxygen: editData.oxygen === "" ? null : editData.oxygen }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "เกิดข้อผิดพลาด");
            setIsEditing(false);
            setSample(data);
        } catch (err) {
            alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setSaving(false);
        }
    }

    const filteredLocations = locations.filter((l) => l.name?.toLowerCase().includes(locationSearch.toLowerCase()) || l.agency?.toLowerCase().includes(locationSearch.toLowerCase()));
    const isLocationValid = locations.some((l) => String(l.id) === editData.locationId && l.name === locationSearch) || (locations.length === 0 && editData.locationId !== "");

    if (loading) return <div className="min-h-screen text-center p-8 text-xs text-text-muted">กำลังดึงข้อมูลประวัติ...</div>;
    if (error) return <div className="min-h-screen text-center p-8 text-xs text-red-500">เกิดข้อผิดพลาด: {error}</div>;
    if (!sample) return <div className="min-h-screen text-center p-8 text-xs text-text-muted">ไม่พบข้อมูลประวัติ</div>;
    if (!mockSubmitHook) return <div className="min-h-screen text-center p-8 text-xs text-text-muted">ไม่มีข้อมูลพารามิเตอร์เคมีในระบบ</div>;

    const collectorFullName = `${sample.collector.firstName || ""} ${sample.collector.lastName || ""}`.trim() || sample.collector.lineProfileName;

    const HistoryMetaBlocks = () => (
        <div className="space-y-4">
            <section className="rounded-xl bg-surface overflow-hidden border border-border p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-xs text-primary font-bold">ข้อมูลจุดตรวจวัด</span>
                    <StatusBadge status={sample.status} size="md" />
                </div>
                {isEditing ? (
                    <div ref={locationDropdownRef} className="relative mt-2">
                        <input
                            type="text"
                            value={locationSearch}
                            placeholder="พิมพ์เพื่อค้นหาจุดตรวจ..."
                            onChange={(e) => {
                                setLocationSearch(e.target.value);
                                setLocationDropdownOpen(true);
                                setEditData((p) => ({ ...p, locationId: "" }));
                            }}
                            onFocus={() => setLocationDropdownOpen(true)}
                            className={`w-full text-xs bg-surface-subtle border rounded-lg px-3 py-2.5 outline-none ${locationSearch && !isLocationValid ? "border-red-400" : "border-border focus:border-teal-500"}`}
                        />
                        {locationDropdownOpen && filteredLocations.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto">
                                {filteredLocations.map((loc) => (
                                    <button
                                        key={loc.id}
                                        onClick={() => {
                                            setEditData((p) => ({ ...p, locationId: String(loc.id) }));
                                            setLocationSearch(loc.name);
                                            setLocationDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs hover:bg-surface-subtle border-b last:border-0"
                                    >
                                        <span className="block font-bold">{loc.name}</span>
                                        <span className="text-[10px] text-text-muted">{loc.agency}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-start gap-2 text-xs pt-1 p-1">
                        <MapPin size={24} className="text-teal-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-bold text-text-primary text-sm">{sample.location.stationName}</p>
                            <p className="text-xs text-text-muted mt-0.5">{sample.location.governingAgency}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-xl px-4 py-3">
                        <Calendar size={24} className="text-secondary shrink-0" />
                        {isEditing ? (
                            <input
                                title="input"
                                type="datetime-local"
                                value={editData.collectionTime}
                                onChange={(e) => setEditData((p) => ({ ...p, collectionTime: e.target.value }))}
                                className="flex-1 font-bold text-text-primary bg-transparent text-xs"
                            />
                        ) : (
                            <span className="font-bold">{formatDateTime(sample.collectionTime)}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-xl px-4 py-3">
                        <User size={24} className="text-secondary" />
                        <span className="font-bold truncate">{collectorFullName}</span>
                    </div>
                </div>
                <div className="bg-surface-subtle border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2">
                            <FlaskConical size={24} className="text-secondary" />
                            <p className="text-xs font-bold text-secondary">ปริมาณออกซิเจนละลายน้ำ</p>
                        </div>
                        {isEditing ? (
                            <input
                                type="number"
                                step="0.01"
                                value={editData.oxygen}
                                onChange={(e) => setEditData((p) => ({ ...p, oxygen: e.target.value }))}
                                placeholder="ไม่ได้ระบุ"
                                className="flex-1 text-xs font-bold text-text-primary bg-transparent text-right outline-none px-2"
                            />
                        ) : (
                            <span className="text-xs font-bold text-text-primary ml-auto pr-2">{sample.dissolvedOxygen === null ? "-" : sample.dissolvedOxygen.toFixed(2)}</span>
                        )}
                        <span className="text-xs font-bold shrink-0">mg/L</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    <div className="bg-surface-subtle border border-border rounded-xl p-4 text-center">
                        <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                                <Thermometer size={24} className="text-secondary" />
                                <p className="text-xs font-bold text-secondary">อุณหภูมิ</p>
                            </div>
                            <p className="text-sm font-bold text-text-primary">{sample.airTemperature === null ? "-" : `${sample.airTemperature.toFixed(1)} °C`}</p>
                        </div>
                    </div>
                    <div className="bg-surface-subtle border border-border rounded-xl p-4 text-center">
                        <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                                <CloudRain size={24} className="text-secondary" />
                                <p className="text-xs font-bold text-secondary">ปริมาณฝน</p>
                            </div>
                            <p className="text-sm font-bold text-text-primary">{sample.rainAccumulation === null ? "-" : `${sample.rainAccumulation.toFixed(1)} mm`}</p>
                        </div>
                    </div>
                    <div className="bg-surface-subtle border border-border rounded-xl p-4 text-center">
                        <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                                <Waves size={24} className="text-secondary" />
                                <p className="text-xs font-bold text-secondary">สภาพอากาศ</p>
                            </div>
                            <p className="text-sm font-bold text-text-primary truncate">{getWeatherConditionLabel(sample.weatherCondCode ?? undefined)}</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );

    return (
        <div className="min-h-dvh w-full bg-surface-muted pb-5 antialiased transition-colors duration-300">
            <div className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-secondary min-h-11">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-primary">รายละเอียดประวัติการตรวจสอบ</h1>
                </div>
                {currentUser?.role === "admin" ? (
                    <div className="flex items-center">
                        {isEditing ? (
                            <div className="flex gap-1.5">
                                <button onClick={() => setIsEditing(false)} className="text-[11px] font-bold text-text-secondary bg-surface-subtle border px-3 py-1.5 rounded-lg">
                                    ยกเลิก
                                </button>
                                <button onClick={handleSave} disabled={saving || !isLocationValid} className="text-[11px] font-bold text-white bg-teal-700 px-3 py-1.5 rounded-lg disabled:opacity-40">
                                    บันทึก
                                </button>
                            </div>
                        ) : (
                            <button onClick={startEdit} className="text-[11px] font-bold text-teal-700 border border-teal-600 bg-teal-50/40 px-3 py-1.5 rounded-lg flex items-center gap-1">
                                <Pencil size={11} /> แก้ไข
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="w-10" />
                )}
            </div>

            {/* 📱 MOBILE VIEW COMPONENT */}
            <div className="md:hidden px-4 space-y-4 mt-4">
                {systemParameters.map((param) => (
                    <ImageZone
                        key={param.id}
                        param={param}
                        step={mockSubmitHook.step}
                        preview={mockSubmitHook.imagePreviews[param.id]}
                        plotFile={mockSubmitHook.imagePlotFiles[param.id]}
                        measurement={mockSubmitHook.results[param.id]}
                        onImageFilesChange={() => {}}
                        onNearestLocationsUpdate={() => {}}
                        allLocations={[]}
                        setIsRecommending={() => {}}
                    />
                ))}
                <ResultsPanel {...mockSubmitHook} />
                <HistoryMetaBlocks />
            </div>

            {/* 💻 DESKTOP VIEW COMPONENT */}
            <div className="hidden md:block m-4">
                <div className="bg-surface border border-border rounded-xl overflow-hidden flex min-h-150">
                    <aside className="w-[200px] border-r border-border bg-surface flex flex-col p-4 shrink-0">
                        <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted mb-2">ประวัติการตรวจ</p>
                        <div className="space-y-2 py-2 border-b">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-text-muted font-mono">Sample ID</span>
                                <span className="text-xs font-bold">#{sample.id}</span>
                            </div>
                            <div className="flex flex-col mt-1.5">
                                <span className="text-[10px] text-text-muted font-mono">ผลประเมิน</span>
                                <div className="w-fit mt-1">
                                    <StatusBadge status={sample.status} size="sm" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                            <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted">Chemical Summary</p>
                            {systemParameters.map((param) => {
                                const chemVal = mockSubmitHook.results[param.id]?.concentrated ?? 0;
                                return (
                                    <div key={param.id} className="flex justify-between items-center py-0.5">
                                        <span className="font-mono text-[10px] text-text-muted uppercase">{param.name}</span>
                                        <span className="text-[10px] font-bold text-text-primary text-right">
                                            {chemVal.toFixed(3)} <span className="text-[9px] text-text-muted font-normal">mg/L</span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </aside>

                    <div className="flex flex-col flex-1 border-r border-border p-4 gap-4 max-h-[75vh] overflow-y-auto">
                        <HistoryMetaBlocks />
                    </div>

                    <div className="flex flex-col flex-1 p-4 gap-4 max-h-[75vh] overflow-y-auto">
                        {systemParameters.map((param) => (
                            <ImageZone
                                key={param.id}
                                param={param}
                                step={mockSubmitHook.step}
                                preview={mockSubmitHook.imagePreviews[param.id]}
                                plotFile={mockSubmitHook.imagePlotFiles[param.id]}
                                measurement={mockSubmitHook.results[param.id]}
                                onImageFilesChange={() => {}}
                                onNearestLocationsUpdate={() => {}}
                                allLocations={[]}
                                setIsRecommending={() => {}}
                            />
                        ))}
                        <ResultsPanel {...mockSubmitHook} />
                    </div>
                </div>
            </div>
        </div>
    );
}
