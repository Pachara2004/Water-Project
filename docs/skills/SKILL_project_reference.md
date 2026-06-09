---
name: water-quality-project-skills
description: >
  Skills analysis and reference guide for Water Quality Monitoring System (Thailand).
  รวม skills ทั้งหมดที่จำเป็น: UX/UI, Map, LINE LIFF, AI Camera, Real-time, Database, Charts
license: Internal — Water Quality Monitoring System Project
---

# Water Quality Monitoring System
## Project Skills Reference Guide

ระบบบริหารจัดการและวิเคราะห์คุณภาพน้ำทะเลชายฝั่งแบบครบวงจร
Tech: Next.js 14 (App Router) + TypeScript + MySQL (Prisma) + Tailwind CSS + LINE LIFF

---

## SKILLS MAP — ภาพรวม Skills ที่ใช้ในโปรเจ็ค

```
Water Quality Monitoring System
│
├── 📱 FRONTEND
│   ├── SKILL: googlemap-uxui      → React Leaflet, Map layout, Marker, Bottom Sheet
│   ├── SKILL: uxui-design         → Dashboard, Component layout, Mobile-first
│   ├── SKILL: line-liff-ux        → LIFF integration, Safe area, GPS permission
│   └── SKILL: camera-ai-ux        → Image upload, AI analysis UX, Loading states
│
├── 📊 DATA VISUALIZATION
│   ├── SKILL: recharts-patterns   → Line, Bar, Grouped bar charts สำหรับ water data
│   └── SKILL: dashboard-executive → KPI cards, Summary views, Alert hierarchy
│
├── 🔄 REAL-TIME & API
│   ├── SKILL: nextjs-api-routes   → App Router API, Server Actions, Streaming
│   └── SKILL: realtime-patterns   → Polling, SWR, WebSocket patterns
│
├── 🗄️ DATABASE
│   ├── SKILL: prisma-mysql        → Schema design, Relations, Queries for water data
│   ├── SKILL: prisma-data-model   → Prisma schema, enums, idempotent writes, safe queries
│   └── SKILL: data-engineering    → Idempotent pipelines, query governance, safe DML
│
└── 🤖 AI INTEGRATION
    └── SKILL: ai-image-analysis   → Color extraction, Test Kit reading, Confidence score UX
```

---

## SKILL 1: Google Maps UX/UI
**ไฟล์:** `SKILL_googlemap_uxui.md`
**ใช้เมื่อ:** ทำงานกับ Map feature (React Leaflet), วาง UI บนแผนที่, ออกแบบ Marker, Bottom Sheet

**สิ่งสำคัญที่ต้องจำ:**
- Map ต้องเต็มจอเสมอ — UI overlay ต้องใช้ `pointer-events: none`
- Z-index stack: Map(0) → Marker(400) → Control(500) → UI(600) → Sheet(700) → Modal(800)
- Marker clustering ป้องกัน overlap — ใช้ `react-leaflet-cluster`
- Bottom Sheet 3 states: collapsed(88px) → half(45vh) → full(85vh)
- Desktop: side panel 380px + map; Mobile: full-screen map + bottom sheet

---

## SKILL 2: uxui-design (ที่มีอยู่แล้ว)
**ไฟล์:** `/mnt/skills/user/uxui-design/SKILL.md`
**ใช้เมื่อ:** ออกแบบ Dashboard, Component layout, Form, Data visualization

**สิ่งสำคัญสำหรับโปรเจ็คนี้:**
- Color system: Safe=#22C55E / Warning=#F59E0B / Danger=#EF4444
- Dashboard anatomy: App Bar → Summary KPI → Charts → Risk Table
- Mobile checklist: Tap target ≥ 44px, Font ≥ 12px, padding-bottom: 80px + safe-area
- Status badge: ต้องมีทั้ง bg + text + icon ของสีเดียวกัน

---

## SKILL 3: LINE LIFF UX
**สิ่งสำคัญ:**

