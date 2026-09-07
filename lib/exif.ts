import exifr from "exifr";

export interface LocationData {
    latitude: number;
    longitude: number;
}

function parseCoordinate(value: any, ref?: string): number | null {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const num = parseFloat(value);
        if (!isNaN(num)) return ref === "S" || ref === "W" ? -num : num;
    }
    if (Array.isArray(value) && value.length === 3) {
        const dd = value[0] + value[1] / 60 + value[2] / 3600;
        if (!isNaN(dd)) {
            return ref === "S" || ref === "W" ? -dd : dd;
        }
    }
    return null;
}

export async function getExifLocation(file: File | Blob | ArrayBuffer): Promise<LocationData | null> {
    try {
        // 1. ลองดึง GPS มาตรฐานด่านแรก
        const gps = await exifr.gps(file);
        if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number" && gps.latitude !== 0) {
            return {
                latitude: gps.latitude,
                longitude: gps.longitude,
            };
        }

        // 2. ถ้าด่านแรกไม่เจอ ให้ parse อ่านลึกลงไปในเซกเมนต์ TIFF / XMP / GPS
        const allData = await exifr.parse(file, {
            gps: true,
            tiff: true,
            xmp: true,
        });

        if (allData) {
            let lat = parseCoordinate(allData.latitude ?? allData.GPSLatitude, allData.GPSLatitudeRef);
            let lng = parseCoordinate(allData.longitude ?? allData.GPSLongitude, allData.GPSLongitudeRef);

            // ตรวจสอบว่าเป็นตัวเลขพิกัดจริง ไม่ใช่ NaN และไม่ใช่ 0
            if (lat !== null && lng !== null && lat !== 0 && lng !== 0) {
                return {
                    latitude: lat,
                    longitude: lng,
                };
            }
        }

        // หากไม่มีพิกัดตัวเลขจริง ให้คืน null เสมอ
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
