import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { alertError } from "@/lib/swal";
import { DbParameter, LocationItem, MeasurementResult, VerifyError } from "@/components/submit/types";

// ผลวิเคราะห์ดิบต่อภาพหนึ่งใบ ก่อนกระทบยอด (reconcile) กับสารอื่น ๆ ในชุดเดียวกัน
// ใช้ระหว่างขั้นตอน handleAnalyze → finalizeAnalysis เท่านั้น ไม่ได้ persist เป็น state ถาวร
interface AnalyzedItem {
    originalParamId: number; // ช่อง (toggle) ที่ผู้ใช้ถ่ายภาพนี้ใส่ไว้ตอนแรก
    originalParamName: string;
    targetParam: DbParameter; // สารจริงที่ AI ตรวจยืนยัน (จับคู่กับ systemParameters แล้ว)
    file: File;
    plottedFile: File | null;
    aiData: any; // response ดิบจาก /api/analyze
    isMismatch: boolean; // targetParam ตรงกับช่องเดิมหรือไม่
}

const getNowLocalDateTimeString = () => {
    const date = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function useSubmitSample() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { currentUser } = useAppStore();

    // ── States ──
    const [systemParameters, setSystemParameters] = useState<DbParameter[]>([]);
    const [isLoadingParams, setIsLoadingParams] = useState(true);
    // เซ็ตของสารที่เปิด toggle ไว้ (แทนแนวคิด "โหมดเดี่ยว/คู่" เดิม — รองรับ N สารโดยไม่ผูกกับจำนวน)
    // ค่าเริ่มต้นว่าง (ปิดหมด) ตามที่ต้องการเมื่อเข้าจากหน้า /collector
    const [enabledParamIds, setEnabledParamIds] = useState<Set<number>>(new Set());
    // เหตุผลที่ผลวิเคราะห์ของแต่ละสารถูกบล็อก (ไม่ใช่หลอดทดลอง / สารผิดชนิดที่ระบบไม่รู้จัก)
    const [verifyErrors, setVerifyErrors] = useState<Record<number, VerifyError>>({});
    const [imageFiles, setImageFiles] = useState<Record<number, File>>({});
    const [imagePreviews, setImagePreviews] = useState<Record<number, string>>({});
    const [imagePlotFiles, setImagePlotFiles] = useState<Record<number, File>>({});
    const [currentLocationId, setCurrentLocationId] = useState<string | null>(searchParams.get("locationId"));
    const [locationName, setLocationName] = useState("");
    const [locationType, setLocationType] = useState("COMMUNITY");
    const [step, setStep] = useState<"upload" | "analyzing" | "results">("upload");
    const [results, setResults] = useState<Record<number, MeasurementResult>>({});
    // กรณีสารซ้ำ (≥2 ภาพชี้ parameterId เดียวกัน): ผู้ส่งเลือกเก็บได้ภาพเดียวต่อสาร
    // map parameterId → key (virtual key) ของ entry ที่เลือกไว้ | ค่าเริ่มต้นตั้งเป็นภาพ confidence สูงสุดใน finalizeAnalysis
    const [duplicateChoice, setDuplicateChoice] = useState<Record<number, number>>({});
    const [overallStatus, setOverallStatus] = useState<"safe" | "warning" | "danger">("safe");
    const [saved, setSaved] = useState(false);
    // id ของ sample ตัวแรกที่บันทึกสำเร็จในรอบนี้ — ใช้พาไปหน้ารายละเอียดของชุดนี้โดยตรงหลังบันทึกเสร็จ
    const [savedSampleId, setSavedSampleId] = useState<number | null>(null);
    const [isRecommending, setIsRecommending] = useState(false);
    const [nearestLocations, setNearestLocations] = useState<LocationItem[]>([]);
    const [allLocations, setAllLocations] = useState<LocationItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [oxygen, setOxygen] = useState("");
    const [collectionTime, setCollectionTime] = useState<string>(() => getNowLocalDateTimeString());

    const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
    // sessionGroup ต้อง unique จริง เพราะ ReviewRequest ผูกกับมันโดยตรง (sessionGroup @unique)
    // ใช้ crypto.randomUUID() เป็นส่วนรับประกันความไม่ซ้ำ แทนเลขสุ่ม 3 หลักเดิมที่ชนกันได้ง่าย
    const generateSessionId = () => {
        const now = new Date();
        const yymm = `${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
        const uniquePart = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        return `${yymm}-${uniquePart}`;
    };
    const [sessionId, setSessionId] = useState<string>(generateSessionId);

    // เพิ่ม State และ Ref สำหรับเก็บค่าพิกัดดิบทั้งสองฝั่ง
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [exifCoords, setExifCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [activeSource, setActiveSource] = useState<"gps" | "exif" | "manual">("manual");

    // ฟังก์ชันสำหรับคำนวณเรียงลำดับสถานีใกล้เคียงใหม่ตามพิกัดที่เลือก
    const updateNearestByCoords = useCallback(
        (coords: { lat: number; lng: number }) => {
            if (!allLocations.length) return;
            import("@/lib/exif").then(({ calculateDistance }) => {
                const sorted = [...allLocations].sort((a, b) => calculateDistance(coords.lat, coords.lng, a.lat, a.lng) - calculateDistance(coords.lat, coords.lng, b.lat, b.lng));
                setNearestLocations(sorted.slice(0, 5));
            });
        },
        [allLocations],
    );

    // เมื่อคลิกเลือกแหล่งพิกัด (GPS หรือ EXIF)
    // เมื่อคลิกเลือกแหล่งพิกัด (GPS หรือ EXIF)
    const handleSelectSource = (source: "gps" | "exif") => {
        setActiveSource(source);
        if (source === "gps" && gpsCoords) {
            updateNearestByCoords(gpsCoords);
        } else if (source === "exif" && exifCoords) {
            updateNearestByCoords(exifCoords);
        }
    };
    // ── Effects ──
    useEffect(() => {
        setIsLoadingParams(true);
        fetch("/api/parameters")
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data) => {
                if (Array.isArray(data)) {
                    setSystemParameters(data);
                    // ค่าเริ่มต้น: เปิดกล่องอัปโหลดของทุกสารให้หมด ผู้ใช้ไม่ต้องมากดเปิดเองทีละตัว
                    setEnabledParamIds(new Set(data.map((p: DbParameter) => p.id)));
                }
            })
            .catch((err) => console.error("Fetch Parameters Error:", err))
            .finally(() => setIsLoadingParams(false));
    }, []);

    // สารที่เปิด toggle ไว้จริง — ตัดสินใจจาก enabledParamIds ล้วน ๆ ไม่ผูกกับจำนวน (รองรับ N สาร)
    const activeParameters = systemParameters.filter((p) => enabledParamIds.has(p.id));

    // ผู้ส่งเลือกภาพหลักของกลุ่มสารซ้ำ (parameterId → key ที่เลือก)
    const chooseDuplicate = (parameterId: number, key: number) => {
        setDuplicateChoice((prev) => ({ ...prev, [parameterId]: key }));
    };

    // key ของทุก entry ที่จะถูกบันทึกจริง = entry ที่ไม่ซ้ำ + entry ของสารซ้ำที่ถูกเลือกไว้เท่านั้น
    // ใช้ทั้งตอน handleSave (กรองส่ง) และให้ UI ตัดสิน review ตามเฉพาะภาพที่จะบันทึก
    const savedEntryKeys = new Set<number>(
        Object.entries(results)
            .filter(([keyStr, r]) => !r.isDuplicateSubstance || duplicateChoice[r.parameterId] === Number(keyStr))
            .map(([keyStr]) => Number(keyStr)),
    );

    const toggleParam = (paramId: number) => {
        setEnabledParamIds((prev) => {
            const next = new Set(prev);
            if (next.has(paramId)) next.delete(paramId);
            else next.add(paramId);
            return next;
        });
        // เปิด/ปิดสารใหม่ = เคลียร์สถานะบล็อกของช่องนั้นทิ้ง (ถ้ามีค้างจากรอบก่อน)
        setVerifyErrors((prev) => {
            if (!prev[paramId]) return prev;
            const next = { ...prev };
            delete next[paramId];
            return next;
        });
    };

    useEffect(() => {
        fetch("/api/locations")
            .then((r) => r.json())
            .then((d) => {
                if (Array.isArray(d)) setAllLocations(d);
            })
            .catch(console.error);
    }, []);

    // ─── 1. ดึง GPS มือถือปัจจุบัน และตั้งค่า activeSource อัตโนมัติ ───
    useEffect(() => {
        if (typeof window === "undefined" || !navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setGpsCoords(coords);

                // ตั้ง activeSource เป็น gps ทันทีถ้าเพิ่งเข้ามา และยังไม่มีการเลือก EXIF
                setActiveSource((prev) => {
                    if (prev === "manual" || prev === "gps") {
                        updateNearestByCoords(coords);
                        return "gps";
                    }
                    return prev;
                });
            },
            (err) => {
                console.warn("ไม่สามารถดึง GPS ปัจจุบันได้:", err.message);
                setGpsCoords(null);
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    }, [allLocations, updateNearestByCoords]);

    const [weatherData, setWeatherData] = useState<{
        airTemperature: number | null;
        rainAccumulation: number | null;
        weatherCondCode: number | null;
    } | null>(null);

    // 🟢 Effect ดึงสภาพอากาศอิงตามสถานที่และเวลาที่เลือก
    useEffect(() => {
        if (!currentLocationId || !collectionTime) {
            setWeatherData(null);
            return;
        }

        const controller = new AbortController();

        fetch(`/api/weather/preview?locationId=${currentLocationId}&collectionTime=${encodeURIComponent(collectionTime)}`, {
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data) {
                    setWeatherData(data);
                }
            })
            .catch((err) => {
                if (err.name !== "AbortError") {
                    console.error("Fetch weather preview error:", err);
                }
            });

        return () => controller.abort();
    }, [currentLocationId, collectionTime]);

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

    // 1. แกะ EXIF และสลับมาใช้พิกัดรูปภาพทันที
    const processImageExif = useCallback(
        async (file: File) => {
            try {
                const { getExifLocation } = await import("@/lib/exif");
                const coords = await getExifLocation(file);

                if (coords) {
                    const exif = { lat: coords.latitude, lng: coords.longitude };
                    setExifCoords(exif);
                    setActiveSource("exif");
                    updateNearestByCoords(exif);
                } else {
                    console.warn("รูปภาพนี้ไม่มีข้อมูลพิกัด EXIF GPS");
                    setExifCoords(null);
                }
            } catch (err) {
                console.error("ไม่สามารถอ่านค่า EXIF จากรูปภาพได้:", err);
                setExifCoords(null);
            }
        },
        [updateNearestByCoords],
    );
    // 2. ฟังก์ชันสลับปุ่ม (ใช้ Functional Update อ่านค่า State ล่าสุดเสมอ ป้องกัน Stale Closure)
    const onSelectSource = useCallback(
        (source: "gps" | "exif") => {
            setActiveSource(source);

            setGpsCoords((latestGps) => {
                setExifCoords((latestExif) => {
                    if (source === "gps" && latestGps) {
                        updateNearestByCoords(latestGps);
                    } else if (source === "exif" && latestExif) {
                        updateNearestByCoords(latestExif);
                    }
                    return latestExif;
                });
                return latestGps;
            });
        },
        [updateNearestByCoords],
    );

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

    // จัดกลุ่ม AnalyzedItem ตามสารจริง (targetParam.id) ที่ AI เจอ — ใช้ตรวจว่ามีสารซ้ำ (≥2 ภาพชนกัน) ไหม
    const groupByTargetParam = (items: AnalyzedItem[]): Map<number, AnalyzedItem[]> => {
        const groups = new Map<number, AnalyzedItem[]>();
        items.forEach((item) => {
            const arr = groups.get(item.targetParam.id) ?? [];
            arr.push(item);
            groups.set(item.targetParam.id, arr);
        });
        return groups;
    };

    // เก็บผลวิเคราะห์เป็นผลลัพธ์สุดท้าย: rebuild state ทั้งหมดตาม "สารจริง" (targetParam.id) ของทุกภาพที่วิเคราะห์ผ่าน
    // สลับสารให้เสมอโดยไม่ถาม (ผู้ใช้เห็นแบนเนอร์ "เปลี่ยนชนิดสารให้อัตโนมัติ" ที่หน้าผลลัพธ์แทน)
    // กรณีสารซ้ำ (≥2 ภาพชี้สารเดียวกัน): ไม่บังคับให้เลือก — เก็บทั้งสองภาพแยกเป็นคนละรายการ (คนละ virtual key กันชนกัน)
    // แล้วติดธง isDuplicateSubstance ไว้ให้ handleSave บังคับส่งเข้าคิว pending เสมอไม่ว่า confidence จะสูงแค่ไหน
    const finalizeAnalysis = (items: AnalyzedItem[]) => {
        const groups = groupByTargetParam(items);

        const newImageFiles: Record<number, File> = {};
        const newImagePreviews: Record<number, string> = {};
        const newImagePlotFiles: Record<number, File> = {};
        const newResults: Record<number, MeasurementResult> = {};
        const finalParamIds = new Set<number>();
        // ตัวเลือกเริ่มต้นของกลุ่มสารซ้ำ: parameterId → key ของภาพ confidence สูงสุด (ผู้ส่งเปลี่ยนได้ทีหลัง)
        const newDuplicateChoice: Record<number, number> = {};
        let hasDanger = false;
        let hasWarning = false;

        groups.forEach((arr, paramId) => {
            finalParamIds.add(paramId);
            const isDuplicateSubstance = arr.length > 1;
            let bestKey: number | null = null;
            let bestConfidence = -Infinity;

            arr.forEach((it) => {
                // ไม่ชนกัน: ใช้ paramId จริงเป็น key ตามเดิม | ชนกัน: ต้องใช้ virtual key แยกกัน ไม่งั้นทับกันเหลือรายการเดียว
                const key = isDuplicateSubstance ? paramId * 1_000_000 + it.originalParamId : paramId;

                if (isDuplicateSubstance) {
                    const conf = typeof it.aiData.confidence === "number" ? it.aiData.confidence : -Infinity;
                    if (conf > bestConfidence) {
                        bestConfidence = conf;
                        bestKey = key;
                    }
                }

                newImageFiles[key] = it.file;
                if (imagePreviews[it.originalParamId]) newImagePreviews[key] = imagePreviews[it.originalParamId];
                if (it.plottedFile) newImagePlotFiles[key] = it.plottedFile;

                // null = สารนี้ยังไม่มีเกณฑ์กำหนด ตัดสินไม่ได้ — ต้องส่ง null ต่อ ห้าม ?? "safe"
                // เพราะจะกลายเป็นบอกผู้ใช้ว่า "ปลอดภัย" ทั้งที่ไม่เคยมีเกณฑ์ให้เทียบ
                const currentStatus = (it.aiData.status?.toLowerCase() ?? null) as "safe" | "warning" | "danger" | null;
                newResults[key] = {
                    concentrated: it.aiData.concentrated,
                    status: currentStatus,
                    message: it.aiData.message || "",
                    confidence: it.aiData.confidence,
                    boundingBox: it.aiData["bounding box"],
                    isTestTube: it.aiData.isTestTube ?? true,
                    verifiedParameterName: it.aiData.verifiedParameterName || it.targetParam.name,
                    autoSwitchedFrom: it.isMismatch ? it.originalParamName : undefined,
                    parameterId: paramId,
                    isDuplicateSubstance,
                };

                if (currentStatus === "danger") hasDanger = true;
                if (currentStatus === "warning") hasWarning = true;
            });

            if (isDuplicateSubstance && bestKey !== null) newDuplicateChoice[paramId] = bestKey;
        });

        setImageFiles(newImageFiles);
        setImagePreviews(newImagePreviews);
        setImagePlotFiles(newImagePlotFiles);
        setEnabledParamIds(finalParamIds); // toggle สะท้อนองค์ประกอบสุดท้ายจริงหลังกระทบยอด
        setResults(newResults);
        setDuplicateChoice(newDuplicateChoice);
        setOverallStatus(hasDanger ? "danger" : hasWarning ? "warning" : "safe");
        setStep("results");
    };

    // ── Handlers ──
    const handleAnalyze = async () => {
        if (activeParameters.length === 0) return;
        setStep("analyzing");
        setVerifyErrors({}); // ล้างผลบล็อกรอบก่อนหน้าก่อนเริ่มวิเคราะห์ใหม่

        try {
            const newErrors: Record<number, VerifyError> = {};
            const items: AnalyzedItem[] = [];

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
                    // ด่าน 1: ไม่พบหลอดทดลองในภาพ → บังคับถ่ายใหม่
                    newErrors[param.id] = {
                        reason: "not_test_tube",
                        detail: "ไม่พบหลอดทดลองในภาพ หรือภาพอาจเบลอเกินไป กรุณาถ่ายรูปที่มีขวดบรรจุสารให้ชัดเจน ไม่เบลอ แล้ววิเคราะห์ใหม่",
                    };
                    continue;
                }

                // ด่าน 2: AI ตรวจพบว่าสารในภาพเป็นคนละชนิดกับช่องเดิม — หาสารจริงจาก systemParameters
                let targetParam = param;
                if (isMismatch) {
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
                    targetParam = matchedParam;
                }

                const plotted = await generateAiImagePlot(file, data);

                items.push({
                    originalParamId: param.id,
                    originalParamName: param.name,
                    targetParam,
                    file,
                    plottedFile: plotted,
                    aiData: data,
                    isMismatch,
                });
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

            // จัดกลุ่มตามสารจริงแล้ว commit ตรง ๆ — สารซ้ำไม่ต้องให้เลือก เก็บทั้งคู่แยกกัน (ดูรายละเอียดใน finalizeAnalysis)
            finalizeAnalysis(items);
        } catch (err: any) {
            console.error("Analysis failed:", err);
            alertError("วิเคราะห์ภาพล้มเหลว", err.message);
            setStep("upload");
        }
    };


    const handleSave = async () => {
        if (Object.keys(results).length === 0 || !currentLocationId || !currentUser) return;

        try {
            let firstSavedId: number | null = null;

            // วนตาม key จริงใน results (virtual key เมื่อสารซ้ำ) แทน activeParameters เพราะสารซ้ำมี 2 รายการต่อ parameterId เดียวกัน
            for (const [keyStr, resData] of Object.entries(results)) {
                const key = Number(keyStr);

                // สารซ้ำ: บันทึกเฉพาะภาพที่ผู้ส่งเลือกไว้เท่านั้น (ตัวที่ไม่เลือกไม่ถูกส่งขึ้น server เลย)
                if (resData.isDuplicateSubstance && duplicateChoice[resData.parameterId] !== key) continue;

                const rawFile = imageFiles[key];
                const plotFile = imagePlotFiles[key];
                const paramMeta = systemParameters.find((p) => p.id === resData.parameterId);

                if (!rawFile || !paramMeta) continue;

                const fd = new FormData();
                fd.append("locationId", currentLocationId);
                // ไม่ส่ง status แล้ว — server คำนวณเองจากค่าที่วัดได้จริง และไม่เคยเชื่อค่าจาก client อยู่แล้ว
                fd.append("collectionTime", `${collectionTime}:00+07:00`);
                if (oxygen) fd.append("oxygen", oxygen);

                const singleMeasurementPayload = [
                    {
                        parameterId: resData.parameterId,
                        value: resData.concentrated || 0,
                        confidence: resData.confidence || 0,
                        boundingBox: resData.boundingBox ? JSON.stringify(resData.boundingBox) : null,
                        message: resData.message || null,
                    },
                ];
                fd.append("measurements", JSON.stringify(singleMeasurementPayload));

                fd.append(`image_raw_${resData.parameterId}`, rawFile);
                if (plotFile) fd.append(`image_plot_${resData.parameterId}`, plotFile);

                const res = await fetch("/api/samples", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${liff.getAccessToken()}` },
                    body: fd,
                });

                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.error || `เกิดข้อผิดพลาดในการบันทึกสาร ${paramMeta.name}`);
                }

                // เก็บ id ของ sample ตัวแรกที่บันทึกสำเร็จในชุดนี้ ไว้พาไปหน้ารายละเอียดโดยตรงหลังบันทึกเสร็จ
                if (firstSavedId === null) {
                    const savedData = await res.json();
                    if (savedData?.id) firstSavedId = savedData.id;
                }
            }

            if (firstSavedId !== null) setSavedSampleId(firstSavedId);
            setSaved(true);
        } catch (err: any) {
            console.error("Save failed:", err);
            // ... ลอจิก Swal แจ้งเตือนข้อผิดพลาดตามเดิม
        }
    };

    // เคลียร์ผลวิเคราะห์/รูป/ข้อผิดพลาดทั้งหมด กลับไปเริ่มถ่ายภาพใหม่ — ใช้เมื่อผลลัพธ์ไม่ใช่สิ่งที่ต้องการบันทึก
    // คงค่าสถานี/เวลา/toggle สารไว้ตามเดิม (ไม่ต้องกรอกซ้ำ) แต่ออก sessionGroup ใหม่เพราะเป็นการเก็บตัวอย่างรอบใหม่จริง ๆ
    const resetToUpload = () => {
        setResults({});
        setDuplicateChoice({});
        setImageFiles({});
        setImagePreviews({});
        setImagePlotFiles({});
        setVerifyErrors({});
        setSaved(false);
        setSavedSampleId(null);
        setSessionId(generateSessionId());
        setStep("upload");
    };

    const clearLocation = () => {
        setCurrentLocationId(null);
        setLocationName("");
        setSearchQuery("");
    };

    return {
        systemParameters,
        activeParameters,
        enabledParamIds,
        toggleParam,
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
        duplicateChoice,
        chooseDuplicate,
        savedEntryKeys,
        overallStatus,
        saved,
        savedSampleId,
        isRecommending,
        setIsRecommending,
        nearestLocations,
        setNearestLocations,
        allLocations,
        searchQuery,
        weatherData,
        setSearchQuery,
        collectionTime,
        setCollectionTime,
        oxygen,
        setOxygen,
        sessionId,
        handleAnalyze,
        handleSave,
        resetToUpload,
        clearLocation,

        gpsCoords,
        exifCoords,
        activeSource,
        handleSelectSource,
        processImageExif,
        onSelectSource,
    };
}
