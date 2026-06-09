---
name: googlemap-uxui
description: >
  Apply this skill when building map-centric applications inspired by Google Maps design patterns.
  Covers: layer system, bottom sheet, marker clustering, non-overlapping UI components, thumb-zone
  design, GPS UX, mobile-first map layout, and panel/overlay management.
  Project context: Water Quality Monitoring System (Thailand) — React Leaflet + Next.js + LINE LIFF
license: Internal use — Water Quality Monitoring System Project
---

# Google Maps UX/UI Design Skill
## สำหรับระบบแผนที่ที่มี Interactive Map เป็น Core Feature

ออกแบบโดยอิงจาก Google Maps Design Language และปรับใช้กับโปรเจ็ค Water Quality Monitoring System
(React Leaflet + Next.js + Tailwind CSS + LINE LIFF)

---

## CORE PHILOSOPHY — หลักคิดของ Google Maps UX

```
1. MAP IS ALWAYS THE HERO     → แผนที่ต้องเต็มจอเสมอ UI อยู่ "บนแผนที่" ไม่ใช่ "แทนแผนที่"
2. THUMB FIRST                → 90% ของ action ต้องอยู่ในโซนนิ้วโป้ง (ล่าง 2/3 ของหน้าจอ)
3. PROGRESSIVE DISCLOSURE     → แสดงข้อมูลเป็นชั้น ไม่ยัดทุกอย่างขึ้นหน้าจอพร้อมกัน
4. ZERO OVERLAP RULE          → UI component ต้องไม่บดบังข้อมูลแผนที่ที่สำคัญ
5. CONTEXT AWARENESS          → UI เปลี่ยนตาม zoom level, state, และ user role
```

---

## PHASE 1 — Layer Architecture (ระบบชั้น — หัวใจของ Map UI)

### 1.1 Z-Index Layer Stack

```
Layer 0  : Map Tiles (base layer)         z-index: 0
Layer 10 : Map Markers & Overlays         z-index: 400  ← Leaflet default
Layer 20 : Map Controls (zoom, locate)    z-index: 500
Layer 30 : Persistent UI (search, FAB)    z-index: 600
Layer 40 : Bottom Sheet / Side Panel      z-index: 700
Layer 50 : Modal / Dialog                 z-index: 800
Layer 60 : Toast / Notification           z-index: 900
Layer 70 : Loading Overlay                z-index: 1000
```

```css
/* ตัวแปรสำหรับ z-index management */
:root {
  --z-map:        0;
  --z-marker:     400;
  --z-control:    500;
  --z-ui:         600;
  --z-panel:      700;
  --z-modal:      800;
  --z-toast:      900;
  --z-loading:    1000;
}
```

### 1.2 CSS Layout Structure

```css
/* Map Container — เต็มจอเสมอ */
.map-page {
  position: relative;
  width: 100vw;
  height: 100dvh;  /* dvh = dynamic viewport height (รองรับ mobile browser chrome) */
  overflow: hidden;
}

/* Map Layer */
.map-layer {
  position: absolute;
  inset: 0;
  z-index: var(--z-map);
}

/* UI Overlay Layer */
.ui-layer {
  position: absolute;
  inset: 0;
  z-index: var(--z-ui);
  pointer-events: none;  /* ← สำคัญมาก: ให้ click ทะลุไปที่แผนที่ได้ */
}

/* element ที่รับ click ต้อง reset pointer-events */
.ui-layer .clickable {
  pointer-events: auto;
}
```

---

## PHASE 2 — Non-Overlapping Component System (Zero Overlap Rule)

### 2.1 Safe Zone Map — การแบ่งพื้นที่ UI บนหน้าจอ

