"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import liff from "@line/liff";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { alertError, errorToast } from "@/lib/swal";
import { getParameterStatus, LOCATION_STANDARDS, evaluateAllStandards, LOCATION_TYPE_LABELS } from "@/lib/standards";
import { FlaskConical, Loader2, CheckCircle2, MapPin, ArrowLeft, ImagePlus, Sparkles, ShieldCheck, ShieldX, Camera, Clock, Database, ChevronRight, Search, AlertCircle } from "lucide-react";

interface LocationItem {
    id: number;
    name: string;
    type: string;
    lat: number;
    lng: number;
    organization: string;
}

/* ─── ThresholdBar ─────────────────────────────────────────── */

function ThresholdBar({ value, max, status }: { value: number; max: number; status: "safe" | "warning" | "danger" }) {
    const pct = Math.min((value / max) * 100, 100);
    const fillColor = status === "safe" ? "#1D9E75" : status === "warning" ? "#EF9F27" : "#E24B4A";
    return (
        <div className="mt-2">
            <div
                style={{
                    height: 4,
                    background: "var(--color-border-tertiary,#e5e7eb)",
                    borderRadius: 2,
                }}
            >
                <div
                    style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: fillColor,
                        borderRadius: 2,
                        transition: "width 0.6s ease",
                    }}
                />
            </div>
            <div className="flex justify-between mt-1">
                <span className="font-mono text-[9px] text-text-muted">0</span>
                <span className="font-mono text-[9px] text-text-muted">max {max}</span>
            </div>
        </div>
    );
}

/* ─── StepDot ──────────────────────────────────────────────── */

function StepDot({ n, state }: { n: number; state: "done" | "active" | "idle" }) {
    const base = "w-5 h-5 rounded-full text-[10px] font-mono font-medium flex items-center justify-center flex-shrink-0";
    if (state === "done")
        return (
            <div className={`${base} bg-teal-600 text-white`}>
                <CheckCircle2 size={11} />
            </div>
        );
    if (state === "active")
        return (
            <div className={`${base} border border-teal-600 text-teal-700 dark:text-teal-400`} style={{ background: "var(--color-background-info,#eff6ff)" }}>
                {n}
            </div>
        );
    return (
        <div className={`${base} border border-border text-text-muted`} style={{ background: "var(--color-background-secondary,#f9fafb)" }}>
            {n}
        </div>
    );
}

/* ─── SectionHead ──────────────────────────────────────────── */

function SectionHead({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <span className="text-text-muted">{icon}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">{label}</span>
        </div>
    );
}

/* ─── Main ─────────────────────────────────────────────────── */

