---
name: uxui-design
description: >
  Apply this skill whenever the user wants to design, redesign, or improve a web or mobile UI.
  Triggers include: "ปรับปรุง UI", "ออกแบบหน้า", "จัดหน้า", "ทำให้สวยขึ้น", "layout พัง",
  "element ชนกัน", "ตกขอบ", "dashboard", "visualize ข้อมูล", "UX ดีขึ้น", "user-friendly",
  "redesign", "improve layout", "beautify", "make it look better", หรือเมื่อ user แชร์ screenshot
  ของหน้าเว็บและขอให้ปรับปรุง Use this skill before writing any HTML/CSS/JSX code for UI work.
license: Internal use
---

# UX/UI Design Skill — ออกแบบ UI ได้ถูกหลัก สวยงาม และใช้งานง่าย

คุณเป็นผู้เชี่ยวชาญด้าน UX/UI Design ที่เข้าใจทั้งหลักจิตวิทยาผู้ใช้ การจัด layout ที่ถูกหลัก
การ visualize ข้อมูล และการเขียนโค้ดเพื่อสร้าง interface ที่สวยงามและใช้งานได้จริง

---

## PHASE 0 — วิเคราะห์ก่อนออกแบบ (Required First Step)

ก่อนเขียนโค้ดหรือออกแบบใดๆ ให้ตอบคำถาม 5 ข้อนี้ก่อน (ในใจหรือแจ้ง user):

1. **ใครใช้?** — กลุ่มผู้ใช้คือใคร (เจ้าหน้าที่? ประชาชน? admin? มือใหม่? ผู้เชี่ยวชาญ?)
2. **ใช้ทำอะไร?** — Task หลักคืออะไร (ดูข้อมูล? กรอกข้อมูล? ตัดสินใจ? ติดตาม?)
3. **ข้อมูลอะไร?** — ข้อมูลที่ต้องแสดงมีกี่ชั้น กี่มิติ เปลี่ยนบ่อยแค่ไหน?
4. **Device ไหน?** — Mobile-first? Desktop? หรือ Responsive ทั้งคู่?
5. **มีปัญหาอะไรอยู่?** — element ชนกัน? ข้อมูลล้นกรอบ? ผู้ใช้หาของไม่เจอ? โหลดช้า?

---

## PHASE 1 — Container & Layout System (แก้ปัญหา element ตกขอบและชนกัน)

### 1.1 Box Model ที่ถูกต้อง

```css
/* ตั้งค่านี้เสมอ — ป้องกัน element ล้นกรอบ */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  overflow-x: hidden; /* ป้องกัน horizontal scroll */
}
```

### 1.2 Container System — ห่อทุก section ใน container เสมอ

```css
/* Container หลัก */
.container {
  width: 100%;
  max-width: 1280px;       /* จำกัดความกว้างสูงสุด */
  margin: 0 auto;          /* จัดกลาง */
  padding: 0 16px;         /* padding ด้านข้างสำหรับ mobile */
}

/* สำหรับ mobile */
@media (max-width: 768px) {
  .container {
    padding: 0 12px;
  }
}

/* Card container — ห่อ content ในกล่อง */
.card {
  background: var(--surface);
  border-radius: 12px;
  padding: 16px;
  overflow: hidden;        /* กัน content ล้นขอบ card */
  width: 100%;             /* ไม่ให้กว้างเกิน parent */
}
```

### 1.3 Grid Layout — จัดคอลัมน์อย่างเป็นระบบ

```css
/* Grid 12-column system */
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
  width: 100%;
}

/* ตัวอย่างการใช้งาน */
.col-12 { grid-column: span 12; }  /* เต็มแถว */
.col-6  { grid-column: span 6; }   /* ครึ่งหนึ่ง */
.col-4  { grid-column: span 4; }   /* หนึ่งในสาม */
.col-3  { grid-column: span 3; }   /* หนึ่งในสี่ */

/* Responsive collapse */
@media (max-width: 768px) {
  .col-6, .col-4, .col-3 {
    grid-column: span 12; /* stack บน mobile */
  }
}
```

### 1.4 Flex Layout — จัดองค์ประกอบใน row/column

```css
/* Row ที่ไม่ overflow */
.flex-row {
  display: flex;
  flex-wrap: wrap;         /* บรรทัดใหม่เมื่อแคบเกิน — ป้องกันล้นกรอบ */
  gap: 12px;
  align-items: center;
  min-width: 0;            /* ป้องกัน flex child ยืดเกิน */
}

/* Text ที่ไม่ล้น container */
.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;            /* สำคัญมากใน flex child */
}
```

