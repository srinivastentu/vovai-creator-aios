-- CR-9: Workspace gains `niches` and `lastActiveAt` for the CRUD UI.
-- `niches` mirrors the per-entity niche tags already on CreatorPersona/Idea.
-- `lastActiveAt` powers the workspace-list "last active" column and the
-- dashboard's touchLastActive() loader. Both additive; backfilled by defaults.

ALTER TABLE "Workspace" ADD COLUMN "niches" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Workspace" ADD COLUMN "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
