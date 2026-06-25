/**
 * LocationPin — Custom SVG marker icons for react-leaflet
 *
 * PRIMARY: Color by Water Status (what users care about most)
 * - safe    → Green (#22C55E)
 * - warning → Amber (#F59E0B)
 * - danger  → Red   (#EF4444)
 * - no data → Gray  (#94A3B8)
 *
 * SECONDARY: Shape by Organization (for experts)
 * - FISHERY   → Circle inner
 * - POLLUTION → Diamond inner
 * - OTHER     → Square inner
 */

import L from "leaflet";

// 🔒 ปรับเปลี่ยนคีย์สเตตัสให้เป็นตัวพิมพ์เล็กตรงตามผังระบบล่าสุดของบอสครับ
const STATUS_COLORS: Record<
    string,
    { fill: string; stroke: string; inner: string }
> = {
    safe: { fill: "#22C55E", stroke: "#16A34A", inner: "#DCFCE7" },
    warning: { fill: "#F59E0B", stroke: "#D97706", inner: "#FEF3C7" },
    danger: { fill: "#EF4444", stroke: "#DC2626", inner: "#FEE2E2" },
};

const DEFAULT_COLOR = { fill: "#94A3B8", stroke: "#64748B", inner: "#F1F5F9" };

function getStatusColors(status: string | null) {
    if (!status) return DEFAULT_COLOR;

    // 🛡️ ป้องกันเหนียวด้วยการสั่ง .toLowerCase() เคลียร์ค่าพิมพ์เล็กพิมพ์ใหญ่ก่อนวิ่งเข้า Map วัตถุ
    const lowerStatus = status.toLowerCase();
    return STATUS_COLORS[lowerStatus] || DEFAULT_COLOR;
}

function buildPinSvg(colors: typeof DEFAULT_COLOR, innerShape: string): string {
    return `<svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="ds" x="-20%" y="-10%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.25"/>
      </filter>
    </defs>
    <path d="M18 42 C18 42 4 26 4 16 C4 9.4 10.3 4 18 4 C25.7 4 32 9.4 32 16 C32 26 18 42 18 42Z"
          fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1.5" filter="url(#ds)"/>
    <circle cx="18" cy="16" r="7" fill="${colors.inner}" opacity="0.95"/>
    ${innerShape}
  </svg>`;
}

// Inner shapes by organization
const INNER_SHAPES: Record<string, string> = {
    FISHERY: '<circle cx="18" cy="16" r="3.5" fill="currentColor"/>',
    POLLUTION:
        '<rect x="14.5" y="12.5" width="7" height="7" rx="1.5" fill="currentColor" transform="rotate(45 18 16)"/>',
    OTHER: '<rect x="14.5" y="12.5" width="7" height="7" rx="1.5" fill="currentColor"/>',
};

export function createLocationIcon(
    organization: string,
    status: string | null,
): L.DivIcon {
    const colors = getStatusColors(status);
    const innerShape = (
        INNER_SHAPES[organization] || INNER_SHAPES.OTHER
    ).replace("currentColor", colors.fill);

    const svg = buildPinSvg(colors, innerShape);

    return L.divIcon({
        html: svg,
        className: "custom-marker",
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -44],
    });
}