### 1.5 Spacing Scale — ระยะห่างที่สอดคล้องกัน

```css
:root {
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  16px;
  --space-lg:  24px;
  --space-xl:  32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
}
```

**กฎการใช้ spacing:**
- ระหว่าง section ใหญ่: `--space-2xl` (48px)
- ระหว่าง card: `--space-lg` (24px)
- ภายใน card: `--space-md` (16px)
- ระหว่าง label กับ value: `--space-xs` หรือ `--space-sm`
- ห้ามใช้ magic number เช่น `margin: 37px` — ให้ใช้ตัวแปรเท่านั้น

---

## PHASE 2 — Visual Hierarchy & Typography (ลำดับความสำคัญของข้อมูล)

### 2.1 Type Scale — ขนาด font ที่เป็นระบบ

```css
:root {
  /* Scale */
  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 15px;
  --text-md:   17px;
  --text-lg:   20px;
  --text-xl:   24px;
  --text-2xl:  30px;
  --text-3xl:  38px;

  /* Weight */
  --weight-regular: 400;
  --weight-medium:  500;
  --weight-semibold: 600;
  --weight-bold:    700;

  /* Line height */
  --leading-tight:  1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}
```

### 2.2 Visual Hierarchy — 3 ชั้นที่ต้องชัดเจน

```
ชั้น 1 — Primary (ข้อมูลสำคัญที่สุด)
  → ตัวเลข KPI, สถานะ, ชื่อหัวข้อหลัก
  → font-size: --text-2xl ถึง --text-3xl, weight: bold
  → contrast สูง, สี accent

ชั้น 2 — Secondary (ข้อมูลสนับสนุน)
  → label, subtitle, หน่วย, วันที่
  → font-size: --text-sm ถึง --text-base, weight: medium
  → สีรอง, opacity ลดลง

ชั้น 3 — Tertiary (metadata, helper text)
  → คำอธิบาย, footnote, placeholder
  → font-size: --text-xs ถึง --text-sm
  → opacity: 0.5–0.6
```

### 2.3 Color System — ระบบสีที่สอดคล้องกัน

```css
:root {
  /* Brand */
  --color-primary:   #1A7F5A;  /* สี action หลัก */
  --color-secondary: #0F5FA6;

  /* Semantic Status */
  --color-safe:    #22C55E;   /* ปลอดภัย */
  --color-warning: #F59E0B;   /* เฝ้าระวัง */
  --color-danger:  #EF4444;   /* อันตราย */
  --color-info:    #3B82F6;

  /* Surface */
  --surface:        #FFFFFF;
  --surface-muted:  #F8FAFC;
  --surface-subtle: #F1F5F9;

  /* Text */
  --text-primary:   #0F172A;
  --text-secondary: #475569;
  --text-muted:     #94A3B8;

  /* Border */
  --border:        #E2E8F0;
  --border-strong: #CBD5E1;
}
```

**กฎการใช้สี:**
- ใช้สี semantic เสมอ (อย่าใช้ hardcoded hex ใน component)
- Status badge ต้องใช้ทั้ง background + text + icon ของสีเดียวกัน
- ห้ามใช้สีเกิน 5 สีใน 1 หน้า (นับ accent, status ด้วย)
- Text บน background สี ต้องมี contrast ratio ≥ 4.5:1 (WCAG AA)

---

## PHASE 3 — Data Visualization (แสดงข้อมูลอย่างถูกต้องและชัดเจน)

### 3.1 เลือก Chart Type ให้ถูกกับข้อมูล

| ข้อมูลที่ต้องการแสดง | Chart ที่ควรใช้ | Chart ที่ไม่ควรใช้ |
|---|---|---|
| แนวโน้มเวลา (time series) | Line chart | Bar chart, Pie |
| เปรียบเทียบ category | Bar chart (horizontal ถ้า label ยาว) | Pie ถ้า > 5 หมวด |
| สัดส่วน (< 5 หมวด) | Donut / Pie | Bar ถ้าต้องการ precise comparison |
| กระจาย / correlation | Scatter plot | Line chart |
| เปรียบเทียบ AM/PM | Grouped bar | Stacked bar (ถ้า sum ไม่สำคัญ) |
| ความแปรปรวนรายวัน | Bar chart + color encoding | Line chart |
| KPI เดี่ยว | Stat card + sparkline | Full chart (waste space) |

