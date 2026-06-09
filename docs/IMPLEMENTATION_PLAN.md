# 🔧 Implementation Plan: Major Refactor v2.0

## สรุปโปรเจกต์
**Water Quality Monitoring System** — ระบบวิเคราะห์คุณภาพน้ำทะเลชายฝั่งด้วย AI  
Tech: Next.js (App Router) + TypeScript + MySQL (Prisma) + Tailwind CSS + React Leaflet + LINE LIFF

---

## 🔴 จุดด้อยที่พบจากการ Audit (Pain Points)

### 1. Navbar บังข้อมูล — ปัญหาหลักที่ยังไม่หาย
- **สาเหตุราก:** `layout.tsx` มี `<main className="pb-20">` แต่แต่ละ `page.tsx` ก็ใส่ `pb-36` อีก → Padding ซ้ำซ้อนไม่มีมาตรฐาน
- **Navbar** อยู่ที่ `z-[1000]` แต่ Bottom Sheet ใช้ `z-[1002]` → Z-index วุ่นวาย
- **หน้า Map** ใช้ `bottom: '80px'` แบบ hardcode ไม่ตรงกับ Navbar จริง (68px + 16px gap = 84px+)

### 2. Z-Index ไม่มีระบบ
- Navbar: `z-[1000]`, FilterBar: `z-[999]`, BottomSheet: `z-[1002]`, Loading: `z-[999]`
- ไม่มี CSS Variables จัดการ → เมื่อเพิ่ม Component ใหม่ต้องมาเดา z-index ทุกครั้ง

### 3. Marker ไม่สื่อสารสถานะน้ำ
- `LocationPin.tsx` แสดงสีตาม **หน่วยงาน** (Fishery=Blue, Pollution=Teal) ไม่ได้แสดงตาม **สถานะน้ำ** (Safe/Warning/Danger)
- ผู้ใช้มองแผนที่แล้วไม่รู้ทันทีว่าจุดไหนวิกฤต

### 4. Dashboard ขาด KPI Summary
- เข้าหน้า Executive แล้วเจอกราฟเลย ไม่มีตัวเลขสรุปด้านบน (Total Samples, จุดวิกฤต, อัตราปลอดภัย)
- กราฟไม่มี ReferenceLine แสดงเกณฑ์มาตรฐานกรมควบคุมมลพิษ

### 5. BottomSheet ขาด Drag Gesture
- ปัจจุบันเป็น "Modal" (เปิด-ปิด) ไม่ใช่ "Sheet" ที่สไลด์ขึ้นลงได้
- ไม่มี snap points (collapsed/half/full)

### 6. Collector Page ยังมีปุ่ม Mock Data
- ปุ่ม "สร้างข้อมูลจำลอง" ไม่ควรมีใน Production

### 7. ไม่มี Loading Skeleton
- ทุกหน้าใช้ text "กำลังโหลดข้อมูล..." แทน skeleton placeholder ที่ดูเป็นมืออาชีพ

---

## ✅ แผนการปรับปรุง (แบ่งเป็น Phase)

---

### PHASE A: แก้ปัญหา Navbar & Z-Index (เร่งด่วน)

#### A1. [MODIFY] `app/globals.css`
- เพิ่ม CSS Variables สำหรับ Z-Index Layer Stack:
```css
:root {
  --z-map: 0;
  --z-marker: 400;
  --z-control: 500;
  --z-ui: 600;
  --z-panel: 700;
  --z-modal: 800;
  --z-toast: 900;
  --z-navbar: 950;
}
```
- เพิ่ม CSS Variable สำหรับ Navbar Safe Area:
```css
:root {
  --navbar-height: 68px;
  --navbar-bottom-gap: 16px;
  --safe-bottom: calc(var(--navbar-height) + var(--navbar-bottom-gap) + 20px);
}
```

#### A2. [MODIFY] `app/layout.tsx`
- ลบ `pb-20` ออกจาก `<main>` เพราะแต่ละหน้าจะจัดการเอง
- เพิ่ม CSS class `.page-container` สำหรับหน้าที่ต้อง scroll

#### A3. [MODIFY] `components/Navbar.tsx`
- เปลี่ยน `z-[1000]` เป็น `z-[var(--z-navbar)]` หรือ `z-[950]`

#### A4. [MODIFY] ทุก `page.tsx`
- เปลี่ยนจาก `pb-36` เป็น `pb-[var(--safe-bottom)]` หรือใช้ค่าคงที่ `pb-[120px]` ให้ตรงกันทุกหน้า

