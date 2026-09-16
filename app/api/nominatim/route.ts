/**
 * @file app/api/nominatim/route.ts
 * @project Water Monitoring Project
 * @module API / Geocoding & GIS
 * @description
 * [TH] Reverse & Forward Geocoding Proxy Route Handler (GET)
 * ตัวกลางเชื่อมต่อไปยัง OpenStreetMap Nominatim API เพื่อค้นหาชื่อสถานที่จากพิกัด (Reverse Geocoding)
 * หรือค้นหาพิกัดจากชื่อสถานที่ (Search) ในประเทศไทย พร้อมตั้งค่า User-Agent และ Accept-Language ตามข้อกำหนดการใช้งาน
 * [EN] Reverse & Forward Geocoding Proxy Route Handler (GET).
 * Acts as a secure proxy to OpenStreetMap Nominatim API for reverse geocoding (coordinates to address)
 * and forward geocoding (place query to coordinates) with custom User-Agent headers.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-08-31
 * @version 1.0.0
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) (2026-08-31)
 *
 * @lastModified 2026-08-31
 * @lastModifiedBy Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 *
 * @changelog
 * - 2026-08-31 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Initial Nominatim proxy setup
 *
 * @external-service OpenStreetMap Nominatim API
 * @security Proxy shields client IP and adheres to OSM Nominatim Usage Policy
 */

import { NextResponse } from "next/server";

/**
 * ดำเนินการค้นหาพิกัดหรือแปลงพิกัดเป็นชื่อที่อยู่ผ่าน Nominatim OSM Proxy
 * Queries Nominatim for forward search or reverse geocoding.
 *
 * @param {Request} req - HTTP Request object พร้อม Query params (?type=search&q=... หรือ ?type=reverse&lat=...&lon=...)
 * @returns {Promise<NextResponse>} ผลลัพธ์ข้อมูลพิกัดหรือที่อยู่จาก Nominatim ในรูปแบบ JSON
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const type = searchParams.get("type"); // "search" or "reverse"

    let url = "";
    if (type === "search" && q) {
        url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=th&limit=5`;
    } else if (type === "reverse" && lat && lon) {
        url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    } else {
        return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    try {
        const res = await fetch(url, {
            headers: {
                "Accept-Language": "th,en",
                "User-Agent": "WaterProjectApp/1.0 (Contact: admin@waterproject.local)",
            },
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error("Nominatim Proxy Error:", err);
        return NextResponse.json({ error: "Nominatim fetch failed" }, { status: 500 });
    }
}
