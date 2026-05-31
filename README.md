# CreatorOS

Agentic AI content production OS for creators. Second AIOS built
on the VOVAI Core Platform.

**Status:** V1 in progress. Build tracked via `git tag | grep CR-`.

## Stack

Next.js 15 (App Router) · TypeScript strict · Prisma 7 ·
PostgreSQL · Tailwind 4 · shadcn/ui · Vitest

## Documentation

- `docs/00-foundation/identity-and-scope.md` — what V1 ships
- `docs/00-foundation/master-context.md` — full V1 spec
- `docs/01-architecture/` — Core machinery (Loop Engine, MMS, etc.)
- `docs/02-domain/` — CreatorOS-specific entities, pipeline, rubrics
- `docs/04-plans/v1-action-plan.md` — 12-step build plan
- `docs/INDEX.md` — full doc map

## Development

    npm install
    npx prisma migrate dev
    npm run dev

Tests: `npm run test` · Typecheck: `npm run typecheck` ·
Build: `npm run build`

## License

Private. All rights reserved.
