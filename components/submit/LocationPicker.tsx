// components/submit/LocationPicker.tsx
import { useEffect, useMemo } from "react";
import { Search, MapPin, ChevronRight, Loader2, Navigation, Image as ImageIcon } from "lucide-react";
import { LocationItem } from "./types";
import { SectionHead } from "./SharedAtoms";

// ฟังก์ชันคำนวณระยะทาง (Haversine)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

interface LocationPickerProps {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    locationName: string;
    currentLocationId: string | null;
    setCurrentLocationId: (id: string) => void;
    allLocations: LocationItem[];
    clearLocation: () => void;

    gpsCoords: { lat: number; lng: number } | null;
    exifCoords: { lat: number; lng: number } | null;
    activeSource: "gps" | "exif" | "manual";
    onSelectSource: (source: "gps" | "exif") => void;
}

export function LocationPicker({
    searchQuery,
    setSearchQuery,
    locationName,
    currentLocationId,
    setCurrentLocationId,
    allLocations,
    gpsCoords,
    exifCoords,
    activeSource,
    onSelectSource,
}: LocationPickerProps) {
    const activeCoords = activeSource === "exif" ? exifCoords : activeSource === "gps" ? gpsCoords : null;
    const hasGps = !!gpsCoords;
    const hasExif = !!exifCoords;

    // ⚡ คำนวณและกรองสถานีในรัศมี 5km ภายในไฟล์นี้เลย
    const nearestLocations = useMemo(() => {
        if (!activeCoords || allLocations.length === 0) return [];

        const calculated = allLocations.map((loc) => ({
            ...loc,
            distanceKm: getDistanceKm(activeCoords.lat, activeCoords.lng, loc.lat, loc.lng),
        }));

        calculated.sort((a, b) => a.distanceKm - b.distanceKm);

        // ดึงเฉพาะที่ระยะ <= 5km (ถ้าไม่มีเลย ให้เอาใกล้ที่สุด 3 อันแรกเป็น Fallback)
        const within5km = calculated.filter((loc) => loc.distanceKm <= 5);
        return within5km.length > 0 ? within5km : calculated.slice(0, 3);
    }, [activeCoords, allLocations]);

    // 🟢 AUTO-SELECT: เมื่อเปลี่ยนพิกัด/แหล่งพิกัด ให้เลือกอันที่ใกล้ที่สุดให้อัตโนมัติทันที
    // เพิ่ม flag ref เพื่อป้องกันไม่ให้ auto-select ทับค่าที่มีอยู่เดิมถ้าเป็นการโหลดครั้งแรก
    useEffect(() => {
        if (activeSource !== "manual" && nearestLocations.length > 0) {
            setCurrentLocationId(nearestLocations[0].id.toString());
        }
    }, [nearestLocations, setCurrentLocationId, activeSource]);

    return (
        <section className="rounded-xl bg-surface overflow-hidden border border-border">
            <div className="text-sm font-semibold">
                <SectionHead icon={<MapPin size={16} />} label="เลือกสถานีจุดเก็บตัวอย่างน้ำ" />
            </div>

            <div className="p-3.5 sm:p-4 space-y-3">
                {/* ปุ่มสลับ GPS / EXIF */}
                <div className="flex items-center gap-1.5 p-1 bg-surface-subtle border border-border rounded-xl">
                    <button
                        type="button"
                        onClick={() => hasGps && onSelectSource("gps")}
                        className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            activeSource === "gps" && hasGps ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:text-text-primary bg-surface/50"
                        }`}
                    >
                        <Navigation size={13} />
                        <span className="truncate">GPS เครื่อง {hasGps ? "" : "(ปิดอยู่)"}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => hasExif && onSelectSource("exif")}
                        className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            activeSource === "exif" && hasExif ? "bg-primary text-white shadow-xs" : "text-text-secondary hover:text-text-primary bg-surface/50"
                        }`}
                    >
                        <ImageIcon size={13} />
                        <span className="truncate">พิกัดรูปภาพ {hasExif ? "" : "(ไม่มี)"}</span>
                    </button>
                </div>

                {/* ช่องค้นหาสถานี */}
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={locationName || "ค้นหาสถานี..."}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-surface-subtle border border-border rounded-lg text-text-primary focus:outline-hidden focus:border-teal-500 transition-colors min-h-10"
                    />
                </div>

                {/* รายการจุดตรวจในรัศมี 5km */}
                {searchQuery.trim() ? (
                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-0.5">
                        {allLocations
                            .filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .slice(0, 6)
                            .map((loc) => (
                                <button
                                    key={loc.id}
                                    type="button"
                                    onClick={() => {
                                        setCurrentLocationId(loc.id.toString());
                                        setSearchQuery("");
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors group min-h-10 cursor-pointer ${
                                        currentLocationId === loc.id.toString() ? "border-teal-500/40 bg-teal-50/60 dark:bg-teal-950/20" : "border-border bg-surface hover:bg-surface-subtle"
                                    }`}
                                >
                                    <MapPin size={13} className="text-text-muted group-hover:text-teal-600 shrink-0" />
                                    <span className="text-xs font-medium text-text-primary truncate">{loc.name}</span>
                                    <ChevronRight size={13} className="ml-auto text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                    </div>
                ) : nearestLocations.length > 0 ? (
                    <div className="space-y-1.5">
                        <p className="text-xs uppercase font-medium text-text">สถานีใกล้เคียงในรัศมี 5 กม. (เลือกอันใกล้สุดให้อัตโนมัติ)</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {nearestLocations.map((loc) => {
                                const isSelected = currentLocationId === loc.id.toString();
                                return (
                                    <button
                                        key={loc.id}
                                        type="button"
                                        onClick={() => setCurrentLocationId(loc.id.toString())}
                                        className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors min-h-10 cursor-pointer ${
                                            isSelected
                                                ? "border-teal-500/50 bg-teal-50/60 dark:bg-teal-950/30 text-teal-900 dark:text-teal-100 font-semibold"
                                                : "border-border bg-surface hover:bg-surface-subtle text-text-primary"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isSelected ? "bg-teal-500" : "bg-text-muted"}`} />
                                            <span className="text-xs font-medium truncate">{loc.name}</span>
                                        </div>

                                        <span
                                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${isSelected ? "bg-teal-200/50 dark:bg-teal-900/50 text-teal-800 dark:text-teal-200" : "bg-surface-subtle text-text-muted"}`}
                                        >
                                            {loc.distanceKm < 1 ? `${(loc.distanceKm * 1000).toFixed(0)}m` : `${loc.distanceKm.toFixed(1)} กม.`}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-xs text-text-muted py-2">
                        <Loader2 size={13} className="animate-spin text-teal-600" />
                        <span>กำลังค้นหาสถานีใกล้เคียง…</span>
                    </div>
                )}
            </div>
        </section>
    );
}