```tsx
// Initialize LIFF ก่อน render ทุกอย่าง
import liff from '@line/liff';

export async function initLiff() {
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

  // ดึง user profile
  if (liff.isLoggedIn()) {
    const profile = await liff.getProfile();
    return profile;
  } else {
    liff.login();
  }
}

// Safe Area — ต้องใส่ทุก bottom element
.bottom-element {
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}

// Viewport — ใช้ dvh ไม่ใช่ vh
.fullscreen {
  height: 100dvh;
}

// ปิด LIFF window
const handleClose = () => liff.closeWindow();
```

**User Role Routing ตาม LIFF:**
```tsx
// ดึง role จาก LINE userId → query DB
const getUserRole = async (lineUserId: string) => {
  const user = await prisma.user.findUnique({
    where: { lineUserId },
    select: { role: true },
  });
  return user?.role; // 'collector' | 'executive' | 'admin' | 'general'
};

// Route ตาม role
const roleRoutes = {
  collector:  '/collector',   // Camera + GPS upload
  executive:  '/dashboard',  // Analytics + Map overview
  admin:      '/admin',      // User management + Station setup
  general:    '/map',        // View-only map
};
```

---

## SKILL 4: Camera & AI Analysis UX

### Upload Flow สำหรับ Collector Role

```
State 1: IDLE
  → แสดง Camera button (FAB) + instruction text
  → "แตะเพื่อถ่ายรูปชุดทดสอบน้ำ"

State 2: CAMERA_OPEN
  → เปิด camera (input type="file" accept="image/*" capture="environment")
  → overlay: "จัดตำแหน่งชุดทดสอบให้อยู่กึ่งกลาง"
  → Guide frame แสดงบนหน้าจอ

State 3: PREVIEW
  → แสดงรูปที่ถ่าย
  → ปุ่ม: "วิเคราะห์" (primary) + "ถ่ายใหม่" (secondary)
  → แสดง GPS coordinates (ดึงอัตโนมัติ)

State 4: ANALYZING (AI กำลังทำงาน)
  → Progress animation — "AI กำลังวิเคราะห์สี..."
  → ห้ามปิดหน้าจอ (แจ้ง user)
  → ใช้ skeleton loader ไม่ใช่ spinner

State 5: RESULT
  → แสดง: Ammonia value + Phosphate value + Status badge
  → Confidence score (%) — แสดงถ้า < 80% แนะนำให้ถ่ายใหม่
  → ปุ่ม: "ยืนยันส่งข้อมูล" + "ถ่ายใหม่"

State 6: SUBMITTED
  → Success animation (check mark)
  → "ส่งข้อมูลสำเร็จ เวลา HH:MM"
  → ปุ่ม "ส่งข้อมูลเพิ่มเติม" หรือ "กลับหน้าหลัก"
```

```tsx
// Camera Input Component
const CameraCapture = ({ onCapture }: { onCapture: (file: File) => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"  // ← เปิด back camera โดยตรง
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onCapture(file);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="w-16 h-16 rounded-full bg-blue-600 text-white
                   flex items-center justify-center shadow-lg
                   active:scale-95 transition-transform"
      >
        <CameraIcon size={28} />
      </button>
    </>
  );
};
```

### AI Result Display