#### A5. [MODIFY] `app/map/page.tsx`
- เปลี่ยนจาก `bottom: '80px'` เป็นใช้ CSS Variable `bottom: 'var(--safe-bottom)'`

---

### PHASE B: ยกระดับแผนที่ (Google Maps Style)

#### B1. [MODIFY] `components/LocationPin.tsx`
- เปลี่ยนจากแสดงสีตามหน่วยงาน → **แสดงสีตามสถานะน้ำ** (Green/Amber/Red)
- ใช้ SVG Marker แบบ Google Maps Pin ที่มี Drop Shadow

#### B2. [MODIFY] `components/FilterBar.tsx`
- เปลี่ยนจาก Dropdown เป็น **Horizontal Filter Chips** (เลื่อนซ้าย-ขวาได้)
- เพิ่มตัวกรองตามสถานะน้ำ: ทั้งหมด | ปลอดภัย | เฝ้าระวัง | อันตราย

#### B3. [MODIFY] `components/MapView.tsx`
- เพิ่ม Legend Widget (แถบสัญลักษณ์สี) แบบ Google Maps — พับ/กางได้
- ปรับปรุง Locate Me button ให้วางตำแหน่งไม่ทับ BottomSheet

---

### PHASE C: Dashboard Executive 2.0

#### C1. [MODIFY] `components/AnalyticsCharts.tsx`
- เพิ่ม **KPI Summary Cards** ด้านบนสุด:
  - จำนวนตัวอย่างทั้งหมด
  - อัตราปลอดภัย (%)
  - จำนวนจุดวิกฤต
  - การเปลี่ยนแปลงจากสัปดาห์ก่อน
- เพิ่ม `ReferenceLine` ในกราฟ Line Chart แสดงเกณฑ์มาตรฐานกรมควบคุมมลพิษ
- เพิ่ม Skeleton Loading ขณะรอข้อมูล

#### C2. [MODIFY] `app/executive/page.tsx`
- เพิ่ม Summary header ก่อนส่งข้อมูลไป AnalyticsCharts

---

### PHASE D: Cleanup & Polish

#### D1. [MODIFY] `app/collector/page.tsx`
- ลบปุ่ม "สร้างข้อมูลจำลอง (Mock Data)" ออก
- เพิ่ม Empty State ที่ดูเป็นมืออาชีพขึ้น

#### D2. [MODIFY] ทุกหน้า — Loading States
- แทนที่ text "กำลังโหลดข้อมูล..." ด้วย Skeleton Placeholder
- ใช้ CSS class `.shimmer` ที่มีอยู่แล้วใน globals.css

---

## 📋 ลำดับการดำเนินงาน

| ลำดับ | งาน | ไฟล์ | ความสำคัญ |
|:---:|:---|:---|:---:|
| 1 | Z-Index Variables + Navbar Safe Area | `globals.css` | 🔴 สูงมาก |
| 2 | ลบ `pb-20` จาก layout | `layout.tsx` | 🔴 สูงมาก |
| 3 | อัปเดต Navbar z-index | `Navbar.tsx` | 🔴 สูงมาก |
| 4 | Unified bottom padding ทุก page | ทุก `page.tsx` | 🔴 สูงมาก |
| 5 | Map page safe area | `map/page.tsx` | 🔴 สูงมาก |
| 6 | Marker สีตามสถานะ | `LocationPin.tsx` | 🟡 สูง |
| 7 | KPI Summary Cards | `AnalyticsCharts.tsx` | 🟡 สูง |
| 8 | ReferenceLine ในกราฟ | `AnalyticsCharts.tsx` | 🟡 สูง |
| 9 | Filter Chips + Legend | `FilterBar.tsx`, `MapView.tsx` | 🟢 ปานกลาง |
| 10 | ลบ Mock Data button | `collector/page.tsx` | 🟢 ปานกลาง |
| 11 | Skeleton Loading | ทุกหน้า | 🟢 ปานกลาง |

---

## Verification Plan

### Manual Verification
- เลื่อนลงสุดในทุกหน้า → ข้อมูลสุดท้ายต้องไม่ถูก Navbar บัง
- หน้า Map → Marker ต้องแสดงสี Safe/Warning/Danger ได้ถูกต้อง
- หน้า Executive → ต้องเห็น KPI Cards + เส้นมาตรฐานในกราฟ
- ตรวจสอบบน Mobile Emulator → ทุกปุ่มกดได้สะดวก (≥44px)

---

*Plan version 2.0 — 15 พฤษภาคม 2569*
