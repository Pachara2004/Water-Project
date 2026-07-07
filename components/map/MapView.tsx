"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { createLocationIcon } from "../LocationPin";
import BottomSheet, { BottomSheetLocation } from "./BottomSheet";
import FilterBar from "./OfficerFilterBar";
import StatusFilterBar from "./StatusFilterBar";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { Navigation } from "lucide-react";

interface LocationData {
    id: number;
    name: string;
    organization: string;
    lat: number;
    lng: number;
    createdAt: string;
    latestSample: {
        id: number;
        status: "safe" | "warning" | "danger";
        phosphateVal: number | null;
        ammoniaVal: number | null;
        collectedAt: string;
    } | null;
}

function MapEvents({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            if (onMapClick) {
                onMapClick(e.latlng.lat, e.latlng.lng);
            }
        },
    });
    return null;
}

function MapController({ centerPos }: { centerPos: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (centerPos) {
            map.flyTo(centerPos, 13, { duration: 1.5 });
        }
    }, [centerPos, map]);
    return null;
}

interface MapViewProps {
    mode?: "explorer" | "picker";
    onLocationPick?: (lat: number, lng: number) => void;
    pickedPosition?: { lat: number; lng: number } | null;
}

export default function MapView({ mode = "explorer", onLocationPick, pickedPosition }: MapViewProps) {
    const [locations, setLocations] = useState<LocationData[]>([]);
    const [agencyFilter, setAgencyFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");

    const [selectedLocation, setSelectedLocation] = useState<BottomSheetLocation | null>(null);
    const [loading, setLoading] = useState(true);
    const [userPos, setUserPos] = useState<[number, number] | null>(null);

    const leafletMapRef = useRef<L.Map | null>(null);

    const [mapKey] = useState(() => `map-${mode}-${Math.random().toString(36).slice(2)}`);

    // Center map on selected location
    useEffect(() => {
        if (selectedLocation && leafletMapRef.current) {
            leafletMapRef.current.flyTo([selectedLocation.lat, selectedLocation.lng], 14, { duration: 1 });
        }
    }, [selectedLocation]);

    const handleLocateMe = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setUserPos([pos.coords.latitude, pos.coords.longitude]);
                },
                (err) => {
                    console.error("Geolocation error:", err);
                    alert("ไม่สามารถดึงตำแหน่งปัจจุบันได้");
                },
                { enableHighAccuracy: true },
            );
        } else {
            alert("เบราว์เซอร์ของคุณไม่รองรับ Geolocation");
        }
    };

    const fetchLocations = useCallback(async () => {
        try {
            setLoading(true);
            const params = agencyFilter !== "ALL" ? `?org=${agencyFilter}` : "";
            const res = await fetch(`/api/locations${params}`);
            let data = await res.json();

            if (!Array.isArray(data)) data = [];

            // 🎯 จุดแก้ไขหลัก: แปลงฟิลเตอร์สเตตัสเปรียบเทียบเป็นตัวพิมพ์เล็กให้ตรงเซสชันคลังข้อมูลล่าสุด
            if (statusFilter !== "ALL") {
                const targetStatus = statusFilter.toLowerCase();
                data = data.filter((loc: LocationData) => loc.latestSample?.status?.toLowerCase() === targetStatus);
            }

            setLocations(data);
        } catch (err) {
            console.error("Failed to fetch locations:", err);
        } finally {
            setLoading(false);
        }
    }, [agencyFilter, statusFilter]);

    // โหลดสถานีที่มีอยู่แล้วทั้งใน explorer และ picker (picker ใช้แสดงหมุดอ้างอิงตอนปักหมุดใหม่)
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLocations();
        }, 0);
        return () => clearTimeout(timer);
    }, [mode, fetchLocations]);

    useEffect(() => {
        const currentMap = leafletMapRef.current;
        return () => {
            if (currentMap) {
                const container = currentMap.getContainer();
                if (container) {
                    (container as unknown as { _leaflet_id: number | null })._leaflet_id = null;
                }
            }
        };
    }, []);

    const center: [number, number] = [13.2, 100.9];
    const zoom = mode === "picker" ? 10 : 9;

    return (
        <div className="relative w-full h-full">
            {/* Filter Container */}
            {/* Filter Container */}
            {mode === "explorer" && (
                <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 lg:left-6 lg:right-auto z-600 flex flex-wrap items-center gap-3 break-all">
                    <FilterBar value={agencyFilter} onChange={setAgencyFilter} />
                    <StatusFilterBar value={statusFilter} onChange={setStatusFilter} />
                </div>
            )}

            

            <MapContainer key={mapKey} ref={leafletMapRef} center={center} zoom={zoom} className="w-full h-full" zoomControl={false} attributionControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />

                {locations.map((loc) => (
                    <Marker
                        key={loc.id}
                        position={[loc.lat, loc.lng]}
                        icon={createLocationIcon(loc.organization, loc.latestSample?.status || null)}
                        eventHandlers={mode === "explorer" ? { click: () => setSelectedLocation(loc) } : undefined}
                    />
                ))}

                {mode === "picker" && <MapEvents onMapClick={onLocationPick} />}

                {mode === "picker" && pickedPosition && <Marker position={[pickedPosition.lat, pickedPosition.lng]} icon={createLocationIcon("OTHER", null)} />}

                {userPos && (
                    <Marker
                        position={userPos}
                        icon={L.divIcon({
                            className: "bg-transparent text-2xl flex items-center justify-center",
                            html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md animate-pulse"></div>',
                            iconSize: [24, 24],
                            iconAnchor: [12, 12],
                        })}
                    />
                )}
                <MapController centerPos={userPos} />
            </MapContainer>

            {/* Locate Me Button */}
            {mode === "explorer" && (
                <button
                    title="Locate Me"
                    onClick={handleLocateMe}
                    className="absolute bottom-6 right-4 lg:bottom-8 lg:right-6 z-600 bg-surface p-3.5 rounded-full shadow-lg border border-border text-primary hover:bg-surface-subtle transition-all duration-300 active:scale-95 cursor-pointer"
                >
                    <Navigation size={18} className="fill-primary" />
                </button>
            )}

            {mode === "explorer" && <BottomSheet location={selectedLocation} onClose={() => setSelectedLocation(null)} />}
        </div>
    );
}
