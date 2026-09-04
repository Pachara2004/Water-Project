/**
 * LocationPin — Custom SVG marker icons for react-leaflet
 *
 * สีหมุดบอกสถานะคุณภาพน้ำของสถานที่ (ค่าล่าสุดของแต่ละสาร เทียบกับทุกเกณฑ์ เอาผลแย่สุด)
 * ค่าสีมาจาก STATUS_PIN_COLOR ใน lib/chartColors.ts ชุดเดียวกับแท่งสถานะบนแดชบอร์ด
 *
 * เดิมมีรูปทรงข้างในแยกตามหน่วยงาน (FISHERY วงกลม / POLLUTION ข้าวหลามตัด / OTHER สี่เหลี่ยม)
 * แต่ไม่เคยทำงานเลย: มันหาคีย์จาก governingAgency ซึ่งเก็บชื่อไทย ("กรมประมง") ไม่ใช่โค้ด
 * จึงตกไป OTHER ทุกครั้ง → หมุดเป็นสี่เหลี่ยมเหมือนกันหมดมาตลอด ตอนนี้ถอดออกแล้ว
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