### 3.2 Chart Container Rules — chart ต้องไม่ล้นกรอบ

```css
.chart-wrapper {
  position: relative;
  width: 100%;
  /* ใช้ padding-bottom แทนการกำหนด height คงที่ */
  /* เพื่อให้ responsive */
  height: 220px;           /* หรือกำหนดตาม design */
  overflow: hidden;
}

/* สำหรับ recharts / chart.js — ต้องให้ parent มี size */
.chart-wrapper > * {
  position: absolute;
  inset: 0;
}
```

### 3.3 Data Label & Axis — ป้องกันตัวเลขชนกัน

```
✅ กฎสำหรับ X-axis labels:
  - ถ้า label > 6 ตัวอักษร → ให้ rotate 45° หรือแสดงทุก 2 จุด
  - Mobile: แสดง label น้อยลง (ทุก 3–5 จุด)
  - ใช้ abbreviated format: "11 พ.ค." แทน "11 พฤษภาคม 2569"

✅ กฎสำหรับ Y-axis:
  - ตั้งค่า domain ให้ data มี breathing room (min × 0.9, max × 1.1)
  - ใช้ tick count ≤ 5
  - ซ่อน Y-axis label ถ้า unit อยู่ใน chart title แล้ว

✅ กฎสำหรับ Legend:
  - วางที่ด้านล่าง ไม่ใช่ขวา (mobile-safe)
  - ใช้ colored dot + label, ไม่ใช่ colored line (อ่านยาก)
  - ถ้า series > 4 → ใช้ interactive legend (click to hide)
```

### 3.4 Status Indicator Design

```jsx
// Status badge ที่ถูกต้อง — มี icon + สี + ข้อความ
const StatusBadge = ({ status }) => {
  const config = {
    safe:    { label: 'ปลอดภัย',  bg: '#DCFCE7', text: '#15803D', icon: '●' },
    warning: { label: 'เฝ้าระวัง', bg: '#FEF3C7', text: '#B45309', icon: '▲' },
    danger:  { label: 'อันตราย',  bg: '#FEE2E2', text: '#DC2626', icon: '!' },
  };
  const c = config[status];
  return (
    <span style={{
      background: c.bg, color: c.text,
      padding: '2px 8px', borderRadius: '999px',
      fontSize: 12, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 4
    }}>
      {c.icon} {c.label}
    </span>
  );
};
```

### 3.5 Stat Card — KPI แบบ compact

```
┌─────────────────────────────┐
│  🧪 PHOSPHATE               │  ← label (text-xs, muted)
│  0.026 mg/L                 │  ← value (text-2xl, bold, primary color)
│  ─────── ● ปลอดภัย ─────── │  ← status badge
└─────────────────────────────┘

กฎ:
- label: uppercase, letter-spacing: 0.05em, สีรอง
- value: ใหญ่ที่สุด, bold, สีหลัก หรือสี semantic
- unit: เล็กกว่า value, inline, สีรอง
- status: badge อยู่ด้านล่าง value เสมอ
- ห้ามใส่ข้อมูลอื่นใน card เดียวกันถ้าไม่จำเป็น
```

---

## PHASE 4 — Navigation & Information Architecture

### 4.1 Bottom Navigation (Mobile)

```
กฎ Bottom Tab Bar:
✅ มีได้ 3–5 tab (ไม่มากกว่า 5)
✅ Tab ที่ active ต้องชัดเจนด้วยทั้ง icon สี + label สี + underline หรือ fill
✅ Icon + Label ทุก tab (ไม่ใช่ icon อย่างเดียว)
✅ Height ≥ 56px (thumb-friendly)
✅ Safe area padding สำหรับ iPhone (padding-bottom: env(safe-area-inset-bottom))
❌ ห้ามซ่อน navigation ขณะ scroll บน mobile dashboard
```

### 4.2 Page Header

```
┌─────────────────────────────────┐
│ ← ย้อนกลับ    [ชื่อหน้า]   [action]│
└─────────────────────────────────┘

กฎ:
- ชื่อหน้า: กลาง หรือ ซ้ายตาม OS convention (iOS: กลาง, Android: ซ้าย)
- Back button: ซ้ายเสมอ, มี label "ย้อนกลับ" หรือ ชื่อหน้าก่อนหน้า
- Action button (เช่น กรอง, บันทึก): ขวาเสมอ
- ห้ามใส่ข้อมูลมากกว่า 3 ชิ้นใน header
```

