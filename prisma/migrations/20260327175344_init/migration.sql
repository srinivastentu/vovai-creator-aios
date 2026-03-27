-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('idle', 'generating', 'evaluating', 'presenting', 'awaiting_review', 'approved');

-- CreateEnum
CREATE TYPE "IterationOutcome" AS ENUM ('revised', 'presented', 'escalated', 'approved');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "currentRing" INTEGER NOT NULL DEFAULT 0,
    "totalCostUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'idle',
    "currentArtifactId" TEXT,
    "bestArtifactId" TEXT,
    "bestGrade" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "stageSessionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "sceneIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IterationRecord" (
    "id" TEXT NOT NULL,
    "stageSessionId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "iteration" INTEGER NOT NULL,
    "grade" JSONB NOT NULL,
    "outcome" "IterationOutcome" NOT NULL,
    "costModel" TEXT NOT NULL,
    "costInputTokens" INTEGER NOT NULL,
    "costOutputTokens" INTEGER NOT NULL,
    "costUSD" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IterationRecord_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StageSession" ADD CONSTRAINT "StageSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_stageSessionId_fkey" FOREIGN KEY ("stageSessionId") REFERENCES "StageSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IterationRecord" ADD CONSTRAINT "IterationRecord_stageSessionId_fkey" FOREIGN KEY ("stageSessionId") REFERENCES "StageSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
