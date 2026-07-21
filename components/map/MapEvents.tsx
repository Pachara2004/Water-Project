// components/map/MapEvents.tsx (หรือใน MapView)
import { useEffect } from "react";
import { useMap } from "react-leaflet";

export function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) {
            map.flyTo([lat, lng], 15, { animate: true });
        }
    }, [lat, lng, map]);
    return null;
}
