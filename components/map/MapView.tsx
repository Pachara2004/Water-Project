"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
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

function MapController({ centerPos, selectedLocation }: { centerPos: [number, number] | null; selectedLocation: BottomSheetLocation | null }) {
    const map = useMap();

    // ⚡ UX Speedup: ปรับลด duration ลงเหลือ 0.6 วินาทีเพื่อให้แผนที่ตอบสนองไวทันใจ ไม่เคลื่อนไหวช้าเกินไป
    useEffect(() => {
        if (centerPos) {
            map.flyTo(centerPos, 13, { duration: 0.6 });
        }
    }, [centerPos, map]);

    // ⚡ UX Speedup: ปรับลด duration ลงเหลือ 0.5 วินาที
    useEffect(() => {
        if (selectedLocation) {
            map.flyTo([selectedLocation.lat, selectedLocation.lng], 14, { duration: 0.5 });
        }
    }, [selectedLocation, map]);

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
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        return () => setIsMounted(false);
    }, []);

    // ⚡ Performance: ใช้ useCallback ป้องกันฟังก์ชันถูกสร้างใหม่ในหน่วยความจำโดยไม่จำเป็น
    const handleLocateMe = useCallback(() => {
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
    }, []);

    const fetchLocations = useCallback(async () => {
        try {
            setLoading(true);
            const params = agencyFilter !== "ALL" ? `?org=${agencyFilter}` : "";
            const res = await fetch(`/api/locations${params}`);
            let data = await res.json();

            if (!Array.isArray(data)) data = [];

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

    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    // ⚡ Performance ขั้นสุด: จำชุดข้อมูล Markers ไว้ในหน่วยความจำ
    // จะคำนวณและเรนเดอร์หมุดใหม่ก็ต่อเมื่อข้อมูลสถานี (locations) หรือโหมดการทำงานเปลี่ยนเท่านั้น
    // ย้ายหน้าจอ ซูมเข้าออก หรือเปิดปิด BottomSheet จะไม่เกิดภาระกับ CPU ในการลูปสร้างหมุดใหม่
    const renderedMarkers = useMemo(() => {
        return locations.map((loc) => (
            <Marker
                key={loc.id}
                position={[loc.lat, loc.lng]}
                icon={createLocationIcon(loc.organization, loc.latestSample?.status || null)}
                eventHandlers={mode === "explorer" ? { click: () => setSelectedLocation(loc) } : undefined}
            />
        ));
    }, [locations, mode]);

    if (!isMounted) return null;

    const center: [number, number] = [13.2, 100.9];
    const zoom = mode === "picker" ? 10 : 9;

    return (
        <div className="relative w-full h-full">
            {mode === "explorer" && (
                <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 lg:left-6 lg:right-auto z-600 flex flex-wrap items-center gap-3 break-all">
                    <FilterBar value={agencyFilter} onChange={setAgencyFilter} />
                    <StatusFilterBar value={statusFilter} onChange={setStatusFilter} />
                </div>
            )}

            <MapContainer key={`map-container-${mode}`} center={center} zoom={zoom} className="w-full h-full" zoomControl={false} attributionControl={false}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />

                {/* ⚡ ดึงหมุดที่บันทึกไว้ในแคชมาแสดงผลทันที */}
                {renderedMarkers}

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
                <MapController centerPos={userPos} selectedLocation={selectedLocation} />
            </MapContainer>

            {mode === "explorer" && (
                <button
                    title="Locate Me"
                    onClick={handleLocateMe}
                    className="absolute bottom-6 right-4 lg:bottom-8 lg:right-6 z-600 bg-surface p-3.5 rounded-full shadow-lg border border-border text-primary hover:bg-surface-subtle transition-all duration-200 active:scale-95 will-change-transform cursor-pointer"
                >
                    <Navigation size={18} className="fill-primary" />
                </button>
            )}

            {mode === "explorer" && <BottomSheet location={selectedLocation} onClose={() => setSelectedLocation(null)} />}
        </div>
    );
}
