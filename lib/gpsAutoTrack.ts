"use client";

/* ตั้งค่า "ติดตาม GPS อัตโนมัติเมื่อเข้าหน้าแผนที่" — เก็บฝั่ง client เหมือน theme
   เพราะเป็นค่าความชอบต่อเครื่อง ไม่ใช่ข้อมูลผู้ใช้ที่ต้อง sync ข้ามอุปกรณ์ */

const STORAGE_KEY = "gpsAutoTrack";

/** ค่าที่ผู้ใช้ตั้งเอง — null = ยังไม่เคยแตะสวิตช์นี้ */
export function readAutoTrackSetting(): boolean | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : raw === "true";
}

export function writeAutoTrackSetting(value: boolean) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, String(value));
}

/** สถานะสิทธิ์ตำแหน่งของเบราว์เซอร์ — null = ถามไม่ได้ (LIFF webview บางตัวไม่มี Permissions API) */
export async function queryGeolocationState(): Promise<PermissionState | null> {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;
    try {
        const status = await navigator.permissions.query({ name: "geolocation" });
        return status.state;
    } catch {
        return null;
    }
}

/** ค่าที่ใช้จริง — เคารพค่าที่ผู้ใช้ตั้งเองก่อนเสมอ
    ถ้ายังไม่เคยตั้ง ให้ถือว่าเปิดเมื่อผู้ใช้อนุญาตสิทธิ์ตำแหน่งไว้แล้ว (ไม่งั้นค่าเริ่มต้นคือปิด) */
export async function resolveAutoTrack(): Promise<boolean> {
    const stored = readAutoTrackSetting();
    if (stored !== null) return stored;
    return (await queryGeolocationState()) === "granted";
}

/** ปิดสวิตช์ให้เองเมื่อพบว่าสิทธิ์ถูกถอนไปแล้ว เพื่อไม่ให้หน้าตั้งค่าโชว์ว่า "เปิด" ทั้งที่ใช้งานไม่ได้จริง
    เขียนเฉพาะกรณีที่ผู้ใช้เคยเปิดไว้เอง — ถ้ายังไม่เคยตั้งค่าก็ปล่อยเป็น null ให้วิ่งตามสิทธิ์ต่อไป */
export function disableAutoTrackAfterDenial() {
    if (readAutoTrackSetting() === true) writeAutoTrackSetting(false);
}
