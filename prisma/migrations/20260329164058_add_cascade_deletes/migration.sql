-- DropForeignKey
ALTER TABLE "Artifact" DROP CONSTRAINT "Artifact_stageSessionId_fkey";

-- DropForeignKey
ALTER TABLE "BlueprintVersion" DROP CONSTRAINT "BlueprintVersion_blueprintId_fkey";

-- DropForeignKey
ALTER TABLE "IdeationConversation" DROP CONSTRAINT "IdeationConversation_blueprintId_fkey";

-- DropForeignKey
ALTER TABLE "IdeationMessage" DROP CONSTRAINT "IdeationMessage_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "IterationRecord" DROP CONSTRAINT "IterationRecord_stageSessionId_fkey";

-- DropForeignKey
ALTER TABLE "NodeComponent" DROP CONSTRAINT "NodeComponent_nodeId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectBlueprint" DROP CONSTRAINT "ProjectBlueprint_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectNode" DROP CONSTRAINT "ProjectNode_blueprintId_fkey";

-- DropForeignKey
ALTER TABLE "StageSession" DROP CONSTRAINT "StageSession_projectId_fkey";

-- DropForeignKey
ALTER TABLE "StructureGrade" DROP CONSTRAINT "StructureGrade_blueprintId_fkey";

-- AddForeignKey
ALTER TABLE "StageSession" ADD CONSTRAINT "StageSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_stageSessionId_fkey" FOREIGN KEY ("stageSessionId") REFERENCES "StageSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IterationRecord" ADD CONSTRAINT "IterationRecord_stageSessionId_fkey" FOREIGN KEY ("stageSessionId") REFERENCES "StageSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBlueprint" ADD CONSTRAINT "ProjectBlueprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectNode" ADD CONSTRAINT "ProjectNode_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ProjectBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeComponent" ADD CONSTRAINT "NodeComponent_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "ProjectNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeationConversation" ADD CONSTRAINT "IdeationConversation_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ProjectBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeationMessage" ADD CONSTRAINT "IdeationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "IdeationConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintVersion" ADD CONSTRAINT "BlueprintVersion_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ProjectBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureGrade" ADD CONSTRAINT "StructureGrade_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ProjectBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