### 4.3 List Item Design

```
┌────────────────────────────────────────────┐
│ [📍icon]  ชื่อสถานที่              [✏️] [🗑️] │
│           หน่วยงาน • พิกัด lat, lon         │
└────────────────────────────────────────────┘

กฎ:
- Leading icon/avatar: 40×40px, ไม่เล็กกว่า
- Primary text: text-base, bold/semibold
- Secondary text: text-sm, muted color, แถวเดียว
- Trailing actions: ≥ 44×44px tap target, มี gap ≥ 8px ระหว่างกัน
- Divider: 1px, border-color ไม่ใช่ hr element
- Hover/Press state: background change (surface-subtle)
```

---

## PHASE 5 — Forms & Input (ส่งข้อมูลโดยผู้ใช้)

### 5.1 Input Field Anatomy

```
[Label]             ← text-sm, semibold, สีหลัก
[__________________]← border 1.5px, radius 8px, padding 12px 16px
[Helper / Error]    ← text-xs, สี muted หรือ danger
```

```css
.input-field {
  width: 100%;
  padding: 12px 16px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  font-size: var(--text-base);
  color: var(--text-primary);
  background: var(--surface);
  transition: border-color 150ms ease;
  outline: none;
  min-height: 44px; /* thumb-friendly */
}

.input-field:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(26, 127, 90, 0.15);
}

.input-field.error {
  border-color: var(--color-danger);
}
```

### 5.2 Button Hierarchy

```
Primary   → filled, color-primary bg, white text — 1 ปุ่มต่อหน้า/section
Secondary → outlined, primary border + text
Tertiary  → text-only, primary color, no border
Danger    → filled, color-danger bg — สำหรับ destructive action เท่านั้น

กฎ:
- height ≥ 44px (mobile), ≥ 36px (desktop)
- ถ้า loading: แสดง spinner แทน label, disable คลิก
- ถ้า full-width (mobile): padding 16px vertical
- Primary action อยู่ขวา (หรือด้านล่าง บน mobile)
- Cancel / back อยู่ซ้าย
```

### 5.3 Upload Zone Design (เช่น อัปโหลดรูปภาพตัวอย่างน้ำ)

```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│                               │
│   [🖼️ icon, 48px]            │
│   คำอธิบายสั้น               │  ← text-sm, muted
│   ข้อกำหนดย่อย               │  ← text-xs, very muted
│                               │
│   [แตะเพื่อเลือกรูป]         │  ← text link หรือ ghost button
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
  border: 2px dashed, border-color: muted
  border-radius: 12px
  min-height: 160px
  background: surface-subtle
  drag-over state: border-color: primary, background: primary/5%
```

---

## PHASE 6 — Dashboard Layout Pattern

### 6.1 Dashboard Anatomy (จากตัวอย่าง water quality app)

```
[App Bar / Header]          ← sticky, 56px
  Title + filter controls

[Summary Section]           ← เห็นก่อนเสมอ (above the fold)
  Donut/stat + KPI cards (2-column grid)

[Trend Charts]              ← section ที่ 2
  Time-series line charts (1 per row บน mobile)

[Comparison Charts]         ← section ที่ 3
  Grouped bar, variance charts

[Risk Table / Alert List]   ← section สุดท้าย
  Sortable table หรือ list พร้อม badge
```

### 6.2 Filter Bar Design

```css
.filter-bar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;          /* scroll แนวนอนถ้าล้น */
  scrollbar-width: none;     /* ซ่อน scrollbar */
  -webkit-overflow-scrolling: touch;
}

/* Dropdown select ที่ชัดเจน */
.filter-select {
  appearance: none;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 8px;
  padding: 8px 32px 8px 12px;
  font-size: var(--text-sm);
  cursor: pointer;
  background-image: url("chevron-down.svg");
  background-position: right 8px center;
  background-repeat: no-repeat;
  white-space: nowrap;
  flex-shrink: 0; /* ป้องกัน compress ใน flex */
}
```

### 6.3 Section Spacing บน Dashboard

```
Page top padding:    16px
Between sections:    32px
Section title:       text-md, semibold, margin-bottom: 12px
Card gap (grid):     12–16px
Chart top margin:    8px (จาก section title)
Page bottom:         80px + safe-area (เผื่อ tab bar)
```

---

## PHASE 7 — Map UI Integration

### 7.1 Map + Panel Layout

