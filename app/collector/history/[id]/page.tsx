"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import liff from "@line/liff";
import { ArrowLeft, Calendar, MapPin, Pencil, User, FlaskConical, Thermometer, CloudRain, Waves } from "lucide-react";
import { getWeatherConditionLabel } from "@/lib/weather";
import { evaluateAgainstLocationType } from "@/lib/standards";
import { useLocationTypes } from "@/lib/hooks/useLocationTypes";

import StatusBadge from "@/components/map/StatusBadge";
import { ImageZone } from "@/components/submit/ImageZone";
import { ResultsPanel } from "@/components/submit/ResultsPanel";
import { StandardsComparison, type ComparisonRow } from "@/components/StandardsComparison";

type WaterStatus = "safe" | "warning" | "danger";
interface LocationOption {
    id: number;
    name: string;
    agency: string;
}

interface SampleDetail {
    id: number;
    code?: string | null;
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
    sampleImagesMap?: Record<number, { raw: string | null; plot: string | null }>;
    // ผลประเมินระดับสถานที่ — คนละมิติกับ status ของ record นี้ (ค่าล่าสุดของแต่ละสาร ณ locationId นี้ อาจคนละรอบเก็บ)
    locationStatus?: WaterStatus | null;
    latestByParameter?: { parameterId: number; parameterName: string; value: number; collectedAt: string }[];
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
    const [error, setError] = useState<string | null>(null);
    const { locationTypes } = useLocationTypes();

    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editData, setEditData] = useState({ collectionTime: "", locationId: "", oxygen: "" });
    const [locations, setLocations] = useState<LocationOption[]>([]);
    const [locationSearch, setLocationSearch] = useState("");
    const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
    const locationDropdownRef = useRef<HTMLDivElement>(null);

    // ── 1. ค้นหาและสร้างพารามิเตอร์แบบ Dynamic จากโครงสร้าง measurements จริงในเรคคอร์ดนี้ ──
    // กันซ้ำด้วย parameterId เพราะ session เดียวอาจมี WaterSample 2 แถวชี้ parameterId เดียวกันได้ตอนนี้
    // (กรณี "สารซ้ำ" ที่หน้า /submit ยอมให้บันทึกทั้งสองภาพแยกกันแล้วรอ admin ตัดสิน) — ไม่งั้น React key ชนกัน
    const systemParameters = useMemo(() => {
        if (!sample || !Array.isArray(sample.measurements)) return [];

        const seen = new Map<number, { id: number; name: string; unit: string }>();
        sample.measurements.forEach((m: any) => {
            const id = m.parameter?.id || m.parameterId;
            if (!seen.has(id)) {
                seen.set(id, { id, name: m.parameter?.name || "unknown", unit: m.parameter?.unit || "mg/L" });
            }
        });
        return Array.from(seen.values());
    }, [sample]);

    // ── 2. ดึงความสัมพันธ์แบบ Dynamic สกัดค่ารายสารและผูกรูปภาพตามสเปกจริงประจำเรคคอร์ด ──
    // วนตาม measurement จริงทุกตัว (ไม่ใช่ systemParameters ที่ถูกกันซ้ำแล้ว) เพื่อโชว์สารซ้ำเป็น 2 รายการแยกกันได้
    // key ด้วย sampleId ของแต่ละแถว (ไม่ซ้ำกันเสมอ ต่างจาก parameterId) กันรายการทับกันเหลือรายการเดียว
    const mockSubmitHook = useMemo(() => {
        if (!sample || systemParameters.length === 0 || !Array.isArray(sample.measurements)) return null;

        const resultsMap: Record<number, any> = {};
        const imagePreviewsMap: Record<number, string> = {};
        const imagePlotFilesMap: Record<number, any> = {};

        // นับจำนวน measurement ต่อสาร ไว้ตัดสินว่าสารไหน "ซ้ำ" (โชว์ badge ใน ResultsPanel)
        const countByParam = new Map<number, number>();
        sample.measurements.forEach((m: any) => {
            const pid = m.parameter?.id || m.parameterId;
            countByParam.set(pid, (countByParam.get(pid) || 0) + 1);
        });

        sample.measurements.forEach((m: any) => {
            const paramId = m.parameter?.id || m.parameterId;
            const key = m.sampleId ?? paramId;

            resultsMap[key] = {
                concentrated: m.value,
                confidence: m.confidence,
                status: sample.status,
                parameterId: paramId, // ResultsPanel รุ่นใหม่หา param จากฟิลด์นี้แทน key ตรง ๆ (รองรับกรณีสารซ้ำในหน้า submit)
                isDuplicateSubstance: (countByParam.get(paramId) || 0) > 1,
            };

            // 🌟 ดึงรูปภาพผ่าน sampleImagesMap โดย key ด้วย sampleId ของแถวนี้เอง (ไม่ใช่ parameterId)
            // กัน "ค่ากับรูปมาจากคนละแถว" ตอนมีสารซ้ำ (≥2 WaterSample ชี้ parameterId เดียวกัน) — แต่ละแถวมี sampleId ไม่ซ้ำกันเสมอ
            const specificImages = m.sampleId !== undefined ? sample.sampleImagesMap?.[m.sampleId] : undefined;

            imagePreviewsMap[key] = specificImages?.raw || sample.rawImageUrl || "";
            imagePlotFilesMap[key] = specificImages?.plot || sample.analyzedPlotUrl || "";
        });

        return {
            systemParameters,
            results: resultsMap,
            imagePreviews: imagePreviewsMap,
            imagePlotFiles: imagePlotFilesMap,
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
        if (currentUser.role !== "collector" && currentUser.role !== "admin" && currentUser.role !== "officer") router.push("/map");
    }, [currentUser, router]);

    useEffect(() => {
        let cancelled = false;
        async function fetchSample() {
            if (!currentUser || (currentUser.role !== "collector" && currentUser.role !== "admin" && currentUser.role !== "officer") || !params.id) return;
            try {
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

            // การบันทึกไม่ได้แก้แถวเดิม แต่สร้างเวอร์ชันใหม่ที่มี id ใหม่ แล้วปิดเวอร์ชันเก่า
            // จึงต้องพา URL ไปที่ id ใหม่ ไม่งั้น:
            //   - refresh แล้วเจอ 404 เพราะ id เดิมถูกปิดไปแล้ว
            //   - state ค้างอยู่กับ id ที่ตายแล้ว
            //
            // และตั้งใจไม่ setSample(data) เพราะ PUT ตอบคนละรูปกับ GET (ไม่มี location / collector /
            // sampleImagesMap) ยัดเข้า state ตรง ๆ แล้วหน้าจะ crash ตอนอ่าน sample.collector.firstName
            // การเปลี่ยน URL ทำให้ effect ที่ผูกกับ params.id ยิง GET ใหม่เอง → ได้ข้อมูลรูปแบบเดียวกับตอนโหลดหน้าปกติ
            if (data?.id && String(data.id) !== String(params.id)) {
                router.replace(`/collector/history/${data.id}`);
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setSaving(false);
        }
    }

    const filteredLocations = locations.filter((l) => l.name?.toLowerCase().includes(locationSearch.toLowerCase()) || l.agency?.toLowerCase().includes(locationSearch.toLowerCase()));
    const isLocationValid = locations.some((l) => String(l.id) === editData.locationId && l.name === locationSearch) || (locations.length === 0 && editData.locationId !== "");

    // 1. หากเกิดปัญหาขึ้นจริงระหว่างยิง API ให้แสดงบล็อก Error ทันที
    if (error) return <div className="min-h-screen text-center p-8 text-xs text-red-500">เกิดข้อผิดพลาด: {error}</div>;
    if (!sample) return null;
    if (!mockSubmitHook) return <div className="min-h-screen text-center p-8 text-xs text-text-muted">ไม่มีข้อมูลพารามิเตอร์เคมีในระบบ</div>;

    // 1 รายการ (การ์ด/แถว) ต่อ 1 measurement จริง — สารซ้ำจะได้ 2 รายการแยกกัน แทนที่จะโดนกันซ้ำเหลือรายการเดียว
    const resultEntries = Object.entries(mockSubmitHook.results)
        .map(([keyStr, measurement]) => {
            const key = Number(keyStr);
            const param = systemParameters.find((p) => p.id === measurement.parameterId);
            return param ? { key, param, measurement } : null;
        })
        .filter((e): e is { key: number; param: (typeof systemParameters)[number]; measurement: any } => e !== null);

    const collectorFullName = `${sample.collector.firstName || ""} ${sample.collector.lastName || ""}`.trim() || sample.collector.lineProfileName;

    // ผลประเมินระดับ "สถานที่" ณ วันที่ของ record นี้ (context-aware ตามวันที่กำลังดู ไม่ใช่ล่าสุดจริงตอนนี้)
    // เช่น ดูแอมโมเนียเมื่อ 10 วันก่อน ฟอสเฟตจะถูกเทียบด้วยค่าที่ใกล้เคียงวันนั้น (ดู computeValueByParameterAsOf)
    // แยกจากผลประเมินของ record ใบนี้ (ResultsPanel ด้านล่าง) ซึ่งเทียบแค่ค่าที่วัดได้ในใบนี้เอง
    const latestByParameter = sample.latestByParameter ?? [];
    const locationComparisonRows: ComparisonRow[] =
        locationTypes.length > 0 && latestByParameter.length > 0
            ? locationTypes.map((type) => ({
                  key: type.code,
                  label: type.labelTh,
                  status: evaluateAgainstLocationType(
                      latestByParameter.map((m) => ({ parameterId: m.parameterId, value: m.value })),
                      type,
                  ),
              }))
            : [];

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

            {/* ผลประเมินของ "สถานที่" ณ วันที่ของ record นี้ — สารแต่ละตัวเทียบด้วยค่าที่ใกล้เคียงวันนี้ที่สุด (อาจคนละรอบเก็บ) */}
            {sample.locationStatus && latestByParameter.length > 0 && (
                <section className="rounded-xl bg-surface overflow-hidden border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-primary font-bold">ผลประเมินของสถานที่ ณ วันที่บันทึกนี้</span>
                        </div>
                        <StatusBadge status={sample.locationStatus} size="md" />
                    </div>

                    {/* ค่าที่ใช้คำนวณต่อสาร พร้อมวันที่วัดจริง — สารแต่ละตัวอาจมาจากคนละรอบเก็บ ต้องบอกให้ชัดว่ามาจากเมื่อไหร่ */}
                    <div className="space-y-2">
                        {latestByParameter.map((m) => (
                            <div key={m.parameterId} className="flex items-center justify-between text-xs bg-surface-subtle border border-border rounded-xl px-4 py-2.5">
                                <span className="font-bold text-text-primary uppercase">{m.parameterName || "-"}</span>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-text-primary">{m.value.toFixed(3)} mg/L</span>
                                    <span className="text-xs text-text-muted">{formatDateTime(m.collectedAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <StandardsComparison compact title="การผ่านเกณฑ์แบ่งตามประเภทการใช้งาน" rows={locationComparisonRows} />
                </section>
            )}
        </div>
    );

    return (
        <div className="min-h-dvh w-full bg-surface-muted pb-5 antialiased transition-colors duration-300">
            <div className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.push("/collector")} className="flex items-center gap-1.5 text-xs text-secondary min-h-11">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </button>
                <div className="text-center">
                    {sample?.code ? (
                        <div className="flex flex-col items-center">
                            <h1 className="text-sm font-semibold text-secondary">{sample.code}</h1>
                        </div>
                    ) : (
                        <h1 className="text-sm font-semibold text-secondary">รายละเอียดประวัติการตรวจสอบ</h1>
                    )}
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
                {resultEntries.map(({ key, param, measurement }) => (
                    <ImageZone
                        key={key}
                        param={param}
                        step={mockSubmitHook.step}
                        preview={mockSubmitHook.imagePreviews[key]}
                        plotFile={mockSubmitHook.imagePlotFiles[key]}
                        measurement={measurement}
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
                            {resultEntries.map(({ key, param, measurement }) => (
                                <div key={key} className="flex justify-between items-center py-0.5">
                                    <span className="font-mono text-[10px] text-text-muted uppercase">
                                        {param.name}
                                        {measurement.isDuplicateSubstance && <span className="ml-1 text-amber-600">•ซ้ำ</span>}
                                    </span>
                                    <span className="text-[10px] font-bold text-text-primary text-right">
                                        {measurement.concentrated.toFixed(3)} <span className="text-[9px] text-text-muted font-normal">mg/L</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </aside>

                    <div className="flex flex-col flex-1 border-r border-border p-4 gap-4 max-h-[75vh] overflow-y-auto">
                        <HistoryMetaBlocks />
                    </div>

                    <div className="flex flex-col flex-1 p-4 gap-4 max-h-[75vh] overflow-y-auto">
                        {resultEntries.map(({ key, param, measurement }) => (
                            <ImageZone
                                key={key}
                                param={param}
                                step={mockSubmitHook.step}
                                preview={mockSubmitHook.imagePreviews[key]}
                                plotFile={mockSubmitHook.imagePlotFiles[key]}
                                measurement={measurement}
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
