"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import { createLocationIcon } from "./LocationPin";
import BottomSheet, { BottomSheetLocation } from "./BottomSheet";
import FilterBar from "./FilterBar";
import StatusFilterBar from "./StatusFilterBar"; // <-- 1. เพิ่ม Import Component ใหม่
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
    status: "SAFE" | "WARNING" | "DANGER";
    phosphateVal: number | null;
    ammoniaVal: number | null;
    collectedAt: string;
  } | null;
}

function MapEvents({
  onMapClick,
}: {
  onMapClick?: (lat: number, lng: number) => void;
}) {
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

export default function MapView({
  mode = "explorer",
  onLocationPick,
  pickedPosition,
}: MapViewProps) {
  const [locations, setLocations] = useState<LocationData[]>([]);
  // <-- 2. แยก State เป็น 2 ตัว สำหรับหน่วยงาน และ คุณภาพน้ำ
  const [agencyFilter, setAgencyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [selectedLocation, setSelectedLocation] =
    useState<BottomSheetLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);

  const leafletMapRef = useRef<L.Map | null>(null);

  const [mapKey] = useState(
    () => `map-${mode}-${Math.random().toString(36).slice(2)}`,
  );

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
      // <-- 3. อัปเดตเงื่อนไขดึง API และกรองข้อมูล
      const params = agencyFilter !== "ALL" ? `?org=${agencyFilter}` : "";
      const res = await fetch(`/api/locations${params}`);
      let data = await res.json();

      if (!Array.isArray(data)) data = [];

      // กรองสถานะคุณภาพน้ำ (ถ้าไม่ได้เลือก ALL)
      if (statusFilter !== "ALL") {
        data = data.filter(
          (loc: LocationData) => loc.latestSample?.status === statusFilter,
        );
      }

      setLocations(data);
    } catch (err) {
      console.error("Failed to fetch locations:", err);
    } finally {
      setLoading(false);
    }
  }, [agencyFilter, statusFilter]); // <-- อัปเดต Dependency ตรงนี้

  useEffect(() => {
    if (mode === "explorer") {
      const timer = setTimeout(() => {
        fetchLocations();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [mode, fetchLocations]);

  useEffect(() => {
    const currentMap = leafletMapRef.current;
    return () => {
      if (currentMap) {
        const container = currentMap.getContainer();
        if (container) {
          (container as unknown as { _leaflet_id: number | null })._leaflet_id =
            null;
        }
      }
    };
  }, []);

  const center: [number, number] = [13.2, 100.9];
  const zoom = mode === "picker" ? 10 : 9;

  return (
    <div className="relative w-full h-full">
      {/* <-- 4. สร้าง Container หุ้ม Filter ทั้ง 2 ตัว ให้อยู่มุมซ้ายบนเหมือนเดิม */}
      {mode === "explorer" && (
        <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 lg:left-6 z-[600] flex items-center gap-3">
          <FilterBar value={agencyFilter} onChange={setAgencyFilter} />
          <StatusFilterBar value={statusFilter} onChange={setStatusFilter} />
        </div>
      )}

      {loading && mode === "explorer" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[600] bg-surface/95 backdrop-blur-md px-4 py-2.5 rounded-full shadow-lg text-[10px] font-bold text-text-secondary flex items-center gap-2 border border-border transition-all duration-300">
          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          กำลังประมวลผลแผนที่...
        </div>
      )}

      <MapContainer
        key={mapKey}
        ref={leafletMapRef}
        center={center}
        zoom={zoom}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {mode === "explorer" &&
          locations.map((loc) => (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={createLocationIcon(
                loc.organization,
                loc.latestSample?.status || null,
              )}
              eventHandlers={{
                click: () => setSelectedLocation(loc),
              }}
            />
          ))}

        {mode === "picker" && <MapEvents onMapClick={onLocationPick} />}

        {mode === "picker" && pickedPosition && (
          <Marker
            position={[pickedPosition.lat, pickedPosition.lng]}
            icon={createLocationIcon("OTHER", null)}
          />
        )}

        {userPos && (
          <Marker
            position={userPos}
            icon={L.divIcon({
              className:
                "bg-transparent text-2xl flex items-center justify-center",
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
          onClick={handleLocateMe}
          className="absolute bottom-6 right-4 lg:bottom-8 lg:right-6 z-[600] bg-surface p-3.5 rounded-full shadow-lg border border-border text-primary hover:bg-surface-subtle transition-all duration-300 active:scale-95 cursor-pointer"
        >
          <Navigation size={18} className="fill-primary" />
        </button>
      )}

      {mode === "explorer" && (
        <BottomSheet
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
        />
      )}
    </div>
  );
}
