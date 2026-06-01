-- CR-10: LongFormMaster gains Gate A review fields.
-- `reviewFeedback` stores the reviewer's note when a human submits feedback or
-- reject at Gate A; `reviewedAt` timestamps the human action. Both are nullable
-- (null while the master is still gate_a_pending / unreviewed) and additive — no
-- backfill required.

ALTER TABLE "LongFormMaster" ADD COLUMN "reviewFeedback" TEXT;
ALTER TABLE "LongFormMaster" ADD COLUMN "reviewedAt" TIMESTAMP(3);