```tsx
// แสดงผลวิเคราะห์ AI
const AIResultCard = ({ result }: { result: AIAnalysisResult }) => (
  <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-4">

    {/* Confidence Warning */}
    {result.confidence < 0.8 && (
      <div className="mb-3 p-3 rounded-xl bg-yellow-50 border border-yellow-200
                      flex items-start gap-2">
        <WarningIcon className="text-yellow-600 flex-shrink-0 mt-0.5" size={16} />
        <p className="text-xs text-yellow-700">
          ความแม่นยำต่ำ ({Math.round(result.confidence * 100)}%)
          แนะนำให้ถ่ายรูปใหม่ในแสงที่ดีกว่า
        </p>
      </div>
    )}

    {/* Values Grid */}
    <div className="grid grid-cols-2 gap-3">
      <div className="p-3 rounded-xl bg-blue-50">
        <p className="text-xs text-blue-600 font-medium mb-1">แอมโมเนีย (NH₃)</p>
        <p className="text-2xl font-bold text-blue-900">{result.ammonia}</p>
        <p className="text-xs text-blue-500">mg/L</p>
        <ThresholdBar value={result.ammonia} max={2} threshold={0.5} />
      </div>
      <div className="p-3 rounded-xl bg-purple-50">
        <p className="text-xs text-purple-600 font-medium mb-1">ฟอสเฟต (PO₄)</p>
        <p className="text-2xl font-bold text-purple-900">{result.phosphate}</p>
        <p className="text-xs text-purple-500">mg/L</p>
        <ThresholdBar value={result.phosphate} max={0.5} threshold={0.1} />
      </div>
    </div>

    {/* Overall Status */}
    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
      <p className="text-sm text-gray-600">ผลการวิเคราะห์โดยรวม</p>
      <StatusBadge status={result.overallStatus} />
    </div>
  </div>
);
```

---

## SKILL 5: Recharts Patterns สำหรับ Water Quality Data

### Chart Types ที่ใช้ในโปรเจ็ค

```tsx
// 1. Line Chart — แนวโน้ม Ammonia/Phosphate รายสัปดาห์
import { LineChart, Line, XAxis, YAxis, CartesianGrid,
         Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const WaterTrendChart = ({ data, parameter }) => (
  <ResponsiveContainer width="100%" height={220}>
    <LineChart data={data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
      <XAxis
        dataKey="date"
        tick={{ fontSize: 11, fill: '#94A3B8' }}
        tickFormatter={d => format(new Date(d), 'd MMM', { locale: th })}
      />
      <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />

      {/* เส้น threshold มาตรฐาน กรมควบคุมมลพิษ */}
      <ReferenceLine
        y={parameter === 'ammonia' ? 0.5 : 0.1}
        stroke="#F59E0B"
        strokeDasharray="4 4"
        label={{ value: 'มาตรฐาน', fill: '#F59E0B', fontSize: 10 }}
      />

      <Line
        dataKey="value"
        stroke="#3B82F6"
        strokeWidth={2}
        dot={{ r: 3, fill: '#3B82F6' }}
        activeDot={{ r: 5 }}
      />
      <Tooltip
        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
      />
    </LineChart>
  </ResponsiveContainer>
);

// 2. Grouped Bar Chart — เปรียบเทียบ เช้า vs เย็น
const MorningEveningChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={220}>
    <BarChart data={data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} />
      <Bar dataKey="morning" name="เช้า"  fill="#3B82F6" radius={[4, 4, 0, 0]} />
      <Bar dataKey="evening" name="เย็น"  fill="#8B5CF6" radius={[4, 4, 0, 0]} />
      <Legend
        wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        iconType="circle"
        iconSize={8}
      />
    </BarChart>
  </ResponsiveContainer>
);
```

### กฎสำคัญสำหรับ Recharts ในโปรเจ็คนี้

```
✅ ต้องทำ:
  - ห่อทุก chart ใน ResponsiveContainer width="100%" height={fixed}
  - แสดง ReferenceLine สำหรับค่ามาตรฐาน กรมควบคุมมลพิษ (Ammonia: 0.5, Phosphate: 0.1)
  - ใช้ abbreviated date format ภาษาไทย: "5 พ.ค." ไม่ใช่ "5 พฤษภาคม 2569"
  - Mobile: ลด tick count (interval="preserveStartEnd" หรือ interval={2})
  - Loading state: ใช้ skeleton div ขนาดเท่า chart ก่อน data โหลด

❌ ห้ามทำ:
  - กำหนด width ด้วย px ตรงๆ ใน BarChart/LineChart (ทำให้ responsive พัง)
  - ใส่ legend ด้านขวา (mobile: legend ต้องอยู่ด้านล่าง)
  - แสดงทุก data point บน mobile (เลือก sample ทุก 3–5 จุด)
  - ลืมเพิ่ม margin={{ left: -20 }} (กันตัวเลข Y-axis ชน edge)
```

