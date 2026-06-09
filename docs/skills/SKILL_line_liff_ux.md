---
name: line-liff-ux
description: >
  Apply this skill when building or improving LINE LIFF integration, mobile-safe UI, and role-based routing for the Water Quality project.
  Covers LIFF initialization, safe-area handling, GPS permission flows, and mobile viewport behavior.
license: Internal use — Water Quality Monitoring System Project
---

# LINE LIFF UX Skill
## Use this skill for LINE app integration and mobile-safe experience

This project uses `@line/liff` for LINE integration and targets mobile-first behavior in a webview context.
The UI must account for safe-area insets, dynamic viewport height, and the LINE app lifecycle.

---

## CORE GUIDELINES

- Initialize LIFF before rendering protected app screens.
- Use `100dvh` / dynamic viewport units instead of `100vh`.
- Always add bottom padding that includes `env(safe-area-inset-bottom, 0px)`.
- Do not assume browser chrome is constant; account for changing mobile address bars.

---

## SAFE AREA AND VIEWPORT

### CSS patterns
```css
.fullscreen {
  min-height: 100dvh; /* ensures correct viewport height on mobile */
}

.bottom-safe {
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}
```

### Bottom sheet and sticky controls
- Place persistent controls at least `88px` above the bottom edge on mobile.
- Use a bottom sheet that supports collapsed, half, and full states.
- Avoid fixed UI elements that overlap the map’s interactive area.

---

## LIFF INITIALIZATION PATTERN

### Example initialization
```ts
import liff from '@line/liff';

export async function initLiff() {
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
  if (!liff.isLoggedIn()) {
    liff.login();
  }
  return liff;
}
```

### Key behavior
- Redirect to `liff.login()` only when the user is not authenticated.
- Use `liff.getProfile()` after init to identify the user.
- Avoid rendering protected content until login status is confirmed.
- Prefer server-side or API-layer role resolution after obtaining the LINE user ID.

---

## ROLE-BASED ROUTING

- Resolve the user role from the LINE profile or backend via `lineUserId`.
- Map roles to routes consistently:
  - `collector` → `/collector`
  - `executive` → `/executive`
  - `admin` → `/admin/locations`
  - `user`/`general` → `/map`

### User flow
1. LIFF init
2. Check login status
3. Fetch/resolve role from backend
4. Redirect to the appropriate role-specific page

---

## GPS AND PERMISSION FLOW

- Request location permission only when necessary.
- Show a user-facing explanation before prompting for location access.
- If permission is denied, fallback gracefully to map view without live positioning.
- Cache the last known location when available.

### Example fallback text
> "เพื่อให้แสดงสถานที่ใกล้คุณได้แม่นยำ กรุณาอนุญาตแชร์ตำแหน่ง หากไม่อนุญาต คุณยังดูแผนที่ได้ตามปกติ."

---

## COMMON REPO REFERENCES

- `app/layout.tsx` and `app/map/page.tsx` for mobile map layout.
- `components/BottomSheet.tsx` for bottom-sheet behavior.
- `components/Navbar.tsx` for top-level safe-area handling.
- `package.json` for the `@line/liff` dependency.
