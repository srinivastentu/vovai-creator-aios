-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('admin', 'writer', 'editor', 'reviewer');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('captured', 'in_progress', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "MasterStatus" AS ENUM ('draft', 'gate_a_pending', 'approved', 'in_repurpose');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('web', 'upload');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('linkedin_post', 'long_form_article');

-- CreateEnum
CREATE TYPE "DerivedVia" AS ENUM ('cross_critique', 'inline_edit', 'regenerate', 'merge');

-- CreateEnum
CREATE TYPE "ArtifactStatus" AS ENUM ('draft', 'awaiting_review', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorPersona" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "niches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "voiceTone" JSONB NOT NULL,
    "audienceProfile" JSONB NOT NULL,
    "creatorProfile" JSONB NOT NULL,
    "defaultRubricRefs" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorPersona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "niches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceUrl" TEXT,
    "status" "IdeaStatus" NOT NULL DEFAULT 'captured',
    "promotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LongFormMaster" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "MasterStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LongFormMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LongFormSection" (
    "id" TEXT NOT NULL,
    "longFormMasterId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,

    CONSTRAINT "LongFormSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSource" (
    "id" TEXT NOT NULL,
    "longFormMasterId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRef" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "researchSourceId" TEXT NOT NULL,
    "relevanceSnippet" TEXT NOT NULL,

    CONSTRAINT "SourceRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "longFormMasterId" TEXT NOT NULL,
    "artifactType" "ArtifactType" NOT NULL,
    "content" JSONB NOT NULL,
    "parentArtifactIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "derivedVia" "DerivedVia" NOT NULL,
    "bestScore" DOUBLE PRECISION,
    "status" "ArtifactStatus" NOT NULL DEFAULT 'draft',
    "costUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "finalArtifactId" TEXT,
    "terminationReason" TEXT,
    "costUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StageSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IterationRecord" (
    "id" TEXT NOT NULL,
    "stageSessionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "gradeJson" JSONB,
    "modelUsed" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "costUSD" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IterationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "CreatorPersona_userId_idx" ON "CreatorPersona"("userId");

-- CreateIndex
CREATE INDEX "Workspace_userId_idx" ON "Workspace"("userId");

-- CreateIndex
CREATE INDEX "Workspace_personaId_idx" ON "Workspace"("personaId");

-- CreateIndex
CREATE INDEX "Idea_workspaceId_idx" ON "Idea"("workspaceId");

-- CreateIndex
CREATE INDEX "LongFormMaster_workspaceId_idx" ON "LongFormMaster"("workspaceId");

-- CreateIndex
CREATE INDEX "LongFormMaster_ideaId_idx" ON "LongFormMaster"("ideaId");

-- CreateIndex
CREATE INDEX "LongFormSection_longFormMasterId_idx" ON "LongFormSection"("longFormMasterId");

-- CreateIndex
CREATE INDEX "ResearchSource_longFormMasterId_idx" ON "ResearchSource"("longFormMasterId");

-- CreateIndex
CREATE INDEX "SourceRef_sectionId_idx" ON "SourceRef"("sectionId");

-- CreateIndex
CREATE INDEX "SourceRef_researchSourceId_idx" ON "SourceRef"("researchSourceId");

-- CreateIndex
CREATE INDEX "Artifact_workspaceId_idx" ON "Artifact"("workspaceId");

-- CreateIndex
CREATE INDEX "Artifact_longFormMasterId_idx" ON "Artifact"("longFormMasterId");

-- CreateIndex
CREATE INDEX "StageSession_workspaceId_idx" ON "StageSession"("workspaceId");

-- CreateIndex
CREATE INDEX "IterationRecord_stageSessionId_idx" ON "IterationRecord"("stageSessionId");

-- AddForeignKey
ALTER TABLE "CreatorPersona" ADD CONSTRAINT "CreatorPersona_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "CreatorPersona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LongFormMaster" ADD CONSTRAINT "LongFormMaster_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LongFormMaster" ADD CONSTRAINT "LongFormMaster_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LongFormSection" ADD CONSTRAINT "LongFormSection_longFormMasterId_fkey" FOREIGN KEY ("longFormMasterId") REFERENCES "LongFormMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSource" ADD CONSTRAINT "ResearchSource_longFormMasterId_fkey" FOREIGN KEY ("longFormMasterId") REFERENCES "LongFormMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRef" ADD CONSTRAINT "SourceRef_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "LongFormSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRef" ADD CONSTRAINT "SourceRef_researchSourceId_fkey" FOREIGN KEY ("researchSourceId") REFERENCES "ResearchSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_longFormMasterId_fkey" FOREIGN KEY ("longFormMasterId") REFERENCES "LongFormMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageSession" ADD CONSTRAINT "StageSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IterationRecord" ADD CONSTRAINT "IterationRecord_stageSessionId_fkey" FOREIGN KEY ("stageSessionId") REFERENCES "StageSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
