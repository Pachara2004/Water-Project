/**
 * @file app/map/loading.tsx
 * @project Water Monitoring Project
 * @module App / Map / Loading
 * @description
 * Skeleton ของหน้าแผนที่: กล่องเต็มพื้นที่แผนที่ animate-pulse ขนาดตรงกับ mapMobile/mapDesktop
 *
 * Route loading UI for /map — a pulsing box matching the map viewport.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-07-16
 * @version 1.0.0
 *
 * @lastModified 2026-07-16 14:52
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-07-16 14:52 by Pachara P. - เพิ่ม skeleton loader ทุกหน้า
 *
 * @client-side ไม่มี hook/state เป็น Server Component ได้ (Next.js route loading UI)
 * @license Private / Proprietary
 */

export default function Loading() {
    return <div className="fixed top-0 left-0 w-full h-[calc(100dvh-72px-env(safe-area-inset-bottom))] lg:h-dvh lg:w-[calc(100%-200px)] lg:left-50 overflow-hidden bg-surface-subtle animate-pulse" />;
}
