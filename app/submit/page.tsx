"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import liff from "@line/liff";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { getParameterStatus, LOCATION_STANDARDS, evaluateAllStandards, LOCATION_TYPE_LABELS } from "@/lib/standards";
import { FlaskConical, Loader2, CheckCircle2, MapPin, ArrowLeft, ImagePlus, Sparkles, ShieldCheck, ShieldX, Camera, Clock, Database, ChevronRight, Search } from "lucide-react";

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
    const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
    const [imagePlotFile, setImagePlotFile] = useState<File | null>(null);
    const searchParams = useSearchParams();
    const router = useRouter();
    const { currentUser } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const locationIdParam = searchParams.get("locationId");
    const [currentLocationId, setCurrentLocationId] = useState<string | null>(locationIdParam);
    const [locationName, setLocationName] = useState("");
    const [locationType, setLocationType] = useState("COMMUNITY");
    const [step, setStep] = useState<"upload" | "analyzing" | "results">("upload");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [results, setResults] = useState<{
        phosphate: number;
        ammonia: number;
        status: "safe" | "warning" | "danger";
        imageUrl: string;
    } | null>(null);
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
                const box = aiData["bounding box"];
                if (box?.length === 4) {
                    const [x_min, x_max, y_min, y_max] = box;
                    ctx.strokeStyle = "#28a745";
                    ctx.lineWidth = Math.max(4, img.width * 0.005);
                    ctx.strokeRect(x_min, y_min, x_max - x_min, y_max - y_min);
                    const label = `${aiData.ammonia ? "Ammonia" : "Phosphate"} | ${aiData.concentrated} mg/L`;
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
        if (!imageFile) return;
        setStep("analyzing");
        try {
            const fd = new FormData();
            fd.append("image", imageFile);

            // ดึงคำสั่งจาก fetch มาใส่ตัวแปรตรง ๆ พร้อมแนบสิทธิ์ความปลอดภัยใน headers
            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: {
                    // แนบ LINE Access Token ไปในโครงสร้าง Bearer Token ม้วนเดียวจบ
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: fd,
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "ไม่สามารถเปิดระบบวิเคราะห์ภาพได้");
            }

            const data = await res.json();
            const isAmmonia = data.ammonia === true;
            const plotted = await generateAiImagePlot(imageFile, data);
            if (plotted) setImagePlotFile(plotted);

            setResults({
                phosphate: isAmmonia ? 0 : data.concentrated,
                ammonia: isAmmonia ? data.concentrated : 0,
                status: data.status?.toLowerCase() ?? "safe",
                imageUrl: data.imageUrl || "",
            });
            setStep("results");
        } catch (err) {
            console.error("Analysis failed:", err);
            // บอสสามารถเลือกเก็บข้อผิดพลาดไปแจ้งเตือนบน UI (เช่น setFormError) ได้ตามต้องการครับ
            setStep("upload");
        }
    };

    const handleSave = async () => {
        if (!results || !currentLocationId || !currentUser || !imageFile) return;
        try {
            const fd = new FormData();
            fd.append("image", imageFile);
            if (imagePlotFile) fd.append("imagePlot", imagePlotFile);
            fd.append("locationId", currentLocationId);
            fd.append("phosphateVal", (results.phosphate ?? 0).toString());
            fd.append("ammoniaVal", (results.ammonia ?? 0).toString());
            fd.append("status", results.status || "safe");
            fd.append("collectedBy", currentUser.id.toString());
            fd.append("collectionTime", new Date(collectionTime).toISOString());
            if (oxygen) fd.append("oxygen", oxygen);
            const res = await fetch("/api/samples", {
                method: "POST",
                headers: {
                    "x-user-id": currentUser.id.toString(),
                    "x-user-role": currentUser.role.toLowerCase(),
                },
                body: fd,
            });
            if (res.ok) setSaved(true);
            else console.error("Save error:", await res.json());
        } catch (err) {
            console.error("Save failed:", err);
        }
    };

    const getStandardsEvaluation = (phosphate: number, ammonia: number) =>
        Object.entries(evaluateAllStandards(phosphate, ammonia)).map(([type, passed]) => ({
            type,
            label: LOCATION_TYPE_LABELS[type as keyof typeof LOCATION_TYPE_LABELS] || type,
            passed: passed as boolean,
        }));

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
                    ...(results
                        ? [
                              {
                                  key: "Phosphate",
                                  val: `${(results.phosphate ?? 0).toFixed(3)} mg/L`,
                              },
                          ]
                        : []),
                    ...(results
                        ? [
                              {
                                  key: "Ammonia",
                                  val: `${(results.ammonia ?? 0).toFixed(3)} mg/L`,
                              },
                          ]
                        : []),
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

                {/* selected station badge */}
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
    const ImageZone = () => (
        <section className="rounded-xl bg-surface overflow-hidden border border-border">
            <SectionHead icon={<Camera size={13} />} label="ภาพตัวอย่าง" />
            <div className="p-4">
                <div
                    onClick={() => step === "upload" && fileInputRef.current?.click()}
                    className={`relative w-full rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all duration-200
                        ${
                            step === "analyzing"
                                ? "aspect-[4/3] border-slate-700 bg-slate-950 cursor-default"
                                : imagePreview
                                  ? "aspect-[4/3] border-teal-500/30 bg-surface-subtle cursor-pointer"
                                  : "aspect-square border-border hover:border-teal-500/50 bg-surface-subtle cursor-pointer"
                        }`}
                >
                    {step === "analyzing" ? (
                        <>
                            {imagePreview && <img src={imagePreview} alt="Sample" className="w-full h-full object-contain opacity-30 blur-[0.5px] absolute inset-0" />}
                            <div className="animate-laser" />
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
                            {["top-3 left-3 border-t border-l", "top-3 right-3 border-t border-r", "bottom-3 left-3 border-b border-l", "bottom-3 right-3 border-b border-r"].map((c, i) => (
                                <div key={i} className={`absolute ${c} border-teal-500 w-4 h-4`} />
                            ))}
                        </>
                    ) : (step === "results" || step === "upload") && (imagePreview || (step === "results" && imagePlotFile)) ? (
                        <img src={step === "results" && imagePlotFile ? URL.createObjectURL(imagePlotFile) : imagePreview!} alt="Sample" className="w-full h-full object-contain" />
                    ) : (
                        <div className="flex flex-col items-center gap-3 px-8 text-center py-8">
                            <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center border border-border group-hover:scale-105 transition-transform">
                                <ImagePlus size={24} className="text-slate-700 dark:text-slate-500" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-text-primary">แตะเพื่อถ่ายหรือเลือกภาพ</p>
                                <p className="text-[10px] text-text-muted mt-1">ให้แผ่น ColorChecker อยู่ในกรอบและชัดเจน</p>
                            </div>
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />
                </div>
                {step === "upload" && imagePreview && (
                    <button onClick={() => fileInputRef.current?.click()} className="mt-2 text-[10px] text-text-muted underline underline-offset-2">
                        เปลี่ยนภาพ
                    </button>
                )}
            </div>
        </section>
    );

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
    const AnalyzeButton = () => (
        <button
            onClick={handleAnalyze}
            disabled={!imageFile || !currentLocationId || isRecommending}
            className="w-full py-3.5 min-h-[52px] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white shadow-sm"
        >
            {isRecommending ? (
                <>
                    <Loader2 size={15} className="animate-spin" /> กำลังตรวจจับตำแหน่ง…
                </>
            ) : !currentLocationId && imageFile ? (
                <>
                    <MapPin size={15} /> กรุณาเลือกสถานีก่อน
                </>
            ) : (
                <>
                    <Sparkles size={15} /> วิเคราะห์ด้วย AI
                </>
            )}
        </button>
    );

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
        if (!results) return null;
        const paramSt = (val: number, max: number) => getParameterStatus(val, max) as "safe" | "warning" | "danger";
        const std = getLocStd();

        return (
            <div className="space-y-4">
                {/* status banner */}
                <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-medium ${
                        results.status === "safe"
                            ? "bg-teal-50 dark:bg-teal-950/20 border-teal-500/30 text-teal-800 dark:text-teal-200"
                            : results.status === "warning"
                              ? "bg-amber-50 dark:bg-amber-950/20 border-amber-500/30 text-amber-800 dark:text-amber-200"
                              : "bg-red-50 dark:bg-red-950/20 border-red-500/30 text-red-800 dark:text-red-200"
                    }`}
                >
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${results.status === "safe" ? "bg-teal-500" : results.status === "warning" ? "bg-amber-500" : "bg-red-500"}`} />
                    <div>
                        <p className="font-semibold">
                            {results.status === "safe" ? "คุณภาพน้ำอยู่ในเกณฑ์ปลอดภัย" : results.status === "warning" ? "ตรวจพบค่าสูง — ต้องตรวจสอบเพิ่มเติม" : "ค่าเกินมาตรฐานความปลอดภัย"}
                        </p>
                        <p className="text-[10px] mt-0.5 font-normal opacity-80">
                            สถานะรวม: <span className="font-mono uppercase">{results.status}</span>
                        </p>
                    </div>
                </div>

                {/* readout cards */}
                <div className="w-full rounded-xl border border-border bg-surface overflow-hidden flex flex-col gap-1">
                    {/* หัวตารางหลัก (Header) */}
                    <div className="px-6 py-3 border-b border-border bg-muted/40 flex justify-between items-center text-text-muted font-mono text-xs uppercase tracking-wider">
                        <div>Parameter</div>
                        <div>Value</div>
                    </div>

                    {/* รายการข้อมูลแต่ละตัว (ยืดหยุ่นตามข้อมูลใน Array) */}
                    <div className="divide-y divide-border">
                        {(
                            [
                                {
                                    label: "Phosphate",
                                    sub: "PO₄",
                                    val: results.phosphate,
                                    max: getLocStd().phosphateMax,
                                },
                                {
                                    label: "Ammonia",
                                    sub: "NH₃",
                                    val: results.ammonia,
                                    max: getLocStd().ammoniaMax,
                                },
                                /* ➕ อนาคตเพิ่มสารเคมีตัวใหม่ต่อท้ายตรงนี้ได้เลย */
                            ] as const
                        ).map(({ label, sub, val, max }) => {
                            // คำนวณ Status
                            const paramStatus = getParameterStatus(val, max) as "safe" | "warning" | "danger";

                            // คำนวณหา % ที่เกินเกณฑ์มาตรฐาน (เช่น ค่าวัดได้ 2.5 แต่ Max ยอมรับได้ 0.95)
                            const percentageOfMax = max > 0 ? (val / max) * 100 : 0;
                            const isExceeded = val > max;
                            const exceededPercentage = isExceeded ? Math.round(((val - max) / max) * 100) : 0;

                            return (
                                <div key={label} className="px-6 py-4 flex flex-col gap-2 hover:bg-muted/5 transition-colors">
                                    {/* บรรทัดบน: ชื่อสาร (ซ้าย) & ค่าวัดได้ (ขวา) */}
                                    <div className="flex justify-between items-baseline">
                                        <div className="font-medium text-text-primary">
                                            <span className="font-mono text-base uppercase">{label}</span> <span className="text-xs text-text-muted">({sub})</span>
                                        </div>
                                        <div className="font-mono text-sm font-semibold text-text-primary">
                                            {val.toFixed(3)} <span className="text-[10px] text-text-muted font-normal ml-0.5">mg/L</span>
                                        </div>
                                    </div>

                                    {/* บรรทัดกลาง: แถบหลอดแก้วระดับความยาวเต็มแถว */}
                                    <div className="w-full">
                                        <ThresholdBar value={val} max={max} status={paramStatus} />
                                        <div className="flex-1 text-center font-sans">
                                            {isExceeded && (
                                                <span className="text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded">
                                                    เกินเกณฑ์มาตรฐาน {exceededPercentage}%
                                                </span>
                                            )}
                                            {!isExceeded && <span className="text-teal-600 dark:text-teal-400">ปกติ</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* standards */}
                <section className="rounded-xl border border-border bg-surface overflow-hidden">
                    <SectionHead icon={<ShieldCheck size={13} />} label="Standards compliance" />
                    <div className="p-4 space-y-2">
                        {getStandardsEvaluation(results.phosphate, results.ammonia).map((std) => (
                            <div
                                key={std.type}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium border ${
                                    std.passed
                                        ? "bg-teal-50/60 dark:bg-teal-950/15 text-teal-800 dark:text-teal-200 border-teal-500/20"
                                        : "bg-red-50/60 dark:bg-red-950/15 text-red-800 dark:text-red-200 border-red-500/20"
                                }`}
                            >
                                {std.passed ? <ShieldCheck size={13} className="text-teal-600 flex-shrink-0" /> : <ShieldX size={13} className="text-red-500 flex-shrink-0" />}
                                <span className="flex-1">{std.label}</span>
                                <span className="font-mono text-[9px] uppercase tracking-wider">{std.passed ? "Pass" : "Fail"}</span>
                            </div>
                        ))}
                    </div>
                </section>
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

            {/* ── Top bar ── */}
            <div className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[11px] text-text-secondary hover:text-text-primary transition-colors min-h-[44px] pr-3">
                    <ArrowLeft size={14} />
                    <span className="hidden sm:inline">Back</span>
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-text-primary">ส่งตัวอย่างน้ำ</h1>
                    <p className="text-[10px] text-text-muted hidden sm:block">SESSION #{sessionId.current}</p>
                </div>
                <div className="w-10" /> {/* spacer */}
            </div>

            {/* ── Mobile step bar ── */}
            <MobileStepBar />

            {/* ── Page subtitle (mobile only) ── */}
            <div className="px-4 pt-4 pb-1 md:hidden">
                <p className="text-xs text-text-secondary">การติดตามคุณภาพน้ำชายฝั่ง — อัปโหลดภาพชุดทดสอบเพื่อวิเคราะห์ด้วย AI</p>
            </div>

            {/* ══════════════ MOBILE LAYOUT (< md) ══════════════ */}
            <div className="md:hidden px-4 pb-24 space-y-4 mt-3">
                {step === "upload" && (
                    <>
                        <ImageZone />
                        <LocationPicker />
                        <MetadataFields />
                        <AnalyzeButton />
                    </>
                )}
                {step === "analyzing" && (
                    <>
                        <ImageZone />
                        <AnalyzingStatus />
                    </>
                )}
                {step === "results" && results && (
                    <>
                        <ImageZone />
                        <ResultsPanel />
                        <SaveSection />
                    </>
                )}
            </div>

            {/* ══════════════ DESKTOP LAYOUT (md+) ══════════════ */}
            <div className="hidden md:block m-4">
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                    {/* page title bar */}
                    <div className="px-6 py-4 border-b border-border">
                        <h2 className="text-base font-semibold text-text-primary">ส่งตัวอย่างน้ำ</h2>
                        <p className="text-xs text-text-secondary mt-0.5">การติดตามคุณภาพน้ำชายฝั่ง — อัปโหลดภาพชุดทดสอบน้ำเพื่อการวิเคราะห์ด้วย AI</p>
                    </div>

                    {/* 3-column grid */}
                    <div className="flex min-h-[600px]">
                        {/* Col 1: Sidebar */}
                        <DesktopSidebar />

                        {/* Col 2: Image + metadata + action */}
                        <div className="flex flex-col border-r border-border flex-1">
                            <div className="p-4 flex flex-col h-full gap-4">
                                <ImageZone />
                                {step === "upload" && (
                                    <>
                                        <AnalyzeButton />
                                    </>
                                )}
                                {step === "analyzing" && <AnalyzingStatus />}
                                {step === "results" && results && <SaveSection />}
                            </div>
                        </div>

                        {/* Col 3: Location picker → results */}
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