---

## SKILL 6: Prisma + MySQL Schema สำหรับ Water Quality

```prisma
// schema.prisma — Water Quality System

model User {
  id          Int      @id @default(autoincrement())
  lineUserId  String   @unique
  name        String
  role        UserRole @default(GENERAL)
  createdAt   DateTime @default(now())
  samples     Sample[]
}

enum UserRole {
  COLLECTOR
  EXECUTIVE
  ADMIN
  GENERAL
}

model Station {
  id        Int      @id @default(autoincrement())
  name      String
  code      String   @unique  // รหัสจุดเก็บ เช่น "BKK-001"
  lat       Float
  lng       Float
  isActive  Boolean  @default(true)
  samples   Sample[]
  createdAt DateTime @default(now())
}

model Sample {
  id            Int          @id @default(autoincrement())
  stationId     Int
  collectorId   Int
  station       Station      @relation(fields: [stationId], references: [id])
  collector     User         @relation(fields: [collectorId], references: [id])

  // ค่าสารเคมี
  ammonia       Float        // mg/L
  phosphate     Float        // mg/L
  status        WaterStatus  // คำนวณจาก ammonia + phosphate

  // AI Analysis
  imageUrl      String       // path to uploaded image
  aiConfidence  Float        // 0–1
  rawAiResult   Json         // raw response จาก AI model

  // GPS
  lat           Float
  lng           Float
  accuracy      Float?       // GPS accuracy in meters

  // Timing
  collectedAt   DateTime     @default(now())  // เวลาเก็บตัวอย่าง
  timeOfDay     TimeOfDay    // MORNING | EVENING
  createdAt     DateTime     @default(now())

  @@index([stationId, collectedAt])
  @@index([status])
}

enum WaterStatus {
  SAFE
  WARNING
  DANGER
}

enum TimeOfDay {
  MORNING
  EVENING
}
```

### Queries ที่ใช้บ่อย

```typescript
// 1. Dashboard summary — สถิติทั้งหมด
const getDashboardSummary = async () => {
  const [total, byStatus] = await Promise.all([
    prisma.sample.count({ where: { collectedAt: { gte: startOfDay(new Date()) } } }),
    prisma.sample.groupBy({
      by: ['status'],
      _count: { status: true },
      where: { collectedAt: { gte: subDays(new Date(), 7) } },
    }),
  ]);
  return { total, byStatus };
};

// 2. Map data — ข้อมูลล่าสุดของแต่ละสถานี
const getLatestStationStatus = async () => {
  return prisma.$queryRaw`
    SELECT s.id, s.name, s.lat, s.lng, sm.ammonia, sm.phosphate, sm.status
    FROM Station s
    INNER JOIN Sample sm ON sm.id = (
      SELECT id FROM Sample
      WHERE stationId = s.id
      ORDER BY collectedAt DESC
      LIMIT 1
    )
    WHERE s.isActive = true
  `;
};

// 3. Trend data — 7 วันล่าสุด แยก AM/PM
const getWeeklyTrend = async (stationId: number) => {
  return prisma.sample.groupBy({
    by: ['collectedAt', 'timeOfDay'],
    _avg: { ammonia: true, phosphate: true },
    where: {
      stationId,
      collectedAt: { gte: subDays(new Date(), 7) },
    },
    orderBy: { collectedAt: 'asc' },
  });
};
```

---

## SKILL 7: Real-time Data Patterns (Next.js App Router)

