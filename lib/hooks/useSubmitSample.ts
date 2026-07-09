import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { alertError } from "@/lib/swal";
import { DbParameter, LocationItem, MeasurementResult } from "@/components/submit/types";

export function useSubmitSample() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { currentUser } = useAppStore();

    // ── States ──
    const [systemParameters, setSystemParameters] = useState<DbParameter[]>([]);
    const [isLoadingParams, setIsLoadingParams] = useState(true);
    const [imageFiles, setImageFiles] = useState<Record<number, File>>({});
    const [imagePreviews, setImagePreviews] = useState<Record<number, string>>({});
    const [imagePlotFiles, setImagePlotFiles] = useState<Record<number, File>>({});
    const [currentLocationId, setCurrentLocationId] = useState<string | null>(searchParams.get("locationId"));
    const [locationName, setLocationName] = useState("");
    const [locationType, setLocationType] = useState("COMMUNITY");
    const [step, setStep] = useState<"upload" | "analyzing" | "results">("upload");
    const [results, setResults] = useState<Record<number, MeasurementResult>>({});
    const [overallStatus, setOverallStatus] = useState<"safe" | "warning" | "danger">("safe");
    const [saved, setSaved] = useState(false);
    const [isRecommending, setIsRecommending] = useState(false);
    const [nearestLocations, setNearestLocations] = useState<LocationItem[]>([]);
    const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [oxygen, setOxygen] = useState("");
    const [collectionTime, setCollectionTime] = useState<string>(() => {
        const now = new Date();
        return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    });

    const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
    const sessionId = useRef(`${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`);

    // ── Effects ──
    useEffect(() => {
        setIsLoadingParams(true);
        fetch("/api/parameters")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
                if (Array.isArray(data)) setSystemParameters(data);
            })
            .catch((err) => console.error("Fetch Parameters Error:", err))
            .finally(() => setIsLoadingParams(false));
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
            (err) => console.error("GPS Error:", err),
            { enableHighAccuracy: true },
        );
    }, [allLocations, currentLocationId]);

    useEffect(() => {
        if (!currentLocationId || !allLocations.length) return;
        const loc = allLocations.find((l) => l.id.toString() === currentLocationId);
        if (loc) {
            setLocationName(loc.name);
            setLocationType(loc.type);
        }
    }, [currentLocationId, allLocations]);

    useEffect(() => {
        if (!currentUser) return;
        if (currentUser.role !== "collector" && currentUser.role !== "admin") router.push("/map");
    }, [currentUser, router]);

    // ── AI Image Plotter Canvas Helper ──
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
                    const [x_min, y_min, x_max, y_max] = box;
                    ctx.strokeStyle = "#28a745";
                    ctx.lineWidth = Math.max(4, img.width * 0.005);
                    ctx.strokeRect(x_min, y_min, x_max - x_min, y_max - y_min);

                    const confPct = aiData.confidence;
                    const paramLabel = aiData.parameterName ? aiData.parameterName.charAt(0).toUpperCase() + aiData.parameterName.slice(1).toLowerCase() : "Vial";
                    const label = `${paramLabel} | ${aiData.concentrated.toFixed(2)} mg/L confidence ${confPct}`;
                    const fs = Math.max(16, Math.floor(img.width * 0.018));
                    ctx.font = `bold ${fs}px Arial`;
                    const tw = ctx.measureText(label).width,
                        lh = fs * 1.4;
                    ctx.fillStyle = "#28a745";
                    ctx.fillRect(x_min - 2, y_min - lh, tw + 20, lh);
                    ctx.fillStyle = "white";
                    ctx.fillText(label, x_min + 10, y_min - lh * 0.3);
                }
                canvas.toBlob((blob) => resolve(blob ? new File([blob], `plotted-${file.name}`, { type: "image/png" }) : null), "image/png");
            };
            img.src = URL.createObjectURL(file);
        });

    // ── Handlers ──
    const handleAnalyze = async () => {
        if (systemParameters.length === 0) return;
        setStep("analyzing");

        try {
            const newResults: Record<number, MeasurementResult> = {};
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
                const plotted = await generateAiImagePlot(file, data);
                if (plotted) {
                    setImagePlotFiles((prev) => ({ ...prev, [param.id]: plotted }));
                }

                const currentStatus = (data.status?.toLowerCase() ?? "safe") as "safe" | "warning" | "danger";
                newResults[param.id] = {
                    concentrated: data.concentrated,
                    status: currentStatus,
                    message: data.message || "",
                    confidence: data.confidence,
                    boundingBox: data["bounding box"],
                };

                if (currentStatus === "danger") hasDanger = true;
                if (currentStatus === "warning") hasWarning = true;
            }

            setResults(newResults);
            setOverallStatus(hasDanger ? "danger" : hasWarning ? "warning" : "safe");
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

            const measurementsPayload = systemParameters.map((param) => {
                const resData = results[param.id];
                return {
                    parameterId: param.id,
                    value: resData?.concentrated || 0,
                    confidence: resData?.confidence || 0,
                    boundingBox: resData?.boundingBox ? JSON.stringify(resData.boundingBox) : null,
                    message: resData?.message || null,
                };
            });

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

    const clearLocation = () => {
        setCurrentLocationId(null);
        setLocationName("");
        setSearchQuery("");
    };

    return {
        systemParameters,
        isLoadingParams,
        imageFiles,
        setImageFiles,
        imagePreviews,
        setImagePreviews,
        imagePlotFiles,
        setImagePlotFiles,
        hiddenCanvasRef,
        router,
        currentUser,
        currentLocationId,
        setCurrentLocationId,
        locationName,
        setLocationName,
        locationType,
        setLocationType,
        step,
        setStep,
        results,
        overallStatus,
        saved,
        isRecommending,
        setIsRecommending,
        nearestLocations,
        setNearestLocations,
        allLocations,
        searchQuery,
        setSearchQuery,
        collectionTime,
        setCollectionTime,
        oxygen,
        setOxygen,
        sessionId: sessionId.current,
        handleAnalyze,
        handleSave,
        clearLocation,
    };
}
