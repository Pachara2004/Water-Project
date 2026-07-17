/**
 * LocationPin — Custom SVG marker icons for react-leaflet
 *
 * สีหมุดบอกสถานะคุณภาพน้ำของสถานที่ (ค่าล่าสุดของแต่ละสาร เทียบกับทุกเกณฑ์ เอาผลแย่สุด)
 * - safe    → Green (#22C55E)
 * - warning → Amber (#F59E0B)
 * - danger  → Red   (#EF4444)
 * - no data → Gray  (#94A3B8)
 *
 * เดิมมีรูปทรงข้างในแยกตามหน่วยงาน (FISHERY วงกลม / POLLUTION ข้าวหลามตัด / OTHER สี่เหลี่ยม)
 * แต่ไม่เคยทำงานเลย: มันหาคีย์จาก governingAgency ซึ่งเก็บชื่อไทย ("กรมประมง") ไม่ใช่โค้ด
 * จึงตกไป OTHER ทุกครั้ง → หมุดเป็นสี่เหลี่ยมเหมือนกันหมดมาตลอด ตอนนี้ถอดออกแล้ว
 */

import L from "leaflet";

// ปรับเปลี่ยนคีย์สเตตัสให้เป็นตัวพิมพ์เล็กตรงตามผังระบบล่าสุดของครับ
const STATUS_COLORS: Record<string, { fill: string; stroke: string; inner: string }> = {
    safe: { fill: "#22C55E", stroke: "#16A34A", inner: "#DCFCE7" },
    warning: { fill: "#F59E0B", stroke: "#D97706", inner: "#FEF3C7" },
    danger: { fill: "#EF4444", stroke: "#DC2626", inner: "#FEE2E2" },
};

const DEFAULT_COLOR = { fill: "#94A3B8", stroke: "#64748B", inner: "#F1F5F9" };

function getStatusColors(status: string | null) {
    if (!status) return DEFAULT_COLOR;

    // ป้องกันเหนียวด้วยการสั่ง .toLowerCase() เคลียร์ค่าพิมพ์เล็กพิมพ์ใหญ่ก่อนวิ่งเข้า Map วัตถุ
    const lowerStatus = status.toLowerCase();
    return STATUS_COLORS[lowerStatus] || DEFAULT_COLOR;
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
