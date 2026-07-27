"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { createLocationIcon } from "../LocationPin";
import BottomSheet, { BottomSheetLocation } from "./BottomSheet";
import MapSearchBar from "./MapSearchBar";
import FilterBar from "./OfficerFilterBar";
import StatusFilterBar from "./StatusFilterBar";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { Navigation } from "lucide-react";
import { alertError } from "@/lib/swal";
import { disableAutoTrackAfterDenial, resolveAutoTrack } from "@/lib/gpsAutoTrack";

interface LocationData {
    id: number;
    name: string;
    organization: string;
    lat: number;
    lng: number;
    createdAt: string;
    locationStatus: "safe" | "warning" | "danger" | null;
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

function MapController({
    centerPos,
    selectedLocation,
    pickedPosition,
}: {
    centerPos: [number, number] | null;
    selectedLocation: BottomSheetLocation | null;
    pickedPosition?: { lat: number; lng: number } | null;
}) {
    const map = useMap();

    // ย้ายกล้องไปที่ตำแหน่งปักหมุด/เลือกสถานที่ (pickedPosition)
    useEffect(() => {
        if (pickedPosition) {
            map.flyTo([pickedPosition.lat, pickedPosition.lng], 15, {
                animate: true,
                duration: 0.8,
            });
        }
    }, [pickedPosition, map]);

    // ย้ายกล้องเมื่อค้นหา GPS ผู้ใช้ (centerPos)
    useEffect(() => {
        if (centerPos) {
            const timer = setTimeout(() => {
                map.flyTo(centerPos, 15, {
                    animate: true,
                    duration: 0.8,
                });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [centerPos, map]);

    // ย้ายกล้องเมื่อเลือกสถานที่จาก BottomSheet
    useEffect(() => {
        if (selectedLocation) {
            map.flyTo([selectedLocation.lat, selectedLocation.lng], 15, { duration: 0.5 });
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

    const [userPos, setUserPos] = useState<[number, number] | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        return () => setIsMounted(false);
    }, []);

    // ฟังก์ชันดึงพิกัด — silent = เรียกอัตโนมัติ ห้ามเด้ง dialog รบกวนผู้ใช้ (ปุ่มที่ผู้ใช้กดเองถึงจะแจ้งเตือน)
    const handleLocateMe = useCallback((silent = false) => {
        if (!navigator.geolocation) {
            if (!silent) alertError("เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserPos([pos.coords.latitude, pos.coords.longitude]);
            },
            (err) => {
                console.warn("Geolocation error:", err);
                if (silent) {
                    // สิทธิ์ถูกถอนหลังเปิดสวิตช์ไว้ → ปิดสวิตช์ให้ตรงความจริง หน้าจัดการจะได้ไม่โชว์ว่ายังเปิดอยู่
                    if (err.code === err.PERMISSION_DENIED) disableAutoTrackAfterDenial();
                    return;
                }
                if (err.code === err.PERMISSION_DENIED) {
                    alertError("ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง", "กรุณาเปิดสิทธิ์การเข้าถึงตำแหน่งในตั้งค่าเบราว์เซอร์หรือแอป LINE แล้วลองใหม่อีกครั้ง");
                } else {
                    alertError("ไม่สามารถดึงตำแหน่งปัจจุบันได้", "กรุณาลองใหม่อีกครั้ง");
                }
            },
            { enableHighAccuracy: true },
        );
    }, []);

    // ดึงพิกัดอัตโนมัติตอนเข้าหน้า เฉพาะเมื่อผู้ใช้เปิดสวิตช์ "GPS อัตโนมัติ" ไว้ที่หน้าจัดการ
    useEffect(() => {
        if (!isMounted) return;
        let cancelled = false;

        (async () => {
            const autoTrack = await resolveAutoTrack();
            if (!cancelled && autoTrack) handleLocateMe(true);
        })();

        return () => {
            cancelled = true;
        };
    }, [isMounted, handleLocateMe]);

    // ฟังก์ชัน fetch ข้อมูลสถานีน้ำ (คงเดิม)[cite: 10]
    const fetchLocations = useCallback(async () => {
        try {
            const params = agencyFilter !== "ALL" ? `?org=${agencyFilter}` : "";
            const res = await fetch(`/api/locations${params}`);
            let data = await res.json();

            if (!Array.isArray(data)) data = [];

            if (statusFilter !== "ALL") {
                const targetStatus = statusFilter.toLowerCase();
                data = data.filter((loc: LocationData) => loc.locationStatus === targetStatus);
            }

            setLocations(data);
        } catch (err) {
            console.error("Failed to fetch locations:", err);
        }
    }, [agencyFilter, statusFilter]);

    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    // แคชชิ่ง Markers (คงเดิม)[cite: 10]
    const renderedMarkers = useMemo(() => {
        return locations.map((loc) => (
            <Marker
                key={loc.id}
                position={[loc.lat, loc.lng]}
                icon={createLocationIcon(loc.locationStatus)}
                eventHandlers={mode === "explorer" ? { click: () => setSelectedLocation(loc) } : undefined}
            />
        ));
    }, [locations, mode]);

    if (!isMounted) return null;

    /* 
       พอพิกัด GPS ของเบราว์เซอร์โหลดมาได้สำเร็จ แผนที่จะรัน MapController ทำเอฟเฟกต์ flyTo โผบินไปหาพิกัดผู้ใช้โดยอัตโนมัติครับ
    */
    const center: [number, number] = [13.2, 100.9];
    const zoom = mode === "picker" ? 10 : 9;

    const THAILAND_BOUNDS = L.latLngBounds(
        [4.5, 95.0], // ขยับลงใต้ (ครอบคลุมมาเลเซียตอนบน) และขยับไปตะวันตก (อันดามัน)
        [23.5, 110.0],
    );

    return (
        <div className="relative w-full h-full">
            {mode === "explorer" && (
                <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 lg:left-6 lg:right-auto z-600 flex flex-wrap items-center gap-2">
                    {/* ช่อง Search ค้นหา */}
                    <div className="w-full sm:w-auto flex-1 min-w-[240px]">
                        <MapSearchBar
                            locations={locations}
                            onSelectLocation={(loc) => {
                                setSelectedLocation(loc);
                            }}
                        />
                    </div>

                    {/* กลุ่มปุ่ม Filter ทั้งสองตัว: จะอยู่บรรทัดเดียวกัน หรือขยายเต็มเมื่อตกบรรทัด */}
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-1 min-w-[280px]">
                        <div className="flex-1 min-w-0">
                            <FilterBar value={agencyFilter} onChange={setAgencyFilter} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <StatusFilterBar value={statusFilter} onChange={setStatusFilter} />
                        </div>
                    </div>
                </div>
            )}

            <MapContainer
                key={`map-container-${mode}`}
                center={center}
                zoom={zoom}
                className="w-full h-full"
                zoomControl={false}
                attributionControl={false}
                minZoom={mode === "picker" ? 1 : 1} // ซูมออกได้ต่ำสุดแค่นี้ (เห็นภาพรวมประเทศ)
                maxZoom={25}
                maxBounds={THAILAND_BOUNDS}
                maxBoundsViscosity={0.1}
                bounceAtZoomLimits={true}
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
                {renderedMarkers}
                {mode === "picker" && <MapEvents onMapClick={onLocationPick} />}
                {mode === "picker" && pickedPosition && <Marker position={[pickedPosition.lat, pickedPosition.lng]} icon={createLocationIcon(null)} />}
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
                <MapController centerPos={userPos} selectedLocation={selectedLocation} pickedPosition={pickedPosition} />{" "}
            </MapContainer>

            {mode === "explorer" && (
                <button
                    title="Locate Me"
                    onClick={() => handleLocateMe()}
                    className="absolute bottom-8 right-4 z-600 bg-card-general p-3.5 rounded-full border border-border text-primary transition-all duration-75 active:scale-95 will-change-transform cursor-pointer"
                >
                    <Navigation size={18} className="fill-primary" />
                </button>
            )}

            {mode === "explorer" && <BottomSheet location={selectedLocation} onClose={() => setSelectedLocation(null)} />}
        </div>
    );
}
