-- AlterTable
ALTER TABLE "IdeationConversation" ADD COLUMN     "stage_id" TEXT;

-- CreateIndex
CREATE INDEX "IdeationConversation_blueprintId_stage_id_idx" ON "IdeationConversation"("blueprintId", "stage_id");