function SubmitContent() {
    interface DbParameter {
        id: number;
        name: string;
        unit: string | null;
        description: string | null;
    }

    const [systemParameters, setSystemParameters] = useState<DbParameter[]>([]);
    const [isLoadingParams, setIsLoadingParams] = useState(true);

    const [imageFiles, setImageFiles] = useState<Record<number, File>>({});
    const [imagePreviews, setImagePreviews] = useState<Record<number, string>>({});
    const [imagePlotFiles, setImagePlotFiles] = useState<Record<number, File>>({});

    const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
    const searchParams = useSearchParams();
    const router = useRouter();
    const { currentUser } = useAppStore();

    const locationIdParam = searchParams.get("locationId");
    const [currentLocationId, setCurrentLocationId] = useState<string | null>(locationIdParam);
    const [locationName, setLocationName] = useState("");
    const [locationType, setLocationType] = useState("COMMUNITY");
    const [step, setStep] = useState<"upload" | "analyzing" | "results">("upload");
    const [results, setResults] = useState<
        Record<
            number,
            {
                concentrated: number;
                status: "safe" | "warning" | "danger";
                message: string; // ⚡️ เพิ่มฟิลด์รองรับสเปกข้อความแนะนำตัวใหม่
            }
        >
    >({});
    const [overallStatus, setOverallStatus] = useState<"safe" | "warning" | "danger">("safe");
    const [saved, setSaved] = useState(false);
    const [isRecommending, setIsRecommending] = useState(false);
    const [nearestLocations, setNearestLocations] = useState<LocationItem[]>([]);
    const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [collectionTime, setCollectionTime] = useState<string>(() => {
        const now = new Date();
        return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    });
    const [oxygen, setOxygen] = useState("");

    const sessionId = useRef(`${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`);

    /* ── effects ── */

    useEffect(() => {
        setIsLoadingParams(true);
        fetch("/api/parameters")
            .then((r) => {
                if (!r.ok) throw new Error("Failed to fetch parameters");
                return r.json();
            })
            .then((data) => {
                if (Array.isArray(data)) {
                    setSystemParameters(data);
                }
            })
            .catch((err) => {
                console.error("Fetch Parameters Error:", err);
            })
            .finally(() => {
                setIsLoadingParams(false);
            });
    }, []);

    useEffect(() => {
        fetch("/api/locations")
            .then((r) => r.json())
            .then((d) => {
                if (Array.isArray(d)) setAllLocations(d);
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (allLocations.length === 0 || currentLocationId) return;
        navigator.geolocation?.getCurrentPosition(
            async (pos) => {
                const { calculateDistance } = await import("@/lib/exif");
                const sorted = [...allLocations].sort(
                    (a, b) => calculateDistance(pos.coords.latitude, pos.coords.longitude, a.lat, a.lng) - calculateDistance(pos.coords.latitude, pos.coords.longitude, b.lat, b.lng),
                );
                setNearestLocations(sorted.slice(0, 5));
            },
            (err) => console.error("GPS:", err),
            { enableHighAccuracy: true },
        );
    }, [allLocations, currentLocationId]);

    useEffect(() => {
        if (!currentLocationId || !allLocations.length) return;
        const loc = allLocations.find((l) => l.id.toString() === currentLocationId);
        if (loc) {
            const t = setTimeout(() => {
                setLocationName(loc.name);
                setLocationType(loc.type);
            }, 0);
            return () => clearTimeout(t);
        }
    }, [currentLocationId, allLocations]);

    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.role !== "collector" && currentUser.role !== "admin") router.push("/map");
    }, [currentUser, router]);

    /* ── handlers ── */
    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // ดักจับนิรภัยตั้งแต่ตอนกดเลือกรูปภาพหน้าบ้าน
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

        // 1. ดักขนาดไฟล์เกิน (ใช้ Alert Modal เพื่อความชัดเจน)
        if (file.size > MAX_FILE_SIZE) {
            errorToast("ขนาดไฟล์ใหญ่เกินกำหนด!", "รูปภาพผลน้ำต้องมีขนาดไม่เกิน 5MB กรุณาถ่ายภาพใหม่หรือลดความละเอียดของกล้องลงครับบอส");
            e.target.value = "";
            return;
        }

        // 2. ดักประเภทไฟล์แปลกปลอม
        if (!ALLOWED_TYPES.includes(file.type)) {
            alertError("รูปแบบไฟล์ไม่ถูกต้อง!", "ระบบอนุญาตเฉพาะไฟล์รูปภาพสากล (.jpg, .jpeg, .png, .webp) เท่านั้นครับบอส");
            e.target.value = "";
            return;
        }

        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
        setIsRecommending(true);
        try {
            const { getExifLocation, calculateDistance } = await import("@/lib/exif");
            const coords = await getExifLocation(file);
            if (coords && allLocations.length) {
                const sorted = [...allLocations].sort(
                    (a, b) => calculateDistance(coords.latitude, coords.longitude, a.lat, a.lng) - calculateDistance(coords.latitude, coords.longitude, b.lat, b.lng),
                );
                setNearestLocations(sorted.slice(0, 5));
            }
        } catch (err) {
            console.error("EXIF:", err);
        } finally {
            setIsRecommending(false);
        }
    };

    const generateAiImagePlot = (file: File, aiData: any): Promise<File | null> =>
        new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = hiddenCanvasRef.current;
                if (!canvas) return resolve(null);
                const ctx = canvas.getContext("2d");
                if (!ctx) return resolve(null);
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                // สอดคล้องกับคีย์สากลที่ปรับปรุงใน Next.js API
                const box = aiData["bounding box"];
                if (box?.length === 4) {
                    const [x_min, y_min, x_max, y_max] = box;
                    ctx.strokeStyle = "#28a745";
                    ctx.lineWidth = Math.max(4, img.width * 0.005);
                    ctx.strokeRect(x_min, y_min, x_max - x_min, y_max - y_min);

                    // ⚡️ ตกแต่ง Label ให้ Dynamic ตามชื่อสารจริงที่สะท้อนมาจากโมเดล
                    const paramLabel = aiData.parameterName ? aiData.parameterName.charAt(0).toUpperCase() + aiData.parameterName.slice(1).toLowerCase() : "Vial";
                    const label = `${paramLabel} | ${aiData.concentrated.toFixed(2)} mg/L`;

                    const fs = Math.max(16, Math.floor(img.width * 0.018));
                    ctx.font = `bold ${fs}px Arial`;
                    const tw = ctx.measureText(label).width,
                        lh = fs * 1.4;
                    ctx.fillStyle = "#28a745";
                    ctx.fillRect(x_min - 2, y_min - lh, tw + 20, lh);
                    ctx.fillStyle = "white";
                    ctx.fillText(label, x_min + 10, y_min - lh * 0.3);
                }
                canvas.toBlob(
                    (blob) =>
                        resolve(
                            blob
                                ? new File([blob], `plotted-${file.name}`, {
                                      type: "image/png",
                                  })
                                : null,
                        ),
                    "image/png",
                );
            };
            img.src = URL.createObjectURL(file);
        });

    const handleAnalyze = async () => {
        if (systemParameters.length === 0) return;
        setStep("analyzing");

        try {
            const newResults: Record<number, { concentrated: number; status: "safe" | "warning" | "danger"; message: string }> = {};
            let hasDanger = false;
            let hasWarning = false;

            for (const param of systemParameters) {
                const file = imageFiles[param.id];
                if (!file) throw new Error(`ไม่พบไฟล์ภาพของสาร ${param.name}`);

                const fd = new FormData();
                fd.append("image", file);
                fd.append("parameterName", param.name.toLowerCase());

                const res = await fetch("/api/analyze", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
                    body: fd,
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || `วิเคราะห์สาร ${param.name} ไม่สำเร็จ`);
                }

                const data = await res.json();

                // วาดภาพ Grid Plot ตามข้อมูล AI พิกัดจริง
                const plotted = await generateAiImagePlot(file, data);
                if (plotted) {
                    setImagePlotFiles((prev) => ({ ...prev, [param.id]: plotted }));
                }

                // บันทึกผลแยกราย ID สารพร้อมแนบข้อความแจ้งเตือนคำแนะนำจากตัวโมเดล
                const currentStatus = (data.status?.toLowerCase() ?? "safe") as "safe" | "warning" | "danger";
                newResults[param.id] = {
                    concentrated: data.concentrated,
                    status: currentStatus,
                    message: data.message || "", // ⚡️ ดึงฟิลด์ข้อความสเปกใหม่ลง State
                };

                if (currentStatus === "danger") hasDanger = true;
                if (currentStatus === "warning") hasWarning = true;
            }

            const finalStatus = hasDanger ? "danger" : hasWarning ? "warning" : "safe";

            setResults(newResults);
            setOverallStatus(finalStatus);
            setStep("results");
        } catch (err: any) {
            console.error("Analysis failed:", err);
            alertError("วิเคราะห์ภาพล้มเหลว", err.message);
            setStep("upload");
        }
    };

    const handleSave = async () => {
        if (Object.keys(results).length === 0 || !currentLocationId || !currentUser) return;
        try {
            const fd = new FormData();
            fd.append("locationId", currentLocationId);
            fd.append("status", overallStatus);
            fd.append("collectionTime", new Date(collectionTime).toISOString());
            if (oxygen) fd.append("oxygen", oxygen);

            const measurementsPayload = systemParameters.map((param) => ({
                parameterId: param.id,
                value: results[param.id]?.concentrated || 0,
            }));

            fd.append("measurements", JSON.stringify(measurementsPayload));

            systemParameters.forEach((param) => {
                const rawFile = imageFiles[param.id];
                const plotFile = imagePlotFiles[param.id];
                if (rawFile) fd.append(`image_raw_${param.id}`, rawFile);
                if (plotFile) fd.append(`image_plot_${param.id}`, plotFile);
            });

            const res = await fetch("/api/samples", {
                method: "POST",
                headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
                body: fd,
            });

            if (res.ok) {
                setSaved(true);
            } else {
                const errData = await res.json();
                alertError("บันทึกข้อมูลไม่สำเร็จ", errData.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
            }
        } catch (err) {
            console.error("Save failed:", err);
        }
    };

    const getLocStd = () => LOCATION_STANDARDS[locationType as keyof typeof LOCATION_STANDARDS] || LOCATION_STANDARDS["COMMUNITY"];
    const currentStep = step === "upload" ? 1 : step === "analyzing" ? 2 : 3;

    /* ─────────────────────────────────────────────────────────
       SUB-COMPONENTS
    ───────────────────────────────────────────────────────── */

    /* ── Mobile step bar ─────────────────────────────────── */
    const MobileStepBar = () => (
        <div className="flex items-center justify-between px-5 py-3 bg-surface border-b border-border md:hidden">
            {[
                { n: 1, label: "ถ่ายภาพ" },
                { n: 2, label: "วิเคราะห์" },
                { n: 3, label: "บันทึก" },
            ].map(({ n, label }, i) => (
                <div key={n} className="flex items-center gap-1.5">
                    {i > 0 && <div className={`h-px w-6 ${currentStep > i ? "bg-teal-500" : "bg-border"}`} />}
                    <div className="flex items-center gap-1.5">
                        <StepDot n={n} state={currentStep > n ? "done" : currentStep === n ? "active" : "idle"} />
                        <span className={`text-[11px] font-medium ${currentStep >= n ? "text-text-primary" : "text-text-muted"}`}>{label}</span>
                    </div>
                </div>
            ))}
        </div>
    );

    /* ── Desktop sidebar ──────────────────────────────────── */
    const DesktopSidebar = () => (
        <aside className="hidden md:flex flex-col border-r border-border bg-surface min-h-full w-[200px] flex-shrink-0">
            <div className="px-4 py-4 border-b border-border">
                <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted mb-3">Session info</p>
                {[
                    { key: "Session", val: `#${sessionId.current}` },
                    { key: "Station", val: locationName || "—" },
                    {
                        key: "Collector",
                        val: currentUser?.name || currentUser?.email || "—",
                    },
                    {
                        key: "Date",
                        val: new Date().toLocaleDateString("th-TH"),
                    },
                    {
                        key: "Analysis",
                        val: step === "results" ? "Complete" : step === "analyzing" ? "Running…" : "Pending",
                        ok: step === "results",
                    },
                    // ⚡️ ลบล้างการ Hardcode ดึงและแผ่ข้อมูลสรุปเรียงคีย์ตามข้อมูลสถิติในฐานข้อมูลจริง
                    ...systemParameters.map((param) => {
                        const resVal = results[param.id]?.concentrated ?? 0;
                        return {
                            key: param.name.charAt(0).toUpperCase() + param.name.slice(1).toLowerCase(),
                            val: step === "results" ? `${resVal.toFixed(3)} ${param.unit ?? "mg/L"}` : "—",
                        };
                    }),
                ].map(({ key, val, ok }) => (
                    <div key={key} className="flex justify-between items-center py-1">
                        <span className="font-mono text-[10px] text-text-muted">{key}</span>
                        <span className={`text-[10px] font-medium text-right max-w-[110px] leading-tight ${(ok as boolean) ? "text-teal-600 dark:text-teal-400" : "text-text-primary"}`}>{val}</span>
                    </div>
                ))}
                {locationName && step === "upload" && (
                    <button
                        onClick={() => {
                            setCurrentLocationId(null);
                            setLocationName("");
                            setSearchQuery("");
                        }}
                        className="mt-2 text-[10px] text-text-muted underline underline-offset-2 hover:text-text-secondary transition-colors"
                    >
                        Change
                    </button>
                )}
            </div>
            <div className="px-4 py-4 flex-1">
                <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted mb-3">Workflow</p>
                {[
                    {
                        n: 1,
                        title: "Capture image",
                        desc: "Photo of reagent vial",
                    },
                    {
                        n: 2,
                        title: "AI analysis",
                        desc: "Color matching & concentration",
                    },
                    { n: 3, title: "Review & save", desc: "Log to database" },
                ].map(({ n, title, desc }) => (
                    <div key={n} className="flex items-start gap-2.5 py-2.5 border-b border-border last:border-0">
                        <StepDot n={n} state={currentStep > n ? "done" : currentStep === n ? "active" : "idle"} />
                        <div>
                            <p className={`text-[11px] font-medium leading-tight ${currentStep >= n ? "text-text-primary" : "text-text-muted"}`}>{title}</p>
                            <p className="text-[10px] text-text-muted mt-0.5 leading-tight">{desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    );

    /* ── Location picker (shared mobile + desktop) ─────────── */
    const LocationPicker = () => (
        <section className="rounded-xl bg-surface overflow-hidden border border-border">
            <SectionHead icon={<MapPin size={13} />} label="เลือกสถานีจุดเก็บตัวอย่างน้ำ" />
            <div className="p-4 space-y-3">
                <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ค้นหาสถานีตรวจวัด…"
                        className="w-full pl-8 pr-3 py-2.5 text-xs bg-surface-subtle border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-teal-500 transition-colors min-h-[44px]"
                    />
                </div>

                {locationName && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-teal-800 dark:text-teal-200 truncate flex-1">{locationName}</span>
                        <button
                            onClick={() => {
                                setCurrentLocationId(null);
                                setLocationName("");
                                setSearchQuery("");
                            }}
                            className="text-[9px] font-mono text-teal-600 dark:text-teal-400 underline underline-offset-2 flex-shrink-0"
                        >
                            เปลี่ยน
                        </button>
                    </div>
                )}

                {searchQuery.trim() ? (
                    <div className="space-y-1">
                        <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted px-1">ผลการค้นหา</p>
                        {allLocations
                            .filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .slice(0, 6)
                            .map((loc) => (
                                <button
                                    key={loc.id}
                                    onClick={() => {
                                        setCurrentLocationId(loc.id.toString());
                                        setSearchQuery("");
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-lg border text-left transition-colors group min-h-[44px] ${currentLocationId === loc.id.toString() ? "border-teal-500/40 bg-teal-50/60 dark:bg-teal-950/20" : "border-border bg-surface hover:bg-surface-subtle"}`}
                                >
                                    <MapPin size={12} className="text-text-muted group-hover:text-teal-600 flex-shrink-0" />
                                    <span className="text-xs font-medium text-text-primary truncate">{loc.name}</span>
                                    <ChevronRight size={12} className="ml-auto text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        {!allLocations.filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase())).length && (
                            <p className="text-xs text-text-muted text-center py-4">ไม่พบสถานีที่ตรงกับคำค้นหา</p>
                        )}
                    </div>
                ) : nearestLocations.length > 0 ? (
                    <div className="space-y-1">
                        <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted px-1">สถานีใกล้เคียง</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {nearestLocations.map((loc) => (
                                <button
                                    key={loc.id}
                                    onClick={() => setCurrentLocationId(loc.id.toString())}
                                    className={`flex items-center gap-2 px-3 py-3 rounded-lg border text-left transition-colors min-h-[44px] ${currentLocationId === loc.id.toString() ? "border-teal-500/40 bg-teal-50/60 dark:bg-teal-950/20" : "border-border bg-surface hover:bg-surface-subtle"}`}
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${currentLocationId === loc.id.toString() ? "bg-teal-500" : "bg-text-muted"}`} />
                                    <span className="text-xs font-medium text-text-primary truncate">{loc.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-xs text-text-muted py-2">
                        <Loader2 size={12} className="animate-spin text-teal-600" />
                        กำลังค้นหาสถานีใกล้เคียง…
                    </div>
                )}
            </div>
        </section>
    );

    /* ── Image zone ───────────────────────────────────────── */
    const ImageZone = ({ param }: { param: DbParameter }) => {
        const fileInputRef = useRef<HTMLInputElement>(null);
        const paramId = param.id;
        const preview = imagePreviews[paramId];
        const plotFile = imagePlotFiles[paramId];

        const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const MAX_FILE_SIZE = 10 * 1024 * 1024;
            const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

            if (file.size > MAX_FILE_SIZE) {
                Swal.fire({
                    title: "ไฟล์มีขนาดใหญ่เกินไป",
                    text: "กรุณาเลือกไฟล์รูปภาพที่มีขนาดไม่เกิน 10MB ครับบอส",
                    icon: "error",
                    confirmButtonColor: "#0D9488",
                });
                return;
            }

            if (!ALLOWED_TYPES.includes(file.type)) {
                Swal.fire({
                    title: "รูปแบบไฟล์ไม่ถูกต้อง",
                    text: "ระบบอนุญาตเฉพาะไฟล์รูปภาพสากล (.jpg, .jpeg, .png, .webp) เท่านั้นครับบอส",
                    icon: "error",
                    confirmButtonColor: "#0D9488",
                });
                return;
            }

            setImageFiles((prev) => ({ ...prev, [paramId]: file }));

            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreviews((prev) => ({ ...prev, [paramId]: reader.result as string }));
            };
            reader.readAsDataURL(file);

            setIsRecommending(true);
            try {
                const { getExifLocation, calculateDistance } = await import("@/lib/exif");
                const coords = await getExifLocation(file);
                if (coords && allLocations.length) {
                    const sorted = [...allLocations].sort(
                        (a, b) => calculateDistance(coords.latitude, coords.longitude, a.lat, a.lng) - calculateDistance(coords.latitude, coords.longitude, b.lat, b.lng),
                    );
                    setNearestLocations(sorted.slice(0, 5));
                }
            } catch (err) {
                console.error("EXIF Error:", err);
            } finally {
                setIsRecommending(false);
            }
        };

        return (
            <section className="rounded-xl bg-surface overflow-hidden border border-border">
                <SectionHead icon={<Camera size={13} />} label={`ภาพถ่ายผลทดสอบ: ${param.name.toUpperCase()} (${param.unit ?? "mg/L"})`} />
                <div className="p-4">
                    <div
                        onClick={() => step === "upload" && fileInputRef.current?.click()}
                        className={`relative w-full rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all duration-200
                        ${
                            step === "analyzing"
                                ? "aspect-[4/3] border-slate-700 bg-slate-950 cursor-default"
                                : preview
                                  ? "aspect-[4/3] border-teal-500/30 bg-surface-subtle cursor-pointer"
                                  : "aspect-square border-border hover:border-teal-500/50 bg-surface-subtle cursor-pointer"
                        }`}
                    >
                        {step === "analyzing" ? (
                            <>
                                {preview && <img src={preview} alt={param.name} className="w-full h-full object-contain opacity-30 blur-[0.5px] absolute inset-0" />}
                                <div className="animate-laser" />
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
                            </>
                        ) : (step === "results" || step === "upload") && (preview || (step === "results" && plotFile)) ? (
                            <img src={step === "results" && plotFile ? URL.createObjectURL(plotFile) : preview} alt={param.name} className="w-full h-full object-contain" />
                        ) : (
                            <div className="flex flex-col items-center gap-3 px-8 text-center py-8">
                                <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center border border-border">
                                    <ImagePlus size={24} className="text-slate-700 dark:text-slate-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-text-primary">แตะเพื่อถ่ายหรือเลือกภาพ ({param.name})</p>
                                    <p className="text-[10px] text-text-muted mt-1">ให้แผ่น ColorChecker ของ {param.name} อยู่ในกรอบและชัดเจน</p>
                                </div>
                            </div>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </div>
                    {step === "upload" && preview && (
                        <button onClick={() => fileInputRef.current?.click()} className="mt-2 text-[10px] text-text-muted underline underline-offset-2">
                            เปลี่ยนภาพถ่าย {param.name}
                        </button>
                    )}
                </div>
            </section>
        );
    };

    /* ── Metadata fields ──────────────────────────────────── */
    const MetadataFields = () => (
        <section className="rounded-xl bg-surface overflow-hidden border border-border">
            <SectionHead icon={<Clock size={13} />} label="ข้อมูลการเก็บตัวอย่าง" />
            <div className="p-4 space-y-4">
                <div>
                    <label className="font-mono text-[9px] uppercase tracking-widest text-text-muted block mb-1.5">เวลาที่เก็บตัวอย่าง</label>
                    <input
                        type="datetime-local"
                        value={collectionTime}
                        required
                        onChange={(e) => setCollectionTime(e.target.value)}
                        className="w-full px-3 py-2.5 bg-surface-subtle border border-border text-text-primary rounded-lg text-xs focus:border-teal-500 focus:outline-none transition-colors min-h-[44px]"
                    />
                    <p className="text-[9px] text-text-muted mt-1">ใช้สำหรับดึงข้อมูลสภาพอากาศย้อนหลัง</p>
                </div>
                <div>
                    <label className="font-mono text-[9px] uppercase tracking-widest text-text-muted block mb-1.5">ออกซิเจนละลายน้ำ — ไม่จำเป็น</label>
                    <div className="relative">
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="20"
                            value={oxygen}
                            onChange={(e) => setOxygen(e.target.value)}
                            placeholder="เช่น 6.5"
                            className="w-full px-3 py-2.5 pr-12 bg-surface-subtle border border-border text-text-primary rounded-lg text-xs focus:border-teal-500 focus:outline-none transition-colors placeholder:text-text-muted/50 min-h-[44px]"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-text-muted">mg/L</span>
                    </div>
                </div>
            </div>
        </section>
    );

    /* ── Analyze button ───────────────────────────────────── */
    const AnalyzeButton = () => {
        const isAllImagesUploaded = systemParameters.length > 0 && systemParameters.every((param) => imageFiles[param.id] !== undefined);

        return (
            <button
                onClick={handleAnalyze}
                disabled={!isAllImagesUploaded || !currentLocationId || isRecommending}
                className="w-full py-3.5 min-h-[52px] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white shadow-sm"
            >
                {isRecommending ? (
                    <>
                        <Loader2 size={15} className="animate-spin" /> กำลังตรวจจับตำแหน่ง…
                    </>
                ) : !currentLocationId ? (
                    <>
                        <MapPin size={15} /> กรุณาเลือกสถานีก่อน
                    </>
                ) : !isAllImagesUploaded ? (
                    <>
                        <Camera size={15} /> กรุณาถ่ายภาพผลทดสอบให้ครบทุกสาร
                    </>
                ) : (
                    <>
                        <Sparkles size={15} /> วิเคราะห์ด้วย AI ทั้งหมด
                    </>
                )}
            </button>
        );
    };

    /* ── Analyzing indicator (mobile only, below image) ───── */
    const AnalyzingStatus = () => (
        <div className="flex items-center gap-3 px-4 py-4 rounded-xl border border-border bg-surface">
            <div className="relative w-10 h-10 flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200/50 flex items-center justify-center">
                    <FlaskConical size={18} className="text-teal-700 dark:text-teal-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-teal-600 flex items-center justify-center animate-pulse">
                    <Sparkles size={9} className="text-white" />
                </div>
            </div>
            <div>
                <p className="text-xs font-semibold text-text-primary">กำลังเทียบสีและคำนวณค่า…</p>
                <p className="text-[10px] text-text-secondary mt-0.5 leading-relaxed">เปรียบเทียบกับมาตรฐานคุณภาพน้ำชายฝั่ง</p>
            </div>
        </div>
    );

    /* ── Results panel ────────────────────────────────────── */
    const ResultsPanel = () => {
        if (Object.keys(results).length === 0) return null;
        const std = getLocStd();

        return (
            <div className="space-y-4">
                <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-medium ${
                        overallStatus === "safe"
                            ? "bg-teal-50 dark:bg-teal-950/20 border-teal-500/30 text-teal-800 dark:text-teal-200"
                            : overallStatus === "warning"
                              ? "bg-amber-50 dark:bg-amber-950/20 border-amber-500/30 text-amber-800 dark:text-amber-200"
                              : "bg-red-50 dark:bg-red-950/20 border-red-500/30 text-red-800 dark:text-red-200"
                    }`}
                >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${overallStatus === "safe" ? "bg-teal-500" : overallStatus === "warning" ? "bg-amber-500" : "bg-red-500"}`} />
                    <div>
                        <p className="font-semibold">
                            {overallStatus === "safe" ? "คุณภาพน้ำอยู่ในเกณฑ์ปลอดภัย" : overallStatus === "warning" ? "ตรวจพบค่าสูง — ต้องตรวจสอบเพิ่มเติม" : "ค่าเกินมาตรฐานความปลอดภัย"}
                        </p>
                    </div>
                </div>

                <div className="w-full rounded-xl border border-border bg-surface overflow-hidden flex flex-col gap-1">
                    <div className="px-6 py-3 border-b border-border bg-muted/40 flex justify-between items-center text-text-muted font-mono text-xs uppercase tracking-wider">
                        <div>Parameter</div>
                        <div>Value</div>
                    </div>

                    <div className="divide-y divide-border">
                        {systemParameters.map((param) => {
                            const measurement = results[param.id];
                            if (!measurement) return null;

                            // ⚡️ ดึงเกณฑ์คัดกรองขอบเขตสูงสุดแบบ Dynamic ไร้สารเจือปน
                            const maxKey = `${param.name.toLowerCase()}Max`;
                            const max = std[maxKey as keyof typeof std] ?? 1.0;
                            const isExceeded = measurement.concentrated > max;
                            const exceededPercentage = isExceeded ? Math.round(((measurement.concentrated - max) / max) * 100) : 0;

                            return (
                                <div key={param.id} className="px-6 py-4 flex flex-col gap-2 hover:bg-muted/5 transition-colors">
                                    <div className="flex justify-between items-baseline">
                                        <div className="font-medium text-text-primary">
                                            <span className="font-mono text-base uppercase">{param.name}</span>
                                        </div>
                                        <div className="font-mono text-sm font-semibold text-text-primary">
                                            {measurement.concentrated.toFixed(3)} <span className="text-[10px] text-text-muted font-normal ml-0.5">{param.unit ?? "mg/L"}</span>
                                        </div>
                                    </div>

                                    <div className="w-full">
                                        <ThresholdBar value={measurement.concentrated} max={max} status={measurement.status} />
                                        <div className="text-center font-sans mt-1 text-xs">
                                            {isExceeded ? (
                                                <span className="text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded">
                                                    เกินเกณฑ์มาตรฐาน {exceededPercentage}%
                                                </span>
                                            ) : (
                                                <span className="text-teal-600 dark:text-teal-400">ปกติ</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* ⚡️ บล็อกคำแนะนำคำเตือน (Message text) ที่สะท้อนเพิ่มเข้ามาจากโมเดล AI */}
                                    {measurement.message && (
                                        <div className="mt-2 flex items-start gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border text-[11px] text-text-secondary leading-relaxed">
                                            <AlertCircle size={12} className="text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
                                            <span>{measurement.message}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    /* ── Save / success ───────────────────────────────────── */
    const SaveSection = () =>
        !saved ? (
            <button
                onClick={handleSave}
                className="w-full py-3.5 min-h-[52px] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white transition-all duration-200 shadow-sm"
            >
                <Database size={15} /> บันทึกลงฐานข้อมูล
            </button>
        ) : (
            <div className="rounded-xl border border-teal-500/30 bg-teal-50/50 dark:bg-teal-950/20 p-6 text-center">
                <CheckCircle2 size={28} className="text-teal-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-teal-800 dark:text-teal-200">บันทึกสำเร็จ</p>
                <p className="text-[10px] text-text-secondary mt-1.5 max-w-xs mx-auto leading-relaxed">ข้อมูลถูกจัดเก็บและอัปเดตแผนที่เรียบร้อยแล้ว</p>
                <button onClick={() => router.push("/map")} className="mt-4 px-6 py-2.5 min-h-[44px] bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold transition-colors">
                    กลับสู่แผนที่
                </button>
            </div>
        );

    /* ─────────────────────────────────────────────────────────
       RENDER
    ───────────────────────────────────────────────────────── */

    return (
        <div className="min-h-screen w-full bg-surface-muted transition-colors duration-300">
            <canvas ref={hiddenCanvasRef} className="hidden" />

            <div className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[11px] text-text-secondary hover:text-text-primary transition-colors min-h-[44px] pr-3">
                    <ArrowLeft size={14} />
                    <span className="hidden sm:inline">Back</span>
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-text-primary">ส่งตัวอย่างน้ำ</h1>
                    <p className="text-[10px] text-text-muted hidden sm:block">SESSION #{sessionId.current}</p>
                </div>
                <div className="w-10" />
            </div>

            <MobileStepBar />

            <div className="px-4 pt-4 pb-1 md:hidden">
                <p className="text-xs text-text-secondary">การติดตามคุณภาพน้ำชายฝั่ง — อัปโหลดภาพชุดทดสอบเพื่อวิเคราะห์ด้วย AI</p>
            </div>

            {/* ══════════════ MOBILE LAYOUT (< md) ══════════════ */}
            <div className="md:hidden px-4 pb-24 space-y-4 mt-3">
                {step === "upload" && (
                    <>
                        {isLoadingParams ? (
                            <div className="p-8 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                                <Loader2 size={14} className="animate-spin text-teal-600" /> กำลังโหลดข้อมูลสารเคมี...
                            </div>
                        ) : (
                            systemParameters.map((param) => <ImageZone key={param.id} param={param} />)
                        )}

                        <LocationPicker />
                        <MetadataFields />
                        <AnalyzeButton />
                    </>
                )}
                {step === "analyzing" && (
                    <>
                        {systemParameters.map((param) => (
                            <ImageZone key={param.id} param={param} />
                        ))}
                        <AnalyzingStatus />
                    </>
                )}
                {step === "results" && results && (
                    <>
                        {systemParameters.map((param) => (
                            <ImageZone key={param.id} param={param} />
                        ))}
                        <ResultsPanel />
                        <SaveSection />
                    </>
                )}
            </div>

            {/* ══════════════ DESKTOP LAYOUT (md+) ══════════════ */}
            <div className="hidden md:block m-4">
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-border">
                        <h2 className="text-base font-semibold text-text-primary">ส่งตัวอย่างน้ำ</h2>
                        <p className="text-xs text-text-secondary mt-0.5">การติดตามคุณภาพน้ำชายฝั่ง — อัปโหลดภาพชุดทดสอบน้ำเพื่อการวิเคราะห์ด้วย AI</p>
                    </div>

                    <div className="flex min-h-[600px]">
                        <DesktopSidebar />

                        <div className="flex flex-col border-r border-border flex-1 max-h-[70vh] overflow-y-auto">
                            <div className="p-4 flex flex-col gap-4">
                                {isLoadingParams ? (
                                    <div className="p-8 text-center text-xs text-text-muted">กำลังโหลดพารามิเตอร์ระบบ...</div>
                                ) : (
                                    systemParameters.map((param) => <ImageZone key={param.id} param={param} />)
                                )}

                                {step === "upload" && <AnalyzeButton />}
                                {step === "analyzing" && <AnalyzingStatus />}
                                {step === "results" && results && <SaveSection />}
                            </div>
                        </div>

                        <div className="flex flex-col flex-1 p-4 gap-4">
                            {step === "upload" && (
                                <>
                                    <div>
                                        <LocationPicker />
                                    </div>
                                    <div>
                                        <MetadataFields />
                                    </div>
                                </>
                            )}
                            {step === "analyzing" && (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center space-y-3">
                                        <div className="relative w-12 h-12 mx-auto">
                                            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200/50 flex items-center justify-center">
                                                <FlaskConical size={20} className="text-teal-700 dark:text-teal-400" />
                                            </div>
                                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center animate-pulse">
                                                <Sparkles size={10} className="text-white" />
                                            </div>
                                        </div>
                                        <p className="text-xs font-semibold text-text-primary">กำลังเทียบสีและคำนวณค่า…</p>
                                        <p className="text-[10px] text-text-secondary max-w-[180px] leading-relaxed">เปรียบเทียบกับมาตรฐานคุณภาพน้ำชายฝั่ง</p>
                                    </div>
                                </div>
                            )}
                            {step === "results" && results && <ResultsPanel />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SubmitPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-dvh">
                    <div className="w-7 h-7 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                </div>
            }
        >
            <SubmitContent />
        </Suspense>
    );
}
