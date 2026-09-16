/**
 * @file MapEvents.tsx
 * @project Water Monitoring Project
 * @module UI / Map / GIS
 * @description
 * คอมโพเนนต์ช่วยของ react-leaflet ที่ไม่ render อะไร ใช้สั่งแผนที่ flyTo ไปยังพิกัดที่ส่งมา
 * ทุกครั้งที่ lat/lng เปลี่ยน (ซูมระดับ 15) ใช้ในหน้าจัดการสถานที่หลังผู้ใช้เลือกที่อยู่/ปักหมุด
 *
 * Headless react-leaflet helper that flies the map to the given coordinates whenever they change.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-21
 * @version 1.0.0
 *
 * @lastModified 2026-07-21 15:00
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-07-21 15:00 by Pachara P. - สร้างตัวเลื่อนแผนที่สำหรับการเพิ่มจุดตรวจ
 *
 * @client-side ต้องอยู่ภายใต้ MapContainer (ใช้ useMap) จึงเป็น Client Component โดยปริยาย
 * @license Private / Proprietary
 */

import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * เลื่อนแผนที่ไปยังพิกัดพร้อมแอนิเมชัน ไม่ทำอะไรเมื่อ lat หรือ lng เป็น 0/ว่าง
 *
 * @param lat - ละติจูด
 * @param lng - ลองจิจูด
 * @returns null (ไม่มี UI)
 */
export function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
    const map = useMap();
    useEffect(() => {
        if (lat && lng) {
            map.flyTo([lat, lng], 15, { animate: true });
        }
    }, [lat, lng, map]);
    return null;
}
