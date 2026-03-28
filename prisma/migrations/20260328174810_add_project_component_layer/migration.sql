-- CreateEnum
CREATE TYPE "ProjectArchetype" AS ENUM ('course', 'workshop', 'certification', 'tutorial', 'bootcamp', 'microlearning');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('draft', 'ideating', 'structured', 'approved', 'in_production', 'completed');

-- CreateEnum
CREATE TYPE "ComponentStatus" AS ENUM ('planned', 'configured', 'queued', 'in_production', 'completed', 'skipped');

-- CreateEnum
CREATE TYPE "ComponentPriority" AS ENUM ('core', 'recommended', 'optional');

-- CreateEnum
CREATE TYPE "IdeationPhase" AS ENUM ('brainstorm', 'structure', 'refinement', 'review', 'approved');

-- CreateEnum
CREATE TYPE "BrainstormRole" AS ENUM ('human', 'facilitator', 'researcher', 'pedagogy_expert', 'audience_analyst', 'structure_architect', 'creative_director', 'critic', 'synthesizer');

-- CreateEnum
CREATE TYPE "GradeRecommendation" AS ENUM ('approve', 'revise', 'restructure', 'reject');

-- CreateTable
CREATE TABLE "ProjectBlueprint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "archetype" "ProjectArchetype" NOT NULL DEFAULT 'course',
    "hierarchyLabels" JSONB NOT NULL,
    "targetAudience" JSONB NOT NULL,
    "learningOutcomes" JSONB NOT NULL,
    "enabledComponents" JSONB NOT NULL,
    "ideationPhase" "IdeationPhase" NOT NULL DEFAULT 'brainstorm',
    "ideationScore" DOUBLE PRECISION,
    "structureSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBlueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectNode" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "learningOutcomes" JSONB NOT NULL DEFAULT '[]',
    "status" "NodeStatus" NOT NULL DEFAULT 'draft',
    "agentConfidence" DOUBLE PRECISION,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeComponent" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "priority" "ComponentPriority" NOT NULL DEFAULT 'core',
    "status" "ComponentStatus" NOT NULL DEFAULT 'planned',
    "relevanceScore" DOUBLE PRECISION,
    "pipelineJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeationConversation" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "phase" "IdeationPhase" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeationConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "BrainstormRole" NOT NULL,
    "messageType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "structuredData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlueprintVersion" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "rubricScore" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlueprintVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureGrade" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "dimensionScores" JSONB NOT NULL,
    "recommendation" "GradeRecommendation" NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StructureGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBlueprint_projectId_key" ON "ProjectBlueprint"("projectId");

-- CreateIndex
CREATE INDEX "ProjectNode_blueprintId_depth_idx" ON "ProjectNode"("blueprintId", "depth");

-- CreateIndex
CREATE INDEX "ProjectNode_parentId_idx" ON "ProjectNode"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectNode_blueprintId_path_key" ON "ProjectNode"("blueprintId", "path");

-- CreateIndex
CREATE INDEX "NodeComponent_nodeId_idx" ON "NodeComponent"("nodeId");

-- CreateIndex
CREATE INDEX "NodeComponent_pipelineJobId_idx" ON "NodeComponent"("pipelineJobId");

-- CreateIndex
CREATE INDEX "IdeationConversation_blueprintId_idx" ON "IdeationConversation"("blueprintId");

-- CreateIndex
CREATE INDEX "IdeationMessage_conversationId_idx" ON "IdeationMessage"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintVersion_blueprintId_version_key" ON "BlueprintVersion"("blueprintId", "version");

-- CreateIndex
CREATE INDEX "StructureGrade_blueprintId_idx" ON "StructureGrade"("blueprintId");

-- AddForeignKey
ALTER TABLE "ProjectBlueprint" ADD CONSTRAINT "ProjectBlueprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectNode" ADD CONSTRAINT "ProjectNode_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ProjectBlueprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectNode" ADD CONSTRAINT "ProjectNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeComponent" ADD CONSTRAINT "NodeComponent_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "ProjectNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeComponent" ADD CONSTRAINT "NodeComponent_pipelineJobId_fkey" FOREIGN KEY ("pipelineJobId") REFERENCES "StageSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeationConversation" ADD CONSTRAINT "IdeationConversation_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ProjectBlueprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeationMessage" ADD CONSTRAINT "IdeationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "IdeationConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintVersion" ADD CONSTRAINT "BlueprintVersion_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ProjectBlueprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureGrade" ADD CONSTRAINT "StructureGrade_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "ProjectBlueprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
