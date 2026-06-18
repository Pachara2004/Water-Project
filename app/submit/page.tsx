'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import StatusBadge from '@/components/StatusBadge';
import { getParameterStatus, LOCATION_STANDARDS, evaluateAllStandards, LOCATION_TYPE_LABELS } from '@/lib/standards';
import {
  FlaskConical,
  Loader2,
  CheckCircle2,
  MapPin,
  ArrowLeft,
  ImagePlus,
  Sparkles,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';

interface LocationItem {
  id: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  organization: string;
}

function SubmitContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { currentUser } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const locationIdParam = searchParams.get("locationId");
    const [currentLocationId, setCurrentLocationId] = useState<string | null>(
        locationIdParam,
    );

    const [locationName, setLocationName] = useState<string>("");
    const [locationType, setLocationType] = useState<string>("COMMUNITY");
    const [step, setStep] = useState<"upload" | "analyzing" | "results">(
        "upload",
    );
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [results, setResults] = useState<{
        phosphate: number;
        ammonia: number;
        status: "SAFE" | "WARNING" | "DANGER";
        imageUrl: string;
    } | null>(null);
    const [saved, setSaved] = useState(false);
    const [exifData, setExifData] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [isRecommending, setIsRecommending] = useState(false);
    const [nearestLocations, setNearestLocations] = useState<LocationItem[]>(
        [],
    );
    const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [collectionTime, setCollectionTime] = useState<string>(() => {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 16);
    });
    const [oxygen, setOxygen] = useState<string>("");

    // Fetch all locations on mount
    useEffect(() => {
        fetch("/api/locations")
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setAllLocations(data);
                }
            })
            .catch(console.error);
    }, []);

    // Handle GPS for initial recommendation
    useEffect(() => {
        if (allLocations.length === 0 || currentLocationId) return;

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { calculateDistance } = await import("@/lib/exif");
                    const sorted = [...allLocations].sort((a, b) => {
                        const distA = calculateDistance(
                            pos.coords.latitude,
                            pos.coords.longitude,
                            a.lat,
                            a.lng,
                        );
                        const distB = calculateDistance(
                            pos.coords.latitude,
                            pos.coords.longitude,
                            b.lat,
                            b.lng,
                        );
                        return distA - distB;
                    });
                    setNearestLocations(sorted.slice(0, 5));
                },
                (err) => console.error("GPS error:", err),
                { enableHighAccuracy: true },
            );
        }
    }, [allLocations, currentLocationId]);

    // Set selected location info
    useEffect(() => {
        if (currentLocationId && allLocations.length > 0) {
            const loc = allLocations.find(
                (l) => l.id.toString() === currentLocationId,
            );
            if (loc) {
                const timer = setTimeout(() => {
                    setLocationName(loc.name);
                    setLocationType(loc.type);
                }, 0);
                return () => clearTimeout(timer);
            }
        }
    }, [currentLocationId, allLocations]);

    // Role Gate
    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.role !== "COLLECTOR" && currentUser.role !== "ADMIN") {
            router.push("/map");
        }
    }, [currentUser, router]);

    const handleImageSelect = async (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);

            // Extract EXIF to recommend locations
            setIsRecommending(true);
            try {
                const { getExifLocation, calculateDistance } =
                    await import("@/lib/exif");
                const coords = await getExifLocation(file);
                if (coords && allLocations.length > 0) {
                    setExifData({
                        lat: coords.latitude,
                        lng: coords.longitude,
                    });

                    // Sort all locations by distance from photo location to recommend
                    const sorted = [...allLocations].sort((a, b) => {
                        const distA = calculateDistance(
                            coords.latitude,
                            coords.longitude,
                            a.lat,
                            a.lng,
                        );
                        const distB = calculateDistance(
                            coords.latitude,
                            coords.longitude,
                            b.lat,
                            b.lng,
                        );
                        return distA - distB;
                    });
                    setNearestLocations(sorted.slice(0, 5));
                }
            } catch (err) {
                console.error("Failed to get EXIF or recommend location:", err);
            } finally {
                setIsRecommending(false);
            }
        }
    };

    const handleAnalyze = async () => {
        if (!imageFile) return;

        setStep("analyzing");

        try {
            const formData = new FormData();
            formData.append("image", imageFile);

            const res = await fetch("/api/analyze", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            setResults({
                phosphate:
                    typeof data.phosphate === "number" ? data.phosphate : 0,
                ammonia: typeof data.ammonia === "number" ? data.ammonia : 0,
                status: data.status || "SAFE",
                imageUrl: data.imageUrl || "",
            });
            setStep("results");
        } catch (err) {
            console.error("Analysis failed:", err);
            setStep("upload");
        }
    };

    // แทนที่ฟังก์ชัน handleSave เดิมในคอมโพเนนต์ SubmitContent ของบอสครับ
    const handleSave = async () => {
        // เพิ่มดักจับให้มั่นใจว่ามี imageFile สดๆ จากกล้องอยู่จริง
        if (!results || !currentLocationId || !currentUser || !imageFile)
            return;

        try {
            const formData = new FormData();

            // แนบไฟล์ภาพดิบต้นฉบับ
            formData.append("image", imageFile);

            // แนบค่าข้อมูลทางเทคนิคอื่นๆ
            formData.append("locationId", currentLocationId);
            formData.append("phosphateVal", results.phosphate.toString());
            formData.append("ammoniaVal", results.ammonia.toString());
            formData.append("status", results.status);
            formData.append("collectedBy", currentUser.id);
            formData.append(
                "collectionTime",
                new Date(collectionTime).toISOString(),
            );
            if (oxygen) formData.append("oxygen", oxygen);

            const res = await fetch("/api/samples", {
                method: "POST",
                // ปล่อยว่างไว้ ไม่ต้องประกาศ headers Content-Type ตัวเบราว์เซอร์จะจัดการ Boundary ให้เอง
                body: formData,
            });

            if (res.ok) {
                setSaved(true);
            } else {
                const errData = await res.json();
                console.error(
                    "Save failed on backend:",
                    errData.error || errData.details,
                );
            }
        } catch (err) {
            console.error("Save network connection failed:", err);
        }
    };

    // Evaluate against all 6 standards
    const getStandardsEvaluation = (phosphate: number, ammonia: number) => {
        const evalResults = evaluateAllStandards(phosphate, ammonia);
        return Object.entries(evalResults).map(([type, passed]) => ({
            type,
            label:
                LOCATION_TYPE_LABELS[
                    type as keyof typeof LOCATION_TYPE_LABELS
                ] || type,
            passed: passed as boolean,
        }));
    };

    return (
        <div
            className="min-h-dvh w-full bg-surface-muted pb-10
                    relative transition-colors duration-300"
        >
            {/* Centred content wrapper — page bg fills full-width, content stays readable */}
            <div className="w-full max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-surface px-5 sm:px-8 lg:px-12 pt-12 pb-6 mb-6 sm:mb-8 border-b border-border transition-colors duration-300">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary active:scale-95 text-xs font-bold mb-5 transition-all bg-surface-subtle border border-border py-1.5 px-3.5 rounded-full w-fit cursor-pointer"
                    >
                        <ArrowLeft size={13} />
                        ย้อนกลับ
                    </button>

                    {/* Section Label Badge */}
                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-3 py-1 mb-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-text-secondary font-bold">
                            Water Analysis
                        </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-wide leading-tight">
                        ส่งผลตรวจ{" "}
                        <span className="text-primary font-bold">
                            ตัวอย่างน้ำชายฝั่ง
                        </span>
                    </h1>
                    <p className="text-text-secondary text-xs sm:text-sm mt-3 leading-loose">
                        อัปโหลดรูปภาพชุดทดสอบเคมีเพื่อทำการวิเคราะห์ข้อมูลด้วยระบบปัญญาประดิษฐ์
                        (AI)
                    </p>

                    {locationName ? (
                        <div className="flex items-center justify-between gap-2.5 mt-4 text-text-secondary text-sm bg-primary-light border border-primary/10 py-2.5 px-4 rounded-2xl transition-colors duration-300">
                            <div className="flex items-center gap-2 min-w-0">
                                <MapPin
                                    size={14}
                                    className="text-primary flex-shrink-0"
                                />
                                <span className="font-extrabold text-text-primary truncate">
                                    {locationName}
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    setCurrentLocationId(null);
                                    setLocationName("");
                                    setSearchQuery("");
                                }}
                                className="text-[9px] font-bold text-text-secondary bg-surface px-3 py-1.5 rounded-xl whitespace-nowrap hover:bg-surface-subtle active:scale-[0.95] transition-all border border-border min-h-[32px] flex items-center cursor-pointer"
                            >
                                เปลี่ยนจุดตรวจ
                            </button>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {/* Search box */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    placeholder="🔍 ค้นหาจุดเก็บตัวอย่าง..."
                                    className="w-full px-4 py-3 bg-surface border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[44px]"
                                />
                            </div>

                            {/* Search results */}
                            {searchQuery.trim() ? (
                                <div className="flex flex-col gap-1.5">
                                    <p className="text-[9px] font-bold text-text-muted uppercase tracking-wide px-1 font-mono">
                                        Search Results
                                    </p>
                                    {allLocations
                                        .filter((loc) =>
                                            loc.name
                                                .toLowerCase()
                                                .includes(
                                                    searchQuery.toLowerCase(),
                                                ),
                                        )
                                        .slice(0, 8)
                                        .map((loc) => (
                                            <button
                                                key={loc.id}
                                                onClick={() => {
                                                    setCurrentLocationId(
                                                        loc.id.toString(),
                                                    );
                                                    setSearchQuery("");
                                                }}
                                                className="flex items-center gap-3 p-3 bg-surface hover:bg-surface-subtle border border-border rounded-2xl transition-all text-left active:scale-[0.98] group min-h-[44px] cursor-pointer"
                                            >
                                                <div className="w-8 h-8 bg-surface-subtle rounded-xl flex items-center justify-center group-hover:bg-primary-light transition-colors flex-shrink-0">
                                                    <MapPin
                                                        size={13}
                                                        className="text-text-muted group-hover:text-primary"
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-text-primary flex-1 truncate">
                                                    {loc.name}
                                                </span>
                                            </button>
                                        ))}
                                    {allLocations.filter((loc) =>
                                        loc.name
                                            .toLowerCase()
                                            .includes(
                                                searchQuery.toLowerCase(),
                                            ),
                                    ).length === 0 && (
                                        <p className="text-xs text-text-muted text-center py-3">
                                            ไม่พบจุดตรวจสอบที่ตรงกับคำค้น
                                        </p>
                                    )}
                                </div>
                            ) : (
                                /* Recommended locations - Horizontal scrolling row of chips (Glassmorphism allowed here) */
                                <div>
                                    {nearestLocations.length > 0 ? (
                                        <>
                                            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wide px-1 mb-2.5 font-mono">
                                                📍 Nearby Recommendations
                                            </p>
                                            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none -mx-1 px-1">
                                                {nearestLocations.map((loc) => (
                                                    <button
                                                        key={loc.id}
                                                        onClick={() =>
                                                            setCurrentLocationId(
                                                                loc.id.toString(),
                                                            )
                                                        }
                                                        className="flex-shrink-0 px-4 py-2.5 bg-surface text-text-primary border border-border rounded-full text-[10px] font-bold hover:border-primary active:scale-[0.95] active:border-primary transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                                                    >
                                                        <MapPin
                                                            size={11}
                                                            className="text-primary"
                                                        />
                                                        <span className="truncate max-w-[120px]">
                                                            {loc.name}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-xs text-text-muted bg-surface-subtle p-3 rounded-2xl border border-border flex items-center gap-2">
                                            <Loader2
                                                size={13}
                                                className="animate-spin text-primary flex-shrink-0"
                                            />
                                            <span>
                                                กำลังค้นหาจุดตรวจแนะนำที่ใกล้ที่สุด...
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* lg: two-column grid — form left, results right */}
                <div className="px-5 sm:px-8 lg:px-12 space-y-5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
                    {/* Step 1: Upload */}
                    {step === "upload" && (
                        <div className="bg-surface rounded-3xl shadow-md border border-border overflow-hidden transition-all duration-300">
                            <div className="p-5">
                                <div className="flex items-center gap-2.5 mb-5">
                                    <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold font-mono">
                                        1
                                    </div>
                                    <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                                        Select Bottle Image
                                    </h2>
                                </div>

                                {/* Upload zone - High Contrast & clean corners */}
                                <div
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                    className={`relative w-full aspect-[4/3] rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300 overflow-hidden group ${
                                        imagePreview
                                            ? "border-transparent bg-surface-subtle shadow-md"
                                            : "border-border bg-surface hover:border-primary"
                                    }`}
                                >
                                    {imagePreview ? (
                                        <img
                                            src={imagePreview}
                                            alt="ตัวอย่างน้ำ"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
                                            {/* Visual Target cyan-neon corners */}
                                            <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl-sm" />
                                            <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr-sm" />
                                            <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl-sm" />
                                            <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br-sm" />

                                            <div className="w-14 h-14 bg-primary-light rounded-2xl flex items-center justify-center border border-border group-hover:scale-105 transition-transform duration-300">
                                                <ImagePlus
                                                    size={24}
                                                    className="text-primary"
                                                />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs font-bold text-text-primary leading-relaxed">
                                                    ถ่ายรูปขวดตัวอย่างสารเคมี
                                                </p>
                                                <p className="text-[10px] text-text-muted leading-relaxed mt-1 max-w-[80%] mx-auto">
                                                    โปรดให้แผ่นเปรียบเทียบค่าสี
                                                    ColorChecker
                                                    ในกล่องทดสอบมีความชัดเจน
                                                </p>
                                            </div>
                                            <span className="text-[9px] font-extrabold text-primary bg-primary-light px-3 py-1 rounded-full mt-1 border border-primary/10">
                                                เลือกไฟล์รูป / กล้องถ่ายภาพ
                                            </span>
                                        </div>
                                    )}

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleImageSelect}
                                        className="hidden"
                                    />
                                </div>

                                {/* Collection Time Field */}
                                <div className="mt-5 space-y-2">
                                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">
                                        เวลาที่เก็บตัวอย่างน้ำจริง (Collection
                                        Time)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={collectionTime}
                                        required
                                        onChange={(e) =>
                                            setCollectionTime(e.target.value)
                                        }
                                        className="w-full px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs focus:border-primary outline-none min-h-[44px]"
                                    />
                                    <p className="text-[8px] text-text-muted leading-relaxed">
                                        *ระบุเวลาจริงที่ลงพื้นที่เก็บตัวอย่าง
                                        เพื่อดึงข้อมูลสภาพอากาศ TMD
                                        ย้อนหลังได้ถูกต้อง
                                    </p>
                                </div>

                                {/* Analyze button - Premium Gradient */}
                                <button
                                    onClick={handleAnalyze}
                                    disabled={
                                        !imageFile ||
                                        !currentLocationId ||
                                        isRecommending
                                    }
                                    className="w-full mt-5 py-4 min-h-[48px] bg-gradient-to-r from-primary to-navy-light text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-accent cursor-pointer"
                                >
                                    {isRecommending ? (
                                        <>
                                            <Loader2
                                                size={16}
                                                className="animate-spin"
                                            />
                                            กำลังค้นพิกัดแนะนำ...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles
                                                size={15}
                                                className={
                                                    imageFile &&
                                                    currentLocationId
                                                        ? "animate-pulse"
                                                        : ""
                                                }
                                            />
                                            {!currentLocationId && imageFile
                                                ? "กรุณาเลือกจุดตรวจสอบ"
                                                : "เริ่มการวิเคราะห์ด้วย AI"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Analyzing (Sci-fi Scanning Box) */}
                    {step === "analyzing" && (
                        <div className="bg-surface rounded-3xl shadow-md border border-border overflow-hidden p-6 transition-all duration-300">
                            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner mb-6">
                                {imagePreview && (
                                    <img
                                        src={imagePreview}
                                        alt="ตัวอย่างน้ำ"
                                        className="w-full h-full object-cover opacity-40 filter blur-[0.5px]"
                                    />
                                )}
                                {/* Scanning Laser Line (pure CSS) */}
                                <div className="animate-laser" />
                                {/* High-tech Scanning Grid Overlay */}
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                                {/* Active targets corners */}
                                <div className="absolute top-4 left-4 w-3.5 h-3.5 border-t border-l border-primary" />
                                <div className="absolute top-4 right-4 w-3.5 h-3.5 border-t border-r border-primary" />
                                <div className="absolute bottom-4 left-4 w-3.5 h-3.5 border-b border-l border-primary" />
                                <div className="absolute bottom-4 right-4 w-3.5 h-3.5 border-b border-r border-primary" />
                            </div>

                            <div className="flex flex-col items-center text-center">
                                <div className="relative mb-4 flex items-center justify-center">
                                    <div className="w-12 h-12 bg-primary-light rounded-2xl flex items-center justify-center border border-border">
                                        <FlaskConical
                                            size={20}
                                            className="text-primary"
                                        />
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-lg flex items-center justify-center animate-pulse border border-white dark:border-slate-900">
                                        <Sparkles
                                            size={11}
                                            className="text-white"
                                        />
                                    </div>
                                </div>
                                <h2 className="text-sm font-bold text-text-primary mb-1">
                                    AI กำลังคำนวณและประมวลผลค่าสีเคมี...
                                </h2>
                                <p className="text-[10px] text-text-secondary max-w-[85%] leading-relaxed">
                                    เทียบสัดส่วนและเปรียบเทียบระดับสีกับมาตรฐานวิชาการคุณภาพน้ำทะเลชายฝั่งแบบเรียลไทม์
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Results */}
                    {step === "results" && results && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Uploaded Image Preview */}
                            {imagePreview && (
                                <div className="bg-surface rounded-3xl shadow-md border border-border overflow-hidden p-2 transition-all duration-300">
                                    <img
                                        src={imagePreview}
                                        alt="ตัวอย่างน้ำที่วิเคราะห์"
                                        className="w-full h-44 object-cover rounded-2xl"
                                    />
                                </div>
                            )}

                            {/* Overall Status */}
                            <div className="bg-surface rounded-3xl shadow-md border border-border p-5 transition-all duration-300">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                                        <CheckCircle2 size={13} />
                                    </div>
                                    <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                                        Overall Analysis Results
                                    </h2>
                                </div>

                                <div className="bg-surface-subtle border border-border rounded-2xl p-5 text-center">
                                    <span className="font-mono text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2.5 block">
                                        สถานะคุณภาพน้ำโดยรวม
                                    </span>
                                    <div className="inline-flex">
                                        <StatusBadge
                                            status={results.status}
                                            size="lg"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Chemical Values */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Phosphate */}
                                <div className="bg-surface rounded-2xl p-5 shadow-md border border-border flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] transition-all duration-200">
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <div className="bg-primary-light p-1.5 rounded-xl border border-primary/10">
                                            <FlaskConical
                                                size={13}
                                                className="text-primary"
                                            />
                                        </div>
                                        <div className="font-mono text-[9px] font-bold text-text-muted uppercase tracking-wider">
                                            Phosphate
                                        </div>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <div
                                            className={`text-2xl font-black ${(() => {
                                                const std =
                                                    LOCATION_STANDARDS[
                                                        locationType as keyof typeof LOCATION_STANDARDS
                                                    ] ||
                                                    LOCATION_STANDARDS[
                                                        "COMMUNITY"
                                                    ];
                                                return getParameterStatus(
                                                    results.phosphate,
                                                    std.phosphateMax,
                                                ) === "SAFE"
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-red-600 dark:text-red-400";
                                            })()}`}
                                        >
                                            {(results.phosphate ?? 0).toFixed(
                                                3,
                                            )}
                                        </div>
                                        <span className="font-mono text-[9px] font-bold text-text-muted">
                                            mg/L
                                        </span>
                                    </div>
                                </div>

                                {/* Ammonia */}
                                <div className="bg-surface rounded-2xl p-5 shadow-md border border-border flex flex-col justify-between hover:scale-[1.01] active:scale-[0.99] transition-all duration-200">
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <div className="bg-purple-50 dark:bg-purple-950/20 p-1.5 rounded-xl border border-purple-100/10">
                                            <FlaskConical
                                                size={13}
                                                className="text-purple-500"
                                            />
                                        </div>
                                        <div className="font-mono text-[9px] font-bold text-text-muted uppercase tracking-wider">
                                            Ammonia
                                        </div>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <div
                                            className={`text-2xl font-black ${(() => {
                                                const std =
                                                    LOCATION_STANDARDS[
                                                        locationType as keyof typeof LOCATION_STANDARDS
                                                    ] ||
                                                    LOCATION_STANDARDS[
                                                        "COMMUNITY"
                                                    ];
                                                return getParameterStatus(
                                                    results.ammonia,
                                                    std.ammoniaMax,
                                                ) === "SAFE"
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-red-600 dark:text-red-400";
                                            })()}`}
                                        >
                                            {(results.ammonia ?? 0).toFixed(3)}
                                        </div>
                                        <span className="font-mono text-[9px] font-bold text-text-muted">
                                            mg/L
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Optional Dissolved Oxygen (DO) Input Card */}
                            <div className="bg-surface rounded-3xl shadow-md border border-border p-5 transition-all duration-300">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-6 h-6 bg-primary-light text-primary rounded-xl flex items-center justify-center border border-primary/10">
                                        <FlaskConical size={13} />
                                    </div>
                                    <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                                        Optional Meteorological Inputs
                                    </h2>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">
                                        ปริมาณออกซิเจนละลายน้ำ (Dissolved Oxygen
                                        - DO)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="20"
                                            value={oxygen}
                                            onChange={(e) =>
                                                setOxygen(e.target.value)
                                            }
                                            placeholder="เช่น 6.5 (ไม่จำเป็นต้องระบุ)"
                                            className="w-full px-5 py-3.5 pr-12 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[48px]"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[9px] font-bold text-text-muted">
                                            mL/L
                                        </span>
                                    </div>
                                    <p className="text-[8px] text-text-muted leading-relaxed">
                                        *ข้อมูลออกซิเจนละลายน้ำนี้เป็นแบบระบุเลือกได้
                                        (Non-blocking)
                                        เพื่อใช้เป็นตัวแปรพยากรณ์โครงสร้างคณิตศาสตร์ระบบในภายหลัง
                                    </p>
                                </div>
                            </div>

                            {/* Standards Evaluation - 6 Types (Solid flat panels for maximum GPU speed) */}
                            <div className="bg-surface rounded-2xl shadow-md border border-border p-5 transition-all duration-200">
                                <h3 className="text-xs font-bold text-text-secondary mb-4 flex items-center gap-2">
                                    <ShieldCheck
                                        size={15}
                                        className="text-primary"
                                    />
                                    การประเมินเทียบเกณฑ์มาตรฐานคุณภาพน้ำทะเล
                                </h3>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {getStandardsEvaluation(
                                        results.phosphate,
                                        results.ammonia,
                                    ).map((std) => (
                                        <div
                                            key={std.type}
                                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold border transition-all ${
                                                std.passed
                                                    ? "bg-emerald-50/40 dark:bg-emerald-950/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/20 shadow-sm"
                                                    : "bg-red-50/40 dark:bg-red-950/15 text-red-800 dark:text-red-300 border-red-500/20 shadow-sm"
                                            }`}
                                        >
                                            {std.passed ? (
                                                <ShieldCheck
                                                    size={15}
                                                    className="text-emerald-500 flex-shrink-0"
                                                />
                                            ) : (
                                                <ShieldX
                                                    size={15}
                                                    className="text-red-500 flex-shrink-0"
                                                />
                                            )}
                                            <span className="flex-1 truncate">
                                                {std.label}
                                            </span>
                                            <span
                                                className={`font-mono text-[9px] font-black px-2 py-0.5 rounded-lg border flex-shrink-0 ${
                                                    std.passed
                                                        ? "bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/30"
                                                        : "bg-red-100/70 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/30"
                                                }`}
                                            >
                                                {std.passed
                                                    ? "ปลอดภัย"
                                                    : "ไม่ผ่าน"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Save button */}
                            {!saved ? (
                                <button
                                    onClick={handleSave}
                                    className="w-full py-4 min-h-[48px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 shadow-md cursor-pointer mt-2"
                                >
                                    <CheckCircle2 size={16} />
                                    บันทึกผลการตรวจสอบลงระบบ
                                </button>
                            ) : (
                                <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-3xl p-5 text-center transition-all duration-300">
                                    <CheckCircle2
                                        size={28}
                                        className="text-emerald-500 mx-auto mb-3"
                                    />
                                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                        บันทึกข้อมูลสำเร็จ!
                                    </p>
                                    <p className="text-[10px] text-text-secondary mt-1.5 max-w-[85%] mx-auto leading-relaxed">
                                        ผลการตรวจวัดถูกจัดเก็บเข้าสู่ระบบคลาวด์หลักและอัปเดตตำแหน่งพิกัดแผนที่แล้ว
                                    </p>
                                    <button
                                        onClick={() => router.push("/map")}
                                        className="mt-5 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-extrabold hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
                                    >
                                        กลับสู่แผนที่หลัก
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
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
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <SubmitContent />
      </Suspense>
      );
}