```tsx
// Option A: SWR Polling (แนะนำสำหรับโปรเจ็คนี้ — ง่าย, เสถียร)
import useSWR from 'swr';

const useStationStatus = () => {
  const { data, error, isLoading } = useSWR(
    '/api/stations/status',
    fetcher,
    {
      refreshInterval: 30_000,    // อัปเดตทุก 30 วินาที
      revalidateOnFocus: true,    // อัปเดตเมื่อ user กลับมาที่แอป
      dedupingInterval: 10_000,
    }
  );
  return { stations: data, error, isLoading };
};

// Option B: Server-Sent Events (ถ้าต้องการ real-time จริงๆ)
// /api/stream/route.ts
export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = async () => {
        const data = await getLatestStationStatus();
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      await sendUpdate();
      const interval = setInterval(sendUpdate, 10_000);

      // Cleanup เมื่อ client disconnect
      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
```

---

## SKILL 8: Prisma Data Model and Idempotent Writes

- Use the new skill doc `docs/skills/SKILL_prisma_data_model.md` when working on Prisma schema changes or server-side data access.
- Prefer explicit `select` fields, enum-driven modeling, and single shared client usage from `lib/prisma.ts`.
- Keep schema changes small, and avoid broad `findMany` queries without filters or pagination.

---

## SKILL 9: Data Engineering and Safe Query Patterns

- Use `docs/skills/SKILL_data_engineering.md` for any batch, SQL, or data workflow logic.
- Emphasize idempotent writes with `upsert` or deterministic updates, and always preview rows before DML.
- Avoid `SELECT *`; choose exact columns, push predicates early, and do not collect large datasets into memory.

---

## STATUS CALCULATION — มาตรฐาน กรมควบคุมมลพิษ

```typescript
// ค่ามาตรฐานคุณภาพน้ำทะเล
const THRESHOLDS = {
  ammonia: {
    safe:    0.5,    // < 0.5 mg/L = ปลอดภัย
    warning: 1.0,    // 0.5–1.0 mg/L = เฝ้าระวัง
    // > 1.0 mg/L = อันตราย
  },
  phosphate: {
    safe:    0.1,    // < 0.1 mg/L = ปลอดภัย
    warning: 0.3,    // 0.1–0.3 mg/L = เฝ้าระวัง
    // > 0.3 mg/L = อันตราย
  },
};

export function calculateWaterStatus(
  ammonia: number,
  phosphate: number
): 'SAFE' | 'WARNING' | 'DANGER' {
  // ถ้าค่าใดค่าหนึ่งวิกฤต → ทั้งหมดวิกฤต
  if (ammonia > THRESHOLDS.ammonia.warning ||
      phosphate > THRESHOLDS.phosphate.warning) {
    return 'DANGER';
  }
  if (ammonia > THRESHOLDS.ammonia.safe ||
      phosphate > THRESHOLDS.phosphate.safe) {
    return 'WARNING';
  }
  return 'SAFE';
}
```

---

## QUICK REFERENCE — ใช้ Skill ไหน ทำอะไร

| งานที่ต้องทำ | Skill ที่ต้องอ่าน |
|---|---|
| วาง UI บนแผนที่ (Leaflet) | `googlemap-uxui` PHASE 1–3 |
| ออกแบบ Marker + Cluster | `googlemap-uxui` PHASE 4 |
| Search Bar + Filter บนแผนที่ | `googlemap-uxui` PHASE 5–6 |
| Bottom Sheet สำหรับ Station Detail | `googlemap-uxui` PHASE 3 |
| Dashboard Executive | `uxui-design` PHASE 6 |
| กราฟ Recharts | `uxui-design` PHASE 3 + SKILL 5 |
| หน้า Upload รูป Test Kit | SKILL 4 (Camera & AI UX) |
| LINE LIFF Integration | SKILL 3 (LIFF UX) |
| Database Query | SKILL 6 (Prisma) |
| Real-time Update | SKILL 7 (SWR/SSE) |
| Tailwind Mobile Layout | `uxui-design` PHASE 1 + PHASE 8 |
| Status Badge + Color | `uxui-design` PHASE 2 |

---

- [UI/UX Standardization](docs/skills/SKILL_ui_standardization.md): Guidelines for consistent and accessible user interfaces.

---

*Project Skills Reference v1.0*
*Water Quality Monitoring System (Thailand)*
*สร้าง: พฤษภาคม 2569*
