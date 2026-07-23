// components/submit/LocationPicker.tsx
import { Search, MapPin, ChevronRight, Loader2, Navigation, Image as ImageIcon } from "lucide-react";
import { LocationItem } from "./types";
import { SectionHead } from "./SharedAtoms";

interface LocationPickerProps {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    locationName: string;
    currentLocationId: string | null;
    setCurrentLocationId: (id: string) => void;
    allLocations: LocationItem[];
    nearestLocations: LocationItem[];
    clearLocation: () => void;

    // Props สำหรับสวิตช์ 3 กรณี
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
    nearestLocations,
    gpsCoords,
    exifCoords,
    activeSource,
    onSelectSource,
}: LocationPickerProps) {
    const hasGps = !!gpsCoords;
    const hasExif = !!exifCoords;

    const handleGpsClick = () => {
        if (hasGps) {
            onSelectSource("gps");
        } else {
            alert("ไม่พบพิกัด GPS: กรุณาเปิดการเข้าถึงตำแหน่ง (Location) ในเบราว์เซอร์ครับ");
        }
    };

    const handleExifClick = () => {
        if (hasExif) {
            onSelectSource("exif");
        } else {
            alert("รูปถ่ายไม่มีข้อมูลพิกัด: รูปภาพนี้ไม่มีข้อมูล EXIF GPS ระบบจึงใช้พิกัดจาก GPS เครื่องแทนครับ");
        }
    };

    return (
        <section className="rounded-xl bg-surface overflow-hidden border border-border">
            <div className="text-sm font-semibold">
                <SectionHead icon={<MapPin size={16} />} label="เลือกสถานีจุดเก็บตัวอย่างน้ำ" />
            </div>

            <div className="p-3.5 sm:p-4 space-y-3">
                {/* ปุ่มสลับแหล่งพิกัด (GPS เครื่อง / EXIF รูป) */}
                <div className="flex items-center gap-1.5 p-1 bg-surface-subtle border border-border rounded-xl">
                    <button
                        type="button"
                        onClick={handleGpsClick}
                        className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            activeSource === "gps" && hasGps
                                ? "bg-primary text-white shadow-xs"
                                : !hasGps
                                  ? "opacity-50 text-text-muted bg-transparent"
                                  : "text-text-secondary hover:text-text-primary bg-surface/50"
                        }`}
                    >
                        <Navigation size={13} />
                        <span className="truncate">GPS เครื่อง {hasGps ? "" : "(ปิดอยู่)"}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleExifClick}
                        className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            activeSource === "exif" && hasExif
                                ? "bg-primary text-white shadow-xs"
                                : !hasExif
                                  ? "opacity-50 text-text-muted bg-transparent"
                                  : "text-text-secondary hover:text-text-primary bg-surface/50"
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
                        placeholder={locationName || "ค้นหาสถานีใกล้เคียง"}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-surface-subtle border border-border rounded-lg text-text-primary focus:outline-hidden focus:border-teal-500 transition-colors min-h-10"
                    />
                </div>

                {/* แสดงผลรายการสถานีใกล้เคียง / ผลการค้นหา */}
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
                                        currentLocationId === loc.id.toString()
                                            ? "border-teal-500/40 bg-teal-50/60 dark:bg-teal-950/20"
                                            : "border-border bg-surface hover:bg-surface-subtle"
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
                        <p className="text-[10px] uppercase font-bold text-text-muted px-0.5">
                            {activeSource === "exif" && hasExif
                                ? "สถานีใกล้เคียงพิกัดรูปภาพ"
                                : activeSource === "gps" && hasGps
                                  ? "สถานีใกล้เคียงพิกัดปัจจุบัน (GPS)"
                                  : "สถานีแนะนำทั้งหมด"}
                        </p>
                        {/* ปรับให้เป็น Grid 2 คอลัมน์ได้สวยงามเมื่ออยู่บนหน้าจอใหญ่ */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {nearestLocations.map((loc) => (
                                <button
                                    key={loc.id}
                                    type="button"
                                    onClick={() => setCurrentLocationId(loc.id.toString())}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors min-h-10 cursor-pointer ${
                                        currentLocationId === loc.id.toString()
                                            ? "border-teal-500/40 bg-teal-50/60 dark:bg-teal-950/20"
                                            : "border-border bg-surface hover:bg-surface-subtle"
                                    }`}
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${currentLocationId === loc.id.toString() ? "bg-teal-500" : "bg-text-muted"}`} />
                                    <span className="text-xs font-medium text-text-primary truncate">{loc.name}</span>
                                </button>
                            ))}
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