import exifr from "exifr";

export interface LocationData {
    latitude: number;
    longitude: number;
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
            const lat = Number(allData.latitude ?? allData.GPSLatitude);
            const lng = Number(allData.longitude ?? allData.GPSLongitude);

            // ตรวจสอบว่าเป็นตัวเลขพิกัดจริง ไม่ใช่ NaN และไม่ใช่ 0
            if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
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

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}
