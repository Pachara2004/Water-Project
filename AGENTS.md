<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Context

- Framework: `Next.js 16.2.4` with App Router, React 19.2.4, TypeScript 5.
- Styling: Tailwind CSS 4 + PostCSS.
- Data: Prisma 5.22.0 with MySQL and a shared client in `lib/prisma.ts`.
- Map: React Leaflet 5 with map-first UI and a bottom-sheet overlay.
- Mobile: `@line/liff` for LINE Webview integration and safe-area mobile behavior.

## Common Commands

- `npm run dev` — start local dev server
- `npm run build` — production build
- `npm run start` — production start
- `npm run lint` — ESLint check
- `npm run seed` — seed database via Prisma

## Key Conventions

- Prefer CSS variables and consistent layout tokens over hardcoded values.
- Use the existing bottom-sheet / map overlay pattern rather than adding new absolute overlay layers.
- Show water quality status using `SAFE`, `WARNING`, `DANGER` semantics, not organization color.
- Use Prisma enums and explicit `select` statements; avoid broad data loads and duplicate client instances.
- Account for mobile browser viewport behavior with `100dvh` and safe-area insets in LINE LIFF.
- Treat data writes as idempotent: prefer `upsert`, explicit partition overwrite, or deterministic update logic.

## Relevant Docs and Skills

- [Implementation plan and refactor priorities](docs/IMPLEMENTATION_PLAN.md)
- [Map / Google-style UX guidance](docs/skills/SKILL_googlemap_uxui.md)
- [Project skill reference overview](docs/skills/SKILL_project_reference.md)
- [Prisma schema and data model conventions](docs/skills/SKILL_prisma_data_model.md)
- [LINE LIFF mobile integration guidance](docs/skills/SKILL_line_liff_ux.md)
- [Data engineering, idempotency, and safe query patterns](docs/skills/SKILL_data_engineering.md)
