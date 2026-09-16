/**
 * @file LocationPin.tsx
 * @project Water Monitoring Project
 * @module UI / Map / GIS
 * @description
 * สร้างไอคอนหมุด SVG แบบกำหนดเองสำหรับ react-leaflet สีหมุดบอกสถานะคุณภาพน้ำของสถานที่
 * (ค่าล่าสุดของแต่ละสาร เทียบกับทุกเกณฑ์ เอาผลแย่สุด) ค่าสีมาจาก STATUS_PIN_COLOR ใน
 * lib/chartColors.ts ชุดเดียวกับแท่งสถานะบนแดชบอร์ด หมุดทุกหน่วยงานใช้รูปทรงเดียวกัน
 *
 * Custom SVG marker icon factory for react-leaflet. Pin colour encodes the
 * location's SAFE / WARNING / DANGER status using the shared chart colour source.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.0.0
 *
 * @contributors
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) (2026-07-17, 2026-09-04)
 *
 * @lastModified 2026-09-04 14:09
 * @lastModifiedBy Nopparut Udomlert
 *
 * @changelog
 * - 2026-06-09 09:09 by Pachara P. - สร้างหมุดพร้อมโครงระบบ
 * - 2026-07-17 15:08 by Nopparut U. - ถอดรูปทรงข้างในตามหน่วยงาน (INNER_SHAPES) ที่ไม่เคยทำงานเพราะ governingAgency เก็บชื่อไทยไม่ใช่โค้ด
 * - 2026-09-04 14:09 by Nopparut U. - ย้ายค่าสีไปใช้ STATUS_PIN_COLOR แหล่งเดียวกับกราฟ
 *
 * @see docs/skills/SKILL_googlemap_uxui.md
 * @license Private / Proprietary
 */

import L from "leaflet";
import { STATUS_PIN_COLOR } from "@/lib/chartColors";

const DEFAULT_COLOR = STATUS_PIN_COLOR.noData;

function getStatusColors(status: string | null) {
    if (!status) return DEFAULT_COLOR;

    // ป้องกันเหนียวด้วยการสั่ง .toLowerCase() เคลียร์ค่าพิมพ์เล็กพิมพ์ใหญ่ก่อนวิ่งเข้า Map วัตถุ
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === "safe" || lowerStatus === "warning" || lowerStatus === "danger") return STATUS_PIN_COLOR[lowerStatus];
    return DEFAULT_COLOR;
}

function buildPinSvg(colors: typeof DEFAULT_COLOR): string {
    return `<svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="ds" x="-20%" y="-10%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.25"/>
      </filter>
    </defs>
    <path d="M18 42 C18 42 4 26 4 16 C4 9.4 10.3 4 18 4 C25.7 4 32 9.4 32 16 C32 26 18 42 18 42Z"
          fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.5" filter="url(#ds)"/>
    <circle cx="18" cy="16" r="7" fill="${colors.inner}" opacity="0.95"/>
  </svg>`;
}

/**
 * สร้าง Leaflet DivIcon หมุดตามสถานะคุณภาพน้ำ
 *
 * @param status - `"safe" | "warning" | "danger"` (ไม่สนตัวพิมพ์) หรือ null; ค่าอื่น/null ใช้สี noData
 * @returns DivIcon ขนาด 36×44 px ปลายหมุดอยู่ที่พิกัดจริง
 *
 * @example
 * ```ts
 * <Marker position={[lat, lng]} icon={createLocationIcon(location.status)} />
 * ```
 */
export function createLocationIcon(status: string | null): L.DivIcon {
    const colors = getStatusColors(status);

    return L.divIcon({
        html: buildPinSvg(colors),
        className: "custom-marker",
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -44],
    });
}