```
Mobile — Full-screen map + bottom sheet:
  map: position fixed, inset 0
  panel: position fixed, bottom 0, left 0, right 0
         border-radius: 16px 16px 0 0
         min-height: 30vh, max-height: 85vh
         overflow-y: auto
         background: white
         padding: 12px 16px 80px (เผื่อ tab bar)

Desktop — Split view:
  left panel:  320–400px, fixed
  right map:   flex: 1
```

### 7.2 Map Marker Design

```
กฎ marker:
- ใช้สีตาม status: green=safe, orange=warning, red=danger
- ขนาด: 32–40px (mobile), 24–32px (desktop)
- ห้ามซ้อนทับกัน — ใช้ clustering ถ้า zoom ออกไกล
- Popup/tooltip: card เล็กๆ มี ชื่อ + สถานะ + ตัวเลขสำคัญ
- Active marker: ใหญ่กว่า 20%, drop-shadow
```

---

## PHASE 8 — Mobile UX Checklist

ก่อน deliver ทุกครั้ง ให้ check รายการนี้:

### Tap Targets
- [ ] ทุก interactive element ≥ 44×44px
- [ ] ระหว่างปุ่มชิดกัน มี gap ≥ 8px
- [ ] Floating action button ≥ 56px

### Text Readability
- [ ] Minimum font size: 12px (ห้ามเล็กกว่า)
- [ ] Body text: ≥ 15px
- [ ] Line height: ≥ 1.5 สำหรับ paragraph
- [ ] ไม่มี text บน background สีอ่อนเกินไป (contrast ≥ 4.5:1)

### Layout & Overflow
- [ ] ไม่มี horizontal scroll (ยกเว้น scroll container ตั้งใจ)
- [ ] ทุก image มี `max-width: 100%`
- [ ] ทุก chart wrapper มี `overflow: hidden`
- [ ] ไม่มี fixed width ที่อาจล้น container บน mobile

### Performance Feel
- [ ] Loading state มี skeleton หรือ spinner
- [ ] Error state มี icon + ข้อความ + ปุ่ม retry
- [ ] Empty state มี illustration + คำอธิบาย + call-to-action
- [ ] Transition animations ≤ 300ms (ไม่ช้าจนรู้สึก lag)

### Feedback
- [ ] ปุ่มกดแล้วมี visual feedback (ripple, scale, color change)
- [ ] Form submit มี loading + success + error state
- [ ] Destructive action มี confirmation dialog
- [ ] Toast/snackbar แสดงผลลัพธ์ action

---

## PHASE 9 — Responsive Breakpoints

```css
/* Mobile-first approach */
/* Base styles: mobile (< 640px) */

@media (min-width: 640px) {
  /* Small tablet / large phone landscape */
}

@media (min-width: 768px) {
  /* Tablet */
  .grid-tablet-2 { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  /* Desktop */
  .grid-desktop-3 { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1280px) {
  /* Large desktop */
  .grid-desktop-4 { grid-template-columns: repeat(4, 1fr); }
}
```

---

## PHASE 10 — Common Anti-Patterns (สิ่งที่ต้องหลีกเลี่ยง)

| ❌ Anti-Pattern | ✅ แก้ไขด้วย |
|---|---|
| `width: 500px` บน mobile container | `width: 100%; max-width: 500px` |
| `overflow: visible` บน chart wrapper | `overflow: hidden` |
| Text สีเทาอ่อนบน white (contrast ต่ำ) | ใช้ contrast checker, ≥ #767676 บน white |
| 3 status สีเดียวกัน แยกแค่ icon | ใช้ต่าง background color + text color |
| Form ไม่มี error state | เพิ่ม validation + error message ใต้ field |
| Chart ไม่มี loading state | เพิ่ม skeleton placeholder |
| Absolute positioning ทุกอย่าง | ใช้ flex/grid แทน |
| Font size < 12px | ขั้นต่ำ 12px, body ≥ 15px |
| ปุ่มกดได้พื้นที่ < 44px | เพิ่ม padding ใน button |
| Tab bar บัง content ด้านล่าง | เพิ่ม padding-bottom: 80px ใน page |
| Scroll ทั้งหน้าใน modal | จำกัด height modal + overflow-y: auto ใน content |
| ใช้สี hex hardcode ใน component | ใช้ CSS variable เสมอ |
| Chart ไม่มี legend | เพิ่ม legend ชัดเจน พร้อม label |
| Empty list ไม่มีข้อความอธิบาย | เพิ่ม empty state illustration + CTA |
| ไอคอน/ข้อความ กลืนหายไปกับพื้นหลังเวลากดปุ่ม (Active/Hover state) | จัดการ Contrast สีให้ดี เช่น หากใช้ `active:bg-blue-500` ไอคอนต้องเปลี่ยนเป็นสีขาว `group-active:text-white` |

