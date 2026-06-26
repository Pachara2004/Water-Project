import exifr from "exifr";

export interface LocationData {
    latitude: number;
    longitude: number;
}

export async function getExifLocation(file: File | Blob | ArrayBuffer): Promise<LocationData | null> {
    try {
        const gps = await exifr.gps(file);
        if (gps && gps.latitude && gps.longitude) {
            return {
                latitude: gps.latitude,
                longitude: gps.longitude,
            };
        }
        return null;
    } catch (error) {
        console.error("Error parsing EXIF data:", error);
        return null;
    }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}