```
┌────────────────────────────────────────┐
│ [TOP SAFE ZONE — 56–72px]              │  ← Search bar, App bar
│  ───────────────────────────────────── │
│                                        │
│                                        │
│         MAP CLEAR ZONE                 │  ← ห้ามวาง UI ที่บดบัง
│         (แผนที่ต้องมองเห็นได้)         │
│                                        │
│                                        │
│ ───────────────────────────────────── │
│ [BOTTOM SAFE ZONE — 80–200px]         │  ← Filter bar, Legend, Bottom handle
│ ┌──────────────────────────────────┐   │
│ │ Bottom Sheet (collapsed)          │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘

Side zones:
  LEFT  16px  → ปล่อยให้แผนที่โชว์
  RIGHT 16px  → วาง Zoom controls, Locate button ได้
```

### 2.2 Component Safe Zone กับ React Leaflet

```tsx
// ใช้ Leaflet Control Position ในการวาง UI ตามมุม
// ห้ามวาง position: absolute แบบสุ่ม

// ✅ ถูกต้อง — ใช้ Leaflet control system
<MapContainer>
  <ZoomControl position="bottomright" />
  <LocateButton position="bottomright" />
  {/* UI อื่นๆ วางใน overlay ด้านนอก MapContainer */}
</MapContainer>

// ✅ ถูกต้อง — overlay ด้านนอก
<div className="map-page">
  <MapContainer className="map-layer" />
  <div className="ui-layer">
    <SearchBar />          {/* top */}
    <FilterChips />        {/* top, ใต้ search */}
    <LegendWidget />       {/* bottom-left */}
    <BottomSheet />        {/* bottom */}
  </div>
</div>
```

### 2.3 Tailwind Implementation — Safe Zones

```tsx
{/* Top Bar — Search + Filter */}
<div className="absolute top-0 left-0 right-0 z-[600] px-4 pt-3 pb-2
                pointer-events-none">
  <div className="pointer-events-auto">
    <SearchBar />
  </div>
  <div className="pointer-events-auto mt-2 flex gap-2 overflow-x-auto scrollbar-hide">
    <FilterChip label="ทั้งหมด" active />
    <FilterChip label="อันตราย" />
    <FilterChip label="เฝ้าระวัง" />
    <FilterChip label="ปลอดภัย" />
  </div>
</div>

{/* Bottom Right Controls — ห่างจาก Bottom Sheet */}
<div className="absolute bottom-[220px] right-4 z-[600]
                flex flex-col gap-2 pointer-events-auto">
  <MapControlButton icon="locate" onClick={handleLocate} />
</div>

{/* Bottom Sheet — พื้นที่ด้านล่าง */}
<BottomSheet
  className="absolute bottom-0 left-0 right-0 z-[700]"
  minHeight={88}
  maxHeight="75vh"
/>
```

---

## PHASE 3 — Google Maps Bottom Sheet Pattern

### 3.1 Bottom Sheet States

```
State 1: Collapsed (peek)      → height: 88px   เห็นแค่ handle + summary
State 2: Half-expanded         → height: 45vh   เห็น list รายการ
State 3: Full-expanded         → height: 85vh   เห็น detail ทั้งหมด
State 4: Hidden                → height: 0      ซ่อนหมด (เช่น กำลัง draw)
```

```tsx
// Bottom Sheet Component
interface BottomSheetProps {
  snapPoints: number[];  // [88, 0.45, 0.85] — px หรือ vh fraction
  defaultSnap?: number;
  children: React.ReactNode;
}

// CSS สำหรับ Bottom Sheet
const bottomSheetStyles = `
  .bottom-sheet {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: white;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.12);
    z-index: var(--z-panel);
    transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
    touch-action: none;  /* รองรับ drag gesture */
  }

  .bottom-sheet__handle {
    width: 36px; height: 4px;
    background: #D1D5DB;
    border-radius: 2px;
    margin: 12px auto 0;
  }

  .bottom-sheet__content {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;  /* ป้องกัน scroll ทะลุไปที่แผนที่ */
    padding-bottom: env(safe-area-inset-bottom, 16px);
  }
