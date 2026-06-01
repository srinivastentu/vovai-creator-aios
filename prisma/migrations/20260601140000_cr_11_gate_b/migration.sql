-- CR-11: Gate B (per-artifact review) schema additions.
--
-- Artifact gains Gate B review fields, mirroring CR-10's LongFormMaster pair:
-- `reviewFeedback` holds the reviewer's note on feedback/reject; `reviewedAt`
-- timestamps the human action. Both nullable (null until reviewed) and additive.
--
-- IterationRecord gains `detailJson` — the cross-critique per-role iteration
-- detail (producer A/B + integrator snippets, judgeSkipped, producersSucceeded)
-- that homes the Gate B iteration-history panel. Nullable: Standard-loop
-- iterations carry no cross-critique detail. Additive — no backfill required.

ALTER TABLE "Artifact" ADD COLUMN "reviewFeedback" TEXT;
ALTER TABLE "Artifact" ADD COLUMN "reviewedAt" TIMESTAMP(3);

ALTER TABLE "IterationRecord" ADD COLUMN "detailJson" JSONB;
