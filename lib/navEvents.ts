"use client";

// Event bus แบบเบา ๆ ให้หน้าที่เปลี่ยนสถานะคำร้อง (อนุมัติ/ปฏิเสธ/รับทราบ) สั่ง Navbar
// รีเฟรชจุดแดงได้ทันที โดยไม่ต้องรีโหลดหน้าเว็บ — Navbar อยู่ใน layout เลยไม่ remount ตอนเปลี่ยนหน้า
// จึงต้องมีสัญญาณบอกให้ fetch ใหม่เอง (แทนที่จะพึ่ง mount/focus อย่างเดียว)
const NAV_DOTS_REFRESH_EVENT = "nav-dots-refresh";

export function refreshNavDots() {
    window.dispatchEvent(new Event(NAV_DOTS_REFRESH_EVENT));
}

export function onNavDotsRefresh(handler: () => void) {
    window.addEventListener(NAV_DOTS_REFRESH_EVENT, handler);
    return () => window.removeEventListener(NAV_DOTS_REFRESH_EVENT, handler);
}