`;
```

### 3.2 Station Detail Card Pattern (ใน Bottom Sheet)

```tsx
// เมื่อ user กด Marker — Bottom Sheet แสดง station detail
const StationDetailCard = ({ station }) => (
  <div className="px-4 py-3">

    {/* Header Row — ชื่อ + Status Badge */}
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-gray-900 truncate">
          {station.name}
        </h3>
        <p className="text-sm text-gray-500 mt-0.5">
          อัพเดต: {station.lastUpdated}
        </p>
      </div>
      <StatusBadge status={station.status} />
    </div>

    {/* Divider */}
    <div className="h-px bg-gray-100 my-3" />

    {/* Chemical Values Grid */}
    <div className="grid grid-cols-2 gap-3">
      <ChemicalCard
        label="แอมโมเนีย (NH₃)"
        value={station.ammonia}
        unit="mg/L"
        threshold={0.5}
      />
      <ChemicalCard
        label="ฟอสเฟต (PO₄)"
        value={station.phosphate}
        unit="mg/L"
        threshold={0.1}
      />
    </div>

    {/* Actions — เต็มความกว้าง ง่ายต่อการกด */}
    <div className="mt-4 flex gap-2">
      <button className="flex-1 h-11 rounded-xl bg-blue-600 text-white
                         text-sm font-medium active:scale-[0.98]">
        ดูประวัติ
      </button>
      <button className="flex-1 h-11 rounded-xl border border-gray-200
                         text-gray-700 text-sm font-medium active:scale-[0.98]">
        นำทาง
      </button>
    </div>
  </div>
);
```

---

## PHASE 4 — Map Marker System (Non-overlapping Markers)

### 4.1 Marker Design ตาม Status

```tsx
// Custom Marker Factory
const createStatusMarker = (status: 'safe' | 'warning' | 'danger', isActive = false) => {
  const config = {
    safe:    { color: '#22C55E', bg: '#DCFCE7', border: '#16A34A', label: 'ปลอดภัย' },
    warning: { color: '#F59E0B', bg: '#FEF3C7', border: '#D97706', label: 'เฝ้าระวัง' },
    danger:  { color: '#EF4444', bg: '#FEE2E2', border: '#DC2626', label: 'อันตราย' },
  }[status];

  const size = isActive ? 44 : 36;  // Active marker ใหญ่กว่า

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 36 36"
         xmlns="http://www.w3.org/2000/svg">
      <!-- Drop shadow -->
      <filter id="shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.25"/>
      </filter>
      <!-- Pin shape -->
      <path d="M18 2C11.37 2 6 7.37 6 14c0 8.25 12 20 12 20s12-11.75 12-20c0-6.63-5.37-12-12-12z"
            fill="${config.color}" stroke="${config.border}" stroke-width="1.5"
            filter="url(#shadow)"/>
      <!-- Inner circle -->
      <circle cx="18" cy="14" r="6" fill="${config.bg}"/>
      <!-- Status dot -->
      <circle cx="18" cy="14" r="3" fill="${config.color}"/>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],  // จุดยึดที่ปลายล่าง
    popupAnchor: [0, -size],
    className: 'custom-marker',
  });
};
```

### 4.2 Marker Clustering — ป้องกัน Marker ทับกัน