---

## PHASE 11 — Design Token Template (Copy-Paste Ready)

```css
:root {
  /* === COLORS === */
  --color-primary:      #1A7F5A;
  --color-primary-light: #DCFCE7;
  --color-secondary:    #1D4ED8;
  --color-safe:         #22C55E;
  --color-warning:      #F59E0B;
  --color-danger:       #EF4444;

  /* === SURFACES === */
  --surface:            #FFFFFF;
  --surface-muted:      #F8FAFC;
  --surface-subtle:     #F1F5F9;

  /* === TEXT === */
  --text-primary:       #0F172A;
  --text-secondary:     #475569;
  --text-muted:         #94A3B8;

  /* === BORDER === */
  --border:             #E2E8F0;

  /* === SPACING === */
  --space-xs:   4px;  --space-sm:  8px;
  --space-md:  16px;  --space-lg: 24px;
  --space-xl:  32px;  --space-2xl: 48px;

  /* === TYPOGRAPHY === */
  --text-xs:   11px;  --text-sm:  13px;
  --text-base: 15px;  --text-md:  17px;
  --text-lg:   20px;  --text-xl:  24px;
  --text-2xl:  30px;

  /* === RADIUS === */
  --radius-sm:  6px;
  --radius-md:  10px;
  --radius-lg:  14px;
  --radius-xl:  20px;
  --radius-full: 9999px;

  /* === SHADOW === */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.10);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);

  /* === TRANSITION === */
  --transition-fast:   100ms ease;
  --transition-base:   200ms ease;
  --transition-slow:   300ms ease;
}
```

---

## Quick Reference — ลำดับขั้นตอนการทำงาน

```
1. วิเคราะห์ (Phase 0)    → ใคร? อะไร? อุปกรณ์ไหน?
2. Layout skeleton        → Container → Grid → Sections
3. Design tokens          → Colors, spacing, typography (Phase 11)
4. Component hierarchy    → Header → Content → Navigation
5. Data visualization     → เลือก chart type → ป้องกัน overflow
6. Interactive states     → Hover, Focus, Loading, Error, Empty
7. Responsive             → Mobile-first → Tablet → Desktop
8. Checklist (Phase 8)    → Tap targets, contrast, overflow, feedback
```

## PHASE 12 — Spacing & Safe Area Standards (มาตรฐานระยะห่าง)

เพื่อให้ Layout ดูโปร่ง อ่านง่าย และไม่ถูกส่วนประกอบคงที่ (Floating UI) บังข้อมูล:

### 12.1 Section Spacing (ระยะห่างระหว่างกลุ่มข้อมูล)
- **Gap between Cards/Sections:** ใช้ `space-y-8` หรือ `space-y-10` (32px - 40px)
- **Internal Padding:** ภายใน Card ควรมี padding ขั้นต่ำ `p-6` (24px) เพื่อไม่ให้เนื้อหาชิดขอบเกินไป
- **Heading Margin:** หัวข้อ (Title) กับเนื้อหาข้างใน ควรมีระยะห่าง `mb-4` ถึง `mb-6`

### 12.2 Bottom Safe Area (ระยะเผื่อสำหรับ Navbar)
- **Floating Navbar Rule:** หากใช้ Navbar แบบลอย (Fixed Bottom) ทุกหน้าต้องมี `padding-bottom` เผื่อไว้เสมอ
- **Standard Padding Bottom:** แนะนำให้ใช้ `pb-32` (128px) หรือ `pb-36` (144px) เพื่อให้มั่นใจว่าเมื่อเลื่อนลงสุด ข้อมูลแถวสุดท้ายจะลอยพ้น Navbar ขึ้นมา
- **Map View Rule:** สำหรับหน้าแผนที่เต็มจอ ให้ใช้ `bottom: 80px` หรือตามความสูง Navbar + 16px

---

*SKILL.md version 1.1 — UX/UI Design for Web & Mobile Applications*
*ออกแบบโดยคำนึงถึง: Water Quality Monitoring App (Thai Government), Dashboard Applications, Mobile-first Design*

