import exifr from "exifr";

export interface LocationData {
    latitude: number;
    longitude: number;
}

function parseCoordinate(value: any, ref?: string): number | null {
    if (value == null) return null;

    let dd: number | null = null;

    if (typeof value === "number") {
        dd = value;
    } else if (Array.isArray(value)) {
        if (value.length >= 3) {
            // รองรับทั้ง [d, m, s] และ [[num, den], [num, den], [num, den]] (rational arrays)
            const parsePart = (part: any) => {
                if (typeof part === "number") return part;
                if (Array.isArray(part) && part.length === 2 && part[1] !== 0) {
                    return part[0] / part[1];
                }
                const n = Number(part);
                return isNaN(n) ? 0 : n;
            };
            const d = parsePart(value[0]);
            const m = parsePart(value[1]);
            const s = parsePart(value[2]);
            dd = d + m / 60 + s / 3600;
        } else if (value.length === 1) {
            dd = Number(value[0]);
        }
    } else if (typeof value === "string") {
        const str = value.trim();
        // รองรับ DMS string เช่น 13°45'32.1" หรือ 13 deg 45' 32.1"
        const dmsMatch = str.match(/(\d+)[^\d\.]+?(\d+)[^\d\.]+?(\d+(\.\d+)?)/);
        if (dmsMatch) {
            const d = parseFloat(dmsMatch[1]);
            const m = parseFloat(dmsMatch[2]);
            const s = parseFloat(dmsMatch[3]);
            dd = d + m / 60 + s / 3600;
        } else {
            // รองรับ string ที่คั่นด้วย comma "13,45,32.1"
            const parts = str.split(",").map((p) => parseFloat(p.trim()));
            if (parts.length >= 3 && parts.every((p) => !isNaN(p))) {
                dd = parts[0] + parts[1] / 60 + parts[2] / 3600;
            } else {
                dd = parseFloat(str);
            }
        }
    }

    if (dd !== null && !isNaN(dd)) {
        // หากมีอ้างอิง S หรือ W ต้องเป็นค่าติดลบ
        const upperRef = ref?.toUpperCase();
        if ((upperRef === "S" || upperRef === "W") && dd > 0) {
            return -dd;
        }
        return dd;
    }

    return null;
}

export async function getExifLocation(file: File | Blob | ArrayBuffer): Promise<LocationData | null> {
    try {
        // มือถือ (iOS Safari, LINE LIFF WebView) มีปัญหากับการอ่าน File object ซ้ำหลายครั้ง
        // เพราะ internal stream ถูก consume ไปแล้วครั้งแรก จะ seek กลับไม่ได้
        // แก้โดยอ่านเป็น ArrayBuffer ก่อนครั้งเดียว แล้วส่ง buffer ให้ exifr ทุกขั้นตอน
        let buffer: ArrayBuffer;
        if (file instanceof ArrayBuffer) {
            buffer = file;
        } else {
            buffer = await file.arrayBuffer();
        }

        // 1. ลองดึง GPS มาตรฐานด่านแรก (exifr.gps จะคำนวณและแปลงให้แล้วสำหรับเครื่องส่วนใหญ่)
        const gps = await exifr.gps(buffer);
        if (gps && typeof gps.latitude === "number" && !isNaN(gps.latitude) && typeof gps.longitude === "number" && !isNaN(gps.longitude) && gps.latitude !== 0) {
            console.log("[EXIF] GPS parsed successfully (fast path):", gps.latitude, gps.longitude);
            return {
                latitude: gps.latitude,
                longitude: gps.longitude,
            };
        }

        // 2. ถ้าด่านแรกไม่เจอ ให้ parse อ่านลึกลงไปในเซกเมนต์ TIFF / XMP / GPS ทุกฟิลด์ที่อาจซ่อนอยู่
        const allData = await exifr.parse(buffer, {
            gps: true,
            tiff: true,
            xmp: true,
        });

        if (allData) {
            console.log(
                "[EXIF] Deep parse result keys:",
                Object.keys(allData).filter((k) => /lat|lng|lon|gps/i.test(k)),
            );

            // ดึงข้อมูลฟิลด์ต่างๆ เผื่อเครื่องแต่ละรุ่นเก็บชื่อไม่เหมือนกัน
            const rawLat = allData.latitude ?? allData.lat ?? allData.GPSLatitude;
            const rawLatRef = allData.GPSLatitudeRef ?? allData.latitudeRef;
            const rawLng = allData.longitude ?? allData.lng ?? allData.lon ?? allData.GPSLongitude;
            const rawLngRef = allData.GPSLongitudeRef ?? allData.longitudeRef;

            console.log("[EXIF] Raw values:", { rawLat, rawLatRef, rawLng, rawLngRef });

            let lat = parseCoordinate(rawLat, rawLatRef);
            let lng = parseCoordinate(rawLng, rawLngRef);

            console.log("[EXIF] Parsed coordinates:", { lat, lng });

            // ตรวจสอบว่าเป็นตัวเลขพิกัดจริง ไม่ใช่ NaN และไม่ใช่ 0
            if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
                return {
                    latitude: lat,
                    longitude: lng,
                };
            }
        }

        // หากไม่มีพิกัดตัวเลขจริง ให้คืน null เสมอ
        console.warn("[EXIF] No valid GPS coordinates found in image");
        return null;
    } catch (error) {
        console.error("Error parsing EXIF data:", error);
        return null;
    }
}

export function calculateDistance(lat1: number | string, lon1: number | string, lat2: number | string, lon2: number | string): number {
    const l1 = Number(lat1);
    const ln1 = Number(lon1);
    const l2 = Number(lat2);
    const ln2 = Number(lon2);

    if (isNaN(l1) || isNaN(ln1) || isNaN(l2) || isNaN(ln2)) return NaN;

    const R = 6371;
    const dLat = deg2rad(l2 - l1);
    const dLon = deg2rad(ln2 - ln1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(l1)) * Math.cos(deg2rad(l2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}