```tsx
// ใช้ react-leaflet-cluster
import MarkerClusterGroup from 'react-leaflet-cluster';

const MapMarkers = ({ stations }) => (
  <MarkerClusterGroup
    chunkedLoading
    maxClusterRadius={60}        // ระยะที่จะ merge เป็น cluster (px)
    showCoverageOnHover={false}
    iconCreateFunction={(cluster) => {
      const count = cluster.getChildCount();
      // หาสถานะที่วิกฤตที่สุดใน cluster
      const worstStatus = getWorstStatus(cluster.getAllChildMarkers());
      return createClusterIcon(count, worstStatus);
    }}
  >
    {stations.map(station => (
      <Marker
        key={station.id}
        position={[station.lat, station.lng]}
        icon={createStatusMarker(station.status)}
        eventHandlers={{
          click: () => onMarkerClick(station),
        }}
      />
    ))}
  </MarkerClusterGroup>
);

// Cluster Icon — แสดงจำนวน + สถานะที่แย่ที่สุด
const createClusterIcon = (count: number, worstStatus: string) => {
  const colors = {
    danger:  { bg: '#FEE2E2', border: '#DC2626', text: '#991B1B' },
    warning: { bg: '#FEF3C7', border: '#D97706', text: '#92400E' },
    safe:    { bg: '#DCFCE7', border: '#16A34A', text: '#14532D' },
  }[worstStatus];

  return L.divIcon({
    html: `<div style="
      width:40px; height:40px;
      background:${colors.bg};
      border:2px solid ${colors.border};
      border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:13px; font-weight:700; color:${colors.text};
      box-shadow:0 2px 8px rgba(0,0,0,0.15);"
    >${count}</div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};
```

### 4.3 Popup Design — ไม่บดบัง Marker อื่น

```tsx
// Popup ที่กระชับ — ไม่ใหญ่เกินไป
const StationPopup = ({ station }) => (
  <Popup
    offset={[0, -36]}        // ป้องกันซ้อนทับ marker
    closeButton={false}
    maxWidth={200}
    className="station-popup"
  >
    <div className="p-2">
      <p className="text-xs font-semibold text-gray-800 mb-1">{station.name}</p>
      <div className="flex items-center gap-1">
        <StatusDot status={station.status} size={8} />
        <span className="text-xs text-gray-600">{station.statusLabel}</span>
      </div>
      <p className="text-xs text-gray-400 mt-1">แตะเพื่อดูรายละเอียด</p>
    </div>
  </Popup>
);

