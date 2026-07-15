import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { alertError } from "@/lib/swal";
import { DbParameter, LocationItem, MeasurementResult, VerifyError } from "@/components/submit/types";

export function useSubmitSample() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { currentUser } = useAppStore();

    // ── States ──
    const [systemParameters, setSystemParameters] = useState<DbParameter[]>([]);
    const [isLoadingParams, setIsLoadingParams] = useState(true);
    // โหมดการส่ง: เดี่ยว (เลือกสารเดียว) เป็นค่าเริ่มต้น / คู่ (ส่งทุกสารพร้อมกัน)
    const [mode, setMode] = useState<"single" | "dual">("single");
    const [selectedParamId, setSelectedParamId] = useState<number | null>(null);
    // เหตุผลที่ผลวิเคราะห์ของแต่ละสารถูกบล็อก (ไม่ใช่หลอดทดลอง / สารผิดชนิด)
    const [verifyErrors, setVerifyErrors] = useState<Record<number, VerifyError>>({});
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
    // sessionGroup ต้อง unique จริง เพราะ ReviewRequest ผูกกับมันโดยตรง (sessionGroup @unique)
    // ใช้ crypto.randomUUID() เป็นส่วนรับประกันความไม่ซ้ำ แทนเลขสุ่ม 3 หลักเดิมที่ชนกันได้ง่าย
    const [sessionId, setSessionId] = useState<string>(() => {
        const now = new Date();
        const yymm = `${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
        const uniquePart = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        return `${yymm}-${uniquePart}`;
    });
    // ── Effects ──
    useEffect(() => {
        setIsLoadingParams(true);
        fetch("/api/parameters")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
                if (Array.isArray(data)) {
                    setSystemParameters(data);
                    // โหมดเดี่ยวเป็นค่าเริ่มต้น จึงตั้งสารตัวแรกให้อัตโนมัติ
                    if (data.length > 0) setSelectedParamId((prev) => prev ?? data[0].id);
                }
            })
            .catch((err) => console.error("Fetch Parameters Error:", err))
            .finally(() => setIsLoadingParams(false));
    }, []);

    // สารที่กำลังทำงานอยู่จริงตามโหมด: คู่ = ทุกตัว / เดี่ยว = เฉพาะตัวที่เลือก
    const activeParameters =
        mode === "dual" ? systemParameters : systemParameters.filter((p) => p.id === selectedParamId);

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

                //    จำกัดด้านที่ยาวสุดของ canvas: รูปจากมือถือความละเอียดสูง (เช่น 4000px+) ทำให้ canvas.toBlob()
                const MAX_DIM = 2000;
                const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const box = aiData["bounding box"];
                if (box?.length === 4) {
                    // พิกัด bounding box อยู่ในสเปซของรูปต้นฉบับ ต้องคูณ scale ให้ตรงกับ canvas ที่ย่อแล้ว
                    const [x_min, y_min, x_max, y_max] = box.map((v: number) => v * scale);
                    ctx.strokeStyle = "#28a745";
                    ctx.lineWidth = Math.max(4, canvas.width * 0.005);
                    ctx.strokeRect(x_min, y_min, x_max - x_min, y_max - y_min);
                    
                    const confPct = aiData.confidence;
                    const labelSource = aiData.verifiedParameterName || aiData.parameterName;
                    const paramLabel = labelSource ? labelSource.charAt(0).toUpperCase() + labelSource.slice(1).toLowerCase() : "Vial";
                    const label = `${paramLabel} | ${aiData.concentrated.toFixed(2)} mg/L confidence ${confPct}`;
                    const fs = Math.max(16, Math.floor(canvas.width * 0.018));
                    ctx.font = `bold ${fs}px Arial`;
                    const tw = ctx.measureText(label).width,
                        lh = fs * 1.4;
                    ctx.fillStyle = "#28a745";
                    ctx.fillRect(x_min - 2, y_min - lh, tw + 20, lh);
                    ctx.fillStyle = "white";
                    ctx.fillText(label, x_min + 10, y_min - lh * 0.3);
                }
                // ส่งออกเป็น JPEG (เบากว่า PNG และตรงกับนามสกุล .jpg) ลดโอกาส toBlob ล้มบนมือถือลงอีก
                const outName = `plotted-${file.name.replace(/\.[^.]+$/, "")}.jpg`;
                canvas.toBlob((blob) => resolve(blob ? new File([blob], outName, { type: "image/jpeg" }) : null), "image/jpeg", 0.9);
            };
            img.onerror = () => resolve(null);
            img.src = URL.createObjectURL(file);
        });

    // ── Handlers ──
    const handleAnalyze = async () => {
        if (activeParameters.length === 0) return;
        setStep("analyzing");
        setVerifyErrors({}); // ล้างผลบล็อกรอบก่อนหน้าก่อนเริ่มวิเคราะห์ใหม่

        try {
            const newResults: Record<number, MeasurementResult> = {};
            const newErrors: Record<number, VerifyError> = {};
            // การสลับ id ของภาพ/ผลลัพธ์ (โหมดเดี่ยว): จาก paramId ที่เลือกไว้ → paramId ของสารที่ AI ตรวจเจอจริง
            const idSwitches: { fromId: number; toId: number }[] = [];
            let hasDanger = false;
            let hasWarning = false;

            for (const param of activeParameters) {
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

                // ── ด่านตรวจก่อนรับผล (mirror ลำดับฝั่ง AI: เช็คหลอดทดลองก่อน แล้วค่อยเช็คชนิดสาร) ──
                const isTestTube = data.isTestTube ?? true;
                const verifiedName: string = data.verifiedParameterName || param.name;
                const isMismatch = verifiedName.toLowerCase() !== param.name.toLowerCase();

                if (!isTestTube) {
                    // ด่าน 1: ไม่พบหลอดทดลองในภาพ → บังคับถ่ายใหม่ (ทั้งโหมดเดี่ยวและคู่)
                    newErrors[param.id] = {
                        reason: "not_test_tube",
                        detail: "ไม่พบหลอดทดลองในภาพ กรุณาถ่ายรูปที่มีขวดบรรจุสารให้ชัดเจนแล้ววิเคราะห์ใหม่",
                    };
                    continue;
                }

                // ด่าน 2: AI ตรวจพบว่าสารในภาพเป็นคนละชนิดกับที่ระบุ
                let effectiveParam = param;
                if (isMismatch) {
                    if (mode === "single") {
                        // โหมดเดี่ยว: เปลี่ยนไปใช้สารที่ AI ตรวจเจอจริงให้อัตโนมัติ แทนการบล็อก
                        const matchedParam = systemParameters.find((p) => p.name.toLowerCase() === verifiedName.toLowerCase());
                        if (!matchedParam) {
                            // AI ตรวจเจอสารที่ระบบไม่รู้จัก (ไม่มีในฐานข้อมูล) — บล็อกไว้เพราะสลับให้ไม่ได้
                            const verifiedLabel = verifiedName.charAt(0).toUpperCase() + verifiedName.slice(1).toLowerCase();
                            newErrors[param.id] = {
                                reason: "wrong_solution",
                                detail: `สารในภาพนี้ตรวจพบว่าเป็น ${verifiedLabel} ซึ่งไม่มีในระบบ กรุณาถ่ายภาพใหม่`,
                            };
                            continue;
                        }
                        effectiveParam = matchedParam;
                        if (matchedParam.id !== param.id) {
                            idSwitches.push({ fromId: param.id, toId: matchedParam.id });
                        }
                    } else {
                        // โหมดคู่: ยังบล็อกเหมือนเดิม เพราะยังไม่มีวิธีจัดการการสลับข้าม 2 สารพร้อมกัน
                        const verifiedLabel = verifiedName.charAt(0).toUpperCase() + verifiedName.slice(1).toLowerCase();
                        newErrors[param.id] = {
                            reason: "wrong_solution",
                            detail: `สารในภาพนี้ตรวจพบว่าเป็น ${verifiedLabel} ไม่ตรงกับที่เลือกไว้ กรุณาเลือกสารให้ตรงหรือถ่ายภาพใหม่`,
                        };
                        continue;
                    }
                }

                // ผ่านด่าน → พล็อตภาพ + เก็บผลตามปกติ (คีย์ด้วย effectiveParam.id เผื่อถูกสลับสารแล้ว)
                const plotted = await generateAiImagePlot(file, data);
                if (plotted) {
                    setImagePlotFiles((prev) => ({ ...prev, [effectiveParam.id]: plotted }));
                }

                const currentStatus = (data.status?.toLowerCase() ?? "safe") as "safe" | "warning" | "danger";
                newResults[effectiveParam.id] = {
                    concentrated: data.concentrated,
                    status: currentStatus,
                    message: data.message || "",
                    confidence: data.confidence,
                    boundingBox: data["bounding box"],
                    isTestTube,
                    verifiedParameterName: verifiedName,
                    autoSwitchedFrom: isMismatch ? param.name : undefined,
                };

                if (currentStatus === "danger") hasDanger = true;
                if (currentStatus === "warning") hasWarning = true;
            }

            // ถ้ามีสารตัวใดไม่ผ่านด่าน → บล็อกทั้ง batch: ไม่เข้าหน้าผลลัพธ์ กลับไปหน้ากรอกข้อมูล
            if (Object.keys(newErrors).length > 0) {
                setVerifyErrors(newErrors);
                // เคลียร์รูปเฉพาะตัวที่ไม่ใช่หลอดทดลอง (ภาพใช้ไม่ได้ ต้องถ่ายใหม่)
                // ส่วน wrong_solution คงรูปไว้ เพราะผู้ใช้อาจแค่เลือกชนิดสารผิด
                const toClear = Object.entries(newErrors)
                    .filter(([, e]) => e.reason === "not_test_tube")
                    .map(([id]) => Number(id));
                if (toClear.length > 0) {
                    setImageFiles((prev) => {
                        const next = { ...prev };
                        toClear.forEach((id) => delete next[id]);
                        return next;
                    });
                    setImagePreviews((prev) => {
                        const next = { ...prev };
                        toClear.forEach((id) => delete next[id]);
                        return next;
                    });
                    setImagePlotFiles((prev) => {
                        const next = { ...prev };
                        toClear.forEach((id) => delete next[id]);
                        return next;
                    });
                }
                setStep("upload");
                return;
            }

            // ย้ายไฟล์ภาพดิบ/พรีวิวจาก id เดิม (สารที่เลือกไว้) ไปที่ id ใหม่ (สารที่ AI ตรวจเจอจริง)
            // เพื่อให้ ImageZone ของสารใหม่แสดงรูปที่เพิ่งวิเคราะห์ไปถูกต้อง
            if (idSwitches.length > 0) {
                setImageFiles((prev) => {
                    const next = { ...prev };
                    idSwitches.forEach(({ fromId, toId }) => {
                        if (next[fromId] !== undefined) {
                            next[toId] = next[fromId];
                            delete next[fromId];
                        }
                    });
                    return next;
                });
                setImagePreviews((prev) => {
                    const next = { ...prev };
                    idSwitches.forEach(({ fromId, toId }) => {
                        if (next[fromId] !== undefined) {
                            next[toId] = next[fromId];
                            delete next[fromId];
                        }
                    });
                    return next;
                });
                // โหมดเดี่ยวมีสารเดียวเสมอ จึงสลับตัวเลือกสารที่ active ให้ตรงกับสารที่ AI ตรวจเจอจริง
                setSelectedParamId(idSwitches[idSwitches.length - 1].toId);
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
            for (const param of activeParameters) {
                const resData = results[param.id];
                const rawFile = imageFiles[param.id];
                const plotFile = imagePlotFiles[param.id];

                if (!resData || !rawFile) continue;

                const fd = new FormData();
                fd.append("locationId", currentLocationId);
                fd.append("status", resData.status);
                fd.append("collectionTime", new Date(collectionTime).toISOString());
                if (oxygen) fd.append("oxygen", oxygen);

                // พอเปลี่ยนเป็น useState แล้ว ตรงนี้บอสพ่นชื่อตัวแปร sessionId ลงไปตรง ๆ ได้เลยครับ!
                fd.append("sessionGroup", sessionId);

                const singleMeasurementPayload = [
                    {
                        parameterId: param.id,
                        value: resData.concentrated || 0,
                        confidence: resData.confidence || 0,
                        boundingBox: resData.boundingBox ? JSON.stringify(resData.boundingBox) : null,
                        message: resData.message || null,
                    },
                ];
                fd.append("measurements", JSON.stringify(singleMeasurementPayload));

                fd.append(`image_raw_${param.id}`, rawFile);
                if (plotFile) fd.append(`image_plot_${param.id}`, plotFile);

                const res = await fetch("/api/samples", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
                    body: fd,
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || `เกิดข้อผิดพลาดในการบันทึกสาร ${param.name}`);
                }
            }

            setSaved(true);
        } catch (err: any) {
            console.error("Save failed:", err);
            // ... ลอจิก Swal แจ้งเตือนข้อผิดพลาดตามเดิม
        }
    };

    const clearLocation = () => {
        setCurrentLocationId(null);
        setLocationName("");
        setSearchQuery("");
    };

    return {
        systemParameters,
        activeParameters,
        mode,
        setMode,
        selectedParamId,
        setSelectedParamId,
        verifyErrors,
        setVerifyErrors,
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
        sessionId,
        handleAnalyze,
        handleSave,
        clearLocation,
    };
}
