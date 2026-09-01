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
    panInside,
}: {
    centerPos: [number, number] | null;
    selectedLocation: BottomSheetLocation | null;
    pickedPosition?: { lat: number; lng: number } | null;
    panInside?: { bounds: [[number, number], [number, number]]; nonce: number } | null;
}) {
    const map = useMap();

    // เลื่อนจอให้พื้นที่ที่มองเห็นกลับเข้ามาอยู่ในกรอบที่กำหนด โดยไม่ปักหมุดและไม่เปลี่ยนระดับซูม
    // ใช้ panInsideBounds ไม่ใช่ setView เพราะต้องการให้ "ทั้งจอ" อยู่ในกรอบ
    // ถ้าหนีบแค่จุดกึ่งกลางไปไว้ที่เส้นขอบ ครึ่งจอจะยังเป็นนอกกรอบอยู่ และเมื่อกล้องจอดที่ขอบแล้ว
    // การสั่งครั้งถัดไปจะไม่ขยับอีกเลย
    //
    // invalidateSize ก่อนเสมอ เพราะแผนที่อยู่ในฟอร์มที่เลื่อน/ยืดหดได้ ถ้า Leaflet ถือขนาดเดิมค้างไว้
    // การคำนวณว่าต้องเลื่อนเท่าไหร่จะผิด
    //
    // ผูกกับ nonce เพื่อให้สั่งซ้ำได้ ถ้าผู้ใช้แตะนอกกรอบหลายครั้งติดกัน
    useEffect(() => {
        if (!panInside) return;
        map.invalidateSize();

        // ซูมออกให้เห็นขอบเขตทั้งหมดที่เลือกได้ ไม่ใช่แค่ดึงขอบจอให้แตะกรอบ
        //
        // เหตุผล: กรอบที่ส่งมาเป็นสี่เหลี่ยมครอบประเทศ ไม่ใช่รูปร่างประเทศจริง การเลื่อนน้อยที่สุด
        // ให้พอแตะกรอบจึงไปจบที่ประเทศเพื่อนบ้านได้ (เช่นที่ละติจูด 12.6 ขอบกรอบด้านตะวันออก
        // อยู่กลางกัมพูชา ห่างชายแดนไทยราว 300 กม.) และยิ่งซูมลึกจอยิ่งเล็ก ระยะที่ขยับยิ่งน้อย
        //
        // flyToBounds พาไปเห็นภาพรวมทั้งประเทศเสมอ ผู้ใช้จึงเห็นชัดว่าเลือกได้ในขอบเขตไหน
        // แล้วซูมเข้าไปยังจุดที่ต้องการเอง
        map.flyToBounds(L.latLngBounds(panInside.bounds[0], panInside.bounds[1]), { duration: 1 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [panInside?.nonce, map]);

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
    /** เลื่อนจอให้พื้นที่ที่เห็นกลับเข้ากรอบนี้ โดยไม่ปักหมุด — เปลี่ยน nonce ทุกครั้งที่ต้องการให้เลื่อนอีกรอบ */
    panInside?: { bounds: [[number, number], [number, number]]; nonce: number } | null;
}

export default function MapView({ mode = "explorer", onLocationPick, pickedPosition, panInside }: MapViewProps) {
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
        if (!isMounted || mode === "picker") return;
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
                    <div className="w-full sm:w-auto flex-1 min-w-60">
                        <MapSearchBar
                            locations={locations}
                            onSelectLocation={(loc) => {
                                setSelectedLocation(loc);
                            }}
                        />
                    </div>

                    {/* กลุ่มปุ่ม Filter ทั้งสองตัว: จะอยู่บรรทัดเดียวกัน หรือขยายเต็มเมื่อตกบรรทัด */}
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-1 min-w-70">
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
                minZoom={mode === "picker" ? 6 : 6} // ซูมออกได้ต่ำสุดแค่นี้ (เห็นภาพรวมประเทศ)
                maxZoom={15}
                maxBounds={THAILAND_BOUNDS}
                maxBoundsViscosity={1}
                bounceAtZoomLimits={true}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    maxZoom={15}
                    maxNativeZoom={15}
                    noWrap={true}
                />{" "}
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
                <MapController centerPos={userPos} selectedLocation={selectedLocation} pickedPosition={pickedPosition} panInside={panInside} />{" "}
            </MapContainer>

            <button
                title="Locate Me"
                onClick={() => handleLocateMe()}
                className={`absolute bottom-8 right-4 z-600 bg-card-general p-3.5 rounded-full border border-border text-primary transition-all duration-75 active:scale-95 will-change-transform cursor-pointer ${mode === "picker" ? "bottom-8" : ""}`}
            >
                <Navigation size={18} className="fill-primary" />
            </button>

            {mode === "explorer" && <BottomSheet location={selectedLocation} onClose={() => setSelectedLocation(null)} />}
        </div>
    );
}
