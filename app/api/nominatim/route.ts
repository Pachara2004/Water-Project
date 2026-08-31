import { NextResponse } from "next/server";

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
