---
name: prisma-data-model
description: >
  Apply this skill when working with Prisma schema, MySQL data models, and backend data access patterns.
  Focus on using enums, relations, safe select queries, and the shared Prisma client in Water Quality Monitoring System.
license: Internal use — Water Quality Monitoring System Project
---

# Prisma Data Model Skill
## Use this skill for schema work, query design, and backend data access patterns

This project uses Prisma 5 with MySQL and a shared Prisma client instance in `lib/prisma.ts`.
Always keep data model changes minimal, explicit, and aligned with the existing enum-driven design.

---

## CORE GUIDELINES

- Prefer explicit schema design over generic `Json` or free-form fields.
- Use enums for fixed categories: `Role`, `LocationType`, `Status`, `OrganizationType`.
- Keep relations explicit and select only needed fields in queries.
- Avoid duplicate Prisma client instantiation in server code; use `lib/prisma.ts` with a singleton cache.

---

## SCHEMA PATTERNS TO FOLLOW

### Enum-driven domain modeling
- `Role` should define user roles like `ADMIN`, `COLLECTOR`, `EXECUTIVE`, `USER`.
- `Status` should represent water quality states like `SAFE`, `WARNING`, `DANGER`.
- `LocationType` should reflect station categories such as `CONSERVATION`, `CORAL_REEF`, `AQUACULTURE`, `RECREATION`, `INDUSTRY`, `COMMUNITY`.
- `OrganizationType` should distinguish `FISHERY`, `POLLUTION`, `OTHER`.

### Relationship guidance
- Prefer one-to-many relations with explicit foreign keys.
- Use `select` or `include` intentionally to avoid N+1 loading.
- Do not load entire related objects if only a few fields are required.

Example:
```ts
const location = await prisma.location.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    status: true,
    organizationType: true,
    latitude: true,
    longitude: true,
  },
});
```

---

## QUERY AND ACCESS RULES

- Never use broad fetch patterns in production code. Always explicitly define the returned columns.
- Push filters into the `where` clause as early as possible for efficiency.
- Use pagination / filtering for list APIs rather than loading all rows.
- Avoid `findMany` without a clear filter, limit, or pagination.

### Example of explicit filtering
```ts
const samples = await prisma.sample.findMany({
  where: {
    locationId: stationId,
    status: 'DANGER',
  },
  orderBy: { createdAt: 'desc' },
  take: 50,
  select: {
    id: true,
    status: true,
    createdAt: true,
    value: true,
  },
});
```

---

## BACKEND DATABASE SAFETY

- Use `upsert` or `update` with `where` for idempotent writes.
- Avoid destructive schema or data operations during regular development work.
- If a migration is needed, keep the schema change small and document it.

### Example idempotent write
```ts
await prisma.user.upsert({
  where: { lineUserId },
  create: { lineUserId, role: 'USER' },
  update: { lastSeenAt: new Date() },
});
```

---

## COMMON REPO FILES

- `prisma/schema.prisma` — source of truth for data models.
- `lib/prisma.ts` — shared Prisma client singleton.
- `app/api/*/route.ts` — API route data access patterns.

Use these files as the primary reference when making schema or backend data changes.