// CSS — Popup ที่สวยงาม ไม่มีขอบรัง Leaflet default
.station-popup .leaflet-popup-content-wrapper {
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  padding: 0;
}
.station-popup .leaflet-popup-tip {
  display: none;  /* ซ่อน arrow ถ้าดีไซน์ไม่ต้องการ */
}
```

---

## PHASE 5 — Search Bar Design (Google Maps Style)

### 5.1 Search Bar Layout

```tsx
// Floating Search Bar — เหมือน Google Maps
const MapSearchBar = () => (
  <div className="
    absolute top-3 left-4 right-4
    bg-white rounded-2xl
    shadow-[0_2px_12px_rgba(0,0,0,0.15)]
    flex items-center gap-3
    px-4 h-14
    z-[600]
    pointer-events-auto
  ">
    {/* Back / Menu icon */}
    <button className="text-gray-500 h-10 w-10 flex items-center justify-center
                       flex-shrink-0 -ml-2 rounded-full active:bg-gray-100">
      <MenuIcon size={22} />
    </button>

    {/* Search Input */}
    <input
      type="text"
      placeholder="ค้นหาจุดเก็บตัวอย่าง..."
      className="flex-1 text-base text-gray-800 placeholder:text-gray-400
                 bg-transparent outline-none"
    />

    {/* Right action */}
    <button className="h-10 w-10 flex items-center justify-center
                       flex-shrink-0 -mr-2 rounded-full active:bg-gray-100">
      <Avatar size={32} />
    </button>
  </div>
);
```

### 5.2 Filter Chips — ใต้ Search Bar

```tsx
// Scrollable Filter Chips — ไม่ wrap
const FilterChips = () => (
  <div className="
    absolute top-[72px] left-0 right-0
    px-4 flex gap-2
    overflow-x-auto scrollbar-hide
    pointer-events-auto
    pb-1
  ">
    {filters.map(filter => (
      <button
        key={filter.id}
        className={`
          flex-shrink-0 h-9 px-4 rounded-full text-sm font-medium
          border transition-all active:scale-[0.96]
          ${filter.active
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700 border-gray-200 shadow-sm'
          }
        `}
      >
        {filter.icon && <span className="mr-1">{filter.icon}</span>}
        {filter.label}
      </button>
    ))}
  </div>
);
```

---

## PHASE 6 — Legend Widget (แบบ Google Maps)

### 6.1 Collapsible Legend

```tsx
// Legend ที่กระชับ พับได้
const MapLegend = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="
      absolute bottom-[100px] left-4
      bg-white rounded-xl shadow-md
      pointer-events-auto
      overflow-hidden
      z-[600]
    ">
      {/* Toggle Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 w-full"
      >
        <span className="text-xs font-semibold text-gray-700">สัญลักษณ์</span>
        <ChevronIcon className={expanded ? 'rotate-180' : ''} size={14} />
      </button>

      {/* Legend Items */}
      {expanded && (
        <div className="border-t border-gray-100 px-3 pb-2 space-y-1.5">
          {[
            { status: 'safe',    label: 'ปลอดภัย',  color: '#22C55E' },
            { status: 'warning', label: 'เฝ้าระวัง', color: '#F59E0B' },
            { status: 'danger',  label: 'อันตราย',  color: '#EF4444' },
          ].map(item => (
            <div key={item.status} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0"
                   style={{ background: item.color }} />
              <span className="text-xs text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## PHASE 7 — Thumb Zone Design (มือถือ)

### 7.1 Thumb Zone Map

```
┌──────────────────────┐
│ ████████████████████ │  ← HARD ZONE (นิ้วโป้งเข้าไม่ถึง)
│ ████████████████████ │     → วาง info-only, ไม่วาง button
│                      │
│ ░░░░░░░░░░░░░░░░░░░░ │  ← STRETCH ZONE (เอื้อมได้ยาก)
│ ░░░░░░░░░░░░░░░░░░░░ │     → วาง secondary action ได้
│                      │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← NATURAL ZONE (สบายที่สุด)
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │     → วาง primary action ทั้งหมด
│ [Bottom Sheet Area]  │
└──────────────────────┘

กฎ:
- Primary action (ถ่ายรูป, ยืนยัน, ส่งข้อมูล) → Bottom 40% ของหน้าจอ
- Secondary action (ดูประวัติ, กรอง) → Middle zone
- View-only (แผนที่, สถิติ) → Top zone ได้
```

### 7.2 FAB (Floating Action Button) — สำหรับ Collector Role

```tsx
// FAB สำหรับถ่ายรูป Test Kit — วางในโซนนิ้วโป้ง
const CollectorFAB = () => (
  <div className="
    absolute bottom-[104px] right-4  /* ← เหนือ bottom sheet */
    pointer-events-auto
    z-[600]
  ">
    <button className="
      w-14 h-14 rounded-full
      bg-blue-600 text-white
      shadow-[0_4px_16px_rgba(37,99,235,0.4)]
      flex items-center justify-center
      active:scale-[0.93] active:shadow-md
      transition-all duration-150
    ">
      <CameraIcon size={26} />
    </button>
    <p className="text-center text-xs text-gray-600 mt-1.5 font-medium">
      ถ่ายรูป
    </p>
  </div>
);
```

---

## PHASE 8 — GPS & Location UX

### 8.1 GPS State Design

```tsx
// GPS Status — แสดงใกล้ Search Bar
const GPSIndicator = ({ accuracy }: { accuracy: 'high' | 'medium' | 'low' | 'off' }) => {
  const states = {
    high:   { icon: '📍', label: 'GPS แม่นยำสูง',  color: 'text-green-600' },
    medium: { icon: '📍', label: 'GPS ปานกลาง',    color: 'text-yellow-600' },
    low:    { icon: '📍', label: 'GPS ไม่แม่นยำ',  color: 'text-red-500' },
    off:    { icon: '🔍', label: 'ไม่มีสัญญาณ GPS', color: 'text-gray-400' },
  }[accuracy];

  return (
    <div className={`flex items-center gap-1 text-xs ${states.color}`}>
      <span>{states.icon}</span>
      <span>{states.label}</span>
    </div>
  );
};
```

### 8.2 Location Accuracy Circle (React Leaflet)

```tsx
// วาด accuracy circle รอบ user location
const UserLocationMarker = ({ position, accuracy }) => (
  <>
    {/* Accuracy radius circle */}
    <Circle
      center={position}
      radius={accuracy}
      pathOptions={{
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.1,
        weight: 1.5,
      }}
    />
    {/* User dot */}
    <CircleMarker
      center={position}
      radius={8}
      pathOptions={{
        color: 'white',
        fillColor: '#3B82F6',
        fillOpacity: 1,
        weight: 2,
      }}
    />
  </>
);
```

---

## PHASE 9 — Desktop Split View

```tsx
// Desktop: Side Panel + Full Map (Google Maps Desktop Layout)
const MapPageDesktop = () => (
  <div className="flex h-screen">
    {/* Left Panel — 380px fixed */}
    <div className="w-[380px] flex-shrink-0 h-full overflow-y-auto
                    bg-white shadow-xl z-10 flex flex-col">
      <SearchSection />
      <FilterSection />
      <StationList />
    </div>

    {/* Right Map — fills remaining space */}
    <div className="flex-1 relative">
      <MapContainer className="w-full h-full" />
      <MapControls />
      <Legend />
    </div>
  </div>
);

// Mobile: Full-screen Map + Bottom Sheet
const MapPageMobile = () => (
  <div className="relative w-full h-dvh">
    <MapContainer className="absolute inset-0" />
    <UIOverlay>
      <SearchBar />
      <FilterChips />
      <Legend />
      <CollectorFAB />
    </UIOverlay>
    <BottomSheet />
  </div>
);

// Responsive switch
const MapPage = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  return isMobile ? <MapPageMobile /> : <MapPageDesktop />;
};
```

---

## PHASE 10 — Map Interaction Patterns

### 10.1 Zoom-based Content Strategy

```
Zoom 8–10  (จังหวัด)    → แสดง cluster เท่านั้น + ชื่อจังหวัด
Zoom 11–13 (อำเภอ)      → แสดง cluster + individual markers ที่ไม่ทับกัน
Zoom 14–16 (ตำบล)       → แสดง marker ทั้งหมด + popup ได้
Zoom 17+   (ระดับถนน)   → แสดง marker + label ชื่อ + accuracy circle
```

```tsx
const useZoomBasedDisplay = (map: L.Map) => {
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvent('zoom', () => setZoom(map.getZoom()));

  return {
    showLabels: zoom >= 14,
    showAccuracyCircle: zoom >= 16,
    clusterMaxRadius: zoom <= 10 ? 80 : zoom <= 13 ? 60 : 40,
  };
};
```

### 10.2 Map Transition Animations

```tsx
// Smooth fly-to เมื่อ user เลือก station
const flyToStation = (map: L.Map, station: Station) => {
  map.flyTo(
    [station.lat, station.lng],
    15,
    {
      duration: 1.2,          // วินาที
      easeLinearity: 0.25,    // Google Maps-like ease
    }
  );
};

// Pan เล็กน้อยเมื่อ bottom sheet ขยาย — เพื่อให้ marker ไม่ถูก sheet บัง
const panForBottomSheet = (map: L.Map, sheetHeight: number) => {
  const currentCenter = map.getCenter();
  const offset = sheetHeight / 2 / map.getZoomScale(map.getZoom());
  map.panBy([0, offset], { animate: true, duration: 0.3 });
};
```

---

## PHASE 11 — Performance Optimization (สำหรับ Map ที่มีหลาย Marker)

```tsx
// 1. Virtualize marker list ใน Bottom Sheet
import { FixedSizeList } from 'react-window';

// 2. Lazy load tile layers
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), {
  ssr: false,
});

// 3. ใช้ useMemo สำหรับ marker list
const markers = useMemo(() =>
  stations.filter(s => bounds.contains([s.lat, s.lng])),
  [stations, bounds]
);

// 4. Debounce map move event
const handleMapMove = useDebouncedCallback(() => {
  setVisibleBounds(map.getBounds());
}, 300);

// 5. Canvas rendering สำหรับ marker จำนวนมาก (> 1000)
const MapContainer = () => (
  <MapContainer renderer={L.canvas()} />
);
```

---

## PHASE 12 — LINE LIFF Integration UX

### 12.1 LIFF-specific Considerations

```
LIFF Context:
- เปิดใน LINE browser (WebView) → ไม่มี browser chrome
- ความสูง viewport = เต็มจอ LINE
- Safe area: ต้องเผื่อ env(safe-area-inset-bottom) สำหรับ iPhone notch
- Performance: JavaScript execution ช้ากว่า native browser ~20%
- GPS: ต้องขอ permission ผ่าน LIFF SDK

กฎ LIFF UX:
✅ ใช้ env(safe-area-inset-bottom) ใน padding ทุกที่ที่อยู่ด้านล่าง
✅ ใช้ 100dvh แทน 100vh (ป้องกัน viewport resize ใน iOS)
✅ Loading ขั้นต้น: แสดง skeleton แทน spinner (เร็วกว่า)
✅ ขอ GPS permission ก่อนเปิดแผนที่ (ไม่ขอกลางทาง)
❌ อย่าใช้ window.location.href สำหรับ navigation (ให้ใช้ LIFF.closeWindow)
❌ อย่า autoplay video/audio (LIFF WebView บล็อก)
```

```tsx
// Safe Area Padding — สำคัญมากใน LIFF + iPhone
const BottomSheet = () => (
  <div
    style={{
      paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
    }}
    className="..."
  >
    {/* content */}
  </div>
);
```

---

## CHECKLIST — ก่อน Deploy Map Feature

```
Layout
  [ ] Map container ใช้ h-dvh ไม่ใช่ h-screen หรือ 100vh
  [ ] UI overlay ใช้ pointer-events: none + reset ที่ interactive elements
  [ ] Bottom sheet ไม่บัง marker เมื่อ expand
  [ ] Safe zone ด้านบน/ล่างถูกต้อง ไม่มี UI บดบัง Map Clear Zone

Markers
  [ ] Marker size ≥ 32px (mobile touch target)
  [ ] Active marker ใหญ่กว่า inactive ≥ 20%
  [ ] Clustering ทำงานถูกต้อง ไม่มี marker ทับกัน
  [ ] Marker icon iconAnchor ตรงปลาย (ไม่ลอย)

Bottom Sheet
  [ ] Snap points ทำงานถูกต้อง 3 states
  [ ] Content scroll ใน sheet ไม่ scroll แผนที่
  [ ] FAB อยู่เหนือ bottom sheet เสมอ
  [ ] safe-area-inset-bottom ถูก apply

Performance
  [ ] Tile layer ไม่ flicker เมื่อ pan/zoom
  [ ] Marker cluster render < 16ms
  [ ] Bottom sheet animation 60fps

GPS & LIFF
  [ ] GPS permission request ก่อนโหลดแผนที่
  [ ] Accuracy indicator แสดงสถานะ
  [ ] LIFF SDK initialize สำเร็จก่อน render
  [ ] Safe area inset apply ทุก bottom element
```

---

*SKILL.md version 1.0 — Google Maps UX/UI Pattern*
*ออกแบบเฉพาะสำหรับ: Water Quality Monitoring System (Thailand)*
*Tech Stack: Next.js + React Leaflet + Tailwind CSS + LINE LIFF*
