// components/submit/LocationPicker.tsx
import { Search, MapPin, ChevronRight, Loader2 } from "lucide-react";
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
}

export function LocationPicker({ searchQuery, setSearchQuery, locationName, currentLocationId, setCurrentLocationId, allLocations, nearestLocations, clearLocation }: LocationPickerProps) {
    return (
        <section className="rounded-xl bg-surface overflow-hidden border border-border">
            <div className="text-sm font-semibold ">
                <SectionHead icon={<MapPin size={16} />} label="เลือกสถานีจุดเก็บตัวอย่างน้ำ" />
            </div>
            <div className="p-4 space-y-3">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={locationName || "ค้นหาสถานีใกล้เคียง"}
                        className="w-full pl-8 pr-3 py-2.5 text-xs bg-surface-subtle border border-border rounded-lg text-text-primary focus:outline-none focus:border-teal-500 transition-colors min-h-11"
                    />
                </div>

                {searchQuery.trim() ? (
                    <div className="space-y-1">
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
                                    className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-lg border text-left transition-colors group min-h-11 ${currentLocationId === loc.id.toString() ? "border-teal-500/40 bg-teal-50/60 dark:bg-teal-950/20" : "border-border bg-surface hover:bg-surface-subtle"}`}
                                >
                                    <MapPin size={12} className="text-text-muted group-hover:text-teal-600 shrink-0" />
                                    <span className="text-xs font-medium text-text-primary truncate">{loc.name}</span>
                                    <ChevronRight size={12} className="ml-auto text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                    </div>
                ) : nearestLocations.length > 0 ? (
                    <div className="space-y-1">
                        <p className="text-xs uppercase text-text-muted px-1">สถานีใกล้เคียง</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {nearestLocations.map((loc) => (
                                <button
                                    key={loc.id}
                                    onClick={() => setCurrentLocationId(loc.id.toString())}
                                    className={`flex items-center gap-2 px-3 py-3 rounded-lg border text-left transition-colors min-h-11 ${currentLocationId === loc.id.toString() ? "border-teal-500/40 bg-teal-50/60 dark:bg-teal-950/20" : "border-border bg-surface hover:bg-surface-subtle"}`}
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${currentLocationId === loc.id.toString() ? "bg-teal-500" : "bg-text-muted"}`} />
                                    <span className="text-xs font-medium text-text-primary truncate">{loc.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-xs text-text-muted py-2">
                        <Loader2 size={12} className="animate-spin text-teal-600" /> กำลังค้นหาสถานีใกล้เคียง…
                    </div>
                )}
            </div>
        </section>
    );
}
