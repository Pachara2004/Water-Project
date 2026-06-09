---
name: ui-standardization
description: >
  Frontend UI/UX standardization guide for Next.js, Tailwind CSS, and TypeScript projects.
  Focuses on resolving alignment issues, responsive design, z-index conflicts, and grid layouts.
license: Internal use — Water Quality Monitoring System Project
---

# 🛠️ คู่มือมาตรฐานการปรับแต่ง UI/UX (Frontend UI Standardization)

## Tech Stack
- **Framework**: Next.js
- **Styling**: Tailwind CSS
- **Language**: TypeScript

---

## 📐 1. Flexbox & Alignment (การจัดระเบียบแกนและกึ่งกลาง)

### Common Issues
- Misaligned icons and text.
- Uneven baseline alignment for numbers and units.

### Best Practices
- Use `items-center` for horizontal alignment of icons and text.
- Use `items-baseline` for aligning mixed font sizes on the same line.
- Avoid `margin` for spacing; use `gap-{size}` in flex containers.

### Examples
```tsx
// Align icon and text
<button className="flex items-center justify-center gap-2">
  <CameraIcon />
  ข้อความ
</button>

// Align numbers and units
<div className="flex items-baseline gap-1">
  <span className="text-3xl">0.158</span>
  <span className="text-sm">mg/L</span>
</div>
```

---

## 📱 2. Viewport & Safe Area Management (การจัดการพื้นที่มือถือ)

### Common Issues
- Bottom navigation overlaps content.
- Safari’s URL bar hides content.

### Best Practices
- Use `pb-[env(safe-area-inset-bottom)]` for bottom navigation.
- Replace `min-h-screen` with `min-h-dvh` to account for dynamic viewport height.

### Examples
```tsx
// Bottom navigation
<nav className="fixed bottom-0 left-0 w-full pb-[env(safe-area-inset-bottom)] z-50">
  ...
</nav>

// Main container
<main className="min-h-dvh pb-[100px] overflow-y-auto">
  ...
</main>
```

---

## 🗂️ 3. Z-Index & Stacking Context (การจัดการมิติความลึก)

### Common Issues
- Floating buttons overlap text.
- Modals stack incorrectly.

### Z-Index Scale
- `z-0`: Map background.
- `z-10` to `z-20`: Floating buttons, markers.
- `z-30`: Sticky headers.
- `z-40`: Modals, dialogs, bottom sheets.
- `z-50`: Bottom navigation.
- `z-[100]`: Toast notifications, loading overlays.

---

## 📏 4. Grid & Table Layouts (การจัดระเบียบตารางข้อมูล)

### Common Issues
- Misaligned columns in custom grids.

### Best Practices
- Use CSS Grid for consistent column alignment.
- Avoid `<table>` for non-tabular data; use `grid-cols-{n}`.

### Examples
```tsx
// Table header
<div className="grid grid-cols-12 gap-2 font-bold pb-2 border-b">
  <div className="col-span-5">สถานที่</div>
  <div className="col-span-4">สังกัด</div>
  <div className="col-span-3 text-right">เตือนภัย</div>
</div>

// Table rows
<div className="grid grid-cols-12 gap-2 py-3 items-center">
  <div className="col-span-5 truncate">ปากแม่น้ำบางปะกง</div>
  <div className="col-span-4 text-sm text-gray-400">กรมประมง</div>
  <div className="col-span-3 text-right text-red-500">2 ครั้ง</div>
</div>
```

---

## 🌬️ 5. Negative Space & Typography (พื้นที่หายใจและตัวอักษร)

### Common Issues
- Overcrowded components.
- Text overflowing containers.

### Best Practices
- Use consistent padding (`p-4`, `p-5`) for cards and modals.
- Use `truncate` to prevent long text from breaking layouts.
- Adjust `line-height` for multi-line text in small containers.
- For disabled buttons, use `opacity-50 cursor-not-allowed` instead of changing colors.

### Examples
```tsx
// Truncate long text
<p className="truncate max-w-full">ชื่อสถานที่ที่ยาวมากๆ จนอาจจะล้นจอ</p>

// Disabled button
<button className="opacity-50 cursor-not-allowed">บันทึก</button>
```

---

## 📝 Checklist สำหรับการ Review Code (นำไปใช้ตอนทำ Pull Request)

- [ ] Are buttons and icons aligned using `items-center` and `gap`?
- [ ] Does the page include bottom padding for navigation?
- [ ] Are long text strings truncated to prevent layout breaks?
- [ ] Are z-index values consistent with the project scale?
- [ ] Has mobile responsiveness been tested (e.g., Chrome DevTools, iPhone view)?